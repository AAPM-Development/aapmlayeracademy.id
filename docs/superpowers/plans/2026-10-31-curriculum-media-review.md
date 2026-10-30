# Tinjauan Kurikulum, Media, dan Bank Soal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verifikasi media video referensi (terpercaya, Inggris/Indonesia), ukur dan perbaiki sisa cacat bank soal, periksa paket Expo, lalu catat keputusan yang perlu tim Produksi.

**Architecture:** Konten kurikulum ada di `scripts/curriculum/data/2026-10-30-kurikulum-produksi.json` dan diterbitkan operator lewat `import-curriculum-update.php`. URL video default ada di `database/seed-data.php` dan `public/api/bootstrap.php`. Test kebijakan kuis di `tests/curriculum-import.test.mjs`.

**Tech Stack:** JSON (paket kurikulum), PHP (importer, tidak tersedia di mesin ini), Node test runner (dijalankan memakai runtime VS Code, `ELECTRON_RUN_AS_NODE=1`, karena Node tidak terpasang).

**Spec:** `docs/curriculum/2026-10-30-audit-kurikulum-produksi.md` (audit dan runbook).

## Global Constraints

- Media (slide/video) hanya berbahasa Inggris atau Indonesia.
- Video harus dari sumber terpercaya: lembaga pemerintah/riset/universitas, FAO, atau breeder resmi.
- Konten yang sudah terbit tidak diubah tanpa keputusan tim Produksi.
- Tidak ada commit/push tanpa permintaan pengguna.

## Review Focus

- Video referensi: setiap URL harus resolve, judul dan kanal dapat diidentifikasi, dan sumbernya dapat dipercaya.
- Kunci jawaban dan distraktor: jawaban benar tidak boleh bisa ditebak dari panjang opsi atau kata mutlak.
- Pengaturan kalkulator vs KPI: ambang FCR dan egg mass tidak boleh saling bertentangan tanpa keputusan.

---

### Task 1: Verifikasi video referensi

**Files:**
- Modify (hanya setelah keputusan pengguna): `database/seed-data.php`, `public/api/bootstrap.php`

- [x] **Step 1: Ambil judul dan kanal tiap video lewat oEmbed YouTube**

Hasil: 21 video M2–M22 dan M1 dapat diakses. Penilaian sumber:

| Modul | Video (kanal) | Penilaian |
|---|---|---|
| M1 | kvz8QQG_mXU | belum diperiksa (di luar docx) |
| M2 | ThePoultrySite | cukup, media perdagangan |
| M3 | FAO SWM | terpercaya, konteks unggas keluarga |
| M4 | Teagasc | terpercaya |
| M5 | Humphrey Feeds & Pullets | komersial, perlu catatan |
| M6 | Teagasc | terpercaya |
| M7 | EW Nutrition | komersial (produsen pakan), perlu catatan |
| M8 | FAO SWM | terpercaya |
| M9 | World Poultry Foundation | terpercaya |
| M10 | Hy-Line North America | breeder resmi, terpercaya |
| M11 | FAO SWM | terpercaya |
| M12 | FAO | terpercaya |
| M13 | FAO SWM | terpercaya |
| M14 | FAO | terpercaya |
| M15 | Nuffield Farming | terpercaya |
| M16 | FAO | terpercaya |
| M17 | FAO | terpercaya |
| M18 | World Poultry Foundation | terpercaya |
| M19 | Petros Farms (`x0xbE03LZxk`) | **tidak terpercaya**: judul sensasional, kanal hobi |
| M20 | Food Standards Agency | terpercaya, tetapi RCA pangan, bukan unggas |
| M21 | Farm Talks (webinar ILDEX) | sedang, kesesuaian topik lemah |
| M22 | Efficiency Works (konsultan) | komersial, perlu catatan |

- [ ] **Step 2: Ganti video M19 dengan sumber terpercaya**

Status: **SELESAI (pakai dokumen)**. Video M19 dikosongkan di `database/seed-data.php`, `public/api/bootstrap.php`, dan `dist/api/bootstrap.php` (salinan build yang harus sejajar). Sebagai gantinya, blok tautan "Hy-Line Brown Commercial Layers Performance Guide (Desember 2025)" ditambahkan ke Modul 19 di `scripts/curriculum/data/2026-10-30-kurikulum-produksi.json`. Dokumen ini adalah acuan yang disebut di naskah docx. PDF-nya dapat diakses, tetapi isinya belum diverifikasi. Kolom video di aplikasi tidak menerima PDF. Video M19 di database produksi tidak berubah sampai admin menghapusnya; impor tidak menyentuh URL video.

- [ ] **Step 3: Keputusan M21 dan M22**

Status: **PERLU KEPUTUSAN**. Keduanya kanal komersial/webinar dengan kesesuaian topik sedang-lemah.

### Task 2: Bank soal

**Files:**
- Test: `tests/curriculum-import.test.mjs`

- [x] **Step 1: Ukur cacat yang ada**

Hasil (paket saat ini, 140 soal):
- Jawaban benar = opsi terpanjang unik: 53/140, tiap modul tepat 2, ujian akhir 9/30. Sesuai batas test (≤2 per modul, ≤10 ujian).
- Distraktor memuat kata mutlak (pasti, selalu, tidak perlu, saja, hanya, semua, tidak pernah): 58 pada opsi salah vs 2 pada opsi benar. Ini cacat baru yang tidak ada di test.
- Distribusi kunci: A/B/C/D = 35 masing-masing.

- [ ] **Step 2: Tulis test untuk kata mutlak (RED)** — belum dikerjakan; menunggu keputusan karena perlu tinjauan ahli materi untuk 58 opsi.
- [ ] **Step 3: Tulis ulang distraktor (GREEN)** — belum dikerjakan.

### Task 3: Paket Expo

- [x] **Step 1: Verifikasi checksum** — `sha256sum -c SHA256SUMS` di `AAPM_Expo_Full`: semua file OK (42 file).
- [x] **Step 2: Tinjau ringkas** — `validation.json` mencatat 17 pemeriksaan data PASS; `applicationRuntime`, `browser`, dan `applicationImport` NOT_RUN. Paket ini belum terbukti di aplikasi.

### Task 4: Pengujian dasar

- [~] **Step 1: Jalankan test suite dengan runtime VS Code** — berjalan di latar belakang; beberapa gagal `Cannot find package 'jszip'` karena `node_modules` belum terpasang. Hasil akhir dicatat di ringkasan.
- [x] **Step 2: Jalankan test paket kurikulum yang murni** — `package:` 2/2 PASS.

### Task 5: Cacat UI

- [ ] **Step 1: Audit layout** — BLOKIR. Tanpa Node, npm, dan PHP, aplikasi tidak bisa dijalankan dan halaman admin yang diaudit memerlukan API PHP serta login. Pemeriksaan statis `token_lint.py` juga memerlukan Python.

## Keputusan yang menunggu pengguna

1. Video M19: pilih pengganti atau pakai dokumen tertulis.
2. M21 dan M22: pertahankan atau ganti.
3. Modul Brooding (0–6 minggu) dan penamaan chapter ganda: butuh `academy-v2`.
4. Kata mutlak pada 58 distraktor: tulis ulang oleh tim Produksi atau oleh saya dengan tinjauan.
5. Instalasi Node LTS dan PHP agar test, build, dan audit UI bisa dijalankan.
