import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Page } from "@/design-system/patterns/AppShell";
import { StatTile } from "@/components/academy/CourseElements";
import { hueFor } from "@/design-system/components/display";
import CertificationPath from "@/components/academy/CertificationPath";
import { Badge, Button, IconButton, IconTile, PageHeader, SectionHeader, useToast } from "@/components/primitives";
import { useCertificates, useIssueCertificate, useModules, useUserProgress } from "@/lib/useCourseData";
import { getProgressSummary, TOTAL_MODULES } from "@/lib/academyData";
import AapmIcon from "@/components/icons/AapmIcon";
import { useAuth } from "@/lib/AuthContext";

async function downloadCertificatePdf(certificate) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  doc.setFillColor(247, 250, 247);
  doc.rect(0, 0, width, height, "F");
  doc.setDrawColor(49, 129, 57);
  doc.setLineWidth(1.2);
  doc.rect(12, 12, width - 24, height - 24);
  doc.setTextColor(49, 129, 57);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("AAPM LAYER ACADEMY", width / 2, 30, { align: "center" });
  doc.setTextColor(34, 34, 34);
  doc.setFontSize(28);
  doc.text("SERTIFIKAT KOMPETENSI", width / 2, 58, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("diberikan kepada", width / 2, 72, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(String(certificate.holderName || "Peserta Academy"), width / 2, 88, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(`Atas pencapaian ${certificate.levelName || `Tingkat ${certificate.levelNumber}`}`, width / 2, 103, { align: "center" });
  doc.text(`Nilai ${Number(certificate.score || 0)}% · ${certificate.examType || "level"}`, width / 2, 112, { align: "center" });
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.text(`Diterbitkan ${certificate.issuedAt ? new Date(certificate.issuedAt).toLocaleDateString("id-ID") : "AAPM Academy"}`, width / 2, 132, { align: "center" });
  doc.text(`ID sertifikat: ${certificate.id}`, width / 2, 139, { align: "center" });
  const slug = String(certificate.levelName || `tingkat-${certificate.levelNumber}`).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  doc.save(`sertifikat-aapm-${slug || "academy"}.pdf`);
}

export default function Certification() {
  const { user } = useAuth();
  const [downloadingId, setDownloadingId] = useState(null);
  const { data: modules = [], isLoading: modulesLoading } = useModules();
  const { data: progress = [] } = useUserProgress();
  const { data: certificates = [] } = useCertificates();
  const issue = useIssueCertificate();
  const issueCertificate = /** @type {any} */ (issue.mutateAsync);
  const { toast } = useToast();
  const progressSummary = getProgressSummary(
    modules,
    progress,
    modulesLoading ? TOTAL_MODULES : 0,
  );
  const completedModules = progressSummary.completed;
  const totalModules = progressSummary.total;
  const finalExamPassed = progress.some((item) => Number(item?.moduleNumber) === 0 && item.completed);
  const curriculumPercent = progressSummary.percent;

  const claim = async (tier) => {
    try {
      await issueCertificate({ levelNumber: tier.number, levelName: tier.name, score: 100, examType: "level", holderName: user?.full_name || user?.email || "Peserta Layer Farm Academy" });
      toast({ title: "Sertifikat diterbitkan", description: `${tier.name} siap dilihat di profil Anda.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Sertifikat belum diterbitkan", description: error.message });
    }
  };

  const download = async (certificate) => {
    setDownloadingId(certificate.id);
    try {
      await downloadCertificatePdf(certificate);
    } catch (error) {
      toast({ variant: "destructive", title: "Sertifikat belum dapat diunduh", description: error?.message || "Coba lagi." });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Page>
      <PageHeader
        eyebrow="Prestasi"
        title="Sertifikasi profesional"
        description="Setiap tingkat merangkum kemampuan dari modul, praktik, dan evaluasi. Klaim saat semua prasyaratnya tuntas."
        actions={<Badge size="lg" icon="certificate">{certificates.length}/6 tingkat dimiliki</Badge>}
      />

      <section className="aapm-stat-grid" aria-label="Ringkasan sertifikasi">
        <StatTile icon="check" hue="green" label="Modul selesai" value={`${completedModules}/${totalModules}`} />
        <StatTile icon="roadmap" hue="blue" label="Progress kurikulum" value={`${curriculumPercent}%`} />
        <StatTile icon="certificate" hue="violet" label="Sertifikat dimiliki" value={certificates.length} />
        <StatTile icon="exam" hue="orange" label="Ujian akhir" value={finalExamPassed ? "Lulus" : "Belum"} />
      </section>

      <section aria-labelledby="cert-path-title">
        <SectionHeader
          id="cert-path-title"
          title="Jalur sertifikasi"
          description="Status tingkat mengikuti progress yang tersimpan di akun Anda."
          actions={!finalExamPassed ? <Button asChild variant="secondary" size="sm"><Link to="/final-exam"><AapmIcon name="exam" />Ujian akhir</Link></Button> : null}
        />
        <CertificationPath modules={modules} progress={progress} certificates={certificates} onClaim={claim} claiming={issue.isPending} />
      </section>

      {certificates.length > 0 ? (
        <section aria-labelledby="my-certs-title">
          <SectionHeader id="my-certs-title" title="Sertifikat saya" description="Unduh PDF untuk dibagikan atau dicetak." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {certificates.map((certificate) => (
              <article key={certificate.id} className="aapm-card flex-row items-center gap-3 p-4" data-hue="violet">
                <IconTile icon="certificate" hue={hueFor(Number(certificate.levelNumber) || 1)} size="lg" shape="circle" />
                <div className="min-w-0 flex-1">
                  <p className="aapm-text-label m-0 truncate">{certificate.levelName}</p>
                  <p className="aapm-text-caption m-0">{certificate.issuedAt ? new Date(certificate.issuedAt).toLocaleDateString("id-ID") : "Diterbitkan"} · nilai {certificate.score}</p>
                </div>
                <IconButton label="Unduh PDF" icon="download" variant="secondary" disabled={downloadingId === certificate.id} onClick={() => download(certificate)} />
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </Page>
  );
}
