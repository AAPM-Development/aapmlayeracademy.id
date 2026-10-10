// Certificate presentation. The PDF is a copy of a server-issued record; its
// authenticity is established by the public verification endpoint, not by a
// signature. Everything shown comes from the server record passed in.

export const CERTIFICATE_TITLE = "SERTIFIKAT KELULUSAN PELATIHAN";
export const CERTIFICATE_DISCLAIMER = "Sertifikat ini menyatakan penyelesaian pembelajaran dan penilaian di AAPM Layer Academy. Ini bukan lisensi profesional atau akreditasi pemerintah.";

/**
 * Pure model for one verified certificate. Tiers 1–5 are shown by completed
 * required modules, never by an invented exam score. Tier 6 shows the real
 * final-exam score from the server.
 */
export function certificateModel(certificate) {
  const tierNumber = Number(certificate?.tierNumber ?? certificate?.levelNumber ?? 0);
  const isFinal = tierNumber === 6;
  const score = certificate?.score;
  const achievement = isFinal
    ? `Nilai ujian akhir terverifikasi: ${Number.isFinite(Number(score)) ? Number(score) : 0}%`
    : `Menyelesaikan ${Number(certificate?.completedRequiredModules) || 0} modul wajib tingkat ini`;

  return {
    title: CERTIFICATE_TITLE,
    holder: String(certificate?.holderName || "Peserta Academy"),
    tierName: String(certificate?.tierName || certificate?.levelName || `Tingkat ${tierNumber}`),
    achievement,
    issuedLabel: certificate?.issuedAt ? String(certificate.issuedAt).slice(0, 10) : "",
    publicId: String(certificate?.publicId || certificate?.id || ""),
    verificationUrl: typeof certificate?.verificationUrl === "string" && certificate.verificationUrl ? certificate.verificationUrl : "",
    instruction: "Pindai kode QR atau buka tautan verifikasi untuk memastikan sertifikat ini diterbitkan oleh Academy.",
    disclaimer: CERTIFICATE_DISCLAIMER,
    showQr: Boolean(certificate?.verificationUrl),
  };
}

/** File name derived from the tier only, never from the holder's typed name. */
export function certificateFileName(certificate) {
  const tier = Number(certificate?.tierNumber ?? certificate?.levelNumber ?? 0);
  return `sertifikat-aapm-tingkat-${tier || "x"}.pdf`;
}

/** PNG file name, from the tier only like the PDF. */
export function certificateImageName(certificate) {
  return certificateFileName(certificate).replace(/\.pdf$/, ".png");
}

async function templateCanvas(certificate) {
  // The web template (src/components/certificate) is the export source; it
  // is loaded on demand so this module stays importable without a browser.
  const { renderCertificateCanvas } = await import("../components/certificate/CertificateDocument.jsx");
  return renderCertificateCanvas(certificate);
}

/**
 * Exports the certificate exactly as the web template draws it: A4 landscape
 * PDF from a 2× raster of the document. If rasterising fails, the plain
 * vector layout below is used so the learner still gets a valid document.
 */
export async function downloadVerifiedCertificatePdf(certificate) {
  let canvas = null;
  try { canvas = await templateCanvas(certificate); } catch { canvas = null; }
  if (!canvas) return downloadVectorCertificatePdf(certificate);
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  doc.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight());
  const model = certificateModel(certificate);
  doc.setProperties({ title: `${model.title} — ${model.tierName}`, subject: model.disclaimer, creator: "AAPM Layer Academy" });
  doc.save(certificateFileName(certificate));
}

/** PNG of the same template, for sharing on chat or social media. */
export async function downloadCertificateImage(certificate) {
  const canvas = await templateCanvas(certificate);
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = certificateImageName(certificate);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Plain vector fallback. jsPDF and the QR generator are loaded on demand so
 * the model above stays importable without a browser.
 */
export async function downloadVectorCertificatePdf(certificate) {
  const model = certificateModel(certificate);
  const [{ jsPDF }, QRCode] = await Promise.all([import("jspdf"), import("qrcode")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const center = width / 2;
  const maxWidth = width - 60;

  doc.setFillColor(247, 250, 247);
  doc.rect(0, 0, width, height, "F");
  doc.setDrawColor(49, 129, 57);
  doc.setLineWidth(0.8);
  doc.rect(10, 10, width - 20, height - 20);

  doc.setTextColor(49, 129, 57);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("AAPM LAYER ACADEMY", center, 24, { align: "center" });

  doc.setTextColor(34, 34, 34);
  doc.setFontSize(24);
  doc.text(model.title, center, 42, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("diberikan kepada", center, 54, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  const holderLines = doc.splitTextToSize(model.holder, maxWidth);
  doc.text(holderLines, center, 68, { align: "center" });
  const afterHolder = 68 + holderLines.length * 9;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("atas penyelesaian tingkat", center, afterHolder + 8, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(doc.splitTextToSize(model.tierName, maxWidth), center, afterHolder + 17, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(doc.splitTextToSize(model.achievement, maxWidth), center, afterHolder + 27, { align: "center" });

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.text(`Diterbitkan ${model.issuedLabel || "—"} · ID sertifikat: ${model.publicId}`, center, height - 42, { align: "center" });
  doc.text(doc.splitTextToSize(model.disclaimer, maxWidth), center, height - 36, { align: "center" });
  doc.text(doc.splitTextToSize(model.instruction, maxWidth - 60), 20, height - 22);

  if (model.showQr) {
    const dataUrl = await QRCode.toDataURL(model.verificationUrl, { margin: 1, width: 240 });
    doc.addImage(dataUrl, "PNG", width - 46, height - 52, 34, 34);
  }

  doc.save(certificateFileName(certificate));
}
