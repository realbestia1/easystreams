"use strict";

const cheerio = require("cheerio");
const { extractVixCloud } = require("../extractors");
const { formatStream } = require("../formatter.js");
const { checkQualityFromPlaylist } = require("../quality_helper.js");
const { getProviderUrl } = require("../provider_urls.js");
const { createTimeoutSignal } = require("../fetch_helper.js");

function getUnityBaseUrl() {
  return getProviderUrl("animeunity");
}

function getMappingApiBase() {
  return getProviderUrl("mapping_api").replace(/\/+$/, "");
}
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

const FETCH_TIMEOUT = 10000;
const TTL = {
  http: 5 * 60 * 1000,
  animePage: 15 * 60 * 1000,
  streamPage: 5 * 60 * 1000,
  mapping: 2 * 60 * 1000
};

const caches = {
  http: new Map(),
  mapping: new Map(),
  inflight: new Map()
};

function getCached(map, key) {
  const entry = map.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    map.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCached(map, key, value, ttlMs) {
  map.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

function uniqueStrings(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function parsePositiveInt(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeRequestedEpisode(value) {
  const parsed = parsePositiveInt(value);
  return parsed || 1;
}

function normalizeRequestedSeason(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeConfigBoolean(value) {
  if (value === true) return true;
  const normalized = String(value || "").trim().toLowerCase();
  return ["1", "true", "yes", "on", "enabled", "checked"].includes(normalized);
}

function getMappingLanguage(providerContext = null) {
  const explicit = String(providerContext?.mappingLanguage || "").trim().toLowerCase();
  if (explicit === "it") return "it";
  return normalizeConfigBoolean(providerContext?.easyCatalogsLangIt) ? "it" : null;
}

function toAbsoluteUrl(href) {
  if (!href) return null;
  const trimmed = String(href).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  try {
    return new URL(trimmed, getUnityBaseUrl()).toString();
  } catch {
    return null;
  }
}

function normalizeAnimePath(pathOrUrl) {
  if (!pathOrUrl) return null;
  let value = String(pathOrUrl).trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    try {
      value = new URL(value).pathname;
    } catch {
      return null;
    }
  }

  if (!value.startsWith("/")) value = `/${value}`;
  value = value.replace(/\/+$/, "");

  const match = value.match(/^\/(?:anime\/\d+(?:-[^/?#]+)?|play\/[^/?#]+)/i);
  return match ? match[0] : null;
}

function buildUnityUrl(pathOrUrl) {
  const text = String(pathOrUrl || "").trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith("/")) return `${getUnityBaseUrl()}${text}`;
  return `${getUnityBaseUrl()}/${text}`;
}

function inferSourceTag(title, animePath) {
  const titleText = String(title || "").toLowerCase();
  const pathText = String(animePath || "").toLowerCase();
  if (/(?:^|[^\w])ita(?:[^\w]|$)/i.test(titleText)) return "ITA";
  if (/(?:^|[-_/])ita(?:[-_/]|$)/i.test(pathText)) return "ITA";
  return "SUB";
}

function sanitizeAnimeTitle(rawTitle) {
  let text = String(rawTitle || "").trim();
  if (!text) return null;

  text = text
    .replace(/\s*-\s*AnimeUnity.*$/i, "")
    .replace(/\s+Streaming.*$/i, "")
    .trim();

  // Remove language markers often embedded in AU page titles.
  text = text
    .replace(/\s*[\[(]\s*(?:SUB\s*ITA|ITA|SUB|DUB(?:BED)?|DOPPIATO)\s*[\])]\s*/gi, " ")
    .replace(/\s*[-–_|:]\s*(?:SUB\s*ITA|ITA|SUB|DUB(?:BED)?|DOPPIATO)\s*$/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*[-–_|:]\s*$/g, "")
    .trim();

  return text || null;
}

function parseVideoPlayerJson(rawValue, fallback) {
  const text = String(rawValue || "").trim();
  if (!text) return fallback;

  const attempts = [
    text,
    text
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
  ];

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try next variant
    }
  }

  return fallback;
}

function parseEpisodeNumber(value, fallbackNum) {
  const text = String(value || "").trim();
  const match = text.match(/(\d{1,4})/);
  if (match) {
    const parsed = Number.parseInt(match[1], 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallbackNum;
}

function parseTotalEpisodesFromHtml(html, fallbackCount = 0) {
  const match = /episodes_count="(\d+)"/i.exec(String(html || ""));
  const parsed = parsePositiveInt(match?.[1]);
  if (parsed) return parsed;
  return Math.max(0, parsePositiveInt(fallbackCount) || 0);
}

function extractEpisodesChunksFromHtml(html) {
  const chunks = [];
  const regex = /<video-player[^>]*episodes="([^"]*)"/gi;
  let match;
  while ((match = regex.exec(String(html || ""))) !== null) {
    const parsed = parseVideoPlayerJson(match[1], []);
    if (Array.isArray(parsed) && parsed.length > 0) {
      chunks.push(...parsed);
    }
  }
  return chunks;
}

function extractAnimeIdFromPath(animePath) {
  const match = String(animePath || "").match(/^\/anime\/(\d+)/i);
  return parsePositiveInt(match?.[1]);
}

function resolveLanguageEmoji(sourceTag) {
  return String(sourceTag || "").toUpperCase() === "ITA" ? "🇮🇹" : "🇯🇵";
}

function extractQualityHint(value) {
  const text = String(value || "");
  const match = text.match(/(\d{3,4}p)/i);
  return match ? match[1] : "Unknown";
}

function normalizeAnimeUnityQuality(value) {
  const quality = String(value || "").trim();
  if (!quality || ["unknown", "unknow"].includes(quality.toLowerCase())) return "720p";
  return quality;
}

function normalizeEpisodesList(sourceEpisodes = []) {
  if (!Array.isArray(sourceEpisodes) || sourceEpisodes.length === 0) return [];
  const out = [];
  const seen = new Set();

  for (let index = 0; index < sourceEpisodes.length; index += 1) {
    const entry = sourceEpisodes[index] || {};
    const numRaw = Number.parseInt(String(entry.num ?? index + 1), 10);
    const num = Number.isFinite(numRaw) && numRaw > 0 ? numRaw : index + 1;
    const episodeId = parsePositiveInt(entry.episodeId ?? entry.id);
    const scwsId = parsePositiveInt(entry.scwsId ?? entry.scws_id);
    const token =
      String(
        entry.token ||
          (episodeId ? `ep:${episodeId}` : scwsId ? `scws:${scwsId}` : `ep-${num}`)
      ).trim() || `ep-${num}`;
    const link = toAbsoluteUrl(entry.link || entry.file_name || null);
    const fileName = String(entry.fileName || entry.file_name || entry.link || "").trim() || null;
    const embedUrl = toAbsoluteUrl(entry.embedUrl || entry.embed_url || null);
    const key = `${num}|${episodeId || ""}|${scwsId || ""}|${token}|${link || ""}|${fileName || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      num,
      token,
      episodeId: episodeId || null,
      scwsId: scwsId || null,
      link,
      fileName,
      embedUrl
    });
  }

  out.sort((a, b) => a.num - b.num);
  return out;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT) {
  const timeoutConfig = createTimeoutSignal(timeoutMs);
  const requestOptions = { ...options };
  if (timeoutConfig.signal) {
    if (
      requestOptions.signal &&
      typeof AbortSignal !== "undefined" &&
      typeof AbortSignal.any === "function"
    ) {
      requestOptions.signal = AbortSignal.any([requestOptions.signal, timeoutConfig.signal]);
    } else if (!requestOptions.signal) {
      requestOptions.signal = timeoutConfig.signal;
    }
  }

  try {
    const response = await fetch(url, requestOptions);
    return response;
  } finally {
    if (typeof timeoutConfig.cleanup === "function") {
      timeoutConfig.cleanup();
    }
  }
}

async function fetchResource(url, options = {}) {
  const {
    ttlMs = 0,
    cacheKey = url,
    as = "text",
    method = "GET",
    headers = {},
    body = undefined,
    timeoutMs = FETCH_TIMEOUT
  } = options;

  const key = `${as}:${method}:${cacheKey}:${typeof body === "string" ? body : ""}`;
  if (ttlMs > 0) {
    const cached = getCached(caches.http, key);
    if (cached !== undefined) return cached;
  }

  const inflightKey = `http:${key}`;
  const running = caches.inflight.get(inflightKey);
  if (running) return running;

  const task = (async () => {
    const response = await fetchWithTimeout(
      url,
      {
        method,
        headers: {
          "user-agent": USER_AGENT,
          "accept-language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
          ...headers
        },
        body,
        redirect: "follow"
      },
      timeoutMs
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
    }

    const payload = as === "json" ? await response.json() : await response.text();
    if (ttlMs > 0) setCached(caches.http, key, payload, ttlMs);
    return payload;
  })();

  caches.inflight.set(inflightKey, task);
  try {
    return await task;
  } finally {
    caches.inflight.delete(inflightKey);
  }
}

function parseAnimePage(html, fallback = {}) {
  const $ = cheerio.load(html);
  const vp = $("video-player").first();

  const animeData = parseVideoPlayerJson(vp.attr("anime"), {});
  const episodeData = parseVideoPlayerJson(vp.attr("episode"), null);
  const episodesData = parseVideoPlayerJson(vp.attr("episodes"), []);

  const pageTitle =
    $("meta[property='og:title']").attr("content") ||
    $("title").first().text().trim() ||
    null;

  const titleCandidates = [
    fallback.title,
    animeData?.title_it,
    animeData?.title_eng,
    animeData?.title,
    pageTitle
  ];
  let title = null;
  for (const candidate of titleCandidates) {
    const cleaned = sanitizeAnimeTitle(candidate);
    if (cleaned) {
      title = cleaned;
      break;
    }
  }

  const chunkEpisodes = extractEpisodesChunksFromHtml(html);
  const episodesInput =
    Array.isArray(chunkEpisodes) && chunkEpisodes.length > 0
      ? chunkEpisodes
      : Array.isArray(episodesData) && episodesData.length > 0
        ? episodesData
        : episodeData
          ? [episodeData]
          : [];

  const episodes = normalizeEpisodesList(
    episodesInput.map((entry, index) => ({
      num: parseEpisodeNumber(entry?.number || entry?.link, index + 1),
      token: entry?.id ? `ep:${entry.id}` : undefined,
      episodeId: entry?.id,
      scwsId: entry?.scws_id,
      fileName: entry?.file_name || entry?.link,
      link: entry?.link || entry?.file_name,
      embedUrl: entry?.embed_url || null
    }))
  );

  const currentEmbedUrl = toAbsoluteUrl(vp.attr("embed_url"));
  if (currentEmbedUrl && episodes.length > 0) {
    if (episodeData?.id) {
      const currentId = parsePositiveInt(episodeData.id);
      const current = episodes.find((entry) => entry.episodeId === currentId);
      if (current) current.embedUrl = currentEmbedUrl;
      else episodes[0].embedUrl = currentEmbedUrl;
    } else {
      episodes[0].embedUrl = currentEmbedUrl;
    }
  }

  return {
    title,
    animePath: normalizeAnimePath(fallback.animePath || null),
    animeId: extractAnimeIdFromPath(fallback.animePath || null),
    sourceTag: inferSourceTag(title, fallback.animePath),
    totalEpisodes: parseTotalEpisodesFromHtml(html, episodes.length),
    episodes
  };
}

function isDirectMediaPath(value) {
  const text = String(value || "").trim();
  if (!text) return false;

  if (!/^https?:\/\//i.test(text)) {
    return /\.(?:mp4|m3u8)(?:[?#].*)?$/i.test(text);
  }

  try {
    const parsed = new URL(text);
    const path = String(parsed.pathname || "").toLowerCase();
    return path.endsWith(".mp4") || path.endsWith(".m3u8");
  } catch {
    return /\.(?:mp4|m3u8)(?:[?#].*)?$/i.test(text);
  }
}

function normalizePlayableMediaUrl(rawUrl, depth = 0) {
  const absolute = toAbsoluteUrl(rawUrl);
  if (!absolute) return null;
  if (isDirectMediaPath(absolute)) return absolute;
  if (depth >= 1) return null;

  let parsed;
  try {
    parsed = new URL(absolute);
  } catch {
    return null;
  }

  const path = String(parsed.pathname || "").toLowerCase();
  if (path.endsWith(".mp4") || path.endsWith(".m3u8")) return parsed.toString();

  const nestedKeys = ["url", "src", "file", "link", "stream", "id"];
  for (const key of nestedKeys) {
    const nested = parsed.searchParams.get(key);
    if (!nested) continue;

    let decoded = nested;
    try {
      decoded = decodeURIComponent(nested);
    } catch {
      decoded = nested;
    }

    const nestedUrl = normalizePlayableMediaUrl(decoded, depth + 1);
    if (nestedUrl) return nestedUrl;
  }

  return null;
}

function collectMediaLinksFromEmbedHtml(html) {
  const links = [];
  const seen = new Set();

  function addLink(href, label) {
    const playable = normalizePlayableMediaUrl(href);
    if (!playable || seen.has(playable)) return;
    seen.add(playable);
    links.push({ href: playable, label });
  }

  const raw = String(html || "");
  const variants = [raw, raw.replace(/\\\//g, "/")];

  for (const text of variants) {
    const downloadRegex = /window\.downloadUrl\s*=\s*["']([^"']+)["']/gi;
    let match;
    while ((match = downloadRegex.exec(text)) !== null) {
      addLink(match[1], "Download diretto");
    }

    const directRegex = /https?:\/\/[^\s"'<>\\]+(?:\.mp4|\.m3u8)(?:[^\s"'<>\\]*)?/gi;
    while ((match = directRegex.exec(text)) !== null) {
      addLink(match[0], "Player");
    }

    const encodedUrlRegex = /https%3A%2F%2F[^\s"'<>\\]+/gi;
    while ((match = encodedUrlRegex.exec(text)) !== null) {
      try {
        addLink(decodeURIComponent(match[0]), "Player");
      } catch {
        // ignore malformed encoded URLs
      }
    }

    const fileRegex = /(?:file|src|url|link)\s*[:=]\s*["']([^"']+)["']/gi;
    while ((match = fileRegex.exec(text)) !== null) {
      addLink(match[1], "Player");
    }
  }

  return links;
}

function pickEpisodeEntry(episodes, requestedEpisode) {
  const list = normalizeEpisodesList(episodes);
  if (list.length === 0) return null;

  const episode = normalizeRequestedEpisode(requestedEpisode);
  const byNum = list.find((entry) => entry.num === episode);
  if (byNum) return byNum;

  const byIndex = list[episode - 1];
  if (byIndex) return byIndex;

  if (list.length === 1) return list[0];
  const first = list.find((entry) => entry.num === 1);
  if (episode === 1 && first) return first;
  return null;
}

async function resolveEmbedUrlForEpisodeEntry(source, episodeEntry) {
  if (episodeEntry?.embedUrl) {
    const direct = toAbsoluteUrl(episodeEntry.embedUrl);
    if (direct) return direct;
  }

  if (episodeEntry?.episodeId) {
    try {
      const payload = await fetchResource(`${getUnityBaseUrl()}/embed-url/${episodeEntry.episodeId}`, {
        ttlMs: TTL.streamPage,
        cacheKey: `embed-url:${episodeEntry.episodeId}`,
        timeoutMs: FETCH_TIMEOUT
      });
      const embedUrl = toAbsoluteUrl(String(payload || "").trim());
      if (embedUrl) return embedUrl;
    } catch (error) {
      console.error("[AnimeUnity] embed endpoint failed:", error.message);
    }
  }

  if (source?.animePath) {
    try {
      const animeHtml = await fetchResource(buildUnityUrl(source.animePath), {
        ttlMs: TTL.animePage,
        cacheKey: `anime-fallback:${source.animePath}`,
        timeoutMs: FETCH_TIMEOUT
      });
      const parsed = parseAnimePage(animeHtml, source);
      const candidate = normalizeEpisodesList(parsed.episodes).find((entry) => {
        if (episodeEntry?.episodeId && entry.episodeId) return entry.episodeId === episodeEntry.episodeId;
        if (episodeEntry?.num && entry.num) return entry.num === episodeEntry.num;
        return false;
      });
      const fallbackEmbed = toAbsoluteUrl(candidate?.embedUrl || parsed.episodes?.[0]?.embedUrl || null);
      if (fallbackEmbed) return fallbackEmbed;
    } catch (error) {
      console.error("[AnimeUnity] anime fallback failed:", error.message);
    }
  }

  return null;
}

async function fetchEpisodesRangeFromApi(animeId, requestedEpisode, animeUrl) {
  const numericAnimeId = parsePositiveInt(animeId);
  const episodeNumber = normalizeRequestedEpisode(requestedEpisode);
  if (!numericAnimeId || !episodeNumber) return [];

  const startRange = Math.floor((episodeNumber - 1) / 120) * 120 + 1;
  const endRange = startRange + 119;
  const apiUrl = `${getUnityBaseUrl()}/info_api/${numericAnimeId}/1?start_range=${startRange}&end_range=${endRange}`;

  try {
    const payload = await fetchResource(apiUrl, {
      as: "json",
      ttlMs: TTL.animePage,
      cacheKey: `info-api:${numericAnimeId}:${startRange}:${endRange}`,
      timeoutMs: FETCH_TIMEOUT,
      headers: {
        "x-requested-with": "XMLHttpRequest",
        referer: animeUrl
      }
    });
    if (!payload || !Array.isArray(payload.episodes)) return [];
    return normalizeEpisodesList(
      payload.episodes.map((entry, index) => ({
        num: parseEpisodeNumber(entry?.number || entry?.link, index + 1),
        token: entry?.id ? `ep:${entry.id}` : undefined,
        episodeId: entry?.id,
        scwsId: entry?.scws_id,
        fileName: entry?.file_name || entry?.link,
        link: entry?.link || entry?.file_name,
        embedUrl: entry?.embed_url || null
      }))
    );
  } catch (error) {
    console.error("[AnimeUnity] info_api request failed:", error.message);
    return [];
  }
}

function parseExplicitRequestId(rawId) {
  const value = String(rawId || "").trim();
  if (!value) return null;

  let match = value.match(/^kitsu:(\d+)(?::(\d+))?(?::(\d+))?$/i);
  if (match) {
    return {
      provider: "kitsu",
      externalId: match[1],
      seasonFromId: match[3] ? normalizeRequestedSeason(match[2]) : null,
      episodeFromId: match[3]
        ? normalizeRequestedEpisode(match[3])
        : match[2]
          ? normalizeRequestedEpisode(match[2])
          : null
    };
  }

  match = value.match(/^imdb:(tt\d+)(?::(\d+))?(?::(\d+))?$/i);
  if (match) {
    return {
      provider: "imdb",
      externalId: match[1],
      seasonFromId: match[3] ? normalizeRequestedSeason(match[2]) : null,
      episodeFromId: match[3]
        ? normalizeRequestedEpisode(match[3])
        : match[2]
          ? normalizeRequestedEpisode(match[2])
          : null
    };
  }

  match = value.match(/^tmdb:(\d+)(?::(\d+))?(?::(\d+))?$/i);
  if (match) {
    return {
      provider: "tmdb",
      externalId: match[1],
      seasonFromId: match[3] ? normalizeRequestedSeason(match[2]) : null,
      episodeFromId: match[3]
        ? normalizeRequestedEpisode(match[3])
        : match[2]
          ? normalizeRequestedEpisode(match[2])
          : null
    };
  }

  match = value.match(/^(tt\d+)$/i);
  if (match) {
    return {
      provider: "imdb",
      externalId: match[1],
      seasonFromId: null,
      episodeFromId: null
    };
  }

  match = value.match(/^(\d+)$/);
  if (match) {
    return {
      provider: "tmdb",
      externalId: match[1],
      seasonFromId: null,
      episodeFromId: null
    };
  }

  return null;
}

function resolveLookupRequest(id, season, episode, providerContext = null) {
  let rawId = String(id || "").trim();
  try {
    rawId = decodeURIComponent(rawId);
  } catch {
    // keep raw id
  }

  let requestedSeason = normalizeRequestedSeason(season);
  let requestedEpisode = normalizeRequestedEpisode(episode);

  const explicit = parseExplicitRequestId(rawId);
  if (explicit) {
    const explicitSeason =
      Number.isInteger(explicit.seasonFromId) && explicit.seasonFromId >= 0
        ? explicit.seasonFromId
        : null;

    if (explicit.provider === "kitsu") {
      // For Kitsu lookups use season only when explicitly provided in the id.
      requestedSeason = explicitSeason;
    } else if (explicitSeason !== null) {
      requestedSeason = explicitSeason;
    }
    if (Number.isInteger(explicit.episodeFromId) && explicit.episodeFromId > 0) {
      requestedEpisode = explicit.episodeFromId;
    }
    return {
      provider: explicit.provider,
      externalId: explicit.externalId,
      season: requestedSeason,
      episode: requestedEpisode
    };
  }

  const contextKitsu = parsePositiveInt(providerContext?.kitsuId);
  if (contextKitsu) {
    return {
      provider: "kitsu",
      externalId: String(contextKitsu),
      season: null,
      episode: requestedEpisode
    };
  }

  const contextImdb = /^tt\d+$/i.test(String(providerContext?.imdbId || "").trim())
    ? String(providerContext.imdbId).trim()
    : null;
  if (contextImdb) {
    return {
      provider: "imdb",
      externalId: contextImdb,
      season: requestedSeason,
      episode: requestedEpisode
    };
  }

  const contextTmdb = /^\d+$/.test(String(providerContext?.tmdbId || "").trim())
    ? String(providerContext.tmdbId).trim()
    : null;
  if (contextTmdb) {
    return {
      provider: "tmdb",
      externalId: contextTmdb,
      season: requestedSeason,
      episode: requestedEpisode
    };
  }

  return null;
}

async function fetchMappingPayload(lookup, providerContext = null) {
  if (!lookup?.provider || !lookup?.externalId) return null;

  const provider = String(lookup.provider || "").trim().toLowerCase();
  const externalId = String(lookup.externalId || "").trim();
  const requestedEpisode = normalizeRequestedEpisode(lookup.episode);
  const requestedSeason = normalizeRequestedSeason(lookup.season);

  if (!["kitsu", "imdb", "tmdb"].includes(provider)) return null;
  if (!externalId) return null;

  const mappingLanguage = provider === "kitsu" ? "it" : getMappingLanguage(providerContext);
  const mappingLanguageToken = mappingLanguage || "default";
  const cacheKey = `${provider}:${externalId}:s=${requestedSeason ?? "na"}:ep=${requestedEpisode}:lang=${mappingLanguageToken}`;
  const cached = getCached(caches.mapping, cacheKey);
  if (cached !== undefined) return cached;

  const params = new URLSearchParams();
  params.set("ep", String(requestedEpisode));
  if (Number.isInteger(requestedSeason) && requestedSeason >= 0) {
    params.set("s", String(requestedSeason));
  }
  if (mappingLanguage === "it") {
    params.set("lang", "it");
  }

  const url = `${getMappingApiBase()}/${provider}/${encodeURIComponent(externalId)}?${params.toString()}`;
  try {
    const payload = await fetchResource(url, {
      as: "json",
      ttlMs: TTL.mapping,
      cacheKey,
      timeoutMs: FETCH_TIMEOUT
    });
    setCached(caches.mapping, cacheKey, payload, TTL.mapping);
    return payload;
  } catch (error) {
    console.error("[AnimeUnity] mapping request failed:", error.message);
    return null;
  }
}

function extractAnimeUnityPaths(mappingPayload) {
  if (!mappingPayload || typeof mappingPayload !== "object") return [];
  const raw = mappingPayload?.mappings?.animeunity;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];

  const paths = [];
  for (const item of list) {
    const candidate =
      typeof item === "string"
        ? item
        : item && typeof item === "object"
          ? item.path || item.url || item.href || item.playPath
          : null;
    const normalized = normalizeAnimePath(candidate);
    if (normalized) paths.push(normalized);
  }

  return uniqueStrings(paths);
}

function extractTmdbIdFromMappingPayload(mappingPayload) {
  const candidate =
    mappingPayload?.mappings?.ids?.tmdb ||
    mappingPayload?.ids?.tmdb ||
    mappingPayload?.tmdbId ||
    null;
  const text = String(candidate || "").trim();
  return /^\d+$/.test(text) ? text : null;
}

function resolveEpisodeFromMappingPayload(mappingPayload, fallbackEpisode) {
  const fromKitsu = parsePositiveInt(mappingPayload?.kitsu?.episode);
  if (fromKitsu) return fromKitsu;

  const fromRequested = parsePositiveInt(mappingPayload?.requested?.episode);
  if (fromRequested) return fromRequested;

  return normalizeRequestedEpisode(fallbackEpisode);
}

async function mapLimit(values, limit, mapper) {
  if (!Array.isArray(values) || values.length === 0) return [];
  const concurrency = Math.max(1, Math.min(limit, values.length));
  const output = new Array(values.length);
  let cursor = 0;

  async function worker() {
    while (cursor < values.length) {
      const current = cursor;
      cursor += 1;
      try {
        output[current] = await mapper(values[current], current);
      } catch (error) {
        output[current] = [];
        console.error("[AnimeUnity] task failed:", error.message);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return output;
}

async function extractStreamsFromAnimePath(animePath, requestedEpisode) {
  const normalizedPath = normalizeAnimePath(animePath);
  if (!normalizedPath) return [];

  const animeUrl = buildUnityUrl(normalizedPath);
  if (!animeUrl) return [];

  let parsedAnime = null;
  try {
    const html = await fetchResource(animeUrl, {
      ttlMs: TTL.animePage,
      cacheKey: `anime:${normalizedPath}`,
      timeoutMs: FETCH_TIMEOUT
    });
    parsedAnime = parseAnimePage(html, { animePath: normalizedPath });
  } catch (error) {
    console.error("[AnimeUnity] anime page failed:", error.message);
    return [];
  }

  const normalizedEpisode = normalizeRequestedEpisode(requestedEpisode);
  let episodes = normalizeEpisodesList(parsedAnime.episodes);
  let selected = pickEpisodeEntry(episodes, normalizedEpisode);

  if (
    !selected &&
    parsedAnime.animeId &&
    parsedAnime.totalEpisodes > episodes.length
  ) {
    const extraEpisodes = await fetchEpisodesRangeFromApi(
      parsedAnime.animeId,
      normalizedEpisode,
      animeUrl
    );
    if (extraEpisodes.length > 0) {
      episodes = normalizeEpisodesList([...episodes, ...extraEpisodes]);
      selected = pickEpisodeEntry(episodes, normalizedEpisode);
    }
  }

  if (!selected) return [];

  const labelSuffix = "";
  const resolvedEpisodeNumber = parsePositiveInt(selected.num) || normalizedEpisode || 1;
  const baseTitle = sanitizeAnimeTitle(parsedAnime.title) || "Unknown Title";
  const displayTitle = `${baseTitle} - Ep ${resolvedEpisodeNumber}${labelSuffix}`;
  const streamLanguage = resolveLanguageEmoji(parsedAnime.sourceTag);
  const streams = [];

  const blockedDomains = [
    "jujutsukaisenanime.com",
    "onepunchman.it",
    "dragonballhd.it",
    "narutolegend.it"
  ];

  const directUrl = toAbsoluteUrl(selected.link || selected.fileName || null);
  if (directUrl && /^https?:\/\//i.test(directUrl)) {
    const lowerLink = directUrl.toLowerCase();
    const isBlocked =
      lowerLink.endsWith(".mkv.mp4") ||
      blockedDomains.some((domain) => lowerLink.includes(domain));

    if (!isBlocked) {
      let quality = extractQualityHint(directUrl);
      if (quality === "Unknown") quality = extractQualityHint(selected.fileName);

      if (lowerLink.includes(".m3u8")) {
        const detected = await checkQualityFromPlaylist(directUrl, {
          "User-Agent": USER_AGENT,
          Referer: getUnityBaseUrl()
        });
        if (detected) quality = detected;
      }
      quality = normalizeAnimeUnityQuality(quality);

      streams.push({
        name: `AnimeUnity${labelSuffix}`,
        title: displayTitle,
        url: directUrl,
        language: streamLanguage,
        quality,
        type: "direct",
        headers: {
          "User-Agent": USER_AGENT,
          Referer: getUnityBaseUrl()
        }
      });
    }
  }

  if (selected.scwsId && selected.episodeId) {
    try {
      const embedPayload = await fetchResource(`${getUnityBaseUrl()}/embed-url/${selected.episodeId}`, {
        ttlMs: TTL.streamPage,
        cacheKey: `embed-url:${selected.episodeId}`,
        timeoutMs: FETCH_TIMEOUT,
        headers: {
          referer: animeUrl,
          "x-requested-with": "XMLHttpRequest"
        }
      });
      const embedUrl = toAbsoluteUrl(String(embedPayload || "").trim());
      if (embedUrl && /^https?:\/\//i.test(embedUrl)) {
        const vixStreams = await extractVixCloud(embedUrl);
        if (Array.isArray(vixStreams) && vixStreams.length > 0) {
          streams.push(
            ...vixStreams.map((stream) => ({
              ...stream,
              name: `AnimeUnity - VixCloud${labelSuffix}`,
              title: displayTitle,
              language: stream.language || streamLanguage
            }))
          );
        }
      }
    } catch (error) {
      console.error("[AnimeUnity] VixCloud extraction failed:", error.message);
    }
  }

  if (streams.length > 0) return streams;

  const embedUrl = await resolveEmbedUrlForEpisodeEntry(
    {
      animePath: normalizedPath,
      title: parsedAnime.title,
      sourceTag: parsedAnime.sourceTag,
      episodes
    },
    selected
  );
  if (!embedUrl) return [];

  let embedHtml = "";
  try {
    embedHtml = await fetchResource(embedUrl, {
      ttlMs: TTL.streamPage,
      cacheKey: `embed:${embedUrl}`,
      timeoutMs: FETCH_TIMEOUT
    });
  } catch (error) {
    console.error("[AnimeUnity] embed page failed:", error.message);
    return [];
  }

  const mediaLinks = collectMediaLinksFromEmbedHtml(embedHtml);
  if (!Array.isArray(mediaLinks) || mediaLinks.length === 0) return [];

  const fallbackStreams = [];
  for (const link of mediaLinks) {
    const mediaUrl = normalizePlayableMediaUrl(link.href);
    if (!mediaUrl) continue;
    let quality = extractQualityHint(mediaUrl);
    if (mediaUrl.toLowerCase().includes(".m3u8")) {
      const detected = await checkQualityFromPlaylist(mediaUrl, {
        "User-Agent": USER_AGENT,
        Referer: getUnityBaseUrl()
      });
      if (detected) quality = detected;
    }
    quality = normalizeAnimeUnityQuality(quality);
    fallbackStreams.push({
      name: `AnimeUnity${labelSuffix}`,
      title: displayTitle,
      url: mediaUrl,
      language: streamLanguage,
      quality,
      type: "direct",
      headers: {
        "User-Agent": USER_AGENT,
        Referer: getUnityBaseUrl()
      }
    });
  }
  return fallbackStreams;
}

async function getStreams(id, type, season, episode, providerContext = null) {
  try {
    const lookup = resolveLookupRequest(id, season, episode, providerContext);
    if (!lookup) return [];

    let mappingPayload = await fetchMappingPayload(lookup, providerContext);
    let animePaths = extractAnimeUnityPaths(mappingPayload);

    // IMDb mappings may be missing while TMDB mapping exists: retry with TMDB id.
    if (animePaths.length === 0 && String(lookup.provider || "").toLowerCase() === "imdb") {
      const tmdbFromContext = /^\d+$/.test(String(providerContext?.tmdbId || "").trim())
        ? String(providerContext.tmdbId).trim()
        : null;
      const tmdbFromPayload = extractTmdbIdFromMappingPayload(mappingPayload);
      const fallbackTmdbId = tmdbFromContext || tmdbFromPayload;
      if (fallbackTmdbId) {
        const tmdbLookup = {
          provider: "tmdb",
          externalId: fallbackTmdbId,
          season: lookup.season,
          episode: lookup.episode
        };
        const tmdbPayload = await fetchMappingPayload(tmdbLookup, providerContext);
        const tmdbPaths = extractAnimeUnityPaths(tmdbPayload);
        if (tmdbPaths.length > 0) {
          mappingPayload = tmdbPayload;
          animePaths = tmdbPaths;
        }
      }
    }

    if (animePaths.length === 0) return [];

    const requestedEpisode = resolveEpisodeFromMappingPayload(mappingPayload, lookup.episode);
    const perPathStreams = await mapLimit(animePaths, 3, (path) =>
      extractStreamsFromAnimePath(path, requestedEpisode)
    );

    const streams = perPathStreams.flat().filter((stream) => stream && stream.url);
    const deduped = [];
    const seen = new Set();
    for (const stream of streams) {
      const normalizedUrl = normalizePlayableMediaUrl(stream.url);
      if (!normalizedUrl) continue;
      if (seen.has(normalizedUrl)) continue;
      seen.add(normalizedUrl);
      deduped.push({ ...stream, url: normalizedUrl });
    }

    return deduped
      .map((stream) => formatStream(stream, "AnimeUnity"))
      .filter(Boolean);
  } catch (error) {
    console.error("[AnimeUnity] getStreams failed:", error.message);
    return [];
  }
}

module.exports = { getStreams };
