const { USER_AGENT, unPack } = require('./common');

async function extractUpstream(url, refererBase = 'https://upstream.to/') {
  try {
    if (url.startsWith("//")) url = "https:" + url;
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Referer": refererBase
      }
    });
    if (!response.ok) return null;
    const html = await response.text();
    const packedRegex = /eval\(function\(p,a,c,k,e,d\)\s*\{.*?\}\s*\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
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
        return {
          url: streamUrl,
          headers: {
            "User-Agent": USER_AGENT,
            "Referer": "https://upstream.to/"
          }
        };
      }
    }
    return null;
  } catch (e) {
    console.error("[Extractors] Upstream extraction error:", e);
    return null;
  }
}

module.exports = { extractUpstream };
