# APPI chat scrolling — 2026-10-10

Repository: `aapmlayeracademy.id`, branch `develop`, starting HEAD
`12cfd1cd5c45d2165ccb349ee33678ce987d7035`. Existing untracked `output/`,
including the manual cPanel setup packet, was preserved.

## Root causes and changes

- The workspace passed `overflow-hidden` into the native `ScrollArea`.
  Tailwind class merging removed its default vertical scrolling. Before the
  fix, the browser reported `overflowY: hidden`; a wheel gesture left
  `scrollTop` at 414 despite 1,090px of content in a 676px viewport.
  The transcript now explicitly uses `overflow-x-hidden overflow-y-auto`.
- The floating chat mounts its transcript after the scroll hook's initial
  effects. An object ref did not trigger listener/observer registration when
  the panel appeared. Before the fix, it opened at the beginning and showed
  no jump button after scrolling up. A callback ref now registers the actual
  scrollport and rebinds effects after each open/close cycle.

## Rendered verification

Checked both Vite development and the rebuilt staging artifact through Vite
preview on port 5174. An isolated Chromium session used 40 synthetic histories
and 24 messages. API responses were browser fixtures, with no database writes
or OpenAI requests.

| Surface / interaction | Result |
| --- | --- |
| Workspace, 1440×900 wheel | 4188 → 3838; jump returns to bottom |
| Workspace, 375×812 wheel | 7649 → 7299; jump returns to bottom |
| Workspace, 812×375 landscape wheel | 4772 → 4422; composer remains visible |
| Workspace, emulated touch swipe at 375×812 | 7649 → 7544 |
| Floating panel, desktop and phone | Opens at latest; wheel and jump work |
| Floating panel, close/reopen | Wheel and jump remain bound on both widths |
| History, desktop and phone sheet | Independent scrolling, 0 → 450 |
| Content grows while reading older messages | Reading position stays fixed |
| Content grows while at latest | Continues following the bottom |
| New empty chat | Opens at top with no stale jump button |

Fresh preview navigation and interaction produced no page errors. Screenshots
and runnable Playwright CLI checks remain under `output/playwright/appi-scroll-*`.
Touch was emulated in Chromium; physical iOS/Android devices were not tested.

## Checks and release boundary

- `npm run lint`: PASS.
- Focused frontend/video suite: 39 PASS, 0 fail, 0 skip.
- `npm run build:staging`: PASS, with existing chunk-size/mixed-import warnings.
- `npm run verify:dist` and `npm run verify:artifact-php`: PASS.
- Artifact: `947521fb5bc83f7caf6a0ca038956b7106347f1501800eb46d134f0b2d32d766`.
- Global typecheck still reports 109 diagnostics, matching the previously
  recorded count. No diagnostic references `useChatScrollFollow.js`; the
  workspace's three diagnostics concern unchanged composer/copy props.
- Full backend/MySQL suite was not rerun for these frontend changes.
- No production/staging server deployment, private config, database, main
  promotion, or credential change was performed.
