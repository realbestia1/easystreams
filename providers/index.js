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
    var USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    function getProxiedUrl(url) {
      let proxyUrl = null;
      try {
        if (typeof global !== "undefined" && global.CF_PROXY_URL) {
          proxyUrl = global.CF_PROXY_URL;
        } else if (typeof process !== "undefined" && process.env && process.env.CF_PROXY_URL) {
          proxyUrl = process.env.CF_PROXY_URL;
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
    module2.exports = {
      USER_AGENT,
      unPack,
      getProxiedUrl
    };
  }
});

// src/extractors/mixdrop.js
var require_mixdrop = __commonJS({
  "src/extractors/mixdrop.js"(exports2, module2) {
    var { USER_AGENT, unPack } = require_common();
    function extractMixDrop(url, refererBase = "https://m1xdrop.net/") {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": refererBase
            }
          });
          if (!response.ok) return null;
          const html = yield response.text();
          const packedRegex = /eval\(function\(p,a,c,k,e,d\)\s*\{.*?\}\s*\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\),(\d+),(\{\})\)\)/;
          const match = packedRegex.exec(html);
          if (match) {
            const p = match[1];
            const a = parseInt(match[2]);
            const c = parseInt(match[3]);
            const k = match[4].split("|");
            const unpacked = unPack(p, a, c, k, null, {});
            const wurlMatch = unpacked.match(/wurl="([^"]+)"/);
            if (wurlMatch) {
              let streamUrl = wurlMatch[1];
              if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
              return {
                url: streamUrl,
                headers: {
                  "User-Agent": USER_AGENT,
                  "Referer": "https://m1xdrop.net/",
                  "Origin": "https://m1xdrop.net"
                }
              };
            }
          }
          return null;
        } catch (e) {
          console.error("[Extractors] MixDrop extraction error:", e);
          return null;
        }
      });
    }
    module2.exports = { extractMixDrop };
  }
});

// src/extractors/dropload.js
var require_dropload = __commonJS({
  "src/extractors/dropload.js"(exports2, module2) {
    var { USER_AGENT, unPack } = require_common();
    function extractDropLoad(url, refererBase = null) {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          if (!refererBase) {
            const match2 = url.match(/^(https?:\/\/[^\/]+)/i);
            refererBase = (match2 ? match2[1] : "") + "/";
          }
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": refererBase
            }
          });
          if (!response.ok) return null;
          const html = yield response.text();
          const regex = /eval\(function\(p,a,c,k,e,d\)\s*\{.*?\}\s*\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
          const match = regex.exec(html);
          if (match) {
            const p = match[1];
            const a = parseInt(match[2]);
            const c = parseInt(match[3]);
            const k = match[4].split("|");
            const unpacked = unPack(p, a, c, k, null, {});
            const fileMatch = unpacked.match(/file:"(.*?)"/);
            if (fileMatch) {
              let streamUrl = fileMatch[1];
              if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
              const originMatch = url.match(/^(https?:\/\/[^\/]+)/i);
              const origin = originMatch ? originMatch[1] : "";
              return {
                url: streamUrl,
                headers: {
                  "User-Agent": USER_AGENT,
                  "Referer": url,
                  "Origin": origin
                }
              };
            }
          }
          return null;
        } catch (e) {
          console.error("[Extractors] DropLoad extraction error:", e);
          return null;
        }
      });
    }
    module2.exports = { extractDropLoad };
  }
});

// src/extractors/supervideo.js
var require_supervideo = __commonJS({
  "src/extractors/supervideo.js"(exports2, module2) {
    var { USER_AGENT, unPack, getProxiedUrl } = require_common();
    function extractSuperVideo(url, refererBase = null) {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          const id = url.split("/").pop();
          const embedUrl = `https://supervideo.tv/e/${id}`;
          if (!refererBase) refererBase = "https://guardahd.stream/";
          const proxiedUrl = getProxiedUrl(embedUrl);
          let response = yield fetch(proxiedUrl, {
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": refererBase
            }
          });
          let html = yield response.text();
          if (html.includes("Cloudflare") || response.status === 403) {
            console.log(`[Extractors] SuperVideo (tv) returned 403/Cloudflare`);
            return null;
          }
          const packedRegex = /eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
          const match = packedRegex.exec(html);
          if (match) {
            const p = match[1];
            const a = parseInt(match[2]);
            const c = parseInt(match[3]);
            const k = match[4].split("|");
            const unpacked = unPack(p, a, c, k, null, {});
            const fileMatch = unpacked.match(/sources:\[\{file:"(.*?)"/);
            if (fileMatch) {
              let streamUrl = fileMatch[1];
              if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
              return streamUrl;
            }
          }
          return null;
        } catch (e) {
          console.error("[Extractors] SuperVideo extraction error:", e);
          return null;
        }
      });
    }
    module2.exports = { extractSuperVideo };
  }
});

// src/extractors/streamtape.js
var require_streamtape = __commonJS({
  "src/extractors/streamtape.js"(exports2, module2) {
    var { USER_AGENT } = require_common();
    function extractStreamTape(url) {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          const response = yield fetch(url);
          if (!response.ok) return null;
          const html = yield response.text();
          const match = html.match(/document\.getElementById\('robotlink'\)\.innerHTML = '(.*?)'/);
          if (match) {
            let link = match[1];
            const lineMatch = html.match(/document\.getElementById\('robotlink'\)\.innerHTML = (.*);/);
            if (lineMatch) {
              const raw = lineMatch[1];
              const cleanLink = raw.replace(/['"\+\s]/g, "");
              if (cleanLink.startsWith("//")) return "https:" + cleanLink;
              if (cleanLink.startsWith("http")) return cleanLink;
            }
          }
          return null;
        } catch (e) {
          console.error("[Extractors] StreamTape extraction error:", e);
          return null;
        }
      });
    }
    module2.exports = { extractStreamTape };
  }
});

// src/extractors/uqload.js
var require_uqload = __commonJS({
  "src/extractors/uqload.js"(exports2, module2) {
    var { USER_AGENT } = require_common();
    function extractUqload(url, refererBase = "https://uqload.io/") {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": refererBase
            }
          });
          if (!response.ok) return null;
          const html = yield response.text();
          const regex = /sources: \["(.*?)"\]/;
          const match = regex.exec(html);
          if (match) {
            let streamUrl = match[1];
            if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
            return {
              url: streamUrl,
              headers: {
                "User-Agent": USER_AGENT,
                "Referer": "https://uqload.io/"
              }
            };
          }
          return null;
        } catch (e) {
          console.error("[Extractors] Uqload extraction error:", e);
          return null;
        }
      });
    }
    module2.exports = { extractUqload };
  }
});

// src/extractors/upstream.js
var require_upstream = __commonJS({
  "src/extractors/upstream.js"(exports2, module2) {
    var { USER_AGENT, unPack } = require_common();
    function extractUpstream(url, refererBase = "https://upstream.to/") {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": refererBase
            }
          });
          if (!response.ok) return null;
          const html = yield response.text();
          const packedRegex = /eval\(function\(p,a,c,k,e,d\)\s*\{.*?\}\s*\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
          const match = packedRegex.exec(html);
          if (match) {
            const p = match[1];
            const a = parseInt(match[2]);
            const c = parseInt(match[3]);
            const k = match[4].split("|");
            const unpacked = unPack(p, a, c, k, null, {});
            const fileMatch = unpacked.match(/file:"(.*?)"/);
            if (fileMatch) {
              let streamUrl = fileMatch[1];
              if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
              return {
                url: streamUrl,
                headers: {
                  "User-Agent": USER_AGENT,
                  "Referer": "https://upstream.to/"
                }
              };
            }
          }
          return null;
        } catch (e) {
          console.error("[Extractors] Upstream extraction error:", e);
          return null;
        }
      });
    }
    module2.exports = { extractUpstream };
  }
});

// src/extractors/vidoza.js
var require_vidoza = __commonJS({
  "src/extractors/vidoza.js"(exports2, module2) {
    function extractVidoza(url) {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          const response = yield fetch(url);
          if (!response.ok) return null;
          const html = yield response.text();
          let match = html.match(/sources:\s*\[\s*\{\s*file:\s*"(.*?)"/);
          if (!match) {
            match = html.match(/source src="(.*?)"/);
          }
          if (match) {
            let streamUrl = match[1];
            if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
            return streamUrl;
          }
          return null;
        } catch (e) {
          console.error("[Extractors] Vidoza extraction error:", e);
          return null;
        }
      });
    }
    module2.exports = { extractVidoza };
  }
});

// src/quality_helper.js
var require_quality_helper = __commonJS({
  "src/quality_helper.js"(exports2, module2) {
    var USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
    function checkQualityFromPlaylist(_0) {
      return __async(this, arguments, function* (url, headers = {}) {
        try {
          if (!url.includes(".m3u8")) return null;
          const finalHeaders = __spreadValues({}, headers);
          if (!finalHeaders["User-Agent"]) {
            finalHeaders["User-Agent"] = USER_AGENT;
          }
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3e3);
          const response = yield fetch(url, {
            headers: finalHeaders,
            signal: controller.signal
          });
          clearTimeout(timeout);
          if (!response.ok) return null;
          const text = yield response.text();
          const quality = checkQualityFromText(text);
          if (quality) console.log(`[QualityHelper] Detected ${quality} from playlist: ${url}`);
          return quality;
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

// src/extractors/vixcloud.js
var require_vixcloud = __commonJS({
  "src/extractors/vixcloud.js"(exports2, module2) {
    var { USER_AGENT } = require_common();
    var { checkQualityFromPlaylist } = require_quality_helper();
    function extractVixCloud(url) {
      return __async(this, null, function* () {
        try {
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": "https://www.animeunity.so/"
            }
          });
          if (!response.ok) return null;
          const html = yield response.text();
          const streams = [];
          const tokenRegex = /'token':\s*'(\w+)'/;
          const expiresRegex = /'expires':\s*'(\d+)'/;
          const urlRegex = /url:\s*'([^']+)'/;
          const fhdRegex = /window\.canPlayFHD\s*=\s*true/;
          const tokenMatch = tokenRegex.exec(html);
          const expiresMatch = expiresRegex.exec(html);
          const urlMatch = urlRegex.exec(html);
          const fhdMatch = fhdRegex.test(html);
          if (tokenMatch && expiresMatch && urlMatch) {
            const token = tokenMatch[1];
            const expires = expiresMatch[1];
            let serverUrl = urlMatch[1];
            let finalUrl = "";
            if (serverUrl.includes("?b=1")) {
              finalUrl = `${serverUrl}&token=${token}&expires=${expires}`;
            } else {
              finalUrl = `${serverUrl}?token=${token}&expires=${expires}`;
            }
            if (fhdMatch) {
              finalUrl += "&h=1";
            }
            const parts = finalUrl.split("?");
            finalUrl = parts[0] + ".m3u8";
            if (parts.length > 1) {
              finalUrl += "?" + parts.slice(1).join("?");
            }
            let quality = "Auto";
            const detectedQuality = yield checkQualityFromPlaylist(finalUrl, {
              "User-Agent": USER_AGENT,
              "Referer": "https://vixcloud.co/"
            });
            if (detectedQuality) quality = detectedQuality;
            streams.push({
              url: finalUrl,
              quality,
              type: "m3u8",
              headers: {
                "User-Agent": USER_AGENT,
                "Referer": "https://vixcloud.co/"
              }
            });
          }
          return streams;
        } catch (e) {
          console.error("[VixCloud] Extraction error:", e);
          return [];
        }
      });
    }
    module2.exports = { extractVixCloud };
  }
});

// node_modules/crypto-js/core.js
var require_core = __commonJS({
  "node_modules/crypto-js/core.js"(exports2, module2) {
    (function(root, factory) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory();
      } else if (typeof define === "function" && define.amd) {
        define([], factory);
      } else {
        root.CryptoJS = factory();
      }
    })(exports2, function() {
      var CryptoJS = CryptoJS || (function(Math2, undefined2) {
        var crypto;
        if (typeof window !== "undefined" && window.crypto) {
          crypto = window.crypto;
        }
        if (typeof self !== "undefined" && self.crypto) {
          crypto = self.crypto;
        }
        if (typeof globalThis !== "undefined" && globalThis.crypto) {
          crypto = globalThis.crypto;
        }
        if (!crypto && typeof window !== "undefined" && window.msCrypto) {
          crypto = window.msCrypto;
        }
        if (!crypto && typeof global !== "undefined" && global.crypto) {
          crypto = global.crypto;
        }
        if (!crypto && typeof require === "function") {
          try {
            crypto = require("crypto");
          } catch (err) {
          }
        }
        var cryptoSecureRandomInt = function() {
          if (crypto) {
            if (typeof crypto.getRandomValues === "function") {
              try {
                return crypto.getRandomValues(new Uint32Array(1))[0];
              } catch (err) {
              }
            }
            if (typeof crypto.randomBytes === "function") {
              try {
                return crypto.randomBytes(4).readInt32LE();
              } catch (err) {
              }
            }
          }
          throw new Error("Native crypto module could not be used to get secure random number.");
        };
        var create = Object.create || /* @__PURE__ */ (function() {
          function F() {
          }
          return function(obj) {
            var subtype;
            F.prototype = obj;
            subtype = new F();
            F.prototype = null;
            return subtype;
          };
        })();
        var C = {};
        var C_lib = C.lib = {};
        var Base = C_lib.Base = /* @__PURE__ */ (function() {
          return {
            /**
             * Creates a new object that inherits from this object.
             *
             * @param {Object} overrides Properties to copy into the new object.
             *
             * @return {Object} The new object.
             *
             * @static
             *
             * @example
             *
             *     var MyType = CryptoJS.lib.Base.extend({
             *         field: 'value',
             *
             *         method: function () {
             *         }
             *     });
             */
            extend: function(overrides) {
              var subtype = create(this);
              if (overrides) {
                subtype.mixIn(overrides);
              }
              if (!subtype.hasOwnProperty("init") || this.init === subtype.init) {
                subtype.init = function() {
                  subtype.$super.init.apply(this, arguments);
                };
              }
              subtype.init.prototype = subtype;
              subtype.$super = this;
              return subtype;
            },
            /**
             * Extends this object and runs the init method.
             * Arguments to create() will be passed to init().
             *
             * @return {Object} The new object.
             *
             * @static
             *
             * @example
             *
             *     var instance = MyType.create();
             */
            create: function() {
              var instance = this.extend();
              instance.init.apply(instance, arguments);
              return instance;
            },
            /**
             * Initializes a newly created object.
             * Override this method to add some logic when your objects are created.
             *
             * @example
             *
             *     var MyType = CryptoJS.lib.Base.extend({
             *         init: function () {
             *             // ...
             *         }
             *     });
             */
            init: function() {
            },
            /**
             * Copies properties into this object.
             *
             * @param {Object} properties The properties to mix in.
             *
             * @example
             *
             *     MyType.mixIn({
             *         field: 'value'
             *     });
             */
            mixIn: function(properties) {
              for (var propertyName in properties) {
                if (properties.hasOwnProperty(propertyName)) {
                  this[propertyName] = properties[propertyName];
                }
              }
              if (properties.hasOwnProperty("toString")) {
                this.toString = properties.toString;
              }
            },
            /**
             * Creates a copy of this object.
             *
             * @return {Object} The clone.
             *
             * @example
             *
             *     var clone = instance.clone();
             */
            clone: function() {
              return this.init.prototype.extend(this);
            }
          };
        })();
        var WordArray = C_lib.WordArray = Base.extend({
          /**
           * Initializes a newly created word array.
           *
           * @param {Array} words (Optional) An array of 32-bit words.
           * @param {number} sigBytes (Optional) The number of significant bytes in the words.
           *
           * @example
           *
           *     var wordArray = CryptoJS.lib.WordArray.create();
           *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607]);
           *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607], 6);
           */
          init: function(words, sigBytes) {
            words = this.words = words || [];
            if (sigBytes != undefined2) {
              this.sigBytes = sigBytes;
            } else {
              this.sigBytes = words.length * 4;
            }
          },
          /**
           * Converts this word array to a string.
           *
           * @param {Encoder} encoder (Optional) The encoding strategy to use. Default: CryptoJS.enc.Hex
           *
           * @return {string} The stringified word array.
           *
           * @example
           *
           *     var string = wordArray + '';
           *     var string = wordArray.toString();
           *     var string = wordArray.toString(CryptoJS.enc.Utf8);
           */
          toString: function(encoder) {
            return (encoder || Hex).stringify(this);
          },
          /**
           * Concatenates a word array to this word array.
           *
           * @param {WordArray} wordArray The word array to append.
           *
           * @return {WordArray} This word array.
           *
           * @example
           *
           *     wordArray1.concat(wordArray2);
           */
          concat: function(wordArray) {
            var thisWords = this.words;
            var thatWords = wordArray.words;
            var thisSigBytes = this.sigBytes;
            var thatSigBytes = wordArray.sigBytes;
            this.clamp();
            if (thisSigBytes % 4) {
              for (var i = 0; i < thatSigBytes; i++) {
                var thatByte = thatWords[i >>> 2] >>> 24 - i % 4 * 8 & 255;
                thisWords[thisSigBytes + i >>> 2] |= thatByte << 24 - (thisSigBytes + i) % 4 * 8;
              }
            } else {
              for (var j = 0; j < thatSigBytes; j += 4) {
                thisWords[thisSigBytes + j >>> 2] = thatWords[j >>> 2];
              }
            }
            this.sigBytes += thatSigBytes;
            return this;
          },
          /**
           * Removes insignificant bits.
           *
           * @example
           *
           *     wordArray.clamp();
           */
          clamp: function() {
            var words = this.words;
            var sigBytes = this.sigBytes;
            words[sigBytes >>> 2] &= 4294967295 << 32 - sigBytes % 4 * 8;
            words.length = Math2.ceil(sigBytes / 4);
          },
          /**
           * Creates a copy of this word array.
           *
           * @return {WordArray} The clone.
           *
           * @example
           *
           *     var clone = wordArray.clone();
           */
          clone: function() {
            var clone = Base.clone.call(this);
            clone.words = this.words.slice(0);
            return clone;
          },
          /**
           * Creates a word array filled with random bytes.
           *
           * @param {number} nBytes The number of random bytes to generate.
           *
           * @return {WordArray} The random word array.
           *
           * @static
           *
           * @example
           *
           *     var wordArray = CryptoJS.lib.WordArray.random(16);
           */
          random: function(nBytes) {
            var words = [];
            for (var i = 0; i < nBytes; i += 4) {
              words.push(cryptoSecureRandomInt());
            }
            return new WordArray.init(words, nBytes);
          }
        });
        var C_enc = C.enc = {};
        var Hex = C_enc.Hex = {
          /**
           * Converts a word array to a hex string.
           *
           * @param {WordArray} wordArray The word array.
           *
           * @return {string} The hex string.
           *
           * @static
           *
           * @example
           *
           *     var hexString = CryptoJS.enc.Hex.stringify(wordArray);
           */
          stringify: function(wordArray) {
            var words = wordArray.words;
            var sigBytes = wordArray.sigBytes;
            var hexChars = [];
            for (var i = 0; i < sigBytes; i++) {
              var bite = words[i >>> 2] >>> 24 - i % 4 * 8 & 255;
              hexChars.push((bite >>> 4).toString(16));
              hexChars.push((bite & 15).toString(16));
            }
            return hexChars.join("");
          },
          /**
           * Converts a hex string to a word array.
           *
           * @param {string} hexStr The hex string.
           *
           * @return {WordArray} The word array.
           *
           * @static
           *
           * @example
           *
           *     var wordArray = CryptoJS.enc.Hex.parse(hexString);
           */
          parse: function(hexStr) {
            var hexStrLength = hexStr.length;
            var words = [];
            for (var i = 0; i < hexStrLength; i += 2) {
              words[i >>> 3] |= parseInt(hexStr.substr(i, 2), 16) << 24 - i % 8 * 4;
            }
            return new WordArray.init(words, hexStrLength / 2);
          }
        };
        var Latin1 = C_enc.Latin1 = {
          /**
           * Converts a word array to a Latin1 string.
           *
           * @param {WordArray} wordArray The word array.
           *
           * @return {string} The Latin1 string.
           *
           * @static
           *
           * @example
           *
           *     var latin1String = CryptoJS.enc.Latin1.stringify(wordArray);
           */
          stringify: function(wordArray) {
            var words = wordArray.words;
            var sigBytes = wordArray.sigBytes;
            var latin1Chars = [];
            for (var i = 0; i < sigBytes; i++) {
              var bite = words[i >>> 2] >>> 24 - i % 4 * 8 & 255;
              latin1Chars.push(String.fromCharCode(bite));
            }
            return latin1Chars.join("");
          },
          /**
           * Converts a Latin1 string to a word array.
           *
           * @param {string} latin1Str The Latin1 string.
           *
           * @return {WordArray} The word array.
           *
           * @static
           *
           * @example
           *
           *     var wordArray = CryptoJS.enc.Latin1.parse(latin1String);
           */
          parse: function(latin1Str) {
            var latin1StrLength = latin1Str.length;
            var words = [];
            for (var i = 0; i < latin1StrLength; i++) {
              words[i >>> 2] |= (latin1Str.charCodeAt(i) & 255) << 24 - i % 4 * 8;
            }
            return new WordArray.init(words, latin1StrLength);
          }
        };
        var Utf8 = C_enc.Utf8 = {
          /**
           * Converts a word array to a UTF-8 string.
           *
           * @param {WordArray} wordArray The word array.
           *
           * @return {string} The UTF-8 string.
           *
           * @static
           *
           * @example
           *
           *     var utf8String = CryptoJS.enc.Utf8.stringify(wordArray);
           */
          stringify: function(wordArray) {
            try {
              return decodeURIComponent(escape(Latin1.stringify(wordArray)));
            } catch (e) {
              throw new Error("Malformed UTF-8 data");
            }
          },
          /**
           * Converts a UTF-8 string to a word array.
           *
           * @param {string} utf8Str The UTF-8 string.
           *
           * @return {WordArray} The word array.
           *
           * @static
           *
           * @example
           *
           *     var wordArray = CryptoJS.enc.Utf8.parse(utf8String);
           */
          parse: function(utf8Str) {
            return Latin1.parse(unescape(encodeURIComponent(utf8Str)));
          }
        };
        var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm = Base.extend({
          /**
           * Resets this block algorithm's data buffer to its initial state.
           *
           * @example
           *
           *     bufferedBlockAlgorithm.reset();
           */
          reset: function() {
            this._data = new WordArray.init();
            this._nDataBytes = 0;
          },
          /**
           * Adds new data to this block algorithm's buffer.
           *
           * @param {WordArray|string} data The data to append. Strings are converted to a WordArray using UTF-8.
           *
           * @example
           *
           *     bufferedBlockAlgorithm._append('data');
           *     bufferedBlockAlgorithm._append(wordArray);
           */
          _append: function(data) {
            if (typeof data == "string") {
              data = Utf8.parse(data);
            }
            this._data.concat(data);
            this._nDataBytes += data.sigBytes;
          },
          /**
           * Processes available data blocks.
           *
           * This method invokes _doProcessBlock(offset), which must be implemented by a concrete subtype.
           *
           * @param {boolean} doFlush Whether all blocks and partial blocks should be processed.
           *
           * @return {WordArray} The processed data.
           *
           * @example
           *
           *     var processedData = bufferedBlockAlgorithm._process();
           *     var processedData = bufferedBlockAlgorithm._process(!!'flush');
           */
          _process: function(doFlush) {
            var processedWords;
            var data = this._data;
            var dataWords = data.words;
            var dataSigBytes = data.sigBytes;
            var blockSize = this.blockSize;
            var blockSizeBytes = blockSize * 4;
            var nBlocksReady = dataSigBytes / blockSizeBytes;
            if (doFlush) {
              nBlocksReady = Math2.ceil(nBlocksReady);
            } else {
              nBlocksReady = Math2.max((nBlocksReady | 0) - this._minBufferSize, 0);
            }
            var nWordsReady = nBlocksReady * blockSize;
            var nBytesReady = Math2.min(nWordsReady * 4, dataSigBytes);
            if (nWordsReady) {
              for (var offset = 0; offset < nWordsReady; offset += blockSize) {
                this._doProcessBlock(dataWords, offset);
              }
              processedWords = dataWords.splice(0, nWordsReady);
              data.sigBytes -= nBytesReady;
            }
            return new WordArray.init(processedWords, nBytesReady);
          },
          /**
           * Creates a copy of this object.
           *
           * @return {Object} The clone.
           *
           * @example
           *
           *     var clone = bufferedBlockAlgorithm.clone();
           */
          clone: function() {
            var clone = Base.clone.call(this);
            clone._data = this._data.clone();
            return clone;
          },
          _minBufferSize: 0
        });
        var Hasher = C_lib.Hasher = BufferedBlockAlgorithm.extend({
          /**
           * Configuration options.
           */
          cfg: Base.extend(),
          /**
           * Initializes a newly created hasher.
           *
           * @param {Object} cfg (Optional) The configuration options to use for this hash computation.
           *
           * @example
           *
           *     var hasher = CryptoJS.algo.SHA256.create();
           */
          init: function(cfg) {
            this.cfg = this.cfg.extend(cfg);
            this.reset();
          },
          /**
           * Resets this hasher to its initial state.
           *
           * @example
           *
           *     hasher.reset();
           */
          reset: function() {
            BufferedBlockAlgorithm.reset.call(this);
            this._doReset();
          },
          /**
           * Updates this hasher with a message.
           *
           * @param {WordArray|string} messageUpdate The message to append.
           *
           * @return {Hasher} This hasher.
           *
           * @example
           *
           *     hasher.update('message');
           *     hasher.update(wordArray);
           */
          update: function(messageUpdate) {
            this._append(messageUpdate);
            this._process();
            return this;
          },
          /**
           * Finalizes the hash computation.
           * Note that the finalize operation is effectively a destructive, read-once operation.
           *
           * @param {WordArray|string} messageUpdate (Optional) A final message update.
           *
           * @return {WordArray} The hash.
           *
           * @example
           *
           *     var hash = hasher.finalize();
           *     var hash = hasher.finalize('message');
           *     var hash = hasher.finalize(wordArray);
           */
          finalize: function(messageUpdate) {
            if (messageUpdate) {
              this._append(messageUpdate);
            }
            var hash = this._doFinalize();
            return hash;
          },
          blockSize: 512 / 32,
          /**
           * Creates a shortcut function to a hasher's object interface.
           *
           * @param {Hasher} hasher The hasher to create a helper for.
           *
           * @return {Function} The shortcut function.
           *
           * @static
           *
           * @example
           *
           *     var SHA256 = CryptoJS.lib.Hasher._createHelper(CryptoJS.algo.SHA256);
           */
          _createHelper: function(hasher) {
            return function(message, cfg) {
              return new hasher.init(cfg).finalize(message);
            };
          },
          /**
           * Creates a shortcut function to the HMAC's object interface.
           *
           * @param {Hasher} hasher The hasher to use in this HMAC helper.
           *
           * @return {Function} The shortcut function.
           *
           * @static
           *
           * @example
           *
           *     var HmacSHA256 = CryptoJS.lib.Hasher._createHmacHelper(CryptoJS.algo.SHA256);
           */
          _createHmacHelper: function(hasher) {
            return function(message, key) {
              return new C_algo.HMAC.init(hasher, key).finalize(message);
            };
          }
        });
        var C_algo = C.algo = {};
        return C;
      })(Math);
      return CryptoJS;
    });
  }
});

// node_modules/crypto-js/x64-core.js
var require_x64_core = __commonJS({
  "node_modules/crypto-js/x64-core.js"(exports2, module2) {
    (function(root, factory) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      (function(undefined2) {
        var C = CryptoJS;
        var C_lib = C.lib;
        var Base = C_lib.Base;
        var X32WordArray = C_lib.WordArray;
        var C_x64 = C.x64 = {};
        var X64Word = C_x64.Word = Base.extend({
          /**
           * Initializes a newly created 64-bit word.
           *
           * @param {number} high The high 32 bits.
           * @param {number} low The low 32 bits.
           *
           * @example
           *
           *     var x64Word = CryptoJS.x64.Word.create(0x00010203, 0x04050607);
           */
          init: function(high, low) {
            this.high = high;
            this.low = low;
          }
          /**
           * Bitwise NOTs this word.
           *
           * @return {X64Word} A new x64-Word object after negating.
           *
           * @example
           *
           *     var negated = x64Word.not();
           */
          // not: function () {
          // var high = ~this.high;
          // var low = ~this.low;
          // return X64Word.create(high, low);
          // },
          /**
           * Bitwise ANDs this word with the passed word.
           *
           * @param {X64Word} word The x64-Word to AND with this word.
           *
           * @return {X64Word} A new x64-Word object after ANDing.
           *
           * @example
           *
           *     var anded = x64Word.and(anotherX64Word);
           */
          // and: function (word) {
          // var high = this.high & word.high;
          // var low = this.low & word.low;
          // return X64Word.create(high, low);
          // },
          /**
           * Bitwise ORs this word with the passed word.
           *
           * @param {X64Word} word The x64-Word to OR with this word.
           *
           * @return {X64Word} A new x64-Word object after ORing.
           *
           * @example
           *
           *     var ored = x64Word.or(anotherX64Word);
           */
          // or: function (word) {
          // var high = this.high | word.high;
          // var low = this.low | word.low;
          // return X64Word.create(high, low);
          // },
          /**
           * Bitwise XORs this word with the passed word.
           *
           * @param {X64Word} word The x64-Word to XOR with this word.
           *
           * @return {X64Word} A new x64-Word object after XORing.
           *
           * @example
           *
           *     var xored = x64Word.xor(anotherX64Word);
           */
          // xor: function (word) {
          // var high = this.high ^ word.high;
          // var low = this.low ^ word.low;
          // return X64Word.create(high, low);
          // },
          /**
           * Shifts this word n bits to the left.
           *
           * @param {number} n The number of bits to shift.
           *
           * @return {X64Word} A new x64-Word object after shifting.
           *
           * @example
           *
           *     var shifted = x64Word.shiftL(25);
           */
          // shiftL: function (n) {
          // if (n < 32) {
          // var high = (this.high << n) | (this.low >>> (32 - n));
          // var low = this.low << n;
          // } else {
          // var high = this.low << (n - 32);
          // var low = 0;
          // }
          // return X64Word.create(high, low);
          // },
          /**
           * Shifts this word n bits to the right.
           *
           * @param {number} n The number of bits to shift.
           *
           * @return {X64Word} A new x64-Word object after shifting.
           *
           * @example
           *
           *     var shifted = x64Word.shiftR(7);
           */
          // shiftR: function (n) {
          // if (n < 32) {
          // var low = (this.low >>> n) | (this.high << (32 - n));
          // var high = this.high >>> n;
          // } else {
          // var low = this.high >>> (n - 32);
          // var high = 0;
          // }
          // return X64Word.create(high, low);
          // },
          /**
           * Rotates this word n bits to the left.
           *
           * @param {number} n The number of bits to rotate.
           *
           * @return {X64Word} A new x64-Word object after rotating.
           *
           * @example
           *
           *     var rotated = x64Word.rotL(25);
           */
          // rotL: function (n) {
          // return this.shiftL(n).or(this.shiftR(64 - n));
          // },
          /**
           * Rotates this word n bits to the right.
           *
           * @param {number} n The number of bits to rotate.
           *
           * @return {X64Word} A new x64-Word object after rotating.
           *
           * @example
           *
           *     var rotated = x64Word.rotR(7);
           */
          // rotR: function (n) {
          // return this.shiftR(n).or(this.shiftL(64 - n));
          // },
          /**
           * Adds this word with the passed word.
           *
           * @param {X64Word} word The x64-Word to add with this word.
           *
           * @return {X64Word} A new x64-Word object after adding.
           *
           * @example
           *
           *     var added = x64Word.add(anotherX64Word);
           */
          // add: function (word) {
          // var low = (this.low + word.low) | 0;
          // var carry = (low >>> 0) < (this.low >>> 0) ? 1 : 0;
          // var high = (this.high + word.high + carry) | 0;
          // return X64Word.create(high, low);
          // }
        });
        var X64WordArray = C_x64.WordArray = Base.extend({
          /**
           * Initializes a newly created word array.
           *
           * @param {Array} words (Optional) An array of CryptoJS.x64.Word objects.
           * @param {number} sigBytes (Optional) The number of significant bytes in the words.
           *
           * @example
           *
           *     var wordArray = CryptoJS.x64.WordArray.create();
           *
           *     var wordArray = CryptoJS.x64.WordArray.create([
           *         CryptoJS.x64.Word.create(0x00010203, 0x04050607),
           *         CryptoJS.x64.Word.create(0x18191a1b, 0x1c1d1e1f)
           *     ]);
           *
           *     var wordArray = CryptoJS.x64.WordArray.create([
           *         CryptoJS.x64.Word.create(0x00010203, 0x04050607),
           *         CryptoJS.x64.Word.create(0x18191a1b, 0x1c1d1e1f)
           *     ], 10);
           */
          init: function(words, sigBytes) {
            words = this.words = words || [];
            if (sigBytes != undefined2) {
              this.sigBytes = sigBytes;
            } else {
              this.sigBytes = words.length * 8;
            }
          },
          /**
           * Converts this 64-bit word array to a 32-bit word array.
           *
           * @return {CryptoJS.lib.WordArray} This word array's data as a 32-bit word array.
           *
           * @example
           *
           *     var x32WordArray = x64WordArray.toX32();
           */
          toX32: function() {
            var x64Words = this.words;
            var x64WordsLength = x64Words.length;
            var x32Words = [];
            for (var i = 0; i < x64WordsLength; i++) {
              var x64Word = x64Words[i];
              x32Words.push(x64Word.high);
              x32Words.push(x64Word.low);
            }
            return X32WordArray.create(x32Words, this.sigBytes);
          },
          /**
           * Creates a copy of this word array.
           *
           * @return {X64WordArray} The clone.
           *
           * @example
           *
           *     var clone = x64WordArray.clone();
           */
          clone: function() {
            var clone = Base.clone.call(this);
            var words = clone.words = this.words.slice(0);
            var wordsLength = words.length;
            for (var i = 0; i < wordsLength; i++) {
              words[i] = words[i].clone();
            }
            return clone;
          }
        });
      })();
      return CryptoJS;
    });
  }
});

// node_modules/crypto-js/lib-typedarrays.js
var require_lib_typedarrays = __commonJS({
  "node_modules/crypto-js/lib-typedarrays.js"(exports2, module2) {
    (function(root, factory) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      (function() {
        if (typeof ArrayBuffer != "function") {
          return;
        }
        var C = CryptoJS;
        var C_lib = C.lib;
        var WordArray = C_lib.WordArray;
        var superInit = WordArray.init;
        var subInit = WordArray.init = function(typedArray) {
          if (typedArray instanceof ArrayBuffer) {
            typedArray = new Uint8Array(typedArray);
          }
          if (typedArray instanceof Int8Array || typeof Uint8ClampedArray !== "undefined" && typedArray instanceof Uint8ClampedArray || typedArray instanceof Int16Array || typedArray instanceof Uint16Array || typedArray instanceof Int32Array || typedArray instanceof Uint32Array || typedArray instanceof Float32Array || typedArray instanceof Float64Array) {
            typedArray = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
          }
          if (typedArray instanceof Uint8Array) {
            var typedArrayByteLength = typedArray.byteLength;
            var words = [];
            for (var i = 0; i < typedArrayByteLength; i++) {
              words[i >>> 2] |= typedArray[i] << 24 - i % 4 * 8;
            }
            superInit.call(this, words, typedArrayByteLength);
          } else {
            superInit.apply(this, arguments);
          }
        };
        subInit.prototype = WordArray;
      })();
      return CryptoJS.lib.WordArray;
    });
  }
});

// node_modules/crypto-js/enc-utf16.js
var require_enc_utf16 = __commonJS({
  "node_modules/crypto-js/enc-utf16.js"(exports2, module2) {
    (function(root, factory) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      (function() {
        var C = CryptoJS;
        var C_lib = C.lib;
        var WordArray = C_lib.WordArray;
        var C_enc = C.enc;
        var Utf16BE = C_enc.Utf16 = C_enc.Utf16BE = {
          /**
           * Converts a word array to a UTF-16 BE string.
           *
           * @param {WordArray} wordArray The word array.
           *
           * @return {string} The UTF-16 BE string.
           *
           * @static
           *
           * @example
           *
           *     var utf16String = CryptoJS.enc.Utf16.stringify(wordArray);
           */
          stringify: function(wordArray) {
            var words = wordArray.words;
            var sigBytes = wordArray.sigBytes;
            var utf16Chars = [];
            for (var i = 0; i < sigBytes; i += 2) {
              var codePoint = words[i >>> 2] >>> 16 - i % 4 * 8 & 65535;
              utf16Chars.push(String.fromCharCode(codePoint));
            }
            return utf16Chars.join("");
          },
          /**
           * Converts a UTF-16 BE string to a word array.
           *
           * @param {string} utf16Str The UTF-16 BE string.
           *
           * @return {WordArray} The word array.
           *
           * @static
           *
           * @example
           *
           *     var wordArray = CryptoJS.enc.Utf16.parse(utf16String);
           */
          parse: function(utf16Str) {
            var utf16StrLength = utf16Str.length;
            var words = [];
            for (var i = 0; i < utf16StrLength; i++) {
              words[i >>> 1] |= utf16Str.charCodeAt(i) << 16 - i % 2 * 16;
            }
            return WordArray.create(words, utf16StrLength * 2);
          }
        };
        C_enc.Utf16LE = {
          /**
           * Converts a word array to a UTF-16 LE string.
           *
           * @param {WordArray} wordArray The word array.
           *
           * @return {string} The UTF-16 LE string.
           *
           * @static
           *
           * @example
           *
           *     var utf16Str = CryptoJS.enc.Utf16LE.stringify(wordArray);
           */
          stringify: function(wordArray) {
            var words = wordArray.words;
            var sigBytes = wordArray.sigBytes;
            var utf16Chars = [];
            for (var i = 0; i < sigBytes; i += 2) {
              var codePoint = swapEndian(words[i >>> 2] >>> 16 - i % 4 * 8 & 65535);
              utf16Chars.push(String.fromCharCode(codePoint));
            }
            return utf16Chars.join("");
          },
          /**
           * Converts a UTF-16 LE string to a word array.
           *
           * @param {string} utf16Str The UTF-16 LE string.
           *
           * @return {WordArray} The word array.
           *
           * @static
           *
           * @example
           *
           *     var wordArray = CryptoJS.enc.Utf16LE.parse(utf16Str);
           */
          parse: function(utf16Str) {
            var utf16StrLength = utf16Str.length;
            var words = [];
            for (var i = 0; i < utf16StrLength; i++) {
              words[i >>> 1] |= swapEndian(utf16Str.charCodeAt(i) << 16 - i % 2 * 16);
            }
            return WordArray.create(words, utf16StrLength * 2);
          }
        };
        function swapEndian(word) {
          return word << 8 & 4278255360 | word >>> 8 & 16711935;
        }
      })();
      return CryptoJS.enc.Utf16;
    });
  }
});

// node_modules/crypto-js/enc-base64.js
var require_enc_base64 = __commonJS({
  "node_modules/crypto-js/enc-base64.js"(exports2, module2) {
    (function(root, factory) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      (function() {
        var C = CryptoJS;
        var C_lib = C.lib;
        var WordArray = C_lib.WordArray;
        var C_enc = C.enc;
        var Base64 = C_enc.Base64 = {
          /**
           * Converts a word array to a Base64 string.
           *
           * @param {WordArray} wordArray The word array.
           *
           * @return {string} The Base64 string.
           *
           * @static
           *
           * @example
           *
           *     var base64String = CryptoJS.enc.Base64.stringify(wordArray);
           */
          stringify: function(wordArray) {
            var words = wordArray.words;
            var sigBytes = wordArray.sigBytes;
            var map = this._map;
            wordArray.clamp();
            var base64Chars = [];
            for (var i = 0; i < sigBytes; i += 3) {
              var byte1 = words[i >>> 2] >>> 24 - i % 4 * 8 & 255;
              var byte2 = words[i + 1 >>> 2] >>> 24 - (i + 1) % 4 * 8 & 255;
              var byte3 = words[i + 2 >>> 2] >>> 24 - (i + 2) % 4 * 8 & 255;
              var triplet = byte1 << 16 | byte2 << 8 | byte3;
              for (var j = 0; j < 4 && i + j * 0.75 < sigBytes; j++) {
                base64Chars.push(map.charAt(triplet >>> 6 * (3 - j) & 63));
              }
            }
            var paddingChar = map.charAt(64);
            if (paddingChar) {
              while (base64Chars.length % 4) {
                base64Chars.push(paddingChar);
              }
            }
            return base64Chars.join("");
          },
          /**
           * Converts a Base64 string to a word array.
           *
           * @param {string} base64Str The Base64 string.
           *
           * @return {WordArray} The word array.
           *
           * @static
           *
           * @example
           *
           *     var wordArray = CryptoJS.enc.Base64.parse(base64String);
           */
          parse: function(base64Str) {
            var base64StrLength = base64Str.length;
            var map = this._map;
            var reverseMap = this._reverseMap;
            if (!reverseMap) {
              reverseMap = this._reverseMap = [];
              for (var j = 0; j < map.length; j++) {
                reverseMap[map.charCodeAt(j)] = j;
              }
            }
            var paddingChar = map.charAt(64);
            if (paddingChar) {
              var paddingIndex = base64Str.indexOf(paddingChar);
              if (paddingIndex !== -1) {
                base64StrLength = paddingIndex;
              }
            }
            return parseLoop(base64Str, base64StrLength, reverseMap);
          },
          _map: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
        };
        function parseLoop(base64Str, base64StrLength, reverseMap) {
          var words = [];
          var nBytes = 0;
          for (var i = 0; i < base64StrLength; i++) {
            if (i % 4) {
              var bits1 = reverseMap[base64Str.charCodeAt(i - 1)] << i % 4 * 2;
              var bits2 = reverseMap[base64Str.charCodeAt(i)] >>> 6 - i % 4 * 2;
              var bitsCombined = bits1 | bits2;
              words[nBytes >>> 2] |= bitsCombined << 24 - nBytes % 4 * 8;
              nBytes++;
            }
          }
          return WordArray.create(words, nBytes);
        }
      })();
      return CryptoJS.enc.Base64;
    });
  }
});

// node_modules/crypto-js/enc-base64url.js
var require_enc_base64url = __commonJS({
  "node_modules/crypto-js/enc-base64url.js"(exports2, module2) {
    (function(root, factory) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      (function() {
        var C = CryptoJS;
        var C_lib = C.lib;
        var WordArray = C_lib.WordArray;
        var C_enc = C.enc;
        var Base64url = C_enc.Base64url = {
          /**
           * Converts a word array to a Base64url string.
           *
           * @param {WordArray} wordArray The word array.
           *
           * @param {boolean} urlSafe Whether to use url safe
           *
           * @return {string} The Base64url string.
           *
           * @static
           *
           * @example
           *
           *     var base64String = CryptoJS.enc.Base64url.stringify(wordArray);
           */
          stringify: function(wordArray, urlSafe) {
            if (urlSafe === void 0) {
              urlSafe = true;
            }
            var words = wordArray.words;
            var sigBytes = wordArray.sigBytes;
            var map = urlSafe ? this._safe_map : this._map;
            wordArray.clamp();
            var base64Chars = [];
            for (var i = 0; i < sigBytes; i += 3) {
              var byte1 = words[i >>> 2] >>> 24 - i % 4 * 8 & 255;
              var byte2 = words[i + 1 >>> 2] >>> 24 - (i + 1) % 4 * 8 & 255;
              var byte3 = words[i + 2 >>> 2] >>> 24 - (i + 2) % 4 * 8 & 255;
              var triplet = byte1 << 16 | byte2 << 8 | byte3;
              for (var j = 0; j < 4 && i + j * 0.75 < sigBytes; j++) {
                base64Chars.push(map.charAt(triplet >>> 6 * (3 - j) & 63));
              }
            }
            var paddingChar = map.charAt(64);
            if (paddingChar) {
              while (base64Chars.length % 4) {
                base64Chars.push(paddingChar);
              }
            }
            return base64Chars.join("");
          },
          /**
           * Converts a Base64url string to a word array.
           *
           * @param {string} base64Str The Base64url string.
           *
           * @param {boolean} urlSafe Whether to use url safe
           *
           * @return {WordArray} The word array.
           *
           * @static
           *
           * @example
           *
           *     var wordArray = CryptoJS.enc.Base64url.parse(base64String);
           */
          parse: function(base64Str, urlSafe) {
            if (urlSafe === void 0) {
              urlSafe = true;
            }
            var base64StrLength = base64Str.length;
            var map = urlSafe ? this._safe_map : this._map;
            var reverseMap = this._reverseMap;
            if (!reverseMap) {
              reverseMap = this._reverseMap = [];
              for (var j = 0; j < map.length; j++) {
                reverseMap[map.charCodeAt(j)] = j;
              }
            }
            var paddingChar = map.charAt(64);
            if (paddingChar) {
              var paddingIndex = base64Str.indexOf(paddingChar);
              if (paddingIndex !== -1) {
                base64StrLength = paddingIndex;
              }
            }
            return parseLoop(base64Str, base64StrLength, reverseMap);
          },
          _map: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
          _safe_map: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
        };
        function parseLoop(base64Str, base64StrLength, reverseMap) {
          var words = [];
          var nBytes = 0;
          for (var i = 0; i < base64StrLength; i++) {
            if (i % 4) {
              var bits1 = reverseMap[base64Str.charCodeAt(i - 1)] << i % 4 * 2;
              var bits2 = reverseMap[base64Str.charCodeAt(i)] >>> 6 - i % 4 * 2;
              var bitsCombined = bits1 | bits2;
              words[nBytes >>> 2] |= bitsCombined << 24 - nBytes % 4 * 8;
              nBytes++;
            }
          }
          return WordArray.create(words, nBytes);
        }
      })();
      return CryptoJS.enc.Base64url;
    });
  }
});

// node_modules/crypto-js/md5.js
var require_md5 = __commonJS({
  "node_modules/crypto-js/md5.js"(exports2, module2) {
    (function(root, factory) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      (function(Math2) {
        var C = CryptoJS;
        var C_lib = C.lib;
        var WordArray = C_lib.WordArray;
        var Hasher = C_lib.Hasher;
        var C_algo = C.algo;
        var T = [];
        (function() {
          for (var i = 0; i < 64; i++) {
            T[i] = Math2.abs(Math2.sin(i + 1)) * 4294967296 | 0;
          }
        })();
        var MD5 = C_algo.MD5 = Hasher.extend({
          _doReset: function() {
            this._hash = new WordArray.init([
              1732584193,
              4023233417,
              2562383102,
              271733878
            ]);
          },
          _doProcessBlock: function(M, offset) {
            for (var i = 0; i < 16; i++) {
              var offset_i = offset + i;
              var M_offset_i = M[offset_i];
              M[offset_i] = (M_offset_i << 8 | M_offset_i >>> 24) & 16711935 | (M_offset_i << 24 | M_offset_i >>> 8) & 4278255360;
            }
            var H = this._hash.words;
            var M_offset_0 = M[offset + 0];
            var M_offset_1 = M[offset + 1];
            var M_offset_2 = M[offset + 2];
            var M_offset_3 = M[offset + 3];
            var M_offset_4 = M[offset + 4];
            var M_offset_5 = M[offset + 5];
            var M_offset_6 = M[offset + 6];
            var M_offset_7 = M[offset + 7];
            var M_offset_8 = M[offset + 8];
            var M_offset_9 = M[offset + 9];
            var M_offset_10 = M[offset + 10];
            var M_offset_11 = M[offset + 11];
            var M_offset_12 = M[offset + 12];
            var M_offset_13 = M[offset + 13];
            var M_offset_14 = M[offset + 14];
            var M_offset_15 = M[offset + 15];
            var a = H[0];
            var b = H[1];
            var c = H[2];
            var d = H[3];
            a = FF(a, b, c, d, M_offset_0, 7, T[0]);
            d = FF(d, a, b, c, M_offset_1, 12, T[1]);
            c = FF(c, d, a, b, M_offset_2, 17, T[2]);
            b = FF(b, c, d, a, M_offset_3, 22, T[3]);
            a = FF(a, b, c, d, M_offset_4, 7, T[4]);
            d = FF(d, a, b, c, M_offset_5, 12, T[5]);
            c = FF(c, d, a, b, M_offset_6, 17, T[6]);
            b = FF(b, c, d, a, M_offset_7, 22, T[7]);
            a = FF(a, b, c, d, M_offset_8, 7, T[8]);
            d = FF(d, a, b, c, M_offset_9, 12, T[9]);
            c = FF(c, d, a, b, M_offset_10, 17, T[10]);
            b = FF(b, c, d, a, M_offset_11, 22, T[11]);
            a = FF(a, b, c, d, M_offset_12, 7, T[12]);
            d = FF(d, a, b, c, M_offset_13, 12, T[13]);
            c = FF(c, d, a, b, M_offset_14, 17, T[14]);
            b = FF(b, c, d, a, M_offset_15, 22, T[15]);
            a = GG(a, b, c, d, M_offset_1, 5, T[16]);
            d = GG(d, a, b, c, M_offset_6, 9, T[17]);
            c = GG(c, d, a, b, M_offset_11, 14, T[18]);
            b = GG(b, c, d, a, M_offset_0, 20, T[19]);
            a = GG(a, b, c, d, M_offset_5, 5, T[20]);
            d = GG(d, a, b, c, M_offset_10, 9, T[21]);
            c = GG(c, d, a, b, M_offset_15, 14, T[22]);
            b = GG(b, c, d, a, M_offset_4, 20, T[23]);
            a = GG(a, b, c, d, M_offset_9, 5, T[24]);
            d = GG(d, a, b, c, M_offset_14, 9, T[25]);
            c = GG(c, d, a, b, M_offset_3, 14, T[26]);
            b = GG(b, c, d, a, M_offset_8, 20, T[27]);
            a = GG(a, b, c, d, M_offset_13, 5, T[28]);
            d = GG(d, a, b, c, M_offset_2, 9, T[29]);
            c = GG(c, d, a, b, M_offset_7, 14, T[30]);
            b = GG(b, c, d, a, M_offset_12, 20, T[31]);
            a = HH(a, b, c, d, M_offset_5, 4, T[32]);
            d = HH(d, a, b, c, M_offset_8, 11, T[33]);
            c = HH(c, d, a, b, M_offset_11, 16, T[34]);
            b = HH(b, c, d, a, M_offset_14, 23, T[35]);
            a = HH(a, b, c, d, M_offset_1, 4, T[36]);
            d = HH(d, a, b, c, M_offset_4, 11, T[37]);
            c = HH(c, d, a, b, M_offset_7, 16, T[38]);
            b = HH(b, c, d, a, M_offset_10, 23, T[39]);
            a = HH(a, b, c, d, M_offset_13, 4, T[40]);
            d = HH(d, a, b, c, M_offset_0, 11, T[41]);
            c = HH(c, d, a, b, M_offset_3, 16, T[42]);
            b = HH(b, c, d, a, M_offset_6, 23, T[43]);
            a = HH(a, b, c, d, M_offset_9, 4, T[44]);
            d = HH(d, a, b, c, M_offset_12, 11, T[45]);
            c = HH(c, d, a, b, M_offset_15, 16, T[46]);
            b = HH(b, c, d, a, M_offset_2, 23, T[47]);
            a = II(a, b, c, d, M_offset_0, 6, T[48]);
            d = II(d, a, b, c, M_offset_7, 10, T[49]);
            c = II(c, d, a, b, M_offset_14, 15, T[50]);
            b = II(b, c, d, a, M_offset_5, 21, T[51]);
            a = II(a, b, c, d, M_offset_12, 6, T[52]);
            d = II(d, a, b, c, M_offset_3, 10, T[53]);
            c = II(c, d, a, b, M_offset_10, 15, T[54]);
            b = II(b, c, d, a, M_offset_1, 21, T[55]);
            a = II(a, b, c, d, M_offset_8, 6, T[56]);
            d = II(d, a, b, c, M_offset_15, 10, T[57]);
            c = II(c, d, a, b, M_offset_6, 15, T[58]);
            b = II(b, c, d, a, M_offset_13, 21, T[59]);
            a = II(a, b, c, d, M_offset_4, 6, T[60]);
            d = II(d, a, b, c, M_offset_11, 10, T[61]);
            c = II(c, d, a, b, M_offset_2, 15, T[62]);
            b = II(b, c, d, a, M_offset_9, 21, T[63]);
            H[0] = H[0] + a | 0;
            H[1] = H[1] + b | 0;
            H[2] = H[2] + c | 0;
            H[3] = H[3] + d | 0;
          },
          _doFinalize: function() {
            var data = this._data;
            var dataWords = data.words;
            var nBitsTotal = this._nDataBytes * 8;
            var nBitsLeft = data.sigBytes * 8;
            dataWords[nBitsLeft >>> 5] |= 128 << 24 - nBitsLeft % 32;
            var nBitsTotalH = Math2.floor(nBitsTotal / 4294967296);
            var nBitsTotalL = nBitsTotal;
            dataWords[(nBitsLeft + 64 >>> 9 << 4) + 15] = (nBitsTotalH << 8 | nBitsTotalH >>> 24) & 16711935 | (nBitsTotalH << 24 | nBitsTotalH >>> 8) & 4278255360;
            dataWords[(nBitsLeft + 64 >>> 9 << 4) + 14] = (nBitsTotalL << 8 | nBitsTotalL >>> 24) & 16711935 | (nBitsTotalL << 24 | nBitsTotalL >>> 8) & 4278255360;
            data.sigBytes = (dataWords.length + 1) * 4;
            this._process();
            var hash = this._hash;
            var H = hash.words;
            for (var i = 0; i < 4; i++) {
              var H_i = H[i];
              H[i] = (H_i << 8 | H_i >>> 24) & 16711935 | (H_i << 24 | H_i >>> 8) & 4278255360;
            }
            return hash;
          },
          clone: function() {
            var clone = Hasher.clone.call(this);
            clone._hash = this._hash.clone();
            return clone;
          }
        });
        function FF(a, b, c, d, x, s, t) {
          var n = a + (b & c | ~b & d) + x + t;
          return (n << s | n >>> 32 - s) + b;
        }
        function GG(a, b, c, d, x, s, t) {
          var n = a + (b & d | c & ~d) + x + t;
          return (n << s | n >>> 32 - s) + b;
        }
        function HH(a, b, c, d, x, s, t) {
          var n = a + (b ^ c ^ d) + x + t;
          return (n << s | n >>> 32 - s) + b;
        }
        function II(a, b, c, d, x, s, t) {
          var n = a + (c ^ (b | ~d)) + x + t;
          return (n << s | n >>> 32 - s) + b;
        }
        C.MD5 = Hasher._createHelper(MD5);
        C.HmacMD5 = Hasher._createHmacHelper(MD5);
      })(Math);
      return CryptoJS.MD5;
    });
  }
});

// node_modules/crypto-js/sha1.js
var require_sha1 = __commonJS({
  "node_modules/crypto-js/sha1.js"(exports2, module2) {
    (function(root, factory) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      (function() {
        var C = CryptoJS;
        var C_lib = C.lib;
        var WordArray = C_lib.WordArray;
        var Hasher = C_lib.Hasher;
        var C_algo = C.algo;
        var W = [];
        var SHA1 = C_algo.SHA1 = Hasher.extend({
          _doReset: function() {
            this._hash = new WordArray.init([
              1732584193,
              4023233417,
              2562383102,
              271733878,
              3285377520
            ]);
          },
          _doProcessBlock: function(M, offset) {
            var H = this._hash.words;
            var a = H[0];
            var b = H[1];
            var c = H[2];
            var d = H[3];
            var e = H[4];
            for (var i = 0; i < 80; i++) {
              if (i < 16) {
                W[i] = M[offset + i] | 0;
              } else {
                var n = W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16];
                W[i] = n << 1 | n >>> 31;
              }
              var t = (a << 5 | a >>> 27) + e + W[i];
              if (i < 20) {
                t += (b & c | ~b & d) + 1518500249;
              } else if (i < 40) {
                t += (b ^ c ^ d) + 1859775393;
              } else if (i < 60) {
                t += (b & c | b & d | c & d) - 1894007588;
              } else {
                t += (b ^ c ^ d) - 899497514;
              }
              e = d;
              d = c;
              c = b << 30 | b >>> 2;
              b = a;
              a = t;
            }
            H[0] = H[0] + a | 0;
            H[1] = H[1] + b | 0;
            H[2] = H[2] + c | 0;
            H[3] = H[3] + d | 0;
            H[4] = H[4] + e | 0;
          },
          _doFinalize: function() {
            var data = this._data;
            var dataWords = data.words;
            var nBitsTotal = this._nDataBytes * 8;
            var nBitsLeft = data.sigBytes * 8;
            dataWords[nBitsLeft >>> 5] |= 128 << 24 - nBitsLeft % 32;
            dataWords[(nBitsLeft + 64 >>> 9 << 4) + 14] = Math.floor(nBitsTotal / 4294967296);
            dataWords[(nBitsLeft + 64 >>> 9 << 4) + 15] = nBitsTotal;
            data.sigBytes = dataWords.length * 4;
            this._process();
            return this._hash;
          },
          clone: function() {
            var clone = Hasher.clone.call(this);
            clone._hash = this._hash.clone();
            return clone;
          }
        });
        C.SHA1 = Hasher._createHelper(SHA1);
        C.HmacSHA1 = Hasher._createHmacHelper(SHA1);
      })();
      return CryptoJS.SHA1;
    });
  }
});

// node_modules/crypto-js/sha256.js
var require_sha256 = __commonJS({
  "node_modules/crypto-js/sha256.js"(exports2, module2) {
    (function(root, factory) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      (function(Math2) {
        var C = CryptoJS;
        var C_lib = C.lib;
        var WordArray = C_lib.WordArray;
        var Hasher = C_lib.Hasher;
        var C_algo = C.algo;
        var H = [];
        var K = [];
        (function() {
          function isPrime(n2) {
            var sqrtN = Math2.sqrt(n2);
            for (var factor = 2; factor <= sqrtN; factor++) {
              if (!(n2 % factor)) {
                return false;
              }
            }
            return true;
          }
          function getFractionalBits(n2) {
            return (n2 - (n2 | 0)) * 4294967296 | 0;
          }
          var n = 2;
          var nPrime = 0;
          while (nPrime < 64) {
            if (isPrime(n)) {
              if (nPrime < 8) {
                H[nPrime] = getFractionalBits(Math2.pow(n, 1 / 2));
              }
              K[nPrime] = getFractionalBits(Math2.pow(n, 1 / 3));
              nPrime++;
            }
            n++;
          }
        })();
        var W = [];
        var SHA256 = C_algo.SHA256 = Hasher.extend({
          _doReset: function() {
            this._hash = new WordArray.init(H.slice(0));
          },
          _doProcessBlock: function(M, offset) {
            var H2 = this._hash.words;
            var a = H2[0];
            var b = H2[1];
            var c = H2[2];
            var d = H2[3];
            var e = H2[4];
            var f = H2[5];
            var g = H2[6];
            var h = H2[7];
            for (var i = 0; i < 64; i++) {
              if (i < 16) {
                W[i] = M[offset + i] | 0;
              } else {
                var gamma0x = W[i - 15];
                var gamma0 = (gamma0x << 25 | gamma0x >>> 7) ^ (gamma0x << 14 | gamma0x >>> 18) ^ gamma0x >>> 3;
                var gamma1x = W[i - 2];
                var gamma1 = (gamma1x << 15 | gamma1x >>> 17) ^ (gamma1x << 13 | gamma1x >>> 19) ^ gamma1x >>> 10;
                W[i] = gamma0 + W[i - 7] + gamma1 + W[i - 16];
              }
              var ch = e & f ^ ~e & g;
              var maj = a & b ^ a & c ^ b & c;
              var sigma0 = (a << 30 | a >>> 2) ^ (a << 19 | a >>> 13) ^ (a << 10 | a >>> 22);
              var sigma1 = (e << 26 | e >>> 6) ^ (e << 21 | e >>> 11) ^ (e << 7 | e >>> 25);
              var t1 = h + sigma1 + ch + K[i] + W[i];
              var t2 = sigma0 + maj;
              h = g;
              g = f;
              f = e;
              e = d + t1 | 0;
              d = c;
              c = b;
              b = a;
              a = t1 + t2 | 0;
            }
            H2[0] = H2[0] + a | 0;
            H2[1] = H2[1] + b | 0;
            H2[2] = H2[2] + c | 0;
            H2[3] = H2[3] + d | 0;
            H2[4] = H2[4] + e | 0;
            H2[5] = H2[5] + f | 0;
            H2[6] = H2[6] + g | 0;
            H2[7] = H2[7] + h | 0;
          },
          _doFinalize: function() {
            var data = this._data;
            var dataWords = data.words;
            var nBitsTotal = this._nDataBytes * 8;
            var nBitsLeft = data.sigBytes * 8;
            dataWords[nBitsLeft >>> 5] |= 128 << 24 - nBitsLeft % 32;
            dataWords[(nBitsLeft + 64 >>> 9 << 4) + 14] = Math2.floor(nBitsTotal / 4294967296);
            dataWords[(nBitsLeft + 64 >>> 9 << 4) + 15] = nBitsTotal;
            data.sigBytes = dataWords.length * 4;
            this._process();
            return this._hash;
          },
          clone: function() {
            var clone = Hasher.clone.call(this);
            clone._hash = this._hash.clone();
            return clone;
          }
        });
        C.SHA256 = Hasher._createHelper(SHA256);
        C.HmacSHA256 = Hasher._createHmacHelper(SHA256);
      })(Math);
      return CryptoJS.SHA256;
    });
  }
});

// node_modules/crypto-js/sha224.js
var require_sha224 = __commonJS({
  "node_modules/crypto-js/sha224.js"(exports2, module2) {
    (function(root, factory, undef) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core(), require_sha256());
      } else if (typeof define === "function" && define.amd) {
        define(["./core", "./sha256"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      (function() {
        var C = CryptoJS;
        var C_lib = C.lib;
        var WordArray = C_lib.WordArray;
        var C_algo = C.algo;
        var SHA256 = C_algo.SHA256;
        var SHA224 = C_algo.SHA224 = SHA256.extend({
          _doReset: function() {
            this._hash = new WordArray.init([
              3238371032,
              914150663,
              812702999,
              4144912697,
              4290775857,
              1750603025,
              1694076839,
              3204075428
            ]);
          },
          _doFinalize: function() {
            var hash = SHA256._doFinalize.call(this);
            hash.sigBytes -= 4;
            return hash;
          }
        });
        C.SHA224 = SHA256._createHelper(SHA224);
        C.HmacSHA224 = SHA256._createHmacHelper(SHA224);
      })();
      return CryptoJS.SHA224;
    });
  }
});

// node_modules/crypto-js/sha512.js
var require_sha512 = __commonJS({
  "node_modules/crypto-js/sha512.js"(exports2, module2) {
    (function(root, factory, undef) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core(), require_x64_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core", "./x64-core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      (function() {
        var C = CryptoJS;
        var C_lib = C.lib;
        var Hasher = C_lib.Hasher;
        var C_x64 = C.x64;
        var X64Word = C_x64.Word;
        var X64WordArray = C_x64.WordArray;
        var C_algo = C.algo;
        function X64Word_create() {
          return X64Word.create.apply(X64Word, arguments);
        }
        var K = [
          X64Word_create(1116352408, 3609767458),
          X64Word_create(1899447441, 602891725),
          X64Word_create(3049323471, 3964484399),
          X64Word_create(3921009573, 2173295548),
          X64Word_create(961987163, 4081628472),
          X64Word_create(1508970993, 3053834265),
          X64Word_create(2453635748, 2937671579),
          X64Word_create(2870763221, 3664609560),
          X64Word_create(3624381080, 2734883394),
          X64Word_create(310598401, 1164996542),
          X64Word_create(607225278, 1323610764),
          X64Word_create(1426881987, 3590304994),
          X64Word_create(1925078388, 4068182383),
          X64Word_create(2162078206, 991336113),
          X64Word_create(2614888103, 633803317),
          X64Word_create(3248222580, 3479774868),
          X64Word_create(3835390401, 2666613458),
          X64Word_create(4022224774, 944711139),
          X64Word_create(264347078, 2341262773),
          X64Word_create(604807628, 2007800933),
          X64Word_create(770255983, 1495990901),
          X64Word_create(1249150122, 1856431235),
          X64Word_create(1555081692, 3175218132),
          X64Word_create(1996064986, 2198950837),
          X64Word_create(2554220882, 3999719339),
          X64Word_create(2821834349, 766784016),
          X64Word_create(2952996808, 2566594879),
          X64Word_create(3210313671, 3203337956),
          X64Word_create(3336571891, 1034457026),
          X64Word_create(3584528711, 2466948901),
          X64Word_create(113926993, 3758326383),
          X64Word_create(338241895, 168717936),
          X64Word_create(666307205, 1188179964),
          X64Word_create(773529912, 1546045734),
          X64Word_create(1294757372, 1522805485),
          X64Word_create(1396182291, 2643833823),
          X64Word_create(1695183700, 2343527390),
          X64Word_create(1986661051, 1014477480),
          X64Word_create(2177026350, 1206759142),
          X64Word_create(2456956037, 344077627),
          X64Word_create(2730485921, 1290863460),
          X64Word_create(2820302411, 3158454273),
          X64Word_create(3259730800, 3505952657),
          X64Word_create(3345764771, 106217008),
          X64Word_create(3516065817, 3606008344),
          X64Word_create(3600352804, 1432725776),
          X64Word_create(4094571909, 1467031594),
          X64Word_create(275423344, 851169720),
          X64Word_create(430227734, 3100823752),
          X64Word_create(506948616, 1363258195),
          X64Word_create(659060556, 3750685593),
          X64Word_create(883997877, 3785050280),
          X64Word_create(958139571, 3318307427),
          X64Word_create(1322822218, 3812723403),
          X64Word_create(1537002063, 2003034995),
          X64Word_create(1747873779, 3602036899),
          X64Word_create(1955562222, 1575990012),
          X64Word_create(2024104815, 1125592928),
          X64Word_create(2227730452, 2716904306),
          X64Word_create(2361852424, 442776044),
          X64Word_create(2428436474, 593698344),
          X64Word_create(2756734187, 3733110249),
          X64Word_create(3204031479, 2999351573),
          X64Word_create(3329325298, 3815920427),
          X64Word_create(3391569614, 3928383900),
          X64Word_create(3515267271, 566280711),
          X64Word_create(3940187606, 3454069534),
          X64Word_create(4118630271, 4000239992),
          X64Word_create(116418474, 1914138554),
          X64Word_create(174292421, 2731055270),
          X64Word_create(289380356, 3203993006),
          X64Word_create(460393269, 320620315),
          X64Word_create(685471733, 587496836),
          X64Word_create(852142971, 1086792851),
          X64Word_create(1017036298, 365543100),
          X64Word_create(1126000580, 2618297676),
          X64Word_create(1288033470, 3409855158),
          X64Word_create(1501505948, 4234509866),
          X64Word_create(1607167915, 987167468),
          X64Word_create(1816402316, 1246189591)
        ];
        var W = [];
        (function() {
          for (var i = 0; i < 80; i++) {
            W[i] = X64Word_create();
          }
        })();
        var SHA512 = C_algo.SHA512 = Hasher.extend({
          _doReset: function() {
            this._hash = new X64WordArray.init([
              new X64Word.init(1779033703, 4089235720),
              new X64Word.init(3144134277, 2227873595),
              new X64Word.init(1013904242, 4271175723),
              new X64Word.init(2773480762, 1595750129),
              new X64Word.init(1359893119, 2917565137),
              new X64Word.init(2600822924, 725511199),
              new X64Word.init(528734635, 4215389547),
              new X64Word.init(1541459225, 327033209)
            ]);
          },
          _doProcessBlock: function(M, offset) {
            var H = this._hash.words;
            var H0 = H[0];
            var H1 = H[1];
            var H2 = H[2];
            var H3 = H[3];
            var H4 = H[4];
            var H5 = H[5];
            var H6 = H[6];
            var H7 = H[7];
            var H0h = H0.high;
            var H0l = H0.low;
            var H1h = H1.high;
            var H1l = H1.low;
            var H2h = H2.high;
            var H2l = H2.low;
            var H3h = H3.high;
            var H3l = H3.low;
            var H4h = H4.high;
            var H4l = H4.low;
            var H5h = H5.high;
            var H5l = H5.low;
            var H6h = H6.high;
            var H6l = H6.low;
            var H7h = H7.high;
            var H7l = H7.low;
            var ah = H0h;
            var al = H0l;
            var bh = H1h;
            var bl = H1l;
            var ch = H2h;
            var cl = H2l;
            var dh = H3h;
            var dl = H3l;
            var eh = H4h;
            var el = H4l;
            var fh = H5h;
            var fl = H5l;
            var gh = H6h;
            var gl = H6l;
            var hh = H7h;
            var hl = H7l;
            for (var i = 0; i < 80; i++) {
              var Wil;
              var Wih;
              var Wi = W[i];
              if (i < 16) {
                Wih = Wi.high = M[offset + i * 2] | 0;
                Wil = Wi.low = M[offset + i * 2 + 1] | 0;
              } else {
                var gamma0x = W[i - 15];
                var gamma0xh = gamma0x.high;
                var gamma0xl = gamma0x.low;
                var gamma0h = (gamma0xh >>> 1 | gamma0xl << 31) ^ (gamma0xh >>> 8 | gamma0xl << 24) ^ gamma0xh >>> 7;
                var gamma0l = (gamma0xl >>> 1 | gamma0xh << 31) ^ (gamma0xl >>> 8 | gamma0xh << 24) ^ (gamma0xl >>> 7 | gamma0xh << 25);
                var gamma1x = W[i - 2];
                var gamma1xh = gamma1x.high;
                var gamma1xl = gamma1x.low;
                var gamma1h = (gamma1xh >>> 19 | gamma1xl << 13) ^ (gamma1xh << 3 | gamma1xl >>> 29) ^ gamma1xh >>> 6;
                var gamma1l = (gamma1xl >>> 19 | gamma1xh << 13) ^ (gamma1xl << 3 | gamma1xh >>> 29) ^ (gamma1xl >>> 6 | gamma1xh << 26);
                var Wi7 = W[i - 7];
                var Wi7h = Wi7.high;
                var Wi7l = Wi7.low;
                var Wi16 = W[i - 16];
                var Wi16h = Wi16.high;
                var Wi16l = Wi16.low;
                Wil = gamma0l + Wi7l;
                Wih = gamma0h + Wi7h + (Wil >>> 0 < gamma0l >>> 0 ? 1 : 0);
                Wil = Wil + gamma1l;
                Wih = Wih + gamma1h + (Wil >>> 0 < gamma1l >>> 0 ? 1 : 0);
                Wil = Wil + Wi16l;
                Wih = Wih + Wi16h + (Wil >>> 0 < Wi16l >>> 0 ? 1 : 0);
                Wi.high = Wih;
                Wi.low = Wil;
              }
              var chh = eh & fh ^ ~eh & gh;
              var chl = el & fl ^ ~el & gl;
              var majh = ah & bh ^ ah & ch ^ bh & ch;
              var majl = al & bl ^ al & cl ^ bl & cl;
              var sigma0h = (ah >>> 28 | al << 4) ^ (ah << 30 | al >>> 2) ^ (ah << 25 | al >>> 7);
              var sigma0l = (al >>> 28 | ah << 4) ^ (al << 30 | ah >>> 2) ^ (al << 25 | ah >>> 7);
              var sigma1h = (eh >>> 14 | el << 18) ^ (eh >>> 18 | el << 14) ^ (eh << 23 | el >>> 9);
              var sigma1l = (el >>> 14 | eh << 18) ^ (el >>> 18 | eh << 14) ^ (el << 23 | eh >>> 9);
              var Ki = K[i];
              var Kih = Ki.high;
              var Kil = Ki.low;
              var t1l = hl + sigma1l;
              var t1h = hh + sigma1h + (t1l >>> 0 < hl >>> 0 ? 1 : 0);
              var t1l = t1l + chl;
              var t1h = t1h + chh + (t1l >>> 0 < chl >>> 0 ? 1 : 0);
              var t1l = t1l + Kil;
              var t1h = t1h + Kih + (t1l >>> 0 < Kil >>> 0 ? 1 : 0);
              var t1l = t1l + Wil;
              var t1h = t1h + Wih + (t1l >>> 0 < Wil >>> 0 ? 1 : 0);
              var t2l = sigma0l + majl;
              var t2h = sigma0h + majh + (t2l >>> 0 < sigma0l >>> 0 ? 1 : 0);
              hh = gh;
              hl = gl;
              gh = fh;
              gl = fl;
              fh = eh;
              fl = el;
              el = dl + t1l | 0;
              eh = dh + t1h + (el >>> 0 < dl >>> 0 ? 1 : 0) | 0;
              dh = ch;
              dl = cl;
              ch = bh;
              cl = bl;
              bh = ah;
              bl = al;
              al = t1l + t2l | 0;
              ah = t1h + t2h + (al >>> 0 < t1l >>> 0 ? 1 : 0) | 0;
            }
            H0l = H0.low = H0l + al;
            H0.high = H0h + ah + (H0l >>> 0 < al >>> 0 ? 1 : 0);
            H1l = H1.low = H1l + bl;
            H1.high = H1h + bh + (H1l >>> 0 < bl >>> 0 ? 1 : 0);
            H2l = H2.low = H2l + cl;
            H2.high = H2h + ch + (H2l >>> 0 < cl >>> 0 ? 1 : 0);
            H3l = H3.low = H3l + dl;
            H3.high = H3h + dh + (H3l >>> 0 < dl >>> 0 ? 1 : 0);
            H4l = H4.low = H4l + el;
            H4.high = H4h + eh + (H4l >>> 0 < el >>> 0 ? 1 : 0);
            H5l = H5.low = H5l + fl;
            H5.high = H5h + fh + (H5l >>> 0 < fl >>> 0 ? 1 : 0);
            H6l = H6.low = H6l + gl;
            H6.high = H6h + gh + (H6l >>> 0 < gl >>> 0 ? 1 : 0);
            H7l = H7.low = H7l + hl;
            H7.high = H7h + hh + (H7l >>> 0 < hl >>> 0 ? 1 : 0);
          },
          _doFinalize: function() {
            var data = this._data;
            var dataWords = data.words;
            var nBitsTotal = this._nDataBytes * 8;
            var nBitsLeft = data.sigBytes * 8;
            dataWords[nBitsLeft >>> 5] |= 128 << 24 - nBitsLeft % 32;
            dataWords[(nBitsLeft + 128 >>> 10 << 5) + 30] = Math.floor(nBitsTotal / 4294967296);
            dataWords[(nBitsLeft + 128 >>> 10 << 5) + 31] = nBitsTotal;
            data.sigBytes = dataWords.length * 4;
            this._process();
            var hash = this._hash.toX32();
            return hash;
          },
          clone: function() {
            var clone = Hasher.clone.call(this);
            clone._hash = this._hash.clone();
            return clone;
          },
          blockSize: 1024 / 32
        });
        C.SHA512 = Hasher._createHelper(SHA512);
        C.HmacSHA512 = Hasher._createHmacHelper(SHA512);
      })();
      return CryptoJS.SHA512;
    });
  }
});

// node_modules/crypto-js/sha384.js
var require_sha384 = __commonJS({
  "node_modules/crypto-js/sha384.js"(exports2, module2) {
    (function(root, factory, undef) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core(), require_x64_core(), require_sha512());
      } else if (typeof define === "function" && define.amd) {
        define(["./core", "./x64-core", "./sha512"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      (function() {
        var C = CryptoJS;
        var C_x64 = C.x64;
        var X64Word = C_x64.Word;
        var X64WordArray = C_x64.WordArray;
        var C_algo = C.algo;
        var SHA512 = C_algo.SHA512;
        var SHA384 = C_algo.SHA384 = SHA512.extend({
          _doReset: function() {
            this._hash = new X64WordArray.init([
              new X64Word.init(3418070365, 3238371032),
              new X64Word.init(1654270250, 914150663),
              new X64Word.init(2438529370, 812702999),
              new X64Word.init(355462360, 4144912697),
              new X64Word.init(1731405415, 4290775857),
              new X64Word.init(2394180231, 1750603025),
              new X64Word.init(3675008525, 1694076839),
              new X64Word.init(1203062813, 3204075428)
            ]);
          },
          _doFinalize: function() {
            var hash = SHA512._doFinalize.call(this);
            hash.sigBytes -= 16;
            return hash;
          }
        });
        C.SHA384 = SHA512._createHelper(SHA384);
        C.HmacSHA384 = SHA512._createHmacHelper(SHA384);
      })();
      return CryptoJS.SHA384;
    });
  }
});

// node_modules/crypto-js/sha3.js
var require_sha3 = __commonJS({
  "node_modules/crypto-js/sha3.js"(exports2, module2) {
    (function(root, factory, undef) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core(), require_x64_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core", "./x64-core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      (function(Math2) {
        var C = CryptoJS;
        var C_lib = C.lib;
        var WordArray = C_lib.WordArray;
        var Hasher = C_lib.Hasher;
        var C_x64 = C.x64;
        var X64Word = C_x64.Word;
        var C_algo = C.algo;
        var RHO_OFFSETS = [];
        var PI_INDEXES = [];
        var ROUND_CONSTANTS = [];
        (function() {
          var x = 1, y = 0;
          for (var t = 0; t < 24; t++) {
            RHO_OFFSETS[x + 5 * y] = (t + 1) * (t + 2) / 2 % 64;
            var newX = y % 5;
            var newY = (2 * x + 3 * y) % 5;
            x = newX;
            y = newY;
          }
          for (var x = 0; x < 5; x++) {
            for (var y = 0; y < 5; y++) {
              PI_INDEXES[x + 5 * y] = y + (2 * x + 3 * y) % 5 * 5;
            }
          }
          var LFSR = 1;
          for (var i = 0; i < 24; i++) {
            var roundConstantMsw = 0;
            var roundConstantLsw = 0;
            for (var j = 0; j < 7; j++) {
              if (LFSR & 1) {
                var bitPosition = (1 << j) - 1;
                if (bitPosition < 32) {
                  roundConstantLsw ^= 1 << bitPosition;
                } else {
                  roundConstantMsw ^= 1 << bitPosition - 32;
                }
              }
              if (LFSR & 128) {
                LFSR = LFSR << 1 ^ 113;
              } else {
                LFSR <<= 1;
              }
            }
            ROUND_CONSTANTS[i] = X64Word.create(roundConstantMsw, roundConstantLsw);
          }
        })();
        var T = [];
        (function() {
          for (var i = 0; i < 25; i++) {
            T[i] = X64Word.create();
          }
        })();
        var SHA3 = C_algo.SHA3 = Hasher.extend({
          /**
           * Configuration options.
           *
           * @property {number} outputLength
           *   The desired number of bits in the output hash.
           *   Only values permitted are: 224, 256, 384, 512.
           *   Default: 512
           */
          cfg: Hasher.cfg.extend({
            outputLength: 512
          }),
          _doReset: function() {
            var state = this._state = [];
            for (var i = 0; i < 25; i++) {
              state[i] = new X64Word.init();
            }
            this.blockSize = (1600 - 2 * this.cfg.outputLength) / 32;
          },
          _doProcessBlock: function(M, offset) {
            var state = this._state;
            var nBlockSizeLanes = this.blockSize / 2;
            for (var i = 0; i < nBlockSizeLanes; i++) {
              var M2i = M[offset + 2 * i];
              var M2i1 = M[offset + 2 * i + 1];
              M2i = (M2i << 8 | M2i >>> 24) & 16711935 | (M2i << 24 | M2i >>> 8) & 4278255360;
              M2i1 = (M2i1 << 8 | M2i1 >>> 24) & 16711935 | (M2i1 << 24 | M2i1 >>> 8) & 4278255360;
              var lane = state[i];
              lane.high ^= M2i1;
              lane.low ^= M2i;
            }
            for (var round = 0; round < 24; round++) {
              for (var x = 0; x < 5; x++) {
                var tMsw = 0, tLsw = 0;
                for (var y = 0; y < 5; y++) {
                  var lane = state[x + 5 * y];
                  tMsw ^= lane.high;
                  tLsw ^= lane.low;
                }
                var Tx = T[x];
                Tx.high = tMsw;
                Tx.low = tLsw;
              }
              for (var x = 0; x < 5; x++) {
                var Tx4 = T[(x + 4) % 5];
                var Tx1 = T[(x + 1) % 5];
                var Tx1Msw = Tx1.high;
                var Tx1Lsw = Tx1.low;
                var tMsw = Tx4.high ^ (Tx1Msw << 1 | Tx1Lsw >>> 31);
                var tLsw = Tx4.low ^ (Tx1Lsw << 1 | Tx1Msw >>> 31);
                for (var y = 0; y < 5; y++) {
                  var lane = state[x + 5 * y];
                  lane.high ^= tMsw;
                  lane.low ^= tLsw;
                }
              }
              for (var laneIndex = 1; laneIndex < 25; laneIndex++) {
                var tMsw;
                var tLsw;
                var lane = state[laneIndex];
                var laneMsw = lane.high;
                var laneLsw = lane.low;
                var rhoOffset = RHO_OFFSETS[laneIndex];
                if (rhoOffset < 32) {
                  tMsw = laneMsw << rhoOffset | laneLsw >>> 32 - rhoOffset;
                  tLsw = laneLsw << rhoOffset | laneMsw >>> 32 - rhoOffset;
                } else {
                  tMsw = laneLsw << rhoOffset - 32 | laneMsw >>> 64 - rhoOffset;
                  tLsw = laneMsw << rhoOffset - 32 | laneLsw >>> 64 - rhoOffset;
                }
                var TPiLane = T[PI_INDEXES[laneIndex]];
                TPiLane.high = tMsw;
                TPiLane.low = tLsw;
              }
              var T0 = T[0];
              var state0 = state[0];
              T0.high = state0.high;
              T0.low = state0.low;
              for (var x = 0; x < 5; x++) {
                for (var y = 0; y < 5; y++) {
                  var laneIndex = x + 5 * y;
                  var lane = state[laneIndex];
                  var TLane = T[laneIndex];
                  var Tx1Lane = T[(x + 1) % 5 + 5 * y];
                  var Tx2Lane = T[(x + 2) % 5 + 5 * y];
                  lane.high = TLane.high ^ ~Tx1Lane.high & Tx2Lane.high;
                  lane.low = TLane.low ^ ~Tx1Lane.low & Tx2Lane.low;
                }
              }
              var lane = state[0];
              var roundConstant = ROUND_CONSTANTS[round];
              lane.high ^= roundConstant.high;
              lane.low ^= roundConstant.low;
            }
          },
          _doFinalize: function() {
            var data = this._data;
            var dataWords = data.words;
            var nBitsTotal = this._nDataBytes * 8;
            var nBitsLeft = data.sigBytes * 8;
            var blockSizeBits = this.blockSize * 32;
            dataWords[nBitsLeft >>> 5] |= 1 << 24 - nBitsLeft % 32;
            dataWords[(Math2.ceil((nBitsLeft + 1) / blockSizeBits) * blockSizeBits >>> 5) - 1] |= 128;
            data.sigBytes = dataWords.length * 4;
            this._process();
            var state = this._state;
            var outputLengthBytes = this.cfg.outputLength / 8;
            var outputLengthLanes = outputLengthBytes / 8;
            var hashWords = [];
            for (var i = 0; i < outputLengthLanes; i++) {
              var lane = state[i];
              var laneMsw = lane.high;
              var laneLsw = lane.low;
              laneMsw = (laneMsw << 8 | laneMsw >>> 24) & 16711935 | (laneMsw << 24 | laneMsw >>> 8) & 4278255360;
              laneLsw = (laneLsw << 8 | laneLsw >>> 24) & 16711935 | (laneLsw << 24 | laneLsw >>> 8) & 4278255360;
              hashWords.push(laneLsw);
              hashWords.push(laneMsw);
            }
            return new WordArray.init(hashWords, outputLengthBytes);
          },
          clone: function() {
            var clone = Hasher.clone.call(this);
            var state = clone._state = this._state.slice(0);
            for (var i = 0; i < 25; i++) {
              state[i] = state[i].clone();
            }
            return clone;
          }
        });
        C.SHA3 = Hasher._createHelper(SHA3);
        C.HmacSHA3 = Hasher._createHmacHelper(SHA3);
      })(Math);
      return CryptoJS.SHA3;
    });
  }
});

// node_modules/crypto-js/ripemd160.js
var require_ripemd160 = __commonJS({
  "node_modules/crypto-js/ripemd160.js"(exports2, module2) {
    (function(root, factory) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      (function(Math2) {
        var C = CryptoJS;
        var C_lib = C.lib;
        var WordArray = C_lib.WordArray;
        var Hasher = C_lib.Hasher;
        var C_algo = C.algo;
        var _zl = WordArray.create([
          0,
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8,
          9,
          10,
          11,
          12,
          13,
          14,
          15,
          7,
          4,
          13,
          1,
          10,
          6,
          15,
          3,
          12,
          0,
          9,
          5,
          2,
          14,
          11,
          8,
          3,
          10,
          14,
          4,
          9,
          15,
          8,
          1,
          2,
          7,
          0,
          6,
          13,
          11,
          5,
          12,
          1,
          9,
          11,
          10,
          0,
          8,
          12,
          4,
          13,
          3,
          7,
          15,
          14,
          5,
          6,
          2,
          4,
          0,
          5,
          9,
          7,
          12,
          2,
          10,
          14,
          1,
          3,
          8,
          11,
          6,
          15,
          13
        ]);
        var _zr = WordArray.create([
          5,
          14,
          7,
          0,
          9,
          2,
          11,
          4,
          13,
          6,
          15,
          8,
          1,
          10,
          3,
          12,
          6,
          11,
          3,
          7,
          0,
          13,
          5,
          10,
          14,
          15,
          8,
          12,
          4,
          9,
          1,
          2,
          15,
          5,
          1,
          3,
          7,
          14,
          6,
          9,
          11,
          8,
          12,
          2,
          10,
          0,
          4,
          13,
          8,
          6,
          4,
          1,
          3,
          11,
          15,
          0,
          5,
          12,
          2,
          13,
          9,
          7,
          10,
          14,
          12,
          15,
          10,
          4,
          1,
          5,
          8,
          7,
          6,
          2,
          13,
          14,
          0,
          3,
          9,
          11
        ]);
        var _sl = WordArray.create([
          11,
          14,
          15,
          12,
          5,
          8,
          7,
          9,
          11,
          13,
          14,
          15,
          6,
          7,
          9,
          8,
          7,
          6,
          8,
          13,
          11,
          9,
          7,
          15,
          7,
          12,
          15,
          9,
          11,
          7,
          13,
          12,
          11,
          13,
          6,
          7,
          14,
          9,
          13,
          15,
          14,
          8,
          13,
          6,
          5,
          12,
          7,
          5,
          11,
          12,
          14,
          15,
          14,
          15,
          9,
          8,
          9,
          14,
          5,
          6,
          8,
          6,
          5,
          12,
          9,
          15,
          5,
          11,
          6,
          8,
          13,
          12,
          5,
          12,
          13,
          14,
          11,
          8,
          5,
          6
        ]);
        var _sr = WordArray.create([
          8,
          9,
          9,
          11,
          13,
          15,
          15,
          5,
          7,
          7,
          8,
          11,
          14,
          14,
          12,
          6,
          9,
          13,
          15,
          7,
          12,
          8,
          9,
          11,
          7,
          7,
          12,
          7,
          6,
          15,
          13,
          11,
          9,
          7,
          15,
          11,
          8,
          6,
          6,
          14,
          12,
          13,
          5,
          14,
          13,
          13,
          7,
          5,
          15,
          5,
          8,
          11,
          14,
          14,
          6,
          14,
          6,
          9,
          12,
          9,
          12,
          5,
          15,
          8,
          8,
          5,
          12,
          9,
          12,
          5,
          14,
          6,
          8,
          13,
          6,
          5,
          15,
          13,
          11,
          11
        ]);
        var _hl = WordArray.create([0, 1518500249, 1859775393, 2400959708, 2840853838]);
        var _hr = WordArray.create([1352829926, 1548603684, 1836072691, 2053994217, 0]);
        var RIPEMD160 = C_algo.RIPEMD160 = Hasher.extend({
          _doReset: function() {
            this._hash = WordArray.create([1732584193, 4023233417, 2562383102, 271733878, 3285377520]);
          },
          _doProcessBlock: function(M, offset) {
            for (var i = 0; i < 16; i++) {
              var offset_i = offset + i;
              var M_offset_i = M[offset_i];
              M[offset_i] = (M_offset_i << 8 | M_offset_i >>> 24) & 16711935 | (M_offset_i << 24 | M_offset_i >>> 8) & 4278255360;
            }
            var H = this._hash.words;
            var hl = _hl.words;
            var hr = _hr.words;
            var zl = _zl.words;
            var zr = _zr.words;
            var sl = _sl.words;
            var sr = _sr.words;
            var al, bl, cl, dl, el;
            var ar, br, cr, dr, er;
            ar = al = H[0];
            br = bl = H[1];
            cr = cl = H[2];
            dr = dl = H[3];
            er = el = H[4];
            var t;
            for (var i = 0; i < 80; i += 1) {
              t = al + M[offset + zl[i]] | 0;
              if (i < 16) {
                t += f1(bl, cl, dl) + hl[0];
              } else if (i < 32) {
                t += f2(bl, cl, dl) + hl[1];
              } else if (i < 48) {
                t += f3(bl, cl, dl) + hl[2];
              } else if (i < 64) {
                t += f4(bl, cl, dl) + hl[3];
              } else {
                t += f5(bl, cl, dl) + hl[4];
              }
              t = t | 0;
              t = rotl(t, sl[i]);
              t = t + el | 0;
              al = el;
              el = dl;
              dl = rotl(cl, 10);
              cl = bl;
              bl = t;
              t = ar + M[offset + zr[i]] | 0;
              if (i < 16) {
                t += f5(br, cr, dr) + hr[0];
              } else if (i < 32) {
                t += f4(br, cr, dr) + hr[1];
              } else if (i < 48) {
                t += f3(br, cr, dr) + hr[2];
              } else if (i < 64) {
                t += f2(br, cr, dr) + hr[3];
              } else {
                t += f1(br, cr, dr) + hr[4];
              }
              t = t | 0;
              t = rotl(t, sr[i]);
              t = t + er | 0;
              ar = er;
              er = dr;
              dr = rotl(cr, 10);
              cr = br;
              br = t;
            }
            t = H[1] + cl + dr | 0;
            H[1] = H[2] + dl + er | 0;
            H[2] = H[3] + el + ar | 0;
            H[3] = H[4] + al + br | 0;
            H[4] = H[0] + bl + cr | 0;
            H[0] = t;
          },
          _doFinalize: function() {
            var data = this._data;
            var dataWords = data.words;
            var nBitsTotal = this._nDataBytes * 8;
            var nBitsLeft = data.sigBytes * 8;
            dataWords[nBitsLeft >>> 5] |= 128 << 24 - nBitsLeft % 32;
            dataWords[(nBitsLeft + 64 >>> 9 << 4) + 14] = (nBitsTotal << 8 | nBitsTotal >>> 24) & 16711935 | (nBitsTotal << 24 | nBitsTotal >>> 8) & 4278255360;
            data.sigBytes = (dataWords.length + 1) * 4;
            this._process();
            var hash = this._hash;
            var H = hash.words;
            for (var i = 0; i < 5; i++) {
              var H_i = H[i];
              H[i] = (H_i << 8 | H_i >>> 24) & 16711935 | (H_i << 24 | H_i >>> 8) & 4278255360;
            }
            return hash;
          },
          clone: function() {
            var clone = Hasher.clone.call(this);
            clone._hash = this._hash.clone();
            return clone;
          }
        });
        function f1(x, y, z) {
          return x ^ y ^ z;
        }
        function f2(x, y, z) {
          return x & y | ~x & z;
        }
        function f3(x, y, z) {
          return (x | ~y) ^ z;
        }
        function f4(x, y, z) {
          return x & z | y & ~z;
        }
        function f5(x, y, z) {
          return x ^ (y | ~z);
        }
        function rotl(x, n) {
          return x << n | x >>> 32 - n;
        }
        C.RIPEMD160 = Hasher._createHelper(RIPEMD160);
        C.HmacRIPEMD160 = Hasher._createHmacHelper(RIPEMD160);
      })(Math);
      return CryptoJS.RIPEMD160;
    });
  }
});

// node_modules/crypto-js/hmac.js
var require_hmac = __commonJS({
  "node_modules/crypto-js/hmac.js"(exports2, module2) {
    (function(root, factory) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      (function() {
        var C = CryptoJS;
        var C_lib = C.lib;
        var Base = C_lib.Base;
        var C_enc = C.enc;
        var Utf8 = C_enc.Utf8;
        var C_algo = C.algo;
        var HMAC = C_algo.HMAC = Base.extend({
          /**
           * Initializes a newly created HMAC.
           *
           * @param {Hasher} hasher The hash algorithm to use.
           * @param {WordArray|string} key The secret key.
           *
           * @example
           *
           *     var hmacHasher = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, key);
           */
          init: function(hasher, key) {
            hasher = this._hasher = new hasher.init();
            if (typeof key == "string") {
              key = Utf8.parse(key);
            }
            var hasherBlockSize = hasher.blockSize;
            var hasherBlockSizeBytes = hasherBlockSize * 4;
            if (key.sigBytes > hasherBlockSizeBytes) {
              key = hasher.finalize(key);
            }
            key.clamp();
            var oKey = this._oKey = key.clone();
            var iKey = this._iKey = key.clone();
            var oKeyWords = oKey.words;
            var iKeyWords = iKey.words;
            for (var i = 0; i < hasherBlockSize; i++) {
              oKeyWords[i] ^= 1549556828;
              iKeyWords[i] ^= 909522486;
            }
            oKey.sigBytes = iKey.sigBytes = hasherBlockSizeBytes;
            this.reset();
          },
          /**
           * Resets this HMAC to its initial state.
           *
           * @example
           *
           *     hmacHasher.reset();
           */
          reset: function() {
            var hasher = this._hasher;
            hasher.reset();
            hasher.update(this._iKey);
          },
          /**
           * Updates this HMAC with a message.
           *
           * @param {WordArray|string} messageUpdate The message to append.
           *
           * @return {HMAC} This HMAC instance.
           *
           * @example
           *
           *     hmacHasher.update('message');
           *     hmacHasher.update(wordArray);
           */
          update: function(messageUpdate) {
            this._hasher.update(messageUpdate);
            return this;
          },
          /**
           * Finalizes the HMAC computation.
           * Note that the finalize operation is effectively a destructive, read-once operation.
           *
           * @param {WordArray|string} messageUpdate (Optional) A final message update.
           *
           * @return {WordArray} The HMAC.
           *
           * @example
           *
           *     var hmac = hmacHasher.finalize();
           *     var hmac = hmacHasher.finalize('message');
           *     var hmac = hmacHasher.finalize(wordArray);
           */
          finalize: function(messageUpdate) {
            var hasher = this._hasher;
            var innerHash = hasher.finalize(messageUpdate);
            hasher.reset();
            var hmac = hasher.finalize(this._oKey.clone().concat(innerHash));
            return hmac;
          }
        });
      })();
    });
  }
});

// node_modules/crypto-js/pbkdf2.js
var require_pbkdf2 = __commonJS({
  "node_modules/crypto-js/pbkdf2.js"(exports2, module2) {
    (function(root, factory, undef) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core(), require_sha256(), require_hmac());
      } else if (typeof define === "function" && define.amd) {
        define(["./core", "./sha256", "./hmac"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      (function() {
        var C = CryptoJS;
        var C_lib = C.lib;
        var Base = C_lib.Base;
        var WordArray = C_lib.WordArray;
        var C_algo = C.algo;
        var SHA256 = C_algo.SHA256;
        var HMAC = C_algo.HMAC;
        var PBKDF2 = C_algo.PBKDF2 = Base.extend({
          /**
           * Configuration options.
           *
           * @property {number} keySize The key size in words to generate. Default: 4 (128 bits)
           * @property {Hasher} hasher The hasher to use. Default: SHA256
           * @property {number} iterations The number of iterations to perform. Default: 250000
           */
          cfg: Base.extend({
            keySize: 128 / 32,
            hasher: SHA256,
            iterations: 25e4
          }),
          /**
           * Initializes a newly created key derivation function.
           *
           * @param {Object} cfg (Optional) The configuration options to use for the derivation.
           *
           * @example
           *
           *     var kdf = CryptoJS.algo.PBKDF2.create();
           *     var kdf = CryptoJS.algo.PBKDF2.create({ keySize: 8 });
           *     var kdf = CryptoJS.algo.PBKDF2.create({ keySize: 8, iterations: 1000 });
           */
          init: function(cfg) {
            this.cfg = this.cfg.extend(cfg);
          },
          /**
           * Computes the Password-Based Key Derivation Function 2.
           *
           * @param {WordArray|string} password The password.
           * @param {WordArray|string} salt A salt.
           *
           * @return {WordArray} The derived key.
           *
           * @example
           *
           *     var key = kdf.compute(password, salt);
           */
          compute: function(password, salt) {
            var cfg = this.cfg;
            var hmac = HMAC.create(cfg.hasher, password);
            var derivedKey = WordArray.create();
            var blockIndex = WordArray.create([1]);
            var derivedKeyWords = derivedKey.words;
            var blockIndexWords = blockIndex.words;
            var keySize = cfg.keySize;
            var iterations = cfg.iterations;
            while (derivedKeyWords.length < keySize) {
              var block = hmac.update(salt).finalize(blockIndex);
              hmac.reset();
              var blockWords = block.words;
              var blockWordsLength = blockWords.length;
              var intermediate = block;
              for (var i = 1; i < iterations; i++) {
                intermediate = hmac.finalize(intermediate);
                hmac.reset();
                var intermediateWords = intermediate.words;
                for (var j = 0; j < blockWordsLength; j++) {
                  blockWords[j] ^= intermediateWords[j];
                }
              }
              derivedKey.concat(block);
              blockIndexWords[0]++;
            }
            derivedKey.sigBytes = keySize * 4;
            return derivedKey;
          }
        });
        C.PBKDF2 = function(password, salt, cfg) {
          return PBKDF2.create(cfg).compute(password, salt);
        };
      })();
      return CryptoJS.PBKDF2;
    });
  }
});

// node_modules/crypto-js/evpkdf.js
var require_evpkdf = __commonJS({
  "node_modules/crypto-js/evpkdf.js"(exports2, module2) {
    (function(root, factory, undef) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core(), require_sha1(), require_hmac());
      } else if (typeof define === "function" && define.amd) {
        define(["./core", "./sha1", "./hmac"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      (function() {
        var C = CryptoJS;
        var C_lib = C.lib;
        var Base = C_lib.Base;
        var WordArray = C_lib.WordArray;
        var C_algo = C.algo;
        var MD5 = C_algo.MD5;
        var EvpKDF = C_algo.EvpKDF = Base.extend({
          /**
           * Configuration options.
           *
           * @property {number} keySize The key size in words to generate. Default: 4 (128 bits)
           * @property {Hasher} hasher The hash algorithm to use. Default: MD5
           * @property {number} iterations The number of iterations to perform. Default: 1
           */
          cfg: Base.extend({
            keySize: 128 / 32,
            hasher: MD5,
            iterations: 1
          }),
          /**
           * Initializes a newly created key derivation function.
           *
           * @param {Object} cfg (Optional) The configuration options to use for the derivation.
           *
           * @example
           *
           *     var kdf = CryptoJS.algo.EvpKDF.create();
           *     var kdf = CryptoJS.algo.EvpKDF.create({ keySize: 8 });
           *     var kdf = CryptoJS.algo.EvpKDF.create({ keySize: 8, iterations: 1000 });
           */
          init: function(cfg) {
            this.cfg = this.cfg.extend(cfg);
          },
          /**
           * Derives a key from a password.
           *
           * @param {WordArray|string} password The password.
           * @param {WordArray|string} salt A salt.
           *
           * @return {WordArray} The derived key.
           *
           * @example
           *
           *     var key = kdf.compute(password, salt);
           */
          compute: function(password, salt) {
            var block;
            var cfg = this.cfg;
            var hasher = cfg.hasher.create();
            var derivedKey = WordArray.create();
            var derivedKeyWords = derivedKey.words;
            var keySize = cfg.keySize;
            var iterations = cfg.iterations;
            while (derivedKeyWords.length < keySize) {
              if (block) {
                hasher.update(block);
              }
              block = hasher.update(password).finalize(salt);
              hasher.reset();
              for (var i = 1; i < iterations; i++) {
                block = hasher.finalize(block);
                hasher.reset();
              }
              derivedKey.concat(block);
            }
            derivedKey.sigBytes = keySize * 4;
            return derivedKey;
          }
        });
        C.EvpKDF = function(password, salt, cfg) {
          return EvpKDF.create(cfg).compute(password, salt);
        };
      })();
      return CryptoJS.EvpKDF;
    });
  }
});

// node_modules/crypto-js/cipher-core.js
var require_cipher_core = __commonJS({
  "node_modules/crypto-js/cipher-core.js"(exports2, module2) {
    (function(root, factory, undef) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core(), require_evpkdf());
      } else if (typeof define === "function" && define.amd) {
        define(["./core", "./evpkdf"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      CryptoJS.lib.Cipher || (function(undefined2) {
        var C = CryptoJS;
        var C_lib = C.lib;
        var Base = C_lib.Base;
        var WordArray = C_lib.WordArray;
        var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm;
        var C_enc = C.enc;
        var Utf8 = C_enc.Utf8;
        var Base64 = C_enc.Base64;
        var C_algo = C.algo;
        var EvpKDF = C_algo.EvpKDF;
        var Cipher = C_lib.Cipher = BufferedBlockAlgorithm.extend({
          /**
           * Configuration options.
           *
           * @property {WordArray} iv The IV to use for this operation.
           */
          cfg: Base.extend(),
          /**
           * Creates this cipher in encryption mode.
           *
           * @param {WordArray} key The key.
           * @param {Object} cfg (Optional) The configuration options to use for this operation.
           *
           * @return {Cipher} A cipher instance.
           *
           * @static
           *
           * @example
           *
           *     var cipher = CryptoJS.algo.AES.createEncryptor(keyWordArray, { iv: ivWordArray });
           */
          createEncryptor: function(key, cfg) {
            return this.create(this._ENC_XFORM_MODE, key, cfg);
          },
          /**
           * Creates this cipher in decryption mode.
           *
           * @param {WordArray} key The key.
           * @param {Object} cfg (Optional) The configuration options to use for this operation.
           *
           * @return {Cipher} A cipher instance.
           *
           * @static
           *
           * @example
           *
           *     var cipher = CryptoJS.algo.AES.createDecryptor(keyWordArray, { iv: ivWordArray });
           */
          createDecryptor: function(key, cfg) {
            return this.create(this._DEC_XFORM_MODE, key, cfg);
          },
          /**
           * Initializes a newly created cipher.
           *
           * @param {number} xformMode Either the encryption or decryption transormation mode constant.
           * @param {WordArray} key The key.
           * @param {Object} cfg (Optional) The configuration options to use for this operation.
           *
           * @example
           *
           *     var cipher = CryptoJS.algo.AES.create(CryptoJS.algo.AES._ENC_XFORM_MODE, keyWordArray, { iv: ivWordArray });
           */
          init: function(xformMode, key, cfg) {
            this.cfg = this.cfg.extend(cfg);
            this._xformMode = xformMode;
            this._key = key;
            this.reset();
          },
          /**
           * Resets this cipher to its initial state.
           *
           * @example
           *
           *     cipher.reset();
           */
          reset: function() {
            BufferedBlockAlgorithm.reset.call(this);
            this._doReset();
          },
          /**
           * Adds data to be encrypted or decrypted.
           *
           * @param {WordArray|string} dataUpdate The data to encrypt or decrypt.
           *
           * @return {WordArray} The data after processing.
           *
           * @example
           *
           *     var encrypted = cipher.process('data');
           *     var encrypted = cipher.process(wordArray);
           */
          process: function(dataUpdate) {
            this._append(dataUpdate);
            return this._process();
          },
          /**
           * Finalizes the encryption or decryption process.
           * Note that the finalize operation is effectively a destructive, read-once operation.
           *
           * @param {WordArray|string} dataUpdate The final data to encrypt or decrypt.
           *
           * @return {WordArray} The data after final processing.
           *
           * @example
           *
           *     var encrypted = cipher.finalize();
           *     var encrypted = cipher.finalize('data');
           *     var encrypted = cipher.finalize(wordArray);
           */
          finalize: function(dataUpdate) {
            if (dataUpdate) {
              this._append(dataUpdate);
            }
            var finalProcessedData = this._doFinalize();
            return finalProcessedData;
          },
          keySize: 128 / 32,
          ivSize: 128 / 32,
          _ENC_XFORM_MODE: 1,
          _DEC_XFORM_MODE: 2,
          /**
           * Creates shortcut functions to a cipher's object interface.
           *
           * @param {Cipher} cipher The cipher to create a helper for.
           *
           * @return {Object} An object with encrypt and decrypt shortcut functions.
           *
           * @static
           *
           * @example
           *
           *     var AES = CryptoJS.lib.Cipher._createHelper(CryptoJS.algo.AES);
           */
          _createHelper: /* @__PURE__ */ (function() {
            function selectCipherStrategy(key) {
              if (typeof key == "string") {
                return PasswordBasedCipher;
              } else {
                return SerializableCipher;
              }
            }
            return function(cipher) {
              return {
                encrypt: function(message, key, cfg) {
                  return selectCipherStrategy(key).encrypt(cipher, message, key, cfg);
                },
                decrypt: function(ciphertext, key, cfg) {
                  return selectCipherStrategy(key).decrypt(cipher, ciphertext, key, cfg);
                }
              };
            };
          })()
        });
        var StreamCipher = C_lib.StreamCipher = Cipher.extend({
          _doFinalize: function() {
            var finalProcessedBlocks = this._process(true);
            return finalProcessedBlocks;
          },
          blockSize: 1
        });
        var C_mode = C.mode = {};
        var BlockCipherMode = C_lib.BlockCipherMode = Base.extend({
          /**
           * Creates this mode for encryption.
           *
           * @param {Cipher} cipher A block cipher instance.
           * @param {Array} iv The IV words.
           *
           * @static
           *
           * @example
           *
           *     var mode = CryptoJS.mode.CBC.createEncryptor(cipher, iv.words);
           */
          createEncryptor: function(cipher, iv) {
            return this.Encryptor.create(cipher, iv);
          },
          /**
           * Creates this mode for decryption.
           *
           * @param {Cipher} cipher A block cipher instance.
           * @param {Array} iv The IV words.
           *
           * @static
           *
           * @example
           *
           *     var mode = CryptoJS.mode.CBC.createDecryptor(cipher, iv.words);
           */
          createDecryptor: function(cipher, iv) {
            return this.Decryptor.create(cipher, iv);
          },
          /**
           * Initializes a newly created mode.
           *
           * @param {Cipher} cipher A block cipher instance.
           * @param {Array} iv The IV words.
           *
           * @example
           *
           *     var mode = CryptoJS.mode.CBC.Encryptor.create(cipher, iv.words);
           */
          init: function(cipher, iv) {
            this._cipher = cipher;
            this._iv = iv;
          }
        });
        var CBC = C_mode.CBC = (function() {
          var CBC2 = BlockCipherMode.extend();
          CBC2.Encryptor = CBC2.extend({
            /**
             * Processes the data block at offset.
             *
             * @param {Array} words The data words to operate on.
             * @param {number} offset The offset where the block starts.
             *
             * @example
             *
             *     mode.processBlock(data.words, offset);
             */
            processBlock: function(words, offset) {
              var cipher = this._cipher;
              var blockSize = cipher.blockSize;
              xorBlock.call(this, words, offset, blockSize);
              cipher.encryptBlock(words, offset);
              this._prevBlock = words.slice(offset, offset + blockSize);
            }
          });
          CBC2.Decryptor = CBC2.extend({
            /**
             * Processes the data block at offset.
             *
             * @param {Array} words The data words to operate on.
             * @param {number} offset The offset where the block starts.
             *
             * @example
             *
             *     mode.processBlock(data.words, offset);
             */
            processBlock: function(words, offset) {
              var cipher = this._cipher;
              var blockSize = cipher.blockSize;
              var thisBlock = words.slice(offset, offset + blockSize);
              cipher.decryptBlock(words, offset);
              xorBlock.call(this, words, offset, blockSize);
              this._prevBlock = thisBlock;
            }
          });
          function xorBlock(words, offset, blockSize) {
            var block;
            var iv = this._iv;
            if (iv) {
              block = iv;
              this._iv = undefined2;
            } else {
              block = this._prevBlock;
            }
            for (var i = 0; i < blockSize; i++) {
              words[offset + i] ^= block[i];
            }
          }
          return CBC2;
        })();
        var C_pad = C.pad = {};
        var Pkcs7 = C_pad.Pkcs7 = {
          /**
           * Pads data using the algorithm defined in PKCS #5/7.
           *
           * @param {WordArray} data The data to pad.
           * @param {number} blockSize The multiple that the data should be padded to.
           *
           * @static
           *
           * @example
           *
           *     CryptoJS.pad.Pkcs7.pad(wordArray, 4);
           */
          pad: function(data, blockSize) {
            var blockSizeBytes = blockSize * 4;
            var nPaddingBytes = blockSizeBytes - data.sigBytes % blockSizeBytes;
            var paddingWord = nPaddingBytes << 24 | nPaddingBytes << 16 | nPaddingBytes << 8 | nPaddingBytes;
            var paddingWords = [];
            for (var i = 0; i < nPaddingBytes; i += 4) {
              paddingWords.push(paddingWord);
            }
            var padding = WordArray.create(paddingWords, nPaddingBytes);
            data.concat(padding);
          },
          /**
           * Unpads data that had been padded using the algorithm defined in PKCS #5/7.
           *
           * @param {WordArray} data The data to unpad.
           *
           * @static
           *
           * @example
           *
           *     CryptoJS.pad.Pkcs7.unpad(wordArray);
           */
          unpad: function(data) {
            var nPaddingBytes = data.words[data.sigBytes - 1 >>> 2] & 255;
            data.sigBytes -= nPaddingBytes;
          }
        };
        var BlockCipher = C_lib.BlockCipher = Cipher.extend({
          /**
           * Configuration options.
           *
           * @property {Mode} mode The block mode to use. Default: CBC
           * @property {Padding} padding The padding strategy to use. Default: Pkcs7
           */
          cfg: Cipher.cfg.extend({
            mode: CBC,
            padding: Pkcs7
          }),
          reset: function() {
            var modeCreator;
            Cipher.reset.call(this);
            var cfg = this.cfg;
            var iv = cfg.iv;
            var mode = cfg.mode;
            if (this._xformMode == this._ENC_XFORM_MODE) {
              modeCreator = mode.createEncryptor;
            } else {
              modeCreator = mode.createDecryptor;
              this._minBufferSize = 1;
            }
            if (this._mode && this._mode.__creator == modeCreator) {
              this._mode.init(this, iv && iv.words);
            } else {
              this._mode = modeCreator.call(mode, this, iv && iv.words);
              this._mode.__creator = modeCreator;
            }
          },
          _doProcessBlock: function(words, offset) {
            this._mode.processBlock(words, offset);
          },
          _doFinalize: function() {
            var finalProcessedBlocks;
            var padding = this.cfg.padding;
            if (this._xformMode == this._ENC_XFORM_MODE) {
              padding.pad(this._data, this.blockSize);
              finalProcessedBlocks = this._process(true);
            } else {
              finalProcessedBlocks = this._process(true);
              padding.unpad(finalProcessedBlocks);
            }
            return finalProcessedBlocks;
          },
          blockSize: 128 / 32
        });
        var CipherParams = C_lib.CipherParams = Base.extend({
          /**
           * Initializes a newly created cipher params object.
           *
           * @param {Object} cipherParams An object with any of the possible cipher parameters.
           *
           * @example
           *
           *     var cipherParams = CryptoJS.lib.CipherParams.create({
           *         ciphertext: ciphertextWordArray,
           *         key: keyWordArray,
           *         iv: ivWordArray,
           *         salt: saltWordArray,
           *         algorithm: CryptoJS.algo.AES,
           *         mode: CryptoJS.mode.CBC,
           *         padding: CryptoJS.pad.PKCS7,
           *         blockSize: 4,
           *         formatter: CryptoJS.format.OpenSSL
           *     });
           */
          init: function(cipherParams) {
            this.mixIn(cipherParams);
          },
          /**
           * Converts this cipher params object to a string.
           *
           * @param {Format} formatter (Optional) The formatting strategy to use.
           *
           * @return {string} The stringified cipher params.
           *
           * @throws Error If neither the formatter nor the default formatter is set.
           *
           * @example
           *
           *     var string = cipherParams + '';
           *     var string = cipherParams.toString();
           *     var string = cipherParams.toString(CryptoJS.format.OpenSSL);
           */
          toString: function(formatter) {
            return (formatter || this.formatter).stringify(this);
          }
        });
        var C_format = C.format = {};
        var OpenSSLFormatter = C_format.OpenSSL = {
          /**
           * Converts a cipher params object to an OpenSSL-compatible string.
           *
           * @param {CipherParams} cipherParams The cipher params object.
           *
           * @return {string} The OpenSSL-compatible string.
           *
           * @static
           *
           * @example
           *
           *     var openSSLString = CryptoJS.format.OpenSSL.stringify(cipherParams);
           */
          stringify: function(cipherParams) {
            var wordArray;
            var ciphertext = cipherParams.ciphertext;
            var salt = cipherParams.salt;
            if (salt) {
              wordArray = WordArray.create([1398893684, 1701076831]).concat(salt).concat(ciphertext);
            } else {
              wordArray = ciphertext;
            }
            return wordArray.toString(Base64);
          },
          /**
           * Converts an OpenSSL-compatible string to a cipher params object.
           *
           * @param {string} openSSLStr The OpenSSL-compatible string.
           *
           * @return {CipherParams} The cipher params object.
           *
           * @static
           *
           * @example
           *
           *     var cipherParams = CryptoJS.format.OpenSSL.parse(openSSLString);
           */
          parse: function(openSSLStr) {
            var salt;
            var ciphertext = Base64.parse(openSSLStr);
            var ciphertextWords = ciphertext.words;
            if (ciphertextWords[0] == 1398893684 && ciphertextWords[1] == 1701076831) {
              salt = WordArray.create(ciphertextWords.slice(2, 4));
              ciphertextWords.splice(0, 4);
              ciphertext.sigBytes -= 16;
            }
            return CipherParams.create({ ciphertext, salt });
          }
        };
        var SerializableCipher = C_lib.SerializableCipher = Base.extend({
          /**
           * Configuration options.
           *
           * @property {Formatter} format The formatting strategy to convert cipher param objects to and from a string. Default: OpenSSL
           */
          cfg: Base.extend({
            format: OpenSSLFormatter
          }),
          /**
           * Encrypts a message.
           *
           * @param {Cipher} cipher The cipher algorithm to use.
           * @param {WordArray|string} message The message to encrypt.
           * @param {WordArray} key The key.
           * @param {Object} cfg (Optional) The configuration options to use for this operation.
           *
           * @return {CipherParams} A cipher params object.
           *
           * @static
           *
           * @example
           *
           *     var ciphertextParams = CryptoJS.lib.SerializableCipher.encrypt(CryptoJS.algo.AES, message, key);
           *     var ciphertextParams = CryptoJS.lib.SerializableCipher.encrypt(CryptoJS.algo.AES, message, key, { iv: iv });
           *     var ciphertextParams = CryptoJS.lib.SerializableCipher.encrypt(CryptoJS.algo.AES, message, key, { iv: iv, format: CryptoJS.format.OpenSSL });
           */
          encrypt: function(cipher, message, key, cfg) {
            cfg = this.cfg.extend(cfg);
            var encryptor = cipher.createEncryptor(key, cfg);
            var ciphertext = encryptor.finalize(message);
            var cipherCfg = encryptor.cfg;
            return CipherParams.create({
              ciphertext,
              key,
              iv: cipherCfg.iv,
              algorithm: cipher,
              mode: cipherCfg.mode,
              padding: cipherCfg.padding,
              blockSize: cipher.blockSize,
              formatter: cfg.format
            });
          },
          /**
           * Decrypts serialized ciphertext.
           *
           * @param {Cipher} cipher The cipher algorithm to use.
           * @param {CipherParams|string} ciphertext The ciphertext to decrypt.
           * @param {WordArray} key The key.
           * @param {Object} cfg (Optional) The configuration options to use for this operation.
           *
           * @return {WordArray} The plaintext.
           *
           * @static
           *
           * @example
           *
           *     var plaintext = CryptoJS.lib.SerializableCipher.decrypt(CryptoJS.algo.AES, formattedCiphertext, key, { iv: iv, format: CryptoJS.format.OpenSSL });
           *     var plaintext = CryptoJS.lib.SerializableCipher.decrypt(CryptoJS.algo.AES, ciphertextParams, key, { iv: iv, format: CryptoJS.format.OpenSSL });
           */
          decrypt: function(cipher, ciphertext, key, cfg) {
            cfg = this.cfg.extend(cfg);
            ciphertext = this._parse(ciphertext, cfg.format);
            var plaintext = cipher.createDecryptor(key, cfg).finalize(ciphertext.ciphertext);
            return plaintext;
          },
          /**
           * Converts serialized ciphertext to CipherParams,
           * else assumed CipherParams already and returns ciphertext unchanged.
           *
           * @param {CipherParams|string} ciphertext The ciphertext.
           * @param {Formatter} format The formatting strategy to use to parse serialized ciphertext.
           *
           * @return {CipherParams} The unserialized ciphertext.
           *
           * @static
           *
           * @example
           *
           *     var ciphertextParams = CryptoJS.lib.SerializableCipher._parse(ciphertextStringOrParams, format);
           */
          _parse: function(ciphertext, format) {
            if (typeof ciphertext == "string") {
              return format.parse(ciphertext, this);
            } else {
              return ciphertext;
            }
          }
        });
        var C_kdf = C.kdf = {};
        var OpenSSLKdf = C_kdf.OpenSSL = {
          /**
           * Derives a key and IV from a password.
           *
           * @param {string} password The password to derive from.
           * @param {number} keySize The size in words of the key to generate.
           * @param {number} ivSize The size in words of the IV to generate.
           * @param {WordArray|string} salt (Optional) A 64-bit salt to use. If omitted, a salt will be generated randomly.
           *
           * @return {CipherParams} A cipher params object with the key, IV, and salt.
           *
           * @static
           *
           * @example
           *
           *     var derivedParams = CryptoJS.kdf.OpenSSL.execute('Password', 256/32, 128/32);
           *     var derivedParams = CryptoJS.kdf.OpenSSL.execute('Password', 256/32, 128/32, 'saltsalt');
           */
          execute: function(password, keySize, ivSize, salt, hasher) {
            if (!salt) {
              salt = WordArray.random(64 / 8);
            }
            if (!hasher) {
              var key = EvpKDF.create({ keySize: keySize + ivSize }).compute(password, salt);
            } else {
              var key = EvpKDF.create({ keySize: keySize + ivSize, hasher }).compute(password, salt);
            }
            var iv = WordArray.create(key.words.slice(keySize), ivSize * 4);
            key.sigBytes = keySize * 4;
            return CipherParams.create({ key, iv, salt });
          }
        };
        var PasswordBasedCipher = C_lib.PasswordBasedCipher = SerializableCipher.extend({
          /**
           * Configuration options.
           *
           * @property {KDF} kdf The key derivation function to use to generate a key and IV from a password. Default: OpenSSL
           */
          cfg: SerializableCipher.cfg.extend({
            kdf: OpenSSLKdf
          }),
          /**
           * Encrypts a message using a password.
           *
           * @param {Cipher} cipher The cipher algorithm to use.
           * @param {WordArray|string} message The message to encrypt.
           * @param {string} password The password.
           * @param {Object} cfg (Optional) The configuration options to use for this operation.
           *
           * @return {CipherParams} A cipher params object.
           *
           * @static
           *
           * @example
           *
           *     var ciphertextParams = CryptoJS.lib.PasswordBasedCipher.encrypt(CryptoJS.algo.AES, message, 'password');
           *     var ciphertextParams = CryptoJS.lib.PasswordBasedCipher.encrypt(CryptoJS.algo.AES, message, 'password', { format: CryptoJS.format.OpenSSL });
           */
          encrypt: function(cipher, message, password, cfg) {
            cfg = this.cfg.extend(cfg);
            var derivedParams = cfg.kdf.execute(password, cipher.keySize, cipher.ivSize, cfg.salt, cfg.hasher);
            cfg.iv = derivedParams.iv;
            var ciphertext = SerializableCipher.encrypt.call(this, cipher, message, derivedParams.key, cfg);
            ciphertext.mixIn(derivedParams);
            return ciphertext;
          },
          /**
           * Decrypts serialized ciphertext using a password.
           *
           * @param {Cipher} cipher The cipher algorithm to use.
           * @param {CipherParams|string} ciphertext The ciphertext to decrypt.
           * @param {string} password The password.
           * @param {Object} cfg (Optional) The configuration options to use for this operation.
           *
           * @return {WordArray} The plaintext.
           *
           * @static
           *
           * @example
           *
           *     var plaintext = CryptoJS.lib.PasswordBasedCipher.decrypt(CryptoJS.algo.AES, formattedCiphertext, 'password', { format: CryptoJS.format.OpenSSL });
           *     var plaintext = CryptoJS.lib.PasswordBasedCipher.decrypt(CryptoJS.algo.AES, ciphertextParams, 'password', { format: CryptoJS.format.OpenSSL });
           */
          decrypt: function(cipher, ciphertext, password, cfg) {
            cfg = this.cfg.extend(cfg);
            ciphertext = this._parse(ciphertext, cfg.format);
            var derivedParams = cfg.kdf.execute(password, cipher.keySize, cipher.ivSize, ciphertext.salt, cfg.hasher);
            cfg.iv = derivedParams.iv;
            var plaintext = SerializableCipher.decrypt.call(this, cipher, ciphertext, derivedParams.key, cfg);
            return plaintext;
          }
        });
      })();
    });
  }
});

// node_modules/crypto-js/mode-cfb.js
var require_mode_cfb = __commonJS({
  "node_modules/crypto-js/mode-cfb.js"(exports2, module2) {
    (function(root, factory, undef) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core(), require_cipher_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core", "./cipher-core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      CryptoJS.mode.CFB = (function() {
        var CFB = CryptoJS.lib.BlockCipherMode.extend();
        CFB.Encryptor = CFB.extend({
          processBlock: function(words, offset) {
            var cipher = this._cipher;
            var blockSize = cipher.blockSize;
            generateKeystreamAndEncrypt.call(this, words, offset, blockSize, cipher);
            this._prevBlock = words.slice(offset, offset + blockSize);
          }
        });
        CFB.Decryptor = CFB.extend({
          processBlock: function(words, offset) {
            var cipher = this._cipher;
            var blockSize = cipher.blockSize;
            var thisBlock = words.slice(offset, offset + blockSize);
            generateKeystreamAndEncrypt.call(this, words, offset, blockSize, cipher);
            this._prevBlock = thisBlock;
          }
        });
        function generateKeystreamAndEncrypt(words, offset, blockSize, cipher) {
          var keystream;
          var iv = this._iv;
          if (iv) {
            keystream = iv.slice(0);
            this._iv = void 0;
          } else {
            keystream = this._prevBlock;
          }
          cipher.encryptBlock(keystream, 0);
          for (var i = 0; i < blockSize; i++) {
            words[offset + i] ^= keystream[i];
          }
        }
        return CFB;
      })();
      return CryptoJS.mode.CFB;
    });
  }
});

// node_modules/crypto-js/mode-ctr.js
var require_mode_ctr = __commonJS({
  "node_modules/crypto-js/mode-ctr.js"(exports2, module2) {
    (function(root, factory, undef) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core(), require_cipher_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core", "./cipher-core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      CryptoJS.mode.CTR = (function() {
        var CTR = CryptoJS.lib.BlockCipherMode.extend();
        var Encryptor = CTR.Encryptor = CTR.extend({
          processBlock: function(words, offset) {
            var cipher = this._cipher;
            var blockSize = cipher.blockSize;
            var iv = this._iv;
            var counter = this._counter;
            if (iv) {
              counter = this._counter = iv.slice(0);
              this._iv = void 0;
            }
            var keystream = counter.slice(0);
            cipher.encryptBlock(keystream, 0);
            counter[blockSize - 1] = counter[blockSize - 1] + 1 | 0;
            for (var i = 0; i < blockSize; i++) {
              words[offset + i] ^= keystream[i];
            }
          }
        });
        CTR.Decryptor = Encryptor;
        return CTR;
      })();
      return CryptoJS.mode.CTR;
    });
  }
});

// node_modules/crypto-js/mode-ctr-gladman.js
var require_mode_ctr_gladman = __commonJS({
  "node_modules/crypto-js/mode-ctr-gladman.js"(exports2, module2) {
    (function(root, factory, undef) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core(), require_cipher_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core", "./cipher-core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      CryptoJS.mode.CTRGladman = (function() {
        var CTRGladman = CryptoJS.lib.BlockCipherMode.extend();
        function incWord(word) {
          if ((word >> 24 & 255) === 255) {
            var b1 = word >> 16 & 255;
            var b2 = word >> 8 & 255;
            var b3 = word & 255;
            if (b1 === 255) {
              b1 = 0;
              if (b2 === 255) {
                b2 = 0;
                if (b3 === 255) {
                  b3 = 0;
                } else {
                  ++b3;
                }
              } else {
                ++b2;
              }
            } else {
              ++b1;
            }
            word = 0;
            word += b1 << 16;
            word += b2 << 8;
            word += b3;
          } else {
            word += 1 << 24;
          }
          return word;
        }
        function incCounter(counter) {
          if ((counter[0] = incWord(counter[0])) === 0) {
            counter[1] = incWord(counter[1]);
          }
          return counter;
        }
        var Encryptor = CTRGladman.Encryptor = CTRGladman.extend({
          processBlock: function(words, offset) {
            var cipher = this._cipher;
            var blockSize = cipher.blockSize;
            var iv = this._iv;
            var counter = this._counter;
            if (iv) {
              counter = this._counter = iv.slice(0);
              this._iv = void 0;
            }
            incCounter(counter);
            var keystream = counter.slice(0);
            cipher.encryptBlock(keystream, 0);
            for (var i = 0; i < blockSize; i++) {
              words[offset + i] ^= keystream[i];
            }
          }
        });
        CTRGladman.Decryptor = Encryptor;
        return CTRGladman;
      })();
      return CryptoJS.mode.CTRGladman;
    });
  }
});

// node_modules/crypto-js/mode-ofb.js
var require_mode_ofb = __commonJS({
  "node_modules/crypto-js/mode-ofb.js"(exports2, module2) {
    (function(root, factory, undef) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core(), require_cipher_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core", "./cipher-core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      CryptoJS.mode.OFB = (function() {
        var OFB = CryptoJS.lib.BlockCipherMode.extend();
        var Encryptor = OFB.Encryptor = OFB.extend({
          processBlock: function(words, offset) {
            var cipher = this._cipher;
            var blockSize = cipher.blockSize;
            var iv = this._iv;
            var keystream = this._keystream;
            if (iv) {
              keystream = this._keystream = iv.slice(0);
              this._iv = void 0;
            }
            cipher.encryptBlock(keystream, 0);
            for (var i = 0; i < blockSize; i++) {
              words[offset + i] ^= keystream[i];
            }
          }
        });
        OFB.Decryptor = Encryptor;
        return OFB;
      })();
      return CryptoJS.mode.OFB;
    });
  }
});

// node_modules/crypto-js/mode-ecb.js
var require_mode_ecb = __commonJS({
  "node_modules/crypto-js/mode-ecb.js"(exports2, module2) {
    (function(root, factory, undef) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core(), require_cipher_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core", "./cipher-core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      CryptoJS.mode.ECB = (function() {
        var ECB = CryptoJS.lib.BlockCipherMode.extend();
        ECB.Encryptor = ECB.extend({
          processBlock: function(words, offset) {
            this._cipher.encryptBlock(words, offset);
          }
        });
        ECB.Decryptor = ECB.extend({
          processBlock: function(words, offset) {
            this._cipher.decryptBlock(words, offset);
          }
        });
        return ECB;
      })();
      return CryptoJS.mode.ECB;
    });
  }
});

// node_modules/crypto-js/pad-ansix923.js
var require_pad_ansix923 = __commonJS({
  "node_modules/crypto-js/pad-ansix923.js"(exports2, module2) {
    (function(root, factory, undef) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core(), require_cipher_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core", "./cipher-core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      CryptoJS.pad.AnsiX923 = {
        pad: function(data, blockSize) {
          var dataSigBytes = data.sigBytes;
          var blockSizeBytes = blockSize * 4;
          var nPaddingBytes = blockSizeBytes - dataSigBytes % blockSizeBytes;
          var lastBytePos = dataSigBytes + nPaddingBytes - 1;
          data.clamp();
          data.words[lastBytePos >>> 2] |= nPaddingBytes << 24 - lastBytePos % 4 * 8;
          data.sigBytes += nPaddingBytes;
        },
        unpad: function(data) {
          var nPaddingBytes = data.words[data.sigBytes - 1 >>> 2] & 255;
          data.sigBytes -= nPaddingBytes;
        }
      };
      return CryptoJS.pad.Ansix923;
    });
  }
});

// node_modules/crypto-js/pad-iso10126.js
var require_pad_iso10126 = __commonJS({
  "node_modules/crypto-js/pad-iso10126.js"(exports2, module2) {
    (function(root, factory, undef) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core(), require_cipher_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core", "./cipher-core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      CryptoJS.pad.Iso10126 = {
        pad: function(data, blockSize) {
          var blockSizeBytes = blockSize * 4;
          var nPaddingBytes = blockSizeBytes - data.sigBytes % blockSizeBytes;
          data.concat(CryptoJS.lib.WordArray.random(nPaddingBytes - 1)).concat(CryptoJS.lib.WordArray.create([nPaddingBytes << 24], 1));
        },
        unpad: function(data) {
          var nPaddingBytes = data.words[data.sigBytes - 1 >>> 2] & 255;
          data.sigBytes -= nPaddingBytes;
        }
      };
      return CryptoJS.pad.Iso10126;
    });
  }
});

// node_modules/crypto-js/pad-iso97971.js
var require_pad_iso97971 = __commonJS({
  "node_modules/crypto-js/pad-iso97971.js"(exports2, module2) {
    (function(root, factory, undef) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core(), require_cipher_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core", "./cipher-core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      CryptoJS.pad.Iso97971 = {
        pad: function(data, blockSize) {
          data.concat(CryptoJS.lib.WordArray.create([2147483648], 1));
          CryptoJS.pad.ZeroPadding.pad(data, blockSize);
        },
        unpad: function(data) {
          CryptoJS.pad.ZeroPadding.unpad(data);
          data.sigBytes--;
        }
      };
      return CryptoJS.pad.Iso97971;
    });
  }
});

// node_modules/crypto-js/pad-zeropadding.js
var require_pad_zeropadding = __commonJS({
  "node_modules/crypto-js/pad-zeropadding.js"(exports2, module2) {
    (function(root, factory, undef) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core(), require_cipher_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core", "./cipher-core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      CryptoJS.pad.ZeroPadding = {
        pad: function(data, blockSize) {
          var blockSizeBytes = blockSize * 4;
          data.clamp();
          data.sigBytes += blockSizeBytes - (data.sigBytes % blockSizeBytes || blockSizeBytes);
        },
        unpad: function(data) {
          var dataWords = data.words;
          var i = data.sigBytes - 1;
          for (var i = data.sigBytes - 1; i >= 0; i--) {
            if (dataWords[i >>> 2] >>> 24 - i % 4 * 8 & 255) {
              data.sigBytes = i + 1;
              break;
            }
          }
        }
      };
      return CryptoJS.pad.ZeroPadding;
    });
  }
});

// node_modules/crypto-js/pad-nopadding.js
var require_pad_nopadding = __commonJS({
  "node_modules/crypto-js/pad-nopadding.js"(exports2, module2) {
    (function(root, factory, undef) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core(), require_cipher_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core", "./cipher-core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      CryptoJS.pad.NoPadding = {
        pad: function() {
        },
        unpad: function() {
        }
      };
      return CryptoJS.pad.NoPadding;
    });
  }
});

// node_modules/crypto-js/format-hex.js
var require_format_hex = __commonJS({
  "node_modules/crypto-js/format-hex.js"(exports2, module2) {
    (function(root, factory, undef) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core(), require_cipher_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core", "./cipher-core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      (function(undefined2) {
        var C = CryptoJS;
        var C_lib = C.lib;
        var CipherParams = C_lib.CipherParams;
        var C_enc = C.enc;
        var Hex = C_enc.Hex;
        var C_format = C.format;
        var HexFormatter = C_format.Hex = {
          /**
           * Converts the ciphertext of a cipher params object to a hexadecimally encoded string.
           *
           * @param {CipherParams} cipherParams The cipher params object.
           *
           * @return {string} The hexadecimally encoded string.
           *
           * @static
           *
           * @example
           *
           *     var hexString = CryptoJS.format.Hex.stringify(cipherParams);
           */
          stringify: function(cipherParams) {
            return cipherParams.ciphertext.toString(Hex);
          },
          /**
           * Converts a hexadecimally encoded ciphertext string to a cipher params object.
           *
           * @param {string} input The hexadecimally encoded string.
           *
           * @return {CipherParams} The cipher params object.
           *
           * @static
           *
           * @example
           *
           *     var cipherParams = CryptoJS.format.Hex.parse(hexString);
           */
          parse: function(input) {
            var ciphertext = Hex.parse(input);
            return CipherParams.create({ ciphertext });
          }
        };
      })();
      return CryptoJS.format.Hex;
    });
  }
});

// node_modules/crypto-js/aes.js
var require_aes = __commonJS({
  "node_modules/crypto-js/aes.js"(exports2, module2) {
    (function(root, factory, undef) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core(), require_enc_base64(), require_md5(), require_evpkdf(), require_cipher_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core", "./enc-base64", "./md5", "./evpkdf", "./cipher-core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      (function() {
        var C = CryptoJS;
        var C_lib = C.lib;
        var BlockCipher = C_lib.BlockCipher;
        var C_algo = C.algo;
        var SBOX = [];
        var INV_SBOX = [];
        var SUB_MIX_0 = [];
        var SUB_MIX_1 = [];
        var SUB_MIX_2 = [];
        var SUB_MIX_3 = [];
        var INV_SUB_MIX_0 = [];
        var INV_SUB_MIX_1 = [];
        var INV_SUB_MIX_2 = [];
        var INV_SUB_MIX_3 = [];
        (function() {
          var d = [];
          for (var i = 0; i < 256; i++) {
            if (i < 128) {
              d[i] = i << 1;
            } else {
              d[i] = i << 1 ^ 283;
            }
          }
          var x = 0;
          var xi = 0;
          for (var i = 0; i < 256; i++) {
            var sx = xi ^ xi << 1 ^ xi << 2 ^ xi << 3 ^ xi << 4;
            sx = sx >>> 8 ^ sx & 255 ^ 99;
            SBOX[x] = sx;
            INV_SBOX[sx] = x;
            var x2 = d[x];
            var x4 = d[x2];
            var x8 = d[x4];
            var t = d[sx] * 257 ^ sx * 16843008;
            SUB_MIX_0[x] = t << 24 | t >>> 8;
            SUB_MIX_1[x] = t << 16 | t >>> 16;
            SUB_MIX_2[x] = t << 8 | t >>> 24;
            SUB_MIX_3[x] = t;
            var t = x8 * 16843009 ^ x4 * 65537 ^ x2 * 257 ^ x * 16843008;
            INV_SUB_MIX_0[sx] = t << 24 | t >>> 8;
            INV_SUB_MIX_1[sx] = t << 16 | t >>> 16;
            INV_SUB_MIX_2[sx] = t << 8 | t >>> 24;
            INV_SUB_MIX_3[sx] = t;
            if (!x) {
              x = xi = 1;
            } else {
              x = x2 ^ d[d[d[x8 ^ x2]]];
              xi ^= d[d[xi]];
            }
          }
        })();
        var RCON = [0, 1, 2, 4, 8, 16, 32, 64, 128, 27, 54];
        var AES = C_algo.AES = BlockCipher.extend({
          _doReset: function() {
            var t;
            if (this._nRounds && this._keyPriorReset === this._key) {
              return;
            }
            var key = this._keyPriorReset = this._key;
            var keyWords = key.words;
            var keySize = key.sigBytes / 4;
            var nRounds = this._nRounds = keySize + 6;
            var ksRows = (nRounds + 1) * 4;
            var keySchedule = this._keySchedule = [];
            for (var ksRow = 0; ksRow < ksRows; ksRow++) {
              if (ksRow < keySize) {
                keySchedule[ksRow] = keyWords[ksRow];
              } else {
                t = keySchedule[ksRow - 1];
                if (!(ksRow % keySize)) {
                  t = t << 8 | t >>> 24;
                  t = SBOX[t >>> 24] << 24 | SBOX[t >>> 16 & 255] << 16 | SBOX[t >>> 8 & 255] << 8 | SBOX[t & 255];
                  t ^= RCON[ksRow / keySize | 0] << 24;
                } else if (keySize > 6 && ksRow % keySize == 4) {
                  t = SBOX[t >>> 24] << 24 | SBOX[t >>> 16 & 255] << 16 | SBOX[t >>> 8 & 255] << 8 | SBOX[t & 255];
                }
                keySchedule[ksRow] = keySchedule[ksRow - keySize] ^ t;
              }
            }
            var invKeySchedule = this._invKeySchedule = [];
            for (var invKsRow = 0; invKsRow < ksRows; invKsRow++) {
              var ksRow = ksRows - invKsRow;
              if (invKsRow % 4) {
                var t = keySchedule[ksRow];
              } else {
                var t = keySchedule[ksRow - 4];
              }
              if (invKsRow < 4 || ksRow <= 4) {
                invKeySchedule[invKsRow] = t;
              } else {
                invKeySchedule[invKsRow] = INV_SUB_MIX_0[SBOX[t >>> 24]] ^ INV_SUB_MIX_1[SBOX[t >>> 16 & 255]] ^ INV_SUB_MIX_2[SBOX[t >>> 8 & 255]] ^ INV_SUB_MIX_3[SBOX[t & 255]];
              }
            }
          },
          encryptBlock: function(M, offset) {
            this._doCryptBlock(M, offset, this._keySchedule, SUB_MIX_0, SUB_MIX_1, SUB_MIX_2, SUB_MIX_3, SBOX);
          },
          decryptBlock: function(M, offset) {
            var t = M[offset + 1];
            M[offset + 1] = M[offset + 3];
            M[offset + 3] = t;
            this._doCryptBlock(M, offset, this._invKeySchedule, INV_SUB_MIX_0, INV_SUB_MIX_1, INV_SUB_MIX_2, INV_SUB_MIX_3, INV_SBOX);
            var t = M[offset + 1];
            M[offset + 1] = M[offset + 3];
            M[offset + 3] = t;
          },
          _doCryptBlock: function(M, offset, keySchedule, SUB_MIX_02, SUB_MIX_12, SUB_MIX_22, SUB_MIX_32, SBOX2) {
            var nRounds = this._nRounds;
            var s0 = M[offset] ^ keySchedule[0];
            var s1 = M[offset + 1] ^ keySchedule[1];
            var s2 = M[offset + 2] ^ keySchedule[2];
            var s3 = M[offset + 3] ^ keySchedule[3];
            var ksRow = 4;
            for (var round = 1; round < nRounds; round++) {
              var t0 = SUB_MIX_02[s0 >>> 24] ^ SUB_MIX_12[s1 >>> 16 & 255] ^ SUB_MIX_22[s2 >>> 8 & 255] ^ SUB_MIX_32[s3 & 255] ^ keySchedule[ksRow++];
              var t1 = SUB_MIX_02[s1 >>> 24] ^ SUB_MIX_12[s2 >>> 16 & 255] ^ SUB_MIX_22[s3 >>> 8 & 255] ^ SUB_MIX_32[s0 & 255] ^ keySchedule[ksRow++];
              var t2 = SUB_MIX_02[s2 >>> 24] ^ SUB_MIX_12[s3 >>> 16 & 255] ^ SUB_MIX_22[s0 >>> 8 & 255] ^ SUB_MIX_32[s1 & 255] ^ keySchedule[ksRow++];
              var t3 = SUB_MIX_02[s3 >>> 24] ^ SUB_MIX_12[s0 >>> 16 & 255] ^ SUB_MIX_22[s1 >>> 8 & 255] ^ SUB_MIX_32[s2 & 255] ^ keySchedule[ksRow++];
              s0 = t0;
              s1 = t1;
              s2 = t2;
              s3 = t3;
            }
            var t0 = (SBOX2[s0 >>> 24] << 24 | SBOX2[s1 >>> 16 & 255] << 16 | SBOX2[s2 >>> 8 & 255] << 8 | SBOX2[s3 & 255]) ^ keySchedule[ksRow++];
            var t1 = (SBOX2[s1 >>> 24] << 24 | SBOX2[s2 >>> 16 & 255] << 16 | SBOX2[s3 >>> 8 & 255] << 8 | SBOX2[s0 & 255]) ^ keySchedule[ksRow++];
            var t2 = (SBOX2[s2 >>> 24] << 24 | SBOX2[s3 >>> 16 & 255] << 16 | SBOX2[s0 >>> 8 & 255] << 8 | SBOX2[s1 & 255]) ^ keySchedule[ksRow++];
            var t3 = (SBOX2[s3 >>> 24] << 24 | SBOX2[s0 >>> 16 & 255] << 16 | SBOX2[s1 >>> 8 & 255] << 8 | SBOX2[s2 & 255]) ^ keySchedule[ksRow++];
            M[offset] = t0;
            M[offset + 1] = t1;
            M[offset + 2] = t2;
            M[offset + 3] = t3;
          },
          keySize: 256 / 32
        });
        C.AES = BlockCipher._createHelper(AES);
      })();
      return CryptoJS.AES;
    });
  }
});

// node_modules/crypto-js/tripledes.js
var require_tripledes = __commonJS({
  "node_modules/crypto-js/tripledes.js"(exports2, module2) {
    (function(root, factory, undef) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core(), require_enc_base64(), require_md5(), require_evpkdf(), require_cipher_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core", "./enc-base64", "./md5", "./evpkdf", "./cipher-core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      (function() {
        var C = CryptoJS;
        var C_lib = C.lib;
        var WordArray = C_lib.WordArray;
        var BlockCipher = C_lib.BlockCipher;
        var C_algo = C.algo;
        var PC1 = [
          57,
          49,
          41,
          33,
          25,
          17,
          9,
          1,
          58,
          50,
          42,
          34,
          26,
          18,
          10,
          2,
          59,
          51,
          43,
          35,
          27,
          19,
          11,
          3,
          60,
          52,
          44,
          36,
          63,
          55,
          47,
          39,
          31,
          23,
          15,
          7,
          62,
          54,
          46,
          38,
          30,
          22,
          14,
          6,
          61,
          53,
          45,
          37,
          29,
          21,
          13,
          5,
          28,
          20,
          12,
          4
        ];
        var PC2 = [
          14,
          17,
          11,
          24,
          1,
          5,
          3,
          28,
          15,
          6,
          21,
          10,
          23,
          19,
          12,
          4,
          26,
          8,
          16,
          7,
          27,
          20,
          13,
          2,
          41,
          52,
          31,
          37,
          47,
          55,
          30,
          40,
          51,
          45,
          33,
          48,
          44,
          49,
          39,
          56,
          34,
          53,
          46,
          42,
          50,
          36,
          29,
          32
        ];
        var BIT_SHIFTS = [1, 2, 4, 6, 8, 10, 12, 14, 15, 17, 19, 21, 23, 25, 27, 28];
        var SBOX_P = [
          {
            0: 8421888,
            268435456: 32768,
            536870912: 8421378,
            805306368: 2,
            1073741824: 512,
            1342177280: 8421890,
            1610612736: 8389122,
            1879048192: 8388608,
            2147483648: 514,
            2415919104: 8389120,
            2684354560: 33280,
            2952790016: 8421376,
            3221225472: 32770,
            3489660928: 8388610,
            3758096384: 0,
            4026531840: 33282,
            134217728: 0,
            402653184: 8421890,
            671088640: 33282,
            939524096: 32768,
            1207959552: 8421888,
            1476395008: 512,
            1744830464: 8421378,
            2013265920: 2,
            2281701376: 8389120,
            2550136832: 33280,
            2818572288: 8421376,
            3087007744: 8389122,
            3355443200: 8388610,
            3623878656: 32770,
            3892314112: 514,
            4160749568: 8388608,
            1: 32768,
            268435457: 2,
            536870913: 8421888,
            805306369: 8388608,
            1073741825: 8421378,
            1342177281: 33280,
            1610612737: 512,
            1879048193: 8389122,
            2147483649: 8421890,
            2415919105: 8421376,
            2684354561: 8388610,
            2952790017: 33282,
            3221225473: 514,
            3489660929: 8389120,
            3758096385: 32770,
            4026531841: 0,
            134217729: 8421890,
            402653185: 8421376,
            671088641: 8388608,
            939524097: 512,
            1207959553: 32768,
            1476395009: 8388610,
            1744830465: 2,
            2013265921: 33282,
            2281701377: 32770,
            2550136833: 8389122,
            2818572289: 514,
            3087007745: 8421888,
            3355443201: 8389120,
            3623878657: 0,
            3892314113: 33280,
            4160749569: 8421378
          },
          {
            0: 1074282512,
            16777216: 16384,
            33554432: 524288,
            50331648: 1074266128,
            67108864: 1073741840,
            83886080: 1074282496,
            100663296: 1073758208,
            117440512: 16,
            134217728: 540672,
            150994944: 1073758224,
            167772160: 1073741824,
            184549376: 540688,
            201326592: 524304,
            218103808: 0,
            234881024: 16400,
            251658240: 1074266112,
            8388608: 1073758208,
            25165824: 540688,
            41943040: 16,
            58720256: 1073758224,
            75497472: 1074282512,
            92274688: 1073741824,
            109051904: 524288,
            125829120: 1074266128,
            142606336: 524304,
            159383552: 0,
            176160768: 16384,
            192937984: 1074266112,
            209715200: 1073741840,
            226492416: 540672,
            243269632: 1074282496,
            260046848: 16400,
            268435456: 0,
            285212672: 1074266128,
            301989888: 1073758224,
            318767104: 1074282496,
            335544320: 1074266112,
            352321536: 16,
            369098752: 540688,
            385875968: 16384,
            402653184: 16400,
            419430400: 524288,
            436207616: 524304,
            452984832: 1073741840,
            469762048: 540672,
            486539264: 1073758208,
            503316480: 1073741824,
            520093696: 1074282512,
            276824064: 540688,
            293601280: 524288,
            310378496: 1074266112,
            327155712: 16384,
            343932928: 1073758208,
            360710144: 1074282512,
            377487360: 16,
            394264576: 1073741824,
            411041792: 1074282496,
            427819008: 1073741840,
            444596224: 1073758224,
            461373440: 524304,
            478150656: 0,
            494927872: 16400,
            511705088: 1074266128,
            528482304: 540672
          },
          {
            0: 260,
            1048576: 0,
            2097152: 67109120,
            3145728: 65796,
            4194304: 65540,
            5242880: 67108868,
            6291456: 67174660,
            7340032: 67174400,
            8388608: 67108864,
            9437184: 67174656,
            10485760: 65792,
            11534336: 67174404,
            12582912: 67109124,
            13631488: 65536,
            14680064: 4,
            15728640: 256,
            524288: 67174656,
            1572864: 67174404,
            2621440: 0,
            3670016: 67109120,
            4718592: 67108868,
            5767168: 65536,
            6815744: 65540,
            7864320: 260,
            8912896: 4,
            9961472: 256,
            11010048: 67174400,
            12058624: 65796,
            13107200: 65792,
            14155776: 67109124,
            15204352: 67174660,
            16252928: 67108864,
            16777216: 67174656,
            17825792: 65540,
            18874368: 65536,
            19922944: 67109120,
            20971520: 256,
            22020096: 67174660,
            23068672: 67108868,
            24117248: 0,
            25165824: 67109124,
            26214400: 67108864,
            27262976: 4,
            28311552: 65792,
            29360128: 67174400,
            30408704: 260,
            31457280: 65796,
            32505856: 67174404,
            17301504: 67108864,
            18350080: 260,
            19398656: 67174656,
            20447232: 0,
            21495808: 65540,
            22544384: 67109120,
            23592960: 256,
            24641536: 67174404,
            25690112: 65536,
            26738688: 67174660,
            27787264: 65796,
            28835840: 67108868,
            29884416: 67109124,
            30932992: 67174400,
            31981568: 4,
            33030144: 65792
          },
          {
            0: 2151682048,
            65536: 2147487808,
            131072: 4198464,
            196608: 2151677952,
            262144: 0,
            327680: 4198400,
            393216: 2147483712,
            458752: 4194368,
            524288: 2147483648,
            589824: 4194304,
            655360: 64,
            720896: 2147487744,
            786432: 2151678016,
            851968: 4160,
            917504: 4096,
            983040: 2151682112,
            32768: 2147487808,
            98304: 64,
            163840: 2151678016,
            229376: 2147487744,
            294912: 4198400,
            360448: 2151682112,
            425984: 0,
            491520: 2151677952,
            557056: 4096,
            622592: 2151682048,
            688128: 4194304,
            753664: 4160,
            819200: 2147483648,
            884736: 4194368,
            950272: 4198464,
            1015808: 2147483712,
            1048576: 4194368,
            1114112: 4198400,
            1179648: 2147483712,
            1245184: 0,
            1310720: 4160,
            1376256: 2151678016,
            1441792: 2151682048,
            1507328: 2147487808,
            1572864: 2151682112,
            1638400: 2147483648,
            1703936: 2151677952,
            1769472: 4198464,
            1835008: 2147487744,
            1900544: 4194304,
            1966080: 64,
            2031616: 4096,
            1081344: 2151677952,
            1146880: 2151682112,
            1212416: 0,
            1277952: 4198400,
            1343488: 4194368,
            1409024: 2147483648,
            1474560: 2147487808,
            1540096: 64,
            1605632: 2147483712,
            1671168: 4096,
            1736704: 2147487744,
            1802240: 2151678016,
            1867776: 4160,
            1933312: 2151682048,
            1998848: 4194304,
            2064384: 4198464
          },
          {
            0: 128,
            4096: 17039360,
            8192: 262144,
            12288: 536870912,
            16384: 537133184,
            20480: 16777344,
            24576: 553648256,
            28672: 262272,
            32768: 16777216,
            36864: 537133056,
            40960: 536871040,
            45056: 553910400,
            49152: 553910272,
            53248: 0,
            57344: 17039488,
            61440: 553648128,
            2048: 17039488,
            6144: 553648256,
            10240: 128,
            14336: 17039360,
            18432: 262144,
            22528: 537133184,
            26624: 553910272,
            30720: 536870912,
            34816: 537133056,
            38912: 0,
            43008: 553910400,
            47104: 16777344,
            51200: 536871040,
            55296: 553648128,
            59392: 16777216,
            63488: 262272,
            65536: 262144,
            69632: 128,
            73728: 536870912,
            77824: 553648256,
            81920: 16777344,
            86016: 553910272,
            90112: 537133184,
            94208: 16777216,
            98304: 553910400,
            102400: 553648128,
            106496: 17039360,
            110592: 537133056,
            114688: 262272,
            118784: 536871040,
            122880: 0,
            126976: 17039488,
            67584: 553648256,
            71680: 16777216,
            75776: 17039360,
            79872: 537133184,
            83968: 536870912,
            88064: 17039488,
            92160: 128,
            96256: 553910272,
            100352: 262272,
            104448: 553910400,
            108544: 0,
            112640: 553648128,
            116736: 16777344,
            120832: 262144,
            124928: 537133056,
            129024: 536871040
          },
          {
            0: 268435464,
            256: 8192,
            512: 270532608,
            768: 270540808,
            1024: 268443648,
            1280: 2097152,
            1536: 2097160,
            1792: 268435456,
            2048: 0,
            2304: 268443656,
            2560: 2105344,
            2816: 8,
            3072: 270532616,
            3328: 2105352,
            3584: 8200,
            3840: 270540800,
            128: 270532608,
            384: 270540808,
            640: 8,
            896: 2097152,
            1152: 2105352,
            1408: 268435464,
            1664: 268443648,
            1920: 8200,
            2176: 2097160,
            2432: 8192,
            2688: 268443656,
            2944: 270532616,
            3200: 0,
            3456: 270540800,
            3712: 2105344,
            3968: 268435456,
            4096: 268443648,
            4352: 270532616,
            4608: 270540808,
            4864: 8200,
            5120: 2097152,
            5376: 268435456,
            5632: 268435464,
            5888: 2105344,
            6144: 2105352,
            6400: 0,
            6656: 8,
            6912: 270532608,
            7168: 8192,
            7424: 268443656,
            7680: 270540800,
            7936: 2097160,
            4224: 8,
            4480: 2105344,
            4736: 2097152,
            4992: 268435464,
            5248: 268443648,
            5504: 8200,
            5760: 270540808,
            6016: 270532608,
            6272: 270540800,
            6528: 270532616,
            6784: 8192,
            7040: 2105352,
            7296: 2097160,
            7552: 0,
            7808: 268435456,
            8064: 268443656
          },
          {
            0: 1048576,
            16: 33555457,
            32: 1024,
            48: 1049601,
            64: 34604033,
            80: 0,
            96: 1,
            112: 34603009,
            128: 33555456,
            144: 1048577,
            160: 33554433,
            176: 34604032,
            192: 34603008,
            208: 1025,
            224: 1049600,
            240: 33554432,
            8: 34603009,
            24: 0,
            40: 33555457,
            56: 34604032,
            72: 1048576,
            88: 33554433,
            104: 33554432,
            120: 1025,
            136: 1049601,
            152: 33555456,
            168: 34603008,
            184: 1048577,
            200: 1024,
            216: 34604033,
            232: 1,
            248: 1049600,
            256: 33554432,
            272: 1048576,
            288: 33555457,
            304: 34603009,
            320: 1048577,
            336: 33555456,
            352: 34604032,
            368: 1049601,
            384: 1025,
            400: 34604033,
            416: 1049600,
            432: 1,
            448: 0,
            464: 34603008,
            480: 33554433,
            496: 1024,
            264: 1049600,
            280: 33555457,
            296: 34603009,
            312: 1,
            328: 33554432,
            344: 1048576,
            360: 1025,
            376: 34604032,
            392: 33554433,
            408: 34603008,
            424: 0,
            440: 34604033,
            456: 1049601,
            472: 1024,
            488: 33555456,
            504: 1048577
          },
          {
            0: 134219808,
            1: 131072,
            2: 134217728,
            3: 32,
            4: 131104,
            5: 134350880,
            6: 134350848,
            7: 2048,
            8: 134348800,
            9: 134219776,
            10: 133120,
            11: 134348832,
            12: 2080,
            13: 0,
            14: 134217760,
            15: 133152,
            2147483648: 2048,
            2147483649: 134350880,
            2147483650: 134219808,
            2147483651: 134217728,
            2147483652: 134348800,
            2147483653: 133120,
            2147483654: 133152,
            2147483655: 32,
            2147483656: 134217760,
            2147483657: 2080,
            2147483658: 131104,
            2147483659: 134350848,
            2147483660: 0,
            2147483661: 134348832,
            2147483662: 134219776,
            2147483663: 131072,
            16: 133152,
            17: 134350848,
            18: 32,
            19: 2048,
            20: 134219776,
            21: 134217760,
            22: 134348832,
            23: 131072,
            24: 0,
            25: 131104,
            26: 134348800,
            27: 134219808,
            28: 134350880,
            29: 133120,
            30: 2080,
            31: 134217728,
            2147483664: 131072,
            2147483665: 2048,
            2147483666: 134348832,
            2147483667: 133152,
            2147483668: 32,
            2147483669: 134348800,
            2147483670: 134217728,
            2147483671: 134219808,
            2147483672: 134350880,
            2147483673: 134217760,
            2147483674: 134219776,
            2147483675: 0,
            2147483676: 133120,
            2147483677: 2080,
            2147483678: 131104,
            2147483679: 134350848
          }
        ];
        var SBOX_MASK = [
          4160749569,
          528482304,
          33030144,
          2064384,
          129024,
          8064,
          504,
          2147483679
        ];
        var DES = C_algo.DES = BlockCipher.extend({
          _doReset: function() {
            var key = this._key;
            var keyWords = key.words;
            var keyBits = [];
            for (var i = 0; i < 56; i++) {
              var keyBitPos = PC1[i] - 1;
              keyBits[i] = keyWords[keyBitPos >>> 5] >>> 31 - keyBitPos % 32 & 1;
            }
            var subKeys = this._subKeys = [];
            for (var nSubKey = 0; nSubKey < 16; nSubKey++) {
              var subKey = subKeys[nSubKey] = [];
              var bitShift = BIT_SHIFTS[nSubKey];
              for (var i = 0; i < 24; i++) {
                subKey[i / 6 | 0] |= keyBits[(PC2[i] - 1 + bitShift) % 28] << 31 - i % 6;
                subKey[4 + (i / 6 | 0)] |= keyBits[28 + (PC2[i + 24] - 1 + bitShift) % 28] << 31 - i % 6;
              }
              subKey[0] = subKey[0] << 1 | subKey[0] >>> 31;
              for (var i = 1; i < 7; i++) {
                subKey[i] = subKey[i] >>> (i - 1) * 4 + 3;
              }
              subKey[7] = subKey[7] << 5 | subKey[7] >>> 27;
            }
            var invSubKeys = this._invSubKeys = [];
            for (var i = 0; i < 16; i++) {
              invSubKeys[i] = subKeys[15 - i];
            }
          },
          encryptBlock: function(M, offset) {
            this._doCryptBlock(M, offset, this._subKeys);
          },
          decryptBlock: function(M, offset) {
            this._doCryptBlock(M, offset, this._invSubKeys);
          },
          _doCryptBlock: function(M, offset, subKeys) {
            this._lBlock = M[offset];
            this._rBlock = M[offset + 1];
            exchangeLR.call(this, 4, 252645135);
            exchangeLR.call(this, 16, 65535);
            exchangeRL.call(this, 2, 858993459);
            exchangeRL.call(this, 8, 16711935);
            exchangeLR.call(this, 1, 1431655765);
            for (var round = 0; round < 16; round++) {
              var subKey = subKeys[round];
              var lBlock = this._lBlock;
              var rBlock = this._rBlock;
              var f = 0;
              for (var i = 0; i < 8; i++) {
                f |= SBOX_P[i][((rBlock ^ subKey[i]) & SBOX_MASK[i]) >>> 0];
              }
              this._lBlock = rBlock;
              this._rBlock = lBlock ^ f;
            }
            var t = this._lBlock;
            this._lBlock = this._rBlock;
            this._rBlock = t;
            exchangeLR.call(this, 1, 1431655765);
            exchangeRL.call(this, 8, 16711935);
            exchangeRL.call(this, 2, 858993459);
            exchangeLR.call(this, 16, 65535);
            exchangeLR.call(this, 4, 252645135);
            M[offset] = this._lBlock;
            M[offset + 1] = this._rBlock;
          },
          keySize: 64 / 32,
          ivSize: 64 / 32,
          blockSize: 64 / 32
        });
        function exchangeLR(offset, mask) {
          var t = (this._lBlock >>> offset ^ this._rBlock) & mask;
          this._rBlock ^= t;
          this._lBlock ^= t << offset;
        }
        function exchangeRL(offset, mask) {
          var t = (this._rBlock >>> offset ^ this._lBlock) & mask;
          this._lBlock ^= t;
          this._rBlock ^= t << offset;
        }
        C.DES = BlockCipher._createHelper(DES);
        var TripleDES = C_algo.TripleDES = BlockCipher.extend({
          _doReset: function() {
            var key = this._key;
            var keyWords = key.words;
            if (keyWords.length !== 2 && keyWords.length !== 4 && keyWords.length < 6) {
              throw new Error("Invalid key length - 3DES requires the key length to be 64, 128, 192 or >192.");
            }
            var key1 = keyWords.slice(0, 2);
            var key2 = keyWords.length < 4 ? keyWords.slice(0, 2) : keyWords.slice(2, 4);
            var key3 = keyWords.length < 6 ? keyWords.slice(0, 2) : keyWords.slice(4, 6);
            this._des1 = DES.createEncryptor(WordArray.create(key1));
            this._des2 = DES.createEncryptor(WordArray.create(key2));
            this._des3 = DES.createEncryptor(WordArray.create(key3));
          },
          encryptBlock: function(M, offset) {
            this._des1.encryptBlock(M, offset);
            this._des2.decryptBlock(M, offset);
            this._des3.encryptBlock(M, offset);
          },
          decryptBlock: function(M, offset) {
            this._des3.decryptBlock(M, offset);
            this._des2.encryptBlock(M, offset);
            this._des1.decryptBlock(M, offset);
          },
          keySize: 192 / 32,
          ivSize: 64 / 32,
          blockSize: 64 / 32
        });
        C.TripleDES = BlockCipher._createHelper(TripleDES);
      })();
      return CryptoJS.TripleDES;
    });
  }
});

// node_modules/crypto-js/rc4.js
var require_rc4 = __commonJS({
  "node_modules/crypto-js/rc4.js"(exports2, module2) {
    (function(root, factory, undef) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core(), require_enc_base64(), require_md5(), require_evpkdf(), require_cipher_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core", "./enc-base64", "./md5", "./evpkdf", "./cipher-core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      (function() {
        var C = CryptoJS;
        var C_lib = C.lib;
        var StreamCipher = C_lib.StreamCipher;
        var C_algo = C.algo;
        var RC4 = C_algo.RC4 = StreamCipher.extend({
          _doReset: function() {
            var key = this._key;
            var keyWords = key.words;
            var keySigBytes = key.sigBytes;
            var S = this._S = [];
            for (var i = 0; i < 256; i++) {
              S[i] = i;
            }
            for (var i = 0, j = 0; i < 256; i++) {
              var keyByteIndex = i % keySigBytes;
              var keyByte = keyWords[keyByteIndex >>> 2] >>> 24 - keyByteIndex % 4 * 8 & 255;
              j = (j + S[i] + keyByte) % 256;
              var t = S[i];
              S[i] = S[j];
              S[j] = t;
            }
            this._i = this._j = 0;
          },
          _doProcessBlock: function(M, offset) {
            M[offset] ^= generateKeystreamWord.call(this);
          },
          keySize: 256 / 32,
          ivSize: 0
        });
        function generateKeystreamWord() {
          var S = this._S;
          var i = this._i;
          var j = this._j;
          var keystreamWord = 0;
          for (var n = 0; n < 4; n++) {
            i = (i + 1) % 256;
            j = (j + S[i]) % 256;
            var t = S[i];
            S[i] = S[j];
            S[j] = t;
            keystreamWord |= S[(S[i] + S[j]) % 256] << 24 - n * 8;
          }
          this._i = i;
          this._j = j;
          return keystreamWord;
        }
        C.RC4 = StreamCipher._createHelper(RC4);
        var RC4Drop = C_algo.RC4Drop = RC4.extend({
          /**
           * Configuration options.
           *
           * @property {number} drop The number of keystream words to drop. Default 192
           */
          cfg: RC4.cfg.extend({
            drop: 192
          }),
          _doReset: function() {
            RC4._doReset.call(this);
            for (var i = this.cfg.drop; i > 0; i--) {
              generateKeystreamWord.call(this);
            }
          }
        });
        C.RC4Drop = StreamCipher._createHelper(RC4Drop);
      })();
      return CryptoJS.RC4;
    });
  }
});

// node_modules/crypto-js/rabbit.js
var require_rabbit = __commonJS({
  "node_modules/crypto-js/rabbit.js"(exports2, module2) {
    (function(root, factory, undef) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core(), require_enc_base64(), require_md5(), require_evpkdf(), require_cipher_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core", "./enc-base64", "./md5", "./evpkdf", "./cipher-core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      (function() {
        var C = CryptoJS;
        var C_lib = C.lib;
        var StreamCipher = C_lib.StreamCipher;
        var C_algo = C.algo;
        var S = [];
        var C_ = [];
        var G = [];
        var Rabbit = C_algo.Rabbit = StreamCipher.extend({
          _doReset: function() {
            var K = this._key.words;
            var iv = this.cfg.iv;
            for (var i = 0; i < 4; i++) {
              K[i] = (K[i] << 8 | K[i] >>> 24) & 16711935 | (K[i] << 24 | K[i] >>> 8) & 4278255360;
            }
            var X = this._X = [
              K[0],
              K[3] << 16 | K[2] >>> 16,
              K[1],
              K[0] << 16 | K[3] >>> 16,
              K[2],
              K[1] << 16 | K[0] >>> 16,
              K[3],
              K[2] << 16 | K[1] >>> 16
            ];
            var C2 = this._C = [
              K[2] << 16 | K[2] >>> 16,
              K[0] & 4294901760 | K[1] & 65535,
              K[3] << 16 | K[3] >>> 16,
              K[1] & 4294901760 | K[2] & 65535,
              K[0] << 16 | K[0] >>> 16,
              K[2] & 4294901760 | K[3] & 65535,
              K[1] << 16 | K[1] >>> 16,
              K[3] & 4294901760 | K[0] & 65535
            ];
            this._b = 0;
            for (var i = 0; i < 4; i++) {
              nextState.call(this);
            }
            for (var i = 0; i < 8; i++) {
              C2[i] ^= X[i + 4 & 7];
            }
            if (iv) {
              var IV = iv.words;
              var IV_0 = IV[0];
              var IV_1 = IV[1];
              var i0 = (IV_0 << 8 | IV_0 >>> 24) & 16711935 | (IV_0 << 24 | IV_0 >>> 8) & 4278255360;
              var i2 = (IV_1 << 8 | IV_1 >>> 24) & 16711935 | (IV_1 << 24 | IV_1 >>> 8) & 4278255360;
              var i1 = i0 >>> 16 | i2 & 4294901760;
              var i3 = i2 << 16 | i0 & 65535;
              C2[0] ^= i0;
              C2[1] ^= i1;
              C2[2] ^= i2;
              C2[3] ^= i3;
              C2[4] ^= i0;
              C2[5] ^= i1;
              C2[6] ^= i2;
              C2[7] ^= i3;
              for (var i = 0; i < 4; i++) {
                nextState.call(this);
              }
            }
          },
          _doProcessBlock: function(M, offset) {
            var X = this._X;
            nextState.call(this);
            S[0] = X[0] ^ X[5] >>> 16 ^ X[3] << 16;
            S[1] = X[2] ^ X[7] >>> 16 ^ X[5] << 16;
            S[2] = X[4] ^ X[1] >>> 16 ^ X[7] << 16;
            S[3] = X[6] ^ X[3] >>> 16 ^ X[1] << 16;
            for (var i = 0; i < 4; i++) {
              S[i] = (S[i] << 8 | S[i] >>> 24) & 16711935 | (S[i] << 24 | S[i] >>> 8) & 4278255360;
              M[offset + i] ^= S[i];
            }
          },
          blockSize: 128 / 32,
          ivSize: 64 / 32
        });
        function nextState() {
          var X = this._X;
          var C2 = this._C;
          for (var i = 0; i < 8; i++) {
            C_[i] = C2[i];
          }
          C2[0] = C2[0] + 1295307597 + this._b | 0;
          C2[1] = C2[1] + 3545052371 + (C2[0] >>> 0 < C_[0] >>> 0 ? 1 : 0) | 0;
          C2[2] = C2[2] + 886263092 + (C2[1] >>> 0 < C_[1] >>> 0 ? 1 : 0) | 0;
          C2[3] = C2[3] + 1295307597 + (C2[2] >>> 0 < C_[2] >>> 0 ? 1 : 0) | 0;
          C2[4] = C2[4] + 3545052371 + (C2[3] >>> 0 < C_[3] >>> 0 ? 1 : 0) | 0;
          C2[5] = C2[5] + 886263092 + (C2[4] >>> 0 < C_[4] >>> 0 ? 1 : 0) | 0;
          C2[6] = C2[6] + 1295307597 + (C2[5] >>> 0 < C_[5] >>> 0 ? 1 : 0) | 0;
          C2[7] = C2[7] + 3545052371 + (C2[6] >>> 0 < C_[6] >>> 0 ? 1 : 0) | 0;
          this._b = C2[7] >>> 0 < C_[7] >>> 0 ? 1 : 0;
          for (var i = 0; i < 8; i++) {
            var gx = X[i] + C2[i];
            var ga = gx & 65535;
            var gb = gx >>> 16;
            var gh = ((ga * ga >>> 17) + ga * gb >>> 15) + gb * gb;
            var gl = ((gx & 4294901760) * gx | 0) + ((gx & 65535) * gx | 0);
            G[i] = gh ^ gl;
          }
          X[0] = G[0] + (G[7] << 16 | G[7] >>> 16) + (G[6] << 16 | G[6] >>> 16) | 0;
          X[1] = G[1] + (G[0] << 8 | G[0] >>> 24) + G[7] | 0;
          X[2] = G[2] + (G[1] << 16 | G[1] >>> 16) + (G[0] << 16 | G[0] >>> 16) | 0;
          X[3] = G[3] + (G[2] << 8 | G[2] >>> 24) + G[1] | 0;
          X[4] = G[4] + (G[3] << 16 | G[3] >>> 16) + (G[2] << 16 | G[2] >>> 16) | 0;
          X[5] = G[5] + (G[4] << 8 | G[4] >>> 24) + G[3] | 0;
          X[6] = G[6] + (G[5] << 16 | G[5] >>> 16) + (G[4] << 16 | G[4] >>> 16) | 0;
          X[7] = G[7] + (G[6] << 8 | G[6] >>> 24) + G[5] | 0;
        }
        C.Rabbit = StreamCipher._createHelper(Rabbit);
      })();
      return CryptoJS.Rabbit;
    });
  }
});

// node_modules/crypto-js/rabbit-legacy.js
var require_rabbit_legacy = __commonJS({
  "node_modules/crypto-js/rabbit-legacy.js"(exports2, module2) {
    (function(root, factory, undef) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core(), require_enc_base64(), require_md5(), require_evpkdf(), require_cipher_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core", "./enc-base64", "./md5", "./evpkdf", "./cipher-core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      (function() {
        var C = CryptoJS;
        var C_lib = C.lib;
        var StreamCipher = C_lib.StreamCipher;
        var C_algo = C.algo;
        var S = [];
        var C_ = [];
        var G = [];
        var RabbitLegacy = C_algo.RabbitLegacy = StreamCipher.extend({
          _doReset: function() {
            var K = this._key.words;
            var iv = this.cfg.iv;
            var X = this._X = [
              K[0],
              K[3] << 16 | K[2] >>> 16,
              K[1],
              K[0] << 16 | K[3] >>> 16,
              K[2],
              K[1] << 16 | K[0] >>> 16,
              K[3],
              K[2] << 16 | K[1] >>> 16
            ];
            var C2 = this._C = [
              K[2] << 16 | K[2] >>> 16,
              K[0] & 4294901760 | K[1] & 65535,
              K[3] << 16 | K[3] >>> 16,
              K[1] & 4294901760 | K[2] & 65535,
              K[0] << 16 | K[0] >>> 16,
              K[2] & 4294901760 | K[3] & 65535,
              K[1] << 16 | K[1] >>> 16,
              K[3] & 4294901760 | K[0] & 65535
            ];
            this._b = 0;
            for (var i = 0; i < 4; i++) {
              nextState.call(this);
            }
            for (var i = 0; i < 8; i++) {
              C2[i] ^= X[i + 4 & 7];
            }
            if (iv) {
              var IV = iv.words;
              var IV_0 = IV[0];
              var IV_1 = IV[1];
              var i0 = (IV_0 << 8 | IV_0 >>> 24) & 16711935 | (IV_0 << 24 | IV_0 >>> 8) & 4278255360;
              var i2 = (IV_1 << 8 | IV_1 >>> 24) & 16711935 | (IV_1 << 24 | IV_1 >>> 8) & 4278255360;
              var i1 = i0 >>> 16 | i2 & 4294901760;
              var i3 = i2 << 16 | i0 & 65535;
              C2[0] ^= i0;
              C2[1] ^= i1;
              C2[2] ^= i2;
              C2[3] ^= i3;
              C2[4] ^= i0;
              C2[5] ^= i1;
              C2[6] ^= i2;
              C2[7] ^= i3;
              for (var i = 0; i < 4; i++) {
                nextState.call(this);
              }
            }
          },
          _doProcessBlock: function(M, offset) {
            var X = this._X;
            nextState.call(this);
            S[0] = X[0] ^ X[5] >>> 16 ^ X[3] << 16;
            S[1] = X[2] ^ X[7] >>> 16 ^ X[5] << 16;
            S[2] = X[4] ^ X[1] >>> 16 ^ X[7] << 16;
            S[3] = X[6] ^ X[3] >>> 16 ^ X[1] << 16;
            for (var i = 0; i < 4; i++) {
              S[i] = (S[i] << 8 | S[i] >>> 24) & 16711935 | (S[i] << 24 | S[i] >>> 8) & 4278255360;
              M[offset + i] ^= S[i];
            }
          },
          blockSize: 128 / 32,
          ivSize: 64 / 32
        });
        function nextState() {
          var X = this._X;
          var C2 = this._C;
          for (var i = 0; i < 8; i++) {
            C_[i] = C2[i];
          }
          C2[0] = C2[0] + 1295307597 + this._b | 0;
          C2[1] = C2[1] + 3545052371 + (C2[0] >>> 0 < C_[0] >>> 0 ? 1 : 0) | 0;
          C2[2] = C2[2] + 886263092 + (C2[1] >>> 0 < C_[1] >>> 0 ? 1 : 0) | 0;
          C2[3] = C2[3] + 1295307597 + (C2[2] >>> 0 < C_[2] >>> 0 ? 1 : 0) | 0;
          C2[4] = C2[4] + 3545052371 + (C2[3] >>> 0 < C_[3] >>> 0 ? 1 : 0) | 0;
          C2[5] = C2[5] + 886263092 + (C2[4] >>> 0 < C_[4] >>> 0 ? 1 : 0) | 0;
          C2[6] = C2[6] + 1295307597 + (C2[5] >>> 0 < C_[5] >>> 0 ? 1 : 0) | 0;
          C2[7] = C2[7] + 3545052371 + (C2[6] >>> 0 < C_[6] >>> 0 ? 1 : 0) | 0;
          this._b = C2[7] >>> 0 < C_[7] >>> 0 ? 1 : 0;
          for (var i = 0; i < 8; i++) {
            var gx = X[i] + C2[i];
            var ga = gx & 65535;
            var gb = gx >>> 16;
            var gh = ((ga * ga >>> 17) + ga * gb >>> 15) + gb * gb;
            var gl = ((gx & 4294901760) * gx | 0) + ((gx & 65535) * gx | 0);
            G[i] = gh ^ gl;
          }
          X[0] = G[0] + (G[7] << 16 | G[7] >>> 16) + (G[6] << 16 | G[6] >>> 16) | 0;
          X[1] = G[1] + (G[0] << 8 | G[0] >>> 24) + G[7] | 0;
          X[2] = G[2] + (G[1] << 16 | G[1] >>> 16) + (G[0] << 16 | G[0] >>> 16) | 0;
          X[3] = G[3] + (G[2] << 8 | G[2] >>> 24) + G[1] | 0;
          X[4] = G[4] + (G[3] << 16 | G[3] >>> 16) + (G[2] << 16 | G[2] >>> 16) | 0;
          X[5] = G[5] + (G[4] << 8 | G[4] >>> 24) + G[3] | 0;
          X[6] = G[6] + (G[5] << 16 | G[5] >>> 16) + (G[4] << 16 | G[4] >>> 16) | 0;
          X[7] = G[7] + (G[6] << 8 | G[6] >>> 24) + G[5] | 0;
        }
        C.RabbitLegacy = StreamCipher._createHelper(RabbitLegacy);
      })();
      return CryptoJS.RabbitLegacy;
    });
  }
});

// node_modules/crypto-js/blowfish.js
var require_blowfish = __commonJS({
  "node_modules/crypto-js/blowfish.js"(exports2, module2) {
    (function(root, factory, undef) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core(), require_enc_base64(), require_md5(), require_evpkdf(), require_cipher_core());
      } else if (typeof define === "function" && define.amd) {
        define(["./core", "./enc-base64", "./md5", "./evpkdf", "./cipher-core"], factory);
      } else {
        factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      (function() {
        var C = CryptoJS;
        var C_lib = C.lib;
        var BlockCipher = C_lib.BlockCipher;
        var C_algo = C.algo;
        const N = 16;
        const ORIG_P = [
          608135816,
          2242054355,
          320440878,
          57701188,
          2752067618,
          698298832,
          137296536,
          3964562569,
          1160258022,
          953160567,
          3193202383,
          887688300,
          3232508343,
          3380367581,
          1065670069,
          3041331479,
          2450970073,
          2306472731
        ];
        const ORIG_S = [
          [
            3509652390,
            2564797868,
            805139163,
            3491422135,
            3101798381,
            1780907670,
            3128725573,
            4046225305,
            614570311,
            3012652279,
            134345442,
            2240740374,
            1667834072,
            1901547113,
            2757295779,
            4103290238,
            227898511,
            1921955416,
            1904987480,
            2182433518,
            2069144605,
            3260701109,
            2620446009,
            720527379,
            3318853667,
            677414384,
            3393288472,
            3101374703,
            2390351024,
            1614419982,
            1822297739,
            2954791486,
            3608508353,
            3174124327,
            2024746970,
            1432378464,
            3864339955,
            2857741204,
            1464375394,
            1676153920,
            1439316330,
            715854006,
            3033291828,
            289532110,
            2706671279,
            2087905683,
            3018724369,
            1668267050,
            732546397,
            1947742710,
            3462151702,
            2609353502,
            2950085171,
            1814351708,
            2050118529,
            680887927,
            999245976,
            1800124847,
            3300911131,
            1713906067,
            1641548236,
            4213287313,
            1216130144,
            1575780402,
            4018429277,
            3917837745,
            3693486850,
            3949271944,
            596196993,
            3549867205,
            258830323,
            2213823033,
            772490370,
            2760122372,
            1774776394,
            2652871518,
            566650946,
            4142492826,
            1728879713,
            2882767088,
            1783734482,
            3629395816,
            2517608232,
            2874225571,
            1861159788,
            326777828,
            3124490320,
            2130389656,
            2716951837,
            967770486,
            1724537150,
            2185432712,
            2364442137,
            1164943284,
            2105845187,
            998989502,
            3765401048,
            2244026483,
            1075463327,
            1455516326,
            1322494562,
            910128902,
            469688178,
            1117454909,
            936433444,
            3490320968,
            3675253459,
            1240580251,
            122909385,
            2157517691,
            634681816,
            4142456567,
            3825094682,
            3061402683,
            2540495037,
            79693498,
            3249098678,
            1084186820,
            1583128258,
            426386531,
            1761308591,
            1047286709,
            322548459,
            995290223,
            1845252383,
            2603652396,
            3431023940,
            2942221577,
            3202600964,
            3727903485,
            1712269319,
            422464435,
            3234572375,
            1170764815,
            3523960633,
            3117677531,
            1434042557,
            442511882,
            3600875718,
            1076654713,
            1738483198,
            4213154764,
            2393238008,
            3677496056,
            1014306527,
            4251020053,
            793779912,
            2902807211,
            842905082,
            4246964064,
            1395751752,
            1040244610,
            2656851899,
            3396308128,
            445077038,
            3742853595,
            3577915638,
            679411651,
            2892444358,
            2354009459,
            1767581616,
            3150600392,
            3791627101,
            3102740896,
            284835224,
            4246832056,
            1258075500,
            768725851,
            2589189241,
            3069724005,
            3532540348,
            1274779536,
            3789419226,
            2764799539,
            1660621633,
            3471099624,
            4011903706,
            913787905,
            3497959166,
            737222580,
            2514213453,
            2928710040,
            3937242737,
            1804850592,
            3499020752,
            2949064160,
            2386320175,
            2390070455,
            2415321851,
            4061277028,
            2290661394,
            2416832540,
            1336762016,
            1754252060,
            3520065937,
            3014181293,
            791618072,
            3188594551,
            3933548030,
            2332172193,
            3852520463,
            3043980520,
            413987798,
            3465142937,
            3030929376,
            4245938359,
            2093235073,
            3534596313,
            375366246,
            2157278981,
            2479649556,
            555357303,
            3870105701,
            2008414854,
            3344188149,
            4221384143,
            3956125452,
            2067696032,
            3594591187,
            2921233993,
            2428461,
            544322398,
            577241275,
            1471733935,
            610547355,
            4027169054,
            1432588573,
            1507829418,
            2025931657,
            3646575487,
            545086370,
            48609733,
            2200306550,
            1653985193,
            298326376,
            1316178497,
            3007786442,
            2064951626,
            458293330,
            2589141269,
            3591329599,
            3164325604,
            727753846,
            2179363840,
            146436021,
            1461446943,
            4069977195,
            705550613,
            3059967265,
            3887724982,
            4281599278,
            3313849956,
            1404054877,
            2845806497,
            146425753,
            1854211946
          ],
          [
            1266315497,
            3048417604,
            3681880366,
            3289982499,
            290971e4,
            1235738493,
            2632868024,
            2414719590,
            3970600049,
            1771706367,
            1449415276,
            3266420449,
            422970021,
            1963543593,
            2690192192,
            3826793022,
            1062508698,
            1531092325,
            1804592342,
            2583117782,
            2714934279,
            4024971509,
            1294809318,
            4028980673,
            1289560198,
            2221992742,
            1669523910,
            35572830,
            157838143,
            1052438473,
            1016535060,
            1802137761,
            1753167236,
            1386275462,
            3080475397,
            2857371447,
            1040679964,
            2145300060,
            2390574316,
            1461121720,
            2956646967,
            4031777805,
            4028374788,
            33600511,
            2920084762,
            1018524850,
            629373528,
            3691585981,
            3515945977,
            2091462646,
            2486323059,
            586499841,
            988145025,
            935516892,
            3367335476,
            2599673255,
            2839830854,
            265290510,
            3972581182,
            2759138881,
            3795373465,
            1005194799,
            847297441,
            406762289,
            1314163512,
            1332590856,
            1866599683,
            4127851711,
            750260880,
            613907577,
            1450815602,
            3165620655,
            3734664991,
            3650291728,
            3012275730,
            3704569646,
            1427272223,
            778793252,
            1343938022,
            2676280711,
            2052605720,
            1946737175,
            3164576444,
            3914038668,
            3967478842,
            3682934266,
            1661551462,
            3294938066,
            4011595847,
            840292616,
            3712170807,
            616741398,
            312560963,
            711312465,
            1351876610,
            322626781,
            1910503582,
            271666773,
            2175563734,
            1594956187,
            70604529,
            3617834859,
            1007753275,
            1495573769,
            4069517037,
            2549218298,
            2663038764,
            504708206,
            2263041392,
            3941167025,
            2249088522,
            1514023603,
            1998579484,
            1312622330,
            694541497,
            2582060303,
            2151582166,
            1382467621,
            776784248,
            2618340202,
            3323268794,
            2497899128,
            2784771155,
            503983604,
            4076293799,
            907881277,
            423175695,
            432175456,
            1378068232,
            4145222326,
            3954048622,
            3938656102,
            3820766613,
            2793130115,
            2977904593,
            26017576,
            3274890735,
            3194772133,
            1700274565,
            1756076034,
            4006520079,
            3677328699,
            720338349,
            1533947780,
            354530856,
            688349552,
            3973924725,
            1637815568,
            332179504,
            3949051286,
            53804574,
            2852348879,
            3044236432,
            1282449977,
            3583942155,
            3416972820,
            4006381244,
            1617046695,
            2628476075,
            3002303598,
            1686838959,
            431878346,
            2686675385,
            1700445008,
            1080580658,
            1009431731,
            832498133,
            3223435511,
            2605976345,
            2271191193,
            2516031870,
            1648197032,
            4164389018,
            2548247927,
            300782431,
            375919233,
            238389289,
            3353747414,
            2531188641,
            2019080857,
            1475708069,
            455242339,
            2609103871,
            448939670,
            3451063019,
            1395535956,
            2413381860,
            1841049896,
            1491858159,
            885456874,
            4264095073,
            4001119347,
            1565136089,
            3898914787,
            1108368660,
            540939232,
            1173283510,
            2745871338,
            3681308437,
            4207628240,
            3343053890,
            4016749493,
            1699691293,
            1103962373,
            3625875870,
            2256883143,
            3830138730,
            1031889488,
            3479347698,
            1535977030,
            4236805024,
            3251091107,
            2132092099,
            1774941330,
            1199868427,
            1452454533,
            157007616,
            2904115357,
            342012276,
            595725824,
            1480756522,
            206960106,
            497939518,
            591360097,
            863170706,
            2375253569,
            3596610801,
            1814182875,
            2094937945,
            3421402208,
            1082520231,
            3463918190,
            2785509508,
            435703966,
            3908032597,
            1641649973,
            2842273706,
            3305899714,
            1510255612,
            2148256476,
            2655287854,
            3276092548,
            4258621189,
            236887753,
            3681803219,
            274041037,
            1734335097,
            3815195456,
            3317970021,
            1899903192,
            1026095262,
            4050517792,
            356393447,
            2410691914,
            3873677099,
            3682840055
          ],
          [
            3913112168,
            2491498743,
            4132185628,
            2489919796,
            1091903735,
            1979897079,
            3170134830,
            3567386728,
            3557303409,
            857797738,
            1136121015,
            1342202287,
            507115054,
            2535736646,
            337727348,
            3213592640,
            1301675037,
            2528481711,
            1895095763,
            1721773893,
            3216771564,
            62756741,
            2142006736,
            835421444,
            2531993523,
            1442658625,
            3659876326,
            2882144922,
            676362277,
            1392781812,
            170690266,
            3921047035,
            1759253602,
            3611846912,
            1745797284,
            664899054,
            1329594018,
            3901205900,
            3045908486,
            2062866102,
            2865634940,
            3543621612,
            3464012697,
            1080764994,
            553557557,
            3656615353,
            3996768171,
            991055499,
            499776247,
            1265440854,
            648242737,
            3940784050,
            980351604,
            3713745714,
            1749149687,
            3396870395,
            4211799374,
            3640570775,
            1161844396,
            3125318951,
            1431517754,
            545492359,
            4268468663,
            3499529547,
            1437099964,
            2702547544,
            3433638243,
            2581715763,
            2787789398,
            1060185593,
            1593081372,
            2418618748,
            4260947970,
            69676912,
            2159744348,
            86519011,
            2512459080,
            3838209314,
            1220612927,
            3339683548,
            133810670,
            1090789135,
            1078426020,
            1569222167,
            845107691,
            3583754449,
            4072456591,
            1091646820,
            628848692,
            1613405280,
            3757631651,
            526609435,
            236106946,
            48312990,
            2942717905,
            3402727701,
            1797494240,
            859738849,
            992217954,
            4005476642,
            2243076622,
            3870952857,
            3732016268,
            765654824,
            3490871365,
            2511836413,
            1685915746,
            3888969200,
            1414112111,
            2273134842,
            3281911079,
            4080962846,
            172450625,
            2569994100,
            980381355,
            4109958455,
            2819808352,
            2716589560,
            2568741196,
            3681446669,
            3329971472,
            1835478071,
            660984891,
            3704678404,
            4045999559,
            3422617507,
            3040415634,
            1762651403,
            1719377915,
            3470491036,
            2693910283,
            3642056355,
            3138596744,
            1364962596,
            2073328063,
            1983633131,
            926494387,
            3423689081,
            2150032023,
            4096667949,
            1749200295,
            3328846651,
            309677260,
            2016342300,
            1779581495,
            3079819751,
            111262694,
            1274766160,
            443224088,
            298511866,
            1025883608,
            3806446537,
            1145181785,
            168956806,
            3641502830,
            3584813610,
            1689216846,
            3666258015,
            3200248200,
            1692713982,
            2646376535,
            4042768518,
            1618508792,
            1610833997,
            3523052358,
            4130873264,
            2001055236,
            3610705100,
            2202168115,
            4028541809,
            2961195399,
            1006657119,
            2006996926,
            3186142756,
            1430667929,
            3210227297,
            1314452623,
            4074634658,
            4101304120,
            2273951170,
            1399257539,
            3367210612,
            3027628629,
            1190975929,
            2062231137,
            2333990788,
            2221543033,
            2438960610,
            1181637006,
            548689776,
            2362791313,
            3372408396,
            3104550113,
            3145860560,
            296247880,
            1970579870,
            3078560182,
            3769228297,
            1714227617,
            3291629107,
            3898220290,
            166772364,
            1251581989,
            493813264,
            448347421,
            195405023,
            2709975567,
            677966185,
            3703036547,
            1463355134,
            2715995803,
            1338867538,
            1343315457,
            2802222074,
            2684532164,
            233230375,
            2599980071,
            2000651841,
            3277868038,
            1638401717,
            4028070440,
            3237316320,
            6314154,
            819756386,
            300326615,
            590932579,
            1405279636,
            3267499572,
            3150704214,
            2428286686,
            3959192993,
            3461946742,
            1862657033,
            1266418056,
            963775037,
            2089974820,
            2263052895,
            1917689273,
            448879540,
            3550394620,
            3981727096,
            150775221,
            3627908307,
            1303187396,
            508620638,
            2975983352,
            2726630617,
            1817252668,
            1876281319,
            1457606340,
            908771278,
            3720792119,
            3617206836,
            2455994898,
            1729034894,
            1080033504
          ],
          [
            976866871,
            3556439503,
            2881648439,
            1522871579,
            1555064734,
            1336096578,
            3548522304,
            2579274686,
            3574697629,
            3205460757,
            3593280638,
            3338716283,
            3079412587,
            564236357,
            2993598910,
            1781952180,
            1464380207,
            3163844217,
            3332601554,
            1699332808,
            1393555694,
            1183702653,
            3581086237,
            1288719814,
            691649499,
            2847557200,
            2895455976,
            3193889540,
            2717570544,
            1781354906,
            1676643554,
            2592534050,
            3230253752,
            1126444790,
            2770207658,
            2633158820,
            2210423226,
            2615765581,
            2414155088,
            3127139286,
            673620729,
            2805611233,
            1269405062,
            4015350505,
            3341807571,
            4149409754,
            1057255273,
            2012875353,
            2162469141,
            2276492801,
            2601117357,
            993977747,
            3918593370,
            2654263191,
            753973209,
            36408145,
            2530585658,
            25011837,
            3520020182,
            2088578344,
            530523599,
            2918365339,
            1524020338,
            1518925132,
            3760827505,
            3759777254,
            1202760957,
            3985898139,
            3906192525,
            674977740,
            4174734889,
            2031300136,
            2019492241,
            3983892565,
            4153806404,
            3822280332,
            352677332,
            2297720250,
            60907813,
            90501309,
            3286998549,
            1016092578,
            2535922412,
            2839152426,
            457141659,
            509813237,
            4120667899,
            652014361,
            1966332200,
            2975202805,
            55981186,
            2327461051,
            676427537,
            3255491064,
            2882294119,
            3433927263,
            1307055953,
            942726286,
            933058658,
            2468411793,
            3933900994,
            4215176142,
            1361170020,
            2001714738,
            2830558078,
            3274259782,
            1222529897,
            1679025792,
            2729314320,
            3714953764,
            1770335741,
            151462246,
            3013232138,
            1682292957,
            1483529935,
            471910574,
            1539241949,
            458788160,
            3436315007,
            1807016891,
            3718408830,
            978976581,
            1043663428,
            3165965781,
            1927990952,
            4200891579,
            2372276910,
            3208408903,
            3533431907,
            1412390302,
            2931980059,
            4132332400,
            1947078029,
            3881505623,
            4168226417,
            2941484381,
            1077988104,
            1320477388,
            886195818,
            18198404,
            3786409e3,
            2509781533,
            112762804,
            3463356488,
            1866414978,
            891333506,
            18488651,
            661792760,
            1628790961,
            3885187036,
            3141171499,
            876946877,
            2693282273,
            1372485963,
            791857591,
            2686433993,
            3759982718,
            3167212022,
            3472953795,
            2716379847,
            445679433,
            3561995674,
            3504004811,
            3574258232,
            54117162,
            3331405415,
            2381918588,
            3769707343,
            4154350007,
            1140177722,
            4074052095,
            668550556,
            3214352940,
            367459370,
            261225585,
            2610173221,
            4209349473,
            3468074219,
            3265815641,
            314222801,
            3066103646,
            3808782860,
            282218597,
            3406013506,
            3773591054,
            379116347,
            1285071038,
            846784868,
            2669647154,
            3771962079,
            3550491691,
            2305946142,
            453669953,
            1268987020,
            3317592352,
            3279303384,
            3744833421,
            2610507566,
            3859509063,
            266596637,
            3847019092,
            517658769,
            3462560207,
            3443424879,
            370717030,
            4247526661,
            2224018117,
            4143653529,
            4112773975,
            2788324899,
            2477274417,
            1456262402,
            2901442914,
            1517677493,
            1846949527,
            2295493580,
            3734397586,
            2176403920,
            1280348187,
            1908823572,
            3871786941,
            846861322,
            1172426758,
            3287448474,
            3383383037,
            1655181056,
            3139813346,
            901632758,
            1897031941,
            2986607138,
            3066810236,
            3447102507,
            1393639104,
            373351379,
            950779232,
            625454576,
            3124240540,
            4148612726,
            2007998917,
            544563296,
            2244738638,
            2330496472,
            2058025392,
            1291430526,
            424198748,
            50039436,
            29584100,
            3605783033,
            2429876329,
            2791104160,
            1057563949,
            3255363231,
            3075367218,
            3463963227,
            1469046755,
            985887462
          ]
        ];
        var BLOWFISH_CTX = {
          pbox: [],
          sbox: []
        };
        function F(ctx, x) {
          let a = x >> 24 & 255;
          let b = x >> 16 & 255;
          let c = x >> 8 & 255;
          let d = x & 255;
          let y = ctx.sbox[0][a] + ctx.sbox[1][b];
          y = y ^ ctx.sbox[2][c];
          y = y + ctx.sbox[3][d];
          return y;
        }
        function BlowFish_Encrypt(ctx, left, right) {
          let Xl = left;
          let Xr = right;
          let temp;
          for (let i = 0; i < N; ++i) {
            Xl = Xl ^ ctx.pbox[i];
            Xr = F(ctx, Xl) ^ Xr;
            temp = Xl;
            Xl = Xr;
            Xr = temp;
          }
          temp = Xl;
          Xl = Xr;
          Xr = temp;
          Xr = Xr ^ ctx.pbox[N];
          Xl = Xl ^ ctx.pbox[N + 1];
          return { left: Xl, right: Xr };
        }
        function BlowFish_Decrypt(ctx, left, right) {
          let Xl = left;
          let Xr = right;
          let temp;
          for (let i = N + 1; i > 1; --i) {
            Xl = Xl ^ ctx.pbox[i];
            Xr = F(ctx, Xl) ^ Xr;
            temp = Xl;
            Xl = Xr;
            Xr = temp;
          }
          temp = Xl;
          Xl = Xr;
          Xr = temp;
          Xr = Xr ^ ctx.pbox[1];
          Xl = Xl ^ ctx.pbox[0];
          return { left: Xl, right: Xr };
        }
        function BlowFishInit(ctx, key, keysize) {
          for (let Row = 0; Row < 4; Row++) {
            ctx.sbox[Row] = [];
            for (let Col = 0; Col < 256; Col++) {
              ctx.sbox[Row][Col] = ORIG_S[Row][Col];
            }
          }
          let keyIndex = 0;
          for (let index = 0; index < N + 2; index++) {
            ctx.pbox[index] = ORIG_P[index] ^ key[keyIndex];
            keyIndex++;
            if (keyIndex >= keysize) {
              keyIndex = 0;
            }
          }
          let Data1 = 0;
          let Data2 = 0;
          let res = 0;
          for (let i = 0; i < N + 2; i += 2) {
            res = BlowFish_Encrypt(ctx, Data1, Data2);
            Data1 = res.left;
            Data2 = res.right;
            ctx.pbox[i] = Data1;
            ctx.pbox[i + 1] = Data2;
          }
          for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 256; j += 2) {
              res = BlowFish_Encrypt(ctx, Data1, Data2);
              Data1 = res.left;
              Data2 = res.right;
              ctx.sbox[i][j] = Data1;
              ctx.sbox[i][j + 1] = Data2;
            }
          }
          return true;
        }
        var Blowfish = C_algo.Blowfish = BlockCipher.extend({
          _doReset: function() {
            if (this._keyPriorReset === this._key) {
              return;
            }
            var key = this._keyPriorReset = this._key;
            var keyWords = key.words;
            var keySize = key.sigBytes / 4;
            BlowFishInit(BLOWFISH_CTX, keyWords, keySize);
          },
          encryptBlock: function(M, offset) {
            var res = BlowFish_Encrypt(BLOWFISH_CTX, M[offset], M[offset + 1]);
            M[offset] = res.left;
            M[offset + 1] = res.right;
          },
          decryptBlock: function(M, offset) {
            var res = BlowFish_Decrypt(BLOWFISH_CTX, M[offset], M[offset + 1]);
            M[offset] = res.left;
            M[offset + 1] = res.right;
          },
          blockSize: 64 / 32,
          keySize: 128 / 32,
          ivSize: 64 / 32
        });
        C.Blowfish = BlockCipher._createHelper(Blowfish);
      })();
      return CryptoJS.Blowfish;
    });
  }
});

// node_modules/crypto-js/index.js
var require_crypto_js = __commonJS({
  "node_modules/crypto-js/index.js"(exports2, module2) {
    (function(root, factory, undef) {
      if (typeof exports2 === "object") {
        module2.exports = exports2 = factory(require_core(), require_x64_core(), require_lib_typedarrays(), require_enc_utf16(), require_enc_base64(), require_enc_base64url(), require_md5(), require_sha1(), require_sha256(), require_sha224(), require_sha512(), require_sha384(), require_sha3(), require_ripemd160(), require_hmac(), require_pbkdf2(), require_evpkdf(), require_cipher_core(), require_mode_cfb(), require_mode_ctr(), require_mode_ctr_gladman(), require_mode_ofb(), require_mode_ecb(), require_pad_ansix923(), require_pad_iso10126(), require_pad_iso97971(), require_pad_zeropadding(), require_pad_nopadding(), require_format_hex(), require_aes(), require_tripledes(), require_rc4(), require_rabbit(), require_rabbit_legacy(), require_blowfish());
      } else if (typeof define === "function" && define.amd) {
        define(["./core", "./x64-core", "./lib-typedarrays", "./enc-utf16", "./enc-base64", "./enc-base64url", "./md5", "./sha1", "./sha256", "./sha224", "./sha512", "./sha384", "./sha3", "./ripemd160", "./hmac", "./pbkdf2", "./evpkdf", "./cipher-core", "./mode-cfb", "./mode-ctr", "./mode-ctr-gladman", "./mode-ofb", "./mode-ecb", "./pad-ansix923", "./pad-iso10126", "./pad-iso97971", "./pad-zeropadding", "./pad-nopadding", "./format-hex", "./aes", "./tripledes", "./rc4", "./rabbit", "./rabbit-legacy", "./blowfish"], factory);
      } else {
        root.CryptoJS = factory(root.CryptoJS);
      }
    })(exports2, function(CryptoJS) {
      return CryptoJS;
    });
  }
});

// src/extractors/loadm.js
var require_loadm = __commonJS({
  "src/extractors/loadm.js"(exports2, module2) {
    var CryptoJS = require_crypto_js();
    var { USER_AGENT } = require_common();
    function extractLoadm(playerUrl, referer = "guardoserie.horse") {
      return __async(this, null, function* () {
        try {
          if (!playerUrl.includes("#")) return [];
          const parts = playerUrl.split("#");
          const baseUrl = parts[0];
          const id = parts[1];
          const apiUrl = `${baseUrl}api/v1/video`;
          const key = CryptoJS.enc.Utf8.parse("kiemtienmua911ca");
          const iv = CryptoJS.enc.Utf8.parse("1234567890oiuytr");
          const queryParams = `id=${encodeURIComponent(id)}&w=2560&h=1440&r=${encodeURIComponent(referer)}`;
          const response = yield fetch(`${apiUrl}?${queryParams}`, {
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": baseUrl,
              "X-Requested-With": "XMLHttpRequest"
            }
          });
          if (!response.ok) {
            const errorBody = yield response.text().catch(() => "");
            console.error(`[Loadm] API error: ${response.status} | Body: ${errorBody.substring(0, 100)}`);
            return [];
          }
          const hexData = yield response.text();
          const ciphertext = CryptoJS.enc.Hex.parse(hexData);
          const decrypted = CryptoJS.AES.decrypt(
            { ciphertext },
            key,
            {
              iv,
              mode: CryptoJS.mode.CBC,
              padding: CryptoJS.pad.Pkcs7
            }
          );
          const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8).trim();
          if (!decryptedStr) {
            console.error(`[Loadm] Decryption failed`);
            return [];
          }
          const lastBraceIndex = decryptedStr.lastIndexOf("}");
          const cleanJson = lastBraceIndex !== -1 ? decryptedStr.substring(0, lastBraceIndex + 1) : decryptedStr;
          const data = JSON.parse(cleanJson);
          const streams = [];
          if (data.cf) {
            let streamUrl = data.cf;
            if (streamUrl.includes(".txt")) {
              streamUrl += "#index.m3u8";
            }
            streams.push({
              name: "Loadm (Player 1)",
              url: streamUrl,
              title: data.title || "HLS",
              headers: {
                "Referer": baseUrl
              },
              behaviorHints: {
                proxyHeaders: {
                  request: {
                    "Referer": baseUrl
                  }
                },
                notWebReady: true
              }
            });
          }
          if (data.source) {
            streams.push({
              name: "Loadm (Player 2)",
              url: data.source,
              title: data.title || "M3U8",
              headers: {
                "Referer": baseUrl
              },
              behaviorHints: {
                proxyHeaders: {
                  request: {
                    "Referer": baseUrl
                  }
                },
                notWebReady: true
              }
            });
          }
          return streams;
        } catch (e) {
          console.error(`[Loadm] Extraction error:`, e);
          return [];
        }
      });
    }
    module2.exports = { extractLoadm };
  }
});

// src/extractors/index.js
var require_extractors = __commonJS({
  "src/extractors/index.js"(exports2, module2) {
    var { extractMixDrop } = require_mixdrop();
    var { extractDropLoad } = require_dropload();
    var { extractSuperVideo } = require_supervideo();
    var { extractStreamTape } = require_streamtape();
    var { extractUqload } = require_uqload();
    var { extractUpstream } = require_upstream();
    var { extractVidoza } = require_vidoza();
    var { extractVixCloud } = require_vixcloud();
    var { extractLoadm } = require_loadm();
    var { USER_AGENT, unPack } = require_common();
    module2.exports = {
      extractMixDrop,
      extractDropLoad,
      extractSuperVideo,
      extractStreamTape,
      extractUqload,
      extractUpstream,
      extractVidoza,
      extractVixCloud,
      extractLoadm,
      USER_AGENT,
      unPack
    };
  }
});

// src/fetch_helper.js
var require_fetch_helper = __commonJS({
  "src/fetch_helper.js"(exports2, module2) {
    var FETCH_TIMEOUT = 3e4;
    function fetchWithTimeout(_0) {
      return __async(this, arguments, function* (url, options = {}) {
        if (typeof fetch === "undefined") {
          throw new Error("No fetch implementation found!");
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, options.timeout || FETCH_TIMEOUT);
        try {
          const response = yield fetch(url, __spreadProps(__spreadValues({}, options), {
            signal: controller.signal
          }));
          return response;
        } catch (error) {
          if (error.name === "AbortError") {
            throw new Error(`Request to ${url} timed out after ${options.timeout || FETCH_TIMEOUT}ms`);
          }
          throw error;
        } finally {
          clearTimeout(timeoutId);
        }
      });
    }
    module2.exports = { fetchWithTimeout };
  }
});

// src/tmdb_helper.js
var require_tmdb_helper = __commonJS({
  "src/tmdb_helper.js"(exports2, module2) {
    var TMDB_API_KEY2 = "68e094699525b18a70bab2f86b1fa706";
    var MAPPING_API_URL2 = "https://animemapping.stremio.dpdns.org";
    function resolveTmdbFromKitsu(kitsuId) {
      return __async(this, null, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        try {
          const id = String(kitsuId).replace("kitsu:", "");
          let tmdbId = null;
          let season = null;
          let tmdbSeasonTitle = null;
          let titleHints = [];
          let longSeries = false;
          let episodeMode = null;
          let mappedSeasons = [];
          let seriesSeasonCount = null;
          const applyTopologyHints = (payload) => {
            if (!payload || typeof payload !== "object") return;
            if (typeof payload.longSeries === "boolean") {
              longSeries = payload.longSeries;
            }
            if (payload.episodeMode) {
              const mode = String(payload.episodeMode).trim().toLowerCase();
              if (mode) episodeMode = mode;
            }
            if (Array.isArray(payload.mappedSeasons)) {
              const normalized = payload.mappedSeasons.map((n) => parseInt(n, 10)).filter((n) => Number.isInteger(n) && n > 0);
              if (normalized.length > 0) {
                mappedSeasons = [...new Set(normalized)].sort((a, b) => a - b);
              }
            }
            const parsedSeriesCount = parseInt(payload.seriesSeasonCount, 10);
            if (Number.isInteger(parsedSeriesCount) && parsedSeriesCount > 0) {
              seriesSeasonCount = parsedSeriesCount;
            }
          };
          const withTopologyHints = (basePayload = {}) => __spreadProps(__spreadValues({}, basePayload), {
            longSeries,
            episodeMode,
            mappedSeasons,
            seriesSeasonCount
          });
          if (MAPPING_API_URL2) {
            try {
              const apiResponse = yield fetch(`${MAPPING_API_URL2}/mapping/${id}`);
              if (apiResponse.ok) {
                const apiData = yield apiResponse.json();
                applyTopologyHints(apiData);
                titleHints = Array.isArray(apiData == null ? void 0 : apiData.titleHints) ? apiData.titleHints.map((x) => String(x || "").trim()).filter(Boolean) : [];
                if (isMeaningfulSeasonName2(apiData == null ? void 0 : apiData.seasonName)) {
                  tmdbSeasonTitle = String(apiData.seasonName).trim();
                }
                if (apiData.tmdbId) {
                  if (apiData.season && !tmdbSeasonTitle) {
                    tmdbSeasonTitle = yield getTmdbSeasonTitle(apiData.tmdbId, apiData.season);
                  }
                  console.log(`[TMDB Helper] API Hit (TMDB)! Kitsu ${id} -> TMDB ${apiData.tmdbId}, Season ${apiData.season} (Source: ${apiData.source})`);
                  return withTopologyHints({ tmdbId: apiData.tmdbId, season: apiData.season, tmdbSeasonTitle, titleHints });
                }
                if (apiData.imdbId) {
                  console.log(`[TMDB Helper] API Hit (IMDb)! Kitsu ${id} -> IMDb ${apiData.imdbId}, Season ${apiData.season} (Source: ${apiData.source})`);
                  const findUrl = `https://api.themoviedb.org/3/find/${apiData.imdbId}?api_key=${TMDB_API_KEY2}&external_source=imdb_id`;
                  const findResponse = yield fetch(findUrl);
                  const findData = yield findResponse.json();
                  if (((_a = findData.tv_results) == null ? void 0 : _a.length) > 0) {
                    if (!tmdbSeasonTitle && apiData.season) {
                      tmdbSeasonTitle = yield getTmdbSeasonTitle(findData.tv_results[0].id, apiData.season);
                    }
                    return withTopologyHints({ tmdbId: findData.tv_results[0].id, season: apiData.season, tmdbSeasonTitle, titleHints });
                  } else if (((_b = findData.movie_results) == null ? void 0 : _b.length) > 0) return withTopologyHints({ tmdbId: findData.movie_results[0].id, season: null, tmdbSeasonTitle, titleHints });
                  return withTopologyHints({ tmdbId: apiData.imdbId, season: (_c = apiData.season) != null ? _c : null, tmdbSeasonTitle, titleHints });
                }
              }
            } catch (apiErr) {
              console.warn("[TMDB Helper] Mapping API Error:", apiErr.message);
            }
          }
          const mappingResponse = yield fetch(`https://kitsu.io/api/edge/anime/${id}/mappings`);
          let mappingData = null;
          if (mappingResponse.ok) {
            mappingData = yield mappingResponse.json();
          }
          if (mappingData && mappingData.data) {
            const tvdbMapping = mappingData.data.find((m) => m.attributes.externalSite === "thetvdb");
            if (tvdbMapping) {
              const tvdbId = tvdbMapping.attributes.externalId;
              const findUrl = `https://api.themoviedb.org/3/find/${tvdbId}?api_key=${TMDB_API_KEY2}&external_source=tvdb_id`;
              const findResponse = yield fetch(findUrl);
              const findData = yield findResponse.json();
              if (((_d = findData.tv_results) == null ? void 0 : _d.length) > 0) tmdbId = findData.tv_results[0].id;
              else if (((_e = findData.movie_results) == null ? void 0 : _e.length) > 0) return withTopologyHints({ tmdbId: findData.movie_results[0].id, season: null, tmdbSeasonTitle, titleHints });
            }
            if (!tmdbId) {
              const imdbMapping = mappingData.data.find((m) => m.attributes.externalSite === "imdb");
              if (imdbMapping) {
                const imdbId = imdbMapping.attributes.externalId;
                const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY2}&external_source=imdb_id`;
                const findResponse = yield fetch(findUrl);
                const findData = yield findResponse.json();
                if (((_f = findData.tv_results) == null ? void 0 : _f.length) > 0) tmdbId = findData.tv_results[0].id;
                else if (((_g = findData.movie_results) == null ? void 0 : _g.length) > 0) return withTopologyHints({ tmdbId: findData.movie_results[0].id, season: null, tmdbSeasonTitle, titleHints });
              }
            }
          }
          const detailsResponse = yield fetch(`https://kitsu.io/api/edge/anime/${id}`);
          if (!detailsResponse.ok) return null;
          const detailsData = yield detailsResponse.json();
          if (detailsData && detailsData.data && detailsData.data.attributes) {
            const attributes = detailsData.data.attributes;
            const titlesToTry = /* @__PURE__ */ new Set();
            if (attributes.titles.en) titlesToTry.add(attributes.titles.en);
            if (attributes.titles.en_jp) titlesToTry.add(attributes.titles.en_jp);
            if (attributes.canonicalTitle) titlesToTry.add(attributes.canonicalTitle);
            if (attributes.titles.ja_jp) titlesToTry.add(attributes.titles.ja_jp);
            const titleList = Array.from(titlesToTry);
            const year = attributes.startDate ? attributes.startDate.substring(0, 4) : null;
            const subtype = attributes.subtype;
            if (!tmdbId) {
              const type = subtype === "movie" ? "movie" : "tv";
              for (const title2 of titleList) {
                if (tmdbId) break;
                if (!title2) continue;
                let searchData = { results: [] };
                if (year) {
                  let yearParam = "";
                  if (type === "movie") yearParam = `&primary_release_year=${year}`;
                  else yearParam = `&first_air_date_year=${year}`;
                  const searchUrlYear = `https://api.themoviedb.org/3/find/${title2}?api_key=${TMDB_API_KEY2}${yearParam}`;
                  const searchUrlYearCorrect = `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(title2)}&api_key=${TMDB_API_KEY2}${yearParam}`;
                  const res = yield fetch(searchUrlYearCorrect);
                  const data = yield res.json();
                  if (data.results && data.results.length > 0) {
                    searchData = data;
                  }
                }
                if (!searchData.results || searchData.results.length === 0) {
                  const searchUrl = `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(title2)}&api_key=${TMDB_API_KEY2}`;
                  const searchResponse = yield fetch(searchUrl);
                  searchData = yield searchResponse.json();
                }
                if (searchData.results && searchData.results.length > 0) {
                  if (year) {
                    const match = searchData.results.find((r) => {
                      const date = type === "movie" ? r.release_date : r.first_air_date;
                      return date && date.startsWith(year);
                    });
                    if (match) {
                      tmdbId = match.id;
                    } else {
                      tmdbId = searchData.results[0].id;
                    }
                  } else {
                    tmdbId = searchData.results[0].id;
                  }
                } else if (subtype !== "movie") {
                  const cleanTitle = title2.replace(/\s(\d+)$/, "").replace(/\sSeason\s\d+$/i, "");
                  if (cleanTitle !== title2) {
                    const cleanSearchUrl = `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(cleanTitle)}&api_key=${TMDB_API_KEY2}`;
                    const cleanSearchResponse = yield fetch(cleanSearchUrl);
                    const cleanSearchData = yield cleanSearchResponse.json();
                    if (cleanSearchData.results && cleanSearchData.results.length > 0) {
                      tmdbId = cleanSearchData.results[0].id;
                    }
                  }
                }
              }
            }
            const title = attributes.titles.en || attributes.titles.en_jp || attributes.canonicalTitle;
            if (tmdbId && subtype !== "movie") {
              const lowerTitle = String(title || "").toLowerCase();
              if (/\b(special|recap|ova|oav|movie)\b/i.test(lowerTitle)) {
                season = 0;
              }
              const seasonMatch = title.match(/Season\s*(\d+)/i) || title.match(/(\d+)(?:st|nd|rd|th)\s*Season/i);
              if (!season && seasonMatch) {
                season = parseInt(seasonMatch[1]);
              } else if (!season && title.match(/\s(\d+)$/)) {
                season = parseInt(title.match(/\s(\d+)$/)[1]);
              } else if (!season && title.match(/\sII$/)) season = 2;
              else if (!season && title.match(/\sIII$/)) season = 3;
              else if (!season && title.match(/\sIV$/)) season = 4;
              else if (!season && title.match(/\sV$/)) season = 5;
              else if (!season && title.match(/\sVI$/)) season = 6;
              else if (title.includes("Final Season")) {
              }
              if (season) {
                console.log(`[TMDB Helper] Heuristic Season detected for ${id}: Season ${season} (${title})`);
              }
            }
          }
          if (tmdbId && season && !tmdbSeasonTitle) {
            tmdbSeasonTitle = yield getTmdbSeasonTitle(tmdbId, season);
          }
          return withTopologyHints({ tmdbId, season, tmdbSeasonTitle, titleHints });
        } catch (e) {
          console.error("[TMDB Helper] Kitsu resolve error:", e);
          return null;
        }
      });
    }
    function isMeaningfulSeasonName2(name) {
      const s = String(name || "").trim();
      if (!s) return false;
      if (/^Season\s+\d+$/i.test(s)) return false;
      if (/^Stagione\s+\d+$/i.test(s)) return false;
      return true;
    }
    function getTmdbSeasonTitle(tmdbId, season, language = "en-US") {
      return __async(this, null, function* () {
        try {
          const id = String(tmdbId || "").trim();
          const s = parseInt(season, 10);
          if (!id || !s) return null;
          const primaryUrl = `https://api.themoviedb.org/3/tv/${id}/season/${s}?api_key=${TMDB_API_KEY2}&language=${encodeURIComponent(language)}`;
          const primaryResponse = yield fetch(primaryUrl);
          if (primaryResponse.ok) {
            const primaryData = yield primaryResponse.json();
            if ((primaryData == null ? void 0 : primaryData.name) && !/^Season\s+\d+$/i.test(primaryData.name)) {
              return String(primaryData.name).trim();
            }
          }
          const fallbackUrl = `https://api.themoviedb.org/3/tv/${id}/season/${s}?api_key=${TMDB_API_KEY2}&language=it-IT`;
          const fallbackResponse = yield fetch(fallbackUrl);
          if (!fallbackResponse.ok) return null;
          const fallbackData = yield fallbackResponse.json();
          if ((fallbackData == null ? void 0 : fallbackData.name) && !/^Stagione\s+\d+$/i.test(fallbackData.name)) {
            return String(fallbackData.name).trim();
          }
          return null;
        } catch (_) {
          return null;
        }
      });
    }
    function getTvdbTitle(tvdbId) {
      return __async(this, null, function* () {
        try {
          const id = String(tvdbId || "").trim();
          if (!id) return null;
          const url = `https://api.tvmaze.com/lookup/shows?thetvdb=${encodeURIComponent(id)}`;
          const response = yield fetch(url);
          if (!response.ok) return null;
          const data = yield response.json();
          const baseName = (data == null ? void 0 : data.name) || null;
          const mazeId = data == null ? void 0 : data.id;
          if (mazeId) {
            try {
              const akaResponse = yield fetch(`https://api.tvmaze.com/shows/${mazeId}/akas`);
              if (akaResponse.ok) {
                const akas = yield akaResponse.json();
                const preferred = pickPreferredEnglishAlias(akas);
                if (preferred) return preferred;
              }
            } catch (_) {
            }
          }
          return baseName;
        } catch (e) {
          return null;
        }
      });
    }
    function pickPreferredEnglishAlias(akas) {
      if (!Array.isArray(akas) || akas.length === 0) return null;
      const isLatin = (s) => /[A-Za-z]/.test(String(s || ""));
      const score = (a) => {
        var _a, _b;
        const name = String((a == null ? void 0 : a.name) || "");
        const code = String(((_a = a == null ? void 0 : a.country) == null ? void 0 : _a.code) || "").toUpperCase();
        let points = 0;
        if (["US", "GB", "CA", "AU"].includes(code)) points += 4;
        if (isLatin(name)) points += 3;
        if (/english/i.test(String(((_b = a == null ? void 0 : a.country) == null ? void 0 : _b.name) || ""))) points += 2;
        if (name.length > 0 && name.length <= 80) points += 1;
        return points;
      };
      const sorted = [...akas].filter((a) => a && a.name).sort((a, b) => score(b) - score(a));
      const best = sorted[0];
      return best ? String(best.name).trim() : null;
    }
    function getTmdbFromKitsu2(kitsuId) {
      return __async(this, null, function* () {
        return resolveTmdbFromKitsu(kitsuId);
      });
    }
    function getSeasonEpisodeFromAbsolute(tmdbId, absoluteEpisode) {
      return __async(this, null, function* () {
        try {
          const url = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY2}&append_to_response=seasons`;
          const response = yield fetch(url);
          if (!response.ok) return null;
          const data = yield response.json();
          let totalEpisodes = 0;
          const seasons = data.seasons.filter((s) => s.season_number > 0).sort((a, b) => a.season_number - b.season_number);
          for (const season of seasons) {
            if (absoluteEpisode <= totalEpisodes + season.episode_count) {
              return {
                season: season.season_number,
                episode: absoluteEpisode - totalEpisodes
              };
            }
            totalEpisodes += season.episode_count;
          }
          return null;
        } catch (e) {
          console.error("[TMDB] Error mapping absolute episode:", e);
          return null;
        }
      });
    }
    function isAnime(metadata) {
      if (!metadata) return false;
      const isAnimation = metadata.genres && metadata.genres.some((g) => g.id === 16 || g.name === "Animation" || g.name === "Animazione");
      if (!isAnimation) return false;
      const asianCountries = ["JP", "CN", "KR", "TW", "HK"];
      const asianLangs = ["ja", "zh", "ko", "cn"];
      let countries = [];
      if (metadata.origin_country && Array.isArray(metadata.origin_country)) {
        countries = metadata.origin_country;
      } else if (metadata.production_countries && Array.isArray(metadata.production_countries)) {
        countries = metadata.production_countries.map((c) => c.iso_3166_1);
      }
      const hasAsianCountry = countries.some((c) => asianCountries.includes(c));
      const hasAsianLang = asianLangs.includes(metadata.original_language);
      return hasAsianCountry || hasAsianLang;
    }
    module2.exports = { getTmdbFromKitsu: getTmdbFromKitsu2, getSeasonEpisodeFromAbsolute, isAnime, getTvdbTitle, pickPreferredEnglishAlias };
  }
});

// src/formatter.js
var require_formatter = __commonJS({
  "src/formatter.js"(exports2, module2) {
    function isHttpsMp4Url(rawUrl) {
      const url = String(rawUrl || "").trim();
      if (!url) return false;
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:") return false;
        return parsed.pathname.toLowerCase().endsWith(".mp4");
      } catch (e) {
        return /^https:\/\/.+\.mp4(?:[?#].*)?$/i.test(url);
      }
    }
    function shouldSetNotWebReady(url, headers, behaviorHints = {}) {
      const proxyHeaders = behaviorHints.proxyHeaders && behaviorHints.proxyHeaders.request;
      if (proxyHeaders && Object.keys(proxyHeaders).length > 0) return true;
      if (headers && Object.keys(headers).length > 0) return true;
      return !isHttpsMp4Url(url);
    }
    function formatStream(stream, providerName) {
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
      const behaviorHints = stream.behaviorHints || {};
      let finalHeaders = stream.headers;
      if (behaviorHints.proxyHeaders && behaviorHints.proxyHeaders.request) {
        finalHeaders = behaviorHints.proxyHeaders.request;
      } else if (behaviorHints.headers) {
        finalHeaders = behaviorHints.headers;
      }
      if (finalHeaders) {
        behaviorHints.proxyHeaders = behaviorHints.proxyHeaders || {};
        behaviorHints.proxyHeaders.request = finalHeaders;
        behaviorHints.headers = finalHeaders;
      }
      behaviorHints.notWebReady = shouldSetNotWebReady(stream.url, finalHeaders, behaviorHints);
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

// src/animeunity/index.js
var require_animeunity = __commonJS({
  "src/animeunity/index.js"(exports2, module2) {
    var { extractVixCloud } = require_extractors();
    require_fetch_helper();
    var { getTmdbFromKitsu: getTmdbFromKitsu2, isAnime } = require_tmdb_helper();
    var { formatStream } = require_formatter();
    var { checkQualityFromPlaylist } = require_quality_helper();
    var BASE_URL = "https://www.animeunity.so";
    var TMDB_API_KEY2 = "68e094699525b18a70bab2f86b1fa706";
    var USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
    function getMetadata(id, type, requestedSeason = null, prefetchedMapping = null) {
      return __async(this, null, function* () {
        try {
          const normalizedType = String(type).toLowerCase();
          const parsedRequestedSeason = Number.parseInt(requestedSeason, 10);
          const isSpecialSeasonRequest = Number.isInteger(parsedRequestedSeason) && parsedRequestedSeason === 0;
          const allowMovieFallback = normalizedType === "movie" || isSpecialSeasonRequest;
          let tmdbId = id;
          let mappedSeason = null;
          let mappedSeasonName = null;
          let mappedTitleHints = [];
          let longSeries = false;
          let episodeMode = null;
          let mappedSeasons = [];
          let seriesSeasonCount = null;
          const mergeHints = (base, incoming) => {
            const joined = [...Array.isArray(base) ? base : [], ...Array.isArray(incoming) ? incoming : []].map((x) => String(x || "").trim()).filter(Boolean);
            return [...new Set(joined)];
          };
          const isMeaningfulSeasonName2 = (name) => {
            const clean = String(name || "").trim();
            if (!clean) return false;
            if (/^Season\s+\d+$/i.test(clean)) return false;
            if (/^Stagione\s+\d+$/i.test(clean)) return false;
            return true;
          };
          const applyMappingHints = (payload) => {
            if (!payload || typeof payload !== "object") return;
            if (payload.tmdbId) {
              tmdbId = payload.tmdbId;
            }
            const parsedSeason = parseInt(payload.season, 10);
            if (Number.isInteger(parsedSeason) && parsedSeason >= 0) {
              mappedSeason = parsedSeason;
            }
            if (isMeaningfulSeasonName2(payload.seasonName)) {
              mappedSeasonName = String(payload.seasonName).trim();
            }
            mappedTitleHints = mergeHints(mappedTitleHints, payload.titleHints);
            if (typeof payload.longSeries === "boolean") {
              longSeries = payload.longSeries;
            }
            if (payload.episodeMode) {
              const mode = String(payload.episodeMode).trim().toLowerCase();
              if (mode) episodeMode = mode;
            }
            if (Array.isArray(payload.mappedSeasons)) {
              const normalized = payload.mappedSeasons.map((n) => parseInt(n, 10)).filter((n) => Number.isInteger(n) && n > 0);
              if (normalized.length > 0) {
                mappedSeasons = [...new Set(normalized)].sort((a, b) => a - b);
              }
            }
            const parsedSeriesCount = parseInt(payload.seriesSeasonCount, 10);
            if (Number.isInteger(parsedSeriesCount) && parsedSeriesCount > 0) {
              seriesSeasonCount = parsedSeriesCount;
            }
          };
          const normalizePrefetchedMapping = (payload) => {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            if (!payload || typeof payload !== "object") return null;
            return {
              tmdbId: (_b = (_a = payload.tmdbId) != null ? _a : payload.tmdb_id) != null ? _b : null,
              season: (_d = (_c = payload.mappedSeason) != null ? _c : payload.season) != null ? _d : null,
              seasonName: (_f = (_e = payload.mappedSeasonName) != null ? _e : payload.seasonName) != null ? _f : null,
              titleHints: (_h = (_g = payload.mappedTitleHints) != null ? _g : payload.titleHints) != null ? _h : [],
              longSeries: payload.longSeries,
              episodeMode: payload.episodeMode,
              mappedSeasons: payload.mappedSeasons,
              seriesSeasonCount: payload.seriesSeasonCount
            };
          };
          const prefetchedPayload = normalizePrefetchedMapping(prefetchedMapping);
          const hasPrefetchedTmdb = !!(prefetchedPayload && String(prefetchedPayload.tmdbId || "").trim());
          if (prefetchedPayload) {
            applyMappingHints(prefetchedPayload);
          }
          if (String(id).startsWith("kitsu:")) {
            if (hasPrefetchedTmdb) {
              console.log(`[AnimeUnity] Using prefetched mapping for ${id} -> TMDB ${tmdbId} (Mapped Season: ${mappedSeason})`);
            } else {
              const resolved = yield getTmdbFromKitsu2(id);
              if (resolved && resolved.tmdbId) {
                applyMappingHints({
                  tmdbId: resolved.tmdbId,
                  season: resolved.season,
                  seasonName: resolved.tmdbSeasonTitle,
                  titleHints: resolved.titleHints,
                  longSeries: resolved.longSeries,
                  episodeMode: resolved.episodeMode,
                  mappedSeasons: resolved.mappedSeasons,
                  seriesSeasonCount: resolved.seriesSeasonCount
                });
                console.log(`[AnimeUnity] Resolved Kitsu ID ${id} to TMDB ID ${tmdbId} (Mapped Season: ${mappedSeason})`);
              } else {
                console.error(`[AnimeUnity] Failed to resolve Kitsu ID ${id}`);
                return null;
              }
            }
          }
          if (String(id).startsWith("tmdb:")) {
            tmdbId = String(id).replace("tmdb:", "");
          }
          if (String(id).startsWith("tt")) {
            if (String(tmdbId).startsWith("tt")) {
              const findUrl = `https://api.themoviedb.org/3/find/${id}?api_key=${TMDB_API_KEY2}&external_source=imdb_id&language=it-IT`;
              const findResponse = yield fetch(findUrl);
              if (!findResponse.ok) return null;
              const findData = yield findResponse.json();
              const results = normalizedType === "movie" ? findData.movie_results : findData.tv_results;
              if (!results || results.length === 0) return null;
              tmdbId = results[0].id;
            }
          }
          let endpoint = normalizedType === "movie" ? "movie" : "tv";
          let response = yield fetch(`https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY2}&language=it-IT`);
          if (!response.ok) {
            if (endpoint === "tv" && !allowMovieFallback) {
              console.log(`[AnimeUnity] TMDB TV metadata not found for ${tmdbId}; skipping movie fallback for ${normalizedType} Season ${requestedSeason}`);
              return null;
            }
            endpoint = endpoint === "movie" ? "tv" : "movie";
            response = yield fetch(`https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY2}&language=it-IT`);
            if (!response.ok) return null;
          }
          let alternatives = [];
          try {
            const altUrl = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}/alternative_titles?api_key=${TMDB_API_KEY2}`;
            const altResponse = yield fetch(altUrl);
            if (altResponse.ok) {
              const altData = yield altResponse.json();
              alternatives = altData.titles || altData.results || [];
            }
          } catch (e) {
            console.error("[AnimeUnity] Alt titles fetch error:", e);
          }
          return __spreadProps(__spreadValues({}, yield response.json()), {
            alternatives,
            mappedSeason,
            mappedSeasonName,
            mappedTitleHints,
            longSeries,
            episodeMode,
            mappedSeasons,
            seriesSeasonCount
          });
        } catch (e) {
          console.error("[AnimeUnity] Metadata error:", e);
          return null;
        }
      });
    }
    function getSeasonMetadata(id, season, language = "it-IT") {
      return __async(this, null, function* () {
        try {
          const url = `https://api.themoviedb.org/3/tv/${id}/season/${season}?api_key=${TMDB_API_KEY2}&language=${encodeURIComponent(language)}`;
          const response = yield fetch(url);
          if (!response.ok) return null;
          return yield response.json();
        } catch (e) {
          return null;
        }
      });
    }
    function calculateAbsoluteEpisode(metadata, season, episode) {
      if (!metadata || !metadata.seasons || season === 1) return episode;
      const currentSeason = metadata.seasons.find((s) => s.season_number === season);
      if (currentSeason && episode > currentSeason.episode_count) {
        return episode;
      }
      let absoluteEpisode = parseInt(episode);
      for (const s of metadata.seasons) {
        if (s.season_number > 0 && s.season_number < season) {
          absoluteEpisode += s.episode_count;
        }
      }
      return absoluteEpisode;
    }
    var checkSimilarity = (candTitle, targetTitle) => {
      if (!targetTitle) return false;
      const normalize = (s) => String(s).toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
      const t1 = normalize(candTitle);
      const t2 = normalize(targetTitle);
      if (t1.length < 2 || t2.length < 2) return false;
      if (t1.includes(t2) || t2.includes(t1)) return true;
      const w1 = t1.split(/\s+/).filter((w) => w.length > 2);
      const w2 = t2.split(/\s+/).filter((w) => w.length > 2);
      if (w1.length === 0 || w2.length === 0) return false;
      let matches = 0;
      for (const w of w2) {
        if (w1.includes(w)) matches++;
      }
      const score = matches / w2.length;
      return score >= 0.5;
    };
    function normalizeLooseText(text) {
      return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/&#x27;|&#039;/g, "'").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    }
    function tokenizeLooseText(text) {
      const stopWords = /* @__PURE__ */ new Set([
        "the",
        "a",
        "an",
        "and",
        "or",
        "of",
        "to",
        "in",
        "on",
        "at",
        "by",
        "for",
        "with",
        "il",
        "lo",
        "la",
        "i",
        "gli",
        "le",
        "un",
        "uno",
        "una",
        "e",
        "o",
        "di",
        "da",
        "con",
        "season",
        "stagione",
        "part",
        "parte",
        "movie",
        "film",
        "tv",
        "ita",
        "sub"
      ]);
      return normalizeLooseText(text).split(" ").map((t) => t.replace(/([aeiou])\1+/g, "$1")).filter((t) => t.length > 2 && !stopWords.has(t));
    }
    function hasLooseOverlap(candidateTitle, targetTitle) {
      const cTokens = tokenizeLooseText(candidateTitle);
      const tTokens = tokenizeLooseText(targetTitle);
      if (cTokens.length === 0 || tTokens.length === 0) return false;
      return cTokens.some((ct) => ct.length >= 6 && tTokens.includes(ct));
    }
    function isLooselyRelevant(candidateTitle, targets = []) {
      return targets.some((t) => hasLooseOverlap(candidateTitle, t));
    }
    function splitTitleForMovieHint(rawTitle) {
      const raw = String(rawTitle || "").trim();
      if (!raw) return { base: "", subtitle: "" };
      const separators = [" - ", " \u2013 ", " \u2014 ", ":"];
      let splitIndex = -1;
      let splitLength = 0;
      for (const sep of separators) {
        const idx = raw.lastIndexOf(sep);
        if (idx > splitIndex) {
          splitIndex = idx;
          splitLength = sep.length;
        }
      }
      if (splitIndex < 0) {
        return { base: raw, subtitle: "" };
      }
      return {
        base: raw.slice(0, splitIndex).trim(),
        subtitle: raw.slice(splitIndex + splitLength).trim()
      };
    }
    function extractMovieSubtitleHints(titles = []) {
      const baseTokens = /* @__PURE__ */ new Set();
      const subtitleTokens = /* @__PURE__ */ new Set();
      for (const rawTitle of titles) {
        const { base, subtitle } = splitTitleForMovieHint(rawTitle);
        const baseSource = base || rawTitle;
        tokenizeLooseText(baseSource).forEach((token) => baseTokens.add(token));
        tokenizeLooseText(subtitle).forEach((token) => subtitleTokens.add(token));
      }
      return [...subtitleTokens].filter(
        (token) => token.length >= 4 && !baseTokens.has(token) && !/^\d+$/.test(token)
      );
    }
    function candidateMatchesMovieSubtitleHints(candidate, hints = []) {
      if (!candidate || !Array.isArray(hints) || hints.length === 0) return true;
      const raw = `${candidate.title || ""} ${candidate.title_eng || ""}`.trim();
      if (!raw) return false;
      const tokenSet = new Set(tokenizeLooseText(raw));
      if (hints.some((h) => tokenSet.has(h))) return true;
      const rawNorm = normalizeLooseText(raw);
      return hints.some((h) => rawNorm.includes(h));
    }
    function tokenizeForPairing(text) {
      const normalized = String(text || "").toLowerCase().replace(/\(ita\)|\(sub ita\)|\[ita\]|\[sub ita\]/g, " ").replace(/&#x27;|&#039;/g, "'").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
      if (!normalized) return [];
      const stopWords = /* @__PURE__ */ new Set([
        "the",
        "a",
        "an",
        "and",
        "or",
        "of",
        "to",
        "in",
        "on",
        "at",
        "by",
        "for",
        "with",
        "il",
        "lo",
        "la",
        "i",
        "gli",
        "le",
        "un",
        "uno",
        "una",
        "e",
        "o",
        "di",
        "da",
        "con",
        "season",
        "stagione",
        "part",
        "parte",
        "movie",
        "film",
        "tv",
        "ita",
        "sub",
        "arc",
        "hen"
      ]);
      return normalized.split(" ").filter((t) => t.length > 2 && !stopWords.has(t));
    }
    function areCoherentCandidates(a, b, title, originalTitle) {
      if (!a || !b) return true;
      const aTitle = (a.title || a.title_eng || "").trim();
      const bTitle = (b.title || b.title_eng || "").trim();
      if (!aTitle || !bTitle) return true;
      const normalize = (str) => String(str || "").toLowerCase().replace(/\(ita\)|\(sub ita\)|\[ita\]|\[sub ita\]/g, " ").replace(/&#x27;|&#039;/g, "'").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
      const aNorm = normalize(aTitle);
      const bNorm = normalize(bTitle);
      if (!aNorm || !bNorm) return true;
      if (aNorm === bNorm) return true;
      if (!checkSimilarity(aTitle, bTitle) && !checkSimilarity(bTitle, aTitle)) return false;
      const baseTokens = /* @__PURE__ */ new Set([
        ...tokenizeForPairing(title || ""),
        ...tokenizeForPairing(originalTitle || "")
      ]);
      const aSpecific = tokenizeForPairing(aTitle).filter((t) => !baseTokens.has(t));
      const bSpecific = tokenizeForPairing(bTitle).filter((t) => !baseTokens.has(t));
      if (aSpecific.length === 0 || bSpecific.length === 0) return true;
      return aSpecific.some((t) => bSpecific.includes(t));
    }
    function findBestMatch(candidates, title, originalTitle, season, metadata, options = {}) {
      if (!candidates || candidates.length === 0) return null;
      const isTv = !!metadata.name;
      let appliedSeasonYearFilter = false;
      let filteredCandidates = candidates;
      if (isTv && season !== 0) {
        const tvTypes = ["TV", "ONA"];
        const matches = candidates.filter((c) => tvTypes.includes(c.type));
        if (matches.length > 0) {
          filteredCandidates = matches;
        } else {
          return null;
        }
      } else {
        const movieTypes = ["Movie", "Special", "OVA", "ONA"];
        const matches = candidates.filter((c) => movieTypes.includes(c.type));
        if (matches.length > 0) {
          filteredCandidates = matches;
        } else {
          return null;
        }
      }
      const normTitle = title.toLowerCase().trim();
      const normOriginal = originalTitle ? originalTitle.toLowerCase().trim() : "";
      const preYearExactMatches = filteredCandidates.filter((c) => {
        const t = (c.title || "").toLowerCase().trim();
        const te = (c.title_eng || "").toLowerCase().trim();
        const tClean = t.replace(/\s*\(ita\)$/i, "").trim();
        const teClean = te.replace(/\s*\(ita\)$/i, "").trim();
        return t === normTitle || te === normTitle || tClean === normTitle || teClean === normTitle || normOriginal && (t === normOriginal || te === normOriginal || tClean === normOriginal || teClean === normOriginal);
      });
      const metaYear = metadata.first_air_date ? parseInt(metadata.first_air_date.substring(0, 4)) : metadata.release_date ? parseInt(metadata.release_date.substring(0, 4)) : null;
      if (metaYear && (season === 1 || !isTv)) {
        const yearFiltered = filteredCandidates.filter((c) => {
          if (!c.date || c.date === "Indeterminato" || c.date === "?") {
            console.log(`[AnimeUnity] Filtered out "${c.title}" (Date: ${c.date})`);
            return false;
          }
          const match = c.date.match(/(\d{4})/);
          if (match) {
            const cYear = parseInt(match[1]);
            const diff = Math.abs(cYear - metaYear);
            const keep = diff <= 2;
            if (!keep) console.log(`[AnimeUnity] Filtered out "${c.title}" (${cYear}) vs Meta (${metaYear})`);
            return keep;
          }
          return false;
        });
        if (yearFiltered.length > 0) {
          filteredCandidates = yearFiltered;
        } else if (filteredCandidates.length > 0) {
          return null;
        }
      }
      if (season > 1 && options.seasonYear) {
        const targetYear = parseInt(options.seasonYear, 10);
        if (!isNaN(targetYear)) {
          const seasonYearCandidates = filteredCandidates.map((c) => {
            if (!c.date || c.date === "Indeterminato" || c.date === "?") return null;
            const match = String(c.date).match(/(\d{4})/);
            if (!match) return null;
            const cYear = parseInt(match[1], 10);
            return { candidate: c, diff: Math.abs(cYear - targetYear) };
          }).filter((x) => x && x.diff <= 2);
          if (seasonYearCandidates.length > 0) {
            const minDiff = Math.min(...seasonYearCandidates.map((x) => x.diff));
            filteredCandidates = seasonYearCandidates.filter((x) => x.diff === minDiff).map((x) => x.candidate);
            appliedSeasonYearFilter = true;
          }
        }
      }
      if (preYearExactMatches.length > 0 && (season === 1 || !isTv)) {
        const anyExactMatchSurvived = filteredCandidates.some(
          (c) => preYearExactMatches.some((pym) => pym.id === c.id)
        );
        if (!anyExactMatchSurvived) {
          return null;
        }
      }
      if (options.bypassSeasonCheck) {
        return filteredCandidates[0];
      }
      if (season === 0) {
        const isSpecialLikeCandidate = (candidate) => {
          const raw = `${(candidate == null ? void 0 : candidate.title) || ""} ${(candidate == null ? void 0 : candidate.title_eng) || ""}`.toLowerCase();
          const cType = String((candidate == null ? void 0 : candidate.type) || "").toLowerCase();
          if (cType === "special" || cType === "ova" || cType === "movie") return true;
          return /\b(special|speciale|ova|oav|movie|film|recap|extra|zero|episodio\s*0|ep\s*0)\b/i.test(raw);
        };
        const isTitleAligned = (candidate) => {
          const candidateRaw = `${(candidate == null ? void 0 : candidate.title) || ""} ${(candidate == null ? void 0 : candidate.title_eng) || ""}`;
          const candidateNorm = normalizeLooseText(candidateRaw);
          const candidateTokens = tokenizeLooseText(candidateRaw);
          const targets = [title, originalTitle].filter(Boolean);
          for (const target of targets) {
            const targetTokens = tokenizeLooseText(target);
            if (targetTokens.length > 0 && candidateTokens.length > 0) {
              const matched = targetTokens.filter((t) => candidateTokens.includes(t)).length;
              const minNeeded = Math.max(1, Math.ceil(targetTokens.length * 0.6));
              if (matched >= minNeeded) return true;
            }
            const tNorm = normalizeLooseText(target);
            if (!tNorm) continue;
            if (candidateNorm === tNorm || candidateNorm.startsWith(`${tNorm} `) || candidateNorm.includes(` ${tNorm} `) || candidateNorm.endsWith(` ${tNorm}`)) {
              return true;
            }
          }
          return false;
        };
        const seasonZeroCandidates = filteredCandidates.filter((c) => isSpecialLikeCandidate(c) && isTitleAligned(c));
        if (seasonZeroCandidates.length === 0) {
          console.log("[AnimeUnity] No season 0 match found passing specials/title checks");
          return null;
        }
        const withSpecialWord = seasonZeroCandidates.find(
          (c) => /\b(special|speciale|ova|oav|movie|film)\b/i.test(`${c.title || ""} ${c.title_eng || ""}`)
        );
        return withSpecialWord || seasonZeroCandidates[0];
      }
      const exactMatch = filteredCandidates.find((c) => {
        const t = (c.title || "").toLowerCase().trim();
        const te = (c.title_eng || "").toLowerCase().trim();
        return t === normTitle || te === normTitle || normOriginal && (t === normOriginal || te === normOriginal);
      });
      if (exactMatch && season === 1) return exactMatch;
      if (!isTv && season === 1) {
        const movieSubtitleHints = extractMovieSubtitleHints([
          title,
          originalTitle,
          ...(metadata.mappedTitleHints || []).slice(0, 20)
        ]);
        if (movieSubtitleHints.length > 0) {
          filteredCandidates = filteredCandidates.filter((c) => candidateMatchesMovieSubtitleHints(c, movieSubtitleHints));
          if (filteredCandidates.length === 0) {
            console.log(`[AnimeUnity] Movie subtitle guard rejected all candidates for: ${title}`);
            return null;
          }
        }
      }
      if (!isTv && season === 1) {
        if (normTitle.includes(":")) {
          const parts = normTitle.split(":");
          const subtitle = parts[parts.length - 1].trim();
          if (subtitle.length > 3) {
            let subMatch = filteredCandidates.find((c) => {
              const t = (c.title || "").toLowerCase();
              const te = (c.title_eng || "").toLowerCase();
              return t.includes(subtitle) || te.includes(subtitle);
            });
            if (!subMatch && /part\s*\d+/i.test(subtitle)) {
              const simpleSubtitle = subtitle.replace(/part\s*\d+/i, "").trim();
              if (simpleSubtitle.length > 3) {
                subMatch = filteredCandidates.find((c) => {
                  const t = (c.title || "").toLowerCase();
                  const te = (c.title_eng || "").toLowerCase();
                  return t.includes(simpleSubtitle) || te.includes(simpleSubtitle);
                });
              }
            }
            if (subMatch) return subMatch;
          }
        }
        const clean = (str) => str.replace(/\b(film|movie|the|and|or|of|in|on|at|to|a|an)\b/gi, "").replace(/[^a-z0-9\s]/gi, "").replace(/\s+/g, " ").trim();
        const normClean = clean(normTitle);
        if (normClean.length > 3) {
          const words = normClean.split(" ");
          let bestCandidate = null;
          let maxMatches = 0;
          for (const c of filteredCandidates) {
            const cTitle = (c.title || "").toLowerCase();
            const cClean = clean(cTitle);
            const cWords = cClean.split(" ");
            let matches = 0;
            for (const w of words) {
              if (cWords.includes(w) || cTitle.includes(w)) matches++;
            }
            if (matches > maxMatches) {
              maxMatches = matches;
              bestCandidate = c;
            }
          }
          if (bestCandidate && maxMatches >= words.length * 0.75) {
            return bestCandidate;
          }
        }
      }
      if (season > 1) {
        const seasonStr = String(season);
        const seasonNameHints = Array.isArray(options.seasonNames) ? options.seasonNames.map((s) => String(s || "").trim()).filter(Boolean) : [];
        const normalizeCandidateTitle = (candidate) => String(candidate.title || candidate.title_eng || "").toLowerCase().replace(/\s*\(ita\)\s*$/i, "").replace(/&#x27;|&#039;/g, "'").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
        const baseTitleNorm = String(title || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
        const baseOriginalNorm = String(originalTitle || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
        const isBaseEntry = (candidate) => {
          const cNorm = normalizeCandidateTitle(candidate);
          return cNorm === baseTitleNorm || baseOriginalNorm && cNorm === baseOriginalNorm;
        };
        const hasSpecificSeasonMarkers = (candidate) => {
          const raw = `${candidate.title || ""} ${candidate.title_eng || ""}`.toLowerCase();
          if (/season|stagione|part|parte|\b\d+\b/.test(raw)) return true;
          if (/\b(arc|saga|chapter|cour)\b|\b\w+(?:-|\s)?hen\b/.test(raw)) return true;
          if (/final\s*season/i.test(raw)) return true;
          return false;
        };
        const getSeasonNameScore = (candidate) => {
          if (seasonNameHints.length === 0 || !candidate) return 0;
          const normalize = (s) => String(s || "").toLowerCase().replace(/&#x27;|&#039;/g, "'").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
          const tokenize = (s) => normalize(s).split(/\s+/).filter(Boolean);
          const genericTokens = /* @__PURE__ */ new Set(["season", "stagione", "part", "parte", "the", "and", "dei", "degli", "della"]);
          const baseTokenSet = /* @__PURE__ */ new Set([
            ...tokenize(title),
            ...tokenize(originalTitle)
          ]);
          const cTitle = String(candidate.title || "");
          const cTitleEn = String(candidate.title_eng || "");
          const cNorm = normalize(`${cTitle} ${cTitleEn}`);
          return seasonNameHints.reduce((maxScore, hint) => {
            const h = String(hint || "").trim();
            if (!h) return maxScore;
            const hNorm = normalize(h);
            if (!hNorm) return maxScore;
            if (cNorm.includes(hNorm)) {
              return Math.max(maxScore, 3);
            }
            const distinctive = tokenize(hNorm).filter(
              (t) => t.length >= 4 && !baseTokenSet.has(t) && !genericTokens.has(t)
            );
            if (distinctive.length === 0) return maxScore;
            const matchedDistinctive = distinctive.filter((t) => cNorm.includes(t)).length;
            if (matchedDistinctive === 0) return maxScore;
            const coverage = matchedDistinctive / distinctive.length;
            if (coverage < 0.75) return maxScore;
            return Math.max(maxScore, 1 + matchedDistinctive);
          }, 0);
        };
        const sortSeasonSpecific = (list) => {
          return [...list].sort((a, b) => {
            const seasonHintScoreA = getSeasonNameScore(a);
            const seasonHintScoreB = getSeasonNameScore(b);
            if (seasonHintScoreA !== seasonHintScoreB) return seasonHintScoreB - seasonHintScoreA;
            const aRaw = `${a.title || ""} ${a.title_eng || ""}`.toLowerCase();
            const bRaw = `${b.title || ""} ${b.title_eng || ""}`.toLowerCase();
            const aHasPart = /part\s*\d+/i.test(aRaw);
            const bHasPart = /part\s*\d+/i.test(bRaw);
            if (aHasPart !== bHasPart) return aHasPart ? 1 : -1;
            return (a.title || a.title_eng || "").length - (b.title || b.title_eng || "").length;
          });
        };
        const seasonSpecificCandidates = filteredCandidates.filter((c) => !isBaseEntry(c) && hasSpecificSeasonMarkers(c));
        if (seasonNameHints.length > 0) {
          const seasonNameMatches = filteredCandidates.filter((c) => getSeasonNameScore(c) > 0);
          if (seasonNameMatches.length > 0) {
            const preferredSeasonNameMatch = sortSeasonSpecific(seasonNameMatches)[0];
            if (preferredSeasonNameMatch) return preferredSeasonNameMatch;
          }
        }
        const numberCandidates = filteredCandidates.filter((c) => {
          const t = (c.title || "").toLowerCase();
          const te = (c.title_eng || "").toLowerCase();
          const regex = new RegExp(`\\b${seasonStr}$|\\b${seasonStr}\\b|season\\s*${seasonStr}|stagione\\s*${seasonStr}`, "i");
          return regex.test(t) || regex.test(te);
        });
        if (numberCandidates.length > 0) {
          if (seasonNameHints.length > 0) {
            const alignedNumberCandidates = sortSeasonSpecific(numberCandidates.filter((c) => getSeasonNameScore(c) > 0));
            if (alignedNumberCandidates.length > 0) return alignedNumberCandidates[0];
          }
          const nonPartNumberCandidates = numberCandidates.filter((c) => {
            const raw = `${c.title || ""} ${c.title_eng || ""}`.toLowerCase();
            return !new RegExp(`\\bpart(?:e)?\\s*${seasonStr}\\b`, "i").test(raw);
          });
          const rankedNumberCandidates = sortSeasonSpecific(nonPartNumberCandidates.length > 0 ? nonPartNumberCandidates : numberCandidates);
          if (rankedNumberCandidates.length > 0) return rankedNumberCandidates[0];
        }
        const roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
        if (season < roman.length) {
          const romanStr = roman[season];
          const romanCandidates = filteredCandidates.filter((c) => {
            const t = (c.title || "").toLowerCase();
            const te = (c.title_eng || "").toLowerCase();
            const regex = new RegExp(`\\b${romanStr}$|\\b${romanStr}\\b`, "i");
            return regex.test(t) || regex.test(te);
          });
          if (romanCandidates.length > 0) {
            if (seasonNameHints.length > 0) {
              const alignedRomanCandidates = sortSeasonSpecific(romanCandidates.filter((c) => getSeasonNameScore(c) > 0));
              if (alignedRomanCandidates.length > 0) return alignedRomanCandidates[0];
            }
            return sortSeasonSpecific(romanCandidates)[0];
          }
        }
        if (appliedSeasonYearFilter && filteredCandidates.length > 0) {
          const seasonPool = seasonSpecificCandidates.length > 0 ? sortSeasonSpecific(seasonSpecificCandidates) : filteredCandidates;
          const seasonYearMatch = seasonPool.find((c) => {
            if (checkSimilarity(c.title, title) || checkSimilarity(c.title_eng, title) || (checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title_eng, originalTitle))) return true;
            if (metadata.alternatives) {
              return metadata.alternatives.some((alt) => checkSimilarity(c.title, alt.title) || checkSimilarity(c.title_eng, alt.title));
            }
            return false;
          });
          if (seasonYearMatch) return seasonYearMatch;
          return seasonPool[0];
        }
        if (seasonSpecificCandidates.length > 0) {
          const sortedSpecific = sortSeasonSpecific(seasonSpecificCandidates);
          const specificMatch = sortedSpecific.find((c) => {
            if (checkSimilarity(c.title, title) || checkSimilarity(c.title_eng, title) || (checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title_eng, originalTitle))) return true;
            if (metadata.alternatives) {
              return metadata.alternatives.some((alt) => checkSimilarity(c.title, alt.title) || checkSimilarity(c.title_eng, alt.title));
            }
            return false;
          });
          if (specificMatch) return specificMatch;
          return sortedSpecific[0];
        }
        const baseMatch = filteredCandidates.find((c) => {
          const t = (c.title || "").toLowerCase().trim();
          const te = (c.title_eng || "").toLowerCase().trim();
          const tClean = t.replace(/\s*\(ita\)$/i, "").trim();
          const teClean = te.replace(/\s*\(ita\)$/i, "").trim();
          return t === normTitle || te === normTitle || tClean === normTitle || teClean === normTitle || normOriginal && (t === normOriginal || te === normOriginal || tClean === normOriginal || teClean === normOriginal);
        });
        if (baseMatch) {
          console.log(`[AnimeUnity] Found base title match for Season ${season}: ${baseMatch.title || baseMatch.title_eng}`);
          return baseMatch;
        }
      } else {
        const sorted = [...filteredCandidates].sort((a, b) => {
          const lenA = (a.title || a.title_eng || "").length;
          const lenB = (b.title || b.title_eng || "").length;
          return lenA - lenB;
        });
        const hasNumberSuffix = (str) => {
          if (!str) return false;
          if (/(\s|^)\d+(\s*\(ITA\))?$/i.test(str)) return true;
          if (/final\s*season/i.test(str)) return true;
          if (/(season|stagione)\s*\d+/i.test(str)) return true;
          return false;
        };
        const noNumberMatch = sorted.find((c) => {
          const t = (c.title || "").trim();
          const te = (c.title_eng || "").trim();
          if (hasNumberSuffix(t) || hasNumberSuffix(te)) return false;
          if (checkSimilarity(c.title, title) || checkSimilarity(c.title_eng, title) || (checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title_eng, originalTitle))) return true;
          if (metadata.alternatives) {
            return metadata.alternatives.some((alt) => checkSimilarity(c.title, alt.title) || checkSimilarity(c.title_eng, alt.title));
          }
          return false;
        });
        if (noNumberMatch) return noNumberMatch;
        const anyMatch = sorted.find((c) => {
          if (checkSimilarity(c.title, title) || checkSimilarity(c.title_eng, title) || (checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title_eng, originalTitle))) return true;
          if (metadata.alternatives) {
            return metadata.alternatives.some((alt) => checkSimilarity(c.title, alt.title) || checkSimilarity(c.title_eng, alt.title));
          }
          return false;
        });
        if (anyMatch) return anyMatch;
      }
      return null;
    }
    function searchAnime(query) {
      return __async(this, null, function* () {
        try {
          const url = `${BASE_URL}/archivio?title=${encodeURIComponent(query)}`;
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": BASE_URL
            }
          });
          if (!response.ok) return [];
          const html = yield response.text();
          const recordsRegex = /<archivio[^>]*records="([^"]*)"/i;
          const match = recordsRegex.exec(html);
          if (!match) return [];
          const recordsJson = match[1].replace(/&quot;/g, '"');
          try {
            const records = JSON.parse(recordsJson);
            return records;
          } catch (e) {
            console.error("[AnimeUnity] Failed to parse search records:", e);
            return [];
          }
        } catch (e) {
          console.error("[AnimeUnity] Search error:", e);
          return [];
        }
      });
    }
    function fetchAnimeYear(id, slug) {
      return __async(this, null, function* () {
        if (!id || !slug) return null;
        try {
          const url = `${BASE_URL}/anime/${id}-${slug}`;
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": BASE_URL
            }
          });
          if (!response.ok) return null;
          const html = yield response.text();
          const dateMatch = /<strong>Anno<\/strong>[\s\S]*?<small>(\d{4})<\/small>/i.exec(html);
          if (dateMatch) {
            return dateMatch[1];
          }
          return null;
        } catch (e) {
          console.error("[AnimeUnity] Detail fetch error:", e);
          return null;
        }
      });
    }
    function getStreams2(id, type, season, episode, providerContext = null) {
      return __async(this, null, function* () {
        try {
          const metadata = yield getMetadata(id, type, season, providerContext);
          if (!metadata) {
            console.error("[AnimeUnity] Metadata not found for", id);
            return [];
          }
          if (!isAnime(metadata)) {
            console.log(`[AnimeUnity] Skipped ${metadata.title} (Not an anime)`);
            return [];
          }
          let mappedSeason = metadata.mappedSeason;
          if (mappedSeason !== null && mappedSeason !== void 0) {
            const parsedMapped = parseInt(mappedSeason, 10);
            if (!isNaN(parsedMapped)) mappedSeason = parsedMapped;
          }
          const episodeMode = String(metadata.episodeMode || "").toLowerCase();
          const mappedSeasonCount = Array.isArray(metadata.mappedSeasons) ? metadata.mappedSeasons.filter((n) => Number.isInteger(parseInt(n, 10)) && parseInt(n, 10) > 0).length : 0;
          const parsedSeriesSeasonCount = parseInt(metadata.seriesSeasonCount, 10);
          const seriesSeasonCount = Number.isInteger(parsedSeriesSeasonCount) ? parsedSeriesSeasonCount : 0;
          const tmdbSeasonCount = Array.isArray(metadata.seasons) ? metadata.seasons.filter((s) => Number.isInteger(s == null ? void 0 : s.season_number) && s.season_number > 0).length : 0;
          const topologyAbsoluteFallback = tmdbSeasonCount >= 12 || mappedSeasonCount >= 12 || seriesSeasonCount >= 12;
          const isLongSeriesAbsolute = episodeMode === "absolute" || topologyAbsoluteFallback;
          const parsedSeason = Number.isInteger(season) ? season : parseInt(season, 10);
          if (!isNaN(parsedSeason)) season = parsedSeason;
          const isSpecialSeasonRequest = season === 0;
          if (isSpecialSeasonRequest && mappedSeason && mappedSeason !== 0) {
            console.log(`[AnimeUnity] Requested Season 0 (specials). Ignoring mapped Season ${mappedSeason}.`);
          } else if (mappedSeason && !isLongSeriesAbsolute) {
            console.log(`[AnimeUnity] Kitsu mapping indicates Season ${mappedSeason}. Overriding requested Season ${season}`);
            season = mappedSeason;
          } else if (mappedSeason && isLongSeriesAbsolute) {
            console.log(`[AnimeUnity] Long-series absolute mode active. Keeping requested Season ${season} (mapped season: ${mappedSeason}).`);
          }
          const seasonSearchEnabled = season > 1 && !isLongSeriesAbsolute;
          const seasonForMatch = seasonSearchEnabled ? season : season === 0 ? 0 : 1;
          const title = metadata.title || metadata.name;
          const originalTitle = metadata.original_title || metadata.original_name;
          const looseTargets = [
            title,
            originalTitle,
            ...(metadata.alternatives || []).slice(0, 30).map((a) => a.title),
            ...(metadata.mappedTitleHints || []).slice(0, 20)
          ].filter(Boolean);
          const isRelevantByLooseMatch = (candidateTitle, extraTargets = []) => {
            return isLooselyRelevant(candidateTitle, [...looseTargets, ...extraTargets].filter(Boolean));
          };
          if (isLongSeriesAbsolute) {
            if (episodeMode !== "absolute" && topologyAbsoluteFallback) {
              console.log(`[AnimeUnity] Absolute long-series fallback enabled by topology (TMDB:${tmdbSeasonCount}, mapped:${mappedSeasonCount}, series:${seriesSeasonCount}).`);
            }
            console.log(`[AnimeUnity] Long-series absolute mode for ${title}: disabling season-name/season-number queries.`);
          }
          console.log(`[AnimeUnity] Searching for: ${title} (Season ${season})`);
          let candidates = [];
          let seasonNameMatch = false;
          let seasonYear = null;
          let seasonNameHints = [];
          if (seasonSearchEnabled && metadata.seasons) {
            const targetSeason = metadata.seasons.find((s) => s.season_number === season);
            if (targetSeason && targetSeason.air_date) {
              const yearMatch = String(targetSeason.air_date).match(/(\d{4})/);
              if (yearMatch) seasonYear = parseInt(yearMatch[1], 10);
            }
          }
          const normalizeCandidateTitle = (candidate) => String(candidate.title || candidate.title_eng || "").toLowerCase().replace(/\s*\(ita\)\s*$/i, "").replace(/&#x27;|&#039;/g, "'").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
          const baseTitleNorm = String(title || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
          const baseOriginalNorm = String(originalTitle || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
          const isBaseEntryLocal = (candidate) => {
            const cNorm = normalizeCandidateTitle(candidate);
            return cNorm === baseTitleNorm || baseOriginalNorm && cNorm === baseOriginalNorm;
          };
          const hasSeasonSpecificMarkerLocal = (candidate) => {
            const raw = `${candidate.title || ""} ${candidate.title_eng || ""}`.toLowerCase();
            if (/season|stagione|part|parte|\b\d+\b/.test(raw)) return true;
            if (/\b(arc|saga|chapter|cour)\b|\b\w+(?:-|\s)?hen\b/.test(raw)) return true;
            if (/final\s*season/i.test(raw)) return true;
            return false;
          };
          const isRelevantSeasonCandidateLocal = (candidate, query) => {
            const candidateCombined = `${candidate.title || ""} ${candidate.title_eng || ""}`.trim();
            const matchesMain = checkSimilarity(candidate.title, title) || checkSimilarity(candidate.title_eng, title) || (checkSimilarity(candidate.title, originalTitle) || checkSimilarity(candidate.title_eng, originalTitle)) || isRelevantByLooseMatch(candidateCombined);
            if (!matchesMain) return false;
            if (metadata.alternatives && metadata.alternatives.some(
              (alt) => checkSimilarity(candidate.title, alt.title) || checkSimilarity(candidate.title_eng, alt.title) || isRelevantByLooseMatch(candidateCombined, [alt.title])
            )) {
              return true;
            }
            if (query && (checkSimilarity(candidate.title, query) || checkSimilarity(candidate.title_eng, query))) {
              return true;
            }
            if (seasonSearchEnabled) {
              if (hasSeasonSpecificMarkerLocal(candidate)) return true;
              return !isBaseEntryLocal(candidate);
            }
            return true;
          };
          if (season === 0) {
            const searchQueries = [
              `${title} Special`,
              `${title} OAV`,
              `${title} Movie`
            ];
            for (const query of searchQueries) {
              console.log(`[AnimeUnity] Special search: ${query}`);
              const res = yield searchAnime(query);
              if (res && res.length > 0) {
                candidates = candidates.concat(res);
              }
            }
            candidates = candidates.filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i);
          }
          if (seasonSearchEnabled) {
            const searchQueries = [
              `${title} ${season}`,
              `${title} Season ${season}`,
              `${title} Stagione ${season}`
            ];
            if (originalTitle && originalTitle !== title) {
              searchQueries.push(`${originalTitle} ${season}`);
            }
            const seasonStrategyCandidates = [];
            const addRelevantSeasonCandidates = (results2, query) => {
              if (!results2 || results2.length === 0) return 0;
              const relevantRes = results2.filter((c) => isRelevantSeasonCandidateLocal(c, query));
              if (relevantRes.length > 0) {
                seasonStrategyCandidates.push(...relevantRes);
              }
              return relevantRes.length;
            };
            const seasonNames = [];
            if (metadata.mappedSeasonName && !metadata.mappedSeasonName.match(/^Season \d+|^Stagione \d+/i)) {
              seasonNames.push(metadata.mappedSeasonName);
            }
            if (Array.isArray(metadata.mappedTitleHints) && metadata.mappedTitleHints.length > 0) {
              seasonNames.push(...metadata.mappedTitleHints);
            }
            const seasonMetaEn = yield getSeasonMetadata(metadata.id, season, "en-US");
            if (!seasonYear && seasonMetaEn && seasonMetaEn.air_date) {
              const yearMatch = String(seasonMetaEn.air_date).match(/(\d{4})/);
              if (yearMatch) seasonYear = parseInt(yearMatch[1], 10);
            }
            if (seasonMetaEn && seasonMetaEn.name && !seasonMetaEn.name.match(/^Season \d+/i)) {
              seasonNames.push(seasonMetaEn.name);
            }
            const seasonMetaIt = yield getSeasonMetadata(metadata.id, season, "it-IT");
            if (!seasonYear && seasonMetaIt && seasonMetaIt.air_date) {
              const yearMatch = String(seasonMetaIt.air_date).match(/(\d{4})/);
              if (yearMatch) seasonYear = parseInt(yearMatch[1], 10);
            }
            if (seasonMetaIt && seasonMetaIt.name && !seasonMetaIt.name.match(/^Season \d+|^Stagione \d+/i)) {
              seasonNames.push(seasonMetaIt.name);
            }
            const uniqueSeasonNames = [...new Set(seasonNames.map((n) => String(n).trim()).filter(Boolean))];
            seasonNameHints = uniqueSeasonNames;
            if (uniqueSeasonNames.length > 0) {
              console.log(`[AnimeUnity] Found season names (priority Mapping->EN->IT): ${uniqueSeasonNames.join(" | ")}`);
            }
            for (const seasonName of uniqueSeasonNames) {
              const seasonQueries = [
                `${title} ${seasonName}`,
                seasonName
              ];
              if (originalTitle && originalTitle !== title && !originalTitle.match(/[\u3040-\u30ff\u4e00-\u9faf]/)) {
                seasonQueries.push(`${originalTitle} ${seasonName}`);
              }
              for (const query of seasonQueries) {
                console.log(`[AnimeUnity] Specific Season Name search: ${query}`);
                const res = yield searchAnime(query);
                const added = addRelevantSeasonCandidates(res, query);
                if (added > 0) {
                  console.log(`[AnimeUnity] Found matches for season name: ${query}`);
                  seasonNameMatch = true;
                  break;
                }
              }
              if (seasonNameMatch) break;
            }
            for (const query of searchQueries) {
              console.log(`[AnimeUnity] Specific search: ${query}`);
              const res = yield searchAnime(query);
              addRelevantSeasonCandidates(res, query);
            }
            if (seasonNameMatch || seasonStrategyCandidates.length === 0) {
              const broadQueries = [title];
              if (originalTitle && originalTitle !== title) broadQueries.push(originalTitle);
              for (const query of broadQueries) {
                console.log(`[AnimeUnity] Season pool enrichment search: ${query}`);
                const res = yield searchAnime(query);
                addRelevantSeasonCandidates(res, query);
              }
            }
            if (seasonStrategyCandidates.length > 0) {
              candidates = seasonStrategyCandidates.filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i);
            }
          }
          const isMovie = metadata.genres && metadata.genres.some((g) => g.name === "Movie") || season === 0 || type === "movie";
          if (candidates.length === 0) {
            console.log(`[AnimeUnity] Standard search: ${title}`);
            candidates = yield searchAnime(title);
            if (seasonSearchEnabled && candidates.length > 0 && title.includes("-")) {
              const seasonTokenRegex = new RegExp(`\\b${season}\\b|season\\s*${season}|stagione\\s*${season}|part\\s*${season}|parte\\s*${season}`, "i");
              const hasRequestedSeasonInStandard = candidates.some((c) => {
                const raw = `${c.title || ""} ${c.title_eng || ""}`;
                return seasonTokenRegex.test(raw);
              });
              if (!hasRequestedSeasonInStandard) {
                const dehyphenated = title.replace(/-/g, " ").replace(/\s+/g, " ").trim();
                if (dehyphenated !== title) {
                  console.log(`[AnimeUnity] Standard search lacks season ${season}. Dehyphenated search: ${dehyphenated}`);
                  const dehyphenCandidates = yield searchAnime(dehyphenated);
                  if (dehyphenCandidates && dehyphenCandidates.length > 0) {
                    const hasRequestedSeasonInDehyphen = dehyphenCandidates.some((c) => {
                      const raw = `${c.title || ""} ${c.title_eng || ""}`;
                      return seasonTokenRegex.test(raw);
                    });
                    if (hasRequestedSeasonInDehyphen) {
                      candidates = dehyphenCandidates;
                    }
                  }
                }
              }
            }
            if (candidates.length === 0 && title.includes("-")) {
              const dehyphenated = title.replace(/-/g, " ").replace(/\s+/g, " ").trim();
              if (dehyphenated !== title) {
                console.log(`[AnimeUnity] Dehyphenated search: ${dehyphenated}`);
                candidates = yield searchAnime(dehyphenated);
              }
            }
            if (candidates.length === 0 && isMovie) {
              if (title.includes(" - ")) {
                const colonTitle = title.replace(" - ", ": ");
                console.log(`[AnimeUnity] Colon search: ${colonTitle}`);
                const colonRes = yield searchAnime(colonTitle);
                if (colonRes && colonRes.length > 0) candidates = candidates.concat(colonRes);
              }
              if (title.includes(":")) {
                const parts = title.split(":");
                if (parts.length > 1) {
                  const subtitle = parts[parts.length - 1].trim();
                  if (subtitle.length > 3) {
                    console.log(`[AnimeUnity] Movie subtitle search: ${subtitle}`);
                    const subRes = yield searchAnime(subtitle);
                    if (subRes && subRes.length > 0) candidates = candidates.concat(subRes);
                    if (/part\s*\d+/i.test(subtitle)) {
                      const simpleSubtitle = subtitle.replace(/part\s*\d+/i, "").trim();
                      if (simpleSubtitle.length > 3) {
                        console.log(`[AnimeUnity] Simplified subtitle search: ${simpleSubtitle}`);
                        const simpleRes = yield searchAnime(simpleSubtitle);
                        if (simpleRes && simpleRes.length > 0) candidates = candidates.concat(simpleRes);
                      }
                    }
                  }
                  const mainTitle = parts[0].trim();
                  const movieQuery = `${mainTitle} Movie`;
                  console.log(`[AnimeUnity] Movie query search: ${movieQuery}`);
                  const movieRes = yield searchAnime(movieQuery);
                  if (movieRes && movieRes.length > 0) candidates = candidates.concat(movieRes);
                }
              } else {
                const movieQuery = `${title} Movie`;
                console.log(`[AnimeUnity] Movie query search: ${movieQuery}`);
                const movieRes = yield searchAnime(movieQuery);
                if (movieRes && movieRes.length > 0) candidates = candidates.concat(movieRes);
                const simpleTitle = title.replace(/\bfilm\b/gi, "").replace(/-/g, "").replace(/\s+/g, " ").trim();
                if (simpleTitle !== title && simpleTitle.length > 3) {
                  console.log(`[AnimeUnity] Simplified title search: ${simpleTitle}`);
                  const simpleRes = yield searchAnime(simpleTitle);
                  if (simpleRes && simpleRes.length > 0) candidates = candidates.concat(simpleRes);
                }
              }
              const strippedMovieTitle = title.replace(/\b(il|lo|la|the)\b/gi, " ").replace(/\b(movie|film)\b/gi, " ").replace(/[:\-]/g, " ").replace(/\s+/g, " ").trim();
              if (strippedMovieTitle.length > 3 && strippedMovieTitle.toLowerCase() !== title.toLowerCase()) {
                console.log(`[AnimeUnity] Stripped movie title search: ${strippedMovieTitle}`);
                const strippedRes = yield searchAnime(strippedMovieTitle);
                if (strippedRes && strippedRes.length > 0) candidates = candidates.concat(strippedRes);
              }
              candidates = candidates.filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i);
            }
          }
          if ((!candidates || candidates.length === 0) && originalTitle && originalTitle !== title) {
            console.log(`[AnimeUnity] No results for ${title}, trying ${originalTitle}`);
            candidates = yield searchAnime(originalTitle);
            if (candidates.length > 0) {
              const valid = candidates.some((c) => {
                if (checkSimilarity(c.title, title) || checkSimilarity(c.title_eng, title) || (checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title_eng, originalTitle))) return true;
                if (metadata.alternatives) {
                  return metadata.alternatives.some((alt) => checkSimilarity(c.title, alt.title) || checkSimilarity(c.title_eng, alt.title));
                }
                return false;
              });
              if (!valid) {
                console.log("[AnimeUnity] Original title search results seem irrelevant. Discarding.");
                candidates = [];
              }
            }
          }
          if ((!candidates || candidates.length === 0) && metadata.alternatives) {
            const altTitles = metadata.alternatives.map((t) => t.title).filter((t) => /^[a-zA-Z0-9\s\-\.\:\(\)!'&]+$/.test(t)).filter((t) => t !== title && t !== originalTitle);
            const uniqueAlts = [...new Set(altTitles)];
            for (const altTitle of uniqueAlts) {
              if (altTitle.length < 4) continue;
              console.log(`[AnimeUnity] Trying alternative title: ${altTitle}`);
              const res = yield searchAnime(altTitle);
              if (res && res.length > 0) {
                const valid = res.some((c) => {
                  if (checkSimilarity(c.title, title) || checkSimilarity(c.title_eng, title) || (checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title_eng, originalTitle))) return true;
                  if (metadata.alternatives) {
                    return metadata.alternatives.some((alt) => checkSimilarity(c.title, alt.title) || checkSimilarity(c.title_eng, alt.title));
                  }
                  return false;
                });
                if (valid) {
                  candidates = res;
                  break;
                }
              }
            }
          }
          if (!candidates || candidates.length === 0) {
            console.log("[AnimeUnity] No anime found");
            return [];
          }
          const subs = candidates.filter((c) => !(c.title || "").includes("(ITA)") && !(c.title_eng || "").includes("(ITA)"));
          const dubs = candidates.filter((c) => (c.title || "").includes("(ITA)") || (c.title_eng || "").includes("(ITA)"));
          const enrichTopCandidates = (list) => __async(null, null, function* () {
            const top = list.slice(0, 3);
            yield Promise.all(top.map((c) => __async(null, null, function* () {
              if (!c.date || c.date === "Indeterminato" || c.date === "?") {
                console.log(`[AnimeUnity] Fetching year for "${c.title}" (Date: ${c.date})`);
                const year = yield fetchAnimeYear(c.id, c.slug);
                if (year) {
                  c.date = year;
                  console.log(`[AnimeUnity] Enriched "${c.title}" with year: ${year}`);
                } else {
                  console.log(`[AnimeUnity] Failed to enrich "${c.title}" (no year found)`);
                }
              }
            })));
            return top;
          });
          if (subs.length > 0) yield enrichTopCandidates(subs);
          if (dubs.length > 0) yield enrichTopCandidates(dubs);
          const allowBypassSeasonCheck = seasonNameMatch && !seasonSearchEnabled;
          let bestSub = findBestMatch(subs, title, originalTitle, seasonForMatch, metadata, { bypassSeasonCheck: allowBypassSeasonCheck, seasonYear, seasonNames: seasonNameHints });
          let bestDub = findBestMatch(dubs, title, originalTitle, seasonForMatch, metadata, { bypassSeasonCheck: allowBypassSeasonCheck, seasonYear, seasonNames: seasonNameHints });
          const isSuspicious = (c) => {
            if (!c) return true;
            if (season === 0) {
              const t = (c.title || c.title_eng || "").toLowerCase();
              if (t.includes("special") || t.includes("oav") || t.includes("movie")) return false;
              if (["Special", "OVA", "Movie"].includes(c.type)) return false;
              return true;
            }
            if (season === 1) {
              const t = (c.title || c.title_eng || "").toLowerCase();
              if (/final\s*season/i.test(t) || /(\s|^)\d+(\s*\(ITA\))?$/i.test(t)) return true;
              if (bestSub) {
                const subT = (bestSub.title || bestSub.title_eng || "").toLowerCase().trim();
                const dubT = t.replace(/\s*\(ita\)/i, "").trim();
                if (dubT.length > subT.length + 8) return true;
                if (!dubT.includes(subT)) return true;
              }
            }
            return false;
          };
          if (!bestDub || isSuspicious(bestDub)) {
            console.log(`[AnimeUnity] Dub not found or suspicious, trying specific dub search: ${title} (ITA)`);
            const dubQuery = `${title} (ITA)`;
            const dubRes = yield searchAnime(dubQuery);
            if (dubRes && dubRes.length > 0) {
              const newDubs = dubRes.filter((c) => (c.title || "").includes("(ITA)") || (c.title_eng || "").includes("(ITA)"));
              const betterDub = findBestMatch(newDubs, title, originalTitle, seasonForMatch, metadata, { seasonYear, seasonNames: seasonNameHints });
              if (betterDub) bestDub = betterDub;
            }
          }
          if (seasonSearchEnabled) {
            const normalizeCandidateTitle2 = (candidate) => String(candidate.title || candidate.title_eng || "").toLowerCase().replace(/\s*\(ita\)\s*$/i, "").replace(/&#x27;|&#039;/g, "'").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
            const baseTitleNorm2 = String(title || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
            const baseOriginalNorm2 = String(originalTitle || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
            const isBaseEntry = (candidate) => {
              const cNorm = normalizeCandidateTitle2(candidate);
              return cNorm === baseTitleNorm2 || baseOriginalNorm2 && cNorm === baseOriginalNorm2;
            };
            const hasSeasonMarkers = (candidate) => {
              const raw = `${candidate.title || ""} ${candidate.title_eng || ""}`.toLowerCase();
              if (/season|stagione|part|parte|\b\d+\b/.test(raw)) return true;
              if (/\b(arc|saga|chapter|cour)\b|\b\w+(?:-|\s)?hen\b/.test(raw)) return true;
              if (/final\s*season/i.test(raw)) return true;
              return false;
            };
            const isRelevantCandidate = (candidate) => {
              if (checkSimilarity(candidate.title, title) || checkSimilarity(candidate.title_eng, title) || (checkSimilarity(candidate.title, originalTitle) || checkSimilarity(candidate.title_eng, originalTitle))) return true;
              if (metadata.alternatives) {
                const altSimilarity = metadata.alternatives.some(
                  (alt) => checkSimilarity(candidate.title, alt.title) || checkSimilarity(candidate.title_eng, alt.title)
                );
                if (altSimilarity) return true;
              }
              const baseTokens = /* @__PURE__ */ new Set([
                ...tokenizeForPairing(title || ""),
                ...tokenizeForPairing(originalTitle || ""),
                ...(metadata.alternatives || []).slice(0, 30).flatMap((alt) => tokenizeForPairing(alt.title || ""))
              ]);
              const candidateTokens = [
                ...tokenizeForPairing(candidate.title || ""),
                ...tokenizeForPairing(candidate.title_eng || "")
              ];
              if (candidateTokens.some((t) => baseTokens.has(t))) return true;
              return false;
            };
            const seasonTokenRegex = new RegExp(`\\b${season}\\b|season\\s*${season}|stagione\\s*${season}|part\\s*${season}|parte\\s*${season}`, "i");
            const getSeasonTokenScore = (candidate) => {
              const raw = `${candidate.title || ""} ${candidate.title_eng || ""}`;
              if (!seasonTokenRegex.test(raw)) return 0;
              if (/part\s*\d+/i.test(raw)) return 1;
              return 2;
            };
            const getYearDiff = (candidate) => {
              if (!seasonYear || !candidate || !candidate.date) return Number.MAX_SAFE_INTEGER;
              const yearMatch = String(candidate.date).match(/(\d{4})/);
              if (!yearMatch) return Number.MAX_SAFE_INTEGER;
              const y = parseInt(yearMatch[1], 10);
              if (isNaN(y)) return Number.MAX_SAFE_INTEGER;
              return Math.abs(y - seasonYear);
            };
            const isMovieLikeCandidate = (candidate) => {
              const raw = `${candidate.title || ""} ${candidate.title_eng || ""}`.toLowerCase();
              if (/\b(movie|film|special|ova|oav)\b/.test(raw)) return true;
              const cType = String(candidate.type || "").toLowerCase();
              return cType === "movie" || cType === "special" || cType === "ova";
            };
            const pickSeasonSpecific = (current, list) => {
              if (!list || list.length === 0) return current;
              const specificPool = list.filter((c) => {
                if (isBaseEntry(c) || !hasSeasonMarkers(c) || !isRelevantCandidate(c)) return false;
                if (!isMovie && isMovieLikeCandidate(c)) return false;
                return true;
              });
              if (specificPool.length === 0) return current;
              const ranked = [...specificPool].sort((a, b) => {
                const aRaw = `${a.title || ""} ${a.title_eng || ""}`.toLowerCase();
                const bRaw = `${b.title || ""} ${b.title_eng || ""}`.toLowerCase();
                const aHasPart = /part\s*\d+/i.test(aRaw);
                const bHasPart = /part\s*\d+/i.test(bRaw);
                if (aHasPart !== bHasPart) return aHasPart ? 1 : -1;
                const tokenScoreA = getSeasonTokenScore(a);
                const tokenScoreB = getSeasonTokenScore(b);
                if (tokenScoreA !== tokenScoreB) return tokenScoreB - tokenScoreA;
                const diffA = getYearDiff(a);
                const diffB = getYearDiff(b);
                if (diffA !== diffB) return diffA - diffB;
                const scoreA = Math.max(
                  checkSimilarity(a.title, `${title} ${season}`) ? 1 : 0,
                  checkSimilarity(a.title_eng, `${title} ${season}`) ? 1 : 0
                );
                const scoreB = Math.max(
                  checkSimilarity(b.title, `${title} ${season}`) ? 1 : 0,
                  checkSimilarity(b.title_eng, `${title} ${season}`) ? 1 : 0
                );
                if (scoreA !== scoreB) return scoreB - scoreA;
                return (a.title || a.title_eng || "").length - (b.title || b.title_eng || "").length;
              });
              if (!current) return ranked[0];
              if (!isRelevantCandidate(current)) return ranked[0];
              if (isBaseEntry(current) || !hasSeasonMarkers(current)) return ranked[0];
              const curRaw = `${current.title || ""} ${current.title_eng || ""}`.toLowerCase();
              const currentHasPart = /part\s*\d+/i.test(curRaw);
              const topRaw = `${ranked[0].title || ""} ${ranked[0].title_eng || ""}`.toLowerCase();
              const topHasPart = /part\s*\d+/i.test(topRaw);
              if (currentHasPart && !topHasPart) return ranked[0];
              if (getSeasonTokenScore(current) < getSeasonTokenScore(ranked[0])) return ranked[0];
              return current;
            };
            bestSub = pickSeasonSpecific(bestSub, subs);
            bestDub = pickSeasonSpecific(bestDub, dubs);
            if (bestSub && bestDub) {
              const subIsSpecific = !isBaseEntry(bestSub) && hasSeasonMarkers(bestSub);
              const dubIsBase = isBaseEntry(bestDub);
              if (subIsSpecific && dubIsBase) {
                bestDub = null;
              }
            }
          }
          if (bestSub && bestDub && !areCoherentCandidates(bestSub, bestDub, title, originalTitle)) {
            const compatibleDubs = dubs.filter((c) => areCoherentCandidates(bestSub, c, title, originalTitle));
            if (compatibleDubs.length > 0) {
              const alignedDub = findBestMatch(compatibleDubs, title, originalTitle, seasonForMatch, metadata, { seasonYear, seasonNames: seasonNameHints });
              bestDub = alignedDub || compatibleDubs[0];
            } else {
              console.log("[AnimeUnity] Discarding dub candidate due to arc/season mismatch with selected sub.");
              bestDub = null;
            }
          }
          if (seasonSearchEnabled && Array.isArray(seasonNameHints) && seasonNameHints.length > 0) {
            const normalize = (s) => String(s || "").toLowerCase().replace(/&#x27;|&#039;/g, "'").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
            const tokenize = (s) => normalize(s).split(/\s+/).filter(Boolean);
            const baseTokenSet = /* @__PURE__ */ new Set([
              ...tokenize(title),
              ...tokenize(originalTitle)
            ]);
            const genericTokens = /* @__PURE__ */ new Set(["season", "stagione", "part", "parte", "the", "and", "dei", "degli", "della"]);
            const getDistinctiveHintTokens = (hintValue) => tokenize(hintValue).filter(
              (t) => t.length >= 4 && !baseTokenSet.has(t) && !genericTokens.has(t)
            );
            const matchesSeasonHint = (candidate) => {
              if (!candidate) return false;
              const cTitle = String(candidate.title || "");
              const cTitleEn = String(candidate.title_eng || "");
              const cNorm = normalize(`${cTitle} ${cTitleEn}`);
              return seasonNameHints.some((hint) => {
                const h = String(hint || "").trim();
                if (!h) return false;
                const hNorm = normalize(h);
                if (!hNorm) return false;
                if (cNorm.includes(hNorm)) return true;
                const distinctive = getDistinctiveHintTokens(hNorm);
                if (distinctive.length === 0) return false;
                const matchedDistinctive = distinctive.filter((t) => cNorm.includes(t)).length;
                if (matchedDistinctive === 0) return false;
                const coverage = matchedDistinctive / distinctive.length;
                return coverage >= 0.75;
              });
            };
            const alignedSubs = subs.filter(matchesSeasonHint);
            const alignedDubs = dubs.filter(matchesSeasonHint);
            if (bestSub && !matchesSeasonHint(bestSub) && alignedSubs.length > 0) {
              bestSub = findBestMatch(alignedSubs, title, originalTitle, seasonForMatch, metadata, { seasonYear, seasonNames: seasonNameHints }) || alignedSubs[0];
            }
            if (bestDub && !matchesSeasonHint(bestDub) && alignedDubs.length > 0) {
              bestDub = findBestMatch(alignedDubs, title, originalTitle, seasonForMatch, metadata, { seasonYear, seasonNames: seasonNameHints }) || alignedDubs[0];
            }
          }
          if (season === 0) {
            const isSeasonZeroCandidate = (candidate) => {
              if (!candidate) return false;
              const raw = `${candidate.title || ""} ${candidate.title_eng || ""}`;
              const lower = raw.toLowerCase();
              const cType = String(candidate.type || "").toLowerCase();
              const hasSpecialMarker = cType === "special" || cType === "ova" || cType === "movie" || /\b(special|speciale|ova|oav|movie|film|recap|extra|zero|episodio\s*0|ep\s*0)\b/i.test(lower);
              if (!hasSpecialMarker) return false;
              const candidateTokens = tokenizeLooseText(raw);
              const targetPool = [
                title,
                originalTitle,
                ...(metadata.mappedTitleHints || []).slice(0, 10)
              ].filter(Boolean);
              return targetPool.some((target) => {
                const targetTokens = tokenizeLooseText(target);
                if (targetTokens.length > 0 && candidateTokens.length > 0) {
                  const matched = targetTokens.filter((t) => candidateTokens.includes(t)).length;
                  const minNeeded = Math.max(1, Math.ceil(targetTokens.length * 0.6));
                  if (matched >= minNeeded) return true;
                }
                const cNorm = normalizeLooseText(raw);
                const tNorm = normalizeLooseText(target);
                if (!tNorm) return false;
                return cNorm === tNorm || cNorm.startsWith(`${tNorm} `) || cNorm.includes(` ${tNorm} `) || cNorm.endsWith(` ${tNorm}`);
              });
            };
            if (bestSub && !isSeasonZeroCandidate(bestSub)) {
              console.log(`[AnimeUnity] Discarding SUB candidate for Season 0: ${bestSub.title || bestSub.title_eng}`);
              bestSub = null;
            }
            if (bestDub && !isSeasonZeroCandidate(bestDub)) {
              console.log(`[AnimeUnity] Discarding DUB candidate for Season 0: ${bestDub.title || bestDub.title_eng}`);
              bestDub = null;
            }
          }
          if (!bestSub && !bestDub) {
            if (title.includes("-")) {
              const dehyphenated = title.replace(/-/g, " ").replace(/\s+/g, " ").trim();
              if (dehyphenated !== title) {
                console.log(`[AnimeUnity] No match found. Retrying with dehyphenated title: ${dehyphenated}`);
                const dehyphenRes = yield searchAnime(dehyphenated);
                if (dehyphenRes && dehyphenRes.length > 0) {
                  const dhSubs = dehyphenRes.filter((c) => !(c.title || "").includes("(ITA)") && !(c.title_eng || "").includes("(ITA)"));
                  const dhDubs = dehyphenRes.filter((c) => (c.title || "").includes("(ITA)") || (c.title_eng || "").includes("(ITA)"));
                  if (dhSubs.length > 0) yield enrichTopCandidates(dhSubs);
                  if (dhDubs.length > 0) yield enrichTopCandidates(dhDubs);
                  bestSub = findBestMatch(dhSubs, title, originalTitle, seasonForMatch, metadata, { seasonYear, seasonNames: seasonNameHints });
                  bestDub = findBestMatch(dhDubs, title, originalTitle, seasonForMatch, metadata, { seasonYear, seasonNames: seasonNameHints });
                }
              }
            }
          }
          if (!bestSub && !bestDub) {
            console.log("[AnimeUnity] No suitable match found in candidates");
            return [];
          }
          const tasks = [];
          const absEpisode = calculateAbsoluteEpisode(metadata, season, episode);
          const isSeasonEntryMatch = (candidate) => {
            if (isLongSeriesAbsolute) return false;
            const rawTitle = candidate.title || candidate.title_eng || "";
            const normalizedCandidate = rawTitle.toLowerCase().replace(/\s*\(ita\)\s*$/i, "").trim();
            const normalizedTitle = (title || "").toLowerCase().trim();
            const normalizedOriginal = (originalTitle || "").toLowerCase().trim();
            const hasExplicitSeasonMarkers = /season|stagione|part|parte|\b\d+\b/i.test(candidate.title || "") || /season|stagione|part|parte|\b\d+\b/i.test(candidate.title_eng || "");
            const isBaseEntry = normalizedCandidate === normalizedTitle || normalizedOriginal && normalizedCandidate === normalizedOriginal;
            return season === 1 || seasonNameMatch || hasExplicitSeasonMarkers || season > 1 && !isBaseEntry;
          };
          const getCandidateEpisodeCount = (candidate) => {
            var _a;
            if (!candidate) return null;
            const raw = (_a = candidate.real_episodes_count) != null ? _a : candidate.episodes_count;
            const n = parseInt(raw, 10);
            return Number.isInteger(n) && n > 0 ? n : null;
          };
          const getPartIndexFromCandidate = (candidate) => {
            const raw = `${(candidate == null ? void 0 : candidate.title) || ""} ${(candidate == null ? void 0 : candidate.title_eng) || ""}`.toLowerCase();
            let match = raw.match(/\bpart(?:e)?\s*(\d+)\b/i);
            if (match) return parseInt(match[1], 10);
            match = raw.match(/\b(\d+)(?:st|nd|rd|th)\s*part\b/i);
            if (match) return parseInt(match[1], 10);
            match = raw.match(/\bcour\s*(\d+)\b/i);
            if (match) return parseInt(match[1], 10);
            match = raw.match(/\b(\d+)(?:st|nd|rd|th)\s*cour\b/i);
            if (match) return parseInt(match[1], 10);
            return null;
          };
          const resolveSplitCourCandidate = (current, pool, requestedEpisode, label) => {
            if (!current || !Array.isArray(pool) || season <= 1) {
              return { candidate: current, mappedEpisode: requestedEpisode };
            }
            const reqEp = parseInt(requestedEpisode, 10);
            if (!Number.isInteger(reqEp) || reqEp <= 0) {
              return { candidate: current, mappedEpisode: requestedEpisode };
            }
            const currentCount = getCandidateEpisodeCount(current);
            if (currentCount && reqEp <= currentCount) {
              return { candidate: current, mappedEpisode: requestedEpisode };
            }
            const seasonTokenRegex = new RegExp(`\\b${season}\\b|season\\s*${season}|stagione\\s*${season}|part\\s*${season}|parte\\s*${season}`, "i");
            const splitTokenRegex = /\b(part|parte|cour|arc|saga|chapter)\b|\b\w+(?:-|\s)?hen\b/i;
            const extractYear = (candidate) => {
              const yearMatch = String((candidate == null ? void 0 : candidate.date) || "").match(/(\d{4})/);
              if (!yearMatch) return null;
              const y = parseInt(yearMatch[1], 10);
              return Number.isInteger(y) ? y : null;
            };
            const partMap = /* @__PURE__ */ new Map();
            for (const c of pool) {
              if (!c) continue;
              const combined = `${c.title || ""} ${c.title_eng || ""}`;
              const hasSeasonToken = seasonTokenRegex.test(combined);
              const isRelevantSeries = checkSimilarity(c.title, title) || checkSimilarity(c.title_eng, title) || checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title_eng, originalTitle) || isRelevantByLooseMatch(combined);
              if (!hasSeasonToken && !isRelevantSeries && c.id !== current.id) continue;
              const count = getCandidateEpisodeCount(c);
              if (!count) continue;
              let part = getPartIndexFromCandidate(c);
              if (!part && c.id === current.id) part = 1;
              if (!part) continue;
              let score = 0;
              if (c.id === current.id) score += 4;
              if (checkSimilarity(c.title, title) || checkSimilarity(c.title_eng, title)) score += 2;
              if (checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title_eng, originalTitle)) score += 2;
              if (/(part|parte|cour)\s*\d+/i.test(combined)) score += 1;
              const prev = partMap.get(part);
              if (!prev || score > prev.score) {
                partMap.set(part, { candidate: c, count, score, part });
              }
            }
            const trySequentialFallback = (startCandidate) => {
              const startCount = getCandidateEpisodeCount(startCandidate);
              if (!startCount || reqEp <= startCount) return null;
              let remaining = reqEp - startCount;
              let cursor = startCandidate;
              const usedIds = /* @__PURE__ */ new Set([startCandidate.id]);
              const pickNext = (fromCandidate) => {
                const fromYear = extractYear(fromCandidate);
                let best = null;
                for (const c of pool) {
                  if (!c || !c.id || usedIds.has(c.id) || c.id === fromCandidate.id) continue;
                  const count = getCandidateEpisodeCount(c);
                  if (!count) continue;
                  const combined = `${c.title || ""} ${c.title_eng || ""}`;
                  const lower = combined.toLowerCase();
                  if (/\b(movie|film|special|ova|oav|recap)\b/i.test(lower)) continue;
                  const hasSeasonToken = seasonTokenRegex.test(combined);
                  const hasSplitToken = splitTokenRegex.test(combined);
                  const hasPartToken = /(part|parte|cour)\s*\d+/i.test(lower);
                  const isRelevantSeries = checkSimilarity(c.title, title) || checkSimilarity(c.title_eng, title) || checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title_eng, originalTitle) || isRelevantByLooseMatch(combined);
                  if (!isRelevantSeries) continue;
                  if (!hasSeasonToken && !hasSplitToken && !hasPartToken) continue;
                  const cYear = extractYear(c);
                  const seasonDiff = Number.isInteger(cYear) && Number.isInteger(seasonYear) ? Math.abs(cYear - seasonYear) : Number.MAX_SAFE_INTEGER;
                  const fromDiff = Number.isInteger(cYear) && Number.isInteger(fromYear) ? Math.abs(cYear - fromYear) : Number.MAX_SAFE_INTEGER;
                  let score = 0;
                  if (hasSeasonToken) score += 4;
                  if (hasPartToken) score += 3;
                  if (hasSplitToken) score += 2;
                  if (checkSimilarity(c.title, title) || checkSimilarity(c.title_eng, title)) score += 2;
                  if (checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title_eng, originalTitle)) score += 2;
                  if (Array.isArray(seasonNameHints) && seasonNameHints.some((h) => checkSimilarity(c.title, h) || checkSimilarity(c.title_eng, h))) score += 1;
                  if (fromDiff === 0) score += 2;
                  else if (fromDiff === 1) score += 1;
                  if (!best || score > best.score || score === best.score && fromDiff < best.fromDiff || score === best.score && fromDiff === best.fromDiff && seasonDiff < best.seasonDiff || score === best.score && fromDiff === best.fromDiff && seasonDiff === best.seasonDiff && combined.length < best.length) {
                    best = { candidate: c, score, fromDiff, seasonDiff, length: combined.length };
                  }
                }
                return best ? best.candidate : null;
              };
              while (remaining > 0) {
                const nextCandidate = pickNext(cursor);
                if (!nextCandidate) break;
                usedIds.add(nextCandidate.id);
                const nextCount = getCandidateEpisodeCount(nextCandidate);
                if (!nextCount) continue;
                if (remaining <= nextCount) {
                  return { candidate: nextCandidate, mappedEpisode: remaining };
                }
                remaining -= nextCount;
                cursor = nextCandidate;
              }
              return null;
            };
            if (partMap.size > 0) {
              const orderedParts = [...partMap.values()].sort((a, b) => a.part - b.part);
              let remaining = reqEp;
              for (const entry of orderedParts) {
                if (remaining <= entry.count) {
                  if (entry.candidate.id !== current.id || remaining !== reqEp) {
                    console.log(`[AnimeUnity] Split-cour switch for ${label}: "${current.title || current.title_eng}" -> "${entry.candidate.title || entry.candidate.title_eng}", mapped episode ${reqEp} -> ${remaining}`);
                  }
                  return { candidate: entry.candidate, mappedEpisode: remaining };
                }
                remaining -= entry.count;
              }
            }
            const sequentialFallback = trySequentialFallback(current);
            if (sequentialFallback) {
              console.log(`[AnimeUnity] Split-cour switch for ${label}: "${current.title || current.title_eng}" -> "${sequentialFallback.candidate.title || sequentialFallback.candidate.title_eng}", mapped episode ${reqEp} -> ${sequentialFallback.mappedEpisode}`);
              return sequentialFallback;
            }
            return { candidate: current, mappedEpisode: requestedEpisode };
          };
          let resolvedSubEpisode = episode;
          let resolvedDubEpisode = episode;
          if (bestSub && !isLongSeriesAbsolute) {
            const resolved = resolveSplitCourCandidate(bestSub, subs, episode, "SUB");
            bestSub = resolved.candidate;
            resolvedSubEpisode = resolved.mappedEpisode;
          }
          if (bestDub && !isLongSeriesAbsolute) {
            const resolved = resolveSplitCourCandidate(bestDub, dubs, episode, "DUB");
            bestDub = resolved.candidate;
            resolvedDubEpisode = resolved.mappedEpisode;
          }
          if (bestSub) {
            console.log(`[AnimeUnity] Found SUB match: ${bestSub.title || bestSub.title_eng} (ID: ${bestSub.id})`);
            const isSeasonEntry = isSeasonEntryMatch(bestSub);
            const epToUse = isSeasonEntry ? resolvedSubEpisode : absEpisode;
            console.log(`[AnimeUnity] Using episode ${epToUse} for SUB (Is Season Entry: ${isSeasonEntry})`);
            tasks.push(getEpisodeStreams(bestSub, epToUse, "SUB ITA", isMovie));
          }
          if (bestDub) {
            console.log(`[AnimeUnity] Found DUB match: ${bestDub.title || bestDub.title_eng} (ID: ${bestDub.id})`);
            const isSeasonEntry = isSeasonEntryMatch(bestDub);
            const epToUse = isSeasonEntry ? resolvedDubEpisode : absEpisode;
            console.log(`[AnimeUnity] Using episode ${epToUse} for DUB (Is Season Entry: ${isSeasonEntry})`);
            tasks.push(getEpisodeStreams(bestDub, epToUse, "ITA", isMovie));
          }
          const results = yield Promise.all(tasks);
          return results.flat();
        } catch (e) {
          console.error("[AnimeUnity] Error:", e);
          return [];
        }
      });
    }
    function getEpisodeStreams(anime, episodeNumber, langTag = "", isMovie = false) {
      return __async(this, null, function* () {
        try {
          const animeUrl = `${BASE_URL}/anime/${anime.id}-${anime.slug}`;
          const animeResponse = yield fetch(animeUrl, {
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": BASE_URL
            }
          });
          if (!animeResponse.ok) {
            console.error(`[AnimeUnity] Failed to fetch anime page for ${anime.title}`);
            return [];
          }
          const animeHtml = yield animeResponse.text();
          const episodesRegex = /<video-player[^>]*episodes="([^"]*)"/gi;
          let episodesMatch;
          let allEpisodes = [];
          while ((episodesMatch = episodesRegex.exec(animeHtml)) !== null) {
            try {
              const chunk = JSON.parse(episodesMatch[1].replace(/&quot;/g, '"'));
              allEpisodes = allEpisodes.concat(chunk);
            } catch (e) {
              console.error("[AnimeUnity] Error parsing episode chunk:", e);
            }
          }
          if (allEpisodes.length === 0) {
            console.error(`[AnimeUnity] No episodes found in page for ${anime.title}`);
            return [];
          }
          let episodes = allEpisodes;
          const episodesCountRegex = /episodes_count="(\d+)"/i;
          const countMatch = episodesCountRegex.exec(animeHtml);
          const totalEpisodes = countMatch ? parseInt(countMatch[1]) : episodes.length;
          let targetEpisode;
          if (isMovie && episodes.length > 0) {
            targetEpisode = episodes[0];
          } else {
            targetEpisode = episodes.find((ep) => ep.number == episodeNumber);
          }
          if (!targetEpisode && !isMovie && totalEpisodes > episodes.length) {
            console.log(`[AnimeUnity] Episode ${episodeNumber} not found in initial list. Checking API...`);
            const startRange = Math.floor((episodeNumber - 1) / 120) * 120 + 1;
            const endRange = startRange + 119;
            if (startRange > episodes.length || startRange <= episodes.length && episodeNumber > episodes[episodes.length - 1].number) {
              try {
                const apiUrl = `${BASE_URL}/info_api/${anime.id}/1?start_range=${startRange}&end_range=${endRange}`;
                console.log(`[AnimeUnity] Fetching episodes range: ${startRange}-${endRange}`);
                const apiResponse = yield fetch(apiUrl, {
                  headers: {
                    "User-Agent": USER_AGENT,
                    "X-Requested-With": "XMLHttpRequest",
                    "Referer": animeUrl
                  }
                });
                if (apiResponse.ok) {
                  const json = yield apiResponse.json();
                  if (json.episodes && Array.isArray(json.episodes)) {
                    episodes = episodes.concat(json.episodes);
                    targetEpisode = episodes.find((ep) => ep.number == episodeNumber);
                    if (targetEpisode) {
                      console.log(`[AnimeUnity] Found episode ${episodeNumber} via API`);
                    }
                  }
                } else {
                  console.error(`[AnimeUnity] API fetch failed: ${apiResponse.status}`);
                }
              } catch (e) {
                console.error(`[AnimeUnity] Error fetching additional episodes:`, e);
              }
            }
          }
          if (!targetEpisode) {
            console.log(`[AnimeUnity] Episode ${episodeNumber} not found in ${anime.title}. Total eps: ${episodes.length}`);
            if (episodes.length > 0) {
              console.log(`First ep: ${episodes[0].number}, Last ep: ${episodes[episodes.length - 1].number}`);
            }
            return [];
          }
          const streams = [];
          const labelSuffix = langTag ? ` [${langTag}]` : "";
          const resolvedEpisodeNumber = targetEpisode.number || episodeNumber || 1;
          const extractQuality = (str) => {
            if (!str) return "Unknown";
            const match = str.match(/(\d{3,4}p)/i);
            return match ? match[1] : "Unknown";
          };
          if (targetEpisode.link && targetEpisode.link.startsWith("http")) {
            const blockedDomains = ["jujutsukaisenanime.com", "onepunchman.it", "dragonballhd.it", "narutolegend.it"];
            const lowerLink = targetEpisode.link.toLowerCase();
            if (lowerLink.endsWith(".mkv.mp4") || blockedDomains.some((d) => lowerLink.includes(d))) {
              console.log(`[AnimeUnity] Skipping unwanted link: ${targetEpisode.link}`);
            } else {
              let quality = extractQuality(targetEpisode.link);
              if (quality === "Unknown") quality = extractQuality(targetEpisode.file_name);
              if (targetEpisode.link.includes(".m3u8")) {
                const detected = yield checkQualityFromPlaylist(targetEpisode.link, {
                  "User-Agent": USER_AGENT,
                  "Referer": BASE_URL
                });
                if (detected) quality = detected;
              }
              const displayTitle = (anime.title || anime.title_eng || "Unknown Title") + ` - Ep ${resolvedEpisodeNumber}${labelSuffix}`;
              streams.push({
                name: "AnimeUnity" + labelSuffix,
                title: displayTitle,
                url: targetEpisode.link,
                quality,
                type: "direct",
                headers: {
                  "User-Agent": USER_AGENT,
                  "Referer": BASE_URL
                }
              });
            }
          }
          if (targetEpisode.scws_id) {
            try {
              const embedApiUrl = `${BASE_URL}/embed-url/${targetEpisode.id}`;
              const embedResponse = yield fetch(embedApiUrl, {
                headers: {
                  "User-Agent": USER_AGENT,
                  "Referer": animeUrl,
                  "X-Requested-With": "XMLHttpRequest"
                }
              });
              if (embedResponse.ok) {
                const embedUrl = yield embedResponse.text();
                if (embedUrl && embedUrl.startsWith("http")) {
                  const vixStreams = yield extractVixCloud(embedUrl);
                  if (vixStreams && vixStreams.length > 0) {
                    const displayTitle = (anime.title || anime.title_eng || "Unknown Title") + ` - Ep ${resolvedEpisodeNumber}${labelSuffix}`;
                    streams.push(...vixStreams.map((s) => __spreadProps(__spreadValues({}, s), {
                      name: "AnimeUnity - VixCloud" + labelSuffix,
                      title: displayTitle
                    })));
                  }
                }
              }
            } catch (e) {
              console.error("[AnimeUnity] VixCloud extraction error:", e);
            }
          }
          return streams.map((s) => formatStream(s, "AnimeUnity")).filter((s) => s !== null);
        } catch (e) {
          console.error(`[AnimeUnity] Error extracting streams for ${anime.title}:`, e);
          return [];
        }
      });
    }
    module2.exports = { getStreams: getStreams2, getMetadata, searchAnime };
  }
});

// src/animeworld/index.js
var require_animeworld = __commonJS({
  "src/animeworld/index.js"(exports2, module2) {
    var { getTmdbFromKitsu: getTmdbFromKitsu2, isAnime } = require_tmdb_helper();
    require_fetch_helper();
    var { formatStream } = require_formatter();
    var { checkQualityFromPlaylist } = require_quality_helper();
    var BASE_URL = "https://www.animeworld.ac";
    var TMDB_API_KEY2 = "68e094699525b18a70bab2f86b1fa706";
    var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    function getMetadata(id, type, requestedSeason = null, prefetchedMapping = null) {
      return __async(this, null, function* () {
        try {
          const normalizedType = String(type).toLowerCase();
          const parsedRequestedSeason = Number.parseInt(requestedSeason, 10);
          const isSpecialSeasonRequest = Number.isInteger(parsedRequestedSeason) && parsedRequestedSeason === 0;
          const allowMovieFallback = normalizedType === "movie" || isSpecialSeasonRequest;
          let tmdbId = id;
          let mappedSeason = null;
          let mappedSeasonName = null;
          let mappedTitleHints = [];
          let longSeries = false;
          let episodeMode = null;
          let mappedSeasons = [];
          let seriesSeasonCount = null;
          const mergeHints = (base, incoming) => {
            const joined = [...Array.isArray(base) ? base : [], ...Array.isArray(incoming) ? incoming : []].map((x) => String(x || "").trim()).filter(Boolean);
            return [...new Set(joined)];
          };
          const isMeaningfulSeasonName2 = (name) => {
            const clean = String(name || "").trim();
            if (!clean) return false;
            if (/^Season\s+\d+$/i.test(clean)) return false;
            if (/^Stagione\s+\d+$/i.test(clean)) return false;
            return true;
          };
          const applyMappingHints = (payload) => {
            if (!payload || typeof payload !== "object") return;
            if (payload.tmdbId) {
              tmdbId = payload.tmdbId;
            }
            const parsedSeason = parseInt(payload.season, 10);
            if (Number.isInteger(parsedSeason) && parsedSeason >= 0) {
              mappedSeason = parsedSeason;
            }
            if (isMeaningfulSeasonName2(payload.seasonName)) {
              mappedSeasonName = String(payload.seasonName).trim();
            }
            mappedTitleHints = mergeHints(mappedTitleHints, payload.titleHints);
            if (typeof payload.longSeries === "boolean") {
              longSeries = payload.longSeries;
            }
            if (payload.episodeMode) {
              const mode = String(payload.episodeMode).trim().toLowerCase();
              if (mode) episodeMode = mode;
            }
            if (Array.isArray(payload.mappedSeasons)) {
              const normalized = payload.mappedSeasons.map((n) => parseInt(n, 10)).filter((n) => Number.isInteger(n) && n > 0);
              if (normalized.length > 0) {
                mappedSeasons = [...new Set(normalized)].sort((a, b) => a - b);
              }
            }
            const parsedSeriesCount = parseInt(payload.seriesSeasonCount, 10);
            if (Number.isInteger(parsedSeriesCount) && parsedSeriesCount > 0) {
              seriesSeasonCount = parsedSeriesCount;
            }
          };
          const normalizePrefetchedMapping = (payload) => {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            if (!payload || typeof payload !== "object") return null;
            return {
              tmdbId: (_b = (_a = payload.tmdbId) != null ? _a : payload.tmdb_id) != null ? _b : null,
              season: (_d = (_c = payload.mappedSeason) != null ? _c : payload.season) != null ? _d : null,
              seasonName: (_f = (_e = payload.mappedSeasonName) != null ? _e : payload.seasonName) != null ? _f : null,
              titleHints: (_h = (_g = payload.mappedTitleHints) != null ? _g : payload.titleHints) != null ? _h : [],
              longSeries: payload.longSeries,
              episodeMode: payload.episodeMode,
              mappedSeasons: payload.mappedSeasons,
              seriesSeasonCount: payload.seriesSeasonCount
            };
          };
          const prefetchedPayload = normalizePrefetchedMapping(prefetchedMapping);
          const hasPrefetchedTmdb = !!(prefetchedPayload && String(prefetchedPayload.tmdbId || "").trim());
          if (prefetchedPayload) {
            applyMappingHints(prefetchedPayload);
          }
          if (String(id).startsWith("kitsu:")) {
            if (hasPrefetchedTmdb) {
              console.log(`[AnimeWorld] Using prefetched mapping for ${id} -> TMDB ${tmdbId} (Mapped Season: ${mappedSeason})`);
            } else {
              const resolved = yield getTmdbFromKitsu2(id);
              if (resolved && resolved.tmdbId) {
                applyMappingHints({
                  tmdbId: resolved.tmdbId,
                  season: resolved.season,
                  seasonName: resolved.tmdbSeasonTitle,
                  titleHints: resolved.titleHints,
                  longSeries: resolved.longSeries,
                  episodeMode: resolved.episodeMode,
                  mappedSeasons: resolved.mappedSeasons,
                  seriesSeasonCount: resolved.seriesSeasonCount
                });
                console.log(`[AnimeWorld] Resolved Kitsu ID ${id} to TMDB ID ${tmdbId} (Mapped Season: ${mappedSeason})`);
              } else {
                console.error(`[AnimeWorld] Failed to resolve Kitsu ID ${id}`);
                return null;
              }
            }
          }
          if (String(id).startsWith("tmdb:")) {
            tmdbId = String(id).replace("tmdb:", "");
          }
          if (String(tmdbId).startsWith("tt")) {
            if (String(tmdbId).startsWith("tt")) {
              const findUrl = `https://api.themoviedb.org/3/find/${tmdbId}?api_key=${TMDB_API_KEY2}&external_source=imdb_id&language=it-IT`;
              const findResponse = yield fetch(findUrl);
              if (!findResponse.ok) return null;
              const findData = yield findResponse.json();
              const results = normalizedType === "movie" ? findData.movie_results : findData.tv_results;
              if (!results || results.length === 0) return null;
              tmdbId = results[0].id;
            }
          }
          let endpoint = normalizedType === "movie" ? "movie" : "tv";
          let detailsResponse = yield fetch(`https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY2}&language=it-IT`);
          if (!detailsResponse.ok) {
            if (endpoint === "tv" && !allowMovieFallback) {
              console.log(`[AnimeWorld] TMDB TV metadata not found for ${tmdbId}; skipping movie fallback for ${normalizedType} Season ${requestedSeason}`);
              return null;
            }
            endpoint = endpoint === "movie" ? "tv" : "movie";
            detailsResponse = yield fetch(`https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY2}&language=it-IT`);
            if (!detailsResponse.ok) return null;
          }
          const details = yield detailsResponse.json();
          let imdb_id = details.imdb_id;
          if (!imdb_id && endpoint === "tv") {
            const externalUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/external_ids?api_key=${TMDB_API_KEY2}`;
            const extResponse = yield fetch(externalUrl);
            if (extResponse.ok) {
              const extData = yield extResponse.json();
              imdb_id = extData.imdb_id;
            }
          }
          let alternatives = [];
          try {
            const altUrl = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}/alternative_titles?api_key=${TMDB_API_KEY2}`;
            const altResponse = yield fetch(altUrl);
            if (altResponse.ok) {
              const altData = yield altResponse.json();
              alternatives = altData.titles || altData.results || [];
            }
          } catch (e) {
            console.error("[AnimeWorld] Alt titles fetch error:", e);
          }
          let seasonName = mappedSeasonName;
          if (mappedSeason && details.seasons) {
            const targetSeason = details.seasons.find((s) => s.season_number === mappedSeason);
            if (targetSeason && targetSeason.name && !targetSeason.name.includes("Stagione") && !targetSeason.name.includes("Season")) {
              seasonName = targetSeason.name;
            }
          }
          return __spreadProps(__spreadValues({}, details), {
            imdb_id,
            tmdb_id: tmdbId,
            alternatives,
            mappedSeason,
            seasonName,
            mappedTitleHints,
            longSeries,
            episodeMode,
            mappedSeasons,
            seriesSeasonCount
          });
        } catch (e) {
          console.error("[AnimeWorld] Metadata error:", e);
          return null;
        }
      });
    }
    function getSeasonMetadata(id, season, language = "it-IT") {
      return __async(this, null, function* () {
        try {
          const url = `https://api.themoviedb.org/3/tv/${id}/season/${season}?api_key=${TMDB_API_KEY2}&language=${encodeURIComponent(language)}`;
          const response = yield fetch(url);
          if (!response.ok) return null;
          return yield response.json();
        } catch (e) {
          return null;
        }
      });
    }
    function calculateAbsoluteEpisode(metadata, season, episode) {
      if (!metadata || !metadata.seasons || season === 1) return episode;
      let absoluteEpisode = parseInt(episode);
      for (const s of metadata.seasons) {
        if (s.season_number > 0 && s.season_number < season) {
          absoluteEpisode += s.episode_count;
        }
      }
      return absoluteEpisode;
    }
    var getSimilarityScore = (candTitle, targetTitle) => {
      if (!targetTitle) return 0;
      const normalize = (s) => String(s).toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
      const t1 = normalize(candTitle);
      const t2 = normalize(targetTitle);
      if (t1.length < 2 || t2.length < 2) return 0;
      const extractNumbers = (str) => {
        const matches2 = str.match(/\d+/g);
        return matches2 ? matches2.map(Number) : [];
      };
      const nums1 = extractNumbers(t1);
      const nums2 = extractNumbers(t2);
      if (nums1.length > 0 && nums2.length > 0) {
        const hasOverlap = nums1.some((n) => nums2.includes(n));
        if (!hasOverlap) return 0;
      } else if (nums2.length === 0 && nums1.length > 0) {
        const invalidExtra = nums1.some((n) => n > 1 && n < 1900);
        if (invalidExtra) return 0;
      }
      const stopWords = /* @__PURE__ */ new Set([
        // English
        "the",
        "a",
        "an",
        "and",
        "or",
        "of",
        "to",
        "in",
        "on",
        "at",
        "by",
        "for",
        "with",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        // Italian
        "il",
        "lo",
        "la",
        "i",
        "gli",
        "le",
        "un",
        "uno",
        "una",
        "e",
        "o",
        "di",
        "a",
        "da",
        "in",
        "con",
        "su",
        "per",
        "tra",
        "fra",
        "che",
        "no",
        // Common Metadata
        "movie",
        "film",
        "ita",
        "sub",
        "dub",
        "serie",
        "tv"
      ]);
      const numberWords = {
        "one": 1,
        "first": 1,
        "i": 1,
        "two": 2,
        "second": 2,
        "ii": 2,
        "three": 3,
        "third": 3,
        "iii": 3,
        "four": 4,
        "fourth": 4,
        "iv": 4,
        "five": 5,
        "fifth": 5,
        "v": 5,
        "six": 6,
        "sixth": 6,
        "vi": 6,
        "seven": 7,
        "seventh": 7,
        "vii": 7,
        "eight": 8,
        "eighth": 8,
        "viii": 8,
        "nine": 9,
        "ninth": 9,
        "ix": 9,
        "ten": 10,
        "tenth": 10,
        "x": 10
      };
      const tokenize = (x) => x.split(/\s+/).filter((w) => {
        const word = w.toLowerCase();
        if (/^\d+$/.test(word)) return true;
        if (stopWords.has(word)) return false;
        return w.length > 1 || numberWords[word];
      });
      const w1 = tokenize(t1);
      const w2 = tokenize(t2);
      if (w1.length === 0 || w2.length === 0) return 0;
      let matches = 0;
      let textMatches = 0;
      const unique1 = [...w1];
      const unique2 = [...w2];
      for (let i = unique1.length - 1; i >= 0; i--) {
        const token = unique1[i];
        const idx = unique2.indexOf(token);
        if (idx !== -1) {
          matches++;
          if (!/^\d+$/.test(token)) textMatches++;
          unique1.splice(i, 1);
          unique2.splice(idx, 1);
        }
      }
      const extractNums = (tokens) => {
        const nums = /* @__PURE__ */ new Set();
        tokens.forEach((t) => {
          if (/^\d+$/.test(t)) nums.add(parseInt(t));
          else if (numberWords[t]) nums.add(numberWords[t]);
        });
        return nums;
      };
      const n1 = extractNums(unique1);
      const n2 = extractNums(unique2);
      if (n1.size > 0 && n2.size > 0) {
        return 0;
      }
      const hasText = w2.some((w) => !/^\d+$/.test(w));
      if (hasText && textMatches === 0) return 0;
      const score = 2 * matches / (w1.length + w2.length);
      return score;
    };
    var checkSimilarity = (candTitle, targetTitle) => {
      return getSimilarityScore(candTitle, targetTitle) >= 0.6;
    };
    function normalizeLooseText(text) {
      return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/&#x27;|&#039;/g, "'").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    }
    function tokenizeLooseText(text) {
      const stopWords = /* @__PURE__ */ new Set([
        "the",
        "a",
        "an",
        "and",
        "or",
        "of",
        "to",
        "in",
        "on",
        "at",
        "by",
        "for",
        "with",
        "il",
        "lo",
        "la",
        "i",
        "gli",
        "le",
        "un",
        "uno",
        "una",
        "e",
        "o",
        "di",
        "da",
        "con",
        "season",
        "stagione",
        "part",
        "parte",
        "movie",
        "film",
        "tv",
        "ita",
        "sub"
      ]);
      return normalizeLooseText(text).split(" ").map((t) => t.replace(/([aeiou])\1+/g, "$1")).filter((t) => t.length > 2 && !stopWords.has(t));
    }
    function hasLooseOverlap(candidateTitle, targetTitle) {
      const cTokens = tokenizeLooseText(candidateTitle);
      const tTokens = tokenizeLooseText(targetTitle);
      if (cTokens.length === 0 || tTokens.length === 0) return false;
      return cTokens.some((ct) => ct.length >= 6 && tTokens.includes(ct));
    }
    function isLooselyRelevant(candidateTitle, targets = []) {
      return targets.some((t) => hasLooseOverlap(candidateTitle, t));
    }
    function splitTitleForMovieHint(rawTitle) {
      const raw = String(rawTitle || "").trim();
      if (!raw) return { base: "", subtitle: "" };
      const separators = [" - ", " \u2013 ", " \u2014 ", ":"];
      let splitIndex = -1;
      let splitLength = 0;
      for (const sep of separators) {
        const idx = raw.lastIndexOf(sep);
        if (idx > splitIndex) {
          splitIndex = idx;
          splitLength = sep.length;
        }
      }
      if (splitIndex < 0) {
        return { base: raw, subtitle: "" };
      }
      return {
        base: raw.slice(0, splitIndex).trim(),
        subtitle: raw.slice(splitIndex + splitLength).trim()
      };
    }
    function extractMovieSubtitleHints(titles = []) {
      const baseTokens = /* @__PURE__ */ new Set();
      const subtitleTokens = /* @__PURE__ */ new Set();
      for (const rawTitle of titles) {
        const { base, subtitle } = splitTitleForMovieHint(rawTitle);
        const baseSource = base || rawTitle;
        tokenizeLooseText(baseSource).forEach((token) => baseTokens.add(token));
        tokenizeLooseText(subtitle).forEach((token) => subtitleTokens.add(token));
      }
      return [...subtitleTokens].filter(
        (token) => token.length >= 4 && !baseTokens.has(token) && !/^\d+$/.test(token)
      );
    }
    function candidateMatchesMovieSubtitleHints(candidate, hints = []) {
      if (!candidate || !Array.isArray(hints) || hints.length === 0) return true;
      const raw = `${candidate.title || ""} ${candidate.title_eng || ""}`.trim();
      if (!raw) return false;
      const tokenSet = new Set(tokenizeLooseText(raw));
      if (hints.some((h) => tokenSet.has(h))) return true;
      const rawNorm = normalizeLooseText(raw);
      return hints.some((h) => rawNorm.includes(h));
    }
    function tokenizeForPairing(text) {
      const normalized = String(text || "").toLowerCase().replace(/\(ita\)|\(sub ita\)|\[ita\]|\[sub ita\]/g, " ").replace(/&#x27;|&#039;/g, "'").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
      if (!normalized) return [];
      const stopWords = /* @__PURE__ */ new Set([
        "the",
        "a",
        "an",
        "and",
        "or",
        "of",
        "to",
        "in",
        "on",
        "at",
        "by",
        "for",
        "with",
        "il",
        "lo",
        "la",
        "i",
        "gli",
        "le",
        "un",
        "uno",
        "una",
        "e",
        "o",
        "di",
        "da",
        "con",
        "season",
        "stagione",
        "part",
        "parte",
        "movie",
        "film",
        "tv",
        "ita",
        "sub",
        "arc",
        "hen"
      ]);
      return normalized.split(" ").filter((t) => t.length > 2 && !stopWords.has(t));
    }
    function areCoherentCandidates(a, b, title, originalTitle) {
      if (!a || !b) return true;
      const aTitle = String(a.title || "").trim();
      const bTitle = String(b.title || "").trim();
      if (!aTitle || !bTitle) return true;
      const normalize = (str) => String(str || "").toLowerCase().replace(/\(ita\)|\(sub ita\)|\[ita\]|\[sub ita\]/g, " ").replace(/&#x27;|&#039;/g, "'").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
      const aNorm = normalize(aTitle);
      const bNorm = normalize(bTitle);
      if (!aNorm || !bNorm) return true;
      if (aNorm === bNorm) return true;
      if (!checkSimilarity(aTitle, bTitle) && !checkSimilarity(bTitle, aTitle)) return false;
      const baseTokens = /* @__PURE__ */ new Set([
        ...tokenizeForPairing(title || ""),
        ...tokenizeForPairing(originalTitle || "")
      ]);
      const aSpecific = tokenizeForPairing(aTitle).filter((t) => !baseTokens.has(t));
      const bSpecific = tokenizeForPairing(bTitle).filter((t) => !baseTokens.has(t));
      if (aSpecific.length === 0 || bSpecific.length === 0) return true;
      return aSpecific.some((t) => bSpecific.includes(t));
    }
    function findBestMatch(candidates, title, originalTitle, season, metadata, options = {}) {
      if (!candidates || candidates.length === 0) return null;
      let isTv = !!metadata.name;
      let appliedSeasonYearFilter = false;
      if (metadata.type === "movie" || metadata.genres && metadata.genres.some((g) => (g.name || "").toLowerCase() === "movie")) {
        isTv = false;
      } else if (metadata.title && !metadata.name) {
        isTv = false;
      }
      const normTitle = title.toLowerCase().trim();
      const normOriginal = originalTitle ? originalTitle.toLowerCase().trim() : "";
      const metaYear = metadata.first_air_date ? parseInt(metadata.first_air_date.substring(0, 4)) : metadata.release_date ? parseInt(metadata.release_date.substring(0, 4)) : null;
      const preYearExactMatches = candidates.filter((c) => {
        const t = (c.title || "").toLowerCase().trim();
        const tClean = t.replace(/\s*\(ita\)$/i, "").trim();
        return t === normTitle || tClean === normTitle || normOriginal && (t === normOriginal || tClean === normOriginal);
      });
      if (metaYear && (season === 1 || !isTv)) {
        const yearFiltered = candidates.filter((c) => {
          let bestScore = 0;
          const s1 = getSimilarityScore(c.title, title);
          bestScore = Math.max(bestScore, s1);
          const s2 = getSimilarityScore(c.title, originalTitle);
          bestScore = Math.max(bestScore, s2);
          if (season && season > 1) {
            const s3 = getSimilarityScore(c.title, `${title} ${season}`);
            const s4 = getSimilarityScore(c.title, `${originalTitle} ${season}`);
            bestScore = Math.max(bestScore, s3, s4);
          }
          if (options.seasonName) {
            const s5 = getSimilarityScore(c.title, options.seasonName);
            const s6 = getSimilarityScore(c.title, `${title} ${options.seasonName}`);
            const s7 = getSimilarityScore(c.title, `${originalTitle} ${options.seasonName}`);
            bestScore = Math.max(bestScore, s5, s6, s7);
          }
          if (c.matchedAltTitle) {
            const s3 = getSimilarityScore(c.title, c.matchedAltTitle);
            bestScore = Math.max(bestScore, s3);
          }
          if (bestScore < 0.8 && metadata.alternatives && metadata.alternatives.length > 0) {
            const alts = metadata.alternatives.slice(0, 30);
            for (const alt of alts) {
              const s = getSimilarityScore(c.title, alt.title);
              if (s > bestScore) bestScore = s;
              if (bestScore >= 0.9) break;
            }
          }
          c.similarityScore = bestScore;
          if (!c.date) {
            if (!isTv) {
              const isSimilar = bestScore >= 0.6;
              let isSpecialMatch = false;
              const cTitleNorm = c.title.toLowerCase();
              if (title.includes(":")) {
                const parts = title.split(":");
                const sub = parts[parts.length - 1].trim().toLowerCase();
                if (sub.length > 2 && cTitleNorm.includes(sub)) {
                  const main = parts[0].trim().toLowerCase().replace("film", "").replace("movie", "").trim();
                  if (main.length > 3 && cTitleNorm.includes(main)) {
                    isSpecialMatch = true;
                  } else if (main.length <= 3) {
                    isSpecialMatch = true;
                  }
                }
              }
              if (!isSpecialMatch && cTitleNorm.includes(":")) {
                const parts = cTitleNorm.split(":");
                const sub = parts[parts.length - 1].trim();
                const tNorm = title.toLowerCase();
                const oNorm = originalTitle ? originalTitle.toLowerCase() : "";
                if (sub.length > 2 && (tNorm.includes(sub) || oNorm.includes(sub))) {
                  const main = parts[0].trim().replace(/movie/g, "").replace(/film/g, "").trim();
                  const simMain = checkSimilarity(main, title) || checkSimilarity(main, originalTitle);
                  if (simMain) {
                    isSpecialMatch = true;
                  }
                }
              }
              if (isSimilar || isSpecialMatch) {
                return true;
              }
            }
            return false;
          }
          const cYear = parseInt(c.date);
          const diff = Math.abs(cYear - metaYear);
          const keep = diff <= 2;
          if (!keep) {
          }
          return keep;
        });
        if (yearFiltered.length > 0) {
          candidates = yearFiltered;
        } else if (candidates.length > 0) {
          return null;
        }
      }
      if (season > 1 && options.seasonYear) {
        const targetYear = parseInt(options.seasonYear, 10);
        if (!isNaN(targetYear)) {
          const seasonYearCandidates = candidates.map((c) => {
            if (!c.date) return null;
            const match = String(c.date).match(/(\d{4})/);
            if (!match) return null;
            const cYear = parseInt(match[1], 10);
            return { candidate: c, diff: Math.abs(cYear - targetYear) };
          }).filter((x) => x && x.diff <= 2);
          if (seasonYearCandidates.length > 0) {
            const minDiff = Math.min(...seasonYearCandidates.map((x) => x.diff));
            candidates = seasonYearCandidates.filter((x) => x.diff === minDiff).map((x) => x.candidate);
            appliedSeasonYearFilter = true;
          }
        }
      }
      if (candidates && candidates.length > 0) {
        const typeFiltered = candidates.filter((c) => {
          if (c.enriched) {
            if (!isTv) {
              if (!c.type) {
                return false;
              }
              if (c.type === "tv") return false;
            } else {
              if (c.type === "movie") {
                return false;
              }
            }
          }
          return true;
        });
        if (typeFiltered.length > 0) {
          candidates = typeFiltered;
        } else {
          return null;
        }
      }
      if (isTv && season === 1) {
        candidates = candidates.filter((c) => {
          const t = (c.title || "").toLowerCase();
          if (normTitle.includes("movie") || normTitle.includes("film") || normTitle.includes("special") || normTitle.includes("oav") || normTitle.includes("ova")) return true;
          if (/\b(movie|film|special|oav|ova)\b/i.test(t)) {
            return false;
          }
          return true;
        });
        if (candidates.length === 0) {
          console.log("[AnimeWorld] All candidates filtered out by Type check (Movie/Special)");
          return null;
        }
      }
      if (preYearExactMatches.length > 0 && (season === 1 || !isTv)) {
        const anyExactMatchSurvived = candidates.some(
          (c) => preYearExactMatches.some((pym) => pym.href === c.href)
          // Use href as ID
        );
        if (!anyExactMatchSurvived) {
          if (isTv) {
            return null;
          }
        }
      }
      if (options.bypassSeasonCheck) {
        return candidates[0];
      }
      if (season === 0) {
        const isSpecialLikeCandidate = (candidate) => {
          const raw = String((candidate == null ? void 0 : candidate.title) || "").toLowerCase();
          const cType = String((candidate == null ? void 0 : candidate.type) || "").toLowerCase();
          if (cType === "special" || cType === "ova" || cType === "movie") return true;
          return /\b(special|speciale|ova|oav|movie|film|recap|extra|zero|episodio\s*0|ep\s*0)\b/i.test(raw);
        };
        const isTitleAligned = (candidate) => {
          const candidateRaw = String((candidate == null ? void 0 : candidate.title) || "");
          const candidateNorm = normalizeLooseText(candidateRaw);
          const candidateTokens = tokenizeLooseText(candidateRaw);
          const targets = [title, originalTitle].filter(Boolean);
          for (const target of targets) {
            const targetTokens = tokenizeLooseText(target);
            if (targetTokens.length > 0 && candidateTokens.length > 0) {
              const matched = targetTokens.filter((t) => candidateTokens.includes(t)).length;
              const minNeeded = Math.max(1, Math.ceil(targetTokens.length * 0.6));
              if (matched >= minNeeded) return true;
            }
            const tNorm = normalizeLooseText(target);
            if (!tNorm) continue;
            if (candidateNorm === tNorm || candidateNorm.startsWith(`${tNorm} `) || candidateNorm.includes(` ${tNorm} `) || candidateNorm.endsWith(` ${tNorm}`)) {
              return true;
            }
          }
          return false;
        };
        const seasonZeroCandidates = candidates.filter((c) => isSpecialLikeCandidate(c) && isTitleAligned(c));
        if (seasonZeroCandidates.length === 0) {
          console.log("[AnimeWorld] No season 0 match found passing specials/title checks");
          return null;
        }
        seasonZeroCandidates.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));
        const withSpecialWord = seasonZeroCandidates.find(
          (c) => /\b(special|speciale|ova|oav|movie|film)\b/i.test(String(c.title || ""))
        );
        return withSpecialWord || seasonZeroCandidates[0];
      }
      const exactMatch = candidates.find((c) => {
        const t = (c.title || "").toLowerCase().trim();
        return t === normTitle || normOriginal && t === normOriginal;
      });
      if (exactMatch && season === 1) return exactMatch;
      if (!isTv && season === 1) {
        const movieSubtitleHints = extractMovieSubtitleHints([
          title,
          originalTitle,
          ...(metadata.mappedTitleHints || []).slice(0, 20)
        ]);
        if (movieSubtitleHints.length > 0) {
          candidates = candidates.filter((c) => candidateMatchesMovieSubtitleHints(c, movieSubtitleHints));
          if (candidates.length === 0) {
            console.log(`[AnimeWorld] Movie subtitle guard rejected all candidates for: ${title}`);
            return null;
          }
        }
      }
      if (!isTv && season === 1) {
        if (normTitle.includes(":")) {
          const parts = normTitle.split(":");
          const subtitle = parts[parts.length - 1].trim();
          if (subtitle.length > 2) {
            let subMatch = candidates.find((c) => {
              const t = (c.title || "").toLowerCase();
              if (subtitle.length <= 3) {
                return t.endsWith(` ${subtitle}`) || t.includes(`: ${subtitle}`) || t.includes(` ${subtitle} `);
              }
              return t.includes(subtitle);
            });
            if (!subMatch && /part\s*\d+/i.test(subtitle)) {
              const simpleSubtitle = subtitle.replace(/part\s*\d+/i, "").trim();
              if (simpleSubtitle.length > 3) {
                subMatch = candidates.find((c) => {
                  const t = (c.title || "").toLowerCase();
                  return t.includes(simpleSubtitle);
                });
              }
            }
            if (subMatch) {
              if (checkSimilarity(subMatch.title, title) || checkSimilarity(subMatch.title, originalTitle)) {
                return subMatch;
              }
            }
          }
        }
        candidates.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));
        const best = candidates[0];
        if (best && (best.similarityScore || 0) >= 0.6) {
          console.log(`[AnimeWorld] Selected best movie match: "${best.title}" (Score: ${(best.similarityScore || 0).toFixed(2)})`);
          return best;
        }
      }
      if (metaYear) {
        const yearInTitleMatch = candidates.find((c) => {
          const t = (c.title || "").toLowerCase();
          return t.includes(metaYear.toString()) && (t.includes(normTitle) || normOriginal && t.includes(normOriginal));
        });
        if (yearInTitleMatch) {
          return yearInTitleMatch;
        }
      }
      if (season > 1) {
        const seasonStr = String(season);
        const normalizeCandidateTitle = (candidate) => String(candidate.title || "").toLowerCase().replace(/\s*\(ita\)\s*$/i, "").replace(/&#x27;|&#039;/g, "'").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
        const baseTitleNorm2 = String(title || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
        const baseOriginalNorm2 = String(originalTitle || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
        const isBaseEntry = (candidate) => {
          const cNorm = normalizeCandidateTitle(candidate);
          return cNorm === baseTitleNorm2 || baseOriginalNorm2 && cNorm === baseOriginalNorm2;
        };
        const hasSpecificSeasonMarkers = (candidate) => {
          const raw = String(candidate.title || "").toLowerCase();
          if (/season|stagione|part|parte|\b\d+\b/.test(raw)) return true;
          if (/\b(arc|saga|chapter|cour)\b|\b\w+(?:-|\s)?hen\b/.test(raw)) return true;
          if (/final\s*season/i.test(raw)) return true;
          return false;
        };
        const sortSeasonSpecific = (list) => {
          return [...list].sort((a, b) => {
            const aRaw = String(a.title || "").toLowerCase();
            const bRaw = String(b.title || "").toLowerCase();
            const aHasPart = /part\s*\d+/i.test(aRaw);
            const bHasPart = /part\s*\d+/i.test(bRaw);
            if (aHasPart !== bHasPart) return aHasPart ? 1 : -1;
            return (a.title || "").length - (b.title || "").length;
          });
        };
        const seasonSpecificCandidates = candidates.filter((c) => !isBaseEntry(c) && hasSpecificSeasonMarkers(c));
        const numberMatch = candidates.find((c) => {
          const t = (c.title || "").toLowerCase();
          const regex = new RegExp(`\\b${seasonStr}$|\\b${seasonStr}\\b|season ${seasonStr}|stagione ${seasonStr}`, "i");
          if (regex.test(t)) {
            return checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title, `${title} ${season}`) || checkSimilarity(c.title, `${originalTitle} ${season}`);
          }
          return false;
        });
        if (numberMatch) return numberMatch;
        const roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
        if (season < roman.length) {
          const romanStr = roman[season];
          const romanMatch = candidates.find((c) => {
            const t = (c.title || "").toLowerCase();
            const regex = new RegExp(`\\b${romanStr}$|\\b${romanStr}\\b`, "i");
            if (regex.test(t)) {
              return checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title, `${title} ${season}`) || checkSimilarity(c.title, `${originalTitle} ${season}`);
            }
            return false;
          });
          if (romanMatch) return romanMatch;
        }
        if (appliedSeasonYearFilter && candidates.length > 0) {
          const seasonPool = seasonSpecificCandidates.length > 0 ? sortSeasonSpecific(seasonSpecificCandidates) : candidates;
          const seasonYearMatch = seasonPool.find((c) => {
            if (checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle)) return true;
            if (metadata.alternatives) {
              return metadata.alternatives.some((alt) => checkSimilarity(c.title, alt.title));
            }
            return false;
          });
          if (seasonYearMatch) return seasonYearMatch;
          return seasonPool[0];
        }
        if (seasonSpecificCandidates.length > 0) {
          const sortedSpecific = sortSeasonSpecific(seasonSpecificCandidates);
          const specificMatch = sortedSpecific.find((c) => {
            if (checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle)) return true;
            if (metadata.alternatives) {
              return metadata.alternatives.some((alt) => checkSimilarity(c.title, alt.title));
            }
            return false;
          });
          if (specificMatch) return specificMatch;
          return sortedSpecific[0];
        }
      } else {
        const sorted = [...candidates].sort((a, b) => {
          if (!isTv) return (b.title || "").length - (a.title || "").length;
          return (a.title || "").length - (b.title || "").length;
        });
        const hasNumberSuffix = (str) => {
          if (!str) return false;
          if (/(\s|^)\d+(\s*\(ITA\))?$/i.test(str)) return true;
          if (/final\s*season/i.test(str)) return true;
          if (/(season|stagione)\s*\d+/i.test(str)) return true;
          return false;
        };
        if (isTv) {
          const noNumberMatch = sorted.find((c) => {
            const t = (c.title || "").trim();
            return !hasNumberSuffix(t);
          });
          if (noNumberMatch) {
            if (checkSimilarity(noNumberMatch.title, title) || checkSimilarity(noNumberMatch.title, originalTitle)) {
              return noNumberMatch;
            }
          }
        }
        const anyMatch = sorted.find((c) => {
          if (checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle)) return true;
          if (metadata.alternatives) {
            return metadata.alternatives.some((alt) => checkSimilarity(c.title, alt.title));
          }
          return false;
        });
        if (anyMatch) {
          return anyMatch;
        }
        return null;
      }
      const normalizeTitle = (str) => String(str || "").toLowerCase().replace(/\s*\(ita\)\s*$/i, "").replace(/&#x27;|&#039;/g, "'").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
      const baseTitleNorm = normalizeTitle(title);
      const baseOriginalNorm = normalizeTitle(originalTitle);
      const nonBaseFallback = candidates.find((c) => {
        const cNorm = normalizeTitle(c.title);
        const isBase = cNorm === baseTitleNorm || baseOriginalNorm && cNorm === baseOriginalNorm;
        if (isBase) return false;
        return checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle);
      });
      if (nonBaseFallback) return nonBaseFallback;
      const fallbackMatch = candidates.find((c) => {
        return checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle);
      });
      if (fallbackMatch) {
        return fallbackMatch;
      }
      return null;
    }
    function searchAnime(query) {
      return __async(this, null, function* () {
        try {
          const url = `${BASE_URL}/search?keyword=${encodeURIComponent(query)}`;
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": BASE_URL
            }
          });
          if (!response.ok) return [];
          const html = yield response.text();
          if (!html.includes('class="film-list"')) {
            console.log(`[AnimeWorld] No results container found for: ${query}`);
            return [];
          }
          if (html.includes("Nessun risultato") || html.includes("No result")) {
            console.log(`[AnimeWorld] "No results" message found for: ${query}`);
            return [];
          }
          const results = [];
          const seenHrefs = /* @__PURE__ */ new Set();
          const filmListMatch = /<div class="film-list">([\s\S]*?)<div class="paging-wrapper"/i.exec(html);
          let searchContent = html;
          if (filmListMatch) {
            searchContent = filmListMatch[1];
          } else {
            const startIdx = html.indexOf('class="film-list"');
            if (startIdx !== -1) {
              searchContent = html.substring(startIdx);
              const parts = html.split('class="film-list"');
              if (parts.length > 1) {
                let content = parts[1];
                const stopMarkers = ['class="widget"', 'class="footer"', 'id="footer"'];
                let minIndex = content.length;
                for (const marker of stopMarkers) {
                  const idx = content.indexOf(marker);
                  if (idx !== -1 && idx < minIndex) minIndex = idx;
                }
                searchContent = content.substring(0, minIndex);
              }
            }
          }
          const chunks = searchContent.split('<div class="item">');
          chunks.shift();
          for (const chunk of chunks) {
            const nameTagMatch = /<a[^>]*class="name"[^>]*>([\s\S]*?)<\/a>/i.exec(chunk);
            if (!nameTagMatch) continue;
            const nameTag = nameTagMatch[0];
            let title = nameTagMatch[1].trim();
            title = title.replace(/<[^>]*>/g, "").trim();
            title = title.replace(/&#x27;|&#039;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
            const hrefMatch = /href="([^"]*)"/i.exec(nameTag);
            const href = hrefMatch ? hrefMatch[1] : null;
            if (!title || !href) continue;
            if (seenHrefs.has(href)) continue;
            seenHrefs.add(href);
            const imgMatch = /<img[^>]*src="([^"]*)"/i.exec(chunk);
            const image = imgMatch ? imgMatch[1] : null;
            const tooltipMatch = /data-tip="([^"]*)"/i.exec(chunk);
            const tooltipUrl = tooltipMatch ? tooltipMatch[1] : null;
            let isDub = /class="dub"/i.test(chunk);
            if (!isDub) {
              if (href.includes("-ita")) isDub = true;
              if (title.includes("(ITA)")) isDub = true;
            }
            if (href.includes("subita")) isDub = false;
            const isSub = !isDub;
            if (isDub && !title.toUpperCase().includes("ITA")) {
              title += " (ITA)";
            }
            results.push({
              title,
              href,
              image,
              isDub,
              isSub,
              tooltipUrl
            });
          }
          return results;
        } catch (e) {
          console.error("[AnimeWorld] Search error:", e);
          return [];
        }
      });
    }
    function fetchTooltipInfo(tooltipUrl) {
      return __async(this, null, function* () {
        if (!tooltipUrl) return { year: null, type: null };
        try {
          const url = `${BASE_URL}/${tooltipUrl}`;
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": BASE_URL,
              "X-Requested-With": "XMLHttpRequest"
            }
          });
          if (!response.ok) return { year: null, type: null };
          const html = yield response.text();
          let year = null;
          const dateMatch = /Data di uscita:[\s\S]*?(?:<dd>|<span>)([\s\S]*?)(?:<\/dd>|<\/span>)/i.exec(html);
          if (dateMatch) {
            const dateStr = dateMatch[1].trim();
            const yearMatch = /(\d{4})/.exec(dateStr);
            if (yearMatch) year = yearMatch[1];
          }
          let type = null;
          if (html.includes('class="movie"')) type = "movie";
          else if (html.includes('class="ova"')) type = "ova";
          else if (html.includes('class="ona"')) type = "ona";
          else if (html.includes('class="special"')) type = "special";
          else if (html.includes('class="tv"')) type = "tv";
          return { year, type };
        } catch (e) {
          console.error("[AnimeWorld] Tooltip fetch error:", e);
          return { year: null, type: null };
        }
      });
    }
    function getStreams2(id, type, season, episode, providedMetadata = null, providerContext = null) {
      return __async(this, null, function* () {
        try {
          if (providedMetadata && providedMetadata.__requestContext && !providerContext) {
            providerContext = providedMetadata;
            providedMetadata = null;
          }
          const metadata = providedMetadata || (yield getMetadata(id, type, season, providerContext));
          if (!metadata) {
            console.error("[AnimeWorld] Metadata not found for", id);
            return [];
          }
          if (!isAnime(metadata)) {
            console.log(`[AnimeWorld] Skipped ${metadata.title} (Not an anime)`);
            return [];
          }
          let mappedSeason = metadata.mappedSeason;
          if (mappedSeason !== null && mappedSeason !== void 0) {
            const parsedMapped = parseInt(mappedSeason, 10);
            if (!isNaN(parsedMapped)) mappedSeason = parsedMapped;
          }
          const episodeMode = String(metadata.episodeMode || "").toLowerCase();
          const mappedSeasonCount = Array.isArray(metadata.mappedSeasons) ? metadata.mappedSeasons.filter((n) => Number.isInteger(parseInt(n, 10)) && parseInt(n, 10) > 0).length : 0;
          const parsedSeriesSeasonCount = parseInt(metadata.seriesSeasonCount, 10);
          const seriesSeasonCount = Number.isInteger(parsedSeriesSeasonCount) ? parsedSeriesSeasonCount : 0;
          const tmdbSeasonCount = Array.isArray(metadata.seasons) ? metadata.seasons.filter((s) => Number.isInteger(s == null ? void 0 : s.season_number) && s.season_number > 0).length : 0;
          const topologyAbsoluteFallback = tmdbSeasonCount >= 12 || mappedSeasonCount >= 12 || seriesSeasonCount >= 12;
          const isLongSeriesAbsolute = episodeMode === "absolute" || topologyAbsoluteFallback;
          const parsedSeason = Number.isInteger(season) ? season : parseInt(season, 10);
          if (!isNaN(parsedSeason)) season = parsedSeason;
          const isSpecialSeasonRequest = season === 0;
          if (isSpecialSeasonRequest && mappedSeason && mappedSeason !== 0) {
            console.log(`[AnimeWorld] Requested Season 0 (specials). Ignoring mapped Season ${mappedSeason}.`);
          } else if (mappedSeason && !isLongSeriesAbsolute) {
            console.log(`[AnimeWorld] Kitsu mapping indicates Season ${mappedSeason}. Overriding requested Season ${season}`);
            season = mappedSeason;
          } else if (mappedSeason && isLongSeriesAbsolute) {
            console.log(`[AnimeWorld] Long-series absolute mode active. Keeping requested Season ${season} (mapped season: ${mappedSeason}).`);
          }
          const seasonSearchEnabled = season > 1 && !isLongSeriesAbsolute;
          const seasonForMatch = seasonSearchEnabled ? season : season === 0 ? 0 : 1;
          const title = metadata.title || metadata.name;
          const originalTitle = metadata.original_title || metadata.original_name;
          const looseTargets = [
            title,
            originalTitle,
            ...(metadata.alternatives || []).slice(0, 30).map((a) => a.title),
            ...(metadata.mappedTitleHints || []).slice(0, 20)
          ].filter(Boolean);
          const isRelevantByLooseMatch = (candidateTitle, extraTargets = []) => {
            return isLooselyRelevant(candidateTitle, [...looseTargets, ...extraTargets].filter(Boolean));
          };
          if (isLongSeriesAbsolute) {
            if (episodeMode !== "absolute" && topologyAbsoluteFallback) {
              console.log(`[AnimeWorld] Absolute long-series fallback enabled by topology (TMDB:${tmdbSeasonCount}, mapped:${mappedSeasonCount}, series:${seriesSeasonCount}).`);
            }
            console.log(`[AnimeWorld] Long-series absolute mode for ${title}: disabling season-name/season-number queries.`);
          }
          console.log(`[AnimeWorld] Searching for: ${title} (Season ${season})`);
          let candidates = [];
          let seasonNameMatch = false;
          let seasonYear = null;
          let seasonName = metadata.seasonName || null;
          const seasonNameCandidates = [];
          const addSeasonName = (name) => {
            if (!name) return;
            const clean = String(name).trim();
            if (!clean) return;
            if (clean.match(/^Season \d+|^Stagione \d+/i)) return;
            const norm = normalizeLooseText(clean);
            if (!norm) return;
            if (seasonNameCandidates.some((n) => normalizeLooseText(n) === norm)) return;
            seasonNameCandidates.push(clean);
          };
          addSeasonName(seasonName);
          if (Array.isArray(metadata.mappedTitleHints) && metadata.mappedTitleHints.length > 0) {
            for (const hint of metadata.mappedTitleHints) addSeasonName(hint);
          }
          if (seasonSearchEnabled && metadata.seasons) {
            const targetSeason = metadata.seasons.find((s) => s.season_number === season);
            if (targetSeason && targetSeason.air_date) {
              const yearMatch = String(targetSeason.air_date).match(/(\d{4})/);
              if (yearMatch) seasonYear = parseInt(yearMatch[1], 10);
            }
          }
          if (seasonSearchEnabled && metadata.id) {
            const seasonMetaIt = yield getSeasonMetadata(metadata.id, season, "it-IT");
            if (!seasonYear && seasonMetaIt && seasonMetaIt.air_date) {
              const yearMatch = String(seasonMetaIt.air_date).match(/(\d{4})/);
              if (yearMatch) seasonYear = parseInt(yearMatch[1], 10);
            }
            if (seasonMetaIt && seasonMetaIt.name) {
              addSeasonName(seasonMetaIt.name);
            }
            const seasonMetaEn = yield getSeasonMetadata(metadata.id, season, "en-US");
            if (!seasonYear && seasonMetaEn && seasonMetaEn.air_date) {
              const yearMatch = String(seasonMetaEn.air_date).match(/(\d{4})/);
              if (yearMatch) seasonYear = parseInt(yearMatch[1], 10);
            }
            if (seasonMetaEn && seasonMetaEn.name) {
              addSeasonName(seasonMetaEn.name);
            }
          }
          if (season === 0) {
            const searchQueries = [
              `${title} Special`,
              `${title} OAV`,
              `${title} Movie`,
              `${title} 0`,
              `${title} 0 Movie`
            ];
            for (const query of searchQueries) {
              const res = yield searchAnime(query);
              if (res && res.length > 0) {
                candidates = candidates.concat(res);
              }
            }
            candidates = candidates.filter((v, i, a) => a.findIndex((t) => t.href === v.href) === i);
          }
          if (seasonSearchEnabled) {
            const searchQueries = [
              `${title} ${season}`,
              `${title} Season ${season}`,
              `${title} Stagione ${season}`
            ];
            if (originalTitle && originalTitle !== title) {
              searchQueries.push(`${originalTitle} ${season}`);
            }
            const seasonStrategyCandidates = [];
            const pushSeasonCandidates = (list) => {
              if (!list || list.length === 0) return;
              seasonStrategyCandidates.push(...list);
            };
            const normalizeText = (str) => String(str || "").toLowerCase().replace(/&#x27;|&#039;/g, "'").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
            const filterSeasonNameCandidates = (list, seasonNameCandidate, query) => {
              if (!list || list.length === 0) return [];
              const sNorm = normalizeText(seasonNameCandidate);
              return list.filter((c) => {
                const cNorm = normalizeText(c.title);
                const matchesSeasonName = sNorm.length > 0 && (cNorm.includes(sNorm) || checkSimilarity(c.title, seasonNameCandidate));
                const matchesSeries = checkSimilarity(c.title, title) || checkSimilarity(c.title, `${title} ${season}`) || checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title, `${originalTitle} ${season}`) || checkSimilarity(c.title, query) || isRelevantByLooseMatch(c.title, [query, seasonNameCandidate, title, originalTitle]);
                if (!matchesSeries) return false;
                if (matchesSeasonName) return true;
                const isSplitEntry = /\b(part|parte|cour)\b/i.test(cNorm);
                if (isSplitEntry) return true;
                return false;
              });
            };
            const filterNumericSeasonCandidates = (list, query) => {
              if (!list || list.length === 0) return [];
              return list.filter(
                (c) => checkSimilarity(c.title, title) || checkSimilarity(c.title, `${title} ${season}`) || checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title, `${originalTitle} ${season}`) || checkSimilarity(c.title, query) || isRelevantByLooseMatch(c.title, [query])
              );
            };
            if (seasonNameCandidates.length > 0) {
              let seasonNameUsed = null;
              for (const seasonNameCandidate of seasonNameCandidates) {
                const seasonQueries = [
                  `${title} ${seasonNameCandidate}`,
                  seasonNameCandidate
                ];
                if (originalTitle && originalTitle !== title && !originalTitle.match(/[\u3040-\u30ff\u4e00-\u9faf]/)) {
                  seasonQueries.push(`${originalTitle} ${seasonNameCandidate}`);
                }
                for (const query of seasonQueries) {
                  console.log(`[AnimeWorld] Strategy 1 - Specific Season Name search: ${query}`);
                  const res = yield searchAnime(query);
                  const relevantRes = filterSeasonNameCandidates(res, seasonNameCandidate, query);
                  if (relevantRes.length > 0) {
                    console.log(`[AnimeWorld] Strategy 1 - Found relevance for: ${query}`);
                    pushSeasonCandidates(relevantRes);
                    seasonNameMatch = true;
                    seasonNameUsed = seasonNameCandidate;
                    break;
                  }
                }
                if (seasonNameMatch) break;
              }
              if (!seasonNameUsed && seasonNameCandidates.length > 0) {
                seasonNameUsed = seasonNameCandidates[0];
              }
              seasonName = seasonNameUsed || seasonName;
            }
            for (const query of searchQueries) {
              console.log(`[AnimeWorld] Strategy 1 - Numeric Season search: ${query}`);
              const res = yield searchAnime(query);
              const relevantRes = filterNumericSeasonCandidates(res, query);
              if (relevantRes.length > 0) {
                pushSeasonCandidates(relevantRes);
              }
            }
            if (seasonNameMatch || seasonStrategyCandidates.length === 0) {
              const broadQueries = [title];
              if (originalTitle && originalTitle !== title) broadQueries.push(originalTitle);
              for (const query of broadQueries) {
                console.log(`[AnimeWorld] Strategy 1 - Broad season search: ${query}`);
                const res = yield searchAnime(query);
                const relevantRes = filterNumericSeasonCandidates(res, query);
                if (relevantRes.length > 0) {
                  pushSeasonCandidates(relevantRes);
                }
              }
            }
            if (seasonStrategyCandidates.length > 0) {
              candidates = seasonStrategyCandidates.filter((v, i, a) => a.findIndex((t) => t.href === v.href) === i);
            }
          }
          const isMovie = metadata.genres && metadata.genres.some((g) => g.name === "Movie") || season === 0 || type === "movie";
          if (candidates.length === 0) {
            console.log(`[AnimeWorld] Standard search: ${title}`);
            candidates = yield searchAnime(title);
            if (candidates.length > 0) {
              const valid = candidates.some(
                (c) => checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle) || isRelevantByLooseMatch(c.title)
              );
              if (!valid) {
                console.log("[AnimeWorld] Standard search results seem irrelevant. Discarding.");
                candidates = [];
              }
            }
            if (candidates.length === 0 && title.includes("-")) {
              const dehyphenated = title.replace(/-/g, " ").replace(/\s+/g, " ").trim();
              if (dehyphenated !== title) {
                console.log(`[AnimeWorld] Dehyphenated search: ${dehyphenated}`);
                candidates = yield searchAnime(dehyphenated);
                if (candidates.length > 0) {
                  const valid = candidates.some(
                    (c) => checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title, dehyphenated) || isRelevantByLooseMatch(c.title, [dehyphenated])
                  );
                  if (!valid) {
                    console.log("[AnimeWorld] Dehyphenated search results seem irrelevant. Discarding.");
                    candidates = [];
                  }
                }
              }
            }
          }
          if (isMovie) {
            const variantCandidates = [];
            const movieNumMatch = /\b(movie|film)\s*(\d+)\b/i.exec(title);
            if (movieNumMatch) {
              const typeWord = movieNumMatch[1];
              const numStr = movieNumMatch[2];
              if (numStr.length === 1) {
                const padded = `0${numStr}`;
                const paddedTitle = title.replace(new RegExp(`\\b${typeWord}\\s*${numStr}\\b`, "i"), `${typeWord} ${padded}`);
                console.log(`[AnimeWorld] Padded search: ${paddedTitle}`);
                const paddedRes = yield searchAnime(paddedTitle);
                if (paddedRes && paddedRes.length > 0) variantCandidates.push(...paddedRes);
              }
            }
            let parts = [];
            if (title.includes(" - ")) {
              parts = title.split(" - ");
            } else if (title.includes(":")) {
              parts = title.split(":");
            }
            if (parts.length > 1) {
              const mainTitle = parts[0].trim();
              const subtitle = parts[parts.length - 1].trim();
              if (mainTitle.length > 3) {
                const mainRes = yield searchAnime(mainTitle);
                if (mainRes && mainRes.length > 0) variantCandidates.push(...mainRes);
              }
              if (subtitle.length > 3) {
                const subRes = yield searchAnime(subtitle);
                if (subRes && subRes.length > 0) variantCandidates.push(...subRes);
                if (/part\s*\d+/i.test(subtitle)) {
                  const simpleSubtitle = subtitle.replace(/part\s*\d+/i, "").trim();
                  if (simpleSubtitle.length > 3) {
                    const simpleRes = yield searchAnime(simpleSubtitle);
                    if (simpleRes && simpleRes.length > 0) variantCandidates.push(...simpleRes);
                  }
                }
              }
              const movieQuery = `${mainTitle} Movie`;
              const movieRes = yield searchAnime(movieQuery);
              if (movieRes && movieRes.length > 0) variantCandidates.push(...movieRes);
              const filmQuery = `${mainTitle} Film`;
              const filmRes = yield searchAnime(filmQuery);
              if (filmRes && filmRes.length > 0) variantCandidates.push(...filmRes);
              if (title.includes(" - ")) {
                const colonTitle = title.replace(" - ", ": ");
                const colonRes = yield searchAnime(colonTitle);
                if (colonRes && colonRes.length > 0) variantCandidates.push(...colonRes);
              }
            } else {
              if (!title.toLowerCase().includes("movie")) {
                const movieQuery = `${title} Movie`;
                const movieRes = yield searchAnime(movieQuery);
                if (movieRes && movieRes.length > 0) variantCandidates.push(...movieRes);
              }
              if (!title.toLowerCase().includes("film")) {
                const filmQuery = `${title} Film`;
                const filmRes = yield searchAnime(filmQuery);
                if (filmRes && filmRes.length > 0) variantCandidates.push(...filmRes);
              }
            }
            if (title.includes(":")) {
              const hyphenTitle = title.replace(/:/g, " -");
              const hyphenRes = yield searchAnime(hyphenTitle);
              if (hyphenRes && hyphenRes.length > 0) variantCandidates.push(...hyphenRes);
            }
            const simpleTitle = title.replace(/\b(film|movie|the|movie)\b/gi, "").replace(/-/g, "").replace(/:/g, "").replace(/\s+/g, " ").trim();
            if (simpleTitle.length > 3 && simpleTitle !== title) {
              const simpleRes = yield searchAnime(simpleTitle);
              if (simpleRes && simpleRes.length > 0) variantCandidates.push(...simpleRes);
            }
            if (variantCandidates.length > 0) {
              candidates = [...variantCandidates, ...candidates];
              candidates = candidates.filter((v, i, a) => a.findIndex((t) => t.href === v.href) === i);
            }
          }
          const shouldSearchOriginal = (!candidates || candidates.length === 0 || isMovie) && originalTitle && originalTitle !== title;
          if (shouldSearchOriginal) {
            const res = yield searchAnime(originalTitle);
            if (res && res.length > 0) {
              const valid = res.some((c) => {
                if (checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle)) return true;
                if (isRelevantByLooseMatch(c.title, [originalTitle])) return true;
                if (metadata.alternatives) {
                  return metadata.alternatives.some((alt) => checkSimilarity(c.title, alt.title));
                }
                return false;
              });
              if (valid) {
                candidates = [...candidates, ...res];
                candidates = candidates.filter((v, i, a) => a.findIndex((t) => t.href === v.href) === i);
              } else {
                console.log("[AnimeWorld] Original title search results seem irrelevant. Discarding.");
              }
            }
          }
          const shouldSearchSanitized = (!candidates || candidates.length === 0 || isMovie) && originalTitle;
          if (shouldSearchSanitized) {
            let sanitizedQueries = [];
            if (originalTitle.includes(":")) {
              const parts = originalTitle.split(":");
              if (parts[0].trim().length > 3) {
                sanitizedQueries.push(parts[0].trim());
              }
            }
            const lowerOrg = originalTitle.toLowerCase();
            if (lowerOrg.includes("film")) {
              const idx = lowerOrg.indexOf("film");
              const query = originalTitle.substring(0, idx + 4).trim();
              if (query.length > 3 && query !== originalTitle) sanitizedQueries.push(query);
            }
            if (lowerOrg.includes("movie")) {
              const idx = lowerOrg.indexOf("movie");
              const query = originalTitle.substring(0, idx + 5).trim();
              if (query.length > 3 && query !== originalTitle) sanitizedQueries.push(query);
            }
            sanitizedQueries = [...new Set(sanitizedQueries)];
            for (const q of sanitizedQueries) {
              const res = yield searchAnime(q);
              if (res && res.length > 0) {
                const validRes = res.filter((c) => {
                  return checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle) || isRelevantByLooseMatch(c.title, [q]);
                });
                if (validRes.length > 0) {
                  console.log(`[AnimeWorld] Found ${validRes.length} valid candidates from sanitized search.`);
                  candidates = [...candidates, ...validRes];
                }
              }
            }
            if (candidates.length > 0) {
              candidates = candidates.filter((v, i, a) => a.findIndex((t) => t.href === v.href) === i);
            }
          }
          if ((!candidates || candidates.length === 0 || isMovie) && metadata.alternatives) {
            const altTitles = metadata.alternatives.map((t) => t.title).filter((t) => /^[a-zA-Z0-9\s\-\.\:\(\)!'&]+$/.test(t)).filter((t) => t !== title && t !== originalTitle);
            const uniqueAlts = [...new Set(altTitles)];
            const scoreAltTitle = (altTitle) => {
              let score = 0;
              if (checkSimilarity(altTitle, title) || checkSimilarity(altTitle, originalTitle)) score += 2;
              if (isLooselyRelevant(altTitle, [title, originalTitle])) score += 1;
              score += Math.min(tokenizeLooseText(altTitle).length, 4) * 0.1;
              return score;
            };
            const rankedAlts = [...uniqueAlts].sort((a, b) => scoreAltTitle(b) - scoreAltTitle(a));
            const maxAltSearches = isMovie ? 8 : 15;
            let altSearchCount = 0;
            for (const altTitle of rankedAlts) {
              if (altSearchCount >= maxAltSearches) break;
              if (altTitle.length < 4) continue;
              const res = yield searchAnime(altTitle);
              altSearchCount++;
              if (res && res.length > 0) {
                const valid = res.some((c) => {
                  if (checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle)) return true;
                  if (isRelevantByLooseMatch(c.title, [altTitle])) return true;
                  if (metadata.alternatives) {
                    return metadata.alternatives.some((alt) => checkSimilarity(c.title, alt.title));
                  }
                  return false;
                });
                if (valid) {
                  console.log(`[AnimeWorld] Found valid candidates from alternative title: ${altTitle}`);
                  res.forEach((c) => c.matchedAltTitle = altTitle);
                  candidates = [...candidates, ...res];
                }
              }
            }
            if (candidates.length > 0) {
              candidates = candidates.filter((v, i, a) => a.findIndex((t) => t.href === v.href) === i);
            }
          }
          if (!candidates || candidates.length === 0) {
            console.log("[AnimeWorld] No anime found");
            return [];
          }
          const subs = candidates.filter((c) => c.isSub);
          const dubs = candidates.filter((c) => c.isDub);
          const enrichTopCandidates = (list) => __async(null, null, function* () {
            const candidatesToEnrich = [];
            const processedHrefs = /* @__PURE__ */ new Set();
            const promising = list.filter((c) => {
              if (processedHrefs.has(c.href)) return false;
              const isSim = checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title, `${title} ${season}`) || checkSimilarity(c.title, `${originalTitle} ${season}`) || seasonName && checkSimilarity(c.title, seasonName) || seasonName && checkSimilarity(c.title, `${title} ${seasonName}`) || c.matchedAltTitle && checkSimilarity(c.title, c.matchedAltTitle);
              if (isSim) {
                processedHrefs.add(c.href);
                return true;
              }
              return false;
            });
            const originalTop = list.slice(0, 3).filter((c) => {
              if (processedHrefs.has(c.href)) return false;
              processedHrefs.add(c.href);
              return true;
            });
            const combined = [...promising, ...originalTop].slice(0, 6);
            for (const c of combined) {
              if (!c.date && c.tooltipUrl) {
                const { year, type: type2 } = yield fetchTooltipInfo(c.tooltipUrl);
                if (year) c.date = year;
                if (type2) c.type = type2;
              }
              c.enriched = true;
            }
            return combined;
          });
          yield enrichTopCandidates(subs);
          yield enrichTopCandidates(dubs);
          let bestSub = findBestMatch(subs, title, originalTitle, seasonForMatch, metadata, {
            bypassSeasonCheck: seasonNameMatch,
            seasonName,
            seasonYear
          });
          let bestDub = findBestMatch(dubs, title, originalTitle, seasonForMatch, metadata, {
            bypassSeasonCheck: seasonNameMatch,
            seasonName,
            seasonYear
          });
          let pickBySeasonYear = null;
          if (seasonSearchEnabled && seasonYear) {
            pickBySeasonYear = (list) => __async(null, null, function* () {
              if (!list || list.length === 0) return null;
              const sample = list.slice(0, 15);
              for (const c of sample) {
                if (!c.date && c.tooltipUrl) {
                  const { year, type: type2 } = yield fetchTooltipInfo(c.tooltipUrl);
                  if (year) c.date = year;
                  if (type2) c.type = type2;
                }
              }
              const ranked = sample.map((c) => {
                const yearMatch = c.date ? String(c.date).match(/(\d{4})/) : null;
                if (!yearMatch) return null;
                const cYear = parseInt(yearMatch[1], 10);
                if (isNaN(cYear)) return null;
                if (c.type === "movie") return null;
                return { candidate: c, diff: Math.abs(cYear - seasonYear) };
              }).filter(Boolean).sort((a, b) => a.diff - b.diff);
              return ranked.length > 0 ? ranked[0].candidate : null;
            });
            if (!bestSub) bestSub = yield pickBySeasonYear(subs);
            if (!bestDub) bestDub = yield pickBySeasonYear(dubs);
            const normalizeTitle = (str) => String(str || "").toLowerCase().replace(/\(ita\)/g, "").replace(/\(sub ita\)/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
            const baseTitleNorm = normalizeTitle(title);
            const baseOriginalNorm = normalizeTitle(originalTitle);
            const candidateDiff = (candidate) => {
              if (!candidate || !candidate.date) return null;
              const yearMatch = String(candidate.date).match(/(\d{4})/);
              if (!yearMatch) return null;
              const y = parseInt(yearMatch[1], 10);
              if (isNaN(y)) return null;
              return Math.abs(y - seasonYear);
            };
            const refineSelection = (current, list) => __async(null, null, function* () {
              const byYear = yield pickBySeasonYear(list);
              if (!byYear) return current;
              if (!current) return byYear;
              const currentNorm = normalizeTitle(current.title);
              const currentIsBase = currentNorm === baseTitleNorm || baseOriginalNorm && currentNorm === baseOriginalNorm;
              const currentDiff = candidateDiff(current);
              const byYearDiff = candidateDiff(byYear);
              if (currentIsBase) return byYear;
              if (currentDiff === null && byYearDiff !== null) return byYear;
              if (currentDiff !== null && byYearDiff !== null && byYearDiff < currentDiff) return byYear;
              return current;
            });
            bestSub = yield refineSelection(bestSub, subs);
            bestDub = yield refineSelection(bestDub, dubs);
          }
          if (seasonSearchEnabled && (!bestSub || !bestDub)) {
            const seasonTokenRegex = new RegExp(`\\b${season}\\b|season\\s*${season}|stagione\\s*${season}|part\\s*${season}|parte\\s*${season}`, "i");
            const pickBySeasonToken = (list) => {
              if (!list || list.length === 0) return null;
              const tokenMatches = list.filter((c) => seasonTokenRegex.test(String(c.title || "")));
              if (tokenMatches.length === 0) return null;
              return tokenMatches[0];
            };
            if (!bestSub) bestSub = pickBySeasonToken(subs);
            if (!bestDub) bestDub = pickBySeasonToken(dubs);
          }
          if (seasonSearchEnabled) {
            const normalizeCandidateTitle = (candidate) => String(candidate.title || "").toLowerCase().replace(/\s*\(ita\)\s*$/i, "").replace(/&#x27;|&#039;/g, "'").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
            const baseTitleNorm = String(title || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
            const baseOriginalNorm = String(originalTitle || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
            const isBaseEntry = (candidate) => {
              const cNorm = normalizeCandidateTitle(candidate);
              return cNorm === baseTitleNorm || baseOriginalNorm && cNorm === baseOriginalNorm;
            };
            const hasSeasonMarkers = (candidate) => {
              const raw = String(candidate.title || "").toLowerCase();
              if (/season|stagione|part|parte|\b\d+\b/.test(raw)) return true;
              if (/\b(arc|saga|chapter|cour)\b|\b\w+(?:-|\s)?hen\b/.test(raw)) return true;
              if (/final\s*season/i.test(raw)) return true;
              return false;
            };
            const isRelevantCandidate = (candidate) => {
              if (checkSimilarity(candidate.title, title) || checkSimilarity(candidate.title, originalTitle)) return true;
              if (metadata.alternatives) {
                const altSimilarity = metadata.alternatives.some((alt) => checkSimilarity(candidate.title, alt.title));
                if (altSimilarity) return true;
              }
              const baseTokens = /* @__PURE__ */ new Set([
                ...tokenizeForPairing(title || ""),
                ...tokenizeForPairing(originalTitle || ""),
                ...(metadata.alternatives || []).slice(0, 30).flatMap((alt) => tokenizeForPairing(alt.title || ""))
              ]);
              const candidateTokens = tokenizeForPairing(candidate.title || "");
              if (candidateTokens.some((t) => baseTokens.has(t))) return true;
              return false;
            };
            const seasonTokenRegexLocal = new RegExp(`\\b${season}\\b|season\\s*${season}|stagione\\s*${season}|part\\s*${season}|parte\\s*${season}`, "i");
            const getSeasonTokenScore = (candidate) => {
              const raw = String(candidate.title || "");
              if (!seasonTokenRegexLocal.test(raw)) return 0;
              if (/part\s*\d+/i.test(raw)) return 1;
              return 2;
            };
            const getYearDiff = (candidate) => {
              if (!seasonYear || !candidate || !candidate.date) return Number.MAX_SAFE_INTEGER;
              const yearMatch = String(candidate.date).match(/(\d{4})/);
              if (!yearMatch) return Number.MAX_SAFE_INTEGER;
              const y = parseInt(yearMatch[1], 10);
              if (isNaN(y)) return Number.MAX_SAFE_INTEGER;
              return Math.abs(y - seasonYear);
            };
            const isMovieLikeCandidate = (candidate) => {
              const raw = String(candidate.title || "").toLowerCase();
              if (/\b(movie|film|special|ova|oav)\b/.test(raw)) return true;
              const cType = String(candidate.type || "").toLowerCase();
              return cType === "movie" || cType === "special" || cType === "ova";
            };
            const isSpinOffCandidate = (candidate) => {
              const raw = String(candidate.title || "").toLowerCase();
              return /\b(mini|short|recap|digest|spin\s*off|spin-off|break\s*time|chibi)\b/.test(raw);
            };
            const pickSeasonSpecific = (current, list) => {
              if (!list || list.length === 0) return current;
              const specificPool = list.filter((c) => {
                if (isBaseEntry(c) || !hasSeasonMarkers(c) || !isRelevantCandidate(c)) return false;
                if (!isMovie && isMovieLikeCandidate(c)) return false;
                if (!isMovie && isSpinOffCandidate(c)) return false;
                return true;
              });
              if (specificPool.length === 0) return current;
              const ranked = [...specificPool].sort((a, b) => {
                const aRaw = String(a.title || "").toLowerCase();
                const bRaw = String(b.title || "").toLowerCase();
                const aHasPart = /part\s*\d+/i.test(aRaw);
                const bHasPart = /part\s*\d+/i.test(bRaw);
                if (aHasPart !== bHasPart) return aHasPart ? 1 : -1;
                const tokenScoreA = getSeasonTokenScore(a);
                const tokenScoreB = getSeasonTokenScore(b);
                if (tokenScoreA !== tokenScoreB) return tokenScoreB - tokenScoreA;
                const diffA = getYearDiff(a);
                const diffB = getYearDiff(b);
                if (diffA !== diffB) return diffA - diffB;
                const scoreA = Math.max(
                  getSimilarityScore(a.title, `${title} ${season}`),
                  seasonName ? getSimilarityScore(a.title, seasonName) : 0
                );
                const scoreB = Math.max(
                  getSimilarityScore(b.title, `${title} ${season}`),
                  seasonName ? getSimilarityScore(b.title, seasonName) : 0
                );
                if (scoreA !== scoreB) return scoreB - scoreA;
                return (a.title || "").length - (b.title || "").length;
              });
              if (!current) return ranked[0];
              if (!isRelevantCandidate(current)) return ranked[0];
              if (isBaseEntry(current) || !hasSeasonMarkers(current)) return ranked[0];
              const curRaw = String(current.title || "").toLowerCase();
              const topRaw = String(ranked[0].title || "").toLowerCase();
              const currentHasPart = /part\s*\d+/i.test(curRaw);
              const topHasPart = /part\s*\d+/i.test(topRaw);
              if (currentHasPart && !topHasPart) return ranked[0];
              if (getSeasonTokenScore(current) < getSeasonTokenScore(ranked[0])) return ranked[0];
              return current;
            };
            bestSub = pickSeasonSpecific(bestSub, subs);
            bestDub = pickSeasonSpecific(bestDub, dubs);
            if (bestSub && bestDub) {
              const subIsSpecific = !isBaseEntry(bestSub) && hasSeasonMarkers(bestSub);
              const dubIsBase = isBaseEntry(bestDub);
              if (subIsSpecific && dubIsBase) {
                bestDub = null;
              }
            }
          }
          if (bestSub && bestDub && !areCoherentCandidates(bestSub, bestDub, title, originalTitle)) {
            const compatibleDubs = dubs.filter((c) => areCoherentCandidates(bestSub, c, title, originalTitle));
            if (compatibleDubs.length > 0) {
              const alignedDub = findBestMatch(compatibleDubs, title, originalTitle, seasonForMatch, metadata, {
                bypassSeasonCheck: seasonNameMatch,
                seasonName,
                seasonYear
              });
              bestDub = alignedDub || compatibleDubs[0];
            } else {
              console.log("[AnimeWorld] Discarding dub candidate due to arc/season mismatch with selected sub.");
              bestDub = null;
            }
          }
          if (seasonSearchEnabled) {
            const hintList = [...new Set([seasonName, ...seasonNameCandidates || []].map((x) => String(x || "").trim()).filter(Boolean))];
            if (hintList.length > 0) {
              const normalize = (s) => String(s || "").toLowerCase().replace(/&#x27;|&#039;/g, "'").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
              const tokenize = (s) => normalize(s).split(/\s+/).filter(Boolean);
              const baseTokenSet = /* @__PURE__ */ new Set([
                ...tokenize(title),
                ...tokenize(originalTitle)
              ]);
              const genericTokens = /* @__PURE__ */ new Set(["season", "stagione", "part", "parte", "the", "and", "dei", "degli", "della"]);
              const matchesSeasonHint = (candidate) => {
                if (!candidate) return false;
                const cTitle = String(candidate.title || "");
                const cNorm = normalize(cTitle);
                return hintList.some((hint) => {
                  const hNorm = normalize(hint);
                  if (!hNorm) return false;
                  if (cNorm.includes(hNorm)) return true;
                  const distinctive = tokenize(hNorm).filter(
                    (t) => t.length >= 4 && !baseTokenSet.has(t) && !genericTokens.has(t)
                  );
                  if (distinctive.length === 0) return false;
                  return distinctive.some((t) => cNorm.includes(t));
                });
              };
              const alignedSubs = subs.filter(matchesSeasonHint);
              const alignedDubs = dubs.filter(matchesSeasonHint);
              if (bestSub && !matchesSeasonHint(bestSub) && alignedSubs.length > 0) {
                bestSub = findBestMatch(alignedSubs, title, originalTitle, seasonForMatch, metadata, {
                  bypassSeasonCheck: seasonNameMatch,
                  seasonName,
                  seasonYear
                }) || alignedSubs[0];
              }
              if (bestDub && !matchesSeasonHint(bestDub) && alignedDubs.length > 0) {
                bestDub = findBestMatch(alignedDubs, title, originalTitle, seasonForMatch, metadata, {
                  bypassSeasonCheck: seasonNameMatch,
                  seasonName,
                  seasonYear
                }) || alignedDubs[0];
              }
              if (bestSub && !matchesSeasonHint(bestSub)) {
                console.log("[AnimeWorld] Discarding SUB candidate not aligned with season-name hints.");
                bestSub = null;
              }
              if (bestDub && !matchesSeasonHint(bestDub)) {
                console.log("[AnimeWorld] Discarding DUB candidate not aligned with season-name hints.");
                bestDub = null;
              }
            }
          }
          if (season === 0) {
            const isSeasonZeroCandidate = (candidate) => {
              if (!candidate) return false;
              const raw = String(candidate.title || "");
              const lower = raw.toLowerCase();
              const cType = String(candidate.type || "").toLowerCase();
              const hasSpecialMarker = cType === "special" || cType === "ova" || cType === "movie" || /\b(special|speciale|ova|oav|movie|film|recap|extra|zero|episodio\s*0|ep\s*0)\b/i.test(lower);
              if (!hasSpecialMarker) return false;
              const candidateTokens = tokenizeLooseText(raw);
              const targetPool = [
                title,
                originalTitle,
                ...(metadata.mappedTitleHints || []).slice(0, 10)
              ].filter(Boolean);
              return targetPool.some((target) => {
                const targetTokens = tokenizeLooseText(target);
                if (targetTokens.length > 0 && candidateTokens.length > 0) {
                  const matched = targetTokens.filter((t) => candidateTokens.includes(t)).length;
                  const minNeeded = Math.max(1, Math.ceil(targetTokens.length * 0.6));
                  if (matched >= minNeeded) return true;
                }
                const cNorm = normalizeLooseText(raw);
                const tNorm = normalizeLooseText(target);
                if (!tNorm) return false;
                return cNorm === tNorm || cNorm.startsWith(`${tNorm} `) || cNorm.includes(` ${tNorm} `) || cNorm.endsWith(` ${tNorm}`);
              });
            };
            if (bestSub && !isSeasonZeroCandidate(bestSub)) {
              console.log(`[AnimeWorld] Discarding SUB candidate for Season 0: ${bestSub.title}`);
              bestSub = null;
            }
            if (bestDub && !isSeasonZeroCandidate(bestDub)) {
              console.log(`[AnimeWorld] Discarding DUB candidate for Season 0: ${bestDub.title}`);
              bestDub = null;
            }
          }
          const results = [];
          const parseEpisodeNumber = (value) => {
            if (value === null || value === void 0) return null;
            const raw = String(value).trim();
            if (!raw) return null;
            if (/^\d+$/.test(raw)) {
              const n2 = parseInt(raw, 10);
              return Number.isInteger(n2) && n2 > 0 ? n2 : null;
            }
            if (/^\d+\.0+$/.test(raw)) {
              const n2 = parseInt(raw, 10);
              return Number.isInteger(n2) && n2 > 0 ? n2 : null;
            }
            const match = raw.match(/\b(\d+)\b/);
            if (!match) return null;
            const n = parseInt(match[1], 10);
            return Number.isInteger(n) && n > 0 ? n : null;
          };
          const parseEpisodeSpan = (value) => {
            if (value === null || value === void 0) return null;
            const raw = String(value).trim();
            if (!raw) return null;
            const rangeMatch = raw.match(/(\d+)\s*[-\u2013\u2014]\s*(\d+)/);
            if (rangeMatch) {
              const a = parseInt(rangeMatch[1], 10);
              const b = parseInt(rangeMatch[2], 10);
              if (Number.isInteger(a) && Number.isInteger(b) && a > 0 && b > 0) {
                return { min: Math.min(a, b), max: Math.max(a, b), list: [a, b] };
              }
            }
            const nums = (raw.match(/\d+/g) || []).map((x) => parseInt(x, 10)).filter((n) => Number.isInteger(n) && n > 0);
            if (nums.length === 0) return null;
            const unique = [...new Set(nums)];
            return { min: Math.min(...unique), max: Math.max(...unique), list: unique };
          };
          const episodeEntryCoversNumber = (entry, wantedNumber) => {
            const wanted = parseInt(wantedNumber, 10);
            if (!entry || !Number.isInteger(wanted) || wanted <= 0) return false;
            const directNum = parseEpisodeNumber(entry.num);
            if (directNum === wanted) return true;
            const spanSources = [entry.rangeLabel, entry.baseLabel, entry.commentLabel];
            for (const src of spanSources) {
              const span = parseEpisodeSpan(src);
              if (!span) continue;
              if (span.list.includes(wanted)) return true;
              if (span.max - span.min <= 3 && wanted >= span.min && wanted <= span.max) return true;
            }
            return false;
          };
          const getEpisodeDisplayLabel = (entry, requestedNumber = null) => {
            if (!entry) return null;
            const requested = parseInt(requestedNumber, 10);
            const spanSources = [entry.rangeLabel, entry.baseLabel, entry.commentLabel];
            for (const src of spanSources) {
              const span = parseEpisodeSpan(src);
              if (!span) continue;
              const isRange = span.max > span.min;
              if (!isRange) continue;
              const coversRequested = Number.isInteger(requested) ? span.list.includes(requested) || span.max - span.min <= 3 && requested >= span.min && requested <= span.max : true;
              if (coversRequested) {
                return `${span.min}-${span.max}`;
              }
            }
            if (Number.isInteger(requested) && episodeEntryCoversNumber(entry, requested)) {
              return String(requested);
            }
            const direct = parseEpisodeNumber(entry.num);
            if (Number.isInteger(direct)) return String(direct);
            return null;
          };
          const findEpisodeByNumber = (episodes, targetNumber) => {
            const wanted = parseInt(targetNumber, 10);
            if (!Number.isInteger(wanted) || wanted <= 0 || !Array.isArray(episodes)) return null;
            const exact = episodes.find((ep) => parseEpisodeNumber(ep == null ? void 0 : ep.num) === wanted);
            if (exact) return exact;
            return episodes.find((ep) => episodeEntryCoversNumber(ep, wanted)) || null;
          };
          const getEpisodeRangeLabel = (episodes) => {
            if (!Array.isArray(episodes) || episodes.length === 0) return "None";
            const numbers = episodes.map((ep) => parseEpisodeNumber(ep == null ? void 0 : ep.num)).filter((n) => Number.isInteger(n) && n > 0);
            if (numbers.length === 0) return "None";
            const min = Math.min(...numbers);
            const max = Math.max(...numbers);
            return `${min}-${max}`;
          };
          const getPartIndexFromMatch = (candidate) => {
            const raw = String((candidate == null ? void 0 : candidate.title) || "").toLowerCase();
            let match = raw.match(/\bpart(?:e)?\s*(\d+)\b/i);
            if (match) return parseInt(match[1], 10);
            match = raw.match(/\b(\d+)(?:st|nd|rd|th)\s*part\b/i);
            if (match) return parseInt(match[1], 10);
            match = raw.match(/\bcour\s*(\d+)\b/i);
            if (match) return parseInt(match[1], 10);
            match = raw.match(/\b(\d+)(?:st|nd|rd|th)\s*cour\b/i);
            if (match) return parseInt(match[1], 10);
            return null;
          };
          const extractYearFromCandidate = (candidate) => {
            const yearMatch = String((candidate == null ? void 0 : candidate.date) || "").match(/(\d{4})/);
            if (!yearMatch) return null;
            const y = parseInt(yearMatch[1], 10);
            return Number.isInteger(y) ? y : null;
          };
          const pickNextSplitCourCandidate = (currentMatch, candidatePool = [], mappedEpisode = null) => {
            const currentPart = getPartIndexFromMatch(currentMatch) || 1;
            const seasonTokenRegex = new RegExp(`\\b${season}\\b|season\\s*${season}|stagione\\s*${season}`, "i");
            const splitTokenRegex = /\b(part|parte|cour|arc|saga|chapter)\b|\b\w+(?:-|\s)?hen\b/i;
            const currentYear = extractYearFromCandidate(currentMatch);
            let explicitBest = null;
            let genericBest = null;
            for (const c of candidatePool) {
              if (!c || c.href === currentMatch.href) continue;
              const raw = String(c.title || "");
              const lower = raw.toLowerCase();
              if (/\b(movie|film|special|ova|oav|recap|reflection)\b/i.test(lower)) continue;
              const isSeriesRelevant = checkSimilarity(c.title, title) || checkSimilarity(c.title, `${title} ${season}`) || checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title, `${originalTitle} ${season}`) || isRelevantByLooseMatch(c.title, [title, originalTitle, seasonName, `${title} ${season}`, `${originalTitle} ${season}`].filter(Boolean));
              if (!isSeriesRelevant) continue;
              const part = getPartIndexFromMatch(c);
              const cYear = extractYearFromCandidate(c);
              const yearDiff = Number.isInteger(currentYear) && Number.isInteger(cYear) ? Math.abs(cYear - currentYear) : Number.MAX_SAFE_INTEGER;
              const seasonYearDiff = Number.isInteger(seasonYear) && Number.isInteger(cYear) ? Math.abs(cYear - seasonYear) : Number.MAX_SAFE_INTEGER;
              if (part && part > currentPart) {
                let score2 = 0;
                if (seasonTokenRegex.test(raw)) score2 += 4;
                if (/(part|parte|cour)\s*\d+/i.test(lower)) score2 += 3;
                if (checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle)) score2 += 2;
                if (yearDiff === 0) score2 += 2;
                else if (yearDiff === 1) score2 += 1;
                if (!explicitBest || score2 > explicitBest.score || score2 === explicitBest.score && part < explicitBest.part || score2 === explicitBest.score && part === explicitBest.part && yearDiff < explicitBest.yearDiff || score2 === explicitBest.score && part === explicitBest.part && yearDiff === explicitBest.yearDiff && raw.length < String(explicitBest.candidate.title || "").length) {
                  explicitBest = { candidate: c, part, score: score2, yearDiff };
                }
                continue;
              }
              const hasSeasonToken = seasonTokenRegex.test(raw);
              const hasSplitToken = splitTokenRegex.test(raw);
              const hasNumericToken = /\b\d+\b/.test(raw);
              if (!hasSeasonToken && !hasSplitToken && !hasNumericToken) continue;
              let score = 0;
              if (hasSeasonToken) score += 5;
              if (hasSplitToken) score += 3;
              if (/(part|parte|cour)\s*\d+/i.test(lower)) score += 2;
              if (checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle)) score += 3;
              if (seasonName && checkSimilarity(c.title, seasonName)) score += 2;
              const endingNum = /(\d+)\s*(?:\)|\]|\s)*$/i.exec(raw);
              if (endingNum) {
                const endN = parseInt(endingNum[1], 10);
                if (Number.isInteger(endN) && endN === season) score += 2;
              }
              if (yearDiff === 0) score += 2;
              else if (yearDiff === 1) score += 1;
              if (seasonYearDiff === 0) score += 1;
              if (!genericBest || score > genericBest.score || score === genericBest.score && yearDiff < genericBest.yearDiff || score === genericBest.score && yearDiff === genericBest.yearDiff && seasonYearDiff < genericBest.seasonYearDiff || score === genericBest.score && yearDiff === genericBest.yearDiff && seasonYearDiff === genericBest.seasonYearDiff && raw.length < String(genericBest.candidate.title || "").length) {
                genericBest = { candidate: c, score, yearDiff, seasonYearDiff };
              }
            }
            if (explicitBest) return explicitBest.candidate;
            if (mappedEpisode !== null && mappedEpisode !== void 0 && mappedEpisode <= 0) return null;
            return genericBest ? genericBest.candidate : null;
          };
          const processMatch = (_0, _1, _2, ..._3) => __async(null, [_0, _1, _2, ..._3], function* (match, isDub, candidatePool, requestedEpisode = episode, allowSplitFallback = true) {
            if (!match) return;
            const animeUrl = `${BASE_URL}${match.href}`;
            console.log(`[AnimeWorld] Fetching episodes from: ${animeUrl}`);
            try {
              const res = yield fetch(animeUrl, {
                headers: {
                  "User-Agent": USER_AGENT,
                  "Referer": BASE_URL
                }
              });
              if (!res.ok) return;
              const html = yield res.text();
              const episodeRegex = /data-episode-num="([^"]*)"[^>]*data-id="([^"]*)"/g;
              const episodes = [];
              const linkRegex = /<a[^>]*class="[^"]*episode[^"]*"[^>]*>|<li[^>]*class="episode"[^>]*>([\s\S]*?)<\/li>/g;
              const allATags = html.match(/<a[^>]+data-episode-num="[^"]+"[^>]*>/g) || [];
              for (const tag of allATags) {
                const numMatch = /data-episode-num="([^"]+)"/.exec(tag);
                const idMatch = /data-id="([^"]+)"/.exec(tag);
                const rangeMatch = /data-num="([^"]+)"/.exec(tag);
                const baseMatch = /data-base="([^"]+)"/.exec(tag);
                const commentMatch = /data-comment="([^"]+)"/.exec(tag);
                if (numMatch && idMatch) {
                  episodes.push({
                    num: numMatch[1],
                    id: idMatch[1],
                    rangeLabel: rangeMatch ? rangeMatch[1] : null,
                    baseLabel: baseMatch ? baseMatch[1] : null,
                    commentLabel: commentMatch ? commentMatch[1] : null
                  });
                }
              }
              const numericEpisodes = episodes.map((e) => parseInt(e.num, 10)).filter((n) => Number.isInteger(n) && n > 0);
              const maxEpisodeInPart = numericEpisodes.length > 0 ? Math.max(...numericEpisodes) : 0;
              let localRequestedEpisode = requestedEpisode;
              if (season > 1 && type !== "movie" && !isLongSeriesAbsolute) {
                const currentPart = getPartIndexFromMatch(match);
                if (currentPart && currentPart > 1 && maxEpisodeInPart > 0 && requestedEpisode > maxEpisodeInPart) {
                  const remappedEpisode = requestedEpisode - (currentPart - 1) * maxEpisodeInPart;
                  if (remappedEpisode > 0 && remappedEpisode <= maxEpisodeInPart) {
                    console.log(`[AnimeWorld] Split-cour local remap: "${match.title}", mapped episode ${requestedEpisode} -> ${remappedEpisode}`);
                    localRequestedEpisode = remappedEpisode;
                  }
                }
              }
              let requestedEpisodeForLabel = localRequestedEpisode;
              let targetEp;
              let prioritizeAbsolute = Boolean(isLongSeriesAbsolute && season > 1 && type !== "movie");
              if (season > 1 && type !== "movie" && !isLongSeriesAbsolute) {
                const normMatch = (match.title || "").toLowerCase().replace(/\(ita\)/g, "").replace(/\(sub ita\)/g, "").trim();
                const normSeries = (title || "").toLowerCase().trim();
                const normOriginalSeries = (originalTitle || "").toLowerCase().trim();
                const isBaseSeriesEntry = normMatch === normSeries || normOriginalSeries && normMatch === normOriginalSeries;
                if (isBaseSeriesEntry) {
                  prioritizeAbsolute = true;
                } else {
                  const hasSpecificMarkers = /\b(season|stagione|part|parte)\b|\b(movie|film)\b|\b(special|oav|ova)\b/i.test(normMatch);
                  const hasSubtitle = normMatch.includes(":");
                  const endsWithNumber = /(\d+)$/.exec(normMatch);
                  let isSeasonNumber = false;
                  if (endsWithNumber) {
                    const num = parseInt(endsWithNumber[1]);
                    if (num < 1900) isSeasonNumber = true;
                  }
                  if (!hasSpecificMarkers && !hasSubtitle && !isSeasonNumber) {
                    const includesSeasonName = seasonName && normMatch.includes(seasonName.toLowerCase());
                    if (!includesSeasonName && (normMatch.includes(normSeries) || normSeries.includes(normMatch))) {
                      prioritizeAbsolute = true;
                    }
                  }
                }
                const absEpisode = calculateAbsoluteEpisode(metadata, season, localRequestedEpisode);
                if (absEpisode == localRequestedEpisode) prioritizeAbsolute = false;
              }
              if (type === "movie") {
                if (episodes.length > 0) {
                  targetEp = episodes[0];
                }
              } else {
                if (prioritizeAbsolute) {
                  const absEpisode = calculateAbsoluteEpisode(metadata, season, localRequestedEpisode);
                  requestedEpisodeForLabel = absEpisode;
                  console.log(`[AnimeWorld] Prioritizing absolute episode: ${absEpisode} for "${match.title}"`);
                  targetEp = findEpisodeByNumber(episodes, absEpisode);
                  if (!targetEp) {
                    console.log(`[AnimeWorld] Absolute episode ${absEpisode} not found in list. Available range: ${getEpisodeRangeLabel(episodes)}`);
                  }
                } else {
                  targetEp = findEpisodeByNumber(episodes, localRequestedEpisode);
                }
              }
              if (!targetEp && season > 1 && !prioritizeAbsolute) {
                const absEpisode = calculateAbsoluteEpisode(metadata, season, localRequestedEpisode);
                if (absEpisode != localRequestedEpisode) {
                  requestedEpisodeForLabel = absEpisode;
                  console.log(`[AnimeWorld] Relative episode ${localRequestedEpisode} not found, trying absolute: ${absEpisode}`);
                  targetEp = findEpisodeByNumber(episodes, absEpisode);
                }
              }
              if (!targetEp && allowSplitFallback && season > 1 && type !== "movie" && !isLongSeriesAbsolute) {
                if (maxEpisodeInPart > 0 && localRequestedEpisode > maxEpisodeInPart) {
                  const mappedEpisode = localRequestedEpisode - maxEpisodeInPart;
                  const nextCandidate = pickNextSplitCourCandidate(match, candidatePool || [], mappedEpisode);
                  if (nextCandidate && mappedEpisode > 0) {
                    console.log(`[AnimeWorld] Split-cour switch: "${match.title}" -> "${nextCandidate.title}", mapped episode ${localRequestedEpisode} -> ${mappedEpisode}`);
                    yield processMatch(nextCandidate, isDub, candidatePool, mappedEpisode, false);
                    return;
                  }
                }
              }
              if (targetEp) {
                const episodeId = targetEp.id;
                const infoUrl = `${BASE_URL}/api/episode/info?id=${episodeId}`;
                const infoRes = yield fetch(infoUrl, {
                  headers: {
                    "User-Agent": USER_AGENT,
                    "Referer": animeUrl,
                    "X-Requested-With": "XMLHttpRequest"
                  }
                });
                if (infoRes.ok) {
                  const infoData = yield infoRes.json();
                  if (infoData.grabber) {
                    let quality = "auto";
                    if (infoData.grabber.includes(".m3u8")) {
                      const playlistQuality = yield checkQualityFromPlaylist(infoData.grabber, {
                        "User-Agent": USER_AGENT,
                        "Referer": animeUrl
                      });
                      if (playlistQuality) quality = playlistQuality;
                    }
                    if (quality === "auto") {
                      if (infoData.grabber.includes("1080p")) quality = "1080p";
                      else if (infoData.grabber.includes("720p")) quality = "720p";
                      else if (infoData.grabber.includes("480p")) quality = "480p";
                      else if (infoData.grabber.includes("360p")) quality = "360p";
                    }
                    let host = "";
                    try {
                      const urlObj = new URL(infoData.grabber);
                      host = urlObj.hostname.replace("www.", "");
                      if (host.includes("sweetpixel")) host = "SweetPixel";
                      else if (host.includes("stream")) host = "Stream";
                    } catch (e) {
                    }
                    const baseName = isDub ? "AnimeWorld (ITA)" : "AnimeWorld (SUB ITA)";
                    const serverName = host ? `${baseName} - ${host}` : baseName;
                    let displayTitle = match.title;
                    let displayEpisodeLabel = null;
                    if (targetEp) {
                      const requestedNum = parseInt(requestedEpisodeForLabel, 10);
                      displayEpisodeLabel = getEpisodeDisplayLabel(targetEp, requestedNum);
                    }
                    if (!displayEpisodeLabel && requestedEpisodeForLabel) {
                      displayEpisodeLabel = String(requestedEpisodeForLabel);
                    }
                    if (displayEpisodeLabel) {
                      displayTitle += ` - Ep ${displayEpisodeLabel}`;
                    }
                    if (isDub && !displayTitle.includes("(ITA)")) displayTitle += " (ITA)";
                    if (!isDub && !displayTitle.includes("(SUB ITA)")) displayTitle += " (SUB ITA)";
                    const blockedDomains = ["jujutsukaisenanime.com", "onepunchman.it", "dragonballhd.it", "narutolegend.it"];
                    const lowerLink = (infoData.grabber || "").toLowerCase();
                    if (lowerLink.endsWith(".mkv.mp4") || blockedDomains.some((d) => lowerLink.includes(d))) {
                      console.log(`[AnimeWorld] Skipping unwanted link: ${infoData.grabber}`);
                    } else {
                      results.push({
                        name: serverName,
                        title: displayTitle,
                        server: serverName,
                        url: infoData.grabber,
                        quality,
                        isM3U8: infoData.grabber.includes(".m3u8"),
                        headers: {
                          "User-Agent": USER_AGENT,
                          "Referer": animeUrl
                        }
                      });
                    }
                  }
                }
              } else {
                console.log(`[AnimeWorld] Episode ${requestedEpisode} not found in ${match.title}`);
              }
            } catch (e) {
              console.error("[AnimeWorld] Error processing match:", e);
            }
          });
          if (bestSub) yield processMatch(bestSub, false, subs, episode, true);
          if (bestDub) yield processMatch(bestDub, true, dubs, episode, true);
          return results.map((s) => formatStream(s, "AnimeWorld")).filter((s) => s !== null);
        } catch (e) {
          console.error("[AnimeWorld] getStreams error:", e);
          return [];
        }
      });
    }
    module2.exports = {
      getStreams: getStreams2,
      searchAnime,
      getMetadata,
      findBestMatch,
      checkSimilarity
    };
  }
});

// src/guardahd/index.js
var require_guardahd = __commonJS({
  "src/guardahd/index.js"(exports2, module2) {
    var __async2 = (__this, __arguments, generator) => {
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
    var BASE_URL = "https://guardahd.stream";
    var TMDB_API_KEY2 = "68e094699525b18a70bab2f86b1fa706";
    var USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
    var { extractMixDrop, extractDropLoad, extractSuperVideo } = require_extractors();
    require_fetch_helper();
    var { getTmdbFromKitsu: getTmdbFromKitsu2 } = require_tmdb_helper();
    var { formatStream } = require_formatter();
    var { checkQualityFromPlaylist, getQualityFromUrl } = require_quality_helper();
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
    function getImdbId(tmdbId, type) {
      return __async2(this, null, function* () {
        try {
          const normalizedType = String(type).toLowerCase();
          const endpoint = normalizedType === "movie" ? "movie" : "tv";
          const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY2}`;
          const response = yield fetch(url);
          if (!response.ok) return null;
          const data = yield response.json();
          if (data.imdb_id) {
            console.log(`[GuardaHD] Converted TMDB ${tmdbId} to IMDb ${data.imdb_id}`);
            return data.imdb_id;
          }
          const externalUrl = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY2}`;
          const extResponse = yield fetch(externalUrl);
          if (extResponse.ok) {
            const extData = yield extResponse.json();
            if (extData.imdb_id) {
              console.log(`[GuardaHD] Converted TMDB ${tmdbId} to IMDb ${extData.imdb_id} (via external_ids)`);
              return extData.imdb_id;
            }
          }
          console.log(`[GuardaHD] Failed to convert TMDB ${tmdbId} to IMDb`);
          return null;
        } catch (e) {
          console.error("[GuardaHD] Conversion error:", e);
          return null;
        }
      });
    }
    function getMetadata(id, type) {
      return __async2(this, null, function* () {
        try {
          const normalizedType = String(type).toLowerCase();
          let queryId = id;
          if (String(id).startsWith("kitsu:")) {
            const resolved = yield getTmdbFromKitsu2(id);
            if (resolved && resolved.tmdbId) {
              queryId = resolved.tmdbId;
              console.log(`[GuardaHD] Resolved Kitsu ID ${id} to ID ${queryId}`);
            } else {
              console.log(`[GuardaHD] Could not convert ${id} to usable ID`);
              return null;
            }
          }
          let url;
          if (String(queryId).startsWith("tt")) {
            url = `https://api.themoviedb.org/3/find/${queryId}?api_key=${TMDB_API_KEY2}&external_source=imdb_id&language=it-IT`;
          } else {
            const endpoint = normalizedType === "movie" ? "movie" : "tv";
            url = `https://api.themoviedb.org/3/${endpoint}/${queryId}?api_key=${TMDB_API_KEY2}&language=it-IT`;
          }
          const response = yield fetch(url);
          if (!response.ok) return null;
          const data = yield response.json();
          if (String(queryId).startsWith("tt")) {
            const results = normalizedType === "movie" ? data.movie_results : data.tv_results;
            if (results && results.length > 0) return results[0];
          } else {
            return data;
          }
          return null;
        } catch (e) {
          console.error("[GuardaHD] Metadata error:", e);
          return null;
        }
      });
    }
    function getStreams2(id, type, season, episode) {
      if (["series", "tv"].includes(String(type).toLowerCase())) return [];
      return __async2(this, null, function* () {
        let cleanId = id.toString();
        if (cleanId.startsWith("kitsu:")) {
          const resolved = yield getTmdbFromKitsu2(cleanId);
          if (resolved && resolved.tmdbId) {
            console.log(`[GuardaHD] Resolved Kitsu ID ${cleanId} to ID ${resolved.tmdbId}`);
            cleanId = String(resolved.tmdbId);
            if (resolved.season) {
              console.log(`[GuardaHD] Kitsu mapping indicates Season ${resolved.season}. Overriding requested Season ${season}`);
              season = resolved.season;
            }
          } else {
            console.log(`[GuardaHD] Could not convert ${cleanId} to usable ID`);
            return [];
          }
        }
        if (cleanId.startsWith("tmdb:")) cleanId = cleanId.replace("tmdb:", "");
        let imdbId = cleanId;
        if (!cleanId.startsWith("tt")) {
          const convertedId = yield getImdbId(cleanId, type);
          if (convertedId) imdbId = convertedId;
          else return [];
        }
        let metadata = null;
        try {
          metadata = yield getMetadata(cleanId, type);
        } catch (e) {
          console.error("[GuardaHD] Error fetching metadata:", e);
        }
        const title = metadata && (metadata.title || metadata.name || metadata.original_title || metadata.original_name) ? metadata.title || metadata.name || metadata.original_title || metadata.original_name : normalizedType === "movie" ? "Film Sconosciuto" : "Serie TV";
        let url;
        const normalizedType = String(type).toLowerCase();
        if (normalizedType === "movie") {
          url = `${BASE_URL}/set-movie-a/${imdbId}`;
        } else if (normalizedType === "tv") {
          url = `${BASE_URL}/set-tv-a/${imdbId}/${season}/${episode}`;
        } else {
          return [];
        }
        try {
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": BASE_URL
            }
          });
          if (!response.ok) return [];
          const html = yield response.text();
          const streams = [];
          const iframeRegex = /<iframe[^>]+id=["']_player["'][^>]+src=["']([^"']+)["']/;
          const iframeMatch = iframeRegex.exec(html);
          const links = [];
          if (iframeMatch) {
            links.push({ url: iframeMatch[1], name: "Active Player" });
          }
          const linkRegex = /data-link=["']([^"']+)["']/g;
          let match;
          while ((match = linkRegex.exec(html)) !== null) {
            links.push({ url: match[1], name: "Alternative" });
          }
          const displayName = normalizedType === "movie" ? title : `${title} ${season}x${episode}`;
          const processUrl = (link) => __async(null, null, function* () {
            let streamUrl = link.url;
            if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
            try {
              if (streamUrl.includes("mixdrop") || streamUrl.includes("m1xdrop")) {
                console.log(`[GuardaHD] Attempting MixDrop extraction for ${streamUrl}`);
                const extracted = yield extractMixDrop(streamUrl);
                if (extracted && extracted.url) {
                  let quality = "HD";
                  const playlistQuality = yield checkQualityFromPlaylist(extracted.url, extracted.headers);
                  if (playlistQuality) quality = playlistQuality;
                  else {
                    const urlQuality = getQualityFromUrl(extracted.url);
                    if (urlQuality) quality = urlQuality;
                  }
                  const normalizedQuality = getQualityFromName(quality);
                  streams.push({
                    name: `GuardaHD - MixDrop`,
                    title: displayName,
                    url: extracted.url,
                    headers: extracted.headers,
                    quality: normalizedQuality,
                    type: "direct"
                  });
                }
              } else if (streamUrl.includes("dropload")) {
                console.log(`[GuardaHD] Attempting DropLoad extraction for ${streamUrl}`);
                const extracted = yield extractDropLoad(streamUrl);
                if (extracted && extracted.url) {
                  let quality = "HD";
                  const playlistQuality = yield checkQualityFromPlaylist(extracted.url, extracted.headers);
                  if (playlistQuality) quality = playlistQuality;
                  else {
                    const urlQuality = getQualityFromUrl(extracted.url);
                    if (urlQuality) quality = urlQuality;
                  }
                  const normalizedQuality = getQualityFromName(quality);
                  streams.push({
                    name: `GuardaHD - DropLoad`,
                    title: displayName,
                    url: extracted.url,
                    headers: extracted.headers,
                    quality: normalizedQuality,
                    type: "direct"
                  });
                }
              } else if (streamUrl.includes("supervideo")) {
                console.log(`[GuardaHD] Attempting SuperVideo extraction for ${streamUrl}`);
                const extracted = yield extractSuperVideo(streamUrl);
                if (extracted) {
                  let quality = "HD";
                  const playlistQuality = yield checkQualityFromPlaylist(extracted);
                  if (playlistQuality) quality = playlistQuality;
                  else {
                    const urlQuality = getQualityFromUrl(extracted);
                    if (urlQuality) quality = urlQuality;
                  }
                  const normalizedQuality = getQualityFromName(quality);
                  streams.push({
                    name: `GuardaHD - SuperVideo`,
                    title: displayName,
                    url: extracted,
                    quality: normalizedQuality,
                    type: "direct"
                  });
                }
              }
            } catch (e) {
              console.error("[GuardaHD] Process URL error:", e);
            }
          });
          yield Promise.all(links.map((link) => processUrl(link)));
          const uniqueStreams = [];
          const seenUrls = /* @__PURE__ */ new Set();
          for (const s of streams) {
            if (!seenUrls.has(s.url)) {
              seenUrls.add(s.url);
              uniqueStreams.push(s);
            }
          }
          return uniqueStreams.map((s) => formatStream(s, "GuardaHD")).filter((s) => s !== null);
        } catch (error) {
          console.error("[GuardaHD] Error:", error);
          return [];
        }
      });
    }
    module2.exports = { getStreams: getStreams2 };
  }
});

// src/guardaserie/index.js
var require_guardaserie = __commonJS({
  "src/guardaserie/index.js"(exports2, module2) {
    var __async2 = (__this, __arguments, generator) => {
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
    var BASE_URL = "https://guardaserietv.autos";
    var TMDB_API_KEY2 = "68e094699525b18a70bab2f86b1fa706";
    var USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
    var { extractMixDrop, extractDropLoad, extractSuperVideo, extractUqload, extractUpstream } = require_extractors();
    require_fetch_helper();
    var { getSeasonEpisodeFromAbsolute, getTmdbFromKitsu: getTmdbFromKitsu2 } = require_tmdb_helper();
    var { checkQualityFromPlaylist } = require_quality_helper();
    var { formatStream } = require_formatter();
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
    function getImdbId(tmdbId, type) {
      return __async2(this, null, function* () {
        try {
          const endpoint = type === "movie" ? "movie" : "tv";
          const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY2}`;
          const response = yield fetch(url);
          if (!response.ok) return null;
          const data = yield response.json();
          if (data.imdb_id) return data.imdb_id;
          const externalUrl = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY2}`;
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
    }
    function getShowInfo(tmdbId, type) {
      return __async2(this, null, function* () {
        try {
          const endpoint = type === "movie" ? "movie" : "tv";
          const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY2}&language=it-IT`;
          const response = yield fetch(url);
          if (!response.ok) return null;
          return yield response.json();
        } catch (e) {
          console.error("[Guardaserie] TMDB error:", e);
          return null;
        }
      });
    }
    function getTmdbIdFromImdb(imdbId, type) {
      return __async2(this, null, function* () {
        var _a, _b;
        try {
          const url = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY2}&external_source=imdb_id`;
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
    }
    function verifyMoviePlayer(url, targetYear) {
      return __async2(this, null, function* () {
        try {
          console.log(`[Guardaserie] Verifying via MoviePlayer: ${url}`);
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT
            }
          });
          if (!response.ok) return false;
          const html = yield response.text();
          const yearMatch1 = html.match(/trasmessa dal (\d{4})/i);
          if (yearMatch1) {
            const found = parseInt(yearMatch1[1]);
            if (Math.abs(found - targetYear) <= 1) {
              console.log(`[Guardaserie] MoviePlayer verified year ${found} (Target: ${targetYear})`);
              return true;
            }
          }
          const yearMatch2 = html.match(/Prima messa in onda originale.*?(\d{4})/i);
          if (yearMatch2) {
            const found = parseInt(yearMatch2[1]);
            if (Math.abs(found - targetYear) <= 1) {
              console.log(`[Guardaserie] MoviePlayer verified year ${found} (Target: ${targetYear})`);
              return true;
            }
          }
          const titleMatch = html.match(new RegExp("<title>.*\\(.*(\\d{4}).*\\).*<\\/title>", "is"));
          if (titleMatch) {
            const found = parseInt(titleMatch[1]);
            if (Math.abs(found - targetYear) <= 2) {
              console.log(`[Guardaserie] MoviePlayer verified title year ${found} (Target: ${targetYear})`);
              return true;
            }
          }
          console.log(`[Guardaserie] MoviePlayer verification failed. Target Year: ${targetYear}`);
          return false;
        } catch (e) {
          console.error("[Guardaserie] MoviePlayer error:", e);
          return false;
        }
      });
    }
    function getStreams2(id, type, season, episode, providerContext = null) {
      if (["movie"].includes(String(type).toLowerCase())) return [];
      return __async2(this, null, function* () {
        if (String(type).toLowerCase() === "movie") return [];
        try {
          let tmdbId = id;
          let imdbId = null;
          const contextTmdbId = providerContext && /^\d+$/.test(String(providerContext.tmdbId || "")) ? String(providerContext.tmdbId) : null;
          const contextImdbId = providerContext && /^tt\d+$/i.test(String(providerContext.imdbId || "")) ? String(providerContext.imdbId) : null;
          const parsedContextSeason = parseInt(providerContext && providerContext.canonicalSeason, 10);
          const hasContextSeason = Number.isInteger(parsedContextSeason) && parsedContextSeason >= 0;
          if (id.toString().startsWith("tt")) {
            const imdbCore = (id.toString().match(/tt\d{7,8}/) || [])[0] || id.toString();
            imdbId = imdbCore;
            if (contextTmdbId) {
              tmdbId = contextTmdbId;
              console.log(`[Guardaserie] Using prefetched TMDB ID ${tmdbId} for ${id}`);
            } else {
              tmdbId = yield getTmdbIdFromImdb(imdbCore, type);
              if (!tmdbId) {
                console.log(`[Guardaserie] Could not convert ${id} to TMDB ID. Continuing with IMDb ID.`);
              } else {
                console.log(`[Guardaserie] Converted ${id} to TMDB ID: ${tmdbId}`);
              }
            }
          } else if (id.toString().startsWith("kitsu:")) {
            if (contextTmdbId) {
              tmdbId = contextTmdbId;
              if (hasContextSeason && season !== parsedContextSeason) {
                console.log(`[Guardaserie] Prefetched mapping indicates Season ${parsedContextSeason}. Overriding requested Season ${season}`);
                season = parsedContextSeason;
              }
              console.log(`[Guardaserie] Using prefetched mapping for ${id} -> TMDB ${tmdbId}, Season ${season}`);
            } else {
              const resolved = yield getTmdbFromKitsu2(id);
              if (resolved && resolved.tmdbId) {
                tmdbId = resolved.tmdbId;
                if (resolved.season) {
                  console.log(`[Guardaserie] Kitsu mapping indicates Season ${resolved.season}. Overriding requested Season ${season}`);
                  season = resolved.season;
                }
                console.log(`[Guardaserie] Resolved Kitsu ID ${id} to TMDB ID ${tmdbId}, Season ${season}`);
              } else {
                console.log(`[Guardaserie] Could not convert ${id} to TMDB ID`);
                return [];
              }
            }
          } else if (id.toString().startsWith("tmdb:")) {
            tmdbId = id.toString().replace("tmdb:", "");
          }
          if (!imdbId && tmdbId) {
            if (contextImdbId) {
              imdbId = contextImdbId;
              console.log(`[Guardaserie] Using prefetched IMDb ID ${imdbId} for verification`);
            } else {
              try {
                const resolvedImdb = yield getImdbId(tmdbId, type);
                if (resolvedImdb) {
                  imdbId = resolvedImdb;
                  console.log(`[Guardaserie] Resolved TMDB ID ${tmdbId} to IMDb ID ${imdbId} for verification`);
                }
              } catch (e) {
                console.log(`[Guardaserie] Failed to resolve IMDb ID for verification: ${e.message}`);
              }
            }
          }
          let showInfo = null;
          try {
            if (tmdbId) showInfo = yield getShowInfo(tmdbId, type);
          } catch (e) {
            console.error("[Guardaserie] Error fetching show info:", e);
          }
          if (!showInfo && !imdbId) return [];
          let title = "Serie TV";
          if (showInfo) {
            title = showInfo.name || showInfo.original_name || showInfo.title || showInfo.original_title || "Serie TV";
          } else if (imdbId) {
            title = imdbId;
          }
          let mappedSeason = null;
          let mappedEpisode = null;
          if (season === 1 && episode > 20 && tmdbId) {
            try {
              const mapped = yield getSeasonEpisodeFromAbsolute(tmdbId, episode);
              if (mapped) {
                console.log(`[Guardaserie] Mapped absolute episode ${episode} to Season ${mapped.season}, Episode ${mapped.episode}`);
                mappedSeason = mapped.season;
                mappedEpisode = mapped.episode;
              }
            } catch (e) {
              console.error("[Guardaserie] Error mapping episode:", e);
            }
          }
          const year = showInfo && showInfo.first_air_date ? showInfo.first_air_date.split("-")[0] : "";
          const metaYear = year ? parseInt(year) : null;
          let showUrl = null;
          let showHtml = null;
          if (imdbId) {
            console.log(`[Guardaserie] Searching by IMDb ID: ${imdbId}`);
            try {
              const params = new URLSearchParams();
              params.append("do", "search");
              params.append("subaction", "search");
              params.append("story", imdbId);
              const searchUrl = `${BASE_URL}/index.php?${params.toString()}`;
              const searchResponse = yield fetch(searchUrl, {
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                  "Referer": BASE_URL
                }
              });
              if (searchResponse.ok) {
                const searchHtml = yield searchResponse.text();
                const resultRegex = /<div class="mlnh-2">\s*<h2>\s*<a href="([^"]+)" title="([^"]+)">/i;
                const match = resultRegex.exec(searchHtml);
                if (match) {
                  let foundUrl = match[1];
                  const foundTitle = match[2];
                  if (foundTitle.toUpperCase().includes("[SUB ITA]")) {
                    console.log(`[Guardaserie] Filtering out subbed result from IMDb search: ${foundTitle}`);
                  } else {
                    if (foundUrl.startsWith("/")) foundUrl = `${BASE_URL}${foundUrl}`;
                    console.log(`[Guardaserie] Found match by IMDb ID: ${foundUrl}`);
                    const pageResponse = yield fetch(foundUrl, {
                      headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Referer": BASE_URL
                      }
                    });
                    if (pageResponse.ok) {
                      showHtml = yield pageResponse.text();
                      showUrl = foundUrl;
                    }
                  }
                }
              }
            } catch (e) {
              console.error(`[Guardaserie] Error searching by IMDb ID:`, e);
            }
          }
          if (!showUrl) {
            let candidates = [];
            console.log(`[Guardaserie] Searching by Title: ${title} (${year})`);
            const params = new URLSearchParams();
            params.append("do", "search");
            params.append("subaction", "search");
            params.append("story", title);
            const searchUrl = `${BASE_URL}/index.php?${params.toString()}`;
            const searchResponse = yield fetch(searchUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": BASE_URL
              }
            });
            const searchHtml = yield searchResponse.text();
            const resultRegex = /<div class="mlnh-2">\s*<h2>\s*<a href="([^"]+)" title="([^"]+)">[\s\S]*?<\/div>\s*<div class="mlnh-3 hdn">([^<]*)<\/div>/g;
            let match;
            while ((match = resultRegex.exec(searchHtml)) !== null) {
              const foundUrl = match[1];
              const foundTitle = match[2];
              const foundYearStr = match[3];
              if (foundTitle.toUpperCase().includes("[SUB ITA]")) {
                console.log(`[Guardaserie] Filtering out subbed result: ${foundTitle}`);
                continue;
              }
              if (foundTitle.toLowerCase().includes(title.toLowerCase())) {
                candidates.push({
                  url: foundUrl,
                  title: foundTitle,
                  year: foundYearStr
                });
              }
            }
            for (const candidate of candidates) {
              let matchesYear = true;
              if (metaYear) {
                const yearMatch = candidate.year.match(/(\d{4})/);
                if (yearMatch) {
                  const foundYear = parseInt(yearMatch[1]);
                  if (Math.abs(foundYear - metaYear) > 2) {
                    matchesYear = false;
                  }
                }
              }
              if (matchesYear) {
                console.log(`[Guardaserie] Verifying candidate: ${candidate.title} (${candidate.year})`);
                try {
                  const candidateRes = yield fetch(candidate.url, {
                    headers: {
                      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                      "Referer": BASE_URL
                    }
                  });
                  if (!candidateRes.ok) continue;
                  const candidateHtml = yield candidateRes.text();
                  let verifiedByLinks = false;
                  let verifiedByVars = false;
                  let imdbVarVal = null;
                  try {
                    const titleVarMatch = candidateHtml.match(/show_title\s*=\s*'([^']+)'/i);
                    const imdbVarMatch = candidateHtml.match(/show_imdb\s*=\s*'([^']+)'/i);
                    if (imdbVarMatch) imdbVarVal = imdbVarMatch[1];
                    if (imdbVarVal && imdbId && imdbVarVal === imdbId) {
                      console.log(`[Guardaserie] Verified ${candidate.url} via show_imdb variable.`);
                      verifiedByVars = true;
                    } else if (titleVarMatch) {
                      const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
                      const a = norm(titleVarMatch[1]);
                      const b = norm(title);
                      if (a && b && (a.includes(b) || b.includes(a))) {
                        console.log(`[Guardaserie] Tentatively verified ${candidate.url} via show_title variable.`);
                        verifiedByVars = true;
                      }
                    }
                  } catch (e) {
                  }
                  if (imdbId && imdbVarVal && imdbVarVal !== imdbId) {
                    console.log(`[Guardaserie] Rejected ${candidate.url} due to show_imdb mismatch (${imdbVarVal} != ${imdbId}).`);
                    continue;
                  }
                  if (!verifiedByVars) {
                    try {
                      const tmdbLinkMatches = candidateHtml.match(/themoviedb\.org\/(?:tv|movie)\/(\d+)/g);
                      if (tmdbLinkMatches && tmdbLinkMatches.length > 0 && tmdbId) {
                        const foundIds = tmdbLinkMatches.map((l) => {
                          const m = l.match(/\/(\d+)/);
                          return m ? m[1] : null;
                        }).filter(Boolean);
                        if (foundIds.includes(String(tmdbId))) {
                          console.log(`[Guardaserie] Verified ${candidate.url} via TMDB link.`);
                          verifiedByLinks = true;
                        } else {
                          console.log(`[Guardaserie] Rejected ${candidate.url} due to TMDB mismatch.`);
                          continue;
                        }
                      }
                      if (!verifiedByLinks) {
                        const mpLinkMatch = candidateHtml.match(/href=["'](https?:\/\/(?:www\.)?movieplayer\.it\/serietv\/[^"']+)["']/i);
                        if (mpLinkMatch && metaYear) {
                          const mpUrl = mpLinkMatch[1];
                          const ok = yield verifyMoviePlayer(mpUrl, metaYear);
                          if (ok) {
                            verifiedByLinks = true;
                            console.log(`[Guardaserie] Verified ${candidate.url} via MoviePlayer link.`);
                          } else {
                            console.log(`[Guardaserie] Rejected ${candidate.url} via MoviePlayer year mismatch.`);
                            continue;
                          }
                        }
                      }
                      if (!verifiedByLinks && imdbId) {
                        const imdbLinkMatches = candidateHtml.match(/imdb\.com\/title\/(tt\d{7,8})/g);
                        if (imdbLinkMatches && imdbLinkMatches.length > 0) {
                          const foundImdb = imdbLinkMatches.map((l) => {
                            const m = l.match(/(tt\d{7,8})/);
                            return m ? m[1] : null;
                          }).filter(Boolean);
                          if (foundImdb.includes(imdbId)) {
                            console.log(`[Guardaserie] Verified ${candidate.url} via IMDb link.`);
                            verifiedByLinks = true;
                          } else {
                            console.log(`[Guardaserie] Rejected ${candidate.url} due to IMDb link mismatch.`);
                            continue;
                          }
                        }
                      }
                    } catch (e) {
                    }
                  }
                  if (!verifiedByLinks && !verifiedByVars && imdbId) {
                    const imdbMatches = candidateHtml.match(/tt\d{7,8}/g);
                    if (imdbMatches && imdbMatches.length > 0) {
                      const targetId = imdbId;
                      const hasTarget = imdbMatches.includes(targetId);
                      const otherIds = imdbMatches.filter((m) => m !== targetId);
                      if (!hasTarget && otherIds.length > 0) {
                        if (title.includes("One Piece") && candidate.title.includes("All'arrembaggio")) {
                          console.log(`[Guardaserie] Accepting "All'arrembaggio" despite IMDb mismatch (known alias).`);
                        } else {
                          console.log(`[Guardaserie] Rejected ${candidate.url} due to IMDb mismatch. Found: ${otherIds.join(", ")}`);
                          continue;
                        }
                      }
                      if (hasTarget) {
                        console.log(`[Guardaserie] Verified ${candidate.url} with IMDb match.`);
                      }
                    }
                  }
                  if (verifiedByLinks || verifiedByVars) {
                    showUrl = candidate.url;
                    showHtml = candidateHtml;
                    break;
                  } else {
                    showUrl = candidate.url;
                    showHtml = candidateHtml;
                    break;
                  }
                } catch (e) {
                  console.error(`[Guardaserie] Error verifying candidate ${candidate.url}:`, e);
                }
              }
            }
          }
          if (!showUrl) {
            console.log("[Guardaserie] No candidate matched criteria.");
          }
          if (!showUrl || !showHtml) {
            console.log("[Guardaserie] Show not found");
            return [];
          }
          console.log(`[Guardaserie] Found show URL: ${showUrl}`);
          const episodeStr = `${season}x${episode}`;
          const episodeStrPadded = `${season}x${episode.toString().padStart(2, "0")}`;
          let episodeRegex = new RegExp(`data-num="${episodeStr}"`, "i");
          let episodeMatch = episodeRegex.exec(showHtml);
          if (!episodeMatch) {
            episodeRegex = new RegExp(`data-num="${episodeStrPadded}"`, "i");
            episodeMatch = episodeRegex.exec(showHtml);
          }
          if (!episodeMatch && mappedSeason) {
            const mappedStr = `${mappedSeason}x${mappedEpisode}`;
            const mappedStrPadded = `${mappedSeason}x${mappedEpisode.toString().padStart(2, "0")}`;
            episodeRegex = new RegExp(`data-num="${mappedStr}"`, "i");
            episodeMatch = episodeRegex.exec(showHtml);
            if (!episodeMatch) {
              episodeRegex = new RegExp(`data-num="${mappedStrPadded}"`, "i");
              episodeMatch = episodeRegex.exec(showHtml);
            }
            if (episodeMatch) console.log(`[Guardaserie] Found mapped episode ${mappedSeason}x${mappedEpisode}`);
          }
          if (!episodeMatch && season === 1) {
            const textRegex = new RegExp(`${season}x${episode}`, "i");
            if (textRegex.test(showHtml)) {
              console.log(`[Guardaserie] Found text match for ${season}x${episode}, but no data-num. Scanning for links...`);
            }
          }
          if (!episodeMatch) {
            console.log(`[Guardaserie] Episode ${episodeStr} not found`);
            return [];
          }
          const searchFromIndex = episodeMatch.index;
          const mirrorsStartIndex = showHtml.indexOf('<div class="mirrors">', searchFromIndex);
          if (mirrorsStartIndex === -1) {
            console.log("[Guardaserie] Mirrors div not found");
            return [];
          }
          const mirrorsEndIndex = showHtml.indexOf("</div>", mirrorsStartIndex);
          const mirrorsHtml = showHtml.substring(mirrorsStartIndex, mirrorsEndIndex);
          const linkRegex = /data-link="([^"]+)"/g;
          const links = [];
          let linkMatch;
          while ((linkMatch = linkRegex.exec(mirrorsHtml)) !== null) {
            links.push(linkMatch[1]);
          }
          console.log(`[Guardaserie] Found ${links.length} potential links`);
          const streamPromises = links.map((link) => __async2(null, null, function* () {
            try {
              const displaySeason = mappedSeason || season;
              const displayEpisode = mappedEpisode || episode;
              const displayName = `${title} ${displaySeason}x${displayEpisode}`;
              let streamUrl = null;
              let playerName = "Unknown";
              if (link.includes("dropload")) {
                const extracted = yield extractDropLoad(link);
                if (extracted && extracted.url) {
                  let quality = "HD";
                  if (extracted.url.includes(".m3u8")) {
                    const detected = yield checkQualityFromPlaylist(extracted.url, extracted.headers || {});
                    if (detected) quality = detected;
                  } else {
                    const lowerUrl = extracted.url.toLowerCase();
                    if (lowerUrl.includes("1080") || lowerUrl.includes("fhd")) quality = "1080p";
                    else if (lowerUrl.includes("720") || lowerUrl.includes("hd")) quality = "720p";
                    else if (lowerUrl.includes("480") || lowerUrl.includes("sd")) quality = "480p";
                    else if (lowerUrl.includes("360")) quality = "360p";
                  }
                  const normalizedQuality = getQualityFromName(quality);
                  return {
                    url: extracted.url,
                    headers: extracted.headers,
                    name: `Guardaserie - DropLoad`,
                    title: displayName,
                    quality: normalizedQuality,
                    type: "direct"
                  };
                }
              } else if (link.includes("supervideo")) {
                const streamUrl2 = yield extractSuperVideo(link);
                playerName = "SuperVideo";
                if (streamUrl2) {
                  let quality = "HD";
                  if (streamUrl2.includes(".m3u8")) {
                    const detected = yield checkQualityFromPlaylist(streamUrl2);
                    if (detected) quality = detected;
                  } else {
                    const lowerUrl = streamUrl2.toLowerCase();
                    if (lowerUrl.includes("4k") || lowerUrl.includes("2160")) quality = "4K";
                    else if (lowerUrl.includes("1080") || lowerUrl.includes("fhd")) quality = "1080p";
                    else if (lowerUrl.includes("720") || lowerUrl.includes("hd")) quality = "720p";
                    else if (lowerUrl.includes("480") || lowerUrl.includes("sd")) quality = "480p";
                    else if (lowerUrl.includes("360")) quality = "360p";
                  }
                  const normalizedQuality = getQualityFromName(quality);
                  return {
                    url: streamUrl2,
                    name: `Guardaserie - ${playerName}`,
                    title: displayName,
                    quality: normalizedQuality,
                    type: "direct"
                  };
                }
              } else if (link.includes("mixdrop")) {
                const extracted = yield extractMixDrop(link);
                if (extracted && extracted.url) {
                  let quality = "HD";
                  if (extracted.url.includes(".m3u8")) {
                    const detected = yield checkQualityFromPlaylist(extracted.url, extracted.headers || {});
                    if (detected) quality = detected;
                  } else {
                    const lowerUrl = extracted.url.toLowerCase();
                    if (lowerUrl.includes("4k") || lowerUrl.includes("2160")) quality = "4K";
                    else if (lowerUrl.includes("1080") || lowerUrl.includes("fhd")) quality = "1080p";
                    else if (lowerUrl.includes("720") || lowerUrl.includes("hd")) quality = "720p";
                    else if (lowerUrl.includes("480") || lowerUrl.includes("sd")) quality = "480p";
                    else if (lowerUrl.includes("360")) quality = "360p";
                  }
                  const normalizedQuality = getQualityFromName(quality);
                  return {
                    url: extracted.url,
                    headers: extracted.headers,
                    name: `Guardaserie - MixDrop`,
                    title: displayName,
                    quality: normalizedQuality,
                    type: "direct"
                  };
                }
              }
            } catch (e) {
              console.error(`[Guardaserie] Error extracting link ${link}:`, e);
            }
            return null;
          }));
          const results = yield Promise.all(streamPromises);
          return results.filter((r) => r !== null).map((s) => formatStream(s, "Guardaserie")).filter((s) => s !== null);
        } catch (e) {
          console.error("[Guardaserie] Error:", e);
          return [];
        }
      });
    }
    module2.exports = { getStreams: getStreams2 };
  }
});

// src/guardoserie/index.js
var require_guardoserie = __commonJS({
  "src/guardoserie/index.js"(exports2, module2) {
    var { USER_AGENT, getProxiedUrl } = require_common();
    var { extractLoadm, extractUqload, extractDropLoad } = require_extractors();
    var { formatStream } = require_formatter();
    var { getTmdbFromKitsu: getTmdbFromKitsu2 } = require_tmdb_helper();
    var { checkQualityFromPlaylist } = require_quality_helper();
    var BASE_URL = "https://guardoserie.space";
    var TMDB_API_KEY2 = "68e094699525b18a70bab2f86b1fa706";
    function extractEpisodeUrlFromSeriesPage(pageHtml, season, episode) {
      if (!pageHtml) return null;
      const seasonIndex = parseInt(season, 10) - 1;
      const episodeIndex = parseInt(episode, 10) - 1;
      if (!Number.isInteger(seasonIndex) || !Number.isInteger(episodeIndex) || seasonIndex < 0 || episodeIndex < 0) {
        return null;
      }
      const seasonBlocks = pageHtml.split(/class=['"]les-content['"]/i);
      if (seasonBlocks.length > seasonIndex + 1) {
        const targetSeasonBlock = seasonBlocks[seasonIndex + 1];
        const blockEnd = targetSeasonBlock.indexOf("</div>");
        const cleanBlock = blockEnd !== -1 ? targetSeasonBlock.substring(0, blockEnd) : targetSeasonBlock;
        const episodeRegex = /<a[^>]+href=['"]([^'"]+)['"][^>]*>/g;
        const episodes = [];
        let eMatch;
        while ((eMatch = episodeRegex.exec(cleanBlock)) !== null) {
          if (eMatch[1] && /\/episodio\//i.test(eMatch[1])) {
            episodes.push(eMatch[1]);
          }
        }
        if (episodes.length > episodeIndex) {
          return episodes[episodeIndex];
        }
      }
      const explicitEpisodeRegex = new RegExp(`https?:\\/\\/[^"'\\s]+\\/episodio\\/[^"'\\s]*stagione-${season}-episodio-${episode}[^"'\\s]*`, "i");
      const explicitMatch = pageHtml.match(explicitEpisodeRegex);
      if (explicitMatch && explicitMatch[0]) {
        return explicitMatch[0];
      }
      return null;
    }
    function normalizePlayerLink(link) {
      if (!link) return null;
      let normalized = String(link).trim().replace(/&amp;/g, "&").replace(/\\\//g, "/");
      if (!normalized || normalized.startsWith("data:")) return null;
      if (normalized.startsWith("//")) {
        normalized = `https:${normalized}`;
      } else if (normalized.startsWith("/")) {
        normalized = `${BASE_URL}${normalized}`;
      } else if (!/^https?:\/\//i.test(normalized) && /(loadm|uqload|dropload)/i.test(normalized)) {
        normalized = `https://${normalized.replace(/^\/+/, "")}`;
      }
      return /^https?:\/\//i.test(normalized) ? normalized : null;
    }
    function extractPlayerLinkFromHtml(html) {
      if (!html) return null;
      const iframeTags = html.match(/<iframe\b[^>]*>/ig) || [];
      for (const tag of iframeTags) {
        const candidates = [];
        const attrRegex = /\b(?:data-src|src)\s*=\s*(['"])(.*?)\1/ig;
        let attrMatch;
        while ((attrMatch = attrRegex.exec(tag)) !== null) {
          const candidate = normalizePlayerLink(attrMatch[2]);
          if (candidate) candidates.push(candidate);
        }
        const preferred = candidates.find((c) => /(loadm|uqload|dropload)/i.test(c));
        if (preferred) return preferred;
        if (candidates.length > 0) return candidates[0];
      }
      const directRegexes = [
        /https?:\/\/(?:www\.)?(?:loadm|uqload|dropload)[^"'<\s]+/ig,
        /https?:\\\/\\\/(?:www\\.)?(?:loadm|uqload|dropload)[^"'<\s]+/ig
      ];
      for (const regex of directRegexes) {
        const matches = html.match(regex) || [];
        for (const raw of matches) {
          const candidate = normalizePlayerLink(raw);
          if (candidate) return candidate;
        }
      }
      return null;
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
    function getShowInfo(tmdbId, type) {
      return __async(this, null, function* () {
        try {
          const endpoint = type === "movie" ? "movie" : "tv";
          const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY2}&language=it-IT`;
          const response = yield fetch(url);
          if (!response.ok) return null;
          return yield response.json();
        } catch (e) {
          console.error("[Guardoserie] TMDB error:", e);
          return null;
        }
      });
    }
    function getStreams2(id, type, season, episode, providerContext = null) {
      return __async(this, null, function* () {
        var _a, _b;
        try {
          let tmdbId = id;
          const contextTmdbId = providerContext && /^\d+$/.test(String(providerContext.tmdbId || "")) ? String(providerContext.tmdbId) : null;
          const parsedContextSeason = parseInt(providerContext && providerContext.canonicalSeason, 10);
          const hasContextSeason = Number.isInteger(parsedContextSeason) && parsedContextSeason >= 0;
          if (id.toString().startsWith("tt")) {
            if (contextTmdbId) {
              tmdbId = contextTmdbId;
              console.log(`[Guardoserie] Using prefetched TMDB ID ${tmdbId} for ${id}`);
            } else {
              const url = `https://api.themoviedb.org/3/find/${id}?api_key=${TMDB_API_KEY2}&external_source=imdb_id`;
              const response = yield fetch(url);
              if (response.ok) {
                const data = yield response.json();
                if (type === "movie" && ((_a = data.movie_results) == null ? void 0 : _a.length) > 0) tmdbId = data.movie_results[0].id;
                else if ((type === "series" || type === "tv") && ((_b = data.tv_results) == null ? void 0 : _b.length) > 0) tmdbId = data.tv_results[0].id;
              }
            }
          } else if (id.toString().startsWith("kitsu:")) {
            if (contextTmdbId) {
              tmdbId = contextTmdbId;
              if (hasContextSeason && season !== parsedContextSeason) {
                season = parsedContextSeason;
              }
              console.log(`[Guardoserie] Using prefetched mapping for ${id} -> TMDB ${tmdbId}, Season ${season}`);
            } else {
              const resolved = yield getTmdbFromKitsu2(id);
              if (resolved && resolved.tmdbId) {
                tmdbId = resolved.tmdbId;
                if (resolved.season) season = resolved.season;
              }
            }
          } else if (id.toString().startsWith("tmdb:")) {
            tmdbId = id.toString().replace("tmdb:", "");
          }
          const showInfo = yield getShowInfo(tmdbId, type === "movie" ? "movie" : "tv");
          if (!showInfo) return [];
          const title = showInfo.name || showInfo.original_name || showInfo.title || showInfo.original_title;
          const originalTitle = showInfo.original_title || showInfo.original_name;
          const year = (showInfo.first_air_date || showInfo.release_date || "").split("-")[0];
          console.log(`[Guardoserie] Searching for: ${title} / ${originalTitle} (${year})`);
          const searchProvider = (query) => __async(null, null, function* () {
            const searchUrl = `${BASE_URL}/wp-admin/admin-ajax.php`;
            const body = `s=${encodeURIComponent(query)}&action=searchwp_live_search&swpengine=default&swpquery=${encodeURIComponent(query)}`;
            const response = yield fetch(searchUrl, {
              method: "POST",
              headers: {
                "User-Agent": USER_AGENT,
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Origin": BASE_URL,
                "Referer": `${BASE_URL}/`
              },
              body
            });
            if (!response.ok) return [];
            const searchHtml = yield response.text();
            const results = [];
            const itemRegex = /<a[^>]+href="([^"]+)"[^>]+class="ss-title"[^>]*>(.*?)<\/a>/g;
            let match;
            while ((match = itemRegex.exec(searchHtml)) !== null) {
              const rTitle = match[2].replace(/<[^>]+>/g, "").trim();
              results.push({
                url: match[1],
                title: rTitle
              });
            }
            if (results.length === 0) {
              const itemRegexFallback = /<a[^>]+class="ss-title"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/g;
              while ((match = itemRegexFallback.exec(searchHtml)) !== null) {
                results.push({
                  url: match[1],
                  title: match[2].replace(/<[^>]+>/g, "").trim()
                });
              }
            }
            return results;
          });
          let allResults = [];
          const queries = [title, originalTitle].filter((q) => q && q.length > 2);
          for (const q of queries) {
            const res = yield searchProvider(q);
            allResults.push(...res);
          }
          allResults = Array.from(new Map(allResults.map((item) => [item.url, item])).values());
          const decodeEntities = (str) => {
            return str.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec)).replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#8211;/g, "-").replace(/&#8217;/g, "'");
          };
          const norm = (s) => decodeEntities(s).toLowerCase().replace(/[^a-z0-9]/g, "").replace("iltronodispade", "gameofthrones");
          const nTitle = norm(title);
          const nOrig = norm(originalTitle || "");
          allResults.sort((a, b) => {
            const nA = norm(a.title);
            const nB = norm(b.title);
            const exactA = nA === nTitle || nA === nOrig;
            const exactB = nB === nTitle || nB === nOrig;
            if (exactA && !exactB) return -1;
            if (!exactA && exactB) return 1;
            return 0;
          });
          let targetUrl = null;
          for (const result of allResults.slice(0, 10)) {
            const nResult = norm(result.title);
            const isExactMatch = nResult === nTitle || nResult === nOrig;
            const isPartialMatch = nResult.includes(nTitle) || nOrig && nResult.includes(nOrig);
            if (isExactMatch || isPartialMatch) {
              try {
                const pageRes = yield fetch(getProxiedUrl(result.url), { headers: {
                  "User-Agent": USER_AGENT,
                  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                  "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
                  "Referer": `${BASE_URL}/`
                } });
                if (!pageRes.ok) continue;
                const pageHtml = yield pageRes.text();
                let foundYear = null;
                const pubYearMatch = pageHtml.match(/pubblicazione.*?release-year\/(\d{4})/i);
                if (pubYearMatch) {
                  foundYear = pubYearMatch[1];
                }
                if (!foundYear) {
                  const metaDateMatch = pageHtml.match(/property="og:updated_time" content="(20\d{2})/i) || pageHtml.match(/itemprop="datePublished" content="(20\d{2})/i) || pageHtml.match(/content="(20\d{2})-\d{2}-\d{2}"/i);
                  if (metaDateMatch) {
                    foundYear = metaDateMatch[1];
                  }
                }
                if (!foundYear) {
                  const anyYearMatch = pageHtml.match(/release-year\/(\d{4})/i);
                  if (anyYearMatch) {
                    foundYear = anyYearMatch[1];
                  }
                }
                if (foundYear) {
                  const targetYear = parseInt(year);
                  const fYear = parseInt(foundYear);
                  const maxDiff = isExactMatch ? 10 : 1;
                  if (fYear === targetYear || Math.abs(fYear - targetYear) <= maxDiff) {
                    targetUrl = result.url;
                    break;
                  }
                } else {
                  if (isExactMatch) {
                    targetUrl = result.url;
                    break;
                  }
                }
              } catch (e) {
                targetUrl = result.url;
                break;
              }
            }
          }
          if (!targetUrl) {
            console.log(`[Guardoserie] No matching result found for ${title}`);
            return [];
          }
          let episodeUrl = targetUrl;
          if (type === "tv" || type === "series") {
            const pageRes = yield fetch(getProxiedUrl(targetUrl), { headers: {
              "User-Agent": USER_AGENT,
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
              "Referer": `${BASE_URL}/`
            } });
            const pageHtml = yield pageRes.text();
            const resolvedEpisodeUrl = extractEpisodeUrlFromSeriesPage(pageHtml, season, episode);
            if (resolvedEpisodeUrl) {
              episodeUrl = resolvedEpisodeUrl;
            } else {
              console.log(`[Guardoserie] Episode ${episode} not found in Season ${season} at ${targetUrl}`);
              return [];
            }
          }
          console.log(`[Guardoserie] Found episode/movie URL: ${episodeUrl}`);
          const finalRes = yield fetch(getProxiedUrl(episodeUrl), { headers: {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
            "Referer": `${BASE_URL}/`
          } });
          const finalHtml = yield finalRes.text();
          let playerLink = extractPlayerLinkFromHtml(finalHtml);
          if (!playerLink && /\/serie\//i.test(episodeUrl)) {
            const fallbackEpisodeUrl = extractEpisodeUrlFromSeriesPage(finalHtml, season, episode);
            if (fallbackEpisodeUrl && fallbackEpisodeUrl !== episodeUrl) {
              console.log(`[Guardoserie] Fallback to derived episode URL: ${fallbackEpisodeUrl}`);
              const retryRes = yield fetch(getProxiedUrl(fallbackEpisodeUrl), { headers: {
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
                "Referer": `${BASE_URL}/`
              } });
              const retryHtml = yield retryRes.text();
              const fallbackPlayerLink = extractPlayerLinkFromHtml(retryHtml);
              if (fallbackPlayerLink) {
                playerLink = fallbackPlayerLink;
                episodeUrl = fallbackEpisodeUrl;
              }
            }
          }
          if (!playerLink) {
            console.log(`[Guardoserie] No player iframe found`);
            return [];
          }
          console.log(`[Guardoserie] Found player link: ${playerLink}`);
          const displayName = type === "tv" || type === "series" ? `${title} ${season}x${episode}` : title;
          let streams = [];
          if (playerLink.includes("loadm")) {
            const domain = "guardoserie.horse";
            console.log(`[Guardoserie] Extracting Loadm: ${playerLink}`);
            const extracted = yield extractLoadm(playerLink, domain);
            console.log(`[Guardoserie] Loadm extraction results: ${(extracted == null ? void 0 : extracted.length) || 0}`);
            for (const s of extracted || []) {
              const directLoadmUrl = s.url;
              let quality = "HD";
              if (s.url.includes(".m3u8")) {
                const detected = yield checkQualityFromPlaylist(directLoadmUrl, s.headers || {});
                if (detected) quality = detected;
              }
              const normalizedQuality = getQualityFromName(quality);
              streams.push(formatStream({
                url: directLoadmUrl,
                headers: s.headers,
                name: `Guardoserie - Loadm`,
                title: displayName,
                quality: normalizedQuality,
                type: "direct",
                behaviorHints: s.behaviorHints
              }, "Guardoserie"));
            }
          } else if (playerLink.includes("uqload")) {
            const extracted = yield extractUqload(playerLink);
            if (extracted && extracted.url) {
              let quality = "HD";
              const normalizedQuality = getQualityFromName(quality);
              streams.push(formatStream({
                url: getProxiedUrl(extracted.url),
                headers: extracted.headers,
                name: `Guardoserie - Uqload`,
                title: displayName,
                quality: normalizedQuality,
                type: "direct"
              }, "Guardoserie"));
            }
          } else if (playerLink.includes("dropload")) {
            const extracted = yield extractDropLoad(playerLink);
            if (extracted && extracted.url) {
              let quality = "HD";
              if (extracted.url.includes(".m3u8")) {
                const detected = yield checkQualityFromPlaylist(getProxiedUrl(extracted.url), extracted.headers || {});
                if (detected) quality = detected;
              }
              const normalizedQuality = getQualityFromName(quality);
              streams.push(formatStream({
                url: getProxiedUrl(extracted.url),
                headers: extracted.headers,
                name: `Guardoserie - DropLoad`,
                title: displayName,
                quality: normalizedQuality,
                type: "direct"
              }, "Guardoserie"));
            }
          }
          return streams;
        } catch (e) {
          console.error(`[Guardoserie] Error:`, e);
          return [];
        }
      });
    }
    module2.exports = { getStreams: getStreams2 };
  }
});

// src/streamingcommunity/index.js
var require_streamingcommunity = __commonJS({
  "src/streamingcommunity/index.js"(exports2, module2) {
    var BASE_URL = "https://vixsrc.to";
    var { formatStream } = require_formatter();
    require_fetch_helper();
    var { checkQualityFromText } = require_quality_helper();
    var TMDB_API_KEY2 = "68e094699525b18a70bab2f86b1fa706";
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
        const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY2}&external_source=imdb_id`;
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
            url = `https://api.themoviedb.org/3/find/${id}?api_key=${TMDB_API_KEY2}&external_source=imdb_id&language=it-IT`;
          } else {
            const endpoint = normalizedType === "movie" ? "movie" : "tv";
            url = `https://api.themoviedb.org/3/${endpoint}/${id}?api_key=${TMDB_API_KEY2}&language=it-IT`;
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
    function getStreams2(id, type, season, episode, providerContext = null) {
      return __async(this, null, function* () {
        const normalizedType = String(type).toLowerCase();
        let tmdbId = id.toString();
        let resolvedSeason = season;
        const contextTmdbId = providerContext && /^\d+$/.test(String(providerContext.tmdbId || "")) ? String(providerContext.tmdbId) : null;
        const parsedContextSeason = parseInt(providerContext && providerContext.canonicalSeason, 10);
        const hasContextSeason = Number.isInteger(parsedContextSeason) && parsedContextSeason >= 0;
        if (contextTmdbId) {
          tmdbId = contextTmdbId;
          if (normalizedType === "tv" && hasContextSeason && resolvedSeason !== parsedContextSeason) {
            console.log(`[StreamingCommunity] Prefetched mapping indicates Season ${parsedContextSeason}. Overriding requested Season ${resolvedSeason}`);
            resolvedSeason = parsedContextSeason;
          }
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
        if (normalizedType === "movie") {
          url = `${BASE_URL}/movie/${tmdbId}`;
        } else if (normalizedType === "tv") {
          url = `${BASE_URL}/tv/${tmdbId}/${resolvedSeason}/${episode}`;
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
                const hasItalian = /#EXT-X-MEDIA:TYPE=AUDIO.*(?:LANGUAGE="it"|LANGUAGE="ita"|NAME="Italian"|NAME="Ita")/i.test(playlistText);
                const detected = checkQualityFromText(playlistText);
                if (detected) quality = detected;
                const originalLanguageItalian = metadata && (metadata.original_language === "it" || metadata.original_language === "ita");
                if (hasItalian || originalLanguageItalian) {
                  console.log(`[StreamingCommunity] Verified: Has Italian audio or original language is Italian.`);
                } else {
                  console.log(`[StreamingCommunity] No Italian audio found in playlist and original language is not Italian. Skipping.`);
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
    module2.exports = { getStreams: getStreams2 };
  }
});

// src/index.js
var animeunity = require_animeunity();
var animeworld = require_animeworld();
var guardahd = require_guardahd();
var guardaserie = require_guardaserie();
var guardoserie = require_guardoserie();
var streamingcommunity = require_streamingcommunity();
var { getTmdbFromKitsu } = require_tmdb_helper();
var MAPPING_API_URL = "https://animemapping.stremio.dpdns.org";
var TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
var CONTEXT_TIMEOUT = 3e3;
function isMeaningfulSeasonName(name) {
  const clean = String(name || "").trim();
  if (!clean) return false;
  if (/^Season\s+\d+$/i.test(clean)) return false;
  if (/^Stagione\s+\d+$/i.test(clean)) return false;
  return true;
}
function mergeDistinctStrings(base = [], incoming = []) {
  const merged = [...Array.isArray(base) ? base : [], ...Array.isArray(incoming) ? incoming : []].map((s) => String(s || "").trim()).filter(Boolean);
  return [...new Set(merged)];
}
function applyMappingHintsToContext(context, payload) {
  if (!context || !payload || typeof payload !== "object") return;
  const tmdbCandidate = String(payload.tmdbId || "").trim();
  if (/^tmdb:\d+$/i.test(tmdbCandidate)) {
    context.tmdbId = tmdbCandidate.split(":")[1];
  } else if (/^\d+$/.test(tmdbCandidate)) {
    context.tmdbId = tmdbCandidate;
  }
  const imdbCandidate = String(payload.imdbId || "").trim();
  if (/^tt\d+$/i.test(imdbCandidate)) {
    context.imdbId = imdbCandidate;
  }
  const parsedSeason = Number.parseInt(payload.season, 10);
  if (Number.isInteger(parsedSeason) && parsedSeason >= 0) {
    context.mappedSeason = parsedSeason;
  }
  const seasonNameCandidate = String(payload.seasonName || "").trim();
  if (isMeaningfulSeasonName(seasonNameCandidate)) {
    context.seasonName = seasonNameCandidate;
  }
  context.titleHints = mergeDistinctStrings(context.titleHints, payload.titleHints);
  if (typeof payload.longSeries === "boolean") {
    context.longSeries = payload.longSeries;
  }
  const mode = String(payload.episodeMode || "").trim().toLowerCase();
  if (mode) {
    context.episodeMode = mode;
  }
  if (Array.isArray(payload.mappedSeasons)) {
    const normalized = payload.mappedSeasons.map((n) => Number.parseInt(n, 10)).filter((n) => Number.isInteger(n) && n > 0);
    if (normalized.length > 0) {
      context.mappedSeasons = [...new Set(normalized)].sort((a, b) => a - b);
    }
  }
  const parsedSeriesCount = Number.parseInt(payload.seriesSeasonCount, 10);
  if (Number.isInteger(parsedSeriesCount) && parsedSeriesCount > 0) {
    context.seriesSeasonCount = parsedSeriesCount;
  }
}
function computeCanonicalSeason(requestedSeason, mappedSeason, topology = null) {
  if (requestedSeason === 0) return 0;
  const parsedMappedSeason = Number.parseInt(mappedSeason, 10);
  const longSeries = (topology == null ? void 0 : topology.longSeries) === true;
  const episodeMode = String((topology == null ? void 0 : topology.episodeMode) || "").trim().toLowerCase();
  const isAbsoluteLongSeries = longSeries && episodeMode === "absolute";
  if (!isAbsoluteLongSeries && Number.isInteger(parsedMappedSeason) && parsedMappedSeason > 0) {
    return parsedMappedSeason;
  }
  return requestedSeason;
}
function fetchJsonWithTimeout(_0) {
  return __async(this, arguments, function* (url, timeoutMs = CONTEXT_TIMEOUT) {
    if (typeof fetch === "undefined") return null;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = yield fetch(url, { signal: controller.signal });
      if (!response.ok) return null;
      return yield response.json();
    } catch (e) {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  });
}
function fetchMappingByRoute(route, value, season) {
  return __async(this, null, function* () {
    if (!MAPPING_API_URL || !route || !value) return null;
    const encodedValue = encodeURIComponent(String(value).trim());
    let url = `${MAPPING_API_URL}/mapping/${route}/${encodedValue}`;
    if (Number.isInteger(season) && season >= 0) {
      url += `?season=${season}`;
    }
    return yield fetchJsonWithTimeout(url);
  });
}
function fetchTmdbIdFromImdb(imdbId, normalizedType) {
  return __async(this, null, function* () {
    if (!TMDB_API_KEY || !imdbId) return null;
    const url = `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    const payload = yield fetchJsonWithTimeout(url);
    if (!payload || typeof payload !== "object") return null;
    if (normalizedType === "movie") {
      if (Array.isArray(payload.movie_results) && payload.movie_results.length > 0) {
        return payload.movie_results[0].id;
      }
      if (Array.isArray(payload.tv_results) && payload.tv_results.length > 0) {
        return payload.tv_results[0].id;
      }
    } else {
      if (Array.isArray(payload.tv_results) && payload.tv_results.length > 0) {
        return payload.tv_results[0].id;
      }
      if (Array.isArray(payload.movie_results) && payload.movie_results.length > 0) {
        return payload.movie_results[0].id;
      }
    }
    return null;
  });
}
function resolveProviderRequestContext(id, type, season) {
  return __async(this, null, function* () {
    const context = {
      idType: "raw",
      providerId: String(id || ""),
      requestedSeason: Number.isInteger(season) ? season : 1,
      tmdbId: null,
      imdbId: null,
      mappedSeason: null,
      seasonName: null,
      titleHints: [],
      longSeries: false,
      episodeMode: null,
      mappedSeasons: [],
      seriesSeasonCount: null,
      canonicalSeason: Number.isInteger(season) ? season : 1
    };
    let rawId = String(id || "");
    try {
      rawId = decodeURIComponent(rawId);
    } catch (e) {
    }
    const idStr = rawId.trim();
    try {
      if (idStr.startsWith("kitsu:")) {
        context.idType = "kitsu";
        const mapping = yield getTmdbFromKitsu(idStr);
        if (mapping) {
          applyMappingHintsToContext(context, {
            tmdbId: mapping.tmdbId,
            season: mapping.season,
            seasonName: mapping.tmdbSeasonTitle,
            titleHints: mapping.titleHints,
            longSeries: mapping.longSeries,
            episodeMode: mapping.episodeMode,
            mappedSeasons: mapping.mappedSeasons,
            seriesSeasonCount: mapping.seriesSeasonCount
          });
        }
      } else if (idStr.startsWith("tmdb:")) {
        context.idType = "tmdb";
        const parts = idStr.split(":");
        if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
          context.tmdbId = parts[1];
        }
      } else if (/^tt\d+$/i.test(idStr)) {
        context.idType = "imdb";
        context.imdbId = idStr;
        const byImdb = yield fetchMappingByRoute("by-imdb", idStr, context.requestedSeason);
        if (byImdb) {
          applyMappingHintsToContext(context, byImdb);
        }
        if (!context.tmdbId) {
          const fallbackTmdbId = yield fetchTmdbIdFromImdb(idStr, String(type || "").toLowerCase());
          if (fallbackTmdbId !== null && fallbackTmdbId !== void 0) {
            context.tmdbId = String(fallbackTmdbId);
          }
        }
      } else if (/^\d+$/.test(idStr)) {
        context.idType = "tmdb-numeric";
        context.tmdbId = idStr;
      }
      const normalizedType = String(type || "").toLowerCase();
      const isSeriesLike = normalizedType === "series" || normalizedType === "tv" || normalizedType === "anime";
      if (isSeriesLike && context.tmdbId && context.idType !== "kitsu") {
        const byTmdb = yield fetchMappingByRoute("by-tmdb", context.tmdbId, context.requestedSeason);
        if (byTmdb) {
          applyMappingHintsToContext(context, byTmdb);
        }
      }
    } catch (e) {
    }
    context.canonicalSeason = computeCanonicalSeason(context.requestedSeason, context.mappedSeason, context);
    return context;
  });
}
function buildProviderRequestContext(context) {
  if (!context) return null;
  return {
    __requestContext: true,
    idType: context.idType,
    providerId: context.providerId,
    requestedSeason: context.requestedSeason,
    canonicalSeason: context.canonicalSeason,
    tmdbId: context.tmdbId,
    imdbId: context.imdbId,
    season: context.mappedSeason,
    mappedSeason: context.mappedSeason,
    seasonName: context.seasonName,
    mappedSeasonName: context.seasonName,
    titleHints: Array.isArray(context.titleHints) ? context.titleHints.slice() : [],
    mappedTitleHints: Array.isArray(context.titleHints) ? context.titleHints.slice() : [],
    longSeries: context.longSeries === true,
    episodeMode: context.episodeMode || null,
    mappedSeasons: Array.isArray(context.mappedSeasons) ? context.mappedSeasons.slice() : [],
    seriesSeasonCount: context.seriesSeasonCount
  };
}
function getStreams(id, type, season, episode) {
  return __async(this, null, function* () {
    const streams = [];
    const normalizedType = String(type || "").toLowerCase();
    const normalizedSeason = Number.isInteger(season) ? season : Number.parseInt(season, 10) || 1;
    const normalizedEpisode = Number.isInteger(episode) ? episode : Number.parseInt(episode, 10) || 1;
    const providerContext = yield resolveProviderRequestContext(id, normalizedType, normalizedSeason);
    const sharedContext = buildProviderRequestContext(providerContext);
    const promises = [];
    promises.push(
      animeunity.getStreams(id, normalizedType, normalizedSeason, normalizedEpisode, sharedContext).then((s) => ({ provider: "AnimeUnity", streams: s, status: "fulfilled" })).catch((e) => ({ provider: "AnimeUnity", error: e, status: "rejected" }))
    );
    promises.push(
      streamingcommunity.getStreams(id, normalizedType, normalizedSeason, normalizedEpisode, sharedContext).then((s) => ({ provider: "StreamingCommunity", streams: s, status: "fulfilled" })).catch((e) => ({ provider: "StreamingCommunity", error: e, status: "rejected" }))
    );
    if (normalizedType === "movie") {
      promises.push(
        guardahd.getStreams(id, normalizedType, normalizedSeason, normalizedEpisode).then((s) => ({ provider: "GuardaHD", streams: s, status: "fulfilled" })).catch((e) => ({ provider: "GuardaHD", error: e, status: "rejected" }))
      );
      promises.push(
        guardoserie.getStreams(id, normalizedType, normalizedSeason, normalizedEpisode, sharedContext).then((s) => ({ provider: "Guardoserie", streams: s, status: "fulfilled" })).catch((e) => ({ provider: "Guardoserie", error: e, status: "rejected" }))
      );
    }
    if (normalizedType === "tv" || normalizedType === "series" || normalizedType === "anime") {
      promises.push(
        guardaserie.getStreams(id, normalizedType, normalizedSeason, normalizedEpisode, sharedContext).then((s) => ({ provider: "Guardaserie", streams: s, status: "fulfilled" })).catch((e) => ({ provider: "Guardaserie", error: e, status: "rejected" }))
      );
      promises.push(
        guardoserie.getStreams(id, normalizedType, normalizedSeason, normalizedEpisode, sharedContext).then((s) => ({ provider: "Guardoserie", streams: s, status: "fulfilled" })).catch((e) => ({ provider: "Guardoserie", error: e, status: "rejected" }))
      );
      promises.push(
        animeworld.getStreams(id, normalizedType, normalizedSeason, normalizedEpisode, null, sharedContext).then((s) => ({ provider: "AnimeWorld", streams: s, status: "fulfilled" })).catch((e) => ({ provider: "AnimeWorld", error: e, status: "rejected" }))
      );
    } else {
      promises.push(
        animeworld.getStreams(id, normalizedType, normalizedSeason, normalizedEpisode, null, sharedContext).then((s) => ({ provider: "AnimeWorld", streams: s, status: "fulfilled" })).catch((e) => ({ provider: "AnimeWorld", error: e, status: "rejected" }))
      );
    }
    const results = yield Promise.all(promises);
    for (const result of results) {
      if (result.status === "fulfilled" && result.streams) {
        streams.push(...result.streams);
      }
    }
    return streams;
  });
}
module.exports = { getStreams };
/*! Bundled license information:

crypto-js/ripemd160.js:
  (** @preserve
  	(c) 2012 by Cédric Mesnil. All rights reserved.
  
  	Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
  
  	    - Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
  	    - Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
  
  	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
  	*)

crypto-js/mode-ctr-gladman.js:
  (** @preserve
   * Counter block mode compatible with  Dr Brian Gladman fileenc.c
   * derived from CryptoJS.mode.CTR
   * Jan Hruby jhruby.web@gmail.com
   *)
*/
