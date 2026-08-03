function getStreamingCommunityBaseUrl() {
  return "https://komiknostalgia.id";
}

const { formatStream } = require('../formatter.js');
require('../fetch_helper.js');
const { checkQualityFromText } = require('../quality_helper.js');

const STREAMINGCOMMUNITY_PROXY = (typeof process !== 'undefined' && process.env.STREAMINGCOMMUNITY_PROXY) || '';
let ProxyAgent = null;
try {
    ProxyAgent = require('undici').ProxyAgent;
} catch (_) {
    ProxyAgent = null;
}

const SC_BASE = 'https://streamingcommunityz.team';
let _sitemapCache = null;
let _sitemapPromise = null;

async function getSitemap() {
  if (_sitemapCache) return _sitemapCache;
  if (_sitemapPromise) return await _sitemapPromise;
  _sitemapPromise = (async () => {
    try {
      const r = await fetch(`${SC_BASE}/titles_it_sitemap.xml`);
      if (!r.ok) return [];
      const xml = await r.text();
      const entries = [];
      const re = /titles\/(\d+)-([^<]+)/g;
      let m;
      while ((m = re.exec(xml))) entries.push({ id: Number(m[1]), slug: m[2] });
      _sitemapCache = entries;
      return entries;
    } catch (e) {
      console.warn('[StreamingCommunity] Sitemap fetch error:', e.message);
      return [];
    } finally {
      _sitemapPromise = null;
    }
  })();
  return await _sitemapPromise;
}

function findInSitemap(entries, name) {
  if (!name) return [];
  const cname = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (cname.length < 2) return [];
  const exact = [];
  const prefix = [];
  for (const e of entries) {
    const cslug = e.slug.replace(/[^a-z0-9]/g, '');
    if (cslug === cname) exact.push(e);
    else if (cslug.startsWith(cname) || cname.startsWith(cslug)) prefix.push(e);
  }
  return [...exact, ...prefix];
}

async function scrapeTitle(id, slug, season = null) {
  try {
    const baseSlug = slug ? String(slug).replace(/\/season-\d+.*$/i, '') : '';
    let url = `${SC_BASE}/it/titles/${id}${baseSlug ? '-' + baseSlug : ''}`;
    if (season) url += `/season-${season}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const html = await r.text();
    const m = html.match(/data-page="({.+?})"/);
    if (!m) return null;
    const page = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
    const t = page?.props?.title;
    if (!t) return null;
    const loadedSeason = page?.props?.loadedSeason;
    const ep = loadedSeason?.episodes;
    return {
      id: t.id, slug: t.slug, name: t.name, type: t.type,
      tmdb_id: t.tmdb_id, imdb_id: t.imdb_id, coming_soon: Boolean(t.coming_soon),
      seasonNumber: loadedSeason?.number || null,
      episodes: ep?.map(e => ({ id: e.id, number: e.number, name: e.name })) || null
    };
  } catch (e) { return null; }
}

async function getCamEmbed(titleId, episodeId) {
  try {
    let url = `${SC_BASE}/it/iframe/${titleId}`;
    if (episodeId) url += `?episode_id=${episodeId}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const m = (await r.text()).match(/src="(https:\/\/vixcloud\.co\/embed\/[^"]+)"/);
    return m ? m[1].replace(/&amp;/g, '&') : null;
  } catch (e) { return null; }
}

async function resolveSczEmbed(metadata, normalizedType, season, episode, rawId) {
  try {
    const entries = await getSitemap();
    if (!entries.length) return null;

    const inputIsTmdb = /^\d+$/.test(String(rawId).replace(/^tmdb:/i, ''));
    const targetTmdb = metadata?.id || (inputIsTmdb ? String(rawId).replace(/^tmdb:/i, '') : null);
    const targetImdb = metadata?.imdb_id || (!inputIsTmdb ? String(rawId) : null);

    const titlesToTry = [targetImdb, metadata?.title, metadata?.name, metadata?.original_title, metadata?.original_name].filter(Boolean);
    const candidateMatches = [];
    for (const t of titlesToTry) {
      for (const m of findInSitemap(entries, t)) {
        if (!candidateMatches.some(c => c.id === m.id)) candidateMatches.push(m);
      }
    }

    if (!candidateMatches.length) {
      for (const t of titlesToTry) {
        try {
          const r = await fetch(`${SC_BASE}/it/search?q=${encodeURIComponent(t)}`);
          if (!r.ok) continue;
          const html = await r.text();
          const m = html.match(/data-page="({.+?})"/);
          if (m) {
            const page = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
            const titles = page.props?.titles || [];
            for (const item of titles) {
              if (!candidateMatches.some(c => c.id === item.id)) {
                candidateMatches.push({ id: item.id, slug: item.slug });
              }
            }
          }
        } catch (_) {}
      }
    }

    let foundTitle = null;
    for (const m of candidateMatches.slice(0, 8)) {
      const scraped = await scrapeTitle(m.id, m.slug, normalizedType === 'tv' ? season : null);
      if (!scraped) continue;
      const matchTmdb = targetTmdb && scraped.tmdb_id !== null && String(scraped.tmdb_id) === String(targetTmdb);
      const matchImdb = targetImdb && scraped.imdb_id && String(scraped.imdb_id).toLowerCase() === String(targetImdb).toLowerCase();
      if (matchTmdb || matchImdb) {
        foundTitle = scraped;
        break;
      }
    }

    if (!foundTitle || foundTitle.coming_soon) return null;

    let episodeId = null;
    if (normalizedType === 'tv') {
      const targetSeason = Number(season) || 1;
      if (foundTitle.seasonNumber !== targetSeason || !foundTitle.episodes) return null;
      const epNum = Number(episode) || 1;
      const epObj = foundTitle.episodes.find(e => e.number === epNum);
      if (!epObj) return null;
      episodeId = epObj.id;
    }

    const iframeUrl = `${SC_BASE}/it/iframe/${foundTitle.id}${episodeId ? '?episode_id=' + episodeId : ''}`;
    const embedUrl = await getCamEmbed(foundTitle.id, episodeId);
    if (!embedUrl) return null;

    return { embedUrl, iframeUrl };
  } catch (e) {
    console.error('[StreamingCommunity] SCZ embed resolve error:', e.message);
    return null;
  }
}

const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
const USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

function getCommonHeaders() {
  return {
    "User-Agent": USER_AGENT,
    "Referer": `${getStreamingCommunityBaseUrl()}/`,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1"
  };
}

function getEmbedHeaders(embedUrl) {
  return {
    "User-Agent": USER_AGENT,
    "Referer": `${getStreamingCommunityBaseUrl()}/`,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7"
  };
}

function getPlaylistHeaders(embedUrl) {
  const cleanReferer = String(embedUrl || '').replace('vixcloud.co', 'komiknostalgia.id').replace('vixsrc.to', 'komiknostalgia.id');
  return {
    "User-Agent": USER_AGENT,
    "Referer": cleanReferer,
    "Origin": getStreamingCommunityBaseUrl(),
    "Accept": "*/*",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin"
  };
}

function extractEmbedSrcFromApiPayload(payload) {
  const rawSrc = payload && typeof payload === "object" ? payload.src : null;
  if (!rawSrc) return null;
  try {
    return new URL(rawSrc, getStreamingCommunityBaseUrl()).toString();
  } catch (e) {
    return null;
  }
}

function extractMasterPlaylistFromEmbedHtml(html) {
  if (!html) return null;

  const tokenMatch = html.match(/'token'\s*:\s*'([^']+)'/i);
  const expiresMatch = html.match(/'expires'\s*:\s*'([^']+)'/i);
  const urlMatch = html.match(/url\s*:\s*'([^']+\/playlist\/\d+[^']*)'/i);

  if (!tokenMatch || !expiresMatch || !urlMatch) {
    return null;
  }

  return {
    token: tokenMatch[1],
    expires: expiresMatch[1],
    url: urlMatch[1]
  };
}

function getQualityFromName(qualityStr) {
  if (!qualityStr) return "Unknown";
  const quality = qualityStr.toUpperCase();
  if (quality === "ORG" || quality === "ORIGINAL") return "Original";
  if (quality === "4K" || quality === "2160P") return "4K";
  if (quality === "1440P" || quality === "2K") return "1440p";
  if (quality === "1080P" || quality === "FHD") return "1080p";
  if (quality === "720P" || quality === "HD") return "720p";
  if (quality === "480P" || quality === "SD") return "480p";
  if (quality === "360P") return "360p";
  if (quality === "240P") return "240p";
  const match = qualityStr.match(/(\d{3,4})[pP]?/);
  if (match) {
    const resolution = parseInt(match[1]);
    if (resolution >= 2160) return "4K";
    if (resolution >= 1440) return "1440p";
    if (resolution >= 1080) return "1080p";
    if (resolution >= 720) return "720p";
    if (resolution >= 480) return "480p";
    if (resolution >= 360) return "360p";
    return "240p";
  }
  return "Unknown";
}

async function getTmdbId(imdbId, type) {
  const normalizedType = String(type).toLowerCase();
  const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
  try {
    const response = await fetch(findUrl);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data) return null;
    if (normalizedType === "movie" && data.movie_results && data.movie_results.length > 0) {
      return data.movie_results[0].id.toString();
    } else if (normalizedType === "tv" && data.tv_results && data.tv_results.length > 0) {
      return data.tv_results[0].id.toString();
    }
    return null;
  } catch (e) {
    console.error("[StreamingCommunity] Conversion error:", e);
    return null;
  }
}

async function getMetadata(id, type) {
  try {
    const normalizedType = String(type).toLowerCase();
    let url;
    if (String(id).startsWith("tt")) {
      url = `https://api.themoviedb.org/3/find/${id}?api_key=${TMDB_API_KEY}&external_source=imdb_id&language=it-IT`;
    } else {
      const endpoint = normalizedType === "movie" ? "movie" : "tv";
      url = `https://api.themoviedb.org/3/${endpoint}/${id}?api_key=${TMDB_API_KEY}&language=it-IT`;
    }
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (String(id).startsWith("tt")) {
      const results = normalizedType === "movie" ? data.movie_results : data.tv_results;
      if (results && results.length > 0) return results[0];
    } else {
      return data;
    }
    return null;
  } catch (e) {
    console.error("[StreamingCommunity] Metadata error:", e);
    return null;
  }
}

async function getStreams(id, type, season, episode, providerContext = null) {
  const requestedType = String(type).toLowerCase();
  const normalizedType = requestedType === "series" ? "tv" : requestedType;
  const baseUrl = getStreamingCommunityBaseUrl();
  const commonHeaders = getCommonHeaders();
  let tmdbId = id.toString();
  let resolvedSeason = season;
  const contextTmdbId = providerContext && /^\d+$/.test(String(providerContext.tmdbId || ""))
    ? String(providerContext.tmdbId)
    : null;

  if (contextTmdbId) {
    tmdbId = contextTmdbId;
  } else if (tmdbId.startsWith("tmdb:")) {
    tmdbId = tmdbId.replace("tmdb:", "");
  } else if (tmdbId.startsWith("tt")) {
    const convertedId = await getTmdbId(tmdbId, normalizedType);
    if (convertedId) {
      console.log(`[StreamingCommunity] Converted ${id} to TMDB ID: ${convertedId}`);
      tmdbId = convertedId;
    } else {
      console.warn(`[StreamingCommunity] Could not convert IMDb ID ${id} to TMDB ID.`);
    }
  }

  let metadata = null;
  try {
    metadata = await getMetadata(tmdbId, type);
  } catch (e) {
    console.error("[StreamingCommunity] Error fetching metadata:", e);
  }

  const title = metadata && (metadata.title || metadata.name || metadata.original_title || metadata.original_name) ? metadata.title || metadata.name || metadata.original_title || metadata.original_name : normalizedType === "movie" ? "Film Sconosciuto" : "Serie TV";
  const displayName = normalizedType === "movie" ? title : `${title} ${resolvedSeason}x${episode}`;
  const finalDisplayName = displayName;

  let url;
  let apiUrl;
  if (normalizedType === "movie") {
    url = `${baseUrl}/movie/${tmdbId}`;
    apiUrl = `${baseUrl}/api/movie/${tmdbId}`;
  } else if (normalizedType === "tv") {
    url = `${baseUrl}/tv/${tmdbId}/${resolvedSeason}/${episode}`;
    apiUrl = `${baseUrl}/api/tv/${tmdbId}/${resolvedSeason}/${episode}`;
  } else {
    return [];
  }

  try {
    const proxySocks = STREAMINGCOMMUNITY_PROXY || (typeof process !== 'undefined' && process.env.SOCKS5_PROXY) || '';
    const useProxyFetch = proxySocks && typeof ProxyAgent === 'function';
    let proxyAgent = null;
    if (useProxyFetch) {
      try {
        proxyAgent = new ProxyAgent(proxySocks);
        console.log(`[StreamingCommunity] Using SOCKS5 proxy for fetches`);
      } catch (e) {
        console.warn(`[StreamingCommunity] Failed to create proxy agent: ${e.message}`);
      }
    }

    console.log(`[StreamingCommunity] Fetching API: ${apiUrl}`);

    // Fetch embed URLs concurrently from both Vixsrc API and StreamingCommunityZ
    const [vixRes, sczRes] = await Promise.all([
      fetch(apiUrl, { headers: commonHeaders, dispatcher: proxyAgent || undefined })
        .then(r => r.ok ? r.json() : null)
        .then(payload => {
          const embedUrl = extractEmbedSrcFromApiPayload(payload);
          return embedUrl ? { embedUrl, iframeUrl: url } : null;
        })
        .catch(() => null),
      resolveSczEmbed(metadata, normalizedType, resolvedSeason, episode, id)
    ]);

    const embedSources = [];
    if (sczRes?.embedUrl) embedSources.push({ ...sczRes, source: 'scz' });
    if (vixRes?.embedUrl && vixRes.embedUrl !== sczRes?.embedUrl) embedSources.push({ ...vixRes, source: 'vixsrc' });

    if (embedSources.length === 0) {
      console.log("[StreamingCommunity] Could not find embed src from any source");
      return [];
    }

    const streams = [];

    for (const item of embedSources) {
      const embedUrl = item.embedUrl;
      const isSczSource = item.source === 'scz';
      let embedHtml;
      try {
        console.log(`[StreamingCommunity] Fetching embed (${item.source}): ${embedUrl}`);
        const embedResponse = await fetch(embedUrl, {
          headers: getEmbedHeaders(embedUrl),
          dispatcher: proxyAgent || undefined
        });
        if (!embedResponse.ok) {
          console.error(`[StreamingCommunity] Failed to fetch embed: ${embedResponse.status}`);
          continue;
        }
        embedHtml = await embedResponse.text();
      } catch (e) {
        console.error(`[StreamingCommunity] Failed to fetch embed: ${e.message}`);
        continue;
      }
      if (!embedHtml) continue;

      const masterPlaylist = extractMasterPlaylistFromEmbedHtml(embedHtml);
      if (!masterPlaylist) {
        console.log("[StreamingCommunity] Could not find playlist info in HTML");
        continue;
      }

      const [playlistRawUrl, existingQuery] = masterPlaylist.url.split('?');
      const urlWithExt = playlistRawUrl.endsWith('.m3u8') ? playlistRawUrl : `${playlistRawUrl}.m3u8`;
      const queryParts = [existingQuery, `token=${encodeURIComponent(masterPlaylist.token)}`, `expires=${encodeURIComponent(masterPlaylist.expires)}`, 'h=1', 'lang=it'].filter(Boolean);
      const rawStreamUrl = `${urlWithExt}?${queryParts.join('&')}`;
      const streamUrl = rawStreamUrl.replace('vixcloud.co', 'komiknostalgia.id').replace('vixsrc.to', 'komiknostalgia.id');
      const cleanEmbedUrl = embedUrl.replace('vixcloud.co', 'komiknostalgia.id').replace('vixsrc.to', 'komiknostalgia.id');
      const cleanIframeUrl = (item.iframeUrl || cleanEmbedUrl).replace('vixcloud.co', 'komiknostalgia.id').replace('vixsrc.to', 'komiknostalgia.id');
      const streamHeaders = getPlaylistHeaders(cleanEmbedUrl);
      console.log(`[StreamingCommunity] Final stream URL (${item.source}): ${streamUrl}`);

      let quality = "1080p";
      let hasItalianAudio = false;
      let playlistFetched = false;
      try {
        const playlistResponse = await fetch(streamUrl, {
          headers: streamHeaders,
          dispatcher: proxyAgent || undefined
        });
        if (!playlistResponse.ok) {
          console.warn(`[StreamingCommunity] Playlist pre-check failed: ${playlistResponse.status}, stream not playable`);
          continue;
        }
        playlistFetched = true;
        const playlistText = await playlistResponse.text();
        if (playlistText) {
          hasItalianAudio = /#EXT-X-MEDIA:TYPE=AUDIO.*(?:LANGUAGE="it"|LANGUAGE="ita"|NAME="Italian"|NAME="Ita")/i.test(playlistText);
          const detected = checkQualityFromText(playlistText);
          if (detected) quality = detected;
        }
      } catch (e) {
        console.warn(`[StreamingCommunity] Playlist pre-check failed, continuing:`, e);
        continue;
      }

      const normalizedQuality = getQualityFromName(quality);
      const isItalianAudio = isSczSource || (playlistFetched && hasItalianAudio);
      const resultLanguage = isItalianAudio ? 'Italian' : '';

      const isStremioAddon = Boolean(providerContext?.proxyUrl);
      const targetProxySource = isStremioAddon ? cleanIframeUrl : cleanEmbedUrl;

      const result = {
        name: `StreamingCommunity`,
        title: finalDisplayName,
        url: streamUrl,
        easyProxySourceUrl: targetProxySource,
        quality: normalizedQuality,
        type: "direct",
        headers: streamHeaders,
        behaviorHints: {
          notWebReady: false
        },
        language: resultLanguage
      };

      const formatted = formatStream(result, "StreamingCommunity");
      if (formatted) streams.push(formatted);
    }

    const itaStreams = streams.filter(s => Boolean(s.language) || s.title?.includes('🇮🇹'));
    if (itaStreams.length > 0) {
      return [itaStreams[0]];
    }
    return streams.length > 0 ? [streams[0]] : [];
  } catch (error) {
    console.error("[StreamingCommunity] Error:", error);
    return [];
  }
}

module.exports = { getStreams };

