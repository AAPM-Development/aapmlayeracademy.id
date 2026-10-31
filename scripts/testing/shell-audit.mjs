#!/usr/bin/env node
// Browser audit of every shell across a desktop and phone matrix. It finds what static
// tests cannot: overflow, chrome covering content, double scroll, missing landmarks,
// small targets, and navigation that cannot be reached.
//
// Run the local app first, then:
//   AUDIT_EMAIL=... AUDIT_PASSWORD=... npm run audit:shell
// Optional: AUDIT_ORIGIN, AUDIT_CHROME, --routes /a,/b, --viewports 390x844,1280x900, --out report.json
// Exit 1 when a page breaks an invariant. Needs Node 22+ and an installed Chrome.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ORIGIN = process.env.AUDIT_ORIGIN || "http://localhost:5173";
const CHROME = [process.env.AUDIT_CHROME, "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((path) => path && existsSync(path));
if (!CHROME) throw new Error("Chrome not found; set AUDIT_CHROME.");
if (!process.env.AUDIT_EMAIL || !process.env.AUDIT_PASSWORD) throw new Error("Set AUDIT_EMAIL and AUDIT_PASSWORD to a local admin account.");
const creds = { email: process.env.AUDIT_EMAIL, password: process.env.AUDIT_PASSWORD };
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1].split(",") : fallback; };
const out = arg("--out", [null])[0];
const C = "/admin/courses/layer-farm-management";
const ROUTES = arg("--routes", ["/", "/modules", "/modules/19", "/modules/1", "/quiz/19", "/final-exam", "/calculators", "/kpi", "/ai-assistant", "/certification", "/profile", "/profile/settings", "/admin", "/admin/courses", C, C + "/modules/19", "/admin/learners", "/admin/users", "/admin/curriculum/policies", "/admin/curriculum/final-bank", "/admin/ai-settings", "/admin/workspace-status", "/halaman-tidak-ada"]);
const VIEWPORTS = arg("--viewports", ["320x568", "390x844", "844x390", "600x960", "768x1024", "860x900", "861x900", "1024x768", "1280x720", "1440x900", "1920x1080"]);

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(url) { this.ws = new WebSocket(url); this.id = 0; this.wait = new Map(); this.ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && this.wait.has(d.id)) { const { ok, no } = this.wait.get(d.id); this.wait.delete(d.id); d.error ? no(new Error(d.error.message)) : ok(d.result); } }; }
  open() { return new Promise((ok, no) => { this.ws.onopen = ok; this.ws.onerror = no; }); }
  send(method, params = {}, sessionId) { const id = ++this.id; return new Promise((ok, no) => { this.wait.set(id, { ok, no }); this.ws.send(JSON.stringify({ id, method, params, sessionId })); }); }
}

const PROBE = String.raw`(() => {
  const V = { w: innerWidth, h: innerHeight };
  const vis = (e) => { if (!e) return false; const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.display !== "none" && s.visibility !== "hidden" && +s.opacity !== 0 && r.width > 0 && r.height > 0; };
  const rect = (e) => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; };
  const name = (e) => (e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (typeof e.className === "string" && e.className ? "." + e.className.trim().split(/\s+/).slice(0, 3).join(".") : "")).slice(0, 70);
  const issues = [];
  const add = (key, detail) => issues.push({ key, detail });
  const q = (s) => document.querySelector(s);
  const shell = q(".focus") ? "focus" : q(".app") ? (q('.app[data-tone="calm"]') ? "admin" : "learner") : q(".auth") ? "auth" : "bare";
  const scroller = q("#aapm-main") || q("#aapm-focus-main") || q(".aapm-editor-canvas") || document.scrollingElement;
  const root = document.documentElement;

  if (root.scrollWidth > V.w + 1) add("page-overflow-x", root.scrollWidth - V.w);
  if (scroller && scroller.scrollWidth > scroller.clientWidth + 1 && getComputedStyle(scroller).overflowX !== "hidden") add("main-overflow-x", scroller.scrollWidth - scroller.clientWidth);
  if (shell !== "bare" && shell !== "auth" && root.scrollHeight > V.h + 1 && scroller !== document.scrollingElement && scroller.scrollHeight > scroller.clientHeight + 1) add("double-scroll", root.scrollHeight - V.h);
  // Clipped content inside the scroll owner: a child wider than the owner hidden by overflow-x:hidden.
  if (scroller && scroller !== document.scrollingElement) { const sr = scroller.getBoundingClientRect(); let worst = null; scroller.querySelectorAll("h1,h2,h3,p,a,button,input,select,textarea,table,img,.card").forEach((e) => { if (!vis(e) || e.closest("[data-audit-ignore],.scroll-x,.tabs,.table-wrap,pre")) return; let p = e.parentElement, scrolled = false; while (p && p !== scroller) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll" || o === "hidden") { scrolled = true; break; } p = p.parentElement; } if (scrolled) return; const r = e.getBoundingClientRect(); const over = r.right - sr.right; if (over > 1 && (!worst || over > worst.over)) worst = { over: Math.round(over), el: name(e) }; }); if (worst) add("content-clipped-x", worst); }

  const chrome = { side: q(".app > .side"), topbar: q(".app .topbar"), mtop: q(".app .m-top"), mnav: q(".app .m-nav"), launcher: q(".launcher-fixed, .app .launcher"), bar: q(".focus-bar"), foot: q(".focus-foot"), actionbar: q(".aapm-curriculum-actionbar"), editbar: q(".aapm-editor-actionbar") };
  if (shell === "learner" || shell === "admin") {
    const phone = V.w <= 860;
    if (phone !== vis(chrome.mnav)) add("mnav-breakpoint", { phone, mnav: vis(chrome.mnav) });
    if (phone === vis(chrome.side)) add("side-breakpoint", { phone, side: vis(chrome.side) });
    if (phone === vis(chrome.topbar)) add("topbar-breakpoint", { phone });
    if (phone !== vis(chrome.mtop)) add("mtop-breakpoint", { phone });
    if (!vis(chrome.side) && !vis(chrome.mnav)) add("no-navigation", null);
  }
  // Bars: direct children must not collide or leave the window.
  for (const [label, bar] of [["topbar", chrome.topbar], ["mtop", chrome.mtop], ["focus-bar", chrome.bar], ["focus-foot", chrome.foot], ["editor-bar", chrome.editbar]]) {
    if (!vis(bar)) continue;
    const kids = [...bar.children].filter(vis);
    const br = bar.getBoundingClientRect();
    if (br.right > V.w + 1 || br.left < -1) add(label + "-off-window", rect(bar));
    kids.forEach((k) => { const r = k.getBoundingClientRect(); if (r.right > br.right + 1 || r.left < br.left - 1) add(label + "-child-spill", name(k)); });
    for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) { const a = kids[i].getBoundingClientRect(), b = kids[j].getBoundingClientRect(); const x = Math.min(a.right, b.right) - Math.max(a.left, b.left), y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (x > 1 && y > 1) add(label + "-collision", name(kids[i]) + " × " + name(kids[j]) + " " + Math.round(x)); }
    bar.querySelectorAll("a,button").forEach((c) => { if (!vis(c)) return; const r = c.getBoundingClientRect(); if (r.right > V.w + 1 || r.left < -1 || r.bottom > V.h + 1) add(label + "-control-off-window", name(c)); });
    if (bar.scrollWidth > bar.clientWidth + 1 && getComputedStyle(bar).overflowX === "visible") add(label + "-overflow", bar.scrollWidth - bar.clientWidth);
  }
  // Overlap between floating chrome pieces.
  const floats = [["launcher", chrome.launcher], ["mnav", chrome.mnav], ["foot", chrome.foot], ["actionbar", chrome.actionbar], ["editbar", chrome.editbar], ["calc-dock", q(".calc-dock")]].filter(([, e]) => vis(e) && ["fixed", "sticky", "absolute"].includes(getComputedStyle(e).position));
  for (let i = 0; i < floats.length; i++) for (let j = i + 1; j < floats.length; j++) { const a = floats[i][1].getBoundingClientRect(), b = floats[j][1].getBoundingClientRect(); const x = Math.min(a.right, b.right) - Math.max(a.left, b.left), y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (x > 1 && y > 1) add("float-overlap", floats[i][0] + "×" + floats[j][0] + " " + Math.round(x) + "×" + Math.round(y)); }
  // Vertical room left for content.
  if (scroller && scroller !== document.scrollingElement && vis(scroller)) {
    const sr = scroller.getBoundingClientRect();
    let top = Math.max(0, sr.top), bottom = Math.min(V.h, sr.bottom);
    for (const e of [chrome.mnav, chrome.foot, chrome.editbar, chrome.actionbar]) if (vis(e) && getComputedStyle(e).position === "fixed") { bottom = Math.min(bottom, e.getBoundingClientRect().top); }
    const room = bottom - top;
    if (room < V.h * 0.5 || room < 200) add("content-room-small", { room: Math.round(room), of: V.h });
    // After scrolling to the end, the last real content must clear fixed chrome.
    scroller.scrollTop = scroller.scrollHeight;
    const items = [...scroller.querySelectorAll("a,button,input,select,textarea,h2,h3,p,li,td,.card")].filter((e) => vis(e) && !e.closest(".m-nav,.launcher,.aapm-curriculum-actionbar,details:not([open]),.aapm-ai-workspace"));
    const last = items.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
    if (last) { const b = last.getBoundingClientRect().bottom; if (b > bottom + 1 && getComputedStyle(scroller).overflowY !== "visible") add("last-content-covered", { by: Math.round(b - bottom), el: name(last) }); }
    scroller.scrollTop = 0;
  }
  // Every route names its own tab; the static title is the index.html default.
  if (shell !== "bare" && document.title.includes("Pelatihan Profesional")) add("title-default", location.pathname);
  // Landmarks and headings.
  const h1 = [...document.querySelectorAll("h1")].filter(vis);
  if (h1.length !== 1 && shell !== "bare") add("h1-count", h1.length);
  if (chrome.launcher && vis(chrome.launcher)) { const l = chrome.launcher.getBoundingClientRect(); const top = document.elementFromPoint(l.left + l.width / 2, l.top + l.height / 2); if (top && !chrome.launcher.contains(top) && top.closest('.aapm-curriculum-actionbar,.m-nav')) add('launcher-behind-bar', name(top)); }
  const mains = [...document.querySelectorAll("main")].filter(vis); if (mains.length !== 1) add("main-count", mains.length);
  // Chrome target sizes.
  const coarse = V.w <= 860;
  for (const bar of [chrome.mtop, chrome.mnav, chrome.bar, chrome.foot, chrome.topbar, chrome.side]) { if (!vis(bar)) continue; bar.querySelectorAll("a,button,[role=tab]").forEach((c) => { if (!vis(c) || c.closest(".aapm-skip-link")) return; const r = c.getBoundingClientRect(); const min = coarse ? 40 : 24; if (r.height < min - 0.5 || r.width < min - 0.5) add("chrome-target-small", name(c) + " " + Math.round(r.width) + "×" + Math.round(r.height)); }); }
  return { shell, h: V.h, w: V.w, issues };
})()`;

const BOOT = `(() => { const c = document.documentElement; return document.readyState === "complete" && !!document.querySelector("#root > *") && !document.querySelector('[aria-busy="true"]'); })()`;

const chromeProfile = mkdtempSync(join(tmpdir(), "shell-audit-"));
const proc = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${chromeProfile}`, "--no-first-run", "--disable-extensions", "--disable-gpu", "--mute-audio", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
const wsUrl = await new Promise((ok, no) => { let s = ""; proc.stderr.on("data", (d) => { s += d; const m = /DevTools listening on (ws:\S+)/.exec(s); if (m) ok(m[1]); }); setTimeout(() => no(new Error("no devtools")), 20000); });
const cdp = new CDP(wsUrl); await cdp.open();
const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
const { sessionId: sid } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
await cdp.send("Page.enable", {}, sid); await cdp.send("Runtime.enable", {}, sid);
const evaluate = async (expression) => { const r = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sid); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.slice(0, 200) || "eval"); return r.result.value; };

await cdp.send("Page.navigate", { url: ORIGIN + "/login" }, sid); await delay(5000);
const login = await evaluate(`(async () => { const c = await fetch("/api/auth/csrf", { credentials: "include" }).then((r) => r.json()); const r = await fetch("/api/auth/login", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Token": c.data?.csrfToken }, body: ${JSON.stringify(JSON.stringify(creds))} }); return r.status; })()`);
console.error("login", login);

const results = [];
for (const vp of VIEWPORTS) {
  const [w, h] = vp.split("x").map(Number);
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: Math.min(w, h) <= 860 && w <= 860 }, sid);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: w <= 860 }, sid);
  for (const route of ROUTES) {
    try {
      await cdp.send("Page.navigate", { url: ORIGIN + route }, sid);
      for (let i = 0; i < 30; i++) { await delay(150); if (await evaluate(BOOT).catch(() => false)) break; }
      await delay(900);
      const r = await evaluate(PROBE);
      results.push({ vp, route, ...r });
    } catch (e) { results.push({ vp, route, error: e.message }); }
  }
  process.stderr.write(`${vp} done\n`);
}
// Sheets must scroll to their last item on short screens.
for (const [w, h] of [[844, 390], [320, 568]]) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: true }, sid);
  await cdp.send("Page.navigate", { url: ORIGIN + "/admin" }, sid);
  await delay(2200);
  await evaluate(`[...document.querySelectorAll(".m-nav button")].find((b) => /Menu/.test(b.innerText))?.click()`);
  await delay(700);
  const reach = await evaluate(`(() => { const d = document.querySelector('[role="dialog"]'); const b = d?.querySelector(".side-body"); if (b) b.scrollTop = b.scrollHeight; const links = [...(d?.querySelectorAll("a") || [])]; const last = links[links.length - 1]?.getBoundingClientRect(); return { found: links.length, bottom: last?.bottom ?? 0 }; })()`);
  const issues = !reach.found || reach.bottom > h + 1 ? [{ key: "sheet-unreachable", detail: reach }] : [];
  results.push({ vp: `${w}x${h}`, route: "/admin (sheet)", shell: "admin", issues });
}
const failed = results.filter((item) => item.error || item.issues?.length);
for (const item of failed) console.log(`${item.vp} ${item.route}: ${item.error || item.issues.map((issue) => `${issue.key} ${typeof issue.detail === "object" ? JSON.stringify(issue.detail) : issue.detail ?? ""}`).join("; ")}`);
console.log(`${results.length - failed.length} of ${results.length} pages clean`);
if (out) writeFileSync(out, JSON.stringify(results));
process.exitCode = failed.length ? 1 : 0;
await cdp.send("Browser.close").catch(() => {});
setTimeout(() => { try { proc.kill(); } catch {} try { rmSync(chromeProfile, { recursive: true, force: true }); } catch {} process.exit(process.exitCode); }, 600);
