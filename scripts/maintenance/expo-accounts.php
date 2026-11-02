<?php
declare(strict_types=1);

/**
 * Operator-only demo accounts for visitors at the Expo on 4 November 2026, and their removal.
 * CLI only.
 *
 * Fifteen fixed accounts in three groups, with the same handles and names as the AAPM Farm
 * Expo accounts, so one visitor card works in both products. Each account is created through
 * the Super Admin account path, so it receives the curriculum policy that is active now, and
 * is then brought to its group's state:
 *   baru  email awaiting verification, empty profile, no learning activity;
 *   siap  verified, profile filled in, no learning activity;
 *   data  verified, profile filled in, module quizzes passed through the real attempt
 *         functions, practice and study time, and 6 to 8 weeks of Farm KPI rows.
 * Certificates are never claimed: they are publicly verifiable credentials.
 *
 * The shared password comes from the environment variable AAPM_EXPO_DEMO_PASSWORD. It is never
 * printed, stored in plain form, or written to a log.
 *
 *   php scripts/maintenance/expo-accounts.php --expect-environment=staging --dry-run
 *   php scripts/maintenance/expo-accounts.php --expect-environment=staging --apply --operator=NAME --evidence-ref=REF
 *   php scripts/maintenance/expo-accounts.php --expect-environment=staging --verify
 *   php scripts/maintenance/expo-accounts.php --expect-environment=staging --apply --remove --operator=NAME --evidence-ref=REF
 *
 * A second --apply creates nothing twice: it reuses each account and restores its group's
 * state. --remove deletes only these fifteen accounts and what belongs to them.
 * Production also needs --confirm-production. Take a database backup first.
 * Exit codes: 0 success or dry-run, 1 failed, 2 usage error, 3 wrong target, 4 refused.
 */

if (PHP_SAPI !== 'cli' || isset($_SERVER['HTTP_HOST']) || isset($_SERVER['REQUEST_METHOD'])) {
    http_response_code(403);
    fwrite(STDERR, "Akun Expo hanya dapat diatur dari CLI operator.\n");
    exit(2);
}

// A stack trace must never carry the shared password as an argument.
ini_set('zend.exception_ignore_args', '1');

require __DIR__ . '/../../public/api/bootstrap.php';

const EXPO_DOMAIN = 'demo.aapm.co.id';
const EXPO_PASSWORD_ENV = 'AAPM_EXPO_DEMO_PASSWORD';
const EXPO_GROUP_LABELS = ['baru' => 'baru, belum setup', 'siap' => 'setup selesai', 'data' => 'berisi data'];
const EXPO_ACCOUNTS = [
    ['baru01', 'baru', 'Agus Santoso'],
    ['baru02', 'baru', 'Budi Hartono'],
    ['baru03', 'baru', 'Citra Lestari'],
    ['baru04', 'baru', 'Dewi Anggraini'],
    ['baru05', 'baru', 'Eko Prasetyo'],
    ['siap01', 'siap', 'Fajar Nugroho'],
    ['siap02', 'siap', 'Gita Permata'],
    ['siap03', 'siap', 'Hendra Wijaya'],
    ['siap04', 'siap', 'Indah Puspita'],
    ['siap05', 'siap', 'Joko Susilo'],
    ['data01', 'data', 'Kurniawan Saputra'],
    ['data02', 'data', 'Lina Marlina'],
    ['data03', 'data', 'Maya Sari'],
    ['data04', 'data', 'Nanda Pratama'],
    ['data05', 'data', 'Oki Setiawan'],
];
// The farm names and flock sizes match the AAPM Farm Expo accounts.
const EXPO_BIOS = [
    'siap01' => 'Pemilik Peternakan Sari Unggas. Baru memasukkan sekitar 3.600 ekor pullet ke tiga kandang dan ingin belajar mengelola awal masa produksi.',
    'siap02' => 'Mengelola Peternakan Lancar Jaya bersama keluarga, tiga kandang dengan sekitar 3.300 ekor. Ingin memahami pakan dan pencatatan produksi harian.',
    'siap03' => 'Pemilik Peternakan Mitra Tani dengan tiga kandang, sekitar 3.800 ekor. Fokus belajar biosekuriti dan jadwal vaksinasi.',
    'siap04' => 'Baru memulai Peternakan Karya Mandiri dengan sekitar 3.000 ekor. Ingin memahami persiapan pullet sampai puncak produksi.',
    'siap05' => 'Peternak di Peternakan Bumi Hijau, tiga kandang dengan sekitar 3.500 ekor. Tertarik menghitung biaya produksi per kilogram telur.',
    'data01' => 'Pemilik Peternakan Telur Nusantara, lima kandang dengan sekitar 7.000 ekor. Rutin mencatat HDP, pakan, dan mortalitas setiap minggu.',
    'data02' => 'Mengelola Peternakan Ayam Sejahtera, sekitar 7.200 ekor di lima kandang. Sedang menjaga produksi tetap stabil setelah masa puncak.',
    'data03' => 'Pemilik Peternakan Rejeki Barokah dengan sekitar 6.700 ekor. Belajar membaca tren KPI untuk menekan FCR.',
    'data04' => 'Mengelola Peternakan Cahaya Pagi, lima kandang dengan sekitar 7.600 ekor. Fokus menjaga produksi saat cuaca panas.',
    'data05' => 'Pemilik Peternakan Sentosa Abadi, sekitar 6.900 ekor di lima kandang. Sedang merapikan pencatatan biaya pakan dan penjualan telur.',
];
// Modules completed in curriculum order, and the weekly Farm KPI rows by flock age.
const EXPO_DATA_PLANS = [
    'data01' => ['modules' => 3, 'hens' => 7085, 'firstWeek' => 31, 'weeks' => 6, 'heat' => false, 'notes' => [33 => 'Mulai pakan layer fase produksi puncak.']],
    'data02' => ['modules' => 5, 'hens' => 7180, 'firstWeek' => 33, 'weeks' => 7, 'heat' => false, 'notes' => [36 => 'Vaksinasi ND-IB ulang, konsumsi pakan turun sehari.']],
    'data03' => ['modules' => 7, 'hens' => 6750, 'firstWeek' => 30, 'weeks' => 8, 'heat' => false, 'notes' => [34 => 'Lampu kandang ditambah menjadi 16 jam per hari.']],
    'data04' => ['modules' => 9, 'hens' => 7620, 'firstWeek' => 35, 'weeks' => 7, 'heat' => true, 'notes' => [40 => 'Cuaca panas, kipas tambahan dinyalakan siang hari.', 41 => 'Air minum ditambah vitamin C selama tiga hari.']],
    'data05' => ['modules' => 12, 'hens' => 6920, 'firstWeek' => 34, 'weeks' => 8, 'heat' => false, 'notes' => [38 => 'Pemeriksaan kerabang, telur retak mulai berkurang.']],
];
const EXPO_PASS_PERCENTS = [80, 85, 90, 95, 100];
const EXPO_EGG_PRICE_PER_KG = 28000;
const EXPO_FEED_PRICE_PER_KG = 7500;
const EXPO_FEED_SHARE_OF_COST = 0.7;
const EXPO_HEAT_EXTRA_COST = 1500000;
const EXPO_FARM_FIELDS = ['hen_day_production' => 'henDayProduction', 'feed_intake' => 'feedIntake', 'egg_weight' => 'eggWeight', 'mortality' => 'mortality', 'water_intake' => 'waterIntake', 'temperature' => 'temperature', 'humidity' => 'humidity', 'revenue' => 'revenue', 'cost' => 'cost', 'fcr' => 'fcr'];

// API helpers answer failures with a JSON body and a bare exit, which would end a CLI run
// with status 0. Buffer that body and turn it into a failure.
$expoFinished = false;
ob_start();
register_shutdown_function(static function () use (&$expoFinished): void {
    if ($expoFinished) {
        return;
    }
    $buffered = trim((string) ob_get_clean());
    fwrite(STDERR, 'Akun Expo dihentikan' . ($buffered !== '' ? ': ' . $buffered : '.') . " Jalankan --apply lagi untuk melanjutkan, atau --apply --remove untuk membersihkan akun yang sudah dibuat.\n");
    exit(1);
});

function expo_finish(int $code, string $message): void
{
    global $expoFinished;
    $expoFinished = true;
    ob_end_clean();
    fwrite($code === 0 ? STDOUT : STDERR, $message . "\n");
    exit($code);
}

function expo_json(array $summary): string
{
    return (string) json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function expo_email(string $handle): string
{
    return $handle . '@' . EXPO_DOMAIN;
}

/** The operator acting from the server shell. No account stands behind it, so audit rows carry no actor. */
function expo_cli_actor(): array
{
    return ['id' => 0, 'role' => 'super_admin'];
}

/** A stable number in [-1, 1] for a key, so every run draws the same farm. */
function expo_noise(string $key): float
{
    return (crc32($key) / 4294967295) * 2 - 1;
}

function expo_pick(string $key, array $values)
{
    return $values[crc32($key) % count($values)];
}

function expo_account_row(PDO $pdo, string $email): ?array
{
    $statement = $pdo->prepare('SELECT id, email, password_hash, full_name, role, created_at, email_verified_at, verification_required_at, auth_version FROM users WHERE email = ? LIMIT 1');
    $statement->execute([$email]);
    $row = $statement->fetch();
    return $row ?: null;
}

/** Why an existing account cannot be one of ours, or '' when it is. */
function expo_conflict(array $row, string $name): string
{
    if ((string) $row['full_name'] !== $name) {
        return 'email sudah dipakai akun dengan nama lain';
    }
    if (effective_user_role($row) !== 'learner') {
        return 'email sudah dipakai akun Admin';
    }
    return '';
}

function expo_count(PDO $pdo, string $sql, array $params): int
{
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    return (int) $statement->fetchColumn();
}

function expo_activity(PDO $pdo, int $userId): array
{
    return [
        'attempts' => expo_count($pdo, 'SELECT COUNT(*) FROM assessment_attempts WHERE user_id = ?', [$userId]),
        'events' => expo_count($pdo, 'SELECT COUNT(*) FROM module_learning_events WHERE user_id = ?', [$userId]),
        'farmRows' => expo_count($pdo, 'SELECT COUNT(*) FROM farm_data WHERE user_id = ?', [$userId]),
        'certificates' => expo_count($pdo, 'SELECT COUNT(*) FROM certificate_issuances WHERE user_id = ?', [$userId]),
    ];
}

/** Required modules a learner on this policy can complete, in curriculum order. */
function expo_module_plan(PDO $pdo, string $policyVersion): array
{
    $required = aapm_assessment_policy($pdo, $policyVersion)['required'];
    $quizCounts = aapm_quiz_counts($pdo);
    $plan = [];
    foreach (aapm_module_catalog_for_version($pdo, $policyVersion) as $number => $module) {
        if (!in_array($number, $required, true)) {
            continue;
        }
        if ($module['assessmentMode'] === 'quiz' && ($quizCounts[$number] ?? 0) > 0) {
            $plan[] = ['number' => $number, 'quiz' => true];
        } elseif ($module['assessmentMode'] === 'acknowledgement') {
            $plan[] = ['number' => $number, 'quiz' => false];
        }
    }
    return $plan;
}

/** Starts or resumes the module quiz, answers it at the planned score, and submits it. */
function expo_pass_module(PDO $pdo, array $user, string $handle, int $number, int $percent): void
{
    $round = expo_count($pdo, "SELECT COUNT(*) FROM assessment_attempts WHERE user_id = ? AND assessment_type = 'module_quiz' AND module_number = ?", [(int) $user['id'], $number]) + 1;
    $key = sprintf('expo_%s_m%d_r%d', $handle, $number, $round);
    $attempt = aapm_assessment_start($user, ['assessmentType' => 'module_quiz', 'moduleNumber' => $number, 'requestKey' => $key . '_start'])['attempt'];
    $query = $pdo->prepare('SELECT i.id, i.question_snapshot_json, i.checked_at FROM assessment_attempt_items i JOIN assessment_attempts a ON a.id = i.attempt_id WHERE a.public_id = ? ORDER BY i.ordinal');
    $query->execute([$attempt['id']]);
    $items = $query->fetchAll();
    $correct = max((int) ceil(count($items) * $percent / 100), (int) ceil(count($items) * (int) $attempt['passingGrade'] / 100));
    foreach ($items as $index => $item) {
        if ($item['checked_at'] !== null) {
            continue;
        }
        $snapshot = json_decode((string) $item['question_snapshot_json'], true, 512, JSON_THROW_ON_ERROR);
        $answer = $index < $correct ? (int) $snapshot['correctIndex'] : ((int) $snapshot['correctIndex'] + 1) % count($snapshot['options']);
        aapm_assessment_answer($user, $attempt['id'], ['questionId' => (int) $item['id'], 'answerIndex' => $answer]);
    }
    $result = aapm_assessment_submit($user, $attempt['id'], ['requestKey' => $key . '_submit'])['result'] ?? null;
    if (!is_array($result) || empty($result['passed'])) {
        throw new RuntimeException('module quiz not passed');
    }
}

/** Weekly KPI rows for one flock, in the farm-data endpoint's field names. A healthy flock ends on a good week. */
function expo_farm_weeks(string $handle, array $plan): array
{
    $rows = [];
    $hens = (float) $plan['hens'];
    for ($index = 0; $index < $plan['weeks']; $index++) {
        $week = $plan['firstWeek'] + $index;
        $wobble = static fn (string $field, float $size): float => expo_noise("{$handle}|{$week}|{$field}") * $size;
        $heat = $plan['heat'] ? max(0, $index - ($plan['weeks'] - 3)) : 0;
        $previous = $rows[$index - 1] ?? null;
        $closing = !$plan['heat'] && $index === $plan['weeks'] - 1 && $previous !== null;
        $peak = $week <= 32 ? 94.8 - (max(0, 28 - $week) ** 2) * 0.45 : 94.8 - ($week - 32) * 0.25;
        $hdp = $closing ? $previous['henDayProduction'] + 0.2 : round($peak + $wobble('hdp', 0.3) - $heat * 1.6, 1);
        $egg = $closing ? $previous['eggWeight'] + 0.1 : round(66 - 12 * exp(-($week - 20) / 13) + $wobble('egg', 0.15) - $heat * 0.3, 1);
        $feed = $closing ? $previous['feedIntake'] : round(113 - 12 * exp(-($week - 20) / 5) + $wobble('feed', 0.6) - $heat * 3.5, 1);
        $mortality = round(0.08 + $wobble('mortality', 0.02) + $heat * 0.04, 2);
        if ($closing) {
            $mortality = min($previous['mortality'], $mortality);
        }
        $hens *= 1 - $mortality / 100;
        $eggMassKg = $hens * 7 * ($hdp / 100) * $egg / 1000;
        $feedKg = $hens * 7 * $feed / 1000;
        $rows[] = [
            'week' => $week,
            'henDayProduction' => round($hdp, 1),
            'eggWeight' => round($egg, 1),
            'feedIntake' => $feed,
            'waterIntake' => round($feed * 2 + $wobble('water', 3) + $heat * 22),
            'mortality' => $mortality,
            'temperature' => round(28 + $wobble('temperature', 0.6) + $heat * 2.4, 1),
            'humidity' => round(72 + $wobble('humidity', 3) - $heat * 2),
            'fcr' => round($feed / (($hdp / 100) * $egg), 2),
            'revenue' => round($eggMassKg * EXPO_EGG_PRICE_PER_KG / 1000) * 1000,
            'cost' => round($feedKg * EXPO_FEED_PRICE_PER_KG / EXPO_FEED_SHARE_OF_COST / 1000) * 1000 + $heat * EXPO_HEAT_EXTRA_COST,
            'notes' => $plan['notes'][$week] ?? '',
        ];
    }
    return $rows;
}

/** One week through the farm-data endpoint's own validation and statements, keyed by week. */
function expo_save_farm_week(PDO $pdo, int $userId, array $input): string
{
    $week = (int) ($input['week'] ?? 0);
    if ($week < 1) {
        throw new RuntimeException('farm week missing');
    }
    $values = ['week' => $week];
    foreach (EXPO_FARM_FIELDS as $column => $field) {
        $values[$column] = nullable_number($input, $field);
    }
    $values['notes'] = trim((string) ($input['notes'] ?? ''));

    $existing = $pdo->prepare('SELECT * FROM farm_data WHERE user_id = ? AND week = ? ORDER BY id ASC LIMIT 1');
    $existing->execute([$userId, $week]);
    $row = $existing->fetch();
    if (!$row) {
        $pdo->prepare('INSERT INTO farm_data (user_id, week, hen_day_production, feed_intake, egg_weight, mortality, water_intake, temperature, humidity, revenue, cost, fcr, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute(array_merge([$userId], array_values($values)));
        return 'created';
    }
    $same = (string) $row['notes'] === $values['notes'];
    foreach (array_keys(EXPO_FARM_FIELDS) as $column) {
        $stored = $row[$column] === null ? null : (float) $row[$column];
        $same = $same && ($stored === null ? $values[$column] === null : $values[$column] !== null && abs($stored - $values[$column]) < 0.0005);
    }
    if ($same) {
        return 'unchanged';
    }
    $pdo->prepare('UPDATE farm_data SET week = ?, hen_day_production = ?, feed_intake = ?, egg_weight = ?, mortality = ?, water_intake = ?, temperature = ?, humidity = ?, revenue = ?, cost = ?, fcr = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
        ->execute(array_merge(array_values($values), [(int) $row['id'], $userId]));
    return 'updated';
}

/** Completed required modules, and how many of the planned first ones are done. */
function expo_completed(PDO $pdo, int $userId, array $plan, int $target): array
{
    $snapshot = aapm_academic_snapshot($pdo, $userId);
    $planned = 0;
    foreach (array_slice($plan, 0, $target) as $module) {
        if ($snapshot['modules'][$module['number']]['academicCompleted'] ?? false) {
            $planned++;
        }
    }
    return ['total' => (int) $snapshot['eligibility']['verifiedCompletedCount'], 'planned' => $planned, 'snapshot' => $snapshot];
}

/** Brings one account to its group's state. Learning activity is only ever added. */
function expo_apply_account(PDO $pdo, array $account, ?array $row, #[\SensitiveParameter] string $password, array &$totals): string
{
    [$handle, $group, $name] = $account;
    $email = expo_email($handle);
    $actor = expo_cli_actor();
    $notes = [];
    $isNew = $row === null;
    if ($isNew) {
        admin_create_user($actor, ['email' => $email, 'password' => $password, 'fullName' => $name, 'role' => 'learner']);
        $row = expo_account_row($pdo, $email);
        if ($row === null) {
            throw new RuntimeException('account missing after create');
        }
        $totals['accountsCreated']++;
        $notes[] = 'dibuat';
    } else {
        $totals['accountsExisting']++;
        $notes[] = 'sudah ada';
        if (!password_verify($password, (string) $row['password_hash'])) {
            admin_reset_user_password($actor, (int) $row['id'], $password);
            $totals['passwordsReset']++;
            $notes[] = 'kata sandi diatur ulang';
        }
    }
    $userId = (int) $row['id'];
    $user = ['id' => $userId, 'email' => $email, 'full_name' => $name, 'role' => 'user'];

    // The Super Admin path verifies the address at creation; the first group goes back to
    // waiting for verification, as after self-registration.
    $status = aapm_verification_status($row);
    $wantVerified = $group !== 'baru';
    $verificationChanged = $wantVerified !== ($status === 'verified');
    if ($verificationChanged) {
        admin_set_user_verification($actor, $userId, $wantVerified);
        $totals['stateChanges']++;
    }
    $notes[] = ($wantVerified ? 'email terverifikasi' : 'email menunggu verifikasi') . ($verificationChanged && !$isNew ? ' (dipulihkan)' : '');

    // A new account has no profile row, as after self-registration. Only an edited one is reset.
    $profile = profile_row($userId);
    $bio = EXPO_BIOS[$handle] ?? '';
    $avatarClear = $group === 'baru' && (string) $profile['avatar_data'] !== '';
    $profileChanged = (string) $profile['bio'] !== $bio || $avatarClear;
    if ($profileChanged) {
        // The hall of fame choice stays where the app or the visitor left it.
        $input = ['fullName' => $name, 'bio' => $bio, 'hallOfFameOptIn' => (bool) (int) $profile['hall_of_fame_opt_in']];
        if ($avatarClear) {
            $input['avatarData'] = '';
        }
        update_profile_data($user, $input);
        $totals['stateChanges']++;
    }
    $notes[] = ($bio === '' ? 'profil kosong' : 'profil terisi') . ($profileChanged && !$isNew ? ' (dipulihkan)' : '');

    if ($group !== 'data') {
        return implode(', ', $notes);
    }

    $plan = expo_module_plan($pdo, aapm_learner_policy_version($pdo, $userId));
    $target = min(EXPO_DATA_PLANS[$handle]['modules'], count($plan));
    $before = expo_completed($pdo, $userId, $plan, $target);
    $eventsBefore = expo_activity($pdo, $userId)['events'];
    foreach (array_slice($plan, 0, $target) as $module) {
        $number = $module['number'];
        $key = sprintf('expo_%s_m%d', $handle, $number);
        aapm_acknowledge_module($user, $number);
        if ($module['quiz'] && !($before['snapshot']['modules'][$number]['quizPassed'] ?? false)) {
            expo_pass_module($pdo, $user, $handle, $number, (int) expo_pick($key . '|score', EXPO_PASS_PERCENTS));
            $totals['moduleAttempts']++;
        }
        if (crc32($key . '|practice') % 4 > 0) {
            aapm_record_module_event($user, $number, 'practice_attested', ['requestKey' => $key . '_practice', 'attested' => true]);
        }
        $minutes = 10 + crc32($key . '|minutes') % 21;
        for ($part = 0; $minutes > 0; $part++) {
            $increment = min(AAPM_STUDY_INCREMENT_MAX_MINUTES, $minutes);
            aapm_record_module_event($user, $number, 'study_time_increment', ['requestKey' => $key . '_study_' . $part, 'minutes' => $increment]);
            $minutes -= $increment;
        }
    }
    $after = expo_completed($pdo, $userId, $plan, $target);
    $totals['learningEvents'] += expo_activity($pdo, $userId)['events'] - $eventsBefore;
    $notes[] = sprintf('%d modul selesai (%d baru)', $after['total'], max(0, $after['total'] - $before['total']));

    $changes = ['created' => 0, 'updated' => 0, 'unchanged' => 0];
    foreach (expo_farm_weeks($handle, EXPO_DATA_PLANS[$handle]) as $week) {
        $changes[expo_save_farm_week($pdo, $userId, $week)]++;
    }
    $totals['farmWeeksWritten'] += $changes['created'] + $changes['updated'];
    $notes[] = sprintf('%d minggu data farm (%d baru, %d diperbarui)', EXPO_DATA_PLANS[$handle]['weeks'], $changes['created'], $changes['updated']);
    return implode(', ', $notes);
}

/** Every reason this account differs from its group's planned state; empty when it matches. */
function expo_verify_account(PDO $pdo, array $account, ?array $row, #[\SensitiveParameter] string $password, string $activePolicy): array
{
    [$handle, $group, $name] = $account;
    if ($row === null) {
        return [['akun belum ada'], ''];
    }
    $conflict = expo_conflict($row, $name);
    if ($conflict !== '') {
        return [[$conflict], ''];
    }
    $userId = (int) $row['id'];
    $failures = [];
    if (!password_verify($password, (string) $row['password_hash'])) {
        $failures[] = 'kata sandi tidak cocok dengan ' . EXPO_PASSWORD_ENV;
    }
    $policy = expo_count($pdo, 'SELECT COUNT(*) FROM learner_curriculum_assignments WHERE user_id = ? AND policy_version = ?', [$userId, $activePolicy]);
    if ($policy !== 1) {
        $failures[] = 'belum memakai kebijakan kurikulum aktif ' . $activePolicy;
    }
    $status = aapm_verification_status($row);
    if ($group === 'baru' && $status !== 'pending') {
        $failures[] = 'email seharusnya menunggu verifikasi, tercatat ' . $status;
    }
    if ($group !== 'baru' && $status !== 'verified') {
        $failures[] = 'email belum terverifikasi';
    }
    $profile = profile_row($userId);
    $bio = EXPO_BIOS[$handle] ?? '';
    if ($group === 'baru' && ((string) $profile['bio'] !== '' || (string) $profile['avatar_data'] !== '')) {
        $failures[] = 'profil seharusnya kosong';
    }
    if ($group !== 'baru' && (string) $profile['bio'] !== $bio) {
        $failures[] = 'profil tidak sesuai rencana';
    }
    $activity = expo_activity($pdo, $userId);
    if ($activity['certificates'] > 0) {
        $failures[] = $activity['certificates'] . ' sertifikat tercatat';
    }
    $details = [$status === 'verified' ? 'email terverifikasi' : 'email menunggu verifikasi', $bio === '' ? 'profil kosong' : 'profil terisi'];
    if ($group !== 'data') {
        if ($activity['attempts'] + $activity['events'] + $activity['farmRows'] > 0) {
            $failures[] = sprintf('seharusnya tanpa aktivitas, tercatat %d percobaan kuis, %d aktivitas belajar, %d data farm', $activity['attempts'], $activity['events'], $activity['farmRows']);
        }
        $details[] = 'tanpa aktivitas';
        return [$failures, implode(', ', $details)];
    }

    $plan = expo_module_plan($pdo, aapm_learner_policy_version($pdo, $userId));
    $target = min(EXPO_DATA_PLANS[$handle]['modules'], count($plan));
    $completed = expo_completed($pdo, $userId, $plan, $target);
    if ($completed['planned'] < $target) {
        $failures[] = sprintf('%d dari %d modul rencana selesai', $completed['planned'], $target);
    }
    $weeks = array_column(expo_farm_weeks($handle, EXPO_DATA_PLANS[$handle]), 'week');
    $present = expo_count($pdo, 'SELECT COUNT(DISTINCT week) FROM farm_data WHERE user_id = ? AND week IN (' . implode(',', array_fill(0, count($weeks), '?')) . ')', array_merge([$userId], $weeks));
    if ($present < count($weeks)) {
        $failures[] = sprintf('%d dari %d minggu data farm', $present, count($weeks));
    }
    $details[] = sprintf('%d modul selesai', $completed['total']);
    $details[] = sprintf('%d baris data farm', $activity['farmRows']);
    return [$failures, implode(', ', $details)];
}

/** Deletes one account and what belongs to it. Tables without a cascade on every schema go first. */
function expo_remove_account(PDO $pdo, int $userId, string $email): void
{
    aapm_tx_begin($pdo);
    try {
        // A certificate claimed by a visitor blocks the account delete, and it names nobody real.
        foreach (['certificate_events', 'certificate_evidence'] as $table) {
            $pdo->prepare("DELETE FROM {$table} WHERE certificate_id IN (SELECT id FROM certificate_issuances WHERE user_id = ?)")->execute([$userId]);
        }
        foreach (['certificate_issuances', 'learner_achievements', 'legacy_progress_snapshots', 'learner_curriculum_assignments'] as $table) {
            $pdo->prepare("DELETE FROM {$table} WHERE user_id = ?")->execute([$userId]);
        }
        $pdo->prepare('DELETE FROM users WHERE id = ? AND email = ?')->execute([$userId, $email]);
        aapm_tx_commit($pdo);
    } catch (Throwable $exception) {
        aapm_tx_rollback($pdo);
        throw $exception;
    }
}

$options = [];
foreach (array_slice($argv, 1) as $argument) {
    if (!preg_match('/\A--([a-z-]+)(?:=(.*))?\z/', $argument, $match)) {
        expo_finish(2, 'Argumen tidak dikenal: ' . substr($argument, 0, 60));
    }
    $options[$match[1]] = $match[2] ?? true;
}
foreach (array_keys($options) as $key) {
    if (!in_array($key, ['expect-environment', 'dry-run', 'apply', 'verify', 'remove', 'operator', 'evidence-ref', 'confirm-production'], true)) {
        expo_finish(2, 'Opsi tidak dikenal: --' . $key);
    }
}
$dryRun = isset($options['dry-run']);
$apply = isset($options['apply']);
$verify = isset($options['verify']);
$remove = isset($options['remove']);
if ((int) $dryRun + (int) $apply + (int) $verify !== 1) {
    expo_finish(2, 'Pilih tepat satu: --dry-run, --apply, atau --verify.');
}
if ($remove && $verify) {
    expo_finish(2, '--remove hanya bersama --dry-run atau --apply.');
}
$operator = trim((string) ($options['operator'] ?? ''));
$evidence = trim((string) ($options['evidence-ref'] ?? ''));
if ($apply && ($operator === '' || $evidence === '')) {
    expo_finish(2, '--operator dan --evidence-ref wajib untuk --apply.');
}
$expected = strtolower(trim((string) ($options['expect-environment'] ?? '')));
if ($expected === '') {
    expo_finish(2, '--expect-environment wajib diisi.');
}

// Checked against the rule the app applies to every new account, before anything is read.
$password = (string) getenv(EXPO_PASSWORD_ENV);
$passwordError = $password === '' ? 'Variabel ' . EXPO_PASSWORD_ENV . ' belum diisi.' : password_validation_error($password);
if (($verify || ($apply && !$remove)) && $passwordError !== '') {
    expo_finish(2, 'Kata sandi bersama belum siap: ' . $passwordError);
}

try {
    $config = app_config();
} catch (AppConfigException $exception) {
    expo_finish(3, 'Konfigurasi tidak valid: ' . $exception->safeCode());
}
$environment = strtolower((string) ($config['environment'] ?? ''));
if ($environment !== $expected) {
    expo_finish(3, "Target tidak cocok: konfigurasi memakai lingkungan {$environment}, --expect-environment={$expected}.");
}
if ($environment === 'production' && $apply && !isset($options['confirm-production'])) {
    expo_finish(4, 'Production memerlukan --confirm-production, setelah database dicadangkan.');
}

try {
    // Deployed environments verify the environment marker inside db(), before any read.
    $pdo = db();
} catch (AppConfigException $exception) {
    expo_finish(3, 'Database tidak dapat dipakai: ' . $exception->safeCode());
}

$accounts = [];
$conflicts = [];
foreach (EXPO_ACCOUNTS as $account) {
    $row = expo_account_row($pdo, expo_email($account[0]));
    $conflict = $row === null ? '' : expo_conflict($row, $account[2]);
    if ($conflict !== '') {
        $conflicts[] = expo_email($account[0]) . ': ' . $conflict;
    }
    $accounts[] = ['account' => $account, 'row' => $row, 'conflict' => $conflict];
}
$audit = ['operator' => $operator, 'evidence_ref' => $evidence];
$activePolicy = aapm_cur_active_policy_version($pdo);

try {
    if ($verify) {
        $passed = 0;
        foreach ($accounts as $entry) {
            [$handle, $group, $name] = $entry['account'];
            [$failures, $details] = expo_verify_account($pdo, $entry['account'], $entry['row'], $password, $activePolicy);
            $label = sprintf('%s (%s, %s)', expo_email($handle), $name, EXPO_GROUP_LABELS[$group]);
            fwrite(STDOUT, ($failures === [] ? 'PASS ' : 'FAIL ') . $label . ': ' . ($failures === [] ? $details : implode('; ', $failures)) . "\n");
            $passed += $failures === [] ? 1 : 0;
        }
        $summary = ['environment' => $environment, 'mode' => 'verify', 'policy' => $activePolicy, 'accounts' => count($accounts), 'passed' => $passed, 'failed' => count($accounts) - $passed, 'changed' => false];
        expo_finish($passed === count($accounts) ? 0 : 1, expo_json($summary));
    }

    if ($remove) {
        if ($conflicts !== []) {
            expo_finish(4, "Penghapusan dibatalkan, tidak ada yang dihapus:\n" . implode("\n", $conflicts));
        }
        $found = array_values(array_filter($accounts, static fn (array $entry): bool => $entry['row'] !== null));
        foreach ($accounts as $entry) {
            $email = expo_email($entry['account'][0]);
            if ($entry['row'] === null) {
                fwrite(STDOUT, "{$email}: tidak ada\n");
                continue;
            }
            $activity = expo_activity($pdo, (int) $entry['row']['id']);
            $line = sprintf('%d percobaan kuis, %d data farm, %d sertifikat', $activity['attempts'], $activity['farmRows'], $activity['certificates']);
            if ($apply) {
                expo_remove_account($pdo, (int) $entry['row']['id'], $email);
            }
            fwrite(STDOUT, $email . ': ' . ($apply ? 'dihapus' : 'akan dihapus') . " ({$line})\n");
        }
        if ($dryRun) {
            expo_finish(0, expo_json(['environment' => $environment, 'mode' => 'dry-run', 'accountsToRemove' => count($found), 'changed' => false]));
        }
        aapm_audit('demo.expo_accounts_removed', 'ok', null, null, $audit + ['count' => count($found)]);
        expo_finish(0, expo_json(['environment' => $environment, 'mode' => 'apply', 'accountsRemoved' => count($found), 'changed' => $found !== []]));
    }

    $plan = expo_module_plan($pdo, $activePolicy);
    if ($plan === []) {
        expo_finish(4, 'Kebijakan aktif tidak punya modul wajib yang bisa diselesaikan.');
    }

    if ($dryRun) {
        foreach ($accounts as $entry) {
            [$handle, $group, $name] = $entry['account'];
            $state = $entry['conflict'] !== '' ? 'ditolak, ' . $entry['conflict'] : ($entry['row'] === null ? 'akan dibuat' : 'sudah ada');
            $extra = $group === 'data' ? sprintf(', %d modul, %d minggu data farm', min(EXPO_DATA_PLANS[$handle]['modules'], count($plan)), EXPO_DATA_PLANS[$handle]['weeks']) : '';
            fwrite(STDOUT, sprintf("%s (%s, %s): %s%s\n", expo_email($handle), $name, EXPO_GROUP_LABELS[$group], $state, $extra));
        }
        $summary = [
            'environment' => $environment,
            'mode' => 'dry-run',
            'policy' => $activePolicy,
            'modulesAvailable' => count($plan),
            'accountsToCreate' => count(array_filter($accounts, static fn (array $entry): bool => $entry['row'] === null)),
            'accountsExisting' => count(array_filter($accounts, static fn (array $entry): bool => $entry['row'] !== null && $entry['conflict'] === '')),
            'accountsRefused' => count($conflicts),
            'passwordReady' => $passwordError === '',
            'certificates' => 0,
            'changed' => false,
        ];
        expo_finish($conflicts === [] ? 0 : 4, expo_json($summary));
    }

    if ($conflicts !== []) {
        expo_finish(4, "Akun Expo dibatalkan, tidak ada yang diubah:\n" . implode("\n", $conflicts));
    }
    $totals = ['accountsCreated' => 0, 'accountsExisting' => 0, 'passwordsReset' => 0, 'stateChanges' => 0, 'moduleAttempts' => 0, 'learningEvents' => 0, 'farmWeeksWritten' => 0];
    foreach ($accounts as $entry) {
        [$handle, $group, $name] = $entry['account'];
        $line = expo_apply_account($pdo, $entry['account'], $entry['row'], $password, $totals);
        fwrite(STDOUT, sprintf("%s (%s, %s): %s\n", expo_email($handle), $name, EXPO_GROUP_LABELS[$group], $line));
    }
    aapm_audit('demo.expo_accounts_created', 'ok', null, null, $audit + ['count' => count($accounts)]);
    $changed = $totals['accountsCreated'] + $totals['passwordsReset'] + $totals['stateChanges'] + $totals['moduleAttempts'] + $totals['learningEvents'] + $totals['farmWeeksWritten'] > 0;
    expo_finish(0, expo_json(['environment' => $environment, 'mode' => 'apply', 'policy' => $activePolicy, 'accounts' => count($accounts)] + $totals + ['certificates' => 0, 'changed' => $changed]));
} catch (Throwable $exception) {
    // The driver message can contain SQL or hosts; report only its class.
    error_log('[aapm-expo-accounts] stopped: ' . get_class($exception));
    expo_finish(1, 'Akun Expo dihentikan karena ' . get_class($exception) . '. Jalankan --apply lagi untuk melanjutkan, atau --apply --remove untuk membersihkan.');
}
