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
    function fetchWithTimeout2(_0) {
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
    module2.exports = { fetchWithTimeout: fetchWithTimeout2, createTimeoutSignal };
  }
});

// cf_bypass.js
var require_cf_bypass = __commonJS({
  "cf_bypass.js"(exports2, module2) {
    var { spawn, exec } = require("child_process");
    var path = require("path");
    var fs = require("fs");
    var activeBypasses = /* @__PURE__ */ new Map();
    var globalQueue = [];
    var activeGlobalRequests = 0;
    var MAX_GLOBAL_CONCURRENT = parseInt(process.env.SCRAPLING_MAX_CONCURRENT || "2", 10);
    var MAX_GLOBAL_QUEUE = parseInt(process.env.SCRAPLING_MAX_QUEUE || "20", 10);
    var GLOBAL_QUEUE_TIMEOUT = parseInt(process.env.SCRAPLING_QUEUE_TIMEOUT_MS || "60000", 10);
    var SCRAPLING_DEFAULT_TIMEOUT = parseInt(process.env.SCRAPLING_DEFAULT_TIMEOUT_MS || "90000", 10);
    var SCRAPLING_WATCHDOG_GRACE_MS = parseInt(process.env.SCRAPLING_WATCHDOG_GRACE_MS || "15000", 10);
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
          String(options.timeout || SCRAPLING_DEFAULT_TIMEOUT),
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
        if (provider) {
          args.push("--provider", provider);
        }
        console.log(`[SC][${provider}] Avvio bypass Scrapling per: ${url}`);
        const venvPython = path.join(process.cwd(), ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
        let pythonExe = "python3";
        if (fs.existsSync(venvPython)) {
          pythonExe = venvPython;
        } else if (process.platform === "win32") {
          pythonExe = "python";
        }
        const spawnOptions = {};
        if (process.platform !== "win32") {
          spawnOptions.detached = true;
        }
        const child = spawn(pythonExe, args, spawnOptions);
        let stdout = "";
        let stderr = "";
        const executionTimeout = (parseInt(options.timeout, 10) || SCRAPLING_DEFAULT_TIMEOUT) + SCRAPLING_WATCHDOG_GRACE_MS;
        let watchdog = setTimeout(() => {
          console.error(`[SC][${provider}] Watchdog timeout raggiunto (${executionTimeout}ms). Uccido l'albero dei processi.`);
          watchdog = null;
          if (process.platform === "win32") {
            exec(`taskkill /pid ${child.pid} /T /F`, (err) => {
              if (err) {
                console.error(`[SC][${provider}] taskkill fallito: ${err.message}`);
                try {
                  child.kill("SIGKILL");
                } catch (e) {
                }
              }
            });
          } else {
            try {
              process.kill(-child.pid, "SIGKILL");
            } catch (e) {
              try {
                child.kill("SIGKILL");
              } catch (err) {
              }
            }
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
        let existingCookies = "";
        if (fs.existsSync(sessionFile)) {
          try {
            const data = JSON.parse(fs.readFileSync(sessionFile, "utf8"));
            if (data && data.cookies) existingCookies = data.cookies;
          } catch (e) {
          }
        }
        if (existingCookies) {
          const existingHeaders = options.headers || {};
          existingHeaders.Cookie = existingCookies;
          options.headers = existingHeaders;
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
    module2.exports = { getClearance, hasActiveBypass, execPythonBypass, getStats: () => ({ active: activeGlobalRequests, queued: globalQueue.length }) };
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
            }
            const data = response.data;
            const responseUrl = ((_b2 = (_a2 = response.request) == null ? void 0 : _a2.res) == null ? void 0 : _b2.responseUrl) || ((_d = (_c = response.request) == null ? void 0 : _c._redirectable) == null ? void 0 : _d._currentUrl) || ((_e = response.config) == null ? void 0 : _e.url) || targetUrl;
            if (response.status >= 400 && response.status !== 403 && response.status !== 503) {
              const quietHttpErrors = reqOptions.quietHttpErrors === true || Array.isArray(reqOptions.quietHttpErrors) && reqOptions.quietHttpErrors.includes(response.status);
              if (!quietHttpErrors) {
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
            const isSamePath = (u1, u2) => {
              try {
                const p1 = new URL(u1).pathname.replace(/\/$/, "");
                const p2 = new URL(u2).pathname.replace(/\/$/, "");
                return p1 === p2;
              } catch (e) {
                return false;
              }
            };
            if (isUsefulHtml(newSession.response) && isSamePath(newSession.url, url)) {
              return newSession.response;
            }
            let finalUrl = bypassUrl === url ? currentUrl : bypassUrl;
            if (newSession.url) {
              try {
                const oldUrlObj = new URL(bypassUrl);
                const newUrlObj = new URL(newSession.url);
                const newSessionHasSpecificTarget = newUrlObj.pathname !== "/" || Boolean(newUrlObj.search) || Boolean(newUrlObj.hash);
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

// src/cinemacity/index.js
var { formatStream } = require_formatter();
var { fetchWithTimeout } = require_fetch_helper();
var IS_SERVER = typeof process !== "undefined" && process.versions && process.versions.node;
if (!IS_SERVER) {
  module.exports = {
    getStreams: (id, type, season, episode) => __async(null, null, function* () {
      try {
        const url = `https://easystreams.realbestia.com/resolve/cinemacity?id=${id}&type=${type}&s=${season || 1}&ep=${episode || 1}`;
        const response = yield fetch(url);
        const data = yield response.json();
        return data.streams || [];
      } catch (e) {
        console.error("[CinemaCity-Client] API Error:", e.message);
        return [];
      }
    })
  };
} else {
  let base64Decode = function(str) {
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
  }, getMappingApiUrl = function() {
    return "https://animemapping.realbestia.com";
  }, normalizeConfigBoolean = function(value) {
    if (value === true) return true;
    const normalized = String(value || "").trim().toLowerCase();
    return ["1", "true", "yes", "on", "enabled", "checked"].includes(normalized);
  }, getMappingLanguage = function(providerContext = null) {
    return "it";
  }, decodeHtmlEntities = function(str) {
    return String(str || "").replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec))).replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&ndash;|&mdash;/g, "-").replace(/\u2013|\u2014/g, "-");
  }, getHttpStatusFromError = function(error) {
    var _a;
    const responseStatus = Number.parseInt(String(((_a = error == null ? void 0 : error.response) == null ? void 0 : _a.status) || ""), 10);
    if (Number.isInteger(responseStatus)) return responseStatus;
    const match = String(error && error.message ? error.message : error).match(/HTTP\s+(\d+)/i);
    return match ? Number.parseInt(match[1], 10) : null;
  }, isCloudflareBlockedError = function(error) {
    var _a, _b, _c;
    const message = [error == null ? void 0 : error.message, (_b = (_a = error == null ? void 0 : error.response) == null ? void 0 : _a.data) == null ? void 0 : _b.message, (_c = error == null ? void 0 : error.response) == null ? void 0 : _c.data].filter(Boolean).join(" ");
    return /Cloudflare has blocked this request|Error solving the challenge/i.test(message);
  }, normalizeTitle = function(value) {
    return decodeHtmlEntities(String(value || "")).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
  }, compactTitle = function(value) {
    return normalizeTitle(value).replace(/\s+/g, "");
  }, extractYearFromMetadata = function(metadata) {
    const date = (metadata == null ? void 0 : metadata.release_date) || (metadata == null ? void 0 : metadata.first_air_date) || "";
    const year = Number.parseInt(String(date).slice(0, 4), 10);
    return Number.isInteger(year) ? year : null;
  }, getSignificantTokens = function(value) {
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
  }, parseSitemapEntries = function(xml) {
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
  }, scoreSitemapEntry = function(entry, expectedTitles, expectedYear) {
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
  }, extractImdbIdFromHtml = function(html) {
    const matches = String(html || "").match(/\btt\d{5,}\b/gi) || [];
    for (const match of matches) {
      if (/^tt\d{5,}$/i.test(match)) {
        return match.toLowerCase();
      }
    }
    return null;
  }, parseCompositeSeriesId = function(rawId, season, episode) {
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
  }, buildDownloadUrl = function(fileVal, movieTitle) {
    const baseEnd = fileVal.indexOf("/public_files/");
    if (baseEnd === -1) return null;
    const cdnBase = fileVal.substring(0, baseEnd + "/public_files/".length);
    let rest = fileVal.substring(baseEnd + "/public_files/".length);
    const queryIdx = rest.indexOf("?");
    const cleanRest = queryIdx !== -1 ? rest.substring(0, queryIdx) : rest;
    const parts = cleanRest.split(",");
    const video = parts.find((p) => p.includes("1080p") && p.endsWith(".mp4")) || parts.find((p) => p.includes("720p") && p.endsWith(".mp4")) || parts.find((p) => p.includes("480p") && p.endsWith(".mp4")) || parts.find((p) => p.includes("360p") && p.endsWith(".mp4")) || parts.find((p) => p.endsWith(".mp4"));
    if (!video) return null;
    let quality = "1080p";
    if (video.includes("720p")) quality = "720p";
    else if (video.includes("480p")) quality = "480p";
    else if (video.includes("360p")) quality = "360p";
    else if (video.includes("2160p") || video.includes("4k")) quality = "2160p";
    const itaAudio = parts.find((p) => /italian|italiano/i.test(p) && p.endsWith(".m4a"));
    const engAudio = parts.find((p) => /english|inglese/i.test(p) && p.endsWith(".m4a"));
    const fallbackAudio = parts.find((p) => p.endsWith(".m4a"));
    const selectedAudio = itaAudio || engAudio || fallbackAudio;
    const m3u8Entry = parts.find((p) => p.includes(".m3u8"));
    let url = cdnBase + cleanRest + (m3u8Entry ? "" : ".urlset/master.m3u8");
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.set("action", "download");
      urlObj.searchParams.set("video", video);
      if (selectedAudio) {
        urlObj.searchParams.set("audio", selectedAudio);
      }
      const cleanTitle = movieTitle.replace(/[^a-zA-Z0-9]/g, ".");
      const langTag = itaAudio ? "Italian" : engAudio ? "English" : "Multi";
      urlObj.searchParams.set("name", `${cleanTitle}.${quality}.${langTag}`);
      const subtitles = parts.filter((p) => p.endsWith(".vtt"));
      if (subtitles.length > 0) {
        urlObj.searchParams.set("subtitle", subtitles.join(","));
      }
      url = urlObj.toString();
    } catch (e) {
      url = cdnBase + rest + (m3u8Entry ? "" : ".urlset/master.m3u8");
    }
    return { url, hasItalian: !!itaAudio, quality };
  }, extractStreamFromAtob = function(html, movieTitle, season, episode) {
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
                  }
                }
              }
              const fileVal = parsed[0].file;
              if (fileVal && fileVal.startsWith("http")) {
                const dlUrl = buildDownloadUrl(fileVal, movieTitle);
                if (dlUrl) return dlUrl;
              }
            }
          } catch (e) {
          }
        }
      } catch (e) {
      }
    }
    return null;
  }, extractDownloadLinks = function(html) {
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
  }, resolveUrl = function(base, relative) {
    try {
      return new URL(relative, base).toString();
    } catch (e) {
      return relative;
    }
  };
  const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  const BASE_URL = base64Decode("aHR0cHM6Ly9jaW5lbWFjaXR5LmNj");
  const USER_AGENT = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
  const FETCH_TIMEOUT = 1e4;
  const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
  const SITEMAP_URL = `${BASE_URL}/news_pages.xml`;
  const SITEMAP_CACHE_MS = 60 * 60 * 1e3;
  let sitemapCache = null;
  function fetchViaWorker(url) {
    return __async(this, null, function* () {
      const { smartFetch } = require_cf_handler();
      const targetUrl = url.startsWith("http") ? url : `${BASE_URL.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;
      return yield smartFetch(targetUrl, BASE_URL, { provider: "cinemacity" });
    });
  }
  function fetchSitemapEntries(providerContext = null) {
    return __async(this, null, function* () {
      if (sitemapCache && sitemapCache.expiresAt > Date.now()) {
        return sitemapCache.entries;
      }
      const fs = require("fs");
      const path = require("path");
      const SITEMAP_CACHE_FILE = path.join(process.cwd(), "cinemacity-sitemap.json");
      const SITEMAP_DISK_CACHE_MS = 1 * 60 * 60 * 1e3;
      if (IS_SERVER && fs.existsSync(SITEMAP_CACHE_FILE)) {
        try {
          const stats = fs.statSync(SITEMAP_CACHE_FILE);
          const ageMs = Date.now() - stats.mtimeMs;
          if (ageMs < SITEMAP_DISK_CACHE_MS) {
            const fileContent = fs.readFileSync(SITEMAP_CACHE_FILE, "utf8");
            const cachedEntries = JSON.parse(fileContent);
            if (Array.isArray(cachedEntries) && cachedEntries.length > 0) {
              sitemapCache = {
                entries: cachedEntries,
                expiresAt: Date.now() + SITEMAP_CACHE_MS
              };
              console.log(`[CinemaCity] Sitemap caricata da cache su disco: ${cachedEntries.length} elementi`);
              return cachedEntries;
            }
          }
        } catch (err) {
          console.warn("[CinemaCity] Errore lettura cache sitemap da disco:", err.message);
        }
      }
      console.log("[CinemaCity] Fetching sitemap catalog da remoto...");
      try {
        const { smartFetch } = require_cf_handler();
        const xml = yield smartFetch(SITEMAP_URL, BASE_URL, { provider: "cinemacity" });
        const entries = parseSitemapEntries(xml);
        sitemapCache = {
          entries,
          expiresAt: Date.now() + SITEMAP_CACHE_MS
        };
        if (IS_SERVER && entries.length > 0) {
          try {
            fs.writeFileSync(SITEMAP_CACHE_FILE, JSON.stringify(entries));
            console.log(`[CinemaCity] Sitemap salvata su disco: ${entries.length} elementi`);
          } catch (err) {
            console.warn("[CinemaCity] Errore scrittura cache sitemap su disco:", err.message);
          }
        }
        console.log(`[CinemaCity] Sitemap catalog loaded: ${entries.length} entries`);
        return entries;
      } catch (e) {
        if (IS_SERVER && fs.existsSync(SITEMAP_CACHE_FILE)) {
          try {
            const fileContent = fs.readFileSync(SITEMAP_CACHE_FILE, "utf8");
            const cachedEntries = JSON.parse(fileContent);
            if (Array.isArray(cachedEntries) && cachedEntries.length > 0) {
              console.log(`[CinemaCity] Fetch remoto sitemap fallito, uso sitemap scaduta su disco: ${cachedEntries.length} elementi`);
              return cachedEntries;
            }
          } catch (fallbackErr) {
          }
        }
        console.error("[CinemaCity] Error loading sitemap catalog:", e);
        throw e;
      }
    });
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
        let hasItalian = false;
        if (links.length === 0) {
          const useSeason = providerType === "tv" ? season : null;
          const useEpisode = providerType === "tv" ? episode : null;
          const atobResult = extractStreamFromAtob(html, movieTitle, useSeason, useEpisode);
          if (atobResult) {
            links.push({ url: atobResult.url, text: "" });
            hasItalian = atobResult.hasItalian;
          }
        }
        let selectedUrl = null;
        if (links.length === 0) {
          console.log(`[CinemaCity] No streams available`);
          return [];
        }
        for (const link of links) {
          const text = link.text;
          if (text.includes("ita") || text.includes("italian") || text.includes("italiano")) {
            selectedUrl = link.url;
            hasItalian = true;
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
        const buildResult = buildDownloadUrl(selectedUrl, movieTitle);
        const streamUrl = buildResult ? buildResult.url : resolveUrl(movieUrl, selectedUrl);
        const resolvedQuality = buildResult && buildResult.quality ? buildResult.quality : "1080p";
        if (buildResult && buildResult.hasItalian) {
          hasItalian = true;
        }
        console.log(`[CinemaCity] Direct stream: ${streamUrl}`);
        const result = {
          name: "CinemaCity",
          title,
          url: streamUrl,
          quality: resolvedQuality,
          type: "hls",
          language: hasItalian ? "Italian" : "",
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
}
