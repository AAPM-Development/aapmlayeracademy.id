import React from 'react';
import { Button, ConfirmDialog, OverflowMenu } from '@/design-system';
import { draftFailure } from '@/lib/policyEditorState';
import { Ic } from '@/design-system/canvas';

export function CurriculumDraftFeedback({ error, validation, onReload, busy }) {
  return <div className="stack gap-3" aria-live="polite">
    {error && <div className="alert alert-warning" role="alert">
      <Ic name="alert" />
      <div className="stack gap-2 grow">
        <p><span className="alert-title">{error.code === 'revision_conflict' ? 'Konflik versi draf.' : 'Perubahan belum selesai.'}</span> {draftFailure(error)}</p>
        <div className="row"><button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={onReload}><Ic name="refresh" />Muat ulang draf terbaru</button></div>
      </div>
    </div>}
    {validation && (validation.valid
      ? <div className="alert alert-success" role="status"><Ic name="check-circle" /><p><span className="alert-title">Validasi berhasil.</span> Draf versi {validation.draftVersion} memenuhi persyaratan saat pemeriksaan.</p></div>
      : <div className="alert alert-danger" role="alert">
        <Ic name="alert" />
        <div className="stack gap-1">
          <p className="alert-title">Periksa persyaratan berikut</p>
          <ul className="stack gap-1">{validation.errors.map((item, index) => <li key={index} className="row-start gap-2"><Ic name="x-circle" size="xs" className="t-danger" style={{ marginTop: 3 }} /><span>{item.message}</span></li>)}</ul>
        </div>
      </div>)}
  </div>;
}

export function ReloadDraftDialog({ open, onOpenChange, onConfirm, busy }) {
  return <ConfirmDialog open={open} onOpenChange={onOpenChange} title="Muat ulang draf?"
    description="Isian yang belum disimpan akan diganti dengan draf terbaru dari server. Salin perubahan yang ingin dipertahankan sebelum melanjutkan."
    confirmLabel="Muat ulang" loading={busy} onConfirm={onConfirm} />;
}

const ACTION_ICON = { save: 'check', validate: 'check-circle', reload: 'refresh', preview: 'eye' };

/**
 * Canvas lifecycle bar (`.lifecycle`): save state, the three-step flow and
 * the draft actions. Desktop keeps it sticky under the page header; the
 * shell keeps its phone navigation, so phones show one current action above
 * it and the rest in a menu.
 */
export function CurriculumActionBar({ actions, primaryKey, status, steps = null, tone = null, summary = null }) {
  const barRef = React.useRef(null);
  React.useEffect(() => {
    const bar = barRef.current;
    if (!bar) return undefined;
    const content = bar.closest('.aapm-curriculum-editor');
    const root = document.documentElement;
    const update = () => {
      const rect = bar.getBoundingClientRect();
      content?.style.setProperty('--aapm-curriculum-footer-height', `${rect.height}px`);
      const offset = window.matchMedia('(max-width: 859px)').matches && rect.bottom > 0 && rect.top < window.innerHeight ? Math.max(0, window.innerHeight - rect.top) : 0;
      const changed = root.style.getPropertyValue('--aapm-shell-footer-offset') !== `${offset}px`;
      root.style.setProperty('--aapm-shell-footer-offset', `${offset}px`);
      root.dataset.shellFooter = 'true';
      if (changed) document.dispatchEvent(new Event('aapm:footer-resize'));
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
  const chip = tone || (/belum disimpan/i.test(status) ? 'chip-warning' : /memproses/i.test(status) ? 'chip-ai' : 'chip-success');
  return <div ref={barRef} className="lifecycle aapm-curriculum-actionbar" role="region" aria-label="Aksi draf kurikulum">
    {summary || <span role="status" className={`chip chip-lg chip-dot ${chip} aapm-curriculum-actionbar__status`}>{status}</span>}
    {summary ? <span role="status" className="sr-only aapm-curriculum-actionbar__status">{status}</span> : null}
    {steps ? <div className="row grow justify-center hide-sm">
      <div className="flow" role="group" aria-label="Alur penerbitan" style={{ width: 400, maxWidth: '100%' }}>
        {steps.map((step, index) => <React.Fragment key={step.label}>
          {index ? <span className={`flow-line${steps[index - 1].state === 'done' ? ' is-done' : ''}`} /> : null}
          <span className={`flow-step${step.state === 'done' ? ' is-done' : step.state === 'current' ? ' is-current' : ''}`} aria-current={step.state === 'current' ? 'step' : undefined}>
            <span className="flow-dot">{step.state === 'done' ? <Ic name="check" /> : index + 1}</span><span className="flow-label">{step.label}</span>
          </span>
        </React.Fragment>)}
      </div>
    </div> : <span className="grow" />}
    <div className="row wrap gap-2 aapm-curriculum-actionbar__desktop">{actions.map((action) => {
      const quiet = action.id === 'reload' || action.id === 'preview';
      return <Button key={action.id} type={action.type} size={quiet ? 'sm' : undefined} variant={action.id === primaryKey ? 'primary' : quiet ? 'ghost' : 'secondary'} disabled={action.disabled} onClick={action.type === 'submit' ? undefined : action.onSelect}>
        {action.locked ? <Ic name="lock" /> : ACTION_ICON[action.id] ? <Ic name={ACTION_ICON[action.id]} /> : null}{action.label}
      </Button>;
    })}</div>
    <div className="aapm-curriculum-actionbar__mobile">
      {primary ? <Button className="aapm-curriculum-actionbar__primary" type={primary.type} disabled={primary.disabled} onClick={primary.type === 'submit' ? undefined : primary.onSelect}>{primary.label}</Button> : <span className="t-caption t-muted grow">Siap ditinjau operator</span>}
      <OverflowMenu label="Aksi draf lainnya" size="md" items={actions.filter((action) => action.id !== primaryKey)} />
    </div>
  </div>;
}
