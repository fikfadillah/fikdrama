'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '../../services/api';
import SeriesCard from '../../components/SeriesCard';
import { GridSkeleton } from '../../components/Skeleton';
import '../category/[type]/Category.css'; // Reuse category styling

// Hardcoded lists based on Fikflix context
const TYPES = [
    { value: '', label: 'Semua Tipe' },
    { value: 'Drama', label: 'Drama' },
    { value: 'Movie', label: 'Movie' },
    { value: 'TV Show', label: 'Variety Show' }
];

const STATUSES = [
    { value: '', label: 'Semua Status' },
    { value: 'Ongoing', label: 'Ongoing' },
    { value: 'Completed', label: 'Completed' }
];

const COUNTRIES = [
    { value: '', label: 'Semua Negara' },
    { value: 'south-korea', label: 'Korea' },
    { value: 'china', label: 'China' },
    { value: 'japan', label: 'Jepang' },
    { value: 'thailand', label: 'Thailand' },
    { value: 'taiwan', label: 'Taiwan' },
    { value: 'philippines', label: 'Filipina' },
    { value: 'hong-kong', label: 'Hong Kong' },
    { value: 'india', label: 'India' },
    { value: 'united-states', label: 'Barat' }
];

const GENRES = [
    { value: '', label: 'Semua Genre' },
    { value: 'action', label: 'Action' },
    { value: 'comedy', label: 'Comedy' },
    { value: 'romance', label: 'Romance' },
    { value: 'thriller', label: 'Thriller' },
    { value: 'mystery', label: 'Mystery' },
    { value: 'horror', label: 'Horror' },
    { value: 'fantasy', label: 'Fantasy' },
    { value: 'sci-fi', label: 'Sci-Fi' },
    { value: 'historical', label: 'Historical' },
    { value: 'family', label: 'Family' },
    { value: 'medical', label: 'Medical' },
    { value: 'law', label: 'Law' },
];

const ORDERS = [
    { value: 'update', label: 'Terbaru' },
    { value: 'popular', label: 'Terpopuler' },
    { value: 'rating', label: 'Rating Tertinggi' } // Feature 3: Rating Sorting
];

function DirectoryContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Read initial values from URL
    const initialPage = parseInt(searchParams.get('page') || '1');
    const [page, setPage] = useState(initialPage);

    const [filters, setFilters] = useState({
        type: searchParams.get('type') || '',
        status: searchParams.get('status') || '',
        country: searchParams.get('country') || '',
        genre: searchParams.get('genre') || '',
        order: searchParams.get('order') || 'update'
    });

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Sync URL when filters/page change
    useEffect(() => {
        const params = new URLSearchParams();
        if (page > 1) params.set('page', page);
        Object.entries(filters).forEach(([k, v]) => {
            if (v) params.set(k, v);
        });
        const currentQuery = searchParams.toString();
        const newQuery = params.toString();

        if (currentQuery !== newQuery) {
            router.push(`/series?${newQuery}`, { scroll: false });
        }
    }, [filters, page, router, searchParams]);

    // Fetch data whenever filters or page change
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        api.series({ page, ...filters })
            .then((d) => {
                if (!cancelled) {
                    setData(d);
                    setLoading(false);
                }
            })
            .catch((e) => {
                if (!cancelled) {
                    setError(e.message);
                    setLoading(false);
                }
            });

        return () => { cancelled = true; };
    }, [filters, page]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
        setPage(1); // Reset page on filter change
    };

    const items = data?.items || [];
    const pagination = data?.pagination || {};

    return (
        <div className="category-page">
            <div className="container">
                <div className="category-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
                    <h1 className="category-title">Advanced Search</h1>

                    {/* Advanced Search Filters UI */}
                    <div className="filters-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', width: '100%', background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                        <select name="type" value={filters.type} onChange={handleFilterChange} className="filter-select">
                            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <select name="status" value={filters.status} onChange={handleFilterChange} className="filter-select">
                            {STATUSES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <select name="country" value={filters.country} onChange={handleFilterChange} className="filter-select">
                            {COUNTRIES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <select name="genre" value={filters.genre} onChange={handleFilterChange} className="filter-select">
                            {GENRES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <div style={{ flexGrow: 1 }} />
                        <select name="order" value={filters.order} onChange={handleFilterChange} className="filter-select" style={{ borderColor: 'var(--accent)' }}>
                            {ORDERS.map(t => <option key={t.value} value={t.value}>Urutkan: {t.label}</option>)}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <GridSkeleton count={18} />
                ) : error ? (
                    <div className="empty-state">
                        <div className="icon">⚠️</div>
                        <h3>Gagal memuat daftar</h3>
                        <p>{error}</p>
                    </div>
                ) : (
                    <>
                        <div className="cards-grid" style={{ marginTop: '24px' }}>
                            {items.map((item, i) => <SeriesCard key={item.slug || i} item={item} index={i} />)}
                        </div>

                        {items.length === 0 && (
                            <div className="empty-state">
                                <div className="icon">📭</div>
                                <h3>Tidak ada hasil yang cocok</h3>
                                <p>Coba kombinasikan filter lain</p>
                            </div>
                        )}

                        {items.length > 0 && (() => {
                            const hasNext = pagination.hasNext;
                            const hasPrev = page > 1;
                            if (!hasNext && !hasPrev) return null;

                            const WINDOW = 5;
                            const windowStart = Math.max(1, page - 2);
                            const pages = Array.from({ length: WINDOW }, (_, i) => windowStart + i);

                            const changePage = (p) => {
                                setPage(p);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            };

                            return (
                                <div className="pagination">
                                    <button className="page-btn" onClick={() => changePage(page - 1)} disabled={!hasPrev}>‹ Prev</button>
                                    {pages.map((p) => (
                                        <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => changePage(p)} disabled={p > page && !hasNext && p > page}>{p}</button>
                                    ))}
                                    <button className="page-btn" onClick={() => changePage(page + 1)} disabled={!hasNext}>Next ›</button>
                                </div>
                            );
                        })()}
                    </>
                )}
            </div>

            <style jsx>{`
                .filter-select {
                    background: var(--bg-elevated);
                    color: var(--text-primary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    padding: 8px 12px;
                    font-size: 0.9rem;
                    outline: none;
                    cursor: pointer;
                    min-width: 140px;
                }
                .filter-select:focus {
                    border-color: var(--accent);
                }
            `}</style>
        </div>
    );
}

export default function SeriesPage() {
    return (
        <Suspense fallback={<div className="container"><GridSkeleton count={18} /></div>}>
            <DirectoryContent />
        </Suspense>
    );
}
