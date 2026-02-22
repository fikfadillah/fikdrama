/**
 * Stream URL extractor with strict outbound URL policy.
 *
 * Two-tier extraction:
 * 1. extractWithAxios()      fast regex-based extraction
 * 2. extractWithPlaywright() JS-heavy fallback (optional dependency)
 */

const {
    getProxyAllowlist,
    validateOutboundUrl,
    requestWithValidatedRedirects,
    redactUrlForLogs,
} = require('../security/urlGuard');

const TARGET = process.env.TARGET_BASE_URL || 'http://45.11.57.31';
const PROXY_ALLOWLIST = getProxyAllowlist();

function safeHostname(rawUrl) {
    try {
        return new URL(rawUrl).hostname;
    } catch {
        return 'unknown';
    }
}

// Smart referer per domain
function getRefererForDomain(url) {
    const domain = (() => { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } })();

    const map = {
        turbovid: 'https://turboplay.stream/',
        emturbovid: 'https://turbovip.fun/',
        turboplay: 'https://turboplay.stream/',
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

    return `${TARGET}/`;
}

const VIDEO_PATTERNS = [
    /["'`](https?:\/\/[^"'`\s]+\.m3u8[^"'`\s]*)["'`]/i,
    /["'`](https?:\/\/[^"'`\s]+\.mp4[^"'`\s]*)["'`]/i,
    /(?:file|src)\s*:\s*["'](https?:\/\/[^"']+?(?:\.m3u8|\.mp4)[^"']*)["']/i,
    /sources\s*[=:]\s*\[\s*\{[^}]*?(?:file|src)\s*:\s*["'](https?:\/\/[^"']+)["']/is,
    /data-(?:url|src|file)=["'](https?:\/\/[^"']+)["']/i,
    /vjsJwxData\s*=\s*[^;]*?sources.*?file\s*:\s*["'](https?:\/\/[^"']+)["']/is,
    /Playerjs\(["'](.+?)["']\)/i,
    /setup\(\s*\{[^}]*?(?:file|source|src)\s*:\s*["'](https?:\/\/[^"']+)["']/is,
    /atob\(["']([A-Za-z0-9+/=]+)["']\)/i,
    /JSON\.parse\(["'](.+?)["']\)/i,
    /(https?:\/\/[^\s"'<>]+\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?)/i,
];

async function normalizeAllowedUrl(url, context) {
    const parsed = await validateOutboundUrl(url, {
        context,
        allowlist: PROXY_ALLOWLIST,
    });
    return parsed.toString();
}

async function extractWithAxios(url) {
    let safeEmbedUrl;
    try {
        safeEmbedUrl = await normalizeAllowedUrl(url, 'extractor.embed');
    } catch (e) {
        console.warn(`[Extractor] Blocked embed URL ${redactUrlForLogs(url)}: ${e.message}`);
        return null;
    }

    const referer = getRefererForDomain(safeEmbedUrl);
    const referers = [
        referer,
        `${TARGET}/`,
        (() => { try { return `${new URL(safeEmbedUrl).origin}/`; } catch { return referer; } })(),
    ];

    let html = null;

    for (const ref of referers) {
        try {
            const { response } = await requestWithValidatedRedirects({
                method: 'get',
                url: safeEmbedUrl,
                timeout: 15000,
                maxRedirects: 5,
                headers: {
                    Referer: ref,
                    Origin: (() => { try { return new URL(ref).origin; } catch { return ref; } })(),
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Sec-Fetch-Dest': 'iframe',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'cross-site',
                    'Cache-Control': 'no-cache',
                    Pragma: 'no-cache',
                },
            }, {
                context: 'extractor.embed-fetch',
                allowlist: PROXY_ALLOWLIST,
            });

            html = typeof response.data === 'string'
                ? response.data
                : JSON.stringify(response.data);
            if (html && html.length > 500) break;
        } catch (e) {
            console.warn(
                `[Extractor] Referer failed ${redactUrlForLogs(ref)} -> ${redactUrlForLogs(safeEmbedUrl)}: ${e.message}`
            );
        }
    }

    if (!html) return null;

    for (const pattern of VIDEO_PATTERNS) {
        const match = html.match(pattern);
        if (!match || !match[1]) continue;

        let videoUrl = match[1].trim();

        if (pattern.source.includes('atob')) {
            try {
                videoUrl = Buffer.from(videoUrl, 'base64').toString('utf-8');
            } catch {
                continue;
            }
        }

        if (pattern.source.includes('JSON\\.parse')) {
            try {
                const parsed = JSON.parse(videoUrl.replace(/\\\"/g, '"'));
                videoUrl = parsed.file || parsed.src || parsed.url || parsed.source || videoUrl;
            } catch {
                continue;
            }
        }

        if (videoUrl.length < 15) continue;
        if (!videoUrl.startsWith('http')) continue;

        try {
            videoUrl = await normalizeAllowedUrl(videoUrl, 'extractor.video');
        } catch {
            continue;
        }

        console.log(`[Extractor] Found stream via Axios: ${redactUrlForLogs(videoUrl)}`);
        return {
            success: true,
            videoUrl,
            type: videoUrl.includes('.m3u8') ? 'hls' : 'mp4',
            source: safeHostname(safeEmbedUrl),
            method: 'axios',
        };
    }

    return null;
}

let playwrightAvailable = null;

async function checkPlaywright() {
    if (playwrightAvailable !== null) return playwrightAvailable;
    try {
        require.resolve('playwright-extra');
        require.resolve('puppeteer-extra-plugin-stealth');
        playwrightAvailable = true;
    } catch {
        playwrightAvailable = false;
        console.log('[Extractor] Playwright not available - Axios-only mode');
    }
    return playwrightAvailable;
}

async function extractWithPlaywright(url) {
    if (!(await checkPlaywright())) return null;

    let safeEmbedUrl = url;
    try {
        safeEmbedUrl = await normalizeAllowedUrl(url, 'extractor.playwright');
    } catch (e) {
        console.warn(`[Playwright] Blocked URL ${redactUrlForLogs(url)}: ${e.message}`);
        return null;
    }

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
                Referer: getRefererForDomain(safeEmbedUrl),
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });

        const page = await context.newPage();

        await page.route('**/*.m3u8*', async (route) => {
            const reqUrl = route.request().url();
            console.log(`[Playwright] Intercepted m3u8: ${redactUrlForLogs(reqUrl)}`);
            interceptedUrl = reqUrl;
            await route.continue();
        });

        await page.route('**/*.mp4*', async (route) => {
            if (!interceptedUrl) {
                const reqUrl = route.request().url();
                console.log(`[Playwright] Intercepted mp4: ${redactUrlForLogs(reqUrl)}`);
                interceptedUrl = reqUrl;
            }
            await route.continue();
        });

        await page.goto(safeEmbedUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 15000,
        });

        if (!interceptedUrl) {
            await page.waitForTimeout(5000);
        }

        if (!interceptedUrl) {
            try {
                const playBtn = await page.$(
                    '.plyr__control--overlaid, [class*="play"], button[aria-label*="play"], .vjs-big-play-button'
                );
                if (playBtn) {
                    await playBtn.click();
                    await page.waitForTimeout(3000);
                }
            } catch (_) {
                // noop
            }
        }

        if (interceptedUrl) {
            try {
                interceptedUrl = await normalizeAllowedUrl(interceptedUrl, 'extractor.playwright-stream');
            } catch (e) {
                console.warn(`[Playwright] Blocked intercepted URL ${redactUrlForLogs(interceptedUrl)}: ${e.message}`);
                return null;
            }

            console.log(`[Extractor] Found stream via Playwright: ${redactUrlForLogs(interceptedUrl)}`);
            return {
                success: true,
                videoUrl: interceptedUrl,
                type: interceptedUrl.includes('.m3u8') ? 'hls' : 'mp4',
                source: safeHostname(safeEmbedUrl),
                method: 'playwright',
            };
        }

        return null;
    } catch (e) {
        console.error(`[Playwright] Error for ${redactUrlForLogs(safeEmbedUrl)}: ${e.message}`);
        return null;
    } finally {
        if (browser) {
            try { await browser.close(); } catch (_) { /* noop */ }
        }
    }
}

async function extractStream(url) {
    let safeEmbedUrl;
    try {
        safeEmbedUrl = await normalizeAllowedUrl(url, 'extract-stream');
    } catch (e) {
        return {
            success: false,
            error: e.message,
            source: safeHostname(url),
        };
    }

    const axiosResult = await extractWithAxios(safeEmbedUrl);
    if (axiosResult) return axiosResult;

    const pwResult = await extractWithPlaywright(safeEmbedUrl);
    if (pwResult) return pwResult;

    console.warn(`[Extractor] No stream URL found for: ${redactUrlForLogs(safeEmbedUrl)}`);
    return {
        success: false,
        error: 'Stream URL not found in embed page',
        source: safeHostname(safeEmbedUrl),
    };
}

module.exports = {
    extractStream,
    extractWithAxios,
    extractWithPlaywright,
    getRefererForDomain,
};

