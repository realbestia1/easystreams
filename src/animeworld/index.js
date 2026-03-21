"use strict";

const { formatStream } = require("../formatter.js");
const { checkQualityFromPlaylist } = require("../quality_helper.js");
const { getProviderUrl } = require("../provider_urls.js");
const { createTimeoutSignal } = require("../fetch_helper.js");

function getWorldBaseUrl() {
  return getProviderUrl("animeworld");
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
  info: 5 * 60 * 1000,
  mapping: 2 * 60 * 1000
};

const caches = {
  http: new Map(),
  mapping: new Map(),
  inflight: new Map()
};

const BLOCKED_DOMAINS = [
  "jujutsukaisenanime.com",
  "onepunchman.it",
  "dragonballhd.it",
  "narutolegend.it"
];

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

function decodeHtmlEntities(raw) {
  const decodedNumeric = String(raw || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const codePoint = Number.parseInt(hex, 16);
      if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return _;
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return _;
      }
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const codePoint = Number.parseInt(dec, 10);
      if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return _;
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return _;
      }
    });

  return decodedNumeric
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
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

function toAbsoluteUrl(href, base = null) {
  if (!href) return null;
  const trimmed = String(href).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  try {
    return new URL(trimmed, base || getWorldBaseUrl()).toString();
  } catch {
    return null;
  }
}

function normalizeAnimeWorldPath(pathOrUrl) {
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
  const match = value.match(/^\/(?:play\/[^/?#]+|anime\/[^/?#]+)/i);
  return match ? match[0] : null;
}

function buildWorldUrl(pathOrUrl) {
  const text = String(pathOrUrl || "").trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith("/")) return `${getWorldBaseUrl()}${text}`;
  return `${getWorldBaseUrl()}/${text}`;
}

function inferSourceTag(title, animePath) {
  const titleText = String(title || "").toLowerCase();
  const pathText = String(animePath || "").toLowerCase();
  if (/(?:^|[^\w])ita(?:[^\w]|$)/i.test(titleText)) return "ITA";
  // AnimeWorld slugs often use `-ita.<id>` format (dot after `ita`).
  if (/(?:^|[-_/])ita(?:[-_/.?]|$)/i.test(pathText)) return "ITA";
  return "SUB";
}

function resolveLanguageEmoji(sourceTag) {
  return String(sourceTag || "").toUpperCase() === "ITA" ? "🇮🇹" : "🇯🇵";
}

function sanitizeAnimeTitle(rawTitle) {
  let text = decodeHtmlEntities(rawTitle).trim();
  if (!text) return null;

  text = text
    .replace(/\s*-\s*AnimeWorld.*$/i, "")
    .replace(/\s*-\s*AnimeUnity.*$/i, "")
    .replace(/\s+Streaming.*$/i, "")
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

function parseTagAttributes(tag) {
  const attrs = {};
  const regex = /([A-Za-z_:][A-Za-z0-9_:\-.]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = regex.exec(String(tag || ""))) !== null) {
    const key = String(match[1] || "").trim().toLowerCase();
    const value = decodeHtmlEntities(match[3] ?? match[4] ?? "").trim();
    if (!key) continue;
    attrs[key] = value;
  }
  return attrs;
}

function parseEpisodeNumber(value, fallbackNum) {
  const text = String(value || "").trim();
  const directInt = parsePositiveInt(text);
  if (directInt) return directInt;
  const floatMatch = text.match(/(\d+(?:[.,]\d+)?)/);
  if (floatMatch) {
    const parsed = Number.parseFloat(floatMatch[1].replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
  }
  return fallbackNum;
}

function normalizePlayableMediaUrl(rawUrl, depth = 0) {
  const absolute = toAbsoluteUrl(rawUrl, getWorldBaseUrl());
  if (!absolute) return null;
  if (/\.(?:mp4|m3u8)(?:[?#].*)?$/i.test(absolute)) return absolute;
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

function normalizeAnimeWorldQuality(value) {
  const text = String(value || "").trim();
  if (!text) return "720p";
  if (/^(?:unknown|unknow|auto)$/i.test(text)) return "720p";
  return text;
}

function collectMediaLinksFromHtml(html) {
  const links = [];
  const seen = new Set();
  const add = (rawUrl) => {
    const normalized = normalizePlayableMediaUrl(rawUrl);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    links.push(normalized);
  };

  const raw = String(html || "");
  const variants = [raw, raw.replace(/\\\//g, "/")];
  for (const text of variants) {
    let match;
    const directRegex = /https?:\/\/[^\s"'<>\\]+(?:\.mp4|\.m3u8)(?:[^\s"'<>\\]*)?/gi;
    while ((match = directRegex.exec(text)) !== null) add(match[0]);
    const encodedRegex = /https%3A%2F%2F[^\s"'<>\\]+/gi;
    while ((match = encodedRegex.exec(text)) !== null) {
      try {
        add(decodeURIComponent(match[0]));
      } catch {
        // ignore malformed encoded URLs
      }
    }
    const sourceRegex = /(?:file|src|url|link)\s*[:=]\s*["']([^"']+)["']/gi;
    while ((match = sourceRegex.exec(text)) !== null) add(match[1]);
  }
  return links;
}

function extractTitleFromHtml(html) {
  const raw = String(html || "");
  const ogTitle = /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i.exec(raw);
  if (ogTitle && ogTitle[1]) return sanitizeAnimeTitle(ogTitle[1]);
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(raw);
  if (titleTag && titleTag[1]) return sanitizeAnimeTitle(titleTag[1]);
  return null;
}

function normalizeEpisodesList(sourceEpisodes = []) {
  if (!Array.isArray(sourceEpisodes) || sourceEpisodes.length === 0) return [];
  const out = [];
  const seen = new Set();

  for (let index = 0; index < sourceEpisodes.length; index += 1) {
    const entry = sourceEpisodes[index] || {};
    const num = parseEpisodeNumber(entry.num, index + 1);
    const episodeId = parsePositiveInt(entry.episodeId ?? entry.id);
    const episodeToken = String(entry.episodeToken || entry.token || "").trim() || null;
    if (!episodeId && !episodeToken) continue;

    const rangeLabel = String(entry.rangeLabel || "").trim() || null;
    const baseLabel = String(entry.baseLabel || "").trim() || null;
    const commentLabel = String(entry.commentLabel || "").trim() || null;

    const token =
      String(
        entry.token ||
        (episodeToken ? `tok:${episodeToken}` : episodeId ? `ep:${episodeId}` : `ep-${num}`)
      ).trim() || `ep-${num}`;

    const key = `${num}|${episodeId || ""}|${episodeToken || ""}|${token}|${rangeLabel || ""}|${baseLabel || ""}|${commentLabel || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      num,
      token,
      episodeId: episodeId || null,
      episodeToken,
      rangeLabel,
      baseLabel,
      commentLabel
    });
  }

  out.sort((a, b) => a.num - b.num);
  return out;
}

function parseEpisodesFromPageHtml(html) {
  const raw = String(html || "");
  const episodes = [];
  const anchorRegex = /<a\b[^>]*(?:data-episode-num=(?:"[^"]*"|'[^']*'))[^>]*(?:data-id=(?:"[^"]*"|'[^']*'))[^>]*>|<a\b[^>]*(?:data-id=(?:"[^"]*"|'[^']*'))[^>]*(?:data-episode-num=(?:"[^"]*"|'[^']*'))[^>]*>/gi;
  const tags = raw.match(anchorRegex) || [];

  for (let index = 0; index < tags.length; index += 1) {
    const attrs = parseTagAttributes(tags[index]);
    const episodeId = parsePositiveInt(attrs["data-episode-id"] || attrs["data-id"]);
    const episodeToken = String(attrs["data-id"] || "").trim() || null;
    if (!episodeId && !episodeToken) continue;
    const num = parseEpisodeNumber(attrs["data-episode-num"], index + 1);
    episodes.push({
      num,
      episodeId,
      episodeToken,
      rangeLabel: attrs["data-num"] || null,
      baseLabel: attrs["data-base"] || null,
      commentLabel: attrs["data-comment"] || null
    });
  }

  return normalizeEpisodesList(episodes);
}

function parseAnimeWorldPage(html, fallback = {}) {
  const title = extractTitleFromHtml(html) || sanitizeAnimeTitle(fallback.title) || null;
  const animePath = normalizeAnimeWorldPath(fallback.animePath || null);
  const episodes = parseEpisodesFromPageHtml(html);
  return {
    title,
    animePath,
    sourceTag: inferSourceTag(title, animePath),
    episodes
  };
}

function pickEpisodeEntry(episodes, requestedEpisode, mediaType = "tv") {
  const list = normalizeEpisodesList(episodes);
  if (list.length === 0) return null;
  if (mediaType === "movie") return list[0];

  const episode = normalizeRequestedEpisode(requestedEpisode);
  const byNum = list.find((entry) => entry.num === episode);
  if (byNum) return byNum;
  const byIndex = list[episode - 1];
  if (byIndex) return byIndex;
  if (episode === 1) return list[0];
  return null;
}

function getEpisodeDisplayLabel(entry, requestedNumber = null) {
  if (!entry) return requestedNumber ? String(requestedNumber) : null;
  const spanSources = [entry.rangeLabel, entry.baseLabel, entry.commentLabel];
  for (const source of spanSources) {
    const text = String(source || "").trim();
    const numeric = parsePositiveInt(text);
    if (numeric) return String(numeric);
    const match = text.match(/\d+(?:\.\d+)?/);
    if (match) return match[0];
  }
  if (parsePositiveInt(entry.num)) return String(entry.num);
  if (requestedNumber) return String(requestedNumber);
  return null;
}

function normalizeHostLabel(rawUrl) {
  try {
    const host = new URL(String(rawUrl || "")).hostname.replace(/^www\./i, "").toLowerCase();
    if (!host) return "";
    if (host.includes("sweetpixel")) return "SweetPixel";
    if (host.includes("stream")) return "Stream";
    const first = host.split(".")[0] || host;
    return first.charAt(0).toUpperCase() + first.slice(1);
  } catch {
    return "";
  }
}

function collectGrabberCandidates(infoData) {
  const urls = [];
  const directKeys = ["grabber", "url", "link", "file", "stream"];
  for (const key of directKeys) {
    const value = infoData?.[key];
    if (typeof value === "string" && value.trim()) urls.push(value.trim());
  }

  const listKeys = ["links", "streams", "servers", "sources"];
  for (const key of listKeys) {
    const value = infoData?.[key];
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (typeof item === "string" && item.trim()) {
        urls.push(item.trim());
        continue;
      }
      if (!item || typeof item !== "object") continue;
      const candidate =
        item.grabber || item.url || item.link || item.file || item.stream || null;
      if (candidate && String(candidate).trim()) {
        urls.push(String(candidate).trim());
      }
    }
  }

  return uniqueStrings(urls);
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

function extractSessionCookie(setCookieHeader) {
  const text = String(setCookieHeader || "");
  const match = text.match(/sessionId=[^;,\s]+/i);
  return match ? match[0] : null;
}

function extractCsrfTokenFromHtml(html) {
  const match = /<meta[^>]*name=["']csrf-token["'][^>]*content=["']([^"']+)["'][^>]*>/i.exec(String(html || ""));
  return match && match[1] ? String(match[1]).trim() : null;
}

async function fetchAnimePageContext(animeUrl, cacheKey) {
  const key = `anime-page-context:${cacheKey}`;
  const cached = getCached(caches.http, key);
  if (cached !== undefined) return cached;

  const response = await fetchWithTimeout(
    animeUrl,
    {
      method: "GET",
      headers: {
        "user-agent": USER_AGENT,
        "accept-language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7"
      },
      redirect: "follow"
    },
    FETCH_TIMEOUT
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} for ${animeUrl}`);
  }

  const html = await response.text();
  const rawSetCookie = response.headers.get("set-cookie") || "";
  const sessionCookie = extractSessionCookie(rawSetCookie);
  const csrfToken = extractCsrfTokenFromHtml(html);
  const context = { html, sessionCookie, csrfToken };
  setCached(caches.http, key, context, TTL.page);
  return context;
}

async function fetchEpisodeInfo(episodeRef, refererUrl, pageContext = null) {
  const token = String(episodeRef || "").trim();
  if (!token) return null;
  const url = `${getWorldBaseUrl()}/api/episode/info?id=${encodeURIComponent(token)}`;
  const csrfToken = String(pageContext?.csrfToken || "").trim();
  const sessionCookie = String(pageContext?.sessionCookie || "").trim();

  const extraHeaders = {};
  if (csrfToken) extraHeaders["csrf-token"] = csrfToken;
  if (sessionCookie) extraHeaders.cookie = sessionCookie;

  try {
    return await fetchResource(url, {
      as: "json",
      ttlMs: TTL.info,
      cacheKey: `episode-info:${token}:${csrfToken ? "csrf" : "nocsrf"}:${sessionCookie ? "cookie" : "nocookie"}`,
      timeoutMs: FETCH_TIMEOUT,
      headers: {
        referer: refererUrl,
        "x-requested-with": "XMLHttpRequest",
        ...extraHeaders
      }
    });
  } catch (error) {
    console.error("[AnimeWorld] episode info request failed:", error.message);
    return null;
  }
}

async function extractStreamsFromAnimePath(animePath, requestedEpisode, mediaType = "tv") {
  const normalizedPath = normalizeAnimeWorldPath(animePath);
  if (!normalizedPath) return [];

  const animeUrl = buildWorldUrl(normalizedPath);
  if (!animeUrl) return [];

  let parsedPage;
  let pageContext;
  try {
    pageContext = await fetchAnimePageContext(animeUrl, `animeworld:${normalizedPath}`);
    parsedPage = parseAnimeWorldPage(pageContext.html, { animePath: normalizedPath });
  } catch (error) {
    console.error("[AnimeWorld] anime page request failed:", error.message);
    return [];
  }

  const normalizedEpisode = normalizeRequestedEpisode(requestedEpisode);
  const selectedEpisode = pickEpisodeEntry(parsedPage.episodes, normalizedEpisode, mediaType);
  if (!selectedEpisode) return [];

  const infoRef = selectedEpisode.episodeToken || selectedEpisode.episodeId;
  const infoData = await fetchEpisodeInfo(infoRef, animeUrl, pageContext);
  if (!infoData || typeof infoData !== "object") return [];

  const grabbers = collectGrabberCandidates(infoData);
  if (grabbers.length === 0) return [];

  const baseTitle = sanitizeAnimeTitle(parsedPage.title) || "Unknown Title";
  const episodeLabel = getEpisodeDisplayLabel(selectedEpisode, normalizedEpisode);
  const displayTitle = episodeLabel ? `${baseTitle} - Ep ${episodeLabel}` : baseTitle;
  const streamLanguage = resolveLanguageEmoji(parsedPage.sourceTag);

  const streams = [];
  const seen = new Set();
  for (const candidate of grabbers) {
    const mediaUrl = normalizePlayableMediaUrl(candidate);
    if (!mediaUrl) continue;
    const lowerLink = mediaUrl.toLowerCase();
    if (
      lowerLink.endsWith(".mkv.mp4") ||
      BLOCKED_DOMAINS.some((domain) => lowerLink.includes(domain))
    ) {
      continue;
    }

    if (seen.has(mediaUrl)) continue;
    seen.add(mediaUrl);

    let quality = extractQualityHint(mediaUrl);
    if (lowerLink.includes(".m3u8")) {
      const detected = await checkQualityFromPlaylist(mediaUrl, {
        "User-Agent": USER_AGENT,
        Referer: animeUrl
      });
      if (detected) quality = detected;
    }

    const hostLabel = normalizeHostLabel(mediaUrl);
    const serverName = hostLabel ? `AnimeWorld - ${hostLabel}` : "AnimeWorld";

    streams.push({
      name: serverName,
      title: displayTitle,
      server: serverName,
      url: mediaUrl,
      language: streamLanguage,
      quality: normalizeAnimeWorldQuality(quality),
      headers: {
        "User-Agent": USER_AGENT,
        Referer: animeUrl
      }
    });
  }

  if (streams.length === 0) {
    const targetUrl = toAbsoluteUrl(infoData.target || null, getWorldBaseUrl());
    if (targetUrl) {
      const extraHeaders = {};
      const csrfToken = String(pageContext?.csrfToken || "").trim();
      const sessionCookie = String(pageContext?.sessionCookie || "").trim();
      if (csrfToken) extraHeaders["csrf-token"] = csrfToken;
      if (sessionCookie) extraHeaders.cookie = sessionCookie;

      try {
        const targetHtml = await fetchResource(targetUrl, {
          ttlMs: TTL.info,
          cacheKey: `server-target:${targetUrl}:${csrfToken ? "csrf" : "nocsrf"}:${sessionCookie ? "cookie" : "nocookie"}`,
          timeoutMs: FETCH_TIMEOUT,
          headers: {
            referer: animeUrl,
            "x-requested-with": "XMLHttpRequest",
            ...extraHeaders
          }
        });
        const targetLinks = collectMediaLinksFromHtml(targetHtml);
        for (const mediaUrl of targetLinks) {
          if (seen.has(mediaUrl)) continue;
          const lowerLink = mediaUrl.toLowerCase();
          if (
            lowerLink.endsWith(".mkv.mp4") ||
            BLOCKED_DOMAINS.some((domain) => lowerLink.includes(domain))
          ) {
            continue;
          }
          seen.add(mediaUrl);
          let quality = extractQualityHint(mediaUrl);
          if (lowerLink.includes(".m3u8")) {
            const detected = await checkQualityFromPlaylist(mediaUrl, {
              "User-Agent": USER_AGENT,
              Referer: animeUrl
            });
            if (detected) quality = detected;
          }
          const hostLabel = normalizeHostLabel(mediaUrl);
          const serverName = hostLabel ? `AnimeWorld - ${hostLabel}` : "AnimeWorld";
          streams.push({
            name: serverName,
            title: displayTitle,
            server: serverName,
            url: mediaUrl,
            language: streamLanguage,
            quality: normalizeAnimeWorldQuality(quality),
            headers: {
              "User-Agent": USER_AGENT,
              Referer: animeUrl
            }
          });
        }
      } catch (error) {
        console.error("[AnimeWorld] target player request failed:", error.message);
      }
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
    console.error("[AnimeWorld] mapping request failed:", error.message);
    return null;
  }
}

function extractAnimeWorldPaths(mappingPayload) {
  if (!mappingPayload || typeof mappingPayload !== "object") return [];
  const raw = mappingPayload?.mappings?.animeworld;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];

  const paths = [];
  for (const item of list) {
    const candidate =
      typeof item === "string"
        ? item
        : item && typeof item === "object"
          ? item.path || item.url || item.href || item.playPath
          : null;
    const normalized = normalizeAnimeWorldPath(candidate);
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
        console.error("[AnimeWorld] task failed:", error.message);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return output;
}

async function getStreams(id, type, season, episode, providerContext = null) {
  try {
    const lookup = resolveLookupRequest(id, season, episode, providerContext);
    if (!lookup) return [];

    let mappingPayload = await fetchMappingPayload(lookup, providerContext);
    let animePaths = extractAnimeWorldPaths(mappingPayload);

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
        const tmdbPaths = extractAnimeWorldPaths(tmdbPayload);
        if (tmdbPaths.length > 0) {
          mappingPayload = tmdbPayload;
          animePaths = tmdbPaths;
        }
      }
    }

    if (animePaths.length === 0) return [];

    const requestedEpisode = resolveEpisodeFromMappingPayload(mappingPayload, lookup.episode);
    const normalizedType = String(type || "").toLowerCase();
    const mediaType = normalizedType === "movie" ? "movie" : "tv";
    const perPathStreams = await mapLimit(animePaths, 3, (path) =>
      extractStreamsFromAnimePath(path, requestedEpisode, mediaType)
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
      .map((stream) => formatStream(stream, "AnimeWorld"))
      .filter(Boolean);
  } catch (error) {
    console.error("[AnimeWorld] getStreams failed:", error.message);
    return [];
  }
}

module.exports = { getStreams };
