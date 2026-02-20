import './Skeleton.css';

export function CardSkeleton() {
    return (
        <div className="card-skeleton">
            <div className="skeleton card-skeleton__thumb" />
            <div className="card-skeleton__body">
                <div className="skeleton" style={{ height: '14px', borderRadius: '4px', marginBottom: '6px' }} />
                <div className="skeleton" style={{ height: '12px', borderRadius: '4px', width: '60%' }} />
            </div>
        </div>
    );
}

export function GridSkeleton({ count = 12 }) {
    return (
        <div className="cards-grid">
            {Array.from({ length: count }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
    );
}

export function DetailSkeleton() {
    return (
        <div className="detail-skeleton">
            <div className="skeleton detail-skeleton__poster" />
            <div className="detail-skeleton__info">
                <div className="skeleton" style={{ height: '32px', borderRadius: '6px', marginBottom: '16px' }} />
                <div className="skeleton" style={{ height: '14px', borderRadius: '4px', marginBottom: '10px' }} />
                <div className="skeleton" style={{ height: '14px', borderRadius: '4px', width: '80%', marginBottom: '10px' }} />
                <div className="skeleton" style={{ height: '14px', borderRadius: '4px', width: '60%' }} />
            </div>
        </div>
    );
}
