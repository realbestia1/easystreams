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

// src/tmdb_helper.js
var require_tmdb_helper = __commonJS({
  "src/tmdb_helper.js"(exports2, module2) {
    var TMDB_API_KEY2 = "68e094699525b18a70bab2f86b1fa706";
    function getTmdbFromKitsu2(kitsuId) {
      return __async(this, null, function* () {
        var _a, _b, _c, _d;
        try {
          const id = String(kitsuId).replace("kitsu:", "");
          const mappingResponse = yield fetch(`https://kitsu.io/api/edge/anime/${id}/mappings`);
          let mappingData = null;
          if (mappingResponse.ok) {
            mappingData = yield mappingResponse.json();
          }
          let tmdbId = null;
          let season = null;
          if (mappingData && mappingData.data) {
            const tvdbMapping = mappingData.data.find((m) => m.attributes.externalSite === "thetvdb");
            if (tvdbMapping) {
              const tvdbId = tvdbMapping.attributes.externalId;
              const findUrl = `https://api.themoviedb.org/3/find/${tvdbId}?api_key=${TMDB_API_KEY2}&external_source=tvdb_id`;
              const findResponse = yield fetch(findUrl);
              const findData = yield findResponse.json();
              if (((_a = findData.tv_results) == null ? void 0 : _a.length) > 0) tmdbId = findData.tv_results[0].id;
              else if (((_b = findData.movie_results) == null ? void 0 : _b.length) > 0) return { tmdbId: findData.movie_results[0].id, season: null };
            }
            if (!tmdbId) {
              const imdbMapping = mappingData.data.find((m) => m.attributes.externalSite === "imdb");
              if (imdbMapping) {
                const imdbId = imdbMapping.attributes.externalId;
                const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY2}&external_source=imdb_id`;
                const findResponse = yield fetch(findUrl);
                const findData = yield findResponse.json();
                if (((_c = findData.tv_results) == null ? void 0 : _c.length) > 0) tmdbId = findData.tv_results[0].id;
                else if (((_d = findData.movie_results) == null ? void 0 : _d.length) > 0) return { tmdbId: findData.movie_results[0].id, season: null };
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
                  const searchUrlYear = `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(title2)}&api_key=${TMDB_API_KEY2}${yearParam}`;
                  const res = yield fetch(searchUrlYear);
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
              const seasonMatch = title.match(/Season\s*(\d+)/i) || title.match(/(\d+)(?:st|nd|rd|th)\s*Season/i);
              if (seasonMatch) {
                season = parseInt(seasonMatch[1]);
              } else if (title.match(/\s(\d+)$/)) {
                season = parseInt(title.match(/\s(\d+)$/)[1]);
              } else if (title.match(/\sII$/)) season = 2;
              else if (title.match(/\sIII$/)) season = 3;
              else if (title.match(/\sIV$/)) season = 4;
              else if (title.match(/\sV$/)) season = 5;
            }
          }
          return { tmdbId, season };
        } catch (e) {
          console.error("[TMDB Helper] Kitsu resolve error:", e);
          return null;
        }
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
    function isAnime2(metadata) {
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
    module2.exports = { getTmdbFromKitsu: getTmdbFromKitsu2, getSeasonEpisodeFromAbsolute, isAnime: isAnime2 };
  }
});

// src/fetch_helper.js
var require_fetch_helper = __commonJS({
  "src/fetch_helper.js"(exports2, module2) {
    var FETCH_TIMEOUT = 3e4;
    var originalFetch = global.fetch;
    if (!originalFetch) {
      try {
        const nodeFetch = require("node-fetch");
        originalFetch = nodeFetch;
        global.fetch = nodeFetch;
        global.Headers = nodeFetch.Headers;
        global.Request = nodeFetch.Request;
        global.Response = nodeFetch.Response;
      } catch (e) {
        console.warn("No fetch implementation found and node-fetch is not available!");
      }
    }
    var fetchWithTimeout = function(_0) {
      return __async(this, arguments, function* (url, options = {}) {
        if (options.signal) {
          return originalFetch(url, options);
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, options.timeout || FETCH_TIMEOUT);
        try {
          const response = yield originalFetch(url, __spreadProps(__spreadValues({}, options), {
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
    };
    global.fetch = fetchWithTimeout;
    module2.exports = { fetchWithTimeout };
  }
});

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
        behaviorHints.notWebReady = true;
      }
      return __spreadProps(__spreadValues({}, stream), {
        // Keep original properties
        name: finalName,
        title: titleText,
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

// src/quality_helper.js
var require_quality_helper = __commonJS({
  "src/quality_helper.js"(exports2, module2) {
    var USER_AGENT2 = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
    function checkQualityFromPlaylist2(_0) {
      return __async(this, arguments, function* (url, headers = {}) {
        try {
          if (!url.includes(".m3u8")) return null;
          const finalHeaders = __spreadValues({}, headers);
          if (!finalHeaders["User-Agent"]) {
            finalHeaders["User-Agent"] = USER_AGENT2;
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
    module2.exports = { checkQualityFromPlaylist: checkQualityFromPlaylist2, getQualityFromUrl, checkQualityFromText };
  }
});

// src/animeworld/index.js
var { getTmdbFromKitsu, isAnime } = require_tmdb_helper();
require_fetch_helper();
var { formatStream } = require_formatter();
var { checkQualityFromPlaylist } = require_quality_helper();
var BASE_URL = "https://www.animeworld.ac";
var TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
function getMetadata(id, type) {
  return __async(this, null, function* () {
    try {
      const normalizedType = String(type).toLowerCase();
      let tmdbId = id;
      let mappedSeason = null;
      if (String(id).startsWith("kitsu:")) {
        const resolved = yield getTmdbFromKitsu(id);
        if (resolved && resolved.tmdbId) {
          tmdbId = resolved.tmdbId;
          mappedSeason = resolved.season;
          console.log(`[AnimeWorld] Resolved Kitsu ID ${id} to TMDB ID ${tmdbId} (Mapped Season: ${mappedSeason})`);
        } else {
          console.error(`[AnimeWorld] Failed to resolve Kitsu ID ${id}`);
          return null;
        }
      }
      if (String(id).startsWith("tmdb:")) {
        tmdbId = String(id).replace("tmdb:", "");
      }
      if (String(tmdbId).startsWith("tt")) {
        const findUrl = `https://api.themoviedb.org/3/find/${tmdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id&language=it-IT`;
        const findResponse = yield fetch(findUrl);
        if (!findResponse.ok) return null;
        const findData = yield findResponse.json();
        const results = normalizedType === "movie" ? findData.movie_results : findData.tv_results;
        if (!results || results.length === 0) return null;
        tmdbId = results[0].id;
      }
      const detailsUrl = `https://api.themoviedb.org/3/${normalizedType === "movie" ? "movie" : "tv"}/${tmdbId}?api_key=${TMDB_API_KEY}&language=it-IT`;
      const detailsResponse = yield fetch(detailsUrl);
      if (!detailsResponse.ok) return null;
      const details = yield detailsResponse.json();
      let imdb_id = details.imdb_id;
      if (!imdb_id && normalizedType === "tv") {
        const externalUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
        const extResponse = yield fetch(externalUrl);
        if (extResponse.ok) {
          const extData = yield extResponse.json();
          imdb_id = extData.imdb_id;
        }
      }
      let alternatives = [];
      try {
        const altUrl = `https://api.themoviedb.org/3/${normalizedType === "movie" ? "movie" : "tv"}/${tmdbId}/alternative_titles?api_key=${TMDB_API_KEY}`;
        const altResponse = yield fetch(altUrl);
        if (altResponse.ok) {
          const altData = yield altResponse.json();
          alternatives = altData.titles || altData.results || [];
        }
      } catch (e) {
        console.error("[AnimeWorld] Alt titles fetch error:", e);
      }
      return __spreadProps(__spreadValues({}, details), {
        imdb_id,
        tmdb_id: tmdbId,
        alternatives,
        mappedSeason
      });
    } catch (e) {
      console.error("[AnimeWorld] Metadata error:", e);
      return null;
    }
  });
}
function getSeasonMetadata(id, season) {
  return __async(this, null, function* () {
    try {
      const url = `https://api.themoviedb.org/3/tv/${id}/season/${season}?api_key=${TMDB_API_KEY}&language=it-IT`;
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
function findBestMatch(candidates, title, originalTitle, season, metadata, options = {}) {
  if (!candidates || candidates.length === 0) return null;
  let isTv = !!metadata.name;
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
  if (preYearExactMatches.length > 0) {
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
    const specialTypes = ["special", "ova", "movie"];
    candidates.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));
    const specialTitleMatch = candidates.find((c) => (c.title || "").toLowerCase().includes("special"));
    if (specialTitleMatch) {
      if (checkSimilarity(specialTitleMatch.title, title) || checkSimilarity(specialTitleMatch.title, originalTitle)) {
        return specialTitleMatch;
      }
    }
    const first = candidates[0];
    if (first) {
      const sim1 = checkSimilarity(first.title, title);
      const sim2 = checkSimilarity(first.title, originalTitle);
      if (sim1 || sim2) {
        return first;
      }
      const t = first.title.toLowerCase();
      if (t.includes(normTitle) || normOriginal && t.includes(normOriginal)) {
        return first;
      }
    }
    const anyMatch = candidates.find((c) => checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle));
    if (anyMatch) {
      return anyMatch;
    }
    console.log("[AnimeWorld] No season 0 match found passing similarity check");
    return null;
  }
  const exactMatch = candidates.find((c) => {
    const t = (c.title || "").toLowerCase().trim();
    return t === normTitle || normOriginal && t === normOriginal;
  });
  if (exactMatch && season === 1) return exactMatch;
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
    const numberMatch = candidates.find((c) => {
      const t = (c.title || "").toLowerCase();
      const regex = new RegExp(`\\b${seasonStr}$|\\b${seasonStr}\\b|season ${seasonStr}|stagione ${seasonStr}`, "i");
      if (regex.test(t)) {
        return checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle);
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
          return checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle);
        }
        return false;
      });
      if (romanMatch) return romanMatch;
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
function getStreams(id, type, season, episode, providedMetadata = null) {
  return __async(this, null, function* () {
    try {
      const metadata = providedMetadata || (yield getMetadata(id, type));
      if (!metadata) {
        console.error("[AnimeWorld] Metadata not found for", id);
        return [];
      }
      if (!isAnime(metadata)) {
        console.log(`[AnimeWorld] Skipped ${metadata.title} (Not an anime)`);
        return [];
      }
      if (metadata.mappedSeason) {
        console.log(`[AnimeWorld] Kitsu mapping indicates Season ${metadata.mappedSeason}. Overriding requested Season ${season}`);
        season = metadata.mappedSeason;
      }
      const title = metadata.title || metadata.name;
      const originalTitle = metadata.original_title || metadata.original_name;
      console.log(`[AnimeWorld] Searching for: ${title} (Season ${season})`);
      let candidates = [];
      let seasonNameMatch = false;
      if (season === 0) {
        const searchQueries = [
          `${title} Special`,
          `${title} OAV`,
          `${title} Movie`
        ];
        for (const query of searchQueries) {
          const res = yield searchAnime(query);
          if (res && res.length > 0) {
            candidates = candidates.concat(res);
          }
        }
        candidates = candidates.filter((v, i, a) => a.findIndex((t) => t.href === v.href) === i);
      }
      if (season > 1) {
        const searchQueries = [
          `${title} ${season}`,
          `${title} Season ${season}`,
          `${title} Stagione ${season}`
        ];
        if (originalTitle && originalTitle !== title) {
          searchQueries.push(`${originalTitle} ${season}`);
        }
        const seasonMeta = yield getSeasonMetadata(metadata.id, season);
        if (seasonMeta && seasonMeta.name && !seasonMeta.name.match(/^Season \d+|^Stagione \d+/i)) {
          const seasonQueries = [
            `${title} ${seasonMeta.name}`,
            seasonMeta.name
          ];
          for (const query of seasonQueries) {
            const res = yield searchAnime(query);
            if (res && res.length > 0) {
              console.log(`[AnimeWorld] Found matches for season name: ${query}`);
              const relevantRes = res.filter((c) => checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle));
              if (relevantRes.length > 0) {
                candidates = relevantRes;
                seasonNameMatch = true;
                break;
              }
            }
          }
        }
        if (!seasonNameMatch) {
          for (const query of searchQueries) {
            const res = yield searchAnime(query);
            if (res && res.length > 0) {
              const relevantRes = res.filter((c) => checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle));
              if (relevantRes.length > 0) {
                candidates = relevantRes;
                break;
              }
            }
          }
        }
      }
      const isMovie = metadata.genres && metadata.genres.some((g) => g.name === "Movie") || season === 0 || type === "movie";
      if (candidates.length === 0) {
        console.log(`[AnimeWorld] Standard search: ${title}`);
        candidates = yield searchAnime(title);
        if (candidates.length > 0) {
          const valid = candidates.some((c) => checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle));
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
              const valid = candidates.some((c) => checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title, dehyphenated));
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
              return checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle);
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
        const altTitles = metadata.alternatives.map((t) => t.title).filter((t) => /^[a-zA-Z0-9\s\-\.\:\(\)]+$/.test(t)).filter((t) => t !== title && t !== originalTitle);
        const uniqueAlts = [...new Set(altTitles)];
        let altSearchCount = 0;
        for (const altTitle of uniqueAlts) {
          if (altSearchCount >= 5) break;
          if (altTitle.length < 4) continue;
          const res = yield searchAnime(altTitle);
          altSearchCount++;
          if (res && res.length > 0) {
            const valid = res.some((c) => {
              if (checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle)) return true;
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
          const isSim = checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle) || c.matchedAltTitle && checkSimilarity(c.title, c.matchedAltTitle);
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
      let bestSub = findBestMatch(subs, title, originalTitle, season, metadata, { bypassSeasonCheck: seasonNameMatch });
      let bestDub = findBestMatch(dubs, title, originalTitle, season, metadata, { bypassSeasonCheck: seasonNameMatch });
      const results = [];
      const processMatch = (match, isDub) => __async(null, null, function* () {
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
            if (numMatch && idMatch) {
              episodes.push({
                num: numMatch[1],
                id: idMatch[1]
              });
            }
          }
          let targetEp;
          let prioritizeAbsolute = false;
          if (season > 1 && type !== "movie") {
            const normMatch = (match.title || "").toLowerCase().replace(/\(ita\)/g, "").replace(/\(sub ita\)/g, "").trim();
            const normSeries = (title || "").toLowerCase().trim();
            if (normMatch === normSeries) {
              prioritizeAbsolute = true;
            } else {
              const isSpecific = /\b(season|stagione)\b|\b(movie|film)\b|\b(special|oav|ova)\b/i.test(normMatch);
              const endsWithNumber = /(\d+)$/.exec(normMatch);
              let isSeasonNumber = false;
              if (endsWithNumber) {
                const num = parseInt(endsWithNumber[1]);
                if (num < 1900) isSeasonNumber = true;
              }
              if (!isSpecific && !isSeasonNumber) {
                if (normMatch.includes(normSeries) || normSeries.includes(normMatch)) {
                  prioritizeAbsolute = true;
                }
              }
            }
            const absEpisode = calculateAbsoluteEpisode(metadata, season, episode);
            if (absEpisode == episode) prioritizeAbsolute = false;
          }
          if (type === "movie") {
            if (episodes.length > 0) {
              targetEp = episodes[0];
            }
          } else {
            if (prioritizeAbsolute) {
              const absEpisode = calculateAbsoluteEpisode(metadata, season, episode);
              console.log(`[AnimeWorld] Prioritizing absolute episode: ${absEpisode} for "${match.title}"`);
              targetEp = episodes.find((e) => e.num == absEpisode);
              if (!targetEp) {
                console.log(`[AnimeWorld] Absolute episode ${absEpisode} not found in list. Available range: ${episodes.length > 0 ? episodes[0].num + "-" + episodes[episodes.length - 1].num : "None"}`);
              }
            } else {
              targetEp = episodes.find((e) => e.num == episode);
            }
          }
          if (!targetEp && season > 1 && !prioritizeAbsolute) {
            const absEpisode = calculateAbsoluteEpisode(metadata, season, episode);
            if (absEpisode != episode) {
              console.log(`[AnimeWorld] Relative episode ${episode} not found, trying absolute: ${absEpisode}`);
              targetEp = episodes.find((e) => e.num == absEpisode);
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
                if (targetEp && targetEp.num) {
                  displayTitle += ` - Ep ${targetEp.num}`;
                } else if (episode) {
                  displayTitle += ` - Ep ${episode}`;
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
            console.log(`[AnimeWorld] Episode ${episode} not found in ${match.title}`);
          }
        } catch (e) {
          console.error("[AnimeWorld] Error processing match:", e);
        }
      });
      if (bestSub) yield processMatch(bestSub, false);
      if (bestDub) yield processMatch(bestDub, true);
      return results.map((s) => formatStream(s, "AnimeWorld")).filter((s) => s !== null);
    } catch (e) {
      console.error("[AnimeWorld] getStreams error:", e);
      return [];
    }
  });
}
module.exports = {
  getStreams,
  searchAnime,
  getMetadata,
  findBestMatch,
  checkSimilarity
};
