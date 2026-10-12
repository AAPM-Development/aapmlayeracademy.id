<?php
declare(strict_types=1);
// The companion's validation functions are pure; load only what they use.
function error_response(...$args) { throw new RuntimeException('error_response'); }

$source = file_get_contents(__DIR__ . '/../../../public/api/openrouter.php');
// Windows checkouts may use CRLF: normalise so the markers below match.
$source = str_replace("\r\n", "\n", $source);
$names = [
    'ai_cut',
    'ai_admin_companion_clean_strings',
    'ai_admin_companion_clean_payload',
    'ai_admin_companion_trim_value',
    'ai_admin_companion_material_block',
    'ai_admin_companion_normalise_suggestions',
];
foreach ($names as $name) {
    $start = strpos($source, 'function ' . $name . '(');
    if ($start === false) {
        fwrite(STDERR, "missing {$name}\n");
        exit(2);
    }
    $end = strpos($source, "\n}\n", $start);
    if ($end === false) {
        fwrite(STDERR, "unterminated {$name}\n");
        exit(2);
    }
    eval(substr($source, $start, $end + 2 - $start));
}

$modules = [['id' => 'a'], ['id' => 'b'], ['id' => 'c']];
$suggest = static fn (array $items): array => ai_admin_companion_normalise_suggestions($items, $modules);
$long = str_repeat('é', 200); // 2 bytes each
echo json_encode([
    'orderKnown' => $suggest([['kind' => 'order', 'payload' => ['moduleIds' => ['c', 'a', 'a', 'zzz', 'b']]]]),
    'orderUnknown' => $suggest([['kind' => 'order', 'payload' => ['moduleIds' => ['x', 'y']]]]),
    'chapter' => $suggest([['kind' => 'structure', 'payload' => ['levelName' => '  Air   Minum ', 'modules' => [
        ['title' => 'Satu', 'summary' => 'a'], ['title' => 'satu', 'summary' => 'dup'], ['title' => '', 'summary' => 'x'], 'bukan-objek',
        ['title' => 'Dua'], ['title' => 'Tiga'], ['title' => 'Empat'], ['title' => 'Lima'], ['title' => 'Enam'],
    ]]]]),
    'chapterEmpty' => $suggest([['kind' => 'structure', 'payload' => ['modules' => [['title' => '']]]]]),
    'review' => $suggest([['kind' => 'review', 'payload' => ['issues' => ['  Perbaiki   tujuan ', 'Perbaiki tujuan', '', 5, ['x']]]]]),
    'reviewEmpty' => $suggest([['kind' => 'review', 'payload' => ['issues' => []]]]),
    'unknownKind' => $suggest([['kind' => 'exec', 'payload' => []]]),
    'cutValid' => mb_check_encoding(ai_cut($long, 51), 'UTF-8'),
    'cutLength' => strlen(ai_cut($long, 51)),
    'maxFive' => count($suggest(array_fill(0, 9, ['kind' => 'title', 'payload' => ['title' => 'x']]))),
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
