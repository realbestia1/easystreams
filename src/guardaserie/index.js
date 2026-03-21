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
const { getProviderUrl } = require("../provider_urls.js");
function getGuardaserieBaseUrl() {
  return getProviderUrl("guardaserie");
}
const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
function getMappingApiUrl() {
  return getProviderUrl("mapping_api").replace(/\/+$/, "");
}
function normalizeConfigBoolean(value) {
  if (value === true) return true;
  const normalized = String(value || "").trim().toLowerCase();
  return ["1", "true", "yes", "on", "enabled", "checked"].includes(normalized);
}
function getMappingLanguage(providerContext = null) {
  const explicit = String(providerContext?.mappingLanguage || "").trim().toLowerCase();
  if (explicit === "it") return "it";
  return normalizeConfigBoolean(providerContext?.easyCatalogsLangIt) ? "it" : null;
}
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

const { extractMixDrop, extractDropLoad, extractSuperVideo, extractUqload, extractUpstream } = require('../extractors');
require('../fetch_helper.js');
const { checkQualityFromPlaylist } = require('../quality_helper.js');
const { formatStream } = require('../formatter.js');

function getQualityFromName(qualityStr) {
  if (!qualityStr) return 'Unknown';

  const quality = qualityStr.toUpperCase();

  // Map API quality values to normalized format
  if (quality === 'ORG' || quality === 'ORIGINAL') return 'Original';
  if (quality === '4K' || quality === '2160P') return '4K';
  if (quality === '1440P' || quality === '2K') return '1440p';
  if (quality === '1080P' || quality === 'FHD') return '1080p';
  if (quality === '720P' || quality === 'HD') return '720p';
  if (quality === '480P' || quality === 'SD') return '480p';
  if (quality === '360P') return '360p';
  if (quality === '240P') return '240p';

  // Try to extract number from string and format consistently
  const match = qualityStr.match(/(\d{3,4})[pP]?/);
  if (match) {
    const resolution = parseInt(match[1]);
    if (resolution >= 2160) return '4K';
    if (resolution >= 1440) return '1440p';
    if (resolution >= 1080) return '1080p';
    if (resolution >= 720) return '720p';
    if (resolution >= 480) return '480p';
    if (resolution >= 360) return '360p';
    return '240p';
  }

  return 'Unknown';
}

function getImdbId(tmdbId, type) {
  return __async(this, null, function* () {
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
}
function getShowInfo(tmdbId, type) {
  return __async(this, null, function* () {
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
}

function getTmdbIdFromImdb(imdbId, type) {
  return __async(this, null, function* () {
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
}

function getIdsFromKitsu(kitsuId, season, episode, providerContext = null) {
  return __async(this, null, function* () {
    try {
      if (!kitsuId) return null;
      const params = new URLSearchParams();
      const parsedEpisode = Number.parseInt(String(episode || ""), 10);
      const parsedSeason = Number.parseInt(String(season || ""), 10);
      if (Number.isInteger(parsedEpisode) && parsedEpisode > 0) {
        params.set("ep", String(parsedEpisode));
      } else {
        params.set("ep", "1");
      }
      if (Number.isInteger(parsedSeason) && parsedSeason >= 0) {
        params.set("s", String(parsedSeason));
      }
      params.set("lang", "it");

      const url = `${getMappingApiUrl()}/kitsu/${encodeURIComponent(String(kitsuId).trim())}?${params.toString()}`;
      const response = yield fetch(url);
      if (!response.ok) return null;
      const payload = yield response.json();
      const ids = payload && payload.mappings && payload.mappings.ids ? payload.mappings.ids : {};
      const tmdbEpisode =
        (payload && payload.mappings && (payload.mappings.tmdb_episode || payload.mappings.tmdbEpisode)) ||
        (payload && (payload.tmdb_episode || payload.tmdbEpisode)) ||
        null;
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
      console.error("[Guardaserie] Kitsu mapping error:", e);
      return null;
    }
  });
}

function verifyMoviePlayer(url, targetYear) {
  return __async(this, null, function* () {
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
      const titleMatch = html.match(/<title>.*\(.*(\d{4}).*\).*<\/title>/is);
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
function getStreams(id, type, season, episode, providerContext = null) {
  if (['movie'].includes(String(type).toLowerCase())) return [];
  return __async(this, null, function* () {
    if (String(type).toLowerCase() === "movie") return [];
    try {
      let tmdbId = id;
      let imdbId = null;
      let effectiveSeason = Number.parseInt(String(season || ""), 10);
      if (!Number.isInteger(effectiveSeason) || effectiveSeason < 1) effectiveSeason = 1;
      let effectiveEpisode = Number.parseInt(String(episode || ""), 10);
      if (!Number.isInteger(effectiveEpisode) || effectiveEpisode < 1) effectiveEpisode = 1;
      const contextTmdbId = providerContext && /^\d+$/.test(String(providerContext.tmdbId || ""))
        ? String(providerContext.tmdbId)
        : null;
      const contextImdbId = providerContext && /^tt\d+$/i.test(String(providerContext.imdbId || ""))
        ? String(providerContext.imdbId)
        : null;
      const contextKitsuId = providerContext && /^\d+$/.test(String(providerContext.kitsuId || ""))
        ? String(providerContext.kitsuId)
        : null;
      const shouldIncludeSeasonHintForKitsu =
        providerContext && providerContext.seasonProvided === true;

      if (id.toString().startsWith("kitsu:") || contextKitsuId) {
        const kitsuId =
          contextKitsuId ||
          (((id.toString().match(/^kitsu:(\d+)/i) || [])[1]) || null);
        const seasonHintForKitsu = shouldIncludeSeasonHintForKitsu ? season : null;
        const mapped = kitsuId ? (yield getIdsFromKitsu(kitsuId, seasonHintForKitsu, episode, providerContext)) : null;
        if (mapped) {
          if (mapped.tmdbId) {
            tmdbId = mapped.tmdbId;
            console.log(`[Guardaserie] Kitsu ${kitsuId} mapped to TMDB ID ${tmdbId}`);
          }
          if (mapped.imdbId) {
            imdbId = mapped.imdbId;
            console.log(`[Guardaserie] Kitsu ${kitsuId} mapped to IMDb ID ${imdbId}`);
          }
          if (mapped.mappedSeason && mapped.mappedEpisode) {
            effectiveSeason = mapped.mappedSeason;
            effectiveEpisode = mapped.mappedEpisode;
            console.log(`[Guardaserie] Using TMDB episode mapping ${effectiveSeason}x${effectiveEpisode} (raw=${mapped.rawEpisodeNumber || "n/a"})`);
          } else if (mapped.rawEpisodeNumber) {
            effectiveEpisode = mapped.rawEpisodeNumber;
            console.log(`[Guardaserie] Using mapped raw episode number ${effectiveEpisode}`);
          }
        } else {
          console.log(`[Guardaserie] No Kitsu mapping found for ${kitsuId}`);
        }
      } else if (id.toString().startsWith("tt")) {
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
      } else if (id.toString().startsWith("tmdb:")) {
        tmdbId = id.toString().replace("tmdb:", "");
      }

      if ((!tmdbId || String(tmdbId).startsWith("kitsu:")) && imdbId) {
        const byImdb = yield getTmdbIdFromImdb(imdbId, type);
        if (byImdb) {
          tmdbId = byImdb;
          console.log(`[Guardaserie] Resolved IMDb ${imdbId} to TMDB ${tmdbId}`);
        }
      }

      // Resolve IMDb ID for verification if we don't have it yet
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

      const year = (showInfo && showInfo.first_air_date) ? showInfo.first_air_date.split("-")[0] : "";
      const metaYear = year ? parseInt(year) : null;
      let showUrl = null;
      let showHtml = null;

      // 1. Attempt Search by IMDb ID (Preferred)
      if (imdbId) {
        console.log(`[Guardaserie] Searching by IMDb ID: ${imdbId}`);
        try {
          const params = new URLSearchParams();
          params.append("do", "search");
          params.append("subaction", "search");
          params.append("story", imdbId);
          const searchUrl = `${getGuardaserieBaseUrl()}/index.php?${params.toString()}`;

          const searchResponse = yield fetch(searchUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Referer": getGuardaserieBaseUrl()
            }
          });

          if (searchResponse.ok) {
            const searchHtml = yield searchResponse.text();
            const resultRegex = /<div class="mlnh-2">\s*<h2>\s*<a href="([^"]+)" title="([^"]+)">/i;
            const match = resultRegex.exec(searchHtml);

            if (match) {
              let foundUrl = match[1];
              const foundTitle = match[2];

              // Filter out titles with [SUB ITA]
              if (foundTitle.toUpperCase().includes("[SUB ITA]")) {
                console.log(`[Guardaserie] Filtering out subbed result from IMDb search: ${foundTitle}`);
              } else {
                if (foundUrl.startsWith('/')) foundUrl = `${getGuardaserieBaseUrl()}${foundUrl}`;
                console.log(`[Guardaserie] Found match by IMDb ID: ${foundUrl}`);

                const pageResponse = yield fetch(foundUrl, {
                  headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Referer": getGuardaserieBaseUrl()
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

      // 2. Fallback to Title Search (Legacy)
      if (!showUrl) {
        let candidates = [];
        console.log(`[Guardaserie] Searching by Title: ${title} (${year})`);
        const params = new URLSearchParams();
        params.append("do", "search");
        params.append("subaction", "search");
        params.append("story", title);
        const searchUrl = `${getGuardaserieBaseUrl()}/index.php?${params.toString()}`;
        const searchResponse = yield fetch(searchUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": getGuardaserieBaseUrl()
          }
        });
        const searchHtml = yield searchResponse.text();
        const resultRegex = /<div class="mlnh-2">\s*<h2>\s*<a href="([^"]+)" title="([^"]+)">[\s\S]*?<\/div>\s*<div class="mlnh-3 hdn">([^<]*)<\/div>/g;
        let match;



        while ((match = resultRegex.exec(searchHtml)) !== null) {
          const foundUrl = match[1];
          const foundTitle = match[2];
          const foundYearStr = match[3];

          // Filter out titles with [SUB ITA]
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

        // Filter candidates
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
                  "Referer": getGuardaserieBaseUrl()
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
              } catch (e) { }
              if (imdbId && imdbVarVal && imdbVarVal !== imdbId) {
                console.log(`[Guardaserie] Rejected ${candidate.url} due to show_imdb mismatch (${imdbVarVal} != ${imdbId}).`);
                continue;
              }
              if (!verifiedByVars) {
                try {
                  const tmdbLinkMatches = candidateHtml.match(/themoviedb\.org\/(?:tv|movie)\/(\d+)/g);
                  if (tmdbLinkMatches && tmdbLinkMatches.length > 0 && tmdbId) {
                    const foundIds = tmdbLinkMatches.map(l => {
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
                      const foundImdb = imdbLinkMatches.map(l => {
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
                } catch (e) { }
              }
              if (!verifiedByLinks && !verifiedByVars && imdbId) {
                const imdbMatches = candidateHtml.match(/tt\d{7,8}/g);
                if (imdbMatches && imdbMatches.length > 0) {
                  const targetId = imdbId;
                  const hasTarget = imdbMatches.includes(targetId);
                  const otherIds = imdbMatches.filter(m => m !== targetId);

                  if (!hasTarget && otherIds.length > 0) {
                    // Special case for One Piece alias/dub
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
      season = effectiveSeason;
      episode = effectiveEpisode;
      const episodeStr = `${season}x${episode}`;
      const episodeStrPadded = `${season}x${episode.toString().padStart(2, '0')}`;

      let episodeRegex = new RegExp(`data-num="${episodeStr}"`, "i");
      let episodeMatch = episodeRegex.exec(showHtml);

      if (!episodeMatch) {
        episodeRegex = new RegExp(`data-num="${episodeStrPadded}"`, "i");
        episodeMatch = episodeRegex.exec(showHtml);
      }

      // Also try to find episode in text content if data-num is missing or different format
      if (!episodeMatch && season === 1) {
        // Guardaserie might use "Episodio X" or just "X"
        // But usually they have the data-num attribute for the player loader

        // Try to find text "1x250"
        const textRegex = new RegExp(`${season}x${episode}`, "i");
        if (textRegex.test(showHtml)) {
          console.log(`[Guardaserie] Found text match for ${season}x${episode}, but no data-num. Scanning for links...`);
          // If we find text match, we might need to parse differently.
          // But for now let's just log.
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
      const streamPromises = links.map((link) => __async(null, null, function* () {
        try {
          const displayName = `${title} ${season}x${episode}`;

          let streamUrl = null;
          let playerName = "Unknown";

          if (link.includes("dropload")) {
            const extracted = yield extractDropLoad(link);
            if (extracted && extracted.url) {
              let quality = "HD";
              if (extracted.url.includes('.m3u8')) {
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
            const streamUrl = yield extractSuperVideo(link);
            playerName = "SuperVideo";
            if (streamUrl) {
              let quality = "HD";
              if (streamUrl.includes('.m3u8')) {
                const detected = yield checkQualityFromPlaylist(streamUrl);
                if (detected) quality = detected;
              } else {
                const lowerUrl = streamUrl.toLowerCase();
                if (lowerUrl.includes("4k") || lowerUrl.includes("2160")) quality = "4K";
                else if (lowerUrl.includes("1080") || lowerUrl.includes("fhd")) quality = "1080p";
                else if (lowerUrl.includes("720") || lowerUrl.includes("hd")) quality = "720p";
                else if (lowerUrl.includes("480") || lowerUrl.includes("sd")) quality = "480p";
                else if (lowerUrl.includes("360")) quality = "360p";
              }

              const normalizedQuality = getQualityFromName(quality);

              return {
                url: streamUrl,
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
              if (extracted.url.includes('.m3u8')) {
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
      return results
        .filter((r) => r !== null)
        .map(s => formatStream(s, "Guardaserie"))
        .filter(s => s !== null);
    } catch (e) {
      console.error("[Guardaserie] Error:", e);
      return [];
    }
  });
}
module.exports = { getStreams };
