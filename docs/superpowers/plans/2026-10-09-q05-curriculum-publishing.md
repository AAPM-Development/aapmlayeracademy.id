# ECO-ACA-001 Q05 Curriculum Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the recovered Q05 publishing system so module and final-exam drafts are isolated, immutable publications and policy assignments remain authoritative, with the existing admin editor usable on the safe draft/publish workflow.

**Architecture:** Retain the selected additive architecture documented in `docs/adr/2026-10-q05-curriculum-publishing.md`: mutable optimistic-versioned draft workspace, immutable revision snapshots, and transactional projection into legacy learner read tables. Add the missing versioned global final-exam bank and adapt current admin screens to the new API without replacing the editor shell.

**Tech Stack:** React, Vite, React Query, native PHP API, PDO, MySQL/MariaDB production, SQLite disposable integration tests, Node `node:test`, ESLint.

**Spec:** `docs/adr/2026-10-q05-curriculum-publishing.md` and the user-provided ECO-ACA-001 / Q05 DWO in the session.

## Global Constraints

- Draft save never changes learner-visible published content.
- Published module and question-bank revisions are immutable; corrections create revisions.
- Existing assessment attempt snapshots, grades, progress, and certificate evidence are never erased or rewritten by editorial changes.
- Existing `academy-v1` assignments remain unchanged; new accounts receive the active policy at account creation.
- Content revisions never silently change academic requirements or passing thresholds.
- Every publish, archive, restore, and policy-admin mutation requires verified admin authorization and CSRF.
- Learner APIs never expose draft content or unchecked correct answers.
- `module_number` remains immutable and allocated numbers are never reused.
- APPI can only contribute to drafts and cannot publish or activate policies.
- Preserve current AAPM components, design tokens, editor architecture, and admin shell.
- Do not push, open a PR, merge, deploy, or mutate staging/production databases.
- Use exact Indonesian action labels: `Simpan draf`, `Pratinjau`, `Validasi`, `Terbitkan`, `Arsipkan`.

## Review Focus

- Stale admin tab after another editor saves: retain local unsaved content, explain `revision_conflict`, and offer reload without auto-merging rich content. (Task 2 test.)
- Draft question save racing with publication: only one draft version is accepted, and live questions/revisions stay coherent. (Task 1 test.)
- Existing final-exam attempt while a new exam bank publishes: the attempt retains its original question snapshot and grading contract. (Task 1 test.)
- Newly archived module already assigned/required to a learner: remains available while unassigned learners cannot see it. (Task 1 regression test.)
- Policy v2 invalidated by concurrent module/policy changes after validation: activation revalidates inside its transaction and leaves the active policy unchanged. (Task 1 test.)

---

## File Structure

- `public/api/curriculum.php`: curriculum schema, draft/revision transactions, policy resolution, final-exam draft operations.
- `public/api/assessment.php`: select the current published final-exam bank for new attempts; keep attempt snapshots unchanged.
- `public/api/index.php`: admin final-bank and module routes; learner-facing published-only routes.
- `database/migrate.php`: stable Q05 schema key, migration/apply/verify status.
- `scripts/curriculum/activate-policy.php`: controlled policy activation; validate and commit all compatibility projections atomically.
- `src/api/nativeClient.js`: typed-by-convention calls for versioned draft and publishing endpoints.
- `src/lib/useAdminData.js`: query/mutation hooks, cache invalidation, state/revision conflicts.
- `src/pages/admin/AdminCourses.jsx`, `AdminCourseDetail.jsx`: lifecycle statuses, disable legacy live reorder/rename, archive/restore controls.
- `src/pages/admin/AdminModuleEditor.jsx`: load/save draft version, conflict retention/recovery, validation, preview, publish review/confirmation, revision history, archive flow.
- `src/components/admin/EditorActionBar.jsx`: current-state primary action and exact action label.
- `tests/q05-curriculum.test.mjs`: API/migration/assessment/policy regression tests.
- `tests/q05-frontend.test.mjs`: frontend source/API behavior contract tests.
- `docs/adr/2026-10-q05-curriculum-publishing.md`: architecture and recovery checkpoint.

## Tasks

### Task 1: Version the global final-exam bank and close backend invariants

**Files:**
- Modify: `public/api/curriculum.php`
- Modify: `public/api/assessment.php`
- Modify: `public/api/index.php`
- Modify: `scripts/curriculum/activate-policy.php`
- Test: `tests/q05-curriculum.test.mjs`

**Interfaces:**
- Consumes: `aapm_cur_insert_bank(PDO $pdo, string $scope, int $moduleNumber, array $questions, ?int $actorId, string $now): int`, the existing question-bank revision tables, existing `aapm_cur_expected_version(array $input): int`, and Q03 attempt snapshots.
- Produces: `aapm_cur_final_bank_draft(PDO $pdo, ?int $actorId): array`, `aapm_cur_final_bank_write(array $input, string $operation, ?int $questionId, int $actorId): array`, `aapm_cur_final_bank_publish(int $expectedVersion, int $actorId): array`, and admin routes `GET/POST /api/admin/curriculum/final-bank`, `POST /api/admin/curriculum/final-bank/validate`, `POST /api/admin/curriculum/final-bank/publish`.

- [ ] **Step 1: Write failing backend tests**
  - Add tests asserting: final bank draft edits do not alter the learner-facing `quiz_questions` where `module_number=0`; publish makes new final attempts use the newly published bank; an in-progress final attempt retains its original snapshot; invalid answer indexes and an empty required final bank fail validation; missing CSRF and non-admin attempts are rejected.
- [ ] **Step 2: Run the focused tests and confirm they fail for the missing final-bank routes/behavior**
  - Run: `node --test --test-concurrency=1 --test-name-pattern="final-exam bank" tests/q05-curriculum.test.mjs`
  - Expected: failure because no final-bank draft and publish routes exist.
- [ ] **Step 3: Implement versioned final-bank draft and publish**
  - Use `scope_type='final'`, `module_number=0`; store bank items in the existing revision tables; enforce `expectedDraftVersion`; validate non-empty valid choices; reject publication while an active final attempt exists only if needed to protect the contract (existing Q03 snapshots should allow safe publication without that restriction); write revision, update the compatibility projection and event in one PDO transaction.
  - Backfill the currently live final bank idempotently without rewriting Q03 attempt snapshots.
  - Add CSRF-protected verified-admin endpoints. Do not provide activation or publish routes to APPI.
- [ ] **Step 4: Test concurrent final-bank editing and publication rollback**
  - Add assertions that stale concurrent writes return 409 `revision_conflict`, and a forced failure midway through publication leaves the live bank, revision count, and publication events unchanged.
- [ ] **Step 5: Revalidate policy at activation and preserve source-of-truth consistency**
  - Update the activation script to re-run full policy validation under the same DB transaction/lock used to switch active versions; update Q03 assessment policy and Q04 tier projections only from the validated curriculum-policy snapshot; reject any activation whose policy/membership/assessment/tier data disagree. Assert activation failure leaves exactly the previous active policy and all v1 rows unchanged.
- [ ] **Step 6: Run focused tests and commit**
  - Run: `node --test --test-concurrency=1 tests/q05-curriculum.test.mjs`
  - Expected: all executable Q05 SQLite tests pass; any unavailable MySQL/browser tests remain labeled NOT_TESTED.

### Task 2: Integrate module editor with draft/publish UX

**Files:**
- Modify: `src/api/nativeClient.js`
- Modify: `src/lib/useAdminData.js`
- Modify: `src/pages/admin/AdminModuleEditor.jsx`
- Modify: `src/components/admin/EditorActionBar.jsx`
- Create/Modify: `tests/q05-frontend.test.mjs`

**Interfaces:**
- Consumes: admin module API fields `lifecycleStatus`, `publishedRevisionId`, `draft: {version, hasUnpublishedChanges}`, `questions`, and backend routes in Q05 (`GET/PUT /admin/modules/:id`, `preview`, `validate`, `publish-preview`, `publish`, `revisions`, archive/restore, and versioned question mutations).
- Produces: `nativeApi.admin.modules.saveDraft(moduleId, data, expectedDraftVersion)`, `.previewDraft(moduleId)`, `.validateDraft(moduleId)`, `.publishPreview(moduleId)`, `.publishDraft(moduleId, expectedDraftVersion)`, `.revisions(moduleId)`, `.archive(moduleId, reason)`, `.restore(moduleId)`, and question mutations that require `expectedDraftVersion` and return the new version.

- [ ] **Step 1: Add failing API-contract/frontend tests**
  - Assert that save and question mutation payloads include `expectedDraftVersion`; the editor action label is exactly `Simpan draf`; preview/validate/publish/archive labels are distinct; 409 conflict keeps current client form values and renders recovery actions; APPI insertion affects editor state only and never invokes publish.
- [ ] **Step 2: Run focused frontend tests and confirm failures**
  - Run: `node --test --test-concurrency=1 tests/q05-frontend.test.mjs`
  - Expected: fail while native client/editor use old no-version immediate-save contract.
- [ ] **Step 3: Implement versioned editor state and draft save**
  - Seed draft state from server `draft.version`; pass that version on save and all question mutations; only increment local version from a successful server response; use stable `revision_conflict` handling that leaves `form` and browser-stored draft untouched and offers “Muat ulang draf terbaru” and “Pertahankan perubahan saya” without auto-merge.
  - Change success copy from immediate learner availability to draft-saved status. For a new module, remain in editor after creating its draft, then continue the same workflow.
- [ ] **Step 4: Implement preview, validation and publication review**
  - Keep current preview canvas but load the server draft preview. Add explicit validation results with accessible `role=alert`/status and focusable recovery. Publication review must show module name, changed content areas, question count, current/proposed revision, expected learner impact, validation problems, and warning that active attempts retain original questions. `Terbitkan` is unavailable until validation succeeds and requires explicit confirmation.
- [ ] **Step 5: Implement editor archive/history affordances**
  - Add accessible revision history (inspect old immutable snapshots; copy selected revision into the current draft under expected version), archive reason + confirmation, restore control, and clear archived/published/draft/pending changes states. Do not offer destructive deletion for modules with publication or academic history.
- [ ] **Step 6: Run focused tests and lint; commit**
  - Run: `node --test --test-concurrency=1 tests/q05-frontend.test.mjs && npm run lint`
  - Expected: tests pass; ESLint exits 0.

### Task 3: Integrate course-management lifecycle status and safe structure controls

**Files:**
- Modify: `src/pages/admin/AdminCourses.jsx`
- Modify: `src/pages/admin/AdminCourseDetail.jsx`
- Modify: `src/lib/useAdminData.js`
- Test: `tests/q05-frontend.test.mjs`

**Interfaces:**
- Consumes: course module rows with `lifecycleStatus`, `draft.hasUnpublishedChanges`, `publishedRevisionId`, and server errors `curriculum_structure_draft_required`.
- Produces: visible and text-labeled statuses for `Draf`, `Terbit`, `Perubahan belum terbit`, and `Arsip`; policy/module detail navigation; no destructive action that erases learner evidence.

- [ ] **Step 1: Write tests for lifecycle visibility and retired live mutations**
  - Assert source/query projection renders distinct state labels for draft, published, pending changes and archived modules; archive/restore mutations target Q05 endpoints; reorder/rename 409 is shown with the policy/module draft recovery path, not swallowed.
- [ ] **Step 2: Run focused test and verify failure**
  - Run: `node --test --test-concurrency=1 tests/q05-frontend.test.mjs`
  - Expected: fail because current course list has no Q05 lifecycle representation.
- [ ] **Step 3: Implement status display and safe action wiring**
  - Use existing AAPM badge/chip patterns; make status text present without color dependence. Disable/reword reorder/rename controls that bypass policy drafts; surface the Indonesian backend reason and link to the appropriate draft editor. Make `Arsipkan`/restore available only under proper state and explicit confirmation.
- [ ] **Step 4: Run tests/lint and commit**
  - Run: `node --test --test-concurrency=1 tests/q05-frontend.test.mjs && npm run lint`
  - Expected: tests pass; ESLint exits 0.

### Task 4: Complete migration, integration and artifact verification

**Files:**
- Modify as needed: `database/migrate.php`, `public/api/curriculum.php`, `public/api/assessment.php`, `public/api/certification.php`, `tests/q05-curriculum.test.mjs`, and migration/verification docs.

**Interfaces:**
- Consumes: completed backend and UI tasks.
- Produces: repeatable Q05 migration plan/apply/verify; complete PASS/BLOCKED/NOT_TESTED matrix without inflating skips.

- [ ] **Step 1: Add a populated Q04-shaped upgrade fixture and replay assertions**
  - Verify all existing module fields/media/questions remain intact; exactly one initial published revision per preexisting module; replay does not mutate v1 policy, learner assignment, attempts, certificate evidence, or create duplicate revisions/events.
- [ ] **Step 2: Run migration plan/apply/verify against disposable SQLite and capture results**
  - Run the project's existing migration harness against both fresh install and populated Q04 fixture; assert the stable Q05 marker is written only after completed backfill and replay is idempotent.
- [ ] **Step 3: Run complete Q01–Q04 regression suites and compare to baseline**
  - Run: `npm test`
  - Expected: all regressions that passed at clean Q04 baseline continue to pass. The known clean-baseline Q01 artifact-verification failure and any environment-bound cases are reported explicitly; do not suppress or relabel them.
- [ ] **Step 4: Run frontend quality and build checks**
  - Run: `npm run lint && npm run typecheck && npm run tokens:check && npm run build`
  - Expected: report each command separately; compare typecheck/token failures against baseline; do not add suppressions. Build from the clean source revision.
- [ ] **Step 5: Verify source/dist/API manifest and LF parity**
  - Run: `npm run verify:dist && npm run verify:artifact-php` plus repository LF-export parity check if available.
  - Expected: all run checks pass or are explicitly BLOCKED with reason; built artifacts are not claimed as verified if the source/artifact contract is unavailable.
- [ ] **Step 6: Browser and MySQL verification**
  - Use the browser preview and real editor interactions at desktop and 390px; verify draft-only save, validation, publish confirmation, stale conflict preservation, archived state, no field clipping, and sticky controls not covering focused fields. Run MySQL locking/migration scenarios only against an authorized disposable local MySQL/MariaDB instance; never use staging/production. If unavailable, report NOT_TESTED.
- [ ] **Step 7: Review changed files and commit source/artifact separately only after checks**
  - Check `git status --short --branch` and `git diff --check`; keep unrelated work untouched; create local source/artifact commits with the required attribution. No push, PR, merge, or deployment.

## Verification Requirements / Expected Limits

- `tests/q05-curriculum.test.mjs`: SQLite behavior evidence; does not prove MySQL concurrency.
- `tests/q05-frontend.test.mjs`: React source/API contract evidence; does not replace actual browser interaction.
- Q01–Q04 full-suite verification must include per-file baseline comparison. Initial observed branch suite: 152 pass / 5 fail / 4 skip overall; the 5 failures were confined to Q01 artifact tests. Clean Q04 baseline worktree rerun: Q01 30 pass / 1 fail. The stale `dist/` generated from current source is one known issue; resolve the source/dist parity/build issue before claiming PASS.
- Initial `npm run lint`: PASS. Initial `npm run typecheck`: nonzero baseline errors across existing Profile, Quiz, Register, and ResetPassword components; compare after changes. Initial `npm run tokens:check`: stale generated `aapm-tokens.css` baseline; do not rewrite unrelated generated tokens merely to hide it.
- SQLite supported; MySQL/MariaDB not yet verified. No staging/production operations authorized.
- At recovery, Q05 tests had 27 pass / 0 fail / 4 skipped. Skipped cases were final exam, APPI external runtime, browser, and MySQL; Task 1 implements final exam and Tasks 2/4 supply remaining evidence.

### Task 5: Complete curriculum-policy draft review and final-bank administration

Added 2026-10-09 by the owner's renewed ECO-ACA-001 execution directive. Execute after Task 3 and before Task 4 verification.

**Files:** native client/admin hooks; existing admin course routes and navigation; focused AAPM admin components/pages as appropriate; frontend/API tests.

**Requirements:**
- Provide verified-admin UI to list immutable academy-v1/current active policy and later drafts, create a subsequent policy draft, inspect/edit supported membership and assessment requirements through the existing canonical API, validate and prepare readiness. Show inherited learner assignment and certificate impact clearly. No browser activation endpoint or activation control; controlled audited server-side operator activation remains separate.
- Require expected version where backend supports it, preserve unsaved edits on conflicts, and expose validation errors accessibly. Fix backend policy draft concurrency if needed to prevent silent overwrite. Never accept client-supplied learner assignments.
- Expose final-exam bank draft/save/validate/publish review using Task1 versioned APIs. Use AAPM primitives and existing question-editor patterns, explicit confirmation and immutable-attempt warning. Draft changes never reach learners until publish.
- Test real API contract behavior, authorization/CSRF negatives and concurrent stale writes; frontend tests supplement browser workflow proof.
- Preserve current design system, editorial composer/APPI, and every Global Constraint above. No Q07 redesign. No remote operations.

**Completion:** focused tests and lint; self-review; descriptive local source commit; report with exact contracts and limitations. Task4 must include policy/final-bank browser flows and the owner's staging artifact sequence.

## Renewed owner artifact requirements

Task4 must build the staging distribution from clean committed source, verify manifest, PHP/Node parity and LF export, then commit dist separately. Local review runtime remains disposable. Remote develop was reverified via GitHub connector as fahziputraj at 7a6e21c7c4190dce2a902328de88110a49800d12 on 2026-10-09; gh CLI itself has no authenticated account. No GitHub writes or local integration are authorized.
