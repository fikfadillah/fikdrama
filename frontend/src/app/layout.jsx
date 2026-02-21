import '../index.css';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export const metadata = {
    metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://fikflix.vercel.app'),
    title: {
        template: '%s | Fikflix',
        default: 'Fikflix - Streaming Drama Asia & Donghua Terbaik', // a default is required when creating a template
    },
    description: 'Nonton Streaming Drama Korea, China, Donghua, dan Film Asia terbaru dengan subtitle Indonesia secara gratis dan mudah di Fikflix.',
    keywords: ['nonton drama', 'streaming drakor', 'nonton donghua', 'nonton anime', 'drama china subtitle indonesia', 'nonton film', 'fikflix'],
    authors: [{ name: 'Fikflix' }],
    creator: 'Fikflix',
    openGraph: {
        title: 'Fikflix - Streaming Drama Asia & Donghua Terbaik',
        description: 'Nonton Streaming Drama Korea, China, Donghua, dan Film Asia terbaru dengan subtitle Indonesia secara gratis dan mudah di Fikflix.',
        url: 'https://fikflix.vercel.app',
        siteName: 'Fikflix',
        images: [
            {
                url: '/favicon.png', // Fallback opengraph image
                width: 800,
                height: 600,
            },
        ],
        locale: 'id_ID',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Fikflix - Streaming Drama Asia & Donghua Terbaik',
        description: 'Nonton Streaming Drama Korea, China, Donghua, dan Film Asia terbaru dengan subtitle Indonesia secara gratis dan mudah di Fikflix.',
        creator: '@fikflix',
    },
    icons: {
        icon: '/favicon.png',
        shortcut: '/favicon.png',
        apple: '/favicon.png',
    },
};

export default function RootLayout({ children }) {
    return (
        <html lang="id">
            <body>
                <Navbar />
                <main className="page-wrapper">{children}</main>
                <Footer />
            </body>
        </html>
    );
}
