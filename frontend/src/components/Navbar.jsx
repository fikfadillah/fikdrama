'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '../services/api';
import './Navbar.css';

const COUNTRIES = [
    { slug: 'south-korea', label: 'Korea', code: 'kr' },
    { slug: 'china', label: 'China', code: 'cn' },
    { slug: 'japan', label: 'Jepang', code: 'jp' },
    { slug: 'thailand', label: 'Thailand', code: 'th' },
    { slug: 'taiwan', label: 'Taiwan', code: 'tw' },
    { slug: 'philippines', label: 'Filipina', code: 'ph' },
    { slug: 'hong-kong', label: 'HK', code: 'hk' },
    { slug: 'india', label: 'India', code: 'in' },
    { slug: 'united-states', label: 'Barat', code: 'us' },
];

const MENU = [
    { label: 'Drama', isDropdown: true, contentType: 'drama' },
    { label: 'Film', isDropdown: true, contentType: 'movie' },
    { label: 'Variety', path: '/category/tv_show' },
    { label: 'Animasi', path: '/category/animation' },
    { label: 'Ongoing', path: '/ongoing' },
    { label: 'Completed', path: '/completed' },
    { label: 'Advanced Search', path: '/series' },
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
    const router = useRouter();
    const pathname = usePathname();

    // Scroll shadow
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Close mobile menu on route change
    useEffect(() => { setMobileOpen(false); setSearchOpen(false); }, [pathname]);

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
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
        setSuggestions([]);
        setSearchOpen(false);
        setQuery('');
    }

    return (
        <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
            <div className="container navbar__inner">
                {/* Logo */}
                <Link href="/" className="navbar__logo">
                    <span className="logo-text">FIKFLIX</span>
                </Link>

                {/* Desktop menu */}
                <ul className="navbar__menu">
                    {MENU.map((m) => (
                        <li key={m.label} className={m.isDropdown ? 'navbar__item has-dropdown' : 'navbar__item'}>
                            {m.isDropdown ? (
                                <>
                                    <button className={`navbar__link dropdown-toggle ${COUNTRIES.some(c => pathname === `/country/${c.slug}/${m.contentType}`) ? 'active' : ''}`}>
                                        {m.label}
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                    </button>
                                    <ul className="dropdown-menu">
                                        {COUNTRIES.map((c) => (
                                            <li key={c.slug}>
                                                <Link
                                                    href={`/country/${c.slug}/${m.contentType}`}
                                                    className={`dropdown-link ${pathname === `/country/${c.slug}/${m.contentType}` ? 'active' : ''}`}
                                                >
                                                    <span className="dd-flag" aria-hidden="true">
                                                        <img src={`https://flagcdn.com/${c.code}.svg`} width="18" alt="" style={{ borderRadius: '2px', display: 'block' }} />
                                                    </span>
                                                    <span className="dd-label">{c.label}</span>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            ) : (
                                <Link href={m.path} className={`navbar__link ${pathname === m.path ? 'active' : ''}`}>
                                    {m.label}
                                </Link>
                            )}
                        </li>
                    ))}
                </ul>

                {/* Actions Wrapper */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                                                href={`/series/${item.slug}`}
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
                    {/* Saved Icon */}
                    <Link href="/saved" aria-label="Tersimpan" className="search-toggle" style={{ textDecoration: 'none' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                        </svg>
                    </Link>
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
                                        href={`/country/${c.slug}/${m.contentType}`}
                                        className="mobile-dropdown-link"
                                        onClick={() => setMobileOpen(false)}
                                    >
                                        <img src={`https://flagcdn.com/${c.code}.svg`} width="14" alt="" style={{ borderRadius: '2px' }} /> {c.label}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <Link key={m.path} href={m.path} className="mobile-menu__link" onClick={() => setMobileOpen(false)}>
                            {m.label}
                        </Link>
                    )
                ))}
                <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0' }} />
                <Link href="/saved" className="mobile-menu__link" onClick={() => setMobileOpen(false)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                    Koleksi Tersimpan
                </Link>
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
