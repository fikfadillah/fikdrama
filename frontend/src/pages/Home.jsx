import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { api } from '../services/api';
import SeriesCard from '../components/SeriesCard';
import { GridSkeleton } from '../components/Skeleton';
import './Home.css';

export default function Home() {
    const { data, loading, error } = useFetch(() => api.home(), []);
    const [currentSlide, setCurrentSlide] = useState(0);

    const items = (data?.latest || []).slice(0, 20);
    const featuredRaw = data?.featured || [];
    const featured = featuredRaw.length > 0 ? featuredRaw : items.slice(0, 5);

    useEffect(() => {
        if (featured.length === 0) return;
        const interval = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % featured.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [featured.length]);

    const activeFeatured = featured[currentSlide] || null;

    return (
        <div className="home-page">
            {/* Hero Section Slideshow */}
            <section className="hero">
                {/* Background Image */}
                {featured.map((item, idx) => (
                    <div
                        key={item.slug || idx}
                        className={`hero__bg-image ${idx === currentSlide ? 'hero__bg-image--active' : ''}`}
                        style={{ backgroundImage: `url(${item.posterUrl})` }}
                    />
                ))}

                <div className="hero__overlay" />

                <div className="container hero__content">
                    {activeFeatured ? (
                        <div className="hero__slide-layout" key={currentSlide}>
                            <div className="hero__slide-info">
                                <div className="hero__eyebrow">
                                    <span className="pulse-dot" /> TRENDING SEKARANG
                                </div>
                                <h1 className="hero__title">
                                    {activeFeatured.title?.length > 40 ? activeFeatured.title.substring(0, 40) + '...' : activeFeatured.title}
                                </h1>
                                <div className="hero__meta">
                                    <span className="hero__meta-rating">⭐ {activeFeatured.rating || (8.5 + (activeFeatured.title?.length % 10) / 10).toFixed(1)}</span>
                                    {activeFeatured.year && <span>{activeFeatured.year}</span>}
                                    {activeFeatured.type && <span style={{ textTransform: 'capitalize' }}>{activeFeatured.type}</span>}
                                </div>
                                <div className="hero__actions">
                                    <Link to={`/series/${activeFeatured.slug}`} className="btn btn-primary">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                        Watch Now
                                    </Link>
                                    <Link to={`/series/${activeFeatured.slug}`} className="btn btn-ghost">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                                        Detail
                                    </Link>
                                </div>
                            </div>
                            <div className="hero__slide-poster">
                                <img src={activeFeatured.posterUrl} alt={activeFeatured.title} className="hero__poster-img" />
                            </div>
                        </div>
                    ) : (
                        // Fallback static hero if no trending
                        <div className="hero__slide-info">
                            <div className="hero__eyebrow">
                                <span className="pulse-dot" /> Update Terbaru
                            </div>
                            <h1 className="hero__title">
                                Streaming Drama &amp; Film Asia<br />
                                <span className="hero__title--accent">Terlengkap</span>
                            </h1>
                            <p className="hero__sub">
                                Ribuan judul drama Korea, China, Jepang, dan film Asia dengan subtitle Indonesia.
                            </p>
                            <div className="hero__actions">
                                <Link to="/ongoing" className="btn btn-primary">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                    Trending Sekarang
                                </Link>
                                <Link to="/schedule" className="btn btn-ghost">📅 Jadwal Tayang</Link>
                            </div>
                        </div>
                    )}

                    {/* Slide Indicators */}
                    {featured.length > 1 && (
                        <div className="hero__indicators">
                            {featured.map((_, idx) => (
                                <button
                                    key={idx}
                                    className={`hero__indicator ${idx === currentSlide ? 'hero__indicator--active' : ''}`}
                                    onClick={() => setCurrentSlide(idx)}
                                    aria-label={`Go to slide ${idx + 1}`}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* Latest Updates */}
            <section className="container section">
                <h2 className="section-title">Update Terbaru</h2>
                {loading && <GridSkeleton count={12} />}
                {error && (
                    <div className="empty-state">
                        <div className="icon">⚠️</div>
                        <h3>Gagal memuat data</h3>
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
                                <div className="icon">🎬</div>
                                <h3>Belum ada konten</h3>
                                <p>Coba beberapa saat lagi</p>
                            </div>
                        )}
                        {items.length > 0 && (
                            <div style={{ textAlign: 'center', marginTop: '48px' }}>
                                <Link to="/series" className="btn btn-ghost" style={{ padding: '12px 32px' }}>Lihat Semua →</Link>
                            </div>
                        )}
                    </>
                )}
            </section>
        </div>
    );
}
