var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
const BASE_URL = "https://vixsrc.to";
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
async function getTmdbFromKitsu(kitsuId) {
    try {
        const id = String(kitsuId).replace("kitsu:", "");
        
        // Fetch Mappings
        const mappingResponse = await fetch(`https://kitsu.io/api/edge/anime/${id}/mappings`);
        if (mappingResponse.ok) {
            const mappingData = await mappingResponse.json();
            if (mappingData && mappingData.data) {
                // Try IMDb first
                const imdbMapping = mappingData.data.find(m => m.attributes.externalSite === 'imdb');
                if (imdbMapping) {
                     const imdbId = imdbMapping.attributes.externalId;
                     const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
                     const findResponse = await fetch(findUrl);
                     const findData = await findResponse.json();
                     if (findData.tv_results?.length > 0) return findData.tv_results[0].id;
                     if (findData.movie_results?.length > 0) return findData.movie_results[0].id;
                }

                // Try TheTVDB
                const tvdbMapping = mappingData.data.find(m => m.attributes.externalSite === 'thetvdb');
                if (tvdbMapping) {
                     const tvdbId = tvdbMapping.attributes.externalId;
                     const findUrl = `https://api.themoviedb.org/3/find/${tvdbId}?api_key=${TMDB_API_KEY}&external_source=tvdb_id`;
                     const findResponse = await fetch(findUrl);
                     const findData = await findResponse.json();
                     if (findData.tv_results?.length > 0) return findData.tv_results[0].id;
                     if (findData.movie_results?.length > 0) return findData.movie_results[0].id;
                }
            }
        }

        // Fallback: Search by Title from Kitsu Details
        const detailsResponse = await fetch(`https://kitsu.io/api/edge/anime/${id}`);
        if (!detailsResponse.ok) return null;
        const detailsData = await detailsResponse.json();
        
        if (detailsData && detailsData.data && detailsData.data.attributes) {
            const attributes = detailsData.data.attributes;
            const title = attributes.titles.en || attributes.titles.en_jp || attributes.canonicalTitle;
            const year = attributes.startDate ? attributes.startDate.substring(0, 4) : null;
            const subtype = attributes.subtype;
            
            const type = (subtype === 'movie') ? 'movie' : 'tv';
            
            if (title) {
                const searchUrl = `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(title)}&api_key=${TMDB_API_KEY}`;
                const searchResponse = await fetch(searchUrl);
                const searchData = await searchResponse.json();
                
                if (searchData.results && searchData.results.length > 0) {
                    if (year) {
                        const match = searchData.results.find(r => {
                            const date = type === 'movie' ? r.release_date : r.first_air_date;
                            return date && date.startsWith(year);
                        });
                        if (match) return match.id;
                    }
                    return searchData.results[0].id;
                }
            }
        }

        return null;
    } catch (e) {
        console.error("[Kitsu] Error converting ID:", e);
        return null;
    }
}
function getTmdbId(imdbId, type) {
  return __async(this, null, function* () {
    const normalizedType = String(type).toLowerCase();
    const endpoint = normalizedType === "movie" ? "movie" : "tv";
    const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    try {
      const response = yield fetch(findUrl);
      if (!response.ok) return null;
      const data = yield response.json();
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
  });
}
function getMetadata(id, type) {
  return __async(this, null, function* () {
    try {
      const normalizedType = String(type).toLowerCase();
      let url;
      if (String(id).startsWith("tt")) {
        url = `https://api.themoviedb.org/3/find/${id}?api_key=${TMDB_API_KEY}&external_source=imdb_id&language=it-IT`;
      } else {
        const endpoint = normalizedType === "movie" ? "movie" : "tv";
        url = `https://api.themoviedb.org/3/${endpoint}/${id}?api_key=${TMDB_API_KEY}&language=it-IT`;
      }
      const response = yield fetch(url);
      if (!response.ok) return null;
      const data = yield response.json();
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
  });
}
function getStreams(id, type, season, episode) {
  return __async(this, null, function* () {
    const normalizedType = String(type).toLowerCase();
    let tmdbId = id.toString();
    if (tmdbId.startsWith("kitsu:")) {
        const resolvedId = yield getTmdbFromKitsu(tmdbId);
        if (resolvedId) {
            console.log(`[StreamingCommunity] Resolved Kitsu ID ${tmdbId} to TMDB ID ${resolvedId}`);
            tmdbId = resolvedId.toString();
        } else {
            console.warn(`[StreamingCommunity] Could not convert Kitsu ID ${tmdbId} to TMDB ID.`);
            return [];
        }
    }
    if (tmdbId.startsWith("tmdb:")) {
      tmdbId = tmdbId.replace("tmdb:", "");
    } else if (tmdbId.startsWith("tt")) {
      const convertedId = yield getTmdbId(tmdbId, normalizedType);
      if (convertedId) {
        console.log(`[StreamingCommunity] Converted ${id} to TMDB ID: ${convertedId}`);
        tmdbId = convertedId;
      } else {
        console.warn(`[StreamingCommunity] Could not convert IMDb ID ${id} to TMDB ID.`);
      }
    }
    let metadata = null;
    try {
      metadata = yield getMetadata(tmdbId, type);
    } catch (e) {
      console.error("[StreamingCommunity] Error fetching metadata:", e);
    }
    const title = metadata && (metadata.title || metadata.name || metadata.original_title || metadata.original_name) ? metadata.title || metadata.name || metadata.original_title || metadata.original_name : normalizedType === "movie" ? "Film Sconosciuto" : "Serie TV";
    const displayName = normalizedType === "movie" ? title : `${title} ${season}x${episode}`;
    const finalDisplayName = displayName;
    let url;
    if (normalizedType === "movie") {
      url = `${BASE_URL}/movie/${tmdbId}`;
    } else if (normalizedType === "tv") {
      url = `${BASE_URL}/tv/${tmdbId}/${season}/${episode}`;
    } else {
      return [];
    }
    try {
      console.log(`[StreamingCommunity] Fetching page: ${url}`);
      const response = yield fetch(url, {
        headers: COMMON_HEADERS
      });
      if (!response.ok) {
        console.error(`[StreamingCommunity] Failed to fetch page: ${response.status}`);
        return [];
      }
      const html = yield response.text();
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
          streamUrl = `${baseUrl}&token=${token}&expires=${expires}&h=1&lang=it`;
        } else {
          streamUrl = `${baseUrl}?token=${token}&expires=${expires}&h=1&lang=it`;
        }
        console.log(`[StreamingCommunity] Found stream URL: ${streamUrl}`);
        let quality = "720p";
        try {
          const playlistResponse = yield fetch(streamUrl, {
            headers: COMMON_HEADERS
          });
          if (playlistResponse.ok) {
            const playlistText = yield playlistResponse.text();
            const hasItalian = /LANGUAGE="it"|LANGUAGE="ita"|NAME="Italian"|NAME="Ita"/i.test(playlistText);
            const has1080p = /RESOLUTION=\d+x1080|RESOLUTION=1080/i.test(playlistText);
            const has4k = /RESOLUTION=\d+x2160|RESOLUTION=2160/i.test(playlistText);
            if (has4k) quality = "4K";
            else if (has1080p) quality = "1080p";
            if (hasItalian) {
              console.log(`[StreamingCommunity] Verified: Has Italian audio.`);
            } else {
              console.log(`[StreamingCommunity] No Italian audio found in playlist. Skipping.`);
              return [];
            }
          } else {
            console.warn(`[StreamingCommunity] Playlist check failed (${playlistResponse.status}), skipping verification.`);
          }
        } catch (verError) {
          console.warn(`[StreamingCommunity] Playlist check error, returning anyway:`, verError);
        }
        const normalizedQuality = getQualityFromName(quality);
        return [{
          name: `StreamingCommunity`,
          title: finalDisplayName,
          url: streamUrl,
          quality: normalizedQuality,
          type: "direct",
          headers: COMMON_HEADERS
        }];
      } else {
        console.log("[StreamingCommunity] Could not find playlist info in HTML");
        return [];
      }
    } catch (error) {
      console.error("[StreamingCommunity] Error:", error);
      return [];
    }
  });
}
module.exports = { getStreams };
