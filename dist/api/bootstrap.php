<?php
declare(strict_types=1);

/**
 * Shared native API bootstrap.
 *
 * The app deliberately keeps all persistence behind this small PHP layer so
 * the React UI can run on cPanel without a hosted application platform.
 */

function app_config(): array
{
    static $config = null;

    if ($config !== null) {
        return $config;
    }

    $config = [
        'app_env' => getenv('AAPLAYERACADEMY_ENV') ?: 'local',
        'db_driver' => getenv('AAPLAYERACADEMY_DB_DRIVER') ?: 'sqlite',
        'db_host' => getenv('AAPLAYERACADEMY_DB_HOST') ?: '127.0.0.1',
        'db_port' => getenv('AAPLAYERACADEMY_DB_PORT') ?: '3306',
        'db_name' => getenv('AAPLAYERACADEMY_DB_NAME') ?: '',
        'db_user' => getenv('AAPLAYERACADEMY_DB_USER') ?: '',
        'db_password' => getenv('AAPLAYERACADEMY_DB_PASSWORD') ?: '',
        'db_path' => getenv('AAPLAYERACADEMY_DB_PATH') ?: '',
        'session_name' => getenv('AAPLAYERACADEMY_SESSION_NAME') ?: 'aapm_layer_session',
        'app_url' => getenv('AAPLAYERACADEMY_APP_URL') ?: '',
        'mail_from' => getenv('AAPLAYERACADEMY_MAIL_FROM') ?: '',
        'mail_host' => getenv('AAPLAYERACADEMY_MAIL_HOST') ?: '127.0.0.1',
        'mail_port' => (int) (getenv('AAPLAYERACADEMY_MAIL_PORT') ?: 25),
        'google_client_id' => getenv('AAPLAYERACADEMY_GOOGLE_CLIENT_ID') ?: '',
        'google_client_secret' => getenv('AAPLAYERACADEMY_GOOGLE_CLIENT_SECRET') ?: '',
        'google_redirect_uri' => getenv('AAPLAYERACADEMY_GOOGLE_REDIRECT_URI') ?: '',
        'admin_emails' => getenv('AAPLAYERACADEMY_ADMIN_EMAILS') ?: '',
        'expose_dev_reset_token' => false,
    ];

    $configuredPath = getenv('AAPLAYERACADEMY_CONFIG');
    $candidatePaths = array_filter([
        $configuredPath ?: null,
        dirname(__DIR__, 2) . '/config.php',
        dirname(__DIR__, 2) . '/config.local.php',
        dirname(__DIR__, 3) . '/aapmlayeracademy-config.php',
        dirname(__DIR__, 4) . '/aapmlayeracademy-config.php',
    ]);

    foreach ($candidatePaths as $path) {
        if (!is_file($path)) {
            continue;
        }

        $fileConfig = require $path;
        if (is_array($fileConfig)) {
            $config = array_merge($config, $fileConfig);
        }
        break;
    }

    if ($config['db_driver'] === 'sqlite' && !$config['db_path']) {
        $config['db_path'] = dirname(__DIR__, 2) . '/storage/aapmlayeracademy.sqlite';
    }

    return $config;
}

function db(): PDO
{
    static $pdo = null;
    static $schemaReady = false;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $config = app_config();
    $driver = strtolower((string) $config['db_driver']);

    if ($driver === 'sqlite') {
        $path = (string) $config['db_path'];
        $directory = dirname($path);
        if (!is_dir($directory)) {
            @mkdir($directory, 0775, true);
        }
        $pdo = new PDO('sqlite:' . $path);
        $pdo->exec('PRAGMA foreign_keys = ON');
    } else {
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            $config['db_host'],
            $config['db_port'],
            $config['db_name']
        );
        $pdo = new PDO($dsn, (string) $config['db_user'], (string) $config['db_password']);
    }

    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    if (!$schemaReady) {
        ensure_schema($pdo, $driver);
        $schemaReady = true;
    }

    return $pdo;
}

function ensure_schema(PDO $pdo, string $driver): void
{
    if ($driver === 'sqlite') {
        $statements = [
            'CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                full_name TEXT NOT NULL DEFAULT \'\',
                role TEXT NOT NULL DEFAULT \'user\',
                reset_token_hash TEXT NULL,
                reset_token_expires_at TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )',
            'CREATE TABLE IF NOT EXISTS auth_rate_limits (
                bucket_key TEXT PRIMARY KEY,
                attempts INTEGER NOT NULL DEFAULT 0,
                window_started_at INTEGER NOT NULL,
                blocked_until INTEGER NULL,
                updated_at INTEGER NOT NULL
            )',
            'CREATE TABLE IF NOT EXISTS course_modules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                level_number INTEGER NOT NULL,
                level_name TEXT NOT NULL DEFAULT \'\',
                module_number INTEGER NOT NULL UNIQUE,
                title TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT \'\',
                summary TEXT NOT NULL DEFAULT \'\',
                content TEXT NOT NULL,
                video_script TEXT NOT NULL DEFAULT \'\',
                learning_objectives TEXT NOT NULL DEFAULT \'[]\',
                key_takeaways TEXT NOT NULL DEFAULT \'[]\',
                checklist TEXT NOT NULL DEFAULT \'[]\',
                practical_assignment TEXT NOT NULL DEFAULT \'\',
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )',
            'CREATE TABLE IF NOT EXISTS quiz_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                module_number INTEGER NOT NULL,
                question TEXT NOT NULL,
                options TEXT NOT NULL DEFAULT \'[]\',
                correct_index INTEGER NOT NULL DEFAULT 0,
                explanation TEXT NOT NULL DEFAULT \'\',
                difficulty TEXT NOT NULL DEFAULT \'medium\',
                type TEXT NOT NULL DEFAULT \'mcq\',
                learning_objective TEXT NOT NULL DEFAULT \'\',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )',
            'CREATE TABLE IF NOT EXISTS user_progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                module_number INTEGER NOT NULL,
                completed INTEGER NOT NULL DEFAULT 0,
                quiz_score INTEGER NULL,
                quiz_total INTEGER NULL,
                practical_done INTEGER NOT NULL DEFAULT 0,
                time_spent_minutes INTEGER NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, module_number),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )',
            'CREATE TABLE IF NOT EXISTS certificates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                level_number INTEGER NOT NULL,
                level_name TEXT NOT NULL,
                score REAL NOT NULL DEFAULT 0,
                exam_type TEXT NOT NULL,
                holder_name TEXT NOT NULL DEFAULT \'\',
                issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, level_number, exam_type),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )',
            'CREATE TABLE IF NOT EXISTS farm_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                week INTEGER NOT NULL,
                hen_day_production REAL NULL,
                feed_intake REAL NULL,
                egg_weight REAL NULL,
                mortality REAL NULL,
                water_intake REAL NULL,
                temperature REAL NULL,
                humidity REAL NULL,
                revenue REAL NULL,
                cost REAL NULL,
                fcr REAL NULL,
                notes TEXT NOT NULL DEFAULT \'\',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )',
        ];
    } else {
        $statements = [
            'CREATE TABLE IF NOT EXISTS users (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                email VARCHAR(190) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(160) NOT NULL DEFAULT \'\',
                role VARCHAR(20) NOT NULL DEFAULT \'user\',
                reset_token_hash CHAR(64) NULL,
                reset_token_expires_at DATETIME NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY users_email_unique (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
            'CREATE TABLE IF NOT EXISTS auth_rate_limits (
                bucket_key VARCHAR(190) NOT NULL,
                attempts INT UNSIGNED NOT NULL DEFAULT 0,
                window_started_at BIGINT UNSIGNED NOT NULL,
                blocked_until BIGINT UNSIGNED NULL,
                updated_at BIGINT UNSIGNED NOT NULL,
                PRIMARY KEY (bucket_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
            'CREATE TABLE IF NOT EXISTS course_modules (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                level_number TINYINT UNSIGNED NOT NULL,
                level_name VARCHAR(160) NOT NULL DEFAULT \'\',
                module_number SMALLINT UNSIGNED NOT NULL,
                title VARCHAR(255) NOT NULL,
                category VARCHAR(160) NOT NULL DEFAULT \'\',
                summary TEXT NOT NULL,
                content MEDIUMTEXT NOT NULL,
                video_script TEXT NOT NULL,
                learning_objectives LONGTEXT NOT NULL,
                key_takeaways LONGTEXT NOT NULL,
                checklist LONGTEXT NOT NULL,
                practical_assignment TEXT NOT NULL,
                sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY course_modules_number_unique (module_number),
                KEY course_modules_order_idx (sort_order)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
            'CREATE TABLE IF NOT EXISTS quiz_questions (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                module_number SMALLINT NOT NULL,
                question TEXT NOT NULL,
                options LONGTEXT NOT NULL,
                correct_index TINYINT UNSIGNED NOT NULL DEFAULT 0,
                explanation TEXT NOT NULL,
                difficulty VARCHAR(20) NOT NULL DEFAULT \'medium\',
                type VARCHAR(20) NOT NULL DEFAULT \'mcq\',
                learning_objective TEXT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY quiz_questions_module_idx (module_number)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
            'CREATE TABLE IF NOT EXISTS user_progress (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                user_id BIGINT UNSIGNED NOT NULL,
                module_number SMALLINT NOT NULL,
                completed TINYINT(1) NOT NULL DEFAULT 0,
                quiz_score SMALLINT NULL,
                quiz_total SMALLINT NULL,
                practical_done TINYINT(1) NOT NULL DEFAULT 0,
                time_spent_minutes INT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY user_progress_unique (user_id, module_number),
                CONSTRAINT user_progress_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
            'CREATE TABLE IF NOT EXISTS certificates (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                user_id BIGINT UNSIGNED NOT NULL,
                level_number TINYINT UNSIGNED NOT NULL,
                level_name VARCHAR(190) NOT NULL,
                score DECIMAL(5,2) NOT NULL DEFAULT 0,
                exam_type VARCHAR(20) NOT NULL,
                holder_name VARCHAR(190) NOT NULL DEFAULT \'\',
                issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY certificates_unique (user_id, level_number, exam_type),
                CONSTRAINT certificates_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
            'CREATE TABLE IF NOT EXISTS farm_data (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                user_id BIGINT UNSIGNED NOT NULL,
                week SMALLINT UNSIGNED NOT NULL,
                hen_day_production DECIMAL(8,3) NULL,
                feed_intake DECIMAL(10,3) NULL,
                egg_weight DECIMAL(10,3) NULL,
                mortality DECIMAL(8,3) NULL,
                water_intake DECIMAL(10,3) NULL,
                temperature DECIMAL(8,3) NULL,
                humidity DECIMAL(8,3) NULL,
                revenue DECIMAL(18,2) NULL,
                cost DECIMAL(18,2) NULL,
                fcr DECIMAL(8,3) NULL,
                notes TEXT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY farm_data_user_week_idx (user_id, week),
                CONSTRAINT farm_data_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        ];
    }

    foreach ($statements as $statement) {
        $pdo->exec($statement);
    }
}

function start_app_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $config = app_config();
    $isSecure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.cookie_secure', $isSecure ? '1' : '0');
    ini_set('session.cookie_samesite', 'Lax');
    session_name((string) $config['session_name']);
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $isSecure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function apply_security_headers(): void
{
    if (headers_sent()) {
        return;
    }

    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    }
}

function json_response($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(['data' => $data], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function error_response(string $message, int $status = 400, string $code = 'bad_request'): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(['error' => ['message' => $message, 'code' => $code]], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function request_json(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function request_header(string $name): string
{
    $serverKey = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    return isset($_SERVER[$serverKey]) ? trim((string) $_SERVER[$serverKey]) : '';
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return (string) $_SESSION['csrf_token'];
}

function require_csrf(): void
{
    $expected = csrf_token();
    $received = request_header('X-CSRF-Token');
    if (!$received || !hash_equals($expected, $received)) {
        error_response('Permintaan tidak valid. Muat ulang halaman dan coba lagi.', 419, 'csrf_failed');
    }
}

function current_user(): ?array
{
    if (empty($_SESSION['user_id'])) {
        return null;
    }

    $stmt = db()->prepare('SELECT id, email, full_name, role, created_at FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([(int) $_SESSION['user_id']]);
    $user = $stmt->fetch();
    return $user ? present_authenticated_user($user) : null;
}

function require_user(): array
{
    $user = current_user();
    if (!$user) {
        error_response('Silakan login terlebih dahulu.', 401, 'auth_required');
    }
    return $user;
}

/**
 * The original app used `user` as its database default. The public API now
 * exposes only the bounded learner/admin role contract while preserving every
 * existing account and schema value.
 */
function configured_admin_emails(): array
{
    $value = (string) (app_config()['admin_emails'] ?? '');
    $emails = array_filter(array_map('normalize_email', explode(',', $value)));
    return array_values(array_unique($emails));
}

function effective_user_role(array $user): string
{
    if (strtolower(trim((string) ($user['role'] ?? ''))) === 'admin') {
        return 'admin';
    }

    return in_array(normalize_email($user['email'] ?? ''), configured_admin_emails(), true)
        ? 'admin'
        : 'learner';
}

function present_authenticated_user(array $user): array
{
    return [
        'id' => (int) ($user['id'] ?? 0),
        'email' => (string) ($user['email'] ?? ''),
        'full_name' => (string) ($user['full_name'] ?? ''),
        'role' => effective_user_role($user),
        'created_at' => $user['created_at'] ?? null,
    ];
}

function require_admin(): array
{
    $user = require_user();
    if (($user['role'] ?? 'learner') !== 'admin') {
        error_response('Akses admin diperlukan.', 403, 'admin_required');
    }
    return $user;
}

function normalize_email($email): string
{
    return strtolower(trim((string) $email));
}

function password_algorithm()
{
    if (defined('PASSWORD_ARGON2ID') && in_array('argon2id', password_algos(), true)) {
        return PASSWORD_ARGON2ID;
    }

    return PASSWORD_DEFAULT;
}

function app_password_hash(string $password): string
{
    return password_hash($password, password_algorithm());
}

function password_validation_error(string $password): string
{
    if (strlen($password) < 8) {
        return 'Password minimal 8 karakter.';
    }
    if (strlen($password) > 128) {
        return 'Password maksimal 128 karakter.';
    }
    if (!preg_match('/[A-Za-z]/', $password) || !preg_match('/[0-9]/', $password)) {
        return 'Password harus memuat minimal satu huruf dan satu angka.';
    }

    return '';
}

function client_ip(): string
{
    $ip = trim((string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
    return $ip !== '' ? substr($ip, 0, 64) : 'unknown';
}

function rate_limit_bucket(string $scope, string $identity = ''): string
{
    return $scope . ':' . hash('sha256', client_ip() . '|' . normalize_email($identity));
}

function rate_limit_guard(string $scope, string $identity, int $maxAttempts, int $windowSeconds, int $blockSeconds): void
{
    $key = rate_limit_bucket($scope, $identity);
    $row = db()->prepare('SELECT attempts, window_started_at, blocked_until FROM auth_rate_limits WHERE bucket_key = ? LIMIT 1');
    $row->execute([$key]);
    $record = $row->fetch();
    if (!$record) {
        return;
    }

    $now = time();
    if ((int) ($record['window_started_at'] ?? 0) + $windowSeconds <= $now) {
        db()->prepare('DELETE FROM auth_rate_limits WHERE bucket_key = ?')->execute([$key]);
        return;
    }

    $blockedUntil = (int) ($record['blocked_until'] ?? 0);
    if ($blockedUntil > $now || (int) $record['attempts'] >= $maxAttempts) {
        if ($blockedUntil <= $now) {
            $blockedUntil = $now + $blockSeconds;
            db()->prepare('UPDATE auth_rate_limits SET blocked_until = ?, updated_at = ? WHERE bucket_key = ?')->execute([$blockedUntil, $now, $key]);
        }
        header('Retry-After: ' . max(1, $blockedUntil - $now));
        error_response('Terlalu banyak percobaan. Silakan coba lagi beberapa menit lagi.', 429, 'rate_limited');
    }
}

function rate_limit_failure(string $scope, string $identity, int $maxAttempts, int $windowSeconds, int $blockSeconds): void
{
    $key = rate_limit_bucket($scope, $identity);
    $now = time();
    $row = db()->prepare('SELECT attempts, window_started_at FROM auth_rate_limits WHERE bucket_key = ? LIMIT 1');
    $row->execute([$key]);
    $record = $row->fetch();

    if (!$record || (int) $record['window_started_at'] + $windowSeconds <= $now) {
        $insert = db()->prepare('INSERT INTO auth_rate_limits (bucket_key, attempts, window_started_at, blocked_until, updated_at) VALUES (?, ?, ?, ?, ?)');
        $insert->execute([$key, 1, $now, 1 >= $maxAttempts ? $now + $blockSeconds : null, $now]);
        return;
    }

    $attempts = (int) $record['attempts'] + 1;
    $blockedUntil = $attempts >= $maxAttempts ? $now + $blockSeconds : null;
    db()->prepare('UPDATE auth_rate_limits SET attempts = ?, blocked_until = ?, updated_at = ? WHERE bucket_key = ?')->execute([$attempts, $blockedUntil, $now, $key]);
}

function rate_limit_clear(string $scope, string $identity = ''): void
{
    db()->prepare('DELETE FROM auth_rate_limits WHERE bucket_key = ?')->execute([rate_limit_bucket($scope, $identity)]);
}

function app_base_url(): string
{
    $configured = rtrim(trim((string) (app_config()['app_url'] ?? '')), '/');
    if ($configured !== '') {
        return $configured;
    }

    $host = trim((string) ($_SERVER['HTTP_HOST'] ?? ''));
    if (!preg_match('/\A[a-z0-9.-]+(?::[0-9]+)?\z/i', $host)) {
        return '';
    }

    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    return $scheme . '://' . $host;
}

function safe_return_path($value): string
{
    $path = trim((string) $value);
    if ($path === '' || $path[0] !== '/' || substr($path, 0, 2) === '//' || strpos($path, '://') !== false) {
        return '/';
    }

    return substr($path, 0, 500);
}

function password_reset_url(string $token): string
{
    $baseUrl = app_base_url();
    return $baseUrl . '/reset-password?token=' . rawurlencode($token);
}

function send_password_reset_email(string $email, string $token): bool
{
    $from = trim((string) (app_config()['mail_from'] ?? ''));
    if ($from === '' || !filter_var($from, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $link = password_reset_url($token);
    if (strpos($link, '://') === false) {
        return false;
    }

    $subject = 'Reset password AAPM Layer Academy';
    $body = "Halo,\n\nKami menerima permintaan untuk mengganti password akun AAPM Layer Academy Anda.\n\nBuka link berikut dalam waktu 60 menit:\n" . $link . "\n\nJika Anda tidak meminta perubahan ini, abaikan email ini.\n";
    $headers = implode("\r\n", [
        'From: ' . $from,
        'Reply-To: ' . $from,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
    ]);

    if (function_exists('mail') && @mail($email, $subject, $body, $headers)) {
        return true;
    }

    return send_smtp_email($email, $from, $subject, $body);
}

function smtp_response($socket): string
{
    $response = '';
    while (($line = fgets($socket, 512)) !== false) {
        $response .= $line;
        if (strlen($line) < 4 || $line[3] === ' ') {
            break;
        }
    }

    return $response;
}

function smtp_code(string $response): int
{
    return (int) substr(trim($response), 0, 3);
}

function smtp_command($socket, string $command, array $expectedCodes): bool
{
    if (fwrite($socket, $command . "\r\n") === false) {
        return false;
    }

    return in_array(smtp_code(smtp_response($socket)), $expectedCodes, true);
}

function send_smtp_email(string $email, string $from, string $subject, string $body): bool
{
    $config = app_config();
    $host = (string) ($config['mail_host'] ?? '127.0.0.1');
    $port = (int) ($config['mail_port'] ?? 25);
    $errno = 0;
    $error = '';
    $socket = @fsockopen($host, $port, $errno, $error, 5);
    if (!$socket) {
        return false;
    }
    stream_set_timeout($socket, 5);

    $connected = smtp_code(smtp_response($socket)) === 220;
    $connected = $connected && smtp_command($socket, 'EHLO ' . (parse_url(app_base_url(), PHP_URL_HOST) ?: 'localhost'), [250]);
    $connected = $connected && smtp_command($socket, 'MAIL FROM:<' . $from . '>', [250]);
    $connected = $connected && smtp_command($socket, 'RCPT TO:<' . $email . '>', [250, 251]);
    $connected = $connected && smtp_command($socket, 'DATA', [354]);

    if ($connected) {
        $message = implode("\r\n", [
            'From: ' . $from,
            'To: ' . $email,
            'Subject: ' . $subject,
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            '',
            $body,
        ]);
        $message = preg_replace('/(?m)^\./', '..', $message);
        $connected = fwrite($socket, $message . "\r\n.\r\n") !== false
            && in_array(smtp_code(smtp_response($socket)), [250], true);
    }

    if (is_resource($socket)) {
        @fwrite($socket, "QUIT\r\n");
        fclose($socket);
    }

    return $connected;
}

function nullable_number(array $data, string $key)
{
    if (!array_key_exists($key, $data) || $data[$key] === '' || $data[$key] === null) {
        return null;
    }
    return is_numeric($data[$key]) ? (float) $data[$key] : null;
}

function bool_value($value): int
{
    return filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
}

function decode_json_field($value): array
{
    $decoded = json_decode((string) $value, true);
    return is_array($decoded) ? $decoded : [];
}

function present_module(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'level' => (int) $row['level_number'],
        'levelName' => $row['level_name'],
        'moduleNumber' => (int) $row['module_number'],
        'title' => $row['title'],
        'category' => $row['category'],
        'summary' => $row['summary'],
        'content' => $row['content'],
        'videoScript' => $row['video_script'],
        'learningObjectives' => decode_json_field($row['learning_objectives']),
        'keyTakeaways' => decode_json_field($row['key_takeaways']),
        'checklist' => decode_json_field($row['checklist']),
        'practicalAssignment' => $row['practical_assignment'],
        'order' => (int) $row['sort_order'],
    ];
}

function present_question(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'moduleNumber' => (int) $row['module_number'],
        'question' => $row['question'],
        'options' => decode_json_field($row['options']),
        'correctIndex' => (int) $row['correct_index'],
        'explanation' => $row['explanation'],
        'difficulty' => $row['difficulty'],
        'type' => $row['type'],
        'learningObjective' => $row['learning_objective'],
    ];
}

function present_progress(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'moduleNumber' => (int) $row['module_number'],
        'completed' => (bool) $row['completed'],
        'quizScore' => $row['quiz_score'] === null ? null : (int) $row['quiz_score'],
        'quizTotal' => $row['quiz_total'] === null ? null : (int) $row['quiz_total'],
        'practicalDone' => (bool) $row['practical_done'],
        'timeSpentMinutes' => $row['time_spent_minutes'] === null ? null : (int) $row['time_spent_minutes'],
    ];
}

function admin_course_id(): string
{
    return 'layer-farm-management';
}

function admin_module_rows(): array
{
    return db()->query('SELECT id, level_number, level_name, module_number, title, category, summary, sort_order, created_at, updated_at FROM course_modules ORDER BY sort_order ASC, module_number ASC')->fetchAll();
}

function admin_course_data(): array
{
    $modules = admin_module_rows();
    $learnerCount = (int) db()->query('SELECT COUNT(DISTINCT user_id) FROM user_progress')->fetchColumn();
    $latestUpdate = null;
    foreach ($modules as $module) {
        $updatedAt = $module['updated_at'] ?? null;
        if ($updatedAt && ($latestUpdate === null || strcmp((string) $updatedAt, (string) $latestUpdate) > 0)) {
            $latestUpdate = $updatedAt;
        }
    }

    return [
        'id' => admin_course_id(),
        'title' => 'Layer Poultry Farm Management',
        'status' => count($modules) ? 'published' : 'unavailable',
        'moduleCount' => count($modules),
        'learnerCount' => $learnerCount,
        'updatedAt' => $latestUpdate,
        'capabilities' => [
            'create' => false,
            'edit' => false,
            'publish' => false,
            'reorder' => false,
        ],
        'availabilityNote' => 'Course saat ini berasal dari katalog modul native. Pembuatan, publish, dan re-order belum tersedia pada API.',
    ];
}

function admin_overview_data(): array
{
    $modules = admin_module_rows();
    $totalModules = count($modules);
    $totalLearners = (int) db()->query("SELECT COUNT(*) FROM users WHERE LOWER(role) <> 'admin'")->fetchColumn();
    $learnersWithProgress = (int) db()->query('SELECT COUNT(DISTINCT user_id) FROM user_progress')->fetchColumn();

    $progressRows = db()->query('SELECT user_id, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed_count FROM user_progress GROUP BY user_id')->fetchAll();
    $completionTotal = 0.0;
    foreach ($progressRows as $row) {
        $completionTotal += $totalModules ? ((int) $row['completed_count'] / $totalModules) * 100 : 0;
    }
    $averageCompletion = count($progressRows) ? (int) round($completionTotal / count($progressRows)) : 0;

    $recentRegistrations = db()->query("SELECT id, email, full_name, role, created_at FROM users WHERE LOWER(role) <> 'admin' ORDER BY created_at DESC, id DESC LIMIT 5")->fetchAll();
    $recentCompletions = db()->query('SELECT p.user_id, u.full_name, u.email, p.module_number, m.title AS module_title, p.updated_at FROM user_progress p INNER JOIN users u ON u.id = p.user_id LEFT JOIN course_modules m ON m.module_number = p.module_number WHERE p.completed = 1 ORDER BY p.updated_at DESC, p.id DESC LIMIT 5')->fetchAll();

    return [
        'metrics' => [
            ['key' => 'learners', 'label' => 'Total learner', 'value' => $totalLearners, 'detail' => 'Akun non-admin yang terdaftar'],
            ['key' => 'active', 'label' => 'Learner dengan progres', 'value' => $learnersWithProgress, 'detail' => 'Memiliki progres tersimpan'],
            ['key' => 'courses', 'label' => 'Course tersedia', 'value' => count($modules) ? 1 : 0, 'detail' => 'Katalog native saat ini'],
            ['key' => 'completion', 'label' => 'Rata-rata penyelesaian', 'value' => $averageCompletion, 'suffix' => '%', 'detail' => 'Dari learner dengan progres'],
        ],
        'recentRegistrations' => array_map('present_authenticated_user', $recentRegistrations),
        'recentCompletions' => array_map(static function (array $row): array {
            return [
                'userId' => (int) $row['user_id'],
                'fullName' => (string) $row['full_name'],
                'email' => (string) $row['email'],
                'moduleNumber' => (int) $row['module_number'],
                'moduleTitle' => (string) ($row['module_title'] ?? ''),
                'completedAt' => $row['updated_at'] ?? null,
            ];
        }, $recentCompletions),
        'dataNote' => 'Ringkasan dihitung langsung dari akun, progres, dan modul native yang tersedia.',
    ];
}

function admin_course_detail_data(): array
{
    $course = admin_course_data();
    $modules = admin_module_rows();
    $levels = [];
    foreach ($modules as $module) {
        $levelNumber = (int) $module['level_number'];
        if (!isset($levels[$levelNumber])) {
            $levels[$levelNumber] = [
                'levelNumber' => $levelNumber,
                'levelName' => (string) $module['level_name'],
                'modules' => [],
            ];
        }
        $levels[$levelNumber]['modules'][] = [
            'id' => (int) $module['id'],
            'moduleNumber' => (int) $module['module_number'],
            'title' => (string) $module['title'],
            'category' => (string) $module['category'],
            'summary' => (string) $module['summary'],
            'order' => (int) $module['sort_order'],
            'updatedAt' => $module['updated_at'] ?? null,
        ];
    }

    $course['curriculum'] = array_values($levels);
    $course['moduleCount'] = count($modules);
    return $course;
}

function admin_learner_list(string $search = ''): array
{
    $search = trim($search);
    $sql = 'SELECT u.id, u.email, u.full_name, u.role, u.created_at, COUNT(DISTINCT p.module_number) AS progress_entries, SUM(CASE WHEN p.completed = 1 THEN 1 ELSE 0 END) AS completed_modules, MAX(p.updated_at) AS last_activity, COUNT(DISTINCT c.id) AS certificate_count FROM users u LEFT JOIN user_progress p ON p.user_id = u.id LEFT JOIN certificates c ON c.user_id = u.id';
    $params = [];
    if ($search !== '') {
        $sql .= ' WHERE LOWER(u.email) LIKE ? OR LOWER(u.full_name) LIKE ?';
        $needle = '%' . strtolower($search) . '%';
        $params = [$needle, $needle];
    }
    $sql .= ' GROUP BY u.id, u.email, u.full_name, u.role, u.created_at ORDER BY u.created_at DESC, u.id DESC LIMIT 200';
    $statement = db()->prepare($sql);
    $statement->execute($params);
    $totalModules = count(admin_module_rows());

    return array_map(static function (array $row) use ($totalModules): array {
        $user = present_authenticated_user($row);
        $completed = (int) ($row['completed_modules'] ?? 0);
        return array_merge($user, [
            'completedModules' => $completed,
            'progressPercent' => $totalModules ? (int) round(($completed / $totalModules) * 100) : 0,
            'progressEntries' => (int) ($row['progress_entries'] ?? 0),
            'lastActivity' => $row['last_activity'] ?? null,
            'certificateCount' => (int) ($row['certificate_count'] ?? 0),
        ]);
    }, $statement->fetchAll());
}

function admin_learner_detail(int $learnerId): ?array
{
    $statement = db()->prepare('SELECT id, email, full_name, role, created_at FROM users WHERE id = ? LIMIT 1');
    $statement->execute([$learnerId]);
    $row = $statement->fetch();
    if (!$row) {
        return null;
    }

    $moduleRows = admin_module_rows();
    $progressStatement = db()->prepare('SELECT p.module_number, p.completed, p.quiz_score, p.quiz_total, p.practical_done, p.time_spent_minutes, p.created_at, p.updated_at, m.title AS module_title, m.level_number, m.level_name FROM user_progress p LEFT JOIN course_modules m ON m.module_number = p.module_number WHERE p.user_id = ? ORDER BY p.updated_at DESC, p.module_number ASC');
    $progressStatement->execute([$learnerId]);
    $progressRows = $progressStatement->fetchAll();
    $certificateStatement = db()->prepare('SELECT id, level_number, level_name, score, exam_type, holder_name, issued_at FROM certificates WHERE user_id = ? ORDER BY issued_at DESC, id DESC');
    $certificateStatement->execute([$learnerId]);
    $certificates = $certificateStatement->fetchAll();

    $completedModules = 0;
    $minutes = 0;
    foreach ($progressRows as $progress) {
        $completedModules += (int) $progress['completed'] === 1 ? 1 : 0;
        $minutes += (int) ($progress['time_spent_minutes'] ?? 0);
    }

    return [
        'learner' => array_merge(present_authenticated_user($row), [
            'completedModules' => $completedModules,
            'progressPercent' => count($moduleRows) ? (int) round(($completedModules / count($moduleRows)) * 100) : 0,
            'timeSpentMinutes' => $minutes,
        ]),
        'progress' => array_map(static function (array $progress): array {
            return [
                'moduleNumber' => (int) $progress['module_number'],
                'moduleTitle' => (string) ($progress['module_title'] ?? 'Modul tidak tersedia'),
                'levelNumber' => $progress['level_number'] === null ? null : (int) $progress['level_number'],
                'levelName' => $progress['level_name'] ?? null,
                'completed' => (bool) $progress['completed'],
                'quizScore' => $progress['quiz_score'] === null ? null : (int) $progress['quiz_score'],
                'quizTotal' => $progress['quiz_total'] === null ? null : (int) $progress['quiz_total'],
                'practicalDone' => (bool) $progress['practical_done'],
                'timeSpentMinutes' => $progress['time_spent_minutes'] === null ? null : (int) $progress['time_spent_minutes'],
                'updatedAt' => $progress['updated_at'] ?? null,
            ];
        }, $progressRows),
        'certificates' => array_map('present_certificate', $certificates),
        'availabilityNote' => 'Riwayat ditampilkan dari progres dan sertifikat yang tersimpan. Aktivitas tanpa data progres belum tersedia di API native.',
    ];
}

function present_certificate(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'levelNumber' => (int) $row['level_number'],
        'levelName' => $row['level_name'],
        'score' => (float) $row['score'],
        'examType' => $row['exam_type'],
        'holderName' => $row['holder_name'],
        'issuedAt' => $row['issued_at'],
    ];
}

function present_farm_data(array $row): array
{
    $numberFields = ['hen_day_production', 'feed_intake', 'egg_weight', 'mortality', 'water_intake', 'temperature', 'humidity', 'revenue', 'cost', 'fcr'];
    $data = [
        'id' => (int) $row['id'],
        'week' => (int) $row['week'],
        'notes' => $row['notes'],
    ];

    $map = [
        'hen_day_production' => 'henDayProduction',
        'feed_intake' => 'feedIntake',
        'egg_weight' => 'eggWeight',
        'mortality' => 'mortality',
        'water_intake' => 'waterIntake',
        'temperature' => 'temperature',
        'humidity' => 'humidity',
        'revenue' => 'revenue',
        'cost' => 'cost',
        'fcr' => 'fcr',
    ];

    foreach ($numberFields as $field) {
        $data[$map[$field]] = $row[$field] === null ? null : (float) $row[$field];
    }

    return $data;
}
