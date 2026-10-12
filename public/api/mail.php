<?php
declare(strict_types=1);

/**
 * Transactional email: one MIME builder for every message (verification, password reset).
 *
 * Why not a plain string body: SMTP needs CRLF line endings, bare LF is rejected or mangled
 * by several servers; UTF-8 needs an explicit transfer encoding; and messages without Date
 * and Message-ID headers are scored as spam. Each message carries a text part and an HTML
 * part (a real button), both base64 so no line is ever too long or altered in transit.
 */

/** Header values never contain line breaks: this closes header injection. */
function aapm_mail_header_value(string $value): string
{
    return trim((string) preg_replace('/[\r\n\x00]+/', ' ', $value));
}

function aapm_mail_encode_subject(string $subject): string
{
    $subject = aapm_mail_header_value($subject);
    return preg_match('/^[\x20-\x7E]*$/', $subject) === 1 ? $subject : '=?UTF-8?B?' . base64_encode($subject) . '?=';
}

function aapm_mail_domain(string $from): string
{
    $at = strrpos($from, '@');
    return $at === false ? 'localhost' : strtolower(substr($from, $at + 1));
}

/** Clean text/HTML bodies with a link button. $link must already be an absolute URL. */
function aapm_mail_bodies(string $greeting, string $intro, string $buttonLabel, string $link, string $outro): array
{
    $text = $greeting . "\r\n\r\n" . $intro . "\r\n\r\n" . $buttonLabel . ":\r\n" . $link . "\r\n\r\n" . $outro . "\r\n";
    $e = static fn (string $value): string => htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $html = '<!doctype html><html lang="id"><body style="margin:0;background:#f5f6f4;font-family:Arial,Helvetica,sans-serif;color:#1f2320">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;border:1px solid #e3e6e1">'
        . '<tr><td style="padding:28px 28px 8px;font-size:18px;font-weight:700;color:#318139">AAPM Layer Academy</td></tr>'
        . '<tr><td style="padding:8px 28px;font-size:15px;line-height:1.6">' . $e($greeting) . '<br><br>' . $e($intro) . '</td></tr>'
        . '<tr><td style="padding:12px 28px 20px"><a href="' . $e($link) . '" style="display:inline-block;background:#318139;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">' . $e($buttonLabel) . '</a></td></tr>'
        . '<tr><td style="padding:0 28px 8px;font-size:13px;line-height:1.5;color:#5f6661">Jika tombol tidak berfungsi, salin tautan ini ke browser:<br><span style="word-break:break-all">' . $e($link) . '</span></td></tr>'
        . '<tr><td style="padding:12px 28px 28px;font-size:13px;line-height:1.5;color:#5f6661">' . $e($outro) . '</td></tr>'
        . '</table></td></tr></table></body></html>';

    return ['text' => $text, 'html' => $html];
}

/**
 * Returns the extra headers (without To/Subject) and the multipart body, both CRLF-terminated.
 *
 * @return array{headers:string, body:string}
 */
function aapm_mail_build(string $from, string $subject, array $bodies, ?string $boundary = null): array
{
    $from = aapm_mail_header_value($from);
    $boundary = $boundary ?? ('aapm_' . bin2hex(random_bytes(12)));
    $part = static fn (string $type, string $content): string => 'Content-Type: ' . $type . "; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($content), 76, "\r\n");
    $body = '--' . $boundary . "\r\n" . $part('text/plain', $bodies['text'])
        . '--' . $boundary . "\r\n" . $part('text/html', $bodies['html'])
        . '--' . $boundary . "--\r\n";
    $headers = implode("\r\n", [
        'From: ' . $from,
        'Reply-To: ' . $from,
        'Date: ' . gmdate('D, d M Y H:i:s') . ' +0000',
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . aapm_mail_domain($from) . '>',
        'MIME-Version: 1.0',
        'Auto-Submitted: auto-generated',
        'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
    ]);

    return ['headers' => $headers, 'body' => $body];
}

/** Delivers through the host's mail() first, then SMTP. True only when a server accepted it. */
function aapm_mail_deliver(string $to, string $from, string $subject, array $bodies): bool
{
    if (!filter_var($to, FILTER_VALIDATE_EMAIL) || !filter_var($from, FILTER_VALIDATE_EMAIL)) {
        return false;
    }
    $message = aapm_mail_build($from, $subject, $bodies);
    $encodedSubject = aapm_mail_encode_subject($subject);
    if (function_exists('mail') && @mail($to, $encodedSubject, $message['body'], $message['headers'])) {
        return true;
    }

    return send_smtp_message($to, $from, $encodedSubject, $message);
}
