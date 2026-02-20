import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import SeriesCard from '../components/SeriesCard';
import { GridSkeleton } from '../components/Skeleton';
import './Search.css';

export default function Search() {
    const [searchParams, setSearchParams] = useSearchParams();
    const q = searchParams.get('q') || '';
    const [inputVal, setInputVal] = useState(q);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);

    const doSearch = useCallback(async (query, p) => {
        if (!query.trim()) return;
        setLoading(true); setError(null);
        try {
            const res = await api.search(query.trim(), p);
            setData(res);
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        setInputVal(q);
        setPage(1);
        if (q) doSearch(q, 1);
        else setData(null);
    }, [q]);

    function handleSubmit(e) {
        e.preventDefault();
        if (!inputVal.trim()) return;
        setSearchParams({ q: inputVal.trim() });
    }

    function handlePage(p) {
        setPage(p);
        doSearch(q, p);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const items = data?.items || [];
    const pagination = data?.pagination || {};

    return (
        <div className="search-page">
            <div className="container">
                {/* Search bar */}
                <div className="search-hero">
                    <h1 className="search-hero__title">Cari Drama &amp; Film</h1>
                    <form onSubmit={handleSubmit} className="search-bar-form">
                        <input
                            className="search-bar-input"
                            value={inputVal}
                            onChange={(e) => setInputVal(e.target.value)}
                            placeholder="Ketik judul drama, film..."
                            autoFocus
                        />
                        <button type="submit" className="btn btn-primary">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                            </svg>
                            Cari
                        </button>
                    </form>
                </div>

                {/* Results */}
                {q && (
                    <div className="search-results">
                        {!loading && !error && data && (
                            <p className="results-count">
                                {items.length > 0
                                    ? `${items.length} hasil untuk "${q}"`
                                    : `Tidak ada hasil untuk "${q}"`}
                            </p>
                        )}

                        {loading && <GridSkeleton count={12} />}
                        {error && (
                            <div className="empty-state">
                                <div className="icon">⚠️</div>
                                <h3>Gagal mencari</h3>
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
                                        <div className="icon">🔍</div>
                                        <h3>Tidak ditemukan</h3>
                                        <p>Coba kata kunci yang berbeda</p>
                                    </div>
                                )}

                                {pagination.totalPages > 1 && (
                                    <div className="pagination">
                                        <button className="page-btn" onClick={() => handlePage(page - 1)} disabled={page === 1}>‹</button>
                                        {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => i + 1).map((p) => (
                                            <button
                                                key={p}
                                                className={`page-btn ${p === page ? 'active' : ''}`}
                                                onClick={() => handlePage(p)}
                                            >{p}</button>
                                        ))}
                                        <button className="page-btn" onClick={() => handlePage(page + 1)} disabled={page >= pagination.totalPages}>›</button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {!q && (
                    <div className="empty-state">
                        <div className="icon">🔍</div>
                        <h3>Cari drama favoritmu</h3>
                        <p>Ketik judul di atas untuk mulai mencari</p>
                    </div>
                )}
            </div>
        </div>
    );
}
