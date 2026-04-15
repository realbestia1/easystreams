const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

/**
 * Risolve la sfida Cloudflare e restituisce i cookie/UA
 * @param {string} url - URL target
 * @param {boolean} headless - Se vero, nasconde il browser
 */
async function getClearance(url, headless = false) {
    const isDocker = process.env.IN_DOCKER === 'true';
    const effectiveHeadless = isDocker ? 'new' : headless;

    console.log(`[CF] Avvio browser (Docker: ${isDocker}, Headless: ${effectiveHeadless})...`);
    
    const launchOptions = {
        headless: effectiveHeadless,
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    };

    // Su Linux/Docker cerchiamo l'installazione di Chrome/Chromium
    if (isDocker) {
        if (fs.existsSync('/usr/bin/chromium')) launchOptions.executablePath = '/usr/bin/chromium';
        else if (fs.existsSync('/usr/bin/google-chrome')) launchOptions.executablePath = '/usr/bin/google-chrome';
    }

    const browser = await puppeteer.launch(launchOptions);

    const [page] = await browser.pages();
    const ua = await page.evaluate(() => navigator.userAgent);

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        
        for (let i = 0; i < 60; i++) {
            const cookies = await page.cookies();
            const cf = cookies.find(c => c.name === 'cf_clearance');
            
            if (cf) {
                const data = {
                    userAgent: ua,
                    cookies: cookies.map(c => `${c.name}=${c.value}`).join('; '),
                    cf_clearance: cf.value,
                    timestamp: Date.now()
                };
                fs.writeFileSync('cf-session.json', JSON.stringify(data, null, 2));
                await browser.close();
                return data;
            }

            // Click Turnstile
            try {
                const frames = page.frames();
                const cfFrame = frames.find(f => f.url().includes('turnstile'));
                if (cfFrame) await cfFrame.click('#challenge-stage').catch(() => {});
            } catch (e) {}

            await new Promise(r => setTimeout(r, 1000));
        }
        throw new Error('Bypass timeout');
    } catch (err) {
        await browser.close();
        throw err;
    }
}

module.exports = { getClearance };
