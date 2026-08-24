<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/openrouter.php';

apply_security_headers();
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

    if ($path === 'auth/csrf' && $method === 'GET') {
        json_response(['csrfToken' => csrf_token()]);
    }

    if ($path === 'auth/providers' && $method === 'GET') {
        json_response(['google' => google_oauth_configured()]);
    }

    if ($path === 'auth/google' && $method === 'GET') {
        if (!google_oauth_configured()) {
            error_response('Google login belum dikonfigurasi.', 503, 'provider_unavailable');
        }

        $state = bin2hex(random_bytes(32));
        $_SESSION['google_oauth_state'] = $state;
        $_SESSION['google_return_to'] = safe_return_path($_GET['returnTo'] ?? '/');
        $query = http_build_query([
            'client_id' => app_config()['google_client_id'],
            'redirect_uri' => google_redirect_uri(),
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
            'access_type' => 'online',
            'prompt' => 'select_account',
        ]);
        redirect_response('https://accounts.google.com/o/oauth2/v2/auth?' . $query);
    }

    if ($path === 'auth/google/callback' && $method === 'GET') {
        $returnTo = safe_return_path($_SESSION['google_return_to'] ?? '/');
        $baseUrl = app_base_url();
        $expectedState = (string) ($_SESSION['google_oauth_state'] ?? '');
        unset($_SESSION['google_oauth_state'], $_SESSION['google_return_to']);

        if (!google_oauth_configured() || isset($_GET['error'])) {
            redirect_response($baseUrl . '/login?oauth=cancelled');
        }

        $state = (string) ($_GET['state'] ?? '');
        if ($state === '' || $expectedState === '' || !hash_equals($expectedState, $state)) {
            redirect_response($baseUrl . '/login?oauth=error');
        }

        $code = trim((string) ($_GET['code'] ?? ''));
        if ($code === '') {
            redirect_response($baseUrl . '/login?oauth=error');
        }

        $tokenResponse = google_exchange_code($code);
        $accessToken = (string) ($tokenResponse['access_token'] ?? '');
        if ($accessToken === '') {
            redirect_response($baseUrl . '/login?oauth=error');
        }

        $profile = google_user_profile($accessToken);
        $email = normalize_email($profile['email'] ?? '');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || empty($profile['email_verified'])) {
            redirect_response($baseUrl . '/login?oauth=unverified');
        }

        $stmt = db()->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        if (!$user) {
            $fullName = trim(substr(preg_replace('/[\x00-\x1F\x7F]/', '', (string) ($profile['name'] ?? '')), 0, 160));
            if ($fullName === '') {
                $fullName = ucfirst((string) strtok($email, '@'));
            }
            try {
                $insert = db()->prepare('INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)');
                $insert->execute([$email, app_password_hash(bin2hex(random_bytes(32))), $fullName, 'user']);
                $userId = (int) db()->lastInsertId();
            } catch (PDOException $exception) {
                if (strpos(strtolower($exception->getMessage()), 'unique') === false && strpos(strtolower($exception->getMessage()), 'duplicate') === false) {
                    throw $exception;
                }
                $retry = db()->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
                $retry->execute([$email]);
                $userId = (int) ($retry->fetch()['id'] ?? 0);
            }
        } else {
            $userId = (int) $user['id'];
        }

        if ($userId < 1) {
            redirect_response($baseUrl . '/login?oauth=error');
        }
        session_regenerate_id(true);
        $_SESSION['user_id'] = $userId;
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        redirect_response($baseUrl . $returnTo);
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
        require_csrf();
        rate_limit_guard('login-ip', '', 60, 900, 900);
        rate_limit_guard('login-user', $email, 8, 900, 900);

        $stmt = db()->prepare('SELECT id, email, password_hash, full_name, role, created_at FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        if (!$user || !password_verify($password, $user['password_hash'])) {
            rate_limit_failure('login-ip', '', 60, 900, 900);
            rate_limit_failure('login-user', $email, 8, 900, 900);
            error_response('Email atau password tidak sesuai.', 401, 'invalid_credentials');
        }

        rate_limit_clear('login-ip');
        rate_limit_clear('login-user', $email);
        if (password_needs_rehash($user['password_hash'], password_algorithm())) {
            db()->prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([app_password_hash($password), (int) $user['id']]);
        }

        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) $user['id'];
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        json_response(['user' => present_authenticated_user($user), 'csrfToken' => csrf_token()]);
    }

    if ($path === 'auth/register' && $method === 'POST') {
        $input = request_json();
        $email = normalize_email($input['email'] ?? '');
        $password = (string) ($input['password'] ?? '');
        $fullName = trim((string) ($input['fullName'] ?? $input['full_name'] ?? ''));
        require_csrf();
        rate_limit_guard('register-ip', '', 10, 3600, 3600);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            error_response('Masukkan alamat email yang valid.', 422, 'validation_error');
        }
        $passwordError = password_validation_error($password);
        if ($passwordError !== '') {
            error_response($passwordError, 422, 'validation_error');
        }
        if ($fullName === '') {
            $fullName = ucfirst((string) strtok($email, '@'));
        }
        $fullName = substr(preg_replace('/[\x00-\x1F\x7F]/', '', $fullName), 0, 160);

        $existing = db()->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $existing->execute([$email]);
        if ($existing->fetch()) {
            error_response('Email tersebut sudah terdaftar.', 409, 'email_exists');
        }

        try {
            $stmt = db()->prepare('INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)');
            $stmt->execute([$email, app_password_hash($password), $fullName, 'user']);
        } catch (PDOException $exception) {
            if (strpos(strtolower($exception->getMessage()), 'unique') !== false || strpos(strtolower($exception->getMessage()), 'duplicate') !== false) {
                error_response('Email tersebut sudah terdaftar.', 409, 'email_exists');
            }
            throw $exception;
        }
        rate_limit_clear('register-ip');
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
        require_csrf();
        rate_limit_guard('forgot-ip', '', 10, 3600, 3600);
        if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
            rate_limit_guard('forgot-user', $email, 3, 3600, 3600);
        }
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
                send_password_reset_email($email, $token);
                if (app_config()['app_env'] === 'local' && app_config()['expose_dev_reset_token']) {
                    $result['devResetToken'] = $token;
                }
            }
        }
        rate_limit_failure('forgot-ip', '', 10, 3600, 3600);
        if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
            rate_limit_failure('forgot-user', $email, 3, 3600, 3600);
        }
        json_response($result);
    }

    if ($path === 'auth/reset-password' && $method === 'POST') {
        $input = request_json();
        $token = trim((string) ($input['token'] ?? $input['resetToken'] ?? ''));
        $password = (string) ($input['newPassword'] ?? $input['password'] ?? '');
        require_csrf();
        rate_limit_guard('reset-ip', '', 10, 3600, 3600);
        $passwordError = password_validation_error($password);
        if ($passwordError !== '' || $token === '') {
            rate_limit_failure('reset-ip', '', 10, 3600, 3600);
            error_response($token === '' ? 'Token reset wajib diisi.' : $passwordError, 422, 'validation_error');
        }
        $stmt = db()->prepare('SELECT id FROM users WHERE reset_token_hash = ? AND reset_token_expires_at > ? LIMIT 1');
        $stmt->execute([hash('sha256', $token), date('Y-m-d H:i:s')]);
        $user = $stmt->fetch();
        if (!$user) {
            rate_limit_failure('reset-ip', '', 10, 3600, 3600);
            error_response('Link reset password sudah tidak berlaku.', 400, 'invalid_reset_token');
        }
        $update = db()->prepare('UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_token_expires_at = NULL WHERE id = ?');
        $update->execute([app_password_hash($password), (int) $user['id']]);
        rate_limit_clear('reset-ip');
        unset($_SESSION['user_id']);
        session_regenerate_id(true);
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        json_response(['ok' => true]);
    }

    if ($path === 'admin/overview' && $method === 'GET') {
        require_admin();
        json_response(admin_overview_data());
    }

    if ($path === 'admin/courses' && $method === 'GET') {
        require_admin();
        json_response(['courses' => [admin_course_data()]]);
    }

    if (preg_match('#^admin/courses/([^/]+)$#', $path, $matches) && $method === 'GET') {
        require_admin();
        $courseId = rawurldecode($matches[1]);
        if ($courseId !== admin_course_id()) {
            error_response('Course tidak ditemukan.', 404, 'not_found');
        }
        json_response(admin_course_detail_data());
    }

    if ($path === 'admin/learners' && $method === 'GET') {
        require_admin();
        json_response(['learners' => admin_learner_list((string) ($_GET['search'] ?? ''))]);
    }

    if (preg_match('#^admin/learners/(\\d+)$#', $path, $matches) && $method === 'GET') {
        require_admin();
        $learner = admin_learner_detail((int) $matches[1]);
        if (!$learner) {
            error_response('Learner tidak ditemukan.', 404, 'not_found');
        }
        json_response($learner);
    }

    if ($path === 'admin/ai-settings' && $method === 'GET') {
        require_admin();
        json_response(ai_settings_status());
    }

    if ($path === 'admin/ai-settings' && $method === 'PUT') {
        require_admin();
        require_csrf();
        json_response(ai_save_settings(request_json()));
    }

    if ($path === 'admin/ai-settings/test' && $method === 'POST') {
        require_admin();
        require_csrf();
        json_response(ai_test_connection());
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

    if ($path === 'ai-assistant/stream' && $method === 'POST') {
        $user = require_user();
        require_csrf();
        $input = request_json();
        $message = trim((string) ($input['message'] ?? ''));
        if ($message === '') {
            error_response('Pertanyaan wajib diisi.', 422, 'validation_error');
        }
        if (strlen($message) > 3000) {
            error_response('Pertanyaan terlalu panjang. Batasi hingga 3.000 karakter.', 422, 'validation_error');
        }
        rate_limit_guard('ai-user', (string) $user['id'], 30, 300, 300);
        $farmContext = is_array($input['farmContext'] ?? null) ? ai_context_for_user((int) $user['id']) : [];
        ai_sse_start();
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }
        ai_assistant_stream($message, $farmContext);
        rate_limit_failure('ai-user', (string) $user['id'], 30, 300, 300);
        exit;
    }

    if ($path === 'ai-assistant' && $method === 'POST') {
        $user = require_user();
        require_csrf();
        $input = request_json();
        $message = trim((string) ($input['message'] ?? ''));
        if ($message === '') {
            error_response('Pertanyaan wajib diisi.', 422, 'validation_error');
        }
        if (strlen($message) > 3000) {
            error_response('Pertanyaan terlalu panjang. Batasi hingga 3.000 karakter.', 422, 'validation_error');
        }
        rate_limit_guard('ai-user', (string) $user['id'], 30, 300, 300);
        $farmContext = is_array($input['farmContext'] ?? null) ? ai_context_for_user((int) $user['id']) : [];
        $response = ai_assistant_reply($message, $farmContext);
        rate_limit_failure('ai-user', (string) $user['id'], 30, 300, 300);
        json_response($response);
    }

    error_response('Endpoint tidak ditemukan.', 404, 'not_found');
} catch (Throwable $exception) {
    error_log('[aapm-native-api] ' . $exception->getMessage());
    error_response('Terjadi kesalahan pada server.', 500, 'server_error');
}

function redirect_response(string $url, int $status = 302): void
{
    if (preg_match('/[\r\n]/', $url)) {
        error_response('Redirect tidak valid.', 500, 'invalid_redirect');
    }

    http_response_code($status);
    header('Cache-Control: no-store');
    header('Location: ' . $url);
    exit;
}

function google_oauth_configured(): bool
{
    $config = app_config();
    return trim((string) ($config['google_client_id'] ?? '')) !== ''
        && trim((string) ($config['google_client_secret'] ?? '')) !== ''
        && google_redirect_uri() !== '';
}

function google_redirect_uri(): string
{
    $configured = trim((string) (app_config()['google_redirect_uri'] ?? ''));
    if ($configured !== '') {
        return $configured;
    }

    $baseUrl = app_base_url();
    return $baseUrl === '' ? '' : $baseUrl . '/api/auth/google/callback';
}

function google_http_request(string $url, array $headers = [], string $postFields = ''): array
{
    if (!function_exists('curl_init')) {
        return [];
    }

    $handle = curl_init($url);
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_USERAGENT => 'AAPM-Layer-Academy/1.0',
        CURLOPT_HTTPHEADER => $headers,
    ]);
    if ($postFields !== '') {
        curl_setopt($handle, CURLOPT_POST, true);
        curl_setopt($handle, CURLOPT_POSTFIELDS, $postFields);
    }

    $body = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
    curl_close($handle);
    if (!is_string($body) || $status < 200 || $status >= 300) {
        return [];
    }

    $decoded = json_decode($body, true);
    return is_array($decoded) ? $decoded : [];
}

function google_exchange_code(string $code): array
{
    $config = app_config();
    return google_http_request(
        'https://oauth2.googleapis.com/token',
        ['Accept: application/json', 'Content-Type: application/x-www-form-urlencoded'],
        http_build_query([
            'code' => $code,
            'client_id' => $config['google_client_id'],
            'client_secret' => $config['google_client_secret'],
            'redirect_uri' => google_redirect_uri(),
            'grant_type' => 'authorization_code',
        ])
    );
}

function google_user_profile(string $accessToken): array
{
    return google_http_request(
        'https://openidconnect.googleapis.com/v1/userinfo',
        ['Accept: application/json', 'Authorization: Bearer ' . $accessToken]
    );
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
