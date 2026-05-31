/**
 * HTTP Utilities
 * Use this file for network requests and headers.
 */

export const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
export const LANGUAGE_SETTINGS= "language=italian"; // Filters results
export const TORRENTIO_API = "https://torrentio.strem.fun/"+ LANGUAGE_SETTINGS;

export const TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://exodus.desync.com:6969/announce"
];

export const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  "Accept": "application/json, text/plain, */*"
};