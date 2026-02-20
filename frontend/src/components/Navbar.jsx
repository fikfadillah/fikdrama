import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import './Navbar.css';

const COUNTRIES = [
    { slug: 'south-korea', label: 'Korea', flag: '🇰🇷' },
    { slug: 'china', label: 'China', flag: '🇨🇳' },
    { slug: 'japan', label: 'Jepang', flag: '🇯🇵' },
    { slug: 'thailand', label: 'Thailand', flag: '🇹🇭' },
    { slug: 'taiwan', label: 'Taiwan', flag: '🇹🇼' },
    { slug: 'philippines', label: 'Filipina', flag: '🇵🇭' },
    { slug: 'hong-kong', label: 'HK', flag: '🇭🇰' },
    { slug: 'india', label: 'India', flag: '🇮🇳' },
    { slug: 'united-states', label: 'Barat', flag: '🇺🇸' },
];

const MENU = [
    { label: 'Drama', isDropdown: true, contentType: 'drama' },
    { label: 'Film', isDropdown: true, contentType: 'movie' },
    { label: 'Ongoing', path: '/ongoing' },
    { label: 'Completed', path: '/completed' },
    { label: 'Jadwal', path: '/schedule' },
];

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [sugLoading, setSugLoading] = useState(false);
    const searchRef = useRef(null);
    const debounceRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();

    // Scroll shadow
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Close mobile menu on route change
    useEffect(() => { setMobileOpen(false); setSearchOpen(false); }, [location]);

    // Live search suggestions
    useEffect(() => {
        if (!query.trim()) { setSuggestions([]); return; }
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setSugLoading(true);
            try {
                const res = await api.search(query.trim(), 1);
                setSuggestions((res.items || []).slice(0, 6));
            } catch { setSuggestions([]); }
            finally { setSugLoading(false); }
        }, 400);
        return () => clearTimeout(debounceRef.current);
    }, [query]);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setSuggestions([]);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    function handleSearch(e) {
        e.preventDefault();
        if (!query.trim()) return;
        navigate(`/search?q=${encodeURIComponent(query.trim())}`);
        setSuggestions([]);
        setSearchOpen(false);
        setQuery('');
    }

    return (
        <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
            <div className="container navbar__inner">
                {/* Logo */}
                <Link to="/" className="navbar__logo">
                    <span className="logo-icon">▶</span>
                    <span className="logo-text">fikdrama</span>
                </Link>

                {/* Desktop menu */}
                <ul className="navbar__menu">
                    {MENU.map((m) => (
                        <li key={m.label} className={m.isDropdown ? 'navbar__item has-dropdown' : 'navbar__item'}>
                            {m.isDropdown ? (
                                <>
                                    <button className={`navbar__link dropdown-toggle ${COUNTRIES.some(c => location.pathname === `/country/${c.slug}/${m.contentType}`) ? 'active' : ''}`}>
                                        {m.label}
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                    </button>
                                    <ul className="dropdown-menu">
                                        {COUNTRIES.map((c) => (
                                            <li key={c.slug}>
                                                <Link
                                                    to={`/country/${c.slug}/${m.contentType}`}
                                                    className={`dropdown-link ${location.pathname === `/country/${c.slug}/${m.contentType}` ? 'active' : ''}`}
                                                >
                                                    <span className="dd-flag" aria-hidden="true">{c.flag}</span>
                                                    <span className="dd-label">{c.label}</span>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            ) : (
                                <Link to={m.path} className={`navbar__link ${location.pathname === m.path ? 'active' : ''}`}>
                                    {m.label}
                                </Link>
                            )}
                        </li>
                    ))}
                </ul>

                {/* Search */}
                <div className={`navbar__search ${searchOpen ? 'navbar__search--open' : ''}`} ref={searchRef}>
                    <button
                        className="search-toggle"
                        onClick={() => { setSearchOpen(!searchOpen); if (!searchOpen) setTimeout(() => searchRef.current?.querySelector('input')?.focus(), 150); }}
                        aria-label="Toggle search"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                        </svg>
                    </button>

                    {searchOpen && (
                        <form className="search-form" onSubmit={handleSearch}>
                            <input
                                className="search-input"
                                placeholder="Cari drama, film..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                autoFocus
                            />
                            {(suggestions.length > 0 || sugLoading) && (
                                <div className="search-dropdown">
                                    {sugLoading && <div className="search-loading">Mencari...</div>}
                                    {suggestions.map((item) => (
                                        <Link
                                            key={item.slug}
                                            to={`/series/${item.slug}`}
                                            className="search-item"
                                            onClick={() => { setSuggestions([]); setSearchOpen(false); setQuery(''); }}
                                        >
                                            {item.posterUrl && <img src={item.posterUrl} alt={item.title} className="search-item__img" />}
                                            <div>
                                                <div className="search-item__title">{item.title}</div>
                                                {item.year && <div className="search-item__year">{item.year}</div>}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </form>
                    )}
                </div>

                {/* Mobile hamburger */}
                <button
                    className={`hamburger ${mobileOpen ? 'hamburger--open' : ''}`}
                    onClick={() => setMobileOpen(!mobileOpen)}
                    aria-label="Toggle menu"
                >
                    <span /><span /><span />
                </button>
            </div>

            {/* Mobile menu */}
            <div className={`mobile-menu ${mobileOpen ? 'mobile-menu--open' : ''}`}>
                {MENU.map((m) => (
                    m.isDropdown ? (
                        <div key={m.label} className="mobile-dropdown">
                            <div className="mobile-dropdown-label">{m.label}</div>
                            <div className="mobile-dropdown-grid">
                                {COUNTRIES.map((c) => (
                                    <Link
                                        key={c.slug}
                                        to={`/country/${c.slug}/${m.contentType}`}
                                        className="mobile-dropdown-link"
                                        onClick={() => setMobileOpen(false)}
                                    >
                                        {c.flag} {c.label}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <Link key={m.path} to={m.path} className="mobile-menu__link" onClick={() => setMobileOpen(false)}>
                            {m.label}
                        </Link>
                    )
                ))}
                <form onSubmit={handleSearch} className="mobile-search">
                    <input
                        className="search-input"
                        placeholder="Cari..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <button type="submit" className="btn btn-primary">Cari</button>
                </form>
            </div>
        </nav>
    );
}
