import '../index.css';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export const metadata = {
    title: 'Fikflix - Streaming Drama Asia & Donghua Terbaik',
    description: 'Streaming Drama Korea, China, Donghua dengan subtitle Indonesia.',
    icons: {
        icon: '/favicon.png',
    },
    openGraph: {
        title: 'Fikflix - Streaming Drama Asia & Donghua Terbaik',
        description: 'Streaming Drama Korea, China, Donghua dengan subtitle Indonesia.',
        url: 'https://oppastream.test',
        siteName: 'Fikflix',
        locale: 'id_ID',
        type: 'website',
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
