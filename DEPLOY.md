# 🚀 Panduan Deploy FikDrama — 100% Gratis di Vercel

> Kabar baik: Frontend dan Backend API FikDrama **keduanya bisa di-deploy di Vercel secara gratis selamanya**, tanpa server tertidur (no cold sleep)!

---

## ✅ Arsitektur Hosting

Karena repositori ini adalah *monorepo* (berisi folder `api` dan `frontend`), kita akan membuat **2 Project terpisah di Vercel** yang mengambil source code dari 1 repository GitHub yang sama.

| Bagian | Platform | Tipe Vercel | Cold Start? |
|---|---|---|---|
| **Frontend** | Vercel | Static Site (Vite) | Tidak (CDN) |
| **Backend API** | Vercel | Serverless Function (Node.js) | Tidak (Langsung nyala) |

---

## ⚙️ Persiapan (Sudah Selesai)
Pastikan kode terbaru sudah di-push ke GitHub. Proyek ini sudah dikonfigurasi otomatis untuk Vercel:
1. `api/vercel.json` sudah dibuat untuk mengubah Express.js menjadi Vercel Serverless Function.
2. `api/src/app.js` sudah mengekspor aplikasi Express (`module.exports = app`).

---

## 🌐 TAHAP 1: Deploy Backend API (Vercel)

### Langkah-langkah:

**1.** Buka [vercel.com](https://vercel.com) → Sign Up/Login dengan GitHub.

**2.** Dashboard → **Add New** → **Project**.

**3.** Import repository GitHub `fikdrama` kamu.

**4.** Konfigurasi Project API:

| Setting | Nilai | Catatan |
|---|---|---|
| Project Name | `fikdrama-api` | Bebas |
| Framework Preset | **Other** | Penting! Jangan pilih Node.js |
| Root Directory | `api` | Klik Edit, pilih folder `api` |
| Build Command | Kosongkan | Vercel akan otomatis `npm install` |
| Output Directory | Kosongkan | |

**5.** Environment Variables (Buka bagian Environment Variables):

Tambahkan variabel ini satu per satu:
```
TARGET_BASE_URL     = http://45.11.57.31
REQUEST_DELAY_MS    = 1000
MAX_RETRIES         = 3
CORS_ORIGINS        = *
CACHE_TTL_HOME      = 300
CACHE_TTL_LIST      = 1800
CACHE_TTL_DETAIL    = 3600
```
> *(Biarkan `CORS_ORIGINS` bintang `*` dulu, nanti kita ganti setelah frontend selesai).*

**6.** Klik **Deploy** → Tunggu sampai selesai.

**7.** 📝 **CATAT URL API KAMU**, contoh: `https://fikdrama-api.vercel.app`.
Buka `https://fikdrama-api.vercel.app/health` untuk memastikan API berjalan hijau.

---

## 🖥️ TAHAP 2: Deploy Frontend UI (Vercel)

Sekarang kita deploy tampilan webnya.

### Langkah-langkah:

**1.** Kembali ke Dashboard Vercel → **Add New** → **Project**.

**2.** Import LAGI repository GitHub `fikdrama` kamu (Ya, repo yang sama).

**3.** Konfigurasi Project Frontend:

| Setting | Nilai | Catatan |
|---|---|---|
| Project Name | `fikdrama-web` | Bebas |
| Framework Preset | **Vite** | Vercel biasanya auto-detect ini |
| Root Directory | `frontend` | Klik Edit, pilih folder `frontend` |
| Build Command | `npm run build` | |
| Output Directory | `dist` | |

**4.** Environment Variables:

Tambahkan URL API yang kamu catat di Tahap 1:
```
VITE_API_URL = https://fikdrama-api.vercel.app
```
> *(Pastikan TIDAK ADA garis miring `/` di akhir URL).*

**5.** Klik **Deploy** → Tunggu sampai selesai.

**6.** 📝 **CATAT URL FRONTEND KAMU**, contoh: `https://fikdrama-web.vercel.app`. Buka website kamu, semuanya seharusnya sudah berfungsi!

---

## � TAHAP 3: Kunci Keamanan CORS (Sangat Penting)

Agar API kamu tidak dicuri/dipakai oleh website streaming orang lain, kunci CORS-nya:

1. Buka dashboard Vercel untuk project **Backend API** (`fikdrama-api`).
2. Masuk ke tab **Settings** → **Environment Variables**.
3. Cari `CORS_ORIGINS` yang tadi isinya `*`.
4. Edit nilainya menjadi URL Frontend kamu: `https://fikdrama-web.vercel.app`.
5. Klik **Save**.
6. Pergi ke tab **Deployments** → klik titik tiga di deployment terakhir → **Redeploy**.

Selesai! ✨ Sekarang kamu punya website streaming full-stack yang 100% online, ultra-cepat, dan **gratis selamanya**.

---

## ⚠️ Hal Penting & Potensi Error

### 1. Frontend "Data Kosong"
**Penyebab**: `VITE_API_URL` salah tulis atau ada `/` di akhir.
**Solusi**: Cek Environment Variables di project Vercel Frontend.

### 2. Video Player Tidak Muncul
**Penyebab**: Streaming server/proxy memblokir URL lokal.
**Solusi**: Saat di production (Vercel), URL domain kamu sudah publik sehingga streaming server seperti Hydrax/Filelions biasanya mengizinkan pemutaran.

### 3. Swagger UI di Vercel
Swagger UI berjalan sempurna di Vercel Serverless. Buka `https://fikdrama-api.vercel.app/docs` untuk melihat dokumentasi API kamu secara interaktif.

---

*Dibuat untuk proyek FikDrama © 2026 fikfadillah*
