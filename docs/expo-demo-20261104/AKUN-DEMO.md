# Akun demo Expo AAPM Layer Academy, 4 November 2026

Akun untuk pengunjung Expo, dengan nama dan kelompok yang sama seperti akun demo AAPM Farm (satu kartu berlaku untuk kedua produk).

- **Kata sandi:** sama untuk semua akun dan **tidak ditulis di sini**. Lihat `KREDENSIAL.private.md` di folder ini (di-ignore lewat `.git/info/exclude`, hanya ada di komputer owner) atau di repo Farm, `docs/deployment/expo-demo-20261104/KREDENSIAL.private.md`.
- **Cara masuk:** Academy hanya menerima **email**, `<username>@demo.aapm.co.id`, misalnya `baru01@demo.aapm.co.id`. Alamat ini tidak punya kotak surat, jadi email verifikasi dan "Lupa kata sandi" tidak sampai ke siapa pun.
- **Peran:** semua akun adalah peserta (learner). Tidak ada akun admin demo.
- **Panduan petugas booth:** repo Farm, `docs/deployment/expo-demo-20261104/PANDUAN-BOOTH.md`.

## Status

| Lingkungan | Status |
| --- | --- |
| Lokal (SQLite) | Dibuat dan diperiksa: `--verify` 15 PASS, masuk lewat app untuk `baru01` dan `data03` |
| Uji MySQL lokal (MariaDB 10.4) | Alur lengkap lulus. Satu temuan lama di luar skrip: login dengan kata sandi salah memberi 500, lihat bagian "Temuan" |
| Produksi | **Dibuat 2 November 2026** dari repo `main` di `445ff327`, setelah backup `~/backups/20261102T115633Z-pre-expo-demo.sql.gz`. `--apply`: 15 akun dibuat, 36 modul, 131 aktivitas belajar, 36 minggu Farm KPI, 0 sertifikat. `--verify`: 15 PASS. Masuk lewat situs produksi belum dicoba agen; owner mencoba satu akun per kelompok |

## Kelompok 1: akun baru, belum setup

Academy tidak punya wizard setup. "Belum setup" berarti keadaannya sama seperti baru mendaftar sendiri: email belum terverifikasi, profil kosong, belum ada aktivitas. Beranda menampilkan "Mari mulai belajar", 0 dari 23 modul. Halaman Profil menampilkan pengingat verifikasi email.

| Email | Nama |
| --- | --- |
| `baru01@demo.aapm.co.id` | Agus Santoso |
| `baru02@demo.aapm.co.id` | Budi Hartono |
| `baru03@demo.aapm.co.id` | Citra Lestari |
| `baru04@demo.aapm.co.id` | Dewi Anggraini |
| `baru05@demo.aapm.co.id` | Eko Prasetyo |

## Kelompok 2: setup selesai, belum ada aktivitas

Email terverifikasi dan profil berisi bio singkat tentang peternakannya. Belum ada modul, kuis atau data KPI.

| Email | Nama | Bio, ringkas |
| --- | --- | --- |
| `siap01@demo.aapm.co.id` | Fajar Nugroho | Peternakan Sari Unggas, sekitar 3.600 ekor pullet |
| `siap02@demo.aapm.co.id` | Gita Permata | Peternakan Lancar Jaya, sekitar 3.300 ekor |
| `siap03@demo.aapm.co.id` | Hendra Wijaya | Peternakan Mitra Tani, sekitar 3.800 ekor |
| `siap04@demo.aapm.co.id` | Indah Puspita | Peternakan Karya Mandiri, sekitar 3.000 ekor |
| `siap05@demo.aapm.co.id` | Joko Susilo | Peternakan Bumi Hijau, sekitar 3.500 ekor |

## Kelompok 3: berisi aktivitas

Email terverifikasi dan profil terisi. Aktivitas dibuat lewat fungsi yang sama dengan app, yaitu konfirmasi baca modul, kuis modul (nilai 80–100%), latihan dan waktu belajar, ditambah data **Farm KPI** mingguan. Sertifikat **tidak** diklaim.

| Email | Nama | Modul selesai | Farm KPI (umur flock) |
| --- | --- | --- | --- |
| `data01@demo.aapm.co.id` | Kurniawan Saputra | 3 | 6 minggu, M31–M36, sekitar 7.085 ekor |
| `data02@demo.aapm.co.id` | Lina Marlina | 5 | 7 minggu, M33–M39, sekitar 7.180 ekor |
| `data03@demo.aapm.co.id` | Maya Sari | 7 | 8 minggu, M30–M37, sekitar 6.750 ekor |
| `data04@demo.aapm.co.id` | Nanda Pratama | 9 | 7 minggu, M35–M41, sekitar 7.620 ekor, cuaca panas dua minggu terakhir |
| `data05@demo.aapm.co.id` | Oki Setiawan | 12 | 8 minggu, M34–M41, sekitar 6.920 ekor |

Angka KPI: HDP sekitar 89–95%, pakan sekitar 112 g per ekor, FCR sekitar 1,9, dengan pendapatan, biaya, suhu, kelembapan dan beberapa catatan mingguan. Contoh `data03` di lokal: 7 dari 23 modul (30%), peringkat Field Builder 1.096 poin, HDP minggu 37 94,1%, dan bacaan APPI "Minggu ini terlihat sehat".

Hall of fame tetap mati (bawaan app), jadi akun demo tidak muncul di papan peringkat kecuali pengunjung menyalakannya.

## Cara membuat, memeriksa dan menghapus

Skrip operator: [`scripts/maintenance/expo-accounts.php`](../../scripts/maintenance/expo-accounts.php), dibuat dengan pola yang sama dengan `demo-learners.php`. Tes: `tests/expo-accounts.test.mjs`.

- Akun dibuat lewat jalur "buat pengguna" Super Admin supaya setiap akun mendapat kebijakan kurikulum. Kelompok 1 lalu ditandai belum terverifikasi.
- Menjalankan ulang tidak menggandakan apa pun. Kata sandi, status verifikasi dan bio dikembalikan ke rencana. Aktivitas belajar tidak pernah dihapus, kecuali lewat `--remove`.
- Kata sandi dibaca dari variabel `AAPM_EXPO_DEMO_PASSWORD` dan tidak pernah dicetak.

Perintah di cPanel Terminal. Skrip sudah ada di `main` dan `develop`. Repo produksi di server adalah `/home/aapp8359/repositories/main` (cabang `main`), dan repo staging adalah `/home/aapp8359/repositories/stagging`.

```bash
# 1. Backup database lebih dulu (cPanel Backup atau mysqldump).
cd /home/aapp8359/repositories/main
export AAPLAYERACADEMY_CONFIG=/home/aapp8359/aapmlayeracademy-production-config.php
read -rs AAPM_EXPO_DEMO_PASSWORD && export AAPM_EXPO_DEMO_PASSWORD
php scripts/maintenance/expo-accounts.php --expect-environment=production --dry-run
php scripts/maintenance/expo-accounts.php --expect-environment=production --apply --confirm-production --operator=NAMA --evidence-ref=expo-20261104
php scripts/maintenance/expo-accounts.php --expect-environment=production --verify
unset AAPM_EXPO_DEMO_PASSWORD
```

`read -rs` meminta kata sandi tanpa menampilkannya dan tanpa menyimpannya di riwayat. cPanel Terminal bisa terputus kalau dibiarkan menunggu terlalu lama, dan variabelnya ikut hilang. Karena itu, ketik kata sandi tepat sebelum `--apply`, atau gabungkan `read -rs` dengan perintah berikutnya dalam satu baris. Untuk staging, ganti folder ke `/home/aapp8359/repositories/stagging`, file konfigurasi ke `aapmlayeracademy-staging-config.php`, `--expect-environment=staging`, dan hilangkan `--confirm-production`.

**Setelah Expo**, backup lagi, lalu jalankan:

```bash
php scripts/maintenance/expo-accounts.php --expect-environment=production --apply --remove --confirm-production --operator=NAMA --evidence-ref=expo-20261104
```

Perintah ini menghapus tepat 15 akun ini beserta semua aktivitas dan sertifikatnya.

## Yang perlu diperhatikan di booth

- **Sertifikat:** semua akun `data` memenuhi syarat sertifikat tingkat 1, dan `data03`–`data05` juga tingkat 2. Jangan tekan **Klaim**: sertifikat yang terbit bisa diverifikasi publik. Kalau terlanjur, `--verify` menandainya FAIL dan `--remove` menghapusnya.
- **Akun `baru` dan `siap`** sebaiknya tidak dipakai untuk mengerjakan kuis. Aktivitas belajar tidak dihapus oleh `--apply`; satu-satunya cara mengembalikannya adalah `--remove` lalu `--apply`.
- **Batas masuk:** 8 kali gagal per email atau 60 kali gagal per jaringan dalam 15 menit akan mengunci login sementara. Hanya percobaan yang gagal yang dihitung.
- Peserta tidak punya layar ganti kata sandi, jadi pengunjung tidak bisa mengunci akun dengan mengganti kata sandi.

## Temuan di luar skrip

Login dengan kata sandi salah di MySQL mengembalikan **500 "Terjadi kesalahan pada server."**, bukan 401 "Email atau kata sandi tidak sesuai.".

- **Bukti:** direproduksi pada kode `develop` tanpa perubahan, dengan akun biasa, di MariaDB 10.4 mode strict. Di SQLite hasilnya 401.
- **Penyebab:** `aapm_audit('auth.login_failure', 'invalid_credentials', …)` di `public/api/index.php` menulis 19 karakter ke `security_audit_events.result`, yang hanya `VARCHAR(16)`.
- **Dampak di booth:** salah ketik kata sandi akan tampil sebagai gangguan server. Catatan batas percobaan tetap tertulis sebelum audit.
- **Belum dibuktikan di produksi** (agen tidak bisa membaca database produksi), tetapi MySQL produksi kemungkinan juga memakai mode strict.
- Perbaikannya terpisah dari pekerjaan akun demo.
