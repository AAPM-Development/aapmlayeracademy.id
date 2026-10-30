# Shell Hardening Desktop dan Mobile — Implementation Plan

> **For agentic workers:** Dikerjakan inline dengan superpowers:executing-plans.

**Goal:** Semua shell (peserta, admin, focus, auth) tetap utuh di setiap lebar dan tinggi layar, dengan desain yang sudah lolos tidak berubah.

**Architecture:** Perbaikan hanya pada aturan shell bersama (`academy.css`, `academy-app.css`, `curriculum.css`) dan markup editor. Tidak ada token, warna, atau komposisi baru.

**Tech Stack:** React, CSS, audit CDP di Chrome (peramban headless) terhadap aplikasi lokal bermasuk.

**Spec:** Standar `ui-ux-layout-standards`, `web-design-guidelines`, dan `design-taste-frontend` bagian app screens.

## Global Constraints

- Desain sudah lolos: hanya cacat terkonfirmasi yang diubah.
- Target chrome di bawah 860 px minimal 40 px; desktop minimal 24 px.
- Temuan otomatis diperiksa di browser sebelum diperbaiki.

## Review Focus

- Menu admin pada layar pendek harus bisa digulir sampai item terakhir.
- Topbar pada lebar 861–940 px tidak boleh mendorong tombol akun keluar layar.
- Bar focus setelah target diperbesar tidak boleh bertabrakan pada lebar 320 px.
- Tombol APPI tidak boleh bersembunyi di belakang bilah aksi kurikulum.

---

### Task 1: Matriks audit

- [x] 23 halaman × 11 ukuran layar, plus skenario interaktif: skip link, sheet, menu akun, palet pencarian, panel APPI, sidebar ciut, halaman tanpa login.

### Task 2: Cacat terkonfirmasi

**Files:** `src/design-system/styles/academy-app.css`, `src/design-system/styles/academy.css`, `src/styles/features/curriculum.css`, `src/pages/admin/AdminModuleEditor.jsx`, `tests/shell-hardening.test.mjs`

| Cacat | Bukti | Perbaikan |
|---|---|---|
| Menu admin terpotong dan tidak bisa digulir | `dialogScroll` 260 px pada 844×390, 82 px pada 320×568, `overflow: hidden` | `.side` di dalam sheet mengisi tinggi sheet sehingga `.side-body` menggulir |
| Garis dan kolom kosong 44 px di sheet | Screenshot 844×390 | `.side` memenuhi lebar sheet |
| Topbar meluap 42 px, tombol akun keluar layar | Lebar 861–900 px | Pencarian yang mengalah, aksi berlebar tetap |
| Editor tanpa `<main>` dan skip link | `main-count` 0 di semua ukuran | Stage editor menjadi `<main>` |
| Target chrome ponsel terlalu kecil | 30×30, 57×32, 32×32 | 40 px di bawah 860 px atau pointer kasar |
| Breadcrumb 20 px | Desktop | Tinggi minimum 24 px |
| Sidebar ciut punya overflow horizontal 8 px | Lebar 72 px | `overflow-x: hidden` |
| Tombol APPI di belakang bilah aksi | `launcher×actionbar` | Dasar tombol naik saat bilah ada |
| Bilah aksi menghabiskan layar landscape | Ruang baca 196 dari 390 px | Bilah mengikuti alur pada tinggi di bawah 500 px |

Bukan cacat setelah diperiksa: halaman APPI (scroller sendiri), `ai-settings` (teks dalam bagian tertutup), tombol APPI di akhir halaman (clearance naik 81 px setelah stabil).

- [x] Tulis tes yang gagal (`tests/shell-hardening.test.mjs`).
- [x] Terapkan perbaikan, termasuk judul panjang, nama akun panjang, `touch-action`, dan kolom email.
- [x] Ulangi matriks: 32 → 246 dari 255 halaman bersih, lalu 14 dari 14 pada lebar yang tersisa setelah perbaikan terakhir. Audit kini menjadi `npm run audit:shell`.

### Task 3: Rilis

- [ ] `npm test`, lint, build staging, deploy, verifikasi.
- [ ] Bangun ulang `claude/release-main`; push ke `main` setelah impor staging dikonfirmasi.
