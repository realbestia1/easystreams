const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Risolve la sfida Cloudflare usando FlareSolverr.
 *
 * Le richieste sono limitate da:
 * - lock per provider, per evitare bypass duplicati sullo stesso dominio;
 * - coda globale FIFO, per evitare di saturare CPU/RAM con troppi browser;
 * - timeout di coda, cosi le richieste non restano appese indefinitamente.
 */
const activeBypasses = new Map();
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
const FLARE_RETRIES = readPositiveIntEnv('FLARE_RETRIES', 1);

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
        queueTimeoutMs: GLOBAL_QUEUE_TIMEOUT
    };
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
    try {
        const response = await axios.post(flareUrl, { cmd: 'sessions.list' }, {
            timeout: FLARE_HEALTH_TIMEOUT,
            headers: { 'Content-Type': 'application/json' }
        });
        if (response.data && response.data.status === 'ok') return;
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
                const cookiesList = Array.isArray(solution.cookies) ? solution.cookies : [];
                const cookies = cookiesList.map(c => `${c.name}=${c.value}`).join('; ');
                const cfClearance = cookiesList.find(c => c.name === 'cf_clearance')?.value;

                console.log(`[CF] FlareSolverr ha restituito ${cookiesList.length} cookie.`);

                if (!cookies && !solution.response) {
                    throw new Error('FlareSolverr ha restituito successo ma zero cookie e nessuna risposta.');
                }

                const data = {
                    userAgent: solution.userAgent,
                    cookies: cookies || '',
                    cf_clearance: cfClearance || null,
                    url: solution.url,
                    response: solution.response,
                    timestamp: Date.now()
                };

                saveSessionFile(sessionFile, data);

                if (cookiesList.length > 0) {
                    const domains = [...new Set(cookiesList.map(c => String(c.domain || '').replace(/^\./, '')).filter(Boolean))];
                    for (const domain of domains) {
                        const domainProvider = domain.replace('www.', '').split('.')[0];
                        if (!domainProvider || domainProvider === provider) continue;

                        const domainSessionFile = path.join(process.cwd(), `cf-session-${domainProvider}.json`);
                        const domainCookies = cookiesList
                            .filter(c => String(c.domain || '').includes(domain))
                            .map(c => `${c.name}=${c.value}`)
                            .join('; ');

                        if (!domainCookies) continue;

                        const domainData = {
                            userAgent: solution.userAgent,
                            cookies: domainCookies,
                            cf_clearance: cookiesList.find(c => String(c.domain || '').includes(domain) && c.name === 'cf_clearance')?.value || null,
                            url: solution.url,
                            timestamp: Date.now()
                        };
                        saveSessionFile(domainSessionFile, domainData);
                        console.log(`[CF] Salvata sessione extra per dominio: ${domain} -> ${domainProvider}`);
                    }
                }

                console.log(`[CF] FlareSolverr: Bypass completato con successo per ${url}`);
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
        releaseSlot();
    }
}

async function getClearance(url, provider = 'default', options = {}) {
    const sessionFile = path.join(process.cwd(), `cf-session-${provider}.json`);

    if (activeBypasses.has(provider)) {
        console.log(`[CF] FlareSolverr bypass gia in corso per il provider [${provider}], attendo...`);
        return activeBypasses.get(provider);
    }

    const bypassPromise = runBypass(url, provider, options, sessionFile)
        .finally(() => {
            activeBypasses.delete(provider);
        });

    activeBypasses.set(provider, bypassPromise);
    return bypassPromise;
}

module.exports = { getClearance, getStats };
