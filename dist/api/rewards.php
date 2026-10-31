<?php
declare(strict_types=1);

/**
 * Points, levels and achievements: the single definition of the reward rules.
 * Pure functions with no database access, so they are unit-tested and the web
 * app mirrors the same numbers (see tests/q06-rewards.test.mjs for the parity check).
 */

const AAPM_POINTS_PER_MODULE = 100;
const AAPM_POINTS_PER_PRACTICE = 35;
const AAPM_POINTS_PER_CERTIFICATE = 150;
const AAPM_POINTS_QUIZ_MAX = 100;
const AAPM_POINTS_PER_FARM_ENTRY = 10;
const AAPM_FARM_ENTRIES_CAP = 12;
const AAPM_MINUTES_PER_POINT = 10;
const AAPM_STUDY_POINTS_CAP = 60;

/**
 * Ascending. The first entry starts at 0 so every learner has a level. Thresholds track
 * the certificate tiers: Field Builder near tier 1, Farm Analyst near tier 3, Layer Leader
 * near tier 5, measured on a learner who passes modules without logging practice.
 */
function aapm_reward_levels(): array
{
    return [
        ['name' => 'Foundation', 'from' => 0],
        ['name' => 'Field Builder', 'from' => 400],
        ['name' => 'Farm Analyst', 'from' => 1500],
        ['name' => 'Layer Leader', 'from' => 2700],
    ];
}

/**
 * Facts: completed, practical, certificates, quizAverage (0-100 or null), farmEntries, minutes.
 * Every input is clamped, so bad data can never produce negative or runaway points.
 */
function aapm_reward_points(array $facts): int
{
    $completed = max(0, (int) ($facts['completed'] ?? 0));
    $practical = max(0, (int) ($facts['practical'] ?? 0));
    $certificates = max(0, (int) ($facts['certificates'] ?? 0));
    $quiz = $facts['quizAverage'] ?? null;
    $quiz = $quiz === null ? 0 : max(0, min(AAPM_POINTS_QUIZ_MAX, (int) $quiz));
    $farm = max(0, min(AAPM_FARM_ENTRIES_CAP, (int) ($facts['farmEntries'] ?? 0)));
    $minutes = max(0, (int) ($facts['minutes'] ?? 0));

    return ($completed * AAPM_POINTS_PER_MODULE)
        + ($practical * AAPM_POINTS_PER_PRACTICE)
        + ($certificates * AAPM_POINTS_PER_CERTIFICATE)
        + $quiz
        + ($farm * AAPM_POINTS_PER_FARM_ENTRY)
        + min(AAPM_STUDY_POINTS_CAP, intdiv($minutes, AAPM_MINUTES_PER_POINT));
}

/** @return array{name:string,from:int,nextAt:?int,nextName:?string} */
function aapm_reward_level(int $points): array
{
    $levels = aapm_reward_levels();
    $index = 0;
    foreach ($levels as $position => $level) {
        if ($points >= $level['from']) {
            $index = $position;
        }
    }
    $next = $levels[$index + 1] ?? null;

    return ['name' => $levels[$index]['name'], 'from' => $levels[$index]['from'], 'nextAt' => $next['from'] ?? null, 'nextName' => $next['name'] ?? null];
}

/**
 * Achievement definitions for the given facts (before unlocked/earned state).
 * Facts add: entries, moduleTotal, points. Ids are stable: they are stored once earned.
 */
function aapm_reward_achievement_definitions(array $f): array
{
    $levels = aapm_reward_levels();
    $entries = (int) ($f['entries'] ?? 0);
    $completed = (int) ($f['completed'] ?? 0);
    $practical = (int) ($f['practical'] ?? 0);
    $quizAverage = $f['quizAverage'] ?? null;
    $farmEntries = (int) ($f['farmEntries'] ?? 0);
    $certificates = (int) ($f['certificates'] ?? 0);
    $minutes = (int) ($f['minutes'] ?? 0);
    $moduleTotal = (int) ($f['moduleTotal'] ?? 0);
    $points = (int) ($f['points'] ?? 0);

    return [
        ['id' => 'first-step', 'title' => 'Langkah pertama', 'description' => 'Simpan aktivitas pada modul pertama.', 'icon' => 'solar:flag-2-bold-duotone', 'current' => $entries, 'target' => 1],
        ['id' => 'module-finisher', 'title' => 'Modul tuntas', 'description' => 'Selesaikan minimal satu modul pembelajaran.', 'icon' => 'solar:check-read-bold-duotone', 'current' => $completed, 'target' => 1],
        ['id' => 'field-practice', 'title' => 'Praktik lapangan', 'description' => 'Tandai sedikitnya satu praktik sebagai selesai.', 'icon' => 'solar:leaf-bold-duotone', 'current' => $practical, 'target' => 1],
        ['id' => 'quiz-ready', 'title' => 'Siap evaluasi', 'description' => 'Kumpulkan nilai kuis rata-rata minimal 80%.', 'icon' => 'solar:cup-star-bold-duotone', 'current' => $quizAverage ?? 0, 'target' => 80],
        ['id' => 'farm-journal', 'title' => 'Catatan farm konsisten', 'description' => 'Simpan empat catatan KPI untuk analisis yang lebih bermakna.', 'icon' => 'solar:chart-2-bold-duotone', 'current' => $farmEntries, 'target' => 4],
        ['id' => 'certified', 'title' => 'Tersertifikasi', 'description' => 'Peroleh sertifikat dari alur pembelajaran.', 'icon' => 'solar:diploma-verified-bold-duotone', 'current' => $certificates, 'target' => 1],
        // Every goal below is counted from stored learning data only.
        ['id' => 'modules-3', 'title' => 'Mulai melaju', 'description' => 'Selesaikan 3 modul.', 'current' => $completed, 'target' => 3],
        ['id' => 'modules-5', 'title' => 'Konsisten belajar', 'description' => 'Selesaikan 5 modul.', 'current' => $completed, 'target' => 5],
        ['id' => 'modules-10', 'title' => 'Sepuluh modul', 'description' => 'Selesaikan 10 modul pembelajaran.', 'current' => $completed, 'target' => 10],
        ['id' => 'halfway', 'title' => 'Setengah jalan', 'description' => 'Capai 50% kurikulum.', 'current' => ($moduleTotal > 0 ? max(0, min(100, (int) round(($completed / $moduleTotal) * 100))) : 0), 'target' => 50],
        ['id' => 'course-complete', 'title' => 'Lulus kurikulum', 'description' => 'Selesaikan seluruh modul kurikulum.', 'current' => $completed, 'target' => max(1, $moduleTotal)],
        ['id' => 'practice-3', 'title' => 'Tangan di kandang', 'description' => 'Selesaikan 3 praktik lapangan.', 'current' => $practical, 'target' => 3],
        ['id' => 'practice-10', 'title' => 'Praktisi andal', 'description' => 'Selesaikan 10 praktik lapangan.', 'current' => $practical, 'target' => 10],
        ['id' => 'quiz-90', 'title' => 'Nilai cemerlang', 'description' => 'Pertahankan rata-rata kuis minimal 90%.', 'current' => $quizAverage ?? 0, 'target' => 90],
        ['id' => 'farm-8', 'title' => 'Data makin tajam', 'description' => 'Simpan 8 catatan KPI farm.', 'current' => $farmEntries, 'target' => 8],
        ['id' => 'farm-12', 'title' => 'Pencatat setia', 'description' => 'Simpan 12 catatan KPI farm.', 'current' => $farmEntries, 'target' => 12],
        ['id' => 'study-1h', 'title' => 'Satu jam fokus', 'description' => 'Belajar total 1 jam.', 'current' => $minutes, 'target' => 60],
        ['id' => 'study-5h', 'title' => 'Lima jam belajar', 'description' => 'Belajar total 5 jam.', 'current' => $minutes, 'target' => 300],
        ['id' => 'study-10h', 'title' => 'Sepuluh jam belajar', 'description' => 'Belajar total 10 jam.', 'current' => $minutes, 'target' => 600],
        ['id' => 'level-builder', 'title' => 'Field Builder', 'description' => 'Capai ' . $levels[1]['from'] . ' poin pembelajaran.', 'current' => $points, 'target' => $levels[1]['from']],
        ['id' => 'level-analyst', 'title' => 'Farm Analyst', 'description' => 'Capai ' . $levels[2]['from'] . ' poin pembelajaran.', 'current' => $points, 'target' => $levels[2]['from']],
        ['id' => 'level-leader', 'title' => 'Layer Leader', 'description' => 'Capai ' . $levels[3]['from'] . ' poin pembelajaran.', 'current' => $points, 'target' => $levels[3]['from']],
        ['id' => 'points-1500', 'title' => 'Bintang Academy', 'description' => 'Kumpulkan 1.500 poin pembelajaran.', 'current' => $points, 'target' => 1500],
        ['id' => 'certified-2', 'title' => 'Dua sertifikat', 'description' => 'Peroleh 2 sertifikat dari alur pembelajaran.', 'current' => $certificates, 'target' => 2],
    ];
}
