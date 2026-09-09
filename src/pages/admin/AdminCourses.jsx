// @ts-nocheck
import React from "react";
import { Link } from "react-router-dom";
import { Badge, Button, DataTable, IconTile, Surface } from "@/components/primitives";
import AapmIcon from "@/components/icons/AapmIcon";
import { useAdminCourses } from "@/lib/useAdminData";
import { AdminError, AdminLoading, AdminPageFrame, AdminUnavailable } from "@/components/admin/AdminPage";
import { formatAdminDate } from "@/components/admin/adminUtils";

export default function AdminCourses() {
  const { data, isLoading, error, refetch } = useAdminCourses();
  const courses = data?.courses || [];
  const primaryCourse = courses[0];
  return (
    <AdminPageFrame title="Manajemen course" description="Kelola kurikulum Academy aktif, konten modul, dan bank soal dari satu alur." actions={primaryCourse ? <Button asChild><Link to={`/admin/courses/${primaryCourse.id}`}><AapmIcon name="course" className="h-4 w-4" /> Kelola kurikulum</Link></Button> : null}>
      {isLoading ? <AdminLoading label="Memuat katalog course…" /> : error ? <AdminError error={error} onRetry={refetch} /> : !courses.length ? <AdminUnavailable title="Belum ada kurikulum native" description="Kurikulum akan tersedia ketika katalog modul telah diinisialisasi." /> : <Surface className="p-0"><DataTable
        caption="Kurikulum Academy aktif"
        responsive="stacked"
        rows={courses}
        rowKey={(course) => String(course.id)}
        columns={[
          {
            key: "course",
            header: "Course",
            required: true,
            overflow: "wrap",
            render: (course) => <div className="flex min-w-56 items-center gap-3"><IconTile icon="course" tone="orange" size="sm" /><div><div className="font-semibold">{course.title}</div><div className="mt-0.5 text-xs text-muted-foreground">Kurikulum Academy aktif</div></div></div>,
          },
          { key: "status", header: "Status", overflow: "nowrap", render: (course) => <Badge variant={course.status === "published" ? "success" : "warning"}>{course.status === "published" ? "Aktif" : "Belum tersedia"}</Badge> },
          { key: "moduleCount", header: "Modul", align: "right", overflow: "nowrap", render: (course) => <span className="tabular-nums">{course.moduleCount}</span> },
          { key: "learnerCount", header: "Learner dengan progres", align: "right", overflow: "nowrap", render: (course) => <span className="tabular-nums">{course.learnerCount}</span> },
          { key: "updatedAt", header: "Update", overflow: "nowrap", render: (course) => <span className="text-xs text-muted-foreground">{formatAdminDate(course.updatedAt)}</span> },
          { key: "actions", header: "Aksi", align: "right", required: true, overflow: "nowrap", render: (course) => <Button asChild size="sm" variant="outline"><Link to={`/admin/courses/${course.id}`}>Kelola <AapmIcon name="arrowRight" className="h-3.5 w-3.5" /></Link></Button> },
        ]}
      /></Surface>}
      {courses[0]?.availabilityNote && <p className="mt-3 text-xs leading-5 text-muted-foreground">{courses[0].availabilityNote}</p>}
    </AdminPageFrame>
  );
}
