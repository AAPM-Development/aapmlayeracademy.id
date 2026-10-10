<?php
declare(strict_types=1);

/**
 * Q04 verified certificates. A certificate is issued only by the server, only from
 * Q03 assessment evidence in the learner's active academic generation, and only
 * to an account with verified email ownership. The browser sends a tier number
 * and an idempotency key; nothing else is trusted.
 *
 * The legacy `certificates` table is never rewritten. Its rows are reported as
 * legacy_unverified and can coexist with an authoritative issuance for the same tier.
 */

const AAPM_CERT_SCHEMA_KEY = '20261020_verified_certificates_v1';
const AAPM_CERT_VERIFY_SOURCE = 'Catatan penerbitan server AAPM Layer Academy';

/** The exact academy-v1 tier mapping. Own modules only; eligibility is cumulative. */
const AAPM_CERT_TIERS_ACADEMY_V1 = [
    1 => ['name' => 'Layer Poultry Farm Foundation', 'modules' => [1, 2, 3], 'final' => false],
    2 => ['name' => 'Layer Farm Operator', 'modules' => [4, 5], 'final' => false],
    3 => ['name' => 'Layer Farm Supervisor', 'modules' => [6, 7, 8, 11, 12, 13, 15, 16, 17], 'final' => false],
    4 => ['name' => 'Layer Farm Manager', 'modules' => [9, 10, 14, 18], 'final' => false],
    5 => ['name' => 'Advanced Layer Farm Management', 'modules' => [19, 20, 21], 'final' => false],
    6 => ['name' => 'Layer Poultry Farm Expert', 'modules' => [22], 'final' => true],
];

function aapm_cert_ddl(string $driver): array
{
    if ($driver === 'sqlite') {
        return [
            'CREATE TABLE IF NOT EXISTS certificate_tier_policies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                policy_version TEXT NOT NULL,
                tier_number INTEGER NOT NULL,
                tier_name TEXT NOT NULL,
                required_modules_json TEXT NOT NULL,
                requires_final INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(policy_version, tier_number)
            )',
            'CREATE TABLE IF NOT EXISTS certificate_issuances (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                public_id TEXT NOT NULL UNIQUE,
                user_id INTEGER NOT NULL,
                tier_number INTEGER NOT NULL,
                tier_name_snapshot TEXT NOT NULL,
                policy_version TEXT NOT NULL,
                academic_generation INTEGER NOT NULL,
                holder_name_snapshot TEXT NOT NULL,
                status TEXT NOT NULL,
                verified_score_percent INTEGER NULL,
                final_attempt_id INTEGER NULL,
                issued_at TEXT NOT NULL,
                revoked_at TEXT NULL,
                revoked_by_user_id INTEGER NULL,
                revocation_reason TEXT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(user_id, policy_version, tier_number),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT
            )',
            'CREATE INDEX IF NOT EXISTS certificate_issuances_status_idx ON certificate_issuances(status, tier_number, issued_at)',
            'CREATE TABLE IF NOT EXISTS certificate_evidence (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                certificate_id INTEGER NOT NULL,
                module_number INTEGER NULL,
                evidence_type TEXT NOT NULL,
                assessment_attempt_id INTEGER NULL,
                learning_event_id INTEGER NULL,
                academic_generation INTEGER NOT NULL,
                policy_version TEXT NOT NULL,
                evidence_snapshot_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(certificate_id) REFERENCES certificate_issuances(id) ON DELETE RESTRICT
            )',
            'CREATE INDEX IF NOT EXISTS certificate_evidence_certificate_idx ON certificate_evidence(certificate_id)',
            'CREATE INDEX IF NOT EXISTS certificate_evidence_module_idx ON certificate_evidence(module_number)',
            'CREATE TABLE IF NOT EXISTS certificate_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                certificate_id INTEGER NOT NULL,
                actor_user_id INTEGER NULL,
                event_type TEXT NOT NULL,
                reason TEXT NULL,
                metadata_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(certificate_id) REFERENCES certificate_issuances(id) ON DELETE RESTRICT
            )',
            'CREATE INDEX IF NOT EXISTS certificate_events_certificate_idx ON certificate_events(certificate_id)',
        ];
    }

    $suffix = ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

    return [
        'CREATE TABLE IF NOT EXISTS certificate_tier_policies (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            policy_version VARCHAR(40) NOT NULL,
            tier_number TINYINT UNSIGNED NOT NULL,
            tier_name VARCHAR(120) NOT NULL,
            required_modules_json TEXT NOT NULL,
            requires_final TINYINT(1) NOT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY certificate_tier_policies_unique (policy_version, tier_number)
        )' . $suffix,
        'CREATE TABLE IF NOT EXISTS certificate_issuances (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            public_id CHAR(32) NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL,
            tier_number TINYINT UNSIGNED NOT NULL,
            tier_name_snapshot VARCHAR(120) NOT NULL,
            policy_version VARCHAR(40) NOT NULL,
            academic_generation INT UNSIGNED NOT NULL,
            holder_name_snapshot VARCHAR(160) NOT NULL,
            status VARCHAR(16) NOT NULL,
            verified_score_percent TINYINT UNSIGNED NULL,
            final_attempt_id BIGINT UNSIGNED NULL,
            issued_at DATETIME NOT NULL,
            revoked_at DATETIME NULL,
            revoked_by_user_id BIGINT UNSIGNED NULL,
            revocation_reason VARCHAR(500) NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY certificate_issuances_public_unique (public_id),
            UNIQUE KEY certificate_issuances_tier_unique (user_id, policy_version, tier_number),
            KEY certificate_issuances_status_idx (status, tier_number, issued_at),
            CONSTRAINT certificate_issuances_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
        )' . $suffix,
        'CREATE TABLE IF NOT EXISTS certificate_evidence (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            certificate_id BIGINT UNSIGNED NOT NULL,
            module_number SMALLINT UNSIGNED NULL,
            evidence_type VARCHAR(40) NOT NULL,
            assessment_attempt_id BIGINT UNSIGNED NULL,
            learning_event_id BIGINT UNSIGNED NULL,
            academic_generation INT UNSIGNED NOT NULL,
            policy_version VARCHAR(40) NOT NULL,
            evidence_snapshot_json TEXT NOT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY certificate_evidence_certificate_idx (certificate_id),
            KEY certificate_evidence_module_idx (module_number),
            CONSTRAINT certificate_evidence_certificate_fk FOREIGN KEY (certificate_id) REFERENCES certificate_issuances(id) ON DELETE RESTRICT
        )' . $suffix,
        'CREATE TABLE IF NOT EXISTS certificate_events (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            certificate_id BIGINT UNSIGNED NOT NULL,
            actor_user_id BIGINT UNSIGNED NULL,
            event_type VARCHAR(40) NOT NULL,
            reason VARCHAR(500) NULL,
            metadata_json TEXT NOT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY certificate_events_certificate_idx (certificate_id),
            CONSTRAINT certificate_events_certificate_fk FOREIGN KEY (certificate_id) REFERENCES certificate_issuances(id) ON DELETE RESTRICT
        )' . $suffix,
    ];
}

/** Additive and idempotent. Runs for fresh and upgraded databases alike. */
function aapm_ensure_certification_schema(PDO $pdo, string $driver): void
{
    static $ready = false;
    if ($ready || !aapm_table_exists($pdo, 'users')) {
        return;
    }
    foreach (aapm_cert_ddl($driver) as $sql) {
        $pdo->exec($sql);
    }
    aapm_cert_seed_policy($pdo);
    $ready = true;
}

/**
 * Installs the academy-v1 tiers. Rows already present are never touched, so an
 * installed policy cannot be silently rewritten; a change needs a new version.
 */
function aapm_cert_seed_policy(PDO $pdo): void
{
    $exists = $pdo->prepare('SELECT COUNT(*) FROM certificate_tier_policies WHERE policy_version = ? AND tier_number = ?');
    $insert = $pdo->prepare('INSERT INTO certificate_tier_policies (policy_version, tier_number, tier_name, required_modules_json, requires_final, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    foreach (AAPM_CERT_TIERS_ACADEMY_V1 as $number => $tier) {
        $exists->execute([AAPM_ASSESSMENT_POLICY_VERSION, $number]);
        if ((int) $exists->fetchColumn() > 0) {
            continue;
        }
        try {
            $insert->execute([AAPM_ASSESSMENT_POLICY_VERSION, $number, $tier['name'], json_encode($tier['modules']), $tier['final'] ? 1 : 0, aapm_utc_now()]);
        } catch (PDOException $exception) {
            // Another request installed the same tier first.
            $exists->execute([AAPM_ASSESSMENT_POLICY_VERSION, $number]);
            if ((int) $exists->fetchColumn() < 1) {
                throw $exception;
            }
        }
    }
}

function aapm_certification_schema_status(PDO $pdo): array
{
    return [
        'certificate_tier_policies' => aapm_table_exists($pdo, 'certificate_tier_policies'),
        'certificate_issuances' => aapm_table_exists($pdo, 'certificate_issuances'),
        'certificate_evidence' => aapm_table_exists($pdo, 'certificate_evidence'),
        'certificate_events' => aapm_table_exists($pdo, 'certificate_events'),
        'learner_academic_state' => aapm_table_exists($pdo, 'learner_academic_state'),
        'attempt_generation_column' => aapm_column_exists($pdo, 'assessment_attempts', 'academic_generation'),
        'event_generation_column' => aapm_column_exists($pdo, 'module_learning_events', 'academic_generation'),
        'tiers_academy_v1' => (int) $pdo->query("SELECT COUNT(*) FROM certificate_tier_policies WHERE policy_version = 'academy-v1'")->fetchColumn() === count(AAPM_CERT_TIERS_ACADEMY_V1),
    ];
}

/**
 * Tier requirements for a policy version, with the cumulative module set:
 * every earlier tier's modules are required too. Computed from stored policy
 * rows, never from numeric ranges.
 *
 * @return array<int, array{name: string, own: list<int>, required: list<int>, requiresFinal: bool}>
 */
function aapm_cert_policy(PDO $pdo, string $version = AAPM_ASSESSMENT_POLICY_VERSION): array
{
    $statement = $pdo->prepare('SELECT tier_number, tier_name, required_modules_json, requires_final FROM certificate_tier_policies WHERE policy_version = ? ORDER BY tier_number ASC');
    $statement->execute([$version]);
    $tiers = [];
    $cumulative = [];
    foreach ($statement->fetchAll() as $row) {
        $own = array_map('intval', json_decode((string) $row['required_modules_json'], true) ?: []);
        $cumulative = array_values(array_unique(array_merge($cumulative, $own)));
        sort($cumulative);
        $tiers[(int) $row['tier_number']] = [
            'name' => (string) $row['tier_name'],
            'own' => $own,
            'required' => $cumulative,
            'requiresFinal' => (int) $row['requires_final'] === 1,
        ];
    }
    if ($tiers === []) {
        throw new RuntimeException('certificate policy missing');
    }

    return $tiers;
}

function aapm_cert_user_row(PDO $pdo, int $userId): array
{
    $statement = $pdo->prepare('SELECT id, email, full_name, role, email_verified_at, verification_required_at FROM users WHERE id = ? LIMIT 1');
    $statement->execute([$userId]);
    $row = $statement->fetch();
    if (!$row) {
        aapm_assessment_fail(404, 'not_found', 'Akun tidak ditemukan.');
    }

    return $row;
}

function aapm_cert_issuance_row(PDO $pdo, int $userId, string $policyVersion, int $tier): ?array
{
    $statement = $pdo->prepare('SELECT * FROM certificate_issuances WHERE user_id = ? AND policy_version = ? AND tier_number = ? LIMIT 1');
    $statement->execute([$userId, $policyVersion, $tier]);

    return $statement->fetch() ?: null;
}

function aapm_cert_verification_url(string $publicId): string
{
    return app_base_url() . '/verify-certificate/' . $publicId;
}

/** Learner-facing shape. The revocation note is private and never included. */
function aapm_cert_present(array $row, int $completedRequired = 0): array
{
    $revoked = (string) $row['status'] === 'revoked';

    return [
        'id' => (string) $row['public_id'],
        'publicId' => (string) $row['public_id'],
        'source' => 'verified',
        'status' => (string) $row['status'],
        'tierNumber' => (int) $row['tier_number'],
        'tierName' => (string) $row['tier_name_snapshot'],
        'levelNumber' => (int) $row['tier_number'],
        'levelName' => (string) $row['tier_name_snapshot'],
        'policyVersion' => (string) $row['policy_version'],
        'holderName' => (string) $row['holder_name_snapshot'],
        'issuedAt' => (string) $row['issued_at'],
        'revokedAt' => $revoked ? $row['revoked_at'] : null,
        'score' => $row['verified_score_percent'] === null ? null : (int) $row['verified_score_percent'],
        'examType' => (int) $row['tier_number'] === 6 ? 'final' : 'tier',
        'completedRequiredModules' => $completedRequired,
        'verificationUrl' => aapm_cert_verification_url((string) $row['public_id']),
    ];
}

function aapm_cert_present_legacy(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'publicId' => null,
        'source' => 'legacy_unverified',
        'status' => 'legacy_unverified',
        'tierNumber' => (int) $row['level_number'],
        'tierName' => $row['level_name'],
        'levelNumber' => (int) $row['level_number'],
        'levelName' => $row['level_name'],
        'policyVersion' => null,
        'holderName' => $row['holder_name'],
        'issuedAt' => $row['issued_at'],
        'revokedAt' => null,
        'score' => (float) $row['score'],
        'examType' => $row['exam_type'],
        'completedRequiredModules' => null,
        'verificationUrl' => null,
    ];
}

/**
 * Eligibility for every tier from the learner's own evidence. One academic
 * snapshot, two indexed reads; it never touches another learner's data.
 */
function aapm_cert_evaluate(PDO $pdo, int $userId): array
{
    $version = aapm_learner_policy_version($pdo, $userId);
    $policy = aapm_cert_policy($pdo, $version);
    $snapshot = aapm_academic_snapshot($pdo, $userId);
    $done = [];
    foreach ($snapshot['modules'] as $number => $module) {
        if ($number > 0 && $module['academicCompleted']) {
            $done[$number] = true;
        }
    }
    $finalPassed = $snapshot['final']['status'] === 'passed';

    $issued = [];
    $statement = $pdo->prepare('SELECT * FROM certificate_issuances WHERE user_id = ? AND policy_version = ?');
    $statement->execute([$userId, $version]);
    foreach ($statement->fetchAll() as $row) {
        $issued[(int) $row['tier_number']] = $row;
    }
    $legacy = [];
    $legacyStatement = $pdo->prepare('SELECT * FROM certificates WHERE user_id = ? ORDER BY level_number ASC, issued_at ASC');
    $legacyStatement->execute([$userId]);
    foreach ($legacyStatement->fetchAll() as $row) {
        $legacy[(int) $row['level_number']][] = aapm_cert_present_legacy($row);
    }

    $tiers = [];
    foreach ($policy as $number => $tier) {
        $missing = array_values(array_filter($tier['required'], static fn (int $module): bool => !isset($done[$module])));
        $completed = count($tier['required']) - count($missing);
        $finalMissing = $tier['requiresFinal'] && !$finalPassed;
        $requirementsMet = $missing === [] && !$finalMissing;
        if (isset($issued[$number])) {
            $status = (string) $issued[$number]['status'] === 'revoked' ? 'revoked' : 'issued';
        } elseif ($requirementsMet) {
            $status = 'eligible';
        } elseif ($completed > 0 || ($tier['requiresFinal'] && $finalPassed)) {
            $status = 'in_progress';
        } else {
            $status = 'locked';
        }
        $tiers[$number] = [
            'tierNumber' => $number,
            'tierName' => $tier['name'],
            'policyVersion' => $version,
            'status' => $status,
            'requirementsMet' => $requirementsMet,
            'requiredModules' => $tier['required'],
            'completedRequiredModules' => $completed,
            'totalRequiredModules' => count($tier['required']),
            'missingModuleNumbers' => $missing,
            'requiresFinal' => $tier['requiresFinal'],
            'finalPassed' => $tier['requiresFinal'] ? $finalPassed : null,
            'issuance' => $issued[$number] ?? null,
            'legacyRecords' => $legacy[$number] ?? [],
        ];
    }

    return ['tiers' => $tiers, 'generation' => (int) $snapshot['generation']];
}

/** GET /api/certification/eligibility */
function aapm_certification_eligibility(array $user): array
{
    $pdo = db();
    $userId = (int) $user['id'];
    $account = aapm_cert_user_row($pdo, $userId);
    $verified = aapm_verification_status($account) === 'verified';
    $evaluation = aapm_cert_evaluate($pdo, $userId);

    $tiers = [];
    foreach ($evaluation['tiers'] as $tier) {
        $tiers[] = [
            'tierNumber' => $tier['tierNumber'],
            'tierName' => $tier['tierName'],
            'policyVersion' => $tier['policyVersion'],
            'status' => $tier['status'],
            'completedRequiredModules' => $tier['completedRequiredModules'],
            'totalRequiredModules' => $tier['totalRequiredModules'],
            'missingModuleNumbers' => $tier['missingModuleNumbers'],
            'requiresFinal' => $tier['requiresFinal'],
            'finalPassed' => $tier['finalPassed'],
            'emailVerificationRequired' => !$verified,
            'existingCertificate' => $tier['issuance'] ? aapm_cert_present($tier['issuance'], $tier['totalRequiredModules']) : null,
            'legacyRecords' => $tier['legacyRecords'],
        ];
    }

    return ['policyVersion' => aapm_learner_policy_version($pdo, $userId), 'emailVerified' => $verified, 'tiers' => $tiers];
}

function aapm_cert_holder_name(array $account): string
{
    $name = trim((string) ($account['full_name'] ?? ''));
    if ($name === '') {
        $name = 'Peserta Academy';
    }

    return function_exists('mb_substr') ? mb_substr($name, 0, 120) : substr($name, 0, 120);
}

/**
 * Finds the stored evidence behind each required module and the final exam, all
 * in the active generation. Returns null if any claimed completion has no record.
 */
function aapm_cert_collect_evidence(PDO $pdo, int $userId, int $generation, array $snapshot, array $modules, bool $needsFinal): ?array
{
    $attempts = [];
    $statement = $pdo->prepare("SELECT id, module_number, score_percent, correct_answers, total_questions, passing_grade, submitted_at FROM assessment_attempts WHERE user_id = ? AND academic_generation = ? AND assessment_type = 'module_quiz' AND status = 'submitted' AND passed = 1 ORDER BY id ASC");
    $statement->execute([$userId, $generation]);
    foreach ($statement->fetchAll() as $row) {
        $attempts[(int) $row['module_number']] ??= $row;
    }
    $acks = [];
    $statement = $pdo->prepare("SELECT id, module_number, created_at FROM module_learning_events WHERE user_id = ? AND academic_generation = ? AND event_type = 'material_acknowledged' ORDER BY id ASC");
    $statement->execute([$userId, $generation]);
    foreach ($statement->fetchAll() as $row) {
        $acks[(int) $row['module_number']] ??= $row;
    }

    $evidence = [];
    foreach ($modules as $number) {
        if ($snapshot['modules'][$number]['hasQuiz'] ?? false) {
            if (!isset($attempts[$number])) {
                return null;
            }
            $row = $attempts[$number];
            $evidence[] = [
                'module' => $number,
                'type' => 'verified_module_quiz',
                'attemptId' => (int) $row['id'],
                'eventId' => null,
                // Scores and counts only. No questions, options, or answer keys.
                'snapshot' => [
                    'scorePercent' => (int) $row['score_percent'],
                    'correctAnswers' => (int) $row['correct_answers'],
                    'totalQuestions' => (int) $row['total_questions'],
                    'passingGrade' => (int) $row['passing_grade'],
                    'submittedAt' => (string) $row['submitted_at'],
                ],
            ];
        } else {
            if (!isset($acks[$number])) {
                return null;
            }
            $evidence[] = [
                'module' => $number,
                'type' => 'verified_module_acknowledgement',
                'attemptId' => null,
                'eventId' => (int) $acks[$number]['id'],
                'snapshot' => ['acknowledgedAt' => (string) $acks[$number]['created_at']],
            ];
        }
    }
    if ($needsFinal) {
        $statement = $pdo->prepare("SELECT id, score_percent, correct_answers, total_questions, passing_grade, submitted_at FROM assessment_attempts WHERE user_id = ? AND academic_generation = ? AND assessment_type = 'final_exam' AND module_number = 0 AND status = 'submitted' AND passed = 1 ORDER BY score_percent DESC, id ASC LIMIT 1");
        $statement->execute([$userId, $generation]);
        $final = $statement->fetch();
        if (!$final || (int) $final['score_percent'] < AAPM_FINAL_PASS_PERCENT) {
            return null;
        }
        $evidence[] = [
            'module' => null,
            'type' => 'verified_final_exam',
            'attemptId' => (int) $final['id'],
            'eventId' => null,
            'snapshot' => [
                'scorePercent' => (int) $final['score_percent'],
                'correctAnswers' => (int) $final['correct_answers'],
                'totalQuestions' => (int) $final['total_questions'],
                'passingGrade' => (int) $final['passing_grade'],
                'submittedAt' => (string) $final['submitted_at'],
            ],
        ];
    }

    return $evidence;
}

function aapm_cert_event(PDO $pdo, int $certificateId, ?int $actorId, string $type, ?string $reason, array $metadata): void
{
    $pdo->prepare('INSERT INTO certificate_events (certificate_id, actor_user_id, event_type, reason, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([$certificateId, $actorId, $type, $reason, json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), aapm_utc_now()]);
}

/**
 * POST /api/certificates/claims. Everything except the tier number is derived on
 * the server. Idempotent per learner and tier; concurrent claims issue exactly one.
 */
function aapm_certificate_claim(array $user, array $input): array
{
    $userId = (int) $user['id'];
    $version = aapm_learner_policy_version(db(), $userId);
    $tier = $input['tierNumber'] ?? null;
    if ((!is_int($tier) && !(is_string($tier) && ctype_digit($tier))) || (int) $tier < 1 || (int) $tier > count(AAPM_CERT_TIERS_ACADEMY_V1)) {
        aapm_assessment_fail(422, 'invalid_tier', 'Tingkat sertifikat tidak valid.');
    }
    $tier = (int) $tier;
    if (!aapm_assessment_valid_key($input['requestKey'] ?? null)) {
        aapm_assessment_fail(422, 'validation_error', 'Kunci permintaan tidak valid.');
    }

    $pdo = db();
    aapm_tx_begin($pdo);
    try {
        aapm_assessment_user_lock($pdo, $userId);
        $account = aapm_cert_user_row($pdo, $userId);
        if (aapm_verification_status($account) !== 'verified') {
            aapm_tx_rollback($pdo);
            aapm_assessment_fail(403, 'email_verification_required', 'Verifikasi email diperlukan sebelum mengklaim sertifikat.', ['verificationStatus' => aapm_verification_status($account)]);
        }

        $existing = aapm_cert_issuance_row($pdo, $userId, $version, $tier);
        if ($existing) {
            aapm_tx_commit($pdo);
            if ((string) $existing['status'] === 'revoked') {
                aapm_assessment_fail(409, 'certificate_revoked', 'Sertifikat tingkat ini sudah dicabut dan tidak dapat diklaim ulang.');
            }

            return ['certificate' => aapm_cert_present($existing, count(aapm_cert_policy($pdo, $version)[$tier]['required'])), 'created' => false];
        }

        $evaluation = aapm_cert_evaluate($pdo, $userId);
        $state = $evaluation['tiers'][$tier];
        if (!$state['requirementsMet']) {
            aapm_tx_rollback($pdo);
            aapm_assessment_fail(409, 'requirements_unmet', 'Persyaratan sertifikat ini belum terpenuhi.', [
                'tierNumber' => $tier,
                'missingModuleNumbers' => $state['missingModuleNumbers'],
                'requiresFinal' => $state['requiresFinal'],
                'finalPassed' => $state['finalPassed'],
            ]);
        }

        $snapshot = aapm_academic_snapshot($pdo, $userId);
        $generation = (int) $snapshot['generation'];
        $evidence = aapm_cert_collect_evidence($pdo, $userId, $generation, $snapshot, $state['requiredModules'], $state['requiresFinal']);
        if ($evidence === null) {
            aapm_tx_rollback($pdo);
            aapm_assessment_fail(409, 'evidence_incomplete', 'Bukti penilaian untuk sertifikat ini belum lengkap.');
        }

        $finalEvidence = null;
        foreach ($evidence as $item) {
            if ($item['type'] === 'verified_final_exam') {
                $finalEvidence = $item;
            }
        }
        $now = aapm_utc_now();
        $publicId = bin2hex(random_bytes(16));
        $pdo->prepare('INSERT INTO certificate_issuances (public_id, user_id, tier_number, tier_name_snapshot, policy_version, academic_generation, holder_name_snapshot, status, verified_score_percent, final_attempt_id, issued_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([
                $publicId,
                $userId,
                $tier,
                $state['tierName'],
                $version,
                $generation,
                aapm_cert_holder_name($account),
                'issued',
                $finalEvidence ? (int) $finalEvidence['snapshot']['scorePercent'] : null,
                $finalEvidence ? $finalEvidence['attemptId'] : null,
                $now,
                $now,
                $now,
            ]);
        $certificateId = (int) $pdo->lastInsertId();
        $insertEvidence = $pdo->prepare('INSERT INTO certificate_evidence (certificate_id, module_number, evidence_type, assessment_attempt_id, learning_event_id, academic_generation, policy_version, evidence_snapshot_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        foreach ($evidence as $item) {
            $insertEvidence->execute([
                $certificateId,
                $item['module'],
                $item['type'],
                $item['attemptId'],
                $item['eventId'],
                $generation,
                $version,
                json_encode($item['snapshot'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                $now,
            ]);
        }
        aapm_cert_event($pdo, $certificateId, $userId, 'certificate.issued', null, [
            'tier' => $tier,
            'policyVersion' => $version,
            'generation' => $generation,
            'evidenceCount' => count($evidence),
        ]);
        aapm_tx_commit($pdo);

        $row = aapm_cert_issuance_row($pdo, $userId, $version, $tier);

        return ['certificate' => aapm_cert_present($row, $state['totalRequiredModules']), 'created' => true];
    } catch (PDOException $exception) {
        aapm_tx_rollback($pdo);
        // A concurrent identical claim won the unique (learner, policy, tier) index.
        $message = strtolower($exception->getMessage());
        if (strpos($message, 'unique') !== false || strpos($message, 'duplicate') !== false) {
            return aapm_certificate_claim($user, $input);
        }
        throw $exception;
    } catch (Throwable $exception) {
        aapm_tx_rollback($pdo);
        throw $exception;
    }
}

/** GET /api/certificates: verified and legacy entries, never merged. */
function aapm_certificate_list(array $user): array
{
    $pdo = db();
    $userId = (int) $user['id'];
    $totals = [];
    $version = aapm_learner_policy_version($pdo, $userId);
    foreach (aapm_cert_policy($pdo, $version) as $number => $tier) {
        $totals[$number] = count($tier['required']);
    }
    $entries = [];
    $statement = $pdo->prepare('SELECT * FROM certificate_issuances WHERE user_id = ? ORDER BY tier_number ASC, issued_at ASC');
    $statement->execute([$userId]);
    foreach ($statement->fetchAll() as $row) {
        $entries[] = aapm_cert_present($row, $totals[(int) $row['tier_number']] ?? 0);
    }
    $legacy = $pdo->prepare('SELECT * FROM certificates WHERE user_id = ? ORDER BY level_number ASC, issued_at ASC');
    $legacy->execute([$userId]);
    foreach ($legacy->fetchAll() as $row) {
        $entries[] = aapm_cert_present_legacy($row);
    }

    return $entries;
}

/** GET /api/certificates/{id}: owner only. A foreign or unknown id is simply not found. */
function aapm_certificate_detail(array $user, string $id): array
{
    $pdo = db();
    $userId = (int) $user['id'];
    if (preg_match('/\A[a-f0-9]{32}\z/', $id)) {
        $statement = $pdo->prepare('SELECT * FROM certificate_issuances WHERE public_id = ? AND user_id = ? LIMIT 1');
        $statement->execute([$id, $userId]);
        $row = $statement->fetch();
        if ($row) {
            return aapm_cert_present($row, count(aapm_cert_policy($pdo, (string) $row['policy_version'])[(int) $row['tier_number']]['required'] ?? []));
        }
    } elseif (ctype_digit($id)) {
        $statement = $pdo->prepare('SELECT * FROM certificates WHERE id = ? AND user_id = ? LIMIT 1');
        $statement->execute([(int) $id, $userId]);
        $row = $statement->fetch();
        if ($row) {
            return aapm_cert_present_legacy($row);
        }
    }
    aapm_assessment_fail(404, 'certificate_not_found', 'Sertifikat tidak ditemukan.');
}

function aapm_cert_mask_name(string $name): string
{
    $words = preg_split('/\s+/u', trim($name), -1, PREG_SPLIT_NO_EMPTY) ?: [];
    $masked = [];
    foreach (array_slice($words, 0, 4) as $word) {
        $length = function_exists('mb_strlen') ? mb_strlen($word) : strlen($word);
        $keep = $length >= 5 ? 2 : 1;
        $head = function_exists('mb_substr') ? mb_substr($word, 0, $keep) : substr($word, 0, $keep);
        $masked[] = $head . str_repeat('*', max(1, min(5, $length - $keep)));
    }

    return implode(' ', $masked);
}

/**
 * GET /api/public/certificates/verify/{publicId}. Unauthenticated and read-only.
 * Exposes no email, account id, internal id, evidence, or revocation note.
 */
function aapm_certificate_public_verify(string $publicId): array
{
    rate_limit_guard('certificate_verify', '', 60, 60, 120);

    $row = null;
    if (preg_match('/\A[a-f0-9]{32}\z/', $publicId)) {
        $statement = db()->prepare('SELECT * FROM certificate_issuances WHERE public_id = ? LIMIT 1');
        $statement->execute([$publicId]);
        $row = $statement->fetch() ?: null;
    }
    if (!$row) {
        rate_limit_failure('certificate_verify', '', 60, 60, 120);
        aapm_assessment_fail(404, 'certificate_not_found', 'Sertifikat tidak ditemukan.');
    }
    $evidence = db()->prepare('SELECT COUNT(*) FROM certificate_evidence WHERE certificate_id = ?');
    $evidence->execute([(int) $row['id']]);
    $backed = (int) $evidence->fetchColumn() > 0;
    $revoked = (string) $row['status'] === 'revoked';

    return [
        'valid' => !$revoked && $backed,
        'status' => $revoked ? 'revoked' : ($backed ? 'issued' : 'unverifiable'),
        'publicId' => (string) $row['public_id'],
        'tierNumber' => (int) $row['tier_number'],
        'tierName' => (string) $row['tier_name_snapshot'],
        'policyVersion' => (string) $row['policy_version'],
        'issuedAt' => (string) $row['issued_at'],
        'revokedAt' => $revoked ? $row['revoked_at'] : null,
        'holderName' => aapm_cert_mask_name((string) $row['holder_name_snapshot']),
        'verificationSource' => AAPM_CERT_VERIFY_SOURCE,
    ];
}

/** GET /api/admin/certificates */
function aapm_admin_certificate_list(array $query): array
{
    $pdo = db();
    $limit = max(1, min(100, (int) ($query['limit'] ?? 25)));
    $offset = max(0, (int) ($query['offset'] ?? 0));
    $source = (string) ($query['source'] ?? 'verified');

    if ($source === 'legacy') {
        $where = '';
        $params = [];
        if (isset($query['tier']) && ctype_digit((string) $query['tier'])) {
            $where = ' WHERE c.level_number = ?';
            $params[] = (int) $query['tier'];
        }
        $count = $pdo->prepare('SELECT COUNT(*) FROM certificates c' . $where);
        $count->execute($params);
        $statement = $pdo->prepare('SELECT c.*, u.email, u.full_name FROM certificates c INNER JOIN users u ON u.id = c.user_id' . $where . ' ORDER BY c.issued_at DESC, c.id DESC LIMIT ' . $limit . ' OFFSET ' . $offset);
        $statement->execute($params);
        $items = array_map(static function (array $row): array {
            return array_merge(aapm_cert_present_legacy($row), [
                'classification' => 'legacy_unverified',
                'learner' => ['id' => (int) $row['user_id'], 'name' => $row['full_name'], 'email' => $row['email']],
                'evidenceCount' => 0,
            ]);
        }, $statement->fetchAll());

        return ['items' => $items, 'total' => (int) $count->fetchColumn(), 'limit' => $limit, 'offset' => $offset, 'source' => 'legacy'];
    }

    $where = [];
    $params = [];
    if (in_array($query['status'] ?? '', ['issued', 'revoked'], true)) {
        $where[] = 'i.status = ?';
        $params[] = (string) $query['status'];
    }
    if (isset($query['tier']) && ctype_digit((string) $query['tier'])) {
        $where[] = 'i.tier_number = ?';
        $params[] = (int) $query['tier'];
    }
    $clause = $where ? ' WHERE ' . implode(' AND ', $where) : '';
    $count = $pdo->prepare('SELECT COUNT(*) FROM certificate_issuances i' . $clause);
    $count->execute($params);
    $statement = $pdo->prepare('SELECT i.*, u.email, u.full_name, (SELECT COUNT(*) FROM certificate_evidence e WHERE e.certificate_id = i.id) AS evidence_count FROM certificate_issuances i INNER JOIN users u ON u.id = i.user_id' . $clause . ' ORDER BY i.issued_at DESC, i.id DESC LIMIT ' . $limit . ' OFFSET ' . $offset);
    $statement->execute($params);
    $items = array_map(static function (array $row): array {
        return array_merge(aapm_cert_present($row), [
            'classification' => 'verified',
            'learner' => ['id' => (int) $row['user_id'], 'name' => $row['full_name'], 'email' => $row['email']],
            'evidenceCount' => (int) $row['evidence_count'],
            'revocationReason' => $row['revocation_reason'],
        ]);
    }, $statement->fetchAll());

    return ['items' => $items, 'total' => (int) $count->fetchColumn(), 'limit' => $limit, 'offset' => $offset, 'source' => 'verified'];
}

/** GET /api/admin/certificates/{publicId}: issuance, evidence summary, and event trail. */
function aapm_admin_certificate_detail(string $publicId): array
{
    $pdo = db();
    $statement = $pdo->prepare('SELECT i.*, u.email, u.full_name FROM certificate_issuances i INNER JOIN users u ON u.id = i.user_id WHERE i.public_id = ? LIMIT 1');
    $statement->execute([$publicId]);
    $row = $statement->fetch();
    if (!$row) {
        aapm_assessment_fail(404, 'certificate_not_found', 'Sertifikat tidak ditemukan.');
    }
    $evidence = $pdo->prepare('SELECT module_number, evidence_type, academic_generation, evidence_snapshot_json FROM certificate_evidence WHERE certificate_id = ? ORDER BY id ASC');
    $evidence->execute([(int) $row['id']]);
    $events = $pdo->prepare('SELECT actor_user_id, event_type, reason, created_at FROM certificate_events WHERE certificate_id = ? ORDER BY id ASC');
    $events->execute([(int) $row['id']]);

    return [
        'certificate' => array_merge(aapm_cert_present($row), [
            'learner' => ['id' => (int) $row['user_id'], 'name' => $row['full_name'], 'email' => $row['email']],
            'revocationReason' => $row['revocation_reason'],
            'generation' => (int) $row['academic_generation'],
        ]),
        'evidence' => array_map(static function (array $item): array {
            return [
                'moduleNumber' => $item['module_number'] === null ? null : (int) $item['module_number'],
                'type' => (string) $item['evidence_type'],
                'generation' => (int) $item['academic_generation'],
                'snapshot' => json_decode((string) $item['evidence_snapshot_json'], true),
            ];
        }, $evidence->fetchAll()),
        'events' => array_map(static fn (array $event): array => [
            'type' => (string) $event['event_type'],
            'actorUserId' => $event['actor_user_id'] === null ? null : (int) $event['actor_user_id'],
            'reason' => $event['reason'],
            'createdAt' => (string) $event['created_at'],
        ], $events->fetchAll()),
    ];
}

/**
 * POST /api/admin/certificates/{publicId}/revoke. Verified admin, CSRF, a reason,
 * and explicit confirmation. The row is kept; a repeat is a no-op with no new event.
 */
function aapm_admin_certificate_revoke(array $actor, string $publicId, array $input): array
{
    $reason = trim((string) ($input['reason'] ?? ''));
    $length = function_exists('mb_strlen') ? mb_strlen($reason) : strlen($reason);
    if ($length < 5 || $length > 500) {
        aapm_assessment_fail(422, 'reason_required', 'Alasan pencabutan wajib diisi (5–500 karakter).');
    }
    if (($input['confirm'] ?? null) !== true) {
        aapm_assessment_fail(422, 'confirmation_required', 'Konfirmasi pencabutan wajib dikirim.');
    }

    $pdo = db();
    $found = $pdo->prepare('SELECT user_id FROM certificate_issuances WHERE public_id = ? LIMIT 1');
    $found->execute([$publicId]);
    $ownerId = $found->fetchColumn();
    if ($ownerId === false) {
        aapm_assessment_fail(404, 'certificate_not_found', 'Sertifikat tidak ditemukan.');
    }

    aapm_tx_begin($pdo);
    try {
        // The owner's lock orders revocation against a concurrent claim.
        aapm_assessment_user_lock($pdo, (int) $ownerId);
        $statement = $pdo->prepare('SELECT * FROM certificate_issuances WHERE public_id = ? LIMIT 1');
        $statement->execute([$publicId]);
        $row = $statement->fetch();
        if (!$row) {
            aapm_tx_rollback($pdo);
            aapm_assessment_fail(404, 'certificate_not_found', 'Sertifikat tidak ditemukan.');
        }
        if ((string) $row['status'] === 'revoked') {
            aapm_tx_commit($pdo);

            return ['certificate' => aapm_cert_present($row), 'alreadyRevoked' => true];
        }
        $now = aapm_utc_now();
        $update = $pdo->prepare("UPDATE certificate_issuances SET status = 'revoked', revoked_at = ?, revoked_by_user_id = ?, revocation_reason = ?, updated_at = ? WHERE id = ? AND status = 'issued'");
        $update->execute([$now, (int) $actor['id'], $reason, $now, (int) $row['id']]);
        if ($update->rowCount() !== 1) {
            aapm_tx_rollback($pdo);
            aapm_assessment_fail(409, 'revocation_conflict', 'Status sertifikat berubah. Muat ulang lalu coba lagi.');
        }
        aapm_cert_event($pdo, (int) $row['id'], (int) $actor['id'], 'certificate.revoked', $reason, ['tier' => (int) $row['tier_number']]);
        aapm_audit('admin.certificate_revoked', 'success', (int) $actor['id'], (int) $ownerId, [
            'tier' => (int) $row['tier_number'],
            'certificate' => (string) $row['public_id'],
            'reason' => $reason,
        ]);
        aapm_tx_commit($pdo);
        $statement->execute([$publicId]);

        return ['certificate' => aapm_cert_present($statement->fetch()), 'alreadyRevoked' => false];
    } catch (Throwable $exception) {
        aapm_tx_rollback($pdo);
        throw $exception;
    }
}
