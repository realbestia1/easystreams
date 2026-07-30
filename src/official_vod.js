const { formatStream } = require('./formatter.js');

const TMDB_API_KEY = '68e094699525b18a70bab2f86b1fa706';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/139 Safari/537.36';
const MEDIASET_ORIGIN = 'https://mediasetinfinity.mediaset.it';
const RAI_ORIGIN = 'https://www.raiplay.it';
const RAI_SEARCH_URL = `${RAI_ORIGIN}/atomatic/raiplay-search-service/api/v1/msearch`;
const RAI_RELINKER = 'https://mediapolisvod.rai.it/relinker/relinkerServlet.htm';
const MEDIASET_GRAPHQL = 'https://mediasetplay.api-graph.mediaset.it/';
const MEDIASET_FEED = 'https://feed.entertainment.tv.theplatform.eu/f/PR1GhC';
const MEDIASET_LOGIN = 'https://api-ott-prod-fe.mediaset.net/PROD/play/idm/anonymous/login/v2.0';
const CACHE = new Map();
const MIN_MATCH_SCORE = 0.63;
const DEBUG = typeof process !== 'undefined' && process.env && process.env.OFFICIAL_PROVIDER_DEBUG === '1';

function debug(message, error) {
  if (!DEBUG) return;
  console.warn(`[OfficialVOD] ${message}${error ? `: ${error.message || error}` : ''}`);
}

function cacheGet(key) {
  const item = CACHE.get(key);
  if (!item) return null;
  if (item.expires <= Date.now()) {
    CACHE.delete(key);
    return null;
  }
  return item.value;
}

function cacheSet(key, value, ttlMs) {
  if (CACHE.size > 400) CACHE.delete(CACHE.keys().next().value);
  CACHE.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

async function request(url, options = {}, timeoutMs = 12000) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    return await fetch(url, {
      ...options,
      signal: controller ? controller.signal : options.signal,
      headers: {
        'user-agent': USER_AGENT,
        accept: '*/*',
        ...(options.headers || {})
      }
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchJson(url, options = {}, timeoutMs) {
  const response = await request(url, options, timeoutMs);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchText(url, options = {}, timeoutMs) {
  const { allowErrorStatus = false, ...requestOptions } = options;
  const response = await request(url, requestOptions, timeoutMs);
  if (!response.ok && !allowErrorStatus) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function positiveInt(value) {
  const parsed = Number.parseInt(String(value == null ? '' : value), 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function firstNumber(value) {
  const match = String(value == null ? '' : value).match(/\d+/);
  return match ? Number(match[0]) : null;
}

function parseYear(value) {
  const match = String(value || '').match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function cleanTitle(value) {
  return String(value || '')
    .replace(/\s*\((?:IT|Italy|Italia)\)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTitle(value) {
  return cleanTitle(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/\b(ita|italiano|mediaset|infinity|wittytv|puntata intera|episodio completo)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokenSimilarity(a, b) {
  const left = new Set(normalizeTitle(a).split(' ').filter(Boolean));
  const right = new Set(normalizeTitle(b).split(' ').filter(Boolean));
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / new Set([...left, ...right]).size;
}

function diceSimilarity(a, b) {
  const left = normalizeTitle(a).replace(/\s+/g, '');
  const right = normalizeTitle(b).replace(/\s+/g, '');
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return 0;
  const pairs = new Map();
  for (let i = 0; i < left.length - 1; i += 1) {
    const pair = left.slice(i, i + 2);
    pairs.set(pair, (pairs.get(pair) || 0) + 1);
  }
  let matches = 0;
  for (let i = 0; i < right.length - 1; i += 1) {
    const pair = right.slice(i, i + 2);
    const count = pairs.get(pair) || 0;
    if (count > 0) {
      pairs.set(pair, count - 1);
      matches += 1;
    }
  }
  return (2 * matches) / (left.length + right.length - 2);
}

function scoreCandidate(target, candidate) {
  const targetTitles = [target.title, target.originalTitle, target.episodeTitle].filter(Boolean);
  const candidateTitles = [candidate.title, candidate.seriesTitle, candidate.episodeTitle].filter(Boolean);
  let titleScore = 0;
  for (const left of targetTitles) {
    for (const right of candidateTitles) {
      titleScore = Math.max(titleScore, 0.55 * diceSimilarity(left, right) + 0.45 * tokenSimilarity(left, right));
    }
  }
  if (normalizeTitle(target.title) === normalizeTitle(candidate.seriesTitle || candidate.title)) {
    titleScore = Math.max(titleScore, 0.98);
  }
  let score = titleScore * 0.72;
  if (target.year && candidate.year) {
    const difference = Math.abs(target.year - candidate.year);
    score += difference === 0 ? 0.12 : difference === 1 ? 0.07 : 0;
  } else {
    score += 0.03;
  }
  if (target.type === 'series') {
    if (target.season != null && candidate.season != null) {
      score += Number(target.season) === Number(candidate.season) ? 0.07 : -0.05;
    }
    if (target.episode != null && candidate.episode != null) {
      score += Number(target.episode) === Number(candidate.episode) ? 0.09 : -0.08;
    } else if (target.episodeTitle && candidate.episodeTitle) {
      score += diceSimilarity(target.episodeTitle, candidate.episodeTitle) * 0.08;
    }
  }
  if (candidate.isFullEpisode) score += 0.14;
  if (candidate.isClip) score -= 0.22;
  if (candidate.guid || candidate.contentId) score += 0.02;
  return Math.max(0, Math.min(1, score));
}

function exactCandidateTitleMatch(target, candidate) {
  const targetTitle = normalizeTitle(target.title);
  const candidateTitle = normalizeTitle(candidate.seriesTitle || candidate.title);
  return targetTitle && candidateTitle === targetTitle ? 1 : 0;
}

function compareOfficialCandidates(target, left, right) {
  const exactDifference = exactCandidateTitleMatch(target, right) - exactCandidateTitleMatch(target, left);
  if (exactDifference !== 0) return exactDifference;

  const scoreDifference = right.score - left.score;
  if (scoreDifference !== 0) return scoreDifference;

  // Prefer the Mediaset copy when the same episode is also mirrored on Witty.
  // Some Witty mirrors expose a valid page but no DASH/Widevine asset.
  const mediasetDifference = (right.source === 'mediaset' ? 1 : 0) - (left.source === 'mediaset' ? 1 : 0);
  if (mediasetDifference !== 0) return mediasetDifference;

  return 0;
}

async function resolveTarget(id, type, season, episode, context = {}) {
  const normalizedType = String(type || '').toLowerCase() === 'movie' ? 'movie' : 'series';
  let tmdbId = /^\d+$/.test(String(context.tmdbId || '')) ? String(context.tmdbId) : null;
  let imdbId = /^tt\d+$/i.test(String(context.imdbId || '')) ? String(context.imdbId) : null;
  const rawId = String(id || '').replace(/^tmdb:/i, '');
  if (!tmdbId && /^\d+$/.test(rawId)) tmdbId = rawId;
  if (!imdbId && /^tt\d+$/i.test(rawId)) imdbId = rawId;

  if (!tmdbId && imdbId) {
    const found = await fetchJson(`https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?api_key=${TMDB_API_KEY}&external_source=imdb_id&language=it-IT`);
    const values = normalizedType === 'movie' ? found.movie_results : found.tv_results;
    tmdbId = values && values[0] ? String(values[0].id) : null;
  }
  if (!tmdbId) return null;

  const endpoint = normalizedType === 'movie' ? 'movie' : 'tv';
  const meta = await fetchJson(`https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=it-IT`);
  const target = {
    type: normalizedType,
    title: meta.title || meta.name || '',
    originalTitle: meta.original_title || meta.original_name || '',
    year: parseYear(meta.release_date || meta.first_air_date),
    tmdbId,
    imdbId,
    season: normalizedType === 'series' ? positiveInt(season) : null,
    episode: normalizedType === 'series' ? positiveInt(episode) : null,
    episodeTitle: null
  };
  if (normalizedType === 'series' && target.season != null && target.episode != null) {
    try {
      const detail = await fetchJson(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${target.season}/episode/${target.episode}?api_key=${TMDB_API_KEY}&language=it-IT`);
      target.episodeTitle = detail.name || null;
    } catch {
      // Series title, season and episode still provide a deterministic match.
    }
  }
  return target;
}

function buildQueries(target) {
  const result = [];
  if (target.type === 'series' && target.episodeTitle) result.push(`${target.title} ${target.episodeTitle}`);
  if (target.type === 'series') result.push(`${target.title} stagione ${target.season} episodio ${target.episode}`);
  result.push(target.title);
  if (target.originalTitle && normalizeTitle(target.originalTitle) !== normalizeTitle(target.title)) {
    result.push(target.originalTitle);
  }
  return [...new Set(result.map(cleanTitle).filter(Boolean))].slice(0, 4);
}

function walk(value, visit) {
  if (!value || typeof value !== 'object') return;
  visit(value);
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
  } else {
    for (const item of Object.values(value)) walk(item, visit);
  }
}

function deduplicate(items) {
  const map = new Map();
  for (const item of items) {
    const key = item && (item.guid || item.contentId || item.pageUrl);
    if (!key) continue;
    const current = map.get(key);
    if (!current || String(item.title || '').length > String(current.title || '').length) map.set(key, item);
  }
  return [...map.values()];
}

async function searchRai(query, target) {
  const cacheKey = `rai:${normalizeTitle(query)}:${target.type}:${target.season}:${target.episode}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const data = await fetchJson(RAI_SEARCH_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: RAI_ORIGIN,
      referer: `${RAI_ORIGIN}/`
    },
    body: JSON.stringify({
      templateIn: '6470a982e4e0301afe1f81f1',
      templateOut: '6516ac5d40da6c377b151642',
      params: { param: query, from: null, sort: 'relevance', onlyVideoQuery: false }
    })
  });
  const cards = (data && data.agg && data.agg.titoli && data.agg.titoli.cards || [])
    .filter((item) => /^\/(?:programmi|collezioni)\/.+\.json$/i.test(String(item.path_id || '')))
    .slice(0, 8);
  const settled = await Promise.allSettled(cards.slice(0, 3).map((card) => expandRaiProgram(card, target)));
  return cacheSet(cacheKey, deduplicate(settled.flatMap((entry) => entry.status === 'fulfilled' ? entry.value : [])), 15 * 60 * 1000);
}

async function raiJson(path) {
  const safePath = String(path || '');
  if (!safePath.startsWith('/') || safePath.includes('..')) throw new Error('Invalid Rai path');
  const key = `rai-json:${safePath}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  return cacheSet(key, await fetchJson(`${RAI_ORIGIN}${safePath}`, {
    headers: { origin: RAI_ORIGIN, referer: `${RAI_ORIGIN}/` }
  }), 30 * 60 * 1000);
}

async function expandRaiProgram(card, target) {
  const program = await raiJson(card.path_id);
  const info = program.program_info || program.collection_info || {};
  const seriesTitle = info.name || info.title || card.titolo || '';
  const year = parseYear(info.year);
  if (target.type === 'movie') {
    if (!program.first_item_path) return [];
    const video = await raiJson(program.first_item_path);
    const candidate = normalizeRaiVideo(video, seriesTitle, year, 'movie');
    return candidate ? [candidate] : [];
  }
  const matchingSets = [];
  for (const block of program.blocks || []) {
    if (block.type !== 'RaiPlay Multimedia Block' || /clip|extra|trailer|promo/i.test(String(block.name || ''))) continue;
    for (const set of block.sets || []) {
      if (firstNumber(set.name) === Number(target.season)) matchingSets.push({ block, set });
    }
  }
  const result = [];
  for (const { block, set } of matchingSets.slice(0, 3)) {
    const base = String(card.path_id).replace(/\.json$/i, '');
    const payload = await raiJson(`${base}/${encodeURIComponent(block.id)}/${encodeURIComponent(set.id)}/episodes.json`);
    const cardsFound = [];
    walk(payload, (item) => {
      if (item && item.video_url && Number(item.episode) === Number(target.episode)) cardsFound.push(item);
    });
    for (const item of cardsFound) {
      let detail = item;
      if (item.path_id) {
        try { detail = { ...item, ...await raiJson(item.path_id) }; } catch { }
      }
      const candidate = normalizeRaiVideo(detail, seriesTitle, year, 'series');
      if (candidate) result.push(candidate);
    }
  }
  return result;
}

function normalizeRaiVideo(video, seriesTitle, year, targetType) {
  let contentId = '';
  try {
    contentId = new URL(String(video.video_url || (video.video && video.video.content_url) || ''), RAI_ORIGIN).searchParams.get('cont') || '';
  } catch { }
  if (!/^[A-Za-z0-9._~+/=-]{8,512}$/.test(contentId)) return null;
  const episodeTitle = video.episode_title || video.toptitle || '';
  const title = targetType === 'movie' ? (video.name || seriesTitle) : (episodeTitle || video.name || seriesTitle);
  const duration = parseDuration(video.duration || (video.video && video.video.duration));
  return {
    source: 'raiplay',
    contentId,
    guid: String(video.id || contentId),
    title,
    seriesTitle,
    episodeTitle,
    year,
    season: positiveInt(video.season),
    episode: positiveInt(video.episode),
    isClip: /clip|extra|trailer|promo|backstage/i.test(`${video.forma || ''} ${video.type || ''} ${video.name || ''}`) || (duration > 0 && duration < 600),
    isFullEpisode: targetType === 'series' && Number(video.episode) > 0 && duration >= 600,
    subtitles: normalizeRaiSubtitles((video.video && (video.video.subtitlesArray || video.video.subtitleList)) || video.subtitlesArray || video.subtitleList)
  };
}

function parseDuration(value) {
  const parts = String(value || '').split(':').map(Number);
  return parts.length === 3 && parts.every(Number.isFinite) ? parts[0] * 3600 + parts[1] * 60 + parts[2] : 0;
}

function normalizeRaiSubtitles(items) {
  return (Array.isArray(items) ? items : []).map((item, index) => {
    try {
      const url = new URL(item.url, RAI_ORIGIN);
      if (url.hostname !== 'www.raiplay.it') return null;
      return { id: `rai-${index + 1}`, lang: String(item.language || 'it').toLowerCase(), url: url.href };
    } catch {
      return null;
    }
  }).filter(Boolean);
}

let mediasetSessionPromise = null;
async function createMediasetSession(appName) {
  const clientId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const data = await fetchJson(MEDIASET_LOGIN, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: MEDIASET_ORIGIN, referer: `${MEDIASET_ORIGIN}/` },
    body: JSON.stringify({ client_id: clientId, appName })
  });
  const response = data.response || {};
  if (!response.beToken) throw new Error('Mediaset anonymous token missing');
  return {
    beToken: response.beToken,
    sid: response.sid || clientId,
    clientId
  };
}

async function getMediasetSession() {
  const cached = cacheGet('mediaset-session');
  if (cached) return cached;
  if (mediasetSessionPromise) return mediasetSessionPromise;
  mediasetSessionPromise = (async () => {
    let appName = 'web//mediasetplay-web/1.3.0';
    try {
      const html = await fetchText(`${MEDIASET_ORIGIN}/`, {
        headers: { range: 'bytes=0-300000', origin: MEDIASET_ORIGIN, referer: `${MEDIASET_ORIGIN}/` }
      });
      appName = html.match(/<meta[^>]+name=["']app-name["'][^>]+content=["']([^"']+)["']/i)?.[1] || appName;
    } catch { }
    return cacheSet('mediaset-session', await createMediasetSession(appName), 45 * 60 * 1000);
  })();
  try {
    return await mediasetSessionPromise;
  } finally {
    mediasetSessionPromise = null;
  }
}

async function getMediasetGraphqlHash() {
  const cached = cacheGet('mediaset-graphql-hash');
  if (cached) return cached;
  const html = await fetchText(`${MEDIASET_ORIGIN}/cerca?q=a`, {
    allowErrorStatus: true,
    headers: { origin: MEDIASET_ORIGIN, referer: `${MEDIASET_ORIGIN}/` }
  }, 15000);
  const scripts = [];
  const regex = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = regex.exec(html))) {
    try {
      const url = new URL(match[1], MEDIASET_ORIGIN);
      if (/^static\d+\.mediasetplay\.mediaset\.it$/i.test(url.hostname)) scripts.push(url.href);
    } catch { }
  }
  let hash = extractMediasetGraphqlHash(html);
  const prioritized = scripts
    .sort((left, right) => mediasetScriptPriority(right) - mediasetScriptPriority(left))
    .slice(0, 32);
  for (let index = 0; !hash && index < prioritized.length; index += 8) {
    const settled = await Promise.allSettled(prioritized.slice(index, index + 8).map((url) => fetchText(url, {
      headers: { origin: MEDIASET_ORIGIN, referer: `${MEDIASET_ORIGIN}/` }
    }, 12000)));
    for (const result of settled) {
      if (result.status !== 'fulfilled') continue;
      hash = extractMediasetGraphqlHash(result.value);
      if (hash) break;
    }
  }
  if (hash) {
    debug(`Mediaset GraphQL hash ${hash.slice(0, 8)}`);
    return cacheSet('mediaset-graphql-hash', hash.toLowerCase(), 6 * 60 * 60 * 1000);
  }
  throw new Error('Mediaset GraphQL hash not found');
}

function extractMediasetGraphqlHash(source) {
  const decoded = String(source || '').replace(/\\\//g, '/').replace(/\\"/g, '"');
  return decoded.match(/GetSearchPageDocument["']?\s*,?\s*0?\s*,?\s*\{[\s\S]{0,300}?__meta__\s*:\s*\{[\s\S]{0,100}?hash\s*:\s*["']([a-f0-9]{64})["']/i)?.[1]
    || decoded.match(/GetSearchPageDocument[\s\S]{0,500}?hash\s*:\s*["']([a-f0-9]{64})["']/i)?.[1]
    || decoded.match(/getSearchPage[\s\S]{0,1000}?sha256Hash["']?\s*[:=]\s*["']([a-f0-9]{64})["']/i)?.[1]
    || null;
}

function mediasetScriptPriority(value) {
  const url = String(value || '').toLowerCase();
  let score = 0;
  if (url.includes('/_next/static/chunks/app/')) score += 8;
  if (url.includes('page')) score += 5;
  if (url.includes('search') || url.includes('cerca')) score += 5;
  if (url.includes('main') || url.includes('webpack')) score += 2;
  return score;
}

function mediasetHeaders(session, bearer = false) {
  return {
    authorization: bearer ? `Bearer ${session.beToken}` : session.beToken,
    'x-m-device-id': session.clientId,
    'x-m-platform': 'WEB',
    'x-m-property': 'MPLAY',
    'x-m-sid': session.sid,
    'x-m-app-version': '1.1.1',
    origin: MEDIASET_ORIGIN,
    referer: `${MEDIASET_ORIGIN}/`
  };
}

async function searchMediaset(query, target) {
  const cacheKey = `mediaset:${normalizeTitle(query)}:${target.type}:${target.season}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const candidates = [];
  try {
    const [session, hash] = await Promise.all([getMediasetSession(), getMediasetGraphqlHash()]);
    const url = new URL(MEDIASET_GRAPHQL);
    url.searchParams.set('extensions', JSON.stringify({ persistedQuery: { version: 1, sha256Hash: hash } }));
    url.searchParams.set('variables', JSON.stringify({ first: 30, property: 'search', query, uxReference: 'filteredSearch' }));
    const data = await fetchJson(url, { headers: { ...mediasetHeaders(session), accept: '*/*' } });
    const raw = extractMediasetItems(data);
    candidates.push(...raw.map(normalizeMediasetEntry).filter((item) => item.guid));
    if (target.type === 'series') {
      const expanded = await Promise.allSettled(raw.filter(isMediasetSeries).slice(0, 5).map((item) => expandMediasetSeries(item, target)));
      for (const item of expanded) if (item.status === 'fulfilled') candidates.push(...item.value);
    }
  } catch (error) {
    // The Witty and public page fallbacks remain valid if Mediaset changes its private query hash.
    debug('Mediaset GraphQL search failed', error);
  }
  if (!hasStrongOfficialCandidate(candidates, target)) {
    try {
      const url = new URL('/cerca', MEDIASET_ORIGIN);
      url.searchParams.set('q', query);
      const html = await fetchText(url, {
        allowErrorStatus: true,
        headers: { origin: MEDIASET_ORIGIN, referer: `${MEDIASET_ORIGIN}/` }
      });
      candidates.push(...extractMediasetPage(html));
    } catch (error) { debug('Mediaset public search failed', error); }
  }
  if (!hasStrongOfficialCandidate(candidates, target)) {
    try {
      candidates.push(...await searchWitty(query, target));
    } catch (error) { debug('Witty search failed', error); }
  }
  return cacheSet(cacheKey, deduplicate(candidates), 15 * 60 * 1000);
}

function hasStrongOfficialCandidate(candidates, target) {
  return candidates.some((candidate) => {
    if (!candidate || candidate.isClip || !candidate.pageUrl) return false;
    const titleScore = Math.max(
      diceSimilarity(target.title, candidate.seriesTitle || candidate.title),
      tokenSimilarity(target.title, candidate.seriesTitle || candidate.title)
    );
    if (target.type === 'movie') return titleScore >= 0.9;
    if (candidate.episode == null || Number(candidate.episode) !== Number(target.episode)) return false;
    if (candidate.season != null && Number(candidate.season) !== Number(target.season)) return false;
    return titleScore >= 0.72;
  });
}

function extractMediasetItems(data) {
  const direct = data && data.data && data.data.getSearchPage
    && data.data.getSearchPage.areaContainersConnection
    && data.data.getSearchPage.areaContainersConnection.areaContainers
    && data.data.getSearchPage.areaContainersConnection.areaContainers[0]
    && data.data.getSearchPage.areaContainersConnection.areaContainers[0].areas
    && data.data.getSearchPage.areaContainersConnection.areaContainers[0].areas[0]
    && data.data.getSearchPage.areaContainersConnection.areaContainers[0].areas[0].sections
    && data.data.getSearchPage.areaContainersConnection.areaContainers[0].areas[0].sections[0]
    && data.data.getSearchPage.areaContainersConnection.areaContainers[0].areas[0].sections[0].collections
    && data.data.getSearchPage.areaContainersConnection.areaContainers[0].areas[0].sections[0].collections[0]
    && data.data.getSearchPage.areaContainersConnection.areaContainers[0].areas[0].sections[0].collections[0].itemsConnection
    && data.data.getSearchPage.areaContainersConnection.areaContainers[0].areas[0].sections[0].collections[0].itemsConnection.items;
  if (Array.isArray(direct)) return direct;
  const arrays = [];
  walk(data, (value) => {
    if (Array.isArray(value) && value.some((item) => item && typeof item === 'object' && (item.guid || item.cardTitle))) arrays.push(value);
  });
  return arrays.sort((a, b) => b.length - a.length)[0] || [];
}

function normalizeMediasetEntry(entry) {
  const media = Array.isArray(entry.media) ? entry.media[0] : null;
  const channelLabels = Array.isArray(entry.channelLabels)
    ? entry.channelLabels.filter((label) => label && (label.id || label.title || label.name))
    : [];
  const cardLink = (entry.cardLink && (entry.cardLink.value || entry.cardLink)) || '';
  const rawGuid = entry.guid || entry.id || (media && media.guid) || '';
  const guid = /^F[A-Z0-9]{15}$/i.test(String(rawGuid)) ? String(rawGuid) : String(cardLink || entry.publicUrl || '').match(/\bF[A-Z0-9]{15}\b/i)?.[0];
  const title = entry.cardTitle || entry.title || entry.description || entry['mediasetprogram$brandTitle'] || '';
  const seriesTitle = entry.seriesTitle || entry['mediasetprogram$brandTitle'] || entry['mediasetprogram$tvLinearSeasonTitle'] || '';
  const duration = Number(entry['mediasetprogram$duration'] || entry.duration || (media && media.duration) || 0);
  const kind = String(entry.__typename || entry.programType || '');
  return {
    source: 'mediaset',
    guid,
    title,
    seriesTitle,
    episodeTitle: /episode|videoitem/i.test(kind) || entry.tvSeasonEpisodeNumber != null ? title : '',
    year: parseYear(entry.year || entry['mediasetprogram$productionYear'] || entry.pubDate || entry.updated),
    season: positiveInt(entry.tvSeasonNumber || entry.seasonNumber || entry['mediasetprogram$seasonNumber']),
    episode: positiveInt(entry.tvSeasonEpisodeNumber || entry.episodeNumber || entry['mediasetprogram$episodeNumber']),
    isClip: /clip|promo|trailer|backstage/i.test(`${kind} ${entry['mediasetprogram$category'] || ''} ${title}`) || (duration > 0 && duration < 600),
    isPaid: channelLabels.length > 0,
    isFullEpisode: duration >= 600 && (/episode/i.test(kind) || entry.tvSeasonEpisodeNumber != null),
    pageUrl: validMediasetPage(entry['mediasetprogram$videoPageUrl'] || cardLink || entry.publicUrl || entry['mediasetprogram$pageUrl'] || (media && media.publicUrl))
  };
}

function isMediasetSeries(item) {
  return item && (item.__typename === 'SeriesItem' || /^SE\d+$/i.test(String(item.guid || '')) || String(item.cardLink && item.cardLink.referenceType || '').toLowerCase() === 'series');
}

async function expandMediasetSeries(item, target) {
  const seriesGuid = String(item.guid || (item.cardLink && item.cardLink.referenceId) || '');
  if (!/^SE\d+$/i.test(seriesGuid)) return [];
  const seriesUrl = new URL(`${MEDIASET_FEED}/mediaset-prod-all-series-v2`);
  seriesUrl.searchParams.set('byGuid', seriesGuid);
  const series = (await fetchJson(seriesUrl)).entries?.[0];
  if (!series) return [];
  const season = (series.seriesTvSeasons || []).find((value) => Number(value.tvSeasonNumber) === Number(target.season));
  if (!season) return [];
  const seasonId = season.id || season.url || (series.availableTvSeasonIds || []).find((value) => String(value).endsWith(`/${season.guid}`));
  if (!seasonId) return [];
  const episodesUrl = new URL(`${MEDIASET_FEED}/mediaset-prod-all-programs-v2`);
  episodesUrl.searchParams.set('byTvSeasonId', seasonId);
  episodesUrl.searchParams.set('sort', ':publishInfo_lastPublished|asc,tvSeasonEpisodeNumber|asc');
  episodesUrl.searchParams.set('range', '1-600');
  const episodes = (await fetchJson(episodesUrl)).entries || [];
  return episodes.map((entry) => normalizeMediasetEntry({
    ...entry,
    seriesTitle: series.title || item.cardTitle || '',
    tvSeasonNumber: entry.tvSeasonNumber == null ? season.tvSeasonNumber : entry.tvSeasonNumber
  })).filter((candidate) => candidate.guid);
}

function validMediasetPage(value) {
  if (!value) return null;
  try {
    const url = new URL(value, MEDIASET_ORIGIN);
    return /(^|\.)mediaset\.it$/i.test(url.hostname) || /(^|\.)wittytv\.it$/i.test(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}

function extractMediasetPage(html) {
  const text = String(html || '').replace(/\\\//g, '/').replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
  const regex = /(?:https?:\/\/(?:www\.)?mediasetinfinity\.mediaset\.it)?\/(?:video|movie|on-demand)\/[^"'<>\s]+?_(F[A-Z0-9]{15})(?:\/)?/gi;
  const result = [];
  let match;
  while ((match = regex.exec(text))) {
    const pageUrl = validMediasetPage(match[0]);
    if (!pageUrl) continue;
    const parts = new URL(pageUrl).pathname.split('/').filter(Boolean);
    const itemSlug = String(parts[parts.length - 1] || '').replace(new RegExp(`_${match[1]}.*$`, 'i'), '');
    const seriesSlug = parts.length >= 3 ? parts[parts.length - 2] : '';
    result.push({
      source: 'mediaset',
      guid: match[1],
      title: titleFromSlug(itemSlug),
      seriesTitle: titleFromSlug(seriesSlug),
      episodeTitle: titleFromSlug(itemSlug),
      year: null,
      season: null,
      episode: null,
      isClip: /clip|promo|trailer|backstage|anticipazioni/i.test(`${itemSlug} ${seriesSlug}`),
      isFullEpisode: false,
      pageUrl
    });
  }
  return result;
}

async function searchWitty(query, target) {
  const bases = [];
  if (target && target.title && target.episodeTitle) {
    const deterministic = {
      pageUrl: `${WITTY_ORIGIN}/${slugify(target.title)}/${slugify(target.episodeTitle)}/`,
      title: target.episodeTitle
    };
    try {
      const candidate = await enrichWittyBase(deterministic);
      if (isStrongWittyEpisode(candidate, target)) return [candidate];
      if (candidate) bases.push(deterministic);
    } catch { }
  }
  if (target && target.title) {
    try {
      const programUrl = `${WITTY_ORIGIN}/${slugify(target.title)}/`;
      const html = await fetchText(programUrl, { headers: { referer: `${WITTY_ORIGIN}/`, accept: 'text/html' } });
      const programBases = extractWittyBases(html);
      const programCandidates = await enrichWittyBases(programBases);
      const strong = programCandidates.find((candidate) => isStrongWittyEpisode(candidate, target));
      if (strong) return [strong];
      bases.push(...programBases);
    } catch { }
  }
  const searchUrl = new URL('/wp-json/wp/v2/search', WITTY_ORIGIN);
  searchUrl.searchParams.set('search', query);
  searchUrl.searchParams.set('per_page', '100');
  try {
    const data = await fetchJson(searchUrl);
    for (const item of Array.isArray(data) ? data : []) bases.push({ pageUrl: item.url, title: decodeHtml(item.title || '') });
  } catch { }
  try {
    const htmlUrl = new URL('/', WITTY_ORIGIN);
    htmlUrl.searchParams.set('s', query);
    const html = await fetchText(htmlUrl, { headers: { referer: `${WITTY_ORIGIN}/`, accept: 'text/html' } });
    bases.push(...extractWittyBases(html));
  } catch { }
  return enrichWittyBases(bases);
}

async function enrichWittyBases(bases) {
  const settled = await Promise.allSettled(deduplicate(bases).slice(0, 30).map(enrichWittyBase));
  return settled
    .filter((item) => item.status === 'fulfilled' && item.value)
    .map((item) => item.value);
}

const WITTY_ORIGIN = 'https://www.wittytv.it';
function isStrongWittyEpisode(candidate, target) {
  if (!candidate || candidate.isClip || candidate.isFullEpisode !== true) return false;
  if (!target || target.type !== 'series') return true;
  if (candidate.episode != null && Number(candidate.episode) !== Number(target.episode)) return false;
  if (candidate.season != null && Number(candidate.season) !== Number(target.season)) return false;
  return candidate.episode != null
    || diceSimilarity(target.episodeTitle || '', candidate.episodeTitle || '') >= 0.75;
}

async function enrichWittyBase(base) {
  const html = await fetchText(base.pageUrl, { headers: { referer: `${WITTY_ORIGIN}/`, accept: 'text/html' } });
  const guid = html.match(/guIDcurrentGlobal\s*=\s*["'](F[A-Z0-9]{15})["']/i)?.[1]
    || html.match(/\b(F[A-Z0-9]{15})\b/i)?.[1];
  if (!guid) return null;
  const metaTitle = decodeHtml(html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1] || base.title);
  const title = metaTitle.replace(/\s*[|–-]\s*Witty\s*TV.*$/i, '').trim();
  const duration = Number(html.match(/mediasetprogram\\?["']?\$duration\\?["']?\s*:\s*(\d+)/i)?.[1] || 0);
  return {
    source: 'witty',
    guid,
    title,
    seriesTitle: titleFromSlug(new URL(base.pageUrl).pathname.split('/').filter(Boolean)[0] || ''),
    episodeTitle: title,
    year: parseYear(html),
    season: positiveInt(html.match(/stagione\s*(\d+)/i)?.[1]),
    episode: parseWittyEpisode(title) || positiveInt(html.match(/episodio\s*(\d+)/i)?.[1]),
    isClip: /\b(?:clip|promo|trailer|backstage|anticipazioni|highlight|highlights|best moments|momenti|riassunto|prossimamente)\b|nella prossima puntata|nei prossimi episodi|ci aspetta|ci attende/i.test(normalizeTitle(title)) || (duration > 0 && duration < 600),
    isFullEpisode: /puntata|episodio/i.test(title) && !/\b(?:clip|promo|trailer|backstage|anticipazioni|highlight|highlights|best moments|momenti|riassunto|prossimamente)\b|ci aspetta|ci attende/i.test(normalizeTitle(title)),
    pageUrl: base.pageUrl
  };
}

function extractWittyBases(html) {
  const result = [];
  const regex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(String(html || '')))) {
    try {
      const url = new URL(decodeHtml(match[1]), WITTY_ORIGIN);
      const segments = url.pathname.split('/').filter(Boolean);
      if (!url.hostname.endsWith('wittytv.it') || segments.length < 2) continue;
      if (/\.(?:jpg|jpeg|png|gif|webp|svg|css|js|woff2?)$/i.test(url.pathname)) continue;
      result.push({
        pageUrl: url.href,
        title: decodeHtml(String(match[2] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
      });
    } catch { }
  }
  return result;
}

function slugify(value) {
  return normalizeTitle(value).replace(/\s+/g, '-');
}
function decodeHtml(value) {
  return String(value || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'");
}
function titleFromSlug(value) {
  try { value = decodeURIComponent(value); } catch { }
  return String(value || '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function parseWittyEpisode(value) {
  const numeric = normalizeTitle(value).match(/(?:episodio|puntata)\s*(\d{1,3})\b/i)?.[1];
  if (numeric) return Number(numeric);
  const ordinals = {
    prima: 1, primo: 1, seconda: 2, secondo: 2, terza: 3, terzo: 3,
    quarta: 4, quarto: 4, quinta: 5, quinto: 5, sesta: 6, sesto: 6,
    settima: 7, settimo: 7, ottava: 8, ottavo: 8, nona: 9, nono: 9,
    decima: 10, decimo: 10
  };
  const word = normalizeTitle(value).match(/\b(prima|primo|seconda|secondo|terza|terzo|quarta|quarto|quinta|quinto|sesta|sesto|settima|settimo|ottava|ottavo|nona|nono|decima|decimo)\s+puntata\b/i)?.[1];
  return word ? ordinals[word] || null : null;
}

function resolveProxyEntries(context) {
  const settings = typeof globalThis !== 'undefined' && globalThis.SCRAPER_SETTINGS
    ? globalThis.SCRAPER_SETTINGS
    : {};
  const entries = [];
  if (Array.isArray(context && context.proxyEntries)) entries.push(...context.proxyEntries);
  if (!entries.length && settings.easyProxies) {
    try {
      const configured = typeof settings.easyProxies === 'string'
        ? JSON.parse(settings.easyProxies)
        : settings.easyProxies;
      if (Array.isArray(configured)) entries.push(...configured);
    } catch { }
  }
  if (!entries.length && context && context.proxyUrl) entries.push({ url: context.proxyUrl, password: context.proxyPassword || '' });
  if (!entries.length && settings.proxyUrl) entries.push({ url: settings.proxyUrl, password: settings.proxyPassword || '' });
  if (!entries.length && settings.easyProxyUrl) entries.push({ url: settings.easyProxyUrl, password: settings.easyProxyPassword || '' });
  const normalized = entries.map((entry) => ({
    url: String(entry && (entry.url || entry.proxyUrl) || '').trim().replace(/\/+$/, ''),
    password: String(entry && (entry.password || entry.proxyPassword) || '').trim()
  })).filter((entry) => /^https?:\/\//i.test(entry.url) && entry.password);
  const selectedUrl = String(context && context.proxyUrl || '').replace(/\/+$/, '');
  if (!selectedUrl) return normalized;
  return normalized
    .map((entry, index) => ({ entry, index, selected: entry.url === selectedUrl ? 0 : 1 }))
    .sort((left, right) => left.selected - right.selected || left.index - right.index)
    .map((item) => item.entry);
}

function getCandidateExtractorSource(candidate) {
  let sourceUrl;
  let host;
  if (candidate.source === 'raiplay') {
    const relinker = new URL(RAI_RELINKER);
    relinker.searchParams.set('cont', candidate.contentId);
    relinker.searchParams.set('output', '62');
    sourceUrl = relinker.href;
    host = 'raiplay';
  } else {
    sourceUrl = validMediasetPage(candidate.pageUrl);
    if (!sourceUrl) throw new Error('Invalid provider URL');
    host = new URL(sourceUrl).hostname.endsWith('wittytv.it') ? 'wittytv' : 'mediaset';
  }
  return { sourceUrl, host };
}

function buildLazyExtractorUrl(candidate, proxyEntry) {
  const { sourceUrl, host } = getCandidateExtractorSource(candidate);
  const endpoint = new URL('/extractor/video.m3u8', `${proxyEntry.url}/`);
  endpoint.searchParams.set('host', host);
  endpoint.searchParams.set('d', sourceUrl);
  endpoint.searchParams.set('redirect_stream', 'true');
  endpoint.searchParams.set('api_password', proxyEntry.password);
  return endpoint.href;
}

async function inspectRaiCandidate(candidate) {
  const cacheKey = `rai-playback:${candidate.contentId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  try {
    const relinker = new URL(RAI_RELINKER);
    relinker.searchParams.set('cont', candidate.contentId);
    relinker.searchParams.set('output', '62');
    const data = await fetchJson(relinker, {
      headers: { origin: RAI_ORIGIN, referer: `${RAI_ORIGIN}/` }
    }, 8000);
    const manifest = String(data.video && data.video[0] || '');
    const parsed = new URL(manifest);
    if (
      parsed.protocol !== 'https:'
      || !(
        parsed.hostname.endsWith('.rai.it')
        || parsed.hostname.endsWith('.akamaized.net')
        || parsed.hostname.endsWith('.msvdn.net')
      )
    ) {
      return cacheSet(cacheKey, { available: false, quality: '720p' }, 30 * 1000);
    }
    const quality = await detectManifestQuality(manifest, {
      origin: RAI_ORIGIN,
      referer: `${RAI_ORIGIN}/`,
      'user-agent': USER_AGENT
    });
    return cacheSet(cacheKey, { available: true, quality }, 15 * 60 * 1000);
  } catch (error) {
    debug(`RaiPlay lightweight inspection failed for ${candidate.contentId}`, error);
    return { available: true, quality: '720p' };
  }
}

async function detectManifestQuality(url, headers = {}) {
  try {
    const text = await fetchText(url, { headers: { ...headers, range: 'bytes=0-524287' } }, 8000);
    const heights = [];
    for (const match of text.matchAll(/(?:RESOLUTION=\d+x|height=["'])(\d{3,4})/gi)) heights.push(Number(match[1]));
    for (const match of text.matchAll(/\b(?:maxHeight|height)\s*=\s*["'](\d{3,4})["']/gi)) heights.push(Number(match[1]));
    const max = Math.max(0, ...heights);
    if (max >= 2160) return '2160p';
    if (max >= 1440) return '1440p';
    if (max >= 1080) return '1080p';
    if (max >= 720) return '720p';
    if (max > 0) return '480p';
  } catch { }
  return '720p';
}

function providerLabel(candidate) {
  if (candidate.source === 'raiplay') return 'RaiPlay';
  try {
    if (new URL(candidate.pageUrl).hostname.endsWith('wittytv.it')) return 'WittyTV';
  } catch { }
  return candidate.source === 'witty' ? 'WittyTV' : 'Mediaset Infinity';
}

async function getOfficialStreams(provider, id, type, season, episode, context = {}) {
  try {
    const proxyEntries = resolveProxyEntries(context || {});
    if (!proxyEntries.length) return [];
    const target = await resolveTarget(id, type, season, episode, context || {});
    if (!target) return [];
    const all = [];
    for (const query of buildQueries(target)) {
      const found = provider === 'raiplay'
        ? await searchRai(query, target)
        : await searchMediaset(query, target);
      all.push(...found);
      const ranked = deduplicate(all)
        .map((candidate) => ({ ...candidate, score: scoreCandidate(target, candidate) }))
        .sort((left, right) => compareOfficialCandidates(target, left, right));
      const best = ranked[0];
      if (
        best
        && best.score >= 0.88
        && !best.isClip
        && (provider !== 'mediaset' || best.source === 'mediaset')
      ) break;
    }
    const ranked = deduplicate(all)
      .map((candidate) => ({ ...candidate, score: scoreCandidate(target, candidate) }))
      .filter((candidate) => {
        if (candidate.score < MIN_MATCH_SCORE || candidate.isClip || candidate.isPaid) return false;
        if (
          target.type === 'movie'
          && candidate.source === 'raiplay'
          && target.year
          && candidate.year
          && Math.abs(Number(target.year) - Number(candidate.year)) > 1
        ) return false;
        if (target.type !== 'series') return true;
        if (candidate.season != null && Number(candidate.season) !== Number(target.season)) return false;
        if (candidate.episode != null && Number(candidate.episode) !== Number(target.episode)) return false;
        if (candidate.source === 'witty' && candidate.isFullEpisode !== true) return false;
        return true;
      })
      .sort((left, right) => compareOfficialCandidates(target, left, right))
      .slice(0, 6);
    for (const candidate of ranked) {
      try {
        // Mediaset playback checks are intentionally delegated to EasyProxy.
        // Running them from the addon's IP can return false PL053 rights errors
        // for otherwise playable archive titles and duplicates WARP/DRM work.
        const inspection = provider === 'raiplay'
          ? await inspectRaiCandidate(candidate)
          : { available: true, quality: '720p' };
        if (!inspection.available) continue;
        const label = providerLabel(candidate);
        const title = target.type === 'series'
          ? `${target.title} S${String(target.season).padStart(2, '0')}E${String(target.episode).padStart(2, '0')}`
          : target.title;
        const stream = formatStream({
          url: buildLazyExtractorUrl(candidate, proxyEntries[0]),
          name: label,
          title,
          quality: inspection.quality,
          language: 'Italian',
          type: 'direct',
          subtitles: candidate.subtitles || [],
          behaviorHints: {
            notWebReady: true,
            bingeGroup: provider === 'raiplay' ? 'raiplay' : 'mediaset',
            filename: `${cleanTitle(title).replace(/[^a-z0-9._ -]+/gi, ' ')}.m3u8`
          }
        }, provider === 'raiplay' ? 'RaiPlay' : 'Mediaset Infinity');
        return stream ? [stream] : [];
      } catch {
        // Try the next ranked official candidate when metadata is malformed.
      }
    }
    return [];
  } catch (error) {
    console.warn(`[${provider === 'raiplay' ? 'RaiPlay' : 'Mediaset'}] ${error.message}`);
    return [];
  }
}

module.exports = { getOfficialStreams };
