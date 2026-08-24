<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

start_app_session();
$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$rawPath = isset($_GET['path']) ? (string) $_GET['path'] : (string) (parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '');
$path = trim($rawPath, '/');
$path = preg_replace('#^api/?#', '', $path);
$path = preg_replace('#^index\.php/?#', '', $path);
$path = trim((string) $path, '/');

try {
    if ($path === 'health' && $method === 'GET') {
        db();
        json_response(['ok' => true, 'app' => 'aapm-layer-academy-native', 'environment' => app_config()['app_env']]);
    }

    if ($path === 'auth/me' && $method === 'GET') {
        $user = current_user();
        if (!$user) {
            error_response('Silakan login terlebih dahulu.', 401, 'auth_required');
        }
        json_response(['user' => $user, 'csrfToken' => csrf_token()]);
    }

    if ($path === 'auth/login' && $method === 'POST') {
        $input = request_json();
        $email = normalize_email($input['email'] ?? '');
        $password = (string) ($input['password'] ?? '');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
            error_response('Email dan password wajib diisi.', 422, 'validation_error');
        }

        $stmt = db()->prepare('SELECT id, email, password_hash, full_name, role, created_at FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        if (!$user || !password_verify($password, $user['password_hash'])) {
            error_response('Email atau password tidak sesuai.', 401, 'invalid_credentials');
        }

        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) $user['id'];
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        unset($user['password_hash']);
        json_response(['user' => $user, 'csrfToken' => csrf_token()]);
    }

    if ($path === 'auth/register' && $method === 'POST') {
        $input = request_json();
        $email = normalize_email($input['email'] ?? '');
        $password = (string) ($input['password'] ?? '');
        $fullName = trim((string) ($input['fullName'] ?? $input['full_name'] ?? ''));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            error_response('Masukkan alamat email yang valid.', 422, 'validation_error');
        }
        if (strlen($password) < 8) {
            error_response('Password minimal 8 karakter.', 422, 'validation_error');
        }
        if ($fullName === '') {
            $fullName = ucfirst((string) strtok($email, '@'));
        }

        $existing = db()->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $existing->execute([$email]);
        if ($existing->fetch()) {
            error_response('Email tersebut sudah terdaftar.', 409, 'email_exists');
        }

        $stmt = db()->prepare('INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)');
        $stmt->execute([$email, password_hash($password, PASSWORD_DEFAULT), $fullName, 'user']);
        $userId = (int) db()->lastInsertId();
        session_regenerate_id(true);
        $_SESSION['user_id'] = $userId;
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        $user = current_user();
        json_response(['user' => $user, 'csrfToken' => csrf_token()], 201);
    }

    if ($path === 'auth/logout' && $method === 'POST') {
        require_csrf();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', (bool) $params['secure'], (bool) $params['httponly']);
        }
        session_destroy();
        json_response(['ok' => true]);
    }

    if ($path === 'auth/forgot-password' && $method === 'POST') {
        $input = request_json();
        $email = normalize_email($input['email'] ?? '');
        $result = ['message' => 'Jika akun tersebut ada, instruksi reset password telah dibuat.'];
        if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $stmt = db()->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
            $stmt->execute([$email]);
            $user = $stmt->fetch();
            if ($user) {
                $token = bin2hex(random_bytes(32));
                $expires = date('Y-m-d H:i:s', time() + 3600);
                $update = db()->prepare('UPDATE users SET reset_token_hash = ?, reset_token_expires_at = ? WHERE id = ?');
                $update->execute([hash('sha256', $token), $expires, (int) $user['id']]);
                if (app_config()['app_env'] === 'local' && app_config()['expose_dev_reset_token']) {
                    $result['devResetToken'] = $token;
                }
            }
        }
        json_response($result);
    }

    if ($path === 'auth/reset-password' && $method === 'POST') {
        $input = request_json();
        $token = trim((string) ($input['token'] ?? $input['resetToken'] ?? ''));
        $password = (string) ($input['newPassword'] ?? $input['password'] ?? '');
        if (strlen($password) < 8 || $token === '') {
            error_response('Token reset dan password minimal 8 karakter wajib diisi.', 422, 'validation_error');
        }
        $stmt = db()->prepare('SELECT id FROM users WHERE reset_token_hash = ? AND reset_token_expires_at > ? LIMIT 1');
        $stmt->execute([hash('sha256', $token), date('Y-m-d H:i:s')]);
        $user = $stmt->fetch();
        if (!$user) {
            error_response('Link reset password sudah tidak berlaku.', 400, 'invalid_reset_token');
        }
        $update = db()->prepare('UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_token_expires_at = NULL WHERE id = ?');
        $update->execute([password_hash($password, PASSWORD_DEFAULT), (int) $user['id']]);
        json_response(['ok' => true]);
    }

    if ($path === 'modules' && $method === 'GET') {
        require_user();
        $rows = db()->query('SELECT * FROM course_modules ORDER BY sort_order ASC, module_number ASC')->fetchAll();
        json_response(array_map('present_module', $rows));
    }

    if ($path === 'quiz' && $method === 'GET') {
        require_user();
        $moduleNumber = isset($_GET['moduleNumber']) ? (int) $_GET['moduleNumber'] : null;
        if ($moduleNumber === null) {
            error_response('moduleNumber wajib diisi.', 422, 'validation_error');
        }
        $stmt = db()->prepare('SELECT * FROM quiz_questions WHERE module_number = ? ORDER BY id ASC');
        $stmt->execute([$moduleNumber]);
        json_response(array_map('present_question', $stmt->fetchAll()));
    }

    if ($path === 'progress' && $method === 'GET') {
        $user = require_user();
        $stmt = db()->prepare('SELECT * FROM user_progress WHERE user_id = ? ORDER BY module_number ASC');
        $stmt->execute([(int) $user['id']]);
        json_response(array_map('present_progress', $stmt->fetchAll()));
    }

    if ($path === 'progress' && ($method === 'POST' || $method === 'PUT')) {
        $user = require_user();
        require_csrf();
        $input = request_json();
        $moduleNumber = (int) ($input['moduleNumber'] ?? 0);
        if ($moduleNumber < 0 || $moduleNumber > 22) {
            error_response('Nomor modul tidak valid.', 422, 'validation_error');
        }

        $values = [
            'completed' => bool_value($input['completed'] ?? false),
            'quiz_score' => array_key_exists('quizScore', $input) && $input['quizScore'] !== null ? (int) $input['quizScore'] : null,
            'quiz_total' => array_key_exists('quizTotal', $input) && $input['quizTotal'] !== null ? (int) $input['quizTotal'] : null,
            'practical_done' => bool_value($input['practicalDone'] ?? false),
            'time_spent_minutes' => array_key_exists('timeSpentMinutes', $input) && $input['timeSpentMinutes'] !== null ? (int) $input['timeSpentMinutes'] : null,
        ];
        $existing = db()->prepare('SELECT id FROM user_progress WHERE user_id = ? AND module_number = ? LIMIT 1');
        $existing->execute([(int) $user['id'], $moduleNumber]);
        $row = $existing->fetch();
        if ($row) {
            $update = db()->prepare('UPDATE user_progress SET completed = ?, quiz_score = ?, quiz_total = ?, practical_done = ?, time_spent_minutes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
            $update->execute([$values['completed'], $values['quiz_score'], $values['quiz_total'], $values['practical_done'], $values['time_spent_minutes'], (int) $row['id']]);
            $id = (int) $row['id'];
        } else {
            $insert = db()->prepare('INSERT INTO user_progress (user_id, module_number, completed, quiz_score, quiz_total, practical_done, time_spent_minutes) VALUES (?, ?, ?, ?, ?, ?, ?)');
            $insert->execute([(int) $user['id'], $moduleNumber, $values['completed'], $values['quiz_score'], $values['quiz_total'], $values['practical_done'], $values['time_spent_minutes']]);
            $id = (int) db()->lastInsertId();
        }
        $stmt = db()->prepare('SELECT * FROM user_progress WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        json_response(present_progress($stmt->fetch()));
    }

    if ($path === 'certificates' && $method === 'GET') {
        $user = require_user();
        $stmt = db()->prepare('SELECT * FROM certificates WHERE user_id = ? ORDER BY level_number ASC, issued_at ASC');
        $stmt->execute([(int) $user['id']]);
        json_response(array_map('present_certificate', $stmt->fetchAll()));
    }

    if ($path === 'certificates' && $method === 'POST') {
        $user = require_user();
        require_csrf();
        $input = request_json();
        $levelNumber = (int) ($input['levelNumber'] ?? 0);
        $levelName = trim((string) ($input['levelName'] ?? ''));
        $examType = trim((string) ($input['examType'] ?? 'level'));
        $score = nullable_number($input, 'score');
        if ($levelNumber < 1 || $levelName === '' || !in_array($examType, ['module', 'level', 'final'], true)) {
            error_response('Data sertifikat tidak lengkap.', 422, 'validation_error');
        }
        $holderName = trim((string) ($input['holderName'] ?? '')) ?: ((string) $user['full_name'] ?: (string) $user['email']);
        try {
            $insert = db()->prepare('INSERT INTO certificates (user_id, level_number, level_name, score, exam_type, holder_name) VALUES (?, ?, ?, ?, ?, ?)');
            $insert->execute([(int) $user['id'], $levelNumber, $levelName, $score === null ? 0 : $score, $examType, $holderName]);
            $id = (int) db()->lastInsertId();
        } catch (PDOException $exception) {
            if (strpos(strtolower($exception->getMessage()), 'unique') !== false || strpos(strtolower($exception->getMessage()), 'duplicate') !== false) {
                error_response('Sertifikat untuk level ini sudah ada.', 409, 'certificate_exists');
            }
            throw $exception;
        }
        $stmt = db()->prepare('SELECT * FROM certificates WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        json_response(present_certificate($stmt->fetch()), 201);
    }

    if ($path === 'farm-data' && $method === 'GET') {
        $user = require_user();
        $stmt = db()->prepare('SELECT * FROM farm_data WHERE user_id = ? ORDER BY week ASC, id ASC');
        $stmt->execute([(int) $user['id']]);
        json_response(array_map('present_farm_data', $stmt->fetchAll()));
    }

    if ($path === 'farm-data' && ($method === 'POST' || $method === 'PUT')) {
        $user = require_user();
        require_csrf();
        $input = request_json();
        $week = (int) ($input['week'] ?? 0);
        if ($week < 1) {
            error_response('Umur ayam (minggu) wajib diisi.', 422, 'validation_error');
        }
        $values = [
            'week' => $week,
            'hen_day_production' => nullable_number($input, 'henDayProduction'),
            'feed_intake' => nullable_number($input, 'feedIntake'),
            'egg_weight' => nullable_number($input, 'eggWeight'),
            'mortality' => nullable_number($input, 'mortality'),
            'water_intake' => nullable_number($input, 'waterIntake'),
            'temperature' => nullable_number($input, 'temperature'),
            'humidity' => nullable_number($input, 'humidity'),
            'revenue' => nullable_number($input, 'revenue'),
            'cost' => nullable_number($input, 'cost'),
            'fcr' => nullable_number($input, 'fcr'),
            'notes' => trim((string) ($input['notes'] ?? '')),
        ];
        $id = isset($input['id']) ? (int) $input['id'] : 0;
        if ($id > 0) {
            $update = db()->prepare('UPDATE farm_data SET week = ?, hen_day_production = ?, feed_intake = ?, egg_weight = ?, mortality = ?, water_intake = ?, temperature = ?, humidity = ?, revenue = ?, cost = ?, fcr = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?');
            $update->execute(array_merge(array_values($values), [$id, (int) $user['id']]));
        } else {
            $insert = db()->prepare('INSERT INTO farm_data (user_id, week, hen_day_production, feed_intake, egg_weight, mortality, water_intake, temperature, humidity, revenue, cost, fcr, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $insert->execute(array_merge([(int) $user['id']], array_values($values)));
            $id = (int) db()->lastInsertId();
        }
        $stmt = db()->prepare('SELECT * FROM farm_data WHERE id = ? AND user_id = ? LIMIT 1');
        $stmt->execute([$id, (int) $user['id']]);
        $row = $stmt->fetch();
        if (!$row) {
            error_response('Data farm tidak ditemukan.', 404, 'not_found');
        }
        json_response(present_farm_data($row), $method === 'POST' ? 201 : 200);
    }

    if ($path === 'farm-data' && $method === 'DELETE') {
        $user = require_user();
        require_csrf();
        $id = (int) ($_GET['id'] ?? 0);
        if ($id < 1) {
            error_response('ID data farm wajib diisi.', 422, 'validation_error');
        }
        $stmt = db()->prepare('DELETE FROM farm_data WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, (int) $user['id']]);
        json_response(['ok' => true]);
    }

    if ($path === 'ai-assistant' && $method === 'POST') {
        $user = require_user();
        require_csrf();
        $input = request_json();
        $message = trim((string) ($input['message'] ?? ''));
        if ($message === '') {
            error_response('Pertanyaan wajib diisi.', 422, 'validation_error');
        }
        json_response(['reply' => native_ai_reply($message, $input['farmContext'] ?? null)]);
    }

    error_response('Endpoint tidak ditemukan.', 404, 'not_found');
} catch (Throwable $exception) {
    error_log('[aapm-native-api] ' . $exception->getMessage());
    error_response('Terjadi kesalahan pada server.', 500, 'server_error');
}

function native_ai_reply(string $message, $farmContext): string
{
    $text = function_exists('mb_strtolower') ? mb_strtolower($message, 'UTF-8') : strtolower($message);
    $contextNote = '';
    if (is_array($farmContext) && count($farmContext) > 0) {
        $latest = end($farmContext);
        if (is_array($latest)) {
            $contextNote = sprintf(
                "\n\nData terakhir yang terbaca: minggu %s, HDP %s%%, FCR %s.",
                $latest['week'] ?? '—',
                $latest['henDayProduction'] ?? '—',
                $latest['fcr'] ?? '—'
            );
        }
    }

    if (strpos($text, 'hdp') !== false || strpos($text, 'produksi') !== false) {
        return 'Untuk penurunan HDP, cek berurutan: konsumsi pakan dan air, suhu serta kelembapan, pencahayaan, kualitas telur, mortalitas, kemudian tanda klinis dan program vaksinasi. Bandingkan data minimal 7 hari agar perubahan harian tidak menyesatkan. Untuk dugaan penyakit, libatkan dokter hewan.' . $contextNote;
    }
    if (strpos($text, 'air') !== false || strpos($text, 'water') !== false) {
        return 'Kenaikan konsumsi air perlu dibandingkan dengan suhu, kelembapan, feed intake, kebocoran nipple, tekanan air, dan kadar garam dalam pakan. Pastikan alat ukur serta jalur minum bersih sebelum menyimpulkan masalah kesehatan.' . $contextNote;
    }
    if (strpos($text, 'fcr') !== false || strpos($text, 'pakan') !== false) {
        return 'Untuk memperbaiki FCR, pantau feed intake aktual, egg mass, kualitas dan distribusi pakan, bobot badan, uniformity, serta kehilangan pakan. Evaluasi per minggu dan pisahkan masalah nutrisi dari masalah lingkungan.' . $contextNote;
    }
    if (strpos($text, 'biosecurity') !== false) {
        return 'Checklist biosecurity harian: batasi akses, gunakan footbath yang aktif, catat tamu dan kendaraan, bersihkan area kerja, kendalikan rodent dan burung liar, cek mortalitas, lalu dokumentasikan temuan dan tindakan koreksi.' . $contextNote;
    }

    return 'Saya adalah asisten lokal Layer Farm Academy. Saya bisa membantu membaca HDP, FCR, feed intake, konsumsi air, egg weight, mortalitas, biosecurity, dan rencana perbaikan. Sertakan angka, periode, dan perubahan dari minggu sebelumnya agar analisis lebih tajam.' . $contextNote;
}
