<?php
declare(strict_types=1);

// The database closes the connection as soon as an APPI stream starts, as a host does
// once it sits idle past wait_timeout while the model answers. A new connection works.
// SQLite has no such thing, so there the old connection only stops accepting writes.
header_register_callback(static function (): void {
    if (strpos(implode("\n", headers_list()), 'text/event-stream') === false) return;
    $pdo = db();
    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $pdo->exec('PRAGMA query_only = ON');
        return;
    }
    try {
        $pdo->exec('KILL ' . (int) $pdo->query('SELECT CONNECTION_ID()')->fetchColumn());
    } catch (PDOException $killed) {
        // The server answers its own KILL by ending this connection.
    }
});

return require __DIR__ . '/../../../public/router.php';
