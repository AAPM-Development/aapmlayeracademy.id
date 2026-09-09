<?php
declare(strict_types=1);

/**
 * Bounded uploads for the editorial module composer.
 *
 * Files deliberately live below the deployed public directory: cPanel copies
 * dist/ into the site without clearing it, so uploads survive ordinary app
 * deploys while staying on the same origin as the learner renderer.  Every
 * file name is generated server-side and every accepted type is verified from
 * its bytes before it is moved.
 */

const EDITORIAL_IMAGE_MAX_BYTES = 20971520;
const EDITORIAL_PRESENTATION_MAX_BYTES = 52428800;
const EDITORIAL_IMAGE_MAX_WIDTH = 8000;
const EDITORIAL_IMAGE_MAX_HEIGHT = 8000;
const EDITORIAL_IMAGE_MAX_PIXELS = 40000000;
const EDITORIAL_PPTX_MAX_ENTRIES = 1000;
const EDITORIAL_PPTX_MAX_ENTRY_BYTES = 52428800;
const EDITORIAL_PPTX_MAX_UNCOMPRESSED_BYTES = 209715200;
// Manual editorial slides stay intentionally short, while an uploaded deck can
// accommodate a complete training chapter without turning the learner UI into
// an unbounded document viewer.
const EDITORIAL_PPTX_MAX_SLIDES = 50;
const EDITORIAL_ORPHAN_GRACE_SECONDS = 2592000;
const EDITORIAL_PRUNE_MAX_FILES = 5;

function editorial_upload_root(): string
{
    return dirname(__DIR__) . '/uploads';
}

function editorial_upload_guard(): void
{
    $root = editorial_upload_root();
    if (!is_dir($root) && !mkdir($root, 0755, true) && !is_dir($root)) {
        error_response('Direktori media editorial tidak dapat disiapkan.', 500, 'media_storage_unavailable');
    }
    @chmod($root, 0755);

    $guardPath = $root . '/.htaccess';
    if (!is_file($guardPath)) {
        $guard = "Options -Indexes\n"
            . "<IfModule mod_authz_core.c>\n"
            . '  <FilesMatch "\.(?:php[0-9]?|phtml|phar|shtml|cgi|pl|py|sh)$">' . "\n"
            . "    Require all denied\n"
            . "  </FilesMatch>\n"
            . "</IfModule>\n"
            . "<IfModule mod_headers.c>\n"
            . '  Header set X-Content-Type-Options "nosniff"' . "\n"
            . "</IfModule>\n";
        if (file_put_contents($guardPath, $guard, LOCK_EX) === false) {
            error_response('Proteksi media editorial tidak dapat disiapkan.', 500, 'media_storage_unavailable');
        }
    }
    // These public assets must remain readable by the static web-server
    // process. Execution and directory listing are denied by the guard.
    @chmod($guardPath, 0644);
}

function editorial_ini_bytes($value): int
{
    $value = trim((string) $value);
    if ($value === '' || $value === '-1') {
        return 0;
    }
    if (ctype_digit($value)) {
        return (int) $value;
    }
    if (!preg_match('/^([0-9]+(?:\.[0-9]+)?)\s*([kmgtpe])$/i', $value, $matches)) {
        return 0;
    }
    $multipliers = [
        'k' => 1024,
        'm' => 1048576,
        'g' => 1073741824,
        't' => 1099511627776,
        'p' => 1125899906842624,
        'e' => 1152921504606846976,
    ];
    $unit = strtolower($matches[2]);
    return isset($multipliers[$unit]) ? (int) ((float) $matches[1] * $multipliers[$unit]) : 0;
}

function editorial_readable_bytes(int $bytes): string
{
    if ($bytes < 1) {
        return 'batas yang tidak diketahui';
    }
    return max(1, (int) round($bytes / 1048576)) . ' MB';
}

function editorial_server_upload_limit_message(): string
{
    $uploadLimit = editorial_ini_bytes(ini_get('upload_max_filesize'));
    $postLimit = editorial_ini_bytes(ini_get('post_max_size'));
    $limits = array_filter([$uploadLimit, $postLimit], static function ($limit) {
        return $limit > 0;
    });
    $limit = $limits ? min($limits) : 0;
    return 'Server PHP saat ini hanya menerima unggahan hingga ' . editorial_readable_bytes((int) $limit) . '. Minta administrator staging menaikkan upload_max_filesize dan post_max_size.';
}

function editorial_upload_file(string $field, int $maxBytes): array
{
    if (!isset($_FILES[$field]) || !is_array($_FILES[$field])) {
        $contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
        $postLimit = editorial_ini_bytes(ini_get('post_max_size'));
        if ($contentLength > 0 && $postLimit > 0 && $contentLength > $postLimit) {
            error_response(editorial_server_upload_limit_message(), 413, 'upload_server_limit');
        }
        error_response('Pilih berkas terlebih dahulu.', 422, 'upload_missing');
    }

    $file = $_FILES[$field];
    $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($error !== UPLOAD_ERR_OK) {
        $message = $error === UPLOAD_ERR_INI_SIZE
            ? editorial_server_upload_limit_message()
            : ($error === UPLOAD_ERR_FORM_SIZE
                ? 'Ukuran berkas melebihi batas yang diizinkan.'
                : 'Berkas tidak dapat diunggah. Coba pilih berkas kembali.');
        error_response($message, 422, 'upload_failed');
    }

    $tmpName = (string) ($file['tmp_name'] ?? '');
    $size = (int) ($file['size'] ?? 0);
    if ($tmpName === '' || !is_uploaded_file($tmpName) || $size < 1) {
        error_response('Berkas unggahan tidak valid.', 422, 'upload_invalid');
    }
    if ($size > $maxBytes) {
        error_response('Ukuran berkas melebihi batas yang diizinkan.', 422, 'upload_too_large');
    }

    return [
        'tmp_name' => $tmpName,
        'size' => $size,
        'name' => (string) ($file['name'] ?? ''),
    ];
}

function editorial_detect_mime(string $path): string
{
    if (!function_exists('finfo_open')) {
        error_response('Server belum memiliki pemeriksa tipe berkas yang diperlukan.', 503, 'media_validation_unavailable');
    }
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    if (!$finfo) {
        error_response('Server belum memiliki pemeriksa tipe berkas yang diperlukan.', 503, 'media_validation_unavailable');
    }
    $mime = finfo_file($finfo, $path);
    finfo_close($finfo);
    return strtolower(trim((string) $mime));
}

function editorial_store_upload(string $tmpName, string $kind, string $extension): string
{
    editorial_upload_guard();
    $year = date('Y');
    $month = date('m');
    $relativeDirectory = 'editorial/' . $kind . '/' . $year . '/' . $month;
    $directory = editorial_upload_root() . '/' . $relativeDirectory;
    if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) {
        error_response('Berkas tidak dapat disimpan.', 500, 'media_storage_unavailable');
    }
    @chmod($directory, 0755);

    try {
        $filename = bin2hex(random_bytes(20)) . '.' . $extension;
    } catch (Throwable $error) {
        error_response('Nama berkas aman tidak dapat dibuat.', 500, 'media_storage_unavailable');
    }
    $destination = $directory . '/' . $filename;
    if (!move_uploaded_file($tmpName, $destination)) {
        error_response('Berkas tidak dapat disimpan.', 500, 'media_storage_unavailable');
    }
    @chmod($destination, 0644);

    return '/uploads/' . $relativeDirectory . '/' . $filename;
}

function editorial_managed_upload_relative_path(string $value): ?string
{
    $path = ltrim(str_replace('\\', '/', trim($value)), '/');
    if (!preg_match('#^uploads/editorial/(?:images/[0-9]{4}/[0-9]{2}/[a-f0-9]{40}\.(?:jpe?g|png|gif|webp|avif)|presentations/[0-9]{4}/[0-9]{2}/[a-f0-9]{40}\.pptx)$#i', $path)) {
        return null;
    }
    return substr($path, strlen('uploads/'));
}

function editorial_referenced_uploads(): ?array
{
    $references = [];
    try {
        $statement = db()->query('SELECT editorial_content, content, video_url, video_script FROM course_modules');
        if (!$statement) {
            error_log('Editorial media cleanup skipped: reference query returned no statement.');
            return null;
        }
        $rows = $statement->fetchAll();
        foreach ($rows as $row) {
            $source = str_replace('\\/', '/', implode("\n", [
                (string) ($row['editorial_content'] ?? ''),
                (string) ($row['content'] ?? ''),
                (string) ($row['video_url'] ?? ''),
                (string) ($row['video_script'] ?? ''),
            ]));
            if (!preg_match_all('#/uploads/editorial/(?:images/[0-9]{4}/[0-9]{2}/[a-f0-9]{40}\.(?:jpe?g|png|gif|webp|avif)|presentations/[0-9]{4}/[0-9]{2}/[a-f0-9]{40}\.pptx)#i', $source, $matches)) {
                continue;
            }
            foreach ($matches[0] as $url) {
                $relative = editorial_managed_upload_relative_path((string) $url);
                if ($relative !== null) {
                    $references[$relative] = true;
                }
            }
        }
    } catch (Throwable $error) {
        error_log('Editorial media cleanup skipped: unable to read references.');
        return null;
    }
    return $references;
}

function editorial_prune_orphaned_uploads(): void
{
    $root = editorial_upload_root();
    $editorialRoot = $root . '/editorial';
    if (!is_dir($editorialRoot)) {
        return;
    }
    $references = editorial_referenced_uploads();
    if ($references === null) {
        return;
    }
    $cutoff = time() - EDITORIAL_ORPHAN_GRACE_SECONDS;
    $removed = 0;

    try {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($editorialRoot, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::LEAVES_ONLY
        );
        foreach ($iterator as $file) {
            if ($removed >= EDITORIAL_PRUNE_MAX_FILES || !$file->isFile() || $file->isLink()) {
                continue;
            }
            $relative = substr(str_replace('\\', '/', $file->getPathname()), strlen(str_replace('\\', '/', $root)) + 1);
            if (editorial_managed_upload_relative_path('/uploads/' . $relative) === null
                || isset($references[$relative])
                || $file->getMTime() > $cutoff) {
                continue;
            }
            if (!@unlink($file->getPathname())) {
                error_log('Editorial media cleanup could not remove an orphaned file.');
                continue;
            }
            $removed += 1;
        }
    } catch (Throwable $error) {
        error_log('Editorial media cleanup failed.');
    }
}

function editorial_image_details(string $tmpName): array
{
    $mime = editorial_detect_mime($tmpName);
    $extensions = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
        'image/avif' => 'avif',
    ];
    if (!isset($extensions[$mime])) {
        error_response('Gunakan gambar JPG, PNG, GIF, WebP, atau AVIF.', 422, 'invalid_image_type');
    }

    $dimensions = @getimagesize($tmpName);
    if (!$dimensions || strtolower((string) ($dimensions['mime'] ?? '')) !== $mime) {
        error_response('Berkas tidak dapat dibaca sebagai gambar yang aman.', 422, 'invalid_image_type');
    }
    $width = (int) ($dimensions[0] ?? 0);
    $height = (int) ($dimensions[1] ?? 0);
    if ($width < 1 || $height < 1
        || $width > EDITORIAL_IMAGE_MAX_WIDTH
        || $height > EDITORIAL_IMAGE_MAX_HEIGHT
        || ($width * $height) > EDITORIAL_IMAGE_MAX_PIXELS) {
        error_response('Dimensi gambar terlalu besar. Gunakan gambar maksimal 8.000 px dan 40 megapiksel.', 422, 'image_dimensions_too_large');
    }

    return [
        'mime' => $mime,
        'extension' => $extensions[$mime],
        'width' => $width,
        'height' => $height,
    ];
}

function admin_upload_editorial_image(): array
{
    $upload = editorial_upload_file('file', EDITORIAL_IMAGE_MAX_BYTES);
    $details = editorial_image_details($upload['tmp_name']);
    $url = editorial_store_upload($upload['tmp_name'], 'images', $details['extension']);
    editorial_prune_orphaned_uploads();

    return [
        'url' => $url,
        'mime' => $details['mime'],
        'width' => $details['width'],
        'height' => $details['height'],
        'size' => $upload['size'],
    ];
}

function editorial_presentation_name(string $name): string
{
    $name = trim(str_replace('\\', '/', $name));
    $name = basename($name);
    $name = preg_replace('/[\x00-\x1F\x7F]/', '', $name) ?: '';
    return $name !== '' ? substr($name, 0, 180) : 'presentasi.pptx';
}

function editorial_validate_pptx(string $tmpName, string $originalName): int
{
    if (!preg_match('/\.pptx$/i', $originalName)) {
        error_response('Gunakan berkas PowerPoint .pptx, bukan .ppt atau tipe lain.', 422, 'invalid_presentation_type');
    }
    $mime = editorial_detect_mime($tmpName);
    $acceptedMimes = [
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/zip',
        'application/x-zip-compressed',
        'application/octet-stream',
    ];
    if (!in_array($mime, $acceptedMimes, true)) {
        error_response('Berkas tidak dapat dibaca sebagai presentasi PowerPoint.', 422, 'invalid_presentation_type');
    }
    if (!class_exists('ZipArchive')) {
        error_response('Server belum mendukung pemeriksaan presentasi PowerPoint.', 503, 'presentation_validation_unavailable');
    }

    $archive = new ZipArchive();
    if ($archive->open($tmpName) !== true) {
        error_response('Berkas PowerPoint tidak valid atau rusak.', 422, 'invalid_presentation');
    }

    try {
        if ($archive->numFiles < 1 || $archive->numFiles > EDITORIAL_PPTX_MAX_ENTRIES) {
            error_response('Struktur presentasi terlalu besar atau tidak valid.', 422, 'invalid_presentation');
        }
        $hasContentTypes = false;
        $hasPresentation = false;
        $slides = 0;
        $uncompressedBytes = 0;

        for ($index = 0; $index < $archive->numFiles; $index += 1) {
            $stat = $archive->statIndex($index);
            $entry = is_array($stat) ? (string) ($stat['name'] ?? '') : '';
            $entryBytes = is_array($stat) ? (int) ($stat['size'] ?? 0) : 0;
            if ($entry === '' || strpos($entry, "\0") !== false || strpos($entry, '\\') !== false
                || preg_match('#(?:^|/)\.\.?(?:/|$)#', $entry)) {
                error_response('Struktur presentasi tidak aman.', 422, 'invalid_presentation');
            }
            if ($entryBytes < 0 || $entryBytes > EDITORIAL_PPTX_MAX_ENTRY_BYTES) {
                error_response('Salah satu bagian presentasi terlalu besar.', 422, 'presentation_too_large');
            }
            $uncompressedBytes += $entryBytes;
            if ($uncompressedBytes > EDITORIAL_PPTX_MAX_UNCOMPRESSED_BYTES) {
                error_response('Presentasi terlalu besar untuk diproses dengan aman.', 422, 'presentation_too_large');
            }
            if ($entry === '[Content_Types].xml') {
                $hasContentTypes = true;
            }
            if ($entry === 'ppt/presentation.xml') {
                $hasPresentation = true;
            }
            if (preg_match('#^ppt/slides/slide[0-9]+\.xml$#i', $entry)) {
                $slides += 1;
            }
            // The learner renderer sanitises SVG markup before inserting it into
            // the DOM, so SVG images are a supported part of an ordinary PPTX
            // deck. Keep rejecting executable/embedded package parts instead:
            // macros, ActiveX controls, and OLE/package embeddings cannot be
            // rendered safely or predictably in the learner carousel.
            if (preg_match('#^ppt/(?:vbaProject\.bin|embeddings/[^/]+|activeX/[^/]+|controls/[^/]+)$#i', $entry)) {
                error_response('Presentasi berisi konten aktif atau media tertanam yang belum didukung (macro, ActiveX, atau OLE).', 422, 'invalid_presentation');
            }
            if (preg_match('/\.rels$/i', $entry)) {
                if ($entryBytes > 1048576) {
                    error_response('Relasi presentasi terlalu besar.', 422, 'invalid_presentation');
                }
                $relationships = (string) $archive->getFromIndex($index);
                if (preg_match('/TargetMode\s*=\s*["\']External["\']/i', $relationships)) {
                    error_response('Presentasi tidak boleh memuat sumber eksternal. Sematkan media ke berkas PPTX terlebih dahulu.', 422, 'invalid_presentation');
                }
            }
        }

        if (!$hasContentTypes || !$hasPresentation || $slides < 1) {
            error_response('Berkas tidak memiliki struktur presentasi PowerPoint yang lengkap.', 422, 'invalid_presentation');
        }
        if ($slides > EDITORIAL_PPTX_MAX_SLIDES) {
            error_response('Presentasi maksimal berisi ' . EDITORIAL_PPTX_MAX_SLIDES . ' slide agar carousel learner tetap cepat dan mudah diikuti.', 422, 'presentation_too_many_slides');
        }

        return $slides;
    } finally {
        $archive->close();
    }
}

function admin_upload_editorial_presentation(): array
{
    $upload = editorial_upload_file('file', EDITORIAL_PRESENTATION_MAX_BYTES);
    $name = editorial_presentation_name($upload['name']);
    $slideCount = editorial_validate_pptx($upload['tmp_name'], $name);
    $url = editorial_store_upload($upload['tmp_name'], 'presentations', 'pptx');
    editorial_prune_orphaned_uploads();

    return [
        'url' => $url,
        'name' => $name,
        'size' => $upload['size'],
        'slideCount' => $slideCount,
    ];
}
