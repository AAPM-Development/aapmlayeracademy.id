import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Page } from "@/design-system/patterns/AppShell";
import { nativeApi } from "@/api/nativeClient";
import { celebrate } from "@/lib/celebrate";
import ProfileAvatar from "@/components/ProfileAvatar";
import { appiAsset } from "@/components/appi/AppiMascot";
import AapmIcon from "@/components/icons/AapmIcon";
import {
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StateView,
  Textarea,
  useToast,
} from "@/components/primitives";
import { Bar, Ic } from "@/design-system/canvas";
import { useAuth } from "@/lib/AuthContext";
import { useCertificates } from "@/lib/useCourseData";
import { useHallOfFame, useLearningProfile, useSaveLearningProfile } from "@/lib/useProfileData";
import { useAiAccountSettings, useSaveAiAccountSettings } from "@/lib/useAiSettings";
import { usePwaInstall } from "@/lib/usePwaInstall";
import { getRankProgress, learnerRanks, TOTAL_CERTIFICATION_TIERS, TOTAL_MODULES } from "@/lib/academyData";
import { formatStudyTime } from "@/lib/learnerCopy";

function resizeProfileImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Foto tidak dapat dibaca."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Format foto tidak didukung."));
      image.onload = () => {
        const side = Math.min(image.naturalWidth, image.naturalHeight);
        const sourceX = (image.naturalWidth - side) / 2;
        const sourceY = (image.naturalHeight - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 320;
        const context = canvas.getContext("2d");
        context.drawImage(image, sourceX, sourceY, side, side, 0, 0, 320, 320);

        const candidates = [
          canvas.toDataURL("image/webp", 0.82),
          canvas.toDataURL("image/jpeg", 0.78),
        ];
        const result = candidates.find((value) => value.length <= 180000);
        if (!result) {
          reject(new Error("Foto terlalu besar setelah diproses. Pilih foto lain."));
          return;
        }
        resolve(result);
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

const formatDate = (value, options) => {
  if (!value) return "";
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("id-ID", options);
};
const formatPoints = (value) => Number(value || 0).toLocaleString("id-ID");

// Achievement look per server id: canvas icon and hue.
const ACHIEVEMENT_LOOK = {
  "first-step": { ic: "flag", hue: "rose" },
  "module-finisher": { ic: "book", hue: "green" },
  "field-practice": { ic: "egg", hue: "amber" },
  "farm-journal": { ic: "chart", hue: "violet" },
  certified: { ic: "cert", hue: "teal" },
  "quiz-ready": { ic: "target", hue: "blue" },
  "modules-3": { ic: "route", hue: "green" },
  "modules-5": { ic: "flame", hue: "orange" },
  "modules-10": { ic: "layers", hue: "green" },
  halfway: { ic: "flag", hue: "blue" },
  "course-complete": { ic: "grad", hue: "amber" },
  "practice-3": { ic: "home", hue: "amber" },
  "practice-10": { ic: "heart", hue: "rose" },
  "quiz-90": { ic: "star", hue: "violet" },
  "farm-8": { ic: "trend-up", hue: "violet" },
  "farm-12": { ic: "calc", hue: "teal" },
  "study-1h": { ic: "clock", hue: "blue" },
  "study-5h": { ic: "bulb", hue: "amber" },
  "study-10h": { ic: "sparkle", hue: "orange" },
  "level-builder": { ic: "shield", hue: "green" },
  "level-analyst": { ic: "chart", hue: "blue" },
  "level-leader": { ic: "award", hue: "amber" },
  "points-1500": { ic: "medal", hue: "amber" },
  "certified-2": { ic: "cert", hue: "teal" },
};
const ACHIEVEMENT_UNIT = { "farm-journal": "catatan", "farm-8": "catatan", "farm-12": "catatan", "module-finisher": "modul", "modules-3": "modul", "modules-5": "modul", "modules-10": "modul", "field-practice": "praktik", "practice-3": "praktik", "practice-10": "praktik", certified: "sertifikat", "certified-2": "sertifikat", "study-1h": "menit", "study-5h": "menit", "study-10h": "menit",
  "level-builder": "poin", "level-analyst": "poin", "level-leader": "poin", "points-1500": "poin", "course-complete": "modul", "first-step": "aktivitas" };
const unitOf = (id) => ACHIEVEMENT_UNIT[id] || (String(id).startsWith("curriculum-") ? "modul" : "");
const ACHIEVEMENT_SHOWN_COLLAPSED = 9;

const POINT_RULES = [
  { ic: "book", hue: "green", reward: "+100", title: "Modul selesai", meta: "per modul" },
  { ic: "egg", hue: "amber", reward: "+35", title: "Praktik selesai", meta: "per praktik" },
  { ic: "cert", hue: "teal", reward: "+150", title: "Sertifikat terbit", meta: "per sertifikat" },
  { ic: "target", hue: "blue", reward: "maks +100", title: "Rata-rata kuis", meta: "1 poin per 1%" },
  { ic: "chart", hue: "violet", reward: "maks +120", title: "Catatan KPI", meta: "+10 per catatan" },
  { ic: "clock", hue: "rose", reward: "maks +60", title: "Waktu belajar", meta: "+1 per 10 menit" },
];

const AVATAR_HUES = ["blue", "violet", "amber", "rose", "teal", "green", "orange"];

/* -------------------------------------------------------------- summary */

/** Identity on the left, the four-rank ladder with the gold progress rail on the right. */
function ProfileHero({ user, profileUser, rank }) {
  const index = learnerRanks.findIndex((item) => item.name === rank.name);
  const segments = learnerRanks.length - 1;
  const rail = Math.round(((index + (rank.to ? rank.percent / 100 : 0)) / segments) * 100);
  const since = formatDate(user?.created_at || user?.createdAt, { month: "short", year: "numeric" });
  return (
    <section className="card card-tint feature split-even anim-rise" data-hue="green" aria-labelledby="who-title" style={{ padding: "24px 28px", gap: "24px 40px", alignItems: "center" }}>
      <div className="row wrap gap-5">
        <ProfileAvatar user={profileUser} name={user?.full_name || user?.email} className="avatar-xl" alt="" />
        <div className="stack gap-2" style={{ minWidth: 0 }}>
          <div className="stack">
            <h2 className="t-title-c" id="who-title">{user?.full_name || "Peserta Academy"}</h2>
            <span className="t-support t-muted">{user?.email}</span>
          </div>
          {since ? <span className="chip chip-outline" style={{ width: "fit-content" }}><Ic name="calendar" />Peserta sejak {since}</span> : null}
        </div>
      </div>
      <div className="stack gap-3">
        <div className="row between wrap gap-3">
          <span className="t-overline t-ink">Peringkat poin</span>
          <span className="xp xp-lg anim-pop"><Ic name="star" />{formatPoints(rank.points)} poin</span>
        </div>
        <div className="rel">
          <span aria-hidden="true" style={{ position: "absolute", left: "12.5%", right: "12.5%", top: 24, height: 56, display: "grid", alignItems: "center" }}>
            <Bar value={rail} hue="gold" animate />
          </span>
          <ol className="rel" style={{ display: "grid", gridTemplateColumns: `repeat(${learnerRanks.length}, minmax(0, 1fr))` }} aria-label="Tangga peringkat">
            {learnerRanks.map((item, position) => {
              const current = position === index;
              const reached = position < index;
              return (
                <li key={item.name} className="stack items-center gap-1-5 t-center" data-hue="gold" aria-current={current ? "step" : undefined}>
                  <span className={`t-caption t-num ${current ? "t-strong t-ink" : "t-muted"}`}>{item.from}</span>
                  <span className="row justify-center" style={{ height: 56 }}>
                    {current ? (
                      <span className="medal anim-pop" style={/** @type {React.CSSProperties} */ ({ "--i": 2 })} aria-hidden="true"><Ic name="star" size="xl" style={{ color: "var(--on-gold)" }} /></span>
                    ) : reached ? (
                      <span className="medal medal-sm" aria-hidden="true"><Ic name="check" style={{ color: "var(--on-gold)" }} /></span>
                    ) : (
                      <span className="medal medal-sm is-locked" aria-hidden="true"><Ic name="flag" /></span>
                    )}
                  </span>
                  <span className={`t-caption t-strong t-break${current ? " t-ink" : ""}`}>{item.name}{current ? <span className="sr-only"> (peringkat Anda)</span> : null}</span>
                </li>
              );
            })}
          </ol>
        </div>
        <p className="t-support t-center">
          {rank.nextName ? <><span className="t-strong">{formatPoints(rank.toNext)} poin lagi</span> <span className="t-muted">menuju {rank.nextName}</span></> : <span className="t-strong">Peringkat tertinggi tercapai</span>}
        </p>
      </div>
    </section>
  );
}

function SummaryMetrics({ learning, user, certificates }) {
  const total = learning.moduleTotal || TOTAL_MODULES;
  const owned = certificates.filter((item) => item.source !== "legacy_unverified" && item.status !== "revoked");
  const topTier = owned.reduce((max, item) => Math.max(max, Number(item.tierNumber) || 0), 0);
  const since = formatDate(user?.created_at || user?.createdAt, { day: "2-digit", month: "short", year: "numeric" });
  const items = [
    { hue: "green", ic: "book", label: "Modul selesai", value: <>{learning.completedModules || 0} <small>dari {total}</small></>, note: `${learning.progressPercent || 0}% kurikulum` },
    { hue: "blue", ic: "target", label: "Rata-rata kuis", value: learning.quizAverage === null || learning.quizAverage === undefined ? "—" : `${learning.quizAverage}%`, note: "Dihitung dari nilai tersimpan" },
    { hue: "violet", ic: "clock", label: "Waktu belajar", value: formatStudyTime(learning.timeSpentMinutes), note: since ? `Sejak ${since}` : "Tercatat dari progres" },
    { hue: "teal", ic: "cert", label: "Sertifikat", value: <>{owned.length} <small>dari {TOTAL_CERTIFICATION_TIERS}</small></>, note: topTier ? `Tingkat ${topTier}` : "Belum ada" },
  ];
  return (
    <section className="grid-sm" aria-label="Ringkasan belajar">
      {items.map((item, index) => (
        <div key={item.label} className="card metric anim-rise" data-hue={item.hue} style={/** @type {React.CSSProperties} */ ({ "--i": index + 1 })}>
          <span className="metric-label"><span className="tile tile-sm tile-round tile-solid"><Ic name={item.ic} /></span>{item.label}</span>
          <span className="metric-value">{item.value}</span>
          <span className="metric-note">{item.note}</span>
        </div>
      ))}
    </section>
  );
}

const SEEN_ACHIEVEMENTS_KEY = "aapm.achievements.seen";

function readSeenAchievements(userId) {
  try { return JSON.parse(window.localStorage.getItem(`${SEEN_ACHIEVEMENTS_KEY}:${userId}`) || "null"); } catch { return null; }
}

function writeSeenAchievements(userId, ids) {
  try { window.localStorage.setItem(`${SEEN_ACHIEVEMENTS_KEY}:${userId}`, JSON.stringify(ids)); } catch { /* private mode: the celebration just repeats next visit */ }
}

// Always names the unit ("250 poin lagi"), so a number never stands alone.
function remainingText(achievement, current) {
  const left = Math.max(0, achievement.target - current);
  if (["quiz-ready", "quiz-90"].includes(achievement.id)) return `Naikkan rata-rata kuis ${left}% lagi`;
  if (achievement.id === "halfway") return `${left}% kurikulum lagi`;
  const unit = unitOf(achievement.id);
  return `${left}${unit ? ` ${unit}` : ""} lagi`;
}

function Achievements({ achievements, userId = "" }) {
  const unlockedList = achievements.filter((item) => item.unlocked);
  const unlocked = unlockedList.length;
  const total = achievements.length;
  const percentAll = total ? Math.round((unlocked / total) * 100) : 0;
  // Unlocked first, in the server's order; locked ones keep a progress bar.
  // Locked ones are sorted by how close they are, so the next win is always first.
  const closeness = (item) => (item.target ? Math.min(item.current, item.target) / item.target : 0);
  const allOrdered = [...unlockedList, ...achievements.filter((item) => !item.unlocked).sort((a, b) => closeness(b) - closeness(a))];
  const [showAll, setShowAll] = React.useState(false);
  const ordered = showAll ? allOrdered : allOrdered.slice(0, Math.max(ACHIEVEMENT_SHOWN_COLLAPSED, unlocked));
  const progressOf = (item) => (item.target ? Math.min(item.current, item.target) / item.target : 0);
  const next = achievements.filter((item) => !item.unlocked).sort((a, b) => progressOf(b) - progressOf(a))[0] || null;
  const { toast } = useToast();
  const [fresh, setFresh] = React.useState([]);

  // First visit just records what is already unlocked; later visits celebrate what is new.
  React.useEffect(() => {
    if (!userId || !total) return;
    const ids = unlockedList.map((item) => item.id);
    const seen = readSeenAchievements(userId);
    if (seen === null) { writeSeenAchievements(userId, ids); return; }
    const added = unlockedList.filter((item) => !seen.includes(item.id));
    if (!added.length) return;
    setFresh(added.map((item) => item.id));
    writeSeenAchievements(userId, ids);
    celebrate("milestone");
    toast({ title: added.length > 1 ? `${added.length} pencapaian baru!` : "Pencapaian baru!", description: added.map((item) => item.title).join(" · ") });
  }, [userId, total, unlockedList.map((item) => item.id).join(",")]);

  return (
    <section className="card card-pad stack gap-4 anim-rise" style={/** @type {React.CSSProperties} */ ({ "--i": 5 })} aria-labelledby="ach-title">
      <div className="card-head">
        <div className="stack gap-0-5">
          <h2 className="card-title" id="ach-title">Pencapaian</h2>
          <p className="card-desc">Dihitung dari aktivitas belajar dan data farm yang benar-benar tersimpan.</p>
        </div>
        <span className={`chip ${unlocked ? "chip-success" : ""}`}><Ic name="check" />{unlocked}/{total} terbuka</span>
      </div>
      {total ? (
        <div className="achv-hero" data-hue={unlocked === total ? "gold" : "green"}>
          <span className="achv-hero-medal" aria-hidden="true"><Ic name={unlocked === total ? "award" : "star"} /></span>
          <div className="stack grow gap-1-5" style={{ minWidth: 0 }}>
            <span className="t-heading">{unlocked === total ? "Semua pencapaian terbuka!" : unlocked ? `${unlocked} pencapaian sudah jadi milikmu` : "Buka pencapaian pertamamu"}</span>
            <Bar value={percentAll} size="sm" animate label={`Pencapaian terbuka ${percentAll}%`} />
            {next ? <span className="t-caption t-ink">Berikutnya: <span className="t-strong t-ink">{next.title}</span> · {remainingText(next, Math.min(next.current, next.target))}</span> : <span className="t-caption t-muted">Kamu luar biasa. Pertahankan kebiasaan belajarmu.</span>}
          </div>
        </div>
      ) : null}
      {total ? (
        <div className="grid-md">
          {ordered.map((achievement) => {
            const look = ACHIEVEMENT_LOOK[achievement.id] || (String(achievement.id).startsWith("curriculum-") ? { ic: "grad", hue: "teal" } : { ic: "award", hue: "green" });
            const current = Math.min(achievement.current, achievement.target);
            const percent = achievement.target ? Math.round((current / achievement.target) * 100) : 0;
            const unit = unitOf(achievement.id);
            const extra = achievement.unlocked && unit && achievement.current > achievement.target ? ` · ${achievement.current} ${unit}` : "";
            const isNew = fresh.includes(achievement.id);
            const close = !achievement.unlocked && percent >= 60;
            return (
              <article key={achievement.id} className={`achv${achievement.unlocked ? " is-unlocked" : " is-locked"}${isNew ? " is-new" : ""}`} data-hue={look.hue}>
                <span className={`tile tile-lg tile-round${achievement.unlocked ? " tile-solid rel" : ""}`}>
                  <Ic name={look.ic} />
                  {achievement.unlocked ? <span className="medal-badge"><Ic name="check" /></span> : null}
                </span>
                <div className="stack gap-1">
                  <div className="row wrap gap-2">
                    <h3 className="t-heading">{achievement.title}</h3>
                    {isNew ? <span className="chip chip-warning chip-dot">Baru!</span> : null}
                  </div>
                  <p className="t-caption t-muted">{achievement.description}</p>
                  {achievement.unlocked ? (
                    <span className="t-caption t-strong t-success row wrap gap-1"><Ic name="check-circle" size="xs" />Terbuka{extra}{achievement.earnedAt ? <span className="t-muted" style={{ fontWeight: 400 }}> · diraih {formatDate(achievement.earnedAt, { day: "numeric", month: "short", year: "numeric" })}</span> : null}{achievement.retained ? <span className="t-muted" style={{ fontWeight: 400 }}> · tetap milikmu meski kurikulum berubah</span> : null}</span>
                  ) : (
                    <div className="stack gap-1" style={{ paddingTop: 4 }}>
                      <Bar value={percent} size="sm" animate label={`${achievement.title} ${percent}%`} />
                      <span className={`t-caption t-strong t-num${close ? " t-warning" : ""}`}>{close ? `${remainingText(achievement, current)} — hampir!` : (achievement.id === "quiz-ready" ? `${current}% dari ${achievement.target}%` : `${current} dari ${achievement.target}${achievement.id === "halfway" ? "%" : unit ? ` ${unit}` : ""}`)}</span>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <StateView kind="empty" icon="award" title="Pencapaian belum tersedia" description="Pencapaian akan muncul setelah aktivitas belajar tercatat." framed={false} />
      )}
      {total > ACHIEVEMENT_SHOWN_COLLAPSED && (showAll || total > ordered.length) ? (
        <button type="button" className="btn btn-link btn-sm" style={{ alignSelf: "center" }} aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
          {showAll ? "Tampilkan lebih sedikit" : `Lihat semua ${total} pencapaian`}<Ic name={showAll ? "chev-up" : "chev-down"} />
        </button>
      ) : null}
    </section>
  );
}

function RankMarker({ rank }) {
  if (rank === 1) return <span className="medal medal-sm" data-hue="gold" aria-hidden="true"><span style={{ color: "var(--on-gold)" }}>1</span></span>;
  if (rank === 2) return <span className="medal medal-sm" data-hue="neutral" aria-hidden="true">2</span>;
  if (rank === 3) return <span className="medal medal-sm" data-hue="amber" aria-hidden="true">3</span>;
  return <span className="row justify-center t-support t-strong t-muted t-num none" style={{ width: 36 }} aria-hidden="true">{rank}</span>;
}

function HallOfFame({ hall, userId, me, profileUser }) {
  const entries = hall?.entries ?? [];
  const mine = entries.find((entry) => String(entry.userId) === String(userId));
  // Your rank also counts when you are outside the ten shown.
  const myRank = mine?.rank ?? hall?.viewerRank ?? null;
  return (
    <section className="card stack anim-rise" style={/** @type {React.CSSProperties} */ ({ "--i": 6 })} aria-labelledby="hof-title">
      <div className="card-pad stack gap-0-5" style={{ paddingBottom: 12 }}>
        <h2 className="card-title" id="hof-title">Hall of Fame</h2>
        <p className="card-desc">Peringkat dari poin pembelajaran. Hanya peserta yang memilih tampil.</p>
      </div>
      {entries.length ? (
        <ol className="list" aria-label="Lima teratas">
          {entries.slice(0, 5).map((entry, index) => (
            <li key={entry.userId} className="li" style={String(entry.userId) === String(userId) ? { background: "var(--primary-soft)" } : undefined} aria-current={String(entry.userId) === String(userId) ? "true" : undefined}>
              <RankMarker rank={entry.rank} />
              <ProfileAvatar user={{ avatar: entry.avatar }} name={entry.name} hue={AVATAR_HUES[index % AVATAR_HUES.length]} className="avatar-sm" alt="" />
              <div className="stack grow" style={{ minWidth: 0 }}>
                <span className="li-title t-clamp-1"><span className="sr-only">Peringkat {entry.rank}, </span>{entry.name}{String(entry.userId) === String(userId) ? <span className="chip chip-success" style={{ marginLeft: 8 }}>Anda</span> : null}</span>
                <span className="li-meta">{entry.level}</span>
              </div>
              <span className="t-support t-strong t-num t-nowrap">{formatPoints(entry.points)} poin</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="card-pad t-support t-muted" style={{ paddingTop: 0 }}>Belum ada peserta yang memilih tampil di Hall of Fame.</p>
      )}
      {/* Your own row only when the list above does not already show you. */}
      {!entries.slice(0, 5).some((entry) => String(entry.userId) === String(userId)) ? <div className="card-sect list" aria-label="Posisi Anda">
        <div className="li" style={{ background: "var(--primary-soft)" }}>
          <span className="row justify-center t-support t-strong t-num none" style={{ width: 36 }}>{myRank ? `#${myRank}` : "—"}</span>
          <ProfileAvatar user={profileUser} name={profileUser?.full_name} className="avatar-sm" alt="" />
          <div className="stack grow">
            <span className="li-title t-strong">Anda</span>
            <span className="li-meta">{me.optIn ? me.level : `${me.level} · belum tampil${me.isAdmin ? " (admin bisa memilih tampil di Atur privasi)" : ""}`}</span>
          </div>
          <span className="t-support t-strong t-num t-nowrap">{formatPoints(me.points)} poin</span>
        </div>
      </div> : null}
      <div className="card-foot mt-auto">
        <Ic name="shield" size="sm" className="t-muted" />
        <span className="t-caption t-muted grow">Email tidak pernah ditampilkan.</span>
        <Link className="btn btn-link btn-sm" to="/profile/settings">Atur privasi</Link>
      </div>
    </section>
  );
}

function PointRules() {
  return (
    <section className="card card-pad stack gap-4 anim-rise" style={/** @type {React.CSSProperties} */ ({ "--i": 7 })} aria-labelledby="pts-title">
      <div className="card-head">
        <div className="stack gap-0-5">
          <h2 className="card-title" id="pts-title">Cara mendapat poin</h2>
          <p className="card-desc">Dihitung server dari aktivitas yang benar-benar tersimpan. Poin menentukan peringkat Anda.</p>
        </div>
      </div>
      <ul className="grid-xs">
        {POINT_RULES.map((rule) => (
          <li key={rule.title} className="inset stack gap-2" data-hue={rule.hue} style={{ padding: 12 }}>
            <div className="row between gap-2"><span className="tile tile-sm tile-round tile-solid"><Ic name={rule.ic} /></span><span className="chip chip-gold t-num">{rule.reward}</span></div>
            <div className="stack"><span className="li-title">{rule.title}</span><span className="li-meta">{rule.meta}</span></div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------- settings */

function SectionTitle({ id, tile, title, desc, extra = undefined }) {
  return (
    <div className="row gap-3" style={{ paddingBottom: 24 }}>
      {tile}
      <div className="stack gap-0-5 grow">
        <div className="row wrap gap-2"><h2 className="card-title" id={id}>{title}</h2>{extra}</div>
        <p className="card-desc">{desc}</p>
      </div>
    </div>
  );
}

function FormRow({ title, desc, children, style = undefined }) {
  return (
    <div className="form-section" style={style}>
      <div className="stack gap-1">
        <h3 className="t-heading">{title}</h3>
        <p className="t-support t-muted">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function ProfileForm({ data, profileUser, onAvatarChange, avatarData }) {
  const saveProfile = useSaveLearningProfile();
  const { checkUserAuth } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const avatarInputRef = useRef(null);

  useEffect(() => {
    if (!data) return;
    setName(data.user?.full_name || "");
    setBio(data.profile?.bio || "");
    setOptIn(Boolean(data.profile?.hallOfFameOptIn));
  }, [data]);

  const handleAvatarSelection = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
      setAvatarError("Pilih foto JPG, PNG, atau WebP maksimal 8 MB.");
      return;
    }
    try {
      setAvatarError("");
      onAvatarChange(await resizeProfileImage(file));
    } catch (error) {
      setAvatarError(error.message || "Foto belum dapat dipakai.");
    }
  };

  const isDirty = name !== (data?.user?.full_name || "")
    || bio !== (data?.profile?.bio || "")
    || optIn !== Boolean(data?.profile?.hallOfFameOptIn)
    || avatarData !== (data?.profile?.avatar || data?.user?.avatar || "");

  const save = async () => {
    try {
      await saveProfile.mutateAsync({ fullName: name, bio, hallOfFameOptIn: optIn, avatarData });
      await checkUserAuth();
      toast({ title: "Profil disimpan", description: "Pengaturan profil dan privasi Anda telah diperbarui." });
    } catch (saveError) {
      toast({ variant: "destructive", title: "Profil belum tersimpan", description: saveError.message });
    }
  };

  return (
    <section className="card anim-rise" style={/** @type {React.CSSProperties} */ ({ "--i": 1 })} aria-labelledby="profil-title">
      <div className="card-pad-lg" style={{ paddingBottom: 0 }}>
        <SectionTitle id="profil-title" tile={<span className="tile tile-round" data-hue="green"><Ic name="user" /></span>} title="Profil" desc="Cara Anda tampil bagi peserta lain di Academy." />
        <FormRow title="Foto profil" desc="Foto dipotong persegi dan disimpan aman di akun Anda.">
          <div className="row wrap gap-4">
            <ProfileAvatar user={profileUser} name={name || profileUser?.full_name} className="avatar-lg" alt="" />
            <div className="stack gap-2">
              <div className="row wrap gap-2">
                <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Pilih foto profil" onChange={handleAvatarSelection} className="sr-only" />
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => avatarInputRef.current?.click()}><Ic name="camera" />{avatarData ? "Ganti foto" : "Tambah foto"}</button>
                {avatarData ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => { onAvatarChange(""); setAvatarError(""); }}>Hapus</button> : null}
              </div>
              {avatarError ? <p className="hint hint-error" role="alert"><Ic name="alert" size="xs" />{avatarError}</p> : <p className="hint">JPG, PNG, atau WebP, maksimal 8 MB.</p>}
            </div>
          </div>
        </FormRow>
        <FormRow title="Identitas" desc="Nama dan tentang saya tampil di ruang belajar.">
          <div className="stack gap-4" style={{ maxWidth: 560 }}>
            <Field id="pf-name" label="Nama tampil">
              <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} autoComplete="name" />
            </Field>
            <div className="field">
              <label className="label" htmlFor="pf-bio">Tentang saya<span className="opt">Opsional</span></label>
              <Textarea id="pf-bio" rows={3} maxLength={600} value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Ceritakan fokus belajar atau farm Anda." aria-describedby="pf-bio-hint" />
              <p className="hint" id="pf-bio-hint">Opsional. Fokus belajar atau konteks farm yang ingin Anda bagikan.</p>
            </div>
          </div>
        </FormRow>
        <FormRow title="Privasi" desc="Kendalikan apa yang terlihat oleh peserta lain.">
          <div className="stack gap-1-5" style={{ maxWidth: 560 }}>
            <label className="switch"><input type="checkbox" checked={optIn} onChange={(event) => setOptIn(event.target.checked)} aria-describedby="pf-hof-hint" />Tampilkan di Hall of Fame</label>
            <p className="hint" id="pf-hof-hint" style={{ paddingLeft: 46 }}>Hanya nama, level, dan poin pembelajaran yang ditampilkan. Email tidak pernah ditampilkan.</p>
          </div>
        </FormRow>
      </div>
      <div className="card-foot wrap" style={{ padding: "16px 24px" }}>
        <span className={`chip chip-dot ${isDirty ? "chip-warning" : "chip-success"}`} aria-live="polite">{isDirty ? "Ada perubahan belum disimpan" : "Semua perubahan tersimpan"}</span>
        <button type="button" className="btn btn-primary ml-auto" onClick={save} disabled={!isDirty || saveProfile.isPending} aria-busy={saveProfile.isPending || undefined}>
          {saveProfile.isPending ? <span className="typing" aria-hidden="true"><i /><i /><i /></span> : null}Simpan profil
        </button>
      </div>
    </section>
  );
}

const SOURCE_OPTIONS = [
  { value: "global", title: "Global AAPM (disarankan)", desc: "Dikelola Academy. Tidak perlu pengaturan apa pun." },
  { value: "provider", title: "Penyedia global lain", desc: "Pilih penyedia lain yang sudah disiapkan admin Academy." },
  { value: "custom", title: "Koneksi saya sendiri (lanjutan)", desc: "Pakai layanan AI milik Anda. Perlu alamat layanan dan kunci akses dari penyedia Anda." },
];

function AiAccountPreferences() {
  const { data, isLoading, error, refetch } = useAiAccountSettings();
  const save = useSaveAiAccountSettings();
  const { toast } = useToast();
  const [mode, setMode] = useState("global");
  const [providerId, setProviderId] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [authMode, setAuthMode] = useState("bearer");
  const [apiKey, setApiKey] = useState("");
  const [allowLocal, setAllowLocal] = useState(false);
  const [supportsVision, setSupportsVision] = useState(false);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!data) return;
    setMode(data.mode || "global");
    setProviderId(data.providerId || data.globalProviderId || "");
    setModel(data.model || "");
    setBaseUrl(data.customBaseUrl || "");
    setAuthMode(data.customAuthMode || "bearer");
    setAllowLocal(Boolean(data.customAllowLocal));
    setSupportsVision(Boolean(data.customSupportsVision));
    setEnabled(data.enabled !== false);
  }, [data]);

  const selectedProvider = data?.globalProviders?.find((item) => item.id === providerId);
  const chooseMode = (value) => {
    setMode(value);
    if (value === "global") {
      setProviderId(data?.globalProviderId || "");
      setModel("");
    }
  };
  const savePreferences = async () => {
    try {
      await save.mutateAsync({
        mode,
        providerId: mode === "provider" ? providerId : "",
        model: model.trim(),
        baseUrl: baseUrl.trim(),
        authMode,
        allowLocal,
        supportsVision,
        enabled,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });
      setApiKey("");
      toast({ title: "Preferensi APPI tersimpan", description: mode === "global" ? "Akun ini memakai Global AAPM Provider." : "Override APPI hanya berlaku untuk akun ini." });
    } catch (saveError) {
      toast({ variant: "destructive", title: "Preferensi APPI belum tersimpan", description: saveError.message });
    }
  };

  const tile = <span className="tile tile-round" data-hue="ai" style={{ overflow: "hidden" }}><img src={appiAsset(1)} alt="" style={{ width: 32, height: 32 }} /></span>;
  const head = <SectionTitle id="appi-title" tile={tile} title="APPI" desc="Atur dari mana APPI mengambil jawaban untuk akun Anda." extra={<span className="chip chip-outline">Hanya akun ini</span>} />;

  if (isLoading) {
    return (
      <section className="card card-pad-lg anim-rise" aria-labelledby="appi-title" aria-busy="true">
        {head}
        <div className="stack gap-3" style={{ maxWidth: 560 }}><span className="skel" style={{ height: 64 }} /><span className="skel" style={{ height: 64 }} /><span className="skel" style={{ height: 64 }} /></div>
      </section>
    );
  }
  if (error) {
    return (
      <section className="card card-pad-lg anim-rise" aria-labelledby="appi-title">
        {head}
        <div className="alert alert-danger" role="alert">
          <Ic name="alert" />
          <div className="row wrap between gap-3 grow">
            <p style={{ flex: "1 1 280px" }}><span className="alert-title">Preferensi APPI belum tersedia.</span> {error.message}</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => refetch()}><Ic name="refresh" />Coba lagi</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="card anim-rise" style={/** @type {React.CSSProperties} */ ({ "--i": 2 })} aria-labelledby="appi-title">
      <div className="card-pad-lg" style={{ paddingBottom: 0 }}>
        {head}
        <FormRow title="Sumber jawaban" desc={data?.note || "Pilihan default sudah diatur admin Academy dan cocok untuk sebagian besar peserta."}>
          <fieldset className="stack gap-3" style={{ maxWidth: 560, margin: 0, padding: 0, border: 0, minWidth: 0 }}>
            <legend className="sr-only">Sumber jawaban APPI</legend>
            {SOURCE_OPTIONS.map((option) => (
              <label key={option.value} className={`check card card-pad-sm w-full${mode === option.value ? " card-selected" : ""}`} data-hue={mode === option.value ? "green" : undefined}>
                <input type="radio" name="appi-source" value={option.value} checked={mode === option.value} onChange={() => chooseMode(option.value)} />
                <span className="stack gap-0-5">
                  <span className="t-strong">{option.title}</span>
                  <span className="t-caption t-muted">{option.desc}</span>
                </span>
              </label>
            ))}
            <details className="inset" open={mode === "custom" || undefined}>
              <summary className="row gap-2 t-support t-strong" style={{ display: "flex", height: 44, padding: "0 12px", cursor: "pointer" }}>
                <Ic name="sliders" size="sm" className="t-muted" /><span className="grow">Pengaturan lanjutan</span><Ic name="chev-down" size="sm" className="t-muted" />
              </summary>
              <div className="stack gap-4" style={{ padding: "4px 12px 16px" }}>
                {mode === "provider" ? (
                  <div className="field">
                    <label className="label" htmlFor="account-ai-provider">Penyedia global</label>
                    <Select value={providerId} onValueChange={setProviderId}>
                      <SelectTrigger id="account-ai-provider"><SelectValue placeholder="Pilih penyedia" /></SelectTrigger>
                      <SelectContent>
                        {(data?.globalProviders || []).map((provider) => <SelectItem key={provider.id} value={provider.id}>{provider.label} · {provider.model}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                {mode !== "custom" ? (
                  <Field id="account-ai-model" label="Model khusus" hint="Kosongkan agar mengikuti model yang dipilih admin. Isi ID model hanya jika penyedia mendukungnya.">
                    <Input value={model} onChange={(event) => setModel(event.target.value)} placeholder={selectedProvider?.model || data?.globalModel || "Ikuti model global"} />
                  </Field>
                ) : (
                  <>
                    <Field id="account-ai-base-url" label="Alamat layanan (base URL)">
                      <Input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://gateway.example.com/v1" inputMode="url" />
                    </Field>
                    <div className="form-grid">
                      <Field id="account-ai-custom-model" label="ID model">
                        <Input value={model} onChange={(event) => setModel(event.target.value)} placeholder="llama3.2 atau model penyedia" />
                      </Field>
                      <div className="field">
                        <label className="label" htmlFor="account-ai-auth">Autentikasi</label>
                        <Select value={authMode} onValueChange={setAuthMode}>
                          <SelectTrigger id="account-ai-auth"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bearer">Bearer</SelectItem>
                            <SelectItem value="x-api-key">X-API-Key</SelectItem>
                            <SelectItem value="none">Tanpa kunci / lokal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Field id="account-ai-key" label="Kunci akses (API key)" hint={data?.apiKeyConfigured ? "Kosongkan untuk mempertahankan kunci yang tersimpan." : "Opsional untuk layanan lokal. Kunci hanya tersimpan di akun Anda."}>
                      <Input type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={data?.apiKeyConfigured ? "Tersimpan · isi untuk mengganti" : "Tempel API key"} />
                    </Field>
                    <label className="switch"><input type="checkbox" checked={allowLocal} onChange={(event) => setAllowLocal(event.target.checked)} />Izinkan layanan privat / lokal</label>
                    <label className="switch"><input type="checkbox" checked={supportsVision} onChange={(event) => setSupportsVision(event.target.checked)} />Model mendukung input gambar</label>
                  </>
                )}
              </div>
            </details>
          </fieldset>
        </FormRow>
        <FormRow title="Akses APPI" desc="Matikan jika Anda belum ingin memakai asisten.">
          <div className="stack gap-1-5" style={{ maxWidth: 560 }}>
            <label className="switch switch-ai"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} aria-describedby="appi-on-hint" />Izinkan APPI pada akun ini</label>
            <p className="hint" id="appi-on-hint" style={{ paddingLeft: 46 }}>Jika dimatikan, APPI memakai balasan lokal.</p>
          </div>
        </FormRow>
      </div>
      <div className="card-foot wrap" style={{ padding: "16px 24px" }}>
        <button type="button" className="btn btn-secondary ml-auto" onClick={savePreferences} disabled={save.isPending} aria-busy={save.isPending || undefined}>
          {save.isPending ? <span className="typing" aria-hidden="true"><i /><i /><i /></span> : null}Simpan preferensi APPI
        </button>
      </div>
    </section>
  );
}

function DevicePanel() {
  const { canInstall, isInstalled, install } = usePwaInstall();
  const { toast } = useToast();
  const handleInstall = async () => {
    const result = await install();
    if (result?.outcome === "accepted") {
      toast({ title: "AAPM Academy dipasang", description: "Buka kembali dari layar utama untuk pengalaman yang lebih ringkas." });
    }
  };
  const steps = [
    <>Buka Academy di <span className="t-strong">Safari</span>.</>,
    <span key="share" className="row wrap gap-1">Ketuk <span className="row gap-1 t-strong"><Ic name="upload" size="sm" />Bagikan</span></span>,
    <>Pilih <span className="t-strong">Tambahkan ke Layar Utama</span>.</>,
  ];
  return (
    <section className="card anim-rise" style={/** @type {React.CSSProperties} */ ({ "--i": 3 })} aria-labelledby="device-title">
      <div className="card-pad-lg">
        <SectionTitle id="device-title" tile={<span className="tile tile-round" data-hue="blue"><Ic name="phone" /></span>} title="Perangkat" desc="Pasang Academy di perangkat untuk membuka materi, APPI, dan alat farm lebih cepat." />
        <FormRow title="iPhone & iPad" desc="Safari tidak menampilkan tombol instal. Tambahkan dari menu Bagikan.">
          <ol className="grid-xs" style={{ maxWidth: 720 }} aria-label="Langkah memasang di iPhone">
            {steps.map((step, index) => (
              <li key={index} className="inset row gap-3" style={{ padding: "12px 14px" }}>
                <span className="tile tile-sm tile-round tile-solid" data-hue="blue"><span className="t-support t-strong">{index + 1}</span></span>
                <span className="t-support">{step}</span>
              </li>
            ))}
          </ol>
        </FormRow>
        <FormRow title="Android & komputer" desc="Chrome dan Edge bisa memasang Academy langsung." style={{ paddingBottom: 0 }}>
          <div className="row wrap gap-3">
            {isInstalled ? (
              <span className="chip chip-success"><Ic name="check" />Sudah terpasang</span>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={handleInstall} disabled={!canInstall}><Ic name="download" />Instal Academy</button>
            )}
            <span className="t-caption t-muted">
              {isInstalled ? "Academy sudah tersedia sebagai aplikasi di perangkat ini." : canInstall ? "Belum terpasang di perangkat ini." : "Jika tombol belum aktif, pilih Install app dari menu browser."}
            </span>
          </div>
        </FormRow>
      </div>
    </section>
  );
}

/** Quiet, dismissible reminder for unverified accounts. It never blocks learning. */
function VerificationReminder() {
  const { user } = useAuth();
  const [hidden, setHidden] = useState(false);
  const [note, setNote] = useState("");
  if (!user || user.emailVerified || hidden) return null;
  const send = async () => {
    setNote("");
    try {
      await nativeApi.auth.resendVerification({});
      setNote(`Tautan verifikasi dikirim ke ${user.email}. Periksa juga folder spam.`);
    } catch (error) {
      setNote(error?.message || "Instruksi belum dapat dikirim. Coba lagi nanti.");
    }
  };
  return (
    <div className="alert alert-warning anim-rise" role="status">
      <Ic name="mail" />
      <div className="stack gap-2 grow">
        <div className="row wrap between gap-3">
          <p style={{ flex: "1 1 320px" }}><span className="alert-title">Verifikasi alamat email Anda.</span> Diperlukan untuk klaim sertifikat; akses belajar tetap tersedia.</p>
          <div className="row wrap gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={send}>Kirim instruksi verifikasi</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHidden(true)}>Nanti saja</button>
          </div>
        </div>
        {note ? <p className="t-caption" aria-live="polite">{note}</p> : null}
      </div>
    </div>
  );
}

function ProfileHeader() {
  return (
    <div className="stack gap-4">
      <header className="ph">
        <div className="ph-copy">
          <h1 className="ph-title">Prestasi &amp; profil</h1>
          <p className="ph-desc">Identitas belajar, pencapaian, dan preferensi akun Anda.</p>
        </div>
      </header>
      <nav className="tabs" aria-label="Bagian profil">
        <NavLink end to="/profile" className={({ isActive }) => `tab${isActive ? " is-on" : ""}`}><Ic name="medal" />Ringkasan</NavLink>
        <NavLink to="/profile/settings" className={({ isActive }) => `tab${isActive ? " is-on" : ""}`}><Ic name="sliders" />Pengaturan</NavLink>
      </nav>
    </div>
  );
}

export default function Profile() {
  const location = useLocation();
  const settings = location.pathname.startsWith("/profile/settings");
  const { data, isLoading, error, refetch } = useLearningProfile();
  const { data: hall } = useHallOfFame();
  const { data: certificates = [] } = useCertificates();
  const { user: authUser } = useAuth();
  const [avatarData, setAvatarData] = useState("");

  useEffect(() => {
    if (data) setAvatarData(data.profile?.avatar || data.user?.avatar || "");
  }, [data]);

  if (isLoading) {
    return (
      <Page>
        <ProfileHeader />
        <StateView kind="loading" title="Memuat profil…" framed={false} />
      </Page>
    );
  }
  if (error) {
    return (
      <Page>
        <ProfileHeader />
        <StateView kind="error" title="Profil belum dapat dimuat" description={error.message} action={<button type="button" className="btn btn-secondary" onClick={() => refetch()}><AapmIcon name="refresh" />Coba lagi</button>} />
      </Page>
    );
  }

  const learning = data?.learning || {};
  const user = data?.user || authUser || {};
  const profileUser = { ...user, avatar: avatarData };
  const rank = getRankProgress(learning.points);

  return (
    <Page>
      <ProfileHeader />
      {settings ? (
        <>
          <VerificationReminder />
          <ProfileForm data={data} profileUser={profileUser} avatarData={avatarData} onAvatarChange={setAvatarData} />
          <AiAccountPreferences />
          <DevicePanel />
        </>
      ) : (
        <>
          <ProfileHero user={user} profileUser={profileUser} rank={rank} />
          <SummaryMetrics learning={learning} user={user} certificates={Array.isArray(certificates) ? certificates : []} />
          <div className="split stretch">
            <Achievements achievements={learning.achievements || []} userId={user?.id ? String(user.id) : ""} />
            <HallOfFame hall={hall} userId={user.id} profileUser={profileUser} me={{ points: rank.points, level: rank.name, optIn: Boolean(data?.profile?.hallOfFameOptIn), isAdmin: ["admin", "super_admin"].includes(user?.role) }} />
          </div>
          <PointRules />
        </>
      )}
    </Page>
  );
}
