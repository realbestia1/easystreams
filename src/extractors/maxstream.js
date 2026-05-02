const { USER_AGENT, unPack } = require('./common');
const { smartFetch } = require('../utils/cf_handler');

async function extractMaxStream(url, refererBase = 'https://uprot.net/') {
  try {
    let targetUrl = url;
    if (targetUrl.startsWith("//")) targetUrl = "https:" + targetUrl;

    // Se è un link uprot.net, cerchiamo il redirect a maxstream/stayonline
    if (targetUrl.includes('uprot.net')) {
        targetUrl = targetUrl.replace('/msf/', '/mse/');
        
        const html = await smartFetch(targetUrl, 'uprot', {
            headers: { "User-Agent": USER_AGENT, "Referer": refererBase }
        });
        if (!html) return null;
        
        const redirectMatch = html.match(/https?:\/\/(?:www\.)?(?:stayonline\.pro|maxstream\.video)[^"'\s<>\\ ]+/);
        if (redirectMatch) {
            targetUrl = redirectMatch[0].replace(/\\/g, '');
        } else {
            const jsMatch = html.match(/window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/);
            if (jsMatch) {
                targetUrl = jsMatch[1];
            } else {
                const btnMatch = html.match(/href=["']([^"']+(?:maxstream|stayonline)[^"']*)["']/i);
                if (btnMatch) targetUrl = btnMatch[1];
                else return null;
            }
        }
    }

    // Carichiamo la pagina finale (maxstream o stayonline)
    const provider = targetUrl.includes('stayonline') ? 'stayonline' : 'maxstream';
    const html = await smartFetch(targetUrl, provider, {
      headers: {
        "User-Agent": USER_AGENT,
        "Referer": "https://uprot.net/",
        "Accept-Language": "en-US,en;q=0.5"
      }
    });
    if (!html) return null;

    // Direct sources check
    const directMatch = html.match(/sources:\s*\[\{src:\s*"([^"]+)"/);
    if (directMatch) {
      return {
        url: directMatch[1],
        headers: {
          'User-Agent': USER_AGENT,
          'Referer': targetUrl
        }
      };
    }

    // Packed script check
    const packedRegex = /eval\(function\(p,a,c,k,e,d\)\s*\{.*?\}\s*\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\),(\d+),(\{\})\)\)/;
    const match = packedRegex.exec(html);
    if (match) {
        const p = match[1];
        const a = parseInt(match[2]);
        const c = parseInt(match[3]);
        const k = match[4].split("|");
        const unpacked = unPack(p, a, c, k, null, {});
        
        // Reconstruct URL from unpacked components if direct URL not found
        // MaxStream often has a specific reconstruction logic in Python, 
        // but often the unpacked script contains the direct URL too.
        const srcMatch = unpacked.match(/src:["']([^"']+)["']/);
        if (srcMatch) {
            return {
                url: srcMatch[1],
                headers: {
                    'User-Agent': USER_AGENT,
                    'Referer': targetUrl
                }
            };
        }

        // Manual reconstruction if needed (based on Python logic)
        try {
            const urlsetIdx = k.indexOf("urlset");
            const hlsIdx = k.indexOf("hls");
            const sourcesIdx = k.indexOf("sources");
            
            if (urlsetIdx !== -1 && hlsIdx !== -1 && sourcesIdx !== -1) {
                const result = k.slice(urlsetIdx + 1, hlsIdx);
                const reversedElements = result.reverse();
                const firstPartTerms = k.slice(hlsIdx + 1, sourcesIdx);
                const reversedFirstPart = firstPartTerms.reverse();
                
                let firstUrlPart = "";
                for (const fp of reversedFirstPart) {
                    if (fp.includes("0")) {
                        firstUrlPart += fp;
                    } else {
                        firstUrlPart += fp + "-";
                    }
                }
                
                const baseUrl = `https://${firstUrlPart.replace(/-$/, '')}.host-cdn.net/hls/`;
                let finalUrl = "";
                if (reversedElements.length === 1) {
                    finalUrl = baseUrl + "," + reversedElements[0] + ".urlset/master.m3u8";
                } else {
                    finalUrl = baseUrl + reversedElements.join(",") + ".urlset/master.m3u8";
                }
                
                return {
                    url: finalUrl,
                    headers: {
                        'User-Agent': USER_AGENT,
                        'Referer': targetUrl
                    }
                };
            }
        } catch (e) {
            console.error("[Extractors] MaxStream manual reconstruction failed:", e);
        }
    }

    return null;
  } catch (e) {
    console.error("[Extractors] MaxStream extraction error:", e);
    return null;
  }
}

module.exports = { extractMaxStream };
