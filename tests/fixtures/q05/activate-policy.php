<?php
declare(strict_types=1);

// Disposable SQLite fixture: exercise activation's transaction without CLI preflight.
require __DIR__ . '/../../../public/api/bootstrap.php';
try {
    $result = aapm_cur_policy_activate(db(), (string) $argv[1], null, ['operator' => 'Uji', 'evidence_ref' => 'DIRECT-LOCK']);
    echo json_encode(['activated' => $result['version']]);
} catch (RuntimeException $exception) {
    echo json_encode(['error' => $exception->getMessage()]);
}
