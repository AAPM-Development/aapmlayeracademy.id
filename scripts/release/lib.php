<?php
declare(strict_types=1);

/**
 * PHP twin of scripts/release/artifact-lib.mjs. Deployment runs on cPanel,
 * where PHP is guaranteed and Node is not. Both implementations must produce
 * the same fingerprint and error codes; tests/q01-environment-artifact.test.mjs
 * checks that they agree on the same fixtures.
 */

const AAPM_RELEASE_MANIFEST_FILE = 'build-manifest.json';
const AAPM_RELEASE_MANIFEST_SCHEMA_ID = 'aapm-release-manifest/1';
const AAPM_RELEASE_CHANNELS = ['local', 'test', 'staging', 'production'];

function aapm_release_contract(string $root): array
{
    $file = $root . '/scripts/release/contract.json';
    $decoded = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;
    if (!is_array($decoded)) {
        throw new RuntimeException('contract.json tidak valid.');
    }

    return $decoded;
}

/** Recursive, byte-ordered list of files below $sub, as forward-slash relative paths. */
function aapm_release_list_files(string $root, string $sub = ''): array
{
    $base = rtrim($root . ($sub === '' ? '' : '/' . $sub), '/');
    if (!is_dir($base)) {
        return [];
    }

    $files = [];
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($base, FilesystemIterator::SKIP_DOTS)
    );
    foreach ($iterator as $info) {
        if (!$info->isFile()) {
            continue;
        }
        $relative = str_replace('\\', '/', substr($info->getPathname(), strlen($base) + 1));
        $files[] = ($sub === '' ? '' : $sub . '/') . $relative;
    }
    sort($files, SORT_STRING);

    return $files;
}

function aapm_release_raw_hash(string $path): string
{
    return hash_file('sha256', $path);
}

/** Content hash under the contract's hashing rule: LF-normalised for text, raw for binary. */
function aapm_release_content_hash(string $path, array $contract): string
{
    $bytes = (string) file_get_contents($path);
    $extension = strtolower('.' . pathinfo($path, PATHINFO_EXTENSION));
    if (in_array($extension, $contract['hashing']['binaryExtensions'], true)) {
        return hash('sha256', $bytes);
    }

    return hash('sha256', str_replace("\r\n", "\n", $bytes));
}

/** @return array{fingerprint:string,fileCount:int} */
function aapm_release_source_fingerprint(string $source, array $contract): array
{
    $rule = $contract['fingerprint'];
    $paths = [];
    foreach ($rule['roots'] as $root) {
        if (!is_dir($source . '/' . $root)) {
            throw new RuntimeException("source root missing: {$root}");
        }
        foreach (aapm_release_list_files($source, $root) as $file) {
            $paths[] = $file;
        }
    }
    foreach ($rule['files'] as $file) {
        if (!is_file($source . '/' . $file)) {
            throw new RuntimeException("source file missing: {$file}");
        }
        $paths[] = $file;
    }

    $included = [];
    foreach (array_unique($paths) as $file) {
        $excluded = false;
        foreach ($rule['excludePrefixes'] as $prefix) {
            if (strpos($file, $prefix) === 0) {
                $excluded = true;
                break;
            }
        }
        if (!$excluded) {
            $included[] = $file;
        }
    }
    sort($included, SORT_STRING);

    $lines = '';
    foreach ($included as $file) {
        $lines .= aapm_release_content_hash($source . '/' . $file, $contract) . '  ' . $file . "\n";
    }

    return ['fingerprint' => hash('sha256', $lines), 'fileCount' => count($included)];
}

/** @param list<array{path:string,sha256:string}> $entries */
function aapm_release_artifact_id(array $entries): string
{
    usort($entries, static function (array $a, array $b): int {
        return strcmp($a['path'], $b['path']);
    });

    $lines = '';
    foreach ($entries as $entry) {
        $lines .= $entry['sha256'] . '  ' . $entry['path'] . "\n";
    }

    return hash('sha256', $lines);
}

function aapm_release_distribution_files(string $dist): array
{
    return array_values(array_filter(
        aapm_release_list_files($dist),
        static function (string $file): bool {
            return $file !== AAPM_RELEASE_MANIFEST_FILE;
        }
    ));
}

/**
 * Verifies a distribution against its manifest and, when $source is given,
 * against the checked source API and fingerprint. Codes match the Node twin.
 *
 * @return array{ok:bool,errors:list<array{code:string,path:?string,detail:string}>,summary:?array}
 */
function aapm_release_verify(string $dist, ?string $source, array $contract, ?string $expectedChannel = null): array
{
    $errors = [];
    $fail = static function (string $code, ?string $path, string $detail) use (&$errors): void {
        $errors[] = ['code' => $code, 'path' => $path, 'detail' => $detail];
    };

    $manifestPath = $dist . '/' . AAPM_RELEASE_MANIFEST_FILE;
    if (!is_file($manifestPath)) {
        $fail('manifest_missing', AAPM_RELEASE_MANIFEST_FILE, 'build manifest not found');

        return ['ok' => false, 'errors' => $errors, 'summary' => null];
    }
    $manifest = json_decode((string) file_get_contents($manifestPath), true);
    if (!is_array($manifest)) {
        $fail('manifest_invalid', AAPM_RELEASE_MANIFEST_FILE, 'manifest is not valid JSON');

        return ['ok' => false, 'errors' => $errors, 'summary' => null];
    }

    if (($manifest['schema'] ?? null) !== AAPM_RELEASE_MANIFEST_SCHEMA_ID) {
        $fail('manifest_schema', AAPM_RELEASE_MANIFEST_FILE, 'expected ' . AAPM_RELEASE_MANIFEST_SCHEMA_ID);
    }
    if (!in_array($manifest['channel'] ?? null, AAPM_RELEASE_CHANNELS, true)) {
        $fail('channel_invalid', AAPM_RELEASE_MANIFEST_FILE, 'unknown build channel');
    }
    if ($expectedChannel !== null && ($manifest['channel'] ?? null) !== $expectedChannel) {
        $fail('channel_mismatch', AAPM_RELEASE_MANIFEST_FILE, 'artifact channel differs from the expected channel');
    }

    $declared = [];
    foreach (($manifest['files'] ?? []) as $entry) {
        $declared[(string) $entry['path']] = $entry;
    }
    $actual = aapm_release_distribution_files($dist);

    foreach ($actual as $path) {
        if (!isset($declared[$path])) {
            $fail('undeclared_file', $path, 'file is not listed in the manifest');
        }
    }
    foreach ($declared as $path => $meta) {
        $abs = $dist . '/' . $path;
        if (!is_file($abs)) {
            $fail('missing_file', $path, 'listed in manifest but absent');
        } elseif (aapm_release_content_hash($abs, $contract) !== ($meta['sha256'] ?? '')) {
            $fail('hash_mismatch', $path, 'content differs from manifest');
        }
    }

    $uploadsPrefix = $contract['artifact']['uploadsDir'] . '/';
    foreach ($actual as $path) {
        if (strpos($path, $uploadsPrefix) === 0 && !in_array($path, $contract['artifact']['uploadsAllowed'], true)) {
            $fail('runtime_uploads_present', $path, 'runtime uploads must not be part of the payload');
        }
    }
    foreach ($contract['artifact']['forbiddenFiles'] as $path) {
        if (is_file($dist . '/' . $path)) {
            $fail('forbidden_file', $path, 'environment-specific server file in artifact');
        }
    }
    foreach ($contract['artifact']['requiredFiles'] as $path) {
        if (!is_file($dist . '/' . $path)) {
            $fail('required_missing', $path, 'required file absent');
        }
    }
    foreach ($contract['artifact']['requiredDirs'] as $dir) {
        if (!is_dir($dist . '/' . $dir)) {
            $fail('required_missing', $dir, 'required directory absent');
        }
    }
    if (is_file($dist . '/index.html')) {
        preg_match_all('#(?:src|href)="(/assets/[^"]+)"#', (string) file_get_contents($dist . '/index.html'), $matches);
        foreach ($matches[1] as $reference) {
            $ref = substr($reference, 1);
            if (!is_file($dist . '/' . $ref)) {
                $fail('asset_reference_missing', $ref, 'index.html references a missing asset');
            }
        }
    }

    if ($source !== null) {
        $srcPrefix = $contract['artifact']['apiSourceDir'] . '/';
        $distPrefix = $contract['artifact']['apiDistDir'] . '/';
        $sourceApi = array_map(
            static function (string $p) use ($srcPrefix): string {
                return substr($p, strlen($srcPrefix));
            },
            aapm_release_list_files($source, $contract['artifact']['apiSourceDir'])
        );
        $distApi = array_map(
            static function (string $p) use ($distPrefix): string {
                return substr($p, strlen($distPrefix));
            },
            aapm_release_list_files($dist, $contract['artifact']['apiDistDir'])
        );
        foreach ($sourceApi as $name) {
            if (!in_array($name, $distApi, true)) {
                $fail('api_file_missing', $distPrefix . $name, 'present in source API, absent from distribution');
            }
        }
        foreach ($distApi as $name) {
            if (!in_array($name, $sourceApi, true)) {
                $fail('api_file_extra', $distPrefix . $name, 'present in distribution API, absent from source');
            }
        }
        foreach ($sourceApi as $name) {
            if (!in_array($name, $distApi, true)) {
                continue;
            }
            if (aapm_release_content_hash($source . '/' . $srcPrefix . $name, $contract) !== aapm_release_content_hash($dist . '/' . $distPrefix . $name, $contract)) {
                $fail('api_content_mismatch', $distPrefix . $name, 'distributed API differs from source API');
            }
        }

        try {
            $fingerprint = aapm_release_source_fingerprint($source, $contract)['fingerprint'];
            if ($fingerprint !== ($manifest['sourceTreeFingerprint'] ?? '')) {
                $fail('stale_artifact', AAPM_RELEASE_MANIFEST_FILE, 'source changed since this artifact was built');
            }
        } catch (RuntimeException $exception) {
            $fail('source_unreadable', null, $exception->getMessage());
        }
    }

    $entries = [];
    foreach (($manifest['files'] ?? []) as $entry) {
        $entries[] = ['path' => (string) $entry['path'], 'sha256' => (string) $entry['sha256']];
    }
    if (aapm_release_artifact_id($entries) !== ($manifest['artifactId'] ?? '')) {
        $fail('artifact_id_mismatch', AAPM_RELEASE_MANIFEST_FILE, 'artifact identity does not match its files');
    }

    return [
        'ok' => $errors === [],
        'errors' => $errors,
        'summary' => [
            'channel' => $manifest['channel'] ?? null,
            'artifactId' => $manifest['artifactId'] ?? null,
            'sourceTreeFingerprint' => $manifest['sourceTreeFingerprint'] ?? null,
            'fileCount' => count($declared),
        ],
    ];
}
