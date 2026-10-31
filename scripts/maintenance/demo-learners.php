<?php
declare(strict_types=1);

/**
 * Operator-only synthetic learners for a demo, and their removal. CLI only.
 *
 * Accounts use the reserved domain peserta-demo.invalid, carry a password nobody knows,
 * and reach the hall of fame through the normal attempt functions, so progress, points
 * and admin reports stay consistent. Certificates are never claimed: they are publicly
 * verifiable credentials, and a synthetic person must not hold one.
 *
 *   php scripts/maintenance/demo-learners.php --expect-environment=staging --dry-run --count=40
 *   php scripts/maintenance/demo-learners.php --expect-environment=staging --apply --count=40 --operator=NAME --evidence-ref=REF
 *   php scripts/maintenance/demo-learners.php --expect-environment=staging --apply --remove --operator=NAME --evidence-ref=REF
 *
 * Production also needs --confirm-production. Take a database backup first.
 * Exit codes: 0 success or dry-run, 1 failed, 2 usage error, 3 wrong target, 4 refused.
 */

if (PHP_SAPI !== 'cli' || isset($_SERVER['HTTP_HOST']) || isset($_SERVER['REQUEST_METHOD'])) {
    http_response_code(403);
    fwrite(STDERR, "Akun demo hanya dapat diatur dari CLI operator.\n");
    exit(2);
}

require __DIR__ . '/../../public/api/bootstrap.php';

const DEMO_DOMAIN = 'peserta-demo.invalid';
const DEMO_MAX_COUNT = 100;
const DEMO_DEFAULT_COUNT = 40;
const DEMO_PASS_PERCENTS = [80, 90, 100];
const DEMO_FIRST_NAMES = ['Adi', 'Bagas', 'Cahya', 'Dimas', 'Eka', 'Fajar', 'Galih', 'Hana', 'Indra', 'Joko', 'Kirana', 'Laras', 'Maya', 'Nanda', 'Oki', 'Putri', 'Qori', 'Rizki', 'Sari', 'Tegar'];
const DEMO_LAST_NAMES = ['Wibowo', 'Lestari', 'Pratama', 'Saputra', 'Wulandari', 'Hidayat', 'Kusuma', 'Maharani', 'Nugroho', 'Permata'];

// API helpers answer failures with a JSON body and a bare exit, which would end a CLI run
// with status 0. Buffer that body and turn it into a failure.
$demoFinished = false;
ob_start();
register_shutdown_function(static function () use (&$demoFinished): void {
    if ($demoFinished) {
        return;
    }
    $buffered = trim((string) ob_get_clean());
    fwrite(STDERR, 'Akun demo dihentikan' . ($buffered !== '' ? ': ' . $buffered : '.') . " Jalankan --apply --remove untuk membersihkan akun yang sudah dibuat.\n");
    exit(1);
});

function demo_finish(int $code, string $message): void
{
    global $demoFinished;
    $demoFinished = true;
    ob_end_clean();
    fwrite($code === 0 ? STDOUT : STDERR, $message . "\n");
    exit($code);
}

/** Nearly everyone is mid-way, and a few are close to the end, like a real cohort. */
function demo_completed_modules(int $index, int $count, int $available): int
{
    $rank = 1 - ($index / max(1, $count));
    return max(1, min($available, (int) round(1 + ($available - 1) * ($rank ** 1.6))));
}

function demo_pass_module(PDO $pdo, array $user, int $number, int $percent, string $key): void
{
    aapm_acknowledge_module($user, $number);
    $started = aapm_assessment_start($user, ['assessmentType' => 'module_quiz', 'moduleNumber' => $number, 'requestKey' => $key . '_start']);
    $publicId = $started['attempt']['id'];
    $query = $pdo->prepare('SELECT i.id, i.question_snapshot_json FROM assessment_attempt_items i JOIN assessment_attempts a ON a.id = i.attempt_id WHERE a.public_id = ? ORDER BY i.ordinal');
    $query->execute([$publicId]);
    $items = $query->fetchAll();
    $correct = (int) ceil(count($items) * $percent / 100);
    foreach ($items as $index => $item) {
        $snapshot = json_decode((string) $item['question_snapshot_json'], true, 512, JSON_THROW_ON_ERROR);
        $answer = $index < $correct ? (int) $snapshot['correctIndex'] : ((int) $snapshot['correctIndex'] + 1) % count($snapshot['options']);
        aapm_assessment_answer($user, $publicId, ['questionId' => (int) $item['id'], 'answerIndex' => $answer]);
    }
    aapm_assessment_submit($user, $publicId, ['requestKey' => $key . '_submit']);
}

$options = [];
foreach (array_slice($argv, 1) as $argument) {
    if (!preg_match('/\A--([a-z-]+)(?:=(.*))?\z/', $argument, $match)) {
        demo_finish(2, 'Argumen tidak dikenal: ' . substr($argument, 0, 60));
    }
    $options[$match[1]] = $match[2] ?? true;
}
foreach (array_keys($options) as $key) {
    if (!in_array($key, ['expect-environment', 'dry-run', 'apply', 'remove', 'count', 'operator', 'evidence-ref', 'confirm-production'], true)) {
        demo_finish(2, 'Opsi tidak dikenal: --' . $key);
    }
}
$dryRun = isset($options['dry-run']);
$apply = isset($options['apply']);
$remove = isset($options['remove']);
if ($dryRun === $apply) {
    demo_finish(2, 'Pilih tepat satu: --dry-run atau --apply.');
}
$count = (int) ($options['count'] ?? DEMO_DEFAULT_COUNT);
if ($count < 1 || $count > DEMO_MAX_COUNT) {
    demo_finish(2, '--count harus 1 sampai ' . DEMO_MAX_COUNT . '.');
}
$operator = trim((string) ($options['operator'] ?? ''));
$evidence = trim((string) ($options['evidence-ref'] ?? ''));
if ($apply && ($operator === '' || $evidence === '')) {
    demo_finish(2, '--operator dan --evidence-ref wajib untuk --apply.');
}
$expected = strtolower(trim((string) ($options['expect-environment'] ?? '')));
if ($expected === '') {
    demo_finish(2, '--expect-environment wajib diisi.');
}

try {
    $config = app_config();
} catch (AppConfigException $exception) {
    demo_finish(3, 'Konfigurasi tidak valid: ' . $exception->safeCode());
}
$environment = strtolower((string) ($config['environment'] ?? ''));
if ($environment !== $expected) {
    demo_finish(3, "Target tidak cocok: konfigurasi memakai lingkungan {$environment}, --expect-environment={$expected}.");
}
if ($environment === 'production' && $apply && !isset($options['confirm-production'])) {
    demo_finish(4, 'Production memerlukan --confirm-production, setelah database dicadangkan.');
}

$pdo = db();
$existing = $pdo->prepare('SELECT id FROM users WHERE email LIKE ? ORDER BY id');
$existing->execute(['%@' . DEMO_DOMAIN]);
$existingIds = array_map('intval', $existing->fetchAll(PDO::FETCH_COLUMN));
$audit = ['operator' => $operator, 'evidenceRef' => $evidence];

if ($remove) {
    if ($dryRun) {
        demo_finish(0, json_encode(['environment' => $environment, 'mode' => 'dry-run', 'accountsToRemove' => count($existingIds), 'changed' => false], JSON_PRETTY_PRINT));
    }
    foreach ($existingIds as $id) {
        // These tables do not follow the account on every schema; the rest cascade.
        foreach (['learner_achievements', 'legacy_progress_snapshots', 'learner_curriculum_assignments'] as $table) {
            $pdo->prepare("DELETE FROM {$table} WHERE user_id = ?")->execute([$id]);
        }
        $pdo->prepare('DELETE FROM users WHERE id = ? AND email LIKE ?')->execute([$id, '%@' . DEMO_DOMAIN]);
    }
    aapm_audit('demo.learners_removed', 'ok', null, null, $audit + ['accounts' => count($existingIds)]);
    demo_finish(0, json_encode(['environment' => $environment, 'mode' => 'apply', 'accountsRemoved' => count($existingIds), 'changed' => $existingIds !== []], JSON_PRETTY_PRINT));
}

if ($existingIds !== []) {
    demo_finish(4, 'Sudah ada ' . count($existingIds) . ' akun demo. Hapus dulu dengan --apply --remove.');
}

$policy = aapm_cur_active_policy_version($pdo);
$numbers = $pdo->prepare("SELECT m.module_number FROM curriculum_policy_modules m WHERE m.policy_version = ? AND EXISTS (SELECT 1 FROM quiz_questions q WHERE q.module_number = m.module_number) ORDER BY m.module_number");
$numbers->execute([$policy]);
$modules = array_map('intval', $numbers->fetchAll(PDO::FETCH_COLUMN));
if ($modules === []) {
    demo_finish(4, 'Kebijakan aktif tidak punya modul dengan bank soal.');
}

if ($dryRun) {
    demo_finish(0, json_encode(['environment' => $environment, 'mode' => 'dry-run', 'policy' => $policy, 'accountsToCreate' => $count, 'modulesAvailable' => count($modules), 'certificates' => 0, 'changed' => false], JSON_PRETTY_PRINT));
}

// The same names and shape on every run, so a demo can be rehearsed.
mt_srand(20261031);
$insertUser = $pdo->prepare('INSERT INTO users (email, password_hash, full_name, role, email_verified_at, verification_required_at, auth_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL, 1, ?, ?)');
$insertProfile = $pdo->prepare('INSERT INTO user_profiles (user_id, bio, hall_of_fame_opt_in, avatar_data) VALUES (?, ?, 1, ?)');
$attempts = 0;
for ($index = 0; $index < $count; $index++) {
    $name = DEMO_FIRST_NAMES[$index % count(DEMO_FIRST_NAMES)] . ' ' . DEMO_LAST_NAMES[($index + intdiv($index, count(DEMO_FIRST_NAMES))) % count(DEMO_LAST_NAMES)];
    $email = sprintf('demo-%03d@%s', $index + 1, DEMO_DOMAIN);
    $now = aapm_utc_now();
    $joined = gmdate('Y-m-d H:i:s', time() - (mt_rand(7, 70) * 86400));
    // Random and never printed or stored in plain form: nobody can sign in as this account.
    $insertUser->execute([$email, password_hash(bin2hex(random_bytes(24)), PASSWORD_DEFAULT), $name, 'user', $now, $joined, $now]);
    $userId = (int) $pdo->lastInsertId();
    aapm_assign_new_learner_policy($pdo, $userId, 'registration');
    $insertProfile->execute([$userId, '', '']);
    $user = ['id' => $userId, 'email' => $email, 'full_name' => $name, 'role' => 'user', 'email_verified_at' => $now, 'verification_required_at' => null, 'auth_version' => 1];

    $completed = demo_completed_modules($index, $count, count($modules));
    $percent = DEMO_PASS_PERCENTS[mt_rand(0, count(DEMO_PASS_PERCENTS) - 1)];
    foreach (array_slice($modules, 0, $completed) as $number) {
        $key = sprintf('demo_%03d_module_%d', $index + 1, $number);
        demo_pass_module($pdo, $user, $number, $percent, $key);
        $attempts++;
        if (mt_rand(0, 3) > 0) {
            aapm_record_module_event($user, $number, 'practice_attested', ['requestKey' => $key . '_practice', 'attested' => true]);
        }
        $minutes = mt_rand(10, 30);
        for ($part = 0; $minutes > 0; $part++) {
            $increment = min(15, $minutes);
            aapm_record_module_event($user, $number, 'study_time_increment', ['requestKey' => $key . '_study_' . $part, 'minutes' => $increment]);
            $minutes -= $increment;
        }
    }
    fwrite(STDOUT, sprintf("%s: %d modul\n", $name, $completed));
}
aapm_audit('demo.learners_created', 'ok', null, null, $audit + ['accounts' => $count, 'attempts' => $attempts]);
demo_finish(0, json_encode(['environment' => $environment, 'mode' => 'apply', 'policy' => $policy, 'accountsCreated' => $count, 'moduleAttempts' => $attempts, 'certificates' => 0, 'changed' => true], JSON_PRETTY_PRINT));
