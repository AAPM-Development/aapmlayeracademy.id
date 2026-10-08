# AAPM Academy — UI/UX Orchestration Brief

Dokumen ini adalah **manual operasi** UI/UX AAPM Layer Academy. Siapa pun yang membacanya (manusia atau agent) harus bisa membangun atau merevisi surface apa pun dan hasilnya tetap konsisten dengan keputusan desain yang sudah dibuat.

Referensi detail token dan komponen ada di [AAPM_DESIGN_SYSTEM.md](AAPM_DESIGN_SYSTEM.md). Dokumen ini menjawab *apa yang harus dilakukan, mengapa, dan bagaimana memverifikasinya*.

---

## 0. Cara pakai (untuk agent)

1. Baca bagian 1 (north star) dan 3 (archetype).
2. Klasifikasikan surface yang dikerjakan, lalu pilih **archetype** dan **shell**.
3. Susun dari primitive DS (bagian 5). Jangan menulis warna, radius, atau durasi literal.
4. Terapkan state dan motion sesuai bagian 8 dan 9.
5. Verifikasi sesuai bagian 10 sebelum menyatakan selesai.
6. Keputusan produk, copy, data, atau push ke `develop` adalah keputusan user. Tanyakan, jangan asumsikan.

---

## 1. North star

- **Course app yang berwarna, tetapi tenang.** Pastel per level, kartu lapang, tombol "learn" yang tactile untuk kuis dan hasil (gaya Duolingo). Area data dan admin tetap netral dengan satu aksen.
- **Learning first.** Setiap layar punya satu tujuan dan satu CTA utama.
- **Progres selalu terlihat.** Bar, ring, dan checklist adalah bahasa utama progres.
- **Motion menjelaskan perubahan** (datang, terisi, terpilih). Motion tidak pernah menunda kerja.
- **Editorial fleksibel tanpa form panjang.** Admin menyusun materi lewat dokumen + inspector, bukan form berlapis.

---

## 2. Prinsip

| # | Prinsip | Artinya |
|---|---|---|
| P1 | Archetype dulu, komponen kemudian | Tentukan jenis surface sebelum memilih komponen. |
| P2 | Hierarki tegas | Satu judul per halaman. Satu CTA `primary` per region. Aksi sekunder masuk overflow. |
| P3 | Progressive disclosure | Default sederhana. Pengaturan lanjutan di `Accordion` (tertutup). Aksi destruktif di section sendiri. |
| P4 | Token only | Tidak ada hex, px, atau ms literal di komponen. Pakai `--aapm-semantic-*` dan `--aapm-component-*`. |
| P5 | Satu keluarga ikon | Iconify Solar lewat `AapmIcon`. Tidak ada lucide atau heroicons. |
| P6 | Mobile setara desktop | 375px tanpa scroll horizontal halaman. Bottom nav. Sheet dari bawah. |
| P7 | Data first | Angka dan tabel didahulukan sebelum dekorasi. |

---

## 3. Archetype surface (peta keputusan)

| Surface | Archetype | Shell | Anatomi inti | Referensi kode |
|---|---|---|---|---|
| Materi / lesson | **Course player** | FocusShell | Command bar sticky (progres + prev/next), konten sentral (± 68ch), outline di sheet, callout | `ModuleDetail.jsx`, `LessonWorkspace.jsx` |
| Kuis / ujian | **Focus assessment** | FocusShell | Satu pertanyaan, pilihan bertombol key, feedback bar, navigator soal | `Quiz.jsx`, `FinalExam.jsx`, `AssessmentComponents.jsx` |
| Room chat APPI | **Chat workspace (ChatGPT-like)** | AppShell + workspace | Riwayat kiri: tombol "Percakapan baru", segmented Chat/Aktivitas, search, filter Aktif/Arsip + menu urutkan. Thread tengah: jawaban tanpa kartu, balasan lokal punya blok sendiri. Composer bawah: toggle KPI nonaktif bila belum ada catatan. Welcome cards | `AiAssistant.jsx`, `components/ai/AiHistoryControls.jsx`, `components/ai/AiMessageMeta.jsx` |
| Kalkulator | **Tool pattern** | AppShell | Rail alat, kartu input, hasil sticky (`CalcResult`) | `Calculators.jsx` |
| Beranda & jalur learner | **Course hub** | AppShell | Hero, continue card, stat tiles, level path | `Home.jsx`, `Modules.jsx` |
| Daftar admin (pengguna, peserta) | **LMS list** | AdminShell | Toolbar (search + jumlah), `DataTable` stacked, aksi per baris, detail di Sheet | `AdminUsers.jsx`, `AdminLearners.jsx` |
| Detail record admin | **Record page** | AdminShell | `PageHeader` dengan back, hero identitas, `Tabs` underline | `AdminLearnerDetail.jsx` |
| Builder kurikulum | **LMS builder** | AdminShell | Ringkasan course, daftar chapter/lesson (drag), overflow actions | `AdminCourseDetail.jsx` |
| Editor modul | **Document + inspector** | AdminShell (wide) | Canvas dokumen, blok klik-untuk-edit, inspector kanan (Blok / Modul / APPI), insert points | `AdminModuleEditor.jsx`, `EditorialComposer.jsx` |
| Input data KPI | **Data-first dashboard + form sheet** | AppShell | KPI cluster → chart → riwayat. Form di Sheet kanan 480px | `KpiDashboard.jsx` |
| Profil | **Hero + tabs** | AppShell | Hero (avatar + ring level) → KPI → Tabs Ringkasan / Profil / APPI / Perangkat | `Profile.jsx` |
| Registry provider AI | **Registry + editor** | AdminShell | Daftar provider kiri, editor kanan (FormSection), Accordion lanjutan, actions sticky | `AdminAiSettings.jsx` |
| Masuk / daftar | **Split auth** | Auth shell | Panel brand + form | `Login.jsx`, `Register.jsx`, `AuthLayout` |
| Status / peta kemampuan | **Capability map** | AdminShell | Dua panel: "siap digunakan" (link list) dan "butuh endpoint" (tanpa tombol palsu) | `AdminWorkspaceStatus.jsx` |

Jika surface tidak cocok dengan tabel, pilih archetype yang paling dekat, lalu tulis keputusanmu di PR/commit message.

---

## 4. Shell

### AppShell (Academy)
- **Sidebar** 256px. Grup: *Belajar*, *Alat farm*, *Prestasi*. Ada progress chip dan account row.
- **Topbar** 60px. Breadcrumb, actions, trigger profil, toggle tema.
- **Canvas**: satu scroll. `Page` width `wide` / `narrow` / `full`.
- **Mobile** (< 860px): sidebar hilang. Bottom nav lima item: Beranda, Belajar, APPI, KPI, Menu. Menu membuka `NavigationSheet`.

### FocusShell
- Untuk lesson dan assessment. Mengeset `html[data-shell="focus"]`.
- Bar atas: back, judul, progres. Outline di sheet. Footer berisi command.
- Tombol APPI floating digeser (lihat `shell.css`).

### AdminShell
- Sidebar grup *Administrasi* dan *Ruang kerja*. Chip "Ruang admin". Tombol "Kembali ke Academy".
- Topbar dengan breadcrumb `Admin › …`. `PageHeader size="compact"`.
- Editor memakai canvas lebar (`AdminPageFrame wide`).

### Auth shell
- Split: panel brand (gradient + kutipan) dan form. Form memakai `Field` + `InputGroup`.

---

## 5. Komponen: aturan pakai

### Actions
- **Button** variant: `primary` (satu per region), `learn` (CTA tactile: lanjutkan, periksa jawaban), `attention` (prompt belajar yang mendesak), `ai` (aksi APPI, oranye), `secondary` / `outline` (sekunder), `soft`, `ghost` (tersier, toolbar), `danger-soft` (destruktif yang belum final), `danger` (konfirmasi), `link`.
- Ukuran: `sm`, `md`, `icon`. Tombol hanya ikon **wajib** `aria-label` dan tooltip (`IconButton`).
- `loading` untuk aksi async. `asChild` untuk link yang terlihat seperti tombol.

### Overlays
- **Dialog**: keputusan tunggal atau konfirmasi kecil. Ukuran `sm` / `md` / `lg` / `xl`.
- **Sheet** (`side="right"`): form panjang, detail record, "Kelola". Body scroll, footer sticky. Di mobile tetap sheet full width, footer tersusun `column-reverse` (primary di atas).
- **ConfirmDialog / AlertDialog**: aksi destruktif. Judul menyebut objeknya. Tombol konfirmasi menyebut aksinya ("Reset progress"), bukan "OK".
- **DropdownMenu / OverflowMenu**: aksi sekunder untuk tiga aksi atau lebih.
- **Popover**: pilihan kecil (model picker, insert point).
- **Toast**: hasil aksi singkat. Bukan untuk error validasi (gunakan field error atau `Alert`).

### Forms
- `Field`: label di atas, hint di bawah, error di bawah dengan `role="alert"`.
- `FormSection` mengelompokkan field. `FormGrid` dua kolom (satu kolom di mobile). `FormActions` rata kanan. Aksi destruktif di kiri.
- Toggle setting: `SwitchField` (seluruh baris bisa diklik). Checklist: `CheckboxField`.
- `Select` (Radix) memakai label manual (`ControlField`), karena root Radix tidak menerima `id` dari `Field`.
- Pengaturan lanjutan: `Accordion` tertutup secara default.
- Status dirty: tampilkan "Ada perubahan belum disimpan" dan nonaktifkan simpan jika tidak ada perubahan.
- Password: `PasswordInput` atau `InputGroup`.

### Data
- `DataTable`: `responsive="stacked"` untuk daftar pengguna dan learner. Kolom `required` untuk kolom primer. Maksimal lima kolom. Aksi di kolom terakhir.
- `KPICluster` untuk ringkasan. `ChartPanel` / `MetricCard` untuk grafik.
- `StateView` dengan `kind`: `loading` / `empty` / `error` / `success` / `locked`. Setiap daftar wajib punya empty state, dengan CTA bila relevan.

### Feedback & status
- `Alert` (inline, bertahan): `tone` neutral / info / success / warning / danger / ai.
- `Badge`: `variant` soft / outline. Gunakan `hue` untuk status semantik. Jangan lebih dari dua warna badge dalam satu baris.

### Navigasi
- `Tabs` variant `underline` untuk section di dalam halaman.
- `SegmentedControl` untuk filter yang saling eksklusif. `block` untuk lebar penuh, `count` untuk jumlah.
- `Breadcrumbs` di topbar. `PageHeader back` untuk halaman detail.

### Progres & kartu
- `Progress` (bar linear), `ProgressRing` (level, target), `Segments` (langkah).
- `Surface` (default / muted / tone) dan `Card` parts. `IconTile` untuk ikon fitur, dengan `hue`.

---

## 6. Layout & spacing

- **Spacing**: skala `space0`…`space16` (basis 4px). Ritme standar: `space-2`, `space-3`, `space-4`, `space-5`, `space-6`.
- **Radius**: Xs 6, Small 8, Control 10 (field), Panel 14 (row, tile), Surface 20 (kartu), Feature 28 (hero), pill.
- **Ritme halaman**: header → ringkasan → konten. Jarak antar section `space-5` (mobile) dan `space-6` (desktop).
- **Grid**: dua kolom mulai 1280px untuk list + editor. Di bawah itu satu kolom.
- **Lebar baca**: materi maksimal ± 68ch.

---

## 7. Warna & hue

- **Primary green** (`#318139`): belajar dan aksi utama.
- **AI orange** (`#D4451A`): APPI dan aksi AI.
- **Netral**: paper `#f5f6f4`, ink `#1f2320`.
- **Learning hues**: green, orange, blue, violet, teal, amber, rose. Gunakan `hueFor(key)` agar warna stabil per level atau modul. Jangan memilih warna acak.
- Turunan hue: `--hue`, `--hue-soft`, `--hue-tint`, `--hue-ink`. Diset lewat `data-hue`.
  - **Tint** untuk kartu besar. **Soft** untuk badge. **Ink** untuk teks di atas tint.
- **Dark mode**: setiap token punya padanan dark. Jangan hardcode warna.

---

## 8. Ikon

- Registry: `src/components/icons/AapmIcon.jsx` dan `src/design-system/icons/iconData.js` (generated).
- Nama semantik: `dashboard`, `course`, `book`, `quiz`, `award`, `users`, `analytics`, `kpi`, `ai`, `settings`, `check`, `alert`, `danger`, `delete`, `edit`, `plus`, `close`, `refresh`, `arrowRight`, dan lainnya.
- Default: Solar **Bold Duotone**. Glyph kecil: Solar **Linear**.
- Ikon AAPM custom: `egg`, `hen`, `feed`, `cage` (farm), `close`, `glyphCheck`, `plus`, `glyphMinus`, `grip`.
- **Dilarang**: lucide, heroicons, atau import ikon langsung di luar registry. Ikon baru ditambahkan ke registry.

---

## 9. Motion

**Token**: `fast` 140ms, `base` 200ms, `panel` 240ms, `entrance` 380ms, `chart` 700ms. Easing `cubic-bezier(.2,.8,.2,1)`.

**Pola yang diizinkan** (`src/design-system/styles/motion.css`):

| Pola | Detail |
|---|---|
| Page entrance | Section naik 6px sambil fade. Stagger 40ms hingga 200ms (`.aapm-page > *`). |
| Koleksi | Stat, kartu kursus, level, achievement, provider, status link: stagger 30–90ms. |
| Progres | Bar tumbuh (`scaleX`). Ring tergambar (`stroke-dashoffset`). |
| Pilihan | Key pill pada kuis. Feedback bar pop. Pill bottom nav. |
| Tab | Fade saja, tanpa geser (`[role="tabpanel"][data-state="active"]`). |
| Overlay | Sheet slide 240ms. Dialog fade-scale. |
| Hover | Background dan border 140ms. Affordance kecil (chevron geser 2px). |
| Tekan (press) | Tombol, choice, module row, kartu interaktif: scale 0.97–0.99 saat `:active`. |
| Indikator tab | Garis underline tumbuh dari tengah (`scaleX`) pada tab aktif. |
| Bottom nav | Bar indikator di atas tab aktif meluncur masuk. Ikon menekan ke 0.9 saat disentuh. |
| Chat APPI | Turn dan bubble naik 8px sambil fade. Welcome dan starter bertahap. Tombol "Ke pesan terbaru" fade-in dari bawah. |
| Status & empty | Alert dan StateView fade-up (`aapm-page-in`). |

**Dilarang**:
- Bounce atau animasi loop dekoratif.
- Animasi di dalam editor (`.aapm-editor-content { animation: none }`).
- Transform pada sticky bar atau input.
- Animasi yang menunda input.
- Durasi UI di atas 400ms.

**Reduced motion**: `base.css` menurunkan semua durasi ke 1ms. Uji dengan `prefers-reduced-motion`.

---

## 10. Verifikasi (definition of done)

1. `npm run lint` — 0 error.
2. `npm test` — semua pass (saat ini 24/24).
3. `npm run tokens:check` — `aapm-tokens.css` up to date.
4. `npx vite build` — sukses. Peringatan ukuran chunk sudah ada sebelumnya.
5. Browser di localhost:
   - Desktop 1440.
   - Mobile 375: `document.documentElement.scrollWidth === clientWidth` (tidak ada overflow horizontal halaman).
   - Dark mode.
   - Konsol tanpa error baru.
6. Interaksi: buka Sheet atau Dialog, submit, state error, state empty.
7. Login uji **hanya** dengan akun seed lokal di `database/seed.php`, dan hanya di localhost. Jangan pernah memakai kredensial produksi.

---

## 11. Anti-pattern (jangan)

- Judul ganda: judul halaman sama dengan nama record yang juga tampil di hero.
- Dua CTA `primary` dalam satu region.
- Tombol "OK" atau "Ya" untuk aksi destruktif.
- Form panjang di dialog kecil. Gunakan Sheet.
- Tabel lebih dari lima kolom di mobile tanpa `stacked`.
- Teks di bawah 12px untuk konten. Badge dan caption boleh 11px.
- `!important` Tailwind (`!p-0` dan sejenisnya) untuk menimpa komponen DS. Ubah CSS komponennya.
- Nested scroll, kecuali editor.
- Menu mati atau tombol palsu untuk endpoint yang belum ada. Tampilkan di "Memerlukan endpoint baru".
- Warna, radius, atau durasi literal di komponen.

---

## 12. Orkestrasi multi-agent

- **Satu agent = satu surface atau shell.**
- File DS bersama (`components.css`, `patterns.css`, `forms.jsx`, `layout.jsx`, `overlays.jsx`) disentuh satu agent dalam satu waktu. Agent lain menunggu atau bekerja di surface yang berbeda.
- **Urutan kerja**: token → primitive DS → pattern → halaman → verifikasi.
- **Commit** per surface, misalnya `feat(ui): <surface> …`. Perubahan token atau DS dalam commit terpisah.
- **Jangan commit**: `.claude/`, `config.php`, `storage/`. `dist/` hanya bila diminta, dengan pesan `build: publish cPanel artifact …`.
- **Push ke `develop`** men-deploy staging. Tanyakan user dulu.
- **Keputusan produk** (copy, alur, data) ditanyakan ke user. Jangan dikarang.

---

## 13. Template prompt untuk agent

> Refine `<surface>` sebagai archetype `<X>` (bagian 3) pada shell `<Y>`.
> Gunakan hanya primitive DS (bagian 5), token (bagian 6–7), dan motion (bagian 9).
> Pertahankan semua handler dan API data. Ubah hanya komposisi dan markup.
> Verifikasi sesuai bagian 10.
> Laporkan: file yang berubah, screenshot desktop dan mobile, hasil lint, test, dan build.

---

## 14. Backlog

- Editor modul: peta shortcut dan undo/redo.
- Course player: progres sticky saat scroll di mobile.
- Audit aksesibilitas (axe) per shell.
- Code-splitting: chunk `MermaidDiagram`, `cytoscape`, `billboard` di atas 500kB.
- Admin Courses: review empty state dan motion kartu.
- Profil: sheet detail achievement.

---

## 15. Peta file

| Area | Lokasi |
|---|---|
| Token (sumber) | `src/design-system/tokens/aapm-academy.tokens.json` |
| Generator token | `scripts/build-aapm-tokens.mjs` → `src/design-system/aapm-tokens.css` |
| Urutan CSS | `src/index.css` (tokens → preflight → base → components → shell → course → patterns → motion → legacy → features) |
| Styles DS | `src/design-system/styles/{base,components,shell,course,patterns,motion}.css` |
| Komponen DS | `src/design-system/components/{actions,overlays,forms,display,layout,data,toast,tooltip,charts}.jsx` |
| Pattern shell | `src/design-system/patterns/AppShell.jsx` |
| Shell Academy | `src/components/layout/AcademyShell.jsx`, `academyNavigation.js` |
| Shell admin | `src/components/layout/AdminShell.jsx`, `src/components/admin/adminNavigationItems.js` |
| Ikon | `src/components/icons/AapmIcon.jsx`, `src/design-system/icons/iconData.js` |
| Editor modul | `src/pages/admin/AdminModuleEditor.jsx`, `src/components/admin/EditorialComposer.jsx`, `src/styles/features/editor-*.css` |
| Test | `tests/academy-hardening.test.mjs` |
