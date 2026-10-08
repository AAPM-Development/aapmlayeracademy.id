# Revamp editor modul: rencana

Status: usulan. Belum ada kode yang diubah. Usulan ini menggantikan keputusan opsi B dan C di `EDITOR_LAYOUT_PROPOSAL.md`.

## Ringkasan

Editor modul sekarang punya tiga lapis navigasi di atas isi materi, satu tombol Simpan untuk seluruh modul, dan urutan blok yang hanya bisa diubah selangkah demi selangkah. Usulan ini menggantinya dengan tiga kolom tetap (Susun · Kanvas · Inspektor), status bar Simpan di bawah, dan pemisahan antara isi materi dan pengaturan modul.

Format data yang tersimpan tidak berubah, jadi tampilan learner tidak ikut berubah.

## Yang ada sekarang

Diukur dari kode dan dari layar editor modul 1:

- Di atas isi materi ada tiga baris: judul dan aksi halaman, tab mode (Konten modul / Pratinjau learner / Bank soal), lalu command bar (Materi · Tujuan · Praktik, status, Tambah blok, Pratinjau, Simpan). Baru setelah itu muncul header modul dan panel Materi. Lihat [AdminModuleEditor.jsx](src/pages/admin/AdminModuleEditor.jsx) baris 1445–1464 dan [EditorQuickNav.jsx](src/components/admin/EditorQuickNav.jsx).
- Tambah blok ada di dua tempat: tombol di command bar dan daftar di tab Blok inspektor.
- Ada tiga sistem navigasi yang berdampingan: tab mode, tiga tautan bagian (Materi, Tujuan, Praktik), dan tab inspektor (Blok, Modul, APPI).
- Blok hanya bisa dinaikkan atau diturunkan satu langkah, atau dipindah ke awal atau akhir lewat menu. Tidak ada seret. Lihat [EditorialComposer.jsx](src/components/admin/EditorialComposer.jsx) baris 798–805.
- Status penyimpanan hanya punya tiga keadaan: Tersimpan, Belum disimpan, dan Menyimpan…. Tidak ada keadaan gagal (lihat [EditorQuickNav.jsx](src/components/admin/EditorQuickNav.jsx) baris 81–84).
- Satu Simpan mengirim seluruh form modul (metadata, materi, tujuan, praktik) dalam satu payload.
- Draft disimpan di localStorage dengan kunci `aapm:academy:module-editor:v1` per akun, kursus, dan modul. Draft ini tidak ikut ke browser lain.
- Metadata modul (nomor, chapter, warna, URL video, urutan) berada di form yang sama dengan isi materi. Pindah chapter hanya bisa dilakukan dari editor.
- Ukuran file: [AdminModuleEditor.jsx](src/pages/admin/AdminModuleEditor.jsx) sekitar 1.690 baris, [EditorialComposer.jsx](src/components/admin/EditorialComposer.jsx) sekitar 1.075 baris.

## Masalah per area

- **Editorial (Materi):** panel materi, kartu kualitas, daftar blok, dan inspektor berebut perhatian yang sama. Untuk mengubah gaya sebuah blok, pengguna harus pindah ke inspektor.
- **Teks:** blok teks (Teks kaya, Judul, Sorotan) bisa ditambahkan dari dua tempat. Blok yang sedang dipilih berubah dari pratinjau menjadi form editor di dalam kartu yang sama, sehingga tinggi kartu ikut berubah.
- **Susun:** urutan blok hanya bisa diubah dengan tombol naik atau turun atau lewat menu. Di rail kiri tidak ada daftar blok. Navigasi hanya tiga tautan bagian.
- **Simpan:** satu tombol untuk semua. Tidak ada tanda kesalahan sebagian, dan status tidak menyebut kapan terakhir tersimpan atau apa yang gagal.
- **Layout:** tiga lapis navigasi menghabiskan tinggi layar sebelum materi terlihat. Tampilan HP belum saya periksa pada sesi ini.

## Arah revamp

Target desktop, tiga kolom tetap:

```
Edit modul · Chapter 1 · Modul 1              [Konten | Pratinjau | Bank soal]  [⋯]
┌────────────────┬──────────────────────────────────────┬────────────────────────┐
│ Susun          │ Kanvas                               │ Inspektor              │
│  Materi        │  Judul modul (inline)                │ [Blok | Modul | APPI]  │
│   1 Teks       │  Blok 1                              │                        │
│   2 Judul      │  Blok 2                              │  gaya blok aktif,      │
│   3 Sorotan    │  + Tambah blok                       │  metadata modul, APPI  │
│  Tujuan        │                                      │                        │
│  Praktik       │                                      │                        │
└────────────────┴──────────────────────────────────────┴────────────────────────┘
Tersimpan · Belum disimpan · Gagal, coba lagi                  [Simpan ⌘S]       ← status bar, sticky
```

- **Header:** judul modul dan breadcrumb chapter. Mode dipindah ke segmented control di kanan atas, bersama Lihat di Academy dan menu.
- **Susun (kiri):** daftar bagian dan blok bernomor. Klik untuk loncat. Pindah dengan seret, atau dengan Alt+↑ dan Alt+↓ saat blok difokus. Ini menggantikan tiga tautan bagian. Seret memakai pustaka yang sudah ada di daftar modul (`@hello-pangea/dnd`).
- **Kanvas:** hanya materi. Setiap blok tampil sebagai kartu. Hanya blok aktif yang membuka editor penuh.
- **Inspektor (kanan):** Blok (gaya blok), Modul (metadata), dan APPI. Tambah blok hanya ada di Susun dan di bawah kanvas, bukan dua kali.
- **Status bar (bawah, sticky):** status penyimpanan termasuk keadaan gagal dengan tombol Coba lagi, serta Simpan ⌘S.

Perubahan per area:

- **Susun:** outline sebagai satu daftar pohon, bagian sebagai induk dan blok sebagai anak. Urutan blok memakai `moveContentBlock` yang sudah ada. Yang baru hanya seret dan pintasan keyboard.
- **Teks:** picker blok dikelompokkan menjadi Teks, Media, dan Struktur. Semua kartu blok memakai header yang sama. Pratinjau selalu terlihat. Mengedit membuka form di tempat, tanpa mengubah tinggi kartu tetangganya.
- **Simpan:** setiap usaha simpan punya keadaan sendiri. Jika gagal, form dan draft tetap utuh dan pesan dari server ditampilkan.
- **Modul:** metadata pindah ke tab Modul di inspektor, termasuk URL video. Validasi nomor dan chapter tetap di server.
- **Bank soal:** tetap sebagai mode. Bentuk form-nya ikut kartu baru di fase terakhir.
- **Responsif:** desktop tiga kolom (Susun sekitar 220px, kanvas fleksibel, inspektor sekitar 320px). Tablet: Susun menjadi sheet. HP: kanvas tunggal dengan bottom bar Susun · Blok · Modul · Simpan.

## Yang tidak berubah

- Bentuk data: `editorialContent`, daftar tujuan, takeaway, dan checklist, serta kontrak `PUT /admin/modules/{id}`. Payload tetap sama.
- Kunci draft localStorage tetap. Draft yang sudah ada tetap bisa dipulihkan.
- Pratinjau learner memakai renderer yang sama dengan Academy. Setiap fase harus memastikan tampilan learner tidak berubah.
- Urutan modul dalam chapter tetap lewat reorder API yang menerima seluruh modul. Pindah chapter tetap dari editor.
- Ctrl/⌘S tetap berfungsi. Alt+1 sampai Alt+3 akan dipetakan ke bagian yang baru.

## Fase

Satu permukaan per commit, sesuai [AAPM_UI_ORCHESTRATION_BRIEF.md](docs/ui-ux/AAPM_UI_ORCHESTRATION_BRIEF.md).

1. **Shell:** header dengan mode, hapus command bar, tambah status bar. Perilaku data tidak berubah.
2. **Susun:** outline bagian dan blok, seret, dan pintasan keyboard.
3. **Teks:** picker blok berkelompok dan kartu blok yang seragam.
4. **Modul dan Simpan:** metadata pindah ke tab Modul, serta keadaan simpan dan keadaan gagal.
5. **Responsif:** tablet dan HP, dengan sheet dan bottom bar.
6. **Bank soal:** form mengikuti kartu baru.

Setiap fase menjalankan: `npx eslint`, `npm test`, `npm run tokens:check`, `npx vite build`, pengecekan browser di lebar 1199px dan 390px, konsol bersih, dan perbandingan Pratinjau learner sebelum dan sesudah.

## Keputusan yang dibutuhkan

1. **Arti "Susun".** Saya membacanya sebagai urutan blok dan bagian dalam materi. Jika yang dimaksud adalah aksi "Susun isi" dari APPI, aksi itu tetap di tab APPI. Usulan: keduanya.
2. **Model simpan.** Satu Simpan untuk seluruh modul dengan status yang jelas (usulan), atau simpan per bagian?
3. **Bank soal.** Masuk ke fase 6 dalam revamp ini (usulan), atau ditangani terpisah?
4. **Mode di header.** Konten, Pratinjau, dan Bank soal sebagai segmented control di header (usulan), atau tetap sebagai tab di bawah judul?

Push ke `develop` men-deploy ke staging. Setiap fase akan di-commit lokal dan menunggu persetujuan Anda untuk di-push.
