<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/editorialMedia.php';
require_once __DIR__ . '/openrouter.php';

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$rawPath = isset($_GET['path']) ? (string) $_GET['path'] : (string) (parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '');
$path = trim($rawPath, '/');
$path = preg_replace('#^api/?#', '', $path);
$path = preg_replace('#^index\.php/?#', '', $path);
$path = trim((string) $path, '/');

// Health reports its own state, including configuration problems, as 503.
if ($path === 'health' && $method === 'GET') {
    aapm_health_response();
}

// Configuration is validated before the session, security headers, or any
// database work. A missing or invalid environment fails closed.
try {
    aapm_assert_runtime_identity(app_config());
} catch (AppConfigException $exception) {
    error_log('[aapm-native-api] configuration unavailable: ' . $exception->safeCode());
    error_response('Konfigurasi server belum siap.', 503, 'configuration_unavailable');
}

apply_security_headers();
start_app_session();

try {
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
                $insert = db()->prepare('INSERT INTO users (email, password_hash, full_name, role, email_verified_at, auth_version) VALUES (?, ?, ?, ?, ?, 1)');
                $insert->execute([$email, app_password_hash(bin2hex(random_bytes(32))), $fullName, 'user', aapm_utc_now()]);
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
        // Google verified this address, so it is trusted evidence for the account.
        $verifyStatement = db()->prepare('UPDATE users SET email_verified_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND email_verified_at IS NULL');
        $verifyStatement->execute([aapm_utc_now(), $userId]);
        if ($verifyStatement->rowCount() === 1) {
            aapm_audit('auth.email_verified', 'ok', $userId, $userId, ['channel' => 'google']);
        }
        $sessionRow = db()->prepare('SELECT id, auth_version FROM users WHERE id = ? LIMIT 1');
        $sessionRow->execute([$userId]);
        aapm_establish_session($sessionRow->fetch() ?: ['id' => $userId, 'auth_version' => 1]);
        aapm_audit('auth.login_success', 'ok', $userId, $userId, ['source' => 'google']);
        redirect_response($baseUrl . $returnTo);
    }

    if ($path === 'auth/me' && $method === 'GET') {
        // Same guard as every protected route, so revoked sessions get session_revoked.
        $user = require_user();
        json_response(['user' => $user, 'csrfToken' => csrf_token()]);
    }

    if ($path === 'auth/login' && $method === 'POST') {
        $input = request_json();
        $email = normalize_email($input['email'] ?? '');
        $password = (string) ($input['password'] ?? '');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
            error_response('Email dan kata sandi wajib diisi.', 422, 'validation_error');
        }
        require_csrf();
        rate_limit_guard('login-ip', '', 60, 900, 900);
        rate_limit_guard('login-user', $email, 8, 900, 900);

        $stmt = db()->prepare('SELECT id, email, password_hash, full_name, role, created_at, email_verified_at, verification_required_at, auth_version FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        if (!$user || !password_verify($password, $user['password_hash'])) {
            rate_limit_failure('login-ip', '', 60, 900, 900);
            rate_limit_failure('login-user', $email, 8, 900, 900);
            aapm_audit('auth.login_failure', 'invalid_credentials', null, $user ? (int) $user['id'] : null, ['identity' => aapm_identity_digest($email)]);
            error_response('Email atau kata sandi tidak sesuai.', 401, 'invalid_credentials');
        }

        rate_limit_clear('login-ip');
        rate_limit_clear('login-user', $email);
        if (password_needs_rehash($user['password_hash'], password_algorithm())) {
            db()->prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([app_password_hash($password), (int) $user['id']]);
        }

        // A new account gets no application session until its email is verified.
        if (aapm_verification_status($user) === 'pending') {
            aapm_audit('auth.login_failure', 'verification_required', null, (int) $user['id'], ['identity' => aapm_identity_digest($email)]);
            error_response('Verifikasi email Anda terlebih dahulu. Periksa kotak masuk email Anda.', 403, 'email_verification_required');
        }

        aapm_establish_session($user);
        aapm_audit('auth.login_success', 'ok', (int) $user['id'], (int) $user['id'], ['source' => 'password']);
        json_response(['user' => current_user() ?? present_authenticated_user($user), 'csrfToken' => csrf_token()]);
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

        // Existing and new addresses get the same acknowledgment. Only a new
        // address creates a pending account, and it never receives a session.
        $existing = db()->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $existing->execute([$email]);
        $devPayload = [];
        if (!$existing->fetch()) {
            $pdo = db();
            $userId = 0;
            $token = null;
            aapm_tx_begin($pdo);
            try {
                $insert = $pdo->prepare('INSERT INTO users (email, password_hash, full_name, role, verification_required_at, auth_version) VALUES (?, ?, ?, ?, ?, 1)');
                $insert->execute([$email, app_password_hash($password), $fullName, 'user', aapm_utc_now()]);
                $userId = (int) $pdo->lastInsertId();
                $token = aapm_issue_verification_token($pdo, $userId);
                aapm_tx_commit($pdo);
            } catch (PDOException $exception) {
                aapm_tx_rollback($pdo);
                if (strpos(strtolower($exception->getMessage()), 'unique') === false && strpos(strtolower($exception->getMessage()), 'duplicate') === false) {
                    throw $exception;
                }
                $token = null;
            }
            if ($token !== null) {
                rate_limit_clear('register-ip');
                aapm_audit('auth.verification_sent', aapm_send_verification_email($email, $token) ? 'sent' : 'delivery_failed', null, $userId, ['channel' => 'email']);
                $devPayload = aapm_dev_token_payload($token);
            }
        }
        json_response(array_merge(['message' => 'Jika alamat email dapat digunakan, instruksi verifikasi akan dikirim.', 'status' => 'accepted'], $devPayload), 202);
    }

    if ($path === 'auth/resend-verification' && $method === 'POST') {
        $input = request_json();
        require_csrf();
        rate_limit_guard('resend-ip', '', 20, 3600, 3600);
        $signedIn = current_user();
        if ($signedIn && ($signedIn['emailVerificationStatus'] ?? '') === 'legacy_pending') {
            rate_limit_guard('resend-user', (string) $signedIn['id'], 3, 3600, 3600);
            $fresh = aapm_send_fresh_verification((int) $signedIn['id'], (string) $signedIn['email'], 'auth.verification_resend');
            json_response(array_merge(['message' => 'Jika akun ini belum terverifikasi, instruksi verifikasi baru telah dikirim.', 'status' => 'accepted'], aapm_dev_token_payload($fresh['token'])), 202);
        }

        // A pending registrant proves knowledge of the password, without a session.
        $email = normalize_email($input['email'] ?? '');
        $password = (string) ($input['password'] ?? '');
        $devPayload = [];
        if (filter_var($email, FILTER_VALIDATE_EMAIL) && $password !== '') {
            rate_limit_guard('resend-user', $email, 3, 3600, 3600);
            $stmt = db()->prepare('SELECT id, email, password_hash, email_verified_at, verification_required_at FROM users WHERE email = ? LIMIT 1');
            $stmt->execute([$email]);
            $account = $stmt->fetch();
            rate_limit_failure('resend-user', $email, 3, 3600, 3600);
            if ($account && password_verify($password, $account['password_hash']) && aapm_verification_status($account) === 'pending') {
                $fresh = aapm_send_fresh_verification((int) $account['id'], (string) $account['email'], 'auth.verification_resend');
                $devPayload = aapm_dev_token_payload($fresh['token']);
            }
        }
        json_response(array_merge(['message' => 'Jika akun tersebut menunggu verifikasi, instruksi baru akan dikirim.', 'status' => 'accepted'], $devPayload), 202);
    }

    if ($path === 'auth/verify-email' && $method === 'POST') {
        $input = request_json();
        $token = trim((string) ($input['token'] ?? ''));
        require_csrf();
        rate_limit_guard('verify-ip', '', 30, 900, 900);
        $userId = aapm_consume_verification_token($token);
        if ($userId === null) {
            rate_limit_failure('verify-ip', '', 30, 900, 900);
            error_response('Tautan verifikasi tidak valid atau sudah kedaluwarsa.', 400, 'invalid_verification_token');
        }
        rate_limit_clear('verify-ip');
        $row = db()->prepare('SELECT id, email, full_name, role, created_at, email_verified_at, verification_required_at, auth_version FROM users WHERE id = ? LIMIT 1');
        $row->execute([$userId]);
        $account = $row->fetch();
        aapm_establish_session($account);
        aapm_audit('auth.email_verified', 'ok', $userId, $userId, ['channel' => 'email']);
        json_response(['user' => present_authenticated_user($account), 'csrfToken' => csrf_token()]);
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
        $result = ['message' => 'Jika akun tersebut ada, instruksi reset kata sandi telah dibuat.'];
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
                if (app_config()['environment'] === 'local' && app_config()['expose_dev_reset_token']) {
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
            error_response('Tautan reset kata sandi sudah tidak berlaku.', 400, 'invalid_reset_token');
        }
        $resetPdo = db();
        aapm_tx_begin($resetPdo);
        try {
            $resetNow = aapm_utc_now();
            $resetPdo->prepare('UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_token_expires_at = NULL, email_verified_at = COALESCE(email_verified_at, ?), auth_version = auth_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                ->execute([app_password_hash($password), $resetNow, (int) $user['id']]);
            $resetPdo->prepare('UPDATE email_verification_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL')
                ->execute([$resetNow, (int) $user['id']]);
            aapm_audit('auth.password_reset', 'ok', (int) $user['id'], (int) $user['id'], ['channel' => 'email']);
            aapm_tx_commit($resetPdo);
        } catch (Throwable $exception) {
            aapm_tx_rollback($resetPdo);
            throw $exception;
        }
        rate_limit_clear('reset-ip');
        unset($_SESSION['user_id']);
        session_regenerate_id(true);
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        json_response(['ok' => true]);
    }

    if ($path === 'profile' && $method === 'GET') {
        json_response(profile_data(require_user()));
    }

    if ($path === 'profile' && $method === 'PUT') {
        $user = require_user();
        require_csrf();
        json_response(update_profile_data($user, request_json()));
    }

    if ($path === 'hall-of-fame' && $method === 'GET') {
        require_user();
        json_response(hall_of_fame_data());
    }

    if ($path === 'ai-settings' && $method === 'GET') {
        $user = require_user();
        json_response(ai_user_ai_public_settings((int) $user['id']));
    }

    if ($path === 'ai-settings' && $method === 'PUT') {
        $user = require_user();
        require_csrf();
        json_response(ai_user_ai_save((int) $user['id'], request_json()));
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

    if ($path === 'admin/security-audit' && $method === 'GET') {
        require_admin();
        json_response(aapm_security_audit_page((int) ($_GET['limit'] ?? 50), (int) ($_GET['offset'] ?? 0)));
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

    if ($path === 'admin/users' && $method === 'GET') {
        require_admin();
        json_response(['users' => admin_user_list((string) ($_GET['search'] ?? ''))]);
    }

    if ($path === 'admin/users' && $method === 'POST') {
        $actor = require_admin();
        require_csrf();
        json_response(['user' => admin_create_user($actor, request_json())], 201);
    }

    if (preg_match('#^admin/users/(\\d+)$#', $path, $matches) && $method === 'PUT') {
        $actor = require_admin();
        require_csrf();
        json_response(['user' => admin_update_user($actor, (int) $matches[1], request_json())]);
    }

    if (preg_match('#^admin/users/(\\d+)/password$#', $path, $matches) && $method === 'PUT') {
        $actor = require_admin();
        require_csrf();
        $input = request_json();
        admin_reset_user_password($actor, (int) $matches[1], (string) ($input['password'] ?? ''));
        json_response(['ok' => true]);
    }

    if (preg_match('#^admin/users/(\\d+)/progress$#', $path, $matches) && $method === 'DELETE') {
        require_admin();
        require_csrf();
        json_response(['reset' => admin_reset_user_progress((int) $matches[1])]);
    }

    if ($path === 'admin/media/images' && $method === 'POST') {
        $actor = require_admin();
        require_csrf();
        $identity = 'editorial-media-' . (int) ($actor['id'] ?? 0);
        rate_limit_guard('editorial_upload', $identity, 100, 900, 900);
        rate_limit_failure('editorial_upload', $identity, 100, 900, 900);
        json_response(['media' => admin_upload_editorial_image()], 201);
    }

    if ($path === 'admin/media/presentations' && $method === 'POST') {
        $actor = require_admin();
        require_csrf();
        $identity = 'editorial-media-' . (int) ($actor['id'] ?? 0);
        rate_limit_guard('editorial_upload', $identity, 100, 900, 900);
        rate_limit_failure('editorial_upload', $identity, 100, 900, 900);
        json_response(['presentation' => admin_upload_editorial_presentation()], 201);
    }

    if ($path === 'admin/modules' && $method === 'POST') {
        require_admin();
        require_csrf();
        json_response(['module' => admin_create_module(request_json())], 201);
    }

    if ($path === 'admin/modules/reorder' && $method === 'PUT') {
        require_admin();
        require_csrf();
        $input = request_json();
        json_response(['course' => admin_reorder_modules($input['items'] ?? [])]);
    }

    if (preg_match('#^admin/chapters/(\\d+)$#', $path, $matches) && $method === 'PUT') {
        require_admin();
        require_csrf();
        $input = request_json();
        json_response(['course' => admin_rename_chapter((int) $matches[1], (string) ($input['levelName'] ?? ''))]);
    }

    if (preg_match('#^admin/modules/(\\d+)$#', $path, $matches) && $method === 'GET') {
        require_admin();
        $module = admin_module_from_id((int) $matches[1]);
        if (!$module) {
            error_response('Modul tidak ditemukan.', 404, 'not_found');
        }
        json_response(['module' => present_module($module)]);
    }

    if (preg_match('#^admin/modules/(\\d+)$#', $path, $matches) && $method === 'PUT') {
        require_admin();
        require_csrf();
        json_response(['module' => admin_update_module((int) $matches[1], request_json())]);
    }

    if (preg_match('#^admin/modules/(\\d+)$#', $path, $matches) && $method === 'DELETE') {
        require_admin();
        require_csrf();
        $purgeProgress = bool_value($_GET['purgeProgress'] ?? false) === 1;
        json_response(['ok' => true, 'deleted' => admin_delete_module((int) $matches[1], $purgeProgress)]);
    }

    if (preg_match('#^admin/modules/(\\d+)/questions$#', $path, $matches) && $method === 'GET') {
        require_admin();
        json_response(['questions' => admin_module_questions((int) $matches[1])]);
    }

    if (preg_match('#^admin/modules/(\\d+)/questions$#', $path, $matches) && $method === 'POST') {
        require_admin();
        require_csrf();
        json_response(['question' => admin_create_question((int) $matches[1], request_json())], 201);
    }

    if (preg_match('#^admin/modules/(\\d+)/questions/(\\d+)$#', $path, $matches) && $method === 'PUT') {
        require_admin();
        require_csrf();
        json_response(['question' => admin_update_question((int) $matches[1], (int) $matches[2], request_json())]);
    }

    if (preg_match('#^admin/modules/(\\d+)/questions/(\\d+)$#', $path, $matches) && $method === 'DELETE') {
        require_admin();
        require_csrf();
        admin_delete_question((int) $matches[1], (int) $matches[2]);
        json_response(['ok' => true]);
    }

    if ($path === 'admin/ai-settings' && $method === 'GET') {
        require_admin();
        json_response(ai_registry_admin_status());
    }

    if ($path === 'admin/ai-settings' && $method === 'PUT') {
        require_admin();
        require_csrf();
        json_response(ai_save_settings(request_json()));
    }

    if ($path === 'admin/ai-settings/test' && $method === 'POST') {
        require_admin();
        require_csrf();
        json_response(ai_registry_test_connection(request_json()));
    }

    if ($path === 'admin/ai-settings/models' && $method === 'POST') {
        require_admin();
        require_csrf();
        json_response(ai_registry_discover_models(request_json()));
    }

    if ($path === 'admin/ai/rewrite-editorial' && $method === 'POST') {
        $user = require_admin();
        require_csrf();
        $input = request_json();
        $message = trim((string) ($input['message'] ?? ''));
        if ($message === '') {
            error_response('Materi yang akan ditulis ulang wajib diisi.', 422, 'validation_error');
        }
        // Editorial rewrites carry a bounded, structured Markdown payload. The
        // public chat endpoint remains capped at 3,000 characters, while this
        // admin-only route has enough room for several authored blocks. The
        // response cap is raised separately so a valid JSON payload is not
        // cut off halfway through a long material rewrite.
        if (strlen($message) > 24000) {
            error_response('Materi terlalu panjang untuk satu rewrite. Pilih blok materi yang lebih sedikit.', 422, 'validation_error');
        }
        rate_limit_guard('ai-admin-rewrite', (string) $user['id'], 20, 300, 300);
        $response = ai_assistant_reply($message, [], false, [], 6000, 24000);
        rate_limit_failure('ai-admin-rewrite', (string) $user['id'], 20, 300, 300);
        json_response($response);
    }

    if ($path === 'admin/ai/module-companion' && $method === 'POST') {
        $user = require_admin();
        require_csrf();
        $input = request_json();
        $action = trim((string) ($input['action'] ?? 'chat'));
        $message = trim((string) ($input['message'] ?? ''));
        if (strlen($message) > 4000) {
            error_response('Instruksi APPI maksimal 4.000 karakter.', 422, 'validation_error');
        }
        $module = is_array($input['module'] ?? null) ? $input['module'] : [];
        $modules = is_array($input['modules'] ?? null) ? $input['modules'] : [];
        $contextSize = strlen((string) json_encode([$module, $modules], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE));
        if ($contextSize > 52000) {
            error_response('Konteks kurikulum terlalu besar untuk satu saran. Pilih modul atau chapter yang lebih kecil.', 422, 'context_too_large');
        }
        rate_limit_guard('ai-admin-module-companion', (string) $user['id'], 30, 300, 300);
        $response = ai_admin_companion_reply($action, $message, $module, $modules);
        rate_limit_failure('ai-admin-module-companion', (string) $user['id'], 30, 300, 300);
        json_response($response);
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
        // Module 0 is reserved for the final exam. All other progress rows
        // must still point to a live catalog module so deleted modules cannot
        // keep showing up in the learner view.
        $stmt = db()->prepare('SELECT p.* FROM user_progress p LEFT JOIN course_modules m ON m.module_number = p.module_number WHERE p.user_id = ? AND (p.module_number = 0 OR m.id IS NOT NULL) ORDER BY p.module_number ASC');
        $stmt->execute([(int) $user['id']]);
        json_response(array_map('present_progress', $stmt->fetchAll()));
    }

    if ($path === 'progress' && ($method === 'POST' || $method === 'PUT')) {
        $user = require_user();
        require_csrf();
        $input = request_json();
        $moduleNumber = (int) ($input['moduleNumber'] ?? 0);
        if ($moduleNumber < 0 || ($moduleNumber !== 0 && !admin_module_number_exists($moduleNumber))) {
            error_response('Nomor modul tidak valid.', 422, 'validation_error');
        }

        $existing = db()->prepare('SELECT * FROM user_progress WHERE user_id = ? AND module_number = ? LIMIT 1');
        $existing->execute([(int) $user['id'], $moduleNumber]);
        $row = $existing->fetch();

        // Partial update: a field the client did not send keeps its stored
        // value, so "mark complete" no longer clears a quiz score and a quiz
        // submit no longer clears a finished practice. timeSpentDeltaMinutes
        // adds study time (one save counts at most 4 hours).
        $values = [
            'completed' => array_key_exists('completed', $input) ? bool_value($input['completed']) : (int) ($row['completed'] ?? 0),
            'quiz_score' => array_key_exists('quizScore', $input)
                ? ($input['quizScore'] !== null ? (int) $input['quizScore'] : null)
                : ($row && $row['quiz_score'] !== null ? (int) $row['quiz_score'] : null),
            'quiz_total' => array_key_exists('quizTotal', $input)
                ? ($input['quizTotal'] !== null ? (int) $input['quizTotal'] : null)
                : ($row && $row['quiz_total'] !== null ? (int) $row['quiz_total'] : null),
            'practical_done' => array_key_exists('practicalDone', $input) ? bool_value($input['practicalDone']) : (int) ($row['practical_done'] ?? 0),
            'time_spent_minutes' => array_key_exists('timeSpentMinutes', $input)
                ? ($input['timeSpentMinutes'] !== null ? max(0, (int) $input['timeSpentMinutes']) : null)
                : ($row && $row['time_spent_minutes'] !== null ? (int) $row['time_spent_minutes'] : null),
        ];
        if (array_key_exists('timeSpentDeltaMinutes', $input)) {
            $delta = min(240, max(0, (int) $input['timeSpentDeltaMinutes']));
            $values['time_spent_minutes'] = (int) ($values['time_spent_minutes'] ?? 0) + $delta;
        }
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

    if ($path === 'ai/conversations' && $method === 'GET') {
        $user = require_user();
        $paged = (string) ($_GET['format'] ?? '') === 'paged';
        $limit = max(10, min(80, (int) ($_GET['limit'] ?? 40)));
        $cursor = ai_conversation_cursor_decode((string) ($_GET['cursor'] ?? ''));
        $where = 'WHERE user_id = ?';
        $params = [(int) $user['id']];
        if ($cursor !== null) {
            $where .= ' AND (updated_at < ? OR (updated_at = ? AND id < ?))';
            $params[] = $cursor['updatedAt'];
            $params[] = $cursor['updatedAt'];
            $params[] = $cursor['id'];
        }

        $stmt = db()->prepare('SELECT id, title, last_message_preview, message_count, created_at, updated_at, archived_at FROM ai_conversations ' . $where . ' ORDER BY updated_at DESC, id DESC LIMIT ' . ($limit + 1));
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        $hasMore = count($rows) > $limit;
        if ($hasMore) {
            array_pop($rows);
        }
        $items = array_map('present_ai_conversation', $rows);

        // Keep the original array response for an already-deployed frontend.
        // The paged contract lets current clients keep the complete account
        // history reachable without loading every conversation at once.
        if (!$paged) {
            json_response($items);
        }

        $totalStmt = db()->prepare('SELECT COUNT(*) FROM ai_conversations WHERE user_id = ?');
        $totalStmt->execute([(int) $user['id']]);
        $activeTotalStmt = db()->prepare('SELECT COUNT(*) FROM ai_conversations WHERE user_id = ? AND archived_at IS NULL');
        $activeTotalStmt->execute([(int) $user['id']]);
        $archivedTotalStmt = db()->prepare('SELECT COUNT(*) FROM ai_conversations WHERE user_id = ? AND archived_at IS NOT NULL');
        $archivedTotalStmt->execute([(int) $user['id']]);
        $lastRow = $rows ? $rows[count($rows) - 1] : null;
        json_response([
            'items' => $items,
            'total' => (int) $totalStmt->fetchColumn(),
            'activeTotal' => (int) $activeTotalStmt->fetchColumn(),
            'archivedTotal' => (int) $archivedTotalStmt->fetchColumn(),
            'nextCursor' => $hasMore && is_array($lastRow) ? ai_conversation_cursor_encode($lastRow) : null,
        ]);
    }

    if ($path === 'ai/activity' && $method === 'GET') {
        $user = require_user();
        $stmt = db()->prepare('SELECT id, conversation_id, event_type, label, detail, created_at FROM ai_activity_log WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 80');
        $stmt->execute([(int) $user['id']]);
        json_response(array_map('present_ai_activity', $stmt->fetchAll()));
    }

    if ($path === 'ai/conversations' && $method === 'POST') {
        $user = require_user();
        require_csrf();
        $input = request_json();
        $title = ai_conversation_title((string) ($input['title'] ?? ''));
        $insert = db()->prepare('INSERT INTO ai_conversations (user_id, title) VALUES (?, ?)');
        $insert->execute([(int) $user['id'], $title]);
        $id = (int) db()->lastInsertId();
        $stmt = db()->prepare('SELECT id, title, last_message_preview, message_count, created_at, updated_at, archived_at FROM ai_conversations WHERE id = ? AND user_id = ? LIMIT 1');
        $stmt->execute([$id, (int) $user['id']]);
        json_response(present_ai_conversation($stmt->fetch()), 201);
    }

    if (preg_match('#^ai/conversations/(\d+)$#', $path, $matches) && $method === 'PATCH') {
        $user = require_user();
        require_csrf();
        $conversation = ai_conversation_for_user((int) $matches[1], (int) $user['id']);
        if (!$conversation) {
            error_response('Percakapan tidak ditemukan.', 404, 'not_found');
        }
        $input = request_json();
        $hasTitle = array_key_exists('title', $input);
        $hasArchived = array_key_exists('archived', $input);
        if (!$hasTitle && !$hasArchived) {
            error_response('Judul atau status arsip percakapan wajib diisi.', 422, 'validation_error');
        }
        $sets = [];
        $params = [];
        if ($hasTitle) {
            $sets[] = 'title = ?';
            $params[] = ai_conversation_title((string) $input['title']);
        }
        if ($hasArchived) {
            $sets[] = 'archived_at = ' . (bool_value($input['archived']) === 1 ? 'CURRENT_TIMESTAMP' : 'NULL');
        }
        $sets[] = 'updated_at = CURRENT_TIMESTAMP';
        $params[] = (int) $conversation['id'];
        $params[] = (int) $user['id'];
        $update = db()->prepare('UPDATE ai_conversations SET ' . implode(', ', $sets) . ' WHERE id = ? AND user_id = ?');
        $update->execute($params);
        $updated = ai_conversation_for_user((int) $conversation['id'], (int) $user['id']);
        if ($hasArchived && $updated) {
            $archived = bool_value($input['archived']) === 1;
            ai_record_activity(
                (int) $user['id'],
                (int) $conversation['id'],
                $archived ? 'archive' : 'unarchive',
                $archived ? 'Percakapan diarsipkan' : 'Percakapan dipulihkan',
                ai_conversation_preview((string) ($updated['title'] ?? $conversation['title']))
            );
        }
        json_response(present_ai_conversation($updated ?: $conversation));
    }

    if (preg_match('#^ai/conversations/(\d+)/stream$#', $path, $matches) && $method === 'POST') {
        $user = require_user();
        require_csrf();
        $conversation = ai_conversation_for_user((int) $matches[1], (int) $user['id']);
        if (!$conversation) {
            error_response('Percakapan tidak ditemukan.', 404, 'not_found');
        }
        $input = request_json();
        $message = trim((string) ($input['message'] ?? ''));
        if ($message === '') {
            error_response('Pertanyaan wajib diisi.', 422, 'validation_error');
        }
        if (strlen($message) > 3000) {
            error_response('Pertanyaan terlalu panjang. Batasi hingga 3.000 karakter.', 422, 'validation_error');
        }
        rate_limit_guard('ai-user', (string) $user['id'], 30, 300, 300);
        $includeFarmContext = bool_value($input['includeFarmContext'] ?? (is_array($input['farmContext'] ?? null) ? 1 : 0)) === 1;
        $farmContext = $includeFarmContext ? ai_context_for_user((int) $user['id']) : [];
        $allowWebSearch = bool_value($input['allowWebSearch'] ?? false) === 1;
        $imageDataUrl = ai_normalize_image_data_url($input['imageDataUrl'] ?? null);
        $pageContext = trim((string) ($input['pageContext'] ?? ''));
        $accountMemory = ai_account_memory_for_user((int) $user['id']);
        $accountContext = ai_account_context_for_user((int) $user['id']);
        // Phase 1 is deliberately short and atomic. The user turn, activity
        // entry, and conversation metadata must either all exist or none of
        // them should be visible to the history API before the provider runs.
        $phaseOneDatabase = db();
        try {
            $phaseOneDatabase->beginTransaction();
            ai_record_chat_message((int) $conversation['id'], 'user', $message);
            ai_record_activity(
                (int) $user['id'],
                (int) $conversation['id'],
                'question',
                $imageDataUrl !== null ? 'Pertanyaan dengan foto dikirim' : 'Pertanyaan dikirim',
                ai_conversation_preview($message)
            );
            ai_touch_conversation((int) $conversation['id'], (string) $conversation['title'], $message, (int) $conversation['message_count'] === 0);
            $phaseOneDatabase->commit();
        } catch (Throwable $exception) {
            if ($phaseOneDatabase->inTransaction()) {
                $phaseOneDatabase->rollBack();
            }
            error_log('[aapm-ai-phase1] ' . $exception->getMessage());
            error_response('Pertanyaan belum dapat disimpan ke riwayat akun. Coba lagi.', 503, 'persistence_error');
        }
        ai_sse_start();
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }
        // Continue persisting after a user closes the panel or moves from the
        // bubble to the workspace. The browser may stop reading SSE, but the
        // account history must remain durable.
        @ignore_user_abort(true);
        try {
            $response = ai_assistant_stream($message, $farmContext, $allowWebSearch, $imageDataUrl, $pageContext, $accountMemory, $accountContext);
        } catch (Throwable $exception) {
            error_log('[aapm-ai-stream] ' . $exception->getMessage());
            $response = [
                'reply' => native_ai_reply($message, $farmContext),
                'provider' => 'local',
                'model' => null,
                'fallback' => true,
                'notice' => 'Provider AI terputus pada permintaan ini. Respons lokal tetap disimpan di riwayat akun.',
            ];
            ai_sse_emit('notice', ['text' => $response['notice']]);
            ai_sse_emit('delta', ['text' => $response['reply']]);
        }
        ai_sse_emit('status', ['label' => 'APPI menyimpan percakapan']);
        $savedConversation = null;
        try {
            $database = db();
            $database->beginTransaction();
            ai_record_chat_message((int) $conversation['id'], 'assistant', (string) $response['reply'], $response['provider'], $response['model'], (bool) $response['fallback']);
            ai_record_activity(
                (int) $user['id'],
                (int) $conversation['id'],
                (bool) $response['fallback'] ? 'fallback' : 'response',
                (bool) $response['fallback'] ? 'Respons lokal disimpan' : 'Jawaban APPI selesai',
                trim((string) ($response['provider'] ?? '')) . (trim((string) ($response['model'] ?? '')) !== '' ? ' · ' . trim((string) $response['model']) : '')
            );
            ai_touch_conversation((int) $conversation['id'], ai_conversation_title($message), (string) $response['reply'], false);
            $database->commit();
            $savedConversation = ai_conversation_for_user((int) $conversation['id'], (int) $user['id']);
        } catch (Throwable $exception) {
            if (isset($database) && $database instanceof PDO && $database->inTransaction()) {
                $database->rollBack();
            }
            error_log('[aapm-ai-history] ' . $exception->getMessage());
            ai_sse_emit('persistence_error', [
                'message' => 'Jawaban APPI belum dapat disimpan ke riwayat akun. Coba kirim ulang atau muat ulang riwayat.',
            ]);
            ai_sse_emit('done', [
                'provider' => $response['provider'],
                'model' => $response['model'],
                'fallback' => (bool) $response['fallback'],
                'persisted' => false,
                'conversation' => null,
            ]);
            rate_limit_failure('ai-user', (string) $user['id'], 30, 300, 300);
            exit;
        }
        ai_sse_emit('persisted', [
            'conversation' => $savedConversation ? present_ai_conversation($savedConversation) : null,
        ]);
        ai_sse_emit('done', [
            'provider' => $response['provider'],
            'model' => $response['model'],
            'fallback' => (bool) $response['fallback'],
            'persisted' => true,
            'conversation' => $savedConversation ? present_ai_conversation($savedConversation) : null,
        ]);
        rate_limit_failure('ai-user', (string) $user['id'], 30, 300, 300);
        exit;
    }

    if (preg_match('#^ai/conversations/(\d+)/messages$#', $path, $matches) && $method === 'POST') {
        $user = require_user();
        require_csrf();
        $conversation = ai_conversation_for_user((int) $matches[1], (int) $user['id']);
        if (!$conversation) {
            error_response('Percakapan tidak ditemukan.', 404, 'not_found');
        }
        $input = request_json();
        $content = trim((string) ($input['content'] ?? ''));
        if ($content === '') {
            error_response('Jawaban yang akan disimpan wajib diisi.', 422, 'validation_error');
        }
        if (strlen($content) > 24000) {
            error_response('Jawaban terlalu panjang untuk disimpan.', 422, 'validation_error');
        }
        $provider = profile_text($input['provider'] ?? '', 80);
        $model = profile_text($input['model'] ?? '', 180);
        $fallback = bool_value($input['fallback'] ?? false) === 1;
        $database = db();
        try {
            $database->beginTransaction();
            $latestStmt = $database->prepare('SELECT role, content FROM ai_chat_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1');
            $latestStmt->execute([(int) $conversation['id']]);
            $latest = $latestStmt->fetch();
            // A retry may be submitted twice after a slow network response;
            // do not create duplicate assistant messages for the same visible
            // answer.
            if (!(($latest['role'] ?? '') === 'assistant' && (string) ($latest['content'] ?? '') === $content)) {
                ai_record_chat_message(
                    (int) $conversation['id'],
                    'assistant',
                    $content,
                    $provider !== '' ? $provider : null,
                    $model !== '' ? $model : null,
                    $fallback
                );
                ai_record_activity(
                    (int) $user['id'],
                    (int) $conversation['id'],
                    $fallback ? 'fallback' : 'response',
                    $fallback ? 'Respons lokal disimpan' : 'Jawaban APPI selesai',
                    trim($provider . ($model !== '' ? ' · ' . $model : ''))
                );
            }
            ai_touch_conversation((int) $conversation['id'], (string) $conversation['title'], $content, false);
            $database->commit();
        } catch (Throwable $exception) {
            if ($database->inTransaction()) {
                $database->rollBack();
            }
            error_log('[aapm-ai-retry] ' . $exception->getMessage());
            error_response('Jawaban APPI belum dapat disimpan. Coba lagi.', 503, 'persistence_error');
        }
        $savedConversation = ai_conversation_for_user((int) $conversation['id'], (int) $user['id']);
        json_response([
            'persisted' => true,
            'conversation' => $savedConversation ? present_ai_conversation($savedConversation) : null,
        ]);
    }

    if (preg_match('#^ai/conversations/(\d+)$#', $path, $matches) && $method === 'GET') {
        $user = require_user();
        $conversation = ai_conversation_for_user((int) $matches[1], (int) $user['id']);
        if (!$conversation) {
            error_response('Percakapan tidak ditemukan.', 404, 'not_found');
        }
        // Bound the payload to the latest turns, then restore reading order. Taking
        // the first 240 erased newly streamed answers when long chats reconciled.
        $messageStmt = db()->prepare('SELECT id, role, content, provider, model, used_fallback, created_at FROM (SELECT id, role, content, provider, model, used_fallback, created_at FROM ai_chat_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 240) AS recent_messages ORDER BY id ASC');
        $messageStmt->execute([(int) $conversation['id']]);
        json_response(['conversation' => present_ai_conversation($conversation), 'messages' => array_map('present_ai_chat_message', $messageStmt->fetchAll())]);
    }

    if (preg_match('#^ai/conversations/(\d+)$#', $path, $matches) && $method === 'DELETE') {
        $user = require_user();
        require_csrf();
        $delete = db()->prepare('DELETE FROM ai_conversations WHERE id = ? AND user_id = ?');
        $delete->execute([(int) $matches[1], (int) $user['id']]);
        if ($delete->rowCount() < 1) {
            error_response('Percakapan tidak ditemukan.', 404, 'not_found');
        }
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
        $includeFarmContext = bool_value($input['includeFarmContext'] ?? (is_array($input['farmContext'] ?? null) ? 1 : 0)) === 1;
        $farmContext = $includeFarmContext ? ai_context_for_user((int) $user['id']) : [];
        $allowWebSearch = bool_value($input['allowWebSearch'] ?? false) === 1;
        $imageDataUrl = ai_normalize_image_data_url($input['imageDataUrl'] ?? null);
        $accountContext = ai_account_context_for_user((int) $user['id']);
        ai_sse_start();
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }
        $response = ai_assistant_stream($message, $farmContext, $allowWebSearch, $imageDataUrl, '', '', $accountContext);
        ai_sse_emit('done', [
            'provider' => $response['provider'],
            'model' => $response['model'],
            'fallback' => (bool) $response['fallback'],
        ]);
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
        $includeFarmContext = bool_value($input['includeFarmContext'] ?? (is_array($input['farmContext'] ?? null) ? 1 : 0)) === 1;
        $farmContext = $includeFarmContext ? ai_context_for_user((int) $user['id']) : [];
        $allowWebSearch = bool_value($input['allowWebSearch'] ?? false) === 1;
        $accountContext = ai_account_context_for_user((int) $user['id']);
        $response = ai_assistant_reply($message, $farmContext, $allowWebSearch, $accountContext);
        rate_limit_failure('ai-user', (string) $user['id'], 30, 300, 300);
        json_response($response);
    }

    error_response('Endpoint tidak ditemukan.', 404, 'not_found');
} catch (AiConfigurationException $exception) {
    error_response($exception->getMessage(), 503, 'ai_configuration_missing');
} catch (AppConfigException $exception) {
    error_log('[aapm-native-api] configuration unavailable: ' . $exception->safeCode());
    error_response('Konfigurasi server belum siap.', 503, 'configuration_unavailable');
} catch (Throwable $exception) {
    error_log('[aapm-native-api] ' . $exception->getMessage());
    error_response('Terjadi kesalahan pada server.', 500, 'server_error');
}

function ai_conversation_title(string $value): string
{
    $value = trim((string) preg_replace('/\s+/u', ' ', $value));
    if ($value === '') {
        return 'Percakapan baru';
    }
    $value = function_exists('mb_substr') ? mb_substr($value, 0, 180, 'UTF-8') : substr($value, 0, 180);
    return $value;
}

function ai_conversation_preview(string $value): string
{
    $value = trim((string) preg_replace('/\s+/u', ' ', $value));
    $value = function_exists('mb_substr') ? mb_substr($value, 0, 280, 'UTF-8') : substr($value, 0, 280);
    return $value;
}

function ai_conversation_cursor_encode(array $row): string
{
    $payload = json_encode([
        'updatedAt' => (string) ($row['updated_at'] ?? ''),
        'id' => (int) ($row['id'] ?? 0),
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if (!is_string($payload)) {
        return '';
    }
    return rtrim(strtr(base64_encode($payload), '+/', '-_'), '=');
}

function ai_conversation_cursor_decode(string $cursor): ?array
{
    $cursor = trim($cursor);
    if ($cursor === '' || strlen($cursor) > 180) {
        return null;
    }
    $normalized = strtr($cursor, '-_', '+/');
    $normalized .= str_repeat('=', (4 - strlen($normalized) % 4) % 4);
    $decoded = base64_decode($normalized, true);
    $data = is_string($decoded) ? json_decode($decoded, true) : null;
    if (!is_array($data)) {
        return null;
    }
    $updatedAt = trim((string) ($data['updatedAt'] ?? ''));
    $id = (int) ($data['id'] ?? 0);
    if ($updatedAt === '' || $id < 1 || !preg_match('/\A\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}\z/', $updatedAt)) {
        return null;
    }
    return ['updatedAt' => $updatedAt, 'id' => $id];
}

function ai_conversation_for_user(int $conversationId, int $userId): ?array
{
    $stmt = db()->prepare('SELECT id, title, last_message_preview, message_count, created_at, updated_at, archived_at FROM ai_conversations WHERE id = ? AND user_id = ? LIMIT 1');
    $stmt->execute([$conversationId, $userId]);
    $conversation = $stmt->fetch();
    return $conversation ?: null;
}

function ai_account_memory_for_user(int $userId): string
{
    // Memory stays in the existing per-account chat store. We only construct a
    // compact, request-time view: recent continuity plus one user anchor per
    // month in a three-month window. Deleting a conversation removes it from memory.
    $recentStmt = db()->prepare('SELECT m.id, m.role, m.content, m.created_at FROM ai_chat_messages m INNER JOIN ai_conversations c ON c.id = m.conversation_id WHERE c.user_id = ? ORDER BY m.created_at DESC, m.id DESC LIMIT 6');
    $recentStmt->execute([$userId]);
    $rows = array_reverse($recentStmt->fetchAll());
    $seen = [];
    foreach ($rows as $row) {
        $seen[(int) $row['id']] = true;
    }

    $monthStart = new DateTimeImmutable('first day of this month 00:00:00');
    $anchorStmt = db()->prepare('SELECT m.id, m.role, m.content, m.created_at FROM ai_chat_messages m INNER JOIN ai_conversations c ON c.id = m.conversation_id WHERE c.user_id = ? AND m.role = ? AND m.created_at >= ? AND m.created_at < ? ORDER BY m.created_at DESC, m.id DESC LIMIT 1');
    for ($offset = 3; $offset >= 0; $offset--) {
        $start = $monthStart->modify('-' . $offset . ' months');
        $end = $start->modify('+1 month');
        $anchorStmt->execute([$userId, 'user', $start->format('Y-m-d H:i:s'), $end->format('Y-m-d H:i:s')]);
        $anchor = $anchorStmt->fetch();
        if ($anchor && !isset($seen[(int) $anchor['id']])) {
            $rows[] = $anchor;
            $seen[(int) $anchor['id']] = true;
        }
    }

    usort($rows, static function (array $left, array $right): int {
        return strcmp((string) $left['created_at'], (string) $right['created_at']) ?: ((int) $left['id'] <=> (int) $right['id']);
    });
    $lines = [];
    foreach ($rows as $row) {
        $content = trim((string) ($row['content'] ?? ''));
        if ($content === '') continue;
        $excerpt = function_exists('mb_substr') ? mb_substr($content, 0, 180) : substr($content, 0, 180);
        $month = substr((string) ($row['created_at'] ?? ''), 0, 7);
        $lines[] = ($month !== '' ? '[' . $month . '] ' : '') . (($row['role'] ?? '') === 'assistant' ? 'APPI' : 'Pengguna') . ': ' . $excerpt;
    }
    return implode("\n", $lines);
}

function ai_record_chat_message(int $conversationId, string $role, string $content, ?string $provider = null, ?string $model = null, bool $fallback = false): void
{
    $insert = db()->prepare('INSERT INTO ai_chat_messages (conversation_id, role, content, provider, model, used_fallback) VALUES (?, ?, ?, ?, ?, ?)');
    $insert->execute([$conversationId, $role, $content, $provider, $model, $fallback ? 1 : 0]);
}

function ai_record_activity(int $userId, ?int $conversationId, string $type, string $label, string $detail = ''): void
{
    $insert = db()->prepare('INSERT INTO ai_activity_log (user_id, conversation_id, event_type, label, detail) VALUES (?, ?, ?, ?, ?)');
    $insert->execute([
        $userId,
        $conversationId,
        ai_conversation_preview($type),
        ai_conversation_preview($label),
        ai_conversation_preview($detail),
    ]);
}

function ai_touch_conversation(int $conversationId, string $title, string $preview, bool $setTitle): void
{
    $countStmt = db()->prepare('SELECT COUNT(*) FROM ai_chat_messages WHERE conversation_id = ?');
    $countStmt->execute([$conversationId]);
    $messageCount = (int) $countStmt->fetchColumn();
    $sql = $setTitle
        ? 'UPDATE ai_conversations SET title = ?, last_message_preview = ?, message_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        : 'UPDATE ai_conversations SET last_message_preview = ?, message_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    $stmt = db()->prepare($sql);
    $setTitle
        ? $stmt->execute([ai_conversation_title($title), ai_conversation_preview($preview), $messageCount, $conversationId])
        : $stmt->execute([ai_conversation_preview($preview), $messageCount, $conversationId]);
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
