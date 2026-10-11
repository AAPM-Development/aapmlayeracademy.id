// @ts-nocheck
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "@/design-system";
import { Ic } from "@/design-system/canvas";
import { nativeApi } from "@/api/nativeClient";
import { useCreateAdminModule } from "@/lib/useAdminData";
import { companionCourseModules } from "@/lib/adminCompanion";

/**
 * Curriculum editing in place, the way objectives are added inside a module:
 * type a title, press Enter, the draft module appears in the chapter. A new
 * chapter is a card that turns real once its first module is created. APPI can
 * suggest modules for a chapter; each suggestion is added with one tap.
 */

const editorPath = (courseId, moduleId, panel) => `/admin/courses/${courseId}/modules/${moduleId}${panel ? `?panel=${panel}` : ""}`;

function useModuleCreator(courseId) {
  const createModule = useCreateAdminModule();
  const { toast } = useToast();
  const create = async ({ levelNumber, levelName, title, summary = "" }) => {
    // The number is left to the server; the curriculum is the one being edited.
    const created = await createModule.mutateAsync({ curriculumId: courseId, levelNumber, levelName, title: title.trim(), summary, moduleNumber: 0 });
    return { id: created?.id ?? created?.module?.id, levelNumber, title: title.trim(), courseId };
  };
  const fail = (error) => toast({ variant: "destructive", title: "Modul belum ditambahkan", description: error?.message || "Coba lagi." });
  return { create, fail, busy: createModule.isPending };
}

/** What was just added, with the two next steps: open it, or let APPI fill it. */
function AddedNote({ added, courseId, onDismiss }) {
  if (!added) return null;
  return (
    <p className="row wrap gap-2 t-caption curriculum-added" role="status">
      <Ic name="check-circle" size="xs" className="t-success" />
      <span className="grow" style={{ minWidth: 0 }}>“{added.title}” ditambahkan sebagai draf di Chapter {added.levelNumber}.</span>
      {added.id ? <Link className="btn btn-link btn-sm" to={editorPath(courseId, added.id)}>Buka editor</Link> : null}
      {added.id ? <Link className="btn btn-link btn-sm curriculum-added-appi" to={editorPath(courseId, added.id, "appi")}><Ic name="sparkle" />Isi dengan APPI</Link> : null}
      <button type="button" className="btn btn-ghost btn-sm btn-icon btn-quiet" aria-label="Tutup catatan" onClick={onDismiss}><Ic name="x" /></button>
    </p>
  );
}

/** The last row of a chapter: a title field that creates a draft module on Enter. */
export function InlineModuleAdd({ courseId, level, inputRef = null }) {
  const [title, setTitle] = useState("");
  const [added, setAdded] = useState(null);
  const { create, fail, busy } = useModuleCreator(courseId);
  const id = `add-module-ch${level.levelNumber}`;
  const submit = async (event) => {
    event?.preventDefault();
    if (!title.trim() || busy) return;
    try {
      setAdded(await create({ levelNumber: level.levelNumber, levelName: level.levelName, title }));
      setTitle("");
    } catch (error) { fail(error); }
  };
  return (
    <div className="curriculum-add">
      <form className="row gap-2 curriculum-add-row" onSubmit={submit}>
        <span className="egg egg-xs curriculum-add-egg" aria-hidden="true"><Ic name="plus" /></span>
        <label className="sr-only" htmlFor={id}>Judul modul baru di Chapter {level.levelNumber}</label>
        <input ref={inputRef} id={id} className="curriculum-add-input" value={title} maxLength={255} disabled={busy}
          placeholder="Tambah modul baru" enterKeyHint="done" onChange={(event) => setTitle(event.target.value)} />
        {title.trim() ? <button type="submit" className="btn btn-primary btn-sm" disabled={busy} aria-busy={busy || undefined}>{busy ? "Menambah…" : "Tambah"}</button> : null}
      </form>
      <AddedNote added={added} courseId={courseId} onDismiss={() => setAdded(null)} />
    </div>
  );
}

/** APPI's module ideas for one chapter; each is added with one tap. */
export function ChapterAppiSuggest({ courseId, level, allModules, onClose }) {
  const [state, setState] = useState({ loading: true, items: [], notice: "", levelName: "" });
  const [addedTitles, setAddedTitles] = useState([]);
  const { create, fail, busy } = useModuleCreator(courseId);
  useEffect(() => {
    let cancelled = false;
    nativeApi.ai.moduleCompanion({
      action: "chapter_modules",
      message: "",
      module: { focusChapter: { levelNumber: level.levelNumber, levelName: level.levelName || "", modules: (level.modules || []).map((module) => module.title) } },
      modules: companionCourseModules(allModules),
    }).then((response) => {
      if (cancelled) return;
      const suggestion = (response?.suggestions || []).find((item) => Array.isArray(item.payload?.modules));
      const items = (suggestion?.payload?.modules || [])
        .map((item) => ({ title: String(item?.title || "").trim().slice(0, 120), summary: String(item?.summary || "").trim().slice(0, 300) }))
        .filter((item) => item.title)
        .slice(0, 5);
      setState({ loading: false, items, notice: items.length ? "" : (response?.notice || "APPI belum punya usulan untuk chapter ini."), levelName: String(suggestion?.payload?.levelName || "") });
    }).catch((error) => { if (!cancelled) setState({ loading: false, items: [], notice: error?.message || "APPI belum merespons.", levelName: "" }); });
    return () => { cancelled = true; };
    // Asked once per opening of the panel.
  }, []);
  const add = async (item) => {
    try {
      await create({ levelNumber: level.levelNumber, levelName: level.levelName, title: item.title, summary: item.summary });
      setAddedTitles((current) => [...current, item.title]);
    } catch (error) { fail(error); }
  };
  return (
    <div className="curriculum-appi" role="region" aria-label={`Usulan modul APPI untuk Chapter ${level.levelNumber}`}>
      <div className="row gap-2">
        <span className="t-overline t-ai grow">Usulan APPI</span>
        <button type="button" className="btn btn-ghost btn-sm btn-icon btn-quiet" aria-label="Tutup usulan APPI" onClick={onClose}><Ic name="x" /></button>
      </div>
      {state.loading ? <p className="row gap-2 t-support t-muted"><span className="typing" aria-hidden="true"><i /><i /><i /></span>APPI menyusun usulan modul…</p> : null}
      {state.notice ? <p className="t-support t-muted">{state.notice}</p> : null}
      {state.items.length ? (
        <ul className="stack gap-2">
          {state.items.map((item) => {
            const done = addedTitles.includes(item.title);
            return (
              <li key={item.title} className="row-start gap-3 curriculum-appi-item">
                <div className="stack grow" style={{ minWidth: 0 }}>
                  <span className="t-support t-strong">{item.title}</span>
                  {item.summary ? <span className="t-caption t-muted">{item.summary}</span> : null}
                </div>
                {done
                  ? <span className="chip chip-success chip-dot">Ditambahkan</span>
                  : <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => add(item)}><Ic name="plus" />Tambah</button>}
              </li>
            );
          })}
        </ul>
      ) : null}
      {state.items.length ? <p className="t-caption t-muted">Usulan masuk sebagai draf; isi dan terbitkan dari editor modul.</p> : null}
    </div>
  );
}

/** A chapter that exists only on screen until its first module is created. */
export function NewChapterCard({ courseId, levelNumber, allModules, onCancel, onCreated }) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  // The chapter name APPI was asked about; typing afterwards does not re-ask.
  const [ideasFor, setIdeasFor] = useState("");
  const nameRef = useRef(null);
  const { create, fail, busy } = useModuleCreator(courseId);
  useEffect(() => { nameRef.current?.focus(); }, []);
  const submit = async (event) => {
    event?.preventDefault();
    if (!name.trim() || !title.trim() || busy) return;
    try {
      const added = await create({ levelNumber, levelName: name.trim(), title });
      onCreated?.(added);
    } catch (error) { fail(error); }
  };
  return (
    <section className="card card-tint anim-rise curriculum-new-chapter" data-hue="green" aria-label={`Chapter baru ${levelNumber}`}>
      <form className="stack gap-3" style={{ padding: "12px var(--card-pad)" }} onSubmit={submit}>
        <div className="row gap-3">
          <span className="tile tile-round"><Ic name="layers" /></span>
          <div className="stack grow" style={{ minWidth: 0 }}>
            <span className="t-overline t-ink">Chapter {levelNumber} · baru</span>
            <label className="sr-only" htmlFor="new-chapter-name">Nama chapter</label>
            <input ref={nameRef} id="new-chapter-name" className="curriculum-chapter-input" value={name} maxLength={160} disabled={busy}
              placeholder="Nama chapter, misal: Manajemen Air" onChange={(event) => setName(event.target.value)} />
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={busy}>Batal</button>
        </div>
        <div className="row gap-2 curriculum-add-row">
          <span className="egg egg-xs curriculum-add-egg" aria-hidden="true">1</span>
          <label className="sr-only" htmlFor="new-chapter-first-module">Judul modul pertama</label>
          <input id="new-chapter-first-module" className="curriculum-add-input" value={title} maxLength={255} disabled={busy}
            placeholder="Judul modul pertama" onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div className="row wrap gap-2">
          <button type="submit" className="btn btn-primary btn-sm" disabled={!name.trim() || !title.trim() || busy} aria-busy={busy || undefined}><Ic name="check" />{busy ? "Membuat…" : "Buat chapter"}</button>
          <button type="button" className="btn btn-ai-soft btn-sm" disabled={!name.trim() || busy} onClick={() => setIdeasFor(name.trim())}><Ic name="sparkle" />Usulan modul dari APPI</button>
          <span className="t-caption t-muted">Chapter tersimpan bersama modul pertamanya.</span>
        </div>
      </form>
      {ideasFor ? (
        <div style={{ padding: "0 var(--card-pad) 12px" }}>
          <ChapterIdeas key={ideasFor} name={ideasFor} levelNumber={levelNumber} allModules={allModules} onPick={(item) => { setTitle(item.title); setIdeasFor(""); }} onClose={() => setIdeasFor("")} />
        </div>
      ) : null}
    </section>
  );
}

/** For a chapter not created yet: APPI's ideas only fill the first-module field. */
function ChapterIdeas({ name, levelNumber, allModules, onPick, onClose }) {
  const [state, setState] = useState({ loading: true, items: [], notice: "" });
  useEffect(() => {
    let cancelled = false;
    nativeApi.ai.moduleCompanion({
      action: "chapter_modules",
      message: "",
      module: { focusChapter: { levelNumber, levelName: name, modules: [] } },
      modules: companionCourseModules(allModules),
    }).then((response) => {
      if (cancelled) return;
      const suggestion = (response?.suggestions || []).find((item) => Array.isArray(item.payload?.modules));
      const items = (suggestion?.payload?.modules || []).map((item) => ({ title: String(item?.title || "").trim().slice(0, 120), summary: String(item?.summary || "").trim() })).filter((item) => item.title).slice(0, 5);
      setState({ loading: false, items, notice: items.length ? "" : (response?.notice || "APPI belum punya usulan.") });
    }).catch((error) => { if (!cancelled) setState({ loading: false, items: [], notice: error?.message || "APPI belum merespons." }); });
    return () => { cancelled = true; };
    // Asked once per chapter name (the parent keys this panel by the name).
  }, []);
  return (
    <div className="curriculum-appi" role="region" aria-label="Usulan modul pertama dari APPI">
      <div className="row gap-2"><span className="t-overline t-ai grow">Pilih modul pertama</span><button type="button" className="btn btn-ghost btn-sm btn-icon btn-quiet" aria-label="Tutup usulan" onClick={onClose}><Ic name="x" /></button></div>
      {state.loading ? <p className="row gap-2 t-support t-muted"><span className="typing" aria-hidden="true"><i /><i /><i /></span>APPI menyusun usulan…</p> : null}
      {state.notice ? <p className="t-support t-muted">{state.notice}</p> : null}
      <ul className="stack gap-2">
        {state.items.map((item) => (
          <li key={item.title} className="row-start gap-3 curriculum-appi-item">
            <div className="stack grow" style={{ minWidth: 0 }}><span className="t-support t-strong">{item.title}</span>{item.summary ? <span className="t-caption t-muted">{item.summary}</span> : null}</div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onPick(item)}>Pakai</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
