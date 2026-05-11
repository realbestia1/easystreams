const { spawn } = require('child_process');
const { sanitizeLogArgs } = require('./src/utils/log_sanitizer');

try {
    require('dns').setDefaultResultOrder('ipv4first');
} catch { }

// Polyfill fetch and related Web APIs
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

const LOG_LEVEL = String(process.env.LOG_LEVEL || 'info').trim().toLowerCase();
const ENABLE_INFO_LOGS = ['debug', 'verbose', 'info'].includes(LOG_LEVEL);
const VERBOSE_LOGS = ['debug', 'verbose'].includes(LOG_LEVEL);

const PROVIDER_LOG_PREFIXES = [
    '[GuardaHD]',
    '[Guardoserie]',
    '[CinemaCity]',
    '[AnimeUnity]',
    '[AnimeWorld]',
    '[AnimeSaturn]',
    '[StreamingCommunity]',
    '[QualityHelper]'
];

const originalConsoleLog = console.log.bind(console);
const originalConsoleWarn = console.warn.bind(console);
const originalConsoleError = console.error.bind(console);

console.log = (...args) => {
    if (!ENABLE_INFO_LOGS) return;
    originalConsoleLog(...sanitizeLogArgs(args));
};

console.warn = (...args) => originalConsoleWarn(...sanitizeLogArgs(args));
console.error = (...args) => originalConsoleError(...sanitizeLogArgs(args));

// flareManager removed in favor of Scrapling

const { getClearance, getStats: getFlareStats } = require('./cf_bypass');

function logInfo(...args) {
    console.log(...args);
}

function logVerbose(...args) {
    if (!VERBOSE_LOGS) return;
    console.log(...args);
}

// Increase event listeners limit for high traffic
process.setMaxListeners(0);

// Connection pooling configuration
const agentOptions = {
    keepAlive: true,
    maxSockets: 500,
    maxFreeSockets: 100,
    timeout: 30000,
    keepAliveMsecs: 30000
};

const httpsAgent = new https.Agent(agentOptions);
const httpAgent = new http.Agent(agentOptions);

const { addonBuilder, serveHTTP, getRouter } = require('stremio-addon-sdk');
const express = require('express');
const app = express();
const path = require('path');
const { renderLandingPage } = require('./src/views/landing_page');
function readPositiveIntEnv(name, fallback) {
    const value = Number.parseInt(String(process.env[name] || ''), 10);
    return Number.isInteger(value) && value > 0 ? value : fallback;
}

app.get('/health/scrapling', (req, res) => {
    res.json({
        ok: true,
        scrapling: getFlareStats()
    });
});

const DISABLE_UQLOAD_ENV =
    typeof process !== 'undefined' &&
        process &&
        process.env &&
        typeof process.env.DISABLE_UQLOAD === 'string'
        ? process.env.DISABLE_UQLOAD.trim().toLowerCase()
        : '';
const DISABLE_UQLOAD_IN_ADDON = !['0', 'false', 'no', 'off'].includes(DISABLE_UQLOAD_ENV);
const CF_PROXY_URL_ENV =
    typeof process !== 'undefined' &&
        process &&
        process.env &&
        typeof process.env.CF_PROXY_URL === 'string'
        ? process.env.CF_PROXY_URL
        : '';
const normalizedProxyEnv = String(CF_PROXY_URL_ENV || '').trim().replace(/\/+$/, '');

// Set global proxy URL from CF_PROXY_URL env only.
if (/^https?:\/\//i.test(normalizedProxyEnv)) {
    global.CF_PROXY_URL = normalizedProxyEnv;
    logInfo(`[Proxy] Global CF_PROXY_URL set from CF_PROXY_URL: ${global.CF_PROXY_URL}`);
}

// Uqload should be skipped in addon mode to avoid failing extractor calls/noisy DNS errors.
if (DISABLE_UQLOAD_IN_ADDON) {
    global.DISABLE_UQLOAD = true;
}

// Performance Metrics
const metrics = {
    requests: 0,
    totalResponseTime: 0,
    errors: 0
};

// Monitoring Middleware
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');

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
            logVerbose(`[Metrics] Req: ${metrics.requests} | Avg: ${avgTime.toFixed(0)}ms | Errors: ${errorRate.toFixed(1)}%`);
        }
    });
    next();
});

// Global timeout configuration
const FETCH_TIMEOUT = 15000;
const STREAM_RESPONSE_TIMEOUT = 45000;
const DEFAULT_PROVIDER_TIMEOUT = 40000;
const PROVIDER_TIMEOUT = 40000;
const ANIME_PROVIDER_TIMEOUT = 40000;
const ANIME_STREAM_RESPONSE_TIMEOUT = 45000;
const ENABLE_SERIES_MAPPING_LOOKUP = false;
const ENABLE_ANIME_FALLBACK_ON_SERIES = false;
const ENABLE_ANIME_FALLBACK_ON_MOVIES = false;
const FORCE_ALL_PROVIDERS = false;
const ENABLE_TMDB_ANIME_DETECTION = true;
const DEFAULT_DISABLED_PROVIDERS = new Set([]);
const TMDB_ANIME_DETECTION_TIMEOUT = 1200;
const TMDB_ANIME_CACHE_TTL = 21600000;
const ADDON_CACHE_ENABLED = true;
const STREAM_CACHE_TTL = 60000;
const STREAM_CACHE_MAX_SIZE = 50000;
const STREAM_CACHE_MAX_BYTES = 100 * 1024 * 1024;
const PROVIDER_BENCHMARK_LOGS =
    typeof process !== 'undefined' &&
    process &&
    process.env &&
    String(process.env.PROVIDER_BENCHMARK_LOGS || '').trim().toLowerCase() === '1';

const streamCache = new Map();
const inFlightStreamRequests = new Map();
let streamCacheBytes = 0;

function estimateSizeBytes(value) {
    try {
        return Buffer.byteLength(JSON.stringify(value), 'utf8');
    } catch {
        return 0;
    }
}

function cloneStreamResponse(response) {
    return {
        streams: Array.isArray(response?.streams) ? response.streams.slice() : []
    };
}

function getCachedStreamResponse(cacheKey) {
    if (!ADDON_CACHE_ENABLED) return null;
    const entry = streamCache.get(cacheKey);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
        streamCacheBytes = Math.max(0, streamCacheBytes - (entry.sizeBytes || 0));
        streamCache.delete(cacheKey);
        return null;
    }
    return entry.response;
}

function setCachedStreamResponse(cacheKey, response) {
    if (!ADDON_CACHE_ENABLED) return;

    const payloadSize = estimateSizeBytes(response);
    if (payloadSize <= 0 || payloadSize > STREAM_CACHE_MAX_BYTES) {
        return;
    }

    const existingEntry = streamCache.get(cacheKey);
    if (existingEntry) {
        streamCacheBytes = Math.max(0, streamCacheBytes - (existingEntry.sizeBytes || 0));
        streamCache.delete(cacheKey);
    }

    while (
        streamCache.size > 0 &&
        (streamCache.size >= STREAM_CACHE_MAX_SIZE || (streamCacheBytes + payloadSize) > STREAM_CACHE_MAX_BYTES)
    ) {
        const oldestKey = streamCache.keys().next().value;
        if (oldestKey === undefined) break;
        const oldestEntry = streamCache.get(oldestKey);
        streamCacheBytes = Math.max(0, streamCacheBytes - (oldestEntry?.sizeBytes || 0));
        streamCache.delete(oldestKey);
    }

    streamCache.set(cacheKey, {
        response,
        expiresAt: Date.now() + STREAM_CACHE_TTL,
        sizeBytes: payloadSize
    });
    streamCacheBytes += payloadSize;
}

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

const ADDON_MAPPING_CACHE_TTL = 10800000;

function getMappingApiUrl() {
    return 'https://animemapping.realbestia.com';
}
const TMDB_API_KEY = '68e094699525b18a70bab2f86b1fa706';
const CANONICAL_RESOLVE_TIMEOUT = 1500;
const CANONICAL_REQUEST_CACHE_MAX_SIZE = 50000;
const TMDB_SEASON_COUNTS_CACHE_TTL = 21600000;

const streamCacheAliases = new Map();
const canonicalRequestCache = new Map();
const requestContextCache = new Map();
const tmdbAnimeDetectionCache = new Map();
const tmdbAnimeDetectionInFlight = new Map();
const tmdbSeasonCountsCache = new Map();
const tmdbSeasonCountsInFlight = new Map();

function getCachedStreamAlias(sourceKey) {
    if (!ADDON_CACHE_ENABLED) return null;
    const entry = streamCacheAliases.get(sourceKey);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
        streamCacheAliases.delete(sourceKey);
        return null;
    }
    return entry.targetKey;
}

function setCachedStreamAlias(sourceKey, targetKey) {
    if (!ADDON_CACHE_ENABLED) return;
    if (!sourceKey || !targetKey || sourceKey === targetKey) return;

    if (streamCacheAliases.size >= STREAM_CACHE_MAX_SIZE) {
        const oldestKey = streamCacheAliases.keys().next().value;
        if (oldestKey !== undefined) {
            streamCacheAliases.delete(oldestKey);
        }
    }

    streamCacheAliases.set(sourceKey, {
        targetKey,
        expiresAt: Date.now() + STREAM_CACHE_TTL
    });
}

function getCachedCanonicalRequestKey(cacheKey) {
    const entry = canonicalRequestCache.get(cacheKey);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
        canonicalRequestCache.delete(cacheKey);
        return undefined;
    }
    return entry.value;
}

function setCachedCanonicalRequestKey(cacheKey, value) {
    if (canonicalRequestCache.size >= CANONICAL_REQUEST_CACHE_MAX_SIZE) {
        const oldestKey = canonicalRequestCache.keys().next().value;
        if (oldestKey !== undefined) {
            canonicalRequestCache.delete(oldestKey);
        }
    }

    canonicalRequestCache.set(cacheKey, {
        value,
        expiresAt: Date.now() + ADDON_MAPPING_CACHE_TTL
    });
}

function cloneRequestContext(context) {
    if (!context || typeof context !== 'object') return null;
    return {
        ...context,
        titleHints: Array.isArray(context.titleHints) ? context.titleHints.slice() : [],
        mappedSeasons: Array.isArray(context.mappedSeasons) ? context.mappedSeasons.slice() : []
    };
}

function getCachedRequestContext(cacheKey) {
    const entry = requestContextCache.get(cacheKey);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
        requestContextCache.delete(cacheKey);
        return undefined;
    }
    return cloneRequestContext(entry.value);
}

function setCachedRequestContext(cacheKey, value) {
    if (requestContextCache.size >= CANONICAL_REQUEST_CACHE_MAX_SIZE) {
        const oldestKey = requestContextCache.keys().next().value;
        if (oldestKey !== undefined) {
            requestContextCache.delete(oldestKey);
        }
    }

    requestContextCache.set(cacheKey, {
        value: cloneRequestContext(value),
        expiresAt: Date.now() + ADDON_MAPPING_CACHE_TTL
    });
}

function normalizeConfigBoolean(value) {
    if (value === true) return true;
    const normalized = String(value || '').trim().toLowerCase();
    return ['1', 'true', 'yes', 'on', 'enabled', 'checked'].includes(normalized);
}

function resolveMappingLanguageFromConfig(config = null) {
    return normalizeConfigBoolean(config?.easyCatalogsLangIt) ? 'it' : null;
}

function normalizeEasyProxyUrl(value) {
    const trimmed = String(value || '').trim().replace(/\/+$/, '');
    return /^https?:\/\//i.test(trimmed) ? trimmed : '';
}

function normalizeEasyProxyEntry(entry, fallbackPassword = '') {
    const url = normalizeEasyProxyUrl(entry?.url || entry);
    if (!url) return null;
    return {
        url,
        password: String(entry?.password ?? fallbackPassword ?? '').trim()
    };
}

function parseEasyProxyEntries(value) {
    if (Array.isArray(value)) return value;
    const raw = String(value || '').trim();
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function resolveEasyProxyEntriesFromConfig(config = null) {
    const configuredEntries = parseEasyProxyEntries(config?.easyProxies)
        .map((entry) => normalizeEasyProxyEntry(entry))
        .filter(Boolean);

    const entries = configuredEntries.length > 0
        ? configuredEntries
        : String(config?.easyProxyUrls || config?.easyProxyUrl || '')
            .split(/[\s,]+/)
            .map((url) => normalizeEasyProxyEntry(url, config?.easyProxyPassword))
            .filter(Boolean);

    const seen = new Set();
    return entries.filter((entry) => {
        const token = `${entry.url}\n${entry.password}`;
        if (seen.has(token)) return false;
        seen.add(token);
        return true;
    });
}

function resolveEasyProxyModeFromConfig(config = null) {
    const normalized = String(config?.easyProxyMode || '').trim().toLowerCase();
    return ['load-balance', 'loadbalance', 'balanced', 'round-robin', 'roundrobin'].includes(normalized)
        ? 'load-balance'
        : 'failover';
}

function resolveDisabledProvidersFromConfig(config = null) {
    const hasExplicitDisabledProviders = Object.prototype.hasOwnProperty.call(config || {}, 'disabledProviders');
    const raw = String(config?.disabledProviders || '').trim();
    if (!hasExplicitDisabledProviders) return new Set(DEFAULT_DISABLED_PROVIDERS);
    return new Set(raw.split(',').map((name) => name.trim().toLowerCase()).filter(Boolean));
}

function getMappingLanguageToken(mappingLanguage) {
    return String(mappingLanguage || '').trim().toLowerCase() === 'it' ? 'it' : 'default';
}

function getEasyProxyEntriesToken(easyProxyEntries, easyProxyMode = 'failover') {
    const entries = Array.isArray(easyProxyEntries) ? easyProxyEntries.filter((entry) => entry?.url) : [];
    if (entries.length === 0) return 'default';
    return `${easyProxyMode}:${entries.map((entry) => `${entry.url}:pwd:${entry.password || ''}`).join('|')}`;
}

function getDisabledProvidersToken(disabledProviders) {
    const values = Array.from(disabledProviders || []).sort();
    return values.length > 0 ? values.join(',') : 'none';
}

function buildEasyProxyManifestUrl(easyProxyUrl, easyProxyPassword, streamUrl) {
    const proxyBaseUrl = normalizeEasyProxyUrl(easyProxyUrl);
    const proxyPassword = String(easyProxyPassword || '').trim();
    const normalizedStreamUrl = String(streamUrl || '').trim();
    if (!proxyBaseUrl || !normalizedStreamUrl) return normalizedStreamUrl;
    const passwordQuery = proxyPassword ? `&api_password=${encodeURIComponent(proxyPassword)}` : '';
    return `${proxyBaseUrl}/proxy/hls/manifest.m3u8?d=${encodeURIComponent(normalizedStreamUrl)}&redirect_stream=true${passwordQuery}`;
}

function buildEasyProxyExtractorUrl(easyProxyUrl, easyProxyPassword, host, streamUrl, extension = 'm3u8') {
    const proxyBaseUrl = normalizeEasyProxyUrl(easyProxyUrl);
    const proxyPassword = String(easyProxyPassword || '').trim();
    const normalizedHost = String(host || '').trim();
    const normalizedStreamUrl = String(streamUrl || '').trim();
    if (!proxyBaseUrl || !normalizedHost || !normalizedStreamUrl) return normalizedStreamUrl;
    const passwordQuery = proxyPassword ? `&api_password=${encodeURIComponent(proxyPassword)}` : '';
    return `${proxyBaseUrl}/extractor/video.${extension}?host=${encodeURIComponent(normalizedHost)}&d=${encodeURIComponent(normalizedStreamUrl)}&redirect_stream=true${passwordQuery}`;
}

function isMixdropStreamUrl(streamUrl) {
    const lower = String(streamUrl || '').toLowerCase();
    return lower.includes('mixdrop') || lower.includes('m1xdrop') || lower.includes('mxcontent');
}

function isMixdropStream(stream) {
    const text = [
        stream?.url,
        stream?.easyProxySourceUrl,
        stream?.name,
        stream?.title,
        stream?.providerName
    ].filter(Boolean).join(' ').toLowerCase();

    return text.includes('mixdrop') || text.includes('m1xdrop') || text.includes('mxcontent');
}

function isStreamHgStream(stream) {
    const text = [
        stream?.url,
        stream?.easyProxySourceUrl,
        stream?.name,
        stream?.title,
        stream?.providerName
    ].filter(Boolean).join(' ').toLowerCase();

    return text.includes('streamhg')
        || text.includes('dhcplay')
        || text.includes('vibuxer')
        || text.includes('masukestin')
        || text.includes('premilkyway')
        || text.includes('meadowlarkaninearts');
}

function buildEasyProxyStreamUrl(easyProxyUrl, easyProxyPassword, streamUrl) {
    const proxyBaseUrl = normalizeEasyProxyUrl(easyProxyUrl);
    const proxyPassword = String(easyProxyPassword || '').trim();
    const normalizedStreamUrl = String(streamUrl || '').trim();
    if (!proxyBaseUrl || !normalizedStreamUrl) return normalizedStreamUrl;
    const passwordQuery = proxyPassword ? `&api_password=${encodeURIComponent(proxyPassword)}` : '';
    return `${proxyBaseUrl}/proxy/stream?d=${encodeURIComponent(normalizedStreamUrl)}&redirect_stream=true${passwordQuery}`;
}

let easyProxyRoundRobinCursor = 0;
const EASY_PROXY_HEALTH_TIMEOUT_MS = 1000;

function getEasyProxyCandidateEntries(easyProxyEntries, easyProxyMode = 'failover') {
    const entries = Array.isArray(easyProxyEntries) ? easyProxyEntries.filter((entry) => entry?.url) : [];
    if (entries.length <= 1 || easyProxyMode !== 'load-balance') return entries;
    const start = easyProxyRoundRobinCursor % entries.length;
    easyProxyRoundRobinCursor = (easyProxyRoundRobinCursor + 1) % entries.length;
    return entries.slice(start).concat(entries.slice(0, start));
}

function buildEasyProxyHealthUrl(easyProxyUrl) {
    const proxyBaseUrl = normalizeEasyProxyUrl(easyProxyUrl);
    return proxyBaseUrl ? `${proxyBaseUrl}/proxy/ip` : '';
}

async function shouldFailoverEasyProxy(proxyEntry) {
    const proxyUrl = proxyEntry?.url;
    if (!proxyUrl) return false;

    // Se l'URL non è HTTPS, lo consideriamo potenzialmente locale (localhost, IP privati, ecc.)
    // In questi casi non vogliamo scartare il proxy anche se sembra lento o offline.
    if (!proxyUrl.toLowerCase().startsWith('https:')) {
        return false;
    }

    const healthUrl = buildEasyProxyHealthUrl(proxyUrl);
    if (!healthUrl || typeof fetch !== 'function') return false;

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), EASY_PROXY_HEALTH_TIMEOUT_MS) : null;
    try {
        const response = await fetch(healthUrl, {
            method: 'GET',
            redirect: 'manual',
            signal: controller?.signal
        });
        const status = Number(response?.status || 0);
        return status === 404 || status >= 500;
    } catch (error) {
        logVerbose(`[EasyProxy] Health check failed for ${healthUrl}: ${error.message}`);
        return true;
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}

async function buildEasyProxyUrlWithFailover(easyProxyEntries, easyProxyMode, buildUrl) {
    const candidates = getEasyProxyCandidateEntries(easyProxyEntries, easyProxyMode);
    if (candidates.length === 0) return '';

    let fallbackUrl = '';
    for (const proxyEntry of candidates) {
        const proxiedUrl = buildUrl(proxyEntry.url, proxyEntry.password || '');
        if (!proxiedUrl) continue;
        if (!fallbackUrl) fallbackUrl = proxiedUrl;
        const shouldFailover = await shouldFailoverEasyProxy(proxyEntry);
        if (!shouldFailover) {
            return proxiedUrl;
        }
        logVerbose(`[EasyProxy] ${buildEasyProxyHealthUrl(proxyEntry.url)} health check failed or timed out, trying next proxy`);
    }

    return fallbackUrl;
}

function hasJapaneseCharacters(value) {
    return /[\u3040-\u30ff\u31f0-\u31ff\u3400-\u4dbf\u4e00-\u9fff]/.test(String(value || ''));
}

function isAnimeLikeTmdbPayload(payload) {
    if (!payload || typeof payload !== 'object') return false;

    const genres = Array.isArray(payload.genres) ? payload.genres : [];
    const hasAnimationGenre = genres.some((g) => {
        const id = Number.parseInt(g?.id, 10);
        const name = String(g?.name || '').toLowerCase();
        return id === 16 || name.includes('animation') || name.includes('animazione') || name.includes('anime');
    });

    if (!hasAnimationGenre) return false;

    const originalLanguage = String(payload.original_language || '').toLowerCase();
    if (originalLanguage === 'ja' || originalLanguage === 'jp') return true;

    const originCountries = Array.isArray(payload.origin_country) ? payload.origin_country : [];
    if (originCountries.some((code) => String(code || '').toUpperCase() === 'JP')) return true;

    const productionCountries = Array.isArray(payload.production_countries) ? payload.production_countries : [];
    if (productionCountries.some((entry) => String(entry?.iso_3166_1 || '').toUpperCase() === 'JP')) return true;

    const titleCandidates = [
        payload.original_name,
        payload.original_title,
        payload.name,
        payload.title
    ];
    if (titleCandidates.some((t) => hasJapaneseCharacters(t))) return true;

    return false;
}

function getCachedAnimeDetection(cacheKey) {
    const entry = tmdbAnimeDetectionCache.get(cacheKey);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
        tmdbAnimeDetectionCache.delete(cacheKey);
        return undefined;
    }
    return entry.value === true;
}

function setCachedAnimeDetection(cacheKey, value) {
    if (tmdbAnimeDetectionCache.size >= CANONICAL_REQUEST_CACHE_MAX_SIZE) {
        const oldestKey = tmdbAnimeDetectionCache.keys().next().value;
        if (oldestKey !== undefined) {
            tmdbAnimeDetectionCache.delete(oldestKey);
        }
    }

    tmdbAnimeDetectionCache.set(cacheKey, {
        value: value === true,
        expiresAt: Date.now() + TMDB_ANIME_CACHE_TTL
    });
}

async function fetchTmdbMetadataForAnimeDetection(mediaType, tmdbId) {
    const endpoint = mediaType === 'movie' ? 'movie' : 'tv';
    const url = `https://api.themoviedb.org/3/${endpoint}/${encodeURIComponent(tmdbId)}?api_key=${TMDB_API_KEY}&language=en-US`;
    try {
        const response = await fetch(url, { timeout: TMDB_ANIME_DETECTION_TIMEOUT });
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

function getCachedTmdbSeasonCounts(tmdbId) {
    const entry = tmdbSeasonCountsCache.get(tmdbId);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
        tmdbSeasonCountsCache.delete(tmdbId);
        return undefined;
    }
    return Array.isArray(entry.value) ? entry.value : [];
}

function setCachedTmdbSeasonCounts(tmdbId, seasonCounts) {
    if (tmdbSeasonCountsCache.size >= CANONICAL_REQUEST_CACHE_MAX_SIZE) {
        const oldestKey = tmdbSeasonCountsCache.keys().next().value;
        if (oldestKey !== undefined) {
            tmdbSeasonCountsCache.delete(oldestKey);
        }
    }

    tmdbSeasonCountsCache.set(tmdbId, {
        value: Array.isArray(seasonCounts) ? seasonCounts : [],
        expiresAt: Date.now() + TMDB_SEASON_COUNTS_CACHE_TTL
    });
}

async function fetchTmdbSeasonEpisodeCounts(tmdbId) {
    const url = `https://api.themoviedb.org/3/tv/${encodeURIComponent(tmdbId)}?api_key=${TMDB_API_KEY}&language=en-US`;
    try {
        const response = await fetch(url, { timeout: CANONICAL_RESOLVE_TIMEOUT });
        if (!response.ok) return [];
        const payload = await response.json();
        const seasons = Array.isArray(payload?.seasons) ? payload.seasons : [];
        return seasons
            .map((season) => ({
                season_number: Number.parseInt(season?.season_number, 10),
                episode_count: Number.parseInt(season?.episode_count, 10)
            }))
            .filter((season) =>
                Number.isInteger(season.season_number) &&
                season.season_number > 0 &&
                Number.isInteger(season.episode_count) &&
                season.episode_count > 0
            )
            .sort((a, b) => a.season_number - b.season_number);
    } catch {
        return [];
    }
}

async function getTmdbSeasonEpisodeCounts(tmdbId) {
    const parsedTmdbId = Number.parseInt(tmdbId, 10);
    if (!Number.isInteger(parsedTmdbId) || parsedTmdbId <= 0) return [];
    const key = String(parsedTmdbId);

    const cached = getCachedTmdbSeasonCounts(key);
    if (cached !== undefined) return cached;

    if (tmdbSeasonCountsInFlight.has(key)) {
        return await tmdbSeasonCountsInFlight.get(key);
    }

    const fetchPromise = (async () => {
        const seasonCounts = await fetchTmdbSeasonEpisodeCounts(key);
        setCachedTmdbSeasonCounts(key, seasonCounts);
        return seasonCounts;
    })();

    tmdbSeasonCountsInFlight.set(key, fetchPromise);
    try {
        return await fetchPromise;
    } finally {
        tmdbSeasonCountsInFlight.delete(key);
    }
}

function toAbsoluteEpisodeFromSeasonCounts(seasonCounts, season, episode) {
    const parsedEpisode = Number.parseInt(episode, 10);
    if (!Number.isInteger(parsedEpisode) || parsedEpisode < 1) return null;

    const parsedSeason = Number.parseInt(season, 10);
    if (!Number.isInteger(parsedSeason) || parsedSeason < 1) {
        // No season in request: already absolute-style input.
        return parsedEpisode;
    }
    if (parsedSeason === 1) return parsedEpisode;

    const seasons = Array.isArray(seasonCounts) ? seasonCounts : [];
    const current = seasons.find((s) => s.season_number === parsedSeason);
    if (current && parsedEpisode > current.episode_count) {
        // Likely already absolute.
        return parsedEpisode;
    }

    let absolute = parsedEpisode;
    for (const s of seasons) {
        if (!Number.isInteger(s?.season_number) || !Number.isInteger(s?.episode_count)) continue;
        if (s.season_number < parsedSeason) {
            absolute += s.episode_count;
        }
    }
    return absolute;
}

async function detectAnimeByTmdb(type, requestContext = null) {
    if (!ENABLE_TMDB_ANIME_DETECTION || !TMDB_API_KEY) return false;

    const tmdbId = /^\d+$/.test(String(requestContext?.tmdbId || ''))
        ? String(requestContext.tmdbId)
        : null;
    if (!tmdbId) return false;

    const normalizedType = String(type || '').toLowerCase();
    // Keep media type strict to avoid false positives on shared numeric IDs
    // (e.g. series TV id can exist as a different movie id).
    const endpoints = normalizedType === 'movie'
        ? ['movie']
        : normalizedType === 'series'
            ? ['tv']
            : ['tv', 'movie'];

    for (const endpoint of endpoints) {
        const cacheKey = `${endpoint}:${tmdbId}`;
        const cached = getCachedAnimeDetection(cacheKey);
        if (cached !== undefined) {
            if (cached) return true;
            continue;
        }

        if (tmdbAnimeDetectionInFlight.has(cacheKey)) {
            const shared = await tmdbAnimeDetectionInFlight.get(cacheKey);
            if (shared) return true;
            continue;
        }

        const detectionPromise = (async () => {
            const payload = await fetchTmdbMetadataForAnimeDetection(endpoint, tmdbId);
            const isAnime = isAnimeLikeTmdbPayload(payload);
            setCachedAnimeDetection(cacheKey, isAnime);
            return isAnime;
        })();

        tmdbAnimeDetectionInFlight.set(cacheKey, detectionPromise);
        try {
            const detected = await detectionPromise;
            if (detected) return true;
        } finally {
            tmdbAnimeDetectionInFlight.delete(cacheKey);
        }
    }

    return false;
}

function parseStremioRequestId(type, id) {
    let normalizedId = String(id || '');
    try {
        normalizedId = decodeURIComponent(normalizedId);
    } catch {
        // Keep the original id when decode fails.
    }

    let providerId = normalizedId;
    let season = null;
    let episode = 1;
    let seasonProvided = false;

    if ((type === 'series' || type === 'anime') && normalizedId.includes(':')) {
        if (normalizedId.startsWith('tmdb:')) {
            const parts = normalizedId.split(':');
            if (parts.length >= 4) {
                providerId = `${parts[0]}:${parts[1]}`;
                season = Number.parseInt(parts[2], 10);
                episode = Number.parseInt(parts[3], 10);
                seasonProvided = true;
            } else if (parts.length === 3) {
                // Absolute numbering fallback, e.g. tmdb:12:247.
                providerId = `${parts[0]}:${parts[1]}`;
                season = null;
                episode = Number.parseInt(parts[2], 10);
            }
        } else if (normalizedId.startsWith('kitsu:')) {
            const parts = normalizedId.split(':');
            if (parts.length >= 4) {
                providerId = `${parts[0]}:${parts[1]}`;
                season = Number.parseInt(parts[2], 10);
                episode = Number.parseInt(parts[3], 10);
                seasonProvided = true;
            } else if (parts.length === 3) {
                providerId = `${parts[0]}:${parts[1]}`;
                season = null;
                episode = Number.parseInt(parts[2], 10);
            } else if (parts.length === 2) {
                providerId = `${parts[0]}:${parts[1]}`;
            }
        } else {
            const parts = normalizedId.split(':');
            providerId = parts[0];
            season = Number.parseInt(parts[1], 10);
            episode = Number.parseInt(parts[2], 10);
            seasonProvided = parts.length >= 3;
        }
    } else if (type === 'movie') {
        providerId = normalizedId;
    }

    if (!Number.isInteger(season) || season < 0) {
        season = null;
        seasonProvided = false;
    }
    if (!Number.isInteger(episode) || episode < 1) episode = 1;

    return { providerId, season, episode, seasonProvided };
}

function computeCanonicalSeason(requestedSeason, mappedSeason, topology = null) {
    const parsedRequestedSeason = Number.parseInt(requestedSeason, 10);
    const safeRequestedSeason =
        Number.isInteger(parsedRequestedSeason) && parsedRequestedSeason >= 0
            ? parsedRequestedSeason
            : null;

    const parsedMappedSeason = Number.parseInt(mappedSeason, 10);
    const longSeries = topology?.longSeries === true;
    const episodeMode = String(topology?.episodeMode || '').trim().toLowerCase();
    const isAbsoluteLongSeries = longSeries && episodeMode === 'absolute';

    if (!isAbsoluteLongSeries && Number.isInteger(parsedMappedSeason) && parsedMappedSeason >= 0) {
        return parsedMappedSeason;
    }
    if (safeRequestedSeason !== null) return safeRequestedSeason;
    return 1;
}

function shouldBypassStreamCacheForSeasonZero(type, requestContext = null) {
    const normalizedType = String(type || '').toLowerCase();
    if (normalizedType === 'movie') return false;

    const parsedCanonicalSeason = Number.parseInt(requestContext?.canonicalSeason, 10);
    if (Number.isInteger(parsedCanonicalSeason) && parsedCanonicalSeason === 0) return true;

    const parsedMappedSeason = Number.parseInt(requestContext?.mappedSeason, 10);
    if (Number.isInteger(parsedMappedSeason) && parsedMappedSeason === 0) return true;

    const parsedRequestedSeason = Number.parseInt(requestContext?.requestedSeason, 10);
    if (Number.isInteger(parsedRequestedSeason) && parsedRequestedSeason === 0) return true;

    return false;
}

function getCanonicalCacheMediaType(type) {
    return String(type).toLowerCase() === 'movie' ? 'movie' : 'tv';
}

function isHttpsMp4Url(rawUrl) {
    const url = String(rawUrl || '').trim();
    if (!url) return false;

    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') return false;
        return parsed.pathname.toLowerCase().endsWith('.mp4');
    } catch {
        return /^https:\/\/.+\.mp4(?:[?#].*)?$/i.test(url);
    }
}

function shouldMarkStreamAsNotWebReady(stream) {
    const behaviorHints = stream?.behaviorHints || {};
    const proxyHeaders = behaviorHints.proxyHeaders?.request;
    if (proxyHeaders && typeof proxyHeaders === 'object' && Object.keys(proxyHeaders).length > 0) {
        return true;
    }

    const headers = stream?.headers || behaviorHints.headers;
    if (headers && typeof headers === 'object' && Object.keys(headers).length > 0) {
        return true;
    }

    if (behaviorHints.notWebReady === true) return true;
    if (behaviorHints.notWebReady === false) return false;

    return !isHttpsMp4Url(stream?.url);
}

function mergeDistinctStrings(base = [], incoming = []) {
    const merged = [...(Array.isArray(base) ? base : []), ...(Array.isArray(incoming) ? incoming : [])]
        .map((s) => String(s || '').trim())
        .filter(Boolean);
    return [...new Set(merged)];
}

function isMeaningfulSeasonName(name) {
    const clean = String(name || '').trim();
    if (!clean) return false;
    if (/^Season\s+\d+$/i.test(clean)) return false;
    if (/^Stagione\s+\d+$/i.test(clean)) return false;
    return true;
}

function hasUsefulMappingSignals(payload) {
    if (!payload || typeof payload !== 'object') return false;

    const numericIdFields = ['tmdbId', 'malId', 'anilistId', 'anidbId', 'anisearchId', 'bangumiId', 'livechartId'];
    for (const field of numericIdFields) {
        const n = Number.parseInt(payload[field], 10);
        if (Number.isInteger(n) && n > 0) return true;
    }

    const textIdFields = ['tvdbId', 'seasonName', 'animePlanetId'];
    for (const field of textIdFields) {
        const value = String(payload[field] || '').trim();
        if (!value) continue;
        if (field === 'seasonName' && !isMeaningfulSeasonName(value)) continue;
        return true;
    }

    if (Array.isArray(payload.titleHints) && payload.titleHints.some((x) => String(x || '').trim().length > 0)) {
        return true;
    }

    if (Array.isArray(payload.mappedSeasons) && payload.mappedSeasons.some((x) => Number.isInteger(Number.parseInt(x, 10)) && Number.parseInt(x, 10) > 0)) {
        return true;
    }

    const parsedSeriesCount = Number.parseInt(payload.seriesSeasonCount, 10);
    if (Number.isInteger(parsedSeriesCount) && parsedSeriesCount > 0) return true;

    const parsedReleaseYear = Number.parseInt(payload.releaseYear, 10);
    if (Number.isInteger(parsedReleaseYear) && parsedReleaseYear > 0) return true;

    return false;
}

function applyMappingHintsToContext(context, payload) {
    if (!context || !payload || typeof payload !== 'object') return;

    const kitsuCandidate = String(payload.kitsuId || payload.kitsu_id || payload?.kitsu?.id || '').trim();
    if (/^\d+$/.test(kitsuCandidate)) {
        context.kitsuId = kitsuCandidate;
    }

    const tmdbCandidate = String(payload.tmdbId || '').trim();
    if (/^tmdb:\d+$/i.test(tmdbCandidate)) {
        context.tmdbId = tmdbCandidate.split(':')[1];
    } else if (/^\d+$/.test(tmdbCandidate)) {
        context.tmdbId = tmdbCandidate;
    } else if (/^tt\d+$/i.test(tmdbCandidate) && !context.imdbId) {
        // Some fallbacks return IMDb where TMDB is expected.
        context.imdbId = tmdbCandidate;
    }

    const imdbCandidate = String(payload.imdbId || '').trim();
    if (/^tt\d+$/i.test(imdbCandidate)) {
        context.imdbId = imdbCandidate;
    }

    const parsedSeason = Number.parseInt(payload.season, 10);
    if (Number.isInteger(parsedSeason) && parsedSeason >= 0) {
        context.mappedSeason = parsedSeason;
    }

    const seasonNameCandidate = String(payload.seasonName || '').trim();
    if (isMeaningfulSeasonName(seasonNameCandidate)) {
        context.seasonName = seasonNameCandidate;
    }

    context.titleHints = mergeDistinctStrings(context.titleHints, payload.titleHints);

    if (typeof payload.longSeries === 'boolean') {
        context.longSeries = payload.longSeries;
    }

    const mode = String(payload.episodeMode || '').trim().toLowerCase();
    if (mode) {
        context.episodeMode = mode;
    }

    if (Array.isArray(payload.mappedSeasons)) {
        const normalized = payload.mappedSeasons
            .map((n) => Number.parseInt(n, 10))
            .filter((n) => Number.isInteger(n) && n > 0);
        if (normalized.length > 0) {
            context.mappedSeasons = [...new Set(normalized)].sort((a, b) => a - b);
        }
    }

    const parsedSeriesCount = Number.parseInt(payload.seriesSeasonCount, 10);
    if (Number.isInteger(parsedSeriesCount) && parsedSeriesCount > 0) {
        context.seriesSeasonCount = parsedSeriesCount;
    }

    const parsedReleaseYear = Number.parseInt(payload.releaseYear, 10);
    if (Number.isInteger(parsedReleaseYear) && parsedReleaseYear > 0) {
        context.releaseYear = parsedReleaseYear;
    }
}

async function fetchMappingByProvider(provider, value, season, episode, mappingLanguage = null) {
    const mappingApiUrl = getMappingApiUrl();
    const normalizedProvider = String(provider || '').trim().toLowerCase();
    if (!mappingApiUrl || !normalizedProvider || !value) return null;
    if (!['imdb', 'tmdb', 'kitsu'].includes(normalizedProvider)) return null;
    const effectiveMappingLanguage = normalizedProvider === 'kitsu' ? 'it' : mappingLanguage;

    const encodedValue = encodeURIComponent(String(value).trim());
    let url = `${mappingApiUrl}/${normalizedProvider}/${encodedValue}`;
    const params = new URLSearchParams();
    if (Number.isInteger(season) && season >= 0) {
        params.set('s', String(season));
    }
    if (Number.isInteger(episode) && episode > 0) {
        params.set('ep', String(episode));
    }
    if (getMappingLanguageToken(effectiveMappingLanguage) === 'it') {
        params.set('lang', 'it');
    }
    const query = params.toString();
    if (query) {
        url += `?${query}`;
    }

    try {
        const response = await fetch(url, { timeout: CANONICAL_RESOLVE_TIMEOUT });
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

async function fetchTmdbIdFromImdbForCanonicalKey(imdbId) {
    if (!TMDB_API_KEY) return null;
    const url = `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;

    try {
        const response = await fetch(url, { timeout: CANONICAL_RESOLVE_TIMEOUT });
        if (!response.ok) return null;
        const payload = await response.json();

        if (Array.isArray(payload?.tv_results) && payload.tv_results.length > 0) {
            return payload.tv_results[0].id;
        }
        if (Array.isArray(payload?.movie_results) && payload.movie_results.length > 0) {
            return payload.movie_results[0].id;
        }
        return null;
    } catch {
        return null;
    }
}

async function resolveProviderRequestContext(type, providerId, season, episode, mappingLanguage = null, seasonProvided = false) {
    const mappingLanguageToken = getMappingLanguageToken(mappingLanguage);
    const identityKey = `${type}:${providerId}:${season}:${episode}:${mappingLanguageToken}:${seasonProvided ? 1 : 0}`;
    const cached = getCachedRequestContext(identityKey);
    if (cached !== undefined) {
        return cached;
    }

    const parsedSeason = Number.parseInt(season, 10);
    const normalizedRequestedSeason =
        Number.isInteger(parsedSeason) && parsedSeason >= 0
            ? parsedSeason
            : null;
    const parsedEpisode = Number.parseInt(episode, 10);
    const normalizedRequestedEpisode =
        Number.isInteger(parsedEpisode) && parsedEpisode > 0
            ? parsedEpisode
            : 1;

    const context = {
        idType: 'raw',
        providerId: String(providerId),
        requestedSeason: normalizedRequestedSeason,
        requestedEpisode: normalizedRequestedEpisode,
        easyCatalogsLangIt: mappingLanguageToken === 'it',
        mappingLanguage: mappingLanguageToken === 'it' ? 'it' : null,
        seasonProvided: seasonProvided === true,
        kitsuId: null,
        tmdbId: null,
        imdbId: null,
        mappedSeason: null,
        seasonName: null,
        titleHints: [],
        releaseYear: null,
        longSeries: false,
        episodeMode: null,
        mappedSeasons: [],
        seriesSeasonCount: null,
        mappingLookupMiss: false,
        canonicalSeason: normalizedRequestedSeason
    };

    const idStr = String(providerId || '').trim();
    const normalizedType = String(type || '').toLowerCase();
    const isImdbId = /^tt\d+$/i.test(idStr);
    const isKitsuId = /^kitsu:\d+$/i.test(idStr);
    const isTmdbLikeId = idStr.startsWith('tmdb:') || /^\d+$/.test(idStr);
    const shouldFetchMappingApi =
        type === 'anime' ||
        isKitsuId ||
        isImdbId ||
        isTmdbLikeId ||
        ENABLE_SERIES_MAPPING_LOOKUP;

    try {
        if (idStr.startsWith('kitsu:')) {
            context.idType = 'kitsu';
            const parts = idStr.split(':');
            if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
                context.kitsuId = parts[1];
                let mappingSignalsFound = false;
                if (shouldFetchMappingApi) {
                    const byKitsu = await fetchMappingByProvider('kitsu', context.kitsuId, context.requestedSeason, context.requestedEpisode, context.mappingLanguage);
                    if (byKitsu) {
                        applyMappingHintsToContext(context, byKitsu);
                        mappingSignalsFound = hasUsefulMappingSignals(byKitsu);
                    }
                }
                context.mappingLookupMiss = shouldFetchMappingApi && !mappingSignalsFound;
            }
        } else if (idStr.startsWith('tmdb:')) {
            context.idType = 'tmdb';
            const parts = idStr.split(':');
            if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
                context.tmdbId = parts[1];
            }
        } else if (/^tt\d+$/i.test(idStr)) {
            context.idType = 'imdb';
            context.imdbId = idStr;
            let mappingSignalsFound = false;

            if (shouldFetchMappingApi) {
                const byImdb = await fetchMappingByProvider('imdb', idStr, context.requestedSeason, context.requestedEpisode, context.mappingLanguage);
                if (byImdb) {
                    applyMappingHintsToContext(context, byImdb);
                    mappingSignalsFound = hasUsefulMappingSignals(byImdb);
                }
            }
            context.mappingLookupMiss = shouldFetchMappingApi && !mappingSignalsFound;

            if (!context.tmdbId) {
                const fallbackTmdbId = await fetchTmdbIdFromImdbForCanonicalKey(idStr);
                if (fallbackTmdbId !== null && fallbackTmdbId !== undefined) {
                    context.tmdbId = String(fallbackTmdbId);
                }
            }
        } else if (/^\d+$/.test(idStr)) {
            context.idType = 'tmdb-numeric';
            context.tmdbId = idStr;
        }

        if (shouldFetchMappingApi && context.tmdbId) {
            const byTmdb = await fetchMappingByProvider('tmdb', context.tmdbId, context.requestedSeason, context.requestedEpisode, context.mappingLanguage);
            if (byTmdb) {
                applyMappingHintsToContext(context, byTmdb);
            }
        }

    } catch (error) {
        console.warn(`[Stremio] Request context resolve failed for ${providerId}: ${error.message}`);
    }

    context.canonicalSeason = computeCanonicalSeason(context.requestedSeason, context.mappedSeason, context);
    setCachedRequestContext(identityKey, context);
    return cloneRequestContext(context);
}

function buildProviderRequestContext(context) {
    if (!context) return null;
    return {
        __requestContext: true,
        idType: context.idType,
        providerId: context.providerId,
        requestedSeason: context.requestedSeason,
        requestedEpisode: context.requestedEpisode,
        easyCatalogsLangIt: context.easyCatalogsLangIt === true,
        mappingLanguage: context.mappingLanguage || null,
        seasonProvided: context.seasonProvided === true,
        kitsuId: context.kitsuId,
        tmdbId: context.tmdbId,
        imdbId: context.imdbId,
        season: context.mappedSeason,
        mappedSeason: context.mappedSeason,
        seasonName: context.seasonName,
        mappedSeasonName: context.seasonName,
        titleHints: Array.isArray(context.titleHints) ? context.titleHints.slice() : [],
        mappedTitleHints: Array.isArray(context.titleHints) ? context.titleHints.slice() : [],
        releaseYear: context.releaseYear,
        longSeries: context.longSeries === true,
        episodeMode: context.episodeMode || null,
        mappedSeasons: Array.isArray(context.mappedSeasons) ? context.mappedSeasons.slice() : [],
        seriesSeasonCount: context.seriesSeasonCount
    };
}

async function resolveCanonicalStreamCacheKey(type, providerId, season, episode, requestContext = null, mappingLanguage = null) {
    if (!ADDON_CACHE_ENABLED) return null;
    if (type !== 'series' && type !== 'anime') return null;

    const context = requestContext || await resolveProviderRequestContext(type, providerId, season, episode, mappingLanguage, false);
    const parsedIdentityMappedSeason = Number.parseInt(context?.mappedSeason, 10);
    const identityMappedSeasonToken = Number.isInteger(parsedIdentityMappedSeason)
        ? parsedIdentityMappedSeason
        : 'na';
    const mappingLanguageToken = getMappingLanguageToken(context?.mappingLanguage || mappingLanguage);
    const identityKey = `${type}:${providerId}:${season}:${episode}:${identityMappedSeasonToken}:${mappingLanguageToken}`;
    const cached = getCachedCanonicalRequestKey(identityKey);
    if (cached !== undefined) {
        return cached;
    }

    const tmdbId = (context && /^\d+$/.test(String(context.tmdbId || ''))) ? String(context.tmdbId) : null;
    if (!tmdbId) {
        setCachedCanonicalRequestKey(identityKey, null);
        return null;
    }

    const parsedCanonicalSeason = Number.parseInt(context?.canonicalSeason, 10);
    const canonicalSeason = Number.isInteger(parsedCanonicalSeason)
        ? parsedCanonicalSeason
        : computeCanonicalSeason(season, context?.mappedSeason, context);
    const parsedEpisode = Number.parseInt(episode, 10);
    let canonicalSeasonToken = String(canonicalSeason);
    let canonicalEpisode = Number.isInteger(parsedEpisode) && parsedEpisode > 0
        ? parsedEpisode
        : episode;

    const isAbsoluteMode = context?.longSeries === true && String(context?.episodeMode || '').toLowerCase() === 'absolute';
    if (isAbsoluteMode && Number.isInteger(parsedEpisode) && parsedEpisode > 0) {
        const parsedRequestSeason = Number.parseInt(season, 10);
        const canUseAsAbsoluteInput = !Number.isInteger(parsedRequestSeason) || parsedRequestSeason < 1 || parsedRequestSeason === 1;
        if (canUseAsAbsoluteInput) {
            canonicalSeasonToken = 'abs';
            canonicalEpisode = parsedEpisode;
        } else {
            const seasonCounts = await getTmdbSeasonEpisodeCounts(tmdbId);
            if (Array.isArray(seasonCounts) && seasonCounts.length > 0) {
                const absoluteEpisode = toAbsoluteEpisodeFromSeasonCounts(seasonCounts, parsedRequestSeason, parsedEpisode);
                if (Number.isInteger(absoluteEpisode) && absoluteEpisode > 0) {
                    canonicalSeasonToken = 'abs';
                    canonicalEpisode = absoluteEpisode;
                }
            }
        }
    }

    const cacheType = getCanonicalCacheMediaType(type);
    const canonicalKey = `${cacheType}:canon:tmdb:${tmdbId}:${canonicalSeasonToken}:${canonicalEpisode}:lang:${mappingLanguageToken}`;
    setCachedCanonicalRequestKey(identityKey, canonicalKey);
    return canonicalKey;
}

// Import providers
const providers = {
    guardahd: require('./src/guardahd/index.js'),
    guardoserie: require('./src/guardoserie/index.js'),
    animeunity: require('./src/animeunity/index.js'),
    animeworld: require('./src/animeworld/index.js'),
    animesaturn: require('./src/animesaturn/index.js'),
    streamingcommunity: require('./src/streamingcommunity/index.js'),
    cinemacity: require('./src/cinemacity/index.js'),
};

const EASY_PROXY_REQUIRED_PROVIDERS = new Set(['streamingcommunity', 'animeunity', 'cinemacity']);

function isLikelyAnimeRequest(type, providerId, requestContext) {
    const normalizedType = String(type || '').toLowerCase();
    if (normalizedType === 'anime') return true;
    if (String(requestContext?.idType || '').toLowerCase() === 'kitsu') return true;

    if (requestContext?.longSeries === true && String(requestContext?.episodeMode || '').toLowerCase() === 'absolute') {
        return true;
    }

    return false;
}

async function resolveAnimeRoutingFlag(type, providerId, requestContext) {
    const normalizedType = String(type || '').toLowerCase();
    // For IMDb IDs with no usable mapping signals, avoid anime auto-routing.
    // This prevents false-positive anime matches from TMDB/find fallbacks.
    if (
        String(requestContext?.idType || '').toLowerCase() === 'imdb' &&
        requestContext?.mappingLookupMiss === true &&
        !requestContext?.tmdbId
    ) {
        return false;
    }

    if (isLikelyAnimeRequest(type, providerId, requestContext)) {
        return true;
    }

    if (normalizedType !== 'series' && normalizedType !== 'movie') {
        return false;
    }

    return await detectAnimeByTmdb(normalizedType, requestContext);
}

function getProviderExecutionOrder(type, providerId, requestContext, animeRoutingFlag = null) {
    if (FORCE_ALL_PROVIDERS) {
        return Object.keys(providers);
    }

    const normalizedType = String(type || '').toLowerCase();
    const likelyAnime = typeof animeRoutingFlag === 'boolean'
        ? animeRoutingFlag
        : isLikelyAnimeRequest(normalizedType, providerId, requestContext);
    const isImdbRequest =
        String(requestContext?.idType || '').toLowerCase() === 'imdb' ||
        /^tt\d+$/i.test(String(providerId || '').trim()) ||
        !!(requestContext && requestContext.imdbId && /^tt\d+$/i.test(requestContext.imdbId));
    const isKitsuRequest =
        String(requestContext?.idType || '').toLowerCase() === 'kitsu' ||
        /^kitsu:\d+$/i.test(String(providerId || '').trim());
    let plan;

    if (normalizedType === 'movie') {
        if (isKitsuRequest) {
            // For Kitsu movies, use anime providers first and keep non-anime fallbacks.
            plan = ['animeunity', 'animeworld', 'animesaturn', 'guardoserie', 'streamingcommunity', 'guardahd'];
        } else if (isImdbRequest) {
            plan = likelyAnime
                ? ['animeunity', 'animeworld', 'animesaturn', 'guardoserie', 'streamingcommunity', 'guardahd']
                : ['streamingcommunity', 'guardahd', 'guardoserie', 'cinemacity'];
        } else if (likelyAnime || ENABLE_ANIME_FALLBACK_ON_MOVIES) {
            plan = ['animeunity', 'animeworld', 'animesaturn', 'guardoserie'];
        } else {
            plan = ['streamingcommunity', 'guardahd', 'guardoserie', 'cinemacity'];
        }
    } else if (normalizedType === 'anime') {
        plan = ['animeunity', 'animeworld', 'animesaturn', 'guardoserie'];
    } else {
        if (isImdbRequest) {
            plan = likelyAnime
                ? ['animeunity', 'animeworld', 'animesaturn', 'guardoserie']
                : ['streamingcommunity', 'guardoserie', 'cinemacity'];
        } else if (likelyAnime || ENABLE_ANIME_FALLBACK_ON_SERIES) {
            plan = ['animeunity', 'animeworld', 'animesaturn', 'guardoserie'];
        } else {
            plan = ['streamingcommunity', 'guardoserie', 'cinemacity'];
        }
    }

    const finalPlan = [...new Set(plan)].filter((name) => {
        return providers[name] && typeof providers[name].getStreams === 'function';
    });

    return finalPlan;
}

const builder = new addonBuilder({
    id: 'org.bestia.easystreams',
    version: '1.1.1',
    name: 'Easy Streams',
    description: 'Italian Streams providers',
    catalogs: [],
    resources: ['stream'],
    types: ['movie', 'series', 'anime'],
    idPrefixes: ['tt', 'tmdb', 'kitsu'],
    behaviorHints: {
        configurable: true
    },
    config: [
        {
            key: 'easyCatalogsLangIt',
            type: 'checkbox',
            title: 'EasyCatalogs mode (adds lang=it to mapping requests)'
        },
        {
            key: 'easyProxies',
            type: 'text',
            title: 'EasyProxy endpoints JSON'
        },
        {
            key: 'easyProxyMode',
            type: 'select',
            title: 'EasyProxy mode (Failover: usa primo sano | Load-balance: alterna)',
            options: ['failover', 'load-balance']
        },
        {
            key: 'disabledProviders',
            type: 'text',
            title: 'Disabled providers (comma-separated)'
        }
    ]
});

builder.defineStreamHandler(async ({ type, id, config = {} }) => {
    const mappingLanguage = resolveMappingLanguageFromConfig(config);
    const easyProxyEntries = resolveEasyProxyEntriesFromConfig(config);
    const easyProxyMode = resolveEasyProxyModeFromConfig(config);

    // Pre-select a healthy proxy based on the configured failover/skip logic
    const healthyProxyUrl = await buildEasyProxyUrlWithFailover(easyProxyEntries, easyProxyMode, (url) => url);
    const easyProxyUrl = healthyProxyUrl || (easyProxyEntries[0]?.url || '');
    const easyProxyPassword = easyProxyEntries.find(e => e.url === easyProxyUrl)?.password || easyProxyEntries[0]?.password || '';
    const disabledProviders = resolveDisabledProvidersFromConfig(config);
    const requestKey = `${type}:${id}:lang:${getMappingLanguageToken(mappingLanguage)}:proxy:${getEasyProxyEntriesToken(easyProxyEntries, easyProxyMode)}:disabled:${getDisabledProvidersToken(disabledProviders)}`;
    const parsedRequest = parseStremioRequestId(type, id);
    const providerId = parsedRequest.providerId;
    const season = parsedRequest.season;
    const episode = parsedRequest.episode;
    const requestContext = await resolveProviderRequestContext(type, providerId, season, episode, mappingLanguage, parsedRequest.seasonProvided);

    const bypassSeasonZeroCache = shouldBypassStreamCacheForSeasonZero(type, requestContext);
    const cacheEnabledForRequest = ADDON_CACHE_ENABLED && !bypassSeasonZeroCache;

    if (cacheEnabledForRequest) {
        const directCachedResponse = getCachedStreamResponse(requestKey);
        if (directCachedResponse) {
            logVerbose(`[Stremio] Cache hit: ${requestKey}`);
            return cloneStreamResponse(directCachedResponse);
        }

        const aliasedKey = getCachedStreamAlias(requestKey);
        if (aliasedKey) {
            const aliasedCachedResponse = getCachedStreamResponse(aliasedKey);
            if (aliasedCachedResponse) {
                logVerbose(`[Stremio] Cache hit (alias): ${requestKey} -> ${aliasedKey}`);
                return cloneStreamResponse(aliasedCachedResponse);
            }
            streamCacheAliases.delete(requestKey);
        }
    } else if (ADDON_CACHE_ENABLED && bypassSeasonZeroCache) {
        logVerbose(`[Stremio] Cache bypass for season 0: ${requestKey}`);
    }

    const parsedCanonicalSeason = Number.parseInt(requestContext?.canonicalSeason, 10);
    const effectiveSeason = Number.isInteger(parsedCanonicalSeason) && parsedCanonicalSeason >= 0
        ? parsedCanonicalSeason
        : season;
    const baseCanonicalCacheKey = await resolveCanonicalStreamCacheKey(type, providerId, season, episode, requestContext, mappingLanguage);
    const canonicalCacheKey = baseCanonicalCacheKey
        ? `${baseCanonicalCacheKey}:proxy:${getEasyProxyEntriesToken(easyProxyEntries, easyProxyMode)}:disabled:${getDisabledProvidersToken(disabledProviders)}`
        : null;

    if (cacheEnabledForRequest && canonicalCacheKey && canonicalCacheKey !== requestKey) {
        const canonicalCachedResponse = getCachedStreamResponse(canonicalCacheKey);
        if (canonicalCachedResponse) {
            setCachedStreamAlias(requestKey, canonicalCacheKey);
            logVerbose(`[Stremio] Cache hit (canonical): ${requestKey} -> ${canonicalCacheKey}`);
            return cloneStreamResponse(canonicalCachedResponse);
        }
    }

    if (cacheEnabledForRequest) {
        const inFlightKeys = [requestKey];
        if (canonicalCacheKey && canonicalCacheKey !== requestKey) {
            inFlightKeys.unshift(canonicalCacheKey);
        }

        for (const key of inFlightKeys) {
            if (!inFlightStreamRequests.has(key)) continue;
            const label = (key === requestKey) ? requestKey : `${requestKey} -> ${key}`;
            logVerbose(`[Stremio] Reusing in-flight request: ${label}`);
            const sharedResponse = await inFlightStreamRequests.get(key);
            return cloneStreamResponse(sharedResponse);
        }
    }

    const cacheStorageKey = (cacheEnabledForRequest && canonicalCacheKey && canonicalCacheKey !== requestKey)
        ? canonicalCacheKey
        : requestKey;
    const animeRoutingFlagPromise = resolveAnimeRoutingFlag(type, providerId, requestContext);

    const streamResolutionPromise = (async () => {
        logVerbose(`[Stremio] Request: ${type} ${id}`);
        if (cacheStorageKey !== requestKey) {
            logVerbose(`[Stremio] Canonical cache key: ${cacheStorageKey} (from ${requestKey})`);
        }
        logVerbose(`[Stremio] Parsed: ID=${providerId}, Season=${season}, Episode=${episode}`);
        if (requestContext?.mappingLanguage) {
            logVerbose(`[Stremio] Mapping language: ${requestContext.mappingLanguage}`);
        }
        if (effectiveSeason !== season) {
            logVerbose(`[Stremio] Effective Season: ${effectiveSeason} (mapping canonicalization)`);
        }
        if (requestContext?.tmdbId) {
            logVerbose(`[Stremio] Context: TMDB=${requestContext.tmdbId}, MappedSeason=${requestContext.mappedSeason ?? 'n/a'}, CanonicalSeason=${requestContext.canonicalSeason}`);
        }
        // Map Stremio type to provider type
        // Stremio: movie, series, anime
        // Providers: movie, tv
        const providerType = (type === 'movie') ? 'movie' : 'tv';

        const collectedStreams = [];
        const providerBenchmarkResults = [];
        const providersStartedAt = Date.now();
        const animeRoutingFlag = await animeRoutingFlagPromise;
        const requestStreamTimeout =
            animeRoutingFlag === true
                ? Math.max(STREAM_RESPONSE_TIMEOUT, ANIME_STREAM_RESPONSE_TIMEOUT)
                : STREAM_RESPONSE_TIMEOUT;
        if (animeRoutingFlag && type !== 'anime') {
            logVerbose(`[Stremio] Anime routing enabled for ${type}:${providerId}`);
        }
        const hasEasyProxy = Boolean(easyProxyUrl);
        const selectedProviders = getProviderExecutionOrder(type, providerId, requestContext, animeRoutingFlag)
            .filter((name) => !disabledProviders.has(String(name).toLowerCase()))
            .filter((name) => !EASY_PROXY_REQUIRED_PROVIDERS.has(name) || hasEasyProxy);
        if (selectedProviders.length === 0) {
            console.warn('[Stremio] No provider selected for request.');
            return { streams: [] };
        }
        logVerbose(`[Stremio] Providers selected (${selectedProviders.length}): ${selectedProviders.join(', ')}`);

        const providerTasks = selectedProviders.map(async (name) => {
            const providerStartedAt = Date.now();
            let didTimeout = false;
            let executionError = null;
            let rawStreamsCount = 0;
            let processedStreamsCount = 0;
            let finalStatus = 'success';
            try {
                const provider = providers[name];
                if (typeof provider.getStreams !== 'function') {
                    finalStatus = 'skipped';
                    return [];
                }

                logVerbose(`[${name}] Searching...`);

                const providerTimeoutMs = PROVIDER_TIMEOUT;

                let timeoutId;
                const timeoutPromise = new Promise((resolve) => {
                    timeoutId = setTimeout(() => {
                        didTimeout = true;
                        console.warn(`[${name}] Timed out after ${providerTimeoutMs}ms`);
                        resolve([]); // Resolve with empty array on timeout
                    }, providerTimeoutMs);
                });

                const providerPromise = (async () => {
                    try {
                        const providerContext = buildProviderRequestContext(requestContext);
                        providerContext.proxyUrl = easyProxyUrl;
                        providerContext.proxyUrls = easyProxyEntries.map((entry) => entry.url);
                        providerContext.proxyEntries = easyProxyEntries;
                        providerContext.proxyMode = easyProxyMode;
                        providerContext.proxyPassword = easyProxyPassword;
                        const streams = await provider.getStreams(providerId, providerType, effectiveSeason, episode, providerContext);
                        logVerbose(`[${name}] Found ${streams.length} streams`);
                        return streams;
                    } catch (e) {
                        executionError = e;
                        console.error(`[${name}] Execution Error:`, e.message);
                        return [];
                    } finally {
                        if (timeoutId) clearTimeout(timeoutId);
                    }
                })();

                // Race between provider execution and timeout
                let streams = await Promise.race([providerPromise, timeoutPromise]);
                rawStreamsCount = Array.isArray(streams) ? streams.length : 0;

                // Fase 2.3: Stream Processing
                const processedStreams = streams
                    .filter((s) => {
                        if (!s || !s.url) return false;
                        const server = (s.server || "").toLowerCase();
                        const sName = (s.name || "").toLowerCase();
                        const sTitle = (s.title || "").toLowerCase();
                        const isStreamingCommunityProvider = name === 'streamingcommunity';
                        const isAnimeUnityProvider = name === 'animeunity';
                        const hasEasyProxy = Boolean(easyProxyUrl);
                        const isStreamHgProviderStream = isStreamHgStream(s);
                        if (isStreamingCommunityProvider && !hasEasyProxy) return false;
                        if (isAnimeUnityProvider && !hasEasyProxy) return false;
                        if (isStreamHgProviderStream && !hasEasyProxy) return false;
                        const canProxyMixdrop = Boolean(easyProxyUrl) && isMixdropStreamUrl(s.url);
                        // Global filter for specific unwanted servers
                        return (
                            (canProxyMixdrop || (
                                !server.includes('mixdrop') &&
                                !sName.includes('mixdrop') &&
                                !sTitle.includes('mixdrop')
                            )) &&
                            !server.includes('uqload') &&
                            !sName.includes('uqload') &&
                            !sTitle.includes('uqload')
                        );
                    })
                    .map(async (s) => {
                        let finalStreamUrl = s.url;
                        let proxiedByEasyProxy = false;
                        if (name === 'streamingcommunity') {
                            finalStreamUrl = await buildEasyProxyUrlWithFailover(
                                easyProxyEntries,
                                easyProxyMode,
                                (proxyUrl, proxyPassword) => buildEasyProxyExtractorUrl(
                                    proxyUrl,
                                    proxyPassword,
                                    'vixsrc',
                                    s.easyProxySourceUrl || s.url,
                                    'm3u8'
                                )
                            );
                            proxiedByEasyProxy = finalStreamUrl !== s.url;
                        } else if (name === 'animeunity') {
                            finalStreamUrl = await buildEasyProxyUrlWithFailover(
                                easyProxyEntries,
                                easyProxyMode,
                                (proxyUrl, proxyPassword) => buildEasyProxyExtractorUrl(
                                    proxyUrl,
                                    proxyPassword,
                                    'vixcloud',
                                    s.easyProxySourceUrl || s.url
                                )
                            );
                            proxiedByEasyProxy = finalStreamUrl !== s.url;
                        } else if (isStreamHgStream(s)) {
                            finalStreamUrl = await buildEasyProxyUrlWithFailover(
                                easyProxyEntries,
                                easyProxyMode,
                                (proxyUrl, proxyPassword) => buildEasyProxyExtractorUrl(
                                    proxyUrl,
                                    proxyPassword,
                                    'streamhg',
                                    s.easyProxySourceUrl || s.url
                                )
                            );
                            proxiedByEasyProxy = finalStreamUrl !== s.url;
                        } else if (isMixdropStream(s)) {
                            const mixdropExtension = name === 'guardahd' ? 'mp4' : 'm3u8';
                            finalStreamUrl = await buildEasyProxyUrlWithFailover(
                                easyProxyEntries,
                                easyProxyMode,
                                (proxyUrl, proxyPassword) => buildEasyProxyExtractorUrl(
                                    proxyUrl,
                                    proxyPassword,
                                    'mixdrop',
                                    s.easyProxySourceUrl || s.url,
                                    mixdropExtension
                                )
                            );
                            proxiedByEasyProxy = finalStreamUrl !== s.url;
                        }

                        // For Stremio, we reconstruct the legacy multiline format using metadata
                        const nameUI = (s.qualityTag && s.qualityTag !== 'Unknown') ? s.qualityTag : (s.providerName || s.name || 'EasyStreams');
                        const displayTitle = s.originalTitle || s.title || 'Stream';
                        let titleUI = `📁 ${displayTitle}\n${s.providerName || s.name || 'EasyStreams'}`;
                        if (s.description) titleUI += ` | ${s.description}`;
                        if (s.language) {
                            titleUI += `\n🗣️ ${s.language}  🔍EasyStreams`;
                        } else {
                            titleUI += `\n🔍EasyStreams`;
                        }

                        const finalBehaviorHints = {
                            ...(s.behaviorHints || {}),
                            notWebReady: proxiedByEasyProxy ? false : s?.behaviorHints?.notWebReady === true,
                            bingeGroup: name // Consistent grouping by provider name
                        };

                        if (proxiedByEasyProxy) {
                            delete finalBehaviorHints.proxyHeaders;
                            delete finalBehaviorHints.headers;
                        }

                        return {
                            name: nameUI,
                            title: titleUI,
                            url: finalStreamUrl,
                            behaviorHints: finalBehaviorHints,
                            headers: proxiedByEasyProxy ? undefined : (s.headers || s.behaviorHints?.headers || s.behaviorHints?.proxyHeaders?.request),
                            language: s.language
                        };
                    });
                const processedStreamsResolved = await Promise.all(processedStreams);
                processedStreamsCount = processedStreamsResolved.length;

                if (processedStreamsResolved.length > 0) {
                    collectedStreams.push(...processedStreamsResolved);
                }

                return processedStreamsResolved;
            } catch (e) {
                executionError = e;
                console.error(`[${name}] Error:`, e.message);
                return [];
            } finally {
                if (didTimeout) {
                    finalStatus = 'timeout';
                } else if (executionError) {
                    finalStatus = 'error';
                }

                providerBenchmarkResults.push({
                    provider: name,
                    status: finalStatus,
                    elapsedMs: Date.now() - providerStartedAt,
                    rawStreams: rawStreamsCount,
                    processedStreams: processedStreamsCount
                });
            }
        });

        let globalTimeoutId;
        const completionState = await Promise.race([
            Promise.allSettled(providerTasks).then(() => 'completed'),
            new Promise((resolve) => {
                globalTimeoutId = setTimeout(() => resolve('deadline'), requestStreamTimeout);
            })
        ]);

        if (globalTimeoutId) clearTimeout(globalTimeoutId);

        if (completionState === 'deadline') {
            console.warn(`[Stremio] Global response deadline reached (${requestStreamTimeout}ms). Returning partial streams.`);
        }

        const streams = collectedStreams.slice();

        // Sort streams? Maybe by quality or provider preference?
        // For now, just return them all.

        // Filter out streams without URL
        const validStreams = streams.filter(s => s.url);

        if (PROVIDER_BENCHMARK_LOGS && providerBenchmarkResults.length > 0) {
            const requestLabel = `${type}:${id}`;
            const totalMs = Date.now() - providersStartedAt;
            const sortedBench = providerBenchmarkResults
                .slice()
                .sort((a, b) => b.elapsedMs - a.elapsedMs);
            const slowest = sortedBench[0];
            logInfo(`[ProviderBench] ${JSON.stringify({
                kind: 'request',
                request: requestLabel,
                totalMs,
                providers: sortedBench.length,
                slowestProvider: slowest.provider,
                slowestMs: slowest.elapsedMs
            })}`);
            for (const entry of sortedBench) {
                logInfo(`[ProviderBench] ${JSON.stringify({
                    kind: 'provider',
                    request: requestLabel,
                    provider: entry.provider,
                    status: entry.status,
                    elapsedMs: entry.elapsedMs,
                    rawStreams: entry.rawStreams,
                    processedStreams: entry.processedStreams
                })}`);
            }
        }

        // Sort: StreamingCommunity first, then Language (ITA > SUB ITA), then Quality Descending
        validStreams.sort((a, b) => {
            // 1. StreamingCommunity Priority
            const providerA = a.behaviorHints?.bingeGroup || '';
            const providerB = b.behaviorHints?.bingeGroup || '';

            const isA_SC = providerA === 'streamingcommunity';
            const isB_SC = providerB === 'streamingcommunity';

            if (isA_SC && !isB_SC) return -1;
            if (!isA_SC && isB_SC) return 1;

            // 2. Language Priority (ITA > SUB ITA > Others)
            const getLangScore = (stream) => {
                const lang = stream.language || '';
                if (lang === '🇮🇹') return 2;
                if (lang === '🇯🇵') return 1;
                return 0;
            };

            const langScoreA = getLangScore(a);
            const langScoreB = getLangScore(b);

            if (langScoreA !== langScoreB) {
                return langScoreB - langScoreA; // Descending (2 > 1 > 0)
            }

            // 3. Quality Priority
            const qualityOrder = {
                '🔥4K UHD': 10,
                '✨ QHD': 9,
                '🚀 FHD': 8,
                '💿 HD': 7,
                '💩 Low Quality': 1
            };

            const getScore = (str) => {
                if (!str) return 0;
                for (const [k, v] of Object.entries(qualityOrder)) {
                    if (str.includes(k)) return v;
                }
                return 0;
            };

            const scoreA = getScore(a.name);
            const scoreB = getScore(b.name);

            return scoreB - scoreA; // Descending
        });

        logVerbose(`[Stremio] Returning ${validStreams.length} streams total.`);
        const responsePayload = { streams: validStreams };
        if (cacheEnabledForRequest && validStreams.length > 0) {
            setCachedStreamResponse(cacheStorageKey, responsePayload);
            if (cacheStorageKey !== requestKey) {
                setCachedStreamAlias(requestKey, cacheStorageKey);
            }
        } else if (!cacheEnabledForRequest) {
            logVerbose(`[Stremio] Skipping cache for season 0 request: ${requestKey}`);
        } else {
            logVerbose(`[Stremio] Skipping cache for failed/empty result: ${requestKey}`);
        }
        return responsePayload;
    })();

    if (!cacheEnabledForRequest) {
        return streamResolutionPromise;
    }

    inFlightStreamRequests.set(cacheStorageKey, streamResolutionPromise);
    if (cacheStorageKey !== requestKey) {
        inFlightStreamRequests.set(requestKey, streamResolutionPromise);
    }

    try {
        const finalResponse = await streamResolutionPromise;
        return cloneStreamResponse(finalResponse);
    } finally {
        inFlightStreamRequests.delete(cacheStorageKey);
        if (cacheStorageKey !== requestKey) {
            inFlightStreamRequests.delete(requestKey);
        }
    }
});


const addonInterface = builder.getInterface();
const addonRouter = getRouter(addonInterface);

function parseConfigPathParam(value) {
    const raw = String(value || '').trim();
    if (!raw) return {};
    try {
        const decoded = decodeURIComponent(raw);
        const parsed = JSON.parse(decoded);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function sendConfigurePage(res, initialConfig = {}) {
    res.send(renderLandingPage({
        manifest: addonInterface.manifest,
        providerNames: Object.keys(providers),
        initialConfig
    }));
}

function sendManifest(res) {
    const manifest = JSON.parse(JSON.stringify(addonInterface.manifest));
    manifest.behaviorHints = {
        ...(manifest.behaviorHints || {}),
        configurable: true
    };
    res.json(manifest);
}

// Custom Landing Page
app.get('/', (req, res) => {
    sendConfigurePage(res);
});

app.get('/configure', (req, res) => {
    sendConfigurePage(res);
});

app.get('/:config/configure', (req, res) => {
    sendConfigurePage(res, parseConfigPathParam(req.params.config));
});

app.get('/manifest.json', (req, res) => {
    sendManifest(res);
});

app.get('/:config/manifest.json', (req, res) => {
    sendManifest(res);
});

app.use('/', addonRouter);

app.get('/resolve/:provider', async (req, res) => {
    const { provider: providerName } = req.params;
    const { id, type, s, ep, format } = req.query;

    if (!id || !type) {
        return res.status(400).json({ error: 'Missing parameters (id, type)' });
    }

    const provider = providers[providerName];
    if (!provider) {
        return res.status(404).json({ error: `Provider '${providerName}' not found` });
    }

    console.log(`[API] Richiesta remota ${providerName}: ${type} ${id} ${s}x${ep} [format=${format || "streams"}]`);

    try {
        const season = parseInt(s) || 1;
        const episode = parseInt(ep) || 1;

        const requestContext = await resolveProviderRequestContext(type, id, season, episode, 'it');
        const providerContext = buildProviderRequestContext(requestContext);
        if (providerContext) providerContext.format = format || "streams";

        const result = await provider.getStreams(id, type, season, episode, providerContext);

        if (format === 'links') {
            res.json({ links: result.links || [] });
        } else {
            res.json({ streams: Array.isArray(result) ? result : (result.streams || []) });
        }
    } catch (e) {
        console.error(`[API] Errore risoluzione remota ${providerName}:`, e.message);
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 7000;

function loadValidCfSession(provider, maxAgeMs = 2 * 60 * 60 * 1000) {
    try {
        const sessionPath = path.join(process.cwd(), `cf-session-${provider}.json`);
        if (!fs.existsSync(sessionPath)) return null;
        const stat = fs.statSync(sessionPath);
        const data = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
        if (!data || !data.userAgent) return null;
        const timestamp = Number(data.timestamp || 0) || stat.mtimeMs;
        const ageMs = Date.now() - timestamp;
        if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > maxAgeMs) return null;
        return { data, ageMs, sessionPath };
    } catch {
        return null;
    }
}

function hasAnyValidCfSession(providersToCheck) {
    return providersToCheck.some((provider) => loadValidCfSession(provider));
}

function describeValidCfSession(providersToCheck) {
    for (const provider of providersToCheck) {
        const session = loadValidCfSession(provider);
        if (session) {
            return `${provider} (${Math.round(session.ageMs / 60000)} min)`;
        }
    }
    return null;
}

async function warmupGuardoserie() {
    const forceWarmup = String(process.env.FORCE_CF_WARMUP || '').trim().toLowerCase() === '1';
    const validSession = describeValidCfSession(['guardoserie']);
    if (!forceWarmup && validSession) {
        console.log(`[Warmup] Guardoserie saltato: sessione CF valida gia presente (${validSession}).`);
        return;
    }

    try {
        console.log('[Warmup] Riscaldamento Guardoserie...');
        await getClearance('https://guardoserie.run/', 'guardoserie', {
            maxTimeout: readPositiveIntEnv('CF_WARMUP_MAX_TIMEOUT_MS', 35000),
            requestTimeout: readPositiveIntEnv('CF_WARMUP_REQUEST_TIMEOUT_MS', 45000),
            waitUntil: 'network_idle'
        });
        console.log('[Warmup] Guardoserie pronto!');
    } catch (e) {
        console.error(`[Warmup] Errore riscaldamento Guardoserie: ${e.message}`);
    }
}

let server;
(async () => {
    // FlareSolverr startup removed (Scrapling is used on-demand)
    try {
        warmupGuardoserie().catch(e => {
            console.error('[Warmup] Errore critico Guardoserie:', e);
        });
    } catch (e) {
        console.error('[Addon] Errore durante warmup:', e.message);
    }

    server = app.listen(PORT, () => {
        logInfo(`Stremio Addon running at http://localhost:${PORT}`);
    });
})();

// Graceful Shutdown
process.on('SIGTERM', () => {
    logInfo('[Shutdown] SIGTERM received. Closing server...');

    server.close(() => {
        logInfo('[Shutdown] Server closed.');
        httpsAgent.destroy();
        httpAgent.destroy();
        logInfo('[Shutdown] Agents destroyed. Exiting.');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logInfo('[Shutdown] SIGINT received. Closing server...');

    server.close(() => {
        logInfo('[Shutdown] Server closed.');
        httpsAgent.destroy();
        httpAgent.destroy();
        logInfo('[Shutdown] Agents destroyed. Exiting.');
        process.exit(0);
    });
});

process.on('uncaughtException', (err) => {
    console.error('[FATAL] Uncaught Exception:', err.message || err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL] Unhandled Rejection:', reason.message || reason);
});


