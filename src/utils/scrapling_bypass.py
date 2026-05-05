import sys
import json
import argparse
import random
import time
from scrapling.fetchers import StealthyFetcher

def main():
    parser = argparse.ArgumentParser(description='Scrapling Cloudflare Bypass')
    parser.add_argument('url', help='URL to fetch')
    parser.add_argument('--method', default='GET', help='HTTP method (GET/POST)')
    parser.add_argument('--data', help='POST data (URL encoded string)')
    parser.add_argument('--headers', help='JSON string of headers')
    parser.add_argument('--timeout', type=int, default=60000, help='Timeout in ms')
    
    args = parser.parse_args()
    
    headers = {}
    if args.headers:
        try:
            headers = json.loads(args.headers)
        except:
            pass

    # Extract user agent from headers if present
    user_agent = headers.pop('User-Agent', None) or headers.pop('user-agent', None)
    
    # Extract cookies from headers if present
    cookie_str = headers.pop('Cookie', None) or headers.pop('cookie', None)
    cookies = []
    if cookie_str:
        for c in cookie_str.split(';'):
            if '=' in c:
                name, value = c.strip().split('=', 1)
                cookies.append({'name': name, 'value': value})

    fetcher_kwargs = {
        'headless': True,
        'solve_cloudflare': True,
        'network_idle': True,  # Wait for network to be idle
        'timeout': args.timeout,
        'extra_headers': headers,
        'cookies': cookies,
    }
    
    if user_agent:
        fetcher_kwargs['useragent'] = user_agent

    try:
        if args.method.upper() == 'POST':
            # For POST, Scrapling's StealthyFetcher might need specific handling 
            # if we want to submit a form. But for simple POST requests:
            response = StealthyFetcher.fetch(args.url, method='POST', body=args.data, **fetcher_kwargs)
        else:
            response = StealthyFetcher.fetch(args.url, **fetcher_kwargs)

        result = {
            'status': 'ok',
            'code': response.status,
            'url': str(response.url),
            'html': response.html_content,
            'headers': dict(response.headers),
            'cookies': response.cookies,
            'userAgent': response.request_headers.get('User-Agent') or response.request_headers.get('user-agent')
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
