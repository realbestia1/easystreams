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
      console.error("[Guardaserie] MixDrop extraction error:", e);
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
      console.error("[Guardaserie] DropLoad extraction error:", e);
      return null;
    }
  });
}
function extractSuperVideo(url) {
  return __async(this, null, function* () {
    try {
      if (url.startsWith("//")) url = "https:" + url;
      let directUrl = url;
      let response = yield fetch(directUrl, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": BASE_URL
        }
      });
      let html = yield response.text();
      if (html.includes("This video can be watched as embed only")) {
        if (!url.includes("/e/") && !url.includes("/embed-")) {
          directUrl = url.replace(".cc/", ".cc/e/");
          response = yield fetch(directUrl, {
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": BASE_URL
            }
          });
          html = yield response.text();
        }
      }
      const packedRegex = /eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
      const match = packedRegex.exec(html);
      if (match) {
        const p = match[1];
        const a = parseInt(match[2]);
        const c = parseInt(match[3]);
        const k = match[4].split("|");
        const unpacked = unPack(p, a, c, k, null, {});
        const fileMatch = unpacked.match(/file:"(.*?)"/);
        if (fileMatch) {
          let streamUrl = fileMatch[1];
          if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
          return streamUrl;
        }
      }
      return null;
    } catch (e) {
      console.error("[Guardaserie] SuperVideo extraction error:", e);
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
      if (id.toString().startsWith("tt")) {
        tmdbId = yield getTmdbIdFromImdb(id, type);
        if (!tmdbId) {
          console.log(`[Guardaserie] Could not convert ${id} to TMDB ID`);
          return [];
        }
      } else if (id.toString().startsWith("tmdb:")) {
        tmdbId = id.toString().replace("tmdb:", "");
      }
      const showInfo = yield getShowInfo(tmdbId, type);
      if (!showInfo) return [];
      const title = showInfo.name || showInfo.original_name;
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
      const resultRegex = /<div class="mlnh-2">\s*<h2>\s*<a href="([^"]+)" title="([^"]+)">/g;
      let match;
      let showUrl = null;
      while ((match = resultRegex.exec(searchHtml)) !== null) {
        const foundUrl = match[1];
        const foundTitle = match[2];
        if (foundTitle.toLowerCase().includes(title.toLowerCase())) {
          showUrl = foundUrl;
          break;
        }
      }
      if (!showUrl) {
        console.log("[Guardaserie] Show not found");
        return [];
      }
      console.log(`[Guardaserie] Found show URL: ${showUrl}`);
      const showResponse = yield fetch(showUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": BASE_URL
        }
      });
      const showHtml = yield showResponse.text();
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
            if (extracted.url.includes("1080")) quality = "1080p";
            else if (extracted.url.includes("720")) quality = "720p";
            
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
            if (streamUrl.includes("1080")) quality = "1080p";
            else if (streamUrl.includes("720")) quality = "720p";
            
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
            if (extracted.url.includes("1080")) quality = "1080p";
            else if (extracted.url.includes("720")) quality = "720p";
            
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
