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
const BASE_URL = "https://eurostreaming.luxe";
const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

const { extractMixDrop, extractDropLoad, extractSuperVideo, extractStreamTape, extractVidoza, extractUqload, extractUpstream } = require('../extractors');
const { checkQualityFromPlaylist } = require('../quality_helper.js');
const { getSeasonEpisodeFromAbsolute, getTmdbFromKitsu } = require('../tmdb_helper.js');
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
      console.error("[EuroStreaming] Conversion error:", e);
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
      console.error("[EuroStreaming] TMDB error:", e);
      return null;
    }
  });
}

function extractDeltaBit(url) {
  return __async(this, null, function* () {
    try {
      if (url.startsWith("//")) url = "https:" + url;
      const response = yield fetch(url);
      if (!response.ok) return null;
      const html = yield response.text();
      const packedRegex = /eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
      const match = packedRegex.exec(html);
      if (match) {
        const p = match[1];
        const a = parseInt(match[2]);
        const c = parseInt(match[3]);
        const k = match[4].split("|");
        const unpacked = unPack(p, a, c, k, null, {});
        const fileMatch = unpacked.match(/file:\s*"(.*?)"/);
        if (fileMatch) {
          return fileMatch[1];
        }
      }
      return null;
    } catch (e) {
      console.error("[EuroStreaming] DeltaBit extraction error:", e);
      return null;
    }
  });
}
function searchShow(query) {
  return __async(this, null, function* () {
    try {
      console.log(`[EuroStreaming] Searching for: ${query}`);
      const params = new URLSearchParams();
      params.append("do", "search");
      params.append("subaction", "search");
      params.append("story", query);
      const response = yield fetch(`${BASE_URL}/index.php?${params.toString()}`, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": BASE_URL
        }
      });
      if (!response.ok) return [];
      const html = yield response.text();
      const resultRegex = /<div class="post-thumb">\s*<a href="([^"]+)" title="([^"]+)">/g;
      let match;
      const results = [];
      while ((match = resultRegex.exec(html)) !== null) {
        results.push({
          url: match[1],
          title: match[2]
        });
      }
      if (results.length === 0) {
        console.log(`[EuroStreaming] No results found for query: "${query}"`);
        return [];
      }
      console.log(`[EuroStreaming] Search results for "${query}": ${results.length} found`);
      const candidates = [];
      const lowerQuery = query.toLowerCase();
      const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, "");
      const normalizedQuery = normalize(query);
      results.forEach((r) => {
        let score = 0;
        const lowerTitle = r.title.toLowerCase();
        const normalizedTitle = normalize(r.title);
        if (lowerTitle === lowerQuery) {
          score = 100;
        } else if (lowerTitle.startsWith(lowerQuery)) {
          score = 80;
        } else if (normalizedTitle.includes(normalizedQuery)) {
          score = 60;
        } else {
          try {
            const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const wordRegex = new RegExp(`\\b${escapedQuery}\\b`, "i");
            if (wordRegex.test(r.title)) {
              score = 70;
            } else {
              score = 10;
            }
          } catch (e) {
            score = 10;
          }
        }
        candidates.push(__spreadProps(__spreadValues({}, r), { score }));
      });
      return candidates.sort((a, b) => b.score - a.score);
    } catch (e) {
      console.error("[EuroStreaming] Search error:", e);
      return [];
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
      if (type === "tv" && ((_b = data.tv_results) == null ? void 0 : _b.length) > 0) return data.tv_results[0].id;
      return null;
    } catch (e) {
      console.error("[EuroStreaming] ID conversion error:", e);
      return null;
    }
  });
}

async function verifyCandidateWithTmdb(title, targetTmdbId, type) {
    try {
        const searchUrl = `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(title)}&api_key=${TMDB_API_KEY}&language=it-IT`;
        const response = await fetch(searchUrl);
        if (!response.ok) return true; 
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            // Check if the top result matches our target ID
            const topResult = data.results[0];
            if (String(topResult.id) === String(targetTmdbId)) {
                return true;
            }
            
            // If top result is different, it might be a wrong match (e.g. Live Action vs Anime)
            console.log(`[EuroStreaming] Title verification mismatch: Candidate "${title}" maps to ID ${topResult.id} (${topResult.name || topResult.title}), but expected ${targetTmdbId}`);
            return false;
        }
        return true; // No results found, give benefit of doubt
    } catch (e) {
        console.error("[EuroStreaming] Verification error:", e);
        return true;
    }
}

async function verifyMoviePlayer(url, targetYear) {
    try {
        console.log(`[EuroStreaming] Verifying via MoviePlayer: ${url}`);
        const response = await fetch(url, {
            headers: {
                "User-Agent": USER_AGENT
            }
        });
        if (!response.ok) return false;
        const html = await response.text();
        
        // Look for "trasmessa dal YYYY" or "Prima messa in onda originale ... YYYY"
        // Pattern 1: trasmessa dal 2008
        const yearMatch1 = html.match(/trasmessa dal (\d{4})/i);
        if (yearMatch1) {
            const foundYear = parseInt(yearMatch1[1]);
            if (Math.abs(foundYear - targetYear) <= 1) {
                console.log(`[EuroStreaming] MoviePlayer verified year ${foundYear} (Target: ${targetYear})`);
                return true;
            }
        }

        // Pattern 2: Prima messa in onda originale ... YYYY
        const yearMatch2 = html.match(/Prima messa in onda originale.*?(\d{4})/i);
        if (yearMatch2) {
             const foundYear = parseInt(yearMatch2[1]);
             if (Math.abs(foundYear - targetYear) <= 1) {
                console.log(`[EuroStreaming] MoviePlayer verified year ${foundYear} (Target: ${targetYear})`);
                return true;
            }
        }

        // Pattern 3: Title (YYYY)
        const titleMatch = html.match(/<title>.*\(.*(\d{4}).*\).*<\/title>/is);
        if (titleMatch) {
             const foundYear = parseInt(titleMatch[1]);
             // Allow a wider range for title year as it might be end year, but usually start year is mentioned
             if (Math.abs(foundYear - targetYear) <= 2) { 
                 console.log(`[EuroStreaming] MoviePlayer verified title year ${foundYear} (Target: ${targetYear})`);
                 return true;
             }
        }
        
        console.log(`[EuroStreaming] MoviePlayer verification failed. Target Year: ${targetYear}`);
        return false;
    } catch (e) {
        console.error("[EuroStreaming] MoviePlayer error:", e);
        return false;
    }
}

function getStreams(id, type, season, episode, showInfo) {
  if (['movie'].includes(String(type).toLowerCase())) return [];
  return __async(this, null, function* () {
    try {
      let tmdbId = id;
      let imdbId = null;

      if (id.toString().startsWith("tt")) {
        imdbId = id.toString();
        tmdbId = yield getTmdbIdFromImdb(id, type);
        if (!tmdbId) {
          console.log(`[EuroStreaming] Could not convert ${id} to TMDB ID`);
          return [];
        }
      } else if (id.toString().startsWith("kitsu:")) {
          const resolved = yield getTmdbFromKitsu(id);
          if (resolved && resolved.tmdbId) {
             tmdbId = resolved.tmdbId;
             if (resolved.season) {
                 console.log(`[EuroStreaming] Kitsu mapping indicates Season ${resolved.season}. Overriding requested Season ${season}`);
                 season = resolved.season;
             }
             console.log(`[EuroStreaming] Resolved Kitsu ID ${id} to TMDB ID ${tmdbId}, Season ${season}`);
          } else {
             console.log(`[EuroStreaming] Could not convert ${id} to TMDB ID`);
             return [];
          }
      } else if (id.toString().startsWith("tmdb:")) {
        tmdbId = id.toString().replace("tmdb:", "");
      }

      // Resolve IMDb ID for verification if we don't have it yet
      if (!imdbId && tmdbId) {
          try {
              const resolvedImdb = yield getImdbId(tmdbId, type);
              if (resolvedImdb) {
                  imdbId = resolvedImdb;
                  console.log(`[EuroStreaming] Resolved TMDB ID ${tmdbId} to IMDb ID ${imdbId} for verification`);
              }
          } catch (e) {
              console.log(`[EuroStreaming] Failed to resolve IMDb ID for verification: ${e.message}`);
          }
      }
      let fetchedShowInfo = showInfo;
      if (!fetchedShowInfo) {
        fetchedShowInfo = yield getShowInfo(tmdbId, type);
      }
      if (!fetchedShowInfo) {
        console.log(`[EuroStreaming] Could not get show info for ${tmdbId}`);
        return [];
      }
      const cleanTitle = fetchedShowInfo.name || fetchedShowInfo.title || fetchedShowInfo.original_name || fetchedShowInfo.original_title || "Serie TV";
      const titlesToTry = [];
      if (fetchedShowInfo.name) titlesToTry.push(fetchedShowInfo.name);
      if (fetchedShowInfo.title) titlesToTry.push(fetchedShowInfo.title);
      if (fetchedShowInfo.original_name) titlesToTry.push(fetchedShowInfo.original_name);
      if (fetchedShowInfo.original_title) titlesToTry.push(fetchedShowInfo.original_title);
      const uniqueTitles = [...new Set(titlesToTry.filter(Boolean))];
      const allCandidates = [];
      for (const t of uniqueTitles) {
        console.log(`[EuroStreaming] Searching title: ${t}`);
        const results = yield searchShow(t);
        if (results && results.length > 0) {
          allCandidates.push(...results);
        }
      }
      const uniqueCandidates = [];
      const seenUrls = /* @__PURE__ */ new Set();
      allCandidates.sort((a, b) => b.score - a.score);
      for (const c of allCandidates) {
        if (!seenUrls.has(c.url)) {
          seenUrls.add(c.url);
          uniqueCandidates.push(c);
        }
      }
      if (uniqueCandidates.length === 0) {
        console.log(`[EuroStreaming] No candidates found for any title of ${tmdbId}`);
        return [];
      }
      const topCandidates = uniqueCandidates.slice(0, 3);
      console.log(`[EuroStreaming] Testing ${topCandidates.length} candidates for ${tmdbId}`);
      const streams = [];
      const promises = [];

      let mappedSeason = null;
      let mappedEpisode = null;

      if (season === 1 && episode > 20 && tmdbId) {
        try {
          const mapped = yield getSeasonEpisodeFromAbsolute(tmdbId, episode);
          if (mapped) {
            console.log(`[EuroStreaming] Mapped absolute episode ${episode} to Season ${mapped.season}, Episode ${mapped.episode}`);
            mappedSeason = mapped.season;
            mappedEpisode = mapped.episode;
          }
        } catch (e) {
          console.error("[EuroStreaming] Error mapping episode:", e);
        }
      }

      for (const candidate of topCandidates) {
        promises.push(() => __async(null, null, function* () {
          try {
            console.log(`[EuroStreaming] Checking candidate: ${candidate.title} (${candidate.url})`);
            const response = yield fetch(candidate.url, {
              headers: {
                "User-Agent": USER_AGENT,
                "Referer": BASE_URL
              }
            });
            if (!response.ok) {
              console.log(`[EuroStreaming] Failed to fetch candidate page: ${response.status}`);
              return;
            }
            const html = yield response.text();

            let isVerified = false;

            // 1. Check for TMDB Link (Strongest verification)
            // Example link: https://www.themoviedb.org/tv/37854-one-piece
            const tmdbLinkMatches = html.match(/themoviedb\.org\/(?:tv|movie)\/(\d+)/g);
            if (tmdbLinkMatches) {
                 const foundIds = tmdbLinkMatches.map(l => {
                     const m = l.match(/\/(\d+)/);
                     return m ? m[1] : null;
                 }).filter(Boolean);
                 
                 if (foundIds.includes(String(tmdbId))) {
                     console.log(`[EuroStreaming] Verified candidate ${candidate.title} via TMDB link.`);
                     isVerified = true;
                 }
            }

            // 1.5 Check for MoviePlayer.it link (if not verified)
            if (!isVerified) {
                const mpLinkMatch = html.match(/href=["'](https?:\/\/(?:www\.)?movieplayer\.it\/serietv\/[^"']+)["']/i);
                if (mpLinkMatch) {
                    const mpUrl = mpLinkMatch[1];
                    const targetYear = fetchedShowInfo && (fetchedShowInfo.first_air_date || fetchedShowInfo.release_date) 
                        ? parseInt((fetchedShowInfo.first_air_date || fetchedShowInfo.release_date).substring(0, 4)) 
                        : null;
                    
                    if (targetYear) {
                         const mpVerified = yield verifyMoviePlayer(mpUrl, targetYear);
                         if (mpVerified) {
                             isVerified = true;
                             console.log(`[EuroStreaming] Verified candidate ${candidate.title} via MoviePlayer link.`);
                         }
                    }
                }
            }

            // 2. Check for IMDb ID (if not already verified)
            if (!isVerified && imdbId) {
              const targetImdbId = imdbId;
              const imdbMatches = html.match(/tt\d{7,8}/g);
              
              if (imdbMatches && imdbMatches.length > 0) {
                const hasTargetId = imdbMatches.some((match) => match === targetImdbId);
                if (hasTargetId) {
                  console.log(`[EuroStreaming] Verified candidate ${candidate.title} with IMDB ID match.`);
                  isVerified = true;
                } else {
                  // Allow mismatch if it's "One Piece - All'arrembaggio!" which is a known alias/dub
                  // But wait, "All'arrembaggio!" matches TMDB 37854 / tt0388629?
                  // The site might link to a different IMDB ID for the dub version?
                  // tt11737520 is "One Piece: All'arrembaggio!" (TV Series 2001– )?
                  // Actually tt0388629 is the main One Piece series.
                  // If we are looking for One Piece, and find "All'arrembaggio", we should probably accept it if the year matches or title is very close.
                  
                  // Let's check title similarity + year if IMDB fails
                  console.log(`[EuroStreaming] IMDB ID mismatch for ${candidate.title}. Found: ${imdbMatches.join(", ")}`);
                }
              }
            }

            // 3. Fallback: Title/Reverse Verification (if not yet verified)
            if (!isVerified) {
                // Special case for One Piece
                if (cleanTitle.includes("One Piece") && candidate.title.includes("All'arrembaggio")) {
                     console.log(`[EuroStreaming] Accepting "All'arrembaggio" as valid alias for One Piece.`);
                     isVerified = true;
                } else {
                     console.log(`[EuroStreaming] No direct ID match found for ${candidate.title}. Verifying via TMDB search...`);
                     const isTitleMatch = yield verifyCandidateWithTmdb(candidate.title, tmdbId, type);
                     if (isTitleMatch) {
                         console.log(`[EuroStreaming] Verified candidate ${candidate.title} via reverse TMDB search.`);
                         isVerified = true;
                     }
                }
            }

            if (!isVerified) {
                 console.log(`[EuroStreaming] Skipping candidate ${candidate.title} - Verification failed.`);
                 return;
            }

            // Look for episode links
            // EuroStreaming usually has links like: 
            // <a href="#" onclick="go_to_player('...')" ...>1x01</a>
            // or plain text lists.
            
            // Standard format: 1x250 or 1x250
             const epPattern1 = new RegExp(`${season}x${episode}\\b`, 'i'); // 1x250
             const epPattern2 = new RegExp(`${season}\\s*x\\s*${episode}\\b`, 'i'); // 1 x 250
             
             let epPatternMapped1 = null;
             let epPatternMapped2 = null;
             
             if (mappedSeason) {
                 epPatternMapped1 = new RegExp(`${mappedSeason}x${mappedEpisode}\\b`, 'i');
                 epPatternMapped2 = new RegExp(`${mappedSeason}\\s*x\\s*${mappedEpisode}\\b`, 'i');
             }
             
             // Also check for absolute episode if season 1
             let epPattern3 = null;
             if (season === 1) {
                  epPattern3 = new RegExp(`Episode\\s*${episode}\\b`, 'i');
             }
 
             let episodeMatch = epPattern1.exec(html) || epPattern2.exec(html);
             
             if (!episodeMatch && epPatternMapped1) {
                 episodeMatch = epPatternMapped1.exec(html) || epPatternMapped2.exec(html);
                 if (episodeMatch) console.log(`[EuroStreaming] Found mapped episode ${mappedSeason}x${mappedEpisode}`);
             }
             
             if (!episodeMatch && epPattern3) {
                 episodeMatch = epPattern3.exec(html);
             }

             if (!episodeMatch) {
               // Try less strict search for episodes
               // Sometimes episodes are just numbers in a list, especially for anime
               // But EuroStreaming is messy.
               
               // Try to find any "1x250" or "1 x 250" in text content
               // It might be inside a div or span
               console.log(`[EuroStreaming] Episode ${season}x${episode} not found with regex. Scanning content...`);
             }

             // EuroStreaming structure is complex. It often has a "server" list.
             // But for simplicity, let's try to extract any link that looks like it belongs to this episode.
             
             // If we found the episode string, we need to find the associated links.
             // This is hard without a DOM parser.
             
             // Let's assume the previous logic was somewhat correct but too strict.
             // The previous logic looked for data-num="1x01".
             
             // Let's try to find where "1x250" appears and look for links nearby.
             
             // Actually, EuroStreaming often has:
             // <div class="box-links"> ... <a href="...">1x01</a> ... </div>
             // OR
             // 1x01 - <a href="...">Link</a>
             
             // Let's search for the episode string index
             let epString1 = `${season}x${episode}`;
             let epString2 = `${season}x${episode.toString().padStart(2, '0')}`;
             
             if (mappedSeason) {
                 // Try mapped strings first
                 const mappedStr1 = `${mappedSeason}x${mappedEpisode}`;
                 const mappedStr2 = `${mappedSeason}x${mappedEpisode.toString().padStart(2, '0')}`;
                 if (html.indexOf(mappedStr1) !== -1) {
                     epString1 = mappedStr1;
                     epString2 = mappedStr2; // Just in case
                 } else if (html.indexOf(mappedStr2) !== -1) {
                     epString1 = mappedStr2;
                     epString2 = mappedStr1;
                 }
             }
             
             let searchIndex = html.indexOf(epString1);
             if (searchIndex === -1) searchIndex = html.indexOf(epString2);
             
             if (searchIndex === -1 && season === 1) {
                  // Try just episode number for long running anime?
                  // Risky, might match other things.
                  // But for "One Piece", episodes are often just "250".
                  // Let's try searching for "Episodio 250" or "Ep. 250"
                  const epString3 = `Episodio ${episode}`;
                  const epString4 = `Ep. ${episode}`;
                  
                  searchIndex = html.indexOf(epString3);
                  if (searchIndex === -1) searchIndex = html.indexOf(epString4);
             }

             if (searchIndex === -1) {
                  console.log(`[EuroStreaming] Episode ${season}x${episode} not found in content.`);
                  return;
             }
             
             console.log(`[EuroStreaming] Found episode marker at index ${searchIndex}`);
             
             // Look for links after this index, but before the next episode
             // This is heuristic and fragile.
             
             // Better approach: Extract all links and their text, then fuzzy match.
             const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
             let linkMatch;
             const potentialLinks = [];
             
             while ((linkMatch = linkRegex.exec(html)) !== null) {
                 const href = linkMatch[1];
                 const text = linkMatch[2].replace(/<[^>]+>/g, '').trim(); // Remove tags
                 
                 // Check if text contains our episode
                 if (text.includes(epString1) || text.includes(epString2)) {
                     potentialLinks.push(href);
                 } else if (season === 1 && (text.includes(`Episodio ${episode}`) || text.includes(`Ep. ${episode}`))) {
                      potentialLinks.push(href);
                 } else {
                     // Sometimes the link text is just "WStream", "DeltaBit", etc.
                     // And the episode number is in a preceding header or div.
                     // This is too hard to parse with regex alone for all cases.
                 }
             }
             
             if (potentialLinks.length > 0) {
                 console.log(`[EuroStreaming] Found ${potentialLinks.length} direct links for episode.`);
                 // Process these links
                 for (const link of potentialLinks) {
                      // ... (extraction)
                      // EuroStreaming links are often intermediate pages or direct host links
                      // If it's an intermediate page, we need to fetch it?
                      // Usually EuroStreaming links in the episode list point to the player page or are direct.
                      
                      // Actually, EuroStreaming usually has a list of servers for an episode.
                      // 1x01 -> Link1, Link2
                      
                      // Let's assume for now we can't easily parse the specific episode links if they are not clearly labeled.
                      // But "One Piece" on EuroStreaming usually has a massive list.
                 }
             }
             
             // Fallback: If no direct links found, maybe the page IS the episode page?
             // Or maybe we need to use the old logic if it works for standard series.
             
             // Let's try to grab ALL links that look like streaming providers near the episode match.
             // Scan 1000 chars after the match?
             const scanWindow = html.substring(searchIndex, searchIndex + 2000);
             console.log(`[EuroStreaming] Scan window content (first 200 chars): ${scanWindow.substring(0, 200)}...`);
             
             // Extract any known provider links from this window
             const providerPatterns = [
                 /delta-bit\.net\/embed\/[^"']+/i,
                 /deltabit\.co\/embed\/[^"']+/i,
                 /uqload\.(?:com|io|co)\/embed-[^"']+/i,
                 /mixdrop\.(?:co|to|ch)\/e\/[^"']+/i,
                 /swzz\.(?:co|to|ch)\/e\/[^"']+/i,
                 /dropload\.(?:io|pro|co)\/e\/[^"']+/i,
                 /dropload\.(?:io|pro|co)\/[^"']+/i,
                 /supervideo\.(?:tv|cc)\/e\/[^"']+/i,
                 /supervideo\.(?:tv|cc)\/[^"']+/i,
                 /upstream\.(?:to|co)\/embed-[^"']+/i,
                 /upstream\.(?:to|co)\/[^"']+/i,
                 /vidoza\.net\/embed-[^"']+/i
             ];
             
             // Also look for `go_to_player` calls
             // onclick="go_to_player('https://...')"
             const goToPlayerMatches = scanWindow.matchAll(/go_to_player\(['"]([^'"]+)['"]\)/g);
             for (const m of goToPlayerMatches) {
                 potentialLinks.push(m[1]);
             }
             
             // Look for hrefs and data-link
             const linkMatches = scanWindow.matchAll(/(?:href|data-link)=["'](https?:\/\/[^"']+)["']/g);
             for (const m of linkMatches) {
                 const url = m[1];
                 if (providerPatterns.some(p => p.test(url)) || 
                     url.includes("dropload") || 
                     url.includes("supervideo") || 
                     url.includes("upstream") || 
                     url.includes("mixdrop") ||
                     url.includes("delta") ||
                     url.includes("uqload")) {
                     potentialLinks.push(url);
                 }
             }

             console.log(`[EuroStreaming] Found ${potentialLinks.length} potential stream links.`);
             
             const uniqueLinks = [...new Set(potentialLinks)];
             
             for (const link of uniqueLinks) {
                 try {
                      let streamUrl = link;
                      if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
                      
                      const displaySeason = mappedSeason || season;
                      const displayEpisode = mappedEpisode || episode;
                      const displayName = `${cleanTitle} ${displaySeason}x${displayEpisode}`;
                      
                      if (streamUrl.includes("mixdrop") || streamUrl.includes("m1xdrop")) {
                         const extracted = yield extractMixDrop(streamUrl);
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
     
                           streams.push({ 
                             name: `EuroStreaming - MixDrop`, 
                             title: displayName, 
                             url: extracted.url, 
                             headers: extracted.headers, 
                             quality: normalizedQuality, 
                             type: "direct" 
                           }); 
                         } 
                       } else if (streamUrl.includes("dropload")) { 
                         const extracted = yield extractDropLoad(streamUrl); 
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
     
                           streams.push({ 
                             name: `EuroStreaming - DropLoad`, 
                             title: displayName, 
                             url: extracted.url, 
                             headers: extracted.headers, 
                             quality: normalizedQuality, 
                             type: "direct" 
                           }); 
                         } 
                       } else if (streamUrl.includes("supervideo")) { 
                         const extracted = yield extractSuperVideo(streamUrl); 
                         if (extracted) { 
                           let quality = "HD"; 
                           if (extracted.includes('.m3u8')) {
                               const detected = yield checkQualityFromPlaylist(extracted);
                               if (detected) quality = detected;
                           } else {
                               const lowerUrl = extracted.toLowerCase(); 
                               if (lowerUrl.includes("4k") || lowerUrl.includes("2160")) quality = "4K"; 
                               else if (lowerUrl.includes("1080") || lowerUrl.includes("fhd")) quality = "1080p"; 
                               else if (lowerUrl.includes("720") || lowerUrl.includes("hd")) quality = "720p"; 
                               else if (lowerUrl.includes("480") || lowerUrl.includes("sd")) quality = "480p"; 
                               else if (lowerUrl.includes("360")) quality = "360p"; 
                           }
                           
                           const normalizedQuality = getQualityFromName(quality); 
     
                           streams.push({ 
                             name: `EuroStreaming - SuperVideo`, 
                             title: displayName, 
                             url: extracted, 
                             quality: normalizedQuality, 
                             type: "direct" 
                           }); 
                         } 
                       } else if (streamUrl.includes("delta-bit") || streamUrl.includes("deltabit")) { 
                         const extracted = yield extractDeltaBit(streamUrl); 
                         if (extracted) { 
                           let quality = "HD"; 
                           if (extracted.includes('.m3u8')) {
                               const detected = yield checkQualityFromPlaylist(extracted);
                               if (detected) quality = detected;
                           } else {
                               const lowerUrl = extracted.toLowerCase(); 
                               if (lowerUrl.includes("4k") || lowerUrl.includes("2160")) quality = "4K"; 
                               else if (lowerUrl.includes("1080") || lowerUrl.includes("fhd")) quality = "1080p"; 
                               else if (lowerUrl.includes("720") || lowerUrl.includes("hd")) quality = "720p"; 
                               else if (lowerUrl.includes("480") || lowerUrl.includes("sd")) quality = "480p"; 
                               else if (lowerUrl.includes("360")) quality = "360p"; 
                           }
                           
                           const normalizedQuality = getQualityFromName(quality); 
     
                           streams.push({ 
                             name: `EuroStreaming - DeltaBit`, 
                             title: displayName, 
                             url: extracted, 
                             quality: normalizedQuality, 
                             type: "direct" 
                           }); 
                         } 
                       } else if (streamUrl.includes("vidoza")) { 
                         const extracted = yield extractVidoza(streamUrl); 
                         if (extracted) { 
                           let quality = "HD"; 
                           if (extracted.includes('.m3u8')) {
                               const detected = yield checkQualityFromPlaylist(extracted);
                               if (detected) quality = detected;
                           } else {
                               const lowerUrl = extracted.toLowerCase(); 
                               if (lowerUrl.includes("4k") || lowerUrl.includes("2160")) quality = "4K"; 
                               else if (lowerUrl.includes("1080") || lowerUrl.includes("fhd")) quality = "1080p"; 
                               else if (lowerUrl.includes("720") || lowerUrl.includes("hd")) quality = "720p"; 
                               else if (lowerUrl.includes("480") || lowerUrl.includes("sd")) quality = "480p"; 
                               else if (lowerUrl.includes("360")) quality = "360p"; 
                           }
                           
                           const normalizedQuality = getQualityFromName(quality); 
     
                           streams.push({ 
                             name: `EuroStreaming - Vidoza`, 
                             title: displayName, 
                             url: extracted, 
                             quality: normalizedQuality, 
                             type: "direct" 
                           }); 
                         } 
                       } else if (streamUrl.includes("uqload")) {
                           const extracted = yield extractUqload(streamUrl);
                           if (extracted) {
                               let quality = 'SD';
                               if (extracted.includes('.m3u8')) {
                                   const detected = yield checkQualityFromPlaylist(extracted);
                                   if (detected) quality = detected;
                               }

                               streams.push({
                                   url: extracted,
                                   name: 'EuroStreaming - Uqload',
                                   title: displayName,
                                   quality: getQualityFromName(quality),
                                   type: "direct"
                               });
                           }
                      } else if (streamUrl.includes("upstream")) {
                           const extracted = yield extractUpstream(streamUrl);
                           if (extracted && extracted.url) {
                               let quality = 'HD';
                               if (extracted.url.includes('.m3u8')) {
                                   const detected = yield checkQualityFromPlaylist(extracted.url, extracted.headers || {});
                                   if (detected) quality = detected;
                               }

                               streams.push({
                                   url: extracted.url,
                                   name: 'EuroStreaming - Upstream',
                                   title: displayName,
                                   quality: getQualityFromName(quality),
                                   type: "direct"
                               });
                           }
                      } else if (streamUrl.includes("streamtape")) {
                           const extracted = yield extractStreamTape(streamUrl);
                           if (extracted && extracted.url) {
                               let quality = 'HD';
                               if (extracted.url.includes('.m3u8')) {
                                   const detected = yield checkQualityFromPlaylist(extracted.url, extracted.headers || {});
                                   if (detected) quality = detected;
                               }

                               streams.push({
                                   url: extracted.url,
                                   name: 'EuroStreaming - StreamTape',
                                   title: displayName,
                                   quality: getQualityFromName(quality),
                                   type: "direct"
                               });
                           }
                      }
                 } catch (e) {
                     console.error(`[EuroStreaming] Link processing error:`, e);
                 }
             }
          } catch (e) {
            console.error(`[EuroStreaming] Error checking candidate ${candidate.url}:`, e);
          }
        }));
      }
      yield Promise.all(promises.map((p) => p()));
      return streams.map(s => formatStream(s, "EuroStreaming")).filter(s => s !== null);
    } catch (error) {
      console.error("[EuroStreaming] Error:", error);
      return [];
    }
  });
}
module.exports = { getStreams };
