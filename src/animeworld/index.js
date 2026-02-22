const BASE_URL = "https://www.animeworld.ac";
const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function getMetadata(id, type) {
    try {
        const normalizedType = String(type).toLowerCase();
        let tmdbId = id;

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
            alternatives
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
    // console.log(`[AnimeWorld] Similarity: "${t1}" vs "${t2}" -> score ${score} (matches: ${matches}/${w2.length})`);
    
    // Require at least 50% of target words to be in candidate
    return score >= 0.5;
};

function findBestMatch(candidates, title, originalTitle, season, metadata, options = {}) {
    if (!candidates || candidates.length === 0) return null;

    const isTv = !!metadata.name;
    
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
        return t === normTitle || (normOriginal && t === normOriginal);
    });

    if (metaYear && (season === 1 || !isTv)) {
        const yearFiltered = candidates.filter(c => {
            if (!c.date) return true; 
            const cYear = parseInt(c.date);
            return Math.abs(cYear - metaYear) <= 2;
        });
        
        if (yearFiltered.length > 0) {
            candidates = yearFiltered;
        } else if (candidates.length > 0) {
             // If strictly filtered out, return null to avoid bad match
             // But only if we are strict? AnimeUnity returns null here.
             return null;
        }
    }

    // Check if we lost all exact matches due to year filtering
    if (preYearExactMatches.length > 0) {
         const anyExactMatchSurvived = candidates.some(c => 
             preYearExactMatches.some(pym => pym.href === c.href) // Use href as ID
         );
         if (!anyExactMatchSurvived) {
             console.log("[AnimeWorld] All exact matches rejected by year filter. Returning null to avoid mismatch.");
             return null;
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
        
        // Try to find one with "Special" in title if multiple
        const specialTitleMatch = candidates.find(c => (c.title || "").toLowerCase().includes("special"));
        if (specialTitleMatch) {
             // console.log(`[AnimeWorld] Found special match candidate: ${specialTitleMatch.title}`);
             if (checkSimilarity(specialTitleMatch.title, title) || checkSimilarity(specialTitleMatch.title, originalTitle)) {
                 return specialTitleMatch;
             }
        }
        
        // Otherwise return the first candidate IF it passes similarity check
        const first = candidates[0];
        // console.log(`[AnimeWorld] First candidate: ${first.title}`);
        const sim1 = checkSimilarity(first.title, title);
        const sim2 = checkSimilarity(first.title, originalTitle);
        // console.log(`[AnimeWorld] Similarity check: ${sim1} / ${sim2}`);

        if (sim1 || sim2) {
             return first;
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
            if (subtitle.length > 3) {
                     // Try finding the full subtitle
                     let subMatch = candidates.find(c => {
                         const t = (c.title || "").toLowerCase();
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
                     
                     if (subMatch) return subMatch;
                }
        }
        
        // Fuzzy Match for Movies
        // If exact match failed, try to match by significant words
        // e.g. "One Piece Film Red" -> "One Piece Movie 15: Red"
        const clean = (str) => str.replace(/\b(film|movie|the|and|or|of|in|on|at|to|a|an)\b/gi, "").replace(/[^a-z0-9\s]/gi, "").replace(/\s+/g, " ").trim();
        const normClean = clean(normTitle);
        
        if (normClean.length > 3) { // Only if we have significant text
            const words = normClean.split(" ");
            
            // Find candidate with most matching words
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
                
                // Bonus for "Movie" or "Film" in title if query had it? No, stripped it.
                // But check if it's a "Movie" entity in title?
                if (cTitle.includes("movie") || cTitle.includes("film")) matches += 0.5;
                
                if (matches > maxMatches) {
                    maxMatches = matches;
                    bestCandidate = c;
                }
            }
            
            // Threshold: At least 75% of words matched
            if (bestCandidate && maxMatches >= words.length * 0.75) {
                 return bestCandidate;
            }
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
            return regex.test(t);
        });
        if (numberMatch) return numberMatch;

        // Check for Roman numerals
        const roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
        if (season < roman.length) {
            const romanStr = roman[season];
            const romanMatch = candidates.find(c => {
                const t = (c.title || "").toLowerCase();
                const regex = new RegExp(`\\b${romanStr}$|\\b${romanStr}\\b`, 'i');
                return regex.test(t);
            });
            if (romanMatch) return romanMatch;
        }
    } else {
        // Season 1: Prefer matches without numbers at end
        // Sort by length to prefer shorter titles
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

        const noNumberMatch = sorted.find(c => {
            const t = (c.title || "").trim();
            return !hasNumberSuffix(t);
        });
        
        if (noNumberMatch) {
            if (checkSimilarity(noNumberMatch.title, title) || checkSimilarity(noNumberMatch.title, originalTitle)) {
                 return noNumberMatch;
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

    return candidates[0];
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

async function fetchTooltipDate(tooltipUrl) {
    if (!tooltipUrl) return null;
    try {
        const url = `${BASE_URL}/${tooltipUrl}`;
        const response = await fetch(url, {
            headers: {
                "User-Agent": USER_AGENT,
                "Referer": BASE_URL,
                "X-Requested-With": "XMLHttpRequest"
            }
        });
        
        if (!response.ok) return null;
        const html = await response.text();
        
        // Extract Year from "Data di uscita: ... 20 Ottobre 1999"
        // Look for "Data di uscita:" label and then subsequent text
        const dateMatch = /Data di uscita:[\s\S]*?<span>([\s\S]*?)<\/span>/i.exec(html);
        if (dateMatch) {
            const dateStr = dateMatch[1].trim();
            // Try to extract year (last 4 digits)
            const yearMatch = /(\d{4})/.exec(dateStr);
            if (yearMatch) return yearMatch[1];
        }
        return null;
    } catch (e) {
        console.error("[AnimeWorld] Tooltip fetch error:", e);
        return null;
    }
}

async function getStreams(id, type, season, episode) {
    try {
        const metadata = await getMetadata(id, type);
        if (!metadata) {
            console.error("[AnimeWorld] Metadata not found for", id);
            return [];
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
                console.log(`[AnimeWorld] Special search: ${query}`);
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
                     console.log(`[AnimeWorld] Specific Season Name search: ${query}`);
                     const res = await searchAnime(query);
                     if (res && res.length > 0) {
                         console.log(`[AnimeWorld] Found matches for season name: ${query}`);
                         // Check if results are relevant
                         const valid = res.some(c => checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle));
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
                     const res = await searchAnime(query);
                     if (res && res.length > 0) {
                         // Check if results are relevant
                         const valid = res.some(c => checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle));
                         if (valid) {
                             candidates = res;
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
              
              // 0. Replace " - " with ": " (Common issue with TMDB titles like "One Piece Film - Red")
              if (title.includes(' - ')) {
                  const colonTitle = title.replace(' - ', ': ');
                  console.log(`[AnimeWorld] Colon search: ${colonTitle}`);
                  const colonRes = await searchAnime(colonTitle);
                  if (colonRes && colonRes.length > 0) variantCandidates.push(...colonRes);
              }

              // 1. Subtitle Search (if colon exists)
             if (title.includes(':')) {
                 const parts = title.split(':');
                 if (parts.length > 1) {
                     const subtitle = parts[parts.length - 1].trim();
                     if (subtitle.length > 3) {
                         console.log(`[AnimeWorld] Movie subtitle search: ${subtitle}`);
                         const subRes = await searchAnime(subtitle);
                         if (subRes && subRes.length > 0) variantCandidates.push(...subRes);
                         
                         // If subtitle contains "Part X", try searching without it
                         if (/part\s*\d+/i.test(subtitle)) {
                             const simpleSubtitle = subtitle.replace(/part\s*\d+/i, "").trim();
                             if (simpleSubtitle.length > 3) {
                                 console.log(`[AnimeWorld] Simplified subtitle search: ${simpleSubtitle}`);
                                 const simpleRes = await searchAnime(simpleSubtitle);
                                 if (simpleRes && simpleRes.length > 0) variantCandidates.push(...simpleRes);
                             }
                         }
                     }
                     
                     // Search "MainTitle Movie"
                     const mainTitle = parts[0].trim();
                     const movieQuery = `${mainTitle} Movie`;
                     console.log(`[AnimeWorld] Movie query search: ${movieQuery}`);
                     const movieRes = await searchAnime(movieQuery);
                     if (movieRes && movieRes.length > 0) variantCandidates.push(...movieRes);
                 }
             } else {
                  // 2. Try appending "Movie" or "Film" if not present
                  if (!title.toLowerCase().includes('movie')) {
                      const movieQuery = `${title} Movie`;
                      console.log(`[AnimeWorld] Movie query search: ${movieQuery}`);
                      const movieRes = await searchAnime(movieQuery);
                      if (movieRes && movieRes.length > 0) variantCandidates.push(...movieRes);
                  }
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
        if ((!candidates || candidates.length === 0) && originalTitle && originalTitle !== title) {
            console.log(`[AnimeWorld] Trying original title: ${originalTitle}`);
            candidates = await searchAnime(originalTitle);
            
            // Check relevance
            if (candidates.length > 0) {
                const valid = candidates.some(c => {
                    if (checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle)) return true;
                    if (metadata.alternatives) {
                        return metadata.alternatives.some(alt => checkSimilarity(c.title, alt.title));
                    }
                    return false;
                });
                
                if (!valid) {
                    console.log("[AnimeWorld] Original title search results seem irrelevant. Discarding.");
                    candidates = [];
                }
            }
        }

        // Strategy 4: Alternative Titles Search
        if ((!candidates || candidates.length === 0) && metadata.alternatives) {
             const altTitles = metadata.alternatives
                 .map(t => t.title)
                 .filter(t => /^[a-zA-Z0-9\s\-\.\:\(\)]+$/.test(t)) // Only Latin chars
                 .filter(t => t !== title && t !== originalTitle);
             
             const uniqueAlts = [...new Set(altTitles)];
             
             for (const altTitle of uniqueAlts) {
                 if (altTitle.length < 4) continue;
                 
                 console.log(`[AnimeWorld] Trying alternative title: ${altTitle}`);
                 const res = await searchAnime(altTitle);
                 
                 if (res && res.length > 0) {
                      const valid = res.some(c => {
                          if (checkSimilarity(c.title, title) || checkSimilarity(c.title, originalTitle)) return true;
                          if (metadata.alternatives) {
                              return metadata.alternatives.some(alt => checkSimilarity(c.title, alt.title));
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
            // Only process top 3 candidates to avoid too many requests
            const top = list.slice(0, 3);
            for (const c of top) {
                if (!c.date && c.tooltipUrl) {
                    const year = await fetchTooltipDate(c.tooltipUrl);
                    if (year) c.date = year;
                }
            }
            return top;
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
                
                const aTagRegex = /<a[^>]+data-episode-num="([^"]+)"[^>]+data-id="([^"]+)"[^>]*>/g;
                let epMatch;
                
                // Since attribute order is not guaranteed, we should use a more robust parsing
                // But typically it's consistent. Let's assume standard order or try both.
                // Or better: find all <a> tags with data-episode-num, then extract ID from them.
                
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
                if (type === "movie") {
                    // For movies, just take the first available episode/stream
                    if (episodes.length > 0) {
                        targetEp = episodes[0];
                    }
                } else {
                    targetEp = episodes.find(e => e.num == episode);
                }
                
                // Fallback to absolute episode if not found and season > 1
                if (!targetEp && season > 1) {
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
                            if (infoData.grabber.includes("1080p")) quality = "1080p";
                            else if (infoData.grabber.includes("720p")) quality = "720p";
                            else if (infoData.grabber.includes("480p")) quality = "480p";
                            else if (infoData.grabber.includes("360p")) quality = "360p";

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
                            if (episode) {
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

        return results;

    } catch (e) {
        console.error("[AnimeWorld] getStreams error:", e);
        return [];
    }
}

module.exports = {
    getStreams,
    searchAnime
};
