/**
 * API Service — OppaDrama Frontend
 * Semua calls ke /api/v1 (di-proxy ke localhost:3001 dengan Vite)
 */

const BASE = (import.meta.env.VITE_API_URL || '') + '/api/v1';

async function apiFetch(path) {
    const res = await fetch(`${BASE}${path}`);
    if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
    return res.json();
}

export const api = {
    home: () => apiFetch('/home'),
    series: (opts = {}) => {
        const p = new URLSearchParams();
        if (opts.page) p.set('page', opts.page);
        if (opts.status) p.set('status', opts.status);
        if (opts.type) p.set('type', opts.type);
        if (opts.order) p.set('order', opts.order);
        return apiFetch(`/series?${p}`);
    },
    seriesDetail: (slug) => apiFetch(`/series/${slug}`),
    episode: (slug) => apiFetch(`/episode/${slug}`),
    search: (q, page = 1) => apiFetch(`/search?q=${encodeURIComponent(q)}&page=${page}`),
    genres: () => apiFetch('/genres'),
    genre: (slug, page = 1) => apiFetch(`/genre/${slug}?page=${page}`),
    country: (name, page = 1, type = null) => {
        const p = new URLSearchParams({ page });
        if (type) p.set('type', type);
        return apiFetch(`/country/${encodeURIComponent(name)}?${p}`);
    },
    schedule: () => apiFetch('/schedule'),
    ongoing: (page = 1) => apiFetch(`/ongoing?page=${page}`),
    completed: (page = 1) => apiFetch(`/completed?page=${page}`),

    // Video stream endpoints
    extractStream: (url) => apiFetch(`/extract-stream?url=${encodeURIComponent(url)}`),
    getBaseUrl: () => BASE, // Untuk construct direct URL ke stream-proxy
};
