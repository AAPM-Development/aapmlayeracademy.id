# Native database setup

The application keeps the existing React screens and stores data in the PHP
API under `public/api/`.

## Local development

1. Copy `config.native.example.php` to `config.php`.
2. Keep the default SQLite settings.
3. Run `php database/seed.php` once.
4. Start the API with `php -S 127.0.0.1:8000 -t public public/router.php`.
5. Start Vite with `npm run dev` in another terminal.

The seed creates a demo account:

- Email: `demo@aapmlayeracademy.id`
- Password: `aapmacademy@2026`

## cPanel

Create a MySQL database/user in cPanel, run `database/schema.sql` if desired,
then create `/home/aapp8359/aapmlayeracademy-config.php` outside `public_html`:

```php
<?php
return [
    'app_env' => 'staging',
    'db_driver' => 'mysql',
    'db_host' => 'localhost',
    'db_port' => '3306',
    'db_name' => 'aapp8359_layeracademy',
    'db_user' => 'aapp8359_layeracademy',
    'db_password' => 'CHANGE_ME',
    'expose_dev_reset_token' => false,
];
```

Then run `php database/seed.php` from the checked-out staging repository. The
API also creates missing tables on its first request, but running the seed is
what loads the demo content and account.
