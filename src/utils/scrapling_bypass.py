import sys
import json
import argparse
import time
import os
from urllib.parse import urlparse
from seleniumbase import Driver
from selenium.common.exceptions import TimeoutException

# 1. Start Xvfb virtual display on Linux/Docker
display = None
if os.name != "nt":
    try:
        from pyvirtualdisplay import Display
        display = Display(visible=0, size=(1920, 1080))
        display.start()
    except Exception as e:
        sys.stderr.write(f"Failed to start pyvirtualdisplay: {e}\n")

def is_cloudflare_challenge(html: str, status: int) -> bool:
    if status in (403, 503):
        return True
    low_html = html.lower()
    if "cloudflare" in low_html and ("ray id" in low_html or "captcha" in low_html or "turnstile" in low_html or "challenge-platform" in low_html):
        return True
    return False

def main():
    parser = argparse.ArgumentParser(description='SeleniumBase Cloudflare Bypass')
    parser.add_argument('url', help='URL to fetch')
    parser.add_argument('--method', default='GET', help='HTTP method (GET/POST)')
    parser.add_argument('--data', help='POST data (URL encoded string)')
    parser.add_argument('--headers', help='JSON string of headers')
    parser.add_argument('--timeout', type=int, default=60000, help='Timeout in ms')
    parser.add_argument('--wait-until', default='domcontentloaded', help='Wait strategy')
    
    args = parser.parse_args()
    
    driver = None
    try:
        # Launch SeleniumBase Driver (UC mode)
        driver = Driver(uc=True)
        driver.set_window_size(1280, 800)
        driver.set_page_load_timeout(args.timeout / 1000)
        
        # If it's a POST request, open base domain first
        if args.method.upper() == 'POST':
            parsed_url = urlparse(args.url)
            base_url = f"{parsed_url.scheme}://{parsed_url.netloc}/"
            try:
                driver.uc_open_with_reconnect(base_url, reconnect_time=4)
            except TimeoutException:
                sys.stderr.write(f"Timeout opening base URL: {base_url}\n")
        else:
            try:
                driver.uc_open_with_reconnect(args.url, reconnect_time=4)
            except TimeoutException:
                sys.stderr.write(f"Timeout opening URL: {args.url}\n")
            
        # Challenge titles check
        challenge_titles = ["just a moment", "cloudflare", "cf-challenge", "ci siamo quasi", "attention required", "un instant", "un moment", "einen moment", "un momento", "só um momento", "even geduld", "bir an", "chwileczk"]
        
        def _is_on_challenge():
            try:
                t = driver.title or ""
                h = driver.page_source or ""
                t_low = t.lower()
                is_title = any(m in t_low for m in challenge_titles)
                is_html = is_cloudflare_challenge(h, 200)
                return (is_title or is_html), t_low
            except Exception:
                return True, ""
                
        # Phase 1: Wait and attempt fast CAPTCHA click
        driver.sleep(3.5)
        on_challenge, title_low = _is_on_challenge()
        bypassed = False
        
        if on_challenge:
            try:
                driver.uc_gui_click_captcha()
                driver.sleep(4)
                on_challenge, title_low = _is_on_challenge()
                if not on_challenge:
                    bypassed = True
            except Exception as ex:
                sys.stderr.write(f"Initial click attempt error: {ex}\n")
        else:
            bypassed = True
            
        # Phase 2: Fallback attempts if not bypassed
        if not bypassed:
            for attempt in range(1, 3):
                try:
                    try:
                        driver.uc_open_with_reconnect(args.url, reconnect_time=4)
                    except TimeoutException as tex:
                        sys.stderr.write(f"Fallback attempt {attempt} timeout: {tex}\n")
                        continue
                    driver.sleep(3)
                    on_challenge, title_low = _is_on_challenge()
                    if not on_challenge:
                        bypassed = True
                        break
                        
                    driver.uc_gui_click_captcha()
                    driver.sleep(4)
                    on_challenge, title_low = _is_on_challenge()
                    if not on_challenge:
                        bypassed = True
                        break
                except Exception as ex:
                    sys.stderr.write(f"Fallback attempt {attempt} error: {ex}\n")
                    
        # Programmatic POST or GET source retrieval
        status_code = 200
        html = ""
        current_url = args.url
        
        if args.method.upper() == 'POST' and args.data:
            js_script = """
                const callback = arguments[arguments.length - 1];
                fetch(arguments[0], {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: arguments[1]
                })
                .then(r => r.text().then(text => callback({status: r.status, url: r.url, text: text})))
                .catch(err => callback({status: 0, url: '', text: err.message}));
            """
            post_res = driver.execute_async_script(js_script, args.url, args.data)
            status_code = post_res.get("status", 200)
            html = post_res.get("text", "")
            current_url = post_res.get("url", args.url)
        else:
            html = driver.page_source
            current_url = driver.current_url
            
        # Extract cookies in standard format
        selenium_cookies = driver.get_cookies()
        cookies = []
        for c in selenium_cookies:
            cookies.append({
                "name": c.get("name"),
                "value": c.get("value"),
                "domain": c.get("domain"),
                "path": c.get("path"),
                "expiry": c.get("expiry"),
                "httpOnly": c.get("httpOnly"),
                "secure": c.get("secure")
            })
            
        ua = driver.execute_script("return navigator.userAgent;")
        
        result = {
            'status': 'ok',
            'code': status_code,
            'url': current_url,
            'html': html,
            'raw': html,
            'headers': {},
            'cookies': cookies,
            'userAgent': ua,
            'requestHeaders': {}
        }
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({
            'status': 'error',
            'message': str(e)
        }))
        sys.exit(1)
    finally:
        if driver:
            try:
                driver.quit()
            except:
                pass
        if display:
            try:
                display.stop()
            except:
                pass

if __name__ == '__main__':
    main()
