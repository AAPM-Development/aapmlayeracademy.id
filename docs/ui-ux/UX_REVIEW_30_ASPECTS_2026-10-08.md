# AAPM Academy — Review 30 Aspek UI/UX + Acuan Duolingo (2026-10-08)

Review ini menilai aplikasi learner dan APPI terhadap 30 aspek UI/UX yang dipakai tim, dengan Duolingo sebagai acuan pengalaman belajar. Dasarnya kode di `develop` dan pemeriksaan browser (Playwright) di 375 px dan 1280 px, mode terang dan gelap, dengan akun demo lokal.

Status: **Kuat** = memenuhi prinsip dan terverifikasi · **Cukup** = berjalan, ada celah yang diketahui · **Perlu kerja** = belum ada atau butuh keputusan.

Pemeriksaan otomatis di semua rute learner (`/`, `/modules`, `/modules/:n`, `/quiz/:n`, `/certification`, `/profile`, `/calculators`, `/kpi`, `/ai-assistant`) di kedua ukuran: tidak ada overflow horizontal, tidak ada kontrol tanpa nama, tidak ada ID ganda, dan tepat satu `h1` per layar.

---

## Scorecard

| # | Aspek | Status | Bukti | Celah / langkah berikutnya |
|---|---|---|---|---|
| 1 | Usability | Kuat | Satu aksi utama per layar; alur modul Materi → Praktik → Kuis → Selesai (`ModuleDetail.jsx`) | — |
| 2 | User Experience | Kuat | Jalur belajar bergaya Duolingo, bilah verdict kuis, perayaan saat lulus; poin belajar dan level di Profil | Belum ada streak atau target harian (lihat Keputusan) |
| 3 | User Interface | Kuat | Semua permukaan memakai token AAPM (`aapm-academy.tokens.json`) | — |
| 4 | Visual Hierarchy | Kuat | Penanda Mulai/Lanjutkan di jalur, satu tombol `learn` per layar | — |
| 5 | Layout & Composition | Kuat | Jalur di kolom tengah 42rem; chat memakai satu lebar kolom untuk jawaban dan composer | — |
| 6 | Spacing & Whitespace | Kuat | Spasi dari token `space-*`; tidak ada nilai mentah di fitur baru | — |
| 7 | Typography | Kuat | Batas bawah teks 11 px; jawaban APPI 16 px/1.7 di workspace | Ukuran body global 14 px; pertimbangkan 15–16 px untuk bacaan panjang di luar materi |
| 8 | Color System | Kuat | Hue per level, hijau = selesai, oranye = APPI, token learning-state, mode gelap terverifikasi | — |
| 9 | Consistency & Unity | Cukup | Satu renderer Markdown untuk workspace dan panel APPI (`AiMarkdown.jsx`) | Kata kerja aksi belum seragam ("Lanjutkan", "Buka", "Kelola", "Edit"); nama course berbeda di admin dan learner (P3-2) |
| 10 | Design System & Components | Kuat | Token motion `ease-spring` baru; `--aapm-depth-shade` untuk tombol taktil di kedua tema | `ai.css` (±1.700 baris) masih memakai variabel legacy `hsl(var(--…))` |
| 11 | Information Architecture | Kuat | Navigasi dikelompokkan (Belajar, Alat farm, Prestasi); kurikulum per level | — |
| 12 | Navigation & User Flow | Kuat | Alur modul terbatas; editor admin tidak lagi punya tiga lapis navigasi (P2-9 selesai lewat revamp editor) | — |
| 13 | Interaction Design | Kuat | Kuis: A–F/1–6 memilih, Enter memeriksa lalu lanjut; fokus tetap di tombol yang sama | — |
| 14 | Accessibility & Inclusivity | Kuat | Live region persisten untuk verdict, `aria-keyshortcuts`, satu `h1`, reduced motion untuk konfeti dan animasi, target sentuh 40 px | Console masih mencatat 401 sebelum login (pengecekan sesi) |
| 15 | Responsive & Adaptive | Kuat | Jalur, kuis, hasil, dan chat dicek di 375 px dan 1280 px | — |
| 16 | Content & Microcopy | Cukup | Disclaimer dokter hewan versi pendek di ponsel; placeholder chat satu baris | Istilah campuran Indonesia–Inggris di beberapa label admin |
| 17 | Forms & Data Entry | Kuat | KPI: error inline dan fokus ke field (audit P2-4) | — |
| 18 | Data Presentation & Density | Cukup | Tile hasil satu baris di ponsel; tabel APPI bisa digulir dalam bingkai | Grafik KPI tidak ditinjau ulang di putaran ini |
| 19 | Feedback & System States | Kuat | StateView di semua data view; verdict hijau/merah; konfirmasi "Tersalin" | — |
| 20 | Error Prevention & Recovery | Cukup | Kirim ulang, simpan ulang, coba provider lagi di APPI | Belum ada tombol Hentikan untuk jawaban APPI (butuh dukungan server) |
| 21 | Performance & Perceived Speed | Cukup | Route preload, chunk terpisah, konfeti dimuat saat dibutuhkan | Belum diukur (Lighthouse/Web Vitals) |
| 22 | Microinteractions & Motion | Kuat | Jawaban benar memantul, salah bergetar sekali, verdict naik dari bilah, simpul aktif mendarat; semua mati saat reduced motion | — |
| 23 | Cognitive Load & Simplicity | Kuat | Tiga pintu masuk APPI di dashboard jadi dua (P3-3); toast ganda di hasil kuis dihapus | — |
| 24 | Efficiency & Productivity | Kuat | Kuis bisa diselesaikan tanpa mouse; salin jawaban dan kode APPI satu klik | — |
| 25 | Scalability & Maintainability | Cukup | Renderer Markdown duplikat disatukan; helper murni (`learningPath.js`) diuji | ±144 error typecheck lama; lapisan override di `ai.css`/`ai-chat.css` |
| 26 | Security, Privacy & Trust | Cukup | CSRF, rate limit, balasan lokal diberi label, tautan eksternal `noopener` | Streak/XP akan menambah data aktivitas: putuskan retensi dulu |
| 27 | Aesthetic Quality | Kuat | Banner level berwarna, simpul taktil, maskot APPI di keadaan kosong | — |
| 28 | Context Awareness | Kuat | APPI membawa konteks halaman dan KPI (dengan sakelar) | — |
| 29 | UX Research & Validation | Perlu kerja | Hanya audit heuristik dan pemeriksaan browser | Uji usability dengan 5 peserta farm; analitik penyelesaian modul dan kuis |
| 30 | Quality Assurance & Governance | Cukup | 33 test kontrak (`tests/academy-hardening.test.mjs`), lint, token check | Pemeriksaan Playwright belum masuk CI |

---

## Peta pola Duolingo

| Pola Duolingo | Di AAPM Academy | Status |
|---|---|---|
| Jalur belajar berkelok dengan simpul bulat | `LearningPath` di `/modules` | Ditambahkan |
| Banner unit berwarna | Banner per level dengan progres | Ditambahkan |
| Gelembung "MULAI" di simpul aktif | Penanda Mulai/Lanjutkan | Ditambahkan |
| Trofi akhir unit | "Level tuntas" / "Tuntaskan N modul lagi" | Ditambahkan |
| Periksa → bilah hijau/merah → Lanjut | Bilah verdict di footer kuis | Ditambahkan |
| "N in a row" | "N benar beruntun" (mulai dari 3) | Ditambahkan |
| Layar lesson selesai (stat + perayaan) | Skor, benar, waktu + konfeti | Ditambahkan |
| Tombol taktil 3D | Tombol `learn`, simpul jalur, tombol kirim APPI | Ada / diperluas |
| Maskot | Maskot APPI di keadaan kosong dan header chat | Ada / diperluas |
| Streak 🔥 | — | Butuh keputusan |
| XP | Poin belajar + level di Profil (dihitung server dari modul, praktik, sertifikat, kuis, KPI, waktu belajar) | Ada; praktik dan waktu belajar kini benar-benar tercatat |
| Target harian | — | Butuh keputusan |
| Ulangi kesalahan (review mode) | — | Usulan |
| Hearts / nyawa | — | Tidak disarankan |
| Liga / leaderboard | Hall of Fame opt-in di Profil (nama, level, poin; email tidak ditampilkan) | Ada, opt-in |
| Efek suara | — | Opsional, default mati |

---

## Keputusan yang dibutuhkan

1. **Streak dan target harian.** Poin (XP) sudah ada di Profil. `user_progress` hanya menyimpan satu baris per modul (`updated_at` terakhir), jadi streak yang jujur butuh log aktivitas harian (tabel baru, mis. `learning_activity(user_id, activity_date, points)`). Staging dan produksi berbagi MySQL, jadi tabel baru ikut muncul di produksi. Putuskan dulu: target harian, zona waktu (WIB), dan retensi data.
2. **Hearts / nyawa.** Tidak disarankan. Di pelatihan profesional, menghukum jawaban salah menghambat belajar; alur sekarang sudah meminta lulus 70% tanpa membatasi percobaan.
3. **Leaderboard.** Sudah ada sebagai Hall of Fame opt-in di Profil; pertahankan opt-in dan jangan tampilkan data farm.
4. **Ulangi kesalahan.** Butuh menyimpan jawaban per soal (sekarang hanya skor total). Nilainya tinggi untuk retensi; kandidat iterasi berikutnya.
5. **Tombol Hentikan di APPI.** Server menjalankan stream dengan `ignore_user_abort(true)`, sehingga jawaban penuh tetap tersimpan walau klien berhenti. Perlu endpoint batal atau penanda di server agar riwayat sesuai dengan yang dilihat pengguna.
6. **Nama course** (P3-2): pilih satu nama tampilan untuk admin dan learner.

---

## Yang diubah di putaran ini

- Jalur belajar bergaya Duolingo menggantikan akordeon level.
- Kuis: bilah verdict, pintasan keyboard, "benar beruntun", hasil dengan waktu, konfeti.
- Motion: token `ease-spring`; jawaban benar memantul, salah bergetar sekali, verdict naik, badge hasil mendarat.
- Perbaikan audit: satu `h1` di layar hasil, tanpa toast di atas bilah kuis, tile hasil satu baris, "Tinjau jawaban" sebagai aksi (P3-4), "Periksa" nonaktif berwarna abu-abu (P3-5), tombol APPI ganda di topbar dihapus (P3-3), pergantian tema dalam satu frame, label stepper kuis tidak terpotong, tombol hero penuh di ponsel, konten desktop tidak tertutup pill APPI, logo topbar ponsel 40 px.
- APPI: satu renderer Markdown (tautan terlihat, blok kode berlabel dengan Salin, tabel berbingkai, kutipan sebagai callout), "Salin jawaban", jawaban 16 px selebar kolom, jawaban penuh lebar di ponsel, maskot di keadaan kosong, tombol kirim taktil.

## Koreksi dan tambahan (putaran berikutnya)

- Poin belajar, level, dan Hall of Fame opt-in ternyata sudah ada di Profil; peta pola Duolingo di atas sudah dikoreksi.
- Ditemukan bug data: `POST /progress` menimpa semua kolom, sehingga "Tandai selesai" menghapus skor kuis dan kuis menghapus status praktik. Kini penyimpanan bersifat parsial.
- Praktik tidak pernah tercatat (tidak ada kontrolnya) dan waktu belajar tidak pernah dikirim, sehingga prestasi "Praktik lapangan", kolom praktik di admin, dan "Waktu belajar" selalu kosong. Kini ada centang praktik di materi dan waktu belajar aktif dicatat dari materi dan kuis.
