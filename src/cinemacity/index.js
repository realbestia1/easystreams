"use strict";

const { formatStream } = require('../formatter.js');
const { checkQualityFromPlaylist } = require('../quality_helper.js');
const { fetchWithTimeout } = require('../fetch_helper.js');

// Environment detection: Server (Node) or Client (Nuvio/React Native)
const IS_SERVER = typeof process !== 'undefined' && process.versions && process.versions.node;
const { smartFetch } = IS_SERVER ? require('../utils/cf_handler') : { smartFetch: null };

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

// Cross-platform Base64 decoder for Node.js and React Native (Nuvio/Hermes)
function base64Decode(str) {
    try {
        if (typeof atob === 'function') {
            return decodeURIComponent(escape(atob(str)));
        }
    } catch (e) {
        // Fall through to the JS decoder below.
    }

    try {
        let output = "";
        let buffer = 0;
        let bits = 0;
        const input = String(str || "").replace(/[^A-Za-z0-9+/=]/g, "");

        for (let i = 0; i < input.length; i++) {
            const char = input.charAt(i);
            if (char === "=") break;

            const value = BASE64_CHARS.indexOf(char);
            if (value < 0) continue;

            buffer = (buffer << 6) | value;
            bits += 6;

            if (bits >= 8) {
                bits -= 8;
                output += String.fromCharCode((buffer >> bits) & 0xff);
            }
        }

        try {
            return decodeURIComponent(escape(output));
        } catch {
            return output;
        }
    } catch (e) {
        console.error("[CinemaCity] Base64 decode error:", e);
        return "";
    }
}

// Obfuscate the base URL to prevent simple string matching
const BASE_URL = base64Decode("aHR0cHM6Ly9jaW5lbWFjaXR5LmNj");
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const FETCH_TIMEOUT = 10000;
const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";

function getMappingApiUrl() {
    return "https://animemapping.realbestia.com";
}

function normalizeConfigBoolean(value) {
    if (value === true) return true;
    const normalized = String(value || "").trim().toLowerCase();
    return ["1", "true", "yes", "on", "enabled", "checked"].includes(normalized);
}

function getMappingLanguage(providerContext = null) {
    const explicit = String(providerContext?.mappingLanguage || "").trim().toLowerCase();
    if (explicit === "it") return "it";
    return normalizeConfigBoolean(providerContext?.easyCatalogsLangIt) ? "it" : null;
}

// Static auth cookie for DLE engine
function getSessionCookies() {
    const cookieB64 = "ZGxlX3VzZXJfaWQ9MzI3Mjk7IGRsZV9wYXNzd29yZD04OTQxNzFjNmE4ZGFiMThlZTU5NGQ1YzY1MjAwOWEzNTs=";
    return base64Decode(cookieB64);
}

async function fetchPage(url, options = {}) {
    const headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
        ...options.headers
    };

    if (IS_SERVER) {
        return await smartFetch(url, BASE_URL, {
            timeout: options.timeout || FETCH_TIMEOUT,
            method: options.method,
            body: options.body,
            headers
        });
    }

    const response = await fetchWithTimeout(url, {
        timeout: options.timeout || FETCH_TIMEOUT,
        method: options.method || 'GET',
        headers,
        body: options.body
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
}

async function getIdsFromKitsu(kitsuId, season, episode, providerContext = null) {
    try {
        if (!kitsuId) return null;

        const params = new URLSearchParams();
        const parsedEpisode = Number.parseInt(String(episode || ""), 10);
        const parsedSeason = Number.parseInt(String(season || ""), 10);
        params.set("ep", Number.isInteger(parsedEpisode) && parsedEpisode > 0 ? String(parsedEpisode) : "1");
        if (Number.isInteger(parsedSeason) && parsedSeason >= 0) {
            params.set("s", String(parsedSeason));
        }

        const mappingLanguage = getMappingLanguage(providerContext);
        if (mappingLanguage) {
            params.set("lang", mappingLanguage);
        }

        const url = `${getMappingApiUrl()}/kitsu/${encodeURIComponent(String(kitsuId).trim())}?${params.toString()}`;
        const response = await fetchWithTimeout(url, { timeout: FETCH_TIMEOUT });
        if (!response.ok) return null;

        const payload = await response.json();
        const ids = payload && payload.mappings && payload.mappings.ids ? payload.mappings.ids : {};
        const tmdbEpisode =
            (payload && payload.mappings && (payload.mappings.tmdb_episode || payload.mappings.tmdbEpisode)) ||
            (payload && (payload.tmdb_episode || payload.tmdbEpisode)) ||
            null;
        const tmdbId = ids && /^\d+$/.test(String(ids.tmdb || "").trim()) ? String(ids.tmdb).trim() : null;
        const imdbId = ids && /^tt\d+$/i.test(String(ids.imdb || "").trim()) ? String(ids.imdb).trim() : null;
        const mappedSeason = Number.parseInt(String(
            tmdbEpisode && (tmdbEpisode.season || tmdbEpisode.seasonNumber || tmdbEpisode.season_number) || ""
        ), 10);
        const mappedEpisode = Number.parseInt(String(
            tmdbEpisode && (tmdbEpisode.episode || tmdbEpisode.episodeNumber || tmdbEpisode.episode_number) || ""
        ), 10);
        const rawEpisodeNumber = Number.parseInt(String(
            tmdbEpisode && (tmdbEpisode.rawEpisodeNumber || tmdbEpisode.raw_episode_number || tmdbEpisode.rawEpisode) || ""
        ), 10);

        return {
            tmdbId,
            imdbId,
            mappedSeason: Number.isInteger(mappedSeason) && mappedSeason > 0 ? mappedSeason : null,
            mappedEpisode: Number.isInteger(mappedEpisode) && mappedEpisode > 0 ? mappedEpisode : null,
            rawEpisodeNumber: Number.isInteger(rawEpisodeNumber) && rawEpisodeNumber > 0 ? rawEpisodeNumber : null
        };
    } catch (e) {
        console.error("[CinemaCity] Kitsu mapping error:", e);
        return null;
    }
}

async function searchByImdb(imdbId) {
    const trySearch = async (query) => {
        const searchUrl = `${BASE_URL}/index.php?do=search&subaction=search&story=${query}`;
        try {
            const html = await fetchPage(searchUrl, {
                timeout: FETCH_TIMEOUT,
                headers: {
                    "Referer": `${BASE_URL}/`
                }
            });

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
            console.error(`[CinemaCity] Search error for ${query}:`, e);
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
    const contextTmdbId = providerContext && /^\d+$/.test(String(providerContext.tmdbId || ""))
        ? String(providerContext.tmdbId)
        : null;
    const contextImdbId = providerContext && /^tt\d+$/i.test(String(providerContext.imdbId || ""))
        ? String(providerContext.imdbId)
        : null;
    const contextKitsuId = providerContext && /^\d+$/.test(String(providerContext.kitsuId || ""))
        ? String(providerContext.kitsuId)
        : null;
    const shouldIncludeSeasonHintForKitsu =
        providerContext && providerContext.seasonProvided === true;

    if (imdbId.startsWith("kitsu:") || contextKitsuId) {
        const kitsuId =
            contextKitsuId ||
            (((imdbId.match(/^kitsu:(\d+)/i) || [])[1]) || null);
        const seasonHintForKitsu = shouldIncludeSeasonHintForKitsu ? season : null;
        const mapped = kitsuId ? await getIdsFromKitsu(kitsuId, seasonHintForKitsu, episode, providerContext) : null;

        if (mapped) {
            if (mapped.imdbId) {
                imdbId = mapped.imdbId;
            } else if (mapped.tmdbId) {
                imdbId = mapped.tmdbId;
            }

            if (mapped.mappedSeason && mapped.mappedEpisode) {
                season = mapped.mappedSeason;
                episode = mapped.mappedEpisode;
            } else if (mapped.rawEpisodeNumber) {
                episode = mapped.rawEpisodeNumber;
            }
        }
    }

    if (!imdbId.startsWith("tt") && contextImdbId) {
        imdbId = contextImdbId;
    } else if (!/^\d+$/.test(imdbId) && contextTmdbId) {
        imdbId = contextTmdbId;
    }

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

                    const response = await fetchWithTimeout(externalUrl, { timeout: FETCH_TIMEOUT });
                    if (response.ok) {
                        const data = await response.json();
                        if (data.imdb_id) {
                            imdbId = data.imdb_id;
                        }
                    }
                }
            } catch (e) {
                console.error("[CinemaCity] TMDB to IMDb resolution error:", e);
            }
        }
    }

    if (!imdbId.startsWith("tt")) {
        return [];
    }

    try {
        const isStremioAddon = providerContext && providerContext.__requestContext === true;
        const proxyUrl = (providerContext && providerContext.proxyUrl) || (typeof global !== 'undefined' && global.CF_PROXY_URL ? global.CF_PROXY_URL : null);
        const proxyPassword = (providerContext && providerContext.proxyPassword) || "";

        const searchResult = await searchByImdb(imdbId);
        if (!searchResult || !searchResult.url) {
            return [];
        }

        const movieUrl = searchResult.url;
        let movieTitle = (searchResult.title || imdbId).replace(/\s*\(.*?\)\s*/g, '').trim();

        if (type === 'tv' || type === 'series') {
            movieTitle += ` ${season}x${episode}`;
        }

        if (isStremioAddon) {
            if (!proxyUrl) {
                return [];
            }

            let finalTargetUrl = movieUrl;
            if (type === 'tv' || type === 'series') {
                const separator = finalTargetUrl.includes('?') ? '&' : '?';
                finalTargetUrl += `${separator}s=${season}&e=${episode}`;
            }

            const passwordQuery = proxyPassword ? `&api_password=${encodeURIComponent(proxyPassword)}` : '';
            const extractorUrl = `${proxyUrl}/extractor/video.m3u8?host=city&d=${encodeURIComponent(finalTargetUrl)}&redirect_stream=true${passwordQuery}`;

            const stremioResult = {
                name: "CinemaCity",
                title: movieTitle,
                url: extractorUrl,
                quality: "1080p",
                type: "direct",
                behaviorHints: {
                    notWebReady: true
                }
            };

            return [formatStream(stremioResult, "CinemaCity")];
        }

        const html = await fetchPage(movieUrl, {
            timeout: FETCH_TIMEOUT,
            headers: {
                "Referer": `${BASE_URL}/`
            }
        });

        const playerReferer = extractPlayerReferer(html, movieUrl);
        const cookies = getSessionCookies();

        // Cinemacity uses two mechanisms:
        // A) file:atob("...JSON...")
        // B) eval(atob("...JS script containing file:'[...JSON...]'..."))
        const atobRegex = /atob\s*\(\s*['"](.*?)['"]\s*\)/gi;
        let match;
        let fileData = null;

        while ((match = atobRegex.exec(html)) !== null) {
            const encoded = match[1];
            try {
                if (encoded.length < 50) continue;

                let decoded;
                try {
                    decoded = base64Decode(encoded);
                } catch (e) {
                    continue;
                }

                if (!decoded) continue;

                if (decoded.trim().startsWith("[")) {
                    try {
                        fileData = JSON.parse(decoded);
                        if (fileData && fileData.length > 0) break;
                    } catch (e) { }
                }

                const rawJson = extractJsonArray(decoded);
                if (rawJson) {
                    try {
                        const cleanJson = rawJson.replace(/\\(.)/g, '$1');
                        fileData = JSON.parse(cleanJson);
                    } catch (e) {
                        try {
                            fileData = JSON.parse(rawJson);
                        } catch (e2) { }
                    }
                    if (fileData && fileData.length > 0) break;
                }

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
            return [];
        }

        const streamUrl = pickStream(fileData, type, season, episode);
        if (!streamUrl) return [];

        const streamHeaders = {
            "User-Agent": USER_AGENT,
            "Referer": playerReferer,
            "Origin": getOrigin(movieUrl),
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.5",
            "Connection": "keep-alive",
            "Cookie": cookies
        };
        const finalResult = {
            name: "CinemaCity",
            title: movieTitle,
            url: streamUrl,
            quality: "1080p",
            type: "direct",
            headers: streamHeaders,
            behaviorHints: {
                notWebReady: true
            }
        };

        if (streamUrl.includes(".m3u8")) {
            const detectedQuality = await checkQualityFromPlaylist(streamUrl, finalResult.headers);
            if (detectedQuality) finalResult.quality = detectedQuality;
        }

        return [formatStream(finalResult, "CinemaCity")];

    } catch (e) {
        console.error("[CinemaCity] Error:", e);
        return [];
    }
}

module.exports = { getStreams };
