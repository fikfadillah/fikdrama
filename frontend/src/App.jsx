import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Detail from './pages/Detail';
import Watch from './pages/Watch';
import Search from './pages/Search';
import Category from './pages/Category';
import Schedule from './pages/Schedule';
import Bookmarks from './pages/Bookmarks';

export default function App() {
    return (
        <>
            <Navbar />
            <main className="page-wrapper">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/series/:slug" element={<Detail />} />
                    <Route path="/watch/:slug" element={<Watch />} />
                    <Route path="/search" element={<Search />} />
                    <Route path="/category/:type" element={<Category />} />
                    <Route path="/genre/:slug" element={<Category mode="genre" />} />
                    <Route path="/country/:name" element={<Category mode="country" />} />
                    <Route path="/country/:name/:contentType" element={<Category mode="country" />} />
                    <Route path="/series" element={<Category mode="all" />} />
                    <Route path="/ongoing" element={<Category mode="ongoing" />} />
                    <Route path="/completed" element={<Category mode="completed" />} />
                    <Route path="/schedule" element={<Schedule />} />
                    <Route path="/saved" element={<Bookmarks />} />
                </Routes>
            </main>
            <Footer />
        </>
    );
}
