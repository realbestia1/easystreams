async function extractVidoza(url) {
  try {
    if (url.startsWith("//")) url = "https:" + url;
    const response = await fetch(url);
    if (!response.ok) return null;
    const html = await response.text();
    // Try different regex patterns commonly used by Vidoza
    let match = html.match(/sources:\s*\[\s*\{\s*file:\s*"(.*?)"/);
    if (!match) {
        match = html.match(/source src="(.*?)"/);
    }
    
    if (match) {
      let streamUrl = match[1];
      if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
      return streamUrl;
    }
    return null;
  } catch (e) {
    console.error("[Extractors] Vidoza extraction error:", e);
    return null;
  }
}

module.exports = { extractVidoza };
