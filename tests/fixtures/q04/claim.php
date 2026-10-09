<?php
declare(strict_types=1);

/**
 * Test helper: one certificate claim as its own process, so two claims can race on
 * the same disposable database.
 *
 *   php claim.php <user id> <tier number> <request key>
 */

require __DIR__ . '/../../../public/api/bootstrap.php';

$result = aapm_certificate_claim(['id' => (int) ($argv[1] ?? 0)], [
    'tierNumber' => (int) ($argv[2] ?? 0),
    'requestKey' => (string) ($argv[3] ?? ''),
]);
echo json_encode(['created' => $result['created'], 'publicId' => $result['certificate']['id']]);
