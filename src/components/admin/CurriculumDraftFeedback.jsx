import React from 'react';
import { Alert, Button, ConfirmDialog, OverflowMenu } from '@/design-system';
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

// The shell keeps its phone navigation. Show one current action above it;
// secondary actions remain keyboard-accessible through the existing menu.
export function CurriculumActionBar({ actions, primaryKey, status }) {
  const barRef = React.useRef(null);
  React.useEffect(() => {
    const bar = barRef.current;
    if (!bar) return undefined;
    const content = bar.closest('.aapm-curriculum-editor');
    const root = document.documentElement;
    const update = () => {
      const rect = bar.getBoundingClientRect();
      content?.style.setProperty('--aapm-curriculum-footer-height', `${rect.height}px`);
      const offset = rect.bottom > 0 && rect.top < window.innerHeight ? Math.max(0, window.innerHeight - rect.top) : 0;
      root.style.setProperty('--aapm-shell-footer-offset', `${offset}px`);
      root.dataset.shellFooter = 'true';
    };
    let frame = 0;
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(bar);
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    document.addEventListener('scroll', schedule, true);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
      document.removeEventListener('scroll', schedule, true);
      root.style.removeProperty('--aapm-shell-footer-offset');
      content?.style.removeProperty('--aapm-curriculum-footer-height');
      delete root.dataset.shellFooter;
    };
  }, []);
  const primary = actions.find((action) => action.id === primaryKey);
  return <div ref={barRef} className="aapm-card aapm-curriculum-actionbar" aria-label="Aksi draf kurikulum">
    <div className="aapm-curriculum-actionbar__desktop">{actions.map((action) => <Button key={action.id} type={action.type} variant={action.id === primaryKey ? 'primary' : 'secondary'} disabled={action.disabled} onClick={action.type === 'submit' ? undefined : action.onSelect}>{action.label}</Button>)}</div>
    <div className="aapm-curriculum-actionbar__mobile">
      {primary ? <Button className="aapm-curriculum-actionbar__primary" type={primary.type} disabled={primary.disabled} onClick={primary.type === 'submit' ? undefined : primary.onSelect}>{primary.label}</Button> : <span className="aapm-text-caption flex-1">Siap ditinjau operator</span>}
      <OverflowMenu label="Aksi draf lainnya" size="md" items={actions.filter((action) => action.id !== primaryKey)} />
    </div>
    <span role="status" className="aapm-text-caption aapm-curriculum-actionbar__status">{status}</span>
  </div>;
}
