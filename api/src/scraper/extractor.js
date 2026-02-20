/**
 * Stream URL Extractor — FikDrama API
 *
 * Two-tier extraction:
 * 1. extractWithAxios()  — fast, regex-based (works for most servers)
 * 2. extractWithPlaywright() — headless browser fallback (TurboVIP stealth)
 *
 * Usage:
 *   const { extractStream } = require('./extractor');
 *   const result = await extractStream(embedUrl);
 */

const axios = require('axios');

const TARGET = process.env.TARGET_BASE_URL || 'http://45.11.57.31';

// ── Smart Referer per-domain ─────────────────────────────────
function getRefererForDomain(url) {
    const domain = (() => { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } })();

    const map = {
        turbovid: 'https://turboplay.stream/',
        emturbovid: 'https://turbovip.fun/',
        'turboplay': 'https://turboplay.stream/',
        hydrax: 'https://hydrax.net/',
        filelions: 'https://filelions.live/',
        vidhide: 'https://vidhide.com/',
        streamtape: 'https://streamtape.com/',
        doodstream: 'https://doodstream.com/',
        mp4upload: 'https://mp4upload.com/',
    };

    for (const [key, ref] of Object.entries(map)) {
        if (domain.includes(key)) return ref;
    }

    return TARGET + '/';
}

// ── Regex patterns to find video URLs ────────────────────────
const VIDEO_PATTERNS = [
    // HLS m3u8 (highest priority)
    /["'`](https?:\/\/[^"'`\s]+\.m3u8[^"'`\s]*)["'`]/i,
    // MP4 direct
    /["'`](https?:\/\/[^"'`\s]+\.mp4[^"'`\s]*)["'`]/i,
    // JWPlayer / Playerjs file:
    /(?:file|src)\s*:\s*["'](https?:\/\/[^"']+?(?:\.m3u8|\.mp4)[^"']*)["']/i,
    // sources array [{file:...}]
    /sources\s*[=:]\s*\[\s*\{[^}]*?(?:file|src)\s*:\s*["'](https?:\/\/[^"']+)["']/is,
    // data-url attribute
    /data-(?:url|src|file)=["'](https?:\/\/[^"']+)["']/i,
    // EarnVids / vjsJwxData
    /vjsJwxData\s*=\s*[^;]*?sources.*?file\s*:\s*["'](https?:\/\/[^"']+)["']/is,
    // Playerjs: Playerjs('...')
    /Playerjs\(["'](.+?)["']\)/i,
    // setup({ ... })
    /setup\(\s*\{[^}]*?(?:file|source|src)\s*:\s*["'](https?:\/\/[^"']+)["']/is,
    // atob() encoded URLs (TurboVIP obfuscation)
    /atob\(["']([A-Za-z0-9+/=]+)["']\)/i,
    // JSON.parse with video URL inside
    /JSON\.parse\(["'](.+?)["']\)/i,
    // Generic m3u8 anywhere
    /(https?:\/\/[^\s"'<>]+\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?)/i,
];

// ── Tier 1: Axios + Regex extraction ─────────────────────────
async function extractWithAxios(url) {
    const referer = getRefererForDomain(url);
    const origin = (() => { try { return new URL(referer).origin; } catch { return referer; } })();

    // Try multiple referers in order of likelihood
    const referers = [
        referer,
        TARGET + '/',
        (() => { try { return new URL(url).origin + '/'; } catch { return referer; } })(),
    ];

    let html = null;

    for (const ref of referers) {
        try {
            const resp = await axios.get(url, {
                timeout: 15000,
                maxRedirects: 5,
                headers: {
                    'Referer': ref,
                    'Origin': (() => { try { return new URL(ref).origin; } catch { return ref; } })(),
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Sec-Fetch-Dest': 'iframe',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'cross-site',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                },
            });
            html = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
            if (html && html.length > 500) break;
        } catch (e) {
            console.warn(`[Extractor] Referer ${ref} failed: ${e.message}`);
        }
    }

    if (!html) return null;

    // Try each pattern
    for (const pattern of VIDEO_PATTERNS) {
        const match = html.match(pattern);
        if (match && match[1]) {
            let videoUrl = match[1].trim();

            // Handle atob() encoded URLs
            if (pattern.source.includes('atob')) {
                try {
                    videoUrl = Buffer.from(videoUrl, 'base64').toString('utf-8');
                } catch { continue; }
            }

            // Handle JSON.parse wrappers
            if (pattern.source.includes('JSON\\.parse')) {
                try {
                    const parsed = JSON.parse(videoUrl.replace(/\\\"/g, '"'));
                    videoUrl = parsed.file || parsed.src || parsed.url || parsed.source || videoUrl;
                } catch { continue; }
            }

            // Skip too-short URLs (false positives)
            if (videoUrl.length < 15) continue;
            // Must be a valid URL
            if (!videoUrl.startsWith('http')) continue;

            console.log(`[Extractor] Found stream via Axios: ${videoUrl.substring(0, 80)}`);

            return {
                success: true,
                videoUrl,
                type: videoUrl.includes('.m3u8') ? 'hls' : 'mp4',
                source: (() => { try { return new URL(url).hostname; } catch { return 'unknown'; } })(),
                method: 'axios',
            };
        }
    }

    return null;
}

// ── Tier 2: Playwright extraction (optional) ─────────────────
// Only available if playwright-extra and stealth plugin are installed.
// Install: npm install playwright-extra puppeteer-extra-plugin-stealth playwright
let playwrightAvailable = null;

async function checkPlaywright() {
    if (playwrightAvailable !== null) return playwrightAvailable;
    try {
        require.resolve('playwright-extra');
        require.resolve('puppeteer-extra-plugin-stealth');
        playwrightAvailable = true;
    } catch {
        playwrightAvailable = false;
        console.log('[Extractor] Playwright not available — Axios-only mode');
    }
    return playwrightAvailable;
}

async function extractWithPlaywright(url) {
    if (!(await checkPlaywright())) return null;

    const { chromium } = require('playwright-extra');
    const stealth = require('puppeteer-extra-plugin-stealth')();
    chromium.use(stealth);

    let browser = null;
    let interceptedUrl = null;

    try {
        browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
            ],
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 720 },
            extraHTTPHeaders: {
                'Referer': getRefererForDomain(url),
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });

        const page = await context.newPage();

        // ── CRITICAL: Set up route interception BEFORE page.goto() ──
        // This captures .m3u8 requests that happen during page load
        await page.route('**/*.m3u8*', async (route) => {
            const reqUrl = route.request().url();
            console.log(`[Playwright] Intercepted m3u8: ${reqUrl.substring(0, 80)}`);
            interceptedUrl = reqUrl;
            await route.continue();
        });

        // Also intercept MP4 requests as fallback
        await page.route('**/*.mp4*', async (route) => {
            if (!interceptedUrl) {
                const reqUrl = route.request().url();
                console.log(`[Playwright] Intercepted mp4: ${reqUrl.substring(0, 80)}`);
                interceptedUrl = reqUrl;
            }
            await route.continue();
        });

        // Navigate and wait for network activity to settle
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 15000,
        });

        // Wait a bit for dynamic JS to fire XHRs
        if (!interceptedUrl) {
            await page.waitForTimeout(5000);
        }

        // If still nothing intercepted, try clicking play button
        if (!interceptedUrl) {
            try {
                const playBtn = await page.$('.plyr__control--overlaid, [class*="play"], button[aria-label*="play"], .vjs-big-play-button');
                if (playBtn) {
                    await playBtn.click();
                    await page.waitForTimeout(3000);
                }
            } catch (_) { }
        }

        if (interceptedUrl) {
            console.log(`[Extractor] Found stream via Playwright: ${interceptedUrl.substring(0, 80)}`);
            return {
                success: true,
                videoUrl: interceptedUrl,
                type: interceptedUrl.includes('.m3u8') ? 'hls' : 'mp4',
                source: (() => { try { return new URL(url).hostname; } catch { return 'unknown'; } })(),
                method: 'playwright',
            };
        }

        return null;

    } catch (e) {
        console.error(`[Playwright] Error: ${e.message}`);
        return null;
    } finally {
        if (browser) {
            try { await browser.close(); } catch (_) { }
        }
    }
}

// ── Main export: tries Axios first, then Playwright ──────────
async function extractStream(url) {
    // Tier 1: Axios (fast, works for 70%+ of servers)
    const axiosResult = await extractWithAxios(url);
    if (axiosResult) return axiosResult;

    // Tier 2: Playwright (slow but handles JS-heavy pages)
    const pwResult = await extractWithPlaywright(url);
    if (pwResult) return pwResult;

    // Neither worked
    console.warn(`[Extractor] No stream URL found for: ${url}`);
    return {
        success: false,
        error: 'Stream URL not found in embed page',
        source: (() => { try { return new URL(url).hostname; } catch { return 'unknown'; } })(),
    };
}

module.exports = {
    extractStream,
    extractWithAxios,
    extractWithPlaywright,
    getRefererForDomain,
};
