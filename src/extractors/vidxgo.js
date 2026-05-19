const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { USER_AGENT } = require('./common');

const VIDXGO_HEARTBEAT_URL = 'https://v.vidxgo.co/hb';
const VIDXGO_HEARTBEAT_INTERVAL_MS = 60000;
const VIDXGO_HEARTBEAT_TTL_MS = 4 * 60 * 60 * 1000;
const VIDXGO_DEFAULT_DURATION_SEC = 4 * 60 * 60;
const vidxgoHeartbeats = new Map();

function getPythonExe() {
  const venvPython = path.join(process.cwd(), '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  if (fs.existsSync(venvPython)) return venvPython;
  if (process.platform === 'win32') return 'python';
  return 'python3';
}

async function bypassAndExtract(url, referer = null) {
  const scriptPath = path.join(__dirname, '..', 'utils', 'vidxgo_bypass.py');
  const pythonExe = getPythonExe();
  const args = [
    scriptPath,
    url,
    '--referer', referer || 'https://altadefinizione.you/'
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(pythonExe, args);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (code) => {
      if (code !== 0) console.error("[VidxGo] Python script exited with code", code, "stderr:", stderr);
      if (stdout.trim()) {
        try {
          const result = JSON.parse(stdout);
          if (result.status === 'ok' && result.stream_url) {
            resolve(result.stream_url);
            return;
          }
          console.warn("[VidxGo] Python script returned error:", result.error || "unknown");
          resolve(null);
        } catch (e) {
          console.warn("[VidxGo] Failed to parse Python output:", stdout.substring(0, 200));
          resolve(null);
        }
      } else {
        console.warn("[VidxGo] Python script returned empty stdout, stderr:", stderr);
        resolve(null);
      }
    });

    child.on('error', () => resolve(null));
  });
}

function parseVidxGoPageUrl(url) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const imdb = String(parts[0] || '').replace(/^tt/i, '').trim();
    if (!/^\d+$/.test(imdb)) return null;

    const season = Number.parseInt(parts[1], 10);
    const episode = Number.parseInt(parts[2], 10);
    const isEpisode = Number.isInteger(season) && season > 0 && Number.isInteger(episode) && episode > 0;

    return {
      imdb,
      type: isEpisode ? 'episode' : 'movie',
      season: isEpisode ? season : null,
      episode: isEpisode ? episode : null
    };
  } catch {
    return null;
  }
}

function createHeartbeatId() {
  if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildHeartbeatHeaders(pageUrl) {
  return {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Content-Type': 'application/json',
    'Origin': 'https://v.vidxgo.co',
    'Referer': pageUrl,
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'DNT': '1'
  };
}

async function sendVidxGoHeartbeat(state) {
  if (typeof fetch !== 'function') return true;

  const elapsedSec = Math.max(1, Math.floor((Date.now() - state.startedAt) / 1000));
  const payload = {
    sid: state.sid,
    imdb: state.meta.imdb,
    type: state.meta.type,
    pos: Math.min(elapsedSec, VIDXGO_DEFAULT_DURATION_SEC - 1),
    dur: VIDXGO_DEFAULT_DURATION_SEC,
    playing: 1,
    ref: state.referer,
    dm: 'Stremio'
  };

  if (state.meta.type === 'episode') {
    payload.s = state.meta.season;
    payload.e = state.meta.episode;
  }

  const response = await fetch(VIDXGO_HEARTBEAT_URL, {
    method: 'POST',
    headers: buildHeartbeatHeaders(state.pageUrl),
    body: JSON.stringify(payload)
  });

  if (response.status === 410) return false;
  const text = await response.text().catch(() => '');
  if (!response.ok) {
    console.warn(`[VidxGo] Heartbeat HTTP ${response.status}: ${text.slice(0, 120)}`);
    return true;
  }

  try {
    const data = JSON.parse(text);
    return !(data && data.kicked);
  } catch {
    return true;
  }
}

function stopVidxGoHeartbeat(key) {
  const state = vidxgoHeartbeats.get(key);
  if (!state) return;
  if (state.timer) clearInterval(state.timer);
  vidxgoHeartbeats.delete(key);
}

function startVidxGoHeartbeat(pageUrl, referer = null) {
  const meta = parseVidxGoPageUrl(pageUrl);
  if (!meta) return;

  const heartbeatReferer = referer || 'https://altadefinizione.you/';
  const key = `${meta.imdb}:${meta.season || 0}:${meta.episode || 0}:${heartbeatReferer}`;
  const now = Date.now();
  const existing = vidxgoHeartbeats.get(key);
  if (existing) {
    existing.expiresAt = now + VIDXGO_HEARTBEAT_TTL_MS;
    return;
  }

  const state = {
    sid: createHeartbeatId(),
    pageUrl,
    referer: heartbeatReferer,
    meta,
    startedAt: now,
    expiresAt: now + VIDXGO_HEARTBEAT_TTL_MS,
    timer: null
  };

  const tick = async () => {
    if (Date.now() >= state.expiresAt) {
      stopVidxGoHeartbeat(key);
      return;
    }

    try {
      const shouldContinue = await sendVidxGoHeartbeat(state);
      if (!shouldContinue) stopVidxGoHeartbeat(key);
    } catch (error) {
      console.warn('[VidxGo] Heartbeat error:', error.message || error);
    }
  };

  state.timer = setInterval(tick, VIDXGO_HEARTBEAT_INTERVAL_MS);
  if (typeof state.timer.unref === 'function') state.timer.unref();
  vidxgoHeartbeats.set(key, state);
  tick();
}

async function extractVidxGo(url, referer = null) {
  try {
    if (url.startsWith("//")) url = "https:" + url;

    const streamUrl = await bypassAndExtract(url, referer);
    if (streamUrl) {
      console.log("[VidxGo] Real stream URL extracted:", streamUrl);
      startVidxGoHeartbeat(url, referer);
      const vidxgoOrigin = new URL(url).origin;
      return {
        url: streamUrl,
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0",
          "Referer": url,
          "Origin": vidxgoOrigin,
          "Accept": "*/*",
          "Accept-Language": "en-US,en;q=0.9",
          "Sec-GPC": "1",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "cross-site",
          "DNT": "1",
          "Priority": "u=0"
        }
      };
    }

    return { url, headers: { "User-Agent": USER_AGENT, "Referer": referer || url } };
  } catch (e) {
    console.error("[VidxGo] Extraction error:", e);
    return null;
  }
}
module.exports = { extractVidxGo };
