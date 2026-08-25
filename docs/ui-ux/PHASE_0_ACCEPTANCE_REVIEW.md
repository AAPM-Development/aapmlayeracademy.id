# AAPM Layer Academy — Phase 0 Acceptance Review

**Status:** ACCEPTED WITH REVISION
**Date:** 2026-08-24
**Evidence reviewed:** `docs/ui-ux/UI_ARCHITECTURE_DISCOVERY.md`
**Masterplan reference:** `D:\Download\AAPM_Layer_Academy_UI_UX_Modular_Masterplan_v2.md`

## Review Boundary

The user request for this gate was to review the repository evidence before
allowing Phase 1. The v2 masterplan was treated as architecture guidance and
acceptance criteria, not as permission to redesign pages, upgrade the stack,
or deploy changes.

Phase 0 remains read-only with respect to production UI, API, assets, and
dependencies. This review adds documentation only.

## Gate Results

| Gate | Result | Evidence and decision |
|---|---|---|
| Foundation compatibility | ACCEPTED | The repo already has React 18, Vite, Tailwind 3, shadcn-style primitives, Radix UI, CVA, Lucide, Recharts, and CSS variables. This is sufficient for the canonical primitive layer. |
| Tailwind strategy | ACCEPTED | No hidden requirement was found to move from Tailwind 3 to 4. HeroUI and newer template assumptions stay outside the runtime. |
| Component boundary | ACCEPTED WITH REVISION | `components/ui` is a real existing boundary. Semantic folders such as `academy`, `farm`, and `ai` do not need to be created in Phase 1A; they can be introduced when the first product component is actually extracted. |
| Brand normalization | ACCEPTED WITH REVISION | `AppBrand` already centralizes brand rendering for auth and the shell. Keep it as the canonical component and add a registry behind it; do not create a parallel `BrandMark` abstraction unless a later requirement proves it necessary. |
| Migration sequence | ACCEPTED | A split sequence is safer: Phase 1A foundation/brand, Phase 1B primitive normalization, Phase 1C layout foundation. |
| Bounded scope | ACCEPTED WITH REVISION | Phase 1A is reduced to tokens and brand foundation. Navigation, shell extraction, page redesign, and product components are deferred. |

## Architecture Findings

1. Existing shadcn/Radix primitives should remain canonical. ShadcnBlocks can
   provide source patterns, but its code should be adapted rather than imported
   as a foreign subsystem.
2. Minimal UI and HeroUI are reference sources only. Their React/MUI/Tailwind
   assumptions do not justify a runtime migration.
3. `src/components/AppBrand.jsx` is already the correct seam for brand
   normalization because both `AuthLayout.jsx` and `Layout.jsx` consume it.
4. The current `AppBrand` points directly to `/assets/Logo_AAPM_Main.svg`, always
   uses the light asset, and has no corporate-vs-Academy product selection.
5. The official source directory contains separate AAPM corporate and Academy
   light/dark logo/icon pairs. The Layer Academy product should use the Academy
   pair by default; corporate assets remain available for explicit parent-brand
   contexts.
6. The four existing files under `public/assets` are not byte-identical to
   either official source family. They must be treated as legacy/conversion
   assets until the registry is introduced; they must not be deleted silently.
7. The current `.dark` CSS token strategy exists, but no brand asset resolution
   is connected to it. Official dark SVGs should be selected by the brand layer,
   never by CSS filters or page-level conditionals.

## Issues and Risks

- Official source filenames and existing public filenames differ; asset copying
  must be explicit and reviewable.
- The product/corporate identity distinction must remain clear when adding a
  registry.
- The current application does not expose a complete theme-switching contract;
  Phase 1A can establish the brand API and deterministic mode support without
  introducing a full theme settings feature.
- A broad semantic token replacement could affect pages unexpectedly. New
  tokens should be additive first; existing aliases should remain compatible.
- No Phase 1 work should touch calculator formulas, quiz/final-exam scoring,
  certification rules, KPI calculations, AI backend contracts, auth, routes, or
  the PHP API.

## Decisions to Lock

- Keep React 18, Vite, Tailwind 3, shadcn/Radix, Recharts, and the native API.
- Keep `src/components/ui` as the canonical primitive layer.
- Use ShadcnBlocks for pattern extraction, not as a runtime dependency.
- Use `AppBrand` as the canonical brand component for now.
- Add a single brand registry behind `AppBrand`.
- Use official Academy assets as the default Layer Academy identity.
- Preserve official AAPM corporate assets for explicit corporate contexts.
- Use official light/dark SVG pairs; no inversion, filtering, or manual recoloring.
- Split implementation into Phase 1A, 1B, and 1C.
- Do not commit or deploy Phase 1 until its bounded patch is implemented and
  validated.

## Decisions to Defer

- Whether to create a separately named `BrandMark` component.
- Full theme-provider/settings behavior and user-facing theme controls.
- Creation of `components/academy`, `components/farm`, `components/ai`, and
  other semantic folders beyond the first concrete extraction.
- Navigation configuration and shell extraction.
- Dashboard, learning, calculator, KPI, AI, certification, and exam redesign.
- Any React, Tailwind, MUI, HeroUI, chart, or CSS framework migration.

## Phase 1A Exact Scope — Foundation + Brand

### In scope

- Add additive semantic tokens for raw AAPM brand colors and the first product
  states needed by the design system.
- Add a canonical registry module for AAPM corporate and Academy logo/icon
  light/dark paths.
- Add the eight official SVG assets under one reviewed canonical destination,
  preserving the original SVG content.
- Normalize `AppBrand.jsx` to read from the registry while preserving its
  current default call sites and rendered role.
- Support deterministic light/dark asset selection at the brand component
  boundary without adding page-level branching.
- Validate that auth and shell still render the brand correctly.

### Out of scope

- Dashboard, sidebar, modules, lesson, KPI, AI, certification, or exam redesign.
- Navigation config or route changes.
- New product components beyond the brand abstraction.
- Replacing or deleting the current legacy assets without explicit mapping.
- React/Tailwind upgrades or new UI frameworks.
- API, auth, course logic, calculator formulas, KPI logic, assessment rules, or
  AI orchestration changes.
- Production deployment.

### Files allowed to change

```text
src/index.css
tailwind.config.js
src/lib/brandAssets.js                  # new registry
src/components/AppBrand.jsx             # preserve public component role
public/brand/aapm/*                     # official corporate pairs
public/brand/academy/*                  # official Academy pairs
```

### Files explicitly out of scope

```text
src/App.jsx
src/components/Layout.jsx
src/components/AuthLayout.jsx
src/pages/*
src/api/*
public/api/*
database/*
package.json
package-lock.json
vite.config.js
```

## Phase 1A Acceptance Criteria

- Existing auth and protected shell routes render without route or API changes.
- `AppBrand` remains the only page-facing brand abstraction.
- Default Layer Academy rendering resolves to the official Academy light asset.
- Dark mode/deterministic dark mode resolves to the official Academy dark asset.
- Corporate AAPM assets are addressable only through an explicit registry
  product selection.
- No raw brand path is added to a page or feature component.
- Existing legacy files remain preserved until a later migration decision.
- `npm run lint` passes.
- `npm run build` passes.
- `git diff --check` passes.
- No production deployment occurs in Phase 1A.

## Codex Execution Handoff

Implement only the Phase 1A scope above after explicit approval of this gate.
Start by creating the registry and canonical asset destinations, then make
`AppBrand` backward-compatible. Keep the patch additive and reversible. Report
files changed, brand mapping, responsive/visual behavior, validation results,
known limitations, and the recommended Phase 1B scope.

## Review Conclusion

**ACCEPTED WITH REVISION.** The repository supports the proposed direction, but
the first implementation must be smaller than the original Phase 1 proposal.
The correct next patch is foundation and brand only, with `AppBrand` normalized
behind a registry. No page redesign or layout migration is authorized by this
review artifact.
