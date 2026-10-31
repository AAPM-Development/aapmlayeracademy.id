import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AppiMascot, { appiAsset } from "@/components/appi/AppiMascot";
import { Ic, Logo } from "@/design-system/canvas";
import { usePwaInstall } from "@/lib/usePwaInstall";

const academyInsights = [
  "Performa farm yang sehat dimulai dari kemampuan membaca sinyal—pakan, air, telur, dan perilaku ayam.",
  "Di balik hasil yang konsisten, ada keputusan kecil yang diamati, dicatat, dan dijalankan dengan disiplin.",
  "Belajar di AAPM berarti mengubah pengalaman kandang menjadi keputusan yang lebih presisi dan berdampak.",
];

function useMedia(query) {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [query]);
  return matches;
}

/**
 * Brand panel (≥1025 px), always dark like a video frame: the farm video,
 * APPI, and a quote card that rotates every 10 s with a pause control.
 * Small screens use the form alone, without a video or poster request.
 */
function AcademyBrandPanel() {
  const videoRef = useRef(null);
  const isDesktop = useMedia("(min-width: 1025px)");
  const reducedMotion = useMedia("(prefers-reduced-motion: reduce)");
  const [loadVideo, setLoadVideo] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!isDesktop || reducedMotion) {
      videoRef.current?.pause();
      setLoadVideo(false);
      return undefined;
    }
    const start = () => setLoadVideo(true);
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(start, { timeout: 1800 });
      return () => window.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(start, 1200);
    return () => window.clearTimeout(id);
  }, [isDesktop, reducedMotion]);

  useEffect(() => {
    if (!isDesktop || reducedMotion || paused) return undefined;
    const id = window.setInterval(() => setIndex((current) => (current + 1) % academyInsights.length), 10000);
    return () => window.clearInterval(id);
  }, [isDesktop, reducedMotion, paused]);

  if (!isDesktop) return null;

  return (
    <aside className="hide-md auth-brand" aria-label="Tentang AAPM Layer Academy">
      <div className="aapm auth-brand-frame" data-theme="dark">
        {videoFailed ? <img className="auth-brand-video" src="/assets/Video-Web_3-poster.webp" alt="" /> : <video
          ref={videoRef}
          className="auth-brand-video"
          src={loadVideo ? "/assets/Video-Web_3.mp4" : undefined}
          poster="/assets/Video-Web_3-poster.webp"
          autoPlay={loadVideo && !reducedMotion}
          muted
          loop
          playsInline
          preload={loadVideo ? "metadata" : "none"}
          aria-hidden="true"
          onError={() => setVideoFailed(true)}
        />}
        <div className="appi-stage auth-brand-appi">
          <AppiMascot mood="happy" size="xl" enter="pop" />
          <img className="sparkle anim-twinkle" src={appiAsset(13)} alt="" style={{ right: -22, top: 2, width: 28 }} />
          <img className="sparkle anim-twinkle" src={appiAsset(13)} alt="" style={/** @type {React.CSSProperties} */ ({ left: -16, top: 36, width: 18, "--i": 2 })} />
        </div>
        <div className="stack gap-3 auth-brand-foot">
          <figure className="card card-pad-lg card-raised stack gap-5" aria-roledescription="carousel" aria-label="Kutipan Academy">
            <blockquote key={index} className="t-title-c anim-rise" aria-live={paused ? "polite" : "off"}>“{academyInsights[index]}”</blockquote>
            <figcaption className="row between gap-4">
              <span className="row gap-2">
                <Logo variant="icon" style={{ width: 24, height: 24 }} />
                <span className="t-support t-strong">AAPM Layer Academy</span>
              </span>
              <span className="row gap-3">
                <span className="segs" aria-hidden="true" style={{ width: 56 }}>
                  {academyInsights.map((quote, position) => <i key={quote} className={position === index ? "on" : undefined} />)}
                </span>
                <span className="sr-only">Kutipan {index + 1} dari {academyInsights.length}</span>
                {!reducedMotion ? (
                  <button type="button" className="btn btn-secondary btn-sm btn-icon" aria-label={paused ? "Lanjutkan kutipan berputar" : "Jeda kutipan berputar"} aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
                    <Ic name={paused ? "play" : "pause"} />
                  </button>
                ) : null}
              </span>
            </figcaption>
          </figure>
        </div>
      </div>
    </aside>
  );
}

const TONE_STYLE = {
  success: { background: "var(--success-surface)", color: "var(--success-text)" },
  danger: { background: "var(--danger-surface)", color: "var(--danger-text)" },
  warning: { background: "var(--warning-surface)", color: "var(--warning-text)" },
};

/** "atau" separator between the form and the Google button. */
export function AuthDivider() {
  return (
    <div className="row gap-3" role="separator" aria-label="atau">
      <span className="divider" style={{ flex: 1 }} />
      <span className="t-caption t-muted" aria-hidden="true">atau</span>
      <span className="divider" style={{ flex: 1 }} />
    </div>
  );
}

/** Google sign-in in a fixed 48 px slot, so nothing shifts. */
export function GoogleButton({ label, onClick }) {
  return (
    <button type="button" className="btn btn-secondary btn-lg btn-block" onClick={onClick}>
      <span className="tile tile-round" data-hue="neutral" aria-hidden="true" style={{ width: 20, height: 20 }}>
        <span style={{ background: "conic-gradient(from -45deg, var(--danger) 0 25%, var(--blue) 0 50%, var(--green) 0 75%, var(--gold) 0)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", fontWeight: 800 }}>G</span>
      </span>
      {label}
    </button>
  );
}

/** Live password requirement checklist (replaces the static hint). */
export function PasswordRequirements({ id, value }) {
  const rules = [
    { label: "Minimal 8 karakter", met: value.length >= 8 },
    { label: "Memuat huruf dan angka", met: /[A-Za-z]/.test(value) && /[0-9]/.test(value) },
  ];
  return (
    <ul className="stack gap-1" id={id} aria-live="polite" aria-label="Syarat kata sandi">
      {rules.map((rule) => (
        <li key={rule.label} className={`row gap-2 t-caption ${rule.met ? "t-success" : "t-muted"}`}>
          <Ic name={rule.met ? "check-circle" : "x-circle"} size="sm" />{rule.label}
          <span className="sr-only">, {rule.met ? "terpenuhi" : "belum terpenuhi"}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Auth shell (canvas Login/Register/AuthStates): one left-aligned form
 * column (max 400 px) beside the dark brand panel. Recovery states add a
 * 64 px visual row (an icon tile whose tone carries meaning, or APPI) and a
 * "back" link under the main action.
 */
/**
 * Install the web app from the sign-in pages. Android (and desktop Chromium) get a
 * one-tap prompt when the browser offers it; iPhone and iPad get the Safari steps,
 * since iOS has no install prompt. Hidden once the app is installed or run standalone.
 */
function AuthInstallHint() {
  const pwa = usePwaInstall();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  if (!pwa || pwa.isInstalled) return null;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const ios = /iPad|iPhone|iPod/.test(ua) || (typeof navigator !== "undefined" && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  if (!pwa.canInstall && !ios && !android) return null;

  const install = async () => {
    setBusy(true);
    setMessage("");
    try {
      const choice = await pwa.install();
      if (choice?.outcome !== "accepted") setMessage("Pemasangan dibatalkan. Anda bisa mencobanya lagi kapan saja.");
    } catch {
      setMessage("Pemasangan belum bisa dibuka. Gunakan menu browser, lalu pilih Instal aplikasi.");
    } finally {
      setBusy(false);
    }
  };

  const steps = ios
    ? "Di iPhone atau iPad: buka Academy di Safari, ketuk Bagikan, lalu Tambahkan ke Layar Utama."
    : "Di Android: buka menu browser (⋮), lalu pilih Instal aplikasi atau Tambahkan ke layar utama.";

  return (
    <aside className="card row wrap gap-3 auth-install" aria-label="Pasang Academy" style={{ padding: "12px 16px" }}>
      <span className="tile tile-sm" data-hue="green" aria-hidden="true"><Ic name="phone" /></span>
      <div className="stack grow" style={{ minWidth: 200 }}>
        <span className="t-support t-strong">Pasang Academy di ponsel</span>
        <span className="t-caption t-muted">{pwa.canInstall ? "Buka lebih cepat langsung dari layar utama." : steps}</span>
        {message ? <span className="t-caption t-muted" role="status">{message}</span> : null}
      </div>
      {pwa.canInstall ? (
        <button type="button" className="btn btn-secondary btn-sm" onClick={install} disabled={busy} aria-busy={busy || undefined}><Ic name="download" />{busy ? "Membuka…" : "Pasang"}</button>
      ) : null}
    </aside>
  );
}

function AuthLayout({ title, subtitle, footer = null, children, icon = null, tone = null, visual = null, back = null }) {
  const compact = Boolean(icon || visual);

  return (
    <div className="auth">
      <main className="stack auth-main" aria-labelledby="auth-title">
        <div className="stack gap-8 w-full auth-col">
          <Link to="/" aria-label="AAPM Layer Academy" className="auth-logo"><Logo variant="main" alt="AAPM .academy" style={{ height: 84 }} /></Link>
          <div className="stack gap-6">
            {compact ? (
              <div className="row justify-center" style={{ height: 64 }}>
                {visual || <span className="tile tile-xl" style={TONE_STYLE[tone] || undefined}><Ic name={icon} /></span>}
              </div>
            ) : null}
            <header className="stack gap-1 auth-head">
              <h1 className={compact ? "t-title-c" : "t-title"} id="auth-title">{title}</h1>
              {subtitle ? <p className="t-body t-muted t-pretty">{subtitle}</p> : null}
            </header>
            <div className="stack gap-5 auth-body">{children}</div>
            {back ? (
              <Link className="btn btn-link" to={back.to || "/login"} style={{ alignSelf: "center" }}><Ic name="arrow-left" />{back.label || "Kembali ke halaman masuk"}</Link>
            ) : null}
            {footer ? <p className="t-body t-muted t-center">{footer}</p> : null}
            <AuthInstallHint />
          </div>
        </div>
        <footer className="stack gap-1 t-caption t-muted t-center w-full mt-auto auth-col" style={{ paddingTop: "var(--s-10)" }}>
          <span>© {new Date().getFullYear()} AAPM · Pelatihan profesional manajemen layer farm</span>
        </footer>
      </main>
      <AcademyBrandPanel />
    </div>
  );
}

export default AuthLayout;
