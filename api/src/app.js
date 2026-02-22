/**
 * OppaDrama Streaming API — Main App
 * Stack: Express.js + Cheerio scraper + NodeCache
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const crypto = require('crypto');
const { withCache, bustCache } = require('./middleware/cache');
const { requireOpsAccess } = require('./middleware/opsAuth');
const {
    getProxyAllowlist,
    validateOutboundUrl,
    requestWithValidatedRedirects,
    redactUrlForLogs,
    sanitizeRequestUrlForLogs,
} = require('./security/urlGuard');
const { extractStream, getRefererForDomain } = require('./scraper/extractor');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Swagger / OpenAPI ────────────────────────────────────────
const swaggerSpec = swaggerJsdoc({
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'FikDrama API',
            version: '1.0.0',
            description: `REST API untuk data drama & film Asia dari **FikDrama**.
Scraper berbasis Cheerio yang mengambil data dari sumber eksternal dengan caching otomatis.

**Base URL Production:** \`https://your-api.koyeb.app/api/v1\`

**Cache TTL:**
| Endpoint | Cache |
|---|---|
| /home | 5 menit |
| /series, /country, /genre | 30 menit |
| /series/:slug | 30 menit |
| /episode/:slug | 1 jam |
| /search | 10 menit |`,
            contact: { name: 'fikfadillah', url: 'https://github.com/fikfadillah' },
            license: { name: 'MIT' },
        },
        servers: [
            { url: '/api/v1', description: 'Current server' },
        ],
        tags: [
            { name: 'Home', description: 'Data homepage' },
            { name: 'Series', description: 'Daftar dan detail series' },
            { name: 'Episode', description: 'Data episode & server video' },
            { name: 'Filter', description: 'Filter by genre, country, status' },
            { name: 'Search', description: 'Pencarian konten' },
            { name: 'Schedule', description: 'Jadwal tayang' },
            { name: 'Player', description: 'Video player proxy' },
        ],
        components: {
            schemas: {
                SeriesItem: {
                    type: 'object',
                    properties: {
                        title: { type: 'string', example: 'My Holo Love' },
                        slug: { type: 'string', example: 'my-holo-love' },
                        posterUrl: { type: 'string', format: 'uri', example: 'https://example.com/poster.jpg' },
                        rating: { type: 'number', nullable: true, example: 8.2 },
                        type: { type: 'string', enum: ['Drama', 'Movie', 'Animation', 'TV Show'], example: 'Drama' },
                        status: { type: 'string', enum: ['Ongoing', 'Completed'], nullable: true, example: 'Completed' },
                        year: { type: 'string', nullable: true, example: '2020' },
                        genres: { type: 'array', items: { type: 'string' }, example: ['Romance', 'Sci-Fi'] },
                        url: { type: 'string', format: 'uri' },
                    },
                },
                Pagination: {
                    type: 'object',
                    properties: {
                        page: { type: 'integer', example: 1 },
                        totalPages: { type: 'integer', example: 5 },
                        hasNext: { type: 'boolean', example: true },
                    },
                },
                ListResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        items: { type: 'array', items: { $ref: '#/components/schemas/SeriesItem' } },
                        pagination: { $ref: '#/components/schemas/Pagination' },
                    },
                },
                Error: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        error: { type: 'string', example: 'Something went wrong' },
                    },
                },
            },
        },
    },
    apis: ['./src/app.js'],
});

// ── Middleware ──────────────────────────────────────────────
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    frameguard: { action: 'sameorigin' },
    referrerPolicy: { policy: 'no-referrer' },
    contentSecurityPolicy: {
        useDefaults: false,
        directives: {
            defaultSrc: ['\'none\''],
            baseUri: ['\'none\''],
            formAction: ['\'none\''],
            frameAncestors: ['\'none\''],
            objectSrc: ['\'none\''],
        },
    },
}));
const allowedOrigins = [
    'https://fikflix.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
];

function parseOrigins(originsRaw) {
    if (!originsRaw) return [];
    return originsRaw
        .split(',')
        .map((o) => o.trim())
        .filter((o) => /^https?:\/\/[^/\s]+$/i.test(o));
}

const envOrigins = parseOrigins(process.env.CORS_ORIGINS || '');
const allowAnyOrigin = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .includes('*');
const allAllowedOrigins = [...new Set([...allowedOrigins, ...envOrigins])];
const frameAncestorsList = parseOrigins(process.env.PLAYER_FRAME_ANCESTORS || '');
const frameAncestors = ['\'self\'', ...new Set(frameAncestorsList.length ? frameAncestorsList : allAllowedOrigins)].join(' ');
const proxyAllowlist = getProxyAllowlist();

function getAllowedOrigin(origin) {
    if (!origin) return '*';
    if (allowAnyOrigin || allAllowedOrigins.includes(origin)) {
        return origin;
    }
    return false;
}

app.use(cors({
    origin: function (origin, callback) {
        if (getAllowedOrigin(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS Error: Origin ${origin} is not allowed`));
        }
    },
    methods: ['GET', 'OPTIONS'],
    credentials: true,
}));
morgan.token('safe-url', (req) => sanitizeRequestUrlForLogs(req.originalUrl || req.url || ''));
app.use(morgan('[:date[iso]] :method :safe-url :status :response-time ms'));
app.use(express.json());

// ── Swagger UI ───────────────────────────────────────────────
const swaggerUiOptions = {
    customCss: `
        .swagger-ui { font-family: 'Inter', sans-serif; }
        .swagger-ui .topbar { background: #0a0a0f; border-bottom: 1px solid #1e1e2e; }
        .swagger-ui .topbar-wrapper img { display: none; }
        .swagger-ui .topbar-wrapper::before { content: '🎬 FikDrama API'; font-size: 1.2rem; font-weight: 700; color: #f5c518; }
        body { background: #0a0a0f; }
        .swagger-ui .scheme-container { background: #0d0d1a; }
        .swagger-ui .opblock.opblock-get .opblock-summary { border-color: #3b82f6; }
        .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #3b82f6; }
    `,
    customSiteTitle: 'FikDrama API Docs',
    swaggerOptions: { persistAuthorization: true, defaultModelsExpandDepth: 2, defaultModelExpandDepth: 2 },
};
function applyDocsSecurityHeaders(req, res, next) {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    );
    next();
}
app.use('/docs', requireOpsAccess, applyDocsSecurityHeaders, swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
app.get('/docs.json', requireOpsAccess, applyDocsSecurityHeaders, (req, res) => res.json(swaggerSpec));


// ── Smart Headers Helper ─────────────────────────────────────
// Detects the video CDN domain and returns the correct Referer + Origin
// so upstream servers don't reject us for wrong Referer
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

// ── Player Proxy ─────────────────────────────────────────────
// Serve HTML wrapper dengan no-referrer meta → bypass domain whitelist check streaming server
function applyPlayerProxyHeaders(req, res, next) {
    // Player proxy is intentionally embeddable by trusted frontend origins.
    res.removeHeader('X-Frame-Options');
    res.setHeader(
        'Content-Security-Policy',
        `default-src 'none'; style-src 'unsafe-inline'; frame-src https: http:; frame-ancestors ${frameAncestors}; base-uri 'none'; form-action 'none'`
    );
    next();
}

app.get('/api/v1/player-proxy', applyPlayerProxyHeaders, async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    if (!rawUrl) return res.status(400).send('Missing url parameter');

    let parsedUrl;
    try {
        parsedUrl = await validateOutboundUrl(rawUrl, { context: 'player-proxy', allowlist: proxyAllowlist });
    } catch (e) {
        return res.status(400).send(e.message);
    }

    console.log(`[Proxy] Serving player for: ${parsedUrl.hostname}`);

    const safeUrl = parsedUrl.toString().replace(/'/g, '%27');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="referrer" content="no-referrer">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
    iframe { width: 100%; height: 100%; border: none; }
  </style>
</head>
<body>
  <iframe src='${safeUrl}'
    allowfullscreen
    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
    referrerpolicy="no-referrer"
  ></iframe>
</body>
</html>`);
});

// ── Stream Extractor ──────────────────────────────────────────
// Two-tier: Axios+regex first, optional Playwright stealth fallback
// Helper untuk validasi URL m3u8 masih hidup (HEAD request)
async function isStreamAlive(url, referer) {
    try {
        const { response } = await requestWithValidatedRedirects({
            method: 'head',
            url,
            timeout: 5000,
            maxRedirects: 3,
            headers: {
                'Referer': referer,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            },
            validateStatus: (status) => status === 200 || status === 206,
        }, {
            context: 'stream-revalidate',
            allowlist: proxyAllowlist,
        });
        return response.status === 200 || response.status === 206;
    } catch (e) {
        console.warn(`[Cache] Stream URL dead: ${redactUrlForLogs(url)} (${e.message})`);
        return false;
    }
}

app.get('/api/v1/extract-stream', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    if (!rawUrl) return res.status(400).json({ success: false, error: 'Missing url' });

    let parsedUrl;
    try {
        parsedUrl = await validateOutboundUrl(rawUrl, { context: 'extract-stream', allowlist: proxyAllowlist });
    } catch (e) {
        return res.status(400).json({ success: false, error: e.message });
    }
    const normalizedUrl = parsedUrl.toString();

    // Cache key: MD5 hash of the original embed URL (unique per episode & server)
    const urlHash = crypto.createHash('md5').update(normalizedUrl).digest('hex');
    const cacheKey = `stream:${urlHash}`;

    // TTL 30 menit (1800s) — cukup aman untuk TurboVIP
    try {
        const result = await withCache(cacheKey, 'detail', async () => {
            // Function ini HANYA dipanggil jika cache kosong (MISS)
            const extracted = await extractStream(normalizedUrl);
            if (!extracted || !extracted.success) {
                throw new Error(extracted?.error || 'Stream not found');
            }
            return extracted;
        });

        // Validasi: Jika dari cache, pastikan URL .m3u8 masih hidup
        if (result.fromCache && result.data.success && result.data.videoUrl) {
            const isAlive = await isStreamAlive(result.data.videoUrl, getRefererForDomain(normalizedUrl));
            if (!isAlive) {
                // Cache expired/invalidated, bust cache and retry WITHOUT cache
                console.log(`[Cache] Purging stale stream URL for ${redactUrlForLogs(normalizedUrl)}`);
                bustCache(cacheKey);

                // Re-extract synchronously
                const freshExtracted = await extractStream(normalizedUrl);
                if (freshExtracted && freshExtracted.success) {
                    res.set('X-Cache', 'REVALIDATED');
                    return res.json(freshExtracted);
                } else {
                    return res.status(502).json(freshExtracted || { success: false, error: 'Re-extraction failed' });
                }
            }
        }

        res.set('X-Cache', result.fromCache ? 'HIT' : 'MISS');
        return res.json(result.data);

    } catch (e) {
        console.error(`[Extract] Error for ${redactUrlForLogs(normalizedUrl)}: ${e.message}`);
        // Jika Playwright gagal/timeout atau tidak ditemukan
        res.set('X-Cache', 'MISS');
        return res.status(502).json({ success: false, error: e.message, source: parsedUrl.hostname });
    }
});

// ── HLS Stream Proxy ──────────────────────────────────────────
// Proxy m3u8 / TS chunks dengan STREAMING PIPE — tidak buffer ke memori
// Explicit CORS preflight agar hls.js bisa kirim Range header
app.options('/api/v1/stream-proxy', (req, res) => {
    const allowedOrigin = getAllowedOrigin(req.headers.origin);
    if (!allowedOrigin) return res.status(403).end();

    res.set({
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type, Accept',
        'Access-Control-Expose-Headers': 'Content-Range, Content-Length',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
    });
    res.sendStatus(204);
});

app.get('/api/v1/stream-proxy', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    if (!rawUrl) return res.status(400).send('Missing url');

    let parsedUrlSP;
    try {
        parsedUrlSP = await validateOutboundUrl(rawUrl, { context: 'stream-proxy', allowlist: proxyAllowlist });
    } catch (e) {
        return res.status(400).send(e.message);
    }
    const normalizedUrl = parsedUrlSP.toString();

    // CORS headers untuk setiap respons
    const allowedOrigin = getAllowedOrigin(req.headers.origin);
    if (!allowedOrigin) return res.status(403).send('Origin not allowed by CORS');

    const corsHeaders = {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type',
        'Access-Control-Expose-Headers': 'Content-Range, Content-Length',
        'Access-Control-Allow-Credentials': 'true',
    };

    const smartHeaders = getSmartHeaders(normalizedUrl);
    const isM3u8Url = /\.m3u8($|\?)/i.test(parsedUrlSP.pathname + parsedUrlSP.search);

    try {
        if (isM3u8Url) {
            // ── M3U8: baca teks dan rewrite URL → buffer kecil OK
            const { response: upstream, finalUrl } = await requestWithValidatedRedirects({
                method: 'get',
                url: normalizedUrl,
                timeout: 15000,
                responseType: 'text',
                headers: smartHeaders,
                maxRedirects: 5,
            }, {
                context: 'stream-proxy.m3u8',
                allowlist: proxyAllowlist,
            });

            let m3u8Text = typeof upstream.data === 'string' ? upstream.data : String(upstream.data || '');
            const baseUrl = new URL('.', finalUrl).toString();

            const toProxy = (raw) => `/api/v1/stream-proxy?url=${encodeURIComponent(raw)}`;
            const resolve = (line) => {
                try {
                    return new URL(line, baseUrl).toString();
                } catch {
                    return line;
                }
            };

            // Rewrite URI= di tag #EXT-X-KEY dan #EXT-X-MAP (untuk enkripsi AES-128)
            m3u8Text = m3u8Text.replace(/(URI=")([^"]+)(")/g, (_m, open, uri, close) =>
                open + toProxy(resolve(uri)) + close
            );

            // Rewrite baris segment (tidak dimulai '#', tidak kosong)
            m3u8Text = m3u8Text.replace(/^(?!#)([^\r\n]+)$/gm, (line) => {
                const trimmed = line.trim();
                if (!trimmed) return line;
                return toProxy(resolve(trimmed));
            });

            res.set(corsHeaders);
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.setHeader('Cache-Control', 'no-cache, no-store');
            return res.send(m3u8Text);
        }

        // ── Segmen TS / MP4: gunakan STREAMING PIPE agar tidak buffer di memory
        const forwardedRange = req.headers.range;
        const { response: upstream } = await requestWithValidatedRedirects({
            method: 'get',
            url: normalizedUrl,
            timeout: 30000,
            responseType: 'stream',
            maxRedirects: 5,
            headers: {
                ...smartHeaders,
                'Accept-Encoding': 'identity', // hindari gzip agar byte tetap raw
                ...(forwardedRange ? { Range: forwardedRange } : {}),
            },
            validateStatus: (status) => status === 200 || status === 206,
        }, {
            context: 'stream-proxy.segment',
            allowlist: proxyAllowlist,
        });

        const upstreamCT = (upstream.headers['content-type'] || '').toLowerCase();

        // Deteksi content-type yang benar
        let contentType = upstreamCT;
        if (!contentType || contentType.includes('image') || contentType.includes('octet-stream') ||
            contentType.includes('plain') || contentType.includes('html')) {
            if (normalizedUrl.includes('.mp4')) {
                contentType = 'video/mp4';
            } else {
                contentType = 'video/mp2t'; // default aman untuk segmen HLS
            }
        }

        res.set(corsHeaders);
        res.status(upstream.status);
        res.setHeader('Content-Type', contentType);
        // Cache segmen lebih lama — segmen HLS tidak berubah
        res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=600');

        // Forward Content-Length jika ada (membantu browser progress bar)
        if (upstream.headers['content-length']) {
            res.setHeader('Content-Length', upstream.headers['content-length']);
        }
        if (upstream.headers['content-range']) {
            res.setHeader('Content-Range', upstream.headers['content-range']);
        }

        // Pipe stream langsung ke response — zero copy buffer
        upstream.data.pipe(res);

        // Tangani error saat streaming berlangsung
        upstream.data.on('error', (e) => {
            console.error(`[StreamProxy] Pipe error: ${e.message}`);
            if (!res.headersSent) res.status(502).send('Stream pipe error');
        });

    } catch (e) {
        console.error(`[StreamProxy] Error for ${redactUrlForLogs(rawUrl)}: ${e.message}`);
        if (!res.headersSent) res.status(502).send(`Upstream error: ${e.message}`);
    }
});

// Global rate limit — DIKECUALIKAN /stream-proxy karena HLS butuh 30-100+ req/video
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
// Terapkan hanya pada endpoint non-stream
app.use('/api/v1/home', limiter);
app.use('/api/v1/series', limiter);
app.use('/api/v1/episode', limiter);
app.use('/api/v1/search', limiter);
app.use('/api/v1/genre', limiter);
app.use('/api/v1/country', limiter);
app.use('/api/v1/schedule', limiter);
app.use('/api/v1/genres', limiter);
app.use('/api/v1/ongoing', limiter);
app.use('/api/v1/completed', limiter);
// extract-stream: batas lebih ketat karena bisa mahal (fetch halaman external)
const extractLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
app.use('/api/v1/extract-stream', extractLimiter);


// ── Routes ──────────────────────────────────────────────────
app.use('/', require('./routes/api.routes'));

// ── Start ───────────────────────────────────────────────────
// Hanya jalankan server jika file ini dieksekusi langsung (bukan di-import oleh module lain, e.g. Vercel)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`
╔════════════════════════════════════════════════════╗
║          FikDrama Streaming API v2.0               ║
╠════════════════════════════════════════════════════╣
║  Server  : http://localhost:${PORT}                  ║
║  Swagger : http://localhost:${PORT}/docs             ║
║  Spec    : http://localhost:${PORT}/docs.json        ║
╚════════════════════════════════════════════════════╝
`);
    });
}

// Graceful shutdown
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

// Export untuk Vercel Serverless
module.exports = app;
