const { USER_AGENT, getProxiedUrl } = require('../extractors/common');
const { extractLoadm, extractUqload, extractDropLoad } = require('../extractors');
const { formatStream } = require('../formatter');
const { checkQualityFromPlaylist } = require('../quality_helper');
const { getProviderUrl } = require('../provider_urls.js');

function getGuardoserieBaseUrl() {
    return getProviderUrl('guardoserie');
}
const TMDB_API_KEY = '68e094699525b18a70bab2f86b1fa706';
function getMappingApiUrl() {
    return getProviderUrl('mapping_api').replace(/\/+$/, "");
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
    } else if (!/^https?:\/\//i.test(normalized) && /(loadm|uqload|dropload)/i.test(normalized)) {
        normalized = `https://${normalized.replace(/^\/+/, '')}`;
    }

    return /^https?:\/\//i.test(normalized) ? normalized : null;
}

function extractPlayerLinkFromHtml(html) {
    if (!html) return null;

    const iframeTags = html.match(/<iframe\b[^>]*>/ig) || [];
    for (const tag of iframeTags) {
        const candidates = [];
        const attrRegex = /\b(?:data-src|src)\s*=\s*(['"])(.*?)\1/ig;
        let attrMatch;
        while ((attrMatch = attrRegex.exec(tag)) !== null) {
            const candidate = normalizePlayerLink(attrMatch[2]);
            if (candidate) candidates.push(candidate);
        }

        const preferred = candidates.find(c => /(loadm|uqload|dropload)/i.test(c));
        if (preferred) return preferred;
        if (candidates.length > 0) return candidates[0];
    }

    // Fallback: some pages expose the player URL in scripts without iframe.
    const directRegexes = [
        /https?:\/\/(?:www\.)?(?:loadm|uqload|dropload)[^"'<\s]+/ig,
        /https?:\\\/\\\/(?:www\\.)?(?:loadm|uqload|dropload)[^"'<\s]+/ig
    ];

    for (const regex of directRegexes) {
        const matches = html.match(regex) || [];
        for (const raw of matches) {
            const candidate = normalizePlayerLink(raw);
            if (candidate) return candidate;
        }
    }

    return null;
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

    // Preferred patterns (common WordPress themes)
    const patterns = [
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
    const proxiedUrl = getProxiedUrl(url);
    const response = await fetch(proxiedUrl, {
        headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'
        }
    });
    if (!response.ok) return null;
    return await response.text();
}

async function guessUrlFromSlug(baseUrl, title, originalTitle) {
    const candidates = new Set();
    const slugs = [slugifyTitle(title), slugifyTitle(originalTitle)]
        .filter(Boolean);
    const patterns = [
        (slug) => `${baseUrl}/${slug}/`,
        (slug) => `${baseUrl}/film/${slug}/`,
        (slug) => `${baseUrl}/movie/${slug}/`,
        (slug) => `${baseUrl}/serie/${slug}/`,
        (slug) => `${baseUrl}/serietv/${slug}/`
    ];

    for (const slug of slugs) {
        for (const makeUrl of patterns) {
            candidates.add(makeUrl(slug));
        }
    }

    for (const url of candidates) {
        try {
            const html = await tryFetchPageHtml(url);
            if (html && htmlMatchesTitle(html, title, originalTitle)) {
                return url;
            }
        } catch (e) {
            // Ignore and continue
        }
    }
    return null;
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
        if (!showInfo) return [];

        const title = showInfo.name || showInfo.original_name || showInfo.title || showInfo.original_title;
        const originalTitle = showInfo.original_title || showInfo.original_name;
        const year = (showInfo.first_air_date || showInfo.release_date || '').split('-')[0];

        console.log(`[Guardoserie] Searching for: ${title} / ${originalTitle} (${year})`);

        // Search helper
        const searchProvider = async (query) => {
            const searchUrl = `${baseUrl}/wp-admin/admin-ajax.php`;
            const body = `s=${encodeURIComponent(query)}&action=searchwp_live_search&swpengine=default&swpquery=${encodeURIComponent(query)}`;

            const response = await fetch(searchUrl, {
                method: 'POST',
                headers: {
                    'User-Agent': USER_AGENT,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Origin': baseUrl,
                    'Referer': `${baseUrl}/`
                },
                body: body
            });

            if (response.ok) {
                const searchHtml = await response.text();
                const results = extractSearchResultsFromHtml(searchHtml, baseUrl);
                if (results.length > 0) return results;
            }

            // Fallback: try the public search page (GET) and allow proxy.
            const searchPageUrl = `${baseUrl}/?s=${encodeURIComponent(query)}`;
            const proxiedSearchUrl = getProxiedUrl(searchPageUrl);
            const pageRes = await fetch(proxiedSearchUrl, {
                headers: {
                    'User-Agent': USER_AGENT,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'
                }
            });
            if (!pageRes.ok) return [];
            const pageHtml = await pageRes.text();
            return extractSearchResultsFromHtml(pageHtml, baseUrl);
        };

        let allResults = [];
        const queries = Array.from(new Set([title, originalTitle].filter(q => q && q.length > 2)));
        for (const q of queries) {
            const res = await searchProvider(q);
            allResults.push(...res);
        }

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

        let targetUrl = null;
        let bestNoYearMatch = null;
        let bestNoYearScore = 0;
        // Limit to top 10 results to avoid timeout while being thorough
        for (const result of allResults.slice(0, 10)) {
            // Check title match first to avoid unnecessary fetches
            const nResult = normalizeTitle(result.title);
            const matchScore = scoreTitleMatch(nResult);
            const isExactMatch = matchScore === 3;
            const isPartialMatch = matchScore >= 1;

            if (isExactMatch || isPartialMatch) {
                // Verify year in the page
                try {
                    const pageRes = await fetch(result.url, { headers: { 
                        'User-Agent': USER_AGENT,
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
                        'Referer': `${getGuardoserieBaseUrl()}/`
                    } });
                    if (!pageRes.ok) continue;
                    const pageHtml = await pageRes.text();

                    // Target the year specifically using regex
                    let foundYear = null;

                    // 1. Try "pubblicazione" link in page
                    const pubYearMatch = pageHtml.match(/pubblicazione.*?release-year\/(\d{4})/i);
                    if (pubYearMatch) {
                        foundYear = pubYearMatch[1];
                    }

                    // 2. Try meta tags (ISO date)
                    if (!foundYear) {
                        const metaDateMatch = pageHtml.match(/property="og:updated_time" content="(20\d{2})/i) || 
                                             pageHtml.match(/itemprop="datePublished" content="(20\d{2})/i) ||
                                             pageHtml.match(/content="(20\d{2})-\d{2}-\d{2}"/i);
                        if (metaDateMatch) {
                            foundYear = metaDateMatch[1];
                        }
                    }

                    // 3. Last resort: ANY release-year link
                    if (!foundYear) {
                        const anyYearMatch = pageHtml.match(/release-year\/(\d{4})/i);
                        if (anyYearMatch) {
                            foundYear = anyYearMatch[1];
                        }
                    }

                    if (foundYear) {
                        const targetYear = parseInt(year);
                        const fYear = parseInt(foundYear);
                        // If exact title match, be very lenient with year (sites often have wrong metadata)
                        const maxDiff = isExactMatch ? 10 : 1; 
                        if (fYear === targetYear || Math.abs(fYear - targetYear) <= maxDiff) {
                            targetUrl = result.url;
                            break;
                        }
                    } else {
                        // If no year found at all, track best title-only match
                        if (matchScore >= 2 && matchScore >= bestNoYearScore) {
                            bestNoYearScore = matchScore;
                            bestNoYearMatch = result.url;
                            if (isExactMatch) {
                                targetUrl = result.url;
                                break;
                            }
                        }
                    }
                } catch (e) {
                    // If fetch fails, but title matches strongly, we can still try it as fallback
                    if (matchScore >= 2) {
                        bestNoYearScore = Math.max(bestNoYearScore, matchScore);
                        bestNoYearMatch = result.url;
                    }
                }
            }
        }

        if (!targetUrl && bestNoYearMatch) {
            console.log(`[Guardoserie] Year not found, using best title match: ${bestNoYearMatch}`);
            targetUrl = bestNoYearMatch;
        }

        if (!targetUrl) {
            const guessed = await guessUrlFromSlug(baseUrl, title, originalTitle);
            if (guessed) {
                console.log(`[Guardoserie] Slug fallback matched: ${guessed}`);
                targetUrl = guessed;
            }
        }

        if (!targetUrl) {
            console.log(`[Guardoserie] No matching result found for ${title}`);
            return [];
        }

        let episodeUrl = targetUrl;
        if (type === 'tv' || type === 'series') {
            season = effectiveSeason;
            episode = effectiveEpisode;
            const pageRes = await fetch(targetUrl, { headers: { 
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': `${getGuardoserieBaseUrl()}/`
            } });
            const pageHtml = await pageRes.text();
            const resolvedEpisodeUrl = extractEpisodeUrlFromSeriesPage(pageHtml, season, episode);
            if (resolvedEpisodeUrl) {
                episodeUrl = resolvedEpisodeUrl;
            } else {
                console.log(`[Guardoserie] Episode ${episode} not found in Season ${season} at ${targetUrl}`);
                return [];
            }
        }

        console.log(`[Guardoserie] Found episode/movie URL: ${episodeUrl}`);
        const finalRes = await fetch(episodeUrl, { headers: { 
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': `${getGuardoserieBaseUrl()}/`
        } });
        const finalHtml = await finalRes.text();

        let playerLink = extractPlayerLinkFromHtml(finalHtml);

        // Safety fallback: if we are still on a /serie/ page, derive the episode URL and retry extraction.
        if (!playerLink && /\/serie\//i.test(episodeUrl)) {
            const fallbackEpisodeUrl = extractEpisodeUrlFromSeriesPage(finalHtml, season, episode);
            if (fallbackEpisodeUrl && fallbackEpisodeUrl !== episodeUrl) {
                console.log(`[Guardoserie] Fallback to derived episode URL: ${fallbackEpisodeUrl}`);
                const retryRes = await fetch(fallbackEpisodeUrl, { headers: {
                    'User-Agent': USER_AGENT,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Referer': `${getGuardoserieBaseUrl()}/`
                } });
                const retryHtml = await retryRes.text();
                const fallbackPlayerLink = extractPlayerLinkFromHtml(retryHtml);
                if (fallbackPlayerLink) {
                    playerLink = fallbackPlayerLink;
                    episodeUrl = fallbackEpisodeUrl;
                }
            }
        }

        if (!playerLink) {
            console.log(`[Guardoserie] No player iframe found`);
            return [];
        }

        console.log(`[Guardoserie] Found player link: ${playerLink}`);
        const displayName = (type === 'tv' || type === 'series') ? `${title} ${season}x${episode}` : title;
        let streams = [];

        if (playerLink.includes('loadm')) {
            const domain = 'guardoserie.horse';
            console.log(`[Guardoserie] Extracting Loadm: ${playerLink}`);
            // Do NOT proxy playerLink here, extractLoadm needs to parse the ID after '#'
            const extracted = await extractLoadm(playerLink, domain);
            console.log(`[Guardoserie] Loadm extraction results: ${extracted?.length || 0}`);
            for (const s of (extracted || [])) {
                // Return direct Loadm URL to Stremio; playback headers are carried in proxyHeaders.
                const directLoadmUrl = s.url;

                let quality = "HD";
                if (s.url.includes('.m3u8')) {
                    const detected = await checkQualityFromPlaylist(directLoadmUrl, s.headers || {});
                    if (detected) quality = detected;
                }
                const normalizedQuality = getQualityFromName(quality);

                streams.push(formatStream({
                    url: directLoadmUrl,
                    headers: s.headers,
                    name: `Guardoserie - Loadm`,
                    title: displayName,
                    quality: normalizedQuality,
                    type: "direct",
                    behaviorHints: s.behaviorHints
                }, 'Guardoserie'));
            }
        } else if (playerLink.includes('uqload')) {
            // Do NOT proxy playerLink here, extractUqload needs to parse the HTML first
            const extracted = await extractUqload(playerLink);
            if (extracted && extracted.url) {
                let quality = "HD";
                const normalizedQuality = getQualityFromName(quality);
                streams.push(formatStream({
                    url: extracted.url,
                    headers: extracted.headers,
                    name: `Guardoserie - Uqload`,
                    title: displayName,
                    quality: normalizedQuality,
                    type: "direct"
                }, 'Guardoserie'));
            }
        } else if (playerLink.includes('dropload')) {
            // Do NOT proxy playerLink here, extractDropLoad needs to parse the HTML first
            const extracted = await extractDropLoad(playerLink);
            if (extracted && extracted.url) {
                let quality = "HD";
                if (extracted.url.includes('.m3u8')) {
                    const detected = await checkQualityFromPlaylist(extracted.url, extracted.headers || {});
                    if (detected) quality = detected;
                }
                const normalizedQuality = getQualityFromName(quality);
                streams.push(formatStream({
                    url: extracted.url,
                    headers: extracted.headers,
                    name: `Guardoserie - DropLoad`,
                    title: displayName,
                    quality: normalizedQuality,
                    type: "direct"
                }, 'Guardoserie'));
            }
        }

        return streams;
    } catch (e) {
        console.error(`[Guardoserie] Error:`, e);
        return [];
    }
}

module.exports = { getStreams };
