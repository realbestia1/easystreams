var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
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

// src/extractors/common.js
var require_common = __commonJS({
  "src/extractors/common.js"(exports2, module2) {
    var USER_AGENT2 = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
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
    module2.exports = {
      USER_AGENT: USER_AGENT2,
      unPack
    };
  }
});

// src/extractors/mixdrop.js
var require_mixdrop = __commonJS({
  "src/extractors/mixdrop.js"(exports2, module2) {
    var { USER_AGENT: USER_AGENT2, unPack } = require_common();
    function extractMixDrop(url, refererBase = "https://m1xdrop.net/") {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT2,
              "Referer": refererBase
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
              return {
                url: streamUrl,
                headers: {
                  "User-Agent": USER_AGENT2,
                  "Referer": "https://m1xdrop.net/",
                  "Origin": "https://m1xdrop.net"
                }
              };
            }
          }
          return null;
        } catch (e) {
          console.error("[Extractors] MixDrop extraction error:", e);
          return null;
        }
      });
    }
    module2.exports = { extractMixDrop };
  }
});

// src/extractors/dropload.js
var require_dropload = __commonJS({
  "src/extractors/dropload.js"(exports2, module2) {
    var { USER_AGENT: USER_AGENT2, unPack } = require_common();
    function extractDropLoad(url, refererBase = null) {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          if (!refererBase) refererBase = new URL(url).origin + "/";
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT2,
              "Referer": refererBase
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
                  "User-Agent": USER_AGENT2,
                  "Referer": referer
                }
              };
            }
          }
          return null;
        } catch (e) {
          console.error("[Extractors] DropLoad extraction error:", e);
          return null;
        }
      });
    }
    module2.exports = { extractDropLoad };
  }
});

// src/extractors/supervideo.js
var require_supervideo = __commonJS({
  "src/extractors/supervideo.js"(exports2, module2) {
    var { USER_AGENT: USER_AGENT2, unPack } = require_common();
    function extractSuperVideo(url, refererBase = null) {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          if (!refererBase) refererBase = new URL(url).origin + "/";
          let directUrl = url.replace("/e/", "/").replace("/embed-", "/");
          let response = yield fetch(directUrl, {
            headers: {
              "User-Agent": USER_AGENT2,
              "Referer": refererBase
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
                "User-Agent": USER_AGENT2,
                "Referer": refererBase
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
          console.error("[Extractors] SuperVideo extraction error:", e);
          return null;
        }
      });
    }
    module2.exports = { extractSuperVideo };
  }
});

// src/extractors/streamtape.js
var require_streamtape = __commonJS({
  "src/extractors/streamtape.js"(exports2, module2) {
    var { USER_AGENT: USER_AGENT2 } = require_common();
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
          console.error("[Extractors] StreamTape extraction error:", e);
          return null;
        }
      });
    }
    module2.exports = { extractStreamTape };
  }
});

// src/extractors/uqload.js
var require_uqload = __commonJS({
  "src/extractors/uqload.js"(exports2, module2) {
    var { USER_AGENT: USER_AGENT2 } = require_common();
    function extractUqload(url, refererBase = "https://uqload.io/") {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT2,
              "Referer": refererBase
            }
          });
          if (!response.ok) return null;
          const html = yield response.text();
          const regex = /sources: \["(.*?)"\]/;
          const match = regex.exec(html);
          if (match) {
            let streamUrl = match[1];
            if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
            return {
              url: streamUrl,
              headers: {
                "User-Agent": USER_AGENT2,
                "Referer": "https://uqload.io/"
              }
            };
          }
          return null;
        } catch (e) {
          console.error("[Extractors] Uqload extraction error:", e);
          return null;
        }
      });
    }
    module2.exports = { extractUqload };
  }
});

// src/extractors/upstream.js
var require_upstream = __commonJS({
  "src/extractors/upstream.js"(exports2, module2) {
    var { USER_AGENT: USER_AGENT2, unPack } = require_common();
    function extractUpstream(url, refererBase = "https://upstream.to/") {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT2,
              "Referer": refererBase
            }
          });
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
            const fileMatch = unpacked.match(/file:"(.*?)"/);
            if (fileMatch) {
              let streamUrl = fileMatch[1];
              if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
              return {
                url: streamUrl,
                headers: {
                  "User-Agent": USER_AGENT2,
                  "Referer": "https://upstream.to/"
                }
              };
            }
          }
          return null;
        } catch (e) {
          console.error("[Extractors] Upstream extraction error:", e);
          return null;
        }
      });
    }
    module2.exports = { extractUpstream };
  }
});

// src/extractors/vidoza.js
var require_vidoza = __commonJS({
  "src/extractors/vidoza.js"(exports2, module2) {
    function extractVidoza(url) {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          const response = yield fetch(url);
          if (!response.ok) return null;
          const html = yield response.text();
          let match = html.match(/sources:\s*\[\s*\{\s*file:\s*"(.*?)"/);
          if (!match) {
            match = html.match(/source src="(.*?)"/);
          }
          if (match) {
            let streamUrl = match[1];
            if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
            return streamUrl;
          }
          return null;
        } catch (e) {
          console.error("[Extractors] Vidoza extraction error:", e);
          return null;
        }
      });
    }
    module2.exports = { extractVidoza };
  }
});

// src/extractors/vixcloud.js
var require_vixcloud = __commonJS({
  "src/extractors/vixcloud.js"(exports2, module2) {
    var { USER_AGENT: USER_AGENT2 } = require_common();
    function extractVixCloud2(url) {
      return __async(this, null, function* () {
        try {
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT2,
              "Referer": "https://www.animeunity.so/"
            }
          });
          if (!response.ok) return null;
          const html = yield response.text();
          const streams = [];
          const downloadRegex = /window\.downloadUrl\s*=\s*'([^']+)'/;
          const downloadMatch = downloadRegex.exec(html);
          if (downloadMatch) {
            const downloadUrl = downloadMatch[1];
            let quality = "Unknown";
            if (downloadUrl.includes("1080p")) quality = "1080p";
            else if (downloadUrl.includes("720p")) quality = "720p";
            else if (downloadUrl.includes("480p")) quality = "480p";
            else if (downloadUrl.includes("360p")) quality = "360p";
            streams.push({
              url: downloadUrl,
              quality,
              type: "direct",
              headers: {
                "User-Agent": USER_AGENT2,
                "Referer": "https://vixcloud.co/"
              }
            });
          }
          const tokenRegex = /'token':\s*'(\w+)'/;
          const expiresRegex = /'expires':\s*'(\d+)'/;
          const urlRegex = /url:\s*'([^']+)'/;
          const fhdRegex = /window\.canPlayFHD\s*=\s*true/;
          const tokenMatch = tokenRegex.exec(html);
          const expiresMatch = expiresRegex.exec(html);
          const urlMatch = urlRegex.exec(html);
          const fhdMatch = fhdRegex.test(html);
          if (tokenMatch && expiresMatch && urlMatch) {
            const token = tokenMatch[1];
            const expires = expiresMatch[1];
            let serverUrl = urlMatch[1];
            let finalUrl = "";
            if (serverUrl.includes("?b=1")) {
              finalUrl = `${serverUrl}&token=${token}&expires=${expires}`;
            } else {
              finalUrl = `${serverUrl}?token=${token}&expires=${expires}`;
            }
            if (fhdMatch) {
              finalUrl += "&h=1";
            }
            const parts = finalUrl.split("?");
            finalUrl = parts[0] + ".m3u8";
            if (parts.length > 1) {
              finalUrl += "?" + parts.slice(1).join("?");
            }
            streams.push({
              url: finalUrl,
              quality: "Auto",
              type: "m3u8",
              headers: {
                "User-Agent": USER_AGENT2,
                "Referer": "https://vixcloud.co/"
              }
            });
          }
          return streams;
        } catch (e) {
          console.error("[VixCloud] Extraction error:", e);
          return [];
        }
      });
    }
    module2.exports = { extractVixCloud: extractVixCloud2 };
  }
});

// src/extractors/index.js
var require_extractors = __commonJS({
  "src/extractors/index.js"(exports2, module2) {
    var { extractMixDrop } = require_mixdrop();
    var { extractDropLoad } = require_dropload();
    var { extractSuperVideo } = require_supervideo();
    var { extractStreamTape } = require_streamtape();
    var { extractUqload } = require_uqload();
    var { extractUpstream } = require_upstream();
    var { extractVidoza } = require_vidoza();
    var { extractVixCloud: extractVixCloud2 } = require_vixcloud();
    var { USER_AGENT: USER_AGENT2, unPack } = require_common();
    module2.exports = {
      extractMixDrop,
      extractDropLoad,
      extractSuperVideo,
      extractStreamTape,
      extractUqload,
      extractUpstream,
      extractVidoza,
      extractVixCloud: extractVixCloud2,
      USER_AGENT: USER_AGENT2,
      unPack
    };
  }
});

// src/animeunity/index.js
var { extractVixCloud } = require_extractors();
var BASE_URL = "https://www.animeunity.so";
var TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
var USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
function getMetadata(id, type) {
  return __async(this, null, function* () {
    try {
      const normalizedType = String(type).toLowerCase();
      let tmdbId = id;
      if (String(id).startsWith("tt")) {
        const findUrl = `https://api.themoviedb.org/3/find/${id}?api_key=${TMDB_API_KEY}&external_source=imdb_id&language=it-IT`;
        const findResponse = yield fetch(findUrl);
        if (!findResponse.ok) return null;
        const findData = yield findResponse.json();
        const results = normalizedType === "movie" ? findData.movie_results : findData.tv_results;
        if (!results || results.length === 0) return null;
        tmdbId = results[0].id;
      }
      const endpoint = normalizedType === "movie" ? "movie" : "tv";
      const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=it-IT`;
      const response = yield fetch(url);
      if (!response.ok) return null;
      return yield response.json();
    } catch (e) {
      console.error("[AnimeUnity] Metadata error:", e);
      return null;
    }
  });
}
function getSeasonMetadata(id, season) {
  return __async(this, null, function* () {
    try {
      const url = `https://api.themoviedb.org/3/tv/${id}/season/${season}?api_key=${TMDB_API_KEY}&language=it-IT`;
      const response = yield fetch(url);
      if (!response.ok) return null;
      return yield response.json();
    } catch (e) {
      return null;
    }
  });
}
function calculateAbsoluteEpisode(metadata, season, episode) {
  if (!metadata || !metadata.seasons || season === 1) return episode;
  let absoluteEpisode = parseInt(episode);
  for (const s of metadata.seasons) {
    if (s.season_number > 0 && s.season_number < season) {
      absoluteEpisode += s.episode_count;
    }
  }
  return absoluteEpisode;
}
function findBestMatch(candidates, title, originalTitle, season, metadata, options = {}) {
  if (!candidates || candidates.length === 0) return null;
  const isTv = !!metadata.name;
  let filteredCandidates = candidates;
  if (isTv && season !== 0) {
    const tvTypes = ["TV", "ONA"];
    const matches = candidates.filter((c) => tvTypes.includes(c.type));
    if (matches.length > 0) {
      filteredCandidates = matches;
    } else {
      return null;
    }
  } else {
    const movieTypes = ["Movie", "Special", "OVA", "ONA"];
    const matches = candidates.filter((c) => movieTypes.includes(c.type));
    if (matches.length > 0) {
      filteredCandidates = matches;
    } else {
      return null;
    }
  }
  const normTitle = title.toLowerCase().trim();
  const normOriginal = originalTitle ? originalTitle.toLowerCase().trim() : "";
  const preYearExactMatches = filteredCandidates.filter((c) => {
    const t = (c.title || "").toLowerCase().trim();
    const te = (c.title_eng || "").toLowerCase().trim();
    return t === normTitle || te === normTitle || normOriginal && (t === normOriginal || te === normOriginal);
  });
  const metaYear = metadata.first_air_date ? parseInt(metadata.first_air_date.substring(0, 4)) : metadata.release_date ? parseInt(metadata.release_date.substring(0, 4)) : null;
  if (metaYear && (season === 1 || !isTv)) {
    const yearFiltered = filteredCandidates.filter((c) => {
      if (!c.date || c.date === "Indeterminato" || c.date === "?") return true;
      const match = c.date.match(/(\d{4})/);
      if (match) {
        const cYear = parseInt(match[1]);
        return Math.abs(cYear - metaYear) <= 2;
      }
      return true;
    });
    if (yearFiltered.length > 0) {
      filteredCandidates = yearFiltered;
    } else if (filteredCandidates.length > 0) {
      return null;
    }
  }
  if (preYearExactMatches.length > 0) {
    const anyExactMatchSurvived = filteredCandidates.some(
      (c) => preYearExactMatches.some((pym) => pym.id === c.id)
    );
    if (!anyExactMatchSurvived) {
      console.log("[AnimeUnity] All exact matches rejected by year filter. Returning null to avoid mismatch.");
      return null;
    }
  }
  if (options.bypassSeasonCheck) {
    return filteredCandidates[0];
  }
  if (season === 0) {
    const specialTypes = ["Special", "OVA", "Movie"];
    const specialCandidates = filteredCandidates.filter((c) => specialTypes.includes(c.type));
    if (specialCandidates.length > 0) {
      const specialTitleMatch = specialCandidates.find((c) => (c.title || "").includes("Special") || (c.title_eng || "").includes("Special"));
      if (specialTitleMatch) return specialTitleMatch;
      return specialCandidates[0];
    }
    const titleMatch = filteredCandidates.find((c) => (c.title || "").includes("Special") || (c.title_eng || "").includes("Special"));
    if (titleMatch) return titleMatch;
  }
  const exactMatch = filteredCandidates.find((c) => {
    const t = (c.title || "").toLowerCase().trim();
    const te = (c.title_eng || "").toLowerCase().trim();
    return t === normTitle || te === normTitle || normOriginal && (t === normOriginal || te === normOriginal);
  });
  if (exactMatch && season === 1) return exactMatch;
  if (!isTv && season === 1) {
    if (normTitle.includes(":")) {
      const parts = normTitle.split(":");
      const subtitle = parts[parts.length - 1].trim();
      if (subtitle.length > 3) {
        let subMatch = filteredCandidates.find((c) => {
          const t = (c.title || "").toLowerCase();
          const te = (c.title_eng || "").toLowerCase();
          return t.includes(subtitle) || te.includes(subtitle);
        });
        if (!subMatch && /part\s*\d+/i.test(subtitle)) {
          const simpleSubtitle = subtitle.replace(/part\s*\d+/i, "").trim();
          if (simpleSubtitle.length > 3) {
            subMatch = filteredCandidates.find((c) => {
              const t = (c.title || "").toLowerCase();
              const te = (c.title_eng || "").toLowerCase();
              return t.includes(simpleSubtitle) || te.includes(simpleSubtitle);
            });
          }
        }
        if (subMatch) return subMatch;
      }
    }
  }
  if (season > 1) {
    const seasonStr = String(season);
    const numberMatch = filteredCandidates.find((c) => {
      const t = (c.title || "").toLowerCase();
      const te = (c.title_eng || "").toLowerCase();
      const regex = new RegExp(`\\b${seasonStr}$|\\b${seasonStr}\\b|season ${seasonStr}|stagione ${seasonStr}`, "i");
      return regex.test(t) || regex.test(te);
    });
    if (numberMatch) return numberMatch;
    const roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
    if (season < roman.length) {
      const romanStr = roman[season];
      const romanMatch = filteredCandidates.find((c) => {
        const t = (c.title || "").toLowerCase();
        const te = (c.title_eng || "").toLowerCase();
        const regex = new RegExp(`\\b${romanStr}$|\\b${romanStr}\\b`, "i");
        return regex.test(t) || regex.test(te);
      });
      if (romanMatch) return romanMatch;
    }
  } else {
    const sorted = [...filteredCandidates].sort((a, b) => {
      const lenA = (a.title || a.title_eng || "").length;
      const lenB = (b.title || b.title_eng || "").length;
      return lenA - lenB;
    });
    const hasNumberSuffix = (str) => {
      if (!str) return false;
      if (/(\s|^)\d+(\s*\(ITA\))?$/i.test(str)) return true;
      if (/final\s*season/i.test(str)) return true;
      if (/(season|stagione)\s*\d+/i.test(str)) return true;
      return false;
    };
    const noNumberMatch = sorted.find((c) => {
      const t = (c.title || "").trim();
      const te = (c.title_eng || "").trim();
      return !hasNumberSuffix(t) && !hasNumberSuffix(te);
    });
    if (noNumberMatch) return noNumberMatch;
    return sorted[0];
  }
  return filteredCandidates[0];
}
function searchAnime(query) {
  return __async(this, null, function* () {
    try {
      const url = `${BASE_URL}/archivio?title=${encodeURIComponent(query)}`;
      const response = yield fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": BASE_URL
        }
      });
      if (!response.ok) return [];
      const html = yield response.text();
      const recordsRegex = /<archivio[^>]*records="([^"]*)"/i;
      const match = recordsRegex.exec(html);
      if (!match) return [];
      const recordsJson = match[1].replace(/&quot;/g, '"');
      try {
        const records = JSON.parse(recordsJson);
        return records;
      } catch (e) {
        console.error("[AnimeUnity] Failed to parse search records:", e);
        return [];
      }
    } catch (e) {
      console.error("[AnimeUnity] Search error:", e);
      return [];
    }
  });
}
function getStreams(id, type, season, episode) {
  return __async(this, null, function* () {
    try {
      const metadata = yield getMetadata(id, type);
      if (!metadata) {
        console.error("[AnimeUnity] Metadata not found for", id);
        return [];
      }
      const title = metadata.title || metadata.name;
      const originalTitle = metadata.original_title || metadata.original_name;
      console.log(`[AnimeUnity] Searching for: ${title} (Season ${season})`);
      let candidates = [];
      let seasonNameMatch = false;
      if (season === 0) {
        const searchQueries = [
          `${title} Special`,
          `${title} OAV`,
          `${title} Movie`
        ];
        for (const query of searchQueries) {
          console.log(`[AnimeUnity] Special search: ${query}`);
          const res = yield searchAnime(query);
          if (res && res.length > 0) {
            candidates = candidates.concat(res);
          }
        }
        candidates = candidates.filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i);
      }
      if (season > 1) {
        const searchQueries = [
          `${title} ${season}`,
          `${title} Season ${season}`,
          `${title} Stagione ${season}`
        ];
        if (originalTitle && originalTitle !== title) {
          searchQueries.push(`${originalTitle} ${season}`);
        }
        const seasonMeta = yield getSeasonMetadata(metadata.id, season);
        if (seasonMeta && seasonMeta.name && !seasonMeta.name.match(/^Season \d+|^Stagione \d+/i)) {
          console.log(`[AnimeUnity] Found season name: ${seasonMeta.name}`);
          const seasonQueries = [
            `${title} ${seasonMeta.name}`,
            // "Le bizzarre... Diamond is Unbreakable"
            seasonMeta.name
            // "Diamond is Unbreakable"
          ];
          for (const query of seasonQueries) {
            console.log(`[AnimeUnity] Specific Season Name search: ${query}`);
            const res = yield searchAnime(query);
            if (res && res.length > 0) {
              console.log(`[AnimeUnity] Found matches for season name: ${query}`);
              candidates = res;
              seasonNameMatch = true;
              break;
            }
          }
        }
        if (!seasonNameMatch) {
          for (const query of searchQueries) {
            console.log(`[AnimeUnity] Specific search: ${query}`);
            const res = yield searchAnime(query);
            if (res && res.length > 0) {
              candidates = res;
              break;
            }
          }
        }
      }
      const isMovie = metadata.genres && metadata.genres.some((g) => g.name === "Movie") || season === 0 || type === "movie";
      if (candidates.length === 0) {
        console.log(`[AnimeUnity] Standard search: ${title}`);
        candidates = yield searchAnime(title);
        if (candidates.length === 0 && isMovie) {
          if (title.includes(":")) {
            const parts = title.split(":");
            if (parts.length > 1) {
              const subtitle = parts[parts.length - 1].trim();
              if (subtitle.length > 3) {
                console.log(`[AnimeUnity] Movie subtitle search: ${subtitle}`);
                const subRes = yield searchAnime(subtitle);
                if (subRes && subRes.length > 0) candidates = candidates.concat(subRes);
                if (/part\s*\d+/i.test(subtitle)) {
                  const simpleSubtitle = subtitle.replace(/part\s*\d+/i, "").trim();
                  if (simpleSubtitle.length > 3) {
                    console.log(`[AnimeUnity] Simplified subtitle search: ${simpleSubtitle}`);
                    const simpleRes = yield searchAnime(simpleSubtitle);
                    if (simpleRes && simpleRes.length > 0) candidates = candidates.concat(simpleRes);
                  }
                }
              }
              const mainTitle = parts[0].trim();
              const movieQuery = `${mainTitle} Movie`;
              console.log(`[AnimeUnity] Movie query search: ${movieQuery}`);
              const movieRes = yield searchAnime(movieQuery);
              if (movieRes && movieRes.length > 0) candidates = candidates.concat(movieRes);
            }
          } else {
            const movieQuery = `${title} Movie`;
            console.log(`[AnimeUnity] Movie query search: ${movieQuery}`);
            const movieRes = yield searchAnime(movieQuery);
            if (movieRes && movieRes.length > 0) candidates = candidates.concat(movieRes);
          }
          candidates = candidates.filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i);
        }
      }
      if ((!candidates || candidates.length === 0) && originalTitle && originalTitle !== title) {
        console.log(`[AnimeUnity] No results for ${title}, trying ${originalTitle}`);
        candidates = yield searchAnime(originalTitle);
      }
      if (!candidates || candidates.length === 0) {
        console.log("[AnimeUnity] No anime found");
        return [];
      }
      const subs = candidates.filter((c) => !(c.title || "").includes("(ITA)") && !(c.title_eng || "").includes("(ITA)"));
      const dubs = candidates.filter((c) => (c.title || "").includes("(ITA)") || (c.title_eng || "").includes("(ITA)"));
      let bestSub = findBestMatch(subs, title, originalTitle, season, metadata, { bypassSeasonCheck: seasonNameMatch });
      let bestDub = findBestMatch(dubs, title, originalTitle, season, metadata, { bypassSeasonCheck: seasonNameMatch });
      const isSuspicious = (c) => {
        if (!c) return true;
        if (season === 0) {
          const t = (c.title || c.title_eng || "").toLowerCase();
          if (t.includes("special") || t.includes("oav") || t.includes("movie")) return false;
          if (["Special", "OVA", "Movie"].includes(c.type)) return false;
          return true;
        }
        if (season === 1) {
          const t = (c.title || c.title_eng || "").toLowerCase();
          if (/final\s*season/i.test(t) || /(\s|^)\d+(\s*\(ITA\))?$/i.test(t)) return true;
          if (bestSub) {
            const subT = (bestSub.title || bestSub.title_eng || "").toLowerCase().trim();
            const dubT = t.replace(/\s*\(ita\)/i, "").trim();
            if (dubT.length > subT.length + 8) return true;
            if (!dubT.includes(subT)) return true;
          }
        }
        return false;
      };
      if (!bestDub || isSuspicious(bestDub)) {
        console.log(`[AnimeUnity] Dub not found or suspicious, trying specific dub search: ${title} (ITA)`);
        const dubQuery = `${title} (ITA)`;
        const dubRes = yield searchAnime(dubQuery);
        if (dubRes && dubRes.length > 0) {
          const newDubs = dubRes.filter((c) => (c.title || "").includes("(ITA)") || (c.title_eng || "").includes("(ITA)"));
          const betterDub = findBestMatch(newDubs, title, originalTitle, season, metadata);
          if (betterDub) bestDub = betterDub;
        }
      }
      if (!bestSub && !bestDub) {
        console.log("[AnimeUnity] No suitable match found in candidates");
        return [];
      }
      const tasks = [];
      const absEpisode = calculateAbsoluteEpisode(metadata, season, episode);
      if (bestSub) {
        console.log(`[AnimeUnity] Found SUB match: ${bestSub.title || bestSub.title_eng} (ID: ${bestSub.id})`);
        const isSeasonEntry = season === 1 || seasonNameMatch || /season|stagione|part|parte|\b\d+\b/i.test(bestSub.title || "") || /season|stagione|part|parte|\b\d+\b/i.test(bestSub.title_eng || "");
        const epToUse = isSeasonEntry ? episode : absEpisode;
        console.log(`[AnimeUnity] Using episode ${epToUse} for SUB (Is Season Entry: ${isSeasonEntry})`);
        tasks.push(getEpisodeStreams(bestSub, epToUse, "SUB ITA"));
      }
      if (bestDub) {
        console.log(`[AnimeUnity] Found DUB match: ${bestDub.title || bestDub.title_eng} (ID: ${bestDub.id})`);
        const isSeasonEntry = season === 1 || seasonNameMatch || /season|stagione|part|parte|\b\d+\b/i.test(bestDub.title || "") || /season|stagione|part|parte|\b\d+\b/i.test(bestDub.title_eng || "");
        const epToUse = isSeasonEntry ? episode : absEpisode;
        console.log(`[AnimeUnity] Using episode ${epToUse} for DUB (Is Season Entry: ${isSeasonEntry})`);
        tasks.push(getEpisodeStreams(bestDub, epToUse, "ITA"));
      }
      const results = yield Promise.all(tasks);
      return results.flat();
    } catch (e) {
      console.error("[AnimeUnity] Error:", e);
      return [];
    }
  });
}
function getEpisodeStreams(anime, episodeNumber, langTag = "") {
  return __async(this, null, function* () {
    try {
      const animeUrl = `${BASE_URL}/anime/${anime.id}-${anime.slug}`;
      const animeResponse = yield fetch(animeUrl, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": BASE_URL
        }
      });
      if (!animeResponse.ok) {
        console.error(`[AnimeUnity] Failed to fetch anime page for ${anime.title}`);
        return [];
      }
      const animeHtml = yield animeResponse.text();
      const episodesRegex = /<video-player[^>]*episodes="([^"]*)"/gi;
      let episodesMatch;
      let allEpisodes = [];
      while ((episodesMatch = episodesRegex.exec(animeHtml)) !== null) {
        try {
          const chunk = JSON.parse(episodesMatch[1].replace(/&quot;/g, '"'));
          allEpisodes = allEpisodes.concat(chunk);
        } catch (e) {
          console.error("[AnimeUnity] Error parsing episode chunk:", e);
        }
      }
      if (allEpisodes.length === 0) {
        console.error(`[AnimeUnity] No episodes found in page for ${anime.title}`);
        return [];
      }
      let episodes = allEpisodes;
      const episodesCountRegex = /episodes_count="(\d+)"/i;
      const countMatch = episodesCountRegex.exec(animeHtml);
      const totalEpisodes = countMatch ? parseInt(countMatch[1]) : episodes.length;
      let targetEpisode = episodes.find((ep) => ep.number == episodeNumber);
      if (!targetEpisode && totalEpisodes > episodes.length) {
        console.log(`[AnimeUnity] Episode ${episodeNumber} not found in initial list. Checking API...`);
        const startRange = Math.floor((episodeNumber - 1) / 120) * 120 + 1;
        const endRange = startRange + 119;
        if (startRange > episodes.length || startRange <= episodes.length && episodeNumber > episodes[episodes.length - 1].number) {
          try {
            const apiUrl = `${BASE_URL}/info_api/${anime.id}/1?start_range=${startRange}&end_range=${endRange}`;
            console.log(`[AnimeUnity] Fetching episodes range: ${startRange}-${endRange}`);
            const apiResponse = yield fetch(apiUrl, {
              headers: {
                "User-Agent": USER_AGENT,
                "X-Requested-With": "XMLHttpRequest",
                "Referer": animeUrl
              }
            });
            if (apiResponse.ok) {
              const json = yield apiResponse.json();
              if (json.episodes && Array.isArray(json.episodes)) {
                episodes = episodes.concat(json.episodes);
                targetEpisode = episodes.find((ep) => ep.number == episodeNumber);
                if (targetEpisode) {
                  console.log(`[AnimeUnity] Found episode ${episodeNumber} via API`);
                }
              }
            } else {
              console.error(`[AnimeUnity] API fetch failed: ${apiResponse.status}`);
            }
          } catch (e) {
            console.error(`[AnimeUnity] Error fetching additional episodes:`, e);
          }
        }
      }
      if (!targetEpisode) {
        console.log(`[AnimeUnity] Episode ${episodeNumber} not found in ${anime.title}. Total eps: ${episodes.length}`);
        if (episodes.length > 0) {
          console.log(`First ep: ${episodes[0].number}, Last ep: ${episodes[episodes.length - 1].number}`);
        }
        return [];
      }
      const streams = [];
      const labelSuffix = langTag ? ` [${langTag}]` : "";
      const extractQuality = (str) => {
        if (!str) return "Unknown";
        const match = str.match(/(\d{3,4}p)/i);
        return match ? match[1] : "Unknown";
      };
      if (targetEpisode.link && targetEpisode.link.startsWith("http")) {
        let quality = extractQuality(targetEpisode.link);
        if (quality === "Unknown") quality = extractQuality(targetEpisode.file_name);
        streams.push({
          name: "AnimeUnity" + labelSuffix,
          title: `${anime.title} - Ep ${episodeNumber}${labelSuffix}`,
          url: targetEpisode.link,
          quality,
          type: "direct",
          headers: {
            "User-Agent": USER_AGENT,
            "Referer": BASE_URL
          }
        });
      }
      if (targetEpisode.scws_id) {
        try {
          const embedApiUrl = `${BASE_URL}/embed-url/${targetEpisode.id}`;
          const embedResponse = yield fetch(embedApiUrl, {
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": animeUrl,
              "X-Requested-With": "XMLHttpRequest"
            }
          });
          if (embedResponse.ok) {
            const embedUrl = yield embedResponse.text();
            if (embedUrl && embedUrl.startsWith("http")) {
              const vixStreams = yield extractVixCloud(embedUrl);
              if (vixStreams && vixStreams.length > 0) {
                streams.push(...vixStreams.map((s) => __spreadProps(__spreadValues({}, s), {
                  name: "AnimeUnity - VixCloud" + labelSuffix,
                  title: `${anime.title} - Ep ${episodeNumber}${labelSuffix}`
                })));
              }
            }
          }
        } catch (e) {
          console.error("[AnimeUnity] VixCloud extraction error:", e);
        }
      }
      return streams;
    } catch (e) {
      console.error(`[AnimeUnity] Error extracting streams for ${anime.title}:`, e);
      return [];
    }
  });
}
module.exports = { getStreams, getMetadata, searchAnime };
