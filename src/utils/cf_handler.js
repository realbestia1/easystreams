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

// In-memory cache for CF sessions to avoid disk I/O on every request
const sessionCache = new Map();



/**
 * Executes fetch with automatic Cloudflare handling
 */
async function smartFetch(url, domain, options = {}) {
    const getHost = (u) => {
        try { return new URL(u).hostname.replace('www.', ''); } catch (e) { return u; }
    };
    const normalizeHost = (value) => String(value || '').trim().toLowerCase().replace(/^www\./, '').replace(/^\./, '');
    const rootDomain = (host) => {
        const parts = normalizeHost(host).split('.').filter(Boolean);
        return parts.length >= 2 ? parts.slice(-2).join('.') : parts.join('.');
    };
    const domainMatchesHost = (domainValue, hostValue) => {
        const cookieDomain = normalizeHost(domainValue);
        const host = normalizeHost(hostValue);
        if (!cookieDomain || !host) return false;
        return host === cookieDomain ||
            host.endsWith(`.${cookieDomain}`) ||
            cookieDomain.endsWith(`.${host}`);
    };
    const urlHost = getHost(url);
    const domainHost = getHost(domain);
    const providerFromHost = (host) => normalizeHost(host).split('.')[0] || 'default';
    
    // Se l'URL è su un dominio diverso dal dominio base del provider, usiamo il dominio dell'URL come provider
    // Questo permette di avere sessioni e lock separati per host diversi.
    const provider = (urlHost !== domainHost) ? providerFromHost(urlHost) : (options.provider || providerFromHost(domainHost));
    
    const sessionFileForProvider = (providerName) => path.join(process.cwd(), `cf-session-${providerName}.json`);
    const sessionFile = sessionFileForProvider(provider);
    const cacheKey = `${options.method || 'GET'}:${url}:${options.body || ''}`;

    // No in-memory/disk cache: always fetch fresh
    
    const loadSession = (providerName = provider, targetHost = urlHost) => {
        const targetSessionFile = sessionFileForProvider(providerName);

        // Check memory cache first (disabled for guardoserie as requested)
        if (providerName !== 'guardoserie') {
            const cached = sessionCache.get(providerName);
            if (cached && cached.cookies && (Date.now() - cached.timestamp < 115 * 60 * 1000)) {
                console.log(`[CF-HANDLER][${providerName}] Sessione caricata da memoria.`);
                return cached;
            }
        }

        if (fs.existsSync(targetSessionFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(targetSessionFile, 'utf8'));
                if (data && data.userAgent) {
                    const ageMs = Date.now() - (data.timestamp || 0);
                    const twoHours = 2 * 60 * 60 * 1000;
                    if (ageMs > twoHours) {
                        console.log(`[CF-HANDLER][${providerName}] Sessione su file troppo vecchia (${Math.round(ageMs/60000)} min), forzo refresh.`);
                        try { fs.unlinkSync(targetSessionFile); } catch (e) {}
                        return {};
                    }
                    if (data.url) {
                        try {
                            const sessionHost = getHost(data.url);
                            const sessionRoot = rootDomain(sessionHost);
                            const currentRoot = rootDomain(targetHost);
                            const cookieDomains = Array.isArray(data.cookieDomains) ? data.cookieDomains : [];
                            const hasCookieForCurrentHost = cookieDomains.some(cookieDomain => domainMatchesHost(cookieDomain, targetHost));
                            if (sessionRoot && currentRoot && sessionRoot !== currentRoot && !hasCookieForCurrentHost) {
                                console.log(`[CF-HANDLER][${providerName}] Sessione su dominio diverso (${sessionHost}) non valida per ${targetHost}, forzo refresh.`);
                                try { fs.unlinkSync(targetSessionFile); } catch (e) {}
                                return {};
                            }
                        } catch (e) {}
                    }
                    // Update memory cache (skipped for guardoserie)
                    if (providerName !== 'guardoserie') {
                        sessionCache.set(providerName, data);
                    }
                    return data;
                }
            } catch (e) { return {}; }
        }
        return {};
    };

    let session = loadSession();
    let currentUrl = url;

    if (session.url) {
        // Hostname replacement logic removed as it caused "Invalid URL" errors
    }
    if (!session.cookies && provider === 'guardoserie') {
        console.warn(`[CF-HANDLER][${provider}] Attenzione: richiesta avviata senza cookie di sessione!`);
    }

    const doRequest = async (targetUrl, sess, reqOptions = {}) => {
        const mergedHeaders = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
            ...reqOptions.headers
        };

        // Prioritize session User-Agent to match Cloudflare clearance
        if (sess.userAgent) {
            mergedHeaders['user-agent'] = sess.userAgent;
            delete mergedHeaders['User-Agent'];
        } else if (!mergedHeaders['user-agent'] && !mergedHeaders['User-Agent']) {
            mergedHeaders['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
        }

        // Merge session cookies with provided cookies
        if (sess.cookies) {
            const existingCookies = mergedHeaders.Cookie || mergedHeaders.cookie || '';
            mergedHeaders.cookie = existingCookies 
                ? (existingCookies.endsWith(';') ? `${existingCookies} ${sess.cookies}` : `${existingCookies}; ${sess.cookies}`)
                : sess.cookies;
            delete mergedHeaders['Cookie'];
        }


        // Replicate browser fingerprint headers (sec-ch-ua, etc.)
        if (sess.requestHeaders) {
            const browserHeaders = ['sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform', 'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site'];
            for (const h of browserHeaders) {
                if (sess.requestHeaders[h]) mergedHeaders[h] = sess.requestHeaders[h];
            }
        }

        const startTime = Date.now();
        const requestTimeout = reqOptions.timeout ? reqOptions.timeout : (sess.userAgent ? 60000 : 30000);
        console.log(`[CF-HANDLER][${provider}] Timeout impostato a: ${requestTimeout}ms`);
        
        const source = axios.CancelToken.source();
        
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                source.cancel('timeout');
                const err = new Error(`timeout of ${requestTimeout}ms exceeded`);
                err.code = 'ECONNABORTED';
                reject(err);
            }, requestTimeout);
        });

        try {
            const axiosPromise = axios({
                url: targetUrl,
                method: reqOptions.method || 'GET',
                data: reqOptions.body,
                headers: mergedHeaders,
                httpsAgent,
                httpAgent,
                cancelToken: source.token,
                validateStatus: false,
                responseType: reqOptions.responseType || 'text',
                ...reqOptions.axiosConfig
            });

            const response = await Promise.race([axiosPromise, timeoutPromise]);
            clearTimeout(timeoutId);
            
            const duration = Date.now() - startTime;
            if (sess.cookies) {
                console.log(`[CF-HANDLER][${provider}] Richiesta OK in ${duration}ms.`);
            }

            const data = response.data;
            const responseUrl =
                response.request?.res?.responseUrl ||
                response.request?._redirectable?._currentUrl ||
                response.config?.url ||
                targetUrl;
                
            if (response.status >= 400 && response.status !== 403 && response.status !== 503) {
                const quietHttpErrors = reqOptions.quietHttpErrors === true ||
                    (Array.isArray(reqOptions.quietHttpErrors) && reqOptions.quietHttpErrors.includes(response.status));
                if (!quietHttpErrors) {
                    console.error(`[CF-HANDLER][${provider}] Errore HTTP ${response.status} per ${responseUrl}`);
                }
                const err = new Error(`HTTP ${response.status}`);
                err.response = { status: response.status, data, url: responseUrl };
                throw err;
            }

            return { data, status: response.status, headers: response.headers, url: responseUrl };
        } catch (e) {
            clearTimeout(timeoutId);
            if (axios.isCancel(e) || e.code === 'ECONNABORTED') {
                const timeoutErr = new Error(`timeout of ${requestTimeout}ms exceeded`);
                timeoutErr.code = 'ECONNABORTED';
                throw timeoutErr;
            }
            throw e;
        }
    };

    const updateMetaFinalUrl = (res) => {
        if (!options.meta || !res || !res.url) return;
        try {
            const finalUrl = new URL(res.url).toString();
            if (finalUrl) options.meta.finalUrl = finalUrl;
        } catch {}
    };

    const isUsefulHtml = (value) => {
        const text = typeof value === 'string' ? value.trim() : '';
        if (text.length < 200) return false;
        if (/Just a moment|cf-browser-verification|turnstile|cf-challenge/i.test(text)) return false;
        return true;
    };

    const isCfStatus = (errorOrResponse) => {
        if (errorOrResponse && (errorOrResponse.code === 'ECONNABORTED' || errorOrResponse.message?.includes('timeout'))) {
            return true; // Treat timeouts as potential CF challenges
        }
        const status = errorOrResponse && errorOrResponse.response
            ? errorOrResponse.response.status
            : errorOrResponse && errorOrResponse.status;
        return status === 403 || status === 503;
    };

    const isCfChallenge = (html) => {
        if (typeof html !== 'string') return false;
        return /Just a moment|cf-browser-verification|turnstile|cf-challenge|Checking your browser/i.test(html);
    };

    const retryWithRedirectedSession = async (challengeUrl) => {
        let challengeHost = '';
        try {
            challengeHost = getHost(challengeUrl);
        } catch {}
        if (!challengeHost || challengeHost === urlHost) return null;

        const challengeProvider = providerFromHost(challengeHost);
        if (!challengeProvider || challengeProvider === provider) return null;

        const redirectedSession = loadSession(challengeProvider, challengeHost);
        if (!redirectedSession || !redirectedSession.cookies) return null;

        console.log(`[CF-HANDLER][${provider}] Redirect su ${challengeHost}: provo sessione esistente [${challengeProvider}] prima di FlareSolverr.`);
        try {
            const redirectedRes = await doRequest(challengeUrl, redirectedSession, options);
            updateMetaFinalUrl(redirectedRes);
            if (redirectedRes.status === 403 || redirectedRes.status === 503) {
                try { fs.unlinkSync(sessionFileForProvider(challengeProvider)); } catch (e) {}
                return null;
            }
            console.log(`[CF-HANDLER][${challengeProvider}] Redirect completato usando sessione esistente.`);
            return redirectedRes.data;
        } catch (retryErr) {
            if (isCfStatus(retryErr)) {
                try { fs.unlinkSync(sessionFileForProvider(challengeProvider)); } catch (e) {}
                return null;
            }
            throw retryErr;
        }
    };

    try {
        const res = await doRequest(currentUrl, session, options);
        updateMetaFinalUrl(res);
        if (res.status === 403 || res.status === 503 || (res.status === 200 && isCfChallenge(res.data))) {
            throw { response: res };
        }
        if (session.cookies) {
            // Update cache if session was updated during request (rare but possible)
            if (res.headers['set-cookie']) {
                 // Note: we don't update file here to avoid blocking
            }
        }
        return res.data;
    } catch (err) {
        if (isCfStatus(err)) {
            if (options.skipBypassOnFailure) {
                throw err;
            }
            const errorMsg = err.code === 'ECONNABORTED' || err.message?.includes('timeout') ? 'Timeout richiesta' : (err.response?.status || err.message);
            console.log(`[CF-HANDLER][${provider}] Fallimento sessione (${errorMsg}), avvio bypass Scrapling...`);

            const challengeUrl = err.response && err.response.url ? err.response.url : url;
            const redirectedData = await retryWithRedirectedSession(challengeUrl);
            if (redirectedData !== null) {
                return redirectedData;
            }

            let bypassUrl = url;
            let bypassProvider = provider;
            try {
                const challengeHost = getHost(challengeUrl);
                if (challengeHost && challengeHost !== urlHost) {
                    bypassUrl = challengeUrl;
                    bypassProvider = providerFromHost(challengeHost);
                }
            } catch {}
            const bypassSessionFile = sessionFileForProvider(bypassProvider);

            // Usiamo direttamente getClearance che ha già il suo sistema di lock interno
            if (fs.existsSync(bypassSessionFile)) {
                try { fs.unlinkSync(bypassSessionFile); } catch (e) {}
            }

            const newSession = await getClearance(bypassUrl, bypassProvider, options);
            if (!newSession) {
                throw new Error(`Bypass fallito per ${bypassProvider}`);
            }

            if (options.meta && newSession.url) {
                options.meta.finalUrl = newSession.url;
            }
            
            // Se FlareSolverr ha già restituito il contenuto della pagina, usiamolo
            if (isUsefulHtml(newSession.response)) {
                return newSession.response;
            }

            // Altrimenti procediamo con una nuova richiesta usando i cookie (se presenti)
            let finalUrl = bypassUrl === url ? currentUrl : bypassUrl;
            if (newSession.url) {
                try {
                    const oldUrlObj = new URL(bypassUrl);
                    const newUrlObj = new URL(newSession.url);
                    const newSessionHasSpecificTarget = newUrlObj.pathname !== '/' ||
                        Boolean(newUrlObj.search) ||
                        Boolean(newUrlObj.hash) ||
                        oldUrlObj.hostname === newUrlObj.hostname;
                    if (newSessionHasSpecificTarget) {
                        finalUrl = newUrlObj.toString();
                        if (options.meta) options.meta.finalUrl = finalUrl;
                    } else if (oldUrlObj.hostname !== newUrlObj.hostname) {
                        oldUrlObj.hostname = newUrlObj.hostname;
                        oldUrlObj.protocol = newUrlObj.protocol;
                        finalUrl = oldUrlObj.toString();
                        if (options.meta) options.meta.finalUrl = finalUrl;
                    }
                } catch (e) {}
            }

            const res = await doRequest(finalUrl, newSession);
            updateMetaFinalUrl(res);
            return res.data;
        }
        throw err;
    }
}

module.exports = { smartFetch };
