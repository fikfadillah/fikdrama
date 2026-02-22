import { useRef, useEffect, useState, useCallback } from 'react';
import './VideoPlayer.css';

/**
 * VideoPlayer — Isolated video player component.
 *
 * For HLS/MP4 streams: renders an <iframe> pointing to /player.html
 * and communicates via postMessage (no Plyr DOM conflicts with React).
 *
 * For iframe-type servers: renders a direct <iframe> to the embed URL.
 * For external/anti-embed: renders a "Watch in new tab" card.
 *
 * Props:
 *   - streamUrl    {string}  The resolved stream URL
 *   - streamType   {string}  'hls' | 'mp4' | 'iframe' | 'external'
 *   - isResolving  {boolean} Show loading spinner while resolving
 *   - title        {string}  Episode title (for iframe title attr)
 *   - serverName   {string}  Current server name (for external card)
 *   - embedUrl     {string}  Original embed URL (for iframe fallback)
 *   - proxyBase    {string}  API base URL for player-proxy
 */
export default function VideoPlayer({
    streamUrl,
    streamType,
    isResolving,
    title = '',
    serverName = '',
    embedUrl = '',
    proxyBase = '',
}) {
    const iframeRef = useRef(null);
    const containerRef = useRef(null);
    const channelIdRef = useRef(`fik-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [playerOrigin, setPlayerOrigin] = useState('');
    const useNativePlayer = streamType === 'hls' || streamType === 'mp4';

    // ── Listen for fullscreen changes ──
    useEffect(() => {
        const handleFsChange = () => {
            setIsFullscreen(
                !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement)
            );
        };
        document.addEventListener('fullscreenchange', handleFsChange);
        document.addEventListener('webkitfullscreenchange', handleFsChange);
        document.addEventListener('mozfullscreenchange', handleFsChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFsChange);
            document.removeEventListener('webkitfullscreenchange', handleFsChange);
            document.removeEventListener('mozfullscreenchange', handleFsChange);
        };
    }, []);

    const toggleFullscreen = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        if (!isFullscreen) {
            if (container.requestFullscreen) {
                container.requestFullscreen();
            } else if (container.webkitRequestFullscreen) {
                container.webkitRequestFullscreen();
            } else if (container.mozRequestFullScreen) {
                container.mozRequestFullScreen();
            } else if (container.msRequestFullscreen) {
                container.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    }, [isFullscreen]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setPlayerOrigin(window.location.origin);
        }
    }, []);

    const postToPlayer = useCallback((payload) => {
        const targetWindow = iframeRef.current?.contentWindow;
        if (!targetWindow || !playerOrigin) return;
        targetWindow.postMessage({
            channelId: channelIdRef.current,
            ...payload,
        }, playerOrigin);
    }, [playerOrigin]);

    // ── Listen for messages from player.html ──
    const handleMessage = useCallback((event) => {
        const playerWindow = iframeRef.current?.contentWindow;
        if (!playerWindow) return;
        if (event.source !== playerWindow) return;
        if (!playerOrigin || event.origin !== playerOrigin) return;

        const msg = event.data;
        if (!msg || typeof msg !== 'object') return;
        if (msg.source !== 'fikdrama-player') return;
        if (msg.channelId !== channelIdRef.current) return;
        if (typeof msg.type !== 'string') return;

        switch (msg.type) {
            case 'iframeReady':
                // player.html has loaded — now send it the video URL
                if (useNativePlayer && streamUrl && (streamType === 'hls' || streamType === 'mp4')) {
                    postToPlayer({
                        type: 'loadVideo',
                        url: streamUrl,
                        streamType,
                    });
                }
                break;

            case 'playerReady':
                // player.html sent ready signal
                break;

            case 'playerError':
                if (typeof msg.error === 'string' && msg.error.trim()) {
                    console.warn('[VideoPlayer] Player error:', msg.error);
                }
                break;

            case 'timeUpdate':
                // Could be used for watch history, progress tracking, etc.
                if (typeof msg.currentTime !== 'number' || typeof msg.duration !== 'number') return;
                break;
        }
    }, [playerOrigin, postToPlayer, useNativePlayer, streamUrl, streamType]);

    useEffect(() => {
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [handleMessage]);

    // ── Send loadVideo when streamUrl/streamType changes ──
    useEffect(() => {
        if (!useNativePlayer || !streamUrl || !iframeRef.current) return;
        if (streamType !== 'hls' && streamType !== 'mp4') return;

        // Small delay to ensure iframe is ready
        const timer = setTimeout(() => {
            postToPlayer({
                type: 'loadVideo',
                url: streamUrl,
                streamType,
            });
        }, 300);

        return () => clearTimeout(timer);
    }, [postToPlayer, streamUrl, streamType, useNativePlayer]);

    // ── Cleanup on unmount ──
    useEffect(() => {
        return () => {
            try {
                postToPlayer({ type: 'destroy' });
            } catch (_) { }
        };
    }, [postToPlayer]);

    return (
        <div className="video-player-wrapper" ref={containerRef}>
            {/* Custom Fullscreen Wrapper Button */}
            {(!isResolving && streamType && streamType !== 'external') && (
                <button
                    className="video-player__fullscreen-btn"
                    onClick={toggleFullscreen}
                    title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                    {isFullscreen ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                        </svg>
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                        </svg>
                    )}
                </button>
            )}
            {/* Loading overlay */}
            {isResolving && (
                <div className="video-player__loading">
                    <div className="spinner" />
                    <p>Memuat Video...</p>
                </div>
            )}

            {/* External: anti-embed servers (Hydrax, etc.) */}
            {!isResolving && streamType === 'external' && (
                <div className="video-player__external">
                    <div className="video-player__external-icon">🎬</div>
                    <h3>Video tidak dapat ditampilkan di sini</h3>
                    <p>
                        Server <strong>{serverName || 'ini'}</strong> tidak mengizinkan
                        pemutar tertanam. Klik tombol di bawah untuk menonton langsung.
                    </p>
                    <a
                        href={streamUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="video-player__external-btn"
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

            {/* Direct embed for Hydrax / anti-embed servers */}
            {!isResolving && streamType === 'hydrax-iframe' && (
                <iframe
                    src={streamUrl}
                    referrerPolicy="no-referrer"
                    allowFullScreen
                    // eslint-disable-next-line react/no-unknown-property
                    webkitallowfullscreen="true"
                    // eslint-disable-next-line react/no-unknown-property
                    mozallowfullscreen="true"
                    allow="autoplay; fullscreen; picture-in-picture"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    style={{ width: '100%', height: '100%', border: 'none' }}
                />
            )}

            {/* Iframe fallback — embed URL through player-proxy */}
            {!isResolving && streamType === 'iframe' && (
                <iframe
                    src={`${proxyBase}/player-proxy?url=${encodeURIComponent(embedUrl)}`}
                    allowFullScreen
                    // eslint-disable-next-line react/no-unknown-property
                    webkitallowfullscreen="true"
                    // eslint-disable-next-line react/no-unknown-property
                    mozallowfullscreen="true"
                    title={title}
                    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                    referrerPolicy="no-referrer"
                />
            )}

            {/* Unavailable — no stream type determined */}
            {!isResolving && !streamType && (
                <div className="video-player__unavailable">
                    <div className="icon">🎬</div>
                    <h3>Video tidak tersedia</h3>
                    <p>Coba pilih server lain di bawah</p>
                </div>
            )}

            {/* Native player iframe (HLS / MP4) */}
            {useNativePlayer && (
                <iframe
                    ref={iframeRef}
                    src={`/player.html?channelId=${encodeURIComponent(channelIdRef.current)}`}
                    title="Video Player"
                    allowFullScreen
                    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                    style={{
                        display: isResolving ? 'none' : 'block',
                    }}
                />
            )}
        </div>
    );
}
