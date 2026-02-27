
const BASE_URL = "https://vixsrc.to";
const { formatStream } = require('../formatter.js');
require('../fetch_helper.js');
const { checkQualityFromText } = require('../quality_helper.js');
const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
const USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const COMMON_HEADERS = {
  "User-Agent": USER_AGENT,
  "Referer": "https://vixsrc.to/",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1"
};

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
  // const endpoint = normalizedType === "movie" ? "movie" : "tv"; // Unused
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

async function getStreams(id, type, season, episode, providerContext = null) {
  const normalizedType = String(type).toLowerCase();
  let tmdbId = id.toString();
  let resolvedSeason = season;
  const contextTmdbId = providerContext && /^\d+$/.test(String(providerContext.tmdbId || ""))
    ? String(providerContext.tmdbId)
    : null;
  const parsedContextSeason = parseInt(providerContext && providerContext.canonicalSeason, 10);
  const hasContextSeason = Number.isInteger(parsedContextSeason) && parsedContextSeason >= 0;

  if (contextTmdbId) {
    tmdbId = contextTmdbId;
    if (normalizedType === "tv" && hasContextSeason && resolvedSeason !== parsedContextSeason) {
      console.log(`[StreamingCommunity] Prefetched mapping indicates Season ${parsedContextSeason}. Overriding requested Season ${resolvedSeason}`);
      resolvedSeason = parsedContextSeason;
    }
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
  if (normalizedType === "movie") {
    url = `${BASE_URL}/movie/${tmdbId}`;
  } else if (normalizedType === "tv") {
    url = `${BASE_URL}/tv/${tmdbId}/${resolvedSeason}/${episode}`;
  } else {
    return [];
  }

  try {
    console.log(`[StreamingCommunity] Fetching page: ${url}`);
    const response = await fetch(url, {
      headers: COMMON_HEADERS
    });
    if (!response.ok) {
      console.error(`[StreamingCommunity] Failed to fetch page: ${response.status}`);
      return [];
    }
    const html = await response.text();
    if (!html) return [];

    const tokenMatch = html.match(/'token':\s*'([^']+)'/);
    const expiresMatch = html.match(/'expires':\s*'([^']+)'/);
    const urlMatch = html.match(/url:\s*'([^']+)'/);

    if (tokenMatch && expiresMatch && urlMatch) {
      const token = tokenMatch[1];
      const expires = expiresMatch[1];
      const baseUrl = urlMatch[1];
      let streamUrl;
      if (baseUrl.includes("?b=1")) {
        streamUrl = baseUrl.replace('?', '.m3u8?') + `&token=${token}&expires=${expires}&h=1&lang=it`;
      } else {
        streamUrl = `${baseUrl}.m3u8?token=${token}&expires=${expires}&h=1&lang=it`;
      }
      console.log(`[StreamingCommunity] Found stream URL: ${streamUrl}`);

      let quality = "720p";
      try {
        const playlistResponse = await fetch(streamUrl, {
          headers: COMMON_HEADERS
        });
        if (playlistResponse.ok) {
          const playlistText = await playlistResponse.text();
          // Basic quality detection from playlist content
          // We specifically look for Italian audio, not subtitles (TYPE=AUDIO)
          const hasItalian = /#EXT-X-MEDIA:TYPE=AUDIO.*(?:LANGUAGE="it"|LANGUAGE="ita"|NAME="Italian"|NAME="Ita")/i.test(playlistText);

          const detected = checkQualityFromText(playlistText);
          if (detected) quality = detected;

          // Check if original language is Italian - if so, skip Italian audio verification
          const originalLanguageItalian = metadata && (metadata.original_language === 'it' || metadata.original_language === 'ita');

          if (hasItalian || originalLanguageItalian) {
            console.log(`[StreamingCommunity] Verified: Has Italian audio or original language is Italian.`);
          } else {
            console.log(`[StreamingCommunity] No Italian audio found in playlist and original language is not Italian. Skipping.`);
            return [];
          }
        } else {
          console.warn(`[StreamingCommunity] Playlist check failed (${playlistResponse.status}), skipping verification.`);
        }
      } catch (verError) {
        console.warn(`[StreamingCommunity] Playlist check error, returning anyway:`, verError);
      }

      const normalizedQuality = getQualityFromName(quality);
      const result = {
        name: `StreamingCommunity`,
        title: finalDisplayName,
        url: streamUrl,
        quality: normalizedQuality,
        type: "direct",
        headers: COMMON_HEADERS
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
