# Aturan Kurikulum, Media, dan Kesiapan Expo — Implementation Plan

> **For agentic workers:** Dikerjakan inline dengan superpowers:executing-plans.

**Goal:** Membuat materi, video, bank soal, perhitungan capaian, dan prasyarat Academy konsisten dengan naskah `AAPM_Kurikulum_Produksi_Slide_3_Kolom.docx`, lalu membuktikan paket Expo Academy berjalan di aplikasi asli.

**Architecture:** Lanjutan dari `origin/develop`. Konten tetap diterbitkan lewat `scripts/curriculum/import-curriculum-update.php` (draf → terbit, tiap modul jadi revisi). Penilaian tetap memakai snapshot soal per percobaan. Perubahan kebijakan `academy-v1` tidak dilakukan.

**Tech Stack:** React, Vite, PHP 8.4 di server (8.3 di lokal), SQLite untuk uji, MariaDB di server, `node:test`.

**Spec:** Permintaan pengguna 31 Oktober 2026, `docs/curriculum/2026-10-30-audit-kurikulum-produksi.md`, `docs/curriculum/2026-10-31-tinjauan-media-dan-bank-soal.md`.

## Global Constraints

- Slide dan video hanya berbahasa Inggris atau Indonesia; video harus dari sumber terpercaya.
- Desain sudah lolos: hanya cacat terkonfirmasi yang diubah.
- Bukti akademik, nilai, sertifikat, dan percobaan yang berjalan tidak ditulis ulang.
- Ambang lulus 70% dan 80%, pemetaan tier, serta kebijakan `academy-v1` tidak berubah.
- Terminal server tidak dipakai agen. Impor Staging dan Production dijalankan operator setelah disetujui.
- Nama karyawan dari paket Expo hanya hidup di lingkungan rekaman lokal, tidak masuk repo.

## Review Focus

- Sertifikat yang dicabut tidak boleh menambah poin; sertifikat lama dan terverifikasi pada tingkat yang sama dihitung sekali.
- Pengacakan opsi harus memetakan ulang `correctIndex`; percobaan yang sudah berjalan tetap memakai urutan lamanya.
- Video pilihan editor tidak boleh tertimpa impor; hanya URL bawaan yang digantikan.
- Nama chapter dari data tetap tampil benar saat data modul belum dimuat.
- Satu percobaan yang dilanjutkan harus menampilkan urutan soal dan opsi yang sama.

---

### Task 1: Video terverifikasi

**Files:** `scripts/curriculum/data/2026-10-30-kurikulum-produksi.json`, `scripts/curriculum/import-curriculum-update.php`, `public/api/bootstrap.php`, `database/seed-data.php`, `tests/curriculum-import.test.mjs`

- [x] Tes gagal: `videoUrl` paket menggantikan URL yang dipensiunkan, mengisi video kosong, dan tidak menyentuh video pilihan editor.
- [x] Importer mendukung `videoUrl` per modul. Paket memakai daftar video terverifikasi.
- [x] Tes daftar video: tiap modul punya bahasa `id` atau `en` dan sumber bernama.

### Task 2: Sertifikat terverifikasi masuk capaian

**Files:** `public/api/bootstrap.php`, `tests/q06-rewards.test.mjs` atau tes capaian baru

- [x] Tes gagal: klaim sertifikat menaikkan poin, `certificateCount`, dan capaian `certified`.
- [x] Hitung tingkat unik dari `certificate_issuances` berstatus aktif dan `certificates` lama, pada profil dan daftar admin.

### Task 3: Urutan soal dan opsi per percobaan

**Files:** `public/api/assessment.php`, `tests/q03-assessment.test.mjs`

- [x] Tes gagal: `correctIndex` snapshot tetap menunjuk opsi benar setelah diacak, jumlah opsi tetap, percobaan yang dilanjutkan tidak berubah.
- [x] Acak urutan soal dan opsi saat percobaan dibuat, sebelum snapshot disimpan.

### Task 4: Nama chapter satu sumber

**Files:** `src/lib/academyData.js`, `src/pages/Home.jsx`, `src/pages/Modules.jsx`, `src/components/search/LearnerQuickSearch.jsx`, `src/lib/academyVisuals.js`

- [x] Tes gagal: nama chapter diambil dari data modul; daftar statis mengikuti naskah.
- [x] Istilah peserta "Level" untuk chapter menjadi "Chapter".

### Task 5: Rumus dan ambang kalkulator

- [x] Cocokkan 12 kalkulator dengan panduan naskah; perbaiki hanya yang berbeda.

### Task 6: Paket Expo di aplikasi asli

- [x] Muat 100 akun ke SQLite baru di luar repo dengan bank soal teraudit.
- [x] Baca balik Faiza 21/22, Agnes 14/22, Alda 5/22, Dicky 22/22 + final, KPI minggu 28–45, verifikasi sertifikat.
- [x] Catat hasil di dokumen bukti tanpa nama karyawan selain tokoh skenario yang sudah ada di paket.

### Task 7: UI

- [x] Jalankan `npm run audit:shell` dan audit layout pada data Expo; perbaiki cacat terkonfirmasi.

### Task 8: Rilis lokal

- [x] `npm test`, lint, tinjauan akhir.
- [x] Tulis langkah operator Staging dan Production.

## Rulings

- Bank soal Expo ditolak: 200 dari 320 soal template dan memakai modul lama. Bila keliru, biaya hanya menyusun ulang bank.
- Kunci modul tidak ditambah: desain aplikasi kurikulum terbuka dan Tingkat 3 melewati modul 9, 10, 14. Bila keliru, perlu kebijakan baru.
- Ambang peringkat 400, 1.500, 2.700. Peringkat tampilan peserta lama bisa turun; capaian tersimpan tetap. Bila keliru, ubah konstanta di `rewards.php` dan `academyData.js`.
- Modul 19 mendapat video Hy-Line tanpa mencabut dokumen tertulis pilihan pengguna.
- Modul 22 mengganti studi kasus unggas dari konsultan dengan Bloomberg Originals: sumber lebih netral, konteks kurang spesifik.
- Default mode terang mengikuti permintaan pengguna; pilihan gelap yang tersimpan tetap dihormati.

## Minor ditunda

- Lencana `certified` tetap terbuka setelah sertifikat dicabut.
- Lencana `level-*` bisa terkunci bagi peserta yang belum membuka profil sejak 12 Oktober 2026.
- Beranda dan menu menghitung catatan sertifikat, bukan tingkat unik.
- Filter chapter tidak menampilkan chapter 15 ke atas.
