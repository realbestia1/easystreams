const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Risolve la sfida Cloudflare usando esclusivamente FlareSolverr
 * @param {string} url - URL target della sfida
 */
const activeBypasses = new Map();
const globalQueue = [];
const MAX_GLOBAL_CONCURRENT = 4; // Aumentato per ridurre le attese in coda
let activeGlobalRequests = 0;

async function getClearance(url, provider = 'default', options = {}) {
    const sessionFile = path.join(process.cwd(), `cf-session-${provider}.json`);
    
    // 1. Lock per provider: evita doppie richieste per lo stesso sito
    if (activeBypasses.has(provider)) {
        console.log(`[CF] FlareSolverr bypass già in corso per il provider [${provider}], attendo...`);
        return activeBypasses.get(provider);
    }
 
    const bypassPromise = (async () => {
        // 2. Lock globale (Semaphore): evita di saturare la CPU con troppi browser aperti
        while (activeGlobalRequests >= MAX_GLOBAL_CONCURRENT) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        activeGlobalRequests++;
        try {
            const FLARE_URL = process.env.FLARE_URL || 'http://127.0.0.1:8191/v1';
            
            console.log(`[CF] Richiesta bypass a FlareSolverr [Session: ${provider}][Active: ${activeGlobalRequests}]: ${url}`);
            
            // FlareSolverr gestisce già internamente la creazione se non esiste o l'uso se esiste
            // ma per sicurezza proviamo a crearla velocemente ignorando l'errore se esiste già
            try {
                await axios.post(FLARE_URL, { cmd: 'sessions.create', session: provider }, { timeout: 5000 }).catch(() => {});
            } catch (e) {}

            const payload = {
                cmd: options.method === 'POST' ? 'request.post' : 'request.get',
                url: url,
                session: provider,
                maxTimeout: 35000 // Ridotto per rientrare nei 40s del provider
            };

            if (options.method === 'POST' && options.body) {
                payload.postData = options.body;
            }

            try {
                const response = await axios.post(FLARE_URL, payload, { 
                    timeout: 40000, // Leggermente più alto di maxTimeout (35s)
                    headers: { 'Content-Type': 'application/json' }
                });

                if (response.data && response.data.status === 'ok') {
                    const solution = response.data.solution;
                    
                    const cookiesCount = (solution.cookies || []).length;
                    const cookies = (solution.cookies || []).map(c => `${c.name}=${c.value}`).join('; ');
                    const cf_clearance = (solution.cookies || []).find(c => c.name === 'cf_clearance')?.value;

                    console.log(`[CF] FlareSolverr ha restituito ${cookiesCount} cookie.`);

                    if (!cookies && !solution.response) {
                        throw new Error('FlareSolverr ha restituito successo ma zero cookie e nessuna risposta.');
                    }

                    const data = {
                        userAgent: solution.userAgent,
                        cookies: cookies || '',
                        cf_clearance: cf_clearance || null,
                        url: solution.url,
                        response: solution.response,
                        timestamp: Date.now()
                    };

                    // Salvataggio per il provider principale
                    fs.writeFileSync(sessionFile, JSON.stringify(data, null, 2));

                    // Ottimizzazione: salvataggio cookie per domini multipli incontrati
                    if (solution.cookies && solution.cookies.length > 0) {
                        const domains = [...new Set(solution.cookies.map(c => c.domain.replace(/^\./, '')))];
                        for (const d of domains) {
                            const domainProvider = d.replace('www.', '').split('.')[0];
                            if (domainProvider && domainProvider !== provider) {
                                const domainSessionFile = path.join(process.cwd(), `cf-session-${domainProvider}.json`);
                                const domainCookies = solution.cookies
                                    .filter(c => c.domain.includes(d))
                                    .map(c => `${c.name}=${c.value}`)
                                    .join('; ');
                                
                                if (domainCookies) {
                                    const domainData = {
                                        userAgent: solution.userAgent,
                                        cookies: domainCookies,
                                        cf_clearance: solution.cookies.find(c => c.domain.includes(d) && c.name === 'cf_clearance')?.value || null,
                                        url: solution.url,
                                        timestamp: Date.now()
                                    };
                                    fs.writeFileSync(domainSessionFile, JSON.stringify(domainData, null, 2));
                                    console.log(`[CF] Salvata sessione extra per dominio: ${d} -> ${domainProvider}`);
                                }
                            }
                        }
                    }

                    console.log(`[CF] FlareSolverr: Bypass completato con successo per ${url}`);
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
            }
        } finally {
            activeGlobalRequests--;
            activeBypasses.delete(provider);
        }
    })();

    activeBypasses.set(provider, bypassPromise);
    return bypassPromise;
}

module.exports = { getClearance };
