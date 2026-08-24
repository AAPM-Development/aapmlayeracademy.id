// @ts-nocheck
import React from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, Icon, Surface, Tabs, TabsContent, TabsList, TabsTrigger, useToast } from "@/components/primitives";
import AapmIcon from "@/components/icons/AapmIcon";
import { useAdminCourse, useReorderAdminModules } from "@/lib/useAdminData";
import { AdminError, AdminLoading, AdminPageFrame, AdminUnavailable } from "@/components/admin/AdminPage";

export default function AdminCourseDetail() {
  const { courseId } = useParams();
  const { data: course, isLoading, error, refetch } = useAdminCourse(courseId);
  const reorderModules = useReorderAdminModules();
  const { toast } = useToast();
  const modules = (course?.curriculum || []).flatMap((level) => level.modules || []);

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

  return (
    <AdminPageFrame
      title={course?.title || "Kurikulum Academy"}
      description="Konten dan evaluasi ini langsung digunakan oleh Academy setelah disimpan."
      actions={<div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/admin/courses"><AapmIcon name="arrowLeft" className="h-4 w-4" /> Semua course</Link></Button><Button asChild><Link to={`/admin/courses/${courseId}/modules/new`}><AapmIcon name="add" className="h-4 w-4" /> Tambah modul</Link></Button></div>}
    >
      {isLoading ? <AdminLoading label="Memuat struktur kurikulum…" /> : error ? <AdminError error={error} onRetry={refetch} /> : <div className="space-y-5">
        <Surface tone="orange" className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-background/75 p-2"><Icon name="course" className="h-6 w-6" /></div><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">{course.title}</h2><Badge variant="soft" className="bg-background/75 text-tint-orange-foreground">{course.status === "published" ? "Aktif" : "Belum tersedia"}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{course.moduleCount} modul · {course.learnerCount} learner dengan progres</p></div></div>
          <span className="inline-flex items-center gap-2 text-xs font-medium text-tint-orange-foreground"><AapmIcon name="checkRead" className="h-4 w-4" /> Perubahan tersimpan langsung</span>
        </Surface>
        <Tabs defaultValue="general">
          <TabsList className="w-full justify-start overflow-x-auto"><TabsTrigger value="general">Ringkasan</TabsTrigger><TabsTrigger value="curriculum">Kurikulum</TabsTrigger><TabsTrigger value="learners">Learner</TabsTrigger></TabsList>
          <TabsContent value="general" className="mt-4"><Surface className="p-5"><h2 className="text-sm font-semibold">Kurikulum aktif</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{course.availabilityNote}</p><div className="mt-5 grid gap-3 sm:grid-cols-3"><Surface variant="muted" className="p-4"><div className="text-xs text-muted-foreground">Struktur</div><div className="mt-1 text-xl font-semibold">{course.moduleCount} modul</div></Surface><Surface variant="muted" className="p-4"><div className="text-xs text-muted-foreground">Konten & bank soal</div><div className="mt-1 text-sm font-semibold">Dapat diedit</div></Surface><Surface variant="muted" className="p-4"><div className="text-xs text-muted-foreground">Urutan tampil</div><div className="mt-1 text-sm font-semibold">Dapat disusun ulang</div></Surface></div></Surface></TabsContent>
          <TabsContent value="curriculum" className="mt-4"><div className="space-y-3">{course.curriculum?.map((level) => <Surface key={level.levelNumber} className="overflow-hidden p-0"><div className="flex items-center gap-3 border-b border-[hsl(var(--surface-border))] bg-surface-subtle px-5 py-4"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-green text-xs font-bold text-white">{level.levelNumber}</div><div><h2 className="text-sm font-semibold">{level.levelName}</h2><p className="mt-0.5 text-xs text-muted-foreground">{level.modules.length} modul</p></div></div><div className="divide-y divide-[hsl(var(--surface-border))]">{level.modules.map((module) => { const moduleIndex = modules.findIndex((item) => Number(item.id) === Number(module.id)); return <div key={module.id} className="flex items-center gap-3 px-4 py-3 sm:px-5"><AapmIcon name="reorder" className="hidden h-4 w-4 text-muted-foreground/50 sm:block" /><span className="w-7 shrink-0 text-xs font-semibold text-muted-foreground">{module.moduleNumber}</span><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{module.title}</div><div className="mt-0.5 truncate text-xs text-muted-foreground">{module.category || module.summary}</div></div><div className="flex shrink-0 items-center gap-1"><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => moveModule(module.id, -1)} disabled={moduleIndex === 0 || reorderModules.isPending} aria-label={`Naikkan urutan ${module.title}`}><AapmIcon name="arrowLeft" className="h-3.5 w-3.5 -rotate-90" /></Button><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => moveModule(module.id, 1)} disabled={moduleIndex === modules.length - 1 || reorderModules.isPending} aria-label={`Turunkan urutan ${module.title}`}><AapmIcon name="arrowRight" className="h-3.5 w-3.5 rotate-90" /></Button><Button asChild size="sm" variant="outline"><Link to={`/admin/courses/${courseId}/modules/${module.id}`}><AapmIcon name="edit" className="h-3.5 w-3.5" /><span className="hidden sm:inline">Edit</span></Link></Button></div></div>; })}</div></Surface>)}</div></TabsContent>
          <TabsContent value="learners" className="mt-4"><AdminUnavailable title="Enrollment per course belum digunakan" description="Progress tiap learner tetap aman dan dapat dilihat dari menu User management. Academy saat ini memakai satu kurikulum aktif." /></TabsContent>
        </Tabs>
      </div>}
    </AdminPageFrame>
  );
}
