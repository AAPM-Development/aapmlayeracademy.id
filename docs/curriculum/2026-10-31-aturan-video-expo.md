# Aturan Kurikulum, Video, dan Kesiapan Expo — 31 Oktober 2026

Lanjutan `2026-10-31-tinjauan-media-dan-bank-soal.md`. Sumber: `AAPM_Kurikulum_Produksi_Slide_3_Kolom.docx`, `AAPM_Expo_Full_Package.zip`, dan kode pada `origin/develop` `237d73ab`.

## Ringkasan

| Bagian | Hasil |
|---|---|
| Bahasa video | Semua video kini terbukti berbahasa Inggris atau Indonesia dari trek takarir YouTube |
| Video lemah | 9 video diganti atau ditambahkan; pilihan editor tidak ditimpa saat impor |
| Sertifikat terverifikasi | Sebelumnya tidak menambah poin dan capaian; kini dihitung |
| Peringkat peserta | Sebelumnya peserta 5 dari 22 modul bisa mencapai peringkat tertinggi; ambang disesuaikan dengan tier |
| Ujian ulang | Urutan soal dan opsi kini diacak per percobaan |
| Paket Expo Academy | Berhasil dimuat ke aplikasi asli di lingkungan lokal |
| Bank soal Expo | **Tidak dipakai**, alasannya di bawah |
| Staging dan Production | **Belum diubah** |

## Video

Bukti bahasa berasal dari trek takarir pada halaman video. Trek otomatis YouTube mengikuti bahasa ujaran. Bukti isi berasal dari judul, kanal, dan deskripsi. Transkrip tidak dapat dibaca otomatis, jadi **tidak ada video yang ditonton utuh**. Tim Produksi perlu memutar video yang berstatus Baru sebelum Production.

Semua video di bawah dapat disematkan (`playableInEmbed`).

| Modul | Sumber | Jenis | Bahasa | Durasi | Status |
|---|---|---|---|---|---|
| 1 | Ministry of Agriculture and Fisheries, Trinidad & Tobago | Pemerintah | Inggris | 35 m | Tetap |
| 2 | Royal Pas Reform, penilaian kualitas DOC metode Pasgar | Perusahaan penetasan | Inggris | 28 m | **Baru**, menggantikan klip 2 menit tanpa takarir |
| 3 | World Poultry Foundation, Poultry Housing | Yayasan | Inggris | 14 m | **Baru**, pindahan dari Modul 9; video lama membahas pemeliharaan anak ayam |
| 4 | Teagasc | Lembaga riset pemerintah | Inggris | 16 m | Tetap |
| 5 | Humphrey Feeds & Pullets | Perusahaan pakan dan pullet | Inggris | 3 m | Tetap, topik tepat |
| 6 | Teagasc | Lembaga riset pemerintah | Inggris | 56 m | Tetap |
| 7 | Medion, Pakan Ayam Petelur dan Manajemen Pemberiannya | Perusahaan kesehatan hewan | Indonesia | 74 m | **Baru**, video lama khusus pullet |
| 8 | Medion, Pengaruh Kualitas Air Minum | Perusahaan kesehatan hewan | Indonesia | 71 m | **Baru**, video lama skala keluarga |
| 9 | Medion, Sistem Perkandangan Closed House Layer | Perusahaan kesehatan hewan | Indonesia | 68 m | **Baru**, cocok dengan closed house layer |
| 10 | Hy-Line North America | Pembibit | Inggris | 30 m | Tetap |
| 11 | Medion, Program Kesehatan Ayam Petelur | Perusahaan kesehatan hewan | Indonesia | 27 m | **Baru**, pembicara dokter hewan |
| 12–14, 16–17 | FAO | Lembaga PBB | Inggris | 5–9 m | Tetap |
| 15 | Nuffield Farming | Yayasan | Inggris | 4 m | Tetap |
| 18 | World Poultry Foundation | Yayasan | Inggris | 12 m | Tetap |
| 19 | Hy-Line International, Critical Management Factors for Layer Performance | Pembibit | Inggris | 49 m | **Baru**, dokumen Hy-Line tetap ada |
| 20 | Food Standards Agency, Inggris | Pemerintah | Inggris | 8 m | Tetap |
| 21 | Oklahoma State University, Strategic Planning for Farm Businesses | Universitas | Inggris | 23 m | **Baru**, menggantikan webinar 2,5 jam |
| 22 | Bloomberg Originals, How Toyota Changed the Way We Make Things | Media | Inggris | 5 m | **Baru**, menggantikan promosi konsultan |

Medion adalah perusahaan komersial. Beberapa tayangannya siaran langsung yang panjang dan bisa menyebut produknya. Tim Produksi perlu menilai bagian itu.

## Slide dan gambar

13 slide dan maket Modul 1 sudah ditinjau dan berbahasa Indonesia. Tabel dari gambar docx modul 9–15 sudah diketik ulang di paket. Modul 2–22 belum punya slide. Slide tidak dibuat pada tinjauan ini karena isinya perlu disetujui tim Produksi.

## Aturan dan perhitungan

| Temuan | Dampak | Perbaikan |
|---|---|---|
| Poin dan capaian menghitung tabel `certificates` lama, padahal klaim menulis ke `certificate_issuances` | Sertifikat terverifikasi tidak menambah 150 poin, tidak membuka "Tersertifikasi", dan daftar admin menampilkan 0 | Satu hitungan: tingkat unik dari sertifikat aktif dan catatan lama. Tingkat yang dicabut tidak dihitung, termasuk catatan lamanya |
| Peringkat tertinggi 900 poin dari kemungkinan sekitar 4.000 | Peserta 5 dari 22 modul berperingkat Layer Leader | Ambang 400, 1.500, dan 2.700, mengikuti tier 1, 3, dan 5 |
| Urutan soal dan opsi selalu sama, sedangkan ujian bisa diulang tanpa batas | Jawaban bisa dihafal dari posisi | Soal dan opsi diacak saat percobaan dibuat. Percobaan yang dilanjutkan tetap sama |
| Layar selesai kuis menulis "Modul 6–17 tuntas" untuk Tingkat 3 | Keliru: tier itu melewati modul 9, 10, dan 14 | Menjadi "semua modul wajib tuntas" |
| Nama chapter di kode masih "Brooding & Rearing" | Berbeda dari naskah dan dari tampilan lain | Mengikuti naskah; nama yang disimpan Admin diutamakan |
| Peserta melihat "Level", naskah dan Admin memakai "Chapter", dan peringkat poin juga disebut level | Dua arti untuk satu kata | Peserta kini melihat "Chapter" |
| Pesan Admin menyuruh mengganti nama chapter lewat draf, tetapi draf menolak nama berbeda | Nama chapter yang sudah terbit tidak bisa diganti dari panel | Paket kini membawa `chapters`, dan impor penuh menyeragamkannya sebagai revisi. Panel Admin belum diubah |
| Kalkulator ROI membuka Modul 16 | Materinya ada di Modul 17 | Tautan diperbaiki |

**Sudah benar dan tidak diubah:** 12 kalkulator dicocokkan dengan panduan naskah, rumus dan ambangnya sama. Modul 1–22 tepat satu kali di enam tier. Ambang lulus 70% dan 80%. Ujian akhir mensyaratkan seluruh modul wajib.

**Prasyarat modul:** tidak ditambah kunci. Aplikasi memang dirancang "Kurikulum terbuka; urutan ini disarankan", dan Tingkat 3 melewati modul 9, 10, serta 14, sehingga kunci berurutan akan bertentangan dengan tier. Syarat yang berlaku tetap: lulus kuis untuk menyelesaikan modul, seluruh modul untuk ujian akhir, dan tier kumulatif untuk sertifikat.

## Bank soal

Bank teraudit dipertahankan: 5 soal per modul dan 30 soal ujian akhir.

Bank Expo (220 + 100 soal) **tidak diterbitkan dan tidak dipakai rekaman**:

- 200 dari 320 soal berupa template, misalnya "Langkah mana yang sesuai dengan checklist materi ... (Poin 7)", dengan opsi salah yang sama dan berulang.
- Bank itu dibuat dari modul lama, sehingga Modul 3 masih menanyakan brooding, padahal naskah membahas kandang open house.
- Ujian akhir 100 soal memakai bank yang sama.

## Paket Expo

Bank teraudit menggantikan bank Expo di salinan kerja. Zip asli tidak diubah. Seeder berjalan pada SQLite baru di luar repositori dengan PHP 8.3 lokal, bukan 8.4 seperti syarat paket.

| Pemeriksaan | Harapan | Hasil |
|---|---|---|
| Akun | 100 | 100 |
| Percobaan kuis modul | Sesuai progres | 1.132 |
| Ujian akhir | 14 | 14 |
| Sertifikat | Dari klaim resmi | 237 |
| KPI | 540 baris, 30 akun, minggu 28–45 | Sama |
| Distribusi 0/3/5/14/18/21/22 modul | 17/15/14/14/11/15/14 | Sama |
| Faiza | 21/22, tier 5 | Sama |
| Agnes | 14/22, tier 3 | Sama |
| Alda | 5/22, tier 2 | Sama |
| Dicky | 22/22, final lulus, tier 6 | Sama |
| Materi | 22 modul dari paket teraudit, 22 video | Sama |

**Perubahan untuk rekaman:**

- Adegan A10–A12 menampilkan 5 soal, bukan 10.
- Nilai yang tampil mengikuti bank teraudit.
- Skenario A36–A45 kini menampilkan poin dengan sertifikat terhitung.
- Bagian Farm tidak dijalankan pada tinjauan ini karena berada di repositori lain.

## Hasil uji

- `npm test` dengan artefak yang dibangun ulang: 332 lulus, 1 gagal, 5 dilewati. Yang gagal, `concurrent policy saves...`, juga gagal sebelum perubahan ini karena PHP lokal memuat modul dua kali.
- Lima tes artefak di `q01` hanya lulus setelah `dist/` dibangun ulang, sebab `public/api` berubah. Jalankan `npm run build:staging` sebelum menilai `npm test`.
- `npm run audit:shell` dengan data Expo: admin 255 dari 255 halaman bersih. Peserta 143 halaman bersih, dan 2 temuan tersisa adalah pemeriksaan menu admin yang memang tidak dimiliki peserta.
- Mode terang: dengan sistem gelap dan tanpa pilihan tersimpan, aplikasi tetap terang.

## Latihan Staging

Staging ternyata kosong (0 modul, 0 soal, tanpa admin), jadi latihan memakai modul dasar dari `database/seed.php`, bukan materi Production. Akun operator dijadikan admin dengan `scripts/security/provision-admin.php`.

| Pemeriksaan di Staging (MariaDB, build `f0def61f`) | Hasil |
|---|---|
| Dry-run lalu apply | 22 modul terbit sebagai revisi baru, tanpa `blocking` |
| Bank soal | 5 soal di 22 modul, 30 soal ujian akhir |
| Video | 22 modul |
| Kuis Modul 1 | 5 soal, soal dan opsi teracak, kunci tetap menunjuk jawaban benar pada 5 dari 5 soal |
| Beranda peserta | Materi baru, peringkat baru, istilah Chapter, mode terang |

Latihan ini tidak membuktikan penanganan slide Modul 1, karena modul dasar tidak punya slide.

## Tidak diuji

Firefox, Safari, dan perangkat fisik. Pengiriman jawaban dan penerbitan sertifikat di MariaDB. Respons APPI, render PDF sertifikat, dan isi video secara utuh.

## Cara menerbitkan

Terminal server dijalankan operator. Urutan: gabungkan ke `develop`, bangun artefak staging, deploy, lalu latihan di Staging.

```bash
AAPLAYERACADEMY_CONFIG=/home/aapp8359/aapmlayeracademy-staging-config.php php scripts/curriculum/import-curriculum-update.php --file=scripts/curriculum/data/2026-10-30-kurikulum-produksi.json --expect-environment=staging --actor-email=EMAIL_ADMIN --dry-run
```

Periksa `blocking` kosong dan `keptMediaBlocks` Modul 1 berisi slide. Lalu jalankan:

```bash
AAPLAYERACADEMY_CONFIG=/home/aapp8359/aapmlayeracademy-staging-config.php php scripts/curriculum/import-curriculum-update.php --file=scripts/curriculum/data/2026-10-30-kurikulum-produksi.json --expect-environment=staging --actor-email=EMAIL_ADMIN --apply --operator=NAMA_OPERATOR --evidence-ref=REFERENSI_PERSETUJUAN
```

Di Staging, periksa Modul 1, 3, 9, 19, satu kuis modul, dan halaman profil peserta bersertifikat. Nama Chapter 2 diseragamkan menjadi "Pondasi" oleh impor penuh; `--modules` tidak mengubahnya.

Production memakai perintah yang sama dengan konfigurasi `aapmlayeracademy-production-config.php` dan `--expect-environment=production`, setelah backup database dan persetujuan tim Produksi. Rincian rollback ada di `2026-10-30-audit-kurikulum-produksi.md`.
