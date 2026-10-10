# Q05 technical handoff for a future Q06 work item

This document records the completed Q05 contracts. The repository does not define a Q06 feature mission; choose its scope through the existing owner/governance process before implementing further behavior.

## Persistence and API contracts

- Module saves and question edits write mutable drafts with `expectedDraftVersion`. Published module and bank revisions are immutable; publishing consumes the draft token and requires verified admin authorization, CSRF and explicit confirmation. Learner APIs read published compatibility projections only.
- Final-exam drafts use the same version/confirmation boundary. Existing attempts keep their stored question and policy snapshots; later publications affect new attempts only.
- The assigned policy is the academic contract. Canonical ordered membership and `assessmentMode` live in `requirements_json`, with version-keyed compatibility projections. Policy save, validation and readiness require the current draft token. Activation remains an environment-guarded operator CLI action, with operator and evidence reference; there is no HTTP activation capability.
- Password registration, verified Google provisioning and admin-created accounts assign the active policy on the server. Client policy/role claims do not grant Google privileges or override assignment. Existing assignments are preserved. Google account creation and its assignment share a transaction; offline tests exercise the callback's actual persistence helper without contacting Google.
- Archived required modules remain available to assigned learners. Unpublished, dependency-free drafts alone can be hard-deleted; allocated module numbers are not reused. Media references include current drafts and every historical revision.
- APPI suggestions enter the module draft workflow. Companion publication/activation actions are rejected before provider invocation. Any new assistant capability must retain admin/CSRF and explicit validated publication boundaries.

## Additive migration and recovery

The Q05 tracking key is `20261101_curriculum_publishing_v1`; Q03/Q04 keys and immutable evidence remain intact. Policy mode enrichment seals `modeSnapshotVersion: 1`; it does not silently add Q05-authored modules or recalculate existing academic requirements.

Select an explicitly authorized private config through `AAPLAYERACADEMY_CONFIG`. The migration CLI supports `--plan`, `--apply --verify --expect-environment=local` and deployment environment markers. A read-only plan reports missing curriculum structures without attempting to query absent columns. A checksum-valid replay retains original tracking timestamps.

PDOmysql initialization takes a database-derived advisory lock with a 15-second acquisition timeout and releases its acquisition in `finally`. It must precede application transactions. Individual backfills lock/recheck each module identity inside its transaction. Additive DDL may commit independently on MySQL/MariaDB; recovery resumes completed module backfills, rolls back the failed module, and writes the Q05 completion marker only after complete backfill and assignments. It preserves original lesson timestamps even when the database uses automatic `ON UPDATE` timestamps. See [ADR D11](../adr/2026-10-q05-curriculum-publishing.md).

## Reproducible disposable checks

Use the project's installed Node/npm and PHP runtime, with PDOsqlite/PDOmysql available. These commands do not authorize staging/production access:

```powershell
npm test
npm run lint
npm run lint:php
npm run typecheck
npm run tokens:check
```

`npm test` includes Q01–Q05, the player tests, native SQLite API/history fixtures and frontend contracts. Q01 includes artifact verification and disposable build/deploy/rollback fixtures, so its result depends on the current source/artifact state. A source-phase artifact failure is retained explicitly until the separately sequenced staging build and parity checks complete.

For native database proof, supply the private JSON path through `AAPM_TEST_MYSQL_CONFIG`, then run `npm run test:q05:mysql`. This command refuses a missing configuration rather than falling back to SQLite. The harness accepts only a task-owned loopback runtime with the `aapm_q05_test_` database prefix; each fixture creates a fresh schema. The private JSON contains host/port/testUser/testPassword/databasePrefix/taskOwned. Keep it outside the repository/docroot and never print its contents. Fixture downgrade, failure-trigger and barrier helpers require `task_owned_fixture=true` in their generated private local configuration.

Use `npm run test:q03-q04:mysql` with the same private configuration for the bounded inherited assessment/certificate guarantees: checked answer immutability/idempotency, parallel module answers and answer/submit serialization, concurrent submission, concurrent certificate issuance and complete answer-free certificate evidence. The runner selects those existing/native-compatible cases and the added answer race; it does not claim the entire Q03/Q04 suite ran under MariaDB.

The native Q05 suite covers fresh bootstrap, populated Q04-shaped history upgrade, read-only plan, interrupted recovery, replay, simultaneous initialization, module save/publication races, final-bank races, policy races, forced transactional rollback and lock timeout. Preservation compares digests to avoid dumping account credential fields.

## Proof boundaries

Task-owned native evidence uses **MariaDB 10.4.32 / InnoDB / REPEATABLE-READ**. MySQL 8 and other flavors remain untested. Provider-backed Google/APPI execution, real accounts, staging/production migrations, deployment and release remain separate external-environment actions. Offline provisioning/provider-boundary tests do not claim external provider success.

The source task retains existing typecheck debt rather than suppressing it. Compare normalized file + diagnostic code + message against the committed Q04 baseline, ignoring shifted source positions. Generated CSS follows `src/design-system/tokens/aapm-academy.tokens.json`; run the existing generator rather than editing generated tokens by hand.

Browser proof belongs to the controller's task-owned CUA session and its retained `browser-evidence.md`; Node suite browser skips describe automation coverage only. Build staging artifacts from the reviewed, clean source revision, verify Node/PHP manifest/API parity and LF export parity, then commit generated artifacts separately. Local proof and source commits do not themselves authorize external integration or deployment.
