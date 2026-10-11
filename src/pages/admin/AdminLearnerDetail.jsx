// @ts-nocheck
import React, { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog, OverflowMenu, Tabs, TabsContent, TabsList, TabsTrigger, useToast } from "@/components/primitives";
import { Page } from "@/design-system/patterns/AppShell";
import { useAdminLearner, useResetAdminUserProgress } from "@/lib/useAdminData";
import { useModules } from "@/lib/useCourseData";
import { AdminError, AdminLoading } from "@/components/admin/AdminPage";
import { formatAdminDate } from "@/components/admin/adminUtils";
import { initialsOf } from "@/components/ProfileAvatar";
import { levelVisual } from "@/lib/academyVisuals";
import { useAuth } from "@/lib/AuthContext";
import { Bar, Ic } from "@/design-system/canvas";

const TIER_HUES = ["green", "teal", "blue", "violet", "rose", "gold"];
const LEVELS_SHOWN = 4;

function minutesLabel(total) {
  const minutes = Number(total || 0);
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  return hours ? <>{hours} <small>j</small> {minutes % 60} <small>m</small></> : <>{minutes} <small>m</small></>;
}

const dash = (label) => <><span aria-hidden="true">—</span><span className="sr-only">{label}</span></>;

function learnerStatus(learner) {
  if (learner.progressPercent >= 100) return { label: "Selesai", chip: "chip-success" };
  if (learner.completedModules > 0 || learner.timeSpentMinutes > 0) return { label: "Aktif belajar", chip: "chip-success" };
  return { label: "Belum mulai", chip: "chip-outline" };
}

function ModuleStatus({ row }) {
  if (row.completed) return <span className="chip chip-success"><Ic name="check" />Selesai</span>;
  if (row.started) return <span className="chip chip-ai"><Ic name="play" />Berjalan</span>;
  return <span className="chip chip-outline">Belum mulai</span>;
}

function ProgressTable({ levels, showAll, onToggle, completed, total }) {
  const visible = showAll ? levels : levels.slice(0, LEVELS_SHOWN);
  const shownModules = visible.reduce((count, level) => count + level.rows.length, 0);
  const levelsDone = levels.filter((level) => level.rows.length && level.rows.every((row) => row.completed)).length;
  return (
    <section className="card" aria-labelledby="prog-title">
      <div className="card-pad card-head">
        <div className="stack gap-0-5"><h2 className="card-title" id="prog-title">Progres modul</h2><p className="card-desc">{completed} dari {total} modul selesai · {levelsDone} dari {levels.length} level tuntas</p></div>
      </div>
      <div className="table-wrap rel">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Modul</th>
              <th scope="col">Status</th>
              <th scope="col" className="num">Nilai kuis</th>
              <th scope="col">Praktik</th>
              <th scope="col" className="num">Waktu</th>
              <th scope="col">Pembaruan</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((level) => {
              const visual = levelVisual(level.number);
              const done = level.rows.filter((row) => row.completed).length;
              return (
                <React.Fragment key={level.number}>
                  <tr>
                    <th colSpan={6} scope="colgroup" data-hue={visual.hue}>
                      <span className="row gap-2"><span className="tile tile-xs"><Ic name={visual.ic} /></span><span className="t-ink t-strong">Level {level.number} · {level.name}</span><span className="t-caption t-muted">{done}/{level.rows.length}</span></span>
                    </th>
                  </tr>
                  {level.rows.map((row) => (
                    <tr key={row.moduleNumber}>
                      <td><div className="stack" style={{ maxWidth: 240 }}><span className="t-medium t-clamp-1">{row.title}</span><span className="t-caption t-muted">Modul {row.moduleNumber}</span></div></td>
                      <td><ModuleStatus row={row} /></td>
                      <td className={`num${row.quizTotal ? "" : " t-muted"}`}>{row.quizTotal ? `${row.quizScore || 0}/${row.quizTotal}` : dash("Belum ada nilai")}</td>
                      <td className={row.practicalDone ? undefined : "t-muted"}>{row.practicalDone ? <Ic name="check-circle" className="t-success" label="Praktik selesai" /> : dash("Belum ada praktik")}</td>
                      <td className={`num${row.minutes ? "" : " t-muted"}`}>{row.minutes ? `${row.minutes} m` : dash("Belum ada waktu")}</td>
                      <td className={`t-nowrap${row.updatedAt ? " t-muted" : " t-muted"}`}>{row.updatedAt ? formatAdminDate(row.updatedAt) : dash("Belum ada pembaruan")}</td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {levels.length > LEVELS_SHOWN ? (
        <div className="card-foot between">
          <span className="t-support t-muted">Level 1–{visible[visible.length - 1]?.number} · {shownModules} dari {total} modul</span>
          <button type="button" className="btn btn-ghost btn-sm" aria-expanded={showAll} onClick={onToggle}>
            {showAll ? "Ringkas" : `Tampilkan Level ${levels[LEVELS_SHOWN].number}–${levels[levels.length - 1].number}`}<Ic name={showAll ? "chev-up" : "chev-down"} />
          </button>
        </div>
      ) : null}
    </section>
  );
}

function CertificateList({ tiers }) {
  const issued = tiers.filter((tier) => tier.status === "issued").length;
  return (
    <section className="card anim-rise" style={/** @type {React.CSSProperties} */ ({ "--i": 2 })} aria-labelledby="cert-title">
      <div className="card-pad card-head" style={{ paddingBottom: 8 }}><h2 className="card-title" id="cert-title">Sertifikat</h2><span className="t-support t-muted">{issued} dari {tiers.length || 6} tingkat</span></div>
      {tiers.length ? (
        <div className="list">
          {tiers.map((tier) => {
            const owned = tier.status === "issued";
            const percent = tier.totalRequiredModules ? Math.round((tier.completedRequiredModules / tier.totalRequiredModules) * 100) : 0;
            return (
              <div key={tier.tierNumber} className="li" data-hue={TIER_HUES[(tier.tierNumber - 1) % 6]} style={{ paddingTop: 12, paddingBottom: 12 }}>
                <span className={`medal medal-sm${owned ? "" : " is-locked"}`} role="img" aria-label={`Tingkat ${tier.tierNumber}, ${owned ? "diterbitkan" : tier.status === "revoked" ? "dicabut" : "belum diterbitkan"}`}>
                  {tier.tierNumber}{owned ? <span className="medal-badge"><Ic name="check" /></span> : null}
                </span>
                <div className={`stack grow${owned ? "" : " gap-1"}`} style={{ minWidth: 0 }}>
                  <span className="li-title t-clamp-1">{tier.tierName}</span>
                  {owned ? (
                    <>
                      <span className="li-meta">Tingkat {tier.tierNumber} · Diterbitkan {formatAdminDate(tier.issuedAt)}</span>
                      <div className="row" style={{ paddingTop: 4 }}><Link className="btn btn-sm btn-link" to="/admin/certificates">Lihat di Sertifikat<Ic name="arrow-right" size="xs" /></Link></div>
                    </>
                  ) : (
                    <div className="row gap-3"><Bar value={percent} size="sm" style={{ flex: 1 }} /><span className="li-meta t-num t-nowrap">{tier.completedRequiredModules}/{tier.totalRequiredModules} modul</span></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : <p className="card-pad t-support t-muted" style={{ paddingTop: 0 }}>Status sertifikasi belum tersedia.</p>}
    </section>
  );
}

export default function AdminLearnerDetail() {
  const { user: actor } = useAuth();
  const navigate = useNavigate();
  const { learnerId } = useParams();
  const { data, isLoading, error, refetch } = useAdminLearner(learnerId);
  const { data: modules = [] } = useModules();
  const learner = data?.learner;
  const resetProgress = useResetAdminUserProgress();
  const [resetConfirmationOpen, setResetConfirmationOpen] = useState(false);
  const [showAllLevels, setShowAllLevels] = useState(false);
  const { toast } = useToast();

  const levels = useMemo(() => {
    const progress = new Map((data?.progress || []).map((item) => [Number(item.moduleNumber), item]));
    const source = modules.length ? modules : (data?.progress || []).map((item) => ({ moduleNumber: item.moduleNumber, title: item.moduleTitle, level: item.levelNumber, levelName: item.levelName }));
    const grouped = new Map();
    [...source].sort((a, b) => Number(a.moduleNumber) - Number(b.moduleNumber)).forEach((module) => {
      const number = Number(module.level ?? module.levelNumber ?? 0);
      const item = progress.get(Number(module.moduleNumber));
      if (!grouped.has(number)) grouped.set(number, { number, name: module.levelName || item?.levelName || `Level ${number}`, rows: [] });
      grouped.get(number).rows.push({
        moduleNumber: Number(module.moduleNumber),
        title: module.title || item?.moduleTitle,
        completed: Boolean(item?.completed),
        started: Boolean(item),
        quizScore: item?.quizScore,
        quizTotal: item?.quizTotal,
        practicalDone: Boolean(item?.practicalDone),
        minutes: item?.timeSpentMinutes || 0,
        updatedAt: item?.updatedAt,
      });
    });
    return [...grouped.values()].sort((a, b) => a.number - b.number);
  }, [data, modules]);

  const confirmResetProgress = async () => {
    setResetConfirmationOpen(false);
    if (!learner) return;
    try {
      const result = await resetProgress.mutateAsync({ userId: learner.id });
      const generation = result?.reset?.generationTo || 0;
      toast({
        title: "Progres direset",
        description: generation
          ? `Progres aktif dimulai ulang (siklus ${generation}). Riwayat ujian, sertifikat, data farm, dan percakapan tetap tersimpan.`
          : "Progres aktif dimulai ulang. Riwayat tetap tersimpan.",
      });
    } catch (resetError) {
      toast({ variant: "destructive", title: "Progres belum direset", description: resetError.message });
    }
  };

  if (isLoading) return <Page><AdminLoading label="Memuat detail peserta…" /></Page>;
  if (error) return <Page><AdminError error={error} onRetry={refetch} /></Page>;

  const status = learnerStatus(learner);
  const tiers = data.tiers || [];
  const issuedTiers = tiers.filter((tier) => tier.status === "issued");
  const latest = issuedTiers[issuedTiers.length - 1];
  const name = learner.full_name || learner.email;
  const canReset = Boolean(actor?.canManageUsers);
  const activity = [...(data.progress || [])].filter((item) => item.updatedAt).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 12);

  return (
    <Page>
      <header className="ph">
        <div className="ph-copy">
          <Link className="ph-back" to="/admin/learners"><Ic name="arrow-left" />Peserta</Link>
          <div className="row gap-4">
            <span className="avatar avatar-lg" data-hue="green">{initialsOf(name)}</span>
            <div className="stack gap-1 grow" style={{ minWidth: 0 }}>
              <div className="row wrap gap-3"><h1 className="ph-title">{name}</h1><span className={`chip ${status.chip} chip-dot`}>{status.label}</span></div>
              <p className="ph-desc">{learner.email} · terdaftar {formatAdminDate(learner.created_at)}</p>
            </div>
          </div>
        </div>
        <div className="ph-actions">
          <OverflowMenu
            label={`Tindakan lain untuk ${name}`}
            triggerVariant="secondary"
            size="md"
            items={[
              { id: "account", label: "Kelola akun", icon: "user", onSelect: () => navigate("/admin/users") },
              { id: "certificates", label: "Lihat di Sertifikat", icon: "certificate", onSelect: () => navigate("/admin/certificates") },
              ...(canReset ? [{ id: "reset", label: "Reset progres", icon: "refresh", tone: "danger", disabled: resetProgress.isPending, onSelect: () => setResetConfirmationOpen(true) }] : []),
            ]}
          />
        </div>
      </header>

      <section className="grid-xs" aria-label="Ringkasan peserta">
        <div className="card metric anim-rise" data-hue="green"><span className="metric-label"><span className="tile tile-xs"><Ic name="route" /></span>Modul selesai</span><span className="metric-value">{learner.completedModules} <small>/ {learner.moduleTotal ?? "—"}</small></span><span className="metric-note">Progres course {learner.progressPercent}%</span></div>
        <div className="card metric anim-rise" style={/** @type {React.CSSProperties} */ ({ "--i": 1 })} data-hue="blue"><span className="metric-label"><span className="tile tile-xs"><Ic name="target" /></span>Rata-rata kuis</span><span className="metric-value">{learner.quizAverage === null || learner.quizAverage === undefined ? "—" : `${learner.quizAverage}%`}</span><span className="metric-note">Target evaluasi 80%</span></div>
        <div className="card metric anim-rise" style={/** @type {React.CSSProperties} */ ({ "--i": 2 })} data-hue="violet"><span className="metric-label"><span className="tile tile-xs"><Ic name="clock" /></span>Waktu belajar</span><span className="metric-value">{minutesLabel(learner.timeSpentMinutes) || "—"}</span><span className="metric-note">Tercatat di {(data.progress || []).filter((item) => item.timeSpentMinutes).length} modul</span></div>
        <div className="card metric anim-rise" style={/** @type {React.CSSProperties} */ ({ "--i": 3 })} data-hue="teal"><span className="metric-label"><span className="tile tile-xs"><Ic name="cert" /></span>Sertifikat</span><span className="metric-value">{issuedTiers.length}</span><span className="metric-note">{latest ? `Tingkat ${latest.tierNumber} · ${formatAdminDate(latest.issuedAt)}` : "Belum ada"}</span></div>
        <div className="card metric anim-rise" style={/** @type {React.CSSProperties} */ ({ "--i": 4 })} data-hue="gold"><span className="metric-label"><span className="tile tile-xs"><Ic name="star" /></span>Poin</span><span className="metric-value">{Number(learner.points || 0).toLocaleString("id-ID")}</span><span className="metric-note">Peringkat {learner.level || "Foundation"}</span></div>
      </section>

      <Tabs defaultValue="progress" className="stack gap-5">
        <TabsList aria-label="Bagian detail peserta">
          <TabsTrigger value="progress"><Ic name="route" />Progres</TabsTrigger>
          <TabsTrigger value="certificates" count={issuedTiers.length}><Ic name="cert" />Sertifikat</TabsTrigger>
          <TabsTrigger value="activity"><Ic name="history" />Aktivitas</TabsTrigger>
        </TabsList>
        <TabsContent value="progress">
          <div className="split">
            <ProgressTable levels={levels} showAll={showAllLevels} onToggle={() => setShowAllLevels((value) => !value)} completed={learner.completedModules} total={learner.moduleTotal ?? levels.reduce((count, level) => count + level.rows.length, 0)} />
            <aside className="stack gap-grid" aria-label="Sertifikat dan tindakan">
              <CertificateList tiers={tiers} />
              {canReset ? (
                <section className="card card-pad stack gap-3 anim-rise" style={/** @type {React.CSSProperties} */ ({ "--i": 3 })} aria-labelledby="risk-title">
                  <div className="row gap-2"><Ic name="alert" className="t-danger" /><h2 className="card-title" id="risk-title">Zona berisiko</h2></div>
                  <p className="t-support t-muted">Status modul, kuis, praktik, dan waktu belajar dimulai ulang. Riwayat ujian, sertifikat, data farm, dan percakapan tetap tersimpan.</p>
                  <div className="row"><button type="button" className="btn btn-danger-soft btn-sm" disabled={resetProgress.isPending} onClick={() => setResetConfirmationOpen(true)}><Ic name="refresh" />{resetProgress.isPending ? "Mereset…" : "Reset progres"}</button></div>
                </section>
              ) : null}
            </aside>
          </div>
        </TabsContent>
        <TabsContent value="certificates"><CertificateList tiers={tiers} /></TabsContent>
        <TabsContent value="activity">
          <section className="card" aria-labelledby="activity-title">
            <div className="card-pad card-head" style={{ paddingBottom: 8 }}><div className="stack gap-0-5"><h2 className="card-title" id="activity-title">Aktivitas terbaru</h2><p className="card-desc">{data.availabilityNote}</p></div></div>
            {activity.length ? (
              <ol className="list">
                {activity.map((item) => (
                  <li key={`${item.moduleNumber}-${item.updatedAt}`} className="li">
                    <span className="tile tile-sm" data-hue={item.completed ? "green" : "orange"}><Ic name={item.completed ? "check" : "play"} /></span>
                    <span className="stack grow" style={{ minWidth: 0 }}><span className="li-title t-clamp-1">{item.completed ? "Menyelesaikan" : "Mempelajari"} Modul {item.moduleNumber} · {item.moduleTitle}</span><span className="li-meta">{item.levelName || "—"}</span></span>
                    <span className="t-caption t-muted t-nowrap">{formatAdminDate(item.updatedAt)}</span>
                  </li>
                ))}
              </ol>
            ) : <p className="card-pad t-support t-muted" style={{ paddingTop: 0 }}>Belum ada aktivitas tersimpan.</p>}
          </section>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={resetConfirmationOpen}
        onOpenChange={setResetConfirmationOpen}
        title="Reset progres peserta?"
        description={`Seluruh progres belajar ${name || "peserta ini"} akan dimulai ulang: status modul, kuis, praktik, dan waktu belajar aktif kembali kosong. Riwayat ujian dan nilai lama, sertifikat, data farm, dan percakapan tetap tersimpan.`}
        confirmLabel="Reset progres"
        icon="solar:restart-bold"
        destructive
        onConfirm={confirmResetProgress}
      />
    </Page>
  );
}
