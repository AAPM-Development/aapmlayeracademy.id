import React from "react";
import { Ic } from "@/design-system/canvas";
import { bindNativeVideo, createYouTubeSession, initialMediaState, mediaTime } from "@/lib/lessonVideo";

// Lesson video card of the Redesign v2 canvas (Lesson artboard, "Video materi"):
// a dark 16:9 stage with the round play button, then a hue seek bar and ghost
// controls. One player for trusted lesson files and official YouTube embeds.

const SKIP_SECONDS = 10;
const ARROW_SECONDS = 5;
const IDLE_MS = 2600;
const FLASH_MS = 900;
const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
/** Indonesian decimal comma: 1.5 → "1,5×". */
export const rateLabel = (rate) => `${String(rate).replace(".", ",")}×`;

function SpeedMenu({ id, rate, rates, disabled, open, onOpenChange, onSelect }) {
  const buttonRef = React.useRef(null);
  const menuRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return undefined;
    menuRef.current?.querySelector('[aria-checked="true"]')?.focus({ preventScroll: true });
    const outside = (event) => {
      if (!menuRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) onOpenChange(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, onOpenChange]);

  const close = () => { onOpenChange(false); buttonRef.current?.focus(); };
  const onMenuKeyDown = (event) => {
    const items = [...menuRef.current.querySelectorAll('[role="menuitemradio"]')];
    const index = items.indexOf(document.activeElement);
    const move = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: items.length - 1 }[event.key];
    if (move !== undefined) items[(move + items.length) % items.length]?.focus();
    else if (event.key === "Escape") close();
    else if (event.key === "Tab") onOpenChange(false);
    else return;
    if (event.key !== "Tab") event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className="aapm-video-player__speed">
      <button
        ref={buttonRef}
        type="button"
        className="btn btn-ghost aapm-video-player__rate"
        aria-label={`Kecepatan putar ${rateLabel(rate)}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
        onKeyDown={(event) => { if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); event.stopPropagation(); onOpenChange(true); } }}
      >
        <span className="t-num">{rateLabel(rate)}</span>
      </button>
      {open ? (
        <div ref={menuRef} id={id} className="menu aapm-video-player__menu" role="menu" aria-label="Kecepatan putar" onKeyDown={onMenuKeyDown}>
          <span className="menu-label" aria-hidden="true">Kecepatan</span>
          {rates.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === rate}
              tabIndex={option === rate ? 0 : -1}
              className="menu-item"
              onClick={() => { onSelect(option); close(); }}
            >
              <span className="menu-check">{option === rate ? <Ic name="check" size="sm" /> : null}</span>
              <span className="t-num">{option === 1 ? "Normal" : rateLabel(option)}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function LessonVideoPlayer({ src, videoId = null, title = "Video materi", fallbackUrl }) {
  const uid = React.useId();
  const rootRef = React.useRef(null);
  const mediaRef = React.useRef(null);
  const controlsRef = React.useRef(null);
  const idleTimer = React.useRef(0);
  const flashTimer = React.useRef(0);
  const [state, setState] = React.useState(initialMediaState);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [attempt, setAttempt] = React.useState(0);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [idle, setIdle] = React.useState(false);
  const [scrub, setScrub] = React.useState(null);
  const [flash, setFlash] = React.useState(null);

  React.useEffect(() => {
    setState(initialMediaState());
    setError("");
    setNotice("");
    const options = { mount: mediaRef.current, videoId, title, onUpdate: setState, onError: setError };
    const controls = videoId
      ? createYouTubeSession(options)
      : bindNativeVideo(mediaRef.current, setState, setError);
    controlsRef.current = controls;
    return () => { controlsRef.current = null; controls.destroy(); };
  }, [src, videoId, title, attempt]);

  React.useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  React.useEffect(() => () => { window.clearTimeout(idleTimer.current); window.clearTimeout(flashTimer.current); }, []);

  // Controls fade out in full screen while the video plays and nothing moves.
  const wake = () => {
    setIdle(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
  };
  const showFlash = (text, icon) => {
    window.clearTimeout(flashTimer.current);
    setFlash({ text, icon, key: Date.now() });
    flashTimer.current = window.setTimeout(() => setFlash(null), FLASH_MS);
  };

  const disabled = !state.ready || Boolean(error);
  const started = state.playing || state.current > 0 || state.ended;
  const progress = state.duration ? clamp(state.current / state.duration, 0, 1) * 100 : 0;
  const volume = state.muted ? 0 : state.volume;

  const toggle = () => {
    if (disabled) return;
    if (state.playing) controlsRef.current?.pause();
    else controlsRef.current?.play();
  };
  const seekTo = (time) => { if (!disabled && state.duration) controlsRef.current?.seek(clamp(time, 0, state.duration)); };
  const seekBy = (delta) => {
    if (disabled || !state.duration) return;
    seekTo(state.current + delta);
    showFlash(`${delta < 0 ? "−" : "+"}${Math.abs(delta)} dtk`, delta < 0 ? "rewind" : "forward");
  };
  const setVolume = (value) => {
    if (disabled) return;
    const next = Math.round(clamp(value, 0, 1) * 100) / 100;
    controlsRef.current?.volume(next);
    showFlash(next === 0 ? "Suara mati" : `Volume ${Math.round(next * 100)}%`, next === 0 ? "volume-off" : "volume");
  };
  const toggleMute = () => {
    if (disabled) return;
    controlsRef.current?.mute();
    showFlash(state.muted ? `Volume ${Math.round((state.volume || 1) * 100)}%` : "Suara mati", state.muted ? "volume" : "volume-off");
  };
  const setRate = (rate) => {
    if (disabled) return;
    controlsRef.current?.speed(rate);
    showFlash(rate === 1 ? "Kecepatan normal" : `Kecepatan ${rateLabel(rate)}`);
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === rootRef.current) await document.exitFullscreen();
      else if (rootRef.current.requestFullscreen) await rootRef.current.requestFullscreen();
      else if (!videoId && mediaRef.current.webkitEnterFullscreen) mediaRef.current.webkitEnterFullscreen();
      else setNotice("Layar penuh tidak tersedia di browser ini. Gunakan tautan video di bawah.");
    } catch { setNotice("Layar penuh diblokir browser. Gunakan tautan video di bawah."); }
  };

  // Shortcuts follow the common video convention (YouTube): they act while
  // focus is inside the player, and never steal keys from the menu or volume.
  const onKeyDown = (event) => {
    wake();
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    const onButton = target.tagName === "BUTTON" || target.tagName === "A";
    const onVolume = target.classList?.contains("aapm-video-player__volume");
    const actions = {
      " ": onButton ? null : toggle,
      k: toggle,
      j: () => seekBy(-SKIP_SECONDS),
      l: () => seekBy(SKIP_SECONDS),
      ArrowLeft: onVolume ? null : () => seekBy(-ARROW_SECONDS),
      ArrowRight: onVolume ? null : () => seekBy(ARROW_SECONDS),
      ArrowUp: onVolume ? null : () => setVolume(volume + .1),
      ArrowDown: onVolume ? null : () => setVolume(volume - .1),
      Home: onVolume ? null : () => seekTo(0),
      End: onVolume ? null : () => seekTo(state.duration),
      m: toggleMute,
      f: toggleFullscreen,
    };
    const action = actions[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  const onSeekPointer = (event) => {
    if (!state.duration || event.pointerType === "touch") return;
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = clamp((event.clientX - box.left) / box.width, 0, 1);
    setScrub({ ratio, time: ratio * state.duration });
  };

  const surfaceClick = () => { rootRef.current?.focus({ preventScroll: true }); toggle(); };
  const showSpinner = !error && state.loading;
  const showPlay = !error && state.ready && !state.playing && !state.loading;
  const status = error || notice || (state.loading && !state.ready ? "Memuat video…" : state.loading ? "Menunggu video…" : state.ended ? "Video selesai" : "");
  const openLabel = videoId ? "Buka di YouTube" : "Buka file video";
  const openHref = fallbackUrl || src;

  return (
    <div
      className="aapm-video-player card"
      ref={rootRef}
      role="group"
      aria-label={title}
      aria-describedby={`${uid}-keys`}
      tabIndex={-1}
      data-state={error ? "error" : state.ended ? "ended" : state.playing ? "playing" : started ? "paused" : "idle"}
      data-idle={fullscreen && idle && state.playing && !menuOpen ? "" : undefined}
      data-fullscreen={fullscreen ? "" : undefined}
      onKeyDown={onKeyDown}
      onPointerMove={wake}
      onFocus={wake}
    >
      <div className={`aapm-lesson-media aapm-video-player__viewport${videoId ? " aapm-video-player__viewport--youtube" : ""}`}>
        {videoId ? <div className="aapm-video-player__embed" ref={mediaRef} /> : (
          <video key={`${src}-${attempt}`} ref={mediaRef} src={src} playsInline preload="metadata" aria-label={title} />
        )}
        <div className="aapm-video-player__surface" aria-hidden="true" onClick={surfaceClick} onDoubleClick={toggleFullscreen} />

        {!started && state.ready && !error ? (
          <div className="aapm-video-player__poster" aria-hidden="true">
            {/* YouTube draws its own title over the thumbnail. */}
            {videoId ? null : <span className="aapm-video-player__poster-title t-clamp-2">{title}</span>}
            {state.duration ? <span className="aapm-video-player__badge t-num"><Ic name="clock" size="xs" />{mediaTime(state.duration)}</span> : null}
          </div>
        ) : null}

        {showSpinner ? <span className="aapm-video-player__spinner" aria-hidden="true" /> : null}

        {showPlay ? (
          <button type="button" className="aapm-video-player__bigplay" aria-label={state.ended ? "Putar ulang video" : "Putar video"} onClick={() => { rootRef.current?.focus({ preventScroll: true }); toggle(); }}>
            <Ic name={state.ended ? "refresh" : "play"} size="xl" />
          </button>
        ) : null}

        {flash ? (
          <span key={flash.key} className="aapm-video-player__flash" aria-hidden="true">
            {flash.icon ? <Ic name={flash.icon} size="sm" /> : null}{flash.text}
          </span>
        ) : null}

        {error ? (
          <div className="aapm-video-player__error">
            <span className="aapm-video-player__error-icon"><Ic name="alert" size="lg" /></span>
            <p className="t-support">{error}</p>
            <div className="row wrap gap-2 justify-center">
              <button type="button" className="btn btn-sm aapm-video-player__retry" onClick={() => setAttempt((value) => value + 1)}><Ic name="refresh" size="sm" />Coba lagi</button>
              <a className="btn btn-sm btn-ghost aapm-video-player__open" href={openHref} target="_blank" rel="noopener noreferrer">{openLabel}<Ic name="external" size="sm" /><span className="sr-only"> (tab baru)</span></a>
            </div>
          </div>
        ) : null}
      </div>

      <div className="aapm-video-player__controls">
        <div className="aapm-video-player__seek" onPointerMove={onSeekPointer} onPointerLeave={() => setScrub(null)}>
          <input
            className="aapm-video-player__timeline"
            type="range"
            min="0"
            max={state.duration || 0}
            step="1"
            value={Math.min(state.current, state.duration)}
            disabled={disabled || !state.duration}
            style={{ "--p": progress, "--b": state.buffered * 100 }}
            aria-label="Posisi video"
            aria-valuetext={`${mediaTime(state.current)} dari ${mediaTime(state.duration)}`}
            onChange={(event) => seekTo(Number(event.target.value))}
          />
          {scrub && !disabled ? <span className="tip aapm-video-player__scrub t-num" style={{ left: `${scrub.ratio * 100}%` }} aria-hidden="true">{mediaTime(scrub.time)}</span> : null}
        </div>
        <div className="aapm-video-player__row">
          <button type="button" className="btn btn-ghost btn-icon aapm-video-player__play" aria-label={state.playing ? "Jeda video" : state.ended ? "Putar ulang video" : "Putar video"} disabled={disabled} onClick={toggle}>
            <Ic name={state.playing ? "pause" : state.ended ? "refresh" : "play"} size="lg" />
          </button>
          <button type="button" className="btn btn-ghost btn-icon aapm-video-player__skip" aria-label={`Mundur ${SKIP_SECONDS} detik`} disabled={disabled || !state.duration} onClick={() => seekBy(-SKIP_SECONDS)}>
            <Ic name="rewind" size="lg" />
          </button>
          <button type="button" className="btn btn-ghost btn-icon aapm-video-player__skip" aria-label={`Maju ${SKIP_SECONDS} detik`} disabled={disabled || !state.duration} onClick={() => seekBy(SKIP_SECONDS)}>
            <Ic name="forward" size="lg" />
          </button>
          <span className="aapm-video-player__time t-num" aria-hidden="true">
            <span className="aapm-video-player__now">{mediaTime(state.current)}</span>
            <span className="aapm-video-player__total"> / {mediaTime(state.duration)}</span>
          </span>
          <span className="grow" />
          <SpeedMenu id={`${uid}-speed`} rate={state.rate} rates={state.rates} disabled={disabled} open={menuOpen} onOpenChange={setMenuOpen} onSelect={setRate} />
          <div className="aapm-video-player__sound">
            <button type="button" className="btn btn-ghost btn-icon" aria-label={state.muted ? "Aktifkan suara" : "Bisukan suara"} aria-pressed={state.muted} disabled={disabled} onClick={toggleMute}>
              <Ic name={volume === 0 ? "volume-off" : "volume"} size="lg" />
            </button>
            <input
              className="aapm-video-player__volume"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              disabled={disabled}
              style={{ "--p": volume * 100, "--b": 0 }}
              aria-label="Volume video"
              aria-valuetext={`${Math.round(volume * 100)} persen`}
              onChange={(event) => controlsRef.current?.volume(Number(event.target.value))}
            />
          </div>
          <button type="button" className="btn btn-ghost btn-icon aapm-video-player__fullscreen" aria-label={fullscreen ? "Keluar layar penuh" : "Layar penuh"} aria-pressed={fullscreen} onClick={toggleFullscreen}>
            <Ic name={fullscreen ? "shrink" : "expand"} size="lg" />
          </button>
        </div>
      </div>

      {notice ? <p className="aapm-video-player__notice t-caption">{notice}</p> : null}
      <div className="sr-only" role="status" aria-live="polite">{status}</div>
      <p className="sr-only" id={`${uid}-keys`}>Pintasan keyboard: Spasi atau K putar dan jeda, J dan L mundur atau maju 10 detik, panah kiri dan kanan 5 detik, panah atas dan bawah volume, M bisukan, F layar penuh.</p>
      <p className="aapm-lesson-media__fallback t-caption">
        <a className="btn-link" href={openHref} target="_blank" rel="noopener noreferrer">{openLabel}<Ic name="external" size="xs" /><span className="sr-only"> (tab baru)</span></a>
      </p>
    </div>
  );
}
