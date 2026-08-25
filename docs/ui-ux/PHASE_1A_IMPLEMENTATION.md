# AAPM Layer Academy — Phase 1A Implementation Evidence

**Status:** Implemented and locally validated; no commit or deployment performed

**Authority:** Phase 1A — Design Foundation / Brand Foundation

**Repository:** `D:\SA\aapmlayeracademy.id`

## Summary

Phase 1A was kept to the authorized foundation boundary:

- semantic design tokens were added without remapping existing page colors;
- official AAPM and Academy SVGs were placed behind a canonical registry;
- `AppBrand` was normalized behind that registry and remains the canonical shared brand abstraction;
- light/dark asset selection now supports an explicit `mode` or the existing `.dark` class convention;
- no page, shell, route, API, authentication behavior, dependency, or deployment change was made.

The macro-phase proposal remains a roadmap input. It was not used to widen this patch into shell/nav or page redesign work, which is explicitly outside the Phase 1A authority.

## Files read before editing

- `docs/ui-ux/UI_ARCHITECTURE_DISCOVERY.md`
- `docs/ui-ux/PHASE_0_ACCEPTANCE_REVIEW.md`
- `src/components/AppBrand.jsx`
- `src/components/Layout.jsx`
- `src/components/AuthLayout.jsx`
- `src/index.css`
- `tailwind.config.js`
- `package.json`
- official assets in `D:\SA\ASSET\AAPM SVG Logo`

## Files changed

Source/config:

- `src/index.css`
- `tailwind.config.js`
- `src/lib/brandAssets.js`
- `src/components/AppBrand.jsx`

Canonical assets:

- `public/brand/aapm/logo.svg`
- `public/brand/aapm/logo-dark.svg`
- `public/brand/aapm/icon.svg`
- `public/brand/aapm/icon-dark.svg`
- `public/brand/academy/logo.svg`
- `public/brand/academy/logo-dark.svg`
- `public/brand/academy/icon.svg`
- `public/brand/academy/icon-dark.svg`

Evidence:

- `docs/ui-ux/PHASE_1A_IMPLEMENTATION.md`

The existing user-owned `public/assets/Video-Web_3.mp4` was not touched or staged. Existing legacy logo files under `public/assets` were also retained.

## Token architecture

Raw brand values are kept separate from semantic roles:

- `--brand-aapm-green: #318139`
- `--brand-aapm-orange: #d4451a`
- `--brand-foreground: #333333`
- `--brand-foreground-muted: #cccccc`

The semantic foundation is available in both `:root` and `.dark`:

- `background`, `foreground` remain the existing shadcn-compatible tokens;
- `surface`, `surface-subtle`, `surface-elevated`;
- `success`, `warning`, `danger`, `info`;
- `ai` and `ai-foreground`;
- `learning-active`, `learning-complete`, `learning-locked`;
- `metric-positive`, `metric-negative`, `metric-neutral`.

Tailwind maps these to `brand-*`, `surface-*`, `success`, `warning`, `danger`, `info`, `ai-*`, `learning-*`, and `metric-*` utilities. Existing generic `primary`, `secondary`, and component mappings were intentionally left unchanged so Phase 1A does not create an implicit page redesign. The new semantic tokens are ready for later bounded primitive normalization.

## Brand registry architecture

`src/lib/brandAssets.js` exports `brandAssets`, `resolveBrandAsset`, `DEFAULT_BRAND_PRODUCT`, and `DEFAULT_BRAND_VARIANT`.

The registry is product-first and mode-aware:

```text
brandAssets.academy.logo.light  -> /brand/academy/logo.svg
brandAssets.academy.logo.dark   -> /brand/academy/logo-dark.svg
brandAssets.academy.icon.light  -> /brand/academy/icon.svg
brandAssets.academy.icon.dark   -> /brand/academy/icon-dark.svg

brandAssets.aapm.logo.light     -> /brand/aapm/logo.svg
brandAssets.aapm.logo.dark      -> /brand/aapm/logo-dark.svg
brandAssets.aapm.icon.light     -> /brand/aapm/icon.svg
brandAssets.aapm.icon.dark      -> /brand/aapm/icon-dark.svg
```

The resolver falls back safely to the default Academy logo and light mode for unsupported values. The public paths correspond directly to the canonical files under `public/brand`.

## AppBrand normalization

`AppBrand` remains the only shared brand component. Its existing call shape remains valid:

```jsx
<AppBrand className="..." />
```

The default is now the Academy logo. Optional props are:

- `product="academy" | "aapm"`;
- `variant="logo" | "icon"`;
- `mode="light" | "dark"`;
- `alt`.

When `mode` is omitted, `AppBrand` observes the root `.dark` class and selects the matching official asset. No new theme provider or runtime dependency was introduced. The current callers in `Layout` and `AuthLayout` remain unchanged.

## Official asset mapping

All eight canonical files were copied from the approved source directory without recoloring, filtering, inversion, or SVG content changes. SHA-256 checks returned `True` for every source-to-destination pair.

The legacy files remain available for rollback. No delete or broad cleanup was required because the source search found no remaining direct legacy logo references in `src` after `AppBrand` was routed through the registry.

## Validation

- `npm run lint` — passed.
- `npm run build -- --outDir .phase1a-dist` — passed; the temporary output included all eight canonical brand paths and was removed afterward.
- `npm run typecheck` — existing repository baseline remains failing with 56 errors across legacy JS inference and page/component contracts. The new `AppBrand` optional props introduced no remaining typecheck error.
- `git diff --check` — passed.
- registry resolver smoke check — passed; eight asset entries resolved, including Academy light logo, Academy dark logo/icon, and AAPM light logo.
- official asset SHA-256 parity — passed for all eight files.
- AppBrand caller check — passed for the unchanged callers in `Layout` and `AuthLayout`.
- route/page/API/dependency diff check — no files in those areas were changed.

The build emitted existing non-blocking warnings about stale Browserslist data and a large JavaScript chunk; neither is related to this Phase 1A patch.

## Limitations and deferred cleanup

- Phase 1A does not add a theme switcher. It only makes brand resolution respond to an existing `.dark` class or explicit `mode`.
- Legacy logo files remain in `public/assets` for rollback safety.
- Existing page-level color usage was not migrated to the new semantic tokens.
- Typecheck cleanup remains a separate repository-wide task and is not included in Phase 1A.

## Phase 1B recommendation

After review, Phase 1B can be separately authorized as a bounded shared-primitive normalization pass: consume the new semantic tokens in selected existing `src/components/ui` primitives and verify visual compatibility. Page redesign, shell/nav changes, and business/API work should remain separate phases.
