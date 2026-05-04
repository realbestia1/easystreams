const { formatStream } = require('../formatter');
const { checkQualityFromPlaylist } = require('../quality_helper');
const { smartFetch } = require('../utils/cf_handler');
const { extractMixDrop, extractMaxStream, extractDeltaBit } = require('../extractors');
const { isFlareSolverrBlockedError } = require('../extractors/common');
const fs = require('fs');
const path = require('path');

const IS_SERVER = typeof process !== 'undefined' && process.versions && process.versions.node;

if (!IS_SERVER) {
    module.exports = {
        getStreams: async (id, type, season, episode) => {
            try {
                const apiUrl = `https://easystreams.realbestia.com/resolve/eurostreaming?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}&s=${season || 1}&ep=${episode || 1}&format=links`;
                const response = await fetch(apiUrl);
                const data = await response.json();
                const rawLinks = data.links || [];
                console.log(`[EuroStreaming-Client] Trovati ${rawLinks.length} link dal server.`);
                const streams = [];

                for (const link of rawLinks) {
                    try {
                        console.log(`[EuroStreaming-Client] Estrazione da: ${link.host} (${link.url})`);
                        let extracted = null;
                        const lower = link.url.toLowerCase();
                        if (lower.includes('maxstream') || lower.includes('uprot.net')) {
                            extracted = await extractMaxStream(link.url, 'https://eurostreamings.work/');
                        } else if (lower.includes('deltabit') || lower.includes('clicka.cc/delta') || lower.includes('clicka.cc/adelta')) {
                            extracted = await extractDeltaBit(link.url, 'https://eurostreamings.work/');
                        } else if (lower.includes('mixdrop') || lower.includes('m1xdrop')) {
                            console.log(`[EuroStreaming-Client] MixDrop aggiunto direttamente.`);
                            streams.push({ name: `[EuroStreaming] MixDrop`, url: link.url, quality: 'HD' });
                        }

                        if (extracted) {
                            console.log(`[EuroStreaming-Client] Estrazione riuscita per ${link.host}`);
                            const items = Array.isArray(extracted) ? extracted : [extracted];
                            for (const item of items) {
                                streams.push({
                                    name: `[EuroStreaming] ${link.host}`,
                                    url: item.url,
                                    quality: item.quality || 'HD',
                                    headers: item.headers || {}
                                });
                            }
                        } else if (!lower.includes('mixdrop')) {
                            console.warn(`[EuroStreaming-Client] Estrazione fallita o non supportata per ${link.host}`);
                        }
                    } catch (err) {
                        console.error(`[EuroStreaming-Client] Errore estrazione ${link.host}:`, err.message);
                    }
                }
                console.log(`[EuroStreaming-Client] Totale stream pronti: ${streams.length}`);
                return streams;
            } catch (e) {
                console.error('[EuroStreaming-Client] API Error:', e.message);
                return [];
            }
        }
    };
    return;
}

const BASE_URL = 'https://eurostreamings.work';
const PROVIDER = 'eurostreaming';
const TMDB_API_KEY = '68e094699525b18a70bab2f86b1fa706';

let solveNumericCaptcha = null;
if (IS_SERVER) {
    try {
        solveNumericCaptcha = require('../utils/ocr').solveNumericCaptcha;
    } catch (e) {
        console.error('[EuroStreaming] Errore caricamento modulo OCR:', e.message);
    }
}
const STEP_BENCH_ENABLED = String(process.env.PROVIDER_STEP_BENCH || '').trim().toLowerCase() === '1';
const TRACE_REDIRECTS_ENABLED = String(process.env.TRACE_EURO_REDIRECTS || '').trim().toLowerCase() === '1';

function traceRedirect(step, data = {}) {
    if (!TRACE_REDIRECTS_ENABLED) return;
    try {
        console.log(`[EuroStreamingTrace] ${step}: ${JSON.stringify(data)}`);
    } catch {
        console.log(`[EuroStreamingTrace] ${step}`);
    }
}

function getMappingApiBase() {
    return 'https://animemapping.realbestia.com';
}

function decodeEntitiesBasic(str) {
    return String(str || '')
        .replace(/&#(\d+);/g, (m, dec) => String.fromCharCode(dec))
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#215;|&times;/g, 'x')
        .replace(/&#8211;|&#8212;/g, '-')
        .replace(/&#8217;|&#039;/g, "'");
}

function stripTags(str) {
    return decodeEntitiesBasic(String(str || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function normalizeTitle(str) {
    return decodeEntitiesBasic(str)
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[^a-z0-9]+/g, '');
}

function resolveUrl(href) {
    try {
        return new URL(decodeEntitiesBasic(href), BASE_URL).toString();
    } catch {
        return null;
    }
}

async function fetchHtml(url, options = {}) {
    return await smartFetch(url, BASE_URL, {
        provider: PROVIDER,
        timeout: 25000,
        headers: {
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
        const response = await fetch(url);
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

function normalizeConfigBoolean(value) {
    if (value === true) return true;
    const normalized = String(value || '').trim().toLowerCase();
    return ['1', 'true', 'yes', 'on', 'enabled', 'checked'].includes(normalized);
}

function getMappingLanguage(providerContext = null) {
    const explicit = String(providerContext && providerContext.mappingLanguage || '').trim().toLowerCase();
    if (explicit === 'it') return 'it';
    return normalizeConfigBoolean(providerContext && providerContext.easyCatalogsLangIt) ? 'it' : null;
}

async function fetchMapping(provider, value, season, episode, providerContext = null) {
    try {
        const normalizedProvider = String(provider || '').trim().toLowerCase();
        const mappingApiBase = getMappingApiBase();
        if (!mappingApiBase || !normalizedProvider || !value) return null;
        if (!['imdb', 'tmdb', 'kitsu'].includes(normalizedProvider)) return null;

        const params = new URLSearchParams();
        const parsedSeason = Number.parseInt(String(season || ''), 10);
        const parsedEpisode = Number.parseInt(String(episode || ''), 10);
        if (Number.isInteger(parsedSeason) && parsedSeason >= 0) params.set('s', String(parsedSeason));
        if (Number.isInteger(parsedEpisode) && parsedEpisode > 0) params.set('ep', String(parsedEpisode));
        const mappingLanguage = normalizedProvider === 'kitsu' ? 'it' : getMappingLanguage(providerContext);
        if (mappingLanguage === 'it') params.set('lang', 'it');

        const query = params.toString();
        const url = `${mappingApiBase}/${normalizedProvider}/${encodeURIComponent(String(value).trim())}${query ? `?${query}` : ''}`;
        const response = await fetch(url);
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

function getNested(obj, paths) {
    for (const path of paths) {
        const parts = path.split('.');
        let current = obj;
        for (const part of parts) {
            current = current && current[part];
        }
        if (current !== undefined && current !== null && current !== '') return current;
    }
    return null;
}

function normalizeMappingPayload(payload) {
    if (!payload || typeof payload !== 'object') return null;
    const ids = payload.ids || (payload.mappings && payload.mappings.ids) || {};
    const tmdbId = getNested(payload, ['tmdbId', 'tmdb_id', 'tmdb', 'mappings.tmdbId', 'mappings.tmdb_id']) || ids.tmdb;
    const imdbId = getNested(payload, ['imdbId', 'imdb_id', 'imdb', 'mappings.imdbId', 'mappings.imdb_id']) || ids.imdb;
    const season = getNested(payload, ['season', 'mappedSeason', 'mappings.season', 'mappings.mappedSeason']);
    const episode = getNested(payload, ['episode', 'mappedEpisode', 'mappings.episode', 'mappings.mappedEpisode']);
    const tmdbEpisode = payload.tmdb_episode || payload.tmdbEpisode || (payload.mappings && (payload.mappings.tmdb_episode || payload.mappings.tmdbEpisode)) || null;
    const mappedSeason = Number.parseInt(String(season || (tmdbEpisode && (tmdbEpisode.season || tmdbEpisode.season_number)) || ''), 10);
    const mappedEpisode = Number.parseInt(String(episode || (tmdbEpisode && (tmdbEpisode.episode || tmdbEpisode.episode_number)) || ''), 10);
    const rawEpisodeNumber = Number.parseInt(String(tmdbEpisode && (tmdbEpisode.rawEpisodeNumber || tmdbEpisode.raw_episode_number || tmdbEpisode.rawEpisode) || payload.rawEpisodeNumber || ''), 10);
    return {
        tmdbId: /^\d+$/.test(String(tmdbId || '').trim()) ? String(tmdbId).trim() : null,
        imdbId: /^tt\d+$/i.test(String(imdbId || '').trim()) ? String(imdbId).trim() : null,
        mappedSeason: Number.isInteger(mappedSeason) && mappedSeason >= 0 ? mappedSeason : null,
        mappedEpisode: Number.isInteger(mappedEpisode) && mappedEpisode > 0 ? mappedEpisode : null,
        rawEpisodeNumber: Number.isInteger(rawEpisodeNumber) && rawEpisodeNumber > 0 ? rawEpisodeNumber : null,
        seasonName: payload.seasonName || payload.mappedSeasonName || null,
        titleHints: Array.isArray(payload.titleHints) ? payload.titleHints.filter(Boolean) : [],
        longSeries: payload.longSeries === true,
        episodeMode: String(payload.episodeMode || '').trim().toLowerCase() || null
    };
}

async function resolveMappedRequest(id, normalizedType, season, episode, providerContext) {
    const mapped = {
        tmdbId: providerContext && /^\d+$/.test(String(providerContext.tmdbId || '')) ? String(providerContext.tmdbId) : null,
        imdbId: providerContext && /^tt\d+$/i.test(String(providerContext.imdbId || '')) ? String(providerContext.imdbId) : null,
        season: Number.parseInt(String(providerContext && (providerContext.mappedSeason || providerContext.season) || season || ''), 10),
        episode: Number.parseInt(String(episode || ''), 10) || 1,
        titleHints: [
            ...(Array.isArray(providerContext && providerContext.titleHints) ? providerContext.titleHints : []),
            ...(Array.isArray(providerContext && providerContext.mappedTitleHints) ? providerContext.mappedTitleHints : [])
        ].filter(Boolean),
        seasonName: providerContext && (providerContext.seasonName || providerContext.mappedSeasonName) || null,
        longSeries: providerContext && providerContext.longSeries === true,
        episodeMode: String(providerContext && providerContext.episodeMode || '').trim().toLowerCase() || null
    };
    if (!Number.isInteger(mapped.season) || mapped.season < 0) mapped.season = Number.parseInt(String(season || ''), 10) || 1;

    const raw = String(id || '').trim();
    let provider = null;
    let value = null;
    if (/^kitsu:\d+$/i.test(raw)) {
        provider = 'kitsu';
        value = raw.replace(/^kitsu:/i, '');
    } else if (/^tt\d+$/i.test(raw)) {
        provider = 'imdb';
        value = raw;
    } else if (/^tmdb:\d+$/i.test(raw)) {
        provider = 'tmdb';
        value = raw.replace(/^tmdb:/i, '');
    } else if (/^\d+$/.test(raw)) {
        provider = 'tmdb';
        value = raw;
    } else if (mapped.tmdbId) {
        provider = 'tmdb';
        value = mapped.tmdbId;
    }

    const shouldMap =
        provider === 'kitsu' ||
        normalizedType !== 'movie' ||
        normalizedType === 'anime' ||
        (provider && (providerContext && (providerContext.mappingLanguage || providerContext.easyCatalogsLangIt || providerContext.longSeries)));
    if (shouldMap && provider && value) {
        const payload = await fetchMapping(provider, value, season, episode, providerContext);
        const normalized = normalizeMappingPayload(payload);
        if (normalized) {
            if (normalized.tmdbId) mapped.tmdbId = normalized.tmdbId;
            if (normalized.imdbId) mapped.imdbId = normalized.imdbId;
            if (normalized.mappedSeason !== null) mapped.season = normalized.mappedSeason;
            if (normalized.mappedEpisode) mapped.episode = normalized.mappedEpisode;
            if (normalized.rawEpisodeNumber && (normalized.longSeries || normalized.episodeMode === 'absolute')) {
                mapped.episode = normalized.rawEpisodeNumber;
            }
            if (normalized.seasonName) mapped.seasonName = normalized.seasonName;
            mapped.titleHints.push(...normalized.titleHints);
            if (normalized.longSeries) mapped.longSeries = true;
            if (normalized.episodeMode) mapped.episodeMode = normalized.episodeMode;
        }
    }

    if (mapped.longSeries && mapped.episodeMode === 'absolute') {
        const requestedEpisode = Number.parseInt(String(episode || ''), 10);
        if (Number.isInteger(requestedEpisode) && requestedEpisode > 0 && mapped.episode === requestedEpisode) {
            mapped.season = 1;
        }
    }

    mapped.titleHints = [...new Set(mapped.titleHints.map(x => String(x).trim()).filter(Boolean))];
    return mapped;
}

async function resolveTmdbId(id, normalizedType, providerContext, mappedRequest = null) {
    if (mappedRequest && mappedRequest.tmdbId) return mappedRequest.tmdbId;
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
        if (data.tv_results && data.tv_results[0]) return String(data.tv_results[0].id);
    }

    return null;
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
        type: normalizedType === 'movie' ? 'movie' : 'tv',
        title: info.title || info.name || '',
        originalTitle: info.original_title || info.original_name || '',
        year: String((info.release_date || info.first_air_date || '').split('-')[0] || ''),
        overview: info.overview || '',
        numberOfEpisodes: info.number_of_episodes || null,
        numberOfSeasons: info.number_of_seasons || null,
        imdbId: info.imdb_id || (external && external.imdb_id) || null
    };
}

async function getEpisodeGroupHints(tmdbId, season, episode) {
    const hints = [];
    const groups = await fetchTmdbJson(`/tv/${encodeURIComponent(tmdbId)}/episode_groups`);
    if (!groups || !Array.isArray(groups.results)) return hints;

    const groupIds = groups.results
        .filter(g => [1, 3, 4, 6].includes(Number(g.type)) || /absolute|dvd|arc|saga|season/i.test(String(g.name || '')))
        .slice(0, 8)
        .map(g => g.id)
        .filter(Boolean);

    const details = await Promise.all(groupIds.map(id => fetchTmdbJson(`/tv/episode_group/${encodeURIComponent(id)}`).catch(() => null)));
    for (const detail of details.filter(Boolean)) {
        for (const group of (detail.groups || [])) {
            const order = Number.parseInt(String(group.order || group.season_number || ''), 10);
            if (Number.isInteger(order) && order > 0 && order !== Number(season)) continue;
            const episodes = Array.isArray(group.episodes) ? group.episodes : [];
            const ep = episodes.find(item => Number(item.order) === Number(episode) || Number(item.episode_number) === Number(episode));
            if (ep && ep.name) hints.push(ep.name);
        }
    }
    return [...new Set(hints.filter(Boolean))];
}

function extractSearchResults(html) {
    const results = [];
    const linkRegex = /<a\b[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
        const href = resolveUrl(match[1]);
        const title = stripTags(match[2]);
        if (!href || !title) continue;
        if (!href.startsWith(`${BASE_URL}/`)) continue;
        if (/\/(?:category|tag|author|page|wp-|nuovi-ep|film\/?$|elenco|richieste|istruzioni)/i.test(href)) continue;
        results.push({ url: href, title });
    }
    return Array.from(new Map(results.map(item => [item.url, item])).values());
}

async function searchProvider(info) {
    const queries = [...new Set([info.title, info.originalTitle, ...(info.titleHints || [])]
        .filter(q => q && q.length > 1)
        .map(q => q.replace(/[^\x00-\x7F]/g, '').trim()) // Rimuovi caratteri non-ASCII
        .filter(q => q.length > 1)
    )].slice(0, 3);
    const pages = await Promise.all(queries.map(q => fetchHtml(`${BASE_URL}/?s=${encodeURIComponent(q)}`).catch(() => '')));
    return pages.flatMap(extractSearchResults);
}

function pageText(html) {
    return stripTags(
        String(html || '')
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>|<\/div>|<\/li>|<\/h\d>/gi, '\n')
    );
}

function scoreCandidate(candidate, html, info) {
    const titleScore = normalizeTitle(candidate.title);
    const wanted = normalizeTitle(info.title);
    const wantedOrig = normalizeTitle(info.originalTitle);
    const text = pageText(html);
    const lowText = text.toLowerCase();
    let score = 0;
    const titleClean = decodeEntitiesBasic(candidate.title).toLowerCase().replace(/[^a-z0-9\s]+/g, ' ');
    const wantedClean = info.title.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ');
    const wantedOrigClean = (info.originalTitle || '').toLowerCase().replace(/[^a-z0-9\s]+/g, ' ');

    if (titleScore && (titleScore === wanted || (wantedOrig && titleScore === wantedOrig))) {
        score += 60;
    } else if (titleScore && wanted && (titleScore.includes(wanted) || wanted.includes(titleScore))) {
        score += 40;
    } else if (titleScore && wantedOrig && (titleScore.includes(wantedOrig) || wantedOrig.includes(titleScore))) {
        score += 40;
    } else {
        const w1 = wantedClean.split(/\s+/).filter(w => w.length > 3);
        const w2 = titleClean.split(/\s+/).filter(w => w.length > 3);
        const intersection = w1.filter(w => w2.includes(w));
        if (intersection.length > 0) score += 25 * intersection.length;
    }

    if (info.year && new RegExp(`\\b${info.year}\\b`).test(text)) score += 30;

    if (info.type === 'tv') {
        if (/serie tv|prima stagione|stagione|episodi|1\s*[x×]\s*0?1/i.test(lowText)) score += 30;
        if (/streaming film|film in streaming/i.test(lowText)) score -= 40;
    } else {
        if (/streaming film|film in streaming/i.test(lowText)) score += 30;
        if (/prima stagione|stagione/i.test(lowText)) score -= 40;
    }

    return score;

    if (info.overview) {
        const words = info.overview.toLowerCase().replace(/[^a-z0-9à-ÿ ]/gi, ' ').split(/\s+/).filter(w => w.length > 5).slice(0, 15);
        const hits = words.filter(w => lowText.includes(w)).length;
        if (hits >= 2) score += Math.min(20, hits * 4);
    }

    return score;
}

async function pickCandidate(candidates, info) {
    const unique = Array.from(new Map(candidates.map(c => [c.url, c])).values()).slice(0, 8);
    const checked = await Promise.all(unique.map(async (candidate) => {
        try {
            const html = await fetchHtml(candidate.url);
            return { ...candidate, html, score: scoreCandidate(candidate, html, info) };
        } catch {
            return null;
        }
    }));
    const ranked = checked.filter(Boolean).sort((a, b) => b.score - a.score);
    if (info.year) {
        const wanted = normalizeTitle(info.title);
        const wantedOrig = normalizeTitle(info.originalTitle);
        const yearMatch = ranked.find((candidate) => {
            const haystack = `${candidate.title || ''} ${candidate.url || ''}`.toLowerCase();
            const normalizedCandidate = normalizeTitle(candidate.title || candidate.url || '');
            return haystack.includes(String(info.year)) &&
                (
                    normalizedCandidate.includes(wanted) ||
                    (wantedOrig && normalizedCandidate.includes(wantedOrig)) ||
                    (wanted && wanted.includes(normalizedCandidate.replace(String(info.year), '')))
                );
        });
        if (yearMatch && yearMatch.score >= 40) return yearMatch;
    }
    const best = ranked[0];
    const second = ranked[1];
    if (!best || best.score < 50) return null;
    if (second && best.score - second.score < 15 && best.score < 95) return null;
    return best;
}

function extractAnchors(html) {
    const anchors = [];
    const regex = /<a\b[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
        const href = resolveUrl(match[1]);
        const text = stripTags(match[2]);
        if (href) anchors.push({ text, href, index: match.index, raw: match[0] || '' });
    }
    return anchors;
}

function isHostLink(anchor) {
    const value = `${anchor.text} ${anchor.href}`.toLowerCase();
    return /(maxstream|stayonline|uprot|deltabit|clicka\.cc\/(?:adelta|delta|mix)|mixdrop|m1xdrop)/i.test(value);
}

function detectHost(anchorOrUrl) {
    const value = typeof anchorOrUrl === 'string'
        ? anchorOrUrl
        : `${anchorOrUrl && anchorOrUrl.text || ''} ${anchorOrUrl && anchorOrUrl.href || ''} ${anchorOrUrl && anchorOrUrl.raw || ''}`;
    const lower = String(value || '').toLowerCase();
    if (lower.includes('deltabit') || lower.includes('clicka.cc/delta') || lower.includes('clicka.cc/adelta')) return 'deltabit';
    if (lower.includes('mixdrop') || lower.includes('m1xdrop') || lower.includes('clicka.cc/mix')) return 'mixdrop';
    if (lower.includes('maxstream') || lower.includes('stayonline.pro') || lower.includes('uprot.net')) return 'maxstream';
    return null;
}

function isRedirectorUrl(url) {
    const lower = String(url || '').toLowerCase();
    return lower.includes('uprot.net') || lower.includes('clicka.cc') || lower.includes('safego.cc');
}

function getUrlHost(url) {
    try {
        return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
        return '';
    }
}

function getRootDomain(host) {
    const parts = String(host || '').toLowerCase().replace(/^www\./, '').split('.').filter(Boolean);
    return parts.length >= 2 ? parts.slice(-2).join('.') : parts.join('.');
}

function domainMatchesHost(domain, host) {
    const cookieDomain = String(domain || '').toLowerCase().replace(/^\./, '').replace(/^www\./, '');
    const targetHost = String(host || '').toLowerCase().replace(/^www\./, '');
    if (!cookieDomain || !targetHost) return false;
    return targetHost === cookieDomain ||
        targetHost.endsWith(`.${cookieDomain}`) ||
        cookieDomain.endsWith(`.${targetHost}`);
}

function getWarmupFinalHostProvider(url) {
    const lower = String(url || '').toLowerCase();
    if (lower.includes('maxstream.video')) return 'maxstream';
    if (lower.includes('stayonline.pro')) return 'stayonline';
    return null;
}

async function warmupFinalHostSession(url) {
    const normalizedUrl = normalizeHostUrl(url);
    const provider = getWarmupFinalHostProvider(normalizedUrl);
    if (!normalizedUrl || !provider) {
        return { attempted: false, ok: true, provider: null };
    }

    try {
        await smartFetch(normalizedUrl, provider, {
            provider,
            timeout: 30000,
            headers: {
                'Referer': `${BASE_URL}/`,
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });
        return { attempted: true, ok: true, provider };
    } catch (e) {
        return { attempted: true, ok: false, provider, error: e.message };
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

function findEpisodeOffset(html, season, episode, episodeHints = []) {
    const candidates = [
        new RegExp(`${season}\\s*[x×]\\s*0?${episode}\\b`, 'i'),
        new RegExp(`stagione\\s*${season}[^\\n<]{0,80}episodio\\s*0?${episode}\\b`, 'i')
    ];
    for (const hint of episodeHints) {
        const clean = String(hint || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (clean.length > 2) candidates.push(new RegExp(clean, 'i'));
    }
    for (const regex of candidates) {
        const match = regex.exec(decodeEntitiesBasic(html));
        if (match) return match.index;
    }
    return -1;
}

function extractEpisodeLinks(html, season, episode, episodeHints = []) {
    const anchors = extractAnchors(html).filter(isHostLink);
    if (anchors.length === 0) return [];

    const start = findEpisodeOffset(html, season, episode, episodeHints);
    if (start >= 0) {
        const next = findEpisodeOffset(html.slice(start + 20), season, Number(episode) + 1, []);
        const end = next >= 0 ? start + 20 + next : Number.MAX_SAFE_INTEGER;
        const scoped = anchors.filter(a => a.index >= start && a.index < end);
        if (scoped.length > 0) return scoped.map(a => ({ url: a.href, host: detectHost(a) })).filter(x => x.host);
    }

    const ep = Number.parseInt(String(episode || ''), 10) || 1;
    const perEpisode = Math.max(1, Math.round(anchors.length / Math.max(ep, 1)));
    return anchors.slice((ep - 1) * perEpisode, ep * perEpisode)
        .map(a => ({ url: a.href, host: detectHost(a) }))
        .filter(x => x.host);
}

function normalizeHostUrl(url) {
    if (!url) return null;
    return decodeEntitiesBasic(String(url)).trim();
}

function makeEuroStreamingStream(link, displayName) {
    const sourceUrl = normalizeHostUrl(link && link.url);
    const host = link && link.host || detectHost(sourceUrl);
    if (!sourceUrl || !host) return null;

    return formatStream({
        url: sourceUrl,
        name: `[EuroStreaming] ${host}`,
        originalTitle: displayName,
        providerName: 'eurostreaming'
    });
}

async function resolveShortlink(url) {
    console.log(`[EuroStreaming] Tentativo di risoluzione link breve: ${url}`);
    traceRedirect('start', { url });

    // Normalizzazione rapida per MaxStream/uprot
    if (url.includes('uprot.net/msf/')) {
        traceRedirect('normalize_uprot_msf', { from: url, to: url.replace('/msf/', '/mse/') });
        url = url.replace('/msf/', '/mse/');
    }

    let currentUrl = url;
    let hops = 0;

    while (hops < 4 && isRedirectorUrl(currentUrl)) {
        hops++;
        traceRedirect('hop_start', { hop: hops, currentUrl });
        try {
            const decodedSafeGoUrl = decodeSafeGoUrl(currentUrl);
            if (decodedSafeGoUrl) {
                traceRedirect('decoded_safego_url', { hop: hops, from: currentUrl, to: decodedSafeGoUrl });
                currentUrl = decodedSafeGoUrl;
                if (!isRedirectorUrl(currentUrl)) break;
                continue;
            }

            const fetchMeta = {};
            const html = await fetchHtml(currentUrl, { meta: fetchMeta });
            traceRedirect('fetch_done', {
                hop: hops,
                currentUrl,
                finalUrl: fetchMeta.finalUrl || null,
                htmlLength: typeof html === 'string' ? html.length : null
            });
            if (fetchMeta.finalUrl && fetchMeta.finalUrl !== currentUrl && !isRedirectorUrl(fetchMeta.finalUrl)) {
                traceRedirect('final_url_non_redirector', { hop: hops, finalUrl: fetchMeta.finalUrl });
                currentUrl = fetchMeta.finalUrl;
                break;
            }
            if (fetchMeta.finalUrl && fetchMeta.finalUrl !== currentUrl && isRedirectorUrl(fetchMeta.finalUrl)) {
                traceRedirect('final_url_redirector', { hop: hops, finalUrl: fetchMeta.finalUrl });
                currentUrl = fetchMeta.finalUrl;
                continue;
            }

            // 1. Controllo se c'è un captcha numerico (comune su clicka e uprot)
            const captchaMatch = html.match(/<img[^>]+src=["']([^"']*(?:captcha|secure)[^"']*|data:image\/png;base64,[^"']+)["']/i);
            const formMatch = html.match(/<form\b[^>]*method=["']?post["']?[^>]*>([\s\S]*?)<\/form>/i);

            if (captchaMatch && formMatch) {
                console.log(`[EuroStreaming] Captcha numerico rilevato per ${currentUrl}. Risoluzione in corso...`);
                traceRedirect('captcha_detected', {
                    hop: hops,
                    currentUrl,
                    inlineImage: /^data:image\//i.test(captchaMatch[1] || '')
                });
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
                    console.log(`[EuroStreaming] Captcha risolto: ${captchaCode}. Sblocco link...`);
                    traceRedirect('captcha_solved', { hop: hops, currentUrl, codeLength: String(captchaCode).length });
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
                    const postBody = new URLSearchParams(inputs).toString();
                    const postMeta = {};
                    traceRedirect('captcha_post_start', {
                        hop: hops,
                        postUrl,
                        fieldNames: Object.keys(inputs)
                    });
                    const postHtml = await smartFetch(postUrl, BASE_URL, {
                        method: 'POST',
                        provider: PROVIDER,
                        meta: postMeta,
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Referer': currentUrl,
                            'Origin': new URL(currentUrl).origin
                        },
                        body: postBody
                    });
                    traceRedirect('captcha_post_done', {
                        hop: hops,
                        postUrl,
                        finalUrl: postMeta.finalUrl || null,
                        htmlLength: typeof postHtml === 'string' ? postHtml.length : null
                    });

                    if (postMeta.finalUrl && postMeta.finalUrl !== currentUrl) {
                        traceRedirect('captcha_post_final_url', { hop: hops, finalUrl: postMeta.finalUrl });
                        currentUrl = postMeta.finalUrl;
                        if (!isRedirectorUrl(currentUrl)) break;
                        continue;
                    }

                    const finalUrl = findRedirectorOrHostUrl(postHtml);
                    if (finalUrl) {
                        traceRedirect('captcha_post_found_url', { hop: hops, finalUrl });
                        currentUrl = finalUrl;
                        if (!isRedirectorUrl(currentUrl)) break; // Found final host
                        continue;
                    }
                    traceRedirect('captcha_post_no_url', { hop: hops, currentUrl });
                } else {
                    traceRedirect('captcha_ocr_empty', { hop: hops, currentUrl });
                }
            }

            // 2. Fallback: cerca link in bottoni/ancore o redirect standard
            const linkUrl = findRedirectorOrHostUrl(html);
            if (linkUrl) {
                traceRedirect('fallback_found_url', { hop: hops, linkUrl });
                currentUrl = new URL(linkUrl, currentUrl).toString();
                if (!isRedirectorUrl(currentUrl)) break;
                continue;
            }

            const deltabitMatch = html.match(/https?:\/\/deltabit\.(?:co|sx|bz|sx)\/[a-zA-Z0-9\/=_+-]+/i);
            if (deltabitMatch) {
                traceRedirect('fallback_deltabit_match', { hop: hops, url: deltabitMatch[0] });
                currentUrl = deltabitMatch[0];
                break;
            }

            const refreshMatch = html.match(/url=(https?:\/\/(?:deltabit|maxstream|stayonline|uprot|mixdrop|m1xdrop|safego|clicka)\.[^"']+(?<!\.ico|\.png|\.jpg))/i);
            if (refreshMatch) {
                traceRedirect('fallback_refresh_match', { hop: hops, url: refreshMatch[1] });
                currentUrl = decodeEntitiesBasic(refreshMatch[1]);
                if (!isRedirectorUrl(currentUrl)) break;
                continue;
            }

            // Se non abbiamo trovato nulla di nuovo, fermiamoci
            traceRedirect('stop_no_candidate_url', { hop: hops, currentUrl });
            break;
        } catch (e) {
            traceRedirect('error', { hop: hops, currentUrl, message: e.message });
            if (isFlareSolverrBlockedError(e)) {
                console.warn(`[EuroStreaming] Risoluzione shortlink saltata per cooldown/blocco bypass ${currentUrl}:`, e.message);
            } else {
                console.error(`[EuroStreaming] Errore risoluzione shortlink ${currentUrl}:`, e.message);
            }
            break;
        }
    }
    traceRedirect('end', { url, currentUrl, stillRedirector: isRedirectorUrl(currentUrl), hops });
    return currentUrl;
}

async function extractStreamFromHost(link, displayName) {
    let hostUrl = normalizeHostUrl(link && link.url ? link.url : link);
    if (!hostUrl) return [];
    try {
        hostUrl = await resolveShortlink(hostUrl);
        const host = detectHost(hostUrl) || link && link.host;
        if (!host) {
            traceRedirect('extract_stop_no_host', { hostUrl, originalHost: link && link.host || null });
            return [];
        }

        let extracted = null;
        const lower = hostUrl.toLowerCase();
        if (lower.includes('mixdrop') || lower.includes('m1xdrop') || lower.includes('clicka.cc/mix')) {
            extracted = await extractMixDrop(hostUrl, `${BASE_URL}/`);
        } else if (lower.includes('maxstream') || lower.includes('uprot.net')) {
            extracted = await extractMaxStream(hostUrl, `${BASE_URL}/`);
        } else if (host === 'deltabit' || lower.includes('deltabit') || lower.includes('clicka.cc/delta') || lower.includes('clicka.cc/adelta')) {
            extracted = await extractDeltaBit(hostUrl, `${BASE_URL}/`);
        }
        traceRedirect('extractor_done', {
            host,
            hostUrl,
            hasResult: Boolean(extracted),
            resultCount: Array.isArray(extracted) ? extracted.length : (extracted ? 1 : 0)
        });

        const items = Array.isArray(extracted) ? extracted : (extracted ? [extracted] : []);
        let quality = '720p';
        let proxySourceUrl = hostUrl;
        let playbackUrl = hostUrl;
        let directStreamHeaders = null;
        for (const item of items) {
            const streamUrl = typeof item === 'string' ? item : item.url;
            if (!streamUrl) continue;
            const headers = typeof item === 'object' ? item.headers : null;
            const referer = headers && (headers.Referer || headers.referer || headers.Referrer || headers.referrer);
            playbackUrl = streamUrl;
            directStreamHeaders = headers || null;
            if (host === 'maxstream' && item && typeof item === 'object' && item.sourceUrl) {
                proxySourceUrl = item.sourceUrl;
            }
            if (host === 'deltabit' && referer && String(referer).toLowerCase().includes('deltabit')) {
                proxySourceUrl = referer;
            }
            if (streamUrl.includes('.m3u8')) {
                const detected = await checkQualityFromPlaylist(streamUrl, headers || {});
                if (detected) {
                    quality = detected;
                    break;
                }
            }
        }

        if (isRedirectorUrl(proxySourceUrl)) {
            traceRedirect('extract_stop_still_redirector', { host, proxySourceUrl, hostUrl });
            console.warn(`[EuroStreaming] Redirector saltato per ${host}: ${proxySourceUrl}`);
            return [];
        }

        return [formatStream({
            url: playbackUrl,
            easyProxySourceUrl: proxySourceUrl,
            host,
            headers: directStreamHeaders,
            name: `EuroStreaming - ${host}`,
            title: displayName,
            quality,
            type: 'direct'
        }, 'EuroStreaming')];
    } catch (e) {
        console.error(`[EuroStreaming] Extraction error for ${hostUrl}:`, e.message);
        return [];
    }
}

async function getStreams(id, type, season, episode, providerContext = null) {
    const benchStart = Date.now();
    const bench = [];
    const mark = (step, meta = {}) => {
        if (STEP_BENCH_ENABLED) bench.push({ step, t: Date.now() - benchStart, ...meta });
    };

    try {
        const requestedType = String(type || '').toLowerCase();
        if (requestedType === 'movie') return [];
        const normalizedType = 'tv';
        const mappedRequest = await resolveMappedRequest(id, normalizedType, season, episode, providerContext);
        mark('mapping_done', {
            tmdb: mappedRequest.tmdbId,
            season: mappedRequest.season,
            episode: mappedRequest.episode,
            mode: mappedRequest.episodeMode || null
        });
        const tmdbId = await resolveTmdbId(id, normalizedType, providerContext, mappedRequest);
        if (!tmdbId) return [];
        const info = await getTmdbInfo(tmdbId, normalizedType);
        mark('tmdb_done', { ok: Boolean(info) });
        if (!info || !info.title) return [];
        info.titleHints = mappedRequest.titleHints || [];
        if (mappedRequest.seasonName) info.titleHints.push(mappedRequest.seasonName);

        const candidates = await searchProvider(info);
        mark('search_done', { results: candidates.length });
        if (candidates.length === 0) return [];

        const picked = await pickCandidate(candidates, info);
        mark('candidate_done', { ok: Boolean(picked), score: picked && picked.score });
        if (!picked) {
            if (STEP_BENCH_ENABLED) console.log(`[EuroStreamingBench] ${JSON.stringify({ id: String(id), type: String(type), totalMs: Date.now() - benchStart, steps: bench, msg: 'no_candidate' })}`);
            return [];
        }

        const effectiveSeason = Number.parseInt(String(mappedRequest.season || season || ''), 10) || 1;
        const effectiveEpisode = Number.parseInt(String(mappedRequest.episode || episode || ''), 10) || 1;
        const episodeHints = normalizedType === 'tv'
            ? await getEpisodeGroupHints(tmdbId, effectiveSeason, effectiveEpisode)
            : [];
        const links = extractEpisodeLinks(picked.html, effectiveSeason, effectiveEpisode, episodeHints);
        mark('links_done', { links: links.length });
        if (links.length === 0) {
            if (STEP_BENCH_ENABLED) console.log(`[EuroStreamingBench] ${JSON.stringify({ id: String(id), type: String(type), totalMs: Date.now() - benchStart, steps: bench, msg: 'no_links' })}`);
            return [];
        }

        const displayName = `${info.title} ${effectiveSeason}x${effectiveEpisode}`;
        let streams = [];

        // If client requested raw links (to handle IP-lock locally)
        if (providerContext && providerContext.format === 'links') {
            const resolvedLinks = await Promise.all(links.map(async (l) => ({
                host: l.host,
                url: await resolveShortlink(l.url)
            })));
            if (STEP_BENCH_ENABLED) console.log(`[EuroStreamingBench] ${JSON.stringify({ id: String(id), totalMs: Date.now() - benchStart, msg: 'returning_links' })}`);
            return { links: resolvedLinks };
        }

        const uniqueLinks = Array.from(new Map(links.map(link => [`${link.host}:${link.url}`, link])).values()).slice(0, 5);
        for (const link of uniqueLinks) {
            const extractedStreams = await extractStreamFromHost(link, displayName);
            streams.push(...extractedStreams.filter(Boolean));
        }
        mark('extract_done', { streams: streams.length });
        if (STEP_BENCH_ENABLED) {
            console.log(`[EuroStreamingBench] ${JSON.stringify({ id: String(id), type: String(type), totalMs: Date.now() - benchStart, steps: bench })}`);
        }
        return streams;
    } catch (e) {
        if (STEP_BENCH_ENABLED) {
            console.log(`[EuroStreamingBench] ${JSON.stringify({ id: String(id), type: String(type), totalMs: Date.now() - benchStart, failed: true, steps: bench, error: e.message })}`);
        }
        console.error('[EuroStreaming] Error:', e);
        return [];
    }
}

async function warmupRedirectors(urls = []) {
    const targets = Array.isArray(urls) ? urls : [];
    const results = [];
    for (const rawUrl of targets) {
        const url = normalizeHostUrl(rawUrl);
        if (!url) continue;
        if (!isRedirectorUrl(url)) {
            const hostWarmup = await warmupFinalHostSession(url);
            if (hostWarmup.attempted) {
                results.push({
                    url,
                    resolvedUrl: url,
                    ok: hostWarmup.ok,
                    hostWarmupProvider: hostWarmup.provider,
                    hostWarmupOk: hostWarmup.ok,
                    error: hostWarmup.error
                });
            }
            continue;
        }
        try {
            const resolvedUrl = await resolveShortlink(url);
            const resolvedOk = Boolean(resolvedUrl && resolvedUrl !== url && !isRedirectorUrl(resolvedUrl));
            const hostWarmup = resolvedOk
                ? await warmupFinalHostSession(resolvedUrl)
                : { attempted: false, ok: true, provider: null };
            results.push({
                url,
                resolvedUrl,
                ok: resolvedOk && hostWarmup.ok,
                hostWarmupProvider: hostWarmup.provider,
                hostWarmupOk: hostWarmup.attempted ? hostWarmup.ok : undefined,
                error: hostWarmup.error
            });
        } catch (e) {
            results.push({ url, error: e.message, ok: false });
        }
    }
    return results;
}

function extractWarmupRedirectorUrlsFromHtml(html, limit = 5) {
    const max = Math.max(1, Number.parseInt(String(limit || 5), 10) || 5);
    const urls = [];
    const addUrl = (rawUrl) => {
        const url = normalizeHostUrl(rawUrl);
        if (url && isRedirectorUrl(url) && !urls.includes(url)) urls.push(url);
    };

    for (const anchor of extractAnchors(html)) {
        addUrl(anchor.href);
    }

    const regex = /https?:\/\/(?:[^"'<>\\\s]+\.)?(?:uprot\.net|clicka\.cc|safego\.cc)\/[^"'<>\\\s]+/ig;
    let match;
    while ((match = regex.exec(String(html || ''))) !== null) {
        addUrl(decodeEntitiesBasic(match[0]).replace(/[),.;]+$/, ''));
    }

    return urls
        .sort((a, b) => {
            const score = (url) => {
                const lower = String(url || '').toLowerCase();
                if (lower.includes('uprot.net')) return 0;
                if (lower.includes('safego.cc')) return 1;
                return 2;
            };
            return score(a) - score(b);
        })
        .slice(0, max);
}

function loadSavedDiscoveryHtml(providerNames, targetUrl) {
    const targetHost = getUrlHost(targetUrl);
    const targetRoot = getRootDomain(targetHost);
    const maxAgeMs = 2 * 60 * 60 * 1000;

    for (const providerName of providerNames) {
        const sessionFile = path.join(process.cwd(), `cf-session-${providerName}.json`);
        if (!fs.existsSync(sessionFile)) continue;

        try {
            const data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
            const ageMs = Date.now() - (data.timestamp || 0);
            if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > maxAgeMs) continue;

            const response = typeof data.response === 'string' ? data.response : '';
            if (response.length < 500) continue;
            if (!/(?:uprot\.net|clicka\.cc|safego\.cc)/i.test(response)) continue;

            const sessionHost = getUrlHost(data.url);
            const sessionRoot = getRootDomain(sessionHost);
            const cookieDomains = Array.isArray(data.cookieDomains) ? data.cookieDomains : [];
            const matchesTarget = (targetRoot && sessionRoot && targetRoot === sessionRoot) ||
                cookieDomains.some((domain) => domainMatchesHost(domain, targetHost));
            if (!matchesTarget) continue;

            console.log(`[EuroStreaming] Discovery redirector da HTML sessione salvata (${providerName}, ${Math.round(ageMs / 60000)} min fa).`);
            return response;
        } catch {}
    }

    return null;
}

async function discoverRedirectorWarmupUrls(pageUrl, limit = 5) {
    const normalizedPageUrl = normalizeHostUrl(pageUrl);
    if (!normalizedPageUrl) return [];
    const savedHtml = loadSavedDiscoveryHtml(['eurostreaming', 'eurostreamings'], normalizedPageUrl);
    const html = savedHtml || await fetchHtml(normalizedPageUrl);
    return extractWarmupRedirectorUrlsFromHtml(html, limit);
}

module.exports = { getStreams, warmupRedirectors, discoverRedirectorWarmupUrls };
