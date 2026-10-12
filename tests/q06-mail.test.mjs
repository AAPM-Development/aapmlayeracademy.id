import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = spawnSync("php", [join(repo, "tests", "fixtures", "q06", "mail.php")], { encoding: "utf8" });
assert.equal(run.status, 0, run.stderr);
const mail = JSON.parse(run.stdout);

test("messages use CRLF only and carry Date, Message-ID and MIME headers", () => {
  assert.equal(mail.bareLf, false, "a bare LF breaks SMTP DATA on strict servers");
  assert.match(mail.headers, /\r\nDate: [A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} \+0000\r\n/);
  assert.match(mail.headers, /\r\nMessage-ID: <[0-9a-f]{24}@[^>]+>\r\n/);
  assert.match(mail.headers, /multipart\/alternative; boundary="BOUNDARY"/);
});

test("a From header cannot smuggle extra headers", () => {
  assert.doesNotMatch(mail.headers, /\r\nBcc:/i);
  assert.equal(mail.subjectInjected, "Halo Bcc: x@y.z");
});

test("text and HTML parts both carry the whole link, and HTML escapes content", () => {
  const [text, html] = mail.decoded;
  assert.ok(text.includes("https://academy.example/verify-email?token=a%2Bb"));
  assert.ok(html.includes('href="https://academy.example/verify-email?token=a%2Bb"'));
  assert.ok(html.includes("Konfirmasi &lt;email&gt; Anda &amp; lanjut."));
  assert.ok(!html.includes("<email>"));
});

test("subjects stay ASCII or become RFC 2047 encoded words", () => {
  assert.equal(mail.subjectAscii, "Verifikasi email");
  assert.match(mail.subjectUtf8, /^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
});
