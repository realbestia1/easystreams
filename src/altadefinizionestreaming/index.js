const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
const BASE_URL = "https://altadefinizionestreaming.com";
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

const { extractMixDrop } = require('../extractors/mixdrop');
const { formatStream } = require('../formatter.js');

async function fetchJson(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Referer": `${BASE_URL}/`,
        "Accept": "application/json,text/plain,*/*"
      }
    });
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

async function resolveDownloadToMixDrop(url) {
  const downloadUrl = absoluteUrl(url);
  if (!downloadUrl) return null;
  const withGo = `${downloadUrl}${downloadUrl.includes("?") ? "&" : "?"}go=1`;

  try {
    const response = await fetch(withGo, {
      headers: {
        "User-Agent": USER_AGENT,
        "Referer": `${BASE_URL}/`
      }
    });
    const finalUrl = String(response.url || "").replace(/\?download$/i, "");
    if (/mixdrop|m1xdrop|mxdrop/i.test(finalUrl)) return finalUrl;
  } catch {
    return null;
  }

  return null;
}

async function addCdnStream(streams, tmdbId, type, season, episode, displayName) {
  const normalizedType = String(type || "").toLowerCase();
  const endpoint = normalizedType === "movie"
    ? `${BASE_URL}/api/player-sources/movie/${tmdbId}`
    : `${BASE_URL}/api/player-sources/tv/${tmdbId}/${season}/${episode}`;
  const payload = await fetchJson(endpoint);
  const isAllowed = s => s?.url && !/vixsrc\.to/i.test(String(s.url));
  const source = payload?.sources?.find(s => String(s?.provider || "").toLowerCase() === "cdn" && isAllowed(s))
    || payload?.sources?.find(s => isAllowed(s));
  if (!source?.url) return;

  streams.push({
    name: "AltadefinizioneStreaming - CDN",
    title: displayName,
    url: source.url,
    easyProxySourceUrl: endpoint,
    headers: {
      "User-Agent": USER_AGENT,
      "Referer": `${BASE_URL}/`
    },
    quality: "720p",
    type: "direct"
  });
}

async function addMixDropStream(streams, tmdbId, type, season, episode, displayName) {
  const normalizedType = String(type || "").toLowerCase();
  let downloadEntry = null;

  if (normalizedType === "movie") {
    const payload = await fetchJson(`${BASE_URL}/api/download/${tmdbId}`);
    if (payload?.available && payload?.url) downloadEntry = payload.url;
  } else {
    const payload = await fetchJson(`${BASE_URL}/api/download-episodes/${tmdbId}`);
    const episodes = Array.isArray(payload?.episodes) ? payload.episodes : [];
    const match = episodes.find(item => Number(item?.season) === Number(season) && Number(item?.episode) === Number(episode));
    if (payload?.available && match?.url) downloadEntry = match.url;
  }

  const mixdropUrl = await resolveDownloadToMixDrop(downloadEntry);
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
    type: "direct"
  });
}

async function getStreams(id, type, season, episode, providerContext = null) {
  const normalizedType = String(type || "").toLowerCase();
  if (normalizedType !== "movie" && normalizedType !== "tv" && normalizedType !== "series") return [];

  const tmdbId = await resolveTmdbId(id, normalizedType === "movie" ? "movie" : "tv", providerContext);
  if (!tmdbId) return [];

  const effectiveSeason = parseInt(String(season || ""), 10) || 1;
  const effectiveEpisode = parseInt(String(episode || ""), 10) || 1;
  const providerType = normalizedType === "movie" ? "movie" : "tv";
  const showTitle = await getShowTitle(tmdbId, providerType) || (normalizedType === "movie" ? "Film" : "Serie");
  const displayName = normalizedType === "movie" ? showTitle : `${showTitle} ${effectiveSeason}x${effectiveEpisode}`;
  const streams = [];

  await Promise.all([
    addCdnStream(streams, tmdbId, providerType, effectiveSeason, effectiveEpisode, displayName),
    addMixDropStream(streams, tmdbId, providerType, effectiveSeason, effectiveEpisode, displayName)
  ]);

  return streams.map(s => formatStream(s, "AltadefinizioneStreaming")).filter(Boolean);
}

module.exports = { getStreams };
