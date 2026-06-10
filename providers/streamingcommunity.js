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
        const executionTimeout = (parseInt(options.timeout, 10) || 6e4) + 1e4;
        let watchdog = setTimeout(() => {
          console.error(`[SC][${provider}] Watchdog timeout raggiunto (${executionTimeout}ms). Uccido il processo Python.`);
          watchdog = null;
          try {
            child.kill("SIGKILL");
          } catch (e) {
          }
        }, executionTimeout);
        child.on("error", (err) => {
          if (watchdog) {
            clearTimeout(watchdog);
            watchdog = null;
          }
          reject(new Error(`Impossibile avviare Python (${pythonExe}): ${err.message}`));
        });
        child.stdout.on("data", (data) => {
          stdout += data.toString();
        });
        child.stderr.on("data", (data) => {
          stderr += data.toString();
        });
        child.on("close", (code) => {
          if (watchdog) {
            clearTimeout(watchdog);
            watchdog = null;
          }
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
          if (result && result.status === "error") {
            return reject(new Error(result.message || "Unknown Scrapling error"));
          }
          if (code !== 0) {
            console.error(`[SC][${provider}] Python script fallito con codice ${code}: ${stderr}`);
            return reject(new Error(stderr.trim() || `Python script exited with code ${code}`));
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
    function hasActiveBypass(provider) {
      return activeBypasses.has(provider);
    }
    module2.exports = { getClearance, hasActiveBypass, getStats: () => ({ active: activeGlobalRequests, queued: globalQueue.length }) };
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
    function smartFetch2(_0, _1) {
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
    module2.exports = { smartFetch: smartFetch2 };
  }
});

// src/streamingcommunity/index.js
function getStreamingCommunityBaseUrl() {
  return "https://vixsrc.to";
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
var { smartFetch } = require_cf_handler();
function safeRequire(modulePath) {
  try {
    return require(modulePath);
  } catch (e) {
    return null;
  }
}
var guardahd = safeRequire("../guardahd/index");
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
  return {
    "User-Agent": USER_AGENT,
    "Referer": embedUrl,
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
      const isProxyMode = Boolean(providerContext == null ? void 0 : providerContext.proxyUrl);
      const proxySocks = STREAMINGCOMMUNITY_PROXY || typeof process !== "undefined" && process.env.SOCKS5_PROXY || "";
      const useProxyFetch = isProxyMode && proxySocks && typeof ProxyAgent === "function";
      let proxyAgent = null;
      if (useProxyFetch) {
        try {
          proxyAgent = new ProxyAgent(proxySocks);
          console.log(`[StreamingCommunity] Using SOCKS5 proxy for fetches`);
        } catch (e) {
          console.warn(`[StreamingCommunity] Failed to create proxy agent: ${e.message}`);
        }
      }
      let apiData;
      try {
        console.log(`[StreamingCommunity] Fetching API: ${apiUrl}`);
        apiData = yield smartFetch(apiUrl, baseUrl, {
          headers: commonHeaders,
          timeout: 15e3,
          quietHttpErrors: true,
          meta: {}
        });
      } catch (e) {
        console.error(`[StreamingCommunity] Failed to fetch page: ${e.message}`);
        return [];
      }
      const apiPayload = (() => {
        try {
          return JSON.parse(apiData);
        } catch (e) {
          return null;
        }
      })();
      const embedUrl = extractEmbedSrcFromApiPayload(apiPayload);
      if (!embedUrl) {
        console.log("[StreamingCommunity] Could not find embed src in API payload");
        return [];
      }
      let embedHtml;
      try {
        console.log(`[StreamingCommunity] Fetching embed: ${embedUrl}`);
        embedHtml = yield smartFetch(embedUrl, baseUrl, {
          headers: getEmbedHeaders(embedUrl),
          timeout: 15e3,
          quietHttpErrors: true
        });
      } catch (e) {
        console.error(`[StreamingCommunity] Failed to fetch embed: ${e.message}`);
        return [];
      }
      if (!embedHtml) return [];
      const masterPlaylist = extractMasterPlaylistFromEmbedHtml(embedHtml);
      if (!masterPlaylist) {
        console.log("[StreamingCommunity] Could not find playlist info in HTML");
        return [];
      }
      const separator = masterPlaylist.url.includes("?") ? "&" : "?";
      const streamUrl = `${masterPlaylist.url}${separator}token=${encodeURIComponent(masterPlaylist.token)}&expires=${encodeURIComponent(masterPlaylist.expires)}&h=1&lang=it`;
      const streamHeaders = getPlaylistHeaders(embedUrl);
      console.log(`[StreamingCommunity] Final stream URL: ${streamUrl}`);
      let quality = "1080p";
      let hasItalianAudio = false;
      let playlistFetched = false;
      try {
        const playlistText = yield smartFetch(streamUrl, baseUrl, {
          headers: streamHeaders,
          timeout: 5e3,
          quietHttpErrors: true
        });
        if (playlistText) {
          playlistFetched = true;
          hasItalianAudio = /#EXT-X-MEDIA:TYPE=AUDIO.*(?:LANGUAGE="it"|LANGUAGE="ita"|NAME="Italian"|NAME="Ita")/i.test(playlistText);
          const detected = checkQualityFromText(playlistText);
          if (detected) quality = detected;
          const originalLanguageItalian = metadata && (metadata.original_language === "it" || metadata.original_language === "ita");
          if (!hasItalianAudio && !originalLanguageItalian) {
            console.log(`[StreamingCommunity] No Italian audio found. Showing without flag.`);
          }
        }
      } catch (e) {
        console.warn(`[StreamingCommunity] Playlist pre-check failed, continuing:`, e);
      }
      const normalizedQuality = getQualityFromName(quality);
      const hasOriginalItalian = metadata && (metadata.original_language === "it" || metadata.original_language === "ita");
      const isItalianAudio = playlistFetched ? hasItalianAudio : true;
      const resultLanguage = isItalianAudio || hasOriginalItalian ? "Italian" : "";
      if (providerContext == null ? void 0 : providerContext.proxyUrl) {
        const rawPageUrl = url.endsWith("/") ? url : `${url}/`;
        console.log(`[StreamingCommunity] Proxy enabled, returning raw page URL: ${rawPageUrl}`);
        const result2 = {
          name: `StreamingCommunity`,
          title: finalDisplayName,
          url: rawPageUrl,
          easyProxySourceUrl: rawPageUrl,
          quality: normalizedQuality,
          type: "direct",
          language: resultLanguage,
          behaviorHints: {
            notWebReady: false
          }
        };
        return [formatStream(result2, "StreamingCommunity")].filter((s) => s !== null);
      }
      const result = {
        name: `StreamingCommunity`,
        title: finalDisplayName,
        url: streamUrl,
        easyProxySourceUrl: embedUrl,
        quality: normalizedQuality,
        type: "direct",
        headers: streamHeaders,
        behaviorHints: {
          notWebReady: false
        },
        language: resultLanguage
      };
      return [formatStream(result, "StreamingCommunity")].filter((s) => s !== null);
    } catch (error) {
      console.error("[StreamingCommunity] Error:", error);
      return [];
    }
  });
}
module.exports = { getStreams };
