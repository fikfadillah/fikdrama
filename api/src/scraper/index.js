/**
 * OppaDrama Scraper v2
 * Mengambil data dari http://45.11.57.31 (OPPADRAMA)
 * Arsitektur: live scraping + in-memory cache
 */

const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = process.env.TARGET_BASE_URL || 'http://45.11.57.31';
const DELAY_MS = parseInt(process.env.REQUEST_DELAY_MS) || 800;
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || 3;

const client = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Referer': BASE_URL,
    },
});

/**
 * Helper: delay
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Helper: HTTP request dengan retry
 */
async function request(url, retries = 0) {
    try {
        await sleep(DELAY_MS);
        const response = await client.get(url);
        return response.data;
    } catch (err) {
        if (retries < MAX_RETRIES) {
            const wait = (retries + 1) * 2000;
            console.warn(`[Scraper] Retry ${retries + 1}/${MAX_RETRIES} for ${url} in ${wait}ms`);
            await sleep(wait);
            return request(url, retries + 1);
        }
        throw new Error(`Request failed for ${url}: ${err.message}`);
    }
}

/**
 * Helper: extract slug dari URL
 */
function extractSlug(url) {
    if (!url) return '';
    return url.replace(BASE_URL, '').replace(/^\/|\/$/g, '').split('/')[0] || '';
}

/**
 * Helper: extract kualitas dari teks
 */
function extractQuality(text) {
    const qs = ['2160p', '1080p', '720p', '480p', '360p', 'FHD', 'HD', 'SD'];
    return qs.find((q) => text.includes(q)) || 'Unknown';
}

/**
 * Helper: detect server name dari URL
 */
function detectServer(url) {
    try {
        const domain = new URL(url).hostname.toLowerCase();
        const map = {
            turbovid: 'TurboVIP',
            emturbovid: 'TurboVIP',
            hydrax: 'Hydrax',
            filelions: 'FileLions',
            vidhide: 'VidHide',
            streamtape: 'StreamTape',
            doodstream: 'DoodStream',
            mp4upload: 'MP4Upload',
        };
        for (const [key, name] of Object.entries(map)) {
            if (domain.includes(key)) return name;
        }
        return domain.split('.')[0] || 'Unknown';
    } catch {
        return 'Unknown';
    }
}

/**
 * Parse card item dari listupd
 */
function parseCard($, elem) {
    const $e = $(elem);
    const $a = $e.find('a').first();
    const href = $a.attr('href') || '';
    const slug = extractSlug(href);

    // Priority: anchor title attr > inner h2/h3 > clean up .tt text manually > fallback to slug
    let title = $a.attr('title');
    if (!title) {
        // Optimize: skip cloning, just grab direct text nodes
        title = $e.find('.tt, .title, h2, h3').first().contents().filter((_, el) => el.type === 'text').text().trim();
    }
    if (!title) {
        title = $e.find('.tt h2, h2, h3, .title').first().text().trim();
    }
    if (!title) {
        title = slug.replace(/-/g, ' ');
    }
    const posterRaw = $e.find('img').first().attr('data-src') || $e.find('img').first().attr('src') || '';
    const poster = posterRaw.replace('http://', 'https://');
    const rating = parseFloat($e.find('.numscore, .rating').text()) || null;
    const type = $e.find('.typez, .type').text().trim().toLowerCase() || null;
    const status = $e.find('.status').text().trim().toLowerCase() || null;
    const year = $e.find('.year, .date').text().match(/\d{4}/)?.[0] || null;
    const duration = $e.find('.duration, .time').text().trim() || null;
    const genres = [];
    $e.find('.genres a, .genre a').each((_, g) => genres.push($(g).text().trim()));

    return { title, slug, posterUrl: poster, rating, type, status, year, duration, genres, url: href };
}

// =====================================================
//  Scraper functions
// =====================================================

/**
 * Scrape homepage — latest episode updates
 */
async function scrapeHomepage() {
    const html = await request('/');
    const $ = cheerio.load(html);

    const latest = [];
    $('.listupd .bs, .bs').each((_, elem) => {
        const card = parseCard($, elem);
        if (card.slug) latest.push(card);
    });

    // Ambil spotlight / featured jika ada
    const featured = [];
    $('.featured .bs, .hns .bs, .slid .bs').each((_, elem) => {
        const card = parseCard($, elem);
        if (card.slug) featured.push(card);
    });

    return { featured, latest };
}

/**
 * Scrape daftar series dengan filter
 * @param {Object} opts - { page, status, type, country, order }
 */
async function scrapeSeriesList(opts = {}) {
    const { page = 1, status, type, country, genre, order = 'update' } = opts;

    let path = `/series/?page=${page}&order=${order}`;
    if (status) path += `&status[]=${encodeURIComponent(status)}`;
    if (type) path += `&type[]=${encodeURIComponent(type)}`;
    if (country) path += `&country=${encodeURIComponent(country)}`;
    if (genre) path += `&genre[0]=${encodeURIComponent(genre)}`;

    console.log(`[Scraper] Fetching list: ${path}`);
    const html = await request(path);
    const $ = cheerio.load(html);

    const items = [];
    $('.listupd .bs, .bs').each((_, elem) => {
        const card = parseCard($, elem);
        if (card.slug) items.push(card);
    });

    // Pagination — source uses .hpage with "Selanjutnya" (?page=N) link, no numbered pages
    let lastPage = page;
    const hpageHref = $('.hpage a').attr('href') || '';
    const nextMatch = hpageHref.match(/[?&]page=(\d+)/);
    if (nextMatch) lastPage = parseInt(nextMatch[1]);
    const hasNext = !!nextMatch;

    return { items, pagination: { page, totalPages: Math.max(page, lastPage), hasNext } };
}

/**
 * Scrape halaman genre/country/filter with ?page=N pagination
 */
async function scrapeFilterPage(path, page = 1) {
    // Build URL: for page > 1 add ?page=N, for page 1 keep clean URL
    const sep = path.includes('?') ? '&' : '?';
    const fullPath = page > 1 ? `${path}${sep}page=${page}` : path;
    const html = await request(fullPath);
    const $ = cheerio.load(html);

    const items = [];
    $('.listupd .bs, .bs').each((_, elem) => {
        const card = parseCard($, elem);
        if (card.slug) items.push(card);
    });

    // Pagination — this source uses class="hpage" with a "Selanjutnya" (Next) link
    // There are NO numbered page links — only next/prev style navigation
    let lastPage = page;

    // Check for a next-page link inside .hpage
    const hpageLink = $('.hpage a').attr('href') || '';
    const nextPageMatch = hpageLink.match(/[?&]page=(\d+)/);
    if (nextPageMatch) {
        // The link points to e.g. ?page=2, so current page has a next page
        lastPage = parseInt(nextPageMatch[1]); // this is NEXT page number
    }

    const hasNext = !!nextPageMatch;

    return { items, pagination: { page, totalPages: Math.max(page, lastPage), hasNext } };
}

/**
 * Scrape detail series
 */
async function scrapeSeriesDetail(slug) {
    const html = await request(`/${slug}/`);
    const $ = cheerio.load(html);

    const title = $('h1.entry-title, h1').first().text().trim();
    const synopsis = $('.synp p, .entry-content p, .synopsis').first().text().trim();
    const posterUrlRaw = $('img.attachment-post-thumbnail, .thumb img, .poster img').first().attr('src') || '';
    const posterUrl = posterUrlRaw.replace('http://', 'https://');

    // Rating
    const ratingStr = $('.num, .score, .wp-review-score-render').first().text().trim();
    const rating = parseFloat(ratingStr.match(/[\d.]+/)?.[0]) || null;

    // Info fields
    function infoField(label) {
        const el = $(`.infox b:contains("${label}")`).parent();
        if (el.length) {
            return el.find('a').map((_, a) => $(a).text().trim()).get().join(', ')
                || el.text().replace(label, '').replace(':', '').trim();
        }
        return null;
    }

    const status = infoField('Status') || infoField('status');
    let network = infoField('Network') || infoField('Jaringan');
    const country = infoField('Negara') || infoField('Country');
    const type = infoField('Tipe') || infoField('Type');
    const director = infoField('Sutradara') || infoField('Director');
    const totalEpisodesStr = infoField('Episode') || infoField('Episodes');
    const totalEpisodes = totalEpisodesStr ? parseInt(totalEpisodesStr) : null;
    const duration = infoField('Durasi') || infoField('Duration');
    const released = infoField('Ditayangkan') || infoField('Released');

    // Genres
    const genres = [];
    $('.infox a[href*="/genres/"], .genxed a[href*="/genres/"]').each((_, el) => {
        const g = $(el).text().trim();
        if (g && !genres.includes(g)) genres.push(g);
    });

    // Cast
    const cast = [];
    $('.infox a[href*="/cast/"], .castx a[href*="/cast/"]').each((_, el) => {
        const c = $(el).text().trim();
        if (c && !cast.includes(c)) cast.push(c);
    });

    // Episode list
    const episodes = [];
    $('.eplister ul li a, .bxcl ul li a, .episodelist ul li a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const epSlug = extractSlug(href);
        const epMatch = href.match(/episode-(\d+)/i);
        // If it's a movie and there's no "-episode-", default or fallback to 1 
        // to ensure it shows up at least once.
        let epNum = epMatch ? parseInt(epMatch[1]) : 0;
        if (epNum === 0 && (type === 'Movie' || type === 'Film')) epNum = 1;

        const epTitle = $(el).find('.epl-title, .title').text().trim()
            || $(el).text().replace(/\s+/g, ' ').trim()
            || `Episode ${epNum || 1}`;

        if (epSlug && !episodes.find((e) => e.slug === epSlug)) {
            episodes.push({ number: epNum, title: epTitle, slug: epSlug, url: href });
        }
    });
    episodes.sort((a, b) => a.number - b.number);

    return {
        title,
        slug,
        synopsis,
        posterUrl,
        rating,
        status,
        network,
        country,
        type,
        director,
        totalEpisodes,
        duration,
        released,
        genres,
        cast,
        episodes,
    };
}

/**
 * Scrape halaman episode — parse server list dari select.mirror (base64 encoded iframe HTML)
 * HTML structure: <select class="mirror"><option value="[BASE64]" data-index="1">TurboVIP</option>...
 */
async function scrapeEpisodePage(episodeSlug) {
    const html = await request(`/${episodeSlug}/`);
    const $ = cheerio.load(html);

    const title = $('h1.entry-title, h1').first().text().trim();

    // ─── Parse server list dari select.mirror ─────────────────────────────
    // Semua iframe URL sudah ada di HTML sebagai base64 encoded string
    const streamLinks = [];

    $('select.mirror option').each((_, el) => {
        const $el = $(el);
        const b64 = $el.attr('value') || '';
        const name = $el.text().trim();

        // Skip placeholder option
        if (!b64 || !name || name === 'Pilih Server Video') return;

        try {
            // Decode base64 → iframe HTML string
            const decoded = Buffer.from(b64, 'base64').toString('utf-8');

            // Extract src dari iframe tag
            const srcMatch = decoded.match(/[Ss][Rr][Cc]=["']([^"']+)["']/);
            if (!srcMatch) return;

            const iframeUrl = srcMatch[1].trim();
            if (!iframeUrl || iframeUrl === '') return;

            const serverName = name || detectServer(iframeUrl);


            streamLinks.push({
                server: serverName,
                label: name,
                quality: extractQuality(name + ' ' + iframeUrl),
                url: iframeUrl,
            });

            console.log(`[Scraper] Server "${name}" → ${iframeUrl}`);
        } catch (e) {
            console.warn(`[Scraper] Gagal decode option "${name}": ${e.message}`);
        }
    });

    // ─── Fallback: jika select tidak ditemukan, cek iframe langsung ────────
    if (streamLinks.length === 0) {
        $('iframe[src]').each((_, el) => {
            const src = $(el).attr('src');
            if (src && src.startsWith('http')) {
                const sName = detectServer(src);


                if (!streamLinks.find(l => l.url === src)) {
                    streamLinks.push({
                        server: sName,
                        label: sName,
                        quality: 'Unknown',
                        url: src,
                    });
                }
            }
        });
    }

    console.log(`[Scraper] Episode /${episodeSlug}/: ${streamLinks.length} server ditemukan`);

    // ─── Download links ────────────────────────────────────────────────────
    const downloadLinksMap = new Map();

    // Scrape form `.dlbox` lists
    $('.dlbox ul, .download-box ul, .soraddlx ul').each((_, ul) => {
        const quality = $(ul).find('li.head span.q').text().replace(/Server/i, '').trim() || $(ul).find('strong').text().trim() || 'Download';

        $(ul).find('li').not('.head').each((__, li) => {
            const serverName = $(li).find('span.q').text().trim() || $(li).text().trim() || 'Url';
            const url = $(li).find('a').attr('href') || '';

            if (url && url.startsWith('http')) {
                if (!downloadLinksMap.has(quality)) {
                    downloadLinksMap.set(quality, { quality: quality, links: [] });
                }
                downloadLinksMap.get(quality).links.push({
                    server: serverName.replace('Download', '').trim() || detectServer(url),
                    url: url
                });
            }
        });
    });

    // Fallback: simple table links
    $('table.download-table a, .download a, .dl a, table a[href]').each((_, el) => {
        const url = $(el).attr('href') || '';
        const text = $(el).text().trim();
        if (url && url.startsWith('http') && !url.includes('facebook') && !url.includes('twitter')) {
            const quality = extractQuality(text) || 'Link';
            if (!downloadLinksMap.has(quality)) {
                downloadLinksMap.set(quality, { quality: quality, links: [] });
            }
            // Avoid duplicates
            if (!downloadLinksMap.get(quality).links.find(l => l.url === url)) {
                downloadLinksMap.get(quality).links.push({
                    server: text || detectServer(url),
                    url: url
                });
            }
        }
    });

    const downloadLinks = Array.from(downloadLinksMap.values());

    // ─── Navigate prev/next + series slug ────────────────────────────────
    const seriesHref = $('a.back-to-series, .nav-series a, .bxcl a, .naveps a').first().attr('href') || '';
    const seriesSlug = extractSlug(seriesHref);

    const prevUrl = $('a.prev, .prev-eps a, a[rel="prev"], .naveps .bl').first().attr('href') || '';
    const nextUrl = $('a.next, .next-eps a, a[rel="next"], .naveps .br').first().attr('href') || '';

    return {
        title,
        episodeSlug,
        seriesSlug,
        streamLinks,
        downloadLinks,
        serverCount: streamLinks.length,
        navigation: {
            prev: prevUrl ? extractSlug(prevUrl) : null,
            next: nextUrl ? extractSlug(nextUrl) : null,
        },
    };
}

/**
 * Scrape search results
 */
async function scrapeSearch(query, page = 1) {
    const encoded = encodeURIComponent(query);
    const html = await request(`/?s=${encoded}&page=${page}`);
    const $ = cheerio.load(html);

    const items = [];
    $('.listupd .bs, .bs, article.result-item').each((_, elem) => {
        const card = parseCard($, elem);
        if (card.slug) items.push(card);
    });

    const lastPage = parseInt($('.pagination .page-numbers:not(.next)').last().text()) || 1;
    return { query, items, pagination: { page, totalPages: lastPage, hasNext: page < lastPage } };
}

/**
 * Scrape daftar genre
 */
async function scrapeGenres() {
    const html = await request('/');
    const $ = cheerio.load(html);

    const genres = new Map();
    $('a[href*="/genres/"]').each((_, el) => {
        const name = $(el).text().trim();
        const href = $(el).attr('href') || '';
        const slug = href.match(/\/genres\/([^/]+)/)?.[1];
        if (name && slug && !genres.has(slug)) {
            genres.set(slug, { name, slug, url: href });
        }
    });

    return [...genres.values()];
}

/**
 * Scrape halaman jadwal tayang
 */
async function scrapeSchedule() {
    const html = await request('/jadwal-tayang/');
    const $ = cheerio.load(html);

    const schedule = {};
    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

    $('table tr, .schedule-day').each((_, row) => {
        const $row = $(row);
        const day = $row.find('th, .day-name').text().trim();
        if (days.includes(day)) {
            schedule[day] = [];
            $row.find('td a, .show-item a').each((_, a) => {
                const $a = $(a);
                schedule[day].push({
                    title: $a.text().trim(),
                    slug: extractSlug($a.attr('href') || ''),
                    url: $a.attr('href') || '',
                });
            });
        }
    });

    return schedule;
}

module.exports = {
    scrapeHomepage,
    scrapeSeriesList,
    scrapeFilterPage,
    scrapeSeriesDetail,
    scrapeEpisodePage,
    scrapeSearch,
    scrapeGenres,
    scrapeSchedule,
};
