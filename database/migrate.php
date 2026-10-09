<?php
declare(strict_types=1);

/**
 * Explicit, additive database migration and health check for the native API.
 *
 * The web bootstrap still creates missing application tables for a fresh
 * install. Existing cPanel databases should use this CLI instead so index
 * changes are visible, repeatable, and never mixed with content seeding.
 *
 * Usage:
 *   php database/migrate.php                 # read-only plan
 *   php database/migrate.php --plan
 *   php database/migrate.php --verify        # plan + data integrity checks
 *   php database/migrate.php --apply         # apply additive columns and indexes
 *   php database/migrate.php --apply --verify --expect-environment=<env>
 *   php database/migrate.php --init-environment-marker --expect-environment=<env>
 *
 * Select the private config with AAPLAYERACADEMY_CONFIG. --apply and
 * --init-environment-marker must name the expected environment, which is
 * compared with the config before any database connection is opened.
 *
 * No command in this file deletes or rewrites learner, course, quiz, or AI
 * records. DDL can still acquire a short metadata lock, so run --apply on
 * staging first and schedule it during a quiet window when both cPanel hosts
 * share one database.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Migration hanya boleh dijalankan dari CLI.\n");
}

require_once __DIR__ . '/../public/api/bootstrap.php';

const AAPM_SCHEMA_MIGRATION_KEY = '20260909_ai_conversation_archiving_v1';

$arguments = array_slice($argv, 1);
$allowedArguments = ['--apply', '--plan', '--verify', '--json', '--init-environment-marker'];
$expectedEnvironment = null;
foreach ($arguments as $argument) {
    if (strpos($argument, '--expect-environment=') === 0) {
        $expectedEnvironment = strtolower(trim(substr($argument, strlen('--expect-environment='))));
        continue;
    }
    if (!in_array($argument, $allowedArguments, true)) {
        fwrite(STDERR, "Argumen tidak dikenal: {$argument}\n");
        exit(2);
    }
}

$apply = in_array('--apply', $arguments, true);
$explicitPlan = in_array('--plan', $arguments, true);
if ($apply && $explicitPlan) {
    fwrite(STDERR, "Gunakan --apply atau --plan, bukan keduanya.\n");
    exit(2);
}
$initMarker = in_array('--init-environment-marker', $arguments, true);
if ($initMarker && ($apply || $explicitPlan)) {
    fwrite(STDERR, "--init-environment-marker tidak dapat digabung dengan --apply atau --plan.\n");
    exit(2);
}
$verify = in_array('--verify', $arguments, true) || $apply;
$jsonOutput = in_array('--json', $arguments, true);

try {
    $config = app_config();
    $driver = strtolower(trim((string) ($config['db_driver'] ?? '')));
    $environment = (string) $config['environment'];
    $markerRequired = !empty($config['environment_marker_required']);
    // Target guard: decided from the private config before any connection.
    if ($expectedEnvironment !== null && $expectedEnvironment !== $environment) {
        fwrite(STDERR, "Target tidak cocok: konfigurasi memakai lingkungan {$environment}, --expect-environment={$expectedEnvironment}. Tidak ada perubahan.\n");
        exit(2);
    }
    if (($apply || $initMarker) && $expectedEnvironment === null) {
        fwrite(STDERR, "--expect-environment=<lingkungan> wajib untuk --apply dan --init-environment-marker. Tidak ada perubahan.\n");
        exit(2);
    }
    $pdo = migration_connection($config, $driver);
    $databaseName = migration_database_name($pdo, $driver);
    $markerStatus = migration_environment_marker_status($pdo, $environment);
    if ($initMarker) {
        $markerResult = migration_initialise_environment_marker($pdo, $driver, $environment);
        migration_output([
            'mode' => 'init-environment-marker',
            'target' => ['environment' => $environment, 'driver' => $driver, 'database' => $databaseName],
            'environmentMarker' => $markerResult,
            'applied' => false,
            'missingTables' => [],
            'columns' => [],
            'indexes' => [],
            'health' => [],
        ], $jsonOutput);
        exit(0);
    }
    if ($apply && $markerRequired && $markerStatus !== 'verified') {
        throw new RuntimeException('Penanda lingkungan database belum valid (' . $markerStatus . '). Jalankan --init-environment-marker terlebih dahulu. Tidak ada perubahan.');
    }
    $expectedIndexes = migration_expected_indexes();
    $expectedColumns = migration_expected_columns();
    $checksum = hash(
        'sha256',
        (string) json_encode($expectedIndexes, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
    );

    $requiredTables = [
        'users',
        'user_profiles',
        'user_ai_settings',
        'auth_rate_limits',
        'course_modules',
        'quiz_questions',
        'user_progress',
        'certificates',
        'farm_data',
        'ai_conversations',
        'ai_chat_messages',
        'ai_activity_log',
        'app_settings',
    ];
    $missingTables = array_values(array_filter(
        $requiredTables,
        static fn (string $table): bool => !migration_table_exists($pdo, $driver, $table)
    ));

    if ($apply && $missingTables) {
        throw new RuntimeException(
            'Tabel aplikasi belum lengkap: ' . implode(', ', $missingTables)
            . '. Jalankan schema.sql atau biarkan bootstrap membuat tabel sebelum migrasi.'
        );
    }

    $indexPlan = migration_index_plan($pdo, $driver, $expectedIndexes);
    $columnPlan = migration_column_plan($pdo, $driver, $expectedColumns);
    $result = [
        'mode' => $apply ? 'apply' : ($verify ? 'verify' : 'plan'),
        'driver' => $driver,
        'database' => $databaseName,
        'migration' => AAPM_SCHEMA_MIGRATION_KEY,
        'checksum' => $checksum,
        'missingTables' => $missingTables,
        'columns' => $columnPlan,
        'indexes' => $indexPlan,
        'applied' => false,
        'target' => ['environment' => $environment, 'driver' => $driver, 'database' => $databaseName],
        'environmentMarker' => $markerStatus,
        'markerRequired' => $markerRequired,
        'health' => [],
    ];

    if ($apply) {
        migration_create_tracking_table($pdo, $driver);
        foreach ($columnPlan as $column) {
            if ($column['status'] === 'missing_table') {
                continue;
            }
            if ($column['status'] !== 'missing') {
                continue;
            }
            $table = migration_quote_identifier($column['table'], $driver);
            $name = migration_quote_identifier($column['name'], $driver);
            $definition = $driver === 'sqlite' ? $column['sqliteType'] : $column['mysqlType'];
            $pdo->exec("ALTER TABLE {$table} ADD COLUMN {$name} {$definition}");
        }
        // Re-read indexes after the additive column exists; this keeps the
        // archive index plan truthful on an older cPanel schema.
        $indexPlan = migration_index_plan($pdo, $driver, $expectedIndexes);
        foreach ($indexPlan as $index) {
            if ($index['status'] === 'mismatch') {
                throw new RuntimeException(
                    'Index ' . $index['table'] . '.' . $index['name']
                    . ' sudah ada dengan kolom berbeda; periksa manual sebelum melanjutkan.'
                );
            }
            if ($index['status'] !== 'missing') {
                continue;
            }
            $table = migration_quote_identifier($index['table'], $driver);
            $name = migration_quote_identifier($index['name'], $driver);
            $columns = implode(', ', array_map(
                static fn (string $column): string => migration_quote_identifier($column, $driver),
                $index['columns']
            ));
            $pdo->exec("CREATE INDEX {$name} ON {$table} ({$columns})");
        }
        migration_record($pdo, $driver, AAPM_SCHEMA_MIGRATION_KEY, $checksum);
        // Q02 adds its own recorded key; the Q01 key above is never repurposed.
        aapm_ensure_auth_security_schema($pdo, $driver);
        migration_record($pdo, $driver, AAPM_AUTH_SCHEMA_KEY, hash('sha256', AAPM_AUTH_SCHEMA_KEY . ':users+tokens+audit'));
        // Q03 has its own key. It adds the assessment tables, installs policy academy-v1, and snapshots legacy progress once.
        aapm_ensure_assessment_schema($pdo, $driver);
        aapm_snapshot_legacy_progress($pdo);
        migration_record($pdo, $driver, AAPM_ASSESSMENT_SCHEMA_KEY, hash('sha256', AAPM_ASSESSMENT_SCHEMA_KEY . ':attempts+items+events+policy+legacy-snapshot'));
        // Q04 adds academic generations, tier policies, certificate issuances, immutable evidence, and audit events. Additive only.
        aapm_ensure_certification_schema($pdo, $driver);
        migration_record($pdo, $driver, AAPM_CERT_SCHEMA_KEY, hash('sha256', AAPM_CERT_SCHEMA_KEY . ':generations+tiers+issuances+evidence+events'));
        // Q05 backfills existing modules as published revisions, creates policy academy-v1, and assigns every existing account to it, once.
        aapm_ensure_curriculum_schema($pdo, $driver);
        $result['curriculumAssigned'] = aapm_cur_assign_existing_learners($pdo);
        migration_record($pdo, $driver, AAPM_CUR_SCHEMA_KEY, hash('sha256', AAPM_CUR_SCHEMA_KEY . ':revisions+banks+policies+assignments+events'));
        $result['applied'] = true;
        $result['columns'] = migration_column_plan($pdo, $driver, $expectedColumns);
        $result['indexes'] = migration_index_plan($pdo, $driver, $expectedIndexes);
    }

    $result['authSchema'] = aapm_auth_schema_status($pdo);
    $result['assessmentSchema'] = aapm_assessment_schema_status($pdo);
    $result['certificationSchema'] = aapm_certification_schema_status($pdo);
    $result['curriculumSchema'] = aapm_cur_schema_status($pdo);
    if ($verify) {
        $result['health'] = migration_health_checks($pdo, $driver);
    }

    migration_output($result, $jsonOutput);
    exit(migration_exit_code($result));
} catch (Throwable $exception) {
    if ($jsonOutput) {
        echo json_encode([
            'ok' => false,
            'error' => $exception->getMessage(),
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    } else {
        fwrite(STDERR, "Migration gagal: {$exception->getMessage()}\n");
    }
    exit(1);
}

/** @param array<string,mixed> $config */
function migration_connection(array $config, string $driver): PDO
{
    if ($driver === 'sqlite') {
        $path = trim((string) ($config['db_path'] ?? ''));
        if ($path === '') {
            throw new RuntimeException('Jalur database SQLite belum dikonfigurasi.');
        }
        if (!is_file($path)) {
            throw new RuntimeException("Database SQLite tidak ditemukan: {$path}");
        }
        $pdo = new PDO('sqlite:' . $path);
        $pdo->exec('PRAGMA foreign_keys = ON');
    } elseif ($driver === 'mysql') {
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            (string) ($config['db_host'] ?? '127.0.0.1'),
            (string) ($config['db_port'] ?? '3306'),
            (string) ($config['db_name'] ?? '')
        );
        $pdo = new PDO($dsn, (string) ($config['db_user'] ?? ''), (string) ($config['db_password'] ?? ''));
    } else {
        throw new RuntimeException("Driver database tidak didukung: {$driver}");
    }

    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    return $pdo;
}

/** Read-only: verified, missing, or mismatch. Never creates anything. */
function migration_environment_marker_status(PDO $pdo, string $environment): string
{
    try {
        $rows = $pdo->query('SELECT environment FROM aapm_environment_marker WHERE id = 1')->fetchAll();
    } catch (PDOException $exception) {
        return 'missing';
    }
    if (count($rows) !== 1) {
        return 'missing';
    }

    return strtolower(trim((string) $rows[0]['environment'])) === $environment ? 'verified' : 'mismatch';
}

/** Creates the marker only when absent. An existing marker for another environment is never overwritten. */
function migration_initialise_environment_marker(PDO $pdo, string $driver, string $environment): string
{
    $suffix = $driver === 'mysql' ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci' : '';
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS aapm_environment_marker (
            id INTEGER NOT NULL,
            environment VARCHAR(32) NOT NULL,
            provisioned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        )' . $suffix
    );

    $status = migration_environment_marker_status($pdo, $environment);
    if ($status === 'verified') {
        return 'already_verified';
    }
    if ($status === 'mismatch') {
        throw new RuntimeException('Penanda lingkungan sudah terisi untuk lingkungan lain. Penanda tidak diubah.');
    }

    $insert = $pdo->prepare('INSERT INTO aapm_environment_marker (id, environment) VALUES (1, ?)');
    $insert->execute([$environment]);

    return 'created';
}

function migration_database_name(PDO $pdo, string $driver): string
{
    if ($driver === 'sqlite') {
        $row = $pdo->query('PRAGMA database_list')->fetch(PDO::FETCH_ASSOC);
        return 'sqlite:' . basename((string) ($row['file'] ?? 'memory'));
    }
    $name = $pdo->query('SELECT DATABASE()')->fetchColumn();
    if (!is_string($name) || trim($name) === '') {
        throw new RuntimeException('Koneksi tidak memiliki database aktif.');
    }
    return $name;
}

/** @return list<array{table:string,name:string,columns:list<string>}> */
function migration_expected_indexes(): array
{
    return [
        [
            'table' => 'course_modules',
            'name' => 'course_modules_chapter_order_idx',
            'columns' => ['level_number', 'sort_order', 'module_number'],
        ],
        [
            'table' => 'user_progress',
            'name' => 'user_progress_user_updated_idx',
            'columns' => ['user_id', 'updated_at', 'module_number'],
        ],
        [
            'table' => 'certificates',
            'name' => 'certificates_user_issued_idx',
            'columns' => ['user_id', 'issued_at', 'id'],
        ],
        [
            'table' => 'ai_conversations',
            'name' => 'ai_conversations_user_archive_idx',
            'columns' => ['user_id', 'archived_at', 'updated_at', 'id'],
        ],
    ];
}

/** @return list<array{table:string,name:string,sqliteType:string,mysqlType:string}> */
function migration_expected_columns(): array
{
    return [
        [
            'table' => 'ai_conversations',
            'name' => 'archived_at',
            'sqliteType' => 'TEXT NULL',
            'mysqlType' => 'DATETIME NULL',
        ],
    ];
}

function migration_quote_identifier(string $identifier, string $driver): string
{
    if (!preg_match('/\A[A-Za-z_][A-Za-z0-9_]*\z/', $identifier)) {
        throw new RuntimeException("Identifier database tidak valid: {$identifier}");
    }
    return $driver === 'sqlite' ? '"' . $identifier . '"' : '`' . $identifier . '`';
}

function migration_table_exists(PDO $pdo, string $driver, string $table): bool
{
    if ($driver === 'sqlite') {
        $statement = $pdo->prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1");
        $statement->execute([$table]);
        return (bool) $statement->fetchColumn();
    }
    $statement = $pdo->prepare(
        'SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1'
    );
    $statement->execute([$table]);
    return (bool) $statement->fetchColumn();
}

function migration_column_exists(PDO $pdo, string $driver, string $table, string $column): bool
{
    if ($driver === 'sqlite') {
        $tableName = migration_quote_identifier($table, $driver);
        $columns = $pdo->query("PRAGMA table_info({$tableName})")->fetchAll();
        foreach ($columns as $item) {
            if ((string) ($item['name'] ?? '') === $column) return true;
        }
        return false;
    }
    $statement = $pdo->prepare(
        'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1'
    );
    $statement->execute([$table, $column]);
    return (bool) $statement->fetchColumn();
}

/** @param list<array{table:string,name:string,sqliteType:string,mysqlType:string}> $expectedColumns */
function migration_column_plan(PDO $pdo, string $driver, array $expectedColumns): array
{
    $plan = [];
    foreach ($expectedColumns as $expected) {
        $status = !migration_table_exists($pdo, $driver, $expected['table'])
            ? 'missing_table'
            : (migration_column_exists($pdo, $driver, $expected['table'], $expected['name']) ? 'present' : 'missing');
        $plan[] = $expected + ['status' => $status];
    }
    return $plan;
}

/** @return array<string,list<string>> */
function migration_index_signatures(PDO $pdo, string $driver, string $table): array
{
    $signatures = [];
    if ($driver === 'sqlite') {
        $quotedTable = migration_quote_identifier($table, $driver);
        $indexes = $pdo->query("PRAGMA index_list({$quotedTable})")->fetchAll();
        foreach ($indexes as $index) {
            $name = (string) ($index['name'] ?? '');
            if ($name === '') continue;
            $quotedIndex = migration_quote_identifier($name, $driver);
            $columns = $pdo->query("PRAGMA index_info({$quotedIndex})")->fetchAll();
            usort($columns, static fn (array $left, array $right): int => ((int) ($left['seqno'] ?? 0)) <=> ((int) ($right['seqno'] ?? 0)));
            $signatures[$name] = array_values(array_map(
                static fn (array $column): string => (string) ($column['name'] ?? ''),
                $columns
            ));
        }
        return $signatures;
    }

    $statement = $pdo->prepare(
        'SELECT INDEX_NAME, SEQ_IN_INDEX, COLUMN_NAME
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
         ORDER BY INDEX_NAME, SEQ_IN_INDEX'
    );
    $statement->execute([$table]);
    foreach ($statement->fetchAll() as $row) {
        $name = (string) ($row['INDEX_NAME'] ?? '');
        if ($name === '') continue;
        $signatures[$name][] = (string) ($row['COLUMN_NAME'] ?? '');
    }
    return $signatures;
}

/** @param list<array{table:string,name:string,columns:list<string>}> $expectedIndexes */
function migration_index_plan(PDO $pdo, string $driver, array $expectedIndexes): array
{
    $cache = [];
    $plan = [];
    foreach ($expectedIndexes as $expected) {
        $table = $expected['table'];
        if (!migration_table_exists($pdo, $driver, $table)) {
            $plan[] = $expected + ['status' => 'missing_table'];
            continue;
        }
        if (!isset($cache[$table])) {
            $cache[$table] = migration_index_signatures($pdo, $driver, $table);
        }
        $existing = $cache[$table];
        $status = 'missing';
        if (isset($existing[$expected['name']])) {
            $status = $existing[$expected['name']] === $expected['columns'] ? 'present' : 'mismatch';
        } elseif (in_array($expected['columns'], array_values($existing), true)) {
            $status = 'equivalent';
        }
        $plan[] = $expected + ['status' => $status];
    }
    return $plan;
}

function migration_create_tracking_table(PDO $pdo, string $driver): void
{
    $suffix = $driver === 'mysql' ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci' : '';
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS schema_migrations (
            migration_key VARCHAR(160) NOT NULL,
            checksum CHAR(64) NOT NULL,
            applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (migration_key)
        )' . $suffix
    );
}

function migration_record(PDO $pdo, string $driver, string $key, string $checksum): void
{
    $existing = $pdo->prepare('SELECT checksum FROM schema_migrations WHERE migration_key = ? LIMIT 1');
    $existing->execute([$key]);
    $stored = $existing->fetchColumn();
    if ($stored !== false && (string) $stored !== $checksum) {
        throw new RuntimeException("Checksum migration {$key} berbeda dari catatan sebelumnya.");
    }
    if ($stored !== false) {
        // A successful replay validates the checksum, preserving the original application evidence.
        return;
    }
    $insert = $pdo->prepare(
        'INSERT INTO schema_migrations (migration_key, checksum, applied_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
    );
    $insert->execute([$key, $checksum]);
}

/**
 * Run only non-secret integrity checks. A non-zero value means the check
 * found rows requiring review; it never causes this script to rewrite them.
 *
 * @return list<array{name:string,severity:string,total:int,status:string,note:string}>
 */
function migration_health_checks(PDO $pdo, string $driver): array
{
    $checks = [
        [
            'name' => 'ai_chat_messages_orphan_conversation',
            'severity' => 'error',
            'sql' => 'SELECT COUNT(*) FROM ai_chat_messages m LEFT JOIN ai_conversations c ON c.id = m.conversation_id WHERE c.id IS NULL',
            'note' => 'Pesan AI harus memiliki percakapan induk.',
        ],
        [
            'name' => 'ai_conversations_orphan_user',
            'severity' => 'error',
            'sql' => 'SELECT COUNT(*) FROM ai_conversations c LEFT JOIN users u ON u.id = c.user_id WHERE u.id IS NULL',
            'note' => 'Percakapan AI harus memiliki akun induk.',
        ],
        [
            'name' => 'ai_activity_orphan_user',
            'severity' => 'error',
            'sql' => 'SELECT COUNT(*) FROM ai_activity_log a LEFT JOIN users u ON u.id = a.user_id WHERE u.id IS NULL',
            'note' => 'Log aktivitas AI harus memiliki akun induk.',
        ],
        [
            'name' => 'ai_activity_orphan_conversation',
            'severity' => 'error',
            'sql' => 'SELECT COUNT(*) FROM ai_activity_log a LEFT JOIN ai_conversations c ON c.id = a.conversation_id WHERE a.conversation_id IS NOT NULL AND c.id IS NULL',
            'note' => 'conversation_id log AI yang terisi harus valid.',
        ],
        [
            'name' => 'user_progress_orphan_user',
            'severity' => 'error',
            'sql' => 'SELECT COUNT(*) FROM user_progress p LEFT JOIN users u ON u.id = p.user_id WHERE u.id IS NULL',
            'note' => 'Progress harus memiliki akun induk.',
        ],
        [
            'name' => 'farm_data_orphan_user',
            'severity' => 'error',
            'sql' => 'SELECT COUNT(*) FROM farm_data f LEFT JOIN users u ON u.id = f.user_id WHERE u.id IS NULL',
            'note' => 'Data farm harus memiliki akun induk.',
        ],
        [
            'name' => 'certificates_orphan_user',
            'severity' => 'error',
            'sql' => 'SELECT COUNT(*) FROM certificates c LEFT JOIN users u ON u.id = c.user_id WHERE u.id IS NULL',
            'note' => 'Sertifikat harus memiliki akun induk.',
        ],
        [
            'name' => 'profile_orphan_user',
            'severity' => 'error',
            'sql' => 'SELECT COUNT(*) FROM user_profiles p LEFT JOIN users u ON u.id = p.user_id WHERE u.id IS NULL',
            'note' => 'Profil harus memiliki akun induk.',
        ],
        [
            'name' => 'user_ai_settings_orphan_user',
            'severity' => 'error',
            'sql' => 'SELECT COUNT(*) FROM user_ai_settings s LEFT JOIN users u ON u.id = s.user_id WHERE u.id IS NULL',
            'note' => 'Override AI akun harus memiliki akun induk.',
        ],
        [
            'name' => 'quiz_orphan_module_excluding_global',
            'severity' => 'error',
            'sql' => 'SELECT COUNT(*) FROM quiz_questions q LEFT JOIN course_modules m ON m.module_number = q.module_number WHERE q.module_number <> 0 AND m.id IS NULL',
            'note' => 'module_number 0 adalah bank soal final exam global; nomor lain harus ada di katalog.',
        ],
        [
            'name' => 'progress_orphan_module_excluding_final_exam',
            'severity' => 'error',
            'sql' => 'SELECT COUNT(*) FROM user_progress p LEFT JOIN course_modules m ON m.module_number = p.module_number WHERE p.module_number <> 0 AND m.id IS NULL',
            'note' => 'module_number 0 adalah progres final exam; nomor lain harus ada di katalog.',
        ],
        [
            'name' => 'ai_message_count_mismatch',
            'severity' => 'error',
            'sql' => 'SELECT COUNT(*) FROM (SELECT c.id FROM ai_conversations c LEFT JOIN ai_chat_messages m ON m.conversation_id = c.id GROUP BY c.id, c.message_count HAVING c.message_count <> COUNT(m.id)) x',
            'note' => 'Counter ringkasan percakapan harus sama dengan jumlah pesan.',
        ],
        [
            'name' => 'farm_duplicate_user_week_groups',
            'severity' => 'warning',
            'sql' => 'SELECT COUNT(*) FROM (SELECT user_id, week FROM farm_data GROUP BY user_id, week HAVING COUNT(*) > 1) x',
            'note' => 'Periksa sebelum menambah unique index; skema saat ini masih mengizinkan beberapa record per minggu.',
        ],
        [
            'name' => 'module_chapter_name_conflicts',
            'severity' => 'warning',
            'sql' => 'SELECT COUNT(*) FROM (SELECT level_number FROM course_modules GROUP BY level_number HAVING COUNT(DISTINCT level_name) > 1) x',
            'note' => 'Perlu keputusan editorial sebelum menyamakan nama chapter.',
        ],
        [
            'name' => 'quiz_invalid_difficulty_non_global',
            'severity' => 'error',
            'sql' => "SELECT COUNT(*) FROM quiz_questions WHERE module_number <> 0 AND difficulty NOT IN ('easy', 'medium', 'hard', 'expert')",
            'note' => 'Soal modul learner harus memakai easy, medium, hard, atau expert; bank global boleh memiliki level tambahan.',
        ],
    ];

    if ($driver === 'mysql') {
        $checks[] = [
            'name' => 'module_invalid_json_fields',
            'severity' => 'error',
            'sql' => 'SELECT COUNT(*) FROM course_modules WHERE JSON_VALID(learning_objectives) = 0 OR JSON_VALID(key_takeaways) = 0 OR JSON_VALID(checklist) = 0',
            'note' => 'Field tujuan, insight, dan checklist harus berupa JSON valid.',
        ];
    }

    $results = [];
    foreach ($checks as $check) {
        try {
            $statement = $pdo->query($check['sql']);
            $total = (int) $statement->fetchColumn();
            $results[] = [
                'name' => $check['name'],
                'severity' => $check['severity'],
                'total' => $total,
                'status' => $total === 0 ? 'pass' : 'review',
                'note' => $check['note'],
            ];
        } catch (Throwable $exception) {
            $results[] = [
                'name' => $check['name'],
                'severity' => 'error',
                'total' => -1,
                'status' => 'unverified',
                'note' => 'Query health check gagal: ' . $exception->getMessage(),
            ];
        }
    }
    return $results;
}

/** @param array<string,mixed> $result */
function migration_output(array $result, bool $jsonOutput): void
{
    if ($jsonOutput) {
        echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
        return;
    }

    echo "AAPM database {$result['mode']}\n";
    echo "Driver: {$result['driver']}\n";
    echo "Database: {$result['database']}\n";
    if (isset($result['target'])) {
        echo "Environment: {$result['target']['environment']}\n";
    }
    if (isset($result['environmentMarker'])) {
        echo "Environment marker: {$result['environmentMarker']}\n";
    }
    if (isset($result['assessmentSchema'])) {
        echo 'Assessment schema: ' . (in_array(false, $result['assessmentSchema'], true) ? 'missing' : 'present') . "
";
    }
    if (isset($result['certificationSchema'])) {
        echo 'Certification schema: ' . (in_array(false, $result['certificationSchema'], true) ? 'missing' : 'present') . "
";
    }
    if (isset($result['curriculumSchema'])) {
        echo 'Curriculum schema: ' . (in_array(false, $result['curriculumSchema'], true) ? 'missing' : 'present') . "
";
    }
    if (isset($result['authSchema'])) {
        echo 'Auth schema: ' . (in_array(false, $result['authSchema'], true) ? 'missing' : 'present') . "\n";
    }
    echo "Migration: {$result['migration']}\n";
    if ($result['missingTables']) {
        echo 'Missing tables: ' . implode(', ', $result['missingTables']) . "\n";
    }
    echo "Columns:\n";
    foreach ($result['columns'] as $column) {
        echo sprintf(
            "- %s.%s [%s]\n",
            $column['table'],
            $column['name'],
            $column['status']
        );
    }
    echo "Indexes:\n";
    foreach ($result['indexes'] as $index) {
        echo sprintf(
            "- %s.%s [%s] (%s)\n",
            $index['table'],
            $index['name'],
            $index['status'],
            implode(', ', $index['columns'])
        );
    }
    if ($result['applied']) {
        echo "Applied: additive AI archive column/index changes recorded; no rows were deleted or rewritten.\n";
    }
    if ($result['health']) {
        echo "Health checks:\n";
        foreach ($result['health'] as $check) {
            echo sprintf(
                "- %s: %s (%d) — %s\n",
                $check['name'],
                strtoupper($check['status']),
                $check['total'],
                $check['note']
            );
        }
    }
}

/** @param array<string,mixed> $result */
function migration_exit_code(array $result): int
{
    if (isset($result['authSchema']) && in_array(false, $result['authSchema'], true)) return 1;
    if (isset($result['assessmentSchema']) && in_array(false, $result['assessmentSchema'], true)) return 1;
    if (isset($result['certificationSchema']) && in_array(false, $result['certificationSchema'], true)) return 1;
    if (isset($result['curriculumSchema']) && in_array(false, $result['curriculumSchema'], true)) return 1;
    if (!empty($result['markerRequired']) && ($result['environmentMarker'] ?? '') !== 'verified') return 1;
    if (!empty($result['missingTables'])) return 1;
    foreach ($result['columns'] as $column) {
        if (in_array($column['status'], ['missing', 'missing_table'], true)) return 1;
    }
    foreach ($result['indexes'] as $index) {
        if (in_array($index['status'], ['mismatch', 'missing_table'], true)) return 1;
    }
    foreach ($result['health'] as $check) {
        if ($check['status'] === 'unverified') return 1;
        if ($check['status'] === 'review' && $check['severity'] === 'error') return 1;
    }
    return 0;
}
