# Audit dan pembangunan ulang slide Modul 1

**Masalah:** rilis v2 tidak membawa blok slide lama, dan ekstraksi naskah menyimpan 13 gambar slide sebagai teks alt. Peserta melihat tabel berisi "/ Slide 1" sampai "/ Slide 13" tanpa gambar.

**Keputusan:** dek tidak dipasang ulang apa adanya. Setiap slide dicocokkan dengan materi Modul 1, lalu 10 slide dibangun ulang dan 3 dihapus. Sumbernya `scripts/curriculum/slides/modul-01/slides.html`; gambarnya dibuat ulang dengan `node scripts/curriculum/slides/render-slides.mjs modul-01`.

| Slide lama | Temuan | Hasil |
|---|---|---|
| 1 Sampul | Tidak ada isi belajar; judul sudah ada di halaman | Dihapus |
| 2 Alur modal ke profit | Relevan, label berbahasa Inggris | Slide 1 |
| 3 Tiga sumber revenue | Relevan | Slide 2 |
| 4 Egg mass | Grafik mencampur ekor, persen, kg, dan rupiah pada satu sumbu, sehingga empat dari lima batang tidak terlihat | Slide 3, perhitungan bertahap |
| 5 Revenue dan biaya | Relevan. Rincian biaya per pos hanya terbaca dari panjang batang dan tidak ada di materi | Slide 4, hanya revenue, total biaya, contribution |
| 6 Lima profit driver | Relevan, teks terlalu kecil | Slide 5 |
| 7 FCR | Tidak menunjukkan dampak rupiah yang diajarkan materi | Slide 6, ditambah Rp4.185.000 per hari |
| 8 Harga telur | Relevan | Slide 7 |
| 9 Farm A vs B | Relevan, tabel bawaan | Slide 8 |
| 10 Persamaan profit | Relevan | Slide 9 |
| 11 Business Model Canvas | Isinya sama dengan tabel di materi | Dihapus |
| 12 Pertanyaan per level | Isinya sama dengan tabel di materi | Dihapus |
| 13 Penutup | Relevan | Slide 10 |

**Satu angka baru:** slide 8 menambahkan baris egg mass, Farm A 5.520 kg dan Farm B 5.632 kg. Angka ini dihitung dari populasi, HD%, dan berat telur pada slide lama. Tim Produksi perlu meninjaunya.

Nomor slide pada naskah video Modul 1 sudah disesuaikan. Bagian Business Model Canvas pada naskah tidak lagi punya slide.

## Urutan operator

Gambar ikut artefak, jadi deploy lebih dulu, baru impor. Staging dulu, lalu Production sesudah cadangan database dan persetujuan.

```bash
php scripts/curriculum/import-curriculum-update.php --file=scripts/curriculum/data/2026-10-31-kurikulum-v2.json --expect-environment=staging --actor-email=ADMIN --modules=1 --skip-final --dry-run
```

Periksa bahwa `blocking` kosong, lalu ulangi dengan `--apply --operator=NAME --evidence-ref=REF` sebagai pengganti `--dry-run`.
