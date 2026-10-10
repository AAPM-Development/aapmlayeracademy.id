import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { bindNativeVideo, createYouTubeSession, loadYouTubeApi, mediaTime, YOUTUBE_API_URL } from "../src/lib/lessonVideo.js";
import { trustedVideoSource } from "../src/lib/lessonVideoSource.js";

test("lesson URLs preserve privacy hashes and provider IDs without trusting arbitrary embed hosts", () => {
  const cases = [
    ['https://vimeo.com/123456789/abcdef0123', 'Vimeo', 'https://player.vimeo.com/video/123456789?h=abcdef0123'],
    ['https://player.vimeo.com/video/123456789?h=abcdef0123', 'Vimeo', 'https://player.vimeo.com/video/123456789?h=abcdef0123'],
    ['https://drive.google.com/file/d/Abcdefghij_123/view?usp=sharing', 'Google Drive', 'https://drive.google.com/file/d/Abcdefghij_123/preview'],
    ['https://drive.google.com/open?id=Abcdefghij_123', 'Google Drive', 'https://drive.google.com/file/d/Abcdefghij_123/preview'],
    ['https://www.loom.com/share/0123456789abcdef0123456789abcdef', 'Loom', 'https://www.loom.com/embed/0123456789abcdef0123456789abcdef'],
    ['https://geo.dailymotion.com/player/x8lr5.html?video=x84sh87&autoplay=1', 'Dailymotion', 'https://geo.dailymotion.com/player/x8lr5.html?video=x84sh87'],
  ];
  for (const [url, provider, src] of cases) assert.deepEqual(trustedVideoSource(url), { kind: 'embed', provider, src });
  assert.deepEqual(trustedVideoSource('https://dai.ly/x84sh87'), { kind: 'link', provider: 'Dailymotion', src: 'https://www.dailymotion.com/video/x84sh87' });
  assert.deepEqual(trustedVideoSource('/uploads/editorial/videos/2026/10/example.mp4'), { kind: 'file', src: '/uploads/editorial/videos/2026/10/example.mp4' });
  for (const url of ['http://vimeo.com/123456789', 'https://user:pass@vimeo.com/123456789', 'https://drive.google.com/drive/folders/Abcdefghij_123', 'https://geo.dailymotion.com/player.html?video=x84sh87', 'https://loom.com/share/0123456789abcdef', 'https://vimeo.com.evil.example/123456789', '//example.com/video.mp4', '/uploads/%2e%2e/api/video.mp4', '/uploads/%5cvideo.mp4', '/uploads/%zz/video.mp4', 'javascript:alert(1)']) assert.equal(trustedVideoSource(url), null, url);
});

test("editorial video validation accepts the shipped MP4 and refuses disguised, truncated and Matroska files", (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'academy-video-validation-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const php = fileURLToPath(new URL('../public/api/editorialMedia.php', import.meta.url));
  const code = 'function error_response($message, $status = 500, $code = "error") { throw new RuntimeException($code); } require $argv[1]; try { echo json_encode(editorial_video_details($argv[2])); } catch (RuntimeException $e) { echo json_encode(["error" => $e->getMessage()]); }';
  const inspect = (path) => {
    const result = spawnSync('php', ['-r', code, php, path], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  assert.deepEqual(inspect(fileURLToPath(new URL('../public/assets/Video-Web_3.mp4', import.meta.url))), { mime: 'video/mp4', extension: 'mp4' });
  for (const [name, content] of [['fake.mp4', Buffer.from('<?php echo "fake video";')], ['truncated.mp4', Buffer.from('000000206674797069736f6d', 'hex')], ['matroska.webm', Buffer.from('1a45dfa38b4282886d6174726f736b61', 'hex')]]) {
    const file = join(dir, name);
    writeFileSync(file, content);
    assert.deepEqual(inspect(file), { error: 'invalid_video_type' }, name);
  }
});

const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function environment() {
  let id = 0;
  const timers = new Map();
  const intervals = new Map();
  const scripts = [];
  const win = {
    location: { origin: "http://127.0.0.1:4174" },
    setTimeout: (fn) => { timers.set(++id, fn); return id; },
    clearTimeout: (key) => timers.delete(key),
    setInterval: (fn) => { intervals.set(++id, fn); return id; },
    clearInterval: (key) => intervals.delete(key),
  };
  const element = () => {
    const target = new EventTarget();
    target.children = [];
    target.appendChild = (child) => target.children.push(child);
    target.replaceChildren = () => { target.children = []; };
    target.setAttribute = (key, value) => { target[key] = value; };
    target.remove = () => { const index = scripts.indexOf(target); if (index >= 0) scripts.splice(index, 1); };
    return target;
  };
  const doc = { createElement: element, head: { appendChild: (script) => scripts.push(script) }, querySelector: () => scripts.find((script) => script.src === YOUTUBE_API_URL) };
  return { win, doc, timers, intervals, scripts, element };
}

test("YouTube loader shares one official script/promise and preserves an existing ready callback", async () => {
  const env = environment();
  let called = 0;
  const previous = () => called++;
  env.win.onYouTubeIframeAPIReady = previous;
  const first = loadYouTubeApi(env.win, env.doc);
  const second = loadYouTubeApi(env.win, env.doc);
  assert.equal(first, second);
  assert.equal(env.scripts.length, 1);
  assert.equal(env.scripts[0].src, YOUTUBE_API_URL);
  env.win.YT = { Player: function Player() {} };
  env.win.onYouTubeIframeAPIReady();
  assert.equal(await first, env.win.YT);
  assert.equal(called, 1);
  assert.equal(env.win.onYouTubeIframeAPIReady, previous);
  assert.equal(env.timers.size, 0);
});

test("YouTube loader network failure cleans owned script and permits a fresh retry", async () => {
  const env = environment();
  const first = loadYouTubeApi(env.win, env.doc);
  const rejected = assert.rejects(first, /tidak dapat dimuat/);
  env.scripts[0].dispatchEvent(new Event("error"));
  await rejected;
  assert.equal(env.scripts.length, 0);
  assert.equal(env.timers.size, 0);
  const retry = loadYouTubeApi(env.win, env.doc);
  assert.notEqual(first, retry);
  env.win.YT = { Player: function Player() {} };
  env.win.onYouTubeIframeAPIReady();
  await retry;
});

test("YouTube loader timeout releases callback without removing another embed's script", async () => {
  const env = environment();
  const external = env.element();
  external.src = YOUTUBE_API_URL;
  env.scripts.push(external);
  const previous = () => {};
  env.win.onYouTubeIframeAPIReady = previous;
  const pending = loadYouTubeApi(env.win, env.doc, 1);
  const rejected = assert.rejects(pending, /tidak dapat dimuat/);
  [...env.timers.values()][0]();
  await rejected;
  assert.equal(env.win.onYouTubeIframeAPIReady, previous);
  assert.equal(env.scripts[0], external);
  const retry = loadYouTubeApi(env.win, env.doc);
  env.win.YT = { Player: function Player() {} };
  env.win.onYouTubeIframeAPIReady();
  await retry;
});

function youtubeFixture(env) {
  const players = [];
  class Player {
    constructor(target, options) { this.options = options; this.target = target; this.state = -1; this.current = 0; this.duration = 120; this.muted = false; this.volume = 100; this.iframe = env.element(); this.destroyed = 0; players.push(this); }
    getPlayerState() { return this.state; }
    getCurrentTime() { return this.current; }
    getDuration() { return this.duration; }
    isMuted() { return this.muted; }
    getVolume() { return this.volume; }
    getIframe() { return this.iframe; }
    playVideo() { this.playRequested = true; }
    pauseVideo() { this.pauseRequested = true; }
    seekTo(time) { this.current = time; }
    mute() { this.muted = true; }
    unMute() { this.muted = false; }
    setVolume(value) { this.volume = value; }
    destroy() { this.destroyed++; }
    ready() { this.options.events.onReady({ target: this }); }
    emit(state) { this.state = state; this.options.events.onStateChange({ data: state, target: this }); }
  }
  return { api: { Player }, players };
}

test("YouTube session uses nocookie, exact origin and minimal supported parameters; controls follow API events", async () => {
  const env = environment();
  const fixture = youtubeFixture(env);
  const updates = [];
  const session = createYouTubeSession({ ...env, mount: env.element(), videoId: "M7lc1UVf-VE", title: "Materi", loadApi: async () => fixture.api, onUpdate: (state) => updates.push(state), onError: assert.fail });
  await flush();
  const player = fixture.players[0];
  assert.equal(player.options.host, "https://www.youtube-nocookie.com");
  assert.deepEqual(player.options.playerVars, { controls: 0, playsinline: 1, rel: 0, enablejsapi: 1, origin: env.win.location.origin });
  assert.equal(player.playRequested, undefined, "loading cannot autoplay");
  player.ready();
  assert.equal(player.iframe.title, "Materi");
  assert.equal(updates.at(-1).playing, false);
  session.play();
  assert.equal(updates.at(-1).playing, false, "a requested play is not evidence of playback");
  player.emit(1);
  assert.equal(updates.at(-1).playing, true);
  session.pause();
  player.emit(2);
  assert.equal(updates.at(-1).playing, false);
  session.seek(50);
  [...env.intervals.values()][0]();
  assert.equal(updates.at(-1).current, 50);
  session.mute();
  assert.equal(updates.at(-1).muted, true);
  session.volume(.4);
  assert.equal(updates.at(-1).volume, .4);
  assert.equal(updates.at(-1).muted, false);
  player.emit(0);
  assert.equal(updates.at(-1).ended, true);
  session.destroy();
  assert.equal(player.destroyed, 1);
  assert.equal(env.intervals.size, 0);
  assert.equal(env.timers.size, 0);
});

test("StrictMode cleanup / source replacement ignore late API responses and old player events", async () => {
  const env = environment();
  const fixture = youtubeFixture(env);
  const mount = env.element();
  let resolveApi;
  let updates = 0;
  const first = createYouTubeSession({ ...env, mount, videoId: "old", loadApi: () => new Promise((resolve) => { resolveApi = resolve; }), onUpdate: () => updates++, onError: assert.fail });
  first.destroy();
  const second = createYouTubeSession({ ...env, mount, videoId: "new", title: "New", loadApi: async () => fixture.api, onUpdate: () => updates++, onError: assert.fail });
  resolveApi(fixture.api);
  await flush();
  assert.equal(fixture.players.length, 1, "disposed first mount must never instantiate");
  const player = fixture.players[0];
  assert.equal(player.options.videoId, "new");
  player.ready();
  second.destroy();
  const before = updates;
  player.emit(1);
  player.ready();
  assert.equal(updates, before);
  assert.equal(mount.children.length, 0);
  assert.equal(env.intervals.size, 0);
});

test("YouTube instance readiness timeout and provider errors stop polling and retain actionable feedback", async () => {
  const env = environment();
  const fixture = youtubeFixture(env);
  const errors = [];
  const session = createYouTubeSession({ ...env, mount: env.element(), videoId: "blocked", loadApi: async () => fixture.api, onUpdate: () => {}, onError: (message) => errors.push(message) });
  await flush();
  [...env.timers.values()][0]();
  assert.match(errors.at(-1), /belum siap.*buka di YouTube/);
  fixture.players[0].ready();
  assert.equal(env.intervals.size, 0, "readiness arriving after timeout cannot revive the failed instance");
  fixture.players[0].options.events.onError({ data: 150 });
  assert.match(errors.at(-1), /tidak dapat diputar.*buka di YouTube/);
  assert.equal(env.intervals.size, 0);
  session.destroy();
});

test("unmounted YouTube sessions suppress loader rejection feedback", async () => {
  const env = environment();
  let rejectApi;
  const session = createYouTubeSession({ ...env, mount: env.element(), videoId: "old", loadApi: () => new Promise((_resolve, reject) => { rejectApi = reject; }), onUpdate: assert.fail, onError: assert.fail });
  session.destroy();
  rejectApi(new Error("late failure"));
  await flush();
  assert.equal(env.timers.size, 0);
});

test("native adapter reports actual metadata, playing, waiting, seek, volume, end; cleanup detaches listeners", () => {
  const env = environment();
  const video = env.element();
  Object.assign(video, { readyState: 0, paused: true, ended: false, currentTime: 0, duration: NaN, muted: false, volume: 1, play() { return Promise.resolve(); }, pause() { this.paused = true; this.dispatchEvent(new Event("pause")); } });
  const updates = [];
  const adapter = bindNativeVideo(video, (state) => updates.push(state), assert.fail, env.win);
  video.readyState = 1;
  video.duration = 80;
  video.dispatchEvent(new Event("loadedmetadata"));
  assert.equal(updates.at(-1).duration, 80);
  assert.equal(env.timers.size, 0);
  adapter.play();
  assert.equal(updates.at(-1).playing, false);
  video.paused = false;
  video.dispatchEvent(new Event("playing"));
  assert.equal(updates.at(-1).playing, true);
  video.dispatchEvent(new Event("waiting"));
  assert.equal(updates.at(-1).loading, true);
  adapter.seek(200);
  video.dispatchEvent(new Event("timeupdate"));
  assert.equal(updates.at(-1).current, 80);
  adapter.volume(.3);
  video.dispatchEvent(new Event("volumechange"));
  assert.equal(updates.at(-1).volume, .3);
  video.ended = true;
  video.dispatchEvent(new Event("ended"));
  assert.equal(updates.at(-1).ended, true);
  const before = updates.length;
  adapter.destroy();
  video.dispatchEvent(new Event("playing"));
  assert.equal(updates.length, before);
});

test("native timeout/error and denied play are actionable; disposed play rejection stays silent", async () => {
  const env = environment();
  const video = env.element();
  let rejectPlay;
  Object.assign(video, { readyState: 0, paused: true, ended: false, currentTime: 0, duration: NaN, muted: false, volume: 1, play: () => new Promise((_resolve, reject) => { rejectPlay = reject; }), pause() {} });
  const errors = [];
  const adapter = bindNativeVideo(video, () => {}, (message) => errors.push(message), env.win);
  [...env.timers.values()][0]();
  assert.match(errors.at(-1), /buka file video/);
  video.dispatchEvent(new Event("error"));
  adapter.play();
  rejectPlay(new Error("blocked"));
  await flush();
  assert.match(errors.at(-1), /diblokir browser/);
  adapter.play();
  adapter.destroy();
  const before = errors.length;
  rejectPlay(new Error("late"));
  await flush();
  assert.equal(errors.length, before);
});

test("timestamps normalize missing metadata, and phone video viewport respects YouTube's 200px minimum", async () => {
  assert.equal(mediaTime(NaN), "0:00");
  assert.equal(mediaTime(Infinity), "0:00");
  assert.equal(mediaTime(61.9), "1:01");
  const { default: postcss } = await import("postcss");
  const css = readFileSync(new URL("../src/styles/features/lesson-video.css", import.meta.url), "utf8");
  const result = await postcss([]).process(css, { from: undefined });
  const declarations = (selector) => {
    let found;
    result.root.walkRules((rule) => { if (rule.selector === selector) found = Object.fromEntries(rule.nodes.map(({ prop, value }) => [prop, value])); });
    return found;
  };
  assert.equal(declarations(".aapm-video-player__viewport--youtube")["min-height"], "200px");
  assert.equal(declarations(".aapm-video-player__controls .aapm-button")["min-height"], "44px");
  assert.equal(declarations(".aapm-video-player__controls .aapm-button")["min-width"], "44px");
  assert.equal(declarations('.aapm-video-player input[type="range"]')["min-height"], "44px");
});
