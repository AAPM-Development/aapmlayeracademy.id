# Strategi Uji Shell dan Layout

Tujuannya menjaga shell peserta, admin, focus, dan auth tetap utuh di setiap ukuran layar tanpa membuat CI bergantung pada browser.

| Lapis | Alat | Kapan | Melindungi |
|---|---|---|---|
| Aturan statis | `tests/shell-hardening.test.mjs`, `tests/editor-layout.test.mjs`, `tests/visible-viewport.test.mjs` di `npm test` | Setiap perubahan | Aturan CSS dan markup yang pernah rusak tidak kembali |
| Logika | `tests/curriculum-rules.test.mjs`, `tests/lesson-navigation.test.mjs` | Setiap perubahan | Batas FCR, navigasi pelajaran |
| Browser | `npm run audit:shell` | Sebelum rilis yang menyentuh shell atau CSS bersama | Perilaku nyata di 11 ukuran layar |
| Manual | Perangkat fisik, Firefox, Safari | Sebelum rilis besar | Hal yang tidak tercakup Chrome headless |

## Menjalankan audit browser

Jalankan API dan Vite lokal, siapkan akun admin lokal, lalu:

```bash
AUDIT_EMAIL=admin@example.test AUDIT_PASSWORD=sandi-lokal npm run audit:shell
```

Skrip keluar dengan kode 1 bila ada halaman yang melanggar. Opsi `--routes`, `--viewports`, dan `--out` mempersempit atau menyimpan hasil.

## Invarian yang diperiksa

- Tidak ada overflow horizontal di halaman atau scroller utama, dan tidak ada scroll ganda.
- Sidebar, topbar, `m-top`, dan `m-nav` muncul tepat di sisi breakpoint 860 px.
- Anak bar tidak bertabrakan, tidak keluar jendela, dan kontrolnya tetap di layar.
- Elemen mengambang tidak saling menimpa, dan tombol APPI tidak di belakang bilah.
- Konten terakhir bisa digulir keluar dari balik chrome tetap.
- Ruang baca minimal 50% tinggi layar.
- Satu `h1` dan satu `main` per halaman.
- Target chrome minimal 40 px di ponsel dan 24 px di desktop.
- Menu admin dapat digulir sampai item terakhir pada layar pendek.

## Cara membaca hasil

Temuan otomatis adalah kandidat. Periksa di browser sebelum memperbaikinya: pada audit pertama, halaman APPI dan AI settings ternyata positif palsu. Tombol APPI di atas konten juga perlu diukur setelah clearance stabil, bukan saat bergerak.

## Celah yang tersisa

- Status kosong dan galat dengan data sungguhan belum tercakup.
- Regresi visual berbasis screenshot belum ada.
- Keyboard virtual di ponsel sungguhan belum teruji.
- Audit berjalan dengan peran admin; peran peserta murni belum dimasukkan ke matriks.
