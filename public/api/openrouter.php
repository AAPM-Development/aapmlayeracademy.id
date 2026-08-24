<?php
declare(strict_types=1);

const AAPM_OPENROUTER_DEFAULT_MODEL = 'nvidia/nemotron-3.5-lightning:free';
const AAPM_OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

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

function openrouter_is_free_model(string $model): bool
{
    return (bool) preg_match('/\A[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*:free\z/i', $model);
}

function openrouter_encryption_key(): string
{
    $secret = trim((string) (app_config()['ai_settings_encryption_key'] ?? ''));
    return $secret === '' ? '' : hash('sha256', $secret, true);
}

function openrouter_encrypt_secret(string $secret): string
{
    $key = openrouter_encryption_key();
    if ($key === '' || !function_exists('openssl_encrypt')) {
        throw new RuntimeException('Penyimpanan secret terenkripsi belum siap. Tambahkan ai_settings_encryption_key pada konfigurasi server privat.');
    }

    $iv = random_bytes(12);
    $tag = '';
    $ciphertext = openssl_encrypt($secret, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag, 'aapm-openrouter-v1');
    if (!is_string($ciphertext) || strlen($tag) !== 16) {
        throw new RuntimeException('Secret OpenRouter tidak dapat dienkripsi.');
    }

    return base64_encode($iv . $tag . $ciphertext);
}

function openrouter_decrypt_secret(string $encoded): string
{
    $key = openrouter_encryption_key();
    if ($key === '' || !function_exists('openssl_decrypt')) {
        return '';
    }

    $payload = base64_decode($encoded, true);
    if (!is_string($payload) || strlen($payload) <= 28) {
        return '';
    }

    $iv = substr($payload, 0, 12);
    $tag = substr($payload, 12, 16);
    $ciphertext = substr($payload, 28);
    $plain = openssl_decrypt($ciphertext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag, 'aapm-openrouter-v1');
    return is_string($plain) ? trim($plain) : '';
}

function openrouter_settings_status(): array
{
    $configuredKey = trim((string) (app_config()['openrouter_api_key'] ?? ''));
    $encryptedKey = app_setting_get('ai_openrouter_key');
    $storedKey = $encryptedKey === '' ? '' : openrouter_decrypt_secret($encryptedKey);
    $model = trim(app_setting_get('ai_openrouter_model', AAPM_OPENROUTER_DEFAULT_MODEL));
    $enabled = app_setting_get('ai_openrouter_enabled', '1') !== '0';

    if (!openrouter_is_free_model($model)) {
        $model = AAPM_OPENROUTER_DEFAULT_MODEL;
    }

    return [
        'provider' => 'openrouter',
        'enabled' => $enabled,
        'model' => $model,
        'apiKeyConfigured' => $configuredKey !== '' || $storedKey !== '',
        'keyStorage' => $configuredKey !== '' ? 'private_config' : ($encryptedKey !== '' ? 'encrypted_database' : 'not_configured'),
        'encryptionReady' => $configuredKey !== '' || (openrouter_encryption_key() !== '' && function_exists('openssl_encrypt')),
    ];
}

function openrouter_api_key(): string
{
    $configuredKey = trim((string) (app_config()['openrouter_api_key'] ?? ''));
    if ($configuredKey !== '') {
        return $configuredKey;
    }

    return openrouter_decrypt_secret(app_setting_get('ai_openrouter_key'));
}

function openrouter_save_settings(array $input): array
{
    $model = trim((string) ($input['model'] ?? AAPM_OPENROUTER_DEFAULT_MODEL));
    if (!openrouter_is_free_model($model)) {
        error_response('Model OpenRouter harus menggunakan slug model gratis yang diakhiri :free.', 422, 'invalid_ai_model');
    }

    app_setting_set('ai_openrouter_model', $model);
    app_setting_set('ai_openrouter_enabled', bool_value($input['enabled'] ?? true) ? '1' : '0');

    if (array_key_exists('apiKey', $input) && trim((string) $input['apiKey']) !== '') {
        if (trim((string) (app_config()['openrouter_api_key'] ?? '')) !== '') {
            error_response('API key dikelola dari konfigurasi server privat dan tidak dapat ditimpa dari Admin.', 409, 'ai_key_managed_in_config');
        }

        $apiKey = trim((string) $input['apiKey']);
        if (strlen($apiKey) < 20 || strlen($apiKey) > 300 || preg_match('/[\r\n]/', $apiKey)) {
            error_response('Format API key OpenRouter tidak valid.', 422, 'invalid_ai_key');
        }
        app_setting_set('ai_openrouter_key', openrouter_encrypt_secret($apiKey));
    }

    return openrouter_settings_status();
}

function openrouter_system_prompt(): string
{
    return "Anda adalah AI Layer Farm Assistant untuk AAPM Layer Academy, platform pembelajaran manajemen ayam petelur di Indonesia. Jawab dalam bahasa Indonesia yang profesional, praktis, dan ringkas. Gunakan heading dan poin bila membantu. Fokus pada HDP, FCR, konsumsi pakan dan air, berat telur, mortalitas, biosecurity, lingkungan kandang, dan keputusan operasional. Bedakan fakta dari hipotesis, jangan mengarang angka atau diagnosis. Jika ada kemungkinan penyakit, obat, dosis, atau kondisi darurat, jelaskan batasan Anda dan arahkan pengguna untuk berkonsultasi dengan dokter hewan. Data KPI yang diberikan adalah data milik pengguna untuk konteks dan tidak boleh dianggap sebagai standar universal.";
}

function openrouter_context_for_user(int $userId): array
{
    $statement = db()->prepare('SELECT week, hen_day_production, feed_intake, egg_weight, mortality, water_intake, temperature, humidity, revenue, cost, fcr, notes FROM farm_data WHERE user_id = ? ORDER BY week DESC, id DESC LIMIT 8');
    $statement->execute([$userId]);
    return array_reverse($statement->fetchAll());
}

function openrouter_context_text(array $rows): string
{
    if (!$rows) {
        return 'Tidak ada data KPI farm tersimpan.';
    }

    $lines = [];
    foreach ($rows as $row) {
        $parts = ['Minggu ' . ($row['week'] ?? '—')];
        $map = [
            'hen_day_production' => 'HDP', 'fcr' => 'FCR', 'feed_intake' => 'Pakan', 'water_intake' => 'Air',
            'egg_weight' => 'Berat telur', 'mortality' => 'Mortalitas', 'temperature' => 'Suhu', 'humidity' => 'Kelembapan',
        ];
        foreach ($map as $field => $label) {
            if ($row[$field] !== null && $row[$field] !== '') {
                $parts[] = $label . ' ' . $row[$field];
            }
        }
        $note = trim((string) ($row['notes'] ?? ''));
        if ($note !== '') {
            $parts[] = 'Catatan ' . substr($note, 0, 280);
        }
        $lines[] = implode(' | ', $parts);
    }

    return implode("\n", $lines);
}

function openrouter_chat_completion(string $model, string $apiKey, array $messages): string
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('Ekstensi cURL PHP diperlukan untuk menghubungkan OpenRouter.');
    }

    $payload = json_encode([
        'model' => $model,
        'messages' => $messages,
        'temperature' => 0.3,
        'max_tokens' => 700,
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if (!is_string($payload)) {
        throw new RuntimeException('Permintaan AI tidak dapat disiapkan.');
    }

    $headers = [
        'Accept: application/json',
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey,
        'X-OpenRouter-Title: AAPM Layer Academy',
    ];
    $origin = app_base_url();
    if ($origin !== '') {
        $headers[] = 'HTTP-Referer: ' . $origin;
    }

    $handle = curl_init(AAPM_OPENROUTER_ENDPOINT);
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 35,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_USERAGENT => 'AAPM-Layer-Academy/1.0',
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
    ]);
    $body = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
    curl_close($handle);

    $decoded = is_string($body) ? json_decode($body, true) : null;
    if ($status < 200 || $status >= 300 || !is_array($decoded)) {
        $providerMessage = is_array($decoded) ? trim((string) ($decoded['error']['message'] ?? '')) : '';
        throw new RuntimeException($providerMessage !== '' ? 'OpenRouter menolak permintaan: ' . substr($providerMessage, 0, 220) : 'OpenRouter tidak merespons dengan sukses.');
    }

    $content = $decoded['choices'][0]['message']['content'] ?? '';
    if (is_array($content)) {
        $content = implode("\n", array_filter(array_map(static function ($part): string {
            return is_array($part) ? (string) ($part['text'] ?? '') : '';
        }, $content)));
    }
    $content = trim((string) $content);
    if ($content === '') {
        throw new RuntimeException('OpenRouter tidak mengembalikan jawaban teks.');
    }

    return $content;
}

function openrouter_assistant_reply(string $message, array $farmContext): array
{
    $settings = openrouter_settings_status();
    $apiKey = openrouter_api_key();
    if (!$settings['enabled'] || $apiKey === '') {
        return ['reply' => native_ai_reply($message, $farmContext), 'provider' => 'local', 'model' => null, 'fallback' => true];
    }

    try {
        $reply = openrouter_chat_completion($settings['model'], $apiKey, [
            ['role' => 'system', 'content' => openrouter_system_prompt()],
            ['role' => 'user', 'content' => "Pertanyaan pengguna:\n" . substr($message, 0, 3000) . "\n\nKonteks KPI terverifikasi:\n" . openrouter_context_text($farmContext)],
        ]);
        return ['reply' => $reply, 'provider' => 'openrouter', 'model' => $settings['model'], 'fallback' => false];
    } catch (RuntimeException $exception) {
        error_log('[aapm-openrouter] ' . $exception->getMessage());
        return ['reply' => native_ai_reply($message, $farmContext), 'provider' => 'local', 'model' => null, 'fallback' => true];
    }
}

function openrouter_test_connection(): array
{
    $settings = openrouter_settings_status();
    $apiKey = openrouter_api_key();
    if (!$settings['enabled']) {
        error_response('Aktifkan AI OpenRouter sebelum menjalankan test.', 422, 'ai_disabled');
    }
    if ($apiKey === '') {
        error_response('Simpan API key OpenRouter terlebih dahulu.', 422, 'ai_key_missing');
    }

    $reply = openrouter_chat_completion($settings['model'], $apiKey, [
        ['role' => 'system', 'content' => 'Anda adalah service test. Jawab persis dengan: AAPM AI siap.'],
        ['role' => 'user', 'content' => 'Jalankan pemeriksaan koneksi.'],
    ]);
    return ['ok' => true, 'provider' => 'openrouter', 'model' => $settings['model'], 'reply' => $reply];
}
