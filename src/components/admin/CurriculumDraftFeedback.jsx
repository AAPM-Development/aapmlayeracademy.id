import React from 'react';
import { Alert, Button, ConfirmDialog } from '@/design-system';
import { draftFailure } from '@/lib/policyEditorState';

export function CurriculumDraftFeedback({ error, validation, onReload, busy }) {
  return <div className="grid gap-3" aria-live="polite">
    {error && <div role="alert"><Alert tone="warning" title={error.code === 'revision_conflict' ? 'Konflik versi draf' : 'Perubahan belum selesai'} description={draftFailure(error)} />
      <Button className="mt-2" variant="secondary" disabled={busy} onClick={onReload}>Muat ulang draf terbaru</Button></div>}
    {validation && (validation.valid
      ? <Alert tone="success" title="Validasi berhasil" description={`Draf versi ${validation.draftVersion} memenuhi persyaratan saat pemeriksaan.`} />
      : <div role="alert"><Alert tone="warning" title="Periksa persyaratan berikut" /><ul className="list-disc pl-6">{validation.errors.map((item, index) => <li key={index}>{item.message}</li>)}</ul></div>)}
  </div>;
}

export function ReloadDraftDialog({ open, onOpenChange, onConfirm, busy }) {
  return <ConfirmDialog open={open} onOpenChange={onOpenChange} title="Muat ulang draf?"
    description="Isian yang belum disimpan akan diganti dengan draf terbaru dari server. Salin perubahan yang ingin dipertahankan sebelum melanjutkan."
    confirmLabel="Muat ulang" loading={busy} onConfirm={onConfirm} />;
}
