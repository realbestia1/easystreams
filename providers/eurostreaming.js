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
    function unPack2(p, a, c, k, e, d) {
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
      unPack: unPack2
    };
  }
});

// src/extractors/mixdrop.js
var require_mixdrop = __commonJS({
  "src/extractors/mixdrop.js"(exports2, module2) {
    var { USER_AGENT: USER_AGENT2, unPack: unPack2 } = require_common();
    function extractMixDrop2(url, refererBase = "https://m1xdrop.net/") {
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
            const unpacked = unPack2(p, a, c, k, null, {});
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
    module2.exports = { extractMixDrop: extractMixDrop2 };
  }
});

// src/extractors/dropload.js
var require_dropload = __commonJS({
  "src/extractors/dropload.js"(exports2, module2) {
    var { USER_AGENT: USER_AGENT2, unPack: unPack2 } = require_common();
    function extractDropLoad2(url, refererBase = null) {
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
            const unpacked = unPack2(p, a, c, k, null, {});
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
    module2.exports = { extractDropLoad: extractDropLoad2 };
  }
});

// src/extractors/supervideo.js
var require_supervideo = __commonJS({
  "src/extractors/supervideo.js"(exports2, module2) {
    var { USER_AGENT: USER_AGENT2, unPack: unPack2 } = require_common();
    function extractSuperVideo2(url, refererBase = null) {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          const id = url.split("/").pop();
          const embedUrl = `https://supervideo.tv/e/${id}`;
          if (!refererBase) refererBase = "https://guardahd.stream/";
          let response = yield fetch(embedUrl, {
            headers: {
              "User-Agent": USER_AGENT2,
              "Referer": refererBase
            }
          });
          let html = yield response.text();
          if (html.includes("Cloudflare") || response.status === 403) {
            console.log(`[Extractors] SuperVideo (tv) returned 403/Cloudflare`);
            return null;
          }
          const packedRegex = /eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
          const match = packedRegex.exec(html);
          if (match) {
            const p = match[1];
            const a = parseInt(match[2]);
            const c = parseInt(match[3]);
            const k = match[4].split("|");
            const unpacked = unPack2(p, a, c, k, null, {});
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
    module2.exports = { extractSuperVideo: extractSuperVideo2 };
  }
});

// src/extractors/streamtape.js
var require_streamtape = __commonJS({
  "src/extractors/streamtape.js"(exports2, module2) {
    var { USER_AGENT: USER_AGENT2 } = require_common();
    function extractStreamTape2(url) {
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
    module2.exports = { extractStreamTape: extractStreamTape2 };
  }
});

// src/extractors/uqload.js
var require_uqload = __commonJS({
  "src/extractors/uqload.js"(exports2, module2) {
    var { USER_AGENT: USER_AGENT2 } = require_common();
    function extractUqload2(url, refererBase = "https://uqload.io/") {
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
    module2.exports = { extractUqload: extractUqload2 };
  }
});

// src/extractors/upstream.js
var require_upstream = __commonJS({
  "src/extractors/upstream.js"(exports2, module2) {
    var { USER_AGENT: USER_AGENT2, unPack: unPack2 } = require_common();
    function extractUpstream2(url, refererBase = "https://upstream.to/") {
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
            const unpacked = unPack2(p, a, c, k, null, {});
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
    module2.exports = { extractUpstream: extractUpstream2 };
  }
});

// src/extractors/vidoza.js
var require_vidoza = __commonJS({
  "src/extractors/vidoza.js"(exports2, module2) {
    function extractVidoza2(url) {
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
    module2.exports = { extractVidoza: extractVidoza2 };
  }
});

// src/extractors/vixcloud.js
var require_vixcloud = __commonJS({
  "src/extractors/vixcloud.js"(exports2, module2) {
    var { USER_AGENT: USER_AGENT2 } = require_common();
    function extractVixCloud(url) {
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
            const urlObj = new URL(finalUrl);
            if (!urlObj.pathname.endsWith(".m3u8")) {
              urlObj.pathname += ".m3u8";
            }
            finalUrl = urlObj.toString();
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
    module2.exports = { extractVixCloud };
  }
});

// src/extractors/deltabit.js
var require_deltabit = __commonJS({
  "src/extractors/deltabit.js"(exports2, module2) {
    var { USER_AGENT: USER_AGENT2, unPack: unPack2 } = require_common();
    function extractDeltaBit2(url) {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT2
            }
          });
          if (!response.ok) return null;
          const html = yield response.text();
          const packedRegex = /eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/g;
          let match;
          let fileFallback = null;
          while ((match = packedRegex.exec(html)) !== null) {
            const p = match[1];
            const a = parseInt(match[2]);
            const c = parseInt(match[3]);
            const k = match[4].split("|");
            const unpacked = unPack2(p, a, c, k, null, {});
            const fileMatch = unpacked.match(/file:\s*"(.*?)"/);
            if (fileMatch) {
              return fileMatch[1];
            }
            const srcMatch = unpacked.match(/src:\s*"(.*?)"/);
            if (srcMatch && !fileFallback) {
              fileFallback = srcMatch[1];
            }
          }
          if (fileFallback) {
            return fileFallback;
          }
          return null;
        } catch (e) {
          console.error("[Extractors] DeltaBit extraction error:", e);
          return null;
        }
      });
    }
    module2.exports = { extractDeltaBit: extractDeltaBit2 };
  }
});

// src/extractors/index.js
var require_extractors = __commonJS({
  "src/extractors/index.js"(exports2, module2) {
    var { extractMixDrop: extractMixDrop2 } = require_mixdrop();
    var { extractDropLoad: extractDropLoad2 } = require_dropload();
    var { extractSuperVideo: extractSuperVideo2 } = require_supervideo();
    var { extractStreamTape: extractStreamTape2 } = require_streamtape();
    var { extractUqload: extractUqload2 } = require_uqload();
    var { extractUpstream: extractUpstream2 } = require_upstream();
    var { extractVidoza: extractVidoza2 } = require_vidoza();
    var { extractVixCloud } = require_vixcloud();
    var { extractDeltaBit: extractDeltaBit2 } = require_deltabit();
    var { USER_AGENT: USER_AGENT2, unPack: unPack2 } = require_common();
    module2.exports = {
      extractMixDrop: extractMixDrop2,
      extractDropLoad: extractDropLoad2,
      extractSuperVideo: extractSuperVideo2,
      extractStreamTape: extractStreamTape2,
      extractUqload: extractUqload2,
      extractUpstream: extractUpstream2,
      extractVidoza: extractVidoza2,
      extractVixCloud,
      extractDeltaBit: extractDeltaBit2,
      USER_AGENT: USER_AGENT2,
      unPack: unPack2
    };
  }
});

// src/tmdb_helper.js
var require_tmdb_helper = __commonJS({
  "src/tmdb_helper.js"(exports2, module2) {
    var TMDB_API_KEY2 = "68e094699525b18a70bab2f86b1fa706";
    function getTmdbFromKitsu2(kitsuId) {
      return __async(this, null, function* () {
        var _a, _b, _c, _d;
        try {
          const id = String(kitsuId).replace("kitsu:", "");
          const mappingResponse = yield fetch(`https://kitsu.io/api/edge/anime/${id}/mappings`);
          let mappingData = null;
          if (mappingResponse.ok) {
            mappingData = yield mappingResponse.json();
          }
          let tmdbId = null;
          let season = null;
          if (mappingData && mappingData.data) {
            const tvdbMapping = mappingData.data.find((m) => m.attributes.externalSite === "thetvdb");
            if (tvdbMapping) {
              const tvdbId = tvdbMapping.attributes.externalId;
              const findUrl = `https://api.themoviedb.org/3/find/${tvdbId}?api_key=${TMDB_API_KEY2}&external_source=tvdb_id`;
              const findResponse = yield fetch(findUrl);
              const findData = yield findResponse.json();
              if (((_a = findData.tv_results) == null ? void 0 : _a.length) > 0) tmdbId = findData.tv_results[0].id;
              else if (((_b = findData.movie_results) == null ? void 0 : _b.length) > 0) return { tmdbId: findData.movie_results[0].id, season: null };
            }
            if (!tmdbId) {
              const imdbMapping = mappingData.data.find((m) => m.attributes.externalSite === "imdb");
              if (imdbMapping) {
                const imdbId = imdbMapping.attributes.externalId;
                const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY2}&external_source=imdb_id`;
                const findResponse = yield fetch(findUrl);
                const findData = yield findResponse.json();
                if (((_c = findData.tv_results) == null ? void 0 : _c.length) > 0) tmdbId = findData.tv_results[0].id;
                else if (((_d = findData.movie_results) == null ? void 0 : _d.length) > 0) return { tmdbId: findData.movie_results[0].id, season: null };
              }
            }
          }
          const detailsResponse = yield fetch(`https://kitsu.io/api/edge/anime/${id}`);
          if (!detailsResponse.ok) return null;
          const detailsData = yield detailsResponse.json();
          if (detailsData && detailsData.data && detailsData.data.attributes) {
            const attributes = detailsData.data.attributes;
            const titlesToTry = /* @__PURE__ */ new Set();
            if (attributes.titles.en) titlesToTry.add(attributes.titles.en);
            if (attributes.titles.en_jp) titlesToTry.add(attributes.titles.en_jp);
            if (attributes.canonicalTitle) titlesToTry.add(attributes.canonicalTitle);
            if (attributes.titles.ja_jp) titlesToTry.add(attributes.titles.ja_jp);
            const titleList = Array.from(titlesToTry);
            const year = attributes.startDate ? attributes.startDate.substring(0, 4) : null;
            const subtype = attributes.subtype;
            if (!tmdbId) {
              const type = subtype === "movie" ? "movie" : "tv";
              for (const title2 of titleList) {
                if (tmdbId) break;
                if (!title2) continue;
                let searchData = { results: [] };
                if (year) {
                  let yearParam = "";
                  if (type === "movie") yearParam = `&primary_release_year=${year}`;
                  else yearParam = `&first_air_date_year=${year}`;
                  const searchUrlYear = `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(title2)}&api_key=${TMDB_API_KEY2}${yearParam}`;
                  const res = yield fetch(searchUrlYear);
                  const data = yield res.json();
                  if (data.results && data.results.length > 0) {
                    searchData = data;
                  }
                }
                if (!searchData.results || searchData.results.length === 0) {
                  const searchUrl = `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(title2)}&api_key=${TMDB_API_KEY2}`;
                  const searchResponse = yield fetch(searchUrl);
                  searchData = yield searchResponse.json();
                }
                if (searchData.results && searchData.results.length > 0) {
                  if (year) {
                    const match = searchData.results.find((r) => {
                      const date = type === "movie" ? r.release_date : r.first_air_date;
                      return date && date.startsWith(year);
                    });
                    if (match) {
                      tmdbId = match.id;
                    } else {
                      tmdbId = searchData.results[0].id;
                    }
                  } else {
                    tmdbId = searchData.results[0].id;
                  }
                } else if (subtype !== "movie") {
                  const cleanTitle = title2.replace(/\s(\d+)$/, "").replace(/\sSeason\s\d+$/i, "");
                  if (cleanTitle !== title2) {
                    const cleanSearchUrl = `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(cleanTitle)}&api_key=${TMDB_API_KEY2}`;
                    const cleanSearchResponse = yield fetch(cleanSearchUrl);
                    const cleanSearchData = yield cleanSearchResponse.json();
                    if (cleanSearchData.results && cleanSearchData.results.length > 0) {
                      tmdbId = cleanSearchData.results[0].id;
                    }
                  }
                }
              }
            }
            const title = attributes.titles.en || attributes.titles.en_jp || attributes.canonicalTitle;
            if (tmdbId && subtype !== "movie") {
              const seasonMatch = title.match(/Season\s*(\d+)/i) || title.match(/(\d+)(?:st|nd|rd|th)\s*Season/i);
              if (seasonMatch) {
                season = parseInt(seasonMatch[1]);
              } else if (title.match(/\s(\d+)$/)) {
                season = parseInt(title.match(/\s(\d+)$/)[1]);
              } else if (title.match(/\sII$/)) season = 2;
              else if (title.match(/\sIII$/)) season = 3;
              else if (title.match(/\sIV$/)) season = 4;
              else if (title.match(/\sV$/)) season = 5;
            }
          }
          return { tmdbId, season };
        } catch (e) {
          console.error("[TMDB Helper] Kitsu resolve error:", e);
          return null;
        }
      });
    }
    function getSeasonEpisodeFromAbsolute2(tmdbId, absoluteEpisode) {
      return __async(this, null, function* () {
        try {
          const url = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY2}&append_to_response=seasons`;
          const response = yield fetch(url);
          if (!response.ok) return null;
          const data = yield response.json();
          let totalEpisodes = 0;
          const seasons = data.seasons.filter((s) => s.season_number > 0).sort((a, b) => a.season_number - b.season_number);
          for (const season of seasons) {
            if (absoluteEpisode <= totalEpisodes + season.episode_count) {
              return {
                season: season.season_number,
                episode: absoluteEpisode - totalEpisodes
              };
            }
            totalEpisodes += season.episode_count;
          }
          return null;
        } catch (e) {
          console.error("[TMDB] Error mapping absolute episode:", e);
          return null;
        }
      });
    }
    function isAnime(metadata) {
      if (!metadata) return false;
      const isAnimation = metadata.genres && metadata.genres.some((g) => g.id === 16 || g.name === "Animation" || g.name === "Animazione");
      if (!isAnimation) return false;
      const asianCountries = ["JP", "CN", "KR", "TW", "HK"];
      const asianLangs = ["ja", "zh", "ko", "cn"];
      let countries = [];
      if (metadata.origin_country && Array.isArray(metadata.origin_country)) {
        countries = metadata.origin_country;
      } else if (metadata.production_countries && Array.isArray(metadata.production_countries)) {
        countries = metadata.production_countries.map((c) => c.iso_3166_1);
      }
      const hasAsianCountry = countries.some((c) => asianCountries.includes(c));
      const hasAsianLang = asianLangs.includes(metadata.original_language);
      return hasAsianCountry || hasAsianLang;
    }
    module2.exports = { getTmdbFromKitsu: getTmdbFromKitsu2, getSeasonEpisodeFromAbsolute: getSeasonEpisodeFromAbsolute2, isAnime };
  }
});

// src/formatter.js
var require_formatter = __commonJS({
  "src/formatter.js"(exports2, module2) {
    function formatStream2(stream, providerName) {
      let quality = stream.quality || "";
      if (quality === "2160p") quality = "\u{1F525}4K UHD";
      else if (quality === "1440p") quality = "\u2728 QHD";
      else if (quality === "1080p") quality = "\u{1F680} FHD";
      else if (quality === "720p") quality = "\u{1F4BF} HD";
      else if (quality === "576p" || quality === "480p" || quality === "360p" || quality === "240p") quality = "\u{1F4A9} Low Quality";
      else if (!quality || quality.toLowerCase() === "auto") quality = "Unknown";
      let title = `\u{1F4C1} ${stream.title || "Stream"}`;
      let language = stream.language;
      if (!language) {
        if (stream.name && (stream.name.includes("SUB ITA") || stream.name.includes("SUB"))) language = "\u{1F1EF}\u{1F1F5} \u{1F1EE}\u{1F1F9}";
        else if (stream.title && (stream.title.includes("SUB ITA") || stream.title.includes("SUB"))) language = "\u{1F1EF}\u{1F1F5} \u{1F1EE}\u{1F1F9}";
        else language = "\u{1F1EE}\u{1F1F9}";
      }
      let details = [];
      if (stream.size) details.push(`\u{1F4E6} ${stream.size}`);
      const desc = details.join(" | ");
      let pName = stream.name || stream.server || providerName;
      if (pName) {
        pName = pName.replace(/\s*\[?\(?\s*SUB\s*ITA\s*\)?\]?/i, "").replace(/\s*\[?\(?\s*ITA\s*\)?\]?/i, "").replace(/\s*\[?\(?\s*SUB\s*\)?\]?/i, "").replace(/\(\s*\)/g, "").replace(/\[\s*\]/g, "").trim();
      }
      if (pName === providerName) {
        pName = pName.charAt(0).toUpperCase() + pName.slice(1);
      }
      if (pName) {
        pName = `\u{1F4E1} ${pName}`;
      }
      const finalName = quality || pName;
      let titleText = `${title}
${pName}`;
      if (desc) titleText += ` | ${desc}`;
      if (language) titleText += `
\u{1F5E3}\uFE0F ${language}`;
      return __spreadProps(__spreadValues({}, stream), {
        // Keep original properties
        name: finalName,
        title: titleText,
        // Ensure language is set for Stremio/Nuvio sorting
        language,
        // Mark as formatted
        _nuvio_formatted: true
      });
    }
    module2.exports = { formatStream: formatStream2 };
  }
});

// src/eurostreaming/index.js
var __defProp2 = Object.defineProperty;
var __defProps2 = Object.defineProperties;
var __getOwnPropDescs2 = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols2 = Object.getOwnPropertySymbols;
var __hasOwnProp2 = Object.prototype.hasOwnProperty;
var __propIsEnum2 = Object.prototype.propertyIsEnumerable;
var __defNormalProp2 = (obj, key, value) => key in obj ? __defProp2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues2 = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp2.call(b, prop))
      __defNormalProp2(a, prop, b[prop]);
  if (__getOwnPropSymbols2)
    for (var prop of __getOwnPropSymbols2(b)) {
      if (__propIsEnum2.call(b, prop))
        __defNormalProp2(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps2 = (a, b) => __defProps2(a, __getOwnPropDescs2(b));
var __async2 = (__this, __arguments, generator) => {
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
var BASE_URL = "https://eurostreaming.luxe";
var TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
var USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
var { extractMixDrop, extractDropLoad, extractSuperVideo, extractStreamTape, extractVidoza, extractUqload, extractUpstream, unPack, extractDeltaBit } = require_extractors();
var { getSeasonEpisodeFromAbsolute, getTmdbFromKitsu } = require_tmdb_helper();
var { formatStream } = require_formatter();
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
function getImdbId(tmdbId, type) {
  return __async2(this, null, function* () {
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
  return __async2(this, null, function* () {
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
function searchShow(query) {
  return __async2(this, null, function* () {
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
        candidates.push(__spreadProps2(__spreadValues2({}, r), { score }));
      });
      return candidates.sort((a, b) => b.score - a.score);
    } catch (e) {
      console.error("[EuroStreaming] Search error:", e);
      return [];
    }
  });
}
function getTmdbIdFromImdb(imdbId, type) {
  return __async2(this, null, function* () {
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
function verifyCandidateWithTmdb(title, targetTmdbId, type) {
  return __async(this, null, function* () {
    try {
      const searchUrl = `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(title)}&api_key=${TMDB_API_KEY}&language=it-IT`;
      const response = yield fetch(searchUrl);
      if (!response.ok) return true;
      const data = yield response.json();
      if (data.results && data.results.length > 0) {
        const topResult = data.results[0];
        if (String(topResult.id) === String(targetTmdbId)) {
          return true;
        }
        console.log(`[EuroStreaming] Title verification mismatch: Candidate "${title}" maps to ID ${topResult.id} (${topResult.name || topResult.title}), but expected ${targetTmdbId}`);
        return false;
      }
      return true;
    } catch (e) {
      console.error("[EuroStreaming] Verification error:", e);
      return true;
    }
  });
}
function verifyMoviePlayer(url, targetYear) {
  return __async(this, null, function* () {
    try {
      console.log(`[EuroStreaming] Verifying via MoviePlayer: ${url}`);
      const response = yield fetch(url, {
        headers: {
          "User-Agent": USER_AGENT
        }
      });
      if (!response.ok) return false;
      const html = yield response.text();
      const yearMatch1 = html.match(/trasmessa dal (\d{4})/i);
      if (yearMatch1) {
        const foundYear = parseInt(yearMatch1[1]);
        if (Math.abs(foundYear - targetYear) <= 1) {
          console.log(`[EuroStreaming] MoviePlayer verified year ${foundYear} (Target: ${targetYear})`);
          return true;
        }
      }
      const yearMatch2 = html.match(/Prima messa in onda originale.*?(\d{4})/i);
      if (yearMatch2) {
        const foundYear = parseInt(yearMatch2[1]);
        if (Math.abs(foundYear - targetYear) <= 1) {
          console.log(`[EuroStreaming] MoviePlayer verified year ${foundYear} (Target: ${targetYear})`);
          return true;
        }
      }
      const titleMatch = html.match(new RegExp("<title>.*\\(.*(\\d{4}).*\\).*<\\/title>", "is"));
      if (titleMatch) {
        const foundYear = parseInt(titleMatch[1]);
        if (Math.abs(foundYear - targetYear) <= 2) {
          console.log(`[EuroStreaming] MoviePlayer verified title year ${foundYear} (Target: ${targetYear})`);
          return true;
        }
      }
      console.log(`[EuroStreaming] MoviePlayer verification failed. Target Year: ${targetYear}`);
      return false;
    } catch (e) {
      console.error("[EuroStreaming] MoviePlayer error:", e);
      return false;
    }
  });
}
function getStreams(id, type, season, episode, showInfo) {
  if (["movie"].includes(String(type).toLowerCase())) return [];
  return __async2(this, null, function* () {
    try {
      let tmdbId = id;
      let imdbId = null;
      if (id.toString().startsWith("tt")) {
        imdbId = id.toString();
        tmdbId = yield getTmdbIdFromImdb(id, type);
        if (!tmdbId) {
          console.log(`[EuroStreaming] Could not convert ${id} to TMDB ID`);
          return [];
        }
      } else if (id.toString().startsWith("kitsu:")) {
        const resolved = yield getTmdbFromKitsu(id);
        if (resolved && resolved.tmdbId) {
          tmdbId = resolved.tmdbId;
          if (resolved.season) {
            console.log(`[EuroStreaming] Kitsu mapping indicates Season ${resolved.season}. Overriding requested Season ${season}`);
            season = resolved.season;
          }
          console.log(`[EuroStreaming] Resolved Kitsu ID ${id} to TMDB ID ${tmdbId}, Season ${season}`);
        } else {
          console.log(`[EuroStreaming] Could not convert ${id} to TMDB ID`);
          return [];
        }
      } else if (id.toString().startsWith("tmdb:")) {
        tmdbId = id.toString().replace("tmdb:", "");
      }
      if (!imdbId && tmdbId) {
        try {
          const resolvedImdb = yield getImdbId(tmdbId, type);
          if (resolvedImdb) {
            imdbId = resolvedImdb;
            console.log(`[EuroStreaming] Resolved TMDB ID ${tmdbId} to IMDb ID ${imdbId} for verification`);
          }
        } catch (e) {
          console.log(`[EuroStreaming] Failed to resolve IMDb ID for verification: ${e.message}`);
        }
      }
      let fetchedShowInfo = showInfo;
      if (!fetchedShowInfo) {
        fetchedShowInfo = yield getShowInfo(tmdbId, type);
      }
      if (!fetchedShowInfo) {
        console.log(`[EuroStreaming] Could not get show info for ${tmdbId}`);
        return [];
      }
      const cleanTitle = fetchedShowInfo.name || fetchedShowInfo.title || fetchedShowInfo.original_name || fetchedShowInfo.original_title || "Serie TV";
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
      let mappedSeason = null;
      let mappedEpisode = null;
      if (season === 1 && episode > 20 && tmdbId) {
        try {
          const mapped = yield getSeasonEpisodeFromAbsolute(tmdbId, episode);
          if (mapped) {
            console.log(`[EuroStreaming] Mapped absolute episode ${episode} to Season ${mapped.season}, Episode ${mapped.episode}`);
            mappedSeason = mapped.season;
            mappedEpisode = mapped.episode;
          }
        } catch (e) {
          console.error("[EuroStreaming] Error mapping episode:", e);
        }
      }
      for (const candidate of topCandidates) {
        promises.push(() => __async2(null, null, function* () {
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
            let isVerified = false;
            const tmdbLinkMatches = html.match(/themoviedb\.org\/(?:tv|movie)\/(\d+)/g);
            if (tmdbLinkMatches) {
              const foundIds = tmdbLinkMatches.map((l) => {
                const m = l.match(/\/(\d+)/);
                return m ? m[1] : null;
              }).filter(Boolean);
              if (foundIds.includes(String(tmdbId))) {
                console.log(`[EuroStreaming] Verified candidate ${candidate.title} via TMDB link.`);
                isVerified = true;
              }
            }
            if (!isVerified) {
              const mpLinkMatch = html.match(/href=["'](https?:\/\/(?:www\.)?movieplayer\.it\/serietv\/[^"']+)["']/i);
              if (mpLinkMatch) {
                const mpUrl = mpLinkMatch[1];
                const targetYear = fetchedShowInfo && (fetchedShowInfo.first_air_date || fetchedShowInfo.release_date) ? parseInt((fetchedShowInfo.first_air_date || fetchedShowInfo.release_date).substring(0, 4)) : null;
                if (targetYear) {
                  const mpVerified = yield verifyMoviePlayer(mpUrl, targetYear);
                  if (mpVerified) {
                    isVerified = true;
                    console.log(`[EuroStreaming] Verified candidate ${candidate.title} via MoviePlayer link.`);
                  }
                }
              }
            }
            if (!isVerified && imdbId) {
              const targetImdbId = imdbId;
              const imdbMatches = html.match(/tt\d{7,8}/g);
              if (imdbMatches && imdbMatches.length > 0) {
                const hasTargetId = imdbMatches.some((match) => match === targetImdbId);
                if (hasTargetId) {
                  console.log(`[EuroStreaming] Verified candidate ${candidate.title} with IMDB ID match.`);
                  isVerified = true;
                } else {
                  console.log(`[EuroStreaming] IMDB ID mismatch for ${candidate.title}. Found: ${imdbMatches.join(", ")}`);
                }
              }
            }
            if (!isVerified) {
              if (cleanTitle.includes("One Piece") && candidate.title.includes("All'arrembaggio")) {
                console.log(`[EuroStreaming] Accepting "All'arrembaggio" as valid alias for One Piece.`);
                isVerified = true;
              } else {
                console.log(`[EuroStreaming] No direct ID match found for ${candidate.title}. Verifying via TMDB search...`);
                const isTitleMatch = yield verifyCandidateWithTmdb(candidate.title, tmdbId, type);
                if (isTitleMatch) {
                  console.log(`[EuroStreaming] Verified candidate ${candidate.title} via reverse TMDB search.`);
                  isVerified = true;
                }
              }
            }
            if (!isVerified) {
              console.log(`[EuroStreaming] Skipping candidate ${candidate.title} - Verification failed.`);
              return;
            }
            const epPattern1 = new RegExp(`${season}x${episode}\\b`, "i");
            const epPattern2 = new RegExp(`${season}\\s*x\\s*${episode}\\b`, "i");
            let epPatternMapped1 = null;
            let epPatternMapped2 = null;
            if (mappedSeason) {
              epPatternMapped1 = new RegExp(`${mappedSeason}x${mappedEpisode}\\b`, "i");
              epPatternMapped2 = new RegExp(`${mappedSeason}\\s*x\\s*${mappedEpisode}\\b`, "i");
            }
            let epPattern3 = null;
            if (season === 1) {
              epPattern3 = new RegExp(`Episode\\s*${episode}\\b`, "i");
            }
            let episodeMatch = epPattern1.exec(html) || epPattern2.exec(html);
            if (!episodeMatch && epPatternMapped1) {
              episodeMatch = epPatternMapped1.exec(html) || epPatternMapped2.exec(html);
              if (episodeMatch) console.log(`[EuroStreaming] Found mapped episode ${mappedSeason}x${mappedEpisode}`);
            }
            if (!episodeMatch && epPattern3) {
              episodeMatch = epPattern3.exec(html);
            }
            if (!episodeMatch) {
              console.log(`[EuroStreaming] Episode ${season}x${episode} not found with regex. Scanning content...`);
            }
            let epString1 = `${season}x${episode}`;
            let epString2 = `${season}x${episode.toString().padStart(2, "0")}`;
            if (mappedSeason) {
              const mappedStr1 = `${mappedSeason}x${mappedEpisode}`;
              const mappedStr2 = `${mappedSeason}x${mappedEpisode.toString().padStart(2, "0")}`;
              if (html.indexOf(mappedStr1) !== -1) {
                epString1 = mappedStr1;
                epString2 = mappedStr2;
              } else if (html.indexOf(mappedStr2) !== -1) {
                epString1 = mappedStr2;
                epString2 = mappedStr1;
              }
            }
            let searchIndex = html.indexOf(epString1);
            if (searchIndex === -1) searchIndex = html.indexOf(epString2);
            if (searchIndex === -1 && season === 1) {
              const epString3 = `Episodio ${episode}`;
              const epString4 = `Ep. ${episode}`;
              searchIndex = html.indexOf(epString3);
              if (searchIndex === -1) searchIndex = html.indexOf(epString4);
            }
            if (searchIndex === -1) {
              console.log(`[EuroStreaming] Episode ${season}x${episode} not found in content.`);
              return;
            }
            console.log(`[EuroStreaming] Found episode marker at index ${searchIndex}`);
            const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
            let linkMatch;
            const potentialLinks = [];
            while ((linkMatch = linkRegex.exec(html)) !== null) {
              const href = linkMatch[1];
              const text = linkMatch[2].replace(/<[^>]+>/g, "").trim();
              if (text.includes(epString1) || text.includes(epString2)) {
                potentialLinks.push(href);
              } else if (season === 1 && (text.includes(`Episodio ${episode}`) || text.includes(`Ep. ${episode}`))) {
                potentialLinks.push(href);
              } else {
              }
            }
            if (potentialLinks.length > 0) {
              console.log(`[EuroStreaming] Found ${potentialLinks.length} direct links for episode.`);
              for (const link of potentialLinks) {
              }
            }
            const scanWindow = html.substring(searchIndex, searchIndex + 2e3);
            console.log(`[EuroStreaming] Scan window content (first 200 chars): ${scanWindow.substring(0, 200)}...`);
            const providerPatterns = [
              /delta-bit\.net\/embed\/[^"']+/i,
              /deltabit\.co\/embed\/[^"']+/i,
              /uqload\.(?:com|io|co)\/embed-[^"']+/i,
              /mixdrop\.(?:co|to|ch)\/e\/[^"']+/i,
              /swzz\.(?:co|to|ch)\/e\/[^"']+/i,
              /dropload\.(?:io|pro|co)\/e\/[^"']+/i,
              /dropload\.(?:io|pro|co)\/[^"']+/i,
              /supervideo\.(?:tv|cc)\/e\/[^"']+/i,
              /supervideo\.(?:tv|cc)\/[^"']+/i,
              /upstream\.(?:to|co)\/embed-[^"']+/i,
              /upstream\.(?:to|co)\/[^"']+/i,
              /vidoza\.net\/embed-[^"']+/i
            ];
            const goToPlayerMatches = scanWindow.matchAll(/go_to_player\(['"]([^'"]+)['"]\)/g);
            for (const m of goToPlayerMatches) {
              potentialLinks.push(m[1]);
            }
            const linkMatches = scanWindow.matchAll(/(?:href|data-link)=["'](https?:\/\/[^"']+)["']/g);
            for (const m of linkMatches) {
              const url = m[1];
              if (providerPatterns.some((p) => p.test(url)) || url.includes("dropload") || url.includes("supervideo") || url.includes("upstream") || url.includes("mixdrop") || url.includes("delta") || url.includes("uqload")) {
                potentialLinks.push(url);
              }
            }
            console.log(`[EuroStreaming] Found ${potentialLinks.length} potential stream links.`);
            const uniqueLinks = [...new Set(potentialLinks)];
            for (const link of uniqueLinks) {
              try {
                let streamUrl = link;
                if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
                const displaySeason = mappedSeason || season;
                const displayEpisode = mappedEpisode || episode;
                const displayName = `${cleanTitle} ${displaySeason}x${displayEpisode}`;
                if (streamUrl.includes("mixdrop") || streamUrl.includes("m1xdrop")) {
                  const extracted = yield extractMixDrop(streamUrl);
                  if (extracted && extracted.url) {
                    let quality = "HD";
                    const lowerUrl = extracted.url.toLowerCase();
                    if (lowerUrl.includes("4k") || lowerUrl.includes("2160")) quality = "4K";
                    else if (lowerUrl.includes("1080") || lowerUrl.includes("fhd")) quality = "1080p";
                    else if (lowerUrl.includes("720") || lowerUrl.includes("hd")) quality = "720p";
                    else if (lowerUrl.includes("480") || lowerUrl.includes("sd")) quality = "480p";
                    else if (lowerUrl.includes("360")) quality = "360p";
                    const normalizedQuality = getQualityFromName(quality);
                    streams.push({
                      name: `EuroStreaming - MixDrop`,
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
                    const lowerUrl = extracted.url.toLowerCase();
                    if (lowerUrl.includes("1080") || lowerUrl.includes("fhd")) quality = "1080p";
                    else if (lowerUrl.includes("720") || lowerUrl.includes("hd")) quality = "720p";
                    else if (lowerUrl.includes("480") || lowerUrl.includes("sd")) quality = "480p";
                    else if (lowerUrl.includes("360")) quality = "360p";
                    const normalizedQuality = getQualityFromName(quality);
                    streams.push({
                      name: `EuroStreaming - DropLoad`,
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
                    const lowerUrl = extracted.toLowerCase();
                    if (lowerUrl.includes("4k") || lowerUrl.includes("2160")) quality = "4K";
                    else if (lowerUrl.includes("1080") || lowerUrl.includes("fhd")) quality = "1080p";
                    else if (lowerUrl.includes("720") || lowerUrl.includes("hd")) quality = "720p";
                    else if (lowerUrl.includes("480") || lowerUrl.includes("sd")) quality = "480p";
                    else if (lowerUrl.includes("360")) quality = "360p";
                    const normalizedQuality = getQualityFromName(quality);
                    streams.push({
                      name: `EuroStreaming - SuperVideo`,
                      title: displayName,
                      url: extracted,
                      quality: normalizedQuality,
                      type: "direct"
                    });
                  }
                } else if (streamUrl.includes("delta-bit") || streamUrl.includes("deltabit")) {
                  const extracted = yield extractDeltaBit(streamUrl);
                  if (extracted) {
                    let quality = "HD";
                    const lowerUrl = extracted.toLowerCase();
                    if (lowerUrl.includes("4k") || lowerUrl.includes("2160")) quality = "4K";
                    else if (lowerUrl.includes("1080") || lowerUrl.includes("fhd")) quality = "1080p";
                    else if (lowerUrl.includes("720") || lowerUrl.includes("hd")) quality = "720p";
                    else if (lowerUrl.includes("480") || lowerUrl.includes("sd")) quality = "480p";
                    else if (lowerUrl.includes("360")) quality = "360p";
                    const normalizedQuality = getQualityFromName(quality);
                    streams.push({
                      name: `EuroStreaming - DeltaBit`,
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
                    const lowerUrl = extracted.toLowerCase();
                    if (lowerUrl.includes("4k") || lowerUrl.includes("2160")) quality = "4K";
                    else if (lowerUrl.includes("1080") || lowerUrl.includes("fhd")) quality = "1080p";
                    else if (lowerUrl.includes("720") || lowerUrl.includes("hd")) quality = "720p";
                    else if (lowerUrl.includes("480") || lowerUrl.includes("sd")) quality = "480p";
                    else if (lowerUrl.includes("360")) quality = "360p";
                    const normalizedQuality = getQualityFromName(quality);
                    streams.push({
                      name: `EuroStreaming - Vidoza`,
                      title: displayName,
                      url: extracted,
                      quality: normalizedQuality,
                      type: "direct"
                    });
                  }
                } else if (streamUrl.includes("uqload")) {
                  const extracted = yield extractUqload(streamUrl);
                  if (extracted) {
                    streams.push({
                      url: extracted,
                      name: "EuroStreaming - Uqload",
                      title: displayName,
                      quality: "SD",
                      type: "direct"
                    });
                  }
                } else if (streamUrl.includes("upstream")) {
                  const extracted = yield extractUpstream(streamUrl);
                  if (extracted && extracted.url) {
                    streams.push({
                      url: extracted.url,
                      name: "EuroStreaming - Upstream",
                      title: displayName,
                      quality: "HD",
                      type: "direct"
                    });
                  }
                } else if (streamUrl.includes("streamtape")) {
                  const extracted = yield extractStreamTape(streamUrl);
                  if (extracted && extracted.url) {
                    streams.push({
                      url: extracted.url,
                      name: "EuroStreaming - StreamTape",
                      title: displayName,
                      quality: "HD",
                      type: "direct"
                    });
                  }
                }
              } catch (e) {
                console.error(`[EuroStreaming] Link processing error:`, e);
              }
            }
          } catch (e) {
            console.error(`[EuroStreaming] Error checking candidate ${candidate.url}:`, e);
          }
        }));
      }
      yield Promise.all(promises.map((p) => p()));
      return streams.map((s) => formatStream(s, "EuroStreaming")).filter((s) => s !== null);
    } catch (error) {
      console.error("[EuroStreaming] Error:", error);
      return [];
    }
  });
}
module.exports = { getStreams };
