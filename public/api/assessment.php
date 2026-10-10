<?php
declare(strict_types=1);

/**
 * Q03 assessment authority: attempts, server-side grading, module completion,
 * final eligibility, and learner progress derived from validated evidence.
 *
 * Learner-facing responses never contain an unchecked answer key. The correct
 * answer lives only in assessment_attempt_items.question_snapshot_json. A module
 * question releases its feedback only after the learner has checked it; the final
 * exam never releases per-question correctness.
 */

const AAPM_ASSESSMENT_POLICY_VERSION = 'academy-v1';
const AAPM_ASSESSMENT_SCHEMA_KEY = '20261015_assessment_authority_v1';
const AAPM_MODULE_PASS_PERCENT = 70;
const AAPM_FINAL_PASS_PERCENT = 80;
const AAPM_ATTEMPT_TTL_SECONDS = 604800;
const AAPM_STUDY_INCREMENT_MAX_MINUTES = 15;

/** Fields a learner may never send to an academic or progress endpoint. */
const AAPM_FORBIDDEN_PROGRESS_FIELDS = [
    'completed', 'quizScore', 'quizTotal', 'quiz_score', 'quiz_total', 'practicalDone', 'practical_done',
    'timeSpentMinutes', 'time_spent_minutes', 'timeSpentDeltaMinutes', 'passed', 'score', 'grade', 'correctIndex',
];

/** Stable error with optional structured details. Mirrors error_response(). */
function aapm_assessment_fail(int $status, string $code, string $message, array $details = []): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    $error = ['message' => $message, 'code' => $code];
    if ($details !== []) {
        $error['details'] = $details;
    }
    echo json_encode(['error' => $error], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function aapm_assessment_policy_required_modules(): array
{
    return range(1, 22);
}

/** Idempotency and opaque identifiers accept only this shape. */
function aapm_assessment_valid_key(mixed $value): bool
{
    return is_string($value) && (bool) preg_match('/\A[A-Za-z0-9_-]{8,80}\z/', $value);
}

function aapm_assessment_ddl(string $driver): array
{
    if ($driver === 'sqlite') {
        return [
            'CREATE TABLE IF NOT EXISTS assessment_policies (
                policy_version TEXT NOT NULL PRIMARY KEY,
                course_id TEXT NOT NULL,
                required_modules_json TEXT NOT NULL,
                module_pass_percent INTEGER NOT NULL,
                final_pass_percent INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )',
            'CREATE TABLE IF NOT EXISTS assessment_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                public_id TEXT NOT NULL UNIQUE,
                user_id INTEGER NOT NULL,
                assessment_type TEXT NOT NULL,
                module_number INTEGER NOT NULL,
                policy_version TEXT NOT NULL,
                passing_grade INTEGER NOT NULL,
                status TEXT NOT NULL,
                total_questions INTEGER NOT NULL,
                correct_answers INTEGER NULL,
                score_percent INTEGER NULL,
                passed INTEGER NULL,
                started_at TEXT NOT NULL,
                submitted_at TEXT NULL,
                expires_at TEXT NOT NULL,
                start_request_key TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(user_id, start_request_key),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )',
            'CREATE INDEX IF NOT EXISTS assessment_attempts_lookup_idx ON assessment_attempts(user_id, assessment_type, module_number, started_at)',
            'CREATE INDEX IF NOT EXISTS assessment_attempts_status_idx ON assessment_attempts(user_id, assessment_type, status, expires_at)',
            'CREATE TABLE IF NOT EXISTS assessment_attempt_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                attempt_id INTEGER NOT NULL,
                ordinal INTEGER NOT NULL,
                source_question_id INTEGER NOT NULL,
                question_snapshot_json TEXT NOT NULL,
                answer_index INTEGER NULL,
                answered_at TEXT NULL,
                checked_at TEXT NULL,
                UNIQUE(attempt_id, ordinal),
                FOREIGN KEY(attempt_id) REFERENCES assessment_attempts(id) ON DELETE CASCADE
            )',
            'CREATE TABLE IF NOT EXISTS module_learning_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                module_number INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                idempotency_key TEXT NOT NULL,
                amount INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                UNIQUE(user_id, event_type, idempotency_key),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )',
            'CREATE INDEX IF NOT EXISTS module_learning_events_module_idx ON module_learning_events(user_id, module_number, event_type)',
            'CREATE TABLE IF NOT EXISTS legacy_progress_snapshots (
                user_id INTEGER NOT NULL,
                module_number INTEGER NOT NULL,
                legacy_completed INTEGER NOT NULL,
                legacy_quiz_score INTEGER NULL,
                legacy_quiz_total INTEGER NULL,
                legacy_practical_done INTEGER NOT NULL,
                legacy_time_spent_minutes INTEGER NULL,
                snapshot_at TEXT NOT NULL,
                PRIMARY KEY(user_id, module_number)
            )',
        ];
    }

    $suffix = ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

    return [
        'CREATE TABLE IF NOT EXISTS assessment_policies (
            policy_version VARCHAR(40) NOT NULL,
            course_id VARCHAR(80) NOT NULL,
            required_modules_json TEXT NOT NULL,
            module_pass_percent TINYINT UNSIGNED NOT NULL,
            final_pass_percent TINYINT UNSIGNED NOT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (policy_version)
        )' . $suffix,
        'CREATE TABLE IF NOT EXISTS assessment_attempts (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            public_id CHAR(48) NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL,
            assessment_type VARCHAR(20) NOT NULL,
            module_number SMALLINT UNSIGNED NOT NULL,
            policy_version VARCHAR(40) NOT NULL,
            passing_grade TINYINT UNSIGNED NOT NULL,
            status VARCHAR(16) NOT NULL,
            total_questions SMALLINT UNSIGNED NOT NULL,
            correct_answers SMALLINT UNSIGNED NULL,
            score_percent TINYINT UNSIGNED NULL,
            passed TINYINT(1) NULL,
            started_at DATETIME NOT NULL,
            submitted_at DATETIME NULL,
            expires_at DATETIME NOT NULL,
            start_request_key VARCHAR(80) NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY assessment_attempts_public_unique (public_id),
            UNIQUE KEY assessment_attempts_request_unique (user_id, start_request_key),
            KEY assessment_attempts_lookup_idx (user_id, assessment_type, module_number, started_at),
            KEY assessment_attempts_status_idx (user_id, assessment_type, status, expires_at),
            CONSTRAINT assessment_attempts_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )' . $suffix,
        'CREATE TABLE IF NOT EXISTS assessment_attempt_items (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            attempt_id BIGINT UNSIGNED NOT NULL,
            ordinal SMALLINT UNSIGNED NOT NULL,
            source_question_id BIGINT UNSIGNED NOT NULL,
            question_snapshot_json MEDIUMTEXT NOT NULL,
            answer_index TINYINT UNSIGNED NULL,
            answered_at DATETIME NULL,
            checked_at DATETIME NULL,
            PRIMARY KEY (id),
            UNIQUE KEY assessment_attempt_items_ordinal_unique (attempt_id, ordinal),
            CONSTRAINT assessment_attempt_items_attempt_fk FOREIGN KEY (attempt_id) REFERENCES assessment_attempts(id) ON DELETE CASCADE
        )' . $suffix,
        'CREATE TABLE IF NOT EXISTS module_learning_events (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            module_number SMALLINT UNSIGNED NOT NULL,
            event_type VARCHAR(32) NOT NULL,
            idempotency_key VARCHAR(80) NOT NULL,
            amount SMALLINT UNSIGNED NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY module_learning_events_unique (user_id, event_type, idempotency_key),
            KEY module_learning_events_module_idx (user_id, module_number, event_type),
            CONSTRAINT module_learning_events_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )' . $suffix,
        'CREATE TABLE IF NOT EXISTS legacy_progress_snapshots (
            user_id BIGINT UNSIGNED NOT NULL,
            module_number SMALLINT UNSIGNED NOT NULL,
            legacy_completed TINYINT(1) NOT NULL,
            legacy_quiz_score SMALLINT NULL,
            legacy_quiz_total SMALLINT NULL,
            legacy_practical_done TINYINT(1) NOT NULL,
            legacy_time_spent_minutes INT NULL,
            snapshot_at DATETIME NOT NULL,
            PRIMARY KEY (user_id, module_number)
        )' . $suffix,
    ];
}

/** Additive and idempotent. Runs for fresh and existing databases, like the Q02 auth schema. */
function aapm_ensure_assessment_schema(PDO $pdo, string $driver): void
{
    static $ready = false;
    if ($ready || !aapm_table_exists($pdo, 'users')) {
        return;
    }
    foreach (aapm_assessment_ddl($driver) as $sql) {
        $pdo->exec($sql);
    }
    aapm_ensure_generation_schema($pdo, $driver);
    aapm_seed_assessment_policy($pdo);
    $ready = true;
}

/** Inserts the immutable academy-v1 policy once. A concurrent insert is harmless. */
function aapm_seed_assessment_policy(PDO $pdo): void
{
    $exists = $pdo->prepare('SELECT COUNT(*) FROM assessment_policies WHERE policy_version = ?');
    $exists->execute([AAPM_ASSESSMENT_POLICY_VERSION]);
    if ((int) $exists->fetchColumn() > 0) {
        return;
    }
    try {
        $pdo->prepare('INSERT INTO assessment_policies (policy_version, course_id, required_modules_json, module_pass_percent, final_pass_percent, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([
                AAPM_ASSESSMENT_POLICY_VERSION,
                'aapm-layer-academy',
                json_encode(aapm_assessment_policy_required_modules()),
                AAPM_MODULE_PASS_PERCENT,
                AAPM_FINAL_PASS_PERCENT,
                aapm_utc_now(),
            ]);
    } catch (PDOException $exception) {
        // Another request installed the same policy first.
        $exists->execute([AAPM_ASSESSMENT_POLICY_VERSION]);
        if ((int) $exists->fetchColumn() < 1) {
            throw $exception;
        }
    }
}

function aapm_assessment_policy(PDO $pdo, string $version = AAPM_ASSESSMENT_POLICY_VERSION): array
{
    $row = $pdo->prepare('SELECT policy_version, required_modules_json, module_pass_percent, final_pass_percent FROM assessment_policies WHERE policy_version = ? LIMIT 1');
    $row->execute([$version]);
    $policy = $row->fetch();
    if (!$policy) {
        throw new RuntimeException('assessment policy missing');
    }

    return [
        'version' => (string) $policy['policy_version'],
        'required' => array_map('intval', json_decode((string) $policy['required_modules_json'], true) ?: []),
        'modulePass' => (int) $policy['module_pass_percent'],
        'finalPass' => (int) $policy['final_pass_percent'],
    ];
}

/**
 * Academic generations (Q04). A reset advances a learner's generation instead of
 * deleting anything: attempts and events keep the generation they were recorded in,
 * and current progress reads only the active one. Additive and idempotent.
 */
function aapm_ensure_generation_schema(PDO $pdo, string $driver): void
{
    if ($driver === 'sqlite') {
        $pdo->exec('CREATE TABLE IF NOT EXISTS learner_academic_state (
            user_id INTEGER NOT NULL PRIMARY KEY,
            current_generation INTEGER NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )');
        $columnType = 'INTEGER NOT NULL DEFAULT 1';
    } else {
        $pdo->exec('CREATE TABLE IF NOT EXISTS learner_academic_state (
            user_id BIGINT UNSIGNED NOT NULL,
            current_generation INT UNSIGNED NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (user_id),
            CONSTRAINT learner_academic_state_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
        $columnType = 'INT UNSIGNED NOT NULL DEFAULT 1';
    }
    foreach (['assessment_attempts', 'module_learning_events'] as $table) {
        if (aapm_column_exists($pdo, $table, 'academic_generation')) {
            continue;
        }
        try {
            $pdo->exec('ALTER TABLE ' . $table . ' ADD COLUMN academic_generation ' . $columnType);
        } catch (PDOException $exception) {
            // A concurrent request added it first.
            if (!aapm_column_exists($pdo, $table, 'academic_generation')) {
                throw $exception;
            }
        }
    }
}

/** The learner's active generation. No state row means the original generation, 1. */
function aapm_current_generation(PDO $pdo, int $userId): int
{
    $statement = $pdo->prepare('SELECT current_generation FROM learner_academic_state WHERE user_id = ? LIMIT 1');
    $statement->execute([$userId]);
    $value = $statement->fetchColumn();

    return $value === false ? 1 : max(1, (int) $value);
}

/** True when an attempt belongs to an earlier generation or was marked superseded by a reset. */
function aapm_attempt_superseded(PDO $pdo, int $userId, array $attempt): bool
{
    return (string) $attempt['status'] === 'superseded'
        || (int) ($attempt['academic_generation'] ?? 1) !== aapm_current_generation($pdo, $userId);
}

/**
 * Advances the learner to the next generation and supersedes open attempts.
 * Nothing is deleted. The caller owns the transaction and the user lock.
 */
function aapm_reset_learner_progress(PDO $pdo, int $userId): array
{
    $from = aapm_current_generation($pdo, $userId);
    $to = $from + 1;
    $now = aapm_utc_now();
    $update = $pdo->prepare('UPDATE learner_academic_state SET current_generation = ?, updated_at = ? WHERE user_id = ?');
    $update->execute([$to, $now, $userId]);
    if ($update->rowCount() < 1) {
        $pdo->prepare('INSERT INTO learner_academic_state (user_id, current_generation, updated_at) VALUES (?, ?, ?)')->execute([$userId, $to, $now]);
    }
    $superseded = $pdo->prepare("UPDATE assessment_attempts SET status = 'superseded', updated_at = ? WHERE user_id = ? AND status = 'in_progress' AND academic_generation = ?");
    $superseded->execute([$now, $userId, $from]);

    return ['generationFrom' => $from, 'generationTo' => $to, 'supersededAttempts' => $superseded->rowCount()];
}

/** Lock point for every learner write. SQLite is already serialized by BEGIN IMMEDIATE. */
function aapm_assessment_user_lock(PDO $pdo, int $userId): void
{
    if (aapm_database_driver() === 'sqlite') {
        return;
    }
    $pdo->prepare('SELECT id FROM users WHERE id = ? FOR UPDATE')->execute([$userId]);
}

function aapm_module_catalog(PDO $pdo, int $userId): array
{
    $catalog = [];
    // Match the learner catalogue: archived material stays available only when
    // the account's assigned academic policy still requires that module.
    foreach (aapm_cur_learner_modules($pdo, $userId) as $row) {
        $catalog[(int) $row['module_number']] = [
            'levelNumber' => (int) $row['level_number'],
            'title' => (string) $row['title'],
            'assessmentMode' => (string) $row['assessment_mode'],
        ];
    }

    return $catalog;
}

function aapm_quiz_counts(PDO $pdo): array
{
    $counts = [];
    foreach ($pdo->query('SELECT module_number, COUNT(*) AS n FROM quiz_questions GROUP BY module_number')->fetchAll() as $row) {
        $counts[(int) $row['module_number']] = (int) $row['n'];
    }

    return $counts;
}

/** A snapshot of the question as checked by the server. Correct-answer data lives here only. */
function aapm_question_snapshot(array $row): array
{
    $options = json_decode((string) $row['options'], true);

    return [
        'question' => (string) $row['question'],
        'options' => array_values(is_array($options) ? $options : []),
        'correctIndex' => (int) $row['correct_index'],
        'explanation' => (string) $row['explanation'],
        'learningObjective' => (string) ($row['learning_objective'] ?? ''),
        'difficulty' => (string) ($row['difficulty'] ?? ''),
    ];
}

function aapm_checked_feedback(array $snapshot, int $answerIndex): array
{
    return [
        'isCorrect' => $answerIndex === (int) $snapshot['correctIndex'],
        'correctIndex' => (int) $snapshot['correctIndex'],
        'explanation' => (string) $snapshot['explanation'],
        'learningObjective' => (string) $snapshot['learningObjective'],
    ];
}

function aapm_attempt_row(PDO $pdo, int $userId, string $publicId): ?array
{
    $statement = $pdo->prepare('SELECT * FROM assessment_attempts WHERE public_id = ? AND user_id = ? LIMIT 1');
    $statement->execute([$publicId, $userId]);
    $row = $statement->fetch();

    return $row ?: null;
}

/** Marks an in-progress attempt as expired once its window has passed. Call inside a write transaction. */
function aapm_expire_if_due(PDO $pdo, array $attempt): array
{
    if ($attempt['status'] === 'in_progress' && (string) $attempt['expires_at'] <= aapm_utc_now()) {
        $pdo->prepare("UPDATE assessment_attempts SET status = 'expired', updated_at = ? WHERE id = ? AND status = 'in_progress'")
            ->execute([aapm_utc_now(), (int) $attempt['id']]);
        $attempt['status'] = 'expired';
    }

    return $attempt;
}

function aapm_attempt_items(PDO $pdo, int $attemptId): array
{
    $statement = $pdo->prepare('SELECT * FROM assessment_attempt_items WHERE attempt_id = ? ORDER BY ordinal ASC');
    $statement->execute([$attemptId]);

    return $statement->fetchAll();
}

/** Learner view. Module feedback only for checked items; final exam never reveals correctness per question. */
function aapm_attempt_view(PDO $pdo, array $attempt): array
{
    $items = aapm_attempt_items($pdo, (int) $attempt['id']);
    $isModule = $attempt['assessment_type'] === 'module_quiz';
    $questions = [];
    $answered = 0;
    $checked = 0;
    $objectives = [];

    foreach ($items as $item) {
        $snapshot = json_decode((string) $item['question_snapshot_json'], true);
        $selected = $item['answer_index'] === null ? null : (int) $item['answer_index'];
        if ($selected !== null) {
            $answered++;
        }
        $isChecked = $item['checked_at'] !== null;
        if ($isChecked) {
            $checked++;
        }
        $question = [
            'id' => (int) $item['id'],
            'ordinal' => (int) $item['ordinal'],
            'question' => $snapshot['question'],
            'options' => $snapshot['options'],
            'selectedIndex' => $selected,
            'checked' => $isChecked,
            'locked' => $isChecked,
        ];
        if ($isModule && $isChecked && $selected !== null) {
            $question['feedback'] = aapm_checked_feedback($snapshot, $selected);
        }
        $questions[] = $question;
    }

    $view = [
        'id' => (string) $attempt['public_id'],
        'assessmentType' => (string) $attempt['assessment_type'],
        'moduleNumber' => (int) $attempt['module_number'],
        'status' => (string) $attempt['status'],
        'policyVersion' => (string) $attempt['policy_version'],
        'passingGrade' => (int) $attempt['passing_grade'],
        'totalQuestions' => (int) $attempt['total_questions'],
        'startedAt' => (string) $attempt['started_at'],
        'expiresAt' => (string) $attempt['expires_at'],
        'submittedAt' => $attempt['submitted_at'],
        'answeredCount' => $answered,
        'checkedCount' => $checked,
        'questions' => $questions,
        'result' => null,
    ];

    if ($attempt['status'] === 'submitted') {
        $result = [
            'correctAnswers' => (int) $attempt['correct_answers'],
            'totalQuestions' => (int) $attempt['total_questions'],
            'scorePercent' => (int) $attempt['score_percent'],
            'passingGrade' => (int) $attempt['passing_grade'],
            'passed' => (bool) (int) $attempt['passed'],
        ];
        if (!$isModule) {
            // Learning-objective summary, without the answer key or per-question correctness.
            foreach ($items as $item) {
                $snapshot = json_decode((string) $item['question_snapshot_json'], true);
                $key = (string) $snapshot['learningObjective'];
                $objectives[$key] = $objectives[$key] ?? ['learningObjective' => $key, 'correct' => 0, 'total' => 0];
                $objectives[$key]['total']++;
                if ((int) $item['answer_index'] === (int) $snapshot['correctIndex']) {
                    $objectives[$key]['correct']++;
                }
            }
            $result['objectives'] = array_values($objectives);
        }
        $view['result'] = $result;
    }

    return $view;
}

/** Scores a submitted attempt from its stored snapshots. Integer arithmetic only. */
function aapm_grade(array $items, int $passingGrade): array
{
    $total = count($items);
    $correct = 0;
    foreach ($items as $item) {
        $snapshot = json_decode((string) $item['question_snapshot_json'], true);
        if ((int) $item['answer_index'] === (int) $snapshot['correctIndex']) {
            $correct++;
        }
    }

    return [
        'correct' => $correct,
        'total' => $total,
        'scorePercent' => intdiv($correct * 100, $total),
        'passed' => $correct * 100 >= $passingGrade * $total,
    ];
}

/**
 * Derives the academic state for a learner from attempts, learning events, the
 * curriculum catalog, and the legacy record. Legacy values never satisfy an academic
 * requirement. This is the single source for progress, eligibility and final status.
 */
function aapm_academic_snapshot(PDO $pdo, int $userId): array
{
    $policy = aapm_assessment_policy($pdo, aapm_learner_policy_version($pdo, $userId));
    $catalog = aapm_module_catalog($pdo, $userId);
    $quizCounts = aapm_quiz_counts($pdo);
    $modeRows = $pdo->prepare('SELECT module_number, assessment_mode FROM curriculum_policy_modules WHERE policy_version = ?');
    $modeRows->execute([$policy['version']]);
    $modes = [];
    foreach ($modeRows->fetchAll() as $mode) $modes[(int) $mode['module_number']] = $mode['assessment_mode'];
    $now = aapm_utc_now();

    $attemptStatement = $pdo->prepare('SELECT * FROM assessment_attempts WHERE user_id = ? ORDER BY id ASC');
    $attemptStatement->execute([$userId]);
    $attempts = $attemptStatement->fetchAll();
    $generation = aapm_current_generation($pdo, $userId);

    $eventStatement = $pdo->prepare('SELECT module_number, event_type, amount, created_at FROM module_learning_events WHERE user_id = ? AND academic_generation = ? ORDER BY id ASC');
    $eventStatement->execute([$userId, $generation]);
    $events = $eventStatement->fetchAll();

    $legacyStatement = $pdo->prepare('SELECT module_number, completed, quiz_score, quiz_total, practical_done, time_spent_minutes, updated_at FROM user_progress WHERE user_id = ?');
    $legacyStatement->execute([$userId]);
    $legacyRows = [];
    // Historical rows belong to generation 1; a later generation starts without them.
    foreach ($generation === 1 ? $legacyStatement->fetchAll() : [] as $row) {
        $legacyRows[(int) $row['module_number']] = $row;
    }

    $modules = [];
    // Preserve historical progress outside today's available catalogue as evidence.
    // Its quiz nature comes from stored attempts, never from the mutable live bank.
    $historicalQuizzes = [];
    foreach ($attempts as $attempt) {
        if ($attempt['assessment_type'] === 'module_quiz') $historicalQuizzes[(int) $attempt['module_number']] = true;
    }
    $moduleNumbers = array_unique(array_merge(array_keys($catalog), [0], array_keys($legacyRows), array_keys($modes), array_keys($historicalQuizzes), array_map('intval', array_column($events, 'module_number'))));
    sort($moduleNumbers);
    foreach ($moduleNumbers as $number) {
        $modules[$number] = [
            'moduleNumber' => $number,
            'levelNumber' => $catalog[$number]['levelNumber'] ?? null,
            'title' => $catalog[$number]['title'] ?? ($number === 0 ? 'Ujian akhir' : null),
            'hasQuiz' => $number === 0 ? ($quizCounts[0] ?? 0) > 0 : (isset($modes[$number]) ? $modes[$number] === 'quiz' : isset($historicalQuizzes[$number])),
            'quizAttempted' => false,
            'quizPassed' => false,
            'bestPercent' => null,
            'bestCorrect' => null,
            'bestTotal' => null,
            'failedAttempts' => 0,
            'activeAttemptId' => null,
            'acknowledged' => false,
            'practiceAttested' => false,
            'studyMinutes' => 0,
            'updatedAt' => null,
        ];
    }

    foreach ($attempts as $attempt) {
        $attempt = aapm_expire_if_due_snapshot($attempt, $now);
        if ((int) ($attempt['academic_generation'] ?? 1) !== $generation) {
            continue;
        }
        $number = (int) $attempt['module_number'];
        if (!isset($modules[$number])) {
            continue;
        }
        if ($attempt['assessment_type'] !== 'module_quiz' && $number !== 0) {
            continue;
        }
        if ($attempt['status'] === 'in_progress') {
            $modules[$number]['activeAttemptId'] = (string) $attempt['public_id'];
        }
        if ($attempt['status'] === 'submitted') {
            $modules[$number]['quizAttempted'] = true;
            if ((int) $attempt['passed'] === 1) {
                $modules[$number]['quizPassed'] = true;
            } else {
                $modules[$number]['failedAttempts']++;
            }
            $percent = (int) $attempt['score_percent'];
            if ($modules[$number]['bestPercent'] === null || $percent >= $modules[$number]['bestPercent']) {
                $modules[$number]['bestPercent'] = $percent;
                $modules[$number]['bestCorrect'] = (int) $attempt['correct_answers'];
                $modules[$number]['bestTotal'] = (int) $attempt['total_questions'];
            }
            $modules[$number]['updatedAt'] = (string) $attempt['submitted_at'];
        }
    }

    foreach ($events as $event) {
        $number = (int) $event['module_number'];
        if (!isset($modules[$number])) {
            continue;
        }
        if ($event['event_type'] === 'material_acknowledged') {
            $modules[$number]['acknowledged'] = true;
        } elseif ($event['event_type'] === 'practice_attested') {
            $modules[$number]['practiceAttested'] = true;
        } elseif ($event['event_type'] === 'practice_unattested') {
            $modules[$number]['practiceAttested'] = false;
        } elseif ($event['event_type'] === 'study_time_increment') {
            $modules[$number]['studyMinutes'] += (int) $event['amount'];
        }
        $modules[$number]['updatedAt'] = max((string) $modules[$number]['updatedAt'], (string) $event['created_at']);
    }

    foreach ($modules as $number => &$module) {
        $legacy = $legacyRows[$number] ?? null;
        $module['legacy'] = $legacy === null ? null : [
            'completed' => (bool) (int) $legacy['completed'],
            'quizScore' => $legacy['quiz_score'] === null ? null : (int) $legacy['quiz_score'],
            'quizTotal' => $legacy['quiz_total'] === null ? null : (int) $legacy['quiz_total'],
            'practicalDone' => (bool) (int) $legacy['practical_done'],
            'timeSpentMinutes' => $legacy['time_spent_minutes'] === null ? null : (int) $legacy['time_spent_minutes'],
        ];
        // A quiz module completes only on a passed, submitted attempt. A no-quiz module
        // completes on an accepted acknowledgement. Practice never gates completion.
        $module['academicCompleted'] = $module['hasQuiz'] ? $module['quizPassed'] : ($module['acknowledged'] && $number > 0);
        if ($number === 0) {
            $module['academicCompleted'] = false;
        }
        if ($module['academicCompleted']) {
            $status = 'completed_verified';
        } elseif ($module['legacy'] !== null && $module['legacy']['completed']) {
            $status = 'legacy_unverified';
        } elseif ($module['failedAttempts'] > 0) {
            $status = 'quiz_failed';
        } elseif ($module['activeAttemptId'] !== null || $module['acknowledged'] || $module['quizAttempted'] || $module['practiceAttested'] || $module['studyMinutes'] > 0) {
            $status = 'in_progress';
        } else {
            $status = 'not_started';
        }
        $module['completionStatus'] = $status;
        $module['hasLegacyRecord'] = $legacy !== null;
    }
    unset($module);

    $missing = [];
    $verified = 0;
    foreach ($policy['required'] as $number) {
        if (!isset($catalog[$number])) {
            $missing[] = $number;
            continue;
        }
        if ($modules[$number]['academicCompleted'] ?? false) {
            $verified++;
        } else {
            $missing[] = $number;
        }
    }
    $finalAvailable = ($quizCounts[0] ?? 0) > 0;
    $eligible = $missing === [] && $finalAvailable;
    $reason = $eligible ? 'eligible' : ($finalAvailable ? 'requirements_incomplete' : 'final_unavailable');

    $finalAttempts = array_values(array_filter($attempts, static function (array $attempt): bool {
        return $attempt['assessment_type'] === 'final_exam';
    }));
    $finalAttempts = array_map(static function (array $attempt) use ($now, $pdo): array {
        return aapm_expire_if_due_snapshot($attempt, $now);
    }, $finalAttempts);
    $active = null;
    $passed = false;
    $lastSubmittedFailed = false;
    foreach ($finalAttempts as $attempt) {
        // Status follows the active generation. Earlier tries remain evidence,
        // and never impose a waiting period on the learner.
        $isCurrent = (int) ($attempt['academic_generation'] ?? 1) === $generation;
        if ($isCurrent && $attempt['status'] === 'in_progress') {
            $active = $attempt;
        }
        if ($isCurrent && $attempt['status'] === 'submitted') {
            if ((int) $attempt['passed'] === 1) {
                $passed = true;
            }
            $lastSubmittedFailed = (int) $attempt['passed'] !== 1;
        }
    }

    if ($passed) {
        $finalStatus = 'passed';
    } elseif ($active !== null) {
        $finalStatus = 'in_progress';
    } elseif ($lastSubmittedFailed) {
        $finalStatus = 'failed';
    } elseif ($eligible) {
        $finalStatus = 'eligible';
    } else {
        $finalStatus = 'locked';
    }

    return [
        'generation' => $generation,
        'policy' => $policy,
        'modules' => $modules,
        'eligibility' => [
            'eligible' => $eligible,
            'policyVersion' => $policy['version'],
            'requiredCount' => count($policy['required']),
            'verifiedCompletedCount' => $verified,
            'missingModuleNumbers' => $missing,
            'reason' => $reason,
        ],
        'final' => [
            'status' => $finalStatus,
            'attemptsRemaining' => null,
            'nextEligibleAt' => null,
            'activeAttemptId' => $active !== null ? (string) $active['public_id'] : null,
        ],
    ];
}

/** Read-only expiry for snapshots. The write path persists the same transition. */
function aapm_expire_if_due_snapshot(array $attempt, string $now): array
{
    if ($attempt['status'] === 'in_progress' && (string) $attempt['expires_at'] <= $now) {
        $attempt['status'] = 'expired';
    }

    return $attempt;
}

function aapm_final_eligibility_payload(PDO $pdo, int $userId): array
{
    $snapshot = aapm_academic_snapshot($pdo, $userId);

    return array_merge($snapshot['eligibility'], [
        'finalStatus' => $snapshot['final']['status'],
        'attemptsRemaining' => $snapshot['final']['attemptsRemaining'],
        'nextEligibleAt' => $snapshot['final']['nextEligibleAt'],
        'activeAttemptId' => $snapshot['final']['activeAttemptId'],
        'attemptLimit' => null,
        'attemptWindowHours' => null,
        'retriesUnlimited' => true,
    ]);
}

/**
 * POST /api/assessments/attempts. Idempotent per request key; resumes an active
 * attempt without creating another; enforces certificate preparation prerequisites.
 *
 * @return array{attempt:array,created:bool}
 */
function aapm_assessment_start(array $user, array $input): array
{
    $userId = (int) $user['id'];
    $type = (string) ($input['assessmentType'] ?? '');
    $moduleNumber = $input['moduleNumber'] ?? null;
    $requestKey = $input['requestKey'] ?? null;
    if (!in_array($type, ['module_quiz', 'final_exam'], true) || !is_int($moduleNumber) && !ctype_digit((string) $moduleNumber)) {
        aapm_assessment_fail(422, 'validation_error', 'Jenis atau nomor modul tidak valid.');
    }
    $moduleNumber = (int) $moduleNumber;
    if (!aapm_assessment_valid_key($requestKey)) {
        aapm_assessment_fail(422, 'validation_error', 'Kunci permintaan tidak valid.');
    }
    if (($type === 'module_quiz' && $moduleNumber < 1) || ($type === 'final_exam' && $moduleNumber !== 0)) {
        aapm_assessment_fail(422, 'validation_error', 'Nomor modul tidak sesuai dengan jenis ujian.');
    }

    $pdo = db();
    aapm_tx_begin($pdo);
    try {
        aapm_assessment_user_lock($pdo, $userId);
        // A publisher and a new final attempt share this lock. Snapshot selection
        // therefore sees one complete publication; existing attempts keep their items.
        if ($type === 'final_exam') {
            aapm_cur_final_bank_locked($pdo, null);
        }
        $generation = aapm_current_generation($pdo, $userId);

        $same = $pdo->prepare('SELECT * FROM assessment_attempts WHERE user_id = ? AND start_request_key = ? LIMIT 1');
        $same->execute([$userId, (string) $requestKey]);
        $existing = $same->fetch();
        if ($existing) {
            if ((int) ($existing['academic_generation'] ?? 1) !== $generation) {
                aapm_tx_rollback($pdo);
                aapm_assessment_fail(409, 'attempt_superseded', 'Ujian ini berasal dari siklus belajar sebelumnya. Mulai ujian baru.');
            }
            $existing = aapm_expire_if_due($pdo, $existing);
            aapm_tx_commit($pdo);

            return ['attempt' => aapm_attempt_view($pdo, $existing), 'created' => false];
        }

        $active = $pdo->prepare("SELECT * FROM assessment_attempts WHERE user_id = ? AND assessment_type = ? AND module_number = ? AND status = 'in_progress' AND academic_generation = ? ORDER BY id DESC LIMIT 1");
        $active->execute([$userId, $type, $moduleNumber, $generation]);
        $activeRow = $active->fetch();
        if ($activeRow) {
            $activeRow = aapm_expire_if_due($pdo, $activeRow);
            if ($activeRow['status'] === 'in_progress') {
                aapm_tx_commit($pdo);

                return ['attempt' => aapm_attempt_view($pdo, $activeRow), 'created' => false];
            }
        }

        $catalog = aapm_module_catalog($pdo, $userId);
        $quizCounts = aapm_quiz_counts($pdo);
        $policy = aapm_assessment_policy($pdo, aapm_learner_policy_version($pdo, $userId));

        if ($type === 'module_quiz' && !isset($catalog[$moduleNumber])) {
            aapm_tx_rollback($pdo);
            aapm_assessment_fail(404, 'assessment_not_found', 'Modul tidak ditemukan.');
        }
        if ($type === 'module_quiz' && $catalog[$moduleNumber]['assessmentMode'] !== 'quiz') {
            aapm_tx_rollback($pdo);
            aapm_assessment_fail(409, 'assessment_unavailable', 'Kebijakan Anda menggunakan konfirmasi belajar untuk modul ini.');
        }
        if (($quizCounts[$moduleNumber] ?? 0) < 1) {
            aapm_tx_rollback($pdo);
            aapm_assessment_fail(409, 'assessment_unavailable', 'Ujian untuk modul ini belum tersedia.');
        }

        if ($type === 'final_exam') {
            $snapshot = aapm_academic_snapshot($pdo, $userId);
            if (!$snapshot['eligibility']['eligible']) {
                aapm_tx_rollback($pdo);
                aapm_assessment_fail(409, 'final_prerequisites_unmet', 'Selesaikan semua modul wajib untuk membuka ujian akhir.', [
                    'missingModuleNumbers' => $snapshot['eligibility']['missingModuleNumbers'],
                    'reason' => $snapshot['eligibility']['reason'],
                ]);
            }
        }

        $questions = $pdo->prepare('SELECT * FROM quiz_questions WHERE module_number = ? ORDER BY id ASC');
        $questions->execute([$moduleNumber]);
        $rows = $questions->fetchAll();
        if ($rows === []) {
            aapm_tx_rollback($pdo);
            aapm_assessment_fail(409, 'assessment_unavailable', 'Ujian untuk modul ini belum tersedia.');
        }

        $now = aapm_utc_now();
        $publicId = bin2hex(random_bytes(24));
        $passing = $type === 'final_exam' ? $policy['finalPass'] : $policy['modulePass'];
        $pdo->prepare('INSERT INTO assessment_attempts (public_id, user_id, assessment_type, module_number, policy_version, passing_grade, status, total_questions, started_at, expires_at, start_request_key, created_at, updated_at, academic_generation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([
                $publicId,
                $userId,
                $type,
                $moduleNumber,
                $policy['version'],
                $passing,
                'in_progress',
                count($rows),
                $now,
                aapm_utc_later(AAPM_ATTEMPT_TTL_SECONDS),
                (string) $requestKey,
                $now,
                $now,
                $generation,
            ]);
        $attemptId = (int) $pdo->lastInsertId();
        $insertItem = $pdo->prepare('INSERT INTO assessment_attempt_items (attempt_id, ordinal, source_question_id, question_snapshot_json) VALUES (?, ?, ?, ?)');
        foreach ($rows as $index => $row) {
            $insertItem->execute([
                $attemptId,
                $index + 1,
                (int) $row['id'],
                json_encode(aapm_question_snapshot($row), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ]);
        }
        $created = $pdo->prepare('SELECT * FROM assessment_attempts WHERE id = ? LIMIT 1');
        $created->execute([$attemptId]);
        $attempt = $created->fetch();
        aapm_tx_commit($pdo);

        return ['attempt' => aapm_attempt_view($pdo, $attempt), 'created' => true];
    } catch (PDOException $exception) {
        aapm_tx_rollback($pdo);
        // A concurrent identical request inserted the same request key first.
        if (strpos(strtolower($exception->getMessage()), 'unique') !== false || strpos(strtolower($exception->getMessage()), 'duplicate') !== false) {
            return aapm_assessment_start($user, $input);
        }
        throw $exception;
    } catch (Throwable $exception) {
        aapm_tx_rollback($pdo);
        throw $exception;
    }
}

function aapm_assessment_read(array $user, string $publicId): array
{
    $pdo = db();
    $attempt = aapm_attempt_row($pdo, (int) $user['id'], $publicId);
    if (!$attempt) {
        aapm_assessment_fail(404, 'assessment_not_found', 'Ujian tidak ditemukan.');
    }
    $attempt = aapm_expire_if_due_snapshot($attempt, aapm_utc_now());

    return aapm_attempt_view($pdo, $attempt);
}

/**
 * Records one answer. For module quizzes this is Periksa: the answer is graded,
 * locked, and its feedback is released. For the final exam it is only a saved selection.
 */
function aapm_assessment_answer(array $user, string $publicId, array $input): array
{
    $userId = (int) $user['id'];
    $questionId = $input['questionId'] ?? null;
    $answerIndex = $input['answerIndex'] ?? null;
    if (!is_int($questionId) && !ctype_digit((string) $questionId) || (int) $questionId < 1) {
        aapm_assessment_fail(422, 'validation_error', 'Pertanyaan tidak valid.');
    }
    if (!is_int($answerIndex) && !ctype_digit((string) $answerIndex)) {
        aapm_assessment_fail(422, 'validation_error', 'Pilihan jawaban tidak valid.');
    }
    $questionId = (int) $questionId;
    $answerIndex = (int) $answerIndex;

    $pdo = db();
    aapm_tx_begin($pdo);
    try {
        aapm_assessment_user_lock($pdo, $userId);
        $attempt = aapm_attempt_row($pdo, $userId, $publicId);
        if (!$attempt) {
            aapm_tx_rollback($pdo);
            aapm_assessment_fail(404, 'assessment_not_found', 'Ujian tidak ditemukan.');
        }
        if ($attempt['status'] !== 'submitted' && aapm_attempt_superseded($pdo, $userId, $attempt)) {
            aapm_tx_rollback($pdo);
            aapm_assessment_fail(409, 'attempt_superseded', 'Ujian ini berasal dari siklus belajar sebelumnya. Mulai ujian baru.');
        }
        $attempt = aapm_expire_if_due($pdo, $attempt);
        if ($attempt['status'] === 'submitted') {
            aapm_tx_rollback($pdo);
            aapm_assessment_fail(409, 'attempt_already_submitted', 'Ujian ini sudah dikirim.');
        }
        if ($attempt['status'] !== 'in_progress') {
            aapm_tx_rollback($pdo);
            aapm_assessment_fail(409, 'attempt_expired', 'Waktu ujian ini sudah habis. Mulai ujian baru.');
        }

        $itemStatement = $pdo->prepare('SELECT * FROM assessment_attempt_items WHERE id = ? AND attempt_id = ? LIMIT 1');
        $itemStatement->execute([$questionId, (int) $attempt['id']]);
        $item = $itemStatement->fetch();
        if (!$item) {
            aapm_tx_rollback($pdo);
            aapm_assessment_fail(422, 'question_not_in_attempt', 'Pertanyaan tidak termasuk dalam ujian ini.');
        }
        $snapshot = json_decode((string) $item['question_snapshot_json'], true);
        if ($answerIndex < 0 || $answerIndex >= count($snapshot['options'])) {
            aapm_tx_rollback($pdo);
            aapm_assessment_fail(422, 'validation_error', 'Pilihan jawaban tidak tersedia.');
        }

        if ($attempt['assessment_type'] === 'module_quiz') {
            if ($item['checked_at'] !== null) {
                if ((int) $item['answer_index'] !== $answerIndex) {
                    aapm_tx_rollback($pdo);
                    aapm_assessment_fail(409, 'answer_locked', 'Jawaban yang sudah diperiksa tidak dapat diubah.');
                }
                // Repeating the same checked answer returns the same feedback.
                aapm_tx_commit($pdo);

                return [
                    'questionId' => $questionId,
                    'selectedIndex' => $answerIndex,
                    'checked' => true,
                    'feedback' => aapm_checked_feedback($snapshot, $answerIndex),
                ];
            }
            $now = aapm_utc_now();
            $update = $pdo->prepare('UPDATE assessment_attempt_items SET answer_index = ?, answered_at = ?, checked_at = ? WHERE id = ? AND checked_at IS NULL');
            $update->execute([$answerIndex, $now, $now, $questionId]);
            if ($update->rowCount() !== 1) {
                aapm_tx_rollback($pdo);
                aapm_assessment_fail(409, 'answer_locked', 'Jawaban yang sudah diperiksa tidak dapat diubah.');
            }
            aapm_tx_commit($pdo);

            return [
                'questionId' => $questionId,
                'selectedIndex' => $answerIndex,
                'checked' => true,
                'feedback' => aapm_checked_feedback($snapshot, $answerIndex),
            ];
        }

        // Final exam: the selection may change until submission, and nothing is revealed.
        $now = aapm_utc_now();
        $pdo->prepare('UPDATE assessment_attempt_items SET answer_index = ?, answered_at = ? WHERE id = ?')
            ->execute([$answerIndex, $now, $questionId]);
        aapm_tx_commit($pdo);

        return ['questionId' => $questionId, 'selectedIndex' => $answerIndex, 'saved' => true];
    } catch (Throwable $exception) {
        aapm_tx_rollback($pdo);
        throw $exception;
    }
}

/**
 * Submits an attempt. Idempotent: a repeated submit returns the committed result.
 * Grading and the academic consequence commit together with the status change.
 */
function aapm_assessment_submit(array $user, string $publicId, array $input): array
{
    $userId = (int) $user['id'];
    if (!aapm_assessment_valid_key($input['requestKey'] ?? null)) {
        aapm_assessment_fail(422, 'validation_error', 'Kunci permintaan kirim tidak valid.');
    }

    $pdo = db();
    aapm_tx_begin($pdo);
    try {
        aapm_assessment_user_lock($pdo, $userId);
        $attempt = aapm_attempt_row($pdo, $userId, $publicId);
        if (!$attempt) {
            aapm_tx_rollback($pdo);
            aapm_assessment_fail(404, 'assessment_not_found', 'Ujian tidak ditemukan.');
        }
        if ($attempt['status'] === 'submitted') {
            aapm_tx_commit($pdo);

            return aapm_attempt_view($pdo, $attempt);
        }
        if (aapm_attempt_superseded($pdo, $userId, $attempt)) {
            aapm_tx_rollback($pdo);
            aapm_assessment_fail(409, 'attempt_superseded', 'Ujian ini berasal dari siklus belajar sebelumnya. Mulai ujian baru.');
        }
        $attempt = aapm_expire_if_due($pdo, $attempt);
        if ($attempt['status'] !== 'in_progress') {
            aapm_tx_rollback($pdo);
            aapm_assessment_fail(409, 'attempt_expired', 'Waktu ujian ini sudah habis. Mulai ujian baru.');
        }

        $items = aapm_attempt_items($pdo, (int) $attempt['id']);
        $missing = [];
        foreach ($items as $item) {
            $complete = $item['answer_index'] !== null && ($attempt['assessment_type'] === 'final_exam' || $item['checked_at'] !== null);
            if (!$complete) {
                $missing[] = (int) $item['ordinal'];
            }
        }
        if ($missing !== []) {
            aapm_tx_rollback($pdo);
            aapm_assessment_fail(422, 'incomplete_answers', 'Semua pertanyaan harus dijawab sebelum ujian dikirim.', [
                'missingOrdinals' => $missing,
            ]);
        }

        $grade = aapm_grade($items, (int) $attempt['passing_grade']);
        $now = aapm_utc_now();
        $update = $pdo->prepare("UPDATE assessment_attempts SET status = 'submitted', correct_answers = ?, score_percent = ?, passed = ?, submitted_at = ?, updated_at = ? WHERE id = ? AND status = 'in_progress'");
        $update->execute([$grade['correct'], $grade['scorePercent'], $grade['passed'] ? 1 : 0, $now, $now, (int) $attempt['id']]);
        if ($update->rowCount() !== 1) {
            aapm_tx_rollback($pdo);
            aapm_assessment_fail(409, 'attempt_already_submitted', 'Ujian ini sudah dikirim.');
        }
        aapm_tx_commit($pdo);

        $fresh = aapm_attempt_row($pdo, $userId, $publicId);

        return aapm_attempt_view($pdo, $fresh);
    } catch (Throwable $exception) {
        aapm_tx_rollback($pdo);
        throw $exception;
    }
}

function aapm_assessment_history(array $user, array $query): array
{
    $pdo = db();
    $where = ['user_id = ?'];
    $params = [(int) $user['id']];
    if (in_array($query['assessmentType'] ?? '', ['module_quiz', 'final_exam'], true)) {
        $where[] = 'assessment_type = ?';
        $params[] = (string) $query['assessmentType'];
    }
    if (isset($query['moduleNumber']) && ctype_digit((string) $query['moduleNumber'])) {
        $where[] = 'module_number = ?';
        $params[] = (int) $query['moduleNumber'];
    }
    $limit = max(1, min(100, (int) ($query['limit'] ?? 50)));
    $offset = max(0, (int) ($query['offset'] ?? 0));
    $statement = $pdo->prepare('SELECT * FROM assessment_attempts WHERE ' . implode(' AND ', $where) . ' ORDER BY id DESC LIMIT ' . $limit . ' OFFSET ' . $offset);
    $statement->execute($params);

    return array_map(static function (array $row): array {
        return [
            'id' => (string) $row['public_id'],
            'assessmentType' => (string) $row['assessment_type'],
            'moduleNumber' => (int) $row['module_number'],
            'status' => (string) $row['status'],
            'passed' => $row['passed'] === null ? null : (bool) (int) $row['passed'],
            'scorePercent' => $row['score_percent'] === null ? null : (int) $row['score_percent'],
            'correctAnswers' => $row['correct_answers'] === null ? null : (int) $row['correct_answers'],
            'totalQuestions' => (int) $row['total_questions'],
            'startedAt' => (string) $row['started_at'],
            'submittedAt' => $row['submitted_at'],
            'generation' => (int) ($row['academic_generation'] ?? 1),
        ];
    }, $statement->fetchAll());
}

/** Material acknowledgement: completes a no-quiz module; for a quiz module it is only a record. */
function aapm_acknowledge_module(array $user, int $moduleNumber): array
{
    $pdo = db();
    $userId = (int) $user['id'];
    $catalog = aapm_module_catalog($pdo, $userId);
    if (!isset($catalog[$moduleNumber])) {
        aapm_assessment_fail(404, 'assessment_not_found', 'Modul tidak ditemukan.');
    }
    aapm_tx_begin($pdo);
    try {
        aapm_assessment_user_lock($pdo, $userId);
        $generation = aapm_current_generation($pdo, $userId);
        $pdo->prepare('INSERT INTO module_learning_events (user_id, module_number, event_type, idempotency_key, amount, created_at, academic_generation) VALUES (?, ?, ?, ?, 0, ?, ?)')
            ->execute([$userId, $moduleNumber, 'material_acknowledged', 'ack-' . $moduleNumber . ($generation > 1 ? '-g' . $generation : ''), aapm_utc_now(), $generation]);
        aapm_tx_commit($pdo);
    } catch (PDOException $exception) {
        aapm_tx_rollback($pdo);
        // Repeated acknowledgement is idempotent.
        if (strpos(strtolower($exception->getMessage()), 'unique') === false && strpos(strtolower($exception->getMessage()), 'duplicate') === false) {
            throw $exception;
        }
    }

    return aapm_progress_row($pdo, $userId, $moduleNumber);
}

function aapm_record_module_event(array $user, int $moduleNumber, string $eventType, array $input): array
{
    $forbidden = array_values(array_intersect(array_keys($input), ['timeSpentMinutes', 'totalMinutes', 'total', 'timeSpentDeltaMinutes', 'completed', 'quizScore', 'quizTotal', 'passed', 'score', 'practicalDone']));
    if ($forbidden !== []) {
        aapm_assessment_fail(422, 'academic_field_forbidden', 'Nilai akademik atau total waktu tidak dapat dikirim dari klien.', ['fields' => $forbidden]);
    }
    $pdo = db();
    $userId = (int) $user['id'];
    $catalog = aapm_module_catalog($pdo, $userId);
    if (!isset($catalog[$moduleNumber])) {
        aapm_assessment_fail(404, 'assessment_not_found', 'Modul tidak ditemukan.');
    }
    if (!aapm_assessment_valid_key($input['requestKey'] ?? null)) {
        aapm_assessment_fail(422, 'validation_error', 'Kunci permintaan tidak valid.');
    }
    $amount = 0;
    if ($eventType === 'study_time_increment') {
        $minutes = $input['minutes'] ?? null;
        if ((!is_int($minutes) && !ctype_digit((string) $minutes)) || (int) $minutes < 1 || (int) $minutes > AAPM_STUDY_INCREMENT_MAX_MINUTES) {
            aapm_assessment_fail(422, 'study_increment_invalid', 'Tambahan waktu belajar harus 1 sampai 15 menit.');
        }
        $amount = (int) $minutes;
    }
    aapm_tx_begin($pdo);
    try {
        aapm_assessment_user_lock($pdo, $userId);
        $generation = aapm_current_generation($pdo, $userId);
        $pdo->prepare('INSERT INTO module_learning_events (user_id, module_number, event_type, idempotency_key, amount, created_at, academic_generation) VALUES (?, ?, ?, ?, ?, ?, ?)')
            ->execute([$userId, $moduleNumber, $eventType, (string) $input['requestKey'], $amount, aapm_utc_now(), $generation]);
        aapm_tx_commit($pdo);
    } catch (PDOException $exception) {
        aapm_tx_rollback($pdo);
        // A replayed request is accepted once and never double-counted.
        if (strpos(strtolower($exception->getMessage()), 'unique') === false && strpos(strtolower($exception->getMessage()), 'duplicate') === false) {
            throw $exception;
        }
    }

    return aapm_progress_row($pdo, $userId, $moduleNumber);
}

/** Frontend-compatible progress row, derived from the snapshot. Legacy values are labeled separately. */
function aapm_progress_shape(array $module): array
{
    $legacy = $module['legacy'];

    return [
        'moduleNumber' => $module['moduleNumber'],
        'completed' => $module['academicCompleted'],
        'completionStatus' => $module['completionStatus'],
        'quizScore' => $module['bestCorrect'],
        'quizTotal' => $module['bestTotal'],
        'quizPercent' => $module['bestPercent'],
        'quizAttempted' => $module['quizAttempted'],
        'quizPassed' => $module['quizPassed'],
        'acknowledged' => $module['acknowledged'],
        'hasQuiz' => $module['hasQuiz'],
        'practicalDone' => $module['practiceAttested'],
        'timeSpentMinutes' => ($legacy['timeSpentMinutes'] ?? 0) + $module['studyMinutes'],
        'studyMinutes' => $module['studyMinutes'],
        'legacyCompleted' => $legacy['completed'] ?? false,
        'legacyQuizScore' => $legacy['quizScore'] ?? null,
        'legacyQuizTotal' => $legacy['quizTotal'] ?? null,
        'legacyPracticalDone' => $legacy['practicalDone'] ?? false,
        'legacyTimeSpentMinutes' => $legacy['timeSpentMinutes'] ?? null,
        'hasLegacyRecord' => $module['hasLegacyRecord'],
        'verificationStatus' => $module['academicCompleted'] ? 'verified' : ($module['hasLegacyRecord'] && ($legacy['completed'] ?? false) ? 'legacy_unverified' : 'none'),
        'updatedAt' => $module['updatedAt'],
    ];
}

function aapm_progress_row(PDO $pdo, int $userId, int $moduleNumber): array
{
    $snapshot = aapm_academic_snapshot($pdo, $userId);

    return aapm_progress_shape($snapshot['modules'][$moduleNumber]);
}

/** GET /api/progress: every module with any recorded evidence, derived server-side. */
function aapm_progress_rows(array $user): array
{
    $pdo = db();
    $snapshot = aapm_academic_snapshot($pdo, (int) $user['id']);
    $rows = [];
    foreach ($snapshot['modules'] as $module) {
        $hasRecord = $module['hasLegacyRecord'] || $module['quizAttempted'] || $module['acknowledged'] || $module['practiceAttested'] || $module['studyMinutes'] > 0 || $module['activeAttemptId'] !== null;
        if ($hasRecord) {
            $rows[] = aapm_progress_shape($module);
        }
    }

    return $rows;
}

/**
 * Per-learner totals for admin lists and the overview. Each entry is folded
 * from the same academic snapshot the learner sees, so a historical row counts
 * only as legacy minutes, never as completion.
 *
 * @param list<int> $userIds
 * @return array<int, array<string, mixed>>
 */
function aapm_learner_progress_aggregates(PDO $pdo, array $userIds): array
{
    $totals = [];
    foreach (array_values(array_unique(array_map('intval', $userIds))) as $userId) {
        $totals[$userId] = aapm_learner_progress_totals(aapm_academic_snapshot($pdo, $userId));
    }

    return $totals;
}

/** Folds one learner snapshot into the admin columns. Module 0 is the final exam, not a curriculum module. */
function aapm_learner_progress_totals(array $snapshot): array
{
    $totals = [
        'progress_entries' => 0,
        'completed_modules' => 0,
        'practical_modules' => 0,
        'quiz_score_sum' => 0,
        'quiz_total_sum' => 0,
        'minutes' => 0,
        'last_activity' => null,
        'completions' => [],
    ];
    foreach ($snapshot['modules'] as $number => $module) {
        if ($number === 0 || $module['title'] === null) {
            continue;
        }
        $hasRecord = $module['hasLegacyRecord'] || $module['quizAttempted'] || $module['acknowledged'] || $module['practiceAttested'] || $module['studyMinutes'] > 0 || $module['activeAttemptId'] !== null;
        if ($hasRecord) {
            $totals['progress_entries']++;
        }
        if ($module['academicCompleted']) {
            $totals['completed_modules']++;
            $totals['completions'][] = ['moduleNumber' => $number, 'title' => $module['title'], 'updatedAt' => $module['updatedAt']];
        }
        if ($module['practiceAttested']) {
            $totals['practical_modules']++;
        }
        $bestTotal = (int) ($module['bestTotal'] ?? 0);
        if ($bestTotal > 0) {
            $totals['quiz_total_sum'] += $bestTotal;
            $totals['quiz_score_sum'] += min(max((int) ($module['bestCorrect'] ?? 0), 0), $bestTotal);
        }
        $totals['minutes'] += (int) ($module['legacy']['timeSpentMinutes'] ?? 0) + (int) $module['studyMinutes'];
        if ($module['updatedAt'] !== null && (string) $module['updatedAt'] > (string) $totals['last_activity']) {
            $totals['last_activity'] = (string) $module['updatedAt'];
        }
    }

    return $totals;
}

/** Learner evidence for one module across legacy rows, attempts, and events. */
function aapm_module_evidence_count(PDO $pdo, int $moduleNumber): int
{
    $count = 0;
    foreach ([
        'SELECT COUNT(*) FROM user_progress WHERE module_number = ?',
        'SELECT COUNT(*) FROM assessment_attempts WHERE module_number = ?',
        'SELECT COUNT(*) FROM module_learning_events WHERE module_number = ?',
    ] as $sql) {
        $statement = $pdo->prepare($sql);
        $statement->execute([$moduleNumber]);
        $count += (int) $statement->fetchColumn();
    }

    return $count;
}

/**
 * Academic history for one module: attempts, learning events, and certificate evidence.
 * A module with any of these can never be hard-deleted.
 */
function aapm_module_academic_history_count(PDO $pdo, int $moduleNumber): int
{
    $queries = [
        'SELECT COUNT(*) FROM assessment_attempts WHERE module_number = ?',
        'SELECT COUNT(*) FROM module_learning_events WHERE module_number = ?',
    ];
    if (aapm_table_exists($pdo, 'certificate_evidence')) {
        $queries[] = 'SELECT COUNT(*) FROM certificate_evidence WHERE module_number = ?';
    }
    $count = 0;
    foreach ($queries as $sql) {
        $statement = $pdo->prepare($sql);
        $statement->execute([$moduleNumber]);
        $count += (int) $statement->fetchColumn();
    }

    return $count;
}

/**
 * Removes only the historical imported rows of a module that has no academic history.
 * Their values stay in legacy_progress_snapshots. The caller owns the transaction.
 */
function aapm_delete_module_evidence(PDO $pdo, int $moduleNumber): void
{
    $pdo->prepare('DELETE FROM user_progress WHERE module_number = ?')->execute([$moduleNumber]);
}

/** Every attempt across all generations, for authorized historical reporting. */
function aapm_admin_assessment_history(PDO $pdo, int $userId): array
{
    $statement = $pdo->prepare('SELECT * FROM assessment_attempts WHERE user_id = ? ORDER BY id DESC LIMIT 500');
    $statement->execute([$userId]);

    return [
        'currentGeneration' => aapm_current_generation($pdo, $userId),
        'attempts' => array_map(static function (array $row): array {
            return [
                'id' => (string) $row['public_id'],
                'generation' => (int) ($row['academic_generation'] ?? 1),
                'assessmentType' => (string) $row['assessment_type'],
                'moduleNumber' => (int) $row['module_number'],
                'status' => (string) $row['status'],
                'passed' => $row['passed'] === null ? null : (bool) (int) $row['passed'],
                'scorePercent' => $row['score_percent'] === null ? null : (int) $row['score_percent'],
                'correctAnswers' => $row['correct_answers'] === null ? null : (int) $row['correct_answers'],
                'totalQuestions' => (int) $row['total_questions'],
                'startedAt' => (string) $row['started_at'],
                'submittedAt' => $row['submitted_at'],
            ];
        }, $statement->fetchAll()),
    ];
}

/** Admin view of one learner's modules, with titles, derived from the snapshot. Newest activity first. */
function admin_learner_progress_rows(PDO $pdo, int $userId): array
{
    $modules = [];
    foreach ($pdo->query('SELECT module_number, title, level_number, level_name FROM course_modules')->fetchAll() as $row) {
        $modules[(int) $row['module_number']] = $row;
    }
    $rows = [];
    foreach (aapm_progress_rows(['id' => $userId]) as $progress) {
        $number = (int) $progress['moduleNumber'];
        if (!isset($modules[$number])) {
            continue;
        }
        $rows[] = [
            'module_number' => $number,
            'module_title' => $modules[$number]['title'],
            'level_number' => $modules[$number]['level_number'],
            'level_name' => $modules[$number]['level_name'],
            'completed' => $progress['completed'] ? 1 : 0,
            'quiz_score' => $progress['quizScore'],
            'quiz_total' => $progress['quizTotal'],
            'practical_done' => $progress['practicalDone'] ? 1 : 0,
            'time_spent_minutes' => $progress['timeSpentMinutes'],
            'created_at' => null,
            'updated_at' => $progress['updatedAt'],
        ];
    }
    usort($rows, static fn (array $a, array $b): int => [(string) $b['updated_at'], $b['module_number']] <=> [(string) $a['updated_at'], $a['module_number']]);

    return $rows;
}

/** Newest verified module completions across learners, for the admin overview. */
function admin_recent_completions(PDO $pdo, int $limit): array
{
    $byId = [];
    foreach ($pdo->query('SELECT id, full_name, email, role, email_verified_at, verification_required_at, auth_version FROM users')->fetchAll() as $user) {
        $byId[(int) $user['id']] = $user;
    }
    $candidates = [];
    foreach (aapm_learner_progress_aggregates($pdo, array_keys($byId)) as $userId => $totals) {
        $user = $byId[$userId];
        foreach ($totals['completions'] as $completion) {
            $candidates[] = [
                'user_id' => $userId,
                'full_name' => $user['full_name'],
                'email' => $user['email'],
                'role' => $user['role'],
                'email_verified_at' => $user['email_verified_at'],
                'verification_required_at' => $user['verification_required_at'],
                'auth_version' => $user['auth_version'],
                'module_number' => $completion['moduleNumber'],
                'module_title' => $completion['title'],
                'updated_at' => $completion['updatedAt'],
            ];
        }
    }
    usort($candidates, static fn (array $a, array $b): int => [(string) $b['updated_at'], $b['module_number']] <=> [(string) $a['updated_at'], $a['module_number']]);

    return array_slice($candidates, 0, $limit);
}

/** Retired client-authority writes. Forbidden academic fields are named explicitly; nothing is silently ignored. */
function aapm_reject_progress_write(array $input): void
{
    $forbidden = array_values(array_intersect(array_keys($input), AAPM_FORBIDDEN_PROGRESS_FIELDS));
    if ($forbidden !== []) {
        aapm_assessment_fail(422, 'academic_field_forbidden', 'Nilai akademik tidak dapat dikirim dari klien.', [
            'fields' => $forbidden,
        ]);
    }
    aapm_assessment_fail(410, 'progress_write_retired', 'Penulisan progres langsung sudah tidak tersedia. Gunakan ujian dan aktivitas belajar.');
}

/** Migration support: copy each historical row once. Never overwrites an existing snapshot. */
function aapm_snapshot_legacy_progress(PDO $pdo): int
{
    $copied = 0;
    $rows = $pdo->query('SELECT user_id, module_number, completed, quiz_score, quiz_total, practical_done, time_spent_minutes FROM user_progress')->fetchAll();
    $exists = $pdo->prepare('SELECT COUNT(*) FROM legacy_progress_snapshots WHERE user_id = ? AND module_number = ?');
    $insert = $pdo->prepare('INSERT INTO legacy_progress_snapshots (user_id, module_number, legacy_completed, legacy_quiz_score, legacy_quiz_total, legacy_practical_done, legacy_time_spent_minutes, snapshot_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($rows as $row) {
        $exists->execute([(int) $row['user_id'], (int) $row['module_number']]);
        if ((int) $exists->fetchColumn() > 0) {
            continue;
        }
        $insert->execute([
            (int) $row['user_id'],
            (int) $row['module_number'],
            (int) $row['completed'],
            $row['quiz_score'] === null ? null : (int) $row['quiz_score'],
            $row['quiz_total'] === null ? null : (int) $row['quiz_total'],
            (int) $row['practical_done'],
            $row['time_spent_minutes'] === null ? null : (int) $row['time_spent_minutes'],
            aapm_utc_now(),
        ]);
        $copied++;
    }

    return $copied;
}

/** Read-only structure check for migrate.php verification. */
function aapm_assessment_schema_status(PDO $pdo): array
{
    return [
        'assessment_policies' => aapm_table_exists($pdo, 'assessment_policies'),
        'assessment_attempts' => aapm_table_exists($pdo, 'assessment_attempts'),
        'assessment_attempt_items' => aapm_table_exists($pdo, 'assessment_attempt_items'),
        'module_learning_events' => aapm_table_exists($pdo, 'module_learning_events'),
        'legacy_progress_snapshots' => aapm_table_exists($pdo, 'legacy_progress_snapshots'),
        'policy_academy_v1' => (int) $pdo->query("SELECT COUNT(*) FROM assessment_policies WHERE policy_version = 'academy-v1'")->fetchColumn() === 1,
    ];
}
