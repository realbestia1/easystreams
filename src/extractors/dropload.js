const { USER_AGENT, unPack } = require('./common');

async function extractDropLoad(url, refererBase = null) {
  try {
    if (url.startsWith("//")) url = "https:" + url;
    if (!refererBase) {
      const match = url.match(/^(https?:\/\/[^\/]+)/i);
      refererBase = (match ? match[1] : '') + "/";
    }
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Referer": refererBase
      }
    });
    if (!response.ok) return null;
    const html = await response.text();
        
    const regex = /eval\(function\(p,a,c,k,e,d\)\s*\{.*?\}\s*\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('([\\|]*)'\)/;
    const match = regex.exec(html);
    if (match) {
      const p = match[1];
      const a = parseInt(match[2]);
      const c = parseInt(match[3]);
      const separator = match[5] || '|';
      const k = match[4].split(separator);
      const unpacked = unPack(p, a, c, k, null, {});
      const fileMatch = unpacked.match(/file\s*:\s*["'](.*?)["']/);
      if (fileMatch) {
        let streamUrl = fileMatch[1];
        if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
        
        const originMatch = url.match(/^(https?:\/\/[^\/]+)/i);
        const origin = originMatch ? originMatch[1] : '';
        
        return {
          url: streamUrl,
          headers: {
            "User-Agent": USER_AGENT,
            "Referer": url,
            "Origin": origin
          }
        };
      }
    }
    return null;
  } catch (e) {
    const errorCode = (e && e.code) || (e && e.cause && e.cause.code);
    if (errorCode === "ENOTFOUND") return null;
    console.error("[Extractors] DropLoad extraction error:", e);
    return null;
  }
}

module.exports = { extractDropLoad };
