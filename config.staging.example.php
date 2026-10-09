<?php

// PRIVATE staging configuration template. Copy to the server at
// /home/aapp8359/aapmlayeracademy-staging-config.php (outside public_html),
// replace every REPLACE_ value there, and never commit the filled file.
// The deploy script refuses any value that still starts with REPLACE_.
return [
    'environment' => 'staging',
    'db_driver' => 'mysql',
    'db_host' => '127.0.0.1',
    'db_port' => '3306',
    // A staging-only database and user. Never reuse production credentials.
    'db_name' => 'REPLACE_WITH_STAGING_DATABASE',
    'db_user' => 'REPLACE_WITH_STAGING_DB_USER',
    'db_password' => 'REPLACE_WITH_STAGING_DB_PASSWORD',
    'app_url' => 'https://staging.aapmlayeracademy.id',
    'session_name' => 'aapm_layer_session_staging',
    'mail_from' => 'REPLACE_WITH_STAGING_SENDER_ON_VERIFIED_DOMAIN',
    'mail_host' => '127.0.0.1',
    'mail_port' => 25,
    'google_client_id' => '',
    'google_client_secret' => '',
    'google_redirect_uri' => '',
    'admin_emails' => '',
    'ai_settings_encryption_key' => 'REPLACE_WITH_STAGING_KEY_FROM_BIN2HEX_RANDOM_BYTES_32',
    'expose_dev_reset_token' => false,
];
