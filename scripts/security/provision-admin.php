<?php
declare(strict_types=1);

/**
 * Explicit administrator provisioning. CLI only; never reachable over HTTP.
 *
 * Requirements enforced here:
 * - The expected environment must match the private configuration. Deployed
 *   environments also verify the database marker before anything is read.
 * - The target is an existing account ID. An email address is never a target,
 *   and configured email allowlists never grant anything.
 * - The operator supplies an evidence reference for an identity check that was
 *   performed outside this system. This is a manually attested operation.
 * - Run --dry-run first. --apply repeats every precondition under a row lock,
 *   and the role change, verification event, and audit rows commit together.
 *
 *   php scripts/security/provision-admin.php --expect-environment=staging --user-id=123 \
 *       --actor=authorized-operator --evidence-ref=SECURITY-APPROVAL-001 --dry-run
 *
 * Exit codes: 0 success or dry-run, 1 refused or failed without changes, 2 usage error.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Provisioning hanya dapat dijalankan dari CLI.\n");
}

require_once __DIR__ . '/../../public/api/bootstrap.php';

function provision_fail(string $message, int $status = 1): void
{
    fwrite(STDERR, 'provision-admin: ' . $message . PHP_EOL);
    exit($status);
}

function provision_mask(string $email): string
{
    $at = strpos($email, '@');
    if ($at === false) {
        return '***';
    }

    return substr($email, 0, 1) . '***' . substr($email, $at);
}

/** Read-only inventory: the target, administrator counts, and configured-email migration candidates. */
function provision_report(PDO $pdo, array $row, array $config): array
{
    $candidates = [];
    foreach (legacy_config_admin_emails() as $email) {
        $statement = $pdo->prepare('SELECT id, role, email_verified_at, verification_required_at FROM users WHERE email = ? LIMIT 1');
        $statement->execute([$email]);
        $found = $statement->fetch();
        if ($found && effective_user_role($found) !== 'admin') {
            $candidates[] = ['userId' => (int) $found['id'], 'email' => provision_mask($email)];
        }
    }

    return [
        'environment' => (string) $config['environment'],
        'environmentMarkerRequired' => (bool) $config['environment_marker_required'],
        'userId' => (int) $row['id'],
        'email' => provision_mask((string) $row['email']),
        'storedRole' => in_array($row['role'] ?? '', ['admin', 'super_admin'], true) ? $row['role'] : 'learner',
        'verificationStatus' => aapm_verification_status($row),
        'effectiveRole' => effective_user_role($row),
        'verifiedAdminCount' => aapm_verified_admin_count($pdo),
        'unverifiedStoredAdminCount' => (int) $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND email_verified_at IS NULL")->fetchColumn(),
        'configuredEmailCandidates' => $candidates,
    ];
}

function provision_emit(array $result, bool $json): void
{
    if ($json) {
        echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
        return;
    }
    foreach ($result as $key => $value) {
        if (is_array($value)) {
            $value = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } elseif (is_bool($value)) {
            $value = $value ? 'yes' : 'no';
        }
        echo $key . ': ' . $value . PHP_EOL;
    }
}

$options = getopt('', ['expect-environment:', 'user-id:', 'actor:', 'evidence-ref:', 'role:', 'dry-run', 'apply', 'json']);
$expected = strtolower(trim((string) ($options['expect-environment'] ?? '')));
$userId = (int) ($options['user-id'] ?? 0);
$actor = trim((string) ($options['actor'] ?? ''));
$evidence = trim((string) ($options['evidence-ref'] ?? ''));
$targetRole = (string) ($options['role'] ?? 'admin');
if (!in_array($targetRole, ['admin', 'super_admin'], true)) provision_fail('--role harus admin atau super_admin.', 2);
$apply = isset($options['apply']);
$json = isset($options['json']);
if ($apply && isset($options['dry-run'])) {
    provision_fail('gunakan --dry-run atau --apply, bukan keduanya.', 2);
}
if ($expected === '') {
    provision_fail('--expect-environment wajib diisi.', 2);
}
if ($userId < 1) {
    provision_fail('--user-id harus berupa ID pengguna yang sudah ada.', 2);
}
if (!preg_match('/\A[A-Za-z0-9._@-]{2,80}\z/', $actor)) {
    provision_fail('--actor wajib diisi dengan pengenal operator yang valid.', 2);
}
if (!preg_match('/\A[A-Za-z0-9][A-Za-z0-9._-]{5,79}\z/', $evidence)) {
    provision_fail('--evidence-ref wajib diisi dengan referensi bukti yang valid.', 2);
}

try {
    $config = app_config();
} catch (AppConfigException $exception) {
    error_log('[aapm-provision-admin] configuration refused: ' . $exception->safeCode());
    provision_fail('konfigurasi belum siap (' . $exception->safeCode() . '). Tidak ada perubahan.');
}
if ((string) $config['environment'] !== $expected) {
    provision_fail('target tidak cocok: konfigurasi memakai lingkungan ' . $config['environment'] . ', --expect-environment=' . $expected . '. Tidak ada perubahan.', 2);
}

try {
    // Deployed environments verify the environment marker inside db(), before any read.
    $pdo = db();
} catch (AppConfigException $exception) {
    error_log('[aapm-provision-admin] database refused: ' . $exception->safeCode());
    provision_fail('penanda lingkungan database belum valid (' . $exception->safeCode() . '). Tidak ada perubahan.');
}
$statement = $pdo->prepare('SELECT id, email, full_name, role, created_at, email_verified_at, verification_required_at, auth_version FROM users WHERE id = ? LIMIT 1');
$statement->execute([$userId]);
$row = $statement->fetch();
if (!$row) {
    provision_fail('pengguna dengan ID tersebut tidak ditemukan. Tidak ada perubahan.');
}
if ($targetRole === 'super_admin' && (!in_array($row['role'] ?? '', ['admin', 'super_admin'], true) || aapm_verification_status($row) !== 'verified')) {
    provision_fail('Promosi Super Admin hanya untuk akun admin yang sudah terverifikasi.');
}

if (($row['role'] ?? '') === 'super_admin' && $targetRole !== 'super_admin') provision_fail('Super Admin tidak dapat diturunkan melalui provisioning.');
$report = provision_report($pdo, $row, $config);
$report['targetRole'] = $targetRole;
if (!$apply) {
    $report['mode'] = 'dry-run';
    $report['wouldChange'] = $report['effectiveRole'] !== $targetRole;
    provision_emit($report, $json);
    exit(0);
}

if ($report['effectiveRole'] === $targetRole) {
    $report['mode'] = 'apply';
    $report['result'] = 'already_provisioned';
    provision_emit($report, $json);
    exit(0);
}

aapm_tx_begin($pdo);
try {
    aapm_lock_admin_rows($pdo);
    $statement->execute([$userId]);
    $fresh = $statement->fetch();
    if (!$fresh) {
        throw new RuntimeException('account vanished before the change');
    }
    if (($fresh['role'] ?? '') === 'super_admin' && $targetRole !== 'super_admin') {
        throw new RuntimeException('protected super administrator');
    }
    if (effective_user_role($fresh) === $targetRole) {
        aapm_tx_rollback($pdo);
        $report['mode'] = 'apply';
        $report['result'] = 'already_provisioned';
        provision_emit($report, $json);
        exit(0);
    }

    $wasVerified = !empty($fresh['email_verified_at']);
    $storedBefore = strtolower(trim((string) $fresh['role'])) === 'admin' ? 'admin' : 'learner';
    $pdo->prepare('UPDATE users SET role = ?, email_verified_at = COALESCE(email_verified_at, ?), auth_version = auth_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        ->execute([$targetRole, aapm_utc_now(), $userId]);
    if (!$wasVerified) {
        aapm_audit('auth.email_verified', 'ok', null, $userId, ['channel' => 'manual_provisioning', 'operator' => $actor, 'evidence_ref' => $evidence]);
    }
    aapm_audit('admin.provisioned', 'ok', null, $userId, [
        'operator' => $actor,
        'evidence_ref' => $evidence,
        'role_from' => $storedBefore,
        'role_to' => $targetRole,
    ]);
    aapm_tx_commit($pdo);
} catch (Throwable $exception) {
    aapm_tx_rollback($pdo);
    // The driver message can contain SQL or hosts; log only its class.
    error_log('[aapm-provision-admin] change rolled back: ' . get_class($exception));
    provision_fail('perubahan dibatalkan. Tidak ada perubahan yang tersimpan.');
}

$statement->execute([$userId]);
$report = provision_report($pdo, $statement->fetch() ?: $row, $config);
$report['targetRole'] = $targetRole;
$report['mode'] = 'apply';
$report['result'] = 'provisioned';
$report['operator'] = $actor;
$report['evidenceRef'] = $evidence;
provision_emit($report, $json);
exit(0);
