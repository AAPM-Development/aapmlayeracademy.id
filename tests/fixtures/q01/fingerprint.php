<?php
declare(strict_types=1);

/**
 * Test helper: prints the PHP-side source fingerprint and file count so the
 * regression suite can compare it with the Node implementation.
 *
 *   php fingerprint.php <source root>
 */

require __DIR__ . '/../../../scripts/release/lib.php';

$source = realpath($argv[1] ?? '') ?: '';
if ($source === '') {
    fwrite(STDERR, "source root not found\n");
    exit(2);
}

$result = aapm_release_source_fingerprint($source, aapm_release_contract($source));
echo $result['fingerprint'] . ' ' . $result['fileCount'] . "\n";
