<?php
declare(strict_types=1);
require __DIR__ . '/../../../public/api/bootstrap.php';
$config = app_config();
if ($config['environment'] !== 'local' || ($config['task_owned_fixture'] ?? false) !== true) throw new RuntimeException('Local disposable fixture only');
$driver = $config['db_driver'];
$pdo = $driver === 'sqlite' ? new PDO('sqlite:' . $config['db_path']) : new PDO('mysql:host=' . $config['db_host'] . ';port=' . $config['db_port'] . ';dbname=' . $config['db_name'] . ';charset=utf8mb4', $config['db_user'], $config['db_password']);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
$mode = $argv[1] ?? 'inspect';
if ($mode === 'prepare') {
    // Reconstruct the additive pre-Q05 boundary from actual answered/issued history.
    // Remove only Q05-owned structures in the task-owned fixture, keeping Q01-Q04 records.
    foreach (['question_bank_drafts', 'module_drafts', 'module_revisions', 'question_bank_revision_items', 'question_bank_revisions', 'curriculum_policy_modules', 'curriculum_policy_versions', 'learner_curriculum_assignments', 'curriculum_publication_events', 'module_number_allocations'] as $table) $pdo->exec('DROP TABLE ' . $table);
    foreach (['published_revision_id', 'lifecycle_status', 'archived_at', 'archived_by_user_id', 'archive_reason', 'lock_version'] as $column) $pdo->exec('ALTER TABLE course_modules DROP COLUMN ' . $column);
    $pdo->exec("DELETE FROM schema_migrations WHERE migration_key = '20261101_curriculum_publishing_v1'");
} elseif ($mode === 'interrupt') {
    foreach (aapm_cur_ddl($driver) as $statement) $pdo->exec($statement);
    $pdo->exec($driver === 'mysql'
        ? "CREATE TRIGGER fail_upgrade BEFORE INSERT ON curriculum_publication_events FOR EACH ROW BEGIN IF NEW.event_type = 'module.published' AND NEW.module_number = 2 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'controlled upgrade interruption'; END IF; END"
        : "CREATE TRIGGER fail_upgrade BEFORE INSERT ON curriculum_publication_events WHEN NEW.event_type = 'module.published' AND NEW.module_number = 2 BEGIN SELECT RAISE(ABORT, 'controlled upgrade interruption'); END");
} elseif ($mode === 'recover') {
    $pdo->exec('DROP TRIGGER fail_upgrade');
}
$out = [];
foreach (['course_modules', 'quiz_questions', 'users', 'assessment_policies', 'assessment_attempts', 'assessment_attempt_items', 'module_learning_events', 'user_progress', 'certificate_issuances', 'certificate_evidence', 'certificate_events', 'certificate_tier_policies', 'learner_academic_state'] as $table) {
    $out[$table] = $pdo->query('SELECT * FROM ' . $table)->fetchAll();
}
$out['q05Marker'] = $pdo->query("SELECT * FROM schema_migrations WHERE migration_key = '20261101_curriculum_publishing_v1'")->fetchAll();
if (aapm_table_exists($pdo, 'module_revisions')) $out['revisions'] = $pdo->query('SELECT * FROM module_revisions ORDER BY id')->fetchAll();
echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
