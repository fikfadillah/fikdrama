'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useFetch } from '../../../hooks/useFetch';
import { api } from '../../../services/api';
import SeriesCard from '../../../components/SeriesCard';
import { DetailSkeleton, GridSkeleton } from '../../../components/Skeleton';
import { toggleBookmark, isBookmarked } from '../../../utils/storage';
import './Detail.css';

export default function Detail({ params }) {
    // Next.js params
    const { slug } = params || {};
    const { data, loading, error } = useFetch(() => api.seriesDetail(slug), [slug]);
    const [bookmarked, setBookmarked] = useState(false);

    useEffect(() => {
        if (slug) {
            setBookmarked(isBookmarked(slug));
        }
    }, [slug]);

    const handleBookmark = () => {
        if (!data) return;
        const newState = toggleBookmark({
            slug: data.slug,
            title: data.title,
            posterUrl: data.posterUrl,
            rating: data.rating,
            status: data.status,
            type: data.type,
            year: data.year
        });
        setBookmarked(newState);
    };

    if (loading) return <div className="container"><DetailSkeleton /></div>;
    if (error) return (
        <div className="container">
            <div className="empty-state" style={{ paddingTop: '80px' }}>
                <div className="icon">⚠️</div>
                <h3>Gagal memuat</h3>
                <p>{error}</p>
                <Link href="/" className="btn btn-ghost" style={{ marginTop: '16px' }}>← Kembali</Link>
            </div>
        </div>
    );

    if (!data) return null;

    const {
        title, synopsis, posterUrl, rating, status, network, country,
        type, director, totalEpisodes, duration, released, genres = [], cast = [], episodes = []
    } = data;

    const statusCls = status?.toLowerCase() === 'ongoing' ? 'badge-ongoing' : 'badge-completed';

    return (
        <div className="detail-page">
            {/* Backdrop */}
            {posterUrl && (
                <div className="detail-backdrop">
                    <img src={posterUrl} alt="" aria-hidden />
                </div>
            )}

            <div className="container">
                <div className="detail-hero">
                    {/* Poster */}
                    <div className="detail-poster">
                        {posterUrl ? (
                            <img src={posterUrl} alt={title} className="detail-poster__img" />
                        ) : (
                            <div className="detail-poster__fallback">🎬</div>
                        )}
                        {rating && (
                            <div className="detail-rating">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                {rating}
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="detail-info">
                        <div className="detail-info__tags">
                            {status && <span className={`badge ${statusCls}`}>{status}</span>}
                            {type && <span className="badge badge-accent">{type}</span>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <h1 className="detail-info__title" style={{ margin: 0 }}>{title}</h1>

                            <div className="detail-actions-row">
                                <button
                                    onClick={handleBookmark}
                                    className={`btn-bookmark ${bookmarked ? 'bookmarked' : ''}`}
                                    aria-label={bookmarked ? "Hapus dari Koleksi" : "Tambah ke Koleksi"}
                                >
                                    <svg className="bookmark-icon" width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                                    </svg>
                                    <span className="bookmark-text">{bookmarked ? 'Tersimpan' : 'Simpan ke Koleksi'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="detail-meta">
                            {network && <MetaItem label="Network" value={network} />}
                            {country && <MetaItem label="Negara" value={country} />}
                            {totalEpisodes && <MetaItem label="Episode" value={totalEpisodes} />}
                            {duration && <MetaItem label="Durasi" value={duration} />}
                            {released && <MetaItem label="Rilis" value={released} />}
                            {director && <MetaItem label="Sutradara" value={director} />}
                        </div>

                        {genres.length > 0 && (
                            <div className="detail-genres">
                                {genres.map((g) => (
                                    <Link key={g} href={`/genre/${g.toLowerCase().replace(/\s+/g, '-')}`} className="genre-pill">{g}</Link>
                                ))}
                            </div>
                        )}

                        {synopsis && (
                            <div className="detail-synopsis">
                                <h3>Sinopsis</h3>
                                <p>{synopsis}</p>
                            </div>
                        )}

                        {cast.length > 0 && (
                            <div className="detail-cast">
                                <h3>Pemeran</h3>
                                <div className="cast-list">
                                    {cast.slice(0, 10).map((c) => (
                                        <span key={c} className="cast-item">{c}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Episode List */}
                {episodes.length > 0 && (
                    <section className="episode-section">
                        <h2 className="section-title">Daftar Episode ({episodes.length})</h2>
                        <div className="episode-grid">
                            {episodes.map((ep) => (
                                <Link
                                    key={ep.slug}
                                    href={`/watch/${ep.slug}`}
                                    className="episode-card"
                                >
                                    <span className="ep-number">Ep {ep.number}</span>
                                    <span className="ep-title">{ep.title}</span>
                                    <svg className="ep-arrow" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z" /></svg>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}

function MetaItem({ label, value }) {
    return (
        <div className="meta-item">
            <span className="meta-label">{label}</span>
            <span className="meta-value">{value}</span>
        </div>
    );
}
