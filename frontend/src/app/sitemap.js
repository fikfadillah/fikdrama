export default async function sitemap() {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://fikflix.vercel.app';
    const apiUrl = process.env.VITE_API_URL || 'https://fikflix-api.vercel.app/api/v1';

    // Base routes
    const routes = [
        '',
        '/ongoing',
        '/schedule',
        '/completed',
        '/category/movie',
        '/category/animation'
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: route === '' ? 1 : 0.8,
    }));

    try {
        // Fetch latest series for the sitemap (up to 5 pages / 100 items for the sitemap)
        // Note: A real production app might need a dedicated /sitemap endpoint that returns just slugs
        const res = await fetch(`${apiUrl}/series?page=1&limit=100`, { next: { revalidate: 3600 } });

        if (res.ok) {
            const json = await res.json();
            const items = json.data?.items || [];

            const seriesRoutes = items.map((item) => ({
                url: `${baseUrl}/series/${item.slug}`,
                lastModified: new Date(),
                changeFrequency: 'weekly',
                priority: 0.7,
            }));

            return [...routes, ...seriesRoutes];
        }
    } catch (e) {
        console.error('Sitemap fetch error:', e);
    }

    return routes;
}
