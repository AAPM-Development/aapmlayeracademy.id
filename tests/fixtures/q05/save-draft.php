<?php
declare(strict_types=1);

/**
 * Test helper: one draft save as its own process, so two editors can race on the
 * same expected draft version against the disposable database.
 *
 *   php save-draft.php <module id> <expected version> <actor user id> <new title>
 */

require __DIR__ . '/../../../public/api/bootstrap.php';

$moduleId = (int) ($argv[1] ?? 0);
$expected = (int) ($argv[2] ?? 0);
$actor = (int) ($argv[3] ?? 0);
if (($argv[5] ?? '') === 'publish') {
    echo json_encode(aapm_cur_publish($moduleId, $expected, $actor));
    exit;
}

$module = aapm_cur_module_or_fail(db(), $moduleId);
$draft = aapm_cur_draft_locked(db(), $module, $actor);
$payload = json_decode((string) $draft['content_payload_json'], true) ?: [];
foreach (['learningObjectives', 'keyTakeaways', 'checklist'] as $key) {
    $payload[$key] = json_decode((string) ($payload[$key] ?? '[]'), true) ?: [];
}
$payload['title'] = (string) ($argv[4] ?? 'Judul uji');
$payload['expectedDraftVersion'] = $expected;

$view = aapm_cur_save_draft($moduleId, $payload, $actor);
echo json_encode(['saved' => true, 'draftVersion' => $view['draft']['version']]);
