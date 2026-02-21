const { withCache, TTL } = require('../middleware/cache');

function success(res, data, fromCache = false, ttlType = null) {
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    if (ttlType && TTL[ttlType]) {
        res.set('Cache-Control', `public, max-age=${TTL[ttlType]}`);
    }
    res.json({ success: true, ...data });
}

function err(res, message, status = 500) {
    res.status(status).json({ success: false, error: message });
}

async function cached(res, cacheKey, ttlType, scraperFn) {
    try {
        const result = await withCache(cacheKey, ttlType, scraperFn);
        success(res, result.data, result.fromCache, ttlType);
    } catch (e) {
        console.error(`[Route Error] ${e.message}`);
        err(res, `Gagal mengambil data: ${e.message}`);
    }
}

// ── Smart Headers Helper ─────────────────────────────────────
function getSmartHeaders(url) {
    const domain = (() => { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } })();

    const refererMap = {
        turbovid: 'https://turboplay.stream/',
        emturbovid: 'https://turbovip.fun/',
        'turbo.cdn': 'https://turboplay.stream/',
        hydrax: 'https://hydrax.net/',
        filelions: 'https://filelions.live/',
        vidhide: 'https://vidhide.com/',
        streamtape: 'https://streamtape.com/',
        doodstream: 'https://doodstream.com/',
        mp4upload: 'https://mp4upload.com/',
    };

    let referer = (process.env.TARGET_BASE_URL || 'http://45.11.57.31') + '/';
    for (const [key, ref] of Object.entries(refererMap)) {
        if (domain.includes(key)) { referer = ref; break; }
    }

    const origin = (() => { try { return new URL(referer).origin; } catch { return referer; } })();

    return {
        'Referer': referer,
        'Origin': origin,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': '*/*',
    };
}

module.exports = {
    success,
    err,
    cached,
    getSmartHeaders
};
