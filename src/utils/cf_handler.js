const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getClearance } = require('../../cf_bypass');

/**
 * Esegue fetch con gestione automatica Cloudflare
 */
async function smartFetch(url, domain, options = {}) {
    const sessionFile = path.join(__dirname, '../../cf-session.json');
    
    const loadSession = () => {
        if (fs.existsSync(sessionFile)) {
            try {
                return JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
            } catch (e) { return {}; }
        }
        return {};
    };

    let session = loadSession();

    const doRequest = async (sess) => {
        const mergedHeaders = {
            'User-Agent': sess.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Cookie': sess.cookies || '',
            'Referer': domain + '/',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            ...(options.headers || {})
        };

        return axios({
            url: url,
            method: options.method || 'GET',
            data: options.body || null,
            headers: mergedHeaders,
            timeout: options.timeout || 20000
        });
    };

    try {
        const res = await doRequest(session);
        return res.data;
    } catch (err) {
        if (err.response && (err.response.status === 403 || err.response.status === 503)) {
            console.warn(`[CF-HANDLER] Blocco rilevato. Avvio bypass per ${domain}...`);
            
            const newSession = await getClearance(domain, false); 
            
            console.log(`[CF-HANDLER] Bypass riuscito. Riprovo richiesta...`);
            const retryRes = await doRequest(newSession);
            return retryRes.data;
        }
        throw err;
    }
}

module.exports = { smartFetch };
