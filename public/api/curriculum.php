<?php
declare(strict_types=1);

/**
 * Q05 curriculum publishing. Editors work in a draft workspace; only a successful
 * publish writes the learner-facing projection (course_modules and quiz_questions)
 * and creates immutable revisions. Academic requirements are versioned policies,
 * and every learner keeps the policy assigned to their account.
 *
 * Every write runs in one transaction. Input is normalised before a transaction
 * opens, so no validation error exits with a transaction still open.
 */

const AAPM_CUR_SCHEMA_KEY = '20261101_curriculum_publishing_v1';
const AAPM_CUR_POLICY_V1 = 'academy-v1';
const AAPM_CUR_MODULE_LIFECYCLE = ['draft', 'active', 'archived'];

function aapm_cur_ddl(string $driver): array
{
    if ($driver === 'sqlite') {
        return [
            'CREATE TABLE IF NOT EXISTS module_drafts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                module_id INTEGER NOT NULL UNIQUE,
                module_number INTEGER NOT NULL,
                draft_version INTEGER NOT NULL DEFAULT 1,
                content_payload_json TEXT NOT NULL,
                question_payload_json TEXT NOT NULL,
                edited_by_user_id INTEGER NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )',
            'CREATE TABLE IF NOT EXISTS module_revisions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                module_id INTEGER NOT NULL,
                module_number INTEGER NOT NULL,
                revision_number INTEGER NOT NULL,
                content_payload_json TEXT NOT NULL,
                question_bank_revision_id INTEGER NULL,
                content_checksum TEXT NOT NULL,
                published_by_user_id INTEGER NULL,
                published_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(module_id, revision_number)
            )',
            'CREATE TABLE IF NOT EXISTS question_bank_revisions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scope_type TEXT NOT NULL,
                module_number INTEGER NOT NULL,
                revision_number INTEGER NOT NULL,
                created_by_user_id INTEGER NULL,
                published_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                checksum TEXT NOT NULL,
                UNIQUE(scope_type, module_number, revision_number)
            )',
            'CREATE TABLE IF NOT EXISTS question_bank_revision_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bank_revision_id INTEGER NOT NULL,
                ordinal INTEGER NOT NULL,
                source_question_id INTEGER NULL,
                question TEXT NOT NULL,
                options_json TEXT NOT NULL,
                correct_index INTEGER NOT NULL,
                explanation TEXT NOT NULL,
                difficulty TEXT NOT NULL,
                question_type TEXT NOT NULL,
                learning_objective TEXT NOT NULL,
                UNIQUE(bank_revision_id, ordinal)
            )',
            'CREATE TABLE IF NOT EXISTS curriculum_policy_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                policy_version TEXT NOT NULL UNIQUE,
                course_id TEXT NOT NULL,
                status TEXT NOT NULL,
                parent_policy_version TEXT NULL,
                requirements_json TEXT NOT NULL,
                created_by_user_id INTEGER NULL,
                created_at TEXT NOT NULL,
                validated_at TEXT NULL,
                activated_at TEXT NULL
            )',
            'CREATE TABLE IF NOT EXISTS curriculum_policy_modules (
                policy_version TEXT NOT NULL,
                module_number INTEGER NOT NULL,
                module_id INTEGER NULL,
                chapter_number INTEGER NULL,
                sort_order INTEGER NULL,
                required INTEGER NOT NULL,
                PRIMARY KEY(policy_version, module_number)
            )',
            'CREATE TABLE IF NOT EXISTS learner_curriculum_assignments (
                user_id INTEGER NOT NULL PRIMARY KEY,
                policy_version TEXT NOT NULL,
                assigned_at TEXT NOT NULL,
                assignment_source TEXT NOT NULL
            )',
            'CREATE TABLE IF NOT EXISTS curriculum_publication_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                module_number INTEGER NULL,
                policy_version TEXT NULL,
                revision_number INTEGER NULL,
                actor_user_id INTEGER NULL,
                metadata_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            )',
            'CREATE TABLE IF NOT EXISTS module_number_allocations (
                module_number INTEGER NOT NULL PRIMARY KEY,
                first_module_id INTEGER NULL,
                allocated_at TEXT NOT NULL
            )',
        ];
    }

    $suffix = ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

    return [
        'CREATE TABLE IF NOT EXISTS module_drafts (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            module_id BIGINT UNSIGNED NOT NULL,
            module_number SMALLINT UNSIGNED NOT NULL,
            draft_version INT UNSIGNED NOT NULL DEFAULT 1,
            content_payload_json MEDIUMTEXT NOT NULL,
            question_payload_json MEDIUMTEXT NOT NULL,
            edited_by_user_id BIGINT UNSIGNED NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY module_drafts_module_unique (module_id)
        )' . $suffix,
        'CREATE TABLE IF NOT EXISTS module_revisions (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            module_id BIGINT UNSIGNED NOT NULL,
            module_number SMALLINT UNSIGNED NOT NULL,
            revision_number INT UNSIGNED NOT NULL,
            content_payload_json MEDIUMTEXT NOT NULL,
            question_bank_revision_id BIGINT UNSIGNED NULL,
            content_checksum CHAR(64) NOT NULL,
            published_by_user_id BIGINT UNSIGNED NULL,
            published_at DATETIME NOT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY module_revisions_unique (module_id, revision_number)
        )' . $suffix,
        'CREATE TABLE IF NOT EXISTS question_bank_revisions (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            scope_type VARCHAR(16) NOT NULL,
            module_number SMALLINT UNSIGNED NOT NULL,
            revision_number INT UNSIGNED NOT NULL,
            created_by_user_id BIGINT UNSIGNED NULL,
            published_at DATETIME NOT NULL,
            created_at DATETIME NOT NULL,
            checksum CHAR(64) NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY question_bank_revisions_unique (scope_type, module_number, revision_number)
        )' . $suffix,
        'CREATE TABLE IF NOT EXISTS question_bank_revision_items (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            bank_revision_id BIGINT UNSIGNED NOT NULL,
            ordinal SMALLINT UNSIGNED NOT NULL,
            source_question_id BIGINT UNSIGNED NULL,
            question TEXT NOT NULL,
            options_json TEXT NOT NULL,
            correct_index TINYINT UNSIGNED NOT NULL,
            explanation TEXT NOT NULL,
            difficulty VARCHAR(20) NOT NULL,
            question_type VARCHAR(20) NOT NULL,
            learning_objective VARCHAR(1000) NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY question_bank_items_unique (bank_revision_id, ordinal)
        )' . $suffix,
        'CREATE TABLE IF NOT EXISTS curriculum_policy_versions (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            policy_version VARCHAR(40) NOT NULL,
            course_id VARCHAR(80) NOT NULL,
            status VARCHAR(16) NOT NULL,
            parent_policy_version VARCHAR(40) NULL,
            requirements_json TEXT NOT NULL,
            created_by_user_id BIGINT UNSIGNED NULL,
            created_at DATETIME NOT NULL,
            validated_at DATETIME NULL,
            activated_at DATETIME NULL,
            PRIMARY KEY (id),
            UNIQUE KEY curriculum_policy_versions_unique (policy_version)
        )' . $suffix,
        'CREATE TABLE IF NOT EXISTS curriculum_policy_modules (
            policy_version VARCHAR(40) NOT NULL,
            module_number SMALLINT UNSIGNED NOT NULL,
            module_id BIGINT UNSIGNED NULL,
            chapter_number SMALLINT UNSIGNED NULL,
            sort_order INT UNSIGNED NULL,
            required TINYINT(1) NOT NULL,
            PRIMARY KEY (policy_version, module_number)
        )' . $suffix,
        'CREATE TABLE IF NOT EXISTS learner_curriculum_assignments (
            user_id BIGINT UNSIGNED NOT NULL,
            policy_version VARCHAR(40) NOT NULL,
            assigned_at DATETIME NOT NULL,
            assignment_source VARCHAR(40) NOT NULL,
            PRIMARY KEY (user_id),
            CONSTRAINT learner_curriculum_assignments_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )' . $suffix,
        'CREATE TABLE IF NOT EXISTS curriculum_publication_events (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            event_type VARCHAR(40) NOT NULL,
            module_number SMALLINT UNSIGNED NULL,
            policy_version VARCHAR(40) NULL,
            revision_number INT UNSIGNED NULL,
            actor_user_id BIGINT UNSIGNED NULL,
            metadata_json TEXT NOT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id)
        )' . $suffix,
        'CREATE TABLE IF NOT EXISTS module_number_allocations (
            module_number SMALLINT UNSIGNED NOT NULL,
            first_module_id BIGINT UNSIGNED NULL,
            allocated_at DATETIME NOT NULL,
            PRIMARY KEY (module_number)
        )' . $suffix,
    ];
}

/** Additive columns on course_modules. Existing rows become active; the backfill gives them revisions. */
function aapm_cur_add_module_columns(PDO $pdo, string $driver): void
{
    $sqlite = $driver === 'sqlite';
    $columns = [
        'lifecycle_status' => $sqlite ? "TEXT NOT NULL DEFAULT 'active'" : "VARCHAR(16) NOT NULL DEFAULT 'active'",
        'published_revision_id' => $sqlite ? 'INTEGER NULL' : 'BIGINT UNSIGNED NULL',
        'archived_at' => $sqlite ? 'TEXT NULL' : 'DATETIME NULL',
        'archived_by_user_id' => $sqlite ? 'INTEGER NULL' : 'BIGINT UNSIGNED NULL',
        'archive_reason' => $sqlite ? 'TEXT NULL' : 'VARCHAR(500) NULL',
        'lock_version' => $sqlite ? 'INTEGER NOT NULL DEFAULT 0' : 'INT UNSIGNED NOT NULL DEFAULT 0',
    ];
    foreach ($columns as $name => $definition) {
        if (aapm_column_exists($pdo, 'course_modules', $name)) {
            continue;
        }
        try {
            $pdo->exec('ALTER TABLE course_modules ADD COLUMN ' . $name . ' ' . $definition);
        } catch (PDOException $exception) {
            if (!aapm_column_exists($pdo, 'course_modules', $name)) {
                throw $exception;
            }
        }
    }
}

/** Runs once per process. Idempotent: every step checks what already exists. */
function aapm_ensure_curriculum_schema(PDO $pdo, string $driver): void
{
    static $ready = false;
    if ($ready || !aapm_table_exists($pdo, 'course_modules') || !aapm_table_exists($pdo, 'assessment_policies')) {
        return;
    }
    aapm_cur_add_module_columns($pdo, $driver);
    foreach (aapm_cur_ddl($driver) as $sql) {
        $pdo->exec($sql);
    }
    aapm_cur_seed_v1($pdo);
    aapm_cur_allocate_numbers($pdo);
    aapm_cur_backfill_modules($pdo);
    $ready = true;
}

/**
 * The first academic policy. Its requirements are the existing v1 definitions: the
 * assessment required set, thresholds, and the certificate tiers. Rows that already
 * exist are never rewritten.
 */
function aapm_cur_seed_v1(PDO $pdo): void
{
    $exists = $pdo->prepare('SELECT COUNT(*) FROM curriculum_policy_versions WHERE policy_version = ?');
    $exists->execute([AAPM_CUR_POLICY_V1]);
    $now = aapm_utc_now();
    if ((int) $exists->fetchColumn() === 0) {
        $tiers = [];
        $statement = $pdo->prepare('SELECT tier_number, tier_name, required_modules_json, requires_final FROM certificate_tier_policies WHERE policy_version = ? ORDER BY tier_number ASC');
        $statement->execute([AAPM_CUR_POLICY_V1]);
        foreach ($statement->fetchAll() as $row) {
            $tiers[] = [
                'tierNumber' => (int) $row['tier_number'],
                'tierName' => (string) $row['tier_name'],
                'modules' => array_map('intval', json_decode((string) $row['required_modules_json'], true) ?: []),
                'requiresFinal' => (int) $row['requires_final'] === 1,
            ];
        }
        $requirements = [
            'courseId' => 'aapm-layer-academy',
            'required' => aapm_assessment_policy_required_modules(),
            'modulePassPercent' => AAPM_MODULE_PASS_PERCENT,
            'finalPassPercent' => AAPM_FINAL_PASS_PERCENT,
            'tiers' => $tiers,
        ];
        try {
            $pdo->prepare('INSERT INTO curriculum_policy_versions (policy_version, course_id, status, parent_policy_version, requirements_json, created_by_user_id, created_at, validated_at, activated_at) VALUES (?, ?, ?, NULL, ?, NULL, ?, ?, ?)')
                ->execute([AAPM_CUR_POLICY_V1, 'aapm-layer-academy', 'active', json_encode($requirements, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $now, $now, $now]);
        } catch (PDOException $exception) {
            $exists->execute([AAPM_CUR_POLICY_V1]);
            if ((int) $exists->fetchColumn() < 1) {
                throw $exception;
            }
        }
    }
    // Membership follows the fixed v1 definition by module number. Module ids are linked once the modules exist.
    $insert = $pdo->prepare('INSERT INTO curriculum_policy_modules (policy_version, module_number, module_id, chapter_number, sort_order, required) VALUES (?, ?, NULL, NULL, NULL, 1)');
    $has = $pdo->prepare('SELECT COUNT(*) FROM curriculum_policy_modules WHERE policy_version = ? AND module_number = ?');
    foreach (aapm_assessment_policy_required_modules() as $number) {
        $has->execute([AAPM_CUR_POLICY_V1, $number]);
        if ((int) $has->fetchColumn() === 0) {
            try {
                $insert->execute([AAPM_CUR_POLICY_V1, $number]);
            } catch (PDOException $exception) {
                $has->execute([AAPM_CUR_POLICY_V1, $number]);
                if ((int) $has->fetchColumn() < 1) {
                    throw $exception;
                }
            }
        }
    }
    $pdo->prepare('UPDATE curriculum_policy_modules SET module_id = (SELECT cm.id FROM course_modules cm WHERE cm.module_number = curriculum_policy_modules.module_number), chapter_number = (SELECT cm.level_number FROM course_modules cm WHERE cm.module_number = curriculum_policy_modules.module_number), sort_order = (SELECT cm.sort_order FROM course_modules cm WHERE cm.module_number = curriculum_policy_modules.module_number) WHERE policy_version = ? AND module_id IS NULL')
        ->execute([AAPM_CUR_POLICY_V1]);
}

/** Records every module number ever used. A number is never reused, even after a draft is deleted. */
function aapm_cur_allocate_numbers(PDO $pdo): void
{
    $pdo->prepare('INSERT INTO module_number_allocations (module_number, first_module_id, allocated_at) SELECT module_number, MIN(id), ? FROM course_modules WHERE module_number NOT IN (SELECT module_number FROM module_number_allocations) GROUP BY module_number')
        ->execute([aapm_utc_now()]);
}

/** Every active module without a published revision gets revision 1 from its current content. Safe to repeat. */
function aapm_cur_backfill_modules(PDO $pdo): void
{
    $pending = $pdo->query("SELECT * FROM course_modules WHERE published_revision_id IS NULL AND lifecycle_status = 'active' ORDER BY id ASC")->fetchAll();
    foreach ($pending as $row) {
        aapm_tx_begin($pdo);
        try {
            $now = aapm_utc_now();
            $questions = aapm_cur_live_questions($pdo, (int) $row['module_number']);
            $bankId = $questions === [] ? null : aapm_cur_insert_bank($pdo, 'module', (int) $row['module_number'], $questions, null, $now);
            $payload = aapm_cur_payload_from_row($row);
            aapm_cur_insert_revision($pdo, (int) $row['id'], (int) $row['module_number'], $payload, $bankId, null, $now);
            $revision = (int) $pdo->query('SELECT MAX(revision_number) FROM module_revisions WHERE module_id = ' . (int) $row['id'])->fetchColumn();
            $pdo->prepare('UPDATE course_modules SET published_revision_id = (SELECT id FROM module_revisions WHERE module_id = ? AND revision_number = ?) WHERE id = ?')
                ->execute([(int) $row['id'], $revision, (int) $row['id']]);
            aapm_cur_event($pdo, 'module.published', (int) $row['module_number'], null, $revision, null, ['backfill' => true, 'questionCount' => count($questions)]);
            aapm_tx_commit($pdo);
        } catch (Throwable $exception) {
            aapm_tx_rollback($pdo);
            throw $exception;
        }
    }
}

function aapm_cur_event(PDO $pdo, string $type, ?int $moduleNumber, ?string $policyVersion, ?int $revisionNumber, ?int $actorId, array $metadata): void
{
    // Curriculum events carry only short scalar facts; never free text beyond the reason field.
    $clean = [];
    foreach ($metadata as $key => $value) {
        if (is_string($key) && strlen($key) <= 40 && (is_int($value) || is_bool($value) || (is_string($value) && strlen($value) <= 200))) {
            $clean[$key] = $value;
        }
    }
    $pdo->prepare('INSERT INTO curriculum_publication_events (event_type, module_number, policy_version, revision_number, actor_user_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        ->execute([$type, $moduleNumber, $policyVersion, $revisionNumber, $actorId, json_encode($clean, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), aapm_utc_now()]);
}

/** Canonical content payload, the same shape admin_module_input() produces. */
function aapm_cur_payload_from_row(array $row): array
{
    return [
        'levelNumber' => (int) $row['level_number'],
        'levelName' => (string) $row['level_name'],
        'moduleNumber' => (int) $row['module_number'],
        'title' => (string) $row['title'],
        'category' => (string) ($row['category'] ?? ''),
        'summary' => (string) ($row['summary'] ?? ''),
        'content' => (string) ($row['content'] ?? ''),
        'editorialContent' => (string) ($row['editorial_content'] ?? ''),
        'videoScript' => (string) ($row['video_script'] ?? ''),
        'videoUrl' => (string) ($row['video_url'] ?? ''),
        'learningObjectives' => (string) ($row['learning_objectives'] ?? '[]'),
        'keyTakeaways' => (string) ($row['key_takeaways'] ?? '[]'),
        'checklist' => (string) ($row['checklist'] ?? '[]'),
        'practicalAssignment' => (string) ($row['practical_assignment'] ?? ''),
        'sortOrder' => (int) ($row['sort_order'] ?? 0),
    ];
}

/** The payload as the existing normaliser reads it: snake-case keys from a module row. */
function aapm_cur_row_from_payload(array $payload): array
{
    return [
        'level_number' => $payload['levelNumber'],
        'level_name' => $payload['levelName'],
        'module_number' => $payload['moduleNumber'],
        'title' => $payload['title'],
        'category' => $payload['category'],
        'summary' => $payload['summary'],
        'content' => $payload['content'],
        'editorial_content' => $payload['editorialContent'],
        'video_script' => $payload['videoScript'],
        'video_url' => $payload['videoUrl'],
        'learning_objectives' => $payload['learningObjectives'],
        'key_takeaways' => $payload['keyTakeaways'],
        'checklist' => $payload['checklist'],
        'practical_assignment' => $payload['practicalAssignment'],
        'sort_order' => $payload['sortOrder'],
    ];
}

function aapm_cur_checksum(array $value): string
{
    return hash('sha256', json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}

/** @return list<array<string, mixed>> */
function aapm_cur_live_questions(PDO $pdo, int $moduleNumber): array
{
    $statement = $pdo->prepare('SELECT * FROM quiz_questions WHERE module_number = ? ORDER BY id ASC');
    $statement->execute([$moduleNumber]);
    return array_map(static function (array $row): array {
        $options = json_decode((string) $row['options'], true);
        return [
            'id' => (int) $row['id'],
            'question' => (string) $row['question'],
            'options' => array_values(is_array($options) ? $options : []),
            'correctIndex' => (int) $row['correct_index'],
            'explanation' => (string) ($row['explanation'] ?? ''),
            'difficulty' => (string) ($row['difficulty'] ?? 'medium'),
            'type' => (string) ($row['type'] ?? 'mcq'),
            'learningObjective' => (string) ($row['learning_objective'] ?? ''),
        ];
    }, $statement->fetchAll());
}

function aapm_cur_insert_bank(PDO $pdo, string $scope, int $moduleNumber, array $questions, ?int $actorId, string $now): int
{
    $revision = (int) $pdo->query('SELECT COALESCE(MAX(revision_number), 0) + 1 FROM question_bank_revisions WHERE scope_type = ' . $pdo->quote($scope) . ' AND module_number = ' . (int) $moduleNumber)->fetchColumn();
    $pdo->prepare('INSERT INTO question_bank_revisions (scope_type, module_number, revision_number, created_by_user_id, published_at, created_at, checksum) VALUES (?, ?, ?, ?, ?, ?, ?)')
        ->execute([$scope, $moduleNumber, $revision, $actorId, $now, $now, aapm_cur_checksum($questions)]);
    $bankId = (int) $pdo->lastInsertId();
    $item = $pdo->prepare('INSERT INTO question_bank_revision_items (bank_revision_id, ordinal, source_question_id, question, options_json, correct_index, explanation, difficulty, question_type, learning_objective) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    foreach (array_values($questions) as $index => $question) {
        $item->execute([
            $bankId,
            $index + 1,
            isset($question['id']) && (int) $question['id'] > 0 ? (int) $question['id'] : null,
            (string) $question['question'],
            json_encode($question['options'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            (int) $question['correctIndex'],
            (string) ($question['explanation'] ?? ''),
            (string) ($question['difficulty'] ?? 'medium'),
            (string) ($question['type'] ?? 'mcq'),
            (string) ($question['learningObjective'] ?? ''),
        ]);
    }
    return $bankId;
}

function aapm_cur_insert_revision(PDO $pdo, int $moduleId, int $moduleNumber, array $payload, ?int $bankId, ?int $actorId, string $now): int
{
    $revision = (int) $pdo->query('SELECT COALESCE(MAX(revision_number), 0) + 1 FROM module_revisions WHERE module_id = ' . (int) $moduleId)->fetchColumn();
    $pdo->prepare('INSERT INTO module_revisions (module_id, module_number, revision_number, content_payload_json, question_bank_revision_id, content_checksum, published_by_user_id, published_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([$moduleId, $moduleNumber, $revision, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $bankId, aapm_cur_checksum($payload), $actorId, $now, $now]);
    return $revision;
}

/** Locks one module for a write. SQLite is serialised by BEGIN IMMEDIATE; MySQL takes a row lock. */
function aapm_cur_lock_module(PDO $pdo, int $moduleId): ?array
{
    if (aapm_database_driver() !== 'sqlite') {
        $lock = $pdo->prepare('SELECT id FROM course_modules WHERE id = ? FOR UPDATE');
        $lock->execute([$moduleId]);
    }
    $statement = $pdo->prepare('SELECT * FROM course_modules WHERE id = ? LIMIT 1');
    $statement->execute([$moduleId]);
    $row = $statement->fetch();
    return $row ?: null;
}

function aapm_cur_module_or_fail(PDO $pdo, int $moduleId): array
{
    $statement = $pdo->prepare('SELECT * FROM course_modules WHERE id = ? LIMIT 1');
    $statement->execute([$moduleId]);
    $row = $statement->fetch();
    if (!$row) {
        error_response('Modul tidak ditemukan.', 404, 'not_found');
    }
    return $row;
}

/** The draft workspace for a module. Created from the published state the first time anyone edits it. */
function aapm_cur_draft_locked(PDO $pdo, array $module, ?int $actorId): array
{
    $statement = $pdo->prepare('SELECT * FROM module_drafts WHERE module_id = ? LIMIT 1');
    $statement->execute([(int) $module['id']]);
    $draft = $statement->fetch();
    if ($draft) {
        return $draft;
    }
    $now = aapm_utc_now();
    $pdo->prepare('INSERT INTO module_drafts (module_id, module_number, draft_version, content_payload_json, question_payload_json, edited_by_user_id, created_at, updated_at) VALUES (?, ?, 1, ?, ?, ?, ?, ?)')
        ->execute([
            (int) $module['id'],
            (int) $module['module_number'],
            json_encode(aapm_cur_payload_from_row($module), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            json_encode(aapm_cur_live_questions($pdo, (int) $module['module_number']), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            $actorId,
            $now,
            $now,
        ]);
    $statement->execute([(int) $module['id']]);
    return $statement->fetch();
}

function aapm_cur_draft_view(array $draft): array
{
    return [
        'version' => (int) $draft['draft_version'],
        'payload' => json_decode((string) $draft['content_payload_json'], true) ?: [],
        'questions' => json_decode((string) $draft['question_payload_json'], true) ?: [],
    ];
}

function aapm_cur_expected_version(array $input): int
{
    $value = $input['expectedDraftVersion'] ?? null;
    if (!is_int($value) && !(is_string($value) && ctype_digit($value))) {
        error_response('Versi draf yang dibaca wajib dikirim (expectedDraftVersion).', 422, 'expected_draft_version_required');
    }
    return (int) $value;
}

function aapm_cur_conflict(int $current): void
{
    http_response_code(409);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(['error' => [
        'message' => 'Draf ini sudah berubah sejak Anda membukanya. Muat ulang draf terbaru sebelum menyimpan.',
        'code' => 'revision_conflict',
        'details' => ['currentDraftVersion' => $current],
    ]], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Module numbers are stable identities. A save may not renumber an existing module. */
function aapm_cur_check_number(array $module, array $input): void
{
    $sent = $input['moduleNumber'] ?? $input['module_number'] ?? null;
    if ($sent !== null && (int) $sent !== (int) $module['module_number']) {
        error_response('Nomor modul tidak dapat diubah setelah dibuat.', 422, 'module_number_immutable');
    }
}

/** Normalises module content exactly as the admin editor always did. Runs before any transaction opens. */
function aapm_cur_normalise_content(array $input, array $existingPayload): array
{
    $existing = $existingPayload === [] ? [] : aapm_cur_row_from_payload($existingPayload);
    $data = admin_module_input($input, $existing);
    admin_validate_chapter_name($data['levelNumber'], $data['levelName'], null);
    return [
        'levelNumber' => $data['levelNumber'],
        'levelName' => $data['levelName'],
        'moduleNumber' => $data['moduleNumber'],
        'title' => $data['title'],
        'category' => $data['category'],
        'summary' => $data['summary'],
        'content' => $data['content'],
        'editorialContent' => $data['editorialContent'],
        'videoScript' => $data['videoScript'],
        'videoUrl' => $data['videoUrl'],
        'learningObjectives' => $data['learningObjectives'],
        'keyTakeaways' => $data['keyTakeaways'],
        'checklist' => $data['checklist'],
        'practicalAssignment' => $data['practicalAssignment'],
        'sortOrder' => $data['sortOrder'],
    ];
}

/** One question from request input, validated before it reaches a draft. */
function aapm_cur_normalise_question(array $input): array
{
    [, $question, $optionsJson, $correctIndex, $explanation, $difficulty, $type, $learningObjective] = admin_question_input($input, 0);
    return [
        'question' => (string) $question,
        'options' => json_decode((string) $optionsJson, true),
        'correctIndex' => (int) $correctIndex,
        'explanation' => (string) $explanation,
        'difficulty' => (string) $difficulty,
        'type' => (string) $type,
        'learningObjective' => (string) $learningObjective,
    ];
}

/** Creates a draft-only module. It is not learner-visible until a publish succeeds. */
function aapm_cur_create_module(array $input, int $actorId): array
{
    $pdo = db();
    $payload = aapm_cur_normalise_content($input, []);
    $moduleNumber = (int) $payload['moduleNumber'];
    if ($payload['sortOrder'] === 0) {
        $payload['sortOrder'] = ((int) $pdo->query('SELECT COALESCE(MAX(sort_order), 0) FROM course_modules')->fetchColumn()) + 1;
    }
    $taken = $pdo->prepare('SELECT COUNT(*) FROM module_number_allocations WHERE module_number = ?');
    $taken->execute([$moduleNumber]);
    $inCatalogue = $pdo->prepare('SELECT COUNT(*) FROM course_modules WHERE module_number = ?');
    $inCatalogue->execute([$moduleNumber]);
    if ((int) $taken->fetchColumn() > 0 || (int) $inCatalogue->fetchColumn() > 0) {
        error_response('Nomor modul sudah digunakan dan tidak dapat dipakai ulang.', 409, 'module_number_exists');
    }

    aapm_tx_begin($pdo);
    try {
        $now = aapm_utc_now();
        $pdo->prepare('INSERT INTO course_modules (level_number, level_name, module_number, title, category, summary, content, editorial_content, video_script, video_url, learning_objectives, key_takeaways, checklist, practical_assignment, sort_order, lifecycle_status, published_revision_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)')
            ->execute([
                $payload['levelNumber'], $payload['levelName'], $moduleNumber, $payload['title'], $payload['category'], $payload['summary'],
                $payload['content'], $payload['editorialContent'], $payload['videoScript'], $payload['videoUrl'], $payload['learningObjectives'],
                $payload['keyTakeaways'], $payload['checklist'], $payload['practicalAssignment'], $payload['sortOrder'], 'draft',
            ]);
        $moduleId = (int) $pdo->lastInsertId();
        $pdo->prepare('INSERT INTO module_drafts (module_id, module_number, draft_version, content_payload_json, question_payload_json, edited_by_user_id, created_at, updated_at) VALUES (?, ?, 1, ?, ?, ?, ?, ?)')
            ->execute([$moduleId, $moduleNumber, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), '[]', $actorId, $now, $now]);
        $pdo->prepare('INSERT INTO module_number_allocations (module_number, first_module_id, allocated_at) VALUES (?, ?, ?)')
            ->execute([$moduleNumber, $moduleId, $now]);
        aapm_cur_event($pdo, 'draft.created', $moduleNumber, null, null, $actorId, ['moduleId' => $moduleId]);
        aapm_tx_commit($pdo);
    } catch (Throwable $exception) {
        aapm_tx_rollback($pdo);
        throw $exception;
    }
    $module = aapm_cur_module_or_fail($pdo, $moduleId);
    return aapm_cur_admin_module_view($module, 'draft');
}

/** Saves content into the draft only. The published lesson is never touched here. */
function aapm_cur_save_draft(int $moduleId, array $input, int $actorId): array
{
    $pdo = db();
    $expected = aapm_cur_expected_version($input);
    $module = aapm_cur_module_or_fail($pdo, $moduleId);
    aapm_cur_check_number($module, $input);
    $existing = aapm_cur_draft_locked($pdo, $module, $actorId);
    $payload = aapm_cur_normalise_content($input, json_decode((string) $existing['content_payload_json'], true) ?: aapm_cur_payload_from_row($module));

    aapm_tx_begin($pdo);
    try {
        $locked = aapm_cur_lock_module($pdo, $moduleId);
        if (!$locked) {
            aapm_tx_rollback($pdo);
            error_response('Modul tidak ditemukan.', 404, 'not_found');
        }
        $current = aapm_cur_draft_locked($pdo, $locked, $actorId);
        if ((int) $current['draft_version'] !== $expected) {
            aapm_tx_rollback($pdo);
            aapm_cur_conflict((int) $current['draft_version']);
        }
        $version = (int) $current['draft_version'] + 1;
        $now = aapm_utc_now();
        $pdo->prepare('UPDATE module_drafts SET content_payload_json = ?, draft_version = ?, edited_by_user_id = ?, updated_at = ? WHERE module_id = ? AND draft_version = ?')
            ->execute([json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $version, $actorId, $now, $moduleId, $expected]);
        aapm_cur_event($pdo, 'draft.saved', (int) $module['module_number'], null, null, $actorId, ['draftVersion' => $version]);
        aapm_tx_commit($pdo);
    } catch (Throwable $exception) {
        aapm_tx_rollback($pdo);
        throw $exception;
    }
    return aapm_cur_admin_module_view(aapm_cur_module_or_fail($pdo, $moduleId), 'draft');
}

/**
 * Question changes are draft-only too. Each one bumps the draft version, so an
 * editor working from an older screen gets a conflict instead of a silent overwrite.
 */
function aapm_cur_question_write(int $moduleId, string $operation, array $input, ?int $questionId, int $actorId): array
{
    $pdo = db();
    $expected = aapm_cur_expected_version($input);
    $item = $operation === 'delete' ? null : aapm_cur_normalise_question($input);
    $module = aapm_cur_module_or_fail($pdo, $moduleId);

    aapm_tx_begin($pdo);
    try {
        $locked = aapm_cur_lock_module($pdo, $moduleId);
        $draft = aapm_cur_draft_locked($pdo, $locked, $actorId);
        if ((int) $draft['draft_version'] !== $expected) {
            aapm_tx_rollback($pdo);
            aapm_cur_conflict((int) $draft['draft_version']);
        }
        $questions = json_decode((string) $draft['question_payload_json'], true) ?: [];
        if ($operation === 'create') {
            $temporary = 0;
            foreach ($questions as $existing) {
                $temporary = min($temporary, (int) $existing['id']);
            }
            $item['id'] = $temporary - 1;
            $questions[] = $item;
        } else {
            $found = false;
            foreach ($questions as $index => $existing) {
                if ((int) $existing['id'] !== (int) $questionId) {
                    continue;
                }
                $found = true;
                if ($operation === 'delete') {
                    array_splice($questions, $index, 1);
                } else {
                    $item['id'] = (int) $existing['id'];
                    $questions[$index] = $item;
                }
                break;
            }
            if (!$found) {
                aapm_tx_rollback($pdo);
                error_response('Soal tidak ditemukan dalam draf.', 404, 'not_found');
            }
        }
        $version = (int) $draft['draft_version'] + 1;
        $pdo->prepare('UPDATE module_drafts SET question_payload_json = ?, draft_version = ?, edited_by_user_id = ?, updated_at = ? WHERE module_id = ? AND draft_version = ?')
            ->execute([json_encode(array_values($questions), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $version, $actorId, aapm_utc_now(), $moduleId, $expected]);
        aapm_cur_event($pdo, 'draft.saved', (int) $module['module_number'], null, null, $actorId, ['draftVersion' => $version, 'questionOperation' => $operation]);
        aapm_tx_commit($pdo);
        return ['draftVersion' => $version, 'questions' => array_values($questions), 'question' => $operation === 'delete' ? null : $item];
    } catch (Throwable $exception) {
        aapm_tx_rollback($pdo);
        throw $exception;
    }
}

/** True when any policy that learners may be assigned requires this module number. */
function aapm_cur_required_by_policy(PDO $pdo, int $moduleNumber): bool
{
    $statement = $pdo->prepare("SELECT COUNT(*) FROM curriculum_policy_modules m INNER JOIN curriculum_policy_versions v ON v.policy_version = m.policy_version WHERE m.module_number = ? AND m.required = 1 AND v.status IN ('active', 'superseded')");
    $statement->execute([$moduleNumber]);
    return (int) $statement->fetchColumn() > 0;
}

/**
 * Validation for a draft. Returns structured errors per section; an empty list means
 * the draft may be published. Shared by the validate endpoint and by publish.
 */
function aapm_cur_validate_draft(PDO $pdo, array $module, array $payload, array $questions): array
{
    $errors = [];
    if (trim((string) ($payload['title'] ?? '')) === '') {
        $errors[] = ['section' => 'content', 'field' => 'title', 'message' => 'Judul modul wajib diisi.'];
    }
    if (trim((string) ($payload['levelName'] ?? '')) === '') {
        $errors[] = ['section' => 'chapter', 'field' => 'levelName', 'message' => 'Nama chapter wajib diisi.'];
    }
    if (trim((string) ($payload['content'] ?? '')) === '' && trim((string) ($payload['editorialContent'] ?? '')) === '') {
        $errors[] = ['section' => 'content', 'field' => 'content', 'message' => 'Materi modul wajib diisi.'];
    }
    foreach ($questions as $index => $question) {
        $n = $index + 1;
        if (trim((string) ($question['question'] ?? '')) === '') {
            $errors[] = ['section' => 'questions', 'field' => "questions[$n].question", 'message' => "Soal $n belum memiliki teks."];
        }
        $options = is_array($question['options'] ?? null) ? $question['options'] : [];
        if (count($options) < 2 || count($options) > 6) {
            $errors[] = ['section' => 'questions', 'field' => "questions[$n].options", 'message' => "Soal $n membutuhkan 2 sampai 6 opsi."];
        }
        foreach ($options as $option) {
            if (trim((string) $option) === '') {
                $errors[] = ['section' => 'questions', 'field' => "questions[$n].options", 'message' => "Semua opsi soal $n harus terisi."];
                break;
            }
        }
        $correct = (int) ($question['correctIndex'] ?? -1);
        if ($correct < 0 || $correct >= count($options)) {
            $errors[] = ['section' => 'questions', 'field' => "questions[$n].correctIndex", 'message' => "Jawaban benar soal $n tidak valid."];
        }
    }

    $moduleNumber = (int) $module['module_number'];
    $liveHasQuiz = count(aapm_cur_live_questions($pdo, $moduleNumber)) > 0;
    $draftHasQuiz = $questions !== [];
    if (aapm_cur_required_by_policy($pdo, $moduleNumber)) {
        if (!$draftHasQuiz) {
            $errors[] = ['section' => 'questions', 'field' => 'questions', 'message' => 'Modul yang wajib dalam kebijakan kurikulum harus memiliki minimal satu soal.', 'code' => 'assessment_bank_empty'];
        } elseif ($liveHasQuiz !== $draftHasQuiz) {
            $errors[] = ['section' => 'questions', 'field' => 'questions', 'message' => 'Modul wajib tidak dapat berubah antara berkuis dan tanpa kuis di bawah kebijakan yang sama.', 'code' => 'assessment_mode_locked'];
        }
    }
    return $errors;
}

function aapm_cur_validate_module(int $moduleId): array
{
    $pdo = db();
    $module = aapm_cur_module_or_fail($pdo, $moduleId);
    $draft = aapm_cur_draft_locked($pdo, $module, null);
    $view = aapm_cur_draft_view($draft);
    $errors = aapm_cur_validate_draft($pdo, $module, $view['payload'], $view['questions']);
    return ['valid' => $errors === [], 'errors' => $errors, 'draftVersion' => $view['version']];
}

/** What an editor reviews before publishing: the change set and the learner impact. */
function aapm_cur_publish_preview(int $moduleId): array
{
    $pdo = db();
    $module = aapm_cur_module_or_fail($pdo, $moduleId);
    $draft = aapm_cur_draft_locked($pdo, $module, null);
    $view = aapm_cur_draft_view($draft);
    $current = $module['published_revision_id'] ? aapm_cur_revision_row($pdo, (int) $module['published_revision_id']) : null;
    $currentPayload = $current ? json_decode((string) $current['content_payload_json'], true) : aapm_cur_payload_from_row($module);
    $changed = [];
    foreach ($view['payload'] as $key => $value) {
        if (($currentPayload[$key] ?? null) !== $value) {
            $changed[] = $key;
        }
    }
    $liveQuestions = aapm_cur_question_content(aapm_cur_live_questions($pdo, (int) $module['module_number']));
    $questionsChanged = aapm_cur_checksum($liveQuestions) !== aapm_cur_checksum(aapm_cur_question_content($view['questions']));
    if ($questionsChanged) {
        $changed[] = 'questions';
    }
    $errors = aapm_cur_validate_draft($pdo, $module, $view['payload'], $view['questions']);
    $latest = (int) $pdo->query('SELECT COALESCE(MAX(revision_number), 0) FROM module_revisions WHERE module_id = ' . (int) $moduleId)->fetchColumn();
    return [
        'moduleId' => $moduleId,
        'moduleNumber' => (int) $module['module_number'],
        'draftVersion' => $view['version'],
        'currentRevision' => $latest === 0 ? null : $latest,
        'nextRevision' => $latest + 1,
        'questionCount' => count($view['questions']),
        'changedSections' => $changed,
        'learnerImpact' => $view['questions'] === [] ? 'Modul tanpa kuis.' : 'Peserta yang sudah memulai kuis tetap menggunakan soal dari percobaan awalnya. Percobaan baru akan menggunakan soal yang diterbitkan.',
        'valid' => $errors === [],
        'errors' => $errors,
    ];
}

/** Question content without database ids, for comparing a draft with what is live. */
function aapm_cur_question_content(array $questions): array
{
    return array_map(static function (array $question): array {
        unset($question['id']);
        return $question;
    }, $questions);
}

function aapm_cur_revision_row(PDO $pdo, int $revisionId): ?array
{
    $statement = $pdo->prepare('SELECT * FROM module_revisions WHERE id = ? LIMIT 1');
    $statement->execute([$revisionId]);
    return $statement->fetch() ?: null;
}

/**
 * Publishes the draft in one transaction: validation, immutable question-bank and
 * content revisions, learner projection, draft pointer, and event. Any failure
 * rolls the whole publication back.
 */
function aapm_cur_publish(int $moduleId, int $expectedVersion, int $actorId): array
{
    $pdo = db();
    $module = aapm_cur_module_or_fail($pdo, $moduleId);

    aapm_tx_begin($pdo);
    try {
        $locked = aapm_cur_lock_module($pdo, $moduleId);
        $draft = aapm_cur_draft_locked($pdo, $locked, $actorId);
        if ((int) $draft['draft_version'] !== $expectedVersion) {
            aapm_tx_rollback($pdo);
            aapm_cur_conflict((int) $draft['draft_version']);
        }
        $view = aapm_cur_draft_view($draft);
        $errors = aapm_cur_validate_draft($pdo, $locked, $view['payload'], $view['questions']);
        if ($errors !== []) {
            aapm_tx_rollback($pdo);
            http_response_code(422);
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-store');
            echo json_encode(['error' => ['message' => 'Draf belum dapat diterbitkan. Periksa bagian yang ditandai.', 'code' => 'publish_validation_failed', 'details' => ['errors' => $errors]]], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            exit;
        }

        $now = aapm_utc_now();
        $moduleNumber = (int) $locked['module_number'];
        $finalQuestions = aapm_cur_apply_questions($pdo, $moduleNumber, $view['questions']);
        $bankId = $finalQuestions === [] ? null : aapm_cur_insert_bank($pdo, 'module', $moduleNumber, $finalQuestions, $actorId, $now);
        $payload = $view['payload'];
        $payload['moduleNumber'] = $moduleNumber;
        $revision = aapm_cur_insert_revision($pdo, $moduleId, $moduleNumber, $payload, $bankId, $actorId, $now);
        $revisionId = (int) $pdo->query('SELECT id FROM module_revisions WHERE module_id = ' . $moduleId . ' AND revision_number = ' . $revision)->fetchColumn();

        $pdo->prepare("UPDATE course_modules SET level_number = ?, level_name = ?, title = ?, category = ?, summary = ?, content = ?, editorial_content = ?, video_script = ?, video_url = ?, learning_objectives = ?, key_takeaways = ?, checklist = ?, practical_assignment = ?, sort_order = ?, lifecycle_status = 'active', published_revision_id = ?, lock_version = lock_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            ->execute([
                $payload['levelNumber'], $payload['levelName'], $payload['title'], $payload['category'], $payload['summary'], $payload['content'],
                $payload['editorialContent'], $payload['videoScript'], $payload['videoUrl'], $payload['learningObjectives'], $payload['keyTakeaways'],
                $payload['checklist'], $payload['practicalAssignment'], $payload['sortOrder'], $revisionId, $moduleId,
            ]);
        $pdo->prepare('UPDATE module_drafts SET content_payload_json = ?, question_payload_json = ?, draft_version = draft_version + 1, updated_at = ? WHERE module_id = ?')
            ->execute([json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), json_encode($finalQuestions, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $now, $moduleId]);
        // The event is written last, so a failure anywhere above leaves nothing behind.
        aapm_cur_event($pdo, 'module.published', $moduleNumber, null, $revision, $actorId, ['questionCount' => count($finalQuestions), 'bankRevision' => $bankId !== null]);
        aapm_tx_commit($pdo);
    } catch (Throwable $exception) {
        aapm_tx_rollback($pdo);
        throw $exception;
    }

    return ['revisionId' => $revisionId, 'revisionNumber' => $revision, 'publishedAt' => $now, 'module' => aapm_cur_admin_module_view(aapm_cur_module_or_fail($pdo, $moduleId), 'published')];
}

/** Inserts the final question set into the live bank and returns it with the real ids. */
function aapm_cur_apply_questions(PDO $pdo, int $moduleNumber, array $draftQuestions): array
{
    $existing = [];
    foreach (aapm_cur_live_questions($pdo, $moduleNumber) as $row) {
        $existing[(int) $row['id']] = true;
    }
    $keep = [];
    $final = [];
    $update = $pdo->prepare('UPDATE quiz_questions SET question = ?, options = ?, correct_index = ?, explanation = ?, difficulty = ?, type = ?, learning_objective = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND module_number = ?');
    $insert = $pdo->prepare('INSERT INTO quiz_questions (module_number, question, options, correct_index, explanation, difficulty, type, learning_objective) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($draftQuestions as $question) {
        $options = json_encode(array_values((array) $question['options']), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $values = [(string) $question['question'], $options, (int) $question['correctIndex'], (string) ($question['explanation'] ?? ''), (string) ($question['difficulty'] ?? 'medium'), (string) ($question['type'] ?? 'mcq'), (string) ($question['learningObjective'] ?? '')];
        $id = (int) ($question['id'] ?? 0);
        if ($id > 0 && isset($existing[$id])) {
            $update->execute(array_merge($values, [$id, $moduleNumber]));
        } else {
            $insert->execute(array_merge([$moduleNumber], $values));
            $id = (int) $pdo->lastInsertId();
        }
        $keep[$id] = true;
        $final[] = array_merge($question, ['id' => $id]);
    }
    $delete = $pdo->prepare('DELETE FROM quiz_questions WHERE id = ? AND module_number = ?');
    foreach (array_keys($existing) as $id) {
        if (!isset($keep[$id])) {
            $delete->execute([$id, $moduleNumber]);
        }
    }
    return $final;
}

function aapm_cur_admin_module_view(array $row, string $view): array
{
    $pdo = db();
    $live = [
        'module' => present_module($row),
        'lifecycleStatus' => (string) ($row['lifecycle_status'] ?? 'active'),
        'publishedRevisionId' => $row['published_revision_id'] === null ? null : (int) $row['published_revision_id'],
        'archivedAt' => $row['archived_at'] ?? null,
        'archiveReason' => $row['archive_reason'] ?? null,
    ];
    $draft = aapm_cur_draft_locked($pdo, $row, null);
    $draftView = aapm_cur_draft_view($draft);
    $live['draft'] = [
        'version' => $draftView['version'],
        'hasUnpublishedChanges' => aapm_cur_checksum($draftView['payload']) !== aapm_cur_checksum(aapm_cur_payload_from_row($row)) || aapm_cur_checksum(aapm_cur_question_content($draftView['questions'])) !== aapm_cur_checksum(aapm_cur_question_content(aapm_cur_live_questions($pdo, (int) $row['module_number']))),
    ];
    if ($view === 'draft') {
        $draftRow = aapm_cur_row_from_payload($draftView['payload']) + ['id' => (int) $row['id']];
        $live['module'] = array_merge(present_module($draftRow), ['draftPayload' => $draftView['payload']]);
        $live['questions'] = $draftView['questions'];
        $live['view'] = 'draft';
    } else {
        $live['questions'] = aapm_cur_live_questions($pdo, (int) $row['module_number']);
        $live['view'] = 'published';
    }
    return $live;
}

function aapm_cur_archive(int $moduleId, string $reason, int $actorId): array
{
    $pdo = db();
    $reason = trim($reason);
    $length = function_exists('mb_strlen') ? mb_strlen($reason) : strlen($reason);
    if ($length < 5 || $length > 500) {
        error_response('Alasan pengarsipan wajib diisi (5–500 karakter).', 422, 'reason_required');
    }
    $module = aapm_cur_module_or_fail($pdo, $moduleId);
    if ((string) $module['lifecycle_status'] !== 'active') {
        error_response('Hanya modul yang sudah diterbitkan dan aktif yang dapat diarsipkan.', 409, 'module_not_active');
    }
    aapm_tx_begin($pdo);
    try {
        $locked = aapm_cur_lock_module($pdo, $moduleId);
        if (!$locked || (string) $locked['lifecycle_status'] !== 'active') {
            aapm_tx_rollback($pdo);
            error_response('Hanya modul yang sudah diterbitkan dan aktif yang dapat diarsipkan.', 409, 'module_not_active');
        }
        $now = aapm_utc_now();
        $pdo->prepare("UPDATE course_modules SET lifecycle_status = 'archived', archived_at = ?, archived_by_user_id = ?, archive_reason = ?, lock_version = lock_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            ->execute([$now, $actorId, $reason, $moduleId]);
        aapm_cur_event($pdo, 'module.archived', (int) $locked['module_number'], null, null, $actorId, ['reason' => $reason]);
        aapm_tx_commit($pdo);
    } catch (Throwable $exception) {
        aapm_tx_rollback($pdo);
        throw $exception;
    }
    return aapm_cur_admin_module_view(aapm_cur_module_or_fail($pdo, $moduleId), 'published');
}

function aapm_cur_restore(int $moduleId, int $actorId): array
{
    $pdo = db();
    $module = aapm_cur_module_or_fail($pdo, $moduleId);
    if ((string) $module['lifecycle_status'] !== 'archived') {
        error_response('Hanya modul yang diarsipkan yang dapat dipulihkan.', 409, 'module_not_archived');
    }
    aapm_tx_begin($pdo);
    try {
        $locked = aapm_cur_lock_module($pdo, $moduleId);
        if (!$locked || (string) $locked['lifecycle_status'] !== 'archived') {
            aapm_tx_rollback($pdo);
            error_response('Hanya modul yang diarsipkan yang dapat dipulihkan.', 409, 'module_not_archived');
        }
        $pdo->prepare("UPDATE course_modules SET lifecycle_status = 'active', archived_at = NULL, archived_by_user_id = NULL, archive_reason = NULL, lock_version = lock_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            ->execute([$moduleId]);
        aapm_cur_event($pdo, 'module.restored', (int) $locked['module_number'], null, null, $actorId, []);
        aapm_tx_commit($pdo);
    } catch (Throwable $exception) {
        aapm_tx_rollback($pdo);
        throw $exception;
    }
    return aapm_cur_admin_module_view(aapm_cur_module_or_fail($pdo, $moduleId), 'published');
}

/**
 * Hard delete is only for a module that was never published and has no academic
 * history of any kind. Everything else must be archived, so evidence is never destroyed.
 */
function aapm_cur_delete(int $moduleId, int $actorId): void
{
    $pdo = db();
    $module = aapm_cur_module_or_fail($pdo, $moduleId);
    $number = (int) $module['module_number'];
    // Academic history is reported first: it is the stronger reason and the one the learner record depends on.
    if (aapm_module_academic_history_count($pdo, $number) > 0) {
        error_response('Modul ini memiliki riwayat akademik dan tidak dapat dihapus. Arsipkan modul sebagai gantinya.', 409, 'module_has_academic_history');
    }
    if ((string) $module['lifecycle_status'] !== 'draft' || $module['published_revision_id'] !== null) {
        error_response('Modul yang pernah diterbitkan tidak dapat dihapus. Arsipkan modul sebagai gantinya.', 409, 'module_published_archive_required');
    }
    $legacy = $pdo->prepare('SELECT COUNT(*) FROM user_progress WHERE module_number = ?');
    $legacy->execute([$number]);
    $membership = $pdo->prepare('SELECT COUNT(*) FROM curriculum_policy_modules WHERE module_id = ?');
    $membership->execute([$moduleId]);
    if ((int) $legacy->fetchColumn() > 0 || (int) $membership->fetchColumn() > 0) {
        error_response('Modul ini masih dirujuk oleh progres atau kebijakan kurikulum dan tidak dapat dihapus.', 409, 'module_has_academic_history');
    }
    aapm_tx_begin($pdo);
    try {
        $locked = aapm_cur_lock_module($pdo, $moduleId);
        if (!$locked || (string) $locked['lifecycle_status'] !== 'draft' || $locked['published_revision_id'] !== null) {
            aapm_tx_rollback($pdo);
            error_response('Modul yang pernah diterbitkan tidak dapat dihapus. Arsipkan modul sebagai gantinya.', 409, 'module_published_archive_required');
        }
        $pdo->prepare('DELETE FROM module_drafts WHERE module_id = ?')->execute([$moduleId]);
        $pdo->prepare('DELETE FROM quiz_questions WHERE module_number = ?')->execute([$number]);
        $pdo->prepare('DELETE FROM course_modules WHERE id = ?')->execute([$moduleId]);
        // The number stays allocated in module_number_allocations: it is never reused.
        aapm_cur_event($pdo, 'draft.deleted', $number, null, null, $actorId, []);
        aapm_tx_commit($pdo);
    } catch (Throwable $exception) {
        aapm_tx_rollback($pdo);
        throw $exception;
    }
}

function aapm_cur_revisions(int $moduleId): array
{
    $statement = db()->prepare('SELECT id, revision_number, content_checksum, question_bank_revision_id, published_by_user_id, published_at FROM module_revisions WHERE module_id = ? ORDER BY revision_number DESC');
    $statement->execute([$moduleId]);
    return array_map(static fn (array $row): array => [
        'id' => (int) $row['id'],
        'revisionNumber' => (int) $row['revision_number'],
        'checksum' => (string) $row['content_checksum'],
        'hasQuestionBank' => $row['question_bank_revision_id'] !== null,
        'publishedBy' => $row['published_by_user_id'] === null ? null : (int) $row['published_by_user_id'],
        'publishedAt' => (string) $row['published_at'],
    ], $statement->fetchAll());
}

/** A published revision is returned read-only, with its question bank as it was published. */
function aapm_cur_revision_detail(int $moduleId, int $revisionId): array
{
    $pdo = db();
    $statement = $pdo->prepare('SELECT * FROM module_revisions WHERE id = ? AND module_id = ? LIMIT 1');
    $statement->execute([$revisionId, $moduleId]);
    $row = $statement->fetch();
    if (!$row) {
        error_response('Revisi tidak ditemukan.', 404, 'not_found');
    }
    $questions = [];
    if ($row['question_bank_revision_id'] !== null) {
        $items = $pdo->prepare('SELECT * FROM question_bank_revision_items WHERE bank_revision_id = ? ORDER BY ordinal ASC');
        $items->execute([(int) $row['question_bank_revision_id']]);
        foreach ($items->fetchAll() as $item) {
            $questions[] = [
                'question' => (string) $item['question'],
                'options' => array_values(json_decode((string) $item['options_json'], true) ?: []),
                'correctIndex' => (int) $item['correct_index'],
                'explanation' => (string) $item['explanation'],
                'learningObjective' => (string) $item['learning_objective'],
            ];
        }
    }
    return [
        'id' => (int) $row['id'],
        'revisionNumber' => (int) $row['revision_number'],
        'readOnly' => true,
        'payload' => json_decode((string) $row['content_payload_json'], true) ?: [],
        'questions' => $questions,
        'publishedAt' => (string) $row['published_at'],
    ];
}

/** Copies a published revision into the draft. The revision itself never changes. */
function aapm_cur_copy_revision_to_draft(int $moduleId, int $revisionId, int $expected, int $actorId): array
{
    $detail = aapm_cur_revision_detail($moduleId, $revisionId);
    $pdo = db();
    $module = aapm_cur_module_or_fail($pdo, $moduleId);
    $questions = array_map(static function (array $question): array {
        return $question + ['id' => 0, 'difficulty' => 'medium', 'type' => 'mcq'];
    }, $detail['questions']);
    $payload = $detail['payload'];
    $payload['moduleNumber'] = (int) $module['module_number'];

    aapm_tx_begin($pdo);
    try {
        $locked = aapm_cur_lock_module($pdo, $moduleId);
        $draft = aapm_cur_draft_locked($pdo, $locked, $actorId);
        if ((int) $draft['draft_version'] !== $expected) {
            aapm_tx_rollback($pdo);
            aapm_cur_conflict((int) $draft['draft_version']);
        }
        $live = aapm_cur_live_questions($pdo, (int) $module['module_number']);
        $byOrdinal = [];
        foreach ($questions as $index => $question) {
            $byOrdinal[] = ['id' => isset($live[$index]) ? $live[$index]['id'] : 0] + $question;
        }
        $version = (int) $draft['draft_version'] + 1;
        $pdo->prepare('UPDATE module_drafts SET content_payload_json = ?, question_payload_json = ?, draft_version = ?, edited_by_user_id = ?, updated_at = ? WHERE module_id = ? AND draft_version = ?')
            ->execute([json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), json_encode($byOrdinal, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $version, $actorId, aapm_utc_now(), $moduleId, $expected]);
        aapm_cur_event($pdo, 'draft.saved', (int) $module['module_number'], null, $detail['revisionNumber'], $actorId, ['draftVersion' => $version, 'copiedFromRevision' => $detail['revisionNumber']]);
        aapm_tx_commit($pdo);
    } catch (Throwable $exception) {
        aapm_tx_rollback($pdo);
        throw $exception;
    }
    return aapm_cur_admin_module_view(aapm_cur_module_or_fail($pdo, $moduleId), 'draft');
}

/* ------------------------------------------------------------- policies */

function aapm_cur_policy_row(PDO $pdo, string $version): ?array
{
    $statement = $pdo->prepare('SELECT * FROM curriculum_policy_versions WHERE policy_version = ? LIMIT 1');
    $statement->execute([$version]);
    return $statement->fetch() ?: null;
}

function aapm_cur_active_policy_version(PDO $pdo): string
{
    $statement = $pdo->query("SELECT policy_version FROM curriculum_policy_versions WHERE status = 'active' ORDER BY activated_at DESC, id DESC LIMIT 1");
    $value = $statement->fetchColumn();
    return $value === false ? AAPM_CUR_POLICY_V1 : (string) $value;
}

/** A learner's assigned policy. Accounts without a row are the legacy cohort and stay on academy-v1. */
function aapm_learner_policy_version(PDO $pdo, int $userId): string
{
    $statement = $pdo->prepare('SELECT policy_version FROM learner_curriculum_assignments WHERE user_id = ? LIMIT 1');
    $statement->execute([$userId]);
    $value = $statement->fetchColumn();
    return $value === false ? AAPM_CUR_POLICY_V1 : (string) $value;
}

/** New accounts receive the policy that is active when they are created. Never called for existing learners. */
function aapm_assign_new_learner_policy(PDO $pdo, int $userId, string $source): void
{
    $version = aapm_cur_active_policy_version($pdo);
    try {
        $pdo->prepare('INSERT INTO learner_curriculum_assignments (user_id, policy_version, assigned_at, assignment_source) VALUES (?, ?, ?, ?)')
            ->execute([$userId, $version, aapm_utc_now(), $source]);
    } catch (PDOException $exception) {
        $check = $pdo->prepare('SELECT COUNT(*) FROM learner_curriculum_assignments WHERE user_id = ?');
        $check->execute([$userId]);
        if ((int) $check->fetchColumn() < 1) {
            throw $exception;
        }
    }
}

/** The learner's curriculum: published active modules, plus archived modules their policy still requires. */
function aapm_cur_learner_modules(PDO $pdo, int $userId): array
{
    $version = aapm_learner_policy_version($pdo, $userId);
    $statement = $pdo->prepare("SELECT cm.* FROM course_modules cm WHERE cm.lifecycle_status = 'active' OR (cm.lifecycle_status = 'archived' AND cm.module_number IN (SELECT m.module_number FROM curriculum_policy_modules m WHERE m.policy_version = ? AND m.required = 1)) ORDER BY cm.sort_order ASC, cm.module_number ASC");
    $statement->execute([$version]);
    return $statement->fetchAll();
}

/** Stable, validated input for a policy draft: a list of membership entries and tier definitions. */
function aapm_cur_normalise_policy_input(array $input): array
{
    $modules = [];
    foreach ((array) ($input['modules'] ?? []) as $entry) {
        if (!is_array($entry) || !is_int($entry['moduleNumber'] ?? null)) {
            error_response('Daftar modul kebijakan tidak valid.', 422, 'validation_error');
        }
        $modules[] = ['moduleNumber' => (int) $entry['moduleNumber'], 'required' => (bool) ($entry['required'] ?? true)];
    }
    $tiers = [];
    foreach ((array) ($input['tiers'] ?? []) as $tier) {
        if (!is_array($tier) || !is_int($tier['tierNumber'] ?? null)) {
            error_response('Definisi tingkat sertifikat tidak valid.', 422, 'validation_error');
        }
        $tiers[] = [
            'tierNumber' => (int) $tier['tierNumber'],
            'tierName' => profile_text((string) ($tier['tierName'] ?? ''), 120),
            'modules' => array_values(array_map('intval', (array) ($tier['modules'] ?? []))),
            'requiresFinal' => (bool) ($tier['requiresFinal'] ?? false),
        ];
    }
    return [
        'modules' => $modules,
        'tiers' => $tiers,
        'modulePassPercent' => (int) ($input['modulePassPercent'] ?? AAPM_MODULE_PASS_PERCENT),
        'finalPassPercent' => (int) ($input['finalPassPercent'] ?? AAPM_FINAL_PASS_PERCENT),
    ];
}

/** Clones the active policy into a new draft version. The active policy is never edited. */
function aapm_cur_policy_create(string $version, int $actorId): array
{
    $pdo = db();
    if (!preg_match('/\Aacademy-v[0-9]{1,3}\z/', $version)) {
        error_response('Versi kebijakan tidak valid.', 422, 'validation_error');
    }
    $source = aapm_cur_active_policy_version($pdo);
    aapm_tx_begin($pdo);
    try {
        $exists = aapm_cur_policy_row($pdo, $version);
        if ($exists) {
            aapm_tx_rollback($pdo);
            error_response('Versi kebijakan sudah ada.', 409, 'policy_exists');
        }
        $now = aapm_utc_now();
        $pdo->prepare("INSERT INTO curriculum_policy_versions (policy_version, course_id, status, parent_policy_version, requirements_json, created_by_user_id, created_at, validated_at, activated_at) SELECT ?, course_id, 'draft', ?, requirements_json, ?, ?, NULL, NULL FROM curriculum_policy_versions WHERE policy_version = ?")
            ->execute([$version, $source, $actorId, $now, $source]);
        $pdo->prepare('INSERT INTO curriculum_policy_modules (policy_version, module_number, module_id, chapter_number, sort_order, required) SELECT ?, module_number, module_id, chapter_number, sort_order, required FROM curriculum_policy_modules WHERE policy_version = ?')
            ->execute([$version, $source]);
        $pdo->prepare('INSERT INTO assessment_policies (policy_version, course_id, required_modules_json, module_pass_percent, final_pass_percent, created_at) SELECT ?, course_id, required_modules_json, module_pass_percent, final_pass_percent, ? FROM assessment_policies WHERE policy_version = ?')
            ->execute([$version, $now, $source]);
        $pdo->prepare('INSERT INTO certificate_tier_policies (policy_version, tier_number, tier_name, required_modules_json, requires_final, created_at) SELECT ?, tier_number, tier_name, required_modules_json, requires_final, ? FROM certificate_tier_policies WHERE policy_version = ?')
            ->execute([$version, $now, $source]);
        aapm_cur_event($pdo, 'policy.created', null, $version, null, $actorId, ['parent' => $source]);
        aapm_tx_commit($pdo);
    } catch (Throwable $exception) {
        aapm_tx_rollback($pdo);
        throw $exception;
    }
    return aapm_cur_policy_detail($version);
}

/**
 * Edits a draft policy. Active and superseded policies are immutable history;
 * editing a ready policy returns it to draft, so validation is always current.
 */
function aapm_cur_policy_update(string $version, array $input, int $actorId): array
{
    $pdo = db();
    $normal = aapm_cur_normalise_policy_input($input);
    $row = aapm_cur_policy_row($pdo, $version);
    if (!$row) {
        error_response('Kebijakan tidak ditemukan.', 404, 'not_found');
    }
    if (!in_array((string) $row['status'], ['draft', 'ready'], true)) {
        error_response('Kebijakan yang sudah aktif atau digantikan tidak dapat diubah.', 409, 'policy_immutable');
    }
    $required = [];
    foreach ($normal['modules'] as $entry) {
        if ($entry['required']) {
            $required[] = $entry['moduleNumber'];
        }
    }
    aapm_tx_begin($pdo);
    try {
        $locked = aapm_cur_policy_row($pdo, $version);
        if (!$locked || !in_array((string) $locked['status'], ['draft', 'ready'], true)) {
            aapm_tx_rollback($pdo);
            error_response('Kebijakan yang sudah aktif atau digantikan tidak dapat diubah.', 409, 'policy_immutable');
        }
        $pdo->prepare('DELETE FROM curriculum_policy_modules WHERE policy_version = ?')->execute([$version]);
        $insertModule = $pdo->prepare('INSERT INTO curriculum_policy_modules (policy_version, module_number, module_id, chapter_number, sort_order, required) VALUES (?, ?, NULL, NULL, ?, ?)');
        foreach ($normal['modules'] as $index => $entry) {
            $insertModule->execute([$version, $entry['moduleNumber'], $index + 1, $entry['required'] ? 1 : 0]);
        }
        $pdo->prepare('UPDATE curriculum_policy_modules SET module_id = (SELECT cm.id FROM course_modules cm WHERE cm.module_number = curriculum_policy_modules.module_number), chapter_number = (SELECT cm.level_number FROM course_modules cm WHERE cm.module_number = curriculum_policy_modules.module_number) WHERE policy_version = ?')
            ->execute([$version]);
        $pdo->prepare('UPDATE assessment_policies SET required_modules_json = ?, module_pass_percent = ?, final_pass_percent = ? WHERE policy_version = ?')
            ->execute([json_encode(array_values(array_unique($required))), $normal['modulePassPercent'], $normal['finalPassPercent'], $version]);
        $pdo->prepare('DELETE FROM certificate_tier_policies WHERE policy_version = ?')->execute([$version]);
        $insertTier = $pdo->prepare('INSERT INTO certificate_tier_policies (policy_version, tier_number, tier_name, required_modules_json, requires_final, created_at) VALUES (?, ?, ?, ?, ?, ?)');
        foreach ($normal['tiers'] as $tier) {
            $insertTier->execute([$version, $tier['tierNumber'], $tier['tierName'], json_encode($tier['modules']), $tier['requiresFinal'] ? 1 : 0, aapm_utc_now()]);
        }
        $requirements = [
            'courseId' => (string) $locked['course_id'],
            'required' => array_values(array_unique($required)),
            'modulePassPercent' => $normal['modulePassPercent'],
            'finalPassPercent' => $normal['finalPassPercent'],
            'tiers' => $normal['tiers'],
        ];
        $pdo->prepare("UPDATE curriculum_policy_versions SET requirements_json = ?, status = 'draft', validated_at = NULL WHERE policy_version = ?")
            ->execute([json_encode($requirements, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $version]);
        aapm_cur_event($pdo, 'policy.created', null, $version, null, $actorId, ['edited' => true]);
        aapm_tx_commit($pdo);
    } catch (Throwable $exception) {
        aapm_tx_rollback($pdo);
        throw $exception;
    }
    return aapm_cur_policy_detail($version);
}

/**
 * Validates a policy draft against live modules and its own tier definitions.
 * Returns structured errors; an empty list means the policy may be marked ready.
 */
function aapm_cur_policy_errors(PDO $pdo, string $version): array
{
    $row = aapm_cur_policy_row($pdo, $version);
    if (!$row) {
        return [['section' => 'policy', 'field' => 'version', 'message' => 'Kebijakan tidak ditemukan.']];
    }
    $errors = [];
    $members = $pdo->prepare('SELECT m.module_number, m.required, cm.lifecycle_status, cm.published_revision_id FROM curriculum_policy_modules m LEFT JOIN course_modules cm ON cm.module_number = m.module_number WHERE m.policy_version = ? ORDER BY m.module_number ASC');
    $members->execute([$version]);
    $requiredSet = [];
    $seenSort = [];
    foreach ($members->fetchAll() as $member) {
        $number = (int) $member['module_number'];
        if ($member['lifecycle_status'] === null) {
            $errors[] = ['section' => 'modules', 'field' => "modules[$number]", 'message' => "Modul $number tidak ada di katalog.", 'code' => 'module_missing'];
            continue;
        }
        if ((string) $member['lifecycle_status'] !== 'active' || $member['published_revision_id'] === null) {
            $errors[] = ['section' => 'modules', 'field' => "modules[$number]", 'message' => "Modul $number belum diterbitkan.", 'code' => 'module_unpublished'];
        }
        if ((int) $member['required'] === 1) {
            $requiredSet[] = $number;
            if (count(aapm_cur_live_questions($pdo, $number)) === 0) {
                $errors[] = ['section' => 'modules', 'field' => "modules[$number]", 'message' => "Modul wajib $number belum memiliki soal yang valid.", 'code' => 'required_quiz_missing'];
            }
        }
    }
    $assessment = $pdo->prepare('SELECT required_modules_json, module_pass_percent, final_pass_percent FROM assessment_policies WHERE policy_version = ?');
    $assessment->execute([$version]);
    $assessmentRow = $assessment->fetch();
    if (!$assessmentRow) {
        $errors[] = ['section' => 'assessment', 'field' => 'thresholds', 'message' => 'Aturan penilaian kebijakan ini belum ada.', 'code' => 'assessment_policy_missing'];
    } else {
        $assessed = array_map('intval', json_decode((string) $assessmentRow['required_modules_json'], true) ?: []);
        sort($assessed);
        $sortedRequired = array_values(array_unique($requiredSet));
        sort($sortedRequired);
        if ($assessed !== $sortedRequired) {
            $errors[] = ['section' => 'assessment', 'field' => 'required', 'message' => 'Modul wajib kebijakan tidak sama dengan modul yang dinilai.', 'code' => 'assessment_requirement_mismatch'];
        }
        foreach (['module_pass_percent' => 'modulePassPercent', 'final_pass_percent' => 'finalPassPercent'] as $column => $label) {
            $value = (int) $assessmentRow[$column];
            if ($value < 50 || $value > 100) {
                $errors[] = ['section' => 'assessment', 'field' => $label, 'message' => 'Ambang kelulusan harus antara 50 dan 100.', 'code' => 'threshold_out_of_bounds'];
            }
        }
    }
    $finalBank = (int) $pdo->query('SELECT COUNT(*) FROM quiz_questions WHERE module_number = 0')->fetchColumn();
    $tiers = $pdo->prepare('SELECT tier_number, tier_name, required_modules_json, requires_final FROM certificate_tier_policies WHERE policy_version = ? ORDER BY tier_number ASC');
    $tiers->execute([$version]);
    $tierRows = $tiers->fetchAll();
    $numbers = array_map(static fn (array $tier): int => (int) $tier['tier_number'], $tierRows);
    if ($numbers !== [1, 2, 3, 4, 5, 6]) {
        $errors[] = ['section' => 'certificates', 'field' => 'tiers', 'message' => 'Pemetaan tingkat sertifikat harus lengkap (tingkat 1 sampai 6).', 'code' => 'tier_map_incomplete'];
    }
    foreach ($tierRows as $tier) {
        $number = (int) $tier['tier_number'];
        if (trim((string) $tier['tier_name']) === '') {
            $errors[] = ['section' => 'certificates', 'field' => "tiers[$number].tierName", 'message' => "Nama tingkat $number wajib diisi.", 'code' => 'tier_name_missing'];
        }
        $modules = array_map('intval', json_decode((string) $tier['required_modules_json'], true) ?: []);
        if ($modules === []) {
            $errors[] = ['section' => 'certificates', 'field' => "tiers[$number].modules", 'message' => "Tingkat $number belum memiliki modul.", 'code' => 'tier_modules_missing'];
        }
        foreach ($modules as $module) {
            if (!in_array($module, $requiredSet, true)) {
                $errors[] = ['section' => 'certificates', 'field' => "tiers[$number].modules", 'message' => "Modul $module pada tingkat $number tidak termasuk modul wajib.", 'code' => 'tier_module_not_required'];
            }
        }
        if ((int) $tier['requires_final'] === 1 && $finalBank === 0) {
            $errors[] = ['section' => 'certificates', 'field' => "tiers[$number].requiresFinal", 'message' => 'Ujian akhir belum memiliki soal.', 'code' => 'final_bank_missing'];
        }
    }
    return $errors;
}

function aapm_cur_policy_validate(string $version, int $actorId): array
{
    $pdo = db();
    $errors = aapm_cur_policy_errors($pdo, $version);
    if ($errors === []) {
        aapm_tx_begin($pdo);
        try {
            $pdo->prepare('UPDATE curriculum_policy_versions SET validated_at = ? WHERE policy_version = ?')->execute([aapm_utc_now(), $version]);
            aapm_cur_event($pdo, 'policy.validated', null, $version, null, $actorId, []);
            aapm_tx_commit($pdo);
        } catch (Throwable $exception) {
            aapm_tx_rollback($pdo);
            throw $exception;
        }
    }
    return ['valid' => $errors === [], 'errors' => $errors];
}

function aapm_cur_policy_mark_ready(string $version, int $actorId): array
{
    $pdo = db();
    $row = aapm_cur_policy_row($pdo, $version);
    if (!$row) {
        error_response('Kebijakan tidak ditemukan.', 404, 'not_found');
    }
    if ((string) $row['status'] !== 'draft' || $row['validated_at'] === null) {
        error_response('Kebijakan harus divalidasi tanpa perubahan sebelum ditandai siap.', 409, 'policy_not_validated');
    }
    $pdo->prepare("UPDATE curriculum_policy_versions SET status = 'ready' WHERE policy_version = ? AND status = 'draft'")->execute([$version]);
    aapm_cur_event($pdo, 'policy.validated', null, $version, null, $actorId, ['ready' => true]);
    return aapm_cur_policy_detail($version);
}

/**
 * Activation changes which policy new accounts receive. Existing learners keep their
 * assignment. Only called from the operator CLI, never from HTTP.
 */
function aapm_cur_policy_activate(PDO $pdo, string $version, ?int $actorId, array $evidence): array
{
    aapm_tx_begin($pdo);
    try {
        if (aapm_database_driver() !== 'sqlite') {
            $pdo->query('SELECT id FROM curriculum_policy_versions WHERE policy_version = ' . $pdo->quote($version) . ' FOR UPDATE')->fetchAll();
        }
        $row = aapm_cur_policy_row($pdo, $version);
        if (!$row || (string) $row['status'] !== 'ready') {
            aapm_tx_rollback($pdo);
            throw new RuntimeException('policy_not_ready');
        }
        $errors = aapm_cur_policy_errors($pdo, $version);
        if ($errors !== []) {
            aapm_tx_rollback($pdo);
            throw new RuntimeException('policy_invalid');
        }
        $now = aapm_utc_now();
        $pdo->prepare("UPDATE curriculum_policy_versions SET status = 'superseded' WHERE status = 'active' AND policy_version <> ?")->execute([$version]);
        $pdo->prepare("UPDATE curriculum_policy_versions SET status = 'active', activated_at = ? WHERE policy_version = ?")->execute([$now, $version]);
        aapm_cur_event($pdo, 'policy.activated', null, $version, null, $actorId, $evidence);
        aapm_tx_commit($pdo);
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            aapm_tx_rollback($pdo);
        }
        throw $exception;
    }
    return aapm_cur_policy_detail($version);
}

function aapm_cur_policy_detail(string $version): array
{
    $pdo = db();
    $row = aapm_cur_policy_row($pdo, $version);
    if (!$row) {
        error_response('Kebijakan tidak ditemukan.', 404, 'not_found');
    }
    $members = $pdo->prepare('SELECT module_number, required, sort_order, chapter_number FROM curriculum_policy_modules WHERE policy_version = ? ORDER BY sort_order ASC, module_number ASC');
    $members->execute([$version]);
    $tiers = $pdo->prepare('SELECT tier_number, tier_name, required_modules_json, requires_final FROM certificate_tier_policies WHERE policy_version = ? ORDER BY tier_number ASC');
    $tiers->execute([$version]);
    return [
        'version' => (string) $row['policy_version'],
        'status' => (string) $row['status'],
        'parentVersion' => $row['parent_policy_version'],
        'validatedAt' => $row['validated_at'],
        'activatedAt' => $row['activated_at'],
        'modules' => array_map(static fn (array $m): array => [
            'moduleNumber' => (int) $m['module_number'],
            'required' => (int) $m['required'] === 1,
            'sortOrder' => $m['sort_order'] === null ? null : (int) $m['sort_order'],
            'chapterNumber' => $m['chapter_number'] === null ? null : (int) $m['chapter_number'],
        ], $members->fetchAll()),
        'tiers' => array_map(static fn (array $t): array => [
            'tierNumber' => (int) $t['tier_number'],
            'tierName' => (string) $t['tier_name'],
            'modules' => array_map('intval', json_decode((string) $t['required_modules_json'], true) ?: []),
            'requiresFinal' => (int) $t['requires_final'] === 1,
        ], $tiers->fetchAll()),
    ];
}

function aapm_cur_policy_list(): array
{
    $rows = db()->query('SELECT policy_version, status, parent_policy_version, validated_at, activated_at FROM curriculum_policy_versions ORDER BY id ASC')->fetchAll();
    return array_map(static fn (array $row): array => [
        'version' => (string) $row['policy_version'],
        'status' => (string) $row['status'],
        'parentVersion' => $row['parent_policy_version'],
        'validatedAt' => $row['validated_at'],
        'activatedAt' => $row['activated_at'],
    ], $rows);
}

/**
 * Migration only: every existing account is assigned academy-v1. Runs from
 * database/migrate.php, never from request handling, so a later active policy can
 * never reach an account that was created before it.
 */
function aapm_cur_assign_existing_learners(PDO $pdo): int
{
    $before = (int) $pdo->query('SELECT COUNT(*) FROM learner_curriculum_assignments')->fetchColumn();
    $pdo->prepare('INSERT INTO learner_curriculum_assignments (user_id, policy_version, assigned_at, assignment_source) SELECT id, ?, ?, ? FROM users WHERE id NOT IN (SELECT user_id FROM learner_curriculum_assignments)')
        ->execute([AAPM_CUR_POLICY_V1, aapm_utc_now(), 'migration']);
    return (int) $pdo->query('SELECT COUNT(*) FROM learner_curriculum_assignments')->fetchColumn() - $before;
}

/** Schema and invariant checks reported by migrate.php. */
function aapm_cur_schema_status(PDO $pdo): array
{
    return [
        'module_drafts' => aapm_table_exists($pdo, 'module_drafts'),
        'module_revisions' => aapm_table_exists($pdo, 'module_revisions'),
        'question_bank_revisions' => aapm_table_exists($pdo, 'question_bank_revisions'),
        'question_bank_revision_items' => aapm_table_exists($pdo, 'question_bank_revision_items'),
        'curriculum_policy_versions' => aapm_table_exists($pdo, 'curriculum_policy_versions'),
        'curriculum_policy_modules' => aapm_table_exists($pdo, 'curriculum_policy_modules'),
        'learner_curriculum_assignments' => aapm_table_exists($pdo, 'learner_curriculum_assignments'),
        'curriculum_publication_events' => aapm_table_exists($pdo, 'curriculum_publication_events'),
        'lifecycle_column' => aapm_column_exists($pdo, 'course_modules', 'lifecycle_status'),
        'every_active_module_published' => (int) $pdo->query("SELECT COUNT(*) FROM course_modules WHERE lifecycle_status = 'active' AND published_revision_id IS NULL")->fetchColumn() === 0,
        'policy_v1_active' => (int) $pdo->query("SELECT COUNT(*) FROM curriculum_policy_versions WHERE policy_version = 'academy-v1'")->fetchColumn() === 1,
    ];
}
