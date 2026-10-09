<?php
declare(strict_types=1);

/**
 * Test helper: one attempt to consume a verification token, run as its own
 * process so two attempts can genuinely race on the same database file.
 *
 *   php consume-token.php <token>
 */

require __DIR__ . '/../../../public/api/bootstrap.php';

$userId = aapm_consume_verification_token($argv[1] ?? '');
echo $userId === null ? 'rejected' : 'consumed:' . $userId;
