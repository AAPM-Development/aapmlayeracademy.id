# Hardening 01 — Primitive Facade + Application Shell

## Decision

Product code imports interactive and structural primitives through:

```text
@/components/primitives
```

The facade is the only product-facing boundary. The existing `components/ui`
files remain the implementation layer and may contain Radix imports.

HeroUI is used as a visual and interaction reference only in this iteration.
No HeroUI runtime package or Tailwind 4 migration is introduced; the locked
React 18 + Tailwind 3 stack remains unchanged.

## Ownership

| Area | AAPM owner |
| --- | --- |
| Button, Input, Select, Checkbox, Switch | local AAPM wrappers backed by existing shadcn/Radix primitives |
| Badge, Progress, Skeleton, IconTile | local AAPM visual primitives |
| Dialog, Sheet, Popover, Dropdown, Command | shadcn/Radix |
| Tabs, Accordion, ScrollArea, Table | shadcn/Radix/shadcn |

Feature code must not import `@radix-ui/*` or a future vendor package
directly. A future implementation swap happens behind this facade.

## Shell behavior

- Desktop (`lg+`): the sidebar owns the collapse control.
- Tablet/mobile (`<lg`): the header owns the navigation drawer trigger.
- The desktop header does not expose a second collapse affordance.
- Brand rendering continues through `AppBrand` and the canonical registry.

## Scope boundary

This iteration hardens the primitive boundary and shell behavior only. Page
content for Dashboard, Learning Path, Lesson, Calculator, KPI, AI,
Certification, Quiz, and Final Exam is intentionally preserved for the next
vertical iterations.
