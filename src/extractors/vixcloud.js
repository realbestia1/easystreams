const { USER_AGENT } = require('./common');
const { checkQualityFromPlaylist } = require('../quality_helper.js');

async function extractVixCloud(url) {
    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": USER_AGENT,
                "Referer": "https://www.animeunity.so/"
            }
        });

        if (!response.ok) return null;
        const html = await response.text();

        const streams = [];

        // Extract Direct MP4 (downloadUrl)
        const downloadRegex = /window\.downloadUrl\s*=\s*'([^']+)'/;
        const downloadMatch = downloadRegex.exec(html);
        
        if (downloadMatch) {
            const downloadUrl = downloadMatch[1];
            let quality = "Unknown";
            if (downloadUrl.includes("1080p")) quality = "1080p";
            else if (downloadUrl.includes("720p")) quality = "720p";
            else if (downloadUrl.includes("480p")) quality = "480p";
            else if (downloadUrl.includes("360p")) quality = "360p";

            streams.push({
                url: downloadUrl,
                quality: quality,
                type: "direct",
                headers: {
                    "User-Agent": USER_AGENT,
                    "Referer": "https://vixcloud.co/"
                }
            });
        }

        // Extract HLS (streams) using Python extractor logic
        const tokenRegex = /'token':\s*'(\w+)'/;
        const expiresRegex = /'expires':\s*'(\d+)'/;
        const urlRegex = /url:\s*'([^']+)'/;
        const fhdRegex = /window\.canPlayFHD\s*=\s*true/;
        
        const tokenMatch = tokenRegex.exec(html);
        const expiresMatch = expiresRegex.exec(html);
        const urlMatch = urlRegex.exec(html);
        const fhdMatch = fhdRegex.test(html);

        if (tokenMatch && expiresMatch && urlMatch) {
            const token = tokenMatch[1];
            const expires = expiresMatch[1];
            let serverUrl = urlMatch[1];
            
            let finalUrl = "";
            // Logic from Python extractor
            if (serverUrl.includes("?b=1")) {
                 finalUrl = `${serverUrl}&token=${token}&expires=${expires}`;
            } else {
                 finalUrl = `${serverUrl}?token=${token}&expires=${expires}`;
            }
            
            if (fhdMatch) {
                finalUrl += "&h=1";
            }
            
            // Insert .m3u8 before query params
            const parts = finalUrl.split('?');
            finalUrl = parts[0] + '.m3u8';
            if (parts.length > 1) {
                finalUrl += '?' + parts.slice(1).join('?');
            }
            
            let quality = "Auto";
            const detectedQuality = await checkQualityFromPlaylist(finalUrl, {
                "User-Agent": USER_AGENT,
                "Referer": "https://vixcloud.co/"
            });
            if (detectedQuality) quality = detectedQuality;
            
            streams.push({
                url: finalUrl,
                quality: quality,
                type: "m3u8",
                headers: {
                    "User-Agent": USER_AGENT,
                    "Referer": "https://vixcloud.co/"
                }
            });
        }
        
        return streams;

    } catch (e) {
        console.error("[VixCloud] Extraction error:", e);
        return [];
    }
}

module.exports = { extractVixCloud };
