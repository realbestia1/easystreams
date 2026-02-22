var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
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

// src/animeworld/index.js
var BASE_URL = "https://www.animeworld.ac";
var TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
function getMetadata(id, type) {
  return __async(this, null, function* () {
    try {
      const normalizedType = String(type).toLowerCase();
      let tmdbId = id;
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
      return __spreadProps(__spreadValues({}, details), {
        imdb_id,
        tmdb_id: tmdbId
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
function findBestMatch(candidates, title, originalTitle, season, metadata, options = {}) {
  if (!candidates || candidates.length === 0) return null;
  const isTv = !!metadata.name;
  const normTitle = title.toLowerCase().trim();
  const normOriginal = originalTitle ? originalTitle.toLowerCase().trim() : "";
  const metaYear = metadata.first_air_date ? parseInt(metadata.first_air_date.substring(0, 4)) : metadata.release_date ? parseInt(metadata.release_date.substring(0, 4)) : null;
  const preYearExactMatches = candidates.filter((c) => {
    const t = (c.title || "").toLowerCase().trim();
    return t === normTitle || normOriginal && t === normOriginal;
  });
  if (metaYear && (season === 1 || !isTv)) {
    const yearFiltered = candidates.filter((c) => {
      if (!c.date) return true;
      const cYear = parseInt(c.date);
      return Math.abs(cYear - metaYear) <= 2;
    });
    if (yearFiltered.length > 0) {
      candidates = yearFiltered;
    } else if (candidates.length > 0) {
      return null;
    }
  }
  if (preYearExactMatches.length > 0) {
    const anyExactMatchSurvived = candidates.some(
      (c) => preYearExactMatches.some((pym) => pym.href === c.href)
      // Use href as ID
    );
    if (!anyExactMatchSurvived) {
      console.log("[AnimeWorld] All exact matches rejected by year filter. Returning null to avoid mismatch.");
      return null;
    }
  }
  if (options.bypassSeasonCheck) {
    return candidates[0];
  }
  if (season === 0) {
    const specialTypes = ["special", "ova", "movie"];
    const specialTitleMatch = candidates.find((c) => (c.title || "").toLowerCase().includes("special"));
    if (specialTitleMatch) {
      if (checkSimilarity(specialTitleMatch.title, title) || checkSimilarity(specialTitleMatch.title, originalTitle)) {
        return specialTitleMatch;
      }
    }
    const first = candidates[0];
    const sim1 = checkSimilarity(first.title, title);
    const sim2 = checkSimilarity(first.title, originalTitle);
    if (sim1 || sim2) {
      return first;
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
      if (subtitle.length > 3) {
        let subMatch = candidates.find((c) => {
          const t = (c.title || "").toLowerCase();
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
        if (subMatch) return subMatch;
      }
    }
    const clean = (str) => str.replace(/\b(film|movie|the|and|or|of|in|on|at|to|a|an)\b/gi, "").replace(/[^a-z0-9\s]/gi, "").replace(/\s+/g, " ").trim();
    const normClean = clean(normTitle);
    if (normClean.length > 3) {
      const words = normClean.split(" ");
      let bestCandidate = null;
      let maxMatches = 0;
      for (const c of candidates) {
        const cTitle = (c.title || "").toLowerCase();
        const cClean = clean(cTitle);
        const cWords = cClean.split(" ");
        let matches = 0;
        for (const w of words) {
          if (cWords.includes(w) || cTitle.includes(w)) matches++;
        }
        if (cTitle.includes("movie") || cTitle.includes("film")) matches += 0.5;
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
      return regex.test(t);
    });
    if (numberMatch) return numberMatch;
    const roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
    if (season < roman.length) {
      const romanStr = roman[season];
      const romanMatch = candidates.find((c) => {
        const t = (c.title || "").toLowerCase();
        const regex = new RegExp(`\\b${romanStr}$|\\b${romanStr}\\b`, "i");
        return regex.test(t);
      });
      if (romanMatch) return romanMatch;
    }
  } else {
    const sorted = [...candidates].sort((a, b) => {
      return (a.title || "").length - (b.title || "").length;
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
      return !hasNumberSuffix(t);
    });
    if (noNumberMatch) return noNumberMatch;
    const first = sorted[0];
    if (checkSimilarity(first.title, title) || checkSimilarity(first.title, originalTitle)) {
      return first;
    }
    return null;
  }
  return candidates[0];
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
function fetchTooltipDate(tooltipUrl) {
  return __async(this, null, function* () {
    if (!tooltipUrl) return null;
    try {
      const url = `${BASE_URL}/${tooltipUrl}`;
      const response = yield fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": BASE_URL,
          "X-Requested-With": "XMLHttpRequest"
        }
      });
      if (!response.ok) return null;
      const html = yield response.text();
      const dateMatch = /Data di uscita:[\s\S]*?<span>([\s\S]*?)<\/span>/i.exec(html);
      if (dateMatch) {
        const dateStr = dateMatch[1].trim();
        const yearMatch = /(\d{4})/.exec(dateStr);
        if (yearMatch) return yearMatch[1];
      }
      return null;
    } catch (e) {
      console.error("[AnimeWorld] Tooltip fetch error:", e);
      return null;
    }
  });
}
function getStreams(id, type, season, episode) {
  return __async(this, null, function* () {
    try {
      const metadata = yield getMetadata(id, type);
      if (!metadata) {
        console.error("[AnimeWorld] Metadata not found for", id);
        return [];
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
          console.log(`[AnimeWorld] Special search: ${query}`);
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
            console.log(`[AnimeWorld] Specific Season Name search: ${query}`);
            const res = yield searchAnime(query);
            if (res && res.length > 0) {
              console.log(`[AnimeWorld] Found matches for season name: ${query}`);
              const valid = res.some((c) => checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle));
              if (valid) {
                candidates = res;
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
              const valid = res.some((c) => checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle));
              if (valid) {
                candidates = res;
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
      }
      if (isMovie) {
        const variantCandidates = [];
        if (title.includes(" - ")) {
          const colonTitle = title.replace(" - ", ": ");
          console.log(`[AnimeWorld] Colon search: ${colonTitle}`);
          const colonRes = yield searchAnime(colonTitle);
          if (colonRes && colonRes.length > 0) variantCandidates.push(...colonRes);
        }
        if (title.includes(":")) {
          const parts = title.split(":");
          if (parts.length > 1) {
            const subtitle = parts[parts.length - 1].trim();
            if (subtitle.length > 3) {
              console.log(`[AnimeWorld] Movie subtitle search: ${subtitle}`);
              const subRes = yield searchAnime(subtitle);
              if (subRes && subRes.length > 0) variantCandidates.push(...subRes);
              if (/part\s*\d+/i.test(subtitle)) {
                const simpleSubtitle = subtitle.replace(/part\s*\d+/i, "").trim();
                if (simpleSubtitle.length > 3) {
                  console.log(`[AnimeWorld] Simplified subtitle search: ${simpleSubtitle}`);
                  const simpleRes = yield searchAnime(simpleSubtitle);
                  if (simpleRes && simpleRes.length > 0) variantCandidates.push(...simpleRes);
                }
              }
            }
            const mainTitle = parts[0].trim();
            const movieQuery = `${mainTitle} Movie`;
            console.log(`[AnimeWorld] Movie query search: ${movieQuery}`);
            const movieRes = yield searchAnime(movieQuery);
            if (movieRes && movieRes.length > 0) variantCandidates.push(...movieRes);
          }
        } else {
          if (!title.toLowerCase().includes("movie")) {
            const movieQuery = `${title} Movie`;
            console.log(`[AnimeWorld] Movie query search: ${movieQuery}`);
            const movieRes = yield searchAnime(movieQuery);
            if (movieRes && movieRes.length > 0) variantCandidates.push(...movieRes);
          }
        }
        if (variantCandidates.length > 0) {
          candidates = [...variantCandidates, ...candidates];
          candidates = candidates.filter((v, i, a) => a.findIndex((t) => t.href === v.href) === i);
        }
      }
      if ((!candidates || candidates.length === 0) && originalTitle && originalTitle !== title) {
        console.log(`[AnimeWorld] Trying original title: ${originalTitle}`);
        candidates = yield searchAnime(originalTitle);
      }
      if (!candidates || candidates.length === 0) {
        console.log("[AnimeWorld] No anime found");
        return [];
      }
      const subs = candidates.filter((c) => c.isSub);
      const dubs = candidates.filter((c) => c.isDub);
      const enrichTopCandidates = (list) => __async(null, null, function* () {
        const top = list.slice(0, 3);
        for (const c of top) {
          if (!c.date && c.tooltipUrl) {
            const year = yield fetchTooltipDate(c.tooltipUrl);
            if (year) c.date = year;
          }
        }
        return top;
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
          const aTagRegex = /<a[^>]+data-episode-num="([^"]+)"[^>]+data-id="([^"]+)"[^>]*>/g;
          let epMatch;
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
          let targetEp = episodes.find((e) => e.num == episode);
          if (!targetEp && season > 1) {
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
                if (infoData.grabber.includes("1080p")) quality = "1080p";
                else if (infoData.grabber.includes("720p")) quality = "720p";
                else if (infoData.grabber.includes("480p")) quality = "480p";
                else if (infoData.grabber.includes("360p")) quality = "360p";
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
                let displayTitle = `${match.title} - Ep ${episode}`;
                if (isDub && !displayTitle.includes("(ITA)")) displayTitle += " (ITA)";
                if (!isDub && !displayTitle.includes("(SUB ITA)")) displayTitle += " (SUB ITA)";
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
          } else {
            console.log(`[AnimeWorld] Episode ${episode} not found in ${match.title}`);
          }
        } catch (e) {
          console.error("[AnimeWorld] Error processing match:", e);
        }
      });
      if (bestSub) yield processMatch(bestSub, false);
      if (bestDub) yield processMatch(bestDub, true);
      return results;
    } catch (e) {
      console.error("[AnimeWorld] getStreams error:", e);
      return [];
    }
  });
}
module.exports = {
  getStreams,
  searchAnime
};
