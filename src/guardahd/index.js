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
function getGuardaHdBaseUrl() {
  return "https://guardahd.stream";
}
const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

const { extractMixDrop, extractDropLoad, extractSuperVideo, extractStreamHG } = require('../extractors');
require('../fetch_helper.js');
const { formatStream } = require('../formatter.js');
const { checkQualityFromPlaylist, getQualityFromUrl } = require('../quality_helper.js');

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
      const normalizedType = String(type).toLowerCase();
      const endpoint = normalizedType === "movie" ? "movie" : "tv";
      const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
      const response = yield fetch(url);
      if (!response.ok) return null;
      const data = yield response.json();
      if (data.imdb_id) {
        console.log(`[GuardaHD] Converted TMDB ${tmdbId} to IMDb ${data.imdb_id}`);
        return data.imdb_id;
      }
      const externalUrl = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
      const extResponse = yield fetch(externalUrl);
      if (extResponse.ok) {
        const extData = yield extResponse.json();
        if (extData.imdb_id) {
            console.log(`[GuardaHD] Converted TMDB ${tmdbId} to IMDb ${extData.imdb_id} (via external_ids)`);
            return extData.imdb_id;
        }
      }
      console.log(`[GuardaHD] Failed to convert TMDB ${tmdbId} to IMDb`);
      return null;
    } catch (e) {
      console.error("[GuardaHD] Conversion error:", e);
      return null;
    }
  });
}

function getMetadata(id, type) {
  return __async(this, null, function* () {
    try {
      const normalizedType = String(type).toLowerCase();
      let queryId = id;

      let url;
      if (String(queryId).startsWith("tt")) {
          url = `https://api.themoviedb.org/3/find/${queryId}?api_key=${TMDB_API_KEY}&external_source=imdb_id&language=it-IT`;
      } else {
          const endpoint = normalizedType === "movie" ? "movie" : "tv";
          url = `https://api.themoviedb.org/3/${endpoint}/${queryId}?api_key=${TMDB_API_KEY}&language=it-IT`;
      }
      
      const response = yield fetch(url);
      if (!response.ok) return null;
      const data = yield response.json();
      
      if (String(queryId).startsWith("tt")) {
          const results = normalizedType === "movie" ? data.movie_results : data.tv_results;
          if (results && results.length > 0) return results[0];
      } else {
          return data;
      }
      return null;
    } catch (e) {
      console.error("[GuardaHD] Metadata error:", e);
      return null;
    }
  });
}

function getStreams(id, type, season, episode) {
  if (['series', 'tv'].includes(String(type).toLowerCase())) return [];
  return __async(this, null, function* () {
    const normalizedType = String(type).toLowerCase();
    let cleanId = id.toString();

    if (cleanId.startsWith("tmdb:")) cleanId = cleanId.replace("tmdb:", "");
    let imdbId = cleanId;
    if (!cleanId.startsWith("tt")) {
      const convertedId = yield getImdbId(cleanId, type);
      if (convertedId) imdbId = convertedId;
      else return [];
    }
    
    let metadata = null;
    try {
        metadata = yield getMetadata(cleanId, type);
    } catch (e) {
        console.error("[GuardaHD] Error fetching metadata:", e);
    }

    const title = (metadata && (metadata.title || metadata.name || metadata.original_title || metadata.original_name)) 
        ? (metadata.title || metadata.name || metadata.original_title || metadata.original_name) 
        : (normalizedType === "movie" ? "Film Sconosciuto" : "Serie TV");
    
    const baseUrl = getGuardaHdBaseUrl();
    let url;
    if (normalizedType === "movie") {
      url = `${baseUrl}/set-movie-a/${imdbId}`;
    } else if (normalizedType === "tv") {
      url = `${baseUrl}/set-tv-a/${imdbId}/${season}/${episode}`;
    } else {
      return [];
    }
    
    try {
      const response = yield fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": baseUrl
        }
      });
      if (!response.ok) return [];
      const html = yield response.text();
      
      const linksSet = new Set();
      const iframeRegex = /<iframe\b[^>]+src=["']([^"']+)["']/gi;
      let iframeMatch;
      while ((iframeMatch = iframeRegex.exec(html)) !== null) {
        linksSet.add(iframeMatch[1]);
      }

      const linkRegex = /data-link=["']([^"']+)["']/g;
      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        linksSet.add(match[1]);
      }

      const directRegex = /https?:\/\/(?:www\.)?(?:loadm|uqload|dropload|dr0pstream|mixdrop|m1xdrop|supervideo|streamtape|dhcplay|vibuxer)[^"'<\s]+/ig;
      const directMatches = html.match(directRegex) || [];
      for (const raw of directMatches) {
          linksSet.add(raw);
      }

      const streams = [];
      const displayName = normalizedType === "movie" ? title : `${title} ${season}x${episode}`;
      
      const processUrl = async (streamUrl) => {
        if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
        
        try {
          if (streamUrl.includes("mixdrop") || streamUrl.includes("m1xdrop")) {
            console.log(`[GuardaHD] Attempting MixDrop extraction for ${streamUrl}`);
            const extracted = await extractMixDrop(streamUrl);
            if (extracted && extracted.url) {
              let quality = "HD";
              const playlistQuality = await checkQualityFromPlaylist(extracted.url, extracted.headers);
              if (playlistQuality) quality = playlistQuality;
              const normalizedQuality = getQualityFromName(quality);
              streams.push({
                name: `GuardaHD - MixDrop`,
                title: displayName,
                url: extracted.url,
                easyProxySourceUrl: streamUrl,
                headers: extracted.headers,
                quality: normalizedQuality,
                type: "direct"
              });
            }
          } else if (streamUrl.includes("dhcplay") || streamUrl.includes("vibuxer")) {
            console.log(`[GuardaHD] Attempting StreamHG extraction for ${streamUrl}`);
            const extracted = await extractStreamHG(streamUrl);
            if (extracted && extracted.url) {
              let quality = getQualityFromUrl(extracted.url) || "HD";
              const playlistQuality = await checkQualityFromPlaylist(extracted.url, extracted.headers || {});
              if (playlistQuality) quality = playlistQuality;
              const normalizedQuality = getQualityFromName(quality);
              streams.push({
                name: `GuardaHD - StreamHG`,
                title: displayName,
                url: extracted.url,
                // EasyProxy must receive embed URL, not extracted master playlist URL.
                easyProxySourceUrl: streamUrl,
                headers: extracted.headers,
                quality: normalizedQuality,
                type: "direct"
              });
            }
          } else if (streamUrl.includes("dropload") || streamUrl.includes("dr0pstream")) {
            console.log(`[GuardaHD] DropLoad temporarily disabled: ${streamUrl}`);
          } else if (streamUrl.includes("supervideo")) {
            console.log(`[GuardaHD] SuperVideo temporarily disabled: ${streamUrl}`);
          }
        } catch (e) {
          console.error("[GuardaHD] Process URL error:", e);
        }
      };

      const uniqueLinks = Array.from(linksSet);
      yield Promise.all(uniqueLinks.map((link) => processUrl(link)));

      const uniqueStreams = [];
      const seenUrls = new Set();
      for (const s of streams) {
        if (!seenUrls.has(s.url)) {
          seenUrls.add(s.url);
          uniqueStreams.push(s);
        }
      }
      return uniqueStreams.map(s => formatStream(s, "GuardaHD")).filter(s => s !== null);
    } catch (error) {
      console.error("[GuardaHD] Error:", error);
      return [];
    }
  });
}
module.exports = { getStreams };
