import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { certificateModel } from "@/lib/certificatePdf";

// The certificate is a print document: its palette is fixed (it never follows
// dark mode) and uses plain hex colours so the exporter can rasterise it.
export const CERTIFICATE_WIDTH = 1123;
export const CERTIFICATE_HEIGHT = 794;

// Same hues as the canvas tier medals: green, teal, blue, violet, rose, gold.
const TIER_ACCENTS = {
  1: { accent: "#318139", ink: "#1f5a26", tint: "#d3ecd6", soft: "#eaf4eb", on: "#ffffff" },
  2: { accent: "#13847a", ink: "#0b5c54", tint: "#c9ece7", soft: "#e5f4f2", on: "#ffffff" },
  3: { accent: "#2f6fb0", ink: "#1d4f82", tint: "#d2e4f7", soft: "#e9f1fa", on: "#ffffff" },
  4: { accent: "#6f52c4", ink: "#4b3394", tint: "#e0d8fa", soft: "#f1edfb", on: "#ffffff" },
  5: { accent: "#c2416b", ink: "#8c2547", tint: "#fad3e0", soft: "#fbecf1", on: "#ffffff" },
  6: { accent: "#f5b400", ink: "#7a4f0d", tint: "#ffe9a3", soft: "#fff6d9", on: "#3b2a00" },
};

export function tierAccent(tierNumber) {
  return TIER_ACCENTS[Number(tierNumber)] || TIER_ACCENTS[1];
}

function formatIssued(value) {
  if (!value) return "—";
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * The tier numeral as an image. html2canvas misplaces text at this size, so the preview
 * and the export both draw these same pixels.
 */
async function tierNumeral(tierNumber, color) {
  await document.fonts?.load?.('800 336px "Nunito"');
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 290;
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.font = '800 336px "Nunito", "Inter", system-ui, sans-serif';
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.fillText(String(tierNumber), 200, 270);
  return canvas.toDataURL("image/png");
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
export function CertificateDocument({ certificate, qrDataUrl = "", numeralUrl = "" }) {
  const model = certificateModel(certificate);
  const tierNumber = Number(certificate?.tierNumber ?? certificate?.levelNumber ?? 1) || 1;
  const colors = tierAccent(tierNumber);
  const isExpert = tierNumber === 6;
  return (
    <div
      className="aapm-cert"
      data-expert={isExpert ? "true" : undefined}
      style={/** @type {React.CSSProperties} */ ({ "--cert-accent": colors.accent, "--cert-ink": colors.ink, "--cert-tint": colors.tint, "--cert-soft": colors.soft, "--cert-on": colors.on })}
      role="img"
      aria-label={`${model.title} untuk ${model.holder}, ${model.tierName}`}
    >
      <div className="aapm-cert__frame">
        <div className="aapm-cert__body">
          <header className="aapm-cert__brand">
            <img src="/brand/aapm/logo_long.svg" alt="" width="285" height="34" className="aapm-cert__logo" />
            <span className="aapm-cert__brand-sub">Pelatihan Profesional Manajemen Peternakan Ayam Petelur</span>
          </header>

          {/* Vertically centred between brand and footer; a two-line name uses the free space. */}
          <div className="aapm-cert__award">
            <p className="aapm-cert__title">{model.title}</p>
            <p className="aapm-cert__lead">diberikan kepada</p>
            <h2 className="aapm-cert__holder" data-long={model.holder.length > 26 ? "true" : undefined}>{model.holder}</h2>
            <p className="aapm-cert__lead">atas penyelesaian tingkat</p>
            <p className="aapm-cert__tier">{model.tierName}</p>
            <span className="aapm-cert__achievement"><CheckGlyph />{model.achievement}</span>
          </div>

          <footer className="aapm-cert__footer">
            <dl className="aapm-cert__meta">
              <div><dt>Diterbitkan</dt><dd className="aapm-cert__meta-value">{formatIssued(certificate?.issuedAt)}</dd></div>
              <div><dt>Penerbit</dt><dd className="aapm-cert__meta-value">AAPM Layer Academy</dd></div>
              <div className="aapm-cert__meta-wide"><dt>ID sertifikat</dt><dd className="aapm-cert__meta-id">{model.publicId}</dd></div>
            </dl>
            <p className="aapm-cert__disclaimer">{model.disclaimer}</p>
          </footer>
        </div>

        <aside className="aapm-cert__panel">
          {[140, 240, 340, 440, 540].map((size) => <span key={size} className="aapm-cert__ring" style={{ width: size, height: size, margin: `${size / -2}px 0 0 ${size / -2}px` }} aria-hidden="true" />)}
          <div className="aapm-cert__panel-top" aria-hidden="true">
            <span className="aapm-cert__panel-label">Tingkat</span>
            {numeralUrl ? <img src={numeralUrl} alt="" width="200" height="145" className="aapm-cert__panel-number" /> : <span className="aapm-cert__panel-number" />}
            <span className="aapm-cert__stars">{[0, 1, 2].map((star) => <StarGlyph key={star} />)}</span>
          </div>
          <div className="aapm-cert__verify">
            {model.showQr && qrDataUrl ? <img src={qrDataUrl} alt="" className="aapm-cert__qr" /> : <span className="aapm-cert__qr aapm-cert__qr--empty">Kode QR</span>}
            <span className="aapm-cert__verify-text">{model.instruction}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

// Inline glyphs: the exporter rasterises SVG but not CSS mask icons.
function StarGlyph() {
  return <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="currentColor" /></svg>;
}

function CheckGlyph() {
  return <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.7 2.7L16 9.8" /></svg>;
}

/** The document scaled to its container's width, for previews and thumbnails. */
/** @param {{ certificate: any, className?: string }} props */
export function CertificatePreview({ certificate, className = "" }) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(0.4);
  const qr = useVerificationQr(certificate?.verificationUrl);
  const [numeralUrl, setNumeralUrl] = useState("");
  const tierNumber = Number(certificate?.tierNumber ?? certificate?.levelNumber ?? 1) || 1;
  useEffect(() => {
    let alive = true;
    tierNumeral(tierNumber, tierAccent(tierNumber).on).then((value) => { if (alive) setNumeralUrl(value); }).catch(() => {});
    return () => { alive = false; };
  }, [tierNumber]);
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
        <CertificateDocument certificate={certificate} qrDataUrl={qr} numeralUrl={numeralUrl} />
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
  const exportTier = Number(certificate?.tierNumber ?? certificate?.levelNumber ?? 1) || 1;
  const numeralUrl = await tierNumeral(exportTier, tierAccent(exportTier).on);
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${CERTIFICATE_WIDTH}px;height:${CERTIFICATE_HEIGHT}px;pointer-events:none;`;
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(<CertificateDocument certificate={certificate} qrDataUrl={qrDataUrl} numeralUrl={numeralUrl} />));
    await waitForImages(host);
    if (document.fonts?.ready) await document.fonts.ready;
    const node = /** @type {HTMLElement} */ (host.querySelector(".aapm-cert"));
    return await html2canvas(node, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, width: CERTIFICATE_WIDTH, height: CERTIFICATE_HEIGHT });
  } finally {
    root.unmount();
    host.remove();
  }
}
