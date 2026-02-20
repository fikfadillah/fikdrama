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

const scraper = require('./scraper/index');
const { withCache, cacheStats } = require('./middleware/cache');

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
    // Izinkan halaman proxy kita di-embed dalam iframe
    frameguard: false,
    contentSecurityPolicy: false,
}));
app.use(cors({
    origin: process.env.CORS_ORIGINS?.split(',') || '*',
    methods: ['GET', 'OPTIONS'],
}));
app.use(morgan('[:date[iso]] :method :url :status :response-time ms'));
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
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
app.get('/docs.json', (req, res) => res.json(swaggerSpec));


// ── Player Proxy ─────────────────────────────────────────────
// Serve HTML wrapper dengan no-referrer meta → bypass domain whitelist check streaming server
app.get('/api/v1/player-proxy', (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send('Missing url parameter');

    // Validasi: hanya izinkan http/https URL
    let parsedUrl;
    try {
        parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return res.status(400).send('Only http/https URLs allowed');
        }
    } catch {
        return res.status(400).send('Invalid URL');
    }

    console.log(`[Proxy] Serving player for: ${parsedUrl.hostname}`);

    // Alih-alih membungkus iframe dengan iframe (yang sering membuat browser
    // nge-block request fullscreen anak), kita cukup me-redirect-nya.
    // Karena tag <iframe> di frontend (Watch.jsx) sudah dibekali properti
    // referrerPolicy="no-referrer", Hydrax tetap tidak akan mendeteksi dari mana usul asal requestnya.
    res.redirect(url);
});

// ── Stream Extractor ──────────────────────────────────────────
// Fetch embed page server-side dengan Referer oppadrama, cari URL video m3u8/mp4
const axios = require('axios');
const TARGET = process.env.TARGET_BASE_URL || 'http://45.11.57.31';

app.get('/api/v1/extract-stream', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ success: false, error: 'Missing url' });

    try {
        const parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return res.status(400).json({ success: false, error: 'Invalid URL' });
        }

        // Fetch embed page dengan headers yang menyerupai request dari oppadrama
        const resp = await axios.get(url, {
            timeout: 15000,
            headers: {
                'Referer': TARGET + '/',
                'Origin': TARGET,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
        });

        const html = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);

        // ── Cari URL video di dalam HTML ─────────────────────────────
        const patterns = [
            // HLS m3u8
            /["'](https?:\/\/[^"']+\.m3u8[^"']*?)["']/i,
            // MP4 direct
            /["'](https?:\/\/[^"']+\.mp4[^"']*?)["']/i,
            // JWPlayer file
            /file\s*:\s*["'](https?:\/\/[^"']+)["']/i,
            // Playerjs / Plyr sources
            /sources\s*:\s*\[\s*\{[^}]*?file\s*:\s*["'](https?:\/\/[^"']+)["']/is,
            // data-url
            /data-url=["'](https?:\/\/[^"']+)["']/i,
            // EarnVids vjsJwxData
            /vjsJwxData\s*=\s*[^;]*?sources.*?file\s*:\s*["'](https?:\/\/[^"']+)["']/is,
            // Generic: any hls URL-like
            /["'](https?:\/\/[^"'\s]+\/[^"'\s]+\.m3u8(?:\?[^"'\s]*)?)["']/i,
        ];

        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                const videoUrl = match[1].trim();
                console.log(`[Extract] Found stream: ${videoUrl.substring(0, 80)}`);
                return res.json({
                    success: true,
                    videoUrl,
                    type: videoUrl.includes('.m3u8') ? 'hls' : 'mp4',
                    source: parsedUrl.hostname,
                });
            }
        }

        // Tidak ditemukan
        console.warn(`[Extract] No stream URL found in: ${url}`);
        res.json({ success: false, error: 'Stream URL not found in embed page', source: parsedUrl.hostname });
    } catch (e) {
        console.error(`[Extract] Failed: ${e.message}`);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ── HLS Stream Proxy ──────────────────────────────────────────
// Proxy m3u8 / TS chunks dengan Referer yang benar agar tidak kena CORS
app.get('/api/v1/stream-proxy', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send('Missing url');

    try {
        new URL(url); // validate

        const upstream = await axios.get(url, {
            timeout: 30000,
            responseType: 'arraybuffer',
            headers: {
                'Referer': TARGET + '/',
                'Origin': TARGET,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': '*/*',
            },
        });

        const upstreamCT = (upstream.headers['content-type'] || '').toLowerCase();

        // Deteksi m3u8: dari URL atau Content-Type upstream
        const isM3u8 = url.includes('.m3u8') ||
            upstreamCT.includes('mpegurl') ||
            upstreamCT.includes('m3u8');

        if (isM3u8) {
            let m3u8Text = Buffer.from(upstream.data).toString('utf-8');
            const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);

            const toProxy = (raw) => `/api/v1/stream-proxy?url=${encodeURIComponent(raw)}`;
            const resolve = (line) => line.startsWith('http') ? line : baseUrl + line;

            // Rewrite URI= di tag #EXT-X-KEY dan #EXT-X-MAP (untuk enkripsi AES)
            m3u8Text = m3u8Text.replace(/(URI=")([^"]+)(")/g, (_m, open, uri, close) =>
                open + toProxy(resolve(uri)) + close
            );

            // Rewrite segment lines (baris yang tidak dimulai '#')
            m3u8Text = m3u8Text.replace(/^(?!#)([^\r\n]+)$/gm, (line) => {
                const trimmed = line.trim();
                if (!trimmed) return line;
                return toProxy(resolve(trimmed));
            });

            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'no-cache');
            return res.send(m3u8Text);
        }

        // Segmen media — deteksi tipe dari Content-Type upstream dan magic bytes.
        // Beberapa CDN menyamarkan segmen TS sebagai .png atau tipe lain (anti-scraping).
        const buf = Buffer.from(upstream.data);
        let contentType = upstreamCT;

        if (!contentType || contentType.includes('image') || contentType.includes('octet-stream') || contentType.includes('plain')) {
            // TS sync byte = 0x47, dan paket TS selalu 188 bytes
            if (buf.length > 0 && buf[0] === 0x47) {
                contentType = 'video/mp2t';
                console.log(`[StreamProxy] Detected TS via magic byte for: ${url.substring(0, 80)}`);
            } else if (url.includes('.mp4') || upstreamCT.includes('mp4')) {
                contentType = 'video/mp4';
            } else {
                contentType = 'video/mp2t'; // safe default untuk HLS segment
            }
        }

        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'max-age=300');
        res.send(buf);
    } catch (e) {
        console.error(`[StreamProxy] Error: ${e.message}`);
        res.status(502).send(`Upstream error: ${e.message}`);
    }
});

// Global rate limit
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
app.use('/api/', limiter);

// Stricter untuk search
const searchLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

// ── Helper ──────────────────────────────────────────────────
function success(res, data, fromCache = false) {
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, ...data });
}

function err(res, message, status = 500) {
    res.status(status).json({ success: false, error: message });
}

async function cached(res, cacheKey, ttlType, scraperFn) {
    try {
        const result = await withCache(cacheKey, ttlType, scraperFn);
        success(res, result.data, result.fromCache);
    } catch (e) {
        console.error(`[Route Error] ${e.message}`);
        err(res, `Gagal mengambil data: ${e.message}`);
    }
}

// ── Routes ──────────────────────────────────────────────────

// Root — redirect to Swagger UI
app.get('/', (req, res) => {
    res.json({
        name: 'FikDrama API',
        version: '2.0.0',
        docs: `/docs`,
        spec: `/docs.json`,
        health: `/health`,
    });
});



/**
 * @openapi
 * /home:
 *   get:
 *     tags: [Home]
 *     summary: Data homepage
 *     description: Mengembalikan daftar konten featured (hero) dan update terbaru untuk homepage.
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 featured:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/SeriesItem' }
 *                 latest:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/SeriesItem' }
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
app.get('/api/v1/home', (req, res) =>
    cached(res, 'home', 'home', () => scraper.scrapeHomepage())
);

// Latest (alias)
app.get('/api/v1/latest', (req, res) =>
    cached(res, 'home', 'home', () => scraper.scrapeHomepage())
);

/**
 * @openapi
 * /series:
 *   get:
 *     tags: [Series]
 *     summary: Daftar semua series
 *     description: Mengambil daftar series dengan filter opsional. Mendukung paginasi.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Nomor halaman
 *       - in: query
 *         name: type[]
 *         schema: { type: string, enum: [Drama, Movie, Animation, 'TV Show'] }
 *         description: Filter berdasarkan tipe konten
 *       - in: query
 *         name: status[]
 *         schema: { type: string, enum: [Ongoing, Completed] }
 *         description: Filter berdasarkan status tayang
 *       - in: query
 *         name: order
 *         schema: { type: string, enum: [update, title, rating], default: update }
 *         description: Urutan hasil
 *     responses:
 *       200:
 *         description: Daftar series berhasil diambil
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ListResponse' }
 */
app.get('/api/v1/series', (req, res) => {
    const { page = 1, status, type, order = 'update' } = req.query;
    const key = `series:p${page}:s${status}:t${type}:o${order}`;
    cached(res, key, 'list', () => scraper.scrapeSeriesList({ page: parseInt(page), status, type, order }));
});

/**
 * @openapi
 * /ongoing:
 *   get:
 *     tags: [Filter]
 *     summary: Sedang tayang
 *     description: Daftar series dengan status Ongoing (sedang tayang).
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ListResponse' }
 */
app.get('/api/v1/ongoing', (req, res) => {
    const { page = 1 } = req.query;
    const key = `ongoing:p${page}`;
    cached(res, key, 'list', () => scraper.scrapeSeriesList({ page: parseInt(page), status: 'Ongoing' }));
});

/**
 * @openapi
 * /completed:
 *   get:
 *     tags: [Filter]
 *     summary: Sudah tamat
 *     description: Daftar series dengan status Completed (sudah tamat).
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ListResponse' }
 */
app.get('/api/v1/completed', (req, res) => {
    const { page = 1 } = req.query;
    const key = `completed:p${page}`;
    cached(res, key, 'list', () => scraper.scrapeSeriesList({ page: parseInt(page), status: 'Completed' }));
});

/**
 * @openapi
 * /series/{slug}:
 *   get:
 *     tags: [Series]
 *     summary: Detail series
 *     description: Mengambil detail lengkap sebuah series termasuk sinopsis, genre, cast, dan daftar episode.
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *         example: my-holo-love
 *         description: Slug URL series
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     title: { type: string }
 *                     slug: { type: string }
 *                     synopsis: { type: string }
 *                     posterUrl: { type: string }
 *                     rating: { type: number }
 *                     genres: { type: array, items: { type: string } }
 *                     episodes: { type: array, items: { type: object } }
 *       404:
 *         description: Series tidak ditemukan
 */
app.get('/api/v1/series/:slug', (req, res) => {
    const { slug } = req.params;
    cached(res, `detail:${slug}`, 'detail', () => scraper.scrapeSeriesDetail(slug));
});

/**
 * @openapi
 * /episode/{slug}:
 *   get:
 *     tags: [Episode]
 *     summary: Data episode & server video
 *     description: Mengambil data episode termasuk server streaming yang tersedia (TurboVIP, Hydrax, FileLions, dll).
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *         example: my-holo-love-episode-1
 *         description: Slug URL episode
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     title: { type: string }
 *                     servers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name: { type: string, example: TurboVIP }
 *                           url: { type: string, format: uri }
 */
app.get('/api/v1/episode/:slug', (req, res) => {
    const { slug } = req.params;
    cached(res, `episode:${slug}`, 'episode', () => scraper.scrapeEpisodePage(slug));
});

/**
 * @openapi
 * /search:
 *   get:
 *     tags: [Search]
 *     summary: Cari konten
 *     description: Mencari drama/film berdasarkan judul. Rate limited 30 request/menit per IP.
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         example: "my holo love"
 *         description: Kata kunci pencarian
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200:
 *         description: Hasil pencarian
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ListResponse' }
 *       400:
 *         description: Parameter q kosong
 *       429:
 *         description: Terlalu banyak request
 */
app.get('/api/v1/search', searchLimiter, (req, res) => {
    const { q, page = 1 } = req.query;
    if (!q || !q.trim()) return err(res, 'Parameter "q" diperlukan', 400);
    const key = `search:${q}:p${page}`;
    cached(res, key, 'search', () => scraper.scrapeSearch(q.trim(), parseInt(page)));
});

/**
 * @openapi
 * /genres:
 *   get:
 *     tags: [Filter]
 *     summary: Daftar semua genre
 *     description: Mengembalikan daftar semua genre yang tersedia beserta slug-nya.
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 genres:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name: { type: string, example: Romance }
 *                       slug: { type: string, example: romance }
 *                       url: { type: string }
 */
app.get('/api/v1/genres', (req, res) =>
    cached(res, 'genres', 'meta', () => scraper.scrapeGenres())
);

/**
 * @openapi
 * /genre/{slug}:
 *   get:
 *     tags: [Filter]
 *     summary: Filter by genre
 *     description: Mengambil daftar series berdasarkan genre tertentu.
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *         example: romance
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ListResponse' }
 */
app.get('/api/v1/genre/:slug', (req, res) => {
    const { slug } = req.params;
    const { page = 1 } = req.query;
    const key = `genre:${slug}:p${page}`;
    cached(res, key, 'list', () => scraper.scrapeFilterPage(`/genres/${slug}/`, parseInt(page)));
});

/**
 * @openapi
 * /country/{name}:
 *   get:
 *     tags: [Filter]
 *     summary: Filter by negara
 *     description: Mengambil daftar series berdasarkan negara asal. Opsional filter tipe konten.
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema: { type: string }
 *         example: south-korea
 *         description: Slug nama negara (e.g. south-korea, china, japan)
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [Drama, Movie, Animation, 'TV Show'] }
 *         description: Filter tipe konten dari negara ini
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ListResponse' }
 */
app.get('/api/v1/country/:name', (req, res) => {
    const { name } = req.params;
    const { page = 1, type } = req.query;
    if (type) {
        const key = `country:${name}:t${type}:p${page}`;
        cached(res, key, 'list', () => scraper.scrapeSeriesList({ country: name.toLowerCase(), type, page: parseInt(page) }));
    } else {
        const key = `country:${name}:p${page}`;
        cached(res, key, 'list', () => scraper.scrapeFilterPage(`/country/${name.toLowerCase()}/`, parseInt(page)));
    }
});

/**
 * @openapi
 * /schedule:
 *   get:
 *     tags: [Schedule]
 *     summary: Jadwal tayang
 *     description: Mengembalikan jadwal tayang series per hari dalam seminggu.
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 schedule:
 *                   type: object
 *                   description: Key = nama hari (Monday, Tuesday, ...)
 *                   additionalProperties:
 *                     type: array
 *                     items: { $ref: '#/components/schemas/SeriesItem' }
 */
app.get('/api/v1/schedule', (req, res) =>
    cached(res, 'schedule', 'meta', () => scraper.scrapeSchedule())
);

// Cache stats
app.get('/api/v1/_cache', (req, res) => res.json(cacheStats()));

// Health
app.get('/health', (req, res) =>
    res.json({ status: 'ok', uptime: Math.floor(process.uptime()), timestamp: new Date().toISOString() })
);

// 404
app.use((req, res) => err(res, `Endpoint tidak ditemukan: ${req.method} ${req.path}`, 404));

// Error handler
app.use((e, req, res, _next) => {
    console.error('[Unhandled]', e);
    err(res, 'Internal Server Error');
});

// ── Start ───────────────────────────────────────────────────
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

// Graceful shutdown
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
