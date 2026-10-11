import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { nativeApi } from "@/api/nativeClient";
import {
  Button, ConfirmDialog, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Label, Textarea, Tooltip,
} from "@/components/primitives";
import { EditorialContent } from "@/components/academy/EditorialContent";
import { LessonStructuredContent } from "@/components/academy/LessonStructuredContent";
import { canPublishCurriculumDraft, curriculumModule, curriculumPrimaryAction } from "@/lib/curriculumEditorState";
import { Ic } from "@/design-system/canvas";

const sectionLabels = { title: "Judul", summary: "Ringkasan", content: "Materi", editorialContent: "Blok materi",
  levelNumber: "Chapter", levelName: "Nama chapter", category: "Kategori", videoUrl: "Video", videoScript: "Naskah video",
  learningObjectives: "Tujuan belajar", keyTakeaways: "Poin penting", checklist: "Checklist", practicalAssignment: "Praktik",
  questions: "Bank soal", sortOrder: "Urutan", moduleNumber: "Nomor modul" };

/**
 * Draft lifecycle for one module. The actions (draft step · Validasi ·
 * Terbitkan · more) render into the editor's focus bar through
 * `actionsContainer`; the results (validation, publish review, archive
 * reason, revision history) render here, under the bar, only when there is
 * something to read.
 */
export default function CurriculumPublishingPanel({ moduleId, view, draftVersion, dirty, changeKey, conflict,
  busy, onMutation, onError, onRecoverValidation, actionsContainer = null, menuItems = [] }) {
  const [validation, setValidation] = useState(null);
  const [review, setReview] = useState(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
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
  const openHistory = () => { setHistoryOpen(true); if (history === null) loadHistory(); };
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
  const stateLabel = archived ? "Diarsipkan" : view?.publishedRevisionId ? "Diterbitkan" : "Draf belum diterbitkan";

  const publishButton = (
    <Button type="button" size="sm" variant={primaryAction === "publish" ? "primary" : "secondary"} disabled={unavailable || !publishAllowed} onClick={() => setConfirmation("publish")}>
      {!publishAllowed ? <Ic name="lock" /> : null}<span>Terbitkan</span>
    </Button>
  );
  const actions = (
    <div className="flow" aria-label="Alur terbit modul">
      <span className="flow-step is-done hide-md" title={`${stateLabel}${view?.draft?.hasUnpublishedChanges ? " · ada perubahan belum diterbitkan" : ""}`}>
        <span className="flow-dot"><Ic name="check" /></span><span className="flow-label">Draf v{draftVersion ?? "—"}</span>
      </span>
      <span className="flow-line is-done hide-md" style={{ flex: "0 0 16px" }} />
      <Button type="button" size="sm" className="hide-sm" variant={primaryAction === "validate" ? "primary" : "secondary"} disabled={unavailable || dirty || archived} loading={reading} onClick={validate}>Validasi</Button>
      <span className="flow-line hide-sm" style={{ flex: "0 0 16px" }} />
      {archived ? (
        <Button type="button" size="sm" variant={primaryAction === "restore" ? "primary" : "secondary"} disabled={unavailable} onClick={() => setConfirmation("restore")}>Pulihkan modul</Button>
      ) : publishAllowed ? publishButton : (
        <Tooltip content={dirty ? "Simpan draf lalu validasi untuk menerbitkan" : "Terbitkan aktif setelah validasi lolos"}><span tabIndex={-1}>{publishButton}</span></Tooltip>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Opsi lainnya"><Ic name="more" /></button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="show-sm" disabled={unavailable || dirty || archived} onSelect={validate}><Ic name="check-circle" />Validasi draf</DropdownMenuItem>
          {menuItems.map((item) => <DropdownMenuItem key={item.label} disabled={item.disabled} onSelect={item.onSelect}><Ic name={item.ic} />{item.label}</DropdownMenuItem>)}
          <DropdownMenuItem onSelect={openHistory}><Ic name="history" />Riwayat revisi</DropdownMenuItem>
          {view?.lifecycleStatus === "active" ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem tone="danger" disabled={unavailable} onSelect={() => setArchiveOpen(true)}><Ic name="archive" />Arsipkan</DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const hasNotices = archived || readError || validation || review || archiveOpen || historyOpen;
  return (
    <>
      {actionsContainer ? createPortal(actions, actionsContainer) : actions}
      {hasNotices ? (
        <section className="stack gap-3 editor-notices" aria-label="Draf dan penerbitan">
          {archived ? (
            <div className="alert alert-warning" role="status"><Ic name="archive" /><div><span className="alert-title">Modul diarsipkan.</span> Alasan: {view.archiveReason || "—"} · Materi dan bukti akademik tetap tersimpan.</div></div>
          ) : null}
          {readError ? (
            <div className="alert alert-danger" role="alert">
              <Ic name="alert" />
              <div className="row wrap between gap-3 grow"><p>{readError}</p><button type="button" className="btn btn-secondary btn-sm" onClick={() => retryRef.current && read(retryRef.current)} disabled={unavailable}><Ic name="refresh" />Coba lagi</button></div>
            </div>
          ) : null}
          {validation ? (
            <div ref={statusRef} tabIndex={-1} role={validation.valid ? "status" : "alert"} className={`alert ${validation.valid ? "alert-success" : "alert-warning"}`}>
              <Ic name={validation.valid ? "check-circle" : "alert"} />
              <div className="stack gap-1 grow">
                <span className="alert-title">{validation.valid ? `Draf v${validation.draftVersion} lolos validasi.` : "Draf belum dapat diterbitkan."}</span>
                {validation.errors?.length ? (
                  <ul className="stack gap-0-5">{validation.errors.map((problem, index) => (
                    <li key={`${problem.field}-${index}`}><button type="button" className="btn btn-link t-support" onClick={() => onRecoverValidation(problem)}>{problem.message}<Ic name="arrow-right" /></button></li>
                  ))}</ul>
                ) : null}
              </div>
            </div>
          ) : null}
          {review ? (
            <section aria-label="Review penerbitan" className="card card-pad stack gap-2">
              <h2 className="card-title">Review penerbitan: {view.module?.title}</h2>
              <p className="t-support">Revisi saat ini: <strong>{review.currentRevision ?? "Belum ada"}</strong> → Revisi usulan: <strong>{review.nextRevision}</strong> · {review.questionCount} soal</p>
              <p className="t-support">Bagian berubah: {review.changedSections?.map((key) => sectionLabels[key] || key).join(", ") || "Tidak ada perubahan konten"}.</p>
              <p className="t-support">{review.learnerImpact}</p>
              <p className="note">Percobaan kuis yang sedang berjalan tetap menggunakan soal awalnya. Nilai, progres, sertifikat, persyaratan akademik dan ambang kelulusan peserta tetap dipertahankan.</p>
              {review.errors?.length > 0 && <ul role="alert" className="stack gap-0-5">{review.errors.map((problem, index) => <li key={index}><button type="button" className="btn btn-link t-support" onClick={() => onRecoverValidation(problem)}>{problem.message}</button></li>)}</ul>}
            </section>
          ) : null}
          {archiveOpen ? (
            <section className="card card-pad stack gap-3" aria-labelledby="archive-title">
              <h2 className="card-title" id="archive-title">Arsipkan modul</h2>
              <div className="field">
                <Label htmlFor="archive-reason">Alasan pengarsipan (5–500 karakter)</Label>
                <Textarea id="archive-reason" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
                <p className="hint">Arsip menyembunyikan modul bagi peserta yang kebijakannya tidak mewajibkan modul ini. Modul wajib tetap dapat diakses sesuai kebijakan peserta. Riwayat dan bukti akademik tetap tersedia.</p>
              </div>
              <div className="row wrap gap-2">
                <Button type="button" variant={primaryAction === "archive" ? "primary" : "secondary"} disabled={unavailable || reason.trim().length < 5} onClick={() => setConfirmation("archive")}>Konfirmasi arsip</Button>
                <Button type="button" variant="ghost" onClick={() => setArchiveOpen(false)}>Batal</Button>
              </div>
            </section>
          ) : null}
          {historyOpen ? (
            <section className="card card-pad stack gap-3" aria-labelledby="history-title">
              <div className="card-head">
                <h2 className="card-title" id="history-title">Riwayat revisi</h2>
                <div className="row gap-1">
                  <button type="button" className="btn btn-ghost btn-sm" disabled={unavailable} onClick={loadHistory}><Ic name="refresh" />Muat ulang</button>
                  <button type="button" className="btn btn-ghost btn-sm btn-icon btn-quiet" aria-label="Tutup riwayat revisi" onClick={() => setHistoryOpen(false)}><Ic name="x" /></button>
                </div>
              </div>
              {history?.length === 0 && <p className="t-support t-muted">Belum ada revisi yang diterbitkan.</p>}
              {history?.length ? (
                <ul className="list">{history.map((item) => (
                  <li key={item.id} className="li">
                    <span className="tile tile-sm" data-hue="neutral"><Ic name="history" /></span>
                    <span className="stack grow"><span className="li-title">Revisi {item.revisionNumber}</span><span className="li-meta">{item.publishedAt}</span></span>
                    <button type="button" className="btn btn-secondary btn-sm" disabled={unavailable} onClick={() => inspect(item.id)}>Lihat revisi {item.revisionNumber}</button>
                  </li>
                ))}</ul>
              ) : null}
              {revision && <section aria-label={`Snapshot revisi ${revision.revisionNumber}`} className="stack gap-3 card-sect" style={{ paddingTop: "var(--s-3)" }}>
                <h3 className="t-heading">Revisi {revision.revisionNumber} · Snapshot tetap</h3>
                <p className="t-support">{snapshot.title} · {revision.questions.length} soal · {revision.publishedAt}</p>
                <p className="t-support t-muted">Modul {snapshot.moduleNumber} · Chapter {snapshot.levelNumber}: {snapshot.levelName} · Kategori {snapshot.category || "—"} · Urutan {snapshot.sortOrder}</p>
                <p className="t-support">{snapshot.summary}</p>
                <EditorialContent document={snapshot.editorialContent} fallback={snapshot.content} title={snapshot.title} />
                <LessonStructuredContent module={snapshot} document={snapshot.editorialContent} withSectionIds={false} />
                {snapshot.videoUrl && <p className="t-support">Video: {snapshot.videoUrl}</p>}
                {snapshot.videoScript && <p className="t-support">{snapshot.videoScript}</p>}
                <ol className="stack gap-3">{revision.questions.map((question, index) => <li key={index} className="inset stack gap-1" style={{ padding: "var(--s-3)" }}>
                  <strong>{index + 1}. {question.question}</strong><ul className="stack gap-0-5">{question.options.map((option, optionIndex) => <li key={optionIndex} className={optionIndex === question.correctIndex ? "t-success t-strong" : undefined}>{option}{optionIndex === question.correctIndex ? " (Jawaban benar)" : ""}</li>)}</ul>
                  <p className="t-caption t-muted">{question.explanation}</p><p className="t-caption t-muted">{question.learningObjective}</p>
                </li>)}</ol>
                <div className="row wrap gap-2">
                  <Button type="button" variant="secondary" disabled={unavailable || dirty} onClick={() => setConfirmation("copy")}>Salin revisi ke draf</Button>
                  {dirty && <p className="t-caption t-muted">Simpan perubahan lokal sebelum menyalin revisi.</p>}
                </div>
              </section>}
            </section>
          ) : null}
        </section>
      ) : null}
      <ConfirmDialog open={Boolean(confirmation)} onOpenChange={(open) => !open && setConfirmation(null)}
        title={confirmation === "publish" ? "Terbitkan revisi baru?" : confirmation === "copy" ? "Salin revisi ke draf?" : confirmation === "archive" ? "Arsipkan modul?" : "Pulihkan modul?"}
        description={confirmation === "publish" ? `${view.module?.title}: revisi ${review?.nextRevision}, ${review?.questionCount} soal. Percobaan aktif tetap memakai soal awal. Materi yang diterbitkan akan terlihat oleh peserta.`
          : confirmation === "copy" ? `Isi draf server akan diganti dengan snapshot revisi ${revision?.revisionNumber}. Revisi lama dan materi terbit tetap utuh; perubahan ini perlu validasi dan penerbitan baru.`
            : confirmation === "archive" ? `Alasan: ${reason.trim()}. Riwayat dan bukti akademik tidak dihapus.` : "Modul kembali aktif dengan revisi terakhir yang sudah diterbitkan."}
        confirmLabel={confirmation === "publish" ? "Ya, terbitkan" : confirmation === "copy" ? "Ya, salin ke draf" : confirmation === "archive" ? "Ya, arsipkan" : "Ya, pulihkan"}
        onConfirm={confirm} />
    </>
  );
}
