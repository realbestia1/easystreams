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
      if (text.includes("mixdrop") || text.includes("m1xdrop") || text.includes("mxcontent")) {
        return true;
      }
      if (text.includes("loadm") || text.includes("loadm.cam")) {
        return true;
      }
      return false;
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
        // Explicitly ensure root headers are preserved for Nuvio
        headers: finalHeaders
      });
    }
    module2.exports = { formatStream: formatStream2 };
  }
});

// src/fetch_helper.js
var require_fetch_helper = __commonJS({
  "src/fetch_helper.js"(exports2, module2) {
    var FETCH_TIMEOUT2 = 3e4;
    function createTimeoutSignal2(timeoutMs) {
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
    function fetchWithTimeout2(_0) {
      return __async(this, arguments, function* (url, options = {}) {
        if (typeof fetch === "undefined") {
          throw new Error("No fetch implementation found!");
        }
        const _a = options, { timeout } = _a, fetchOptions = __objRest(_a, ["timeout"]);
        const requestTimeout = timeout || FETCH_TIMEOUT2;
        const timeoutConfig = createTimeoutSignal2(requestTimeout);
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
    module2.exports = { fetchWithTimeout: fetchWithTimeout2, createTimeoutSignal: createTimeoutSignal2 };
  }
});

// src/quality_helper.js
var require_quality_helper = __commonJS({
  "src/quality_helper.js"(exports2, module2) {
    var { createTimeoutSignal: createTimeoutSignal2 } = require_fetch_helper();
    var USER_AGENT2 = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
    function checkQualityFromPlaylist2(_0) {
      return __async(this, arguments, function* (url, headers = {}) {
        try {
          if (!url.includes(".m3u8")) return null;
          const finalHeaders = __spreadValues({}, headers);
          if (!finalHeaders["User-Agent"]) {
            finalHeaders["User-Agent"] = USER_AGENT2;
          }
          const timeoutConfig = createTimeoutSignal2(3e3);
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

// src/animesaturn/index.js
var cheerio = require("cheerio");
var { formatStream } = require_formatter();
var { checkQualityFromPlaylist } = require_quality_helper();
var { createTimeoutSignal } = require_fetch_helper();
function getSaturnBaseUrl() {
  return "https://www.animesaturn.cx";
}
function getMappingApiBase() {
  return "https://animemapping.realbestia.com";
}
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
var FETCH_TIMEOUT = 1e4;
var TTL = {
  http: 5 * 60 * 1e3,
  page: 15 * 60 * 1e3,
  watch: 5 * 60 * 1e3,
  mapping: 2 * 60 * 1e3
};
var BLOCKED_DOMAINS = [
  "jujutsukaisenanime.com",
  "onepunchman.it",
  "dragonballhd.it",
  "narutolegend.it"
];
var caches = {
  http: /* @__PURE__ */ new Map(),
  mapping: /* @__PURE__ */ new Map(),
  inflight: /* @__PURE__ */ new Map()
};
function getCached(map, key) {
  const entry = map.get(key);
  if (!entry) return void 0;
  if (entry.expiresAt <= Date.now()) {
    map.delete(key);
    return void 0;
  }
  return entry.value;
}
function setCached(map, key, value, ttlMs) {
  map.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}
function uniqueStrings(values) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const value of values) {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}
function parsePositiveInt(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
function normalizeRequestedEpisode(value) {
  const parsed = parsePositiveInt(value);
  return parsed || 1;
}
function normalizeRequestedSeason(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}
function normalizeConfigBoolean(value) {
  if (value === true) return true;
  const normalized = String(value || "").trim().toLowerCase();
  return ["1", "true", "yes", "on", "enabled", "checked"].includes(normalized);
}
function getMappingLanguage(providerContext = null) {
  const explicit = String((providerContext == null ? void 0 : providerContext.mappingLanguage) || "").trim().toLowerCase();
  if (explicit === "it") return "it";
  return normalizeConfigBoolean(providerContext == null ? void 0 : providerContext.easyCatalogsLangIt) ? "it" : null;
}
function toAbsoluteUrl(href, base = null) {
  if (!href) return null;
  const trimmed = String(href).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  try {
    return new URL(trimmed, base || getSaturnBaseUrl()).toString();
  } catch (e) {
    return null;
  }
}
function normalizeAnimeSaturnPath(pathOrUrl) {
  if (!pathOrUrl) return null;
  let value = String(pathOrUrl).trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) {
    try {
      value = new URL(value).pathname;
    } catch (e) {
      return null;
    }
  }
  if (!value.startsWith("/")) value = `/${value}`;
  value = value.replace(/\/+$/, "");
  const match = value.match(/^\/anime\/[^/?#]+/i);
  return match ? match[0] : null;
}
function normalizeEpisodePath(pathOrUrl) {
  if (!pathOrUrl) return null;
  let value = String(pathOrUrl).trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) {
    try {
      value = new URL(value).pathname;
    } catch (e) {
      return null;
    }
  }
  if (!value.startsWith("/")) value = `/${value}`;
  value = value.replace(/\/+$/, "");
  const match = value.match(/^\/ep\/[^/?#]+/i);
  return match ? match[0] : null;
}
function buildSaturnUrl(pathOrUrl) {
  const text = String(pathOrUrl || "").trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith("/")) return `${getSaturnBaseUrl()}${text}`;
  return `${getSaturnBaseUrl()}/${text}`;
}
function inferSourceTag(title, animePath) {
  const titleText = String(title || "").toLowerCase();
  const pathText = String(animePath || "").toLowerCase();
  if (/(?:^|[^\w])ita(?:[^\w]|$)/i.test(titleText)) return "ITA";
  if (/(?:^|[-_/])ita(?:[-_/]|$)/i.test(pathText)) return "ITA";
  return "SUB";
}
function resolveLanguageEmoji(sourceTag) {
  return String(sourceTag || "").toUpperCase() === "ITA" ? "\u{1F1EE}\u{1F1F9}" : "\u{1F1EF}\u{1F1F5}";
}
function sanitizeAnimeTitle(rawTitle) {
  let text = String(rawTitle || "").trim();
  if (!text) return null;
  text = text.replace(/^\s*AnimeSaturn\s*-\s*/i, "").replace(/\s*-\s*AnimeSaturn.*$/i, "").replace(/\s+Streaming.*$/i, "").replace(/\s+Episodi.*$/i, "").replace(/\s+episodio\s*\d+(?:[.,]\d+)?\b/gi, "").replace(/\s+episode\s*\d+(?:[.,]\d+)?\b/gi, "").trim();
  text = text.replace(/\s*[\[(]\s*(?:SUB\s*ITA|ITA|SUB|DUB(?:BED)?|DOPPIATO)\s*[\])]\s*/gi, " ").replace(/\s*[-–_|:]\s*(?:SUB\s*ITA|ITA|SUB|DUB(?:BED)?|DOPPIATO)\s*$/gi, "").replace(/\s{2,}/g, " ").replace(/\s*[-–_|:]\s*$/g, "").trim();
  return text || null;
}
function parseEpisodeNumber(value, fallbackNum) {
  const raw = String(value || "").trim();
  if (!raw) return fallbackNum;
  const byHref = raw.match(/-ep-(\d+)/i);
  if (byHref) {
    const parsed = Number.parseInt(byHref[1], 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const byLabel = raw.match(/episodio\s*(\d+)/i);
  if (byLabel) {
    const parsed = Number.parseInt(byLabel[1], 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallbackNum;
}
function isDirectMediaPath(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (!/^https?:\/\//i.test(text)) {
    return /\.(?:mp4|m3u8)(?:[?#].*)?$/i.test(text);
  }
  try {
    const parsed = new URL(text);
    const path = String(parsed.pathname || "").toLowerCase();
    return path.endsWith(".mp4") || path.endsWith(".m3u8");
  } catch (e) {
    return /\.(?:mp4|m3u8)(?:[?#].*)?$/i.test(text);
  }
}
function normalizePlayableMediaUrl(rawUrl, depth = 0) {
  const absolute = toAbsoluteUrl(rawUrl, getSaturnBaseUrl());
  if (!absolute) return null;
  if (isDirectMediaPath(absolute)) return absolute;
  if (depth >= 1) return null;
  let parsed;
  try {
    parsed = new URL(absolute);
  } catch (e) {
    return null;
  }
  const path = String(parsed.pathname || "").toLowerCase();
  if (path.endsWith(".mp4") || path.endsWith(".m3u8")) return parsed.toString();
  const nestedKeys = ["url", "src", "file", "link", "stream", "id"];
  for (const key of nestedKeys) {
    const nested = parsed.searchParams.get(key);
    if (!nested) continue;
    let decoded = nested;
    try {
      decoded = decodeURIComponent(nested);
    } catch (e) {
      decoded = nested;
    }
    const nestedUrl = normalizePlayableMediaUrl(decoded, depth + 1);
    if (nestedUrl) return nestedUrl;
  }
  return null;
}
function extractQualityHint(value) {
  const text = String(value || "");
  const match = text.match(/(\d{3,4}p)/i);
  return match ? match[1] : "Unknown";
}
function normalizeAnimeSaturnQuality(value) {
  const text = String(value || "").trim();
  if (!text) return "720p";
  if (/^(?:unknown|unknow|auto)$/i.test(text)) return "720p";
  return text;
}
function fetchWithTimeout(_0) {
  return __async(this, arguments, function* (url, options = {}, timeoutMs = FETCH_TIMEOUT) {
    const timeoutConfig = createTimeoutSignal(timeoutMs);
    const requestOptions = __spreadValues({}, options);
    if (timeoutConfig.signal) {
      if (requestOptions.signal && typeof AbortSignal !== "undefined" && typeof AbortSignal.any === "function") {
        requestOptions.signal = AbortSignal.any([requestOptions.signal, timeoutConfig.signal]);
      } else if (!requestOptions.signal) {
        requestOptions.signal = timeoutConfig.signal;
      }
    }
    try {
      return yield fetch(url, requestOptions);
    } finally {
      if (typeof timeoutConfig.cleanup === "function") {
        timeoutConfig.cleanup();
      }
    }
  });
}
function fetchResource(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const {
      ttlMs = 0,
      cacheKey = url,
      as = "text",
      method = "GET",
      headers = {},
      body = void 0,
      timeoutMs = FETCH_TIMEOUT
    } = options;
    const key = `${as}:${method}:${cacheKey}:${typeof body === "string" ? body : ""}`;
    if (ttlMs > 0) {
      const cached = getCached(caches.http, key);
      if (cached !== void 0) return cached;
    }
    const inflightKey = `http:${key}`;
    const running = caches.inflight.get(inflightKey);
    if (running) return running;
    const task = (() => __async(null, null, function* () {
      const response = yield fetchWithTimeout(
        url,
        {
          method,
          headers: __spreadValues({
            "user-agent": USER_AGENT,
            "accept-language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7"
          }, headers),
          body,
          redirect: "follow"
        },
        timeoutMs
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
      }
      const payload = as === "json" ? yield response.json() : yield response.text();
      if (ttlMs > 0) setCached(caches.http, key, payload, ttlMs);
      return payload;
    }))();
    caches.inflight.set(inflightKey, task);
    try {
      return yield task;
    } finally {
      caches.inflight.delete(inflightKey);
    }
  });
}
function extractWatchUrlsFromHtml(html, expectedFileId = null) {
  const text = String(html || "");
  const values = /* @__PURE__ */ new Set();
  let match;
  const absoluteRegex = /https?:\/\/[^\s"'<>\\]+\/watch\?file=[^"'<>\\\s]+/gi;
  while ((match = absoluteRegex.exec(text)) !== null) {
    values.add(match[0]);
  }
  const relativeRegex = /\/watch\?file=[^"'<>\\\s]+/gi;
  while ((match = relativeRegex.exec(text)) !== null) {
    values.add(buildSaturnUrl(match[0]));
  }
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const candidate of values) {
    const absolute = toAbsoluteUrl(candidate);
    if (!absolute || seen.has(absolute)) continue;
    try {
      const parsed = new URL(absolute);
      if (parsed.pathname !== "/watch") continue;
      const fileParam = parsed.searchParams.get("file");
      if (!fileParam) continue;
      if (expectedFileId && fileParam !== expectedFileId) continue;
      seen.add(absolute);
      out.push(absolute);
      if (!parsed.searchParams.has("s")) {
        parsed.searchParams.set("s", "alt");
        const altUrl = parsed.toString();
        if (!seen.has(altUrl)) {
          seen.add(altUrl);
          out.push(altUrl);
        }
      }
    } catch (e) {
    }
  }
  return out;
}
function parseAnimeSaturnPage(html, fallback = {}) {
  const $ = cheerio.load(html);
  const pageTitle = $("h1").first().text().trim() || $("meta[property='og:title']").attr("content") || $("title").first().text().trim() || null;
  const title = sanitizeAnimeTitle(fallback.title) || sanitizeAnimeTitle(pageTitle) || null;
  const animePath = normalizeAnimeSaturnPath(fallback.animePath || null);
  const sourceTag = inferSourceTag(title, animePath);
  const episodes = [];
  const seenEpisodePath = /* @__PURE__ */ new Set();
  $("a[href*='/ep/']").each((index, element) => {
    const anchor = $(element);
    const href = normalizeEpisodePath(anchor.attr("href"));
    if (!href || seenEpisodePath.has(href)) return;
    seenEpisodePath.add(href);
    const probe = `${href} ${anchor.text() || ""} ${anchor.attr("title") || ""}`;
    const num = parseEpisodeNumber(probe, index + 1);
    episodes.push({
      num,
      token: href,
      episodePath: href,
      watchUrl: null
    });
  });
  if (episodes.length === 0) {
    const watchUrls = extractWatchUrlsFromHtml(html);
    if (watchUrls.length > 0) {
      episodes.push({
        num: 1,
        token: "watch-1",
        episodePath: null,
        watchUrl: watchUrls[0]
      });
    }
  }
  const relatedAnimePaths = [];
  const seenRelated = /* @__PURE__ */ new Set();
  $("a[href*='/anime/']").each((_, element) => {
    const anchor = $(element);
    const relatedPath = normalizeAnimeSaturnPath(anchor.attr("href"));
    if (!relatedPath || seenRelated.has(relatedPath)) return;
    if (animePath && relatedPath === animePath) return;
    const probe = `${anchor.text() || ""} ${anchor.attr("title") || ""} ${relatedPath}`.toLowerCase();
    if (!probe.includes("ita")) return;
    seenRelated.add(relatedPath);
    relatedAnimePaths.push(relatedPath);
  });
  episodes.sort((a, b) => a.num - b.num);
  return {
    title,
    animePath,
    sourceTag,
    episodes,
    relatedAnimePaths
  };
}
function normalizeEpisodesList(sourceEpisodes = []) {
  var _a;
  if (!Array.isArray(sourceEpisodes) || sourceEpisodes.length === 0) return [];
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (let index = 0; index < sourceEpisodes.length; index += 1) {
    const entry = sourceEpisodes[index] || {};
    const numRaw = Number.parseInt(String((_a = entry.num) != null ? _a : index + 1), 10);
    const num = Number.isFinite(numRaw) && numRaw > 0 ? numRaw : index + 1;
    const episodePath = normalizeEpisodePath(entry.episodePath || entry.href || entry.token || null);
    const watchUrl = toAbsoluteUrl(entry.watchUrl || null);
    const token = String(entry.token || episodePath || watchUrl || `ep-${num}`).trim();
    const key = `${num}|${episodePath || ""}|${watchUrl || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ num, token, episodePath, watchUrl });
  }
  out.sort((a, b) => a.num - b.num);
  return out;
}
function mergeEpisodeLists(existingEpisodes = [], nextEpisodes = []) {
  const map = /* @__PURE__ */ new Map();
  function setEpisode(entry) {
    if (!entry) return;
    const num = Number.parseInt(String(entry.num || ""), 10);
    if (!Number.isFinite(num) || num <= 0) return;
    const current = map.get(num) || { num, token: null, episodePath: null, watchUrl: null };
    map.set(num, {
      num,
      token: entry.token || current.token || null,
      episodePath: entry.episodePath || current.episodePath || null,
      watchUrl: entry.watchUrl || current.watchUrl || null
    });
  }
  normalizeEpisodesList(existingEpisodes).forEach(setEpisode);
  normalizeEpisodesList(nextEpisodes).forEach(setEpisode);
  return [...map.values()].sort((a, b) => a.num - b.num);
}
function pickEpisodeEntry(episodes, requestedEpisode, mediaType = "tv") {
  const list = normalizeEpisodesList(episodes);
  if (list.length === 0) return null;
  if (mediaType === "movie") return list[0];
  const episode = normalizeRequestedEpisode(requestedEpisode);
  const byNum = list.find((entry) => entry.num === episode);
  if (byNum) return byNum;
  if (episode === 1) return list[0];
  return null;
}
function collectMediaLinksFromWatchHtml(html) {
  const $ = cheerio.load(String(html || ""));
  const links = [];
  const seen = /* @__PURE__ */ new Set();
  function addLink(href, label) {
    const playable = normalizePlayableMediaUrl(href);
    if (!playable || seen.has(playable)) return;
    seen.add(playable);
    links.push({ href: playable, label });
  }
  $("source[src], video source[src]").each((_, element) => {
    addLink($(element).attr("src"), "Player");
  });
  const rawHtml = String(html || "");
  const variants = [rawHtml, rawHtml.replace(/\\\//g, "/")];
  for (const text of variants) {
    let match;
    const directRegex = /https?:\/\/[^\s"'<>\\]+(?:\.mp4|\.m3u8)(?:[^\s"'<>\\]*)?/gi;
    while ((match = directRegex.exec(text)) !== null) {
      addLink(match[0], "Player");
    }
    const encodedRegex = /https%3A%2F%2F[^\s"'<>\\]+/gi;
    while ((match = encodedRegex.exec(text)) !== null) {
      try {
        addLink(decodeURIComponent(match[0]), "Player");
      } catch (e) {
      }
    }
    const sourceRegex = /(?:file|src|url|link)\s*[:=]\s*["']([^"']+)["']/gi;
    while ((match = sourceRegex.exec(text)) !== null) {
      addLink(match[1], "Player");
    }
  }
  return links;
}
function normalizeHostLabel(rawUrl) {
  try {
    const host = new URL(String(rawUrl || "")).hostname.replace(/^www\./i, "").toLowerCase();
    if (!host) return "";
    const first = host.split(".")[0] || host;
    return first.charAt(0).toUpperCase() + first.slice(1);
  } catch (e) {
    return "";
  }
}
function resolveWatchUrlsForEpisodeEntry(source, episodeEntry) {
  return __async(this, null, function* () {
    const urls = [];
    const hasEpisodePath = Boolean(episodeEntry == null ? void 0 : episodeEntry.episodePath);
    if (episodeEntry == null ? void 0 : episodeEntry.watchUrl) {
      urls.push(...extractWatchUrlsFromHtml(episodeEntry.watchUrl));
    }
    if (urls.length === 0 && (episodeEntry == null ? void 0 : episodeEntry.episodePath)) {
      const episodeUrl = buildSaturnUrl(episodeEntry.episodePath);
      if (episodeUrl) {
        try {
          const html = yield fetchResource(episodeUrl, {
            ttlMs: TTL.watch,
            cacheKey: `episode-page:${episodeEntry.episodePath}`,
            timeoutMs: FETCH_TIMEOUT
          });
          urls.push(...extractWatchUrlsFromHtml(html));
        } catch (error) {
          console.error("[AnimeSaturn] episode page request failed:", error.message);
        }
      }
    }
    if (hasEpisodePath && urls.length === 0) {
      const epLabel = Number.isFinite(Number(episodeEntry == null ? void 0 : episodeEntry.num)) ? episodeEntry.num : "?";
      console.log(`[AnimeSaturn] No watch links for episode ${epLabel}. Skipping fallback.`);
      return [];
    }
    if (urls.length === 0 && (source == null ? void 0 : source.animePath)) {
      const animeUrl = buildSaturnUrl(source.animePath);
      if (animeUrl) {
        try {
          const html = yield fetchResource(animeUrl, {
            ttlMs: TTL.watch,
            cacheKey: `anime-watch-fallback:${source.animePath}`,
            timeoutMs: FETCH_TIMEOUT
          });
          urls.push(...extractWatchUrlsFromHtml(html));
        } catch (error) {
          console.error("[AnimeSaturn] anime watch fallback failed:", error.message);
        }
      }
    }
    return uniqueStrings(urls.map((url) => toAbsoluteUrl(url))).filter(Boolean);
  });
}
function mapLimit(values, limit, mapper) {
  return __async(this, null, function* () {
    if (!Array.isArray(values) || values.length === 0) return [];
    const concurrency = Math.max(1, Math.min(limit, values.length));
    const output = new Array(values.length);
    let cursor = 0;
    function worker() {
      return __async(this, null, function* () {
        while (cursor < values.length) {
          const current = cursor;
          cursor += 1;
          try {
            output[current] = yield mapper(values[current], current);
          } catch (error) {
            output[current] = [];
            console.error("[AnimeSaturn] task failed:", error.message);
          }
        }
      });
    }
    yield Promise.all(Array.from({ length: concurrency }, () => worker()));
    return output;
  });
}
function extractStreamsFromAnimePath(animePath, requestedEpisode, mediaType = "tv", originalEpisode = null) {
  return __async(this, null, function* () {
    const normalizedPath = normalizeAnimeSaturnPath(animePath);
    if (!normalizedPath) return [];
    const animeUrl = buildSaturnUrl(normalizedPath);
    if (!animeUrl) return [];
    let parsedPage;
    try {
      const html = yield fetchResource(animeUrl, {
        ttlMs: TTL.page,
        cacheKey: `anime:${normalizedPath}`,
        timeoutMs: FETCH_TIMEOUT
      });
      parsedPage = parseAnimeSaturnPage(html, { animePath: normalizedPath });
    } catch (error) {
      console.error("[AnimeSaturn] anime page request failed:", error.message);
      return [];
    }
    const normalizedEpisode = normalizeRequestedEpisode(requestedEpisode);
    const normalizedOriginalEpisode = normalizeRequestedEpisode(
      originalEpisode === null || originalEpisode === void 0 ? normalizedEpisode : originalEpisode
    );
    let episodes = normalizeEpisodesList(parsedPage.episodes);
    let selected = pickEpisodeEntry(episodes, normalizedEpisode, mediaType);
    const allowRelated = String(parsedPage.sourceTag || "").toUpperCase() !== "ITA";
    if (allowRelated && (!selected || episodes.length === 0) && Array.isArray(parsedPage.relatedAnimePaths) && parsedPage.relatedAnimePaths.length > 0) {
      for (const related of parsedPage.relatedAnimePaths.slice(0, 2)) {
        try {
          const relatedUrl = buildSaturnUrl(related);
          if (!relatedUrl) continue;
          const html = yield fetchResource(relatedUrl, {
            ttlMs: TTL.page,
            cacheKey: `anime-related:${related}`,
            timeoutMs: FETCH_TIMEOUT
          });
          const relatedParsed = parseAnimeSaturnPage(html, { animePath: related, title: parsedPage.title });
          episodes = mergeEpisodeLists(episodes, relatedParsed.episodes);
        } catch (e) {
        }
      }
      selected = pickEpisodeEntry(episodes, normalizedEpisode, mediaType);
    }
    if (!selected) return [];
    const baseTitle = sanitizeAnimeTitle(parsedPage.title) || "Unknown Title";
    const resolvedEpisode = parsePositiveInt(selected.num) || normalizedEpisode;
    if (String(parsedPage.sourceTag || "").toUpperCase() === "ITA" && resolvedEpisode !== normalizedOriginalEpisode) {
      console.log(`[AnimeSaturn] Skipping ITA episode ${resolvedEpisode} (requested ${normalizedOriginalEpisode}).`);
      return [];
    }
    const displayTitle = mediaType === "movie" ? baseTitle : `${baseTitle} - Ep ${resolvedEpisode}`;
    const streamLanguage = resolveLanguageEmoji(parsedPage.sourceTag);
    const initialWatchUrls = yield resolveWatchUrlsForEpisodeEntry(
      {
        animePath: normalizedPath,
        title: parsedPage.title,
        sourceTag: parsedPage.sourceTag,
        episodes
      },
      selected
    );
    if (initialWatchUrls.length === 0) return [];
    const queue = [...initialWatchUrls];
    const visitedWatchUrls = /* @__PURE__ */ new Set();
    const streams = [];
    const seenMedia = /* @__PURE__ */ new Set();
    const expectedFileId = (() => {
      try {
        const parsed = new URL(initialWatchUrls[0]);
        return parsed.searchParams.get("file");
      } catch (e) {
        return null;
      }
    })();
    let processed = 0;
    while (queue.length > 0 && processed < 6) {
      const watchUrl = queue.shift();
      if (!watchUrl || visitedWatchUrls.has(watchUrl)) continue;
      visitedWatchUrls.add(watchUrl);
      processed += 1;
      let html = "";
      try {
        html = yield fetchResource(watchUrl, {
          ttlMs: TTL.watch,
          cacheKey: `watch:${watchUrl}`,
          timeoutMs: FETCH_TIMEOUT
        });
      } catch (error) {
        console.error("[AnimeSaturn] watch page request failed:", error.message);
        continue;
      }
      const links = collectMediaLinksFromWatchHtml(html);
      for (const link of links) {
        const mediaUrl = normalizePlayableMediaUrl(link.href);
        if (!mediaUrl || seenMedia.has(mediaUrl)) continue;
        const lowerLink = mediaUrl.toLowerCase();
        if (lowerLink.endsWith(".mkv.mp4") || BLOCKED_DOMAINS.some((domain) => lowerLink.includes(domain))) {
          continue;
        }
        seenMedia.add(mediaUrl);
        let quality = extractQualityHint(mediaUrl);
        if (lowerLink.includes(".m3u8")) {
          const detected = yield checkQualityFromPlaylist(mediaUrl, {
            "User-Agent": USER_AGENT,
            Referer: watchUrl
          });
          if (detected) quality = detected;
        }
        const hostLabel = normalizeHostLabel(mediaUrl);
        const serverName = hostLabel ? `AnimeSaturn - ${hostLabel}` : "AnimeSaturn";
        streams.push({
          name: serverName,
          server: serverName,
          title: displayTitle,
          url: mediaUrl,
          language: streamLanguage,
          quality: normalizeAnimeSaturnQuality(quality),
          headers: {
            "User-Agent": USER_AGENT,
            Referer: watchUrl
          }
        });
      }
      const extraWatchUrls = extractWatchUrlsFromHtml(html, expectedFileId);
      for (const extra of extraWatchUrls) {
        if (!visitedWatchUrls.has(extra)) queue.push(extra);
      }
    }
    return streams;
  });
}
function parseExplicitRequestId(rawId) {
  const value = String(rawId || "").trim();
  if (!value) return null;
  let match = value.match(/^kitsu:(\d+)(?::(\d+))?(?::(\d+))?$/i);
  if (match) {
    return {
      provider: "kitsu",
      externalId: match[1],
      seasonFromId: match[3] ? normalizeRequestedSeason(match[2]) : null,
      episodeFromId: match[3] ? normalizeRequestedEpisode(match[3]) : match[2] ? normalizeRequestedEpisode(match[2]) : null
    };
  }
  match = value.match(/^imdb:(tt\d+)(?::(\d+))?(?::(\d+))?$/i);
  if (match) {
    return {
      provider: "imdb",
      externalId: match[1],
      seasonFromId: match[3] ? normalizeRequestedSeason(match[2]) : null,
      episodeFromId: match[3] ? normalizeRequestedEpisode(match[3]) : match[2] ? normalizeRequestedEpisode(match[2]) : null
    };
  }
  match = value.match(/^tmdb:(\d+)(?::(\d+))?(?::(\d+))?$/i);
  if (match) {
    return {
      provider: "tmdb",
      externalId: match[1],
      seasonFromId: match[3] ? normalizeRequestedSeason(match[2]) : null,
      episodeFromId: match[3] ? normalizeRequestedEpisode(match[3]) : match[2] ? normalizeRequestedEpisode(match[2]) : null
    };
  }
  match = value.match(/^(tt\d+)$/i);
  if (match) {
    return {
      provider: "imdb",
      externalId: match[1],
      seasonFromId: null,
      episodeFromId: null
    };
  }
  match = value.match(/^(\d+)$/);
  if (match) {
    return {
      provider: "tmdb",
      externalId: match[1],
      seasonFromId: null,
      episodeFromId: null
    };
  }
  return null;
}
function resolveLookupRequest(id, season, episode, providerContext = null) {
  let rawId = String(id || "").trim();
  try {
    rawId = decodeURIComponent(rawId);
  } catch (e) {
  }
  let requestedSeason = normalizeRequestedSeason(season);
  let requestedEpisode = normalizeRequestedEpisode(episode);
  const explicit = parseExplicitRequestId(rawId);
  if (explicit) {
    const explicitSeason = Number.isInteger(explicit.seasonFromId) && explicit.seasonFromId >= 0 ? explicit.seasonFromId : null;
    if (explicit.provider === "kitsu") {
      requestedSeason = explicitSeason;
    } else if (explicitSeason !== null) {
      requestedSeason = explicitSeason;
    }
    if (Number.isInteger(explicit.episodeFromId) && explicit.episodeFromId > 0) {
      requestedEpisode = explicit.episodeFromId;
    }
    return {
      provider: explicit.provider,
      externalId: explicit.externalId,
      season: requestedSeason,
      episode: requestedEpisode
    };
  }
  const contextKitsu = parsePositiveInt(providerContext == null ? void 0 : providerContext.kitsuId);
  if (contextKitsu) {
    return {
      provider: "kitsu",
      externalId: String(contextKitsu),
      season: null,
      episode: requestedEpisode
    };
  }
  const contextImdb = /^tt\d+$/i.test(String((providerContext == null ? void 0 : providerContext.imdbId) || "").trim()) ? String(providerContext.imdbId).trim() : null;
  if (contextImdb) {
    return {
      provider: "imdb",
      externalId: contextImdb,
      season: requestedSeason,
      episode: requestedEpisode
    };
  }
  const contextTmdb = /^\d+$/.test(String((providerContext == null ? void 0 : providerContext.tmdbId) || "").trim()) ? String(providerContext.tmdbId).trim() : null;
  if (contextTmdb) {
    return {
      provider: "tmdb",
      externalId: contextTmdb,
      season: requestedSeason,
      episode: requestedEpisode
    };
  }
  return null;
}
function fetchMappingPayload(lookup, providerContext = null) {
  return __async(this, null, function* () {
    if (!(lookup == null ? void 0 : lookup.provider) || !(lookup == null ? void 0 : lookup.externalId)) return null;
    const provider = String(lookup.provider || "").trim().toLowerCase();
    const externalId = String(lookup.externalId || "").trim();
    const requestedEpisode = normalizeRequestedEpisode(lookup.episode);
    const requestedSeason = normalizeRequestedSeason(lookup.season);
    if (!["kitsu", "imdb", "tmdb"].includes(provider)) return null;
    if (!externalId) return null;
    const mappingLanguage = provider === "kitsu" ? "it" : getMappingLanguage(providerContext);
    const mappingLanguageToken = mappingLanguage || "default";
    const cacheKey = `${provider}:${externalId}:s=${requestedSeason != null ? requestedSeason : "na"}:ep=${requestedEpisode}:lang=${mappingLanguageToken}`;
    const cached = getCached(caches.mapping, cacheKey);
    if (cached !== void 0) return cached;
    const params = new URLSearchParams();
    params.set("ep", String(requestedEpisode));
    if (Number.isInteger(requestedSeason) && requestedSeason >= 0) {
      params.set("s", String(requestedSeason));
    }
    if (mappingLanguage === "it") {
      params.set("lang", "it");
    }
    const url = `${getMappingApiBase()}/${provider}/${encodeURIComponent(externalId)}?${params.toString()}`;
    try {
      const payload = yield fetchResource(url, {
        as: "json",
        ttlMs: TTL.mapping,
        cacheKey,
        timeoutMs: FETCH_TIMEOUT
      });
      setCached(caches.mapping, cacheKey, payload, TTL.mapping);
      return payload;
    } catch (error) {
      console.error("[AnimeSaturn] mapping request failed:", error.message);
      return null;
    }
  });
}
function extractAnimeSaturnPaths(mappingPayload) {
  var _a;
  if (!mappingPayload || typeof mappingPayload !== "object") return [];
  const raw = (_a = mappingPayload == null ? void 0 : mappingPayload.mappings) == null ? void 0 : _a.animesaturn;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const paths = [];
  for (const item of list) {
    const candidate = typeof item === "string" ? item : item && typeof item === "object" ? item.path || item.url || item.href || item.playPath : null;
    const normalized = normalizeAnimeSaturnPath(candidate);
    if (normalized) paths.push(normalized);
  }
  return uniqueStrings(paths);
}
function extractTmdbIdFromMappingPayload(mappingPayload) {
  var _a, _b, _c;
  const candidate = ((_b = (_a = mappingPayload == null ? void 0 : mappingPayload.mappings) == null ? void 0 : _a.ids) == null ? void 0 : _b.tmdb) || ((_c = mappingPayload == null ? void 0 : mappingPayload.ids) == null ? void 0 : _c.tmdb) || (mappingPayload == null ? void 0 : mappingPayload.tmdbId) || null;
  const text = String(candidate || "").trim();
  return /^\d+$/.test(text) ? text : null;
}
function resolveEpisodeFromMappingPayload(mappingPayload, fallbackEpisode) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
  const fromKitsu = parsePositiveInt((_a = mappingPayload == null ? void 0 : mappingPayload.kitsu) == null ? void 0 : _a.episode);
  if (fromKitsu) return fromKitsu;
  const fromRequested = parsePositiveInt((_b = mappingPayload == null ? void 0 : mappingPayload.requested) == null ? void 0 : _b.episode);
  if (fromRequested) return fromRequested;
  const fromTmdbRaw = parsePositiveInt(
    ((_d = (_c = mappingPayload == null ? void 0 : mappingPayload.mappings) == null ? void 0 : _c.tmdb_episode) == null ? void 0 : _d.rawEpisodeNumber) || ((_f = (_e = mappingPayload == null ? void 0 : mappingPayload.mappings) == null ? void 0 : _e.tmdb_episode) == null ? void 0 : _f.raw_episode_number) || ((_h = (_g = mappingPayload == null ? void 0 : mappingPayload.mappings) == null ? void 0 : _g.tmdbEpisode) == null ? void 0 : _h.rawEpisodeNumber) || ((_i = mappingPayload == null ? void 0 : mappingPayload.tmdb_episode) == null ? void 0 : _i.rawEpisodeNumber) || ((_j = mappingPayload == null ? void 0 : mappingPayload.tmdbEpisode) == null ? void 0 : _j.rawEpisodeNumber)
  );
  if (fromTmdbRaw) return fromTmdbRaw;
  return normalizeRequestedEpisode(fallbackEpisode);
}
function getStreams(id, type, season, episode, providerContext = null) {
  return __async(this, null, function* () {
    try {
      const lookup = resolveLookupRequest(id, season, episode, providerContext);
      if (!lookup) return [];
      let mappingPayload = yield fetchMappingPayload(lookup, providerContext);
      let animePaths = extractAnimeSaturnPaths(mappingPayload);
      if (animePaths.length === 0 && String(lookup.provider || "").toLowerCase() === "imdb") {
        const tmdbFromContext = /^\d+$/.test(String((providerContext == null ? void 0 : providerContext.tmdbId) || "").trim()) ? String(providerContext.tmdbId).trim() : null;
        const tmdbFromPayload = extractTmdbIdFromMappingPayload(mappingPayload);
        const fallbackTmdbId = tmdbFromContext || tmdbFromPayload;
        if (fallbackTmdbId) {
          const tmdbLookup = {
            provider: "tmdb",
            externalId: fallbackTmdbId,
            season: lookup.season,
            episode: lookup.episode
          };
          const tmdbPayload = yield fetchMappingPayload(tmdbLookup, providerContext);
          const tmdbPaths = extractAnimeSaturnPaths(tmdbPayload);
          if (tmdbPaths.length > 0) {
            mappingPayload = tmdbPayload;
            animePaths = tmdbPaths;
          }
        }
      }
      if (animePaths.length === 0) return [];
      const requestedEpisode = resolveEpisodeFromMappingPayload(mappingPayload, lookup.episode);
      const originalRequestedEpisode = normalizeRequestedEpisode(lookup.episode);
      const normalizedType = String(type || "").toLowerCase();
      const mediaType = normalizedType === "movie" ? "movie" : "tv";
      const perPathStreams = yield mapLimit(
        animePaths,
        3,
        (path) => extractStreamsFromAnimePath(path, requestedEpisode, mediaType, originalRequestedEpisode)
      );
      const streams = perPathStreams.flat().filter((stream) => stream && stream.url);
      const deduped = [];
      const seen = /* @__PURE__ */ new Set();
      for (const stream of streams) {
        const normalizedUrl = normalizePlayableMediaUrl(stream.url);
        if (!normalizedUrl || seen.has(normalizedUrl)) continue;
        seen.add(normalizedUrl);
        deduped.push(__spreadProps(__spreadValues({}, stream), { url: normalizedUrl }));
      }
      return deduped.map((stream) => formatStream(stream, "AnimeSaturn")).filter(Boolean);
    } catch (error) {
      console.error("[AnimeSaturn] getStreams failed:", error.message);
      return [];
    }
  });
}
module.exports = { getStreams };
