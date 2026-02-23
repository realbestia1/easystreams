
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

async function checkQualityFromPlaylist(url, headers = {}) {
  try {
    if (!url.includes('.m3u8')) return null;
    
    const finalHeaders = { ...headers };
    if (!finalHeaders['User-Agent']) {
        finalHeaders['User-Agent'] = USER_AGENT;
    }
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); 

    const response = await fetch(url, { 
      headers: finalHeaders,
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const text = await response.text();

    const quality = checkQualityFromText(text);
    
    if (quality) console.log(`[QualityHelper] Detected ${quality} from playlist: ${url}`);
    return quality;
  } catch (e) {
    return null;
  }
}

function checkQualityFromText(text) {
    if (!text) return null;
    if (/RESOLUTION=\d+x2160/i.test(text) || /RESOLUTION=2160/i.test(text)) return '4K';
    if (/RESOLUTION=\d+x1440/i.test(text) || /RESOLUTION=1440/i.test(text)) return '1440p';
    if (/RESOLUTION=\d+x1080/i.test(text) || /RESOLUTION=1080/i.test(text)) return '1080p';
    if (/RESOLUTION=\d+x720/i.test(text) || /RESOLUTION=720/i.test(text)) return '720p';
    if (/RESOLUTION=\d+x480/i.test(text) || /RESOLUTION=480/i.test(text)) return '480p';
    return null;
}

function getQualityFromUrl(url) {
    if (!url) return null;
    const urlPath = url.split('?')[0].toLowerCase();
    
    if (urlPath.includes("4k") || urlPath.includes("2160")) return "4K";
    if (urlPath.includes("1440") || urlPath.includes("2k")) return "1440p";
    if (urlPath.includes("1080") || urlPath.includes("fhd")) return "1080p";
    if (urlPath.includes("720") || urlPath.includes("hd")) return "720p";
    if (urlPath.includes("480") || urlPath.includes("sd")) return "480p";
    if (urlPath.includes("360")) return "360p";
    
    return null; // Don't default to HD, return null so provider can decide fallback
}

module.exports = { checkQualityFromPlaylist, getQualityFromUrl, checkQualityFromText };
