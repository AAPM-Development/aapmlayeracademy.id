import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Page } from "@/design-system/patterns/AppShell";
import { StatTile } from "@/components/academy/CourseElements";
import { hueFor } from "@/design-system/components/display";
import { Button, IconButton, IconTile, PageHeader, SectionHeader, useToast } from "@/components/primitives";
import { useCertificates, useCertificationEligibility, useClaimCertificate } from "@/lib/useCourseData";
import { newRequestKey } from "@/api/nativeClient";
import { downloadVerifiedCertificatePdf } from "@/lib/certificatePdf";
import AapmIcon from "@/components/icons/AapmIcon";

const STATUS_COPY = {
  locked: { label: "Terkunci", tone: "neutral" },
  in_progress: { label: "Sedang berjalan", tone: "info" },
  eligible: { label: "Siap diklaim", tone: "success" },
  issued: { label: "Dimiliki", tone: "success" },
  revoked: { label: "Dicabut", tone: "danger" },
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

function TierCard({ tier, onClaim, pending, onDownload, downloading }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const status = tier.status;
  const copy = STATUS_COPY[status] || STATUS_COPY.locked;
  const verified = !tier.emailVerificationRequired;
  let action = null;
  if (status === "locked" || status === "in_progress") {
    action = status === "locked"
      ? <Button variant="secondary" size="sm" onClick={() => setDetailsOpen((value) => !value)}>Lihat persyaratan</Button>
      : <Button asChild variant="secondary" size="sm"><Link to="/modules">Lanjutkan belajar</Link></Button>;
  } else if (status === "eligible") {
    action = verified
      ? <Button variant="learn" size="sm" loading={pending} disabled={pending} onClick={() => onClaim(tier.tierNumber)}>Klaim sertifikat</Button>
      : <Button asChild variant="learn" size="sm"><Link to="/profile">Verifikasi email dulu</Link></Button>;
  } else if (status === "issued") {
    action = <Button variant="learn" size="sm" loading={downloading} disabled={downloading} onClick={() => onDownload(tier.existingCertificate)}>Unduh sertifikat</Button>;
  } else if (status === "revoked") {
    action = <Button variant="secondary" size="sm" onClick={() => setDetailsOpen((value) => !value)}>Lihat status</Button>;
  }
  const legacyCount = tier.legacyRecords?.length || 0;

  return (
    <article className="aapm-card grid gap-3 p-4" data-hue={hueFor(tier.tierNumber)} aria-labelledby={`tier-${tier.tierNumber}`}>
      <div className="flex items-start gap-3">
        <IconTile icon="certificate" hue={hueFor(tier.tierNumber)} size="md" shape="circle" />
        <div className="min-w-0 flex-1">
          <p className="aapm-text-overline m-0">Tingkat {tier.tierNumber}</p>
          <h3 id={`tier-${tier.tierNumber}`} className="aapm-text-label m-0">{tier.tierName}</h3>
          <p className="aapm-text-caption m-0" data-tone={copy.tone}>{copy.label} · {tier.completedRequiredModules}/{tier.totalRequiredModules} modul wajib</p>
        </div>
      </div>
      {status === "issued" && tier.existingCertificate ? (
        <p className="aapm-text-caption m-0">Diterbitkan {String(tier.existingCertificate.issuedAt).slice(0, 10)}</p>
      ) : null}
      {status === "revoked" ? (
        <p className="aapm-text-caption m-0">Sertifikat ini dicabut oleh pengelola Academy dan tidak lagi berlaku.</p>
      ) : null}
      {tier.emailVerificationRequired && status === "eligible" ? (
        <p className="aapm-text-caption m-0">Verifikasi email diperlukan sebelum sertifikat dapat diklaim.</p>
      ) : null}
      {(detailsOpen || status === "eligible") && missingText(tier) ? <p className="aapm-text-caption m-0">{missingText(tier)}</p> : null}
      {legacyCount ? (
        <p className="aapm-text-caption m-0">Riwayat lama: {legacyCount} catatan belum terverifikasi. Catatan ini tidak dihitung sebagai sertifikat terverifikasi.</p>
      ) : null}
      <div className="flex flex-wrap gap-2">{action}</div>
    </article>
  );
}

export default function Certification() {
  const { data: eligibility, isLoading } = useCertificationEligibility();
  const { data: certificates = [] } = useCertificates();
  const claim = useClaimCertificate();
  const { toast } = useToast();
  const [pendingTier, setPendingTier] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  // One key per tier until the server answers, so a retry after a lost response cannot issue twice.
  const keys = useRef({});

  const tiers = eligibility?.tiers ?? [];
  const issuedCount = tiers.filter((tier) => tier.status === "issued").length;
  const eligibleCount = tiers.filter((tier) => tier.status === "eligible").length;
  const verifiedCertificates = certificates.filter((item) => item.source !== "legacy_unverified");
  const legacyCertificates = certificates.filter((item) => item.source === "legacy_unverified");

  const onClaim = async (tierNumber) => {
    keys.current[tierNumber] ??= newRequestKey();
    setPendingTier(tierNumber);
    try {
      const reply = await claim.mutateAsync({ tierNumber, requestKey: keys.current[tierNumber] });
      delete keys.current[tierNumber];
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

  const download = async (certificate) => {
    setDownloadingId(certificate?.publicId);
    try {
      await downloadVerifiedCertificatePdf(certificate);
    } catch (error) {
      toast({ variant: "destructive", title: "Sertifikat belum dapat diunduh", description: error?.message || "Coba lagi." });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Page>
      <PageHeader title="Sertifikasi Academy" description="Sertifikat diterbitkan oleh server setelah persyaratan belajar dan penilaian terverifikasi." />

      <section className="aapm-stat-grid" aria-label="Ringkasan sertifikasi">
        <StatTile icon="certificate" hue="violet" label="Sertifikat terverifikasi" value={`${issuedCount}/${tiers.length || 6}`} />
        <StatTile icon="check" hue="green" label="Siap diklaim" value={String(eligibleCount)} />
      </section>

      <section aria-labelledby="tiers-title">
        <SectionHeader id="tiers-title" title="Tingkat sertifikasi" description="Setiap tingkat memerlukan modul tingkat itu dan seluruh tingkat sebelumnya." />
        {isLoading ? <p className="aapm-text-caption">Memuat persyaratan…</p> : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tiers.map((tier) => (
            <TierCard
              key={tier.tierNumber}
              tier={tier}
              onClaim={onClaim}
              pending={pendingTier === tier.tierNumber}
              onDownload={download}
              downloading={downloadingId === tier.existingCertificate?.publicId}
            />
          ))}
        </div>
        {tiers.some((tier) => tier.status === "in_progress" || tier.status === "locked") ? (
          <p className="mt-3 text-caption text-muted-foreground">
            Ujian akhir untuk Tingkat 6 tersedia setelah semua modul wajib terverifikasi. <Link to="/final-exam">Buka ujian akhir</Link>
          </p>
        ) : null}
      </section>

      <section aria-labelledby="my-certs-title">
        <SectionHeader id="my-certs-title" title="Sertifikat saya" description="Hanya sertifikat yang diterbitkan server dapat diunduh dan diverifikasi." />
        {verifiedCertificates.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {verifiedCertificates.map((certificate) => (
              <article key={certificate.publicId || certificate.id} className="aapm-card flex-row items-center gap-3 p-4" data-hue="violet">
                <IconTile icon="certificate" hue={hueFor(Number(certificate.tierNumber) || 1)} size="lg" shape="circle" />
                <div className="min-w-0 flex-1">
                  <p className="aapm-text-label m-0 truncate">{certificate.tierName}</p>
                  <p className="aapm-text-caption m-0">{String(certificate.issuedAt).slice(0, 10)} · Terverifikasi</p>
                </div>
                <IconButton label="Unduh PDF" icon="download" variant="secondary" disabled={downloadingId === certificate.publicId} onClick={() => download(certificate)} />
              </article>
            ))}
          </div>
        ) : (
          <p className="aapm-text-caption">Belum ada sertifikat terverifikasi.</p>
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
    </Page>
  );
}
