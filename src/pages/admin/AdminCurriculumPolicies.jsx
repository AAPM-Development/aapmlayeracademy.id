// @ts-nocheck
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { nativeApi } from '@/api/nativeClient';
import { Alert, Badge, Button, Field, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/design-system';
import { AdminError, AdminLoading, AdminPageFrame } from '@/components/admin/AdminPage';
import { CurriculumActionBar, CurriculumDraftFeedback, ReloadDraftDialog } from '@/components/admin/CurriculumDraftFeedback';
import { useCurriculumDraft } from '@/lib/useCurriculumDraft';
import { curriculumPrimaryAction, movePolicyModule, nextPolicyVersion, policyPayload } from '@/lib/policyEditorState';

const policiesApi = nativeApi.admin.curriculum.policies;
const statusNames = { active: 'Aktif', superseded: 'Riwayat tetap', draft: 'Draf', ready: 'Siap ditinjau operator' };

export default function AdminCurriculumPolicies() {
  const list = useQuery({ queryKey: ['admin', 'curriculum', 'policies'], queryFn: policiesApi.list });
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const policies = list.data?.policies || [];
  const version = selected || policies.find((policy) => policy.status === 'active')?.version;
  const create = async () => {
    if (creating) return;
    setCreating(true); setCreateError(null);
    try { const { policy } = await policiesApi.create(nextPolicyVersion(policies)); await list.refetch(); setSelected(policy.version); }
    catch (error) { setCreateError(error); }
    finally { setCreating(false); }
  };
  return <AdminPageFrame title="Kebijakan kurikulum" description="Atur persyaratan belajar untuk angkatan baru melalui kebijakan berversi." back={{ to: '/admin/courses', label: 'Course' }}
    actions={<Button asChild variant="secondary"><Link to="/admin/curriculum/final-bank">Bank ujian akhir</Link></Button>}>
    <Alert tone="info" title="Kontrak belajar setiap peserta tetap tersimpan" description="Peserta lama tetap mengikuti kebijakan yang ditetapkan saat pendaftaran. Perubahan mode asesmen, modul wajib, ambang kelulusan, dan tingkat sertifikat berlaku melalui versi baru. Kesiapan draf belum mengaktifkan kebijakan; aktivasi dilakukan operator melalui proses server yang diaudit." />
    {list.isLoading ? <AdminLoading /> : list.error ? <AdminError error={list.error} onRetry={list.refetch} /> : <>
      <section className="aapm-card grid gap-4 p-5 mt-4" aria-label="Versi kebijakan">
        <div className="aapm-curriculum-policy-controls">
          <Field id="policy-version" label="Versi kebijakan" className="min-w-0 flex-1">
            <Select value={version || ''} onValueChange={setSelected} disabled={editorDirty || creating}><SelectTrigger id="policy-version"><SelectValue /></SelectTrigger><SelectContent>{policies.map((policy) => <SelectItem key={policy.version} value={policy.version}>{policy.version} · {statusNames[policy.status]}</SelectItem>)}</SelectContent></Select>
          </Field>
          <Button variant={editorDirty || ['draft'].includes(policies.find((policy) => policy.version === version)?.status) ? 'secondary' : 'primary'} disabled={creating || editorDirty} onClick={create}>{creating ? 'Membuat draf…' : `Buat draf ${nextPolicyVersion(policies)}`}</Button>
        </div>
        {editorDirty && <p className="aapm-text-caption m-0">Simpan atau muat ulang isian sebelum berpindah versi.</p>}
        {createError && <div role="alert"><Alert tone="warning" title="Draf belum dibuat" description={createError.message} /></div>}
      </section>
      {version && <PolicyEditor key={version} version={version} onDirty={setEditorDirty} onSaved={() => list.refetch()} />}
    </>}
  </AdminPageFrame>;
}

function PolicyEditor({ version, onDirty, onSaved }) {
  const editor = useCurriculumDraft(['admin', 'curriculum', 'policy', version], () => policiesApi.detail(version).then((value) => value.policy));
  const catalogue = useQuery({ queryKey: ['admin', 'courses', 'layer-farm-management'], queryFn: () => nativeApi.admin.courses.detail('layer-farm-management') });
  const [validation, setValidation] = useState(null);
  const [reloadOpen, setReloadOpen] = useState(false);
  const [addNumber, setAddNumber] = useState('');
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
  return <div className={`grid gap-4 mt-4 min-w-0 ${immutable ? '' : 'aapm-curriculum-editor'}`}>
    <div className="flex flex-wrap items-center gap-3"><h2 className="aapm-text-section m-0">{version}</h2><Badge>{statusNames[policy.status]}</Badge><span className="aapm-text-caption">Draf versi {policy.draftVersion} · {policy.assignedLearners} akun mengikuti</span></div>
    {immutable && <Alert tone="info" title="Kebijakan ini hanya dapat dibaca" description="Buat versi berikutnya untuk mengubah persyaratan. Penetapan peserta dan bukti sertifikat yang sudah terbit tetap dipertahankan." />}
    <CurriculumDraftFeedback error={editor.error} validation={validation} onReload={() => setReloadOpen(true)} busy={editor.busy} />
    <section className="aapm-card grid gap-4 p-5" aria-label="Modul dan mode asesmen">
      <h3 className="aapm-text-section m-0">Modul dan mode asesmen</h3>
      <p className="aapm-text-support m-0">Urutan di sini menjadi urutan belajar peserta. Kuis membutuhkan bank soal terbit yang valid. Konfirmasi belajar menggunakan pengakuan belajar peserta, walau soal untuk angkatan sebelumnya tetap tersimpan.</p>
      {policy.modules.map((member, index) => <div key={member.moduleNumber} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
        <div className="min-w-0"><strong>{index + 1}. Modul {member.moduleNumber}</strong><p className="aapm-text-caption m-0 break-words">{modules.find((module) => module.moduleNumber === member.moduleNumber)?.title}</p><label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={member.required} disabled={disabled} onChange={(event) => changeMember(index, { required: event.target.checked })} />Modul wajib</label></div>
        <Field id={`mode-${member.moduleNumber}`} label="Mode asesmen"><Select disabled={disabled} value={member.assessmentMode} onValueChange={(assessmentMode) => changeMember(index, { assessmentMode })}><SelectTrigger id={`mode-${member.moduleNumber}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="quiz">Kuis</SelectItem><SelectItem value="acknowledgement">Konfirmasi belajar</SelectItem></SelectContent></Select></Field>
        {!immutable && <div className="flex flex-wrap gap-1 items-end"><Button size="sm" variant="outline" aria-label={`Naikkan modul ${member.moduleNumber}`} disabled={disabled || index === 0} onClick={() => change({ modules: movePolicyModule(policy.modules, index, -1) })}>Naik</Button><Button size="sm" variant="outline" aria-label={`Turunkan modul ${member.moduleNumber}`} disabled={disabled || index === policy.modules.length - 1} onClick={() => change({ modules: movePolicyModule(policy.modules, index, 1) })}>Turun</Button><Button size="sm" variant="ghost" disabled={disabled} onClick={() => change({ modules: policy.modules.filter((_, i) => i !== index) })} aria-label={`Keluarkan modul ${member.moduleNumber}`}>Keluarkan</Button></div>}
      </div>)}
      {!immutable && <div className="flex flex-wrap items-end gap-3"><Field id="policy-add-module" label="Tambahkan anggota modul" className="flex-1 min-w-0"><Select value={addNumber} onValueChange={setAddNumber} disabled={disabled}><SelectTrigger id="policy-add-module"><SelectValue placeholder="Pilih modul" /></SelectTrigger><SelectContent>{available.map((module) => <SelectItem value={String(module.moduleNumber)} key={module.id}>{module.moduleNumber} · {module.title}</SelectItem>)}</SelectContent></Select></Field><Button variant="secondary" disabled={disabled || !addNumber} onClick={() => { change({ modules: [...policy.modules, { moduleNumber: Number(addNumber), required: false, assessmentMode: 'quiz' }] }); setAddNumber(''); }}>Tambahkan modul</Button></div>}
      {catalogue.error && <AdminError error={catalogue.error} onRetry={catalogue.refetch} />}
    </section>
    <section className="aapm-card grid gap-4 p-5" aria-label="Kelulusan dan sertifikat"><h3 className="aapm-text-section m-0">Kelulusan dan sertifikat</h3>
      <div className="grid gap-4 sm:grid-cols-2">{[['modulePassPercent', 'Ambang lulus kuis (%)'], ['finalPassPercent', 'Ambang lulus ujian akhir (%)']].map(([key, label]) => <Field key={key} id={key} label={label}><Input id={key} type="number" min="50" max="100" value={policy[key]} disabled={disabled} onChange={(event) => change({ [key]: Number(event.target.value) })} /></Field>)}</div>
      {policy.tiers.map((tier, index) => <fieldset disabled={disabled} key={tier.tierNumber} className="grid gap-3 border rounded-xl p-3"><legend className="px-2">Tingkat {tier.tierNumber}</legend><Field id={`tier-name-${index}`} label="Nama sertifikat"><Input id={`tier-name-${index}`} value={tier.tierName} onChange={(event) => changeTier(index, { tierName: event.target.value })} /></Field><Field id={`tier-modules-${index}`} label="Modul wajib tingkat ini" hint="Nomor modul dipisahkan koma, contoh: 1, 2, 3"><Input id={`tier-modules-${index}`} value={tier.modulesText ?? tier.modules.join(', ')} onChange={(event) => changeTier(index, { modulesText: event.target.value, modules: event.target.value.split(',').filter((value) => value.trim()).map(Number) })} /></Field><label className="flex items-center gap-2"><input type="checkbox" checked={tier.requiresFinal} onChange={(event) => changeTier(index, { requiresFinal: event.target.checked })} />Memerlukan ujian akhir</label></fieldset>)}
    </section>
    {!immutable && <CurriculumActionBar primaryKey={primary} status={editor.busy ? 'Memproses…' : editor.dirty ? 'Ada perubahan belum disimpan' : `Draf versi ${policy.draftVersion} tersimpan`} actions={[
      { id: 'save', label: 'Simpan draf', disabled: editor.busy || !editor.dirty || editor.error?.code === 'revision_conflict', onSelect: save },
      { id: 'validate', label: 'Validasi', disabled: editor.busy || editor.dirty, onSelect: validate },
      { id: 'publish', label: 'Tandai siap', disabled: editor.busy || editor.dirty || !validation?.valid || policy.status === 'ready', onSelect: ready },
      { id: 'reload', label: 'Muat ulang', disabled: editor.busy, onSelect: () => setReloadOpen(true) },
    ]} />}
    <ReloadDraftDialog open={reloadOpen} onOpenChange={setReloadOpen} busy={editor.busy} onConfirm={async () => { setReloadOpen(false); if (await editor.reload()) setValidation(null); }} />
  </div>;
}
