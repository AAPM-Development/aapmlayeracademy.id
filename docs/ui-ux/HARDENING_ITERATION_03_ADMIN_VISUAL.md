# Hardening Iteration 03 — Visual System and Admin Workspace

## Scope

This iteration adds a bounded visual surface system, refines the learner card language, and introduces a protected `/admin` workspace. It does not change the public course flow, learner progress writes, course schema, or production `main`.

## Visual system

The UI remains Inter-first (with Helvetica-compatible system fallbacks) and defaults to light mode. Generic gradients are removed from cards and small UI controls. The only retained gradients are intentional hero/media treatments.

`Surface` is the product primitive for semantic containers:

| Variant | Use |
| --- | --- |
| `default` | Primary information surface |
| `muted` | Grouping, supporting content, or unavailable state |
| `accent` | Short semantic highlight |
| `inverse` | High-contrast, intentional callout |
| `interactive` | Clickable container |
| `selected` | Current selection |

Semantic tone is intentionally limited to green, orange, blue, violet, and slate. It supplies a flat tinted background and clear border rather than a broad multi-stop gradient. Dashboard metric and learning-track cards use these surfaces; the sidebar learning-progress card now has a single green surface.

## Icon contract

`src/components/icons/AapmIcon.jsx` is the canonical semantic icon registry. It uses the Minimal UI Iconify family: **Solar**, prioritising `bold-duotone` entries where the family supplies them.

| Product name | Iconify icon |
| --- | --- |
| dashboard | `solar:home-angle-bold-duotone` |
| course | `solar:notebook-bold-duotone` |
| modules | `solar:notes-bold-duotone` |
| assessment | `solar:file-text-bold` |
| users | `solar:users-group-rounded-bold-duotone` |
| analytics | `solar:chart-square-outline` |
| certificate | `solar:verified-check-bold` |
| media | `solar:gallery-wide-bold` |

Feature code imports `Icon` from `@/components/primitives`, never the Iconify provider directly. This keeps future family or asset changes localized to one registry.

## Admin access contract

The application exposes only two roles to the browser/API:

- `learner`
- `admin`

Existing database users with the legacy `user` value are presented as `learner`; no user record needs migration. An administrator is recognized when either:

1. `users.role` is `admin`, or
2. the email is listed in private `admin_emails` / `AAPLAYERACADEMY_ADMIN_EMAILS` configuration.

The second option is a controlled bootstrap mechanism. Never commit an admin email or a credential to the repository. In cPanel, put the selected account email in `/home/aapp8359/aapmlayeracademy-config.php`, for example:

```php
'admin_emails' => 'owner@example.com',
```

or promote a deliberate existing account in the database:

```sql
UPDATE users SET role = 'admin' WHERE email = 'owner@example.com';
```

`AdminRoute` rejects learner access to `/admin` before the admin shell renders. PHP independently calls `require_admin()` for every `/api/admin/*` endpoint, returning `403 admin_required` for a valid learner session. UI hiding is therefore not the security boundary.

## Admin V1 data contract

| Route | Native source | Action availability |
| --- | --- | --- |
| `/admin` | `users`, `user_progress`, `course_modules` | Read-only overview |
| `/admin/courses` | `course_modules` catalog | Read-only list/detail |
| `/admin/courses/layer-farm-management` | grouped native modules | General/curriculum; publish and reorder explicitly unavailable |
| `/admin/learners` | `users` joined with progress/certificates | Search and read-only list |
| `/admin/learners/:id` | one user, progress, certificates | Read-only profile/history |

There is no course table or enrollment table in the current native API. The one current course is transparently represented as the existing Layer Poultry Farm Management module catalog. No placeholder chart, count, publish control, or editable course data is invented.

## Validation checklist

- Learner dashboard cards use flat semantic surfaces with clear outlines.
- `/admin` is inaccessible to a learner in the client and `/api/admin/overview` returns 403 for the same session.
- An explicitly promoted admin can view overview, course, and learner data from the live database.
- No `main` deployment is performed as part of this iteration; only `develop` is eligible for staging deployment.
