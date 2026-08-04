const { formatStream } = require('../formatter.js');

const BASE_URL = 'https://www.partite.cc';
const TMDB_API_KEY = '68e094699525b18a70bab2f86b1fa706';

function normalizeId(id) {
    const value = String(id || '').trim();
    const match = value.match(/(tt\d+)/i);
    return match ? match[1] : null;
}

async function resolveImdbId(id, type) {
    const raw = String(id || '').trim();
    const direct = normalizeId(raw);
    if (direct) return direct;
    const match = raw.match(/^tmdb:(\d+)$/i) || raw.match(/^(\d+)$/);
    if (!match) return null;
    try {
        const endpoint = String(type || '').toLowerCase() === 'movie' ? 'movie' : 'tv';
        const response = await fetch(`https://api.themoviedb.org/3/${endpoint}/${match[1]}/external_ids?api_key=${TMDB_API_KEY}`);
        if (!response.ok) return null;
        const data = await response.json();
        return normalizeId(data.imdb_id);
    } catch {
        return null;
    }
}

async function fetchPageTitle(imdbId, isMovie) {
    try {
        const pagePath = isMovie ? `/film/${imdbId}` : `/serie-tv/${imdbId}`;
        const response = await fetch(`${BASE_URL}${pagePath}`);
        if (!response.ok) return null;
        const html = await response.text();
        const match = html.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/i);
        return match ? match[1].replace(/\s+/g, ' ').trim() : null;
    } catch {
        return null;
    }
}

async function getStreams(id, type, season, episode) {
    const imdbId = await resolveImdbId(id, type);
    if (!imdbId) return [];

    const normalizedType = String(type || '').toLowerCase();
    const isMovie = normalizedType === 'movie';
    const effectiveSeason = Number.parseInt(season, 10) || 1;
    const effectiveEpisode = Number.parseInt(episode, 10) || 1;
    const realTitle = await fetchPageTitle(imdbId, isMovie) || 'Partite.cc';
    const candidates = [1, 2, 3, 4, 5].flatMap(server => {
        const basePath = isMovie
            ? `/hls/s${server}/movie/${imdbId}`
            : `/hls/s${server}/serial/${imdbId}/${effectiveSeason}/${effectiveEpisode}`;
        return [
            { server, quality: 1080, playbackUrl: `${BASE_URL}${basePath}/1080/playlist.m3u8` },
            { server, quality: null, playbackUrl: `${BASE_URL}${basePath}/playlist.m3u8` }
        ];
    });

    const available = await Promise.all([1, 2, 3, 4, 5].map(async server => {
        const serverCandidates = candidates.filter(item => item.server === server);
        for (const candidate of serverCandidates) {
            try {
                const response = await fetch(candidate.playbackUrl, {
                    method: 'HEAD',
                    headers: { Referer: `${BASE_URL}/` }
                });
                const contentType = String(response.headers.get('content-type') || '').toLowerCase();
                if (response.ok && (contentType.includes('mpegurl') || contentType.includes('m3u8'))) return candidate;
            } catch {
                // Try fallback URL.
            }
        }
        return null;
    }));

    return available.filter(Boolean).map(({ server, quality, playbackUrl }) => formatStream({
            name: `Partite.cc Server ${server}`,
            title: isMovie ? realTitle : `${realTitle} S${effectiveSeason}E${effectiveEpisode}`,
            url: playbackUrl,
            quality: quality ? `${quality}p` : 'Unknown',
            language: 'Italian',
            type: 'hls',
            behaviorHints: {
                notWebReady: true,
                proxyHeaders: { request: { Referer: `${BASE_URL}/` } }
            }
        }, 'Partite.cc')).filter(Boolean);
}

module.exports = { getStreams };
