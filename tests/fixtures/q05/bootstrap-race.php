<?php
declare(strict_types=1);
require __DIR__ . '/../../../public/api/bootstrap.php';
$config = app_config();
if (($config['task_owned_fixture'] ?? false) !== true || $config['environment'] !== 'local') throw new RuntimeException('Task fixture only');
file_put_contents($argv[1], 'ready');
$deadline = microtime(true) + 15;
while (!is_file($argv[2])) {
    if (microtime(true) > $deadline) throw new RuntimeException('Fixture barrier timeout');
    usleep(10000);
}
$pdo = db();
echo json_encode(['bootstrapped' => true, 'revisions' => (int) $pdo->query('SELECT COUNT(*) FROM module_revisions')->fetchColumn()]);
