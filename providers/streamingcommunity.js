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
      return __spreadProps(__spreadValues({}, stream), {
        // Keep original properties
        name: finalName,
        title: titleText,
        // Ensure language is set for Stremio/Nuvio sorting
        language,
        // Mark as formatted
        _nuvio_formatted: true
      });
    }
    module2.exports = { formatStream: formatStream2 };
  }
});

// src/streamingcommunity/index.js
var BASE_URL = "https://vixsrc.to";
var { formatStream } = require_formatter();
var TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
var USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
var COMMON_HEADERS = {
  "User-Agent": USER_AGENT,
  "Referer": "https://vixsrc.to/",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1"
};
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
function getStreams(id, type, season, episode) {
  return __async(this, null, function* () {
    const normalizedType = String(type).toLowerCase();
    let tmdbId = id.toString();
    if (tmdbId.startsWith("tmdb:")) {
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
    const displayName = normalizedType === "movie" ? title : `${title} ${season}x${episode}`;
    const finalDisplayName = displayName;
    let url;
    if (normalizedType === "movie") {
      url = `${BASE_URL}/movie/${tmdbId}`;
    } else if (normalizedType === "tv") {
      url = `${BASE_URL}/tv/${tmdbId}/${season}/${episode}`;
    } else {
      return [];
    }
    try {
      console.log(`[StreamingCommunity] Fetching page: ${url}`);
      const response = yield fetch(url, {
        headers: COMMON_HEADERS
      });
      if (!response.ok) {
        console.error(`[StreamingCommunity] Failed to fetch page: ${response.status}`);
        return [];
      }
      const html = yield response.text();
      if (!html) return [];
      const tokenMatch = html.match(/'token':\s*'([^']+)'/);
      const expiresMatch = html.match(/'expires':\s*'([^']+)'/);
      const urlMatch = html.match(/url:\s*'([^']+)'/);
      if (tokenMatch && expiresMatch && urlMatch) {
        const token = tokenMatch[1];
        const expires = expiresMatch[1];
        const baseUrl = urlMatch[1];
        let streamUrl;
        if (baseUrl.includes("?b=1")) {
          streamUrl = baseUrl.replace("?", ".m3u8?") + `&token=${token}&expires=${expires}&h=1&lang=it`;
        } else {
          streamUrl = `${baseUrl}.m3u8?token=${token}&expires=${expires}&h=1&lang=it`;
        }
        console.log(`[StreamingCommunity] Found stream URL: ${streamUrl}`);
        let quality = "720p";
        try {
          const playlistResponse = yield fetch(streamUrl, {
            headers: COMMON_HEADERS
          });
          if (playlistResponse.ok) {
            const playlistText = yield playlistResponse.text();
            const hasItalian = /LANGUAGE="it"|LANGUAGE="ita"|NAME="Italian"|NAME="Ita"/i.test(playlistText);
            const has1080p = /RESOLUTION=\d+x1080|RESOLUTION=1080/i.test(playlistText);
            const has4k = /RESOLUTION=\d+x2160|RESOLUTION=2160/i.test(playlistText);
            if (has4k) quality = "4K";
            else if (has1080p) quality = "1080p";
            if (hasItalian) {
              console.log(`[StreamingCommunity] Verified: Has Italian audio.`);
            } else {
              console.log(`[StreamingCommunity] No Italian audio found in playlist. Skipping.`);
              return [];
            }
          } else {
            console.warn(`[StreamingCommunity] Playlist check failed (${playlistResponse.status}), skipping verification.`);
          }
        } catch (verError) {
          console.warn(`[StreamingCommunity] Playlist check error, returning anyway:`, verError);
        }
        const normalizedQuality = getQualityFromName(quality);
        const result = {
          name: `StreamingCommunity`,
          title: finalDisplayName,
          url: streamUrl,
          quality: normalizedQuality,
          type: "direct",
          headers: COMMON_HEADERS
        };
        return [formatStream(result, "StreamingCommunity")].filter((s) => s !== null);
      } else {
        console.log("[StreamingCommunity] Could not find playlist info in HTML");
        return [];
      }
    } catch (error) {
      console.error("[StreamingCommunity] Error:", error);
      return [];
    }
  });
}
module.exports = { getStreams };
