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
| Shells | `src/design-system/styles/shell.css` + `patterns/AppShell.jsx` | AppShell, Sidebar, SidebarNav, Topbar, AccountMenu, BottomNav, NavigationSheet, FocusShell, auth |
| Course patterns | `src/design-system/styles/course.css`, `src/components/academy/CourseElements.jsx` | covers, course cards, level path, outline, module flow stepper, lesson reading, quiz choices, result, curriculum builder, calculators |
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

## Shells

- **Learner** (`AcademyShell`): sidebar with course progress ring, grouped nav,
  topbar breadcrumbs + "Tanya APPI" + account menu; phones get a bottom nav
  (Beranda · Belajar · APPI · KPI · Menu) and a navigation sheet.
- **Focus** (`FocusShell`): lesson player and assessments. Course bar, outline,
  one scrolling stage, persistent action bar. Bounded module flow:
  Materi → Praktik → Kuis → Selesai → next module.
- **Admin** (`AdminShell`): same anatomy with a "Ruang admin" context and
  breadcrumbs by depth (Admin › Manajemen course › Kurikulum › Editor modul).
- **Auth** (`AuthLayout`): form column + brand media panel for every auth route.
