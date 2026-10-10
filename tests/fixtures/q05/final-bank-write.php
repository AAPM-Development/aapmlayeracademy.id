<?php
declare(strict_types=1);

// One final-bank writer per process for disposable-database concurrency tests.
require __DIR__ . '/../../../public/api/bootstrap.php';
$expected = (int) $argv[1];
$actor = (int) $argv[2];
if (($argv[3] ?? '') === 'publish') {
    echo json_encode(aapm_cur_final_bank_publish($expected, $actor));
} else {
    echo json_encode(aapm_cur_final_bank_write([
        'expectedDraftVersion' => $expected,
        'question' => (string) $argv[3], 'options' => ['A', 'B'], 'correctIndex' => 0,
    ], 'create', null, $actor));
}
