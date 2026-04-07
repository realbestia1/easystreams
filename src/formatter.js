function isMp4Url(rawUrl, depth = 0) {
    const url = String(rawUrl || '').trim();
    if (!url) return false;

    const directMatch = (value) => /\.mp4(?:[?#].*)?$/i.test(String(value || '').trim());
    if (directMatch(url)) return true;
    if (depth >= 1) return false;

    try {
        const parsed = new URL(url);
        if (String(parsed.pathname || '').toLowerCase().endsWith('.mp4')) return true;

        // Handle proxy URLs that carry the real media URL in query params
        const nestedKeys = ['url', 'src', 'file', 'link', 'stream'];
        for (const key of nestedKeys) {
            const nested = parsed.searchParams.get(key);
            if (!nested) continue;

            let decoded = nested;
            try {
                decoded = decodeURIComponent(nested);
            } catch (_) {
                decoded = nested;
            }
            if (isMp4Url(decoded, depth + 1)) return true;
        }
        return false;
    } catch {
        return directMatch(url);
    }
}

function normalizePlaybackHeaders(headers) {
    if (!headers || typeof headers !== 'object') return headers;

    const normalized = {};
    for (const [key, value] of Object.entries(headers)) {
        if (value == null) continue;
        const lowerKey = String(key).toLowerCase();
        if (lowerKey === 'user-agent') normalized['User-Agent'] = value;
        else if (lowerKey === 'referer' || lowerKey === 'referrer') normalized['Referer'] = value;
        else if (lowerKey === 'origin') normalized['Origin'] = value;
        else if (lowerKey === 'accept') normalized['Accept'] = value;
        else if (lowerKey === 'accept-language') normalized['Accept-Language'] = value;
        else normalized[key] = value;
    }

    return normalized;
}

function shouldForceNotWebReadyForPlugin(stream, providerName, headers, behaviorHints) {
    const text = [
        stream?.url,
        stream?.name,
        stream?.title,
        stream?.server,
        providerName
    ].filter(Boolean).join(' ').toLowerCase();

    if (text.includes('mixdrop') || text.includes('m1xdrop') || text.includes('mxcontent')) {
        return true;
    }

    if (text.includes('loadm') || text.includes('loadm.cam')) {
        return true;
    }

    return false;
}

function formatStream(stream, providerName) {
    // 1. Filter MixDrop (removed from shared formatter, handled in Stremio addon separately)
    // const server = (stream.server || "").toLowerCase();
    // const sName = (stream.name || "").toLowerCase();
    // const sTitle = (stream.title || "").toLowerCase();
    // if (server.includes('mixdrop') || sName.includes('mixdrop') || sTitle.includes('mixdrop')) {
    //     return null;
    // }

    // Format resolution
    let quality = stream.quality || '';
    if (quality === '2160p') quality = '🔥4K UHD';
    else if (quality === '1440p') quality = '✨ QHD';
    else if (quality === '1080p') quality = '🚀 FHD';
    else if (quality === '720p') quality = '💿 HD';
    else if (quality === '576p' || quality === '480p' || quality === '360p' || quality === '240p') quality = '💩 Low Quality';
    else if (!quality || ['auto', 'unknown', 'unknow'].includes(String(quality).toLowerCase())) quality = 'Unknow';

    // Format title with emoji
    let title = `📁 ${stream.title || 'Stream'}`;

    // Extract language if not present
    let language = stream.language;
    if (!language) {
        if (stream.name && (stream.name.includes('SUB ITA') || stream.name.includes('SUB'))) language = '🇯🇵 🇮🇹';
        else if (stream.title && (stream.title.includes('SUB ITA') || stream.title.includes('SUB'))) language = '🇯🇵 🇮🇹';
        else language = '🇮🇹';
    }

    // Add details
    let details = [];
    if (stream.size) details.push(`📦 ${stream.size}`);

    const desc = details.join(' | ');

    // Construct Name: Quality + Provider
    // e.g. "FHD (ProviderName)"
    // Use stream.name as provider name if it's not the quality, otherwise use providerName
    // In providers, stream.name is often the server name (e.g. "VixCloud")
    let pName = stream.name || stream.server || providerName;

    // Clean SUB ITA or ITA from provider name if present
    if (pName) {
        pName = pName
            .replace(/\s*\[?\(?\s*SUB\s*ITA\s*\)?\]?/i, '') // Remove SUB ITA with optional brackets/parens
            .replace(/\s*\[?\(?\s*ITA\s*\)?\]?/i, '')     // Remove ITA with optional brackets/parens
            .replace(/\s*\[?\(?\s*SUB\s*\)?\]?/i, '')     // Remove SUB with optional brackets/parens
            .replace(/\(\s*\)/g, '')                      // Remove empty parentheses
            .replace(/\[\s*\]/g, '')                      // Remove empty brackets
            .trim();
    }

    // Capitalize if using the key name
    if (pName === providerName) {
        pName = pName.charAt(0).toUpperCase() + pName.slice(1);
    }

    // Add antenna emoji if provider exists
    if (pName) {
        pName = `📡 ${pName}`;
    }

    // Move headers to behaviorHints if present, but keep original for compatibility.
    const behaviorHints = stream.behaviorHints && typeof stream.behaviorHints === 'object'
        ? { ...stream.behaviorHints }
        : {};
    let finalHeaders = stream.headers;

    if (behaviorHints.proxyHeaders && behaviorHints.proxyHeaders.request) {
        finalHeaders = behaviorHints.proxyHeaders.request;
    } else if (behaviorHints.headers) {
        finalHeaders = behaviorHints.headers;
    }

    finalHeaders = normalizePlaybackHeaders(finalHeaders);

    const isStreamingCommunityProvider = String(providerName || '').toLowerCase() === 'streamingcommunity'
        || String(stream?.name || '').toLowerCase().includes('streamingcommunity');

    if (finalHeaders) {
        behaviorHints.proxyHeaders = behaviorHints.proxyHeaders || {};
        behaviorHints.proxyHeaders.request = finalHeaders;
        behaviorHints.headers = finalHeaders;
    }

    const shouldForceNotWebReady = shouldForceNotWebReadyForPlugin(stream, providerName, finalHeaders, behaviorHints);
    if (!isStreamingCommunityProvider && shouldForceNotWebReady) {
        behaviorHints.notWebReady = true;
    } else {
        delete behaviorHints.notWebReady;
    }

    const finalName = pName;
    let finalTitle = `📁 ${stream.title || 'Stream'}`;
    if (desc) finalTitle += ` | ${desc}`;
    if (language) finalTitle += ` | ${language}`;

    return {
        ...stream, // Keep original properties
        name: finalName,
        title: finalTitle,
        // Metadata for Stremio UI reconstruction (safer names for RN)
        providerName: pName,
        qualityTag: quality,
        description: desc,
        originalTitle: stream.title || 'Stream',
        // Ensure language is set for Stremio/Nuvio sorting
        language: language,
        // Mark as formatted
        _nuvio_formatted: true,
        behaviorHints: behaviorHints,
        // Explicitly ensure root headers are preserved for Nuvio
        headers: finalHeaders
    };
}

module.exports = { formatStream };
