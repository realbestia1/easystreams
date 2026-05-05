const { spawn } = require('child_process');
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
            '--timeout', String(options.timeout || 60000),
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

        const child = spawn(pythonExe, args);
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
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

            if (code !== 0) {
                console.error(`[SC][${provider}] Python script fallito con codice ${code}: ${stderr}`);
                return reject(new Error(stderr.trim() || `Python script exited with code ${code}`));
            }

            if (result && result.status === 'error') {
                return reject(new Error(result.message));
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

    const bypassPromise = runBypass(url, provider, options, sessionFile)
        .finally(() => {
            activeBypasses.delete(provider);
        });

    activeBypasses.set(provider, bypassPromise);
    return bypassPromise;
}

module.exports = { getClearance, getStats: () => ({ active: activeGlobalRequests, queued: globalQueue.length }) };
