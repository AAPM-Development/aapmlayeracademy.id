// A rejected sign-in answers 401 and is audited on every database driver.
// Real API under php -S; set AAPM_TEST_MYSQL_CONFIG to run it on MySQL.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Api, PASSWORD, cleanup, makeSite, repo, rows, seedAccount, signIn, withSite } from "./helpers/site.mjs";

after(cleanup);

const login = (api, email, password) => api.mutate("POST", "/api/auth/login", { email, password });

test("a wrong password or unknown email answers 401 and is audited", async () => {
  const site = makeSite("login-failure");
  const userId = seedAccount(site, { email: "peserta@example.test", verified: true });
  await withSite(site, async (api) => {
    const wrong = await login(api, "peserta@example.test", "Wrong-pass9");
    assert.equal(wrong.status, 401, wrong.text);
    assert.equal(wrong.json.error.code, "invalid_credentials");
    assert.equal(wrong.json.error.message, "Email atau kata sandi tidak sesuai.");

    const unknown = await login(new Api(api.port), "tidak-ada@example.test", "Wrong-pass9");
    assert.equal(unknown.status, 401, unknown.text);
    assert.equal(unknown.json.error.code, "invalid_credentials");

    const audit = rows(site, "SELECT target_user_id, result FROM security_audit_events WHERE event_type = 'auth.login_failure' ORDER BY id");
    assert.equal(audit.length, 2);
    assert.equal(Number(audit[0].target_user_id), userId);
    assert.equal(audit[1].target_user_id, null);

    await signIn(api.port, "peserta@example.test", PASSWORD);
  });
});

/** Arguments of each aapm_audit(...) call, split at top-level commas. */
function auditCalls(source) {
  const calls = [];
  for (let start = source.indexOf("aapm_audit("); start !== -1; start = source.indexOf("aapm_audit(", start + 1)) {
    if (/function\s+$/.test(source.slice(Math.max(0, start - 20), start))) continue;
    const args = [];
    let depth = 0;
    let current = "";
    for (let i = start + "aapm_audit(".length; i < source.length; i++) {
      const char = source[i];
      if (char === "(" || char === "[") depth++;
      if ((char === ")" || char === "]") && depth === 0) break;
      if (char === ")" || char === "]") depth--;
      if (char === "," && depth === 0) {
        args.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    args.push(current.trim());
    calls.push(args);
  }
  return calls;
}

test("every audit result literal fits the MySQL result column", () => {
  const ddl = readFileSync(join(repo, "public", "api", "security.php"), "utf8");
  const width = Number(ddl.match(/\bresult VARCHAR\((\d+)\)/)[1]);
  const files = [
    ...readdirSync(join(repo, "public", "api")).filter((name) => name.endsWith(".php")).map((name) => join(repo, "public", "api", name)),
    ...["maintenance", "security"].flatMap((dir) =>
      readdirSync(join(repo, "scripts", dir)).filter((name) => name.endsWith(".php")).map((name) => join(repo, "scripts", dir, name))
    ),
  ];
  const results = new Set();
  for (const file of files) {
    for (const args of auditCalls(readFileSync(file, "utf8"))) {
      for (const [, value] of (args[1] ?? "").matchAll(/'([^']*)'/g)) results.add(value);
    }
  }
  assert.ok(results.has("ok") && results.has("delivery_failed"), "the scan found the audit calls");
  for (const value of results) assert.ok(value.length <= width, `${value} is longer than VARCHAR(${width})`);
});
