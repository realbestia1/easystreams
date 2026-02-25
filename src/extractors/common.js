const USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

/**
 * Get a proxied URL if a Cloudflare Worker proxy is configured
 * @param {string} url The target URL
 * @returns {string} The proxied URL or original URL
 */
function getProxiedUrl(url) {
  const proxyUrl = process.env.CF_PROXY_URL;
  if (proxyUrl && url) {
    // Basic implementation: append target URL as a query parameter
    // You can customize this based on how your CF Worker is implemented
    const separator = proxyUrl.includes('?') ? '&' : '?';
    return `${proxyUrl}${separator}url=${encodeURIComponent(url)}`;
  }
  return url;
}

function unPack(p, a, c, k, e, d) {
  e = function (c2) {
    return (c2 < a ? "" : e(parseInt(c2 / a))) + ((c2 = c2 % a) > 35 ? String.fromCharCode(c2 + 29) : c2.toString(36));
  };
  if (!"".replace(/^/, String)) {
    while (c--) {
      d[e(c)] = k[c] || e(c);
    }
    k = [function (e2) {
      return d[e2] || e2;
    }];
    e = function () {
      return "\\w+";
    };
    c = 1;
  }
  while (c--) {
    if (k[c]) {
      p = p.replace(new RegExp("\\b" + e(c) + "\\b", "g"), k[c]);
    }
  }
  return p;
}

module.exports = {
  USER_AGENT,
  unPack,
  getProxiedUrl
};
