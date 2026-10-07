import React from "react";
import { Link } from "react-router-dom";
import { Badge, Button, StateView } from "@/design-system";
import AapmIcon from "@/components/icons/AapmIcon";
import { ModuleCover } from "@/components/academy/CourseElements";
import { useAdminCourses } from "@/lib/useAdminData";
import { AdminError, AdminLoading, AdminPageFrame } from "@/components/admin/AdminPage";
import { formatAdminDate } from "@/components/admin/adminUtils";

export default function AdminCourses() {
  const { data, isLoading, error, refetch } = useAdminCourses();
  const courses = data?.courses || [];

  return (
    <AdminPageFrame
      title="Manajemen course"
      description="Kelola kurikulum, konten modul, dan bank soal Academy."
    >
      {isLoading ? <AdminLoading label="Memuat katalog course…" /> : error ? <AdminError error={error} onRetry={refetch} /> : !courses.length ? (
        <StateView kind="empty" icon="course" title="Belum ada kurikulum" description="Kurikulum akan tersedia ketika katalog modul telah diinisialisasi." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <article key={course.id} className="aapm-course-card">
              <ModuleCover level={1} number={course.moduleCount} />
              <div className="aapm-course-card__body">
                <div className="aapm-course-card__chips">
                  <Badge tone={course.status === "published" ? "success" : "warning"} dot>{course.status === "published" ? "Aktif" : "Belum tersedia"}</Badge>
                </div>
                <h2 className="aapm-course-card__title">{course.title}</h2>
                <div className="aapm-course-card__meta">
                  <span><AapmIcon name="modules" />{course.moduleCount} modul</span>
                  <span><AapmIcon name="graduation" />{course.learnerCount} learner</span>
                  <span><AapmIcon name="clock" />{formatAdminDate(course.updatedAt)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button asChild size="sm"><Link to={`/admin/courses/${course.id}`}><AapmIcon name="edit" />Kelola kurikulum</Link></Button>
                  <Button asChild size="sm" variant="ghost"><Link to="/modules"><AapmIcon name="eye" />Pratinjau</Link></Button>
                </div>
                {course.availabilityNote ? <p className="aapm-text-caption m-0 mt-1">{course.availabilityNote}</p> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </AdminPageFrame>
  );
}
