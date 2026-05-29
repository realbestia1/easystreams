const { USER_AGENT } = require('./common');

const VIDXGO_HEADERS = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Sec-GPC": "1",
  "Alt-Used": "v.vidxgo.co",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "iframe",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "DNT": "1",
  "Priority": "u=0, i",
};

function xorDecrypt(b64, key) {
  const decoded = Buffer.from(b64, 'base64');
  const result = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    result[i] = decoded[i] ^ key.charCodeAt(i % key.length);
  }
  return result.toString('utf-8');
}

const XOR_PATTERN = /var\s+\w+\s*=\s*'([\w]+)'\s*,?\s*d\s*=\s*atob\s*\(\s*'([A-Za-z0-9+/=]+)'\s*\)/g;
const CURRENT_SRC_PATTERN = /\bcurrentSrc\s*=\s*["'](https?:[^"']+?\.m3u8[^"']*)["']/;
const CORRUPT_PLAYER_PATTERN = /player-container[^>]*\bcorrupt\b/i;

async function extractVidxGo(url, referer = 'https://altadefinizione.you/') {
  try {
    if (url.startsWith("//")) url = "https:" + url;

    const headers = { ...VIDXGO_HEADERS, "Referer": referer };
    const resp = await fetch(url, { headers, redirect: 'follow' });
    if (!resp.ok) {
      console.warn("[VidxGo] HTTP", resp.status, "for", url);
      return { url, headers: { "User-Agent": USER_AGENT, "Referer": referer } };
    }

    const html = await resp.text();
    let match;
    XOR_PATTERN.lastIndex = 0;
    while ((match = XOR_PATTERN.exec(html)) !== null) {
      try {
        const decrypted = xorDecrypt(match[2], match[1]);
        const streamMatch = decrypted.match(CURRENT_SRC_PATTERN);
        if (streamMatch) {
          const streamUrl = streamMatch[1].replace(/\\/g, '');
          const vidxgoOrigin = new URL(url).origin;
          return {
            url: streamUrl,
            headers: {
              "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0",
              "Referer": url,
              "Origin": vidxgoOrigin,
              "Accept": "*/*",
              "Accept-Language": "en-US,en;q=0.9",
              "Sec-GPC": "1",
              "Sec-Fetch-Dest": "empty",
              "Sec-Fetch-Mode": "cors",
              "Sec-Fetch-Site": "cross-site",
              "DNT": "1",
              "Priority": "u=0"
            }
          };
        }
      } catch (e) {
        continue;
      }
    }

    if (CORRUPT_PLAYER_PATTERN.test(html)) {
      console.warn("[VidxGo] Source is marked corrupt or not available");
      return null;
    }

    console.warn("[VidxGo] No stream URL found in page");
    return { url, headers: { "User-Agent": USER_AGENT, "Referer": referer } };
  } catch (e) {
    console.error("[VidxGo] Extraction error:", e);
    return null;
  }
}
module.exports = { extractVidxGo, VIDXGO_HEADERS, CORRUPT_PLAYER_PATTERN };
