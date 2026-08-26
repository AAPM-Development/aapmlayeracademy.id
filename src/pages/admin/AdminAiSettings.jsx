// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import {
  Badge,
  Button,
  ConfirmDialog,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Surface,
  Switch,
  Textarea,
} from "@/components/primitives";
import {
  AdminError,
  AdminLoading,
  AdminPageFrame,
} from "@/components/admin/AdminPage";
import {
  useAdminAiSettings,
  useDiscoverAdminAiModels,
  useSaveAdminAiSettings,
  useTestAdminAiSettings,
} from "@/lib/useAdminData";
import { useToast } from "@/components/ui/use-toast";

const fallbackPresets = [
  { type: "openrouter", label: "OpenRouter", description: "Gateway multi-model dengan model gratis dan berbayar.", adapter: "openai-compatible", baseUrl: "https://openrouter.ai/api/v1", model: "nvidia/nemotron-3.5-lightning:free", keyRequired: true, supportsLocal: false, supportsStreaming: true, supportsVision: true, authMode: "bearer" },
  { type: "openai-compatible", label: "OpenAI-compatible", description: "OpenAI, Groq, Together, Mistral, DeepSeek, vLLM, dan gateway lain.", adapter: "openai-compatible", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", keyRequired: true, supportsLocal: true, supportsStreaming: true, supportsVision: true, authMode: "bearer" },
  { type: "ollama", label: "Ollama local", description: "Ollama di server atau jaringan privat.", adapter: "openai-compatible", baseUrl: "http://127.0.0.1:11434/v1", model: "llama3.2", keyRequired: false, supportsLocal: true, supportsStreaming: true, supportsVision: false, authMode: "none" },
  { type: "lm-studio", label: "LM Studio local", description: "LM Studio server dengan endpoint OpenAI-compatible.", adapter: "openai-compatible", baseUrl: "http://127.0.0.1:1234/v1", model: "local-model", keyRequired: false, supportsLocal: true, supportsStreaming: true, supportsVision: false, authMode: "none" },
  { type: "localai", label: "LocalAI", description: "LocalAI atau gateway self-hosted OpenAI-compatible.", adapter: "openai-compatible", baseUrl: "http://127.0.0.1:8080/v1", model: "gpt-4", keyRequired: false, supportsLocal: true, supportsStreaming: true, supportsVision: false, authMode: "none" },
  { type: "vllm", label: "vLLM local", description: "vLLM server dengan API OpenAI-compatible.", adapter: "openai-compatible", baseUrl: "http://127.0.0.1:8000/v1", model: "local-model", keyRequired: false, supportsLocal: true, supportsStreaming: true, supportsVision: false, authMode: "none" },
  { type: "gemini", label: "Google Gemini", description: "Google AI Studio / Gemini API native.", adapter: "gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-2.5-flash", keyRequired: true, supportsLocal: false, supportsStreaming: false, supportsVision: true, authMode: "x-api-key" },
  { type: "anthropic", label: "Anthropic Claude", description: "Anthropic Messages API native.", adapter: "anthropic", baseUrl: "https://api.anthropic.com/v1", model: "claude-haiku-4-5", keyRequired: true, supportsLocal: false, supportsStreaming: false, supportsVision: true, authMode: "x-api-key" },
  { type: "custom-openai", label: "Custom OpenAI-compatible", description: "Endpoint hosted, on-premise, LAN, atau local AI milik Anda.", adapter: "openai-compatible", baseUrl: "", model: "custom-model", keyRequired: true, supportsLocal: true, supportsStreaming: true, supportsVision: false, authMode: "bearer" },
];

function presetFor(type, presets) {
  return [...(presets || []), ...fallbackPresets].find((item) => item.type === type) || fallbackPresets[fallbackPresets.length - 1];
}

function newForm(preset, provider = null) {
  const source = provider || preset;
  return {
    id: provider?.id || "",
    type: provider?.type || preset.type,
    label: provider?.label || preset.label,
    adapter: provider?.adapter || source.adapter,
    baseUrl: provider?.baseUrl ?? source.baseUrl,
    model: provider?.model || source.model,
    enabled: provider?.enabled ?? true,
    isDefault: provider?.isDefault ?? false,
    allowLocal: provider?.allowLocal ?? (source.supportsLocal && /^http:\/\/(localhost|127\.0\.0\.1)/i.test(source.baseUrl || "")),
    authMode: provider?.authMode || source.authMode || "bearer",
    keyRequired: provider?.apiKeyRequired ?? source.keyRequired ?? true,
    supportsStreaming: provider?.supportsStreaming ?? source.supportsStreaming ?? true,
    supportsVision: provider?.supportsVision ?? source.supportsVision ?? false,
    chatPath: provider?.chatPath || "/chat/completions",
    modelsPath: provider?.modelsPath || "/models",
    maxTokens: provider?.maxTokens || 700,
    temperature: provider?.temperature ?? 0.3,
    timeoutSeconds: provider?.timeoutSeconds || 35,
    apiKey: "",
    clearApiKey: false,
    headersText: "",
  };
}

function endpointHint(form) {
  if (form.type === "ollama") return "Ollama default: http://127.0.0.1:11434/v1";
  if (form.type === "lm-studio") return "LM Studio default: http://127.0.0.1:1234/v1";
  if (form.type === "localai") return "LocalAI default: http://127.0.0.1:8080/v1";
  if (form.type === "vllm") return "vLLM default: http://127.0.0.1:8000/v1";
  return "Masukkan base URL API tanpa query atau credential di URL.";
}

function ProviderStatus({ provider }) {
  if (provider.isActive) return <Badge variant="soft" className="bg-tint-green text-tint-green-foreground">Aktif</Badge>;
  if (provider.isDefault) return <Badge variant="soft" className="bg-tint-orange text-tint-orange-foreground">Default</Badge>;
  return <Badge variant="outline" className="border-border text-muted-foreground">Tersedia</Badge>;
}

export default function AdminAiSettings() {
  const { data: settings, isLoading, error, refetch } = useAdminAiSettings();
  const save = useSaveAdminAiSettings();
  const test = useTestAdminAiSettings();
  const discover = useDiscoverAdminAiModels();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(() => newForm(fallbackPresets[0]));
  const [isCreating, setIsCreating] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [discoveredModels, setDiscoveredModels] = useState([]);
  const [discoveryNote, setDiscoveryNote] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const presets = settings?.presets?.length ? settings.presets : fallbackPresets;
  const providers = settings?.providers || [];
  const lockedByPrivateConfig = Boolean(settings?.managedByPrivateConfig);
  const selectedProvider = providers.find((provider) => provider.id === selectedId) || null;
  const currentPreset = useMemo(() => presetFor(form.type, presets), [form.type, presets]);

  useEffect(() => {
    if (!settings || dirty) return;
    const activeId = settings.activeProviderId || settings.providers?.[0]?.id || "";
    const provider = settings.providers?.find((item) => item.id === activeId) || settings.providers?.[0];
    setSelectedId(activeId);
    setIsCreating(!provider);
    setForm(newForm(presetFor(provider?.type || "openrouter", presets), provider));
  }, [settings, dirty, presets]);

  const updateForm = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setDirty(true);
    setTestResult(null);
  };

  const selectProvider = (provider) => {
    setSelectedId(provider.id);
    setIsCreating(false);
    setForm(newForm(presetFor(provider.type, presets), provider));
    setDirty(false);
    setTestResult(null);
    setDiscoveredModels([]);
    setDiscoveryNote("");
  };

  const createProvider = (type = "custom-openai") => {
    const preset = presetFor(type, presets);
    setSelectedId("");
    setIsCreating(true);
    setForm(newForm(preset));
    setDirty(true);
    setTestResult(null);
    setDiscoveredModels([]);
    setDiscoveryNote("");
    setAdvancedOpen(type === "custom-openai");
  };

  const parseHeaders = () => {
    if (!form.headersText.trim()) return {};
    let parsed;
    try { parsed = JSON.parse(form.headersText); } catch { throw new Error("Custom headers harus berupa JSON object yang valid."); }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("Custom headers harus berupa JSON object.");
    return parsed;
  };

  const configPayload = () => ({
    id: form.id || undefined,
    type: form.type,
    label: form.label,
    adapter: form.adapter,
    baseUrl: form.baseUrl,
    model: form.model,
    enabled: form.enabled,
    isDefault: form.isDefault,
    activate: isCreating || form.isDefault,
    allowLocal: form.allowLocal,
    authMode: form.authMode,
    keyRequired: form.keyRequired,
    supportsStreaming: form.supportsStreaming,
    supportsVision: form.supportsVision,
    chatPath: form.chatPath,
    modelsPath: form.modelsPath,
    maxTokens: Number(form.maxTokens),
    temperature: Number(form.temperature),
    timeoutSeconds: Number(form.timeoutSeconds),
    ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
    ...(form.clearApiKey ? { clearApiKey: true } : {}),
    ...(form.headersText.trim() ? { headers: parseHeaders() } : {}),
  });

  const persist = async ({ testAfter = false, discoverAfter = false } = {}) => {
    let config;
    try { config = configPayload(); } catch (exception) { toast({ variant: "destructive", title: "Konfigurasi belum valid", description: exception.message }); return null; }

    let result;
    try {
      result = await save.mutateAsync({ action: "saveProvider", config });
    } catch (exception) {
      toast({ variant: "destructive", title: "Provider belum tersimpan", description: exception.message || "Periksa endpoint dan konfigurasi provider." });
      return null;
    }

    const savedId = config.id || result.activeProviderId;
    setSelectedId(savedId);
    setIsCreating(false);
    setDirty(false);
    setForm((previous) => ({ ...previous, id: savedId, apiKey: "", clearApiKey: false }));

    if (!testAfter && !discoverAfter) {
      toast({ title: "Provider AI tersimpan", description: `${config.label} dapat dipilih sebagai koneksi aktif.` });
      return savedId;
    }

    try {
      if (testAfter) {
        const connection = await test.mutateAsync({ providerId: savedId });
        setTestResult(connection);
        toast({ title: "Provider siap digunakan", description: `${connection.providerLabel} · ${connection.model}` });
      } else {
        const resultModels = await discover.mutateAsync({ providerId: savedId });
        setDiscoveredModels(resultModels.models || []);
        setDiscoveryNote(resultModels.note || "");
        toast({ title: "Model berhasil dibaca", description: resultModels.note });
      }
    } catch (exception) {
      if (testAfter) setTestResult(null);
      toast({
        variant: "destructive",
        title: testAfter ? "Provider tersimpan, test gagal" : "Provider tersimpan, discovery gagal",
        description: exception.message || "Provider tersimpan, tetapi endpoint belum dapat dijangkau dari server cPanel.",
      });
    }

    return savedId;
  };

  const setActive = async (providerId) => {
    try {
      await save.mutateAsync({ action: "setActive", providerId });
      toast({ title: "Provider aktif diperbarui", description: "APPI akan menggunakan koneksi ini untuk akun yang memakai Global AAPM Provider." });
    } catch (exception) { toast({ variant: "destructive", title: "Provider aktif belum berubah", description: exception.message }); }
  };

  const deleteProvider = async () => {
    if (!deleteTarget) return;
    try {
      await save.mutateAsync({ action: "deleteProvider", providerId: deleteTarget.id });
      setDeleteTarget(null);
      setDirty(false);
      toast({ title: "Provider dihapus", description: `${deleteTarget.label} tidak lagi tersedia di registry.` });
    } catch (exception) { toast({ variant: "destructive", title: "Provider belum dihapus", description: exception.message }); }
  };

  if (isLoading) return <AdminPageFrame title="Pengaturan AI" description="Menyiapkan registry provider APPI."><AdminLoading label="Memuat provider AI…" /></AdminPageFrame>;
  if (error) return <AdminPageFrame title="Pengaturan AI" description="Kelola koneksi AI global dan kompatibilitas local."><AdminError error={error} onRetry={refetch} /></AdminPageFrame>;

  const isSaving = save.isPending;
  const isTesting = test.isPending;
  const isDiscovering = discover.isPending;
  const isBusy = isSaving || isTesting || isDiscovering;

  return (
    <AdminPageFrame eyebrow="Administration / APPI" title="Provider AI & koneksi" description="Atur sebanyak yang diperlukan: hosted API, gateway internal, jaringan privat, atau local AI. APPI menggunakan provider aktif sebagai default global." actions={<Button type="button" className="bg-brand-orange text-white hover:bg-brand-orange/90" onClick={() => createProvider()} disabled={lockedByPrivateConfig}><AapmIcon name="add" /> Tambah provider</Button>}>
      {lockedByPrivateConfig && <Surface tone="orange" className="mb-5 flex items-start gap-3 p-4"><AapmIcon name="shield" className="mt-0.5 h-5 w-5 shrink-0 text-tint-orange-foreground" /><div className="text-sm leading-6"><span className="font-semibold">Registry dikunci konfigurasi server.</span> Provider aktif dikelola dari private cPanel config; Admin masih dapat melihat status dan menjalankan test.</div></Surface>}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)]">
        <Surface className="min-w-0 overflow-hidden p-0"><div className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-5"><div><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-green">Registry</div><h2 className="mt-1 text-base font-semibold">Koneksi provider</h2></div><Badge variant="outline" className="border-border">{providers.length}</Badge></div><div className="space-y-1 p-2 sm:p-3">{providers.length ? providers.map((provider) => <button type="button" key={provider.id} onClick={() => selectProvider(provider)} className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${selectedId === provider.id && !isCreating ? "border-brand-green/50 bg-tint-green" : "border-transparent hover:border-border hover:bg-surface-subtle"}`}><div className="flex items-start gap-3"><span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${provider.isActive ? "bg-brand-green text-white" : "bg-tint-orange text-brand-orange"}`}><AapmIcon name="ai" className="h-4.5 w-4.5" /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-semibold">{provider.label}</span><ProviderStatus provider={provider} /></span><span className="mt-1 block truncate text-[11px] text-muted-foreground">{provider.model}</span><span className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-muted-foreground"><span>{provider.apiKeyConfigured ? "Credential siap" : provider.apiKeyRequired ? "Credential belum ada" : "Tanpa key"}</span><span>·</span><span>{provider.supportsStreaming ? "Streaming" : "Response biasa"}</span></span></span></div></button>) : <div className="rounded-xl border border-dashed border-border p-4 text-xs leading-5 text-muted-foreground">Belum ada koneksi tersimpan. Tambahkan provider pertama untuk mengaktifkan APPI.</div>}</div><div className="border-t border-border bg-surface-subtle px-4 py-3 text-[11px] leading-5 text-muted-foreground sm:px-5">Provider akun learner dapat memilih koneksi global yang tersedia tanpa melihat API key.</div></Surface>

        <Surface className="min-w-0 p-5 sm:p-6"><div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tint-orange text-brand-orange"><AapmIcon name="ai" className="h-5 w-5" /></span><div className="min-w-0"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-orange">{isCreating ? "Koneksi baru" : "Konfigurasi provider"}</div><h2 className="mt-1 truncate text-lg font-semibold">{isCreating ? "Tambah provider AI" : form.label || "Provider AI"}</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">Satu kontrak untuk provider cloud, self-hosted, dan local.</p></div></div><div className="flex items-center gap-3 rounded-xl border border-border bg-surface-subtle px-3 py-2"><span className="text-xs font-medium">Aktif</span><Switch checked={Boolean(form.enabled)} onCheckedChange={(value) => updateForm("enabled", value)} disabled={lockedByPrivateConfig} /></div></div>

          <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-2"><div className="space-y-2"><Label htmlFor="ai-connection-label">Nama koneksi</Label><Input id="ai-connection-label" value={form.label} onChange={(event) => updateForm("label", event.target.value)} placeholder="Contoh: OpenRouter produksi" disabled={lockedByPrivateConfig} className="h-11" /><p className="text-xs leading-5 text-muted-foreground">Nama ini tampil di Admin dan pilihan provider akun.</p></div><div className="space-y-2"><Label htmlFor="ai-protocol">Preset / protokol</Label><Select value={form.type} onValueChange={(value) => { const preset = presetFor(value, presets); setForm((previous) => ({ ...newForm(preset), id: previous.id, isDefault: previous.isDefault })); setDirty(true); setTestResult(null); }} disabled={lockedByPrivateConfig}><SelectTrigger id="ai-protocol" className="h-11"><SelectValue /></SelectTrigger><SelectContent>{presets.map((preset) => <SelectItem key={preset.type} value={preset.type}>{preset.label}</SelectItem>)}</SelectContent></Select><p className="text-xs leading-5 text-muted-foreground">{currentPreset.description}</p></div></div>

          <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,0.55fr)]"><div className="space-y-2"><Label htmlFor="ai-base-url">Base URL API</Label><Input id="ai-base-url" value={form.baseUrl} onChange={(event) => updateForm("baseUrl", event.target.value)} placeholder={currentPreset.baseUrl || "https://gateway.example.com/v1"} disabled={lockedByPrivateConfig} className="h-11" /><p className="text-xs leading-5 text-muted-foreground">{endpointHint(form)} Server cPanel harus dapat menjangkau endpoint ini.</p></div><div className="space-y-2"><Label htmlFor="ai-model">Model ID</Label><Input id="ai-model" value={form.model} onChange={(event) => updateForm("model", event.target.value)} placeholder={currentPreset.model} disabled={lockedByPrivateConfig} className="h-11" /><p className="text-xs leading-5 text-muted-foreground">Boleh slug model apa pun yang didukung endpoint.</p></div></div>

          <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-2"><div className="space-y-2"><Label htmlFor="ai-auth-mode">Autentikasi</Label><Select value={form.authMode} onValueChange={(value) => updateForm("authMode", value)} disabled={lockedByPrivateConfig}><SelectTrigger id="ai-auth-mode" className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bearer">Authorization: Bearer</SelectItem><SelectItem value="x-api-key">X-API-Key</SelectItem><SelectItem value="none">Tanpa API key / local</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="ai-api-key">API key {form.authMode === "none" ? "(opsional)" : ""}</Label><Input id="ai-api-key" type="password" autoComplete="new-password" value={form.apiKey} onChange={(event) => updateForm("apiKey", event.target.value)} placeholder={selectedProvider?.apiKeyConfigured ? "Kosongkan untuk mempertahankan key" : "Masukkan key provider"} disabled={lockedByPrivateConfig} className="h-11" /><p className="text-xs leading-5 text-muted-foreground">Key hanya disimpan terenkripsi di server dan tidak dikirim kembali ke browser.</p></div></div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-surface-subtle px-3 py-3 text-xs"><span><span className="block font-medium">Aktifkan endpoint privat</span><span className="mt-0.5 block leading-5 text-muted-foreground">Izinkan HTTP loopback / LAN privat.</span></span><Switch checked={Boolean(form.allowLocal)} onCheckedChange={(value) => updateForm("allowLocal", value)} disabled={lockedByPrivateConfig} /></label><label className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-surface-subtle px-3 py-3 text-xs"><span><span className="block font-medium">Jadikan provider default</span><span className="mt-0.5 block leading-5 text-muted-foreground">Dipakai oleh Global AAPM Provider.</span></span><Switch checked={Boolean(form.isDefault)} onCheckedChange={(value) => updateForm("isDefault", value)} disabled={lockedByPrivateConfig} /></label></div>

          <div className="mt-5 border-t border-border pt-5"><button type="button" className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setAdvancedOpen((value) => !value)}><span><span className="block text-sm font-semibold">Pengaturan lanjutan</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Streaming, vision, path endpoint, token, timeout, dan custom headers.</span></span><AapmIcon name={advancedOpen ? "chevronUp" : "chevronDown"} className="h-5 w-5 text-muted-foreground" /></button>{advancedOpen && <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-2"><label className="flex min-w-0 items-start gap-3 rounded-xl border border-border bg-surface-subtle p-3 text-xs"><Switch checked={Boolean(form.supportsStreaming)} onCheckedChange={(value) => updateForm("supportsStreaming", value)} disabled={lockedByPrivateConfig} /><span><span className="block font-medium">Streaming response</span><span className="mt-0.5 block leading-5 text-muted-foreground">APPI meneruskan delta untuk endpoint OpenAI-compatible.</span></span></label><label className="flex min-w-0 items-start gap-3 rounded-xl border border-border bg-surface-subtle p-3 text-xs"><Switch checked={Boolean(form.supportsVision)} onCheckedChange={(value) => updateForm("supportsVision", value)} disabled={lockedByPrivateConfig} /><span><span className="block font-medium">Input gambar / vision</span><span className="mt-0.5 block leading-5 text-muted-foreground">Aktifkan hanya bila model provider memang mendukung vision.</span></span></label><div className="space-y-2"><Label htmlFor="ai-chat-path">Chat path</Label><Input id="ai-chat-path" value={form.chatPath} onChange={(event) => updateForm("chatPath", event.target.value)} placeholder="/chat/completions" disabled={lockedByPrivateConfig} className="h-11" /></div><div className="space-y-2"><Label htmlFor="ai-models-path">Models path</Label><Input id="ai-models-path" value={form.modelsPath} onChange={(event) => updateForm("modelsPath", event.target.value)} placeholder="/models" disabled={lockedByPrivateConfig} className="h-11" /></div><div className="space-y-2"><Label htmlFor="ai-max-tokens">Max output tokens</Label><Input id="ai-max-tokens" type="number" min="64" max="8192" value={form.maxTokens} onChange={(event) => updateForm("maxTokens", event.target.value)} disabled={lockedByPrivateConfig} className="h-11" /></div><div className="space-y-2"><Label htmlFor="ai-timeout">Timeout (detik)</Label><Input id="ai-timeout" type="number" min="8" max="120" value={form.timeoutSeconds} onChange={(event) => updateForm("timeoutSeconds", event.target.value)} disabled={lockedByPrivateConfig} className="h-11" /></div><div className="space-y-2"><Label htmlFor="ai-temperature">Temperature</Label><Input id="ai-temperature" type="number" min="0" max="2" step="0.1" value={form.temperature} onChange={(event) => updateForm("temperature", event.target.value)} disabled={lockedByPrivateConfig} className="h-11" /></div><div className="space-y-2"><Label htmlFor="ai-headers">Custom headers (JSON, opsional)</Label><Textarea id="ai-headers" value={form.headersText} onChange={(event) => updateForm("headersText", event.target.value)} placeholder={'{\n  "X-Workspace": "academy"\n}'} rows={3} disabled={lockedByPrivateConfig} className="resize-y font-mono text-xs" /></div></div>}</div>

          {discoveredModels.length > 0 && <div className="mt-5 rounded-xl border border-tint-green-border bg-tint-green p-3"><div className="flex items-center gap-2 text-sm font-semibold text-brand-green"><AapmIcon name="checkRead" className="h-4 w-4" />Model ditemukan</div><div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">{discoveredModels.map((model) => <button type="button" key={model.id} onClick={() => updateForm("model", model.id)} className="rounded-lg border border-tint-green-border bg-background px-2 py-1 text-[11px] text-foreground hover:border-brand-green">{model.id}</button>)}</div>{discoveryNote && <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{discoveryNote}</p>}</div>}
          {testResult && <div className="mt-5 rounded-xl border border-tint-green-border bg-tint-green p-4"><div className="flex items-center gap-2 text-sm font-semibold text-brand-green"><AapmIcon name="checkRead" className="h-4 w-4" />Test koneksi berhasil</div><p className="mt-1 text-xs text-muted-foreground">{testResult.providerLabel} · {testResult.model}</p><Textarea readOnly value={testResult.reply || "AAPM AI siap."} rows={2} className="mt-3 resize-none bg-background text-xs" /></div>}

          <div className="mt-6 flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:flex-wrap sm:justify-between"><div className="flex flex-col gap-2 sm:flex-row"><Button type="button" className="bg-brand-orange text-white hover:bg-brand-orange/90" onClick={() => persist()} disabled={isBusy || lockedByPrivateConfig}>{isSaving ? "Menyimpan…" : "Simpan provider"}</Button><Button type="button" variant="outline" onClick={() => persist({ testAfter: true })} disabled={isBusy || lockedByPrivateConfig}>{isTesting ? "Menguji…" : "Simpan & test"}</Button><Button type="button" variant="outline" onClick={() => persist({ discoverAfter: true })} disabled={isBusy || lockedByPrivateConfig}>{isDiscovering ? "Membaca model…" : "Simpan & baca model"}</Button></div><div className="flex gap-2">{!isCreating && selectedProvider && !selectedProvider.isActive && <Button type="button" variant="ghost" onClick={() => setActive(selectedProvider.id)} disabled={isBusy || lockedByPrivateConfig}>Jadikan aktif</Button>}{!isCreating && selectedProvider && <Button type="button" variant="ghost" className="text-danger hover:text-danger" onClick={() => setDeleteTarget(selectedProvider)} disabled={isBusy || lockedByPrivateConfig}><AapmIcon name="delete" /> Hapus</Button>}</div></div>
        </Surface>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3"><Surface tone={settings?.apiKeyConfigured ? "green" : "orange"} className="p-5"><div className="flex items-start gap-3"><AapmIcon name={settings?.apiKeyConfigured ? "checkRead" : "alert"} className="mt-0.5 h-5 w-5 shrink-0" /><div><div className="text-sm font-semibold">{settings?.apiKeyConfigured ? "Provider aktif siap" : "Provider aktif belum punya credential"}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{settings?.providerLabel} · {settings?.model}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{settings?.keyStorage === "private_config" ? "Private server config" : settings?.keyStorage === "encrypted_database" ? "Encrypted server storage" : "Belum terkonfigurasi"}</p></div></div></Surface><Surface variant="muted" className="p-5"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Cakupan</div><p className="mt-2 text-sm leading-6 text-muted-foreground">OpenAI-compatible menjadi jalur universal: cloud, gateway, Docker, Ollama, LM Studio, LocalAI, vLLM, sampai endpoint internal.</p></Surface><Surface variant="muted" className="p-5"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Keamanan</div><p className="mt-2 text-sm leading-6 text-muted-foreground">API key dan custom headers terenkripsi AES-256-GCM. HTTP hanya dibuka dengan toggle dan dibatasi ke loopback/jaringan privat.</p></Surface></div>

      <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)} title={`Hapus ${deleteTarget?.label || "provider"}?`} description="Provider ini akan dihapus dari registry global. Riwayat chat tidak ikut terhapus; provider lain tetap aman." confirmLabel="Hapus provider" destructive onConfirm={deleteProvider} />
    </AdminPageFrame>
  );
}
