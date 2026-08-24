# AAPM Layer Academy

Native local/cPanel version of the Layer Farm Academy application. The
existing React/Vite screens and UI structure are preserved; persistence and
authentication now run through a PHP API with SQLite locally and MySQL on
cPanel.

## Stack

- React 18 + Vite + Tailwind CSS
- PHP 7.4+ compatible REST API (`public/api/`)
- SQLite for local development; MySQL/MariaDB for cPanel
- PHP sessions and `password_hash`/`password_verify` for authentication
- Local rule-based Farm Assistant fallback; no Base44 runtime dependency

PHP 8.3 is recommended for cPanel, although the API remains compatible with
the currently available PHP 7.4.33 fallback.

## Local development

Prerequisites: Node.js/npm and PHP with `pdo_sqlite` enabled. The bundled
Windows PHP in this workspace has the SQLite DLLs available but disabled, so
the commands below enable them per process without changing the global PHP
installation.

```powershell
Copy-Item config.native.example.php config.php
php -d extension=php_sqlite3.dll -d extension=php_pdo_sqlite.dll database/seed.php
php -d extension=php_sqlite3.dll -d extension=php_pdo_sqlite.dll -S 127.0.0.1:8000 -t public public/router.php
```

In a second terminal:

```powershell
npm install
npm run dev
```

Open the Vite URL printed in the terminal. Vite proxies `/api` to the local
PHP server. The seed creates a demo account:

- Email: `demo@aapmlayeracademy.id`
- Password: `aapmacademy@2026`

The local SQLite database is created under `storage/` and is ignored by git.

## Native API

The API exposes:

- `/api/auth/*` — login, register, logout, and password reset
- `/api/modules` and `/api/quiz` — course content and questions
- `/api/progress` — per-user progress and quiz scores
- `/api/certificates` — per-user certificates
- `/api/farm-data` — per-user KPI rows
- `/api/ai-assistant` — local assistant response
- `/api/health` — deployment health check

All mutating authenticated requests use the session's CSRF token. PHP creates
the table structure automatically on first request; `database/schema.sql` is
provided for explicit MySQL setup and `database/seed.php` loads demo content.

## cPanel staging

The `develop` branch deploys the Vite artifact in `dist/` to
`staging.aapmlayeracademy.id`. The artifact includes the PHP API under
`dist/api/`.

1. Create a MySQL database and user in cPanel.
2. Configure `/home/aapp8359/aapmlayeracademy-config.php` outside
   `public_html` using `config.native.example.php` as the template.
3. Set the staging domain to PHP 8.3 and enable `pdo_mysql`.
4. Build and include the static artifact:

```powershell
npm run build
git add -f dist
git commit -m "build: update native staging artifact"
git push origin develop
```

5. In cPanel Git Version Control for the staging repository, choose `Update
   from Remote`, then `Deploy HEAD Commit`.
6. Run the seed from the checked-out repository with `php database/seed.php`.
7. Verify `https://staging.aapmlayeracademy.id/api/health` and log in with the
   demo account.

Production remains connected to `main` and is not changed by staging deploys.
Promote a tested commit to `main` only after the native staging smoke test
passes.

## Content migration

The repository contained the original Base44 entity schemas but not the
hosted module/quiz records. The native seed therefore provides 22 editable
demo modules and questions matching that schema. Replace the seed content or
load the final curriculum into `course_modules` and `quiz_questions` when it
is available.

## Google login

Google OAuth is intentionally not enabled in this native baseline because no
Google Cloud OAuth client ID/secret was supplied. Email/password login is
fully local. Google login can be added later as a separate OAuth adapter
without changing the course data model.
