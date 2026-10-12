<?php
declare(strict_types=1);
require __DIR__ . '/../../../public/api/mail.php';
$bodies = aapm_mail_bodies('Halo,', 'Konfirmasi <email> Anda & lanjut.', 'Verifikasi email', 'https://academy.example/verify-email?token=a%2Bb', 'Abaikan jika bukan Anda.');
$message = aapm_mail_build("noreply@academy.example\r\nBcc: attacker@evil.test", 'Verifikasi', $bodies, 'BOUNDARY');
preg_match_all('/Content-Transfer-Encoding: base64\r\n\r\n(.*?)--BOUNDARY/s', $message['body'], $parts);
echo json_encode([
    'headers' => $message['headers'],
    'bareLf' => preg_match('/(?<!\r)\n/', $message['headers'] . $message['body']) === 1,
    'decoded' => array_map(static fn (string $p): string => base64_decode(str_replace("\r\n", '', $p)), $parts[1]),
    'subjectAscii' => aapm_mail_encode_subject('Verifikasi email'),
    'subjectUtf8' => aapm_mail_encode_subject("Verifikasi \u{2014} akun"),
    'subjectInjected' => aapm_mail_encode_subject("Halo\r\nBcc: x@y.z"),
], JSON_UNESCAPED_SLASHES);
