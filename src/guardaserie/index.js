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
const BASE_URL = "https://guardaserietv.best";
const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

const { extractMixDrop, extractDropLoad, extractSuperVideo, extractUqload, extractUpstream } = require('../extractors');

async function getTmdbFromKitsu(kitsuId) {
    try {
        const id = String(kitsuId).replace("kitsu:", "");
        const mappingResponse = await fetch(`https://kitsu.io/api/edge/anime/${id}/mappings`);
        if (!mappingResponse.ok) return null;
        const mappingData = await mappingResponse.json();
        
        if (!mappingData || !mappingData.data) return null;

        // Try TVDB
        const tvdbMapping = mappingData.data.find(m => m.attributes.externalSite === 'thetvdb/series' || m.attributes.externalSite === 'thetvdb');
        if (tvdbMapping) {
            const tvdbId = String(tvdbMapping.attributes.externalId).split('/')[0];
            const findUrl = `https://api.themoviedb.org/3/find/${tvdbId}?api_key=${TMDB_API_KEY}&external_source=tvdb_id`;
            const findResponse = await fetch(findUrl);
            const findData = await findResponse.json();
            
            if (findData.tv_results?.length > 0) return findData.tv_results[0].id;
            if (findData.movie_results?.length > 0) return findData.movie_results[0].id;
        }
        
        // Try IMDb
        const imdbMapping = mappingData.data.find(m => m.attributes.externalSite === 'imdb');
        if (imdbMapping) {
             const imdbId = imdbMapping.attributes.externalId;
             const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
             const findResponse = await fetch(findUrl);
             const findData = await findResponse.json();
             if (findData.tv_results?.length > 0) return findData.tv_results[0].id;
             if (findData.movie_results?.length > 0) return findData.movie_results[0].id;
        }

        return null;
    } catch (e) {
        console.error("[Kitsu] Error converting ID:", e);
        return null;
    }
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

function getImdbId(tmdbId, type) {
  return __async(this, null, function* () {
    try {
      const endpoint = type === "movie" ? "movie" : "tv";
      const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
      const response = yield fetch(url);
      if (!response.ok) return null;
      const data = yield response.json();
      if (data.imdb_id) return data.imdb_id;
      const externalUrl = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
      const extResponse = yield fetch(externalUrl);
      if (extResponse.ok) {
        const extData = yield extResponse.json();
        if (extData.imdb_id) return extData.imdb_id;
      }
      return null;
    } catch (e) {
      console.error("[Guardaserie] Conversion error:", e);
      return null;
    }
  });
}
function getShowInfo(tmdbId, type) {
  return __async(this, null, function* () {
    try {
      const endpoint = type === "movie" ? "movie" : "tv";
      const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=it-IT`;
      const response = yield fetch(url);
      if (!response.ok) return null;
      return yield response.json();
    } catch (e) {
      console.error("[Guardaserie] TMDB error:", e);
      return null;
    }
  });
}

function getTmdbIdFromImdb(imdbId, type) {
  return __async(this, null, function* () {
    var _a, _b;
    try {
      const url = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
      const response = yield fetch(url);
      if (!response.ok) return null;
      const data = yield response.json();
      if (type === "movie" && ((_a = data.movie_results) == null ? void 0 : _a.length) > 0) return data.movie_results[0].id;
      if (type === "tv" && ((_b = data.tv_results) == null ? void 0 : _b.length) > 0) return data.tv_results[0].id;
      return null;
    } catch (e) {
      console.error("[Guardaserie] ID conversion error:", e);
      return null;
    }
  });
}
function getStreams(id, type, season, episode) {
  return __async(this, null, function* () {
    if (String(type).toLowerCase() === "movie") return [];
    try {
      let tmdbId = id;
      let imdbId = null;

      if (id.toString().startsWith("tt")) {
        imdbId = id.toString();
        tmdbId = yield getTmdbIdFromImdb(id, type);
        if (!tmdbId) {
          console.log(`[Guardaserie] Could not convert ${id} to TMDB ID`);
          return [];
        }
      } else if (id.toString().startsWith("kitsu:")) {
          const resolvedId = yield getTmdbFromKitsu(id);
          if (resolvedId) {
             tmdbId = resolvedId;
             console.log(`[Guardaserie] Resolved Kitsu ID ${id} to TMDB ID ${tmdbId}`);
          } else {
             console.log(`[Guardaserie] Could not convert ${id} to TMDB ID`);
             return [];
          }
      } else if (id.toString().startsWith("tmdb:")) {
        tmdbId = id.toString().replace("tmdb:", "");
      }
      
      // Resolve IMDb ID for verification if we don't have it yet
      if (!imdbId && tmdbId) {
          try {
              const resolvedImdb = yield getImdbId(tmdbId, type);
              if (resolvedImdb) {
                  imdbId = resolvedImdb;
                  console.log(`[Guardaserie] Resolved TMDB ID ${tmdbId} to IMDb ID ${imdbId} for verification`);
              }
          } catch (e) {
              console.log(`[Guardaserie] Failed to resolve IMDb ID for verification: ${e.message}`);
          }
      }
      
      let showInfo = null;
      try {
          showInfo = yield getShowInfo(tmdbId, type);
      } catch (e) {
          console.error("[Guardaserie] Error fetching show info:", e);
      }
      
      if (!showInfo) return [];
      const title = showInfo.name || showInfo.original_name || showInfo.title || showInfo.original_title || "Serie TV";
      const year = showInfo.first_air_date ? showInfo.first_air_date.split("-")[0] : "";
      console.log(`[Guardaserie] Searching for: ${title} (${year})`);
      const params = new URLSearchParams();
      params.append("do", "search");
      params.append("subaction", "search");
      params.append("story", title);
      const searchUrl = `${BASE_URL}/index.php?${params.toString()}`;
      const searchResponse = yield fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": BASE_URL
        }
      });
      const searchHtml = yield searchResponse.text();
      const resultRegex = /<div class="mlnh-2">\s*<h2>\s*<a href="([^"]+)" title="([^"]+)">[\s\S]*?<\/div>\s*<div class="mlnh-3 hdn">([^<]*)<\/div>/g;
      let match;
      let showUrl = null;
      const metaYear = year ? parseInt(year) : null;
      
      const candidates = [];

      while ((match = resultRegex.exec(searchHtml)) !== null) {
        const foundUrl = match[1];
        const foundTitle = match[2];
        const foundYearStr = match[3];
        
        if (foundTitle.toLowerCase().includes(title.toLowerCase())) {
            candidates.push({
                url: foundUrl,
                title: foundTitle,
                year: foundYearStr
            });
        }
      }

      let showHtml = null;
      // Filter candidates
      for (const candidate of candidates) {
          let matchesYear = true;
          if (metaYear) {
              const yearMatch = candidate.year.match(/(\d{4})/);
              if (yearMatch) {
                  const foundYear = parseInt(yearMatch[1]);
                  if (Math.abs(foundYear - metaYear) > 2) {
                      matchesYear = false;
                  }
              }
          }

          if (matchesYear) {
              console.log(`[Guardaserie] Verifying candidate: ${candidate.title} (${candidate.year})`);
              try {
                  const candidateRes = yield fetch(candidate.url, {
                    headers: {
                      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                      "Referer": BASE_URL
                    }
                  });
                  if (!candidateRes.ok) continue;
                  const candidateHtml = yield candidateRes.text();
                  
                  if (imdbId) {
                      const imdbMatches = candidateHtml.match(/tt\d{7,8}/g);
                      if (imdbMatches && imdbMatches.length > 0) {
                          const targetId = imdbId;
                          const hasTarget = imdbMatches.includes(targetId);
                          const otherIds = imdbMatches.filter(m => m !== targetId);
                          
                          if (!hasTarget && otherIds.length > 0) {
                               console.log(`[Guardaserie] Rejected ${candidate.url} due to IMDb mismatch. Found: ${otherIds.join(", ")}`);
                               continue;
                          }
                          if (hasTarget) {
                               console.log(`[Guardaserie] Verified ${candidate.url} with IMDb match.`);
                          }
                      }
                  }
                  
                  showUrl = candidate.url;
                  showHtml = candidateHtml;
                  break; 
              } catch (e) {
                  console.error(`[Guardaserie] Error verifying candidate ${candidate.url}:`, e);
              }
          }
      }
      
      if (!showUrl && candidates.length > 0) {
          console.log("[Guardaserie] No candidate matched criteria.");
      }
      if (!showUrl || !showHtml) {
        console.log("[Guardaserie] Show not found");
        return [];
      }
      console.log(`[Guardaserie] Found show URL: ${showUrl}`);
      const episodeStr = `${season}x${episode}`;
      const episodeRegex = new RegExp(`data-num="${episodeStr}"`, "i");
      const episodeMatch = episodeRegex.exec(showHtml);
      if (!episodeMatch) {
        console.log(`[Guardaserie] Episode ${episodeStr} not found`);
        return [];
      }
      const searchFromIndex = episodeMatch.index;
      const mirrorsStartIndex = showHtml.indexOf('<div class="mirrors">', searchFromIndex);
      if (mirrorsStartIndex === -1) {
        console.log("[Guardaserie] Mirrors div not found");
        return [];
      }
      const mirrorsEndIndex = showHtml.indexOf("</div>", mirrorsStartIndex);
      const mirrorsHtml = showHtml.substring(mirrorsStartIndex, mirrorsEndIndex);
      const linkRegex = /data-link="([^"]+)"/g;
      const links = [];
      let linkMatch;
      while ((linkMatch = linkRegex.exec(mirrorsHtml)) !== null) {
        links.push(linkMatch[1]);
      }
      console.log(`[Guardaserie] Found ${links.length} potential links`);
      const streamPromises = links.map((link) => __async(null, null, function* () {
        try {
          let streamUrl = null;
          let playerName = "Unknown";
          if (link.includes("dropload")) {
            const extracted = yield extractDropLoad(link);
            if (extracted && extracted.url) {
            let quality = "HD";
            const lowerUrl = extracted.url.toLowerCase();
            if (lowerUrl.includes("1080") || lowerUrl.includes("fhd")) quality = "1080p";
            else if (lowerUrl.includes("720") || lowerUrl.includes("hd")) quality = "720p";
            else if (lowerUrl.includes("480") || lowerUrl.includes("sd")) quality = "480p";
            else if (lowerUrl.includes("360")) quality = "360p";
            
            const normalizedQuality = getQualityFromName(quality);

            const displayName = `${title} ${season}x${episode}`;
            return {
              url: extracted.url,
              headers: extracted.headers,
              name: `Guardaserie - DropLoad`,
              title: displayName,
              quality: normalizedQuality,
              type: "direct"
            };
          }
        } else if (link.includes("supervideo")) {
          streamUrl = yield extractSuperVideo(link);
          playerName = "SuperVideo";
          if (streamUrl) {
            let quality = "HD";
            const lowerUrl = streamUrl.toLowerCase();
            if (lowerUrl.includes("4k") || lowerUrl.includes("2160")) quality = "4K";
            else if (lowerUrl.includes("1080") || lowerUrl.includes("fhd")) quality = "1080p";
            else if (lowerUrl.includes("720") || lowerUrl.includes("hd")) quality = "720p";
            else if (lowerUrl.includes("480") || lowerUrl.includes("sd")) quality = "480p";
            else if (lowerUrl.includes("360")) quality = "360p";
            
            const normalizedQuality = getQualityFromName(quality);

            const displayName = `${title} ${season}x${episode}`;
            return {
              url: streamUrl,
              name: `Guardaserie - ${playerName}`,
              title: displayName,
              quality: normalizedQuality,
              type: "direct"
            };
          }
        } else if (link.includes("mixdrop")) {
          const extracted = yield extractMixDrop(link);
          if (extracted && extracted.url) {
            let quality = "HD";
            const lowerUrl = extracted.url.toLowerCase();
            if (lowerUrl.includes("4k") || lowerUrl.includes("2160")) quality = "4K";
            else if (lowerUrl.includes("1080") || lowerUrl.includes("fhd")) quality = "1080p";
            else if (lowerUrl.includes("720") || lowerUrl.includes("hd")) quality = "720p";
            else if (lowerUrl.includes("480") || lowerUrl.includes("sd")) quality = "480p";
            else if (lowerUrl.includes("360")) quality = "360p";
            
            const normalizedQuality = getQualityFromName(quality);

            const displayName = `${title} ${season}x${episode}`;
            return {
              url: extracted.url,
              headers: extracted.headers,
              name: `Guardaserie - MixDrop`,
              title: displayName,
              quality: normalizedQuality,
              type: "direct"
            };
            }
          }
        } catch (e) {
          console.error(`[Guardaserie] Error extracting link ${link}:`, e);
        }
        return null;
      }));
      const results = yield Promise.all(streamPromises);
      return results.filter((r) => r !== null);
    } catch (e) {
      console.error("[Guardaserie] Error:", e);
      return [];
    }
  });
}
module.exports = { getStreams };
