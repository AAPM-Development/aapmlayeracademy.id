<?php
declare(strict_types=1);

/**
 * Test helper: one administrator demotion, run as its own process to race the
 * last-administrator guard. The actor is a database ID, as in a real request.
 *
 *   php demote.php <actor id> <target id>
 */

require __DIR__ . '/../../../public/api/bootstrap.php';

$actor = ['id' => (int) ($argv[1] ?? 0)];
$updated = admin_update_user($actor, (int) ($argv[2] ?? 0), ['role' => 'learner']);
echo json_encode(['ok' => true, 'role' => $updated['role']]);
