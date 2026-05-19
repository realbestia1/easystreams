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
var __objRest = (source, exclude) => {
  var target = {};
  for (var prop in source)
    if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
      target[prop] = source[prop];
  if (source != null && __getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(source)) {
      if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
        target[prop] = source[prop];
    }
  return target;
};
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
      let proxyUrl = null;
      try {
        if (typeof global !== "undefined" && global.CF_PROXY_URL) {
          proxyUrl = global.CF_PROXY_URL;
        }
      } catch (e) {
      }
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
    function isFlareSolverrBlockedError(error) {
      const message = String(error && error.message || error || "");
      return /FlareSolverr in cooldown|Request failed with status code 500|Cloudflare has blocked/i.test(message);
    }
    module2.exports = {
      USER_AGENT: USER_AGENT2,
      unPack,
      getProxiedUrl,
      isFlareSolverrBlockedError
    };
  }
});

// src/extractors/mixdrop.js
var require_mixdrop = __commonJS({
  "src/extractors/mixdrop.js"(exports2, module2) {
    var { USER_AGENT: USER_AGENT2, unPack } = require_common();
    function isMixDropDisabled() {
      const rawEnv = typeof process !== "undefined" && process && process.env && typeof process.env.DISABLE_MIXDROP === "string" ? process.env.DISABLE_MIXDROP.trim().toLowerCase() : "";
      return ["1", "true", "yes", "on"].includes(rawEnv);
    }
    function normalizeUrl(url, baseUrl) {
      try {
        return new URL(String(url || ""), baseUrl).toString();
      } catch (e) {
        return null;
      }
    }
    function extractPackedStream(html) {
      const packedRegex = /eval\(function\(p,a,c,k,e,d\)\s*\{.*?\}\s*\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\),(\d+),(\{\})\)\)/;
      const match = packedRegex.exec(String(html || ""));
      if (!match) return null;
      const p = match[1];
      const a = parseInt(match[2]);
      const c = parseInt(match[3]);
      const k = match[4].split("|");
      const unpacked = unPack(p, a, c, k, null, {});
      const wurlMatch = unpacked.match(/wurl\s*=\s*["']([^"']+)["']/);
      if (!wurlMatch) return null;
      let streamUrl = wurlMatch[1];
      if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
      return streamUrl;
    }
    function extractEmbedUrl(html, pageUrl) {
      const match = String(html || "").match(/<iframe\b[^>]+src=["']([^"']*\/e\/[^"']+)["']/i);
      if (match) return normalizeUrl(match[1], pageUrl);
      const converted = String(pageUrl || "").replace(/\/f\//i, "/e/");
      return converted !== pageUrl ? converted : null;
    }
    function extractMixDrop2(url, refererBase = "https://m1xdrop.net/") {
      return __async(this, null, function* () {
        if (isMixDropDisabled()) return null;
        try {
          if (url.startsWith("//")) url = "https:" + url;
          const fetchHtml = (targetUrl, referer) => __async(null, null, function* () {
            const response = yield fetch(targetUrl, {
              headers: {
                "User-Agent": USER_AGENT2,
                "Referer": referer
              }
            });
            if (!response.ok) return null;
            return {
              url: response.url || targetUrl,
              html: yield response.text()
            };
          });
          let page = yield fetchHtml(url, refererBase);
          if (!page) return null;
          let streamUrl = extractPackedStream(page.html);
          let pageUrl = page.url;
          if (!streamUrl) {
            const embedUrl = extractEmbedUrl(page.html, pageUrl);
            if (embedUrl && embedUrl !== pageUrl) {
              const embedPage = yield fetchHtml(embedUrl, pageUrl);
              if (embedPage) {
                page = embedPage;
                pageUrl = embedPage.url;
                streamUrl = extractPackedStream(embedPage.html);
              }
            }
          }
          if (!streamUrl) return null;
          return {
            url: streamUrl,
            referer: pageUrl,
            userAgent: USER_AGENT2,
            headers: {
              "User-Agent": USER_AGENT2,
              "Referer": pageUrl
            }
          };
        } catch (e) {
          console.error("[Extractors] MixDrop extraction error:", e);
          return null;
        }
      });
    }
    module2.exports = { extractMixDrop: extractMixDrop2 };
  }
});

// src/extractors/streamhg.js
var require_streamhg = __commonJS({
  "src/extractors/streamhg.js"(exports2, module2) {
    var { USER_AGENT: USER_AGENT2, unPack, getProxiedUrl } = require_common();
    function resolveAbsoluteUrl(candidate, baseUrl) {
      if (!candidate) return null;
      try {
        return new URL(candidate, baseUrl).toString();
      } catch (_) {
        return null;
      }
    }
    function getOrigin(url) {
      try {
        return new URL(url).origin;
      } catch (_) {
        return null;
      }
    }
    function getBaseHeaders(referer) {
      const headers = {
        "User-Agent": USER_AGENT2
      };
      if (referer) headers["Referer"] = referer;
      return headers;
    }
    function extractStreamHG2(url, refererBase = null) {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          const initialReferer = refererBase || `${getOrigin(url) || "https://dhcplay.com"}/`;
          const candidates = [url];
          try {
            const parsed = new URL(url);
            const idMatch = parsed.pathname.match(/\/e\/([^/?#]+)/i);
            if (idMatch && /(^|\.)dhcplay\.com$/i.test(parsed.hostname)) {
              candidates.push(`https://vibuxer.com/e/${idMatch[1]}`);
            }
          } catch (_) {
          }
          let finalUrl = null;
          let packedMatch = null;
          for (const candidate of candidates) {
            const response = yield fetch(getProxiedUrl(candidate), {
              headers: getBaseHeaders(initialReferer),
              redirect: "follow"
            });
            if (!response.ok) continue;
            const html = yield response.text();
            const match = html.match(new RegExp("eval\\(function\\(p,a,c,k,e,d\\)\\{.*?\\}\\('(.*?)',(\\d+),(\\d+),'(.*?)'\\.split\\('\\|'\\)", "s"));
            if (!match) continue;
            finalUrl = response.url || candidate;
            packedMatch = match;
            break;
          }
          if (!packedMatch || !finalUrl) return null;
          const p = packedMatch[1];
          const a = parseInt(packedMatch[2], 10);
          const c = parseInt(packedMatch[3], 10);
          const k = packedMatch[4].split("|");
          const unpacked = unPack(p, a, c, k, null, {});
          let streamUrl = null;
          const hls2Match = unpacked.match(/["']hls2["']\s*:\s*["']([^"']+)["']/i);
          const hls4Match = unpacked.match(/["']hls4["']\s*:\s*["']([^"']+)["']/i);
          const fileMatch = unpacked.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i);
          streamUrl = hls2Match && hls2Match[1] || hls4Match && hls4Match[1] || fileMatch && fileMatch[1] || null;
          streamUrl = resolveAbsoluteUrl(streamUrl, finalUrl);
          if (!streamUrl) return null;
          return {
            url: streamUrl
          };
        } catch (e) {
          console.error("[Extractors] StreamHG extraction error:", e);
          return null;
        }
      });
    }
    module2.exports = { extractStreamHG: extractStreamHG2 };
  }
});

// src/fetch_helper.js
var require_fetch_helper = __commonJS({
  "src/fetch_helper.js"(exports2, module2) {
    var FETCH_TIMEOUT = 3e4;
    function createTimeoutSignal(timeoutMs) {
      const parsed = Number.parseInt(String(timeoutMs), 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return { signal: void 0, cleanup: null, timed: false };
      }
      if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
        return { signal: AbortSignal.timeout(parsed), cleanup: null, timed: true };
      }
      if (typeof AbortController !== "undefined" && typeof setTimeout === "function") {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, parsed);
        return {
          signal: controller.signal,
          cleanup: () => clearTimeout(timeoutId),
          timed: true
        };
      }
      return { signal: void 0, cleanup: null, timed: false };
    }
    function fetchWithTimeout(_0) {
      return __async(this, arguments, function* (url, options = {}) {
        if (typeof fetch === "undefined") {
          throw new Error("No fetch implementation found!");
        }
        const _a = options, { timeout } = _a, fetchOptions = __objRest(_a, ["timeout"]);
        const requestTimeout = timeout || FETCH_TIMEOUT;
        const timeoutConfig = createTimeoutSignal(requestTimeout);
        const requestOptions = __spreadValues({}, fetchOptions);
        if (timeoutConfig.signal) {
          if (requestOptions.signal && typeof AbortSignal !== "undefined" && typeof AbortSignal.any === "function") {
            requestOptions.signal = AbortSignal.any([requestOptions.signal, timeoutConfig.signal]);
          } else if (!requestOptions.signal) {
            requestOptions.signal = timeoutConfig.signal;
          }
        }
        try {
          const response = yield fetch(url, requestOptions);
          return response;
        } catch (error) {
          if (error && error.name === "AbortError" && timeoutConfig.timed) {
            throw new Error(`Request to ${url} timed out after ${requestTimeout}ms`);
          }
          throw error;
        } finally {
          if (typeof timeoutConfig.cleanup === "function") {
            timeoutConfig.cleanup();
          }
        }
      });
    }
    module2.exports = { fetchWithTimeout, createTimeoutSignal };
  }
});

// src/formatter.js
var require_formatter = __commonJS({
  "src/formatter.js"(exports2, module2) {
    function normalizePlaybackHeaders(headers) {
      if (!headers || typeof headers !== "object") return headers;
      const normalized = {};
      for (const [key, value] of Object.entries(headers)) {
        if (value == null) continue;
        const lowerKey = String(key).toLowerCase();
        if (lowerKey === "user-agent") normalized["User-Agent"] = value;
        else if (lowerKey === "referer" || lowerKey === "referrer") normalized["Referer"] = value;
        else if (lowerKey === "origin") normalized["Origin"] = value;
        else if (lowerKey === "accept") normalized["Accept"] = value;
        else if (lowerKey === "accept-language") normalized["Accept-Language"] = value;
        else normalized[key] = value;
      }
      return normalized;
    }
    function shouldForceNotWebReadyForPlugin(stream, providerName, headers, behaviorHints) {
      const text = [
        stream == null ? void 0 : stream.url,
        stream == null ? void 0 : stream.name,
        stream == null ? void 0 : stream.title,
        stream == null ? void 0 : stream.server,
        providerName
      ].filter(Boolean).join(" ").toLowerCase();
      if (text.includes("loadm") || text.includes("loadm.cam")) {
        return true;
      }
      return false;
    }
    function normalizeProviderId(providerName) {
      const normalized = String(providerName || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
      return normalized || void 0;
    }
    function formatStream2(stream, providerName) {
      let quality = stream.quality || "";
      if (quality === "2160p") quality = "\u{1F525}4K UHD";
      else if (quality === "1440p") quality = "\u2728 QHD";
      else if (quality === "1080p") quality = "\u{1F680} FHD";
      else if (quality === "720p") quality = "\u{1F4BF} HD";
      else if (quality === "576p" || quality === "480p" || quality === "360p" || quality === "240p") quality = "\u{1F4A9} Low Quality";
      else if (!quality || ["auto", "unknown", "unknow"].includes(String(quality).toLowerCase())) quality = "\u{1F4BF} HD";
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
      const behaviorHints = stream.behaviorHints && typeof stream.behaviorHints === "object" ? __spreadValues({}, stream.behaviorHints) : {};
      let finalHeaders = stream.headers;
      if (behaviorHints.proxyHeaders && behaviorHints.proxyHeaders.request) {
        finalHeaders = behaviorHints.proxyHeaders.request;
      } else if (behaviorHints.headers) {
        finalHeaders = behaviorHints.headers;
      }
      finalHeaders = normalizePlaybackHeaders(finalHeaders);
      const isStreamingCommunityProvider = String(providerName || "").toLowerCase() === "streamingcommunity" || String((stream == null ? void 0 : stream.name) || "").toLowerCase().includes("streamingcommunity");
      if (isStreamingCommunityProvider && !finalHeaders) {
        delete behaviorHints.proxyHeaders;
        delete behaviorHints.headers;
        delete behaviorHints.notWebReady;
      }
      if (finalHeaders) {
        behaviorHints.proxyHeaders = behaviorHints.proxyHeaders || {};
        behaviorHints.proxyHeaders.request = finalHeaders;
        behaviorHints.headers = finalHeaders;
      }
      const shouldForceNotWebReady = shouldForceNotWebReadyForPlugin(stream, providerName, finalHeaders, behaviorHints);
      if (!isStreamingCommunityProvider && shouldForceNotWebReady) {
        behaviorHints.notWebReady = true;
      } else {
        delete behaviorHints.notWebReady;
      }
      const finalName = pName;
      let finalTitle = `\u{1F4C1} ${stream.title || "Stream"}`;
      if (desc) finalTitle += ` | ${desc}`;
      if (language) finalTitle += ` | ${language}`;
      const playbackReferer = stream.referer || (finalHeaders == null ? void 0 : finalHeaders.Referer) || (finalHeaders == null ? void 0 : finalHeaders.referer);
      const playbackUserAgent = stream.userAgent || (finalHeaders == null ? void 0 : finalHeaders["User-Agent"]) || (finalHeaders == null ? void 0 : finalHeaders["user-agent"]);
      return __spreadProps(__spreadValues({}, stream), {
        // Keep original properties
        name: finalName,
        title: finalTitle,
        // Metadata for Stremio UI reconstruction (safer names for RN)
        providerName: pName,
        qualityTag: quality,
        description: desc,
        originalTitle: stream.title || "Stream",
        // Ensure language is set for Stremio/Nuvio sorting
        language,
        // Mark as formatted
        _nuvio_formatted: true,
        behaviorHints,
        provider: stream.provider || normalizeProviderId(providerName),
        referer: playbackReferer,
        userAgent: playbackUserAgent,
        // Explicitly ensure root headers are preserved for Nuvio
        headers: finalHeaders
      });
    }
    module2.exports = { formatStream: formatStream2 };
  }
});

// src/quality_helper.js
var require_quality_helper = __commonJS({
  "src/quality_helper.js"(exports2, module2) {
    var { createTimeoutSignal } = require_fetch_helper();
    var USER_AGENT2 = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
    function checkQualityFromPlaylist2(_0) {
      return __async(this, arguments, function* (url, headers = {}) {
        try {
          if (!url.includes(".m3u8")) return null;
          const finalHeaders = __spreadValues({}, headers);
          if (!finalHeaders["User-Agent"]) {
            finalHeaders["User-Agent"] = USER_AGENT2;
          }
          const timeoutConfig = createTimeoutSignal(3e3);
          try {
            const response = yield fetch(url, {
              headers: finalHeaders,
              signal: timeoutConfig.signal
            });
            if (!response.ok) return null;
            const text = yield response.text();
            const quality = checkQualityFromText(text);
            if (quality) console.log(`[QualityHelper] Detected ${quality} from playlist: ${url}`);
            return quality;
          } finally {
            if (typeof timeoutConfig.cleanup === "function") {
              timeoutConfig.cleanup();
            }
          }
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
    function getQualityFromUrl2(url) {
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
    module2.exports = { checkQualityFromPlaylist: checkQualityFromPlaylist2, getQualityFromUrl: getQualityFromUrl2, checkQualityFromText };
  }
});

// src/guardahd/index.js
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
function getGuardaHdBaseUrl() {
  return "https://guardahd.stream";
}
var TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
var USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
var { extractMixDrop } = require_mixdrop();
var { extractStreamHG } = require_streamhg();
require_fetch_helper();
var { formatStream } = require_formatter();
var { checkQualityFromPlaylist, getQualityFromUrl } = require_quality_helper();
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
  return __async2(this, null, function* () {
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
  if (["series", "tv"].includes(String(type).toLowerCase())) return [];
  return __async2(this, null, function* () {
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
    const title = metadata && (metadata.title || metadata.name || metadata.original_title || metadata.original_name) ? metadata.title || metadata.name || metadata.original_title || metadata.original_name : normalizedType === "movie" ? "Film Sconosciuto" : "Serie TV";
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
      const linksSet = /* @__PURE__ */ new Set();
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
      const processUrl = (streamUrl) => __async(null, null, function* () {
        if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
        try {
          if (streamUrl.includes("mixdrop") || streamUrl.includes("m1xdrop")) {
            console.log(`[GuardaHD] Attempting MixDrop extraction for ${streamUrl}`);
            const extracted = yield extractMixDrop(streamUrl);
            if (extracted && extracted.url) {
              let quality = "HD";
              const playlistQuality = yield checkQualityFromPlaylist(extracted.url, extracted.headers);
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
            const extracted = yield extractStreamHG(streamUrl);
            if (extracted && extracted.url) {
              let quality = getQualityFromUrl(extracted.url) || "HD";
              const playlistQuality = yield checkQualityFromPlaylist(extracted.url, extracted.headers || {});
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
      });
      const uniqueLinks = Array.from(linksSet);
      yield Promise.all(uniqueLinks.map((link) => processUrl(link)));
      const uniqueStreams = [];
      const seenUrls = /* @__PURE__ */ new Set();
      for (const s of streams) {
        if (!seenUrls.has(s.url)) {
          seenUrls.add(s.url);
          uniqueStreams.push(s);
        }
      }
      return uniqueStreams.map((s) => formatStream(s, "GuardaHD")).filter((s) => s !== null);
    } catch (error) {
      console.error("[GuardaHD] Error:", error);
      return [];
    }
  });
}
module.exports = { getStreams };
