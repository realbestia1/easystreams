
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

const IS_PRODUCTION = false;
const VERBOSE_LOGS = true;
const QUIET_PROVIDER_LOGS = true;

const PROVIDER_LOG_PREFIXES = [
    '[GuardaHD]',
    '[Guardoserie]',
    '[Guardaserie]',
    '[AnimeUnity]',
    '[AnimeWorld]',
    '[AnimeSaturn]',
    '[StreamingCommunity]',
    '[QualityHelper]'
];

const originalConsoleLog = console.log.bind(console);
if (IS_PRODUCTION && !VERBOSE_LOGS && QUIET_PROVIDER_LOGS) {
    console.log = (...args) => {
        const first = typeof args[0] === 'string' ? args[0] : '';
        if (first && PROVIDER_LOG_PREFIXES.some((prefix) => first.startsWith(prefix))) {
            return;
        }
        originalConsoleLog(...args);
    };
}

function logInfo(...args) {
    console.log(...args);
}

function logVerbose(...args) {
    if (!VERBOSE_LOGS) return;
    console.log(...args);
}

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

const { addonBuilder, serveHTTP, getRouter } = require('stremio-addon-sdk');
const express = require('express');
const app = express();
const path = require('path');
const DISABLE_MIXDROP_ENV =
    typeof process !== 'undefined' &&
        process &&
        process.env &&
        typeof process.env.DISABLE_MIXDROP === 'string'
        ? process.env.DISABLE_MIXDROP.trim().toLowerCase()
        : '';
const DISABLE_MIXDROP_IN_ADDON = !['0', 'false', 'no', 'off'].includes(DISABLE_MIXDROP_ENV);
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
const FETCH_TIMEOUT = 10000;
const STREAM_RESPONSE_TIMEOUT = 7000;
const DEFAULT_PROVIDER_TIMEOUT = Math.max(1500, STREAM_RESPONSE_TIMEOUT - 500);
const PROVIDER_TIMEOUT = Math.min(DEFAULT_PROVIDER_TIMEOUT, STREAM_RESPONSE_TIMEOUT);
const ANIME_PROVIDER_TIMEOUT = 10000;
const ANIME_STREAM_RESPONSE_TIMEOUT = Math.max(STREAM_RESPONSE_TIMEOUT, ANIME_PROVIDER_TIMEOUT + 1500);
const ENABLE_SERIES_MAPPING_LOOKUP = false;
const ENABLE_ANIME_FALLBACK_ON_SERIES = false;
const ENABLE_ANIME_FALLBACK_ON_MOVIES = false;
const FORCE_ALL_PROVIDERS = false;
const ENABLE_TMDB_ANIME_DETECTION = true;
const TMDB_ANIME_DETECTION_TIMEOUT = 1200;
const TMDB_ANIME_CACHE_TTL = 21600000;
const ADDON_CACHE_ENABLED = true;
const STREAM_CACHE_TTL = 10000;
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

function resolveEasyProxyUrlFromConfig(config = null) {
    return normalizeEasyProxyUrl(config?.easyProxyUrl);
}

function resolveEasyProxyPasswordFromConfig(config = null) {
    return String(config?.easyProxyPassword || '').trim();
}

function getMappingLanguageToken(mappingLanguage) {
    return String(mappingLanguage || '').trim().toLowerCase() === 'it' ? 'it' : 'default';
}

function getEasyProxyToken(easyProxyUrl, easyProxyPassword = '') {
    if (!easyProxyUrl) return 'default';
    return `${easyProxyUrl}:pwd:${easyProxyPassword || ''}`;
}

function buildEasyProxyManifestUrl(easyProxyUrl, easyProxyPassword, streamUrl) {
    const proxyBaseUrl = normalizeEasyProxyUrl(easyProxyUrl);
    const proxyPassword = String(easyProxyPassword || '').trim();
    const normalizedStreamUrl = String(streamUrl || '').trim();
    if (!proxyBaseUrl || !normalizedStreamUrl) return normalizedStreamUrl;
    const passwordQuery = proxyPassword ? `&api_password=${encodeURIComponent(proxyPassword)}` : '';
    return `${proxyBaseUrl}/proxy/hls/manifest.m3u8?d=${encodeURIComponent(normalizedStreamUrl)}&redirect_stream=true${passwordQuery}`;
}

function buildEasyProxyExtractorUrl(easyProxyUrl, easyProxyPassword, host, streamUrl) {
    const proxyBaseUrl = normalizeEasyProxyUrl(easyProxyUrl);
    const proxyPassword = String(easyProxyPassword || '').trim();
    const normalizedHost = String(host || '').trim();
    const normalizedStreamUrl = String(streamUrl || '').trim();
    if (!proxyBaseUrl || !normalizedHost || !normalizedStreamUrl) return normalizedStreamUrl;
    const passwordQuery = proxyPassword ? `&api_password=${encodeURIComponent(proxyPassword)}` : '';
    return `${proxyBaseUrl}/extractor/video.m3u8?host=${encodeURIComponent(normalizedHost)}&url=${encodeURIComponent(normalizedStreamUrl)}&redirect_stream=true${passwordQuery}`;
}

function isMixdropStreamUrl(streamUrl) {
    const normalizedStreamUrl = String(streamUrl || '').trim().toLowerCase();
    return normalizedStreamUrl.includes('mixdrop')
        || normalizedStreamUrl.includes('m1xdrop')
        || normalizedStreamUrl.includes('mxcontent');
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
    return `${proxyBaseUrl}/proxy/stream?d=${normalizedStreamUrl}&redirect_stream=true${passwordQuery}`;
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
    guardaserie: require('./src/guardaserie/index.js'),
    guardoserie: require('./src/guardoserie/index.js'),
    animeunity: require('./src/animeunity/index.js'),
    animeworld: require('./src/animeworld/index.js'),
    animesaturn: require('./src/animesaturn/index.js'),
    streamingcommunity: require('./src/streamingcommunity/index.js'),
};

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
                : ['streamingcommunity', 'guardahd', 'guardoserie'];
        } else if (likelyAnime || ENABLE_ANIME_FALLBACK_ON_MOVIES) {
            plan = ['animeunity', 'animeworld', 'animesaturn', 'guardoserie'];
        } else {
            plan = ['streamingcommunity', 'guardahd', 'guardoserie'];
        }
    } else if (normalizedType === 'anime') {
        plan = ['animeunity', 'animeworld', 'animesaturn', 'guardaserie', 'guardoserie'];
    } else {
        if (isImdbRequest) {
            plan = likelyAnime
                ? ['animeunity', 'animeworld', 'animesaturn', 'guardaserie', 'guardoserie']
                : ['streamingcommunity', 'guardaserie', 'guardoserie'];
        } else if (likelyAnime || ENABLE_ANIME_FALLBACK_ON_SERIES) {
            plan = ['animeunity', 'animeworld', 'animesaturn', 'guardaserie', 'guardoserie'];
        } else {
            plan = ['streamingcommunity', 'guardaserie', 'guardoserie'];
        }
    }

    return [...new Set(plan)].filter((name) => providers[name] && typeof providers[name].getStreams === 'function');
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
            key: 'easyProxyUrl',
            type: 'text',
            title: 'EasyProxy base URL for VixSrc streams'
        },
        {
            key: 'easyProxyPassword',
            type: 'text',
            title: 'EasyProxy API password'
        }
    ]
});

builder.defineStreamHandler(async ({ type, id, config = {} }) => {
    const mappingLanguage = resolveMappingLanguageFromConfig(config);
    const easyProxyUrl = resolveEasyProxyUrlFromConfig(config);
    const easyProxyPassword = resolveEasyProxyPasswordFromConfig(config);
    global.DISABLE_MIXDROP = DISABLE_MIXDROP_IN_ADDON && !easyProxyUrl;
    const requestKey = `${type}:${id}:lang:${getMappingLanguageToken(mappingLanguage)}:proxy:${getEasyProxyToken(easyProxyUrl, easyProxyPassword)}`;
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
        ? `${baseCanonicalCacheKey}:proxy:${getEasyProxyToken(easyProxyUrl, easyProxyPassword)}`
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
        const selectedProviders = getProviderExecutionOrder(type, providerId, requestContext, animeRoutingFlag);
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

                const providerTimeoutMs = Math.min(PROVIDER_TIMEOUT, requestStreamTimeout);

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
                    .map((s) => {
                        let finalStreamUrl = s.url;
                        let proxiedByEasyProxy = false;
                        if (name === 'streamingcommunity') {
                            finalStreamUrl = buildEasyProxyManifestUrl(
                                easyProxyUrl,
                                easyProxyPassword,
                                s.easyProxySourceUrl || s.url
                            );
                            proxiedByEasyProxy = finalStreamUrl !== s.url;
                        } else if (name === 'animeunity') {
                            finalStreamUrl = buildEasyProxyManifestUrl(
                                easyProxyUrl,
                                easyProxyPassword,
                                s.easyProxySourceUrl || s.url
                            );
                            proxiedByEasyProxy = finalStreamUrl !== s.url;
                        } else if (isStreamHgStream(s)) {
                            finalStreamUrl = buildEasyProxyExtractorUrl(
                                easyProxyUrl,
                                easyProxyPassword,
                                'streamhg',
                                s.easyProxySourceUrl || s.url
                            );
                            proxiedByEasyProxy = finalStreamUrl !== s.url;
                        } else if (isMixdropStreamUrl(s.url)) {
                            finalStreamUrl = buildEasyProxyStreamUrl(
                                easyProxyUrl,
                                easyProxyPassword,
                                s.easyProxySourceUrl || s.url
                            );
                            proxiedByEasyProxy = finalStreamUrl !== s.url;
                        }

                        // For Stremio, we reconstruct the legacy multiline format using metadata
                        const nameUI = (s.qualityTag && s.qualityTag !== 'Unknown') ? s.qualityTag : s.providerName;

                        let titleUI = `📁 ${s.originalTitle}\n${s.providerName}`;
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
                processedStreamsCount = processedStreams.length;

                if (processedStreams.length > 0) {
                    collectedStreams.push(...processedStreams);
                }

                return processedStreams;
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

// Custom Landing Page
app.get('/', (req, res) => {
    const manifest = addonInterface.manifest;
    const providerNames = Object.keys(providers);
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
            .config-panel {
                width: 100%;
                margin-bottom: 24px;
                padding: 16px 18px;
                border-radius: 10px;
                border: 1px solid #333;
                background: #232323;
                text-align: left;
                box-sizing: border-box;
            }
            .config-panel-title {
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: #8f8f8f;
                margin-bottom: 12px;
            }
            .config-toggle {
                display: flex;
                align-items: flex-start;
                gap: 12px;
                cursor: pointer;
                color: #f2f2f2;
            }
            .config-panel .config-toggle + .config-toggle {
                margin-top: 14px;
            }
            .config-toggle input {
                margin-top: 2px;
            }
            .config-toggle strong {
                display: block;
                font-size: 14px;
                margin-bottom: 4px;
            }
            .config-toggle span {
                display: block;
                color: var(--text-secondary);
                font-size: 13px;
                line-height: 1.4;
            }
            .config-input {
                width: 100%;
                margin-top: 10px;
                padding: 10px 12px;
                border-radius: 8px;
                border: 1px solid #3a3a3a;
                background: #171717;
                color: #f2f2f2;
                font-size: 14px;
                box-sizing: border-box;
            }
            .config-input::placeholder {
                color: #7a7a7a;
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

                <div class="config-panel">
                    <div class="config-panel-title">General</div>
                    <label class="config-toggle" for="easyCatalogsLangIt">
                        <input type="checkbox" id="easyCatalogsLangIt" name="easyCatalogsLangIt">
                        <div>
                            <strong>EasyCatalogs Mode</strong>
                        </div>
                    </label>
                </div>

                <div class="config-panel">
                    <div class="config-panel-title">EasyProxy</div>
                    <label class="config-toggle" for="easyProxyUrl">
                        <div style="width: 100%;">
                            <strong>EasyProxy URL</strong>
                            <input class="config-input" type="url" id="easyProxyUrl" name="easyProxyUrl" placeholder="https://your-proxy.example.com">
                        </div>
                    </label>
                    <label class="config-toggle" for="easyProxyPassword">
                        <div style="width: 100%;">
                            <strong>EasyProxy Password</strong>
                            <input class="config-input" type="text" id="easyProxyPassword" name="easyProxyPassword" placeholder="your api password (optional)">
                        </div>
                    </label>
                </div>

                <a id="installLink" href="#" class="install-btn">INSTALL ADDON</a>
                <button id="copyLink" type="button" class="copy-btn">📋 Copy Link</button>
            </div>
        </div>

        <div class="footer">
            Powered by <a href="https://github.com/realbestia1/" target="_blank">realbestia</a>
        </div>

        <script>
            // Dynamic Install Link
            const currentHost = window.location.host;
            const protocol = window.location.protocol;
            const installBtn = document.getElementById('installLink');
            const copyBtn = document.getElementById('copyLink');
            const easyCatalogsToggle = document.getElementById('easyCatalogsLangIt');
            const easyProxyUrlInput = document.getElementById('easyProxyUrl');
            const easyProxyPasswordInput = document.getElementById('easyProxyPassword');
            let manifestUrl = '';
            let stremioUrl = '';

            function getConfigPath() {
                const config = {};
                if (easyCatalogsToggle && easyCatalogsToggle.checked) {
                    config.easyCatalogsLangIt = 'on';
                }
                if (easyProxyUrlInput) {
                    let normalizedEasyProxyUrl = easyProxyUrlInput.value.trim();
                    while (normalizedEasyProxyUrl.endsWith('/')) {
                        normalizedEasyProxyUrl = normalizedEasyProxyUrl.slice(0, -1);
                    }
                    if (normalizedEasyProxyUrl) {
                        config.easyProxyUrl = normalizedEasyProxyUrl;
                    }
                }
                if (easyProxyPasswordInput) {
                    const normalizedEasyProxyPassword = easyProxyPasswordInput.value.trim();
                    if (normalizedEasyProxyPassword) {
                        config.easyProxyPassword = normalizedEasyProxyPassword;
                    }
                }
                if (Object.keys(config).length === 0) return '';
                const encodedConfig = encodeURIComponent(JSON.stringify(config));
                return \`/\${encodedConfig}\`;
            }

            function updateInstallLinks() {
                const configPath = getConfigPath();
                manifestUrl = \`\${protocol}//\${currentHost}\${configPath}/manifest.json\`;
                stremioUrl = \`stremio://\${currentHost}\${configPath}/manifest.json\`;
                installBtn.href = stremioUrl;
            }
            if (easyCatalogsToggle) {
                easyCatalogsToggle.addEventListener('change', updateInstallLinks);
            }
            if (easyProxyUrlInput) {
                easyProxyUrlInput.addEventListener('input', updateInstallLinks);
            }
            if (easyProxyPasswordInput) {
                easyProxyPasswordInput.addEventListener('input', updateInstallLinks);
            }
            updateInstallLinks();
            // Copy Link Logic
            copyBtn.addEventListener('click', async () => {
                try {
                    const showCopySuccess = () => {
                        const originalText = copyBtn.innerText;
                        copyBtn.innerText = '? Copied!';
                        copyBtn.style.borderColor = '#4CAF50';
                        copyBtn.style.color = '#4CAF50';
                        
                        setTimeout(() => {
                            copyBtn.innerText = originalText;
                            copyBtn.style.borderColor = '';
                            copyBtn.style.color = '';
                        }, 2000);
                    };

                    if (navigator.clipboard && window.isSecureContext) {
                        await navigator.clipboard.writeText(manifestUrl);
                    } else {
                        const textArea = document.createElement('textarea');
                        textArea.value = manifestUrl;
                        textArea.setAttribute('readonly', '');
                        textArea.style.position = 'fixed';
                        textArea.style.top = '-9999px';
                        textArea.style.left = '-9999px';
                        document.body.appendChild(textArea);
                        textArea.focus();
                        textArea.select();
                        const copied = document.execCommand('copy');
                        document.body.removeChild(textArea);
                        if (!copied) throw new Error('Fallback copy failed');
                    }

                    showCopySuccess();
                } catch (err) {
                    console.error('Failed to copy: ', err);
                }
            });
            
            console.log("Manifest URL:", manifestUrl);
        </script>
    </body>
    </html>
    `;
    res.send(landingHtml);
});

app.use('/', addonRouter);

// API per Nuvio / Client-side
app.get('/resolve/guardoserie', async (req, res) => {
    const { id, type, s, ep } = req.query;
    if (!id || !type) {
        return res.status(400).json({ error: 'Missing parameters (id, type)' });
    }

    console.log(`[API] Richiesta remota Guardoserie: ${type} ${id} ${s}x${ep}`);
    
    try {
        const provider = providers.guardoserie;
        const season = parseInt(s) || 1;
        const episode = parseInt(ep) || 1;
        
        // Risolviamo il contesto (necessario per TMDB/Kitsu mapping)
        const requestContext = await resolveProviderRequestContext(type, id, season, episode, 'it');
        const providerContext = buildProviderRequestContext(requestContext);
        
        const streams = await provider.getStreams(id, type, season, episode, providerContext);
        res.json({ streams });
    } catch (e) {
        console.error('[API] Errore risoluzione remota:', e.message);
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 7000;

// Add warmup logic for providers that need Cloudflare bypass
async function warmup() {
    console.log('[Warmup] Avvio riscaldamento provider...');
    try {
        const { getClearance } = require('./cf_bypass');
        // Riscaldiamo Guardoserie
        await getClearance('https://guardoserie.team', process.env.IN_DOCKER === 'true');
        console.log('[Warmup] Guardoserie pronto!');
    } catch (e) {
        console.error('[Warmup] Errore riscaldamento:', e.message);
    }
}

const server = app.listen(PORT, () => {
    logInfo(`Stremio Addon running at http://localhost:${PORT}`);
    // Avvia warmup in background
    warmup();
});

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
