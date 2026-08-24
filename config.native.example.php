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
    'expose_dev_reset_token' => true,
];
