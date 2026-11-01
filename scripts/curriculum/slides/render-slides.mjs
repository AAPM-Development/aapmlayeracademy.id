// Renders a slide deck's HTML source to the PNG files the lesson serves, one per <section class="slide">.
// Usage: node scripts/curriculum/slides/render-slides.mjs modul-01
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const browser = process.env.SLIDE_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const deck = process.argv[2];
if (!deck) throw new Error("Sebutkan nama dek, misalnya modul-01.");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const source = path.join(root, "scripts/curriculum/slides", deck, "slides.html");
const target = path.join(root, "public/assets/curriculum", deck);
const count = (fs.readFileSync(source, "utf8").match(/<section class="slide/g) || []).length;
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// Edge's launcher exits at once and the detached browser writes the file later, so wait for a finished file.
function waitForFile(file) {
  let size = -1;
  for (let tries = 0; tries < 100; tries += 1) {
    sleep(300);
    const next = fs.existsSync(file) ? fs.statSync(file).size : -1;
    if (next > 0 && next === size) return;
    size = next;
  }
  throw new Error(`${path.basename(file)} gagal dirender.`);
}

fs.mkdirSync(target, { recursive: true });
for (let index = 1; index <= count; index += 1) {
  const file = path.join(target, `slide-${String(index).padStart(2, "0")}.png`);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "slide-render-"));
  fs.rmSync(file, { force: true });
  execFileSync(browser, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--window-size=1920,1080", "--virtual-time-budget=3000", `--user-data-dir=${profile}`,
    `--screenshot=${file}`, `${pathToFileURL(source).href}#s${index}`,
  ], { stdio: "ignore" });
  waitForFile(file);
  console.log(path.relative(root, file), fs.statSync(file).size);
}
