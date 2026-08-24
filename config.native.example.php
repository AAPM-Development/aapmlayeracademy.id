<?php

// Copy this file to config.php for local development, or to
// /home/aapp8359/aapmlayeracademy-config.php on cPanel. Keep the real file
// outside git and outside public_html whenever possible.
return [
    'app_env' => 'local',
    'db_driver' => 'sqlite',
    'db_path' => __DIR__ . '/storage/aapmlayeracademy.sqlite',
    'db_host' => '127.0.0.1',
    'db_port' => '3306',
    'db_name' => '',
    'db_user' => '',
    'db_password' => '',
    'session_name' => 'aapm_layer_session',
    'app_url' => 'http://127.0.0.1:8000',
    'mail_from' => '',
    'mail_host' => '127.0.0.1',
    'mail_port' => 25,
    'google_client_id' => '',
    'google_client_secret' => '',
    'google_redirect_uri' => '',
    // Optional direct server secret. Prefer the encrypted Admin → AI Settings
    // flow below for a configurable key. This value always stays outside git.
    'openrouter_api_key' => '',
    // Required only when managing the OpenRouter key from Admin → AI Settings.
    // Generate with: bin2hex(random_bytes(32)) and keep it in this private file.
    'ai_settings_encryption_key' => '',
    // Comma-separated emergency/bootstrap allow-list. Keep real values only in
    // the private config file; a database role of `admin` remains canonical.
    'admin_emails' => '',
    'expose_dev_reset_token' => true,
];
