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

// Cache for requests
const requestCache = new Map();
const CACHE_TTL = 600000; // 10 minutes



/**
 * Executes fetch with automatic Cloudflare handling
 */
async function smartFetch(url, domain, options = {}) {
    const provider = options.provider || domain.replace(/https?:\/\//, '').split('.')[0];
    const sessionFile = path.join(process.cwd(), `cf-session-${provider}.json`);
    const cacheKey = `${options.method || 'GET'}:${url}:${options.body || ''}`;

    // Cache check
    if (requestCache.has(cacheKey)) {
        const cached = requestCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
        }
    }
    
    const loadSession = () => {
        if (fs.existsSync(sessionFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
                if (data && data.userAgent) {
                    console.log(`[CF-HANDLER][${provider}] Sessione caricata da file.`);
                    return data;
                }
            } catch (e) { return {}; }
        }
        return {};
    };

    let session = loadSession();

    const doRequest = async (sess) => {
        const mergedHeaders = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
            ...options.headers
        };

        // Prioritize session User-Agent to match Cloudflare clearance
        if (sess.userAgent) {
            mergedHeaders['User-Agent'] = sess.userAgent;
        } else if (!mergedHeaders['User-Agent']) {
            mergedHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
        }

        // Merge session cookies with provided cookies
        if (sess.cookies) {
            const existingCookies = mergedHeaders.Cookie || mergedHeaders.cookie || '';
            mergedHeaders.Cookie = existingCookies 
                ? (existingCookies.endsWith(';') ? `${existingCookies} ${sess.cookies}` : `${existingCookies}; ${sess.cookies}`)
                : sess.cookies;
        }


        const response = await axios({
            url,
            method: options.method || 'GET',
            data: options.body,
            headers: mergedHeaders,
            httpsAgent,
            httpAgent,
            timeout: options.timeout || 20000,
            validateStatus: false
        });

        const data = response.data;
        if (response.status >= 400 && response.status !== 403 && response.status !== 503) {
            const err = new Error(`HTTP ${response.status}`);
            err.response = { status: response.status, data };
            throw err;
        }

        return { data, status: response.status };
    };

    try {
        const res = await doRequest(session);
        if (res.status === 403 || res.status === 503) {
            throw { response: res };
        }
        requestCache.set(cacheKey, { data: res.data, timestamp: Date.now() });
        return res.data;
    } catch (err) {
        if (err.response && (err.response.status === 403 || err.response.status === 503)) {
            console.warn(`[CF-HANDLER][${provider}] Blocco rilevato. Avvio bypass per ${url}...`);
            
            const newSession = await getClearance(url, provider, options);
            const res = await doRequest(newSession);
            requestCache.set(cacheKey, { data: res.data, timestamp: Date.now() });
            return res.data;
        }
        throw err;
    }
}

module.exports = { smartFetch };
