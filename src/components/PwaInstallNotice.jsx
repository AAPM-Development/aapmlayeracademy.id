import { useState } from "react";
import { Button } from "@/design-system";
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
    <aside className="aapm-pwa-notice" aria-label="Instal Academy">
      <div>
        <strong>Academy, langsung dari layar utama</strong>
        <p>Pasang aplikasi web untuk membuka materi dan alat farm dengan lebih mudah.</p>
        {instructions && <p role="status">Di iPhone atau iPad, buka Academy di Safari, ketuk Bagikan, lalu Tambahkan ke Layar Utama dan Tambah.</p>}
        {error && <p role="status">{error}</p>}
      </div>
      <div className="aapm-pwa-notice__actions">
        <Button leadingIcon="download" onClick={handleInstall} disabled={busy}>{busy ? "Membuka…" : canInstall ? "Instal Academy" : "Cara memasang"}</Button>
        <Button variant="ghost" onClick={postpone}>Nanti</Button>
      </div>
    </aside>
  );
}
