const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getClearance } = require('../../cf_bypass');
const https = require('https');
const http = require('http');

// Connection pooling configuration
const agentOptions = {
    keepAlive: true,
    maxSockets: 250,
    maxFreeSockets: 100,
    timeout: 30000,
    keepAliveMsecs: 30000
};

const httpsAgent = new https.Agent(agentOptions);
const httpAgent = new http.Agent(agentOptions);

// Cache completely disabled: no in-memory cache for bypass



/**
 * Executes fetch with automatic Cloudflare handling
 */
async function smartFetch(url, domain, options = {}) {
    const getHost = (u) => {
        try { return new URL(u).hostname.replace('www.', ''); } catch (e) { return u; }
    };
    const urlHost = getHost(url);
    const domainHost = getHost(domain);
    
    // Se l'URL è su un dominio diverso dal dominio base del provider, usiamo il dominio dell'URL come provider
    // Questo permette di avere sessioni e lock separati per i vari host (es. clicka.cc, uprot.net)
    const provider = (urlHost !== domainHost) ? urlHost.split('.')[0] : (options.provider || domainHost.split('.')[0]);
    
    const sessionFile = path.join(process.cwd(), `cf-session-${provider}.json`);
    const cacheKey = `${options.method || 'GET'}:${url}:${options.body || ''}`;

    // No in-memory/disk cache: always fetch fresh
    
    const loadSession = () => {
        if (fs.existsSync(sessionFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
                if (data && data.userAgent) {
                    const ageMs = Date.now() - (data.timestamp || 0);
                    const twoHours = 2 * 60 * 60 * 1000;
                    if (ageMs > twoHours) {
                        console.log(`[CF-HANDLER][${provider}] Sessione su file troppo vecchia (${Math.round(ageMs/60000)} min), forzo refresh.`);
                        try { fs.unlinkSync(sessionFile); } catch (e) {}
                        return {};
                    }
                    console.log(`[CF-HANDLER][${provider}] Sessione caricata da file (${Math.round(ageMs/60000)} min fa).`);
                    return data;
                }
            } catch (e) { return {}; }
        }
        return {};
    };

    let session = loadSession();
    let currentUrl = url;

    if (session.url) {
        try {
            const currentUrlObj = new URL(currentUrl);
            const sessionUrl = new URL(session.url);
            const currentHost = currentUrlObj.hostname.toLowerCase();
            const sessionHost = sessionUrl.hostname.toLowerCase();

            if (sessionHost !== currentHost) {
                const sessionParts = sessionHost.split('.');
                const currentParts = currentHost.split('.');
                const sessionRoot = sessionParts.slice(-2).join('.');
                const currentRoot = currentParts.slice(-2).join('.');
                
                if (sessionRoot === currentRoot || currentHost.includes(sessionParts[sessionParts.length - 2])) {
                    console.log(`[CF-HANDLER][${provider}] Cambio dominio: ${currentHost} -> ${sessionHost}`);
                    currentUrl = currentUrl.replace(currentUrlObj.hostname, sessionUrl.hostname);
                }
            }
        } catch (e) {}
    }

    const doRequest = async (sess, targetUrl = currentUrl) => {
        const mergedHeaders = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
            ...options.headers
        };

        // Prioritize session User-Agent to match Cloudflare clearance
        if (sess.userAgent) {
            mergedHeaders['User-Agent'] = sess.userAgent;
        } else if (!mergedHeaders['User-Agent']) {
            mergedHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
        }

        // Merge session cookies with provided cookies
        if (sess.cookies) {
            const existingCookies = mergedHeaders.Cookie || mergedHeaders.cookie || '';
            mergedHeaders.Cookie = existingCookies 
                ? (existingCookies.endsWith(';') ? `${existingCookies} ${sess.cookies}` : `${existingCookies}; ${sess.cookies}`)
                : sess.cookies;
        }


        const response = await axios({
            url: targetUrl,
            method: options.method || 'GET',
            data: options.body,
            headers: mergedHeaders,
            httpsAgent,
            httpAgent,
            timeout: options.timeout || 20000,
            validateStatus: false,
            responseType: options.responseType || 'text',
            ...options.axiosConfig
        });

        const data = response.data;
        if (response.status >= 400 && response.status !== 403 && response.status !== 503) {
            console.error(`[CF-HANDLER][${provider}] Errore HTTP ${response.status} per ${targetUrl}`);
            const err = new Error(`HTTP ${response.status}`);
            err.response = { status: response.status, data };
            throw err;
        }

        return { data, status: response.status, headers: response.headers };
    };

    try {
        const res = await doRequest(session);
        if (res.status === 403 || res.status === 503) {
            throw { response: res };
        }
        if (session.cookies) {
            console.log(`[CF-HANDLER][${provider}] Richiesta completata usando sessione esistente.`);
        }
          // caching disabled
        return res.data;
    } catch (err) {
        if (err.response && (err.response.status === 403 || err.response.status === 503)) {
            // Usiamo direttamente getClearance che ha già il suo sistema di lock interno
            if (fs.existsSync(sessionFile)) {
                try { fs.unlinkSync(sessionFile); } catch (e) {}
            }

            const newSession = await getClearance(url, provider, options);
            if (!newSession) {
                throw new Error(`Bypass fallito per ${provider}`);
            }
            
            // Se FlareSolverr ha già restituito il contenuto della pagina, usiamolo
            if (newSession.response) {
                return newSession.response;
            }

            // Altrimenti procediamo con una nuova richiesta usando i cookie (se presenti)
            let finalUrl = currentUrl;
            if (newSession.url) {
                try {
                    const oldUrlObj = new URL(url);
                    const newUrlObj = new URL(newSession.url);
                    if (oldUrlObj.hostname !== newUrlObj.hostname) {
                        oldUrlObj.hostname = newUrlObj.hostname;
                        oldUrlObj.protocol = newUrlObj.protocol;
                        finalUrl = oldUrlObj.toString();
                    }
                } catch (e) {}
            }

            const res = await doRequest(newSession, finalUrl);
            return res.data;
        }
        throw err;
    }
}

module.exports = { smartFetch };
