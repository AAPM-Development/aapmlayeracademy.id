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
        'openrouter_api_key' => getenv('AAPLAYERACADEMY_OPENROUTER_API_KEY') ?: '',
        'ai_provider' => getenv('AAPLAYERACADEMY_AI_PROVIDER') ?: '',
        'ai_api_key' => getenv('AAPLAYERACADEMY_AI_API_KEY') ?: '',
        'ai_model' => getenv('AAPLAYERACADEMY_AI_MODEL') ?: '',
        'ai_base_url' => getenv('AAPLAYERACADEMY_AI_BASE_URL') ?: '',
        'ai_allow_local' => getenv('AAPLAYERACADEMY_AI_ALLOW_LOCAL') ?: '',
        'ai_settings_encryption_key' => getenv('AAPLAYERACADEMY_AI_SETTINGS_ENCRYPTION_KEY') ?: '',
        'expose_dev_reset_token' => false,
    ];

    $configuredPath = getenv('AAPLAYERACADEMY_CONFIG');
    // cPanel deploys main to the account root's public_html and staging one
    // directory deeper. Resolve the shared private file from both layouts
    // before checking domain-local fallbacks; otherwise production can silently
    // fall back to SQLite while staging reads MySQL.
    $sharedConfigRoots = array_values(array_unique([
        dirname(__DIR__, 3),
        dirname(__DIR__, 2),
        dirname(__DIR__, 1),
        dirname(__DIR__, 4),
    ]));
    $sharedConfigPaths = array_map(
        static fn (string $root): string => $root . '/aapmlayeracademy-config.php',
        $sharedConfigRoots
    );
    $candidatePaths = array_filter(array_merge(
        [$configuredPath ?: null],
        $sharedConfigPaths,
        [
            dirname(__DIR__, 2) . '/config.php',
            dirname(__DIR__, 2) . '/config.local.php',
            dirname(__DIR__, 1) . '/config.php',
            dirname(__DIR__, 1) . '/config.local.php',
        ]
    ));

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

    // The same private config intentionally serves both public hosts. Keep
    // the runtime label host-aware so production does not inherit a staging
    // label from the shared file while both environments still use one DB.
    $requestHost = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
    $requestHost = (string) preg_replace('/:\\d+$/', '', $requestHost);
    if (in_array($requestHost, ['aapmlayeracademy.id', 'www.aapmlayeracademy.id'], true)) {
        $config['app_env'] = 'production';
    } elseif ($requestHost === 'staging.aapmlayeracademy.id') {
        $config['app_env'] = 'staging';
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
             'CREATE TABLE IF NOT EXISTS user_profiles (
                 user_id INTEGER PRIMARY KEY,
                 bio TEXT NOT NULL DEFAULT \'\',
                 hall_of_fame_opt_in INTEGER NOT NULL DEFAULT 0,
                 avatar_data TEXT NOT NULL DEFAULT \'\',
                 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
             )',
            'CREATE TABLE IF NOT EXISTS user_ai_settings (
                user_id INTEGER PRIMARY KEY,
                mode TEXT NOT NULL DEFAULT \'global\',
                provider_id TEXT NOT NULL DEFAULT \'\',
                model TEXT NOT NULL DEFAULT \'\',
                base_url TEXT NOT NULL DEFAULT \'\',
                adapter TEXT NOT NULL DEFAULT \'openai-compatible\',
                auth_mode TEXT NOT NULL DEFAULT \'bearer\',
                api_key_encrypted TEXT NOT NULL DEFAULT \'\',
                headers_encrypted TEXT NOT NULL DEFAULT \'\',
                oauth_provider TEXT NOT NULL DEFAULT \'\',
                oauth_access_token_encrypted TEXT NOT NULL DEFAULT \'\',
                oauth_refresh_token_encrypted TEXT NOT NULL DEFAULT \'\',
                oauth_expires_at TEXT NULL,
                 allow_local INTEGER NOT NULL DEFAULT 0,
                 supports_vision INTEGER NOT NULL DEFAULT 0,
                 enabled INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
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
                editorial_content TEXT NULL,
                video_script TEXT NOT NULL DEFAULT \'\',
                video_url TEXT NOT NULL DEFAULT \'\',
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
            'CREATE TABLE IF NOT EXISTS ai_conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL DEFAULT \'Percakapan baru\',
                last_message_preview TEXT NOT NULL DEFAULT \'\',
                message_count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                archived_at TEXT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )',
            'CREATE TABLE IF NOT EXISTS ai_chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                provider TEXT NULL,
                model TEXT NULL,
                used_fallback INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
            )',
            'CREATE TABLE IF NOT EXISTS ai_activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                conversation_id INTEGER NULL,
                event_type TEXT NOT NULL,
                label TEXT NOT NULL,
                detail TEXT NOT NULL DEFAULT \'\',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
            )',
            'CREATE TABLE IF NOT EXISTS app_settings (
                setting_key TEXT PRIMARY KEY,
                setting_value TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
             'CREATE TABLE IF NOT EXISTS user_profiles (
                 user_id BIGINT UNSIGNED NOT NULL,
                 bio TEXT NOT NULL,
                 hall_of_fame_opt_in TINYINT(1) NOT NULL DEFAULT 0,
                 avatar_data MEDIUMTEXT NOT NULL,
                 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                 PRIMARY KEY (user_id),
                 CONSTRAINT user_profiles_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
             ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
            'CREATE TABLE IF NOT EXISTS user_ai_settings (
                user_id BIGINT UNSIGNED NOT NULL,
                mode VARCHAR(24) NOT NULL DEFAULT \'global\',
                provider_id VARCHAR(80) NOT NULL DEFAULT \'\',
                model VARCHAR(220) NOT NULL DEFAULT \'\',
                base_url VARCHAR(500) NOT NULL DEFAULT \'\',
                adapter VARCHAR(32) NOT NULL DEFAULT \'openai-compatible\',
                auth_mode VARCHAR(20) NOT NULL DEFAULT \'bearer\',
                api_key_encrypted LONGTEXT NOT NULL,
                headers_encrypted LONGTEXT NOT NULL,
                oauth_provider VARCHAR(80) NOT NULL DEFAULT \'\',
                oauth_access_token_encrypted LONGTEXT NOT NULL,
                oauth_refresh_token_encrypted LONGTEXT NOT NULL,
                oauth_expires_at DATETIME NULL,
                 allow_local TINYINT(1) NOT NULL DEFAULT 0,
                 supports_vision TINYINT(1) NOT NULL DEFAULT 0,
                 enabled TINYINT(1) NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id),
                CONSTRAINT user_ai_settings_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
                editorial_content MEDIUMTEXT NULL,
                video_script TEXT NOT NULL,
                video_url TEXT NULL,
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
            'CREATE TABLE IF NOT EXISTS ai_conversations (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                user_id BIGINT UNSIGNED NOT NULL,
                title VARCHAR(180) NOT NULL DEFAULT \'Percakapan baru\',
                last_message_preview VARCHAR(280) NOT NULL DEFAULT \'\',
                message_count INT UNSIGNED NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                archived_at DATETIME NULL,
                PRIMARY KEY (id),
                KEY ai_conversations_user_updated_idx (user_id, updated_at),
                KEY ai_conversations_user_archive_idx (user_id, archived_at, updated_at, id),
                CONSTRAINT ai_conversations_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
            'CREATE TABLE IF NOT EXISTS ai_chat_messages (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                conversation_id BIGINT UNSIGNED NOT NULL,
                role VARCHAR(16) NOT NULL,
                content MEDIUMTEXT NOT NULL,
                provider VARCHAR(80) NULL,
                model VARCHAR(190) NULL,
                used_fallback TINYINT(1) NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY ai_chat_messages_conversation_idx (conversation_id, id),
                CONSTRAINT ai_chat_messages_conversation_fk FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
            'CREATE TABLE IF NOT EXISTS ai_activity_log (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                user_id BIGINT UNSIGNED NOT NULL,
                conversation_id BIGINT UNSIGNED NULL,
                event_type VARCHAR(32) NOT NULL,
                label VARCHAR(160) NOT NULL,
                detail VARCHAR(280) NOT NULL DEFAULT \'\',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY ai_activity_user_created_idx (user_id, created_at),
                KEY ai_activity_conversation_idx (conversation_id),
                CONSTRAINT ai_activity_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT ai_activity_conversation_fk FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
            'CREATE TABLE IF NOT EXISTS app_settings (
                setting_key VARCHAR(100) NOT NULL,
                setting_value LONGTEXT NOT NULL,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (setting_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
        ];
    }

    foreach ($statements as $statement) {
        $pdo->exec($statement);
    }

    ensure_course_module_editorial_content($pdo, $driver);
    ensure_course_module_video_url($pdo, $driver);
    ensure_user_profile_avatar($pdo, $driver);
    ensure_user_ai_supports_vision($pdo, $driver);
    ensure_ai_conversation_archive($pdo, $driver);
    ensure_default_course_module_videos($pdo);
    ensure_editorial_course_module_videos($pdo);
}

function ensure_ai_conversation_archive(PDO $pdo, string $driver): void
{
    if ($driver === 'sqlite') {
        $columns = $pdo->query('PRAGMA table_info(ai_conversations)')->fetchAll();
        foreach ($columns as $column) {
            if (($column['name'] ?? '') === 'archived_at') return;
        }
        $pdo->exec('ALTER TABLE ai_conversations ADD COLUMN archived_at TEXT NULL');
        return;
    }

    $column = $pdo->prepare('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1');
    $column->execute(['ai_conversations', 'archived_at']);
    if (!$column->fetchColumn()) {
        $pdo->exec('ALTER TABLE ai_conversations ADD COLUMN archived_at DATETIME NULL AFTER updated_at');
    }
}

function ensure_user_profile_avatar(PDO $pdo, string $driver): void
{
    if ($driver === 'sqlite') {
        $columns = $pdo->query('PRAGMA table_info(user_profiles)')->fetchAll();
        foreach ($columns as $column) {
            if (($column['name'] ?? '') === 'avatar_data') {
                return;
            }
        }
        $pdo->exec("ALTER TABLE user_profiles ADD COLUMN avatar_data TEXT NOT NULL DEFAULT ''");
        return;
    }

    $column = $pdo->prepare('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1');
    $column->execute(['user_profiles', 'avatar_data']);
    if (!$column->fetchColumn()) {
        $pdo->exec('ALTER TABLE user_profiles ADD COLUMN avatar_data MEDIUMTEXT NOT NULL AFTER hall_of_fame_opt_in');
    }
}

function ensure_user_ai_supports_vision(PDO $pdo, string $driver): void
{
    if ($driver === 'sqlite') {
        $columns = $pdo->query('PRAGMA table_info(user_ai_settings)')->fetchAll();
        foreach ($columns as $column) {
            if (($column['name'] ?? '') === 'supports_vision') return;
        }
        $pdo->exec("ALTER TABLE user_ai_settings ADD COLUMN supports_vision INTEGER NOT NULL DEFAULT 0");
        return;
    }

    $column = $pdo->prepare('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1');
    $column->execute(['user_ai_settings', 'supports_vision']);
    if (!$column->fetchColumn()) {
        $pdo->exec('ALTER TABLE user_ai_settings ADD COLUMN supports_vision TINYINT(1) NOT NULL DEFAULT 0 AFTER allow_local');
    }
}

function ensure_course_module_editorial_content(PDO $pdo, string $driver): void
{
    if ($driver === 'sqlite') {
        $columns = $pdo->query('PRAGMA table_info(course_modules)')->fetchAll();
        foreach ($columns as $column) {
            if (($column['name'] ?? '') === 'editorial_content') {
                return;
            }
        }
        try {
            $pdo->exec('ALTER TABLE course_modules ADD COLUMN editorial_content TEXT NULL');
        } catch (PDOException $exception) {
            if (!is_duplicate_column_exception($exception)) {
                throw $exception;
            }
        }
        return;
    }

    $column = $pdo->prepare('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1');
    $column->execute(['course_modules', 'editorial_content']);
    if (!$column->fetchColumn()) {
        try {
            $pdo->exec('ALTER TABLE course_modules ADD COLUMN editorial_content MEDIUMTEXT NULL AFTER content');
        } catch (PDOException $exception) {
            if (!is_duplicate_column_exception($exception)) {
                throw $exception;
            }
        }
    }
}

function is_duplicate_column_exception(PDOException $exception): bool
{
    $code = (string) $exception->getCode();
    $message = strtolower($exception->getMessage());
    return in_array($code, ['42S21', 'HY000'], true)
        && (strpos($message, 'duplicate column') !== false || strpos($message, 'duplicate field') !== false);
}

function ensure_course_module_video_url(PDO $pdo, string $driver): void
{
    if ($driver === 'sqlite') {
        $columns = $pdo->query('PRAGMA table_info(course_modules)')->fetchAll();
        foreach ($columns as $column) {
            if (($column['name'] ?? '') === 'video_url') {
                return;
            }
        }
        $pdo->exec("ALTER TABLE course_modules ADD COLUMN video_url TEXT NOT NULL DEFAULT ''");
        return;
    }

    $column = $pdo->prepare('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1');
    $column->execute(['course_modules', 'video_url']);
    if (!$column->fetchColumn()) {
        $pdo->exec('ALTER TABLE course_modules ADD COLUMN video_url TEXT NULL AFTER video_script');
    }
}

function default_course_module_video_urls(): array
{
    return [
        1 => 'https://www.youtube.com/watch?v=kvz8QQG_mXU',
        2 => 'https://www.youtube.com/watch?v=hsvid7YhOXU',
        3 => 'https://www.youtube.com/watch?v=nd5-NiPIC0I',
        4 => 'https://www.youtube.com/watch?v=Z_YYierQRas',
        5 => 'https://www.youtube.com/watch?v=DfI-cjQxIos',
        6 => 'https://www.youtube.com/watch?v=SD72BnoRSck',
        7 => 'https://www.youtube.com/watch?v=FRGJnDn8BGU',
        8 => 'https://www.youtube.com/watch?v=QOd_27gFlGk',
        9 => 'https://www.youtube.com/watch?v=Ust1NkPfzMw',
        10 => 'https://www.youtube.com/watch?v=Q9UpOZ_t6eg',
        11 => 'https://www.youtube.com/watch?v=8FCC6XPLfqw',
        12 => 'https://www.youtube.com/watch?v=gJYgqGw8ljw',
        13 => 'https://www.youtube.com/watch?v=bE5vhWqDiqU',
        14 => 'https://www.youtube.com/watch?v=ibl923M0i2E',
        15 => 'https://www.youtube.com/watch?v=RSMWvFUNd8o',
        16 => 'https://www.youtube.com/watch?v=v8TZ3Gx5edk',
        17 => 'https://www.youtube.com/watch?v=Urx09wfnosE',
        18 => 'https://www.youtube.com/watch?v=2aNSaA4RTec',
        19 => 'https://www.youtube.com/watch?v=x0xbE03LZxk',
        20 => 'https://www.youtube.com/watch?v=5QkDT-aCwVk',
        21 => 'https://www.youtube.com/watch?v=NyoRSGe7SBE',
        22 => 'https://www.youtube.com/watch?v=I-2NsGXXDnM',
    ];
}

function legacy_course_module_video_urls(): array
{
    return [
        1 => 'https://www.youtube.com/watch?v=CCzevPhnGug',
        2 => 'https://www.youtube.com/watch?v=WDTqNVn7tes',
        3 => 'https://www.youtube.com/watch?v=M779w9jCmZA',
        4 => 'https://www.youtube.com/watch?v=M779w9jCmZA',
        5 => 'https://www.youtube.com/watch?v=WDTqNVn7tes',
        6 => 'https://www.youtube.com/watch?v=lIHkrDIh4O8',
        7 => 'https://www.youtube.com/watch?v=lIHkrDIh4O8',
        8 => 'https://www.youtube.com/watch?v=V_EellDKgRs',
        9 => 'https://www.youtube.com/watch?v=Q1lDTpEXmIc',
        10 => 'https://www.youtube.com/watch?v=Q1lDTpEXmIc',
        11 => 'https://www.youtube.com/watch?v=lIHkrDIh4O8',
        12 => 'https://www.youtube.com/watch?v=aUckv3knhms',
        13 => 'https://www.youtube.com/watch?v=WDTqNVn7tes',
        14 => 'https://www.youtube.com/watch?v=lIHkrDIh4O8',
        15 => 'https://www.youtube.com/watch?v=lIHkrDIh4O8',
        16 => 'https://www.youtube.com/watch?v=CCzevPhnGug',
        17 => 'https://www.youtube.com/watch?v=CCzevPhnGug',
        18 => 'https://www.youtube.com/watch?v=CCzevPhnGug',
        19 => 'https://www.youtube.com/watch?v=lIHkrDIh4O8',
        20 => 'https://www.youtube.com/watch?v=lIHkrDIh4O8',
        21 => 'https://www.youtube.com/watch?v=CCzevPhnGug',
        22 => 'https://www.youtube.com/watch?v=CCzevPhnGug',
    ];
}

function ensure_default_course_module_videos(PDO $pdo): void
{
    $migrationKey = 'course_module_video_defaults_20260825';
    $existing = $pdo->prepare('SELECT 1 FROM app_settings WHERE setting_key = ? LIMIT 1');
    $existing->execute([$migrationKey]);
    if ($existing->fetchColumn()) {
        return;
    }

    $update = $pdo->prepare("UPDATE course_modules SET video_url = ? WHERE module_number = ? AND (video_url IS NULL OR TRIM(video_url) = '')");
    foreach (default_course_module_video_urls() as $moduleNumber => $videoUrl) {
        $update->execute([$videoUrl, $moduleNumber]);
    }

    $marker = $pdo->prepare('INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)');
    try {
        $marker->execute([$migrationKey, 'complete']);
    } catch (PDOException $exception) {
        if ((string) $exception->getCode() !== '23000') {
            throw $exception;
        }
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

    $stmt = db()->prepare('SELECT u.id, u.email, u.full_name, u.role, u.created_at, COALESCE(p.avatar_data, \'\') AS avatar_data FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = ? LIMIT 1');
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
        'avatar' => (string) ($user['avatar_data'] ?? $user['avatar'] ?? ''),
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

function ensure_editorial_course_module_videos(PDO $pdo): void
{
    $migrationKey = 'course_module_video_editorial_refresh_20260901';
    $existing = $pdo->prepare('SELECT 1 FROM app_settings WHERE setting_key = ? LIMIT 1');
    $existing->execute([$migrationKey]);
    if ($existing->fetchColumn()) {
        return;
    }

    $legacy = legacy_course_module_video_urls();
    foreach (default_course_module_video_urls() as $moduleNumber => $videoUrl) {
        $legacyUrl = $legacy[$moduleNumber] ?? '';
        $legacyValues = array_values(array_unique(array_filter([
            $legacyUrl,
            $legacyUrl !== '' ? normalise_lesson_video_url($legacyUrl) : '',
        ])));
        $placeholders = implode(', ', array_fill(0, count($legacyValues), '?'));
        $update = $pdo->prepare("UPDATE course_modules SET video_url = ? WHERE module_number = ? AND (video_url IS NULL OR TRIM(video_url) = '' OR video_url IN ({$placeholders}))");
        $update->execute(array_merge([$videoUrl, $moduleNumber], $legacyValues));
    }

    $marker = $pdo->prepare('INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)');
    try {
        $marker->execute([$migrationKey, 'complete']);
    } catch (PDOException $exception) {
        if ((string) $exception->getCode() !== '23000') {
            throw $exception;
        }
    }
}

function decode_editorial_content($value): ?array
{
    if (!is_string($value) || trim($value) === '') {
        return null;
    }
    $decoded = json_decode($value, true);
    if (!is_array($decoded) || !isset($decoded['blocks']) || !is_array($decoded['blocks'])) {
        return null;
    }
    return $decoded;
}

function normalise_editorial_presentation($value): array
{
    $source = is_array($value) ? $value : [];
    $objectives = isset($source['objectives']) && is_array($source['objectives'])
        ? $source['objectives']
        : [];
    $practical = isset($source['practical']) && is_array($source['practical'])
        ? $source['practical']
        : [];

    $pick = static function ($candidate, array $allowed, string $fallback): string {
        $candidate = (string) $candidate;
        return in_array($candidate, $allowed, true) ? $candidate : $fallback;
    };

    return [
        'objectives' => [
            'layout' => $pick($objectives['layout'] ?? '', ['columns', 'stacked'], 'columns'),
            'tone' => $pick($objectives['tone'] ?? '', ['neutral', 'green', 'orange', 'blue', 'violet'], 'neutral'),
            'density' => $pick($objectives['density'] ?? '', ['comfortable', 'compact'], 'comfortable'),
        ],
        'practical' => [
            'tone' => $pick($practical['tone'] ?? '', ['green', 'orange', 'blue', 'violet', 'neutral'], 'green'),
            'density' => $pick($practical['density'] ?? '', ['comfortable', 'compact'], 'comfortable'),
            'checklistStyle' => $pick($practical['checklistStyle'] ?? '', ['checkbox', 'list'], 'checkbox'),
        ],
    ];
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
        'editorialContent' => decode_editorial_content($row['editorial_content'] ?? null),
        'videoScript' => $row['video_script'],
        'videoUrl' => $row['video_url'] ?? '',
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
        'createdAt' => $row['created_at'] ?? null,
        'updatedAt' => $row['updated_at'] ?? null,
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

function admin_module_number_exists(int $moduleNumber): bool
{
    $statement = db()->prepare('SELECT id FROM course_modules WHERE module_number = ? LIMIT 1');
    $statement->execute([$moduleNumber]);
    return (bool) $statement->fetch();
}

function bounded_progress_percent(int $completed, int $total): int
{
    if ($total < 1) {
        return 0;
    }

    return max(0, min(100, (int) round(($completed / $total) * 100)));
}

/**
 * Keep all admin progress projections scoped to modules that still exist.
 * user_progress intentionally has no module foreign key because module
 * numbers are also used by the final exam (module 0). The inner join here
 * prevents orphaned rows from inflating progress after a module is removed.
 */
function admin_progress_aggregate_sql(): string
{
    return 'SELECT p.user_id,
        COUNT(DISTINCT p.module_number) AS progress_entries,
        COUNT(DISTINCT CASE WHEN p.completed = 1 THEN p.module_number END) AS completed_modules,
        COUNT(DISTINCT CASE WHEN p.practical_done = 1 THEN p.module_number END) AS practical_modules,
        SUM(CASE WHEN p.quiz_total IS NOT NULL AND p.quiz_total > 0 THEN
            CASE WHEN p.quiz_score IS NULL OR p.quiz_score < 0 THEN 0
                 WHEN p.quiz_score > p.quiz_total THEN p.quiz_total
                 ELSE p.quiz_score END
            ELSE 0 END) AS quiz_score_sum,
        SUM(CASE WHEN p.quiz_total IS NOT NULL AND p.quiz_total > 0 THEN p.quiz_total ELSE 0 END) AS quiz_total_sum,
        SUM(CASE WHEN p.time_spent_minutes IS NOT NULL AND p.time_spent_minutes > 0 THEN p.time_spent_minutes ELSE 0 END) AS minutes,
        MAX(p.updated_at) AS last_activity
        FROM user_progress p
        INNER JOIN course_modules m ON m.module_number = p.module_number
        GROUP BY p.user_id';
}

function admin_progress_summary(int $userId, ?int $totalModules = null): array
{
    $moduleTotal = $totalModules === null ? count(admin_module_rows()) : max(0, $totalModules);
    $statement = db()->prepare('SELECT
        COUNT(DISTINCT p.module_number) AS entries,
        COUNT(DISTINCT CASE WHEN p.completed = 1 THEN p.module_number END) AS completed_modules,
        COUNT(DISTINCT CASE WHEN p.practical_done = 1 THEN p.module_number END) AS practical_modules,
        SUM(CASE WHEN p.quiz_total IS NOT NULL AND p.quiz_total > 0 THEN
            CASE WHEN p.quiz_score IS NULL OR p.quiz_score < 0 THEN 0
                 WHEN p.quiz_score > p.quiz_total THEN p.quiz_total
                 ELSE p.quiz_score END
            ELSE 0 END) AS quiz_score_sum,
        SUM(CASE WHEN p.quiz_total IS NOT NULL AND p.quiz_total > 0 THEN p.quiz_total ELSE 0 END) AS quiz_total_sum,
        SUM(CASE WHEN p.time_spent_minutes IS NOT NULL AND p.time_spent_minutes > 0 THEN p.time_spent_minutes ELSE 0 END) AS minutes,
        MAX(p.updated_at) AS last_activity
        FROM user_progress p
        INNER JOIN course_modules m ON m.module_number = p.module_number
        WHERE p.user_id = ?');
    $statement->execute([$userId]);
    $row = $statement->fetch() ?: [];
    $completed = (int) ($row['completed_modules'] ?? 0);

    return [
        'entries' => (int) ($row['entries'] ?? 0),
        'completedModules' => $completed,
        'progressPercent' => bounded_progress_percent($completed, $moduleTotal),
        'practicalModules' => (int) ($row['practical_modules'] ?? 0),
        'quizScoreSum' => (float) ($row['quiz_score_sum'] ?? 0),
        'quizTotalSum' => (float) ($row['quiz_total_sum'] ?? 0),
        'timeSpentMinutes' => (int) ($row['minutes'] ?? 0),
        'lastActivity' => $row['last_activity'] ?? null,
    ];
}

function admin_learner_metric_rows(): array
{
    $sql = 'SELECT u.id, u.email, u.full_name, u.role, u.created_at,
        COALESCE(p.progress_entries, 0) AS progress_entries,
        COALESCE(p.completed_modules, 0) AS completed_modules,
        p.last_activity
        FROM users u
        LEFT JOIN (' . admin_progress_aggregate_sql() . ') p ON p.user_id = u.id';
    $rows = db()->query($sql)->fetchAll();

    return array_values(array_filter($rows, static function (array $row): bool {
        return effective_user_role($row) !== 'admin';
    }));
}

function admin_course_data(): array
{
    $modules = admin_module_rows();
    $learnerCount = count(admin_learner_metric_rows());
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
            'create' => true,
            'edit' => true,
            'publish' => true,
            'reorder' => true,
        ],
        'availabilityNote' => 'Kurikulum Academy dikelola langsung dari katalog modul native. Perubahan modul dan bank soal tersedia untuk admin; nomor modul tidak dapat diganti setelah learner menyimpan progres agar riwayat tetap konsisten.',
    ];
}

function admin_overview_data(): array
{
    $modules = admin_module_rows();
    $totalModules = count($modules);
    $learnerRows = admin_learner_metric_rows();
    $totalLearners = count($learnerRows);
    $learnersWithProgress = 0;
    $completionTotal = 0.0;
    foreach ($learnerRows as $row) {
        if ((int) ($row['progress_entries'] ?? 0) > 0) {
            $learnersWithProgress++;
        }
        $completionTotal += bounded_progress_percent((int) ($row['completed_modules'] ?? 0), $totalModules);
    }
    // Include learners with zero progress so the metric represents the whole
    // learner population, not only users who have already started.
    $averageCompletion = $totalLearners ? (int) round($completionTotal / $totalLearners) : 0;

    $registrationCandidates = db()->query('SELECT id, email, full_name, role, created_at FROM users ORDER BY created_at DESC, id DESC LIMIT 25')->fetchAll();
    $recentRegistrations = [];
    foreach ($registrationCandidates as $candidate) {
        if (effective_user_role($candidate) === 'admin') {
            continue;
        }
        $recentRegistrations[] = $candidate;
        if (count($recentRegistrations) >= 5) {
            break;
        }
    }

    $completionCandidates = db()->query('SELECT p.user_id, u.full_name, u.email, u.role, p.module_number, m.title AS module_title, p.updated_at FROM user_progress p INNER JOIN users u ON u.id = p.user_id INNER JOIN course_modules m ON m.module_number = p.module_number WHERE p.completed = 1 ORDER BY p.updated_at DESC, p.id DESC LIMIT 25')->fetchAll();
    $recentCompletions = [];
    foreach ($completionCandidates as $candidate) {
        if (effective_user_role($candidate) === 'admin') {
            continue;
        }
        $recentCompletions[] = $candidate;
        if (count($recentCompletions) >= 5) {
            break;
        }
    }

    return [
        'metrics' => [
            ['key' => 'learners', 'label' => 'Total learner', 'value' => $totalLearners, 'detail' => 'Akun non-admin yang terdaftar'],
            ['key' => 'active', 'label' => 'Learner dengan progres', 'value' => $learnersWithProgress, 'detail' => 'Memiliki progres tersimpan'],
            ['key' => 'courses', 'label' => 'Course tersedia', 'value' => count($modules) ? 1 : 0, 'detail' => 'Katalog native saat ini'],
            ['key' => 'completion', 'label' => 'Rata-rata penyelesaian', 'value' => $averageCompletion, 'suffix' => '%', 'detail' => 'Dari seluruh learner'],
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
    return array_values(array_filter(admin_account_list($search), static function (array $user): bool {
        return $user['role'] !== 'admin';
    }));
}

function admin_account_list(string $search = ''): array
{
    $search = trim($search);
    $sql = 'SELECT u.id, u.email, u.full_name, u.role, u.created_at,
        COALESCE(p.progress_entries, 0) AS progress_entries,
        COALESCE(p.completed_modules, 0) AS completed_modules,
        p.last_activity,
        COALESCE(c.certificate_count, 0) AS certificate_count
        FROM users u
        LEFT JOIN (' . admin_progress_aggregate_sql() . ') p ON p.user_id = u.id
        LEFT JOIN (SELECT user_id, COUNT(*) AS certificate_count FROM certificates GROUP BY user_id) c ON c.user_id = u.id';
    $params = [];
    if ($search !== '') {
        $sql .= ' WHERE (LOWER(u.email) LIKE ? OR LOWER(u.full_name) LIKE ?)';
        $needle = '%' . strtolower($search) . '%';
        $params = [$needle, $needle];
    }
    $sql .= ' ORDER BY u.created_at DESC, u.id DESC LIMIT 200';
    $statement = db()->prepare($sql);
    $statement->execute($params);
    $totalModules = count(admin_module_rows());

    return array_map(static function (array $row) use ($totalModules): array {
        $user = present_authenticated_user($row);
        $completed = (int) ($row['completed_modules'] ?? 0);
        return array_merge($user, [
            'completedModules' => $completed,
            'progressPercent' => bounded_progress_percent($completed, $totalModules),
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
    $progressStatement = db()->prepare('SELECT p.module_number, p.completed, p.quiz_score, p.quiz_total, p.practical_done, p.time_spent_minutes, p.created_at, p.updated_at, m.title AS module_title, m.level_number, m.level_name FROM user_progress p INNER JOIN course_modules m ON m.module_number = p.module_number WHERE p.user_id = ? ORDER BY p.updated_at DESC, p.module_number ASC');
    $progressStatement->execute([$learnerId]);
    $progressRows = $progressStatement->fetchAll();
    $certificateStatement = db()->prepare('SELECT id, level_number, level_name, score, exam_type, holder_name, issued_at FROM certificates WHERE user_id = ? ORDER BY issued_at DESC, id DESC');
    $certificateStatement->execute([$learnerId]);
    $certificates = $certificateStatement->fetchAll();

    $progressSummary = admin_progress_summary($learnerId, count($moduleRows));

    return [
        'learner' => array_merge(present_authenticated_user($row), [
            'completedModules' => $progressSummary['completedModules'],
            'progressPercent' => $progressSummary['progressPercent'],
            'timeSpentMinutes' => $progressSummary['timeSpentMinutes'],
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

function profile_text($value, int $limit): string
{
    $text = trim((string) $value);
    $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $text) ?? '';
    return substr($text, 0, $limit);
}

function profile_avatar_data($value): string
{
    $avatar = trim((string) $value);
    if ($avatar === '') {
        return '';
    }

    if (strlen($avatar) > 180000 || !preg_match('#^data:image/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$#', $avatar)) {
        error_response('Foto profil harus berupa JPG, PNG, atau WebP dengan ukuran yang wajar.', 422, 'avatar_invalid');
    }

    $encoded = substr($avatar, strpos($avatar, ',') + 1);
    $binary = base64_decode($encoded, true);
    $image = $binary !== false ? @getimagesizefromstring($binary) : false;
    $mime = is_array($image) ? (string) ($image['mime'] ?? '') : '';
    if ($binary === false || strlen($binary) > 135000 || !in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
        error_response('Foto profil tidak dapat dibaca. Pilih gambar JPG, PNG, atau WebP yang lebih kecil.', 422, 'avatar_invalid');
    }

    return $avatar;
}

function profile_row(int $userId): array
{
    $statement = db()->prepare('SELECT bio, hall_of_fame_opt_in, avatar_data, updated_at FROM user_profiles WHERE user_id = ? LIMIT 1');
    $statement->execute([$userId]);
    $row = $statement->fetch();
    return $row ?: ['bio' => '', 'hall_of_fame_opt_in' => 0, 'avatar_data' => '', 'updated_at' => null];
}

function profile_learning_summary(int $userId): array
{
    $moduleTotal = count(admin_module_rows());
    $progress = admin_progress_summary($userId, $moduleTotal);
    $certificateStatement = db()->prepare('SELECT COUNT(*) FROM certificates WHERE user_id = ?');
    $certificateStatement->execute([$userId]);
    $farmStatement = db()->prepare('SELECT COUNT(*) FROM farm_data WHERE user_id = ?');
    $farmStatement->execute([$userId]);

    $entries = (int) ($progress['entries'] ?? 0);
    $completed = (int) ($progress['completedModules'] ?? 0);
    $practical = (int) ($progress['practicalModules'] ?? 0);
    $quizScore = (float) ($progress['quizScoreSum'] ?? 0);
    $quizTotal = (float) ($progress['quizTotalSum'] ?? 0);
    $quizAverage = $quizTotal > 0 ? max(0, min(100, (int) round(($quizScore / $quizTotal) * 100))) : null;
    $minutes = (int) ($progress['timeSpentMinutes'] ?? 0);
    $certificates = (int) $certificateStatement->fetchColumn();
    $farmEntries = (int) $farmStatement->fetchColumn();
    $points = ($completed * 100) + ($practical * 35) + ($certificates * 150) + min(100, $quizAverage ?? 0) + (min(12, $farmEntries) * 10) + min(60, intdiv($minutes, 10));

    $level = $points >= 900 ? ['name' => 'Layer Leader', 'nextAt' => null] : ($points >= 450 ? ['name' => 'Farm Analyst', 'nextAt' => 900] : ($points >= 160 ? ['name' => 'Field Builder', 'nextAt' => 450] : ['name' => 'Foundation', 'nextAt' => 160]));
    $achievements = [
        ['id' => 'first-step', 'title' => 'Langkah pertama', 'description' => 'Simpan aktivitas pada modul pertama.', 'icon' => 'solar:flag-2-bold-duotone', 'current' => $entries, 'target' => 1],
        ['id' => 'module-finisher', 'title' => 'Modul tuntas', 'description' => 'Selesaikan minimal satu modul pembelajaran.', 'icon' => 'solar:check-read-bold-duotone', 'current' => $completed, 'target' => 1],
        ['id' => 'field-practice', 'title' => 'Praktik lapangan', 'description' => 'Tandai sedikitnya satu praktik sebagai selesai.', 'icon' => 'solar:leaf-bold-duotone', 'current' => $practical, 'target' => 1],
        ['id' => 'quiz-ready', 'title' => 'Siap evaluasi', 'description' => 'Kumpulkan nilai kuis rata-rata minimal 80%.', 'icon' => 'solar:cup-star-bold-duotone', 'current' => $quizAverage ?? 0, 'target' => 80],
        ['id' => 'farm-journal', 'title' => 'Catatan farm konsisten', 'description' => 'Simpan empat catatan KPI untuk analisis yang lebih bermakna.', 'icon' => 'solar:chart-2-bold-duotone', 'current' => $farmEntries, 'target' => 4],
        ['id' => 'certified', 'title' => 'Tersertifikasi', 'description' => 'Peroleh sertifikat dari alur pembelajaran.', 'icon' => 'solar:diploma-verified-bold-duotone', 'current' => $certificates, 'target' => 1],
    ];
    foreach ($achievements as &$achievement) {
        $achievement['unlocked'] = $achievement['current'] >= $achievement['target'];
    }
    unset($achievement);

    return [
        'points' => $points,
        'level' => $level['name'],
        'nextLevelAt' => $level['nextAt'],
        'progressPercent' => bounded_progress_percent($completed, $moduleTotal),
        'completedModules' => $completed,
        'moduleTotal' => $moduleTotal,
        'practicalModules' => $practical,
        'quizAverage' => $quizAverage,
        'timeSpentMinutes' => $minutes,
        'certificateCount' => $certificates,
        'farmEntryCount' => $farmEntries,
        'lastActivity' => $progress['lastActivity'] ?? null,
        'achievements' => $achievements,
    ];
}

function profile_data(array $user): array
{
    $profile = profile_row((int) $user['id']);
    return [
        'user' => $user,
        'profile' => [
            'bio' => (string) ($profile['bio'] ?? ''),
            'hallOfFameOptIn' => (bool) ($profile['hall_of_fame_opt_in'] ?? false),
            'avatar' => (string) ($profile['avatar_data'] ?? ''),
            'updatedAt' => $profile['updated_at'] ?? null,
        ],
        'learning' => profile_learning_summary((int) $user['id']),
        'achievementNote' => 'Prestasi dan level dihitung dari aktivitas belajar serta data farm yang benar-benar tersimpan.',
    ];
}

function update_profile_data(array $user, array $input): array
{
    $fullName = profile_text($input['fullName'] ?? $input['full_name'] ?? $user['full_name'] ?? '', 160);
    if ($fullName === '') {
        error_response('Nama profil wajib diisi.', 422, 'validation_error');
    }
    $bio = profile_text($input['bio'] ?? '', 600);
    $optIn = bool_value($input['hallOfFameOptIn'] ?? $input['hall_of_fame_opt_in'] ?? false) ? 1 : 0;
    $existingProfile = profile_row((int) $user['id']);
    $avatarData = array_key_exists('avatarData', $input) || array_key_exists('avatar', $input)
        ? profile_avatar_data($input['avatarData'] ?? $input['avatar'] ?? '')
        : (string) ($existingProfile['avatar_data'] ?? '');
    db()->prepare('UPDATE users SET full_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([$fullName, (int) $user['id']]);
    $existing = db()->prepare('SELECT user_id FROM user_profiles WHERE user_id = ? LIMIT 1');
    $existing->execute([(int) $user['id']]);
    if ($existing->fetch()) {
        db()->prepare('UPDATE user_profiles SET bio = ?, hall_of_fame_opt_in = ?, avatar_data = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')->execute([$bio, $optIn, $avatarData, (int) $user['id']]);
    } else {
        db()->prepare('INSERT INTO user_profiles (user_id, bio, hall_of_fame_opt_in, avatar_data) VALUES (?, ?, ?, ?)')->execute([(int) $user['id'], $bio, $optIn, $avatarData]);
    }
    return profile_data(current_user() ?? $user);
}

function hall_of_fame_data(): array
{
    $rows = db()->query("SELECT u.id, u.email, u.full_name, u.role, u.created_at FROM users u INNER JOIN user_profiles p ON p.user_id = u.id WHERE p.hall_of_fame_opt_in = 1 ORDER BY p.updated_at DESC, u.id DESC LIMIT 100")->fetchAll();
    $entries = [];
    foreach ($rows as $row) {
        $user = present_authenticated_user($row);
        if ($user['role'] === 'admin' || trim($user['full_name']) === '') {
            continue;
        }
        $learning = profile_learning_summary((int) $user['id']);
        if ($learning['points'] < 1) {
            continue;
        }
        $entries[] = [
            'userId' => $user['id'],
            'name' => $user['full_name'],
            'level' => $learning['level'],
            'points' => $learning['points'],
            'completedModules' => $learning['completedModules'],
            'certificateCount' => $learning['certificateCount'],
        ];
    }
    usort($entries, static function (array $left, array $right): int {
        return [$right['points'], $right['certificateCount'], $right['completedModules'], $left['name']] <=> [$left['points'], $left['certificateCount'], $left['completedModules'], $right['name']];
    });
    foreach ($entries as $index => &$entry) {
        $entry['rank'] = $index + 1;
    }
    unset($entry);
    return [
        'entries' => array_slice($entries, 0, 10),
        'criteria' => 'Peringkat menggunakan poin pembelajaran: modul selesai, praktik, sertifikat, nilai kuis, catatan KPI, dan waktu belajar. Hanya peserta yang opt-in yang ditampilkan.',
    ];
}

function admin_user_list(string $search = ''): array
{
    return admin_account_list($search);
}

function admin_effective_admin_count(): int
{
    $rows = db()->query('SELECT id, email, full_name, role, created_at FROM users')->fetchAll();
    return count(array_filter($rows, static function (array $row): bool {
        return effective_user_role($row) === 'admin';
    }));
}

function admin_create_user(array $input): array
{
    $email = normalize_email($input['email'] ?? '');
    $password = (string) ($input['password'] ?? '');
    $fullName = profile_text($input['fullName'] ?? $input['full_name'] ?? '', 160);
    $requestedRole = strtolower(trim((string) ($input['role'] ?? 'learner')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        error_response('Masukkan email pengguna yang valid.', 422, 'validation_error');
    }
    if ($fullName === '') {
        error_response('Nama pengguna wajib diisi.', 422, 'validation_error');
    }
    if (!in_array($requestedRole, ['learner', 'admin'], true)) {
        error_response('Role pengguna tidak valid.', 422, 'validation_error');
    }
    $passwordError = password_validation_error($password);
    if ($passwordError !== '') {
        error_response($passwordError, 422, 'validation_error');
    }
    $existing = db()->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $existing->execute([$email]);
    if ($existing->fetch()) {
        error_response('Email tersebut sudah terdaftar.', 409, 'email_exists');
    }
    db()->prepare('INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)')->execute([$email, app_password_hash($password), $fullName, $requestedRole === 'admin' ? 'admin' : 'user']);
    $id = (int) db()->lastInsertId();
    $created = db()->prepare('SELECT id, email, full_name, role, created_at FROM users WHERE id = ? LIMIT 1');
    $created->execute([$id]);
    return present_authenticated_user($created->fetch() ?: []);
}

function admin_update_user(array $actor, int $userId, array $input): array
{
    $statement = db()->prepare('SELECT id, email, full_name, role, created_at FROM users WHERE id = ? LIMIT 1');
    $statement->execute([$userId]);
    $target = $statement->fetch();
    if (!$target) {
        error_response('Pengguna tidak ditemukan.', 404, 'not_found');
    }
    $fullName = array_key_exists('fullName', $input) || array_key_exists('full_name', $input) ? profile_text($input['fullName'] ?? $input['full_name'] ?? '', 160) : (string) $target['full_name'];
    if ($fullName === '') {
        error_response('Nama pengguna wajib diisi.', 422, 'validation_error');
    }
    $newRole = effective_user_role($target);
    if (array_key_exists('role', $input)) {
        $newRole = strtolower(trim((string) $input['role']));
        if (!in_array($newRole, ['learner', 'admin'], true)) {
            error_response('Role pengguna tidak valid.', 422, 'validation_error');
        }
        if ($newRole !== 'admin' && in_array(normalize_email($target['email']), configured_admin_emails(), true)) {
            error_response('Role admin untuk email ini diatur melalui konfigurasi server.', 422, 'role_managed_by_config');
        }
        if ($newRole !== 'admin' && effective_user_role($target) === 'admin' && admin_effective_admin_count() <= 1) {
            error_response('Minimal satu admin harus tetap tersedia.', 422, 'last_admin');
        }
        if ((int) $actor['id'] === $userId && $newRole !== 'admin') {
            error_response('Anda tidak dapat menurunkan role admin pada akun sendiri.', 422, 'self_demotion');
        }
    }
    db()->prepare('UPDATE users SET full_name = ?, role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([$fullName, $newRole === 'admin' ? 'admin' : 'user', $userId]);
    $fresh = db()->prepare('SELECT id, email, full_name, role, created_at FROM users WHERE id = ? LIMIT 1');
    $fresh->execute([$userId]);
    return present_authenticated_user($fresh->fetch() ?: []);
}

function admin_reset_user_password(int $userId, string $password): void
{
    $passwordError = password_validation_error($password);
    if ($passwordError !== '') {
        error_response($passwordError, 422, 'validation_error');
    }
    $exists = db()->prepare('SELECT id FROM users WHERE id = ? LIMIT 1');
    $exists->execute([$userId]);
    if (!$exists->fetch()) {
        error_response('Pengguna tidak ditemukan.', 404, 'not_found');
    }
    db()->prepare('UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_token_expires_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([app_password_hash($password), $userId]);
}

function admin_reset_user_progress(int $userId): array
{
    $exists = db()->prepare('SELECT id FROM users WHERE id = ? LIMIT 1');
    $exists->execute([$userId]);
    if (!$exists->fetch()) {
        error_response('Pengguna tidak ditemukan.', 404, 'not_found');
    }

    db()->beginTransaction();
    try {
        $delete = db()->prepare('DELETE FROM user_progress WHERE user_id = ?');
        $delete->execute([$userId]);
        $deletedEntries = $delete->rowCount();
        db()->commit();
    } catch (Throwable $exception) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }
        throw $exception;
    }

    return [
        'userId' => $userId,
        'deletedEntries' => $deletedEntries,
        'preservedCertificates' => true,
        'preservedFarmData' => true,
        'preservedConversations' => true,
    ];
}

function admin_string_list($value, int $maxItems = 20, int $maxLength = 320): array
{
    if (is_string($value)) {
        $value = preg_split('/\r?\n/', $value);
    }
    if (!is_array($value)) {
        return [];
    }
    $items = [];
    foreach ($value as $item) {
        $text = profile_text($item, $maxLength);
        if ($text !== '') {
            $items[] = $text;
        }
        if (count($items) >= $maxItems) {
            break;
        }
    }
    return $items;
}

function admin_module_from_id(int $moduleId): ?array
{
    $statement = db()->prepare('SELECT * FROM course_modules WHERE id = ? LIMIT 1');
    $statement->execute([$moduleId]);
    $row = $statement->fetch();
    return $row ?: null;
}

function normalise_editorial_internal_path($value): ?string
{
    $path = trim((string) $value);
    if ($path === '' || substr($path, 0, 1) !== '/' || substr($path, 0, 2) === '//') {
        return null;
    }
    $decoded = $path;
    for ($iteration = 0; $iteration < 3; $iteration += 1) {
        $next = rawurldecode($decoded);
        if ($next === $decoded) {
            break;
        }
        $decoded = $next;
    }
    if (strpos($decoded, '\\') !== false || preg_match('/[\x00-\x1F\x7F]/', $decoded) || preg_match('#(?:^|/)\.\.?(?:/|$)#', $decoded)) {
        return null;
    }
    return $path;
}

function normalise_editorial_internal_media_path($value): ?string
{
    $path = normalise_editorial_internal_path($value);
    if ($path === null || !preg_match('#^/(?:assets|media|uploads)(?:/|$)#', $path)) {
        return null;
    }
    return $path;
}

function normalise_editorial_link_url($value): string
{
    $url = trim((string) $value);
    if (strlen($url) > 2048) {
        error_response('Tautan editorial terlalu panjang.', 422, 'invalid_editorial_url');
    }
    $internal = normalise_editorial_internal_path($url);
    if ($internal !== null) {
        return $internal;
    }
    if (!filter_var($url, FILTER_VALIDATE_URL)) {
        error_response('Tautan editorial harus berupa URL HTTPS atau path internal yang aman.', 422, 'invalid_editorial_url');
    }
    $parts = parse_url($url);
    $scheme = strtolower((string) ($parts['scheme'] ?? ''));
    $host = (string) ($parts['host'] ?? '');
    if ($scheme !== 'https' || $host === '' || isset($parts['user']) || isset($parts['pass'])) {
        error_response('Tautan editorial harus menggunakan HTTPS tanpa kredensial.', 422, 'invalid_editorial_url');
    }
    return $url;
}

function normalise_editorial_image_url($value): string
{
    $rawUrl = trim((string) $value);
    $internal = normalise_editorial_internal_path($rawUrl);
    if ($internal !== null && normalise_editorial_internal_media_path($internal) === null) {
        error_response('Gambar internal editorial hanya boleh memakai /assets/, /media/, atau /uploads/.', 422, 'invalid_editorial_image');
    }
    $url = $internal !== null ? $internal : normalise_editorial_link_url($rawUrl);
    $parts = parse_url($url);
    $path = (string) ($parts['path'] ?? $url);
    if (!preg_match('/\.(?:jpe?g|png|gif|webp|avif)$/i', $path)) {
        error_response('Gambar editorial harus memakai PNG, JPG, WebP, AVIF, atau GIF.', 422, 'invalid_editorial_image');
    }
    return $url;
}

function normalise_editorial_presentation_url($value, string $format = ''): string
{
    $url = trim((string) $value);
    $path = normalise_editorial_internal_path($url);
    $parts = $path !== null ? parse_url($path) : null;
    $pathname = is_array($parts) ? (string) ($parts['path'] ?? '') : '';
    if ($path === null || !preg_match('#^/uploads/editorial/presentations/[0-9]{4}/[0-9]{2}/[a-f0-9]{40}\.(pptx|ppt|key|odp|pdf)$#i', $pathname, $matches)) {
        error_response('Presentasi editorial harus berasal dari unggahan PowerPoint, Keynote, ODP, atau PDF yang dikelola.', 422, 'invalid_presentation_url');
    }
    $actualFormat = strtolower((string) ($matches[1] ?? ''));
    if ($format !== '' && strtolower($format) !== $actualFormat) {
        error_response('Format presentasi tidak sesuai dengan file yang diunggah.', 422, 'invalid_presentation_url');
    }
    return $path;
}

function normalise_lesson_video_url($value): string
{
    $url = trim((string) $value);
    if ($url === '') {
        return '';
    }
    $internal = normalise_editorial_internal_path($url);
    if ($internal !== null) {
        if (normalise_editorial_internal_media_path($internal) === null) {
            error_response('Video internal hanya boleh memakai /assets/, /media/, atau /uploads/.', 422, 'invalid_video_url');
        }
        if (!preg_match('/\.(mp4|webm|ogg|m4v)(?:[?#]|$)/i', $internal)) {
            error_response('Video internal harus memakai file MP4, WebM, OGG, atau M4V.', 422, 'invalid_video_url');
        }
        return $internal;
    }

    $url = normalise_editorial_link_url($url);
    $parts = parse_url($url);
    $host = strtolower((string) ($parts['host'] ?? ''));
    $host = preg_replace('/^www\./', '', $host) ?: $host;
    $path = (string) ($parts['path'] ?? '');
    $query = [];
    parse_str((string) ($parts['query'] ?? ''), $query);

    $youtubeId = '';
    if ($host === 'youtu.be') {
        $youtubeId = trim(explode('/', trim($path, '/'))[0] ?? '');
    } elseif (in_array($host, ['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'], true)) {
        if (isset($query['v'])) {
            $youtubeId = (string) $query['v'];
        } elseif (preg_match('#/(?:embed|shorts)/([^/?]+)#', $path, $matches)) {
            $youtubeId = $matches[1];
        }
    }
    if ($youtubeId !== '' && preg_match('/^[A-Za-z0-9_-]{6,}$/', $youtubeId)) {
        return 'https://www.youtube-nocookie.com/embed/' . $youtubeId . '?rel=0';
    }

    if (($host === 'vimeo.com' || preg_match('/(^|\.)vimeo\.com$/', $host)) && preg_match('#/(\d+)(?:/|$)#', $path, $matches)) {
        return 'https://player.vimeo.com/video/' . $matches[1];
    }

    if (preg_match('/\.(mp4|webm|ogg|m4v)$/i', $path)) {
        return $url;
    }

    error_response('Video harus memakai YouTube, Vimeo, atau file HTTPS MP4, WebM, OGG, atau M4V.', 422, 'invalid_video_url');
}

function normalise_editorial_content($value): string
{
    if ($value === null || $value === '' || $value === []) {
        return '';
    }
    if (is_string($value)) {
        $document = json_decode($value, true);
    } else {
        $document = $value;
    }
    if (!is_array($document) || !isset($document['blocks']) || !is_array($document['blocks'])) {
        error_response('Dokumen editorial tidak valid.', 422, 'invalid_editorial_content');
    }
    if (count($document['blocks']) > 80) {
        error_response('Dokumen editorial maksimal berisi 80 blok.', 422, 'invalid_editorial_content');
    }

    $allowedTypes = ['richText', 'heading', 'table', 'image', 'slides', 'video', 'link', 'cta', 'callout', 'divider'];
    $allowedAlignments = ['left', 'center', 'right'];
    $allowedRatios = ['natural', 'wide', 'standard', 'square'];
    $allowedWidths = ['standard', 'wide'];
    $allowedImagePositions = ['top', 'center', 'bottom'];
    $allowedVariants = ['primary', 'secondary', 'outline'];
    $allowedCtaWidths = ['auto', 'full'];
    $allowedCtaTones = ['green', 'orange', 'blue', 'violet', 'neutral'];
    $allowedCtaSizes = ['sm', 'md', 'lg'];
    $allowedCtaRadii = ['sm', 'md', 'lg', 'pill'];
    $allowedCtaIcons = ['none', 'arrowRight', 'check', 'play'];
    $allowedTargets = ['auto', 'same', 'new'];
    $allowedLinkVariants = ['card', 'soft', 'inline'];
    $allowedLinkTones = ['neutral', 'green', 'orange', 'blue', 'violet'];
    $allowedLinkIcons = ['link', 'arrowRight', 'none'];
    $allowedTableDensities = ['comfortable', 'compact'];
    $allowedDividerStyles = ['subtle', 'strong', 'dashed'];
    $allowedDividerSpacing = ['compact', 'comfortable'];
    $allowedTones = ['info', 'practice', 'warning', 'blue', 'violet', 'neutral'];
    $allowedCalloutVariants = ['soft', 'solid', 'outline'];
    $allowedCalloutIcons = ['info', 'target', 'warning', 'check', 'none'];
    $allowedCalloutDensities = ['comfortable', 'compact'];
    $presentation = normalise_editorial_presentation($document['presentation'] ?? []);
    $blocks = [];
    $ids = [];
    $totalLength = 0;
    $hasContent = false;

    foreach ($document['blocks'] as $index => $block) {
        if (!is_array($block)) {
            error_response('Blok editorial tidak valid.', 422, 'invalid_editorial_content');
        }
        $type = (string) ($block['type'] ?? '');
        if (!in_array($type, $allowedTypes, true)) {
            error_response('Jenis blok editorial tidak didukung.', 422, 'invalid_editorial_content');
        }
        $id = (string) ($block['id'] ?? '');
        if (!preg_match('/^[A-Za-z0-9_-]{1,80}$/', $id) || isset($ids[$id])) {
            error_response('ID blok editorial tidak valid.', 422, 'invalid_editorial_content');
        }
        $ids[$id] = true;
        $normalised = ['id' => $id, 'type' => $type];

        if ($type === 'richText') {
            $content = profile_text($block['content'] ?? '', 120000);
            if ($content === '') error_response('Blok teks editorial tidak boleh kosong.', 422, 'invalid_editorial_content');
            $alignment = (string) ($block['align'] ?? 'left');
            if (!in_array($alignment, $allowedAlignments, true)) error_response('Perataan teks editorial tidak valid.', 422, 'invalid_editorial_content');
            $normalised['content'] = $content;
            $normalised['align'] = $alignment;
            $totalLength += strlen($content);
            $hasContent = true;
        } elseif ($type === 'heading') {
            $content = profile_text($block['content'] ?? '', 500);
            $level = (int) ($block['level'] ?? 2);
            $alignment = (string) ($block['align'] ?? 'left');
            if ($content === '' || !in_array($level, [2, 3, 4], true) || !in_array($alignment, $allowedAlignments, true)) error_response('Judul editorial tidak valid.', 422, 'invalid_editorial_content');
            $normalised['content'] = $content;
            $normalised['level'] = $level;
            $normalised['align'] = $alignment;
            $totalLength += strlen($content);
            $hasContent = true;
        } elseif ($type === 'table') {
            $normalised['title'] = profile_text($block['title'] ?? '', 160);
            $alignment = (string) ($block['align'] ?? 'left');
            $density = (string) ($block['density'] ?? 'comfortable');
            if (!in_array($alignment, $allowedAlignments, true) || !in_array($density, $allowedTableDensities, true)) {
                error_response('Tampilan tabel editorial tidak valid.', 422, 'invalid_editorial_content');
            }
            $columns = $block['columns'] ?? null;
            $rows = $block['rows'] ?? null;
            if (!is_array($columns) || count($columns) < 1 || count($columns) > 8 || !is_array($rows) || count($rows) < 1 || count($rows) > 20) {
                error_response('Tabel editorial harus memiliki 1–8 kolom dan 1–20 baris.', 422, 'invalid_editorial_content');
            }
            $normalised['columns'] = [];
            foreach ($columns as $column) {
                $columnText = profile_text($column, 160);
                if ($columnText === '') error_response('Judul kolom tabel editorial wajib diisi.', 422, 'invalid_editorial_content');
                $normalised['columns'][] = $columnText;
                $totalLength += strlen($columnText);
            }
            $normalised['rows'] = [];
            foreach ($rows as $row) {
                if (!is_array($row) || count($row) !== count($normalised['columns'])) {
                    error_response('Setiap baris tabel editorial harus sesuai jumlah kolom.', 422, 'invalid_editorial_content');
                }
                $normalisedRow = [];
                foreach (array_values($row) as $cell) {
                    $cellText = profile_text($cell, 3000);
                    $normalisedRow[] = $cellText;
                    $totalLength += strlen($cellText);
                }
                $normalised['rows'][] = $normalisedRow;
            }
            $totalLength += strlen($normalised['title']);
            $normalised['align'] = $alignment;
            $normalised['density'] = $density;
            $hasContent = true;
        } elseif ($type === 'image') {
            $normalised['src'] = normalise_editorial_image_url($block['src'] ?? '');
            $normalised['alt'] = profile_text($block['alt'] ?? '', 280);
            $normalised['caption'] = profile_text($block['caption'] ?? '', 600);
            $decorative = array_key_exists('decorative', $block)
                ? (bool) $block['decorative']
                : $normalised['alt'] === '';
            if (!$decorative && $normalised['alt'] === '') {
                error_response('Gambar bermakna wajib memiliki teks alternatif.', 422, 'invalid_editorial_image');
            }
            $ratio = (string) ($block['ratio'] ?? 'natural');
            $width = (string) ($block['width'] ?? 'standard');
            $alignment = (string) ($block['align'] ?? 'left');
            $position = (string) ($block['position'] ?? 'center');
            if (!in_array($ratio, $allowedRatios, true)
                || !in_array($width, $allowedWidths, true)
                || !in_array($alignment, $allowedAlignments, true)
                || !in_array($position, $allowedImagePositions, true)) {
                error_response('Tampilan gambar editorial tidak valid.', 422, 'invalid_editorial_content');
            }
            $normalised['decorative'] = $decorative;
            $normalised['ratio'] = $ratio;
            $normalised['width'] = $width;
            $normalised['align'] = $alignment;
            $normalised['position'] = $position;
            $totalLength += strlen($normalised['alt']) + strlen($normalised['caption']);
            $hasContent = true;
        } elseif ($type === 'slides') {
            $normalised['title'] = profile_text($block['title'] ?? '', 160);
            $alignment = (string) ($block['align'] ?? 'left');
            if (!in_array($alignment, $allowedAlignments, true)) error_response('Perataan rangkaian slide tidak valid.', 422, 'invalid_editorial_content');
            $normalised['align'] = $alignment;
            $source = strtolower((string) ($block['presentationFormat'] ?? $block['source'] ?? 'manual'));
            $allowedPresentationSources = ['pptx', 'ppt', 'key', 'odp', 'pdf'];
            if (in_array($source, $allowedPresentationSources, true)) {
                $presentationUrl = normalise_editorial_presentation_url($block['presentationUrl'] ?? $block['pptxUrl'] ?? '', $source);
                $presentationName = profile_text($block['presentationName'] ?? $block['pptxName'] ?? '', 180);
                $normalised['source'] = $source;
                $normalised['presentationFormat'] = $source;
                $normalised['presentationUrl'] = $presentationUrl;
                $normalised['presentationName'] = $presentationName;
                $normalised['presentationMime'] = profile_text($block['presentationMime'] ?? '', 160);
                $presentationSize = (int) ($block['presentationSize'] ?? 0);
                $normalised['presentationSize'] = max(0, min(EDITORIAL_PRESENTATION_MAX_BYTES, $presentationSize));
                if ($source === 'pptx') {
                    $normalised['pptxUrl'] = $presentationUrl;
                    $normalised['pptxName'] = $presentationName;
                }
                $slideCount = (int) ($block['slideCount'] ?? 0);
                if ($source === 'pptx' && ($slideCount < 1 || $slideCount > 50)) {
                    error_response('Jumlah slide PowerPoint tidak valid.', 422, 'invalid_editorial_content');
                }
                $normalised['slideCount'] = $slideCount;
                $normalised['slides'] = [];
                $totalLength += strlen($normalised['title']) + strlen($normalised['presentationName']);
                $hasContent = true;
            } elseif ($source === 'manual') {
                $normalised['source'] = 'manual';
                $slides = $block['slides'] ?? null;
                if (!is_array($slides) || count($slides) < 1 || count($slides) > 12) {
                    error_response('Rangkaian editorial harus memiliki 1–12 slide.', 422, 'invalid_editorial_content');
                }
                $normalised['slides'] = [];
                $slideIds = [];
                foreach ($slides as $slide) {
                    if (!is_array($slide)) error_response('Slide editorial tidak valid.', 422, 'invalid_editorial_content');
                    $slideId = (string) ($slide['id'] ?? '');
                    if (!preg_match('/^[A-Za-z0-9_-]{1,80}$/', $slideId) || isset($slideIds[$slideId])) {
                        error_response('ID slide editorial tidak valid.', 422, 'invalid_editorial_content');
                    }
                    $slideIds[$slideId] = true;
                    $slideTitle = profile_text($slide['title'] ?? '', 180);
                    $slideContent = profile_text($slide['content'] ?? '', 3000);
                    $slideSource = trim((string) ($slide['src'] ?? ''));
                    $slideAlt = profile_text($slide['alt'] ?? '', 280);
                    $slideDecorative = array_key_exists('decorative', $slide)
                        ? (bool) $slide['decorative']
                        : $slideAlt === '';
                    if ($slideSource !== '') {
                        $slideSource = normalise_editorial_image_url($slideSource);
                        if (!$slideDecorative && $slideAlt === '') {
                            error_response('Gambar slide bermakna wajib memiliki teks alternatif.', 422, 'invalid_editorial_image');
                        }
                    }
                    if ($slideTitle === '' && $slideContent === '' && $slideSource === '') {
                        error_response('Setiap slide editorial harus memiliki gambar, judul, atau isi.', 422, 'invalid_editorial_content');
                    }
                    $normalised['slides'][] = [
                        'id' => $slideId,
                        'title' => $slideTitle,
                        'content' => $slideContent,
                        'src' => $slideSource,
                        'alt' => $slideAlt,
                        'decorative' => $slideDecorative,
                    ];
                    $totalLength += strlen($slideTitle) + strlen($slideContent) + strlen($slideAlt);
                }
                $totalLength += strlen($normalised['title']);
                $hasContent = true;
            } else {
                error_response('Sumber rangkaian editorial tidak valid.', 422, 'invalid_editorial_content');
            }
        } elseif ($type === 'video') {
            $normalised['url'] = normalise_lesson_video_url($block['url'] ?? '');
            $normalised['caption'] = profile_text($block['caption'] ?? '', 600);
            $alignment = (string) ($block['align'] ?? 'left');
            if ($normalised['url'] === '' || !in_array($alignment, $allowedAlignments, true)) error_response('Blok video editorial harus memiliki tautan dan perataan yang valid.', 422, 'invalid_editorial_content');
            $normalised['align'] = $alignment;
            $totalLength += strlen($normalised['caption']);
            $hasContent = true;
        } elseif ($type === 'link') {
            $normalised['label'] = profile_text($block['label'] ?? '', 160);
            $normalised['url'] = normalise_editorial_link_url($block['url'] ?? '');
            $normalised['description'] = profile_text($block['description'] ?? '', 600);
            $variant = (string) ($block['variant'] ?? 'card');
            $tone = (string) ($block['tone'] ?? 'neutral');
            $icon = (string) ($block['icon'] ?? 'link');
            $width = (string) ($block['width'] ?? 'standard');
            $target = (string) ($block['target'] ?? 'auto');
            $alignment = (string) ($block['align'] ?? 'left');
            if ($normalised['label'] === ''
                || !in_array($variant, $allowedLinkVariants, true)
                || !in_array($tone, $allowedLinkTones, true)
                || !in_array($icon, $allowedLinkIcons, true)
                || !in_array($width, $allowedWidths, true)
                || !in_array($target, $allowedTargets, true)
                || !in_array($alignment, $allowedAlignments, true)) {
                error_response('Tautan editorial memiliki tampilan atau perilaku yang tidak valid.', 422, 'invalid_editorial_content');
            }
            $normalised['align'] = $alignment;
            $normalised['variant'] = $variant;
            $normalised['tone'] = $tone;
            $normalised['icon'] = $icon;
            $normalised['width'] = $width;
            $normalised['target'] = $target;
            $totalLength += strlen($normalised['label']) + strlen($normalised['description']);
            $hasContent = true;
        } elseif ($type === 'cta') {
            $normalised['label'] = profile_text($block['label'] ?? '', 120);
            $normalised['url'] = normalise_editorial_link_url($block['url'] ?? '');
            $variant = (string) ($block['variant'] ?? 'primary');
            $tone = (string) ($block['tone'] ?? 'green');
            $size = (string) ($block['size'] ?? 'md');
            $radius = (string) ($block['radius'] ?? 'md');
            $icon = (string) ($block['icon'] ?? 'arrowRight');
            $target = (string) ($block['target'] ?? 'auto');
            $alignment = (string) ($block['align'] ?? 'left');
            $width = (string) ($block['width'] ?? 'auto');
            if ($normalised['label'] === ''
                || !in_array($variant, $allowedVariants, true)
                || !in_array($tone, $allowedCtaTones, true)
                || !in_array($size, $allowedCtaSizes, true)
                || !in_array($radius, $allowedCtaRadii, true)
                || !in_array($icon, $allowedCtaIcons, true)
                || !in_array($target, $allowedTargets, true)
                || !in_array($alignment, $allowedAlignments, true)
                || !in_array($width, $allowedCtaWidths, true)) {
                error_response('Tombol editorial tidak valid.', 422, 'invalid_editorial_content');
            }
            $normalised['variant'] = $variant;
            $normalised['tone'] = $tone;
            $normalised['size'] = $size;
            $normalised['radius'] = $radius;
            $normalised['icon'] = $icon;
            $normalised['target'] = $target;
            $normalised['align'] = $alignment;
            $normalised['width'] = $width;
            $totalLength += strlen($normalised['label']);
            $hasContent = true;
        } elseif ($type === 'callout') {
            $normalised['title'] = profile_text($block['title'] ?? '', 160);
            $normalised['content'] = profile_text($block['content'] ?? '', 2400);
            $tone = (string) ($block['tone'] ?? 'info');
            $variant = (string) ($block['variant'] ?? 'soft');
            $icon = (string) ($block['icon'] ?? 'info');
            $density = (string) ($block['density'] ?? 'comfortable');
            $calloutWidth = (string) ($block['width'] ?? 'standard');
            if (($normalised['title'] === '' && $normalised['content'] === '')
                || !in_array($tone, $allowedTones, true)
                || !in_array($variant, $allowedCalloutVariants, true)
                || !in_array($icon, $allowedCalloutIcons, true)
                || !in_array($density, $allowedCalloutDensities, true)
                || !in_array($calloutWidth, $allowedWidths, true)) {
                error_response('Sorotan editorial tidak valid.', 422, 'invalid_editorial_content');
            }
            $alignment = (string) ($block['align'] ?? 'left');
            if (!in_array($alignment, $allowedAlignments, true)) error_response('Perataan sorotan editorial tidak valid.', 422, 'invalid_editorial_content');
            $normalised['tone'] = $tone;
            $normalised['variant'] = $variant;
            $normalised['icon'] = $icon;
            $normalised['density'] = $density;
            $normalised['width'] = $calloutWidth;
            $normalised['align'] = $alignment;
            $totalLength += strlen($normalised['title']) + strlen($normalised['content']);
            $hasContent = true;
        } elseif ($type === 'divider') {
            $style = (string) ($block['style'] ?? 'subtle');
            $spacing = (string) ($block['spacing'] ?? 'comfortable');
            if (!in_array($style, $allowedDividerStyles, true) || !in_array($spacing, $allowedDividerSpacing, true)) {
                error_response('Gaya pemisah editorial tidak valid.', 422, 'invalid_editorial_content');
            }
            $normalised['style'] = $style;
            $normalised['spacing'] = $spacing;
        }

        if ($totalLength > 120000) {
            error_response('Dokumen editorial terlalu panjang.', 422, 'invalid_editorial_content');
        }
        $blocks[] = $normalised;
    }

    if (!$blocks) {
        if (!array_key_exists('presentation', $document)) return '';
        $encoded = json_encode(['version' => 1, 'blocks' => [], 'presentation' => $presentation], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded)) {
            error_response('Dokumen editorial tidak dapat disimpan.', 422, 'invalid_editorial_content');
        }
        return $encoded;
    }
    if (!$hasContent) error_response('Dokumen editorial harus memiliki materi.', 422, 'invalid_editorial_content');
    $encoded = json_encode(['version' => 1, 'blocks' => $blocks, 'presentation' => $presentation], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($encoded)) {
        error_response('Dokumen editorial tidak dapat disimpan.', 422, 'invalid_editorial_content');
    }
    return $encoded;
}

function admin_module_input(array $input, ?array $existing = null): array
{
    $levelNumber = (int) ($input['levelNumber'] ?? $input['level_number'] ?? $existing['level_number'] ?? 0);
    $moduleNumber = (int) ($input['moduleNumber'] ?? $input['module_number'] ?? $existing['module_number'] ?? 0);
    $levelName = profile_text($input['levelName'] ?? $input['level_name'] ?? $existing['level_name'] ?? '', 160);
    $title = profile_text($input['title'] ?? $existing['title'] ?? '', 255);
    $category = profile_text($input['category'] ?? $existing['category'] ?? '', 160);
    $summary = profile_text($input['summary'] ?? $existing['summary'] ?? '', 2000);
    $content = trim((string) ($input['content'] ?? $existing['content'] ?? ''));
    $editorialValue = array_key_exists('editorialContent', $input)
        ? $input['editorialContent']
        : (array_key_exists('editorial_content', $input) ? $input['editorial_content'] : ($existing['editorial_content'] ?? ''));
    $editorialContent = normalise_editorial_content($editorialValue);
    $videoScript = profile_text($input['videoScript'] ?? $input['video_script'] ?? $existing['video_script'] ?? '', 12000);
    $hasVideoUrl = array_key_exists('videoUrl', $input) || array_key_exists('video_url', $input);
    $videoUrl = $hasVideoUrl
        ? normalise_lesson_video_url($input['videoUrl'] ?? $input['video_url'] ?? '')
        : (string) ($existing['video_url'] ?? '');
    $practicalAssignment = profile_text($input['practicalAssignment'] ?? $input['practical_assignment'] ?? $existing['practical_assignment'] ?? '', 3000);
    $objectives = admin_string_list($input['learningObjectives'] ?? $input['learning_objectives'] ?? decode_json_field($existing['learning_objectives'] ?? '[]'));
    $takeaways = admin_string_list($input['keyTakeaways'] ?? $input['key_takeaways'] ?? decode_json_field($existing['key_takeaways'] ?? '[]'));
    $checklist = admin_string_list($input['checklist'] ?? decode_json_field($existing['checklist'] ?? '[]'));
    $sortOrder = (int) ($input['order'] ?? $input['sortOrder'] ?? $input['sort_order'] ?? $existing['sort_order'] ?? 0);
    if ($levelNumber < 1 || $levelNumber > 20 || $moduleNumber < 1 || $moduleNumber > 999) {
        error_response('Level dan nomor modul tidak valid.', 422, 'validation_error');
    }
    if ($levelName === '' || $title === '' || ($content === '' && $editorialContent === '')) {
        error_response('Level, judul, dan materi modul wajib diisi.', 422, 'validation_error');
    }
    if (strlen($content) > 100000) {
        error_response('Isi modul terlalu panjang.', 422, 'validation_error');
    }
    return [
        'levelNumber' => $levelNumber,
        'moduleNumber' => $moduleNumber,
        'levelName' => $levelName,
        'title' => $title,
        'category' => $category,
        'summary' => $summary,
        'content' => $content,
        'editorialContent' => $editorialContent,
        'videoScript' => $videoScript,
        'videoUrl' => $videoUrl,
        'learningObjectives' => json_encode($objectives, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'keyTakeaways' => json_encode($takeaways, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'checklist' => json_encode($checklist, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'practicalAssignment' => $practicalAssignment,
        'sortOrder' => max(0, $sortOrder),
    ];
}

/**
 * Chapters are persisted as the level_number/level_name pair on each module.
 * Keep a single name for a number so the admin curriculum cannot silently
 * split one chapter into multiple labels.
 */
function admin_existing_chapter_name(int $levelNumber, ?int $excludeModuleId = null): ?string
{
    $sql = 'SELECT level_name FROM course_modules WHERE level_number = ?';
    $params = [$levelNumber];
    if ($excludeModuleId !== null) {
        $sql .= ' AND id != ?';
        $params[] = $excludeModuleId;
    }
    $sql .= ' ORDER BY id ASC LIMIT 1';
    $statement = db()->prepare($sql);
    $statement->execute($params);
    $name = $statement->fetchColumn();
    return $name === false ? null : trim((string) $name);
}

function admin_validate_chapter_name(int $levelNumber, string $levelName, ?int $excludeModuleId = null): void
{
    $existingName = admin_existing_chapter_name($levelNumber, $excludeModuleId);
    if ($existingName !== null && $existingName !== $levelName) {
        error_response('Nama chapter harus sama dengan chapter yang sudah ada.', 422, 'chapter_name_mismatch');
    }
}

function admin_create_module(array $input): array
{
    $data = admin_module_input($input);
    admin_validate_chapter_name($data['levelNumber'], $data['levelName']);
    $duplicate = db()->prepare('SELECT id FROM course_modules WHERE module_number = ? LIMIT 1');
    $duplicate->execute([$data['moduleNumber']]);
    if ($duplicate->fetch()) {
        error_response('Nomor modul sudah digunakan.', 409, 'module_number_exists');
    }
    if ($data['sortOrder'] === 0) {
        $data['sortOrder'] = ((int) db()->query('SELECT COALESCE(MAX(sort_order), 0) FROM course_modules')->fetchColumn()) + 1;
    }
    $insert = db()->prepare('INSERT INTO course_modules (level_number, level_name, module_number, title, category, summary, content, editorial_content, video_script, video_url, learning_objectives, key_takeaways, checklist, practical_assignment, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $insert->execute([$data['levelNumber'], $data['levelName'], $data['moduleNumber'], $data['title'], $data['category'], $data['summary'], $data['content'], $data['editorialContent'], $data['videoScript'], $data['videoUrl'], $data['learningObjectives'], $data['keyTakeaways'], $data['checklist'], $data['practicalAssignment'], $data['sortOrder']]);
    return present_module(admin_module_from_id((int) db()->lastInsertId()) ?: []);
}

function admin_update_module(int $moduleId, array $input): array
{
    $existing = admin_module_from_id($moduleId);
    if (!$existing) {
        error_response('Modul tidak ditemukan.', 404, 'not_found');
    }
    $data = admin_module_input($input, $existing);
    if ($data['levelNumber'] !== (int) $existing['level_number']) {
        admin_validate_chapter_name($data['levelNumber'], $data['levelName'], $moduleId);
    }
    if ($data['moduleNumber'] !== (int) $existing['module_number']) {
        $duplicate = db()->prepare('SELECT id FROM course_modules WHERE module_number = ? AND id != ? LIMIT 1');
        $duplicate->execute([$data['moduleNumber'], $moduleId]);
        if ($duplicate->fetch()) {
            error_response('Nomor modul sudah digunakan.', 409, 'module_number_exists');
        }
        $progress = db()->prepare('SELECT COUNT(*) FROM user_progress WHERE module_number = ?');
        $progress->execute([(int) $existing['module_number']]);
        if ((int) $progress->fetchColumn() > 0) {
            error_response('Nomor modul tidak dapat diubah karena sudah memiliki progres learner.', 422, 'module_number_locked');
        }
    }
    db()->beginTransaction();
    try {
        $update = db()->prepare('UPDATE course_modules SET level_number = ?, level_name = ?, module_number = ?, title = ?, category = ?, summary = ?, content = ?, editorial_content = ?, video_script = ?, video_url = ?, learning_objectives = ?, key_takeaways = ?, checklist = ?, practical_assignment = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        $update->execute([$data['levelNumber'], $data['levelName'], $data['moduleNumber'], $data['title'], $data['category'], $data['summary'], $data['content'], $data['editorialContent'], $data['videoScript'], $data['videoUrl'], $data['learningObjectives'], $data['keyTakeaways'], $data['checklist'], $data['practicalAssignment'], $data['sortOrder'], $moduleId]);
        // Editing the chapter name is intentionally a chapter-wide operation.
        // This keeps every module in the same number/name bucket consistent.
        $renameChapter = db()->prepare('UPDATE course_modules SET level_name = ?, updated_at = CURRENT_TIMESTAMP WHERE level_number = ?');
        $renameChapter->execute([$data['levelName'], $data['levelNumber']]);
        db()->commit();
    } catch (Throwable $exception) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }
        throw $exception;
    }
    return present_module(admin_module_from_id($moduleId) ?: []);
}

function admin_delete_module(int $moduleId, bool $purgeProgress = false): array
{
    $module = admin_module_from_id($moduleId);
    if (!$module) {
        error_response('Modul tidak ditemukan.', 404, 'not_found');
    }
    $progress = db()->prepare('SELECT COUNT(*) FROM user_progress WHERE module_number = ?');
    $progress->execute([(int) $module['module_number']]);
    $progressCount = (int) $progress->fetchColumn();
    if ($progressCount > 0 && !$purgeProgress) {
        error_response('Modul memiliki progres learner. Konfirmasi penghapusan bersama progres untuk melanjutkan.', 422, 'module_has_progress');
    }
    db()->beginTransaction();
    try {
        db()->prepare('DELETE FROM quiz_questions WHERE module_number = ?')->execute([(int) $module['module_number']]);
        if ($progressCount > 0) {
            db()->prepare('DELETE FROM user_progress WHERE module_number = ?')->execute([(int) $module['module_number']]);
        }
        db()->prepare('DELETE FROM course_modules WHERE id = ?')->execute([$moduleId]);
        db()->commit();
    } catch (Throwable $exception) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }
        throw $exception;
    }

    return [
        'moduleId' => $moduleId,
        'moduleNumber' => (int) $module['module_number'],
        'deletedProgressEntries' => $progressCount,
    ];
}

function admin_reorder_modules(array $items): array
{
    if (!is_array($items) || count($items) < 1 || count($items) > 999) {
        error_response('Urutan modul tidak valid.', 422, 'validation_error');
    }
    $moduleIds = [];
    foreach ($items as $item) {
        $moduleId = (int) (is_array($item) ? ($item['id'] ?? 0) : $item);
        if ($moduleId < 1 || isset($moduleIds[$moduleId])) {
            error_response('Data modul tidak valid.', 422, 'validation_error');
        }
        $moduleIds[$moduleId] = true;
    }
    $existing = db()->prepare('SELECT COUNT(*) FROM course_modules WHERE id = ?');
    foreach (array_keys($moduleIds) as $moduleId) {
        $existing->execute([$moduleId]);
        if ((int) $existing->fetchColumn() !== 1) {
            error_response('Salah satu modul tidak ditemukan.', 404, 'not_found');
        }
    }
    // A reorder is a replacement for the complete roadmap, not a partial
    // patch. Reject subsets so omitted modules cannot retain colliding or
    // stale sort_order values and later jump between chapters unexpectedly.
    $allIds = array_map('intval', db()->query('SELECT id FROM course_modules')->fetchAll(PDO::FETCH_COLUMN));
    $submittedIds = array_map('intval', array_keys($moduleIds));
    sort($allIds, SORT_NUMERIC);
    sort($submittedIds, SORT_NUMERIC);
    if ($allIds !== $submittedIds) {
        error_response('Urutan modul harus memuat seluruh modul aktif.', 422, 'incomplete_reorder');
    }
    db()->beginTransaction();
    try {
        $update = db()->prepare('UPDATE course_modules SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        foreach (array_keys($moduleIds) as $index => $moduleId) {
            $update->execute([$index + 1, $moduleId]);
        }
        db()->commit();
    } catch (Throwable $exception) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }
        throw $exception;
    }
    return admin_course_detail_data();
}

function admin_module_questions(int $moduleId): array
{
    $module = admin_module_from_id($moduleId);
    if (!$module) {
        error_response('Modul tidak ditemukan.', 404, 'not_found');
    }
    $statement = db()->prepare('SELECT * FROM quiz_questions WHERE module_number = ? ORDER BY id ASC');
    $statement->execute([(int) $module['module_number']]);
    return array_map('present_question', $statement->fetchAll());
}

function admin_question_input(array $input, int $moduleNumber): array
{
    $question = profile_text($input['question'] ?? '', 5000);
    $options = admin_string_list($input['options'] ?? [], 6, 1000);
    $correctIndex = (int) ($input['correctIndex'] ?? $input['correct_index'] ?? -1);
    $explanation = profile_text($input['explanation'] ?? '', 5000);
    $difficulty = strtolower(profile_text($input['difficulty'] ?? 'medium', 20));
    $type = strtolower(profile_text($input['type'] ?? 'mcq', 20));
    $learningObjective = profile_text($input['learningObjective'] ?? $input['learning_objective'] ?? '', 1000);
    if ($question === '' || count($options) < 2 || $correctIndex < 0 || $correctIndex >= count($options)) {
        error_response('Pertanyaan, minimal dua opsi, dan jawaban benar wajib valid.', 422, 'validation_error');
    }
    if (!in_array($difficulty, ['easy', 'medium', 'hard'], true)) {
        $difficulty = 'medium';
    }
    if ($type !== 'mcq') {
        error_response('Tipe soal yang didukung saat ini adalah pilihan ganda.', 422, 'validation_error');
    }
    return [$moduleNumber, $question, json_encode($options, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $correctIndex, $explanation, $difficulty, $type, $learningObjective];
}

function admin_create_question(int $moduleId, array $input): array
{
    $module = admin_module_from_id($moduleId);
    if (!$module) {
        error_response('Modul tidak ditemukan.', 404, 'not_found');
    }
    $data = admin_question_input($input, (int) $module['module_number']);
    db()->prepare('INSERT INTO quiz_questions (module_number, question, options, correct_index, explanation, difficulty, type, learning_objective) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')->execute($data);
    $statement = db()->prepare('SELECT * FROM quiz_questions WHERE id = ? LIMIT 1');
    $statement->execute([(int) db()->lastInsertId()]);
    return present_question($statement->fetch() ?: []);
}

function admin_update_question(int $moduleId, int $questionId, array $input): array
{
    $module = admin_module_from_id($moduleId);
    if (!$module) {
        error_response('Modul tidak ditemukan.', 404, 'not_found');
    }
    $existing = db()->prepare('SELECT id FROM quiz_questions WHERE id = ? AND module_number = ? LIMIT 1');
    $existing->execute([$questionId, (int) $module['module_number']]);
    if (!$existing->fetch()) {
        error_response('Soal tidak ditemukan.', 404, 'not_found');
    }
    $data = admin_question_input($input, (int) $module['module_number']);
    db()->prepare('UPDATE quiz_questions SET module_number = ?, question = ?, options = ?, correct_index = ?, explanation = ?, difficulty = ?, type = ?, learning_objective = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')->execute(array_merge($data, [$questionId]));
    $statement = db()->prepare('SELECT * FROM quiz_questions WHERE id = ? LIMIT 1');
    $statement->execute([$questionId]);
    return present_question($statement->fetch() ?: []);
}

function admin_delete_question(int $moduleId, int $questionId): void
{
    $module = admin_module_from_id($moduleId);
    if (!$module) {
        error_response('Modul tidak ditemukan.', 404, 'not_found');
    }
    $delete = db()->prepare('DELETE FROM quiz_questions WHERE id = ? AND module_number = ?');
    $delete->execute([$questionId, (int) $module['module_number']]);
    if ($delete->rowCount() < 1) {
        error_response('Soal tidak ditemukan.', 404, 'not_found');
    }
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

function present_ai_conversation(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'title' => (string) $row['title'],
        'lastMessagePreview' => (string) ($row['last_message_preview'] ?? ''),
        'messageCount' => (int) ($row['message_count'] ?? 0),
        'createdAt' => $row['created_at'] ?? null,
        'updatedAt' => $row['updated_at'] ?? null,
        'archivedAt' => $row['archived_at'] ?? null,
    ];
}

function present_ai_chat_message(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'role' => (string) $row['role'],
        'content' => (string) $row['content'],
        'provider' => $row['provider'] ?? null,
        'model' => $row['model'] ?? null,
        'fallback' => (bool) ($row['used_fallback'] ?? false),
        'createdAt' => $row['created_at'] ?? null,
    ];
}

function present_ai_activity(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'conversationId' => $row['conversation_id'] === null ? null : (int) $row['conversation_id'],
        'type' => (string) $row['event_type'],
        'label' => (string) $row['label'],
        'detail' => (string) ($row['detail'] ?? ''),
        'createdAt' => $row['created_at'] ?? null,
    ];
}
