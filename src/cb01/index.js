const { formatStream } = require('../formatter');
const { checkQualityFromPlaylist } = require('../quality_helper');
const { fetchWithTimeout } = require('../fetch_helper');
const { extractMixDrop, extractMaxStream, extractDeltaBit } = require('../extractors');

const IS_SERVER = typeof process !== 'undefined' && process.versions && process.versions.node;

if (!IS_SERVER) {
    module.exports = {
        getStreams: async (id, type, season, episode) => {
            try {
                const apiUrl = `https://easystreams.realbestia.com/resolve/cb01?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}&s=${season || 1}&ep=${episode || 1}&format=links`;
                const response = await fetch(apiUrl);
                const data = await response.json();
                const rawLinks = data.links || [];
                console.log(`[CB01-Client] Trovati ${rawLinks.length} link dal server.`);
                const streams = [];

                for (const link of rawLinks) {
                    try {
                        const sourceUrl = link.url;
                        const lower = String(sourceUrl || '').toLowerCase();
                        let extracted = null;

                        if (lower.includes('maxstream') || lower.includes('uprot.net')) {
                            extracted = await extractMaxStream(sourceUrl, 'https://cb01uno.run/');
                        } else if (lower.includes('deltabit') || lower.includes('clicka.cc/delta')) {
                            extracted = await extractDeltaBit(sourceUrl, 'https://cb01uno.run/');
                        } else if (lower.includes('mixdrop') || lower.includes('m1xdrop')) {
                            streams.push(formatStream({
                                url: sourceUrl,
                                easyProxySourceUrl: sourceUrl,
                                host: 'mixdrop',
                                name: 'CB01 - mixdrop',
                                title: link.title || 'CB01',
                                quality: link.quality || '720p',
                                type: 'direct'
                            }, 'CB01'));
                            continue;
                        }

                        const items = Array.isArray(extracted) ? extracted : (extracted ? [extracted] : []);
                        for (const item of items) {
                            const streamUrl = typeof item === 'string' ? item : item.url;
                            if (!streamUrl) continue;
                            streams.push(formatStream({
                                url: item.sourceUrl || sourceUrl,
                                easyProxySourceUrl: item.sourceUrl || sourceUrl,
                                host: link.host,
                                headers: typeof item === 'object' ? item.headers : null,
                                name: `CB01 - ${link.host || 'stream'}`,
                                title: link.title || 'CB01',
                                quality: item.quality || link.quality || '720p',
                                type: 'direct'
                            }, 'CB01'));
                        }
                    } catch (err) {
                        console.error(`[CB01-Client] Errore estrazione:`, err.message);
                    }
                }

                return streams;
            } catch (e) {
                console.error('[CB01-Client] API Error:', e.message);
                return [];
            }
        }
    };
    return;
}

const { smartFetch } = require('../utils/cf_handler');
const axios = require('axios');

let solveNumericCaptcha = null;
try {
    solveNumericCaptcha = require('../utils/ocr').solveNumericCaptcha;
} catch (e) {
    console.error('[CB01] Errore caricamento modulo OCR:', e.message);
}

const BASE_URL = 'https://cb01uno.run';
const PROVIDER = 'cb01';
const DISPLAY_NAME = 'CB01';
const TMDB_API_KEY = '68e094699525b18a70bab2f86b1fa706';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const FETCH_TIMEOUT = 25000;
const STEP_BENCH_ENABLED = String(process.env.PROVIDER_STEP_BENCH || '').trim().toLowerCase() === '1';
const TRACE_REDIRECTS_ENABLED = String(process.env.TRACE_CB01_REDIRECTS || '').trim().toLowerCase() === '1';

function traceRedirect(step, data = {}) {
    if (!TRACE_REDIRECTS_ENABLED) return;
    try {
        console.log(`[CB01Trace] ${step}: ${JSON.stringify(data)}`);
    } catch {
        console.log(`[CB01Trace] ${step}`);
    }
}

function decodeEntitiesBasic(str) {
    return String(str || '')
        .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&ndash;|&mdash;|&#8211;|&#8212;/g, '-')
        .replace(/&#215;|&times;/g, 'x')
        .replace(/&#8242;/g, "'");
}

function stripTags(str) {
    return decodeEntitiesBasic(String(str || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function cleanTitleForMatch(str) {
    return decodeEntitiesBasic(str)
        .replace(/\[[^\]]*\]/g, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\s+[-\u2013\u2014]\s+\d+\s*(?:x|\u00d7)\s*[\d/]+.*$/i, ' ')
        .replace(/\b(?:streaming|ita|sub ita|sub-ita|hd|fullhd|uhd|dvd|3d)\b/gi, ' ');
}

function normalizeTitle(str) {
    return cleanTitleForMatch(str)
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
        .trim();
}

function extractYear(str) {
    const match = String(str || '').match(/\b(19\d{2}|20\d{2})\b/);
    return match ? match[1] : '';
}

function resolveUrl(href, base = BASE_URL) {
    try {
        return new URL(decodeEntitiesBasic(href), base).toString();
    } catch {
        return null;
    }
}

async function fetchHtml(url, options = {}) {
    return await smartFetch(url, BASE_URL, {
        provider: options.provider || PROVIDER,
        timeout: options.timeout || FETCH_TIMEOUT,
        headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': `${BASE_URL}/`,
            ...options.headers
        },
        ...options
    });
}

async function fetchTmdbJson(path) {
    try {
        const sep = path.includes('?') ? '&' : '?';
        const url = `https://api.themoviedb.org/3${path}${sep}api_key=${TMDB_API_KEY}&language=it-IT`;
        const response = await fetchWithTimeout(url, { timeout: 10000 });
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

async function resolveTmdbId(id, normalizedType, providerContext = null) {
    const contextTmdbId = providerContext && /^\d+$/.test(String(providerContext.tmdbId || ''))
        ? String(providerContext.tmdbId)
        : null;
    if (contextTmdbId) return contextTmdbId;

    const raw = String(id || '').trim();
    if (/^tmdb:\d+$/i.test(raw)) return raw.replace(/^tmdb:/i, '');
    if (/^\d+$/.test(raw)) return raw;

    if (/^tt\d+$/i.test(raw)) {
        const data = await fetchTmdbJson(`/find/${encodeURIComponent(raw)}?external_source=imdb_id`);
        if (!data) return null;
        if (normalizedType === 'movie' && data.movie_results && data.movie_results[0]) return String(data.movie_results[0].id);
        if (normalizedType !== 'movie' && data.tv_results && data.tv_results[0]) return String(data.tv_results[0].id);
        if (data.movie_results && data.movie_results[0]) return String(data.movie_results[0].id);
        if (data.tv_results && data.tv_results[0]) return String(data.tv_results[0].id);
    }

    return null;
}

function parseCompositeSeriesId(rawId, season, episode) {
    const parsed = {
        id: String(rawId || '').trim(),
        season: Number.isInteger(season) ? season : (Number.parseInt(String(season || ''), 10) || 1),
        episode: Number.isInteger(episode) ? episode : (Number.parseInt(String(episode || ''), 10) || 1)
    };

    const match = parsed.id.match(/^(tt\d+|\d+|tmdb:\d+|kitsu:\d+):(\d+):(\d+)$/i);
    if (!match) return parsed;

    parsed.id = match[1];
    parsed.season = Number.parseInt(match[2], 10) || parsed.season;
    parsed.episode = Number.parseInt(match[3], 10) || parsed.episode;
    return parsed;
}

async function getTmdbInfo(tmdbId, normalizedType) {
    const endpoint = normalizedType === 'movie' ? 'movie' : 'tv';
    const info = await fetchTmdbJson(`/${endpoint}/${encodeURIComponent(tmdbId)}`);
    if (!info) return null;

    let external = null;
    if (normalizedType !== 'movie') {
        external = await fetchTmdbJson(`/tv/${encodeURIComponent(tmdbId)}/external_ids`);
    }

    return {
        id: tmdbId,
        type: normalizedType,
        title: info.title || info.name || '',
        originalTitle: info.original_title || info.original_name || '',
        year: String((info.release_date || info.first_air_date || '').split('-')[0] || ''),
        overview: info.overview || '',
        imdbId: info.imdb_id || (external && external.imdb_id) || null
    };
}

function getMappedRequest(season, episode, providerContext = null) {
    const mappedSeason = Number.parseInt(String(providerContext && (providerContext.mappedSeason || providerContext.season) || season || ''), 10);
    const mappedEpisode = Number.parseInt(String(providerContext && providerContext.mappedEpisode || episode || ''), 10);
    const rawEpisodeNumber = Number.parseInt(String(providerContext && providerContext.rawEpisodeNumber || ''), 10);
    const episodeMode = String(providerContext && providerContext.episodeMode || '').trim().toLowerCase();

    return {
        season: Number.isInteger(mappedSeason) && mappedSeason >= 0 ? mappedSeason : (Number.parseInt(String(season || ''), 10) || 1),
        episode: Number.isInteger(rawEpisodeNumber) && rawEpisodeNumber > 0 && episodeMode === 'absolute'
            ? rawEpisodeNumber
            : (Number.isInteger(mappedEpisode) && mappedEpisode > 0 ? mappedEpisode : (Number.parseInt(String(episode || ''), 10) || 1)),
        titleHints: [
            ...(Array.isArray(providerContext && providerContext.titleHints) ? providerContext.titleHints : []),
            ...(Array.isArray(providerContext && providerContext.mappedTitleHints) ? providerContext.mappedTitleHints : []),
            providerContext && (providerContext.seasonName || providerContext.mappedSeasonName)
        ].filter(Boolean)
    };
}

function isCandidateUrl(url, normalizedType) {
    try {
        const parsed = new URL(url);
        if (parsed.hostname.replace(/^www\./, '') !== new URL(BASE_URL).hostname) return false;
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (normalizedType === 'movie') {
            if (parts.length !== 1) return false;
            return !/^(category|tag|author|page|wp-|serietv|cineblog01hd|register|lostpassword|login|top-rated-film|dmca_report)$/i.test(parts[0]);
        }
        if (parts.length !== 2 || parts[0] !== 'serietv') return false;
        return !/^(category|tag|author|page|wp-|register|lostpassword|login|top-rated-serietv)$/i.test(parts[1]);
    } catch {
        return false;
    }
}

function extractSearchResults(html, normalizedType) {
    const results = [];
    const linkRegex = /<a\b[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = linkRegex.exec(String(html || ''))) !== null) {
        const href = resolveUrl(match[1], normalizedType === 'movie' ? BASE_URL : `${BASE_URL}/serietv/`);
        const title = stripTags(match[2]);
        if (!href || !title) continue;
        if (!isCandidateUrl(href, normalizedType)) continue;
        if (/commenti|login|registrati|password|community/i.test(title)) continue;
        results.push({ url: href, title });
    }

    return Array.from(new Map(results.map(item => [item.url, item])).values());
}

async function searchProvider(info, normalizedType) {
    const queries = [...new Set([info.title, info.originalTitle, ...(info.titleHints || [])]
        .filter(q => q && String(q).trim().length > 1)
        .map(q => String(q).replace(/[^\x00-\x7F]/g, '').trim())
        .filter(q => q.length > 1)
    )].slice(0, 4);

    const searchBase = normalizedType === 'movie' ? BASE_URL : `${BASE_URL}/serietv`;
    const pages = await Promise.all(queries.map(q => fetchHtml(`${searchBase}/?s=${encodeURIComponent(q)}`).catch(() => '')));
    return pages.flatMap(html => extractSearchResults(html, normalizedType));
}

function pageText(html) {
    return stripTags(
        String(html || '')
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>|<\/div>|<\/li>|<\/h\d>|<\/tr>/gi, '\n')
    );
}

function scoreCandidate(candidate, html, info, normalizedType) {
    const candidateNorm = normalizeTitle(candidate.title);
    const wantedNorm = normalizeTitle(info.title);
    const wantedOrigNorm = normalizeTitle(info.originalTitle);
    const text = pageText(html);
    const lowerText = text.toLowerCase();
    let score = 0;

    if (candidateNorm && (candidateNorm === wantedNorm || (wantedOrigNorm && candidateNorm === wantedOrigNorm))) {
        score += 70;
    } else if (candidateNorm && wantedNorm && (candidateNorm.includes(wantedNorm) || wantedNorm.includes(candidateNorm))) {
        score += 45;
    } else if (candidateNorm && wantedOrigNorm && (candidateNorm.includes(wantedOrigNorm) || wantedOrigNorm.includes(candidateNorm))) {
        score += 45;
    } else {
        const wantedWords = cleanTitleForMatch(info.title).toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').split(/\s+/).filter(w => w.length > 3);
        const candidateWords = cleanTitleForMatch(candidate.title).toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').split(/\s+/).filter(w => w.length > 3);
        const hits = wantedWords.filter(w => candidateWords.includes(w)).length;
        if (hits > 0) score += Math.min(35, hits * 15);
    }

    const candidateYear = extractYear(candidate.title);
    if (info.year && (candidateYear === info.year || new RegExp(`\\b${info.year}\\b`).test(text))) score += normalizedType === 'movie' ? 30 : 10;

    if (normalizedType === 'movie') {
        if (/guarda il film|streaming hd|durata/i.test(lowerText)) score += 20;
        if (/serie tv gratis|stagione/i.test(lowerText)) score -= 30;
    } else {
        if (/serie tv gratis|stagione|episodi|tutta la serie/i.test(lowerText)) score += 25;
        if (/guarda il film completo/i.test(lowerText)) score -= 30;
    }

    return score;
}

async function pickCandidate(candidates, info, normalizedType) {
    const unique = Array.from(new Map(candidates.map(c => [c.url, c])).values()).slice(0, 10);
    const checked = await Promise.all(unique.map(async (candidate) => {
        try {
            const html = await fetchHtml(candidate.url);
            return { ...candidate, html, score: scoreCandidate(candidate, html, info, normalizedType) };
        } catch {
            return null;
        }
    }));
    const ranked = checked.filter(Boolean).sort((a, b) => b.score - a.score);
    const best = ranked[0];
    const second = ranked[1];
    if (!best || best.score < 50) return null;
    if (second && best.score - second.score < 15 && best.score < 95) return null;
    return best;
}

function getArticleHtml(html) {
    const match = String(html || '').match(/<article\b[^>]*class=["'][^"']*sequex-post-content[^"']*["'][^>]*>[\s\S]*?<\/article>/i);
    return match ? match[0] : String(html || '');
}

function extractAnchors(html) {
    const anchors = [];
    const regex = /<a\b[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = regex.exec(String(html || ''))) !== null) {
        const href = resolveUrl(match[1]);
        const text = stripTags(match[2]);
        if (href) anchors.push({ text, href, index: match.index, raw: match[0] || '' });
    }
    return anchors;
}

function isHostLink(anchor) {
    const value = `${anchor && anchor.text || ''} ${anchor && anchor.href || ''} ${anchor && anchor.raw || ''}`.toLowerCase();
    return /(stayonline\.pro|uprot\.net|maxstream|mixdrop|m1xdrop|deltabit|clicka\.cc\/(?:delta|mix)|safego\.cc)/i.test(value);
}

function detectHost(anchorOrUrl) {
    const value = typeof anchorOrUrl === 'string'
        ? anchorOrUrl
        : `${anchorOrUrl && anchorOrUrl.text || ''} ${anchorOrUrl && anchorOrUrl.href || ''} ${anchorOrUrl && anchorOrUrl.raw || ''}`;
    const lower = String(value || '').toLowerCase();
    if (lower.includes('deltabit') || lower.includes('clicka.cc/delta')) return 'deltabit';
    if (lower.includes('mixdrop') || lower.includes('m1xdrop') || lower.includes('clicka.cc/mix')) return 'mixdrop';
    if (lower.includes('maxstream') || lower.includes('uprot.net')) return 'maxstream';
    if (lower.includes('stayonline.pro') && lower.includes('mixdrop')) return 'mixdrop';
    if (lower.includes('stayonline.pro')) return 'maxstream';
    return null;
}

function getNearestSectionText(html, index) {
    const source = String(html || '');
    const anchorIndex = Number.isInteger(index) ? index : 0;
    const regex = /<(?:strong|b)\b[^>]*>([\s\S]{0,160}?)<\/(?:strong|b)>/gi;
    let match;
    let nearest = '';

    while ((match = regex.exec(source)) !== null) {
        if (match.index > anchorIndex) break;
        const text = stripTags(match[1]);
        if (/\b(?:streaming|download)\b/i.test(text)) nearest = text;
    }

    return nearest;
}

function getQualityFromSectionText(text) {
    const value = String(text || '').toLowerCase();
    if (!value) return null;
    if (/2160|uhd|4k/.test(value)) return '2160p';
    if (/1080|fullhd|full hd/.test(value)) return '1080p';
    if (/720|\bhd\b|streaming\s+hd|download\s+hd/.test(value)) return '720p';
    if (/576/.test(value)) return '576p';
    if (/480|dvdrip|dvd/.test(value)) return '480p';
    if (/^streaming\s*:?\s*$/i.test(value)) return '480p';
    return null;
}

function inferQuality(anchor, html) {
    const sectionQuality = getQualityFromSectionText(getNearestSectionText(html, anchor && anchor.index));
    if (sectionQuality) return sectionQuality;

    const before = pageText(String(html || '').slice(Math.max(0, (anchor && anchor.index || 0) - 160), anchor && anchor.index || 0));
    const around = `${anchor && anchor.text || ''} ${before}`.toLowerCase();
    if (/2160|uhd|4k/.test(around)) return '2160p';
    if (/1080|fullhd|full hd/.test(around)) return '1080p';
    if (/480/.test(around)) return '480p';
    if (/576/.test(around)) return '576p';
    if (/720|streaming hd|\bhd\b/.test(around)) return '720p';
    return '720p';
}

function findEpisodeOffset(html, season, episode, episodeHints = [], preferLast = false) {
    const source = String(html || '');
    const seasonNum = Number.parseInt(String(season || ''), 10) || 1;
    const episodeNum = Number.parseInt(String(episode || ''), 10) || 1;
    const episodeSeparator = '(?:x|\\u00d7|&#215;|&times;)';
    const candidates = [
        new RegExp(`\\b0?${seasonNum}\\s*${episodeSeparator}\\s*0?${episodeNum}\\b`, 'gi'),
        new RegExp(`stagione\\s*0?${seasonNum}[^\\n<]{0,120}episodio\\s*0?${episodeNum}\\b`, 'gi'),
        new RegExp(`episodio\\s*0?${episodeNum}\\b`, 'gi')
    ];

    for (const hint of episodeHints) {
        const clean = String(hint || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (clean.length > 2) candidates.push(new RegExp(clean, 'gi'));
    }

    for (const regex of candidates) {
        const matches = Array.from(source.matchAll(regex));
        if (matches.length > 0) {
            return preferLast ? matches[matches.length - 1].index : matches[0].index;
        }
    }
    return -1;
}

function extractStreamingLinks(html, normalizedType, season, episode, episodeHints = []) {
    const article = getArticleHtml(html);
    const anchors = extractAnchors(article).filter(isHostLink);
    if (anchors.length === 0) return [];

    let scoped = anchors;
    if (normalizedType !== 'movie') {
        const start = findEpisodeOffset(article, season, episode, episodeHints, true);
        if (start >= 0) {
            const next = findEpisodeOffset(article.slice(start + 20), season, Number(episode) + 1, []);
            const end = next >= 0 ? start + 20 + next : Number.MAX_SAFE_INTEGER;
            const episodeScoped = anchors.filter(a => a.index >= start && a.index < end);
            if (episodeScoped.length > 0) scoped = episodeScoped;
        } else {
            const folderScoped = anchors.filter(a => isUprotFolderUrl(a.href));
            if (folderScoped.length > 0) {
                scoped = folderScoped;
            } else {
                return [];
            }
        }
    }

    const links = scoped
        .map(anchor => ({
            url: anchor.href,
            host: detectHost(anchor),
            quality: inferQuality(anchor, article),
            sourceText: anchor.text
        }))
        .filter(link => link.url && link.host);

    return Array.from(new Map(links.map(link => [`${link.host}:${link.url}`, link])).values()).slice(0, 8);
}

function normalizeHostUrl(url) {
    if (!url) return null;
    return decodeEntitiesBasic(String(url)).trim();
}

function isRedirectorUrl(url) {
    const lower = String(url || '').toLowerCase();
    return lower.includes('uprot.net') || lower.includes('clicka.cc') || lower.includes('safego.cc') || lower.includes('stayonline.pro');
}

function isUprotFolderUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.hostname.toLowerCase().includes('uprot.net') && /^\/(?:msfld|msefld)\//i.test(parsed.pathname);
    } catch {
        return false;
    }
}

function isHardCaptchaRedirector(url) {
    try {
        const parsed = new URL(url);
        if (!parsed.hostname.toLowerCase().includes('uprot.net')) return false;
        return /^\/(?:msei|msfi|mseild|msefd)\//i.test(parsed.pathname);
    } catch {
        return false;
    }
}

function getSeasonEpisodeFromText(text) {
    const value = decodeEntitiesBasic(text || '');
    const patterns = [
        /\bS(?:tagione)?\s*0*(\d{1,3})\s*E(?:pisodio)?\s*0*(\d{1,4})\b/i,
        /\b0*(\d{1,3})\s*[xX\u00d7]\s*0*(\d{1,4})\b/i,
        /\bstagione\s*0*(\d{1,3})\D{0,30}episodio\s*0*(\d{1,4})\b/i
    ];

    for (const pattern of patterns) {
        const match = value.match(pattern);
        if (match) {
            return {
                season: Number.parseInt(match[1], 10),
                episode: Number.parseInt(match[2], 10)
            };
        }
    }
    return null;
}

function getQualityFromText(text, fallback = '720p') {
    const value = String(text || '').toLowerCase();
    if (/2160|uhd|4k/.test(value)) return '2160p';
    if (/1080|fullhd|full hd/.test(value)) return '1080p';
    if (/720|\.hd\.|\bhd\b/.test(value)) return '720p';
    if (/576/.test(value)) return '576p';
    if (/480|dvdrip|dvd/.test(value)) return '480p';
    return fallback || '720p';
}

function extractUprotFolderEntries(html, folderUrl) {
    const entries = [];
    const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(String(html || ''))) !== null) {
        const row = rowMatch[1] || '';
        const text = stripTags(row);
        const parsedEpisode = getSeasonEpisodeFromText(text);
        if (!parsedEpisode) continue;

        const hrefs = [];
        const hrefRegex = /href=["']([^"']+)["']/gi;
        let hrefMatch;
        while ((hrefMatch = hrefRegex.exec(row)) !== null) {
            const resolved = resolveUrl(hrefMatch[1], folderUrl);
            if (resolved) hrefs.push(resolved);
        }

        const watchUrl =
            hrefs.find(href => /\/mse?i\//i.test(href)) ||
            hrefs.find(href => /\/msf/i.test(href)) ||
            null;
        if (!watchUrl) continue;

        entries.push({
            ...parsedEpisode,
            url: watchUrl,
            title: text.replace(/\s+ahah\s+watch\s+download\s*$/i, '').trim(),
            quality: getQualityFromText(text)
        });
    }

    return entries;
}

async function resolveUprotFolderEpisode(url, season, episode) {
    const folderUrl = normalizeHostUrl(url);
    if (!folderUrl || !isUprotFolderUrl(folderUrl)) return null;

    try {
        const html = await smartFetch(folderUrl, 'uprot', {
            provider: 'uprot',
            timeout: FETCH_TIMEOUT,
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': `${BASE_URL}/`,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });
        const entries = extractUprotFolderEntries(html, folderUrl);
        const targetSeason = Number.parseInt(String(season || ''), 10) || 1;
        const targetEpisode = Number.parseInt(String(episode || ''), 10) || 1;
        const exact = entries.find(entry => entry.season === targetSeason && entry.episode === targetEpisode);
        if (exact) return exact;

        const seasonEntries = entries.filter(entry => entry.season === targetSeason);
        const byIndex = seasonEntries[targetEpisode - 1];
        return byIndex || null;
    } catch (e) {
        traceRedirect('folder_error', { url: folderUrl, season, episode, message: e.message });
        return null;
    }
}

function decodeSafeGoUrl(url) {
    try {
        const parsed = new URL(url);
        if (!parsed.hostname.toLowerCase().includes('safego.cc')) return null;
        const encoded = parsed.searchParams.get('url');
        if (!encoded) return null;
        const decoded = Buffer.from(encoded, 'base64').toString('utf8').trim();
        if (/^https?:\/\//i.test(decoded)) return decoded;
    } catch {}
    return null;
}

async function resolveStayOnlineUrl(url) {
    try {
        const parsed = new URL(url);
        if (!parsed.hostname.toLowerCase().includes('stayonline.pro')) return null;
        const match = parsed.pathname.match(/\/([le])\/([a-z0-9]+)\/?/i);
        if (!match) return null;
        const mode = match[1].toLowerCase();
        const code = match[2];
        const endpoint = `${parsed.origin}/ajax/${mode === 'e' ? 'linkEmbedView' : 'linkView'}.php`;
        const body = new URLSearchParams({ id: code }).toString();
        const responseText = await smartFetch(endpoint, 'stayonline', {
            provider: 'stayonline',
            method: 'POST',
            timeout: 20000,
            headers: {
                'User-Agent': USER_AGENT,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': url,
                'Origin': parsed.origin,
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body
        });
        const parsedJson = typeof responseText === 'string' ? JSON.parse(responseText) : responseText;
        const value = parsedJson && parsedJson.data && parsedJson.data.value;
        return /^https?:\/\//i.test(String(value || '')) ? decodeEntitiesBasic(value) : null;
    } catch (e) {
        traceRedirect('stayonline_error', { url, message: e.message });
        return null;
    }
}

function findRedirectorOrHostUrl(text) {
    const regex = /https?:\/\/(?:[^"'<>\\\s]+\.)?(?:deltabit|maxstream|stayonline|uprot|mixdrop|m1xdrop|safego|clicka)\.[a-z]+\/[^"'<>\\\s]+/ig;
    let match;
    while ((match = regex.exec(String(text || ''))) !== null) {
        const candidate = decodeEntitiesBasic(match[0]).replace(/[),.;]+$/, '');
        if (!/\.(?:ico|png|jpe?g|gif|svg|webp|css|js)(?:$|[?#])/i.test(candidate)) return candidate;
    }
    return null;
}

async function solveCaptchaWithSession(url) {
    if (typeof solveNumericCaptcha !== 'function') return null;

    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const getResponse = await axios({
                url,
                method: 'GET',
                timeout: FETCH_TIMEOUT,
                validateStatus: false,
                responseType: 'text',
                headers: {
                    'User-Agent': USER_AGENT,
                    'Referer': `${BASE_URL}/`,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'
                }
            });

            const html = String(getResponse.data || '');
            const captchaMatch = html.match(/<img[^>]+src=["']([^"']*(?:captcha|secure)[^"']*|data:image\/png;base64,[^"']+)["']/i);
            const formMatch = html.match(/<form\b[^>]*method=["']?post["']?[^>]*>([\s\S]*?)<\/form>/i);
            if (!captchaMatch || !formMatch) return null;

            let base64 = '';
            if (/^data:image\/[^;]+;base64,/i.test(captchaMatch[1])) {
                base64 = captchaMatch[1].split(',')[1] || '';
            } else {
                const captchaUrl = new URL(captchaMatch[1], url).toString();
                const imageResponse = await axios({
                    url: captchaUrl,
                    method: 'GET',
                    timeout: FETCH_TIMEOUT,
                    responseType: 'arraybuffer',
                    validateStatus: false,
                    headers: {
                        'User-Agent': USER_AGENT,
                        'Referer': url,
                        'Cookie': (getResponse.headers['set-cookie'] || []).map(cookie => cookie.split(';')[0]).join('; ')
                    }
                });
                base64 = Buffer.from(imageResponse.data).toString('base64');
            }

            const captchaCode = await solveNumericCaptcha(base64);
            if (!/^\d{2,6}$/.test(String(captchaCode || '').trim())) continue;

            const inputs = {};
            const inputRegex = /<input\b[^>]*name=["']([^"']+)["'][^>]*>/gi;
            let inputMatch;
            while ((inputMatch = inputRegex.exec(formMatch[1])) !== null) {
                const inputHtml = inputMatch[0] || '';
                inputs[inputMatch[1]] = decodeEntitiesBasic(inputHtml.match(/\bvalue=["']([^"']*)["']/i)?.[1] || '');
            }

            const captchaFieldName = formMatch[1].match(/name=["']([^"']*(?:captcha|captch|code|response)[^"']*)["']/i)?.[1] || 'captcha';
            inputs[captchaFieldName] = String(captchaCode).trim();

            const formOpen = html.match(/<form\b[^>]*method=["']?post["']?[^>]*>/i)?.[0] || '';
            const action = formOpen.match(/\baction=["']([^"']+)["']/i)?.[1] || url;
            const postUrl = new URL(action, url).toString();
            const cookieHeader = (getResponse.headers['set-cookie'] || []).map(cookie => cookie.split(';')[0]).join('; ');
            const postResponse = await axios({
                url: postUrl,
                method: 'POST',
                data: new URLSearchParams(inputs).toString(),
                timeout: FETCH_TIMEOUT,
                validateStatus: false,
                responseType: 'text',
                headers: {
                    'User-Agent': USER_AGENT,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': url,
                    'Origin': new URL(url).origin,
                    'Cookie': cookieHeader
                }
            });

            const finalUrl = postResponse.request && postResponse.request.res && postResponse.request.res.responseUrl;
            if (finalUrl && finalUrl !== postUrl && !/captcha|verification/i.test(String(postResponse.data || ''))) {
                return finalUrl;
            }

            const foundUrl = findRedirectorOrHostUrl(postResponse.data);
            if (foundUrl) return new URL(foundUrl, postUrl).toString();
        } catch (e) {
            traceRedirect('captcha_session_error', { url, attempt: attempt + 1, message: e.message });
        }
    }

    return null;
}

async function resolveShortlink(url, season = 1, episode = 1) {
    let currentUrl = normalizeHostUrl(url);
    if (!currentUrl) return null;

    const folderEntry = await resolveUprotFolderEpisode(currentUrl, season, episode);
    if (folderEntry && folderEntry.url) {
        traceRedirect('folder_resolved', { from: currentUrl, to: folderEntry.url, season: folderEntry.season, episode: folderEntry.episode });
        return folderEntry.url;
    }

    if (currentUrl.includes('uprot.net/msf/')) {
        currentUrl = currentUrl.replace('/msf/', '/mse/');
    }

    let hops = 0;
    while (hops < 5 && isRedirectorUrl(currentUrl)) {
        hops++;
        traceRedirect('hop_start', { hop: hops, currentUrl });

        const stayOnlineUrl = await resolveStayOnlineUrl(currentUrl);
        if (stayOnlineUrl) {
            traceRedirect('stayonline_resolved', { hop: hops, from: currentUrl, to: stayOnlineUrl });
            currentUrl = stayOnlineUrl;
            if (isHardCaptchaRedirector(currentUrl)) break;
            continue;
        }

        if (isHardCaptchaRedirector(currentUrl)) break;

        const decodedSafeGoUrl = decodeSafeGoUrl(currentUrl);
        if (decodedSafeGoUrl) {
            currentUrl = decodedSafeGoUrl;
            continue;
        }

        try {
            const fetchMeta = {};
            const html = await fetchHtml(currentUrl, {
                provider: (() => {
                    try { return new URL(currentUrl).hostname.split('.')[0]; } catch { return PROVIDER; }
                })(),
                meta: fetchMeta,
                headers: { 'Referer': `${BASE_URL}/` }
            });

            if (fetchMeta.finalUrl && fetchMeta.finalUrl !== currentUrl) {
                currentUrl = fetchMeta.finalUrl;
                if (!isRedirectorUrl(currentUrl)) break;
                continue;
            }

            const captchaMatch = html.match(/<img[^>]+src=["']([^"']*(?:captcha|secure)[^"']*|data:image\/png;base64,[^"']+)["']/i);
            const formMatch = html.match(/<form\b[^>]*method=["']?post["']?[^>]*>([\s\S]*?)<\/form>/i);

            if (captchaMatch && formMatch && typeof solveNumericCaptcha === 'function') {
                const sessionResolvedUrl = await solveCaptchaWithSession(currentUrl);
                if (sessionResolvedUrl) {
                    currentUrl = sessionResolvedUrl;
                    if (!isRedirectorUrl(currentUrl)) break;
                    continue;
                }

                let base64 = '';
                if (/^data:image\/[^;]+;base64,/i.test(captchaMatch[1])) {
                    base64 = captchaMatch[1].split(',')[1] || '';
                } else {
                    const captchaUrl = new URL(captchaMatch[1], currentUrl).toString();
                    const imgData = await smartFetch(captchaUrl, BASE_URL, {
                        provider: PROVIDER,
                        responseType: 'arraybuffer',
                        headers: { 'Referer': currentUrl }
                    });
                    base64 = Buffer.isBuffer(imgData)
                        ? imgData.toString('base64')
                        : Buffer.from(imgData).toString('base64');
                }

                const captchaCode = await solveNumericCaptcha(base64);
                if (captchaCode) {
                    const inputs = {};
                    const inputRegex = /<input\b[^>]*name=["']([^"']+)["'][^>]*>/gi;
                    let inputMatch;
                    while ((inputMatch = inputRegex.exec(formMatch[1])) !== null) {
                        const inputHtml = inputMatch[0] || '';
                        inputs[inputMatch[1]] = decodeEntitiesBasic(inputHtml.match(/\bvalue=["']([^"']*)["']/i)?.[1] || '');
                    }

                    const captchaFieldName = formMatch[1].match(/name=["']([^"']*(?:captcha|captch|code|response)[^"']*)["']/i)?.[1] || 'captcha';
                    inputs[captchaFieldName] = captchaCode;

                    const formOpen = html.match(/<form\b[^>]*method=["']?post["']?[^>]*>/i)?.[0] || '';
                    const action = formOpen.match(/\baction=["']([^"']+)["']/i)?.[1] || currentUrl;
                    const postUrl = new URL(action, currentUrl).toString();
                    const postMeta = {};
                    const postHtml = await smartFetch(postUrl, BASE_URL, {
                        method: 'POST',
                        provider: (() => {
                            try { return new URL(postUrl).hostname.split('.')[0]; } catch { return PROVIDER; }
                        })(),
                        meta: postMeta,
                        headers: {
                            'User-Agent': USER_AGENT,
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Referer': currentUrl,
                            'Origin': new URL(currentUrl).origin
                        },
                        body: new URLSearchParams(inputs).toString()
                    });

                    if (postMeta.finalUrl && postMeta.finalUrl !== currentUrl) {
                        currentUrl = postMeta.finalUrl;
                        if (!isRedirectorUrl(currentUrl)) break;
                        continue;
                    }

                    const finalUrl = findRedirectorOrHostUrl(postHtml);
                    if (finalUrl) {
                        currentUrl = new URL(finalUrl, postUrl).toString();
                        if (!isRedirectorUrl(currentUrl)) break;
                        continue;
                    }
                }
            }

            const linkUrl = findRedirectorOrHostUrl(html);
            if (linkUrl) {
                currentUrl = new URL(linkUrl, currentUrl).toString();
                if (!isRedirectorUrl(currentUrl)) break;
                continue;
            }

            break;
        } catch (e) {
            traceRedirect('error', { hop: hops, currentUrl, message: e.message });
            break;
        }
    }

    return currentUrl;
}

async function extractStreamFromHost(link, displayName, season = 1, episode = 1) {
    let hostUrl = normalizeHostUrl(link && link.url ? link.url : link);
    if (!hostUrl) return [];

    try {
        const folderEntry = await resolveUprotFolderEpisode(hostUrl, season, episode);
        const isFolderEpisode = Boolean(folderEntry && folderEntry.url);
        if (isFolderEpisode) {
            hostUrl = folderEntry.url;
            link = {
                ...(link || {}),
                url: hostUrl,
                host: 'maxstream',
                quality: folderEntry.quality || link && link.quality,
                sourceText: folderEntry.title || link && link.sourceText,
                isFolderEpisode: true
            };
        } else {
            hostUrl = await resolveShortlink(hostUrl, season, episode);
        }
        const host = detectHost(hostUrl) || link && link.host;
        if (!host) return [];

        let extracted = null;
        const lower = String(hostUrl || '').toLowerCase();
        if (lower.includes('mixdrop') || lower.includes('m1xdrop') || lower.includes('clicka.cc/mix')) {
            extracted = await extractMixDrop(hostUrl, `${BASE_URL}/`);
        } else if (lower.includes('maxstream') || lower.includes('uprot.net')) {
            extracted = await extractMaxStream(hostUrl, `${BASE_URL}/`);
        } else if (host === 'deltabit' || lower.includes('deltabit') || lower.includes('clicka.cc/delta')) {
            extracted = await extractDeltaBit(hostUrl, `${BASE_URL}/`);
        }

        const items = Array.isArray(extracted) ? extracted : (extracted ? [extracted] : []);
        if (host === 'mixdrop' && items.length === 0) return [];

        const pageQuality = link && link.quality;
        let quality = pageQuality || '720p';
        let proxySourceUrl = hostUrl;
        let directStreamHeaders = null;

        for (const item of items) {
            const streamUrl = typeof item === 'string' ? item : item.url;
            if (!streamUrl) continue;
            const headers = typeof item === 'object' ? item.headers : null;
            const referer = headers && (headers.Referer || headers.referer || headers.Referrer || headers.referrer);
            if (host === 'maxstream' && item && typeof item === 'object' && item.sourceUrl) {
                proxySourceUrl = item.sourceUrl;
                directStreamHeaders = null;
            }
            if (host === 'deltabit' && referer && String(referer).toLowerCase().includes('deltabit')) {
                proxySourceUrl = referer;
            }
            if (streamUrl.includes('.m3u8')) {
                const detected = await checkQualityFromPlaylist(streamUrl, headers || {});
                if (detected && pageQuality !== '480p') {
                    quality = detected;
                    break;
                }
            }
        }

        if (isRedirectorUrl(proxySourceUrl)) return [];

        return [formatStream({
            url: proxySourceUrl,
            easyProxySourceUrl: proxySourceUrl,
            host,
            headers: directStreamHeaders,
            name: `${DISPLAY_NAME} - ${host}`,
            title: isFolderEpisode && link && link.sourceText ? `${displayName} - ${link.sourceText}` : displayName,
            quality,
            type: 'direct'
        }, DISPLAY_NAME)];
    } catch (e) {
        console.error(`[CB01] Extraction error for ${hostUrl}:`, e.message);
        return [];
    }
}

async function getStreams(id, type, season, episode, providerContext = null) {
    const parsedRequest = parseCompositeSeriesId(id, season, episode);
    id = parsedRequest.id;
    season = parsedRequest.season;
    episode = parsedRequest.episode;

    const benchStart = Date.now();
    const bench = [];
    const mark = (step, meta = {}) => {
        if (STEP_BENCH_ENABLED) bench.push({ step, t: Date.now() - benchStart, ...meta });
    };

    try {
        const requestedType = String(type || '').toLowerCase();
        const normalizedType = requestedType === 'movie' ? 'movie' : 'tv';
        const mappedRequest = getMappedRequest(season, episode, providerContext);
        const tmdbId = await resolveTmdbId(id, normalizedType, providerContext);
        mark('tmdb_id_done', { tmdb: tmdbId || null, type: normalizedType });
        if (!tmdbId) return [];

        const info = await getTmdbInfo(tmdbId, normalizedType);
        mark('tmdb_info_done', { ok: Boolean(info) });
        if (!info || !info.title) return [];
        info.titleHints = mappedRequest.titleHints || [];

        const candidates = await searchProvider(info, normalizedType);
        mark('search_done', { results: candidates.length });
        if (candidates.length === 0) return [];

        const picked = await pickCandidate(candidates, info, normalizedType);
        mark('candidate_done', { ok: Boolean(picked), score: picked && picked.score });
        if (!picked) return [];

        const links = extractStreamingLinks(picked.html, normalizedType, mappedRequest.season, mappedRequest.episode, info.titleHints);
        mark('links_done', { links: links.length });
        if (links.length === 0) return [];

        const displayName = normalizedType === 'movie'
            ? `${info.title}${info.year ? ` (${info.year})` : ''}`
            : `${info.title} ${mappedRequest.season}x${mappedRequest.episode}`;

        const uniqueLinks = Array.from(new Map(links.map(link => [`${link.host}:${link.url}`, link])).values()).slice(0, 6);

        if (providerContext && providerContext.format === 'links') {
            const resolvedLinks = await Promise.all(uniqueLinks.map(async (link) => {
                const folderEntry = await resolveUprotFolderEpisode(link.url, mappedRequest.season, mappedRequest.episode);
                let resolvedUrl = folderEntry && folderEntry.url
                    ? folderEntry.url
                    : await resolveShortlink(link.url, mappedRequest.season, mappedRequest.episode);
                const host = folderEntry ? 'maxstream' : link.host;
                if (resolvedUrl && (host === 'maxstream' || /(?:uprot\.net|maxstream|stayonline\.pro)/i.test(resolvedUrl))) {
                    const extracted = await extractMaxStream(resolvedUrl, `${BASE_URL}/`);
                    const items = Array.isArray(extracted) ? extracted : (extracted ? [extracted] : []);
                    const source = items.find(item => item && typeof item === 'object' && item.sourceUrl);
                    if (source && source.sourceUrl) resolvedUrl = source.sourceUrl;
                } else if (resolvedUrl && host === 'mixdrop') {
                    const extracted = await extractMixDrop(resolvedUrl, `${BASE_URL}/`);
                    const items = Array.isArray(extracted) ? extracted : (extracted ? [extracted] : []);
                    if (items.length === 0) return null;
                }
                return {
                    host,
                    url: resolvedUrl,
                    quality: folderEntry && folderEntry.quality || link.quality,
                    title: folderEntry && folderEntry.title ? `${displayName} - ${folderEntry.title}` : displayName,
                    needsProxy: Boolean(folderEntry || host === 'maxstream')
                };
            }));
            return { links: resolvedLinks.filter(link => link && link.url && !isRedirectorUrl(link.url)) };
        }

        let streams = [];
        for (const link of uniqueLinks) {
            const extractedStreams = await extractStreamFromHost(link, displayName, mappedRequest.season, mappedRequest.episode);
            streams.push(...extractedStreams.filter(Boolean));
        }

        mark('extract_done', { streams: streams.length });
        if (STEP_BENCH_ENABLED) {
            console.log(`[CB01Bench] ${JSON.stringify({ id: String(id), type: String(type), totalMs: Date.now() - benchStart, steps: bench })}`);
        }
        return streams;
    } catch (e) {
        if (STEP_BENCH_ENABLED) {
            console.log(`[CB01Bench] ${JSON.stringify({ id: String(id), type: String(type), totalMs: Date.now() - benchStart, failed: true, steps: bench, error: e.message })}`);
        }
        console.error('[CB01] Error:', e.message);
        return [];
    }
}

async function warmupRedirectors(urls = []) {
    const targets = Array.isArray(urls) ? urls : [];
    const results = [];
    for (const rawUrl of targets) {
        const url = normalizeHostUrl(rawUrl);
        if (!url || !isRedirectorUrl(url)) continue;
        try {
            const resolvedUrl = await resolveShortlink(url);
            results.push({ url, resolvedUrl, ok: Boolean(resolvedUrl && resolvedUrl !== url && !isRedirectorUrl(resolvedUrl)) });
        } catch (e) {
            results.push({ url, error: e.message, ok: false });
        }
    }
    return results;
}

async function discoverRedirectorWarmupUrls(pageUrl, limit = 5) {
    const normalizedPageUrl = normalizeHostUrl(pageUrl);
    if (!normalizedPageUrl) return [];
    const html = await fetchHtml(normalizedPageUrl);
    return extractAnchors(getArticleHtml(html))
        .map((anchor) => normalizeHostUrl(anchor.href))
        .filter((url) => url && isRedirectorUrl(url))
        .filter((url, index, list) => list.indexOf(url) === index)
        .slice(0, Math.max(1, Number.parseInt(String(limit || 5), 10) || 5));
}

module.exports = { getStreams, warmupRedirectors, discoverRedirectorWarmupUrls };
