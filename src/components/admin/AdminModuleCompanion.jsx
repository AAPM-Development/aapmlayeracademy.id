// @ts-nocheck
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AapmIcon from "@/components/icons/AapmIcon";
import { appiAsset } from "@/components/appi/AppiMascot";
import { Ic } from "@/design-system/canvas";
import {
  ConfirmDialog,
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
    ? { label: "Provider belum terbaca", chip: "" }
    : loading
      ? { label: "Memeriksa provider…", chip: "" }
      : ready
        ? { label: `${settings.providerLabel || "Provider AI"} siap`, chip: "chip-success" }
        : { label: "Mode lokal / perlu konfigurasi", chip: "chip-warning" };
  return <span className={`chip chip-dot ${status.chip}`} style={{ maxWidth: "100%" }}><span className="t-clamp-1">{status.label}</span></span>;
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

  const providerReady = aiSettings ? Boolean(aiSettings.enabled && aiSettings.apiKeyConfigured) : null;
  return <>
    <section className={`card card-pad stack gap-3 aapm-admin-companion ${className}`} aria-labelledby="appi-companion-title" data-component="APPI companion">
      <div className="row gap-3">
        <span className="tile tile-round" data-hue="ai" style={{ overflow: "hidden" }}><img src={appiAsset(1)} alt="" style={{ width: 30, height: 30 }} /></span>
        <div className="stack gap-1" style={{ minWidth: 0 }}>
          <h3 className="card-title" id="appi-companion-title">Bantu dengan APPI</h3>
          <span className="row"><ProviderBadge settings={aiSettings} error={aiSettingsError} loading={isLoadingAiSettings} /></span>
        </div>
      </div>
      {providerReady === false ? <Link to="/admin/ai-settings" className="btn btn-link btn-sm" style={{ alignSelf: "flex-start" }}>Atur provider<Ic name="arrow-right" /></Link> : null}
      <div className="stack gap-2" role="radiogroup" aria-label="Tugas APPI">
        {availableActions.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={action === item.id}
            className={`card card-link row gap-3${action === item.id ? " card-selected" : ""}`}
            data-hue={action === item.id ? "ai" : undefined}
            style={{ padding: "10px 12px", textAlign: "left" }}
            onClick={() => setAction(item.id)}
          >
            <span className="tile tile-sm" data-hue="ai"><AapmIcon name={item.icon} /></span>
            <span className="stack grow" style={{ minWidth: 0 }}>
              <span className="t-support t-strong">{item.label}</span>
              <span className="t-caption t-muted">{item.description}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="field">
        <label className="label" htmlFor="appi-companion-instruction">Instruksi tambahan<span className="opt">Opsional</span></label>
        <textarea id="appi-companion-instruction" className="textarea" rows={2} value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder={`Fokus untuk ${activeAction?.label?.toLowerCase() || "APPI"}…`} disabled={isRunning} />
      </div>
      <button type="button" className="btn btn-ai btn-block" onClick={run} disabled={isRunning} aria-busy={isRunning || undefined}>
        {isRunning ? <span className="typing" aria-hidden="true"><i /><i /><i /></span> : <Ic name="sparkle" />}
        {isRunning ? "Menganalisis…" : activeAction?.label || "Jalankan"}
      </button>
      {response && (
        <div className="stack gap-2" role="status" aria-live="polite">
          <div className="inset t-support" style={{ padding: "10px 12px" }}>
            {response.reply}
            {response.notice && <p className="t-caption t-ai" style={{ marginTop: 4 }}>{response.notice}</p>}
          </div>
          {response.suggestions?.length ? response.suggestions.map((suggestion) => (
            <article key={suggestion.id} className="card card-pad-sm stack gap-2">
              <div className="row-start gap-2">
                <AapmIcon name={suggestion.kind === "review" ? "checkRead" : suggestion.kind === "order" ? "reorder" : "edit"} className="t-ai" />
                <div className="stack gap-0-5 grow" style={{ minWidth: 0 }}>
                  <h4 className="t-support t-strong">{suggestion.title || "Saran APPI"}</h4>
                  {suggestion.reason && <p className="t-caption t-muted">{suggestion.reason}</p>}
                </div>
              </div>
              <SuggestionPreview suggestion={suggestion} modules={courseModules} />
              {suggestion.kind !== "review" && <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => prepareApply(suggestion)}>{suggestion.kind === "order" ? "Gunakan urutan" : "Pratinjau penerapan"}</button>}
            </article>
          )) : <p className="inset t-caption t-muted" style={{ padding: "8px 12px" }}>Belum ada saran terstruktur. Coba instruksi yang lebih spesifik.</p>}
        </div>
      )}
      <p className="note">Semua saran tampil sebagai pratinjau dan baru diterapkan setelah Anda setujui.</p>
    </section>
    <ConfirmDialog open={Boolean(pendingApply)} onOpenChange={(openValue) => !openValue && !isApplying && setPendingApply(null)} loading={isApplying} title={pendingApply?.type === "order" ? "Terapkan susunan kurikulum APPI?" : "Masukkan saran APPI ke editor?"} description={pendingApply?.type === "order" ? "Urutan ini akan dikirim ke penyimpanan kurikulum. Tidak ada modul yang dihapus; Anda masih dapat mengubahnya lagi dari board." : "Field yang dipilih akan menggantikan draft lokal di editor. Isi server belum berubah sampai Anda meninjau dan memilih Simpan modul."} confirmLabel={pendingApply?.type === "order" ? "Terapkan urutan" : "Masukkan ke editor"} cancelLabel="Kembali ke preview" icon="solar:stars-minimalistic-bold-duotone" onConfirm={confirmApply} />
  </>;
}
