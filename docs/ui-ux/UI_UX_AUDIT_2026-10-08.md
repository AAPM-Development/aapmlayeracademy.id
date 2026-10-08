# AAPM Academy — UI/UX Bug & Design Audit (2026-10-08)

Scope: all shells on `develop` (local, seed account). Routes checked at desktop (1110–1280 px) and phone (375 px): Academy (`/`, `/modules`, `/modules/:n`, `/quiz/:n`, `/final-exam`, `/calculators`, `/kpi`, `/ai-assistant`, `/certification`, `/profile`), admin (`/admin`, `/admin/courses`, `/admin/courses/:id`, `/admin/courses/:id/modules/:mid`, `/admin/learners`, `/admin/learners/:id`, `/admin/users`, `/admin/ai-settings`, `/admin/workspace-status`), auth (`/login`, `/register`, `/forgot-password`, `/reset-password`) and the 404 page.

Method: an in-page DOM audit on every route (overflow, unnamed controls, unlabeled inputs, heading count, text under 11 px, tap targets under 36 px on phones, duplicate IDs, leaked tokens such as `undefined`), plus manual flows (quiz answer → check → result, calculator input, KPI sheet submit, sidebar and admin navigation sheets, theme toggle) and visual review of each shell.

Severity: **P1** breaks a learner/admin task or an accessibility requirement on a core path · **P2** clear UX or accessibility gap · **P3** polish.

---

## Summary

| Severity | Count | Theme |
|---|---|---|
| P1 | 6 | Bounded module flow on phones, module editor on phones, unnamed controls (a11y) |
| P2 | 9 | Tap targets, headings, validation, copy, floating launcher, editor hierarchy |
| P3 | 6 | Small type, duplicate entry points, dev-only console noise |

What is strong: the quiz feedback and result screens, the final-exam navigator, the certification tier cards, the course builder header and toolbar, the KPI sheet layout, the auth split shell, and the AI chat after the last rework. The gaps cluster in the learner module flow on phones, the module editor on phones, and accessible names on icon-only controls.

---

## P1 — fix first

### P1-1 · Module flow: "Tandai selesai" hidden on phones; primary CTA skips Praktik
- **Where:** `/modules/:n` (learner player), all modules.
- **Evidence:** at 375 px on `/modules/2` the only footer action is "Kerjakan kuis" (`/quiz/2`). The "Tandai selesai" button has `hidden sm:inline-flex` and computes to `display: none`. On desktop, `Bagian 1 dari 4 · Materi` still shows "Kerjakan kuis" as the primary action, while the stepper lists Praktik as step 2.
- **Source:** `src/pages/ModuleDetail.jsx:141` (primary becomes quiz link), `:143` (mark-complete only when no quiz), `:186` (`hidden sm:inline-flex`).
- **Impact:** a phone learner cannot mark a section complete, and the step order is broken: the CTA jumps from Materi to the quiz without the practice step.
- **Fix:** the primary CTA follows the stepper (Materi → "Lanjut ke praktik" → Kuis). Keep "Tandai selesai" visible on every breakpoint.

### P1-2 · Stepper on phones shows bare numbers; state disagrees
- **Where:** `/modules/:n` stepper, under 479 px.
- **Evidence:** the stepper reduces to "1 Materi", then "2", "3", "4" with no labels (`course.css:380` hides `.aapm-flow__text`). On a completed module (`/modules/1`), step 2 (Praktik) still shows an unchecked number while steps 3 and 4 show ticks.
- **Fix:** show the current step label on phones (the rule only keeps it for `data-state="current"`), and derive Praktik's completed state from the same source as the others.

### P1-3 · Module editor overflows on phones
- **Where:** `/admin/courses/:id/modules/:mid` at 375 px.
- **Evidence:** the composer panel is 437 px inside a 375 px frame. The `main` container has `overflow: hidden`, so the right edge of the Materi description and the "Bank soal" tab are clipped with no scroll cue. The sticky command bar (Materi/Tujuan/Praktik chips, Tambah blok, Pratinjau, Simpan) plus the tab row takes roughly 40% of the screen.
- **Source:** likely the editor grid in `src/styles/features/editor-workspace.css` (children not constrained with `min-width: 0`), to confirm in the browser; command bar in `src/components/admin/EditorQuickNav.jsx`.
- **Fix:** `min-width: 0` on the editor grid children; on phones, collapse the section chips into a single "Bagian: Materi ▾" control and keep only Simpan and Pratinjau in the bar.

### P1-4 · Icon-only sidebar links have no accessible name
- **Where:** collapsed sidebar on `/ai-assistant`, the module editor and any collapsed admin rail.
- **Evidence:** the audit reports 8–9 nameless `aapm-nav-item` links per page. Each link is an icon wrapped in a Tooltip, and the Tooltip does not give the link a name.
- **Source:** `src/design-system/patterns/AppShell.jsx:89` (label rendered only when expanded) and `:93` (Tooltip wrapper).
- **Fix:** `aria-label={item.label}` on the link whenever `collapsed` is true (WCAG 4.1.2).

### P1-5 · Quiz and final-exam icon buttons have no name on phones
- **Where:** `/quiz/:n` and `/final-exam` footer at 375 px.
- **Evidence:** "Sebelumnya" (and the flag button on the final exam) lose their text on phones through `data-hide-label-mobile` but have no `aria-label`. The audit reports them as unnamed controls.
- **Source:** `src/pages/Quiz.jsx:100`, `src/pages/FinalExam.jsx:110` and `:117`.
- **Fix:** add `aria-label` to these buttons (or let the `hideLabelMobile` helper set it).

### P1-6 · Certification: locked tier offers "Lanjutkan"
- **Where:** `/certification`, tier 2 "Layer Farm Operator" (status `Terkunci`, `0/2 modul`).
- **Evidence:** the card shows the lock chip and then a "Lanjutkan" link to `/modules`. The action contradicts the state, and it doesn't say what unlocks the tier.
- **Source:** `src/components/academy/CertificationPath.jsx:44-45` (`in-progress` and `locked` share one branch).
- **Fix:** for `locked`, show "Syarat: 2 modul lagi" as text with a "Lihat syarat" link. Reserve "Lanjutkan" for `in-progress`.

---

## P2 — clear gaps

### P2-1 · Tap targets under 36 px on phones (broad)
- **Where:** nearly every shell at 375 px. Examples: "Path / Katalog" segmented tabs, "Riwayat" and "Baru" in the AI header, "Lihat peserta", "Kelola", "Kelola kurikulum", "Preview Wisman", the show-password toggles on login and register, "Lupa kata sandi?", the Admin "Aktifkan provider" switch.
- **Fix:** primary and secondary controls at 44 px on phones; icon buttons at 40 px minimum. Use the existing `size` tokens (`controlMd`/`controlLg`) instead of 32 px.

### P2-2 · Missing `h1` on focus shells and the 404 page
- **Where:** quiz, final exam, the 404 page (`H1_COUNT 0`).
- **Source:** `FocusShell` in `src/design-system/patterns/AppShell.jsx` has no page title element; `src/lib/PageNotFound.jsx` renders its message as a non-heading.
- **Fix:** render the lesson, quiz or exam title as `h1` in the focus bar (visually compact), and make the 404 title an `h1`.

### P2-3 · Duplicate IDs in the module editor
- **Where:** `/admin/courses/:id/modules/:mid` (`#editorial-block-inline-content` appears twice).
- **Evidence:** the editor's block section and the learner preview rendered inside the editor both emit the same anchor ID.
- **Source:** `src/components/admin/EditorialComposer.jsx:789` (`id={contentBlockAnchorId(block.id)}`) and `src/components/academy/EditorialContent.jsx:503` (`id={editorialBlockAnchorId(block.id)}`).
- **Fix:** prefix anchors by context (`editor-` for the composer) so labels and `aria-labelledby` resolve to one element.

### P2-4 · KPI form relies on native validation; copy mixes languages
- **Where:** `/kpi` "Catat minggu ini" sheet.
- **Evidence:** submitting empty shows only the browser's bubble on the hidden required field (`farm-week`); there is no inline error. Labels mix Indonesian with English: "Feed intake (g)", "Egg weight (g)", "Mortality (%)", "Water (ml)", "Humidity (%)", "Revenue (Rp)", "Cost (Rp)".
- **Source:** `src/pages/KpiDashboard.jsx:67`, `:74` and nearby field definitions.
- **Fix:** use the `Field` `error` prop with an inline message ("Isi minggu ke berapa flock ini"), and translate the labels to "Asupan pakan (g)", "Berat telur (g)", "Mortalitas (%)", "Air minum (ml)", "Kelembapan (%)", "Pendapatan (Rp)", "Biaya (Rp)".

### P2-5 · Calculators: blank result without a reason
- **Where:** `/calculators`, any tool with a zero or missing divisor (e.g., FCR with 0 eggs).
- **Evidence:** the result shows "—" and a formula line "FCR = 120 ÷ 0.0 = —" with no message.
- **Source:** `src/pages/Calculators.jsx:132`.
- **Fix:** show a hint under the result ("Isi jumlah telur di atas 0 untuk menghitung FCR") and mark the field `aria-invalid` when the input is zero.

### P2-6 · Calculator tool rail has no scroll cue
- **Where:** `/calculators` at 375 px.
- **Evidence:** the tool chips scroll sideways (intentional), but the last visible chip is cut at the edge with no fade or indicator.
- **Fix:** an edge fade (mask) on the rail when more tools are off-screen.

### P2-7 · Register is reachable while signed in
- **Where:** `/register`, `/login`, `/forgot-password` when a session exists.
- **Evidence:** `/register` renders the form for the signed-in demo account; there is no redirect to the dashboard.
- **Source:** public routes in `src/App.jsx:83–86` have no guard.
- **Fix:** redirect authenticated users from the auth routes to `/` (keep `/reset-password` accessible).

### P2-8 · Floating APPI launcher covers content
- **Where:** all Academy and admin shells on desktop and phones.
- **Evidence:** the "Tanya APPI" pill sits over the text of the "Alat farm" card on the dashboard and over the tier corner on certification. On phones it sits over the quiz footer and the calculator result.
- **Fix:** offset the launcher above the footer on pages that have one, and collapse it to the icon after scroll.

### P2-9 · Module editor has three stacked navigation layers
- **Where:** `/admin/courses/:id/modules/:mid`.
- **Evidence:** breadcrumb, then the Konten / Pratinjau learner / Bank soal tabs, then the Materi / Tujuan / Praktik chips in the sticky bar. Each layer answers a different question, but they look the same weight.
- **Fix:** keep the tabs for the mode (Konten, Pratinjau, Bank soal) and make the section chips a secondary segmented control inside the Konten tab. Drop the breadcrumb's "Kurikulum" when the back link already shows it.

---

## P3 — polish

- **P3-1 · Small type.** Eyebrows at 10 px (`REGISTRY`, `ALAT CEPAT`, `COURSE`), the APPI composer badges at 11 px, and "Tersimpan di akun Anda" at 10 px. Raise eyebrows to 11 px and keep the uppercase tracking.
- **P3-2 · Course naming is inconsistent.** Admin shows "Layer Poultry Farm Management"; the learner catalog says "Layer Farm Academy"; the slug is `layer-farm-management`. Pick one display name.
- **P3-3 · Three APPI entry points on the dashboard.** The top bar "Tanya APPI", the floating pill and the "Alat farm" list item all open the same chat. Keep the floating pill and the list item; drop the top-bar button on pages that already have the launcher.
- **P3-4 · Quiz result "Tinjau jawaban" looks like plain text.** The review card needs a chevron and hover state so it reads as an action.
- **P3-5 · Disabled primary states are low contrast.** "Periksa" on the quiz (disabled) is close to its enabled look. Use a clearly muted disabled style (see `--aapm-semantic-muted` on the disabled surface).
- **P3-6 · Console noise.** Dev only: a stale HMR `useAuth` error and Vite's WebSocket error (fixed by restarting the dev server), and 401s before sign-in. Not product bugs, but worth a `console` clean-up pass before release.

---

## Design notes (not bugs)

- **Verb consistency.** The same kind of action is labelled differently: "Lanjutkan" (certification, dashboard), "Buka" (admin learners), "Kelola" (admin users), "Edit" (course rows), "Kerjakan kuis" / "Mulai kuis" (quiz entry). Pick one verb per action type.
- **Button sizes mix** `sm` (32 px) and `md` (40 px) on the same mobile row (AI header, admin row actions). Settle a single small-control size for rows.
- **Theme switch replays entrance motion.** After toggling dark mode, page content fades in again (observed on the profile and editor captures; not measured frame by frame). Keep the entrance animation keyed to route changes only.
- **Empty states** are consistent (StateView). The chat history empty line now explains the next step.

---

## Suggested order

1. P1-1, P1-2 (module flow on phones and CTA order) — learner core path.
2. P1-4, P1-5, P2-2, P2-3 (accessible names, headings, duplicate IDs) — one pass, low risk.
3. P1-3, P2-9 (module editor on phones and hierarchy).
4. P1-6, P2-4, P2-5, P2-7 (certification, KPI validation and copy, calculator hint, auth redirect).
5. P2-1 tap targets, P2-8 launcher offset, then P3.

---

## Status update (same day)

**Fixed on `develop`**
- P1-1 Module flow: the primary action follows Materi, Praktik, Kuis, Selesai (`0b54f67`). The shortcut that completed a quiz module without the quiz is removed.
- P1-2 Stepper: labels stay on phones and the states match the module (`0b54f67`).
- P1-3 Module editor on phones: composer fits 375px, and the sticky bar is two short rows (`2c3f8f8`).
- P1-4 Collapsed sidebar links are named (`1726139`).
- P1-5 Quiz and final-exam icon buttons are named (`1726139`).
- P1-6 Locked certification tier says what unlocks it (`b3b0e68`).
- Also found while fixing P1-1: a quiz was marked complete on every submission, including failed attempts. Completion now requires a pass, and a retake never clears an earlier completion (`0b54f67`).

**Still open:** P2-1 tap targets, P2-2 missing h1, P2-3 duplicate editor IDs, P2-4 KPI validation and copy, P2-5 calculator blank-result hint, P2-6 tool rail scroll cue, P2-7 register while signed in, P2-8 floating APPI launcher overlap, P2-9 editor navigation layers, all P3.

**Decision to confirm:** quiz modules no longer offer "Tandai selesai". Completion comes from passing the quiz, which matches the bounded flow.

---

## Status update: P2 pass

**Fixed**
- P2-1 Tap targets on phones: buttons, tabs, the lesson stepper and the composer switch reach 40px (the composer switch uses an extended hit area). Auth show-password toggles use the 40px icon size. The auth text links were not re-measured.
- P2-2 One heading per screen: quiz and exam titles are visually hidden h1s, and the 404 title is an h1.
- P2-3 Duplicate IDs: the editor's block anchors carry an editor prefix.
- P2-4 KPI form: inline error under the week field, focus moves to it, the native bubble is off, and labels are Indonesian.
- P2-5 Calculators: a blank result explains that values must be filled and above 0.
- P2-6 Calculator tool rail: edge cue while more tools are off-screen.
- P2-7 Auth pages: signed-in users are sent to the app (login returns to its return path).
- P2-8 Floating APPI pill: hidden on phones where the bottom bar or a focus footer already holds the space.
- P2-9 Editor: the duplicated back link is removed. The three navigation layers are not yet merged.

**Still open:** P3 polish, and merging the editor's navigation layers.
