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
    var MAPPING_API_URL = "https://animemapping.stremio.dpdns.org";
    function getTmdbFromKitsu2(kitsuId) {
      return __async(this, null, function* () {
        var _a, _b, _c, _d, _e, _f;
        try {
          const id = String(kitsuId).replace("kitsu:", "");
          let tmdbId = null;
          let season = null;
          if (MAPPING_API_URL) {
            try {
              const apiResponse = yield fetch(`${MAPPING_API_URL}/mapping/${id}`);
              if (apiResponse.ok) {
                const apiData = yield apiResponse.json();
                if (apiData.tmdbId) {
                  console.log(`[TMDB Helper] API Hit (TMDB)! Kitsu ${id} -> TMDB ${apiData.tmdbId}, Season ${apiData.season} (Source: ${apiData.source})`);
                  return { tmdbId: apiData.tmdbId, season: apiData.season };
                }
                if (apiData.imdbId) {
                  console.log(`[TMDB Helper] API Hit (IMDb)! Kitsu ${id} -> IMDb ${apiData.imdbId}, Season ${apiData.season} (Source: ${apiData.source})`);
                  const findUrl = `https://api.themoviedb.org/3/find/${apiData.imdbId}?api_key=${TMDB_API_KEY2}&external_source=imdb_id`;
                  const findResponse = yield fetch(findUrl);
                  const findData = yield findResponse.json();
                  if (((_a = findData.tv_results) == null ? void 0 : _a.length) > 0) return { tmdbId: findData.tv_results[0].id, season: apiData.season };
                  else if (((_b = findData.movie_results) == null ? void 0 : _b.length) > 0) return { tmdbId: findData.movie_results[0].id, season: null };
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
              if (((_c = findData.tv_results) == null ? void 0 : _c.length) > 0) tmdbId = findData.tv_results[0].id;
              else if (((_d = findData.movie_results) == null ? void 0 : _d.length) > 0) return { tmdbId: findData.movie_results[0].id, season: null };
            }
            if (!tmdbId) {
              const imdbMapping = mappingData.data.find((m) => m.attributes.externalSite === "imdb");
              if (imdbMapping) {
                const imdbId = imdbMapping.attributes.externalId;
                const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY2}&external_source=imdb_id`;
                const findResponse = yield fetch(findUrl);
                const findData = yield findResponse.json();
                if (((_e = findData.tv_results) == null ? void 0 : _e.length) > 0) tmdbId = findData.tv_results[0].id;
                else if (((_f = findData.movie_results) == null ? void 0 : _f.length) > 0) return { tmdbId: findData.movie_results[0].id, season: null };
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
              const seasonMatch = title.match(/Season\s*(\d+)/i) || title.match(/(\d+)(?:st|nd|rd|th)\s*Season/i);
              if (seasonMatch) {
                season = parseInt(seasonMatch[1]);
              } else if (title.match(/\s(\d+)$/)) {
                season = parseInt(title.match(/\s(\d+)$/)[1]);
              } else if (title.match(/\sII$/)) season = 2;
              else if (title.match(/\sIII$/)) season = 3;
              else if (title.match(/\sIV$/)) season = 4;
              else if (title.match(/\sV$/)) season = 5;
              else if (title.match(/\sVI$/)) season = 6;
              else if (title.includes("Final Season")) {
              }
              if (season) {
                console.log(`[TMDB Helper] Heuristic Season detected for ${id}: Season ${season} (${title})`);
              }
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
      let seasonName = null;
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
        seasonName
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
      const url = `https://api.themoviedb.org/3/tv/${id}/season/${season}?api_key=${TMDB_API_KEY}&language=${encodeURIComponent(language)}`;
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
function normalizeSeasonInRange(season, seasons) {
  if (!Number.isInteger(season) || season <= 0 || !Array.isArray(seasons)) return season;
  const seasonNumbers = seasons.map((s) => s.season_number).filter((n) => Number.isInteger(n) && n > 0);
  if (seasonNumbers.length === 0 || seasonNumbers.includes(season)) return season;
  const minSeason = Math.min(...seasonNumbers);
  const maxSeason = Math.max(...seasonNumbers);
  const shouldClampHigh = season > maxSeason + 1;
  const shouldClampLow = season < minSeason - 1;
  if (!shouldClampHigh && !shouldClampLow) return season;
  return shouldClampHigh ? maxSeason : minSeason;
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
      let mappedSeason = metadata.mappedSeason;
      if (mappedSeason !== null && mappedSeason !== void 0) {
        const parsedMapped = parseInt(mappedSeason, 10);
        if (!isNaN(parsedMapped)) mappedSeason = parsedMapped;
      }
      if (mappedSeason && metadata.seasons && Array.isArray(metadata.seasons)) {
        const normalizedMappedSeason = normalizeSeasonInRange(mappedSeason, metadata.seasons);
        if (normalizedMappedSeason !== mappedSeason) {
          const seasonNumbers = metadata.seasons.map((s) => s.season_number).filter((n) => Number.isInteger(n) && n > 0);
          if (seasonNumbers.length > 0) {
            const minSeason = Math.min(...seasonNumbers);
            const maxSeason = Math.max(...seasonNumbers);
            console.log(`[AnimeWorld] Mapped season ${mappedSeason} is out of TMDB range (${minSeason}-${maxSeason}). Using ${normalizedMappedSeason} instead.`);
          }
          mappedSeason = normalizedMappedSeason;
        }
      }
      if (mappedSeason) {
        console.log(`[AnimeWorld] Kitsu mapping indicates Season ${mappedSeason}. Overriding requested Season ${season}`);
        season = mappedSeason;
      }
      const parsedSeason = Number.isInteger(season) ? season : parseInt(season, 10);
      if (!isNaN(parsedSeason) && metadata.seasons && Array.isArray(metadata.seasons)) {
        const normalizedRequestedSeason = normalizeSeasonInRange(parsedSeason, metadata.seasons);
        if (normalizedRequestedSeason !== parsedSeason) {
          const seasonNumbers = metadata.seasons.map((s) => s.season_number).filter((n) => Number.isInteger(n) && n > 0);
          if (seasonNumbers.length > 0) {
            const minSeason = Math.min(...seasonNumbers);
            const maxSeason = Math.max(...seasonNumbers);
            console.log(`[AnimeWorld] Requested season ${parsedSeason} is out of TMDB range (${minSeason}-${maxSeason}). Using ${normalizedRequestedSeason} instead.`);
          }
        }
        season = normalizedRequestedSeason;
      }
      const title = metadata.title || metadata.name;
      const originalTitle = metadata.original_title || metadata.original_name;
      const looseTargets = [
        title,
        originalTitle,
        ...(metadata.alternatives || []).slice(0, 30).map((a) => a.title)
      ].filter(Boolean);
      const isRelevantByLooseMatch = (candidateTitle, extraTargets = []) => {
        return isLooselyRelevant(candidateTitle, [...looseTargets, ...extraTargets].filter(Boolean));
      };
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
      if (season > 1 && metadata.seasons) {
        const targetSeason = metadata.seasons.find((s) => s.season_number === season);
        if (targetSeason && targetSeason.air_date) {
          const yearMatch = String(targetSeason.air_date).match(/(\d{4})/);
          if (yearMatch) seasonYear = parseInt(yearMatch[1], 10);
        }
      }
      if (season > 1 && metadata.id) {
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
              if (res && res.length > 0) {
                const relevantRes = res.filter((c) => {
                  const normalizeText = (str) => String(str || "").toLowerCase().replace(/&#x27;|&#039;/g, "'").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
                  const cNorm = normalizeText(c.title);
                  const sNorm = normalizeText(seasonNameCandidate);
                  const matchesSeasonName = sNorm.length > 0 && (cNorm.includes(sNorm) || checkSimilarity(c.title, seasonNameCandidate));
                  if (!matchesSeasonName) return false;
                  return checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title, query);
                });
                if (relevantRes.length > 0) {
                  console.log(`[AnimeWorld] Strategy 1 - Found relevance for: ${query}`);
                  candidates = relevantRes;
                  seasonNameMatch = true;
                  seasonNameUsed = seasonNameCandidate;
                  break;
                }
              }
            }
            if (seasonNameMatch) break;
          }
          if (!seasonNameUsed && seasonNameCandidates.length > 0) {
            seasonNameUsed = seasonNameCandidates[0];
          }
          seasonName = seasonNameUsed || seasonName;
        }
        if (!seasonNameMatch) {
          for (const query of searchQueries) {
            console.log(`[AnimeWorld] Strategy 1 - Numeric Season search: ${query}`);
            const res = yield searchAnime(query);
            if (res && res.length > 0) {
              const relevantRes = res.filter(
                (c) => checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title, query)
              );
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
      let bestSub = findBestMatch(subs, title, originalTitle, season, metadata, {
        bypassSeasonCheck: seasonNameMatch,
        seasonName,
        seasonYear
      });
      let bestDub = findBestMatch(dubs, title, originalTitle, season, metadata, {
        bypassSeasonCheck: seasonNameMatch,
        seasonName,
        seasonYear
      });
      let pickBySeasonYear = null;
      if (season > 1 && seasonYear) {
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
      if (season > 1 && (!bestSub || !bestDub)) {
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
      if (season > 1) {
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
          const alignedDub = findBestMatch(compatibleDubs, title, originalTitle, season, metadata, {
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
      const results = [];
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
      const pickNextSplitCourCandidate = (currentMatch, candidatePool = []) => {
        const currentPart = getPartIndexFromMatch(currentMatch) || 1;
        const seasonTokenRegex = new RegExp(`\\b${season}\\b|season\\s*${season}|stagione\\s*${season}`, "i");
        let best = null;
        for (const c of candidatePool) {
          if (!c || c.href === currentMatch.href) continue;
          const part = getPartIndexFromMatch(c);
          if (!part || part <= currentPart) continue;
          const raw = String(c.title || "");
          const isRelevant = seasonTokenRegex.test(raw) || checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle);
          if (!isRelevant) continue;
          if (!best || part < best.part || part === best.part && raw.length < String(best.candidate.title || "").length) {
            best = { candidate: c, part };
          }
        }
        return best ? best.candidate : null;
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
            const absEpisode = calculateAbsoluteEpisode(metadata, season, requestedEpisode);
            if (absEpisode == requestedEpisode) prioritizeAbsolute = false;
          }
          if (type === "movie") {
            if (episodes.length > 0) {
              targetEp = episodes[0];
            }
          } else {
            if (prioritizeAbsolute) {
              const absEpisode = calculateAbsoluteEpisode(metadata, season, requestedEpisode);
              console.log(`[AnimeWorld] Prioritizing absolute episode: ${absEpisode} for "${match.title}"`);
              targetEp = episodes.find((e) => e.num == absEpisode);
              if (!targetEp) {
                console.log(`[AnimeWorld] Absolute episode ${absEpisode} not found in list. Available range: ${episodes.length > 0 ? episodes[0].num + "-" + episodes[episodes.length - 1].num : "None"}`);
              }
            } else {
              targetEp = episodes.find((e) => e.num == requestedEpisode);
            }
          }
          if (!targetEp && season > 1 && !prioritizeAbsolute) {
            const absEpisode = calculateAbsoluteEpisode(metadata, season, requestedEpisode);
            if (absEpisode != requestedEpisode) {
              console.log(`[AnimeWorld] Relative episode ${requestedEpisode} not found, trying absolute: ${absEpisode}`);
              targetEp = episodes.find((e) => e.num == absEpisode);
            }
          }
          if (!targetEp && allowSplitFallback && season > 1 && type !== "movie") {
            const numericEpisodes = episodes.map((e) => parseInt(e.num, 10)).filter((n) => Number.isInteger(n) && n > 0);
            const maxEpisodeInPart = numericEpisodes.length > 0 ? Math.max(...numericEpisodes) : 0;
            if (maxEpisodeInPart > 0 && requestedEpisode > maxEpisodeInPart) {
              const nextCandidate = pickNextSplitCourCandidate(match, candidatePool || []);
              const mappedEpisode = requestedEpisode - maxEpisodeInPart;
              if (nextCandidate && mappedEpisode > 0) {
                console.log(`[AnimeWorld] Split-cour switch: "${match.title}" -> "${nextCandidate.title}", mapped episode ${requestedEpisode} -> ${mappedEpisode}`);
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
                if (targetEp && targetEp.num) {
                  displayTitle += ` - Ep ${targetEp.num}`;
                } else if (requestedEpisode) {
                  displayTitle += ` - Ep ${requestedEpisode}`;
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
module.exports = {
  getStreams,
  searchAnime,
  getMetadata,
  findBestMatch,
  checkSimilarity
};
