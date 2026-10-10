import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { certificateModel } from "@/lib/certificatePdf";

// The certificate is a print document: its palette is fixed (it never follows
// dark mode) and uses plain hex colours so the exporter can rasterise it.
export const CERTIFICATE_WIDTH = 1123;
export const CERTIFICATE_HEIGHT = 794;

const TIER_ACCENTS = {
  1: { accent: "#318139", ink: "#1f5a26", tint: "#d3ecd6" },
  2: { accent: "#D4451A", ink: "#9a3010", tint: "#ffd9c7" },
  3: { accent: "#2f6fb0", ink: "#1d4f82", tint: "#d2e4f7" },
  4: { accent: "#6f52c4", ink: "#4b3394", tint: "#e0d8fa" },
  5: { accent: "#13867a", ink: "#0b5c54", tint: "#c9ece7" },
  6: { accent: "#b7791f", ink: "#7a4f0d", tint: "#f8e4b4" },
};

export function tierAccent(tierNumber) {
  return TIER_ACCENTS[Number(tierNumber)] || TIER_ACCENTS[1];
}

function formatIssued(value) {
  if (!value) return "—";
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

/** QR code for the server's verification URL, as a data URL (empty without a URL). */
export function useVerificationQr(url) {
  const [dataUrl, setDataUrl] = useState("");
  useEffect(() => {
    let alive = true;
    if (!url) { setDataUrl(""); return undefined; }
    import("qrcode").then((QRCode) => QRCode.toDataURL(url, { margin: 0, width: 240, color: { dark: "#1c1c1a", light: "#ffffff" } }))
      .then((value) => { if (alive) setDataUrl(value); })
      .catch(() => { if (alive) setDataUrl(""); });
    return () => { alive = false; };
  }, [url]);
  return dataUrl;
}

/**
 * The certificate, drawn at A4 landscape (1123 × 794 CSS px). The same
 * component is the on-screen preview and the source of the PDF/PNG export,
 * so the download looks exactly like the web. Content comes only from the
 * server record via `certificateModel`.
 */
export function CertificateDocument({ certificate, qrDataUrl = "" }) {
  const model = certificateModel(certificate);
  const tierNumber = Number(certificate?.tierNumber ?? certificate?.levelNumber ?? 1) || 1;
  const colors = tierAccent(tierNumber);
  const isExpert = tierNumber === 6;
  return (
    <div
      className="aapm-cert"
      data-expert={isExpert ? "true" : undefined}
      style={/** @type {React.CSSProperties} */ ({ "--cert-accent": colors.accent, "--cert-ink": colors.ink, "--cert-tint": colors.tint })}
      role="img"
      aria-label={`${model.title} untuk ${model.holder}, ${model.tierName}`}
    >
      <div className="aapm-cert__frame">
        <aside className="aapm-cert__ribbon" aria-hidden="true">
          <div className="aapm-cert__medal">
            <span className="aapm-cert__medal-ring" />
            <span className="aapm-cert__medal-label">Tingkat</span>
            <span className="aapm-cert__medal-number">{tierNumber}</span>
          </div>
          <span className="aapm-cert__ribbon-tail" />
          <p className="aapm-cert__ribbon-text">AAPM Layer Academy</p>
        </aside>

        <div className="aapm-cert__body">
          <header className="aapm-cert__brand">
            <img src="/assets/Logo_AAPM_Main.svg" alt="" className="aapm-cert__logo" />
            <span className="aapm-cert__brand-sub">Layer Academy · Pelatihan Profesional Manajemen Peternakan Ayam Petelur</span>
          </header>

          <p className="aapm-cert__title">{model.title}</p>
          <p className="aapm-cert__lead">diberikan kepada</p>
          <h2 className="aapm-cert__holder">{model.holder}</h2>
          <p className="aapm-cert__lead">atas penyelesaian tingkat</p>
          <p className="aapm-cert__tier">{model.tierName}</p>
          <p className="aapm-cert__achievement">{model.achievement}</p>

          <footer className="aapm-cert__footer">
            <div className="aapm-cert__meta">
              <span className="aapm-cert__meta-label">Diterbitkan</span>
              <span className="aapm-cert__meta-value">{formatIssued(certificate?.issuedAt)}</span>
              <span className="aapm-cert__meta-label">ID sertifikat</span>
              <span className="aapm-cert__meta-id">{model.publicId}</span>
            </div>
            <div className="aapm-cert__seal">
              <span className="aapm-cert__seal-line" />
              <span className="aapm-cert__seal-name">AAPM Layer Academy</span>
              <span className="aapm-cert__seal-role">Penerbit sertifikat</span>
            </div>
            <div className="aapm-cert__verify">
              {model.showQr && qrDataUrl ? <img src={qrDataUrl} alt="" className="aapm-cert__qr" /> : <span className="aapm-cert__qr aapm-cert__qr--empty" />}
              <span className="aapm-cert__verify-text">{model.instruction}</span>
            </div>
          </footer>
          <p className="aapm-cert__disclaimer">{model.disclaimer}</p>
        </div>
        <img src="/assets/Icon_AAPM.svg" alt="" className="aapm-cert__watermark" aria-hidden="true" />
      </div>
    </div>
  );
}

/** The document scaled to its container's width, for previews and thumbnails. */
/** @param {{ certificate: any, className?: string }} props */
export function CertificatePreview({ certificate, className = "" }) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(0.4);
  const qr = useVerificationQr(certificate?.verificationUrl);
  useLayoutEffect(() => {
    const node = wrapRef.current;
    if (!node) return undefined;
    const update = () => setScale(node.clientWidth / CERTIFICATE_WIDTH || 0.4);
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(node);
    return () => observer?.disconnect();
  }, []);
  return (
    <div ref={wrapRef} className={`aapm-cert-preview ${className || ""}`} style={{ height: CERTIFICATE_HEIGHT * scale }}>
      <div className="aapm-cert-preview__stage" style={{ transform: `scale(${scale})` }}>
        <CertificateDocument certificate={certificate} qrDataUrl={qr} />
      </div>
    </div>
  );
}

function waitForImages(root) {
  const images = [...root.querySelectorAll("img")];
  return Promise.all(images.map((image) => (image.complete ? Promise.resolve() : new Promise((resolve) => {
    image.addEventListener("load", resolve, { once: true });
    image.addEventListener("error", resolve, { once: true });
  }))));
}

/**
 * Renders the document off screen at full size and rasterises it at 2×, so
 * the PDF and PNG are pixel copies of the web template.
 */
export async function renderCertificateCanvas(certificate) {
  const [{ createRoot }, { flushSync }, { default: html2canvas }, QRCode] = await Promise.all([import("react-dom/client"), import("react-dom"), import("html2canvas"), import("qrcode")]);
  const url = typeof certificate?.verificationUrl === "string" ? certificate.verificationUrl : "";
  const qrDataUrl = url ? await QRCode.toDataURL(url, { margin: 0, width: 240, color: { dark: "#1c1c1a", light: "#ffffff" } }) : "";
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${CERTIFICATE_WIDTH}px;height:${CERTIFICATE_HEIGHT}px;pointer-events:none;`;
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(<CertificateDocument certificate={certificate} qrDataUrl={qrDataUrl} />));
    await waitForImages(host);
    if (document.fonts?.ready) await document.fonts.ready;
    const node = /** @type {HTMLElement} */ (host.querySelector(".aapm-cert"));
    return await html2canvas(node, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, width: CERTIFICATE_WIDTH, height: CERTIFICATE_HEIGHT });
  } finally {
    root.unmount();
    host.remove();
  }
}
