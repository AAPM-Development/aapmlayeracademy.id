<?php
declare(strict_types=1);

// Provider registry for APPI. The registry deliberately lives in the existing
// app_settings table so SQLite and MySQL deployments stay schema-compatible.
// Only encrypted secrets are persisted; this file never returns credentials.

const AAPM_AI_REGISTRY_SETTING = 'ai_provider_registry';
const AAPM_AI_ACTIVE_PROVIDER_SETTING = 'ai_active_provider_id';

/** A server credential can be imported without ever crossing the browser. */
function ai_server_openai_key(): string
{
    $config = app_config();
    $key = trim((string) ($config['openai_api_key'] ?? ''));
    if ($key !== '') return $key;
    $private = ai_private_config();
    if ($private['provider'] === 'openai-compatible' && rtrim($private['baseUrl'] ?: 'https://api.openai.com/v1', '/') === 'https://api.openai.com/v1') return $private['apiKey'];
    // The Vite env file is read only in the owner's local checkout, never in
    // deployed environments or disposable tests with an explicit config.
    if ($config['environment'] === 'local' && aapm_resolve_config_source()['source'] === 'local_development') {
        $file = dirname(__DIR__, 2) . '/.env.local';
        foreach (is_file($file) ? (file($file, FILE_IGNORE_NEW_LINES) ?: []) : [] as $line) {
            if (preg_match('/^\s*(?:export\s+)?OPENAI_API_KEY\s*=\s*(.*?)\s*$/', $line, $matches)) {
                return trim($matches[1], "\"'");
            }
        }
    }
    return '';
}

function ai_registry_private_override(): bool
{
    return ai_private_config()['provider'] !== '' && app_setting_get('ai_manage_in_admin', '0') !== '1';
}

function ai_registry_import_server_openai(): array
{
    $key = ai_server_openai_key();
    if ($key === '') error_response('Kunci OpenAI belum tersedia di server lingkungan ini.', 422, 'ai_server_key_missing');
    $private = ai_private_config();
    if (ai_registry_private_override() && ($private['provider'] !== 'openai-compatible' || rtrim($private['baseUrl'] ?: 'https://api.openai.com/v1', '/') !== 'https://api.openai.com/v1')) {
        error_response('Konfigurasi privat saat ini mengelola provider lain. Sesuaikan konfigurasi server terlebih dahulu.', 409, 'ai_managed_in_config');
    }
    $pdo = db();
    aapm_tx_begin($pdo);
    try {
        app_setting_set('ai_manage_in_admin', '1');
        $result = ai_registry_save_settings(['config' => [
            'id' => 'openai-server', 'type' => 'openai-compatible', 'label' => 'OpenAI AAPM',
            'baseUrl' => 'https://api.openai.com/v1', 'model' => ($private['provider'] === 'openai-compatible' ? $private['model'] : '') ?: 'gpt-4o-mini',
            'apiKey' => ai_validate_api_key($key), 'activate' => true, 'isDefault' => true,
            'allowLocal' => false, 'authMode' => 'bearer', 'keyRequired' => true,
            'adapter' => 'openai-compatible', 'chatPath' => '/chat/completions', 'modelsPath' => '/models',
        ]]);
        $records = ai_registry_records();
        foreach ($records as &$record) if ($record['id'] === 'openai-server') $record['credentialOrigin'] = 'server_openai';
        unset($record);
        ai_registry_write($records);
        aapm_tx_commit($pdo);
        return $result;
    } catch (Throwable $exception) {
        aapm_tx_rollback($pdo);
        throw $exception;
    }
}

function ai_registry_catalog(): array
{
    return [
        'openrouter' => [
            'label' => 'OpenRouter',
            'description' => 'Gateway multi-model dengan model gratis dan berbayar.',
            'adapter' => 'openai-compatible',
            'defaultModel' => AAPM_AI_DEFAULT_MODEL,
            'baseUrl' => 'https://openrouter.ai/api/v1',
            'keyRequired' => true,
            'freeOnly' => false,
            'supportsLocal' => false,
            'supportsStreaming' => true,
            'supportsVision' => true,
            'authMode' => 'bearer',
        ],
        'openai-compatible' => [
            'label' => 'OpenAI-compatible',
            'description' => 'OpenAI, Groq, Together, Mistral, DeepSeek, vLLM, gateway internal, dan API kompatibel lainnya.',
            'adapter' => 'openai-compatible',
            'defaultModel' => 'gpt-4o-mini',
            'baseUrl' => 'https://api.openai.com/v1',
            'keyRequired' => true,
            'freeOnly' => false,
            'supportsLocal' => true,
            'supportsStreaming' => true,
            'supportsVision' => true,
            'authMode' => 'bearer',
        ],
        'ollama' => [
            'label' => 'Ollama local',
            'description' => 'Ollama yang berjalan di server atau jaringan privat.',
            'adapter' => 'openai-compatible',
            'defaultModel' => 'llama3.2',
            'baseUrl' => 'http://127.0.0.1:11434/v1',
            'keyRequired' => false,
            'freeOnly' => true,
            'supportsLocal' => true,
            'supportsStreaming' => true,
            'supportsVision' => false,
            'authMode' => 'none',
        ],
        'lm-studio' => [
            'label' => 'LM Studio local',
            'description' => 'LM Studio server dengan endpoint OpenAI-compatible.',
            'adapter' => 'openai-compatible',
            'defaultModel' => 'local-model',
            'baseUrl' => 'http://127.0.0.1:1234/v1',
            'keyRequired' => false,
            'freeOnly' => true,
            'supportsLocal' => true,
            'supportsStreaming' => true,
            'supportsVision' => false,
            'authMode' => 'none',
        ],
        'localai' => [
            'label' => 'LocalAI',
            'description' => 'LocalAI atau gateway self-hosted OpenAI-compatible.',
            'adapter' => 'openai-compatible',
            'defaultModel' => 'gpt-4',
            'baseUrl' => 'http://127.0.0.1:8080/v1',
            'keyRequired' => false,
            'freeOnly' => true,
            'supportsLocal' => true,
            'supportsStreaming' => true,
            'supportsVision' => false,
            'authMode' => 'none',
        ],
        'vllm' => [
            'label' => 'vLLM local',
            'description' => 'vLLM server dengan API OpenAI-compatible.',
            'adapter' => 'openai-compatible',
            'defaultModel' => 'local-model',
            'baseUrl' => 'http://127.0.0.1:8000/v1',
            'keyRequired' => false,
            'freeOnly' => true,
            'supportsLocal' => true,
            'supportsStreaming' => true,
            'supportsVision' => false,
            'authMode' => 'none',
        ],
        'gemini' => [
            'label' => 'Google Gemini',
            'description' => 'Google AI Studio / Gemini API native.',
            'adapter' => 'gemini',
            'defaultModel' => 'gemini-2.5-flash',
            'baseUrl' => 'https://generativelanguage.googleapis.com/v1beta',
            'keyRequired' => true,
            'freeOnly' => false,
            'supportsLocal' => false,
            'supportsStreaming' => false,
            'supportsVision' => true,
            'authMode' => 'x-api-key',
        ],
        'anthropic' => [
            'label' => 'Anthropic Claude',
            'description' => 'Anthropic Messages API native.',
            'adapter' => 'anthropic',
            'defaultModel' => 'claude-haiku-4-5',
            'baseUrl' => 'https://api.anthropic.com/v1',
            'keyRequired' => true,
            'freeOnly' => false,
            'supportsLocal' => false,
            'supportsStreaming' => false,
            'supportsVision' => true,
            'authMode' => 'x-api-key',
        ],
        'custom-openai' => [
            'label' => 'Custom OpenAI-compatible',
            'description' => 'Endpoint custom untuk gateway hosted, on-premise, LAN, atau local AI.',
            'adapter' => 'openai-compatible',
            'defaultModel' => 'custom-model',
            'baseUrl' => 'https://example.com/v1',
            'keyRequired' => true,
            'freeOnly' => false,
            'supportsLocal' => true,
            'supportsStreaming' => true,
            'supportsVision' => false,
            'authMode' => 'bearer',
        ],
    ];
}

function ai_registry_definition(string $type): array
{
    $catalog = ai_registry_catalog();
    if (isset($catalog[$type])) return $catalog[$type] + ['type' => $type];
    return $catalog['custom-openai'] + ['type' => 'custom-openai'];
}

function ai_registry_validate_id(string $id): string
{
    $id = strtolower(trim($id));
    $id = preg_replace('/[^a-z0-9_-]+/', '-', $id) ?? '';
    $id = trim($id, '-_');
    if ($id === '') $id = 'provider-' . substr(bin2hex(random_bytes(5)), 0, 10);
    return substr($id, 0, 72);
}

function ai_registry_validate_label(string $label, string $fallback = 'AI provider'): string
{
    $label = trim(preg_replace('/\s+/u', ' ', $label) ?? '');
    if ($label === '') $label = $fallback;
    if (strlen($label) > 100 || preg_match('/[\x00-\x1F\x7F]/', $label)) {
        error_response('Nama koneksi AI maksimal 100 karakter dan tidak boleh memuat karakter kontrol.', 422, 'invalid_ai_provider_label');
    }
    return $label;
}

function ai_registry_validate_model(string $model): string
{
    $model = trim($model);
    if ($model === '' || strlen($model) > 220 || !preg_match('/\A[a-zA-Z0-9][a-zA-Z0-9._:@\/-]*\z/', $model)) {
        error_response('Model ID AI tidak valid.', 422, 'invalid_ai_model');
    }
    return $model;
}

function ai_registry_is_private_host(string $host): bool
{
    $host = strtolower(trim($host, '[]'));
    if ($host === '' || $host === 'localhost' || $host === 'host.docker.internal' || substr($host, -6) === '.local') return true;
    if (strpos($host, '.') === false && !filter_var($host, FILTER_VALIDATE_IP)) return true;
    $ip = filter_var($host, FILTER_VALIDATE_IP);
    if ($ip === false) return false;
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false) {
        $long = ip2long($ip);
        if ($long === false) return false;
        $long = sprintf('%u', $long);
        return ($long >= 167772160 && $long <= 184549375) // 10.0.0.0/8
            || ($long >= 2886729728 && $long <= 2886794751) // 172.16.0.0/12
            || ($long >= 3232235520 && $long <= 3232301055) // 192.168.0.0/16
            || ($long >= 2851995648 && $long <= 2852061183) // 169.254.0.0/16
            || ($long >= 1681915904 && $long <= 1686110207) // 100.64.0.0/10 shared/Tailscale
            || ($long >= 2130706432 && $long <= 2147483647); // 127.0.0.0/8
    }
    return strpos($host, '::1') === 0 || strpos($host, 'fc') === 0 || strpos($host, 'fd') === 0 || strpos($host, 'fe80:') === 0;
}

function ai_registry_normalize_url(string $baseUrl, bool $allowLocal, string $fallback): string
{
    $baseUrl = rtrim(trim($baseUrl ?: $fallback), '/');
    $parts = parse_url($baseUrl);
    $scheme = strtolower((string) ($parts['scheme'] ?? ''));
    $host = (string) ($parts['host'] ?? '');
    if ($baseUrl === '' || strlen($baseUrl) > 500 || !in_array($scheme, ['https', 'http'], true) || $host === '' || isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])) {
        error_response('Base URL harus berupa URL API yang lengkap tanpa query atau credential di URL.', 422, 'invalid_ai_base_url');
    }
    if ($scheme === 'http' && (!$allowLocal || !ai_registry_is_private_host($host))) {
        error_response('HTTP hanya diizinkan untuk endpoint loopback atau jaringan privat setelah opsi local diaktifkan.', 422, 'ai_local_endpoint_required');
    }
    return $baseUrl;
}

function ai_registry_validate_path(string $path, string $fallback): string
{
    $path = trim($path ?: $fallback);
    if ($path === '') $path = $fallback;
    if (strlen($path) > 160 || $path[0] !== '/' || strpos($path, '..') !== false || strpos($path, '?') !== false || strpos($path, '#') !== false) {
        error_response('Path endpoint AI tidak valid.', 422, 'invalid_ai_endpoint_path');
    }
    return $path;
}

function ai_registry_validate_headers($headers): array
{
    if (is_string($headers) && trim($headers) !== '') {
        $decoded = json_decode($headers, true);
        $headers = is_array($decoded) ? $decoded : null;
    }
    if ($headers === null || $headers === '') return [];
    if (!is_array($headers)) error_response('Custom headers harus berupa JSON object.', 422, 'invalid_ai_headers');
    $result = [];
    foreach ($headers as $name => $value) {
        $name = trim((string) $name);
        $value = trim((string) $value);
        if ($name === '' || !preg_match('/\A[A-Za-z0-9-]+\z/', $name) || preg_match('/\A(?:host|cookie|content-length|connection|transfer-encoding)\z/i', $name)) {
            error_response('Nama custom header AI tidak diizinkan.', 422, 'invalid_ai_headers');
        }
        if ($value === '' || strlen($value) > 800 || preg_match('/[\x00-\x1F\x7F]/', $value)) {
            error_response('Nilai custom header AI tidak valid.', 422, 'invalid_ai_headers');
        }
        $result[$name] = $value;
    }
    return array_slice($result, 0, 20, true);
}

function ai_registry_decode_secret(string $encoded): string
{
    return $encoded === '' ? '' : ai_decrypt_secret($encoded);
}

function ai_registry_secret_for_record(array $record): string
{
    if (!empty($record['secret'])) return ai_registry_decode_secret((string) $record['secret']);
    // The legacy default record already carries its scalar secret. A new or
    // cleared registry connection must not inherit another connection's key.
    return '';
}

function ai_registry_default_record(): array
{
    $provider = ai_stored_provider();
    $definition = ai_registry_definition($provider);
    $secret = isset(ai_provider_catalog()[$provider]) ? app_setting_get(ai_secret_setting_key($provider)) : '';
    $baseUrl = $provider === 'openai-compatible' ? app_setting_get('ai_base_url', $definition['baseUrl']) : $definition['baseUrl'];
    $allowLocal = $provider === 'openai-compatible' && app_setting_get('ai_allow_local', '0') === '1';
    $storedModel = trim(app_setting_get('ai_model', $provider === 'openrouter' ? AAPM_AI_DEFAULT_MODEL : $definition['defaultModel']));
    if ($storedModel === '') $storedModel = (string) $definition['defaultModel'];
    return [
        'id' => ai_registry_validate_id($provider),
        'type' => $provider,
        'label' => $provider === 'openai-compatible' ? ai_registry_validate_label(app_setting_get('ai_provider_label'), $definition['label']) : $definition['label'],
        'adapter' => $definition['adapter'],
        'baseUrl' => ai_registry_normalize_url($baseUrl, $allowLocal, $definition['baseUrl']),
        'model' => ai_registry_validate_model($storedModel),
        'enabled' => app_setting_get('ai_enabled', app_setting_get('ai_openrouter_enabled', '1')) !== '0',
        'isDefault' => true,
        'allowLocal' => $allowLocal,
        'authMode' => $definition['authMode'],
        'keyRequired' => (bool) $definition['keyRequired'],
        'supportsStreaming' => (bool) $definition['supportsStreaming'],
        'supportsVision' => (bool) $definition['supportsVision'],
        'chatPath' => '/chat/completions',
        'modelsPath' => '/models',
        'maxTokens' => AAPM_AI_MAX_TOKENS,
        'temperature' => 0.3,
        'timeoutSeconds' => 35,
        'secret' => $secret,
        'headersSecret' => '',
    ];
}

function ai_registry_records(): array
{
    $raw = app_setting_get(AAPM_AI_REGISTRY_SETTING);
    if ($raw === '') return [ai_registry_default_record()];
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) return [ai_registry_default_record()];
    $records = [];
    foreach ($decoded as $record) {
        if (!is_array($record)) continue;
        $type = trim((string) ($record['type'] ?? $record['provider'] ?? 'custom-openai'));
        $definition = ai_registry_definition($type);
        $record['id'] = ai_registry_validate_id((string) ($record['id'] ?? $type));
        $record['type'] = $type;
        $record['label'] = ai_registry_validate_label((string) ($record['label'] ?? ''), $definition['label']);
        $record['adapter'] = in_array((string) ($record['adapter'] ?? ''), ['openai-compatible', 'gemini', 'anthropic'], true) ? (string) $record['adapter'] : $definition['adapter'];
        $record['baseUrl'] = (string) ($record['baseUrl'] ?? $definition['baseUrl']);
        $record['model'] = (string) ($record['model'] ?? $definition['defaultModel']);
        $record['enabled'] = !empty($record['enabled']);
        $record['isDefault'] = !empty($record['isDefault']);
        $record['allowLocal'] = !empty($record['allowLocal']);
        $record['authMode'] = in_array((string) ($record['authMode'] ?? $definition['authMode']), ['bearer', 'x-api-key', 'none'], true) ? (string) ($record['authMode'] ?? $definition['authMode']) : $definition['authMode'];
        $record['keyRequired'] = array_key_exists('keyRequired', $record) ? !empty($record['keyRequired']) : (bool) $definition['keyRequired'];
        $record['supportsStreaming'] = array_key_exists('supportsStreaming', $record) ? !empty($record['supportsStreaming']) : (bool) $definition['supportsStreaming'];
        $record['supportsVision'] = array_key_exists('supportsVision', $record) ? !empty($record['supportsVision']) : (bool) $definition['supportsVision'];
        $record['chatPath'] = (string) ($record['chatPath'] ?? '/chat/completions');
        $record['modelsPath'] = (string) ($record['modelsPath'] ?? '/models');
        $record['maxTokens'] = max(64, min(8192, (int) ($record['maxTokens'] ?? AAPM_AI_MAX_TOKENS)));
        $record['temperature'] = max(0, min(2, (float) ($record['temperature'] ?? 0.3)));
        $record['timeoutSeconds'] = max(8, min(120, (int) ($record['timeoutSeconds'] ?? 35)));
        $record['secret'] = (string) ($record['secret'] ?? '');
        $record['headersSecret'] = (string) ($record['headersSecret'] ?? '');
        $records[] = $record;
    }
    return $records;
}

function ai_registry_write(array $records): void
{
    $json = json_encode(array_values($records), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    if (!is_string($json)) throw new RuntimeException('Registry provider AI tidak dapat disimpan.');
    app_setting_set(AAPM_AI_REGISTRY_SETTING, $json);
}

function ai_registry_active_id(array $records): string
{
    $stored = trim(app_setting_get(AAPM_AI_ACTIVE_PROVIDER_SETTING));
    foreach ($records as $record) if ((string) ($record['id'] ?? '') === $stored) return $stored;
    foreach ($records as $record) if (!empty($record['isDefault'])) return (string) $record['id'];
    foreach ($records as $record) if (!empty($record['enabled'])) return (string) $record['id'];
    return isset($records[0]) ? (string) $records[0]['id'] : '';
}

function ai_registry_record_settings(array $record, ?string $privateApiKey = null, bool $private = false): array
{
    $definition = ai_registry_definition((string) $record['type']);
    $adapter = (string) ($record['adapter'] ?? $definition['adapter']);
    $baseUrl = ai_registry_normalize_url((string) ($record['baseUrl'] ?? $definition['baseUrl']), !empty($record['allowLocal']), $definition['baseUrl']);
    $model = ai_registry_validate_model((string) ($record['model'] ?? $definition['defaultModel']));
    $apiKey = $privateApiKey !== null ? $privateApiKey : ai_registry_secret_for_record($record);
    $authMode = (string) ($record['authMode'] ?? $definition['authMode']);
    $keyRequired = $authMode === 'none' ? false : !empty($record['keyRequired']);
    $headers = [];
    if (!empty($record['headersSecret'])) {
        $decoded = json_decode(ai_registry_decode_secret((string) $record['headersSecret']), true);
        if (is_array($decoded)) $headers = ai_registry_validate_headers($decoded);
    }
    return [
        'provider' => (string) $record['type'],
        'providerType' => (string) $record['type'],
        'providerId' => (string) $record['id'],
        'providerLabel' => (string) $record['label'],
        'adapter' => $adapter,
        'enabled' => !empty($record['enabled']),
        'model' => $model,
        'baseUrl' => $baseUrl,
        'allowLocal' => !empty($record['allowLocal']),
        'freeOnly' => (bool) ($definition['freeOnly'] ?? false),
        'supportsLocal' => (bool) ($definition['supportsLocal'] ?? false),
        'supportsStreaming' => !empty($record['supportsStreaming']),
        'supportsVision' => !empty($record['supportsVision']),
        'apiKeyRequired' => $keyRequired,
        'apiKeyConfigured' => $apiKey !== '' || !$keyRequired,
        'keyStorage' => $private ? 'private_config' : ($apiKey !== '' ? 'encrypted_database' : 'not_configured'),
        'encryptionReady' => $private || (ai_encryption_key() !== '' && function_exists('openssl_encrypt')),
        'authMode' => $authMode,
        'chatPath' => (string) ($record['chatPath'] ?? '/chat/completions'),
        'modelsPath' => (string) ($record['modelsPath'] ?? '/models'),
        'maxTokens' => max(64, min(8192, (int) ($record['maxTokens'] ?? AAPM_AI_MAX_TOKENS))),
        'temperature' => max(0, min(2, (float) ($record['temperature'] ?? 0.3))),
        'timeoutSeconds' => max(8, min(120, (int) ($record['timeoutSeconds'] ?? 35))),
        '_extraHeaders' => $headers,
        '_private' => $private,
    ];
}

function ai_registry_public_provider(array $record, string $activeId = '', ?string $privateApiKey = null, bool $private = false): array
{
    $settings = ai_registry_record_settings($record, $privateApiKey, $private);
    return [
        'id' => $record['id'],
        'type' => $record['type'],
        'label' => $record['label'],
        'adapter' => $settings['adapter'],
        'baseUrl' => $settings['baseUrl'],
        'model' => $settings['model'],
        'enabled' => $settings['enabled'],
        'isDefault' => !empty($record['isDefault']),
        'isActive' => (string) $record['id'] === $activeId,
        'allowLocal' => $settings['allowLocal'],
        'supportsStreaming' => $settings['supportsStreaming'],
        'supportsVision' => $settings['supportsVision'],
        'apiKeyRequired' => $settings['apiKeyRequired'],
        'apiKeyConfigured' => $settings['apiKeyConfigured'],
        'keyStorage' => $settings['keyStorage'],
        'encryptionReady' => $settings['encryptionReady'],
        'authMode' => $settings['authMode'],
        'chatPath' => $settings['chatPath'],
        'modelsPath' => $settings['modelsPath'],
        'maxTokens' => $settings['maxTokens'],
        'temperature' => $settings['temperature'],
        'timeoutSeconds' => $settings['timeoutSeconds'],
    ];
}

function ai_registry_presets(): array
{
    $presets = [];
    foreach (ai_registry_catalog() as $type => $definition) {
        $presets[] = [
            'type' => $type,
            'label' => $definition['label'],
            'description' => $definition['description'],
            'adapter' => $definition['adapter'],
            'baseUrl' => $definition['baseUrl'],
            'model' => $definition['defaultModel'],
            'keyRequired' => (bool) $definition['keyRequired'],
            'supportsLocal' => (bool) $definition['supportsLocal'],
            'supportsStreaming' => (bool) $definition['supportsStreaming'],
            'supportsVision' => (bool) $definition['supportsVision'],
            'authMode' => $definition['authMode'],
        ];
    }
    return $presets;
}

function ai_registry_runtime_status(): array
{
    $private = ai_private_config();
    if (ai_registry_private_override()) {
        $definition = ai_registry_definition($private['provider']);
        $record = [
            'id' => 'private-config',
            'type' => $private['provider'],
            'label' => $definition['label'],
            'adapter' => $definition['adapter'],
            'baseUrl' => $private['baseUrl'] !== '' ? $private['baseUrl'] : $definition['baseUrl'],
            'model' => $private['model'] !== '' ? $private['model'] : $definition['defaultModel'],
            'enabled' => true,
            'allowLocal' => $private['allowLocal'],
            'authMode' => $definition['authMode'],
            'keyRequired' => (bool) $definition['keyRequired'],
            'supportsStreaming' => (bool) $definition['supportsStreaming'],
            'supportsVision' => (bool) $definition['supportsVision'],
            'chatPath' => '/chat/completions',
            'modelsPath' => '/models',
            'maxTokens' => AAPM_AI_MAX_TOKENS,
            'temperature' => 0.3,
            'timeoutSeconds' => 35,
            'secret' => '',
            'headersSecret' => '',
        ];
        return ai_registry_record_settings($record, $private['apiKey'], true) + [
            'activeProviderId' => 'private-config',
            'managedByPrivateConfig' => true,
            'providers' => [ai_registry_public_provider($record, 'private-config', $private['apiKey'], true)],
            'presets' => ai_registry_presets(),
        ];
    }

    $records = ai_registry_records();
    $activeId = ai_registry_active_id($records);
    $active = null;
    foreach ($records as $record) if ((string) $record['id'] === $activeId) $active = $record;
    if ($active === null) {
        $active = ai_registry_default_record();
        $active['id'] = 'fallback';
    }
    return ai_registry_record_settings($active) + [
        'activeProviderId' => $activeId,
        'managedByPrivateConfig' => false,
        'providers' => array_map(static fn (array $record): array => ai_registry_public_provider($record, $activeId), $records),
        'presets' => ai_registry_presets(),
    ];
}

function ai_registry_admin_status(): array
{
    $status = ai_registry_runtime_status();
    unset($status['_extraHeaders'], $status['_private']);
    $status['serverOpenAiKeyAvailable'] = ai_server_openai_key() !== '';
    $status['serverKeyEncryptionReady'] = ai_encryption_key() !== '' && function_exists('openssl_encrypt');
    return $status;
}

function ai_registry_find(array $records, string $id): ?array
{
    foreach ($records as $record) if ((string) ($record['id'] ?? '') === $id) return $record;
    return null;
}

function ai_registry_build_record(array $input, ?array $existing = null, bool $persistSecrets = true): array
{
    $type = trim((string) ($input['type'] ?? $input['providerType'] ?? $input['provider'] ?? ($existing['type'] ?? 'custom-openai')));
    $definition = ai_registry_definition($type);
    if (!isset(ai_registry_catalog()[$type])) $type = 'custom-openai';
    $label = ai_registry_validate_label((string) ($input['label'] ?? ($input['providerLabel'] ?? ($existing['label'] ?? ''))), $definition['label']);
    $inputId = trim((string) ($input['id'] ?? ''));
    $id = $inputId !== '' ? ai_registry_validate_id($inputId) : ($existing ? (string) $existing['id'] : ai_registry_validate_id('provider-' . substr(bin2hex(random_bytes(5)), 0, 10)));
    $allowLocal = bool_value($input['allowLocal'] ?? ($existing['allowLocal'] ?? false)) === 1;
    $baseUrl = ai_registry_normalize_url((string) ($input['baseUrl'] ?? ($existing['baseUrl'] ?? $definition['baseUrl'])), $allowLocal, $definition['baseUrl']);
    $origin = (string) ($existing['credentialOrigin'] ?? '');
    if ($origin === 'server_openai' && $baseUrl !== 'https://api.openai.com/v1' && empty($input['clearApiKey']) && trim((string) ($input['apiKey'] ?? '')) === '') {
        error_response('Kunci OpenAI server hanya dapat digunakan pada endpoint resmi OpenAI. Hapus atau ganti kunci sebelum mengganti endpoint.', 422, 'ai_server_key_endpoint');
    }
    $model = ai_registry_validate_model((string) ($input['model'] ?? ($existing['model'] ?? $definition['defaultModel'])));
    $authMode = trim((string) ($input['authMode'] ?? ($existing['authMode'] ?? $definition['authMode'])));
    if (!in_array($authMode, ['bearer', 'x-api-key', 'none'], true)) error_response('Metode autentikasi AI tidak valid.', 422, 'invalid_ai_auth_mode');
    $keyRequired = array_key_exists('keyRequired', $input) ? bool_value($input['keyRequired']) === 1 : (array_key_exists('keyRequired', $existing ?? []) ? !empty($existing['keyRequired']) : (bool) $definition['keyRequired']);
    if ($authMode === 'none') $keyRequired = false;
    $record = [
        'id' => $id,
        'type' => $type,
        'label' => $label,
        'adapter' => in_array((string) ($input['adapter'] ?? ($existing['adapter'] ?? $definition['adapter'])), ['openai-compatible', 'gemini', 'anthropic'], true) ? (string) ($input['adapter'] ?? ($existing['adapter'] ?? $definition['adapter'])) : $definition['adapter'],
        'baseUrl' => $baseUrl,
        'model' => $model,
        'enabled' => bool_value($input['enabled'] ?? ($existing['enabled'] ?? true)) === 1,
        'isDefault' => bool_value($input['isDefault'] ?? ($existing['isDefault'] ?? false)) === 1,
        'allowLocal' => $allowLocal,
        'authMode' => $authMode,
        'keyRequired' => $keyRequired,
        'supportsStreaming' => bool_value($input['supportsStreaming'] ?? ($existing['supportsStreaming'] ?? $definition['supportsStreaming'])) === 1,
        'supportsVision' => bool_value($input['supportsVision'] ?? ($existing['supportsVision'] ?? $definition['supportsVision'])) === 1,
        'chatPath' => ai_registry_validate_path((string) ($input['chatPath'] ?? ($existing['chatPath'] ?? '/chat/completions')), '/chat/completions'),
        'modelsPath' => ai_registry_validate_path((string) ($input['modelsPath'] ?? ($existing['modelsPath'] ?? '/models')), '/models'),
        'maxTokens' => max(64, min(8192, (int) ($input['maxTokens'] ?? ($existing['maxTokens'] ?? AAPM_AI_MAX_TOKENS)))),
        'temperature' => max(0, min(2, (float) ($input['temperature'] ?? ($existing['temperature'] ?? 0.3)))),
        'timeoutSeconds' => max(8, min(120, (int) ($input['timeoutSeconds'] ?? ($existing['timeoutSeconds'] ?? 35)))),
        'secret' => (string) ($existing['secret'] ?? ''),
        'headersSecret' => (string) ($existing['headersSecret'] ?? ''),
        'credentialOrigin' => (!empty($input['clearApiKey']) || trim((string) ($input['apiKey'] ?? '')) !== '') ? '' : $origin,
    ];
    if ($persistSecrets && array_key_exists('apiKey', $input) && trim((string) $input['apiKey']) !== '') {
        $record['secret'] = ai_encrypt_secret(ai_validate_api_key((string) $input['apiKey']));
    } elseif ($persistSecrets && !empty($input['clearApiKey'])) {
        $record['secret'] = '';
    }
    if ($persistSecrets && array_key_exists('headers', $input)) {
        $headers = ai_registry_validate_headers($input['headers']);
        $record['headersSecret'] = $headers ? ai_encrypt_secret((string) json_encode($headers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) : '';
    }
    return $record;
}

function ai_registry_save_settings(array $input): array
{
    $action = trim((string) ($input['action'] ?? 'saveProvider'));
    if ($action === 'importServerOpenAi') return ai_registry_import_server_openai();
    if (ai_registry_private_override()) error_response('Provider dikelola dari konfigurasi server privat dan tidak dapat ditimpa dari Admin.', 409, 'ai_managed_in_config');
    $records = ai_registry_records();
    if ($action === 'setActive') {
        $id = ai_registry_validate_id((string) ($input['providerId'] ?? ''));
        if (!ai_registry_find($records, $id)) error_response('Provider AI tidak ditemukan.', 404, 'ai_provider_not_found');
        app_setting_set(AAPM_AI_ACTIVE_PROVIDER_SETTING, $id);
        return ai_registry_admin_status();
    }
    if ($action === 'deleteProvider') {
        $id = ai_registry_validate_id((string) ($input['providerId'] ?? ''));
        $next = array_values(array_filter($records, static fn (array $record): bool => (string) ($record['id'] ?? '') !== $id));
        if (count($next) === count($records)) error_response('Provider AI tidak ditemukan.', 404, 'ai_provider_not_found');
        ai_registry_write($next);
        $active = ai_registry_active_id($next);
        app_setting_set(AAPM_AI_ACTIVE_PROVIDER_SETTING, $active);
        return ai_registry_admin_status();
    }

    $config = is_array($input['config'] ?? null) ? $input['config'] : $input;
    $id = trim((string) ($config['id'] ?? ''));
    $existing = $id !== '' ? ai_registry_find($records, $id) : null;
    $record = ai_registry_build_record($config, $existing);
    $replaced = false;
    foreach ($records as $index => $candidate) {
        if ((string) ($candidate['id'] ?? '') === (string) $record['id']) {
            $records[$index] = $record;
            $replaced = true;
            break;
        }
    }
    if (!$replaced) $records[] = $record;
    $activate = bool_value($config['activate'] ?? ($config['isDefault'] ?? !$replaced)) === 1;
    if ($activate || count($records) === 1) {
        foreach ($records as &$candidate) $candidate['isDefault'] = (string) $candidate['id'] === (string) $record['id'];
        unset($candidate);
        app_setting_set(AAPM_AI_ACTIVE_PROVIDER_SETTING, (string) $record['id']);
    } elseif ($replaced && ai_registry_active_id($records) === '') {
        app_setting_set(AAPM_AI_ACTIVE_PROVIDER_SETTING, (string) $record['id']);
    }
    ai_registry_write($records);

    // Keep the old scalar keys in sync for older deployed artifacts during a
    // rolling cPanel update. The registry remains the source of truth.
    if (isset(ai_provider_catalog()[(string) $record['type']])) {
        app_setting_set('ai_provider', (string) $record['type']);
        app_setting_set('ai_model', (string) $record['model']);
        app_setting_set('ai_enabled', !empty($record['enabled']) ? '1' : '0');
        if ((string) $record['type'] === 'openai-compatible') {
            app_setting_set('ai_base_url', (string) $record['baseUrl']);
            app_setting_set('ai_allow_local', !empty($record['allowLocal']) ? '1' : '0');
            app_setting_set('ai_provider_label', (string) $record['label']);
        }
        if (!empty($record['secret'])) app_setting_set(ai_secret_setting_key((string) $record['type']), (string) $record['secret']);
    }
    return ai_registry_admin_status();
}

function ai_registry_api_key(array $settings): string
{
    if (array_key_exists('_userApiKey', $settings)) return (string) $settings['_userApiKey'];
    if (!empty($settings['_private'])) return (string) (ai_private_config()['apiKey'] ?? '');
    $records = ai_registry_records();
    $record = ai_registry_find($records, (string) ($settings['providerId'] ?? ai_registry_active_id($records)));
    return $record ? ai_registry_secret_for_record($record) : '';
}

function ai_registry_auth_headers(array $settings, string $apiKey): array
{
    $headers = [];
    $mode = (string) ($settings['authMode'] ?? 'bearer');
    if ($apiKey !== '' && $mode === 'bearer') $headers[] = 'Authorization: Bearer ' . $apiKey;
    if ($apiKey !== '' && $mode === 'x-api-key') $headers[] = 'X-API-Key: ' . $apiKey;
    foreach (($settings['_extraHeaders'] ?? []) as $name => $value) $headers[] = $name . ': ' . $value;
    if (($settings['provider'] ?? '') === 'openrouter') {
        $headers[] = 'X-OpenRouter-Title: AAPM Layer Academy';
        $origin = app_base_url();
        if ($origin !== '') $headers[] = 'HTTP-Referer: ' . $origin;
    }
    return $headers;
}

function ai_registry_extra_header_lines(array $settings): array
{
    $lines = [];
    foreach (($settings['_extraHeaders'] ?? []) as $name => $value) {
        $lines[] = (string) $name . ': ' . (string) $value;
    }
    return $lines;
}

function ai_registry_http_get_json(string $url, array $headers, string $providerLabel, int $timeoutSeconds = 35): array
{
    if (!function_exists('curl_init')) throw new RuntimeException('Ekstensi cURL PHP diperlukan untuk menghubungkan provider AI.');
    $handle = curl_init($url);
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => max(8, min(120, $timeoutSeconds)),
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_USERAGENT => 'AAPM-Layer-Academy/1.0',
        CURLOPT_HTTPHEADER => array_merge(['Accept: application/json'], $headers),
        CURLOPT_HTTPGET => true,
    ]);
    $body = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
    $error = curl_error($handle);
    curl_close($handle);
    $decoded = is_string($body) ? json_decode($body, true) : null;
    if ($status < 200 || $status >= 300 || !is_array($decoded)) {
        throw new RuntimeException($providerLabel . ': ' . ai_registry_provider_error_message($decoded, $error !== '' ? $error : 'endpoint model tidak merespons dengan sukses', $status));
    }
    return $decoded;
}

/**
 * Keep provider failures actionable without echoing request credentials.
 * OpenRouter often returns the deliberately generic "Provider returned error"
 * message and puts the useful upstream reason in error.metadata.raw. Surface
 * that reason to admins so a bad model/parameter and an upstream outage can be
 * distinguished from one another.
 */
function ai_registry_provider_error_message($decoded, string $fallback, int $status = 0): string
{
    $error = is_array($decoded) && is_array($decoded['error'] ?? null) ? $decoded['error'] : [];
    $message = trim((string) ($error['message'] ?? (is_array($decoded) ? ($decoded['message'] ?? '') : '')));
    $metadata = is_array($error['metadata'] ?? null) ? $error['metadata'] : [];
    $raw = $metadata['raw'] ?? ($metadata['provider_message'] ?? ($metadata['reason'] ?? ''));
    if (is_array($raw)) {
        $raw = json_encode($raw, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE) ?: '';
    }
    $raw = trim((string) $raw);
    if ($raw !== '' && strcasecmp($message, 'Provider returned error') === 0) {
        $message .= ': ' . $raw;
    }
    if ($message === '') $message = trim($fallback);
    if ($status >= 400 && !preg_match('/\bHTTP\s*\d{3}\b/i', $message)) {
        $message .= ' (HTTP ' . $status . ')';
    }

    // Metadata is provider-controlled. Redact common credential forms before
    // the message reaches the admin toast or application error log.
    $message = preg_replace('/\b(?:sk-or-v1|sk-[A-Za-z0-9_-]+|AIza)[A-Za-z0-9._-]*/i', '[credential disamarkan]', $message) ?? $message;
    return substr(trim($message), 0, 260);
}

function ai_registry_provider_error_retryable(RuntimeException $exception): bool
{
    $message = strtolower($exception->getMessage());
    return (bool) preg_match('/provider returned error|http\s*(?:408|425|429|500|502|503|504)|timed?\s*out|temporarily rate[- ]limited|upstream/', $message);
}

function ai_registry_resolve_test_settings(array $input): array
{
    $config = is_array($input['config'] ?? null) ? $input['config'] : null;
    if ($config !== null) {
        // Preserve an existing provider credential when model discovery runs
        // before the admin saves the current form. A blank browser field means
        // preserve, not remove.
        $existing = null;
        $configId = trim((string) ($config['id'] ?? ''));
        if ($configId !== '') {
            $existing = ai_registry_find(ai_registry_records(), ai_registry_validate_id($configId));
        }
        // Test settings are never saved: nothing is encrypted here. A typed key
        // is used for this request only; a blank field keeps the stored key.
        $record = ai_registry_build_record($config, $existing, false);
        $typedKey = array_key_exists('apiKey', $config) ? trim((string) $config['apiKey']) : '';
        $settings = ai_registry_record_settings($record, $typedKey !== '' ? $typedKey : null);
        if ($typedKey !== '') $settings['_testApiKey'] = $typedKey;
        if (array_key_exists('headers', $config)) $settings['_extraHeaders'] = ai_registry_validate_headers($config['headers']);
        return $settings;
    }
    if (!empty($input['providerId'])) {
        $record = ai_registry_find(ai_registry_records(), ai_registry_validate_id((string) $input['providerId']));
        if (!$record) error_response('Provider AI tidak ditemukan.', 404, 'ai_provider_not_found');
        return ai_registry_record_settings($record);
    }
    return ai_registry_runtime_status();
}

function ai_registry_test_connection(array $input = []): array
{
    $settings = ai_registry_resolve_test_settings($input);
    $apiKey = array_key_exists('_testApiKey', $settings) ? (string) $settings['_testApiKey'] : ai_registry_api_key($settings);
    if (!$settings['enabled']) error_response('Aktifkan provider AI sebelum menjalankan test.', 422, 'ai_disabled');
    if ($settings['apiKeyRequired'] && $apiKey === '') error_response('Simpan API key untuk provider ini terlebih dahulu.', 422, 'ai_key_missing');
    for ($attempt = 0; $attempt < 2; $attempt += 1) {
        try {
            $reply = ai_provider_completion($settings, $apiKey, 'Anda adalah service test. Jawab persis dengan: AAPM AI siap.', 'Jalankan pemeriksaan koneksi.');
            break;
        } catch (RuntimeException $exception) {
            if ($attempt === 0 && ai_registry_provider_error_retryable($exception)) {
                // Free provider pools can be briefly saturated. A single short
                // retry improves the admin test without hiding a persistent
                // invalid key/model or turning the endpoint into a retry loop.
                usleep(250000);
                continue;
            }
            error_response('Koneksi provider gagal: ' . ai_provider_test_error($exception), 502, 'ai_provider_unavailable');
        }
    }
    return ['ok' => true, 'providerId' => $settings['providerId'], 'provider' => $settings['provider'], 'providerLabel' => $settings['providerLabel'], 'model' => $settings['model'], 'reply' => $reply];
}

function ai_registry_discover_models(array $input = []): array
{
    $settings = ai_registry_resolve_test_settings($input);
    $apiKey = array_key_exists('_testApiKey', $settings) ? (string) $settings['_testApiKey'] : ai_registry_api_key($settings);
    if ($settings['apiKeyRequired'] && $apiKey === '') error_response('Simpan API key untuk menemukan model provider ini.', 422, 'ai_key_missing');
    if ($settings['adapter'] === 'anthropic') return ['providerId' => $settings['providerId'], 'models' => [], 'note' => 'Anthropic tidak menyediakan endpoint discovery model universal. Masukkan Model ID dari dokumentasinya.'];
    $url = rtrim((string) $settings['baseUrl'], '/') . (string) $settings['modelsPath'];
    try {
        $decoded = $settings['adapter'] === 'gemini'
            ? ai_registry_http_get_json($url, array_merge(['x-goog-api-key: ' . $apiKey], ai_registry_extra_header_lines($settings)), $settings['providerLabel'], $settings['timeoutSeconds'])
            : ai_registry_http_get_json($url, ai_registry_auth_headers($settings, $apiKey), $settings['providerLabel'], $settings['timeoutSeconds']);
    } catch (RuntimeException $exception) {
        error_response('Discovery model gagal: ' . ai_provider_test_error($exception), 502, 'ai_provider_unavailable');
    }
    $models = [];
    $items = $settings['adapter'] === 'gemini' ? ($decoded['models'] ?? []) : ($decoded['data'] ?? ($decoded['models'] ?? []));
    foreach (is_array($items) ? $items : [] as $item) {
        if (is_string($item)) $id = $item;
        elseif (is_array($item)) $id = (string) ($item['id'] ?? $item['name'] ?? '');
        else $id = '';
        $id = preg_replace('/^models\//', '', trim($id)) ?? '';
        if ($id !== '' && preg_match('/\A[a-zA-Z0-9][a-zA-Z0-9._:@\/-]*\z/', $id)) $models[$id] = ['id' => $id, 'label' => $id];
    }
    return ['providerId' => $settings['providerId'], 'models' => array_values(array_slice($models, 0, 160, true)), 'note' => $models ? 'Model berhasil dibaca dari endpoint provider.' : 'Endpoint merespons, tetapi tidak mengirim daftar model yang dikenali.'];
}

function ai_user_ai_row(int $userId): ?array
{
    if ($userId < 1) return null;
    $statement = db()->prepare('SELECT * FROM user_ai_settings WHERE user_id = ? LIMIT 1');
    $statement->execute([$userId]);
    $row = $statement->fetch();
    return is_array($row) ? $row : null;
}

function ai_user_ai_public_settings(int $userId): array
{
    $global = ai_registry_admin_status();
    $row = ai_user_ai_row($userId);
    $providers = [];
    foreach (($global['providers'] ?? []) as $provider) {
        $providers[] = [
            'id' => $provider['id'],
            'type' => $provider['type'],
            'label' => $provider['label'],
            'model' => $provider['model'],
            'enabled' => $provider['enabled'],
            'isDefault' => $provider['isDefault'],
            'isActive' => $provider['isActive'],
            'supportsStreaming' => $provider['supportsStreaming'],
            'supportsVision' => $provider['supportsVision'],
        ];
    }
    return [
        'mode' => (string) ($row['mode'] ?? 'global'),
        'providerId' => (string) ($row['provider_id'] ?? ''),
        'model' => (string) ($row['model'] ?? ''),
        'enabled' => !isset($row['enabled']) || !empty($row['enabled']),
        'apiKeyConfigured' => !empty($row['api_key_encrypted']),
        'oauthProvider' => (string) ($row['oauth_provider'] ?? ''),
        'oauthConfigured' => !empty($row['oauth_refresh_token_encrypted']) || !empty($row['oauth_access_token_encrypted']),
        'globalProviderId' => (string) ($global['activeProviderId'] ?? ''),
        'globalProviderLabel' => (string) ($global['providerLabel'] ?? 'AAPM Provider'),
        'globalModel' => (string) ($global['model'] ?? ''),
        'customBaseUrl' => (string) ($row['base_url'] ?? ''),
        'customAuthMode' => (string) ($row['auth_mode'] ?? 'bearer'),
        'customAllowLocal' => !empty($row['allow_local']),
        'customSupportsVision' => !empty($row['supports_vision']),
        'globalProviders' => $providers,
        'localModeAvailable' => true,
        'note' => 'Global AAPM Provider adalah default. Override akun hanya berlaku untuk akun ini.',
    ];
}

function ai_user_ai_runtime_status(int $userId): array
{
    $global = ai_registry_runtime_status();
    $row = ai_user_ai_row($userId);
    if (!$row || (string) ($row['mode'] ?? 'global') === 'global') {
        $global['accountMode'] = 'global';
        return $global;
    }

    $mode = (string) ($row['mode'] ?? 'global');
    $settings = null;
    if ($mode === 'provider') {
        $record = ai_registry_find(ai_registry_records(), (string) ($row['provider_id'] ?? ''));
        if ($record) $settings = ai_registry_record_settings($record);
    } elseif ($mode === 'custom') {
        $record = [
            'id' => 'account-' . $userId,
            'type' => 'custom-openai',
            'label' => 'Provider akun',
            'adapter' => (string) ($row['adapter'] ?? 'openai-compatible'),
            'baseUrl' => (string) ($row['base_url'] ?? ''),
            'model' => (string) ($row['model'] ?? 'custom-model'),
            'enabled' => !empty($row['enabled']),
            'allowLocal' => !empty($row['allow_local']),
            'authMode' => (string) ($row['auth_mode'] ?? 'bearer'),
            'keyRequired' => true,
            'supportsStreaming' => true,
            'supportsVision' => !empty($row['supports_vision']),
            'chatPath' => '/chat/completions',
            'modelsPath' => '/models',
            'maxTokens' => AAPM_AI_MAX_TOKENS,
            'temperature' => 0.3,
            'timeoutSeconds' => 35,
            'secret' => (string) ($row['api_key_encrypted'] ?? ''),
            'headersSecret' => (string) ($row['headers_encrypted'] ?? ''),
        ];
        $settings = ai_registry_record_settings($record);
        $settings['_userApiKey'] = ai_registry_decode_secret((string) ($row['api_key_encrypted'] ?? ''));
    }

    if (!$settings) {
        $global['accountMode'] = 'global';
        $global['accountNotice'] = 'Konfigurasi akun tidak lagi tersedia; APPI kembali ke provider global.';
        return $global;
    }
    if (trim((string) ($row['model'] ?? '')) !== '') $settings['model'] = ai_registry_validate_model((string) $row['model']);
    $settings['accountMode'] = $mode;
    $settings['accountProviderId'] = (string) ($row['provider_id'] ?? '');
    $settings['accountApiKeyConfigured'] = !empty($row['api_key_encrypted']);
    $settings['accountOAuthProvider'] = (string) ($row['oauth_provider'] ?? '');
    return $settings;
}

function ai_user_ai_save(int $userId, array $input): array
{
    if ($userId < 1) error_response('Akun tidak valid.', 401, 'unauthorized');
    $mode = trim((string) ($input['mode'] ?? 'global'));
    if (!in_array($mode, ['global', 'provider', 'custom'], true)) error_response('Mode provider akun tidak valid.', 422, 'invalid_ai_account_mode');
    $existing = ai_user_ai_row($userId) ?: [];
    $providerId = trim((string) ($input['providerId'] ?? ''));
    $model = trim((string) ($input['model'] ?? ''));
    $adapter = 'openai-compatible';
    $baseUrl = '';
    $authMode = 'bearer';
    $allowLocal = bool_value($input['allowLocal'] ?? false) === 1;
    $supportsVision = bool_value($input['supportsVision'] ?? ($existing['supports_vision'] ?? false)) === 1;
    $apiKeyEncrypted = (string) ($existing['api_key_encrypted'] ?? '');
    $headersEncrypted = (string) ($existing['headers_encrypted'] ?? '');

    if ($mode === 'provider') {
        $record = ai_registry_find(ai_registry_records(), ai_registry_validate_id($providerId));
        if (!$record) error_response('Provider global yang dipilih tidak tersedia.', 404, 'ai_provider_not_found');
        $providerId = (string) $record['id'];
        $adapter = (string) $record['adapter'];
        $baseUrl = (string) $record['baseUrl'];
        $authMode = (string) $record['authMode'];
        if ($model !== '') $model = ai_registry_validate_model($model);
        $apiKeyEncrypted = '';
        $headersEncrypted = '';
    } elseif ($mode === 'custom') {
        if (trim((string) ($input['baseUrl'] ?? '')) === '') error_response('Base URL provider akun wajib diisi.', 422, 'invalid_ai_base_url');
        $custom = ai_registry_build_record([
            'id' => 'account-' . $userId,
            'type' => 'custom-openai',
            'label' => 'Provider akun',
            'adapter' => 'openai-compatible',
            'baseUrl' => $input['baseUrl'] ?? '',
            'model' => $model !== '' ? $model : 'custom-model',
            'allowLocal' => $allowLocal,
            'authMode' => $input['authMode'] ?? 'bearer',
            'supportsStreaming' => true,
            'supportsVision' => $supportsVision,
            'apiKey' => $input['apiKey'] ?? '',
            'headers' => $input['headers'] ?? [],
        ]);
        $providerId = '';
        $adapter = (string) $custom['adapter'];
        $baseUrl = (string) $custom['baseUrl'];
        $model = (string) $custom['model'];
        $authMode = (string) $custom['authMode'];
        $apiKeyEncrypted = (string) $custom['secret'];
        $headersEncrypted = (string) $custom['headersSecret'];
        if ($apiKeyEncrypted === '' && !empty($existing['api_key_encrypted'])) $apiKeyEncrypted = (string) $existing['api_key_encrypted'];
        if (array_key_exists('clearApiKey', $input) && !empty($input['clearApiKey'])) $apiKeyEncrypted = '';
    } else {
        $providerId = '';
        $model = $model === '' ? '' : ai_registry_validate_model($model);
        $apiKeyEncrypted = '';
        $headersEncrypted = '';
    }

    $enabled = bool_value($input['enabled'] ?? true) ? 1 : 0;
    $oauthProvider = trim((string) ($input['oauthProvider'] ?? ($existing['oauth_provider'] ?? '')));
    if ($oauthProvider !== '' && !preg_match('/\A[a-z0-9._-]{1,80}\z/i', $oauthProvider)) error_response('OAuth provider tidak valid.', 422, 'invalid_ai_oauth_provider');
    $oauthAccess = (string) ($existing['oauth_access_token_encrypted'] ?? '');
    $oauthRefresh = (string) ($existing['oauth_refresh_token_encrypted'] ?? '');
    if (!empty($input['oauthAccessToken'])) $oauthAccess = ai_encrypt_secret((string) $input['oauthAccessToken']);
    if (!empty($input['oauthRefreshToken'])) $oauthRefresh = ai_encrypt_secret((string) $input['oauthRefreshToken']);

    $exists = db()->prepare('SELECT user_id FROM user_ai_settings WHERE user_id = ? LIMIT 1');
    $exists->execute([$userId]);
    $values = [$mode, $providerId, $model, $baseUrl, $adapter, $authMode, $apiKeyEncrypted, $headersEncrypted, $oauthProvider, $oauthAccess, $oauthRefresh, $allowLocal ? 1 : 0, $supportsVision ? 1 : 0, $enabled, $userId];
    if ($exists->fetch()) {
        db()->prepare('UPDATE user_ai_settings SET mode = ?, provider_id = ?, model = ?, base_url = ?, adapter = ?, auth_mode = ?, api_key_encrypted = ?, headers_encrypted = ?, oauth_provider = ?, oauth_access_token_encrypted = ?, oauth_refresh_token_encrypted = ?, allow_local = ?, supports_vision = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')->execute($values);
    } else {
        db()->prepare('INSERT INTO user_ai_settings (mode, provider_id, model, base_url, adapter, auth_mode, api_key_encrypted, headers_encrypted, oauth_provider, oauth_access_token_encrypted, oauth_refresh_token_encrypted, allow_local, supports_vision, enabled, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')->execute($values);
    }
    return ai_user_ai_public_settings($userId);
}
