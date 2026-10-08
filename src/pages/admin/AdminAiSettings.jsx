// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  Field,
  FormActions,
  FormGrid,
  FormSection,
  IconTile,
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
  StateView,
  Surface,
  Switch,
  SwitchField,
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
function ControlField({ id, label, hint, className, children }) {
  return (
    <div className={`aapm-field${className ? ` ${className}` : ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="aapm-field-hint">{hint}</p> : null}
    </div>
  );
}

function ProviderStatus({ provider }) {
  if (provider.isActive) return <Badge variant="soft" hue="green">Aktif</Badge>;
  if (provider.isDefault) return <Badge variant="soft" hue="orange">Default</Badge>;
  return <Badge variant="outline">Tersedia</Badge>;
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
    <div className="aapm-field">
      <div className="aapm-field-row">
        <Label htmlFor="ai-model">Model yang digunakan APPI</Label>
        <Badge variant={modelItems.length ? "soft" : "outline"} hue={modelItems.length ? "green" : undefined}>
          <AapmIcon name={modelItems.length ? "checkRead" : "info"} />
          {statusLabel}
        </Badge>
      </div>
      <InputGroup
        id="ai-model"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ketik ID model atau pilih dari daftar"
        disabled={disabled}
        trailing={(
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="aapm-model-picker__trigger" aria-label="Buka daftar model provider" disabled={disabled}>
                <AapmIcon name="chevronDown" />
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
                          value={`${model.id} ${model.label || ""}`}
                          onSelect={() => {
                            onChange(model.id);
                            setOpen(false);
                          }}
                          className="aapm-model-picker__item"
                        >
                          <AapmIcon name={model.id === value ? "checkRead" : "circle"} className={model.id === value ? "aapm-model-picker__check" : "aapm-model-picker__check is-idle"} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{model.label || model.id}</span>
                            {model.label && model.label !== model.id ? <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{model.id}</span> : null}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
              <div className="aapm-model-picker__footer">
                <span>{selectedModel ? `Dipilih: ${selectedModel.label || selectedModel.id}` : "ID model bisa diketik manual."}</span>
                <button type="button" className="aapm-link" onClick={() => setOpen(false)}>Tutup</button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      />
      <div className="aapm-field-row">
        <p className="aapm-field-hint">Pilih model yang dibaca dari endpoint, atau masukkan ID model manual.</p>
        <Button type="button" size="sm" variant="outline" onClick={onDiscover} disabled={disabled || isDiscovering}>
          <AapmIcon name={isDiscovering ? "loading" : "refresh"} />
          {isDiscovering ? "Membaca…" : "Baca model"}
        </Button>
      </div>
      {discoveryNote ? <p className="aapm-field-hint" data-tone={modelItems.length ? "success" : undefined}>{discoveryNote}</p> : null}
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
    setDiscoveryAttempted(false);
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
    let config;
    try { config = configPayload(); } catch (exception) { toast({ variant: "destructive", title: "Konfigurasi belum valid", description: exception.message }); return; }
    setDiscoveryAttempted(true);
    setDiscoveryNote("Menghubungi endpoint provider…");
    try {
      const resultModels = await discover.mutateAsync({ config });
      setDiscoveredModels(resultModels.models || []);
      setDiscoveryNote(resultModels.note || "");
      toast({
        title: resultModels.models?.length ? "Daftar model siap dipilih" : "Model belum ditemukan",
        description: resultModels.note || "Periksa endpoint models atau masukkan ID model manual.",
      });
    } catch (exception) {
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

  if (isLoading) return <AdminPageFrame title="Pengaturan APPI" description="Menyiapkan registry provider APPI."><AdminLoading label="Memuat provider AI…" /></AdminPageFrame>;
  if (error) return <AdminPageFrame title="Pengaturan APPI" description="Kelola koneksi AI global dan kompatibilitas local."><AdminError error={error} onRetry={refetch} /></AdminPageFrame>;

  const isSaving = save.isPending;
  const isTesting = test.isPending;
  const isDiscovering = discover.isPending;
  const isBusy = isSaving || isTesting || isDiscovering;
  const isLocked = lockedByPrivateConfig;

  return (
    <AdminPageFrame
      title="Pengaturan APPI"
      description="Satu kontrak untuk hosted API, gateway internal, jaringan privat, dan local AI. Provider aktif menjadi default global APPI."
      actions={(
        <Button type="button" variant="outline" onClick={() => createProvider()} disabled={isLocked}>
          <AapmIcon name="add" />
          Tambah provider
        </Button>
      )}
    >
      {isLocked ? (
        <Alert tone="warning" title="Registry dikunci konfigurasi server." description="Provider aktif dikelola dari private cPanel config. Admin tetap dapat melihat status dan menjalankan test." className="mb-5" />
      ) : null}

      <div className="aapm-ai-settings">
        <Surface className="aapm-ai-registry">
          <div className="aapm-ai-registry__head">
            <div className="min-w-0">
              <span className="aapm-eyebrow">Registry</span>
              <h2 className="aapm-ai-registry__title">Koneksi provider</h2>
            </div>
            <Badge variant="outline">{providers.length}</Badge>
          </div>
          <div className="aapm-ai-registry__list">
            {providers.length ? providers.map((provider) => (
              <button
                type="button"
                key={provider.id}
                className="aapm-provider-item"
                data-selected={selectedId === provider.id && !isCreating ? "true" : undefined}
                onClick={() => selectProvider(provider)}
              >
                <IconTile icon="ai" hue={provider.isActive ? "green" : "orange"} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="aapm-provider-item__top">
                    <span className="truncate text-sm font-semibold">{provider.label}</span>
                    <ProviderStatus provider={provider} />
                  </span>
                  <span className="aapm-provider-item__model">{provider.model}</span>
                  <span className="aapm-provider-item__meta">
                    <span>{provider.apiKeyConfigured ? "Credential siap" : provider.apiKeyRequired ? "Credential belum ada" : "Tanpa key"}</span>
                    <span aria-hidden="true">·</span>
                    <span>{provider.supportsStreaming ? "Streaming" : "Response biasa"}</span>
                  </span>
                </span>
              </button>
            )) : (
              <StateView kind="empty" icon="ai" title="Belum ada koneksi" description="Tambahkan provider pertama untuk mengaktifkan APPI." framed={false} compact />
            )}
          </div>
          <p className="aapm-ai-registry__foot">Learner memilih koneksi global yang tersedia tanpa pernah melihat API key.</p>
        </Surface>

        <Surface className="aapm-ai-editor">
          <header className="aapm-ai-editor__head">
            <IconTile icon="ai" hue="orange" size="md" />
            <div className="min-w-0 flex-1">
              <span className="aapm-eyebrow" data-hue="orange">{isCreating ? "Koneksi baru" : "Konfigurasi provider"}</span>
              <h2 className="aapm-ai-editor__title">{isCreating ? "Tambah provider AI" : form.label || "Provider AI"}</h2>
              <p className="aapm-ai-editor__lede">Satu kontrak untuk provider cloud, self-hosted, dan local.</p>
            </div>
            <label className="aapm-inline-switch">
              <span>Aktif</span>
              <Switch checked={Boolean(form.enabled)} onCheckedChange={(value) => updateForm("enabled", value)} disabled={isLocked} aria-label="Aktifkan provider" />
            </label>
          </header>

          <FormSection title="Identitas koneksi" description="Nama tampil di Admin dan di pilihan provider akun.">
            <FormGrid columns={2}>
              <Field id="ai-connection-label" label="Nama koneksi" hint="Contoh: OpenRouter produksi.">
                <Input value={form.label} onChange={(event) => updateForm("label", event.target.value)} placeholder="Nama koneksi" disabled={isLocked} />
              </Field>
              <ControlField id="ai-protocol" label="Preset / protokol" hint={currentPreset.description}>
                <Select
                  value={form.type}
                  onValueChange={(value) => {
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
            </FormGrid>
          </FormSection>

          <FormSection title="Endpoint & model" description="Server cPanel harus dapat menjangkau endpoint ini.">
            <Field id="ai-base-url" label="Base URL API" hint={`${endpointHint(form)} Server cPanel harus dapat menjangkau endpoint ini.`}>
              <Input value={form.baseUrl} onChange={(event) => updateForm("baseUrl", event.target.value)} placeholder={currentPreset.baseUrl || "https://gateway.example.com/v1"} disabled={isLocked} />
            </Field>
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
          </FormSection>

          <FormSection title="Autentikasi & akses" description="Key disimpan terenkripsi di server dan tidak dikirim kembali ke browser.">
            <FormGrid columns={2}>
              <ControlField id="ai-auth-mode" label="Autentikasi">
                <Select value={form.authMode} onValueChange={(value) => updateForm("authMode", value)} disabled={isLocked}>
                  <SelectTrigger id="ai-auth-mode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bearer">Authorization: Bearer</SelectItem>
                    <SelectItem value="x-api-key">X-API-Key</SelectItem>
                    <SelectItem value="none">Tanpa API key / local</SelectItem>
                  </SelectContent>
                </Select>
              </ControlField>
              <Field id="ai-api-key" label={`API key${form.authMode === "none" ? " (opsional)" : ""}`} hint={selectedProvider?.apiKeyConfigured ? "Kosongkan untuk mempertahankan key yang tersimpan." : "Masukkan key provider."}>
                <Input type="password" autoComplete="new-password" value={form.apiKey} onChange={(event) => updateForm("apiKey", event.target.value)} placeholder={selectedProvider?.apiKeyConfigured ? "Tersimpan · isi untuk mengganti" : "Tempel API key"} disabled={isLocked} />
              </Field>
            </FormGrid>
            <FormGrid columns={2}>
              <SwitchField id="ai-allow-local" label="Aktifkan endpoint privat" description="Izinkan HTTP loopback / LAN privat." checked={Boolean(form.allowLocal)} onCheckedChange={(value) => updateForm("allowLocal", value)} disabled={isLocked} />
              <SwitchField id="ai-default" label="Jadikan provider default" description="Dipakai oleh Global AAPM Provider." checked={Boolean(form.isDefault)} onCheckedChange={(value) => updateForm("isDefault", value)} disabled={isLocked} />
            </FormGrid>
          </FormSection>

          <Accordion type="single" collapsible value={advancedOpen ? "advanced" : ""} onValueChange={(value) => setAdvancedOpen(Boolean(value))} className="aapm-manage-accordion">
            <AccordionItem value="advanced">
              <AccordionTrigger>
                <span className="min-w-0">
                  <span className="block">Pengaturan lanjutan</span>
                  <span className="aapm-accordion-note">Streaming, vision, path endpoint, token, timeout, dan custom headers.</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <FormGrid columns={2}>
                  <SwitchField id="ai-streaming" label="Streaming response" description="APPI meneruskan delta untuk endpoint OpenAI-compatible." checked={Boolean(form.supportsStreaming)} onCheckedChange={(value) => updateForm("supportsStreaming", value)} disabled={isLocked} />
                  <SwitchField id="ai-vision" label="Input gambar / vision" description="Aktifkan hanya bila model provider mendukung vision." checked={Boolean(form.supportsVision)} onCheckedChange={(value) => updateForm("supportsVision", value)} disabled={isLocked} />
                </FormGrid>
                <FormGrid columns={2}>
                  <Field id="ai-chat-path" label="Chat path">
                    <Input value={form.chatPath} onChange={(event) => updateForm("chatPath", event.target.value)} placeholder="/chat/completions" disabled={isLocked} />
                  </Field>
                  <Field id="ai-models-path" label="Models path">
                    <Input value={form.modelsPath} onChange={(event) => updateForm("modelsPath", event.target.value)} placeholder="/models" disabled={isLocked} />
                  </Field>
                  <Field id="ai-max-tokens" label="Max output tokens">
                    <Input type="number" min="64" max="8192" value={form.maxTokens} onChange={(event) => updateForm("maxTokens", event.target.value)} disabled={isLocked} />
                  </Field>
                  <Field id="ai-timeout" label="Timeout (detik)">
                    <Input type="number" min="8" max="120" value={form.timeoutSeconds} onChange={(event) => updateForm("timeoutSeconds", event.target.value)} disabled={isLocked} />
                  </Field>
                  <Field id="ai-temperature" label="Temperature">
                    <Input type="number" min="0" max="2" step="0.1" value={form.temperature} onChange={(event) => updateForm("temperature", event.target.value)} disabled={isLocked} />
                  </Field>
                </FormGrid>
                <Field id="ai-headers" label="Custom headers (JSON, opsional)" hint="Object JSON. Jangan simpan credential di sini.">
                  <Textarea value={form.headersText} onChange={(event) => updateForm("headersText", event.target.value)} placeholder={'{\n  "X-Workspace": "academy"\n}'} rows={3} disabled={isLocked} className="font-mono text-xs" />
                </Field>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {testResult ? (
            <Alert tone="success" title="Test koneksi berhasil" description={`${testResult.providerLabel} · ${testResult.model}`}>
              <Textarea readOnly value={testResult.reply || "AAPM AI siap."} rows={2} className="mt-2 resize-none bg-background text-xs" aria-label="Balasan test koneksi" />
            </Alert>
          ) : null}

          <FormActions className="aapm-ai-editor__actions">
            {!isCreating && selectedProvider ? (
              <div className="aapm-ai-editor__actions-start">
                {!selectedProvider.isActive ? (
                  <Button type="button" variant="ghost" onClick={() => setActive(selectedProvider.id)} disabled={isBusy || isLocked}>Jadikan aktif</Button>
                ) : null}
                <Button type="button" variant="danger-soft" onClick={() => setDeleteTarget(selectedProvider)} disabled={isBusy || isLocked}>
                  <AapmIcon name="delete" />
                  Hapus
                </Button>
              </div>
            ) : null}
            <Button type="button" variant="outline" onClick={() => persist({ testAfter: true })} disabled={isBusy || isLocked} loading={isTesting}>
              {isTesting ? "Menguji…" : "Simpan & test"}
            </Button>
            <Button type="button" variant="ai" onClick={() => persist()} disabled={isBusy || isLocked} loading={isSaving}>
              {isSaving ? "Menyimpan…" : "Simpan provider"}
            </Button>
          </FormActions>
        </Surface>
      </div>

      <div className="aapm-ai-status-grid">
        <Surface className="aapm-ai-status">
          <IconTile icon={settings?.apiKeyConfigured ? "check" : "alert"} hue={settings?.apiKeyConfigured ? "green" : "orange"} size="sm" />
          <div className="min-w-0">
            <h3>{settings?.apiKeyConfigured ? "Provider aktif siap" : "Provider aktif belum punya credential"}</h3>
            <p>{settings?.providerLabel} · {settings?.model}</p>
            <p>{settings?.keyStorage === "private_config" ? "Private server config" : settings?.keyStorage === "encrypted_database" ? "Encrypted server storage" : "Belum terkonfigurasi"}</p>
          </div>
        </Surface>
        <Surface className="aapm-ai-status">
          <IconTile icon="global" hue="blue" size="sm" />
          <div className="min-w-0">
            <h3>Cakupan</h3>
            <p>OpenAI-compatible menjadi jalur universal: cloud, gateway, Docker, Ollama, LM Studio, LocalAI, vLLM, sampai endpoint internal.</p>
          </div>
        </Surface>
        <Surface className="aapm-ai-status">
          <IconTile icon="shield" hue="violet" size="sm" />
          <div className="min-w-0">
            <h3>Keamanan</h3>
            <p>API key dan custom headers terenkripsi AES-256-GCM. HTTP hanya dibuka dengan toggle dan dibatasi ke loopback / jaringan privat.</p>
          </div>
        </Surface>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Hapus ${deleteTarget?.label || "provider"}?`}
        description="Provider ini akan dihapus dari registry global. Riwayat chat tidak ikut terhapus; provider lain tetap aman."
        confirmLabel="Hapus provider"
        destructive
        onConfirm={deleteProvider}
      />
    </AdminPageFrame>
  );
}
