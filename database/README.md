# Native database setup

The application keeps the existing React screens and stores data in the PHP
API under `public/api/`.

## Local development

1. Copy `config.native.example.php` to `config.php`.
2. Keep `'environment' => 'local'` and the default SQLite settings.
3. Run `php database/seed.php` once.
4. Start the API with `php -S 127.0.0.1:8000 -t public public/router.php`.
5. Start Vite with `npm run dev` in another terminal.

The seed creates a demo account:

- Email: `demo@aapmlayeracademy.id`
- Password: `aapmacademy@2026`

## cPanel

Each deployed environment has its own MySQL/MariaDB database and user, and its
own private file outside `public_html`. Start from `config.staging.example.php`
or `config.production.example.php` in the repository root, and follow the
provisioning steps in the top-level README (“Environments, artifacts, and
deployment”). Set `environment` to the environment name, keep `db_driver` as
`mysql`, and replace every `REPLACE_` value on the server. Do not use the
former shared `aapmlayeracademy-config.php` file or an `app_env` key; both are
no longer read.

For a new, empty database, create the schema (or let the API create it on its
first request, which is allowed only after the marker below), then provision the
environment marker. The marker command writes only the marker table and row:

```bash
AAPLAYERACADEMY_CONFIG=/home/aapp8359/aapmlayeracademy-staging-config.php php database/migrate.php --init-environment-marker --expect-environment=staging
```

For a new, empty database, run `php database/seed.php` from the checked-out
staging repository after the schema is ready. The seed loads demo content and
the demo account; it is not a production migration and must not be run against
an existing learner database unless a deliberate content refresh is intended.

## Existing cPanel database migration

For an existing staging/production database, use the explicit migration runner
instead of the content seed:

```bash
php database/migrate.php --plan --verify
AAPLAYERACADEMY_CONFIG=<private file> php database/migrate.php --apply --verify --expect-environment=<environment>
```

`--apply` refuses to run unless `--expect-environment` matches the private file and the environment marker is verified. `--plan` and `--verify` never write.

`--plan --verify` is read-only. It reports missing application tables, the
expected additive indexes, and non-secret integrity checks. `--apply --verify`
creates the tracking table `schema_migrations`, adds only the missing
read-model indexes, records checksum `20260909_read_model_indexes_v1`, and
re-runs the checks. It is idempotent and never deletes or rewrites learner,
course, quiz, farm, certificate, or AI rows. DDL can still take a short
metadata lock, so run it on staging first during a quiet window when the two
cPanel document roots share one database, and take the normal cPanel/phpMyAdmin
database backup before applying it.

The health report keeps two intentional domain exceptions visible: module
number `0` is the global final-exam question/progress bank, and conflicting
chapter names at one level require an editorial decision rather than an
automatic rename. Secrets are never printed. AI provider settings still need a
private `ai_settings_encryption_key` and a valid provider credential before the
admin AI flow can be considered runtime-ready.

The runner is CLI-only and bypasses web bootstrap side effects. If required
application tables are missing, `--apply` stops and asks for `schema.sql` (or a
first API request on a fresh install) before continuing.
