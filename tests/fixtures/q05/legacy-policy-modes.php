<?php
declare(strict_types=1);
require __DIR__ . '/../../../public/api/bootstrap.php';
$pdo = db();
// Disposable migration fixture: reconstruct the pre-mode Q05 shape, including
// legitimate pre-Q05 optional content and Q05-created modules with publication provenance.
$insert = $pdo->prepare("INSERT INTO course_modules (level_number, level_name, module_number, title, category, summary, content, video_script, learning_objectives, key_takeaways, checklist, practical_assignment, sort_order, lifecycle_status) VALUES (1, 'Legacy', ?, 'Legacy optional', 'Test', 'Test', 'Test', '', '[]', '[]', '[]', '', ?, 'active')");
foreach ([98, 99] as $number) $insert->execute([$number, $number]);
$pdo->exec("INSERT INTO quiz_questions (module_number, question, options, correct_index, explanation, difficulty, type, learning_objective) VALUES (99, 'Legacy quiz', '[\"A\",\"B\"]', 0, '', 'easy', 'multiple_choice', '')");
$row = aapm_cur_policy_row($pdo, 'academy-v1');
$snapshot = json_decode($row['requirements_json'], true);
unset($snapshot['modeSnapshotVersion'], $snapshot['modules']); // Original v1 stored the fixed required set only.
$pdo->prepare("UPDATE curriculum_policy_versions SET requirements_json = ? WHERE policy_version = 'academy-v1'")->execute([json_encode($snapshot)]);
$pdo->exec("UPDATE curriculum_policy_modules SET assessment_mode = NULL WHERE policy_version = 'academy-v1'");
echo json_encode(['prepared' => true]);
