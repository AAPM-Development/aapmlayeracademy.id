# Audit Kurikulum Produksi — 30 Oktober 2026

**Sumber:** `AAPM_Kurikulum_Produksi_Slide_3_Kolom.docx` (naskah kerja tim Produksi, ekstraksi 26 Oktober 2026 dengan tambahan 27 Oktober 2026)
**Cakupan:** 14 chapter, 22 modul, bank soal tiap modul, bank ujian akhir, panduan kalkulator
**Hasil:** paket konten terkoreksi `scripts/curriculum/data/2026-10-30-kurikulum-produksi.json` dan skrip operator `scripts/curriculum/import-curriculum-update.php`

## Ringkasan

| # | Temuan kritis | Dampak | Status di paket |
|---|---|---|---|
| 1 | Modul 2–22 masing-masing hanya punya **1 soal** | Kuis modul bernilai 0% atau 100%; kelulusan 70% tidak bermakna | Diperbaiki: 5 soal per modul |
| 2 | Kunci jawaban bias ke **A**: ujian akhir 6/6 = A; modul 3–22 18 dari 20 = A | Peserta bisa lulus tanpa membaca | Diperbaiki: 140 soal, kunci A/B/C/D masing-masing 35 |
| 3 | Modul 3: materi tentang kandang open house, tetapi tujuan, poin utama, checklist, tugas, naskah video, dan soal tentang **brooding** | Isi modul tidak konsisten | Diperbaiki: seluruh bagian diselaraskan ke open house |
| 4 | Modul 9: perhitungan kipas **sirkular** (jumlah kipas → kecepatan → jumlah kipas), menghasilkan 4,08 m/detik | Tidak bisa dipakai merancang kandang | Diperbaiki: dihitung dari target kecepatan → 12 kipas, dengan cek silang bobot ayam |
| 5 | 13 gambar di modul 9–15 adalah **tangkapan layar penuh**: WhatsApp Web dengan nama kontak, path file lokal, taskbar, halaman panduan Lohmann berhak cipta, dan jadwal vaksin internal berisi nama petugas | Privasi, hak cipta, dan program vaksin yang belum disetujui dokter hewan ikut terbit | Tidak diunggah; data kunci diketik ulang sebagai tabel dengan sitasi |
| 6 | Modul 10: "pemberian pakan diperhitungkan dengan FCR harian" | Konsep keliru: jatah pakan ditentukan target konsumsi g/ekor/hari, FCR adalah hasil | Diperbaiki |
| 7 | Tidak ada modul **Brooding (0–6 minggu)** | Celah antara seleksi DOC (M2) dan rearing 7–17 minggu (M4) | Rekomendasi (perlu kebijakan kurikulum baru) |

## A. Susunan kurikulum (rekomendasi, tidak diubah otomatis)

Nomor modul bersifat permanen dan kebijakan `academy-v1` mengunci 22 modul wajib. Perubahan struktur berikut perlu keputusan editorial dan, untuk modul baru, kebijakan kurikulum baru (`academy-v2`) melalui Admin → Kebijakan kurikulum lalu `scripts/curriculum/activate-policy.php`.

1. **Nama chapter ganda.** Chapter 1 "Foundation" dan Chapter 2 "Pondasi" berarti sama. Usulan Chapter 2: "Housing & Rearing" atau "Kandang & Pemeliharaan Pullet".
2. **Modul Brooding hilang.** Usulan modul baru "Brooding: DOC sampai 6 Minggu" di Chapter 2, sebelum Growing & Rearing.
3. **Open house vs closed house.** Modul 3 membahas open house, modul 9–13 ditulis untuk closed house. Paket menandai konteks ini di materi; pertimbangkan satu modul pengantar perbandingan sistem kandang.
4. **Nutrisi tumpang tindih.** Tabel nutrisi berada di Modul 10 (closed house). Paket memindahkannya ke Modul 7 dan Modul 10 merujuk ke sana.
5. **Bahasa judul campur.** Contoh: "Closed House Komponen, Feed, Water and Lighting Program". Paket menyeragamkan judul yang diubah; chapter tetap seperti sekarang.
6. **Daftar isi docx tidak sinkron.** Modul 9 tertulis "Suhu, Kelembapan, dan Ventilasi" di daftar isi tetapi "Climate" di badan dokumen. Judul baru: "Climate: Suhu, Kelembapan, dan Ventilasi".
7. **Acuan strain bercampur.** Materi memakai Lohmann Brown-Classic (2021), Lohmann Brown (Layer Book 2013), dan Hy-Line Brown (2025, panduan kalkulator). Contoh: bobot 16 minggu 1.330 g (2013) vs 1.351 g (2021). Tetapkan satu acuan strain dan versi panduan per farm.

## B. Materi per modul

| Modul | Temuan | Perbaikan di paket |
|---|---|---|
| 1 | Checklist ganda "Menghitung egg revenue sederhana", butir "Test"; soal KPI tidak sesuai topik; tidak ada contoh hitung | Checklist dibersihkan; soal KPI dipindah ke M14; tabel pendapatan/biaya dan dua contoh hitung ditambahkan |
| 2 | Judul terlalu panjang dan diakhiri titik; outline video tercampur di materi; "jarak tulang pubis 2–3 jari" ditulis untuk 16 minggu (seharusnya menjelang telur pertama); harga pullet "3–4x DOC" tanpa acuan; typo "diperhartikan", "menentuan" | Judul "Seleksi Bibit: DOC vs Pullet Siap Bertelur"; outline dipindah ke naskah video; parameter dikoreksi; harga merujuk harga pasar aktual |
| 3 | Lihat temuan kritis #3; tanda baca ganda ".."; arah angin vs matahari belum dijelaskan bila bertentangan | Ditulis ulang untuk open house; tabel dimensi; aturan prioritas orientasi |
| 4 | Benar, tetapi tanpa standar bobot | Tabel bobot standar strain; aturan pergantian pakan berdasarkan bobot |
| 5 | "tulang medullary" | "tulang meduler"; tabel urutan transfer, pakan pre-lay, stimulasi cahaya |
| 6 | Tanpa target strain | Tabel target HDP/egg weight/egg mass dan contoh hitung |
| 7 | Materi tipis | Rumus kadar nutrisi dan tabel kebutuhan nutrisi fase 1 (dari screenshot M10) |
| 8 | Tanpa ambang rasio air:pakan | Ambang sesuai kalkulator; titik sampel air di ujung jalur |
| 9 | Typo "Equitment"; tujuan "mengukur kebutuhan oksigen" tidak dibahas; perhitungan kipas sirkular; label "Raw"; kapasitas kipas berbeda dengan kalkulator (32.000 vs ±20.400 m³/jam); tabel suhu adalah suhu brooding | Tujuan diganti standar kualitas udara; perhitungan dari target kecepatan; catatan kapasitas kipas; catatan suhu tropis |
| 10 | Konsep jatah pakan berbasis FCR (temuan #6); judul campur bahasa; typo "memeriksan", "bersiko", "uni genset", "produktifitas", "resiko" | Dikoreksi; program cahaya diketik ulang sebagai tabel |
| 11 | Dua kalimat ringkasan; typo "faces", "prilaku", "pembatan", "pernafasan"; screenshot jadwal vaksin internal (nama petugas, lokasi, merek, dosis) | Dibersihkan; diganti panduan isi catatan vaksinasi; contoh program hanya setelah disetujui dokter hewan |
| 12 | "bak diving", "Rolling desinfektan"; tinggi pagar 4 m tanpa konteks | "bak celup", "rotasi jenis desinfektan"; pagar ditandai sebagai spesifikasi farm; tabel zona dan aspek |
| 13 | Typo "diperiksan", "berdasarkan berdasarkan" | Dikoreksi; tabel kelas berat menurut umur |
| 14 | Tanpa contoh definisi KPI | Data dictionary; soal fungsi KPI dari M1 |
| 15 | Rumus FCR tanpa satuan kg; screenshot target dan bobot; label kalkulator egg mass ≥ 57 "Excellent" di bawah target puncak strain (58–61 g) | Rumus dengan satuan; tabel target dan bobot; catatan benchmark |
| 16–22 | Materi template; naskah video template identik | Naskah video spesifik; contoh hitung/kasus per modul |

Seluruh 22 modul sebelumnya memakai naskah video template "Pada lesson ini kita membahas ... Fokuskan pengamatan pada proses, angka KPI, dan tindakan koreksi"; Modul 3 bahkan masih menyebut "Brooding: DOC sampai 6 Minggu".

## C. Bank soal

| | Sebelum | Sesudah |
|---|---|---|
| Soal modul | M1: 5; M2–M22: 1 per modul (26 total) | 5 per modul (110 total) |
| Ujian akhir | 6 soal, semua kunci A | 30 soal mencakup 14 chapter |
| Sebaran kunci | Didominasi A | A 35, B 35, C 35, D 35; tiap modul memakai keempat huruf |
| Distraktor | Banyak yang tidak masuk akal ("Warna kandang saja") | Contoh paling tidak masuk akal diganti dengan miskonsepsi atau salah hitung yang umum; sebagian opsi lemah masih ada (lihat catatan) |
| Jawaban benar = opsi terpanjang | Belum diukur | 53 dari 140 soal (38%); maksimal 2 dari 5 per modul dan 9 dari 30 di ujian akhir, sehingga selalu memilih opsi terpanjang tidak meluluskan kuis mana pun |
| Kelulusan | 70% dari 1 soal | Modul: minimal 4 dari 5; ujian akhir (80%): minimal 24 dari 30 |

Setiap soal memiliki pembahasan, tingkat kesulitan, dan tujuan pembelajaran. Semua soal hitungan sudah diverifikasi ulang. Sejak 31 Oktober 2026 aplikasi mengacak urutan soal dan opsi per percobaan; sebaran kunci di paket tetap dipertahankan.

**Catatan untuk reviu tim Produksi:**

- Angka 38% masih di atas peluang acak (25%), dan opsi yang memakai kata mutlak seperti "pasti", "selalu", atau "tidak perlu" masih cenderung salah. Bank soal ini layak terbit sebagai perbaikan, tetapi belum melalui reviu ahli materi.
- Tabel nutrisi M7, program cahaya M10, kelas berat M13, serta target performa dan bobot badan M15 sudah dicocokkan baris demi baris dengan tangkapan layar di docx yang diaudit, dan semuanya sama. Ini mencocokkan salinan, bukan menilai kebenaran materi; kesesuaian acuan strain untuk tiap farm tetap keputusan tim Produksi.

## D. Panduan kalkulator

Kedua belas contoh perhitungan diverifikasi dan hasilnya benar. Catatan yang perlu diputuskan tim:

1. Batas FCR berbeda antara tampilan KPI (sangat baik ≤ 2,2) dan kalkulator (< 2,2).
2. Mortality tanpa periode tidak dapat dibandingkan; kalkulator belum meminta periode.
3. Kapasitas kipas kalkulator (36 inci, 340 m³/menit) berbeda dengan contoh Modul 9 (32.000 m³/jam).
4. Ambang egg mass "Excellent" (≥ 57 g) lebih rendah dari target puncak strain.
5. Belum ada tabel ambang suhu dan kelembapan menurut umur di aplikasi.

## E. Yang tidak diubah

- **Slide, video, dan gambar yang sudah terbit** (misalnya 13 slide dan gambar "Memantau Farm" di Modul 1) dipertahankan oleh skrip dan ditempatkan sebelum materi teks paket.
- **Nama chapter, urutan modul, dan sampul modul** tidak diubah. Pembaruan video ada di `2026-10-31-aturan-video-expo.md`.
- **Kebijakan kurikulum, nilai, sertifikat, dan percobaan kuis yang sedang berjalan** tidak disentuh. Percobaan yang sedang berjalan tetap memakai snapshot soal lamanya.

## Cara menerbitkan ke Production

Konten kurikulum tersimpan di database Production, bukan di kode. Merge ke `main` hanya mengirim skrip dan paket; konten berubah setelah operator menjalankan skrip di server.

**Latihan di Staging lebih dulu.** Jalankan seluruh langkah di bawah terhadap Staging: merge ke `develop`, pakai `/home/aapp8359/aapmlayeracademy-staging-config.php` dan `--expect-environment=staging`. Lanjutkan ke Production hanya setelah pemeriksaan langkah 6 lulus di Staging dan tim Produksi menyetujui isinya; persetujuan itu menjadi nilai `--evidence-ref`.

1. Merge PR ke `main` dan jalankan **Update from Remote** di cPanel Git Version Control. Artefak `dist/` tidak berubah.
2. Ambil backup database Production (phpMyAdmin/cPanel). Backup ini satu-satunya jalur pemulihan cepat untuk bank ujian akhir.
3. Di Admin → Kurikulum, pastikan tidak ada modul atau bank ujian akhir dengan draf yang belum terbit. Skrip menolak berjalan bila ada.
4. Dari folder repository di server, jalankan rencana (hanya membaca):

   ```bash
   AAPLAYERACADEMY_CONFIG=/home/aapp8359/aapmlayeracademy-production-config.php php scripts/curriculum/import-curriculum-update.php --file=scripts/curriculum/data/2026-10-30-kurikulum-produksi.json --expect-environment=production --actor-email=EMAIL_ADMIN --dry-run
   ```

   Periksa bahwa `blocking` kosong, setiap modul berstatus `update`, dan `keptMediaBlocks` Modul 1 berisi blok slide/gambar yang diharapkan.

5. Terbitkan:

   ```bash
   AAPLAYERACADEMY_CONFIG=/home/aapp8359/aapmlayeracademy-production-config.php php scripts/curriculum/import-curriculum-update.php --file=scripts/curriculum/data/2026-10-30-kurikulum-produksi.json --expect-environment=production --actor-email=EMAIL_ADMIN --apply --operator=NAMA_OPERATOR --evidence-ref=REFERENSI_PERSETUJUAN
   ```

   Setiap modul diterbitkan sebagai revisi baru melalui jalur draf → terbit yang sama dengan editor Admin, dengan event audit berisi operator dan referensi persetujuan. Menjalankan ulang aman: modul yang sudah sama dilewati.

6. Periksa Modul 1, 3, 9, dan 10 di Academy, lalu mulai satu kuis modul dan pastikan berisi 5 soal.

Opsi `--modules=1,2,3` membatasi modul yang diproses dan `--skip-final` melewati bank ujian akhir.

**Bila apply berhenti di tengah:** modul yang sudah terbit tetap terbit. Modul yang sedang diproses bisa tertinggal sebagai draf, sehingga dry-run berikutnya menandainya `pending_draft`. Terbitkan atau buang draf itu di Admin, lalu jalankan ulang; modul yang sudah sama dilewati.

**Rollback:** setiap modul menyimpan riwayat revisi. Di editor modul, buka Riwayat revisi, salin revisi sebelumnya ke draf, lalu terbitkan. Bank ujian akhir tidak punya tombol pemulihan: snapshot sebelumnya hanya tersimpan sebagai arsip di `question_bank_revision_items`, jadi pulihkan dari backup database atau tulis ulang soalnya melalui editor bank ujian akhir.
