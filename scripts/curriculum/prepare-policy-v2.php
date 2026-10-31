<?php
declare(strict_types=1);

/**
 * Operator-only preparation of the academy-v2 policy: clones the active policy, sets the
 * 23 required modules (quiz mode) and the v2 certificate tiers, validates, and marks it
 * ready. It does NOT activate. Activation stays with activate-policy.php, so the review
 * step remains a separate operator decision. Refuses HTTP invocation.
 *
 *   php scripts/curriculum/prepare-policy-v2.php --expect-environment=local --actor-email=ADMIN --dry-run
 *   php scripts/curriculum/prepare-policy-v2.php --expect-environment=local --actor-email=ADMIN --apply
 *
 * Every module 1..23 must already exist in the catalogue (module 23 is created before the
 * curriculum import). The tier mapping follows the curriculum v2.0 document (chapters
 * 1-3, 4-7 by phase, 8-14, 15-19, 20-21, and 22-23 with the final exam).
 */

if (PHP_SAPI !== 'cli' || isset($_SERVER['HTTP_HOST']) || isset($_SERVER['REQUEST_METHOD'])) {
    http_response_code(403);
    fwrite(STDERR, "Persiapan kebijakan hanya dapat dijalankan dari CLI operator.\n");
    exit(2);
}

require __DIR__ . '/../../public/api/bootstrap.php';

const PREPARE_VERSION = 'academy-v2';
const PREPARE_MODULE_COUNT = 23;
const PREPARE_TIERS = [
    1 => ['name' => 'Layer Poultry Farm Foundation', 'modules' => [1, 2, 3], 'requiresFinal' => false],
    2 => ['name' => 'Layer Farm Operator', 'modules' => [4, 5, 6, 7], 'requiresFinal' => false],
    3 => ['name' => 'Layer Farm Supervisor', 'modules' => [8, 9, 10, 11, 12, 13, 14], 'requiresFinal' => false],
    4 => ['name' => 'Layer Farm Manager', 'modules' => [15, 16, 17, 18, 19], 'requiresFinal' => false],
    5 => ['name' => 'Advanced Layer Farm Management', 'modules' => [20, 21], 'requiresFinal' => false],
    6 => ['name' => 'Layer Poultry Farm Expert', 'modules' => [22, 23], 'requiresFinal' => true],
];

function prepare_fail(int $code, string $message): void
{
    fwrite(STDERR, $message . "\n");
    exit($code);
}

$options = [];
foreach (array_slice($argv, 1) as $argument) {
    if (!preg_match('/\A--([a-z-]+)(?:=(.*))?\z/', $argument, $match)) {
        prepare_fail(2, 'Argumen tidak dikenal: ' . substr($argument, 0, 60));
    }
    $options[$match[1]] = $match[2] ?? true;
}
$allowed = ['expect-environment', 'actor-email', 'dry-run', 'apply'];
foreach (array_keys($options) as $key) {
    if (!in_array($key, $allowed, true)) {
        prepare_fail(2, 'Opsi tidak dikenal: --' . $key);
    }
}
$dryRun = isset($options['dry-run']);
$apply = isset($options['apply']);
if ($dryRun === $apply) {
    prepare_fail(2, 'Pilih tepat satu: --dry-run atau --apply.');
}
$expectedEnvironment = strtolower(trim((string) ($options['expect-environment'] ?? '')));
$actorEmail = strtolower(trim((string) ($options['actor-email'] ?? '')));
if ($expectedEnvironment === '' || $actorEmail === '') {
    prepare_fail(2, '--expect-environment dan --actor-email wajib diisi.');
}

try {
    $config = app_config();
} catch (AppConfigException $exception) {
    prepare_fail(3, 'Konfigurasi tidak valid: ' . $exception->safeCode());
}
$environment = strtolower((string) ($config['environment'] ?? ''));
if ($environment !== $expectedEnvironment) {
    prepare_fail(3, "Target tidak cocok: konfigurasi memakai lingkungan {$environment}, --expect-environment={$expectedEnvironment}. Tidak ada perubahan.");
}

$pdo = db();
$actorStatement = $pdo->prepare('SELECT id, role, email_verified_at FROM users WHERE LOWER(email) = ? LIMIT 1');
$actorStatement->execute([$actorEmail]);
$actor = $actorStatement->fetch();
if (!$actor || !in_array((string) $actor['role'], ['admin', 'super_admin'], true) || empty($actor['email_verified_at'])) {
    prepare_fail(3, 'Akun --actor-email harus Admin atau Super Admin yang emailnya sudah terverifikasi.');
}
$actorId = (int) $actor['id'];

// Every module the policy names must exist and be active before anything is written.
$missing = [];
for ($number = 1; $number <= PREPARE_MODULE_COUNT; $number++) {
    $statement = $pdo->prepare("SELECT COUNT(*) FROM course_modules WHERE module_number = ? AND lifecycle_status = 'active'");
    $statement->execute([$number]);
    if ((int) $statement->fetchColumn() !== 1) {
        $missing[] = $number;
    }
}
if ($missing !== []) {
    prepare_fail(4, 'Modul aktif belum lengkap, kebijakan tidak disiapkan: ' . implode(', ', $missing) . '. Buat dan impor modul tersebut lebih dulu.');
}

$modules = [];
for ($number = 1; $number <= PREPARE_MODULE_COUNT; $number++) {
    $modules[] = ['moduleNumber' => $number, 'required' => true, 'assessmentMode' => 'quiz'];
}
$tiers = [];
foreach (PREPARE_TIERS as $number => $tier) {
    $tiers[] = ['tierNumber' => $number, 'tierName' => $tier['name'], 'modules' => $tier['modules'], 'requiresFinal' => $tier['requiresFinal']];
}

$row = aapm_cur_policy_row($pdo, PREPARE_VERSION);
if ($dryRun) {
    $plan = [
        'environment' => $environment,
        'targetVersion' => PREPARE_VERSION,
        'exists' => $row !== null,
        'status' => $row['status'] ?? null,
        'currentActiveVersion' => aapm_cur_active_policy_version($pdo),
        'requiredModules' => PREPARE_MODULE_COUNT,
        'tiers' => array_map(static fn (array $tier): array => ['name' => $tier['name'], 'modules' => $tier['modules']], PREPARE_TIERS),
        'validationErrors' => $row ? aapm_cur_policy_errors($pdo, PREPARE_VERSION) : [],
        'mode' => 'dry-run',
    ];
    echo json_encode(['plan' => $plan, 'changed' => false], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n";
    exit(0);
}

if ($row === null) {
    aapm_cur_policy_create(PREPARE_VERSION, $actorId);
    $row = aapm_cur_policy_row($pdo, PREPARE_VERSION);
} elseif (!in_array((string) $row['status'], ['draft', 'ready'], true)) {
    prepare_fail(4, 'Versi academy-v2 sudah aktif atau digantikan dan tidak dapat disiapkan ulang.');
}

// Update, then mark ready: each step reads the draft version it saw, so a concurrent edit fails loudly.
aapm_cur_policy_update(PREPARE_VERSION, [
    'expectedDraftVersion' => (int) $row['draft_version'],
    'modules' => $modules,
    'tiers' => $tiers,
], $actorId);
$row = aapm_cur_policy_row($pdo, PREPARE_VERSION);
$validation = aapm_cur_policy_validate(PREPARE_VERSION, $actorId, (int) $row['draft_version']);
if (!$validation['valid']) {
    prepare_fail(4, 'Kebijakan tidak lolos validasi: ' . json_encode($validation['errors'], JSON_UNESCAPED_UNICODE));
}
$ready = aapm_cur_policy_mark_ready(PREPARE_VERSION, $actorId, (int) $row['draft_version']);

echo json_encode(['policy' => $ready, 'changed' => true, 'mode' => 'apply'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n";
exit(0);
