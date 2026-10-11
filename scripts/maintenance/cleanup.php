<?php
declare(strict_types=1);

/**
 * Daily housekeeping for tables that only grow. CLI only; never reachable over HTTP.
 *
 * Removes rows that no request can use any more:
 * - auth_rate_limits: windows older than a day that are not blocking (the longest
 *   window or block in the API is one hour).
 * - email_verification_tokens: expired or used more than 7 days ago (TTL is 24 h).
 * - users.reset_token_*: password-reset tokens that expired more than a day ago
 *   (TTL is 1 h); the account itself is untouched.
 * - security_audit_events: older than --audit-days (default 365; 0 keeps all).
 *
 * Academic records, attempts, certificates, farm data, conversations and the APPI
 * activity log are never touched.
 *
 *   php scripts/maintenance/cleanup.php --expect-environment=production --dry-run
 *   php scripts/maintenance/cleanup.php --expect-environment=production --apply
 *
 * Exit codes: 0 success or dry-run, 1 refused or failed without changes, 2 usage error.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Pembersihan hanya dapat dijalankan dari CLI.\n");
}

require_once __DIR__ . '/../../public/api/bootstrap.php';

function cleanup_fail(string $message, int $status = 1): void
{
    fwrite(STDERR, 'cleanup: ' . $message . PHP_EOL);
    exit($status);
}

$options = getopt('', ['expect-environment:', 'audit-days:', 'dry-run', 'apply', 'json']);
$expected = strtolower(trim((string) ($options['expect-environment'] ?? '')));
$apply = isset($options['apply']);
$dryRun = isset($options['dry-run']);
$auditDays = isset($options['audit-days']) ? (int) $options['audit-days'] : 365;

if (!in_array($expected, AAPM_ENVIRONMENTS, true)) {
    cleanup_fail('--expect-environment wajib diisi (production, staging, local, test).', 2);
}
if ($apply === $dryRun) {
    cleanup_fail('pilih salah satu: --dry-run atau --apply.', 2);
}
if ($auditDays !== 0 && $auditDays < 90) {
    cleanup_fail('--audit-days minimal 90 (atau 0 untuk menyimpan semua).', 2);
}

try {
    $config = app_config();
} catch (AppConfigException $exception) {
    error_log('[aapm-cleanup] configuration refused: ' . $exception->safeCode());
    cleanup_fail('konfigurasi belum siap (' . $exception->safeCode() . '). Tidak ada perubahan.');
}
if ((string) $config['environment'] !== $expected) {
    cleanup_fail('target tidak cocok: konfigurasi memakai lingkungan ' . $config['environment'] . ', --expect-environment=' . $expected . '. Tidak ada perubahan.', 2);
}

try {
    // Deployed environments verify the environment marker inside db(), before any read.
    $pdo = db();
} catch (AppConfigException $exception) {
    error_log('[aapm-cleanup] database refused: ' . $exception->safeCode());
    cleanup_fail('penanda lingkungan database belum valid (' . $exception->safeCode() . '). Tidak ada perubahan.');
}

$nowEpoch = time();
$utc = static fn (int $seconds): string => gmdate('Y-m-d H:i:s', $nowEpoch - $seconds);
// Password-reset expiry is written in server-local time; a day of margin absorbs the offset.
$local = static fn (int $seconds): string => date('Y-m-d H:i:s', $nowEpoch - $seconds);

$tasks = [
    'auth_rate_limits' => [
        'count' => 'SELECT COUNT(*) FROM auth_rate_limits WHERE window_started_at < ? AND (blocked_until IS NULL OR blocked_until < ?)',
        'apply' => 'DELETE FROM auth_rate_limits WHERE window_started_at < ? AND (blocked_until IS NULL OR blocked_until < ?)',
        'params' => [$nowEpoch - 86400, $nowEpoch],
    ],
    'email_verification_tokens' => [
        'count' => 'SELECT COUNT(*) FROM email_verification_tokens WHERE expires_at < ? OR (used_at IS NOT NULL AND used_at < ?)',
        'apply' => 'DELETE FROM email_verification_tokens WHERE expires_at < ? OR (used_at IS NOT NULL AND used_at < ?)',
        'params' => [$utc(7 * 86400), $utc(7 * 86400)],
    ],
    'password_reset_tokens' => [
        'count' => 'SELECT COUNT(*) FROM users WHERE reset_token_hash IS NOT NULL AND reset_token_expires_at < ?',
        'apply' => 'UPDATE users SET reset_token_hash = NULL, reset_token_expires_at = NULL WHERE reset_token_hash IS NOT NULL AND reset_token_expires_at < ?',
        'params' => [$local(86400)],
    ],
];
if ($auditDays > 0) {
    $tasks['security_audit_events'] = [
        'count' => 'SELECT COUNT(*) FROM security_audit_events WHERE created_at < ?',
        'apply' => 'DELETE FROM security_audit_events WHERE created_at < ?',
        'params' => [$utc($auditDays * 86400)],
    ];
}

$report = ['environment' => $expected, 'mode' => $apply ? 'apply' : 'dry-run', 'auditDays' => $auditDays, 'tables' => []];
try {
    foreach ($tasks as $name => $task) {
        $count = $pdo->prepare($task['count']);
        $count->execute($task['params']);
        $matching = (int) $count->fetchColumn();
        $changed = 0;
        if ($apply && $matching > 0) {
            $statement = $pdo->prepare($task['apply']);
            $statement->execute($task['params']);
            $changed = $statement->rowCount();
        }
        $report['tables'][$name] = ['matching' => $matching, 'changed' => $changed];
    }
} catch (Throwable $exception) {
    error_log('[aapm-cleanup] failed: ' . get_class($exception));
    cleanup_fail('pembersihan gagal di tengah jalan; baris yang belum diproses tetap utuh.');
}

if ($apply) {
    aapm_audit('maintenance.cleanup', 'ok', null, null, ['tables' => $report['tables'], 'auditDays' => $auditDays]);
}

if (isset($options['json'])) {
    echo json_encode($report, JSON_UNESCAPED_SLASHES) . PHP_EOL;
} else {
    echo 'cleanup ' . $report['mode'] . ' (' . $expected . ')' . PHP_EOL;
    foreach ($report['tables'] as $name => $row) {
        echo sprintf('  %-28s %6d cocok, %6d diubah', $name, $row['matching'], $row['changed']) . PHP_EOL;
    }
}
exit(0);
