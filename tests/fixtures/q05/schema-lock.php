<?php
declare(strict_types=1);
require __DIR__ . '/../../../public/api/bootstrap.php';
$config = app_config();
if (($config['task_owned_fixture'] ?? false) !== true || $config['environment'] !== 'local' || $config['db_driver'] !== 'mysql') throw new RuntimeException('Task PDOmysql fixture only');
$pdo = new PDO('mysql:host=' . $config['db_host'] . ';port=' . $config['db_port'] . ';dbname=' . $config['db_name'], $config['db_user'], $config['db_password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$name = 'aapm-cur-' . substr(hash('sha256', (string) $pdo->query('SELECT DATABASE()')->fetchColumn()), 0, 48);
$lock = $pdo->prepare('SELECT GET_LOCK(?, 1)'); $lock->execute([$name]);
if ((int) $lock->fetchColumn() !== 1) throw new RuntimeException('Fixture lock unavailable');
file_put_contents($argv[1], 'ready');
try {
    $deadline = microtime(true) + 35;
    while (!is_file($argv[2])) {
        if (microtime(true) > $deadline) throw new RuntimeException('Fixture barrier timeout');
        usleep(10000);
    }
    $owned = $pdo->prepare('SELECT IS_USED_LOCK(?) = CONNECTION_ID()'); $owned->execute([$name]);
    echo json_encode(['stillOwned' => (int) $owned->fetchColumn() === 1]);
} finally {
    $release = $pdo->prepare('SELECT RELEASE_LOCK(?)'); $release->execute([$name]);
}
