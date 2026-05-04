const { USER_AGENT } = require('./common');

function isUqloadDisabled() {
  if (typeof global !== 'undefined' && global && global.DISABLE_UQLOAD === true) {
    return true;
  }

  const rawEnv =
    typeof process !== 'undefined' &&
    process &&
    process.env &&
    typeof process.env.DISABLE_UQLOAD === 'string'
      ? process.env.DISABLE_UQLOAD.trim().toLowerCase()
      : '';

  return ['1', 'true', 'yes', 'on'].includes(rawEnv);
}

async function extractUqload(url, refererBase = 'https://uqload.io/') {
  if (isUqloadDisabled()) return null;

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
    const regex = /sources: \["(.*?)"\]/;
    const match = regex.exec(html);
    if (match) {
      let streamUrl = match[1];
      if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
      return {
        url: streamUrl,
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": "https://uqload.io/"
        }
      };
    }
    return null;
  } catch (e) {
    console.error("[Extractors] Uqload extraction error:", e);
    return null;
  }
}

module.exports = { extractUqload };
