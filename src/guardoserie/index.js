const { USER_AGENT } = require('../extractors/common');
const { extractLoadm, extractUqload, extractDropLoad } = require('../extractors');
const { formatStream } = require('../formatter');
const { getTmdbFromKitsu } = require('../tmdb_helper');
const { checkQualityFromPlaylist } = require('../quality_helper');

const BASE_URL = 'https://guardoserie.horse';
const TMDB_API_KEY = '68e094699525b18a70bab2f86b1fa706';

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

async function getStreams(id, type, season, episode) {
    try {
        let tmdbId = id;
        if (id.toString().startsWith('tt')) {
            // Need to convert IMDb to TMDB for title/year info
            const url = `https://api.themoviedb.org/3/find/${id}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                if (type === 'movie' && data.movie_results?.length > 0) tmdbId = data.movie_results[0].id;
                else if ((type === 'series' || type === 'tv') && data.tv_results?.length > 0) tmdbId = data.tv_results[0].id;
            }
        } else if (id.toString().startsWith('kitsu:')) {
            const resolved = await getTmdbFromKitsu(id);
            if (resolved && resolved.tmdbId) {
                tmdbId = resolved.tmdbId;
                if (resolved.season) season = resolved.season;
            }
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
            const params = new URLSearchParams({
                s: query,
                action: 'searchwp_live_search',
                swpengine: 'default',
                swpquery: query
            });

            const response = await fetch(searchUrl, {
                method: 'POST',
                headers: {
                    'User-Agent': USER_AGENT,
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Origin': BASE_URL,
                    'Referer': `${BASE_URL}/`
                },
                body: params.toString()
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

        let targetUrl = null;
        for (const result of allResults) {
            // Check title match first to avoid unnecessary fetches
            const norm = (s) => decodeEntities(s).toLowerCase().replace(/[^a-z0-9]/g, '').replace('iltronodispade', 'gameofthrones');
            const nTitle = norm(title);
            const nOrig = norm(originalTitle || '');
            const nResult = norm(result.title);

            console.log(`[Guardoserie] Comparing: "${nResult}" vs "${nTitle}" or "${nOrig}"`);

            const isExactMatch = nResult === nTitle || nResult === nOrig;
            const isPartialMatch = nResult.includes(nTitle) || (nOrig && nResult.includes(nOrig));

            if (isExactMatch || isPartialMatch) {
                // Verify year in the page
                try {
                    const pageRes = await fetch(result.url, { headers: { 'User-Agent': USER_AGENT } });
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
            const pageRes = await fetch(targetUrl, { headers: { 'User-Agent': USER_AGENT } });
            const pageHtml = await pageRes.text();

            const seasonIndex = parseInt(season) - 1;
            const episodeIndex = parseInt(episode) - 1;

            // Split by les-content which contains episodes for each season
            const seasonBlocks = pageHtml.split(/class="les-content"/i);
            
            if (seasonBlocks.length > seasonIndex + 1) {
                const targetSeasonBlock = seasonBlocks[seasonIndex + 1];
                // Limit to the end of this block to avoid matches from next seasons
                const blockEnd = targetSeasonBlock.indexOf('</div>');
                const cleanBlock = blockEnd !== -1 ? targetSeasonBlock.substring(0, blockEnd) : targetSeasonBlock;
                
                const episodeRegex = /<a[^>]+href="([^"]+)"[^>]*>/g;
                const episodes = [];
                let eMatch;
                while ((eMatch = episodeRegex.exec(cleanBlock)) !== null) {
                    episodes.push(eMatch[1]);
                }
                
                if (episodes.length > episodeIndex) {
                    episodeUrl = episodes[episodeIndex];
                } else {
                    console.log(`[Guardoserie] Episode ${episode} not found in Season ${season} block`);
                    return [];
                }
            } else {
                console.log(`[Guardoserie] Season ${season} block not found at ${targetUrl}`);
                return [];
            }
        }

        console.log(`[Guardoserie] Found episode/movie URL: ${episodeUrl}`);
        const finalRes = await fetch(episodeUrl, { headers: { 'User-Agent': USER_AGENT } });
        const finalHtml = await finalRes.text();

        // Extract player link using regex
        // Skip common SVG base64 placeholders
        const iframeMatches = finalHtml.match(/<iframe[^>]+(?:src|data-src)="([^"]+)"/ig);
        let playerLink = null;
        if (iframeMatches) {
            for (const matchStr of iframeMatches) {
                const srcMatch = matchStr.match(/(?:src|data-src)="([^"]+)"/i);
                if (srcMatch && !srcMatch[1].startsWith('data:')) {
                    playerLink = srcMatch[1];
                    break;
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
            const domain = new URL(BASE_URL).hostname;
            const extracted = await extractLoadm(playerLink, domain);
            for (const s of (extracted || [])) {
                let quality = "HD";
                if (s.url.includes('.m3u8')) {
                    const detected = await checkQualityFromPlaylist(s.url, s.headers || {});
                    if (detected) quality = detected;
                }
                const normalizedQuality = getQualityFromName(quality);

                streams.push(formatStream({
                    url: s.url,
                    headers: s.headers,
                    name: `Guardoserie - Loadm`,
                    title: displayName,
                    quality: normalizedQuality,
                    type: "direct",
                    behaviorHints: s.behaviorHints
                }, 'Guardoserie'));
            }
        } else if (playerLink.includes('uqload')) {
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
