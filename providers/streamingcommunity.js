const BASE_URL = 'https://vixsrc.to';
const TMDB_API_KEY = '68e094699525b18a70bab2f86b1fa706';

async function getTmdbId(imdbId, type) {
    const endpoint = type === 'movie' ? 'movie' : 'tv';
    const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;

    try {
        const response = await fetch(findUrl);
        if (!response.ok) return null;
        const data = await response.json();

        if (!data) return null;

        if (type === 'movie' && data.movie_results && data.movie_results.length > 0) {
            return data.movie_results[0].id.toString();
        } else if ((type === 'tv' || type === 'series') && data.tv_results && data.tv_results.length > 0) {
            return data.tv_results[0].id.toString();
        }
        return null;
    } catch (e) {
        console.error('[StreamingCommunity] Conversion error:', e);
        return null;
    }
}

async function getStreams(id, type, season, episode) {
    let tmdbId = id.toString();
    if (tmdbId.startsWith('tmdb:')) {
        tmdbId = tmdbId.replace('tmdb:', '');
    }

    // Convert IMDb ID to TMDB ID if necessary
    if (tmdbId.startsWith('tt')) {
        const convertedId = await getTmdbId(tmdbId, type);
        if (convertedId) {
            console.log(`[StreamingCommunity] Converted ${id} to TMDB ID: ${convertedId}`);
            tmdbId = convertedId;
        } else {
            console.warn(`[StreamingCommunity] Could not convert IMDb ID ${id} to TMDB ID.`);
            // Fallback or error? Vixsrc needs TMDB ID structure for URLs?
            // Vixsrc URLs are /movie/<id> or /tv/<id>/<season>/<episode>
            // Usually these are TMDB IDs.
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
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });

        if (!response.ok) {
            console.error(`[StreamingCommunity] Failed to fetch page: ${response.status}`);
            return [];
        }

        const html = await response.text();
        if (!html) return [];

        // Extract token and expires
        const tokenMatch = html.match(/'token':\s*'([^']+)'/);
        const expiresMatch = html.match(/'expires':\s*'([^']+)'/);
        const urlMatch = html.match(/url:\s*'([^']+)'/);

        if (tokenMatch && expiresMatch && urlMatch) {
            const token = tokenMatch[1];
            const expires = expiresMatch[1];
            const baseUrl = urlMatch[1];

            // Construct stream URL
            let streamUrl;
            if (baseUrl.includes('?b=1')) {
                streamUrl = `${baseUrl}&token=${token}&expires=${expires}&h=1&lang=it`;
            } else {
                streamUrl = `${baseUrl}?token=${token}&expires=${expires}&h=1&lang=it`;
            }

            // Verify if the playlist works and has Italian audio
            console.log(`[StreamingCommunity] Verifying playlist content...`);
            try {
                const playlistResponse = await fetch(streamUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': 'https://vixsrc.to/'
                    }
                });

                if (playlistResponse.ok) {
                    const playlistText = await playlistResponse.text();
                    
                    // Simple check for Italian language track or metadata
                    const hasItalian = /LANGUAGE="it"|LANGUAGE="ita"|NAME="Italian"/i.test(playlistText);
                    const has1080p = /RESOLUTION=\d+x1080|RESOLUTION=1080/i.test(playlistText);

                    if (!hasItalian) {
                        console.log(`[StreamingCommunity] Skipping: No Italian audio found.`);
                        return [];
                    }
                    
                    if (!has1080p) {
                         console.log(`[StreamingCommunity] Skipping: No 1080p stream found.`);
                         return [];
                    }

                    console.log(`[StreamingCommunity] Verified: Has Italian audio and 1080p.`);

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
                    console.warn(`[StreamingCommunity] Failed to fetch playlist for verification: ${playlistResponse.status}`);
                    return [];
                }
            } catch (verError) {
                console.error(`[StreamingCommunity] Error verifying playlist:`, verError);
                return [];
            }
        } else {
            console.log("[StreamingCommunity] Could not find playlist info in HTML");
            return [];
        }
    } catch (error) {
        console.error("[StreamingCommunity] Error:", error);
        return [];
    }
}

module.exports = { getStreams };
