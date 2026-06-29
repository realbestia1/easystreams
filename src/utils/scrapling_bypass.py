#!/usr/bin/env python3
"""Camoufox + pyautogui Tab+Space per bypassare Cloudflare.
Sostituisce la vecchia versione con SeleniumBase.
Segue redirect e gestisce multiple challenge su domini diversi.
"""
import sys, json, argparse, time, os
from urllib.parse import urlparse
from camoufox.sync_api import Camoufox

display = None
if os.name != "nt":
    try:
        from pyvirtualdisplay import Display
        display = Display(visible=0, size=(1920, 1080))
        display.start()
    except Exception as e:
        sys.stderr.write(f"Failed to start pyvirtualdisplay: {e}\n")


def tab_space_os(page):
    try:
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
        return True
    except Exception as ex:
        sys.stderr.write(f"Tab+Space errore: {ex}\n")
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
    args = parser.parse_args()

    try:
        kw = {"headless": False, "humanize": True, "locale": "it-IT", "geoip": True}
        with Camoufox(**kw) as browser:
            page = browser.new_page()
            page.set_default_timeout(args.timeout)

            if args.method.upper() == 'POST':
                base = f"{urlparse(args.url).scheme}://{urlparse(args.url).netloc}/"
                page.goto(base, wait_until="domcontentloaded")
            else:
                page.goto(args.url, wait_until="domcontentloaded")
            time.sleep(2)

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
                if not is_ch(t):
                    if bypassed:
                        time.sleep(2)
                        t2 = safe_title(page)
                        if not is_ch(t2):
                            break
                        # redirect → nuova challenge
                    else:
                        bypassed = True
                        continue
                if not tab_space_os(page):
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

    except Exception as e:
        print(json.dumps({'status': 'error', 'message': str(e)}))
        sys.exit(1)
    finally:
        if display:
            try: display.stop()
            except: pass


if __name__ == '__main__':
    main()
