<?php
declare(strict_types=1);

// Server-only maintenance entry point. Never accepts a key as an argument.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__, 2) . '/public/api/bootstrap.php';
require_once dirname(__DIR__, 2) . '/public/api/openrouter.php';

try {
    $config = app_config();
    $expected = '';
    foreach ($argv as $arg) if (strpos($arg, '--expect-environment=') === 0) $expected = substr($arg, strlen('--expect-environment='));
    if (in_array('--apply', $argv, true) && $expected !== $config['environment']) {
        throw new RuntimeException('Specify the matching --expect-environment before applying.');
    }
    $status = ai_registry_admin_status();
    if (in_array('--apply', $argv, true)) $status = ai_registry_import_server_openai();
    echo json_encode([
        'environment' => $config['environment'],
        'applied' => in_array('--apply', $argv, true),
        'serverKeyAvailable' => ai_server_openai_key() !== '',
        'encryptionReady' => ai_encryption_key() !== '' && function_exists('openssl_encrypt'),
        'managedByPrivateConfig' => $status['managedByPrivateConfig'],
        'activeProviderId' => $status['activeProviderId'],
        'model' => $status['model'],
        'keyStorage' => $status['keyStorage'],
    ], JSON_UNESCAPED_SLASHES) . PHP_EOL;
} catch (Throwable $exception) {
    fwrite(STDERR, "OpenAI import failed. Check private configuration and encrypted storage. Credentials withheld.\n");
    exit(1);
}
