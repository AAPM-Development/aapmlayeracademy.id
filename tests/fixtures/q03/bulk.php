<?php
declare(strict_types=1);

/**
 * Test helper: inserts curriculum modules and quiz questions in one process.
 * Only ever run against the DISPOSABLE database named by AAPLAYERACADEMY_CONFIG.
 *
 *   php bulk.php '{"modules":[{"module_number":98,...}],"questions":[{"module_number":99,...}]}'
 */

require __DIR__ . '/../../../public/api/bootstrap.php';

$spec = json_decode($argv[1] ?? '{}', true) ?: [];
$pdo = db();

$moduleInsert = $pdo->prepare(
    'INSERT INTO course_modules (level_number, level_name, module_number, title, category, summary, content, video_script, learning_objectives, key_takeaways, checklist, practical_assignment, sort_order, lifecycle_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
foreach ($spec['modules'] ?? [] as $module) {
    $moduleInsert->execute([
        (int) ($module['level_number'] ?? 1),
        (string) ($module['level_name'] ?? 'Uji'),
        (int) $module['module_number'],
        (string) ($module['title'] ?? 'Modul uji'),
        'Uji',
        'Ringkasan uji',
        'Konten uji',
        '',
        '[]',
        '[]',
        '[]',
        '',
        (int) ($module['sort_order'] ?? $module['module_number']),
        (string) ($module['lifecycle_status'] ?? 'active'),
    ]);
}

$questionInsert = $pdo->prepare(
    'INSERT INTO quiz_questions (module_number, question, options, correct_index, explanation, difficulty, type, learning_objective)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);
foreach ($spec['questions'] ?? [] as $question) {
    $questionInsert->execute([
        (int) $question['module_number'],
        (string) ($question['question'] ?? 'Pertanyaan uji'),
        json_encode($question['options'] ?? ['A', 'B', 'C', 'D'], JSON_UNESCAPED_UNICODE),
        (int) ($question['correct_index'] ?? 0),
        (string) ($question['explanation'] ?? 'Penjelasan uji'),
        'mudah',
        'pilihan_ganda',
        (string) ($question['learning_objective'] ?? 'Tujuan uji'),
    ]);
}

echo json_encode(['modules' => count($spec['modules'] ?? []), 'questions' => count($spec['questions'] ?? [])]);
