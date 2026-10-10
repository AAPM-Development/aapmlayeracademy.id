<?php
declare(strict_types=1);
// Only the dedicated, loopback Q05 test runtime can create these disposable schemas.
// Never emit private configuration, connection strings, or exception details.
try {
    $config = json_decode((string) file_get_contents((string) getenv('AAPM_TEST_MYSQL_CONFIG')), true);
    $database = $argv[1] ?? '';
    if (($config['taskOwned'] ?? false) !== true || ($config['host'] ?? '') !== '127.0.0.1'
        || ($config['databasePrefix'] ?? '') !== 'aapm_q05_test_'
        || !preg_match('/^aapm_q05_test_[a-f0-9]{32}$/', $database)) {
        throw new RuntimeException('Unsafe fixture target');
    }
    $pdo = new PDO('mysql:host=127.0.0.1;port=' . (int) $config['port'], $config['testUser'], $config['testPassword'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $pdo->exec('CREATE DATABASE `' . $database . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    echo "Task-owned fixture schema created.\n";
} catch (Throwable $error) {
    fwrite(STDERR, "Task-owned fixture creation failed; credentials withheld.\n");
    exit(1);
}
