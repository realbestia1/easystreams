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
      const behaviorHints = stream.behaviorHints && typeof stream.behaviorHints === "object" ? __spreadValues({}, stream.behaviorHints) : {};
      let finalHeaders = stream.headers;
      if (behaviorHints.proxyHeaders && behaviorHints.proxyHeaders.request) {
        finalHeaders = behaviorHints.proxyHeaders.request;
      } else if (behaviorHints.headers) {
        finalHeaders = behaviorHints.headers;
      }
      finalHeaders = normalizePlaybackHeaders(finalHeaders);
      const isStreamingCommunityProvider = String(providerName || "").toLowerCase() === "streamingcommunity" || String((stream == null ? void 0 : stream.name) || "").toLowerCase().includes("streamingcommunity");
      if (isStreamingCommunityProvider) {
        finalHeaders = void 0;
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
    var FETCH_TIMEOUT = 3e4;
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
    function fetchWithTimeout(_0) {
      return __async(this, arguments, function* (url, options = {}) {
        if (typeof fetch === "undefined") {
          throw new Error("No fetch implementation found!");
        }
        const _a = options, { timeout } = _a, fetchOptions = __objRest(_a, ["timeout"]);
        const requestTimeout = timeout || FETCH_TIMEOUT;
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
    module2.exports = { fetchWithTimeout, createTimeoutSignal: createTimeoutSignal2 };
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

// src/cc/index.js
var { formatStream } = require_formatter();
var { checkQualityFromPlaylist } = require_quality_helper();
var { createTimeoutSignal } = require_fetch_helper();
function base64Decode(str) {
  try {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(str, "base64").toString("utf8");
    } else if (typeof atob !== "undefined") {
      return decodeURIComponent(escape(atob(str)));
    }
  } catch (e) {
    console.error("[CC] Base64 decode error:", e);
  }
  return "";
}
var BASE_URL = base64Decode("aHR0cHM6Ly9jaW5lbWFjaXR5LmNj");
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
function getSessionCookies() {
  const cookieB64 = "ZGxlX3VzZXJfaWQ9MzI3Mjk7IGRsZV9wYXNzd29yZD04OTQxNzFjNmE4ZGFiMThlZTU5NGQ1YzY1MjAwOWEzNTs=";
  return base64Decode(cookieB64);
}
function searchByImdb(imdbId) {
  return __async(this, null, function* () {
    const cookies = getSessionCookies();
    const trySearch = (query) => __async(null, null, function* () {
      const searchUrl = `${BASE_URL}/index.php?do=search&subaction=search&story=${query}`;
      console.log(`[CC] Searching for query: ${query}`);
      try {
        const response = yield fetch(searchUrl, {
          headers: {
            "User-Agent": USER_AGENT,
            "Cookie": cookies || "",
            "Referer": `${BASE_URL}/`
          }
        });
        if (!response.ok) return null;
        const html = yield response.text();
        const resultMatch = html.match(/Found\s+(\d+)\s+responses/i) || html.match(/Trovat[io]\s+(\d+)\s+risultat[io]/i) || html.match(/Query results\s*\d+\s*-\s*(\d+)/i);
        if (!resultMatch || parseInt(resultMatch[1]) === 0) {
          if (!html.includes(query)) return null;
        }
        let searchArea = "";
        const markerIdx = resultMatch ? html.indexOf(resultMatch[0]) : html.indexOf('id="dle-content"');
        if (markerIdx === -1) {
          if (html.includes("site search yielded no results") || html.includes("ricerca non ha prodotto risultati")) {
            return null;
          }
          return null;
        }
        const contentEndStrings = ['id="side"', "class='side'", "<footer", "<aside"];
        let contentEndIdx = html.length;
        for (const s of contentEndStrings) {
          const pos = html.indexOf(s, markerIdx);
          if (pos !== -1 && pos < contentEndIdx) contentEndIdx = pos;
        }
        searchArea = html.substring(markerIdx, contentEndIdx);
        const links = [...searchArea.matchAll(/<a[^>]+href=["']((?:https?:\/\/cinemacity\.cc)?\/(?:movies|anime|series|tv-series)\/\d+-[^"']+\.html)["'][^>]*>([\s\S]*?)<\/a>/gi)];
        if (links.length > 0) {
          let bestMatch = links[0];
          const queryPos = searchArea.indexOf(query);
          if (queryPos !== -1) {
            let minDistance = Infinity;
            for (const match of links) {
              const distance = Math.abs(match.index - queryPos);
              if (distance < minDistance) {
                minDistance = distance;
                bestMatch = match;
              }
            }
          }
          let bestLink = bestMatch[1];
          let bestTitle = bestMatch[2].replace(/<[^>]*>?/gm, "").trim();
          if (bestLink.startsWith("/")) bestLink = BASE_URL + bestLink;
          return { url: bestLink, title: bestTitle };
        }
      } catch (e) {
        console.error(`[CC] Search error for ${query}:`, e);
      }
      return null;
    });
    let link = yield trySearch(imdbId);
    if (link) return link;
    const numericId = imdbId.replace(/\D/g, "");
    if (numericId && numericId !== imdbId) {
      link = yield trySearch(numericId);
    }
    return link;
  });
}
function extractJsonArray(decoded) {
  let start = decoded.indexOf("file:");
  if (start === -1) start = decoded.indexOf("sources:");
  if (start === -1) return null;
  start = decoded.indexOf("[", start);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < decoded.length; i++) {
    if (decoded[i] === "[") depth++;
    else if (decoded[i] === "]") depth--;
    if (depth === 0) {
      return decoded.substring(start, i + 1);
    }
  }
  return null;
}
function pickStream(fileData, type, season = 1, episode = 1) {
  var _a;
  if (typeof fileData === "string") {
    return fileData;
  }
  if (Array.isArray(fileData)) {
    if (type === "movie" || fileData.every((x) => x && typeof x === "object" && "file" in x && !("folder" in x))) {
      return (_a = fileData[0]) == null ? void 0 : _a.file;
    }
    let selectedSeasonFolder = null;
    for (const s of fileData) {
      if (!s || typeof s !== "object" || !s.folder) continue;
      const title = (s.title || "").toLowerCase();
      const seasonRegex = new RegExp(`(?:season|stagione|s)\\s*0*${season}\\b`, "i");
      if (seasonRegex.test(title)) {
        selectedSeasonFolder = s.folder;
        break;
      }
    }
    if (!selectedSeasonFolder && fileData.length > 0) {
      for (const s of fileData) {
        if (s && s.folder) {
          selectedSeasonFolder = s.folder;
          break;
        }
      }
    }
    if (!selectedSeasonFolder) return null;
    let selectedEpisodeFile = null;
    for (const e of selectedSeasonFolder) {
      if (!e || typeof e !== "object" || !e.file) continue;
      const title = (e.title || "").toLowerCase();
      const epRegex = new RegExp(`(?:episode|episodio|e)\\s*0*${episode}\\b`, "i");
      if (epRegex.test(title)) {
        selectedEpisodeFile = e.file;
        break;
      }
    }
    if (!selectedEpisodeFile) {
      const idx = Math.max(0, episode - 1);
      const epData = idx < selectedSeasonFolder.length ? selectedSeasonFolder[idx] : selectedSeasonFolder[0];
      selectedEpisodeFile = (epData == null ? void 0 : epData.file) || null;
    }
    return selectedEpisodeFile;
  }
  return null;
}
function getStreams(id, type, season, episode, providerContext = null) {
  return __async(this, null, function* () {
    let imdbId = String(id || "").trim();
    const providerType = type === "tv" || type === "series" || type === "anime" ? "tv" : "movie";
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
            const response = yield fetch(externalUrl);
            if (response.ok) {
              const data = yield response.json();
              if (data.imdb_id) imdbId = data.imdb_id;
            }
          }
        } catch (e) {
          console.error("[CC] TMDB to IMDb resolution error:", e);
        }
      }
    }
    if (!imdbId.startsWith("tt")) {
      console.log(`[CC] Could not resolve IMDb ID for TMDB: ${id}. CC requires IMDb ID for searching.`);
      return [];
    }
    try {
      const isStremioAddon = providerContext && providerContext.__requestContext === true;
      const proxyUrl = providerContext && providerContext.proxyUrl || (typeof global !== "undefined" && global.CF_PROXY_URL ? global.CF_PROXY_URL : null);
      const searchResult = yield searchByImdb(imdbId);
      if (!searchResult || !searchResult.url) {
        console.log(`[CC] No results found for IMDb: ${imdbId}`);
        return [];
      }
      const movieUrl = searchResult.url;
      let movieTitle = (searchResult.title || imdbId).replace(/\s*\(.*?\)\s*/g, "").trim();
      if (type === "tv" || type === "series") {
        movieTitle += ` ${season}x${episode}`;
      }
      console.log(`[CC] Found URL and Title: ${movieUrl} (${movieTitle})`);
      if (isStremioAddon) {
        if (!proxyUrl) {
          console.log(`[CC] Skipping Stremio Addon execution because proxy is not configured.`);
          return [];
        }
        let finalTargetUrl = movieUrl;
        if (type === "tv" || type === "series") {
          const separator = finalTargetUrl.includes("?") ? "&" : "?";
          finalTargetUrl += `${separator}s=${season}&e=${episode}`;
        }
        const extractorUrl = `${proxyUrl}/extractor/video?host=city&url=${encodeURIComponent(finalTargetUrl)}&redirect_stream=true`;
        console.log(`[CC] Using EasyProxy extractor: ${extractorUrl}`);
        const result2 = {
          name: "CC",
          title: movieTitle,
          url: extractorUrl,
          quality: "1080p",
          type: "direct",
          behaviorHints: {
            notWebReady: true
          }
        };
        return [formatStream(result2, "CC")];
      }
      console.log(`[CC] Executing direct HTML extraction for Nuvio plugin...`);
      const cookies = getSessionCookies();
      const response = yield fetch(movieUrl, {
        headers: {
          "User-Agent": USER_AGENT,
          "Cookie": cookies,
          "Referer": `${BASE_URL}/`
        }
      });
      if (!response.ok) return [];
      const html = yield response.text();
      const atobRegex = /atob\s*\(\s*['"](.*?)['"]\s*\)/gi;
      let match;
      let fileData = null;
      while ((match = atobRegex.exec(html)) !== null) {
        const encoded = match[1];
        try {
          if (encoded.length < 50) continue;
          let decoded;
          try {
            decoded = base64Decode(encoded);
          } catch (e) {
            continue;
          }
          if (!decoded) continue;
          if (decoded.trim().startsWith("[")) {
            try {
              fileData = JSON.parse(decoded);
              if (fileData && fileData.length > 0) break;
            } catch (e) {
            }
          }
          const rawJson = extractJsonArray(decoded);
          if (rawJson) {
            try {
              const cleanJson = rawJson.replace(/\\(.)/g, "$1");
              fileData = JSON.parse(cleanJson);
            } catch (e) {
              try {
                fileData = JSON.parse(rawJson);
              } catch (e2) {
              }
            }
            if (fileData && fileData.length > 0) break;
          }
          const fileMatch = decoded.match(/(?:file|sources)\s*:\s*['"](.*?)['"]/i);
          if (fileMatch) {
            const url = fileMatch[1];
            if (url.includes(".m3u8") || url.includes(".mp4")) {
              fileData = url;
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
      if (!fileData) {
        console.log(`[CC] Could not extract stream info from: ${movieUrl}`);
        return [];
      }
      const streamUrl = pickStream(fileData, type, season, episode);
      if (!streamUrl) return [];
      console.log(`[CC] Found stream: ${streamUrl}`);
      const results = [];
      const result = {
        name: "CC",
        title: movieTitle,
        url: streamUrl,
        quality: "1080p",
        type: "direct",
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": movieUrl,
          "Cookie": cookies
        },
        behaviorHints: {
          notWebReady: false
        }
      };
      if (streamUrl.includes(".m3u8")) {
        const detectedQuality = yield checkQualityFromPlaylist(streamUrl, result.headers);
        if (detectedQuality) result.quality = detectedQuality;
      }
      results.push(formatStream(result, "CC"));
      return results;
    } catch (e) {
      console.error("[CC] Error:", e);
      return [];
    }
  });
}
module.exports = { getStreams };
