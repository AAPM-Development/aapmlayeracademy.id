import React, { useState } from "react";
import { Link } from "react-router-dom";
import ContentContainer from "@/components/layout/ContentContainer";
import PageHeader from "@/components/layout/PageHeader";
import CertificationPath from "@/components/academy/CertificationPath";
import { Badge, Button, IconTile, KPICluster, Surface, useToast } from "@/components/primitives";
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

  return (
    <ContentContainer className="max-w-6xl">
      <PageHeader
        eyebrow="Prestasi"
        title="Sertifikasi profesional"
        description="Setiap tier merangkum kemampuan yang dibangun dari modul, praktik, dan evaluasi—bukan sekadar angka progres."
        actions={<Badge variant="soft" className="bg-tint-orange text-tint-orange-foreground"><AapmIcon name="award" className="h-3.5 w-3.5" /> 6 tingkat</Badge>}
      />

      <section className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)]">
        <Surface tone="green" className="relative overflow-hidden p-5 sm:p-7">
          <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full border-[16px] border-brand-lime/15" />
          <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div className="max-w-xl"><Badge variant="soft" className="bg-background/80 text-[10px] uppercase tracking-[0.14em] text-brand-green">Perkembangan Anda</Badge><h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">Bangun bukti dari setiap keputusan.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Selesaikan modul yang relevan, jaga kualitas pemahaman, lalu gunakan ujian akhir saat fondasi Anda sudah siap.</p></div>
            <div className="shrink-0 rounded-xl border border-tint-green-border bg-background/80 px-4 py-3"><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Progress kurikulum</div><div className="mt-1 text-2xl font-semibold tabular-nums">{curriculumPercent}%</div><div className="mt-2 h-1.5 w-36 overflow-hidden rounded-full bg-foreground/10"><div className="h-full rounded-full bg-brand-green" style={{ width: `${curriculumPercent}%` }} /></div></div>
          </div>
        </Surface>
        <Surface className="flex flex-col justify-between p-5 sm:p-7"><div className="flex items-start gap-3"><IconTile icon="graduation" tone={finalExamPassed ? "green" : "orange"} size="lg" /><div><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-orange">Evaluasi akhir</div><h2 className="mt-1 text-lg font-semibold">Tingkat 6 · Ahli</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">{finalExamPassed ? "Ujian akhir sudah lulus. Sertifikat ahli tersedia." : `Pastikan ${totalModules} modul sudah Anda kuasai sebelum mengirim jawaban.`}</p></div></div><Button asChild className="mt-5 w-full" variant={finalExamPassed ? "outline" : "default"}><Link to={finalExamPassed ? "/profile" : "/final-exam"}>{finalExamPassed ? "Lihat profil & sertifikat" : "Buka ujian akhir"}<AapmIcon name="arrowRight" /></Link></Button></Surface>
      </section>

      <KPICluster
        className="mb-7 aapm-certification-kpi"
        label="Ringkasan sertifikasi"
        columns={3}
        variant="cards"
        items={[
          {
            icon: "book",
            label: "Tingkat belajar",
            value: "14",
            note: `${completedModules} modul selesai`,
            tone: "success",
            colorway: 1,
            emphasis: "solid",
          },
          {
            icon: "fileCheck",
            label: "Modul inti",
            value: String(totalModules),
            note: "Roadmap Academy",
            tone: "info",
            colorway: 2,
            emphasis: "solid",
          },
          {
            icon: "approve",
            label: "Tingkat profesional",
            value: "6",
            note: `${certificates.length} sertifikat dimiliki`,
            tone: "warning",
            colorway: 3,
            emphasis: "solid",
          },
        ]}
      />

      <section><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brand-orange">Jalur sertifikasi</div><h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">Pilih bukti kompetensi berikutnya</h2><p className="mt-1 text-sm text-muted-foreground">Status tingkat berubah berdasarkan progress yang tersimpan di akun Anda.</p></div><span className="text-xs text-muted-foreground">{certificates.length} sertifikat tersimpan</span></div><CertificationPath modules={modules} progress={progress} certificates={certificates} onClaim={claim} claiming={issue.isPending} /></section>

      {certificates.length > 0 && <section className="mt-8"><div className="mb-3 flex items-end justify-between gap-3"><div><div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brand-orange">Bukti tersimpan</div><h2 className="mt-1 text-lg font-semibold">Sertifikat saya</h2><p className="mt-1 text-xs text-muted-foreground">Setiap kartu adalah bukti yang diterbitkan dari progress dan evaluasi akun ini.</p></div><Link to="/profile" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-green hover:underline">Buka profil <AapmIcon name="arrowRight" className="h-3.5 w-3.5" /></Link></div><div className="grid gap-3 md:grid-cols-2">{certificates.map((certificate) => <Surface key={certificate.id} variant="interactive" className="aapm-certificate-card flex flex-col gap-4 p-4 sm:p-5"><div className="flex items-start gap-3"><IconTile icon="award" tone="orange" size="md" /><div className="min-w-0 flex-1"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-orange">Tingkat {certificate.levelNumber}</div><div className="mt-1 text-sm font-semibold">{certificate.levelName}</div><div className="mt-1 text-xs text-muted-foreground">{certificate.holderName} · Nilai {certificate.score}%</div><div className="mt-1 text-[11px] text-muted-foreground">Diterbitkan {certificate.issuedAt ? new Date(certificate.issuedAt).toLocaleDateString("id-ID") : "—"}</div></div></div><div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3"><Badge variant="soft" className="bg-tint-green text-tint-green-foreground">Bukti valid di akun</Badge><Button type="button" variant="outline" size="sm" onClick={async () => { setDownloadingId(certificate.id); try { await downloadCertificatePdf(certificate); } catch (error) { toast({ variant: "destructive", title: "Sertifikat belum dapat diunduh", description: error?.message || "Coba lagi." }); } finally { setDownloadingId(null); } }} disabled={downloadingId === certificate.id}><AapmIcon name={downloadingId === certificate.id ? "refresh" : "download"} className={downloadingId === certificate.id ? "animate-spin" : undefined} />{downloadingId === certificate.id ? "Menyiapkan…" : "Unduh PDF"}</Button></div></Surface>)}</div></section>}
    </ContentContainer>
  );
}
