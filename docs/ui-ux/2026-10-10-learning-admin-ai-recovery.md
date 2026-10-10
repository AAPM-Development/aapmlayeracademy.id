# Learning, Admin and APPI recovery

Starting checkout: `D:/SA/aapmlayeracademy.id`, `main` at
`c57d322a4f41dfc2f9c50d3d8870a527e43396c8`. Work uses the ordinary branch
`codex/academy-bootstrap-locking`; existing untracked `output/` is preserved.

## Reproduced defects and corrections

- SQLite curriculum bootstrap retained COUNT cursors and acquired its write
  transaction too late. A competing writer reproduced `database is locked`
  at curriculum activation. Bootstrap now reserves the writer first, closes
  read cursors and commits the whole policy membership together. The shared
  transaction helper tracks raw SQLite `BEGIN IMMEDIATE`: PDO's
  `inTransaction()` alone does not recognize that transaction in this runtime.
- The explicit schema migration did not describe `ai_chat_messages.response_details`.
  It now detects and adds the nullable metadata column. Replay tests compare
  curriculum, immutable revisions, assignments, assessment and certificate
  records, and retain existing message content.
- The learner-to-Admin select was behind its drawer (dropdown layer 50 versus
  overlay 100). Dropdowns now use layer 110. Role restrictions still require
  Super Admin and verified email; no real account was promoted for testing.
- Model items use cmdk's `data-disabled="false"`. The old presence selector
  disabled pointer events for every option. The shared selector now recognizes
  only an empty Radix disabled attribute or the value `true`.
- AI editing retains the selected connection after save/refetch, updates the
  query cache from the saved response and discards model discovery results
  after endpoint or preset changes. The model popup fits its available space.
- Clicking **Baca ulang materi** invoked `scrollIntoView`, which also moved
  the hidden document scroll by 61 px. Navigation now scrolls only the lesson
  panel. The focus shell fills the viewport independently of document scroll,
  and its measured footer clearance keeps APPI above the action buttons.

## Learning policy

Published materials and module quizzes can be opened in any order. The next
unfinished module is a recommendation. Navigation, reading and practice do not
manufacture a quiz pass. Server grading, attempt ownership, immutable question
snapshots and certificate eligibility remain authoritative. Practice can follow
later; read-again and retries retain prior successful evidence. Final exams
retain their prerequisites and passing grade but allow retries without the
old three-starts-per-day penalty. Every attempt remains recorded.

## OpenAI integration

Admin can explicitly import an existing server OpenAI credential into the
encrypted provider registry. The browser receives readiness flags only. The
import uses the official OpenAI endpoint and cannot be redirected by request
parameters. An imported key cannot follow a changed endpoint unless explicitly
removed or replaced. New/cleared connections do not inherit another gateway's
legacy scalar credential.

Server source: private `openai_api_key`, `OPENAI_API_KEY`, or a legacy official
OpenAI private connection. Only the owner's local-development configuration may
also read `OPENAI_API_KEY` from `.env.local`; deployment/test fixtures never read
that local file. Staging and production require their own private server source.

CLI inspection is read-only by default:

```sh
php scripts/security/import-server-openai.php
```

Applying requires the exact environment:

```sh
php scripts/security/import-server-openai.php --apply --expect-environment=staging
```

The same action is available in **Admin → Pengaturan APPI**. It changes provider
settings only, preserves chat history, and makes no paid completion request.

## Bounded proof

- Focused AI/lesson suite: 10 passing tests, no failures. Includes auth/CSRF,
  encrypted import, endpoint confinement, rollback without encryption and
  navigation without fabricated completion.
- Desktop 1920×889 after reread: document scroll 0, document height 889,
  footer bottom 889, launcher bottom 813.
- Mobile 390×844 after reread: document scroll 0, document width 390 and
  height 844, footer bottom 844, launcher bottom 760.
- Browser model search selected `review-model-beta`, saved it on inactive
  provider B, retained that selected connection and read back the saved model.
  Mobile popup and options fit the viewport and accepted pointer input.
- Actual local AAPM OpenAI key imported into encrypted storage. Digests of ten
  curriculum/evidence tables before and after import matched. Official model
  discovery returned 127 models with TLS verification enabled. No completion
  request was made during this recovery.
- cPanel audit: both checkouts clean; main/develop correct. Neither private
  server configuration currently contains an OpenAI credential; encryption
  configuration exists in both environments.

Browser evidence and raw verification logs are under the preserved local
`output/` directory. A viewport override is responsive browser evidence, not a
physical phone or soft-keyboard test.
