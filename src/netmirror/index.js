const { fetchWithTimeout } = require('../fetch_helper.js');
const { checkQualityFromText } = require('../quality_helper.js');
const { formatStream } = require('../formatter.js');

const TMDB_API_KEY = '68e094699525b18a70bab2f86b1fa706';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const CONFIG_URL = 'https://raw.githubusercontent.com/SaurabhKaperwan/Utils/refs/heads/main/urls.json';
const FALLBACK_API_BASE = 'https://tv.imgcdn.kim/newtv';
const FETCH_TIMEOUT = 12000;
const PROBE_TIMEOUT = 5000;

const SERVICES = [
    { code: 'nf', name: 'Netflix' },
    { code: 'pv', name: 'PrimeVideo' },
    { code: 'hs', name: 'Hotstar' }
];

const LANG_ALIASES = {
    it: ['italian', 'italiano', 'ita'],
    en: ['english', 'eng', 'en-us', 'en-gb', 'original'],
    es: ['spanish', 'espanol', 'espanol', 'spa', 'es-419', 'es-la', 'latin'],
    fr: ['french', 'francais', 'fre', 'fra'],
    de: ['german', 'deutsch', 'ger', 'deu'],
    pt: ['portuguese', 'portugues', 'por', 'pt-br', 'pt-pt', 'brazilian'],
    hi: ['hindi', 'hin'],
    ta: ['tamil', 'tam'],
    te: ['telugu', 'tel'],
    ja: ['japanese', 'jpn', 'ja-jp'],
    ko: ['korean', 'kor', 'ko-kr'],
    ar: ['arabic', 'ara'],
    tr: ['turkish', 'turkce', 'tur'],
    ru: ['russian', 'rus'],
    pl: ['polish', 'polski', 'pol'],
    nl: ['dutch', 'nederlands', 'nld', 'nl-nl']
};

let cachedApiBase = null;

function normalizeType(type) {
    const normalized = String(type || '').toLowerCase();
    if (normalized === 'series' || normalized === 'tv') return 'tv';
    if (normalized === 'movie') return 'movie';
    return null;
}

function normalizeText(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function unique(values) {
    return [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))];
}

function normalizeLangToken(token) {
    const value = String(token || '').trim().toLowerCase();
    if (!value) return null;
    const prefix = value.split(/[-_]/)[0];
    if (LANG_ALIASES[value]) return value;
    if (LANG_ALIASES[prefix]) return prefix;
    for (const code of Object.keys(LANG_ALIASES)) {
        if (LANG_ALIASES[code].some(alias => value === alias || value.includes(alias))) return code;
    }
    return null;
}

function parseAudioLanguages(m3u8Text) {
    const languages = new Set();
    if (!m3u8Text) return languages;
    const re = /#EXT-X-MEDIA:([^\n\r]+)/gi;
    let match;
    while ((match = re.exec(m3u8Text)) !== null) {
        const attrs = match[1];
        if (!/TYPE=AUDIO/i.test(attrs)) continue;
        const language = (attrs.match(/LANGUAGE="([^"]+)"/i) || [])[1];
        const name = (attrs.match(/NAME="([^"]+)"/i) || [])[1];
        const code = normalizeLangToken(language) || normalizeLangToken(name);
        if (code) languages.add(code);
    }
    return languages;
}

async function fetchJson(url, options = {}) {
    const response = await fetchWithTimeout(url, { ...options, timeout: options.timeout || FETCH_TIMEOUT });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
}

async function fetchText(url, headers) {
    try {
        const response = await fetchWithTimeout(url, { headers, timeout: PROBE_TIMEOUT });
        if (!response.ok) return '';
        return await response.text();
    } catch {
        return '';
    }
}

async function getApiBase() {
    if (cachedApiBase) return cachedApiBase;
    try {
        const data = await fetchJson(CONFIG_URL, { timeout: FETCH_TIMEOUT });
        cachedApiBase = data && data.nfmirror ? data.nfmirror : FALLBACK_API_BASE;
    } catch {
        cachedApiBase = FALLBACK_API_BASE;
    }
    return cachedApiBase;
}

async function resolveTmdbId(id, mediaType, providerContext) {
    const contextTmdbId = providerContext && /^\d+$/.test(String(providerContext.tmdbId || ''))
        ? String(providerContext.tmdbId)
        : null;
    if (contextTmdbId) return contextTmdbId;

    const raw = String(id || '').trim();
    if (/^tmdb:\d+$/i.test(raw)) return raw.split(':')[1];
    if (/^\d+$/.test(raw)) return raw;

    const contextImdbId = providerContext && /^tt\d+$/i.test(String(providerContext.imdbId || ''))
        ? String(providerContext.imdbId)
        : null;
    const imdbId = /^tt\d+$/i.test(raw) ? raw : contextImdbId;
    if (!imdbId) return null;

    try {
        const url = `${TMDB_BASE_URL}/find/${encodeURIComponent(imdbId)}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
        const data = await fetchJson(url);
        const results = mediaType === 'tv' ? data.tv_results : data.movie_results;
        const fallback = mediaType === 'tv' ? data.movie_results : data.tv_results;
        const item = (Array.isArray(results) && results[0]) || (Array.isArray(fallback) && fallback[0]) || null;
        return item && item.id ? String(item.id) : null;
    } catch {
        return null;
    }
}

async function getMediaDetails(tmdbId, mediaType) {
    const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `${TMDB_BASE_URL}/${endpoint}/${encodeURIComponent(tmdbId)}?api_key=${TMDB_API_KEY}&language=en-US`;
    return await fetchJson(url);
}

function getCandidateTitles(media, mediaType) {
    if (mediaType === 'tv') {
        return unique([media.name, media.original_name]);
    }
    return unique([media.title, media.original_title]);
}

function buildServiceHeaders(service) {
    return {
        ott: service.code,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0 /OS.GatuNewTV v1.0',
        'x-requested-with': 'NetmirrorNewTV v1.0'
    };
}

function findTitleMatch(searchResults, title) {
    const target = normalizeText(title);
    if (!target) return null;
    let match = searchResults.find(item => normalizeText(item && item.t) === target);
    if (match) return match;
    return searchResults.find(item => {
        const candidate = normalizeText(item && item.t);
        return candidate && (candidate.includes(target) || target.includes(candidate));
    }) || null;
}

async function searchService(apiBase, service, titles) {
    const headers = buildServiceHeaders(service);
    for (const title of titles) {
        const searchUrl = `${apiBase}/search.php?s=${encodeURIComponent(title)}`;
        const searchJson = await fetchJson(searchUrl, { headers });
        const results = Array.isArray(searchJson && searchJson.searchResult) ? searchJson.searchResult : [];
        const match = findTitleMatch(results, title);
        if (match && match.id) return { id: match.id, title, headers };
    }
    return null;
}

async function resolveEpisodeId(apiBase, netId, headers, season, episode) {
    const postData = await fetchJson(`${apiBase}/post.php?id=${encodeURIComponent(netId)}`, { headers });
    const seasons = Array.isArray(postData && postData.season) ? postData.season : [];
    const seasonToken = `Season ${Number.parseInt(String(season || 1), 10) || 1}`;
    const seasonEntry = seasons.find(item => item && item.id && String(item.s || '').includes(seasonToken));
    if (!seasonEntry) return null;

    const wantedEpisode = String(Number.parseInt(String(episode || 1), 10) || 1);
    let page = 1;
    while (page < 10) {
        const epData = await fetchJson(`${apiBase}/episodes.php?id=${encodeURIComponent(seasonEntry.id)}&page=${page}`, { headers });
        const list = Array.isArray(epData && epData.episodes) ? epData.episodes : [];
        const match = list.find(item => item && item.id && String(item.ep || '') === wantedEpisode);
        if (match) return match.id;
        if (Number.parseInt(String(epData && epData.nextPageShow || '0'), 10) !== 1) break;
        page++;
    }
    return null;
}

async function extractServiceStreams(apiBase, service, titles, mediaType, season, episode) {
    try {
        const found = await searchService(apiBase, service, titles);
        if (!found) return [];

        let finalId = found.id;
        if (mediaType === 'tv') {
            finalId = await resolveEpisodeId(apiBase, found.id, found.headers, season, episode);
            if (!finalId) return [];
        }

        const playerData = await fetchJson(`${apiBase}/player.php?id=${encodeURIComponent(finalId)}`, { headers: found.headers });
        if (!playerData || !playerData.video_link) return [];

        const referer = playerData.referer || `${apiBase}/`;
        const playbackHeaders = {
            Referer: referer,
            'User-Agent': found.headers['user-agent']
        };
        const probeHeaders = {
            Referer: referer,
            'User-Agent': 'Mozilla/5.0 (Android) ExoPlayer',
            Accept: '*/*',
            'Accept-Encoding': 'identity',
            Connection: 'keep-alive'
        };
        const masterText = await fetchText(playerData.video_link, probeHeaders);
        if (!masterText || !/#EXT-X-STREAM-INF/i.test(masterText)) {
            console.warn(`[NetMirror] ${service.name}: invalid playlist (no video streams), skipping`);
            return [];
        }
        const audioLanguages = parseAudioLanguages(masterText);
        const hasItalian = audioLanguages.has('it');
        const quality = checkQualityFromText(masterText) || '720p';

        return [{
            name: `NetMirror - ${service.name}`,
            title: titles[0] || 'Stream',
            url: playerData.video_link,
            quality: quality,
            type: 'hls',
            language: hasItalian ? 'Italian' : '',
            headers: playbackHeaders,
            behaviorHints: { notWebReady: true },
            provider: 'netmirror'
        }];
    } catch (e) {
        console.warn(`[NetMirror] ${service.name} failed: ${e.message}`);
        return [];
    }
}

function dedupeStreams(streams) {
    const seen = new Set();
    return streams.filter(stream => {
        const key = stream && stream.url;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

async function getStreams(id, type, season, episode, providerContext = null) {
    const mediaType = normalizeType(type);
    if (mediaType !== 'movie' && mediaType !== 'tv') return [];

    const tmdbId = await resolveTmdbId(id, mediaType, providerContext);
    if (!tmdbId) return [];

    try {
        const media = await getMediaDetails(tmdbId, mediaType);
        const titles = getCandidateTitles(media, mediaType);
        if (titles.length === 0) return [];

        const apiBase = await getApiBase();
        const results = await Promise.all(
            SERVICES.map(service => extractServiceStreams(apiBase, service, titles, mediaType, season, episode))
        );
        const streams = dedupeStreams(results.flat());
        const italianStream = streams.find(s => s.language === 'Italian');
        if (italianStream) return [formatStream(italianStream, 'NetMirror')].filter(Boolean);
        if (streams.length > 0) return [formatStream(streams[0], 'NetMirror')].filter(Boolean);
        return [];
    } catch (e) {
        console.error('[NetMirror] Error:', e.message);
        return [];
    }
}

module.exports = { getStreams };
