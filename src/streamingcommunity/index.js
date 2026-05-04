function getStreamingCommunityBaseUrl() {
  return "https://vixsrc.to";
}

const { formatStream } = require('../formatter.js');
require('../fetch_helper.js');
const { checkQualityFromText } = require('../quality_helper.js');

function safeRequire(modulePath) {
  try {
    return require(modulePath);
  } catch (e) {
    return null;
  }
}

const guardahd = safeRequire('../guardahd/index');
const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
const USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

function getCommonHeaders() {
  return {
    "User-Agent": USER_AGENT,
    "Referer": `${getStreamingCommunityBaseUrl()}/`,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1"
  };
}

function getEmbedHeaders(embedUrl) {
  return {
    "User-Agent": USER_AGENT,
    "Referer": `${getStreamingCommunityBaseUrl()}/`,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7"
  };
}

function getPlaylistHeaders(embedUrl) {
  return {
    "User-Agent": USER_AGENT,
    "Referer": embedUrl,
    "Origin": getStreamingCommunityBaseUrl(),
    "Accept": "*/*",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin"
  };
}

function extractEmbedSrcFromApiPayload(payload) {
  const rawSrc = payload && typeof payload === "object" ? payload.src : null;
  if (!rawSrc) return null;
  try {
    return new URL(rawSrc, getStreamingCommunityBaseUrl()).toString();
  } catch (e) {
    return null;
  }
}

function extractMasterPlaylistFromEmbedHtml(html) {
  if (!html) return null;

  const tokenMatch = html.match(/'token'\s*:\s*'([^']+)'/i);
  const expiresMatch = html.match(/'expires'\s*:\s*'([^']+)'/i);
  const urlMatch = html.match(/url\s*:\s*'([^']+\/playlist\/\d+[^']*)'/i);

  if (!tokenMatch || !expiresMatch || !urlMatch) {
    return null;
  }

  return {
    token: tokenMatch[1],
    expires: expiresMatch[1],
    url: urlMatch[1]
  };
}

function getQualityFromName(qualityStr) {
  if (!qualityStr) return "Unknown";
  const quality = qualityStr.toUpperCase();
  if (quality === "ORG" || quality === "ORIGINAL") return "Original";
  if (quality === "4K" || quality === "2160P") return "4K";
  if (quality === "1440P" || quality === "2K") return "1440p";
  if (quality === "1080P" || quality === "FHD") return "1080p";
  if (quality === "720P" || quality === "HD") return "720p";
  if (quality === "480P" || quality === "SD") return "480p";
  if (quality === "360P") return "360p";
  if (quality === "240P") return "240p";
  const match = qualityStr.match(/(\d{3,4})[pP]?/);
  if (match) {
    const resolution = parseInt(match[1]);
    if (resolution >= 2160) return "4K";
    if (resolution >= 1440) return "1440p";
    if (resolution >= 1080) return "1080p";
    if (resolution >= 720) return "720p";
    if (resolution >= 480) return "480p";
    if (resolution >= 360) return "360p";
    return "240p";
  }
  return "Unknown";
}

async function getTmdbId(imdbId, type) {
  const normalizedType = String(type).toLowerCase();
  const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
  try {
    const response = await fetch(findUrl);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data) return null;
    if (normalizedType === "movie" && data.movie_results && data.movie_results.length > 0) {
      return data.movie_results[0].id.toString();
    } else if (normalizedType === "tv" && data.tv_results && data.tv_results.length > 0) {
      return data.tv_results[0].id.toString();
    }
    return null;
  } catch (e) {
    console.error("[StreamingCommunity] Conversion error:", e);
    return null;
  }
}

async function getMetadata(id, type) {
  try {
    const normalizedType = String(type).toLowerCase();
    let url;
    if (String(id).startsWith("tt")) {
      url = `https://api.themoviedb.org/3/find/${id}?api_key=${TMDB_API_KEY}&external_source=imdb_id&language=it-IT`;
    } else {
      const endpoint = normalizedType === "movie" ? "movie" : "tv";
      url = `https://api.themoviedb.org/3/${endpoint}/${id}?api_key=${TMDB_API_KEY}&language=it-IT`;
    }
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (String(id).startsWith("tt")) {
      const results = normalizedType === "movie" ? data.movie_results : data.tv_results;
      if (results && results.length > 0) return results[0];
    } else {
      return data;
    }
    return null;
  } catch (e) {
    console.error("[StreamingCommunity] Metadata error:", e);
    return null;
  }
}

async function hasGuardaFallbackResults(id, type, season, episode, providerContext) {
  const normalizedType = String(type).toLowerCase();
  const checks = [];

  if (normalizedType === "movie" && guardahd && typeof guardahd.getStreams === "function") {
    checks.push(
      guardahd.getStreams(id, normalizedType, season, episode)
        .then((streams) => Array.isArray(streams) && streams.length > 0)
        .catch((e) => {
          console.warn("[StreamingCommunity] GuardaHD fallback check failed:", e);
          return false;
        })
    );
  }

  if (checks.length === 0) return false;
  const results = await Promise.all(checks);
  return results.some(Boolean);
}

async function getStreams(id, type, season, episode, providerContext = null) {
  const requestedType = String(type).toLowerCase();
  const normalizedType = requestedType === "series" ? "tv" : requestedType;
  const baseUrl = getStreamingCommunityBaseUrl();
  const commonHeaders = getCommonHeaders();
  let tmdbId = id.toString();
  let resolvedSeason = season;
  const contextTmdbId = providerContext && /^\d+$/.test(String(providerContext.tmdbId || ""))
    ? String(providerContext.tmdbId)
    : null;

  if (contextTmdbId) {
    tmdbId = contextTmdbId;
  } else if (tmdbId.startsWith("tmdb:")) {
    tmdbId = tmdbId.replace("tmdb:", "");
  } else if (tmdbId.startsWith("tt")) {
    const convertedId = await getTmdbId(tmdbId, normalizedType);
    if (convertedId) {
      console.log(`[StreamingCommunity] Converted ${id} to TMDB ID: ${convertedId}`);
      tmdbId = convertedId;
    } else {
      console.warn(`[StreamingCommunity] Could not convert IMDb ID ${id} to TMDB ID.`);
    }
  }

  let metadata = null;
  try {
    metadata = await getMetadata(tmdbId, type);
  } catch (e) {
    console.error("[StreamingCommunity] Error fetching metadata:", e);
  }

  const title = metadata && (metadata.title || metadata.name || metadata.original_title || metadata.original_name) ? metadata.title || metadata.name || metadata.original_title || metadata.original_name : normalizedType === "movie" ? "Film Sconosciuto" : "Serie TV";
  const displayName = normalizedType === "movie" ? title : `${title} ${resolvedSeason}x${episode}`;
  const finalDisplayName = displayName;

  let url;
  let apiUrl;
  if (normalizedType === "movie") {
    url = `${baseUrl}/movie/${tmdbId}`;
    apiUrl = `${baseUrl}/api/movie/${tmdbId}`;
  } else if (normalizedType === "tv") {
    url = `${baseUrl}/tv/${tmdbId}/${resolvedSeason}/${episode}`;
    apiUrl = `${baseUrl}/api/tv/${tmdbId}/${resolvedSeason}/${episode}`;
  } else {
    return [];
  }

  try {
    console.log(`[StreamingCommunity] Fetching API: ${apiUrl}`);
    const response = await fetch(apiUrl, {
      headers: commonHeaders
    });
    if (!response.ok) {
      console.error(`[StreamingCommunity] Failed to fetch page: ${response.status}`);
      return [];
    }
    const apiPayload = await response.json().catch(() => null);
    const embedUrl = extractEmbedSrcFromApiPayload(apiPayload);
    if (!embedUrl) {
      console.log("[StreamingCommunity] Could not find embed src in API payload");
      return [];
    }

    if (providerContext?.proxyUrl) {
      const rawPageUrl = url.endsWith("/") ? url : `${url}/`;
      console.log(`[StreamingCommunity] Proxy enabled, returning raw page URL: ${rawPageUrl}`);
      const result = {
        name: `StreamingCommunity`,
        title: finalDisplayName,
        url: rawPageUrl,
        easyProxySourceUrl: rawPageUrl,
        // Stremio addon uses EasyProxy path for StreamingCommunity, so expose default quality here too.
        quality: "1080p",
        type: "direct",
        behaviorHints: {
          notWebReady: false
        }
      };

      return [formatStream(result, "StreamingCommunity")].filter(s => s !== null);
    }

    console.log(`[StreamingCommunity] Fetching embed: ${embedUrl}`);
    const embedResponse = await fetch(embedUrl, {
      headers: getEmbedHeaders(embedUrl)
    });
    if (!embedResponse.ok) {
      console.error(`[StreamingCommunity] Failed to fetch embed: ${embedResponse.status}`);
      return [];
    }

    const embedHtml = await embedResponse.text();
    if (!embedHtml) return [];

    const masterPlaylist = extractMasterPlaylistFromEmbedHtml(embedHtml);
    if (masterPlaylist) {
      const streamUrl = `${masterPlaylist.url}?token=${encodeURIComponent(masterPlaylist.token)}&expires=${encodeURIComponent(masterPlaylist.expires)}&h=1&lang=it`;
      const streamHeaders = getPlaylistHeaders(embedUrl);
      console.log(`[StreamingCommunity] Final stream URL: ${streamUrl}`);

      // StreamingCommunity generally serves FHD when playlist does not expose a clear resolution tag.
      let quality = "1080p";
      try {
        const playlistResponse = await fetch(streamUrl, {
          headers: streamHeaders
        });
        if (playlistResponse.ok) {
          const playlistText = await playlistResponse.text();
          const hasItalian = /#EXT-X-MEDIA:TYPE=AUDIO.*(?:LANGUAGE="it"|LANGUAGE="ita"|NAME="Italian"|NAME="Ita")/i.test(playlistText);
          const detected = checkQualityFromText(playlistText);
          if (detected) quality = detected;

          const originalLanguageItalian = metadata && (metadata.original_language === 'it' || metadata.original_language === 'ita');

          if (!hasItalian && !originalLanguageItalian) {
            console.log(`[StreamingCommunity] No Italian audio found. Checking fallback.`);
            const fallbackOk = await hasGuardaFallbackResults(id, normalizedType, resolvedSeason, episode, providerContext);
            if (!fallbackOk) return [];
          }
        }
      } catch (e) {
        console.warn(`[StreamingCommunity] Playlist pre-check failed, continuing:`, e);
      }

      const normalizedQuality = getQualityFromName(quality);
      const result = {
        name: `StreamingCommunity`,
        title: finalDisplayName,
        url: streamUrl,
        easyProxySourceUrl: embedUrl,
        quality: normalizedQuality,
        type: "direct",
        headers: streamHeaders,
        behaviorHints: {
          notWebReady: false
        }
      };

      return [formatStream(result, "StreamingCommunity")].filter(s => s !== null);
    } else {
      console.log("[StreamingCommunity] Could not find playlist info in HTML");
      return [];
    }
  } catch (error) {
    console.error("[StreamingCommunity] Error:", error);
    return [];
  }
}

module.exports = { getStreams };
