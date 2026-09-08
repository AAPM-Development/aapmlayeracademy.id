// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { Badge, Button, IconTile, KPICluster, Surface, Tabs, TabsContent, TabsList, TabsTrigger, useToast } from "@/components/primitives";
import AapmIcon from "@/components/icons/AapmIcon";
import { useAdminCourse, useReorderAdminModules } from "@/lib/useAdminData";
import { AdminError, AdminLoading, AdminPageFrame, AdminUnavailable } from "@/components/admin/AdminPage";

const levelBadgeClasses = ["bg-tint-green", "bg-tint-lime", "bg-tint-orange", "bg-surface-inset"];

export default function AdminCourseDetail() {
  const { courseId } = useParams();
  const { data: course, isLoading, error, refetch } = useAdminCourse(courseId);
  const reorderModules = useReorderAdminModules();
  const { toast } = useToast();
  const [view, setView] = useState("board");
  const [boardLevels, setBoardLevels] = useState([]);
  const modules = useMemo(() => (course?.curriculum || []).flatMap((level) => level.modules || []), [course]);

  useEffect(() => {
    if (course?.curriculum) setBoardLevels(course.curriculum.map((level) => ({ ...level, modules: [...(level.modules || [])] })));
  }, [course]);

  const moveModule = async (moduleId, direction) => {
    const currentIndex = modules.findIndex((module) => Number(module.id) === Number(moduleId));
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= modules.length) return;
    const nextModules = [...modules];
    [nextModules[currentIndex], nextModules[nextIndex]] = [nextModules[nextIndex], nextModules[currentIndex]];
    try {
      await reorderModules.mutateAsync(nextModules.map((module) => module.id));
      toast({ title: "Urutan kurikulum disimpan" });
    } catch (reorderError) {
      toast({ variant: "destructive", title: "Urutan belum disimpan", description: reorderError.message });
    }
  };

  const handleDragEnd = async ({ source, destination }) => {
    if (!destination) return;
    if (source.droppableId !== destination.droppableId) {
      toast({ variant: "warning", title: "Level tidak dipindahkan", description: "Ubah level modul lewat editor agar prasyarat dan metadata tetap jelas." });
      return;
    }
    const levelNumber = Number(source.droppableId.replace("level-", ""));
    const currentLevel = boardLevels.find((level) => Number(level.levelNumber) === levelNumber);
    if (!currentLevel || source.index === destination.index) return;
    const moved = [...currentLevel.modules];
    const [item] = moved.splice(source.index, 1);
    moved.splice(destination.index, 0, item);
    const nextLevels = boardLevels.map((level) => Number(level.levelNumber) === levelNumber ? { ...level, modules: moved } : level);
    setBoardLevels(nextLevels);
    try {
      await reorderModules.mutateAsync(nextLevels.flatMap((level) => level.modules || []).map((module) => module.id));
      toast({ title: "Urutan level disimpan" });
    } catch (reorderError) {
      setBoardLevels(course?.curriculum?.map((level) => ({ ...level, modules: [...(level.modules || [])] })) || []);
      toast({ variant: "destructive", title: "Urutan belum disimpan", description: reorderError.message });
    }
  };

  return (
    <AdminPageFrame
      title={course?.title || "Kurikulum Academy"}
      description="Kelola struktur, urutan, dan konten course dari satu workspace yang siap dipakai tim editorial."
      actions={<div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/admin/courses"><AapmIcon name="arrowLeft" className="h-4 w-4" /> Semua course</Link></Button><Button asChild><Link to={`/admin/courses/${courseId}/modules/new`}><AapmIcon name="add" className="h-4 w-4" /> Tambah modul</Link></Button></div>}
    >
      {isLoading ? <AdminLoading label="Memuat struktur kurikulum…" /> : error ? <AdminError error={error} onRetry={refetch} /> : <div className="space-y-5">
        <Surface tone="orange" className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><IconTile icon="course" tone="orange" size="md" /><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">{course.title}</h2><Badge variant="soft" className="bg-background/75 text-tint-orange-foreground">{course.status === "published" ? "Aktif" : "Belum tersedia"}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{course.moduleCount} modul · {course.learnerCount} learner dengan progres</p></div></div><span className="inline-flex items-center gap-2 text-xs font-medium text-tint-orange-foreground"><AapmIcon name="checkRead" className="h-4 w-4" /> Perubahan tersimpan langsung</span></Surface>
        <Tabs defaultValue="general">
          <TabsList className="aapm-scrollbar w-full justify-start overflow-x-auto"><TabsTrigger value="general">Ringkasan</TabsTrigger><TabsTrigger value="curriculum">Kurikulum</TabsTrigger><TabsTrigger value="learners">Learner</TabsTrigger></TabsList>
          <TabsContent value="general" className="mt-4"><Surface className="p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brand-orange">Ruang kerja course</div><h2 className="mt-1 text-xl font-semibold">Kurikulum aktif</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{course.availabilityNote}</p></div><Badge variant="soft" className="bg-tint-green text-tint-green-foreground"><AapmIcon name="checkRead" /> Sumber aktif</Badge></div><KPICluster className="mt-6 aapm-course-kpi" label="Ringkasan course" columns={3} variant="cards" items={[{ label: "Struktur", value: `${course.moduleCount} modul`, note: "Kurikulum aktif", icon: "book", tone: "success", colorway: 1, emphasis: "solid" }, { label: "Konten & bank soal", value: "Dapat diedit", note: "Workspace editorial", icon: "edit", tone: "warning", colorway: 3, emphasis: "solid" }, { label: "Urutan tampil", value: "Board + list", note: "Reorder terkontrol", icon: "sort", tone: "info", colorway: 2, emphasis: "solid" }]} /></Surface></TabsContent>
          <TabsContent value="curriculum" className="mt-4">
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brand-orange">Editorial board</div>
                  <h2 className="mt-1 text-xl font-semibold">Susun ritme kurikulum</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Tarik modul dalam level yang sama. Untuk pindah level, buka editor modul.</p>
                </div>
                <div className="inline-flex w-full rounded-xl border border-border bg-surface-subtle p-1 sm:w-auto">
                  <button type="button" onClick={() => setView("board")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold sm:flex-none ${view === "board" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}><AapmIcon name="reorder" /> Board</button>
                  <button type="button" onClick={() => setView("list")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold sm:flex-none ${view === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}><AapmIcon name="modules" /> List</button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-orange/20 bg-brand-orange/5 p-2.5 xl:hidden">
                <Button asChild size="sm" className="h-8 bg-brand-orange text-white hover:bg-brand-orange/90"><Link to={`/admin/courses/${courseId}/modules/new`}><AapmIcon name="add" className="h-3.5 w-3.5" /> Tambah modul</Link></Button>
                <span className="text-[11px] leading-4 text-muted-foreground">Aksi utama tetap terlihat saat daftar modul panjang.</span>
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_15rem]">
                <div className="min-w-0">
                  {view === "board" ? <CurriculumBoard levels={boardLevels} courseId={courseId} onDragEnd={handleDragEnd} saving={reorderModules.isPending} /> : <CurriculumList levels={course.curriculum || []} modules={modules} courseId={courseId} moveModule={moveModule} saving={reorderModules.isPending} />}
                </div>
                <aside className="hidden xl:block">
                  <Surface className="sticky top-5 p-2.5">
                    <div className="flex items-center justify-between gap-2 px-1">
                      <div className="flex min-w-0 items-center gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-tint-orange text-brand-orange" aria-hidden="true"><AapmIcon name="add" className="h-3.5 w-3.5" /></span><h3 className="truncate text-xs font-semibold">Aksi cepat</h3></div>
                      <Badge variant="soft" className="bg-tint-orange text-tint-orange-foreground">{modules.length} modul</Badge>
                    </div>
                    <Button asChild size="sm" className="mt-2 h-8 w-full bg-brand-orange text-white hover:bg-brand-orange/90"><Link to={`/admin/courses/${courseId}/modules/new`}><AapmIcon name="add" className="h-3.5 w-3.5" /> Tambah modul</Link></Button>
                    <div className="mt-2 rounded-lg bg-surface-subtle px-2 py-1.5 text-[9px] leading-3 text-muted-foreground">Tetap terlihat saat Anda meninjau urutan.</div>
                  </Surface>
                </aside>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="learners" className="mt-4"><AdminUnavailable title="Enrollment per course belum digunakan" description="Progress tiap learner tetap aman dan dapat dilihat dari menu User management. Academy saat ini memakai satu kurikulum aktif." /></TabsContent>
        </Tabs>
      </div>}
    </AdminPageFrame>
  );
}

function CurriculumBoard({ levels = [], courseId, onDragEnd, saving }) {
  return <DragDropContext onDragEnd={onDragEnd}><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{levels.map((level, index) => <Droppable key={level.levelNumber} droppableId={`level-${level.levelNumber}`}>{({ innerRef, droppableProps, placeholder }) => <section ref={innerRef} {...droppableProps} className="min-h-[19rem] rounded-[var(--card-radius)] border border-border bg-surface-subtle p-3"><div className="mb-3 flex items-start justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${levelBadgeClasses[index % levelBadgeClasses.length]} text-xs font-bold text-foreground`}>{level.levelNumber}</span><div className="min-w-0"><h3 className="truncate text-sm font-semibold">{level.levelName}</h3><p className="text-[11px] text-muted-foreground">{level.modules?.length || 0} modul</p></div></div>{saving && <AapmIcon name="refresh" className="h-3.5 w-3.5 animate-spin text-brand-orange" />}</div><div className="space-y-2">{(level.modules || []).map((module, moduleIndex) => <Draggable key={String(module.id)} draggableId={String(module.id)} index={moduleIndex}>{({ innerRef: itemRef, draggableProps, dragHandleProps }) => <article ref={itemRef} {...draggableProps} className="group rounded-xl border border-border bg-background p-3 shadow-sm transition-colors hover:border-brand-orange/40"><div className="flex items-start gap-2"><button type="button" className="mt-0.5 cursor-grab text-muted-foreground/55 hover:text-foreground" {...dragHandleProps} aria-label={`Geser ${module.title}`}><AapmIcon name="reorder" className="h-4 w-4" /></button><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-orange">Modul {module.moduleNumber}</span><Link to={`/admin/courses/${courseId}/modules/${module.id}`} className="text-muted-foreground opacity-70 hover:text-brand-green group-hover:opacity-100" aria-label={`Edit ${module.title}`}><AapmIcon name="edit" className="h-3.5 w-3.5" /></Link></div><h4 className="mt-1 line-clamp-2 text-xs font-semibold leading-5">{module.title}</h4><p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{module.category || module.summary}</p></div></div></article>}</Draggable>)}{placeholder}</div></section>}</Droppable>)}</div></DragDropContext>;
}

function CurriculumList({ levels = [], modules = [], courseId, moveModule, saving }) {
  return <div className="space-y-3">{levels.map((level) => <Surface key={level.levelNumber} className="overflow-hidden p-0"><div className="flex items-center gap-3 border-b border-[hsl(var(--surface-border))] bg-surface-subtle px-5 py-4"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-green text-xs font-bold text-white">{level.levelNumber}</div><div><h2 className="text-sm font-semibold">{level.levelName}</h2><p className="mt-0.5 text-xs text-muted-foreground">{level.modules.length} modul</p></div></div><div className="divide-y divide-[hsl(var(--surface-border))]">{level.modules.map((module) => { const moduleIndex = modules.findIndex((item) => Number(item.id) === Number(module.id)); return <div key={module.id} className="flex items-center gap-3 px-4 py-3 sm:px-5"><AapmIcon name="reorder" className="hidden h-4 w-4 text-muted-foreground/50 sm:block" /><span className="w-7 shrink-0 text-xs font-semibold text-muted-foreground">{module.moduleNumber}</span><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{module.title}</div><div className="mt-0.5 truncate text-xs text-muted-foreground">{module.category || module.summary}</div></div><div className="flex shrink-0 items-center gap-1"><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => moveModule(module.id, -1)} disabled={moduleIndex === 0 || saving} aria-label={`Naikkan urutan ${module.title}`}><AapmIcon name="arrowLeft" className="h-3.5 w-3.5 -rotate-90" /></Button><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => moveModule(module.id, 1)} disabled={moduleIndex === modules.length - 1 || saving} aria-label={`Turunkan urutan ${module.title}`}><AapmIcon name="arrowRight" className="h-3.5 w-3.5 rotate-90" /></Button><Button asChild size="sm" variant="outline"><Link to={`/admin/courses/${courseId}/modules/${module.id}`}><AapmIcon name="edit" className="h-3.5 w-3.5" /><span className="hidden sm:inline">Edit</span></Link></Button></div></div>; })}</div></Surface>)}</div>;
}
