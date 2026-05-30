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
      if (text.includes("loadm") || text.includes("loadm.cam") || text.includes("mixdrop") || text.includes("mxcontent")) {
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
    module2.exports = { formatStream: formatStream2 };
  }
});

// src/fetch_helper.js
var require_fetch_helper = __commonJS({
  "src/fetch_helper.js"(exports2, module2) {
    var FETCH_TIMEOUT2 = 3e4;
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
    function fetchWithTimeout2(_0) {
      return __async(this, arguments, function* (url, options = {}) {
        if (typeof fetch === "undefined") {
          throw new Error("No fetch implementation found!");
        }
        const _a = options, { timeout } = _a, fetchOptions = __objRest(_a, ["timeout"]);
        const requestTimeout = timeout || FETCH_TIMEOUT2;
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
    module2.exports = { fetchWithTimeout: fetchWithTimeout2, createTimeoutSignal };
  }
});

// src/cinemacity/index.js
var { formatStream } = require_formatter();
var { fetchWithTimeout } = require_fetch_helper();
var BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
function base64Decode(str) {
  try {
    if (typeof atob === "function") {
      return decodeURIComponent(escape(atob(str)));
    }
  } catch (e) {
  }
  try {
    let output = "";
    let buffer = 0;
    let bits = 0;
    const input = String(str || "").replace(/[^A-Za-z0-9+/=]/g, "");
    for (let i = 0; i < input.length; i++) {
      const char = input.charAt(i);
      if (char === "=") break;
      const value = BASE64_CHARS.indexOf(char);
      if (value < 0) continue;
      buffer = buffer << 6 | value;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        output += String.fromCharCode(buffer >> bits & 255);
      }
    }
    try {
      return decodeURIComponent(escape(output));
    } catch (e) {
      return output;
    }
  } catch (e) {
    console.error("[CinemaCity] Base64 decode error:", e);
    return "";
  }
}
var BASE_URL = base64Decode("aHR0cHM6Ly9jaW5lbWFjaXR5LmNj");
var USER_AGENT = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
var FETCH_TIMEOUT = 1e4;
var TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
var SITEMAP_URL = `${BASE_URL}/news_pages.xml`;
var SITEMAP_CACHE_MS = 60 * 60 * 1e3;
var sitemapCache = null;
function getMappingApiUrl() {
  return "https://animemapping.realbestia.com";
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
function fetchViaWorker(url) {
  return __async(this, null, function* () {
    const path = url.startsWith("http") ? new URL(url).pathname + new URL(url).search : url;
    const targetUrl = ("https://" + base64Decode("Y2MubGVhbmhodTA2MTIwNi53b3JrZXJzLmRldg==")).replace(/\/+$/, "") + (path.startsWith("/") ? path : "/" + path);
    const response = yield fetchWithTimeout(targetUrl, {
      timeout: FETCH_TIMEOUT,
      headers: { "User-Agent": USER_AGENT }
    });
    if (!response.ok) throw new Error(`Worker HTTP ${response.status}`);
    return yield response.text();
  });
}
function decodeHtmlEntities(str) {
  return String(str || "").replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec))).replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&ndash;|&mdash;/g, "-").replace(/\u2013|\u2014/g, "-");
}
function getHttpStatusFromError(error) {
  var _a;
  const responseStatus = Number.parseInt(String(((_a = error == null ? void 0 : error.response) == null ? void 0 : _a.status) || ""), 10);
  if (Number.isInteger(responseStatus)) return responseStatus;
  const match = String(error && error.message ? error.message : error).match(/HTTP\s+(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : null;
}
function isCloudflareBlockedError(error) {
  var _a, _b, _c;
  const message = [error == null ? void 0 : error.message, (_b = (_a = error == null ? void 0 : error.response) == null ? void 0 : _a.data) == null ? void 0 : _b.message, (_c = error == null ? void 0 : error.response) == null ? void 0 : _c.data].filter(Boolean).join(" ");
  return /Cloudflare has blocked this request|Error solving the challenge/i.test(message);
}
function normalizeTitle(value) {
  return decodeHtmlEntities(String(value || "")).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
}
function compactTitle(value) {
  return normalizeTitle(value).replace(/\s+/g, "");
}
function extractYearFromMetadata(metadata) {
  const date = (metadata == null ? void 0 : metadata.release_date) || (metadata == null ? void 0 : metadata.first_air_date) || "";
  const year = Number.parseInt(String(date).slice(0, 4), 10);
  return Number.isInteger(year) ? year : null;
}
function getSignificantTokens(value) {
  const stopwords = /* @__PURE__ */ new Set([
    "the",
    "a",
    "an",
    "of",
    "and",
    "in",
    "on",
    "to",
    "for",
    "at",
    "by",
    "is",
    "it",
    "il",
    "lo",
    "la",
    "gli",
    "le",
    "un",
    "uno",
    "una",
    "di",
    "da",
    "del",
    "della",
    "dei",
    "e",
    "o",
    "con",
    "per",
    "su",
    "tra",
    "fra"
  ]);
  return normalizeTitle(value).split(/\s+/).filter((token) => token.length > 1 && !stopwords.has(token));
}
function parseSitemapEntries(xml) {
  const entries = [];
  const regex = /<loc>(https:\/\/cinemacity\.cc\/(movies|tv-series)\/\d+-([a-z0-9-]+)\.html)<\/loc>/gi;
  let match;
  while ((match = regex.exec(String(xml || ""))) !== null) {
    const url = match[1];
    const kind = match[2];
    const slug = match[3];
    const yearMatch = slug.match(/-(\d{4})$/);
    const year = yearMatch ? Number.parseInt(yearMatch[1], 10) : null;
    const titleSlug = yearMatch ? slug.slice(0, -5) : slug;
    const title = titleSlug.replace(/-/g, " ");
    entries.push({
      url,
      kind,
      title,
      normalizedTitle: normalizeTitle(title),
      compactTitle: compactTitle(title),
      tokens: getSignificantTokens(title),
      year: Number.isInteger(year) ? year : null
    });
  }
  return entries;
}
function fetchSitemapEntries(providerContext = null) {
  return __async(this, null, function* () {
    if (sitemapCache && sitemapCache.expiresAt > Date.now()) {
      return sitemapCache.entries;
    }
    console.log("[CinemaCity] Fetching sitemap catalog...");
    let sitemapProxy = "https://" + base64Decode("Y2MubGVhbmhodTA2MTIwNi53b3JrZXJzLmRldg==");
    const sitemapPath = SITEMAP_URL.startsWith("http") ? new URL(SITEMAP_URL).pathname : SITEMAP_URL;
    if (sitemapProxy) {
      const firstPageUrl = sitemapProxy.endsWith("/") ? `${sitemapProxy.slice(0, -1)}${sitemapPath}?page=1&perPage=500` : `${sitemapProxy}${sitemapPath}?page=1&perPage=500`;
      console.log(`[CinemaCity] Fetching sitemap page 1 via CF Proxy: ${firstPageUrl}`);
      const firstResp = yield fetchWithTimeout(firstPageUrl, {
        timeout: FETCH_TIMEOUT,
        headers: { "User-Agent": USER_AGENT }
      });
      if (firstResp.ok) {
        const totalEntries = parseInt(firstResp.headers.get("x-total-entries") || "0", 10);
        const firstXml = yield firstResp.text();
        let allEntries = parseSitemapEntries(firstXml);
        if (totalEntries > 0) {
          const perPage = 500;
          const totalPages = Math.ceil(totalEntries / perPage);
          const pageFetches = [];
          for (let p = 2; p <= totalPages; p++) {
            const pageUrl = sitemapProxy.endsWith("/") ? `${sitemapProxy.slice(0, -1)}${sitemapPath}?page=${p}&perPage=500` : `${sitemapProxy}${sitemapPath}?page=${p}&perPage=500`;
            pageFetches.push(
              fetchWithTimeout(pageUrl, { timeout: FETCH_TIMEOUT, headers: { "User-Agent": USER_AGENT } }).then((r) => r.ok ? r.text() : "").then((xml2) => {
                if (xml2) allEntries = allEntries.concat(parseSitemapEntries(xml2));
              }).catch(() => {
              })
            );
          }
          yield Promise.all(pageFetches);
        } else if (allEntries.length >= 1800) {
          console.log(`[CinemaCity] Full sitemap received (${allEntries.length} entries)`);
          sitemapCache = { entries: allEntries, expiresAt: Date.now() + SITEMAP_CACHE_MS };
          return allEntries;
        }
        if (allEntries.length > 0) {
          sitemapCache = { entries: allEntries, expiresAt: Date.now() + SITEMAP_CACHE_MS };
          console.log(`[CinemaCity] Sitemap catalog loaded: ${allEntries.length} entries`);
          return allEntries;
        }
      }
      const targetUrl = sitemapProxy.endsWith("/") ? `${sitemapProxy}${sitemapPath.replace(/^\//, "")}` : `${sitemapProxy}${sitemapPath}`;
      console.log(`[CinemaCity] Fetching sitemap via CF Proxy (full): ${targetUrl}`);
      const response = yield fetchWithTimeout(targetUrl, {
        timeout: FETCH_TIMEOUT,
        headers: { "User-Agent": USER_AGENT }
      });
      if (!response.ok) throw new Error(`Proxy HTTP ${response.status}`);
      const xml = yield response.text();
      const entries = parseSitemapEntries(xml);
      sitemapCache = { entries, expiresAt: Date.now() + SITEMAP_CACHE_MS };
      console.log(`[CinemaCity] Sitemap catalog loaded: ${entries.length} entries`);
      return entries;
    } else {
      const response = yield fetchWithTimeout(SITEMAP_URL, {
        timeout: FETCH_TIMEOUT,
        headers: { "User-Agent": USER_AGENT }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const xml = yield response.text();
      const entries = parseSitemapEntries(xml);
      sitemapCache = {
        entries,
        expiresAt: Date.now() + SITEMAP_CACHE_MS
      };
      console.log(`[CinemaCity] Sitemap catalog loaded: ${entries.length} entries`);
      return entries;
    }
  });
}
function scoreSitemapEntry(entry, expectedTitles, expectedYear) {
  let bestScore = 0;
  for (const title of expectedTitles) {
    const normalized = normalizeTitle(title);
    const compact = compactTitle(title);
    if (!normalized || !compact) continue;
    let score = 0;
    if (entry.normalizedTitle === normalized || entry.compactTitle === compact) {
      score = 1e3;
    } else if (entry.normalizedTitle.startsWith(normalized) || normalized.startsWith(entry.normalizedTitle)) {
      score = 500;
    } else if (entry.compactTitle.includes(compact) || compact.includes(entry.compactTitle)) {
      score = 420;
    } else {
      const expectedTokens = getSignificantTokens(title);
      if (expectedTokens.length > 0 && entry.tokens.length > 0) {
        let hits = 0;
        const entryTokenSet = new Set(entry.tokens);
        for (const token of expectedTokens) {
          if (entryTokenSet.has(token)) hits++;
        }
        const coverage = hits / expectedTokens.length;
        const extraTokens = Math.max(0, entry.tokens.length - expectedTokens.length);
        score = coverage * 300 - extraTokens * 20 - Math.abs(entry.tokens.length - expectedTokens.length) * 2;
      }
    }
    if (expectedYear && entry.year) {
      score += entry.year === expectedYear ? 50 : -Math.abs(entry.year - expectedYear) * 3;
    }
    bestScore = Math.max(bestScore, score);
  }
  return bestScore;
}
function extractImdbIdFromHtml(html) {
  const matches = String(html || "").match(/\btt\d{5,}\b/gi) || [];
  for (const match of matches) {
    if (/^tt\d{5,}$/i.test(match)) {
      return match.toLowerCase();
    }
  }
  return null;
}
function verifyCandidateImdb(candidateUrl, expectedImdbId) {
  return __async(this, null, function* () {
    const normalizedExpected = String(expectedImdbId || "").trim().toLowerCase();
    if (!/^tt\d{5,}$/.test(normalizedExpected)) {
      return null;
    }
    try {
      const html = yield fetchViaWorker(candidateUrl);
      const imdbId = extractImdbIdFromHtml(html);
      if (imdbId) {
        console.log(`[CinemaCity] IMDb check ${candidateUrl}: ${imdbId}`);
      }
      return imdbId;
    } catch (e) {
      const status = getHttpStatusFromError(e);
      if (status !== 403 && status !== 503 && !isCloudflareBlockedError(e)) {
        console.error(`[CinemaCity] IMDb check error for ${candidateUrl}:`, e);
      }
      return null;
    }
  });
}
function searchBySitemap(id, providerType, providerContext = null) {
  return __async(this, null, function* () {
    const expectedImdbId = /^tt\d{5,}$/i.test(String(id || "").trim()) ? String(id).trim().toLowerCase() : null;
    const metadata = yield getTmdbMetadata(id, providerType);
    const expectedTitles = Array.from(new Set([
      metadata == null ? void 0 : metadata.title,
      metadata == null ? void 0 : metadata.name,
      metadata == null ? void 0 : metadata.original_title,
      metadata == null ? void 0 : metadata.original_name
    ].filter(Boolean)));
    if (expectedTitles.length === 0) {
      return null;
    }
    const expectedYear = extractYearFromMetadata(metadata);
    const expectedKind = providerType === "movie" ? "movies" : "tv-series";
    let entries;
    try {
      entries = yield fetchSitemapEntries(providerContext);
    } catch (e) {
      const status = getHttpStatusFromError(e);
      if (status === 403 || status === 404 || status === 503 || isCloudflareBlockedError(e)) {
        console.warn(`[CinemaCity] Sitemap fetch failed: HTTP ${status || "unknown/Cloudflare"}`);
      } else {
        console.warn(`[CinemaCity] Sitemap fetch failed: ${e.message || e}`);
      }
      return null;
    }
    let bestEntry = null;
    let bestScore = -Infinity;
    const ranked = [];
    for (const entry of entries) {
      if (entry.kind !== expectedKind) continue;
      const score = scoreSitemapEntry(entry, expectedTitles, expectedYear);
      if (score >= 250) {
        ranked.push({ entry, score });
      }
      if (score > bestScore) {
        bestScore = score;
        bestEntry = entry;
      }
    }
    if (!bestEntry || bestScore < 250) {
      console.log(`[CinemaCity] Sitemap no confident match for ${expectedTitles.join(" / ")} (best=${Math.round(bestScore)})`);
      return null;
    }
    if (expectedImdbId) {
      ranked.sort((a, b) => b.score - a.score);
      const candidatesToVerify = ranked.slice(0, 3);
      for (const candidate of candidatesToVerify) {
        const candidateImdbId = yield verifyCandidateImdb(candidate.entry.url, expectedImdbId);
        if (candidateImdbId === expectedImdbId) {
          console.log(`[CinemaCity] Sitemap IMDb verified: ${expectedTitles[0]} -> ${candidate.entry.url}`);
          return {
            url: candidate.entry.url,
            title: expectedTitles[0] || candidate.entry.title
          };
        }
        if (candidateImdbId && candidateImdbId !== expectedImdbId) {
          console.log(`[CinemaCity] Sitemap IMDb mismatch: ${candidate.entry.url} has ${candidateImdbId}, expected ${expectedImdbId}`);
          continue;
        }
      }
      const isHighConfidence = bestScore >= 950;
      if (!isHighConfidence) {
        console.log(`[CinemaCity] Sitemap match not IMDb verified for ${expectedTitles.join(" / ")} (best=${Math.round(bestScore)})`);
        return null;
      }
    }
    console.log(`[CinemaCity] Sitemap match: ${expectedTitles[0]} -> ${bestEntry.url} [score=${Math.round(bestScore)}]`);
    return {
      url: bestEntry.url,
      title: expectedTitles[0] || bestEntry.title
    };
  });
}
function getTmdbMetadata(id, providerType) {
  return __async(this, null, function* () {
    try {
      let metadataUrl = null;
      const normalizedId = String(id || "").trim();
      const normalizedType = providerType === "movie" ? "movie" : "tv";
      if (/^tt\d+$/i.test(normalizedId)) {
        metadataUrl = `https://api.themoviedb.org/3/find/${encodeURIComponent(normalizedId)}?api_key=${TMDB_API_KEY}&external_source=imdb_id&language=en-US`;
      } else if (/^\d+$/.test(normalizedId)) {
        metadataUrl = `https://api.themoviedb.org/3/${normalizedType}/${normalizedId}?api_key=${TMDB_API_KEY}&language=en-US`;
      }
      if (!metadataUrl) return null;
      const response = yield fetchWithTimeout(metadataUrl, { timeout: FETCH_TIMEOUT });
      if (!response.ok) return null;
      const payload = yield response.json();
      if (/^tt\d+$/i.test(normalizedId)) {
        const results = normalizedType === "movie" ? payload == null ? void 0 : payload.movie_results : payload == null ? void 0 : payload.tv_results;
        return Array.isArray(results) && results.length > 0 ? results[0] : null;
      }
      return payload;
    } catch (e) {
      console.error("[CinemaCity] TMDB metadata error:", e);
      return null;
    }
  });
}
function getIdsFromKitsu(kitsuId, season, episode, providerContext = null) {
  return __async(this, null, function* () {
    try {
      if (!kitsuId) return null;
      const params = new URLSearchParams();
      const parsedEpisode = Number.parseInt(String(episode || ""), 10);
      const parsedSeason = Number.parseInt(String(season || ""), 10);
      params.set("ep", Number.isInteger(parsedEpisode) && parsedEpisode > 0 ? String(parsedEpisode) : "1");
      if (Number.isInteger(parsedSeason) && parsedSeason >= 0) {
        params.set("s", String(parsedSeason));
      }
      const mappingLanguage = getMappingLanguage(providerContext);
      if (mappingLanguage) {
        params.set("lang", mappingLanguage);
      }
      const url = `${getMappingApiUrl()}/kitsu/${encodeURIComponent(String(kitsuId).trim())}?${params.toString()}`;
      const response = yield fetchWithTimeout(url, { timeout: FETCH_TIMEOUT });
      if (!response.ok) return null;
      const payload = yield response.json();
      const ids = payload && payload.mappings && payload.mappings.ids ? payload.mappings.ids : {};
      const tmdbEpisode = payload && payload.mappings && (payload.mappings.tmdb_episode || payload.mappings.tmdbEpisode) || payload && (payload.tmdb_episode || payload.tmdbEpisode) || null;
      const tmdbId = ids && /^\d+$/.test(String(ids.tmdb || "").trim()) ? String(ids.tmdb).trim() : null;
      const imdbId = ids && /^tt\d+$/i.test(String(ids.imdb || "").trim()) ? String(ids.imdb).trim() : null;
      const mappedSeason = Number.parseInt(String(
        tmdbEpisode && (tmdbEpisode.season || tmdbEpisode.seasonNumber || tmdbEpisode.season_number) || ""
      ), 10);
      const mappedEpisode = Number.parseInt(String(
        tmdbEpisode && (tmdbEpisode.episode || tmdbEpisode.episodeNumber || tmdbEpisode.episode_number) || ""
      ), 10);
      const rawEpisodeNumber = Number.parseInt(String(
        tmdbEpisode && (tmdbEpisode.rawEpisodeNumber || tmdbEpisode.raw_episode_number || tmdbEpisode.rawEpisode) || ""
      ), 10);
      return {
        tmdbId,
        imdbId,
        mappedSeason: Number.isInteger(mappedSeason) && mappedSeason > 0 ? mappedSeason : null,
        mappedEpisode: Number.isInteger(mappedEpisode) && mappedEpisode > 0 ? mappedEpisode : null,
        rawEpisodeNumber: Number.isInteger(rawEpisodeNumber) && rawEpisodeNumber > 0 ? rawEpisodeNumber : null
      };
    } catch (e) {
      console.error("[CinemaCity] Kitsu mapping error:", e);
      return null;
    }
  });
}
function parseCompositeSeriesId(rawId, season, episode) {
  const parsed = {
    normalizedId: String(rawId || "").trim(),
    season: Number.isInteger(season) ? season : Number.parseInt(season, 10) || 1,
    episode: Number.isInteger(episode) ? episode : Number.parseInt(episode, 10) || 1
  };
  const match = parsed.normalizedId.match(/^(tt\d+|\d+|tmdb:\d+):(\d+):(\d+)$/i);
  if (match) {
    parsed.normalizedId = match[1];
    parsed.season = Number.parseInt(match[2], 10) || parsed.season;
    parsed.episode = Number.parseInt(match[3], 10) || parsed.episode;
  }
  return parsed;
}
function buildDownloadUrl(fileVal, movieTitle) {
  const baseEnd = fileVal.indexOf("/public_files/");
  if (baseEnd === -1) return null;
  const cdnBase = fileVal.substring(0, baseEnd + "/public_files/".length);
  const rest = fileVal.substring(baseEnd + "/public_files/".length);
  const parts = rest.split(",");
  const video = parts.find((p) => p.includes("1080p") && p.endsWith(".mp4")) || parts.find((p) => p.endsWith(".mp4"));
  const itaAudio = parts.find((p) => /italian|italiano/i.test(p) && p.endsWith(".m4a"));
  if (!itaAudio || !video) return null;
  const qualityTag = (() => {
    const res = (video.match(/(\d{3,4}p)/i) || [])[1] || "";
    const src = (video.match(/web-?dl|bluray|hdtv|dvdrip|brrip|ts|tc|cam|webrip|hdrip/i) || [])[0] || "";
    const lang = (itaAudio.match(/italian|italiano/i) || [])[0] || "Italian";
    return [res, src.toUpperCase(), lang.charAt(0).toUpperCase() + lang.slice(1)].filter(Boolean).join(".");
  })();
  const m3u8Entry = parts.find((p) => p.includes(".m3u8"));
  return cdnBase + rest + (m3u8Entry ? "" : ".urlset/master.m3u8");
}
function extractStreamFromAtob(html, movieTitle, season, episode) {
  const atobRegex = /atob\s*\(\s*['"]([^"']{20,})['"]\s*\)/gi;
  let match;
  while ((match = atobRegex.exec(html)) !== null) {
    try {
      const decoded = base64Decode(match[1]);
      if (!decoded || decoded.length < 20) continue;
      const jsonMatch = decoded.match(new RegExp("file\\s*:\\s*'(\\[.*?\\])'", "s"));
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            if (parsed[0].folder && Array.isArray(parsed[0].folder)) {
              const seasonIdx = (season || 1) - 1;
              const s = parsed[seasonIdx];
              if (s && s.folder) {
                const epIdx = (episode || 1) - 1;
                const ep = s.folder[epIdx];
                if (ep && ep.file) {
                  const dlUrl = buildDownloadUrl(ep.file, movieTitle);
                  if (dlUrl) return dlUrl;
                  return ep.file;
                }
              }
            }
            const fileVal = parsed[0].file;
            if (fileVal && fileVal.startsWith("http")) {
              const dlUrl = buildDownloadUrl(fileVal, movieTitle);
              if (dlUrl) return dlUrl;
              return fileVal;
            }
          }
        } catch (e) {
        }
      }
    } catch (e) {
    }
  }
  return null;
}
function extractDownloadLinks(html) {
  const links = [];
  const anchorRegex = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1].trim();
    const innerText = match[2].replace(/<[^>]+>/g, "").trim();
    if (!/\.(mp4|m3u8|mkv|avi|mov|webm)([?#].*)?$/i.test(href)) continue;
    if (href.length < 10) continue;
    links.push({ url: href, text: innerText.toLowerCase() });
  }
  return links;
}
function resolveUrl(base, relative) {
  try {
    return new URL(relative, base).toString();
  } catch (e) {
    return relative;
  }
}
function getStreams(id, type, season, episode, providerContext = null) {
  return __async(this, null, function* () {
    const parsedRequest = parseCompositeSeriesId(id, season, episode);
    id = parsedRequest.normalizedId;
    season = parsedRequest.season;
    episode = parsedRequest.episode;
    let imdbId = String(id || "").trim();
    const providerType = type === "tv" || type === "series" || type === "anime" ? "tv" : "movie";
    const contextTmdbId = providerContext && /^\d+$/.test(String(providerContext.tmdbId || "")) ? String(providerContext.tmdbId) : null;
    const contextImdbId = providerContext && /^tt\d+$/i.test(String(providerContext.imdbId || "")) ? String(providerContext.imdbId) : null;
    const contextKitsuId = providerContext && /^\d+$/.test(String(providerContext.kitsuId || "")) ? String(providerContext.kitsuId) : null;
    const shouldIncludeSeasonHintForKitsu = providerContext && providerContext.seasonProvided === true;
    if (imdbId.startsWith("kitsu:") || contextKitsuId) {
      const kitsuId = contextKitsuId || ((imdbId.match(/^kitsu:(\d+)/i) || [])[1] || null);
      const seasonHintForKitsu = shouldIncludeSeasonHintForKitsu ? season : null;
      const mapped = kitsuId ? yield getIdsFromKitsu(kitsuId, seasonHintForKitsu, episode, providerContext) : null;
      if (mapped) {
        if (mapped.imdbId) {
          imdbId = mapped.imdbId;
        } else if (mapped.tmdbId) {
          imdbId = mapped.tmdbId;
        }
        if (mapped.mappedSeason && mapped.mappedEpisode) {
          season = mapped.mappedSeason;
          episode = mapped.mappedEpisode;
        } else if (mapped.rawEpisodeNumber) {
          episode = mapped.rawEpisodeNumber;
        }
      }
    }
    if (!imdbId.startsWith("tt") && contextImdbId) {
      imdbId = contextImdbId;
    } else if (!/^\d+$/.test(imdbId) && contextTmdbId) {
      imdbId = contextTmdbId;
    }
    if (!imdbId.startsWith("tt")) {
      if (providerContext && providerContext.imdbId && providerContext.imdbId.startsWith("tt")) {
        imdbId = providerContext.imdbId;
      } else {
        try {
          const tmdbId = imdbId.replace(/\D/g, "");
          if (tmdbId) {
            let externalUrl = "";
            if (providerType === "movie") {
              externalUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`;
            } else {
              externalUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
            }
            const response = yield fetchWithTimeout(externalUrl, { timeout: FETCH_TIMEOUT });
            if (response.ok) {
              const data = yield response.json();
              if (data.imdb_id) {
                imdbId = data.imdb_id;
              }
            }
          }
        } catch (e) {
          console.error("[CinemaCity] TMDB to IMDb resolution error:", e);
        }
      }
    }
    if (!imdbId.startsWith("tt")) {
      return [];
    }
    try {
      let searchResult = yield searchBySitemap(imdbId, providerType, providerContext);
      if (!searchResult || !searchResult.url) {
        return [];
      }
      const movieUrl = searchResult.url;
      const movieTitle = (searchResult.title || imdbId).replace(/\s*\(.*?\)\s*/g, "").trim();
      const title = type === "tv" || type === "series" ? `${movieTitle} ${season}x${episode}` : movieTitle;
      let html;
      try {
        html = yield fetchViaWorker(movieUrl);
      } catch (e) {
        console.warn(`[CinemaCity] Worker fetch failed: ${e.message}`);
        return [];
      }
      if (html.length < 500 || html.includes("Just a moment") || html.includes("admin") && html.includes("Unlimited")) {
        console.warn(`[CinemaCity] Page blocked or empty (${html.length} chars)`);
        return [];
      }
      const links = extractDownloadLinks(html);
      if (links.length === 0) {
        const useSeason = providerType === "tv" ? season : null;
        const useEpisode = providerType === "tv" ? episode : null;
        const atobUrl = extractStreamFromAtob(html, movieTitle, useSeason, useEpisode);
        if (atobUrl) links.push({ url: atobUrl, text: "" });
      }
      let selectedUrl = null;
      if (links.length === 0) {
        console.log(`[CinemaCity] No Italian audio found, skipping`);
        return [];
      }
      for (const link of links) {
        const text = link.text;
        if (text.includes("ita") || text.includes("italian") || text.includes("italiano")) {
          selectedUrl = link.url;
          break;
        }
      }
      if (!selectedUrl) {
        for (const link of links) {
          if (link.text.includes("eng") || link.text.includes("sub")) continue;
          selectedUrl = link.url;
          break;
        }
      }
      if (!selectedUrl) selectedUrl = links[0].url;
      const streamUrl = resolveUrl(movieUrl, selectedUrl);
      console.log(`[CinemaCity] Direct stream: ${streamUrl}`);
      const result = {
        name: "CinemaCity",
        title,
        url: streamUrl,
        quality: "1080p",
        type: "hls",
        behaviorHints: { notWebReady: true },
        headers: {
          "Referer": "https://cinemacity.cc/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
        }
      };
      return [formatStream(result, "CinemaCity")];
    } catch (e) {
      console.error("[CinemaCity] Error:", e);
      return [];
    }
  });
}
module.exports = { getStreams };
