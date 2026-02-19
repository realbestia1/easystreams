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
const BASE_URL = "https://guardahd.stream";
const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

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
      const normalizedType = String(type).toLowerCase();
      const endpoint = normalizedType === "movie" ? "movie" : "tv";
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
      console.error("[GuardaHD] Conversion error:", e);
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
      console.error("[GuardaHD] Metadata error:", e);
      return null;
    }
  });
}
function unPack(p, a, c, k, e, d) {
  e = function(c2) {
    return (c2 < a ? "" : e(parseInt(c2 / a))) + ((c2 = c2 % a) > 35 ? String.fromCharCode(c2 + 29) : c2.toString(36));
  };
  if (!"".replace(/^/, String)) {
    while (c--) {
      d[e(c)] = k[c] || e(c);
    }
    k = [function(e2) {
      return d[e2];
    }];
    e = function() {
      return "\\w+";
    };
    c = 1;
  }
  while (c--) {
    if (k[c]) {
      p = p.replace(new RegExp("\\b" + e(c) + "\\b", "g"), k[c]);
    }
  }
  return p;
}
function extractMixDrop(url) {
  return __async(this, null, function* () {
    try {
      if (url.startsWith("//")) url = "https:" + url;
      const response = yield fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": BASE_URL
        }
      });
      if (!response.ok) return null;
      const html = yield response.text();
      const packedRegex = /eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\),(\d+),(\{\})\)\)/;
      const match = packedRegex.exec(html);
      if (match) {
        const p = match[1];
        const a = parseInt(match[2]);
        const c = parseInt(match[3]);
        const k = match[4].split("|");
        const unpacked = unPack(p, a, c, k, null, {});
        const wurlMatch = unpacked.match(/wurl="([^"]+)"/);
        if (wurlMatch) {
          let streamUrl = wurlMatch[1];
          if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
          const urlObj = new URL(url);
          const referer = urlObj.origin + "/";
          const origin = urlObj.origin;
          return {
            url: streamUrl,
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": referer,
              "Origin": origin
            }
          };
        }
      }
      return null;
    } catch (e) {
      console.error("[GuardaHD] MixDrop extraction error:", e);
      return null;
    }
  });
}
function extractDropLoad(url) {
  return __async(this, null, function* () {
    try {
      if (url.startsWith("//")) url = "https:" + url;
      const response = yield fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": BASE_URL
        }
      });
      if (!response.ok) return null;
      const html = yield response.text();
      const regex = /eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
      const match = regex.exec(html);
      if (match) {
        let p = match[1];
        const a = parseInt(match[2]);
        let c = parseInt(match[3]);
        const k = match[4].split("|");
        while (c--) {
          if (k[c]) {
            const pattern = new RegExp("\\b" + c.toString(a) + "\\b", "g");
            p = p.replace(pattern, k[c]);
          }
        }
        const fileMatch = p.match(/file:"(.*?)"/);
        if (fileMatch) {
          let streamUrl = fileMatch[1];
          if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
          const referer = new URL(url).origin + "/";
          return {
            url: streamUrl,
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": referer
            }
          };
        }
      }
      return null;
    } catch (e) {
      console.error("[GuardaHD] DropLoad extraction error:", e);
      return null;
    }
  });
}
function extractSuperVideo(url) {
  return __async(this, null, function* () {
    try {
      if (url.startsWith("//")) url = "https:" + url;
      let directUrl = url.replace("/e/", "/").replace("/embed-", "/");
      console.log(`[GuardaHD] Testing SuperVideo direct: ${directUrl}`);
      let response = yield fetch(directUrl, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": BASE_URL
        }
      });
      if (response.status === 403 || response.status === 503) {
        console.warn("[GuardaHD] SuperVideo (Direct) blocked by Cloudflare");
      }
      let html = yield response.text();
      if (html.includes("This video can be watched as embed only")) {
        console.log("[GuardaHD] SuperVideo is embed only, trying embed URL...");
        let embedUrl = url;
        if (!embedUrl.includes("/e/") && !embedUrl.includes("/embed-")) {
          embedUrl = directUrl.replace(".cc/", ".cc/e/");
        }
        response = yield fetch(embedUrl, {
          headers: {
            "User-Agent": USER_AGENT,
            "Referer": BASE_URL
          }
        });
        html = yield response.text();
      }
      if (html.includes("Cloudflare") || response.status === 403) {
        console.warn("[GuardaHD] SuperVideo blocked by Cloudflare (403)");
        return null;
      }
      const packedRegex = /eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
      const match = packedRegex.exec(html);
      if (match) {
        const p = match[1];
        const a = parseInt(match[2]);
        const c = parseInt(match[3]);
        const k = match[4].split("|");
        const unpacked = unPack(p, a, c, k, null, {});
        const fileMatch = unpacked.match(/sources:\[\{file:"(.*?)"/);
        if (fileMatch) {
          let streamUrl = fileMatch[1];
          if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
          return streamUrl;
        }
      }
      return null;
    } catch (e) {
      console.error("[GuardaHD] SuperVideo extraction error:", e);
      return null;
    }
  });
}
function getStreams(id, type, season, episode) {
  return __async(this, null, function* () {
    let cleanId = id.toString();
    if (cleanId.startsWith("tmdb:")) cleanId = cleanId.replace("tmdb:", "");
    let imdbId = cleanId;
    if (!cleanId.startsWith("tt")) {
      const convertedId = yield getImdbId(cleanId, type);
      if (convertedId) imdbId = convertedId;
      else return [];
    }
    
    const metadata = yield getMetadata(cleanId, type);
    const title = metadata ? (metadata.title || metadata.name || metadata.original_title || metadata.original_name) : "GuardaHD";
    
    let url;
    const normalizedType = String(type).toLowerCase();
    if (normalizedType === "movie") {
      url = `${BASE_URL}/set-movie-a/${imdbId}`;
    } else if (normalizedType === "tv") {
      url = `${BASE_URL}/set-tv-a/${imdbId}/${season}/${episode}`;
    } else {
      return [];
    }
    try {
      const response = yield fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": BASE_URL
        }
      });
      if (!response.ok) return [];
      const html = yield response.text();
      const streams = [];
      const iframeRegex = /<iframe[^>]+id=["']_player["'][^>]+src=["']([^"']+)["']/;
      const iframeMatch = iframeRegex.exec(html);
      const links = [];
      if (iframeMatch) {
        links.push({ url: iframeMatch[1], name: "Active Player" });
      }
      const linkRegex = /data-link=["']([^"']+)["']/g;
      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        links.push({ url: match[1], name: "Alternative" });
      }
      const displayName = normalizedType === "movie" ? title : `${title} ${season}x${episode}`;
      const processUrl = (link) => __async(null, null, function* () {
        let streamUrl = link.url;
        if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
        if (streamUrl.includes("mixdrop") || streamUrl.includes("m1xdrop")) {
          console.log(`[GuardaHD] Attempting MixDrop extraction for ${streamUrl}`);
          const extracted = yield extractMixDrop(streamUrl);
          if (extracted && extracted.url) {
            let quality = "HD";
            if (extracted.url.includes("1080")) quality = "1080p";
            else if (extracted.url.includes("720")) quality = "720p";
            else if (extracted.url.includes("4k")) quality = "4K";
            
            const normalizedQuality = getQualityFromName(quality);

            streams.push({
              name: `GuardaHD - MixDrop`,
              title: displayName,
              url: extracted.url,
              headers: extracted.headers,
              quality: normalizedQuality,
              type: "direct"
            });
          }
        } else if (streamUrl.includes("dropload")) {
          console.log(`[GuardaHD] Attempting DropLoad extraction for ${streamUrl}`);
          const extracted = yield extractDropLoad(streamUrl);
          if (extracted && extracted.url) {
            let quality = "HD";
            if (extracted.url.includes("1080")) quality = "1080p";
            else if (extracted.url.includes("720")) quality = "720p";
            
            const normalizedQuality = getQualityFromName(quality);

            streams.push({
              name: `GuardaHD - DropLoad`,
              title: displayName,
              url: extracted.url,
              headers: extracted.headers,
              quality: normalizedQuality,
              type: "direct"
            });
          }
        } else if (streamUrl.includes("supervideo")) {
          console.log(`[GuardaHD] Attempting SuperVideo extraction for ${streamUrl}`);
          const extracted = yield extractSuperVideo(streamUrl);
          if (extracted) {
            let quality = "HD";
            if (extracted.includes("1080")) quality = "1080p";
            else if (extracted.includes("720")) quality = "720p";
            
            const normalizedQuality = getQualityFromName(quality);

            streams.push({
              name: `GuardaHD - SuperVideo`,
              title: displayName,
              url: extracted,
              quality: normalizedQuality,
              type: "direct"
            });
          }
        }
      });
      yield Promise.all(links.map((link) => processUrl(link)));
      const uniqueStreams = [];
      const seenUrls = /* @__PURE__ */ new Set();
      for (const s of streams) {
        if (!seenUrls.has(s.url)) {
          seenUrls.add(s.url);
          uniqueStreams.push(s);
        }
      }
      return uniqueStreams;
    } catch (error) {
      console.error("[GuardaHD] Error:", error);
      return [];
    }
  });
}
module.exports = { getStreams };
