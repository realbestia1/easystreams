/**
 * Cloudflare Worker Proxy for EasyStreams Addon
 * This proxy forwards the request shape more faithfully so upstream sites
 * can still see cookies, XHR hints, and browser-style fetch metadata.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*"
};

function buildCorsResponse(body, init = {}) {
  const response = new Response(body, init);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  response.headers.set("X-Proxied-By", "EasyStreams-Worker");
  return response;
}

function copyRequestHeaders(request, target) {
  const forwarded = new Headers();
  const headersToCopy = [
    "user-agent",
    "referer",
    "origin",
    "accept",
    "accept-language",
    "cache-control",
    "pragma",
    "cookie",
    "range",
    "content-type",
    "x-requested-with",
    "x-csrf-token",
    "sec-fetch-dest",
    "sec-fetch-mode",
    "sec-fetch-site",
    "sec-fetch-user",
    "upgrade-insecure-requests"
  ];

  for (const header of headersToCopy) {
    const value = request.headers.get(header);
    if (value) forwarded.set(header, value);
  }

  if (!forwarded.get("referer")) {
    forwarded.set("referer", `${target.origin}/`);
  }

  const isAjaxRequest =
    (forwarded.get("x-requested-with") || "").toLowerCase() === "xmlhttprequest";
  if (isAjaxRequest && !forwarded.get("origin")) {
    forwarded.set("origin", target.origin);
  }

  return forwarded;
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return buildCorsResponse(null, { status: 204 });
    }

    const incomingUrl = new URL(request.url);
    const targetUrl = incomingUrl.searchParams.get("url");

    if (!targetUrl) {
      return buildCorsResponse('EasyStreams Proxy Worker: Missing "url" parameter', {
        status: 400,
        headers: { "Content-Type": "text/plain" }
      });
    }

    try {
      const target = new URL(targetUrl);
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: copyRequestHeaders(request, target),
        body:
          request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
        redirect: "follow"
      });

      return buildCorsResponse(response.body, response);
    } catch (error) {
      return buildCorsResponse(`Proxy Error: ${error.message}`, {
        status: 500,
        headers: { "Content-Type": "text/plain" }
      });
    }
  }
};
