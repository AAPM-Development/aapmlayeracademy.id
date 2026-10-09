<?php
declare(strict_types=1);

/**
 * Test helper: runs one parameterised statement on the DISPOSABLE database named
 * by AAPLAYERACADEMY_CONFIG. Prints JSON rows for SELECT, otherwise the row count.
 *
 *   php sql.php '{"sql":"SELECT ... WHERE id = ?","params":[1]}'
 */

require __DIR__ . '/../../../public/api/bootstrap.php';

$request = json_decode($argv[1] ?? '{}', true);
$sql = (string) ($request['sql'] ?? '');
$statement = db()->prepare($sql);
$statement->execute($request['params'] ?? []);

if (stripos(ltrim($sql), 'SELECT') === 0) {
    echo json_encode($statement->fetchAll(), JSON_UNESCAPED_UNICODE);
} else {
    echo $statement->rowCount();
}
