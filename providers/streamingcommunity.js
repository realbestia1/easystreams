
const BASE_URL = 'https://vixsrc.to';
const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";

async function getTmdbId(imdbId, type) {
    try {
        // Use TMDB API to convert IMDb ID to TMDB ID
        // This endpoint supports lookup by IMDb ID (e.g., /movie/tt0137523)
        // Note: For TV shows, we use 'tv' endpoint.
        const endpoint = type === 'movie' ? 'movie' : 'tv';
        // But wait, /tv/{id} endpoint with IMDb ID might not work directly?
        // Let's check. For movies it works.
        // For TV: /tv/tt0903747?api_key=...
        // If it fails, we use /find/{id}?external_source=imdb_id
        
        // Let's use /find endpoint which is safer for external IDs
        const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
        
        const response = await fetch(findUrl);
        if (!response.ok) return null;
        
        const data = await response.json();
        
        if (type === 'movie' && data.movie_results && data.movie_results.length > 0) {
            return data.movie_results[0].id.toString();
        } else if ((type === 'tv' || type === 'series') && data.tv_results && data.tv_results.length > 0) {
            return data.tv_results[0].id.toString();
        }
        
        return null;
    } catch (e) {
        console.error('[VixSrc] Conversion error:', e);
        return null;
    }
}

async function getStreams(id, type, season, episode) {
    let tmdbId = id.toString();
    if (tmdbId.startsWith('tmdb:')) {
        tmdbId = tmdbId.replace('tmdb:', '');
    }
    
    // If ID starts with 'tt', it's an IMDb ID
    if (tmdbId.startsWith('tt')) {
        const convertedId = await getTmdbId(tmdbId, type);
        if (convertedId) {
            tmdbId = convertedId;
            console.log(`[VixSrc] Converted ${id} to TMDB ID: ${tmdbId}`);
        } else {
            console.warn(`[VixSrc] Could not convert IMDb ID ${id} to TMDB ID.`);
            return [];
        }
    }

    let url;
    if (type === 'movie') {
        url = `${BASE_URL}/movie/${tmdbId}`;
    } else if (type === 'tv' || type === 'series') {
        url = `${BASE_URL}/tv/${tmdbId}/${season}/${episode}`;
    } else {
        return [];
    }

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://vixsrc.to/',
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
        });

        if (!response.ok) {
            console.error(`[VixSrc] Failed to fetch page: ${response.status}`);
            return [];
        }

        const html = await response.text();
        
        // Extract token and expires from window.masterPlaylist
        const tokenMatch = html.match(/'token':\s*'([^']+)'/);
        const expiresMatch = html.match(/'expires':\s*'([^']+)'/);
        const urlMatch = html.match(/url:\s*'([^']+)'/);

        if (tokenMatch && expiresMatch && urlMatch) {
            const token = tokenMatch[1];
            const expires = expiresMatch[1];
            const baseUrl = urlMatch[1];
            
            let streamUrl;
            if (baseUrl.includes("?b=1")) {
                streamUrl = `${baseUrl}&token=${token}&expires=${expires}&h=1&lang=it`;
            } else {
                streamUrl = `${baseUrl}?token=${token}&expires=${expires}&h=1&lang=it`;
            }

            // Verify playlist content (must have Italian audio and 1080p)
            try {
                console.log(`[VixSrc] Verifying playlist content for ${tmdbId}...`);
                const playlistResponse = await fetch(streamUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': 'https://vixsrc.to/'
                    }
                });

                if (playlistResponse.ok) {
                    const playlistText = await playlistResponse.text();
                    
                    // Check for Italian language
                    const hasItalian = /LANGUAGE="it"|LANGUAGE="ita"|NAME="Italian"/i.test(playlistText);
                    
                    // Check for 1080p
                    const has1080p = /RESOLUTION=\d+x1080|RESOLUTION=1080/i.test(playlistText);
                    
                    if (!hasItalian) {
                        console.log(`[VixSrc] Skipping: No Italian audio found.`);
                        return [];
                    }
                    
                    if (!has1080p) {
                        console.log(`[VixSrc] Skipping: No 1080p stream found.`);
                        return [];
                    }
                    
                    console.log(`[VixSrc] Verified: Has Italian audio and 1080p.`);
                } else {
                    console.warn(`[VixSrc] Failed to fetch playlist for verification: ${playlistResponse.status}`);
                    // If we can't verify, maybe safe to skip? Or return anyway?
                    // User said "open it and send ONLY IF...", so if we fail to open, we fail to verify.
                    return [];
                }
            } catch (verError) {
                console.error(`[VixSrc] Error verifying playlist:`, verError);
                return [];
            }
            
            return [{
                name: 'StreamingCommunity',
                title: 'Watch',
                url: streamUrl,
                quality: '1080p',
                type: 'direct',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://vixsrc.to/'
                }
            }];
        } else {
            console.log('[VixSrc] Could not find playlist info in HTML');
        }

        return [];

    } catch (error) {
        console.error('[VixSrc] Error:', error);
        return [];
    }
}

module.exports = { getStreams };
