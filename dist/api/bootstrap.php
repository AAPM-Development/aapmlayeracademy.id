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
        'expose_dev_reset_token' => true,
    ];

    $configuredPath = getenv('AAPLAYERACADEMY_CONFIG');
    $candidatePaths = array_filter([
        $configuredPath ?: null,
        dirname(__DIR__, 2) . '/config.php',
        dirname(__DIR__, 2) . '/config.local.php',
        dirname(__DIR__, 3) . '/aapmlayeracademy-config.php',
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
    return $user ?: null;
}

function require_user(): array
{
    $user = current_user();
    if (!$user) {
        error_response('Silakan login terlebih dahulu.', 401, 'auth_required');
    }
    return $user;
}

function normalize_email($email): string
{
    return strtolower(trim((string) $email));
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
