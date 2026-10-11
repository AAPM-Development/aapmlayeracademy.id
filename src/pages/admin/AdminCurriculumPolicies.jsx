// @ts-nocheck
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { nativeApi } from '@/api/nativeClient';
import { OverflowMenu } from '@/design-system';
import { AdminError, AdminLoading, AdminPageFrame } from '@/components/admin/AdminPage';
import { CurriculumActionBar, CurriculumDraftFeedback, ReloadDraftDialog } from '@/components/admin/CurriculumDraftFeedback';
import { useCurriculumDraft } from '@/lib/useCurriculumDraft';
import { curriculumPrimaryAction, movePolicyModule, nextPolicyVersion, policyPayload } from '@/lib/policyEditorState';
import { Ic } from '@/design-system/canvas';

const policiesApi = nativeApi.admin.curriculum.policies;
const statusNames = { active: 'Aktif', superseded: 'Riwayat tetap', draft: 'Draf', ready: 'Siap ditinjau operator' };
const statusChip = { active: 'chip-success', superseded: 'chip-outline', draft: 'chip-warning', ready: 'chip-info' };
const TIER_HUES = ['green', 'teal', 'blue', 'violet', 'rose', 'gold'];
const MODULES_SHOWN = 8;
const versionLabel = (version) => String(version || '').replace(/^academy-v(\d+)$/i, 'Academy v$1');

export default function AdminCurriculumPolicies() {
  const list = useQuery({ queryKey: ['admin', 'curriculum', 'policies'], queryFn: policiesApi.list });
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const policies = list.data?.policies || [];
  const version = selected || policies.find((policy) => policy.status === 'active')?.version;
  const current = policies.find((policy) => policy.version === version);
  const create = async () => {
    if (creating) return;
    setCreating(true); setCreateError(null);
    try { const { policy } = await policiesApi.create(nextPolicyVersion(policies)); await list.refetch(); setSelected(policy.version); }
    catch (error) { setCreateError(error); }
    finally { setCreating(false); }
  };
  return <AdminPageFrame title="Kebijakan kurikulum" description="Atur persyaratan belajar untuk angkatan baru melalui kebijakan berversi." back={{ to: '/admin/courses', label: 'Course' }}
    actions={<Link className="btn btn-secondary" to="/admin/curriculum/final-bank"><Ic name="exam" />Bank ujian akhir</Link>}>
    {list.isLoading ? <AdminLoading /> : list.error ? <AdminError error={list.error} onRetry={list.refetch} /> : <>
      <section className="card anim-rise" aria-label="Versi kebijakan">
        <div className="card-pad row wrap items-end aapm-curriculum-policy-controls" style={{ gap: '12px 16px' }}>
          <div className="field" style={{ flex: '1 1 260px', maxWidth: 340 }}>
            <label className="label" htmlFor="policy-version">Versi kebijakan</label>
            <select className="select" id="policy-version" value={version || ''} disabled={editorDirty || creating} onChange={(event) => setSelected(event.target.value)}>
              {policies.map((policy) => <option key={policy.version} value={policy.version}>{versionLabel(policy.version)} · {statusNames[policy.status]}</option>)}
            </select>
          </div>
          <div className="row wrap grow" style={{ gap: '4px 8px', minHeight: 40 }}>
            {current ? <span className={`chip chip-dot ${statusChip[current.status] || ''}`}>{statusNames[current.status]}</span> : null}
            {current ? <span className="t-support t-muted">{current.draftVersion ? `Draf versi ${current.draftVersion} · ` : ''}{current.assignedLearners ?? 0} akun mengikuti</span> : null}
          </div>
          <div className="row" style={{ minHeight: 40 }}>
            <button type="button" className={`btn ${editorDirty || current?.status === 'draft' ? 'btn-secondary' : 'btn-primary'} btn-sm`} disabled={creating || editorDirty} onClick={create}><Ic name="plus" />{creating ? 'Membuat draf…' : `Buat draf ${versionLabel(nextPolicyVersion(policies))}`}</button>
          </div>
        </div>
        {editorDirty ? <p className="t-caption t-muted" style={{ padding: '0 var(--card-pad) 12px' }}>Simpan atau muat ulang isian sebelum berpindah versi.</p> : null}
        {createError ? <div className="alert alert-warning" role="alert" style={{ margin: '0 var(--card-pad) 12px' }}><Ic name="alert" /><p><span className="alert-title">Draf belum dibuat.</span> {createError.message}</p></div> : null}
        <div className="card-foot wrap" style={{ gap: 8 }}>
          <span className="t-caption t-muted" id="legend-label">Status versi</span>
          <ul className="row wrap gap-2" aria-labelledby="legend-label">
            <li className="chip chip-success chip-dot">Aktif</li>
            <li className="chip chip-warning chip-dot">Draf</li>
            <li className="chip chip-info chip-dot">Siap ditinjau</li>
            <li className="chip chip-outline chip-dot">Riwayat</li>
          </ul>
        </div>
      </section>
      {version && <PolicyEditor key={version} version={version} onDirty={setEditorDirty} onSaved={() => list.refetch()} />}
    </>}
  </AdminPageFrame>;
}

function ContractNote() {
  const [open, setOpen] = useState(false);
  return <div className="alert alert-info" style={{ alignItems: open ? 'flex-start' : 'center' }}>
    <Ic name="info" />
    <div className="stack gap-2 grow">
      <div className="row between gap-3"><p className="grow">Kontrak belajar setiap peserta tetap tersimpan.</p><button type="button" className="btn btn-sm btn-link" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? 'Tutup' : 'Pelajari'}</button></div>
      {open ? <p className="t-support">Peserta lama tetap mengikuti kebijakan yang ditetapkan saat pendaftaran. Perubahan mode asesmen, modul wajib, ambang kelulusan, dan tingkat sertifikat berlaku melalui versi baru. Kesiapan draf belum mengaktifkan kebijakan; aktivasi dilakukan operator melalui proses server yang diaudit.</p> : null}
    </div>
  </div>;
}

function PolicyEditor({ version, onDirty, onSaved }) {
  const editor = useCurriculumDraft(['admin', 'curriculum', 'policy', version], () => policiesApi.detail(version).then((value) => value.policy));
  const catalogue = useQuery({ queryKey: ['admin', 'courses', 'layer-farm-management'], queryFn: () => nativeApi.admin.courses.detail('layer-farm-management') });
  const [validation, setValidation] = useState(null);
  const [reloadOpen, setReloadOpen] = useState(false);
  const [addNumber, setAddNumber] = useState('');
  const [showAll, setShowAll] = useState(false);
  React.useEffect(() => { onDirty(editor.dirty || editor.busy); return () => onDirty(false); }, [editor.dirty, editor.busy, onDirty]);
  if (!editor.draft) return editor.query.error ? <AdminError error={editor.query.error} onRetry={editor.query.refetch} /> : <AdminLoading />;
  const policy = editor.draft;
  const immutable = !['draft', 'ready'].includes(policy.status);
  const disabled = immutable || editor.busy;
  const primary = curriculumPrimaryAction({ dirty: editor.dirty, valid: validation?.valid, ready: policy.status === 'ready' });
  const modules = (catalogue.data?.curriculum || []).flatMap((chapter) => chapter.modules || []);
  const available = modules.filter((module) => !policy.modules.some((member) => member.moduleNumber === module.moduleNumber));
  const change = (patch) => { editor.setDraft({ ...policy, ...patch }); setValidation(null); };
  const changeMember = (index, patch) => change({ modules: policy.modules.map((member, i) => i === index ? { ...member, ...patch } : member) });
  const changeTier = (index, patch) => change({ tiers: policy.tiers.map((tier, i) => i === index ? { ...tier, ...patch } : tier) });
  const save = () => editor.run(async () => { const result = await policiesApi.save(version, policyPayload(policy), policy.draftVersion); editor.accept(result.policy); setValidation(null); onSaved(); });
  const validate = () => editor.run(async () => { const result = await policiesApi.validate(version, policy.draftVersion); setValidation(result); if (!result.valid) { editor.accept({ ...policy, status: 'draft', validatedAt: null }); onSaved(); } return result; });
  const ready = () => editor.run(async () => { const result = await policiesApi.ready(version, policy.draftVersion); editor.accept(result.policy); onSaved(); });
  const visibleMembers = showAll ? policy.modules : policy.modules.slice(0, MODULES_SHOWN);
  const steps = [
    { label: 'Simpan draf', state: editor.dirty ? 'current' : 'done' },
    { label: 'Validasi', state: editor.dirty ? 'todo' : validation?.valid || policy.status === 'ready' ? 'done' : 'current' },
    { label: 'Tandai siap', state: policy.status === 'ready' ? 'done' : validation?.valid && !editor.dirty ? 'current' : 'todo' },
  ];

  return <div className={`stack gap-grid min-w-0 ${immutable ? '' : 'aapm-curriculum-editor'}`}>
    {!immutable && <CurriculumActionBar primaryKey={primary} steps={steps} status={editor.busy ? 'Memproses…' : editor.dirty ? 'Ada perubahan belum disimpan' : `Draf versi ${policy.draftVersion} tersimpan`} actions={[
      { id: 'reload', label: 'Muat ulang', disabled: editor.busy, onSelect: () => setReloadOpen(true) },
      { id: 'validate', label: 'Validasi', disabled: editor.busy || editor.dirty, onSelect: validate },
      { id: 'publish', label: 'Tandai siap', disabled: editor.busy || editor.dirty || !validation?.valid || policy.status === 'ready', locked: !validation?.valid, onSelect: ready },
      { id: 'save', label: 'Simpan draf', disabled: editor.busy || !editor.dirty || editor.error?.code === 'revision_conflict', onSelect: save },
    ]} />}
    <ContractNote />
    {immutable && <div className="alert" role="note"><Ic name="lock" className="t-muted" /><p><span className="alert-title">Kebijakan ini hanya dapat dibaca.</span> Buat versi berikutnya untuk mengubah persyaratan. Penetapan peserta dan bukti sertifikat yang sudah terbit tetap dipertahankan.</p></div>}
    <CurriculumDraftFeedback error={editor.error} validation={validation} onReload={() => setReloadOpen(true)} busy={editor.busy} />

    <section className="card anim-rise" style={/** @type {React.CSSProperties} */ ({ '--i': 1 })} aria-labelledby="mods-title">
      <div className="card-pad card-head">
        <div className="stack gap-0-5"><h2 className="card-title" id="mods-title">Modul dan mode asesmen</h2><p className="card-desc">Urutan di sini menjadi urutan belajar peserta. Kuis membutuhkan bank soal terbit yang valid; konfirmasi belajar memakai pengakuan belajar peserta.</p></div>
        <span className="chip">{policy.modules.length} modul</span>
      </div>
      <div className="table-wrap rel">
        <table className="table">
          <thead>
            <tr>
              <th scope="col" style={{ width: '1%' }}>Urutan</th>
              <th scope="col">Modul</th>
              <th scope="col" style={{ width: '1%' }}>Wajib</th>
              <th scope="col" style={{ width: 220 }}>Mode asesmen</th>
              {!immutable ? <th scope="col" className="act"><span className="sr-only">Aksi</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {visibleMembers.map((member, index) => {
              const title = modules.find((module) => module.moduleNumber === member.moduleNumber)?.title;
              return <tr key={member.moduleNumber}>
                <td className="t-num t-muted">{index + 1}</td>
                <td><span className="t-clamp-1"><span className="t-num t-medium">{member.moduleNumber}</span>{title ? ` · ${title}` : ''}</span></td>
                <td><label className="check" style={{ display: 'flex' }}><input type="checkbox" checked={member.required} disabled={disabled} onChange={(event) => changeMember(index, { required: event.target.checked })} /><span className="sr-only">Modul {member.moduleNumber} wajib</span></label></td>
                <td>
                  <label className="sr-only" htmlFor={`mode-${member.moduleNumber}`}>Mode asesmen Modul {member.moduleNumber}</label>
                  <select className="select select-sm" id={`mode-${member.moduleNumber}`} disabled={disabled} value={member.assessmentMode} onChange={(event) => changeMember(index, { assessmentMode: event.target.value })}>
                    <option value="quiz">Kuis</option><option value="acknowledgement">Konfirmasi belajar</option>
                  </select>
                </td>
                {!immutable ? <td className="act">
                  <OverflowMenu label={`Aksi untuk Modul ${member.moduleNumber}: naik, turun, keluarkan`} items={[
                    { id: 'up', label: 'Naikkan', icon: 'arrowUp', disabled: disabled || index === 0, onSelect: () => change({ modules: movePolicyModule(policy.modules, index, -1) }) },
                    { id: 'down', label: 'Turunkan', icon: 'arrowDown', disabled: disabled || index === policy.modules.length - 1, onSelect: () => change({ modules: movePolicyModule(policy.modules, index, 1) }) },
                    { id: 'remove', label: 'Keluarkan', icon: 'close', tone: 'danger', disabled, onSelect: () => change({ modules: policy.modules.filter((_, i) => i !== index) }) },
                  ]} />
                </td> : null}
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      {policy.modules.length > MODULES_SHOWN || !immutable ? <div className="card-foot wrap between" style={{ gap: 12 }}>
        {policy.modules.length > MODULES_SHOWN ? <div className="row gap-3">
          <span className="t-support t-muted">{showAll ? 'Semua modul ditampilkan' : `${policy.modules.length - MODULES_SHOWN} modul lainnya`}</span>
          <button type="button" className="btn btn-ghost btn-sm" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>{showAll ? 'Ringkas' : 'Tampilkan semua'}<Ic name={showAll ? 'chev-up' : 'chev-down'} /></button>
        </div> : <span />}
        {!immutable ? <div className="row wrap gap-2">
          <label className="sr-only" htmlFor="add-module">Pilih modul untuk ditambahkan</label>
          <select className="select select-sm" id="add-module" style={{ flex: '0 1 320px' }} value={addNumber} disabled={disabled} onChange={(event) => setAddNumber(event.target.value)}>
            <option value="">Pilih modul</option>
            {available.map((module) => <option value={String(module.moduleNumber)} key={module.id}>{module.moduleNumber} · {module.title}</option>)}
          </select>
          <button type="button" className="btn btn-secondary btn-sm" disabled={disabled || !addNumber} onClick={() => { change({ modules: [...policy.modules, { moduleNumber: Number(addNumber), required: false, assessmentMode: 'quiz' }] }); setAddNumber(''); }}><Ic name="plus" />Tambahkan modul</button>
        </div> : null}
      </div> : null}
      {catalogue.error && <div className="card-sect card-pad"><AdminError error={catalogue.error} onRetry={catalogue.refetch} /></div>}
    </section>

    <section className="card anim-rise" style={/** @type {React.CSSProperties} */ ({ '--i': 2 })} aria-labelledby="grad-title">
      <div className="card-pad"><div className="stack gap-0-5"><h2 className="card-title" id="grad-title">Kelulusan dan sertifikat</h2><p className="card-desc">Ambang nilai dan persyaratan untuk enam tingkat sertifikat.</p></div></div>
      <div className="stack gap-5" style={{ padding: '0 var(--card-pad) var(--card-pad)' }}>
        <div className="form-grid" style={{ maxWidth: 600 }}>
          {[['modulePassPercent', 'Ambang lulus kuis', 'Berlaku untuk kuis setiap modul.'], ['finalPassPercent', 'Ambang lulus ujian akhir', 'Syarat sertifikat Tingkat 6.']].map(([key, label, hint]) => <div className="field" key={key}>
            <label className="label" htmlFor={key}>{label}</label>
            <div className="input"><input id={key} type="number" min="50" max="100" inputMode="numeric" value={policy[key]} disabled={disabled} onChange={(event) => change({ [key]: Number(event.target.value) })} /><span className="vr" style={{ alignSelf: 'center', height: 22 }} /><span className="t-caption t-muted none">%</span></div>
            <span className="hint">{hint}</span>
          </div>)}
        </div>
      </div>
      <div className="table-wrap rel card-sect">
        <table className="table">
          <thead><tr><th scope="col" style={{ width: '1%' }}>Tingkat</th><th scope="col" style={{ width: 280 }}>Nama sertifikat</th><th scope="col">Modul wajib</th><th scope="col" style={{ width: '1%' }}>Ujian akhir</th></tr></thead>
          <tbody>
            {policy.tiers.map((tier, index) => <tr key={tier.tierNumber} data-hue={TIER_HUES[(tier.tierNumber - 1) % 6]}>
              <td><span className="row gap-3"><span className="medal medal-sm" aria-hidden="true">{tier.requiresFinal ? <Ic name="award" /> : tier.tierNumber}</span><span className="t-medium t-nowrap">Tingkat {tier.tierNumber}</span></span></td>
              <td><label className="sr-only" htmlFor={`tier-name-${index}`}>Nama sertifikat Tingkat {tier.tierNumber}</label><div className={`input${tier.tierName?.trim() ? '' : ' is-invalid'}`}><input id={`tier-name-${index}`} type="text" placeholder="Nama sertifikat" value={tier.tierName} disabled={disabled} aria-invalid={!tier.tierName?.trim() || undefined} onChange={(event) => changeTier(index, { tierName: event.target.value })} /></div></td>
              <td><label className="sr-only" htmlFor={`tier-modules-${index}`}>Modul wajib Tingkat {tier.tierNumber} (nomor dipisahkan koma)</label><div className="input"><input id={`tier-modules-${index}`} type="text" inputMode="numeric" placeholder="1, 2, 3" value={tier.modulesText ?? tier.modules.join(', ')} disabled={disabled} onChange={(event) => changeTier(index, { modulesText: event.target.value, modules: event.target.value.split(',').filter((value) => value.trim()).map(Number) })} /></div></td>
              <td><label className="check" style={{ display: 'flex' }}><input type="checkbox" checked={tier.requiresFinal} disabled={disabled} onChange={(event) => changeTier(index, { requiresFinal: event.target.checked })} /><span className="sr-only">Tingkat {tier.tierNumber} wajib ujian akhir</span></label></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>
    <ReloadDraftDialog open={reloadOpen} onOpenChange={setReloadOpen} busy={editor.busy} onConfirm={async () => { setReloadOpen(false); if (await editor.reload()) setValidation(null); }} />
  </div>;
}
