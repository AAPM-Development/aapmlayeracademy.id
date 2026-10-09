<?php
declare(strict_types=1);

/**
 * Test helper: builds a published revision that references an upload, then a draft
 * that no longer references it and references a different upload. Prints what the
 * media cleanup considers referenced. Read-only with respect to uploads: nothing is deleted.
 *
 *   php media-references.php <module id>
 */

require __DIR__ . '/../../../public/api/bootstrap.php';
require __DIR__ . '/../../../public/api/editorialMedia.php';

$moduleId = (int) ($argv[1] ?? 0);
$historic = 'uploads/editorial/images/2026/01/' . str_repeat('a', 40) . '.jpg';
$draftOnly = 'uploads/editorial/images/2026/01/' . str_repeat('b', 40) . '.jpg';
$unused = 'editorial/images/2026/01/' . str_repeat('c', 40) . '.jpg';
$actor = 1;

$module = aapm_cur_module_or_fail(db(), $moduleId);
$draft = aapm_cur_draft_locked(db(), $module, $actor);
$payload = json_decode((string) $draft['content_payload_json'], true) ?: [];
foreach (['learningObjectives', 'keyTakeaways', 'checklist'] as $key) {
    $payload[$key] = json_decode((string) ($payload[$key] ?? '[]'), true) ?: [];
}
$base = $payload;
$base['content'] = $payload['content'] . ' <img src="/' . $historic . '">';
$base['expectedDraftVersion'] = (int) $draft['draft_version'];
$saved = aapm_cur_save_draft($moduleId, $base, $actor);
$published = aapm_cur_publish($moduleId, $saved['draft']['version'], $actor);

$next = $payload;
$next['content'] = $payload['content'] . ' <img src="/' . $draftOnly . '">';
$next['expectedDraftVersion'] = $published['module']['draft']['version'];
aapm_cur_save_draft($moduleId, $next, $actor);

$referenced = editorial_referenced_uploads();
echo json_encode([
    'historicKept' => isset($referenced[substr($historic, strlen('uploads/'))]),
    'draftKept' => isset($referenced[substr($draftOnly, strlen('uploads/'))]),
    'unreferencedKept' => isset($referenced[$unused]),
    'revisionNumber' => $published['revisionNumber'],
]);
