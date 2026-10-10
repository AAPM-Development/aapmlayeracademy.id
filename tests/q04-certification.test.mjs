// Q04-C..H certificate suite: server-verified issuance, idempotent claims, evidence,
// legacy preservation, public verification, revocation, and migration. Real API under
// php -S against disposable SQLite or the explicitly configured task-owned native runtime.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  SQLITE, attemptKey, bulk, cleanEnv, cleanup, fixtures, makeSite, passAllRequired, passModule, repo, rows, run, seedAccount, seedCurriculum, setup, signIn, sql, withSite,
} from "./helpers/site.mjs";

after(cleanup);

const claim = (api, tierNumber, requestKey = randomUUID(), extra = {}) =>
  api.mutate("POST", "/api/certificates/claims", { tierNumber, requestKey, ...extra });

const eligibility = async (api) => (await api.get("/api/certification/eligibility")).json.data;
const tierStatus = (data, tier) => data.tiers.find((item) => item.tierNumber === tier);

async function answerFinal(api, site, attempt, correctCount) {
  const key = attemptKey(site, attempt.id);
  for (let index = 0; index < attempt.questions.length; index++) {
    const entry = key.get(attempt.questions[index].id);
    const answerIndex = index < correctCount ? entry.correct : (entry.correct + 1) % entry.count;
    const saved = await api.mutate("POST", `/api/assessments/attempts/${attempt.id}/answers`, { questionId: attempt.questions[index].id, answerIndex });
    assert.equal(saved.status, 200, saved.text);
  }
}

async function passFinal(api, site, correctCount = 6) {
  const attempt = (await api.mutate("POST", "/api/assessments/attempts", { assessmentType: "final_exam", moduleNumber: 0, requestKey: randomUUID() })).json.data.attempt;
  await answerFinal(api, site, attempt, correctCount);
  return api.mutate("POST", `/api/assessments/attempts/${attempt.id}/submit`, { requestKey: randomUUID() });
}

function claimProcess(site, userId, tier, requestKey) {
  return new Promise((done, reject) => {
    const child = spawn("php", [...SQLITE, join(fixtures, "q04", "claim.php"), String(userId), String(tier), requestKey], {
      cwd: repo,
      env: cleanEnv({ AAPLAYERACADEMY_CONFIG: site.config }),
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (err += chunk));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? done(JSON.parse(out.trim())) : reject(new Error(out + err))));
  });
}

/** Learner with modules 1–3 verified: enough for tier 1 only. */
async function tierOneLearner(site, api) {
  const learner = await signIn(api.port, "peserta-a@example.test");
  for (const number of [1, 2, 3]) await passModule(learner, site, number);
  return learner;
}

test("C05 a learner with no verified requirements is refused with the missing modules", async () => {
  const { site } = await setup("c05");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const reply = await claim(learner, 1);
    assert.equal(reply.status, 409);
    assert.equal(reply.json.error.code, "requirements_unmet");
    assert.deepEqual(reply.json.error.details.missingModuleNumbers, [1, 2, 3]);
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM certificate_issuances")[0].n), 0);
  });
});

test("C06 and C07 tier 1 is eligible on its own modules; tier 2 is not eligible without tier 1", async () => {
  const { site } = await setup("c06");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    for (const number of [4, 5]) await passModule(learner, site, number);
    const early = await eligibility(learner);
    assert.equal(tierStatus(early, 2).status, "in_progress", "modules 4 and 5 alone do not satisfy tier 2 cumulatively");
    assert.deepEqual(tierStatus(early, 2).missingModuleNumbers, [1, 2, 3]);
    assert.equal((await claim(learner, 2)).status, 409, "tier 2 claim refused without tier 1 modules");
    for (const number of [1, 2, 3]) await passModule(learner, site, number);
    assert.equal(tierStatus(await eligibility(learner), 1).status, "eligible");
  });
});

test("C08 the cumulative tier 3 requirement is exactly the union of tiers 1–3", async () => {
  const { site } = await setup("c08");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const tier3 = tierStatus(await eligibility(learner), 3);
    assert.deepEqual(tier3.requiredModules ?? tier3.missingModuleNumbers, [1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 15, 16, 17]);
    assert.equal(tier3.totalRequiredModules, 14);
    assert.equal(tier3.completedRequiredModules, 0);
  });
});

test("C09 and C10 tier 6 needs the final exam; with it and all 22 modules, tier 6 is eligible", async () => {
  const { site } = await setup("c09");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    await passAllRequired(learner, site);
    const beforeFinal = tierStatus(await eligibility(learner), 6);
    assert.equal(beforeFinal.status, "in_progress");
    assert.equal(beforeFinal.finalPassed, false);
    const refused = await claim(learner, 6);
    assert.equal(refused.status, 409, "tier 6 without a passed final is refused");
    assert.equal(refused.json.error.details.finalPassed, false);

    assert.equal((await passFinal(learner, site, 6)).json.data.attempt.result.passed, true);
    assert.equal(tierStatus(await eligibility(learner), 6).status, "eligible");
    assert.equal((await claim(learner, 6)).status, 201);
  });
});

test("C11 a final at 79% does not qualify; C12 a final at 80% does", async () => {
  const site = makeSite("c11");
  seedCurriculum(site);
  bulk(site, { questions: Array.from({ length: 94 }, (_, index) => ({ module_number: 0, options: ["A", "B", "C", "D"], learning_objective: `Tujuan ${index % 4}` })) });
  seedAccount(site, { email: "gagal@example.test", verified: true });
  seedAccount(site, { email: "lulus@example.test", verified: true });

  await withSite(site, async (api) => {
    const failing = await signIn(api.port, "gagal@example.test");
    await passAllRequired(failing, site);
    const attempt = (await failing.mutate("POST", "/api/assessments/attempts", { assessmentType: "final_exam", moduleNumber: 0, requestKey: randomUUID() })).json.data.attempt;
    await answerFinal(failing, site, attempt, 79);
    await failing.mutate("POST", `/api/assessments/attempts/${attempt.id}/submit`, { requestKey: randomUUID() });
    assert.equal((await claim(failing, 6)).status, 409, "79% is not a pass");
    assert.equal(tierStatus(await eligibility(failing), 6).finalPassed, false);
  });
  await withSite(site, async (api) => {
    const passing = await signIn(api.port, "lulus@example.test");
    await passAllRequired(passing, site);
    const attempt = (await passing.mutate("POST", "/api/assessments/attempts", { assessmentType: "final_exam", moduleNumber: 0, requestKey: randomUUID() })).json.data.attempt;
    await answerFinal(passing, site, attempt, 80);
    await passing.mutate("POST", `/api/assessments/attempts/${attempt.id}/submit`, { requestKey: randomUUID() });
    const issued = await claim(passing, 6);
    assert.equal(issued.status, 201, issued.text);
    assert.equal(Number(rows(site, "SELECT verified_score_percent AS s FROM certificate_issuances WHERE tier_number = 6")[0].s), 80, "the verified final score is recorded");
  });
});

test("C13 an account without verified email ownership cannot claim", async () => {
  const { site } = await setup("c13");
  seedAccount(site, { email: "belum@example.test", verified: false });
  await withSite(site, async (api) => {
    const unverified = await signIn(api.port, "belum@example.test");
    const reply = await claim(unverified, 1);
    assert.equal(reply.status, 403);
    assert.equal(reply.json.error.code, "email_verification_required");
    assert.equal(tierStatus(await eligibility(unverified), 1).emailVerificationRequired, true);
  });
});

test("C14–C17 forged client score, holder name, tier title, and assessment id are ignored", async () => {
  const { site, learnerA } = await setup("c14");
  await withSite(site, async (api) => {
    const learner = await tierOneLearner(site, api);
    const reply = await claim(learner, 1, randomUUID(), {
      score: 100, holderName: "Orang Lain", tierName: "Palsu", policyVersion: "forged-v9", attemptId: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", levelName: "Palsu", examType: "final",
    });
    assert.equal(reply.status, 201, reply.text);
    const row = rows(site, "SELECT * FROM certificate_issuances WHERE user_id = ?", [learnerA])[0];
    assert.equal(row.verified_score_percent, null, "tiers 1–5 carry no invented exam score");
    assert.equal(row.holder_name_snapshot, "Peserta Uji");
    assert.equal(row.tier_name_snapshot, "Layer Poultry Farm Foundation");
    assert.equal(row.policy_version, "academy-v1");
    assert.equal(row.final_attempt_id, null);
  });
});

test("C18–C19 a first valid claim issues one certificate; a repeat returns the same one", async () => {
  const { site, learnerA } = await setup("c18");
  await withSite(site, async (api) => {
    const learner = await tierOneLearner(site, api);
    const first = await claim(learner, 1, "claim-key-one");
    assert.equal(first.status, 201);
    const again = await claim(learner, 1, "claim-key-two");
    assert.equal(again.status, 200);
    assert.equal(again.json.data.certificate.id, first.json.data.certificate.id);
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM certificate_issuances WHERE user_id = ?", [learnerA])[0].n), 1);
  });
});

test("C21 a network retry with the same key does not duplicate the certificate", async () => {
  const { site, learnerA } = await setup("c21");
  await withSite(site, async (api) => {
    const learner = await tierOneLearner(site, api);
    const key = "retry-key-0001";
    const first = await claim(learner, 1, key);
    const retry = await claim(learner, 1, key);
    assert.equal(first.status, 201);
    assert.equal(retry.status, 200);
    assert.equal(retry.json.data.certificate.id, first.json.data.certificate.id);
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM certificate_issuances WHERE user_id = ?", [learnerA])[0].n), 1);
  });
});

test(`${process.env.AAPM_TEST_MYSQL_CONFIG ? "C20/C49/C50 native MariaDB" : "C20/C49"} concurrent claims from separate processes issue exactly one certificate`, async () => {
  const { site, learnerA } = await setup("c20");
  await withSite(site, async (api) => {
    await tierOneLearner(site, api);
  });
  const outcomes = await Promise.all([claimProcess(site, learnerA, 1, randomUUID()), claimProcess(site, learnerA, 1, randomUUID())]);
  assert.equal(outcomes.filter((item) => item.created).length, 1, "exactly one process created it");
  assert.equal(outcomes[0].publicId, outcomes[1].publicId, "both observe the same certificate");
  assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM certificate_issuances WHERE user_id = ?", [learnerA])[0].n), 1);
  assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM certificate_events WHERE event_type = 'certificate.issued'")[0].n), 1, "one audit event, not two");
});

test("C22 evidence is complete per requirement and carries no answer keys", async () => {
  const { site, learnerA } = await setup("c22");
  await withSite(site, async (api) => {
    const learner = await tierOneLearner(site, api);
    await claim(learner, 1);
  });
  const certificateId = Number(rows(site, "SELECT id FROM certificate_issuances WHERE user_id = ?", [learnerA])[0].id);
  const evidence = rows(site, "SELECT * FROM certificate_evidence WHERE certificate_id = ? ORDER BY module_number", [certificateId]);
  assert.equal(evidence.length, 3, "one evidence row per required module");
  assert.deepEqual(evidence.map((item) => Number(item.module_number)), [1, 2, 3]);
  for (const item of evidence) {
    assert.equal(Number(item.academic_generation), 1);
    assert.equal(item.policy_version, "academy-v1");
    assert.ok(!item.evidence_snapshot_json.includes("correctIndex"));
    assert.ok(!item.evidence_snapshot_json.includes("explanation"));
  }
});

test("C23 a later profile name change does not alter the issued holder name", async () => {
  const { site, learnerA } = await setup("c23");
  await withSite(site, async (api) => {
    const learner = await tierOneLearner(site, api);
    const issued = await claim(learner, 1);
    sql(site, "UPDATE users SET full_name = ? WHERE id = ?", ["Nama Baru Berbeda", learnerA]);
    const detail = await learner.get(`/api/certificates/${issued.json.data.certificate.id}`);
    assert.equal(detail.json.data.certificate.holderName, "Peserta Uji");
  });
});

test("C24–C26 legacy certificates are preserved, shown separately, and a legacy score 100 is not verified", async () => {
  const { site, learnerA } = await setup("c24");
  sql(site, "INSERT INTO certificates (user_id, level_number, level_name, score, exam_type, holder_name, issued_at) VALUES (?, 1, 'Layer Poultry Farm Foundation', 100, 'level', 'Peserta Uji', '2026-02-01 00:00:00')", [learnerA]);
  const legacyBefore = JSON.stringify(rows(site, "SELECT * FROM certificates WHERE user_id = ?", [learnerA]));
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const data = await eligibility(learner);
    const tier1 = tierStatus(data, 1);
    assert.equal(tier1.status, "locked", "a legacy row never makes a tier issued or eligible");
    assert.equal(tier1.legacyRecords.length, 1);
    assert.equal(tier1.legacyRecords[0].source, "legacy_unverified");

    const list = (await learner.get("/api/certificates")).json.data;
    assert.equal(list.filter((item) => item.source === "legacy_unverified").length, 1);
    assert.equal(JSON.stringify(rows(site, "SELECT * FROM certificates WHERE user_id = ?", [learnerA])), legacyBefore, "the legacy row is byte-for-byte unchanged");

    await passModule(learner, site, 1);
    await passModule(learner, site, 2);
    await passModule(learner, site, 3);
    const issued = await claim(learner, 1);
    assert.equal(issued.status, 201, "a verified claim is allowed alongside the legacy row");
    const both = (await learner.get("/api/certificates")).json.data;
    assert.equal(both.filter((item) => item.tierNumber === 1).length, 2, "both remain distinguishable");
    assert.deepEqual(both.map((item) => item.source).sort(), ["legacy_unverified", "verified"]);
  });
});

test("C27 the insecure client-authored certificate POST is permanently refused", async () => {
  const { site } = await setup("c27");
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta-a@example.test");
    const reply = await learner.mutate("POST", "/api/certificates", { levelNumber: 1, levelName: "Palsu", score: 100, examType: "final" });
    assert.equal(reply.status, 410);
    assert.equal(reply.json.error.code, "certificate_endpoint_retired");
  });
});

test("C28 another learner's certificate, by public id or legacy numeric id, is not found", async () => {
  const { site, learnerA } = await setup("c28");
  sql(site, "INSERT INTO certificates (user_id, level_number, level_name, score, exam_type, holder_name, issued_at) VALUES (?, 2, 'Operator', 100, 'level', 'A', '2026-02-01 00:00:00')", [learnerA]);
  const legacyId = rows(site, "SELECT id FROM certificates WHERE user_id = ?", [learnerA])[0].id;
  await withSite(site, async (api) => {
    const owner = await tierOneLearner(site, api);
    const issued = await claim(owner, 1);
    const other = await signIn(api.port, "peserta-b@example.test");
    const publicId = issued.json.data.certificate.id;
    assert.equal((await other.get(`/api/certificates/${publicId}`)).status, 404);
    assert.equal((await other.get(`/api/certificates/${legacyId}`)).status, 404);
    assert.equal((await owner.get(`/api/certificates/${publicId}`)).status, 200);
  });
});

test("C29, C30, C40 public verification is valid for issued, generic when unknown, and exposes no private fields", async () => {
  const { site, learnerA } = await setup("c29");
  await withSite(site, async (api) => {
    const learner = await tierOneLearner(site, api);
    const issued = await claim(learner, 1);
    const publicId = issued.json.data.certificate.id;
    const valid = await api.get(`/api/public/certificates/verify/${publicId}`);
    assert.equal(valid.status, 200);
    assert.equal(valid.json.data.valid, true);
    assert.equal(valid.json.data.status, "issued");
    assert.equal(valid.json.data.holderName.includes("Peserta Uji"), false, "the holder name is masked");
    assert.ok(valid.json.data.holderName.startsWith("Pe"));
    for (const forbidden of ["email", "user_id", "userId", "id", "academicGeneration", "evidence", "revocationReason", "peserta-a@example.test"]) {
      assert.equal(Object.keys(valid.json.data).includes(forbidden), false, `${forbidden} must not be public`);
    }
    assert.equal(valid.text.includes("peserta-a@example.test"), false);

    const unknown = await api.get("/api/public/certificates/verify/00000000000000000000000000000000");
    assert.equal(unknown.status, 404);
    assert.equal(unknown.json.error.code, "certificate_not_found");
    assert.equal(unknown.text.includes(String(learnerA)), false);
    const raw = await fetch(`http://127.0.0.1:${api.port}/api/public/certificates/verify/${publicId}`);
    assert.equal(raw.headers.get("cache-control"), "no-store");
  });
});

test("C31 a learner cannot revoke; C32 a verified admin can, with an audit trail", async () => {
  const { site } = await setup("c31");
  await withSite(site, async (api) => {
    const learner = await tierOneLearner(site, api);
    const issued = await claim(learner, 1);
    const publicId = issued.json.data.certificate.id;
    const refused = await learner.mutate("POST", `/api/admin/certificates/${publicId}/revoke`, { reason: "Percobaan sendiri", confirm: true });
    assert.equal(refused.status, 403);

    const admin = await signIn(api.port, "pengelola@example.test");
    const noReason = await admin.mutate("POST", `/api/admin/certificates/${publicId}/revoke`, { reason: "", confirm: true });
    assert.equal(noReason.status, 422);
    const noConfirm = await admin.mutate("POST", `/api/admin/certificates/${publicId}/revoke`, { reason: "Dokumen tidak sesuai" });
    assert.equal(noConfirm.status, 422);

    const revoked = await admin.mutate("POST", `/api/admin/certificates/${publicId}/revoke`, { reason: "Dokumen tidak sesuai", confirm: true });
    assert.equal(revoked.status, 200, revoked.text);
    assert.equal(revoked.json.data.certificate.status, "revoked");
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM security_audit_events WHERE event_type = 'admin.certificate_revoked'")[0].n), 1);
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM certificate_events WHERE event_type = 'certificate.revoked'")[0].n), 1);
  });
});

test("C33 a revoked certificate is publicly invalid, and still retained", async () => {
  const { site, learnerA } = await setup("c33");
  await withSite(site, async (api) => {
    const learner = await tierOneLearner(site, api);
    const publicId = (await claim(learner, 1)).json.data.certificate.id;
    const admin = await signIn(api.port, "pengelola@example.test");
    await admin.mutate("POST", `/api/admin/certificates/${publicId}/revoke`, { reason: "Dokumen tidak sesuai", confirm: true });
    const verify = await api.get(`/api/public/certificates/verify/${publicId}`);
    assert.equal(verify.json.data.valid, false);
    assert.equal(verify.json.data.status, "revoked");
    assert.equal(verify.json.data.revocationReason, undefined, "the private reason is not public");
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM certificate_issuances WHERE user_id = ?", [learnerA])[0].n), 1, "the row is kept");
    assert.equal((await claim(learner, 1)).status, 409, "a revoked tier is not reissued by a normal claim");
  });
});

test("C34 a repeated revocation has no duplicate side effects", async () => {
  const { site } = await setup("c34");
  await withSite(site, async (api) => {
    const learner = await tierOneLearner(site, api);
    const publicId = (await claim(learner, 1)).json.data.certificate.id;
    const admin = await signIn(api.port, "pengelola@example.test");
    await admin.mutate("POST", `/api/admin/certificates/${publicId}/revoke`, { reason: "Dokumen tidak sesuai", confirm: true });
    const second = await admin.mutate("POST", `/api/admin/certificates/${publicId}/revoke`, { reason: "Dokumen tidak sesuai", confirm: true });
    assert.equal(second.status, 200);
    assert.equal(second.json.data.alreadyRevoked, true);
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM certificate_events WHERE event_type = 'certificate.revoked'")[0].n), 1);
    assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM security_audit_events WHERE event_type = 'admin.certificate_revoked'")[0].n), 1);
  });
});

test("C35 a learner progress reset does not revoke or hide an issued certificate", async () => {
  const { site, learnerA } = await setup("c35");
  await withSite(site, async (api) => {
    const learner = await tierOneLearner(site, api);
    const publicId = (await claim(learner, 1)).json.data.certificate.id;
    const admin = await signIn(api.port, "pengelola@example.test");
    assert.equal((await admin.mutate("DELETE", `/api/admin/users/${learnerA}/progress`, { confirm: true })).status, 200);
    const verify = await api.get(`/api/public/certificates/verify/${publicId}`);
    assert.equal(verify.json.data.valid, true, "reset is not revocation");
    assert.equal((await learner.get(`/api/certificates/${publicId}`)).status, 200);
  });
});

test("C41/C42 migration on a populated database keeps every row and replays idempotently", async () => {
  const { site, learnerA } = await setup("c41");
  await withSite(site, async (api) => {
    const learner = await tierOneLearner(site, api);
    await claim(learner, 1);
  });
  sql(site, "INSERT INTO certificates (user_id, level_number, level_name, score, exam_type, holder_name, issued_at) VALUES (?, 3, 'Legacy', 90, 'level', 'Lama', '2026-01-05 00:00:00')", [learnerA]);
  const before = {
    attempts: Number(rows(site, "SELECT COUNT(*) AS n FROM assessment_attempts")[0].n),
    events: Number(rows(site, "SELECT COUNT(*) AS n FROM module_learning_events")[0].n),
    legacy: Number(rows(site, "SELECT COUNT(*) AS n FROM certificates")[0].n),
  };
  const first = run(site, join(repo, "database", "migrate.php"), ["--apply", "--verify", "--expect-environment=local"]);
  assert.equal(first.status, 0, first.stdout + first.stderr);
  assert.match(first.stdout, /Certification schema: present/);
  const second = run(site, join(repo, "database", "migrate.php"), ["--apply", "--verify", "--expect-environment=local"]);
  assert.equal(second.status, 0, second.stdout + second.stderr);

  assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM assessment_attempts")[0].n), before.attempts);
  assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM module_learning_events")[0].n), before.events);
  assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM certificates")[0].n), before.legacy, "legacy certificates are preserved");
  assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM certificate_issuances")[0].n), 1, "the verified issuance survives replay");
  assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM certificate_tier_policies WHERE policy_version = 'academy-v1'")[0].n), 6);
  assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM schema_migrations WHERE migration_key = ?", ["20261020_verified_certificates_v1"])[0].n), 1);
});

test("C43 the Q04 schema migration is additive: the generation column defaults existing rows to 1", async () => {
  const { site } = await setup("c43");
  assert.equal(Number(rows(site, "SELECT COUNT(*) AS n FROM assessment_attempts WHERE academic_generation IS NULL")[0].n), 0);
});

if (!process.env.AAPM_TEST_MYSQL_CONFIG) test("C50 MySQL concurrent issuance", { skip: "Default SQLite suite; actual native C20/C49/C50 issuance race runs through npm run test:q03-q04:mysql" }, () => {});
test("C47 and C48 mobile and desktop certificate workflow in a browser", { skip: "NOT_TESTED: no browser run was executed for Q04 in this session" }, () => {});
