const { USER_AGENT, getProxiedUrl } = require('../extractors/common');
const { extractLoadm, extractUqload, extractDropLoad } = require('../extractors');
const { formatStream } = require('../formatter');
const { getTmdbFromKitsu } = require('../tmdb_helper');
const { checkQualityFromPlaylist } = require('../quality_helper');

const BASE_URL = 'https://guardoserie.space';
const TMDB_API_KEY = '68e094699525b18a70bab2f86b1fa706';

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
        normalized = `${BASE_URL}${normalized}`;
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
        let tmdbId = id;
        const contextTmdbId = providerContext && /^\d+$/.test(String(providerContext.tmdbId || ''))
            ? String(providerContext.tmdbId)
            : null;
        const parsedContextSeason = parseInt(providerContext && providerContext.canonicalSeason, 10);
        const hasContextSeason = Number.isInteger(parsedContextSeason) && parsedContextSeason >= 0;

        if (id.toString().startsWith('tt')) {
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
        } else if (id.toString().startsWith('kitsu:')) {
            if (contextTmdbId) {
                tmdbId = contextTmdbId;
                if (hasContextSeason && season !== parsedContextSeason) {
                    season = parsedContextSeason;
                }
                console.log(`[Guardoserie] Using prefetched mapping for ${id} -> TMDB ${tmdbId}, Season ${season}`);
            } else {
                const resolved = await getTmdbFromKitsu(id);
                if (resolved && resolved.tmdbId) {
                    tmdbId = resolved.tmdbId;
                    if (resolved.season) season = resolved.season;
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
            const searchUrl = `${BASE_URL}/wp-admin/admin-ajax.php`;
            const body = `s=${encodeURIComponent(query)}&action=searchwp_live_search&swpengine=default&swpquery=${encodeURIComponent(query)}`;

            const response = await fetch(searchUrl, {
                method: 'POST',
                headers: {
                    'User-Agent': USER_AGENT,
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Origin': BASE_URL,
                    'Referer': `${BASE_URL}/`
                },
                body: body
            });

            if (!response.ok) return [];
            const searchHtml = await response.text();
            const results = [];
            // Match title and URL more robustly
            const itemRegex = /<a[^>]+href="([^"]+)"[^>]+class="ss-title"[^>]*>(.*?)<\/a>/g;
            let match;
            while ((match = itemRegex.exec(searchHtml)) !== null) {
                const rTitle = match[2].replace(/<[^>]+>/g, '').trim();
                results.push({
                    url: match[1],
                    title: rTitle
                });
            }
            
            // Fallback for different attribute order
            if (results.length === 0) {
                const itemRegexFallback = /<a[^>]+class="ss-title"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/g;
                while ((match = itemRegexFallback.exec(searchHtml)) !== null) {
                    results.push({
                        url: match[1],
                        title: match[2].replace(/<[^>]+>/g, '').trim()
                    });
                }
            }

            return results;
        };

        let allResults = [];
        const queries = [title, originalTitle].filter(q => q && q.length > 2);
        for (const q of queries) {
            const res = await searchProvider(q);
            allResults.push(...res);
        }

        // Deduplicate results by URL
        allResults = Array.from(new Map(allResults.map(item => [item.url, item])).values());

        const decodeEntities = (str) => {
            return str.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
                      .replace(/&quot;/g, '"')
                      .replace(/&amp;/g, '&')
                      .replace(/&lt;/g, '<')
                      .replace(/&gt;/g, '>')
                      .replace(/&#8211;/g, '-')
                      .replace(/&#8217;/g, "'");
        };

        // Sort results: exact matches first
        const norm = (s) => decodeEntities(s).toLowerCase().replace(/[^a-z0-9]/g, '').replace('iltronodispade', 'gameofthrones');
        const nTitle = norm(title);
        const nOrig = norm(originalTitle || '');

        allResults.sort((a, b) => {
            const nA = norm(a.title);
            const nB = norm(b.title);
            const exactA = nA === nTitle || nA === nOrig;
            const exactB = nB === nTitle || nB === nOrig;
            if (exactA && !exactB) return -1;
            if (!exactA && exactB) return 1;
            return 0;
        });

        let targetUrl = null;
        // Limit to top 10 results to avoid timeout while being thorough
        for (const result of allResults.slice(0, 10)) {
            // Check title match first to avoid unnecessary fetches
            const nResult = norm(result.title);

            const isExactMatch = nResult === nTitle || nResult === nOrig;
            const isPartialMatch = nResult.includes(nTitle) || (nOrig && nResult.includes(nOrig));

            if (isExactMatch || isPartialMatch) {
                // Verify year in the page
                try {
                    const pageRes = await fetch(getProxiedUrl(result.url), { headers: { 
                        'User-Agent': USER_AGENT,
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
                        'Referer': `${BASE_URL}/`
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
                        // If no year found at all, accept if it's an exact title match
                        if (isExactMatch) {
                            targetUrl = result.url;
                            break;
                        }
                    }
                } catch (e) {
                    // If fetch fails, but title matches, we can still try it as fallback
                    targetUrl = result.url;
                    break;
                }
            }
        }

        if (!targetUrl) {
            console.log(`[Guardoserie] No matching result found for ${title}`);
            return [];
        }

        let episodeUrl = targetUrl;
        if (type === 'tv' || type === 'series') {
            const pageRes = await fetch(getProxiedUrl(targetUrl), { headers: { 
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': `${BASE_URL}/`
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
        const finalRes = await fetch(getProxiedUrl(episodeUrl), { headers: { 
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': `${BASE_URL}/`
        } });
        const finalHtml = await finalRes.text();

        let playerLink = extractPlayerLinkFromHtml(finalHtml);

        // Safety fallback: if we are still on a /serie/ page, derive the episode URL and retry extraction.
        if (!playerLink && /\/serie\//i.test(episodeUrl)) {
            const fallbackEpisodeUrl = extractEpisodeUrlFromSeriesPage(finalHtml, season, episode);
            if (fallbackEpisodeUrl && fallbackEpisodeUrl !== episodeUrl) {
                console.log(`[Guardoserie] Fallback to derived episode URL: ${fallbackEpisodeUrl}`);
                const retryRes = await fetch(getProxiedUrl(fallbackEpisodeUrl), { headers: {
                    'User-Agent': USER_AGENT,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Referer': `${BASE_URL}/`
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
                    url: getProxiedUrl(extracted.url),
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
                    const detected = await checkQualityFromPlaylist(getProxiedUrl(extracted.url), extracted.headers || {});
                    if (detected) quality = detected;
                }
                const normalizedQuality = getQualityFromName(quality);
                streams.push(formatStream({
                    url: getProxiedUrl(extracted.url),
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
