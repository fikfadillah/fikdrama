import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import Hls from 'hls.js';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import { api } from '../services/api';
import './Watch.css';

export default function Watch() {
    const { slug } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeLink, setActiveLink] = useState(null);

    // Stream state
    const [streamUrl, setStreamUrl] = useState(null);
    const [streamType, setStreamType] = useState(null); // 'hls' | 'mp4' | 'iframe' | 'external'
    const [isResolving, setIsResolving] = useState(false);

    // Player container ref — diserahkan ke Plyr, React tidak menyentuh isinya
    const containerRef = useRef(null);
    const wrapperRef = useRef(null); // outer .player-wrapper, used as fullscreen target

    // Keep refs to avoid stale closures
    const hlsRef = useRef(null);
    const plyrRef = useRef(null);

    // ── Cleanup helper ────────────────────────────────────────────
    // Menghancurkan Plyr & HLS, lalu merestorasi <video> bersih
    const destroyPlayer = useCallback(() => {
        if (hlsRef.current) {
            try { hlsRef.current.destroy(); } catch (_) { }
            hlsRef.current = null;
        }
        if (plyrRef.current) {
            try { plyrRef.current.destroy(); } catch (_) { }
            plyrRef.current = null;
        }
        // Restorasi container ke <video> bersih agar React menemukan DOM yang diharapkan
        if (containerRef.current) {
            // Hapus semua child yang mungkin ditambahkan Plyr
            while (containerRef.current.firstChild) {
                containerRef.current.removeChild(containerRef.current.firstChild);
            }
            // Tambahkan kembali <video> bersih
            const vid = document.createElement('video');
            vid.className = 'player-video--raw';
            vid.crossOrigin = 'anonymous';
            vid.setAttribute('playsinline', '');
            containerRef.current.appendChild(vid);
        }
    }, []);

    // Cleanup saat unmount
    useEffect(() => () => destroyPlayer(), [destroyPlayer]);

    // ── Load episode ──────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        api.episode(slug)
            .then((d) => {
                if (!cancelled) {
                    setData(d);
                    if (d.streamLinks?.length) setActiveLink(d.streamLinks[0]);
                    setLoading(false);
                }
            })
            .catch((e) => { if (!cancelled) { setError(e.message); setLoading(false); } });
        return () => { cancelled = true; };
    }, [slug]);

    // ── Resolve stream ────────────────────────────────────────────
    useEffect(() => {
        if (!activeLink) return;
        let cancelled = false;

        const resolveStream = async () => {
            // 1. Destroy player secara sinkron
            destroyPlayer();

            // 2. Reset stream state (komponen re-render ke placeholder)
            setIsResolving(true);
            setStreamUrl(null);
            setStreamType(null);

            try {
                // Gunakan wrapper api() bawaan project yang sudah membaca VITE_API_URL
                const json = await api.extractStream(activeLink.url);
                if (cancelled) return;

                if (json.success && json.videoUrl) {
                    // Gunakan api.getBaseUrl() agar URL stream-proxy memakai domain backend yang benar
                    const proxyUrl = `${api.getBaseUrl()}/stream-proxy?url=${encodeURIComponent(json.videoUrl)}`;
                    setStreamUrl(proxyUrl);
                    setStreamType(json.type || 'mp4');
                    console.log(`[Watch] Stream (${json.type}) ready`);
                } else {
                    let hostname = '';
                    try { hostname = new URL(activeLink.url).hostname; } catch (_) { }
                    const isAntiEmbed = hostname.includes('hydrax') || hostname.includes('short.icu');

                    if (isAntiEmbed) {
                        console.warn('[Watch] Anti-embed → external');
                        setStreamUrl(activeLink.url);
                        setStreamType('external');
                    } else {
                        console.warn('[Watch] No stream → iframe');
                        setStreamType('iframe');
                    }
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
    }, [activeLink, destroyPlayer]);

    // ── Init Plyr + HLS setelah DOM siap ─────────────────────────
    useEffect(() => {
        if (!containerRef.current) return;
        if (!streamUrl || (streamType !== 'hls' && streamType !== 'mp4')) return;

        // Ambil elemen <video> yang sudah ada di container
        let video = containerRef.current.querySelector('video');
        if (!video) {
            video = document.createElement('video');
            video.className = 'player-video--raw';
            video.crossOrigin = 'anonymous';
            video.setAttribute('playsinline', '');
            containerRef.current.appendChild(video);
        }

        const baseOpts = {
            controls: [
                'play-large', 'restart', 'rewind', 'play', 'fast-forward',
                'progress', 'current-time', 'duration', 'mute',
                'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen',
            ],
            settings: ['quality', 'speed'],
            i18n: { qualityLabel: { 0: 'Auto' } },
            autoplay: false,
            fullscreen: {
                enabled: true,
                fallback: true,
                iosNative: true,
            },
        };

        if (streamType === 'hls' && Hls.isSupported()) {
            const hls = new Hls({ xhrSetup: (xhr) => { xhr.withCredentials = false; } });
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            hlsRef.current = hls;

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                const availQuals = hls.levels.map((l) => l.height);

                // Destroy any Plyr created before manifest (shouldn't happen, but safety)
                if (plyrRef.current) {
                    try { plyrRef.current.destroy(); } catch (_) { }
                    plyrRef.current = null;
                }

                const player = new Plyr(video, {
                    ...baseOpts,
                    quality: {
                        default: 0,
                        options: [0, ...availQuals],
                        forced: true,
                        onChange: (newQuality) => {
                            hls.currentLevel = newQuality === 0
                                ? -1
                                : hls.levels.findIndex((l) => l.height === newQuality);
                        },
                    },
                });
                plyrRef.current = player;

                // Override Plyr fullscreen: request on the outer wrapper so CSS :fullscreen rules apply
                const patchFullscreen = (p) => {
                    p.on('ready', () => {
                        const fsBtn = p.elements?.container?.querySelector('[data-plyr="fullscreen"]');
                        if (fsBtn && wrapperRef.current) {
                            fsBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                const wrapper = wrapperRef.current;
                                if (!document.fullscreenElement) {
                                    wrapper.requestFullscreen?.() || wrapper.webkitRequestFullscreen?.();
                                } else {
                                    document.exitFullscreen?.() || document.webkitExitFullscreen?.();
                                }
                            }, { capture: true });
                        }
                    });
                };
                patchFullscreen(player);
                player.play().catch(() => { });
            });

            hls.on(Hls.Events.ERROR, (_e, d) => {
                if (d.fatal) console.error('[HLS] Fatal:', d.type, d.details);
            });

        } else if (streamType === 'hls' && video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = streamUrl;
            const player = new Plyr(video, baseOpts);
            plyrRef.current = player;
            video.addEventListener('loadedmetadata', () => player.play().catch(() => { }), { once: true });

        } else if (streamType === 'mp4') {
            video.src = streamUrl;
            const player = new Plyr(video, baseOpts);
            plyrRef.current = player;
            player.on('ready', () => player.play().catch(() => { }));
        }
    }, [streamType, streamUrl]);

    // ── Render ────────────────────────────────────────────────────
    if (loading) return (
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
                <Link to="/" className="btn btn-ghost" style={{ marginTop: '16px' }}>← Kembali</Link>
            </div>
        </div>
    );

    const { title, streamLinks = [], downloadLinks = [], navigation = {}, seriesSlug } = data || {};
    const useNativePlayer = streamType === 'hls' || streamType === 'mp4';

    return (
        <div className="watch-page">
            <div className="container">
                {/* Header */}
                <div className="watch-header">
                    {seriesSlug && (
                        <Link to={`/series/${seriesSlug}`} className="back-btn">
                            ← Kembali ke Series
                        </Link>
                    )}
                    <h1 className="watch-title">{title}</h1>
                </div>

                {/* Player */}
                <div className="player-wrapper" ref={wrapperRef}>
                    {isResolving && (
                        <div className="player-loading">
                            <div className="spinner" />
                            <p>Menyiapkan video...</p>
                        </div>
                    )}

                    {/* External: Hydrax / server anti-embed */}
                    {!isResolving && streamType === 'external' && (
                        <div className="player-external">
                            <div className="player-external__icon">🎬</div>
                            <h3 className="player-external__title">Video tidak dapat ditampilkan di sini</h3>
                            <p className="player-external__desc">
                                Server <strong>{activeLink?.server || 'ini'}</strong> tidak mengizinkan pemutar tertanam.
                                Klik tombol di bawah untuk menonton langsung.
                            </p>
                            <a
                                href={streamUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="player-external__btn"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                    <polyline points="15 3 21 3 21 9" />
                                    <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                                Tonton di Tab Baru
                            </a>
                        </div>
                    )}

                    {/* Iframe fallback */}
                    {!isResolving && streamType === 'iframe' && (
                        <iframe
                            key={activeLink?.url}
                            src={`/api/v1/player-proxy?url=${encodeURIComponent(activeLink?.url || '')}`}
                            className="player-iframe"
                            allowFullScreen
                            webkitallowfullscreen="true"
                            mozallowfullscreen="true"
                            title={title}
                            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                            referrerPolicy="no-referrer"
                        />
                    )}

                    {/* Placeholder */}
                    {!isResolving && !streamType && (
                        <div className="player-unavailable">
                            <div className="icon">🎬</div>
                            <h3>Video tidak tersedia</h3>
                            <p>Coba pilih server lain di bawah</p>
                        </div>
                    )}

                    {/*
                        Container untuk Plyr — React tidak pernah memodifikasi isi div ini.
                        Plyr dan HLS.js bebas memanipulasi DOM di dalamnya.
                        Ditampilkan hanya saat native player aktif.
                    */}
                    <div
                        ref={containerRef}
                        className={`player-native-container${useNativePlayer ? ' player-native-container--active' : ''}`}
                        data-poster={data?.poster || ''}
                    >
                        {/* <video> pertama kali diinjeksi lewat JS di useEffect, bukan JSX */}
                    </div>
                </div>

                {/* Server switcher */}
                {streamLinks.length > 0 && (
                    <div className="server-section">
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
                )}

                {/* Navigation */}
                <div className="episode-nav">
                    {navigation.prev ? (
                        <Link to={`/watch/${navigation.prev}`} className="nav-ep-btn">
                            ← Episode Sebelumnya
                        </Link>
                    ) : <div />}
                    {navigation.next && (
                        <Link to={`/watch/${navigation.next}`} className="nav-ep-btn nav-ep-btn--next">
                            Episode Selanjutnya →
                        </Link>
                    )}
                </div>

                {/* Download */}
                {downloadLinks.length > 0 && (
                    <div className="download-section">
                        <h3 className="section-title" style={{ marginBottom: '16px' }}>Download</h3>
                        <div className="download-list">
                            {downloadLinks.map((dl, i) => (
                                <a key={i} href={dl.url} target="_blank" rel="noopener noreferrer" className="download-btn">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="7 10 12 15 17 10" />
                                        <line x1="12" y1="15" x2="12" y2="3" />
                                    </svg>
                                    {dl.server}
                                    {dl.quality !== 'Unknown' && <span className="dl-quality">{dl.quality}</span>}
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
