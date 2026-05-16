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

// src/extractors/common.js
var require_common = __commonJS({
  "src/extractors/common.js"(exports2, module2) {
    var USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
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
      USER_AGENT,
      unPack,
      getProxiedUrl,
      isFlareSolverrBlockedError
    };
  }
});

// src/extractors/vidxgo.js
var require_vidxgo = __commonJS({
  "src/extractors/vidxgo.js"(exports2, module2) {
    var { spawn } = require("child_process");
    var path = require("path");
    var fs = require("fs");
    var { USER_AGENT } = require_common();
    function getPythonExe() {
      const venvPython = path.join(process.cwd(), ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
      if (fs.existsSync(venvPython)) return venvPython;
      if (process.platform === "win32") return "python";
      return "python3";
    }
    function bypassAndExtract(url, referer = null) {
      return __async(this, null, function* () {
        const scriptPath = path.join(__dirname, "..", "utils", "vidxgo_bypass.py");
        const pythonExe = getPythonExe();
        const args = [
          scriptPath,
          url,
          "--referer",
          referer || "https://altadefinizione.you/"
        ];
        return new Promise((resolve, reject) => {
          const child = spawn(pythonExe, args);
          let stdout = "";
          let stderr = "";
          child.stdout.on("data", (data) => {
            stdout += data.toString();
          });
          child.stderr.on("data", (data) => {
            stderr += data.toString();
          });
          child.on("close", (code) => {
            if (code !== 0) console.error("[VidxGo] Python script exited with code", code, "stderr:", stderr);
            if (stdout.trim()) {
              try {
                const result = JSON.parse(stdout);
                if (result.status === "ok" && result.stream_url) {
                  resolve(result.stream_url);
                  return;
                }
                console.warn("[VidxGo] Python script returned error:", result.error || "unknown");
                resolve(null);
              } catch (e) {
                console.warn("[VidxGo] Failed to parse Python output:", stdout.substring(0, 200));
                resolve(null);
              }
            } else {
              console.warn("[VidxGo] Python script returned empty stdout, stderr:", stderr);
              resolve(null);
            }
          });
          child.on("error", () => resolve(null));
        });
      });
    }
    function extractVidxGo(url, referer = null) {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          const streamUrl = yield bypassAndExtract(url, referer);
          if (streamUrl) {
            console.log("[VidxGo] Real stream URL extracted:", streamUrl);
            const vidxgoOrigin = new URL(url).origin;
            return {
              url: streamUrl,
              headers: {
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0",
                "Referer": url,
                "Origin": vidxgoOrigin,
                "Accept": "*/*",
                "Accept-Language": "en-US,en;q=0.9",
                "Sec-GPC": "1",
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "cross-site",
                "DNT": "1",
                "Priority": "u=0"
              }
            };
          }
          return { url, headers: { "User-Agent": USER_AGENT, "Referer": referer || url } };
        } catch (e) {
          console.error("[VidxGo] Extraction error:", e);
          return null;
        }
      });
    }
    module2.exports = { extractVidxGo };
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
    var USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
    function checkQualityFromPlaylist(_0) {
      return __async(this, arguments, function* (url, headers = {}) {
        try {
          if (!url.includes(".m3u8")) return null;
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
    module2.exports = { checkQualityFromPlaylist, getQualityFromUrl, checkQualityFromText };
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
      if (text.includes("mixdrop") || text.includes("m1xdrop") || text.includes("mxcontent")) {
        return true;
      }
      if (text.includes("loadm") || text.includes("loadm.cam")) {
        return true;
      }
      return false;
    }
    function formatStream(stream, providerName) {
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
    module2.exports = { formatStream };
  }
});

// cf_bypass.js
var require_cf_bypass = __commonJS({
  "cf_bypass.js"(exports2, module2) {
    var { spawn } = require("child_process");
    var path = require("path");
    var fs = require("fs");
    var activeBypasses = /* @__PURE__ */ new Map();
    var globalQueue = [];
    var activeGlobalRequests = 0;
    var MAX_GLOBAL_CONCURRENT = parseInt(process.env.SCRAPLING_MAX_CONCURRENT || "2", 10);
    var MAX_GLOBAL_QUEUE = parseInt(process.env.SCRAPLING_MAX_QUEUE || "20", 10);
    var GLOBAL_QUEUE_TIMEOUT = parseInt(process.env.SCRAPLING_QUEUE_TIMEOUT_MS || "60000", 10);
    function createRelease() {
      let released = false;
      return () => {
        if (released) return;
        released = true;
        activeGlobalRequests = Math.max(0, activeGlobalRequests - 1);
        drainGlobalQueue();
      };
    }
    function drainGlobalQueue() {
      while (activeGlobalRequests < MAX_GLOBAL_CONCURRENT && globalQueue.length > 0) {
        const entry = globalQueue.shift();
        if (!entry || entry.done) continue;
        entry.done = true;
        clearTimeout(entry.timeoutId);
        activeGlobalRequests++;
        console.log(`[SC] Slot Scrapling assegnato a [${entry.provider}]. Active=${activeGlobalRequests}, Queue=${globalQueue.length}`);
        entry.resolve(createRelease());
      }
    }
    function acquireGlobalSlot(provider, url) {
      if (activeGlobalRequests < MAX_GLOBAL_CONCURRENT) {
        activeGlobalRequests++;
        return Promise.resolve(createRelease());
      }
      if (globalQueue.length >= MAX_GLOBAL_QUEUE) {
        return Promise.reject(new Error(`Coda Scrapling piena (${globalQueue.length}/${MAX_GLOBAL_QUEUE}) per ${provider}`));
      }
      return new Promise((resolve, reject) => {
        const entry = {
          provider,
          url,
          done: false,
          resolve,
          reject,
          timeoutId: null
        };
        entry.timeoutId = setTimeout(() => {
          if (entry.done) return;
          entry.done = true;
          const index = globalQueue.indexOf(entry);
          if (index >= 0) globalQueue.splice(index, 1);
          reject(new Error(`Timeout coda Scrapling dopo ${GLOBAL_QUEUE_TIMEOUT}ms per ${provider}`));
        }, GLOBAL_QUEUE_TIMEOUT);
        globalQueue.push(entry);
        console.log(`[SC] In coda Scrapling [${provider}] Queue=${globalQueue.length}/${MAX_GLOBAL_CONCURRENT}: ${url}`);
      });
    }
    function execPythonBypass(url, provider, options = {}) {
      return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, "src", "utils", "scrapling_bypass.py");
        const args = [
          scriptPath,
          url,
          "--timeout",
          String(options.timeout || 6e4),
          "--wait-until",
          options.waitUntil || "domcontentloaded"
        ];
        if (options.method) {
          args.push("--method", options.method);
        }
        if (options.body) {
          args.push("--data", options.body);
        }
        if (options.headers) {
          args.push("--headers", JSON.stringify(options.headers));
        }
        console.log(`[SC][${provider}] Avvio bypass Scrapling per: ${url}`);
        const venvPython = path.join(process.cwd(), ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
        let pythonExe = "python3";
        if (fs.existsSync(venvPython)) {
          pythonExe = venvPython;
        } else if (process.platform === "win32") {
          pythonExe = "python";
        }
        const child = spawn(pythonExe, args);
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (data) => {
          stdout += data.toString();
        });
        child.stderr.on("data", (data) => {
          stderr += data.toString();
        });
        child.on("close", (code) => {
          let result;
          try {
            if (stdout.trim()) {
              result = JSON.parse(stdout);
            }
          } catch (e) {
          }
          if (result && result.status === "ok") {
            return resolve(result);
          }
          if (code !== 0) {
            console.error(`[SC][${provider}] Python script fallito con codice ${code}: ${stderr}`);
            return reject(new Error(stderr.trim() || `Python script exited with code ${code}`));
          }
          if (result && result.status === "error") {
            return reject(new Error(result.message));
          }
          if (!result) {
            console.error(`[SC][${provider}] Errore parsing output Python (Vuoto o non valido): ${stdout}`);
            reject(new Error(`Failed to parse Scrapling output: Empty or invalid JSON`));
          }
        });
      });
    }
    function runBypass(url, provider, options, sessionFile) {
      return __async(this, null, function* () {
        const releaseSlot = yield acquireGlobalSlot(provider, url);
        try {
          const result = yield execPythonBypass(url, provider, options);
          const cookiesList = Array.isArray(result.cookies) ? result.cookies : [];
          const cookiesStr = cookiesList.filter((c) => c && c.name && c.value).map((c) => `${c.name}=${c.value}`).join("; ");
          const cookieDomains = [...new Set(cookiesList.map((c) => c.domain).filter(Boolean))];
          const data = {
            userAgent: result.userAgent,
            cookies: cookiesStr,
            url: result.url,
            response: result.html,
            cookieDomains,
            requestHeaders: result.requestHeaders,
            timestamp: Date.now()
          };
          try {
            fs.writeFileSync(sessionFile, JSON.stringify(data, null, 2));
          } catch (e) {
            console.error(`[SC] Errore salvataggio sessione: ${e.message}`);
          }
          console.log(`[SC][${provider}] Bypass completato con successo.`);
          return data;
        } finally {
          releaseSlot();
        }
      });
    }
    function getClearance(_0) {
      return __async(this, arguments, function* (url, provider = "default", options = {}) {
        const sessionFile = path.join(process.cwd(), `cf-session-${provider}.json`);
        if (activeBypasses.has(provider)) {
          return activeBypasses.get(provider);
        }
        const bypassPromise = runBypass(url, provider, options, sessionFile).finally(() => {
          activeBypasses.delete(provider);
        });
        activeBypasses.set(provider, bypassPromise);
        return bypassPromise;
      });
    }
    module2.exports = { getClearance, getStats: () => ({ active: activeGlobalRequests, queued: globalQueue.length }) };
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
    var sessionCache = /* @__PURE__ */ new Map();
    function smartFetch(_0, _1) {
      return __async(this, arguments, function* (url, domain, options = {}) {
        var _a, _b;
        const getHost = (u) => {
          try {
            return new URL(u).hostname.replace("www.", "");
          } catch (e) {
            return u;
          }
        };
        const normalizeHost = (value) => String(value || "").trim().toLowerCase().replace(/^www\./, "").replace(/^\./, "");
        const rootDomain = (host) => {
          const parts = normalizeHost(host).split(".").filter(Boolean);
          return parts.length >= 2 ? parts.slice(-2).join(".") : parts.join(".");
        };
        const domainMatchesHost = (domainValue, hostValue) => {
          const cookieDomain = normalizeHost(domainValue);
          const host = normalizeHost(hostValue);
          if (!cookieDomain || !host) return false;
          return host === cookieDomain || host.endsWith(`.${cookieDomain}`) || cookieDomain.endsWith(`.${host}`);
        };
        const urlHost = getHost(url);
        const domainHost = getHost(domain);
        const providerFromHost = (host) => normalizeHost(host).split(".")[0] || "default";
        const provider = urlHost !== domainHost ? providerFromHost(urlHost) : options.provider || providerFromHost(domainHost);
        const sessionFileForProvider = (providerName) => path.join(process.cwd(), `cf-session-${providerName}.json`);
        const sessionFile = sessionFileForProvider(provider);
        const cacheKey = `${options.method || "GET"}:${url}:${options.body || ""}`;
        const loadSession = (providerName = provider, targetHost = urlHost) => {
          const targetSessionFile = sessionFileForProvider(providerName);
          if (providerName !== "guardoserie") {
            const cached = sessionCache.get(providerName);
            if (cached && cached.cookies && Date.now() - cached.timestamp < 115 * 60 * 1e3) {
              console.log(`[CF-HANDLER][${providerName}] Sessione caricata da memoria.`);
              return cached;
            }
          }
          if (fs.existsSync(targetSessionFile)) {
            try {
              const data = JSON.parse(fs.readFileSync(targetSessionFile, "utf8"));
              if (data && data.userAgent) {
                const ageMs = Date.now() - (data.timestamp || 0);
                const twoHours = 2 * 60 * 60 * 1e3;
                if (ageMs > twoHours) {
                  console.log(`[CF-HANDLER][${providerName}] Sessione su file troppo vecchia (${Math.round(ageMs / 6e4)} min), forzo refresh.`);
                  try {
                    fs.unlinkSync(targetSessionFile);
                  } catch (e) {
                  }
                  return {};
                }
                if (data.url) {
                  try {
                    const sessionHost = getHost(data.url);
                    const sessionRoot = rootDomain(sessionHost);
                    const currentRoot = rootDomain(targetHost);
                    const cookieDomains = Array.isArray(data.cookieDomains) ? data.cookieDomains : [];
                    const hasCookieForCurrentHost = cookieDomains.some((cookieDomain) => domainMatchesHost(cookieDomain, targetHost));
                    if (sessionRoot && currentRoot && sessionRoot !== currentRoot && !hasCookieForCurrentHost) {
                      console.log(`[CF-HANDLER][${providerName}] Sessione su dominio diverso (${sessionHost}) non valida per ${targetHost}, forzo refresh.`);
                      try {
                        fs.unlinkSync(targetSessionFile);
                      } catch (e) {
                      }
                      return {};
                    }
                  } catch (e) {
                  }
                }
                if (providerName !== "guardoserie") {
                  sessionCache.set(providerName, data);
                }
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
        }
        if (!session.cookies && provider === "guardoserie") {
          console.warn(`[CF-HANDLER][${provider}] Attenzione: richiesta avviata senza cookie di sessione!`);
        }
        const doRequest = (_02, _12, ..._2) => __async(null, [_02, _12, ..._2], function* (targetUrl, sess, reqOptions = {}) {
          var _a2, _b2, _c, _d, _e;
          const mergedHeaders = __spreadValues({
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7"
          }, reqOptions.headers);
          if (sess.userAgent) {
            mergedHeaders["user-agent"] = sess.userAgent;
            delete mergedHeaders["User-Agent"];
          } else if (!mergedHeaders["user-agent"] && !mergedHeaders["User-Agent"]) {
            mergedHeaders["user-agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
          }
          if (sess.cookies) {
            const existingCookies = mergedHeaders.Cookie || mergedHeaders.cookie || "";
            mergedHeaders.cookie = existingCookies ? existingCookies.endsWith(";") ? `${existingCookies} ${sess.cookies}` : `${existingCookies}; ${sess.cookies}` : sess.cookies;
            delete mergedHeaders["Cookie"];
          }
          if (sess.requestHeaders) {
            const browserHeaders = ["sec-ch-ua", "sec-ch-ua-mobile", "sec-ch-ua-platform", "sec-fetch-dest", "sec-fetch-mode", "sec-fetch-site"];
            for (const h of browserHeaders) {
              if (sess.requestHeaders[h]) mergedHeaders[h] = sess.requestHeaders[h];
            }
          }
          const startTime = Date.now();
          const requestTimeout = reqOptions.timeout ? reqOptions.timeout : sess.userAgent ? 6e4 : 3e4;
          console.log(`[CF-HANDLER][${provider}] Timeout impostato a: ${requestTimeout}ms`);
          const source = axios.CancelToken.source();
          let timeoutId;
          const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
              source.cancel("timeout");
              const err = new Error(`timeout of ${requestTimeout}ms exceeded`);
              err.code = "ECONNABORTED";
              reject(err);
            }, requestTimeout);
          });
          try {
            const axiosPromise = axios(__spreadValues({
              url: targetUrl,
              method: reqOptions.method || "GET",
              data: reqOptions.body,
              headers: mergedHeaders,
              httpsAgent,
              httpAgent,
              cancelToken: source.token,
              validateStatus: false,
              responseType: reqOptions.responseType || "text"
            }, reqOptions.axiosConfig));
            const response = yield Promise.race([axiosPromise, timeoutPromise]);
            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;
            if (sess.cookies) {
              console.log(`[CF-HANDLER][${provider}] Richiesta OK in ${duration}ms.`);
            }
            const data = response.data;
            const responseUrl = ((_b2 = (_a2 = response.request) == null ? void 0 : _a2.res) == null ? void 0 : _b2.responseUrl) || ((_d = (_c = response.request) == null ? void 0 : _c._redirectable) == null ? void 0 : _d._currentUrl) || ((_e = response.config) == null ? void 0 : _e.url) || targetUrl;
            if (response.status >= 400 && response.status !== 403 && response.status !== 503) {
              const quietHttpErrors = reqOptions.quietHttpErrors === true || Array.isArray(reqOptions.quietHttpErrors) && reqOptions.quietHttpErrors.includes(response.status);
              if (!quietHttpErrors) {
                console.error(`[CF-HANDLER][${provider}] Errore HTTP ${response.status} per ${responseUrl}`);
              }
              const err = new Error(`HTTP ${response.status}`);
              err.response = { status: response.status, data, url: responseUrl };
              throw err;
            }
            return { data, status: response.status, headers: response.headers, url: responseUrl };
          } catch (e) {
            clearTimeout(timeoutId);
            if (axios.isCancel(e) || e.code === "ECONNABORTED") {
              const timeoutErr = new Error(`timeout of ${requestTimeout}ms exceeded`);
              timeoutErr.code = "ECONNABORTED";
              throw timeoutErr;
            }
            throw e;
          }
        });
        const updateMetaFinalUrl = (res) => {
          if (!options.meta || !res || !res.url) return;
          try {
            const finalUrl = new URL(res.url).toString();
            if (finalUrl) options.meta.finalUrl = finalUrl;
          } catch (e) {
          }
        };
        const isUsefulHtml = (value) => {
          const text = typeof value === "string" ? value.trim() : "";
          if (text.length < 200) return false;
          if (/Just a moment|cf-browser-verification|turnstile|cf-challenge/i.test(text)) return false;
          return true;
        };
        const isCfStatus = (errorOrResponse) => {
          var _a2;
          if (errorOrResponse && (errorOrResponse.code === "ECONNABORTED" || ((_a2 = errorOrResponse.message) == null ? void 0 : _a2.includes("timeout")))) {
            return true;
          }
          const status = errorOrResponse && errorOrResponse.response ? errorOrResponse.response.status : errorOrResponse && errorOrResponse.status;
          return status === 403 || status === 503;
        };
        const isCfChallenge = (html) => {
          if (typeof html !== "string") return false;
          return /Just a moment|cf-browser-verification|turnstile|cf-challenge|Checking your browser/i.test(html);
        };
        const retryWithRedirectedSession = (challengeUrl) => __async(null, null, function* () {
          let challengeHost = "";
          try {
            challengeHost = getHost(challengeUrl);
          } catch (e) {
          }
          if (!challengeHost || challengeHost === urlHost) return null;
          const challengeProvider = providerFromHost(challengeHost);
          if (!challengeProvider || challengeProvider === provider) return null;
          const redirectedSession = loadSession(challengeProvider, challengeHost);
          if (!redirectedSession || !redirectedSession.cookies) return null;
          console.log(`[CF-HANDLER][${provider}] Redirect su ${challengeHost}: provo sessione esistente [${challengeProvider}] prima di FlareSolverr.`);
          try {
            const redirectedRes = yield doRequest(challengeUrl, redirectedSession, options);
            updateMetaFinalUrl(redirectedRes);
            if (redirectedRes.status === 403 || redirectedRes.status === 503) {
              try {
                fs.unlinkSync(sessionFileForProvider(challengeProvider));
              } catch (e) {
              }
              return null;
            }
            console.log(`[CF-HANDLER][${challengeProvider}] Redirect completato usando sessione esistente.`);
            return redirectedRes.data;
          } catch (retryErr) {
            if (isCfStatus(retryErr)) {
              try {
                fs.unlinkSync(sessionFileForProvider(challengeProvider));
              } catch (e) {
              }
              return null;
            }
            throw retryErr;
          }
        });
        try {
          const res = yield doRequest(currentUrl, session, options);
          updateMetaFinalUrl(res);
          if (res.status === 403 || res.status === 503 || res.status === 200 && isCfChallenge(res.data)) {
            throw { response: res };
          }
          if (session.cookies) {
            if (res.headers["set-cookie"]) {
            }
          }
          return res.data;
        } catch (err) {
          if (isCfStatus(err)) {
            if (options.skipBypassOnFailure) {
              throw err;
            }
            const errorMsg = err.code === "ECONNABORTED" || ((_a = err.message) == null ? void 0 : _a.includes("timeout")) ? "Timeout richiesta" : ((_b = err.response) == null ? void 0 : _b.status) || err.message;
            console.log(`[CF-HANDLER][${provider}] Fallimento sessione (${errorMsg}), avvio bypass Scrapling...`);
            const challengeUrl = err.response && err.response.url ? err.response.url : url;
            const redirectedData = yield retryWithRedirectedSession(challengeUrl);
            if (redirectedData !== null) {
              return redirectedData;
            }
            let bypassUrl = url;
            let bypassProvider = provider;
            try {
              const challengeHost = getHost(challengeUrl);
              if (challengeHost && challengeHost !== urlHost) {
                bypassUrl = challengeUrl;
                bypassProvider = providerFromHost(challengeHost);
              }
            } catch (e) {
            }
            const bypassSessionFile = sessionFileForProvider(bypassProvider);
            if (fs.existsSync(bypassSessionFile)) {
              try {
                fs.unlinkSync(bypassSessionFile);
              } catch (e) {
              }
            }
            const newSession = yield getClearance(bypassUrl, bypassProvider, options);
            if (!newSession) {
              throw new Error(`Bypass fallito per ${bypassProvider}`);
            }
            if (options.meta && newSession.url) {
              options.meta.finalUrl = newSession.url;
            }
            if (isUsefulHtml(newSession.response)) {
              return newSession.response;
            }
            let finalUrl = bypassUrl === url ? currentUrl : bypassUrl;
            if (newSession.url) {
              try {
                const oldUrlObj = new URL(bypassUrl);
                const newUrlObj = new URL(newSession.url);
                const newSessionHasSpecificTarget = newUrlObj.pathname !== "/" || Boolean(newUrlObj.search) || Boolean(newUrlObj.hash) || oldUrlObj.hostname === newUrlObj.hostname;
                if (newSessionHasSpecificTarget) {
                  finalUrl = newUrlObj.toString();
                  if (options.meta) options.meta.finalUrl = finalUrl;
                } else if (oldUrlObj.hostname !== newUrlObj.hostname) {
                  oldUrlObj.hostname = newUrlObj.hostname;
                  oldUrlObj.protocol = newUrlObj.protocol;
                  finalUrl = oldUrlObj.toString();
                  if (options.meta) options.meta.finalUrl = finalUrl;
                }
              } catch (e) {
              }
            }
            const res = yield doRequest(finalUrl, newSession);
            updateMetaFinalUrl(res);
            return res.data;
          }
          throw err;
        }
      });
    }
    module2.exports = { smartFetch };
  }
});

// src/guardaserie/index.js
var require_guardaserie = __commonJS({
  "src/guardaserie/index.js"(exports2, module2) {
    var IS_SERVER = typeof process !== "undefined" && process.versions && process.versions.node;
    if (!IS_SERVER) {
      module2.exports = {
        getStreams: (id, type, season, episode) => __async(null, null, function* () {
          try {
            const url = `https://easystreams.realbestia.com/resolve/guardaserie?id=${id}&type=${type}&s=${season || 1}&ep=${episode || 1}`;
            const response = yield fetch(url);
            const data = yield response.json();
            return data.streams || [];
          } catch (e) {
            console.error("[Guardaserie-Client] API Error:", e.message);
            return [];
          }
        })
      };
    } else {
      let getGuardaserieBaseUrl2 = function() {
        return "https://guardaserietv.rest";
      }, getMappingApiUrl2 = function() {
        return "https://animemapping.realbestia.com";
      }, normalizeConfigBoolean2 = function(value) {
        if (value === true) return true;
        const normalized = String(value || "").trim().toLowerCase();
        return ["1", "true", "yes", "on", "enabled", "checked"].includes(normalized);
      }, getMappingLanguage2 = function(providerContext = null) {
        const explicit = String((providerContext == null ? void 0 : providerContext.mappingLanguage) || "").trim().toLowerCase();
        if (explicit === "it") return "it";
        return normalizeConfigBoolean2(providerContext == null ? void 0 : providerContext.easyCatalogsLangIt) ? "it" : null;
      }, getQualityFromName2 = function(qualityStr) {
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
      }, getImdbId2 = function(tmdbId, type) {
        return __async2(this, null, function* () {
          try {
            const endpoint = type === "movie" ? "movie" : "tv";
            const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
            const response = yield fetch(url);
            if (!response.ok) return null;
            const data = yield response.json();
            if (data.imdb_id) return data.imdb_id;
            const externalUrl = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
            const extResponse = yield fetch(externalUrl);
            if (extResponse.ok) {
              const extData = yield extResponse.json();
              if (extData.imdb_id) return extData.imdb_id;
            }
            return null;
          } catch (e) {
            console.error("[Guardaserie] Conversion error:", e);
            return null;
          }
        });
      }, getShowInfo2 = function(tmdbId, type) {
        return __async2(this, null, function* () {
          try {
            const endpoint = type === "movie" ? "movie" : "tv";
            const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=it-IT`;
            const response = yield fetch(url);
            if (!response.ok) return null;
            return yield response.json();
          } catch (e) {
            console.error("[Guardaserie] TMDB error:", e);
            return null;
          }
        });
      }, getTmdbIdFromImdb2 = function(imdbId, type) {
        return __async2(this, null, function* () {
          var _a, _b;
          try {
            const url = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
            const response = yield fetch(url);
            if (!response.ok) return null;
            const data = yield response.json();
            if (type === "movie" && ((_a = data.movie_results) == null ? void 0 : _a.length) > 0) return data.movie_results[0].id;
            if (type === "tv") {
              if (((_b = data.tv_results) == null ? void 0 : _b.length) > 0) return data.tv_results[0].id;
              if (data.tv_episode_results && data.tv_episode_results.length > 0) return data.tv_episode_results[0].show_id;
              if (data.tv_season_results && data.tv_season_results.length > 0) return data.tv_season_results[0].show_id;
            }
            return null;
          } catch (e) {
            console.error("[Guardaserie] ID conversion error:", e);
            return null;
          }
        });
      }, getIdsFromKitsu2 = function(kitsuId, season, episode, providerContext = null) {
        return __async2(this, null, function* () {
          try {
            if (!kitsuId) return null;
            const params = new URLSearchParams();
            const parsedEpisode = parseInt(String(episode || ""), 10);
            const parsedSeason = parseInt(String(season || ""), 10);
            params.set("ep", Number.isInteger(parsedEpisode) && parsedEpisode > 0 ? String(parsedEpisode) : "1");
            if (Number.isInteger(parsedSeason) && parsedSeason >= 0) params.set("s", String(parsedSeason));
            params.set("lang", "it");
            const url = `${getMappingApiUrl2()}/kitsu/${encodeURIComponent(String(kitsuId).trim())}?${params.toString()}`;
            const response = yield fetch(url);
            if (!response.ok) return null;
            const payload = yield response.json();
            const ids = payload && payload.mappings && payload.mappings.ids ? payload.mappings.ids : {};
            const tmdbEpisode = payload && payload.mappings && (payload.mappings.tmdb_episode || payload.mappings.tmdbEpisode) || payload && (payload.tmdb_episode || payload.tmdbEpisode) || null;
            const tmdbId = ids && /^\d+$/.test(String(ids.tmdb || "").trim()) ? String(ids.tmdb).trim() : null;
            const imdbId = ids && /^tt\d+$/i.test(String(ids.imdb || "").trim()) ? String(ids.imdb).trim() : null;
            const mappedSeason = parseInt(String(tmdbEpisode && (tmdbEpisode.season || tmdbEpisode.seasonNumber || tmdbEpisode.season_number) || ""), 10);
            const mappedEpisode = parseInt(String(tmdbEpisode && (tmdbEpisode.episode || tmdbEpisode.episodeNumber || tmdbEpisode.episode_number) || ""), 10);
            const rawEpisodeNumber = parseInt(String(tmdbEpisode && (tmdbEpisode.rawEpisodeNumber || tmdbEpisode.raw_episode_number || tmdbEpisode.rawEpisode) || ""), 10);
            return {
              tmdbId,
              imdbId,
              mappedSeason: Number.isInteger(mappedSeason) && mappedSeason > 0 ? mappedSeason : null,
              mappedEpisode: Number.isInteger(mappedEpisode) && mappedEpisode > 0 ? mappedEpisode : null,
              rawEpisodeNumber: Number.isInteger(rawEpisodeNumber) && rawEpisodeNumber > 0 ? rawEpisodeNumber : null
            };
          } catch (e) {
            console.error("[Guardaserie] Kitsu mapping error:", e);
            return null;
          }
        });
      }, extractVidxGoFromHtml2 = function(html) {
        const imdbMatch = html.match(/show_imdb\s*=\s*['"](tt\d+)['"]/i);
        if (imdbMatch) {
          const numericId = imdbMatch[1].replace("tt", "");
          return `https://v.vidxgo.co/${numericId}`;
        }
        const scriptMatch = html.match(/vidxgo-frame['"]\.src\s*=\s*['"](https?:\/\/[^'"]+)['"]/i);
        if (scriptMatch) return scriptMatch[1];
        const concatMatch = html.match(/vidxgo\.co\/'\s*\+\s*['"](tt\d+)['"]/i);
        if (concatMatch) {
          const numericId = concatMatch[1].replace("tt", "");
          return `https://v.vidxgo.co/${numericId}`;
        }
        return null;
      }, getStreams3 = function(id, type, season, episode, providerContext = null) {
        if (String(type).toLowerCase() === "movie") return [];
        return __async2(this, null, function* () {
          const benchStart = Date.now();
          const bench = [];
          const mark = (step, meta = {}) => {
            if (!STEP_BENCH_ENABLED) return;
            bench.push(__spreadValues({ step, t: Date.now() - benchStart }, meta));
          };
          try {
            let tmdbId = id;
            let imdbId = null;
            let effectiveSeason = parseInt(String(season || ""), 10) || 1;
            let effectiveEpisode = parseInt(String(episode || ""), 10) || 1;
            const contextTmdbId = providerContext && /^\d+$/.test(String(providerContext.tmdbId || "")) ? String(providerContext.tmdbId) : null;
            const contextImdbId = providerContext && /^tt\d+$/i.test(String(providerContext.imdbId || "")) ? String(providerContext.imdbId) : null;
            const contextKitsuId = providerContext && /^\d+$/.test(String(providerContext.kitsuId || "")) ? String(providerContext.kitsuId) : null;
            if (id.toString().startsWith("kitsu:") || contextKitsuId) {
              const kitsuId = contextKitsuId || id.toString().split(":")[1];
              const mapped = yield getIdsFromKitsu2(kitsuId, season, episode, providerContext);
              mark("kitsu_mapping_done", { ok: Boolean(mapped && mapped.tmdbId) });
              if (mapped) {
                if (mapped.tmdbId) tmdbId = mapped.tmdbId;
                if (mapped.imdbId) imdbId = mapped.imdbId;
                if (mapped.mappedSeason && mapped.mappedEpisode) {
                  effectiveSeason = mapped.mappedSeason;
                  effectiveEpisode = mapped.mappedEpisode;
                } else if (mapped.rawEpisodeNumber) {
                  effectiveEpisode = mapped.rawEpisodeNumber;
                }
              }
            } else if (id.toString().startsWith("tt")) {
              imdbId = id.toString();
              tmdbId = contextTmdbId || tmdbId;
              mark("imdb_to_tmdb_done", { ok: true });
            } else if (id.toString().startsWith("tmdb:")) {
              tmdbId = id.toString().replace("tmdb:", "");
            }
            if (!imdbId && tmdbId) imdbId = contextImdbId || (yield getImdbId2(tmdbId, type));
            mark("imdb_resolve_done", { ok: Boolean(imdbId) });
            if (!imdbId) return [];
            let showUrl = null, showHtml = null;
            let matchedTitle = imdbId;
            if (imdbId) {
              const searchUrl = `${getGuardaserieBaseUrl2()}/index.php?do=search&subaction=search&story=${imdbId}`;
              const searchHtml = yield smartFetch(searchUrl, getGuardaserieBaseUrl2(), {
                headers: { "Referer": getGuardaserieBaseUrl2() }
              });
              if (searchHtml) {
                const match = /<div class="mlnh-2">\s*<h2>\s*<a href="([^"]+)" title="([^"]+)">/i.exec(searchHtml);
                if (match && !match[2].toUpperCase().includes("[SUB ITA]")) {
                  showUrl = match[1].startsWith("/") ? `${getGuardaserieBaseUrl2()}${match[1]}` : match[1];
                  matchedTitle = match[2] || imdbId;
                  const pageHtml = yield smartFetch(showUrl, getGuardaserieBaseUrl2(), {
                    headers: { "Referer": getGuardaserieBaseUrl2() }
                  });
                  if (pageHtml) showHtml = pageHtml;
                }
              }
              mark("search_by_imdb_done", { ok: Boolean(showUrl) });
            }
            if (!showUrl || !showHtml) return [];
            const displayName = `${matchedTitle} ${effectiveSeason}x${effectiveEpisode}`;
            const streams = [];
            const vidxgoUrl = extractVidxGoFromHtml2(showHtml);
            if (vidxgoUrl) {
              const vidxgoSeasonEpisodeUrl = `${vidxgoUrl}/${effectiveSeason}/${effectiveEpisode}`;
              const vidxgoStream = yield extractVidxGo(vidxgoSeasonEpisodeUrl, showUrl);
              if (vidxgoStream && vidxgoStream.url) {
                streams.push({ url: vidxgoStream.url, easyProxySourceUrl: vidxgoSeasonEpisodeUrl, headers: vidxgoStream.headers, name: "Guardaserie - VidxGo", title: displayName, quality: getQualityFromName2("HD"), type: "direct" });
              }
            }
            mark("vidxgo_extracted", { ok: Boolean(vidxgoUrl) });
            const finalStreams = streams.map((s) => formatStream(s, "Guardaserie")).filter((s) => s !== null);
            mark("extractors_done", { streams: finalStreams.length });
            if (STEP_BENCH_ENABLED) {
              console.log(`[GuardaserieBench] ${JSON.stringify({ id: String(id), type: String(type), totalMs: Date.now() - benchStart, steps: bench })}`);
            }
            return finalStreams;
          } catch (e) {
            if (STEP_BENCH_ENABLED) {
              console.log(`[GuardaserieBench] ${JSON.stringify({ id: String(id), type: String(type), totalMs: Date.now() - benchStart, failed: true, steps: bench, error: e && e.message ? e.message : String(e) })}`);
            }
            console.error("[Guardaserie] Error:", e);
            return [];
          }
        });
      };
      getGuardaserieBaseUrl = getGuardaserieBaseUrl2, getMappingApiUrl = getMappingApiUrl2, normalizeConfigBoolean = normalizeConfigBoolean2, getMappingLanguage = getMappingLanguage2, getQualityFromName = getQualityFromName2, getImdbId = getImdbId2, getShowInfo = getShowInfo2, getTmdbIdFromImdb = getTmdbIdFromImdb2, getIdsFromKitsu = getIdsFromKitsu2, extractVidxGoFromHtml = extractVidxGoFromHtml2, getStreams2 = getStreams3;
      __async2 = (__this, __arguments, generator) => {
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
      const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
      const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
      const { extractVidxGo } = require_vidxgo();
      require_fetch_helper();
      const { checkQualityFromPlaylist } = require_quality_helper();
      const { formatStream } = require_formatter();
      const { smartFetch } = require_cf_handler();
      const STEP_BENCH_ENABLED = String(process.env.PROVIDER_STEP_BENCH || "").trim().toLowerCase() === "1";
      module2.exports = { getStreams: getStreams3 };
    }
    var __async2;
    var getGuardaserieBaseUrl;
    var getMappingApiUrl;
    var normalizeConfigBoolean;
    var getMappingLanguage;
    var getQualityFromName;
    var getImdbId;
    var getShowInfo;
    var getTmdbIdFromImdb;
    var getIdsFromKitsu;
    var extractVidxGoFromHtml;
    var getStreams2;
  }
});

// src/guardaserie_ec/index.js
var baseProvider = require_guardaserie();
function getStreams(id, type, season, episode, providerContext = null) {
  return __async(this, null, function* () {
    return yield baseProvider.getStreams(id, type, season, episode, __spreadProps(__spreadValues({}, providerContext || {}), {
      easyCatalogsLangIt: true,
      mappingLanguage: "it"
    }));
  });
}
module.exports = { getStreams };
