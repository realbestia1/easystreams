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
    var USER_AGENT2 = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
    function checkQualityFromPlaylist2(_0) {
      return __async(this, arguments, function* (url, headers = {}) {
        try {
          if (!url.includes(".m3u8")) return null;
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

// cf_bypass.js
var require_cf_bypass = __commonJS({
  "cf_bypass.js"(exports2, module2) {
    var fs = require("fs");
    var path = require("path");
    var axios = require("axios");
    var activeBypasses = /* @__PURE__ */ new Map();
    function getClearance(_0) {
      return __async(this, arguments, function* (url, provider = "default", options = {}) {
        const sessionFile = path.join(process.cwd(), `cf-session-${provider}.json`);
        if (activeBypasses.has(provider)) {
          console.log(`[CF] FlareSolverr bypass gi\xE0 in corso per il provider [${provider}], attendo...`);
          return activeBypasses.get(provider);
        }
        const bypassPromise = (() => __async(null, null, function* () {
          var _b;
          const FLARE_URL = process.env.FLARE_URL || "http://127.0.0.1:8191/v1";
          console.log(`[CF] Richiesta bypass a FlareSolverr: ${url}`);
          const payload = {
            cmd: options.method === "POST" ? "request.post" : "request.get",
            url,
            maxTimeout: 6e4
          };
          if (options.headers) {
            const _a = options.headers, { host, Host, cookie, Cookie } = _a, cleanHeaders = __objRest(_a, ["host", "Host", "cookie", "Cookie"]);
            payload.headers = cleanHeaders;
          }
          if (options.method === "POST" && options.body) {
            payload.postData = options.body;
          }
          try {
            const response = yield axios.post(FLARE_URL, payload, {
              timeout: 7e4,
              headers: { "Content-Type": "application/json" }
            });
            if (response.data && response.data.status === "ok") {
              const solution = response.data.solution;
              if (!solution.cookies || solution.cookies.length === 0) {
                throw new Error("FlareSolverr ha restituito successo ma zero cookie.");
              }
              const cookies = solution.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
              const cf_clearance = (_b = solution.cookies.find((c) => c.name === "cf_clearance")) == null ? void 0 : _b.value;
              const data = {
                userAgent: solution.userAgent,
                cookies,
                cf_clearance: cf_clearance || null,
                url: solution.url,
                response: solution.response,
                timestamp: Date.now()
              };
              fs.writeFileSync(sessionFile, JSON.stringify(data, null, 2));
              console.log(`[CF] FlareSolverr: Bypass completato con successo per ${url}`);
              if (solution.url && solution.url !== url) {
                console.log(`[CF] Rilevato redirect: ${url} -> ${solution.url}`);
              }
              return data;
            } else {
              const errorMsg = response.data ? response.data.message : "Risposta non valida da FlareSolverr";
              throw new Error(errorMsg);
            }
          } catch (error) {
            console.error(`[CF] Errore FlareSolverr: ${error.message}`);
            if (error.code === "ECONNREFUSED") {
              console.error(`[CF] ASSICURATI CHE FLARESOLVERR SIA ATTIVO SU ${FLARE_URL}`);
            }
            throw error;
          } finally {
            activeBypasses.delete(provider);
          }
        }))();
        activeBypasses.set(provider, bypassPromise);
        return bypassPromise;
      });
    }
    module2.exports = { getClearance };
  }
});

// src/utils/cf_handler.js
var require_cf_handler = __commonJS({
  "src/utils/cf_handler.js"(exports2, module2) {
    var axios = require("axios");
    var fs = require("fs");
    var path = require("path");
    var { getClearance } = require_cf_bypass();
    var https = require("https");
    var http = require("http");
    var agentOptions = {
      keepAlive: true,
      maxSockets: 250,
      maxFreeSockets: 100,
      timeout: 3e4,
      keepAliveMsecs: 3e4
    };
    var httpsAgent = new https.Agent(agentOptions);
    var httpAgent = new http.Agent(agentOptions);
    var requestCache = /* @__PURE__ */ new Map();
    var CACHE_TTL = 6e5;
    function smartFetch(_0, _1) {
      return __async(this, arguments, function* (url, domain, options = {}) {
        const provider = options.provider || domain.replace(/https?:\/\//, "").split(".")[0];
        const sessionFile = path.join(process.cwd(), `cf-session-${provider}.json`);
        const cacheKey = `${options.method || "GET"}:${url}:${options.body || ""}`;
        if (requestCache.has(cacheKey)) {
          const cached = requestCache.get(cacheKey);
          if (Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
          }
        }
        const loadSession = () => {
          if (fs.existsSync(sessionFile)) {
            try {
              const data = JSON.parse(fs.readFileSync(sessionFile, "utf8"));
              if (data && data.userAgent) {
                const ageMs = Date.now() - (data.timestamp || 0);
                const twoHours = 2 * 60 * 60 * 1e3;
                if (ageMs > twoHours) {
                  console.log(`[CF-HANDLER][${provider}] Sessione su file troppo vecchia (${Math.round(ageMs / 6e4)} min), forzo refresh.`);
                  return {};
                }
                console.log(`[CF-HANDLER][${provider}] Sessione caricata da file (${Math.round(ageMs / 6e4)} min fa).`);
                return data;
              }
            } catch (e) {
              return {};
            }
          }
          return {};
        };
        let session = loadSession();
        let currentUrl = url;
        if (session.url) {
          try {
            const oldUrlObj = new URL(url);
            const sessUrlObj = new URL(session.url);
            if (oldUrlObj.hostname !== sessUrlObj.hostname) {
              console.log(`[CF-HANDLER][${provider}] Rilevato cambio dominio in sessione: ${oldUrlObj.hostname} -> ${sessUrlObj.hostname}`);
              oldUrlObj.hostname = sessUrlObj.hostname;
              oldUrlObj.protocol = sessUrlObj.protocol;
              currentUrl = oldUrlObj.toString();
            }
          } catch (e) {
            console.warn(`[CF-HANDLER][${provider}] Errore durante il check del dominio:`, e.message);
          }
        }
        const doRequest = (_02, ..._12) => __async(null, [_02, ..._12], function* (sess, targetUrl = currentUrl) {
          const mergedHeaders = __spreadValues({
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7"
          }, options.headers);
          if (sess.userAgent) {
            mergedHeaders["User-Agent"] = sess.userAgent;
          } else if (!mergedHeaders["User-Agent"]) {
            mergedHeaders["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
          }
          if (sess.cookies) {
            const existingCookies = mergedHeaders.Cookie || mergedHeaders.cookie || "";
            mergedHeaders.Cookie = existingCookies ? existingCookies.endsWith(";") ? `${existingCookies} ${sess.cookies}` : `${existingCookies}; ${sess.cookies}` : sess.cookies;
          }
          const response = yield axios({
            url: targetUrl,
            method: options.method || "GET",
            data: options.body,
            headers: mergedHeaders,
            httpsAgent,
            httpAgent,
            timeout: options.timeout || 2e4,
            validateStatus: false
          });
          const data = response.data;
          if (response.status >= 400 && response.status !== 403 && response.status !== 503) {
            console.error(`[CF-HANDLER][${provider}] Errore HTTP ${response.status} per ${targetUrl}`);
            const err = new Error(`HTTP ${response.status}`);
            err.response = { status: response.status, data };
            throw err;
          }
          return { data, status: response.status, headers: response.headers };
        });
        try {
          const res = yield doRequest(session);
          if (res.status === 403 || res.status === 503) {
            throw { response: res };
          }
          requestCache.set(cacheKey, { data: res.data, timestamp: Date.now() });
          return res.data;
        } catch (err) {
          if (err.response && (err.response.status === 403 || err.response.status === 503)) {
            console.warn(`[CF-HANDLER][${provider}] Blocco rilevato o sessione scaduta. Avvio bypass per ${url}...`);
            if (fs.existsSync(sessionFile)) {
              try {
                fs.unlinkSync(sessionFile);
              } catch (e) {
              }
            }
            const newSession = yield getClearance(url, provider, options);
            if (!newSession || !newSession.cookies) {
              throw new Error(`Bypass fallito per ${provider}: FlareSolverr non ha restituito cookie validi.`);
            }
            if (newSession.response) {
              console.log(`[CF-HANDLER][${provider}] Uso risposta diretta da FlareSolverr.`);
              requestCache.set(cacheKey, { data: newSession.response, timestamp: Date.now() });
              return newSession.response;
            }
            let finalUrl = currentUrl;
            if (newSession.url) {
              try {
                const oldUrlObj = new URL(url);
                const newUrlObj = new URL(newSession.url);
                if (oldUrlObj.hostname !== newUrlObj.hostname) {
                  console.log(`[CF-HANDLER][${provider}] Redirect rilevato durante bypass: ${oldUrlObj.hostname} -> ${newUrlObj.hostname}`);
                  oldUrlObj.hostname = newUrlObj.hostname;
                  oldUrlObj.protocol = newUrlObj.protocol;
                  finalUrl = oldUrlObj.toString();
                }
              } catch (e) {
              }
            }
            const res = yield doRequest(newSession, finalUrl);
            if (res.status === 403 || res.status === 503) {
              throw new Error(`Bypass inefficace per ${provider}: il sito continua a restituire ${res.status}`);
            }
            requestCache.set(cacheKey, { data: res.data, timestamp: Date.now() });
            return res.data;
          }
          throw err;
        }
      });
    }
    module2.exports = { smartFetch };
  }
});

// src/cinemacity/index.js
var { formatStream } = require_formatter();
var { checkQualityFromPlaylist } = require_quality_helper();
var { fetchWithTimeout } = require_fetch_helper();
var IS_SERVER = typeof process !== "undefined" && !!(process.versions && process.versions.node);
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
function getSessionCookies() {
  const cookieB64 = "ZGxlX3VzZXJfaWQ9MzI3Mjk7IGRsZV9wYXNzd29yZD04OTQxNzFjNmE4ZGFiMThlZTU5NGQ1YzY1MjAwOWEzNTs=";
  return base64Decode(cookieB64);
}
function getServerSmartFetch() {
  if (!IS_SERVER) return null;
  try {
    return require_cf_handler().smartFetch;
  } catch (e) {
    return null;
  }
}
function fetchHtml(_0) {
  return __async(this, arguments, function* (url, headers = {}, options = {}) {
    const useBypass = options && options.useBypass === true;
    const smartFetch = useBypass ? getServerSmartFetch() : null;
    if (typeof smartFetch === "function") {
      return yield smartFetch(url, BASE_URL, {
        timeout: FETCH_TIMEOUT,
        headers: __spreadValues({
          "User-Agent": USER_AGENT,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7"
        }, headers),
        provider: "cinemacity"
      });
    }
    const response = yield fetchWithTimeout(url, {
      timeout: FETCH_TIMEOUT,
      headers: __spreadValues({
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7"
      }, headers)
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return yield response.text();
  });
}
function decodeHtmlEntities(str) {
  return String(str || "").replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec))).replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&ndash;|&mdash;/g, "-").replace(/\u2013|\u2014/g, "-");
}
function getHttpStatusFromError(error) {
  const match = String(error && error.message ? error.message : error).match(/HTTP\s+(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : null;
}
function normalizeTitle(value) {
  return decodeHtmlEntities(String(value || "")).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9]+/g, "").trim();
}
function extractCandidateLinksFromListing(html, sectionType) {
  const pathPrefix = sectionType === "movie" ? "movies" : "tv-series";
  const regex = new RegExp(`<a[^>]+href=["']((?:https?:\\/\\/cinemacity\\.cc)?\\/${pathPrefix}\\/[^"']+\\.html)["'][^>]*>([\\s\\S]*?)<\\/a>`, "gi");
  const results = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    const href = String(match[1] || "").startsWith("/") ? `${BASE_URL}${match[1]}` : String(match[1] || "");
    const title = decodeHtmlEntities(String(match[2] || "").replace(/<[^>]+>/g, " ")).trim();
    if (!href || !title) continue;
    results.push({ url: href, title });
  }
  return Array.from(new Map(results.map((item) => [item.url, item])).values());
}
function scoreTitleMatch(candidateTitle, expectedTitles) {
  const normalizedCandidate = normalizeTitle(candidateTitle);
  if (!normalizedCandidate) return 0;
  let best = 0;
  for (const title of expectedTitles) {
    const normalizedExpected = normalizeTitle(title);
    if (!normalizedExpected) continue;
    if (normalizedCandidate === normalizedExpected) return 100;
    if (normalizedCandidate.includes(normalizedExpected) || normalizedExpected.includes(normalizedCandidate)) {
      best = Math.max(best, 80);
    } else {
      const words = normalizedExpected.length > 5 && normalizedCandidate.length > 5;
      if (words && (normalizedCandidate.startsWith(normalizedExpected) || normalizedExpected.startsWith(normalizedCandidate))) {
        best = Math.max(best, 60);
      }
    }
  }
  return best;
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
      const html = yield fetchHtml(candidateUrl, {
        "Referer": `${BASE_URL}/`,
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-User": "?1"
      }, {
        useBypass: false
      });
      return extractImdbIdFromHtml(html);
    } catch (_) {
      return null;
    }
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
function searchByImdb(_0) {
  return __async(this, arguments, function* (imdbId, options = {}) {
    const cookies = getSessionCookies();
    const trySearch = (query) => __async(null, null, function* () {
      const searchUrl = `${BASE_URL}/index.php?do=search&subaction=search&story=${query}`;
      try {
        const html = yield fetchHtml(searchUrl, {
          "Referer": `${BASE_URL}/`,
          "Cookie": cookies,
          "User-Agent": USER_AGENT,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7"
        }, options);
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
        const status = getHttpStatusFromError(e);
        if (status !== 403 && status !== 404) {
          console.error(`[CinemaCity] Search error for ${query}:`, e);
        }
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
function searchByTitleFallback(_0, _1) {
  return __async(this, arguments, function* (id, providerType, options = {}) {
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
    const listingBase = providerType === "movie" ? `${BASE_URL}/movies/` : `${BASE_URL}/tv-series/`;
    let bestResult = null;
    let bestScore = 0;
    const normalizedRequestedImdb = /^tt\d{5,}$/i.test(String(id || "").trim()) ? String(id).trim().toLowerCase() : null;
    for (let page = 1; ; page++) {
      const pageUrl = page === 1 ? listingBase : `${listingBase}page/${page}/`;
      try {
        const html = yield fetchHtml(pageUrl, {
          "Referer": `${BASE_URL}/`,
          "Upgrade-Insecure-Requests": "1",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "same-origin",
          "Sec-Fetch-User": "?1"
        }, options);
        const candidates = extractCandidateLinksFromListing(html, providerType);
        if (candidates.length === 0) {
          break;
        }
        for (const candidate of candidates) {
          const score = scoreTitleMatch(candidate.title, expectedTitles);
          if (score >= 80 && normalizedRequestedImdb) {
            const candidateImdbId = yield verifyCandidateImdb(candidate.url, normalizedRequestedImdb);
            if (candidateImdbId && candidateImdbId === normalizedRequestedImdb) {
              return candidate;
            }
            if (candidateImdbId && candidateImdbId !== normalizedRequestedImdb) {
              continue;
            }
          }
          if (score > bestScore) {
            bestScore = score;
            bestResult = candidate;
          }
        }
        if (bestScore >= 100) {
          return bestResult;
        }
      } catch (e) {
        const status = getHttpStatusFromError(e);
        if (status !== 404 && status !== 403) {
          console.error(`[CinemaCity] Listing fallback error for page ${pageUrl}:`, e);
        }
        break;
      }
    }
    return bestScore >= 80 ? bestResult : null;
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
function resolveUrl(baseUrl, relativeOrAbsoluteUrl) {
  try {
    return new URL(relativeOrAbsoluteUrl, baseUrl).toString();
  } catch (e) {
    return relativeOrAbsoluteUrl;
  }
}
function getOrigin(url) {
  try {
    return new URL(url).origin;
  } catch (e) {
    return BASE_URL;
  }
}
function extractPlayerReferer(html, pageUrl) {
  const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']*player\.php[^"']*)["']/i);
  if (!iframeMatch || !iframeMatch[1]) {
    return pageUrl;
  }
  return resolveUrl(pageUrl, iframeMatch[1]);
}
function parseCompositeSeriesId(rawId, season, episode) {
  const parsed = {
    normalizedId: String(rawId || "").trim(),
    season: Number.isInteger(season) ? season : Number.parseInt(season, 10) || 1,
    episode: Number.isInteger(episode) ? episode : Number.parseInt(episode, 10) || 1
  };
  const match = parsed.normalizedId.match(/^(tt\d+|\d+|tmdb:\d+):(\d+):(\d+)$/i);
  if (!match) {
    return parsed;
  }
  parsed.normalizedId = match[1];
  parsed.season = Number.parseInt(match[2], 10) || parsed.season;
  parsed.episode = Number.parseInt(match[3], 10) || parsed.episode;
  return parsed;
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
      const isStremioAddon = providerContext && providerContext.__requestContext === true;
      const useServerBypass = isStremioAddon && IS_SERVER;
      const proxyUrl = providerContext && providerContext.proxyUrl || (typeof global !== "undefined" && global.CF_PROXY_URL ? global.CF_PROXY_URL : null);
      const proxyPassword = providerContext && providerContext.proxyPassword || "";
      let searchResult = yield searchByImdb(imdbId, { useBypass: useServerBypass });
      if (!searchResult || !searchResult.url) {
        searchResult = yield searchByTitleFallback(imdbId, providerType, { useBypass: useServerBypass });
      }
      if (!searchResult || !searchResult.url) {
        return [];
      }
      const movieUrl = searchResult.url;
      let movieTitle = (searchResult.title || imdbId).replace(/\s*\(.*?\)\s*/g, "").trim();
      if (type === "tv" || type === "series") {
        movieTitle += ` ${season}x${episode}`;
      }
      if (isStremioAddon) {
        if (!proxyUrl) {
          return [];
        }
        let finalTargetUrl = movieUrl;
        if (type === "tv" || type === "series") {
          const separator = finalTargetUrl.includes("?") ? "&" : "?";
          finalTargetUrl += `${separator}s=${season}&e=${episode}`;
        }
        const passwordQuery = proxyPassword ? `&api_password=${encodeURIComponent(proxyPassword)}` : "";
        const extractorUrl = `${proxyUrl}/extractor/video.m3u8?host=city&d=${encodeURIComponent(finalTargetUrl)}&redirect_stream=true${passwordQuery}`;
        const stremioResult = {
          name: "CinemaCity",
          title: movieTitle,
          url: extractorUrl,
          quality: "1080p",
          type: "direct",
          behaviorHints: {
            notWebReady: true
          }
        };
        return [formatStream(stremioResult, "CinemaCity")];
      }
      const cookies = getSessionCookies();
      const html = yield fetchHtml(movieUrl, {
        "Referer": `${BASE_URL}/`,
        "Cookie": cookies,
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7"
      }, {
        useBypass: useServerBypass
      });
      const playerReferer = extractPlayerReferer(html, movieUrl);
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
        return [];
      }
      const streamUrl = pickStream(fileData, type, season, episode);
      if (!streamUrl) return [];
      const streamHeaders = {
        "User-Agent": USER_AGENT,
        "Referer": playerReferer,
        "Origin": getOrigin(movieUrl),
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.5",
        "Connection": "keep-alive",
        "Cookie": cookies
      };
      const finalResult = {
        name: "CinemaCity",
        title: movieTitle,
        url: streamUrl,
        quality: "1080p",
        type: "direct",
        headers: streamHeaders,
        behaviorHints: {
          notWebReady: true
        }
      };
      if (streamUrl.includes(".m3u8")) {
        const detectedQuality = yield checkQualityFromPlaylist(streamUrl, finalResult.headers);
        if (detectedQuality) finalResult.quality = detectedQuality;
      }
      return [formatStream(finalResult, "CinemaCity")];
    } catch (e) {
      console.error("[CinemaCity] Error:", e);
      return [];
    }
  });
}
module.exports = { getStreams };
