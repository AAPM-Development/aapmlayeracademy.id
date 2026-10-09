# Q05 Curriculum Publishing — Architecture Decision Record

**Status:** Accepted for implementation; reviewed 2026-10-09  
**Context:** ECO-ACA-001 / Q05. Existing React/Vite + native PHP + MySQL/MariaDB system; disposable SQLite integration tests. Existing assessment and certificate evidence is authoritative and must remain intact.

## Recovery checkpoint

- **Baseline:** Q05 branch `feat/academy-q05-curriculum-publishing` at `7a6e21c`, same as `origin/develop` and DWO's verified HEAD. Local `develop` is a separate checkout at `e6be1ce`, 15 commits behind the remote baseline.
- **Existing work recovered:** The Q05 worktree at `D:/SA/aapmlayeracademy.id-q01` contained extensive uncommitted backend, migration, integration and test work. It was preserved and committed locally as `775a7e2` before further edits.
- **Preserved areas:** additive curriculum schema/backfill, module drafts and published revisions, module question-bank revisions, policy versions/assignments, Q03/Q04 assignment integration, archived content media references, and 31-case Q05 test file.
- **Known missing/incomplete at recovery:** final-exam bank draft/publish lifecycle; admin editor and course-management UX still use the retired immediate-save API contract; MySQL and browser verification.
- **Conflicts:** none in the Q05 worktree at recovery. Separate unrelated user edits in the main checkout (`src/components/AuthLayout.jsx`, `src/design-system/styles/shell.css`, and an untracked wordmark asset) were not touched.
- **Continuation strategy:** continue in the existing Q05 worktree and feature branch from the verified remote baseline; do not rebase, reset or merge the separate main checkout.

## Context and current architecture

The current learner read model is `course_modules` plus `quiz_questions`. Previously, the admin endpoints directly updated those tables. Q03 already snapshots selected questions and grading policy into each assessment attempt; its server remains authoritative for grading and completion. Q04 records certificate issuance evidence against academic generations and policy versions. Stable academic lookups still include `module_number`, so Q05 treats it as immutable and never reuses allocated numbers.

The recovered implementation inserts an editorial workspace (`module_drafts`) and immutable publication snapshots (`module_revisions`, `question_bank_revisions`, `question_bank_revision_items`). A successful transaction updates the legacy learner read model for compatibility and moves its published revision pointer. Existing Q03 attempt snapshots continue to protect active attempts. APPI output remains editorial draft material and does not receive a publish capability. Media cleanup scans both drafts and every historical revision.

## Design alternatives evaluated

1. **In-place editing plus database backup/version log.** Lowest migration and query cost, but a failed writer or an unconverted client can change learner-visible content before approval; old content cannot be treated as immutable. Rejected on INV-01/02.
2. **Separate draft workspace, immutable publication snapshots, transactional legacy projection (selected).** Additive migration; existing learner reads stay compatible and fast; a draft write never touches published rows; each publish atomically records content and question-bank snapshots, updates compatibility rows/pointer, and appends an audit event. Costs are duplicated snapshots and the need to ensure every authoring route targets drafts. Chosen as the smallest safe bridge for the existing PHP API and learner contracts.
3. **Make every learner query resolve normalized revision and policy tables directly.** Strongly explicit version reads, but rewrites many Q03/Q04/learner endpoints and raises migration risk and query complexity without improving assessment snapshot guarantees. Deferred; learner compatibility projection is safer for Q05.

## Decisions

### D1 — Editorial version model
Draft JSON is mutable only under optimistic version checks. Published module and question-bank snapshots are append-only. Publication writes both snapshots, updates the legacy `course_modules` and `quiz_questions` learner projections, updates the module pointer and draft baseline, and writes a publication event in one DB transaction. A transaction failure rolls everything back. `module_number` remains immutable; chapter/title/order are editorial payload but curriculum sequence requirements remain policy-owned.

### D2 — Assessment snapshots
New quiz attempts select the current published `quiz_questions` projection and Q03 persists the exact question and grading contract on the attempt. Existing attempts never reload questions from the mutable projection. The Q05 module-bank snapshot is historical publication evidence and does not replace Q03's already-established attempt snapshot contract. The final-exam bank is a distinct global bank (`module_number=0`) and must receive the same draft/version/publish treatment before Q05 can claim CAP-06 complete.

### D3 — Policy versioning and canonical resolution
The assigned policy version is the learner's academic contract. Legacy `academy-v1` rows are seeded from current Q03/Q04 definitions and are not rewritten. New accounts receive the active policy at account creation; existing assignments are never mass-migrated. Current compatibility tables (`assessment_policies`, `certificate_tier_policies`) remain version-keyed read projections for Q03/Q04; `curriculum_policy_modules` holds versioned membership. Their consistency must be checked at policy validation and activation. Any future direct policy write must update the complete version atomically; changing lesson content never changes policy tables. If runtime readers disagree with a draft policy representation, validation blocks readiness rather than selecting an arbitrary source.

### D4 — Lifecycle and deletion
New modules are draft-only; active modules are published; archived modules keep their revision, attempts and media. A learner assigned a policy that still requires an archived module retains access. Restore is an audited state change, not a revision rewrite. Hard delete is restricted to never-published, dependency-free drafts; allocated module numbers remain retired.

### D5 — Concurrency and retry
Every draft mutation includes `expectedDraftVersion`; publication includes the same token plus explicit confirmation. A stale update returns stable `revision_conflict` and never changes server state; the browser retains local edits and offers reload/reconciliation rather than auto-merging rich content. Publication retries with a stale consumed draft version conflict instead of silently creating a duplicate revision.

### D6 — API compatibility
The learner API continues to expose only the published compatibility projection. Existing immediate-save admin routes are transitioned to draft saves and require the version contract. Reorder and chapter rename through the old global endpoints are rejected with a stable conflict; changes are authored in module/policy drafts. Authorization and CSRF remain mandatory for each admin mutation. APPI remains unable to publish or activate policy.

### D7 — Media
Existing sanitization remains in force. Cleanup is conservative: URLs found in either draft or any immutable revision remain referenced. No automatic deletion of historical media is introduced.

### D8 — Assigned membership and assessment mode (Task 5)

The canonical `requirements_json` stores ordered `{moduleNumber, required, assessmentMode}` memberships, where assessment mode is `quiz` or `acknowledgement`. `curriculum_policy_modules.assessment_mode` is an additive, version-keyed read projection. Validation compares membership, mode, order, required sets, thresholds, and certificate tiers with the canonical snapshot. Admin detail reads the canonical requirements. Learner catalogue, quiz availability, new attempts, academic completion, final eligibility, and certificate evidence use the assigned contract. Archived required material remains available. Existing attempt grading still uses its original stored policy and question snapshots.

The compatibility enrichment adds `modeSnapshotVersion: 1` once when a populated catalogue is present. It preserves the existing required set, thresholds, and tiers, captures quiz presence at that boundary, and never recomputes mode from later content. For initial v1, legitimate optional Q04 modules are included with `required=false`; provenance requires a first revision created by backfill, with no publishing admin. Q05-created drafts and later first publications by admins are excluded. Existing canonical membership is checked against its projection before enrichment; divergence fails rather than being adopted. Replay cannot add newly authored content to sealed v1.

A quiz-mode membership, including an optional one, requires a valid published bank at validation/readiness. Active or superseded quiz policies prevent publishing an empty bank. An acknowledgement policy may coexist with a bank retained for earlier quiz cohorts; adding or correcting those questions cannot change acknowledgement completion. Restoring a damaged live bank is allowed because the academic mode is canonical, rather than inferred from the damaged projection.

### D9 — Policy concurrency and module identity coordination (Task 5)

Additive `curriculum_policy_versions.draft_version` begins at 1. Save, validation, and readiness all require `expectedDraftVersion`; missing tokens return 422 and stale tokens return 409 `revision_conflict`. A successful save atomically updates the canonical snapshot and every compatibility projection, consumes the token, returns the policy to draft, and clears prior validation. Validation/readiness retain the content version. Readiness locks and revalidates the dependencies even after successful advisory validation. There remains no HTTP activation endpoint.

Policy creation/activation lock policies in ascending identity order. Membership saves lock their policy and then referenced module identities in ascending module-id order, matching validation/readiness/activation. A nonexistent member is rejected during save, preventing dangling references. Deletion rechecks membership and academic/progress dependencies under the same module identity lock. SQLite uses the existing `BEGIN IMMEDIATE`; InnoDB uses locking reads. Separate-process SQLite races establish atomicity for the local driver; MariaDB lock behavior remains a separate Task 4 verification requirement.

### D10 — Admin policy and final-bank surfaces (Task 5)

`/admin/curriculum/policies` and `/admin/curriculum/final-bank` reuse the verified admin shell and AAPM primitives. Immutable policies are inspectable; later drafts expose ordered membership, required flags, assessment modes, passing thresholds, and certificate tier requirements. Counts include the inherited v1 cohort without explicit assignment rows. Draft creation clones the active policy into a subsequent version. Client-supplied assignments are ignored. Readiness clearly leaves controlled operator activation outstanding.

Final-bank editing saves the whole bank through Task 1's versioned API, supports private question preview, validates the current saved version, and requires a confirmation explaining retained attempt and certificate evidence before publication. Conflict and network failures keep the editing buffer. Reload replaces the buffer only after an explicit discard confirmation. Dirty drafts have one primary `Simpan draf`; saved drafts promote `Validasi`; validated drafts promote `Terbitkan` or policy readiness. Other actions remain secondary. Root performs desktop/390px rendered acceptance; source tests are not rendered proof.

Task 5 updates inherited test contracts deliberately: Q03 A19 assigns a disposable v2 optional acknowledgement policy rather than adding a post-migration module to immutable v1; the 70% grading fixture supplies ten disposable questions on already-assigned module 1; P21 proves restoring a removed live bank preserves canonical quiz mode rather than freezing a damaged projection. These preserve their academic-regression purpose. Policy fixtures now send the required optimistic token, and nonexistent membership is refused at save rather than persisting a dangling reference for later validation.

## Migration, fresh install, replay and rollback

Use a new stable Q05 migration key `20261101_curriculum_publishing_v1`; it is an identifier only and is not evidence of deployment. Add lifecycle/pointer/version columns without replacing content. Create tables/indexes additively. Seed `academy-v1` from existing Q03/Q04 requirements only if absent. Backfill all legitimate existing modules—not a hard-coded 22-row list—as active published revisions with their existing question banks; preserve all original rows and answer keys. Allocate every existing module number. Assign existing accounts to v1 idempotently. Mark the schema key only after the additive foundation/backfill succeeds. Replay must not overwrite already-seeded policies or duplicate backfilled revisions/events.

Fresh-install tests use the existing disposable SQLite flow and seeded catalogue. Upgrade/backfill tests must begin with Q04-shaped populated data. A failed migration is retried idempotently; no destructive down migration is offered. If rollback is needed before learner traffic, disable Q05 routes and retain all additive tables/columns/content; do not drop tables or rewrite evidence. MySQL DDL auto-commit behavior means the schema operations must each be idempotent and the data backfill must be restartable; production/staging mutation is not authorized in this task.

## Security and editorial UX
Every publishing, archive/restore, and policy administration mutation remains behind verified admin authorization and CSRF. Draft preview is admin-only. Learner quiz projections must omit correctness metadata. Conflict messaging is in Indonesian, announced accessibly, preserves unsaved local work, and provides a controlled reload path. The editor should have one clear current primary action labeled `Simpan draf`, with distinct `Pratinjau`, `Validasi`, `Terbitkan`, and `Arsipkan` affordances. Publication review must summarize the module, changed content areas, question count, current/proposed revision and learner impact; active attempts retain their prior question snapshot. At mobile widths, status and save remain reachable without obscuring focus or fields.

## Acceptance boundaries

SQLite source-level API tests can establish functional behavior and rollback under the test driver, but cannot establish MySQL row-lock/concurrency semantics. Build/source parity and PHP syntax are measurable locally. Browser editing evidence requires real browser interaction. Final-exam versioning, admin UX contract integration, actual baseline suite result, MySQL verification and mobile/desktop browser checks remain explicit gates until demonstrated.
