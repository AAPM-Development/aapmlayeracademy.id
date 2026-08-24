<?php
declare(strict_types=1);

// Router for `php -S 127.0.0.1:8000 -t public public/router.php`.
$path = (string) (parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
if (substr($path, 0, 4) === '/api') {
    require __DIR__ . '/api/index.php';
    return true;
}

$file = __DIR__ . $path;
if ($path !== '/' && is_file($file)) {
    return false;
}

if (is_file(__DIR__ . '/index.html')) {
    require __DIR__ . '/index.html';
    return true;
}

http_response_code(404);
echo 'Frontend belum dibuild. Jalankan npm run build.';
return true;
