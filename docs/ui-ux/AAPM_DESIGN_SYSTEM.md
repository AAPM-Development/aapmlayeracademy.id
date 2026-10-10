# AAPM Academy Design System

Academy UI follows the AAPM Farm design system (`AAPM-Development/farm.aapm.co.id`,
`packages/design-tokens`, `packages/ui`, `packages/patterns`) adapted for a
colourful course app. Ten4Seven is no longer used.

## Layers

| Layer | Location | Notes |
|---|---|---|
| Token authority | `src/design-system/tokens/aapm-academy.tokens.json` | primitive → semantic (light/dark) → component, plus a legacy HSL bridge |
| Generated CSS | `src/design-system/aapm-tokens.css` | `npm run tokens`; `npm run tokens:check` and the test suite fail when stale |
| Base / reset | `src/design-system/styles/base.css` | Inter, typography roles (`aapm-text-*`), focus, motion keyframes, reduced motion |
| Components | `src/design-system/styles/components.css` + `components/*.jsx` | Button, Field, Select, Checkbox, Switch, Badge, Card, Surface, IconTile, Progress, Tabs, Dialog, Sheet, Menu, Tooltip, Toast, Table, Metric, StateView, PageHeader |
| Shells | `src/design-system/styles/shell.css` + `patterns/AppShell.jsx` | AppShell, Sidebar, SidebarNav, Topbar, AccountMenu, BottomNav, NavigationSheet, FocusShell, StatusPage (standalone 404 / access denied / boot error), auth |
| Course patterns | `src/design-system/styles/course.css`, `src/components/academy/CourseElements.jsx` | covers, course cards, learning path (unit banners + winding nodes, `pathOffset()` in `src/lib/learningPath.js`), outline, module flow stepper, lesson reading, quiz choices and check bar, result, curriculum builder, calculators |
| Icons | `src/design-system/icons/iconData.js`, `AapmIcon` | Solar Bold Duotone (product/state) + Solar Linear (control glyphs), AAPM egg/hen/feed/cage; bundled offline |

Charts (`@/design-system/charts`) and the command list (`@/design-system/command`)
are separate entries so Recharts and cmdk only load on routes that use them.

## Rules

- Import UI from `@/design-system` (or the `@/components/primitives` facade).
- No raw colours, sizes or radii in feature code; use tokens, component props
  or Tailwind utilities that map to tokens (`text-body`, `rounded-surface`,
  `bg-hue-green-tint`, `shadow-card`…).
- Colour has meaning: `primary` (green) for actions and completion, `attention`
  /`ai` (orange) for APPI and the current learning step, learning hues
  (`green, orange, blue, violet, teal, amber, rose`) for levels, categories and
  achievements via `data-hue` / `hue` props. `hueFor(level)` keeps a level's
  colour stable everywhere.
- Action hierarchy: one primary per view; `learn` is the tactile course CTA;
  contextual row actions use an inline secondary action + `OverflowMenu`;
  destructive actions live in the overflow menu and always confirm.
- Every data view handles loading / empty / error with `StateView`.
- Motion uses the token durations and two easings: `motion-ease` for arrival
  and `motion-ease-spring` for learning moments (right answer, verdict icon,
  result badge, current path node). Everything collapses under reduced motion.
- Tactile edges (learn button, path nodes, verdict and send buttons) mix the
  face colour toward `--aapm-depth-shade`, so they read darker in both themes.

## Shells

- **Learner** (`AcademyShell`): sidebar with course progress ring, grouped nav,
  topbar breadcrumbs + account menu; phones get a bottom nav
  (Beranda · Belajar · APPI · KPI · Menu) and a navigation sheet.
  The mobile bar is inset, clears safe areas, keeps labels visible, and marks
  Menu when the current destination is in the sheet. Menu exposes its open state.
- **Focus** (`FocusShell`): lesson player and assessments. Course bar, outline,
  one scrolling stage, persistent action bar. Bounded module flow:
  Materi → Praktik → Kuis → Selesai → next module. In a quiz the action bar
  becomes the verdict after Periksa (`footerTone`). A quiz opens with an
  introduction; only Mulai kuis starts or resumes a saved attempt. The APPI
  launcher clears the actual action-bar height, including expanded feedback.
- **Admin** (`AdminShell`): same anatomy with a "Ruang admin" context and
  breadcrumbs by depth (Admin › Manajemen course › Kurikulum › Editor modul).
  The phone bottom nav holds four destinations plus Menu.
  APPI is available in the admin shell. On phones the editor owns the bottom
  action bar; its measured height reserves content space and keeps APPI clear.

## APPI, the mascot

APPI is the rooster from `public/assets/avatar` (faces `Asset 1–12`, decor
`Asset 13–24`), rendered only through `AppiMascot` / `AppiSays`
(`src/components/appi/AppiMascot.jsx`); the chat avatar (`AiAvatar`) wraps it.

- **One contextual APPI per screen, plus the launcher.** APPI appears at meaningful moments (home
  coach, lesson end, quiz streak and result, calculator verdict, KPI reading,
  empty states), the way Duolingo uses Duo. Navigation uses glyph icons.
- **Moods carry meaning**: `idle`, `happy`, `cheer`, `proud`, `wink`, `talk`,
  `think`, `idea`, `curious`, `data`, `concerned`, `surprised`, `loading`.
- **Alive, not busy**: character sizes breathe with squash and stretch over a
  ground shadow, blink, and every few seconds wink, glance, nod, hop or turn
  left/right. Reduced motion holds APPI still.
- **Launcher**: a round tactile button on all screen sizes outside the APPI
  workspace. It clears mobile navigation, calculator results and the measured
  focus and editor footers. Each mascot has an independent animation rhythm.
- Pages hand APPI a prepared question with `askAppi(prompt)`
  (`src/lib/askAppi.js`); the learner reviews it before sending.
- Chat management shares search, date grouping, sorting, active/archive filters,
  selection, rename and deletion across desktop, mobile and the floating panel.
  Hapus semua percakapan confirms the whole account history, including unloaded
  pages and archives. The authenticated DELETE command clears conversations and
  their messages; the provider then clears related account drafts and re-reads
  the history. Other accounts are outside the command's scope.

## Celebration and motion

- `celebrate(kind, { origin })` in `src/lib/celebrate.js`: `burst` (quiz
  passed, module done), `milestone` (perfect score; side cannons and stars),
  `streak` (three right answers, from the action bar). Skipped under reduced
  motion.
- `CountUp` (`src/components/motion/CountUp.jsx`) animates scores and metrics;
  screen readers get the final value once.
- Result screens use APPI over a pulsing glow (and slow rays when passed).

## Farm tools

- **Calculators** are data-driven (`tools` in `src/pages/Calculators.jsx`):
  inputs, `compute`, and a reference `scale` whose zones (good / watch / act)
  give the verdict. Cards size their layout with a container query; phones get
  a sticky result dock.
- **Farm KPI**: APPI's weekly reading first, six indicator tiles (latest week,
  change vs the previous week, sparkline) that select the one `TrendChart`
  (padded domain, auto-width axis, optional reference band), then finance and
  history.
  Missing current-week fields do not borrow an older value for APPI's current
  reading. Indicator tiles retain the last known value with its source week.
- **Auth** (`AuthLayout`): form column + brand media panel for every auth route.
  The column is top-anchored so the brand and title never move between
  routes; below 1024px the panel becomes a poster band above the form. Forms
  set `noValidate` and validate on submit into each Field's `error`
  (`src/lib/authValidation.js`); links use the shared `.aapm-link`.
