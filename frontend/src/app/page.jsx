'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useFetch } from '../hooks/useFetch';
import { api } from '../services/api';
import dynamic from 'next/dynamic';
import { GridSkeleton } from '../components/Skeleton';

const SeriesCard = dynamic(() => import('../components/SeriesCard'), {
    ssr: false,
    loading: () => <div className="content-row__item"><GridSkeleton count={1} /></div>
});
import { getHistory, getCleanTitle } from '../utils/storage';
import './Home.css';
import './Home.css';

const ContentRow = dynamic(() => import('../components/ContentRow'), {
    ssr: false,
    loading: () => (
        <div className="content-row">
            <div className="content-row__header">
                <div className="content-row__title" style={{ width: '150px', height: '24px', backgroundColor: '#333', borderRadius: '4px' }}></div>
            </div>
            <div className="content-row__slider-container">
                <div className="content-row__slider">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="content-row__item"><GridSkeleton count={1} /></div>
                    ))}
                </div>
            </div>
        </div>
    )
});

export default function Home() {
    const { data, loading, error } = useFetch(() => api.home(), []);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [history, setHistory] = useState([]);

    useEffect(() => {
        setHistory(getHistory());
    }, []);

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
    const [activeDetails, setActiveDetails] = useState(null);

    // Fetch full details for the currently active slide to get Duration and other expanded info
    useEffect(() => {
        if (!activeFeatured?.slug) return;
        let cancelled = false;

        // Fast optimistic initial state before fetching
        setActiveDetails({ ...activeFeatured });

        api.seriesDetail(activeFeatured.slug)
            .then(detail => {
                if (!cancelled) setActiveDetails(detail);
            })
            .catch(() => { });

        return () => { cancelled = true; };
    }, [activeFeatured?.slug]);

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
                                    {(() => {
                                        const fullTitle = activeFeatured.title || '';
                                        // Match "Episode X", "Ep X", "E X" at the end of the title
                                        const epMatch = fullTitle.match(/(?:\s|-)*(?:Episode|Ep\.|Ep|E)\s*(\d+)$/i);

                                        if (epMatch) {
                                            const mainTitle = fullTitle.substring(0, epMatch.index).trim();
                                            const epText = epMatch[0].replace(/^-*\s*/, '').trim(); // Remove leading dashes

                                            return (
                                                <>
                                                    <span className="hero__title-main">
                                                        {mainTitle.length > 40 ? mainTitle.substring(0, 40) + '...' : mainTitle}
                                                    </span>
                                                    <span className="hero__title-episode" style={{ display: 'block', fontSize: '0.55em', fontWeight: '500', marginTop: '8px', color: '#e5e5e5' }}>
                                                        {epText}
                                                    </span>
                                                </>
                                            );
                                        }

                                        return fullTitle.length > 50 ? fullTitle.substring(0, 50) + '...' : fullTitle;
                                    })()}
                                </h1>
                                <div className="hero__meta">
                                    <span className="hero__meta-rating">★ {activeDetails?.rating || activeFeatured.rating || (8.5 + (activeFeatured.title?.length % 10) / 10).toFixed(1)}</span>
                                    {activeFeatured.type && (
                                        <>
                                            <span className="meta-dot">&bull;</span>
                                            <span style={{ textTransform: 'capitalize' }}>{activeFeatured.type}</span>
                                        </>
                                    )}
                                    {activeDetails?.duration && (
                                        <>
                                            <span className="meta-dot">&bull;</span>
                                            <span>{activeDetails.duration}</span>
                                        </>
                                    )}
                                    {activeFeatured.year && (
                                        <>
                                            <span className="meta-dot">&bull;</span>
                                            <span>{activeFeatured.year}</span>
                                        </>
                                    )}
                                </div>
                                <div className="hero__actions">
                                    <Link href={`/series/${activeFeatured.slug}`} className="btn btn-primary">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                        Watch Now
                                    </Link>
                                    <Link href={`/series/${activeFeatured.slug}`} className="btn btn-ghost">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                        Detail
                                    </Link>
                                </div>
                            </div>
                            <div className="hero__slide-poster">
                                <img src={activeDetails?.posterUrl || activeFeatured.posterUrl} alt={activeFeatured.title} className="hero__poster-img" />
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
                                <Link href="/ongoing" className="btn btn-primary">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                    Trending Sekarang
                                </Link>
                                <Link href="/schedule" className="btn btn-ghost">📅 Jadwal Tayang</Link>
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

            {/* Content Rows */}
            <div className="netflix-rows">
                {/* Watch History Row - Resume Last Episode Watched */}
                {history.length > 0 && (
                    <ContentRow
                        title="Lanjutkan Menonton"
                        items={history.map(h => {
                            const cleanSeriesTitle = getCleanTitle(h.seriesTitle || h.episodeTitle);

                            // If episodeTitle already has the clean series title, just use episodeTitle
                            // Otherwise, combine them reasonably
                            let displayTitle = h.episodeTitle || h.seriesTitle;
                            if (h.episodeTitle && h.seriesTitle) {
                                if (h.episodeTitle.toLowerCase().includes(cleanSeriesTitle.toLowerCase())) {
                                    displayTitle = h.episodeTitle;
                                } else {
                                    displayTitle = `${cleanSeriesTitle} - ${h.episodeTitle}`;
                                }
                            }

                            return {
                                slug: h.episodeSlug,
                                title: displayTitle,
                                posterUrl: h.posterUrl,
                                type: h.type,
                                status: h.status
                            };
                        })}
                    />
                )}



                <ContentRow
                    title="Update Terbaru"
                    fetcher={() => api.home()}
                />
                <ContentRow
                    title="Drama Pilihan"
                    fetcher={() => api.series({ type: 'drama', order: 'popular' })}
                    seeAllLink="/series"
                />
                <ContentRow
                    title="Film Seru"
                    fetcher={() => api.series({ type: 'movie', order: 'latest' })}
                    seeAllLink="/category/movie"
                />
                <ContentRow
                    title="Animasi & Donghua"
                    fetcher={() => api.series({ type: 'animation', order: 'update' })}
                    seeAllLink="/category/animation"
                />
            </div>
        </div>
    );
}
