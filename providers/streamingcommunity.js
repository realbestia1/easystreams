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
    function normalizeEpisodeTemplate(value) {
      return String(value || "").replace(
        /\b(\d{1,3})[xX](\d{1,3})\b/g,
        (_, season, episode) => `S${season.padStart(2, "0")}E${episode.padStart(2, "0")}`
      ).replace(
        /\bS(\d{1,3})\s*E(\d{1,3})\b/gi,
        (_, season, episode) => `S${season.padStart(2, "0")}E${episode.padStart(2, "0")}`
      );
    }
    function formatStream2(stream, providerName) {
      let quality = stream.quality || "";
      if (quality === "2160p") quality = "\u{1F525}4K UHD";
      else if (quality === "1440p") quality = "\u2728 QHD";
      else if (quality === "1080p") quality = "\u{1F680} FHD";
      else if (quality === "720p") quality = "\u{1F4BF} HD";
      else if (quality === "576p" || quality === "480p" || quality === "360p" || quality === "240p") quality = "\u{1F4A9} Low Quality";
      else if (!quality || ["auto", "unknown", "unknow"].includes(String(quality).toLowerCase())) quality = "\u{1F4BF} HD";
      const normalizedTitle = normalizeEpisodeTemplate(stream.title || "Stream");
      let title = `\u{1F4C1} ${normalizedTitle}`;
      let language = stream.language;
      if (language === "Italian") {
        language = "\u{1F1EE}\u{1F1F9}";
      } else if (stream.name && (stream.name.includes("SUB ITA") || stream.name.includes("SUB"))) {
        language = "\u{1F1EF}\u{1F1F5} \u{1F1EE}\u{1F1F9}";
      } else if (normalizedTitle.includes("SUB ITA") || normalizedTitle.includes("SUB")) {
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
      let finalTitle = `\u{1F4C1} ${normalizedTitle}`;
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
        originalTitle: normalizedTitle,
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
    var USER_AGENT2 = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
    function checkQualityFromPlaylist(_0) {
      return __async(this, arguments, function* (url, headers = {}) {
        try {
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
          if (!finalHeaders["User-Agent"]) finalHeaders["User-Agent"] = USER_AGENT2;
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

// src/streamingcommunity/index.js
function getStreamingCommunityBaseUrl() {
  return "https://cromosino.space";
}
var { formatStream } = require_formatter();
require_fetch_helper();
var { checkQualityFromText } = require_quality_helper();
var STREAMINGCOMMUNITY_PROXY = typeof process !== "undefined" && process.env.STREAMINGCOMMUNITY_PROXY || "";
var ProxyAgent = null;
try {
  ProxyAgent = require("undici").ProxyAgent;
} catch (_) {
  ProxyAgent = null;
}
var SC_BASE = "https://streamingcommunityz.team";
var _sitemapCache = null;
var _sitemapPromise = null;
function getSitemap() {
  return __async(this, null, function* () {
    if (_sitemapCache) return _sitemapCache;
    if (_sitemapPromise) return yield _sitemapPromise;
    _sitemapPromise = (() => __async(null, null, function* () {
      try {
        const r = yield fetch(`${SC_BASE}/titles_it_sitemap.xml`);
        if (!r.ok) return [];
        const xml = yield r.text();
        const entries = [];
        const re = /titles\/(\d+)-([^<]+)/g;
        let m;
        while (m = re.exec(xml)) entries.push({ id: Number(m[1]), slug: m[2] });
        _sitemapCache = entries;
        return entries;
      } catch (e) {
        console.warn("[StreamingCommunity] Sitemap fetch error:", e.message);
        return [];
      } finally {
        _sitemapPromise = null;
      }
    }))();
    return yield _sitemapPromise;
  });
}
function findInSitemap(entries, name) {
  if (!name) return [];
  const cname = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (cname.length < 2) return [];
  const exact = [];
  const prefix = [];
  for (const e of entries) {
    const cslug = e.slug.replace(/[^a-z0-9]/g, "");
    if (cslug === cname) exact.push(e);
    else if (cslug.startsWith(cname) || cname.startsWith(cslug)) prefix.push(e);
  }
  return [...exact, ...prefix];
}
function scrapeTitle(id, slug) {
  return __async(this, null, function* () {
    var _a, _b, _c;
    try {
      const r = yield fetch(`${SC_BASE}/it/titles/${id}${slug ? "-" + slug : ""}`);
      if (!r.ok) return null;
      const html = yield r.text();
      const m = html.match(/data-page="({.+?})"/);
      if (!m) return null;
      const page = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
      const t = (_a = page == null ? void 0 : page.props) == null ? void 0 : _a.title;
      if (!t) return null;
      const ep = (_c = (_b = page == null ? void 0 : page.props) == null ? void 0 : _b.loadedSeason) == null ? void 0 : _c.episodes;
      return {
        id: t.id,
        slug: t.slug,
        name: t.name,
        type: t.type,
        tmdb_id: t.tmdb_id,
        imdb_id: t.imdb_id,
        episodes: (ep == null ? void 0 : ep.map((e) => ({ id: e.id, number: e.number, name: e.name }))) || null
      };
    } catch (e) {
      return null;
    }
  });
}
function getCamEmbed(titleId, episodeId) {
  return __async(this, null, function* () {
    try {
      let url = `${SC_BASE}/it/iframe/${titleId}`;
      if (episodeId) url += `?episode_id=${episodeId}`;
      const r = yield fetch(url);
      if (!r.ok) return null;
      const m = (yield r.text()).match(/src="(https:\/\/vixcloud\.co\/embed\/[^"]+)"/);
      return m ? m[1].replace(/&amp;/g, "&") : null;
    } catch (e) {
      return null;
    }
  });
}
function resolveSczEmbed(metadata, normalizedType, season, episode, rawId) {
  return __async(this, null, function* () {
    try {
      const entries = yield getSitemap();
      if (!entries.length) return null;
      const titlesToTry = [metadata == null ? void 0 : metadata.title, metadata == null ? void 0 : metadata.name, metadata == null ? void 0 : metadata.original_title, metadata == null ? void 0 : metadata.original_name].filter(Boolean);
      const candidateMatches = [];
      for (const t of titlesToTry) {
        for (const m of findInSitemap(entries, t)) {
          if (!candidateMatches.some((c) => c.id === m.id)) candidateMatches.push(m);
        }
      }
      const inputIsTmdb = /^\d+$/.test(String(rawId).replace(/^tmdb:/i, ""));
      const targetTmdb = (metadata == null ? void 0 : metadata.id) || (inputIsTmdb ? String(rawId).replace(/^tmdb:/i, "") : null);
      const targetImdb = (metadata == null ? void 0 : metadata.imdb_id) || (!inputIsTmdb ? String(rawId) : null);
      let foundTitle = null;
      for (const m of candidateMatches.slice(0, 8)) {
        const scraped = yield scrapeTitle(m.id, m.slug);
        if (!scraped) continue;
        const matchTmdb = targetTmdb && scraped.tmdb_id !== null && String(scraped.tmdb_id) === String(targetTmdb);
        const matchImdb = targetImdb && scraped.imdb_id && String(scraped.imdb_id).toLowerCase() === String(targetImdb).toLowerCase();
        if (matchTmdb || matchImdb) {
          foundTitle = scraped;
          break;
        }
      }
      if (!foundTitle) return null;
      let episodeId = null;
      if (normalizedType === "tv" && foundTitle.episodes) {
        const epNum = Number(episode) || 1;
        const epObj = foundTitle.episodes.find((e) => e.number === epNum);
        if (!epObj) return null;
        episodeId = epObj.id;
      }
      const iframeUrl = `${SC_BASE}/it/iframe/${foundTitle.id}${episodeId ? "?episode_id=" + episodeId : ""}`;
      const embedUrl = yield getCamEmbed(foundTitle.id, episodeId);
      if (!embedUrl) return null;
      return { embedUrl, iframeUrl };
    } catch (e) {
      console.error("[StreamingCommunity] SCZ embed resolve error:", e.message);
      return null;
    }
  });
}
var TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
var USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
function getCommonHeaders() {
  return {
    "User-Agent": USER_AGENT,
    "Referer": `${getStreamingCommunityBaseUrl()}/`,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1"
  };
}
function getEmbedHeaders(embedUrl) {
  return {
    "User-Agent": USER_AGENT,
    "Referer": `${getStreamingCommunityBaseUrl()}/`,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7"
  };
}
function getPlaylistHeaders(embedUrl) {
  const cleanReferer = String(embedUrl || "").replace("vixcloud.co", "cromosino.space").replace("vixsrc.to", "cromosino.space");
  return {
    "User-Agent": USER_AGENT,
    "Referer": cleanReferer,
    "Origin": getStreamingCommunityBaseUrl(),
    "Accept": "*/*",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin"
  };
}
function extractEmbedSrcFromApiPayload(payload) {
  const rawSrc = payload && typeof payload === "object" ? payload.src : null;
  if (!rawSrc) return null;
  try {
    return new URL(rawSrc, getStreamingCommunityBaseUrl()).toString();
  } catch (e) {
    return null;
  }
}
function extractMasterPlaylistFromEmbedHtml(html) {
  if (!html) return null;
  const tokenMatch = html.match(/'token'\s*:\s*'([^']+)'/i);
  const expiresMatch = html.match(/'expires'\s*:\s*'([^']+)'/i);
  const urlMatch = html.match(/url\s*:\s*'([^']+\/playlist\/\d+[^']*)'/i);
  if (!tokenMatch || !expiresMatch || !urlMatch) {
    return null;
  }
  return {
    token: tokenMatch[1],
    expires: expiresMatch[1],
    url: urlMatch[1]
  };
}
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
function getTmdbId(imdbId, type) {
  return __async(this, null, function* () {
    const normalizedType = String(type).toLowerCase();
    const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    try {
      const response = yield fetch(findUrl);
      if (!response.ok) return null;
      const data = yield response.json();
      if (!data) return null;
      if (normalizedType === "movie" && data.movie_results && data.movie_results.length > 0) {
        return data.movie_results[0].id.toString();
      } else if (normalizedType === "tv" && data.tv_results && data.tv_results.length > 0) {
        return data.tv_results[0].id.toString();
      }
      return null;
    } catch (e) {
      console.error("[StreamingCommunity] Conversion error:", e);
      return null;
    }
  });
}
function getMetadata(id, type) {
  return __async(this, null, function* () {
    try {
      const normalizedType = String(type).toLowerCase();
      let url;
      if (String(id).startsWith("tt")) {
        url = `https://api.themoviedb.org/3/find/${id}?api_key=${TMDB_API_KEY}&external_source=imdb_id&language=it-IT`;
      } else {
        const endpoint = normalizedType === "movie" ? "movie" : "tv";
        url = `https://api.themoviedb.org/3/${endpoint}/${id}?api_key=${TMDB_API_KEY}&language=it-IT`;
      }
      const response = yield fetch(url);
      if (!response.ok) return null;
      const data = yield response.json();
      if (String(id).startsWith("tt")) {
        const results = normalizedType === "movie" ? data.movie_results : data.tv_results;
        if (results && results.length > 0) return results[0];
      } else {
        return data;
      }
      return null;
    } catch (e) {
      console.error("[StreamingCommunity] Metadata error:", e);
      return null;
    }
  });
}
function getStreams(id, type, season, episode, providerContext = null) {
  return __async(this, null, function* () {
    const requestedType = String(type).toLowerCase();
    const normalizedType = requestedType === "series" ? "tv" : requestedType;
    const baseUrl = getStreamingCommunityBaseUrl();
    const commonHeaders = getCommonHeaders();
    let tmdbId = id.toString();
    let resolvedSeason = season;
    const contextTmdbId = providerContext && /^\d+$/.test(String(providerContext.tmdbId || "")) ? String(providerContext.tmdbId) : null;
    if (contextTmdbId) {
      tmdbId = contextTmdbId;
    } else if (tmdbId.startsWith("tmdb:")) {
      tmdbId = tmdbId.replace("tmdb:", "");
    } else if (tmdbId.startsWith("tt")) {
      const convertedId = yield getTmdbId(tmdbId, normalizedType);
      if (convertedId) {
        console.log(`[StreamingCommunity] Converted ${id} to TMDB ID: ${convertedId}`);
        tmdbId = convertedId;
      } else {
        console.warn(`[StreamingCommunity] Could not convert IMDb ID ${id} to TMDB ID.`);
      }
    }
    let metadata = null;
    try {
      metadata = yield getMetadata(tmdbId, type);
    } catch (e) {
      console.error("[StreamingCommunity] Error fetching metadata:", e);
    }
    const title = metadata && (metadata.title || metadata.name || metadata.original_title || metadata.original_name) ? metadata.title || metadata.name || metadata.original_title || metadata.original_name : normalizedType === "movie" ? "Film Sconosciuto" : "Serie TV";
    const displayName = normalizedType === "movie" ? title : `${title} ${resolvedSeason}x${episode}`;
    const finalDisplayName = displayName;
    let url;
    let apiUrl;
    if (normalizedType === "movie") {
      url = `${baseUrl}/movie/${tmdbId}`;
      apiUrl = `${baseUrl}/api/movie/${tmdbId}`;
    } else if (normalizedType === "tv") {
      url = `${baseUrl}/tv/${tmdbId}/${resolvedSeason}/${episode}`;
      apiUrl = `${baseUrl}/api/tv/${tmdbId}/${resolvedSeason}/${episode}`;
    } else {
      return [];
    }
    try {
      const proxySocks = STREAMINGCOMMUNITY_PROXY || typeof process !== "undefined" && process.env.SOCKS5_PROXY || "";
      const useProxyFetch = proxySocks && typeof ProxyAgent === "function";
      let proxyAgent = null;
      if (useProxyFetch) {
        try {
          proxyAgent = new ProxyAgent(proxySocks);
          console.log(`[StreamingCommunity] Using SOCKS5 proxy for fetches`);
        } catch (e) {
          console.warn(`[StreamingCommunity] Failed to create proxy agent: ${e.message}`);
        }
      }
      console.log(`[StreamingCommunity] Fetching API: ${apiUrl}`);
      const [vixRes, sczRes] = yield Promise.all([
        fetch(apiUrl, { headers: commonHeaders, dispatcher: proxyAgent || void 0 }).then((r) => r.ok ? r.json() : null).then((payload) => {
          const embedUrl = extractEmbedSrcFromApiPayload(payload);
          return embedUrl ? { embedUrl, iframeUrl: url } : null;
        }).catch(() => null),
        resolveSczEmbed(metadata, normalizedType, resolvedSeason, episode, id)
      ]);
      const embedSources = [];
      if (vixRes == null ? void 0 : vixRes.embedUrl) embedSources.push(__spreadProps(__spreadValues({}, vixRes), { source: "vixsrc" }));
      if ((sczRes == null ? void 0 : sczRes.embedUrl) && sczRes.embedUrl !== (vixRes == null ? void 0 : vixRes.embedUrl)) embedSources.push(__spreadProps(__spreadValues({}, sczRes), { source: "scz" }));
      if (embedSources.length === 0) {
        console.log("[StreamingCommunity] Could not find embed src from any source");
        return [];
      }
      const streams = [];
      for (const item of embedSources) {
        const embedUrl = item.embedUrl;
        const isSczSource = item.source === "scz";
        let embedHtml;
        try {
          console.log(`[StreamingCommunity] Fetching embed (${item.source}): ${embedUrl}`);
          const embedResponse = yield fetch(embedUrl, {
            headers: getEmbedHeaders(embedUrl),
            dispatcher: proxyAgent || void 0
          });
          if (!embedResponse.ok) {
            console.error(`[StreamingCommunity] Failed to fetch embed: ${embedResponse.status}`);
            continue;
          }
          embedHtml = yield embedResponse.text();
        } catch (e) {
          console.error(`[StreamingCommunity] Failed to fetch embed: ${e.message}`);
          continue;
        }
        if (!embedHtml) continue;
        const masterPlaylist = extractMasterPlaylistFromEmbedHtml(embedHtml);
        if (!masterPlaylist) {
          console.log("[StreamingCommunity] Could not find playlist info in HTML");
          continue;
        }
        const [playlistRawUrl, existingQuery] = masterPlaylist.url.split("?");
        const urlWithExt = playlistRawUrl.endsWith(".m3u8") ? playlistRawUrl : `${playlistRawUrl}.m3u8`;
        const queryParts = [existingQuery, `token=${encodeURIComponent(masterPlaylist.token)}`, `expires=${encodeURIComponent(masterPlaylist.expires)}`, "h=1", "lang=it"].filter(Boolean);
        const rawStreamUrl = `${urlWithExt}?${queryParts.join("&")}`;
        const streamUrl = rawStreamUrl.replace("vixcloud.co", "cromosino.space").replace("vixsrc.to", "cromosino.space");
        const cleanEmbedUrl = embedUrl.replace("vixcloud.co", "cromosino.space").replace("vixsrc.to", "cromosino.space");
        const cleanIframeUrl = (item.iframeUrl || cleanEmbedUrl).replace("vixcloud.co", "cromosino.space").replace("vixsrc.to", "cromosino.space");
        const streamHeaders = getPlaylistHeaders(cleanEmbedUrl);
        console.log(`[StreamingCommunity] Final stream URL (${item.source}): ${streamUrl}`);
        let quality = "1080p";
        let hasItalianAudio = false;
        let playlistFetched = false;
        try {
          const playlistResponse = yield fetch(streamUrl, {
            headers: streamHeaders,
            dispatcher: proxyAgent || void 0
          });
          if (!playlistResponse.ok) {
            console.warn(`[StreamingCommunity] Playlist pre-check failed: ${playlistResponse.status}, stream not playable`);
            continue;
          }
          playlistFetched = true;
          const playlistText = yield playlistResponse.text();
          if (playlistText) {
            hasItalianAudio = /#EXT-X-MEDIA:TYPE=AUDIO.*(?:LANGUAGE="it"|LANGUAGE="ita"|NAME="Italian"|NAME="Ita")/i.test(playlistText);
            const detected = checkQualityFromText(playlistText);
            if (detected) quality = detected;
          }
        } catch (e) {
          console.warn(`[StreamingCommunity] Playlist pre-check failed, continuing:`, e);
          continue;
        }
        const normalizedQuality = getQualityFromName(quality);
        const hasOriginalItalian = metadata && (metadata.original_language === "it" || metadata.original_language === "ita");
        const isItalianAudio = isSczSource || (playlistFetched ? hasItalianAudio : true) || hasOriginalItalian;
        const resultLanguage = isItalianAudio ? "Italian" : "";
        const isStremioAddon = Boolean(providerContext == null ? void 0 : providerContext.proxyUrl);
        const targetProxySource = isStremioAddon ? cleanIframeUrl : cleanEmbedUrl;
        const result = {
          name: `StreamingCommunity`,
          title: finalDisplayName,
          url: streamUrl,
          easyProxySourceUrl: targetProxySource,
          quality: normalizedQuality,
          type: "direct",
          headers: streamHeaders,
          behaviorHints: {
            notWebReady: false
          },
          language: resultLanguage
        };
        const formatted = formatStream(result, "StreamingCommunity");
        if (formatted) streams.push(formatted);
      }
      const itaStreams = streams.filter((s) => {
        var _a;
        return Boolean(s.language) || ((_a = s.title) == null ? void 0 : _a.includes("\u{1F1EE}\u{1F1F9}"));
      });
      if (itaStreams.length > 0) {
        return [itaStreams[0]];
      }
      return streams.length > 0 ? [streams[0]] : [];
    } catch (error) {
      console.error("[StreamingCommunity] Error:", error);
      return [];
    }
  });
}
module.exports = { getStreams };
