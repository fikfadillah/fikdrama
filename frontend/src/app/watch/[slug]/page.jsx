'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../services/api';
import VideoPlayer from '../../../components/VideoPlayer';
import SeriesCard from '../../../components/SeriesCard';
import { addToHistory } from '../../../utils/storage';
import './Watch.css';

export default function Watch() {
    // Next.js params
    const params = useParams();
    const [currentSlug, setCurrentSlug] = useState(params?.slug || '');
    const [data, setData] = useState(null);
    const [seriesData, setSeriesData] = useState(null);
    const [similarDramas, setSimilarDramas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeLink, setActiveLink] = useState(null);
    const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);

    // Stream state
    const [streamUrl, setStreamUrl] = useState(null);
    const [streamType, setStreamType] = useState(null); // 'hls' | 'mp4' | 'iframe' | 'external'
    const [isResolving, setIsResolving] = useState(false);

    // ── Load episode ──────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;

        // Optimistically clear the video player when slug changes to avoid seeing the old episode
        setStreamUrl(null);
        setStreamType(null);
        setActiveLink(null);

        setLoading(true);
        setError(null);
        const isEpisodeMatch = currentSlug.match(/(.*?)-episode-\d+/i);
        const derivedSeriesSlug = isEpisodeMatch ? isEpisodeMatch[1] : currentSlug;

        Promise.all([
            api.episode(currentSlug),
            api.seriesDetail(derivedSeriesSlug).catch(() => null)
        ])
            .then(([d, sData]) => {
                if (cancelled) return;

                setData(d);

                const actualSeriesSlug = d.seriesSlug || derivedSeriesSlug;

                const processSeriesData = async () => {
                    let finalSData = sData;
                    // Fetch if derivation was wrong or fell back
                    if (!finalSData || (d.seriesSlug && d.seriesSlug !== derivedSeriesSlug)) {
                        finalSData = await api.seriesDetail(actualSeriesSlug).catch(() => null);
                    }
                    return finalSData;
                };

                processSeriesData().then(finalSData => {
                    if (cancelled) return;

                    if (finalSData) {
                        setSeriesData(finalSData);
                        addToHistory({
                            seriesSlug: actualSeriesSlug,
                            seriesTitle: finalSData.title,
                            episodeSlug: currentSlug,
                            episodeTitle: d.title,
                            posterUrl: finalSData.posterUrl,
                            type: finalSData.type,
                            status: finalSData.status
                        });

                        // Fetch similar dramas using the first genre
                        if (finalSData.genres && finalSData.genres.length > 0) {
                            api.genre(finalSData.genres[0].toLowerCase().replace(/\s+/g, '-'))
                                .then(genData => {
                                    if (!cancelled) setSimilarDramas(genData?.items?.filter(item => item.slug !== actualSeriesSlug) || []);
                                })
                                .catch(() => {
                                    api.home().then(homeData => {
                                        if (!cancelled) setSimilarDramas(homeData?.items?.filter(item => item.slug !== actualSeriesSlug) || []);
                                    }).catch(() => { });
                                });
                        } else {
                            api.home().then(homeData => {
                                if (!cancelled) setSimilarDramas(homeData?.items?.filter(item => item.slug !== actualSeriesSlug) || []);
                            }).catch(() => { });
                        }
                    }
                });

                if (d.streamLinks?.length) {
                    const hydraxLink = d.streamLinks.find(link =>
                        link.server.toLowerCase().includes('hydrax') ||
                        link.url.toLowerCase().includes('hydrax') ||
                        link.url.toLowerCase().includes('short.icu')
                    );
                    setActiveLink(hydraxLink || d.streamLinks[0]);
                }
                setLoading(false);
            })
            .catch((e) => {
                if (!cancelled) { setError(e.message); setLoading(false); }
            });
        return () => { cancelled = true; };
    }, [currentSlug]);

    // ── Resolve stream ────────────────────────────────────────────
    useEffect(() => {
        if (!activeLink) return;
        let cancelled = false;

        const resolveStream = async () => {
            setIsResolving(true);
            setStreamUrl(null);
            setStreamType(null);

            // Fast-path: Skip backend extraction for Hydrax/short.icu/filelions
            let hostname = '';
            try { hostname = new URL(activeLink.url).hostname; } catch (_) { }
            const isAntiEmbed = hostname.includes('hydrax') || hostname.includes('short.icu') || hostname.includes('filelions');

            if (isAntiEmbed) {
                console.log('[Watch] Fast-path Hydrax → hydrax-iframe');
                if (!cancelled) {
                    setStreamUrl(activeLink.url); // Use the original embed url
                    setStreamType('hydrax-iframe');
                    setIsResolving(false);
                }
                return;
            }

            try {
                const json = await api.extractStream(activeLink.url);
                if (cancelled) return;

                if (json.success && json.videoUrl) {
                    const proxyUrl = `${api.getBaseUrl()}/stream-proxy?url=${encodeURIComponent(json.videoUrl)}`;
                    setStreamUrl(proxyUrl);
                    setStreamType(json.type || 'mp4');
                    console.log(`[Watch] Stream (${json.type}) ready`);
                } else {
                    console.warn('[Watch] No stream → iframe');
                    setStreamType('iframe');
                }
            } catch (e) {
                if (!cancelled) {
                    console.error('[Watch] Error:', e);
                    setStreamType('iframe');
                }
            } finally {
                if (!cancelled) setIsResolving(false);
            }
        };

        resolveStream();
        return () => { cancelled = true; };
    }, [activeLink]);

    // ── Handle Seamless Navigation ────────────────────────────────
    const handleEpisodeChange = (newSlug) => {
        if (newSlug === currentSlug) return;

        // Update URL immediately without triggering Next.js router re-render
        window.history.pushState(null, '', `/watch/${newSlug}`);

        // Set new slug to trigger the useEffect data fetch
        setCurrentSlug(newSlug);

        // Keep the page layout, only the video player and text will reactively update
    };

    // ── Render ────────────────────────────────────────────────────

    // Robust matching: Check if the new slug is part of the currently cached series episodes list
    // or matches prev/next navigation exactly.
    const isSameSeries = (() => {
        if (!data) return false;
        // 1. Check if slug matches current navigation
        if (data.navigation?.prev === currentSlug || data.navigation?.next === currentSlug) return true;
        // 2. Check if slug exists in the cached list of episodes for the current series
        if (seriesData?.episodes && seriesData.episodes.some(ep => ep.slug === currentSlug)) return true;
        // 3. Fallback: string matching (often brittle, but good as last resort if data is stale)
        if (data.seriesSlug && currentSlug?.includes(data.seriesSlug)) return true;

        return false;
    })();

    const isTransitioning = loading && isSameSeries;

    // Optimistic UI Data
    // Find the title from the cache to show it instantly before the new data arrives
    let optimisticEpTitle = null;
    if (isTransitioning && seriesData?.episodes) {
        const foundEp = seriesData.episodes.find(ep => ep.slug === currentSlug);
        if (foundEp) {
            optimisticEpTitle = foundEp.title;
        }
    }

    // Only show the full-page skeleton if this is a fresh load (not a same-series navigation)
    if (loading && !isSameSeries) return (
        <div className="container watch-loading">
            <div className="skeleton" style={{ height: '520px', borderRadius: '16px', marginTop: '32px' }} />
        </div>
    );

    if (error) return (
        <div className="container">
            <div className="empty-state" style={{ paddingTop: '80px' }}>
                <div className="icon">⚠️</div>
                <h3>Gagal memuat episode</h3>
                <p>{error}</p>
                <Link href="/" className="btn btn-ghost" style={{ marginTop: '16px' }}>← Kembali</Link>
            </div>
        </div>
    );

    const { title, streamLinks = [], downloadLinks = [], navigation = {}, seriesSlug } = data || {};

    // Use optimistic title if transitioning, else use the loaded title
    const displayTitle = isTransitioning ? (optimisticEpTitle || 'Memuat Episode...') : title;

    // Generate Drama Info mapping
    const seriesTitle = seriesData?.title || displayTitle.replace(/Episode \d+/i, '').trim();
    const episodeNumber = displayTitle.match(/Episode (\d+)/i)?.[1] || '?';
    // Remove "Download dan nonton [title] Episode [X] subtitle Indonesia dengan kualitas HD 1080p 720p 480p 360p disertai Batch Google Drive menjadikan situs OPPADRAMA tempat nongkrongnya pecinta drama series." and variations.
    const cleanSynopsis = seriesData?.synopsis ? seriesData.synopsis.replace(/Download dan nonton.*?pecinta drama series\./gi, '').trim() : '';
    const hasSynopsis = cleanSynopsis.length > 0;

    return (
        <div className="watch-page">
            <div className="container">
                {/* Header */}
                <div className="watch-header-row" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', padding: '24px 0 16px' }}>
                    {seriesSlug && !isTransitioning && (
                        <Link href={`/series/${seriesSlug}`} className="back-btn" style={{ margin: 0, paddingRight: '16px', borderRight: '1px solid var(--border)' }}>
                            ← Kembali ke Series
                        </Link>
                    )}
                    {(isTransitioning || seriesSlug) && isTransitioning && (
                        <span className="back-btn" style={{ margin: 0, paddingRight: '16px', borderRight: '1px solid var(--border)', opacity: 0.5, pointerEvents: 'none' }}>
                            ← Kembali ke Series
                        </span>
                    )}
                    <h1 className="watch-title" style={{ margin: 0, fontSize: '1.2rem' }}>{displayTitle}</h1>
                </div>

                {/* Player — fully isolated in VideoPlayer component */}
                <VideoPlayer
                    streamUrl={streamUrl}
                    streamType={streamType}
                    isResolving={isResolving || isTransitioning}
                    title={isTransitioning ? 'Memuat Episode...' : displayTitle}
                    serverName={activeLink?.server || ''}
                    embedUrl={activeLink?.url || ''}
                    proxyBase={api.getBaseUrl()}
                />

                {/* Server switcher & Navigation Row */}
                {(streamLinks.length > 0 || navigation.prev || navigation.next) && (
                    <div className="server-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                            <div style={{ opacity: isTransitioning ? 0.4 : 1, transition: 'opacity 0.2s ease', pointerEvents: isTransitioning ? 'none' : 'auto' }}>
                                <h3 className="server-label">Pilih Server</h3>
                                <div className="server-list">
                                    {streamLinks.map((link, i) => (
                                        <button
                                            key={i}
                                            className={`server-btn ${activeLink?.url === link.url ? 'server-btn--active' : ''}`}
                                            onClick={() => setActiveLink(link)}
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z" /></svg>
                                            {link.server || `Server ${i + 1}`}
                                            {link.quality !== 'Unknown' && <span className="server-btn__quality">{link.quality}</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Navigation */}
                            <div className="episode-nav" style={{ margin: 0, gap: '8px', opacity: isTransitioning ? 0.4 : 1, pointerEvents: isTransitioning ? 'none' : 'auto', transition: 'opacity 0.2s ease' }}>
                                {navigation.prev ? (
                                    <button onClick={() => handleEpisodeChange(navigation.prev)} className="nav-ep-btn">
                                        ← Prev
                                    </button>
                                ) : <div />}
                                {navigation.next && (
                                    <button onClick={() => handleEpisodeChange(navigation.next)} className="nav-ep-btn nav-ep-btn--next">
                                        Next →
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Episode List (Horizontal Scroll) */}
                {seriesData?.episodes?.length > 0 && (
                    <div className="episode-list-section" style={{ marginTop: '24px', marginBottom: '24px' }}>
                        <h3 className="section-title" style={{ fontSize: '1rem', marginBottom: '12px' }}>Daftar Episode</h3>
                        <div className="episode-scroll-list">
                            {seriesData.episodes.map((ep) => {
                                const isActive = ep.slug === currentSlug;
                                return (
                                    <button
                                        key={ep.slug}
                                        onClick={() => handleEpisodeChange(ep.slug)}
                                        className={`ep-scroll-btn ${isActive ? 'ep-scroll-btn--active' : ''}`}
                                        style={{ fontFamily: 'inherit' }}
                                    >
                                        Ep {ep.number || ep.title.replace(/[^\d]/g, '') || '?'}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Download Links Section */}
                {downloadLinks?.length > 0 && (
                    <div className="download-section" style={{ marginTop: '24px', padding: '16px', background: 'rgba(229, 9, 20, 0.05)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(229, 9, 20, 0.2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            <h3 className="section-title" style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-primary)' }}>Download Episode</h3>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {downloadLinks.map((dlLine, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingBottom: '12px', borderBottom: idx !== downloadLinks.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)', minWidth: '80px', fontSize: '0.9rem' }}>
                                        {dlLine.quality}
                                    </span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', flex: 1 }}>
                                        {dlLine.links.map((link, j) => (
                                            <a
                                                key={j}
                                                href={link.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-ghost"
                                                style={{ padding: '4px 12px', fontSize: '0.85rem', minHeight: '32px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                                            >
                                                {link.server}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Drama Info Section */}
                {seriesData && (
                    <div className="drama-info-section" style={{ marginTop: '24px', padding: '20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
                            <div>
                                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
                                    {seriesTitle} <span style={{ color: 'var(--accent-soft)', fontSize: '1.1rem' }}>— Ep {episodeNumber}</span>
                                </h2>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {seriesData.genres?.map(g => (
                                        <Link key={g} href={`/genre/${g.toLowerCase().replace(/\s+/g, '-')}`} className="genre-pill" style={{ padding: '4px 10px', fontSize: '0.75rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-full)', color: 'var(--text-secondary)' }}>
                                            {g}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                            {seriesData.rating && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(245, 158, 11, 0.1)', padding: '6px 12px', borderRadius: 'var(--radius-full)', color: '#f59e0b', fontWeight: 600 }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                    {seriesData.rating}
                                </div>
                            )}
                        </div>

                        <div className="drama-synopsis">
                            {hasSynopsis ? (
                                <>
                                    <p className={`synopsis-text ${isSynopsisExpanded ? 'expanded' : ''}`} style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>
                                        {cleanSynopsis}
                                    </p>
                                    {cleanSynopsis.length > 150 && (
                                        <button onClick={() => setIsSynopsisExpanded(!isSynopsisExpanded)} className="btn-read-more" style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontWeight: 600, padding: '8px 0 0 0', cursor: 'pointer', fontSize: '0.9rem' }}>
                                            {isSynopsisExpanded ? 'Sembunyikan' : 'Selengkapnya'}
                                        </button>
                                    )}
                                </>
                            ) : (
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic', margin: 0 }}>
                                    Informasi sinopsis belum tersedia untuk seri ini.
                                </p>
                            )}
                        </div>
                    </div>
                )}



                {/* Drama Serupa (Similar Dramas) */}
                {similarDramas.length > 0 && (
                    <div className="similar-drama-section" style={{ marginTop: '40px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 className="section-title" style={{ fontSize: '1.1rem', margin: 0 }}>
                                <span className="title-icon">🔥</span> Drama Serupa
                            </h3>
                        </div>
                        <div className="similar-drama-scroll" style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '16px', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
                            {similarDramas.map((item, i) => (
                                <div key={item.slug || i} style={{ minWidth: '160px', width: '160px', scrollSnapAlign: 'start', flexShrink: 0 }}>
                                    <SeriesCard item={item} index={i} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
