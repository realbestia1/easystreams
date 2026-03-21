"use strict";

const cheerio = require("cheerio");
const { formatStream } = require("../formatter.js");
const { checkQualityFromPlaylist } = require("../quality_helper.js");
const { getProviderUrl } = require("../provider_urls.js");
const { createTimeoutSignal } = require("../fetch_helper.js");

function getSaturnBaseUrl() {
  return getProviderUrl("animesaturn");
}

function getMappingApiBase() {
  return getProviderUrl("mapping_api").replace(/\/+$/, "");
}
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

const FETCH_TIMEOUT = 10000;
const TTL = {
  http: 5 * 60 * 1000,
  page: 15 * 60 * 1000,
  watch: 5 * 60 * 1000,
  mapping: 2 * 60 * 1000
};

const BLOCKED_DOMAINS = [
  "jujutsukaisenanime.com",
  "onepunchman.it",
  "dragonballhd.it",
  "narutolegend.it"
];

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

function toAbsoluteUrl(href, base = null) {
  if (!href) return null;
  const trimmed = String(href).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  try {
    return new URL(trimmed, base || getSaturnBaseUrl()).toString();
  } catch {
    return null;
  }
}

function normalizeAnimeSaturnPath(pathOrUrl) {
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
  const match = value.match(/^\/anime\/[^/?#]+/i);
  return match ? match[0] : null;
}

function normalizeEpisodePath(pathOrUrl) {
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
  const match = value.match(/^\/ep\/[^/?#]+/i);
  return match ? match[0] : null;
}

function buildSaturnUrl(pathOrUrl) {
  const text = String(pathOrUrl || "").trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith("/")) return `${getSaturnBaseUrl()}${text}`;
  return `${getSaturnBaseUrl()}/${text}`;
}

function inferSourceTag(title, animePath) {
  const titleText = String(title || "").toLowerCase();
  const pathText = String(animePath || "").toLowerCase();
  if (/(?:^|[^\w])ita(?:[^\w]|$)/i.test(titleText)) return "ITA";
  if (/(?:^|[-_/])ita(?:[-_/]|$)/i.test(pathText)) return "ITA";
  return "SUB";
}

function resolveLanguageEmoji(sourceTag) {
  return String(sourceTag || "").toUpperCase() === "ITA" ? "🇮🇹" : "🇯🇵";
}

function sanitizeAnimeTitle(rawTitle) {
  let text = String(rawTitle || "").trim();
  if (!text) return null;

  text = text
    .replace(/^\s*AnimeSaturn\s*-\s*/i, "")
    .replace(/\s*-\s*AnimeSaturn.*$/i, "")
    .replace(/\s+Streaming.*$/i, "")
    .replace(/\s+Episodi.*$/i, "")
    .replace(/\s+episodio\s*\d+(?:[.,]\d+)?\b/gi, "")
    .replace(/\s+episode\s*\d+(?:[.,]\d+)?\b/gi, "")
    .trim();

  text = text
    .replace(/\s*[\[(]\s*(?:SUB\s*ITA|ITA|SUB|DUB(?:BED)?|DOPPIATO)\s*[\])]\s*/gi, " ")
    .replace(/\s*[-–_|:]\s*(?:SUB\s*ITA|ITA|SUB|DUB(?:BED)?|DOPPIATO)\s*$/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*[-–_|:]\s*$/g, "")
    .trim();

  return text || null;
}

function parseEpisodeNumber(value, fallbackNum) {
  const raw = String(value || "").trim();
  if (!raw) return fallbackNum;

  const byHref = raw.match(/-ep-(\d+)/i);
  if (byHref) {
    const parsed = Number.parseInt(byHref[1], 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  const byLabel = raw.match(/episodio\s*(\d+)/i);
  if (byLabel) {
    const parsed = Number.parseInt(byLabel[1], 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return fallbackNum;
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
  const absolute = toAbsoluteUrl(rawUrl, getSaturnBaseUrl());
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

function extractQualityHint(value) {
  const text = String(value || "");
  const match = text.match(/(\d{3,4}p)/i);
  return match ? match[1] : "Unknown";
}

function normalizeAnimeSaturnQuality(value) {
  const text = String(value || "").trim();
  if (!text) return "720p";
  if (/^(?:unknown|unknow|auto)$/i.test(text)) return "720p";
  return text;
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
    return await fetch(url, requestOptions);
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

function extractWatchUrlsFromHtml(html, expectedFileId = null) {
  const text = String(html || "");
  const values = new Set();

  let match;
  const absoluteRegex = /https?:\/\/[^\s"'<>\\]+\/watch\?file=[^"'<>\\\s]+/gi;
  while ((match = absoluteRegex.exec(text)) !== null) {
    values.add(match[0]);
  }

  const relativeRegex = /\/watch\?file=[^"'<>\\\s]+/gi;
  while ((match = relativeRegex.exec(text)) !== null) {
    values.add(buildSaturnUrl(match[0]));
  }

  const out = [];
  const seen = new Set();
  for (const candidate of values) {
    const absolute = toAbsoluteUrl(candidate);
    if (!absolute || seen.has(absolute)) continue;

    try {
      const parsed = new URL(absolute);
      if (parsed.pathname !== "/watch") continue;
      const fileParam = parsed.searchParams.get("file");
      if (!fileParam) continue;
      if (expectedFileId && fileParam !== expectedFileId) continue;

      seen.add(absolute);
      out.push(absolute);

      if (!parsed.searchParams.has("s")) {
        parsed.searchParams.set("s", "alt");
        const altUrl = parsed.toString();
        if (!seen.has(altUrl)) {
          seen.add(altUrl);
          out.push(altUrl);
        }
      }
    } catch {
      // ignore malformed URLs
    }
  }

  return out;
}

function parseAnimeSaturnPage(html, fallback = {}) {
  const $ = cheerio.load(html);

  const pageTitle =
    $("h1").first().text().trim() ||
    $("meta[property='og:title']").attr("content") ||
    $("title").first().text().trim() ||
    null;

  const title = sanitizeAnimeTitle(fallback.title) || sanitizeAnimeTitle(pageTitle) || null;
  const animePath = normalizeAnimeSaturnPath(fallback.animePath || null);
  const sourceTag = inferSourceTag(title, animePath);

  const episodes = [];
  const seenEpisodePath = new Set();
  $("a[href*='/ep/']").each((index, element) => {
    const anchor = $(element);
    const href = normalizeEpisodePath(anchor.attr("href"));
    if (!href || seenEpisodePath.has(href)) return;
    seenEpisodePath.add(href);

    const probe = `${href} ${anchor.text() || ""} ${anchor.attr("title") || ""}`;
    const num = parseEpisodeNumber(probe, index + 1);
    episodes.push({
      num,
      token: href,
      episodePath: href,
      watchUrl: null
    });
  });

  if (episodes.length === 0) {
    const watchUrls = extractWatchUrlsFromHtml(html);
    if (watchUrls.length > 0) {
      episodes.push({
        num: 1,
        token: "watch-1",
        episodePath: null,
        watchUrl: watchUrls[0]
      });
    }
  }

  const relatedAnimePaths = [];
  const seenRelated = new Set();
  $("a[href*='/anime/']").each((_, element) => {
    const anchor = $(element);
    const relatedPath = normalizeAnimeSaturnPath(anchor.attr("href"));
    if (!relatedPath || seenRelated.has(relatedPath)) return;
    if (animePath && relatedPath === animePath) return;

    const probe = `${anchor.text() || ""} ${anchor.attr("title") || ""} ${relatedPath}`.toLowerCase();
    if (!probe.includes("ita")) return;

    seenRelated.add(relatedPath);
    relatedAnimePaths.push(relatedPath);
  });

  episodes.sort((a, b) => a.num - b.num);

  return {
    title,
    animePath,
    sourceTag,
    episodes,
    relatedAnimePaths
  };
}

function normalizeEpisodesList(sourceEpisodes = []) {
  if (!Array.isArray(sourceEpisodes) || sourceEpisodes.length === 0) return [];

  const out = [];
  const seen = new Set();

  for (let index = 0; index < sourceEpisodes.length; index += 1) {
    const entry = sourceEpisodes[index] || {};
    const numRaw = Number.parseInt(String(entry.num ?? index + 1), 10);
    const num = Number.isFinite(numRaw) && numRaw > 0 ? numRaw : index + 1;
    const episodePath = normalizeEpisodePath(entry.episodePath || entry.href || entry.token || null);
    const watchUrl = toAbsoluteUrl(entry.watchUrl || null);
    const token = String(entry.token || episodePath || watchUrl || `ep-${num}`).trim();
    const key = `${num}|${episodePath || ""}|${watchUrl || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ num, token, episodePath, watchUrl });
  }

  out.sort((a, b) => a.num - b.num);
  return out;
}

function mergeEpisodeLists(existingEpisodes = [], nextEpisodes = []) {
  const map = new Map();

  function setEpisode(entry) {
    if (!entry) return;
    const num = Number.parseInt(String(entry.num || ""), 10);
    if (!Number.isFinite(num) || num <= 0) return;
    const current = map.get(num) || { num, token: null, episodePath: null, watchUrl: null };
    map.set(num, {
      num,
      token: entry.token || current.token || null,
      episodePath: entry.episodePath || current.episodePath || null,
      watchUrl: entry.watchUrl || current.watchUrl || null
    });
  }

  normalizeEpisodesList(existingEpisodes).forEach(setEpisode);
  normalizeEpisodesList(nextEpisodes).forEach(setEpisode);

  return [...map.values()].sort((a, b) => a.num - b.num);
}

function pickEpisodeEntry(episodes, requestedEpisode, mediaType = "tv") {
  const list = normalizeEpisodesList(episodes);
  if (list.length === 0) return null;
  if (mediaType === "movie") return list[0];

  const episode = normalizeRequestedEpisode(requestedEpisode);
  const byNum = list.find((entry) => entry.num === episode);
  if (byNum) return byNum;
  if (episode === 1) return list[0];
  return null;
}

function watchLabelFromUrl(url) {
  try {
    const parsed = new URL(url);
    const s = parsed.searchParams.get("s");
    const server = parsed.searchParams.get("server");
    if (s && String(s).toLowerCase() === "alt") {
      if (server !== null) return `Player ALT (server ${server})`;
      return "Player ALT";
    }
    if (server !== null) return `Player (server ${server})`;
    return "Player";
  } catch {
    return "Player";
  }
}

function collectMediaLinksFromWatchHtml(html) {
  const $ = cheerio.load(String(html || ""));
  const links = [];
  const seen = new Set();

  function addLink(href, label) {
    const playable = normalizePlayableMediaUrl(href);
    if (!playable || seen.has(playable)) return;
    seen.add(playable);
    links.push({ href: playable, label });
  }

  $("source[src], video source[src]").each((_, element) => {
    addLink($(element).attr("src"), "Player");
  });

  const rawHtml = String(html || "");
  const variants = [rawHtml, rawHtml.replace(/\\\//g, "/")];
  for (const text of variants) {
    let match;
    const directRegex = /https?:\/\/[^\s"'<>\\]+(?:\.mp4|\.m3u8)(?:[^\s"'<>\\]*)?/gi;
    while ((match = directRegex.exec(text)) !== null) {
      addLink(match[0], "Player");
    }

    const encodedRegex = /https%3A%2F%2F[^\s"'<>\\]+/gi;
    while ((match = encodedRegex.exec(text)) !== null) {
      try {
        addLink(decodeURIComponent(match[0]), "Player");
      } catch {
        // ignore malformed encoded URLs
      }
    }

    const sourceRegex = /(?:file|src|url|link)\s*[:=]\s*["']([^"']+)["']/gi;
    while ((match = sourceRegex.exec(text)) !== null) {
      addLink(match[1], "Player");
    }
  }

  return links;
}

function normalizeHostLabel(rawUrl) {
  try {
    const host = new URL(String(rawUrl || "")).hostname.replace(/^www\./i, "").toLowerCase();
    if (!host) return "";
    const first = host.split(".")[0] || host;
    return first.charAt(0).toUpperCase() + first.slice(1);
  } catch {
    return "";
  }
}

async function resolveWatchUrlsForEpisodeEntry(source, episodeEntry) {
  const urls = [];
  const hasEpisodePath = Boolean(episodeEntry?.episodePath);

  if (episodeEntry?.watchUrl) {
    urls.push(...extractWatchUrlsFromHtml(episodeEntry.watchUrl));
  }

  if (urls.length === 0 && episodeEntry?.episodePath) {
    const episodeUrl = buildSaturnUrl(episodeEntry.episodePath);
    if (episodeUrl) {
      try {
        const html = await fetchResource(episodeUrl, {
          ttlMs: TTL.watch,
          cacheKey: `episode-page:${episodeEntry.episodePath}`,
          timeoutMs: FETCH_TIMEOUT
        });
        urls.push(...extractWatchUrlsFromHtml(html));
      } catch (error) {
        console.error("[AnimeSaturn] episode page request failed:", error.message);
      }
    }
  }

  if (hasEpisodePath && urls.length === 0) {
    const epLabel = Number.isFinite(Number(episodeEntry?.num)) ? episodeEntry.num : "?";
    console.log(`[AnimeSaturn] No watch links for episode ${epLabel}. Skipping fallback.`);
    return [];
  }

  if (urls.length === 0 && source?.animePath) {
    const animeUrl = buildSaturnUrl(source.animePath);
    if (animeUrl) {
      try {
        const html = await fetchResource(animeUrl, {
          ttlMs: TTL.watch,
          cacheKey: `anime-watch-fallback:${source.animePath}`,
          timeoutMs: FETCH_TIMEOUT
        });
        urls.push(...extractWatchUrlsFromHtml(html));
      } catch (error) {
        console.error("[AnimeSaturn] anime watch fallback failed:", error.message);
      }
    }
  }

  return uniqueStrings(urls.map((url) => toAbsoluteUrl(url))).filter(Boolean);
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
        console.error("[AnimeSaturn] task failed:", error.message);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return output;
}

async function extractStreamsFromAnimePath(animePath, requestedEpisode, mediaType = "tv", originalEpisode = null) {
  const normalizedPath = normalizeAnimeSaturnPath(animePath);
  if (!normalizedPath) return [];

  const animeUrl = buildSaturnUrl(normalizedPath);
  if (!animeUrl) return [];

  let parsedPage;
  try {
    const html = await fetchResource(animeUrl, {
      ttlMs: TTL.page,
      cacheKey: `anime:${normalizedPath}`,
      timeoutMs: FETCH_TIMEOUT
    });
    parsedPage = parseAnimeSaturnPage(html, { animePath: normalizedPath });
  } catch (error) {
    console.error("[AnimeSaturn] anime page request failed:", error.message);
    return [];
  }

  const normalizedEpisode = normalizeRequestedEpisode(requestedEpisode);
  const normalizedOriginalEpisode = normalizeRequestedEpisode(
    originalEpisode === null || originalEpisode === undefined ? normalizedEpisode : originalEpisode
  );
  let episodes = normalizeEpisodesList(parsedPage.episodes);
  let selected = pickEpisodeEntry(episodes, normalizedEpisode, mediaType);

  const allowRelated = String(parsedPage.sourceTag || "").toUpperCase() !== "ITA";
  if (
    allowRelated &&
    (!selected || episodes.length === 0) &&
    Array.isArray(parsedPage.relatedAnimePaths) &&
    parsedPage.relatedAnimePaths.length > 0
  ) {
    for (const related of parsedPage.relatedAnimePaths.slice(0, 2)) {
      try {
        const relatedUrl = buildSaturnUrl(related);
        if (!relatedUrl) continue;
        const html = await fetchResource(relatedUrl, {
          ttlMs: TTL.page,
          cacheKey: `anime-related:${related}`,
          timeoutMs: FETCH_TIMEOUT
        });
        const relatedParsed = parseAnimeSaturnPage(html, { animePath: related, title: parsedPage.title });
        episodes = mergeEpisodeLists(episodes, relatedParsed.episodes);
      } catch {
        // ignore related path errors
      }
    }
    selected = pickEpisodeEntry(episodes, normalizedEpisode, mediaType);
  }

  if (!selected) return [];

  const baseTitle = sanitizeAnimeTitle(parsedPage.title) || "Unknown Title";
  const resolvedEpisode = parsePositiveInt(selected.num) || normalizedEpisode;
  if (String(parsedPage.sourceTag || "").toUpperCase() === "ITA" && resolvedEpisode !== normalizedOriginalEpisode) {
    console.log(`[AnimeSaturn] Skipping ITA episode ${resolvedEpisode} (requested ${normalizedOriginalEpisode}).`);
    return [];
  }
  const displayTitle = mediaType === "movie" ? baseTitle : `${baseTitle} - Ep ${resolvedEpisode}`;
  const streamLanguage = resolveLanguageEmoji(parsedPage.sourceTag);

  const initialWatchUrls = await resolveWatchUrlsForEpisodeEntry(
    {
      animePath: normalizedPath,
      title: parsedPage.title,
      sourceTag: parsedPage.sourceTag,
      episodes
    },
    selected
  );
  if (initialWatchUrls.length === 0) return [];

  const queue = [...initialWatchUrls];
  const visitedWatchUrls = new Set();
  const streams = [];
  const seenMedia = new Set();
  const expectedFileId = (() => {
    try {
      const parsed = new URL(initialWatchUrls[0]);
      return parsed.searchParams.get("file");
    } catch {
      return null;
    }
  })();

  let processed = 0;
  while (queue.length > 0 && processed < 6) {
    const watchUrl = queue.shift();
    if (!watchUrl || visitedWatchUrls.has(watchUrl)) continue;
    visitedWatchUrls.add(watchUrl);
    processed += 1;

    let html = "";
    try {
      html = await fetchResource(watchUrl, {
        ttlMs: TTL.watch,
        cacheKey: `watch:${watchUrl}`,
        timeoutMs: FETCH_TIMEOUT
      });
    } catch (error) {
      console.error("[AnimeSaturn] watch page request failed:", error.message);
      continue;
    }

    const links = collectMediaLinksFromWatchHtml(html);
    for (const link of links) {
      const mediaUrl = normalizePlayableMediaUrl(link.href);
      if (!mediaUrl || seenMedia.has(mediaUrl)) continue;

      const lowerLink = mediaUrl.toLowerCase();
      if (
        lowerLink.endsWith(".mkv.mp4") ||
        BLOCKED_DOMAINS.some((domain) => lowerLink.includes(domain))
      ) {
        continue;
      }

      seenMedia.add(mediaUrl);
      let quality = extractQualityHint(mediaUrl);
      if (lowerLink.includes(".m3u8")) {
        const detected = await checkQualityFromPlaylist(mediaUrl, {
          "User-Agent": USER_AGENT,
          Referer: watchUrl
        });
        if (detected) quality = detected;
      }

      const hostLabel = normalizeHostLabel(mediaUrl);
      const serverName = hostLabel ? `AnimeSaturn - ${hostLabel}` : "AnimeSaturn";
      streams.push({
        name: serverName,
        server: serverName,
        title: displayTitle,
        url: mediaUrl,
        language: streamLanguage,
        quality: normalizeAnimeSaturnQuality(quality),
        headers: {
          "User-Agent": USER_AGENT,
          Referer: watchUrl
        }
      });
    }

    const extraWatchUrls = extractWatchUrlsFromHtml(html, expectedFileId);
    for (const extra of extraWatchUrls) {
      if (!visitedWatchUrls.has(extra)) queue.push(extra);
    }
  }

  return streams;
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
    console.error("[AnimeSaturn] mapping request failed:", error.message);
    return null;
  }
}

function extractAnimeSaturnPaths(mappingPayload) {
  if (!mappingPayload || typeof mappingPayload !== "object") return [];
  const raw = mappingPayload?.mappings?.animesaturn;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];

  const paths = [];
  for (const item of list) {
    const candidate =
      typeof item === "string"
        ? item
        : item && typeof item === "object"
          ? item.path || item.url || item.href || item.playPath
          : null;
    const normalized = normalizeAnimeSaturnPath(candidate);
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

  const fromTmdbRaw = parsePositiveInt(
    mappingPayload?.mappings?.tmdb_episode?.rawEpisodeNumber ||
    mappingPayload?.mappings?.tmdb_episode?.raw_episode_number ||
    mappingPayload?.mappings?.tmdbEpisode?.rawEpisodeNumber ||
    mappingPayload?.tmdb_episode?.rawEpisodeNumber ||
    mappingPayload?.tmdbEpisode?.rawEpisodeNumber
  );
  if (fromTmdbRaw) return fromTmdbRaw;

  return normalizeRequestedEpisode(fallbackEpisode);
}

async function getStreams(id, type, season, episode, providerContext = null) {
  try {
    const lookup = resolveLookupRequest(id, season, episode, providerContext);
    if (!lookup) return [];

    let mappingPayload = await fetchMappingPayload(lookup, providerContext);
    let animePaths = extractAnimeSaturnPaths(mappingPayload);

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
        const tmdbPaths = extractAnimeSaturnPaths(tmdbPayload);
        if (tmdbPaths.length > 0) {
          mappingPayload = tmdbPayload;
          animePaths = tmdbPaths;
        }
      }
    }

    if (animePaths.length === 0) return [];

    const requestedEpisode = resolveEpisodeFromMappingPayload(mappingPayload, lookup.episode);
    const originalRequestedEpisode = normalizeRequestedEpisode(lookup.episode);
    const normalizedType = String(type || "").toLowerCase();
    const mediaType = normalizedType === "movie" ? "movie" : "tv";

    const perPathStreams = await mapLimit(animePaths, 3, (path) =>
      extractStreamsFromAnimePath(path, requestedEpisode, mediaType, originalRequestedEpisode)
    );

    const streams = perPathStreams.flat().filter((stream) => stream && stream.url);
    const deduped = [];
    const seen = new Set();
    for (const stream of streams) {
      const normalizedUrl = normalizePlayableMediaUrl(stream.url);
      if (!normalizedUrl || seen.has(normalizedUrl)) continue;
      seen.add(normalizedUrl);
      deduped.push({ ...stream, url: normalizedUrl });
    }

    return deduped
      .map((stream) => formatStream(stream, "AnimeSaturn"))
      .filter(Boolean);
  } catch (error) {
    console.error("[AnimeSaturn] getStreams failed:", error.message);
    return [];
  }
}

module.exports = { getStreams };
