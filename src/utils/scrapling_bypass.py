#!/usr/bin/env python3
"""Camoufox + pyautogui Tab+Space per bypassare Cloudflare.
Sostituisce la vecchia versione con SeleniumBase.
Segue redirect e gestisce multiple challenge su domini diversi.
"""
import sys, json, argparse, time, os
from urllib.parse import urlparse
from camoufox.utils import launch_options as _cf_lo

display = None
if os.name != "nt":
    try:
        from pyvirtualdisplay import Display
        display = Display(visible=0, size=(1920, 1080))
        display.start()
        # WM leggero per gestire il focus (necessario in Docker senza WM)
        import subprocess, time
        subprocess.Popen(["fluxbox"], env={**os.environ}, stderr=subprocess.DEVNULL)
        time.sleep(1)
    except Exception as e:
        sys.stderr.write(f"Failed to start pyvirtualdisplay/fluxbox: {e}\n")


def tab_space_os(page):
    try:
        if os.name == "nt":
            import pyautogui, pygetwindow as gw
            w = None
            for ww in gw.getAllWindows():
                try:
                    if "camoufox" in (ww.title or "").lower() and ww.visible:
                        w = ww; break
                except: pass
            if not w:
                for ww in gw.getWindowsWithTitle("Camoufox"):
                    if ww.visible: w = ww; break
            if not w: return False
            w.activate()
            time.sleep(0.3)
            pyautogui.press("tab"); time.sleep(0.3)
            pyautogui.press("space")
        else:
            # Trova finestra con xdotool, poi key via pyautogui (XTest, senza pygetwindow)
            import subprocess
            wid = None
            r = subprocess.run(["xdotool","search","--name","Camoufox"],
                               capture_output=True,text=True,timeout=10)
            if r.stdout.strip():
                wid = r.stdout.strip().split("\n")[0]
            else:
                r2 = subprocess.run(["xdotool","search","--class","Firefox"],
                                    capture_output=True,text=True,timeout=10)
                if r2.stdout.strip():
                    wid = r2.stdout.strip().split("\n")[0]
            if not wid:
                sys.stderr.write(f"tab_space: finestra non trovata\n")
                return False
            sys.stderr.write(f"tab_space: finestra {wid}, focus + 3xTab+Space via pyautogui...\n")
            subprocess.run(["xdotool","windowfocus","--sync",wid], timeout=10)
            time.sleep(0.3)
            # pyautogui su Linux: Xlib warning soppresso con cookie xauth
            subprocess.run(["xauth","add",os.environ.get("DISPLAY",":99"),
                           ".","ffffffffffffffffffffffffffffffff"],
                           capture_output=True, timeout=5)
            import pyautogui
            pyautogui.press("tab"); time.sleep(0.3)
            pyautogui.press("space")
            sys.stderr.write(f"tab_space: 3xTab+Space via pyautogui\n")
        return True
    except Exception as ex:
        sys.stderr.write(f"tab_space errore: {ex}\n")
        return False


def safe_title(p):
    try: return p.title()
    except: return ""


def main():
    parser = argparse.ArgumentParser(description='Camoufox Cloudflare Bypass')
    parser.add_argument('url', help='URL to fetch')
    parser.add_argument('--method', default='GET', help='HTTP method (GET/POST)')
    parser.add_argument('--data', help='POST data (URL encoded string)')
    parser.add_argument('--headers', help='JSON string of headers')
    parser.add_argument('--timeout', type=int, default=60000, help='Timeout in ms')
    parser.add_argument('--wait-until', default='domcontentloaded', help='Wait strategy')
    parser.add_argument('--provider', default='default', help='Provider name for profile directory separation')
    args = parser.parse_args()

    try:
        sys.stderr.write("start: import playwright...\n")
        from playwright.sync_api import sync_playwright as _sync_pw
        import tempfile
        sys.stderr.write("start: camoufox launch_options...\n")
        kw = {"headless": False, "humanize": True, "locale": "it-IT", "geoip": True}
        _lo = _cf_lo(**kw)
        _td = os.path.join(tempfile.gettempdir(), f"camoufox_ctx_{args.provider}")
        os.makedirs(_td, exist_ok=True)
        sys.stderr.write("start: sync_playwright...\n")
        _pw = _sync_pw().__enter__()
        try:
            sys.stderr.write("start: lancio Firefox...\n")
            ctx = _pw.firefox.launch_persistent_context(_td, no_viewport=True, **_lo)
            sys.stderr.write("start: Firefox avviato, creo pagina...\n")
            page = ctx.new_page()
            page.evaluate("window.moveTo(0,0); window.resizeTo(1280, 720)")
            page.set_default_timeout(args.timeout)

            if args.method.upper() == 'POST':
                base = f"{urlparse(args.url).scheme}://{urlparse(args.url).netloc}/"
                page.goto(base, wait_until="domcontentloaded")
            else:
                page.goto(args.url, wait_until="domcontentloaded")
            sys.stderr.write(f"start: pagina caricata, title={safe_title(page)!r}\n")
            sys.stderr.write(f"start: attendo 12s prima di interagire (auto-solve)...\n")
            time.sleep(12)
            sys.stderr.write(f"start: dopo 12s title={safe_title(page)!r}\n")

            # loop continuo con redirect monitoring
            challenge_titles = ["just a moment", "ci siamo quasi", "attention required",
                "un instant", "un moment", "einen moment", "un momento",
                "só um momento", "um momento"]

            def is_ch(t):
                return t and any(m in t.lower() for m in challenge_titles)

            bypass_start = time.time()
            max_wait = max(120, args.timeout // 1000)
            bypassed = False
            while time.time() - bypass_start < max_wait:
                try:
                    page.wait_for_load_state("domcontentloaded", timeout=8000)
                except: pass
                t = safe_title(page)
                sys.stderr.write(f"loop: elap={(time.time()-bypass_start):.0f}s title={t!r} bypassed={bypassed}\n")
                if not is_ch(t):
                    if bypassed:
                        time.sleep(2)
                        t2 = safe_title(page)
                        if not is_ch(t2):
                            sys.stderr.write(f"loop: stabile, break\n")
                            break
                        sys.stderr.write(f"loop: redirect nuova challenge title={t2!r}\n")
                    else:
                        bypassed = True
                        sys.stderr.write(f"loop: bypassato title={t!r}\n")
                        continue
                if not tab_space_os(page):
                    sys.stderr.write(f"loop: tab_space fallito, sleep 3\n")
                    time.sleep(3)
                    continue
                time.sleep(3)

            # POST o GET
            status_code = 200
            html = ""
            current_url = args.url

            if args.method.upper() == 'POST' and args.data:
                js = """(a) => fetch(a.url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:a.body})
                        .then(r=>r.text().then(t=>({status:r.status,url:r.url,text:t})))
                        .catch(e=>({status:0,url:'',text:e.message}))"""
                try:
                    r = page.evaluate(js, dict(url=args.url, body=args.data))
                    status_code = r.get("status", 200)
                    html = r.get("text", "")
                    current_url = r.get("url", args.url)
                except Exception as e:
                    sys.stderr.write(f"POST fallito: {e}\n")
            else:
                try:
                    page.wait_for_load_state("domcontentloaded", timeout=10000)
                    html = page.content()
                    current_url = page.url
                except: pass

            if is_ch(safe_title(page)):
                print(json.dumps({'status': 'error', 'message': 'Bypass fallito'}))
                sys.exit(1)

            cookies = []
            try:
                for c in page.context.cookies():
                    cookies.append({k: c.get(k) for k in ("name","value","domain","path","httpOnly","secure")})
                    if "expires" in c: cookies[-1]["expiry"] = c["expires"]
            except: pass

            ua = page.evaluate("navigator.userAgent")

            result = dict(
                status='ok', code=status_code, url=current_url,
                html=html, raw=html, headers={},
                cookies=cookies, userAgent=ua, requestHeaders={}
            )
            print(json.dumps(result))

        finally:
            # chiusura pulita ctx + playwright
            try: ctx.close()
            except: pass
            try: _pw.__exit__(None, None, None)
            except: pass

    except Exception as e:
        print(json.dumps({'status': 'error', 'message': str(e)}))
        sys.exit(1)
    finally:
        if display:
            try: display.stop()
            except: pass


if __name__ == '__main__':
    main()
