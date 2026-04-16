const fs = require('fs');
const axios = require('axios');

/**
 * Risolve la sfida Cloudflare usando esclusivamente FlareSolverr
 * @param {string} url - URL target della sfida
 */
let activeClearancePromise = null;

async function getClearance(url) {
    if (activeClearancePromise) {
        console.log(`[CF] FlareSolverr bypass già in corso per ${url}, attendo...`);
        return activeClearancePromise;
    }

    activeClearancePromise = (async () => {
        const flaresolverrUrl = process.env.FLARESOLVERR_URL || 'http://127.0.0.1:8191/v1';
        
        console.log(`[CF] Richiesta bypass a FlareSolverr: ${url}`);
        
        try {
            const response = await axios.post(flaresolverrUrl, {
                cmd: 'request.get',
                url: url,
                maxTimeout: 60000
            }, { 
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
                    timestamp: Date.now()
                };

                fs.writeFileSync('cf-session.json', JSON.stringify(data, null, 2));
                console.log(`[CF] FlareSolverr: Bypass completato con successo per ${url}`);
                return data;
            } else {
                const errorMsg = response.data ? response.data.message : 'Risposta non valida da FlareSolverr';
                throw new Error(errorMsg);
            }
        } catch (error) {
            console.error(`[CF] Errore FlareSolverr: ${error.message}`);
            if (error.code === 'ECONNREFUSED') {
                console.error(`[CF] ASSICURATI CHE FLARESOLVERR SIA ATTIVO SU ${flaresolverrUrl}`);
            }
            throw error;
        } finally {
            activeClearancePromise = null;
        }
    })();

    return activeClearancePromise;
}

module.exports = { getClearance };
