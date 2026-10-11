// @ts-nocheck
import React, { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Alert, ConfirmDialog, Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, Field, Input,
  OverflowMenu, StateView, Tabs, TabsContent,
  TabsList, TabsTrigger, useToast,
} from "@/design-system";
import { useAdminCourse, useArchiveAdminModule, useRestoreAdminModule } from "@/lib/useAdminData";
import { levelVisual } from "@/lib/academyVisuals";
import { AdminError, AdminLoading, AdminPageFrame } from "@/components/admin/AdminPage";
import { formatAdminDate } from "@/components/admin/adminUtils";
import { curriculumStructureRecovery, filterCurriculum, nextChapterNumber, runCurriculumLifecycleMutation } from "@/lib/curriculumState";
import { Ic } from "@/design-system/canvas";
import { CourseLifecycleCounts, ModuleLifecycleStatus } from "@/components/admin/CurriculumStatus";

const moduleEditorPath = (courseId, params = {}) => {
  const query = new URLSearchParams(Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => [key, String(value)])).toString();
  return `/admin/courses/${courseId}/modules/new${query ? `?${query}` : ""}`;
};

export default function AdminCourseDetail() {
  const { courseId } = useParams();
  const { data: course, isLoading, error, refetch } = useAdminCourse(courseId);
  const archiveModule = useArchiveAdminModule();
  const restoreModule = useRestoreAdminModule();
  const { toast } = useToast();
  const [view, setView] = useState("list");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAllChapters, setShowAllChapters] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [actionError, setActionError] = useState(null);
  const actionInFlight = useRef(false);
  const levels = course?.curriculum || [];
  const modules = useMemo(() => (course?.curriculum || []).flatMap((level) => level.modules || []), [course]);
  const filteredLevels = useMemo(() => {
    const searched = filterCurriculum(course?.curriculum || [], query);
    return searched.map((level) => ({
      ...level,
      modules: level.modules.filter((module) => {
        if (statusFilter === "unpublished") return Boolean(module.draft?.hasUnpublishedChanges);
        if (statusFilter === "draft") return module.lifecycleStatus === "draft";
        if (statusFilter === "archived") return module.lifecycleStatus === "archived";
        return true;
      }),
    })).filter((level) => level.modules.length);
  }, [course, query, statusFilter]);
  const visibleLevels = showAllChapters || query.trim() || statusFilter !== "all" ? filteredLevels : filteredLevels.slice(0, 5);
  const visibleModuleCount = filteredLevels.reduce((count, level) => count + level.modules.length, 0);
  const hiddenChapterCount = Math.max(0, filteredLevels.length - visibleLevels.length);
  const hiddenModuleCount = filteredLevels.slice(visibleLevels.length).reduce((count, level) => count + level.modules.length, 0);
  const nextLevelNumber = nextChapterNumber(levels);
  const newModulePath = moduleEditorPath(courseId);
  const saving = archiveModule.isPending || restoreModule.isPending;
  const recovery = curriculumStructureRecovery(actionError || error, actionError?.modulePath);
  const closeAction = () => {
    if (actionInFlight.current) return;
    setPendingAction(null); setConfirmed(false); setReason("");
  };
  const selectAction = (module, action) => {
    if (actionInFlight.current) return;
    setPendingAction({ module, action }); setReason(""); setConfirmed(false); setActionError(null);
  };
  const submitAction = async () => {
    if (!pendingAction || actionInFlight.current) return;
    const { module, action } = pendingAction;
    if (action === "archive" && (reason.trim().length < 5 || reason.trim().length > 500)) return;
    actionInFlight.current = true;
    setConfirmed(false);
    try {
      await runCurriculumLifecycleMutation(
        () => action === "archive"
          ? archiveModule.mutateAsync({ moduleId: module.id, reason: reason.trim() })
          : restoreModule.mutateAsync({ moduleId: module.id }),
        (mutationError) => setActionError(mutationError ? {
          code: mutationError.code, message: mutationError.message,
          modulePath: `/admin/courses/${courseId}/modules/${module.id}`,
        } : null),
      );
      setPendingAction(null); setReason("");
      toast({ title: action === "archive" ? "Modul diarsipkan" : "Modul dipulihkan", description: "Riwayat dan bukti akademik tetap tersimpan." });
    } catch (mutationError) {
      toast({ variant: "destructive", title: "Perubahan status belum disimpan", description: mutationError.message });
    } finally { actionInFlight.current = false; }
  };

  return (
    <AdminPageFrame back={{ to: "/admin/courses", label: "Semua course" }} title="Kurikulum"
      description="Kelola draf materi, penerbitan, serta status modul Academy."
      actions={<><Link className="btn btn-secondary" to="/modules"><Ic name="eye" />Pratinjau peserta</Link><Link className="btn btn-primary" to={newModulePath}><Ic name="plus" />Tambah modul</Link></>}
    >
      {isLoading ? <AdminLoading label="Memuat struktur kurikulum…" /> : error ? <>
        <AdminError error={error} onRetry={refetch} />
        {recovery && <Alert tone="warning" title="Perubahan memerlukan draf" description={recovery.message} action={<Link className="btn btn-secondary btn-sm" to={recovery.to}>{recovery.label}</Link>} />}
      </> : course ? <>
        <section className="card card-pad row wrap gap-5 anim-rise" data-hue="blue" aria-labelledby="course-name">
          <div className="cover hide-sm" style={{ width: 72, height: 72, borderRadius: "var(--r-ctl)", flex: "none" }}><span className="tile tile-sm" style={{ margin: 20 }}><Ic name="egg" /></span></div>
          <div className="stack gap-2" style={{ flex: "1 1 320px", minWidth: 0 }}>
            <h2 className="t-heading t-clamp-1" id="course-name">{course.title}</h2>
            <CourseLifecycleCounts counts={course.lifecycleCounts} />
          </div>
          <dl className="row gap-8">
            <div className="stack gap-0-5"><dt className="t-caption t-muted">Chapter</dt><dd className="t-section t-num">{levels.length}</dd></div>
            <div className="stack gap-0-5"><dt className="t-caption t-muted">Modul</dt><dd className="t-section t-num">{course.moduleCount}</dd></div>
            <div className="stack gap-0-5"><dt className="t-caption t-muted">Peserta aktif</dt><dd className="t-section t-num">{course.activeLearnerCount ?? course.learnerCount}</dd></div>
          </dl>
        </section>
        <Tabs defaultValue="curriculum" className="stack gap-5">
          <TabsList aria-label="Bagian course"><TabsTrigger value="curriculum"><Ic name="route" />Kurikulum</TabsTrigger><TabsTrigger value="overview"><Ic name="chart" />Ringkasan</TabsTrigger></TabsList>
          <TabsContent value="curriculum" className="stack gap-4">
            <h2 className="sr-only">Daftar chapter dan modul</h2>
            <div className="alert alert-info wrap" style={{ alignItems: "center" }}>
              <Ic name="info" />
              <p style={{ flex: "1 1 240px", minWidth: 0 }}>Urutan dan persyaratan diubah lewat Kebijakan kurikulum.</p>
              <Link className="btn btn-secondary btn-sm" to="/admin/curriculum/policies"><Ic name="route" />Kebijakan kurikulum</Link>
            </div>
            <div className="toolbar">
              <label className="search" style={{ flex: "1 1 220px", maxWidth: 300 }}>
                <Ic name="search" size="sm" /><span className="sr-only">Cari chapter atau modul</span>
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari chapter atau modul…" />
              </label>
              <div className="seg" role="group" aria-label="Tampilan kurikulum">
                <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}><Ic name="list" />Daftar</button>
                <button type="button" aria-pressed={view === "board"} onClick={() => setView("board")}><Ic name="columns" />Board</button>
              </div>
              <div className="scroll-x" style={{ maxWidth: "100%" }}>
                <div className="seg" role="group" aria-label="Filter status modul">
                  {[
                    { value: "all", label: "Semua" },
                    { value: "unpublished", label: "Belum terbit", count: modules.filter((module) => module.draft?.hasUnpublishedChanges).length },
                    { value: "draft", label: "Draf", count: modules.filter((module) => module.lifecycleStatus === "draft").length },
                    { value: "archived", label: "Arsip", count: modules.filter((module) => module.lifecycleStatus === "archived").length },
                  ].map((filter) => (
                    <button key={filter.value} type="button" aria-pressed={statusFilter === filter.value} onClick={() => { setStatusFilter(filter.value); setShowAllChapters(false); }}>
                      {filter.label}{filter.count !== undefined ? <span className="count">{filter.count}</span> : null}
                    </button>
                  ))}
                </div>
              </div>
              {nextLevelNumber
                ? <Link className="btn btn-secondary btn-sm ml-auto" to={moduleEditorPath(courseId, { newChapter: 1, levelNumber: nextLevelNumber })}><Ic name="plus" />Tambah chapter</Link>
                : <button type="button" className="btn btn-secondary btn-sm ml-auto" disabled title="Maksimal 20 chapter.">Chapter penuh</button>}
            </div>
            {actionError && <Alert tone="danger" title="Perubahan status belum disimpan" description={actionError.message} action={recovery ? <Link className="btn btn-secondary btn-sm" to={recovery.to}>{recovery.label}</Link> : undefined} />}
            {query.trim() && <div className="row wrap between gap-2"><p className="t-caption t-muted" role="status">{visibleModuleCount} dari {modules.length} modul.</p><button type="button" className="btn btn-ghost btn-sm" onClick={() => setQuery("")}>Hapus pencarian</button></div>}
            {!levels.length ? <StateView kind="empty" icon="lesson" title="Kurikulum belum memiliki modul" description="Mulai dengan draf modul pertama." action={<Link className="btn btn-primary" to={newModulePath}>Tambah modul pertama</Link>} />
              : !visibleLevels.length ? <StateView kind="empty" icon="search" title="Tidak ada modul yang cocok" description="Coba ubah kata kunci atau filter status." action={<button type="button" className="btn btn-secondary" onClick={() => { setQuery(""); setStatusFilter("all"); }}>Hapus filter</button>} />
                : <>
                  <CurriculumView levels={visibleLevels} courseId={courseId} board={view === "board"} onAction={selectAction} saving={saving} />
                  {filteredLevels.length > 5 && !query.trim() && statusFilter === "all" ? (
                    <div className="card card-dashed row wrap gap-3" style={{ padding: "12px var(--card-pad)" }}>
                      <span className="tile tile-sm" data-hue="neutral"><Ic name="layers" /></span>
                      <p className="grow t-support t-muted">{showAllChapters ? "Semua chapter ditampilkan" : `Chapter ${visibleLevels[visibleLevels.length - 1].levelNumber + 1}–${filteredLevels[filteredLevels.length - 1].levelNumber} · ${hiddenModuleCount} modul lainnya`}</p>
                      <button type="button" className="btn btn-ghost btn-sm" aria-expanded={showAllChapters} onClick={() => setShowAllChapters((current) => !current)}>
                        {showAllChapters ? "Sembunyikan chapter tambahan" : "Tampilkan semua chapter"}<Ic name={showAllChapters ? "chev-up" : "chev-down"} />
                      </button>
                    </div>
                  ) : null}
                </>}
            <p className="note">Jumlah perubahan belum terbit termasuk modul terbit atau arsip yang memiliki koreksi draf. Arsip tidak menghapus nilai, progres, sertifikat, atau revisi terbit; modul wajib tetap tersedia sesuai kebijakan peserta.</p>
          </TabsContent>
          <TabsContent value="overview" className="stack gap-4">
            <section className="grid-sm" aria-label="Ringkasan course">
              <div className="card metric" data-hue="green"><span className="metric-label"><span className="tile tile-xs"><Ic name="layers" /></span>Struktur</span><span className="metric-value">{course.moduleCount} <small>modul</small></span><span className="metric-note">{levels.length} chapter</span></div>
              <div className="card metric" data-hue="blue"><span className="metric-label"><span className="tile tile-xs"><Ic name="grad" /></span>Peserta dengan progres</span><span className="metric-value">{course.learnerCount}</span><span className="metric-note">Akun yang sudah memulai</span></div>
              <div className="card metric" data-hue="orange"><span className="metric-label"><span className="tile tile-xs"><Ic name="edit" /></span>Konten &amp; bank soal</span><span className="metric-value">Draf → Terbit</span><span className="metric-note">Validasi di editor modul</span></div>
            </section>
            <div className="grid-md">
              <Link className="card card-tactile card-pad row gap-4" to="/admin/curriculum/policies" data-hue="teal"><span className="tile"><Ic name="route" /></span><div className="stack gap-0-5 grow"><h3 className="t-heading t-clamp-1">Kebijakan kurikulum</h3><span className="t-support t-muted t-clamp-1">Urutan dan persyaratan peserta</span></div><Ic name="chev-right" className="t-muted" /></Link>
              <Link className="card card-tactile card-pad row gap-4" to="/admin/curriculum/final-bank" data-hue="violet"><span className="tile"><Ic name="exam" /></span><div className="stack gap-0-5 grow"><h3 className="t-heading t-clamp-1">Bank ujian akhir</h3><span className="t-support t-muted t-clamp-1">Soal ujian akhir Tingkat 6</span></div><Ic name="chev-right" className="t-muted" /></Link>
            </div>
            <div className="alert" role="note"><Ic name="sparkle" className="t-ai" /><div>APPI membantu isi draf melalui editor modul. Saran selalu ditinjau sebelum disimpan.</div></div>
            {course.availabilityNote && <Alert tone="info" title="Catatan ketersediaan" description={course.availabilityNote} />}
          </TabsContent>
        </Tabs>
      </> : null}
      <Dialog open={Boolean(pendingAction) && !confirmed} onOpenChange={(open) => !open && closeAction()}>
        <DialogContent><DialogHeader><DialogTitle>{pendingAction?.action === "archive" ? "Arsipkan modul" : "Pulihkan modul"}</DialogTitle><DialogDescription>{pendingAction?.module.title}. Riwayat dan bukti akademik tetap tersimpan.</DialogDescription></DialogHeader>
          {pendingAction?.action === "archive" ? <>
            <Field id="course-archive-reason" label="Alasan pengarsipan (5–500 karakter)" required><Input id="course-archive-reason" value={reason} maxLength={500} disabled={saving} onChange={(event) => setReason(event.target.value)} /></Field>
            <p className="t-support t-muted">Materi wajib tetap tersedia sesuai kebijakan peserta. Arsip tidak menghapus nilai, progres, sertifikat, atau revisi terbit.</p>
          </> : <p className="t-support t-muted">Modul kembali aktif dengan revisi terakhir yang sudah diterbitkan. Koreksi draf tetap memerlukan validasi dan penerbitan.</p>}
          {actionError && <p className="hint hint-error" role="alert"><Ic name="alert" size="xs" />{actionError.message}</p>}
          <DialogFooter><button type="button" className="btn btn-ghost" onClick={closeAction} disabled={saving}>Batal</button><button type="button" className={`btn ${pendingAction?.action === "archive" ? "btn-danger" : "btn-primary"}`} disabled={saving || (pendingAction?.action === "archive" && (reason.trim().length < 5 || reason.trim().length > 500))} onClick={() => setConfirmed(true)}>{pendingAction?.action === "archive" ? "Arsipkan" : "Pulihkan modul"}</button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={confirmed} onOpenChange={(open) => { if (!open && !actionInFlight.current) setConfirmed(false); }}
        title={pendingAction?.action === "archive" ? "Arsipkan modul?" : "Pulihkan modul?"}
        description={pendingAction?.action === "archive" ? `${pendingAction?.module.title}. Alasan: ${reason.trim()}. Riwayat dan bukti akademik tidak dihapus.` : `${pendingAction?.module.title} kembali aktif dengan revisi terakhir yang sudah diterbitkan.`}
        confirmLabel={pendingAction?.action === "archive" ? "Ya, arsipkan" : "Ya, pulihkan"} onConfirm={submitAction} />
    </AdminPageFrame>
  );
}

function ModuleActions({ module, courseId, onAction, saving }) {
  const navigate = useNavigate();
  const editor = `/admin/courses/${courseId}/modules/${module.id}`;
  const items = [
    { id: "edit", label: "Edit draf", icon: "edit", onSelect: () => navigate(editor) },
    module.publishedRevisionId && module.lifecycleStatus !== "archived" ? { id: "preview", label: "Pratinjau peserta", icon: "eye", onSelect: () => navigate(`/modules/${module.moduleNumber}`) } : null,
    { id: "policy", label: "Kebijakan kurikulum", icon: "roadmap", onSelect: () => navigate("/admin/curriculum/policies") },
    module.lifecycleStatus === "active" && module.publishedRevisionId ? { id: "archive", label: "Arsipkan", icon: "folder", disabled: saving, onSelect: () => onAction(module, "archive") } : null,
    module.lifecycleStatus === "archived" ? { id: "restore", label: "Pulihkan modul", icon: "refresh", disabled: saving, onSelect: () => onAction(module, "restore") } : null,
  ].filter(Boolean);
  return (
    <div className="row gap-2 none">
      <Link className="btn btn-secondary btn-sm hide-sm" to={editor}><Ic name="edit" />Edit draf</Link>
      <OverflowMenu label={`Aksi untuk ${module.title}`} items={items} />
    </div>
  );
}

function ModuleRow({ module, courseId, onAction, saving, compact }) {
  const meta = [module.category, module.updatedAt ? `Diperbarui ${formatAdminDate(module.updatedAt, { year: undefined })}` : null].filter(Boolean).join(" · ") || module.summary || "Tanpa kategori";
  return (
    <li className="li" style={{ minHeight: 56 }}>
      <span className="egg egg-xs" aria-hidden="true">{module.moduleNumber}</span>
      <div className="row wrap grow" style={{ gap: "4px 16px", minWidth: 0 }}>
        <div className="stack" style={{ flex: compact ? "1 1 100%" : "1 1 280px", minWidth: 0 }}>
          <Link className="li-title t-clamp-1" to={`/admin/courses/${courseId}/modules/${module.id}`}><span className="sr-only">Modul {module.moduleNumber}: </span>{module.title}</Link>
          <span className="li-meta t-clamp-1">{meta}</span>
          {module.publishedTitle && module.publishedTitle !== module.title ? <span className="li-meta t-clamp-1">Judul terbit: {module.publishedTitle}</span> : null}
          {module.lifecycleStatus === "archived" ? <span className="li-meta t-clamp-1">Alasan arsip: {module.archiveReason || "—"}</span> : null}
        </div>
        <div className="row" style={{ flex: compact ? "1 1 100%" : "0 0 200px" }}><ModuleLifecycleStatus module={module} /></div>
      </div>
      <ModuleActions module={module} courseId={courseId} onAction={onAction} saving={saving} />
    </li>
  );
}

function CurriculumView({ levels, courseId, board, onAction, saving }) {
  return (
    <div className={board ? "grid-lg" : "stack gap-4"}>
      {levels.map((level, index) => {
        const visual = levelVisual(level.levelNumber);
        return (
          <section key={level.levelNumber} className="card anim-rise" data-hue={visual.hue} style={/** @type {React.CSSProperties} */ ({ "--i": index + 3, alignSelf: board ? "start" : undefined })} aria-labelledby={`ch${level.levelNumber}-title`}>
            <div className="row gap-3" style={{ padding: "12px var(--card-pad)" }}>
              <span className="tile tile-round"><Ic name={visual.ic} /></span>
              <div className="stack grow" style={{ minWidth: 0 }}>
                <span className="t-overline t-ink">Chapter {level.levelNumber}</span>
                <h3 className="t-heading t-clamp-1" id={`ch${level.levelNumber}-title`}>{level.levelName}</h3>
              </div>
              <span className="chip chip-hue hide-sm">{level.modules.length} modul</span>
              <Link className="btn btn-ghost btn-sm" to={moduleEditorPath(courseId, { levelNumber: level.levelNumber, levelName: level.levelName })} aria-label={`Tambah draf modul di Chapter ${level.levelNumber}`}><Ic name="plus" /><span className="hide-sm">Tambah draf modul</span></Link>
            </div>
            <ol className="list card-sect" aria-label={`Modul Chapter ${level.levelNumber}`}>
              {level.modules.map((module) => <ModuleRow key={module.id} module={module} courseId={courseId} onAction={onAction} saving={saving} compact={board} />)}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
