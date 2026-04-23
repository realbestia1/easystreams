const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Risolve la sfida Cloudflare usando esclusivamente FlareSolverr
 * @param {string} url - URL target della sfida
 */
const activeBypasses = new Map();
 
async function getClearance(url, provider = 'default', options = {}) {
    const sessionFile = path.join(process.cwd(), `cf-session-${provider}.json`);
    
    if (activeBypasses.has(provider)) {
        console.log(`[CF] FlareSolverr bypass già in corso per il provider [${provider}], attendo...`);
        return activeBypasses.get(provider);
    }
 
    const bypassPromise = (async () => {
        const FLARE_URL = process.env.FLARE_URL || 'http://127.0.0.1:8191/v1';
        
        console.log(`[CF] Richiesta bypass a FlareSolverr: ${url}`);
        
        const payload = {
            cmd: options.method === 'POST' ? 'request.post' : 'request.get',
            url: url,
            maxTimeout: 60000
        };

        if (options.method === 'POST' && options.body) {
            payload.postData = options.body;
        }

        try {
            const response = await axios.post(FLARE_URL, payload, { 
                timeout: 70000,
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.data && response.data.status === 'ok') {
                const solution = response.data.solution;
                const cookies = solution.cookies.map(c => `${c.name}=${c.value}`).join('; ');
                const cf_clearance = solution.cookies.find(c => c.name === 'cf_clearance')?.value;

                const data = {
                    userAgent: solution.userAgent,
                    cookies: cookies,
                    cf_clearance: cf_clearance || null,
                    url: solution.url,
                    response: solution.response,
                    timestamp: Date.now()
                };

                fs.writeFileSync(sessionFile, JSON.stringify(data, null, 2));
                console.log(`[CF] FlareSolverr: Bypass completato con successo per ${url}`);
                if (solution.url && solution.url !== url) {
                    console.log(`[CF] Rilevato redirect: ${url} -> ${solution.url}`);
                }
                return data;
            } else {
                const errorMsg = response.data ? response.data.message : 'Risposta non valida da FlareSolverr';
                throw new Error(errorMsg);
            }
        } catch (error) {
            console.error(`[CF] Errore FlareSolverr: ${error.message}`);
            if (error.code === 'ECONNREFUSED') {
                console.error(`[CF] ASSICURATI CHE FLARESOLVERR SIA ATTIVO SU ${FLARE_URL}`);
            }
            throw error;
        } finally {
            activeBypasses.delete(provider);
        }
    })();

    activeBypasses.set(provider, bypassPromise);
    return bypassPromise;
}

module.exports = { getClearance };
