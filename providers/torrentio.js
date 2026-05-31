var __create = Object.create;
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
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
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
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
    function shouldForceNotWebReadyForPlugin(stream, providerName, headers, behaviorHints2) {
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
      const behaviorHints2 = stream.behaviorHints && typeof stream.behaviorHints === "object" ? __spreadValues({}, stream.behaviorHints) : {};
      let finalHeaders = stream.headers;
      if (behaviorHints2.proxyHeaders && behaviorHints2.proxyHeaders.request) {
        finalHeaders = behaviorHints2.proxyHeaders.request;
      } else if (behaviorHints2.headers) {
        finalHeaders = behaviorHints2.headers;
      }
      finalHeaders = normalizePlaybackHeaders(finalHeaders);
      const isStreamingCommunityProvider = String(providerName || "").toLowerCase() === "streamingcommunity" || String((stream == null ? void 0 : stream.name) || "").toLowerCase().includes("streamingcommunity");
      if (isStreamingCommunityProvider && !finalHeaders) {
        delete behaviorHints2.proxyHeaders;
        delete behaviorHints2.headers;
        delete behaviorHints2.notWebReady;
      }
      if (finalHeaders) {
        behaviorHints2.proxyHeaders = behaviorHints2.proxyHeaders || {};
        behaviorHints2.proxyHeaders.request = finalHeaders;
        behaviorHints2.headers = finalHeaders;
      }
      const providerExplicitNotWebReady = stream.behaviorHints && "notWebReady" in stream.behaviorHints;
      const shouldForceNotWebReady = shouldForceNotWebReadyForPlugin(stream, providerName, finalHeaders, behaviorHints2);
      if (!isStreamingCommunityProvider && shouldForceNotWebReady) {
        behaviorHints2.notWebReady = true;
      } else if (!providerExplicitNotWebReady) {
        delete behaviorHints2.notWebReady;
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
        behaviorHints: behaviorHints2,
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

// src/torrentio/http.js
var TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
var LANGUAGE_SETTINGS = "language=italian";
var TORRENTIO_API = "https://torrentio.strem.fun/" + LANGUAGE_SETTINGS;
var TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://exodus.desync.com:6969/announce"
];
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  "Accept": "application/json, text/plain, */*"
};

// src/torrentio/extractor.js
var import_formatter = __toESM(require_formatter());
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    var _a;
    try {
      const imdbId = tmdbId.startsWith('tt') ? tmdbId : yield getImdbId(tmdbId, mediaType);
      if (!imdbId) {
        console.log("[TorrentIO-ITA] IMDB ID not found");
        return [];
      }
      const isTv = season != null && episode != null;
      const url = isTv ? TORRENTIO_API + "/stream/series/" + imdbId + ":" + season + ":" + episode + ".json" : TORRENTIO_API + "/stream/movie/" + imdbId + ".json";
      console.log("[TorrentIO-ITA] Fetching:", url);
      const response = yield fetch(url, { headers: HEADERS });
      const body = yield response.json();
      if (!body || !body.streams) {
        console.log("[TorrentIO-ITA] No streams");
        return [];
      }
      const results = [];
      for (const stream of body.streams.slice(0, 15)) {
        try {
          const title = stream.title || "";
          const titleLower = title.toLowerCase();
          const quality = extractQuality(title);
          const seeders = ((_a = title.match(/👤\s*(\d+)/)) != null ? _a : [])[1] || "?";
          const magnet = buildMagnet(stream.infoHash);
          if (!magnet) continue;
          if (!stream.title.toLowerCase().includes("ita")) continue;
          let formattedStream = (0, import_formatter.formatStream)(stream, "TorrentIO Plugin");
          formattedStream = __spreadProps(__spreadValues({}, formattedStream), {
            url: magnet,
            infoHash: stream.infoHash,
            behaviorHints: stream.behaviorHints || {},  
            isInstalledAddonStream: true,
            // Should trigger local debrid resolution in Nuvio
            needsLocalDebridResolve: true,
            // Should trigger local debrid resolution in Nuvio
          });
          results.push(formattedStream);
        } catch (e) {
          console.log("errore", e);
        }
      }
      return results;
    } catch (e) {
      console.error("[TORRENTIO] Error extracting streams:", e);
      return [];
    }
  });
}
function buildMagnet(infoHash) {
  if (!infoHash) return "";
  const trackerParams = TRACKERS.map((t) => "&tr=" + encodeURIComponent(t)).join("");
  return "magnet:?xt=urn:btih:" + infoHash + trackerParams;
}
function extractQuality(title = "") {
  const t = title.toLowerCase();
  if (t.includes("2160p") || t.includes("4k")) return "4K";
  if (t.includes("1080p")) return "1080p";
  if (t.includes("720p")) return "720p";
  if (t.includes("480p")) return "480p";
  return "Unknown";
}
function getImdbId(tmdbId, mediaType) {
  return __async(this, null, function* () {
    try {
      const normalizedType = mediaType.toLowerCase() === "tv" ? "tv" : "movie";
      const findUrl = `https://api.themoviedb.org/3/${normalizedType}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
      const response = yield fetch(findUrl);
      console.log(response);
      if (!response.ok) return null;
      const data = yield response.json();
      console.log(data);
      if (!data) return null;
      return data.imdb_id || null;
    } catch (e) {
      console.error("[TORRENTIO] Error fetching IMDB ID:", e);
    }
  });
}

// src/torrentio/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log(`[TorrentIO-ITA] Request: ${mediaType} ${tmdbId}`);
      const streams = yield extractStreams(tmdbId, mediaType, season, episode);
      return streams;
    } catch (error) {
      console.error(`[TorrentIO-ITA] Error: ${error.message}`);
      return [];
    }
  });
}
module.exports = { getStreams };
