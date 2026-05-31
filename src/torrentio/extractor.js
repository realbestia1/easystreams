/**
 * Extractor Logic
 * This file handles parsing HTML/JSON to find video streams.
 */

import { HEADERS , TMDB_API_KEY, TORRENTIO_API, TRACKERS} from './http.js';
import {formatStream} from '../formatter.js';

export async function extractStreams(tmdbId, mediaType, season, episode) {
    try {
        const imdbId = await getImdbId(tmdbId, mediaType);
        if (!imdbId) {
            console.log("[TorrentIO-ITA] IMDB ID not found");
            return [];
        }
        const isTv = season != null && episode != null;
        const url = isTv
        ? TORRENTIO_API + "/stream/series/" + imdbId + ":" + season + ":" + episode + ".json"
        : TORRENTIO_API + "/stream/movie/" + imdbId + ".json";

        console.log("[TorrentIO-ITA] Fetching:", url);
        const response = await fetch(url, { headers: HEADERS });
        const body = await response.json();

        if (!body || !body.streams) {
            console.log("[TorrentIO-ITA] No streams");
            return [];
        }

        const results = [];
        for (const stream of body.streams.slice(0, 15)) {
          try {
            const title      = stream.title || "";
            const titleLower = title.toLowerCase();
            const quality = extractQuality(title);
            const seeders = (title.match(/👤\s*(\d+)/) ?? [])[1] || "?";
            const magnet  = buildMagnet(stream.infoHash);
            if (!magnet) continue;
            if (!stream.title.toLowerCase().includes('ita')) continue; // Filter non-Italian streams
            // const formattedStream = streamFormat(stream);
            let formattedStream = formatStream(stream, "TorrentIO Plugin");
            formattedStream = {
                ...formattedStream,
                url: magnet,
                infoHash:stream.infoHash,
                behaviorHints: stream.behaviorHints || {},  
                isInstalledAddonStream:true,  // Should trigger local debrid resolution in Nuvio
                needsLocalDebridResolve:true, // Should trigger local debrid resolution in Nuvio
              };
            results.push(formattedStream);
            // results.push({
            //   url:       magnet,
            //   quality:   quality,
            //   title:     "IT " + quality + " | 👤 " + seeders,
            //   subtitles: []
            // });
          } catch (e) { console.log('errore',e) }
        }
        
        return results;
      } catch (e){
          console.error("[TORRENTIO] Error extracting streams:", e);
          return [];
      }
    }

function streamFormat(stream){
  const name = stream.name|| "TorrentIO Stream";
  const title      = stream.name || "";
  const infoHash   = stream.infoHash || "";
  const description= stream.title
  const behaviorHints = stream.behaviorHints || {};
  const url = buildMagnet(infoHash);
  return {
    name,
    title,
    description,
    url,
    infoHash,
    addonName:"TorrentIO Plugin",
    isInstalledAddonStream:true,  // Should trigger local debrid resolution in Nuvio
    needsLocalDebridResolve:true, // Should trigger local debrid resolution in Nuvio
    behaviorHints
  }
}

function buildMagnet(infoHash) {
  if (!infoHash) return "";
  const trackerParams = TRACKERS
    .map(t => "&tr=" + encodeURIComponent(t))
    .join("");
  return "magnet:?xt=urn:btih:" + infoHash + trackerParams;
}

function extractQuality(title = "") {
  const t = title.toLowerCase();
  if (t.includes("2160p") || t.includes("4k")) return "4K";
  if (t.includes("1080p")) return "1080p";
  if (t.includes("720p"))  return "720p";
  if (t.includes("480p"))  return "480p";
  return "Unknown";
}

export async function getImdbId(tmdbId, mediaType) {
    try {
        const normalizedType = mediaType.toLowerCase() === "tv" ? "tv" : "movie";
        const findUrl = `https://api.themoviedb.org/3/${normalizedType}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
        const response = await fetch(findUrl);
        // const response = await fetch(findUrl,{headers: {"Authorization": `Bearer ${TMDB_API_KEY}`}});
        console.log(response);
        if (!response.ok) return null;
        const data = await response.json();
        console.log(data);
        if (!data) return null;
        return data.imdb_id || null;
    } catch (e) {
        console.error("[TORRENTIO] Error fetching IMDB ID:", e);    
    }

}