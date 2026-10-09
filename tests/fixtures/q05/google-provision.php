<?php
declare(strict_types=1);
require __DIR__ . '/../../../public/api/bootstrap.php';
$profile = json_decode($argv[1] ?? '{}', true);
try {
    echo json_encode(['userId' => aapm_provision_google_account(db(), $profile)]);
} catch (InvalidArgumentException $error) {
    echo json_encode(['rejected' => true]);
}
