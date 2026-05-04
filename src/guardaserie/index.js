var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
function getGuardaserieBaseUrl() {
  return "https://guardaserietv.hair";
}
const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
function getMappingApiUrl() {
  return "https://animemapping.realbestia.com";
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
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

const { extractMixDrop, extractDropLoad, extractSuperVideo, extractUqload, extractUpstream } = require('../extractors');
require('../fetch_helper.js');
const { checkQualityFromPlaylist } = require('../quality_helper.js');
const { formatStream } = require('../formatter.js');
const { smartFetch } = require('../utils/cf_handler');
const STEP_BENCH_ENABLED = String(process.env.PROVIDER_STEP_BENCH || "").trim().toLowerCase() === "1";

function getQualityFromName(qualityStr) {
  if (!qualityStr) return 'Unknown';
  const quality = qualityStr.toUpperCase();
  if (quality === 'ORG' || quality === 'ORIGINAL') return 'Original';
  if (quality === '4K' || quality === '2160P') return '4K';
  if (quality === '1440P' || quality === '2K') return '1440p';
  if (quality === '1080P' || quality === 'FHD') return '1080p';
  if (quality === '720P' || quality === 'HD') return '720p';
  if (quality === '480P' || quality === 'SD') return '480p';
  if (quality === '360P') return '360p';
  if (quality === '240P') return '240p';
  const match = qualityStr.match(/(\d{3,4})[pP]?/);
  if (match) {
    const resolution = parseInt(match[1]);
    if (resolution >= 2160) return '4K';
    if (resolution >= 1440) return '1440p';
    if (resolution >= 1080) return '1080p';
    if (resolution >= 720) return '720p';
    if (resolution >= 480) return '480p';
    if (resolution >= 360) return '360p';
    return '240p';
  }
  return 'Unknown';
}

function getImdbId(tmdbId, type) {
  return __async(this, null, function* () {
    try {
      const endpoint = type === "movie" ? "movie" : "tv";
      const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
      const response = yield fetch(url);
      if (!response.ok) return null;
      const data = yield response.json();
      if (data.imdb_id) return data.imdb_id;
      const externalUrl = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
      const extResponse = yield fetch(externalUrl);
      if (extResponse.ok) {
        const extData = yield extResponse.json();
        if (extData.imdb_id) return extData.imdb_id;
      }
      return null;
    } catch (e) {
      console.error("[Guardaserie] Conversion error:", e);
      return null;
    }
  });
}
function getShowInfo(tmdbId, type) {
  return __async(this, null, function* () {
    try {
      const endpoint = type === "movie" ? "movie" : "tv";
      const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=it-IT`;
      const response = yield fetch(url);
      if (!response.ok) return null;
      return yield response.json();
    } catch (e) {
      console.error("[Guardaserie] TMDB error:", e);
      return null;
    }
  });
}

function getTmdbIdFromImdb(imdbId, type) {
  return __async(this, null, function* () {
    var _a, _b;
    try {
      const url = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
      const response = yield fetch(url);
      if (!response.ok) return null;
      const data = yield response.json();
      if (type === "movie" && ((_a = data.movie_results) == null ? void 0 : _a.length) > 0) return data.movie_results[0].id;
      if (type === "tv") {
        if (((_b = data.tv_results) == null ? void 0 : _b.length) > 0) return data.tv_results[0].id;
        if (data.tv_episode_results && data.tv_episode_results.length > 0) return data.tv_episode_results[0].show_id;
        if (data.tv_season_results && data.tv_season_results.length > 0) return data.tv_season_results[0].show_id;
      }
      return null;
    } catch (e) {
      console.error("[Guardaserie] ID conversion error:", e);
      return null;
    }
  });
}

function getIdsFromKitsu(kitsuId, season, episode, providerContext = null) {
  return __async(this, null, function* () {
    try {
      if (!kitsuId) return null;
      const params = new URLSearchParams();
      const parsedEpisode = parseInt(String(episode || ""), 10);
      const parsedSeason = parseInt(String(season || ""), 10);
      params.set("ep", Number.isInteger(parsedEpisode) && parsedEpisode > 0 ? String(parsedEpisode) : "1");
      if (Number.isInteger(parsedSeason) && parsedSeason >= 0) params.set("s", String(parsedSeason));
      params.set("lang", "it");
      const url = `${getMappingApiUrl()}/kitsu/${encodeURIComponent(String(kitsuId).trim())}?${params.toString()}`;
      const response = yield fetch(url);
      if (!response.ok) return null;
      const payload = yield response.json();
      const ids = payload && payload.mappings && payload.mappings.ids ? payload.mappings.ids : {};
      const tmdbEpisode = (payload && payload.mappings && (payload.mappings.tmdb_episode || payload.mappings.tmdbEpisode)) || (payload && (payload.tmdb_episode || payload.tmdbEpisode)) || null;
      const tmdbId = ids && /^\d+$/.test(String(ids.tmdb || "").trim()) ? String(ids.tmdb).trim() : null;
      const imdbId = ids && /^tt\d+$/i.test(String(ids.imdb || "").trim()) ? String(ids.imdb).trim() : null;
      const mappedSeason = parseInt(String(tmdbEpisode && (tmdbEpisode.season || tmdbEpisode.seasonNumber || tmdbEpisode.season_number) || ""), 10);
      const mappedEpisode = parseInt(String(tmdbEpisode && (tmdbEpisode.episode || tmdbEpisode.episodeNumber || tmdbEpisode.episode_number) || ""), 10);
      const rawEpisodeNumber = parseInt(String(tmdbEpisode && (tmdbEpisode.rawEpisodeNumber || tmdbEpisode.raw_episode_number || tmdbEpisode.rawEpisode) || ""), 10);
      return {
        tmdbId,
        imdbId,
        mappedSeason: Number.isInteger(mappedSeason) && mappedSeason > 0 ? mappedSeason : null,
        mappedEpisode: Number.isInteger(mappedEpisode) && mappedEpisode > 0 ? mappedEpisode : null,
        rawEpisodeNumber: Number.isInteger(rawEpisodeNumber) && rawEpisodeNumber > 0 ? rawEpisodeNumber : null
      };
    } catch (e) {
      console.error("[Guardaserie] Kitsu mapping error:", e);
      return null;
    }
  });
}

function verifyMoviePlayer(url, targetYear) {
  return __async(this, null, function* () {
    try {
      const response = yield fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (!response.ok) return false;
      const html = yield response.text();
      const yearMatch1 = html.match(/trasmessa dal (\d{4})/i);
      if (yearMatch1 && Math.abs(parseInt(yearMatch1[1]) - targetYear) <= 1) return true;
      const yearMatch2 = html.match(/Prima messa in onda originale.*?(\d{4})/i);
      if (yearMatch2 && Math.abs(parseInt(yearMatch2[1]) - targetYear) <= 1) return true;
      const titleMatch = html.match(/<title>.*\(.*(\d{4}).*\).*<\/title>/is);
      if (titleMatch && Math.abs(parseInt(titleMatch[1]) - targetYear) <= 2) return true;
      return false;
    } catch (e) {
      console.error("[Guardaserie] MoviePlayer error:", e);
      return false;
    }
  });
}

function getStreams(id, type, season, episode, providerContext = null) {
  if (String(type).toLowerCase() === "movie") return [];
  return __async(this, null, function* () {
    const benchStart = Date.now();
    const bench = [];
    const mark = (step, meta = {}) => {
      if (!STEP_BENCH_ENABLED) return;
      bench.push({ step, t: Date.now() - benchStart, ...meta });
    };
    try {
      let tmdbId = id;
      let imdbId = null;
      let effectiveSeason = parseInt(String(season || ""), 10) || 1;
      let effectiveEpisode = parseInt(String(episode || ""), 10) || 1;
      const contextTmdbId = providerContext && /^\d+$/.test(String(providerContext.tmdbId || "")) ? String(providerContext.tmdbId) : null;
      const contextImdbId = providerContext && /^tt\d+$/i.test(String(providerContext.imdbId || "")) ? String(providerContext.imdbId) : null;
      const contextKitsuId = providerContext && /^\d+$/.test(String(providerContext.kitsuId || "")) ? String(providerContext.kitsuId) : null;

      if (id.toString().startsWith("kitsu:") || contextKitsuId) {
        const kitsuId = contextKitsuId || id.toString().split(":")[1];
        const mapped = yield getIdsFromKitsu(kitsuId, season, episode, providerContext);
        mark("kitsu_mapping_done", { ok: Boolean(mapped && mapped.tmdbId) });
        if (mapped) {
          if (mapped.tmdbId) tmdbId = mapped.tmdbId;
          if (mapped.imdbId) imdbId = mapped.imdbId;
          if (mapped.mappedSeason && mapped.mappedEpisode) {
            effectiveSeason = mapped.mappedSeason;
            effectiveEpisode = mapped.mappedEpisode;
          } else if (mapped.rawEpisodeNumber) {
            effectiveEpisode = mapped.rawEpisodeNumber;
          }
        }
      } else if (id.toString().startsWith("tt")) {
        imdbId = id.toString();
        tmdbId = contextTmdbId || tmdbId;
        mark("imdb_to_tmdb_done", { ok: true });
      } else if (id.toString().startsWith("tmdb:")) {
        tmdbId = id.toString().replace("tmdb:", "");
      }

      if (!imdbId && tmdbId) imdbId = contextImdbId || (yield getImdbId(tmdbId, type));
      mark("imdb_resolve_done", { ok: Boolean(imdbId) });
      if (!imdbId) return [];

      let showUrl = null, showHtml = null;
      let matchedTitle = imdbId;
      if (imdbId) {
        const searchUrl = `${getGuardaserieBaseUrl()}/index.php?do=search&subaction=search&story=${imdbId}`;
        const searchHtml = yield smartFetch(searchUrl, getGuardaserieBaseUrl(), { 
          headers: { "Referer": getGuardaserieBaseUrl() } 
        });
        if (searchHtml) {
          const match = /<div class="mlnh-2">\s*<h2>\s*<a href="([^"]+)" title="([^"]+)">/i.exec(searchHtml);
          if (match && !match[2].toUpperCase().includes("[SUB ITA]")) {
            showUrl = match[1].startsWith('/') ? `${getGuardaserieBaseUrl()}${match[1]}` : match[1];
            matchedTitle = match[2] || imdbId;
            const pageHtml = yield smartFetch(showUrl, getGuardaserieBaseUrl(), { 
              headers: { "Referer": getGuardaserieBaseUrl() } 
            });
            if (pageHtml) showHtml = pageHtml;
          }
        }
        mark("search_by_imdb_done", { ok: Boolean(showUrl) });
      }

      if (!showUrl || !showHtml) return [];
      const episodeStr = `${effectiveSeason}x${effectiveEpisode}`;
      const episodeMatch = (new RegExp(`data-num="${episodeStr}"`, "i")).exec(showHtml) || (new RegExp(`data-num="${effectiveSeason}x${effectiveEpisode.toString().padStart(2, '0')}"`, "i")).exec(showHtml);
      if (!episodeMatch) return [];
      mark("episode_match_done", { ok: Boolean(episodeMatch) });

      const searchFromIndex = episodeMatch.index;
      const mirrorsStartIndex = showHtml.indexOf('<div class="mirrors">', searchFromIndex);
      if (mirrorsStartIndex === -1) return [];
      const mirrorsEndIndex = showHtml.indexOf("</div>", mirrorsStartIndex);
      const mirrorsHtml = showHtml.substring(mirrorsStartIndex, mirrorsEndIndex);
      
      const linksSet = new Set();
      const linkRegex = /data-link="([^"]+)"/g;
      let linkMatch;
      while ((linkMatch = linkRegex.exec(mirrorsHtml)) !== null) linksSet.add(linkMatch[1]);
      
      const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
      let ifm;
      while ((ifm = iframeRegex.exec(showHtml.substring(mirrorsStartIndex, Math.min(showHtml.length, mirrorsEndIndex + 2000)))) !== null) linksSet.add(ifm[1]);

      const links = Array.from(linksSet);
      mark("links_extracted", { links: links.length });
      const displayName = `${matchedTitle} ${effectiveSeason}x${effectiveEpisode}`;
      const streamPromises = links.map((link) => __async(null, null, function* () {
        try {
          if (link.includes("dropload") || link.includes("dr0pstream")) {
            console.log(`[Guardaserie] DropLoad temporarily disabled: ${link}`);
            return null;
          } else if (link.includes("supervideo")) {
            console.log(`[Guardaserie] SuperVideo temporarily disabled: ${link}`);
            return null;
          } else if (link.includes("mixdrop")) {
            const ext = yield extractMixDrop(link);
            if (ext && ext.url) return { url: ext.url, easyProxySourceUrl: link, headers: ext.headers, name: "Guardaserie - MixDrop", title: displayName, quality: getQualityFromName("HD"), type: "direct" };
          }
        } catch (e) { console.error(`[Guardaserie] Extraction error for ${link}:`, e); }
        return null;
      }));
      const results = yield Promise.all(streamPromises);
      const finalStreams = results.filter(r => r !== null).map(s => formatStream(s, "Guardaserie")).filter(s => s !== null);
      mark("extractors_done", { streams: finalStreams.length });
      if (STEP_BENCH_ENABLED) {
        console.log(`[GuardaserieBench] ${JSON.stringify({ id: String(id), type: String(type), totalMs: Date.now() - benchStart, steps: bench })}`);
      }
      return finalStreams;
    } catch (e) {
      if (STEP_BENCH_ENABLED) {
        console.log(`[GuardaserieBench] ${JSON.stringify({ id: String(id), type: String(type), totalMs: Date.now() - benchStart, failed: true, steps: bench, error: e && e.message ? e.message : String(e) })}`);
      }
      console.error("[Guardaserie] Error:", e);
      return [];
    }
  });
}
module.exports = { getStreams };
