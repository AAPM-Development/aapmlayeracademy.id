<?php
declare(strict_types=1);

/**
 * Operator-only move of EXISTING learners onto the active policy (the "replace for all"
 * decision). Each learner whose assignment differs is reassigned, and a learner with
 * academic history gets a new academic generation through aapm_reset_learner_progress.
 * Nothing is deleted: attempts, scores, events, and certificates stay as recorded, and
 * current progress starts over under the new curriculum. Refuses HTTP invocation.
 *
 *   php scripts/curriculum/move-learners-to-policy.php --policy-version=academy-v2 --expect-environment=local --actor-email=ADMIN --dry-run
 *   php scripts/curriculum/move-learners-to-policy.php --policy-version=academy-v2 --expect-environment=local --actor-email=ADMIN --apply --operator=NAME --evidence-ref=REF
 *
 * The target must already be the ACTIVE policy. Activation sends new accounts to it, so
 * the order is: prepare-policy-v2, activate-policy, then this script.
 */

if (PHP_SAPI !== 'cli' || isset($_SERVER['HTTP_HOST']) || isset($_SERVER['REQUEST_METHOD'])) {
    http_response_code(403);
    fwrite(STDERR, "Pemindahan peserta hanya dapat dijalankan dari CLI operator.\n");
    exit(2);
}

require __DIR__ . '/../../public/api/bootstrap.php';

function move_fail(int $code, string $message): void
{
    fwrite(STDERR, $message . "\n");
    exit($code);
}

$options = [];
foreach (array_slice($argv, 1) as $argument) {
    if (!preg_match('/\A--([a-z-]+)(?:=(.*))?\z/', $argument, $match)) {
        move_fail(2, 'Argumen tidak dikenal: ' . substr($argument, 0, 60));
    }
    $options[$match[1]] = $match[2] ?? true;
}
$allowed = ['policy-version', 'expect-environment', 'actor-email', 'dry-run', 'apply', 'operator', 'evidence-ref'];
foreach (array_keys($options) as $key) {
    if (!in_array($key, $allowed, true)) {
        move_fail(2, 'Opsi tidak dikenal: --' . $key);
    }
}
$dryRun = isset($options['dry-run']);
$apply = isset($options['apply']);
if ($dryRun === $apply) {
    move_fail(2, 'Pilih tepat satu: --dry-run atau --apply.');
}
$version = trim((string) ($options['policy-version'] ?? ''));
$expectedEnvironment = strtolower(trim((string) ($options['expect-environment'] ?? '')));
$actorEmail = strtolower(trim((string) ($options['actor-email'] ?? '')));
$operator = trim((string) ($options['operator'] ?? ''));
$evidence = trim((string) ($options['evidence-ref'] ?? ''));
if ($version === '' || $expectedEnvironment === '' || $actorEmail === '') {
    move_fail(2, '--policy-version, --expect-environment, dan --actor-email wajib diisi.');
}
if ($apply && ($operator === '' || $evidence === '')) {
    move_fail(2, '--apply membutuhkan --operator dan --evidence-ref.');
}

try {
    $config = app_config();
} catch (AppConfigException $exception) {
    move_fail(3, 'Konfigurasi tidak valid: ' . $exception->safeCode());
}
$environment = strtolower((string) ($config['environment'] ?? ''));
if ($environment !== $expectedEnvironment) {
    move_fail(3, "Target tidak cocok: konfigurasi memakai lingkungan {$environment}, --expect-environment={$expectedEnvironment}. Tidak ada perubahan.");
}

$pdo = db();
$actorStatement = $pdo->prepare('SELECT id, role, email_verified_at FROM users WHERE LOWER(email) = ? LIMIT 1');
$actorStatement->execute([$actorEmail]);
$actor = $actorStatement->fetch();
if (!$actor || !in_array((string) $actor['role'], ['admin', 'super_admin'], true) || empty($actor['email_verified_at'])) {
    move_fail(3, 'Akun --actor-email harus Admin atau Super Admin yang emailnya sudah terverifikasi.');
}
$actorId = (int) $actor['id'];

if (aapm_cur_active_policy_version($pdo) !== $version) {
    move_fail(4, "Kebijakan {$version} belum aktif. Aktifkan lebih dulu dengan activate-policy.php. Tidak ada perubahan.");
}

$users = $pdo->query('SELECT id FROM users ORDER BY id ASC')->fetchAll();
$counts = ['accounts' => count($users), 'alreadyOnPolicy' => 0, 'reassign' => 0, 'withHistory' => 0, 'certificatesKept' => 0];
$certificates = $pdo->query("SELECT COUNT(*) FROM certificate_issuances WHERE status = 'issued'")->fetchColumn();
$counts['certificatesKept'] = (int) $certificates;
$plan = [];
foreach ($users as $user) {
    $userId = (int) $user['id'];
    $from = aapm_learner_policy_version($pdo, $userId);
    $history = $pdo->prepare('SELECT (SELECT COUNT(*) FROM assessment_attempts WHERE user_id = ?) + (SELECT COUNT(*) FROM module_learning_events WHERE user_id = ?)');
    $history->execute([$userId, $userId]);
    $hasHistory = (int) $history->fetchColumn() > 0;
    $needsReassign = $from !== $version;
    if (!$needsReassign && !$hasHistory) {
        $counts['alreadyOnPolicy']++;
        continue;
    }
    if ($needsReassign) {
        $counts['reassign']++;
    }
    if ($hasHistory) {
        $counts['withHistory']++;
    }
    $plan[] = ['userId' => $userId, 'from' => $from, 'reset' => $hasHistory];
}

if ($dryRun) {
    echo json_encode(['plan' => ['environment' => $environment, 'targetVersion' => $version, 'counts' => $counts, 'learners' => count($plan)], 'changed' => false], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n";
    exit(0);
}

$audit = ['source' => 'move-learners-to-policy', 'operator' => $operator, 'evidenceRef' => $evidence];
$moved = 0;
$resets = 0;
foreach ($plan as $item) {
    $userId = $item['userId'];
    aapm_tx_begin($pdo);
    try {
        aapm_assessment_user_lock($pdo, $userId);
        if ($item['from'] !== $version) {
            $update = $pdo->prepare('UPDATE learner_curriculum_assignments SET policy_version = ?, assigned_at = ?, assignment_source = ? WHERE user_id = ?');
            $update->execute([$version, aapm_utc_now(), 'policy-move', $userId]);
            if ($update->rowCount() < 1) {
                $pdo->prepare('INSERT INTO learner_curriculum_assignments (user_id, policy_version, assigned_at, assignment_source) VALUES (?, ?, ?, ?)')
                    ->execute([$userId, $version, aapm_utc_now(), 'policy-move']);
            }
            $moved++;
        }
        $generation = null;
        if ($item['reset']) {
            $result = aapm_reset_learner_progress($pdo, $userId);
            $generation = $result['generationTo'];
            $resets++;
        }
        aapm_cur_event($pdo, 'learner.policy_moved', null, $version, null, $actorId, $audit + [
            'userId' => $userId,
            'policyFrom' => $item['from'],
            'generationTo' => $generation,
        ]);
        aapm_tx_commit($pdo);
    } catch (Throwable $exception) {
        aapm_tx_rollback($pdo);
        throw $exception;
    }
}

echo json_encode(['result' => ['targetVersion' => $version, 'reassigned' => $moved, 'generationsAdvanced' => $resets, 'certificatesKept' => $counts['certificatesKept']], 'changed' => true], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n";
exit(0);
