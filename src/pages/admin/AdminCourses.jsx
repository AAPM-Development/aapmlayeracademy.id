// @ts-nocheck
import React from "react";
import { Link } from "react-router-dom";
import { Badge, Button, IconTile, Surface, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/primitives";
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
      {isLoading ? <AdminLoading label="Memuat katalog course…" /> : error ? <AdminError error={error} onRetry={refetch} /> : !courses.length ? <AdminUnavailable title="Belum ada kurikulum native" description="Kurikulum akan tersedia ketika katalog modul telah diinisialisasi." /> : <Surface className="overflow-hidden p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="pl-5">Course</TableHead><TableHead>Status</TableHead><TableHead>Modul</TableHead><TableHead>Learner dengan progres</TableHead><TableHead>Update</TableHead><TableHead className="pr-5 text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>{courses.map((course) => <TableRow key={course.id}><TableCell className="min-w-[240px] pl-5"><div className="flex items-center gap-3"><IconTile icon="course" tone="orange" size="sm" /><div><div className="font-semibold">{course.title}</div><div className="mt-0.5 text-xs text-muted-foreground">Kurikulum Academy aktif</div></div></div></TableCell><TableCell><Badge variant="soft" className={course.status === "published" ? "bg-tint-green text-tint-green-foreground" : "bg-tint-orange text-tint-orange-foreground"}>{course.status === "published" ? "Aktif" : "Belum tersedia"}</Badge></TableCell><TableCell className="tabular-nums">{course.moduleCount}</TableCell><TableCell className="tabular-nums">{course.learnerCount}</TableCell><TableCell className="text-xs text-muted-foreground">{formatAdminDate(course.updatedAt)}</TableCell><TableCell className="pr-5 text-right"><Button asChild size="sm" variant="outline"><Link to={`/admin/courses/${course.id}`}>Kelola <AapmIcon name="arrowRight" className="h-3.5 w-3.5" /></Link></Button></TableCell></TableRow>)}</TableBody></Table></div></Surface>}
      {courses[0]?.availabilityNote && <p className="mt-3 text-xs leading-5 text-muted-foreground">{courses[0].availabilityNote}</p>}
    </AdminPageFrame>
  );
}
