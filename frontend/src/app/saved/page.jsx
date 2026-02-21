'use client';
import { useState, useEffect } from 'react';
import { getBookmarks } from '../../utils/storage';
import SeriesCard from '../../components/SeriesCard';
import Link from 'next/link';
import '../category/[type]/Category.css';

export default function Bookmarks() {
    const [bookmarks, setBookmarks] = useState([]);

    useEffect(() => {
        setBookmarks(getBookmarks());
    }, []);

    return (
        <div className="category-page">
            <div className="container">
                <header className="category-header">
                    <h1 className="category-title">
                        Koleksi Tersimpan
                    </h1>
                </header>

                {bookmarks.length > 0 ? (
                    <div className="bookmarks-grid">
                        {bookmarks.map((item, i) => (
                            <SeriesCard key={item.slug || i} item={item} index={i} />
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="icon">📂</div>
                        <h3>Belum ada koleksi tersimpan</h3>
                        <p>Simpan drama atau film favorit Anda agar mudah ditemukan kembali.</p>
                        <Link href="/" className="btn btn-primary" style={{ marginTop: '16px' }}>
                            Mulai Menjelajah
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
