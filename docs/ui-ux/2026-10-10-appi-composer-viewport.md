# APPI composer viewport and outer scrolling — 2026-10-10

Repository: `aapmlayeracademy.id`, branch `develop`, starting HEAD
`b18a7057ae039ade59733c8090c971b50904a51e`. Existing untracked `output/`,
including the cPanel operator setup packet, remains preserved.

## Defect and change

The previous scroll correction covered the transcript but missed the shell's
outer scrollport. The shell retained launcher clearance (88px desktop, 144px
mobile), although the launcher is absent in the APPI workspace. Independent
viewport-height calculations then created excess content below the composer.

The Academy shell now selects a contained chat layout on `/ai-assistant`.
Its main region has no launcher/page padding, and the workspace flexes into
the space remaining below the actual topbar. The canvas reserves the mobile
navigation height and safe area once. Removed the old viewport subtractions
and desktop minimum height, allowing short windows to fit the same layout.
The shell uses the dynamic viewport height on this route.

Other learner routes retain their normal scrolling and launcher clearance.
The transcript, chat history, textarea and floating panel retain their own
appropriate scrolling; this change removes the extra outer page scroll.

## Rendered evidence

Isolated Chromium used browser fixtures with 40 histories and 24 messages.
No database writes, credentials, real AI requests or server deployments were
involved. Both Vite development and the staging artifact preview were checked.

| Viewport | Outer shell overflow before | After | Composer ends at |
| --- | ---: | ---: | --- |
| 1440×900 | 75px | 0px | Viewport bottom, y=900 |
| 375×812 | 72px | 0px | Bottom nav top, y=740 |
| 812×375 | 72px | 0px | Bottom nav top, y=303 |
| 1024×768 | 75px | 0px | Viewport bottom, y=768 |

The complete layout check covered 320×568, 375×812, 375×480, 540×720,
768×1024, 812×375, 859×700, 860×700, 1024×768, 1440×900 and 1440×460.
Every size had zero outer/document/horizontal overflow and no gap or overlap
between the composer dock and its expected bottom boundary. Wheel gestures
over the composer did not displace the shell. Transcript scrolling and the
jump-to-latest control remained functional at every size.

Empty chats passed at phone, landscape and desktop sizes. Client navigation
to Calculators restored normal page scrolling and 88px launcher clearance;
navigation back to APPI restored the contained layout. Floating chat open,
close/reopen, jump controls, emulated touch scrolling and independent mobile/
desktop history scrolling passed. Fresh preview checks had no page errors.

Screenshots and Playwright CLI checks are in `output/playwright/appi-layout-*`.
The 375×480 case is a resized viewport, not a physical keyboard test. Physical
devices, iOS Safari and nonzero hardware safe-area insets were not tested.

## Verification

- Lint, token parity and 39 focused frontend/video tests: PASS.
- Staging build and Node/PHP artifact verification: PASS, with existing
  mixed-import/chunk-size warnings.
- Artifact: `e8702e595c7c7ed9a8368b11c2edda2435ac553a585307e29e263d63f0018f33`.
- Typecheck retains 109 existing diagnostics. No AcademyShell diagnostic;
  the three workspace diagnostics concern unchanged copy/composer props.
- Full backend/MySQL suite was not rerun for this layout-only change.
- No main promotion, cPanel deployment, database or private config change.
