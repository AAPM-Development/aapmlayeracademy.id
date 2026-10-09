// Q04-F/G frontend contract: the certificate document model (C36–C39) and the
// client contracts for claims, public verification, and admin revocation. The
// rendered PDF and layout are browser checks and stay NOT_TESTED here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { certificateFileName, certificateModel } from "../src/lib/certificatePdf.js";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(repo, relative), "utf8");

const verifiedTier = {
  tierNumber: 2, tierName: "Layer Farm Operator", holderName: "Peserta Uji", issuedAt: "2026-10-20 09:00:00",
  publicId: "a".repeat(32), completedRequiredModules: 2, score: null, verificationUrl: "https://academy.example/verify-certificate/" + "a".repeat(32),
};
const finalTier = { ...verifiedTier, tierNumber: 6, tierName: "Layer Poultry Farm Expert", completedRequiredModules: 1, score: 84 };

test("C36 a tier 1–5 document shows completed modules and never an invented exam score", () => {
  const model = certificateModel(verifiedTier);
  assert.equal(model.title, "SERTIFIKAT KELULUSAN PELATIHAN");
  assert.match(model.achievement, /Menyelesaikan 2 modul wajib/);
  assert.equal(model.achievement.includes("%"), false, "no percentage score on tiers 1–5");
  assert.equal(model.achievement.includes("100"), false, "the legacy 100 never appears");
});

test("C37 the tier 6 document shows the real verified final-exam score", () => {
  const model = certificateModel(finalTier);
  assert.equal(model.achievement, "Nilai ujian akhir terverifikasi: 84%");
});

test("C38 the QR is drawn only for a server-provided verification URL", () => {
  assert.equal(certificateModel(verifiedTier).showQr, true);
  assert.equal(certificateModel({ ...verifiedTier, verificationUrl: "" }).showQr, false);
  assert.equal(certificateModel({ ...verifiedTier, verificationUrl: undefined }).verificationUrl, "");
});

test("C39 a long holder name reaches the renderer unaltered; wrapping happens in the PDF layout", () => {
  const longName = "Raden Mas Haryo Prawiro Adiputra Soetjipto Nugroho Wibisono Sastrowardoyo";
  const model = certificateModel({ ...verifiedTier, holderName: longName });
  assert.equal(model.holder, longName, "no silent truncation in the data model");
});

test("C36 the file name depends on the tier only, never on the holder name", () => {
  assert.equal(certificateFileName(verifiedTier), "sertifikat-aapm-tingkat-2.pdf");
  assert.equal(certificateFileName({ ...verifiedTier, holderName: "Nama Pribadi" }).includes("Nama"), false);
});

test("the disclaimer never claims a licence or government accreditation", () => {
  const model = certificateModel(verifiedTier);
  assert.match(model.disclaimer, /bukan lisensi profesional/i);
  assert.equal(/akreditasi resmi|berlisensi|licensed/i.test(model.disclaimer.replace("Ini bukan lisensi", "")), false);
});

test("learner certification page requests claims with a client key and never sends a score", () => {
  const page = read("src/pages/Certification.jsx");
  assert.match(page, /useClaimCertificate/);
  assert.match(page, /newRequestKey\(\)/);
  assert.match(page, /claim\.mutateAsync\(\{ tierNumber, requestKey/);
  assert.doesNotMatch(page, /score:\s*100|certificates\.create|useIssueCertificate/);
  // A lost response keeps the key; only a server refusal ends the attempt.
  assert.match(page, /if \(error\?\.status\) delete keys\.current\[tierNumber\]/);
});

test("the claim hook re-reads server state on every outcome", () => {
  const hooks = read("src/lib/useCourseData.js");
  assert.match(hooks, /useClaimCertificate[\s\S]*onSettled[\s\S]*certificationEligibility/);
});

test("the client never builds a verification link from the browser origin", () => {
  const verify = read("src/pages/VerifyCertificate.jsx");
  assert.match(verify, /nativeApi\.publicCertificates\.verify\(publicId\)/);
  assert.doesNotMatch(verify, /window\.location/);
  assert.match(verify, /\/\^\[a-f0-9\]\{32\}\$\//, "the path is validated before any request");
});

test("routes: public verification is outside login; admin certificates sits behind the admin shell", () => {
  const app = read("src/App.jsx");
  const publicLine = app.indexOf('<Route path="/verify-certificate/:publicId"');
  const protectedLine = app.indexOf("<Route element={<ProtectedRoute");
  assert.ok(publicLine > 0 && publicLine < protectedLine, "public route is declared before the protected layout");
  const adminLine = app.indexOf('<Route path="/admin/certificates"');
  assert.ok(adminLine > protectedLine, "admin route lives inside the protected block");
});

test("admin revocation requires a reason and confirmation, and only the server result is shown", () => {
  const page = read("src/pages/admin/AdminCertificates.jsx");
  assert.match(page, /reason\.trim\(\)\.length < 5/);
  assert.match(page, /ConfirmDialog/);
  assert.match(page, /revoke\.mutateAsync\(\{ publicId: selected, reason: reason\.trim\(\) \}\)/);
  assert.doesNotMatch(page, /legacy_unverified[\s\S]{0,40}Diterbitkan/, "legacy rows are never labelled as issued");
});

test("nativeClient exposes the certificate endpoints and no client-authored issuance", () => {
  const client = read("src/api/nativeClient.js");
  assert.match(client, /\/certificates\/claims/);
  assert.match(client, /\/public\/certificates\/verify\//);
  assert.match(client, /\/admin\/certificates\/\$\{encodeURIComponent\(publicId\)\}\/revoke/);
  assert.doesNotMatch(client, /create: \(data\) => request\("\/certificates"/);
});
