<?php
declare(strict_types=1);

// Filename kept for compatible deployments. This implements the generic provider layer.
const AAPM_AI_DEFAULT_PROVIDER = 'openrouter';
const AAPM_AI_DEFAULT_MODEL = 'nvidia/nemotron-3.5-lightning:free';
const AAPM_AI_MAX_TOKENS = 700;

function app_setting_get(string $key, string $default = ''): string
{
    $statement = db()->prepare('SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1');
    $statement->execute([$key]);
    $row = $statement->fetch();
    return $row ? (string) $row['setting_value'] : $default;
}

function app_setting_set(string $key, string $value): void
{
    $exists = db()->prepare('SELECT setting_key FROM app_settings WHERE setting_key = ? LIMIT 1');
    $exists->execute([$key]);
    if ($exists->fetch()) {
        db()->prepare('UPDATE app_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?')->execute([$value, $key]);
        return;
    }
    db()->prepare('INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)')->execute([$key, $value]);
}

function ai_provider_catalog(): array
{
    return [
        'openrouter' => ['label' => 'OpenRouter', 'adapter' => 'openai-compatible', 'defaultModel' => AAPM_AI_DEFAULT_MODEL, 'baseUrl' => 'https://openrouter.ai/api/v1', 'freeOnly' => true, 'supportsLocal' => false, 'keyRequired' => true],
        'openai-compatible' => ['label' => 'OpenAI-compatible API', 'adapter' => 'openai-compatible', 'defaultModel' => 'gpt-4o-mini', 'baseUrl' => 'https://api.openai.com/v1', 'freeOnly' => false, 'supportsLocal' => true, 'keyRequired' => true],
        'gemini' => ['label' => 'Google Gemini', 'adapter' => 'gemini', 'defaultModel' => 'gemini-2.5-flash', 'baseUrl' => 'https://generativelanguage.googleapis.com/v1beta', 'freeOnly' => false, 'supportsLocal' => false, 'keyRequired' => true],
        'anthropic' => ['label' => 'Anthropic Claude', 'adapter' => 'anthropic', 'defaultModel' => 'claude-haiku-4-5', 'baseUrl' => 'https://api.anthropic.com/v1', 'freeOnly' => false, 'supportsLocal' => false, 'keyRequired' => true],
    ];
}

function ai_provider_definition(string $provider): array
{
    $catalog = ai_provider_catalog();
    if (!isset($catalog[$provider])) {
        error_response('Provider AI tidak didukung.', 422, 'invalid_ai_provider');
    }
    return $catalog[$provider];
}

function ai_is_openrouter_free_model(string $model): bool
{
    return (bool) preg_match('/\A[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*:free\z/i', $model);
}

function ai_validate_model(string $provider, string $model): string
{
    $model = trim($model);
    if ($model === '' || strlen($model) > 200 || !preg_match('/\A[a-zA-Z0-9][a-zA-Z0-9._:\/-]*\z/', $model)) {
        error_response('Nama model AI tidak valid.', 422, 'invalid_ai_model');
    }
    if ($provider === 'openrouter' && !ai_is_openrouter_free_model($model)) {
        error_response('Model OpenRouter harus menggunakan slug gratis yang diakhiri :free.', 422, 'invalid_ai_model');
    }
    return $model;
}

function ai_encryption_key(): string
{
    $secret = trim((string) (app_config()['ai_settings_encryption_key'] ?? ''));
    return $secret === '' ? '' : hash('sha256', $secret, true);
}

function ai_encrypt_secret(string $secret): string
{
    $key = ai_encryption_key();
    if ($key === '' || !function_exists('openssl_encrypt')) {
        throw new RuntimeException('Penyimpanan secret terenkripsi belum siap. Tambahkan ai_settings_encryption_key pada konfigurasi server privat.');
    }
    $iv = random_bytes(12);
    $tag = '';
    $ciphertext = openssl_encrypt($secret, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag, 'aapm-ai-provider-v1');
    if (!is_string($ciphertext) || strlen($tag) !== 16) {
        throw new RuntimeException('Secret AI tidak dapat dienkripsi.');
    }
    return base64_encode($iv . $tag . $ciphertext);
}

function ai_decrypt_secret_with_aad(string $encoded, string $aad): string
{
    $key = ai_encryption_key();
    if ($key === '' || !function_exists('openssl_decrypt')) return '';
    $payload = base64_decode($encoded, true);
    if (!is_string($payload) || strlen($payload) <= 28) return '';
    $plain = openssl_decrypt(substr($payload, 28), 'aes-256-gcm', $key, OPENSSL_RAW_DATA, substr($payload, 0, 12), substr($payload, 12, 16), $aad);
    return is_string($plain) ? trim($plain) : '';
}

function ai_decrypt_secret(string $encoded): string
{
    return ai_decrypt_secret_with_aad($encoded, 'aapm-ai-provider-v1');
}

function ai_secret_setting_key(string $provider): string
{
    ai_provider_definition($provider);
    return 'ai_secret_' . $provider;
}

function ai_private_config(): array
{
    $config = app_config();
    $provider = trim((string) ($config['ai_provider'] ?? ''));
    $apiKey = trim((string) ($config['ai_api_key'] ?? ''));
    if ($apiKey === '' && trim((string) ($config['openrouter_api_key'] ?? '')) !== '') {
        $provider = 'openrouter';
        $apiKey = trim((string) $config['openrouter_api_key']);
    }
    if ($apiKey === '' || !isset(ai_provider_catalog()[$provider])) {
        return ['provider' => '', 'apiKey' => '', 'model' => '', 'baseUrl' => '', 'allowLocal' => false];
    }
    return [
        'provider' => $provider,
        'apiKey' => $apiKey,
        'model' => trim((string) ($config['ai_model'] ?? '')),
        'baseUrl' => trim((string) ($config['ai_base_url'] ?? '')),
        'allowLocal' => bool_value($config['ai_allow_local'] ?? false) === 1,
    ];
}

function ai_stored_provider(): string
{
    $provider = trim(app_setting_get('ai_provider', AAPM_AI_DEFAULT_PROVIDER));
    return isset(ai_provider_catalog()[$provider]) ? $provider : AAPM_AI_DEFAULT_PROVIDER;
}

function ai_stored_secret(string $provider): string
{
    $stored = app_setting_get(ai_secret_setting_key($provider));
    $secret = $stored === '' ? '' : ai_decrypt_secret($stored);
    if ($secret !== '' || $provider !== 'openrouter') return $secret;

    // Migrate the original OpenRouter-only setting lazily and without exposing it.
    $legacy = app_setting_get('ai_openrouter_key');
    $legacySecret = $legacy === '' ? '' : ai_decrypt_secret_with_aad($legacy, 'aapm-openrouter-v1');
    if ($legacySecret !== '' && ai_encryption_key() !== '') {
        app_setting_set(ai_secret_setting_key('openrouter'), ai_encrypt_secret($legacySecret));
    }
    return $legacySecret;
}

function ai_is_loopback_host(string $host): bool
{
    $host = strtolower(trim($host, '[]'));
    return $host === 'localhost' || $host === '::1' || filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_LOOPBACK) !== false;
}

function ai_normalize_base_url(string $provider, string $baseUrl, bool $allowLocal): string
{
    $definition = ai_provider_definition($provider);
    if ($provider !== 'openai-compatible') return $definition['baseUrl'];

    $baseUrl = rtrim(trim($baseUrl ?: $definition['baseUrl']), '/');
    $parts = parse_url($baseUrl);
    $scheme = strtolower((string) ($parts['scheme'] ?? ''));
    $host = (string) ($parts['host'] ?? '');
    if ($baseUrl === '' || strlen($baseUrl) > 500 || !in_array($scheme, ['https', 'http'], true) || $host === '' || isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])) {
        error_response('Base URL harus berupa alamat API HTTPS yang lengkap.', 422, 'invalid_ai_base_url');
    }
    if ($scheme === 'http' && (!$allowLocal || !ai_is_loopback_host($host))) {
        error_response('HTTP hanya diizinkan untuk endpoint loopback seperti http://localhost:11434/v1.', 422, 'ai_local_endpoint_required');
    }
    return $baseUrl;
}

function ai_settings_status(): array
{
    $private = ai_private_config();
    $provider = $private['apiKey'] !== '' ? $private['provider'] : ai_stored_provider();
    $definition = ai_provider_definition($provider);
    $legacyModel = $provider === 'openrouter' ? app_setting_get('ai_openrouter_model', AAPM_AI_DEFAULT_MODEL) : $definition['defaultModel'];
    $model = $private['model'] !== '' ? $private['model'] : app_setting_get('ai_model', $legacyModel);
    $model = ai_validate_model($provider, $model ?: $definition['defaultModel']);
    $allowLocal = $provider === 'openai-compatible' && ($private['apiKey'] !== '' ? $private['allowLocal'] : app_setting_get('ai_allow_local', '0') === '1');
    $storedBaseUrl = app_setting_get('ai_base_url', $definition['baseUrl']);
    $baseUrl = ai_normalize_base_url($provider, $private['baseUrl'] !== '' ? $private['baseUrl'] : $storedBaseUrl, $allowLocal);
    $enabled = $private['apiKey'] !== '' ? true : app_setting_get('ai_enabled', app_setting_get('ai_openrouter_enabled', '1')) !== '0';
    $storedSecret = $private['apiKey'] === '' ? ai_stored_secret($provider) : '';
    $keyRequired = (bool) $definition['keyRequired'] && !($provider === 'openai-compatible' && $allowLocal);

    return [
        'provider' => $provider, 'providerLabel' => $definition['label'], 'adapter' => $definition['adapter'],
        'enabled' => $enabled, 'model' => $model, 'baseUrl' => $baseUrl, 'allowLocal' => $allowLocal,
        'freeOnly' => (bool) $definition['freeOnly'], 'supportsLocal' => (bool) $definition['supportsLocal'], 'apiKeyRequired' => $keyRequired,
        'apiKeyConfigured' => $private['apiKey'] !== '' || $storedSecret !== '' || !$keyRequired,
        'keyStorage' => $private['apiKey'] !== '' ? 'private_config' : ($storedSecret !== '' ? 'encrypted_database' : 'not_configured'),
        'encryptionReady' => $private['apiKey'] !== '' || (ai_encryption_key() !== '' && function_exists('openssl_encrypt')),
    ];
}

function ai_api_key(array $settings): string
{
    $private = ai_private_config();
    if ($private['apiKey'] !== '' && $private['provider'] === $settings['provider']) return $private['apiKey'];
    return ai_stored_secret((string) $settings['provider']);
}

function ai_validate_api_key(string $apiKey): string
{
    $apiKey = trim($apiKey);
    if (strlen($apiKey) < 8 || strlen($apiKey) > 512 || preg_match('/[\x00-\x1F\x7F]/', $apiKey)) {
        error_response('Format API key tidak valid.', 422, 'invalid_ai_key');
    }
    return $apiKey;
}

function ai_save_settings(array $input): array
{
    if (ai_private_config()['apiKey'] !== '') {
        error_response('Provider dan API key dikelola dari konfigurasi server privat dan tidak dapat ditimpa dari Admin.', 409, 'ai_managed_in_config');
    }
    $provider = trim((string) ($input['provider'] ?? AAPM_AI_DEFAULT_PROVIDER));
    $definition = ai_provider_definition($provider);
    $allowLocal = $provider === 'openai-compatible' && bool_value($input['allowLocal'] ?? false) === 1;
    $model = ai_validate_model($provider, (string) ($input['model'] ?? $definition['defaultModel']));
    $baseUrl = ai_normalize_base_url($provider, (string) ($input['baseUrl'] ?? $definition['baseUrl']), $allowLocal);
    app_setting_set('ai_provider', $provider);
    app_setting_set('ai_model', $model);
    app_setting_set('ai_base_url', $baseUrl);
    app_setting_set('ai_allow_local', $allowLocal ? '1' : '0');
    app_setting_set('ai_enabled', bool_value($input['enabled'] ?? true) ? '1' : '0');
    if (array_key_exists('apiKey', $input) && trim((string) $input['apiKey']) !== '') {
        app_setting_set(ai_secret_setting_key($provider), ai_encrypt_secret(ai_validate_api_key((string) $input['apiKey'])));
    }
    return ai_settings_status();
}

function ai_system_prompt(): string
{
    return "Anda adalah AI Layer Farm Assistant untuk AAPM Layer Academy, platform pembelajaran manajemen ayam petelur di Indonesia. Jawab dalam bahasa Indonesia yang profesional, praktis, dan ringkas. Gunakan heading dan poin bila membantu. Fokus pada HDP, FCR, konsumsi pakan dan air, berat telur, mortalitas, biosecurity, lingkungan kandang, dan keputusan operasional. Bedakan fakta dari hipotesis, jangan mengarang angka atau diagnosis. Jika ada kemungkinan penyakit, obat, dosis, atau kondisi darurat, jelaskan batasan Anda dan arahkan pengguna untuk berkonsultasi dengan dokter hewan. Data KPI yang diberikan adalah data milik pengguna untuk konteks dan tidak boleh dianggap sebagai standar universal. Berikan hanya jawaban akhir untuk pengguna. Jangan tampilkan proses berpikir, analisis internal, draft jawaban, atau label seperti thinking/reasoning.";
}

function ai_context_for_user(int $userId): array
{
    $statement = db()->prepare('SELECT week, hen_day_production, feed_intake, egg_weight, mortality, water_intake, temperature, humidity, revenue, cost, fcr, notes FROM farm_data WHERE user_id = ? ORDER BY week DESC, id DESC LIMIT 8');
    $statement->execute([$userId]);
    return array_reverse($statement->fetchAll());
}

function ai_context_text(array $rows): string
{
    if (!$rows) return 'Tidak ada data KPI farm tersimpan.';
    $lines = [];
    foreach ($rows as $row) {
        $parts = ['Minggu ' . ($row['week'] ?? '—')];
        foreach (['hen_day_production' => 'HDP', 'fcr' => 'FCR', 'feed_intake' => 'Pakan', 'water_intake' => 'Air', 'egg_weight' => 'Berat telur', 'mortality' => 'Mortalitas', 'temperature' => 'Suhu', 'humidity' => 'Kelembapan'] as $field => $label) {
            if ($row[$field] !== null && $row[$field] !== '') $parts[] = $label . ' ' . $row[$field];
        }
        $note = trim((string) ($row['notes'] ?? ''));
        if ($note !== '') $parts[] = 'Catatan ' . substr($note, 0, 280);
        $lines[] = implode(' | ', $parts);
    }
    return implode("\n", $lines);
}

function ai_http_json(string $url, array $headers, array $body, string $providerLabel): array
{
    if (!function_exists('curl_init')) throw new RuntimeException('Ekstensi cURL PHP diperlukan untuk menghubungkan provider AI.');
    $payload = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if (!is_string($payload)) throw new RuntimeException('Permintaan AI tidak dapat disiapkan.');
    $handle = curl_init($url);
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => false, CURLOPT_CONNECTTIMEOUT => 8, CURLOPT_TIMEOUT => 35,
        CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2, CURLOPT_USERAGENT => 'AAPM-Layer-Academy/1.0',
        CURLOPT_HTTPHEADER => array_merge(['Accept: application/json', 'Content-Type: application/json'], $headers), CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload,
    ]);
    $bodyText = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
    $curlError = curl_error($handle);
    curl_close($handle);
    $decoded = is_string($bodyText) ? json_decode($bodyText, true) : null;
    if ($status < 200 || $status >= 300 || !is_array($decoded)) {
        $message = is_array($decoded) ? trim((string) ($decoded['error']['message'] ?? $decoded['message'] ?? '')) : '';
        throw new RuntimeException($providerLabel . ': ' . substr($message !== '' ? $message : ($curlError !== '' ? $curlError : 'tidak merespons dengan sukses'), 0, 220));
    }
    return $decoded;
}

function ai_openai_content(array $decoded, string $providerLabel): string
{
    $content = $decoded['choices'][0]['message']['content'] ?? '';
    if (is_array($content)) $content = implode("\n", array_filter(array_map(static fn ($part): string => is_array($part) ? (string) ($part['text'] ?? '') : '', $content)));
    $content = trim((string) $content);
    if ($content === '') throw new RuntimeException($providerLabel . ' tidak mengembalikan jawaban teks.');
    return $content;
}

function ai_openai_compatible_completion(array $settings, string $apiKey, string $systemPrompt, string $userPrompt): string
{
    $headers = $apiKey !== '' ? ['Authorization: Bearer ' . $apiKey] : [];
    if ($settings['provider'] === 'openrouter') {
        $headers[] = 'X-OpenRouter-Title: AAPM Layer Academy';
        $origin = app_base_url();
        if ($origin !== '') $headers[] = 'HTTP-Referer: ' . $origin;
    }
    $body = [
        'model' => $settings['model'],
        'messages' => [['role' => 'system', 'content' => $systemPrompt], ['role' => 'user', 'content' => $userPrompt]],
        'temperature' => 0.3, 'max_tokens' => AAPM_AI_MAX_TOKENS,
    ];
    if ($settings['provider'] === 'openrouter') {
        // Reasoning-capable free models may expose an intermediate trace.
        // OpenRouter suppresses that trace while retaining the final answer.
        $body['reasoning'] = ['exclude' => true];
    }
    $decoded = ai_http_json(rtrim((string) $settings['baseUrl'], '/') . '/chat/completions', $headers, $body, (string) $settings['providerLabel']);
    return ai_openai_content($decoded, (string) $settings['providerLabel']);
}

function ai_gemini_completion(array $settings, string $apiKey, string $systemPrompt, string $userPrompt): string
{
    $decoded = ai_http_json(rtrim((string) $settings['baseUrl'], '/') . '/models/' . rawurlencode((string) $settings['model']) . ':generateContent', ['x-goog-api-key: ' . $apiKey], [
        'systemInstruction' => ['parts' => [['text' => $systemPrompt]],],
        'contents' => [['role' => 'user', 'parts' => [['text' => $userPrompt]]]],
        'generationConfig' => ['temperature' => 0.3, 'maxOutputTokens' => AAPM_AI_MAX_TOKENS],
    ], (string) $settings['providerLabel']);
    $parts = $decoded['candidates'][0]['content']['parts'] ?? [];
    $content = implode("\n", array_filter(array_map(static fn ($part): string => is_array($part) ? trim((string) ($part['text'] ?? '')) : '', is_array($parts) ? $parts : [])));
    if ($content === '') throw new RuntimeException('Google Gemini tidak mengembalikan jawaban teks.');
    return $content;
}

function ai_anthropic_completion(array $settings, string $apiKey, string $systemPrompt, string $userPrompt): string
{
    $decoded = ai_http_json(rtrim((string) $settings['baseUrl'], '/') . '/messages', ['x-api-key: ' . $apiKey, 'anthropic-version: 2023-06-01'], [
        'model' => $settings['model'], 'max_tokens' => AAPM_AI_MAX_TOKENS, 'temperature' => 0.3, 'system' => $systemPrompt,
        'messages' => [['role' => 'user', 'content' => $userPrompt]],
    ], (string) $settings['providerLabel']);
    $parts = is_array($decoded['content'] ?? null) ? $decoded['content'] : [];
    $content = implode("\n", array_filter(array_map(static fn ($part): string => is_array($part) && ($part['type'] ?? '') === 'text' ? trim((string) ($part['text'] ?? '')) : '', $parts)));
    if ($content === '') throw new RuntimeException('Anthropic Claude tidak mengembalikan jawaban teks.');
    return $content;
}

function ai_provider_completion(array $settings, string $apiKey, string $systemPrompt, string $userPrompt): string
{
    // Keep the provider dispatch explicit. This file is loaded by the central
    // API router, so a parser incompatibility here would break every API route.
    if ($settings['adapter'] === 'gemini') {
        return ai_gemini_completion($settings, $apiKey, $systemPrompt, $userPrompt);
    }

    if ($settings['adapter'] === 'anthropic') {
        return ai_anthropic_completion($settings, $apiKey, $systemPrompt, $userPrompt);
    }

    return ai_openai_compatible_completion($settings, $apiKey, $systemPrompt, $userPrompt);
}

function ai_provider_fallback_notice(): string
{
    return 'Provider AI belum dapat merespons. Jawaban ini dibuat oleh asisten lokal dan tidak memakai model eksternal.';
}

function ai_provider_test_error(RuntimeException $exception): string
{
    // Provider failures are visible only to admins in the connection test. The
    // transport code never includes the Authorization header in its message;
    // still redact common key prefixes as a final defensive boundary.
    $message = preg_replace('/\b(sk-or-v1|sk-[A-Za-z0-9_-]+|AIza)[A-Za-z0-9._-]*/', '[credential disamarkan]', $exception->getMessage());
    return substr(trim((string) $message), 0, 260);
}

function ai_assistant_reply(string $message, array $farmContext): array
{
    $settings = ai_settings_status();
    $apiKey = ai_api_key($settings);
    if (!$settings['enabled'] || ($settings['apiKeyRequired'] && $apiKey === '')) {
        return [
            'reply' => native_ai_reply($message, $farmContext),
            'provider' => 'local',
            'model' => null,
            'fallback' => true,
            'providerStatus' => 'not_configured',
            'notice' => 'Provider AI belum dikonfigurasi. Jawaban ini dibuat oleh asisten lokal.',
        ];
    }
    try {
        $reply = ai_provider_completion($settings, $apiKey, ai_system_prompt(), "Pertanyaan pengguna:\n" . substr($message, 0, 3000) . "\n\nKonteks KPI terverifikasi:\n" . ai_context_text($farmContext));
        return [
            'reply' => $reply,
            'provider' => $settings['provider'],
            'model' => $settings['model'],
            'fallback' => false,
            'providerStatus' => 'ready',
            'notice' => null,
        ];
    } catch (RuntimeException $exception) {
        error_log('[aapm-ai-provider] ' . $exception->getMessage());
        return [
            'reply' => native_ai_reply($message, $farmContext),
            'provider' => 'local',
            'model' => null,
            'fallback' => true,
            'providerStatus' => 'unavailable',
            'notice' => ai_provider_fallback_notice(),
        ];
    }
}

function ai_test_connection(): array
{
    $settings = ai_settings_status();
    $apiKey = ai_api_key($settings);
    if (!$settings['enabled']) error_response('Aktifkan provider AI sebelum menjalankan test.', 422, 'ai_disabled');
    if ($settings['apiKeyRequired'] && $apiKey === '') error_response('Simpan API key untuk provider ini terlebih dahulu.', 422, 'ai_key_missing');
    try {
        $reply = ai_provider_completion($settings, $apiKey, 'Anda adalah service test. Jawab persis dengan: AAPM AI siap.', 'Jalankan pemeriksaan koneksi.');
    } catch (RuntimeException $exception) {
        error_response('Koneksi provider gagal: ' . ai_provider_test_error($exception), 502, 'ai_provider_unavailable');
    }
    return ['ok' => true, 'provider' => $settings['provider'], 'providerLabel' => $settings['providerLabel'], 'model' => $settings['model'], 'reply' => $reply];
}
