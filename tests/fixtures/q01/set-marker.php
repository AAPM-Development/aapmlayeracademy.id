<?php
declare(strict_types=1);

/**
 * Test helper: writes the environment marker row in a DISPOSABLE SQLite file.
 * Never point this at a real database.
 *
 *   php set-marker.php <sqlite file> <environment>
 */

$dbPath = $argv[1] ?? '';
$environment = $argv[2] ?? '';
if ($dbPath === '' || $environment === '') {
    fwrite(STDERR, "usage: set-marker.php <sqlite file> <environment>\n");
    exit(2);
}

$pdo = new PDO('sqlite:' . $dbPath);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->exec(
    'CREATE TABLE IF NOT EXISTS aapm_environment_marker (
        id INTEGER NOT NULL,
        environment VARCHAR(32) NOT NULL,
        provisioned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
    )'
);
$pdo->exec('DELETE FROM aapm_environment_marker');
$statement = $pdo->prepare('INSERT INTO aapm_environment_marker (id, environment) VALUES (1, ?)');
$statement->execute([$environment]);

echo "marker={$environment}\n";
