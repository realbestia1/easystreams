const BASE_URL = "https://guardaserietv.best";
const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

async function getImdbId(tmdbId, type) {
    try {
        const endpoint = type === "movie" ? "movie" : "tv";
        const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        if (data.imdb_id) return data.imdb_id;
        
        const externalUrl = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
        const extResponse = await fetch(externalUrl);
        if (extResponse.ok) {
            const extData = await extResponse.json();
            if (extData.imdb_id) return extData.imdb_id;
        }
        return null;
    } catch (e) {
        console.error("[Guardaserie] Conversion error:", e);
        return null;
    }
}

async function getShowInfo(tmdbId, type) {
    try {
        const endpoint = type === "movie" ? "movie" : "tv";
        const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=it-IT`;
        const response = await fetch(url);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.error("[Guardaserie] TMDB error:", e);
        return null;
    }
}

function unPack(p, a, c, k, e, d) {
    e = function(c) {
        return (c < a ? "" : e(parseInt(c / a))) + ((c = c % a) > 35 ? String.fromCharCode(c + 29) : c.toString(36));
    };
    if (!"".replace(/^/, String)) {
        while (c--) {
            d[e(c)] = k[c] || e(c);
        }
        k = [function(e) {
            return d[e];
        }];
        e = function() {
            return "\\w+";
        };
        c = 1;
    }
    while (c--) {
        if (k[c]) {
            p = p.replace(new RegExp("\\b" + e(c) + "\\b", "g"), k[c]);
        }
    }
    return p;
}

async function extractMixDrop(url) {
    try {
        if (url.startsWith("//")) url = "https:" + url;
        const response = await fetch(url, {
            headers: {
                "User-Agent": USER_AGENT,
                "Referer": BASE_URL
            }
        });
        if (!response.ok) return null;
        const html = await response.text();
        const packedRegex = /eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\),(\d+),(\{\})\)\)/;
        const match = packedRegex.exec(html);
        
        if (match) {
            const p = match[1];
            const a = parseInt(match[2]);
            const c = parseInt(match[3]);
            const k = match[4].split("|");
            const unpacked = unPack(p, a, c, k, null, {});
            const wurlMatch = unpacked.match(/wurl="([^"]+)"/);
            
            if (wurlMatch) {
                let streamUrl = wurlMatch[1];
                if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
                const urlObj = new URL(url);
                const referer = urlObj.origin + "/";
                const origin = urlObj.origin;
                
                return {
                    url: streamUrl,
                    headers: {
                        "User-Agent": USER_AGENT,
                        "Referer": referer,
                        "Origin": origin
                    }
                };
            }
        }
        return null;
    } catch (e) {
        console.error("[Guardaserie] MixDrop extraction error:", e);
        return null;
    }
}

async function extractDropLoad(url) {
    try {
        if (url.startsWith("//")) url = "https:" + url;
        const response = await fetch(url, {
            headers: {
                "User-Agent": USER_AGENT,
                "Referer": BASE_URL
            }
        });
        if (!response.ok) return null;
        const html = await response.text();
        const regex = /eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
        const match = regex.exec(html);
        
        if (match) {
            let p = match[1];
            const a = parseInt(match[2]);
            let c = parseInt(match[3]);
            const k = match[4].split("|");
            
            while (c--) {
                if (k[c]) {
                    const pattern = new RegExp("\\b" + c.toString(a) + "\\b", "g");
                    p = p.replace(pattern, k[c]);
                }
            }
            
            const fileMatch = p.match(/file:"(.*?)"/);
            if (fileMatch) {
                let streamUrl = fileMatch[1];
                if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
                const referer = new URL(url).origin + "/";
                
                return {
                    url: streamUrl,
                    headers: {
                        "User-Agent": USER_AGENT,
                        "Referer": referer
                    }
                };
            }
        }
        return null;
    } catch (e) {
        console.error("[Guardaserie] DropLoad extraction error:", e);
        return null;
    }
}

async function extractSuperVideo(url) {
    try {
        if (url.startsWith("//")) url = "https:" + url;
        let directUrl = url;
        let response = await fetch(directUrl, {
            headers: {
                "User-Agent": USER_AGENT,
                "Referer": BASE_URL
            }
        });
        let html = await response.text();
        
        if (html.includes("This video can be watched as embed only")) {
            if (!url.includes("/e/") && !url.includes("/embed-")) {
                directUrl = url.replace(".cc/", ".cc/e/");
                response = await fetch(directUrl, {
                    headers: {
                        "User-Agent": USER_AGENT,
                        "Referer": BASE_URL
                    }
                });
                html = await response.text();
            }
        }
        
        const packedRegex = /eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
        const match = packedRegex.exec(html);
        
        if (match) {
            const p = match[1];
            const a = parseInt(match[2]);
            const c = parseInt(match[3]);
            const k = match[4].split("|");
            const unpacked = unPack(p, a, c, k, null, {});
            const fileMatch = unpacked.match(/file:"(.*?)"/);
            
            if (fileMatch) {
                let streamUrl = fileMatch[1];
                if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
                return streamUrl;
            }
        }
        return null;
    } catch (e) {
        console.error("[Guardaserie] SuperVideo extraction error:", e);
        return null;
    }
}

async function getTmdbIdFromImdb(imdbId, type) {
    try {
        const url = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        
        if (type === "movie" && data.movie_results?.length > 0) return data.movie_results[0].id;
        if (type === "tv" && data.tv_results?.length > 0) return data.tv_results[0].id;
        return null;
    } catch (e) {
        console.error("[Guardaserie] ID conversion error:", e);
        return null;
    }
}

async function getStreams(id, type, season, episode) {
    if (type === "movie") return [];
    
    try {
        let tmdbId = id;
        if (id.toString().startsWith("tt")) {
            tmdbId = await getTmdbIdFromImdb(id, type);
            if (!tmdbId) {
                console.log(`[Guardaserie] Could not convert ${id} to TMDB ID`);
                return [];
            }
        } else if (id.toString().startsWith("tmdb:")) {
            tmdbId = id.toString().replace("tmdb:", "");
        }
        
        const showInfo = await getShowInfo(tmdbId, type);
        if (!showInfo) return [];
        
        const title = showInfo.name || showInfo.original_name;
        const year = showInfo.first_air_date ? showInfo.first_air_date.split("-")[0] : "";
        console.log(`[Guardaserie] Searching for: ${title} (${year})`);
        
        const params = new URLSearchParams();
        params.append("do", "search");
        params.append("subaction", "search");
        params.append("story", title);
        
        const searchUrl = `${BASE_URL}/index.php?${params.toString()}`;
        const searchResponse = await fetch(searchUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": BASE_URL
            }
        });
        
        const searchHtml = await searchResponse.text();
        const resultRegex = /<div class="mlnh-2">\s*<h2>\s*<a href="([^"]+)" title="([^"]+)">/g;
        let match;
        let showUrl = null;
        
        while ((match = resultRegex.exec(searchHtml)) !== null) {
            const foundUrl = match[1];
            const foundTitle = match[2];
            if (foundTitle.toLowerCase().includes(title.toLowerCase())) {
                showUrl = foundUrl;
                break;
            }
        }
        
        if (!showUrl) {
            console.log("[Guardaserie] Show not found");
            return [];
        }
        
        console.log(`[Guardaserie] Found show URL: ${showUrl}`);
        const showResponse = await fetch(showUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": BASE_URL
            }
        });
        
        const showHtml = await showResponse.text();
        const episodeStr = `${season}x${episode}`;
        const episodeRegex = new RegExp(`data-num="${episodeStr}"`, "i");
        const episodeMatch = episodeRegex.exec(showHtml);
        
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
        
        const streamPromises = links.map(async (link) => {
            try {
                let streamUrl = null;
                let playerName = "Unknown";
                
                if (link.includes("dropload")) {
                    const extracted = await extractDropLoad(link);
                    if (extracted && extracted.url) {
                        return {
                            url: extracted.url,
                            headers: extracted.headers,
                            name: `Guardaserie (DropLoad)`,
                            title: "Watch",
                            quality: "auto",
                            type: "direct"
                        };
                    }
                } else if (link.includes("supervideo")) {
                    streamUrl = await extractSuperVideo(link);
                    playerName = "SuperVideo";
                    if (streamUrl) {
                        return {
                            url: streamUrl,
                            name: `Guardaserie (${playerName})`,
                            title: "Watch",
                            quality: "auto",
                            type: "direct"
                        };
                    }
                } else if (link.includes("mixdrop")) {
                    const extracted = await extractMixDrop(link);
                    if (extracted && extracted.url) {
                        return {
                            url: extracted.url,
                            headers: extracted.headers,
                            name: `Guardaserie (MixDrop)`,
                            title: "Watch",
                            quality: "auto",
                            type: "direct"
                        };
                    }
                }
            } catch (e) {
                console.error(`[Guardaserie] Error extracting link ${link}:`, e);
            }
            return null;
        });
        
        const results = await Promise.all(streamPromises);
        return results.filter(r => r !== null);
        
    } catch (e) {
        console.error("[Guardaserie] Error:", e);
        return [];
    }
}

module.exports = { getStreams };
