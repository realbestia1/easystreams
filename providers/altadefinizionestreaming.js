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

// src/altadefinizionestreaming/index.js
var TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
var BASE_URL = "https://altadefinizionestreaming.com";
var USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
var { extractMixDrop } = require_mixdrop();
var { formatStream } = require_formatter();
function fetchJson(url) {
  return __async(this, null, function* () {
    try {
      const response = yield fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": `${BASE_URL}/`,
          "Accept": "application/json,text/plain,*/*"
        }
      });
      if (!response.ok) return null;
      return yield response.json();
    } catch (e) {
      return null;
    }
  });
}
function resolveTmdbId(id, type, providerContext = null) {
  return __async(this, null, function* () {
    var _a, _b, _c, _d;
    const contextTmdbId = providerContext && /^\d+$/.test(String(providerContext.tmdbId || "")) ? String(providerContext.tmdbId) : null;
    if (contextTmdbId) return contextTmdbId;
    const idStr = String(id || "").trim();
    if (/^tmdb:\d+$/i.test(idStr)) return idStr.split(":")[1];
    if (/^\d+$/.test(idStr)) return idStr;
    const contextImdbId = providerContext && /^tt\d+$/i.test(String(providerContext.imdbId || "")) ? String(providerContext.imdbId) : null;
    const imdbId = /^tt\d+$/i.test(idStr) ? idStr : contextImdbId;
    if (!imdbId) return null;
    const normalizedType = String(type || "").toLowerCase();
    const payload = yield fetchJson(`https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?api_key=${TMDB_API_KEY}&external_source=imdb_id`);
    if (!payload) return null;
    if (normalizedType === "movie") {
      if (Array.isArray(payload.movie_results) && ((_a = payload.movie_results[0]) == null ? void 0 : _a.id)) return String(payload.movie_results[0].id);
      if (Array.isArray(payload.tv_results) && ((_b = payload.tv_results[0]) == null ? void 0 : _b.id)) return String(payload.tv_results[0].id);
    }
    if (Array.isArray(payload.tv_results) && ((_c = payload.tv_results[0]) == null ? void 0 : _c.id)) return String(payload.tv_results[0].id);
    if (Array.isArray(payload.movie_results) && ((_d = payload.movie_results[0]) == null ? void 0 : _d.id)) return String(payload.movie_results[0].id);
    return null;
  });
}
function absoluteUrl(url) {
  if (!url) return null;
  try {
    return new URL(String(url), BASE_URL).toString();
  } catch (e) {
    return null;
  }
}
function getShowTitle(tmdbId, type) {
  return __async(this, null, function* () {
    const endpoint = String(type || "").toLowerCase() === "movie" ? "movie" : "tv";
    const payload = yield fetchJson(`https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=it-IT`);
    if (!payload) return null;
    return payload.title || payload.name || payload.original_title || payload.original_name || null;
  });
}
function resolveDownloadToMixDrop(url) {
  return __async(this, null, function* () {
    const downloadUrl = absoluteUrl(url);
    if (!downloadUrl) return null;
    const withGo = `${downloadUrl}${downloadUrl.includes("?") ? "&" : "?"}go=1`;
    try {
      const response = yield fetch(withGo, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": `${BASE_URL}/`
        }
      });
      const finalUrl = String(response.url || "").replace(/\?download$/i, "");
      if (/mixdrop|m1xdrop|mxdrop/i.test(finalUrl)) return finalUrl;
    } catch (e) {
      return null;
    }
    return null;
  });
}
function addCdnStream(streams, tmdbId, type, season, episode, displayName) {
  return __async(this, null, function* () {
    var _a, _b;
    const normalizedType = String(type || "").toLowerCase();
    const endpoint = normalizedType === "movie" ? `${BASE_URL}/api/player-sources/movie/${tmdbId}` : `${BASE_URL}/api/player-sources/tv/${tmdbId}/${season}/${episode}`;
    const payload = yield fetchJson(endpoint);
    const source = ((_a = payload == null ? void 0 : payload.sources) == null ? void 0 : _a.find((s) => String((s == null ? void 0 : s.provider) || "").toLowerCase() === "cdn" && (s == null ? void 0 : s.url))) || ((_b = payload == null ? void 0 : payload.sources) == null ? void 0 : _b.find((s) => s == null ? void 0 : s.url));
    if (!(source == null ? void 0 : source.url)) return;
    streams.push({
      name: "AltadefinizioneStreaming - CDN",
      title: displayName,
      url: source.url,
      easyProxySourceUrl: endpoint,
      headers: {
        "User-Agent": USER_AGENT,
        "Referer": `${BASE_URL}/`
      },
      quality: "720p",
      type: "direct"
    });
  });
}
function addMixDropStream(streams, tmdbId, type, season, episode, displayName) {
  return __async(this, null, function* () {
    const normalizedType = String(type || "").toLowerCase();
    let downloadEntry = null;
    if (normalizedType === "movie") {
      const payload = yield fetchJson(`${BASE_URL}/api/download/${tmdbId}`);
      if ((payload == null ? void 0 : payload.available) && (payload == null ? void 0 : payload.url)) downloadEntry = payload.url;
    } else {
      const payload = yield fetchJson(`${BASE_URL}/api/download-episodes/${tmdbId}`);
      const episodes = Array.isArray(payload == null ? void 0 : payload.episodes) ? payload.episodes : [];
      const match = episodes.find((item) => Number(item == null ? void 0 : item.season) === Number(season) && Number(item == null ? void 0 : item.episode) === Number(episode));
      if ((payload == null ? void 0 : payload.available) && (match == null ? void 0 : match.url)) downloadEntry = match.url;
    }
    const mixdropUrl = yield resolveDownloadToMixDrop(downloadEntry);
    if (!mixdropUrl) return;
    const extracted = yield extractMixDrop(mixdropUrl);
    if (!(extracted == null ? void 0 : extracted.url)) return;
    streams.push({
      name: "AltadefinizioneStreaming - MixDrop",
      title: displayName,
      url: extracted.url,
      easyProxySourceUrl: mixdropUrl,
      headers: extracted.headers,
      quality: "720p",
      type: "direct"
    });
  });
}
function getStreams(id, type, season, episode, providerContext = null) {
  return __async(this, null, function* () {
    const normalizedType = String(type || "").toLowerCase();
    if (normalizedType !== "movie" && normalizedType !== "tv" && normalizedType !== "series") return [];
    const tmdbId = yield resolveTmdbId(id, normalizedType === "movie" ? "movie" : "tv", providerContext);
    if (!tmdbId) return [];
    const effectiveSeason = parseInt(String(season || ""), 10) || 1;
    const effectiveEpisode = parseInt(String(episode || ""), 10) || 1;
    const providerType = normalizedType === "movie" ? "movie" : "tv";
    const showTitle = (yield getShowTitle(tmdbId, providerType)) || (normalizedType === "movie" ? "Film" : "Serie");
    const displayName = normalizedType === "movie" ? showTitle : `${showTitle} ${effectiveSeason}x${effectiveEpisode}`;
    const streams = [];
    yield Promise.all([
      addCdnStream(streams, tmdbId, providerType, effectiveSeason, effectiveEpisode, displayName),
      addMixDropStream(streams, tmdbId, providerType, effectiveSeason, effectiveEpisode, displayName)
    ]);
    return streams.map((s) => formatStream(s, "AltadefinizioneStreaming")).filter(Boolean);
  });
}
module.exports = { getStreams };
