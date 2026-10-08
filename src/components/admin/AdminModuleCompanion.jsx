// @ts-nocheck
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AapmIcon from "@/components/icons/AapmIcon";
import {
  Badge,
  Button,
  ConfirmDialog,
  Input,
  Surface,
  useToast,
} from "@/components/primitives";
import { nativeApi } from "@/api/nativeClient";
import { useAdminAiSettings } from "@/lib/useAdminData";
import {
  companionCourseModules,
  companionMaterialSource,
  companionModuleContext,
  companionModuleDraftPayload,
  companionOrderPayload,
} from "@/lib/adminCompanion";

const ACTIONS = [
  { id: "module_draft", label: "Susun isi", icon: "ai", description: "Judul, outcome, dan praktik" },
  { id: "title", label: "Judul & ringkasan", icon: "edit", description: "Lebih jelas dan mudah dicari" },
  { id: "copy", label: "Copywriting materi", icon: "type", description: "Rapikan teks dan format" },
  { id: "review", label: "Audit modul", icon: "checkRead", description: "Cari bagian yang belum kuat" },
];

const COURSE_ACTION = { id: "order", label: "Susun urutan", icon: "reorder", description: "Sarankan ritme belajar" };

function ProviderBadge({ settings, error, loading }) {
  const ready = settings ? Boolean(settings.enabled && settings.apiKeyConfigured) : null;
  const status = error
    ? { label: "Provider belum terbaca", icon: "info", className: "bg-surface-subtle text-muted-foreground" }
    : loading
      ? { label: "Memeriksa provider…", icon: "refresh", className: "bg-surface-subtle text-muted-foreground" }
      : ready
        ? { label: `${settings.providerLabel || "Provider AI"} siap`, icon: "checkRead", className: "bg-tint-green text-tint-green-foreground" }
        : { label: "Mode lokal / perlu konfigurasi", icon: "info", className: "bg-tint-orange text-tint-orange-foreground" };
  return <Badge variant="soft" className={`max-w-full truncate text-[11px] ${status.className}`}><AapmIcon name={status.icon} className={`h-3 w-3 ${status.icon === "refresh" ? "animate-spin" : ""}`} />{status.label}</Badge>;
}

function SuggestionPreview({ suggestion, modules }) {
  const payload = suggestion?.payload || {};
  const orderIds = Array.isArray(payload.moduleIds) ? payload.moduleIds.map((id) => String(id)) : [];
  const moduleById = new Map(companionCourseModules(modules).map((module) => [String(module.id), module]));
  const fields = [
    ["Judul", payload.title],
    ["Ringkasan", payload.summary],
    ["Tugas praktik", payload.practicalAssignment],
  ].filter(([, value]) => value);
  return <div className="mt-2 space-y-2 text-xs">
    {fields.map(([label, value]) => <div key={label} className="rounded-[var(--radius-control)] bg-surface-subtle px-3 py-2"><p className="font-semibold text-foreground">{label}</p><p className="mt-0.5 whitespace-pre-wrap leading-5 text-muted-foreground">{value}</p></div>)}
    {[['Tujuan', payload.learningObjectives], ['Poin penting', payload.keyTakeaways], ['Checklist', payload.checklist]].map(([label, values]) => Array.isArray(values) && values.length ? <div key={label} className="rounded-[var(--radius-control)] bg-surface-subtle px-3 py-2"><p className="font-semibold text-foreground">{label}</p><ul className="mt-1 space-y-0.5 text-muted-foreground">{values.slice(0, 6).map((item, index) => <li key={`${label}-${index}`}>• {item}</li>)}</ul></div> : null)}
    {Array.isArray(payload.materialBlocks) && payload.materialBlocks.length > 0 && <div className="rounded-[var(--radius-control)] bg-surface-subtle px-3 py-2 text-muted-foreground">{payload.materialBlocks.length} blok materi teks dipratinjau; media dan blok non-teks tetap dikunci.</div>}
    {Array.isArray(payload.issues) && payload.issues.length > 0 && <ul className="rounded-[var(--radius-control)] bg-surface-subtle px-3 py-2 text-muted-foreground">{payload.issues.slice(0, 8).map((item, index) => <li key={`issue-${index}`}>• {item}</li>)}</ul>}
    {orderIds.length > 0 && <ol className="rounded-[var(--radius-control)] bg-surface-subtle px-3 py-2 text-muted-foreground">{orderIds.map((id, index) => <li key={id}>{index + 1}. {moduleById.get(id)?.title || `Modul ${moduleById.get(id)?.moduleNumber || id}`}</li>)}</ol>}
  </div>;
}

export default function AdminModuleCompanion({ module = {}, modules = [], scope = "module", onApplyModule, onApplyOrder, className = "" }) {
  const { toast: ownToast } = useToast();
  const { data: aiSettings, error: aiSettingsError, isLoading: isLoadingAiSettings } = useAdminAiSettings();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState(scope === "course" ? "order" : "module_draft");
  const [instruction, setInstruction] = useState("");
  const [response, setResponse] = useState(null);
  const [pendingApply, setPendingApply] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const moduleContext = useMemo(() => companionModuleContext(module), [module]);
  const courseModules = useMemo(() => companionCourseModules(modules), [modules]);
  const materialSource = useMemo(() => companionMaterialSource(module), [module]);
  const availableActions = scope === "course"
    ? [COURSE_ACTION, ACTIONS.find((item) => item.id === "review")]
    : ACTIONS;
  const activeAction = availableActions.find((item) => item.id === action) || availableActions[0];
  const notify = (payload) => ownToast(payload);

  const run = async () => {
    setIsRunning(true);
    try {
      const next = await nativeApi.ai.moduleCompanion({
        action,
        message: instruction,
        module: moduleContext,
        modules: courseModules,
      });
      setResponse(next);
      notify({ title: "Saran APPI siap ditinjau", description: next?.fallback ? next.notice : "Tidak ada perubahan yang diterapkan otomatis." });
    } catch (error) {
      notify({ variant: "destructive", title: "APPI belum merespons", description: error?.message || "Coba lagi setelah provider siap." });
    } finally {
      setIsRunning(false);
    }
  };

  const prepareApply = (suggestion) => {
    if (suggestion.kind === "order") {
      const ids = companionOrderPayload(suggestion.payload, courseModules);
      if (!ids || typeof onApplyOrder !== "function") {
        notify({ variant: "destructive", title: "Urutan tidak aman diterapkan", description: "APPI mengembalikan ID modul yang tidak lengkap. Susun ulang secara manual." });
        return;
      }
      setPendingApply({ type: "order", ids, suggestion });
      return;
    }
    if (scope === "course" || typeof onApplyModule !== "function") return;
    const draft = companionModuleDraftPayload(suggestion.payload, materialSource);
    if (!draft) {
      notify({ variant: "destructive", title: "Saran belum lengkap", description: "Tidak ada field modul yang aman untuk dipratinjau." });
      return;
    }
    setPendingApply({ type: "module", draft, suggestion });
  };

  const confirmApply = async (event) => {
    event?.preventDefault();
    if (!pendingApply || isApplying) return;
    setIsApplying(true);
    try {
      if (pendingApply.type === "order") {
        if (await onApplyOrder?.(pendingApply.ids) === false) return;
      } else {
        await onApplyModule?.(pendingApply.draft);
        notify({ title: "Saran APPI diterapkan", description: "Perubahan masih berupa draft lokal. Tinjau lalu simpan modul." });
      }
      setPendingApply(null);
    } catch (error) {
      notify({ variant: "destructive", title: "Saran belum diterapkan", description: error.message || "Coba lagi." });
    } finally {
      setIsApplying(false);
    }
  };

  return <>
    <Surface variant="muted" className={`aapm-admin-companion overflow-hidden p-0 ${className}`}>
      <div className="flex flex-wrap items-center gap-3 px-3 py-3 sm:px-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-tint-orange text-brand-orange"><AapmIcon name="ai" className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">APPI companion</h3><ProviderBadge settings={aiSettings} error={aiSettingsError} loading={isLoadingAiSettings} /></div><p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">Bantu menyusun, meninjau, dan menulis ulang. Semua hasil tampil sebagai preview.</p></div>
        {aiSettings && !(aiSettings.enabled && aiSettings.apiKeyConfigured) && <Link to="/admin/ai-settings" className="hidden text-[11px] font-semibold text-brand-orange hover:underline sm:inline">Atur provider</Link>}
        <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 text-[11px]" onClick={() => setOpen((value) => !value)}><AapmIcon name={open ? "chevronUp" : "ai"} className="h-3.5 w-3.5" />{open ? "Tutup" : "Buka companion"}</Button>
      </div>
      {open && <div className="border-t border-border px-3 py-3 sm:px-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {availableActions.map((item) => <button key={item.id} type="button" className={`flex min-w-0 items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-2 text-left transition-colors ${action === item.id ? "bg-tint-orange text-foreground" : "bg-background/70 text-muted-foreground hover:bg-background hover:text-foreground"}`} onClick={() => setAction(item.id)}><AapmIcon name={item.icon} className={`h-3.5 w-3.5 shrink-0 ${action === item.id ? "text-brand-orange" : ""}`} /><span className="min-w-0"><span className="block truncate text-[11px] font-semibold">{item.label}</span><span className="block truncate text-[11px]">{item.description}</span></span></button>)}
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder={`Instruksi tambahan untuk ${activeAction?.label?.toLowerCase() || "APPI"}…`} className="h-9 min-w-0 flex-1 text-xs" disabled={isRunning} /><Button type="button" size="sm" className="h-9 shrink-0" onClick={run} disabled={isRunning}><AapmIcon name={isRunning ? "refresh" : "ai"} className={`h-3.5 w-3.5 ${isRunning ? "animate-spin" : ""}`} />{isRunning ? "Menganalisis…" : activeAction?.label || "Jalankan"}</Button></div>
        {response && <div className="mt-3 space-y-2" role="status" aria-live="polite"><div className="rounded-[var(--radius-control)] bg-background px-3 py-2 text-xs leading-5 text-muted-foreground">{response.reply}{response.notice && <div className="mt-1 text-[11px] text-brand-orange">{response.notice}</div>}</div>{response.suggestions?.length ? response.suggestions.map((suggestion) => <article key={suggestion.id} className="rounded-[var(--radius-control)] border border-border bg-background p-3"><div className="flex flex-wrap items-start gap-2"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><AapmIcon name={suggestion.kind === "review" ? "checkRead" : suggestion.kind === "order" ? "reorder" : "edit"} className="h-3.5 w-3.5 text-brand-orange" /><h4 className="text-xs font-semibold">{suggestion.title || "Saran APPI"}</h4></div>{suggestion.reason && <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{suggestion.reason}</p>}</div>{suggestion.kind !== "review" && <Button type="button" size="sm" variant="outline" className="h-7 shrink-0 px-2 text-[11px]" onClick={() => prepareApply(suggestion)}>{suggestion.kind === "order" ? "Gunakan urutan" : "Pratinjau penerapan"}</Button>}</div><SuggestionPreview suggestion={suggestion} modules={courseModules} /></article>) : <div className="rounded-[var(--radius-control)] bg-surface-subtle px-3 py-2 text-[11px] text-muted-foreground">Belum ada saran terstruktur. Coba instruksi yang lebih spesifik.</div>}</div>}
      </div>}
    </Surface>
    <ConfirmDialog open={Boolean(pendingApply)} onOpenChange={(openValue) => !openValue && !isApplying && setPendingApply(null)} loading={isApplying} title={pendingApply?.type === "order" ? "Terapkan susunan kurikulum APPI?" : "Masukkan saran APPI ke editor?"} description={pendingApply?.type === "order" ? "Urutan ini akan dikirim ke penyimpanan kurikulum. Tidak ada modul yang dihapus; Anda masih dapat mengubahnya lagi dari board." : "Field yang dipilih akan menggantikan draft lokal di editor. Isi server belum berubah sampai Anda meninjau dan memilih Simpan modul."} confirmLabel={pendingApply?.type === "order" ? "Terapkan urutan" : "Masukkan ke editor"} cancelLabel="Kembali ke preview" icon="solar:stars-minimalistic-bold-duotone" onConfirm={confirmApply} />
  </>;
}
