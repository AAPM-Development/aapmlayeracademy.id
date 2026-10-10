// Browser media adapters. Playback state always comes from the media/API.
export const YOUTUBE_API_URL = "https://www.youtube.com/iframe_api";
const apiLoads = new WeakMap();

/** @typedef {{ Player: new (target: HTMLElement, options: object) => object }} YouTubeApi */
/** @typedef {Window & { YT?: YouTubeApi, onYouTubeIframeAPIReady?: () => void }} YouTubeWindow */
/** @param {YouTubeWindow} win */
export function loadYouTubeApi(win = window, doc = document, timeoutMs = 15000) {
  if (win.YT?.Player) return Promise.resolve(win.YT);
  if (apiLoads.has(win)) return apiLoads.get(win);
  const promise = new Promise((resolve, reject) => {
    const previous = win.onYouTubeIframeAPIReady;
    let script = /** @type {HTMLScriptElement | null} */ (doc.querySelector(`script[src="${YOUTUBE_API_URL}"]`));
    const owned = !script;
    if (!script) {
      script = doc.createElement("script");
      script.src = YOUTUBE_API_URL;
      script.async = true;
    }
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      win.clearTimeout(timer);
      script.removeEventListener("error", failed);
      if (win.onYouTubeIframeAPIReady === ready) win.onYouTubeIframeAPIReady = previous;
      if (error) {
        if (owned) script.remove();
        reject(error);
      } else resolve(win.YT);
    };
    const ready = () => {
      // Another embed may already own this callback. Its failure must not
      // strand Academy players waiting on the shared loader.
      try { if (typeof previous === "function") previous(); }
      finally { if (win.YT?.Player) finish(); }
    };
    const failed = () => finish(new Error("YouTube tidak dapat dimuat. Periksa koneksi lalu coba lagi."));
    const timer = win.setTimeout(failed, timeoutMs);
    script.addEventListener("error", failed);
    win.onYouTubeIframeAPIReady = ready;
    if (owned) doc.head.appendChild(script);
  });
  apiLoads.set(win, promise);
  // Release failed loads for a real retry; successful loads remain shared.
  promise.catch(() => { if (apiLoads.get(win) === promise) apiLoads.delete(win); });
  return promise;
}

export function mediaTime(value) {
  const seconds = Math.floor(Number.isFinite(value) && value > 0 ? value : 0);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export const initialMediaState = () => ({ ready: false, playing: false, loading: true, ended: false, current: 0, duration: 0, muted: false, volume: 1 });
const finiteTime = (value) => Number.isFinite(value) && value > 0 ? value : 0;

export function bindNativeVideo(video, onUpdate, onError, win = window, timeoutMs = 15000) {
  let disposed = false;
  let loading = true;
  let timer;
  const sync = () => {
    if (disposed) return;
    const ready = video.readyState >= 1;
    if (ready) win.clearTimeout(timer);
    onUpdate({ ready, playing: !video.paused && !video.ended, loading, ended: video.ended, current: finiteTime(video.currentTime), duration: finiteTime(video.duration), muted: video.muted, volume: video.volume });
  };
  const failed = () => {
    if (!disposed) {
      win.clearTimeout(timer);
      onError("Video tidak dapat diputar. Periksa koneksi atau buka file video langsung.");
    }
  };
  const handlers = {
    loadedmetadata: () => { loading = false; sync(); },
    canplay: () => { loading = false; sync(); },
    playing: () => { loading = false; sync(); },
    waiting: () => { loading = true; sync(); },
    pause: sync, timeupdate: sync, durationchange: sync, volumechange: sync,
    ended: () => { loading = false; sync(); }, error: failed,
  };
  for (const [event, handler] of Object.entries(handlers)) video.addEventListener(event, handler);
  timer = win.setTimeout(failed, timeoutMs);
  if (video.readyState >= 1) { loading = false; sync(); }
  return {
    play: () => { const result = video.play(); result?.catch(() => { if (!disposed) onError("Pemutaran diblokir browser. Coba lagi atau buka file video langsung."); }); },
    pause: () => video.pause(),
    seek: (time) => { if (finiteTime(video.duration)) video.currentTime = Math.max(0, Math.min(time, video.duration)); },
    mute: () => { video.muted = !video.muted; },
    volume: (value) => { video.volume = Math.max(0, Math.min(value, 1)); video.muted = value === 0; },
    destroy: () => {
      disposed = true;
      win.clearTimeout(timer);
      for (const [event, handler] of Object.entries(handlers)) video.removeEventListener(event, handler);
      video.pause();
    },
  };
}

export function createYouTubeSession({ mount, videoId, title, onUpdate, onError, win = window, doc = document, loadApi = loadYouTubeApi, timeoutMs = 15000 }) {
  let disposed = false;
  let player = null;
  let ready = false;
  let failedSession = false;
  let poll;
  let readyTimer;
  const sync = () => {
    if (disposed || failedSession || !ready) return;
    const state = player.getPlayerState();
    onUpdate({ ready: true, playing: state === 1, loading: state === 3, ended: state === 0, current: finiteTime(player.getCurrentTime()), duration: finiteTime(player.getDuration()), muted: player.isMuted(), volume: player.getVolume() / 100 });
  };
  const failed = (message) => {
    if (disposed) return;
    failedSession = true;
    ready = false;
    win.clearTimeout(readyTimer);
    win.clearInterval(poll);
    onError(message);
  };
  // Own the child, not React's mount node: YT replaces it with an iframe.
  loadApi(win, doc).then((api) => {
    if (disposed) return;
    const target = doc.createElement("div");
    mount.appendChild(target);
    readyTimer = win.setTimeout(() => failed("YouTube belum siap. Coba lagi atau buka di YouTube."), timeoutMs);
    player = new api.Player(target, {
      host: "https://www.youtube-nocookie.com",
      width: "100%", height: "100%", videoId,
      playerVars: { controls: 0, playsinline: 1, rel: 0, enablejsapi: 1, origin: win.location.origin },
      events: {
        onReady: (event) => {
          if (disposed || failedSession) return;
          player = event.target;
          ready = true;
          win.clearTimeout(readyTimer);
          const iframe = player.getIframe();
          iframe.title = title;
          iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
          sync();
          poll = win.setInterval(sync, 500);
        },
        onStateChange: sync,
        onError: () => failed("Video YouTube tidak dapat diputar di sini. Coba lagi atau buka di YouTube."),
        onAutoplayBlocked: () => failed("Pemutaran diblokir browser. Coba lagi atau buka di YouTube."),
      },
    });
  }).catch((error) => failed(error.message || "YouTube tidak dapat dimuat. Coba lagi."));
  return {
    play: () => { if (ready) player.playVideo(); },
    pause: () => { if (ready) player.pauseVideo(); },
    seek: (time) => { if (ready) player.seekTo(Math.max(0, Math.min(time, player.getDuration())), true); },
    mute: () => { if (ready) { if (player.isMuted()) player.unMute(); else player.mute(); sync(); } },
    volume: (value) => { if (ready) { player.setVolume(Math.max(0, Math.min(value, 1)) * 100); if (value > 0) player.unMute(); else player.mute(); sync(); } },
    destroy: () => {
      disposed = true;
      win.clearTimeout(readyTimer);
      win.clearInterval(poll);
      player?.destroy();
      mount.replaceChildren();
    },
  };
}
