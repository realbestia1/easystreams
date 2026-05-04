const guardahd = require('./guardahd/index');
const guardoserie = require('./guardoserie/index');
const streamingcommunity = require('./streamingcommunity/index');
const animeunity = require('./animeunity/index');
const animeworld = require('./animeworld/index');
const animesaturn = require('./animesaturn/index');
const cinemacity = require('./cinemacity/index');
const { createTimeoutSignal } = require('./fetch_helper.js');

const TMDB_API_KEY = '68e094699525b18a70bab2f86b1fa706';
const CONTEXT_TIMEOUT = 3000;

async function fetchJsonWithTimeout(url, timeoutMs = CONTEXT_TIMEOUT) {
    if (typeof fetch === 'undefined') return null;

    const timeoutConfig = createTimeoutSignal(timeoutMs);

    try {
        const response = await fetch(url, { signal: timeoutConfig.signal });
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    } finally {
        if (typeof timeoutConfig.cleanup === "function") {
            timeoutConfig.cleanup();
        }
    }
}

async function fetchTmdbIdFromImdb(imdbId, normalizedType) {
    if (!TMDB_API_KEY || !imdbId) return null;
    const url = `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    const payload = await fetchJsonWithTimeout(url);
    if (!payload || typeof payload !== 'object') return null;

    if (normalizedType === 'movie') {
        if (Array.isArray(payload.movie_results) && payload.movie_results.length > 0) {
            return payload.movie_results[0].id;
        }
        if (Array.isArray(payload.tv_results) && payload.tv_results.length > 0) {
            return payload.tv_results[0].id;
        }
    } else {
        if (Array.isArray(payload.tv_results) && payload.tv_results.length > 0) {
            return payload.tv_results[0].id;
        }
        if (Array.isArray(payload.movie_results) && payload.movie_results.length > 0) {
            return payload.movie_results[0].id;
        }
    }

    return null;
}

async function resolveProviderRequestContext(id, type, season, seasonProvided = false) {
    const parsedSeason = Number.parseInt(season, 10);
    const normalizedRequestedSeason =
        Number.isInteger(parsedSeason) && parsedSeason >= 0
            ? parsedSeason
            : null;

    const context = {
        idType: 'raw',
        providerId: String(id || ''),
        requestedSeason: normalizedRequestedSeason,
        seasonProvided: seasonProvided === true,
        kitsuId: null,
        tmdbId: null,
        imdbId: null,
        canonicalSeason: normalizedRequestedSeason
    };

    let rawId = String(id || '');
    try {
        rawId = decodeURIComponent(rawId);
    } catch {
        // keep raw id
    }
    const idStr = rawId.trim();

    try {
        if (idStr.startsWith('tmdb:')) {
            context.idType = 'tmdb';
            const parts = idStr.split(':');
            if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
                context.tmdbId = parts[1];
            }
        } else if (idStr.startsWith('kitsu:')) {
            context.idType = 'kitsu';
            const parts = idStr.split(':');
            if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
                context.kitsuId = parts[1];
            }
        } else if (/^tt\d+$/i.test(idStr)) {
            context.idType = 'imdb';
            context.imdbId = idStr;
            const fallbackTmdbId = await fetchTmdbIdFromImdb(idStr, String(type || '').toLowerCase());
            if (fallbackTmdbId !== null && fallbackTmdbId !== undefined) {
                context.tmdbId = String(fallbackTmdbId);
            }
        } else if (/^\d+$/.test(idStr)) {
            context.idType = 'tmdb-numeric';
            context.tmdbId = idStr;
        }
    } catch {
        // Keep partial context.
    }

    return context;
}

function isLikelyAnimeRequest(type) {
    const normalizedType = String(type || '').toLowerCase();
    return normalizedType === 'anime';
}

function buildProviderRequestContext(context) {
    if (!context) return null;
    return {
        __requestContext: true,
        idType: context.idType,
        providerId: context.providerId,
        requestedSeason: context.requestedSeason,
        seasonProvided: context.seasonProvided === true,
        kitsuId: context.kitsuId,
        tmdbId: context.tmdbId,
        imdbId: context.imdbId
    };
}

function parseCompositeSeriesId(rawId, type, season, episode) {
    const parsed = {
        id: String(rawId || '').trim(),
        season: Number.isInteger(season) ? season : (Number.parseInt(String(season || ''), 10) || null),
        episode: Number.isInteger(episode) ? episode : (Number.parseInt(String(episode || ''), 10) || 1)
    };

    const normalizedType = String(type || '').toLowerCase();
    if (normalizedType === 'movie') return parsed;

    const match = parsed.id.match(/^(tt\d+|\d+|tmdb:\d+|kitsu:\d+):(\d+):(\d+)$/i);
    if (!match) return parsed;

    parsed.id = match[1];
    parsed.season = Number.parseInt(match[2], 10);
    parsed.episode = Number.parseInt(match[3], 10);
    return parsed;
}

async function getStreams(id, type, season, episode) {
    const parsedRequest = parseCompositeSeriesId(id, type, season, episode);
    id = parsedRequest.id;
    season = parsedRequest.season;
    episode = parsedRequest.episode;

    const streams = [];
    const normalizedType = String(type || '').toLowerCase();
    const parsedNormalizedSeason = Number.parseInt(season, 10);
    const normalizedSeason =
        Number.isInteger(parsedNormalizedSeason) && parsedNormalizedSeason >= 0
            ? parsedNormalizedSeason
            : null;
    const normalizedEpisode = Number.isInteger(episode) ? episode : (Number.parseInt(episode, 10) || 1);
    const providerContext = await resolveProviderRequestContext(id, normalizedType, normalizedSeason, false);
    const parsedCanonicalSeason = Number.parseInt(providerContext?.canonicalSeason, 10);
    const effectiveSeason =
        Number.isInteger(parsedCanonicalSeason) && parsedCanonicalSeason >= 0
            ? parsedCanonicalSeason
            : 1;
    const sharedContext = buildProviderRequestContext(providerContext);
    const promises = [];
    const likelyAnime = isLikelyAnimeRequest(normalizedType);

    const isKitsuRequest =
        String(providerContext?.idType || '').toLowerCase() === 'kitsu' ||
        /^kitsu:\d+$/i.test(String(id || '').trim());
    const isImdbRequest =
        String(providerContext?.idType || '').toLowerCase() === 'imdb' ||
        /^tt\d+$/i.test(String(id || '').trim()) ||
        !!(providerContext && providerContext.imdbId && /^tt\d+$/i.test(providerContext.imdbId));
    const selectedProviders = [];
    if (normalizedType === 'movie') {
        if (likelyAnime || isKitsuRequest) {
            selectedProviders.push('animeunity', 'animeworld', 'animesaturn', 'guardoserie', 'streamingcommunity', 'guardahd');
        } else {
            selectedProviders.push('streamingcommunity', 'guardahd', 'guardoserie', 'cinemacity');
        }
    } else if (normalizedType === 'anime') {
        selectedProviders.push('animeunity', 'animeworld', 'animesaturn', 'guardoserie');
    } else if (normalizedType === 'tv' || normalizedType === 'series') {
        if (likelyAnime) {
            selectedProviders.push('animeunity', 'animeworld', 'animesaturn', 'guardoserie');
        } else {
            if (isImdbRequest) {
                selectedProviders.push('streamingcommunity', 'guardoserie', 'cinemacity');
            } else {
                selectedProviders.push('streamingcommunity', 'guardoserie', 'cinemacity');
            }
        }
    } else {
        selectedProviders.push('streamingcommunity', 'guardahd', 'guardoserie', 'cinemacity');
    }

    for (const providerName of [...new Set(selectedProviders)]) {
        if (providerName === 'streamingcommunity') {
            promises.push(
                streamingcommunity.getStreams(id, normalizedType, effectiveSeason, normalizedEpisode, sharedContext)
                    .then(s => ({ provider: 'StreamingCommunity', streams: s, status: 'fulfilled' }))
                    .catch(e => ({ provider: 'StreamingCommunity', error: e, status: 'rejected' }))
            );
            continue;
        }
        if (providerName === 'guardahd') {
            promises.push(
                guardahd.getStreams(id, normalizedType, effectiveSeason, normalizedEpisode)
                    .then(s => ({ provider: 'GuardaHD', streams: s, status: 'fulfilled' }))
                    .catch(e => ({ provider: 'GuardaHD', error: e, status: 'rejected' }))
            );
            continue;
        }
        if (providerName === 'animeunity') {
            promises.push(
                animeunity.getStreams(id, normalizedType, effectiveSeason, normalizedEpisode, sharedContext)
                    .then(s => ({ provider: 'AnimeUnity', streams: s, status: 'fulfilled' }))
                    .catch(e => ({ provider: 'AnimeUnity', error: e, status: 'rejected' }))
            );
            continue;
        }
        if (providerName === 'animeworld') {
            promises.push(
                animeworld.getStreams(id, normalizedType, effectiveSeason, normalizedEpisode, sharedContext)
                    .then(s => ({ provider: 'AnimeWorld', streams: s, status: 'fulfilled' }))
                    .catch(e => ({ provider: 'AnimeWorld', error: e, status: 'rejected' }))
            );
            continue;
        }
        if (providerName === 'animesaturn') {
            promises.push(
                animesaturn.getStreams(id, normalizedType, effectiveSeason, normalizedEpisode, sharedContext)
                    .then(s => ({ provider: 'AnimeSaturn', streams: s, status: 'fulfilled' }))
                    .catch(e => ({ provider: 'AnimeSaturn', error: e, status: 'rejected' }))
            );
            continue;
        }
        if (providerName === 'guardoserie') {
            promises.push(
                guardoserie.getStreams(id, normalizedType, effectiveSeason, normalizedEpisode, sharedContext)
                    .then(s => ({ provider: 'Guardoserie', streams: s, status: 'fulfilled' }))
                    .catch(e => ({ provider: 'Guardoserie', error: e, status: 'rejected' }))
            );
            continue;
        }
        if (providerName === 'cinemacity') {
            promises.push(
                cinemacity.getStreams(id, normalizedType, effectiveSeason, normalizedEpisode, sharedContext)
                    .then(s => ({ provider: 'CinemaCity', streams: s, status: 'fulfilled' }))
                    .catch(e => ({ provider: 'CinemaCity', error: e, status: 'rejected' }))
            );
            continue;
        }
    }

    const results = await Promise.all(promises);
    for (const result of results) {
        if (result.status === 'fulfilled' && result.streams) {
            streams.push(...result.streams);
        }
    }

    return streams;
}

module.exports = { getStreams };
