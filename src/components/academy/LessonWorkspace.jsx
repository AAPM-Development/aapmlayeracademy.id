import React from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, FileText, Lightbulb, PlayCircle, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const lessonSections = [
  { id: "content", label: "Materi", icon: FileText },
  { id: "video", label: "Video Lesson", icon: PlayCircle },
  { id: "objectives", label: "Tujuan & Insight", icon: Target },
  { id: "practical", label: "Praktik", icon: ClipboardList },
];

export function LessonHeader({ module = null, completed = false } = {}) {
  if (!module) return null;
  return (
    <div>
      <Link to="/modules" className="mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Learning Path</Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-brand-green/30 bg-brand-green/5 text-brand-green">Level {module.level}</Badge><span className="text-xs text-muted-foreground">Modul {module.moduleNumber} · {module.category}</span></div><h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{module.title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{module.summary}</p></div>
        {completed && <Badge className="w-fit bg-success text-white"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Selesai</Badge>}
      </div>
    </div>
  );
}

export function LessonSidebar({ module = null, activeSection = "content", onSectionChange = (_section) => {} } = {}) {
  if (!module) return null;
  return (
    <Card className="shadow-none lg:sticky lg:top-6">
      <CardContent className="p-3">
        <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Lesson map</div>
        <div className="space-y-1">
          {lessonSections.map((section) => { const Icon = section.icon; const active = activeSection === section.id; return <button key={section.id} type="button" onClick={() => onSectionChange(section.id)} className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "bg-brand-orange/10 text-brand-orange" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="h-4 w-4 shrink-0" />{section.label}</button>; })}
        </div>
        <div className="mt-3 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">Baca materi, cek insight, lalu selesaikan aksi praktik sebelum kuis.</div>
      </CardContent>
    </Card>
  );
}

export function LessonNavigation({ previous = null, next = null, onComplete = () => {}, completeDisabled = false } = {}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
      <div>{previous && <Button asChild variant="outline"><Link to={`/modules/${previous.moduleNumber}`}><ArrowLeft /> Sebelumnya</Link></Button>}</div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <Button type="button" variant="outline" onClick={onComplete} disabled={completeDisabled}><CheckCircle2 /> {completeDisabled ? "Modul selesai" : "Tandai selesai"}</Button>
        {next && <Button asChild className="bg-brand-orange text-white hover:bg-brand-orange/90"><Link to={`/modules/${next.moduleNumber}`}>Modul berikutnya <ArrowRight /></Link></Button>}
        {!next && <Button asChild className="bg-brand-orange text-white hover:bg-brand-orange/90"><Link to="/modules">Kembali ke path <ArrowRight /></Link></Button>}
      </div>
    </div>
  );
}

export function LessonSection({ id = "", title = "", icon: Icon = FileText, children = null, className = "" } = {}) {
  return <section id={id} className={cn("scroll-mt-24", className)}><div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-brand-orange" /> {title}</div>{children}</section>;
}

export function LessonChecklist({ items = [] } = {}) {
  return <ul className="space-y-2">{items.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2 text-sm leading-6"><input type="checkbox" className="mt-1.5 h-3.5 w-3.5 rounded border-border text-brand-green focus:ring-brand-green" /><span>{item}</span></li>)}</ul>;
}

export function LessonInsightList({ items = [], icon: Icon = Lightbulb } = {}) {
  return <ul className="space-y-2">{items.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2 text-sm leading-6"><Icon className="mt-1 h-4 w-4 shrink-0 text-brand-orange" /><span>{item}</span></li>)}</ul>;
}
