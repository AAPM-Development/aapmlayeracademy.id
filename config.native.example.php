<?php

// Local development and disposable test configuration only.
// Copy this file to config.php in the repository root (never inside public/).
// Deployed environments use config.staging.example.php or
// config.production.example.php, filled in on the server outside public_html.
// Keep the real file out of git.
return [
    // Required. local and test are the only environments that may use SQLite.
    'environment' => 'local',
    'db_driver' => 'sqlite',
    'db_path' => __DIR__ . '/storage/aapmlayeracademy.sqlite',
    'db_host' => '127.0.0.1',
    'db_port' => '3306',
    'db_name' => '',
    'db_user' => '',
    'db_password' => '',
    // Optional for local work. Set true to exercise the marker check locally.
    'environment_marker_required' => false,
    'session_name' => 'aapm_layer_session',
    'app_url' => 'http://127.0.0.1:8000',
    'mail_from' => '',
    'mail_host' => '127.0.0.1',
    'mail_port' => 25,
    'google_client_id' => '',
    'google_client_secret' => '',
    'google_redirect_uri' => '',
    // Legacy direct OpenRouter secret. Prefer the provider-agnostic encrypted
    // Admin → AI Settings flow below for a configurable key.
    'openrouter_api_key' => '',
    // Optional provider-agnostic private configuration. This overrides Admin
    // settings and always stays outside git. Provider: openrouter,
    // openai-compatible, gemini, or anthropic.
    'ai_provider' => '',
    'ai_api_key' => '',
    'ai_model' => '',
    'ai_base_url' => '',
    'ai_allow_local' => false,
    // Required only when managing provider keys from Admin → AI Settings.
    // Generate with: bin2hex(random_bytes(32)) and keep it in this private file.
    'ai_settings_encryption_key' => '',
    // Comma-separated emergency/bootstrap allow-list. Keep real values only in
    // the private config file; a database role of `admin` remains canonical.
    'admin_emails' => '',
    'expose_dev_reset_token' => true,
];
