export async function generateMetadata({ params }) {
    const resolvedParams = await params;
    const apiUrl = process.env.VITE_API_URL || 'https://fikflix-api.vercel.app/api/v1';

    try {
        // Fetch episode data
        const epRes = await fetch(`${apiUrl}/episode/${resolvedParams.slug}`);
        if (!epRes.ok) throw new Error('Episode not found');
        const epData = (await epRes.json()).data;

        if (!epData || !epData.title) return { title: 'Episode Tidak Ditemukan' };

        // Try to fetch series data for better context (poster and synopsis)
        let seriesTitle = epData.title;
        let posterUrl = '';
        let description = `Nonton ${epData.title} dengan subtitle Indonesia kualitas terbaik secara gratis di Fikflix.`;

        // Derive series slug from episode slug (e.g. "my-drama-episode-1" -> "my-drama")
        const isEpisodeMatch = resolvedParams.slug.match(/(.*?)-episode-\d+/i);
        const derivedSeriesSlug = epData.seriesSlug || (isEpisodeMatch ? isEpisodeMatch[1] : null);

        if (derivedSeriesSlug) {
            try {
                const sRes = await fetch(`${apiUrl}/series/${derivedSeriesSlug}`);
                if (sRes.ok) {
                    const sData = (await sRes.json()).data;
                    seriesTitle = sData.title || seriesTitle;
                    posterUrl = sData.posterUrl || '';
                    if (sData.synopsis) {
                        description = `Nonton ${epData.title} - ${sData.synopsis.substring(0, 100)}...`;
                    }
                }
            } catch (e) {
                // Ignore series fetch error
            }
        }

        return {
            title: `${epData.title} - Nonton Streaming`,
            description: description,
            openGraph: {
                title: `${epData.title} | Fikflix`,
                description: description,
                url: `https://fikflix.vercel.app/watch/${resolvedParams.slug}`,
                siteName: 'Fikflix',
                images: posterUrl ? [{
                    url: posterUrl,
                    width: 800,
                    height: 1200,
                    alt: `Poster ${seriesTitle}`
                }] : [],
                type: 'video.episode',
            },
            twitter: {
                card: 'summary_large_image',
                title: `${epData.title} | Fikflix`,
                description: description,
                images: posterUrl ? [posterUrl] : [],
            }
        };

    } catch (e) {
        return { title: 'Nonton Episode' };
    }
}

import ClientPage from './ClientPage';

export default async function Page({ params }) {
    const p = await params;
    return <ClientPage params={p} />;
}
