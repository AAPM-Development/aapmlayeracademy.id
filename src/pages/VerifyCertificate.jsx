import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { nativeApi } from "@/api/nativeClient";
import { useAuth } from "@/lib/AuthContext";
import { copyText } from "@/lib/clipboard";
import { Ic, Logo } from "@/design-system/canvas";

// Canvas tier hues, in tier order.
const TIER_HUES = ["green", "teal", "blue", "violet", "rose", "gold"];
const hueOf = (tierNumber) => TIER_HUES[(Number(tierNumber) - 1) % TIER_HUES.length] || "green";

function formatIssued(value) {
  if (!value) return "—";
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

/** Public header: no app shell, no login wall. */
function PublicHeader() {
  const { user } = useAuth();
  return (
    <header className="topbar">
      <Link to="/" aria-label="AAPM Layer Academy"><Logo alt="AAPM .academy" style={{ height: 24 }} /></Link>
      <Link className="btn btn-ghost ml-auto" to={user ? "/" : "/login"}>{user ? "Buka Academy" : "Masuk"}</Link>
    </header>
  );
}

function Frame({ children }) {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <PublicHeader />
      <main className="page page-narrow" aria-label="Hasil verifikasi" style={{ paddingTop: 40 }}>{children}</main>
    </div>
  );
}

/** Thumbnail of the print document (fixed light palette) with the QR note. */
function MiniCertificate({ data }) {
  const line = (style) => <span style={{ display: "block", borderRadius: "var(--r-pill)", background: "var(--border-strong)", height: 4, ...style }} />;
  return (
    <figure className="stack gap-3" data-hue={hueOf(data.tierNumber)}>
      <div className="card aapm" data-theme="light" style={{ aspectRatio: "1123 / 794", padding: 6, background: "var(--surface)", boxShadow: "var(--shadow-card)" }} aria-hidden="true">
        <div style={{ display: "grid", gridTemplateColumns: "26% minmax(0, 1fr)", height: "100%", border: "2px solid var(--h)", borderRadius: "var(--r-sm)", overflow: "hidden" }}>
          <div className="stack items-center justify-center gap-2" style={{ background: "var(--h-soft)" }}>
            <span className="medal medal-sm">{data.tierNumber}</span>
          </div>
          <div className="stack gap-2" style={{ padding: "14px 16px 12px", minWidth: 0 }}>
            {line({ width: "34%", height: 8, background: "var(--surface-3)" })}
            {line({ width: "62%" })}
            {line({ width: "24%" })}
            <span className="t-heading t-clamp-1">{data.holderName}</span>
            {line({ width: "30%" })}
            <span className="t-caption t-strong t-ink t-clamp-1">{data.tierName}</span>
            <div className="row between items-end mt-auto gap-3">
              <div className="stack gap-1" style={{ width: "46%" }}>
                {line({})}
                {line({ width: "70%" })}
              </div>
              <span className="inset" style={{ display: "block", width: 36, height: 36, borderRadius: "var(--r-xs)", border: "1px dashed var(--border-strong)" }} />
            </div>
          </div>
        </div>
      </div>
      <figcaption className="row gap-3">
        <span className="tile tile-lg" data-hue="neutral" aria-hidden="true"><Ic name="grid" /></span>
        <span className="t-support t-muted">Kode QR pada dokumen sertifikat mengarah ke halaman verifikasi ini.</span>
      </figcaption>
    </figure>
  );
}

function VerifiedCard({ data }) {
  const [copied, setCopied] = useState(false);
  const valid = data.valid === true;
  const revoked = data.status === "revoked";
  const hue = hueOf(data.tierNumber);
  const copyId = async () => {
    setCopied(await copyText(data.publicId));
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section className="card feature anim-rise" aria-labelledby="verify-title">
      <div className="stack items-center t-center gap-3" style={{ padding: "32px 24px 28px" }}>
        {valid ? (
          <div className="halo" data-hue={hue} style={{ width: 120, height: 104 }}>
            <span className="glow" style={/** @type {React.CSSProperties} */ ({ "--size": "104px" })} aria-hidden="true" />
            <span className={`medal anim-pop${hue === "gold" ? " medal-gold" : ""}`} aria-hidden="true">{data.tierNumber}<span className="medal-badge"><Ic name="check" /></span></span>
          </div>
        ) : (
          <span className="tile tile-xl tile-round anim-pop" style={revoked ? { background: "var(--danger-surface)", color: "var(--danger-text)" } : { background: "var(--warning-surface)", color: "var(--warning-text)" }} aria-hidden="true">
            <Ic name={revoked ? "x-circle" : "alert"} />
          </span>
        )}
        <div className="stack items-center gap-1">
          <span className="t-overline t-muted">Verifikasi sertifikat Academy</span>
          <h1 className="t-title" id="verify-title">{valid ? "Sertifikat valid" : revoked ? "Sertifikat dicabut" : "Sertifikat belum dapat dipastikan"}</h1>
        </div>
        {valid ? (
          <span className="chip chip-lg chip-success"><Ic name="check-circle" />Berlaku</span>
        ) : (
          <span className={`chip chip-lg ${revoked ? "chip-danger" : "chip-warning"}`}><Ic name={revoked ? "x-circle" : "alert"} />Tidak berlaku</span>
        )}
        <p className="t-body t-muted" style={{ maxWidth: "52ch" }}>
          {valid
            ? "Sertifikat ini diterbitkan oleh server AAPM Layer Academy dan masih berlaku."
            : revoked
              ? `Sertifikat ini pernah diterbitkan, tetapi telah dicabut${data.revokedAt ? ` pada ${formatIssued(data.revokedAt)}` : ""} dan tidak lagi berlaku.`
              : "Catatan penerbitan untuk sertifikat ini belum lengkap."}
        </p>
      </div>
      <div className="card-sect split-even" style={{ padding: 24, gap: "24px 32px", alignItems: "center" }}>
        <dl className="stack gap-4">
          <div className="stack gap-0-5">
            <dt className="t-caption t-muted">Tingkat</dt>
            <dd className="t-body t-strong">Tingkat {data.tierNumber} · {data.tierName}</dd>
          </div>
          <div className="cols-2" style={{ gap: 16 }}>
            <div className="stack gap-0-5">
              <dt className="t-caption t-muted">Nama pemegang</dt>
              <dd className="t-body t-strong">{data.holderName}</dd>
            </div>
            <div className="stack gap-0-5">
              <dt className="t-caption t-muted">Tanggal terbit</dt>
              <dd className="t-body t-strong">{formatIssued(data.issuedAt)}</dd>
            </div>
          </div>
          <div className="stack gap-0-5">
            <dt className="t-caption t-muted">ID sertifikat</dt>
            <dd className="row gap-1">
              <span className="t-mono" style={{ overflowWrap: "anywhere", minWidth: 0 }}>{data.publicId}</span>
              <button type="button" className="btn btn-ghost btn-sm btn-icon btn-quiet" aria-label={copied ? "ID sertifikat disalin" : "Salin ID sertifikat"} onClick={copyId}><Ic name={copied ? "check" : "copy"} /></button>
            </dd>
          </div>
          <div className="stack gap-0-5">
            <dt className="t-caption t-muted">Penerbit</dt>
            <dd className="t-body t-strong row gap-1-5"><Ic name="shield" size="sm" className={valid ? "t-success" : "t-muted"} />AAPM Layer Academy</dd>
          </div>
        </dl>
        <MiniCertificate data={data} />
      </div>
      <div className="card-foot" style={{ padding: "14px 24px" }}>
        <Ic name="info" size="sm" className="t-muted" />
        <p className="t-caption t-muted">{data.verificationSource ? `${data.verificationSource}. ` : ""}Verifikasi ini memastikan penerbitan oleh Academy, bukan lisensi pemerintah atau akreditasi pihak ketiga.</p>
      </div>
    </section>
  );
}

function ProblemCard({ title, text, onRetry = undefined }) {
  return (
    <section className="card card-pad stack gap-3 anim-rise" aria-labelledby="verify-title">
      <div className="row gap-3">
        <span className="tile tile-round" data-hue="neutral"><Ic name="search" /></span>
        <h1 className="t-heading grow" id="verify-title">{title}</h1>
      </div>
      <p className="t-support">{text}</p>
      <div className="row wrap gap-2 mt-auto">
        {onRetry ? <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}><Ic name="refresh" />Coba lagi</button> : null}
        <Link className="btn btn-ghost btn-sm" to="/"><Ic name="arrow-left" />Ke beranda</Link>
      </div>
    </section>
  );
}

/**
 * Public, read-only check of an Academy certificate. It confirms Academy issuance only;
 * it is not a government licence or third-party accreditation. No login is required.
 */
export default function VerifyCertificate() {
  const { publicId = "" } = useParams();
  const wellFormed = /^[a-f0-9]{32}$/.test(publicId);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["publicCertificate", publicId],
    queryFn: () => nativeApi.publicCertificates.verify(publicId),
    enabled: wellFormed,
    retry: false,
  });

  if (!wellFormed || (error && /** @type {any} */ (error).status === 404)) {
    return <Frame><ProblemCard title="Sertifikat tidak ditemukan" text="Periksa kembali tautan atau kode QR. Tautan ini tidak cocok dengan sertifikat yang diterbitkan Academy." /></Frame>;
  }
  if (error) {
    return <Frame><ProblemCard title="Verifikasi belum dapat dilakukan" text="Periksa koneksi lalu coba lagi." onRetry={() => refetch()} /></Frame>;
  }
  if (isLoading || !data) {
    return (
      <Frame>
        <section className="card feature stack items-center gap-3" style={{ padding: "32px 24px" }} aria-busy="true" aria-label="Memeriksa sertifikat">
          <span className="skel" style={{ width: 56, height: 56, borderRadius: "50%" }} />
          <span className="skel" style={{ width: 200, height: 14 }} />
          <span className="skel" style={{ width: 260, height: 32 }} />
          <span className="skel" style={{ width: "100%", height: 160, marginTop: 12 }} />
        </section>
      </Frame>
    );
  }

  return <Frame><VerifiedCard data={data} /></Frame>;
}
