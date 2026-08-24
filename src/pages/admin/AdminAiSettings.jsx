// @ts-nocheck
import React, { useEffect, useState } from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import { Button, Input, Label, Surface, Switch, Textarea } from "@/components/primitives";
import { AdminError, AdminLoading, AdminPageFrame } from "@/components/admin/AdminPage";
import { useAdminAiSettings, useSaveAdminAiSettings, useTestAdminAiSettings } from "@/lib/useAdminData";
import { useToast } from "@/components/ui/use-toast";

const defaultModel = "nvidia/nemotron-3.5-lightning:free";

export default function AdminAiSettings() {
  const { data: settings, isLoading, error, refetch } = useAdminAiSettings();
  const save = useSaveAdminAiSettings();
  const test = useTestAdminAiSettings();
  const { toast } = useToast();
  const [model, setModel] = useState(defaultModel);
  const [enabled, setEnabled] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (!settings) return;
    setModel(settings.model || defaultModel);
    setEnabled(Boolean(settings.enabled));
  }, [settings]);

  const payload = () => ({ model: model.trim(), enabled, ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) });

  const saveSettings = async ({ runTest = false } = {}) => {
    setTestResult(null);
    try {
      const result = await save.mutateAsync(payload());
      setApiKey("");
      toast({ title: "AI settings tersimpan", description: result.apiKeyConfigured ? "Konfigurasi OpenRouter siap digunakan." : "Tambahkan API key untuk mengaktifkan model." });
      if (runTest) {
        const connection = await test.mutateAsync();
        setTestResult(connection);
        toast({ title: "Test OpenRouter berhasil", description: connection.model });
      }
    } catch (exception) {
      toast({ variant: "destructive", title: runTest ? "Test OpenRouter gagal" : "Pengaturan tidak tersimpan", description: exception.message || "Coba periksa kembali konfigurasi." });
    }
  };

  if (isLoading) return <AdminPageFrame title="AI settings" description="Menyiapkan konfigurasi AI."><AdminLoading label="Memuat konfigurasi AI…" /></AdminPageFrame>;
  if (error) return <AdminPageFrame title="AI settings" description="Kelola provider dan model AI."><AdminError error={error} onRetry={refetch} /></AdminPageFrame>;

  const keyState = settings?.apiKeyConfigured ? "API key telah dikonfigurasi" : "API key belum dikonfigurasi";
  const storageLabel = settings?.keyStorage === "private_config" ? "Private server config" : settings?.keyStorage === "encrypted_database" ? "Encrypted server storage" : "Belum ada key";

  return (
    <AdminPageFrame eyebrow="Administration / AI" title="AI settings" description="Konfigurasi OpenRouter untuk AI Layer Farm Assistant. Key tidak pernah dikirim kembali ke browser setelah disimpan.">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]">
        <Surface className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-orange text-white"><AapmIcon name="ai" className="h-5 w-5" /></div><div><h2 className="text-base font-semibold">OpenRouter</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Gunakan satu model text gratis untuk seluruh AI Assistant.</p></div></div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-subtle px-3 py-2"><span className="text-xs font-medium">Aktif</span><Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Aktifkan AI OpenRouter" /></div>
          </div>

          <div className="mt-6 space-y-5">
            <div className="space-y-2"><Label htmlFor="ai-model">Model OpenRouter</Label><Input id="ai-model" value={model} onChange={(event) => setModel(event.target.value)} placeholder={defaultModel} /><p className="text-xs leading-5 text-muted-foreground">Hanya model gratis berakhiran <code>:free</code> yang dapat disimpan. Default: {defaultModel}.</p></div>
            <div className="space-y-2"><Label htmlFor="openrouter-api-key">API key OpenRouter</Label><Input id="openrouter-api-key" type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={settings?.apiKeyConfigured ? "Biarkan kosong untuk mempertahankan key saat ini" : "sk-or-v1-…"} disabled={settings?.keyStorage === "private_config"} /><p className="text-xs leading-5 text-muted-foreground">{settings?.keyStorage === "private_config" ? "Key saat ini dikelola di file konfigurasi privat cPanel." : "Key baru disimpan terenkripsi dengan AES-256-GCM dan tidak pernah ditampilkan kembali."}</p></div>
            {!settings?.encryptionReady && settings?.keyStorage !== "private_config" && <div className="rounded-xl border border-tint-orange-border bg-tint-orange p-3 text-xs leading-5 text-tint-orange-foreground"><span className="font-semibold">Secret storage belum siap.</span> Tambahkan <code>ai_settings_encryption_key</code> pada konfigurasi cPanel privat sebelum menyimpan API key melalui halaman ini.</div>}
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => saveSettings()} disabled={save.isPending || test.isPending}>Simpan konfigurasi</Button><Button type="button" className="bg-brand-orange text-white hover:bg-brand-orange/90" onClick={() => saveSettings({ runTest: true })} disabled={save.isPending || test.isPending || !enabled}><AapmIcon name={test.isPending ? "loading" : "ai"} className={test.isPending ? "animate-spin" : ""} /> Simpan & test OpenRouter</Button></div>
        </Surface>

        <div className="space-y-5"><Surface tone={settings?.apiKeyConfigured ? "green" : "orange"} className="p-5"><div className="flex items-start gap-3"><AapmIcon name={settings?.apiKeyConfigured ? "checkRead" : "alert"} className="mt-0.5 h-5 w-5 shrink-0" /><div><div className="text-sm font-semibold">{keyState}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">Storage: {storageLabel}</p><p className="mt-3 text-xs leading-5 text-muted-foreground">Jika provider tidak tersedia, AI Assistant kembali ke respons lokal yang aman.</p></div></div></Surface>
          <Surface variant="muted" className="p-5"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Guardrails</div><ul className="mt-3 space-y-3 text-xs leading-5 text-muted-foreground"><li className="flex gap-2"><AapmIcon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" /> Key tetap di server; learner tidak menerima atau membaca key.</li><li className="flex gap-2"><AapmIcon name="analytics" className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" /> Context diambil dari KPI user yang terautentikasi, bukan payload bebas dari browser.</li><li className="flex gap-2"><AapmIcon name="clock" className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" /> 30 request per lima menit per user untuk menjaga quota model gratis.</li></ul></Surface>
          {testResult && <Surface className="p-5"><div className="flex items-center gap-2 text-sm font-semibold text-brand-green"><AapmIcon name="checkRead" className="h-4 w-4" /> Test berhasil</div><div className="mt-2 text-xs text-muted-foreground">Model: {testResult.model}</div><Textarea readOnly value={testResult.reply || ""} className="mt-3 min-h-[92px] resize-none bg-surface-subtle text-xs leading-5" /></Surface>}
        </div>
      </div>
    </AdminPageFrame>
  );
}
