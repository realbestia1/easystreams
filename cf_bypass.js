const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { exec } = require('child_process');

/**
 * Risolve la sfida Cloudflare usando FlareSolverr.
 *
 * Le richieste sono limitate da:
 * - lock per provider, per evitare bypass duplicati sullo stesso dominio;
 * - coda globale FIFO, per evitare di saturare CPU/RAM con troppi browser;
 * - timeout di coda, cosi le richieste non restano appese indefinitamente.
 */
const activeBypasses = new Map();
const providerCooldowns = new Map();
const throttledLogAt = new Map();
const globalQueue = [];
let activeGlobalRequests = 0;

function readPositiveIntEnv(name, fallback) {
    const value = Number.parseInt(String(process.env[name] || ''), 10);
    return Number.isInteger(value) && value > 0 ? value : fallback;
}

const MAX_GLOBAL_CONCURRENT = readPositiveIntEnv('FLARE_MAX_CONCURRENT', 4);
const MAX_GLOBAL_QUEUE = readPositiveIntEnv('FLARE_MAX_QUEUE', 100);
const GLOBAL_QUEUE_TIMEOUT = readPositiveIntEnv('FLARE_QUEUE_TIMEOUT_MS', 45000);
const FLARE_HEALTH_TIMEOUT = readPositiveIntEnv('FLARE_HEALTH_TIMEOUT_MS', 3000);
const FLARE_HEALTH_CACHE_MS = readPositiveIntEnv('FLARE_HEALTH_CACHE_MS', 10000);
const FLARE_RETRIES = readPositiveIntEnv('FLARE_RETRIES', 1);
const FLARE_FAILURE_COOLDOWN_MS = readPositiveIntEnv('FLARE_FAILURE_COOLDOWN_MS', 120000);
const FLARE_FAILURE_COOLDOWN_MAX_MS = readPositiveIntEnv('FLARE_FAILURE_COOLDOWN_MAX_MS', 300000);
const FLARE_ORIGIN_COOKIE_TIMEOUT = readPositiveIntEnv('FLARE_ORIGIN_COOKIE_TIMEOUT_MS', 10000);
const FLARE_CAPTURE_ORIGIN_COOKIES = !['0', 'false', 'no', 'off'].includes(
    String(process.env.FLARE_CAPTURE_ORIGIN_COOKIES || '').trim().toLowerCase()
);
const FLARE_CAPTURE_ORIGIN_COOKIE_PROVIDERS = new Set(
    String(process.env.FLARE_CAPTURE_ORIGIN_COOKIE_PROVIDERS || 'clicka')
        .split(',')
        .map(value => value.trim().toLowerCase())
        .filter(Boolean)
);
const FLARE_IDLE_CLEANUP_MS = readPositiveIntEnv('FLARE_IDLE_CLEANUP_MS', 5000);
const FLARE_IDLE_PROCESS_CLEANUP = !['0', 'false', 'no', 'off'].includes(
    String(process.env.FLARE_IDLE_PROCESS_CLEANUP || '').trim().toLowerCase()
);
let idleCleanupTimer = null;
let lastFlareHealthOkAt = 0;

function getFlareUrl() {
    return process.env.FLARE_URL || 'http://127.0.0.1:8191/v1';
}

function getStats() {
    return {
        active: activeGlobalRequests,
        queued: globalQueue.length,
        activeProviders: activeBypasses.size,
        maxConcurrent: MAX_GLOBAL_CONCURRENT,
        maxQueue: MAX_GLOBAL_QUEUE,
        queueTimeoutMs: GLOBAL_QUEUE_TIMEOUT,
        healthCacheMs: FLARE_HEALTH_CACHE_MS,
        failureCooldownMs: FLARE_FAILURE_COOLDOWN_MS,
        failureCooldownMaxMs: FLARE_FAILURE_COOLDOWN_MAX_MS,
        cooldowns: getActiveCooldownStats(),
        captureOriginCookies: FLARE_CAPTURE_ORIGIN_COOKIES,
        captureOriginCookieProviders: Array.from(FLARE_CAPTURE_ORIGIN_COOKIE_PROVIDERS),
        originCookieTimeoutMs: FLARE_ORIGIN_COOKIE_TIMEOUT,
        idleProcessCleanup: FLARE_IDLE_PROCESS_CLEANUP,
        idleCleanupMs: FLARE_IDLE_CLEANUP_MS
    };
}

function logThrottled(key, message, intervalMs = 5000) {
    const now = Date.now();
    const last = throttledLogAt.get(key) || 0;
    if (now - last < intervalMs) return;
    throttledLogAt.set(key, now);
    console.log(message);
}

function getActiveCooldown(provider) {
    const key = String(provider || 'default').toLowerCase();
    const entry = providerCooldowns.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.until) {
        providerCooldowns.delete(key);
        return null;
    }
    return entry;
}

function getActiveCooldownStats() {
    const now = Date.now();
    const stats = [];
    for (const [provider, entry] of providerCooldowns.entries()) {
        if (!entry || now >= entry.until) {
            providerCooldowns.delete(provider);
            continue;
        }
        stats.push({
            provider,
            remainingMs: entry.until - now,
            failures: entry.failures,
            reason: entry.reason
        });
    }
    return stats;
}

function markProviderCooldown(provider, error) {
    const key = String(provider || 'default').toLowerCase();
    const now = Date.now();
    const previous = providerCooldowns.get(key);
    const previousFailures = previous && now - previous.lastFailureAt <= FLARE_FAILURE_COOLDOWN_MAX_MS
        ? previous.failures
        : 0;
    const failures = previousFailures + 1;
    const duration = Math.min(
        FLARE_FAILURE_COOLDOWN_MS * Math.pow(2, Math.max(0, failures - 1)),
        FLARE_FAILURE_COOLDOWN_MAX_MS
    );
    const reason = error && error.message ? error.message : String(error || 'errore sconosciuto');
    providerCooldowns.set(key, {
        until: now + duration,
        lastFailureAt: now,
        failures,
        reason
    });
    console.warn(`[CF] Cooldown FlareSolverr per [${key}] ${Math.round(duration / 1000)}s dopo errore: ${reason}`);
}

function clearProviderCooldown(provider) {
    providerCooldowns.delete(String(provider || 'default').toLowerCase());
}

function clearIdleCleanupTimer() {
    if (!idleCleanupTimer) return;
    clearTimeout(idleCleanupTimer);
    idleCleanupTimer = null;
}

function createRelease() {
    let released = false;
    return () => {
        if (released) return;
        released = true;
        activeGlobalRequests = Math.max(0, activeGlobalRequests - 1);
        drainGlobalQueue();
    };
}

function drainGlobalQueue() {
    while (activeGlobalRequests < MAX_GLOBAL_CONCURRENT && globalQueue.length > 0) {
        const entry = globalQueue.shift();
        if (!entry || entry.done) continue;

        entry.done = true;
        clearTimeout(entry.timeoutId);
        activeGlobalRequests++;
        const waitedMs = Date.now() - entry.enqueuedAt;
        console.log(`[CF] Slot FlareSolverr assegnato a [${entry.provider}] dopo ${waitedMs}ms. Active=${activeGlobalRequests}, Queue=${globalQueue.length}`);
        entry.resolve(createRelease());
    }
}

function acquireGlobalSlot(provider, url) {
    clearIdleCleanupTimer();

    if (activeGlobalRequests < MAX_GLOBAL_CONCURRENT) {
        activeGlobalRequests++;
        return Promise.resolve(createRelease());
    }

    if (globalQueue.length >= MAX_GLOBAL_QUEUE) {
        return Promise.reject(new Error(`Coda FlareSolverr piena (${globalQueue.length}/${MAX_GLOBAL_QUEUE}) per ${provider}`));
    }

    return new Promise((resolve, reject) => {
        const entry = {
            provider,
            url,
            enqueuedAt: Date.now(),
            done: false,
            resolve,
            reject,
            timeoutId: null
        };

        entry.timeoutId = setTimeout(() => {
            if (entry.done) return;
            entry.done = true;
            const index = globalQueue.indexOf(entry);
            if (index >= 0) globalQueue.splice(index, 1);
            reject(new Error(`Timeout coda FlareSolverr dopo ${GLOBAL_QUEUE_TIMEOUT}ms per ${provider}`));
        }, GLOBAL_QUEUE_TIMEOUT);

        globalQueue.push(entry);
        console.log(`[CF] Coda FlareSolverr [${provider}] Queue=${globalQueue.length}/${MAX_GLOBAL_QUEUE} Active=${activeGlobalRequests}: ${url}`);
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function runIdleProcessCleanup() {
    if (!FLARE_IDLE_PROCESS_CLEANUP) return;
    if (activeGlobalRequests > 0 || globalQueue.length > 0) return;

    const command = process.platform === 'win32'
        ? `powershell -NoProfile -Command "$root = '${process.cwd().replace(/'/g, "''").toLowerCase()}'; $targets = Get-CimInstance Win32_Process | Where-Object { $p = ($_.ExecutablePath + '').ToLower(); ($_.Name -in @('chrome.exe','chromedriver.exe')) -and $p.StartsWith($root) }; foreach ($t in $targets) { Stop-Process -Id $t.ProcessId -Force -ErrorAction SilentlyContinue }"`
        : `sh -lc "pkill -f '[c]hromium|[c]hromedriver|--user-data-dir=/tmp/t[m]p' 2>/dev/null || true"`;

    exec(command, { timeout: 10000 }, (error) => {
        if (error) {
            console.error(`[CF] Idle cleanup browser fallito: ${error.message}`);
            return;
        }
        console.log('[CF] Idle cleanup browser completato.');
    });
}

function scheduleIdleProcessCleanup() {
    if (!FLARE_IDLE_PROCESS_CLEANUP) return;
    if (activeGlobalRequests > 0 || globalQueue.length > 0) return;
    clearIdleCleanupTimer();
    idleCleanupTimer = setTimeout(() => {
        idleCleanupTimer = null;
        runIdleProcessCleanup();
    }, FLARE_IDLE_CLEANUP_MS);
    if (typeof idleCleanupTimer.unref === 'function') idleCleanupTimer.unref();
}

function isRetryableFlareError(error) {
    const status = error && error.response && error.response.status;
    return error && (
        error.code === 'ECONNRESET' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNABORTED' ||
        status === 502 ||
        status === 503 ||
        status === 504
    );
}

async function postFlare(flareUrl, payload, timeout, attemptLabel) {
    let lastError = null;
    for (let attempt = 0; attempt <= FLARE_RETRIES; attempt++) {
        try {
            return await axios.post(flareUrl, payload, {
                timeout,
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            lastError = error;
            if (attempt >= FLARE_RETRIES || !isRetryableFlareError(error)) break;
            const waitMs = 750 * (attempt + 1);
            console.error(`[CF] FlareSolverr ${attemptLabel} fallito (${error.message}), retry tra ${waitMs}ms...`);
            await sleep(waitMs);
        }
    }
    throw lastError;
}

async function assertFlareSolverrReady(flareUrl) {
    if (Date.now() - lastFlareHealthOkAt <= FLARE_HEALTH_CACHE_MS) return;

    try {
        const response = await axios.post(flareUrl, { cmd: 'sessions.list' }, {
            timeout: FLARE_HEALTH_TIMEOUT,
            headers: { 'Content-Type': 'application/json' }
        });
        if (response.data && response.data.status === 'ok') {
            lastFlareHealthOkAt = Date.now();
            return;
        }
    } catch (error) {
        throw new Error(`FlareSolverr non disponibile su ${flareUrl}: ${error.message}`);
    }
}

function writeJsonAtomic(filePath, data) {
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
    fs.renameSync(tempPath, filePath);
}

function saveSessionFile(sessionFile, data) {
    try {
        writeJsonAtomic(sessionFile, data);
    } catch (error) {
        console.error(`[CF] Errore salvataggio sessione ${sessionFile}: ${error.message}`);
    }
}

function normalizeHost(host) {
    return String(host || '').trim().toLowerCase().replace(/^www\./, '').replace(/^\./, '');
}

function getHostFromUrl(url) {
    try {
        return normalizeHost(new URL(url).hostname);
    } catch {
        return '';
    }
}

function getOriginFromUrl(url) {
    try {
        const parsed = new URL(url);
        return `${parsed.protocol}//${parsed.hostname}`;
    } catch {
        return null;
    }
}

function normalizeCookieDomain(domain) {
    return normalizeHost(domain);
}

function cookieMatchesHost(cookie, host) {
    const cookieDomain = normalizeCookieDomain(cookie && cookie.domain);
    const targetHost = normalizeHost(host);
    if (!cookieDomain || !targetHost) return false;
    return targetHost === cookieDomain ||
        targetHost.endsWith(`.${cookieDomain}`) ||
        cookieDomain.endsWith(`.${targetHost}`);
}

function filterCookiesForHost(cookiesList, host) {
    return cookiesList.filter(cookie => cookieMatchesHost(cookie, host));
}

function uniqueCookies(cookiesList) {
    const byKey = new Map();
    for (const cookie of cookiesList) {
        if (!cookie || !cookie.name) continue;
        const key = [
            normalizeCookieDomain(cookie.domain),
            cookie.path || '/',
            cookie.name
        ].join('|');
        byKey.set(key, cookie);
    }
    return Array.from(byKey.values());
}

function serializeCookies(cookiesList) {
    return uniqueCookies(cookiesList)
        .map(cookie => `${cookie.name}=${cookie.value}`)
        .join('; ');
}

function getCookieDomains(cookiesList) {
    return [...new Set(
        uniqueCookies(cookiesList)
            .map(cookie => normalizeCookieDomain(cookie.domain))
            .filter(Boolean)
    )];
}

function findCfClearance(cookiesList) {
    return cookiesList.find(cookie => cookie && cookie.name === 'cf_clearance')?.value || null;
}

function shouldCaptureOriginCookies(provider, originalHost, finalHost, providerCookiesList) {
    if (!FLARE_CAPTURE_ORIGIN_COOKIES) return false;
    if (!originalHost || !finalHost || originalHost === finalHost) return false;
    if (providerCookiesList.length > 0) return false;
    const key = String(provider || '').toLowerCase();
    return FLARE_CAPTURE_ORIGIN_COOKIE_PROVIDERS.has('*') ||
        FLARE_CAPTURE_ORIGIN_COOKIE_PROVIDERS.has(key);
}

async function captureOriginCookies(flareUrl, provider, url) {
    const originalHost = getHostFromUrl(url);
    const origin = getOriginFromUrl(url);
    if (!origin || !originalHost) return [];

    const probeUrls = [
        `${origin}/cdn-cgi/trace`,
        `${origin}/favicon.ico`,
        `${origin}/`
    ];

    for (const probeUrl of probeUrls) {
        try {
            const response = await postFlare(flareUrl, {
                cmd: 'request.get',
                url: probeUrl,
                session: provider,
                maxTimeout: FLARE_ORIGIN_COOKIE_TIMEOUT
            }, FLARE_ORIGIN_COOKIE_TIMEOUT + 5000, `origin-cookie ${provider}`);

            if (!response.data || response.data.status !== 'ok') continue;

            const solution = response.data.solution || {};
            const cookiesList = Array.isArray(solution.cookies) ? solution.cookies : [];
            const originCookies = filterCookiesForHost(cookiesList, originalHost);
            if (originCookies.length > 0) {
                console.log(`[CF] Cookie dominio originale catturati per [${provider}] da ${probeUrl}: ${originCookies.length}`);
                return originCookies;
            }

            const returnedHost = getHostFromUrl(solution.url);
            console.log(`[CF] Nessun cookie ${originalHost} da ${probeUrl} (finale: ${returnedHost || 'n/d'}).`);
        } catch (error) {
            console.error(`[CF] Cattura cookie dominio originale fallita per [${provider}] ${probeUrl}: ${error.message}`);
        }
    }

    return [];
}

async function createSessionIfNeeded(flareUrl, provider) {
    try {
        await axios.post(flareUrl, { cmd: 'sessions.create', session: provider }, {
            timeout: 5000,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch {
        // Se esiste gia o FlareSolverr non supporta la create idempotente, proseguiamo.
    }
}

async function destroySessionIfNeeded(flareUrl, provider) {
    try {
        await axios.post(flareUrl, { cmd: 'sessions.destroy', session: provider }, {
            timeout: 5000,
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(`[CF] Sessione FlareSolverr chiusa per [${provider}].`);
    } catch {
        // La sessione puo essere gia chiusa o inesistente: non e un errore operativo.
    }
}

async function runBypass(url, provider, options, sessionFile) {
    const flareUrl = getFlareUrl();
    const releaseSlot = await acquireGlobalSlot(provider, url);

    try {
        await assertFlareSolverrReady(flareUrl);

        console.log(`[CF] Richiesta bypass a FlareSolverr [Session: ${provider}][Active: ${activeGlobalRequests}][Queue: ${globalQueue.length}]: ${url}`);
        await createSessionIfNeeded(flareUrl, provider);

        const maxTimeout = Number.isInteger(options.maxTimeout) && options.maxTimeout > 0
            ? options.maxTimeout
            : 35000;
        const requestTimeout = Number.isInteger(options.requestTimeout) && options.requestTimeout > maxTimeout
            ? options.requestTimeout
            : maxTimeout + 5000;

        const payload = {
            cmd: options.method === 'POST' ? 'request.post' : 'request.get',
            url,
            session: provider,
            maxTimeout
        };

        if (options.method === 'POST' && options.body) {
            payload.postData = options.body;
        }

        try {
            const response = await postFlare(flareUrl, payload, requestTimeout, `${payload.cmd} ${provider}`);

            if (response.data && response.data.status === 'ok') {
                const solution = response.data.solution || {};
                let cookiesList = Array.isArray(solution.cookies) ? solution.cookies : [];
                const originalHost = getHostFromUrl(url);
                const finalHost = getHostFromUrl(solution.url);
                let providerCookiesList = filterCookiesForHost(cookiesList, originalHost);

                console.log(`[CF] FlareSolverr ha restituito ${cookiesList.length} cookie.`);

                if (shouldCaptureOriginCookies(provider, originalHost, finalHost, providerCookiesList)) {
                    const originCookies = await captureOriginCookies(flareUrl, provider, url);
                    if (originCookies.length > 0) {
                        cookiesList = uniqueCookies([...cookiesList, ...originCookies]);
                        providerCookiesList = uniqueCookies([...providerCookiesList, ...originCookies]);
                    }
                }

                const cookies = serializeCookies(cookiesList);
                const cfClearance = findCfClearance(cookiesList);

                if (!cookies && !solution.response) {
                    throw new Error('FlareSolverr ha restituito successo ma zero cookie e nessuna risposta.');
                }

                const data = {
                    userAgent: solution.userAgent,
                    cookies: cookies || '',
                    cf_clearance: cfClearance || null,
                    url: solution.url,
                    response: solution.response,
                    cookieDomains: getCookieDomains(cookiesList),
                    timestamp: Date.now()
                };

                const providerCookies = serializeCookies(providerCookiesList);
                if (providerCookies || !originalHost || originalHost === finalHost) {
                    const providerData = {
                        userAgent: solution.userAgent,
                        cookies: providerCookies || cookies || '',
                        cf_clearance: findCfClearance(providerCookiesList) || cfClearance || null,
                        url: providerCookies ? url : solution.url,
                        response: solution.response,
                        cookieDomains: getCookieDomains(providerCookies ? providerCookiesList : cookiesList),
                        timestamp: Date.now()
                    };
                    saveSessionFile(sessionFile, providerData);
                } else {
                    console.log(`[CF] Cookie provider [${provider}] non trovati per ${originalHost}; non salvo cookie di ${finalHost || 'dominio finale'} in ${path.basename(sessionFile)}.`);
                }

                if (cookiesList.length > 0) {
                    const domains = getCookieDomains(cookiesList);
                    for (const domain of domains) {
                        const domainProvider = domain.replace('www.', '').split('.')[0];
                        if (!domainProvider || domainProvider === provider) continue;

                        const domainSessionFile = path.join(process.cwd(), `cf-session-${domainProvider}.json`);
                        const domainCookiesList = filterCookiesForHost(cookiesList, domain);
                        const domainCookies = serializeCookies(domainCookiesList);

                        if (!domainCookies) continue;

                        const domainData = {
                            userAgent: solution.userAgent,
                            cookies: domainCookies,
                            cf_clearance: findCfClearance(domainCookiesList),
                            url: solution.url,
                            cookieDomains: getCookieDomains(domainCookiesList),
                            timestamp: Date.now()
                        };
                        saveSessionFile(domainSessionFile, domainData);
                        console.log(`[CF] Salvata sessione extra per dominio: ${domain} -> ${domainProvider}`);
                    }
                }

                console.log(`[CF] FlareSolverr: Bypass completato con successo per ${url}`);
                clearProviderCooldown(provider);
                return data;
            }

            const errorMsg = response.data ? response.data.message : 'Risposta non valida da FlareSolverr';
            throw new Error(errorMsg);
        } catch (error) {
            console.error(`[CF] Errore FlareSolverr: ${error.message}`);
            if (error.code === 'ECONNREFUSED') {
                console.error(`[CF] ASSICURATI CHE FLARESOLVERR SIA ATTIVO SU ${flareUrl}`);
            }
            throw error;
        }
    } finally {
        await destroySessionIfNeeded(flareUrl, provider);
        releaseSlot();
        scheduleIdleProcessCleanup();
    }
}

async function getClearance(url, provider = 'default', options = {}) {
    const sessionFile = path.join(process.cwd(), `cf-session-${provider}.json`);

    if (activeBypasses.has(provider)) {
        logThrottled(`wait:${provider}`, `[CF] FlareSolverr bypass gia in corso per il provider [${provider}], attendo...`);
        return activeBypasses.get(provider);
    }

    const cooldown = getActiveCooldown(provider);
    if (cooldown) {
        const remainingMs = Math.max(0, cooldown.until - Date.now());
        throw new Error(`FlareSolverr in cooldown per [${provider}] ancora ${Math.ceil(remainingMs / 1000)}s (${cooldown.reason})`);
    }

    const bypassPromise = runBypass(url, provider, options, sessionFile)
        .catch((error) => {
            markProviderCooldown(provider, error);
            throw error;
        })
        .finally(() => {
            activeBypasses.delete(provider);
        });

    activeBypasses.set(provider, bypassPromise);
    return bypassPromise;
}

module.exports = { getClearance, getStats };
