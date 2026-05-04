const { USER_AGENT, isFlareSolverrBlockedError } = require('./common');
const { smartFetch } = require('../utils/cf_handler');
const { solveNumericCaptcha } = require('../utils/ocr');

function isDeadDeltaBitRedirectUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase().includes('deltabit.') &&
      /^\/a?delta\//i.test(parsed.pathname);
  } catch {
    return false;
  }
}

async function extractDeltaBit(url, refererBase = 'https://eurostreamings.help/') {
  try {
    let targetUrl = url;
    if (targetUrl.startsWith("//")) targetUrl = "https:" + targetUrl;

    // 1. Resolve redirectors (safego.cc, clicka.cc, etc.)
    let redirectLoopCount = 0;
    while (redirectLoopCount < 3 && (targetUrl.includes('safego.cc') || targetUrl.includes('clicka.cc'))) {
        redirectLoopCount++;
        const fetchMeta = {};
        const html = await smartFetch(targetUrl, 'clicka', {
            meta: fetchMeta,
            quietHttpErrors: [404],
            headers: { "User-Agent": USER_AGENT, "Referer": refererBase }
        });
        if (!html) break;

        if (fetchMeta.finalUrl && fetchMeta.finalUrl !== targetUrl) {
            targetUrl = fetchMeta.finalUrl;
            if (isDeadDeltaBitRedirectUrl(targetUrl)) {
                console.warn(`[DeltaBit] Redirector finale non valido: ${targetUrl}`);
                return null;
            }
            if (targetUrl.includes('deltabit.')) break;
            if (targetUrl.includes('safego.cc') || targetUrl.includes('clicka.cc')) continue;
        }
        
        // Look for the next link (deltabit or another redirector)
        const nextMatch = html.match(/https?:\/\/(?:deltabit|safego|clicka)\.[a-z]+\/[a-zA-Z0-9?=_&%-]+/i);
        if (nextMatch) {
            targetUrl = nextMatch[0].replace(/&amp;/g, '&');
            if (isDeadDeltaBitRedirectUrl(targetUrl)) {
                console.warn(`[DeltaBit] Redirector finale non valido: ${targetUrl}`);
                return null;
            }
            if (targetUrl.includes('deltabit.')) break; // Found the final destination
        } else {
            // Check for meta refresh
            const refreshMatch = html.match(/url=(https?:\/\/[^"']+)/i);
            if (refreshMatch) {
                targetUrl = refreshMatch[1].replace(/&amp;/g, '&');
            } else {
                break;
            }
        }
    }

    if (isDeadDeltaBitRedirectUrl(targetUrl)) {
      console.warn(`[DeltaBit] Redirector finale non valido: ${targetUrl}`);
      return null;
    }

    // 2. GET the initial page
    const html = await smartFetch(targetUrl, 'deltabit', {
      quietHttpErrors: [404],
      headers: {
        "User-Agent": USER_AGENT,
        "Referer": refererBase
      }
    });
    if (!html) return null;

    // 3. Check for direct sources first
    const directMatch = html.match(/sources:\s*\["([^"]+)"/);
    if (directMatch) {
      return {
        url: directMatch[1],
        headers: {
          'User-Agent': USER_AGENT,
          'Referer': targetUrl
        }
      };
    }

    // 4. Extract form data for POST (waiting logic)
    const opMatch = html.match(/name="op" value="([^"]+)"/);
    const idMatch = html.match(/name="id" value="([^"]+)"/);
    
    if (opMatch && idMatch) {
        const op = opMatch[1];
        const id = idMatch[1];
        
        // Prepare form data
        const formData = new URLSearchParams();
        const hiddenRegex = /<input type="hidden" name="([^"]+)" value="([^"]*)"/g;
        let match;
        const allFields = {};
        while ((match = hiddenRegex.exec(html)) !== null) {
            allFields[match[1]] = match[2];
        }
        
        // Ensure required fields are set
        allFields['op'] = allFields['op'] || op;
        allFields['id'] = allFields['id'] || id;
        allFields['imhuman'] = '';
        allFields['referer'] = targetUrl;

        for (const key in allFields) {
            formData.append(key, allFields[key]);
        }

        // 5. Check for numeric captcha
        const captchaMatch = html.match(/<img[^>]+src=["']([^"']*captcha[^"']*)["']/i);
        if (captchaMatch) {
            let captchaUrl = captchaMatch[1];
            if (captchaUrl.startsWith('/')) {
                const urlObj = new URL(targetUrl);
                captchaUrl = `${urlObj.origin}${captchaUrl}`;
            }
            
            try {
                // Fetch captcha image via smartFetch (responseType: arraybuffer)
                const imgData = await smartFetch(captchaUrl, 'deltabit', { 
                    headers: { "Referer": targetUrl },
                    responseType: 'arraybuffer'
                });
                
                // Convert buffer to base64
                const base64 = Buffer.isBuffer(imgData) 
                    ? imgData.toString('base64') 
                    : Buffer.from(imgData).toString('base64');
                
                // Solve via local OCR engine
                const captchaCode = await solveNumericCaptcha(base64);
                
                if (captchaCode) {
                    console.log(`[DeltaBit] Captcha risolto (locale): ${captchaCode}`);
                    formData.set('code', captchaCode);
                }
            } catch (ocrErr) {
                console.error("[DeltaBit] Errore OCR locale:", ocrErr.message);
            }
        }

        // Wait for server validation (as seen in EasyProxy)
        await new Promise(resolve => setTimeout(resolve, 3500));

        // POST to get the final page
        const postHtml = await smartFetch(targetUrl, 'deltabit', {
            method: 'POST',
            quietHttpErrors: [404],
            headers: {
                "User-Agent": USER_AGENT,
                "Referer": targetUrl,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: formData.toString()
        });
        
        if (!postHtml) return null;
        
        const finalMatch = postHtml.match(/sources:\s*\["([^"]+)"/);
        if (finalMatch) {
            return {
                url: finalMatch[1],
                headers: {
                    'User-Agent': USER_AGENT,
                    'Referer': targetUrl
                }
            };
        }
    }

    return null;
  } catch (e) {
    if (e && e.response && e.response.status === 404) {
      console.warn(`[DeltaBit] Link non trovato: ${e.response.url || url}`);
      return null;
    }
    if (isFlareSolverrBlockedError(e)) {
      console.warn("[Extractors] DeltaBit extraction skipped:", e && e.message ? e.message : e);
      return null;
    }
    console.error("[Extractors] DeltaBit extraction error:", e && e.message ? e.message : e);
    return null;
  }
}

module.exports = { extractDeltaBit };
