# Editor modul: susunan navigasi

Status: Opsi A sudah diterapkan. Opsi B dan C adalah usulan dan menunggu persetujuan, karena mengubah lokasi kontrol utama.

## Masalah

Di bagian atas editor ada tiga lapis yang sama-sama menonjol:

1. **Mode** (`Konten modul`, `Pratinjau learner`, `Bank soal`) — tab garis bawah.
2. **Bagian dokumen** (`Materi`, `Tujuan`, `Praktik`) — chip hijau terisi, dalam command bar yang berbingkai dan berbayang.
3. **Inspector** (`Blok`, `Modul`, `APPI`) — segmented di kolom kanan.

Chip hijau terisi di lapis 2 punya bobot yang sama dengan tab mode aktif, sehingga editor terbaca sebagai tiga baris navigasi yang setara.

## Layout sekarang (Opsi A, sudah diterapkan)

```
Edit modul                                   [Lihat di Academy] [⋯]
Konten modul   Pratinjau learner   Bank soal                      ← mode: tab garis bawah
──────────────────────────────────────────────────────────────────
Materi  Tujuan  Praktik        Tersimpan  [+ Tambah blok]  Pratinjau  [Simpan ⌘S]
                                                                    ← bagian: teks, aksi: satu terisi
Chapter 1 · Foundation  Modul 1  Foundation        │ [ Blok | Modul | APPI ]
Dasar Manajemen Layer Farm                         │  inspector
Kanvas dokumen …                                   │
```

Yang berubah (tanpa memindahkan kontrol atau mengubah alur edit):
- Command bar menjadi baris datar di bawah mode, tanpa bingkai dan bayangan.
- Bagian dokumen menjadi teks biasa. Bagian aktif ditandai dengan huruf tebal dan warna tinta, bukan isian.
- Satu-satunya kontrol terisi di command bar adalah **Simpan**. `Tambah blok` tetap soft.
- Inspector tidak diubah.

## Opsi B (usulan): daftar bagian pindah ke kolom kiri kanvas

```
Edit modul                                   [Lihat di Academy] [⋯]
Konten modul   Pratinjau learner   Bank soal
──────────────────────────────────────────────────────────────────
                    Tersimpan  [+ Tambah blok]  Pratinjau  [Simpan ⌘S]   ← hanya aksi
┌──────────┬──────────────────────────────────────┬──────────────────────┐
│ Bagian   │ Chapter 1 · Foundation  Modul 1       │ [ Blok | Modul | APPI ]│
│ · Materi │ Dasar Manajemen Layer Farm            │                      │
│ · Tujuan │ Kanvas dokumen …                      │                      │
│ · Praktik│                                      │                      │
└──────────┴──────────────────────────────────────┴──────────────────────┘
```

- Lapis navigasi horizontal berkurang dari tiga menjadi dua (mode dan inspector). Bagian dokumen menjadi daftar isi yang sticky, seperti daftar isi pada pelajaran.
- Dampak: kolom kiri sekitar 200px. Kanvas di layar 1280px menyempit; perlu cek lebar terbaca.
- Pada HP: daftar bagian menjadi baris chip yang bisa digulir di atas kanvas, atau sheet dari tombol "Bagian".
- Alur edit tidak berubah. Lompatan bagian berpindah dari bar atas ke kolom kiri.

## Opsi C (usulan, tidak disarankan dulu): mode pindah ke header, Simpan ikut naik

```
Edit modul  [Konten modul | Pratinjau | Bank soal]   [Lihat] [⋯] [Simpan ⌘S]
─────────────────────────────────────────────────────────────────────
┌──────────┬──────────────────────────────────────┬───────────────────────┐
│ Bagian   │ kanvas                               │ inspector             │
└──────────┴──────────────────────────────────────┴───────────────────────┘
```

- Tidak ada baris navigasi horizontal sama sekali. Command bar hilang.
- Dampak: tombol **Simpan** berpindah ke header. Kebiasaan menyimpan berubah, dan kontrol utama harus disetujui dulu.
- Pada HP, header perlu dua baris, sehingga tidak ada penghematan ruang di perangkat kecil.

## Rekomendasi

Opsi B. Ia menghilangkan satu lapis tanpa memindahkan Simpan atau mengubah alur edit. Opsi C menghapus lapis yang sama, tetapi memindahkan kontrol utama dan belum terbukti lebih baik di HP.

## Keputusan yang dibutuhkan

- Setujui Opsi B? Jika ya, implementasinya mengubah grid `aapm-editor-workspace` dan memindahkan `EditorQuickNav` menjadi daftar isi kiri.
- Opsi C: tetap ditunda sampai ada catatan pengguna tentang kebiasaan menyimpan.
