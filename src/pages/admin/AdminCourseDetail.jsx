// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  IconTile,
  KPICluster,
  OverflowMenu,
  SearchInput,
  SegmentedControl,
  StateView,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from "@/design-system";
import AapmIcon from "@/components/icons/AapmIcon";
import AdminModuleCompanion from "@/components/admin/AdminModuleCompanion";
import { ModuleCover } from "@/components/academy/CourseElements";
import { useAdminCourse, useDeleteAdminModule, useReorderAdminModules } from "@/lib/useAdminData";
import { levelVisual } from "@/lib/academyVisuals";
import { AdminError, AdminLoading, AdminPageFrame } from "@/components/admin/AdminPage";

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
  const [query, setQuery] = useState("");
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


  const chapterCount = boardLevels.length;
  const normalizedQuery = query.trim().toLowerCase();
  const visibleLevels = normalizedQuery
    ? boardLevels
      .map((level) => ({ ...level, modules: (level.modules || []).filter((module) => [module.title, module.category, module.summary].some((value) => String(value || "").toLowerCase().includes(normalizedQuery))) }))
      .filter((level) => level.modules.length)
    : boardLevels;
  const saving = reorderModules.isPending || deleteModule.isPending;

  return (
    <AdminPageFrame
      back={{ to: "/admin/courses", label: "Semua course" }}
      title="Kurikulum"
      description="Susun chapter dan modul, kelola konten, lalu pratinjau seperti yang dilihat learner."
      actions={(
        <>
          <Button asChild variant="secondary"><Link to="/modules"><AapmIcon name="eye" />Pratinjau learner</Link></Button>
          <Button asChild><Link to={newModulePath}><AapmIcon name="add" />Tambah modul</Link></Button>
        </>
      )}
    >
      {isLoading ? <AdminLoading label="Memuat struktur kurikulum…" /> : error ? <AdminError error={error} onRetry={refetch} /> : (
        <>
          <section className="aapm-card aapm-course-summary" aria-label="Ringkasan course">
            <ModuleCover level={1} number={course.moduleCount} />
            <div className="grid min-w-0 flex-1 gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="aapm-text-section m-0">{course.title}</h2>
                <Badge tone={course.status === "published" ? "success" : "warning"} dot>{course.status === "published" ? "Aktif" : "Belum tersedia"}</Badge>
              </div>
              <p className="aapm-text-support m-0">Perubahan urutan dan konten langsung tampil di sisi learner.</p>
            </div>
            <dl className="grid grid-cols-3 gap-6 text-right max-sm:w-full max-sm:text-left">
              <div><dt className="aapm-text-caption">Chapter</dt><dd className="aapm-text-section m-0 aapm-numeric">{chapterCount}</dd></div>
              <div><dt className="aapm-text-caption">Modul</dt><dd className="aapm-text-section m-0 aapm-numeric">{course.moduleCount}</dd></div>
              <div><dt className="aapm-text-caption">Learner aktif</dt><dd className="aapm-text-section m-0 aapm-numeric">{course.learnerCount}</dd></div>
            </dl>
          </section>

          <Tabs defaultValue="curriculum" className="grid gap-5">
            <TabsList variant="underline">
              <TabsTrigger value="curriculum" icon="roadmap">Kurikulum</TabsTrigger>
              <TabsTrigger value="overview" icon="analytics">Ringkasan</TabsTrigger>
              <TabsTrigger value="learners" icon="graduation">Peserta</TabsTrigger>
            </TabsList>

            <TabsContent value="curriculum" className="grid gap-4">
              <div className="aapm-toolbar">
                <SearchInput className="max-w-xs" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari modul…" aria-label="Cari modul di kurikulum" />
                <SegmentedControl
                  label="Tampilan kurikulum"
                  value={view}
                  onChange={setView}
                  options={[{ value: "list", label: "Daftar", icon: "list" }, { value: "board", label: "Board", icon: "widget" }]}
                />
                <span className="aapm-toolbar__spacer" />
                {saving ? <span className="aapm-meta"><span className="aapm-spinner" aria-hidden="true" />Menyimpan urutan…</span> : <span className="aapm-meta"><AapmIcon name="check" />Tersimpan otomatis</span>}
                {addChapterAction()}
              </div>

              <AdminModuleCompanion
                scope="course"
                module={{ title: course.title, summary: course.availabilityNote }}
                modules={modules}
                onApplyOrder={applyCompanionOrder}
              />

              {visibleLevels.length === 0 ? (
                <StateView kind="empty" icon="search" title="Tidak ada modul yang cocok" description="Ubah kata kunci pencarian untuk melihat modul lain." action={<Button variant="secondary" onClick={() => setQuery("")}>Hapus pencarian</Button>} />
              ) : view === "board" ? (
                <CurriculumBoard levels={visibleLevels} courseId={courseId} onDragEnd={handleDragEnd} onDelete={setPendingModuleDelete} saving={saving} dragDisabled={Boolean(normalizedQuery)} />
              ) : (
                <CurriculumList levels={visibleLevels} courseId={courseId} onDragEnd={handleDragEnd} moveModule={moveModule} onDelete={setPendingModuleDelete} saving={saving} dragDisabled={Boolean(normalizedQuery)} />
              )}
              <p className="aapm-text-caption m-0">Seret <AapmIcon name="grip" /> untuk mengubah urutan di dalam chapter. Pindah chapter dilakukan dari editor modul agar nama dan metadata ikut berubah.</p>
            </TabsContent>

            <TabsContent value="overview" className="grid gap-4">
              <KPICluster
                label="Ringkasan course"
                columns={3}
                items={[
                  { label: "Struktur", value: `${course.moduleCount} modul`, note: `${chapterCount} chapter aktif`, icon: "layers", hue: "green" },
                  { label: "Learner dengan progres", value: course.learnerCount, note: "Akun yang sudah memulai", icon: "graduation", hue: "blue" },
                  { label: "Konten & bank soal", value: "Dapat diedit", note: "Lewat editor modul", icon: "edit", hue: "orange" },
                ]}
              />
              {course.availabilityNote ? <Alert tone="info" title="Catatan ketersediaan" description={course.availabilityNote} /> : null}
            </TabsContent>

            <TabsContent value="learners">
              <StateView
                kind="empty"
                icon="graduation"
                title="Progress dikelola per peserta"
                description="Academy memakai satu kurikulum aktif, jadi progress setiap learner dapat dilihat dari menu Peserta."
                action={<Button asChild variant="secondary"><Link to="/admin/learners">Buka daftar peserta<AapmIcon name="arrowRight" /></Link></Button>}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
      <ConfirmDialog
        open={Boolean(pendingModuleDelete)}
        onOpenChange={(open) => !open && setPendingModuleDelete(null)}
        title="Hapus modul?"
        description={`Modul ${pendingModuleDelete?.moduleNumber ? `ke-${pendingModuleDelete.moduleNumber} ` : ""}${pendingModuleDelete?.title || "ini"} dan bank soalnya akan dihapus. Jika modul memiliki progres learner, sistem akan meminta konfirmasi tambahan.`}
        confirmLabel="Hapus modul"
        icon="delete"
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
        icon="delete"
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

function ChapterHeader({ level }) {
  const visual = levelVisual(level.levelNumber);
  return (
    <>
      <IconTile icon={visual.icon} hue={visual.hue} size="md" shape="circle" />
      <div className="min-w-0">
        <p className="aapm-text-overline m-0">Chapter {level.levelNumber}</p>
        <h3 className="aapm-chapter__title truncate">{level.levelName}</h3>
      </div>
      <Badge hue={visual.hue}>{level.modules?.length || 0} modul</Badge>
    </>
  );
}

function ModuleActions({ module, courseId, onDelete, onMove, index, total, saving }) {
  const navigate = useNavigate();
  return (
    <div className="aapm-lesson-row__actions">
      <Button asChild size="sm" variant="secondary" data-hide-mobile="">
        <Link to={`/admin/courses/${courseId}/modules/${module.id}`}><AapmIcon name="edit" />Edit</Link>
      </Button>
      <OverflowMenu
        label={`Aksi untuk ${module.title}`}
        items={[
          { id: "edit", label: "Edit modul", icon: "edit", onSelect: () => navigate(`/admin/courses/${courseId}/modules/${module.id}`) },
          { id: "preview", label: "Pratinjau learner", icon: "eye", onSelect: () => navigate(`/modules/${module.moduleNumber}`) },
          onMove ? { id: "up", label: "Naikkan urutan", icon: "arrowUp", disabled: index === 0 || saving, onSelect: () => onMove(-1) } : null,
          onMove ? { id: "down", label: "Turunkan urutan", icon: "arrowDown", disabled: index === total - 1 || saving, onSelect: () => onMove(1) } : null,
          { id: "delete", label: "Hapus modul", icon: "delete", tone: "danger", disabled: saving, onSelect: () => onDelete?.(module) },
        ]}
      />
    </div>
  );
}

function CurriculumList({ levels = [], courseId, onDragEnd, moveModule, onDelete, saving, dragDisabled }) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="aapm-curriculum">
        {levels.map((level) => {
          const visual = levelVisual(level.levelNumber);
          return (
            <section key={level.levelNumber} className="aapm-chapter" data-hue={visual.hue} aria-label={`Chapter ${level.levelNumber}: ${level.levelName}`}>
              <div className="aapm-chapter__head"><ChapterHeader level={level} /></div>
              <Droppable droppableId={`level-${level.levelNumber}`} isDropDisabled={saving || dragDisabled}>
                {({ innerRef, droppableProps, placeholder }) => (
                  <ol ref={innerRef} {...droppableProps} className="aapm-chapter__list">
                    {(level.modules || []).map((module, index) => (
                      <Draggable key={String(module.id)} draggableId={String(module.id)} index={index} isDragDisabled={saving || dragDisabled}>
                        {({ innerRef: itemRef, draggableProps, dragHandleProps }, snapshot) => (
                          <li ref={itemRef} {...draggableProps} className="aapm-lesson-row" data-dragging={snapshot.isDragging ? "true" : undefined}>
                            <span className="aapm-lesson-row__grip" {...dragHandleProps} aria-label={`Geser ${module.title}`}><AapmIcon name="grip" /></span>
                            <span className="aapm-lesson-row__index">{module.moduleNumber}</span>
                            <div className="min-w-0">
                              <Link to={`/admin/courses/${courseId}/modules/${module.id}`} className="aapm-lesson-row__title">{module.title}</Link>
                              <span className="aapm-meta truncate">{module.category || module.summary || "Tanpa kategori"}</span>
                            </div>
                            <span data-hide-mobile="" />
                            <ModuleActions module={module} courseId={courseId} onDelete={onDelete} onMove={(direction) => moveModule(module.id, direction, level.levelNumber)} index={index} total={level.modules.length} saving={saving} />
                          </li>
                        )}
                      </Draggable>
                    ))}
                    {placeholder}
                  </ol>
                )}
              </Droppable>
              <Link className="aapm-chapter__add" to={moduleEditorPath(courseId, { levelNumber: level.levelNumber, levelName: level.levelName })}>
                <AapmIcon name="plus" />Tambah modul ke chapter ini
              </Link>
            </section>
          );
        })}
      </div>
    </DragDropContext>
  );
}

function CurriculumBoard({ levels = [], courseId, onDragEnd, onDelete, saving, dragDisabled }) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {levels.map((level) => {
          const visual = levelVisual(level.levelNumber);
          return (
            <section key={level.levelNumber} className="aapm-chapter self-start" data-hue={visual.hue}>
              <div className="aapm-chapter__head"><ChapterHeader level={level} /></div>
              <Droppable droppableId={`level-${level.levelNumber}`} isDropDisabled={saving || dragDisabled}>
                {({ innerRef, droppableProps, placeholder }) => (
                  <div ref={innerRef} {...droppableProps} className="grid gap-2 p-2">
                    {(level.modules || []).map((module, index) => (
                      <Draggable key={String(module.id)} draggableId={String(module.id)} index={index} isDragDisabled={saving || dragDisabled}>
                        {({ innerRef: itemRef, draggableProps, dragHandleProps }, snapshot) => (
                          <article ref={itemRef} {...draggableProps} {...dragHandleProps} className="aapm-card gap-1 p-3" data-variant={snapshot.isDragging ? "raised" : undefined}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="aapm-text-overline">Modul {module.moduleNumber}</span>
                              <ModuleActions module={module} courseId={courseId} onDelete={onDelete} saving={saving} />
                            </div>
                            <Link to={`/admin/courses/${courseId}/modules/${module.id}`} className="text-body font-medium text-foreground hover:text-primary">{module.title}</Link>
                            {module.category ? <span className="aapm-meta">{module.category}</span> : null}
                          </article>
                        )}
                      </Draggable>
                    ))}
                    {placeholder}
                  </div>
                )}
              </Droppable>
              <Link className="aapm-chapter__add" to={moduleEditorPath(courseId, { levelNumber: level.levelNumber, levelName: level.levelName })}>
                <AapmIcon name="plus" />Tambah modul
              </Link>
            </section>
          );
        })}
      </div>
    </DragDropContext>
  );
}
