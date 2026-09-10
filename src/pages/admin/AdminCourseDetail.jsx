// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { Badge, Button, ConfirmDialog, IconTile, KPICluster, Surface, Tabs, TabsContent, TabsList, TabsTrigger, useToast } from "@/components/primitives";
import AapmIcon from "@/components/icons/AapmIcon";
import AdminModuleCompanion from "@/components/admin/AdminModuleCompanion";
import { useAdminCourse, useDeleteAdminModule, useReorderAdminModules } from "@/lib/useAdminData";
import { AdminError, AdminLoading, AdminPageFrame, AdminUnavailable } from "@/components/admin/AdminPage";

const levelBadgeClasses = ["bg-tint-green", "bg-tint-lime", "bg-tint-orange", "bg-surface-inset"];

const cloneLevels = (levels = []) => levels.map((level) => ({
  ...level,
  modules: [...(level.modules || [])],
}));

const moduleEditorPath = (courseId, params = {}) => {
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => [key, String(value)]),
  ).toString();
  return `/admin/courses/${courseId}/modules/new${query ? `?${query}` : ""}`;
};

export default function AdminCourseDetail() {
  const { courseId } = useParams();
  const { data: course, isLoading, error, refetch } = useAdminCourse(courseId);
  const reorderModules = useReorderAdminModules();
  const deleteModule = useDeleteAdminModule();
  const { toast } = useToast();
  const [view, setView] = useState("list");
  const [boardLevels, setBoardLevels] = useState([]);
  const [pendingModuleDelete, setPendingModuleDelete] = useState(null);
  const [pendingModuleDeleteWithProgress, setPendingModuleDeleteWithProgress] = useState(null);
  const modules = useMemo(() => (course?.curriculum || []).flatMap((level) => level.modules || []), [course]);
  const nextLevelNumber = useMemo(() => {
    const highest = Math.max(0, ...(course?.curriculum || []).map((level) => Number(level.levelNumber) || 0));
    return highest < 20 ? highest + 1 : null;
  }, [course]);
  const newModulePath = moduleEditorPath(courseId);
  const newChapterPath = nextLevelNumber
    ? moduleEditorPath(courseId, { newChapter: 1, levelNumber: nextLevelNumber })
    : null;
  const addChapterAction = (className = "") => nextLevelNumber ? (
    <Button asChild variant="outline" className={className}><Link to={newChapterPath}><AapmIcon name="add" className="h-4 w-4" /> Tambah chapter</Link></Button>
  ) : (
    <Button type="button" variant="outline" className={className} disabled title="Maksimal 20 chapter."><AapmIcon name="add" className="h-4 w-4" /> Chapter penuh</Button>
  );

  useEffect(() => {
    if (course?.curriculum && !reorderModules.isPending) setBoardLevels(cloneLevels(course.curriculum));
  }, [course]);

  const persistOrder = async (nextLevels, previousLevels, title = "Urutan kurikulum disimpan") => {
    if (reorderModules.isPending) return;
    setBoardLevels(nextLevels);
    try {
      await reorderModules.mutateAsync(nextLevels.flatMap((level) => level.modules || []).map((module) => module.id));
      toast({ title });
    } catch (reorderError) {
      setBoardLevels(previousLevels);
      toast({ variant: "destructive", title: "Urutan belum disimpan", description: reorderError.message });
    }
  };

  const moveModule = async (moduleId, direction, levelNumber) => {
    if (reorderModules.isPending) return;
    const sourceLevel = boardLevels.find((level) => Number(level.levelNumber) === Number(levelNumber));
    if (!sourceLevel) return;
    const currentIndex = (sourceLevel.modules || []).findIndex((module) => Number(module.id) === Number(moduleId));
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= sourceLevel.modules.length) return;
    const previousLevels = cloneLevels(boardLevels);
    const moved = [...sourceLevel.modules];
    [moved[currentIndex], moved[nextIndex]] = [moved[nextIndex], moved[currentIndex]];
    const nextLevels = boardLevels.map((level) => Number(level.levelNumber) === Number(levelNumber) ? { ...level, modules: moved } : level);
    await persistOrder(nextLevels, previousLevels, "Urutan chapter disimpan");
  };

  const handleDragEnd = async ({ source, destination }) => {
    if (!destination || reorderModules.isPending) return;
    if (source.droppableId !== destination.droppableId) {
      toast({ variant: "warning", title: "Chapter tidak dipindahkan", description: "Ubah chapter modul lewat editor agar nama dan metadata tetap jelas." });
      return;
    }
    const levelNumber = Number(source.droppableId.replace("level-", ""));
    const currentLevel = boardLevels.find((level) => Number(level.levelNumber) === levelNumber);
    if (!currentLevel || source.index === destination.index) return;
    const previousLevels = cloneLevels(boardLevels);
    const moved = [...currentLevel.modules];
    const [item] = moved.splice(source.index, 1);
    moved.splice(destination.index, 0, item);
    const nextLevels = boardLevels.map((level) => Number(level.levelNumber) === levelNumber ? { ...level, modules: moved } : level);
    await persistOrder(nextLevels, previousLevels, "Urutan chapter disimpan");
  };

  const removeModule = async (module, { purgeProgress = false } = {}) => {
    if (!module || deleteModule.isPending) return;
    try {
      const result = await deleteModule.mutateAsync({ moduleId: module.id, purgeProgress });
      toast({
        title: "Modul dihapus",
        description: result?.deletedProgressEntries
          ? `Progress learner yang ikut dihapus: ${result.deletedProgressEntries}.`
          : "Chapter akan hilang otomatis jika ini modul terakhir di dalamnya.",
      });
    } catch (deleteError) {
      if (!purgeProgress && deleteError?.code === "module_has_progress") {
        setPendingModuleDeleteWithProgress(module);
        return;
      }
      toast({ variant: "destructive", title: "Modul belum dihapus", description: deleteError.message });
    }
  };

  const applyCompanionOrder = async (ids) => {
    if (!Array.isArray(ids) || reorderModules.isPending) return;
    const previousLevels = cloneLevels(boardLevels);
    const byId = new Map(boardLevels.flatMap((level) => level.modules || []).map((module) => [String(module.id), module]));
    const orderedModules = ids.map((id) => byId.get(String(id))).filter(Boolean);
    if (orderedModules.length !== byId.size) {
      toast({ variant: "destructive", title: "Urutan APPI tidak lengkap", description: "Semua modul aktif harus tetap ada sebelum urutan disimpan." });
      return;
    }
    // The API stores one global sort_order. Keep each chapter's visual grouping
    // intact while following the proposed global sequence within that chapter.
    const rank = new Map(orderedModules.map((module, index) => [String(module.id), index]));
    const nextLevels = boardLevels.map((level) => ({
      ...level,
      modules: [...(level.modules || [])].sort((left, right) => (rank.get(String(left.id)) ?? 0) - (rank.get(String(right.id)) ?? 0)),
    }));
    await persistOrder(nextLevels, previousLevels, "Urutan APPI disimpan");
  };

  return (
    <AdminPageFrame
      title={course?.title || "Kurikulum Academy"}
      description="Kelola struktur, urutan, dan konten course dari satu workspace yang siap dipakai tim editorial."
      actions={<div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/admin/courses"><AapmIcon name="arrowLeft" className="h-4 w-4" /> Semua course</Link></Button>{addChapterAction()}<Button asChild><Link to={newModulePath}><AapmIcon name="add" className="h-4 w-4" /> Tambah modul</Link></Button></div>}
    >
      {isLoading ? <AdminLoading label="Memuat struktur kurikulum…" /> : error ? <AdminError error={error} onRetry={refetch} /> : <div className="space-y-5">
        <Surface tone="orange" className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><IconTile icon="course" tone="orange" size="md" /><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">{course.title}</h2><Badge variant="soft" className="bg-background/75 text-tint-orange-foreground">{course.status === "published" ? "Aktif" : "Belum tersedia"}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{course.moduleCount} modul · {course.learnerCount} learner dengan progres</p></div></div><span className="inline-flex items-center gap-2 text-xs font-medium text-tint-orange-foreground"><AapmIcon name="checkRead" className="h-4 w-4" /> Perubahan tersimpan langsung</span></Surface>
        <Tabs defaultValue="general">
          <TabsList className="aapm-scrollbar w-full justify-start overflow-x-auto"><TabsTrigger value="general">Ringkasan</TabsTrigger><TabsTrigger value="curriculum">Kurikulum</TabsTrigger><TabsTrigger value="learners">Learner</TabsTrigger></TabsList>
          <TabsContent value="general" className="mt-4"><Surface className="p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brand-orange">Ruang kerja course</div><h2 className="mt-1 text-xl font-semibold">Kurikulum aktif</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{course.availabilityNote}</p></div><Badge variant="soft" className="bg-tint-green text-tint-green-foreground"><AapmIcon name="checkRead" /> Sumber aktif</Badge></div><KPICluster className="mt-6 aapm-course-kpi" label="Ringkasan course" columns={3} variant="cards" items={[{ label: "Struktur", value: `${course.moduleCount} modul`, note: "Kurikulum aktif", icon: "book", tone: "success", colorway: 1, emphasis: "solid" }, { label: "Konten & bank soal", value: "Dapat diedit", note: "Workspace editorial", icon: "edit", tone: "warning", colorway: 3, emphasis: "solid" }, { label: "Urutan tampil", value: "List utama", note: "Board opsional", icon: "sort", tone: "info", colorway: 2, emphasis: "solid" }]} /></Surface></TabsContent>
          <TabsContent value="curriculum" className="mt-4">
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brand-orange">Editorial board</div>
                  <h2 className="mt-1 text-xl font-semibold">Susun ritme kurikulum</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Susun modul di dalam chapter. Pindah chapter dilakukan dari editor agar nama dan metadata ikut berubah.</p>
                </div>
                <div className="inline-flex w-full rounded-xl border border-border bg-surface-subtle p-1 sm:w-auto">
                  <button type="button" onClick={() => setView("board")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold sm:flex-none ${view === "board" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}><AapmIcon name="reorder" /> Board</button>
                  <button type="button" onClick={() => setView("list")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold sm:flex-none ${view === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}><AapmIcon name="modules" /> List</button>
                </div>
              </div>

              <AdminModuleCompanion
                scope="course"
                module={{ title: course.title, summary: course.availabilityNote }}
                modules={modules}
                onApplyOrder={applyCompanionOrder}
              />

              <div className="flex flex-wrap items-center gap-2 border-y border-border/70 py-2 text-xs text-muted-foreground xl:hidden">
                {nextLevelNumber ? <Button asChild size="sm" variant="outline" className="h-8"><Link to={newChapterPath}><AapmIcon name="add" className="h-3.5 w-3.5" /> Chapter baru</Link></Button> : <Button type="button" size="sm" variant="outline" className="h-8" disabled title="Maksimal 20 chapter."><AapmIcon name="add" className="h-3.5 w-3.5" /> Chapter penuh</Button>}
                <Button asChild size="sm" className="h-8"><Link to={newModulePath}><AapmIcon name="add" className="h-3.5 w-3.5" /> Modul baru</Link></Button>
                <span>Chapter dibuat saat modul pertamanya disimpan.</span>
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_15rem]">
                <div className="min-w-0">
                  {view === "board" ? <CurriculumBoard levels={boardLevels} courseId={courseId} onDragEnd={handleDragEnd} onDelete={setPendingModuleDelete} saving={reorderModules.isPending || deleteModule.isPending} /> : <CurriculumList levels={boardLevels} courseId={courseId} moveModule={moveModule} onDelete={setPendingModuleDelete} saving={reorderModules.isPending || deleteModule.isPending} />}
                </div>
                <aside className="hidden xl:block">
                  <Surface className="sticky top-5 p-2.5">
                    <div className="flex items-center justify-between gap-2 px-1">
                      <div className="flex min-w-0 items-center gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-tint-orange text-brand-orange" aria-hidden="true"><AapmIcon name="add" className="h-3.5 w-3.5" /></span><h3 className="truncate text-xs font-semibold">Aksi cepat</h3></div>
                      <Badge variant="soft" className="bg-tint-orange text-tint-orange-foreground">{modules.length} modul</Badge>
                    </div>
                    <Button asChild size="sm" className="mt-2 h-8 w-full"><Link to={newModulePath}><AapmIcon name="add" className="h-3.5 w-3.5" /> Tambah modul</Link></Button>
                    {nextLevelNumber ? <Button asChild size="sm" variant="outline" className="mt-1 h-8 w-full"><Link to={newChapterPath}><AapmIcon name="add" className="h-3.5 w-3.5" /> Tambah chapter</Link></Button> : <Button type="button" size="sm" variant="outline" className="mt-1 h-8 w-full" disabled title="Maksimal 20 chapter."><AapmIcon name="add" className="h-3.5 w-3.5" /> Chapter penuh</Button>}
                    <div className="mt-2 px-1 text-[10px] leading-4 text-muted-foreground">Chapter adalah level yang memiliki satu atau lebih modul.</div>
                  </Surface>
                </aside>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="learners" className="mt-4"><AdminUnavailable title="Enrollment per course belum digunakan" description="Progress tiap learner tetap aman dan dapat dilihat dari menu User management. Academy saat ini memakai satu kurikulum aktif." /></TabsContent>
        </Tabs>
      </div>}
      <ConfirmDialog
        open={Boolean(pendingModuleDelete)}
        onOpenChange={(open) => !open && setPendingModuleDelete(null)}
        title="Hapus modul?"
        description={`Modul ${pendingModuleDelete?.moduleNumber ? `ke-${pendingModuleDelete.moduleNumber} ` : ""}${pendingModuleDelete?.title || "ini"} dan bank soalnya akan dihapus. Jika modul memiliki progres learner, sistem akan meminta konfirmasi tambahan.`}
        confirmLabel="Hapus modul"
        icon="solar:trash-bin-trash-bold"
        destructive
        onConfirm={() => {
          const module = pendingModuleDelete;
          setPendingModuleDelete(null);
          if (module) removeModule(module);
        }}
      />
      <ConfirmDialog
        open={Boolean(pendingModuleDeleteWithProgress)}
        onOpenChange={(open) => !open && setPendingModuleDeleteWithProgress(null)}
        title="Hapus modul beserta progres learner?"
        description={`Modul ${pendingModuleDeleteWithProgress?.title || "ini"}, bank soal, dan seluruh progres learner akan dihapus permanen. Chapter akan tetap ada jika masih memiliki modul lain.`}
        confirmLabel="Hapus bersama progres"
        icon="solar:trash-bin-trash-bold"
        destructive
        onConfirm={() => {
          const module = pendingModuleDeleteWithProgress;
          setPendingModuleDeleteWithProgress(null);
          if (module) removeModule(module, { purgeProgress: true });
        }}
      />
    </AdminPageFrame>
  );
}

function CurriculumBoard({ levels = [], courseId, onDragEnd, onDelete, saving }) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {levels.map((level, index) => (
          <Droppable key={level.levelNumber} droppableId={`level-${level.levelNumber}`} isDropDisabled={saving}>
            {({ innerRef, droppableProps, placeholder }) => (
              <section ref={innerRef} {...droppableProps} className="min-h-0 rounded-[var(--radius-control)] border border-border/70 bg-surface-subtle/40 p-2.5">
                <div className="mb-2 flex items-start justify-between gap-2 border-b border-border/70 px-1 pb-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${levelBadgeClasses[index % levelBadgeClasses.length]} text-[11px] font-bold text-foreground`}>{level.levelNumber}</span>
                    <div className="min-w-0">
                      <h3 className="truncate text-xs font-semibold">{level.levelName}</h3>
                      <p className="text-[10px] text-muted-foreground">{level.modules?.length || 0} modul</p>
                    </div>
                  </div>
                  {saving && <AapmIcon name="refresh" className="h-3.5 w-3.5 animate-spin text-brand-orange" aria-label="Menyimpan urutan" />}
                </div>
                <div className="mb-2 space-y-0.5">
                  {(level.modules || []).map((module, moduleIndex) => (
                    <Draggable key={String(module.id)} draggableId={String(module.id)} index={moduleIndex} isDragDisabled={saving}>
                      {({ innerRef: itemRef, draggableProps, dragHandleProps }) => (
                        <article ref={itemRef} {...draggableProps} className="group border-b border-border/60 px-1 py-2.5 last:border-b-0">
                          <div className="flex items-start gap-1.5">
                            <button type="button" className="mt-0.5 cursor-grab rounded text-muted-foreground/55 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" {...dragHandleProps} aria-label={`Geser ${module.title}`}>
                              <AapmIcon name="reorder" className="h-3.5 w-3.5" />
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-orange">Modul {module.moduleNumber}</span>
                                <div className="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
                                  <Link to={`/admin/courses/${courseId}/modules/${module.id}`} className="rounded p-0.5 text-muted-foreground hover:text-brand-green" aria-label={`Edit ${module.title}`}><AapmIcon name="edit" className="h-3.5 w-3.5" /></Link>
                                  <button type="button" className="rounded p-0.5 text-muted-foreground hover:text-danger" onClick={() => onDelete?.(module)} aria-label={`Hapus ${module.title}`}><AapmIcon name="delete" className="h-3.5 w-3.5" /></button>
                                </div>
                              </div>
                              <h4 className="mt-1 line-clamp-2 text-xs font-semibold leading-4">{module.title}</h4>
                              {(module.category || module.summary) && <p className="mt-1 line-clamp-1 text-[10px] leading-4 text-muted-foreground">{module.category || module.summary}</p>}
                            </div>
                          </div>
                        </article>
                      )}
                    </Draggable>
                  ))}
                  {placeholder}
                </div>
                <Button asChild size="sm" variant="ghost" className="h-7 w-full justify-start px-1 text-[10px] text-muted-foreground hover:text-brand-orange">
                  <Link to={moduleEditorPath(courseId, { levelNumber: level.levelNumber, levelName: level.levelName })}><AapmIcon name="add" className="h-3 w-3" /> Tambah modul di chapter</Link>
                </Button>
              </section>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
}

function CurriculumList({ levels = [], courseId, moveModule, onDelete, saving }) {
  return (
    <div className="space-y-3">
      {levels.map((level) => (
        <section key={level.levelNumber} className="overflow-hidden rounded-[var(--radius-control)] border border-border/70 bg-background">
          <div className="flex items-center gap-3 border-b border-border/70 bg-surface-subtle/50 px-4 py-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-green text-[11px] font-bold text-white">{level.levelNumber}</div>
            <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold">{level.levelName}</h2><p className="mt-0.5 text-[11px] text-muted-foreground">{level.modules.length} modul</p></div>
            <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-[11px]"><Link to={moduleEditorPath(courseId, { levelNumber: level.levelNumber, levelName: level.levelName })}><AapmIcon name="add" className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Tambah</span></Link></Button>
          </div>
          <div className="divide-y divide-border/70">
            {level.modules.map((module, moduleIndex) => (
              <div key={module.id} className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
                <AapmIcon name="reorder" className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground/50 sm:block" />
                <span className="w-7 shrink-0 text-[11px] font-semibold text-muted-foreground">{module.moduleNumber}</span>
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{module.title}</div><div className="mt-0.5 truncate text-[11px] text-muted-foreground">{module.category || module.summary}</div></div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveModule(module.id, -1, level.levelNumber)} disabled={moduleIndex === 0 || saving} aria-label={`Naikkan urutan ${module.title}`} title="Naikkan satu posisi"><AapmIcon name="chevronUp" className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveModule(module.id, 1, level.levelNumber)} disabled={moduleIndex === level.modules.length - 1 || saving} aria-label={`Turunkan urutan ${module.title}`} title="Turunkan satu posisi"><AapmIcon name="chevronDown" className="h-3.5 w-3.5" /></Button>
                  <Link to={`/admin/courses/${courseId}/modules/${module.id}`} className="rounded p-1.5 text-muted-foreground hover:text-brand-green" aria-label={`Edit ${module.title}`}><AapmIcon name="edit" className="h-3.5 w-3.5" /></Link>
                  <button type="button" className="rounded p-1.5 text-muted-foreground hover:text-danger" onClick={() => onDelete?.(module)} aria-label={`Hapus ${module.title}`}><AapmIcon name="delete" className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
