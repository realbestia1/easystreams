const BASE_URL = 'https://guardahd.stream';
const TMDB_API_KEY = '68e094699525b18a70bab2f86b1fa706';
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
                
                const urlObj = new URL(url);
                const referer = urlObj.origin + '/';
                const origin = urlObj.origin;

                return {
                    url: streamUrl,
                    headers: {
                        'User-Agent': USER_AGENT,
                        'Referer': referer,
                        'Origin': origin
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
        
        const regex = /eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
        const match = regex.exec(html);
        
        if (match) {
            let p = match[1];
            const a = parseInt(match[2]);
            let c = parseInt(match[3]);
            const k = match[4].split('|');
            
            // Basic unpack logic for DropLoad/Packer
             while (c--) {
                if (k[c]) {
                    const pattern = new RegExp("\\b" + c.toString(a) + "\\b", "g");
                    p = p.replace(pattern, k[c]);
                }
            }

            const fileMatch = p.match(/file:"(.*?)"/);
            if (fileMatch) {
                let streamUrl = fileMatch[1];
                if (streamUrl.startsWith('//')) streamUrl = 'https:' + streamUrl;
                
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
        
        // Try to get the direct video URL or embed
        // Logic from previous implementation
        // Often SuperVideo uses packer too.
        
        // Let's keep it simple based on what was there
        // The transpiled code had some logic for checking Cloudflare and embed only
        
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
        }

        let html = await response.text();
        if (html.includes('This video can be watched as embed only')) {
            console.log('[GuardaHD] SuperVideo is embed only, trying embed URL...');
            let embedUrl = url;
            if (!embedUrl.includes('/e/') && !embedUrl.includes('/embed-')) {
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

        const packedRegex = /eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
        const match = packedRegex.exec(html);
        
        if (match) {
            const p = match[1];
            const a = parseInt(match[2]);
            const c = parseInt(match[3]);
            const k = match[4].split('|');
            const unpacked = unPack(p, a, c, k, null, {});
            
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

        // Extract iframe src
        const iframeRegex = /<iframe[^>]+id=["']_player["'][^>]+src=["']([^"']+)["']/;
        const iframeMatch = iframeRegex.exec(html);
        const links = [];

        if (iframeMatch) {
            links.push({ url: iframeMatch[1], name: 'Active Player' });
        }

        // Extract data-link attributes
        const linkRegex = /data-link=["']([^"']+)["']/g;
        let match;
        while ((match = linkRegex.exec(html)) !== null) {
            // Find name
            // In the HTML structure, usually it's inside an li/span/a
            // For simplicity, let's just push the URL, name extraction logic is complex without cheerio
            links.push({ url: match[1], name: 'Alternative' });
        }

        const processUrl = async (link) => {
            let streamUrl = link.url;
            if (streamUrl.startsWith('//')) streamUrl = 'https:' + streamUrl;

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
            } else if (streamUrl.includes('dropload')) {
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
            } else if (streamUrl.includes('supervideo')) {
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
            }
        };

        await Promise.all(links.map(link => processUrl(link)));

        // Filter duplicates
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
