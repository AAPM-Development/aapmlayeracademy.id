// @ts-nocheck
import React, { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Alert, Badge, Button, ConfirmDialog, Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, Field, IconTile, Input, KPICluster,
  OverflowMenu, SearchInput, SegmentedControl, StateView, Tabs, TabsContent,
  TabsList, TabsTrigger, useToast,
} from "@/design-system";
import AapmIcon from "@/components/icons/AapmIcon";
import { ModuleCover } from "@/components/academy/CourseElements";
import { useAdminCourse, useArchiveAdminModule, useRestoreAdminModule } from "@/lib/useAdminData";
import { levelVisual } from "@/lib/academyVisuals";
import { AdminError, AdminLoading, AdminPageFrame } from "@/components/admin/AdminPage";
import { curriculumStructureRecovery, filterCurriculum, nextChapterNumber, runCurriculumLifecycleMutation } from "@/lib/curriculumState";
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
  const [pendingAction, setPendingAction] = useState(null);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [actionError, setActionError] = useState(null);
  const actionInFlight = useRef(false);
  const levels = course?.curriculum || [];
  const modules = useMemo(() => (course?.curriculum || []).flatMap((level) => level.modules || []), [course]);
  const visibleLevels = useMemo(() => filterCurriculum(course?.curriculum || [], query), [course, query]);
  const visibleModuleCount = visibleLevels.reduce((count, level) => count + level.modules.length, 0);
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
      actions={<><Button asChild variant="secondary"><Link to="/modules"><AapmIcon name="eye" />Pratinjau learner</Link></Button><Button asChild><Link to={newModulePath}><AapmIcon name="add" />Tambah modul</Link></Button></>}
    >
      {isLoading ? <AdminLoading label="Memuat struktur kurikulum…" /> : error ? <>
        <AdminError error={error} onRetry={refetch} />
        {recovery && <Alert tone="warning" title="Perubahan memerlukan draf" description={recovery.message} action={<Button asChild variant="secondary"><Link to={recovery.to}>{recovery.label}</Link></Button>} />}
      </> : course ? <>
        <section className="aapm-card aapm-course-summary" aria-label="Ringkasan course">
          <ModuleCover level={1} number={course.moduleCount} />
          <div className="grid min-w-0 flex-1 gap-2">
            <h2 className="aapm-text-section m-0">{course.title}</h2>
            <CourseLifecycleCounts counts={course.lifecycleCounts} />
            <p className="aapm-text-support m-0">Simpan draf tidak mengubah materi terbit. Validasi dan Terbitkan dilakukan dari editor modul.</p>
          </div>
          <dl className="grid grid-cols-3 gap-6 text-right max-sm:w-full max-sm:text-left">
            <div><dt className="aapm-text-caption">Chapter</dt><dd className="aapm-text-section m-0 aapm-numeric">{levels.length}</dd></div>
            <div><dt className="aapm-text-caption">Modul</dt><dd className="aapm-text-section m-0 aapm-numeric">{course.moduleCount}</dd></div>
            <div><dt className="aapm-text-caption">Learner aktif</dt><dd className="aapm-text-section m-0 aapm-numeric">{course.learnerCount}</dd></div>
          </dl>
        </section>
        <Tabs defaultValue="curriculum" className="grid gap-5">
          <TabsList variant="underline"><TabsTrigger value="curriculum" icon="roadmap">Kurikulum</TabsTrigger><TabsTrigger value="overview" icon="analytics">Ringkasan</TabsTrigger><TabsTrigger value="learners" icon="graduation">Peserta</TabsTrigger></TabsList>
          <TabsContent value="curriculum" className="grid gap-4">
            <Alert tone="info" title="Ubah struktur melalui draf" className="max-sm:!grid-cols-[auto_minmax(0,1fr)] max-sm:[&>div:last-child]:col-start-2 max-sm:[&>div:last-child]:row-start-2"
              description="Urutan kurikulum diubah melalui draf kebijakan kurikulum. Nama chapter diubah melalui draf modul. Perubahan langsung ke modul terbit sudah dinonaktifkan."
              action={<Button asChild variant="secondary"><Link to="/admin/curriculum/policies">Kebijakan kurikulum</Link></Button>} />
            <div className="flex flex-wrap gap-2"><Button asChild variant="outline" size="sm"><Link to="/admin/curriculum/final-bank">Bank ujian akhir</Link></Button><p className="aapm-text-caption m-0 self-center">APPI membantu isi draf melalui editor modul.</p></div>
            <div className="aapm-toolbar">
              <SearchInput className="max-w-xs" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari chapter atau modul…" aria-label="Cari chapter atau modul di kurikulum" />
              <SegmentedControl label="Tampilan kurikulum" value={view} onChange={setView} options={[{ value: "list", label: "Daftar", icon: "list" }, { value: "board", label: "Board", icon: "widget" }]} />
              <span className="aapm-toolbar__spacer" />
              <span className="aapm-meta" role="status" aria-live="polite">{saving ? <><span className="aapm-spinner" aria-hidden="true" />Menyimpan status modul…</> : "Konten dikelola sebagai draf"}</span>
              {nextLevelNumber ? <Button asChild variant="outline"><Link to={moduleEditorPath(courseId, { newChapter: 1, levelNumber: nextLevelNumber })}><AapmIcon name="add" />Tambah chapter</Link></Button> : <Button variant="outline" disabled title="Maksimal 20 chapter.">Chapter penuh</Button>}
            </div>
            {actionError && <Alert tone="danger" title="Perubahan status belum disimpan" description={actionError.message} action={recovery ? <Button asChild variant="secondary"><Link to={recovery.to}>{recovery.label}</Link></Button> : undefined} />}
            {query.trim() && <div className="flex flex-wrap items-center justify-between gap-2"><p className="aapm-text-caption m-0" role="status">{visibleModuleCount} dari {modules.length} modul.</p><Button variant="ghost" size="sm" onClick={() => setQuery("")}>Hapus pencarian</Button></div>}
            {!levels.length ? <StateView kind="empty" icon="lesson" title="Kurikulum belum memiliki modul" description="Mulai dengan draf modul pertama." action={<Button asChild><Link to={newModulePath}>Tambah modul pertama</Link></Button>} />
              : !visibleLevels.length ? <StateView kind="empty" icon="search" title="Tidak ada modul yang cocok" description="Ubah kata kunci pencarian untuk melihat modul lain." action={<Button variant="secondary" onClick={() => setQuery("")}>Hapus pencarian</Button>} />
                : <CurriculumView levels={visibleLevels} courseId={courseId} board={view === "board"} onAction={selectAction} saving={saving} />}
            <p className="aapm-text-caption m-0">Jumlah perubahan belum terbit termasuk modul terbit atau arsip yang memiliki koreksi draf. Materi wajib pada kebijakan peserta tetap dapat diakses setelah diarsipkan; nilai, progres, dan sertifikat dipertahankan.</p>
          </TabsContent>
          <TabsContent value="overview" className="grid gap-4">
            <KPICluster label="Ringkasan course" columns={3} items={[
              { label: "Struktur", value: `${course.moduleCount} modul`, note: `${levels.length} chapter`, icon: "layers", hue: "green" },
              { label: "Learner dengan progres", value: course.learnerCount, note: "Akun yang sudah memulai", icon: "graduation", hue: "blue" },
              { label: "Konten & bank soal", value: "Draf → Terbit", note: "Validasi di editor modul", icon: "edit", hue: "orange" },
            ]} />
            {course.availabilityNote && <Alert tone="info" title="Catatan ketersediaan" description={course.availabilityNote} />}
          </TabsContent>
          <TabsContent value="learners"><StateView kind="empty" icon="graduation" title="Progress dikelola per peserta"
            description="Progress dan persyaratan akademik mengikuti kebijakan yang ditetapkan untuk setiap peserta."
            action={<Button asChild variant="secondary"><Link to="/admin/learners">Buka daftar peserta<AapmIcon name="arrowRight" /></Link></Button>} /></TabsContent>
        </Tabs>
      </> : null}
      <Dialog open={Boolean(pendingAction) && !confirmed} onOpenChange={(open) => !open && closeAction()}>
        <DialogContent><DialogHeader><DialogTitle>{pendingAction?.action === "archive" ? "Arsipkan modul" : "Pulihkan modul"}</DialogTitle><DialogDescription>{pendingAction?.module.title}. Riwayat dan bukti akademik tetap tersimpan.</DialogDescription></DialogHeader>
          {pendingAction?.action === "archive" ? <>
            <Field id="course-archive-reason" label="Alasan pengarsipan (5–500 karakter)" required><Input id="course-archive-reason" value={reason} maxLength={500} disabled={saving} onChange={(event) => setReason(event.target.value)} /></Field>
            <p className="aapm-text-support">Materi wajib tetap tersedia sesuai kebijakan peserta. Arsip tidak menghapus nilai, progres, sertifikat, atau revisi terbit.</p>
          </> : <p className="aapm-text-support">Modul kembali aktif dengan revisi terakhir yang sudah diterbitkan. Koreksi draf tetap memerlukan validasi dan penerbitan.</p>}
          {actionError && <p role="alert">{actionError.message}</p>}
          <DialogFooter><Button variant="ghost" onClick={closeAction} disabled={saving}>Batal</Button><Button disabled={saving || (pendingAction?.action === "archive" && (reason.trim().length < 5 || reason.trim().length > 500))} onClick={() => setConfirmed(true)}>{pendingAction?.action === "archive" ? "Arsipkan" : "Pulihkan modul"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={confirmed} onOpenChange={(open) => { if (!open && !actionInFlight.current) setConfirmed(false); }}
        title={pendingAction?.action === "archive" ? "Arsipkan modul?" : "Pulihkan modul?"}
        description={pendingAction?.action === "archive" ? `${pendingAction?.module.title}. Alasan: ${reason.trim()}. Riwayat dan bukti akademik tidak dihapus.` : `${pendingAction?.module.title} kembali aktif dengan revisi terakhir yang sudah diterbitkan.`}
        confirmLabel={pendingAction?.action === "archive" ? "Ya, arsipkan" : "Ya, pulihkan"} onConfirm={submitAction} />
    </AdminPageFrame>
  );
}

function ModuleActions({ module, courseId, onAction, saving, className = "" }) {
  const navigate = useNavigate();
  const editor = `/admin/courses/${courseId}/modules/${module.id}`;
  const items = [
    { id: "edit", label: "Edit draf", icon: "edit", onSelect: () => navigate(editor) },
    module.publishedRevisionId && module.lifecycleStatus !== "archived" ? { id: "preview", label: "Pratinjau learner", icon: "eye", onSelect: () => navigate(`/modules/${module.moduleNumber}`) } : null,
    { id: "policy", label: "Kebijakan kurikulum", icon: "roadmap", onSelect: () => navigate("/admin/curriculum/policies") },
    module.lifecycleStatus === "active" && module.publishedRevisionId ? { id: "archive", label: "Arsipkan", icon: "folder", disabled: saving, onSelect: () => onAction(module, "archive") } : null,
    module.lifecycleStatus === "archived" ? { id: "restore", label: "Pulihkan modul", icon: "refresh", disabled: saving, onSelect: () => onAction(module, "restore") } : null,
  ].filter(Boolean);
  return <div className={`aapm-lesson-row__actions ${className}`}><Button asChild size="sm" variant="secondary" data-hide-mobile=""><Link to={editor}><AapmIcon name="edit" />Edit draf</Link></Button><OverflowMenu label={`Aksi untuk ${module.title}`} items={items} /></div>;
}

function ChapterHeader({ level }) {
  const visual = levelVisual(level.levelNumber);
  return <><IconTile icon={visual.icon} hue={visual.hue} size="md" shape="circle" /><div className="min-w-0"><p className="aapm-text-overline m-0">Chapter {level.levelNumber}</p><h3 className="aapm-chapter__title truncate">{level.levelName}</h3></div><Badge hue={visual.hue}>{level.modules.length} modul</Badge></>;
}

function ModuleMetadata({ module }) {
  return <><ModuleLifecycleStatus module={module} />
    {module.publishedTitle && module.publishedTitle !== module.title && <p className="aapm-text-caption m-0">Judul terbit: {module.publishedTitle}</p>}
    {module.lifecycleStatus === "archived" && <p className="aapm-text-caption m-0">Alasan arsip: {module.archiveReason || "—"}</p>}
  </>;
}

function CurriculumView({ levels, courseId, board, onAction, saving }) {
  return <div className={board ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3" : "aapm-curriculum"}>
    {levels.map((level) => <section key={level.levelNumber} className="aapm-chapter self-start" data-hue={levelVisual(level.levelNumber).hue} aria-label={`Chapter ${level.levelNumber}: ${level.levelName}`}>
      <div className="aapm-chapter__head"><ChapterHeader level={level} /></div>
      <ol className={board ? "grid gap-2 p-2" : "aapm-chapter__list"}>
        {level.modules.map((module) => <li key={module.id} className={board ? "aapm-card gap-2 p-3" : "aapm-lesson-row max-sm:!grid-cols-[auto_minmax(0,1fr)]"}>
          {board ? <>
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="aapm-text-overline">Modul {module.moduleNumber}</span><ModuleActions module={module} courseId={courseId} onAction={onAction} saving={saving} /></div>
            <Link to={`/admin/courses/${courseId}/modules/${module.id}`} className="text-body font-medium text-foreground hover:text-primary">{module.title}</Link>
            {module.category && <span className="aapm-meta">{module.category}</span>}<ModuleMetadata module={module} />
          </> : <>
            <span aria-hidden="true" className="max-sm:hidden" /><span className="aapm-lesson-row__index">{module.moduleNumber}</span>
            <div className="grid min-w-0 gap-1 max-sm:col-start-2"><Link to={`/admin/courses/${courseId}/modules/${module.id}`} className="aapm-lesson-row__title">{module.title}</Link><span className="aapm-meta truncate">{module.category || module.summary || "Tanpa kategori"}</span><ModuleMetadata module={module} /></div>
            <span data-hide-mobile="" /><ModuleActions module={module} courseId={courseId} onAction={onAction} saving={saving} className="max-sm:col-start-2 max-sm:row-start-2" />
          </>}
        </li>)}
      </ol>
      <Link className="aapm-chapter__add" to={moduleEditorPath(courseId, { levelNumber: level.levelNumber, levelName: level.levelName })}><AapmIcon name="plus" />Tambah draf modul</Link>
    </section>)}
  </div>;
}
