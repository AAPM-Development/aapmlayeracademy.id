import React from "react";
import { Button, IconButton } from "@/design-system";
import AapmIcon from "@/components/icons/AapmIcon";
import { bindNativeVideo, createYouTubeSession, initialMediaState, mediaTime } from "@/lib/lessonVideo";

/** Minimal controls shared by trusted lesson files and official YouTube embeds. */
export default function LessonVideoPlayer({ src, videoId = null, title = "Video materi", fallbackUrl }) {
  const rootRef = React.useRef(null);
  const mediaRef = React.useRef(null);
  const controlsRef = React.useRef(null);
  const [state, setState] = React.useState(initialMediaState);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [attempt, setAttempt] = React.useState(0);
  const [fullscreen, setFullscreen] = React.useState(false);

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

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === rootRef.current) await document.exitFullscreen();
      else if (rootRef.current.requestFullscreen) await rootRef.current.requestFullscreen();
      else if (!videoId && mediaRef.current.webkitEnterFullscreen) mediaRef.current.webkitEnterFullscreen();
      else setNotice("Layar penuh tidak tersedia di browser ini. Gunakan tautan video di bawah.");
    } catch { setNotice("Layar penuh diblokir browser. Gunakan tautan video di bawah."); }
  };
  const disabled = !state.ready || Boolean(error);
  const status = error || notice || (state.loading && !state.ready ? "Memuat video…" : state.loading ? "Menunggu video…" : state.ended ? "Video selesai" : "");

  return (
    <div className="aapm-video-player" ref={rootRef} role="group" aria-label={title}>
      <div className={`aapm-lesson-media aapm-video-player__viewport${videoId ? " aapm-video-player__viewport--youtube" : ""}`}>
        {videoId ? <div className="aapm-video-player__embed" ref={mediaRef} /> : (
          <video key={`${src}-${attempt}`} ref={mediaRef} src={src} playsInline preload="metadata" aria-label={title} />
        )}
      </div>
      <div className="aapm-video-player__controls">
        <input className="aapm-video-player__timeline" type="range" min="0" max={state.duration || 0} step="1" value={Math.min(state.current, state.duration)} disabled={disabled || !state.duration} aria-label="Posisi video" aria-valuetext={`${mediaTime(state.current)} dari ${mediaTime(state.duration)}`} onChange={(event) => controlsRef.current?.seek(Number(event.target.value))} />
        <IconButton label={state.playing ? "Jeda video" : state.ended ? "Putar ulang video" : "Putar video"} icon={state.playing ? "pause" : "play"} disabled={disabled} onClick={() => state.playing ? controlsRef.current?.pause() : controlsRef.current?.play()} />
        <span className="aapm-video-player__time" aria-label={`${mediaTime(state.current)} dari ${mediaTime(state.duration)}`}>{mediaTime(state.current)} / {mediaTime(state.duration)}</span>
        <IconButton label={state.muted ? "Aktifkan suara" : "Bisukan suara"} icon={state.muted ? "volumeMuted" : "volume"} aria-pressed={state.muted} disabled={disabled} onClick={() => controlsRef.current?.mute()} />
        <input className="aapm-video-player__volume" type="range" min="0" max="1" step="0.05" value={state.muted ? 0 : state.volume} disabled={disabled} aria-label="Volume video" aria-valuetext={`${Math.round((state.muted ? 0 : state.volume) * 100)} persen`} onChange={(event) => controlsRef.current?.volume(Number(event.target.value))} />
        <IconButton className="aapm-video-player__fullscreen" label={fullscreen ? "Keluar layar penuh" : "Layar penuh"} icon="fullscreen" aria-pressed={fullscreen} onClick={toggleFullscreen} />
      </div>
      <div className="aapm-video-player__feedback" role="status" aria-live="polite">
        {status ? <span>{status}</span> : null}
        {error ? <Button size="sm" variant="outline" leadingIcon="refresh" onClick={() => setAttempt((value) => value + 1)}>Coba lagi</Button> : null}
      </div>
      <p className="aapm-lesson-media__fallback">
        <a href={fallbackUrl || src} target="_blank" rel="noopener noreferrer">{videoId ? "Buka di YouTube" : "Buka file video"}<AapmIcon name="externalLink" /><span className="aapm-visually-hidden"> (tab baru)</span></a>
      </p>
    </div>
  );
}
