const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Cloudflare Bypass using Scrapling (Python)
 * Replaces FlareSolverr with a more robust local browser-based solution.
 */

const activeBypasses = new Map();
const globalQueue = [];
let activeGlobalRequests = 0;

const MAX_GLOBAL_CONCURRENT = parseInt(process.env.SCRAPLING_MAX_CONCURRENT || '2', 10);
const MAX_GLOBAL_QUEUE = parseInt(process.env.SCRAPLING_MAX_QUEUE || '20', 10);
const GLOBAL_QUEUE_TIMEOUT = parseInt(process.env.SCRAPLING_QUEUE_TIMEOUT_MS || '60000', 10);
const SCRAPLING_DEFAULT_TIMEOUT = parseInt(process.env.SCRAPLING_DEFAULT_TIMEOUT_MS || '90000', 10);
const SCRAPLING_WATCHDOG_GRACE_MS = parseInt(process.env.SCRAPLING_WATCHDOG_GRACE_MS || '15000', 10);

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
        console.log(`[SC] Slot Scrapling assegnato a [${entry.provider}]. Active=${activeGlobalRequests}, Queue=${globalQueue.length}`);
        entry.resolve(createRelease());
    }
}

function acquireGlobalSlot(provider, url) {
    if (activeGlobalRequests < MAX_GLOBAL_CONCURRENT) {
        activeGlobalRequests++;
        return Promise.resolve(createRelease());
    }

    if (globalQueue.length >= MAX_GLOBAL_QUEUE) {
        return Promise.reject(new Error(`Coda Scrapling piena (${globalQueue.length}/${MAX_GLOBAL_QUEUE}) per ${provider}`));
    }

    return new Promise((resolve, reject) => {
        const entry = {
            provider,
            url,
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
            reject(new Error(`Timeout coda Scrapling dopo ${GLOBAL_QUEUE_TIMEOUT}ms per ${provider}`));
        }, GLOBAL_QUEUE_TIMEOUT);

        globalQueue.push(entry);
        console.log(`[SC] In coda Scrapling [${provider}] Queue=${globalQueue.length}/${MAX_GLOBAL_CONCURRENT}: ${url}`);
    });
}

function execPythonBypass(url, provider, options = {}) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, 'src', 'utils', 'scrapling_bypass.py');
        const args = [
            scriptPath, 
            url,
            '--timeout', String(options.timeout || SCRAPLING_DEFAULT_TIMEOUT),
            '--wait-until', options.waitUntil || 'domcontentloaded'
        ];

        if (options.method) {
            args.push('--method', options.method);
        }
        if (options.body) {
            args.push('--data', options.body);
        }
        if (options.headers) {
            args.push('--headers', JSON.stringify(options.headers));
        }

        console.log(`[SC][${provider}] Avvio bypass Scrapling per: ${url}`);
        
        // Find python executable (prefer .venv if exists, fallback to python3 or python)
        const venvPython = path.join(process.cwd(), '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
        let pythonExe = 'python3'; // Default for Linux/Docker
        if (fs.existsSync(venvPython)) {
            pythonExe = venvPython;
        } else if (process.platform === 'win32') {
            pythonExe = 'python';
        }

        const spawnOptions = {};
        if (process.platform !== 'win32') {
            spawnOptions.detached = true;
        }
        const child = spawn(pythonExe, args, spawnOptions);
        let stdout = '';
        let stderr = '';

        const executionTimeout = (parseInt(options.timeout, 10) || SCRAPLING_DEFAULT_TIMEOUT) + SCRAPLING_WATCHDOG_GRACE_MS;
        let watchdog = setTimeout(() => {
            console.error(`[SC][${provider}] Watchdog timeout raggiunto (${executionTimeout}ms). Uccido l'albero dei processi.`);
            watchdog = null;
            if (process.platform === 'win32') {
                exec(`taskkill /pid ${child.pid} /T /F`, (err) => {
                    if (err) {
                        console.error(`[SC][${provider}] taskkill fallito: ${err.message}`);
                        try { child.kill('SIGKILL'); } catch (e) {}
                    }
                });
            } else {
                try {
                    process.kill(-child.pid, 'SIGKILL');
                } catch (e) {
                    try { child.kill('SIGKILL'); } catch (err) {}
                }
            }
        }, executionTimeout);


        child.on('error', (err) => {
            if (watchdog) {
                clearTimeout(watchdog);
                watchdog = null;
            }
            reject(new Error(`Impossibile avviare Python (${pythonExe}): ${err.message}`));
        });

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            if (watchdog) {
                clearTimeout(watchdog);
                watchdog = null;
            }
            // Check if we have valid JSON in stdout despite the exit code or stderr
            // This handles cases where libraries print warnings to stderr and exit with non-zero codes
            let result;
            try {
                if (stdout.trim()) {
                    result = JSON.parse(stdout);
                }
            } catch (e) {
                // Not valid JSON
            }

            if (result && result.status === 'ok') {
                return resolve(result);
            }

            if (result && result.status === 'error') {
                return reject(new Error(result.message || "Unknown Scrapling error"));
            }

            if (code !== 0) {
                console.error(`[SC][${provider}] Python script fallito con codice ${code}: ${stderr}`);
                return reject(new Error(stderr.trim() || `Python script exited with code ${code}`));
            }
            
            if (!result) {
                console.error(`[SC][${provider}] Errore parsing output Python (Vuoto o non valido): ${stdout}`);
                reject(new Error(`Failed to parse Scrapling output: Empty or invalid JSON`));
            }
        });
    });
}

async function runBypass(url, provider, options, sessionFile) {
    const releaseSlot = await acquireGlobalSlot(provider, url);

    try {
        const result = await execPythonBypass(url, provider, options);
        
        // Convert Scrapling cookies to FlareSolverr-like string and domains
        const cookiesList = Array.isArray(result.cookies) ? result.cookies : [];
        const cookiesStr = cookiesList
            .filter(c => c && c.name && c.value)
            .map(c => `${c.name}=${c.value}`)
            .join('; ');
        const cookieDomains = [...new Set(cookiesList.map(c => c.domain).filter(Boolean))];

        const data = {
            userAgent: result.userAgent,
            cookies: cookiesStr,
            url: result.url,
            response: result.html,
            cookieDomains: cookieDomains,
            requestHeaders: result.requestHeaders,
            timestamp: Date.now()
        };

        // Save session
        try {
            fs.writeFileSync(sessionFile, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error(`[SC] Errore salvataggio sessione: ${e.message}`);
        }

        console.log(`[SC][${provider}] Bypass completato con successo.`);
        return data;
    } finally {
        releaseSlot();
    }
}

async function getClearance(url, provider = 'default', options = {}) {
    const sessionFile = path.join(process.cwd(), `cf-session-${provider}.json`);

    if (activeBypasses.has(provider)) {
        return activeBypasses.get(provider);
    }

    // Load existing session cookies to pass to scrapling (so it avoids re-solving CF)
    let existingCookies = '';
    if (fs.existsSync(sessionFile)) {
        try {
            const data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
            if (data && data.cookies) existingCookies = data.cookies;
        } catch (e) {}
    }
    if (existingCookies) {
        const existingHeaders = options.headers || {};
        existingHeaders.Cookie = existingCookies;
        options.headers = existingHeaders;
    }

    const bypassPromise = runBypass(url, provider, options, sessionFile)
        .finally(() => {
            activeBypasses.delete(provider);
        });

    activeBypasses.set(provider, bypassPromise);
    return bypassPromise;
}

function hasActiveBypass(provider) {
    return activeBypasses.has(provider);
}

module.exports = { getClearance, hasActiveBypass, execPythonBypass, getStats: () => ({ active: activeGlobalRequests, queued: globalQueue.length }) };
