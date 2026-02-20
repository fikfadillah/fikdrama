import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import SeriesCard from '../components/SeriesCard';
import { GridSkeleton } from '../components/Skeleton';
import './Category.css';

const CONTENT_TYPE_MAP = {
    drama: { label: 'Drama', apiType: 'Drama' },
    movie: { label: 'Film', apiType: 'Movie' },
};

const COUNTRY_LABELS = {
    'south-korea': 'Korea', china: 'China', japan: 'Jepang',
    thailand: 'Thailand', taiwan: 'Taiwan', philippines: 'Filipina',
    'hong-kong': 'Hong Kong', india: 'India', 'united-states': 'Barat',
};

const MODE_CONFIG = {
    genre: {
        title: (slug) => `Genre: ${slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`,
        fetcher: (slug, page) => api.genre(slug, page),
    },
    country: {
        // param format: "countryName" or "countryName::drama|movie"
        title: (param) => {
            const [name, ct] = param.split('::');
            const cLabel = COUNTRY_LABELS[name] || name.replace(/\b\w/g, c => c.toUpperCase());
            const typeLabel = ct ? CONTENT_TYPE_MAP[ct]?.label : null;
            return typeLabel ? `${typeLabel} ${cLabel}` : `${cLabel}`;
        },
        fetcher: (param, page) => {
            const [name, ct] = param.split('::');
            const apiType = ct ? CONTENT_TYPE_MAP[ct]?.apiType : null;
            return api.country(name, page, apiType);
        },
    },
    ongoing: {
        title: () => 'Sedang Tayang',
        fetcher: (_, page) => api.ongoing(page),
    },
    completed: {
        title: () => 'Sudah Tamat',
        fetcher: (_, page) => api.completed(page),
    },
    movie: {
        title: () => 'Film',
        fetcher: (_, page) => api.series({ type: 'Movie', page }),
    },
    animation: {
        title: () => 'Animasi',
        fetcher: (_, page) => api.series({ genre: 'animation', page }),
    },
    tv_show: {
        title: () => 'Variety Show',
        fetcher: (_, page) => api.series({ type: 'TV Show', page }),
    },
    all: {
        title: () => 'Semua Series',
        fetcher: (_, page) => api.series({ order: 'update', page }),
    },
};

export default function Category({ mode: modeProp }) {
    // contentType = 'drama' | 'movie' (optional URL segment)
    const { slug, type, name, contentType } = useParams();
    const location = useLocation();

    const mode = modeProp || type || (location.pathname.includes('/genre') ? 'genre' : null);
    const config = MODE_CONFIG[mode] || MODE_CONFIG['ongoing'];

    // Build a STABLE STRING param — avoids infinite useEffect loops from object identity issues
    const rawName = slug || type || name || '';
    const paramKey = mode === 'country' && contentType
        ? `${rawName}::${contentType}`
        : rawName;

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);

    // Reset page when navigating to a different category
    useEffect(() => {
        setPage(1);
        setData(null);
    }, [mode, paramKey]);

    // Fetch data — paramKey is a stable string so this only fires when truly needed
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        config.fetcher(paramKey, page)
            .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
            .catch((e) => { if (!cancelled) { setError(e.message); setLoading(false); } });
        return () => { cancelled = true; };
    }, [mode, paramKey, page]); // eslint-disable-line react-hooks/exhaustive-deps

    const items = data?.items || [];
    const pagination = data?.pagination || {};
    const pageTitle = config.title(paramKey);

    function changePage(p) {
        setPage(p);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    return (
        <div className="category-page">
            <div className="container">
                <div className="category-header">
                    <h1 className="category-title">{pageTitle}</h1>
                    {!loading && items.length > 0 && (
                        <p className="category-count">
                            Halaman {page}{pagination.hasNext ? '' : ' (terakhir)'}
                        </p>
                    )}
                </div>

                {loading && <GridSkeleton count={18} />}

                {error && (
                    <div className="empty-state">
                        <div className="icon">⚠️</div>
                        <h3>Gagal memuat</h3>
                        <p>{error}</p>
                    </div>
                )}

                {!loading && !error && (
                    <>
                        <div className="cards-grid">
                            {items.map((item, i) => <SeriesCard key={item.slug || i} item={item} index={i} />)}
                        </div>

                        {items.length === 0 && (
                            <div className="empty-state">
                                <div className="icon">📭</div>
                                <h3>Tidak ada konten</h3>
                                <p>Coba kategori lain</p>
                            </div>
                        )}

                        {items.length > 0 && (() => {
                            const hasNext = pagination.hasNext;
                            const hasPrev = page > 1;
                            if (!hasNext && !hasPrev) return null;

                            // Sliding window of 5 pages centered on current page
                            const WINDOW = 5;
                            const windowStart = Math.max(1, page - 2);
                            const pages = Array.from({ length: WINDOW }, (_, i) => windowStart + i);

                            return (
                                <div className="pagination">
                                    <button
                                        className="page-btn"
                                        onClick={() => changePage(page - 1)}
                                        disabled={!hasPrev}
                                    >‹ Prev</button>

                                    {pages.map((p) => (
                                        <button
                                            key={p}
                                            className={`page-btn ${p === page ? 'active' : ''}`}
                                            onClick={() => changePage(p)}
                                            disabled={p > page && !hasNext && p > page}
                                        >{p}</button>
                                    ))}

                                    <button
                                        className="page-btn"
                                        onClick={() => changePage(page + 1)}
                                        disabled={!hasNext}
                                    >Next ›</button>
                                </div>
                            );
                        })()}
                    </>
                )}
            </div>
        </div>
    );
}
