const { formatStream } = require('../formatter');
const { checkQualityFromPlaylist } = require('../quality_helper');

// Rilevamento ambiente: Server (Node) o Client (Nuvio/React Native)
const IS_SERVER = typeof process !== 'undefined' && process.versions && process.versions.node;

if (!IS_SERVER) {
    // SIAMO SU NUVIO: usiamo l'API remota del server per evitare crash e blocchi CF
    module.exports = {
        getStreams: async (id, type, season, episode) => {
            try {
                const url = `https://easystreams.realbestia.com/resolve/guardoserie?id=${id}&type=${type}&s=${season || 1}&ep=${episode || 1}`;
                const response = await fetch(url);
                const data = await response.json();
                return data.streams || [];
            } catch (e) {
                console.error('[Guardoserie-Client] API Error:', e.message);
                return [];
            }
        }
    };
    // Interrompiamo l'esecuzione qui per il client, il resto è logica server-only
} else {

    // SIAMO SU SERVER: carichiamo le librerie pesanti
    const { smartFetch } = require('../utils/cf_handler');
    const { USER_AGENT, getProxiedUrl } = require('../extractors/common');
    const { extractLoadm, extractUqload, extractDropLoad, extractMixDrop, extractSuperVideo } = require('../extractors');
    const STEP_BENCH_ENABLED = String(process.env.PROVIDER_STEP_BENCH || '').trim().toLowerCase() === '1';
    function getGuardoserieBaseUrl() {
        return 'https://guardoserie.run';
    }
    const TMDB_API_KEY = '68e094699525b18a70bab2f86b1fa706';
    function getMappingApiUrl() {
        return 'https://animemapping.realbestia.com';
    }
    function normalizeConfigBoolean(value) {
        if (value === true) return true;
        const normalized = String(value || '').trim().toLowerCase();
        return ['1', 'true', 'yes', 'on', 'enabled', 'checked'].includes(normalized);
    }
    function getMappingLanguage(providerContext = null) {
        const explicit = String(providerContext?.mappingLanguage || '').trim().toLowerCase();
        if (explicit === 'it') return 'it';
        return normalizeConfigBoolean(providerContext?.easyCatalogsLangIt) ? 'it' : null;
    }

    async function getIdsFromKitsu(kitsuId, season, episode, providerContext = null) {
        try {
            if (!kitsuId) return null;
            const params = new URLSearchParams();
            const parsedEpisode = Number.parseInt(String(episode || ''), 10);
            const parsedSeason = Number.parseInt(String(season || ''), 10);
            if (Number.isInteger(parsedEpisode) && parsedEpisode > 0) {
                params.set('ep', String(parsedEpisode));
            } else {
                params.set('ep', '1');
            }
            if (Number.isInteger(parsedSeason) && parsedSeason >= 0) {
                params.set('s', String(parsedSeason));
            }
            params.set('lang', 'it');

            const url = `${getMappingApiUrl()}/kitsu/${encodeURIComponent(String(kitsuId).trim())}?${params.toString()}`;
            const response = await fetch(url);
            if (!response.ok) return null;
            const payload = await response.json();
            const ids = payload && payload.mappings && payload.mappings.ids ? payload.mappings.ids : {};
            const tmdbEpisode =
                (payload && payload.mappings && (payload.mappings.tmdb_episode || payload.mappings.tmdbEpisode)) ||
                (payload && (payload.tmdb_episode || payload.tmdbEpisode)) ||
                null;
            const tmdbId = ids && /^\d+$/.test(String(ids.tmdb || '').trim()) ? String(ids.tmdb).trim() : null;
            const imdbId = ids && /^tt\d+$/i.test(String(ids.imdb || '').trim()) ? String(ids.imdb).trim() : null;
            const mappedSeason = Number.parseInt(String(
                tmdbEpisode && (tmdbEpisode.season || tmdbEpisode.seasonNumber || tmdbEpisode.season_number) || ''
            ), 10);
            const mappedEpisode = Number.parseInt(String(
                tmdbEpisode && (tmdbEpisode.episode || tmdbEpisode.episodeNumber || tmdbEpisode.episode_number) || ''
            ), 10);
            const rawEpisodeNumber = Number.parseInt(String(
                tmdbEpisode && (tmdbEpisode.rawEpisodeNumber || tmdbEpisode.raw_episode_number || tmdbEpisode.rawEpisode) || ''
            ), 10);
            return {
                tmdbId,
                imdbId,
                mappedSeason: Number.isInteger(mappedSeason) && mappedSeason > 0 ? mappedSeason : null,
                mappedEpisode: Number.isInteger(mappedEpisode) && mappedEpisode > 0 ? mappedEpisode : null,
                rawEpisodeNumber: Number.isInteger(rawEpisodeNumber) && rawEpisodeNumber > 0 ? rawEpisodeNumber : null
            };
        } catch (e) {
            console.error('[Guardoserie] Kitsu mapping error:', e);
            return null;
        }
    }

    function extractEpisodeUrlFromSeriesPage(pageHtml, season, episode) {
        if (!pageHtml) return null;

        const seasonIndex = parseInt(season, 10) - 1;
        const episodeIndex = parseInt(episode, 10) - 1;
        if (!Number.isInteger(seasonIndex) || !Number.isInteger(episodeIndex) || seasonIndex < 0 || episodeIndex < 0) {
            return null;
        }

        // Main pattern used by Guardoserie season tabs.
        const seasonBlocks = pageHtml.split(/class=['"]les-content['"]/i);
        if (seasonBlocks.length > seasonIndex + 1) {
            const targetSeasonBlock = seasonBlocks[seasonIndex + 1];
            const blockEnd = targetSeasonBlock.indexOf('</div>');
            const cleanBlock = blockEnd !== -1 ? targetSeasonBlock.substring(0, blockEnd) : targetSeasonBlock;

            const episodeRegex = /<a[^>]+href=['"]([^'"]+)['"][^>]*>/g;
            const episodes = [];
            let eMatch;
            while ((eMatch = episodeRegex.exec(cleanBlock)) !== null) {
                if (eMatch[1] && /\/episodio\//i.test(eMatch[1])) {
                    episodes.push(eMatch[1]);
                }
            }

            if (episodes.length > episodeIndex) {
                return episodes[episodeIndex];
            }
        }

        // Fallback: direct episode URL pattern on full page.
        const explicitEpisodeRegex = new RegExp(`https?:\\/\\/[^"'\\s]+\\/episodio\\/[^"'\\s]*stagione-${season}-episodio-${episode}[^"'\\s]*`, 'i');
        const explicitMatch = pageHtml.match(explicitEpisodeRegex);
        if (explicitMatch && explicitMatch[0]) {
            return explicitMatch[0];
        }

        return null;
    }

    function normalizePlayerLink(link) {
        if (!link) return null;
        let normalized = String(link)
            .trim()
            .replace(/&amp;/g, '&')
            .replace(/\\\//g, '/');

        if (!normalized || normalized.startsWith('data:')) return null;

        if (normalized.startsWith('//')) {
            normalized = `https:${normalized}`;
        } else if (normalized.startsWith('/')) {
            normalized = `${getGuardoserieBaseUrl()}${normalized}`;
        } else if (!/^https?:\/\//i.test(normalized) && /(loadm|uqload|dropload|dr0pstream)/i.test(normalized)) {
            normalized = `https://${normalized.replace(/^\/+/, '')}`;
        }

        return /^https?:\/\//i.test(normalized) ? normalized : null;
    }

    function extractPlayerLinksFromHtml(html) {
        if (!html) return [];

        const links = new Set();
        const iframeTags = html.match(/<iframe\b[^>]*>/ig) || [];
        for (const tag of iframeTags) {
            const attrRegex = /\b(?:data-src|src)\s*=\s*(['"])(.*?)\1/ig;
            let attrMatch;
            while ((attrMatch = attrRegex.exec(tag)) !== null) {
                const candidate = normalizePlayerLink(attrMatch[2]);
                if (candidate) links.add(candidate);
            }
        }

        // Fallback: search for direct URLs in scripts/text
        const directRegexes = [
            /https?:\/\/(?:www\.)?(?:loadm|uqload|dropload|dr0pstream|mixdrop|m1xdrop|supervideo|vidoza)[^"'<\s]+/ig,
            /https?:\\\/\\\/(?:www\\.)?(?:loadm|uqload|dropload|dr0pstream|mixdrop|m1xdrop|supervideo|vidoza)[^"'<\s]+/ig
        ];

        for (const regex of directRegexes) {
            const matches = html.match(regex) || [];
            for (const raw of matches) {
                const candidate = normalizePlayerLink(raw);
                if (candidate) links.add(candidate);
            }
        }

        return Array.from(links);
    }

    function getQualityFromName(qualityStr) {
        if (!qualityStr) return 'Unknown';

        const quality = qualityStr.toUpperCase();

        // Map API quality values to normalized format
        if (quality === 'ORG' || quality === 'ORIGINAL') return 'Original';
        if (quality === '4K' || quality === '2160P') return '4K';
        if (quality === '1440P' || quality === '2K') return '1440p';
        if (quality === '1080P' || quality === 'FHD') return '1080p';
        if (quality === '720P' || quality === 'HD') return '720p';
        if (quality === '480P' || quality === 'SD') return '480p';
        if (quality === '360P') return '360p';
        if (quality === '240P') return '240p';

        // Try to extract number from string and format consistently
        const match = qualityStr.match(/(\d{3,4})[pP]?/);
        if (match) {
            const resolution = parseInt(match[1]);
            if (resolution >= 2160) return '4K';
            if (resolution >= 1440) return '1440p';
            if (resolution >= 1080) return '1080p';
            if (resolution >= 720) return '720p';
            if (resolution >= 480) return '480p';
            if (resolution >= 360) return '360p';
            return '240p';
        }

        return 'Unknown';
    }

    function normalizeBaseUrl(url) {
        return String(url || '').trim().replace(/\/+$/, '');
    }

    function resolveCandidateUrl(baseUrl, href) {
        if (!href || !baseUrl) return null;
        try {
            return new URL(href, baseUrl).toString();
        } catch (e) {
            return null;
        }
    }

    function isSameHost(baseUrl, candidateUrl) {
        try {
            return new URL(baseUrl).host === new URL(candidateUrl).host;
        } catch (e) {
            return false;
        }
    }

    function extractSearchResultsFromHtml(html, baseUrl) {
        if (!html) return [];
        const results = [];
        const pushResult = (url, title) => {
            const resolved = resolveCandidateUrl(baseUrl, url);
            if (!resolved || !isSameHost(baseUrl, resolved)) return;
            if (/\/(?:wp-|tag\/|category\/|author\/|page\/|search\/|\\?s=)/i.test(resolved)) return;
            results.push({ url: resolved, title: title ? String(title).replace(/<[^>]+>/g, '').trim() : '' });
        };

        // Preferred patterns (common WordPress themes + Guardoserie specific)
        const patterns = [
            /<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*ml-mask[^"']*["'][^>]*>.*?<h2>(.*?)<\/h2>/gis,
            /<div[^>]*class=["'][^"']*ml-item[^"']*["'][^>]*>.*?<a[^>]+href=["']([^"']+)["'][^>]*>.*?<h2>(.*?)<\/h2>/gis,
            /<h2[^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi,
            /<a[^>]+class=["'][^"']*ss-title[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi,
            /<a[^>]+href=["']([^"']+)["'][^>]+class=["'][^"']*ss-title[^"']*["'][^>]*>(.*?)<\/a>/gi
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(html)) !== null) {
                pushResult(match[1], match[2]);
            }
            if (results.length > 0) break;
        }

        // Fallback: any anchor tags
        if (results.length === 0) {
            const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
            let match;
            while ((match = linkRegex.exec(html)) !== null) {
                const text = match[2] ? match[2].replace(/<[^>]+>/g, '').trim() : '';
                if (!text || text.length < 2) continue;
                pushResult(match[1], text);
            }
        }

        // Deduplicate by URL
        return Array.from(new Map(results.map(item => [item.url, item])).values());
    }

    function decodeEntitiesBasic(str) {
        return String(str || '')
            .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#8211;/g, '-')
            .replace(/&#8217;/g, "'");
    }

    function normalizeTitle(str) {
        return decodeEntitiesBasic(str)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .replace('iltronodispade', 'gameofthrones');
    }

    function slugifyTitle(value) {
        return String(value || '')
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/&/g, 'and')
            .replace(/['’]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function extractTitleFromHtml(html) {
        if (!html) return '';
        const ogMatch = html.match(/property=["']og:title["']\s+content=["']([^"']+)["']/i);
        if (ogMatch && ogMatch[1]) return ogMatch[1];
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) return titleMatch[1];
        return '';
    }

    function htmlMatchesTitle(html, title, originalTitle) {
        const pageTitle = extractTitleFromHtml(html);
        if (!pageTitle) return false;
        const nPage = normalizeTitle(pageTitle);
        const nTitle = normalizeTitle(title || '');
        const nOrig = normalizeTitle(originalTitle || '');
        if (nPage === nTitle || (nOrig && nPage === nOrig)) return true;
        if (nTitle && nPage.includes(nTitle)) return true;
        if (nOrig && nPage.includes(nOrig)) return true;
        return false;
    }

    async function tryFetchPageHtml(url) {
        if (!url) return null;
        try {
            const html = await smartFetch(url, getGuardoserieBaseUrl(), {
                timeout: 5000,
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                },
                provider: 'guardoserie'
            });
            return html;
        } catch (e) {
            return null;
        }
    }

    async function getShowInfo(tmdbId, type) {
        try {
            const endpoint = type === 'movie' ? 'movie' : 'tv';
            const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=it-IT`;
            const response = await fetch(url);
            if (!response.ok) return null;
            return await response.json();
        } catch (e) {
            console.error('[Guardoserie] TMDB error:', e);
            return null;
        }
    }

    async function getStreams(id, type, season, episode, providerContext = null) {
        const benchStart = Date.now();
        const bench = [];
        const mark = (step, meta = {}) => {
            if (!STEP_BENCH_ENABLED) return;
            bench.push({ step, t: Date.now() - benchStart, ...meta });
        };
        try {
            const baseUrl = normalizeBaseUrl(getGuardoserieBaseUrl());
            if (!baseUrl) {
                console.log('[Guardoserie] Base URL not available yet.');
                return [];
            }
            let tmdbId = id;
            let effectiveSeason = Number.parseInt(String(season || ''), 10);
            if (!Number.isInteger(effectiveSeason) || effectiveSeason < 1) effectiveSeason = 1;
            let effectiveEpisode = Number.parseInt(String(episode || ''), 10);
            if (!Number.isInteger(effectiveEpisode) || effectiveEpisode < 1) effectiveEpisode = 1;
            const contextTmdbId = providerContext && /^\d+$/.test(String(providerContext.tmdbId || ''))
                ? String(providerContext.tmdbId)
                : null;
            const contextKitsuId = providerContext && /^\d+$/.test(String(providerContext.kitsuId || ''))
                ? String(providerContext.kitsuId)
                : null;
            const shouldIncludeSeasonHintForKitsu =
                providerContext && providerContext.seasonProvided === true;

            if (id.toString().startsWith('kitsu:') || contextKitsuId) {
                const kitsuId =
                    contextKitsuId ||
                    (((id.toString().match(/^kitsu:(\d+)/i) || [])[1]) || null);
                const seasonHintForKitsu = shouldIncludeSeasonHintForKitsu ? season : null;
                const mapped = kitsuId ? await getIdsFromKitsu(kitsuId, seasonHintForKitsu, episode, providerContext) : null;
                mark('kitsu_mapping_done', { ok: Boolean(mapped && mapped.tmdbId) });
                if (mapped && mapped.tmdbId) {
                    tmdbId = mapped.tmdbId;
                    console.log(`[Guardoserie] Kitsu ${kitsuId} mapped to TMDB ID ${tmdbId}`);
                    if (mapped.mappedSeason && mapped.mappedEpisode) {
                        effectiveSeason = mapped.mappedSeason;
                        effectiveEpisode = mapped.mappedEpisode;
                        console.log(`[Guardoserie] Using TMDB episode mapping ${effectiveSeason}x${effectiveEpisode} (raw=${mapped.rawEpisodeNumber || 'n/a'})`);
                    } else if (mapped.rawEpisodeNumber) {
                        effectiveEpisode = mapped.rawEpisodeNumber;
                        console.log(`[Guardoserie] Using mapped raw episode number ${effectiveEpisode}`);
                    }
                } else {
                    console.log(`[Guardoserie] No Kitsu->TMDB mapping found for ${kitsuId}`);
                }
            } else if (id.toString().startsWith('tt')) {
                if (contextTmdbId) {
                    tmdbId = contextTmdbId;
                    console.log(`[Guardoserie] Using prefetched TMDB ID ${tmdbId} for ${id}`);
                } else {
                    // Need to convert IMDb to TMDB for title/year info
                    const url = `https://api.themoviedb.org/3/find/${id}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
                    const response = await fetch(url);
                    mark('imdb_to_tmdb_done', { ok: response.ok });
                    if (response.ok) {
                        const data = await response.json();
                        if (type === 'movie' && data.movie_results?.length > 0) tmdbId = data.movie_results[0].id;
                        else if ((type === 'series' || type === 'tv') && data.tv_results?.length > 0) tmdbId = data.tv_results[0].id;
                    }
                }
            } else if (id.toString().startsWith('tmdb:')) {
                tmdbId = id.toString().replace('tmdb:', '');
            }

            const showInfo = await getShowInfo(tmdbId, type === 'movie' ? 'movie' : 'tv');
            mark('tmdb_showinfo_done', { ok: Boolean(showInfo) });
            if (!showInfo) return [];

            const title = showInfo.name || showInfo.original_name || showInfo.title || showInfo.original_title;
            const originalTitle = showInfo.original_title || showInfo.original_name;
            const year = (showInfo.first_air_date || showInfo.release_date || '').split('-')[0];

            console.log(`[Guardoserie] Searching for: ${title} / ${originalTitle} (${year})`);

            // 1. Ricerca AJAX Ufficiale (Senza indovinelli)
            const searchProvider = async (query) => {
                const searchStartedAt = Date.now();
                
                // Estrazione dinamica del nonce se possibile
                let nonce = '';
                try {
                    const homeHtml = await smartFetch(baseUrl, baseUrl, { timeout: 5000, provider: 'guardoserie', skipBypassOnFailure: true });
                    const nonceMatch = homeHtml.match(/"nonce":"([a-z0-9]+)"/i);
                    if (nonceMatch) nonce = nonceMatch[1];
                } catch (e) {
                    console.log(`[Guardoserie] Could not fetch nonce from homepage`);
                }

                // Usiamo GET invece di POST perché il server rifiuta i POST con 400
                let searchUrl = `${baseUrl}/wp-admin/admin-ajax.php?s=${encodeURIComponent(query)}&action=searchwp_live_search&swpquery=${encodeURIComponent(query)}&swpengine=default`;
                if (nonce) searchUrl += `&_wpnonce=${nonce}`;

                try {
                    const ajaxHtml = await smartFetch(searchUrl, baseUrl, {
                        method: 'GET',
                        headers: { 
                            'X-Requested-With': 'XMLHttpRequest',
                            'Referer': `${baseUrl}/`,
                            'Accept': 'text/html, */*; q=0.01'
                        },
                        timeout: 5000, // Massimo 5 secondi come richiesto
                        provider: 'guardoserie',
                        skipBypassOnFailure: true
                    });

                    const results = extractSearchResultsFromHtml(ajaxHtml, baseUrl);
                    mark('search_query_done', { q: query, ms: Date.now() - searchStartedAt, results: results.length, source: 'ajax' });
                    return results;
                } catch (e) {
                    console.log(`[Guardoserie] AJAX Search failed: ${e.message}`);
                    return [];
                }
            };

            const queries = Array.from(new Set([title, originalTitle].filter(q => q && q.length > 2).map(q => q.toLowerCase()))).slice(0, 2);
            // Lanciamo tutte le query in parallelo
            const searchPromises = queries.map(q => searchProvider(q));
            const allResultsArray = await Promise.all(searchPromises);
            let allResults = allResultsArray.flat();
            mark('search_phase_done', { queries: queries.length, results: allResults.length });

            // Deduplicate results by URL
            allResults = Array.from(new Map(allResults.map(item => [item.url, item])).values());

            // Sort results: exact matches first
            const nTitle = normalizeTitle(title);
            const nOrig = normalizeTitle(originalTitle || '');
            const scoreTitleMatch = (nResult) => {
                if (!nResult) return 0;
                if (nResult === nTitle || (nOrig && nResult === nOrig)) return 3;

                const scorePartial = (a, b) => {
                    if (!a || !b) return 0;
                    if (!(a.includes(b) || b.includes(a))) return 0;
                    const minLen = Math.min(a.length, b.length);
                    const maxLen = Math.max(a.length, b.length);
                    const ratio = maxLen > 0 ? minLen / maxLen : 0;
                    if (ratio >= 0.8) return 2;
                    if (ratio >= 0.6) return 1;
                    return 0;
                };

                return Math.max(scorePartial(nResult, nTitle), scorePartial(nResult, nOrig));
            };

            allResults.sort((a, b) => {
                const nA = normalizeTitle(a.title);
                const nB = normalizeTitle(b.title);
                const exactA = nA === nTitle || nA === nOrig;
                const exactB = nB === nTitle || nB === nOrig;
                if (exactA && !exactB) return -1;
                if (!exactA && exactB) return 1;
                return 0;
            });

            targetUrl = null;
            let bestNoYearMatch = null;
            let bestNoYearScore = 0;
            // Limit to top 10 results to avoid timeout while being thorough
            // Parallel verification of top results
            const topResults = allResults.slice(0, 5);
            const verificationPromises = topResults.map(async (result) => {
                const nResult = normalizeTitle(result.title);
                const matchScore = scoreTitleMatch(nResult);
                if (matchScore < 1) return null;

                try {
                    const pageHtml = await smartFetch(result.url, getGuardoserieBaseUrl(), {
                        provider: 'guardoserie'
                    });

                    let foundYear = null;
                    const pubYearMatch = pageHtml.match(/pubblicazione.*?release-year\/(\d{4})/i);
                    if (pubYearMatch) foundYear = pubYearMatch[1];

                    if (!foundYear) {
                        const anyYearMatch = pageHtml.match(/release-year\/(\d{4})/i);
                        if (anyYearMatch) foundYear = anyYearMatch[1];
                    }

                    if (foundYear) {
                        const targetYear = parseInt(year);
                        const fYear = parseInt(foundYear);
                        const maxDiff = matchScore === 3 ? 10 : 1;
                        if (fYear === targetYear || Math.abs(fYear - targetYear) <= maxDiff) {
                            return { url: result.url, score: matchScore, exact: true };
                        }
                    } else if (matchScore >= 2) {
                        return { url: result.url, score: matchScore, exact: false };
                    }
                } catch (e) {
                    if (matchScore >= 2) return { url: result.url, score: matchScore, exact: false };
                }
                return null;
            });

            const verifiedResults = (await Promise.all(verificationPromises)).filter(Boolean);
            verifiedResults.sort((a, b) => b.score - a.score);

            if (verifiedResults.length > 0) {
                targetUrl = verifiedResults[0].url;
            }

            if (targetUrl) {
                return await processTargetUrl(targetUrl, type, effectiveSeason, effectiveEpisode, baseUrl, title, id, benchStart, mark);
            }

            console.log(`[Guardoserie] No matching result found for ${title}`);
            return [];
        } catch (e) {
            console.error(`[Guardoserie] Error:`, e);
            return [];
        }
    }

    async function processTargetUrl(targetUrl, type, effectiveSeason, effectiveEpisode, baseUrl, title, id, benchStart, mark) {
        let episodeUrl = targetUrl;
        if (type === 'tv' || type === 'series') {
            const pageHtml = await smartFetch(targetUrl, getGuardoserieBaseUrl(), {
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Referer': `${getGuardoserieBaseUrl()}/`
                },
                provider: 'guardoserie'
            });
            const resolvedEpisodeUrl = extractEpisodeUrlFromSeriesPage(pageHtml, effectiveSeason, effectiveEpisode);
            if (resolvedEpisodeUrl) {
                episodeUrl = resolvedEpisodeUrl;
            } else {
                console.log(`[Guardoserie] Episode ${effectiveEpisode} not found in Season ${effectiveSeason} at ${targetUrl}`);
                return [];
            }
        }

        console.log(`[Guardoserie] Found episode/movie URL: ${episodeUrl}`);
        const finalHtml = await smartFetch(episodeUrl, getGuardoserieBaseUrl(), {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Referer': `${getGuardoserieBaseUrl()}/`
            },
            provider: 'guardoserie'
        });

        let playerLinks = extractPlayerLinksFromHtml(finalHtml);
        if (playerLinks.length === 0) {
            console.log(`[Guardoserie] No player links found`);
            return [];
        }

        console.log(`[Guardoserie] Found ${playerLinks.length} player links`);
        const displayName = (type === 'tv' || type === 'series') ? `${title} ${effectiveSeason}x${effectiveEpisode}` : title;
        
        const streamPromises = playerLinks.map(async (playerLink) => {
            try {
                if (playerLink.includes('loadm')) {
                    const domain = 'guardoserie.horse';
                    const extracted = await extractLoadm(playerLink, domain);
                    return (extracted || []).map(s => formatStream({
                        url: s.url,
                        headers: s.headers,
                        name: `Guardoserie - Loadm`,
                        title: displayName,
                        quality: "HD",
                        type: "direct",
                        behaviorHints: s.behaviorHints
                    }, 'Guardoserie'));
                } else if (playerLink.includes('uqload')) {
                    const extracted = await extractUqload(playerLink);
                    if (extracted?.url) {
                        return [formatStream({
                            url: extracted.url,
                            headers: extracted.headers,
                            name: `Guardoserie - Uqload`,
                            title: displayName,
                            quality: "HD",
                            type: "direct"
                        }, 'Guardoserie')];
                    }
                } else if (playerLink.includes('mixdrop') || playerLink.includes('m1xdrop')) {
                    const extracted = await extractMixDrop(playerLink);
                    if (extracted?.url) {
                        return [formatStream({
                            url: extracted.url,
                            headers: extracted.headers,
                            name: `Guardoserie - MixDrop`,
                            title: displayName,
                            quality: "HD",
                            type: "direct"
                        }, 'Guardoserie')];
                    }
                }
            } catch (e) {}
            return [];
        });

        const nestedStreams = await Promise.all(streamPromises);
        return nestedStreams.flat().filter(Boolean);
    }

    module.exports = { getStreams };
}
