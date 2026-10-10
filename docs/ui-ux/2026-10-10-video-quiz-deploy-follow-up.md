# Video, quiz access and cPanel follow-up — 2026-10-10

Repository: `aapmlayeracademy.id`, branch `develop`, starting HEAD
`66c8d42a0360545e725a7f10d8e03e96ba79ac1b`. Existing untracked `output/`
and the owner's local account/progress were preserved. No database reseed,
production deployment, branch promotion or private configuration change occurred.

## Changes and rendered evidence

- Constrain the lesson player's viewport to the lesson width. At 320px the
  previous 200px minimum height and 16:9 aspect ratio widened YouTube beyond the
  lesson column. The corrected viewport stays within its 278px column.
- Keep a labelled quiz action available in the footer and end-of-lesson card
  after a module is complete. On small screens the footer reads “Kuis” and
  “Lanjut”; accessible names retain the module context.
- The local published catalogue still has quiz questions for all 22 modules.
  Module 1, 15 and 22 retry links open the introduction at 320, 375, 768 and
  1440px without overlapping controls or creating an assessment attempt.
- Real YouTube playback, pause, seek, mute and fullscreen passed at 320, 375,
  768 and 1440px. Real uploaded MP4 and WebM passed those controls at 320, 375,
  1440px and 812px landscape. This is Chromium viewport evidence, not physical
  iOS/Safari evidence.
- A 29,691,477-byte MP4 uploaded successfully through the authenticated local
  frontend after setting PHP's upload/post limits to 300M/310M. Disguised PHP
  was rejected with 422; anonymous upload with 401; missing CSRF with 419.
  The task-owned uploaded media were removed after checking exact paths/sizes.
- Retry after a failed native video request recovered playback. WebM end/replay
  was exercised. All 21 legacy YouTube links returned oEmbed metadata; this is
  not full playback verification of every link. Other provider URL parsing is
  covered by focused tests; live playback of owner files on those providers
  was not exercised.
- Uploaded/direct video supports Academy controls. YouTube controls are hidden
  using its supported API; its remaining branding, advertisements and related
  video behavior cannot be removed wholesale. Uploaded media remain public
  static URLs, and uploads are not transcoded.

## Dependencies

Removed unused `react-quill-new` and its Quill dependency. Overrode KaTeX to
0.18.2 and PostCSS selector parser to 7.1.6. Mermaid uses the external KaTeX
dependency through its `mermaid.core` entry, so the override reaches the shipped
renderer. A browser check rendered the actual APPI Mermaid component with an
FCR fraction in light and dark themes. That check also found stale Ten4Seven
colour tokens and an invalid fallback colour; the component now reads Academy
semantic/chart tokens and formats HSL channels correctly.

`npm audit` fell from 11 package findings to 5 High findings, all caused by
`braces` and its Tailwind tooling dependency chain. There is no patched braces
version for GHSA-vfj7-8cjw-p6xm at the time of this check. The High finding remains
unresolved; no forced Tailwind major migration or alert suppression was applied.

## cPanel diagnosis

The checked branch is `develop` at `66c8d42`, so “Update from Remote: up-to-date”
was correct before the new follow-up commits were pushed. The 08:52 deployment
log `/home/aapp8359/.cpanel/logs/vc_1791597124.50957_git_deploy.log` records:

```text
DEPLOY ABORTED: private config file not found
Task completed with exit code 2.
Build completed with exit code 2
```

Only the legacy `aapmlayeracademy-config.php` filename was observed in the
account home directory; its contents were not opened. The branch mapping
requires `/home/aapp8359/aapmlayeracademy-staging-config.php` and a dedicated
staging database. The repository name containing “prod” does not change this
mapping. `main` has a separate production configuration and target.

Reloading the cPanel repository page removed the stale “in progress” notice.
The last successful deployed SHA remained `e9646b88dab366516661cbc8843b8063ee346fc5`.
No deployment was triggered. The missing private staging configuration must
still be provisioned on the server before deployment can succeed.

The former tracked artifact had channel `local`; it would also be rejected by
the staging channel check. The final follow-up regenerates `dist/` with
`npm run build:staging`, preserving the existing deployment gates.

## Validation

- Staging build succeeds. Node and PHP verify the same artifact:
  `d03cb4bb9a257c155edc9d876e661b095343402a71004fd1ccf61e67d49c3187`.
- Browser preview uses the built `/assets/` files and the local native API
  proxy. Quiz access and introduction passed at 375 and 1440px with no page
  errors or horizontal overflow.
- Git index verification hashes 260 source files and 215 payload files under
  the release contract's LF-normalisation rule. Both match the manifest, so
  this proof also covers the bytes staged for the cPanel checkout.
- Focused frontend/video tests: 39 passed, 0 failed.
- Full suite: 237 passed, 5 explicit skips and 1 failed because its disposable
  PHP server did not start. The isolated rerun of that course-lifecycle test
  passed (1/1) in about six seconds. The original full run is not reported as
  completely passing. Its five skips remain separate from runtime proof.
- ESLint, token generation parity and PHP lint (42 files) passed.
- Global typecheck retains 109 diagnostics; neither changed JSX file has a
  diagnostic. Global typecheck is not passing.
- Local screenshots and detailed video notes are under `output/playwright/`;
  these are local evidence, not deployed or tracked application assets.
