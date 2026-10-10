import React from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, Skeleton, StateView } from "@/design-system";
import { Page } from "@/design-system/patterns/AppShell";
import AapmIcon from "@/components/icons/AapmIcon";
import { nativeApi } from "@/api/nativeClient";
import { tierAccent } from "@/components/certificate/CertificateDocument";

/**
 * Public, read-only check of an Academy certificate. It confirms Academy issuance only;
 * it is not a government licence or third-party accreditation. No login is required.
 */
export default function VerifyCertificate() {
  const { publicId = "" } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["publicCertificate", publicId],
    queryFn: () => nativeApi.publicCertificates.verify(publicId),
    enabled: /^[a-f0-9]{32}$/.test(publicId),
    retry: false,
  });

  if (!/^[a-f0-9]{32}$/.test(publicId) || (error && /** @type {any} */ (error).status === 404)) {
    return (
      <Page width="narrow" className="min-h-[60vh] justify-center">
        <StateView kind="empty" icon="certificate" title="Sertifikat tidak ditemukan" description="Periksa kembali tautan atau kode QR. Tautan ini tidak cocok dengan sertifikat yang diterbitkan Academy." action={<Button asChild variant="secondary"><Link to="/"><AapmIcon name="arrowLeft" />Ke beranda</Link></Button>} />
      </Page>
    );
  }
  if (error) {
    return (
      <Page width="narrow" className="min-h-[60vh] justify-center">
        <StateView kind="empty" icon="certificate" title="Verifikasi belum dapat dilakukan" description="Periksa koneksi lalu muat ulang halaman ini." />
      </Page>
    );
  }
  if (isLoading || !data) {
    return <Page width="narrow"><Skeleton className="h-3 w-full" /><Skeleton className="h-10 w-3/4" /><Skeleton className="h-40 w-full" /></Page>;
  }

  const valid = data.valid === true;
  const revoked = data.status === "revoked";
  return (
    <Page width="narrow">
      <section className="aapm-card grid gap-4 p-6" data-hue={valid ? "green" : "orange"} aria-labelledby="verify-title">
        <div className="flex items-center gap-3">
          <span className="aapm-medal" data-status={valid ? "issued" : "locked"} style={/** @type {React.CSSProperties} */ ({ "--medal": tierAccent(data.tierNumber).accent, "--medal-ink": tierAccent(data.tierNumber).ink, "--medal-tint": tierAccent(data.tierNumber).tint })} aria-hidden="true">
            <span className="aapm-medal__face">{data.tierNumber}</span>
            {valid ? <span className="aapm-medal__badge"><AapmIcon name="glyphCheck" /></span> : null}
          </span>
          <p className="aapm-text-overline m-0">Verifikasi sertifikat Academy</p>
        </div>
        <h1 id="verify-title" className="aapm-text-title m-0">
          {valid ? "Sertifikat valid" : revoked ? "Sertifikat dicabut" : "Sertifikat belum dapat dipastikan"}
        </h1>
        <p className="aapm-text-body m-0">
          {valid
            ? "Sertifikat ini diterbitkan oleh server AAPM Layer Academy dan masih berlaku."
            : revoked
              ? "Sertifikat ini pernah diterbitkan, tetapi telah dicabut dan tidak lagi berlaku."
              : "Catatan penerbitan untuk sertifikat ini belum lengkap."}
        </p>
        <dl className="grid gap-2 text-body">
          <div><dt className="aapm-text-caption">Tingkat</dt><dd className="m-0">{data.tierName}</dd></div>
          <div><dt className="aapm-text-caption">Nama pemegang</dt><dd className="m-0">{data.holderName}</dd></div>
          <div><dt className="aapm-text-caption">Tanggal terbit</dt><dd className="m-0">{String(data.issuedAt).slice(0, 10)}</dd></div>
          <div><dt className="aapm-text-caption">ID sertifikat</dt><dd className="m-0 break-all font-mono text-sm">{data.publicId}</dd></div>
        </dl>
        <p className="aapm-text-caption m-0">{data.verificationSource}. Verifikasi ini memastikan penerbitan oleh Academy, bukan lisensi pemerintah atau akreditasi pihak ketiga.</p>
      </section>
    </Page>
  );
}
