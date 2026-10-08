<?php

// PRIVATE production configuration template. Copy to the server at
// /home/aapp8359/aapmlayeracademy-production-config.php (outside public_html),
// replace every REPLACE_ value there, and never commit the filled file.
// The deploy script refuses any value that still starts with REPLACE_.
// Production activation requires its own marker provisioning step (see README).
return [
    'environment' => 'production',
    'db_driver' => 'mysql',
    'db_host' => '127.0.0.1',
    'db_port' => '3306',
    // The production-only database and user. Never shared with staging.
    'db_name' => 'REPLACE_WITH_PRODUCTION_DATABASE',
    'db_user' => 'REPLACE_WITH_PRODUCTION_DB_USER',
    'db_password' => 'REPLACE_WITH_PRODUCTION_DB_PASSWORD',
    'app_url' => 'https://aapmlayeracademy.id',
    'session_name' => 'aapm_layer_session',
    'mail_from' => 'REPLACE_WITH_PRODUCTION_SENDER_ON_VERIFIED_DOMAIN',
    'mail_host' => '127.0.0.1',
    'mail_port' => 25,
    'google_client_id' => 'REPLACE_OR_EMPTY_GOOGLE_CLIENT_ID',
    'google_client_secret' => 'REPLACE_OR_EMPTY_GOOGLE_CLIENT_SECRET',
    'google_redirect_uri' => 'https://aapmlayeracademy.id/api/auth/google/callback',
    'admin_emails' => '',
    'ai_settings_encryption_key' => 'REPLACE_WITH_PRODUCTION_KEY_FROM_BIN2HEX_RANDOM_BYTES_32',
    'expose_dev_reset_token' => false,
];
