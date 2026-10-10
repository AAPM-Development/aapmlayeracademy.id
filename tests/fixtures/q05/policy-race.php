<?php
declare(strict_types=1);
require __DIR__ . '/../../../public/api/bootstrap.php';

// Separate processes exercise the actual domain transactions on disposable fixtures.
$operation = $argv[1];
$actor = (int) $argv[2];
if ($operation === 'delete') {
    aapm_cur_delete((int) $argv[3], $actor);
    echo json_encode(['deleted' => true]);
} else {
    $input = json_decode($argv[3], true);
    echo json_encode(['policy' => aapm_cur_policy_update('academy-v2', $input, $actor)]);
}
