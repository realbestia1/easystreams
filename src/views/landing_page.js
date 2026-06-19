const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, 'landing_page.html');
const landingPageTemplate = fs.readFileSync(templatePath, 'utf8');

const PROVIDER_META = {
    guardahd: { display: 'GuardaHD', category: 'Film', accent: '#10B981', icon: 'film' },
    guardoserie: { display: 'Guardoserie', category: 'Serie TV', accent: '#F59E0B', icon: 'tv' },
    vidxgo: { display: 'VidxGo', category: 'Film & Serie', accent: '#06B6D4', icon: 'film' },
    animeunity: { display: 'AnimeUnity', category: 'Anime', accent: '#8B5CF6', icon: 'sparkle' },
    animeworld: { display: 'AnimeWorld', category: 'Anime', accent: '#3B82F6', icon: 'sparkle' },
    animesaturn: { display: 'AnimeSaturn', category: 'Anime', accent: '#EF4444', icon: 'sparkle' },
    streamingcommunity: { display: 'StreamingCommunity', category: 'Film & Serie', accent: '#E50914', icon: 'film' },
    cinemacity: { display: 'CinemaCity', category: 'Film & Serie', accent: '#EC4899', icon: 'film' }
};

const ICON_SVG = {
    film: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.3.3 2.6 1.4Z"/><path d="M6.2 5.3 16.9 8"/><path d="M3 11h18v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/></svg>',
    tv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>'
};

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function safeJsonScript(value) {
    return JSON.stringify(value || {})
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}

function getProviderMeta(name) {
    const key = String(name || '').toLowerCase();
    return PROVIDER_META[key] || {
        display: name,
        category: 'Provider',
        accent: '#6B7280',
        icon: 'film'
    };
}

function renderProviderCard(name, disabled) {
    const meta = getProviderMeta(name);
    const safeValue = escapeHtml(name);
    const safeDisplay = escapeHtml(meta.display);
    const safeCategory = escapeHtml(meta.category);
    const safeAccent = escapeHtml(meta.accent);
    const iconSvg = ICON_SVG[meta.icon] || ICON_SVG.film;
    const checkedAttr = disabled ? '' : ' checked';
    return `
                <label class="provider-card" style="--accent:${safeAccent}" aria-label="${safeDisplay}">
                    <input type="checkbox" class="provider-checkbox" value="${safeValue}"${checkedAttr}>
                    <span class="provider-card-inner">
                        <span class="provider-icon">${iconSvg}</span>
                        <span class="provider-info">
                            <span class="provider-name">${safeDisplay}</span>
                            <span class="provider-category">${safeCategory}</span>
                        </span>
                    </span>
                </label>`;
}

function renderLandingPage({ manifest, providerNames, initialConfig = {} }) {
    const safeManifest = manifest || {};
    const safeProviderNames = Array.isArray(providerNames) ? providerNames : [];
    const disabledProviderConfig = Object.prototype.hasOwnProperty.call(initialConfig || {}, 'disabledProviders')
        ? initialConfig.disabledProviders
        : '';
    const disabledProviders = new Set(String(disabledProviderConfig || '')
        .split(',')
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean));

    const providerCardsHtml = safeProviderNames
        .map((p) => renderProviderCard(p, disabledProviders.has(String(p || '').toLowerCase())))
        .join('');

    return landingPageTemplate
        .replaceAll('{{manifestName}}', escapeHtml(safeManifest.name || 'EasyStreams'))
        .replaceAll('{{manifestDescription}}', escapeHtml(safeManifest.description || ''))
        .replaceAll('{{providerCardsHtml}}', providerCardsHtml)
        .replaceAll('{{initialConfigJson}}', safeJsonScript(initialConfig));
}

module.exports = {
    renderLandingPage
};
