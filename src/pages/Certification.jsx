import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Page } from "@/design-system/patterns/AppShell";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, IconButton, Progress, SectionHeader, useToast } from "@/components/primitives";
import { useCertificates, useCertificationEligibility, useClaimCertificate } from "@/lib/useCourseData";
import { newRequestKey } from "@/api/nativeClient";
import { downloadCertificateImage, downloadVerifiedCertificatePdf } from "@/lib/certificatePdf";
import { copyText } from "@/lib/clipboard";
import { celebrate } from "@/lib/celebrate";
import AapmIcon from "@/components/icons/AapmIcon";
import AppiMascot from "@/components/appi/AppiMascot";
import { CertificatePreview, tierAccent } from "@/components/certificate/CertificateDocument";

const STATUS_COPY = {
  locked: { label: "Terkunci", tone: "locked", icon: "lock" },
  in_progress: { label: "Sedang berjalan", tone: "progress", icon: "pending" },
  eligible: { label: "Siap diklaim", tone: "eligible", icon: "award" },
  issued: { label: "Dimiliki", tone: "issued", icon: "check" },
  revoked: { label: "Dicabut", tone: "revoked", icon: "warning" },
};

function missingText(tier) {
  if (tier.missingModuleNumbers.length) {
    const count = tier.missingModuleNumbers.length;
    return `Masih perlu menyelesaikan ${count} modul.`;
  }
  if (tier.requiresFinal && !tier.finalPassed) {
    return "Semua modul sudah tuntas. Masih perlu lulus ujian akhir dengan nilai minimal 80%.";
  }
  return "";
}

function verificationPath(certificate) {
  const url = certificate?.verificationUrl;
  if (!url) return certificate?.publicId ? `/verify-certificate/${certificate.publicId}` : "";
  try { return new URL(url).pathname; } catch { return url; }
}

/** Tier medal: number in the tier colour, a check when owned, a lock when locked. */
function Medal({ tier, status, size = "md" }) {
  const colors = tierAccent(tier.tierNumber);
  return (
    <span className="aapm-medal" data-status={status} data-size={size} style={/** @type {React.CSSProperties} */ ({ "--medal": colors.accent, "--medal-ink": colors.ink, "--medal-tint": colors.tint })} aria-hidden="true">
      <span className="aapm-medal__face">{status === "locked" ? <AapmIcon name="lock" /> : tier.tierNumber}</span>
      {status === "issued" ? <span className="aapm-medal__badge"><AapmIcon name="glyphCheck" /></span> : null}
    </span>
  );
}

function TierCard({ tier, onClaim, pending, onOpen }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const status = tier.status;
  const copy = STATUS_COPY[status] || STATUS_COPY.locked;
  const verified = !tier.emailVerificationRequired;
  const percent = tier.totalRequiredModules ? Math.round((tier.completedRequiredModules / tier.totalRequiredModules) * 100) : 0;
  let action = null;
  if (status === "locked" || status === "in_progress") {
    action = status === "locked"
      ? <Button variant="ghost" size="sm" onClick={() => setDetailsOpen((value) => !value)}>{detailsOpen ? "Tutup persyaratan" : "Lihat persyaratan"}</Button>
      : tier.requiresFinal && !tier.missingModuleNumbers.length
        ? <Button asChild variant="learn" size="sm"><Link to="/final-exam"><AapmIcon name="exam" />Ikuti ujian akhir</Link></Button>
        : <Button asChild variant="secondary" size="sm"><Link to="/modules">Lanjutkan belajar<AapmIcon name="arrowRight" /></Link></Button>;
  } else if (status === "eligible") {
    action = verified
      ? <Button variant="learn" size="sm" loading={pending} disabled={pending} onClick={() => onClaim(tier.tierNumber)}><AapmIcon name="award" />Klaim sertifikat</Button>
      : <Button asChild variant="learn" size="sm"><Link to="/profile">Verifikasi email dulu</Link></Button>;
  } else if (status === "issued") {
    action = <Button variant="secondary" size="sm" onClick={() => onOpen(tier.existingCertificate)}><AapmIcon name="certificate" />Lihat sertifikat</Button>;
  } else if (status === "revoked") {
    action = <Button variant="ghost" size="sm" onClick={() => setDetailsOpen((value) => !value)}>Lihat status</Button>;
  }
  const legacyCount = tier.legacyRecords?.length || 0;
  const colors = tierAccent(tier.tierNumber);

  return (
    <article className="aapm-tier-card" data-status={status} style={/** @type {React.CSSProperties} */ ({ "--medal": colors.accent, "--medal-ink": colors.ink, "--medal-tint": colors.tint })} aria-labelledby={`tier-${tier.tierNumber}`}>
      <div className="aapm-tier-card__head">
        <Medal tier={tier} status={status} />
        <span className="aapm-tier-card__status" data-tone={copy.tone}><AapmIcon name={copy.icon} />{copy.label}</span>
      </div>
      <div className="aapm-tier-card__body">
        <p className="aapm-tier-card__eyebrow">Tingkat {tier.tierNumber}{tier.requiresFinal ? " · Ujian akhir" : ""}</p>
        <h3 id={`tier-${tier.tierNumber}`} className="aapm-tier-card__title">{tier.tierName}</h3>
      </div>
      <div className="aapm-tier-card__progress">
        <Progress value={percent} label={`Progres ${tier.tierName}`} />
        <span>{tier.completedRequiredModules}/{tier.totalRequiredModules} modul wajib</span>
      </div>
      {status === "issued" && tier.existingCertificate ? (
        <p className="aapm-tier-card__note">Diterbitkan {String(tier.existingCertificate.issuedAt).slice(0, 10)}</p>
      ) : null}
      {status === "revoked" && detailsOpen ? <p className="aapm-tier-card__note">Sertifikat ini dicabut oleh pengelola Academy dan tidak lagi berlaku.</p> : null}
      {tier.emailVerificationRequired && status === "eligible" ? <p className="aapm-tier-card__note">Verifikasi email diperlukan sebelum sertifikat dapat diklaim.</p> : null}
      {(detailsOpen || status === "eligible" || status === "in_progress") && missingText(tier) ? <p className="aapm-tier-card__note">{missingText(tier)}</p> : null}
      {legacyCount ? <p className="aapm-tier-card__note">Riwayat lama: {legacyCount} catatan belum terverifikasi dan tidak dihitung.</p> : null}
      <div className="aapm-tier-card__actions">{action}</div>
    </article>
  );
}

/** One owned certificate: the real document as a thumbnail, with its actions. */
function OwnedCertificate({ certificate, onOpen, onPdf, onPng, onCopy, busy }) {
  return (
    <article className="aapm-owned-cert">
      <button type="button" className="aapm-owned-cert__thumb" onClick={() => onOpen(certificate)} aria-label={`Lihat ${certificate.tierName}`}>
        <CertificatePreview certificate={certificate} />
      </button>
      <div className="aapm-owned-cert__meta">
        <p className="aapm-owned-cert__title">{certificate.tierName}</p>
        <p className="aapm-owned-cert__sub"><AapmIcon name="check" />Terverifikasi · {String(certificate.issuedAt).slice(0, 10)}</p>
      </div>
      <div className="aapm-owned-cert__actions">
        <Button variant="learn" size="sm" loading={busy === "pdf"} disabled={Boolean(busy)} onClick={() => onPdf(certificate)}><AapmIcon name="download" />PDF</Button>
        <Button variant="secondary" size="sm" loading={busy === "png"} disabled={Boolean(busy)} onClick={() => onPng(certificate)}>PNG</Button>
        <IconButton label="Salin tautan verifikasi" icon="link" variant="ghost" onClick={() => onCopy(certificate)} />
      </div>
    </article>
  );
}

export default function Certification() {
  const { data: eligibility, isLoading } = useCertificationEligibility();
  const { data: certificates = [] } = useCertificates();
  const claim = useClaimCertificate();
  const { toast } = useToast();
  const [pendingTier, setPendingTier] = useState(null);
  const [busy, setBusy] = useState({ id: null, kind: null });
  const [viewing, setViewing] = useState(null);
  // One key per tier until the server answers, so a retry after a lost response cannot issue twice.
  const keys = useRef({});

  const tiers = eligibility?.tiers ?? [];
  const issuedCount = tiers.filter((tier) => tier.status === "issued").length;
  const eligibleCount = tiers.filter((tier) => tier.status === "eligible").length;
  const verifiedCertificates = certificates.filter((item) => item.source !== "legacy_unverified");
  const legacyCertificates = certificates.filter((item) => item.source === "legacy_unverified");
  const total = tiers.length || 6;
  const coach = eligibleCount
    ? { mood: "cheer", line: `${eligibleCount} sertifikat siap diklaim. Ayo ambil!` }
    : issuedCount === total
      ? { mood: "proud", line: "Semua tingkat sudah Anda raih. Luar biasa!" }
      : issuedCount
        ? { mood: "happy", line: `${issuedCount} dari ${total} tingkat diraih. Lanjutkan!` }
        : { mood: "wink", line: "Tuntaskan modul tingkat 1 untuk sertifikat pertama Anda." };

  const onClaim = async (tierNumber) => {
    keys.current[tierNumber] ??= newRequestKey();
    setPendingTier(tierNumber);
    try {
      const reply = await claim.mutateAsync({ tierNumber, requestKey: keys.current[tierNumber] });
      delete keys.current[tierNumber];
      if (reply.created) celebrate("milestone");
      setViewing(reply.certificate);
      toast({
        title: reply.created ? "Sertifikat diterbitkan" : "Sertifikat sudah tersedia",
        description: `${reply.certificate.tierName} siap diunduh dan diverifikasi.`,
      });
    } catch (error) {
      // A server refusal ends the attempt. A lost response keeps the key so a retry is idempotent.
      if (error?.status) delete keys.current[tierNumber];
      toast({ variant: "destructive", title: "Sertifikat belum diterbitkan", description: error?.message || "Periksa koneksi lalu coba lagi." });
    } finally {
      setPendingTier(null);
    }
  };

  const exportAs = async (certificate, kind) => {
    setBusy({ id: certificate?.publicId, kind });
    try {
      if (kind === "png") await downloadCertificateImage(certificate);
      else await downloadVerifiedCertificatePdf(certificate);
    } catch (error) {
      toast({ variant: "destructive", title: "Sertifikat belum dapat diunduh", description: error?.message || "Coba lagi." });
    } finally {
      setBusy({ id: null, kind: null });
    }
  };

  const copyLink = async (certificate) => {
    const url = certificate?.verificationUrl || `${window.location.origin}${verificationPath(certificate)}`;
    const copied = await copyText(url);
    toast({ title: copied ? "Tautan verifikasi disalin" : "Tautan belum tersalin", description: copied ? "Bagikan ke atasan atau HR untuk memeriksa keaslian." : url });
  };

  const busyFor = (certificate) => (busy.id === certificate?.publicId ? busy.kind : null);

  return (
    <Page>
      <section className="aapm-cert-hero" aria-labelledby="cert-hero-title">
        <div className="aapm-cert-hero__copy">
          <p className="aapm-cert-hero__eyebrow">Sertifikasi Academy</p>
          <h1 id="cert-hero-title" className="aapm-cert-hero__title">{issuedCount} dari {total} tingkat diraih</h1>
          <p className="aapm-cert-hero__text">Sertifikat diterbitkan oleh server setelah persyaratan belajar dan penilaian terverifikasi, lengkap dengan kode QR untuk diperiksa siapa pun.</p>
          <ol className="aapm-medal-path" aria-label="Jalur enam tingkat sertifikasi">
            {tiers.map((tier) => (
              <li key={tier.tierNumber} data-status={tier.status}>
                <Medal tier={tier} status={tier.status} size="sm" />
                <span className="aapm-visually-hidden">Tingkat {tier.tierNumber}: {(STATUS_COPY[tier.status] || STATUS_COPY.locked).label}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="aapm-cert-hero__appi">
          <p className="aapm-cert-hero__bubble">{coach.line}</p>
          <AppiMascot mood={coach.mood} size="xl" />
        </div>
      </section>

      <section aria-labelledby="tiers-title">
        <SectionHeader id="tiers-title" title="Tingkat sertifikasi" description="Setiap tingkat memerlukan modul tingkat itu dan seluruh tingkat sebelumnya." />
        {isLoading ? <p className="aapm-text-caption">Memuat persyaratan…</p> : null}
        <div className="aapm-tier-grid">
          {tiers.map((tier) => (
            <TierCard
              key={tier.tierNumber}
              tier={tier}
              onClaim={onClaim}
              pending={pendingTier === tier.tierNumber}
              onOpen={setViewing}
            />
          ))}
        </div>
        {tiers.some((tier) => tier.status === "in_progress" || tier.status === "locked") ? (
          <p className="mt-3 text-caption text-muted-foreground">
            Ujian akhir untuk Tingkat 6 tersedia setelah semua modul wajib terverifikasi. <Link className="aapm-link" to="/final-exam">Buka ujian akhir</Link>
          </p>
        ) : null}
      </section>

      <section aria-labelledby="my-certs-title">
        <SectionHeader id="my-certs-title" title="Sertifikat saya" description="Unduh PDF untuk dicetak atau PNG untuk dibagikan. Keduanya sama persis dengan tampilan di sini." />
        {verifiedCertificates.length ? (
          <div className="aapm-owned-grid">
            {verifiedCertificates.map((certificate) => (
              <OwnedCertificate
                key={certificate.publicId || certificate.id}
                certificate={certificate}
                onOpen={setViewing}
                onPdf={(item) => exportAs(item, "pdf")}
                onPng={(item) => exportAs(item, "png")}
                onCopy={copyLink}
                busy={busyFor(certificate)}
              />
            ))}
          </div>
        ) : (
          <div className="aapm-owned-empty">
            <AapmIcon name="certificate" />
            <p>Belum ada sertifikat terverifikasi. Klaim tingkat yang sudah siap untuk menerbitkannya.</p>
          </div>
        )}
      </section>

      {legacyCertificates.length ? (
        <section aria-labelledby="legacy-certs-title">
          <SectionHeader id="legacy-certs-title" title="Riwayat lama" description="Catatan dari sistem sebelumnya. Tidak dihitung sebagai sertifikat terverifikasi dan tidak dapat diunduh." />
          <ul className="grid list-none gap-2 p-0">
            {legacyCertificates.map((certificate) => (
              <li key={`legacy-${certificate.id}`} className="aapm-card flex-row items-center gap-3 p-3">
                <AapmIcon name="certificate" />
                <div className="min-w-0 flex-1">
                  <p className="aapm-text-label m-0 truncate">{certificate.tierName}</p>
                  <p className="aapm-text-caption m-0">Belum terverifikasi · {String(certificate.issuedAt).slice(0, 10)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent size="xl" className="aapm-cert-dialog">
          <DialogTitle>{viewing?.tierName}</DialogTitle>
          <DialogDescription>Diterbitkan {String(viewing?.issuedAt || "").slice(0, 10)} · dapat diverifikasi lewat kode QR.</DialogDescription>
          {viewing ? <CertificatePreview certificate={viewing} className="aapm-cert-dialog__doc" /> : null}
          <div className="aapm-cert-dialog__actions">
            <Button variant="learn" loading={busyFor(viewing) === "pdf"} disabled={Boolean(busyFor(viewing))} onClick={() => exportAs(viewing, "pdf")}><AapmIcon name="download" />Unduh PDF</Button>
            <Button variant="secondary" loading={busyFor(viewing) === "png"} disabled={Boolean(busyFor(viewing))} onClick={() => exportAs(viewing, "png")}>Unduh PNG</Button>
            <Button variant="ghost" onClick={() => copyLink(viewing)}><AapmIcon name="link" />Salin tautan</Button>
            {verificationPath(viewing) ? <Button asChild variant="ghost"><Link to={verificationPath(viewing)}><AapmIcon name="shield" />Halaman verifikasi</Link></Button> : null}
          </div>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
