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
    var USER_AGENT2 = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    function getProxiedUrl(url) {
      const proxyUrl = process.env.CF_PROXY_URL;
      if (proxyUrl && url) {
        const separator = proxyUrl.includes("?") ? "&" : "?";
        return `${proxyUrl}${separator}url=${encodeURIComponent(url)}`;
      }
      return url;
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
    module2.exports = {
      USER_AGENT: USER_AGENT2,
      unPack,
      getProxiedUrl
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
          const packedRegex = /eval\(function\(p,a,c,k,e,d\)\s*\{.*?\}\s*\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\),(\d+),(\{\})\)\)/;
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
          const regex = /eval\(function\(p,a,c,k,e,d\)\s*\{.*?\}\s*\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
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
              return {
                url: streamUrl,
                headers: {
                  "User-Agent": USER_AGENT2,
                  "Referer": url,
                  "Origin": new URL(url).origin
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
    var { USER_AGENT: USER_AGENT2, unPack, getProxiedUrl } = require_common();
    function extractSuperVideo(url, refererBase = null) {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          const id = url.split("/").pop();
          const embedUrl = `https://supervideo.tv/e/${id}`;
          if (!refererBase) refererBase = "https://guardahd.stream/";
          const proxiedUrl = getProxiedUrl(embedUrl);
          let response = yield fetch(proxiedUrl, {
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
          const packedRegex = /eval\(function\(p,a,c,k,e,d\)\s*\{.*?\}\s*\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
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

// src/quality_helper.js
var require_quality_helper = __commonJS({
  "src/quality_helper.js"(exports2, module2) {
    var USER_AGENT2 = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
    function checkQualityFromPlaylist2(_0) {
      return __async(this, arguments, function* (url, headers = {}) {
        try {
          if (!url.includes(".m3u8")) return null;
          const finalHeaders = __spreadValues({}, headers);
          if (!finalHeaders["User-Agent"]) {
            finalHeaders["User-Agent"] = USER_AGENT2;
          }
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3e3);
          const response = yield fetch(url, {
            headers: finalHeaders,
            signal: controller.signal
          });
          clearTimeout(timeout);
          if (!response.ok) return null;
          const text = yield response.text();
          const quality = checkQualityFromText(text);
          if (quality) console.log(`[QualityHelper] Detected ${quality} from playlist: ${url}`);
          return quality;
        } catch (e) {
          return null;
        }
      });
    }
    function checkQualityFromText(text) {
      if (!text) return null;
      if (/RESOLUTION=\d+x2160/i.test(text) || /RESOLUTION=2160/i.test(text)) return "4K";
      if (/RESOLUTION=\d+x1440/i.test(text) || /RESOLUTION=1440/i.test(text)) return "1440p";
      if (/RESOLUTION=\d+x1080/i.test(text) || /RESOLUTION=1080/i.test(text)) return "1080p";
      if (/RESOLUTION=\d+x720/i.test(text) || /RESOLUTION=720/i.test(text)) return "720p";
      if (/RESOLUTION=\d+x480/i.test(text) || /RESOLUTION=480/i.test(text)) return "480p";
      return null;
    }
    function getQualityFromUrl(url) {
      if (!url) return null;
      const urlPath = url.split("?")[0].toLowerCase();
      if (urlPath.includes("4k") || urlPath.includes("2160")) return "4K";
      if (urlPath.includes("1440") || urlPath.includes("2k")) return "1440p";
      if (urlPath.includes("1080") || urlPath.includes("fhd")) return "1080p";
      if (urlPath.includes("720") || urlPath.includes("hd")) return "720p";
      if (urlPath.includes("480") || urlPath.includes("sd")) return "480p";
      if (urlPath.includes("360")) return "360p";
      return null;
    }
    module2.exports = { checkQualityFromPlaylist: checkQualityFromPlaylist2, getQualityFromUrl, checkQualityFromText };
  }
});

// src/extractors/vixcloud.js
var require_vixcloud = __commonJS({
  "src/extractors/vixcloud.js"(exports2, module2) {
    var { USER_AGENT: USER_AGENT2 } = require_common();
    var { checkQualityFromPlaylist: checkQualityFromPlaylist2 } = require_quality_helper();
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
            let quality = "Auto";
            const detectedQuality = yield checkQualityFromPlaylist2(finalUrl, {
              "User-Agent": USER_AGENT2,
              "Referer": "https://vixcloud.co/"
            });
            if (detectedQuality) quality = detectedQuality;
            streams.push({
              url: finalUrl,
              quality,
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

// src/extractors/loadm.js
var require_loadm = __commonJS({
  "src/extractors/loadm.js"(exports2, module2) {
    var CryptoJS = require("crypto-js");
    var { USER_AGENT: USER_AGENT2 } = require_common();
    function extractLoadm(playerUrl, referer = "guardoserie.horse") {
      return __async(this, null, function* () {
        try {
          if (!playerUrl.includes("#")) return [];
          const parts = playerUrl.split("#");
          const baseUrl = parts[0];
          const id = parts[1];
          const apiUrl = `${baseUrl}api/v1/video`;
          const key = CryptoJS.enc.Utf8.parse("kiemtienmua911ca");
          const iv = CryptoJS.enc.Utf8.parse("1234567890oiuytr");
          const params = new URLSearchParams({
            id,
            w: "2560",
            h: "1440",
            r: referer
          });
          const response = yield fetch(`${apiUrl}?${params.toString()}`, {
            headers: {
              "User-Agent": USER_AGENT2,
              "Referer": baseUrl,
              "X-Requested-With": "XMLHttpRequest"
            }
          });
          if (!response.ok) {
            console.error(`[Loadm] API error: ${response.status}`);
            return [];
          }
          const hexData = yield response.text();
          const ciphertext = CryptoJS.enc.Hex.parse(hexData);
          const decrypted = CryptoJS.AES.decrypt(
            { ciphertext },
            key,
            {
              iv,
              mode: CryptoJS.mode.CBC,
              padding: CryptoJS.pad.Pkcs7
            }
          );
          const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8).trim();
          if (!decryptedStr) {
            console.error(`[Loadm] Decryption failed`);
            return [];
          }
          const lastBraceIndex = decryptedStr.lastIndexOf("}");
          const cleanJson = lastBraceIndex !== -1 ? decryptedStr.substring(0, lastBraceIndex + 1) : decryptedStr;
          const data = JSON.parse(cleanJson);
          const streams = [];
          if (data.cf) {
            let streamUrl = data.cf;
            if (streamUrl.includes(".txt")) {
              streamUrl += "#index.m3u8";
            }
            streams.push({
              name: "Loadm (Player 1)",
              url: streamUrl,
              title: data.title || "HLS",
              headers: {
                "Referer": baseUrl
              },
              behaviorHints: {
                proxyHeaders: {
                  request: {
                    "Referer": baseUrl
                  }
                },
                notWebReady: true
              }
            });
          }
          if (data.source) {
            streams.push({
              name: "Loadm (Player 2)",
              url: data.source,
              title: data.title || "M3U8",
              headers: {
                "Referer": baseUrl
              },
              behaviorHints: {
                proxyHeaders: {
                  request: {
                    "Referer": baseUrl
                  }
                },
                notWebReady: true
              }
            });
          }
          return streams;
        } catch (e) {
          console.error(`[Loadm] Extraction error:`, e);
          return [];
        }
      });
    }
    module2.exports = { extractLoadm };
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
    var { extractLoadm } = require_loadm();
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
      extractLoadm,
      USER_AGENT: USER_AGENT2,
      unPack
    };
  }
});

// src/fetch_helper.js
var require_fetch_helper = __commonJS({
  "src/fetch_helper.js"(exports2, module2) {
    var FETCH_TIMEOUT = 3e4;
    var originalFetch = global.fetch;
    if (!originalFetch) {
      try {
        const nodeFetch = require("node-fetch");
        originalFetch = nodeFetch;
        global.fetch = nodeFetch;
        global.Headers = nodeFetch.Headers;
        global.Request = nodeFetch.Request;
        global.Response = nodeFetch.Response;
      } catch (e) {
        console.warn("No fetch implementation found and node-fetch is not available!");
      }
    }
    var fetchWithTimeout = function(_0) {
      return __async(this, arguments, function* (url, options = {}) {
        if (options.signal) {
          return originalFetch(url, options);
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, options.timeout || FETCH_TIMEOUT);
        try {
          const response = yield originalFetch(url, __spreadProps(__spreadValues({}, options), {
            signal: controller.signal
          }));
          return response;
        } catch (error) {
          if (error.name === "AbortError") {
            throw new Error(`Request to ${url} timed out after ${options.timeout || FETCH_TIMEOUT}ms`);
          }
          throw error;
        } finally {
          clearTimeout(timeoutId);
        }
      });
    };
    global.fetch = fetchWithTimeout;
    module2.exports = { fetchWithTimeout };
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
    function getSeasonEpisodeFromAbsolute(tmdbId, absoluteEpisode) {
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
    function isAnime2(metadata) {
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
    module2.exports = { getTmdbFromKitsu: getTmdbFromKitsu2, getSeasonEpisodeFromAbsolute, isAnime: isAnime2 };
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
      const behaviorHints = stream.behaviorHints || {};
      let finalHeaders = stream.headers;
      if (behaviorHints.proxyHeaders && behaviorHints.proxyHeaders.request) {
        finalHeaders = behaviorHints.proxyHeaders.request;
      } else if (behaviorHints.headers) {
        finalHeaders = behaviorHints.headers;
      }
      if (finalHeaders) {
        behaviorHints.proxyHeaders = behaviorHints.proxyHeaders || {};
        behaviorHints.proxyHeaders.request = finalHeaders;
        behaviorHints.headers = finalHeaders;
        behaviorHints.notWebReady = true;
      }
      return __spreadProps(__spreadValues({}, stream), {
        // Keep original properties
        name: finalName,
        title: titleText,
        // Ensure language is set for Stremio/Nuvio sorting
        language,
        // Mark as formatted
        _nuvio_formatted: true,
        behaviorHints,
        // Explicitly ensure root headers are preserved for Nuvio
        headers: finalHeaders
      });
    }
    module2.exports = { formatStream: formatStream2 };
  }
});

// src/animeunity/index.js
var { extractVixCloud } = require_extractors();
require_fetch_helper();
var { getTmdbFromKitsu, isAnime } = require_tmdb_helper();
var { formatStream } = require_formatter();
var { checkQualityFromPlaylist } = require_quality_helper();
var BASE_URL = "https://www.animeunity.so";
var TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
var USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
function getMetadata(id, type) {
  return __async(this, null, function* () {
    try {
      const normalizedType = String(type).toLowerCase();
      let tmdbId = id;
      let mappedSeason = null;
      if (String(id).startsWith("kitsu:")) {
        const resolved = yield getTmdbFromKitsu(id);
        if (resolved && resolved.tmdbId) {
          tmdbId = resolved.tmdbId;
          mappedSeason = resolved.season;
          console.log(`[AnimeUnity] Resolved Kitsu ID ${id} to TMDB ID ${tmdbId} (Mapped Season: ${mappedSeason})`);
        } else {
          console.error(`[AnimeUnity] Failed to resolve Kitsu ID ${id}`);
          return null;
        }
      }
      if (String(id).startsWith("tmdb:")) {
        tmdbId = String(id).replace("tmdb:", "");
      }
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
      let alternatives = [];
      try {
        const endpoint2 = normalizedType === "movie" ? "movie" : "tv";
        const altUrl = `https://api.themoviedb.org/3/${endpoint2}/${tmdbId}/alternative_titles?api_key=${TMDB_API_KEY}`;
        const altResponse = yield fetch(altUrl);
        if (altResponse.ok) {
          const altData = yield altResponse.json();
          alternatives = altData.titles || altData.results || [];
        }
      } catch (e) {
        console.error("[AnimeUnity] Alt titles fetch error:", e);
      }
      return __spreadProps(__spreadValues({}, yield response.json()), {
        alternatives,
        mappedSeason
      });
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
  const currentSeason = metadata.seasons.find((s) => s.season_number === season);
  if (currentSeason && episode > currentSeason.episode_count) {
    return episode;
  }
  let absoluteEpisode = parseInt(episode);
  for (const s of metadata.seasons) {
    if (s.season_number > 0 && s.season_number < season) {
      absoluteEpisode += s.episode_count;
    }
  }
  return absoluteEpisode;
}
var checkSimilarity = (candTitle, targetTitle) => {
  if (!targetTitle) return false;
  const normalize = (s) => String(s).toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const t1 = normalize(candTitle);
  const t2 = normalize(targetTitle);
  if (t1.length < 2 || t2.length < 2) return false;
  if (t1.includes(t2) || t2.includes(t1)) return true;
  const w1 = t1.split(/\s+/).filter((w) => w.length > 2);
  const w2 = t2.split(/\s+/).filter((w) => w.length > 2);
  if (w1.length === 0 || w2.length === 0) return false;
  let matches = 0;
  for (const w of w2) {
    if (w1.includes(w)) matches++;
  }
  const score = matches / w2.length;
  return score >= 0.5;
};
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
    const tClean = t.replace(/\s*\(ita\)$/i, "").trim();
    const teClean = te.replace(/\s*\(ita\)$/i, "").trim();
    return t === normTitle || te === normTitle || tClean === normTitle || teClean === normTitle || normOriginal && (t === normOriginal || te === normOriginal || tClean === normOriginal || teClean === normOriginal);
  });
  const metaYear = metadata.first_air_date ? parseInt(metadata.first_air_date.substring(0, 4)) : metadata.release_date ? parseInt(metadata.release_date.substring(0, 4)) : null;
  if (metaYear && (season === 1 || !isTv)) {
    const yearFiltered = filteredCandidates.filter((c) => {
      if (!c.date || c.date === "Indeterminato" || c.date === "?") {
        console.log(`[AnimeUnity] Filtered out "${c.title}" (Date: ${c.date})`);
        return false;
      }
      const match = c.date.match(/(\d{4})/);
      if (match) {
        const cYear = parseInt(match[1]);
        const diff = Math.abs(cYear - metaYear);
        const keep = diff <= 2;
        if (!keep) console.log(`[AnimeUnity] Filtered out "${c.title}" (${cYear}) vs Meta (${metaYear})`);
        return keep;
      }
      return false;
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
      if (specialTitleMatch) {
        if (checkSimilarity(specialTitleMatch.title, title) || checkSimilarity(specialTitleMatch.title_eng, title) || (checkSimilarity(specialTitleMatch.title, originalTitle) || checkSimilarity(specialTitleMatch.title_eng, originalTitle))) {
          return specialTitleMatch;
        }
      }
      const firstSpecial = specialCandidates[0];
      if (checkSimilarity(firstSpecial.title, title) || checkSimilarity(firstSpecial.title_eng, title) || (checkSimilarity(firstSpecial.title, originalTitle) || checkSimilarity(firstSpecial.title_eng, originalTitle))) {
        return firstSpecial;
      }
    }
    const titleMatch = filteredCandidates.find((c) => (c.title || "").includes("Special") || (c.title_eng || "").includes("Special"));
    if (titleMatch) {
      if (checkSimilarity(titleMatch.title, title) || checkSimilarity(titleMatch.title_eng, title) || (checkSimilarity(titleMatch.title, originalTitle) || checkSimilarity(titleMatch.title_eng, originalTitle))) {
        return titleMatch;
      }
    }
    const anyMatch = filteredCandidates.find((c) => checkSimilarity(c.title, title) || checkSimilarity(c.title_eng, title) || (checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title_eng, originalTitle)));
    if (anyMatch) return anyMatch;
    console.log("[AnimeUnity] No season 0 match found passing similarity check");
    return null;
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
    const clean = (str) => str.replace(/\b(film|movie|the|and|or|of|in|on|at|to|a|an)\b/gi, "").replace(/[^a-z0-9\s]/gi, "").replace(/\s+/g, " ").trim();
    const normClean = clean(normTitle);
    if (normClean.length > 3) {
      const words = normClean.split(" ");
      let bestCandidate = null;
      let maxMatches = 0;
      for (const c of filteredCandidates) {
        const cTitle = (c.title || "").toLowerCase();
        const cClean = clean(cTitle);
        const cWords = cClean.split(" ");
        let matches = 0;
        for (const w of words) {
          if (cWords.includes(w) || cTitle.includes(w)) matches++;
        }
        if (matches > maxMatches) {
          maxMatches = matches;
          bestCandidate = c;
        }
      }
      if (bestCandidate && maxMatches >= words.length * 0.75) {
        return bestCandidate;
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
    const baseMatch = filteredCandidates.find((c) => {
      const t = (c.title || "").toLowerCase().trim();
      const te = (c.title_eng || "").toLowerCase().trim();
      const tClean = t.replace(/\s*\(ita\)$/i, "").trim();
      const teClean = te.replace(/\s*\(ita\)$/i, "").trim();
      return t === normTitle || te === normTitle || tClean === normTitle || teClean === normTitle || normOriginal && (t === normOriginal || te === normOriginal || tClean === normOriginal || teClean === normOriginal);
    });
    if (baseMatch) {
      console.log(`[AnimeUnity] Found base title match for Season ${season}: ${baseMatch.title || baseMatch.title_eng}`);
      return baseMatch;
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
      if (hasNumberSuffix(t) || hasNumberSuffix(te)) return false;
      if (checkSimilarity(c.title, title) || checkSimilarity(c.title_eng, title) || (checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title_eng, originalTitle))) return true;
      if (metadata.alternatives) {
        return metadata.alternatives.some((alt) => checkSimilarity(c.title, alt.title) || checkSimilarity(c.title_eng, alt.title));
      }
      return false;
    });
    if (noNumberMatch) return noNumberMatch;
    const anyMatch = sorted.find((c) => {
      if (checkSimilarity(c.title, title) || checkSimilarity(c.title_eng, title) || (checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title_eng, originalTitle))) return true;
      if (metadata.alternatives) {
        return metadata.alternatives.some((alt) => checkSimilarity(c.title, alt.title) || checkSimilarity(c.title_eng, alt.title));
      }
      return false;
    });
    if (anyMatch) return anyMatch;
  }
  return null;
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
function fetchAnimeYear(id, slug) {
  return __async(this, null, function* () {
    if (!id || !slug) return null;
    try {
      const url = `${BASE_URL}/anime/${id}-${slug}`;
      const response = yield fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": BASE_URL
        }
      });
      if (!response.ok) return null;
      const html = yield response.text();
      const dateMatch = /<strong>Anno<\/strong>[\s\S]*?<small>(\d{4})<\/small>/i.exec(html);
      if (dateMatch) {
        return dateMatch[1];
      }
      return null;
    } catch (e) {
      console.error("[AnimeUnity] Detail fetch error:", e);
      return null;
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
      if (!isAnime(metadata)) {
        console.log(`[AnimeUnity] Skipped ${metadata.title} (Not an anime)`);
        return [];
      }
      if (metadata.mappedSeason) {
        console.log(`[AnimeUnity] Kitsu mapping indicates Season ${metadata.mappedSeason}. Overriding requested Season ${season}`);
        season = metadata.mappedSeason;
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
        if (candidates.length === 0 && title.includes("-")) {
          const dehyphenated = title.replace(/-/g, " ").replace(/\s+/g, " ").trim();
          if (dehyphenated !== title) {
            console.log(`[AnimeUnity] Dehyphenated search: ${dehyphenated}`);
            candidates = yield searchAnime(dehyphenated);
          }
        }
        if (candidates.length === 0 && isMovie) {
          if (title.includes(" - ")) {
            const colonTitle = title.replace(" - ", ": ");
            console.log(`[AnimeUnity] Colon search: ${colonTitle}`);
            const colonRes = yield searchAnime(colonTitle);
            if (colonRes && colonRes.length > 0) candidates = candidates.concat(colonRes);
          }
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
            const simpleTitle = title.replace(/\bfilm\b/gi, "").replace(/-/g, "").replace(/\s+/g, " ").trim();
            if (simpleTitle !== title && simpleTitle.length > 3) {
              console.log(`[AnimeUnity] Simplified title search: ${simpleTitle}`);
              const simpleRes = yield searchAnime(simpleTitle);
              if (simpleRes && simpleRes.length > 0) candidates = candidates.concat(simpleRes);
            }
          }
          candidates = candidates.filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i);
        }
      }
      if ((!candidates || candidates.length === 0) && originalTitle && originalTitle !== title) {
        console.log(`[AnimeUnity] No results for ${title}, trying ${originalTitle}`);
        candidates = yield searchAnime(originalTitle);
        if (candidates.length > 0) {
          const valid = candidates.some((c) => {
            if (checkSimilarity(c.title, title) || checkSimilarity(c.title_eng, title) || (checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title_eng, originalTitle))) return true;
            if (metadata.alternatives) {
              return metadata.alternatives.some((alt) => checkSimilarity(c.title, alt.title) || checkSimilarity(c.title_eng, alt.title));
            }
            return false;
          });
          if (!valid) {
            console.log("[AnimeUnity] Original title search results seem irrelevant. Discarding.");
            candidates = [];
          }
        }
      }
      if ((!candidates || candidates.length === 0) && metadata.alternatives) {
        const altTitles = metadata.alternatives.map((t) => t.title).filter((t) => /^[a-zA-Z0-9\s\-\.\:\(\)]+$/.test(t)).filter((t) => t !== title && t !== originalTitle);
        const uniqueAlts = [...new Set(altTitles)];
        for (const altTitle of uniqueAlts) {
          if (altTitle.length < 4) continue;
          console.log(`[AnimeUnity] Trying alternative title: ${altTitle}`);
          const res = yield searchAnime(altTitle);
          if (res && res.length > 0) {
            const valid = res.some((c) => {
              if (checkSimilarity(c.title, title) || checkSimilarity(c.title_eng, title) || (checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title_eng, originalTitle))) return true;
              if (metadata.alternatives) {
                return metadata.alternatives.some((alt) => checkSimilarity(c.title, alt.title) || checkSimilarity(c.title_eng, alt.title));
              }
              return false;
            });
            if (valid) {
              candidates = res;
              break;
            }
          }
        }
      }
      if (!candidates || candidates.length === 0) {
        console.log("[AnimeUnity] No anime found");
        return [];
      }
      const subs = candidates.filter((c) => !(c.title || "").includes("(ITA)") && !(c.title_eng || "").includes("(ITA)"));
      const dubs = candidates.filter((c) => (c.title || "").includes("(ITA)") || (c.title_eng || "").includes("(ITA)"));
      const enrichTopCandidates = (list) => __async(null, null, function* () {
        const top = list.slice(0, 3);
        yield Promise.all(top.map((c) => __async(null, null, function* () {
          if (!c.date || c.date === "Indeterminato" || c.date === "?") {
            console.log(`[AnimeUnity] Fetching year for "${c.title}" (Date: ${c.date})`);
            const year = yield fetchAnimeYear(c.id, c.slug);
            if (year) {
              c.date = year;
              console.log(`[AnimeUnity] Enriched "${c.title}" with year: ${year}`);
            } else {
              console.log(`[AnimeUnity] Failed to enrich "${c.title}" (no year found)`);
            }
          }
        })));
        return top;
      });
      if (subs.length > 0) yield enrichTopCandidates(subs);
      if (dubs.length > 0) yield enrichTopCandidates(dubs);
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
        if (title.includes("-")) {
          const dehyphenated = title.replace(/-/g, " ").replace(/\s+/g, " ").trim();
          if (dehyphenated !== title) {
            console.log(`[AnimeUnity] No match found. Retrying with dehyphenated title: ${dehyphenated}`);
            const dehyphenRes = yield searchAnime(dehyphenated);
            if (dehyphenRes && dehyphenRes.length > 0) {
              const dhSubs = dehyphenRes.filter((c) => !(c.title || "").includes("(ITA)") && !(c.title_eng || "").includes("(ITA)"));
              const dhDubs = dehyphenRes.filter((c) => (c.title || "").includes("(ITA)") || (c.title_eng || "").includes("(ITA)"));
              if (dhSubs.length > 0) yield enrichTopCandidates(dhSubs);
              if (dhDubs.length > 0) yield enrichTopCandidates(dhDubs);
              bestSub = findBestMatch(dhSubs, title, originalTitle, season, metadata);
              bestDub = findBestMatch(dhDubs, title, originalTitle, season, metadata);
            }
          }
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
        tasks.push(getEpisodeStreams(bestSub, epToUse, "SUB ITA", isMovie));
      }
      if (bestDub) {
        console.log(`[AnimeUnity] Found DUB match: ${bestDub.title || bestDub.title_eng} (ID: ${bestDub.id})`);
        const isSeasonEntry = season === 1 || seasonNameMatch || /season|stagione|part|parte|\b\d+\b/i.test(bestDub.title || "") || /season|stagione|part|parte|\b\d+\b/i.test(bestDub.title_eng || "");
        const epToUse = isSeasonEntry ? episode : absEpisode;
        console.log(`[AnimeUnity] Using episode ${epToUse} for DUB (Is Season Entry: ${isSeasonEntry})`);
        tasks.push(getEpisodeStreams(bestDub, epToUse, "ITA", isMovie));
      }
      const results = yield Promise.all(tasks);
      return results.flat();
    } catch (e) {
      console.error("[AnimeUnity] Error:", e);
      return [];
    }
  });
}
function getEpisodeStreams(anime, episodeNumber, langTag = "", isMovie = false) {
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
      let targetEpisode;
      if (isMovie && episodes.length > 0) {
        targetEpisode = episodes[0];
      } else {
        targetEpisode = episodes.find((ep) => ep.number == episodeNumber);
      }
      if (!targetEpisode && !isMovie && totalEpisodes > episodes.length) {
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
        const blockedDomains = ["jujutsukaisenanime.com", "onepunchman.it", "dragonballhd.it", "narutolegend.it"];
        const lowerLink = targetEpisode.link.toLowerCase();
        if (lowerLink.endsWith(".mkv.mp4") || blockedDomains.some((d) => lowerLink.includes(d))) {
          console.log(`[AnimeUnity] Skipping unwanted link: ${targetEpisode.link}`);
        } else {
          let quality = extractQuality(targetEpisode.link);
          if (quality === "Unknown") quality = extractQuality(targetEpisode.file_name);
          if (targetEpisode.link.includes(".m3u8")) {
            const detected = yield checkQualityFromPlaylist(targetEpisode.link, {
              "User-Agent": USER_AGENT,
              "Referer": BASE_URL
            });
            if (detected) quality = detected;
          }
          const displayTitle = (anime.title || anime.title_eng || "Unknown Title") + ` - Ep ${episodeNumber}${labelSuffix}`;
          streams.push({
            name: "AnimeUnity" + labelSuffix,
            title: displayTitle,
            url: targetEpisode.link,
            quality,
            type: "direct",
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": BASE_URL
            }
          });
        }
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
                const displayTitle = (anime.title || anime.title_eng || "Unknown Title") + ` - Ep ${episodeNumber}${labelSuffix}`;
                streams.push(...vixStreams.map((s) => __spreadProps(__spreadValues({}, s), {
                  name: "AnimeUnity - VixCloud" + labelSuffix,
                  title: displayTitle
                })));
              }
            }
          }
        } catch (e) {
          console.error("[AnimeUnity] VixCloud extraction error:", e);
        }
      }
      return streams.map((s) => formatStream(s, "AnimeUnity")).filter((s) => s !== null);
    } catch (e) {
      console.error(`[AnimeUnity] Error extracting streams for ${anime.title}:`, e);
      return [];
    }
  });
}
module.exports = { getStreams, getMetadata, searchAnime };
