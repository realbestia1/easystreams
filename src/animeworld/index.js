const { getTmdbFromKitsu, isAnime } = require('../tmdb_helper.js');
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

        return {
            ...details,
            imdb_id,
            tmdb_id: tmdbId,
            alternatives,
            mappedSeason
        };
    } catch (e) {
        console.error("[AnimeWorld] Metadata error:", e);
        return null;
    }
}

async function getSeasonMetadata(id, season) {
    try {
        const url = `https://api.themoviedb.org/3/tv/${id}/season/${season}?api_key=${TMDB_API_KEY}&language=it-IT`;
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

function findBestMatch(candidates, title, originalTitle, season, metadata, options = {}) {
    if (!candidates || candidates.length === 0) return null;

    let isTv = !!metadata.name;
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

    // Check if we lost all exact matches due to year filtering
    if (preYearExactMatches.length > 0) {
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
        
        // Check for numeric suffix or "Season X"
        const numberMatch = candidates.find(c => {
            const t = (c.title || "").toLowerCase();
            const regex = new RegExp(`\\b${seasonStr}$|\\b${seasonStr}\\b|season ${seasonStr}|stagione ${seasonStr}`, 'i');
            if (regex.test(t)) {
                // Additional check: Make sure the base title matches too!
                // e.g. "One Piece 2" should match "One Piece" but not "Two Piece 2"
                return checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle);
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
                     return checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle);
                }
                return false;
            });
            if (romanMatch) return romanMatch;
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
    // If we didn't find a numbered match, try to find ANY candidate that matches the title
    // This handles cases where the season number is missing or different format
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
                     for(const marker of stopMarkers) {
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

        if (metadata.mappedSeason) {
            console.log(`[AnimeWorld] Kitsu mapping indicates Season ${metadata.mappedSeason}. Overriding requested Season ${season}`);
            season = metadata.mappedSeason;
        }

        const title = metadata.title || metadata.name;
        const originalTitle = metadata.original_title || metadata.original_name;
        
        console.log(`[AnimeWorld] Searching for: ${title} (Season ${season})`);
        
        let candidates = [];
        let seasonNameMatch = false;

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

             // TMDB Season Name
             const seasonMeta = await getSeasonMetadata(metadata.id, season);
             if (seasonMeta && seasonMeta.name && !seasonMeta.name.match(/^Season \d+|^Stagione \d+/i)) {
                 const seasonQueries = [
                     `${title} ${seasonMeta.name}`,
                     seasonMeta.name
                 ];

                 for (const query of seasonQueries) {
                     // console.log(`[AnimeWorld] Specific Season Name search: ${query}`);
                     const res = await searchAnime(query);
                     if (res && res.length > 0) {
                         console.log(`[AnimeWorld] Found matches for season name: ${query}`);
                         // Filter results to ensure relevance
                         const relevantRes = res.filter(c => checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle));
                         
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
                     const res = await searchAnime(query);
                     if (res && res.length > 0) {
                         // Filter results to ensure relevance
                         const relevantRes = res.filter(c => checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle));
                         
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
                 const valid = candidates.some(c => checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle));
                 if (!valid) {
                     console.log("[AnimeWorld] Standard search results seem irrelevant. Discarding.");
                     candidates = [];
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
                          return checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle);
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
                 .filter(t => /^[a-zA-Z0-9\s\-\.\:\(\)]+$/.test(t)) // Only Latin chars
                 .filter(t => t !== title && t !== originalTitle);
             
             const uniqueAlts = [...new Set(altTitles)];
             
             let altSearchCount = 0;
             for (const altTitle of uniqueAlts) {
                 if (altSearchCount >= 5) break; // Limit to 5 alternative searches
                 if (altTitle.length < 4) continue;
                 
                 // console.log(`[AnimeWorld] Trying alternative title: ${altTitle}`);
                 const res = await searchAnime(altTitle);
                 altSearchCount++;
                 
                 if (res && res.length > 0) {
                      const valid = res.some(c => {
                          if (checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle)) return true;
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

        let bestSub = findBestMatch(subs, title, originalTitle, season, metadata, { bypassSeasonCheck: seasonNameMatch });
        let bestDub = findBestMatch(dubs, title, originalTitle, season, metadata, { bypassSeasonCheck: seasonNameMatch });

        const results = [];

        // Helper to process a match
        const processMatch = async (match, isDub) => {
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
                    
                    // If titles are identical (or very close), assume generic page -> Absolute
                    if (normMatch === normSeries) {
                        prioritizeAbsolute = true;
                    } else {
                        // Check for containment (e.g. "One Piece - All'arrembaggio!" vs "One Piece")
                        // But ensure we don't match "One Piece Movie" against "One Piece"
                        const isSpecific = /\b(season|stagione)\b|\b(movie|film)\b|\b(special|oav|ova)\b/i.test(normMatch);
                        
                        // Also check for numeric suffixes which usually indicate season (e.g. "Title 2")
                        // But be careful about "Title 2000" (year) or "Hunter x Hunter 2011"
                        // If the number is small (< 20), it's likely a season.
                        const endsWithNumber = /(\d+)$/.exec(normMatch);
                        let isSeasonNumber = false;
                        if (endsWithNumber) {
                            const num = parseInt(endsWithNumber[1]);
                            if (num < 1900) isSeasonNumber = true; 
                        }

                        if (!isSpecific && !isSeasonNumber) {
                            if (normMatch.includes(normSeries) || normSeries.includes(normMatch)) {
                                // console.log(`[AnimeWorld] Fuzzy match for absolute check: "${normMatch}" vs "${normSeries}"`);
                                prioritizeAbsolute = true;
                            }
                        }
                    }
                    
                    // Also check if we calculated a valid absolute episode
                    const absEpisode = calculateAbsoluteEpisode(metadata, season, episode);
                    if (absEpisode == episode) prioritizeAbsolute = false;
                }

                if (type === "movie") {
                    // For movies, just take the first available episode/stream
                    if (episodes.length > 0) {
                        targetEp = episodes[0];
                    }
                } else {
                    if (prioritizeAbsolute) {
                        const absEpisode = calculateAbsoluteEpisode(metadata, season, episode);
                        console.log(`[AnimeWorld] Prioritizing absolute episode: ${absEpisode} for "${match.title}"`);
                        targetEp = episodes.find(e => e.num == absEpisode);
                        
                        if (!targetEp) {
                            console.log(`[AnimeWorld] Absolute episode ${absEpisode} not found in list. Available range: ${episodes.length > 0 ? episodes[0].num + '-' + episodes[episodes.length-1].num : 'None'}`);
                        }
                    } else {
                        targetEp = episodes.find(e => e.num == episode);
                    }
                }
                
                // Fallback to absolute episode if not found and season > 1 (and not already prioritized/tried)
                if (!targetEp && season > 1 && !prioritizeAbsolute) {
                    const absEpisode = calculateAbsoluteEpisode(metadata, season, episode);
                    if (absEpisode != episode) {
                        console.log(`[AnimeWorld] Relative episode ${episode} not found, trying absolute: ${absEpisode}`);
                        targetEp = episodes.find(e => e.num == absEpisode);
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
                            } catch (e) {}

                            // Let's create distinct server names to ensure they appear correctly
                            const baseName = isDub ? "AnimeWorld (ITA)" : "AnimeWorld (SUB ITA)";
                            const serverName = host ? `${baseName} - ${host}` : baseName;
                            
                            // Avoid duplicating (ITA) if already in title
                            let displayTitle = match.title;
                            if (targetEp && targetEp.num) {
                                displayTitle += ` - Ep ${targetEp.num}`;
                            } else if (episode) {
                                displayTitle += ` - Ep ${episode}`;
                            }
                            
                            if (isDub && !displayTitle.includes("(ITA)")) displayTitle += " (ITA)";
                            if (!isDub && !displayTitle.includes("(SUB ITA)")) displayTitle += " (SUB ITA)";

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
                } else {
                    console.log(`[AnimeWorld] Episode ${episode} not found in ${match.title}`);
                }

            } catch (e) {
                console.error("[AnimeWorld] Error processing match:", e);
            }
        };

        if (bestSub) await processMatch(bestSub, false);
        if (bestDub) await processMatch(bestDub, true);

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
