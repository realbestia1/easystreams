var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
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
const BASE_URL = "https://eurostreaming.luxe";
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
      console.error("[EuroStreaming] Conversion error:", e);
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
      console.error("[EuroStreaming] TMDB error:", e);
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
      return d[e2] || e2;
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
function extractStreamTape(url) {
  return __async(this, null, function* () {
    try {
      if (url.startsWith("//")) url = "https:" + url;
      const response = yield fetch(url);
      if (!response.ok) return null;
      const html = yield response.text();
      const match = html.match(/document\.getElementById\('robotlink'\)\.innerHTML = '(.*?)'/);
      if (match) {
        let link = match[1];
        const lineMatch = html.match(/document\.getElementById\('robotlink'\)\.innerHTML = (.*);/);
        if (lineMatch) {
          const raw = lineMatch[1];
          const cleanLink = raw.replace(/['"\+\s]/g, "");
          if (cleanLink.startsWith("//")) return "https:" + cleanLink;
          if (cleanLink.startsWith("http")) return cleanLink;
        }
      }
      return null;
    } catch (e) {
      console.error("[EuroStreaming] StreamTape extraction error:", e);
      return null;
    }
  });
}
function extractVidoza(url) {
  return __async(this, null, function* () {
    try {
      if (url.startsWith("//")) url = "https:" + url;
      const response = yield fetch(url);
      if (!response.ok) return null;
      const html = yield response.text();
      const match = html.match(/sources:\s*\[\s*\{\s*file:\s*"(.*?)"/);
      if (match) {
        return match[1];
      }
      return null;
    } catch (e) {
      console.error("[EuroStreaming] Vidoza extraction error:", e);
      return null;
    }
  });
}
function extractDeltaBit(url) {
  return __async(this, null, function* () {
    try {
      if (url.startsWith("//")) url = "https:" + url;
      const response = yield fetch(url);
      if (!response.ok) return null;
      const html = yield response.text();
      const packedRegex = /eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
      const match = packedRegex.exec(html);
      if (match) {
        const p = match[1];
        const a = parseInt(match[2]);
        const c = parseInt(match[3]);
        const k = match[4].split("|");
        const unpacked = unPack(p, a, c, k, null, {});
        const fileMatch = unpacked.match(/file:\s*"(.*?)"/);
        if (fileMatch) {
          return fileMatch[1];
        }
      }
      return null;
    } catch (e) {
      console.error("[EuroStreaming] DeltaBit extraction error:", e);
      return null;
    }
  });
}
function extractUqload(url) {
  return __async(this, null, function* () {
    try {
      if (url.startsWith("//")) url = "https:" + url;
      const response = yield fetch(url);
      if (!response.ok) return null;
      const html = yield response.text();
      const match = html.match(/sources:\s*\["(.*?)"\]/);
      if (match) {
        return match[1];
      }
      return null;
    } catch (e) {
      console.error("[EuroStreaming] Uqload extraction error:", e);
      return null;
    }
  });
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
      console.error("[EuroStreaming] MixDrop extraction error:", e);
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
        const p = match[1];
        const a = parseInt(match[2]);
        const c = parseInt(match[3]);
        const k = match[4].split("|");
        const unpacked = unPack(p, a, c, k, null, {});
        const fileMatch = unpacked.match(/file:"(.*?)"/);
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
      console.error("[EuroStreaming] DropLoad extraction error:", e);
      return null;
    }
  });
}
function extractSuperVideo(url) {
  return __async(this, null, function* () {
    try {
      if (url.startsWith("//")) url = "https:" + url;
      let directUrl = url.replace("/e/", "/").replace("/embed-", "/");
      let response = yield fetch(directUrl, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": BASE_URL
        }
      });
      let html = yield response.text();
      if (html.includes("This video can be watched as embed only")) {
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
      console.error("[EuroStreaming] SuperVideo extraction error:", e);
      return null;
    }
  });
}
function searchShow(query) {
  return __async(this, null, function* () {
    try {
      console.log(`[EuroStreaming] Searching for: ${query}`);
      const params = new URLSearchParams();
      params.append("do", "search");
      params.append("subaction", "search");
      params.append("story", query);
      const response = yield fetch(`${BASE_URL}/index.php?${params.toString()}`, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": BASE_URL
        }
      });
      if (!response.ok) return [];
      const html = yield response.text();
      const resultRegex = /<div class="post-thumb">\s*<a href="([^"]+)" title="([^"]+)">/g;
      let match;
      const results = [];
      while ((match = resultRegex.exec(html)) !== null) {
        results.push({
          url: match[1],
          title: match[2]
        });
      }
      if (results.length === 0) {
        console.log(`[EuroStreaming] No results found for query: "${query}"`);
        return [];
      }
      console.log(`[EuroStreaming] Search results for "${query}": ${results.length} found`);
      const candidates = [];
      const lowerQuery = query.toLowerCase();
      const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, "");
      const normalizedQuery = normalize(query);
      results.forEach((r) => {
        let score = 0;
        const lowerTitle = r.title.toLowerCase();
        const normalizedTitle = normalize(r.title);
        if (lowerTitle === lowerQuery) {
          score = 100;
        } else if (lowerTitle.startsWith(lowerQuery)) {
          score = 80;
        } else if (normalizedTitle.includes(normalizedQuery)) {
          score = 60;
        } else {
          try {
            const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const wordRegex = new RegExp(`\\b${escapedQuery}\\b`, "i");
            if (wordRegex.test(r.title)) {
              score = 70;
            } else {
              score = 10;
            }
          } catch (e) {
            score = 10;
          }
        }
        candidates.push(__spreadProps(__spreadValues({}, r), { score }));
      });
      return candidates.sort((a, b) => b.score - a.score);
    } catch (e) {
      console.error("[EuroStreaming] Search error:", e);
      return [];
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
      console.error("[EuroStreaming] ID conversion error:", e);
      return null;
    }
  });
}
function getStreams(id, type, season, episode, showInfo) {
  return __async(this, null, function* () {
    if (String(type).toLowerCase() === "movie") return [];
    try {
      let tmdbId = id;
      if (id.toString().startsWith("tt")) {
        tmdbId = yield getTmdbIdFromImdb(id, type);
        if (!tmdbId) {
          console.log(`[EuroStreaming] Could not convert ${id} to TMDB ID`);
          return [];
        }
      } else if (id.toString().startsWith("tmdb:")) {
        tmdbId = id.toString().replace("tmdb:", "");
      }
      let fetchedShowInfo = showInfo;
      if (!fetchedShowInfo) {
        fetchedShowInfo = yield getShowInfo(tmdbId, type);
      }
      if (!fetchedShowInfo) {
        console.log(`[EuroStreaming] Could not get show info for ${tmdbId}`);
        return [];
      }
      const titlesToTry = [];
      if (fetchedShowInfo.name) titlesToTry.push(fetchedShowInfo.name);
      if (fetchedShowInfo.title) titlesToTry.push(fetchedShowInfo.title);
      if (fetchedShowInfo.original_name) titlesToTry.push(fetchedShowInfo.original_name);
      if (fetchedShowInfo.original_title) titlesToTry.push(fetchedShowInfo.original_title);
      const uniqueTitles = [...new Set(titlesToTry.filter(Boolean))];
      const allCandidates = [];
      for (const t of uniqueTitles) {
        console.log(`[EuroStreaming] Searching title: ${t}`);
        const results = yield searchShow(t);
        if (results && results.length > 0) {
          allCandidates.push(...results);
        }
      }
      const uniqueCandidates = [];
      const seenUrls = /* @__PURE__ */ new Set();
      allCandidates.sort((a, b) => b.score - a.score);
      for (const c of allCandidates) {
        if (!seenUrls.has(c.url)) {
          seenUrls.add(c.url);
          uniqueCandidates.push(c);
        }
      }
      if (uniqueCandidates.length === 0) {
        console.log(`[EuroStreaming] No candidates found for any title of ${tmdbId}`);
        return [];
      }
      const topCandidates = uniqueCandidates.slice(0, 3);
      console.log(`[EuroStreaming] Testing ${topCandidates.length} candidates for ${tmdbId}`);
      const streams = [];
      const promises = [];
      for (const candidate of topCandidates) {
        promises.push(() => __async(null, null, function* () {
          try {
            console.log(`[EuroStreaming] Checking candidate: ${candidate.title} (${candidate.url})`);
            const response = yield fetch(candidate.url, {
              headers: {
                "User-Agent": USER_AGENT,
                "Referer": BASE_URL
              }
            });
            if (!response.ok) {
              console.log(`[EuroStreaming] Failed to fetch candidate page: ${response.status}`);
              return;
            }
            const html = yield response.text();
            const episodeStr1 = `${season}x${episode}`;
            const episodeStr2 = `${season}x${episode.toString().padStart(2, "0")}`;
            const episodeRegex = new RegExp(`data-num="(${episodeStr1}|${episodeStr2})"`, "i");
            const episodeMatch = episodeRegex.exec(html);
            if (!episodeMatch) {
              console.log(`[EuroStreaming] Episode ${season}x${episode} not found in candidate`);
              return;
            }
            console.log(`[EuroStreaming] Found episode match at index ${episodeMatch.index}`);
            const startIndex = episodeMatch.index;
            const endLiIndex = html.indexOf("</li>", startIndex);
            if (endLiIndex === -1) return;
            const episodeBlock = html.substring(startIndex, endLiIndex);
            const linkRegex = /data-link=["']([^"']+)["']/g;
            let linkMatch;
            const innerPromises = [];
            while ((linkMatch = linkRegex.exec(episodeBlock)) !== null) {
              let name = "Source";
              const url = linkMatch[1];
              if (url.includes("dropload")) name = "DropLoad";
              else if (url.includes("mixdrop")) name = "MixDrop";
              else if (url.includes("supervideo")) name = "SuperVideo";
              else if (url.includes("deltabit")) name = "DeltaBit";
              else if (url.includes("vidoza")) name = "Vidoza";
              else if (url.includes("streamtape")) name = "StreamTape";
              else if (url.includes("uqload")) name = "Uqload";
              innerPromises.push(() => __async(null, null, function* () {
                try {
                  let streamUrl = url;
                  if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
                  if (streamUrl.includes("mixdrop") || streamUrl.includes("m1xdrop")) {
                    const extracted = yield extractMixDrop(streamUrl);
                    if (extracted && extracted.url) {
                      let quality = "HD";
                      if (extracted.url.includes("1080")) quality = "1080p";
                      else if (extracted.url.includes("720")) quality = "720p";
                      
                      const normalizedQuality = getQualityFromName(quality);

                      const displayName = `${candidate.title} ${season}x${episode}`;
                      streams.push({
                        name: `EuroStreaming - ${name}`,
                        title: displayName,
                        url: extracted.url,
                        headers: extracted.headers,
                        quality: normalizedQuality,
                        type: "direct"
                      });
                    }
                  } else if (streamUrl.includes("dropload")) {
                    const extracted = yield extractDropLoad(streamUrl);
                    if (extracted && extracted.url) {
                      let quality = "HD";
                      if (extracted.url.includes("1080")) quality = "1080p";
                      else if (extracted.url.includes("720")) quality = "720p";
                      
                      const normalizedQuality = getQualityFromName(quality);

                      const displayName = `${candidate.title} ${season}x${episode}`;
                      streams.push({
                        name: `EuroStreaming - ${name}`,
                        title: displayName,
                        url: extracted.url,
                        headers: extracted.headers,
                        quality: normalizedQuality,
                        type: "direct"
                      });
                    }
                  } else if (streamUrl.includes("supervideo")) {
                    const extracted = yield extractSuperVideo(streamUrl);
                    if (extracted) {
                      let quality = "HD";
                      if (extracted.includes("1080")) quality = "1080p";
                      else if (extracted.includes("720")) quality = "720p";
                      
                      const normalizedQuality = getQualityFromName(quality);

                      const displayName = `${candidate.title} ${season}x${episode}`;
                      streams.push({
                        name: `EuroStreaming - ${name}`,
                        title: displayName,
                        url: extracted,
                        quality: normalizedQuality,
                        type: "direct"
                      });
                    }
                  } else if (streamUrl.includes("deltabit")) {
                    const extracted = yield extractDeltaBit(streamUrl);
                    if (extracted) {
                      let quality = "HD";
                      if (extracted.includes("1080")) quality = "1080p";
                      else if (extracted.includes("720")) quality = "720p";
                      
                      const normalizedQuality = getQualityFromName(quality);

                      const displayName = `${candidate.title} ${season}x${episode}`;
                      streams.push({
                        name: `EuroStreaming (${name})`,
                        title: displayName,
                        url: extracted,
                        quality: normalizedQuality,
                        type: "direct"
                      });
                    }
                  } else if (streamUrl.includes("vidoza")) {
                    const extracted = yield extractVidoza(streamUrl);
                    if (extracted) {
                      let quality = "HD";
                      if (extracted.includes("1080")) quality = "1080p";
                      else if (extracted.includes("720")) quality = "720p";
                      
                      const normalizedQuality = getQualityFromName(quality);

                      const displayName = `${candidate.title} ${season}x${episode}`;
                      streams.push({
                        name: `EuroStreaming (${name})`,
                        title: displayName,
                        url: extracted,
                        quality: normalizedQuality,
                        type: "direct"
                      });
                    }
                  } else if (streamUrl.includes("streamtape")) {
                    const extracted = yield extractStreamTape(streamUrl);
                    if (extracted) {
                      let quality = "HD";
                      if (extracted.includes("1080")) quality = "1080p";
                      else if (extracted.includes("720")) quality = "720p";
                      
                      const normalizedQuality = getQualityFromName(quality);

                      const displayName = `${candidate.title} ${season}x${episode}`;
                      streams.push({
                        name: `EuroStreaming (${name})`,
                        title: displayName,
                        url: extracted,
                        quality: normalizedQuality,
                        type: "direct"
                      });
                    }
                  } else if (streamUrl.includes("uqload")) {
                    const extracted = yield extractUqload(streamUrl);
                    if (extracted) {
                      let quality = "HD";
                      if (extracted.includes("1080")) quality = "1080p";
                      else if (extracted.includes("720")) quality = "720p";
                      
                      const normalizedQuality = getQualityFromName(quality);

                      const displayName = `${candidate.title} ${season}x${episode}`;
                      streams.push({
                        name: `EuroStreaming (${name})`,
                        title: displayName,
                        url: extracted,
                        quality: normalizedQuality,
                        type: "direct"
                      });
                    }
                  }
                } catch (err) {
                  console.error(`[EuroStreaming] Error extracting ${url}:`, err);
                }
              }));
            }
            yield Promise.all(innerPromises.map((p) => p()));
          } catch (e) {
            console.error(`[EuroStreaming] Error checking candidate ${candidate.url}:`, e);
          }
        }));
      }
      yield Promise.all(promises.map((p) => p()));
      return streams;
    } catch (error) {
      console.error("[EuroStreaming] Error:", error);
      return [];
    }
  });
}
module.exports = { getStreams };
