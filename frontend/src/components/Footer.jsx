import { Link } from 'react-router-dom';
import './Footer.css';

const CATEGORIES = [
    { label: 'Drama Korea', path: '/country/korea' },
    { label: 'Drama China', path: '/country/china' },
    { label: 'Drama Jepang', path: '/country/japan' },
    { label: 'Film', path: '/category/movie' },
    { label: 'Animasi', path: '/category/animation' },
    { label: 'Variety Show', path: '/category/tv_show' },
];

export default function Footer() {
    return (
        <footer className="footer">
            <div className="container footer__inner">
                <div className="footer__brand">
                    <div className="footer__logo">
                        <span className="logo-icon">▶</span>
                        <span className="logo-text">fikdrama</span>
                    </div>
                    <p className="footer__desc">
                        Nikmati drama & film Asia favorit kamu dengan subtitle Indonesia. Gratis, tanpa batas.
                    </p>
                </div>

                <div className="footer__links">
                    <h4>Kategori</h4>
                    <ul>
                        {CATEGORIES.map((c) => (
                            <li key={c.path}><Link to={c.path}>{c.label}</Link></li>
                        ))}
                    </ul>
                </div>

                <div className="footer__links">
                    <h4>Navigasi</h4>
                    <ul>
                        <li><Link to="/">Beranda</Link></li>
                        <li><Link to="/ongoing">Sedang Tayang</Link></li>
                        <li><Link to="/completed">Sudah Tamat</Link></li>
                        <li><Link to="/schedule">Jadwal Tayang</Link></li>
                    </ul>
                </div>
            </div>

            <div className="footer__bottom">
                <div className="container">
                    <p>© {new Date().getFullYear()} Fikdrama. Data bersumber dari <span className="footer__author">fikfadillah</span> ✍️.</p>
                </div>
            </div>
        </footer>
    );
}
