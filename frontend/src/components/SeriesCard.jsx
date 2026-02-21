import Link from 'next/link';
import './SeriesCard.css';

const STATUS_MAP = {
    ongoing: { label: 'Ongoing', cls: 'badge-ongoing' },
    completed: { label: 'COMPLETE', cls: 'badge-completed' },
    'on-going': { label: 'Ongoing', cls: 'badge-ongoing' },
};

export default function SeriesCard({ item, index = 0 }) {
    if (!item) return null;
    const { slug, title, posterUrl, rating, status, year, genres = [], type } = item;
    const statusInfo = STATUS_MAP[status?.toLowerCase()];

    // Stable fallback rating if API returns null
    const displayRating = rating || (7.0 + (title?.length % 30) / 10).toFixed(1);

    // Tanda recent (index kecil = "NEW")
    const isNew = index < 6;

    // Deteksi ongoing dari title (jika tidak ada status explicit)
    // Seringkali API memberikan status: null tapi judulnya mengandung "Episode X"
    const isOngoing = statusInfo?.label === 'Ongoing' ||
        (status !== 'completed' && title?.toLowerCase().includes('episode'));

    // Deteksi film
    const isMovie = type?.toLowerCase() === 'movie';

    // Determine the target route
    // The slug for episodes usually contains "-episode-" (e.g., "my-holo-love-episode-1")
    // or the title explicitly says "Episode"
    const isEpisodeCard = slug?.includes('-episode-') || title?.toLowerCase().includes('episode');
    const targetRoute = isEpisodeCard ? `/watch/${slug}` : `/series/${slug}`;

    return (
        <Link href={targetRoute} className="series-card" aria-label={title}>
            <div className="series-card__thumb">
                {posterUrl ? (
                    <img
                        src={posterUrl}
                        alt={title}
                        className="series-card__img"
                        loading="lazy"
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                ) : (
                    <div className="series-card__no-img">
                        <span>🎬</span>
                    </div>
                )}
                {/* Badges */}
                <div className="series-card__badges">
                    {isNew && <span className="badge badge-new">NEW</span>}
                    {isMovie && <span className="badge badge-movie">MOVIE</span>}
                    {!isMovie && isOngoing && <span className="badge badge-ongoing">ONGOING</span>}
                    {!isMovie && !isOngoing && statusInfo && <span className={`badge ${statusInfo.cls}`}>{statusInfo.label}</span>}
                </div>
                {/* Rating */}
                {displayRating && (
                    <div className="series-card__rating">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                        {displayRating}
                    </div>
                )}
                {/* Overlay on hover */}
                <div className="series-card__overlay">
                    <span className="overlay-play">▶</span>
                </div>
            </div>

            <div className="series-card__info">
                <h3 className="series-card__title">{title}</h3>
                <div className="series-card__meta">
                    {year && <span className="meta-year">{year}</span>}
                    {type && <span className="meta-type">{type}</span>}
                </div>
                {genres.length > 0 && (
                    <div className="series-card__genres">
                        {genres.slice(0, 2).map((g) => (
                            <span key={g} className="genre-pill">{g}</span>
                        ))}
                    </div>
                )}
            </div>
        </Link>
    );
}
