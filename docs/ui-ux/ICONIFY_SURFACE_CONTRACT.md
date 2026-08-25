# Iconify Surface Contract

The product-facing icon language is the Solar family from Iconify, accessed
only through `src/components/icons/AapmIcon.jsx`.

## Covered application surfaces

- Public/authentication: login, registration, password reset, and form fields.
- Learner: Academy header, sidebar, dashboard, learning path, lesson workspace,
  calculators, and AI assistant.
- Admin: access state, shell, navigation, overview, course, and learner views.

Use semantic keys such as `course`, `users`, `progress`, and `arrowRight`
where they exist in the registry. A direct Iconify name is reserved for a
meaningful domain-specific icon that has no reusable semantic key.

## Intentional exception

The vendored shadcn/Radix primitives under `src/components/ui/` keep their
own internal Lucide utility icons. They are implementation details of those
primitives, not the visible product icon language; replacing them would make
upstream maintenance needlessly fragile.
