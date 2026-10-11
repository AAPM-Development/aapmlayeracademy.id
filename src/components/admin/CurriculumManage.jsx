// @ts-nocheck
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ConfirmDialog, useToast } from "@/design-system";
import { Ic } from "@/design-system/canvas";
import { useCreateCurriculum, useDeleteCurriculum, useUpdateCurriculum } from "@/lib/useAdminData";

/**
 * Curricula are managed in place, like modules inside a chapter: type a name,
 * press Enter, the curriculum appears in the list. Renaming happens on the
 * title itself; an empty extra curriculum can be removed.
 */

/** The last row of the course list: a name field that creates a curriculum on Enter. */
export function NewCurriculumRow() {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [created, setCreated] = useState(null);
  const createCurriculum = useCreateCurriculum();
  const { toast } = useToast();
  const busy = createCurriculum.isPending;
  const submit = async (event) => {
    event?.preventDefault();
    if (title.trim().length < 3 || busy) return;
    try {
      const course = await createCurriculum.mutateAsync({ title: title.trim(), summary: summary.trim() });
      setCreated(course);
      setTitle(""); setSummary("");
    } catch (error) {
      toast({ variant: "destructive", title: "Kurikulum belum dibuat", description: error?.message || "Coba lagi." });
    }
  };
  return (
    <section className="card card-dashed card-pad stack gap-3 curriculum-new" aria-labelledby="new-curriculum-title">
      <form className="stack gap-3" onSubmit={submit}>
        <div className="row gap-3">
          <span className="tile tile-sm" data-hue="green"><Ic name="plus" /></span>
          <div className="stack grow" style={{ minWidth: 0 }}>
            <span className="t-support t-strong" id="new-curriculum-title">Tambah kurikulum</span>
            <span className="t-caption t-muted">Kurikulum lain dengan chapter dan modulnya sendiri, misal broiler atau pembibitan.</span>
          </div>
        </div>
        <div className="row wrap gap-2">
          <label className="sr-only" htmlFor="new-curriculum-name">Nama kurikulum</label>
          <input id="new-curriculum-name" className="curriculum-add-input grow" style={{ flex: "1 1 220px" }} value={title} maxLength={160} disabled={busy}
            placeholder="Nama kurikulum, lalu Enter" enterKeyHint="done" onChange={(event) => setTitle(event.target.value)} />
          {title.trim() ? <button type="submit" className="btn btn-primary btn-sm" disabled={busy || title.trim().length < 3} aria-busy={busy || undefined}>{busy ? "Membuat…" : "Buat kurikulum"}</button> : null}
        </div>
        {title.trim() ? (
          <>
            <label className="sr-only" htmlFor="new-curriculum-summary">Deskripsi singkat (opsional)</label>
            <input id="new-curriculum-summary" className="curriculum-add-input" value={summary} maxLength={600} disabled={busy}
              placeholder="Deskripsi singkat (opsional)" onChange={(event) => setSummary(event.target.value)} />
          </>
        ) : null}
      </form>
      {created ? (
        <p className="row wrap gap-2 t-caption curriculum-added" role="status">
          <Ic name="check-circle" size="xs" className="t-success" />
          <span className="grow" style={{ minWidth: 0 }}>Kurikulum “{created.title}” dibuat.</span>
          <Link className="btn btn-link btn-sm" to={`/admin/courses/${created.id}?chapter=new`}>Tambah chapter pertama<Ic name="arrow-right" /></Link>
          <button type="button" className="btn btn-ghost btn-sm btn-icon btn-quiet" aria-label="Tutup catatan" onClick={() => setCreated(null)}><Ic name="x" /></button>
        </p>
      ) : null}
    </section>
  );
}

/** The curriculum name, renamed in place (Enter saves, Escape cancels). */
export function CurriculumTitle({ course, className = "t-heading t-clamp-1", id = "course-name" }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(course.title);
  const inputRef = useRef(null);
  const update = useUpdateCurriculum();
  const { toast } = useToast();
  useEffect(() => { if (!editing) setTitle(course.title); }, [course.title, editing]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);
  const save = async (event) => {
    event?.preventDefault();
    const next = title.trim();
    if (next === course.title) { setEditing(false); return; }
    if (next.length < 3) return;
    try {
      await update.mutateAsync({ courseId: course.id, data: { title: next } });
      setEditing(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Nama belum disimpan", description: error?.message || "Coba lagi." });
    }
  };
  if (!editing) {
    return (
      <div className="row gap-1" style={{ minWidth: 0 }}>
        <h2 className={className} id={id}>{course.title}</h2>
        <button type="button" className="btn btn-ghost btn-sm btn-icon btn-quiet" aria-label={`Ganti nama kurikulum ${course.title}`} title="Ganti nama" onClick={() => setEditing(true)}><Ic name="edit" /></button>
      </div>
    );
  }
  return (
    <form className="row wrap gap-2" onSubmit={save}>
      <label className="sr-only" htmlFor={`${id}-input`}>Nama kurikulum</label>
      <input ref={inputRef} id={`${id}-input`} className="curriculum-chapter-input grow" style={{ flex: "1 1 220px" }} value={title} maxLength={160} disabled={update.isPending}
        onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setEditing(false); } }} />
      <button type="submit" className="btn btn-primary btn-sm" disabled={update.isPending || title.trim().length < 3}>{update.isPending ? "Menyimpan…" : "Simpan"}</button>
      <button type="button" className="btn btn-ghost btn-sm" disabled={update.isPending} onClick={() => setEditing(false)}>Batal</button>
    </form>
  );
}

/** Removes an extra curriculum that has no modules; the primary one stays. */
export function DeleteEmptyCurriculum({ course, afterDelete = "/admin/courses" }) {
  const [open, setOpen] = useState(false);
  const remove = useDeleteCurriculum();
  const navigate = useNavigate();
  const { toast } = useToast();
  if (course.primary || Number(course.moduleCount || 0) > 0) return null;
  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm t-danger" onClick={() => setOpen(true)}><Ic name="trash" />Hapus kurikulum</button>
      <ConfirmDialog open={open} onOpenChange={(next) => { if (!remove.isPending) setOpen(next); }}
        title="Hapus kurikulum kosong?" description={`“${course.title}” belum berisi modul, jadi tidak ada materi atau riwayat peserta yang ikut terhapus.`}
        confirmLabel="Hapus kurikulum" loading={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(course.id);
            toast({ title: "Kurikulum dihapus", description: course.title });
            setOpen(false);
            if (afterDelete) navigate(afterDelete);
          } catch (error) {
            toast({ variant: "destructive", title: "Kurikulum belum dihapus", description: error?.message || "Coba lagi." });
          }
        }} />
    </>
  );
}
