#!/usr/bin/env python3
"""
Single Persistent Camoufox Browser Daemon per easystreams.
Mantiene un'unica istanza di BrowserContext in memoria.
Gestisce richieste concorrenti aprendo e chiudendo schede (tabs) isolate.
"""
import sys, json, os, time, threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from camoufox.utils import launch_options as _cf_lo

PORT = int(os.environ.get("CF_DAEMON_PORT", 8192))
ctx = None
pw = None
ctx_lock = threading.Lock()

challenge_titles = [
    "just a moment", "ci siamo quasi", "attention required",
    "un instant", "un moment", "einen moment", "un momento",
    "só um momento", "um momento"
]

def is_ch(title):
    if not title or not title.strip():
        return True
    return any(m in title.lower() for m in challenge_titles)

def safe_title(page):
    try: return page.title()
    except: return ""

def init_browser():
    global ctx, pw
    with ctx_lock:
        if ctx is not None:
            return
        sys.stderr.write("[CF Daemon] Avvio istanza in-memory Camoufox...\n")
        sys.stderr.flush()
        from playwright.sync_api import sync_playwright
        import tempfile
        pw = sync_playwright().start()
        kw = {"headless": True, "humanize": True, "locale": "it-IT", "geoip": True}
        _lo = _cf_lo(**kw)
        _td = os.path.join(tempfile.gettempdir(), "camoufox_ctx_daemon_easystreams")
        os.makedirs(_td, exist_ok=True)
        ctx = pw.firefox.launch_persistent_context(_td, no_viewport=True, **_lo)
        sys.stderr.write("[CF Daemon] Camoufox Daemon pronto in memoria.\n")
        sys.stderr.flush()

def handle_bypass_request(params):
    init_browser()
    url = params.get("url")
    provider = params.get("provider", "default")
    method = params.get("method", "GET").upper()
    data = params.get("data")
    timeout = int(params.get("timeout", 60000))

    page = ctx.new_page()
    page.set_default_timeout(timeout)
    try:
        sys.stderr.write(f"[CF Daemon][{provider}] Fetch tab per: {url}\n")
        sys.stderr.flush()

        if method == 'POST' and data:
            base = f"{urlparse(url).scheme}://{urlparse(url).netloc}/"
            page.goto(base, wait_until="domcontentloaded")
        else:
            page.goto(url, wait_until="domcontentloaded")

        # Controlla dinamicamente se c'è Turnstile o se la pagina si è caricata subito
        bypass_start = time.time()
        max_wait = max(30, timeout // 1000)
        while time.time() - bypass_start < max_wait:
            try:
                page.wait_for_load_state("domcontentloaded", timeout=3000)
            except: pass
            t = safe_title(page)
            if not is_ch(t):
                break
            time.sleep(1)

        # POST o GET output
        status_code = 200
        html = ""
        current_url = url

        if method == 'POST' and data:
            js = """(a) => fetch(a.url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:a.body})
                    .then(r=>r.text().then(t=>({status:r.status,url:r.url,text:t})))
                    .catch(e=>({status:0,url:'',text:e.message}))"""
            r = page.evaluate(js, dict(url=url, body=data))
            status_code = r.get("status", 200)
            html = r.get("text", "")
            current_url = r.get("url", url)
        else:
            try:
                page.wait_for_load_state("domcontentloaded", timeout=5000)
            except: pass
            html = page.content()
            current_url = page.url

        if is_ch(safe_title(page)):
            return {'status': 'error', 'message': 'Bypass fallito - ancora in challenge'}

        cookies = []
        try:
            for c in page.context.cookies():
                cookies.append({k: c.get(k) for k in ("name","value","domain","path","httpOnly","secure")})
                if "expires" in c: cookies[-1]["expiry"] = c["expires"]
        except: pass

        ua = page.evaluate("navigator.userAgent")

        return dict(
            status='ok', code=status_code, url=current_url,
            html=html, raw=html, headers={},
            cookies=cookies, userAgent=ua, requestHeaders={}
        )
    finally:
        try: page.close()
        except: pass

class DaemonRequestHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_POST(self):
        if self.path == "/bypass":
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            try:
                params = json.loads(body)
                res = handle_bypass_request(params)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                try:
                    self.wfile.write(json.dumps(res).encode('utf-8'))
                except OSError:
                    pass
            except Exception as e:
                try:
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
                except OSError:
                    pass
        else:
            self.send_response(404)
            self.end_headers()

def main():
    server = HTTPServer(('127.0.0.1', PORT), DaemonRequestHandler)
    sys.stderr.write(f"[CF Daemon] Daemon HTTP avviato su http://127.0.0.1:{PORT}\n")
    sys.stderr.flush()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        if ctx:
            try: ctx.close()
            except: pass
        if pw:
            try: pw.stop()
            except: pass

if __name__ == '__main__':
    main()
