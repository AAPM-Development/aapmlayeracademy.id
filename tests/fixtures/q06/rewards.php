<?php
declare(strict_types=1);
// Pure reward rules: no database, no config. Prints JSON for tests/q06-rewards.test.mjs.
require __DIR__ . '/../../../public/api/rewards.php';
$facts = ['entries' => 5, 'completed' => 3, 'practical' => 2, 'quizAverage' => 92, 'farmEntries' => 9, 'certificates' => 1, 'minutes' => 130, 'moduleTotal' => 22];
$points = aapm_reward_points($facts);
$facts['points'] = $points;
echo json_encode([
    'levels' => aapm_reward_levels(),
    'points' => $points,
    'hostile' => aapm_reward_points(['completed' => -5, 'practical' => -1, 'certificates' => -2, 'quizAverage' => 900, 'farmEntries' => 999, 'minutes' => -50]),
    'empty' => aapm_reward_points([]),
    'levelAt' => array_map(static fn (int $p): string => aapm_reward_level($p)['name'], [0, 159, 160, 449, 450, 899, 900, 5000]),
    'top' => aapm_reward_level(5000),
    'definitions' => aapm_reward_achievement_definitions($facts),
    'zeroTotal' => array_column(aapm_reward_achievement_definitions(['moduleTotal' => 0]), 'target', 'id'),
], JSON_UNESCAPED_SLASHES);
