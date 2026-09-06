// @ts-nocheck
import React, { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { Markdown } from "@tiptap/markdown";
import AapmIcon from "@/components/icons/AapmIcon";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/primitives";
import { safeEditorialLink } from "@/lib/editorialUrls";
import { sanitizePastedHtml, sanitizeRichTextDocument } from "@/lib/richTextSafety";
import { cn } from "@/lib/utils";

const extensions = [
  StarterKit.configure({
    code: false,
    codeBlock: false,
    horizontalRule: false,
    link: false,
    underline: false,
  }),
  Link.configure({
    autolink: false,
    enableClickSelection: false,
    linkOnPaste: true,
    openOnClick: false,
    isAllowedUri: (url) => Boolean(safeEditorialLink(url)),
  }),
  Underline,
  Markdown,
];

function ToolbarButton({ label, active = false, disabled = false, onClick, onBeforeAction, children }) {
  const preserveEditorSelection = (event) => {
    if (event.button !== 0) return;
    onBeforeAction?.();
    // Keep the ProseMirror selection in place while the toolbar is clicked.
    // Without this, a browser can move focus to the button before the command runs.
    event.preventDefault();
  };

  return (
    <Button
      type="button"
      size="icon"
      variant={active ? "soft" : "ghost"}
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onPointerDown={preserveEditorSelection}
      onMouseDown={preserveEditorSelection}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
      className={cn("h-8 w-8 rounded-lg text-xs", active && "bg-tint-orange text-brand-orange")}
    >
      {children}
    </Button>
  );
}

function TextIcon({ children }) {
  return <span aria-hidden="true" className="font-semibold leading-none">{children}</span>;
}

export default function RichTextEditor({ id, value = "", onChange = () => {} }) {
  const onChangeRef = useRef(onChange);
  const selectionRef = useRef(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState("");
  const sourceValue = typeof value === "string" ? value : "";

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    extensions,
    content: sourceValue,
    contentType: "markdown",
    editorProps: {
      attributes: {
        id: id ? `${id}-editor` : undefined,
        class: "aapm-rich-editor__content",
        spellcheck: "true",
        "aria-label": "Isi materi",
      },
      transformPastedHTML: sanitizePastedHtml,
    },
    onCreate: ({ editor: currentEditor }) => {
      const clean = sanitizeRichTextDocument(currentEditor.getJSON());
      if (JSON.stringify(clean) !== JSON.stringify(currentEditor.getJSON())) {
        currentEditor.commands.setContent(clean, { emitUpdate: false });
      }
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      const { from, to } = currentEditor.state.selection;
      selectionRef.current = { from, to };
    },
    onUpdate: ({ editor: currentEditor }) => {
      const clean = sanitizeRichTextDocument(currentEditor.getJSON());
      if (JSON.stringify(clean) !== JSON.stringify(currentEditor.getJSON())) {
        currentEditor.commands.setContent(clean, { emitUpdate: false });
      }
      onChangeRef.current(currentEditor.getMarkdown());
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const current = editor.getMarkdown();
    if (current === sourceValue) return;
    editor.commands.setContent(sourceValue, { contentType: "markdown", emitUpdate: false });
  }, [editor, sourceValue]);

  const openLinkEditor = () => {
    if (!editor) return;
    rememberSelection();
    setLinkValue(editor.getAttributes("link").href || "");
    setLinkError("");
    setLinkOpen(true);
  };

  const applyLink = (event) => {
    event.preventDefault();
    if (!editor) return;
    const safeHref = safeEditorialLink(linkValue);
    if (!safeHref) {
      setLinkError("Gunakan URL HTTPS atau path internal yang aman.");
      return;
    }
    editorChain().extendMarkRange("link").setLink({ href: safeHref }).run();
    setLinkOpen(false);
    setLinkError("");
  };

  const rememberSelection = () => {
    if (!editor || editor.isDestroyed) return;
    const { from, to } = editor.state.selection;
    selectionRef.current = { from, to };
  };

  const editorChain = () => {
    const chain = editor.chain().focus();
    const selection = selectionRef.current;
    const maxPosition = editor.state.doc.content.size;
    if (selection && selection.from <= maxPosition && selection.to <= maxPosition) {
      chain.setTextSelection(selection);
    }
    return chain;
  };

  const activeHeadingLevel = editor && [1, 2, 3].find((level) => editor.isActive("heading", { level }));
  const blockStyle = activeHeadingLevel ? `heading-${activeHeadingLevel}` : "paragraph";

  const applyBlockStyle = (style) => {
    if (!editor) return;
    const chain = editorChain();
    if (style === "paragraph") {
      chain.setParagraph().run();
      return;
    }
    chain.setHeading({ level: Number(style.replace("heading-", "")) }).run();
  };

  if (!editor) {
    return <div className="rounded-xl border border-input bg-surface-subtle px-3 py-4 text-xs text-muted-foreground">Menyiapkan editor materi…</div>;
  }

  return (
    <div id={id} className="aapm-rich-editor overflow-hidden rounded-xl border border-input bg-surface-elevated shadow-sm focus-within:border-brand-orange/65 focus-within:ring-2 focus-within:ring-brand-orange/10">
      <div className="flex min-w-0 flex-wrap items-center gap-0.5 border-b border-border bg-surface-subtle/75 p-1.5" role="toolbar" aria-label="Format materi">
        <Select
          value={blockStyle}
          onOpenChange={(open) => open && rememberSelection()}
          onValueChange={applyBlockStyle}
        >
          <SelectTrigger
            type="button"
            aria-label="Gaya blok teks"
            title="Gaya blok teks"
            className="h-8 w-[8.5rem] rounded-lg px-2 text-xs"
            onPointerDown={rememberSelection}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="paragraph">Paragraf</SelectItem>
            <SelectItem value="heading-1">Judul 1</SelectItem>
            <SelectItem value="heading-2">Judul 2</SelectItem>
            <SelectItem value="heading-3">Judul 3</SelectItem>
          </SelectContent>
        </Select>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <ToolbarButton label="Tebal (Ctrl/⌘+B)" active={editor.isActive("bold")} onBeforeAction={rememberSelection} onClick={() => editorChain().toggleBold().run()}>
          <TextIcon>B</TextIcon>
        </ToolbarButton>
        <ToolbarButton label="Miring (Ctrl/⌘+I)" active={editor.isActive("italic")} onBeforeAction={rememberSelection} onClick={() => editorChain().toggleItalic().run()}>
          <TextIcon><em>I</em></TextIcon>
        </ToolbarButton>
        <ToolbarButton label="Garis bawah (Ctrl/⌘+U)" active={editor.isActive("underline")} onBeforeAction={rememberSelection} onClick={() => editorChain().toggleUnderline().run()}>
          <TextIcon><u>U</u></TextIcon>
        </ToolbarButton>
        <ToolbarButton label="Coret" active={editor.isActive("strike")} onBeforeAction={rememberSelection} onClick={() => editorChain().toggleStrike().run()}>
          <TextIcon><s>S</s></TextIcon>
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <ToolbarButton label="Daftar bullet" active={editor.isActive("bulletList")} onBeforeAction={rememberSelection} onClick={() => editorChain().toggleBulletList().run()}>
          <AapmIcon name="solar:list-bold" className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Daftar bernomor" active={editor.isActive("orderedList")} onBeforeAction={rememberSelection} onClick={() => editorChain().toggleOrderedList().run()}>
          <span aria-hidden="true" className="text-[11px] font-semibold">1·</span>
        </ToolbarButton>
        <ToolbarButton label="Kutipan" active={editor.isActive("blockquote")} onBeforeAction={rememberSelection} onClick={() => editorChain().toggleBlockquote().run()}>
          <span aria-hidden="true" className="text-sm font-bold">“</span>
        </ToolbarButton>
        <ToolbarButton label="Tautkan teks" active={editor.isActive("link")} onBeforeAction={rememberSelection} onClick={openLinkEditor}>
          <AapmIcon name="solar:link-bold" className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Lepas tautan" disabled={!editor.isActive("link")} onBeforeAction={rememberSelection} onClick={() => editorChain().unsetLink().run()}>
          <AapmIcon name="solar:link-broken-minimalistic-bold" className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <ToolbarButton label="Urungkan (Ctrl/⌘+Z)" disabled={!editor.can().undo()} onBeforeAction={rememberSelection} onClick={() => editorChain().undo().run()}>
          <AapmIcon name="solar:alt-arrow-left-linear" className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Ulangi (Ctrl/⌘+Shift+Z)" disabled={!editor.can().redo()} onBeforeAction={rememberSelection} onClick={() => editorChain().redo().run()}>
          <AapmIcon name="solar:alt-arrow-right-linear" className="h-4 w-4" />
        </ToolbarButton>
      </div>
      {linkOpen && (
        <div
          role="group"
          aria-label="Tautkan teks"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              applyLink(event);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setLinkOpen(false);
            }
          }}
          className="flex flex-col gap-2 border-b border-border bg-tint-orange/45 p-2.5 sm:flex-row sm:items-start"
        >
          <div className="min-w-0 flex-1">
            <label htmlFor={`${id || "rich-text"}-link`} className="sr-only">URL tautan</label>
            <Input
              id={`${id || "rich-text"}-link`}
              value={linkValue}
              onChange={(event) => {
                setLinkValue(event.target.value);
                setLinkError("");
              }}
              placeholder="https://... atau /modules"
              inputMode="url"
              autoCapitalize="off"
              spellCheck={false}
              autoFocus
              className="h-9 rounded-lg text-xs"
            />
            {linkError && <p className="mt-1 text-[10px] text-danger" role="alert">{linkError}</p>}
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Button type="button" size="sm" onClick={applyLink} className="h-9 rounded-lg bg-brand-orange px-3 text-xs text-white hover:bg-brand-orange/90">Terapkan</Button>
            <Button type="button" size="sm" variant="outline" className="h-9 rounded-lg px-3 text-xs" onClick={() => setLinkOpen(false)}>Batal</Button>
          </div>
        </div>
      )}
      <EditorContent editor={editor} />
      <p className="border-t border-border/70 px-3 py-2 text-[10px] leading-4 text-muted-foreground">
        Paste dari Word, Google Docs, atau web akan dibersihkan. HTML, script, iframe, dan URL tidak aman tidak diterbitkan.
      </p>
    </div>
  );
}
