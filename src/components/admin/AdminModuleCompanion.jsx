// @ts-nocheck
import React, { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AapmIcon from "@/components/icons/AapmIcon";
import { appiAsset } from "@/components/appi/AppiMascot";
import { EditorialMarkdown } from "@/components/academy/EditorialContent";
import { Ic } from "@/design-system/canvas";
import { ConfirmDialog, useToast } from "@/components/primitives";
import { nativeApi } from "@/api/nativeClient";
import { useAdminAiSettings } from "@/lib/useAdminData";
import {
  companionCourseModules,
  companionMaterialSource,
  companionModuleContext,
  companionModuleDraftPayload,
  companionOrderPayload,
} from "@/lib/adminCompanion";
import { paragraphDiff } from "@/lib/paragraphDiff";

/** Whole-module tasks. "copy" rewrites every text block; media and links stay locked. */
const MODULE_TASKS = [
  { id: "module_draft", label: "Susun draf modul", icon: "ai", description: "Tujuan, poin penting, checklist, dan tugas praktik" },
  { id: "title", label: "Judul & ringkasan", icon: "edit", description: "Lebih jelas dan mudah dicari peserta" },
  { id: "copy", label: "Rapikan teks materi", icon: "type", description: "Semua blok teks; gambar, tautan, dan urutan tetap" },
  { id: "review", label: "Audit kualitas", icon: "checkRead", description: "Temukan bagian yang belum kuat" },
];
const COURSE_TASKS = [
  { id: "order", label: "Susun urutan", icon: "reorder", description: "Sarankan ritme belajar" },
  MODULE_TASKS[3],
];

/** One-tap help for the block selected on the canvas. */
const BLOCK_INTENTS = [
  { id: "improve", label: "Perbaiki tulisan", prompt: "Perbaiki ejaan, alur, dan kejelasan tanpa mengubah fakta atau istilah teknis." },
  { id: "simplify", label: "Sederhanakan", prompt: "Sederhanakan bahasa untuk operator kandang: kalimat pendek, istilah dijelaskan singkat." },
  { id: "example", label: "Tambah contoh lapangan", prompt: "Tambahkan satu contoh praktis dari kandang layer yang relevan. Jangan mengarang angka spesifik." },
  { id: "shorten", label: "Ringkas", prompt: "Ringkas menjadi sekitar setengah panjangnya; pertahankan poin penting." },
];

/** Audience and tone shortcuts that write into the instruction. */
const PRESETS = ["Bahasa sederhana untuk operator kandang", "Nada profesional untuk supervisor", "Lebih ringkas", "Tambah contoh lapangan"];

const FIELDS = [
  ["title", "Judul"],
  ["summary", "Ringkasan"],
  ["learningObjectives", "Tujuan pembelajaran"],
  ["keyTakeaways", "Poin penting"],
  ["checklist", "Checklist"],
  ["practicalAssignment", "Tugas praktik"],
];
const LIST_FIELDS = new Set(["learningObjectives", "keyTakeaways", "checklist"]);
const BLOCK_LABEL = { richText: "Teks", heading: "Judul bagian", callout: "Sorotan" };
// The server keeps one focused block up to 12,000 bytes; longer blocks use "Rapikan teks materi".
const MAX_BLOCK_CHARS = 8000;

/** A short plain-text label for a block: Markdown, images and link targets removed. */
const blockLabel = (value) => String(value || "")
  .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
  .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
  .replace(/⟦APPI_MEDIA_\d+⟧/g, "")
  .replace(/[#*_>`]/g, "")
  .replace(/\s+/g, " ")
  .trim();

const toLines = (value) => (Array.isArray(value) ? value : String(value || "").split(/\r?\n/)).map((item) => String(item).trim()).filter(Boolean);

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

/** A field value as the editor shows it: a list or a paragraph. */
function FieldValue({ field, value, empty = "Kosong" }) {
  if (LIST_FIELDS.has(field)) {
    const lines = toLines(value);
    return lines.length ? <ul className="appi-diff-list">{lines.slice(0, 6).map((line, index) => <li key={index}>{line}</li>)}</ul> : <span className="t-muted">{empty}</span>;
  }
  const text = String(value || "").trim();
  return text ? <span className="appi-diff-text">{text}</span> : <span className="t-muted">{empty}</span>;
}

/** Before → after for one value, so the editor sees exactly what changes. */
function BeforeAfter({ before, after }) {
  return (
    <div className="appi-diff">
      <div className="appi-diff-side appi-diff-before"><span className="t-overline">Sebelum</span>{before}</div>
      <div className="appi-diff-side appi-diff-after"><span className="t-overline">Sesudah</span>{after}</div>
    </div>
  );
}

/**
 * What changed inside a text block: unchanged paragraphs collapse to one line,
 * removed ones are struck through, added or rewritten ones are highlighted.
 */
function MaterialDiff({ before, after }) {
  const parts = paragraphDiff(before, after);
  if (!parts.some((part) => part.type !== "same")) return <p className="note">Tidak ada perubahan pada teks blok ini.</p>;
  const rows = [];
  let same = [];
  const flushSame = () => {
    if (same.length) rows.push({ type: "same", count: same.length, key: `same-${rows.length}` });
    same = [];
  };
  parts.forEach((part) => {
    if (part.type === "same") same.push(part);
    else {
      flushSame();
      rows.push({ ...part, key: `${part.type}-${rows.length}` });
    }
  });
  flushSame();
  return (
    <div className="appi-pdiff" aria-label="Perubahan teks blok">
      {rows.map((row) => row.type === "same" ? (
        <p key={row.key} className="appi-pdiff-same t-caption t-muted">{row.count} paragraf tidak berubah</p>
      ) : (
        <div key={row.key} className={`appi-pdiff-row appi-pdiff-${row.type}`}>
          <span className="appi-pdiff-tag">{row.type === "added" ? "Baru" : "Dihapus"}</span>
          <EditorialMarkdown className="appi-diff-md">{row.text}</EditorialMarkdown>
        </div>
      ))}
    </div>
  );
}

/**
 * APPI in the module editor's inspector: help for the selected block, then
 * whole-module tasks. Every result is a preview with before/after per field;
 * the editor picks what to keep, applies it to the local draft and can undo.
 * Nothing reaches the server until the module is saved.
 */
export default function AdminModuleCompanion({ module = {}, modules = [], scope = "module", selectedBlock = null, onApplyModule, onUndo, onApplyOrder, className = "" }) {
  const { toast } = useToast();
  const { data: aiSettings, error: aiSettingsError, isLoading: isLoadingAiSettings } = useAdminAiSettings();
  const tasks = scope === "course" ? COURSE_TASKS : MODULE_TASKS;
  const [task, setTask] = useState(tasks[0].id);
  const [instruction, setInstruction] = useState("");
  const [running, setRunning] = useState(null);
  const [response, setResponse] = useState(null);
  const [choices, setChoices] = useState({});
  const [blockResult, setBlockResult] = useState(null);
  const [applied, setApplied] = useState(null);
  const [pendingApply, setPendingApply] = useState(null);
  const [isApplying, setIsApplying] = useState(false);
  const instructionRef = useRef(null);
  const moduleContext = useMemo(() => companionModuleContext(module), [module]);
  const courseModules = useMemo(() => companionCourseModules(modules), [modules]);
  const materialSource = useMemo(() => companionMaterialSource(module), [module]);
  const activeTask = tasks.find((item) => item.id === task) || tasks[0];
  const providerReady = aiSettings ? Boolean(aiSettings.enabled && aiSettings.apiKeyConfigured) : null;

  const focusSource = selectedBlock ? materialSource.find((block) => block.id === selectedBlock.id) : null;
  const focusTooLong = Boolean(focusSource && String(focusSource.content || "").length > MAX_BLOCK_CHARS);
  const materialChars = materialSource.reduce((sum, block) => sum + String(block.sourceContent ?? block.content ?? "").length, 0);
  const filledFields = FIELDS.filter(([field]) => (LIST_FIELDS.has(field) ? toLines(module[field]).length : String(module[field] || "").trim())).length;

  const remember = (snapshot, label) => {
    if (!snapshot) return;
    setApplied({ snapshot, label });
    toast({ title: "Saran APPI masuk ke draf", description: "Tinjau di kanvas, lalu simpan modul. Bisa dibatalkan dari panel APPI." });
  };

  const undo = () => {
    if (!applied) return;
    onUndo?.(applied.snapshot);
    setApplied(null);
    toast({ title: "Perubahan APPI dibatalkan", description: "Draf kembali seperti sebelum saran diterapkan." });
  };

  const runModule = async () => {
    setRunning("module");
    setResponse(null);
    try {
      const next = await nativeApi.ai.moduleCompanion({ action: task, message: instruction, module: moduleContext, modules: courseModules });
      setResponse(next);
      // Everything a suggestion carries starts selected; the editor unticks what to keep.
      setChoices(Object.fromEntries((next?.suggestions || []).map((suggestion) => [suggestion.id, null])));
    } catch (error) {
      toast({ variant: "destructive", title: "APPI belum merespons", description: error?.message || "Coba lagi setelah provider siap." });
    } finally {
      setRunning(null);
    }
  };

  const runBlock = async (intent) => {
    if (!focusSource || focusTooLong) return;
    setRunning(`block:${intent.id}`);
    setBlockResult(null);
    try {
      const focusBlock = { id: focusSource.id, type: focusSource.type, content: focusSource.content, ...(focusSource.title !== undefined ? { title: focusSource.title } : {}) };
      const next = await nativeApi.ai.moduleCompanion({
        action: "block",
        message: [intent.prompt, instruction.trim()].filter(Boolean).join(" "),
        module: { ...moduleContext, focusBlock },
        modules: [],
      });
      const suggestion = (next?.suggestions || []).find((item) => Array.isArray(item.payload?.materialBlocks));
      const draft = suggestion ? companionModuleDraftPayload(suggestion.payload, materialSource) : null;
      const block = draft?.materialBlocks?.find((item) => item.id === focusSource.id);
      const before = focusSource.sourceContent ?? focusSource.content;
      if (!block) {
        setBlockResult({ intent, error: next?.fallback ? next.notice || "APPI sedang dalam mode lokal." : "APPI belum memberi versi baru untuk blok ini. Coba aksi lain atau tambah instruksi." });
        return;
      }
      setBlockResult({ intent, block, before, unchanged: block.content.trim() === String(before).trim() && (block.title ?? "") === (focusSource.title ?? "") });
    } catch (error) {
      setBlockResult({ intent, error: error?.message || "APPI belum merespons. Coba lagi." });
    } finally {
      setRunning(null);
    }
  };

  const applyBlock = () => {
    if (!blockResult?.block) return;
    const snapshot = onApplyModule?.({ fieldPresence: Object.fromEntries(FIELDS.map(([field]) => [field, false])), materialBlocks: [blockResult.block] });
    remember(snapshot, `Blok ${BLOCK_LABEL[blockResult.block.type] || "teks"}`);
    setBlockResult(null);
  };

  /** What a module suggestion offers: changed fields plus rewritten text blocks. */
  const offerFor = (suggestion) => {
    const draft = companionModuleDraftPayload(suggestion.payload, materialSource);
    if (!draft) return null;
    const fields = FIELDS.filter(([field]) => draft.fieldPresence?.[field] && (LIST_FIELDS.has(field) ? draft[field].length : draft[field]));
    return { draft, fields, material: draft.materialBlocks || [] };
  };
  const selectedKeys = (suggestion, offer) => choices[suggestion.id] ?? new Set([...offer.fields.map(([field]) => field), ...(offer.material.length ? ["material"] : [])]);
  const toggle = (suggestion, offer, key) => setChoices((current) => {
    const next = new Set(selectedKeys(suggestion, offer));
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return { ...current, [suggestion.id]: next };
  });

  const applySuggestion = (suggestion, offer) => {
    const keys = selectedKeys(suggestion, offer);
    const draft = {
      ...offer.draft,
      fieldPresence: Object.fromEntries(FIELDS.map(([field]) => [field, Boolean(offer.draft.fieldPresence?.[field] && keys.has(field))])),
      materialBlocks: keys.has("material") ? offer.material : [],
    };
    // Replacing several blocks of authored material deserves one more look.
    if (draft.materialBlocks.length > 1) {
      setPendingApply({ type: "module", draft, label: suggestion.title });
      return;
    }
    remember(onApplyModule?.(draft), suggestion.title);
  };

  const prepareOrder = (suggestion) => {
    const ids = companionOrderPayload(suggestion.payload, courseModules);
    if (!ids || typeof onApplyOrder !== "function") {
      toast({ variant: "destructive", title: "Urutan tidak aman diterapkan", description: "APPI mengembalikan ID modul yang tidak lengkap. Susun ulang secara manual." });
      return;
    }
    setPendingApply({ type: "order", ids });
  };

  const confirmApply = async (event) => {
    event?.preventDefault();
    if (!pendingApply || isApplying) return;
    setIsApplying(true);
    try {
      if (pendingApply.type === "order") {
        if (await onApplyOrder?.(pendingApply.ids) === false) return;
      } else {
        remember(onApplyModule?.(pendingApply.draft), pendingApply.label);
      }
      setPendingApply(null);
    } catch (error) {
      toast({ variant: "destructive", title: "Saran belum diterapkan", description: error.message || "Coba lagi." });
    } finally {
      setIsApplying(false);
    }
  };

  const fixIssue = (issue) => {
    setTask("module_draft");
    setInstruction(issue);
    window.requestAnimationFrame(() => {
      instructionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      instructionRef.current?.focus({ preventScroll: true });
    });
  };

  const addPreset = (preset) => setInstruction((current) => (current.includes(preset) ? current : [current.trim(), preset].filter(Boolean).join(". ")));

  return <>
    <section className={`stack gap-4 aapm-admin-companion ${className}`} aria-labelledby="appi-companion-title" data-component="APPI companion">
      <header className="row gap-3">
        <span className="tile tile-round" data-hue="ai" style={{ overflow: "hidden" }}><img src={appiAsset(1)} alt="" style={{ width: 30, height: 30 }} /></span>
        <div className="stack gap-1" style={{ minWidth: 0 }}>
          <h3 className="card-title" id="appi-companion-title">APPI untuk modul ini</h3>
          <span className="row wrap gap-2">
            <ProviderBadge settings={aiSettings} error={aiSettingsError} loading={isLoadingAiSettings} />
            {providerReady === false ? <Link to="/admin/ai-settings" className="btn btn-link btn-sm">Atur provider<Ic name="arrow-right" /></Link> : null}
          </span>
        </div>
      </header>

      {applied ? (
        <div className="alert alert-success appi-applied" role="status">
          <Ic name="check-circle" />
          <p className="grow"><span className="alert-title">{applied.label || "Saran APPI"} masuk ke draf.</span> Belum tersimpan sampai Anda menyimpan modul.</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={undo}><Ic name="undo" />Batalkan</button>
        </div>
      ) : null}

      {scope !== "course" ? (
        <section className="card card-pad-sm stack gap-3" aria-labelledby="appi-block-title">
          <div className="stack gap-0-5">
            <h4 className="t-overline t-muted" id="appi-block-title">Blok terpilih</h4>
            {focusSource ? (
              <p className="t-support"><span className="t-strong">{BLOCK_LABEL[focusSource.type] || "Teks"}</span><span className="t-muted"> · {blockLabel(focusSource.sourceContent ?? focusSource.content).slice(0, 80) || "Tanpa teks"}</span></p>
            ) : (
              <p className="t-caption t-muted">Pilih blok teks, judul bagian, atau sorotan di kanvas untuk bantuan khusus blok itu.</p>
            )}
          </div>
          {focusSource && focusTooLong ? <p className="note">Blok ini terlalu panjang untuk diedit per blok. Pakai "Rapikan teks materi" di bawah.</p> : null}
          {focusSource && !focusTooLong ? (
            <div className="row wrap gap-2" role="group" aria-label="Bantuan untuk blok terpilih">
              {BLOCK_INTENTS.map((intent) => {
                const busy = running === `block:${intent.id}`;
                return (
                  <button key={intent.id} type="button" className="btn btn-secondary btn-sm" disabled={Boolean(running)} aria-busy={busy || undefined} onClick={() => runBlock(intent)}>
                    {busy ? <span className="typing" aria-hidden="true"><i /><i /><i /></span> : <Ic name="sparkle" />}{intent.label}
                  </button>
                );
              })}
            </div>
          ) : null}
          {blockResult?.error ? <p className="alert alert-warning t-support" role="alert"><Ic name="alert" />{blockResult.error}</p> : null}
          {blockResult?.block ? (
            <div className="stack gap-2" role="status" aria-live="polite">
              {blockResult.unchanged ? (
                <p className="note">APPI tidak mengubah isi blok (gambar dan tautan dijaga). Coba aksi lain.</p>
              ) : (
                <MaterialDiff before={blockResult.before} after={blockResult.block.content} />
              )}
              <div className="row wrap gap-2">
                {!blockResult.unchanged ? <button type="button" className="btn btn-ai btn-sm" onClick={applyBlock}><Ic name="check" />Terapkan ke blok</button> : null}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBlockResult(null)}>Buang</button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="stack gap-3" aria-labelledby="appi-module-title">
        <div className="stack gap-0-5">
          <h4 className="t-overline t-muted" id="appi-module-title">{scope === "course" ? "Kurikulum" : "Seluruh modul"}</h4>
          {scope !== "course" ? <p className="t-caption t-muted">APPI membaca {filledFields} dari {FIELDS.length} field dan {materialSource.length} blok teks ({materialChars.toLocaleString("id-ID")} karakter).</p> : null}
        </div>
        <div className="stack gap-2" role="radiogroup" aria-label="Tugas APPI">
          {tasks.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={task === item.id}
              className={`card card-link row gap-3${task === item.id ? " card-selected" : ""}`}
              data-hue={task === item.id ? "ai" : undefined}
              style={{ padding: "10px 12px", textAlign: "left" }}
              onClick={() => setTask(item.id)}
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
          <label className="label" htmlFor="appi-companion-instruction">Arahan untuk APPI<span className="opt">Opsional</span></label>
          <textarea ref={instructionRef} id="appi-companion-instruction" className="textarea" rows={2} value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Misal: fokus pada biosecurity pintu masuk kandang" disabled={Boolean(running)} />
          <div className="row wrap gap-1-5" role="group" aria-label="Arahan cepat">
            {PRESETS.map((preset) => (
              <button key={preset} type="button" className="chip chip-hue appi-preset" data-hue="ai" aria-pressed={instruction.includes(preset)} onClick={() => addPreset(preset)}>{preset}</button>
            ))}
          </div>
        </div>
        <button type="button" className="btn btn-ai btn-block" onClick={runModule} disabled={Boolean(running)} aria-busy={running === "module" || undefined}>
          {running === "module" ? <span className="typing" aria-hidden="true"><i /><i /><i /></span> : <Ic name="sparkle" />}
          {running === "module" ? "APPI sedang menyusun…" : activeTask.label}
        </button>
      </section>

      {response ? (
        <section className="stack gap-3" role="status" aria-live="polite" aria-label="Saran APPI">
          {response.reply ? <p className="inset t-support" style={{ padding: "10px 12px" }}>{response.reply}{response.notice ? <span className="t-caption t-ai" style={{ display: "block", marginTop: 4 }}>{response.notice}</span> : null}</p> : null}
          {response.suggestions?.length ? response.suggestions.map((suggestion) => {
            if (suggestion.kind === "review") {
              const issues = Array.isArray(suggestion.payload?.issues) ? suggestion.payload.issues.map(String).filter(Boolean) : [];
              return (
                <article key={suggestion.id} className="card card-pad-sm stack gap-2">
                  <h5 className="t-support t-strong row gap-2"><AapmIcon name="checkRead" className="t-ai" />{suggestion.title || "Temuan audit"}</h5>
                  {suggestion.reason ? <p className="t-caption t-muted">{suggestion.reason}</p> : null}
                  {issues.length ? (
                    <ul className="stack gap-2">
                      {issues.slice(0, 8).map((issue, index) => (
                        <li key={index} className="row-start gap-2 appi-issue">
                          <Ic name="alert" size="xs" className="t-warning" style={{ marginTop: 4 }} />
                          <span className="grow t-support">{issue}</span>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => fixIssue(issue)}>Perbaiki</button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              );
            }
            if (suggestion.kind === "order") {
              return (
                <article key={suggestion.id} className="card card-pad-sm stack gap-2">
                  <h5 className="t-support t-strong">{suggestion.title || "Urutan modul"}</h5>
                  {suggestion.reason ? <p className="t-caption t-muted">{suggestion.reason}</p> : null}
                  <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => prepareOrder(suggestion)}>Gunakan urutan</button>
                </article>
              );
            }
            const offer = offerFor(suggestion);
            if (!offer || (!offer.fields.length && !offer.material.length)) return null;
            const keys = selectedKeys(suggestion, offer);
            return (
              <article key={suggestion.id} className="card card-pad-sm stack gap-3 appi-suggestion">
                <div className="stack gap-0-5">
                  <h5 className="t-support t-strong">{suggestion.title || "Saran APPI"}</h5>
                  {suggestion.reason ? <p className="t-caption t-muted">{suggestion.reason}</p> : null}
                </div>
                {offer.fields.map(([field, label]) => (
                  <div key={field} className="stack gap-1-5">
                    <label className="check t-support t-strong"><input type="checkbox" checked={keys.has(field)} onChange={() => toggle(suggestion, offer, field)} />{label}</label>
                    <BeforeAfter before={<FieldValue field={field} value={module[field]} />} after={<FieldValue field={field} value={offer.draft[field]} />} />
                  </div>
                ))}
                {offer.material.length ? (
                  <div className="stack gap-1-5">
                    <label className="check t-support t-strong"><input type="checkbox" checked={keys.has("material")} onChange={() => toggle(suggestion, offer, "material")} />Teks materi · {offer.material.length} blok</label>
                    <details className="inset appi-material">
                      <summary className="t-caption t-medium">Lihat perubahan per blok</summary>
                      <div className="stack gap-2" style={{ paddingTop: "var(--s-2)" }}>
                        {offer.material.map((block) => {
                          const source = materialSource.find((item) => item.id === block.id);
                          return (
                            <div key={block.id} className="stack gap-1">
                              <span className="t-caption t-strong">{BLOCK_LABEL[block.type] || "Teks"} · {blockLabel(source?.sourceContent ?? source?.content).slice(0, 48)}</span>
                              <MaterialDiff before={source?.sourceContent ?? source?.content ?? ""} after={block.content} />
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  </div>
                ) : null}
                <div className="row wrap gap-2">
                  <button type="button" className="btn btn-ai btn-sm" disabled={!keys.size} onClick={() => applySuggestion(suggestion, offer)}><Ic name="check" />Terapkan pilihan ({keys.size})</button>
                </div>
              </article>
            );
          }) : <p className="inset t-caption t-muted" style={{ padding: "8px 12px" }}>Belum ada saran terstruktur. Coba arahan yang lebih spesifik.</p>}
        </section>
      ) : null}

      <p className="note">Saran APPI selalu tampil sebagai preview. Yang Anda terapkan masuk ke draf lokal dan bisa dibatalkan.</p>
    </section>
    <ConfirmDialog
      open={Boolean(pendingApply)}
      onOpenChange={(openValue) => !openValue && !isApplying && setPendingApply(null)}
      loading={isApplying}
      title={pendingApply?.type === "order" ? "Terapkan susunan kurikulum APPI?" : "Ganti teks materi dengan versi APPI?"}
      description={pendingApply?.type === "order"
        ? "Urutan ini akan dikirim ke penyimpanan kurikulum. Tidak ada modul yang dihapus; Anda masih dapat mengubahnya lagi dari board."
        : `${pendingApply?.draft?.materialBlocks?.length || 0} blok teks akan diganti di draf lokal. Gambar, tautan, dan urutan blok tetap. Anda bisa membatalkannya dari panel APPI sebelum menyimpan.`}
      confirmLabel={pendingApply?.type === "order" ? "Terapkan urutan" : "Ganti teks materi"}
      cancelLabel="Kembali ke preview"
      icon="solar:stars-minimalistic-bold-duotone"
      onConfirm={confirmApply}
    />
  </>;
}
