const { USER_AGENT, unPack } = require('./common');

function isMixDropDisabled() {
  if (typeof global !== 'undefined' && global && global.DISABLE_MIXDROP === true) {
    return true;
  }

  const rawEnv =
    typeof process !== 'undefined' &&
    process &&
    process.env &&
    typeof process.env.DISABLE_MIXDROP === 'string'
      ? process.env.DISABLE_MIXDROP.trim().toLowerCase()
      : '';

  return ['1', 'true', 'yes', 'on'].includes(rawEnv);
}

function normalizeUrl(url, baseUrl) {
  try {
    return new URL(String(url || ''), baseUrl).toString();
  } catch {
    return null;
  }
}

function extractPackedStream(html) {
  const packedRegex = /eval\(function\(p,a,c,k,e,d\)\s*\{.*?\}\s*\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\),(\d+),(\{\})\)\)/;
  const match = packedRegex.exec(String(html || ''));
  if (!match) return null;

  const p = match[1];
  const a = parseInt(match[2]);
  const c = parseInt(match[3]);
  const k = match[4].split("|");
  const unpacked = unPack(p, a, c, k, null, {});
  const wurlMatch = unpacked.match(/wurl\s*=\s*["']([^"']+)["']/);
  if (!wurlMatch) return null;

  let streamUrl = wurlMatch[1];
  if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
  return streamUrl;
}

function extractEmbedUrl(html, pageUrl) {
  const match = String(html || '').match(/<iframe\b[^>]+src=["']([^"']*\/e\/[^"']+)["']/i);
  if (match) return normalizeUrl(match[1], pageUrl);

  const converted = String(pageUrl || '').replace(/\/f\//i, '/e/');
  return converted !== pageUrl ? converted : null;
}

async function extractMixDrop(url, refererBase = 'https://m1xdrop.net/') {
  if (isMixDropDisabled()) return null;

  try {
    if (url.startsWith("//")) url = "https:" + url;

    const fetchHtml = async (targetUrl, referer) => {
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": referer
        }
      });
      if (!response.ok) return null;
      return {
        url: response.url || targetUrl,
        html: await response.text()
      };
    };

    let page = await fetchHtml(url, refererBase);
    if (!page) return null;

    let streamUrl = extractPackedStream(page.html);
    let pageUrl = page.url;

    if (!streamUrl) {
      const embedUrl = extractEmbedUrl(page.html, pageUrl);
      if (embedUrl && embedUrl !== pageUrl) {
        const embedPage = await fetchHtml(embedUrl, pageUrl);
        if (embedPage) {
          page = embedPage;
          pageUrl = embedPage.url;
          streamUrl = extractPackedStream(embedPage.html);
        }
      }
    }

    if (!streamUrl) return null;

    const origin = (() => {
      try { return new URL(pageUrl).origin; } catch { return 'https://m1xdrop.net'; }
    })();

    return {
      url: streamUrl,
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': pageUrl,
        'Origin': origin
      }
    };
  } catch (e) {
    console.error("[Extractors] MixDrop extraction error:", e);
    return null;
  }
}

module.exports = { extractMixDrop };
