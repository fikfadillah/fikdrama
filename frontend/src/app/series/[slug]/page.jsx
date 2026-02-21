export async function generateMetadata({ params }) {
    // Next.js 15+ await params requirement
    const resolvedParams = await params;

    // Server-to-server fetch without CORS restriction
    const apiUrl = process.env.VITE_API_URL || 'https://fikflix-api.vercel.app/api/v1';

    try {
        const res = await fetch(`${apiUrl}/series/${resolvedParams.slug}`);
        if (!res.ok) throw new Error('Failed to fetch data');

        const json = await res.json();
        const data = json.data;

        if (!data || !data.title) {
            return { title: 'Series Tidak Ditemukan' };
        }

        const description = data.synopsis
            ? (data.synopsis.length > 150 ? data.synopsis.substring(0, 150) + '...' : data.synopsis)
            : `Nonton ${data.title} subtitle Indonesia kualitas HD hanya di Fikflix.`;

        return {
            title: data.title,
            description: description,
            openGraph: {
                title: `${data.title} | Fikflix`,
                description: description,
                url: `https://fikflix.vercel.app/series/${resolvedParams.slug}`,
                siteName: 'Fikflix',
                images: [
                    {
                        url: data.posterUrl,
                        width: 800,
                        height: 1200,
                        alt: `Poster ${data.title}`
                    },
                ],
                type: 'video.tv_show',
            },
            twitter: {
                card: 'summary_large_image',
                title: data.title,
                description: description,
                images: [data.posterUrl],
            }
        };
    } catch (e) {
        return {
            title: 'Detail Series',
        };
    }
}

import ClientPage from './ClientPage';

export default async function Page({ params }) {
    const p = await params;
    return <ClientPage params={p} />;
}
