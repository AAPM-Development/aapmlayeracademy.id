# Academy UI refinement verification — 10 October 2026

Repository: `D:/SA/aapmlayeracademy.id`. Branch: `develop`.
Starting HEAD: `776bd1942dc2f991fe246ead4dd5e69b43a2db62`.

This continuation preserves and completes the existing, uncommitted UI work.
It also adds the requested APPI history management and mobile bottom navigation.
The runtime used the native PHP API with the existing local SQLite database,
Vite on port 5173, and PHP on port 8000. No new checkout was created.

## Behavior

- Shared learner/admin navigation has an inset mobile panel, complete labels,
  visible active state, keyboard focus, safe-area spacing, and a Menu sheet.
  Menu marks routes outside the four direct destinations.
- APPI is available in learner/admin shells and hidden in its own workspace.
  Its position clears navigation, calculator results, and measured assessment
  and editor action bars. The mobile editor toolbar sits at the screen bottom.
  Mascots animate independently and honor reduced motion.
- Chat history shares search, sort, active/archive views, selection, rename,
  individual deletion, and delete-all confirmation across sidebar/mobile/popup.
  Delete-all includes archived and unloaded conversations. The authenticated
  command is scoped to the current account and requires CSRF plus confirmation.
  Related composer drafts are cleared only for that account.
- A module quiz shows an introduction before the learner starts it. Opening
  the route does not create an attempt. Starting resumes an active attempt.
  Server grading, checked answers, retry, and final feedback remain authoritative.
- Calculator examples/results, a cleaner KPI composition and axes, keyboard
  metric selection, and loading/error states are included. Sparse current-week
  KPI data cannot silently reuse an older value in APPI's reading.
- The shared certificate document is used for web preview, PNG, and A4 PDF.
  PDF retains a vector fallback. Public verification uses the masked public
  payload rather than inventing missing module or score values.
- Video sources include YouTube, Vimeo privacy hashes, Drive, Loom, direct files,
  and Dailymotion with a valid Player ID. Dailymotion share links open at the
  provider. Editorial MP4/WebM uploads use container/MIME validation and managed
  paths. The application cap is 300 MB; PHP/request limits must also permit it.

## Automated checks

| Check | Result |
| --- | --- |
| Full `npm test` | 243 tests: 238 passed, 0 failed, 5 skipped; 594 seconds |
| Frontend/video regression after final refinements | 39/39 passed |
| PHP syntax | 42/42 files passed |
| ESLint | Passed |
| Generated design tokens | Current |
| Typecheck | Still fails with 109 project-wide errors; not reported as passing |
| Local build and artifact parity | Passed in both Node and PHP verifiers |

The five skipped entries cover three manual browser workflow placeholders and
two MySQL concurrency checks. This session supplies bounded browser evidence
below; it does not claim a fresh MySQL or full curriculum publication proof.
An earlier full run encountered a SQLite concurrency lock. The focused case
and the final full run passed on retry; no assessment persistence code changed.

Final artifact: `e45675d853279d8e134816d746f1bad2c6f5f4369564003d61eeb3e8da106916`,
channel `local`. Build warnings remain for several chunks over 500 kB.

The delete-all API test used disposable SQLite accounts with 85 owner chats,
including archives and more than one history page. Authentication, CSRF,
confirmation, message cascading, idempotence, and another account's retained
history were verified. Video validation accepts the shipped MP4 and rejects
disguised PHP, a truncated MP4, and generic Matroska.

## Browser evidence

Headed Chromium was used with widths 375, 540, 768, 1024, and 1440 px.
Evidence remains local in `output/playwright/` and `.playwright-cli/`.

- 17 learner/admin/editor routes × five widths: 85 shell states without
  horizontal overflow, launcher/navigation collision, or JavaScript page errors.
  Mobile navigation controls were at least 44 × 44 px.
- All 22 lessons rendered at 375 px with one floating launcher and no horizontal
  overflow. The final exam introduction opened. These visits did not complete
  every assessment again.
- Quiz module 1: no attempt POST on route entry, one POST after Mulai kuis;
  checked answer resumed after refresh; failed result, retry, and passing result
  verified. Expanded feedback left 12 px clearance above the launcher.
- APPI empty and existing-conversation layouts at desktop/mobile: one composer,
  no floating launcher in the workspace, and no horizontal overflow.
- History confirmation/cancel, cancel-selection, and mobile history worked.
  A mocked delete failure kept the confirmation open; the demo's real history
  was not erased. Actual successful delete-all was proved in the disposable API test.
- All seven calculator example actions produced results; five widths were clear.
- KPI arrow/Home/End selection, light/dark appearance, and sparse-data labels
  were checked. Sparse records used a mocked response without changing farm data.
- Learner/admin Menu navigation closed the sheet and marked additional routes.
- Editor outline drawer, question bank, and quick APPI opened. At 375/540 px
  the toolbar bottom gap was zero. Launcher clearance was checked at five widths.
- Certificate preview and actual PNG/PDF downloads worked. PNG size was
  2246 × 1588. PDF parsed as one landscape A4 page. Anonymous public verification
  succeeded; an invalid link showed the not-found state.

## AI configuration and boundaries

The local admin settings API reports the private provider active, its key
configured, and model `gpt-4o-mini`. Model discovery returned 127 models.
The connection test still failed with a provider credit/quota error, surfaced
as `ai_provider_unavailable` (502). Chat completion is therefore not proved.
ChatGPT usage reset does not prove available OpenAI API credits.

No secret value is included in this report or the commit. `.env.local` and
`config.php` remain ignored and untracked. Production key configuration,
production upload limits, all external providers' playback permissions/codecs,
physical-device testing, MySQL reruns, deployment, and release are outside this proof.

The existing demo role/progress/farm data were preserved. Quiz module 1 gained
local failed/passed test attempts. Test-account deletion checks used disposable
databases; no production or other person's chat history was deleted.
