// @ts-nocheck
import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Plus } from "lucide-react";
import { Badge, Button, Icon, Surface, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/primitives";
import { useAdminCourses } from "@/lib/useAdminData";
import { AdminError, AdminLoading, AdminPageFrame, AdminUnavailable } from "@/components/admin/AdminPage";
import { formatAdminDate } from "@/components/admin/adminUtils";

export default function AdminCourses() {
  const { data, isLoading, error, refetch } = useAdminCourses();
  const courses = data?.courses || [];

  return (
    <AdminPageFrame title="Course management" description="Katalog course yang saat ini ditopang oleh data modul native." actions={<Button type="button" disabled title="Pembuatan course belum didukung oleh API native"><Plus className="h-4 w-4" /> Tambah course</Button>}>
      {isLoading ? <AdminLoading label="Memuat katalog course…" /> : error ? <AdminError error={error} onRetry={refetch} /> : !courses.length ? <AdminUnavailable title="Belum ada course native" description="Course akan muncul ketika katalog modul tersedia." /> : <Surface className="overflow-hidden p-0"><Table><TableHeader><TableRow><TableHead className="pl-5">Course</TableHead><TableHead>Status</TableHead><TableHead>Modul</TableHead><TableHead>Learner dengan progres</TableHead><TableHead>Update</TableHead><TableHead className="pr-5 text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>{courses.map((course) => <TableRow key={course.id}><TableCell className="pl-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-tint-orange p-2"><Icon name="course" className="h-5 w-5" /></div><div><div className="font-semibold">{course.title}</div><div className="mt-0.5 text-xs text-muted-foreground">Katalog modul native</div></div></div></TableCell><TableCell><Badge variant="soft" className={course.status === "published" ? "bg-tint-green text-tint-green-foreground" : "bg-tint-orange text-tint-orange-foreground"}>{course.status === "published" ? "Published" : "Unavailable"}</Badge></TableCell><TableCell className="tabular-nums">{course.moduleCount}</TableCell><TableCell className="tabular-nums">{course.learnerCount}</TableCell><TableCell className="text-xs text-muted-foreground">{formatAdminDate(course.updatedAt)}</TableCell><TableCell className="pr-5 text-right"><Button asChild size="sm" variant="outline"><Link to={`/admin/courses/${course.id}`}>Buka <ArrowRight className="h-3.5 w-3.5" /></Link></Button></TableCell></TableRow>)}</TableBody></Table></Surface>}
      {courses[0]?.availabilityNote && <p className="mt-3 text-xs leading-5 text-muted-foreground">{courses[0].availabilityNote}</p>}
    </AdminPageFrame>
  );
}
