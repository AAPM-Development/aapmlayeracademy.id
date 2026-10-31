# Rilis Kurikulum v2.0

Sumber: `AAPM_Kurikulum_Layer_Academy_v2.docx` (versi 2.0, 31 Oktober 2026).
Paket: `scripts/curriculum/data/2026-10-31-kurikulum-v2.json`.

## Isi paket

- 14 chapter, 23 modul, 230 soal modul (10 per modul), 50 soal ujian akhir, 23 video referensi.
- Modul 4 Brooding baru. Modul sesudahnya bergeser satu nomor sampai Modul 23 Capstone.

## Keputusan

| Keputusan | Alasan | Biaya bila keliru |
|---|---|---|
| Struktur 23 modul berlaku untuk semua peserta | Pilihan pengguna | Kebijakan lama tidak dapat dipulihkan otomatis |
| Peserta dengan riwayat memulai generasi akademik baru | Nomor modul bergeser, jadi kelulusan lama tidak boleh dihitung sebagai materi baru. Percobaan, nilai, peristiwa, dan sertifikat tetap tersimpan | Peserta mengulang kuis di materi baru |
| Lulus kuis 70%, lulus ujian 80% | Pilihan pengguna: aturan aplikasi, jumlah soal mengikuti dokumen | Mengubah angka lewat kebijakan versi berikutnya |
| Bobot tugas praktik dan capstone belum dihitung | Aplikasi belum punya penilaian tugas praktik | Butuh fitur baru |
| Tingkat 1: M1–3, 2: M4–7, 3: M8–14, 4: M15–19, 5: M20–21, 6: M22–23 + ujian akhir | Disetujui pengguna; dokumen tidak menetapkannya | Ubah di draf kebijakan sebelum aktivasi |
| Blok slide lama tidak dibawa (`preserveBlockTypes` kosong) | Slide modul lama tidak boleh menempel ke nomor yang isinya sudah berganti | Slide Modul 1 perlu diunggah ulang |
| 173 pengecoh ditulis ulang | Di naskah, jawaban benar menjadi opsi terpanjang pada 148 dari 280 soal dan kata mutlak menandai opsi salah. Jawaban benar dan kunci tidak berubah | Tim Produksi perlu meninjau pengecoh |

## Urutan operator

Jalankan di Staging dulu, lalu di Production setelah Staging lolos. Production membutuhkan
cadangan database dan referensi persetujuan tim Produksi.

```bash
F=scripts/curriculum/data/2026-10-31-kurikulum-v2.json
php scripts/curriculum/import-curriculum-update.php --file=$F --expect-environment=staging --actor-email=ADMIN --dry-run --create-missing
php scripts/curriculum/import-curriculum-update.php --file=$F --expect-environment=staging --actor-email=ADMIN --apply --create-missing --operator=NAMA --evidence-ref=REF
php scripts/curriculum/prepare-policy-v2.php --expect-environment=staging --actor-email=ADMIN --dry-run
php scripts/curriculum/prepare-policy-v2.php --expect-environment=staging --actor-email=ADMIN --apply
php scripts/curriculum/activate-policy.php --policy-version=academy-v2 --expect-environment=staging --apply --operator=NAMA --evidence-ref=REF
php scripts/curriculum/move-learners-to-policy.php --policy-version=academy-v2 --expect-environment=staging --actor-email=ADMIN --dry-run
php scripts/curriculum/move-learners-to-policy.php --policy-version=academy-v2 --expect-environment=staging --actor-email=ADMIN --apply --operator=NAMA --evidence-ref=REF
```

Bila `--dry-run` menandai modul sebagai `number_held`, nomornya masih tercatat di
`module_number_allocations`, biasanya karena draf modul itu pernah dihapus. Baca `holdState`:

- `unused`: tidak ada catatan apa pun. Tambahkan `--release-unused-numbers` pada dry-run dan
  apply. Pelepasan dicatat sebagai `module_number.released`.
- `retired`: ada catatan di tabel yang tertulis pada `records`. Jangan dilepas. Periksa dulu.
- `other_curriculum`: nomor dipakai modul di kurikulum lain. Periksa dulu.

Di Production, nomor 23 tertahan dengan cara ini pada 31 Oktober 2026, sedangkan di Staging tidak.

Tes `tests/curriculum-v2-release.test.mjs` menjalankan urutan yang sama di SQLite sekali pakai.
Alur ini juga lolos di salinan data rekaman: 23 modul, 100 akun pindah, 83 akun generasi baru,
237 sertifikat utuh, dan impor ulang tidak mengubah apa pun.

## Perlu dikonfirmasi tim Produksi

- Strain dan edisi panduan pada tabel standar, serta acuan bobot minggu 16.
- Gambar program vaksinasi Modul 12.
- Batas grade telur Modul 14 dan angka harga ilustrasi.
- Sebanyak 17 video referensi berasal dari kanal industri. Durasi di paket memakai durasi naskah produksi, bukan durasi video referensi.
- Prasyarat modul di dokumen tidak punya kolom di aplikasi, jadi tidak diimpor. Kurikulum tetap terbuka.
- Durasi ujian 90 menit belum diterapkan.
