const NodeCache = require('node-cache');

const TTL = {
    home: parseInt(process.env.CACHE_TTL_HOME) || 300,          // 5 min
    list: parseInt(process.env.CACHE_TTL_LIST) || 1800,         // 30 min
    detail: parseInt(process.env.CACHE_TTL_DETAIL) || 1800,     // 30 min
    episode: parseInt(process.env.CACHE_TTL_EPISODE) || 3600,   // 1 hour (multi-server AJAX)
    search: parseInt(process.env.CACHE_TTL_SEARCH) || 600,      // 10 min
    meta: 3600,                                                   // 1 hour
};

const cache = new NodeCache({ stdTTL: 600, checkperiod: 120, useClones: false });

/**
 * Ambil dari cache atau jalankan fn scraper
 * @param {string} key - cache key
 * @param {string} ttlType - key dari objek TTL
 * @param {Function} fn - async function yang mengembalikan data
 */
async function withCache(key, ttlType, fn) {
    const cached = cache.get(key);
    if (cached !== undefined) {
        return { data: cached, fromCache: true };
    }

    const data = await fn();
    cache.set(key, data, TTL[ttlType] || 600);
    return { data, fromCache: false };
}

/**
 * Hapus cache berdasarkan key
 */
function bustCache(key) {
    cache.del(key);
}

/**
 * Statistik cache
 */
function cacheStats() {
    return cache.getStats();
}

module.exports = { withCache, bustCache, cacheStats, TTL };
