// @ts-nocheck
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { nativeApi } from '@/api/nativeClient';
import { Alert, Badge, Button, ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Field, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@/design-system';
import { AdminError, AdminLoading, AdminPageFrame } from '@/components/admin/AdminPage';
import { CurriculumDraftFeedback, ReloadDraftDialog } from '@/components/admin/CurriculumDraftFeedback';
import { curriculumPrimaryAction } from '@/lib/policyEditorState';
import { useCurriculumDraft } from '@/lib/useCurriculumDraft';

const bankApi = nativeApi.admin.curriculum.finalBank;

export default function AdminFinalBank() {
  const editor = useCurriculumDraft(['admin', 'curriculum', 'final-bank'], bankApi.get);
  const [validation, setValidation] = useState(null);
  const [reloadOpen, setReloadOpen] = useState(false);
  const [review, setReview] = useState(null);
  const [preview, setPreview] = useState(false);
  const [remove, setRemove] = useState(null);
  const [published, setPublished] = useState(null);
  const bank = editor.draft;
  const primary = curriculumPrimaryAction({ dirty: editor.dirty, valid: validation?.valid });
  const changeQuestions = (questions) => { editor.setDraft({ ...bank, questions }); setValidation(null); setReview(null); setPublished(null); };
  const update = (index, patch) => changeQuestions(bank.questions.map((question, i) => i === index ? { ...question, ...patch } : question));
  const save = (event) => { event.preventDefault(); editor.run(async () => { const result = await bankApi.save(bank.questions, bank.draftVersion); editor.accept(result); setValidation(null); setPublished(null); }); };
  const validate = (withReview = false) => editor.run(async () => { const result = await bankApi.validate(bank.draftVersion); setValidation(result); if (withReview && result.valid) setReview({ version: bank.draftVersion, count: bank.questions.length }); });
  const publish = () => editor.run(async () => {
    const result = await bankApi.publish(review.version);
    // Accept the consumed token immediately, even if a subsequent read is unavailable.
    editor.accept({ ...bank, draftVersion: result.draftVersion, publishedRevision: { revisionId: result.revisionId, revisionNumber: result.revisionNumber, publishedAt: result.publishedAt } });
    setReview(null); setValidation(null); setPublished(result.revisionNumber);
  });
  return <AdminPageFrame title="Bank ujian akhir" description="Susun, validasi, dan terbitkan soal untuk percobaan ujian berikutnya." back={{ to: '/admin/courses', label: 'Course' }} actions={<Button asChild variant="secondary"><Link to="/admin/curriculum/policies">Kebijakan kurikulum</Link></Button>}>
    <Alert tone="info" title="Draf hanya terlihat oleh pengelola" description="Simpan draf tidak mengubah soal peserta. Setelah Terbitkan, percobaan baru menggunakan revisi baru. Percobaan yang telah dimulai, jawaban, nilai, progres, dan bukti sertifikat tetap menggunakan rekaman sebelumnya." />
    {!bank ? editor.query.error ? <AdminError error={editor.query.error} onRetry={editor.query.refetch} /> : <AdminLoading /> : <form onSubmit={save} className="grid gap-4 mt-4 min-w-0">
      <div className="flex flex-wrap gap-3 items-center"><Badge>Draf versi {bank.draftVersion}</Badge><span className="aapm-text-caption">{bank.publishedRevision ? `Revisi terbit ${bank.publishedRevision.revisionNumber}` : 'Belum diterbitkan'} · {bank.questions.length} soal</span></div>
      <CurriculumDraftFeedback error={editor.error} validation={validation} onReload={() => setReloadOpen(true)} busy={editor.busy} />
      {published && <div role="status"><Alert tone="success" title={`Revisi ${published} diterbitkan`} description="Percobaan baru kini menggunakan bank soal ini. Rekaman percobaan sebelumnya tetap tersimpan." /></div>}
      {bank.questions.length === 0 && <Alert tone="warning" title="Draf belum memiliki soal" description="Tambahkan minimal satu soal yang valid sebelum menerbitkan." />}
      <fieldset disabled={editor.busy} className="grid gap-4 min-w-0">
        {bank.questions.map((question, index) => <section key={question.id} className="aapm-card p-5 grid gap-4 min-w-0" aria-label={`Soal ${index + 1}`}>
          <div className="flex flex-wrap items-center gap-2"><h2 className="aapm-text-section m-0 flex-1">Soal {index + 1}</h2><Button type="button" variant="ghost" onClick={() => setRemove(index)} aria-label={`Hapus soal ${index + 1} dari draf`}>Hapus dari draf</Button></div>
          <Field id={`question-${index}`} label="Pertanyaan" required><Textarea id={`question-${index}`} value={question.question} required rows={3} onChange={(event) => update(index, { question: event.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">{question.options.map((option, optionIndex) => <Field key={optionIndex} id={`option-${index}-${optionIndex}`} label={`Opsi ${optionIndex + 1}`} required><Input id={`option-${index}-${optionIndex}`} value={option} required onChange={(event) => update(index, { options: question.options.map((value, i) => i === optionIndex ? event.target.value : value) })} /></Field>)}</div>
          <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" disabled={question.options.length >= 6} onClick={() => update(index, { options: [...question.options, ''] })}>Tambah opsi</Button><Button type="button" variant="outline" size="sm" disabled={question.options.length <= 2} onClick={() => update(index, { options: question.options.slice(0, -1), correctIndex: Math.min(question.correctIndex, question.options.length - 2) })}>Hapus opsi terakhir</Button></div>
          <div className="grid gap-3 sm:grid-cols-2"><Field id={`correct-${index}`} label="Jawaban benar"><Select value={String(question.correctIndex)} onValueChange={(value) => update(index, { correctIndex: Number(value) })} disabled={editor.busy}><SelectTrigger id={`correct-${index}`}><SelectValue /></SelectTrigger><SelectContent>{question.options.map((_, optionIndex) => <SelectItem key={optionIndex} value={String(optionIndex)}>Opsi {optionIndex + 1}</SelectItem>)}</SelectContent></Select></Field>
            <Field id={`difficulty-${index}`} label="Kesulitan"><Select value={question.difficulty || 'medium'} onValueChange={(difficulty) => update(index, { difficulty })} disabled={editor.busy}><SelectTrigger id={`difficulty-${index}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="easy">Mudah</SelectItem><SelectItem value="medium">Sedang</SelectItem><SelectItem value="hard">Sulit</SelectItem></SelectContent></Select></Field></div>
          <Field id={`explanation-${index}`} label="Pembahasan"><Textarea id={`explanation-${index}`} value={question.explanation || ''} onChange={(event) => update(index, { explanation: event.target.value })} /></Field>
          <Field id={`objective-${index}`} label="Tujuan pembelajaran"><Input id={`objective-${index}`} value={question.learningObjective || ''} onChange={(event) => update(index, { learningObjective: event.target.value })} /></Field>
        </section>)}
        <Button type="button" variant="secondary" onClick={() => changeQuestions([...bank.questions, { id: Math.min(0, ...bank.questions.map((question) => question.id)) - 1, question: '', options: ['', '', '', ''], correctIndex: 0, explanation: '', difficulty: 'medium', learningObjective: '' }])}>Tambah soal</Button>
      </fieldset>
      <div className="aapm-card sticky bottom-3 z-10 p-4 flex flex-wrap gap-2 items-center"><Button type="submit" variant={primary === 'save' ? 'primary' : 'secondary'} disabled={editor.busy || !editor.dirty || editor.error?.code === 'revision_conflict'}>Simpan draf</Button><Button type="button" variant="secondary" disabled={editor.busy} onClick={() => setPreview(true)}>Pratinjau</Button><Button type="button" variant={primary === 'validate' ? 'primary' : 'secondary'} disabled={editor.busy || editor.dirty} onClick={() => validate()}>Validasi</Button><Button type="button" variant={primary === 'publish' ? 'primary' : 'secondary'} disabled={editor.busy || editor.dirty} onClick={() => validate(true)}>Terbitkan</Button><Button type="button" variant="ghost" disabled={editor.busy} onClick={() => setReloadOpen(true)}>Muat ulang</Button><span className="aapm-text-caption" role="status">{editor.busy ? 'Memproses…' : editor.dirty ? 'Ada perubahan belum disimpan' : `Draf versi ${bank.draftVersion} tersimpan`}</span></div>
    </form>}
    <ReloadDraftDialog open={reloadOpen} onOpenChange={setReloadOpen} busy={editor.busy} onConfirm={async () => { setReloadOpen(false); if (await editor.reload()) { setValidation(null); setReview(null); setPublished(null); } }} />
    <ConfirmDialog open={remove !== null} onOpenChange={(open) => !open && setRemove(null)} title="Hapus soal dari draf?" description="Soal pada revisi terbit dan percobaan peserta tetap tersimpan. Penghapusan baru berlaku untuk percobaan baru setelah draf diterbitkan." confirmLabel="Hapus dari draf" onConfirm={() => { changeQuestions(bank.questions.filter((_, index) => index !== remove)); setRemove(null); }} />
    <ConfirmDialog open={Boolean(review)} onOpenChange={(open) => !editor.busy && !open && setReview(null)} title="Terbitkan bank ujian akhir?" description={`Draf versi ${review?.version} berisi ${review?.count} soal akan menjadi revisi ${(bank?.publishedRevision?.revisionNumber || 0) + 1}. Percobaan baru menggunakan soal ini. Percobaan yang telah dimulai dan bukti akademik tetap menggunakan rekaman sebelumnya.`} confirmLabel="Terbitkan" loading={editor.busy} onConfirm={publish} />
    <Dialog open={preview} onOpenChange={setPreview}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Pratinjau draf ujian akhir</DialogTitle><DialogDescription>Pratinjau pengelola, termasuk isian yang belum disimpan. Jawaban benar disembunyikan di pratinjau ini.</DialogDescription></DialogHeader><ol className="grid gap-5 list-decimal pl-6">{bank?.questions.map((question) => <li key={question.id}><p className="whitespace-pre-wrap break-words">{question.question}</p><ol className="list-[upper-alpha] pl-6">{question.options.map((option, index) => <li key={index} className="break-words">{option}</li>)}</ol></li>)}</ol></DialogContent></Dialog>
  </AdminPageFrame>;
}
