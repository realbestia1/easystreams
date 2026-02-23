
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
    else if (!quality || quality.toLowerCase() === 'auto') quality = 'Unknown';
    
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
    // e.g. "🚀 FHD (📡 AnimeWorld)"
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

    const finalName = quality || pName;

    let titleText = `${title}\n${pName}`;
    if (desc) titleText += ` | ${desc}`;
    if (language) titleText += `\n🗣️ ${language}`;

    // Move headers to behaviorHints if present, but keep original for compatibility
    const behaviorHints = stream.behaviorHints || {};
    if (stream.headers) {
        behaviorHints.proxyHeaders = behaviorHints.proxyHeaders || {};
        behaviorHints.proxyHeaders.request = stream.headers;
        // Do not delete stream.headers as some players might still use it
    }

    return {
        ...stream, // Keep original properties
        name: finalName,
        title: titleText,
        // Ensure language is set for Stremio/Nuvio sorting
        language: language,
        // Mark as formatted
        _nuvio_formatted: true,
        behaviorHints: behaviorHints
    };
}

module.exports = { formatStream };
