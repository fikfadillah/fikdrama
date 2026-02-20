# 🎬 FikDrama

> Platform streaming drama & film Asia dengan subtitle Indonesia. Gratis, tanpa batas.

![Tech Stack](https://img.shields.io/badge/stack-React%20%2B%20Express-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 📁 Struktur Proyek

```
oppastream/
├── api/                    # Backend — Express.js REST API
│   ├── src/
│   │   ├── app.js          # Entry point, routes Express
│   │   ├── scraper/
│   │   │   └── index.js    # Cheerio scraper (fetcher & parser)
│   │   └── middleware/
│   │       └── cache.js    # NodeCache in-memory caching
│   ├── .env                # Environment variables (tidak di-commit)
│   ├── .env.example        # Template env vars
│   └── package.json
│
├── frontend/               # Frontend — React + Vite
│   ├── src/
│   │   ├── pages/          # Home, Category, Detail, Watch, Search, Schedule
│   │   ├── components/     # Navbar, Footer, SeriesCard, Skeleton, dll
│   │   ├── services/
│   │   │   └── api.js      # HTTP client ke backend
│   │   ├── hooks/
│   │   │   └── useFetch.js # Custom hook untuk data fetching
│   │   ├── App.jsx         # Router utama
│   │   └── index.css       # Design system & CSS variables
│   └── package.json
│
└── docker-compose.yml      # Jalankan semua service sekaligus
```

---

## 🧱 Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | React 18, Vite, React Router v6 |
| Styling | Vanilla CSS + CSS Variables |
| Backend | Node.js, Express.js |
| Scraper | Axios + Cheerio |
| Cache | NodeCache (in-memory, TTL-based) |
| Rate Limiting | express-rate-limit |
| Security | Helmet.js, CORS |

---

## ⚡ Mulai Cepat (Local Dev)

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9

### 1. Clone & Install

```bash
git clone <repo-url>
cd oppastream

# Install API dependencies
cd api && npm install

# Install Frontend dependencies
cd ../frontend && npm install
```

### 2. Konfigurasi Environment

```bash
# Salin template
cp api/.env.example api/.env
```

Edit `api/.env`:

```env
PORT=3001
TARGET_BASE_URL=http://45.11.57.31
REQUEST_DELAY_MS=800
MAX_RETRIES=3
CORS_ORIGINS=http://localhost:5173
CACHE_TTL_HOME=300
CACHE_TTL_LIST=1800
CACHE_TTL_DETAIL=1800
```

### 3. Jalankan

Terminal 1 — Backend API:
```bash
cd api
npm run dev     # nodemon (auto-reload)
# API berjalan di http://localhost:3001
```

Terminal 2 — Frontend:
```bash
cd frontend
npm run dev
# Frontend berjalan di http://localhost:5173
```

### 4. Atau Gunakan Docker

```bash
docker compose up --build
```

---

## 🔌 API Endpoints

Base URL: `http://localhost:3001/api/v1`

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/home` | Data homepage (featured + latest) |
| GET | `/series` | Daftar semua series (paginasi, filter type/status) |
| GET | `/series/:slug` | Detail series |
| GET | `/episode/:slug` | Data episode & server video |
| GET | `/search?q=&page=` | Pencarian |
| GET | `/genre/:slug?page=` | Series by genre |
| GET | `/country/:name?page=&type=` | Series by negara & tipe konten |
| GET | `/genres` | Daftar semua genre |
| GET | `/ongoing?page=` | Sedang tayang |
| GET | `/completed?page=` | Sudah tamat |
| GET | `/schedule` | Jadwal tayang |
| GET | `/debug?path=&page=&raw=` | Debug scraper (dev only) |

### Query Parameters `/series`

| Param | Nilai | Contoh |
|---|---|---|
| `page` | angka | `?page=2` |
| `type[]` | `Drama`, `Movie`, `Animation`, `TV Show` | `?type[]=Drama` |
| `status[]` | `Ongoing`, `Completed` | `?status[]=Ongoing` |
| `order` | `update`, `title`, `rating` | `?order=update` |

### Response Format

```json
{
  "success": true,
  "items": [
    {
      "title": "My Holo Love",
      "slug": "my-holo-love",
      "posterUrl": "https://...",
      "rating": 8.2,
      "type": "Drama",
      "status": "Completed",
      "year": "2020",
      "genres": ["Romance", "Sci-Fi"]
    }
  ],
  "pagination": {
    "page": 1,
    "totalPages": 2,
    "hasNext": true
  }
}
```

---

## 🗂️ Halaman Frontend

| Route | Komponen | Deskripsi |
|---|---|---|
| `/` | `Home.jsx` | Homepage dengan hero + update terbaru |
| `/series` | `Category.jsx` | Semua series (Lihat Semua) |
| `/series/:slug` | `Detail.jsx` | Halaman detail |
| `/watch/:slug` | `Watch.jsx` | Halaman nonton dengan video player |
| `/search` | `Search.jsx` | Pencarian |
| `/genre/:slug` | `Category.jsx` | Browse by genre |
| `/country/:name/:type?` | `Category.jsx` | Browse by negara & tipe |
| `/ongoing` | `Category.jsx` | Sedang tayang |
| `/completed` | `Category.jsx` | Sudah tamat |
| `/schedule` | `Schedule.jsx` | Jadwal tayang |

---

## 🏗️ Arsitektur Cache

```
Request → Express Route → Cache Hit? → YES: Kembalikan data
                                   → NO:  Scrape source → Simpan cache → Kembalikan data
```

| Tipe Data | TTL Cache |
|---|---|
| Home | 5 menit |
| List/Category | 30 menit |
| Detail | 30 menit |
| Episode | 1 jam |
| Search | 10 menit |
| Metadata (Genre/Schedule) | 1 jam |

---

## 🔒 Keamanan

- **Helmet.js**: Security headers HTTP
- **CORS**: Dibatasi berdasarkan `CORS_ORIGINS` env var
- **Rate Limiting**: Max request per IP per window
- **Input Sanitization**: Semua parameter di-encode sebelum digunakan di URL scraper

---

## 🤝 Kontribusi

1. Fork repository
2. Buat branch baru: `git checkout -b feat/nama-fitur`
3. Commit perubahan: `git commit -m "feat: tambah fitur X"`
4. Push: `git push origin feat/nama-fitur`
5. Buat Pull Request

---

## 📄 Lisensi

MIT License © 2026 [fikfadillah](https://github.com/fikfadillah)
