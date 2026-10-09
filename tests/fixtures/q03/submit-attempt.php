<?php
declare(strict_types=1);

/**
 * Test helper: one submit of a learner's attempt, run as its own process so two
 * submits can genuinely race on the same database file.
 *
 *   php submit-attempt.php <public attempt id> <user id> <request key>
 */

require __DIR__ . '/../../../public/api/bootstrap.php';

$view = aapm_assessment_submit(['id' => (int) ($argv[2] ?? 0)], (string) ($argv[1] ?? ''), ['requestKey' => (string) ($argv[3] ?? '')]);
echo json_encode([
    'status' => $view['status'],
    'correctAnswers' => $view['result']['correctAnswers'] ?? null,
    'passed' => $view['result']['passed'] ?? null,
    'submittedAt' => $view['submittedAt'],
]);
