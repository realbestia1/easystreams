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
    function isMp4Url(rawUrl, depth = 0) {
      const url = String(rawUrl || "").trim();
      if (!url) return false;
      const directMatch = (value) => /\.mp4(?:[?#].*)?$/i.test(String(value || "").trim());
      if (directMatch(url)) return true;
      if (depth >= 1) return false;
      try {
        const parsed = new URL(url);
        if (String(parsed.pathname || "").toLowerCase().endsWith(".mp4")) return true;
        const nestedKeys = ["url", "src", "file", "link", "stream"];
        for (const key of nestedKeys) {
          const nested = parsed.searchParams.get(key);
          if (!nested) continue;
          let decoded = nested;
          try {
            decoded = decodeURIComponent(nested);
          } catch (_) {
            decoded = nested;
          }
          if (isMp4Url(decoded, depth + 1)) return true;
        }
        return false;
      } catch (e) {
        return directMatch(url);
      }
    }
    function shouldSetNotWebReady(url, headers, behaviorHints = {}) {
      const proxyHeaders = behaviorHints.proxyHeaders && behaviorHints.proxyHeaders.request;
      if (proxyHeaders && Object.keys(proxyHeaders).length > 0) return true;
      if (headers && Object.keys(headers).length > 0) return true;
      return !isMp4Url(url);
    }
    function formatStream2(stream, providerName) {
      let quality = stream.quality || "";
      if (quality === "2160p") quality = "\u{1F525}4K UHD";
      else if (quality === "1440p") quality = "\u2728 QHD";
      else if (quality === "1080p") quality = "\u{1F680} FHD";
      else if (quality === "720p") quality = "\u{1F4BF} HD";
      else if (quality === "576p" || quality === "480p" || quality === "360p" || quality === "240p") quality = "\u{1F4A9} Low Quality";
      else if (!quality || ["auto", "unknown", "unknow"].includes(String(quality).toLowerCase())) quality = "Unknow";
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
      }
      behaviorHints.notWebReady = shouldSetNotWebReady(stream.url, finalHeaders, behaviorHints);
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

// src/provider_urls.js
var require_provider_urls = __commonJS({
  "src/provider_urls.js"(exports2, module2) {
    "use strict";
    var PROVIDER_URLS_URL = "https://raw.githubusercontent.com/realbestia1/easystreams/refs/heads/main/provider_urls.json";
    var REMOTE_RELOAD_INTERVAL_MS = 1e4;
    var REMOTE_FETCH_TIMEOUT_MS = 5e3;
    var ALIASES = {
      animeunity: ["animeunuty", "anime_unity"],
      animeworld: ["anime_world"],
      animesaturn: ["anime_saturn"],
      streamingcommunity: ["streaming_community"],
      guardahd: ["guarda_hd"],
      guardaserie: ["guarda_serie"],
      guardoserie: ["guardo_serie"],
      mapping_api: ["mappingapi", "mapping_api_url", "mapping_url"]
    };
    var lastData = {};
    var lastRemoteCheckAt = 0;
    var remoteInFlight = null;
    function normalizeKey(key) {
      return String(key || "").trim().toLowerCase();
    }
    function normalizeUrl(value) {
      const text = String(value || "").trim();
      if (!text) return "";
      return text.replace(/\/+$/, "");
    }
    function toNormalizedMap(raw) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
      const out = {};
      for (const [key, value] of Object.entries(raw)) {
        const normalizedKey = normalizeKey(key);
        const normalizedValue = normalizeUrl(value);
        if (!normalizedKey || !normalizedValue) continue;
        out[normalizedKey] = normalizedValue;
      }
      return out;
    }
    function reloadProviderUrlsIfNeeded() {
    }
    function getFetchImpl() {
      if (typeof fetch === "function") return fetch.bind(globalThis);
      return null;
    }
    function createTimeoutSignal2(timeoutMs) {
      const parsed = Number.parseInt(String(timeoutMs), 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return { signal: void 0, cleanup: null };
      }
      if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
        return { signal: AbortSignal.timeout(parsed), cleanup: null };
      }
      if (typeof AbortController !== "undefined" && typeof setTimeout === "function") {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), parsed);
        return {
          signal: controller.signal,
          cleanup: () => clearTimeout(timeoutId)
        };
      }
      return { signal: void 0, cleanup: null };
    }
    function refreshProviderUrlsFromRemoteIfNeeded(force = false) {
      return __async(this, null, function* () {
        if (!PROVIDER_URLS_URL) return;
        if (remoteInFlight) return;
        const now = Date.now();
        if (!force && now - lastRemoteCheckAt < REMOTE_RELOAD_INTERVAL_MS) return;
        lastRemoteCheckAt = now;
        const fetchImpl = getFetchImpl();
        if (!fetchImpl) return;
        remoteInFlight = (() => __async(null, null, function* () {
          const timeoutConfig = createTimeoutSignal2(REMOTE_FETCH_TIMEOUT_MS);
          try {
            const response = yield fetchImpl(PROVIDER_URLS_URL, {
              signal: timeoutConfig.signal,
              headers: {
                "accept": "application/json"
              }
            });
            if (!response || !response.ok) return;
            const payload = yield response.json();
            const parsed = toNormalizedMap(payload);
            if (Object.keys(parsed).length > 0) {
              lastData = parsed;
            }
          } catch (e) {
          } finally {
            if (typeof timeoutConfig.cleanup === "function") timeoutConfig.cleanup();
            remoteInFlight = null;
          }
        }))();
      });
    }
    function findFromJson(providerKey) {
      refreshProviderUrlsFromRemoteIfNeeded(false);
      const key = normalizeKey(providerKey);
      const candidates = [key, ...ALIASES[key] || []].map(normalizeKey);
      for (const candidate of candidates) {
        const value = normalizeUrl(lastData[candidate]);
        if (value) return value;
      }
      return "";
    }
    function getProviderUrl2(providerKey) {
      const fromJson = findFromJson(providerKey);
      return fromJson || "";
    }
    function getProviderUrlsFilePath() {
      return "";
    }
    function getProviderUrlsSourceUrl() {
      return PROVIDER_URLS_URL;
    }
    module2.exports = {
      getProviderUrl: getProviderUrl2,
      reloadProviderUrlsIfNeeded,
      getProviderUrlsFilePath,
      getProviderUrlsSourceUrl
    };
    lastData = {};
    refreshProviderUrlsFromRemoteIfNeeded(true);
  }
});

// src/animeworld/index.js
var { formatStream } = require_formatter();
var { checkQualityFromPlaylist } = require_quality_helper();
var { getProviderUrl } = require_provider_urls();
var { createTimeoutSignal } = require_fetch_helper();
function getWorldBaseUrl() {
  return getProviderUrl("animeworld");
}
function getMappingApiBase() {
  return getProviderUrl("mapping_api").replace(/\/+$/, "");
}
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
var FETCH_TIMEOUT = 1e4;
var TTL = {
  http: 5 * 60 * 1e3,
  page: 15 * 60 * 1e3,
  info: 5 * 60 * 1e3,
  mapping: 2 * 60 * 1e3
};
var caches = {
  http: /* @__PURE__ */ new Map(),
  mapping: /* @__PURE__ */ new Map(),
  inflight: /* @__PURE__ */ new Map()
};
var BLOCKED_DOMAINS = [
  "jujutsukaisenanime.com",
  "onepunchman.it",
  "dragonballhd.it",
  "narutolegend.it"
];
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
function decodeHtmlEntities(raw) {
  const decodedNumeric = String(raw || "").replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
    const codePoint = Number.parseInt(hex, 16);
    if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 1114111) return _;
    try {
      return String.fromCodePoint(codePoint);
    } catch (e) {
      return _;
    }
  }).replace(/&#(\d+);/g, (_, dec) => {
    const codePoint = Number.parseInt(dec, 10);
    if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 1114111) return _;
    try {
      return String.fromCodePoint(codePoint);
    } catch (e) {
      return _;
    }
  });
  return decodedNumeric.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
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
function toAbsoluteUrl(href, base = null) {
  if (!href) return null;
  const trimmed = String(href).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  try {
    return new URL(trimmed, base || getWorldBaseUrl()).toString();
  } catch (e) {
    return null;
  }
}
function normalizeAnimeWorldPath(pathOrUrl) {
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
  const match = value.match(/^\/(?:play\/[^/?#]+|anime\/[^/?#]+)/i);
  return match ? match[0] : null;
}
function buildWorldUrl(pathOrUrl) {
  const text = String(pathOrUrl || "").trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith("/")) return `${getWorldBaseUrl()}${text}`;
  return `${getWorldBaseUrl()}/${text}`;
}
function inferSourceTag(title, animePath) {
  const titleText = String(title || "").toLowerCase();
  const pathText = String(animePath || "").toLowerCase();
  if (/(?:^|[^\w])ita(?:[^\w]|$)/i.test(titleText)) return "ITA";
  if (/(?:^|[-_/])ita(?:[-_/.?]|$)/i.test(pathText)) return "ITA";
  return "SUB";
}
function resolveLanguageEmoji(sourceTag) {
  return String(sourceTag || "").toUpperCase() === "ITA" ? "\u{1F1EE}\u{1F1F9}" : "\u{1F1EF}\u{1F1F5}";
}
function sanitizeAnimeTitle(rawTitle) {
  let text = decodeHtmlEntities(rawTitle).trim();
  if (!text) return null;
  text = text.replace(/\s*-\s*AnimeWorld.*$/i, "").replace(/\s*-\s*AnimeUnity.*$/i, "").replace(/\s+Streaming.*$/i, "").replace(/\s+episodio\s*\d+(?:[.,]\d+)?\b/gi, "").replace(/\s+episode\s*\d+(?:[.,]\d+)?\b/gi, "").trim();
  text = text.replace(/\s*[\[(]\s*(?:SUB\s*ITA|ITA|SUB|DUB(?:BED)?|DOPPIATO)\s*[\])]\s*/gi, " ").replace(/\s*[-–_|:]\s*(?:SUB\s*ITA|ITA|SUB|DUB(?:BED)?|DOPPIATO)\s*$/gi, "").replace(/\s{2,}/g, " ").replace(/\s*[-–_|:]\s*$/g, "").trim();
  return text || null;
}
function parseTagAttributes(tag) {
  var _a, _b;
  const attrs = {};
  const regex = /([A-Za-z_:][A-Za-z0-9_:\-.]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = regex.exec(String(tag || ""))) !== null) {
    const key = String(match[1] || "").trim().toLowerCase();
    const value = decodeHtmlEntities((_b = (_a = match[3]) != null ? _a : match[4]) != null ? _b : "").trim();
    if (!key) continue;
    attrs[key] = value;
  }
  return attrs;
}
function parseEpisodeNumber(value, fallbackNum) {
  const text = String(value || "").trim();
  const directInt = parsePositiveInt(text);
  if (directInt) return directInt;
  const floatMatch = text.match(/(\d+(?:[.,]\d+)?)/);
  if (floatMatch) {
    const parsed = Number.parseFloat(floatMatch[1].replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
  }
  return fallbackNum;
}
function normalizePlayableMediaUrl(rawUrl, depth = 0) {
  const absolute = toAbsoluteUrl(rawUrl, getWorldBaseUrl());
  if (!absolute) return null;
  if (/\.(?:mp4|m3u8)(?:[?#].*)?$/i.test(absolute)) return absolute;
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
function normalizeAnimeWorldQuality(value) {
  const text = String(value || "").trim();
  if (!text) return "720p";
  if (/^(?:unknown|unknow|auto)$/i.test(text)) return "720p";
  return text;
}
function collectMediaLinksFromHtml(html) {
  const links = [];
  const seen = /* @__PURE__ */ new Set();
  const add = (rawUrl) => {
    const normalized = normalizePlayableMediaUrl(rawUrl);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    links.push(normalized);
  };
  const raw = String(html || "");
  const variants = [raw, raw.replace(/\\\//g, "/")];
  for (const text of variants) {
    let match;
    const directRegex = /https?:\/\/[^\s"'<>\\]+(?:\.mp4|\.m3u8)(?:[^\s"'<>\\]*)?/gi;
    while ((match = directRegex.exec(text)) !== null) add(match[0]);
    const encodedRegex = /https%3A%2F%2F[^\s"'<>\\]+/gi;
    while ((match = encodedRegex.exec(text)) !== null) {
      try {
        add(decodeURIComponent(match[0]));
      } catch (e) {
      }
    }
    const sourceRegex = /(?:file|src|url|link)\s*[:=]\s*["']([^"']+)["']/gi;
    while ((match = sourceRegex.exec(text)) !== null) add(match[1]);
  }
  return links;
}
function extractTitleFromHtml(html) {
  const raw = String(html || "");
  const ogTitle = /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i.exec(raw);
  if (ogTitle && ogTitle[1]) return sanitizeAnimeTitle(ogTitle[1]);
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(raw);
  if (titleTag && titleTag[1]) return sanitizeAnimeTitle(titleTag[1]);
  return null;
}
function normalizeEpisodesList(sourceEpisodes = []) {
  var _a;
  if (!Array.isArray(sourceEpisodes) || sourceEpisodes.length === 0) return [];
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (let index = 0; index < sourceEpisodes.length; index += 1) {
    const entry = sourceEpisodes[index] || {};
    const num = parseEpisodeNumber(entry.num, index + 1);
    const episodeId = parsePositiveInt((_a = entry.episodeId) != null ? _a : entry.id);
    const episodeToken = String(entry.episodeToken || entry.token || "").trim() || null;
    if (!episodeId && !episodeToken) continue;
    const rangeLabel = String(entry.rangeLabel || "").trim() || null;
    const baseLabel = String(entry.baseLabel || "").trim() || null;
    const commentLabel = String(entry.commentLabel || "").trim() || null;
    const token = String(
      entry.token || (episodeToken ? `tok:${episodeToken}` : episodeId ? `ep:${episodeId}` : `ep-${num}`)
    ).trim() || `ep-${num}`;
    const key = `${num}|${episodeId || ""}|${episodeToken || ""}|${token}|${rangeLabel || ""}|${baseLabel || ""}|${commentLabel || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      num,
      token,
      episodeId: episodeId || null,
      episodeToken,
      rangeLabel,
      baseLabel,
      commentLabel
    });
  }
  out.sort((a, b) => a.num - b.num);
  return out;
}
function parseEpisodesFromPageHtml(html) {
  const raw = String(html || "");
  const episodes = [];
  const anchorRegex = /<a\b[^>]*(?:data-episode-num=(?:"[^"]*"|'[^']*'))[^>]*(?:data-id=(?:"[^"]*"|'[^']*'))[^>]*>|<a\b[^>]*(?:data-id=(?:"[^"]*"|'[^']*'))[^>]*(?:data-episode-num=(?:"[^"]*"|'[^']*'))[^>]*>/gi;
  const tags = raw.match(anchorRegex) || [];
  for (let index = 0; index < tags.length; index += 1) {
    const attrs = parseTagAttributes(tags[index]);
    const episodeId = parsePositiveInt(attrs["data-episode-id"] || attrs["data-id"]);
    const episodeToken = String(attrs["data-id"] || "").trim() || null;
    if (!episodeId && !episodeToken) continue;
    const num = parseEpisodeNumber(attrs["data-episode-num"], index + 1);
    episodes.push({
      num,
      episodeId,
      episodeToken,
      rangeLabel: attrs["data-num"] || null,
      baseLabel: attrs["data-base"] || null,
      commentLabel: attrs["data-comment"] || null
    });
  }
  return normalizeEpisodesList(episodes);
}
function parseAnimeWorldPage(html, fallback = {}) {
  const title = extractTitleFromHtml(html) || sanitizeAnimeTitle(fallback.title) || null;
  const animePath = normalizeAnimeWorldPath(fallback.animePath || null);
  const episodes = parseEpisodesFromPageHtml(html);
  return {
    title,
    animePath,
    sourceTag: inferSourceTag(title, animePath),
    episodes
  };
}
function pickEpisodeEntry(episodes, requestedEpisode, mediaType = "tv") {
  const list = normalizeEpisodesList(episodes);
  if (list.length === 0) return null;
  if (mediaType === "movie") return list[0];
  const episode = normalizeRequestedEpisode(requestedEpisode);
  const byNum = list.find((entry) => entry.num === episode);
  if (byNum) return byNum;
  const byIndex = list[episode - 1];
  if (byIndex) return byIndex;
  if (episode === 1) return list[0];
  return null;
}
function getEpisodeDisplayLabel(entry, requestedNumber = null) {
  if (!entry) return requestedNumber ? String(requestedNumber) : null;
  const spanSources = [entry.rangeLabel, entry.baseLabel, entry.commentLabel];
  for (const source of spanSources) {
    const text = String(source || "").trim();
    const numeric = parsePositiveInt(text);
    if (numeric) return String(numeric);
    const match = text.match(/\d+(?:\.\d+)?/);
    if (match) return match[0];
  }
  if (parsePositiveInt(entry.num)) return String(entry.num);
  if (requestedNumber) return String(requestedNumber);
  return null;
}
function normalizeHostLabel(rawUrl) {
  try {
    const host = new URL(String(rawUrl || "")).hostname.replace(/^www\./i, "").toLowerCase();
    if (!host) return "";
    if (host.includes("sweetpixel")) return "SweetPixel";
    if (host.includes("stream")) return "Stream";
    const first = host.split(".")[0] || host;
    return first.charAt(0).toUpperCase() + first.slice(1);
  } catch (e) {
    return "";
  }
}
function collectGrabberCandidates(infoData) {
  const urls = [];
  const directKeys = ["grabber", "url", "link", "file", "stream"];
  for (const key of directKeys) {
    const value = infoData == null ? void 0 : infoData[key];
    if (typeof value === "string" && value.trim()) urls.push(value.trim());
  }
  const listKeys = ["links", "streams", "servers", "sources"];
  for (const key of listKeys) {
    const value = infoData == null ? void 0 : infoData[key];
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (typeof item === "string" && item.trim()) {
        urls.push(item.trim());
        continue;
      }
      if (!item || typeof item !== "object") continue;
      const candidate = item.grabber || item.url || item.link || item.file || item.stream || null;
      if (candidate && String(candidate).trim()) {
        urls.push(String(candidate).trim());
      }
    }
  }
  return uniqueStrings(urls);
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
function extractSessionCookie(setCookieHeader) {
  const text = String(setCookieHeader || "");
  const match = text.match(/sessionId=[^;,\s]+/i);
  return match ? match[0] : null;
}
function extractCsrfTokenFromHtml(html) {
  const match = /<meta[^>]*name=["']csrf-token["'][^>]*content=["']([^"']+)["'][^>]*>/i.exec(String(html || ""));
  return match && match[1] ? String(match[1]).trim() : null;
}
function fetchAnimePageContext(animeUrl, cacheKey) {
  return __async(this, null, function* () {
    const key = `anime-page-context:${cacheKey}`;
    const cached = getCached(caches.http, key);
    if (cached !== void 0) return cached;
    const response = yield fetchWithTimeout(
      animeUrl,
      {
        method: "GET",
        headers: {
          "user-agent": USER_AGENT,
          "accept-language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7"
        },
        redirect: "follow"
      },
      FETCH_TIMEOUT
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} for ${animeUrl}`);
    }
    const html = yield response.text();
    const rawSetCookie = response.headers.get("set-cookie") || "";
    const sessionCookie = extractSessionCookie(rawSetCookie);
    const csrfToken = extractCsrfTokenFromHtml(html);
    const context = { html, sessionCookie, csrfToken };
    setCached(caches.http, key, context, TTL.page);
    return context;
  });
}
function fetchEpisodeInfo(episodeRef, refererUrl, pageContext = null) {
  return __async(this, null, function* () {
    const token = String(episodeRef || "").trim();
    if (!token) return null;
    const url = `${getWorldBaseUrl()}/api/episode/info?id=${encodeURIComponent(token)}`;
    const csrfToken = String((pageContext == null ? void 0 : pageContext.csrfToken) || "").trim();
    const sessionCookie = String((pageContext == null ? void 0 : pageContext.sessionCookie) || "").trim();
    const extraHeaders = {};
    if (csrfToken) extraHeaders["csrf-token"] = csrfToken;
    if (sessionCookie) extraHeaders.cookie = sessionCookie;
    try {
      return yield fetchResource(url, {
        as: "json",
        ttlMs: TTL.info,
        cacheKey: `episode-info:${token}:${csrfToken ? "csrf" : "nocsrf"}:${sessionCookie ? "cookie" : "nocookie"}`,
        timeoutMs: FETCH_TIMEOUT,
        headers: __spreadValues({
          referer: refererUrl,
          "x-requested-with": "XMLHttpRequest"
        }, extraHeaders)
      });
    } catch (error) {
      console.error("[AnimeWorld] episode info request failed:", error.message);
      return null;
    }
  });
}
function extractStreamsFromAnimePath(animePath, requestedEpisode, mediaType = "tv") {
  return __async(this, null, function* () {
    const normalizedPath = normalizeAnimeWorldPath(animePath);
    if (!normalizedPath) return [];
    const animeUrl = buildWorldUrl(normalizedPath);
    if (!animeUrl) return [];
    let parsedPage;
    let pageContext;
    try {
      pageContext = yield fetchAnimePageContext(animeUrl, `animeworld:${normalizedPath}`);
      parsedPage = parseAnimeWorldPage(pageContext.html, { animePath: normalizedPath });
    } catch (error) {
      console.error("[AnimeWorld] anime page request failed:", error.message);
      return [];
    }
    const normalizedEpisode = normalizeRequestedEpisode(requestedEpisode);
    const selectedEpisode = pickEpisodeEntry(parsedPage.episodes, normalizedEpisode, mediaType);
    if (!selectedEpisode) return [];
    const infoRef = selectedEpisode.episodeToken || selectedEpisode.episodeId;
    const infoData = yield fetchEpisodeInfo(infoRef, animeUrl, pageContext);
    if (!infoData || typeof infoData !== "object") return [];
    const grabbers = collectGrabberCandidates(infoData);
    if (grabbers.length === 0) return [];
    const baseTitle = sanitizeAnimeTitle(parsedPage.title) || "Unknown Title";
    const episodeLabel = getEpisodeDisplayLabel(selectedEpisode, normalizedEpisode);
    const displayTitle = episodeLabel ? `${baseTitle} - Ep ${episodeLabel}` : baseTitle;
    const streamLanguage = resolveLanguageEmoji(parsedPage.sourceTag);
    const streams = [];
    const seen = /* @__PURE__ */ new Set();
    for (const candidate of grabbers) {
      const mediaUrl = normalizePlayableMediaUrl(candidate);
      if (!mediaUrl) continue;
      const lowerLink = mediaUrl.toLowerCase();
      if (lowerLink.endsWith(".mkv.mp4") || BLOCKED_DOMAINS.some((domain) => lowerLink.includes(domain))) {
        continue;
      }
      if (seen.has(mediaUrl)) continue;
      seen.add(mediaUrl);
      let quality = extractQualityHint(mediaUrl);
      if (lowerLink.includes(".m3u8")) {
        const detected = yield checkQualityFromPlaylist(mediaUrl, {
          "User-Agent": USER_AGENT,
          Referer: animeUrl
        });
        if (detected) quality = detected;
      }
      const hostLabel = normalizeHostLabel(mediaUrl);
      const serverName = hostLabel ? `AnimeWorld - ${hostLabel}` : "AnimeWorld";
      streams.push({
        name: serverName,
        title: displayTitle,
        server: serverName,
        url: mediaUrl,
        language: streamLanguage,
        quality: normalizeAnimeWorldQuality(quality),
        headers: {
          "User-Agent": USER_AGENT,
          Referer: animeUrl
        }
      });
    }
    if (streams.length === 0) {
      const targetUrl = toAbsoluteUrl(infoData.target || null, getWorldBaseUrl());
      if (targetUrl) {
        const extraHeaders = {};
        const csrfToken = String((pageContext == null ? void 0 : pageContext.csrfToken) || "").trim();
        const sessionCookie = String((pageContext == null ? void 0 : pageContext.sessionCookie) || "").trim();
        if (csrfToken) extraHeaders["csrf-token"] = csrfToken;
        if (sessionCookie) extraHeaders.cookie = sessionCookie;
        try {
          const targetHtml = yield fetchResource(targetUrl, {
            ttlMs: TTL.info,
            cacheKey: `server-target:${targetUrl}:${csrfToken ? "csrf" : "nocsrf"}:${sessionCookie ? "cookie" : "nocookie"}`,
            timeoutMs: FETCH_TIMEOUT,
            headers: __spreadValues({
              referer: animeUrl,
              "x-requested-with": "XMLHttpRequest"
            }, extraHeaders)
          });
          const targetLinks = collectMediaLinksFromHtml(targetHtml);
          for (const mediaUrl of targetLinks) {
            if (seen.has(mediaUrl)) continue;
            const lowerLink = mediaUrl.toLowerCase();
            if (lowerLink.endsWith(".mkv.mp4") || BLOCKED_DOMAINS.some((domain) => lowerLink.includes(domain))) {
              continue;
            }
            seen.add(mediaUrl);
            let quality = extractQualityHint(mediaUrl);
            if (lowerLink.includes(".m3u8")) {
              const detected = yield checkQualityFromPlaylist(mediaUrl, {
                "User-Agent": USER_AGENT,
                Referer: animeUrl
              });
              if (detected) quality = detected;
            }
            const hostLabel = normalizeHostLabel(mediaUrl);
            const serverName = hostLabel ? `AnimeWorld - ${hostLabel}` : "AnimeWorld";
            streams.push({
              name: serverName,
              title: displayTitle,
              server: serverName,
              url: mediaUrl,
              language: streamLanguage,
              quality: normalizeAnimeWorldQuality(quality),
              headers: {
                "User-Agent": USER_AGENT,
                Referer: animeUrl
              }
            });
          }
        } catch (error) {
          console.error("[AnimeWorld] target player request failed:", error.message);
        }
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
      console.error("[AnimeWorld] mapping request failed:", error.message);
      return null;
    }
  });
}
function extractAnimeWorldPaths(mappingPayload) {
  var _a;
  if (!mappingPayload || typeof mappingPayload !== "object") return [];
  const raw = (_a = mappingPayload == null ? void 0 : mappingPayload.mappings) == null ? void 0 : _a.animeworld;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const paths = [];
  for (const item of list) {
    const candidate = typeof item === "string" ? item : item && typeof item === "object" ? item.path || item.url || item.href || item.playPath : null;
    const normalized = normalizeAnimeWorldPath(candidate);
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
  var _a, _b;
  const fromKitsu = parsePositiveInt((_a = mappingPayload == null ? void 0 : mappingPayload.kitsu) == null ? void 0 : _a.episode);
  if (fromKitsu) return fromKitsu;
  const fromRequested = parsePositiveInt((_b = mappingPayload == null ? void 0 : mappingPayload.requested) == null ? void 0 : _b.episode);
  if (fromRequested) return fromRequested;
  return normalizeRequestedEpisode(fallbackEpisode);
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
            console.error("[AnimeWorld] task failed:", error.message);
          }
        }
      });
    }
    yield Promise.all(Array.from({ length: concurrency }, () => worker()));
    return output;
  });
}
function getStreams(id, type, season, episode, providerContext = null) {
  return __async(this, null, function* () {
    try {
      const lookup = resolveLookupRequest(id, season, episode, providerContext);
      if (!lookup) return [];
      let mappingPayload = yield fetchMappingPayload(lookup, providerContext);
      let animePaths = extractAnimeWorldPaths(mappingPayload);
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
          const tmdbPaths = extractAnimeWorldPaths(tmdbPayload);
          if (tmdbPaths.length > 0) {
            mappingPayload = tmdbPayload;
            animePaths = tmdbPaths;
          }
        }
      }
      if (animePaths.length === 0) return [];
      const requestedEpisode = resolveEpisodeFromMappingPayload(mappingPayload, lookup.episode);
      const normalizedType = String(type || "").toLowerCase();
      const mediaType = normalizedType === "movie" ? "movie" : "tv";
      const perPathStreams = yield mapLimit(
        animePaths,
        3,
        (path) => extractStreamsFromAnimePath(path, requestedEpisode, mediaType)
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
      return deduped.map((stream) => formatStream(stream, "AnimeWorld")).filter(Boolean);
    } catch (error) {
      console.error("[AnimeWorld] getStreams failed:", error.message);
      return [];
    }
  });
}
module.exports = { getStreams };
