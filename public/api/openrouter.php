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

require_once __DIR__ . '/aiProviders.php';

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
    return $model === 'openrouter/free' || (bool) preg_match('/\A[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*:free\z/i', $model);
}

function ai_validate_model(string $provider, string $model): string
{
    $model = trim($model);
    if ($model === '' || strlen($model) > 200 || !preg_match('/\A[a-zA-Z0-9][a-zA-Z0-9._:\/-]*\z/', $model)) {
        error_response('Nama model AI tidak valid.', 422, 'invalid_ai_model');
    }
    if ($provider === 'openrouter' && !ai_is_openrouter_free_model($model)) {
        error_response('Model OpenRouter harus menggunakan slug gratis yang diakhiri :free atau router openrouter/free.', 422, 'invalid_ai_model');
    }
    return $model;
}

function ai_validate_provider_label(string $label): string
{
    $label = trim(preg_replace('/\s+/u', ' ', $label) ?? '');
    if ($label === '') return '';
    if (strlen($label) > 160 || preg_match('/[\x00-\x1F\x7F]/', $label)) {
        error_response('Nama provider maksimal 80 karakter dan tidak boleh memuat karakter kontrol.', 422, 'invalid_ai_provider_label');
    }
    return $label;
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
    $catalog = function_exists('ai_registry_catalog') ? ai_registry_catalog() : ai_provider_catalog();
    $definition = $catalog[$provider] ?? null;
    if (!is_array($definition) || ($apiKey === '' && !empty($definition['keyRequired']))) {
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
    $user = function_exists('current_user') ? current_user() : null;
    return ai_user_ai_runtime_status((int) ($user['id'] ?? 0));

    // Legacy single-provider implementation kept below for rolling deploys.
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
    $storedProviderLabel = $private['apiKey'] === '' && $provider === 'openai-compatible'
        ? ai_validate_provider_label(app_setting_get('ai_provider_label'))
        : '';
    $providerLabel = $storedProviderLabel !== '' ? $storedProviderLabel : $definition['label'];

    return [
        'provider' => $provider, 'providerLabel' => $providerLabel, 'adapter' => $definition['adapter'],
        'enabled' => $enabled, 'model' => $model, 'baseUrl' => $baseUrl, 'allowLocal' => $allowLocal,
        'freeOnly' => (bool) $definition['freeOnly'], 'supportsLocal' => (bool) $definition['supportsLocal'], 'apiKeyRequired' => $keyRequired,
        'apiKeyConfigured' => $private['apiKey'] !== '' || $storedSecret !== '' || !$keyRequired,
        'keyStorage' => $private['apiKey'] !== '' ? 'private_config' : ($storedSecret !== '' ? 'encrypted_database' : 'not_configured'),
        'encryptionReady' => $private['apiKey'] !== '' || (ai_encryption_key() !== '' && function_exists('openssl_encrypt')),
    ];
}

function ai_api_key(array $settings): string
{
    return ai_registry_api_key($settings);

    // Legacy single-provider implementation kept below for rolling deploys.
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
    return ai_registry_save_settings($input);

    // Legacy single-provider implementation kept below for rolling deploys.
    if (ai_private_config()['apiKey'] !== '') {
        error_response('Provider dan API key dikelola dari konfigurasi server privat dan tidak dapat ditimpa dari Admin.', 409, 'ai_managed_in_config');
    }
    $provider = trim((string) ($input['provider'] ?? AAPM_AI_DEFAULT_PROVIDER));
    $definition = ai_provider_definition($provider);
    $allowLocal = $provider === 'openai-compatible' && bool_value($input['allowLocal'] ?? false) === 1;
    $model = ai_validate_model($provider, (string) ($input['model'] ?? $definition['defaultModel']));
    $baseUrl = ai_normalize_base_url($provider, (string) ($input['baseUrl'] ?? $definition['baseUrl']), $allowLocal);
    $providerLabel = $provider === 'openai-compatible'
        ? ai_validate_provider_label((string) ($input['providerLabel'] ?? ''))
        : '';
    app_setting_set('ai_provider', $provider);
    app_setting_set('ai_provider_label', $providerLabel);
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
    return "Anda adalah APPI (AAPM Predictive & Personal Intelligence) untuk AAPM Layer Academy, platform pembelajaran manajemen ayam petelur di Indonesia. Jawab dalam bahasa Indonesia yang profesional, praktis, dan ringkas. Fokus pada HDP, FCR, konsumsi pakan dan air, berat telur, mortalitas, biosecurity, lingkungan kandang, dan keputusan operasional. Bedakan fakta dari hipotesis, jangan mengarang angka atau diagnosis. Jika informasi penting belum cukup untuk memberi kesimpulan yang aman, jelaskan data yang kurang dan ajukan maksimal tiga pertanyaan lanjutan yang spesifik, termasuk satuan atau periode data bila relevan. Untuk membandingkan dua atau lebih indikator atau opsi, gunakan tabel Markdown. Untuk alur pemeriksaan atau pohon keputusan yang benar-benar lebih jelas secara visual, gunakan diagram Mermaid dalam code fence `mermaid` dengan maksimal delapan node; jangan membuat diagram dekoratif. Jika pengguna mengirim foto, pisahkan observasi visual dari hal yang belum dapat dipastikan dan sarankan foto/data pelengkap yang relevan. Jika ada kemungkinan penyakit, obat, dosis, atau kondisi darurat, jelaskan batasan Anda dan arahkan pengguna untuk berkonsultasi dengan dokter hewan. Data KPI dan profil belajar pada blok konteks adalah data milik akun yang sedang login, disediakan oleh server pada permintaan ini, dan boleh Anda gunakan sebagai konteks personal; jangan menganggapnya sebagai standar universal. Anda tidak perlu melakukan query database sendiri. Jika blok konteks tersedia, jangan mengatakan bahwa Anda tidak dapat mengakses database—jelaskan bahwa jawaban menggunakan konteks akun yang terbaca pada permintaan ini. Jika blok konteks menyatakan tidak ada data atau konteks KPI dimatikan, sampaikan itu secara spesifik dan minta data yang diperlukan. Berikan hanya jawaban akhir untuk pengguna. Jangan tampilkan proses berpikir, analisis internal, draft jawaban, atau label seperti thinking/reasoning.";
}

function ai_context_for_user(int $userId): array
{
    $statement = db()->prepare('SELECT week, hen_day_production, feed_intake, egg_weight, mortality, water_intake, temperature, humidity, revenue, cost, fcr, notes FROM farm_data WHERE user_id = ? ORDER BY week DESC, id DESC LIMIT 8');
    $statement->execute([$userId]);
    return array_reverse($statement->fetchAll());
}

function ai_account_context_for_user(int $userId): array
{
    $userStatement = db()->prepare('SELECT u.full_name, u.role, p.bio FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = ? LIMIT 1');
    $userStatement->execute([$userId]);
    $profile = $userStatement->fetch() ?: [];

    $progressStatement = db()->prepare('SELECT p.module_number, p.completed, p.quiz_score, p.quiz_total, p.practical_done, p.time_spent_minutes, p.updated_at, m.title AS module_title, m.level_name FROM user_progress p LEFT JOIN course_modules m ON m.module_number = p.module_number WHERE p.user_id = ? ORDER BY p.updated_at DESC, p.module_number ASC LIMIT 16');
    $progressStatement->execute([$userId]);

    return [
        'profile' => $profile,
        'progress' => $progressStatement->fetchAll(),
    ];
}

function ai_account_context_text(array $context): string
{
    $profile = is_array($context['profile'] ?? null) ? $context['profile'] : [];
    $progress = is_array($context['progress'] ?? null) ? $context['progress'] : [];
    $lines = [];
    $name = trim((string) ($profile['full_name'] ?? ''));
    $role = trim((string) ($profile['role'] ?? ''));
    $bio = trim((string) ($profile['bio'] ?? ''));
    if ($name !== '') $lines[] = 'Nama peserta: ' . substr($name, 0, 160);
    if ($role !== '') $lines[] = 'Peran akun: ' . ($role === 'admin' ? 'admin' : 'learner');
    if ($bio !== '') $lines[] = 'Catatan profil: ' . substr($bio, 0, 280);

    if (!$progress) {
        $lines[] = 'Progress belajar: belum ada catatan progress yang tersimpan.';
    } else {
        $completed = 0;
        $practical = 0;
        foreach ($progress as $row) {
            $completed += (int) ($row['completed'] ?? 0) === 1 ? 1 : 0;
            $practical += (int) ($row['practical_done'] ?? 0) === 1 ? 1 : 0;
        }
        $lines[] = 'Progress belajar terbaca: ' . $completed . ' modul selesai dari ' . count($progress) . ' catatan; ' . $practical . ' praktik ditandai selesai.';
        foreach (array_slice($progress, 0, 8) as $row) {
            $module = trim((string) ($row['module_title'] ?? ''));
            $module = $module !== '' ? $module : 'Modul ' . (string) ($row['module_number'] ?? '—');
            $status = (int) ($row['completed'] ?? 0) === 1 ? 'selesai' : 'berjalan';
            $score = ($row['quiz_score'] ?? null) !== null && ($row['quiz_total'] ?? null) !== null
                ? ' | kuis ' . $row['quiz_score'] . '/' . $row['quiz_total']
                : '';
            $lines[] = '- ' . substr($module, 0, 140) . ': ' . $status . $score;
        }
    }

    return $lines ? implode("\n", $lines) : 'Tidak ada konteks profil atau progress akun yang tersedia pada permintaan ini.';
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

function ai_page_context_text(string $pageContext): string
{
    $contexts = [
        'calculators' => 'Pengguna sedang berada di halaman Kalkulator Farm. Kaitkan jawaban dengan input, satuan, rumus, dan batas interpretasi indikator yang sedang dihitung.',
        'kpi' => 'Pengguna sedang berada di halaman Farm KPI. Kaitkan jawaban dengan pembacaan tren, periode data, dan pemeriksaan lanjutan yang relevan.',
        'learning' => 'Pengguna sedang berada di area materi pembelajaran. Kaitkan jawaban dengan konsep atau modul yang membantu, tanpa mengklaim progres yang tidak tersedia.',
        'certification' => 'Pengguna sedang berada di area sertifikasi. Bantu menjelaskan kesiapan dan materi terkait tanpa menjanjikan kelulusan.',
        'exam' => 'Pengguna sedang berada di area ujian akhir. Beri arahan konsep dan cara belajar, bukan jawaban yang menyalahi integritas ujian.',
        'admin' => 'Pengguna sedang berada di area administrasi Academy. Jelaskan dampak operasional secara ringkas dan jangan mengubah pengaturan apa pun.',
        'dashboard' => 'Pengguna sedang berada di dashboard pembelajaran. Kaitkan jawaban dengan data dan langkah berikutnya yang terlihat di workspace.',
        'ai-assistant' => 'Pengguna sedang berada di ruang kerja APPI. Gunakan konteks akun dan data KPI yang disertakan untuk menjaga kesinambungan percakapan.',
    ];
    return $contexts[$pageContext] ?? '';
}

function ai_user_prompt(string $message, array $farmContext, string $pageContext = '', string $accountMemory = '', array $accountContext = [], int $messageLimit = 3000): string
{
    $pageText = ai_page_context_text($pageContext);
    $messageLimit = max(1, min(24000, $messageLimit));
    return "Pertanyaan pengguna:\n" . substr($message, 0, $messageLimit)
        . ($pageText !== '' ? "\n\nKonteks halaman aktif:\n" . $pageText : '')
        . "\n\n[KONTEKS AKUN TERVALIDASI OLEH SERVER]\n" . ai_account_context_text($accountContext)
        . "\n[AKHIR KONTEKS AKUN]\n"
        . ($accountMemory !== '' ? "\n\nMemori percakapan akun (gunakan hanya untuk kesinambungan; jangan anggap sebagai fakta terbaru tanpa konfirmasi):\n" . $accountMemory : '')
        . "\n\nKonteks KPI terverifikasi:\n" . ai_context_text($farmContext);
}

function ai_normalize_image_data_url($value): ?string
{
    if (!is_string($value) || trim($value) === '') return null;
    if (!preg_match('#^data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=\r\n]+)$#', trim($value), $matches)) {
        error_response('Foto harus berformat JPG, PNG, atau WebP.', 422, 'invalid_image');
    }
    $bytes = base64_decode($matches[2], true);
    if (!is_string($bytes) || $bytes === '') {
        error_response('Foto tidak dapat dibaca.', 422, 'invalid_image');
    }
    if (strlen($bytes) > 3 * 1024 * 1024) {
        error_response('Ukuran foto maksimal 3 MB.', 422, 'image_too_large');
    }
    return 'data:image/' . $matches[1] . ';base64,' . base64_encode($bytes);
}

function ai_openai_messages(string $systemPrompt, string $userPrompt, ?string $imageDataUrl = null): array
{
    $content = $imageDataUrl === null
        ? $userPrompt
        : [
            ['type' => 'text', 'text' => $userPrompt],
            ['type' => 'image_url', 'image_url' => ['url' => $imageDataUrl]],
        ];
    return [
        ['role' => 'system', 'content' => $systemPrompt],
        ['role' => 'user', 'content' => $content],
    ];
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

function ai_openai_compatible_completion(array $settings, string $apiKey, string $systemPrompt, string $userPrompt, bool $allowWebSearch = false, ?string $imageDataUrl = null): string
{
    $headers = ai_registry_auth_headers($settings, $apiKey);
    $body = [
        'model' => $settings['model'],
        'messages' => ai_openai_messages($systemPrompt, $userPrompt, $imageDataUrl),
        'temperature' => $settings['temperature'] ?? 0.3,
        'max_tokens' => $settings['maxTokens'] ?? AAPM_AI_MAX_TOKENS,
    ];
    if ($settings['provider'] === 'openrouter') {
        // Reasoning-capable free models may expose an intermediate trace.
        // OpenRouter suppresses that trace while retaining the final answer.
        $body['reasoning'] = ['effort' => 'none', 'exclude' => true];
        if ($allowWebSearch) {
            $body['tools'] = [[
                'type' => 'openrouter:web_search',
                'parameters' => ['max_results' => 3, 'max_total_results' => 5],
            ]];
        }
    }
    $decoded = ai_http_json(rtrim((string) $settings['baseUrl'], '/') . ($settings['chatPath'] ?? '/chat/completions'), $headers, $body, (string) $settings['providerLabel']);
    return ai_openai_content($decoded, (string) $settings['providerLabel']);
}

function ai_gemini_completion(array $settings, string $apiKey, string $systemPrompt, string $userPrompt): string
{
    $decoded = ai_http_json(rtrim((string) $settings['baseUrl'], '/') . '/models/' . rawurlencode((string) $settings['model']) . ':generateContent', array_merge(['x-goog-api-key: ' . $apiKey], ai_registry_extra_header_lines($settings)), [
        'systemInstruction' => ['parts' => [['text' => $systemPrompt]],],
        'contents' => [['role' => 'user', 'parts' => [['text' => $userPrompt]]]],
        'generationConfig' => ['temperature' => $settings['temperature'] ?? 0.3, 'maxOutputTokens' => $settings['maxTokens'] ?? AAPM_AI_MAX_TOKENS],
    ], (string) $settings['providerLabel']);
    $parts = $decoded['candidates'][0]['content']['parts'] ?? [];
    $content = implode("\n", array_filter(array_map(static fn ($part): string => is_array($part) ? trim((string) ($part['text'] ?? '')) : '', is_array($parts) ? $parts : [])));
    if ($content === '') throw new RuntimeException('Google Gemini tidak mengembalikan jawaban teks.');
    return $content;
}

function ai_anthropic_completion(array $settings, string $apiKey, string $systemPrompt, string $userPrompt): string
{
    $decoded = ai_http_json(rtrim((string) $settings['baseUrl'], '/') . '/messages', array_merge(['x-api-key: ' . $apiKey, 'anthropic-version: 2023-06-01'], ai_registry_extra_header_lines($settings)), [
        'model' => $settings['model'], 'max_tokens' => $settings['maxTokens'] ?? AAPM_AI_MAX_TOKENS, 'temperature' => $settings['temperature'] ?? 0.3, 'system' => $systemPrompt,
        'messages' => [['role' => 'user', 'content' => $userPrompt]],
    ], (string) $settings['providerLabel']);
    $parts = is_array($decoded['content'] ?? null) ? $decoded['content'] : [];
    $content = implode("\n", array_filter(array_map(static fn ($part): string => is_array($part) && ($part['type'] ?? '') === 'text' ? trim((string) ($part['text'] ?? '')) : '', $parts)));
    if ($content === '') throw new RuntimeException('Anthropic Claude tidak mengembalikan jawaban teks.');
    return $content;
}

function ai_provider_completion(array $settings, string $apiKey, string $systemPrompt, string $userPrompt, bool $allowWebSearch = false, ?string $imageDataUrl = null): string
{
    // Keep the provider dispatch explicit. This file is loaded by the central
    // API router, so a parser incompatibility here would break every API route.
    if ($settings['adapter'] === 'gemini') {
        return ai_gemini_completion($settings, $apiKey, $systemPrompt, $userPrompt);
    }

    if ($settings['adapter'] === 'anthropic') {
        return ai_anthropic_completion($settings, $apiKey, $systemPrompt, $userPrompt);
    }

    return ai_openai_compatible_completion($settings, $apiKey, $systemPrompt, $userPrompt, $allowWebSearch, $imageDataUrl);
}

function ai_sse_start(): void
{
    // A streamed answer may outlive the visible panel. Keep the server-side
    // request alive so the conversation and final APPI response are recorded
    // even when the learner navigates away before the connection closes.
    @ignore_user_abort(true);
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    if (function_exists('apache_setenv')) {
        @apache_setenv('no-gzip', '1');
    }
    @ini_set('zlib.output_compression', '0');
    header('Content-Type: text/event-stream; charset=utf-8');
    header('Cache-Control: no-cache, no-transform');
    header('Connection: keep-alive');
    header('X-Accel-Buffering: no');
}

function ai_sse_emit(string $event, array $payload = []): void
{
    echo 'event: ' . preg_replace('/[^a-z_-]/i', '', $event) . "\n";
    echo 'data: ' . json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE) . "\n\n";
    flush();
}

function ai_openrouter_stream_completion(array $settings, string $apiKey, string $systemPrompt, string $userPrompt, bool $allowWebSearch = false, ?string $imageDataUrl = null): string
{
    $headers = ai_registry_auth_headers($settings, $apiKey);
    $requestBody = [
        'model' => $settings['model'],
        'messages' => ai_openai_messages($systemPrompt, $userPrompt, $imageDataUrl),
        'temperature' => $settings['temperature'] ?? 0.3,
        'max_tokens' => $settings['maxTokens'] ?? AAPM_AI_MAX_TOKENS,
        'stream' => true,
    ];
    if ($settings['provider'] === 'openrouter') {
        // Only public output is sent to the browser. Provider reasoning is never relayed.
        $requestBody['reasoning'] = ['effort' => 'none', 'exclude' => true];
    }
    if ($allowWebSearch && $settings['provider'] === 'openrouter') {
        // OpenRouter runs this server-side tool only when the model needs current
        // information. The low cap keeps the learner-facing mode predictable.
        $requestBody['tools'] = [[
            'type' => 'openrouter:web_search',
            'parameters' => ['max_results' => 3, 'max_total_results' => 5],
        ]];
    }
    $payload = json_encode($requestBody, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if (!is_string($payload) || !function_exists('curl_init')) {
        throw new RuntimeException('Streaming provider AI belum tersedia.');
    }

    $lineBuffer = '';
    $receivedText = false;
    $responseText = '';
    $streamError = '';
    $handle = curl_init(rtrim((string) $settings['baseUrl'], '/') . ($settings['chatPath'] ?? '/chat/completions'));
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => max(15, min(180, (int) ($settings['timeoutSeconds'] ?? 70))),
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_USERAGENT => 'AAPM-Layer-Academy/1.0',
        CURLOPT_HTTPHEADER => array_merge(['Accept: text/event-stream', 'Content-Type: application/json'], $headers),
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$lineBuffer, &$receivedText, &$responseText, &$streamError): int {
            $lineBuffer .= str_replace("\r\n", "\n", $chunk);
            while (($lineEnd = strpos($lineBuffer, "\n")) !== false) {
                $line = trim(substr($lineBuffer, 0, $lineEnd));
                $lineBuffer = substr($lineBuffer, $lineEnd + 1);
                if (strpos($line, 'data:') !== 0) {
                    continue;
                }
                $data = trim(substr($line, 5));
                if ($data === '' || $data === '[DONE]') {
                    continue;
                }
                $decoded = json_decode($data, true);
                if (!is_array($decoded)) {
                    continue;
                }
                $error = trim((string) ($decoded['error']['message'] ?? ''));
                if ($error !== '') {
                    $streamError = $error;
                    continue;
                }
                $content = $decoded['choices'][0]['delta']['content'] ?? '';
                if (is_array($content)) {
                    $content = implode('', array_filter(array_map(static fn ($part): string => is_array($part) ? (string) ($part['text'] ?? '') : '', $content)));
                }
                $content = (string) $content;
                if ($content !== '') {
                    if (!$receivedText) {
                        ai_sse_emit('status', ['label' => 'APPI menulis jawaban']);
                    }
                    $receivedText = true;
                    $responseText .= $content;
                    ai_sse_emit('delta', ['text' => $content]);
                }
            }
            return strlen($chunk);
        },
    ]);
    $ok = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
    $curlError = curl_error($handle);
    curl_close($handle);
    if ($ok === false || $status < 200 || $status >= 300 || $streamError !== '' || !$receivedText) {
        $detail = $streamError !== '' ? $streamError : ($curlError !== '' ? $curlError : 'provider tidak mengirim jawaban streaming');
        throw new RuntimeException((string) $settings['providerLabel'] . ': ' . substr($detail, 0, 220));
    }

    return $responseText;
}

function ai_assistant_stream(string $message, array $farmContext, bool $allowWebSearch = false, ?string $imageDataUrl = null, string $pageContext = '', string $accountMemory = '', array $accountContext = []): array
{
    $settings = ai_settings_status();
    $apiKey = ai_api_key($settings);
    ai_sse_emit('status', ['label' => 'APPI memeriksa konteks KPI']);
    try {
        if (!$settings['enabled'] || ($settings['apiKeyRequired'] && $apiKey === '')) {
            throw new RuntimeException('Provider belum dikonfigurasi.');
        }
        if ($accountMemory !== '') {
            ai_sse_emit('status', ['label' => 'APPI mengingat konteks percakapan']);
        }
        $webSearch = $allowWebSearch && $settings['provider'] === 'openrouter';
        if ($imageDataUrl !== null && empty($settings['supportsVision'])) {
            throw new RuntimeException('Provider atau model aktif belum ditandai mendukung input gambar.');
        }
        if ($webSearch) {
            ai_sse_emit('status', ['label' => 'APPI menyiapkan referensi web']);
        }
        if ($settings['adapter'] !== 'openai-compatible' || empty($settings['supportsStreaming'])) {
            ai_sse_emit('status', ['label' => 'APPI menghubungkan konteks dan pertanyaan']);
            $reply = ai_provider_completion($settings, $apiKey, ai_system_prompt(), ai_user_prompt($message, $farmContext, $pageContext, $accountMemory, $accountContext));
            ai_sse_emit('delta', ['text' => $reply]);
        } else {
            ai_sse_emit('status', ['label' => 'APPI menghubungkan konteks dan pertanyaan']);
            try {
                $reply = ai_openrouter_stream_completion($settings, $apiKey, ai_system_prompt(), ai_user_prompt($message, $farmContext, $pageContext, $accountMemory, $accountContext), $webSearch, $imageDataUrl);
            } catch (RuntimeException $exception) {
                // Free providers may occasionally reject a single request while
                // remaining healthy. Retry once before showing a local fallback.
                error_log('[aapm-ai-provider-retry] ' . $exception->getMessage());
                ai_sse_emit('status', ['label' => 'APPI menghubungkan ulang provider']);
                $reply = ai_openrouter_stream_completion($settings, $apiKey, ai_system_prompt(), ai_user_prompt($message, $farmContext, $pageContext, $accountMemory, $accountContext), $webSearch, $imageDataUrl);
            }
        }
        return ['reply' => $reply, 'provider' => $settings['provider'], 'model' => $settings['model'], 'fallback' => false, 'notice' => null];
    } catch (Throwable $exception) {
        error_log('[aapm-ai-provider] ' . $exception->getMessage());
        if ($imageDataUrl !== null) {
            $notice = 'Foto tidak dianalisis karena model aktif belum mendukung input gambar atau provider menolaknya.';
            $reply = 'APPI belum dapat membaca foto ini dengan model aktif. Pilih model OpenRouter yang mendukung input gambar di pengaturan admin, lalu coba lagi. Foto tidak disimpan di riwayat percakapan.';
            ai_sse_emit('notice', ['text' => $notice]);
            ai_sse_emit('delta', ['text' => $reply]);
            return ['reply' => $reply, 'provider' => 'local', 'model' => null, 'fallback' => true, 'notice' => $notice];
        }
        $reply = native_ai_reply($message, $farmContext);
        $notice = ai_provider_fallback_notice();
        ai_sse_emit('notice', ['text' => $notice]);
        ai_sse_emit('delta', ['text' => $reply]);
        return ['reply' => $reply, 'provider' => 'local', 'model' => null, 'fallback' => true, 'notice' => $notice];
    }
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

function ai_assistant_reply(string $message, array $farmContext, bool $allowWebSearch = false, array $accountContext = [], ?int $maxTokensOverride = null, int $messageLimit = 3000): array
{
    $settings = ai_settings_status();
    if ($maxTokensOverride !== null) {
        $settings['maxTokens'] = max(64, min(8192, $maxTokensOverride));
    }
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
        $reply = ai_provider_completion($settings, $apiKey, ai_system_prompt(), ai_user_prompt($message, $farmContext, '', '', $accountContext, $messageLimit), $allowWebSearch && $settings['provider'] === 'openrouter');
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
