<?php
declare(strict_types=1);
require __DIR__ . '/../../../public/api/bootstrap.php';
echo json_encode(aapm_assessment_answer(['id' => (int) $argv[2]], (string) $argv[1], [
    'questionId' => (int) $argv[3], 'answerIndex' => (int) $argv[4],
]));
