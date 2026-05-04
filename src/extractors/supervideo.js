const { USER_AGENT, unPack, getProxiedUrl } = require('./common');

async function extractSuperVideo(url, refererBase = null) {
  try {
    if (url.startsWith("//")) url = "https:" + url;
    
    // Extract ID and force .tv domain and embed format
    // URLs can be: supervideo.cc/y/ID, supervideo.cc/e/ID, supervideo.cc/ID
    const id = url.split('/').pop();
    const embedUrl = `https://supervideo.tv/e/${id}`;
    
    if (!refererBase) refererBase = "https://supervideo.tv/";

    // Use proxy for the initial fetch to bypass Cloudflare if configured
    const proxiedUrl = getProxiedUrl(embedUrl);

    let response = await fetch(proxiedUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        "Referer": refererBase
      }
    });
    let html = await response.text();

    if (html.includes("Cloudflare") || response.status === 403) {
      console.log(`[Extractors] SuperVideo (tv) returned 403/Cloudflare`);
      return null;
    }
    const packedRegex = /eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
    const match = packedRegex.exec(html);
    if (match) {
      const p = match[1];
      const a = parseInt(match[2]);
      const c = parseInt(match[3]);
      const k = match[4].split("|");
      const unpacked = unPack(p, a, c, k, null, {});
      const fileMatch = unpacked.match(/sources:\[\{file:"(.*?)"/);
      if (fileMatch) {
        let streamUrl = fileMatch[1];
        if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
        let playbackReferer = refererBase;
        try {
          playbackReferer = new URL(streamUrl).origin + "/";
        } catch (_) {
          playbackReferer = refererBase || "https://supervideo.tv/";
        }

        return {
          url: streamUrl,
          headers: {
            "Referer": playbackReferer
          }
        };
      }
    }
    return null;
  } catch (e) {
    console.error("[Extractors] SuperVideo extraction error:", e);
    return null;
  }
}

module.exports = { extractSuperVideo };
