<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Seed hanya boleh dijalankan dari CLI.\n");
}

require_once __DIR__ . '/../public/api/bootstrap.php';
$seed = require __DIR__ . '/seed-data.php';

try {
    $pdo = db();
    $pdo->beginTransaction();

    $moduleFind = $pdo->prepare('SELECT id FROM course_modules WHERE module_number = ? LIMIT 1');
    $moduleUpdate = $pdo->prepare('UPDATE course_modules SET level_number = ?, level_name = ?, title = ?, category = ?, summary = ?, content = ?, video_script = ?, learning_objectives = ?, key_takeaways = ?, checklist = ?, practical_assignment = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    $moduleInsert = $pdo->prepare('INSERT INTO course_modules (level_number, level_name, module_number, title, category, summary, content, video_script, learning_objectives, key_takeaways, checklist, practical_assignment, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

    foreach ($seed['modules'] as $module) {
        $moduleFind->execute([$module['module_number']]);
        $existing = $moduleFind->fetch();
        $encoded = [
            json_encode($module['learning_objectives'], JSON_UNESCAPED_UNICODE),
            json_encode($module['key_takeaways'], JSON_UNESCAPED_UNICODE),
            json_encode($module['checklist'], JSON_UNESCAPED_UNICODE),
        ];
        if ($existing) {
            $moduleUpdate->execute([
                $module['level_number'], $module['level_name'], $module['title'], $module['category'], $module['summary'],
                $module['content'], $module['video_script'], $encoded[0], $encoded[1], $encoded[2],
                $module['practical_assignment'], $module['sort_order'], (int) $existing['id'],
            ]);
        } else {
            $moduleInsert->execute([
                $module['level_number'], $module['level_name'], $module['module_number'], $module['title'], $module['category'],
                $module['summary'], $module['content'], $module['video_script'], $encoded[0], $encoded[1], $encoded[2],
                $module['practical_assignment'], $module['sort_order'],
            ]);
        }
    }

    $questionFind = $pdo->prepare('SELECT id FROM quiz_questions WHERE module_number = ? AND question = ? LIMIT 1');
    $questionUpdate = $pdo->prepare('UPDATE quiz_questions SET options = ?, correct_index = ?, explanation = ?, difficulty = ?, type = ?, learning_objective = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    $questionInsert = $pdo->prepare('INSERT INTO quiz_questions (module_number, question, options, correct_index, explanation, difficulty, type, learning_objective) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($seed['questions'] as $question) {
        $questionFind->execute([$question['module_number'], $question['question']]);
        $existing = $questionFind->fetch();
        $options = json_encode($question['options'], JSON_UNESCAPED_UNICODE);
        if ($existing) {
            $questionUpdate->execute([
                $options, $question['correct_index'], $question['explanation'], $question['difficulty'], $question['type'],
                $question['learning_objective'], (int) $existing['id'],
            ]);
        } else {
            $questionInsert->execute([
                $question['module_number'], $question['question'], $options, $question['correct_index'], $question['explanation'],
                $question['difficulty'], $question['type'], $question['learning_objective'],
            ]);
        }
    }

    $demoEmail = 'demo@aapmlayeracademy.id';
    $demoPassword = 'aapmacademy@2026';
    $userFind = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $userFind->execute([$demoEmail]);
    $demo = $userFind->fetch();
    if ($demo) {
        $demoUpdate = $pdo->prepare('UPDATE users SET password_hash = ?, full_name = ?, role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        $demoUpdate->execute([password_hash($demoPassword, PASSWORD_DEFAULT), 'Demo AAPM', 'user', (int) $demo['id']]);
    } else {
        $demoInsert = $pdo->prepare('INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)');
        $demoInsert->execute([$demoEmail, password_hash($demoPassword, PASSWORD_DEFAULT), 'Demo AAPM', 'user']);
    }

    $pdo->commit();
    echo "Native seed selesai.\n";
    echo "Demo login: {$demoEmail} / {$demoPassword}\n";
    echo count($seed['modules']) . " modul dan " . count($seed['questions']) . " soal tersedia.\n";
} catch (Throwable $exception) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, "Seed gagal: " . $exception->getMessage() . "\n");
    exit(1);
}
