// @ts-nocheck
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { nativeApi } from '@/api/nativeClient';
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/design-system';
import { AdminError, AdminLoading, AdminPageFrame } from '@/components/admin/AdminPage';
import { CurriculumActionBar, CurriculumDraftFeedback, ReloadDraftDialog } from '@/components/admin/CurriculumDraftFeedback';
import { curriculumPrimaryAction } from '@/lib/policyEditorState';
import { useCurriculumDraft } from '@/lib/useCurriculumDraft';
import { Ic } from '@/design-system/canvas';

const bankApi = nativeApi.admin.curriculum.finalBank;
const difficultyNames = { easy: 'Mudah', medium: 'Sedang', hard: 'Sulit', expert: 'Ahli' };
const LETTERS = 'ABCDEF';

/** What a question still needs before it can be validated (shown as row chips). */
function questionProblems(question) {
  const problems = [];
  if (!question.question?.trim()) problems.push('Pertanyaan belum diisi');
  if (question.options.some((option) => !String(option).trim())) problems.push('Ada opsi kosong');
  if (!(question.correctIndex >= 0 && question.correctIndex < question.options.length)) problems.push('Jawaban benar belum dipilih');
  return problems;
}

export default function AdminFinalBank() {
  const editor = useCurriculumDraft(['admin', 'curriculum', 'final-bank'], bankApi.get);
  const [validation, setValidation] = useState(null);
  const [reloadOpen, setReloadOpen] = useState(false);
  const [review, setReview] = useState(null);
  const [preview, setPreview] = useState(false);
  const [remove, setRemove] = useState(null);
  const [published, setPublished] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const bank = editor.draft;
  const primary = curriculumPrimaryAction({ dirty: editor.dirty, valid: validation?.valid });
  const changeQuestions = (questions) => { editor.setDraft({ ...bank, questions }); setValidation(null); setReview(null); setPublished(null); };
  const update = (index, patch) => changeQuestions(bank.questions.map((question, i) => i === index ? { ...question, ...patch } : question));
  const save = (event) => { event?.preventDefault(); editor.run(async () => { const result = await bankApi.save(bank.questions, bank.draftVersion); editor.accept(result); setValidation(null); setPublished(null); }); };
  const validate = (withReview = false) => editor.run(async () => { const result = await bankApi.validate(bank.draftVersion); setValidation(result); if (withReview && result.valid) setReview({ version: bank.draftVersion, count: bank.questions.length }); });
  const publish = () => editor.run(async () => {
    const result = await bankApi.publish(review.version);
    // Accept the consumed token immediately, even if a subsequent read is unavailable.
    editor.accept({ ...bank, draftVersion: result.draftVersion, publishedRevision: { revisionId: result.revisionId, revisionNumber: result.revisionNumber, publishedAt: result.publishedAt } });
    setReview(null); setValidation(null); setPublished(result.revisionNumber);
  });
  const addQuestion = () => {
    changeQuestions([...bank.questions, { id: Math.min(0, ...bank.questions.map((question) => question.id)) - 1, question: '', options: ['', '', '', ''], correctIndex: 0, explanation: '', difficulty: 'medium', learningObjective: '' }]);
    setSelectedIndex(bank.questions.length);
  };

  const questions = bank?.questions || [];
  const index = Math.min(selectedIndex, Math.max(0, questions.length - 1));
  const question = questions[index];
  const needsFix = questions.filter((item) => questionProblems(item).length).length;
  const composition = Object.keys(difficultyNames).map((key) => ({ key, label: difficultyNames[key], count: questions.filter((item) => (item.difficulty || 'medium') === key).length }));
  const steps = [
    { label: 'Simpan draf', state: editor.dirty ? 'current' : 'done' },
    { label: 'Validasi', state: editor.dirty ? 'todo' : validation?.valid ? 'done' : 'current' },
    { label: 'Terbitkan', state: published ? 'done' : validation?.valid && !editor.dirty ? 'current' : 'todo' },
  ];

  return <AdminPageFrame title="Bank ujian akhir" description="Susun, validasi, dan terbitkan soal untuk percobaan ujian berikutnya." back={{ to: '/admin/courses', label: 'Course' }} actions={<Link className="btn btn-secondary" to="/admin/curriculum/policies"><Ic name="route" />Kebijakan kurikulum</Link>}>
    {!bank ? editor.query.error ? <AdminError error={editor.query.error} onRetry={editor.query.refetch} /> : <AdminLoading /> : <form onSubmit={save} className="aapm-curriculum-editor stack gap-grid min-w-0">
      <CurriculumActionBar
        primaryKey={primary}
        steps={steps}
        status={editor.busy ? 'Memproses…' : editor.dirty ? 'Ada perubahan belum disimpan' : `Draf versi ${bank.draftVersion} tersimpan`}
        summary={<div className="stack"><span className="t-caption t-muted">Status</span><span className="t-support t-strong t-num">Draf versi {bank.draftVersion} · {bank.publishedRevision ? `Revisi terbit ${bank.publishedRevision.revisionNumber}` : 'Belum diterbitkan'} · {questions.length} soal{editor.dirty ? ' · belum disimpan' : ''}</span></div>}
        actions={[
          { id: 'preview', label: 'Pratinjau', disabled: editor.busy, onSelect: () => setPreview(true) },
          { id: 'reload', label: 'Muat ulang', disabled: editor.busy, onSelect: () => setReloadOpen(true) },
          { id: 'validate', label: 'Validasi', disabled: editor.busy || editor.dirty, onSelect: () => validate() },
          { id: 'publish', label: 'Terbitkan', disabled: editor.busy || editor.dirty, locked: !validation?.valid, onSelect: () => validate(true) },
          { id: 'save', type: 'submit', label: 'Simpan draf', disabled: editor.busy || !editor.dirty || editor.error?.code === 'revision_conflict', onSelect: save },
        ]}
      />
      <div className="alert alert-info" role="note"><Ic name="info" /><p><span className="alert-title">Draf hanya terlihat oleh pengelola.</span> Simpan draf tidak mengubah soal peserta. Percobaan yang sudah dimulai, jawaban, nilai, dan bukti sertifikat tetap memakai rekaman sebelumnya.</p></div>
      <CurriculumDraftFeedback error={editor.error} validation={validation} onReload={() => setReloadOpen(true)} busy={editor.busy} />
      {published && <div className="alert alert-success" role="status"><Ic name="check-circle" /><p><span className="alert-title">Revisi {published} diterbitkan.</span> Percobaan baru kini menggunakan bank soal ini. Rekaman percobaan sebelumnya tetap tersimpan.</p></div>}
      {questions.length === 0 && <div className="alert alert-warning" role="status"><Ic name="alert" /><p><span className="alert-title">Draf belum memiliki soal.</span> Tambahkan minimal satu soal yang valid sebelum menerbitkan.</p></div>}

      <fieldset disabled={editor.busy} className="row-start wrap gap-grid" style={{ margin: 0, padding: 0, border: 0, minWidth: 0 }}>
        <div className="stack gap-grid" style={{ flex: '999 1 440px', minWidth: 0 }}>
          <section className="card" aria-labelledby="h-soal">
            <div className="card-pad card-head">
              <div className="stack gap-0-5">
                <div className="row wrap gap-2"><h2 className="card-title" id="h-soal">Soal di draf</h2><span className="chip t-num">{questions.length} soal</span>{needsFix ? <span className="chip chip-warning"><Ic name="alert" />{needsFix} perlu diperbaiki</span> : null}</div>
                <p className="card-desc">Pilihan ganda untuk percobaan ujian berikutnya.</p>
              </div>
            </div>
            {questions.length ? <ol className="list card-sect" aria-label="Daftar soal ujian akhir">
              {questions.map((item, itemIndex) => {
                const problems = questionProblems(item);
                const current = itemIndex === index;
                return <li key={item.id} className={`li${current ? ' card-tint wrap' : ''}`} aria-current={current ? 'true' : undefined} style={current ? { rowGap: 4, paddingTop: 12, paddingBottom: 12 } : undefined}>
                  <span className={`tile tile-sm t-support t-strong t-num${current ? ' tile-solid' : ''}`}>{itemIndex + 1}</span>
                  <div className="stack" style={{ flex: '1 1 0', minWidth: 0 }}>
                    <span className="li-title t-clamp-2">{item.question || <span className="t-muted">Pertanyaan belum diisi</span>}</span>
                    <span className="li-meta">{item.options.length} opsi{problems.includes('Jawaban benar belum dipilih') ? '' : ` · jawaban ${LETTERS[item.correctIndex]}`} · {difficultyNames[item.difficulty] || 'Sedang'}</span>
                  </div>
                  {problems.length ? <><Ic name="alert" className="t-warning" /><span className="sr-only">Perlu diperbaiki</span></> : <><Ic name="check-circle" className="t-success" /><span className="sr-only">Valid</span></>}
                  <button type="button" className="btn btn-ghost btn-sm btn-icon btn-quiet" aria-label={`Edit soal ${itemIndex + 1}`} onClick={() => setSelectedIndex(itemIndex)}><Ic name="edit" /></button>
                  <button type="button" className="btn btn-ghost btn-sm btn-icon btn-quiet" aria-label={`Hapus soal ${itemIndex + 1} dari draf`} onClick={() => setRemove(itemIndex)}><Ic name="trash" /></button>
                  {current && problems.length ? <span className="row wrap gap-1" style={{ flexBasis: '100%', paddingLeft: 44 }}>{problems.map((problem) => <span key={problem} className="chip chip-warning">{problem}</span>)}</span> : null}
                </li>;
              })}
            </ol> : null}
            <div className="card-foot"><button type="button" className="btn btn-secondary btn-sm" onClick={addQuestion}><Ic name="plus" />Tambah soal</button></div>
          </section>
          <section className="card card-pad stack gap-4" aria-labelledby="h-komposisi">
            <div className="stack gap-0-5"><h2 className="card-title" id="h-komposisi">Komposisi kesulitan</h2><p className="card-desc">Dihitung dari {questions.length} soal di draf.</p></div>
            <div className="cgrid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
              {composition.map((item) => <div key={item.key} className="inset stack gap-0-5" style={{ padding: '10px 12px' }}><span className="t-caption t-muted">{item.label}</span><span className="t-heading t-num">{item.count}</span></div>)}
            </div>
          </section>
        </div>

        {question ? <section className="card" aria-labelledby="h-edit" style={{ flex: '1 1 420px', maxWidth: 420, minWidth: 0 }}>
          <div className="card-pad stack gap-0-5"><h2 className="card-title" id="h-edit">Edit soal {index + 1}</h2><p className="card-desc">Pilihan ganda · 2–6 opsi.</p></div>
          <div className="card-pad card-sect stack gap-5">
            <div className="field">
              <label className="label" htmlFor={`question-${index}`}><span>Pertanyaan <span className="req" aria-hidden="true">*</span></span></label>
              <textarea className="textarea" id={`question-${index}`} rows={3} required value={question.question} onChange={(event) => update(index, { question: event.target.value })} />
            </div>
            <div className="field">
              <span className="label" id={`lbl-opsi-${index}`}><span>Opsi jawaban <span className="req" aria-hidden="true">*</span></span><span className="opt">Tandai satu jawaban benar</span></span>
              <div className="stack gap-2" role="radiogroup" aria-labelledby={`lbl-opsi-${index}`}>
                {question.options.map((option, optionIndex) => <div key={optionIndex} className="row gap-3">
                  <label className="check"><input type="radio" name={`benar-${question.id}`} checked={question.correctIndex === optionIndex} onChange={() => update(index, { correctIndex: optionIndex })} aria-label={`Jawaban benar: opsi ${LETTERS[optionIndex]}`} /></label>
                  <div className="input grow"><span className="t-caption t-strong t-muted">{LETTERS[optionIndex]}</span><input id={`option-${index}-${optionIndex}`} type="text" required value={option} aria-label={`Opsi ${LETTERS[optionIndex]}`} onChange={(event) => update(index, { options: question.options.map((value, i) => i === optionIndex ? event.target.value : value) })} /></div>
                  <button type="button" className="btn btn-ghost btn-sm btn-icon btn-quiet" aria-label={`Hapus opsi ${LETTERS[optionIndex]}`} disabled={question.options.length <= 2} onClick={() => update(index, { options: question.options.filter((_, i) => i !== optionIndex), correctIndex: question.correctIndex === optionIndex ? 0 : question.correctIndex > optionIndex ? question.correctIndex - 1 : question.correctIndex })}><Ic name="x" /></button>
                </div>)}
              </div>
              <div className="row"><button type="button" className="btn btn-ghost btn-sm" disabled={question.options.length >= 6} onClick={() => update(index, { options: [...question.options, ''] })}><Ic name="plus" />Tambah opsi</button></div>
            </div>
            <div className="field">
              <label className="label" htmlFor={`difficulty-${index}`}>Kesulitan</label>
              <select className="select" id={`difficulty-${index}`} value={question.difficulty || 'medium'} onChange={(event) => update(index, { difficulty: event.target.value })}>
                {question.difficulty && !difficultyNames[question.difficulty] ? <option value={question.difficulty}>{`Nilai lama: ${question.difficulty}`}</option> : null}
                {Object.entries(difficultyNames).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
              {question.difficulty && !difficultyNames[question.difficulty] ? <span className="hint">Nilai lama ini akan menjadi Sedang saat draf disimpan. Pilih kesulitan lain bila diperlukan.</span> : null}
            </div>
            <div className="field">
              <label className="label" htmlFor={`explanation-${index}`}>Pembahasan<span className="opt">Opsional</span></label>
              <textarea className="textarea" id={`explanation-${index}`} rows={3} value={question.explanation || ''} onChange={(event) => update(index, { explanation: event.target.value })} />
            </div>
            <div className="field">
              <label className="label" htmlFor={`objective-${index}`}>Tujuan pembelajaran<span className="opt">Opsional</span></label>
              <div className="input"><input id={`objective-${index}`} type="text" value={question.learningObjective || ''} onChange={(event) => update(index, { learningObjective: event.target.value })} /></div>
            </div>
          </div>
        </section> : null}
      </fieldset>
    </form>}
    <ReloadDraftDialog open={reloadOpen} onOpenChange={setReloadOpen} busy={editor.busy} onConfirm={async () => { setReloadOpen(false); if (await editor.reload()) { setValidation(null); setReview(null); setPublished(null); } }} />
    <ConfirmDialog open={remove !== null} onOpenChange={(open) => !open && setRemove(null)} title="Hapus soal dari draf?" description="Soal pada revisi terbit dan percobaan peserta tetap tersimpan. Penghapusan baru berlaku untuk percobaan baru setelah draf diterbitkan." confirmLabel="Hapus dari draf" onConfirm={() => { changeQuestions(bank.questions.filter((_, i) => i !== remove)); setSelectedIndex((current) => Math.max(0, current > remove ? current - 1 : current)); setRemove(null); }} />
    <ConfirmDialog open={Boolean(review)} onOpenChange={(open) => !editor.busy && !open && setReview(null)} title="Terbitkan bank ujian akhir?" description={`Draf versi ${review?.version} berisi ${review?.count} soal akan menjadi revisi ${(bank?.publishedRevision?.revisionNumber || 0) + 1}. Percobaan baru menggunakan soal ini. Percobaan yang telah dimulai dan bukti akademik tetap menggunakan rekaman sebelumnya.`} confirmLabel="Terbitkan" loading={editor.busy} onConfirm={publish} />
    <Dialog open={preview} onOpenChange={setPreview}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>Pratinjau draf ujian akhir</DialogTitle><DialogDescription>Pratinjau pengelola, termasuk isian yang belum disimpan. Jawaban benar disembunyikan di pratinjau ini.</DialogDescription></DialogHeader>
        <ol className="stack gap-4" style={{ marginTop: 'var(--s-4)' }}>{bank?.questions.map((item, itemIndex) => <li key={item.id} className="card card-pad stack gap-2">
          <p className="t-body t-strong" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{itemIndex + 1}. {item.question}</p>
          <ol className="stack gap-1-5">{item.options.map((option, optionIndex) => <li key={optionIndex} className="choice" style={{ minHeight: 0, padding: '8px 12px' }}><span className="choice-key">{LETTERS[optionIndex]}</span><span style={{ overflowWrap: 'anywhere' }}>{option}</span></li>)}</ol>
        </li>)}</ol>
      </DialogContent>
    </Dialog>
  </AdminPageFrame>;
}
