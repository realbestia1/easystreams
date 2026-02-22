const { extractVixCloud } = require('../extractors');

const BASE_URL = "https://www.animeunity.so";
const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

async function getMetadata(id, type) {
    try {
        const normalizedType = String(type).toLowerCase();
        let tmdbId = id;

        // If it's an IMDb ID, find the TMDB ID first
        if (String(id).startsWith("tt")) {
            const findUrl = `https://api.themoviedb.org/3/find/${id}?api_key=${TMDB_API_KEY}&external_source=imdb_id&language=it-IT`;
            const findResponse = await fetch(findUrl);
            if (!findResponse.ok) return null;
            const findData = await findResponse.json();
            const results = normalizedType === "movie" ? findData.movie_results : findData.tv_results;
            if (!results || results.length === 0) return null;
            tmdbId = results[0].id;
        }

        const endpoint = normalizedType === "movie" ? "movie" : "tv";
        const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=it-IT`;
        
        const response = await fetch(url);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.error("[AnimeUnity] Metadata error:", e);
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

function findBestMatch(candidates, title, originalTitle, season, metadata, options = {}) {
    if (!candidates || candidates.length === 0) return null;

    // Filter candidates based on metadata type
    const isTv = !!metadata.name; // TV shows have 'name', movies have 'title'
        
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
        return t === normTitle || te === normTitle || 
               (normOriginal && (t === normOriginal || te === normOriginal));
    });

    // Filter by Year if available (only for Season 1 or Movies)
    const metaYear = metadata.first_air_date ? parseInt(metadata.first_air_date.substring(0, 4)) : 
                     (metadata.release_date ? parseInt(metadata.release_date.substring(0, 4)) : null);
    
    if (metaYear && (season === 1 || !isTv)) {
        const yearFiltered = filteredCandidates.filter(c => {
            if (!c.date || c.date === "Indeterminato" || c.date === "?") return true; 
            const match = c.date.match(/(\d{4})/);
            if (match) {
                const cYear = parseInt(match[1]);
                return Math.abs(cYear - metaYear) <= 2; 
            }
            return true;
        });
        
        if (yearFiltered.length > 0) {
            filteredCandidates = yearFiltered;
        } else if (filteredCandidates.length > 0) {
             // If strictly filtered out, return null to avoid bad match
             return null;
        }
    }

    // Check if we lost all exact matches due to year filtering
    if (preYearExactMatches.length > 0) {
         const anyExactMatchSurvived = filteredCandidates.some(c => 
             preYearExactMatches.some(pym => pym.id === c.id)
         );
         if (!anyExactMatchSurvived) {
             console.log("[AnimeUnity] All exact matches rejected by year filter. Returning null to avoid mismatch.");
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

    // If season === 0, prioritize Special/OVA/Movie
    if (season === 0) {
        const specialTypes = ['Special', 'OVA', 'Movie'];
        // Filter candidates that are special types
        const specialCandidates = filteredCandidates.filter(c => specialTypes.includes(c.type));
        
        if (specialCandidates.length > 0) {
            // Try to find one with "Special" in title if multiple
            const specialTitleMatch = specialCandidates.find(c => (c.title || "").includes("Special") || (c.title_eng || "").includes("Special"));
            if (specialTitleMatch) return specialTitleMatch;
            
            // Otherwise return the first special candidate (maybe sort by similarity?)
            return specialCandidates[0];
        }
        
        // If no special type found, look for "Special" in title of any candidate
        const titleMatch = filteredCandidates.find(c => (c.title || "").includes("Special") || (c.title_eng || "").includes("Special"));
        if (titleMatch) return titleMatch;
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
    }

    // If season > 1, we expect the title to potentially differ
    if (season > 1) {
        const seasonStr = String(season);
        
        // Check for numeric suffix or "Season X"
        const numberMatch = filteredCandidates.find(c => {
            const t = (c.title || "").toLowerCase();
            const te = (c.title_eng || "").toLowerCase();
            const regex = new RegExp(`\\b${seasonStr}$|\\b${seasonStr}\\b|season ${seasonStr}|stagione ${seasonStr}`, 'i');
            return regex.test(t) || regex.test(te);
        });
        if (numberMatch) return numberMatch;

        // Check for Roman numerals
        const roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
        if (season < roman.length) {
            const romanStr = roman[season];
            const romanMatch = filteredCandidates.find(c => {
                const t = (c.title || "").toLowerCase();
                const te = (c.title_eng || "").toLowerCase();
                const regex = new RegExp(`\\b${romanStr}$|\\b${romanStr}\\b`, 'i');
                return regex.test(t) || regex.test(te);
            });
            if (romanMatch) return romanMatch;
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
            return !hasNumberSuffix(t) && !hasNumberSuffix(te);
        });
        
        if (noNumberMatch) return noNumberMatch;
        
        // If all have numbers, return the shortest one (or first sorted)
        return sorted[0];
    }

    return filteredCandidates[0];
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

async function getStreams(id, type, season, episode) {
    try {
        const metadata = await getMetadata(id, type);
        if (!metadata) {
            console.error("[AnimeUnity] Metadata not found for", id);
            return [];
        }

        const title = metadata.title || metadata.name;
        const originalTitle = metadata.original_title || metadata.original_name;
        
        console.log(`[AnimeUnity] Searching for: ${title} (Season ${season})`);
        
        let candidates = [];
        let seasonNameMatch = false;

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

        // Strategy 1: If season > 1, try specific search "Title Season" and "Season Name"
        if (season > 1) {
             const searchQueries = [
                 `${title} ${season}`,
                 `${title} Season ${season}`,
                 `${title} Stagione ${season}`
             ];
             
             // Try original title too if different
             if (originalTitle && originalTitle !== title) {
                 searchQueries.push(`${originalTitle} ${season}`);
             }

             // Try TMDB Season Name (e.g. "Diamond is Unbreakable")
             const seasonMeta = await getSeasonMetadata(metadata.id, season);
             if (seasonMeta && seasonMeta.name && !seasonMeta.name.match(/^Season \d+|^Stagione \d+/i)) {
                 console.log(`[AnimeUnity] Found season name: ${seasonMeta.name}`);
                 // Try searching for Season Name alone or with Title
                 const seasonQueries = [
                     `${title} ${seasonMeta.name}`, // "Le bizzarre... Diamond is Unbreakable"
                     seasonMeta.name // "Diamond is Unbreakable"
                 ];

                 for (const query of seasonQueries) {
                     console.log(`[AnimeUnity] Specific Season Name search: ${query}`);
                     const res = await searchAnime(query);
                     if (res && res.length > 0) {
                         console.log(`[AnimeUnity] Found matches for season name: ${query}`);
                         candidates = res;
                         seasonNameMatch = true;
                         break;
                     }
                 }
             }
             
             if (!seasonNameMatch) {
                 for (const query of searchQueries) {
                     console.log(`[AnimeUnity] Specific search: ${query}`);
                     const res = await searchAnime(query);
                     if (res && res.length > 0) {
                         candidates = res;
                         break;
                     }
                 }
             }
        }

        const isMovie = (metadata.genres && metadata.genres.some(g => g.name === 'Movie')) || season === 0 || type === 'movie';
        
        if (candidates.length === 0) {
             console.log(`[AnimeUnity] Standard search: ${title}`);
             candidates = await searchAnime(title);

             // Strategy 2.5: If type is movie and no results or just to be sure, try subtitle/movie variants
             if (candidates.length === 0 && isMovie) {
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
                 }
                 
                 // Remove duplicates
                 candidates = candidates.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
             }
        }

        // Strategy 3: Original title search
        if ((!candidates || candidates.length === 0) && originalTitle && originalTitle !== title) {
            console.log(`[AnimeUnity] No results for ${title}, trying ${originalTitle}`);
            candidates = await searchAnime(originalTitle);
        }

        if (!candidates || candidates.length === 0) {
            console.log("[AnimeUnity] No anime found");
            return [];
        }

        const subs = candidates.filter(c => !(c.title || "").includes("(ITA)") && !(c.title_eng || "").includes("(ITA)"));
        const dubs = candidates.filter(c => (c.title || "").includes("(ITA)") || (c.title_eng || "").includes("(ITA)"));

        let bestSub = findBestMatch(subs, title, originalTitle, season, metadata, { bypassSeasonCheck: seasonNameMatch });
        let bestDub = findBestMatch(dubs, title, originalTitle, season, metadata, { bypassSeasonCheck: seasonNameMatch });

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
                 const betterDub = findBestMatch(newDubs, title, originalTitle, season, metadata);
                 if (betterDub) bestDub = betterDub;
            }
        }

        if (!bestSub && !bestDub) {
            console.log("[AnimeUnity] No suitable match found in candidates");
            return [];
        }

        const tasks = [];
        const absEpisode = calculateAbsoluteEpisode(metadata, season, episode);

        if (bestSub) {
            console.log(`[AnimeUnity] Found SUB match: ${bestSub.title || bestSub.title_eng} (ID: ${bestSub.id})`);
            // Check if it's likely a specific season/arc entry or the main series
            const isSeasonEntry = season === 1 || seasonNameMatch || 
                /season|stagione|part|parte|\b\d+\b/i.test(bestSub.title || "") ||
                /season|stagione|part|parte|\b\d+\b/i.test(bestSub.title_eng || "");
            
            const epToUse = isSeasonEntry ? episode : absEpisode;
            console.log(`[AnimeUnity] Using episode ${epToUse} for SUB (Is Season Entry: ${isSeasonEntry})`);
            tasks.push(getEpisodeStreams(bestSub, epToUse, "SUB ITA"));
        }
        if (bestDub) {
            console.log(`[AnimeUnity] Found DUB match: ${bestDub.title || bestDub.title_eng} (ID: ${bestDub.id})`);
            const isSeasonEntry = season === 1 || seasonNameMatch || 
                /season|stagione|part|parte|\b\d+\b/i.test(bestDub.title || "") ||
                /season|stagione|part|parte|\b\d+\b/i.test(bestDub.title_eng || "");
            
            const epToUse = isSeasonEntry ? episode : absEpisode;
            console.log(`[AnimeUnity] Using episode ${epToUse} for DUB (Is Season Entry: ${isSeasonEntry})`);
            tasks.push(getEpisodeStreams(bestDub, epToUse, "ITA"));
        }

        const results = await Promise.all(tasks);
        return results.flat();

    } catch (e) {
        console.error("[AnimeUnity] Error:", e);
        return [];
    }
}

async function getEpisodeStreams(anime, episodeNumber, langTag = "") {
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

        let targetEpisode = episodes.find(ep => ep.number == episodeNumber);

        if (!targetEpisode && totalEpisodes > episodes.length) {
            console.log(`[AnimeUnity] Episode ${episodeNumber} not found in initial list. Checking API...`);
            
            // Calculate range
            const startRange = Math.floor((episodeNumber - 1) / 120) * 120 + 1;
            const endRange = startRange + 119;
            
            if (startRange > episodes.length || (startRange <= episodes.length && episodeNumber > episodes[episodes.length-1].number)) {
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
                console.log(`First ep: ${episodes[0].number}, Last ep: ${episodes[episodes.length-1].number}`);
            }
            return [];
        }

        const streams = [];
        const labelSuffix = langTag ? ` [${langTag}]` : "";

        // Helper to extract quality
        const extractQuality = (str) => {
            if (!str) return "Unknown";
            const match = str.match(/(\d{3,4}p)/i);
            return match ? match[1] : "Unknown";
        };

        // 1. Direct Link
        if (targetEpisode.link && targetEpisode.link.startsWith("http")) {
            let quality = extractQuality(targetEpisode.link);
            if (quality === "Unknown") quality = extractQuality(targetEpisode.file_name);
            
            streams.push({
                name: "AnimeUnity" + labelSuffix,
                title: `${anime.title} - Ep ${episodeNumber}${labelSuffix}`,
                url: targetEpisode.link,
                quality: quality,
                type: "direct",
                headers: {
                    "User-Agent": USER_AGENT,
                    "Referer": BASE_URL
                }
            });
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
                            streams.push(...vixStreams.map(s => ({
                                ...s,
                                name: "AnimeUnity - VixCloud" + labelSuffix,
                                title: `${anime.title} - Ep ${episodeNumber}${labelSuffix}`
                            })));
                        }
                    }
                }
            } catch (e) {
                console.error("[AnimeUnity] VixCloud extraction error:", e);
            }
        }

        return streams;
    } catch (e) {
        console.error(`[AnimeUnity] Error extracting streams for ${anime.title}:`, e);
        return [];
    }
}

module.exports = { getStreams, getMetadata, searchAnime };
