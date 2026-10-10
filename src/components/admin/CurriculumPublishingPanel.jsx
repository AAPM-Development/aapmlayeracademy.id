import React, { useEffect, useRef, useState } from "react";
import { nativeApi } from "@/api/nativeClient";
import { Button, ConfirmDialog, Label, Surface, Textarea } from "@/components/primitives";
import { EditorialContent } from "@/components/academy/EditorialContent";
import { LessonStructuredContent } from "@/components/academy/LessonStructuredContent";
import { canPublishCurriculumDraft, curriculumModule, curriculumPrimaryAction } from "@/lib/curriculumEditorState";

const sectionLabels = { title: "Judul", summary: "Ringkasan", content: "Materi", editorialContent: "Blok materi",
  levelNumber: "Chapter", levelName: "Nama chapter", category: "Kategori", videoUrl: "Video", videoScript: "Naskah video",
  learningObjectives: "Tujuan belajar", keyTakeaways: "Poin penting", checklist: "Checklist", practicalAssignment: "Praktik",
  questions: "Bank soal", sortOrder: "Urutan", moduleNumber: "Nomor modul" };

export default function CurriculumPublishingPanel({ moduleId, view, draftVersion, dirty, changeKey, conflict,
  busy, onMutation, onError, onRecoverValidation }) {
  const [validation, setValidation] = useState(null);
  const [review, setReview] = useState(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState(null);
  const [revision, setRevision] = useState(null);
  const statusRef = useRef(null);
  const retryRef = useRef(null);
  const context = `${moduleId}:${draftVersion}:${changeKey}:${dirty}`;
  const contextRef = useRef(context);
  contextRef.current = context;
  useEffect(() => { setValidation(null); setReview(null); setConfirmation(null); }, [context]);
  const archived = view?.lifecycleStatus === "archived";
  const publishAllowed = canPublishCurriculumDraft({ validation, review, draftVersion, dirty, conflict, archived });
  const primaryAction = archiveOpen && !dirty ? "archive" : curriculumPrimaryAction({ dirty, canPublish: publishAllowed, archived });
  const unavailable = busy || reading || Boolean(conflict);

  const read = async (fn) => {
    if (reading || busy) return;
    retryRef.current = fn;
    setReading(true); setReadError("");
    try { await fn(); }
    catch (error) { setReadError(error.message); onError(error); }
    finally { setReading(false); }
  };
  const validate = () => read(async () => {
    const submittedContext = contextRef.current;
    const result = await nativeApi.admin.modules.validateDraft(moduleId);
    const nextReview = await nativeApi.admin.modules.publishPreview(moduleId);
    if (contextRef.current !== submittedContext) return;
    if (result.draftVersion !== draftVersion || nextReview.draftVersion !== draftVersion) {
      onError({ status: 409, code: "revision_conflict", message: "Draf server berubah. Pilih tindakan pemulihan sebelum melanjutkan." });
      return;
    }
    setValidation(result); setReview(nextReview);
    requestAnimationFrame(() => statusRef.current?.focus());
  });
  const loadHistory = () => read(async () => { const result = await nativeApi.admin.modules.revisions(moduleId); setHistory(result.revisions); });
  const inspect = (id) => read(async () => { setRevision(await nativeApi.admin.modules.revision(moduleId, id)); });
  const confirm = async () => {
    const action = confirmation;
    setConfirmation(null);
    if (action === "publish" && publishAllowed) {
      if (await onMutation("publish")) { setHistory(null); setRevision(null); setValidation(null); setReview(null); }
    } else if (action === "copy" && !dirty && revision) {
      if (await onMutation("copy", revision.id)) { setValidation(null); setReview(null); }
    } else if (action === "archive" && reason.trim().length >= 5 && reason.trim().length <= 500) {
      if (await onMutation("archive", reason.trim())) { setArchiveOpen(false); setReason(""); }
    } else if (action === "restore") await onMutation("restore");
  };
  const snapshot = revision ? curriculumModule(revision) : null;
  return (
    <Surface className="mb-5 space-y-4 p-4" aria-label="Draf dan penerbitan">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm">
          <strong>{archived ? "Diarsipkan" : view?.publishedRevisionId ? "Diterbitkan" : "Draf belum diterbitkan"}</strong>
          {` · Draf v${draftVersion ?? "—"}`}
          {view?.draft?.hasUnpublishedChanges ? " · Ada perubahan belum diterbitkan" : ""}
          {dirty ? " · Ada perubahan lokal belum disimpan" : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={primaryAction === "validate" ? "primary" : "secondary"} disabled={unavailable || dirty || archived} loading={reading} onClick={validate}>Validasi</Button>
          <Button type="button" variant={primaryAction === "publish" ? "primary" : "secondary"} disabled={unavailable || !publishAllowed} onClick={() => setConfirmation("publish")}>Terbitkan</Button>
          {archived ? <Button type="button" variant={primaryAction === "restore" ? "primary" : "secondary"} disabled={unavailable} onClick={() => setConfirmation("restore")}>Pulihkan modul</Button>
            : view?.lifecycleStatus === "active" ? <Button type="button" variant="secondary" disabled={unavailable} onClick={() => setArchiveOpen(!archiveOpen)}>Arsipkan</Button> : null}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">Simpan draf sebelum pratinjau dan validasi. Terbitkan mengaktifkan revisi baru untuk peserta; simpan draf tidak mengubah materi yang sudah diterbitkan.</p>
      {archived && <p className="text-sm">Alasan arsip: {view.archiveReason} · Materi dan bukti akademik tetap tersimpan.</p>}
      {readError && <p role="alert">{readError} <Button type="button" variant="ghost" onClick={() => retryRef.current && read(retryRef.current)} disabled={unavailable}>Coba lagi</Button></p>}
      {validation && <div ref={statusRef} tabIndex={-1} role={validation.valid ? "status" : "alert"} className="space-y-2">
        <p><strong>{validation.valid ? `Draf v${validation.draftVersion} lolos validasi.` : "Draf belum dapat diterbitkan."}</strong></p>
        <ul>{validation.errors?.map((problem, index) => <li key={`${problem.field}-${index}`}>
          <Button type="button" variant="ghost" onClick={() => onRecoverValidation(problem)}>{problem.message}</Button>
        </li>)}</ul>
      </div>}
      {review && <section aria-label="Review penerbitan" className="space-y-2 border-t border-border pt-3">
        <h2 className="font-semibold">Review penerbitan: {view.module?.title}</h2>
        <p>Revisi saat ini: {review.currentRevision ?? "Belum ada"} → Revisi usulan: {review.nextRevision} · {review.questionCount} soal</p>
        <p>Bagian berubah: {review.changedSections?.map((key) => sectionLabels[key] || key).join(", ") || "Tidak ada perubahan konten"}.</p>
        <p>{review.learnerImpact}</p>
        <p>Percobaan kuis yang sedang berjalan tetap menggunakan soal awalnya. Nilai, progres, sertifikat, persyaratan akademik dan ambang kelulusan peserta tetap dipertahankan.</p>
        {review.errors?.length > 0 && <ul role="alert">{review.errors.map((problem, index) => <li key={index}><Button type="button" variant="ghost" onClick={() => onRecoverValidation(problem)}>{problem.message}</Button></li>)}</ul>}
      </section>}
      {archiveOpen && <div className="space-y-2">
        <Label htmlFor="archive-reason">Alasan pengarsipan (5–500 karakter)</Label>
        <Textarea id="archive-reason" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
        <p className="text-sm text-muted-foreground">Arsip menyembunyikan modul bagi peserta yang kebijakannya tidak mewajibkan modul ini. Modul wajib tetap dapat diakses sesuai kebijakan peserta. Riwayat dan bukti akademik tetap tersedia.</p>
        <Button type="button" variant={primaryAction === "archive" ? "primary" : "secondary"} disabled={unavailable || reason.trim().length < 5} onClick={() => setConfirmation("archive")}>Konfirmasi arsip</Button>
        <Button type="button" variant="ghost" onClick={() => setArchiveOpen(false)}>Batal</Button>
      </div>}
      <details onToggle={(event) => { if (event.currentTarget.open && history === null) loadHistory(); }}>
        <summary className="cursor-pointer font-semibold">Riwayat revisi</summary>
        <div className="mt-3 space-y-3">
          <Button type="button" variant="secondary" disabled={unavailable} onClick={loadHistory}>Muat ulang riwayat</Button>
          {history?.length === 0 && <p>Belum ada revisi yang diterbitkan.</p>}
          <ul className="space-y-2">{history?.map((item) => <li key={item.id}><Button type="button" variant="secondary" disabled={unavailable} onClick={() => inspect(item.id)}>Lihat revisi {item.revisionNumber}</Button> <span className="text-sm">{item.publishedAt}</span></li>)}</ul>
          {revision && <section aria-label={`Snapshot revisi ${revision.revisionNumber}`} className="space-y-4 border-t border-border pt-3">
            <h3 className="font-semibold">Revisi {revision.revisionNumber} · Snapshot tetap</h3>
            <p>{snapshot.title} · {revision.questions.length} soal · {revision.publishedAt}</p>
            <p>Modul {snapshot.moduleNumber} · Chapter {snapshot.levelNumber}: {snapshot.levelName} · Kategori {snapshot.category || "—"} · Urutan {snapshot.sortOrder}</p>
            <p>{snapshot.summary}</p>
            <EditorialContent document={snapshot.editorialContent} fallback={snapshot.content} title={snapshot.title} />
            <LessonStructuredContent module={snapshot} document={snapshot.editorialContent} withSectionIds={false} />
            {snapshot.videoUrl && <p>Video: {snapshot.videoUrl}</p>}
            {snapshot.videoScript && <p>{snapshot.videoScript}</p>}
            <ol className="space-y-3">{revision.questions.map((question, index) => <li key={index}>
              <strong>{index + 1}. {question.question}</strong><ul>{question.options.map((option, optionIndex) => <li key={optionIndex}>{option}{optionIndex === question.correctIndex ? " (Jawaban benar)" : ""}</li>)}</ul>
              <p>{question.explanation}</p><p>{question.learningObjective}</p>
            </li>)}</ol>
            <Button type="button" variant="secondary" disabled={unavailable || dirty} onClick={() => setConfirmation("copy")}>Salin revisi ke draf</Button>
            {dirty && <p>Simpan perubahan lokal sebelum menyalin revisi.</p>}
          </section>}
        </div>
      </details>
      <ConfirmDialog open={Boolean(confirmation)} onOpenChange={(open) => !open && setConfirmation(null)}
        title={confirmation === "publish" ? "Terbitkan revisi baru?" : confirmation === "copy" ? "Salin revisi ke draf?" : confirmation === "archive" ? "Arsipkan modul?" : "Pulihkan modul?"}
        description={confirmation === "publish" ? `${view.module?.title}: revisi ${review?.nextRevision}, ${review?.questionCount} soal. Percobaan aktif tetap memakai soal awal. Materi yang diterbitkan akan terlihat oleh peserta.`
          : confirmation === "copy" ? `Isi draf server akan diganti dengan snapshot revisi ${revision?.revisionNumber}. Revisi lama dan materi terbit tetap utuh; perubahan ini perlu validasi dan penerbitan baru.`
            : confirmation === "archive" ? `Alasan: ${reason.trim()}. Riwayat dan bukti akademik tidak dihapus.` : "Modul kembali aktif dengan revisi terakhir yang sudah diterbitkan."}
        confirmLabel={confirmation === "publish" ? "Ya, terbitkan" : confirmation === "copy" ? "Ya, salin ke draf" : confirmation === "archive" ? "Ya, arsipkan" : "Ya, pulihkan"}
        onConfirm={confirm} />
    </Surface>
  );
}
