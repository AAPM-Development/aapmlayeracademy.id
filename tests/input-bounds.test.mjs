// Input that MySQL strict mode cannot store is refused with 422, not 500.
// SQLite stores anything; set AAPM_TEST_MYSQL_CONFIG to run this on MySQL.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { Api, PASSWORD, cleanup, makeSite, repo, rows, run, seedAccount, setup, signIn, withSite } from "./helpers/site.mjs";

after(cleanup);

// 197 characters; FILTER_VALIDATE_EMAIL accepts it, users.email holds 190.
const LONG_EMAIL = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.test`;
// Exactly 190 characters.
const LONGEST_EMAIL = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(56)}.test`;
const TOO_LONG = "Alamat email terlalu panjang. Gunakan paling banyak 190 karakter.";

const register = (api, email, fullName = "Peserta Baru") => api.mutate("POST", "/api/auth/register", { email, password: PASSWORD, fullName });
const googleProvision = (site, profile) => JSON.parse(run(site, join(repo, "tests/fixtures/q05/google-provision.php"), [JSON.stringify(profile)]).stdout);

test("an email longer than the users column is refused at registration, admin create and Google sign-in", async () => {
  const site = makeSite("email-length");
  seedAccount(site, { email: "pengelola@example.test", role: "super_admin", verified: true });
  await withSite(site, async (api) => {
    const registered = await register(api, LONG_EMAIL);
    assert.equal(registered.status, 422, registered.text);
    assert.equal(registered.json.error.code, "validation_error");
    assert.equal(registered.json.error.message, TOO_LONG);

    const admin = await signIn(api.port, "pengelola@example.test");
    const created = await admin.mutate("POST", "/api/admin/users", { email: LONG_EMAIL, password: PASSWORD, fullName: "Nama Pengguna", role: "learner" });
    assert.equal(created.status, 422, created.text);
    assert.equal(created.json.error.message, TOO_LONG);

    assert.deepEqual(googleProvision(site, { email: LONG_EMAIL, email_verified: true, name: "Pengguna Google" }), { rejected: true });

    // Sign-in only reads the column: a long address is answered like any unknown one.
    const login = (email) => new Api(api.port).mutate("POST", "/api/auth/login", { email, password: PASSWORD });
    const [long, unknown] = [await login(LONG_EMAIL), await login("tidak-ada@example.test")];
    assert.equal(long.status, unknown.status, long.text);
    assert.equal(long.json.error.code, unknown.json.error.code);

    const longest = await register(new Api(api.port), LONGEST_EMAIL);
    assert.equal(longest.status, 202, longest.text);
    assert.equal(rows(site, "SELECT COUNT(*) AS n FROM users WHERE email = ?", [LONGEST_EMAIL])[0].n, 1);
    assert.equal(rows(site, "SELECT COUNT(*) AS n FROM users WHERE email = ?", [LONG_EMAIL])[0].n, 0);
  });
});

// The limit falls inside a four-byte character when counted in bytes.
const chicken = "\u{1F414}";
const cut = (limit) => ({ sent: `${"a".repeat(limit - 2)}${chicken}bbbb`, kept: `${"a".repeat(limit - 2)}${chicken}b` });

test("a name or bio at its limit keeps whole characters", async () => {
  const site = makeSite("utf8-cut");
  seedAccount(site, { email: "peserta@example.test", verified: true });
  const name = cut(160);
  const bio = cut(600);
  await withSite(site, async (api) => {
    const registered = await register(api, "baru@example.test", name.sent);
    assert.equal(registered.status, 202, registered.text);
    assert.equal(rows(site, "SELECT full_name FROM users WHERE email = 'baru@example.test'")[0].full_name, name.kept);

    const learner = await signIn(api.port, "peserta@example.test");
    const saved = await learner.mutate("PUT", "/api/profile", { fullName: name.sent, bio: bio.sent });
    assert.equal(saved.status, 200, saved.text);
    const stored = rows(site, "SELECT u.full_name, p.bio FROM users u JOIN user_profiles p ON p.user_id = u.id WHERE u.email = 'peserta@example.test'")[0];
    assert.equal(stored.full_name, name.kept);
    assert.equal(stored.bio, bio.kept);

    const google = googleProvision(site, { email: "google@example.test", email_verified: true, name: name.sent });
    assert.ok(google.userId > 0, JSON.stringify(google));
    assert.equal(rows(site, "SELECT full_name FROM users WHERE id = ?", [google.userId])[0].full_name, name.kept);
  });
});

test("a farm number outside its column is refused and the column's own maximum is kept", async () => {
  const site = makeSite("farm-numbers");
  seedAccount(site, { email: "peserta@example.test", verified: true });
  await withSite(site, async (api) => {
    const learner = await signIn(api.port, "peserta@example.test");
    const save = (fields) => learner.mutate("POST", "/api/farm-data", { week: 30, ...fields });
    for (const [fields, message] of [
      [{ week: 70000 }, "Umur ayam (minggu) terlalu besar."],
      [{ henDayProduction: 100000 }, "Angka HDP di luar batas. Periksa kembali isiannya."],
      [{ henDayProduction: 99999.9996 }, "Angka HDP di luar batas. Periksa kembali isiannya."],
      [{ feedIntake: 1e7 }, "Angka Asupan pakan di luar batas. Periksa kembali isiannya."],
      [{ temperature: -100000 }, "Angka Suhu di luar batas. Periksa kembali isiannya."],
      [{ revenue: "1e400" }, "Angka Pendapatan di luar batas. Periksa kembali isiannya."],
      [{ cost: 1e16 }, "Angka Biaya di luar batas. Periksa kembali isiannya."],
    ]) {
      const refused = await save(fields);
      assert.equal(refused.status, 422, `${JSON.stringify(fields)}: ${refused.text}`);
      assert.equal(refused.json.error.code, "validation_error");
      assert.equal(refused.json.error.message, message);
    }
    assert.equal(rows(site, "SELECT COUNT(*) AS n FROM farm_data")[0].n, 0);

    const kept = await save({ week: 65535, henDayProduction: 99999.999, feedIntake: 9999999.999, temperature: -99999.999, revenue: 50400000 });
    assert.equal(kept.status, 201, kept.text);
    const row = rows(site, "SELECT week, hen_day_production, feed_intake, temperature, revenue FROM farm_data")[0];
    assert.equal(Number(row.week), 65535);
    assert.equal(Number(row.hen_day_production), 99999.999);
    assert.equal(Number(row.feed_intake), 9999999.999);
    assert.equal(Number(row.temperature), -99999.999);
    assert.equal(Number(row.revenue), 50400000);
  });
});

test("an admin threshold, tier number or module order outside its column is refused", async () => {
  const { site } = await setup("admin-numbers");
  await withSite(site, async (api) => {
    const admin = await signIn(api.port, "pengelola@example.test");
    assert.equal((await admin.mutate("POST", "/api/admin/curriculum/policies", { version: "academy-v2" })).status, 201);
    const policy = (await admin.get("/api/admin/curriculum/policies/academy-v2")).json.data.policy;
    const body = {
      modules: Array.from({ length: 22 }, (_, index) => ({ moduleNumber: index + 1, required: true, assessmentMode: "quiz" })),
      modulePassPercent: 70,
      finalPassPercent: 80,
      tiers: [{ tierNumber: 1, tierName: "Tingkat Satu", modules: [1], requiresFinal: false }],
      expectedDraftVersion: policy.draftVersion,
    };
    // The same bounds the readiness check applies: thresholds 50-100, tiers 1-6.
    for (const [change, message] of [
      [{ modulePassPercent: 300 }, "Ambang kelulusan harus antara 50 dan 100."],
      [{ finalPassPercent: -1 }, "Ambang kelulusan harus antara 50 dan 100."],
      [{ finalPassPercent: 150 }, "Ambang kelulusan harus antara 50 dan 100."],
      [{ tiers: [{ ...body.tiers[0], tierNumber: 300 }] }, "Nomor tingkat sertifikat harus 1 sampai 6."],
      [{ tiers: [{ ...body.tiers[0], tierNumber: 0 }] }, "Nomor tingkat sertifikat harus 1 sampai 6."],
    ]) {
      const refused = await admin.mutate("PUT", "/api/admin/curriculum/policies/academy-v2", { ...body, ...change });
      assert.equal(refused.status, 422, `${JSON.stringify(change)}: ${refused.text}`);
      assert.equal(refused.json.error.message, message);
    }
    const saved = await admin.mutate("PUT", "/api/admin/curriculum/policies/academy-v2", { ...body, modulePassPercent: 50, finalPassPercent: 100, tiers: [{ ...body.tiers[0], tierNumber: 6 }] });
    assert.equal(saved.status, 200, saved.text);
    assert.deepEqual(rows(site, "SELECT module_pass_percent AS m, final_pass_percent AS f FROM assessment_policies WHERE policy_version = 'academy-v2'").map((row) => [Number(row.m), Number(row.f)]), [[50, 100]]);

    const levelName = rows(site, "SELECT level_name FROM course_modules WHERE level_number = 1 LIMIT 1")[0].level_name;
    const module = { levelNumber: 1, levelName, moduleNumber: 200, title: "Modul Baru", content: "Materi baru", learningObjectives: [], keyTakeaways: [], checklist: [] };
    const refused = await admin.mutate("POST", "/api/admin/modules", { ...module, sortOrder: 70000 });
    assert.equal(refused.status, 422, refused.text);
    assert.equal(refused.json.error.message, "Urutan roadmap terlalu besar.");
    const created = await admin.mutate("POST", "/api/admin/modules", { ...module, sortOrder: 65535 });
    assert.equal(created.status, 201, created.text);
    assert.equal(Number(rows(site, "SELECT sort_order FROM course_modules WHERE module_number = 200")[0].sort_order), 65535);
  });
});
