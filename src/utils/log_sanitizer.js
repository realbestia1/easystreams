const LOG_REDACTION_DISABLED = /^(0|false|no|off)$/i.test(String(process.env.LOG_REDACTION || '').trim());

const SENSITIVE_QUERY_PARAM = /(?:token|sig|sign|hash|key|auth|pass|secret|clearance|chl|session)/i;
const SENSITIVE_HEADER = /\b(Cookie|Set-Cookie|Authorization)\s*:\s*[^\r\n]+/gi;
const COOKIE_ASSIGNMENT = /\b([A-Za-z0-9_.-]*(?:clearance|session|token|auth|hash|key|PHPSESSID)[A-Za-z0-9_.-]*)\s*=\s*([^;\s,'"}]+)/gi;
const JSON_SECRET_VALUE = /(["'](?:value|cookie|cookies|cf_clearance|PHPSESSID|token|access_token|api_key|apikey|hash|authorization)["']\s*:\s*)(["'])(?:\\.|(?!\2).)*\2/gi;
const HTML_RESPONSE_VALUE = /(["']response["']\s*:\s*)(["'])(?:\\.|(?!\2)[\s\S])*?\2/gi;
const HTML_BLOCK = /<html\b[\s\S]*?<\/html>/gi;
const URL_PATTERN = /https?:\/\/[^\s"'<>\\]+/gi;

function redactUrl(rawUrl) {
    try {
        const parsed = new URL(rawUrl);

        if (/\.m3u8(?:$|\?)/i.test(parsed.pathname) || /\/hls\//i.test(parsed.pathname)) {
            return `${parsed.protocol}//${parsed.host}/[redacted-m3u8]`;
        }

        for (const key of Array.from(parsed.searchParams.keys())) {
            if (SENSITIVE_QUERY_PARAM.test(key)) {
                parsed.searchParams.set(key, 'redacted');
            }
        }

        return parsed.toString();
    } catch {
        return rawUrl;
    }
}

function sanitizeLogText(value) {
    if (LOG_REDACTION_DISABLED) return String(value ?? '');

    return String(value ?? '')
        .replace(HTML_RESPONSE_VALUE, '$1$2[redacted-html]$2')
        .replace(HTML_BLOCK, '[redacted-html]')
        .replace(SENSITIVE_HEADER, '$1: [redacted]')
        .replace(JSON_SECRET_VALUE, '$1$2[redacted]$2')
        .replace(COOKIE_ASSIGNMENT, '$1=[redacted]')
        .replace(URL_PATTERN, redactUrl);
}

function sanitizeLogValue(value) {
    if (LOG_REDACTION_DISABLED) return value;
    if (typeof value === 'string') return sanitizeLogText(value);
    if (value instanceof Error) {
        const sanitized = new Error(sanitizeLogText(value.message));
        sanitized.name = value.name;
        if (value.stack) sanitized.stack = sanitizeLogText(value.stack);
        return sanitized;
    }
    if (!value || typeof value !== 'object') return value;

    try {
        return JSON.parse(sanitizeLogText(JSON.stringify(value)));
    } catch {
        return sanitizeLogText(String(value));
    }
}

function sanitizeLogArgs(args) {
    return Array.from(args, sanitizeLogValue);
}

module.exports = {
    sanitizeLogArgs,
    sanitizeLogText,
    sanitizeLogValue
};
