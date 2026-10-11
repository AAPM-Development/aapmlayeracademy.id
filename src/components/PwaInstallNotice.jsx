import { useState } from "react";
import { Ic } from "@/design-system/canvas";
import { usePwaInstall } from "@/lib/usePwaInstall";

const DISMISS_KEY = "aapm-pwa-notice-until";
const WEEK = 7 * 24 * 60 * 60 * 1000;

function dismissed() {
  try { return Number(localStorage.getItem(DISMISS_KEY)) > Date.now(); }
  catch { return false; }
}

export default function PwaInstallNotice() {
  const { canInstall, isInstalled, install } = usePwaInstall();
  const [hidden, setHidden] = useState(dismissed);
  const [instructions, setInstructions] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (hidden || isInstalled || (!canInstall && !ios)) return null;

  function postpone() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now() + WEEK)); } catch { /* Session-only dismissal remains available. */ }
    setHidden(true);
  }

  async function handleInstall() {
    if (!canInstall) { setInstructions(true); return; }
    setBusy(true);
    setError("");
    try {
      const choice = await install();
      if (choice?.outcome === "dismissed") postpone();
    } catch { setError("Instalasi belum bisa dibuka. Coba menu instal aplikasi di browser Anda."); }
    finally { setBusy(false); }
  }

  return (
    <aside className="card row wrap gap-4 anim-rise" style={{ "--i": 7, padding: "14px 20px" }} aria-label="Instal Academy">
      <span className="tile tile-round" data-hue="neutral"><Ic name="phone" /></span>
      <div className="stack grow" style={{ minWidth: 240 }}>
        <span className="t-heading t-heading-sm">Academy, langsung dari layar utama</span>
        <span className="t-caption t-muted">Pasang aplikasi web untuk membuka materi dan alat farm lebih cepat.</span>
        {instructions && <span className="t-caption" role="status">Di iPhone atau iPad, buka Academy di Safari, ketuk Bagikan, lalu Tambahkan ke Layar Utama dan Tambah.</span>}
        {error && <span className="t-caption t-danger" role="status">{error}</span>}
      </div>
      <div className="row gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={postpone}>Nanti</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleInstall} disabled={busy}><Ic name="download" />{busy ? "Membuka…" : canInstall ? "Instal Academy" : "Cara memasang"}</button>
      </div>
    </aside>
  );
}
