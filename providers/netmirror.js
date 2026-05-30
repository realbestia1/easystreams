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

// src/quality_helper.js
var require_quality_helper = __commonJS({
  "src/quality_helper.js"(exports2, module2) {
    var { createTimeoutSignal } = require_fetch_helper();
    var USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
    function checkQualityFromPlaylist(_0) {
      return __async(this, arguments, function* (url, headers = {}) {
        try {
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
            if (!text.startsWith("#EXTM3U")) return null;
            const quality = checkQualityFromText2(text);
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
          const finalHeaders = __spreadValues({}, headers);
          if (!finalHeaders["User-Agent"]) finalHeaders["User-Agent"] = USER_AGENT;
          const timeoutConfig = createTimeoutSignal(3e3);
          try {
            const response = yield fetch(url, { headers: finalHeaders, signal: timeoutConfig.signal });
            if (!response.ok) return false;
            const text = yield response.text();
            if (!text.startsWith("#EXTM3U")) return false;
            const hasAudioTags = /#EXT-X-MEDIA:TYPE=AUDIO/i.test(text);
            if (!hasAudioTags) return true;
            return /#EXT-X-MEDIA:TYPE=AUDIO.*(?:LANGUAGE="it"|LANGUAGE="ita"|NAME="Italian"|NAME="Ita")/i.test(text);
          } finally {
            if (typeof timeoutConfig.cleanup === "function") timeoutConfig.cleanup();
          }
        } catch (e) {
          return false;
        }
      });
    }
    function checkQualityFromText2(text) {
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
    module2.exports = { checkQualityFromPlaylist, getQualityFromUrl, checkQualityFromText: checkQualityFromText2, checkItalianAudioInPlaylist };
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
      if (language === "Italian") {
        language = "\u{1F1EE}\u{1F1F9}";
      } else if (stream.name && (stream.name.includes("SUB ITA") || stream.name.includes("SUB"))) {
        language = "\u{1F1EF}\u{1F1F5} \u{1F1EE}\u{1F1F9}";
      } else if (stream.title && (stream.title.includes("SUB ITA") || stream.title.includes("SUB"))) {
        language = "\u{1F1EF}\u{1F1F5} \u{1F1EE}\u{1F1F9}";
      } else if (language === void 0 || language === null) {
        language = "";
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

// src/netmirror/index.js
var { fetchWithTimeout } = require_fetch_helper();
var { checkQualityFromText } = require_quality_helper();
var { formatStream } = require_formatter();
var TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
var TMDB_BASE_URL = "https://api.themoviedb.org/3";
var CONFIG_URL = "https://raw.githubusercontent.com/SaurabhKaperwan/Utils/refs/heads/main/urls.json";
var FALLBACK_API_BASE = "https://tv.imgcdn.kim/newtv";
var FETCH_TIMEOUT = 12e3;
var PROBE_TIMEOUT = 5e3;
var SERVICES = [
  { code: "nf", name: "Netflix" },
  { code: "pv", name: "PrimeVideo" },
  { code: "hs", name: "Hotstar" }
];
var LANG_ALIASES = {
  it: ["italian", "italiano", "ita"],
  en: ["english", "eng", "en-us", "en-gb", "original"],
  es: ["spanish", "espanol", "espanol", "spa", "es-419", "es-la", "latin"],
  fr: ["french", "francais", "fre", "fra"],
  de: ["german", "deutsch", "ger", "deu"],
  pt: ["portuguese", "portugues", "por", "pt-br", "pt-pt", "brazilian"],
  hi: ["hindi", "hin"],
  ta: ["tamil", "tam"],
  te: ["telugu", "tel"],
  ja: ["japanese", "jpn", "ja-jp"],
  ko: ["korean", "kor", "ko-kr"],
  ar: ["arabic", "ara"],
  tr: ["turkish", "turkce", "tur"],
  ru: ["russian", "rus"],
  pl: ["polish", "polski", "pol"],
  nl: ["dutch", "nederlands", "nld", "nl-nl"]
};
var cachedApiBase = null;
function normalizeType(type) {
  const normalized = String(type || "").toLowerCase();
  if (normalized === "series" || normalized === "tv") return "tv";
  if (normalized === "movie") return "movie";
  return null;
}
function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function unique(values) {
  return [...new Set(values.map((v) => String(v || "").trim()).filter(Boolean))];
}
function normalizeLangToken(token) {
  const value = String(token || "").trim().toLowerCase();
  if (!value) return null;
  const prefix = value.split(/[-_]/)[0];
  if (LANG_ALIASES[value]) return value;
  if (LANG_ALIASES[prefix]) return prefix;
  for (const code of Object.keys(LANG_ALIASES)) {
    if (LANG_ALIASES[code].some((alias) => value === alias || value.includes(alias))) return code;
  }
  return null;
}
function parseAudioLanguages(m3u8Text) {
  const languages = /* @__PURE__ */ new Set();
  if (!m3u8Text) return languages;
  const re = /#EXT-X-MEDIA:([^\n\r]+)/gi;
  let match;
  while ((match = re.exec(m3u8Text)) !== null) {
    const attrs = match[1];
    if (!/TYPE=AUDIO/i.test(attrs)) continue;
    const language = (attrs.match(/LANGUAGE="([^"]+)"/i) || [])[1];
    const name = (attrs.match(/NAME="([^"]+)"/i) || [])[1];
    const code = normalizeLangToken(language) || normalizeLangToken(name);
    if (code) languages.add(code);
  }
  return languages;
}
function fetchJson(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const response = yield fetchWithTimeout(url, __spreadProps(__spreadValues({}, options), { timeout: options.timeout || FETCH_TIMEOUT }));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return yield response.json();
  });
}
function fetchText(url, headers) {
  return __async(this, null, function* () {
    try {
      const response = yield fetchWithTimeout(url, { headers, timeout: PROBE_TIMEOUT });
      if (!response.ok) return "";
      return yield response.text();
    } catch (e) {
      return "";
    }
  });
}
function getApiBase() {
  return __async(this, null, function* () {
    if (cachedApiBase) return cachedApiBase;
    try {
      const data = yield fetchJson(CONFIG_URL, { timeout: FETCH_TIMEOUT });
      cachedApiBase = data && data.nfmirror ? data.nfmirror : FALLBACK_API_BASE;
    } catch (e) {
      cachedApiBase = FALLBACK_API_BASE;
    }
    return cachedApiBase;
  });
}
function resolveTmdbId(id, mediaType, providerContext) {
  return __async(this, null, function* () {
    const contextTmdbId = providerContext && /^\d+$/.test(String(providerContext.tmdbId || "")) ? String(providerContext.tmdbId) : null;
    if (contextTmdbId) return contextTmdbId;
    const raw = String(id || "").trim();
    if (/^tmdb:\d+$/i.test(raw)) return raw.split(":")[1];
    if (/^\d+$/.test(raw)) return raw;
    const contextImdbId = providerContext && /^tt\d+$/i.test(String(providerContext.imdbId || "")) ? String(providerContext.imdbId) : null;
    const imdbId = /^tt\d+$/i.test(raw) ? raw : contextImdbId;
    if (!imdbId) return null;
    try {
      const url = `${TMDB_BASE_URL}/find/${encodeURIComponent(imdbId)}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
      const data = yield fetchJson(url);
      const results = mediaType === "tv" ? data.tv_results : data.movie_results;
      const fallback = mediaType === "tv" ? data.movie_results : data.tv_results;
      const item = Array.isArray(results) && results[0] || Array.isArray(fallback) && fallback[0] || null;
      return item && item.id ? String(item.id) : null;
    } catch (e) {
      return null;
    }
  });
}
function getMediaDetails(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const endpoint = mediaType === "tv" ? "tv" : "movie";
    const url = `${TMDB_BASE_URL}/${endpoint}/${encodeURIComponent(tmdbId)}?api_key=${TMDB_API_KEY}&language=en-US`;
    return yield fetchJson(url);
  });
}
function getCandidateTitles(media, mediaType) {
  if (mediaType === "tv") {
    return unique([media.name, media.original_name]);
  }
  return unique([media.title, media.original_title]);
}
function buildServiceHeaders(service) {
  return {
    ott: service.code,
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0 /OS.GatuNewTV v1.0",
    "x-requested-with": "NetmirrorNewTV v1.0"
  };
}
function findTitleMatch(searchResults, title) {
  const target = normalizeText(title);
  if (!target) return null;
  let match = searchResults.find((item) => normalizeText(item && item.t) === target);
  if (match) return match;
  return searchResults.find((item) => {
    const candidate = normalizeText(item && item.t);
    return candidate && (candidate.includes(target) || target.includes(candidate));
  }) || null;
}
function searchService(apiBase, service, titles) {
  return __async(this, null, function* () {
    const headers = buildServiceHeaders(service);
    for (const title of titles) {
      const searchUrl = `${apiBase}/search.php?s=${encodeURIComponent(title)}`;
      const searchJson = yield fetchJson(searchUrl, { headers });
      const results = Array.isArray(searchJson && searchJson.searchResult) ? searchJson.searchResult : [];
      const match = findTitleMatch(results, title);
      if (match && match.id) return { id: match.id, title, headers };
    }
    return null;
  });
}
function resolveEpisodeId(apiBase, netId, headers, season, episode) {
  return __async(this, null, function* () {
    const postData = yield fetchJson(`${apiBase}/post.php?id=${encodeURIComponent(netId)}`, { headers });
    const seasons = Array.isArray(postData && postData.season) ? postData.season : [];
    const seasonToken = `Season ${Number.parseInt(String(season || 1), 10) || 1}`;
    const seasonEntry = seasons.find((item) => item && item.id && String(item.s || "").includes(seasonToken));
    if (!seasonEntry) return null;
    const wantedEpisode = String(Number.parseInt(String(episode || 1), 10) || 1);
    let page = 1;
    while (page < 10) {
      const epData = yield fetchJson(`${apiBase}/episodes.php?id=${encodeURIComponent(seasonEntry.id)}&page=${page}`, { headers });
      const list = Array.isArray(epData && epData.episodes) ? epData.episodes : [];
      const match = list.find((item) => item && item.id && String(item.ep || "") === wantedEpisode);
      if (match) return match.id;
      if (Number.parseInt(String(epData && epData.nextPageShow || "0"), 10) !== 1) break;
      page++;
    }
    return null;
  });
}
function extractServiceStreams(apiBase, service, titles, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const found = yield searchService(apiBase, service, titles);
      if (!found) return [];
      let finalId = found.id;
      if (mediaType === "tv") {
        finalId = yield resolveEpisodeId(apiBase, found.id, found.headers, season, episode);
        if (!finalId) return [];
      }
      const playerData = yield fetchJson(`${apiBase}/player.php?id=${encodeURIComponent(finalId)}`, { headers: found.headers });
      if (!playerData || !playerData.video_link) return [];
      const referer = playerData.referer || `${apiBase}/`;
      const playbackHeaders = {
        Referer: referer,
        "User-Agent": found.headers["user-agent"]
      };
      const probeHeaders = {
        Referer: referer,
        "User-Agent": "Mozilla/5.0 (Android) ExoPlayer",
        Accept: "*/*",
        "Accept-Encoding": "identity",
        Connection: "keep-alive"
      };
      const masterText = yield fetchText(playerData.video_link, probeHeaders);
      if (!masterText || !/#EXT-X-STREAM-INF/i.test(masterText)) {
        console.warn(`[NetMirror] ${service.name}: invalid playlist (no video streams), skipping`);
        return [];
      }
      const audioLanguages = parseAudioLanguages(masterText);
      const hasItalian = audioLanguages.has("it");
      const quality = checkQualityFromText(masterText) || "720p";
      return [{
        name: `NetMirror - ${service.name}`,
        title: titles[0] || "Stream",
        url: playerData.video_link,
        quality,
        type: "hls",
        language: hasItalian ? "Italian" : "",
        headers: playbackHeaders,
        behaviorHints: { notWebReady: true },
        provider: "netmirror"
      }];
    } catch (e) {
      console.warn(`[NetMirror] ${service.name} failed: ${e.message}`);
      return [];
    }
  });
}
function dedupeStreams(streams) {
  const seen = /* @__PURE__ */ new Set();
  return streams.filter((stream) => {
    const key = stream && stream.url;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function getStreams(id, type, season, episode, providerContext = null) {
  return __async(this, null, function* () {
    const mediaType = normalizeType(type);
    if (mediaType !== "movie" && mediaType !== "tv") return [];
    const tmdbId = yield resolveTmdbId(id, mediaType, providerContext);
    if (!tmdbId) return [];
    try {
      const media = yield getMediaDetails(tmdbId, mediaType);
      const titles = getCandidateTitles(media, mediaType);
      if (titles.length === 0) return [];
      const apiBase = yield getApiBase();
      const results = yield Promise.all(
        SERVICES.map((service) => extractServiceStreams(apiBase, service, titles, mediaType, season, episode))
      );
      const streams = dedupeStreams(results.flat());
      const italianStream = streams.find((s) => s.language === "Italian");
      if (italianStream) return [formatStream(italianStream, "NetMirror")].filter(Boolean);
      if (streams.length > 0) return [formatStream(streams[0], "NetMirror")].filter(Boolean);
      return [];
    } catch (e) {
      console.error("[NetMirror] Error:", e.message);
      return [];
    }
  });
}
module.exports = { getStreams };
