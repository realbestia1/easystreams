import sys
import json
import re
import base64
import argparse
from curl_cffi.requests import AsyncSession
import asyncio

async def extract_vidxgo_url(url, headers=None):
    if headers is None:
        headers = {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Sec-GPC': '1',
            'Alt-Used': 'v.vidxgo.co',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'iframe',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'DNT': '1',
            'Referer': 'https://altadefinizione.you/',
            'Priority': 'u=0, i',
        }

    result = {
        'status': 'error',
        'page_url': url,
        'stream_url': None,
        'error': None
    }

    try:
        async with AsyncSession() as client:
            response = await client.get(url, allow_redirects=True, headers=headers)
            result['status_code'] = response.status_code

            if response.status_code != 200:
                result['error'] = f'HTTP {response.status_code}'
                return result

            html = response.text

            xor_patterns = re.findall(
                r"var\s+\w+\s*=\s*'(\w+)'\s*,?\s*d\s*=\s*atob\s*\(\s*'([A-Za-z0-9+/=]+)'\s*\)",
                html
            )

            if not xor_patterns:
                result['error'] = 'XOR pattern not found'
                return result

            for key, base64_text in xor_patterns:
                try:
                    decoded = base64.b64decode(base64_text)
                    u = bytearray(len(decoded))
                    for i in range(len(decoded)):
                        u[i] = decoded[i] ^ ord(key[i % len(key)])
                    decrypted_code = u.decode('utf-8')

                    stream_match = re.search(r'currentSrc[^"]+"(https:[^";]+)', decrypted_code)
                    if stream_match:
                        stream_url = stream_match.group(1).replace("\\", "")
                        result['status'] = 'ok'
                        result['stream_url'] = stream_url
                        return result
                except Exception:
                    continue

            result['error'] = 'Stream URL not found in any XOR pattern'

    except Exception as e:
        result['error'] = str(e)

    return result


def main():
    parser = argparse.ArgumentParser(description='VidxGO Cloudflare bypass and URL extraction')
    parser.add_argument('url', help='VidxGO page URL')
    parser.add_argument('--referer', default='https://altadefinizione.you/', help='Referer header')
    parser.add_argument('--timeout', type=int, default=30000, help='Timeout in ms')

    args = parser.parse_args()

    headers = {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-GPC': '1',
        'Alt-Used': 'v.vidxgo.co',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'iframe',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'DNT': '1',
        'Referer': args.referer,
        'Priority': 'u=0, i',
    }

    result = asyncio.run(extract_vidxgo_url(args.url, headers))
    print(json.dumps(result))

    if result['status'] != 'ok':
        sys.exit(1)


if __name__ == '__main__':
    main()
