const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
const MAPPING_API_URL = "https://animemapping.stremio.dpdns.org";

async function resolveTmdbFromKitsu(kitsuId) {
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
                const normalized = payload.mappedSeasons
                    .map((n) => parseInt(n, 10))
                    .filter((n) => Number.isInteger(n) && n > 0);
                if (normalized.length > 0) {
                    mappedSeasons = [...new Set(normalized)].sort((a, b) => a - b);
                }
            }

            const parsedSeriesCount = parseInt(payload.seriesSeasonCount, 10);
            if (Number.isInteger(parsedSeriesCount) && parsedSeriesCount > 0) {
                seriesSeasonCount = parsedSeriesCount;
            }
        };

        const withTopologyHints = (basePayload = {}) => ({
            ...basePayload,
            longSeries,
            episodeMode,
            mappedSeasons,
            seriesSeasonCount
        });

        // 1. Try Central Mapping API (Fastest and most accurate as it's updated on the edge)
        if (MAPPING_API_URL) {
            try {
                const apiResponse = await fetch(`${MAPPING_API_URL}/mapping/${id}`);
                if (apiResponse.ok) {
                    const apiData = await apiResponse.json();
                    applyTopologyHints(apiData);
                    titleHints = Array.isArray(apiData?.titleHints)
                        ? apiData.titleHints.map(x => String(x || "").trim()).filter(Boolean)
                        : [];
                    if (isMeaningfulSeasonName(apiData?.seasonName)) {
                        tmdbSeasonTitle = String(apiData.seasonName).trim();
                    }

                    if (apiData.tmdbId) {
                        if (apiData.season && !tmdbSeasonTitle) {
                            tmdbSeasonTitle = await getTmdbSeasonTitle(apiData.tmdbId, apiData.season);
                        }
                        console.log(`[TMDB Helper] API Hit (TMDB)! Kitsu ${id} -> TMDB ${apiData.tmdbId}, Season ${apiData.season} (Source: ${apiData.source})`);
                        return withTopologyHints({ tmdbId: apiData.tmdbId, season: apiData.season, tmdbSeasonTitle, titleHints });
                    }

                    // NEW: If we have IMDb ID, use it to find TMDB ID immediately
                    if (apiData.imdbId) {
                        console.log(`[TMDB Helper] API Hit (IMDb)! Kitsu ${id} -> IMDb ${apiData.imdbId}, Season ${apiData.season} (Source: ${apiData.source})`);
                        const findUrl = `https://api.themoviedb.org/3/find/${apiData.imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
                        const findResponse = await fetch(findUrl);
                        const findData = await findResponse.json();

                        if (findData.tv_results?.length > 0) {
                            if (!tmdbSeasonTitle && apiData.season) {
                                tmdbSeasonTitle = await getTmdbSeasonTitle(findData.tv_results[0].id, apiData.season);
                            }
                            return withTopologyHints({ tmdbId: findData.tv_results[0].id, season: apiData.season, tmdbSeasonTitle, titleHints });
                        }
                        else if (findData.movie_results?.length > 0) return withTopologyHints({ tmdbId: findData.movie_results[0].id, season: null, tmdbSeasonTitle, titleHints });

                        // Fallback: keep IMDb id so providers can resolve it later in metadata step.
                        return withTopologyHints({ tmdbId: apiData.imdbId, season: apiData.season ?? null, tmdbSeasonTitle, titleHints });
                    }
                }
            } catch (apiErr) {
                console.warn('[TMDB Helper] Mapping API Error:', apiErr.message);
            }
        }

        // Fetch Mappings
        const mappingResponse = await fetch(`https://kitsu.io/api/edge/anime/${id}/mappings`);
        let mappingData = null;
        if (mappingResponse.ok) {
            mappingData = await mappingResponse.json();
        }



        // Try to find TMDB ID from mappings
        if (mappingData && mappingData.data) {
            // Try TheTVDB
            const tvdbMapping = mappingData.data.find(m => m.attributes.externalSite === 'thetvdb');
            if (tvdbMapping) {
                const tvdbId = tvdbMapping.attributes.externalId;
                // TVDB ID often maps to TMDB TV ID
                const findUrl = `https://api.themoviedb.org/3/find/${tvdbId}?api_key=${TMDB_API_KEY}&external_source=tvdb_id`;
                const findResponse = await fetch(findUrl);
                const findData = await findResponse.json();

                if (findData.tv_results?.length > 0) tmdbId = findData.tv_results[0].id;
                else if (findData.movie_results?.length > 0) return withTopologyHints({ tmdbId: findData.movie_results[0].id, season: null, tmdbSeasonTitle, titleHints });
            }

            // Try IMDb
            if (!tmdbId) {
                const imdbMapping = mappingData.data.find(m => m.attributes.externalSite === 'imdb');
                if (imdbMapping) {
                    const imdbId = imdbMapping.attributes.externalId;
                    const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
                    const findResponse = await fetch(findUrl);
                    const findData = await findResponse.json();

                    if (findData.tv_results?.length > 0) tmdbId = findData.tv_results[0].id;
                    else if (findData.movie_results?.length > 0) return withTopologyHints({ tmdbId: findData.movie_results[0].id, season: null, tmdbSeasonTitle, titleHints });
                }
            }
        }

        // Fallback: Search by Title from Kitsu Details
        // We also need details to guess the season
        const detailsResponse = await fetch(`https://kitsu.io/api/edge/anime/${id}`);
        if (!detailsResponse.ok) return null;
        const detailsData = await detailsResponse.json();

        if (detailsData && detailsData.data && detailsData.data.attributes) {
            const attributes = detailsData.data.attributes;
            // Collect possible titles
            const titlesToTry = new Set();
            if (attributes.titles.en) titlesToTry.add(attributes.titles.en);
            if (attributes.titles.en_jp) titlesToTry.add(attributes.titles.en_jp);
            if (attributes.canonicalTitle) titlesToTry.add(attributes.canonicalTitle);
            if (attributes.titles.ja_jp) titlesToTry.add(attributes.titles.ja_jp);

            // Convert to array
            const titleList = Array.from(titlesToTry);

            const year = attributes.startDate ? attributes.startDate.substring(0, 4) : null;
            const subtype = attributes.subtype;

            // If we still don't have TMDB ID, search by title
            if (!tmdbId) {
                const type = (subtype === 'movie') ? 'movie' : 'tv';

                for (const title of titleList) {
                    if (tmdbId) break; // Found it
                    if (!title) continue;

                    let searchData = { results: [] };

                    // First try search WITH year if available
                    if (year) {
                        let yearParam = '';
                        if (type === 'movie') yearParam = `&primary_release_year=${year}`;
                        else yearParam = `&first_air_date_year=${year}`;

                        const searchUrlYear = `https://api.themoviedb.org/3/find/${title}?api_key=${TMDB_API_KEY}${yearParam}`; // Wait, search url was different
                        // Re-implementing search url correctly
                        const searchUrlYearCorrect = `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(title)}&api_key=${TMDB_API_KEY}${yearParam}`;
                        const res = await fetch(searchUrlYearCorrect);
                        const data = await res.json();
                        if (data.results && data.results.length > 0) {
                            searchData = data;
                        }
                    }

                    // If no results with strict year, try without year
                    if (!searchData.results || searchData.results.length === 0) {
                        const searchUrl = `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(title)}&api_key=${TMDB_API_KEY}`;
                        const searchResponse = await fetch(searchUrl);
                        searchData = await searchResponse.json();
                    }

                    if (searchData.results && searchData.results.length > 0) {
                        if (year) {
                            // Try to find exact year match in the results (even if we searched without year)
                            const match = searchData.results.find(r => {
                                const date = type === 'movie' ? r.release_date : r.first_air_date;
                                return date && date.startsWith(year);
                            });

                            if (match) {
                                tmdbId = match.id;
                            } else {
                                // Fallback logic
                                tmdbId = searchData.results[0].id;
                            }
                        } else {
                            tmdbId = searchData.results[0].id;
                        }
                    } else if (subtype !== 'movie') {
                        // If strict search failed, try cleaning title (remove season number)
                        // "My Hero Academia 2" -> "My Hero Academia"
                        const cleanTitle = title.replace(/\s(\d+)$/, '').replace(/\sSeason\s\d+$/i, '');
                        if (cleanTitle !== title) {
                            const cleanSearchUrl = `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(cleanTitle)}&api_key=${TMDB_API_KEY}`;
                            const cleanSearchResponse = await fetch(cleanSearchUrl);
                            const cleanSearchData = await cleanSearchResponse.json();
                            if (cleanSearchData.results && cleanSearchData.results.length > 0) {
                                tmdbId = cleanSearchData.results[0].id;
                            }
                        }
                    }
                } // End for titles
            }

            // Get best title for season heuristic
            const title = attributes.titles.en || attributes.titles.en_jp || attributes.canonicalTitle;

            // Determine Season from Title
            if (tmdbId && subtype !== 'movie') {
                // Heuristic to extract season number from title
                // e.g. "My Hero Academia 2", "Attack on Titan Season 3", "Overlord II"
                const lowerTitle = String(title || '').toLowerCase();

                // Specials/recaps are often represented as season 0 in providers.
                if (/\b(special|recap|ova|oav|movie)\b/i.test(lowerTitle)) {
                    season = 0;
                }

                // Explicit "Season X"
                const seasonMatch = title.match(/Season\s*(\d+)/i) || title.match(/(\d+)(?:st|nd|rd|th)\s*Season/i);
                if (!season && seasonMatch) {
                    season = parseInt(seasonMatch[1]);
                }
                // "Title X" (e.g. Boku no Hero Academia 2)
                else if (!season && title.match(/\s(\d+)$/)) {
                    season = parseInt(title.match(/\s(\d+)$/)[1]);
                }
                // Roman Numerals
                else if (!season && title.match(/\sII$/)) season = 2;
                else if (!season && title.match(/\sIII$/)) season = 3;
                else if (!season && title.match(/\sIV$/)) season = 4;
                else if (!season && title.match(/\sV$/)) season = 5;
                else if (!season && title.match(/\sVI$/)) season = 6;
                // Other common tags
                else if (title.includes("Final Season")) {
                    // This is harder as we don't know the absolute number, 
                    // but for some we might guess if it's famous. 
                    // For now, let's stick to explicit matches.
                }

                if (season) {
                    console.log(`[TMDB Helper] Heuristic Season detected for ${id}: Season ${season} (${title})`);
                }
            }
        }

        if (tmdbId && season && !tmdbSeasonTitle) {
            tmdbSeasonTitle = await getTmdbSeasonTitle(tmdbId, season);
        }
        return withTopologyHints({ tmdbId, season, tmdbSeasonTitle, titleHints });

    } catch (e) {
        console.error("[TMDB Helper] Kitsu resolve error:", e);
        return null;
    }
}

function isMeaningfulSeasonName(name) {
    const s = String(name || '').trim();
    if (!s) return false;
    if (/^Season\s+\d+$/i.test(s)) return false;
    if (/^Stagione\s+\d+$/i.test(s)) return false;
    return true;
}

async function getTmdbSeasonTitle(tmdbId, season, language = "en-US") {
    try {
        const id = String(tmdbId || "").trim();
        const s = parseInt(season, 10);
        if (!id || !s) return null;

        const primaryUrl = `https://api.themoviedb.org/3/tv/${id}/season/${s}?api_key=${TMDB_API_KEY}&language=${encodeURIComponent(language)}`;
        const primaryResponse = await fetch(primaryUrl);
        if (primaryResponse.ok) {
            const primaryData = await primaryResponse.json();
            if (primaryData?.name && !/^Season\s+\d+$/i.test(primaryData.name)) {
                return String(primaryData.name).trim();
            }
        }

        const fallbackUrl = `https://api.themoviedb.org/3/tv/${id}/season/${s}?api_key=${TMDB_API_KEY}&language=it-IT`;
        const fallbackResponse = await fetch(fallbackUrl);
        if (!fallbackResponse.ok) return null;
        const fallbackData = await fallbackResponse.json();
        if (fallbackData?.name && !/^Stagione\s+\d+$/i.test(fallbackData.name)) {
            return String(fallbackData.name).trim();
        }
        return null;
    } catch (_) {
        return null;
    }
}

async function getTvdbTitle(tvdbId) {
    try {
        const id = String(tvdbId || '').trim();
        if (!id) return null;
        const url = `https://api.tvmaze.com/lookup/shows?thetvdb=${encodeURIComponent(id)}`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        const baseName = data?.name || null;
        const mazeId = data?.id;

        // Prefer EN/latin aliases when available; fallback to baseName.
        if (mazeId) {
            try {
                const akaResponse = await fetch(`https://api.tvmaze.com/shows/${mazeId}/akas`);
                if (akaResponse.ok) {
                    const akas = await akaResponse.json();
                    const preferred = pickPreferredEnglishAlias(akas);
                    if (preferred) return preferred;
                }
            } catch (_) {
                // Ignore alias lookup failures and fallback gracefully.
            }
        }

        return baseName;
    } catch (e) {
        return null;
    }
}

function pickPreferredEnglishAlias(akas) {
    if (!Array.isArray(akas) || akas.length === 0) return null;

    const isLatin = (s) => /[A-Za-z]/.test(String(s || ''));
    const score = (a) => {
        const name = String(a?.name || '');
        const code = String(a?.country?.code || '').toUpperCase();
        let points = 0;
        if (['US', 'GB', 'CA', 'AU'].includes(code)) points += 4;
        if (isLatin(name)) points += 3;
        if (/english/i.test(String(a?.country?.name || ''))) points += 2;
        // Slight preference for concise aliases.
        if (name.length > 0 && name.length <= 80) points += 1;
        return points;
    };

    const sorted = [...akas]
        .filter(a => a && a.name)
        .sort((a, b) => score(b) - score(a));

    const best = sorted[0];
    return best ? String(best.name).trim() : null;
}

async function getTmdbFromKitsu(kitsuId) {
    return resolveTmdbFromKitsu(kitsuId);
}

async function getSeasonEpisodeFromAbsolute(tmdbId, absoluteEpisode) {
    try {
        const url = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=seasons`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();

        let totalEpisodes = 0;

        // Sort seasons by number just in case
        const seasons = data.seasons.filter(s => s.season_number > 0).sort((a, b) => a.season_number - b.season_number);

        for (const season of seasons) {
            if (absoluteEpisode <= totalEpisodes + season.episode_count) {
                return {
                    season: season.season_number,
                    episode: absoluteEpisode - totalEpisodes
                };
            }
            totalEpisodes += season.episode_count;
        }

        // If we overflow, maybe it's in the last season or unknown
        return null;
    } catch (e) {
        console.error("[TMDB] Error mapping absolute episode:", e);
        return null;
    }
}

function isAnime(metadata) {
    if (!metadata) return false;

    // 1. Check Genre
    // TMDB Genres: Animation (16)
    const isAnimation = metadata.genres && metadata.genres.some(g => g.id === 16 || g.name === 'Animation' || g.name === 'Animazione');
    if (!isAnimation) return false;

    // 2. Check Country/Language
    // We want to restrict to Asian animation (Anime/Donghua/Aeni)
    const asianCountries = ['JP', 'CN', 'KR', 'TW', 'HK'];
    const asianLangs = ['ja', 'zh', 'ko', 'cn'];

    let countries = [];
    if (metadata.origin_country && Array.isArray(metadata.origin_country)) {
        countries = metadata.origin_country;
    } else if (metadata.production_countries && Array.isArray(metadata.production_countries)) {
        // production_countries is array of objects { iso_3166_1: "US", ... }
        countries = metadata.production_countries.map(c => c.iso_3166_1);
    }

    const hasAsianCountry = countries.some(c => asianCountries.includes(c));
    const hasAsianLang = asianLangs.includes(metadata.original_language);

    return hasAsianCountry || hasAsianLang;
}

module.exports = { getTmdbFromKitsu, getSeasonEpisodeFromAbsolute, isAnime, getTvdbTitle, pickPreferredEnglishAlias };
