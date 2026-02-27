const { extractVixCloud } = require('../extractors');
require('../fetch_helper.js');
const { getTmdbFromKitsu, isAnime } = require('../tmdb_helper.js');
const { formatStream } = require('../formatter.js');
const { checkQualityFromPlaylist } = require('../quality_helper.js');

const BASE_URL = "https://www.animeunity.so";
const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

async function getMetadata(id, type, requestedSeason = null, prefetchedMapping = null) {
    try {
        const normalizedType = String(type).toLowerCase();
        let tmdbId = id;
        let mappedSeason = null;
        let mappedSeasonName = null;
        let mappedTitleHints = [];
        let longSeries = false;
        let episodeMode = null;
        let mappedSeasons = [];
        let seriesSeasonCount = null;

        const mergeHints = (base, incoming) => {
            const joined = [...(Array.isArray(base) ? base : []), ...(Array.isArray(incoming) ? incoming : [])]
                .map(x => String(x || "").trim())
                .filter(Boolean);
            return [...new Set(joined)];
        };

        const isMeaningfulSeasonName = (name) => {
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

            if (isMeaningfulSeasonName(payload.seasonName)) {
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
                const normalized = payload.mappedSeasons
                    .map(n => parseInt(n, 10))
                    .filter(n => Number.isInteger(n) && n > 0);
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
            if (!payload || typeof payload !== "object") return null;
            return {
                tmdbId: payload.tmdbId ?? payload.tmdb_id ?? null,
                season: payload.mappedSeason ?? payload.season ?? null,
                seasonName: payload.mappedSeasonName ?? payload.seasonName ?? null,
                titleHints: payload.mappedTitleHints ?? payload.titleHints ?? [],
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

        // Handle Kitsu ID
        if (String(id).startsWith("kitsu:")) {
            if (hasPrefetchedTmdb) {
                console.log(`[AnimeUnity] Using prefetched mapping for ${id} -> TMDB ${tmdbId} (Mapped Season: ${mappedSeason})`);
            } else {
                const resolved = await getTmdbFromKitsu(id);
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

        // Strip tmdb: prefix
        if (String(id).startsWith("tmdb:")) {
            tmdbId = String(id).replace("tmdb:", "");
        }

        // If it's an IMDb ID, find the TMDB ID first
        if (String(id).startsWith("tt")) {
            if (String(tmdbId).startsWith("tt")) {
                const findUrl = `https://api.themoviedb.org/3/find/${id}?api_key=${TMDB_API_KEY}&external_source=imdb_id&language=it-IT`;
                const findResponse = await fetch(findUrl);
                if (!findResponse.ok) return null;
                const findData = await findResponse.json();
                const results = normalizedType === "movie" ? findData.movie_results : findData.tv_results;
                if (!results || results.length === 0) return null;
                tmdbId = results[0].id;
            }
        }

        let endpoint = normalizedType === "movie" ? "movie" : "tv";
        let response = await fetch(`https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=it-IT`);
        if (!response.ok) {
            endpoint = endpoint === "movie" ? "tv" : "movie";
            response = await fetch(`https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=it-IT`);
            if (!response.ok) return null;
        }
        // Get Alternative Titles
        let alternatives = [];
        try {
            const altUrl = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}/alternative_titles?api_key=${TMDB_API_KEY}`;
            const altResponse = await fetch(altUrl);
            if (altResponse.ok) {
                const altData = await altResponse.json();
                alternatives = altData.titles || altData.results || [];
            }
        } catch (e) {
            console.error("[AnimeUnity] Alt titles fetch error:", e);
        }

        return {
            ...await response.json(),
            alternatives,
            mappedSeason,
            mappedSeasonName,
            mappedTitleHints,
            longSeries,
            episodeMode,
            mappedSeasons,
            seriesSeasonCount
        };
    } catch (e) {
        console.error("[AnimeUnity] Metadata error:", e);
        return null;
    }
}

async function getSeasonMetadata(id, season, language = "it-IT") {
    try {
        const url = `https://api.themoviedb.org/3/tv/${id}/season/${season}?api_key=${TMDB_API_KEY}&language=${encodeURIComponent(language)}`;
        const response = await fetch(url);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        return null;
    }
}

function calculateAbsoluteEpisode(metadata, season, episode) {
    if (!metadata || !metadata.seasons || season === 1) return episode;

    // Check if the provided episode number is likely already absolute
    // (i.e. it exceeds the episode count of the requested season)
    const currentSeason = metadata.seasons.find(s => s.season_number === season);
    if (currentSeason && episode > currentSeason.episode_count) {
        // Double check: if it's within the cumulative range of previous seasons + current season?
        // Actually, if it's > episode_count, it CANNOT be relative to this season.
        // Unless metadata is wrong. But assuming metadata is somewhat correct (TMDB),
        // and user input is from a system aware of absolute numbering (like some trackers),
        // it's safer to treat it as absolute.
        // For One Piece S4: 39 eps. Request 101. Definitely absolute.
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

function normalizeSeasonInRange(season, seasons) {
    if (!Number.isInteger(season) || season <= 0 || !Array.isArray(seasons)) return season;

    const seasonNumbers = seasons
        .map(s => s.season_number)
        .filter(n => Number.isInteger(n) && n > 0);

    if (seasonNumbers.length === 0 || seasonNumbers.includes(season)) return season;

    const minSeason = Math.min(...seasonNumbers);
    const maxSeason = Math.max(...seasonNumbers);
    const shouldClampHigh = season > (maxSeason + 1);
    const shouldClampLow = season < (minSeason - 1);

    if (!shouldClampHigh && !shouldClampLow) return season;
    return shouldClampHigh ? maxSeason : minSeason;
}

// Helper for similarity check
const checkSimilarity = (candTitle, targetTitle) => {
    if (!targetTitle) return false;
    const normalize = s => String(s).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const t1 = normalize(candTitle);
    const t2 = normalize(targetTitle);

    if (t1.length < 2 || t2.length < 2) return false;

    // Direct inclusion
    if (t1.includes(t2) || t2.includes(t1)) return true;

    // Word overlap
    const w1 = t1.split(/\s+/).filter(w => w.length > 2);
    const w2 = t2.split(/\s+/).filter(w => w.length > 2);

    if (w1.length === 0 || w2.length === 0) return false;

    let matches = 0;
    for (const w of w2) {
        if (w1.includes(w)) matches++;
    }

    const score = matches / w2.length;
    // console.log(`[AnimeUnity] Similarity: "${t1}" vs "${t2}" -> score ${score} (matches: ${matches}/${w2.length})`);

    // Require at least 50% of target words to be in candidate
    return score >= 0.5;
};

function normalizeLooseText(text) {
    return String(text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/&#x27;|&#039;/g, "'")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function tokenizeLooseText(text) {
    const stopWords = new Set([
        "the", "a", "an", "and", "or", "of", "to", "in", "on", "at", "by", "for", "with",
        "il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "e", "o", "di", "da", "con",
        "season", "stagione", "part", "parte", "movie", "film", "tv", "ita", "sub"
    ]);

    return normalizeLooseText(text)
        .split(" ")
        .map(t => t.replace(/([aeiou])\1+/g, "$1"))
        .filter(t => t.length > 2 && !stopWords.has(t));
}

function hasLooseOverlap(candidateTitle, targetTitle) {
    const cTokens = tokenizeLooseText(candidateTitle);
    const tTokens = tokenizeLooseText(targetTitle);
    if (cTokens.length === 0 || tTokens.length === 0) return false;
    return cTokens.some(ct => ct.length >= 6 && tTokens.includes(ct));
}

function isLooselyRelevant(candidateTitle, targets = []) {
    return targets.some(t => hasLooseOverlap(candidateTitle, t));
}

function tokenizeForPairing(text) {
    const normalized = String(text || "")
        .toLowerCase()
        .replace(/\(ita\)|\(sub ita\)|\[ita\]|\[sub ita\]/g, " ")
        .replace(/&#x27;|&#039;/g, "'")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (!normalized) return [];

    const stopWords = new Set([
        "the", "a", "an", "and", "or", "of", "to", "in", "on", "at", "by", "for", "with",
        "il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "e", "o", "di", "da", "con",
        "season", "stagione", "part", "parte", "movie", "film", "tv", "ita", "sub", "arc", "hen"
    ]);

    return normalized
        .split(" ")
        .filter(t => t.length > 2 && !stopWords.has(t));
}

function areCoherentCandidates(a, b, title, originalTitle) {
    if (!a || !b) return true;

    const aTitle = (a.title || a.title_eng || "").trim();
    const bTitle = (b.title || b.title_eng || "").trim();
    if (!aTitle || !bTitle) return true;

    const normalize = (str) => String(str || "")
        .toLowerCase()
        .replace(/\(ita\)|\(sub ita\)|\[ita\]|\[sub ita\]/g, " ")
        .replace(/&#x27;|&#039;/g, "'")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const aNorm = normalize(aTitle);
    const bNorm = normalize(bTitle);
    if (!aNorm || !bNorm) return true;
    if (aNorm === bNorm) return true;

    if (!checkSimilarity(aTitle, bTitle) && !checkSimilarity(bTitle, aTitle)) return false;

    const baseTokens = new Set([
        ...tokenizeForPairing(title || ""),
        ...tokenizeForPairing(originalTitle || "")
    ]);

    const aSpecific = tokenizeForPairing(aTitle).filter(t => !baseTokens.has(t));
    const bSpecific = tokenizeForPairing(bTitle).filter(t => !baseTokens.has(t));

    if (aSpecific.length === 0 || bSpecific.length === 0) return true;
    return aSpecific.some(t => bSpecific.includes(t));
}

function findBestMatch(candidates, title, originalTitle, season, metadata, options = {}) {
    if (!candidates || candidates.length === 0) return null;

    // Filter candidates based on metadata type
    const isTv = !!metadata.name; // TV shows have 'name', movies have 'title'
    let appliedSeasonYearFilter = false;

    let filteredCandidates = candidates;
    if (isTv && season !== 0) { // Only filter for TV if not searching for specials (season 0)
        // Prioritize TV/ONA for series
        const tvTypes = ['TV', 'ONA'];
        const matches = candidates.filter(c => tvTypes.includes(c.type));
        // Strict filtering: if we look for TV, only accept TV/ONA
        if (matches.length > 0) {
            filteredCandidates = matches;
        } else {
            return null;
        }
    } else {
        // For movies
        const movieTypes = ['Movie', 'Special', 'OVA', 'ONA'];
        const matches = candidates.filter(c => movieTypes.includes(c.type));
        if (matches.length > 0) {
            filteredCandidates = matches;
        } else {
            // If no movie types found, but we have candidates, maybe the type classification is weird?
            // But usually we want to be strict.
            // However, for ONA movies, we need to include ONA.
            return null;
        }
    }

    // Normalize titles
    const normTitle = title.toLowerCase().trim();
    const normOriginal = originalTitle ? originalTitle.toLowerCase().trim() : "";

    // Check for exact matches BEFORE year filtering
    const preYearExactMatches = filteredCandidates.filter(c => {
        const t = (c.title || "").toLowerCase().trim();
        const te = (c.title_eng || "").toLowerCase().trim();
        const tClean = t.replace(/\s*\(ita\)$/i, "").trim();
        const teClean = te.replace(/\s*\(ita\)$/i, "").trim();
        return t === normTitle || te === normTitle || tClean === normTitle || teClean === normTitle ||
            (normOriginal && (t === normOriginal || te === normOriginal || tClean === normOriginal || teClean === normOriginal));
    });

    // Filter by Year if available (only for Season 1 or Movies)
    const metaYear = metadata.first_air_date ? parseInt(metadata.first_air_date.substring(0, 4)) :
        (metadata.release_date ? parseInt(metadata.release_date.substring(0, 4)) : null);

    if (metaYear && (season === 1 || !isTv)) {
        const yearFiltered = filteredCandidates.filter(c => {
            if (!c.date || c.date === "Indeterminato" || c.date === "?") {
                // Strict check: if date is missing/indeterminato, we filter it out (unless user wants to keep it?)
                // Assuming we tried enrichment already.
                // If it's still missing, it's safer to discard to avoid false positives.
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
            // If strictly filtered out, return null to avoid bad match
            return null;
        }
    }

    // For multi-season anime, prefer candidates close to the requested TMDB season year.
    // Apply only if we actually find matching candidates; otherwise keep old behavior.
    if (season > 1 && options.seasonYear) {
        const targetYear = parseInt(options.seasonYear, 10);
        if (!isNaN(targetYear)) {
            const seasonYearCandidates = filteredCandidates
                .map(c => {
                    if (!c.date || c.date === "Indeterminato" || c.date === "?") return null;
                    const match = String(c.date).match(/(\d{4})/);
                    if (!match) return null;
                    const cYear = parseInt(match[1], 10);
                    return { candidate: c, diff: Math.abs(cYear - targetYear) };
                })
                .filter(x => x && x.diff <= 2);

            if (seasonYearCandidates.length > 0) {
                const minDiff = Math.min(...seasonYearCandidates.map(x => x.diff));
                filteredCandidates = seasonYearCandidates
                    .filter(x => x.diff === minDiff)
                    .map(x => x.candidate);
                appliedSeasonYearFilter = true;
            }
        }
    }

    // Check if we lost all exact matches due to year filtering.
    // For season > 1 this is too strict, because exact base-title matches are often Season 1.
    if (preYearExactMatches.length > 0 && (season === 1 || !isTv)) {
        const anyExactMatchSurvived = filteredCandidates.some(c =>
            preYearExactMatches.some(pym => pym.id === c.id)
        );
        if (!anyExactMatchSurvived) {
            // console.log("[AnimeUnity] All exact matches rejected by year filter. Returning null to avoid mismatch.");
            return null;
        }
    }

    // If options.bypassSeasonCheck is true, return the best match based on title similarity only
    // This is used when we searched for a specific season name (e.g. "Diamond is Unbreakable")
    if (options.bypassSeasonCheck) {
        // We trust the search results, just pick the one that looks like the show?
        // Actually, if we searched for "Diamond is Unbreakable", and got "JoJo Part 4...",
        // it might not match "Le bizzarre avventure di JoJo".
        // But since it's from a specific search, we can probably just take the first valid one.
        return filteredCandidates[0];
    }

    // If season === 0, only accept entries that look like Specials/OVA/Movie
    // and are aligned with the requested title.
    if (season === 0) {
        const isSpecialLikeCandidate = (candidate) => {
            const raw = `${candidate?.title || ""} ${candidate?.title_eng || ""}`.toLowerCase();
            const cType = String(candidate?.type || "").toLowerCase();
            if (cType === "special" || cType === "ova" || cType === "movie") return true;
            return /\b(special|speciale|ova|oav|movie|film|recap|extra|zero|episodio\s*0|ep\s*0)\b/i.test(raw);
        };
        const isTitleAligned = (candidate) => {
            const candidateRaw = `${candidate?.title || ""} ${candidate?.title_eng || ""}`;
            const candidateNorm = normalizeLooseText(candidateRaw);
            const candidateTokens = tokenizeLooseText(candidateRaw);
            const targets = [title, originalTitle].filter(Boolean);
            for (const target of targets) {
                const targetTokens = tokenizeLooseText(target);
                if (targetTokens.length > 0 && candidateTokens.length > 0) {
                    const matched = targetTokens.filter(t => candidateTokens.includes(t)).length;
                    const minNeeded = Math.max(1, Math.ceil(targetTokens.length * 0.6));
                    if (matched >= minNeeded) return true;
                }
                const tNorm = normalizeLooseText(target);
                if (!tNorm) continue;
                if (
                    candidateNorm === tNorm ||
                    candidateNorm.startsWith(`${tNorm} `) ||
                    candidateNorm.includes(` ${tNorm} `) ||
                    candidateNorm.endsWith(` ${tNorm}`)
                ) {
                    return true;
                }
            }
            return false;
        };

        const seasonZeroCandidates = filteredCandidates.filter(c => isSpecialLikeCandidate(c) && isTitleAligned(c));
        if (seasonZeroCandidates.length === 0) {
            console.log("[AnimeUnity] No season 0 match found passing specials/title checks");
            return null;
        }

        const withSpecialWord = seasonZeroCandidates.find(c =>
            /\b(special|speciale|ova|oav|movie|film)\b/i.test(`${c.title || ""} ${c.title_eng || ""}`)
        );
        return withSpecialWord || seasonZeroCandidates[0];
    }

    // 1. Try to find exact match (Title or Original Title)
    // Only for Season 1, as subsequent seasons usually have different titles
    const exactMatch = filteredCandidates.find(c => {
        const t = (c.title || "").toLowerCase().trim();
        const te = (c.title_eng || "").toLowerCase().trim();
        return t === normTitle || te === normTitle ||
            (normOriginal && (t === normOriginal || te === normOriginal));
    });

    if (exactMatch && season === 1) return exactMatch;

    // Special logic for Movies (if not exact match)
    if (!isTv && season === 1) {
        // If searching for a movie with a subtitle (e.g. "Title: Subtitle")
        if (normTitle.includes(':')) {
            const parts = normTitle.split(':');
            const subtitle = parts[parts.length - 1].trim();
            if (subtitle.length > 3) {
                // Try finding the full subtitle
                let subMatch = filteredCandidates.find(c => {
                    const t = (c.title || "").toLowerCase();
                    const te = (c.title_eng || "").toLowerCase();
                    return t.includes(subtitle) || te.includes(subtitle);
                });

                // If not found and subtitle has "Part X", try matching without it
                if (!subMatch && /part\s*\d+/i.test(subtitle)) {
                    const simpleSubtitle = subtitle.replace(/part\s*\d+/i, "").trim();
                    if (simpleSubtitle.length > 3) {
                        subMatch = filteredCandidates.find(c => {
                            const t = (c.title || "").toLowerCase();
                            const te = (c.title_eng || "").toLowerCase();
                            return t.includes(simpleSubtitle) || te.includes(simpleSubtitle);
                        });
                    }
                }

                if (subMatch) return subMatch;
            }
        }

        // Fuzzy Match for Movies
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

    // If season > 1, we expect the title to potentially differ
    if (season > 1) {
        const seasonStr = String(season);
        const seasonNameHints = Array.isArray(options.seasonNames)
            ? options.seasonNames.map(s => String(s || "").trim()).filter(Boolean)
            : [];
        const normalizeCandidateTitle = (candidate) => String(candidate.title || candidate.title_eng || "")
            .toLowerCase()
            .replace(/\s*\(ita\)\s*$/i, "")
            .replace(/&#x27;|&#039;/g, "'")
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        const baseTitleNorm = String(title || "")
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        const baseOriginalNorm = String(originalTitle || "")
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        const isBaseEntry = (candidate) => {
            const cNorm = normalizeCandidateTitle(candidate);
            return cNorm === baseTitleNorm || (baseOriginalNorm && cNorm === baseOriginalNorm);
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
            const normalize = (s) => String(s || "")
                .toLowerCase()
                .replace(/&#x27;|&#039;/g, "'")
                .replace(/[^a-z0-9\s]/g, " ")
                .replace(/\s+/g, " ")
                .trim();
            const tokenize = (s) => normalize(s).split(/\s+/).filter(Boolean);
            const genericTokens = new Set(["season", "stagione", "part", "parte", "the", "and", "dei", "degli", "della"]);
            const baseTokenSet = new Set([
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

                // Full hint containment is a strong season-specific signal.
                if (cNorm.includes(hNorm)) {
                    return Math.max(maxScore, 3);
                }

                // Require at least one distinctive token from hint
                // (not part of base series title and not generic words).
                const distinctive = tokenize(hNorm).filter(t =>
                    t.length >= 4 &&
                    !baseTokenSet.has(t) &&
                    !genericTokens.has(t)
                );
                if (distinctive.length === 0) return maxScore;

                const matchedDistinctive = distinctive.filter(t => cNorm.includes(t)).length;
                if (matchedDistinctive === 0) return maxScore;

                // Avoid false positives on generic franchise strings:
                // score only if candidate matches most of the hint's distinctive tokens.
                const coverage = matchedDistinctive / distinctive.length;
                if (coverage < 0.75) return maxScore;

                // Prefer candidates matching more distinctive hint tokens.
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
        const seasonSpecificCandidates = filteredCandidates.filter(c => !isBaseEntry(c) && hasSpecificSeasonMarkers(c));

        if (seasonNameHints.length > 0) {
            const seasonNameMatches = filteredCandidates.filter(c => getSeasonNameScore(c) > 0);
            if (seasonNameMatches.length > 0) {
                const preferredSeasonNameMatch = sortSeasonSpecific(seasonNameMatches)[0];
                if (preferredSeasonNameMatch) return preferredSeasonNameMatch;
            }
        }

        // Check for numeric suffix or "Season X"
        const numberCandidates = filteredCandidates.filter(c => {
            const t = (c.title || "").toLowerCase();
            const te = (c.title_eng || "").toLowerCase();
            const regex = new RegExp(`\\b${seasonStr}$|\\b${seasonStr}\\b|season\\s*${seasonStr}|stagione\\s*${seasonStr}`, 'i');
            return regex.test(t) || regex.test(te);
        });
        if (numberCandidates.length > 0) {
            if (seasonNameHints.length > 0) {
                const alignedNumberCandidates = sortSeasonSpecific(numberCandidates.filter(c => getSeasonNameScore(c) > 0));
                if (alignedNumberCandidates.length > 0) return alignedNumberCandidates[0];
            }

            // Avoid false positives like "Part 4" when TMDB season number does not map 1:1 to franchise parts.
            const nonPartNumberCandidates = numberCandidates.filter(c => {
                const raw = `${c.title || ""} ${c.title_eng || ""}`.toLowerCase();
                return !new RegExp(`\\bpart(?:e)?\\s*${seasonStr}\\b`, 'i').test(raw);
            });

            const rankedNumberCandidates = sortSeasonSpecific(nonPartNumberCandidates.length > 0 ? nonPartNumberCandidates : numberCandidates);
            if (rankedNumberCandidates.length > 0) return rankedNumberCandidates[0];
        }

        // Check for Roman numerals
        const roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
        if (season < roman.length) {
            const romanStr = roman[season];
            const romanCandidates = filteredCandidates.filter(c => {
                const t = (c.title || "").toLowerCase();
                const te = (c.title_eng || "").toLowerCase();
                const regex = new RegExp(`\\b${romanStr}$|\\b${romanStr}\\b`, 'i');
                return regex.test(t) || regex.test(te);
            });
            if (romanCandidates.length > 0) {
                if (seasonNameHints.length > 0) {
                    const alignedRomanCandidates = sortSeasonSpecific(romanCandidates.filter(c => getSeasonNameScore(c) > 0));
                    if (alignedRomanCandidates.length > 0) return alignedRomanCandidates[0];
                }
                return sortSeasonSpecific(romanCandidates)[0];
            }
        }

        // If candidates were narrowed by season year, trust the best remaining season-era entry.
        // If we have explicit non-base season entries, prioritize them over base-title matches.
        if (appliedSeasonYearFilter && filteredCandidates.length > 0) {
            const seasonPool = seasonSpecificCandidates.length > 0
                ? sortSeasonSpecific(seasonSpecificCandidates)
                : filteredCandidates;
            const seasonYearMatch = seasonPool.find(c => {
                if ((checkSimilarity(c.title, title) || checkSimilarity(c.title_eng, title)) ||
                    (checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title_eng, originalTitle))) return true;
                if (metadata.alternatives) {
                    return metadata.alternatives.some(alt => (checkSimilarity(c.title, alt.title) || checkSimilarity(c.title_eng, alt.title)));
                }
                return false;
            });
            if (seasonYearMatch) return seasonYearMatch;
            return seasonPool[0];
        }

        if (seasonSpecificCandidates.length > 0) {
            const sortedSpecific = sortSeasonSpecific(seasonSpecificCandidates);
            const specificMatch = sortedSpecific.find(c => {
                if ((checkSimilarity(c.title, title) || checkSimilarity(c.title_eng, title)) ||
                    (checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title_eng, originalTitle))) return true;
                if (metadata.alternatives) {
                    return metadata.alternatives.some(alt => (checkSimilarity(c.title, alt.title) || checkSimilarity(c.title_eng, alt.title)));
                }
                return false;
            });
            if (specificMatch) return specificMatch;
            return sortedSpecific[0];
        }

        // Last fallback for long-running shows that keep one base entry
        const baseMatch = filteredCandidates.find(c => {
            const t = (c.title || "").toLowerCase().trim();
            const te = (c.title_eng || "").toLowerCase().trim();
            const tClean = t.replace(/\s*\(ita\)$/i, "").trim();
            const teClean = te.replace(/\s*\(ita\)$/i, "").trim();
            return t === normTitle || te === normTitle || tClean === normTitle || teClean === normTitle ||
                (normOriginal && (t === normOriginal || te === normOriginal || tClean === normOriginal || teClean === normOriginal));
        });

        if (baseMatch) {
            console.log(`[AnimeUnity] Found base title match for Season ${season}: ${baseMatch.title || baseMatch.title_eng}`);
            return baseMatch;
        }
    } else {
        // Season 1: Try to avoid titles with numbers at the end (likely sequels)
        // Sort by length to prefer shorter titles (usually S1 is just "Title" vs "Title: Subtitle")
        const sorted = [...filteredCandidates].sort((a, b) => {
            const lenA = (a.title || a.title_eng || "").length;
            const lenB = (b.title || b.title_eng || "").length;
            return lenA - lenB;
        });

        // If we didn't find exact match, try to find one without number suffix
        // Robust regex to detect number at end, ignoring (ITA)
        // Also exclude "Final Season", "Season X", "Stagione X"
        const hasNumberSuffix = (str) => {
            if (!str) return false;
            // Ends with number (e.g. "Title 2")
            if (/(\s|^)\d+(\s*\(ITA\))?$/i.test(str)) return true;
            // Contains "Final Season"
            if (/final\s*season/i.test(str)) return true;
            // Contains "Season/Stagione X" where X is digit
            if (/(season|stagione)\s*\d+/i.test(str)) return true;
            return false;
        };

        const noNumberMatch = sorted.find(c => {
            const t = (c.title || "").trim();
            const te = (c.title_eng || "").trim();
            if (hasNumberSuffix(t) || hasNumberSuffix(te)) return false;

            // Check similarity
            if ((checkSimilarity(c.title, title) || checkSimilarity(c.title_eng, title)) || (checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title_eng, originalTitle))) return true;
            if (metadata.alternatives) {
                return metadata.alternatives.some(alt => (checkSimilarity(c.title, alt.title) || checkSimilarity(c.title_eng, alt.title)));
            }
            return false;
        });

        if (noNumberMatch) return noNumberMatch;

        // If all have numbers or fail similarity, try to find ANY that passes similarity
        const anyMatch = sorted.find(c => {
            if ((checkSimilarity(c.title, title) || checkSimilarity(c.title_eng, title)) || (checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title_eng, originalTitle))) return true;
            if (metadata.alternatives) {
                return metadata.alternatives.some(alt => (checkSimilarity(c.title, alt.title) || checkSimilarity(c.title_eng, alt.title)));
            }
            return false;
        });

        if (anyMatch) return anyMatch;
    }

    return null; // Return null if no suitable match found
}

async function searchAnime(query) {
    try {
        const url = `${BASE_URL}/archivio?title=${encodeURIComponent(query)}`;
        const response = await fetch(url, {
            headers: {
                "User-Agent": USER_AGENT,
                "Referer": BASE_URL
            }
        });

        if (!response.ok) return [];

        const html = await response.text();
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
}

async function fetchAnimeYear(id, slug) {
    if (!id || !slug) return null;
    try {
        // AnimeUnity URL structure: /anime/{id}-{slug}
        const url = `${BASE_URL}/anime/${id}-${slug}`;
        const response = await fetch(url, {
            headers: {
                "User-Agent": USER_AGENT,
                "Referer": BASE_URL
            }
        });

        if (!response.ok) return null;
        const html = await response.text();

        // Extract Year from <div class="info-item"><strong>Anno</strong><br> <small>1999</small></div>
        // Or simply look for <strong>Anno</strong>...<small>YYYY</small>
        const dateMatch = /<strong>Anno<\/strong>[\s\S]*?<small>(\d{4})<\/small>/i.exec(html);
        if (dateMatch) {
            return dateMatch[1];
        }
        return null;
    } catch (e) {
        console.error("[AnimeUnity] Detail fetch error:", e);
        return null;
    }
}

async function getStreams(id, type, season, episode, providerContext = null) {
    try {
        const metadata = await getMetadata(id, type, season, providerContext);
        if (!metadata) {
            console.error("[AnimeUnity] Metadata not found for", id);
            return [];
        }

        if (!isAnime(metadata)) {
            console.log(`[AnimeUnity] Skipped ${metadata.title} (Not an anime)`);
            return [];
        }

        let mappedSeason = metadata.mappedSeason;
        if (mappedSeason !== null && mappedSeason !== undefined) {
            const parsedMapped = parseInt(mappedSeason, 10);
            if (!isNaN(parsedMapped)) mappedSeason = parsedMapped;
        }
        // Do not clamp mapped season to TMDB season range:
        // some anime have split/incorrect TMDB season indexing (e.g. only S1 present).
        // We must preserve mappedSeason from external sources (TVDB/IMDb/Kitsu mapping API).

        const episodeMode = String(metadata.episodeMode || "").toLowerCase();
        const mappedSeasonCount = Array.isArray(metadata.mappedSeasons)
            ? metadata.mappedSeasons.filter((n) => Number.isInteger(parseInt(n, 10)) && parseInt(n, 10) > 0).length
            : 0;
        const parsedSeriesSeasonCount = parseInt(metadata.seriesSeasonCount, 10);
        const seriesSeasonCount = Number.isInteger(parsedSeriesSeasonCount) ? parsedSeriesSeasonCount : 0;
        const tmdbSeasonCount = Array.isArray(metadata.seasons)
            ? metadata.seasons.filter((s) => Number.isInteger(s?.season_number) && s.season_number > 0).length
            : 0;
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
        const seasonForMatch = seasonSearchEnabled ? season : (season === 0 ? 0 : 1);

        const title = metadata.title || metadata.name;
        const originalTitle = metadata.original_title || metadata.original_name;
        const looseTargets = [
            title,
            originalTitle,
            ...((metadata.alternatives || []).slice(0, 30).map(a => a.title)),
            ...((metadata.mappedTitleHints || []).slice(0, 20))
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
            const targetSeason = metadata.seasons.find(s => s.season_number === season);
            if (targetSeason && targetSeason.air_date) {
                const yearMatch = String(targetSeason.air_date).match(/(\d{4})/);
                if (yearMatch) seasonYear = parseInt(yearMatch[1], 10);
            }
        }

        const normalizeCandidateTitle = (candidate) => String(candidate.title || candidate.title_eng || "")
            .toLowerCase()
            .replace(/\s*\(ita\)\s*$/i, "")
            .replace(/&#x27;|&#039;/g, "'")
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        const baseTitleNorm = String(title || "")
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        const baseOriginalNorm = String(originalTitle || "")
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        const isBaseEntryLocal = (candidate) => {
            const cNorm = normalizeCandidateTitle(candidate);
            return cNorm === baseTitleNorm || (baseOriginalNorm && cNorm === baseOriginalNorm);
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
            const matchesMain = (checkSimilarity(candidate.title, title) || checkSimilarity(candidate.title_eng, title)) ||
                (checkSimilarity(candidate.title, originalTitle) || checkSimilarity(candidate.title_eng, originalTitle)) ||
                isRelevantByLooseMatch(candidateCombined);
            if (!matchesMain) return false;

            if (metadata.alternatives && metadata.alternatives.some(alt =>
                checkSimilarity(candidate.title, alt.title) ||
                checkSimilarity(candidate.title_eng, alt.title) ||
                isRelevantByLooseMatch(candidateCombined, [alt.title])
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

        // Strategy 0: If season === 0, search for "Special", "OAV", "Movie"
        if (season === 0) {
            const searchQueries = [
                `${title} Special`,
                `${title} OAV`,
                `${title} Movie`
            ];

            for (const query of searchQueries) {
                console.log(`[AnimeUnity] Special search: ${query}`);
                const res = await searchAnime(query);
                if (res && res.length > 0) {
                    candidates = candidates.concat(res);
                }
            }

            // Remove duplicates
            candidates = candidates.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
        }

        // Strategy 1: If season > 1, build a broad season-aware pool from season-name + numeric + base queries.
        if (seasonSearchEnabled) {
            const searchQueries = [
                `${title} ${season}`,
                `${title} Season ${season}`,
                `${title} Stagione ${season}`
            ];

            // Try original title too if different
            if (originalTitle && originalTitle !== title) {
                searchQueries.push(`${originalTitle} ${season}`);
            }

            const seasonStrategyCandidates = [];
            const addRelevantSeasonCandidates = (results, query) => {
                if (!results || results.length === 0) return 0;
                const relevantRes = results.filter(c => isRelevantSeasonCandidateLocal(c, query));
                if (relevantRes.length > 0) {
                    seasonStrategyCandidates.push(...relevantRes);
                }
                return relevantRes.length;
            };

            // Try TMDB Season Name with priority: English, then Italian
            const seasonNames = [];
            if (metadata.mappedSeasonName && !metadata.mappedSeasonName.match(/^Season \d+|^Stagione \d+/i)) {
                seasonNames.push(metadata.mappedSeasonName);
            }
            if (Array.isArray(metadata.mappedTitleHints) && metadata.mappedTitleHints.length > 0) {
                seasonNames.push(...metadata.mappedTitleHints);
            }

            const seasonMetaEn = await getSeasonMetadata(metadata.id, season, "en-US");
            if (!seasonYear && seasonMetaEn && seasonMetaEn.air_date) {
                const yearMatch = String(seasonMetaEn.air_date).match(/(\d{4})/);
                if (yearMatch) seasonYear = parseInt(yearMatch[1], 10);
            }
            if (seasonMetaEn && seasonMetaEn.name && !seasonMetaEn.name.match(/^Season \d+/i)) {
                seasonNames.push(seasonMetaEn.name);
            }

            const seasonMetaIt = await getSeasonMetadata(metadata.id, season, "it-IT");
            if (!seasonYear && seasonMetaIt && seasonMetaIt.air_date) {
                const yearMatch = String(seasonMetaIt.air_date).match(/(\d{4})/);
                if (yearMatch) seasonYear = parseInt(yearMatch[1], 10);
            }
            if (seasonMetaIt && seasonMetaIt.name && !seasonMetaIt.name.match(/^Season \d+|^Stagione \d+/i)) {
                seasonNames.push(seasonMetaIt.name);
            }

            const uniqueSeasonNames = [...new Set(seasonNames.map(n => String(n).trim()).filter(Boolean))];
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
                    const res = await searchAnime(query);
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
                const res = await searchAnime(query);
                addRelevantSeasonCandidates(res, query);
            }

            // Enrich with a broad base query when season-name search matched only one arc/cour.
            if (seasonNameMatch || seasonStrategyCandidates.length === 0) {
                const broadQueries = [title];
                if (originalTitle && originalTitle !== title) broadQueries.push(originalTitle);

                for (const query of broadQueries) {
                    console.log(`[AnimeUnity] Season pool enrichment search: ${query}`);
                    const res = await searchAnime(query);
                    addRelevantSeasonCandidates(res, query);
                }
            }

            if (seasonStrategyCandidates.length > 0) {
                candidates = seasonStrategyCandidates.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
            }
        }

        const isMovie = (metadata.genres && metadata.genres.some(g => g.name === 'Movie')) || season === 0 || type === 'movie';

        if (candidates.length === 0) {
            console.log(`[AnimeUnity] Standard search: ${title}`);
            candidates = await searchAnime(title);

            // If standard results exist but do not contain the requested season token,
            // retry a dehyphenated query and prefer it when it aligns better.
            if (seasonSearchEnabled && candidates.length > 0 && title.includes('-')) {
                const seasonTokenRegex = new RegExp(`\\b${season}\\b|season\\s*${season}|stagione\\s*${season}|part\\s*${season}|parte\\s*${season}`, "i");
                const hasRequestedSeasonInStandard = candidates.some(c => {
                    const raw = `${c.title || ""} ${c.title_eng || ""}`;
                    return seasonTokenRegex.test(raw);
                });

                if (!hasRequestedSeasonInStandard) {
                    const dehyphenated = title.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
                    if (dehyphenated !== title) {
                        console.log(`[AnimeUnity] Standard search lacks season ${season}. Dehyphenated search: ${dehyphenated}`);
                        const dehyphenCandidates = await searchAnime(dehyphenated);
                        if (dehyphenCandidates && dehyphenCandidates.length > 0) {
                            const hasRequestedSeasonInDehyphen = dehyphenCandidates.some(c => {
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

            // Strategy 2.1: If no results and title contains hyphens, try without them
            // e.g. "One-Punch Man" → "One Punch Man"
            if (candidates.length === 0 && title.includes('-')) {
                const dehyphenated = title.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
                if (dehyphenated !== title) {
                    console.log(`[AnimeUnity] Dehyphenated search: ${dehyphenated}`);
                    candidates = await searchAnime(dehyphenated);
                }
            }

            // Strategy 2.5: If type is movie and no results or just to be sure, try subtitle/movie variants
            if (candidates.length === 0 && isMovie) {
                // 0. Replace " - " with ": " (Common issue with TMDB titles like "One Piece Film - Red")
                if (title.includes(' - ')) {
                    const colonTitle = title.replace(' - ', ': ');
                    console.log(`[AnimeUnity] Colon search: ${colonTitle}`);
                    const colonRes = await searchAnime(colonTitle);
                    if (colonRes && colonRes.length > 0) candidates = candidates.concat(colonRes);
                }

                if (title.includes(':')) {
                    const parts = title.split(':');
                    if (parts.length > 1) {
                        const subtitle = parts[parts.length - 1].trim();
                        if (subtitle.length > 3) {
                            console.log(`[AnimeUnity] Movie subtitle search: ${subtitle}`);
                            const subRes = await searchAnime(subtitle);
                            if (subRes && subRes.length > 0) candidates = candidates.concat(subRes);

                            // If subtitle contains "Part X", try searching without it (e.g. "Grudge of Edinburgh Part 1" -> "Grudge of Edinburgh")
                            if (/part\s*\d+/i.test(subtitle)) {
                                const simpleSubtitle = subtitle.replace(/part\s*\d+/i, "").trim();
                                if (simpleSubtitle.length > 3) {
                                    console.log(`[AnimeUnity] Simplified subtitle search: ${simpleSubtitle}`);
                                    const simpleRes = await searchAnime(simpleSubtitle);
                                    if (simpleRes && simpleRes.length > 0) candidates = candidates.concat(simpleRes);
                                }
                            }
                        }

                        const mainTitle = parts[0].trim();
                        const movieQuery = `${mainTitle} Movie`;
                        console.log(`[AnimeUnity] Movie query search: ${movieQuery}`);
                        const movieRes = await searchAnime(movieQuery);
                        if (movieRes && movieRes.length > 0) candidates = candidates.concat(movieRes);
                    }
                } else {
                    // Try appending "Movie"
                    const movieQuery = `${title} Movie`;
                    console.log(`[AnimeUnity] Movie query search: ${movieQuery}`);
                    const movieRes = await searchAnime(movieQuery);
                    if (movieRes && movieRes.length > 0) candidates = candidates.concat(movieRes);

                    // Try simplified title (remove "Film", "-", "The Movie")
                    // e.g. "One Piece Film - Red" -> "One Piece Red"
                    const simpleTitle = title.replace(/\bfilm\b/gi, "").replace(/-/g, "").replace(/\s+/g, " ").trim();
                    if (simpleTitle !== title && simpleTitle.length > 3) {
                        console.log(`[AnimeUnity] Simplified title search: ${simpleTitle}`);
                        const simpleRes = await searchAnime(simpleTitle);
                        if (simpleRes && simpleRes.length > 0) candidates = candidates.concat(simpleRes);
                    }
                }

                // Remove localized movie words and punctuation to recover base searchable title
                // e.g. "Jujutsu kaisen 0 - Il film" -> "Jujutsu kaisen 0"
                const strippedMovieTitle = title
                    .replace(/\b(il|lo|la|the)\b/gi, " ")
                    .replace(/\b(movie|film)\b/gi, " ")
                    .replace(/[:\-]/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();
                if (strippedMovieTitle.length > 3 && strippedMovieTitle.toLowerCase() !== title.toLowerCase()) {
                    console.log(`[AnimeUnity] Stripped movie title search: ${strippedMovieTitle}`);
                    const strippedRes = await searchAnime(strippedMovieTitle);
                    if (strippedRes && strippedRes.length > 0) candidates = candidates.concat(strippedRes);
                }

                // Remove duplicates
                candidates = candidates.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
            }
        }

        // Strategy 3: Original title search
        if ((!candidates || candidates.length === 0) && originalTitle && originalTitle !== title) {
            console.log(`[AnimeUnity] No results for ${title}, trying ${originalTitle}`);
            candidates = await searchAnime(originalTitle);

            // Check relevance
            if (candidates.length > 0) {
                const valid = candidates.some(c => {
                    if ((checkSimilarity(c.title, title) || checkSimilarity(c.title_eng, title)) || (checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title_eng, originalTitle))) return true;
                    if (metadata.alternatives) {
                        return metadata.alternatives.some(alt => (checkSimilarity(c.title, alt.title) || checkSimilarity(c.title_eng, alt.title)));
                    }
                    return false;
                });

                if (!valid) {
                    console.log("[AnimeUnity] Original title search results seem irrelevant. Discarding.");
                    candidates = [];
                }
            }
        }

        // Strategy 4: Alternative Titles Search
        if ((!candidates || candidates.length === 0) && metadata.alternatives) {
            const altTitles = metadata.alternatives
                .map(t => t.title)
                .filter(t => /^[a-zA-Z0-9\s\-\.\:\(\)!'&]+$/.test(t)) // Only Latin-ish chars + common punctuation
                .filter(t => t !== title && t !== originalTitle);

            const uniqueAlts = [...new Set(altTitles)];

            for (const altTitle of uniqueAlts) {
                if (altTitle.length < 4) continue;

                console.log(`[AnimeUnity] Trying alternative title: ${altTitle}`);
                const res = await searchAnime(altTitle);

                if (res && res.length > 0) {
                    const valid = res.some(c => {
                        if ((checkSimilarity(c.title, title) || checkSimilarity(c.title_eng, title)) || (checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title_eng, originalTitle))) return true;
                        if (metadata.alternatives) {
                            return metadata.alternatives.some(alt => (checkSimilarity(c.title, alt.title) || checkSimilarity(c.title_eng, alt.title)));
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

        const subs = candidates.filter(c => !(c.title || "").includes("(ITA)") && !(c.title_eng || "").includes("(ITA)"));
        const dubs = candidates.filter(c => (c.title || "").includes("(ITA)") || (c.title_eng || "").includes("(ITA)"));

        // Helper to enrich top candidates with year if missing/Indeterminato
        const enrichTopCandidates = async (list) => {
            // Only process top 3 candidates to avoid too many requests
            const top = list.slice(0, 3);
            await Promise.all(top.map(async (c) => {
                // If date is missing, Indeterminato, or ?, try to fetch it
                if (!c.date || c.date === "Indeterminato" || c.date === "?") {
                    console.log(`[AnimeUnity] Fetching year for "${c.title}" (Date: ${c.date})`);
                    const year = await fetchAnimeYear(c.id, c.slug);
                    if (year) {
                        c.date = year;
                        console.log(`[AnimeUnity] Enriched "${c.title}" with year: ${year}`);
                    } else {
                        console.log(`[AnimeUnity] Failed to enrich "${c.title}" (no year found)`);
                    }
                }
            }));
            return top;
        };

        // Enrich candidates before finding best match
        if (subs.length > 0) await enrichTopCandidates(subs);
        if (dubs.length > 0) await enrichTopCandidates(dubs);

        const allowBypassSeasonCheck = seasonNameMatch && !seasonSearchEnabled;
        let bestSub = findBestMatch(subs, title, originalTitle, seasonForMatch, metadata, { bypassSeasonCheck: allowBypassSeasonCheck, seasonYear, seasonNames: seasonNameHints });
        let bestDub = findBestMatch(dubs, title, originalTitle, seasonForMatch, metadata, { bypassSeasonCheck: allowBypassSeasonCheck, seasonYear, seasonNames: seasonNameHints });

        // Secondary search for Dubs if not found or suspicious (e.g. One Piece (ITA), MHA Final Season)
        const isSuspicious = (c) => {
            if (!c) return true;
            if (season === 0) {
                // Check if title contains "Special" or "OAV"
                const t = (c.title || c.title_eng || "").toLowerCase();
                // If it has "Special", "OAV", "Movie" it is NOT suspicious
                if (t.includes("special") || t.includes("oav") || t.includes("movie")) return false;
                // Also check type
                if (['Special', 'OVA', 'Movie'].includes(c.type)) return false;
                // Otherwise it is suspicious (likely a main series)
                return true;
            }

            if (season === 1) {
                const t = (c.title || c.title_eng || "").toLowerCase();
                // Contains "Final Season" or ends with number (likely sequel)
                if (/final\s*season/i.test(t) || /(\s|^)\d+(\s*\(ITA\))?$/i.test(t)) return true;

                // Compare with Sub if available
                if (bestSub) {
                    const subT = (bestSub.title || bestSub.title_eng || "").toLowerCase().trim();
                    const dubT = t.replace(/\s*\(ita\)/i, "").trim(); // remove (ita)

                    // If Dub title is significantly longer than Sub title (likely spinoff/movie with subtitle)
                    // Allow small difference (e.g. spaces/punctuation)
                    if (dubT.length > subT.length + 8) return true;

                    // If Dub doesn't contain Sub title (very different)
                    if (!dubT.includes(subT)) return true;
                }
            }
            return false;
        };

        if (!bestDub || isSuspicious(bestDub)) {
            console.log(`[AnimeUnity] Dub not found or suspicious, trying specific dub search: ${title} (ITA)`);
            const dubQuery = `${title} (ITA)`;
            const dubRes = await searchAnime(dubQuery);
            if (dubRes && dubRes.length > 0) {
                const newDubs = dubRes.filter(c => (c.title || "").includes("(ITA)") || (c.title_eng || "").includes("(ITA)"));
                const betterDub = findBestMatch(newDubs, title, originalTitle, seasonForMatch, metadata, { seasonYear, seasonNames: seasonNameHints });
                if (betterDub) bestDub = betterDub;
            }
        }

        if (seasonSearchEnabled) {
            const normalizeCandidateTitle = (candidate) => String(candidate.title || candidate.title_eng || "")
                .toLowerCase()
                .replace(/\s*\(ita\)\s*$/i, "")
                .replace(/&#x27;|&#039;/g, "'")
                .replace(/[^a-z0-9\s]/g, " ")
                .replace(/\s+/g, " ")
                .trim();
            const baseTitleNorm = String(title || "")
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, " ")
                .replace(/\s+/g, " ")
                .trim();
            const baseOriginalNorm = String(originalTitle || "")
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, " ")
                .replace(/\s+/g, " ")
                .trim();
            const isBaseEntry = (candidate) => {
                const cNorm = normalizeCandidateTitle(candidate);
                return cNorm === baseTitleNorm || (baseOriginalNorm && cNorm === baseOriginalNorm);
            };
            const hasSeasonMarkers = (candidate) => {
                const raw = `${candidate.title || ""} ${candidate.title_eng || ""}`.toLowerCase();
                if (/season|stagione|part|parte|\b\d+\b/.test(raw)) return true;
                if (/\b(arc|saga|chapter|cour)\b|\b\w+(?:-|\s)?hen\b/.test(raw)) return true;
                if (/final\s*season/i.test(raw)) return true;
                return false;
            };
            const isRelevantCandidate = (candidate) => {
                if ((checkSimilarity(candidate.title, title) || checkSimilarity(candidate.title_eng, title)) ||
                    (checkSimilarity(candidate.title, originalTitle) || checkSimilarity(candidate.title_eng, originalTitle))) return true;
                if (metadata.alternatives) {
                    const altSimilarity = metadata.alternatives.some(alt =>
                        checkSimilarity(candidate.title, alt.title) || checkSimilarity(candidate.title_eng, alt.title)
                    );
                    if (altSimilarity) return true;
                }

                const baseTokens = new Set([
                    ...tokenizeForPairing(title || ""),
                    ...tokenizeForPairing(originalTitle || ""),
                    ...(metadata.alternatives || []).slice(0, 30).flatMap(alt => tokenizeForPairing(alt.title || ""))
                ]);
                const candidateTokens = [
                    ...tokenizeForPairing(candidate.title || ""),
                    ...tokenizeForPairing(candidate.title_eng || "")
                ];
                if (candidateTokens.some(t => baseTokens.has(t))) return true;

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
                const specificPool = list.filter(c => {
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
            const compatibleDubs = dubs.filter(c => areCoherentCandidates(bestSub, c, title, originalTitle));
            if (compatibleDubs.length > 0) {
                const alignedDub = findBestMatch(compatibleDubs, title, originalTitle, seasonForMatch, metadata, { seasonYear, seasonNames: seasonNameHints });
                bestDub = alignedDub || compatibleDubs[0];
            } else {
                console.log("[AnimeUnity] Discarding dub candidate due to arc/season mismatch with selected sub.");
                bestDub = null;
            }
        }

        if (seasonSearchEnabled && Array.isArray(seasonNameHints) && seasonNameHints.length > 0) {
            const normalize = (s) => String(s || "")
                .toLowerCase()
                .replace(/&#x27;|&#039;/g, "'")
                .replace(/[^a-z0-9\s]/g, " ")
                .replace(/\s+/g, " ")
                .trim();
            const tokenize = (s) => normalize(s).split(/\s+/).filter(Boolean);
            const baseTokenSet = new Set([
                ...tokenize(title),
                ...tokenize(originalTitle)
            ]);
            const genericTokens = new Set(["season", "stagione", "part", "parte", "the", "and", "dei", "degli", "della"]);
            const getDistinctiveHintTokens = (hintValue) => tokenize(hintValue).filter(t =>
                t.length >= 4 &&
                !baseTokenSet.has(t) &&
                !genericTokens.has(t)
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

                    // Match only on distinctive season tokens (e.g. "diamond", "unbreakable")
                    // and not on generic/base-series tokens (e.g. "jojo", "part").
                    const distinctive = getDistinctiveHintTokens(hNorm);
                    if (distinctive.length === 0) return false;
                    const matchedDistinctive = distinctive.filter(t => cNorm.includes(t)).length;
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
                const hasSpecialMarker =
                    cType === "special" ||
                    cType === "ova" ||
                    cType === "movie" ||
                    /\b(special|speciale|ova|oav|movie|film|recap|extra|zero|episodio\s*0|ep\s*0)\b/i.test(lower);
                if (!hasSpecialMarker) return false;

                const candidateTokens = tokenizeLooseText(raw);
                const targetPool = [
                    title,
                    originalTitle,
                    ...((metadata.mappedTitleHints || []).slice(0, 10))
                ].filter(Boolean);

                return targetPool.some((target) => {
                    const targetTokens = tokenizeLooseText(target);
                    if (targetTokens.length > 0 && candidateTokens.length > 0) {
                        const matched = targetTokens.filter(t => candidateTokens.includes(t)).length;
                        const minNeeded = Math.max(1, Math.ceil(targetTokens.length * 0.6));
                        if (matched >= minNeeded) return true;
                    }

                    const cNorm = normalizeLooseText(raw);
                    const tNorm = normalizeLooseText(target);
                    if (!tNorm) return false;
                    return (
                        cNorm === tNorm ||
                        cNorm.startsWith(`${tNorm} `) ||
                        cNorm.includes(` ${tNorm} `) ||
                        cNorm.endsWith(` ${tNorm}`)
                    );
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
            // Strategy: If title contains hyphens, retry entire search with dehyphenated title
            // e.g. "One-Punch Man" → "One Punch Man" (finds S1 instead of only S3)
            if (title.includes('-')) {
                const dehyphenated = title.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
                if (dehyphenated !== title) {
                    console.log(`[AnimeUnity] No match found. Retrying with dehyphenated title: ${dehyphenated}`);
                    const dehyphenRes = await searchAnime(dehyphenated);
                    if (dehyphenRes && dehyphenRes.length > 0) {
                        const dhSubs = dehyphenRes.filter(c => !(c.title || "").includes("(ITA)") && !(c.title_eng || "").includes("(ITA)"));
                        const dhDubs = dehyphenRes.filter(c => (c.title || "").includes("(ITA)") || (c.title_eng || "").includes("(ITA)"));

                        if (dhSubs.length > 0) await enrichTopCandidates(dhSubs);
                        if (dhDubs.length > 0) await enrichTopCandidates(dhDubs);

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
            const rawTitle = (candidate.title || candidate.title_eng || "");
            const normalizedCandidate = rawTitle.toLowerCase().replace(/\s*\(ita\)\s*$/i, "").trim();
            const normalizedTitle = (title || "").toLowerCase().trim();
            const normalizedOriginal = (originalTitle || "").toLowerCase().trim();
            const hasExplicitSeasonMarkers =
                /season|stagione|part|parte|\b\d+\b/i.test(candidate.title || "") ||
                /season|stagione|part|parte|\b\d+\b/i.test(candidate.title_eng || "");
            const isBaseEntry = normalizedCandidate === normalizedTitle || (normalizedOriginal && normalizedCandidate === normalizedOriginal);

            return season === 1 || seasonNameMatch || hasExplicitSeasonMarkers || (season > 1 && !isBaseEntry);
        };

        const getCandidateEpisodeCount = (candidate) => {
            if (!candidate) return null;
            const raw = candidate.real_episodes_count ?? candidate.episodes_count;
            const n = parseInt(raw, 10);
            return Number.isInteger(n) && n > 0 ? n : null;
        };

        const getPartIndexFromCandidate = (candidate) => {
            const raw = `${candidate?.title || ""} ${candidate?.title_eng || ""}`.toLowerCase();
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
            // If requested episode already fits in the selected season entry,
            // avoid cross-switching to unrelated franchise parts/cours.
            if (currentCount && reqEp <= currentCount) {
                return { candidate: current, mappedEpisode: requestedEpisode };
            }

            const seasonTokenRegex = new RegExp(`\\b${season}\\b|season\\s*${season}|stagione\\s*${season}|part\\s*${season}|parte\\s*${season}`, "i");
            const splitTokenRegex = /\b(part|parte|cour|arc|saga|chapter)\b|\b\w+(?:-|\s)?hen\b/i;
            const extractYear = (candidate) => {
                const yearMatch = String(candidate?.date || "").match(/(\d{4})/);
                if (!yearMatch) return null;
                const y = parseInt(yearMatch[1], 10);
                return Number.isInteger(y) ? y : null;
            };
            const partMap = new Map();

            for (const c of pool) {
                if (!c) continue;
                const combined = `${c.title || ""} ${c.title_eng || ""}`;
                const hasSeasonToken = seasonTokenRegex.test(combined);
                const isRelevantSeries =
                    checkSimilarity(c.title, title) ||
                    checkSimilarity(c.title_eng, title) ||
                    checkSimilarity(c.title, originalTitle) ||
                    checkSimilarity(c.title_eng, originalTitle) ||
                    isRelevantByLooseMatch(combined);
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
                const usedIds = new Set([startCandidate.id]);

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
                        const isRelevantSeries =
                            checkSimilarity(c.title, title) ||
                            checkSimilarity(c.title_eng, title) ||
                            checkSimilarity(c.title, originalTitle) ||
                            checkSimilarity(c.title_eng, originalTitle) ||
                            isRelevantByLooseMatch(combined);
                        if (!isRelevantSeries) continue;
                        if (!hasSeasonToken && !hasSplitToken && !hasPartToken) continue;

                        const cYear = extractYear(c);
                        const seasonDiff = (Number.isInteger(cYear) && Number.isInteger(seasonYear))
                            ? Math.abs(cYear - seasonYear)
                            : Number.MAX_SAFE_INTEGER;
                        const fromDiff = (Number.isInteger(cYear) && Number.isInteger(fromYear))
                            ? Math.abs(cYear - fromYear)
                            : Number.MAX_SAFE_INTEGER;

                        let score = 0;
                        if (hasSeasonToken) score += 4;
                        if (hasPartToken) score += 3;
                        if (hasSplitToken) score += 2;
                        if (checkSimilarity(c.title, title) || checkSimilarity(c.title_eng, title)) score += 2;
                        if (checkSimilarity(c.title, originalTitle) || checkSimilarity(c.title_eng, originalTitle)) score += 2;
                        if (Array.isArray(seasonNameHints) && seasonNameHints.some(h => checkSimilarity(c.title, h) || checkSimilarity(c.title_eng, h))) score += 1;
                        if (fromDiff === 0) score += 2;
                        else if (fromDiff === 1) score += 1;

                        if (!best ||
                            score > best.score ||
                            (score === best.score && fromDiff < best.fromDiff) ||
                            (score === best.score && fromDiff === best.fromDiff && seasonDiff < best.seasonDiff) ||
                            (score === best.score && fromDiff === best.fromDiff && seasonDiff === best.seasonDiff && combined.length < best.length)) {
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
            // Check if it's likely a specific season/arc entry or the main series
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

        const results = await Promise.all(tasks);
        return results.flat();

    } catch (e) {
        console.error("[AnimeUnity] Error:", e);
        return [];
    }
}

async function getEpisodeStreams(anime, episodeNumber, langTag = "", isMovie = false) {
    try {
        const animeUrl = `${BASE_URL}/anime/${anime.id}-${anime.slug}`;

        const animeResponse = await fetch(animeUrl, {
            headers: {
                "User-Agent": USER_AGENT,
                "Referer": BASE_URL
            }
        });

        if (!animeResponse.ok) {
            console.error(`[AnimeUnity] Failed to fetch anime page for ${anime.title}`);
            return [];
        }

        const animeHtml = await animeResponse.text();

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

        // Check for pagination/missing episodes
        const episodesCountRegex = /episodes_count="(\d+)"/i;
        const countMatch = episodesCountRegex.exec(animeHtml);
        const totalEpisodes = countMatch ? parseInt(countMatch[1]) : episodes.length;

        let targetEpisode;

        if (isMovie && episodes.length > 0) {
            // For movies, just take the first available episode/stream
            targetEpisode = episodes[0];
        } else {
            targetEpisode = episodes.find(ep => ep.number == episodeNumber);
        }

        if (!targetEpisode && !isMovie && totalEpisodes > episodes.length) {
            console.log(`[AnimeUnity] Episode ${episodeNumber} not found in initial list. Checking API...`);

            // Calculate range
            const startRange = Math.floor((episodeNumber - 1) / 120) * 120 + 1;
            const endRange = startRange + 119;

            if (startRange > episodes.length || (startRange <= episodes.length && episodeNumber > episodes[episodes.length - 1].number)) {
                try {
                    const apiUrl = `${BASE_URL}/info_api/${anime.id}/1?start_range=${startRange}&end_range=${endRange}`;
                    console.log(`[AnimeUnity] Fetching episodes range: ${startRange}-${endRange}`);

                    const apiResponse = await fetch(apiUrl, {
                        headers: {
                            "User-Agent": USER_AGENT,
                            "X-Requested-With": "XMLHttpRequest",
                            "Referer": animeUrl
                        }
                    });

                    if (apiResponse.ok) {
                        const json = await apiResponse.json();
                        if (json.episodes && Array.isArray(json.episodes)) {
                            // Merge episodes
                            episodes = episodes.concat(json.episodes);
                            targetEpisode = episodes.find(ep => ep.number == episodeNumber);
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

        // Helper to extract quality
        const extractQuality = (str) => {
            if (!str) return "Unknown";
            const match = str.match(/(\d{3,4}p)/i);
            return match ? match[1] : "Unknown";
        };

        // 1. Direct Link
        if (targetEpisode.link && targetEpisode.link.startsWith("http")) {
            // Filter out unwanted mp4 links (e.g. .mkv.mp4 or known problematic/scam domains)
            const blockedDomains = ['jujutsukaisenanime.com', 'onepunchman.it', 'dragonballhd.it', 'narutolegend.it'];
            const lowerLink = targetEpisode.link.toLowerCase();
            if (lowerLink.endsWith('.mkv.mp4') || blockedDomains.some(d => lowerLink.includes(d))) {
                console.log(`[AnimeUnity] Skipping unwanted link: ${targetEpisode.link}`);
            } else {
                let quality = extractQuality(targetEpisode.link);
                if (quality === "Unknown") quality = extractQuality(targetEpisode.file_name);

                if (targetEpisode.link.includes('.m3u8')) {
                    const detected = await checkQualityFromPlaylist(targetEpisode.link, {
                        "User-Agent": USER_AGENT,
                        "Referer": BASE_URL
                    });
                    if (detected) quality = detected;
                }

                // Ensure anime.title is not null/undefined
                const displayTitle = (anime.title || anime.title_eng || "Unknown Title") + ` - Ep ${resolvedEpisodeNumber}${labelSuffix}`;

                streams.push({
                    name: "AnimeUnity" + labelSuffix,
                    title: displayTitle,
                    url: targetEpisode.link,
                    quality: quality,
                    type: "direct",
                    headers: {
                        "User-Agent": USER_AGENT,
                        "Referer": BASE_URL
                    }
                });
            }
        }

        // 2. VixCloud Embed (scws_id)
        if (targetEpisode.scws_id) {
            try {
                const embedApiUrl = `${BASE_URL}/embed-url/${targetEpisode.id}`;
                const embedResponse = await fetch(embedApiUrl, {
                    headers: {
                        "User-Agent": USER_AGENT,
                        "Referer": animeUrl,
                        "X-Requested-With": "XMLHttpRequest"
                    }
                });

                if (embedResponse.ok) {
                    const embedUrl = await embedResponse.text();
                    if (embedUrl && embedUrl.startsWith("http")) {
                        const vixStreams = await extractVixCloud(embedUrl);
                        if (vixStreams && vixStreams.length > 0) {
                            // Ensure anime.title is not null/undefined
                            const displayTitle = (anime.title || anime.title_eng || "Unknown Title") + ` - Ep ${resolvedEpisodeNumber}${labelSuffix}`;

                            streams.push(...vixStreams.map(s => ({
                                ...s,
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

        return streams.map(s => formatStream(s, "AnimeUnity")).filter(s => s !== null);
    } catch (e) {
        console.error(`[AnimeUnity] Error extracting streams for ${anime.title}:`, e);
        return [];
    }
}

module.exports = { getStreams, getMetadata, searchAnime };
