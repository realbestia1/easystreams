const { spawn } = require('child_process');

const DEFAULT_CASES = [
  { type: 'movie', id: 'tt0816692' },
  { type: 'movie', id: 'tt0111161' },
  { type: 'series', id: 'tt0944947:1:1' },
  { type: 'series', id: 'tt0903747:1:1' },
  { type: 'anime', id: 'kitsu:1:1:1' }
];

function parseArgs(argv) {
  const args = {
    baseUrl: 'http://127.0.0.1:7000',
    runs: 2,
    timeoutMs: 20000,
    startAddon: true,
    keepAddonAlive: false
  };

  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--base-url' && argv[i + 1]) args.baseUrl = argv[++i];
    else if (token === '--runs' && argv[i + 1]) args.runs = Math.max(1, Number.parseInt(argv[++i], 10) || 1);
    else if (token === '--timeout' && argv[i + 1]) args.timeoutMs = Math.max(2000, Number.parseInt(argv[++i], 10) || 20000);
    else if (token === '--no-start-addon') args.startAddon = false;
    else if (token === '--keep-addon-alive') args.keepAddonAlive = true;
  }

  return args;
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function formatMs(value) {
  return `${value.toFixed(1)}ms`;
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function waitForAddonReady(proc, timeoutMs) {
  return new Promise((resolve, reject) => {
    let ready = false;
    const timer = setTimeout(() => {
      if (!ready) reject(new Error('Timeout waiting addon startup log'));
    }, timeoutMs);

    proc.stdout.on('data', (chunk) => {
      const text = String(chunk || '');
      process.stdout.write(text);
      if (text.includes('Stremio Addon running at')) {
        ready = true;
        clearTimeout(timer);
        resolve();
      }
    });

    proc.stderr.on('data', (chunk) => {
      process.stderr.write(String(chunk || ''));
    });

    proc.on('exit', (code) => {
      if (!ready) {
        clearTimeout(timer);
        reject(new Error(`Addon process exited before startup (code ${code})`));
      }
    });
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const providerStats = new Map();
  let addonProc = null;

  if (args.startAddon) {
    addonProc = spawn('node', ['stremio_addon.js'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PROVIDER_BENCHMARK_LOGS: '1'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    addonProc.stdout.on('data', (chunk) => {
      const text = String(chunk || '');
      const lines = text.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        if (!line.startsWith('[ProviderBench] ')) continue;
        const jsonText = line.slice('[ProviderBench] '.length);
        try {
          const payload = JSON.parse(jsonText);
          if (payload.kind !== 'provider' || !payload.provider) continue;
          if (!providerStats.has(payload.provider)) {
            providerStats.set(payload.provider, { durations: [], timeouts: 0, errors: 0, requests: 0 });
          }
          const row = providerStats.get(payload.provider);
          row.requests += 1;
          row.durations.push(Number(payload.elapsedMs) || 0);
          if (payload.status === 'timeout') row.timeouts += 1;
          if (payload.status === 'error') row.errors += 1;
        } catch {
          // ignore parse errors from partial lines
        }
      }
    });

    await waitForAddonReady(addonProc, args.timeoutMs);
  }

  const queue = [];
  for (let run = 1; run <= args.runs; run++) {
    for (const testCase of DEFAULT_CASES) {
      queue.push({ ...testCase, run });
    }
  }

  for (const item of queue) {
    const url = `${args.baseUrl}/stream/${item.type}/${encodeURIComponent(item.id)}.json`;
    const started = Date.now();
    try {
      const response = await fetchWithTimeout(url, args.timeoutMs);
      const elapsed = Date.now() - started;
      const streamCount = Array.isArray(response.body?.streams) ? response.body.streams.length : 0;
      console.log(`[Test] run=${item.run} type=${item.type} id=${item.id} status=${response.status} streams=${streamCount} elapsed=${elapsed}ms`);
    } catch (error) {
      const elapsed = Date.now() - started;
      console.log(`[Test] run=${item.run} type=${item.type} id=${item.id} status=ERR elapsed=${elapsed}ms msg=${error.message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (addonProc && !args.keepAddonAlive) {
    addonProc.kill('SIGTERM');
  }

  const summary = [...providerStats.entries()]
    .map(([provider, info]) => ({
      provider,
      requests: info.requests,
      avgMs: mean(info.durations),
      maxMs: info.durations.length ? Math.max(...info.durations) : 0,
      timeouts: info.timeouts,
      errors: info.errors
    }))
    .sort((a, b) => b.avgMs - a.avgMs);

  console.log('\n=== Provider Latency Ranking (slowest first) ===');
  if (!summary.length) {
    console.log('No provider benchmark lines captured.');
    return;
  }

  for (const row of summary) {
    console.log(
      `${row.provider.padEnd(18)} avg=${formatMs(row.avgMs).padStart(9)} max=${formatMs(row.maxMs).padStart(9)} req=${String(row.requests).padStart(3)} timeouts=${String(row.timeouts).padStart(2)} errors=${String(row.errors).padStart(2)}`
    );
  }
}

main().catch((error) => {
  console.error('[LatencyTest] Fatal:', error.message);
  process.exit(1);
});
