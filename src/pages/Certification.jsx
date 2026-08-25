import React from "react";
import { Link } from "react-router-dom";
import ContentContainer from "@/components/layout/ContentContainer";
import PageHeader from "@/components/layout/PageHeader";
import CertificationPath from "@/components/academy/CertificationPath";
import { Badge, Button, IconTile, Surface, useToast } from "@/components/primitives";
import { useCertificates, useIssueCertificate, useUserProgress } from "@/lib/useCourseData";
import AapmIcon from "@/components/icons/AapmIcon";

export default function Certification() {
  const { data: progress = [] } = useUserProgress();
  const { data: certificates = [] } = useCertificates();
  const issue = useIssueCertificate();
  const issueCertificate = /** @type {any} */ (issue.mutateAsync);
  const { toast } = useToast();
  const completedModules = progress.filter((item) => item?.completed && item.moduleNumber !== 0).length;
  const finalExamPassed = progress.some((item) => item.moduleNumber === 0 && item.completed);
  const curriculumPercent = Math.min(100, Math.round((completedModules / 22) * 100));

  const claim = async (tier) => {
    try {
      await issueCertificate({ levelNumber: tier.number, levelName: tier.name, score: 100, examType: "level", holderName: "Peserta Layer Farm Academy" });
      toast({ title: "Sertifikat diterbitkan", description: `${tier.name} siap dilihat di profil Anda.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Sertifikat belum diterbitkan", description: error.message });
    }
  };

  return (
    <ContentContainer className="max-w-6xl">
      <PageHeader
        eyebrow="Achievement"
        title="Professional certification"
        description="Setiap tier merangkum kemampuan yang dibangun dari modul, praktik, dan evaluasi—bukan sekadar angka progres."
        actions={<Badge variant="soft" className="bg-tint-orange text-tint-orange-foreground"><AapmIcon name="award" className="h-3.5 w-3.5" /> 6 tiers</Badge>}
      />

      <section className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)]">
        <Surface tone="green" className="relative overflow-hidden p-5 sm:p-7">
          <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full border-[16px] border-brand-lime/15" />
          <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div className="max-w-xl"><Badge variant="soft" className="bg-background/80 text-[10px] uppercase tracking-[0.14em] text-brand-green">Your progression</Badge><h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">Bangun bukti dari setiap keputusan.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Selesaikan modul yang relevan, jaga kualitas pemahaman, lalu gunakan Final Exam saat fondasi Anda sudah siap.</p></div>
            <div className="shrink-0 rounded-xl border border-tint-green-border bg-background/80 px-4 py-3"><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Curriculum progress</div><div className="mt-1 text-2xl font-semibold tabular-nums">{curriculumPercent}%</div><div className="mt-2 h-1.5 w-36 overflow-hidden rounded-full bg-foreground/10"><div className="h-full rounded-full bg-brand-green" style={{ width: `${curriculumPercent}%` }} /></div></div>
          </div>
        </Surface>
        <Surface className="flex flex-col justify-between p-5 sm:p-7"><div className="flex items-start gap-3"><IconTile icon="graduation" tone={finalExamPassed ? "green" : "orange"} size="lg" /><div><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-orange">Final assessment</div><h2 className="mt-1 text-lg font-semibold">Tier 6 · Expert</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">{finalExamPassed ? "Final Exam sudah lulus. Sertifikat Expert tersedia." : "Pastikan 22 modul sudah Anda kuasai sebelum submit."}</p></div></div><Button asChild className="mt-5 w-full" variant={finalExamPassed ? "outline" : "default"}><Link to={finalExamPassed ? "/profile" : "/final-exam"}>{finalExamPassed ? "Lihat profil & sertifikat" : "Buka Final Exam"}<AapmIcon name="arrowRight" /></Link></Button></Surface>
      </section>

      <div className="mb-7 grid gap-3 sm:grid-cols-3">
        <Metric icon="course" label="Learning levels" value="14" detail={`${completedModules} modul selesai`} tone="green" />
        <Metric icon="modules" label="Core modules" value="22" detail="Roadmap Academy" tone="blue" />
        <Metric icon="award" label="Professional tiers" value="6" detail={`${certificates.length} sertifikat dimiliki`} tone="orange" />
      </div>

      <section><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brand-orange">Certification path</div><h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">Pilih bukti kompetensi berikutnya</h2><p className="mt-1 text-sm text-muted-foreground">Status tier berubah berdasarkan progress yang tersimpan di akun Anda.</p></div><span className="text-xs text-muted-foreground">{certificates.length} sertifikat tersimpan</span></div><CertificationPath progress={progress} certificates={certificates} onClaim={claim} claiming={issue.isPending} /></section>

      {certificates.length > 0 && <section className="mt-8"><div className="mb-3 flex items-end justify-between gap-3"><div><div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brand-orange">My records</div><h2 className="mt-1 text-lg font-semibold">Sertifikat saya</h2></div><Link to="/profile" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-green hover:underline">Buka profil <AapmIcon name="arrowRight" className="h-3.5 w-3.5" /></Link></div><div className="grid gap-3 md:grid-cols-2">{certificates.map((certificate) => <Surface key={certificate.id} variant="interactive" className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div className="flex items-center gap-3"><IconTile icon="award" tone="orange" size="md" /><div><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-orange">Tier {certificate.levelNumber}</div><div className="mt-1 text-sm font-semibold">{certificate.levelName}</div><div className="mt-1 text-xs text-muted-foreground">{certificate.holderName} · Score {certificate.score}%</div></div></div><Button type="button" variant="outline" size="sm" disabled><AapmIcon name="download" /> Unduh PDF</Button></Surface>)}</div></section>}
    </ContentContainer>
  );
}

function Metric({ icon, label, value, detail, tone }) {
  return <Surface tone={tone} className="p-4"><div className="flex items-start justify-between gap-3"><IconTile icon={icon} tone={tone} size="sm" /><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span></div><div className="mt-5 text-2xl font-semibold tracking-[-0.04em]">{value}</div><div className="mt-1 text-xs text-muted-foreground">{detail}</div></Surface>;
}
