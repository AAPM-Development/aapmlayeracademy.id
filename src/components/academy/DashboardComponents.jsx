import React from "react";
import { Link } from "react-router-dom";
import AapmIcon from "@/components/icons/AapmIcon";
import { Button, IconTile, Progress, ProgressRing, SectionHeader } from "@/design-system";
import { ModuleRow } from "@/components/academy/CourseElements";

function firstName(user) {
  const name = String(user?.full_name || user?.email || "").trim();
  return name.split(/[\s@]/)[0] || "Peserta";
}

/** Greeting hero: where you are in the course and the single next action. */
export function DashboardHero({ user, nextModule, summary }) {
  const started = summary.completed > 0;
  return (
    <section className="aapm-hero" data-hue="green" aria-labelledby="dashboard-hero-title">
      <div className="min-w-0">
        <h1 id="dashboard-hero-title" className="aapm-hero__title">
          Halo, {firstName(user)}! {started ? "Siap lanjut belajar?" : "Mari mulai perjalanan Anda."}
        </h1>
        <p className="aapm-hero__text">
          {nextModule
            ? `Berikutnya: Modul ${nextModule.moduleNumber} · ${nextModule.title}.`
            : "Semua modul selesai. Ambil ujian akhir untuk sertifikasi Expert."}
        </p>
        <div className="aapm-hero__actions">
          <Button asChild variant="learn" size="lg">
            <Link to={nextModule ? `/modules/${nextModule.moduleNumber}` : "/final-exam"}>
              {nextModule ? (started ? "Lanjutkan belajar" : "Mulai modul 1") : "Ujian akhir"}
              <AapmIcon name="arrowRight" />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link to="/modules"><AapmIcon name="roadmap" />Lihat kurikulum</Link>
          </Button>
        </div>
      </div>
      <div className="aapm-hero__art">
        <ProgressRing value={summary.percent} size={148} stroke={12} label={`Progress course ${summary.percent}%`}>
          <span className="grid justify-items-center leading-tight">
            <span className="text-title font-semibold aapm-numeric">{summary.percent}%</span>
            <span className="text-caption text-muted-foreground">{summary.completed}/{summary.total} modul</span>
          </span>
        </ProgressRing>
      </div>
    </section>
  );
}

/** Colourful per-level progress tiles; the active level comes first. */
export function LevelProgressGrid({ curriculum = [], limit = 6 }) {
  const ordered = [...curriculum].sort((a, b) => Number(b.hasCurrent) - Number(a.hasCurrent) || Number(a.percent === 100) - Number(b.percent === 100) || a.number - b.number);
  return (
    <section aria-labelledby="level-progress-title">
      <SectionHeader
        id="level-progress-title"
        title="Progres per level"
        description="Warna menandai level kurikulum."
        actions={<Button asChild variant="ghost" size="sm"><Link to="/modules">Semua level<AapmIcon name="arrowRight" /></Link></Button>}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ordered.slice(0, limit).map((level) => (
          <Link key={level.number} to="/modules" className="aapm-progress-tile" data-hue={level.hue}>
            <div className="aapm-progress-tile__head">
              <IconTile icon={level.icon} hue={level.hue} size="md" shape="circle" variant="badge" />
              {level.hasCurrent ? <span className="aapm-chip" data-tone="attention"><span className="aapm-chip__dot" />Aktif</span> : level.percent === 100 ? <span className="aapm-chip" data-tone="solid">Tuntas</span> : null}
            </div>
            <div>
              <p className="aapm-text-overline m-0">Level {level.number}</p>
              <p className="aapm-progress-tile__title">{level.name}</p>
            </div>
            <Progress value={level.percent} label={`Progress ${level.name}`} />
            <div className="aapm-progress-tile__foot">
              <span>{level.completed}/{level.total} modul</span>
              <span>{level.percent}%</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** The next few modules after the current one. */
export function UpNextList({ modules = [] }) {
  return (
    <section className="aapm-card" aria-labelledby="up-next-title">
      <div className="aapm-card__header">
        <h2 id="up-next-title" className="aapm-card__title">Berikutnya di jalur Anda</h2>
        <p className="aapm-card__description">Modul setelah yang sedang Anda pelajari.</p>
      </div>
      <div className="grid gap-1 px-3 pb-3">
        {modules.length ? modules.map((module) => <ModuleRow key={module.moduleNumber} module={module} state={module.state} />) : (
          <p className="m-0 px-2 py-4 text-support text-muted-foreground">Selesaikan modul aktif untuk membuka rekomendasi berikutnya.</p>
        )}
      </div>
    </section>
  );
}

const tools = [
  { to: "/calculators", label: "Kalkulator farm", description: "Hitung FCR, HDP, dan biaya pakan.", icon: "calculator", hue: "blue" },
  { to: "/kpi", label: "Farm KPI", description: "Catat dan baca performa mingguan.", icon: "kpi", hue: "teal" },
  { to: "/ai-assistant", label: "Tanya APPI", description: "Asisten dengan konteks farm Anda.", icon: "ai", hue: "orange" },
];

/** Practical tools that support learning. */
export function QuickTools() {
  return (
    <section className="aapm-card" aria-labelledby="quick-tools-title">
      <div className="aapm-card__header">
        <h2 id="quick-tools-title" className="aapm-card__title">Alat farm</h2>
        <p className="aapm-card__description">Terapkan materi langsung pada data farm.</p>
      </div>
      <div className="grid gap-1 px-3 pb-3">
        {tools.map((tool) => (
          <Link key={tool.to} to={tool.to} className="aapm-module-row" data-hue={tool.hue}>
            <IconTile icon={tool.icon} hue={tool.hue} size="md" shape="circle" />
            <span className="min-w-0">
              <span className="aapm-module-row__title">{tool.label}</span>
              <span className="aapm-meta">{tool.description}</span>
            </span>
            <AapmIcon name="chevronRight" className="text-muted-foreground" />
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Certification teaser with tier progress. */
export function CertificationTeaser({ certificates = [], summary }) {
  return (
    <section className="aapm-callout" data-hue="violet" aria-labelledby="cert-teaser-title">
      <div className="aapm-callout__head">
        <IconTile icon="certificate" hue="violet" size="md" shape="circle" variant="badge" />
        <div className="min-w-0">
          <h2 id="cert-teaser-title" className="aapm-callout__title">Sertifikasi</h2>
          <p className="m-0 text-caption text-muted-foreground">{certificates.length} dari 6 tingkat diperoleh</p>
        </div>
      </div>
      <Progress value={certificates.length} max={6} hue="violet" onTint label="Progres sertifikasi" />
      <Button asChild variant="secondary" size="sm" className="justify-self-start">
        <Link to="/certification">{summary.percent === 100 ? "Klaim sertifikat" : "Lihat jalur sertifikasi"}<AapmIcon name="arrowRight" /></Link>
      </Button>
    </section>
  );
}
