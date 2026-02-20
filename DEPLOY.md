# 🚀 Panduan Deploy FikDrama — Hosting Gratis

> Panduan lengkap cara hosting FikDrama secara gratis untuk frontend maupun backend API.

---

## ✅ Rekomendasi Hosting (Gratis)

| Bagian | Platform Rekomendasi | Alternatif |
|---|---|---|
| **Frontend** | [Vercel](https://vercel.com) ⭐⭐⭐⭐⭐ | Netlify, Cloudflare Pages |
| **Backend API** | [Render](https://render.com) ⭐⭐⭐⭐ | Railway, Koyeb |

### Mengapa ini pilihan terbaik?

```
Frontend → Vercel
  ✅ Zero-config untuk Vite/React
  ✅ Deploy otomatis dari GitHub
  ✅ CDN global gratis
  ✅ Custom domain gratis

Backend → Render
  ✅ Free tier: 750 jam/bulan (cukup untuk 1 service)
  ✅ Support Node.js native
  ✅ Environment variables GUI
  ⚠️  Catatan: Free tier TIDUR setelah 15 menit idle (cold start ~30 detik)
  💡 Solusi: Pakai Koyeb atau Railway jika tidak mau ada cold start
```

---

## ⚙️ Persiapan Sebelum Deploy

### 1. Push ke GitHub terlebih dahulu

```bash
git init
git add .
git commit -m "feat: initial commit"
git remote add origin https://github.com/username/fikdrama.git
git push -u origin main
```

### 2. Buat file konfigurasi yang diperlukan

#### `frontend/vite.config.js` — Pastikan proxy sudah dikonfigurasi

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})
```

> ⚠️ **PENTING**: Setelah deploy, `/api` proxy di Vite TIDAK berfungsi di production.  
> Kamu harus set environment variable di frontend agar tahu URL API production.

#### Tambahkan `VITE_API_URL` di frontend

Buka `frontend/src/services/api.js` dan ubah:

```js
// SEBELUM (hanya untuk local)
const BASE = '/api/v1';

// SESUDAH (support production & local)
const BASE = (import.meta.env.VITE_API_URL || '') + '/api/v1';
```

---

## 🌐 Deploy Backend API ke Render

### Langkah-langkah:

**1.** Buka [render.com](https://render.com) → Sign Up dengan GitHub

**2.** Dashboard → **New** → **Web Service**

**3.** Connect ke repository GitHub kamu

**4.** Konfigurasi:

| Setting | Nilai |
|---|---|
| Name | `fikdrama-api` |
| Root Directory | `api` |
| Runtime | `Node` |
| Build Command | `npm install` |
| Start Command | `node src/app.js` |
| Instance Type | **Free** |

**5.** Environment Variables (klik **Add Environment Variable**):

```
PORT                = 3001
TARGET_BASE_URL     = http://45.11.57.31
REQUEST_DELAY_MS    = 1000
MAX_RETRIES         = 3
CORS_ORIGINS        = https://fikdrama.vercel.app
CACHE_TTL_HOME      = 300
CACHE_TTL_LIST      = 1800
CACHE_TTL_DETAIL    = 3600
```

> ⚠️ Ganti `https://fikdrama.vercel.app` dengan URL frontend kamu yang sebenarnya setelah frontend di-deploy.

**6.** Klik **Create Web Service** → Tunggu deploy selesai (~3-5 menit)

**7.** Catat URL API kamu, contoh: `https://fikdrama-api.onrender.com`

### Mengatasi Cold Start di Render (Free Tier)

Render free tier akan "tidur" setelah 15 menit tidak ada request. Solusinya:

**Opsi A — UptimeRobot (gratis):**
1. Daftar di [uptimerobot.com](https://uptimerobot.com)
2. Add Monitor → HTTP(S)
3. URL: `https://fikdrama-api.onrender.com/api/v1/home`
4. Interval: 5 menit
5. Ini akan ping API setiap 5 menit sehingga tidak pernah tidur

**Opsi B — Upgrade ke Render Starter ($7/bulan)** untuk no sleep.

**Opsi C — Gunakan [Koyeb](https://koyeb.com) (benar-benar gratis, no sleep):**  
Lihat bagian Koyeb di bawah.

---

## 🖥️ Deploy Frontend ke Vercel

### Langkah-langkah:

**1.** Buka [vercel.com](https://vercel.com) → Sign Up dengan GitHub

**2.** Dashboard → **Add New** → **Project**

**3.** Import repository GitHub kamu

**4.** Konfigurasi:

| Setting | Nilai |
|---|---|
| Framework Preset | **Vite** |
| Root Directory | `frontend` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

**5.** Environment Variables:

```
VITE_API_URL = https://fikdrama-api.onrender.com
```

> Ganti dengan URL Render API kamu yang sebenarnya.

**6.** Klik **Deploy** → Tunggu ~2 menit

**7.** Vercel akan beri URL seperti: `https://fikdrama.vercel.app`

**8.** Kembali ke Render → Update `CORS_ORIGINS` dengan URL Vercel ini → **Save**

---

## 🔄 Alternatif: Deploy Backend ke Koyeb (Truly Free, No Sleep)

Koyeb menawarkan tier gratis yang **tidak tidur** — cocok untuk scraper API.

**1.** Daftar di [koyeb.com](https://koyeb.com) dengan akun GitHub

**2.** Dashboard → **Create App** → **GitHub**

**3.** Pilih repository → Konfigurasi:

| Setting | Nilai |
|---|---|
| Name | `fikdrama-api` |
| Instance | **Free** (Nano) |
| Region | Singapore (terdekat ke Indonesia) |
| Root Directory | `api` |
| Build Command | `npm install` |
| Run Command | `node src/app.js` |
| Port | `3001` |

**4.** Environment Variables sama seperti di Render di atas.

**5.** Deploy → URL akan seperti: `https://fikdrama-api-xxx.koyeb.app`

---

## 🚂 Alternatif: Deploy Backend ke Railway

Railway gratis untuk $5 kredit/bulan (cukup untuk 1 service kecil).

**1.** Daftar [railway.app](https://railway.app) dengan GitHub

**2.** **+ New Project** → **Deploy from GitHub Repo**

**3.** Pilih repo → Tambah service → set **Root Directory**: `api`

**4.** Railway akan auto-detect Node.js

**5.** Variables → Tambah semua env vars di atas

**6.** Deploy → URL otomatis di-generate

---

## 🔒 Konfigurasi CORS yang Benar

Setelah kedua service berjalan, pastikan CORS dikonfigurasi dengan benar di `api/.env` (atau env vars hosting):

```env
# Untuk multi-origin (dev + production), pisahkan dengan koma:
CORS_ORIGINS=http://localhost:5173,https://fikdrama.vercel.app
```

---

## 📱 Custom Domain (Opsional, Gratis di Cloudflare)

1. Beli domain murah (atau pakai subdomain gratis)
2. Daftar [Cloudflare](https://cloudflare.com) → Add site
3. Di Vercel: **Settings** → **Domains** → Tambah domain kamu
4. Di Cloudflare: Tambah CNAME record ke `cname.vercel-dns.com`

---

## ⚠️ Hal Penting & Potensi Error

### 1. CORS Error
**Gejala**: Frontend tidak bisa fetch API, error di console browser  
**Penyebab**: URL frontend tidak ada di `CORS_ORIGINS`  
**Solusi**: Tambahkan URL Vercel ke env var `CORS_ORIGINS` di backend

### 2. API Lambat / Timeout (Render Free Tier)
**Gejala**: Request pertama butuh waktu lama setelah tidak aktif  
**Penyebab**: Render free tier cold start  
**Solusi**: Pasang UptimeRobot untuk ping berkala (lihat bagian di atas)

### 3. Frontend `/api` Tidak Bisa Terhubung
**Gejala**: Data tidak muncul di production, tapi local berjalan  
**Penyebab**: Vite proxy hanya bekerja di mode development, bukan di build  
**Solusi**: Set `VITE_API_URL` di Vercel environment variables

### 4. Rate Limit dari Source (429 Error)
**Gejala**: API mengembalikan error 429 saat banyak request  
**Penyebab**: Request terlalu cepat ke sumber data  
**Solusi**: Naikkan `REQUEST_DELAY_MS` ke `1500` atau `2000` di env

### 5. Build Gagal di Vercel
**Gejala**: Deploy gagal dengan error module not found  
**Penyebab**: Root directory tidak disetel ke `frontend`  
**Solusi**: Vercel → Project Settings → General → Root Directory = `frontend`

---

## 📊 Apakah Perlu Swagger UI untuk API?

**Jawaban: Ya, sangat direkomendasikan!** Manfaatnya:

- ✅ Dokumentasi API interaktif yang bisa dicoba langsung
- ✅ Mempermudah debug endpoint
- ✅ Profesional jika API nanti dibagikan ke publik

### Cara tambah Swagger ke API:

```bash
cd api
npm install swagger-jsdoc swagger-ui-express
```

Tambahkan ke `api/src/app.js`:

```js
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'FikDrama API', version: '1.0.0' },
    servers: [{ url: '/api/v1' }],
  },
  apis: ['./src/app.js'],
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
```

Akses di: `https://fikdrama-api.onrender.com/docs`

---

## ✅ Checklist Deploy

```
Persiapan:
[ ] Update api.js: const BASE = (import.meta.env.VITE_API_URL || '') + '/api/v1';
[ ] Push semua perubahan ke GitHub

Backend (Render/Koyeb):
[ ] Set semua environment variables
[ ] Catat URL API yang di-generate

Frontend (Vercel):
[ ] Root Directory = frontend
[ ] Set VITE_API_URL = <URL API kamu>
[ ] Deploy berhasil, catat URL frontend

Post-deploy:
[ ] Update CORS_ORIGINS di backend dengan URL frontend
[ ] Test: buka URL frontend, pastikan data muncul
[ ] Pasang UptimeRobot (jika pakai Render free tier)
[ ] Test pagination, search, dan video player
```

---

## 💡 Saran Tambahan

1. **Gunakan GitHub Actions** untuk CI/CD — auto-deploy setiap push ke `main`
2. **Monitor dengan Betterstack** (gratis) untuk notifikasi jika API down
3. **Caching agresif** di API (naikkan TTL) untuk mengurangi beban scraping
4. **Jangan expose** `TARGET_BASE_URL` ke client-side — selalu handle di backend

---

*Dibuat untuk proyek FikDrama © 2026 fikfadillah*
