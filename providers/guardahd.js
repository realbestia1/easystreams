
const BASE_URL = 'https://guardahd.stream';
const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';

async function getImdbId(tmdbId, type) {
    try {
        const endpoint = type === 'movie' ? 'movie' : 'tv';
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
        console.error('[GuardaHD] Conversion error:', e);
        return null;
    }
}

// Unpacker for Dean Edwards packer (used by MixDrop)
function unPack(p, a, c, k, e, d) {
    e = function (c) {
        return (c < a ? '' : e(parseInt(c / a))) + ((c = c % a) > 35 ? String.fromCharCode(c + 29) : c.toString(36))
    };
    if (!''.replace(/^/, String)) {
        while (c--) {
            d[e(c)] = k[c] || e(c)
        }
        k = [function (e) {
            return d[e]
        }];
        e = function () {
            return '\\w+'
        };
        c = 1
    };
    while (c--) {
        if (k[c]) {
            p = p.replace(new RegExp('\\b' + e(c) + '\\b', 'g'), k[c])
        }
    }
    return p;
}

async function extractMixDrop(url) {
    try {
        if (url.startsWith('//')) url = 'https:' + url;
        const response = await fetch(url, {
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': BASE_URL
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
            const k = match[4].split('|');
            const unpacked = unPack(p, a, c, k, null, {});
            
            const wurlMatch = unpacked.match(/wurl="([^"]+)"/);
            if (wurlMatch) {
                let streamUrl = wurlMatch[1];
                if (streamUrl.startsWith('//')) streamUrl = 'https:' + streamUrl;
                
                // Use origin from the input URL as Referer (handles .co, .to, .ch etc.)
                const urlObj = new URL(url);
                const referer = urlObj.origin + '/';
                const origin = urlObj.origin;
                
                // Nuvio documentation specifies passing headers in a separate object.
            // Do NOT append headers to the URL (e.g. |Referer=...) as this might break the URL in Nuvio's player.
            
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
        console.error('[GuardaHD] MixDrop extraction error:', e);
        return null;
    }
}

async function extractDropLoad(url) {
    try {
        if (url.startsWith('//')) url = 'https:' + url;
        const response = await fetch(url, {
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': BASE_URL
            }
        });

        if (!response.ok) return null;
        const html = await response.text();

        // More flexible regex for DropLoad
        const regex = /eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
        const match = regex.exec(html);

        if (match) {
            let p = match[1];
            const a = parseInt(match[2]);
            let c = parseInt(match[3]);
            const k = match[4].split('|');
            
            // Unpack logic: while(c--)if(k[c])p=p.replace(new RegExp('\\b'+c.toString(a)+'\\b','g'),k[c])
            while (c--) {
                if (k[c]) {
                    const pattern = new RegExp('\\b' + c.toString(a) + '\\b', 'g');
                    p = p.replace(pattern, k[c]);
                }
            }
            
            // Find file:"..."
            const fileMatch = p.match(/file:"(.*?)"/);
            if (fileMatch) {
                let streamUrl = fileMatch[1];
                if (streamUrl.startsWith('//')) streamUrl = 'https:' + streamUrl;
                
                // Use origin as Referer
                const referer = new URL(url).origin + '/';
                
                return {
                    url: streamUrl,
                    headers: {
                        'User-Agent': USER_AGENT,
                        'Referer': referer
                    }
                };
            }
        }
        return null;
} catch (e) {
    console.error('[GuardaHD] DropLoad extraction error:', e);
    return null;
}
}

async function extractSuperVideo(url) {
try {
    if (url.startsWith('//')) url = 'https:' + url;
    
    // Normalize URL: try to use the direct download page first if it's an embed
    // e.g. https://supervideo.cc/e/xyz -> https://supervideo.cc/xyz
    let directUrl = url.replace('/e/', '/').replace('/embed-', '/');
    
    console.log(`[GuardaHD] Testing SuperVideo direct: ${directUrl}`);
    let response = await fetch(directUrl, {
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': BASE_URL
            }
        });

    if (response.status === 403 || response.status === 503) {
        console.warn('[GuardaHD] SuperVideo (Direct) blocked by Cloudflare');
        // Try embed as fallback? Usually both are blocked if one is.
    }

    let html = await response.text();
    
    if (html.includes('This video can be watched as embed only')) {
        console.log('[GuardaHD] SuperVideo is embed only, trying embed URL...');
        let embedUrl = url;
        if (!embedUrl.includes('/e/') && !embedUrl.includes('/embed-')) {
             // Construct embed url if we started with direct
             // But usually the input 'url' is from the site which is already embed or direct
             // The site gives //supervideo.cc/e/code
             embedUrl = directUrl.replace('.cc/', '.cc/e/');
        }
        
        response = await fetch(embedUrl, {
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': BASE_URL
            }
        });
        html = await response.text();
    }

    if (html.includes('Cloudflare') || response.status === 403) {
        console.warn('[GuardaHD] SuperVideo blocked by Cloudflare (403)');
        return null;
    }

    // Regex for packed code
    const packedRegex = /eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
    const match = packedRegex.exec(html);

    if (match) {
        const p = match[1];
        const a = parseInt(match[2]);
        const c = parseInt(match[3]);
        const k = match[4].split('|');
        const unpacked = unPack(p, a, c, k, null, {});
        
        // Look for sources:[{file:"..."}]
        const fileMatch = unpacked.match(/sources:\[\{file:"(.*?)"/);
        if (fileMatch) {
            let streamUrl = fileMatch[1];
            if (streamUrl.startsWith('//')) streamUrl = 'https:' + streamUrl;
            return streamUrl;
        }
    }
    
    return null;
} catch (e) {
    console.error('[GuardaHD] SuperVideo extraction error:', e);
    return null;
}
}


async function getStreams(id, type, season, episode) {
    // if (type !== 'movie') return []; // Allow TV shows too if logic exists

    let cleanId = id.toString();
    if (cleanId.startsWith('tmdb:')) cleanId = cleanId.replace('tmdb:', '');

    let imdbId = cleanId;
    if (!cleanId.startsWith('tt')) {
        const convertedId = await getImdbId(cleanId, type);
        if (convertedId) imdbId = convertedId;
        else return [];
    }

    let url;
    if (type === 'movie') {
        url = `${BASE_URL}/set-movie-a/${imdbId}`;
    } else if (type === 'tv') {
        url = `${BASE_URL}/set-tv-a/${imdbId}/${season}/${episode}`;
    } else {
        return [];
    }

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': BASE_URL
            }
        });

        if (!response.ok) return [];

        const html = await response.text();
        const streams = [];
        const linkRegex = /data-link=["']([^"']+)["']/g;
        let match;
        
        // Helper to process a URL
        const processUrl = async (streamUrl, name) => {
             if (streamUrl.startsWith('//')) streamUrl = 'https:' + streamUrl;
             
             // MixDrop
             if (streamUrl.includes('mixdrop') || streamUrl.includes('m1xdrop')) {
                console.log(`[GuardaHD] Attempting MixDrop extraction for ${streamUrl}`);
                const extracted = await extractMixDrop(streamUrl);
                if (extracted && extracted.url) {
                    streams.push({
                        name: 'GuardaHD (MixDrop)',
                        title: 'Watch',
                        url: extracted.url,
                        headers: extracted.headers,
                        quality: 'auto',
                        type: 'direct'
                    });
                }
                return;
             }
             
             // DropLoad
             if (streamUrl.includes('dropload')) {
                 console.log(`[GuardaHD] Attempting DropLoad extraction for ${streamUrl}`);
                 const extracted = await extractDropLoad(streamUrl);
                 if (extracted && extracted.url) {
                     streams.push({
                        name: 'GuardaHD (DropLoad)',
                        title: 'Watch',
                        url: extracted.url,
                        headers: extracted.headers,
                        quality: 'auto',
                        type: 'direct'
                    });
                 }
                 return;
             }
             
             // SuperVideo
             if (streamUrl.includes('supervideo')) {
                 console.log(`[GuardaHD] Attempting SuperVideo extraction for ${streamUrl}`);
                 const extracted = await extractSuperVideo(streamUrl);
                 if (extracted) {
                     streams.push({
                        name: 'GuardaHD (SuperVideo)',
                        title: 'Watch',
                        url: extracted,
                        quality: 'auto',
                        type: 'direct'
                    });
                 }
                 return;
             }
             

        };

        const promises = [];

        while ((match = linkRegex.exec(html)) !== null) {
            let streamUrl = match[1];
            const tagEndIndex = html.indexOf('>', match.index);
            const liEndIndex = html.indexOf('</li>', tagEndIndex);
            let name = 'Unknown';
            if (tagEndIndex !== -1 && liEndIndex !== -1) {
                name = html.substring(tagEndIndex + 1, liEndIndex).replace(/<\/?[^>]+(>|$)/g, "").trim();
            }
            promises.push(processUrl(streamUrl, name));
        }
        
        // Also check the active iframe player
        const iframeRegex = /<iframe[^>]+id=["']_player["'][^>]+src=["']([^"']+)["']/;
        const iframeMatch = iframeRegex.exec(html);
        if (iframeMatch) {
            let activeUrl = iframeMatch[1];
             if (activeUrl.startsWith('//')) activeUrl = 'https:' + activeUrl;
             // Avoid duplicate processing if it was already in the list? 
             // The list comes from data-link. The iframe is usually one of them but "active".
             // We can just process it again, worst case duplicate, but better check.
             // Actually, usually the iframe src is NOT in data-link explicitly or it is one of them.
             // Let's just process it.
             promises.push(processUrl(activeUrl, "Active Player"));
        }

        await Promise.all(promises);
        
        // Deduplicate streams by URL
        const uniqueStreams = [];
        const seenUrls = new Set();
        for (const s of streams) {
            if (!seenUrls.has(s.url)) {
                seenUrls.add(s.url);
                uniqueStreams.push(s);
            }
        }

        return uniqueStreams;

    } catch (error) {
        console.error('[GuardaHD] Error:', error);
        return [];
    }
}

module.exports = { getStreams };
