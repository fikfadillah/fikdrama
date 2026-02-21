/**
 * Utility functions for local storage management
 * Specifically for Watch History and Bookmarks
 */

const HISTORY_KEY = 'fikflix_watch_history';
const BOOKMARKS_KEY = 'fikflix_bookmarks';
const MAX_HISTORY = 50;

export function getCleanTitle(title) {
    if (!title) return '';
    // Removes things like " - Episode 10", " Episode 5", " Ep 1", " Video 1"
    const clean = title.replace(/(?:\s*-\s*)?(?:\b|-)\s*(?:Episode|Ep|Video|Part)\s*\d+.*$/i, '').trim();
    return clean || title; // Fallback to original if regex made it empty
}

export function getHistory() {
    try {
        const data = localStorage.getItem(HISTORY_KEY);
        let history = data ? JSON.parse(data) : [];

        // Deduplicate history to ensure only the latest episode of a series is kept
        const seen = new Set();
        history = history.filter(h => {
            const cleanTitle = getCleanTitle(h.seriesTitle || h.episodeTitle).toLowerCase();
            if (!cleanTitle) return true;
            if (seen.has(cleanTitle)) {
                return false;
            }
            seen.add(cleanTitle);
            return true;
        });

        return history;
    } catch (e) {
        console.warn('Failed to parse watch history', e);
        return [];
    }
}

export function addToHistory(item) {
    if (!item || !item.seriesSlug || !item.episodeSlug) return;

    try {
        let history = getHistory();

        // 1. Clean the title to get a robust series identifier
        const itemCleanTitle = getCleanTitle(item.seriesTitle || item.episodeTitle).toLowerCase();

        // Remove existing entry for the SAME series so it moves to top with latest episode
        history = history.filter(h => {
            const hCleanTitle = getCleanTitle(h.seriesTitle || h.episodeTitle).toLowerCase();
            const sameSlug = h.seriesSlug === item.seriesSlug;
            const sameTitle = hCleanTitle && itemCleanTitle && (hCleanTitle === itemCleanTitle);
            return !(sameSlug || sameTitle);
        });

        // Add to beginning
        history.unshift({
            ...item,
            timestamp: Date.now()
        });

        // Limit size
        if (history.length > MAX_HISTORY) {
            history = history.slice(0, MAX_HISTORY);
        }

        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
        console.warn('Failed to save watch history', e);
    }
}

export function removeFromHistory(seriesSlug) {
    try {
        let history = getHistory();
        history = history.filter(h => h.seriesSlug !== seriesSlug);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
        console.warn('Failed to remove from watch history', e);
    }
}

// --- Bookmarks (Koleksi Saya) ---

export function getBookmarks() {
    try {
        const data = localStorage.getItem(BOOKMARKS_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.warn('Failed to parse bookmarks', e);
        return [];
    }
}

export function toggleBookmark(item) {
    if (!item || !item.slug) return false;

    try {
        let bookmarks = getBookmarks();
        const exists = bookmarks.some(b => b.slug === item.slug);

        if (exists) {
            // Remove it
            bookmarks = bookmarks.filter(b => b.slug !== item.slug);
            localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
            return false; // Result is un-bookmarked
        } else {
            // Add it to top
            bookmarks.unshift({
                ...item,
                addedAt: Date.now()
            });
            localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
            return true; // Result is bookmarked
        }
    } catch (e) {
        console.warn('Failed to toggle bookmark', e);
        return false;
    }
}

export function isBookmarked(slug) {
    try {
        const bookmarks = getBookmarks();
        return bookmarks.some(b => b.slug === slug);
    } catch (e) {
        return false;
    }
}
