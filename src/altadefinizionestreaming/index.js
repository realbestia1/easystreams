const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
const BASE_URL = "https://altadefinizionestreaming.com";
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

const SESSION_COOKIE = 'sid=32234dfabd14e587764e84405e75e99856c6bef31c6b1752e19897b8ae3d4a21';

const { extractMixDrop } = require('../extractors/mixdrop');
const { formatStream } = require('../formatter.js');
const { checkQualityFromPlaylist, checkItalianAudioInPlaylist } = require('../quality_helper.js');

function getCookie() {
  try {
    return (globalThis?.SCRAPER_SETTINGS?.altadefinizioneCookie || process?.env?.ALTADEFINIZIONE_COOKIE || SESSION_COOKIE || '').trim();
  } catch {
    return SESSION_COOKIE || '';
  }
}

async function fetchJson(url, cookie) {
  try {
    const headers = {
      "User-Agent": USER_AGENT,
      "Referer": `${BASE_URL}/`,
      "Accept": "application/json,text/plain,*/*"
    };
    if (cookie && url.startsWith(BASE_URL)) headers.Cookie = cookie;
    const response = await fetch(url, { headers });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function resolveTmdbId(id, type, providerContext = null) {
  const contextTmdbId = providerContext && /^\d+$/.test(String(providerContext.tmdbId || ""))
    ? String(providerContext.tmdbId)
    : null;
  if (contextTmdbId) return contextTmdbId;

  const idStr = String(id || "").trim();
  if (/^tmdb:\d+$/i.test(idStr)) return idStr.split(":")[1];
  if (/^\d+$/.test(idStr)) return idStr;

  const contextImdbId = providerContext && /^tt\d+$/i.test(String(providerContext.imdbId || ""))
    ? String(providerContext.imdbId)
    : null;
  const imdbId = /^tt\d+$/i.test(idStr) ? idStr : contextImdbId;
  if (!imdbId) return null;

  const normalizedType = String(type || "").toLowerCase();
  const payload = await fetchJson(`https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?api_key=${TMDB_API_KEY}&external_source=imdb_id`);
  if (!payload) return null;

  if (normalizedType === "movie") {
    if (Array.isArray(payload.movie_results) && payload.movie_results[0]?.id) return String(payload.movie_results[0].id);
    if (Array.isArray(payload.tv_results) && payload.tv_results[0]?.id) return String(payload.tv_results[0].id);
  }

  if (Array.isArray(payload.tv_results) && payload.tv_results[0]?.id) return String(payload.tv_results[0].id);
  if (Array.isArray(payload.movie_results) && payload.movie_results[0]?.id) return String(payload.movie_results[0].id);
  return null;
}

function absoluteUrl(url) {
  if (!url) return null;
  try {
    return new URL(String(url), BASE_URL).toString();
  } catch {
    return null;
  }
}

async function getShowTitle(tmdbId, type) {
  const endpoint = String(type || "").toLowerCase() === "movie" ? "movie" : "tv";
  const payload = await fetchJson(`https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=it-IT`);
  if (!payload) return null;
  return payload.title || payload.name || payload.original_title || payload.original_name || null;
}

async function resolveDownloadToMixDrop(url, cookie) {
  const downloadUrl = absoluteUrl(url);
  if (!downloadUrl) return null;
  const withGo = `${downloadUrl}${downloadUrl.includes("?") ? "&" : "?"}go=1`;

  try {
    const headers = {
      "User-Agent": USER_AGENT,
      "Referer": `${BASE_URL}/`
    };
    if (cookie && withGo.startsWith(BASE_URL)) headers.Cookie = cookie;
    const response = await fetch(withGo, { headers });
    const finalUrl = String(response.url || "").replace(/\?download$/i, "");
    if (/mixdrop|m1xdrop|mxdrop/i.test(finalUrl)) return finalUrl;
  } catch {
    return null;
  }

  return null;
}

async function addCdnStream(streams, tmdbId, type, season, episode, displayName, cookie) {
  const normalizedType = String(type || "").toLowerCase();
  const endpoint = normalizedType === "movie"
    ? `${BASE_URL}/api/player-sources/movie/${tmdbId}`
    : `${BASE_URL}/api/player-sources/tv/${tmdbId}/${season}/${episode}`;
  const payload = await fetchJson(endpoint, cookie);
  const isAllowed = s => s?.url && !/vixsrc\.to/i.test(String(s.url));
  const source = payload?.sources?.find(s => String(s?.provider || "").toLowerCase() === "cdn" && isAllowed(s))
    || payload?.sources?.find(s => isAllowed(s));
  if (!source?.url) return;

  const headers = { "User-Agent": USER_AGENT, "Referer": `${BASE_URL}/` };
  let quality = "720p";
  const detectedQuality = await checkQualityFromPlaylist(source.url, headers);
  if (detectedQuality) quality = detectedQuality;
  const hasItalian = await checkItalianAudioInPlaylist(source.url, headers);

  streams.push({
    name: "AltadefinizioneStreaming - CDN",
    title: displayName,
    url: source.url,
    easyProxySourceUrl: endpoint,
    headers: headers,
    quality: quality,
    type: "direct",
    language: hasItalian ? 'Italian' : ''
  });
}

async function addMixDropStream(streams, tmdbId, type, season, episode, displayName, cookie) {
  const normalizedType = String(type || "").toLowerCase();
  let downloadEntry = null;

  if (normalizedType === "movie") {
    const payload = await fetchJson(`${BASE_URL}/api/download/${tmdbId}`, cookie);
    if (payload?.available && payload?.url) downloadEntry = payload.url;
  } else {
    const payload = await fetchJson(`${BASE_URL}/api/download-episodes/${tmdbId}`, cookie);
    const episodes = Array.isArray(payload?.episodes) ? payload.episodes : [];
    const match = episodes.find(item => Number(item?.season) === Number(season) && Number(item?.episode) === Number(episode));
    if (payload?.available && match?.url) downloadEntry = match.url;
  }

  const mixdropUrl = await resolveDownloadToMixDrop(downloadEntry, cookie);
  if (!mixdropUrl) return;

  const extracted = await extractMixDrop(mixdropUrl);
  if (!extracted?.url) return;

  streams.push({
    name: "AltadefinizioneStreaming - MixDrop",
    title: displayName,
    url: extracted.url,
    easyProxySourceUrl: mixdropUrl,
    headers: extracted.headers,
    quality: "720p",
    type: "direct",
    language: 'Italian'
  });
}

async function getStreams(id, type, season, episode, providerContext = null) {
  const normalizedType = String(type || "").toLowerCase();
  if (normalizedType !== "movie" && normalizedType !== "tv" && normalizedType !== "series") return [];

  const cookie = getCookie();
  const tmdbId = await resolveTmdbId(id, normalizedType === "movie" ? "movie" : "tv", providerContext);
  if (!tmdbId) return [];

  const effectiveSeason = parseInt(String(season || ""), 10) || 1;
  const effectiveEpisode = parseInt(String(episode || ""), 10) || 1;
  const providerType = normalizedType === "movie" ? "movie" : "tv";
  const showTitle = await getShowTitle(tmdbId, providerType) || (normalizedType === "movie" ? "Film" : "Serie");
  const displayName = normalizedType === "movie" ? showTitle : `${showTitle} ${effectiveSeason}x${effectiveEpisode}`;
  const streams = [];

  await Promise.all([
    addCdnStream(streams, tmdbId, providerType, effectiveSeason, effectiveEpisode, displayName, cookie),
    addMixDropStream(streams, tmdbId, providerType, effectiveSeason, effectiveEpisode, displayName, cookie)
  ]);

  return streams.map(s => formatStream(s, "AltadefinizioneStreaming")).filter(Boolean);
}

module.exports = { getStreams };
