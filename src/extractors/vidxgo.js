const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { USER_AGENT } = require('./common');

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

async function extractVidxGo(url, referer = null) {
  try {
    if (url.startsWith("//")) url = "https:" + url;

    const streamUrl = await bypassAndExtract(url, referer);
    if (streamUrl) {
      console.log("[VidxGo] Real stream URL extracted:", streamUrl);
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
