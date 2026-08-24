import React from "react";
import { Award, ArrowRight, Download, GraduationCap } from "lucide-react";
import { Link } from "react-router-dom";
import ContentContainer from "@/components/layout/ContentContainer";
import PageHeader from "@/components/layout/PageHeader";
import CertificationPath from "@/components/academy/CertificationPath";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useCertificates, useIssueCertificate, useUserProgress } from "@/lib/useCourseData";

export default function Certification() {
  const { data: progress = [] } = useUserProgress();
  const { data: certificates = [] } = useCertificates();
  const issue = useIssueCertificate();
  const issueCertificate = /** @type {any} */ (issue.mutateAsync);
  const { toast } = useToast();

  const claim = async (tier) => {
    await issueCertificate({ levelNumber: tier.number, levelName: tier.name, score: 100, examType: "level", holderName: "Peserta Layer Farm Academy" });
    toast({ title: "Sertifikat diterbitkan", description: tier.name });
  };

  return (
    <ContentContainer>
      <PageHeader eyebrow="Achievement" title="Professional certification" description="Learning levels mengukur perjalanan belajar. Certification tiers merangkum progres profesional Anda." actions={<div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-subtle px-3 py-2 text-xs text-muted-foreground"><Award className="h-3.5 w-3.5 text-brand-orange" /> 6 tiers</div>} />

      <div className="mb-6 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-border bg-surface-elevated p-4"><div className="text-2xl font-semibold">14</div><div className="mt-1 text-xs text-muted-foreground">Learning levels</div></div><div className="rounded-xl border border-border bg-surface-elevated p-4"><div className="text-2xl font-semibold">22</div><div className="mt-1 text-xs text-muted-foreground">Core modules</div></div><div className="rounded-xl border border-border bg-surface-elevated p-4"><div className="text-2xl font-semibold text-brand-orange">6</div><div className="mt-1 text-xs text-muted-foreground">Professional tiers</div></div></div>

      <Card className="mb-6 overflow-hidden border-foreground/15 bg-foreground text-background shadow-none"><CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-orange/15 text-brand-orange"><GraduationCap className="h-5 w-5" /></div><div><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-orange">Final assessment</div><div className="mt-1 font-semibold">Final Exam untuk Tier 6</div><p className="mt-1 text-xs leading-5 text-background/60">Jumlah soal mengikuti data API saat ini. Passing grade ditetapkan oleh runtime exam.</p></div></div><Button asChild variant="outline" className="border-background/20 bg-transparent text-background hover:bg-background/10 hover:text-background"><Link to="/final-exam">Buka Final Exam <ArrowRight /></Link></Button></CardContent></Card>

      <CertificationPath progress={progress} certificates={certificates} onClaim={claim} claiming={issue.isPending} />

      {certificates.length > 0 && <section className="mt-8"><h2 className="mb-3 text-lg font-semibold">Sertifikat saya</h2><div className="space-y-3">{certificates.map((certificate) => <Card key={certificate.id} className="shadow-none"><CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success"><Award className="h-5 w-5" /></div><div><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-success">Tier {certificate.levelNumber}</div><div className="mt-1 text-sm font-semibold">{certificate.levelName}</div><div className="mt-1 text-xs text-muted-foreground">{certificate.holderName} · Score {certificate.score}%</div></div></div><Button type="button" variant="outline" size="sm" disabled><Download /> Unduh PDF</Button></CardContent></Card>)}</div></section>}
    </ContentContainer>
  );
}
