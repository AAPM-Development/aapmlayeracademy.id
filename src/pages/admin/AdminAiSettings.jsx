// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Ic } from "@/design-system/canvas";
import {
  ConfirmDialog,
  Field,
  Input,
  InputGroup,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  useToast,
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/design-system/command";

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

/* Label + control for Radix Select roots, which cannot take Field's id cloning. */
function ControlField({ id, label, hint, className = undefined, children }) {
  return (
    <div className={`field${className ? ` ${className}` : ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

function ProviderStatus({ provider }) {
  if (provider.isActive) return <span className="chip chip-success">Aktif</span>;
  if (provider.isDefault) return <span className="chip">Bawaan</span>;
  return <span className="chip chip-outline">Tersedia</span>;
}

function providerIcon(provider) {
  if (provider?.authMode === "none" || provider?.allowLocal) return "server";
  if (provider?.id === "openai-server") return "key";
  return "globe";
}

function ModelPicker({ value, models, discoveryNote, discoveryAttempted, isDiscovering, disabled, onChange, onDiscover }) {
  const [open, setOpen] = useState(false);
  const modelItems = (Array.isArray(models) ? models : [])
    .map((item) => (typeof item === "string" ? { id: item, label: item } : item))
    .filter((item) => item?.id);
  const selectedModel = modelItems.find((item) => item.id === value);
  const statusLabel = modelItems.length
    ? `${modelItems.length} model terdeteksi`
    : discoveryAttempted
      ? "Belum ada model yang terbaca"
      : "Daftar model belum dibaca";

  return (
    <div className="field">
      <label className="label" htmlFor="ai-model">Model</label>
      <InputGroup
        id="ai-model"
        leadingIcon="sparkle"
        inputClassName="t-mono"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ketik ID model atau pilih dari daftar"
        disabled={disabled}
        aria-describedby="ai-model-hint"
        trailing={(
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="btn btn-ghost btn-sm btn-icon btn-quiet" aria-label="Buka daftar model provider" disabled={disabled}>
                <Ic name="chev-down" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="aapm-model-picker__panel">
              <Command>
                <CommandInput placeholder="Cari ID model…" />
                <CommandList className="max-h-72">
                  <CommandEmpty>
                    {modelItems.length ? "Model tidak ditemukan." : "Belum ada daftar model. Jalankan Baca model."}
                  </CommandEmpty>
                  {modelItems.length > 0 && (
                    <CommandGroup heading="Model dari endpoint">
                      {modelItems.map((model) => (
                        <CommandItem
                          key={model.id}
                          value={model.id}
                          keywords={[model.label || model.id]}
                          onSelect={() => {
                            onChange(model.id);
                            setOpen(false);
                          }}
                          className="aapm-model-picker__item"
                        >
                          <Ic name="check" className={model.id === value ? "t-success" : "t-muted"} style={model.id === value ? undefined : { opacity: 0 }} />
                          <span className="stack grow" style={{ minWidth: 0 }}>
                            <span className="t-medium t-clamp-1">{model.label || model.id}</span>
                            {model.label && model.label !== model.id ? <span className="t-caption t-muted t-clamp-1">{model.id}</span> : null}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
              <div className="row between gap-2 t-caption t-muted" style={{ padding: "8px 12px", borderTop: "1px solid var(--border)" }}>
                <span>{selectedModel ? `Dipilih: ${selectedModel.label || selectedModel.id}` : "ID model bisa diketik manual."}</span>
                <button type="button" className="btn btn-link t-caption" onClick={() => setOpen(false)}>Tutup</button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      />
      <span className="hint" id="ai-model-hint">ID model dari penyedia. Pilih dari daftar atau ketik manual.</span>
      <div className="row wrap gap-2" style={{ paddingTop: 4 }}>
        <span className={`chip ${modelItems.length ? "chip-success" : "chip-outline"}`}><Ic name={modelItems.length ? "check" : "info"} />{statusLabel}</span>
        <button type="button" className="btn btn-secondary btn-sm ml-auto" onClick={onDiscover} disabled={disabled || isDiscovering}>
          <Ic name="refresh" />
          {isDiscovering ? "Membaca…" : "Baca model"}
        </button>
      </div>
      {discoveryNote ? <p className={`hint${modelItems.length ? " t-success" : ""}`}>{discoveryNote}</p> : null}
    </div>
  );
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
  const [discoveryAttempted, setDiscoveryAttempted] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const discoveryEpoch = useRef(0);

  const presets = settings?.presets?.length ? settings.presets : fallbackPresets;
  const providers = settings?.providers || [];
  const lockedByPrivateConfig = Boolean(settings?.managedByPrivateConfig);
  const selectedProvider = providers.find((provider) => provider.id === selectedId) || null;
  const currentPreset = useMemo(() => presetFor(form.type, presets), [form.type, presets]);

  useEffect(() => {
    if (!settings || dirty || isCreating) return;
    const activeId = settings.providers?.some((item) => item.id === selectedId) ? selectedId : settings.activeProviderId || settings.providers?.[0]?.id || "";
    const provider = settings.providers?.find((item) => item.id === activeId) || settings.providers?.[0];
    setSelectedId(activeId);
    setIsCreating(!provider);
    setForm(newForm(presetFor(provider?.type || "openrouter", presets), provider));
  }, [settings, dirty, presets, selectedId, isCreating]);

  const resetDiscovery = () => {
    discoveryEpoch.current += 1;
    setDiscoveredModels([]);
    setDiscoveryNote("");
    setDiscoveryAttempted(false);
  };

  const updateForm = (key, value) => {
    if (["baseUrl", "apiKey", "clearApiKey", "modelsPath", "authMode", "allowLocal"].includes(key)) resetDiscovery();
    setForm((previous) => ({ ...previous, [key]: value }));
    setDirty(true);
    setTestResult(null);
  };

  const selectProvider = (provider) => {
    resetDiscovery();
    setSelectedId(provider.id);
    setIsCreating(false);
    setForm(newForm(presetFor(provider.type, presets), provider));
    setDirty(false);
    setTestResult(null);
    setDiscoveredModels([]);
    setDiscoveryNote("");
    setDiscoveryAttempted(false);
  };

  const createProvider = (type = "custom-openai") => {
    resetDiscovery();
    const preset = presetFor(type, presets);
    setSelectedId("");
    setIsCreating(true);
    setForm(newForm(preset));
    setDirty(true);
    setTestResult(null);
    setDiscoveredModels([]);
    setDiscoveryNote("");
    setDiscoveryAttempted(false);
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

  const discoverCurrentModels = async () => {
    const epoch = ++discoveryEpoch.current;
    let config;
    try { config = configPayload(); } catch (exception) { toast({ variant: "destructive", title: "Konfigurasi belum valid", description: exception.message }); return; }
    setDiscoveryAttempted(true);
    setDiscoveryNote("Menghubungi endpoint provider…");
    try {
      const resultModels = await discover.mutateAsync({ config });
      if (discoveryEpoch.current !== epoch) return;
      setDiscoveredModels(resultModels.models || []);
      setDiscoveryNote(resultModels.note || "");
      toast({
        title: resultModels.models?.length ? "Daftar model siap dipilih" : "Model belum ditemukan",
        description: resultModels.note || "Periksa endpoint models atau masukkan ID model manual.",
      });
    } catch (exception) {
      if (discoveryEpoch.current !== epoch) return;
      setDiscoveredModels([]);
      setDiscoveryNote(exception.message || "Endpoint model belum dapat dijangkau dari server.");
      toast({ variant: "destructive", title: "Model belum dapat dibaca", description: exception.message || "Periksa endpoint dan autentikasi provider." });
    }
  };

  const persist = async ({ testAfter = false } = {}) => {
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

    if (!testAfter) {
      toast({ title: "Provider AI tersimpan", description: `${config.label} dapat dipilih sebagai koneksi aktif.` });
      return savedId;
    }

    try {
      if (testAfter) {
        const connection = await test.mutateAsync({ providerId: savedId });
        setTestResult(connection);
        toast({ title: "Provider siap digunakan", description: `${connection.providerLabel} · ${connection.model}` });
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

  const importServerOpenAi = async () => {
    try {
      const result = await save.mutateAsync({ action: "importServerOpenAi" });
      resetDiscovery();
      selectProvider(result.providers.find((provider) => provider.id === "openai-server"));
      toast({ title: "OpenAI terhubung ke Pengaturan APPI", description: "Kunci tersimpan terenkripsi di server. Pilih Baca model untuk memilih modelnya." });
    } catch (exception) {
      toast({ variant: "destructive", title: "Kunci server belum diintegrasikan", description: exception.message });
    }
  };

  if (isLoading) return <AdminPageFrame title="Pengaturan APPI" description="Menyiapkan registry provider APPI."><AdminLoading label="Memuat provider AI…" /></AdminPageFrame>;
  if (error) return <AdminPageFrame title="Pengaturan APPI" description="Kelola koneksi AI global dan kompatibilitas local."><AdminError error={error} onRetry={refetch} /></AdminPageFrame>;

  const isSaving = save.isPending;
  const isTesting = test.isPending;
  const isDiscovering = discover.isPending;
  const isBusy = isSaving || isTesting || isDiscovering;
  const isLocked = lockedByPrivateConfig;
  // The API reports whether this server can encrypt keys; say so before an admin types one.
  const keyStorageReady = providers.every((provider) => provider.encryptionReady !== false);

  const activeProvider = providers.find((provider) => provider.isActive);
  const defaultProvider = providers.find((provider) => provider.isDefault);
  const storageLabel = settings?.keyStorage === "private_config" ? "Konfigurasi privat server" : settings?.keyStorage === "encrypted_database" ? "Terenkripsi AES-256-GCM di server" : "Belum terkonfigurasi";
  const formSection = (title, desc, body) => (
    <div className="form-section">
      <div className="stack gap-1"><h3 className="t-heading">{title}</h3><p className="t-support t-muted">{desc}</p></div>
      <div className="stack gap-4">{body}</div>
    </div>
  );

  return (
    <AdminPageFrame
      title="Pengaturan APPI"
      description="Pilih koneksi dan model yang digunakan APPI. Perubahan koneksi aktif berlaku bagi peserta yang memakai pengaturan global."
      actions={(
        <button type="button" className="btn btn-secondary" onClick={() => createProvider()} disabled={isLocked || isBusy}>
          <Ic name="plus" />
          Tambah koneksi
        </button>
      )}
    >
      <section className="grid-sm" aria-label="Status APPI">
        <div className="card card-pad row-start gap-3 anim-rise">
          <span className="tile" data-hue="ai"><Ic name="sparkle" /></span>
          <div className="stack gap-0-5 grow" style={{ minWidth: 0 }}>
            <div className="row gap-2 between"><h2 className="t-heading">APPI aktif</h2>{settings?.apiKeyConfigured ? <span className="chip chip-success"><Ic name="check" />Siap</span> : <span className="chip chip-warning"><Ic name="alert" />Belum siap</span>}</div>
            <p className="t-support t-muted">{settings?.providerLabel || activeProvider?.label || "—"}<br /><span className="t-mono t-break">{settings?.model || activeProvider?.model || "—"}</span></p>
          </div>
        </div>
        <div className="card card-pad row-start gap-3 anim-rise" style={/** @type {React.CSSProperties} */ ({ "--i": 1 })}>
          <span className="tile" data-hue={keyStorageReady ? "green" : "amber"}><Ic name="lock" /></span>
          <div className="stack gap-0-5 grow">
            <h2 className="t-heading">{keyStorageReady ? "Kunci tersimpan aman" : "Penyimpanan kunci belum siap"}</h2>
            <p className="t-support t-muted t-break">{keyStorageReady ? storageLabel : "Isi ai_settings_encryption_key di konfigurasi privat server."}</p>
          </div>
        </div>
        <div className="card card-pad row-start gap-3 anim-rise" style={/** @type {React.CSSProperties} */ ({ "--i": 2 })}>
          <span className="tile" data-hue="blue"><Ic name="server" /></span>
          <div className="stack gap-0-5 grow">
            <h2 className="t-heading">Lingkungan</h2>
            <p className="t-support t-muted">{isLocked ? "Registry dikunci konfigurasi privat cPanel" : "Registry dikelola dari halaman ini"}</p>
          </div>
        </div>
      </section>

      {isLocked ? (
        <div className="alert alert-warning" role="status"><Ic name="lock" /><div className="stack gap-0-5"><span className="alert-title">Registry dikunci konfigurasi server.</span><span className="t-muted">Koneksi aktif dikelola dari konfigurasi privat cPanel. Admin tetap dapat melihat status dan menjalankan uji koneksi.</span></div></div>
      ) : null}
      <div className={`alert ${settings.serverOpenAiKeyAvailable ? "alert-info" : "alert-warning"}`} role="status">
        <Ic name={settings.serverOpenAiKeyAvailable ? "key" : "alert"} />
        <div className="stack gap-2 grow">
          <div className="stack gap-0-5">
            <span className="alert-title">{settings.serverOpenAiKeyAvailable ? "Kunci OpenAI server tersedia" : "Kunci OpenAI belum tersedia di lingkungan ini"}</span>
            <span className="t-muted">{settings.serverOpenAiKeyAvailable ? "Gunakan kunci yang sudah disiapkan tanpa menyalin atau menampilkannya. Setelah integrasi, koneksi dan model bisa diatur di halaman ini." : "Kunci lokal tidak ikut masuk ke staging atau produksi. Siapkan OPENAI_API_KEY atau openai_api_key pada konfigurasi privat server."}</span>
          </div>
          {settings.serverOpenAiKeyAvailable ? <div className="row"><button type="button" className="btn btn-secondary btn-sm" onClick={importServerOpenAi} disabled={isBusy || !settings.serverKeyEncryptionReady}>{providers.some((provider) => provider.id === "openai-server") ? "Perbarui dari kunci OpenAI server" : "Integrasikan kunci OpenAI server"}</button></div> : null}
          {settings.serverOpenAiKeyAvailable && !settings.serverKeyEncryptionReady ? <p className="hint">Penyimpanan terenkripsi belum siap. Isi ai_settings_encryption_key di konfigurasi privat server.</p> : null}
        </div>
      </div>

      <div className="split-rail">
        <section className="card" aria-labelledby="conn-title" style={{ alignSelf: "start" }}>
          <div className="card-pad card-head" style={{ paddingBottom: 12 }}><h2 className="card-title" id="conn-title">Koneksi</h2><span className="count">{providers.length}</span></div>
          {providers.length ? (
            <div className="list">
              {providers.map((provider) => {
                const current = selectedId === provider.id && !isCreating;
                return (
                  <button
                    type="button"
                    key={provider.id}
                    disabled={isBusy}
                    className={`li${current ? " card-tint" : ""}`}
                    data-hue={provider.isActive ? "green" : "neutral"}
                    aria-current={current ? "true" : undefined}
                    onClick={() => selectProvider(provider)}
                    style={{ width: "100%", border: 0, textAlign: "left", font: "inherit", cursor: "pointer", background: current ? undefined : "transparent" }}
                  >
                    <span className="tile tile-sm"><Ic name={providerIcon(provider)} /></span>
                    <span className="stack grow" style={{ minWidth: 0 }}>
                      <span className={`li-title t-clamp-1${current ? " t-strong" : ""}`}>{provider.label}</span>
                      <span className="li-meta t-clamp-1">{provider.apiKeyConfigured ? "Kunci siap" : provider.apiKeyRequired ? "Kunci belum ada" : "Tanpa kunci"}{provider.supportsStreaming ? " · streaming" : ""}</span>
                    </span>
                    <ProviderStatus provider={provider} />
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="card-pad t-support t-muted" style={{ paddingTop: 0 }}>Belum ada koneksi. Tambahkan koneksi pertama untuk mengaktifkan APPI.</p>
          )}
          <p className="note card-sect" style={{ padding: "12px var(--card-pad)" }}>Peserta memilih koneksi global tanpa pernah melihat API key.</p>
        </section>

        <section className="card anim-rise" style={/** @type {React.CSSProperties} */ ({ "--i": 1 })} id="editor" aria-labelledby="ed-title">
          <div className="card-pad card-head">
            <div className="row gap-3" style={{ minWidth: 0 }}>
              <span className="tile" data-hue={form.enabled ? "green" : "neutral"}><Ic name={providerIcon(form)} /></span>
              <div className="stack gap-0-5" style={{ minWidth: 0 }}><h2 className="card-title t-clamp-1" id="ed-title">{isCreating ? "Koneksi baru" : form.label || "Koneksi AI"}</h2><p className="card-desc">{currentPreset.label}{selectedProvider?.lastTestedAt ? ` · terakhir diuji ${new Date(selectedProvider.lastTestedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}` : ""}</p></div>
            </div>
            <label className="switch"><input type="checkbox" checked={Boolean(form.enabled)} onChange={(event) => updateForm("enabled", event.target.checked)} disabled={isLocked} aria-label="Aktifkan koneksi" />{form.enabled ? "Aktif" : "Nonaktif"}</label>
          </div>
          <div className="card-sect card-pad">
            {formSection("Identitas koneksi", "Nama tampil di Admin dan di pilihan koneksi peserta.", (
              <>
                <Field id="ai-connection-label" label="Nama koneksi">
                  <Input value={form.label} onChange={(event) => updateForm("label", event.target.value)} placeholder="Contoh: OpenRouter produksi" disabled={isLocked} />
                </Field>
                <ControlField id="ai-protocol" label="Jenis koneksi" hint={currentPreset.description}>
                  <Select
                    value={form.type}
                    onValueChange={(value) => {
                      resetDiscovery();
                      const preset = presetFor(value, presets);
                      setForm((previous) => ({ ...newForm(preset), id: previous.id, isDefault: previous.isDefault }));
                      setDirty(true);
                      setTestResult(null);
                    }}
                    disabled={isLocked}
                  >
                    <SelectTrigger id="ai-protocol"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {presets.map((preset) => <SelectItem key={preset.type} value={preset.type}>{preset.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </ControlField>
              </>
            ))}
            {formSection("Alamat & model", "Server Academy harus dapat menjangkau alamat ini.", (
              <>
                <div className="field">
                  <label className="label" htmlFor="ai-base-url">Alamat API</label>
                  <InputGroup id="ai-base-url" leadingIcon="globe" type="url" value={form.baseUrl} onChange={(event) => updateForm("baseUrl", event.target.value)} placeholder={currentPreset.baseUrl || "https://gateway.example.com/v1"} disabled={isLocked} aria-describedby="ai-url-hint" />
                  <span className="hint" id="ai-url-hint">{endpointHint(form)} Base URL tanpa query atau kredensial.</span>
                </div>
                <ModelPicker
                  value={form.model}
                  models={discoveredModels}
                  discoveryNote={discoveryNote}
                  discoveryAttempted={discoveryAttempted}
                  isDiscovering={isDiscovering}
                  disabled={isLocked}
                  onChange={(value) => updateForm("model", value)}
                  onDiscover={discoverCurrentModels}
                />
              </>
            ))}
            {formSection("Autentikasi", "Kunci disimpan terenkripsi di server dan tidak dikirim kembali ke browser.", (
              <>
                <ControlField id="ai-auth-mode" label="Cara autentikasi" hint={form.authMode === "bearer" ? "Dikirim sebagai header Authorization: Bearer." : form.authMode === "x-api-key" ? "Dikirim sebagai header X-API-Key." : "Untuk endpoint lokal tanpa kunci."}>
                  <Select value={form.authMode} onValueChange={(value) => updateForm("authMode", value)} disabled={isLocked}>
                    <SelectTrigger id="ai-auth-mode"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bearer">Bearer token</SelectItem>
                      <SelectItem value="x-api-key">Header X-API-Key</SelectItem>
                      <SelectItem value="none">Tanpa kunci (lokal)</SelectItem>
                    </SelectContent>
                  </Select>
                </ControlField>
                <div className="field">
                  <label className="label" htmlFor="ai-api-key">Kunci API{form.authMode === "none" ? <span className="opt">Opsional</span> : null}</label>
                  <InputGroup id="ai-api-key" leadingIcon="key" type="password" autoComplete="new-password" value={form.apiKey} onChange={(event) => updateForm("apiKey", event.target.value)} placeholder={selectedProvider?.apiKeyConfigured ? "Tersimpan · isi untuk mengganti" : "Tempel API key"} disabled={isLocked} />
                  <span className="hint">{selectedProvider?.apiKeyConfigured ? "API key tersimpan; kosongkan untuk mempertahankannya." : "Masukkan kunci dari penyedia."}{!keyStorageReady ? " Penyimpanan kunci belum siap di server; Baca model dan Simpan & uji tetap bisa dicoba." : ""}</span>
                </div>
                <div className="stack gap-3">
                  <label className="switch" style={{ alignItems: "flex-start" }}><input type="checkbox" checked={Boolean(form.isDefault)} onChange={(event) => updateForm("isDefault", event.target.checked)} disabled={isLocked} /><span className="stack gap-0-5"><span>Jadikan koneksi bawaan</span><span className="hint">{defaultProvider ? `Koneksi bawaan saat ini: ${defaultProvider.label}.` : "Dipakai oleh Global AAPM Provider."}</span></span></label>
                  <label className="switch" style={{ alignItems: "flex-start" }}><input type="checkbox" checked={Boolean(form.allowLocal)} onChange={(event) => updateForm("allowLocal", event.target.checked)} disabled={isLocked} /><span className="stack gap-0-5"><span>Izinkan endpoint privat</span><span className="hint">Untuk alamat lokal atau jaringan privat (HTTP loopback / LAN). Biarkan mati untuk penyedia cloud.</span></span></label>
                </div>
              </>
            ))}
            {formSection("Lanjutan", "Ubah hanya bila penyedia membutuhkannya.", (
              <details className="inset" style={{ padding: "12px 16px" }} open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}>
                <summary className="row gap-3" style={{ cursor: "pointer", listStyle: "none" }}><Ic name={advancedOpen ? "chev-down" : "chev-right"} size="sm" className="t-muted" /><span className="stack"><span className="t-support t-strong">Pengaturan lanjutan</span><span className="t-caption t-muted">Streaming, vision, path endpoint, token, timeout, dan custom headers.</span></span></summary>
                <div className="stack gap-4" style={{ paddingTop: 16 }}>
                  <label className="switch"><input type="checkbox" checked={Boolean(form.supportsStreaming)} onChange={(event) => updateForm("supportsStreaming", event.target.checked)} disabled={isLocked} />Streaming respons</label>
                  <label className="switch"><input type="checkbox" checked={Boolean(form.supportsVision)} onChange={(event) => updateForm("supportsVision", event.target.checked)} disabled={isLocked} />Input gambar (vision)</label>
                  <div className="form-grid">
                    <Field id="ai-chat-path" label="Chat path"><Input value={form.chatPath} onChange={(event) => updateForm("chatPath", event.target.value)} placeholder="/chat/completions" disabled={isLocked} /></Field>
                    <Field id="ai-models-path" label="Models path"><Input value={form.modelsPath} onChange={(event) => updateForm("modelsPath", event.target.value)} placeholder="/models" disabled={isLocked} /></Field>
                    <Field id="ai-max-tokens" label="Max output tokens"><Input type="number" min="64" max="8192" value={form.maxTokens} onChange={(event) => updateForm("maxTokens", event.target.value)} disabled={isLocked} /></Field>
                    <Field id="ai-timeout" label="Timeout (detik)"><Input type="number" min="8" max="120" value={form.timeoutSeconds} onChange={(event) => updateForm("timeoutSeconds", event.target.value)} disabled={isLocked} /></Field>
                    <Field id="ai-temperature" label="Temperature"><Input type="number" min="0" max="2" step="0.1" value={form.temperature} onChange={(event) => updateForm("temperature", event.target.value)} disabled={isLocked} /></Field>
                  </div>
                  <Field id="ai-headers" label="Custom headers (JSON, opsional)" hint="Object JSON. Jangan simpan kredensial di sini.">
                    <Textarea value={form.headersText} onChange={(event) => updateForm("headersText", event.target.value)} placeholder={'{\n  "X-Workspace": "academy"\n}'} rows={3} disabled={isLocked} className="t-mono" />
                  </Field>
                </div>
              </details>
            ))}
            {testResult ? (
              <div className="alert alert-success" role="status">
                <Ic name="check-circle" />
                <div className="stack gap-0-5"><span className="alert-title">Uji koneksi berhasil · {testResult.providerLabel}</span><span className="t-muted">Balasan model <span className="t-mono">{testResult.model}</span>: “{testResult.reply || "AAPM AI siap."}”</span></div>
              </div>
            ) : null}
          </div>
          <div className="card-foot wrap">
            {!isCreating && selectedProvider ? (
              <div className="row gap-2">
                <button type="button" className="btn btn-danger-soft btn-sm" onClick={() => setDeleteTarget(selectedProvider)} disabled={isBusy || isLocked}><Ic name="trash" />Hapus koneksi</button>
                {!selectedProvider.isActive ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActive(selectedProvider.id)} disabled={isBusy || isLocked}>Jadikan aktif</button> : null}
              </div>
            ) : null}
            <div className="row gap-2 ml-auto">
              <button type="button" className="btn btn-secondary" onClick={() => persist({ testAfter: true })} disabled={isBusy || isLocked} aria-busy={isTesting || undefined}>{isTesting ? "Menguji…" : "Simpan & uji"}</button>
              <button type="button" className="btn btn-primary" onClick={() => persist()} disabled={isBusy || isLocked} aria-busy={isSaving || undefined}>{isSaving ? "Menyimpan…" : "Simpan"}</button>
            </div>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Hapus ${deleteTarget?.label || "koneksi"}?`}
        description="Koneksi ini akan dihapus dari registry global. Riwayat chat tidak ikut terhapus; koneksi lain tetap aman."
        confirmLabel="Hapus koneksi"
        destructive
        onConfirm={deleteProvider}
      />
    </AdminPageFrame>
  );
}
