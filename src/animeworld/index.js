const { getTmdbFromKitsu, isAnime } = require('../tmdb_helper.js');
require('../fetch_helper.js');
const { formatStream } = require('../formatter.js');
const { checkQualityFromPlaylist } = require('../quality_helper.js');

const BASE_URL = "https://www.animeworld.ac";
const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function getMetadata(id, type) {
    try {
        const normalizedType = String(type).toLowerCase();
        let tmdbId = id;
        let mappedSeason = null;

        // Handle Kitsu ID
        if (String(id).startsWith("kitsu:")) {
            const resolved = await getTmdbFromKitsu(id);
            if (resolved && resolved.tmdbId) {
                tmdbId = resolved.tmdbId;
                mappedSeason = resolved.season;
                console.log(`[AnimeWorld] Resolved Kitsu ID ${id} to TMDB ID ${tmdbId} (Mapped Season: ${mappedSeason})`);
            } else {
                console.error(`[AnimeWorld] Failed to resolve Kitsu ID ${id}`);
                return null;
            }
        }

        // Strip tmdb: prefix
        if (String(id).startsWith("tmdb:")) {
            tmdbId = String(id).replace("tmdb:", "");
        }

        // If it's an IMDb ID, find the TMDB ID first
        if (String(tmdbId).startsWith("tt")) {
            const findUrl = `https://api.themoviedb.org/3/find/${tmdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id&language=it-IT`;
            const findResponse = await fetch(findUrl);
            if (!findResponse.ok) return null;
            const findData = await findResponse.json();
            const results = normalizedType === "movie" ? findData.movie_results : findData.tv_results;
            if (!results || results.length === 0) return null;
            tmdbId = results[0].id;
        }

        // Get Details
        const detailsUrl = `https://api.themoviedb.org/3/${normalizedType === "movie" ? "movie" : "tv"}/${tmdbId}?api_key=${TMDB_API_KEY}&language=it-IT`;
        const detailsResponse = await fetch(detailsUrl);
        if (!detailsResponse.ok) return null;
        const details = await detailsResponse.json();

        // Get External IDs (IMDb) if needed
        let imdb_id = details.imdb_id;
        if (!imdb_id && normalizedType === "tv") {
            const externalUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
            const extResponse = await fetch(externalUrl);
            if (extResponse.ok) {
                const extData = await extResponse.json();
                imdb_id = extData.imdb_id;
            }
        }

        // Get Alternative Titles
        let alternatives = [];
        try {
            const altUrl = `https://api.themoviedb.org/3/${normalizedType === "movie" ? "movie" : "tv"}/${tmdbId}/alternative_titles?api_key=${TMDB_API_KEY}`;
            const altResponse = await fetch(altUrl);
            if (altResponse.ok) {
                const altData = await altResponse.json();
                alternatives = altData.titles || altData.results || [];
            }
        } catch (e) {
            console.error("[AnimeWorld] Alt titles fetch error:", e);
        }

        // Extract specific season name if mappedSeason is present
        let seasonName = null;
        if (mappedSeason && details.seasons) {
            const targetSeason = details.seasons.find(s => s.season_number === mappedSeason);
            if (targetSeason && targetSeason.name && !targetSeason.name.includes("Stagione") && !targetSeason.name.includes("Season")) {
                seasonName = targetSeason.name;
            }
        }

        return {
            ...details,
            imdb_id,
            tmdb_id: tmdbId,
            alternatives,
            mappedSeason,
            seasonName
        };
    } catch (e) {
        console.error("[AnimeWorld] Metadata error:", e);
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
const getSimilarityScore = (candTitle, targetTitle) => {
    if (!targetTitle) return 0;
    const normalize = s => String(s).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const t1 = normalize(candTitle);
    const t2 = normalize(targetTitle);

    if (t1.length < 2 || t2.length < 2) return 0;

    // Number check: if both titles contain numbers, they must share at least one number
    const extractNumbers = (str) => {
        const matches = str.match(/\d+/g);
        return matches ? matches.map(Number) : [];
    };
    const nums1 = extractNumbers(t1);
    const nums2 = extractNumbers(t2);

    if (nums1.length > 0 && nums2.length > 0) {
        const hasOverlap = nums1.some(n => nums2.includes(n));
        if (!hasOverlap) return 0;
    } else if (nums2.length === 0 && nums1.length > 0) {
        // If target has NO numbers, but candidate has numbers, checks if they are sequel numbers
        // We allow '1' (implicit) and years (likely release year)
        // We penalize '2' up to '1900' (sequel numbers)
        const invalidExtra = nums1.some(n => n > 1 && n < 1900);
        if (invalidExtra) return 0;
    }

    // Word overlap
    const stopWords = new Set([
        // English
        "the", "a", "an", "and", "or", "of", "to", "in", "on", "at", "by", "for", "with", "is", "are", "was", "were", "be", "been",
        // Italian
        "il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "e", "o", "di", "a", "da", "in", "con", "su", "per", "tra", "fra", "che", "no",
        // Common Metadata
        "movie", "film", "ita", "sub", "dub", "serie", "tv"
    ]);

    const numberWords = {
        'one': 1, 'first': 1, 'i': 1,
        'two': 2, 'second': 2, 'ii': 2,
        'three': 3, 'third': 3, 'iii': 3,
        'four': 4, 'fourth': 4, 'iv': 4,
        'five': 5, 'fifth': 5, 'v': 5,
        'six': 6, 'sixth': 6, 'vi': 6,
        'seven': 7, 'seventh': 7, 'vii': 7,
        'eight': 8, 'eighth': 8, 'viii': 8,
        'nine': 9, 'ninth': 9, 'ix': 9,
        'ten': 10, 'tenth': 10, 'x': 10
    };

    const tokenize = x => x.split(/\s+/).filter(w => {
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

    // Calculate intersection and remove from unique lists
    for (let i = unique1.length - 1; i >= 0; i--) {
        const token = unique1[i];
        const idx = unique2.indexOf(token);
        if (idx !== -1) {
            matches++;
            if (!/^\d+$/.test(token)) textMatches++;

            // Remove from unique lists (consume match)
            unique1.splice(i, 1);
            unique2.splice(idx, 1);
        }
    }

    // Strict Number Check on Remaining Tokens
    const extractNums = (tokens) => {
        const nums = new Set();
        tokens.forEach(t => {
            if (/^\d+$/.test(t)) nums.add(parseInt(t));
            else if (numberWords[t]) nums.add(numberWords[t]);
        });
        return nums;
    };

    const n1 = extractNums(unique1);
    const n2 = extractNums(unique2);

    if (n1.size > 0 && n2.size > 0) {
        // If both have remaining numbers, they must overlap (which is impossible because we removed intersection)
        // Wait, if they have DIFFERENT numbers remaining, it's a mismatch.
        // Example: "Movie 1" vs "Movie 2". "Movie" removed. "1" vs "2". Mismatch.
        // Example: "Movie 1" vs "Movie 1". "Movie", "1" removed. Empty. No mismatch.
        return 0;
    }

    // If target has text words, but we only matched numbers, it's weak.
    const hasText = w2.some(w => !/^\d+$/.test(w));
    if (hasText && textMatches === 0) return 0;

    // Use Dice coefficient (F1 Score) for better discrimination of partial matches
    // This penalizes candidates that are significantly longer than the target (e.g. "Title Subtitle" vs "Title")
    const score = (2 * matches) / (w1.length + w2.length);
    // console.log(`[AnimeWorld] Similarity: "${t1}" vs "${t2}" -> score ${score} (matches: ${matches}/${w2.length})`);

    return score;
};

const checkSimilarity = (candTitle, targetTitle) => {
    return getSimilarityScore(candTitle, targetTitle) >= 0.6;
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

    const aTitle = String(a.title || "").trim();
    const bTitle = String(b.title || "").trim();
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

    let isTv = !!metadata.name;
    let appliedSeasonYearFilter = false;
    // Better detection for Movie vs TV
    if (metadata.type === 'movie' || (metadata.genres && metadata.genres.some(g => (g.name || "").toLowerCase() === 'movie'))) {
        isTv = false;
    } else if (metadata.title && !metadata.name) {
        isTv = false;
    }

    // Normalize titles
    const normTitle = title.toLowerCase().trim();
    const normOriginal = originalTitle ? originalTitle.toLowerCase().trim() : "";

    // Filter by Year if available (only for Season 1 or Movies)
    // Note: c.date is populated only for top candidates via enrichTopCandidates
    const metaYear = metadata.first_air_date ? parseInt(metadata.first_air_date.substring(0, 4)) :
        (metadata.release_date ? parseInt(metadata.release_date.substring(0, 4)) : null);

    // Check for exact matches BEFORE year filtering
    const preYearExactMatches = candidates.filter(c => {
        const t = (c.title || "").toLowerCase().trim();
        const tClean = t.replace(/\s*\(ita\)$/i, "").trim();
        return t === normTitle || tClean === normTitle || (normOriginal && (t === normOriginal || tClean === normOriginal));
    });

    if (metaYear && (season === 1 || !isTv)) {
        const yearFiltered = candidates.filter(c => {
            // Calculate similarity score for all candidates (needed for sorting)
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

            // Check against alternatives if score is low
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
                // If the title is a very strong match (via similarity check), we keep it even without a date
                // especially for movies where date scraping might fail or be limited
                if (!isTv) {
                    // Use a slightly looser check for movies without date to avoid discarding valid matches
                    // like "One Piece Movie 13: Gold" vs "One Piece Film: Gold"
                    const isSimilar = bestScore >= 0.6;

                    // console.log(`[AnimeWorld Debug] Sim check for "${c.title}" vs "${title}" -> Score: ${bestScore.toFixed(2)}`);

                    // Special case for movies with subtitles like ": Gold" or "Film: Gold"
                    // If the main title is present and the subtitle matches, keep it.
                    let isSpecialMatch = false;
                    const cTitleNorm = c.title.toLowerCase();
                    if (title.includes(':')) {
                        const parts = title.split(':');
                        const sub = parts[parts.length - 1].trim().toLowerCase();
                        if (sub.length > 2 && cTitleNorm.includes(sub)) {
                            // Check if at least some part of the main title is also present
                            const main = parts[0].trim().toLowerCase().replace('film', '').replace('movie', '').trim();
                            if (main.length > 3 && cTitleNorm.includes(main)) {
                                isSpecialMatch = true;
                            } else if (main.length <= 3) {
                                isSpecialMatch = true;
                            }
                        }
                    }

                    // Check if CANDIDATE has colon and input title matches the subtitle
                    // Handles "One Piece Movie 13: Gold" vs "One Piece Gold"
                    if (!isSpecialMatch && cTitleNorm.includes(':')) {
                        const parts = cTitleNorm.split(':');
                        const sub = parts[parts.length - 1].trim();
                        const tNorm = title.toLowerCase();
                        const oNorm = originalTitle ? originalTitle.toLowerCase() : "";

                        // Check if subtitle is present in input title
                        if (sub.length > 2 && (tNorm.includes(sub) || oNorm.includes(sub))) {
                            const main = parts[0].trim().replace(/movie/g, '').replace(/film/g, '').trim();
                            // Check similarity of main part against input title
                            const simMain = checkSimilarity(main, title) || checkSimilarity(main, originalTitle);

                            if (simMain) {
                                isSpecialMatch = true;
                            }
                        }
                    }

                    if (isSimilar || isSpecialMatch) {
                        // console.log(`[AnimeWorld] Keeping "${c.title}" despite missing date (Similarity/Special Match)`);
                        return true;
                    }
                }

                // Strict check: if we are filtering by year, we expect a date.
                // If enrichment failed, we discard to avoid false positives (e.g. One Piece 1999 vs 2023).
                // console.log(`[AnimeWorld] Filtered out "${c.title}" (no date)`);
                return false;
            }
            const cYear = parseInt(c.date);
            const diff = Math.abs(cYear - metaYear);
            const keep = diff <= 2;
            if (!keep) {
                // console.log(`[AnimeWorld] Filtered out "${c.title}" (${cYear}) vs Meta (${metaYear})`);
            }
            return keep;
        });

        // If we found strict matches (with date), use them.
        // BUT if we only have matches without date (kept by similarity), use those.
        // The problem is if we have BOTH, we might prefer the ones with date if they are good,
        // but if the similarity ones are BETTER, we should maybe keep them?
        // Current logic: yearFiltered contains both types.

        if (yearFiltered.length > 0) {
            candidates = yearFiltered;
        } else if (candidates.length > 0) {
            // If strictly filtered out, return null to avoid bad match
            return null;
        }
    }

    // For multi-season anime, prefer candidates close to the requested TMDB season year.
    // Apply only if we find viable matches to avoid breaking long-running single-entry shows.
    if (season > 1 && options.seasonYear) {
        const targetYear = parseInt(options.seasonYear, 10);
        if (!isNaN(targetYear)) {
            const seasonYearCandidates = candidates
                .map(c => {
                    if (!c.date) return null;
                    const match = String(c.date).match(/(\d{4})/);
                    if (!match) return null;
                    const cYear = parseInt(match[1], 10);
                    return { candidate: c, diff: Math.abs(cYear - targetYear) };
                })
                .filter(x => x && x.diff <= 2);

            if (seasonYearCandidates.length > 0) {
                const minDiff = Math.min(...seasonYearCandidates.map(x => x.diff));
                candidates = seasonYearCandidates
                    .filter(x => x.diff === minDiff)
                    .map(x => x.candidate);
                appliedSeasonYearFilter = true;
            }
        }
    }

    // Filter by Type (using enriched data)
    if (candidates && candidates.length > 0) {
        const typeFiltered = candidates.filter(c => {
            // Only apply if candidate was enriched (checked for type)
            if (c.enriched) {
                if (!isTv) {
                    // Looking for Movie/OVA/Special
                    // If enriched and has NO type (no badge), it's likely TV -> Discard
                    if (!c.type) {
                        // console.log(`[AnimeWorld] Filtered out "${c.title}" (No Type Badge, likely TV)`);
                        return false;
                    }
                    // If has type 'tv' -> Discard
                    if (c.type === 'tv') return false;
                } else {
                    // Looking for TV Series
                    // If has type 'movie' -> Discard
                    if (c.type === 'movie') {
                        // console.log(`[AnimeWorld] Filtered out "${c.title}" (Type: Movie)`);
                        return false;
                    }
                    // Keep 'tv' (null/undefined) or 'ova'/'special'
                }
            }
            return true;
        });

        if (typeFiltered.length > 0) {
            candidates = typeFiltered;
        } else {
            // console.log("[AnimeWorld] All candidates filtered out by Enriched Type check");
            return null;
        }
    }

    // Filter out Movies/Specials if looking for a TV Series (Season 1)
    if (isTv && season === 1) {
        candidates = candidates.filter(c => {
            const t = (c.title || "").toLowerCase();

            // If the searched title implies a movie/special, don't filter
            if (normTitle.includes("movie") || normTitle.includes("film") || normTitle.includes("special") || normTitle.includes("oav") || normTitle.includes("ova")) return true;

            // If the candidate title implies a movie/special, discard it
            // Use regex to match whole words to avoid false positives (e.g. "Special" inside "Specialist")
            if (/\b(movie|film|special|oav|ova)\b/i.test(t)) {
                // console.log(`[AnimeWorld] Filtered out "${c.title}" (Movie/Special type mismatch)`);
                return false;
            }
            return true;
        });

        if (candidates.length === 0) {
            console.log("[AnimeWorld] All candidates filtered out by Type check (Movie/Special)");
            return null;
        }
    }

    // Check if we lost all exact matches due to year filtering.
    // For season > 1 this is too strict because exact base-title matches often represent Season 1.
    if (preYearExactMatches.length > 0 && (season === 1 || !isTv)) {
        const anyExactMatchSurvived = candidates.some(c =>
            preYearExactMatches.some(pym => pym.href === c.href) // Use href as ID
        );
        if (!anyExactMatchSurvived) {
            // console.log("[AnimeWorld] All exact matches rejected by year filter.");

            // If we are looking for a TV series, losing the exact match is usually fatal 
            // (implies we found the wrong show or wrong year).
            // But if we are looking for a Movie, the exact match might have been the TV series (filtered by type),
            // so we should proceed to check other candidates (like "Title Movie").
            if (isTv) {
                return null;
            }
        }
    }

    // If options.bypassSeasonCheck is true, return the best match based on title similarity only
    if (options.bypassSeasonCheck) {
        return candidates[0];
    }

    // If season === 0, prioritize Special/OVA/Movie
    if (season === 0) {
        // console.log(`[AnimeWorld] Checking season 0 match for ${title}`);
        const specialTypes = ['special', 'ova', 'movie'];

        // Sort candidates by similarity score first
        candidates.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));

        // Try to find one with "Special" in title if multiple
        const specialTitleMatch = candidates.find(c => (c.title || "").toLowerCase().includes("special"));
        if (specialTitleMatch) {
            // console.log(`[AnimeWorld] Found special match candidate: ${specialTitleMatch.title}`);
            if (checkSimilarity(specialTitleMatch.title, title) || checkSimilarity(specialTitleMatch.title, originalTitle)) {
                return specialTitleMatch;
            }
        }

        // Otherwise return the first candidate IF it passes similarity check OR contains the title
        const first = candidates[0];
        if (first) {
            const sim1 = checkSimilarity(first.title, title);
            const sim2 = checkSimilarity(first.title, originalTitle);

            if (sim1 || sim2) {
                return first;
            }

            // Relaxed check for Movies: if the title is contained in the candidate title
            // and we have already filtered by Year/Type, we can trust it.
            const t = first.title.toLowerCase();
            if (t.includes(normTitle) || (normOriginal && t.includes(normOriginal))) {
                // console.log(`[AnimeWorld] Accepting "${first.title}" based on containment check`);
                return first;
            }
        }

        // If first candidate failed, try finding ANY candidate that passes similarity
        const anyMatch = candidates.find(c => checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle));
        if (anyMatch) {
            // console.log(`[AnimeWorld] Found fallback match: ${anyMatch.title}`);
            return anyMatch;
        }

        console.log("[AnimeWorld] No season 0 match found passing similarity check");
        return null;
    }

    // Check for exact matches
    const exactMatch = candidates.find(c => {
        const t = (c.title || "").toLowerCase().trim();
        return t === normTitle || (normOriginal && t === normOriginal);
    });

    if (exactMatch && season === 1) return exactMatch;

    // Special logic for Movies (if not exact match)
    if (!isTv && season === 1) {
        // If searching for a movie with a subtitle (e.g. "Title: Subtitle")
        if (normTitle.includes(':')) {
            const parts = normTitle.split(':');
            const subtitle = parts[parts.length - 1].trim();
            if (subtitle.length > 2) { // Relaxed from 3 to 2 for "Z"
                // Try finding the full subtitle
                let subMatch = candidates.find(c => {
                    const t = (c.title || "").toLowerCase();
                    // Exact match for short subtitles to avoid false positives
                    if (subtitle.length <= 3) {
                        return t.endsWith(` ${subtitle}`) || t.includes(`: ${subtitle}`) || t.includes(` ${subtitle} `);
                    }
                    return t.includes(subtitle);
                });

                // If not found and subtitle has "Part X", try matching without it
                if (!subMatch && /part\s*\d+/i.test(subtitle)) {
                    const simpleSubtitle = subtitle.replace(/part\s*\d+/i, "").trim();
                    if (simpleSubtitle.length > 3) {
                        subMatch = candidates.find(c => {
                            const t = (c.title || "").toLowerCase();
                            return t.includes(simpleSubtitle);
                        });
                    }
                }

                if (subMatch) {
                    // Verify with similarity check to be safe
                    if (checkSimilarity(subMatch.title, title) || checkSimilarity(subMatch.title, originalTitle)) {
                        return subMatch;
                    }
                }
            }
        }

        // Fuzzy Match for Movies
        // Use the pre-calculated similarity score to pick the best candidate
        // This is more robust than simple word matching because it considers
        // original titles, alternatives, and advanced matching logic.

        candidates.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));

        const best = candidates[0];
        if (best && (best.similarityScore || 0) >= 0.6) {
            console.log(`[AnimeWorld] Selected best movie match: "${best.title}" (Score: ${(best.similarityScore || 0).toFixed(2)})`);
            return best;
        }
    }

    // Special check: If we have metaYear, prefer titles containing that year
    // This handles cases like "Hunter x Hunter (2011)" when searching for "Hunter x Hunter"
    if (metaYear) {
        const yearInTitleMatch = candidates.find(c => {
            const t = (c.title || "").toLowerCase();
            // Check if title contains the year AND the searched title
            return t.includes(metaYear.toString()) && (t.includes(normTitle) || (normOriginal && t.includes(normOriginal)));
        });
        if (yearInTitleMatch) {
            return yearInTitleMatch;
        }
    }

    // If season > 1, try to find "Title Season X" or "Title X"
    if (season > 1) {
        const seasonStr = String(season);
        const normalizeCandidateTitle = (candidate) => String(candidate.title || "")
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
        const seasonSpecificCandidates = candidates.filter(c => !isBaseEntry(c) && hasSpecificSeasonMarkers(c));

        // Check for numeric suffix or "Season X"
        const numberMatch = candidates.find(c => {
            const t = (c.title || "").toLowerCase();
            const regex = new RegExp(`\\b${seasonStr}$|\\b${seasonStr}\\b|season ${seasonStr}|stagione ${seasonStr}`, 'i');
            if (regex.test(t)) {
                // Additional check: Make sure the base title matches too!
                // e.g. "One Piece 2" should match "One Piece" but not "Two Piece 2"
                return checkSimilarity(c.title, title) ||
                    checkSimilarity(c.title, originalTitle) ||
                    checkSimilarity(c.title, `${title} ${season}`) ||
                    checkSimilarity(c.title, `${originalTitle} ${season}`);
            }
            return false;
        });
        if (numberMatch) return numberMatch;

        // Check for Roman numerals
        const roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
        if (season < roman.length) {
            const romanStr = roman[season];
            const romanMatch = candidates.find(c => {
                const t = (c.title || "").toLowerCase();
                const regex = new RegExp(`\\b${romanStr}$|\\b${romanStr}\\b`, 'i');
                if (regex.test(t)) {
                    // Additional check: Make sure the base title matches too!
                    return checkSimilarity(c.title, title) ||
                        checkSimilarity(c.title, originalTitle) ||
                        checkSimilarity(c.title, `${title} ${season}`) ||
                        checkSimilarity(c.title, `${originalTitle} ${season}`);
                }
                return false;
            });
            if (romanMatch) return romanMatch;
        }

        if (appliedSeasonYearFilter && candidates.length > 0) {
            const seasonPool = seasonSpecificCandidates.length > 0
                ? sortSeasonSpecific(seasonSpecificCandidates)
                : candidates;
            const seasonYearMatch = seasonPool.find(c => {
                if (checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle)) return true;
                if (metadata.alternatives) {
                    return metadata.alternatives.some(alt => checkSimilarity(c.title, alt.title));
                }
                return false;
            });
            if (seasonYearMatch) return seasonYearMatch;
            return seasonPool[0];
        }

        if (seasonSpecificCandidates.length > 0) {
            const sortedSpecific = sortSeasonSpecific(seasonSpecificCandidates);
            const specificMatch = sortedSpecific.find(c => {
                if (checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle)) return true;
                if (metadata.alternatives) {
                    return metadata.alternatives.some(alt => checkSimilarity(c.title, alt.title));
                }
                return false;
            });
            if (specificMatch) return specificMatch;
            return sortedSpecific[0];
        }
    } else {
        // Season 1: Prefer matches without numbers at end
        // Sort by length to prefer shorter titles
        const sorted = [...candidates].sort((a, b) => {
            if (!isTv) return (b.title || "").length - (a.title || "").length; // Movies: Longest first
            return (a.title || "").length - (b.title || "").length; // TV: Shortest first
        });

        const hasNumberSuffix = (str) => {
            if (!str) return false;
            if (/(\s|^)\d+(\s*\(ITA\))?$/i.test(str)) return true;
            if (/final\s*season/i.test(str)) return true;
            if (/(season|stagione)\s*\d+/i.test(str)) return true;
            return false;
        };

        // Only apply "no number suffix" logic for TV shows
        if (isTv) {
            const noNumberMatch = sorted.find(c => {
                const t = (c.title || "").trim();
                return !hasNumberSuffix(t);
            });

            if (noNumberMatch) {
                if (checkSimilarity(noNumberMatch.title, title) || checkSimilarity(noNumberMatch.title, originalTitle)) {
                    return noNumberMatch;
                }
            }
        }

        // Final fallback: use checkSimilarity to ensure the best match is actually relevant
        // Try finding ANY candidate that passes similarity
        const anyMatch = sorted.find(c => {
            if (checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle)) return true;
            if (metadata.alternatives) {
                return metadata.alternatives.some(alt => checkSimilarity(c.title, alt.title));
            }
            return false;
        });
        if (anyMatch) {
            return anyMatch;
        }

        return null; // No relevant match found
    }

    // Fallback for season > 1:
    // Prefer non-base entries before falling back to generic title entries.
    const normalizeTitle = (str) => String(str || "")
        .toLowerCase()
        .replace(/\s*\(ita\)\s*$/i, "")
        .replace(/&#x27;|&#039;/g, "'")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const baseTitleNorm = normalizeTitle(title);
    const baseOriginalNorm = normalizeTitle(originalTitle);
    const nonBaseFallback = candidates.find(c => {
        const cNorm = normalizeTitle(c.title);
        const isBase = cNorm === baseTitleNorm || (baseOriginalNorm && cNorm === baseOriginalNorm);
        if (isBase) return false;
        return checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle);
    });
    if (nonBaseFallback) return nonBaseFallback;

    const fallbackMatch = candidates.find(c => {
        return checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle);
    });

    if (fallbackMatch) {
        return fallbackMatch;
    }

    return null;
}

async function searchAnime(query) {
    try {
        const url = `${BASE_URL}/search?keyword=${encodeURIComponent(query)}`;
        const response = await fetch(url, {
            headers: {
                "User-Agent": USER_AGENT,
                "Referer": BASE_URL
            }
        });

        if (!response.ok) return [];

        const html = await response.text();

        // Check if there are results (look for film-list container)
        // If no film-list is found, it means no results (or a different page structure which we treat as no results)
        if (!html.includes('class="film-list"')) {
            console.log(`[AnimeWorld] No results container found for: ${query}`);
            return [];
        }

        if (html.includes("Nessun risultato") || html.includes("No result")) {
            console.log(`[AnimeWorld] "No results" message found for: ${query}`);
            return [];
        }

        const results = [];
        const seenHrefs = new Set();

        // Extract the content inside film-list to avoid matching sidebar items
        const filmListMatch = /<div class="film-list">([\s\S]*?)<div class="paging-wrapper"/i.exec(html);
        // Fallback: if paging-wrapper is not found (e.g. few results), try to find the closing of the main container or just use the whole html if risky.
        // Actually, just checking for film-list existence is good, but splitting by "item" might still pick up sidebar items if they are after the film-list?
        // Let's try to limit the scope if possible.
        // Usually film-list is the main content. Sidebar is separate.

        // Let's use the whole HTML but be aware of the "No results" case which we handled above.
        // But wait, "L'attacco dei giganti Special" returned "One Piece" which was likely in a "Recommended" section.
        // Does "Recommended" section use "item" class? Yes, probably.
        // So we MUST restrict parsing to "film-list".

        let searchContent = html;
        if (filmListMatch) {
            searchContent = filmListMatch[1];
        } else {
            // Try to match from film-list start to some end marker
            const startIdx = html.indexOf('class="film-list"');
            if (startIdx !== -1) {
                searchContent = html.substring(startIdx);
                // We can't easily find the closing div without a parser, but maybe we can cut off the footer or sidebar?
                // The sidebar usually comes AFTER or BEFORE?
                // In AnimeWorld, sidebar is usually on the right or bottom.
                // Let's rely on the fact that we handled the "No results" case.
                // If "film-list" exists, usually the "items" inside it are the results.
                // Are there other "item" divs outside "film-list"?
                // "One Piece" (sidebar) was found when "film-list" was MISSING.
                // So if "film-list" is PRESENT, maybe the sidebar items are not there or we can distinguish them.
                // But to be safe, let's try to extract just the film-list block if possible.
                // Using a simple split might be safer:
                const parts = html.split('class="film-list"');
                if (parts.length > 1) {
                    // Take the part after film-list
                    let content = parts[1];
                    // If there is a sidebar, it might be in a separate container.
                    // Let's assume the "items" we want are in this part.
                    // We can try to stop at "widget" or "sidebar" or "footer"
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

        // Split by item div to handle each result separately
        const chunks = searchContent.split('<div class="item">');
        // Remove the first chunk (content before the first item)
        chunks.shift();

        for (const chunk of chunks) {
            // Extract Name and Href
            // Look for the name tag regardless of attribute order
            const nameTagMatch = /<a[^>]*class="name"[^>]*>([\s\S]*?)<\/a>/i.exec(chunk);
            if (!nameTagMatch) continue;

            const nameTag = nameTagMatch[0];
            let title = nameTagMatch[1].trim();
            // Strip HTML tags from title
            title = title.replace(/<[^>]*>/g, "").trim();
            // Decode common HTML entities in titles (AnimeWorld returns escaped apostrophes frequently).
            title = title
                .replace(/&#x27;|&#039;/g, "'")
                .replace(/&quot;/g, "\"")
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">");

            const hrefMatch = /href="([^"]*)"/i.exec(nameTag);
            const href = hrefMatch ? hrefMatch[1] : null;

            if (!title || !href) continue;

            // Deduplicate by href
            if (seenHrefs.has(href)) continue;
            seenHrefs.add(href);

            // Extract Image
            const imgMatch = /<img[^>]*src="([^"]*)"/i.exec(chunk);
            const image = imgMatch ? imgMatch[1] : null;

            // Extract Tooltip URL for Year check
            // data-tip="api/tooltip/160"
            const tooltipMatch = /data-tip="([^"]*)"/i.exec(chunk);
            const tooltipUrl = tooltipMatch ? tooltipMatch[1] : null;

            // Check for Dub
            // Check for class="dub" in the chunk
            let isDub = /class="dub"/i.test(chunk);

            // Fallback: check href or title
            if (!isDub) {
                if (href.includes('-ita')) isDub = true;
                if (title.includes('(ITA)')) isDub = true;
            }

            // If it explicitly says subita in href, ensure isDub is false (unless mixed?)
            // Usually AnimeWorld separates them.
            if (href.includes('subita')) isDub = false;

            const isSub = !isDub;

            // Normalize title: append (ITA) if it is dub and not in title
            if (isDub && !title.toUpperCase().includes('ITA')) {
                title += ' (ITA)';
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
}

async function fetchTooltipInfo(tooltipUrl) {
    if (!tooltipUrl) return { year: null, type: null };
    try {
        const url = `${BASE_URL}/${tooltipUrl}`;
        const response = await fetch(url, {
            headers: {
                "User-Agent": USER_AGENT,
                "Referer": BASE_URL,
                "X-Requested-With": "XMLHttpRequest"
            }
        });

        if (!response.ok) return { year: null, type: null };
        const html = await response.text();

        // Extract Year
        let year = null;
        const dateMatch = /Data di uscita:[\s\S]*?(?:<dd>|<span>)([\s\S]*?)(?:<\/dd>|<\/span>)/i.exec(html);
        if (dateMatch) {
            const dateStr = dateMatch[1].trim();
            const yearMatch = /(\d{4})/.exec(dateStr);
            if (yearMatch) year = yearMatch[1];
        }

        // Extract Type (Movie, OVA, ONA, Special)
        let type = null;
        if (html.includes('class="movie"')) type = 'movie';
        else if (html.includes('class="ova"')) type = 'ova';
        else if (html.includes('class="ona"')) type = 'ona';
        else if (html.includes('class="special"')) type = 'special';
        else if (html.includes('class="tv"')) type = 'tv'; // Unlikely to exist based on analysis, but good to have

        return { year, type };
    } catch (e) {
        console.error("[AnimeWorld] Tooltip fetch error:", e);
        return { year: null, type: null };
    }
}

async function getStreams(id, type, season, episode, providedMetadata = null) {
    try {
        const metadata = providedMetadata || await getMetadata(id, type);
        if (!metadata) {
            console.error("[AnimeWorld] Metadata not found for", id);
            return [];
        }

        if (!isAnime(metadata)) {
            console.log(`[AnimeWorld] Skipped ${metadata.title} (Not an anime)`);
            return [];
        }

        let mappedSeason = metadata.mappedSeason;
        if (mappedSeason !== null && mappedSeason !== undefined) {
            const parsedMapped = parseInt(mappedSeason, 10);
            if (!isNaN(parsedMapped)) mappedSeason = parsedMapped;
        }
        if (mappedSeason && metadata.seasons && Array.isArray(metadata.seasons)) {
            const normalizedMappedSeason = normalizeSeasonInRange(mappedSeason, metadata.seasons);
            if (normalizedMappedSeason !== mappedSeason) {
                const seasonNumbers = metadata.seasons
                    .map(s => s.season_number)
                    .filter(n => Number.isInteger(n) && n > 0);
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
                const seasonNumbers = metadata.seasons
                    .map(s => s.season_number)
                    .filter(n => Number.isInteger(n) && n > 0);
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
            ...((metadata.alternatives || []).slice(0, 30).map(a => a.title))
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
            if (seasonNameCandidates.some(n => normalizeLooseText(n) === norm)) return;
            seasonNameCandidates.push(clean);
        };
        addSeasonName(seasonName);

        if (season > 1 && metadata.seasons) {
            const targetSeason = metadata.seasons.find(s => s.season_number === season);
            if (targetSeason && targetSeason.air_date) {
                const yearMatch = String(targetSeason.air_date).match(/(\d{4})/);
                if (yearMatch) seasonYear = parseInt(yearMatch[1], 10);
            }
        }

        if (season > 1 && metadata.id) {
            const seasonMetaIt = await getSeasonMetadata(metadata.id, season, "it-IT");
            if (!seasonYear && seasonMetaIt && seasonMetaIt.air_date) {
                const yearMatch = String(seasonMetaIt.air_date).match(/(\d{4})/);
                if (yearMatch) seasonYear = parseInt(yearMatch[1], 10);
            }
            if (seasonMetaIt && seasonMetaIt.name) {
                addSeasonName(seasonMetaIt.name);
            }

            const seasonMetaEn = await getSeasonMetadata(metadata.id, season, "en-US");
            if (!seasonYear && seasonMetaEn && seasonMetaEn.air_date) {
                const yearMatch = String(seasonMetaEn.air_date).match(/(\d{4})/);
                if (yearMatch) seasonYear = parseInt(yearMatch[1], 10);
            }
            if (seasonMetaEn && seasonMetaEn.name) {
                addSeasonName(seasonMetaEn.name);
            }
        }

        // Search logic

        // Strategy 0: If season === 0, search for "Special", "OAV", "Movie"
        if (season === 0) {
            const searchQueries = [
                `${title} Special`,
                `${title} OAV`,
                `${title} Movie`
            ];

            for (const query of searchQueries) {
                // console.log(`[AnimeWorld] Special search: ${query}`);
                const res = await searchAnime(query);
                if (res && res.length > 0) {
                    candidates = candidates.concat(res);
                }
            }

            // Remove duplicates
            candidates = candidates.filter((v, i, a) => a.findIndex(t => (t.href === v.href)) === i);
        }

        // Strategy 1: Specific Season Search (if season > 1)
        if (season > 1) {
            const searchQueries = [
                `${title} ${season}`,
                `${title} Season ${season}`,
                `${title} Stagione ${season}`
            ];

            if (originalTitle && originalTitle !== title) {
                searchQueries.push(`${originalTitle} ${season}`);
            }

            // Season name search (e.g. "Diamond is Unbreakable")
            if (seasonNameCandidates.length > 0) {
                let seasonNameUsed = null;
                for (const seasonNameCandidate of seasonNameCandidates) {
                    const seasonQueries = [
                        `${title} ${seasonNameCandidate}`,
                        seasonNameCandidate
                    ];
                    // Only add original title if it's likely to be useful (e.g. English/Romaji)
                    if (originalTitle && originalTitle !== title && !originalTitle.match(/[\u3040-\u30ff\u4e00-\u9faf]/)) {
                        seasonQueries.push(`${originalTitle} ${seasonNameCandidate}`);
                    }

                    for (const query of seasonQueries) {
                        console.log(`[AnimeWorld] Strategy 1 - Specific Season Name search: ${query}`);
                        const res = await searchAnime(query);
                        if (res && res.length > 0) {
                            const relevantRes = res.filter(c => {
                                const normalizeText = (str) => String(str || "")
                                    .toLowerCase()
                                    .replace(/&#x27;|&#039;/g, "'")
                                    .replace(/[^a-z0-9\s]/g, " ")
                                    .replace(/\s+/g, " ")
                                    .trim();
                                const cNorm = normalizeText(c.title);
                                const sNorm = normalizeText(seasonNameCandidate);
                                const matchesSeasonName = sNorm.length > 0 && (cNorm.includes(sNorm) || checkSimilarity(c.title, seasonNameCandidate));

                                // Check if candidate title actually contains the season name
                                // This is crucial for avoiding Prequels/generic series matching the base title
                                if (!matchesSeasonName) return false;

                                // Also ensure it's generally related to the main series
                                return checkSimilarity(c.title, title) ||
                                    checkSimilarity(c.title, originalTitle) ||
                                    checkSimilarity(c.title, query);
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
                    const res = await searchAnime(query);
                    if (res && res.length > 0) {
                        const relevantRes = res.filter(c =>
                            checkSimilarity(c.title, title) ||
                            checkSimilarity(c.title, originalTitle) ||
                            checkSimilarity(c.title, query)
                        );
                        if (relevantRes.length > 0) {
                            candidates = relevantRes;
                            break;
                        }
                    }
                }
            }
        }

        const isMovie = (metadata.genres && metadata.genres.some(g => g.name === 'Movie')) || season === 0 || type === 'movie';

        // Strategy 2: Standard Title Search
        if (candidates.length === 0) {
            console.log(`[AnimeWorld] Standard search: ${title}`);
            candidates = await searchAnime(title);

            // Check if results are relevant
            if (candidates.length > 0) {
                const valid = candidates.some(c =>
                    checkSimilarity(c.title, title) ||
                    checkSimilarity(c.title, originalTitle) ||
                    isRelevantByLooseMatch(c.title)
                );
                if (!valid) {
                    console.log("[AnimeWorld] Standard search results seem irrelevant. Discarding.");
                    candidates = [];
                }
            }

            // Strategy 2.1: If no results and title contains hyphens, try without them
            // e.g. "One-Punch Man" → "One Punch Man"
            if (candidates.length === 0 && title.includes('-')) {
                const dehyphenated = title.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
                if (dehyphenated !== title) {
                    console.log(`[AnimeWorld] Dehyphenated search: ${dehyphenated}`);
                    candidates = await searchAnime(dehyphenated);

                    // Check relevance
                    if (candidates.length > 0) {
                        const valid = candidates.some(c =>
                            checkSimilarity(c.title, title) ||
                            checkSimilarity(c.title, originalTitle) ||
                            checkSimilarity(c.title, dehyphenated) ||
                            isRelevantByLooseMatch(c.title, [dehyphenated])
                        );
                        if (!valid) {
                            console.log("[AnimeWorld] Dehyphenated search results seem irrelevant. Discarding.");
                            candidates = [];
                        }
                    }
                }
            }
        }

        // Strategy 2.5: For Movies, try additional search variations to ensure we find the content
        // This is crucial because "One Piece Film: Red" might be listed as "One Piece Movie 15"
        // and a search for "One Piece Film Red" might only return the series.
        if (isMovie) {
            const variantCandidates = [];

            // Try padded numbers for "Movie X" -> "Movie 0X" (e.g. "Movie 1" -> "Movie 01")
            const movieNumMatch = /\b(movie|film)\s*(\d+)\b/i.exec(title);
            if (movieNumMatch) {
                const typeWord = movieNumMatch[1];
                const numStr = movieNumMatch[2];
                if (numStr.length === 1) { // Single digit
                    const padded = `0${numStr}`;
                    // Replace ONLY the first occurrence to avoid messing up if multiple numbers exist (rare)
                    // Use a regex with replacement to ensure we target the matched part
                    const paddedTitle = title.replace(new RegExp(`\\b${typeWord}\\s*${numStr}\\b`, 'i'), `${typeWord} ${padded}`);

                    console.log(`[AnimeWorld] Padded search: ${paddedTitle}`);
                    const paddedRes = await searchAnime(paddedTitle);
                    if (paddedRes && paddedRes.length > 0) variantCandidates.push(...paddedRes);
                }
            }

            // 0. Detect separators
            let parts = [];
            if (title.includes(' - ')) {
                parts = title.split(' - ');
            } else if (title.includes(':')) {
                parts = title.split(':');
            }

            if (parts.length > 1) {
                const mainTitle = parts[0].trim();
                const subtitle = parts[parts.length - 1].trim();

                // 1. Main Title Search (often the most effective)
                if (mainTitle.length > 3) {
                    // console.log(`[AnimeWorld] Main title search: ${mainTitle}`);
                    const mainRes = await searchAnime(mainTitle);
                    if (mainRes && mainRes.length > 0) variantCandidates.push(...mainRes);
                }

                // 2. Subtitle Search
                if (subtitle.length > 3) {
                    // console.log(`[AnimeWorld] Movie subtitle search: ${subtitle}`);
                    const subRes = await searchAnime(subtitle);
                    if (subRes && subRes.length > 0) variantCandidates.push(...subRes);

                    // If subtitle contains "Part X", try searching without it
                    if (/part\s*\d+/i.test(subtitle)) {
                        const simpleSubtitle = subtitle.replace(/part\s*\d+/i, "").trim();
                        if (simpleSubtitle.length > 3) {
                            // console.log(`[AnimeWorld] Simplified subtitle search: ${simpleSubtitle}`);
                            const simpleRes = await searchAnime(simpleSubtitle);
                            if (simpleRes && simpleRes.length > 0) variantCandidates.push(...simpleRes);
                        }
                    }
                }

                // 3. "MainTitle Movie" Search
                const movieQuery = `${mainTitle} Movie`;
                // console.log(`[AnimeWorld] Movie query search: ${movieQuery}`);
                const movieRes = await searchAnime(movieQuery);
                if (movieRes && movieRes.length > 0) variantCandidates.push(...movieRes);

                // 4. "MainTitle Film" Search
                const filmQuery = `${mainTitle} Film`;
                // console.log(`[AnimeWorld] Film query search: ${filmQuery}`);
                const filmRes = await searchAnime(filmQuery);
                if (filmRes && filmRes.length > 0) variantCandidates.push(...filmRes);

                // 5. Colon search fallback (if it was " - ")
                if (title.includes(' - ')) {
                    const colonTitle = title.replace(' - ', ': ');
                    // console.log(`[AnimeWorld] Colon search: ${colonTitle}`);
                    const colonRes = await searchAnime(colonTitle);
                    if (colonRes && colonRes.length > 0) variantCandidates.push(...colonRes);
                }
            } else {
                // No separator, try appending keywords
                if (!title.toLowerCase().includes('movie')) {
                    const movieQuery = `${title} Movie`;
                    // console.log(`[AnimeWorld] Movie query search: ${movieQuery}`);
                    const movieRes = await searchAnime(movieQuery);
                    if (movieRes && movieRes.length > 0) variantCandidates.push(...movieRes);
                }
                if (!title.toLowerCase().includes('film')) {
                    const filmQuery = `${title} Film`;
                    // console.log(`[AnimeWorld] Film query search: ${filmQuery}`);
                    const filmRes = await searchAnime(filmQuery);
                    if (filmRes && filmRes.length > 0) variantCandidates.push(...filmRes);
                }
            }

            // 6. Hyphen search (Replace : with -)
            if (title.includes(':')) {
                const hyphenTitle = title.replace(/:/g, ' -');
                // console.log(`[AnimeWorld] Hyphen search: ${hyphenTitle}`);
                const hyphenRes = await searchAnime(hyphenTitle);
                if (hyphenRes && hyphenRes.length > 0) variantCandidates.push(...hyphenRes);
            }

            // 7. Simplified Title Search (Remove "Film", "Movie", etc.)
            // e.g. "One Piece Film: Red" -> "One Piece Red"
            const simpleTitle = title.replace(/\b(film|movie|the|movie)\b/gi, "").replace(/-/g, "").replace(/:/g, "").replace(/\s+/g, " ").trim();
            if (simpleTitle.length > 3 && simpleTitle !== title) {
                // console.log(`[AnimeWorld] Simplified title search: ${simpleTitle}`);
                const simpleRes = await searchAnime(simpleTitle);
                if (simpleRes && simpleRes.length > 0) variantCandidates.push(...simpleRes);
            }

            // Add variants to main candidates
            if (variantCandidates.length > 0) {
                // Prioritize variants as they are more specific to the movie request
                candidates = [...variantCandidates, ...candidates];
                // Remove duplicates based on href
                candidates = candidates.filter((v, i, a) => a.findIndex(t => (t.href === v.href)) === i);
            }
        }

        // Strategy 3: Original Title Search
        // For movies, always try original title as it might be more accurate (e.g. "One Piece Film: Gold")
        const shouldSearchOriginal = ((!candidates || candidates.length === 0) || isMovie) && originalTitle && originalTitle !== title;

        if (shouldSearchOriginal) {
            // console.log(`[AnimeWorld] Trying original title: ${originalTitle}`);
            const res = await searchAnime(originalTitle);

            // Check relevance
            if (res && res.length > 0) {
                const valid = res.some(c => {
                    if (checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle)) return true;
                    if (isRelevantByLooseMatch(c.title, [originalTitle])) return true;
                    if (metadata.alternatives) {
                        return metadata.alternatives.some(alt => checkSimilarity(c.title, alt.title));
                    }
                    return false;
                });

                if (valid) {
                    candidates = [...candidates, ...res];
                    // Remove duplicates
                    candidates = candidates.filter((v, i, a) => a.findIndex(t => (t.href === v.href)) === i);
                } else {
                    console.log("[AnimeWorld] Original title search results seem irrelevant. Discarding.");
                }
            }
        }

        // Strategy 3.5: Sanitized Original Title Search (Split by colon/Film/Movie)
        // If we still have no candidates (or existing ones are weak), try variations of original title
        // This handles cases like "One Piece Film: Gold" where "One Piece Film" works but full title fails
        // We allow this for movies even if candidates exist, because initial search might return irrelevant stuff
        const shouldSearchSanitized = ((!candidates || candidates.length === 0) || isMovie) && originalTitle;

        if (shouldSearchSanitized) {
            let sanitizedQueries = [];

            // 1. Split by colon
            if (originalTitle.includes(':')) {
                const parts = originalTitle.split(':');
                if (parts[0].trim().length > 3) {
                    sanitizedQueries.push(parts[0].trim());
                }
            }

            // 2. Split by "Film" or "Movie" (case insensitive)
            const lowerOrg = originalTitle.toLowerCase();
            if (lowerOrg.includes('film')) {
                const idx = lowerOrg.indexOf('film');
                const query = originalTitle.substring(0, idx + 4).trim();
                if (query.length > 3 && query !== originalTitle) sanitizedQueries.push(query);
            }
            if (lowerOrg.includes('movie')) {
                const idx = lowerOrg.indexOf('movie');
                const query = originalTitle.substring(0, idx + 5).trim();
                if (query.length > 3 && query !== originalTitle) sanitizedQueries.push(query);
            }

            // Deduplicate queries
            sanitizedQueries = [...new Set(sanitizedQueries)];

            for (const q of sanitizedQueries) {
                // console.log(`[AnimeWorld] Trying sanitized original title: ${q}`);
                const res = await searchAnime(q);

                if (res && res.length > 0) {
                    // Filter relevant results to avoid polluting candidates with completely unrelated stuff
                    const validRes = res.filter(c => {
                        return checkSimilarity(c.title, title) ||
                            checkSimilarity(c.title, originalTitle) ||
                            isRelevantByLooseMatch(c.title, [q]);
                    });

                    if (validRes.length > 0) {
                        console.log(`[AnimeWorld] Found ${validRes.length} valid candidates from sanitized search.`);
                        candidates = [...candidates, ...validRes];
                    }
                }
            }
            // Remove duplicates
            if (candidates.length > 0) {
                candidates = candidates.filter((v, i, a) => a.findIndex(t => (t.href === v.href)) === i);
            }
        }

        // Strategy 4: Alternative Titles Search
        // For movies, we should always try alternative titles because the main title might match the series but not the movie
        if ((!candidates || candidates.length === 0 || isMovie) && metadata.alternatives) {
            const altTitles = metadata.alternatives
                .map(t => t.title)
                .filter(t => /^[a-zA-Z0-9\s\-\.\:\(\)!'&]+$/.test(t)) // Only Latin-ish chars + common punctuation
                .filter(t => t !== title && t !== originalTitle);

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

                // console.log(`[AnimeWorld] Trying alternative title: ${altTitle}`);
                const res = await searchAnime(altTitle);
                altSearchCount++;

                if (res && res.length > 0) {
                    const valid = res.some(c => {
                        if (checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle)) return true;
                        if (isRelevantByLooseMatch(c.title, [altTitle])) return true;
                        if (metadata.alternatives) {
                            return metadata.alternatives.some(alt => checkSimilarity(c.title, alt.title));
                        }
                        return false;
                    });

                    if (valid) {
                        console.log(`[AnimeWorld] Found valid candidates from alternative title: ${altTitle}`);
                        // Attach the matched alternative title to the candidates so we can use it for relevance check later
                        res.forEach(c => c.matchedAltTitle = altTitle);
                        candidates = [...candidates, ...res];
                        // candidates = candidates.filter((v, i, a) => a.findIndex(t => (t.href === v.href)) === i);
                        // Don't break, keep searching other alternatives to maximize chances?
                        // But searching all 30 alternatives is too slow.
                        // Maybe break if we found a "strong" match?
                        // For now, let's limit the number of alternative searches to 5.
                    }
                }
            }

            // Deduplicate candidates
            if (candidates.length > 0) {
                candidates = candidates.filter((v, i, a) => a.findIndex(t => (t.href === v.href)) === i);
            }
        }

        if (!candidates || candidates.length === 0) {
            console.log("[AnimeWorld] No anime found");
            return [];
        }

        // Separate Subs and Dubs
        // AnimeWorld explicitly marks Dubs with .dub class
        // But search results might contain mixed content.
        // My searchAnime returns isDub/isSub flags.

        const subs = candidates.filter(c => c.isSub);
        const dubs = candidates.filter(c => c.isDub);

        // Helper to enrich top candidates with year if needed
        const enrichTopCandidates = async (list) => {
            // Priority Enrichment Strategy:
            // Instead of blindly picking the top 3, we prioritize candidates that are most likely to be the correct match.
            // We use checkSimilarity to identify promising candidates.

            const candidatesToEnrich = [];
            const processedHrefs = new Set();

            // 1. Find high-similarity matches first
            const promising = list.filter(c => {
                // Skip if already processed (though here list is unique usually)
                if (processedHrefs.has(c.href)) return false;

                const isSim = checkSimilarity(c.title, title) ||
                    checkSimilarity(c.title, originalTitle) ||
                    checkSimilarity(c.title, `${title} ${season}`) ||
                    checkSimilarity(c.title, `${originalTitle} ${season}`) ||
                    (seasonName && checkSimilarity(c.title, seasonName)) ||
                    (seasonName && checkSimilarity(c.title, `${title} ${seasonName}`)) ||
                    (c.matchedAltTitle && checkSimilarity(c.title, c.matchedAltTitle));

                if (isSim) {
                    processedHrefs.add(c.href);
                    return true;
                }
                return false;
            });

            // 2. Add top 3 from the original list (if not already included)
            // This acts as a fallback if similarity check is too strict or fails
            const originalTop = list.slice(0, 3).filter(c => {
                if (processedHrefs.has(c.href)) return false;
                processedHrefs.add(c.href);
                return true;
            });

            // Combine: Promising ones first, then original top ones
            // Limit total requests to avoid performance issues (e.g. max 6 requests)
            const combined = [...promising, ...originalTop].slice(0, 6);

            for (const c of combined) {
                if (!c.date && c.tooltipUrl) {
                    const { year, type } = await fetchTooltipInfo(c.tooltipUrl);
                    if (year) c.date = year;
                    if (type) c.type = type;
                    // console.log(`[AnimeWorld] Enriched "${c.title}" with year: ${year}, type: ${type}`);
                }
                c.enriched = true;
            }
            return combined;
        };

        // Enrich candidates before finding best match
        await enrichTopCandidates(subs);
        await enrichTopCandidates(dubs);

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
            pickBySeasonYear = async (list) => {
                if (!list || list.length === 0) return null;

                const sample = list.slice(0, 15);
                for (const c of sample) {
                    if (!c.date && c.tooltipUrl) {
                        const { year, type } = await fetchTooltipInfo(c.tooltipUrl);
                        if (year) c.date = year;
                        if (type) c.type = type;
                    }
                }

                const ranked = sample
                    .map(c => {
                        const yearMatch = c.date ? String(c.date).match(/(\d{4})/) : null;
                        if (!yearMatch) return null;
                        const cYear = parseInt(yearMatch[1], 10);
                        if (isNaN(cYear)) return null;
                        if (c.type === "movie") return null;
                        return { candidate: c, diff: Math.abs(cYear - seasonYear) };
                    })
                    .filter(Boolean)
                    .sort((a, b) => a.diff - b.diff);

                return ranked.length > 0 ? ranked[0].candidate : null;
            };

            if (!bestSub) bestSub = await pickBySeasonYear(subs);
            if (!bestDub) bestDub = await pickBySeasonYear(dubs);

            const normalizeTitle = (str) => String(str || "")
                .toLowerCase()
                .replace(/\(ita\)/g, "")
                .replace(/\(sub ita\)/g, "")
                .replace(/[^a-z0-9\s]/g, " ")
                .replace(/\s+/g, " ")
                .trim();
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

            const refineSelection = async (current, list) => {
                const byYear = await pickBySeasonYear(list);
                if (!byYear) return current;
                if (!current) return byYear;

                const currentNorm = normalizeTitle(current.title);
                const currentIsBase = currentNorm === baseTitleNorm || (baseOriginalNorm && currentNorm === baseOriginalNorm);
                const currentDiff = candidateDiff(current);
                const byYearDiff = candidateDiff(byYear);

                if (currentIsBase) return byYear;
                if (currentDiff === null && byYearDiff !== null) return byYear;
                if (currentDiff !== null && byYearDiff !== null && byYearDiff < currentDiff) return byYear;
                return current;
            };

            bestSub = await refineSelection(bestSub, subs);
            bestDub = await refineSelection(bestDub, dubs);
        }

        if (season > 1 && (!bestSub || !bestDub)) {
            const seasonTokenRegex = new RegExp(`\\b${season}\\b|season\\s*${season}|stagione\\s*${season}|part\\s*${season}|parte\\s*${season}`, "i");
            const pickBySeasonToken = (list) => {
                if (!list || list.length === 0) return null;
                const tokenMatches = list.filter(c => seasonTokenRegex.test(String(c.title || "")));
                if (tokenMatches.length === 0) return null;
                return tokenMatches[0];
            };

            if (!bestSub) bestSub = pickBySeasonToken(subs);
            if (!bestDub) bestDub = pickBySeasonToken(dubs);
        }

        if (season > 1) {
            const normalizeCandidateTitle = (candidate) => String(candidate.title || "")
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
                const raw = String(candidate.title || "").toLowerCase();
                if (/season|stagione|part|parte|\b\d+\b/.test(raw)) return true;
                if (/\b(arc|saga|chapter|cour)\b|\b\w+(?:-|\s)?hen\b/.test(raw)) return true;
                if (/final\s*season/i.test(raw)) return true;
                return false;
            };
            const isRelevantCandidate = (candidate) => {
                if (checkSimilarity(candidate.title, title) || checkSimilarity(candidate.title, originalTitle)) return true;
                if (metadata.alternatives) {
                    const altSimilarity = metadata.alternatives.some(alt => checkSimilarity(candidate.title, alt.title));
                    if (altSimilarity) return true;
                }

                const baseTokens = new Set([
                    ...tokenizeForPairing(title || ""),
                    ...tokenizeForPairing(originalTitle || ""),
                    ...(metadata.alternatives || []).slice(0, 30).flatMap(alt => tokenizeForPairing(alt.title || ""))
                ]);
                const candidateTokens = tokenizeForPairing(candidate.title || "");
                if (candidateTokens.some(t => baseTokens.has(t))) return true;

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
                const specificPool = list.filter(c => {
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
            const compatibleDubs = dubs.filter(c => areCoherentCandidates(bestSub, c, title, originalTitle));
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
            const raw = String(candidate?.title || "").toLowerCase();
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
                const isRelevant = seasonTokenRegex.test(raw) ||
                    checkSimilarity(c.title, title) ||
                    checkSimilarity(c.title, originalTitle);
                if (!isRelevant) continue;

                if (!best || part < best.part || (part === best.part && raw.length < String(best.candidate.title || "").length)) {
                    best = { candidate: c, part };
                }
            }

            return best ? best.candidate : null;
        };

        // Helper to process a match
        const processMatch = async (match, isDub, candidatePool, requestedEpisode = episode, allowSplitFallback = true) => {
            if (!match) return;

            const animeUrl = `${BASE_URL}${match.href}`;
            console.log(`[AnimeWorld] Fetching episodes from: ${animeUrl}`);

            try {
                const res = await fetch(animeUrl, {
                    headers: {
                        "User-Agent": USER_AGENT,
                        "Referer": BASE_URL
                    }
                });

                if (!res.ok) return;
                const html = await res.text();

                // Use regex to find episodes
                // Pattern: <li class="episode"><a ... data-episode-num="1" ... data-id="12345" ...>...</a></li>
                // Note: The order of attributes might vary, so we use a simpler regex approach or multiple regexes
                // A safe way is to find all <a> tags inside <li class="episode"> or just look for the data attributes globally since they are unique to episodes usually.

                const episodeRegex = /data-episode-num="([^"]*)"[^>]*data-id="([^"]*)"/g;
                // Or if id comes before num:
                // Let's try to match the whole tag content loosely
                // <a ... data-episode-num="1" ... data-id="12345" ...>

                const episodes = [];
                // We'll scan for data-episode-num and data-id in close proximity
                const linkRegex = /<a[^>]*class="[^"]*episode[^"]*"[^>]*>|<li[^>]*class="episode"[^>]*>([\s\S]*?)<\/li>/g;
                // Actually AnimeWorld structure is <li class="episode"><a ...>...</a></li>
                // But the attributes are on the <a> tag.
                // Let's just find all <a> tags that have data-episode-num

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

                // Determine if we should prioritize absolute episode
                // Logic: If the match title is the generic series title (e.g. "One Piece"), 
                // it likely contains all episodes in absolute numbering.
                // If the match title is specific (e.g. "My Hero Academia II"), it likely uses relative numbering.
                let prioritizeAbsolute = false;
                if (season > 1 && type !== "movie") {
                    const normMatch = (match.title || "").toLowerCase().replace(/\(ita\)/g, "").replace(/\(sub ita\)/g, "").trim();
                    const normSeries = (title || "").toLowerCase().trim();
                    const normOriginalSeries = (originalTitle || "").toLowerCase().trim();

                    // If titles are identical, assume generic page -> Absolute.
                    const isBaseSeriesEntry = normMatch === normSeries || (normOriginalSeries && normMatch === normOriginalSeries);
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

                    // Also check if we calculated a valid absolute episode
                    const absEpisode = calculateAbsoluteEpisode(metadata, season, requestedEpisode);
                    if (absEpisode == requestedEpisode) prioritizeAbsolute = false;
                }

                if (type === "movie") {
                    // For movies, just take the first available episode/stream
                    if (episodes.length > 0) {
                        targetEp = episodes[0];
                    }
                } else {
                    if (prioritizeAbsolute) {
                        const absEpisode = calculateAbsoluteEpisode(metadata, season, requestedEpisode);
                        console.log(`[AnimeWorld] Prioritizing absolute episode: ${absEpisode} for "${match.title}"`);
                        targetEp = episodes.find(e => e.num == absEpisode);

                        if (!targetEp) {
                            console.log(`[AnimeWorld] Absolute episode ${absEpisode} not found in list. Available range: ${episodes.length > 0 ? episodes[0].num + '-' + episodes[episodes.length - 1].num : 'None'}`);
                        }
                    } else {
                        targetEp = episodes.find(e => e.num == requestedEpisode);
                    }
                }

                // Fallback to absolute episode if not found and season > 1 (and not already prioritized/tried)
                if (!targetEp && season > 1 && !prioritizeAbsolute) {
                    const absEpisode = calculateAbsoluteEpisode(metadata, season, requestedEpisode);
                    if (absEpisode != requestedEpisode) {
                        console.log(`[AnimeWorld] Relative episode ${requestedEpisode} not found, trying absolute: ${absEpisode}`);
                        targetEp = episodes.find(e => e.num == absEpisode);
                    }
                }

                // Split-cour fallback:
                // If this part doesn't contain the requested episode, switch to next Part/Cour and remap locally.
                if (!targetEp && allowSplitFallback && season > 1 && type !== "movie") {
                    const numericEpisodes = episodes
                        .map(e => parseInt(e.num, 10))
                        .filter(n => Number.isInteger(n) && n > 0);
                    const maxEpisodeInPart = numericEpisodes.length > 0 ? Math.max(...numericEpisodes) : 0;

                    if (maxEpisodeInPart > 0 && requestedEpisode > maxEpisodeInPart) {
                        const nextCandidate = pickNextSplitCourCandidate(match, candidatePool || []);
                        const mappedEpisode = requestedEpisode - maxEpisodeInPart;

                        if (nextCandidate && mappedEpisode > 0) {
                            console.log(`[AnimeWorld] Split-cour switch: "${match.title}" -> "${nextCandidate.title}", mapped episode ${requestedEpisode} -> ${mappedEpisode}`);
                            await processMatch(nextCandidate, isDub, candidatePool, mappedEpisode, false);
                            return;
                        }
                    }
                }

                if (targetEp) {
                    const episodeId = targetEp.id;
                    // Fetch stream info
                    const infoUrl = `${BASE_URL}/api/episode/info?id=${episodeId}`;
                    const infoRes = await fetch(infoUrl, {
                        headers: {
                            "User-Agent": USER_AGENT,
                            "Referer": animeUrl,
                            "X-Requested-With": "XMLHttpRequest"
                        }
                    });

                    if (infoRes.ok) {
                        const infoData = await infoRes.json();
                        if (infoData.grabber) {
                            // Extract quality from grabber URL if possible, otherwise default to "auto"
                            let quality = "auto";

                            // Check playlist quality if available
                            if (infoData.grabber.includes('.m3u8')) {
                                const playlistQuality = await checkQualityFromPlaylist(infoData.grabber, {
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

                            // The 'server' field is often displayed as the stream name.
                            // If we just use "AnimeWorld (ITA)", it might be grouped under "AnimeWorld" in the UI.
                            // We should use a descriptive name.
                            // infoData might contain 'server' or 'name' if available, but usually it's just grabber.
                            // However, we can try to extract the host from the grabber URL to be more specific.
                            // e.g. "AnimeWorld (ITA) - SweetPixel"

                            let host = "";
                            try {
                                const urlObj = new URL(infoData.grabber);
                                host = urlObj.hostname.replace("www.", "");
                                // Simplify host names
                                if (host.includes("sweetpixel")) host = "SweetPixel";
                                else if (host.includes("stream")) host = "Stream";
                            } catch (e) { }

                            // Let's create distinct server names to ensure they appear correctly
                            const baseName = isDub ? "AnimeWorld (ITA)" : "AnimeWorld (SUB ITA)";
                            const serverName = host ? `${baseName} - ${host}` : baseName;

                            // Avoid duplicating (ITA) if already in title
                            let displayTitle = match.title;
                            if (targetEp && targetEp.num) {
                                displayTitle += ` - Ep ${targetEp.num}`;
                            } else if (requestedEpisode) {
                                displayTitle += ` - Ep ${requestedEpisode}`;
                            }

                            if (isDub && !displayTitle.includes("(ITA)")) displayTitle += " (ITA)";
                            if (!isDub && !displayTitle.includes("(SUB ITA)")) displayTitle += " (SUB ITA)";

                            // Filter out unwanted mp4 links (e.g. .mkv.mp4 or known problematic/scam domains)
                            const blockedDomains = ['jujutsukaisenanime.com', 'onepunchman.it', 'dragonballhd.it', 'narutolegend.it'];
                            const lowerLink = (infoData.grabber || "").toLowerCase();
                            if (lowerLink.endsWith('.mkv.mp4') || blockedDomains.some(d => lowerLink.includes(d))) {
                                console.log(`[AnimeWorld] Skipping unwanted link: ${infoData.grabber}`);
                            } else {
                                results.push({
                                    name: serverName,
                                    title: displayTitle,
                                    server: serverName,
                                    url: infoData.grabber,
                                    quality: quality,
                                    isM3U8: infoData.grabber.includes('.m3u8'),
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
        };

        if (bestSub) await processMatch(bestSub, false, subs, episode, true);
        if (bestDub) await processMatch(bestDub, true, dubs, episode, true);

        return results.map(s => formatStream(s, "AnimeWorld")).filter(s => s !== null);

    } catch (e) {
        console.error("[AnimeWorld] getStreams error:", e);
        return [];
    }
}

module.exports = {
    getStreams,
    searchAnime,
    getMetadata,
    findBestMatch,
    checkSimilarity
};
