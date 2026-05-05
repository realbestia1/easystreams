import sys
import json
import argparse
from scrapling.fetchers import StealthyFetcher

def main():
    parser = argparse.ArgumentParser(description='Scrapling Cloudflare Bypass')
    parser.add_argument('url', help='URL to fetch')
    parser.add_argument('--method', default='GET', help='HTTP method (GET/POST)')
    parser.add_argument('--data', help='POST data (URL encoded string)')
    parser.add_argument('--headers', help='JSON string of headers')
    parser.add_argument('--timeout', type=int, default=60000, help='Timeout in ms')
    parser.add_argument('--wait-until', default='domcontentloaded', help='Wait strategy (domcontentloaded/network_idle)')
    
    args = parser.parse_args()
    
    headers = {}
    if args.headers:
        try:
            headers = json.loads(args.headers)
        except:
            pass

    user_agent = headers.pop('User-Agent', None) or headers.pop('user-agent', None)
    cookie_str = headers.pop('Cookie', None) or headers.pop('cookie', None)
    cookies = []
    if cookie_str:
        for c in cookie_str.split(';'):
            if '=' in c:
                name, value = c.strip().split('=', 1)
                cookies.append({'name': name, 'value': value})

    # Kwargs for the fetch method, as per Scrapling 0.2.x
    fetch_kwargs = {
        'headless': True,
        'solve_cloudflare': True,
        'wait_until': args.wait_until,
        'timeout': args.timeout,
        'extra_headers': headers,
        'cookies': cookies,
    }
    
    if user_agent:
        fetch_kwargs['useragent'] = user_agent

    try:
        fetcher = StealthyFetcher()
        if args.method.upper() == 'POST':
            response = fetcher.fetch(args.url, method='POST', body=args.data, **fetch_kwargs)
        else:
            response = fetcher.fetch(args.url, **fetch_kwargs)

        # Small extra wait to ensure cookies from late JS execution are captured
        import time
        time.sleep(1)

        # Get User-Agent from request headers
        req_headers = response.request_headers or {}
        ua = req_headers.get('user-agent') or req_headers.get('User-Agent') or ""

        result = {
            'status': 'ok',
            'code': response.status,
            'url': str(response.url),
            'html': response.html_content,
            'headers': dict(response.headers),
            'cookies': response.cookies,
            'userAgent': ua,
            'requestHeaders': req_headers
        }
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({
            'status': 'error',
            'message': str(e)
        }))
        sys.exit(1)

if __name__ == '__main__':
    main()
