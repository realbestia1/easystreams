const IS_SERVER = typeof process !== 'undefined' && process.versions && process.versions.node;

if (!IS_SERVER) {
  module.exports = {
    getStreams: async (id, type, season, episode) => {
      console.warn('[VidxGo-Client] Disabled: VidXGo requires EasyProxy stream proxy.');
      return [];
    }
  };
} else {
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => { try { step(generator.next(value)); } catch (e) { reject(e); } };
      var rejected = (value) => { try { step(generator.throw(value)); } catch (e) { reject(e); } };
      var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };
  const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
  function getMappingApiUrl() { return "https://animemapping.realbestia.com"; }
  function normalizeConfigBoolean(value) { if (value === true) return true; const normalized = String(value || "").trim().toLowerCase(); return ["1", "true", "yes", "on", "enabled", "checked"].includes(normalized); }
  function getMappingLanguage(providerContext = null) { const explicit = String(providerContext?.mappingLanguage || "").trim().toLowerCase(); if (explicit === "it") return "it"; return normalizeConfigBoolean(providerContext?.easyCatalogsLangIt) ? "it" : null; }
  const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

  const { extractVidxGo } = require('../extractors/vidxgo');
  require('../fetch_helper.js');
  const { checkQualityFromPlaylist, checkItalianAudioInPlaylist } = require('../quality_helper.js');
  const { formatStream } = require('../formatter.js');
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
        console.error("[VidxGo] Conversion error:", e);
        return null;
      }
    });
  }

  function getTitleFromIds(imdbId, tmdbId, type) {
    return __async(this, null, function* () {
      try {
        const normalizedType = String(type || "").toLowerCase();
        const endpoint = normalizedType === "movie" ? "movie" : "tv";

        if (/^\d+$/.test(String(tmdbId || ""))) {
          const response = yield fetch(`https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=it-IT`);
          if (response.ok) {
            const data = yield response.json();
            return data.title || data.name || data.original_title || data.original_name || null;
          }
        }

        if (/^tt\d+$/i.test(String(imdbId || ""))) {
          const response = yield fetch(`https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id&language=it-IT`);
          if (!response.ok) return null;
          const data = yield response.json();
          const results = endpoint === "movie" ? data.movie_results : data.tv_results;
          const fallback = endpoint === "movie" ? data.tv_results : data.movie_results;
          const item = (Array.isArray(results) && results[0]) || (Array.isArray(fallback) && fallback[0]) || null;
          return item && (item.title || item.name || item.original_title || item.original_name) || null;
        }
      } catch (e) {
        return null;
      }
      return null;
    });
  }

  function getIdsFromMapping(provider, externalId, season, episode, lang = null) {
    return __async(this, null, function* () {
      try {
        if (!externalId) return null;
        const params = new URLSearchParams();
        const parsedEpisode = parseInt(String(episode || ""), 10);
        const parsedSeason = parseInt(String(season || ""), 10);
        params.set("ep", Number.isInteger(parsedEpisode) && parsedEpisode > 0 ? String(parsedEpisode) : "1");
        if (Number.isInteger(parsedSeason) && parsedSeason >= 0) params.set("s", String(parsedSeason));
        if (lang) params.set("lang", lang);
        const url = `${getMappingApiUrl()}/${provider}/${encodeURIComponent(String(externalId).trim())}?${params.toString()}`;
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
        console.error("[VidxGo] mapping error:", e);
        return null;
      }
    });
  }

  function getStreams(id, type, season, episode, providerContext = null) {
    
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
        const mappingLang = getMappingLanguage(providerContext);

        if (id.toString().startsWith("kitsu:") || contextKitsuId) {
          const kitsuId = contextKitsuId || id.toString().split(":")[1];
          const mapped = yield getIdsFromMapping("kitsu", kitsuId, season, episode, mappingLang);
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
          const mapped = yield getIdsFromMapping("imdb", imdbId, season, episode, mappingLang);
          if (mapped && mapped.tmdbId) tmdbId = mapped.tmdbId;
          if (mapped && mapped.mappedSeason && mapped.mappedEpisode) {
            effectiveSeason = mapped.mappedSeason;
            effectiveEpisode = mapped.mappedEpisode;
          } else if (mapped && mapped.rawEpisodeNumber) {
            effectiveEpisode = mapped.rawEpisodeNumber;
          }
          mark("imdb_mapping_done", { ok: true });
        } else if (id.toString().startsWith("tmdb:")) {
          tmdbId = id.toString().replace("tmdb:", "");
        }

        if (!imdbId && tmdbId) {
          const mapped = yield getIdsFromMapping("tmdb", tmdbId, season, episode, mappingLang);
          if (mapped && mapped.imdbId) imdbId = mapped.imdbId;
          if (mapped && mapped.mappedSeason && mapped.mappedEpisode) {
            effectiveSeason = mapped.mappedSeason;
            effectiveEpisode = mapped.mappedEpisode;
          } else if (mapped && mapped.rawEpisodeNumber) {
            effectiveEpisode = mapped.rawEpisodeNumber;
          }
          mark("tmdb_mapping_done", { ok: Boolean(imdbId) });
        }
        if (!imdbId && tmdbId) imdbId = contextImdbId || (yield getImdbId(tmdbId, type));
        mark("imdb_resolve_done", { ok: Boolean(imdbId) });
        if (!imdbId) return [];

        const isMovie = String(type).toLowerCase() === "movie";
        const contentTitle = (yield getTitleFromIds(imdbId, tmdbId, type)) || (isMovie ? "Film" : "Serie");
        const displayName = isMovie ? contentTitle : `${contentTitle} ${effectiveSeason}x${effectiveEpisode}`;
        const streams = [];

        const vidxgoUrl = isMovie
          ? `https://v.vidxgo.co/${imdbId}`
          : `https://v.vidxgo.co/${imdbId}/${effectiveSeason}/${effectiveEpisode}`;

        const shouldUseEasyProxy = Boolean(providerContext && providerContext.proxyUrl);
        let vidxgoStream = null;

        // Corrupt check: always try full extraction first.
        // If corrupt, extractVidxGo returns null -> return [] immediately.
        // If valid and EasyProxy active, discard extracted result (EasyProxy will re-extract).
        const extracted = yield extractVidxGo(vidxgoUrl, 'https://altadefinizione.you/');
        if (!extracted) {
          return [];
        }

        if (shouldUseEasyProxy) {
          vidxgoStream = {
            url: vidxgoUrl,
            easyProxySourceUrl: vidxgoUrl,
            headers: null
          };
        } else {
          vidxgoStream = extracted;
        }

        if (vidxgoStream && vidxgoStream.url) {
          let quality = "HD";
          let hasItalian = false;
          if (!shouldUseEasyProxy) {
            const detectedQuality = yield checkQualityFromPlaylist(vidxgoStream.url, vidxgoStream.headers);
            if (detectedQuality) quality = detectedQuality;
            hasItalian = yield checkItalianAudioInPlaylist(vidxgoStream.url, vidxgoStream.headers);
          }
          streams.push({
            url: vidxgoStream.url,
            easyProxySourceUrl: vidxgoUrl,
            headers: vidxgoStream.headers,
            name: "VidxGo",
            title: displayName,
            quality: getQualityFromName(quality),
            type: "direct",
            language: hasItalian ? 'Italian' : ''
          });
        }
        mark("vidxgo_extracted", { ok: Boolean(vidxgoStream && vidxgoStream.url) });

        const finalStreams = streams.map(s => formatStream(s, "VidxGo")).filter(s => s !== null);
        mark("extractors_done", { streams: finalStreams.length });
        if (STEP_BENCH_ENABLED) {
          console.log(`[VidxGoBench] ${JSON.stringify({ id: String(id), type: String(type), totalMs: Date.now() - benchStart, steps: bench })}`);
        }
        return finalStreams;
      } catch (e) {
        if (STEP_BENCH_ENABLED) {
          console.log(`[VidxGoBench] ${JSON.stringify({ id: String(id), type: String(type), totalMs: Date.now() - benchStart, failed: true, steps: bench, error: e && e.message ? e.message : String(e) })}`);
        }
        console.error("[VidxGo] Error:", e);
        return [];
      }
    });
  }
  module.exports = { getStreams };
}
