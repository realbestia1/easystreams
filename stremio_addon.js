
// Polyfill fetch and related Web APIs for Node.js environments (Must be at the top)
if (typeof global.Blob === 'undefined') {
    global.Blob = require('node:buffer').Blob;
}
if (typeof global.File === 'undefined') {
    try {
        const { File } = require('node:buffer');
        if (File) global.File = File;
    } catch (e) {
        global.File = class File extends global.Blob {
            constructor(parts, filename, options = {}) {
                super(parts, options);
                this.name = filename;
                this.lastModified = options.lastModified || Date.now();
            }
        };
    }
}
if (!global.fetch) {
    const fetch = require('node-fetch');
    global.fetch = fetch;
    global.Headers = fetch.Headers;
    global.Request = fetch.Request;
    global.Response = fetch.Response;
}

const https = require('https');
const http = require('http');

// Connection pooling configuration
const agentOptions = {
    keepAlive: true,
    maxSockets: 50,
    timeout: 30000,
    keepAliveMsecs: 30000
};

const httpsAgent = new https.Agent(agentOptions);
const httpAgent = new http.Agent(agentOptions);

const { addonBuilder, serveHTTP, getRouter } = require('stremio-addon-sdk');
const express = require('express');
const app = express();
const path = require('path');

// Performance Metrics
const metrics = {
    requests: 0,
    totalResponseTime: 0,
    errors: 0
};

// Monitoring Middleware
app.use((req, res, next) => {
    const start = Date.now();
    metrics.requests++;

    res.on('finish', () => {
        const duration = Date.now() - start;
        metrics.totalResponseTime += duration;

        if (res.statusCode >= 400) metrics.errors++;

        // Log every 50 requests
        if (metrics.requests % 50 === 0) {
            const avgTime = metrics.totalResponseTime / metrics.requests;
            const errorRate = (metrics.errors / metrics.requests) * 100;
            console.log(`[Metrics] Req: ${metrics.requests} | Avg: ${avgTime.toFixed(0)}ms | Errors: ${errorRate.toFixed(1)}%`);
        }
    });
    next();
});

// Global timeout configuration
const FETCH_TIMEOUT = 5000; // 5 seconds for HTTP requests
const PROVIDER_TIMEOUT = 15000; // 5 seconds for provider execution

// Wrap global fetch to enforce timeout
const originalFetch = global.fetch;
global.fetch = async function (url, options = {}) {
    // If a signal is already provided, respect it
    if (options.signal) {
        return originalFetch(url, options);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort();
    }, options.timeout || FETCH_TIMEOUT);

    try {
        const agent = url.startsWith('https') ? httpsAgent : httpAgent;
        const response = await originalFetch(url, {
            ...options,
            agent,
            signal: controller.signal
        });
        return response;
    } catch (error) {
        if (error.name === 'AbortError') {
            // Re-throw as a timeout error for clarity if aborted by our timeout
            throw new Error(`Request to ${url} timed out after ${options.timeout || FETCH_TIMEOUT}ms`);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
};


// Import unified provider bundle
const { getStreams } = require('./providers/index.js');

const builder = new addonBuilder({
    id: 'org.bestia.easystreams',
    version: '1.0.56',
    name: 'Easy Streams',
    description: 'Italian Streams providers',
    catalogs: [],
    resources: ['stream'],
    types: ['movie', 'series', 'anime'],
    idPrefixes: ['tt', 'tmdb', 'kitsu']
});

builder.defineStreamHandler(async ({ type, id }) => {
    console.log(`[Stremio] Request: ${type} ${id}`);

    let imdbId = id;
    let season = 1;
    let episode = 1;

    // Helper to parse ID
    if ((type === 'series' || type === 'anime') && id.includes(':')) {
        // Handle "kitsu:123:1:1" or "tmdb:123:1:1"
        if (id.startsWith('kitsu:') || id.startsWith('tmdb:')) {
            const parts = id.split(':');
            // parts[0] = kitsu, parts[1] = 123, parts[2] = 1, parts[3] = 1
            if (parts.length >= 4) {
                imdbId = `${parts[0]}:${parts[1]}`;
                season = parseInt(parts[2]);
                episode = parseInt(parts[3]);
            } else if (parts.length === 3) {
                // Handle absolute numbering (e.g. "kitsu:12:247")
                // We assume Season 1 and Absolute Episode
                imdbId = `${parts[0]}:${parts[1]}`;
                season = 1;
                episode = parseInt(parts[2]);
            }
        } else {
            // Standard "tt123:1:1"
            const parts = id.split(':');
            imdbId = parts[0];
            season = parseInt(parts[1]);
            episode = parseInt(parts[2]);
        }
    } else if (type === 'movie') {
        // Movies don't have season/episode usually, but just ID.
        // If it's Kitsu/TMDB, it might just be "kitsu:123" or "tmdb:123"
        imdbId = id;
    }

    console.log(`[Stremio] Parsed: ID=${imdbId}, Season=${season}, Episode=${episode}`);

    // Map Stremio type to provider type
    // Stremio: movie, series, anime
    // Providers: movie, tv
    const providerType = (type === 'movie') ? 'movie' : 'tv';

    try {
        console.log(`[MultiProvider] Searching...`);

        let timeoutId;
        const timeoutPromise = new Promise((resolve) => {
            timeoutId = setTimeout(() => {
                console.warn(`[MultiProvider] Timed out after ${PROVIDER_TIMEOUT}ms`);
                resolve([]); // Resolve with empty array on timeout
            }, PROVIDER_TIMEOUT);
        });

        const providerPromise = (async () => {
            try {
                const streams = await getStreams(imdbId, providerType, season, episode);
                console.log(`[MultiProvider] Found ${streams.length} total streams`);
                return streams;
            } catch (e) {
                console.error(`[MultiProvider] Execution Error:`, e.message);
                return [];
            } finally {
                if (timeoutId) clearTimeout(timeoutId);
            }
        })();

        // Race between provider execution and timeout
        let allStreams = await Promise.race([providerPromise, timeoutPromise]);

        // Fase 2.3: Stream Processing
        const processedStreams = allStreams
            .filter(s => {
                if (!s || !s.url) return false;
                const server = (s.server || "").toLowerCase();
                const sName = (s.name || "").toLowerCase();
                const sTitle = (s.title || "").toLowerCase();
                // Global filter for specific unwanted servers
                return !server.includes('mixdrop') && !sName.includes('mixdrop') && !sTitle.includes('mixdrop');
            })
            .map(s => {
                // For Stremio, we reconstruct the legacy multiline format using metadata
                const nameUI = (s.qualityTag && s.qualityTag !== 'Unknown') ? s.qualityTag : (s.providerName || "EasyStreams");

                let titleUI = `📁 ${s.originalTitle || 'Video'}\n${s.providerName || 'EasyStreams'}`;
                if (s.description) titleUI += ` | ${s.description}`;
                if (s.language) titleUI += `\n🗣️ ${s.language}`;

                return {
                    name: nameUI,
                    title: titleUI,
                    url: s.url,
                    behaviorHints: {
                        ...(s.behaviorHints || {}),
                        notWebReady: true,
                        bingeGroup: s.providerName || "EasyStreams" // Consistent grouping by provider name
                    },
                    language: s.language
                };
            });

        return { streams: processedStreams };
    } catch (error) {
        console.error(`[Stremio] Global Error:`, error);
        return { streams: [] };
    }
});


const addonInterface = builder.getInterface();
const addonRouter = getRouter(addonInterface);

// Custom Landing Page
app.get('/', (req, res) => {
    const manifest = addonInterface.manifest;
    const providerNames = ['StreamingCommunity', 'GuardaHD', 'Guardaserie', 'Guardoserie', 'AnimeUnity', 'AnimeWorld'];
    const providersHtml = providerNames.map(p => `<div class="provider-tag">${p}</div>`).join('');

    // Standard Stremio Landing Page Style
    const landingHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${manifest.name} - Stremio Addon</title>
        <style>
            :root {
                --purple: #8A5AAB;
                --purple-hover: #7b4b9b;
                --bg: #151515;
                --text: #fff;
                --text-secondary: #aaa;
            }
            body {
                background-color: var(--bg);
                color: var(--text);
                font-family: 'Open Sans', Arial, sans-serif;
                margin: 0;
                padding: 0;
                display: flex;
                flex-direction: column;
                min-height: 100vh;
                background-image: radial-gradient(circle at center, #252525 0%, #151515 100%);
            }
            .header {
                padding: 20px 40px;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .logo-text {
                font-weight: 700;
                font-size: 20px;
                color: #fff;
                text-decoration: none;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .logo-icon {
                width: 32px;
                height: 32px;
                background: var(--purple);
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
            }
            .main-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 40px 20px;
                text-align: center;
                position: relative;
                z-index: 1;
            }
            .addon-card {
                background: #1e1e1e;
                border-radius: 12px;
                padding: 50px 40px;
                max-width: 500px;
                width: 100%;
                box-shadow: 0 10px 40px rgba(0,0,0,0.4);
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            .addon-logo {
                width: 120px;
                height: 120px;
                background: #252525;
                border-radius: 16px;
                margin-bottom: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 50px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            }
            h1 {
                margin: 0 0 10px 0;
                font-size: 32px;
                font-weight: 700;
            }
            .version {
                color: var(--text-secondary);
                font-size: 14px;
                margin-bottom: 20px;
                background: #2a2a2a;
                padding: 4px 10px;
                border-radius: 4px;
            }
            .description {
                color: var(--text-secondary);
                font-size: 16px;
                line-height: 1.6;
                margin-bottom: 20px;
                max-width: 400px;
            }
            .providers-title {
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: #666;
                margin-bottom: 10px;
                margin-top: 10px;
            }
            .providers-list {
                margin-bottom: 30px;
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 8px;
            }
            .provider-tag {
                background: #2a2a2a;
                padding: 5px 10px;
                border-radius: 6px;
                font-size: 11px;
                color: #ccc;
                border: 1px solid #333;
                text-transform: uppercase;
                font-weight: 600;
                letter-spacing: 0.5px;
            }
            .install-btn {
                background-color: var(--purple);
                color: white;
                border: none;
                padding: 16px 40px;
                font-size: 18px;
                font-weight: 700;
                border-radius: 8px;
                cursor: pointer;
                text-decoration: none;
                transition: transform 0.2s, background-color 0.2s;
                display: inline-block;
                box-shadow: 0 4px 15px rgba(138, 90, 171, 0.4);
            }
            .install-btn:hover {
                background-color: var(--purple-hover);
                transform: translateY(-2px);
            }
            .install-btn:active {
                transform: translateY(0);
            }
            .copy-btn {
                background-color: transparent;
                color: var(--text-secondary);
                border: 1px solid #333;
                padding: 10px 20px;
                font-size: 14px;
                font-weight: 600;
                border-radius: 6px;
                cursor: pointer;
                margin-top: 15px;
                transition: all 0.2s;
            }
            .copy-btn:hover {
                border-color: #555;
                color: #fff;
            }
            .footer {
                padding: 20px;
                text-align: center;
                color: #555;
                font-size: 13px;
            }
            .footer a {
                color: #777;
                text-decoration: none;
            }
            .footer a:hover {
                color: var(--purple);
            }
            
            /* Background Pattern */
            .bg-pattern {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-image: url('data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23222" fill-opacity="0.4"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E');
                opacity: 0.5;
                z-index: 0;
                pointer-events: none;
            }
        </style>
    </head>
    <body>
        <div class="main-content">
            <div class="addon-card">
                <div class="addon-logo">
                    📺
                </div>
                <h1>${manifest.name}</h1>
                <div class="version">Version ${manifest.version}</div>
                <p class="description">
                    ${manifest.description}
                </p>
                
                <div class="providers-title">Active Providers</div>
                <div class="providers-list">
                    ${providersHtml}
                </div>

                <a id="installLink" href="#" class="install-btn">INSTALL ADDON</a>
                <button id="copyLink" class="copy-btn">📋 Copy Link</button>
            </div>
        </div>

        <div class="footer">
            Powered by <a href="https://github.com/realbestia1/" target="_blank">realbestia</a>
        </div>

        <script>
            // Dynamic Install Link
            const currentHost = window.location.host;
            const protocol = window.location.protocol;
            const manifestUrl = \`\${protocol}//\${currentHost}/manifest.json\`;
            const stremioUrl = \`stremio://\${currentHost}/manifest.json\`;
            
            const installBtn = document.getElementById('installLink');
            const copyBtn = document.getElementById('copyLink');
            
            // If on mobile/desktop, try deep link first
            installBtn.href = stremioUrl;

            // Copy Link Logic
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(manifestUrl).then(() => {
                    const originalText = copyBtn.innerText;
                    copyBtn.innerText = '✅ Copied!';
                    copyBtn.style.borderColor = '#4CAF50';
                    copyBtn.style.color = '#4CAF50';
                    
                    setTimeout(() => {
                        copyBtn.innerText = originalText;
                        copyBtn.style.borderColor = '';
                        copyBtn.style.color = '';
                    }, 2000);
                }).catch(err => {
                    console.error('Failed to copy: ', err);
                });
            });
            
            console.log("Manifest URL:", manifestUrl);
        </script>
    </body>
    </html>
    `;
    res.send(landingHtml);
});

app.use('/', addonRouter);

const PORT = process.env.PORT || 7000;
const server = app.listen(PORT, () => {
    console.log(`Stremio Addon running at http://localhost:${PORT}`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
    console.log('[Shutdown] SIGTERM received. Closing server...');
    server.close(() => {
        console.log('[Shutdown] Server closed.');
        httpsAgent.destroy();
        httpAgent.destroy();
        console.log('[Shutdown] Agents destroyed. Exiting.');
        process.exit(0);
    });
});

