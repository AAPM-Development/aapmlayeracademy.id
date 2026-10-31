# Tinjauan Kurikulum, Media, dan Bank Soal — Implementation Plan

> **For agentic workers:** Dikerjakan inline dengan superpowers:executing-plans.

**Goal:** Meninjau naskah kurikulum dan paket Expo, memastikan media berbahasa Inggris atau Indonesia dari sumber terpercaya, memperbaiki bank soal dan aturan kurikulum, lalu memperbaiki cacat UI yang terkonfirmasi.

**Architecture:** Konten ada di `scripts/curriculum/data/2026-10-30-kurikulum-produksi.json` dan diterbitkan operator lewat `scripts/curriculum/import-curriculum-update.php`. Aturan bersama ada di `src/lib/kpiReading.js`. Artefak `dist/` dihasilkan `npm run build:staging` dan diverifikasi `scripts/deploy/cpanel-deploy.php`; `dist/` tidak boleh diedit tangan.

**Tech Stack:** React, Vite, PHP 8.4, SQLite untuk uji lokal, MariaDB di server.

**Spec:** `docs/curriculum/2026-10-30-audit-kurikulum-produksi.md`. Hasil tinjauan: `docs/curriculum/2026-10-31-tinjauan-media-dan-bank-soal.md`.

## Global Constraints

- Slide dan video hanya berbahasa Inggris atau Indonesia; video harus dari sumber terpercaya.
- Teks soal, opsi benar, kunci, dan pembahasan tidak berubah saat distraktor ditulis ulang.
- Impor ke Production membutuhkan rehearsal Staging dan persetujuan tim Produksi sebagai `--evidence-ref`.

## Review Focus

- Video yang sudah diganti editor tidak boleh ikut terhapus saat daftar pencabutan dijalankan.
- Nilai tepat pada batas FCR harus sama antara kalkulator dan bacaan KPI.
- Artefak harus lolos `aapm_release_verify` di server, bukan hanya di lokal.

---

### Task 1: Perbaiki artefak staging yang rusak

Commit `6f596c49` mengedit `dist/api/bootstrap.php` dengan tangan. Hash file tidak lagi cocok dengan `build-manifest.json` dan sumber berubah tanpa build ulang, sehingga `cpanel-deploy.php` menolak artefak.

- [x] Build ulang dengan `npm run build:staging` dari `3b11cfd1`; artefak `75947dd9`.
- [x] Lolos pemeriksa Node dan PHP, juga pada checkout LF bersih. Deploy 278 berhasil: 218 file, 8 unggahan utuh.

### Task 2: Media

- [x] 13 slide dan maket Modul 1 dibuka satu per satu; angka contoh dihitung ulang.
- [x] Judul dan kanal 22 video diperiksa lewat oEmbed.
- [ ] Bahasa ujaran video: tidak terverifikasi karena YouTube memblokir pemeriksaan otomatis dari jaringan ini. Perlu diputar tim Produksi.
- [x] Video Modul 19 dicabut lewat `removeMediaUrls`; tautan Hy-Line Performance Standards Guide ditambahkan. PDF sudah dibaca.

### Task 3: Bank soal dan aturan

- [x] Tes gagal lebih dulu, lalu 83 opsi salah pada 61 soal ditulis ulang.
- [x] Batas FCR disatukan di `src/lib/kpiReading.js`; catatan egg mass diperbaiki.
- [x] `tests/curriculum-import.test.mjs` dan `tests/curriculum-rules.test.mjs` masuk `npm test`.

### Task 4: Paket Expo

- [x] `sha256sum -c SHA256SUMS`: 41 entri OK, 0 gagal. Zip dan folder identik (42 file).
- [x] `validation.json`: 18 pemeriksaan data PASS. Pemuatan aplikasi dan browser NOT_RUN.

### Task 5: UI

- [x] Audit 14 halaman dalam kondisi login; cacat terkonfirmasi diperbaiki (lihat dokumen tinjauan).

### Task 6: Rilis

- [x] `npm test` 306 lolos, 0 gagal, 5 dilewati; lint lolos; deploy Staging terverifikasi lewat `/api/health`.
- [ ] Impor paket di Staging: menunggu akun Admin dan operator.
- [ ] Production: menunggu rehearsal Staging dan persetujuan tim Produksi.
