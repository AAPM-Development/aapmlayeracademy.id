<?php
declare(strict_types=1);

/**
 * Test helper: one admin progress reset as its own process, so a reset can race
 * a submit on the same disposable database.
 *
 *   php reset.php <actor user id> <learner user id>
 */

require __DIR__ . '/../../../public/api/bootstrap.php';

echo json_encode(admin_reset_user_progress(['id' => (int) ($argv[1] ?? 0)], (int) ($argv[2] ?? 0), ['confirm' => true]));
