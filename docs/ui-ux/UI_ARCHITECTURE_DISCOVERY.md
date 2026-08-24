# AAPM Layer Academy — UI Architecture Discovery

**Phase:** 0 — Discovery (read-only)
**Status:** Complete
**Date:** 2026-08-24
**Scope:** Repository `D:\SA\aapmlayeracademy.id` and local UI sources under `D:\SA\ASSET`
**Masterplan reference:** `D:\Download\AAPM_Layer_Academy_UI_UX_Modular_Masterplan_v2.md`

## Executive Summary

The current application already has the right primitive foundation for the
masterplan: React 18, Vite, Tailwind CSS 3, shadcn-style primitives backed by
Radix UI, Lucide icons, Recharts, React Router, and a native PHP API.

The safest path is to keep the current runtime and extract patterns from the
local assets into an AAPM semantic component layer. ShadcnBlocks is the closest
source for direct structural adaptation. Minimal UI and HeroUI are valuable
references for analytics density, AI interactions, and polish, but should not
be installed as competing runtime design systems in the current application.

No production UI was changed during this discovery phase.

## Current Architecture

### Runtime and dependencies

- React 18.2 with JSX; the repository is JavaScript-first with a small TypeScript utility area.
- Vite 6 with the `@` alias mapped to `src`.
- Tailwind CSS 3.4 with `tailwindcss-animate`.
- shadcn-style UI primitives in `src/components/ui`, using Radix UI, CVA, `cn`, and CSS variables.
- React Router DOM 6 for route composition.
- TanStack Query for server state and course data hooks.
- Recharts for KPI charts.
- Lucide React for icons.
- Native PHP API accessed through `src/api/nativeClient.js`; authentication and product behavior are not coupled to a vendor UI library.

### Route and shell structure

`src/App.jsx` owns the router and separates public authentication routes from
protected application routes. All protected routes currently render through a
single `src/components/Layout.jsx` shell.

Current protected product routes:

| Product area | Route | Current page |
|---|---|---|
| Dashboard | `/` | `src/pages/Home.jsx` |
| Learning | `/modules`, `/modules/:moduleNumber` | `Modules.jsx`, `ModuleDetail.jsx` |
| Assessment | `/quiz/:moduleNumber`, `/final-exam` | `Quiz.jsx`, `FinalExam.jsx` |
| Farm tools | `/calculators`, `/kpi` | `Calculators.jsx`, `KpiDashboard.jsx` |
| AI | `/ai-assistant` | `AiAssistant.jsx` |
| Certification | `/certification` | `Certification.jsx` |

The current navigation array is declared inside `Layout.jsx`. The shell has a
desktop sidebar and a custom mobile overlay, but there is not yet a separate
Academy shell, Learning Focus shell, or Assessment Focus shell.

### Current design foundation

`src/index.css` defines generic shadcn tokens such as background, foreground,
primary, muted, destructive, chart, and sidebar variables. `tailwind.config.js`
maps those variables into Tailwind utilities. The foundation does not yet have
the domain tokens required by the masterplan, such as `ai`,
`learning-active`, `learning-complete`, `learning-locked`, or metric semantic
states.

Existing reusable primitives include Button, Card, Input, Label, Dialog, Sheet,
Drawer, Sidebar, Tabs, Progress, Table, Chart, Skeleton, Toast, and related
Radix wrappers. This is a strong base for a semantic AAPM layer.

## Current UI Problems and Architectural Pressure

These are evidence-based observations for future phases, not production fixes
in Phase 0:

1. `Layout.jsx` owns navigation data, shell layout, progress summary, user identity, desktop behavior, and mobile behavior in one component.
2. Navigation and some product counts are embedded in markup or page logic. For example, the shell owns the seven navigation items and the `22` module total.
3. Product pages contain local visual abstractions. `Home.jsx` has a local `StatCard`, `Calculators.jsx` has a local `Card`, and `KpiDashboard.jsx` has a local chart wrapper. These are candidates for semantic components.
4. `KpiDashboard.jsx` renders Recharts directly in the page. There is no reusable KPI metric card, chart card, farm context bar, or insight component shared with Dashboard or AI.
5. Lesson and assessment pages share the default shell even though the masterplan calls for reduced distraction and contextual navigation in those modes.
6. Several pages use direct palette utilities such as amber, emerald, sky, and violet. This makes a future brand or semantic-state change more expensive than changing a token or recipe.
7. The current pages mix product behavior and visual composition. Formula and scoring behavior must remain stable while the visual layer is extracted.

## Reusable Existing Components and Contracts

### Keep as canonical primitives

The existing `src/components/ui` directory should remain the canonical local
primitive layer. New product components should consume these primitives rather
than introducing a second Button, Card, Dialog, Sidebar, or Chart system.

### Existing product-level candidates

| Existing code | Reuse direction |
|---|---|
| `Layout.jsx` | Split into shell pieces behind a stable layout contract; preserve current routing and auth behavior. |
| `AppBrand.jsx` | Keep as the AAPM brand entry point for shell and auth layouts. |
| `AuthLayout.jsx` | Keep as the auth shell; later apply tokens without coupling it to application navigation. |
| `PasswordField.jsx` | Keep as the shared auth field pattern. |
| `useCourseData.js` | Preserve as the behavior/data contract for product components. |
| `AuthContext.jsx` and `ProtectedRoute.jsx` | Preserve; visual work must not alter authentication behavior. |
| `src/components/ui/chart.jsx` | Use as the shared chart primitive for KPI product components. |

### Stable product component contracts to introduce later

- `MetricCard`
- `LearningProgress`
- `LearningRoadmap`
- `ModuleRow`
- `LessonWorkspace`
- `LessonNavigation`
- `AIInsight`
- `FarmContextBar`
- `KpiChartCard`
- `AssessmentFocusShell`
- `QuestionNavigator`
- `CertificationTier`

## Local Asset Inventory

| Source | Evidence | Intended use |
|---|---|---|
| `D:\SA\ASSET\shadcnblocks-@Futoruu\shadcnblocks-Components` | 1,696 files across primitive/pattern categories including Card, Chart, Data Table, Progress, Sidebar, Tabs, Sheet, Empty, and Status | Primary pattern source; adapt to existing shadcn/Radix primitives. |
| `D:\SA\ASSET\shadcnblocks-@Futoruu\shadcnblocks-Blocks` | 1,575 files including Dashboard, Chart Card, Chart Group, Data Table, Sidebar, and related blocks | Layout and composition reference for dashboard, KPI, and shell work. |
| `D:\SA\ASSET\Minimal_TypeScript_v7.7.0\vite-ts` | Complete Vite TypeScript app with theme, palette, settings, auth, dashboard, charts, and data-oriented pages | Reference for analytics density, theme configuration, settings, and page composition. |
| `D:\SA\ASSET\Minimal_JavaScript_v7.7.0` | JavaScript variants of the Minimal starter/application sources | Reference only; the current repository already has its own runtime and API. |
| `D:\SA\ASSET\hero-ui\@heroui-pro\react` | HeroUI Pro React package with chart, KPI, sidebar, chat, prompt, and workspace exports | Reference for AI workspace, feedback, and premium interaction patterns. |
| `D:\SA\ASSET\hero-ui\Components` | 66 local component reference files across AI, Charts, Data Display, Feedback, Forms, Layout, Navigation, and Overlays | Candidate interaction patterns for AAPM product components. |
| `D:\SA\ASSET\front-v4.3.1\front-v4.3.1` | Bootstrap 5.2/Gulp HTML template with auth, account, analytics, and marketing pages | Visual reference for public/auth surfaces; not a React runtime source. |
| `D:\SA\ASSET\icons\Streamline-Regular` and `Streamline-Bold` | Large local SVG icon collections | Use selectively through an AAPM icon wrapper; avoid scattering raw asset paths through pages. |
| `D:\SA\ASSET\AAPM SVG Logo` and `D:\SA\ASSET\logo` | AAPM/Academy light/dark logos and icons | Official source assets; the current repo still uses a differently named legacy/conversion set and needs an asset registry before normalization. |

## Brand Asset Inventory

Masterplan v2 requires the brand audit to happen before any asset replacement.
The official source directory was inspected read-only.

### Official source assets confirmed

The eight official SVG assets from the v2 masterplan are present:

| Product identity | Light | Dark |
|---|---|---|
| AAPM corporate logo | `AAPM_Main_Logo.svg` | `AAPM_Main_Logo_for_Dark.svg` |
| AAPM corporate icon | `AAPM_Main_Icon.svg` | `AAPM_Main_Icon_For_Dark.svg` |
| Academy product logo | `Academy_Main_Logo.svg` | `Academy_Main_Logo_For_Dark.svg` |
| Academy product icon | `Academy_Main_Icon.svg` | `Academy_Main_Icon_For_Dark.svg` |

The source folder also contains `Logo_AAPM_Main.ai`, which is not part of the
eight web SVG assets and is not currently selected for web runtime use.

Source color evidence observed in the SVGs:

- AAPM green: `#318139`
- AAPM orange: `#d4451a`
- Dark variants include light neutral foreground values.

These values should become raw brand tokens first. Green must not be assumed to
mean the product `success` state.

### Current brand usage

`src/components/AppBrand.jsx` is the current source of truth for both
`AuthLayout.jsx` and `Layout.jsx`, but it points directly to:

```text
/assets/Logo_AAPM_Main.svg
```

The current component always renders the light asset. The dark asset and icon
assets are present in `public/assets`, but no theme-aware switching or semantic
brand registry is currently used by the application.

### Duplicate and legacy assets

The repository currently contains:

```text
public/assets/Logo_AAPM_Main.svg
public/assets/Logo_AAPM_Main_Dark_Mode.svg
public/assets/Icon_AAPM.svg
public/assets/Icon_AAPM_dark_mode.svg
```

These four files are not byte-identical to either the official AAPM corporate
set or the official Academy set in the source directory. They should therefore
be treated as legacy/conversion assets pending product confirmation, not
silently renamed or deleted during Phase 0.

The source folder itself also contains both corporate and Academy identities.
The Academy identity should be the primary identity for the Layer Academy app;
the corporate identity should be reserved for parent-organization or explicit
corporate attribution contexts.

### Canonical brand asset proposal

Do not move or replace assets in Phase 0. For Phase 1, use one canonical
destination and one registry:

```text
public/brand/
  aapm/
    logo.svg
    logo-dark.svg
    icon.svg
    icon-dark.svg
  academy/
    logo.svg
    logo-dark.svg
    icon.svg
    icon-dark.svg
```

The exact file copy step should be bounded and reviewed. The registry should
live in a single module such as `src/lib/brandAssets.js`, while pages should
consume `BrandMark` or `AcademyBrand` rather than raw asset paths.

### Light/dark strategy

The application already has a `.dark` CSS theme, but the brand component does
not yet resolve the official dark SVG. The intended contract is:

```text
light theme → official light SVG
dark theme  → official *_For_Dark SVG
```

Do not use CSS filters, inversion, or manual recoloring. Theme resolution
belongs in the brand component/registry layer, not in Dashboard, Lesson, KPI,
or Exam pages.

### Brand component contract

The Phase 1 candidate API is:

```jsx
<BrandMark product="academy" variant="logo" />
<BrandMark product="academy" variant="icon" />
```

The component may accept an explicit mode for deterministic testing, but normal
theme selection should remain inside the brand layer. This allows a logo
replacement or Academy visual identity V2 without changing product behavior.

## Candidate Pattern Mapping

### ShadcnBlocks → AAPM

| Source pattern | AAPM target | Decision |
|---|---|---|
| Dashboard blocks and Sidebar blocks | `AcademyShell`, `AcademySidebar`, `AcademyHeader` | Extract structure and responsive behavior; keep existing Radix primitives and route contracts. |
| Chart Card and Chart Group blocks | `MetricCard`, `KpiChartCard`, `LearningProgressSummary` | Adapt data shape and Indonesian/farm semantics; do not copy demo data. |
| Progress, Stepper, Timeline, Item, Empty, and Status components | `LearningRoadmap`, `ModuleRow`, loading/empty/locked states | Strong fit with the masterplan and current Tailwind 3 foundation. |
| Data Table, Sheet, Dialog, Tabs, and Drawer components | KPI history, weekly data entry, lesson context, assessment navigation | Reuse only the smallest pattern needed for each bounded feature. |

### Minimal UI → AAPM

Minimal provides useful ideas for theme configuration, palette hierarchy,
analytics dashboards, data tables, and settings. Its Vite starter uses React 19,
MUI 9, ApexCharts, and a large dependency surface. Therefore the application
should extract information hierarchy and token ideas, not import its MUI
runtime or replace the existing shadcn primitives.

### HeroUI → AAPM

HeroUI Pro is attractive for AI and interaction-heavy surfaces, including
chat-conversation, prompt-input, prompt-suggestion, chain-of-thought, KPI,
widget, sidebar, and chart patterns. The local package requires React 19 and
Tailwind CSS 4, while the application uses React 18 and Tailwind CSS 3. Direct
runtime installation would create a migration and design-system collision.

Use HeroUI as a visual and interaction reference, then reimplement the selected
pattern behind AAPM components using current primitives.

### Front → AAPM

Front is a Bootstrap/Gulp HTML template. It is suitable for studying auth,
marketing, account, and responsive layout composition. It should not be copied
into the React application as a second CSS framework.

## Proposed AAPM UI Architecture

```text
pages/routes
      ↓
features/*
      ↓
components/academy | farm | ai | assessment | certification
      ↓
components/layout
      ↓
components/ui
      ↓
tokens / recipes / variants
      ↓
Tailwind + CSS variables
```

### Proposed file map

```text
src/
  components/
    ui/                         # Existing shadcn/Radix primitives
    layout/
      AcademyShell.jsx
      AcademySidebar.jsx
      AcademyHeader.jsx
      ContentContainer.jsx
      PageHeader.jsx
    academy/
      LearningProgress.jsx
      LearningRoadmap.jsx
      ModuleRow.jsx
      LessonWorkspace.jsx
      LessonNavigation.jsx
    farm/
      MetricCard.jsx
      KpiChartCard.jsx
      FarmContextBar.jsx
      FarmInsight.jsx
    ai/
      FarmIntelligenceWorkspace.jsx
      AIInsight.jsx
      PromptSuggestions.jsx
    assessment/
      AssessmentFocusShell.jsx
      ExamProgress.jsx
      QuestionNavigator.jsx
      ExamSummary.jsx
    certification/
      CertificationTier.jsx
  features/                     # Optional after the first bounded patch
    dashboard/
    learning/
    farm/
    assessment/
    ai/
  lib/
    navigation.js               # Config-driven navigation
    ui-recipes.js               # Shared semantic recipes when justified
  styles/
    tokens.css                  # Domain semantic variables, if separated from index.css
```

## Template Extraction Protocol

Each adopted pattern should be recorded using the following decision record:

| Field | Required content |
|---|---|
| Source template | Exact local source family, such as ShadcnBlocks, Minimal, HeroUI, or Front |
| Source component | Exact file or component name |
| Reason selected | Product problem it solves |
| Structural idea reused | Layout, state model, interaction, or visual hierarchy |
| Code reused/reimplemented | What is copied, rewritten, or intentionally not used |
| AAPM target | Stable semantic component name |
| Visual modifications | AAPM tokens, language, farm context, responsive behavior |
| Dependency implications | Existing primitive reuse or new dependency justification |

First candidates:

1. ShadcnBlocks `dashboard1.tsx` → `AcademyShell` and dashboard composition.
2. ShadcnBlocks `chart-card` patterns → `KpiChartCard`.
3. Minimal theme/palette configuration → AAPM semantic token naming.
4. HeroUI prompt/chat patterns → `FarmIntelligenceWorkspace`.
5. ShadcnBlocks Progress/Stepper/Item patterns → `LearningRoadmap` and `ModuleRow`.

## Migration Risks

- **Runtime mismatch:** HeroUI requires React 19/Tailwind 4; Minimal introduces MUI 9 and ApexCharts. Direct installation is not a bounded UI change.
- **Duplicate primitives:** Copying template Buttons, Cards, Sidebars, or Charts would create competing APIs and increase future rebranding cost.
- **JSX/TSX conversion:** ShadcnBlocks examples are mostly TSX and need type removal or conversion before entering this JavaScript-first repository.
- **Behavior regression:** Calculator formulas, quiz scoring, certification rules, API contracts, and auth must remain untouched during UI extraction.
- **Hardcoded product facts:** Module counts, exam counts, passing grade, and certificate rules need evidence before being moved into UI components.
- **Asset licensing:** Local template licenses should be checked before shipping any third-party asset or copied code publicly. Prefer reimplementation of structure where license scope is uncertain.
- **Asset size and loading:** The large local icon collection should not be bundled wholesale; select only the icons needed by a feature.

## Proposed Phase 1 Bounded Patch

### In scope

- Add domain semantic tokens for surface, learning states, metric states, AI state, and raw/semantic brand colors while retaining existing shadcn token compatibility.
- Add a canonical brand asset registry and `BrandMark`/`AcademyBrand` contract for official light/dark Academy and corporate assets.
- Move navigation data into a configuration module without changing routes or labels.
- Extract the current shell into `AcademyShell`/`AcademySidebar` behind the existing route contract.
- Introduce one small semantic product component, preferably `MetricCard` or `PageHeader`, and use it in one bounded page.
- Add responsive and accessibility validation for the changed shell/component.

### Out of scope

- No replacement of React, Vite, Tailwind, Radix, Recharts, or the native PHP API.
- No HeroUI or MUI runtime installation.
- No wholesale template copy or broad page redesign.
- No changes to calculator formulas, quiz scoring, certification rules, auth, routing behavior, or backend contracts.
- No production deployment until the bounded patch is reviewed and validated.

### Expected files

```text
src/index.css
tailwind.config.js
src/lib/navigation.js
src/lib/brandAssets.js
src/components/Layout.jsx
src/components/BrandMark.jsx
src/components/AcademyBrand.jsx
src/components/layout/AcademyShell.jsx
src/components/layout/AcademySidebar.jsx
src/components/layout/AcademyHeader.jsx
src/components/layout/PageHeader.jsx
public/brand/aapm/*
public/brand/academy/*
```

### Validation

- `npm run lint`
- `npm run build`
- Route smoke test for `/`, `/modules`, `/calculators`, `/kpi`, `/ai-assistant`, `/certification`, and `/final-exam`.
- Mobile, tablet, desktop, loading, empty, locked, and error-state checks for the changed shell.
- Confirm no API request, auth behavior, formula, scoring rule, or route contract changed.

## Architecture Acceptance Tests

The proposed architecture should pass these tests before broad migration:

- **Brand change:** AAPM orange or primary color changes through tokens/recipes, not page-by-page edits.
- **Radius change:** Surface radius changes through tokens/recipes, not duplicated utility strings.
- **Sidebar change:** Navigation design changes in shell components and config, not every page.
- **Dashboard V2:** Dashboard composition can change without changing lesson, calculator, KPI, AI, or exam behavior.
- **Vendor independence:** Removing HeroUI or Minimal references does not remove AAPM product components.
- **Primitive replacement:** Replacing a shadcn primitive does not change the public API of semantic AAPM components.
- **Logo replacement:** Replacing an official Academy logo changes the registry/source asset, not every page.
- **Dark logo:** Switching theme selects the official dark asset without page-level branching or CSS filtering.

## Phase 0 Delivery Checklist

1. **Summary:** The current shadcn/Radix + Tailwind foundation is suitable; ShadcnBlocks is the closest implementation source, while Minimal and HeroUI remain references.
2. **Files read:** `package.json`, `vite.config.js`, `tailwind.config.js`, `jsconfig.json`, `src/App.jsx`, `src/index.css`, `src/components/Layout.jsx`, `src/components/AppBrand.jsx`, `src/components/AuthLayout.jsx`, representative page imports, native API client, local template manifests, selected ShadcnBlocks blocks/components, Minimal theme files, HeroUI package metadata, and the official AAPM SVG directory.
3. **Files changed:** Only this discovery document was created/updated. No production UI, API, asset source, or dependency was changed.
4. **Architecture decisions:** Keep shadcn/Radix canonical; place AAPM semantic components above primitives; keep vendor inspiration below the extraction boundary; add brand registry before asset normalization.
5. **Reused components identified:** Existing UI primitives, `AppBrand`, auth shell, course data hooks, auth context, protected route, and chart wrapper.
6. **New components created:** None in Phase 0. Candidate contracts are listed but intentionally not implemented.
7. **Visual behavior:** Unchanged. This phase records the current visual behavior and proposed replacement boundaries only.
8. **Responsive behavior:** Existing desktop sidebar/mobile overlay behavior was inspected; no responsive behavior was changed. Future shell work must validate mobile, tablet, desktop, and wide desktop.
9. **Validation performed:** Repository and asset inventory, source/package inspection, official-vs-current brand filename and hash comparison, candidate pattern inspection, and `git diff --check`.
10. **Known limitations:** Template licensing still needs confirmation before shipping copied code/assets; business-rule inconsistencies such as exam counts need product validation; no visual regression test suite exists yet.
11. **Next recommended phase:** Review and lock the bounded Phase 1 patch covering tokens, navigation config, shell extraction, one semantic product component, and reviewed brand registry/asset mapping.

## Recommendation

Proceed with ShadcnBlocks as the closest implementation accelerator, use Minimal
for analytics and token reference, and use HeroUI for AI interaction reference.
Keep all adopted patterns behind AAPM semantic components and the existing
shadcn/Radix primitives. Because masterplan v2 explicitly expands Phase 1 with
brand normalization, the next implementation step is the bounded Phase 1 patch
above: semantic tokens, navigation config, shell extraction, and a reviewed
brand registry using the official Academy assets. No asset replacement should
occur until that bounded patch is approved.
