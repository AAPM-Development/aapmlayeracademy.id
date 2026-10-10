<?php
declare(strict_types=1);
require __DIR__ . '/../../../public/api/bootstrap.php';
$config = app_config();
if (($config['task_owned_fixture'] ?? false) !== true || $config['environment'] !== 'local' || $config['db_driver'] !== 'sqlite') {
    throw new RuntimeException('Disposable SQLite fixture only');
}
$pdo = new PDO('sqlite:' . $config['db_path'], null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$pdo->exec('PRAGMA busy_timeout = 3000');
$mode = $argv[1];
if ($mode === 'hold') {
    $pdo->exec('BEGIN IMMEDIATE');
    file_put_contents($argv[2], 'ready');
    try {
        $deadline = microtime(true) + 10;
        while (!is_file($argv[3])) {
            if (microtime(true) > $deadline) throw new RuntimeException('Fixture barrier timeout');
            usleep(10000);
        }
    } finally {
        $pdo->exec('ROLLBACK');
    }
    echo json_encode(['released' => true]);
} elseif ($mode === 'seed') {
    file_put_contents($argv[2], 'started');
    aapm_cur_seed_v1($pdo);
    echo json_encode(['seeded' => true]);
} elseif ($mode === 'rollback') {
    $pdo->exec('DELETE FROM curriculum_policy_modules');
    $pdo->exec('DELETE FROM curriculum_policy_versions');
    $pdo->exec("CREATE TRIGGER fail_policy_member BEFORE INSERT ON curriculum_policy_modules WHEN NEW.module_number = 2 BEGIN SELECT RAISE(ABORT, 'controlled policy interruption'); END");
    $failed = false;
    try { aapm_cur_seed_v1($pdo); }
    catch (PDOException $exception) { $failed = strpos($exception->getMessage(), 'controlled policy interruption') !== false; }
    echo json_encode(['failed' => $failed, 'policies' => (int) $pdo->query('SELECT COUNT(*) FROM curriculum_policy_versions')->fetchColumn(), 'members' => (int) $pdo->query('SELECT COUNT(*) FROM curriculum_policy_modules')->fetchColumn()]);
}
