const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, 'landing_page.html');
const landingPageTemplate = fs.readFileSync(templatePath, 'utf8');

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderLandingPage({ manifest, providerNames }) {
    const safeManifest = manifest || {};
    const safeProviderNames = Array.isArray(providerNames) ? providerNames : [];
    const providersHtml = safeProviderNames
        .map((p) => `<div class="provider-tag">${escapeHtml(p)}</div>`)
        .join('');
    const providerSettingsHtml = safeProviderNames.map((p) => {
        const safeName = escapeHtml(p);
        return `
                    <label class="provider-option">
                        <input type="checkbox" class="provider-checkbox" value="${safeName}" checked>
                        <span>${safeName}</span>
                    </label>`;
    }).join('');

    return landingPageTemplate
        .replaceAll('{{manifestName}}', escapeHtml(safeManifest.name || 'EasyStreams'))
        .replaceAll('{{manifestVersion}}', escapeHtml(safeManifest.version || ''))
        .replaceAll('{{manifestDescription}}', escapeHtml(safeManifest.description || ''))
        .replaceAll('{{providersHtml}}', providersHtml)
        .replaceAll('{{providerSettingsHtml}}', providerSettingsHtml);
}

module.exports = {
    renderLandingPage
};
