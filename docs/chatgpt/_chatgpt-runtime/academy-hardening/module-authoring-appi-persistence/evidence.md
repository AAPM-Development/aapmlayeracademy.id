# AAPM Academy authoring and APPI persistence hardening

Date: 2026-09-06 (Asia/Jakarta)

## Scope and boundary

- The attached handoff was treated as implementation and verification context. Its earlier staging-only boundary was superseded for this turn by the direct user request to harden the editor, verify the result, merge the tested result into `main`, and deploy the production domain.
- Repository: `D:\SA\aapmlayeracademy.id`.
- Baseline for the earlier APPI/authoring handoff: `develop` at `bc68df4ba724128171a4a9c25f543815237b8102`.
- Runtime promotion commit: `61801c37e82c1d7664c2aa7c751a899bc14fd70b`, containing the focused editor hardening commits `9c2b7dac79e5fd2c8` and `27c18388abc3033ec1173e6fe20ea6accf71018a`. The production/evidence synchronization commit deployed afterward is `2fdd1b64a8718075468a8c1741656ab7d1b5fa26`.
- Deployment target: cPanel repository `/home/aapp8359/repositories/aapmlayeracademy-staging`, checked-out branch `develop`.
- Production promotion is a separate, explicitly authorized step after the staging UAT below. The production cPanel repository path and checked-out branch must be verified from cPanel before deployment; no path is inferred from the staging repository name.
- No database schema recreation, seed, truncate, delete, or direct SQL write was performed. The only staging data changes were the explicitly scoped additive UAT fixtures described below.

## Root-cause evidence

### Module authoring

The existing editorial canvas persisted block data but the H1/H2/H3 controls were toggle-style actions without a stable active selection. Clicking a style control could therefore act on the newly focused paragraph rather than the text block the author intended to change. The editor also lacked a complete same-document navigation/history guard around dirty module editing.

The earlier handoff also identified the missing rich Tiptap/ProseMirror authoring surface, shared URL safety policy for editorial links/media, and browser draft/navigation guard around module editing; those items remain covered by the implementation below.

### APPI history

The frontend initialized a blank active conversation instead of restoring the account-scoped persisted conversation, and assistant persistence was not represented as a first-class failure state. The backend stream path also needed explicit transaction boundaries: user message persistence before AI work, assistant message plus metadata after AI completion, and reconciliation when the latter fails.

## Implemented

- Added Tiptap rich-text authoring to `EditorialComposer` while retaining block-based `content`, `editorialContent`, and legacy Markdown fallback compatibility.
- Added toolbar actions for Bold, Italic, Underline, Strike, Paragraph, Heading 1/2/3, bullet/ordered lists, blockquote, link/unlink, undo, and redo, with Academy primitives, `AapmIcon`, keyboard shortcuts, safe paste, and safe HTTPS/internal URL validation.
- Replaced ambiguous H1/H2/H3 toggle buttons with one natural block-style selector (`Paragraf`, `Judul 1`, `Judul 2`, `Judul 3`). The current Tiptap selection is preserved while the menu opens, and the command deterministically changes the active block with `setParagraph()` or `setHeading({ level })`; the selector label follows the caret between blocks.
- Made toolbar controls non-submitting buttons and prevented toolbar pointer/click defaults from moving the active selection or creating an unintended line.
- Added rich-text document and paste sanitization. Unsupported nodes/marks and unsafe links are removed before publication; code blocks, raw HTML, scripts, iframes, event handlers, and unsafe URL schemes are not published.
- Added dirty state, `beforeunload` protection, same-document route and browser-history guards, account/course/module/new-conversation scoped browser drafts, restore/discard flow, and draft clearing after a successful module save. Back, route clicks, reload/close, and delete now require an explicit decision when edits are dirty; cancel keeps the editor and a saved browser draft remains recoverable.
- Made the destructive-delete confirmation explicitly state that unsaved changes will also be discarded after confirmation.
- Preserved old Markdown rendering and added underline compatibility in `EditorialContent`.
- Added account-scoped APPI active-conversation and composer-draft storage, persisted conversation restoration, page deduplication/upsert/remove helpers, explicit loading/empty/error copy, and a visible `Belum tersimpan` state with retry for assistant persistence failures.
- Added backend APPI persistence boundaries and `POST /ai/conversations/{id}/messages` for atomic assistant message plus metadata persistence. No database transaction is held during AI generation.
- Made conversation touch metadata derive `message_count` from actual message rows and retained user-scoped list/detail/rename/delete/stream predicates.
- Added focused tests in `tests/academy-hardening.test.mjs`.
- Refreshed the tracked Vite/PHP staging artifact in `dist/`.

## Automated checks

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run lint` | PASS | Exit code 0 after the natural block-style selector and navigation-guard changes. |
| `npm test` | PASS | 4/4 tests passed. |
| `npm run build` | PASS | Vite built 3,199 modules; only existing Browserslist/chunk-size warnings. |
| `php -l public/api/index.php` | PASS | No syntax errors. |
| `php -l public/api/bootstrap.php` | PASS | No syntax errors. |
| `git diff --check` | PASS | No whitespace errors; Git reported only existing LF/CRLF normalization warnings. |
| `npm run typecheck` | PARTIAL / baseline failure | Repository-wide TypeScript checking still fails on existing untyped primitive/UI declarations. A changed-scope filter showed only the pre-existing `AiAssistant.jsx` primitive/prop errors; no errors were emitted for the new `RichTextEditor`, `AdminModuleEditor`, `AiChatProvider`, `EditorialContent`, `nativeClient`, `aiHistoryState`, `editorialUrls`, or `richTextSafety` files. |

The package installation reported 12 npm audit findings. They were not auto-fixed because dependency upgrades are outside this bounded hardening scope.

## Staging deployment

1. cPanel updated `/home/aapp8359/repositories/aapmlayeracademy-staging` from remote `develop` through the earlier hardening commits and deployed it.
2. The first staging authoring pass found a real nested-form defect in the link popover: submitting `Terapkan` reloaded the module form and dropped an unsaved block.
3. The narrow fix was committed, pushed, integrated into `develop`, and redeployed.
4. The follow-up natural-editor/guard changes were pushed to `develop`; cPanel then updated and deployed final runtime commit `27c18388abc3033ec1173e6fe20ea6accf71018a`.
5. Final staging cPanel state at the time of this evidence update: `Last Deployed SHA: 27c18388abc3033ec1173e6fe20ea6accf71018a` (`fix(editor): keep block style synced with caret`).
6. `GET https://staging.aapmlayeracademy.id/api/health` returned HTTP 200:

```json
{"data":{"ok":true,"app":"aapm-layer-academy-native","environment":"staging"}}
```

## Runtime UAT

### Module authoring

- URL: `https://staging.aapmlayeracademy.id/admin/courses/layer-farm-management/modules/1`
- Session: existing authenticated Academy admin session; no credentials are recorded here.
- Added one additive rich-text UAT block to module 1 and saved it. The saved module showed `3/80 blok` and no dirty indicator after save.
- Live editor after the corrected redeploy exposed one toolbar and retained the following DOM structures: `strong=5`, `em=1`, `u=1`, `s=1`, `h2=1`, `ul li=2`, `ol li=1`, `blockquote=1`, `a=1`.
- Applying `https://example.com/academy` kept the same module URL and preserved the unsaved block. Applying `javascript:alert(1)` was rejected with `Gunakan URL HTTPS atau path internal yang aman.` and left the link popover open.
- Full reload restored the saved block, safe link, heading, lists, and blockquote. The draft dialog did not reappear, demonstrating draft cleanup after save.
- Learner preview rendered the saved content with `h2=2` (module heading plus content heading), `strong=5`, `em=1`, `u=1`, `del=1`, `ul=1`, `ol=1`, `blockquote=1`, and the expected HTTPS link.
- Legacy Markdown fallback remained present and readable in the editor after adding the rich-text block.
- Browser screenshot evidence was captured inline during the task for the authoring/learner-preview page and the APPI page.

### Natural editing and accidental-action guards

- On the final deployed build, a fresh rich-text block was populated with `Final natural heading test`, changed from `Judul 1` to `Judul 2` while the same text node remained the active selection, and inspected in the live DOM. Result: `blockTags=["H2","P"]`, text unchanged, with the trailing empty `P` representing Tiptap's normal required trailing paragraph; no extra heading or line was created by the H1-to-H2 action.
- Moving the caret to an existing H2 block made the selector show `Judul 2`; moving it to an H1 block made the selector show `Judul 1`. This confirms the control reflects the active block rather than a stale previous selection.
- With unsaved text, clicking `Kurikulum` opened `Tinggalkan editor?`; cancel kept the module URL and text. Browser Back opened the same guard; cancel kept the editor and text. Confirming `Tinggalkan tanpa simpan` navigated away while retaining the browser draft for recovery.
- Reopening the module in a fresh tab showed `Draft lokal ditemukan`; `Pulihkan draft` restored the unsaved text and dirty state. This verifies accidental route/history exit does not silently lose the draft.
- Delete confirmation stated that unsaved changes would also be discarded. Cancel and Escape closed the confirmation without deleting or leaving the editor.
- No current natural-editor UAT block was saved to the staging database; the temporary UAT state was discarded in the browser. The previously documented additive APPI/module fixtures remain unchanged.

### APPI persistence and history

- URL: `https://staging.aapmlayeracademy.id/ai-assistant`
- Existing admin-scoped history loaded as `Chat 31` before the test. A fresh conversation was created and the prompt `UAT APPI persistence staging: ringkas satu langkah validasi HDP 91,2% dibanding 87,8%.` was sent.
- The streamed answer completed and showed `Tersimpan di riwayat akun`.
- Full reload restored the same prompt and answer, selected `Chat 32`, showed no `Riwayat belum dapat dimuat.` state, and produced no browser error/warning logs.
- The history UI showed account-scoped data rather than the full cross-account database total. A direct navigation attempt to another-account API conversation id was blocked by the browser client (`ERR_BLOCKED_BY_CLIENT`), so direct unauthorized API response verification is recorded as UNVERIFIED; server-side user predicates and the scoped UI/DB evidence remain verified.

## Read-only staging database evidence

All database observations below were made through phpMyAdmin SELECT/DESCRIBE queries. No SQL write was issued.

| Observation | Result |
| --- | --- |
| Pre-UAT `ai_conversations` | 45 |
| Pre-UAT `ai_chat_messages` | 144 |
| Post-UAT `ai_conversations` | 46 |
| Post-UAT `ai_chat_messages` | 146 |
| Newest conversation | `id=62`, `user_id=4`, `message_count=2` |
| Scalar message rows for conversation 62 | `conversation_id=62`, `n=2` |
| Module 1 `editorial_content` | `LENGTH(editorial_content)=808` bytes |
| Schema observation | `course_modules.editorial_content` is existing nullable `mediumtext`; no schema change was made. |
| Existing role grouping | 4 admin accounts and 3 user accounts in the staging dataset; no credentials were exposed. |

The expected post-UAT database delta is one new APPI conversation with two messages. The module test block and APPI test conversation remain as additive staging fixtures. They were not destructively removed because cleanup/delete was outside the requested bounded proof and no delete/reseed action was authorized.

## Git coordinates

- `c2eefd4ace7f66314d69e6164a724e02e6301b45` — `feat(admin): add safe Tiptap authoring and draft recovery`
- `62cd94a7da6c1987a51c85ee35d9563573633e2d` — `fix(ai): harden persistent conversation history`
- `bb7b594c0498cb065d1d6eb2e4944ad61b73de50` — `test: cover Academy authoring and APPI contracts`
- `054b1e6d43da3b6488b4157036e0f9f33b6b76fc` — `build: refresh native staging artifact`
- `10af06fcfec7930fab358346043a7fa8118af1a7` — `fix(editor): prevent link popover form submission`
- `9c2b7dac79e5fd2c8a9079e90f3f14375874a2c8` — `fix(editor): make block formatting and navigation safe`
- `27c18388abc3033ec1173e6fe20ea6accf71018a` — `fix(editor): keep block style synced with caret`
- `2fdd1b64a8718075468a8c1741656ab7d1b5fa26` — `docs: record production promotion and smoke verification`

Remote `develop` and `main` were synchronized through `2fdd1b64a8718075468a8c1741656ab7d1b5fa26`; this final evidence correction is documentation-only and does not change runtime code.

The production `main` promotion and cPanel deployment are recorded in the production section below.

## Production promotion

Status: VERIFIED.

- GitHub remote `origin/main` was updated by fast-forward from `bc68df4ba724128171a4a9c25f543815237b8102` through the tested runtime promotion to `61801c37e82c1d7664c2aa7c751a899bc14fd70b` and the production/evidence synchronization commit `2fdd1b64a8718075468a8c1741656ab7d1b5fa26`; `origin/develop` points to the same history. The local stale/divergent `main` branch was not reset or overwritten.
- Production cPanel repository: `/home/aapp8359/repositories/aapmlayeracademy-production`, repository name `aapmlayeracademy-production-main`.
- Production cPanel configuration was verified before mutation: remote `git@github.com:erp-aapm/aapmlayeracademy.id.git`, checked-out branch `main`.
- cPanel `Update from Remote` succeeded and advanced production HEAD through the tested runtime promotion to `61801c37e82c1d7664c2aa7c751a899bc14fd70b`, then to the final production/evidence synchronization commit `2fdd1b64a8718075468a8c1741656ab7d1b5fa26`.
- cPanel `Deploy HEAD Commit` completed successfully for the final synchronized HEAD. Last deployed timestamp shown by cPanel: Sep 6, 2026 5:11:37 PM; last deployed SHA: `2fdd1b64a8718075468a8c1741656ab7d1b5fa26`.
- The follow-up evidence correction is documentation-only; no runtime source, generated runtime artifact, production database, migration, or seed changed after that verified deployment.
- `GET https://aapmlayeracademy.id/api/health` returned HTTP 200 with `{"data":{"ok":true,"app":"aapm-layer-academy-native","environment":"production"}}`.
- A fresh browser smoke check of `https://aapmlayeracademy.id/` redirected to `/login` and rendered the Academy login title, form fields, CTA, and branding. No credentials are recorded in this evidence.
- No production database write, seed, migration, or destructive cleanup was performed by this task.

## Remaining limitations

- Repository-wide `npm run typecheck` remains blocked by the pre-existing JavaScript/JSX primitive declaration debt described above; this task did not broaden into a design-system typing migration.
- Fresh logout/login verification was not performed because the staging session was an existing authenticated session and no fresh test credentials were supplied. Existing session runtime, account-scoped history, read-only role grouping, and server-side scope predicates were verified.
- Direct cross-account API response verification remains UNVERIFIED because the browser client blocked direct JSON navigation; it was not bypassed by changing auth/configuration.
