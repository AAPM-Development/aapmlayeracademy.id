import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import PwaInstallNotice from "@/components/PwaInstallNotice";
import AppiMascot, { appiAsset } from "@/components/appi/AppiMascot";
import AapmIcon from "@/components/icons/AapmIcon";
import FlowSteps, { moduleFlowSteps } from "@/components/learn/FlowSteps";
import { ModuleCover } from "@/components/academy/CourseElements";
import { LearningEmptyState, LearningErrorState, LearningLoading } from "@/components/academy/LearningStates";
import { Page } from "@/design-system/patterns/AppShell";
import { Bar, Egg, Ic } from "@/design-system/canvas";
import { useAuth } from "@/lib/AuthContext";
import { getCompletedModuleSet, getNextModule, getProgressSummary, getRankProgress, learningLevels, TOTAL_CERTIFICATION_TIERS } from "@/lib/academyData";
import { buildCurriculum, levelVisual, moduleVisual } from "@/lib/academyVisuals";
import { firstName, formatStudyTime, greeting, moduleMeta, nextOpenTier, tierForModule } from "@/lib/learnerCopy";
import { sortByWeek, weeklyReading } from "@/lib/kpiReading";
import { useCertificates, useFarmData, useModules, useUserProgress } from "@/lib/useCourseData";
import { useLearningProfile } from "@/lib/useProfileData";
import { moduleNo } from "@/lib/moduleNumber";

const achievementIcons = { "first-step": "flag", "module-finisher": "check-circle", "field-practice": "egg", "quiz-ready": "target", "farm-journal": "chart", certified: "cert" };
const achievementHues = { "first-step": "green", "module-finisher": "green", "field-practice": "teal", "quiz-ready": "blue", "farm-journal": "orange", certified: "teal" };

/** One line from APPI that fits the learner's moment. */
function coachLine(summary, nextModule, completedSet) {
  if (!nextModule) return { mood: "cheer", text: <>Semua modul tuntas. Saatnya <strong>ujian akhir</strong>!</> };
  if (summary.completed === 0) return { mood: "wink", text: <>Mulai dari Modul 1. Satu langkah kecil hari ini!</> };
  const tier = tierForModule(nextModule.moduleNumber, completedSet);
  if (tier?.remaining === 1) return { mood: "happy", text: <>{summary.completed} modul tuntas! Selesaikan Modul {moduleNo(nextModule)} untuk membuka sertifikat <strong>Tingkat {tier.number}</strong>.</> };
  if (tier) return { mood: "happy", text: <>{summary.completed} modul tuntas! {tier.remaining} modul lagi menuju sertifikat <strong>Tingkat {tier.number}</strong>.</> };
  return { mood: "happy", text: <>{summary.completed} modul tuntas! Lanjut ke Modul {moduleNo(nextModule)}?</> };
}

function HomeHero({ user, nextModule, nextProgress, summary, completedSet }) {
  const started = summary.completed > 0;
  const coach = coachLine(summary, nextModule, completedSet);
  const visual = nextModule ? moduleVisual(nextModule) : levelVisual(1);
  const steps = nextModule ? moduleFlowSteps({ progress: nextProgress, hasPractice: Boolean(nextModule.practicalAssignment), hasQuiz: nextModule.assessmentMode !== "acknowledgement" }) : [];
  return (
    <section className="card card-fill feature cols-aside anim-rise" data-hue="green" aria-labelledby="hero-title" style={{ padding: "28px 32px", overflow: "hidden" }}>
      <div className="stack gap-5" style={{ minWidth: 0 }}>
        <div className="stack gap-1">
          <span className="t-heading t-ink">{greeting()}, {firstName(user)}!</span>
          <h1 className="t-display" id="hero-title">{!nextModule ? "Semua modul tuntas!" : started ? "Siap lanjut belajar?" : "Mari mulai belajar."}</h1>
        </div>
        {nextModule ? (
          <Link className="card card-tactile cover-row" to={`/modules/${nextModule.moduleNumber}`} data-hue={visual.hue}>
            {visual.image || visual.customIcon ? <ModuleCover module={nextModule} style={{ minHeight: 116 }} /> : (
              <div className="cover" style={{ borderRadius: 0, minHeight: 116 }}>
                <span className="tile"><AapmIcon name={visual.icon} /></span>
                <span className="cover-num" aria-hidden="true">{String(moduleNo(nextModule)).padStart(2, "0")}</span>
              </div>
            )}
            <div className="stack gap-3" style={{ padding: "16px 20px", minWidth: 0 }}>
              <div className="stack gap-1">
                <span className="t-overline t-ink">Modul {moduleNo(nextModule)} · Chapter {nextModule.level} {nextModule.levelName}</span>
                <span className="t-heading">{nextModule.title}</span>
                <span className="t-support t-muted">{moduleMeta(nextModule)}</span>
              </div>
              <FlowSteps steps={steps} className="hide-md" />
            </div>
          </Link>
        ) : (
          <p className="t-reading t-muted">Semua modul selesai. Ambil ujian akhir untuk sertifikasi Expert.</p>
        )}
        <div className="row wrap gap-3">
          <Link className="btn btn-learn btn-lg btn-block-sm" to={nextModule ? `/modules/${nextModule.moduleNumber}` : "/final-exam"}>
            {nextModule ? (started ? "Lanjutkan belajar" : "Mulai Modul 1") : "Ujian akhir"}
            <Ic name="arrow-right" />
          </Link>
          <Link className="btn btn-secondary btn-lg btn-block-sm" to="/modules"><Ic name="route" />Lihat jalur</Link>
        </div>
      </div>
      <div className="stack items-center gap-4 hide-sm" style={{ width: 250 }}>
        <p className="bubble tail-down appi-say">{coach.text}</p>
        <div className="appi-stage" style={{ marginTop: 6 }}>
          <AppiMascot mood={coach.mood} size="hero" enter="pop" label={`APPI ${coach.mood === "cheer" ? "bersorak" : "senang"}`} />
          <img className="sparkle anim-twinkle" src={appiAsset(13)} alt="" style={{ right: -18, top: 4, width: 30 }} />
          <img className="sparkle anim-twinkle" src={appiAsset(13)} alt="" style={{ left: -14, top: 40, width: 18, "--i": 2 }} />
        </div>
      </div>
    </section>
  );
}

function RewardStrip({ learning, rank, quizAverage, certificateCount, openTier }) {
  const quizGoal = 80;
  const minutes = Number(learning?.timeSpentMinutes) || 0;
  const timePercent = Math.min(100, Math.round((Math.min(60, Math.floor(minutes / 10)) / 60) * 100));
  return (
    <section className="grid-sm" aria-label="Ringkasan prestasi">
      <Link className="card card-tactile metric anim-rise" to="/profile" data-hue="gold" style={{ "--i": 1 }}>
        <span className="metric-label"><span className="tile tile-sm tile-round" style={{ background: "var(--gold)", color: "var(--on-gold)" }}><Ic name="star" /></span>Peringkat</span>
        <span className="metric-value">{rank.name}</span>
        <Bar value={rank.percent} animate />
        <span className="metric-note">{rank.nextName ? `${rank.toNext.toLocaleString("id-ID")} poin lagi menuju ${rank.nextName}` : "Peringkat tertinggi tercapai"}</span>
      </Link>
      <Link className="card card-tactile metric anim-rise" to="/profile" data-hue="blue" style={{ "--i": 2 }}>
        <span className="metric-label"><span className="tile tile-sm tile-round tile-solid"><Ic name="target" /></span>Rata-rata kuis</span>
        <span className="metric-value">{quizAverage === null ? "—" : `${quizAverage}%`}</span>
        <Bar value={quizAverage || 0} animate index={1} />
        <span className="metric-note">{quizAverage === null ? "Selesaikan kuis pertama Anda" : quizAverage >= quizGoal ? "Pencapaian Siap evaluasi terbuka" : `${quizGoal - quizAverage} poin lagi untuk pencapaian Siap evaluasi`}</span>
      </Link>
      <Link className="card card-tactile metric anim-rise" to="/profile" data-hue="violet" style={{ "--i": 3 }}>
        <span className="metric-label"><span className="tile tile-sm tile-round tile-solid"><Ic name="clock" /></span>Waktu belajar</span>
        <span className="metric-value">{formatStudyTime(minutes)}</span>
        <Bar value={timePercent} animate index={2} />
        <span className="metric-note">+1 poin tiap 10 menit membaca</span>
      </Link>
      <Link className="card card-tactile metric anim-rise" to="/certification" data-hue="teal" style={{ "--i": 4 }}>
        <span className="metric-label"><span className="tile tile-sm tile-round tile-solid"><Ic name="cert" /></span>Sertifikat</span>
        <span className="metric-value">{certificateCount} <small>dari {TOTAL_CERTIFICATION_TIERS}</small></span>
        <div className="segs" aria-hidden="true">{Array.from({ length: TOTAL_CERTIFICATION_TIERS }, (_, index) => <i key={index} className={index < certificateCount ? "on" : undefined} />)}</div>
        <span className="metric-note">{openTier ? (openTier.remaining ? `Tingkat ${openTier.number} tinggal ${openTier.remaining} modul lagi` : `Tingkat ${openTier.number} siap diklaim`) : "Semua tingkat diperoleh"}</span>
      </Link>
    </section>
  );
}

function LevelTrack({ curriculum, activeLevel }) {
  const byNumber = new Map(curriculum.map((level) => [level.number, level]));
  const doneCount = curriculum.filter((level) => level.total && level.completed === level.total).length;
  const active = activeLevel ? byNumber.get(activeLevel.number) : null;
  return (
    <section className="card card-pad stack gap-5 anim-rise" style={{ "--i": 5 }} aria-labelledby="track-title">
      <div className="card-head">
        <div className="stack gap-0-5">
          <h2 className="card-title" id="track-title">Perjalanan {learningLevels.length} chapter</h2>
          <p className="card-desc">{doneCount} chapter tuntas{active ? ` · Anda di Chapter ${active.number} ${active.name}` : ""}</p>
        </div>
        <Link className="btn btn-ghost btn-sm" to="/modules">Semua chapter<Ic name="chev-right" /></Link>
      </div>
      <div className="scroll-x pulse-room">
        <ol style={{ display: "grid", gridTemplateColumns: `repeat(${learningLevels.length}, minmax(38px, 1fr))`, alignItems: "end", minWidth: 560, paddingTop: 8 }} aria-label="Chapter kurikulum">
          {learningLevels.map((meta, index) => {
            const level = byNumber.get(meta.number);
            const done = level && level.total && level.completed === level.total;
            const current = active?.number === meta.number;
            const last = index === learningLevels.length - 1;
            return (
              <li key={meta.number} className="stack items-center gap-2">
                {done ? (
                  <Egg size="xs" state="done" className="anim-pop" style={{ "--i": index }}><Ic name="check" /><span className="sr-only">Chapter {meta.number} tuntas</span></Egg>
                ) : current ? (
                  <Egg size="sm" state="current" className="anim-pop anim-pulse" style={{ "--i": index }} aria-current="step">{meta.number}</Egg>
                ) : last ? (
                  <Egg size="xs" state="gold"><Ic name="award" /><span className="sr-only">Chapter {meta.number} dan sertifikat Expert</span></Egg>
                ) : (
                  <Egg size="xs">{meta.number}</Egg>
                )}
                <span className={current ? "t-caption t-strong t-ai" : "t-caption t-muted"}>C{meta.number}</span>
              </li>
            );
          })}
        </ol>
      </div>
      {active ? (
        <div className="reward" data-hue={active.hue}>
          <span className="tile tile-round tile-solid"><AapmIcon name={active.icon} /></span>
          <div className="stack grow gap-1-5">
            <div className="row between gap-3"><span className="t-heading t-heading-sm">Chapter {active.number} · {active.name}</span><span className="t-caption t-strong t-num">{active.completed}/{active.total} modul</span></div>
            <Bar value={active.percent} onTint animate label={`Progres Chapter ${active.number}`} now={active.completed} max={active.total} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function NextModules({ modules, completedSet, curriculum }) {
  if (!modules.length) return null;
  const note = (module, index) => {
    if (index === 0) return "sedang dipelajari";
    const level = curriculum.find((item) => item.number === Number(module.level));
    const remainingInLevel = level ? level.modules.filter((item) => item.state !== "completed") : [];
    if (remainingInLevel.length && remainingInLevel[remainingInLevel.length - 1].moduleNumber === module.moduleNumber) return `menutup Chapter ${module.level}`;
    const tier = tierForModule(module.moduleNumber, completedSet);
    return tier ? `syarat Tingkat ${tier.number}` : module.levelName;
  };
  return (
    <section className="card anim-rise" style={{ "--i": 6 }} aria-labelledby="next-title">
      <div className="card-pad card-head" style={{ paddingBottom: 12 }}>
        <div className="stack gap-0-5"><h2 className="card-title" id="next-title">Berikutnya di jalur Anda</h2><p className="card-desc">Kurikulum terbuka; urutan ini disarankan.</p></div>
      </div>
      <div className="list">
        {modules.map((module, index) => (
          <Link key={module.moduleNumber} className="li" to={`/modules/${module.moduleNumber}`} style={{ minHeight: 72, ...(index === 0 ? { background: "var(--ai-soft)" } : null) }}>
            <Egg size="xs" state={index === 0 ? "current" : undefined}>{moduleNo(module)}</Egg>
            <div className="stack grow" style={{ minWidth: 0 }}>
              <span className="li-title t-clamp-1">{module.title}</span>
              <span className="li-meta">Chapter {module.level} · {moduleMeta(module, { short: true })} · {note(module, index)}</span>
            </div>
            {index === 0 ? <span className="xp xp-sm"><Ic name="star" />+100</span> : <Ic name="chev-right" className="t-muted" />}
          </Link>
        ))}
      </div>
    </section>
  );
}

function Achievements({ achievements = [] }) {
  if (!achievements.length) return null;
  const unlocked = achievements.filter((item) => item.unlocked);
  const latest = unlocked[unlocked.length - 1];
  const pending = achievements
    .filter((item) => !item.unlocked && item.target)
    .sort((a, b) => b.current / b.target - a.current / a.target)[0];
  return (
    <section className="card card-pad stack gap-4 anim-rise" style={{ "--i": 5 }} aria-labelledby="ach-title">
      <div className="card-head"><h2 className="card-title" id="ach-title">Pencapaian</h2><Link className="btn btn-link t-support" to="/profile">{unlocked.length}/{achievements.length} terbuka</Link></div>
      {latest ? (
        <div className="row gap-3" data-hue={achievementHues[latest.id] || "green"}>
          <span className="medal medal-sm"><Ic name={achievementIcons[latest.id] || "award"} /><span className="medal-badge"><Ic name="check" /></span></span>
          <div className="stack grow"><span className="t-heading t-heading-sm">{latest.title}</span><span className="t-caption t-muted">Terbuka · {latest.description}</span></div>
        </div>
      ) : null}
      {pending ? (
        <div className="stack gap-2" data-hue={achievementHues[pending.id] || "blue"}>
          <div className="row gap-3">
            <span className="medal medal-sm is-locked"><Ic name={achievementIcons[pending.id] || "award"} /></span>
            <div className="stack grow"><span className="t-heading t-heading-sm">{pending.title}</span><span className="t-caption t-muted">{pending.description}</span></div>
            <span className="t-caption t-strong t-num">{Math.min(pending.current, pending.target)}/{pending.target}{pending.id === "quiz-ready" ? "%" : ""}</span>
          </div>
          <Bar value={(Math.min(pending.current, pending.target) / pending.target) * 100} animate label={`Progres ${pending.title}`} />
        </div>
      ) : null}
    </section>
  );
}

function FarmTools({ farmRows }) {
  const sorted = sortByWeek(farmRows);
  const reading = sorted.length ? weeklyReading(sorted) : null;
  return (
    <section className="card anim-rise" style={{ "--i": 6 }} aria-labelledby="tools-title">
      <div className="card-pad" style={{ paddingBottom: 8 }}><h2 className="card-title" id="tools-title">Alat farm</h2><p className="card-desc">Terapkan materi pada data farm Anda.</p></div>
      <div className="list">
        <Link className="li" to="/kpi" data-hue="orange">
          <span className="tile tile-round tile-solid"><Ic name="chart" /></span>
          <div className="stack grow"><span className="li-title">Farm KPI</span><span className="li-meta">{reading ? `M${reading.week} · ${reading.concerns ? `${reading.concerns} indikator perlu dicek` : reading.title}` : "Catat KPI minggu pertama"}</span></div>
          {reading?.concerns ? <span className="chip chip-warning">Baca</span> : <Ic name="chev-right" className="t-muted" />}
        </Link>
        <Link className="li" to="/calculators" data-hue="green">
          <span className="tile tile-round tile-solid"><Ic name="calc" /></span>
          <div className="stack grow"><span className="li-title">Kalkulator farm</span><span className="li-meta">FCR, HDP, egg mass, ROI</span></div>
          <Ic name="chev-right" className="t-muted" />
        </Link>
        <Link className="li" to="/ai-assistant" data-hue="ai">
          <span className="tile tile-round" style={{ background: "var(--ai-soft)", overflow: "hidden" }}><img src={appiAsset(1)} alt="" style={{ width: 32, height: 32 }} /></span>
          <div className="stack grow"><span className="li-title">Tanya APPI</span><span className="li-meta">Asisten dengan konteks farm Anda</span></div>
          <Ic name="chev-right" className="t-muted" />
        </Link>
      </div>
    </section>
  );
}

/**
 * Learner home (canvas "Beranda"): the next step first (hero), a reward
 * strip, the 14-level egg track with what comes next, and the rail with
 * achievements and farm tools.
 */
export default function Home() {
  const { user } = useAuth();
  const { data: modules = [], isLoading: modulesLoading, isError: modulesError, refetch: refetchModules } = useModules();
  const { data: progress = [], isLoading: progressLoading, isError: progressError, refetch: refetchProgress } = useUserProgress();
  const { data: certificates = [] } = useCertificates();
  const { data: profile } = useLearningProfile();
  const { data: farmRows = [] } = useFarmData();
  const isLoading = modulesLoading || progressLoading;
  const isError = modulesError || progressError;

  const summary = getProgressSummary(modules, progress);
  const completedSet = useMemo(() => getCompletedModuleSet(progress, modules), [progress, modules]);
  const nextModule = getNextModule(modules, progress);
  const nextProgress = progress.find((item) => Number(item.moduleNumber) === Number(nextModule?.moduleNumber)) || null;
  const curriculum = useMemo(() => buildCurriculum(modules, progress), [modules, progress]);
  const learning = profile?.learning;
  const rank = getRankProgress(learning?.points);
  const quizAverage = learning?.quizAverage ?? null;
  const ownedCertificates = (Array.isArray(certificates) ? certificates : []).filter((item) => item?.status !== "revoked");
  const certificateCount = Math.min(ownedCertificates.length, TOTAL_CERTIFICATION_TIERS);
  const openTier = nextOpenTier(completedSet, ownedCertificates);
  const activeLevel = curriculum.find((level) => level.hasCurrent) || null;
  const upNext = curriculum.flatMap((level) => level.modules).filter((module) => module.state !== "completed").slice(0, 3);

  if (isError) {
    return (
      <Page>
        <LearningErrorState title="Beranda belum dapat memuat data" description="Progres dan kurikulum belum berhasil diambil." onRetry={() => { refetchModules(); refetchProgress(); }} />
      </Page>
    );
  }

  return (
    <Page>
      {isLoading ? (
        <LearningLoading label="Memuat beranda belajar…" lines={3} />
      ) : !modules.length ? (
        <LearningEmptyState title="Jalur belajar sedang disiapkan" description="Kurikulum akan muncul di sini saat materi sudah dipublikasikan." actionLabel={null} actionTo={null} />
      ) : (
        <>
          <HomeHero user={user} nextModule={nextModule} nextProgress={nextProgress} summary={summary} completedSet={completedSet} />
          <RewardStrip learning={learning} rank={rank} quizAverage={quizAverage} certificateCount={certificateCount} openTier={openTier} />
          <div className="split">
            <div className="stack gap-grid">
              <LevelTrack curriculum={curriculum} activeLevel={activeLevel} />
              <NextModules modules={upNext} completedSet={completedSet} curriculum={curriculum} />
            </div>
            <aside className="stack gap-grid" aria-label="Pintasan">
              <Achievements achievements={learning?.achievements} />
              <FarmTools farmRows={farmRows} />
            </aside>
          </div>
          <PwaInstallNotice />
        </>
      )}
    </Page>
  );
}
