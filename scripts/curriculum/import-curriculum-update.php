<?php
declare(strict_types=1);

/**
 * Operator-only publication of an audited curriculum package (module copy, editorial
 * material, module question banks, and the final-exam bank). Every module goes through
 * the same draft -> publish path as the admin editor, so each change is an immutable
 * revision with an audit event, active attempts keep their question snapshots, and
 * nothing a learner has earned is rewritten.
 *
 * Existing slide, video, and image blocks in a module's published material are kept
 * (ahead of the package's text blocks); every other field the package names replaces
 * the published value. A module's removeMediaUrls retires those videos only where they
 * are still published, so a video an editor has since chosen is left alone. A module
 * with unpublished editor changes stops the whole run, so an editor's work in progress
 * is never published by accident.
 *
 *   php scripts/curriculum/import-curriculum-update.php --file=scripts/curriculum/data/PACKAGE.json --expect-environment=production --actor-email=ADMIN --dry-run
 *   php scripts/curriculum/import-curriculum-update.php --file=... --expect-environment=production --actor-email=ADMIN --apply --operator=NAME --evidence-ref=REF
 *
 * Optional: --modules=1,2,3 limits the run to those module numbers; --skip-final leaves
 * the final-exam bank untouched.
 */

if (PHP_SAPI !== 'cli' || isset($_SERVER['HTTP_HOST']) || isset($_SERVER['REQUEST_METHOD'])) {
    http_response_code(403);
    fwrite(STDERR, "Impor kurikulum hanya dapat dijalankan dari CLI operator.\n");
    exit(2);
}

require __DIR__ . '/../../public/api/bootstrap.php';

// API helpers answer validation failures with a JSON body and a bare exit, which
// would end a CLI run with status 0. Buffer that body and turn it into a failure.
$importFinished = false;
ob_start();
register_shutdown_function(static function () use (&$importFinished): void {
    if ($importFinished) {
        return;
    }
    $buffered = trim((string) ob_get_clean());
    fwrite(STDERR, 'Impor dihentikan' . ($buffered !== '' ? ': ' . $buffered : '.') . "\n");
    exit(5);
});

function import_fail(int $code, string $message): void
{
    global $importFinished;
    $importFinished = true;
    ob_end_clean();
    fwrite(STDERR, $message . "\n");
    exit($code);
}

function import_print(array $value): void
{
    fwrite(STDOUT, json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n");
}

$options = [];
foreach (array_slice($argv, 1) as $argument) {
    if (!preg_match('/\A--([a-z-]+)(?:=(.*))?\z/', $argument, $match)) {
        import_fail(2, 'Argumen tidak dikenal: ' . substr($argument, 0, 60));
    }
    $options[$match[1]] = $match[2] ?? true;
}
$allowed = ['file', 'expect-environment', 'actor-email', 'dry-run', 'apply', 'operator', 'evidence-ref', 'modules', 'skip-final'];
foreach (array_keys($options) as $key) {
    if (!in_array($key, $allowed, true)) {
        import_fail(2, 'Opsi tidak dikenal: --' . $key);
    }
}

$dryRun = isset($options['dry-run']);
$apply = isset($options['apply']);
if ($dryRun === $apply) {
    import_fail(2, 'Pilih tepat satu: --dry-run atau --apply.');
}
$expectedEnvironment = strtolower(trim((string) ($options['expect-environment'] ?? '')));
if ($expectedEnvironment === '') {
    import_fail(2, '--expect-environment wajib diisi.');
}
$actorEmail = strtolower(trim((string) ($options['actor-email'] ?? '')));
if ($actorEmail === '') {
    import_fail(2, '--actor-email wajib diisi (akun Admin terverifikasi yang tercatat sebagai penerbit).');
}
$operator = trim((string) ($options['operator'] ?? ''));
$evidence = trim((string) ($options['evidence-ref'] ?? ''));
if ($apply && ($operator === '' || $evidence === '')) {
    import_fail(2, '--apply membutuhkan --operator dan --evidence-ref.');
}
$onlyModules = null;
if (isset($options['modules'])) {
    if (!preg_match('/\A[0-9]{1,3}(,[0-9]{1,3})*\z/', (string) $options['modules'])) {
        import_fail(2, '--modules harus berupa daftar nomor modul, misalnya --modules=1,2,3.');
    }
    $onlyModules = array_map('intval', explode(',', (string) $options['modules']));
}
$skipFinal = isset($options['skip-final']);

$file = (string) ($options['file'] ?? '');
$path = $file !== '' && $file[0] !== '/' ? getcwd() . '/' . $file : $file;
if ($file === '' || !is_file($path) || !is_readable($path)) {
    import_fail(2, '--file wajib menunjuk paket kurikulum JSON yang dapat dibaca.');
}
$package = json_decode((string) file_get_contents($path), true);
if (!is_array($package) || ($package['schema'] ?? '') !== 'aapm-curriculum-update/1' || !is_array($package['modules'] ?? null)) {
    import_fail(2, 'Paket kurikulum tidak valid (schema aapm-curriculum-update/1).');
}
$packageId = (string) ($package['id'] ?? '');
$curriculumId = (string) ($package['curriculumId'] ?? AAPM_PRIMARY_CURRICULUM);
$preserveTypes = array_values(array_intersect((array) ($package['preserveBlockTypes'] ?? []), ['slides', 'video', 'image']));

try {
    $config = app_config();
} catch (AppConfigException $exception) {
    import_fail(3, 'Konfigurasi tidak valid: ' . $exception->safeCode());
}
$environment = strtolower((string) ($config['environment'] ?? ''));
if ($environment !== $expectedEnvironment) {
    import_fail(3, "Target tidak cocok: konfigurasi memakai lingkungan {$environment}, --expect-environment={$expectedEnvironment}. Tidak ada perubahan.");
}

$pdo = db();
$actorStatement = $pdo->prepare('SELECT id, role, email_verified_at FROM users WHERE LOWER(email) = ? LIMIT 1');
$actorStatement->execute([$actorEmail]);
$actor = $actorStatement->fetch();
if (!$actor || !in_array((string) $actor['role'], ['admin', 'super_admin'], true) || empty($actor['email_verified_at'])) {
    import_fail(3, 'Akun --actor-email harus Admin atau Super Admin yang emailnya sudah terverifikasi.');
}
$actorId = (int) $actor['id'];

const IMPORT_TEXT_FIELDS = ['title', 'summary', 'content', 'videoScript', 'practicalAssignment'];
const IMPORT_LIST_FIELDS = ['learningObjectives', 'keyTakeaways', 'checklist'];

/** @return list<string> Retired video URLs in stored form. */
function import_retired_urls(array $entry): array
{
    return array_values(array_filter(array_map('normalise_lesson_video_url', (array) ($entry['removeMediaUrls'] ?? []))));
}

/** Keeps the module's own media blocks except retired videos, then appends the package's material. */
function import_editorial(string $existing, array $blocks, array $preserveTypes, array $retiredUrls = []): array
{
    $document = $existing === '' ? [] : json_decode($existing, true);
    $document = is_array($document) ? $document : [];
    $media = array_values(array_filter((array) ($document['blocks'] ?? []), static function ($block) use ($preserveTypes): bool {
        return is_array($block) && in_array((string) ($block['type'] ?? ''), $preserveTypes, true);
    }));
    $kept = array_values(array_filter($media, static function (array $block) use ($retiredUrls): bool {
        return ($block['type'] ?? '') !== 'video' || !in_array(normalise_lesson_video_url($block['url'] ?? ''), $retiredUrls, true);
    }));
    $merged = ['version' => 1, 'blocks' => array_merge($kept, array_values($blocks))];
    if (array_key_exists('presentation', $document)) {
        $merged['presentation'] = $document['presentation'];
    }
    return [$merged, array_map(static fn (array $block): string => (string) $block['type'], $kept), count($media) - count($kept)];
}

/** Unpublished editor work, read without creating a draft row (the plan never writes). */
function import_module_pending(PDO $pdo, array $row): bool
{
    $statement = $pdo->prepare('SELECT * FROM module_drafts WHERE module_id = ? LIMIT 1');
    $statement->execute([(int) $row['id']]);
    $draft = $statement->fetch();
    if (!$draft) {
        return false;
    }
    $view = aapm_cur_draft_view($draft);
    return aapm_cur_checksum($view['payload']) !== aapm_cur_checksum(aapm_cur_payload_from_row($row))
        || aapm_cur_checksum(aapm_cur_question_content($view['questions'])) !== aapm_cur_checksum(aapm_cur_question_content(aapm_cur_live_questions($pdo, (int) $row['module_number'])));
}

function import_final_pending(PDO $pdo): bool
{
    $draft = $pdo->query("SELECT question_payload_json FROM question_bank_drafts WHERE scope_type = 'final' AND module_number = 0 LIMIT 1")->fetch();
    if (!$draft || (string) $draft['question_payload_json'] === 'null') {
        return false;
    }
    $questions = json_decode((string) $draft['question_payload_json'], true) ?: [];
    return aapm_cur_checksum(aapm_cur_question_content($questions)) !== aapm_cur_checksum(aapm_cur_question_content(aapm_cur_live_questions($pdo, 0)));
}

/** @return list<array<string, mixed>> */
function import_questions(array $questions): array
{
    return array_map(static fn ($question): array => aapm_cur_normalise_question(is_array($question) ? $question : []), $questions);
}

// ------------------------------------------------------------------ plan
$plan = [];
$blocking = [];
$seen = [];
foreach ($package['modules'] as $entry) {
    $number = (int) ($entry['moduleNumber'] ?? 0);
    if ($number < 1 || isset($seen[$number])) {
        import_fail(2, 'Paket memuat nomor modul yang tidak valid atau berulang.');
    }
    $seen[$number] = true;
    if ($onlyModules !== null && !in_array($number, $onlyModules, true)) {
        continue;
    }
    $statement = $pdo->prepare('SELECT * FROM course_modules WHERE module_number = ? AND curriculum_id = ? LIMIT 1');
    $statement->execute([$number, $curriculumId]);
    $row = $statement->fetch();
    if (!$row) {
        $plan[] = ['moduleNumber' => $number, 'status' => 'not_found'];
        $blocking[] = $number;
        continue;
    }
    if ((string) ($row['lifecycle_status'] ?? 'active') !== 'active') {
        $plan[] = ['moduleNumber' => $number, 'title' => (string) $row['title'], 'status' => 'not_active', 'lifecycleStatus' => (string) $row['lifecycle_status']];
        $blocking[] = $number;
        continue;
    }
    if (import_module_pending($pdo, $row)) {
        $plan[] = ['moduleNumber' => $number, 'title' => (string) $row['title'], 'status' => 'pending_draft'];
        $blocking[] = $number;
        continue;
    }

    $published = aapm_cur_payload_from_row($row);
    $fields = (array) ($entry['fields'] ?? []);
    $input = [];
    foreach (IMPORT_TEXT_FIELDS as $key) {
        if (array_key_exists($key, $fields)) {
            $input[$key] = (string) $fields[$key];
        }
    }
    foreach (IMPORT_LIST_FIELDS as $key) {
        if (array_key_exists($key, $fields)) {
            $input[$key] = array_values((array) $fields[$key]);
        }
    }
    $retiredUrls = import_retired_urls($entry);
    if (in_array(normalise_lesson_video_url($published['videoUrl'] ?? ''), $retiredUrls, true)) {
        $input['videoUrl'] = '';
    }
    $kept = [];
    $removedMedia = 0;
    if (isset($entry['editorialBlocks']) && is_array($entry['editorialBlocks'])) {
        [$input['editorialContent'], $kept, $removedMedia] = import_editorial((string) $published['editorialContent'], $entry['editorialBlocks'], $preserveTypes, $retiredUrls);
    }
    $target = aapm_cur_normalise_content($input, $published, $curriculumId);
    $target['moduleNumber'] = $number;

    $liveQuestions = aapm_cur_live_questions($pdo, $number);
    $targetQuestions = isset($entry['questions']) && is_array($entry['questions']) ? import_questions($entry['questions']) : aapm_cur_question_content($liveQuestions);
    $errors = aapm_cur_validate_draft($pdo, $row, $target, $targetQuestions);
    if ($errors !== []) {
        import_fail(4, "Modul {$number} tidak lolos validasi: " . json_encode($errors, JSON_UNESCAPED_UNICODE));
    }

    $changed = [];
    foreach ($target as $key => $value) {
        if (($published[$key] ?? null) !== $value) {
            $changed[] = $key;
        }
    }
    $questionsChanged = aapm_cur_checksum($targetQuestions) !== aapm_cur_checksum(aapm_cur_question_content($liveQuestions));
    if ($questionsChanged) {
        $changed[] = 'questions';
    }
    $plan[] = [
        'moduleNumber' => $number,
        'moduleId' => (int) $row['id'],
        'status' => $changed === [] ? 'unchanged' : 'update',
        'title' => ['current' => (string) $row['title'], 'target' => $target['title']],
        'changedFields' => $changed,
        'keptMediaBlocks' => $kept,
        'removedMediaBlocks' => $removedMedia,
        'questionCount' => ['current' => count($liveQuestions), 'target' => count($targetQuestions)],
        '_published' => aapm_cur_checksum($published),
        '_payload' => $target,
        '_questions' => $targetQuestions,
    ];
}

$finalPlan = null;
if (!$skipFinal && isset($package['finalExam']['questions']) && is_array($package['finalExam']['questions'])) {
    $finalQuestions = import_questions($package['finalExam']['questions']);
    $finalErrors = aapm_cur_final_bank_errors($finalQuestions);
    if ($finalErrors !== []) {
        import_fail(4, 'Bank ujian akhir tidak lolos validasi: ' . json_encode($finalErrors, JSON_UNESCAPED_UNICODE));
    }
    $liveFinal = aapm_cur_live_questions($pdo, 0);
    $pending = import_final_pending($pdo);
    $finalPlan = [
        'status' => $pending ? 'pending_draft' : (aapm_cur_checksum($finalQuestions) === aapm_cur_checksum(aapm_cur_question_content($liveFinal)) ? 'unchanged' : 'update'),
        'questionCount' => ['current' => count($liveFinal), 'target' => count($finalQuestions)],
        '_questions' => $finalQuestions,
    ];
    if ($pending) {
        $blocking[] = 'final';
    }
}

$publicPlan = array_map(static function (array $item): array {
    return array_filter($item, static fn (string $key): bool => $key[0] !== '_', ARRAY_FILTER_USE_KEY);
}, $plan);
$summary = [
    'environment' => $environment,
    'package' => $packageId,
    'mode' => $dryRun ? 'dry-run' : 'apply',
    'modules' => $publicPlan,
    'finalExam' => $finalPlan === null ? null : array_filter($finalPlan, static fn (string $key): bool => $key[0] !== '_', ARRAY_FILTER_USE_KEY),
    'blocking' => $blocking,
];

if ($dryRun) {
    $importFinished = true;
    ob_end_clean();
    import_print($summary + ['changed' => false]);
    exit(0);
}
if ($blocking !== []) {
    import_fail(4, 'Impor dibatalkan sebelum perubahan apa pun. Selesaikan atau terbitkan draf yang tertunda, atau pulihkan modul berikut: ' . implode(', ', $blocking));
}

// ------------------------------------------------------------------ apply
$audit = ['source' => 'curriculum-import', 'package' => $packageId, 'operator' => $operator, 'evidenceRef' => $evidence];
$published = [];
foreach ($plan as $item) {
    if ($item['status'] !== 'update') {
        continue;
    }
    $moduleId = (int) $item['moduleId'];
    aapm_tx_begin($pdo);
    try {
        $locked = aapm_cur_lock_module($pdo, $moduleId);
        $draft = aapm_cur_draft_locked($pdo, $locked, $actorId);
        $view = aapm_cur_draft_view($draft);
        $unchangedSincePlan = aapm_cur_checksum(aapm_cur_payload_from_row($locked)) === $item['_published']
            && aapm_cur_checksum($view['payload']) === $item['_published']
            && aapm_cur_checksum(aapm_cur_question_content($view['questions'])) === aapm_cur_checksum(aapm_cur_question_content(aapm_cur_live_questions($pdo, (int) $locked['module_number'])));
        if (!$unchangedSincePlan) {
            aapm_tx_rollback($pdo);
            import_fail(5, "Modul {$item['moduleNumber']} berubah sejak rencana dibuat. Modul yang sudah terbit: " . ($published === [] ? '-' : implode(', ', $published)) . '. Jalankan ulang --dry-run.');
        }
        $version = (int) $draft['draft_version'] + 1;
        $pdo->prepare('UPDATE module_drafts SET content_payload_json = ?, question_payload_json = ?, draft_version = ?, edited_by_user_id = ?, updated_at = ? WHERE module_id = ? AND draft_version = ?')
            ->execute([
                json_encode($item['_payload'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                json_encode($item['_questions'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                $version, $actorId, aapm_utc_now(), $moduleId, (int) $draft['draft_version'],
            ]);
        aapm_cur_event($pdo, 'draft.saved', (int) $item['moduleNumber'], null, null, $actorId, $audit + ['draftVersion' => $version]);
        aapm_tx_commit($pdo);
    } catch (Throwable $exception) {
        aapm_tx_rollback($pdo);
        throw $exception;
    }
    $result = aapm_cur_publish($moduleId, $version, $actorId);
    $published[] = $item['moduleNumber'];
    fwrite(STDOUT, "Modul {$item['moduleNumber']} terbit sebagai revisi {$result['revisionNumber']}.\n");
}

$finalResult = null;
if ($finalPlan !== null && $finalPlan['status'] === 'update') {
    $draft = aapm_cur_final_bank_draft($pdo, $actorId);
    $saved = aapm_cur_final_bank_write(['expectedDraftVersion' => $draft['draftVersion'], 'questions' => $finalPlan['_questions']], 'replace', null, $actorId);
    // The bank writer records its own draft event; this one ties that draft to the package.
    aapm_cur_event($pdo, 'final_bank.imported', 0, null, null, $actorId, $audit + ['draftVersion' => $saved['draftVersion']]);
    $finalResult = aapm_cur_final_bank_publish($saved['draftVersion'], $actorId);
    fwrite(STDOUT, "Bank ujian akhir terbit sebagai revisi {$finalResult['revisionNumber']}.\n");
}

$importFinished = true;
ob_end_clean();
import_print($summary + ['changed' => $published !== [] || $finalResult !== null, 'publishedModules' => $published, 'finalExamRevision' => $finalResult['revisionNumber'] ?? null]);
exit(0);
