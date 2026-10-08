<?php
declare(strict_types=1);

/**
 * One-time, additive import of tracked sample media into a live uploads
 * directory. Dry run unless --apply is given. A file that already exists at
 * the same path is never overwritten: if its bytes differ, the import stops
 * before copying anything and reports the conflict.
 *
 *   php scripts/release/import-sample-media.php --source=public/uploads --target=<docroot>/uploads [--apply]
 */

require __DIR__ . '/lib.php';

$options = getopt('', ['source:', 'target:', 'apply']);
$sourceRoot = realpath((string) ($options['source'] ?? ''));
if ($sourceRoot === false || !is_dir($sourceRoot)) {
    fwrite(STDERR, "--source must point to the tracked sample uploads directory\n");
    exit(2);
}
$targetOption = (string) ($options['target'] ?? '');
if ($targetOption === '') {
    fwrite(STDERR, "--target is required\n");
    exit(2);
}
$apply = isset($options['apply']);
$targetRoot = $targetOption;

$toCopy = [];
$unchanged = 0;
$conflicts = [];
foreach (aapm_release_list_files($sourceRoot) as $relative) {
    if ($relative === '.htaccess') {
        continue;
    }
    $from = $sourceRoot . '/' . $relative;
    $to = $targetRoot . '/' . $relative;
    if (file_exists($to) && !is_file($to)) {
        $conflicts[] = $relative;
    } elseif (!is_file($to)) {
        $toCopy[] = $relative;
    } elseif (aapm_release_raw_hash($to) === aapm_release_raw_hash($from)) {
        $unchanged++;
    } else {
        $conflicts[] = $relative;
    }
}

echo sprintf("sample media: %d to copy, %d already present, %d conflict(s)\n", count($toCopy), $unchanged, count($conflicts));
foreach ($conflicts as $relative) {
    echo "conflict (not overwritten): {$relative}\n";
}
if ($conflicts !== []) {
    fwrite(STDERR, "import stopped before copying anything; resolve conflicts manually\n");
    exit(1);
}
if (!$apply) {
    echo "dry run: pass --apply to copy the files listed above\n";
    exit(0);
}

foreach ($toCopy as $relative) {
    $to = $targetRoot . '/' . $relative;
    $directory = dirname($to);
    if (!is_dir($directory) && !mkdir($directory, 0775, true)) {
        fwrite(STDERR, "cannot create directory for {$relative}\n");
        exit(1);
    }
    $temp = $to . '.aapm-tmp-' . bin2hex(random_bytes(6));
    if (!copy($sourceRoot . '/' . $relative, $temp) || !rename($temp, $to)) {
        @unlink($temp);
        fwrite(STDERR, "copy failed for {$relative}\n");
        exit(1);
    }
}
echo sprintf("copied %d file(s); existing files untouched\n", count($toCopy));
exit(0);
