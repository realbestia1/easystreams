const { USER_AGENT } = require('./common');

async function extractStreamTape(url) {
  try {
    if (url.startsWith("//")) url = "https:" + url;
    const response = await fetch(url);
    if (!response.ok) return null;
    const html = await response.text();
    const match = html.match(/document\.getElementById\('robotlink'\)\.innerHTML = '(.*?)'/);
    if (match) {
      let link = match[1];
      const lineMatch = html.match(/document\.getElementById\('robotlink'\)\.innerHTML = (.*);/);
      if (lineMatch) {
        const raw = lineMatch[1];
        const cleanLink = raw.replace(/['"\+\s]/g, "");
        if (cleanLink.startsWith("//")) return "https:" + cleanLink;
        if (cleanLink.startsWith("http")) return cleanLink;
      }
    }
    return null;
  } catch (e) {
    console.error("[Extractors] StreamTape extraction error:", e);
    return null;
  }
}

module.exports = { extractStreamTape };
