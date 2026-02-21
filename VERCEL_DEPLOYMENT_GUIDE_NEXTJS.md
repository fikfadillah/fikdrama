---
description: Panduan Lengkap Deploy FikDrama App ke Vercel (Next.js) dan Perbedaan dengan React+Vite
---

# Panduan Lengkap Deploy Fikflx / FikDrama ke Vercel

Karena aplikasi *frontend* FikDrama sekarang menggunakan **Next.js (App Router)**, proses deployment ke Vercel sebenarnya **jauh lebih diistimewakan dan lebih mudah** dibandingkan menggunakan React + Vite standar. Hal ini karena Vercel adalah kreator asli dari proyek Next.js.

Berikut adalah panduan langkah demi langkah beserta perbedaan kuncinya dengan Vite.

---

## 1. Perbedaan Utama: Next.js vs Vite di Vercel

Sebelum kita mulai, ini adalah alasan mengapa deploy Next.js berbeda (dan lebih *powerful*) dibandingkan React + Vite:

| Fitur / Sifat | React + Vite (SPA) | Next.js App Router |
| :--- | :--- | :--- |
| **Tipe Rendering** | Tersedia hanya CSR (Client-Side Rendering) | Tersedia CSR, SSR, dan otomatis **SSG/ISR** (Statis/Server) |
| **Routing** | Butuh `vercel.json` agar *refresh* halaman (fallback) tidak error (404). | Vercel otomatis mengatasi semua navigasi direktori (`/app/series/page.jsx`). Tanpa _config_. |
| **Fungsi Edge** | Tidak Punya | Otomatis mengubah Endpoint ringan atau _Metadata_ ke Vercel Edge Cache. |
| **Image Optimization**| Biasa: Memerlukan *library* eksternal untuk konversi `webp`. | *Built-in*: Komponen `<Image \>` Next.js dioptimasi otomatis layaknya CDN Premium. |
| **API Proxy Server**| Harus ditangani oleh backend terpisah (Express/Koyeb). | Next.js memiliki `/api` (*Serverless Functions*) sendiri jika dibutuhkan. |

> **Kesimpulan:** Jika sebelumnya di Vite Anda harus menyiapkan file rewrites _vercel.json_, di Next.js **Anda tidak perlu repot sama sekali (Zero Configuration)**.

---

## 2. Persiapan Sebelum Deploy

1. Pastikan seluruh kode Anda sudah di-*commit* ke GitHub/GitLab.
2. Periksa apakah proyek berjalan dengan baik secara internal dengan `npm run build` di terminal lokal Anda (di folder `frontend`). Ini memastikan tidak ada error syntax.
3. Simpan URL API Backend Anda (Misal: URL Render / Koyeb tempat Anda meng-*hosting* `api/src/app.js`).

---

## 3. Langkah-Langkah Eksekusi Deploy di Vercel

### A. Impor Proyek
1. Buka [Vercel Dashboard](https://vercel.com/dashboard).
2. Klik tombol hitam **"Add New..."** lalu pilih **"Project"**.
3. Hubungkan akun GitHub/GitLab Anda (jika belum).
4. Di samping nama repositori FikDrama Anda, klik tombol **"Import"**.

### B. Konfigurasi Proyek
Halaman konfigurasi (*Configure Project*) akan muncul. Atur hal berikut:

1. **Project Name:** `fikflix-web` (atau sesuai selera Anda).
2. **Framework Preset:** Vercel biasanya otomatis mendeteksi. Pastikan tersetel ke **Next.js**.
3. **Root Directory:** 
   - Ini JAUH LEBIH PENTING DARI APAPUN. Karena struktur Anda berbentuk *Monorepo* (ada folder `api` dan `frontend`), klik "Edit" di bagian Root Directory dan **pilih folder `frontend`**.
4. **Build and Output Settings:** Biarkan Default (Vercel tahu cara menjalankan `npm run build` untuk Next.js).
5. **Environment Variables:** 
   - Disini Anda memasukkan penghubung API Backend.
   - **Name:** `NEXT_PUBLIC_API_URL`
   - **Value:** `https://api-barumu.render.com` (← Ganti dengan URL Koyeb/Render Anda sebenarnya)
   - Klik **Add**.

### C. Deploy
1. Klik tombol **Deploy**.
2. Vercel akan secara otomatis menjalankan proses *Linting*, *Building*, dan *Assigning Domain*. Ini biasanya memakan waktu sekitar ~1 Menit karena NextJS akan mengkompilasi file statik (SSG).
3. Selesai! Aplikasi FikDrama Anda akan tampil dan Vercel akan otomatis menampilkan pratinjau cuplikannya. Anda dapat mengklik URL berakhiran `.vercel.app` yang telah disediakan.

---

## 4. Tips Mengatasi Error Saat Deploy Next.js

Karena Next.js merupakan framework berkategori SSR, ia lebih cerewet saat proses kompilasi daripada Vite. Jika deploy gagal di tahap "Build", periksa hal terkait berikut:

1. **ESLint Errors / Peringatan Konsol:** Jika Vercel gagal karena ada deklarasi *unassigned/unused variable* di komponen, atasi di kode aslinya atau (jika darurat), letakkan baris `eslint-ignore-next-line` di atas fungsi bermasalah tersebut.
2. **Target Base URL di Komponen Vercel:** Next.js Serverless Function terkadang tidak membaca variabel Windows. Pastikan Anda hanya menggunakan prefix `NEXT_PUBLIC_` jika variabel itu akan dipanggil dari dalam komponen Client-Side UI seperti `Watch.jsx` atau `Navbar.jsx`.
3. **Gambar Tidak Muncul:** Pada arsitektur `next/image`, apabila Anda sering mengambil gambar dari domain luar (seperti `img.oppastream.com`), pastikan Anda sudah menambahkan host target tersebut pada file `next.config.mjs` Anda.

Contoh modifikasi `next.config.mjs` (Lakukan hanya jika gambar rusak nantinya):
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**', // (hanya untuk testing, ganti dengan domain spesifik jika sudah production)
            },
        ],
    },
};

export default nextConfig;
```

Selamat merilis aplikasi Fikflix Anda ke publik!
