"use strict";
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
    var USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
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
      USER_AGENT,
      unPack,
      getProxiedUrl,
      isFlareSolverrBlockedError
    };
  }
});

// src/extractors/vidxgo.js
var require_vidxgo = __commonJS({
  "src/extractors/vidxgo.js"(exports2, module2) {
    var { USER_AGENT } = require_common();
    var VIDXGO_HEADERS = {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Sec-GPC": "1",
      "Alt-Used": "v.vidxgo.co",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "iframe",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "DNT": "1",
      "Priority": "u=0, i"
    };
    function xorDecrypt(b64, key) {
      const decoded = Buffer.from(b64, "base64");
      const result = Buffer.alloc(decoded.length);
      for (let i = 0; i < decoded.length; i++) {
        result[i] = decoded[i] ^ key.charCodeAt(i % key.length);
      }
      return result.toString("utf-8");
    }
    var XOR_PATTERN = /var\s+\w+\s*=\s*'([\w]+)'\s*,?\s*d\s*=\s*atob\s*\(\s*'([A-Za-z0-9+/=]+)'\s*\)/g;
    var CURRENT_SRC_PATTERN = /\bcurrentSrc\s*=\s*["'](https?:[^"']+?\.m3u8[^"']*)["']/;
    var CORRUPT_PLAYER_PATTERN = /player-container[^>]*\bcorrupt\b/i;
    function extractVidxGo(url, referer = "https://altadefinizione.you/") {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          const headers = __spreadProps(__spreadValues({}, VIDXGO_HEADERS), { "Referer": referer });
          const resp = yield fetch(url, { headers, redirect: "follow" });
          if (!resp.ok) {
            console.warn("[VidxGo] HTTP", resp.status, "for", url);
            return { url, headers: { "User-Agent": USER_AGENT, "Referer": referer } };
          }
          const html = yield resp.text();
          let match;
          XOR_PATTERN.lastIndex = 0;
          while ((match = XOR_PATTERN.exec(html)) !== null) {
            try {
              const decrypted = xorDecrypt(match[2], match[1]);
              const streamMatch = decrypted.match(CURRENT_SRC_PATTERN);
              if (streamMatch) {
                const streamUrl = streamMatch[1].replace(/\\/g, "");
                const vidxgoOrigin = new URL(url).origin;
                return {
                  url: streamUrl,
                  headers: {
                    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0",
                    "Referer": url,
                    "Origin": vidxgoOrigin,
                    "Accept": "*/*",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Sec-GPC": "1",
                    "Sec-Fetch-Dest": "empty",
                    "Sec-Fetch-Mode": "cors",
                    "Sec-Fetch-Site": "cross-site",
                    "DNT": "1",
                    "Priority": "u=0"
                  }
                };
              }
            } catch (e) {
              continue;
            }
          }
          if (CORRUPT_PLAYER_PATTERN.test(html)) {
            console.warn("[VidxGo] Source is marked corrupt or not available");
            return null;
          }
          console.warn("[VidxGo] No stream URL found in page");
          return { url, headers: { "User-Agent": USER_AGENT, "Referer": referer } };
        } catch (e) {
          console.error("[VidxGo] Extraction error:", e);
          return null;
        }
      });
    }
    module2.exports = { extractVidxGo, VIDXGO_HEADERS, CORRUPT_PLAYER_PATTERN };
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

// src/quality_helper.js
var require_quality_helper = __commonJS({
  "src/quality_helper.js"(exports2, module2) {
    var { createTimeoutSignal } = require_fetch_helper();
    var USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
    function checkQualityFromPlaylist(_0) {
      return __async(this, arguments, function* (url, headers = {}) {
        try {
          if (!url.includes(".m3u8")) return null;
          const finalHeaders = __spreadValues({}, headers);
          if (!finalHeaders["User-Agent"]) {
            finalHeaders["User-Agent"] = USER_AGENT;
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
    function checkItalianAudioInPlaylist(_0) {
      return __async(this, arguments, function* (url, headers = {}) {
        try {
          if (!url.includes(".m3u8")) return false;
          const finalHeaders = __spreadValues({}, headers);
          if (!finalHeaders["User-Agent"]) finalHeaders["User-Agent"] = USER_AGENT;
          const timeoutConfig = createTimeoutSignal(3e3);
          try {
            const response = yield fetch(url, { headers: finalHeaders, signal: timeoutConfig.signal });
            if (!response.ok) return false;
            const text = yield response.text();
            return /#EXT-X-MEDIA:TYPE=AUDIO.*(?:LANGUAGE="it"|LANGUAGE="ita"|NAME="Italian"|NAME="Ita")/i.test(text);
          } finally {
            if (typeof timeoutConfig.cleanup === "function") timeoutConfig.cleanup();
          }
        } catch (e) {
          return false;
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
    module2.exports = { checkQualityFromPlaylist, getQualityFromUrl, checkQualityFromText, checkItalianAudioInPlaylist };
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
      if (text.includes("loadm") || text.includes("loadm.cam") || text.includes("mixdrop") || text.includes("mxcontent")) {
        return true;
      }
      return false;
    }
    function normalizeProviderId(providerName) {
      const normalized = String(providerName || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
      return normalized || void 0;
    }
    function formatStream(stream, providerName) {
      let quality = stream.quality || "";
      if (quality === "2160p") quality = "\u{1F525}4K UHD";
      else if (quality === "1440p") quality = "\u2728 QHD";
      else if (quality === "1080p") quality = "\u{1F680} FHD";
      else if (quality === "720p") quality = "\u{1F4BF} HD";
      else if (quality === "576p" || quality === "480p" || quality === "360p" || quality === "240p") quality = "\u{1F4A9} Low Quality";
      else if (!quality || ["auto", "unknown", "unknow"].includes(String(quality).toLowerCase())) quality = "\u{1F4BF} HD";
      let title = `\u{1F4C1} ${stream.title || "Stream"}`;
      let language = stream.language;
      if (language === void 0 || language === null) {
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
      const providerExplicitNotWebReady = stream.behaviorHints && "notWebReady" in stream.behaviorHints;
      const shouldForceNotWebReady = shouldForceNotWebReadyForPlugin(stream, providerName, finalHeaders, behaviorHints);
      if (!isStreamingCommunityProvider && shouldForceNotWebReady) {
        behaviorHints.notWebReady = true;
      } else if (!providerExplicitNotWebReady) {
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
    module2.exports = { formatStream };
  }
});

// src/vidxgo/index.js
var require_vidxgo2 = __commonJS({
  "src/vidxgo/index.js"(exports2, module2) {
    var IS_SERVER = typeof process !== "undefined" && process.versions && process.versions.node;
    if (!IS_SERVER) {
      module2.exports = {
        getStreams: (id, type, season, episode) => __async(null, null, function* () {
          console.warn("[VidxGo-Client] Disabled: VidXGo requires EasyProxy stream proxy.");
          return [];
        })
      };
    } else {
      let getMappingApiUrl2 = function() {
        return "https://animemapping.realbestia.com";
      }, normalizeConfigBoolean2 = function(value) {
        if (value === true) return true;
        const normalized = String(value || "").trim().toLowerCase();
        return ["1", "true", "yes", "on", "enabled", "checked"].includes(normalized);
      }, getMappingLanguage2 = function(providerContext = null) {
        const explicit = String((providerContext == null ? void 0 : providerContext.mappingLanguage) || "").trim().toLowerCase();
        if (explicit === "it") return "it";
        return normalizeConfigBoolean2(providerContext == null ? void 0 : providerContext.easyCatalogsLangIt) ? "it" : null;
      }, getQualityFromName2 = function(qualityStr) {
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
      }, getImdbId2 = function(tmdbId, type) {
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
            console.error("[VidxGo] Conversion error:", e);
            return null;
          }
        });
      }, getTitleFromIds2 = function(imdbId, tmdbId, type) {
        return __async2(this, null, function* () {
          try {
            const normalizedType = String(type || "").toLowerCase();
            const endpoint = normalizedType === "movie" ? "movie" : "tv";
            if (/^\d+$/.test(String(tmdbId || ""))) {
              const response = yield fetch(`https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=it-IT`);
              if (response.ok) {
                const data = yield response.json();
                return data.title || data.name || data.original_title || data.original_name || null;
              }
            }
            if (/^tt\d+$/i.test(String(imdbId || ""))) {
              const response = yield fetch(`https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id&language=it-IT`);
              if (!response.ok) return null;
              const data = yield response.json();
              const results = endpoint === "movie" ? data.movie_results : data.tv_results;
              const fallback = endpoint === "movie" ? data.tv_results : data.movie_results;
              const item = Array.isArray(results) && results[0] || Array.isArray(fallback) && fallback[0] || null;
              return item && (item.title || item.name || item.original_title || item.original_name) || null;
            }
          } catch (e) {
            return null;
          }
          return null;
        });
      }, getIdsFromMapping2 = function(provider, externalId, season, episode, lang = null) {
        return __async2(this, null, function* () {
          try {
            if (!externalId) return null;
            const params = new URLSearchParams();
            const parsedEpisode = parseInt(String(episode || ""), 10);
            const parsedSeason = parseInt(String(season || ""), 10);
            params.set("ep", Number.isInteger(parsedEpisode) && parsedEpisode > 0 ? String(parsedEpisode) : "1");
            if (Number.isInteger(parsedSeason) && parsedSeason >= 0) params.set("s", String(parsedSeason));
            if (lang) params.set("lang", lang);
            const url = `${getMappingApiUrl2()}/${provider}/${encodeURIComponent(String(externalId).trim())}?${params.toString()}`;
            const response = yield fetch(url);
            if (!response.ok) return null;
            const payload = yield response.json();
            const ids = payload && payload.mappings && payload.mappings.ids ? payload.mappings.ids : {};
            const tmdbEpisode = payload && payload.mappings && (payload.mappings.tmdb_episode || payload.mappings.tmdbEpisode) || payload && (payload.tmdb_episode || payload.tmdbEpisode) || null;
            const tmdbId = ids && /^\d+$/.test(String(ids.tmdb || "").trim()) ? String(ids.tmdb).trim() : null;
            const imdbId = ids && /^tt\d+$/i.test(String(ids.imdb || "").trim()) ? String(ids.imdb).trim() : null;
            const mappedSeason = parseInt(String(tmdbEpisode && (tmdbEpisode.season || tmdbEpisode.seasonNumber || tmdbEpisode.season_number) || ""), 10);
            const mappedEpisode = parseInt(String(tmdbEpisode && (tmdbEpisode.episode || tmdbEpisode.episodeNumber || tmdbEpisode.episode_number) || ""), 10);
            const rawEpisodeNumber = parseInt(String(tmdbEpisode && (tmdbEpisode.rawEpisodeNumber || tmdbEpisode.raw_episode_number || tmdbEpisode.rawEpisode) || ""), 10);
            return {
              tmdbId,
              imdbId,
              mappedSeason: Number.isInteger(mappedSeason) && mappedSeason > 0 ? mappedSeason : null,
              mappedEpisode: Number.isInteger(mappedEpisode) && mappedEpisode > 0 ? mappedEpisode : null,
              rawEpisodeNumber: Number.isInteger(rawEpisodeNumber) && rawEpisodeNumber > 0 ? rawEpisodeNumber : null
            };
          } catch (e) {
            console.error("[VidxGo] mapping error:", e);
            return null;
          }
        });
      }, getStreams3 = function(id, type, season, episode, providerContext = null) {
        return __async2(this, null, function* () {
          const benchStart = Date.now();
          const bench = [];
          const mark = (step, meta = {}) => {
            if (!STEP_BENCH_ENABLED) return;
            bench.push(__spreadValues({ step, t: Date.now() - benchStart }, meta));
          };
          try {
            let tmdbId = id;
            let imdbId = null;
            let effectiveSeason = parseInt(String(season || ""), 10) || 1;
            let effectiveEpisode = parseInt(String(episode || ""), 10) || 1;
            const contextTmdbId = providerContext && /^\d+$/.test(String(providerContext.tmdbId || "")) ? String(providerContext.tmdbId) : null;
            const contextImdbId = providerContext && /^tt\d+$/i.test(String(providerContext.imdbId || "")) ? String(providerContext.imdbId) : null;
            const contextKitsuId = providerContext && /^\d+$/.test(String(providerContext.kitsuId || "")) ? String(providerContext.kitsuId) : null;
            const mappingLang = getMappingLanguage2(providerContext);
            if (id.toString().startsWith("kitsu:") || contextKitsuId) {
              const kitsuId = contextKitsuId || id.toString().split(":")[1];
              const mapped = yield getIdsFromMapping2("kitsu", kitsuId, season, episode, mappingLang);
              mark("kitsu_mapping_done", { ok: Boolean(mapped && mapped.tmdbId) });
              if (mapped) {
                if (mapped.tmdbId) tmdbId = mapped.tmdbId;
                if (mapped.imdbId) imdbId = mapped.imdbId;
                if (mapped.mappedSeason && mapped.mappedEpisode) {
                  effectiveSeason = mapped.mappedSeason;
                  effectiveEpisode = mapped.mappedEpisode;
                } else if (mapped.rawEpisodeNumber) {
                  effectiveEpisode = mapped.rawEpisodeNumber;
                }
              }
            } else if (id.toString().startsWith("tt")) {
              imdbId = id.toString();
              tmdbId = contextTmdbId || tmdbId;
              const mapped = yield getIdsFromMapping2("imdb", imdbId, season, episode, mappingLang);
              if (mapped && mapped.tmdbId) tmdbId = mapped.tmdbId;
              if (mapped && mapped.mappedSeason && mapped.mappedEpisode) {
                effectiveSeason = mapped.mappedSeason;
                effectiveEpisode = mapped.mappedEpisode;
              } else if (mapped && mapped.rawEpisodeNumber) {
                effectiveEpisode = mapped.rawEpisodeNumber;
              }
              mark("imdb_mapping_done", { ok: true });
            } else if (id.toString().startsWith("tmdb:")) {
              tmdbId = id.toString().replace("tmdb:", "");
            }
            if (!imdbId && tmdbId) {
              const mapped = yield getIdsFromMapping2("tmdb", tmdbId, season, episode, mappingLang);
              if (mapped && mapped.imdbId) imdbId = mapped.imdbId;
              if (mapped && mapped.mappedSeason && mapped.mappedEpisode) {
                effectiveSeason = mapped.mappedSeason;
                effectiveEpisode = mapped.mappedEpisode;
              } else if (mapped && mapped.rawEpisodeNumber) {
                effectiveEpisode = mapped.rawEpisodeNumber;
              }
              mark("tmdb_mapping_done", { ok: Boolean(imdbId) });
            }
            if (!imdbId && tmdbId) imdbId = contextImdbId || (yield getImdbId2(tmdbId, type));
            mark("imdb_resolve_done", { ok: Boolean(imdbId) });
            if (!imdbId) return [];
            const isMovie = String(type).toLowerCase() === "movie";
            const contentTitle = (yield getTitleFromIds2(imdbId, tmdbId, type)) || (isMovie ? "Film" : "Serie");
            const displayName = isMovie ? contentTitle : `${contentTitle} ${effectiveSeason}x${effectiveEpisode}`;
            const streams = [];
            const vidxgoUrl = isMovie ? `https://v.vidxgo.co/${imdbId}` : `https://v.vidxgo.co/${imdbId}/${effectiveSeason}/${effectiveEpisode}`;
            const shouldUseEasyProxy = Boolean(providerContext && providerContext.proxyUrl);
            let vidxgoStream = null;
            const extracted = yield extractVidxGo(vidxgoUrl, "https://altadefinizione.you/");
            if (!extracted) {
              return [];
            }
            if (shouldUseEasyProxy) {
              vidxgoStream = {
                url: vidxgoUrl,
                easyProxySourceUrl: vidxgoUrl,
                headers: null
              };
            } else {
              vidxgoStream = extracted;
            }
            if (vidxgoStream && vidxgoStream.url) {
              let quality = "HD";
              let hasItalian = false;
              if (!shouldUseEasyProxy) {
                const detectedQuality = yield checkQualityFromPlaylist(vidxgoStream.url, vidxgoStream.headers);
                if (detectedQuality) quality = detectedQuality;
                hasItalian = yield checkItalianAudioInPlaylist(vidxgoStream.url, vidxgoStream.headers);
              }
              streams.push({
                url: vidxgoStream.url,
                easyProxySourceUrl: vidxgoUrl,
                headers: vidxgoStream.headers,
                name: "VidxGo",
                title: displayName,
                quality: getQualityFromName2(quality),
                type: "direct",
                language: hasItalian ? void 0 : ""
              });
            }
            mark("vidxgo_extracted", { ok: Boolean(vidxgoStream && vidxgoStream.url) });
            const finalStreams = streams.map((s) => formatStream(s, "VidxGo")).filter((s) => s !== null);
            mark("extractors_done", { streams: finalStreams.length });
            if (STEP_BENCH_ENABLED) {
              console.log(`[VidxGoBench] ${JSON.stringify({ id: String(id), type: String(type), totalMs: Date.now() - benchStart, steps: bench })}`);
            }
            return finalStreams;
          } catch (e) {
            if (STEP_BENCH_ENABLED) {
              console.log(`[VidxGoBench] ${JSON.stringify({ id: String(id), type: String(type), totalMs: Date.now() - benchStart, failed: true, steps: bench, error: e && e.message ? e.message : String(e) })}`);
            }
            console.error("[VidxGo] Error:", e);
            return [];
          }
        });
      };
      getMappingApiUrl = getMappingApiUrl2, normalizeConfigBoolean = normalizeConfigBoolean2, getMappingLanguage = getMappingLanguage2, getQualityFromName = getQualityFromName2, getImdbId = getImdbId2, getTitleFromIds = getTitleFromIds2, getIdsFromMapping = getIdsFromMapping2, getStreams2 = getStreams3;
      __async2 = (__this, __arguments, generator) => {
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
      const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
      const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
      const { extractVidxGo } = require_vidxgo();
      require_fetch_helper();
      const { checkQualityFromPlaylist, checkItalianAudioInPlaylist } = require_quality_helper();
      const { formatStream } = require_formatter();
      const STEP_BENCH_ENABLED = String(process.env.PROVIDER_STEP_BENCH || "").trim().toLowerCase() === "1";
      module2.exports = { getStreams: getStreams3 };
    }
    var __async2;
    var getMappingApiUrl;
    var normalizeConfigBoolean;
    var getMappingLanguage;
    var getQualityFromName;
    var getImdbId;
    var getTitleFromIds;
    var getIdsFromMapping;
    var getStreams2;
  }
});

// src/vidxgo_ec/index.js
var baseProvider = require_vidxgo2();
function getStreams(id, type, season, episode, providerContext = null) {
  return __async(this, null, function* () {
    return yield baseProvider.getStreams(id, type, season, episode, __spreadProps(__spreadValues({}, providerContext || {}), {
      easyCatalogsLangIt: true,
      mappingLanguage: "it"
    }));
  });
}
module.exports = { getStreams };
