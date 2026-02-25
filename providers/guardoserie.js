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
    module2.exports = { extractDropLoad: extractDropLoad2 };
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
    module2.exports = { extractVixCloud };
  }
});

// src/extractors/loadm.js
var require_loadm = __commonJS({
  "src/extractors/loadm.js"(exports2, module2) {
    var CryptoJS = require("crypto-js");
    var { USER_AGENT: USER_AGENT2 } = require_common();
    function extractLoadm2(playerUrl, referer = "guardoserie.horse") {
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
    module2.exports = { extractLoadm: extractLoadm2 };
  }
});

// src/extractors/index.js
var require_extractors = __commonJS({
  "src/extractors/index.js"(exports2, module2) {
    var { extractMixDrop } = require_mixdrop();
    var { extractDropLoad: extractDropLoad2 } = require_dropload();
    var { extractSuperVideo } = require_supervideo();
    var { extractStreamTape } = require_streamtape();
    var { extractUqload: extractUqload2 } = require_uqload();
    var { extractUpstream } = require_upstream();
    var { extractVidoza } = require_vidoza();
    var { extractVixCloud } = require_vixcloud();
    var { extractLoadm: extractLoadm2 } = require_loadm();
    var { USER_AGENT: USER_AGENT2, unPack } = require_common();
    module2.exports = {
      extractMixDrop,
      extractDropLoad: extractDropLoad2,
      extractSuperVideo,
      extractStreamTape,
      extractUqload: extractUqload2,
      extractUpstream,
      extractVidoza,
      extractVixCloud,
      extractLoadm: extractLoadm2,
      USER_AGENT: USER_AGENT2,
      unPack
    };
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
    module2.exports = { getTmdbFromKitsu: getTmdbFromKitsu2, getSeasonEpisodeFromAbsolute, isAnime };
  }
});

// src/guardoserie/index.js
var cheerio = require("cheerio");
var { USER_AGENT } = require_common();
var { extractLoadm, extractUqload, extractDropLoad } = require_extractors();
var { formatStream } = require_formatter();
var { getTmdbFromKitsu } = require_tmdb_helper();
var { checkQualityFromPlaylist } = require_quality_helper();
var BASE_URL = "https://guardoserie.horse";
var TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
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
function getShowInfo(tmdbId, type) {
  return __async(this, null, function* () {
    try {
      const endpoint = type === "movie" ? "movie" : "tv";
      const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=it-IT`;
      const response = yield fetch(url);
      if (!response.ok) return null;
      return yield response.json();
    } catch (e) {
      console.error("[Guardoserie] TMDB error:", e);
      return null;
    }
  });
}
function getStreams(id, type, season, episode) {
  return __async(this, null, function* () {
    var _a, _b;
    try {
      let tmdbId = id;
      if (id.toString().startsWith("tt")) {
        const url = `https://api.themoviedb.org/3/find/${id}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
        const response = yield fetch(url);
        if (response.ok) {
          const data = yield response.json();
          if (type === "movie" && ((_a = data.movie_results) == null ? void 0 : _a.length) > 0) tmdbId = data.movie_results[0].id;
          else if ((type === "series" || type === "tv") && ((_b = data.tv_results) == null ? void 0 : _b.length) > 0) tmdbId = data.tv_results[0].id;
        }
      } else if (id.toString().startsWith("kitsu:")) {
        const resolved = yield getTmdbFromKitsu(id);
        if (resolved && resolved.tmdbId) {
          tmdbId = resolved.tmdbId;
          if (resolved.season) season = resolved.season;
        }
      }
      const showInfo = yield getShowInfo(tmdbId, type === "movie" ? "movie" : "tv");
      if (!showInfo) return [];
      const title = showInfo.name || showInfo.original_name || showInfo.title || showInfo.original_title;
      const originalTitle = showInfo.original_title || showInfo.original_name;
      const year = (showInfo.first_air_date || showInfo.release_date || "").split("-")[0];
      console.log(`[Guardoserie] Searching for: ${title} / ${originalTitle} (${year})`);
      const searchProvider = (query) => __async(null, null, function* () {
        const searchUrl = `${BASE_URL}/wp-admin/admin-ajax.php`;
        const params = new URLSearchParams({
          s: query,
          action: "searchwp_live_search",
          swpengine: "default",
          swpquery: query
        });
        const response = yield fetch(searchUrl, {
          method: "POST",
          headers: {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Origin": BASE_URL,
            "Referer": `${BASE_URL}/`
          },
          body: params.toString()
        });
        if (!response.ok) return [];
        const searchHtml = yield response.text();
        const $ = cheerio.load(searchHtml);
        const results = [];
        $("a.ss-title").each((i, el) => {
          results.push({
            title: $(el).text().trim(),
            url: $(el).attr("href")
          });
        });
        return results;
      });
      let allResults = [];
      const queries = [title, originalTitle].filter((q) => q && q.length > 2);
      for (const q of queries) {
        const res = yield searchProvider(q);
        allResults.push(...res);
      }
      allResults = Array.from(new Map(allResults.map((item) => [item.url, item])).values());
      let targetUrl = null;
      for (const result of allResults) {
        const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "").replace("iltronodispade", "gameofthrones");
        const nTitle = norm(title);
        const nOrig = norm(originalTitle || "");
        const nResult = norm(result.title);
        if (nResult === nTitle || nResult === nOrig || nResult.includes(nTitle) || nOrig && nResult.includes(nOrig)) {
          try {
            const pageRes = yield fetch(result.url, { headers: { "User-Agent": USER_AGENT } });
            if (!pageRes.ok) continue;
            const pageHtml = yield pageRes.text();
            const $page = cheerio.load(pageHtml);
            let foundYear = null;
            const infoBox = $page(".mvic-info");
            const yearLink = infoBox.find('p:contains("pubblicazione") a[href*="release-year"]');
            if (yearLink.length) {
              foundYear = yearLink.text().trim();
            }
            if (!foundYear) {
              const metaDate = $page('meta[content*="20"]').filter((i, el) => {
                const content = $page(el).attr("content");
                return content && /^20\d{2}-\d{2}-\d{2}/.test(content);
              }).first().attr("content");
              if (metaDate) {
                foundYear = metaDate.substring(0, 4);
              }
            }
            if (!foundYear) {
              const globalYearLink = $page('a[href*="release-year"]').filter((i, el) => {
                const isRelated = $page(el).closest(".mlw-related, footer, #footer").length > 0;
                return !isRelated;
              }).first();
              if (globalYearLink.length) {
                foundYear = globalYearLink.text().trim();
              }
            }
            if (foundYear) {
              if (foundYear === year) {
                targetUrl = result.url;
                break;
              }
            } else {
              targetUrl = result.url;
              break;
            }
          } catch (e) {
            targetUrl = result.url;
            break;
          }
        }
      }
      if (!targetUrl) {
        console.log(`[Guardoserie] No matching result found for ${title}`);
        return [];
      }
      let episodeUrl = targetUrl;
      if (type === "tv" || type === "series") {
        const pageRes = yield fetch(targetUrl, { headers: { "User-Agent": USER_AGENT } });
        const pageHtml = yield pageRes.text();
        const $page = cheerio.load(pageHtml);
        const seasonIndex = parseInt(season) - 1;
        const episodeIndex = parseInt(episode) - 1;
        let seasonDiv = $page(".les-content").eq(seasonIndex);
        if (!seasonDiv.length) {
          const seasonBlocks = $page(".tvseason");
          if (seasonBlocks.length > 0) {
            seasonDiv = seasonBlocks.eq(seasonIndex).find(".les-content");
          }
        }
        if (!seasonDiv.length) {
          console.log(`[Guardoserie] Season ${season} not found at ${targetUrl}`);
          return [];
        }
        const episodeA = seasonDiv.find("a").eq(episodeIndex);
        if (!episodeA.length) {
          console.log(`[Guardoserie] Episode ${episode} not found in Season ${season}`);
          return [];
        }
        episodeUrl = episodeA.attr("href");
      }
      console.log(`[Guardoserie] Found episode/movie URL: ${episodeUrl}`);
      const finalRes = yield fetch(episodeUrl, { headers: { "User-Agent": USER_AGENT } });
      const finalHtml = yield finalRes.text();
      const $final = cheerio.load(finalHtml);
      const iframe = $final("iframe");
      const playerLink = iframe.attr("data-src") || iframe.attr("src");
      if (!playerLink) {
        console.log(`[Guardoserie] No player iframe found`);
        return [];
      }
      console.log(`[Guardoserie] Found player link: ${playerLink}`);
      const displayName = type === "tv" || type === "series" ? `${title} ${season}x${episode}` : title;
      let streams = [];
      if (playerLink.includes("loadm")) {
        const domain = new URL(BASE_URL).hostname;
        const extracted = yield extractLoadm(playerLink, domain);
        for (const s of extracted || []) {
          let quality = "HD";
          if (s.url.includes(".m3u8")) {
            const detected = yield checkQualityFromPlaylist(s.url, s.headers || {});
            if (detected) quality = detected;
          }
          const normalizedQuality = getQualityFromName(quality);
          streams.push(formatStream({
            url: s.url,
            headers: s.headers,
            name: `Guardoserie - Loadm`,
            title: displayName,
            quality: normalizedQuality,
            type: "direct",
            behaviorHints: s.behaviorHints
          }, "Guardoserie"));
        }
      } else if (playerLink.includes("uqload")) {
        const extracted = yield extractUqload(playerLink);
        if (extracted && extracted.url) {
          let quality = "HD";
          const normalizedQuality = getQualityFromName(quality);
          streams.push(formatStream({
            url: extracted.url,
            headers: extracted.headers,
            name: `Guardoserie - Uqload`,
            title: displayName,
            quality: normalizedQuality,
            type: "direct"
          }, "Guardoserie"));
        }
      } else if (playerLink.includes("dropload")) {
        const extracted = yield extractDropLoad(playerLink);
        if (extracted && extracted.url) {
          let quality = "HD";
          if (extracted.url.includes(".m3u8")) {
            const detected = yield checkQualityFromPlaylist(extracted.url, extracted.headers || {});
            if (detected) quality = detected;
          }
          const normalizedQuality = getQualityFromName(quality);
          streams.push(formatStream({
            url: extracted.url,
            headers: extracted.headers,
            name: `Guardoserie - DropLoad`,
            title: displayName,
            quality: normalizedQuality,
            type: "direct"
          }, "Guardoserie"));
        }
      }
      return streams;
    } catch (e) {
      console.error(`[Guardoserie] Error:`, e);
      return [];
    }
  });
}
module.exports = { getStreams };
