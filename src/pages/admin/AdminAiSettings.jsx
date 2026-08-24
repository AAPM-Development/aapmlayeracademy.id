// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import AapmIcon from '@/components/icons/AapmIcon';
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Surface, Switch, Textarea } from '@/components/primitives';
import { AdminError, AdminLoading, AdminPageFrame } from '@/components/admin/AdminPage';
import { useAdminAiSettings, useSaveAdminAiSettings, useTestAdminAiSettings } from '@/lib/useAdminData';
import { useToast } from '@/components/ui/use-toast';

const providers = [
  { value: 'openrouter', label: 'OpenRouter', description: 'Default gratis untuk AI Farm Assistant.', model: 'nvidia/nemotron-3.5-lightning:free', baseUrl: 'https://openrouter.ai/api/v1', keyHint: 'sk-or-v1-…' },
  { value: 'openai-compatible', label: 'OpenAI-compatible API', description: 'OpenAI, Groq, Together, Mistral, DeepSeek, vLLM, Ollama, atau LM Studio.', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1', keyHint: 'API key provider atau “ollama” untuk local' },
  { value: 'gemini', label: 'Google Gemini', description: 'Gunakan Gemini API melalui Google AI Studio.', model: 'gemini-2.5-flash', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', keyHint: 'AIza…' },
  { value: 'anthropic', label: 'Anthropic Claude', description: 'Gunakan API Messages resmi Anthropic.', model: 'claude-haiku-4-5', baseUrl: 'https://api.anthropic.com/v1', keyHint: 'sk-ant-…' },
];

export default function AdminAiSettings() {
  const { data: settings, isLoading, error, refetch } = useAdminAiSettings();
  const save = useSaveAdminAiSettings();
  const test = useTestAdminAiSettings();
  const { toast } = useToast();
  const [provider, setProvider] = useState('openrouter');
  const [model, setModel] = useState(providers[0].model);
  const [baseUrl, setBaseUrl] = useState(providers[0].baseUrl);
  const [enabled, setEnabled] = useState(true);
  const [allowLocal, setAllowLocal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [testResult, setTestResult] = useState(null);

  const currentProvider = useMemo(() => providers.find((item) => item.value === provider) || providers[0], [provider]);
  const lockedByPrivateConfig = settings?.keyStorage === 'private_config';

  useEffect(() => {
    if (!settings) return;
    const configuredProvider = providers.find((item) => item.value === settings.provider) || providers[0];
    setProvider(configuredProvider.value);
    setModel(settings.model || configuredProvider.model);
    setBaseUrl(settings.baseUrl || configuredProvider.baseUrl);
    setEnabled(Boolean(settings.enabled));
    setAllowLocal(Boolean(settings.allowLocal));
  }, [settings]);

  const selectProvider = (nextProvider) => {
    const next = providers.find((item) => item.value === nextProvider) || providers[0];
    setProvider(next.value);
    setModel(next.model);
    setBaseUrl(next.baseUrl);
    setAllowLocal(false);
    setApiKey('');
    setTestResult(null);
  };

  const payload = () => ({ provider, model: model.trim(), baseUrl: baseUrl.trim(), enabled, allowLocal, ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) });

  const saveSettings = async ({ runTest = false } = {}) => {
    setTestResult(null);
    try {
      const result = await save.mutateAsync(payload());
      setApiKey('');
      toast({ title: 'Pengaturan AI tersimpan', description: result.apiKeyConfigured ? `${result.providerLabel} siap digunakan.` : 'Tambahkan API key untuk mengaktifkan provider.' });
      if (runTest) {
        const connection = await test.mutateAsync();
        setTestResult(connection);
        toast({ title: 'Test provider berhasil', description: `${connection.providerLabel} · ${connection.model}` });
      }
    } catch (exception) {
      toast({ variant: 'destructive', title: runTest ? 'Test provider gagal' : 'Pengaturan belum tersimpan', description: exception.message || 'Periksa kembali model, endpoint, dan API key.' });
    }
  };

  if (isLoading) return <AdminPageFrame title="AI settings" description="Menyiapkan konfigurasi AI."><AdminLoading label="Memuat konfigurasi AI…" /></AdminPageFrame>;
  if (error) return <AdminPageFrame title="AI settings" description="Kelola provider dan model AI."><AdminError error={error} onRetry={refetch} /></AdminPageFrame>;

  const keyState = settings?.apiKeyConfigured ? 'Credential provider siap' : 'Credential provider belum diisi';
  const storageLabel = settings?.keyStorage === 'private_config' ? 'Private server config' : settings?.keyStorage === 'encrypted_database' ? 'Encrypted server storage' : 'Belum ada credential';
  const isLocalCompatible = provider === 'openai-compatible' && allowLocal;

  return (
    <AdminPageFrame eyebrow="Administration / AI" title="AI settings" description="Pilih provider, model, dan endpoint untuk seluruh AI Layer Farm Assistant. API key tidak pernah dikirim kembali ke browser setelah disimpan.">
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Surface className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-orange text-white"><AapmIcon name="ai" className="h-5 w-5" /></div><div><h2 className="text-base font-semibold">Provider AI</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Satu konfigurasi aktif untuk learner dan admin workspace.</p></div></div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-subtle px-3 py-2"><span className="text-xs font-medium">Aktif</span><Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Aktifkan provider AI" disabled={lockedByPrivateConfig} /></div>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="ai-provider">Provider</Label><Select value={provider} onValueChange={selectProvider} disabled={lockedByPrivateConfig}><SelectTrigger id="ai-provider"><SelectValue /></SelectTrigger><SelectContent>{providers.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select><p className="text-xs leading-5 text-muted-foreground">{currentProvider.description}</p></div>
            <div className="space-y-2"><Label htmlFor="ai-model">Model</Label><Input id="ai-model" value={model} onChange={(event) => setModel(event.target.value)} placeholder={currentProvider.model} disabled={lockedByPrivateConfig} /><p className="text-xs leading-5 text-muted-foreground">{provider === 'openrouter' ? 'OpenRouter dibatasi ke model gratis dengan akhiran :free.' : 'Gunakan slug model sesuai provider yang dipilih.'}</p></div>
          </div>

          {provider === 'openai-compatible' && <div className="mt-5 grid gap-5 border-t border-border pt-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end"><div className="space-y-2"><Label htmlFor="ai-base-url">Base URL API</Label><Input id="ai-base-url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.openai.com/v1" disabled={lockedByPrivateConfig} /><p className="text-xs leading-5 text-muted-foreground">Contoh local: <code>http://localhost:11434/v1</code> untuk Ollama atau endpoint OpenAI-compatible LM Studio.</p></div><label className="flex items-center gap-3 rounded-xl border border-border bg-surface-subtle px-3 py-3 text-xs"><span><span className="block font-medium text-foreground">Endpoint lokal</span><span className="mt-0.5 block leading-5 text-muted-foreground">Izinkan HTTP loopback.</span></span><Switch checked={allowLocal} onCheckedChange={setAllowLocal} aria-label="Izinkan endpoint lokal loopback" disabled={lockedByPrivateConfig} /></label></div>}

          <div className="mt-5 space-y-2"><Label htmlFor="ai-api-key">{isLocalCompatible ? 'API key (opsional untuk local)' : `API key ${currentProvider.label}`}</Label><Input id="ai-api-key" type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={settings?.apiKeyConfigured && settings?.provider === provider ? 'Biarkan kosong untuk mempertahankan key provider ini' : currentProvider.keyHint} disabled={lockedByPrivateConfig} /><p className="text-xs leading-5 text-muted-foreground">{lockedByPrivateConfig ? 'Credential aktif dikelola dari file konfigurasi privat cPanel.' : isLocalCompatible ? 'Ollama lokal dapat memakai key dummy seperti “ollama”; key kosong juga diizinkan.' : 'Key disimpan terenkripsi dengan AES-256-GCM, dipisahkan per provider, dan tidak pernah ditampilkan kembali.'}</p></div>

          {!settings?.encryptionReady && !lockedByPrivateConfig && <div className="mt-5 rounded-xl border border-tint-orange-border bg-tint-orange p-3 text-xs leading-5 text-tint-orange-foreground"><span className="font-semibold">Secret storage belum siap.</span> Tambahkan <code>ai_settings_encryption_key</code> pada konfigurasi privat cPanel sebelum menyimpan API key melalui halaman ini.</div>}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => saveSettings()} disabled={save.isPending || test.isPending || lockedByPrivateConfig}>Simpan konfigurasi</Button><Button type="button" className="bg-brand-orange text-white hover:bg-brand-orange/90" onClick={() => saveSettings({ runTest: true })} disabled={save.isPending || test.isPending || !enabled || lockedByPrivateConfig}><AapmIcon name={test.isPending ? 'loading' : 'ai'} className={test.isPending ? 'animate-spin' : ''} /> Simpan & test provider</Button></div>
        </Surface>

        <div className="space-y-5"><Surface tone={settings?.apiKeyConfigured ? 'green' : 'orange'} className="p-5"><div className="flex items-start gap-3"><AapmIcon name={settings?.apiKeyConfigured ? 'checkRead' : 'alert'} className="mt-0.5 h-5 w-5 shrink-0" /><div><div className="text-sm font-semibold">{keyState}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">Aktif: {settings?.providerLabel} · {settings?.model}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Storage: {storageLabel}</p><p className="mt-3 text-xs leading-5 text-muted-foreground">Jika provider gagal merespons, AI Assistant kembali ke respons lokal yang aman.</p></div></div></Surface>
          <Surface variant="muted" className="p-5"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Kompatibilitas</div><ul className="mt-3 space-y-3 text-xs leading-5 text-muted-foreground"><li className="flex gap-2"><AapmIcon name="ai" className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" /> OpenRouter (model gratis), Gemini, dan Claude punya adapter API native.</li><li className="flex gap-2"><AapmIcon name="analytics" className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" /> Jalur OpenAI-compatible mencakup OpenAI, Groq, Together, Mistral, DeepSeek, vLLM, Ollama, dan LM Studio.</li><li className="flex gap-2"><AapmIcon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" /> HTTP hanya boleh ke <code>localhost</code>; endpoint lain harus HTTPS agar tidak menjadi jalur SSRF.</li></ul></Surface>
          {testResult && <Surface className="p-5"><div className="flex items-center gap-2 text-sm font-semibold text-brand-green"><AapmIcon name="checkRead" className="h-4 w-4" /> Test berhasil</div><div className="mt-2 text-xs text-muted-foreground">{testResult.providerLabel || testResult.provider} · {testResult.model}</div><Textarea readOnly value={testResult.reply || ''} className="mt-3 min-h-[92px] resize-none bg-surface-subtle text-xs leading-5" /></Surface>}
        </div>
      </div>
    </AdminPageFrame>
  );
}
