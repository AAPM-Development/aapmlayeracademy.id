<?php
declare(strict_types=1);

/**
 * Verifies a distribution against its manifest, the checked source API, and
 * the source fingerprint. Exit 0 = valid; 1 = rejected; 2 = usage error.
 *
 *   php scripts/release/validate-artifact.php [--source=<repo>] [--dist=<dir>] [--channel=staging] [--json]
 */

require __DIR__ . '/lib.php';

$options = getopt('', ['source::', 'dist::', 'channel::', 'json']);
$sourceRoot = realpath((string) (($options['source'] ?? false) ?: dirname(__DIR__, 2)));
if ($sourceRoot === false) {
    fwrite(STDERR, "source directory not found\n");
    exit(2);
}
$distRoot = realpath((string) (($options['dist'] ?? false) ?: $sourceRoot . '/dist'));
if ($distRoot === false || !is_dir($distRoot)) {
    fwrite(STDERR, "dist directory not found\n");
    exit(2);
}
$channel = ($options['channel'] ?? false) ?: null;

$result = aapm_release_verify($distRoot, $sourceRoot, aapm_release_contract($sourceRoot), $channel);

if (isset($options['json'])) {
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . PHP_EOL;
} elseif ($result['ok']) {
    echo sprintf(
        "artifact verified: channel=%s artifact=%s\n",
        $result['summary']['channel'],
        $result['summary']['artifactId']
    );
} else {
    foreach ($result['errors'] as $error) {
        echo sprintf("[%s] %s: %s\n", $error['code'], $error['path'] ?? '', $error['detail']);
    }
    echo sprintf("artifact rejected (%d finding(s))\n", count($result['errors']));
}

exit($result['ok'] ? 0 : 1);
