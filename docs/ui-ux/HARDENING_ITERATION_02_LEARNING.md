# Hardening Iteration 02 — Learning Experience

Status: implementation ready for staging review

This iteration hardens the existing learning experience without changing the application shell, API contract, routes, database, or business logic. It keeps the current visual composition and strengthens state behavior, progressive disclosure, responsive lesson navigation, and accessibility.

## Scope delivered

### Dashboard

- Dashboard, module, and user-progress queries now expose loading, error, retry, and empty states.
- Metric cards render skeletons while learning data is pending, avoiding a misleading initial `0` state.
- New learners see a clear first-lesson prompt inside the progress summary.
- Returning learners keep the existing hero, Continue Learning, track cards, progress summary, Up Next, and Quick Tools composition.
- Empty roadmap data produces a deliberate preparation state instead of an apparently broken dashboard.

### Learning Path

- Roadmap status semantics now include `completed`, `current`, `available`, and `locked` presentation states.
- Locked modules remain non-interactive, have no hover affordance, and explain why they are unavailable.
- Current and available modules retain keyboard-focusable links with `aria-current` support for the current step.
- Long module titles wrap to two lines and summaries remain bounded, preventing row overflow.
- Level progress bars expose `progressbar` semantics with current values.

### Lesson Workspace

- Desktop keeps the sticky Lesson Map beside the content.
- Mobile moves the Lesson Map into a right-side Sheet opened by an explicit `Buka lesson map` control.
- Lesson Map buttons expose the active location and remain keyboard accessible.
- Active section now follows scroll position through `IntersectionObserver` while preserving smooth anchor jumps.
- Video presentation supports a future `videoUrl`/`videoEmbedUrl`/`video` field, while current modules receive a compact missing-video fallback instead of a large empty player.
- Completion errors are visible both inline and through a toast; completion controls expose saving/completed semantics.
- Checklist controls use the shared primitive facade and associated labels.

## Ownership and boundaries

Learning feature files use `@/components/primitives` for shared interaction and visual primitives. Radix/shadcn implementation details remain behind the existing facade. No HeroUI runtime, new dependency, Tailwind upgrade, React upgrade, API change, route change, or database change was introduced.

Out of scope and intentionally unchanged:

- Calculator
- Farm KPI
- AI Assistant
- Certification
- Final Exam
- Native PHP APIs and query contracts
- Application shell IA and authentication flow

## Files changed for this iteration

- `src/components/academy/DashboardComponents.jsx`
- `src/components/academy/LearningRoadmap.jsx`
- `src/components/academy/LessonWorkspace.jsx`
- `src/components/academy/LearningStates.jsx`
- `src/components/layout/LearningFocusShell.jsx`
- `src/components/primitives/index.js`
- `src/lib/academyData.js`
- `src/pages/Home.jsx`
- `src/pages/Modules.jsx`
- `src/pages/ModuleDetail.jsx`

## Validation

- `npm run lint` — passed.
- `npm run build` — passed.
- `git diff --check` — passed; Git only reports expected working-tree line-ending notices.
- `npm run typecheck` — remains blocked by the repository's pre-existing JavaScript/Radix typing baseline. No new typecheck errors remain in the Iteration 02 files; existing errors remain in legacy `components/ui`, auth/query hooks, calculators, KPI, AI, and registration/password files.

## Staging acceptance checklist

After deployment, review the following routes in light and dark mode:

- `/`
- `/modules`
- `/modules/2`

Check desktop, tablet, and mobile behavior, specifically:

- no horizontal overflow;
- dashboard does not flash misleading metrics while loading;
- locked roadmap rows do not look clickable;
- current module focus is visible;
- mobile lesson map opens and closes as a drawer;
- lesson navigation remains usable at narrow widths;
- missing-video fallback stays compact and readable;
- dark mode preserves text and border contrast;
- keyboard focus is visible on links, buttons, map items, and checklist controls.

Iteration 03 remains deferred until this staging review is accepted.
