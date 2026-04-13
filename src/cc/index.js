"use strict";

const { formatStream } = require('../formatter.js');
const { checkQualityFromPlaylist } = require('../quality_helper.js');
const { createTimeoutSignal } = require('../fetch_helper.js');

// Cross-platform Base64 decoder for Node.js and React Native (Nuvio)
function base64Decode(str) {
    try {
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(str, 'base64').toString('utf8');
        } else if (typeof atob !== 'undefined') {
            return decodeURIComponent(escape(atob(str)));
        }
    } catch (e) {
        console.error("[CC] Base64 decode error:", e);
    }
    return "";
}

// Obfuscate the base URL to prevent simple string matching
const BASE_URL = base64Decode("aHR0cHM6Ly9jaW5lbWFjaXR5LmNj");
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const FETCH_TIMEOUT = 10000;
const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";

// Static auth cookie for DLE engine
function getSessionCookies() {
    const cookieB64 = "ZGxlX3VzZXJfaWQ9MzI3Mjk7IGRsZV9wYXNzd29yZD04OTQxNzFjNmE4ZGFiMThlZTU5NGQ1YzY1MjAwOWEzNTs=";
    return base64Decode(cookieB64);
}

async function searchByImdb(imdbId) {
    const cookies = getSessionCookies();
    
    const trySearch = async (query) => {
        const searchUrl = `${BASE_URL}/index.php?do=search&subaction=search&story=${query}`;
        console.log(`[CC] Searching for query: ${query}`);
        try {
            const response = await fetch(searchUrl, {
                headers: {
                    "User-Agent": USER_AGENT,
                    "Cookie": cookies || "",
                    "Referer": `${BASE_URL}/`
                }
            });

            if (!response.ok) return null;
            const html = await response.text();
            
            // DLE search result markers
            const resultMatch = html.match(/Found\s+(\d+)\s+responses/i) || 
                               html.match(/Trovat[io]\s+(\d+)\s+risultat[io]/i) ||
                               html.match(/Query results\s*\d+\s*-\s*(\d+)/i);
            
            if (!resultMatch || parseInt(resultMatch[1]) === 0) {
                // If the query is not in the text and no results found, skip
                if (!html.includes(query)) return null;
            }

            // Isolate search results area
            // If we can't find a clear start for results (marker or container), we MUST NOT search the whole page
            let searchArea = "";
            const markerIdx = resultMatch ? html.indexOf(resultMatch[0]) : html.indexOf('id="dle-content"');
            
            if (markerIdx === -1) {
                // Secondary check for "no results" text to be sure
                if (html.includes("site search yielded no results") || html.includes("ricerca non ha prodotto risultati")) {
                    return null;
                }
                // If we don't find a marker and it's not a clear "no result" page, 
                // we still shouldn't search the whole page because of the Top 3 suggestions.
                return null;
            }

            // Take content after the results label, but before common footer/side elements
            const contentEndStrings = ['id="side"', "class='side'", '<footer', '<aside'];
            let contentEndIdx = html.length;
            for (const s of contentEndStrings) {
                const pos = html.indexOf(s, markerIdx);
                if (pos !== -1 && pos < contentEndIdx) contentEndIdx = pos;
            }
            searchArea = html.substring(markerIdx, contentEndIdx);

            // Find any movie/anime/series/tv-series link in the results
            // We match the full tag to get the title
            const links = [...searchArea.matchAll(/<a[^>]+href=["']((?:https?:\/\/cinemacity\.cc)?\/(?:movies|anime|series|tv-series)\/\d+-[^"']+\.html)["'][^>]*>([\s\S]*?)<\/a>/gi)];
            
            if (links.length > 0) {
                // The first link after the "Found X responses" marker is almost certainly the correct result
                let bestMatch = links[0];
                
                // If we find the query text (or numeric ID) in the search area, pick the link closest to it
                const queryPos = searchArea.indexOf(query);
                if (queryPos !== -1) {
                    let minDistance = Infinity;
                    for (const match of links) {
                        const distance = Math.abs(match.index - queryPos);
                        if (distance < minDistance) {
                            minDistance = distance;
                            bestMatch = match;
                        }
                    }
                }

                let bestLink = bestMatch[1];
                let bestTitle = bestMatch[2].replace(/<[^>]*>?/gm, '').trim(); // Remove any nested tags and trim

                if (bestLink.startsWith("/")) bestLink = BASE_URL + bestLink;
                return { url: bestLink, title: bestTitle };
            }
        } catch (e) {
            console.error(`[CC] Search error for ${query}:`, e);
        }
        return null;
    };

    let link = await trySearch(imdbId);
    if (link) return link;

    const numericId = imdbId.replace(/\D/g, "");
    if (numericId && numericId !== imdbId) {
        link = await trySearch(numericId);
    }

    return link;
}

function extractJsonArray(decoded) {
    let start = decoded.indexOf("file:");
    if (start === -1) start = decoded.indexOf("sources:");
    if (start === -1) return null;

    start = decoded.indexOf("[", start);
    if (start === -1) return null;

    let depth = 0;
    for (let i = start; i < decoded.length; i++) {
        if (decoded[i] === "[") depth++;
        else if (decoded[i] === "]") depth--;
        
        if (depth === 0) {
            return decoded.substring(start, i + 1);
        }
    }
    return null;
}

function resolveUrl(baseUrl, relativeOrAbsoluteUrl) {
    try {
        return new URL(relativeOrAbsoluteUrl, baseUrl).toString();
    } catch {
        return relativeOrAbsoluteUrl;
    }
}

function getOrigin(url) {
    try {
        return new URL(url).origin;
    } catch {
        return BASE_URL;
    }
}

function extractPlayerReferer(html, pageUrl) {
    const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']*player\.php[^"']*)["']/i);
    if (!iframeMatch || !iframeMatch[1]) {
        return pageUrl;
    }

    return resolveUrl(pageUrl, iframeMatch[1]);
}

function parseCompositeSeriesId(rawId, season, episode) {
    const parsed = {
        normalizedId: String(rawId || "").trim(),
        season: Number.isInteger(season) ? season : (Number.parseInt(season, 10) || 1),
        episode: Number.isInteger(episode) ? episode : (Number.parseInt(episode, 10) || 1)
    };

    const match = parsed.normalizedId.match(/^(tt\d+|\d+|tmdb:\d+):(\d+):(\d+)$/i);
    if (!match) {
        return parsed;
    }

    parsed.normalizedId = match[1];
    parsed.season = Number.parseInt(match[2], 10) || parsed.season;
    parsed.episode = Number.parseInt(match[3], 10) || parsed.episode;
    return parsed;
}

function pickStream(fileData, type, season = 1, episode = 1) {
    if (typeof fileData === 'string') {
        return fileData;
    }

    if (Array.isArray(fileData)) {
        // Case 1: Simple list of sources or qualities (Movie context)
        if (type === 'movie' || fileData.every(x => x && typeof x === 'object' && "file" in x && !("folder" in x))) {
            return fileData[0]?.file;
        }

        // Case 2: Nested series structure (Seasons -> Episodes)
        let selectedSeasonFolder = null;
        for (const s of fileData) {
            if (!s || typeof s !== 'object' || !s.folder) continue;
            
            const title = (s.title || "").toLowerCase();
            // Matches "Season 1", "Stagione 1", "S1", "S 1", "S 01", etc.
            const seasonRegex = new RegExp(`(?:season|stagione|s)\\s*0*${season}\\b`, "i");
            if (seasonRegex.test(title)) {
                selectedSeasonFolder = s.folder;
                break;
            }
        }

        // Fallback to first season if specific match fails
        if (!selectedSeasonFolder && fileData.length > 0) {
            for (const s of fileData) {
                if (s && s.folder) {
                    selectedSeasonFolder = s.folder;
                    break;
                }
            }
        }

        if (!selectedSeasonFolder) return null;

        // Try to find the exact episode by title
        let selectedEpisodeFile = null;
        for (const e of selectedSeasonFolder) {
            if (!e || typeof e !== 'object' || !e.file) continue;
            
            const title = (e.title || "").toLowerCase();
            // Matches "Episode 1", "Episodio 1", "E1", "E 1", "E 01", etc.
            const epRegex = new RegExp(`(?:episode|episodio|e)\\s*0*${episode}\\b`, "i");
            if (epRegex.test(title)) {
                selectedEpisodeFile = e.file;
                break;
            }
        }

        // Fallback to index if title match fails
        if (!selectedEpisodeFile) {
            const idx = Math.max(0, episode - 1);
            const epData = idx < selectedSeasonFolder.length ? selectedSeasonFolder[idx] : selectedSeasonFolder[0];
            selectedEpisodeFile = epData?.file || null;
        }

        return selectedEpisodeFile;
    }

    return null;
}

async function getStreams(id, type, season, episode, providerContext = null) {
    const parsedRequest = parseCompositeSeriesId(id, season, episode);
    id = parsedRequest.normalizedId;
    season = parsedRequest.season;
    episode = parsedRequest.episode;

    let imdbId = String(id || "").trim();
    const providerType = (type === 'tv' || type === 'series' || type === 'anime') ? 'tv' : 'movie';

    // If it's a numeric ID (TMDB), try to resolve IMDb ID
    if (!imdbId.startsWith("tt")) {
        // Check if providerContext already has it
        if (providerContext && providerContext.imdbId && providerContext.imdbId.startsWith("tt")) {
            imdbId = providerContext.imdbId;
        } else {
            // Fetch from TMDB API
            try {
                const tmdbId = imdbId.replace(/\D/g, "");
                if (tmdbId) {
                    let externalUrl = "";
                    if (providerType === 'movie') {
                        externalUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`;
                    } else {
                        externalUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
                    }
                    
                    const response = await fetch(externalUrl);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.imdb_id) imdbId = data.imdb_id;
                    }
                }
            } catch (e) {
                console.error("[CC] TMDB to IMDb resolution error:", e);
            }
        }
    }
    
    if (!imdbId.startsWith("tt")) {
        console.log(`[CC] Could not resolve IMDb ID for TMDB: ${id}. CC requires IMDb ID for searching.`);
        return [];
    }

    try {
        const isStremioAddon = providerContext && providerContext.__requestContext === true;
        const proxyUrl = (providerContext && providerContext.proxyUrl) || (typeof global !== 'undefined' && global.CF_PROXY_URL ? global.CF_PROXY_URL : null);

        const searchResult = await searchByImdb(imdbId);
        if (!searchResult || !searchResult.url) {
            console.log(`[CC] No results found for IMDb: ${imdbId}`);
            return [];
        }

        const movieUrl = searchResult.url;
        let movieTitle = (searchResult.title || imdbId).replace(/\s*\(.*?\)\s*/g, '').trim(); 
        
        if (type === 'tv' || type === 'series') {
            movieTitle += ` ${season}x${episode}`;
        }

        console.log(`[CC] Found URL and Title: ${movieUrl} (${movieTitle})`);

        if (isStremioAddon) {
            if (!proxyUrl) {
                console.log(`[CC] Skipping Stremio Addon execution because proxy is not configured.`);
                return [];
            }

            let finalTargetUrl = movieUrl;
            if (type === 'tv' || type === 'series') {
                const separator = finalTargetUrl.includes('?') ? '&' : '?';
                finalTargetUrl += `${separator}s=${season}&e=${episode}`;
            }

            const extractorUrl = `${proxyUrl}/extractor/video?host=city&url=${encodeURIComponent(finalTargetUrl)}&redirect_stream=true`;

            console.log(`[CC] Using EasyProxy extractor: ${extractorUrl}`);

            const result = {
                name: "CC",
                title: movieTitle,
                url: extractorUrl,
                quality: "1080p",
                type: "direct",
                behaviorHints: {
                    notWebReady: true
                }
            };

            return [formatStream(result, "CC")];
        }

        // Logic for Nuvio Plugin (direct HTML extraction)
        console.log(`[CC] Executing direct HTML extraction for Nuvio plugin...`);
        const cookies = getSessionCookies();
        const response = await fetch(movieUrl, {
            headers: {
                "User-Agent": USER_AGENT,
                "Cookie": cookies,
                "Referer": `${BASE_URL}/`
            }
        });

        if (!response.ok) return [];
        const html = await response.text();
        const playerReferer = extractPlayerReferer(html, movieUrl);

        // Cinemacity uses two mechanisms:
        // A) file:atob("...JSON...")
        // B) eval(atob("...JS script containing file:'[...JSON...]'..."))
        // So we match all atob calls and try to extract the JSON.
        const atobRegex = /atob\s*\(\s*['"](.*?)['"]\s*\)/gi;
        let match;
        let fileData = null;

        while ((match = atobRegex.exec(html)) !== null) {
            const encoded = match[1];
            try {
                // Ignore very short strings
                if (encoded.length < 50) continue; 
                
                let decoded;
                try {
                    decoded = base64Decode(encoded);
                } catch(e) {
                    continue;
                }
                
                if (!decoded) continue;

                // Mechanism A: the decoded payload is the JSON itself
                if (decoded.trim().startsWith("[")) {
                   try {
                       fileData = JSON.parse(decoded);
                       if (fileData && fileData.length > 0) break;
                   } catch(e) {}
                }

                // Mechanism B: the decoded payload is a JS script containing the JSON in a "file:" property
                const rawJson = extractJsonArray(decoded);
                if (rawJson) {
                    try {
                        // Sometimes the string is escaped
                        const cleanJson = rawJson.replace(/\\(.)/g, '$1');
                        fileData = JSON.parse(cleanJson);
                    } catch (e) {
                        try {
                            fileData = JSON.parse(rawJson);
                        } catch(e2) {}
                    }
                    if (fileData && fileData.length > 0) break;
                }

                // Fallback for single file streams
                const fileMatch = decoded.match(/(?:file|sources)\s*:\s*['"](.*?)['"]/i);
                if (fileMatch) {
                    const url = fileMatch[1];
                    if (url.includes('.m3u8') || url.includes('.mp4')) {
                        fileData = url;
                        break;
                    }
                }
            } catch (e) {
                continue;
            }
        }

        if (!fileData) {
            console.log(`[CC] Could not extract stream info from: ${movieUrl}`);
            return [];
        }

        const streamUrl = pickStream(fileData, type, season, episode);
        if (!streamUrl) return [];

        console.log(`[CC] Found stream: ${streamUrl}`);

        const results = [];
        const streamHeaders = {
            "User-Agent": USER_AGENT,
            "Referer": playerReferer,
            "Origin": getOrigin(movieUrl),
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.5",
            "Connection": "keep-alive",
            "Cookie": cookies
        };
        const result = {
            name: "CC",
            title: movieTitle,
            url: streamUrl,
            quality: "1080p",
            type: "direct",
            headers: streamHeaders,
            behaviorHints: {
                notWebReady: false
            }
        };

        if (streamUrl.includes(".m3u8")) {
            const detectedQuality = await checkQualityFromPlaylist(streamUrl, result.headers);
            if (detectedQuality) result.quality = detectedQuality;
        }

        results.push(formatStream(result, "CC"));
        return results;

    } catch (e) {
        console.error("[CC] Error:", e);
        return [];
    }
}

module.exports = { getStreams };
