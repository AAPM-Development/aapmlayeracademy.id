<?php
declare(strict_types=1);

/**
 * Q02 identity and authorization primitives, loaded by bootstrap.php.
 *
 * Authority rules, enforced here and in bootstrap.php:
 * - Administrator capability comes only from the stored role plus a verified
 *   identity. Configuration, email matching, and request data never grant it.
 * - Verification tokens are random, stored as SHA-256 hashes, single use, and
 *   expire after 24 hours. A newer token supersedes older ones.
 * - Every role or password change bumps auth_version, which invalidates older
 *   sessions on their next authenticated request.
 */

const AAPM_VERIFICATION_TTL_SECONDS = 86400;
const AAPM_AUTH_SCHEMA_KEY = '20261010_auth_verification_security_v1';
const AAPM_AUDIT_METADATA_KEYS = ['reason', 'source', 'channel', 'operator', 'evidence_ref', 'role_from', 'role_to', 'identity', 'count', 'generation_from', 'generation_to', 'tier', 'certificate'];

function aapm_utc_now(): string
{
    return gmdate('Y-m-d H:i:s');
}

function aapm_utc_later(int $seconds): string
{
    return gmdate('Y-m-d H:i:s', time() + $seconds);
}

/**
 * Three states. `verified` needs a trusted event. `pending` is a new password
 * account awaiting verification. `legacy_pending` predates Q02 and has no
 * recorded evidence; it keeps learner access but never administration.
 *
 * @param array<string,mixed> $row
 */
function aapm_verification_status(array $row): string
{
    if (!empty($row['email_verified_at'])) {
        return 'verified';
    }
    if (!empty($row['verification_required_at'])) {
        return 'pending';
    }

    return 'legacy_pending';
}

function aapm_database_driver(): string
{
    return (string) app_config()['db_driver'];
}

/** SQLite serializes writers with BEGIN IMMEDIATE; MySQL uses an ordinary transaction plus row locks. */
function aapm_tx_begin(PDO $pdo): void
{
    if (aapm_database_driver() === 'sqlite') {
        $pdo->exec('BEGIN IMMEDIATE');
        return;
    }
    $pdo->beginTransaction();
}

function aapm_tx_commit(PDO $pdo): void
{
    if (aapm_database_driver() === 'sqlite') {
        $pdo->exec('COMMIT');
        return;
    }
    $pdo->commit();
}

function aapm_tx_rollback(PDO $pdo): void
{
    if (!$pdo->inTransaction()) {
        return;
    }
    if (aapm_database_driver() === 'sqlite') {
        $pdo->exec('ROLLBACK');
        return;
    }
    $pdo->rollBack();
}

/** Locks the administrator rows so two concurrent role changes cannot both see a second administrator. */
function aapm_lock_admin_rows(PDO $pdo): void
{
    if (aapm_database_driver() === 'sqlite') {
        return;
    }
    $pdo->query("SELECT id FROM users WHERE role = 'admin' FOR UPDATE")->fetchAll();
}

function aapm_verified_admin_count(PDO $pdo): int
{
    $statement = $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND email_verified_at IS NOT NULL");

    return (int) $statement->fetchColumn();
}

function aapm_identity_digest(string $email): string
{
    return substr(hash('sha256', strtolower(trim($email))), 0, 16);
}

/** Only allow-listed, short, non-secret metadata is ever written. */
function aapm_sanitize_audit_metadata(array $metadata): array
{
    $clean = [];
    foreach ($metadata as $key => $value) {
        if (!in_array((string) $key, AAPM_AUDIT_METADATA_KEYS, true)) {
            continue;
        }
        if (is_int($value) || is_bool($value)) {
            $clean[$key] = $value;
            continue;
        }
        if (is_string($value)) {
            $clean[$key] = substr(preg_replace('/[\x00-\x1F\x7F]/', '', $value), 0, 120);
        }
    }

    return $clean;
}

/** Append-only. Callers that change privileges write this inside the same transaction. */
function aapm_audit(string $eventType, string $result, ?int $actorId, ?int $targetId, array $metadata = []): void
{
    db()->prepare(
        'INSERT INTO security_audit_events (actor_user_id, target_user_id, event_type, result, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([
        $actorId ? $actorId : null,
        $targetId ? $targetId : null,
        $eventType,
        $result,
        json_encode(aapm_sanitize_audit_metadata($metadata), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        aapm_utc_now(),
    ]);
}

/** @param array<string,mixed> $user needs id and auth_version */
function aapm_establish_session(array $user): void
{
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $user['id'];
    $_SESSION['auth_version'] = (int) ($user['auth_version'] ?? 1);
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

/**
 * Replaces every outstanding verification token for the account. Superseded
 * tokens are marked used so they cannot be redeemed. Call inside a transaction.
 */
function aapm_issue_verification_token(PDO $pdo, int $userId): string
{
    $token = bin2hex(random_bytes(32));
    $now = aapm_utc_now();
    $pdo->prepare('UPDATE email_verification_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL')
        ->execute([$now, $userId]);
    $pdo->prepare('INSERT INTO email_verification_tokens (user_id, token_hash, expires_at, used_at, created_at) VALUES (?, ?, ?, NULL, ?)')
        ->execute([$userId, hash('sha256', $token), aapm_utc_later(AAPM_VERIFICATION_TTL_SECONDS), $now]);

    return $token;
}

/**
 * Atomically consumes a verification token. Exactly one concurrent submission
 * can succeed: the guarded UPDATE must affect one row.
 */
function aapm_consume_verification_token(string $token): ?int
{
    if (!preg_match('/\A[a-f0-9]{64}\z/', $token)) {
        return null;
    }

    $pdo = db();
    aapm_tx_begin($pdo);
    try {
        $statement = $pdo->prepare('SELECT id, user_id FROM email_verification_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? LIMIT 1');
        $statement->execute([hash('sha256', $token), aapm_utc_now()]);
        $row = $statement->fetch();
        if (!$row) {
            aapm_tx_rollback($pdo);
            return null;
        }

        $now = aapm_utc_now();
        $consume = $pdo->prepare('UPDATE email_verification_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL');
        $consume->execute([$now, (int) $row['id']]);
        if ($consume->rowCount() !== 1) {
            aapm_tx_rollback($pdo);
            return null;
        }

        $userId = (int) $row['user_id'];
        $pdo->prepare('UPDATE email_verification_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL')
            ->execute([$now, $userId]);
        $pdo->prepare('UPDATE users SET email_verified_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND email_verified_at IS NULL')
            ->execute([$now, $userId]);
        aapm_tx_commit($pdo);

        return $userId;
    } catch (Throwable $exception) {
        aapm_tx_rollback($pdo);
        throw $exception;
    }
}

function aapm_bump_auth_version(PDO $pdo, int $userId): void
{
    $pdo->prepare('UPDATE users SET auth_version = auth_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        ->execute([$userId]);
}

function aapm_verification_url(string $token): string
{
    return app_base_url() . '/verify-email#token=' . $token;
}

function aapm_send_verification_email(string $email, string $token): bool
{
    $from = trim((string) (app_config()['mail_from'] ?? ''));
    if ($from === '' || !filter_var($from, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $link = aapm_verification_url($token);
    if (strpos($link, '://') === false) {
        return false;
    }

    $subject = 'Verifikasi email AAPM Layer Academy';
    $body = "Halo,\n\nGunakan tautan berikut untuk memverifikasi alamat email akun AAPM Layer Academy Anda dalam waktu 24 jam:\n"
        . $link . "\n\nJika Anda tidak membuat akun ini, abaikan email ini.\n";
    $headers = implode("\r\n", [
        'From: ' . $from,
        'Reply-To: ' . $from,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
    ]);

    if (function_exists('mail') && @mail($email, $subject, $body, $headers)) {
        return true;
    }

    return send_smtp_email($email, $from, $subject, $body);
}

/**
 * Issues a fresh token for a pending or legacy account and attempts delivery.
 * Delivery failure leaves the account unverified and retryable; it is audited.
 */
function aapm_send_fresh_verification(int $userId, string $email, string $eventType): array
{
    $pdo = db();
    aapm_tx_begin($pdo);
    try {
        $token = aapm_issue_verification_token($pdo, $userId);
        aapm_tx_commit($pdo);
    } catch (Throwable $exception) {
        aapm_tx_rollback($pdo);
        throw $exception;
    }

    $sent = aapm_send_verification_email($email, $token);
    aapm_audit($eventType, $sent ? 'sent' : 'delivery_failed', null, $userId, ['channel' => 'email']);

    return ['sent' => $sent, 'token' => $token];
}

/**
 * Local-development exposure only, gated exactly like the reset-token flow:
 * the local environment and the explicit dev flag. Deployed environments never
 * receive a verification token in a response.
 *
 * @return array<string,string>
 */
function aapm_dev_token_payload(string $token): array
{
    $config = app_config();

    return $config['environment'] === 'local' && !empty($config['expose_dev_reset_token'])
        ? ['devVerificationToken' => $token]
        : [];
}

function aapm_security_audit_page(int $limit, int $offset): array
{
    $limit = max(1, min(100, $limit));
    $offset = max(0, $offset);
    $rows = db()->query(
        'SELECT id, actor_user_id, target_user_id, event_type, result, metadata_json, created_at FROM security_audit_events ORDER BY id DESC LIMIT '
        . $limit . ' OFFSET ' . $offset
    )->fetchAll();

    return array_map(static function (array $row): array {
        $metadata = json_decode((string) $row['metadata_json'], true);

        return [
            'id' => (int) $row['id'],
            'actorUserId' => $row['actor_user_id'] === null ? null : (int) $row['actor_user_id'],
            'targetUserId' => $row['target_user_id'] === null ? null : (int) $row['target_user_id'],
            'eventType' => (string) $row['event_type'],
            'result' => (string) $row['result'],
            'metadata' => is_array($metadata) ? aapm_sanitize_audit_metadata($metadata) : [],
            'createdAt' => (string) $row['created_at'],
        ];
    }, $rows);
}

function aapm_table_exists(PDO $pdo, string $table): bool
{
    if (aapm_database_driver() === 'sqlite') {
        $statement = $pdo->prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?");
    } else {
        $statement = $pdo->prepare('SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?');
    }
    $statement->execute([$table]);

    return (bool) $statement->fetchColumn();
}

function aapm_column_exists(PDO $pdo, string $table, string $column): bool
{
    if (aapm_database_driver() === 'sqlite') {
        foreach ($pdo->query('PRAGMA table_info(' . $table . ')')->fetchAll() as $info) {
            if ((string) $info['name'] === $column) {
                return true;
            }
        }

        return false;
    }
    $statement = $pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?');
    $statement->execute([$table, $column]);

    return (bool) $statement->fetchColumn();
}

/** Additive, idempotent schema for Q02. Runs for fresh and upgraded databases alike. */
function aapm_ensure_auth_security_schema(PDO $pdo, string $driver): void
{
    static $ready = false;
    if ($ready || !aapm_table_exists($pdo, 'users')) {
        return;
    }

    $sqlite = $driver === 'sqlite';
    $columns = [
        ['email_verified_at', $sqlite ? 'ALTER TABLE users ADD COLUMN email_verified_at TEXT NULL' : 'ALTER TABLE users ADD COLUMN email_verified_at DATETIME NULL'],
        ['verification_required_at', $sqlite ? 'ALTER TABLE users ADD COLUMN verification_required_at TEXT NULL' : 'ALTER TABLE users ADD COLUMN verification_required_at DATETIME NULL'],
        ['auth_version', $sqlite ? 'ALTER TABLE users ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 1' : 'ALTER TABLE users ADD COLUMN auth_version INT UNSIGNED NOT NULL DEFAULT 1'],
    ];
    foreach ($columns as [$name, $sql]) {
        if (aapm_column_exists($pdo, 'users', $name)) {
            continue;
        }
        try {
            $pdo->exec($sql);
        } catch (PDOException $exception) {
            // Another request may have added the column between the check and the change.
            if (!aapm_column_exists($pdo, 'users', $name)) {
                throw $exception;
            }
        }
    }

    if ($sqlite) {
        $statements = [
            'CREATE TABLE IF NOT EXISTS email_verification_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                expires_at TEXT NOT NULL,
                used_at TEXT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )',
            'CREATE INDEX IF NOT EXISTS email_verification_tokens_user_idx ON email_verification_tokens(user_id, expires_at)',
            'CREATE TABLE IF NOT EXISTS security_audit_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                actor_user_id INTEGER NULL,
                target_user_id INTEGER NULL,
                event_type TEXT NOT NULL,
                result TEXT NOT NULL,
                metadata_json TEXT NOT NULL DEFAULT \'{}\',
                created_at TEXT NOT NULL
            )',
            'CREATE INDEX IF NOT EXISTS security_audit_target_idx ON security_audit_events(target_user_id, created_at)',
            'CREATE INDEX IF NOT EXISTS security_audit_actor_idx ON security_audit_events(actor_user_id, created_at)',
            'CREATE INDEX IF NOT EXISTS security_audit_event_idx ON security_audit_events(event_type, created_at)',
        ];
    } else {
        $suffix = ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
        $statements = [
            'CREATE TABLE IF NOT EXISTS email_verification_tokens (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                user_id BIGINT UNSIGNED NOT NULL,
                token_hash CHAR(64) NOT NULL,
                expires_at DATETIME NOT NULL,
                used_at DATETIME NULL,
                created_at DATETIME NOT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY email_verification_tokens_hash_unique (token_hash),
                KEY email_verification_tokens_user_idx (user_id, expires_at),
                CONSTRAINT email_verification_tokens_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )' . $suffix,
            'CREATE TABLE IF NOT EXISTS security_audit_events (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                actor_user_id BIGINT UNSIGNED NULL,
                target_user_id BIGINT UNSIGNED NULL,
                event_type VARCHAR(64) NOT NULL,
                result VARCHAR(16) NOT NULL,
                metadata_json TEXT NOT NULL,
                created_at DATETIME NOT NULL,
                PRIMARY KEY (id),
                KEY security_audit_target_idx (target_user_id, created_at),
                KEY security_audit_actor_idx (actor_user_id, created_at),
                KEY security_audit_event_idx (event_type, created_at)
            )' . $suffix,
        ];
    }
    foreach ($statements as $sql) {
        $pdo->exec($sql);
    }

    $ready = true;
}

/** Read-only inventory used by migrate.php and the provisioning preflight. */
function aapm_auth_schema_status(PDO $pdo): array
{
    return [
        'users.email_verified_at' => aapm_column_exists($pdo, 'users', 'email_verified_at'),
        'users.verification_required_at' => aapm_column_exists($pdo, 'users', 'verification_required_at'),
        'users.auth_version' => aapm_column_exists($pdo, 'users', 'auth_version'),
        'email_verification_tokens' => aapm_table_exists($pdo, 'email_verification_tokens'),
        'security_audit_events' => aapm_table_exists($pdo, 'security_audit_events'),
    ];
}
