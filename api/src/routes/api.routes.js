
const express = require('express');
const router = express.Router();
const scraper = require('../scraper/index');
const { cached, err } = require('../utils/response');
const { cacheStats } = require('../middleware/cache');

// For extractLimiter we need to recreate it if used
const rateLimit = require('express-rate-limit');
const extractLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

// ── Routes ──────────────────────────────────────────────────

// Root — redirect to Swagger UI
router.get('/', (req, res) => {
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
router.get('/api/v1/home', (req, res) =>
    cached(res, 'home', 'home', () => scraper.scrapeHomepage())
);

// Latest (alias)
router.get('/api/v1/latest', (req, res) =>
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
router.get('/api/v1/series', (req, res) => {
    const { page = 1, status, type, genre, country, order = 'update' } = req.query;
    const key = `series:p${page}:s${status}:t${type}:g${genre}:c${country}:o${order}`;
    cached(res, key, 'list', () => scraper.scrapeSeriesList({ page: parseInt(page), status, type, genre, country, order }));
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
router.get('/api/v1/ongoing', (req, res) => {
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
router.get('/api/v1/completed', (req, res) => {
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
router.get('/api/v1/series/:slug', (req, res) => {
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
router.get('/api/v1/episode/:slug', (req, res) => {
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
router.get('/api/v1/search', extractLimiter, (req, res) => {
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
router.get('/api/v1/genres', (req, res) =>
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
router.get('/api/v1/genre/:slug', (req, res) => {
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
router.get('/api/v1/country/:name', (req, res) => {
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
router.get('/api/v1/schedule', (req, res) =>
    cached(res, 'schedule', 'meta', () => scraper.scrapeSchedule())
);

// Cache stats
router.get('/api/v1/_cache', (req, res) => res.json(cacheStats()));

// Health
router.get('/health', (req, res) =>
    res.json({ status: 'ok', uptime: Math.floor(process.uptime()), timestamp: new Date().toISOString() })
);

// 404
router.use((req, res) => err(res, `Endpoint tidak ditemukan: ${req.method} ${req.path}`, 404));

// Error handler
router.use((e, req, res, _next) => {
    console.error('[Unhandled]', e);
    err(res, 'Internal Server Error');
});



module.exports = router;
