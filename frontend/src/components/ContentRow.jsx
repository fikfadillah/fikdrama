import { useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useFetch } from '../hooks/useFetch';
import { GridSkeleton } from './Skeleton';

const SeriesCard = dynamic(() => import('./SeriesCard'), {
    ssr: false,
    loading: () => <div className="content-row__item"><GridSkeleton count={1} /></div>
});

const ContentRow = ({ title, fetcher, seeAllLink, items }) => {
    // Skip fetching if items are explicitly provided
    const { data: rowData, loading: fetchLoading, error: fetchError } = fetcher
        ? useFetch(fetcher, [])
        : { data: null, loading: false, error: null };

    const sliderRef = useRef(null);

    const rowLoading = fetcher ? fetchLoading : false;
    const rowError = fetcher ? fetchError : null;

    // Safely extract the array, fallback to empty array if not found
    const rowList = items || rowData?.series || rowData?.latest || rowData?.items || (Array.isArray(rowData) ? rowData : []);
    const rowItems = rowList.slice(0, 15);

    if (rowError || (!rowLoading && rowItems.length === 0)) return null;

    const scroll = (direction) => {
        if (sliderRef.current) {
            const clientWidth = sliderRef.current.clientWidth;
            // Scroll by 75% of the visible container width
            const scrollAmount = direction === 'left' ? -(clientWidth * 0.75) : (clientWidth * 0.75);
            sliderRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    return (
        <div className="content-row">
            <div className="content-row__header">
                <h2 className="content-row__title">{title}</h2>
                {seeAllLink && (
                    <Link href={seeAllLink} className="content-row__see-all">
                        Lihat Semua <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 18l6-6-6-6" /></svg>
                    </Link>
                )}
            </div>
            <div className="content-row__slider-container">
                {/* Left Scroll Button */}
                {!rowLoading && rowItems.length > 4 && (
                    <button className="slider-btn slider-btn--left" onClick={() => scroll('left')} aria-label="Geser ke kiri">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M15 18l-6-6 6-6" /></svg>
                    </button>
                )}

                {rowLoading ? (
                    <div className="content-row__slider" ref={sliderRef}>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="content-row__item"><GridSkeleton count={1} /></div>
                        ))}
                    </div>
                ) : (
                    <div className="content-row__slider" ref={sliderRef}>
                        {rowItems.map((item, i) => (
                            <div key={item.slug || i} className="content-row__item">
                                <SeriesCard item={item} index={i} />
                            </div>
                        ))}
                    </div>
                )}

                {/* Right Scroll Button */}
                {!rowLoading && rowItems.length > 4 && (
                    <button className="slider-btn slider-btn--right" onClick={() => scroll('right')} aria-label="Geser ke kanan">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 18l6-6-6-6" /></svg>
                    </button>
                )}
            </div>
        </div>
    );
};

export default ContentRow;
