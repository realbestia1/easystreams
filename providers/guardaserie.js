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
    var USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
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
      USER_AGENT,
      unPack
    };
  }
});

// src/extractors/mixdrop.js
var require_mixdrop = __commonJS({
  "src/extractors/mixdrop.js"(exports2, module2) {
    var { USER_AGENT, unPack } = require_common();
    function extractMixDrop2(url, refererBase = "https://m1xdrop.net/") {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT,
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
                  "User-Agent": USER_AGENT,
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
    var { USER_AGENT, unPack } = require_common();
    function extractDropLoad2(url, refererBase = null) {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          if (!refererBase) refererBase = new URL(url).origin + "/";
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT,
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
                  "User-Agent": USER_AGENT,
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
    var { USER_AGENT, unPack } = require_common();
    function extractSuperVideo2(url, refererBase = null) {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          const id = url.split("/").pop();
          const embedUrl = `https://supervideo.tv/e/${id}`;
          if (!refererBase) refererBase = "https://guardahd.stream/";
          let response = yield fetch(embedUrl, {
            headers: {
              "User-Agent": USER_AGENT,
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
    module2.exports = { extractSuperVideo: extractSuperVideo2 };
  }
});

// src/extractors/streamtape.js
var require_streamtape = __commonJS({
  "src/extractors/streamtape.js"(exports2, module2) {
    var { USER_AGENT } = require_common();
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
    var { USER_AGENT } = require_common();
    function extractUqload2(url, refererBase = "https://uqload.io/") {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT,
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
                "User-Agent": USER_AGENT,
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
    var { USER_AGENT, unPack } = require_common();
    function extractUpstream2(url, refererBase = "https://upstream.to/") {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT,
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
                  "User-Agent": USER_AGENT,
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
    var { USER_AGENT } = require_common();
    function extractVixCloud(url) {
      return __async(this, null, function* () {
        try {
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT,
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
                "User-Agent": USER_AGENT,
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
                "User-Agent": USER_AGENT,
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
    var { USER_AGENT, unPack } = require_common();
    function extractDeltaBit(url) {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT
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
            const unpacked = unPack(p, a, c, k, null, {});
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
    module2.exports = { extractDeltaBit };
  }
});

// src/extractors/index.js
var require_extractors = __commonJS({
  "src/extractors/index.js"(exports2, module2) {
    var { extractMixDrop: extractMixDrop2 } = require_mixdrop();
    var { extractDropLoad: extractDropLoad2 } = require_dropload();
    var { extractSuperVideo: extractSuperVideo2 } = require_supervideo();
    var { extractStreamTape } = require_streamtape();
    var { extractUqload: extractUqload2 } = require_uqload();
    var { extractUpstream: extractUpstream2 } = require_upstream();
    var { extractVidoza } = require_vidoza();
    var { extractVixCloud } = require_vixcloud();
    var { extractDeltaBit } = require_deltabit();
    var { USER_AGENT, unPack } = require_common();
    module2.exports = {
      extractMixDrop: extractMixDrop2,
      extractDropLoad: extractDropLoad2,
      extractSuperVideo: extractSuperVideo2,
      extractStreamTape,
      extractUqload: extractUqload2,
      extractUpstream: extractUpstream2,
      extractVidoza,
      extractVixCloud,
      extractDeltaBit,
      USER_AGENT,
      unPack
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

// src/guardaserie/index.js
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
var BASE_URL = "https://guardaserietv.best";
var TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
var { extractMixDrop, extractDropLoad, extractSuperVideo, extractUqload, extractUpstream } = require_extractors();
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
      console.error("[Guardaserie] Conversion error:", e);
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
      console.error("[Guardaserie] TMDB error:", e);
      return null;
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
      console.error("[Guardaserie] ID conversion error:", e);
      return null;
    }
  });
}
function getStreams(id, type, season, episode) {
  if (["movie"].includes(String(type).toLowerCase())) return [];
  return __async2(this, null, function* () {
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
        const resolved = yield getTmdbFromKitsu(id);
        if (resolved && resolved.tmdbId) {
          tmdbId = resolved.tmdbId;
          if (resolved.season) {
            console.log(`[Guardaserie] Kitsu mapping indicates Season ${resolved.season}. Overriding requested Season ${season}`);
            season = resolved.season;
          }
          console.log(`[Guardaserie] Resolved Kitsu ID ${id} to TMDB ID ${tmdbId}, Season ${season}`);
        } else {
          console.log(`[Guardaserie] Could not convert ${id} to TMDB ID`);
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
      let mappedSeason = null;
      let mappedEpisode = null;
      if (season === 1 && episode > 20 && tmdbId) {
        try {
          const mapped = yield getSeasonEpisodeFromAbsolute(tmdbId, episode);
          if (mapped) {
            console.log(`[Guardaserie] Mapped absolute episode ${episode} to Season ${mapped.season}, Episode ${mapped.episode}`);
            mappedSeason = mapped.season;
            mappedEpisode = mapped.episode;
          }
        } catch (e) {
          console.error("[Guardaserie] Error mapping episode:", e);
        }
      }
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
                const otherIds = imdbMatches.filter((m) => m !== targetId);
                if (!hasTarget && otherIds.length > 0) {
                  if (title.includes("One Piece") && candidate.title.includes("All'arrembaggio")) {
                    console.log(`[Guardaserie] Accepting "All'arrembaggio" despite IMDb mismatch (known alias).`);
                  } else {
                    console.log(`[Guardaserie] Rejected ${candidate.url} due to IMDb mismatch. Found: ${otherIds.join(", ")}`);
                    continue;
                  }
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
      const episodeStrPadded = `${season}x${episode.toString().padStart(2, "0")}`;
      let episodeRegex = new RegExp(`data-num="${episodeStr}"`, "i");
      let episodeMatch = episodeRegex.exec(showHtml);
      if (!episodeMatch) {
        episodeRegex = new RegExp(`data-num="${episodeStrPadded}"`, "i");
        episodeMatch = episodeRegex.exec(showHtml);
      }
      if (!episodeMatch && mappedSeason) {
        const mappedStr = `${mappedSeason}x${mappedEpisode}`;
        const mappedStrPadded = `${mappedSeason}x${mappedEpisode.toString().padStart(2, "0")}`;
        episodeRegex = new RegExp(`data-num="${mappedStr}"`, "i");
        episodeMatch = episodeRegex.exec(showHtml);
        if (!episodeMatch) {
          episodeRegex = new RegExp(`data-num="${mappedStrPadded}"`, "i");
          episodeMatch = episodeRegex.exec(showHtml);
        }
        if (episodeMatch) console.log(`[Guardaserie] Found mapped episode ${mappedSeason}x${mappedEpisode}`);
      }
      if (!episodeMatch && season === 1) {
        const textRegex = new RegExp(`${season}x${episode}`, "i");
        if (textRegex.test(showHtml)) {
          console.log(`[Guardaserie] Found text match for ${season}x${episode}, but no data-num. Scanning for links...`);
        }
      }
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
      const streamPromises = links.map((link) => __async2(null, null, function* () {
        try {
          const displaySeason = mappedSeason || season;
          const displayEpisode = mappedEpisode || episode;
          const displayName = `${title} ${displaySeason}x${displayEpisode}`;
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
      return results.filter((r) => r !== null).map((s) => formatStream(s, "Guardaserie")).filter((s) => s !== null);
    } catch (e) {
      console.error("[Guardaserie] Error:", e);
      return [];
    }
  });
}
module.exports = { getStreams };
