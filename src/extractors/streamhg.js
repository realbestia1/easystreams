const { USER_AGENT, unPack, getProxiedUrl } = require('./common');

function resolveAbsoluteUrl(candidate, baseUrl) {
  if (!candidate) return null;
  try {
    return new URL(candidate, baseUrl).toString();
  } catch (_) {
    return null;
  }
}

function getOrigin(url) {
  try {
    return new URL(url).origin;
  } catch (_) {
    return null;
  }
}

function getBaseHeaders(referer) {
  const headers = {
    "User-Agent": USER_AGENT
  };
  if (referer) headers["Referer"] = referer;
  return headers;
}

async function extractStreamHG(url, refererBase = null) {
  try {
    if (url.startsWith("//")) url = "https:" + url;
    const initialReferer = refererBase || `${getOrigin(url) || 'https://dhcplay.com'}/`;
    const candidates = [url];
    try {
      const parsed = new URL(url);
      const idMatch = parsed.pathname.match(/\/e\/([^/?#]+)/i);
      if (idMatch && /(^|\.)dhcplay\.com$/i.test(parsed.hostname)) {
        candidates.push(`https://vibuxer.com/e/${idMatch[1]}`);
      }
    } catch (_) {
      // ignore
    }

    let finalUrl = null;
    let packedMatch = null;
    for (const candidate of candidates) {
      const response = await fetch(getProxiedUrl(candidate), {
        headers: getBaseHeaders(initialReferer),
        redirect: 'follow'
      });
      if (!response.ok) continue;

      const html = await response.text();
      const match = html.match(/eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/s);
      if (!match) continue;

      finalUrl = response.url || candidate;
      packedMatch = match;
      break;
    }

    if (!packedMatch || !finalUrl) return null;

    const p = packedMatch[1];
    const a = parseInt(packedMatch[2], 10);
    const c = parseInt(packedMatch[3], 10);
    const k = packedMatch[4].split('|');
    const unpacked = unPack(p, a, c, k, null, {});

    let streamUrl = null;
    const hls2Match = unpacked.match(/["']hls2["']\s*:\s*["']([^"']+)["']/i);
    const hls4Match = unpacked.match(/["']hls4["']\s*:\s*["']([^"']+)["']/i);
    const fileMatch = unpacked.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i);
    // Prefer hls2: hls4 may point to ad/image playlists on StreamHG mirrors.
    streamUrl = (hls2Match && hls2Match[1]) || (hls4Match && hls4Match[1]) || (fileMatch && fileMatch[1]) || null;
    streamUrl = resolveAbsoluteUrl(streamUrl, finalUrl);
    if (!streamUrl) return null;

    return {
      url: streamUrl
    };
  } catch (e) {
    console.error("[Extractors] StreamHG extraction error:", e);
    return null;
  }
}

module.exports = { extractStreamHG };
