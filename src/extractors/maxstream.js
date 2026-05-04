const { USER_AGENT, unPack } = require('./common');
const { smartFetch } = require('../utils/cf_handler');
const axios = require('axios');

let solveNumericCaptcha = null;
try {
  solveNumericCaptcha = require('../utils/ocr').solveNumericCaptcha;
} catch {}

function normalizeUrl(url, baseUrl) {
  try {
    return new URL(String(url || ''), baseUrl).toString();
  } catch {
    return null;
  }
}

function getCookieHeader(setCookie) {
  if (!Array.isArray(setCookie)) return '';
  return setCookie.map(cookie => String(cookie).split(';')[0]).filter(Boolean).join('; ');
}

function extractUprotRedirect(html) {
  const text = String(html || '');
  const anchorRegex = /<a\b[^>]+href=["']([^"']*(?:stayonline\.pro|maxstream\.video)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let anchorMatch;
  while ((anchorMatch = anchorRegex.exec(text)) !== null) {
    const label = String(anchorMatch[2] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (/(?:C0NTINUE|CONTINUE)/i.test(label)) return anchorMatch[1].replace(/\\/g, '');
  }

  const redirectMatch = text.match(/https?:\/\/(?:www\.)?(?:stayonline\.pro|maxstream\.video)[^"'\s<>\\ ]+/i);
  if (redirectMatch) return redirectMatch[0].replace(/\\/g, '');

  const jsMatch = text.match(/window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/i);
  if (jsMatch) return jsMatch[1].replace(/\\/g, '');

  const btnMatch = text.match(/href=["']([^"']+(?:maxstream|stayonline)[^"']*)["']/i);
  return btnMatch ? btnMatch[1].replace(/\\/g, '') : null;
}

function extractInputFields(html) {
  const fields = {};
  const inputRegex = /<input\b[^>]*>/gi;
  let match;
  while ((match = inputRegex.exec(String(html || ''))) !== null) {
    const inputHtml = match[0] || '';
    const name = inputHtml.match(/\bname=["']([^"']+)["']/i)?.[1];
    if (!name) continue;
    const value = inputHtml.match(/\bvalue=["']([^"']*)["']/i)?.[1] || '';
    fields[name] = value.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&');
  }
  return fields;
}

function findCaptchaFieldName(html, fields) {
  const names = Object.keys(fields || {});
  const explicit = names.find(name => /capt|captcha|code/i.test(name));
  if (explicit) return explicit;

  const inputRegex = /<input\b[^>]*>/gi;
  let match;
  while ((match = inputRegex.exec(String(html || ''))) !== null) {
    const inputHtml = match[0] || '';
    const name = inputHtml.match(/\bname=["']([^"']+)["']/i)?.[1];
    if (!name) continue;
    const type = inputHtml.match(/\btype=["']([^"']+)["']/i)?.[1] || 'text';
    const placeholder = inputHtml.match(/\bplaceholder=["']([^"']+)["']/i)?.[1] || '';
    if (!/hidden|submit|button/i.test(type) && /number|capt|code|insert/i.test(placeholder)) {
      return name;
    }
  }

  return 'captcha';
}

function hasUprotCaptcha(html) {
  const text = String(html || '');
  return /data:image\/[^;]+;base64,/i.test(text) &&
    /<input\b[^>]*\bname=["'][^"']*(?:capt|captcha|code)[^"']*["']/i.test(text);
}

function isFlareSolverrBlockedError(error) {
  const message = String(error && error.message || error || '');
  return /FlareSolverr in cooldown|Request failed with status code 500|Cloudflare has blocked/i.test(message);
}

async function solveUprotCaptchaRedirect(html, targetUrl, postRequest) {
  const directRedirect = extractUprotRedirect(html);
  if (directRedirect && !hasUprotCaptcha(html)) return directRedirect;

  const captchaMatch = String(html || '').match(/<img[^>]+src=["']data:image\/[^;]+;base64,([^"']+)["'][^>]*>/i);
  if (!captchaMatch || !solveNumericCaptcha) return directRedirect || null;

  const captchaCode = await solveNumericCaptcha(captchaMatch[1]);
  if (!/^\d{3,6}$/.test(String(captchaCode || ''))) return directRedirect || null;

  const formFields = extractInputFields(html);
  const captchaFieldName = findCaptchaFieldName(html, formFields);
  formFields[captchaFieldName] = captchaCode;

  const postResult = await postRequest(new URLSearchParams(formFields).toString());
  const postRedirect = postResult && postResult.location
    ? normalizeUrl(postResult.location, targetUrl)
    : extractUprotRedirect(postResult && postResult.data);
  return postRedirect || directRedirect || null;
}

function extractEmbedUrl(html, targetUrl) {
  const targetEmbed = String(targetUrl || '').match(/^https?:\/\/(?:www\.)?maxstream\.video\/emhuih\/([a-z0-9]+)/i);
  if (targetEmbed) return `https://maxstream.video/emhuih/${targetEmbed[1]}`;

  const text = String(html || '');
  const iframeMatch =
    text.match(/src=["'](https?:\/\/(?:www\.)?maxstream\.video\/emhuih\/([a-z0-9]+)[^"']*)["']/i) ||
    text.match(/src=["'](\/emhuih\/([a-z0-9]+)[^"']*)["']/i);
  if (iframeMatch) return normalizeUrl(iframeMatch[1], targetUrl || 'https://maxstream.video/');

  const fileCodeMatch =
    text.match(/[?&]file_code=([a-z0-9]+)/i) ||
    text.match(/\bfile_code["']?\s*[:=]\s*["']?([a-z0-9]+)/i);
  return fileCodeMatch ? `https://maxstream.video/emhuih/${fileCodeMatch[1]}` : null;
}

function parseMaxStreamHtml(html, targetUrl, sourceUrl = null) {
  const canonicalUrl = sourceUrl || extractEmbedUrl(html, targetUrl);
  const directMatch = String(html || '').match(/sources:\s*\[\{src:\s*"([^"]+)"/);
  if (directMatch) {
    return {
      url: directMatch[1],
      sourceUrl: canonicalUrl || targetUrl,
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': targetUrl
      }
    };
  }

  const packedRegex = /eval\(function\(p,a,c,k,e,d\)\s*\{.*?\}\s*\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\),(\d+),(\{\})\)\)/;
  const match = packedRegex.exec(String(html || ''));
  if (match) {
    const p = match[1];
    const a = parseInt(match[2]);
    const c = parseInt(match[3]);
    const k = match[4].split('|');
    const unpacked = unPack(p, a, c, k, null, {});

    const srcMatch = unpacked.match(/src:["']([^"']+)["']/);
    if (srcMatch) {
      return {
        url: srcMatch[1],
        sourceUrl: canonicalUrl || targetUrl,
        headers: {
          'User-Agent': USER_AGENT,
          'Referer': targetUrl
        }
      };
    }

    try {
      const urlsetIdx = k.indexOf('urlset');
      const hlsIdx = k.indexOf('hls');
      const sourcesIdx = k.indexOf('sources');

      if (urlsetIdx !== -1 && hlsIdx !== -1 && sourcesIdx !== -1) {
        const result = k.slice(urlsetIdx + 1, hlsIdx);
        const reversedElements = result.reverse();
        const firstPartTerms = k.slice(hlsIdx + 1, sourcesIdx);
        const reversedFirstPart = firstPartTerms.reverse();

        let firstUrlPart = '';
        for (const fp of reversedFirstPart) {
          if (fp.includes('0')) {
            firstUrlPart += fp;
          } else {
            firstUrlPart += `${fp}-`;
          }
        }

        const baseUrl = `https://${firstUrlPart.replace(/-$/, '')}.host-cdn.net/hls/`;
        const finalUrl = reversedElements.length === 1
          ? `${baseUrl},${reversedElements[0]}.urlset/master.m3u8`
          : `${baseUrl}${reversedElements.join(',')}.urlset/master.m3u8`;

        return {
          url: finalUrl,
          sourceUrl: canonicalUrl || targetUrl,
          headers: {
            'User-Agent': USER_AGENT,
            'Referer': targetUrl
          }
        };
      }
    } catch (e) {
      console.error('[Extractors] MaxStream manual reconstruction failed:', e);
    }
  }

  return canonicalUrl ? { canonicalUrl } : null;
}

async function resolveUprotProtectedUrl(targetUrl, refererBase) {
  const headers = {
    'User-Agent': USER_AGENT,
    'Referer': refererBase,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  };

  let lastDirectRedirect = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await axios({
        url: targetUrl,
        method: 'GET',
        headers,
        maxRedirects: 0,
        timeout: 20000,
        validateStatus: false
      });
      const html = String(response.data || '');
      const directRedirect = extractUprotRedirect(html);
      if (directRedirect) lastDirectRedirect = directRedirect;

      const cookieHeader = getCookieHeader(response.headers && response.headers['set-cookie']);
      const postRedirect = await solveUprotCaptchaRedirect(html, targetUrl, async (body) => {
        const postHeaders = {
          ...headers,
          'Referer': targetUrl,
          'Origin': new URL(targetUrl).origin,
          'Content-Type': 'application/x-www-form-urlencoded'
        };
        if (cookieHeader) postHeaders.Cookie = cookieHeader;

        const postResponse = await axios({
          url: targetUrl,
          method: 'POST',
          data: body,
          headers: postHeaders,
          maxRedirects: 0,
          timeout: 20000,
          validateStatus: false
        });
        return {
          location: postResponse.headers && postResponse.headers.location,
          data: postResponse.data
        };
      });
      if (postRedirect) return postRedirect;
    } catch (e) {
      if (attempt === 2) console.error('[Extractors] Uprot captcha resolution failed:', e.message);
    }
  }

  try {
    const html = await smartFetch(targetUrl, 'uprot', {
      provider: 'uprot',
      headers
    });
    const smartRedirect = await solveUprotCaptchaRedirect(html, targetUrl, async (body) => {
      const postHtml = await smartFetch(targetUrl, 'uprot', {
        provider: 'uprot',
        method: 'POST',
        body,
        headers: {
          ...headers,
          'Referer': targetUrl,
          'Origin': new URL(targetUrl).origin,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      return { data: postHtml };
    });
    if (smartRedirect) return smartRedirect;
  } catch (e) {
    if (isFlareSolverrBlockedError(e)) {
      console.warn('[Extractors] Uprot smart captcha resolution skipped:', e.message);
    } else {
      console.error('[Extractors] Uprot smart captcha resolution failed:', e.message);
    }
  }

  return lastDirectRedirect || null;
}

async function extractMaxStream(url, refererBase = 'https://uprot.net/') {
  try {
    let targetUrl = url;
    if (targetUrl.startsWith('//')) targetUrl = `https:${targetUrl}`;

    if (targetUrl.includes('uprot.net')) {
      targetUrl = targetUrl.replace('/msf/', '/mse/');
      const isProtectedUprot = /\/(?:msd|msei|msfi|mseild|msefd)\//i.test(targetUrl);

      const protectedRedirect = await resolveUprotProtectedUrl(targetUrl, refererBase);
      if (protectedRedirect) {
        targetUrl = protectedRedirect;
      } else if (isProtectedUprot) {
        return null;
      } else {
        let html;
        try {
          html = await smartFetch(targetUrl, 'uprot', {
            headers: { 'User-Agent': USER_AGENT, 'Referer': refererBase }
          });
        } catch (e) {
          if (isFlareSolverrBlockedError(e)) {
            console.warn('[Extractors] Uprot redirect fetch skipped:', e.message);
            return null;
          }
          throw e;
        }
        if (!html) return null;

        const redirectUrl = extractUprotRedirect(html);
        if (!redirectUrl) return null;
        targetUrl = redirectUrl;
      }
    }

    const provider = targetUrl.includes('stayonline') ? 'stayonline' : 'maxstream';
    const html = await smartFetch(targetUrl, provider, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': 'https://uprot.net/',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });
    if (!html) return null;

    const parsed = parseMaxStreamHtml(html, targetUrl);
    if (parsed && parsed.url) return parsed;

    if (parsed && parsed.canonicalUrl && parsed.canonicalUrl !== targetUrl) {
      const embedHtml = await smartFetch(parsed.canonicalUrl, 'maxstream', {
        headers: {
          'User-Agent': USER_AGENT,
          'Referer': targetUrl,
          'Accept-Language': 'en-US,en;q=0.5'
        }
      });
      const embedParsed = parseMaxStreamHtml(embedHtml, parsed.canonicalUrl, parsed.canonicalUrl);
      if (embedParsed && embedParsed.url) return embedParsed;
    }

    return null;
  } catch (e) {
    console.error('[Extractors] MaxStream extraction error:', e);
    return null;
  }
}

module.exports = { extractMaxStream };
