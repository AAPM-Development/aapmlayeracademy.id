<?php
declare(strict_types=1);

/**
 * Operator-only activation of a ready curriculum policy for NEW accounts. Existing
 * learners keep their assigned policy. This script refuses HTTP invocation, requires
 * the expected environment, and needs an operator name and evidence reference to apply.
 *
 *   php scripts/curriculum/activate-policy.php --policy-version=academy-v2 --expect-environment=local --dry-run
 *   php scripts/curriculum/activate-policy.php --policy-version=academy-v2 --expect-environment=local --apply --operator=NAME --evidence-ref=REF
 */

if (PHP_SAPI !== 'cli' || isset($_SERVER['HTTP_HOST']) || isset($_SERVER['REQUEST_METHOD'])) {
    http_response_code(403);
    fwrite(STDERR, "Aktivasi kebijakan hanya dapat dijalankan dari CLI operator.\n");
    exit(2);
}

require __DIR__ . '/../../public/api/bootstrap.php';

function activation_fail(int $code, string $message): void
{
    fwrite(STDERR, $message . "\n");
    exit($code);
}

$options = [];
foreach (array_slice($argv, 1) as $argument) {
    if (!preg_match('/\A--([a-z-]+)(?:=(.*))?\z/', $argument, $match)) {
        activation_fail(2, 'Argumen tidak dikenal: ' . substr($argument, 0, 60));
    }
    $options[$match[1]] = $match[2] ?? true;
}

$allowed = ['policy-version', 'expect-environment', 'dry-run', 'apply', 'operator', 'evidence-ref'];
foreach (array_keys($options) as $key) {
    if (!in_array($key, $allowed, true)) {
        activation_fail(2, 'Opsi tidak dikenal: --' . $key);
    }
}

$dryRun = isset($options['dry-run']);
$apply = isset($options['apply']);
if ($dryRun === $apply) {
    activation_fail(2, 'Pilih tepat satu: --dry-run atau --apply.');
}
$expectedEnvironment = strtolower(trim((string) ($options['expect-environment'] ?? '')));
if ($expectedEnvironment === '') {
    activation_fail(2, '--expect-environment wajib diisi.');
}
$version = trim((string) ($options['policy-version'] ?? ''));
if (!preg_match('/\Aacademy-v[0-9]{1,3}\z/', $version)) {
    activation_fail(2, '--policy-version tidak valid.');
}
$operator = trim((string) ($options['operator'] ?? ''));
$evidence = trim((string) ($options['evidence-ref'] ?? ''));
if ($apply && ($operator === '' || $evidence === '')) {
    activation_fail(2, '--apply membutuhkan --operator dan --evidence-ref.');
}

try {
    $config = app_config();
} catch (AppConfigException $exception) {
    activation_fail(3, 'Konfigurasi tidak valid: ' . $exception->safeCode());
}
$environment = strtolower((string) ($config['environment'] ?? ''));
if ($environment !== $expectedEnvironment) {
    activation_fail(3, "Target tidak cocok: konfigurasi memakai lingkungan {$environment}, --expect-environment={$expectedEnvironment}. Tidak ada perubahan.");
}

$pdo = db();
$row = aapm_cur_policy_row($pdo, $version);
if (!$row) {
    activation_fail(4, 'Kebijakan tidak ditemukan.');
}
// This is advisory plan output. Apply re-reads and validates the full canonical
// policy and its dependencies under aapm_cur_policy_activate's transaction locks.
$errors = aapm_cur_policy_errors($pdo, $version);
$plan = [
    'environment' => $environment,
    'targetVersion' => $version,
    'targetStatus' => (string) $row['status'],
    'currentActiveVersion' => aapm_cur_active_policy_version($pdo),
    'validationErrors' => $errors,
    'mode' => $dryRun ? 'dry-run' : 'apply',
];

if ($dryRun) {
    echo json_encode(['plan' => $plan, 'changed' => false], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
    exit(0);
}
if ((string) $row['status'] !== 'ready') {
    activation_fail(4, 'Kebijakan belum siap. Validasi dan tandai siap terlebih dahulu.');
}
if ($errors !== []) {
    activation_fail(4, 'Kebijakan tidak lolos validasi ulang. Tidak ada perubahan.');
}

try {
    $result = aapm_cur_policy_activate($pdo, $version, null, ['operator' => $operator, 'evidence_ref' => $evidence]);
} catch (Throwable $exception) {
    $reason = $exception instanceof RuntimeException && in_array($exception->getMessage(), ['policy_not_ready', 'policy_invalid'], true)
        ? $exception->getMessage() : 'activation_failed';
    activation_fail(5, 'Aktivasi dibatalkan: ' . $reason . '. Tidak ada perubahan.');
}

echo json_encode(['plan' => $plan, 'changed' => true, 'activated' => $result['version'], 'status' => $result['status']], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
exit(0);
