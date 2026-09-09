// @ts-nocheck
import React, { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import Image from "@tiptap/extension-image";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/primitives";
import { safeEditorialImage, safeEditorialLink } from "@/lib/editorialUrls";
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
  Image.configure({
    inline: false,
    allowBase64: false,
    resize: false,
    HTMLAttributes: {
      class: "aapm-rich-editor__image",
    },
  }),
  Markdown,
];

function ToolbarButton({ label, textLabel = "", active = false, disabled = false, onClick, onBeforeAction, children }) {
  const preserveEditorSelection = (event) => {
    if (event.button !== 0) return;
    onBeforeAction?.();
    // Keep the ProseMirror selection in place while the toolbar is clicked.
    // Without this, a browser can move focus to the button before the command runs.
    event.preventDefault();
  };

  const control = (
    <Button
      type="button"
      size={textLabel ? "sm" : "icon"}
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
      className={cn(
        textLabel ? "h-8 min-w-fit shrink-0 gap-1.5 px-2 text-[11px]" : "h-8 w-8 shrink-0 text-xs",
        active && "bg-tint-orange text-brand-orange",
      )}
    >
      <span className="inline-flex shrink-0 items-center justify-center">{children}</span>
      {textLabel && <span className="hidden md:inline">{textLabel}</span>}
    </Button>
  );

  if (textLabel) return control;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{control}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function TextIcon({ children }) {
  return <span aria-hidden="true" className="font-semibold leading-none">{children}</span>;
}

function ListGlyph({ ordered = false }) {
  return (
    <span aria-hidden="true" className="inline-flex items-start gap-1">
      <span className="w-3 text-right text-[10px] font-semibold leading-4">{ordered ? "1." : "•"}</span>
      <span className="flex flex-col gap-[3px] pt-[5px]">
        <span className="h-px w-3 rounded-full bg-current" />
        <span className="h-px w-3 rounded-full bg-current" />
        <span className="h-px w-3 rounded-full bg-current" />
      </span>
    </span>
  );
}

export default function RichTextEditor({ id, value = "", onChange = () => {}, onUploadImage }) {
  const onChangeRef = useRef(onChange);
  const selectionRef = useRef(null);
  const toolbarSelectionRef = useRef(null);
  const lastExternalValueRef = useRef(typeof value === "string" ? value : "");
  const [, refreshSelectionState] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState("");
  const [imageOpen, setImageOpen] = useState(false);
  const [imageValue, setImageValue] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [imageError, setImageError] = useState("");
  const [imageUploadState, setImageUploadState] = useState({ status: "idle", message: "" });
  const imageInputRef = useRef(null);
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
      lastExternalValueRef.current = sourceValue;
      const clean = sanitizeRichTextDocument(currentEditor.getJSON());
      if (JSON.stringify(clean) !== JSON.stringify(currentEditor.getJSON())) {
        currentEditor.commands.setContent(clean, { emitUpdate: false });
      }
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      const { from, to } = currentEditor.state.selection;
      selectionRef.current = { from, to };
      // Re-render the toolbar so its block-style label follows the caret when
      // the author moves between paragraphs or headings in this editor.
      refreshSelectionState((version) => version + 1);
    },
    onUpdate: ({ editor: currentEditor }) => {
      const { from, to } = currentEditor.state.selection;
      selectionRef.current = { from, to };
      // History buttons must follow every document transaction, not only
      // caret movement. Otherwise undo/redo can look disabled or enabled
      // until the author clicks somewhere else in the document.
      refreshSelectionState((version) => version + 1);
      // The Tiptap schema and paste sanitizer already constrain the live
      // document. Do not replace it during every keystroke: doing so resets
      // the ProseMirror transaction and makes spaces, caret position, and
      // paragraph flow feel like the editor is forcing a new line.
      onChangeRef.current(currentEditor.getMarkdown());
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const current = editor.getMarkdown();
    if (current === sourceValue) {
      lastExternalValueRef.current = sourceValue;
      return;
    }
    // onCreate may have removed unsafe nodes from the initial value. Keep that
    // clean document in place rather than immediately re-introducing the raw
    // source through this synchronization effect.
    if (sourceValue === lastExternalValueRef.current) return;
    lastExternalValueRef.current = sourceValue;
    editor.commands.setContent(sourceValue, { contentType: "markdown", emitUpdate: false });
  }, [editor, sourceValue]);

  const openLinkEditor = () => {
    if (!editor) return;
    rememberSelection();
    setImageOpen(false);
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

  const openImageEditor = () => {
    if (!editor) return;
    rememberSelection();
    setLinkOpen(false);
    setImageValue("");
    setImageAlt("");
    setImageError("");
    setImageUploadState({ status: "idle", message: "" });
    setImageOpen(true);
  };

  const insertImage = (source, fallbackAlt = "") => {
    if (!editor) return false;
    const safeSrc = safeEditorialImage(source);
    if (!safeSrc) {
      setImageError("Gunakan URL HTTPS gambar atau path gambar pada /assets/, /media/, atau /uploads/.");
      return false;
    }
    const selection = toolbarSelectionRef.current || selectionRef.current;
    editorChain(selection).setImage({
      src: safeSrc,
      alt: imageAlt.trim() || fallbackAlt,
      title: null,
    }).run();
    toolbarSelectionRef.current = null;
    setImageOpen(false);
    setImageError("");
    return true;
  };

  const applyImage = (event) => {
    event.preventDefault();
    insertImage(imageValue);
  };

  const uploadImage = async (file) => {
    if (!file) return;
    if (!onUploadImage) {
      setImageUploadState({ status: "error", message: "Unggah gambar belum tersedia pada ruang ini. Gunakan URL aman." });
      return;
    }
    setImageUploadState({ status: "loading", message: "Mengunggah dan memeriksa gambar…" });
    setImageError("");
    try {
      const result = await onUploadImage(file);
      const uploadedUrl = result?.media?.url || result?.url || result;
      if (!insertImage(uploadedUrl, file.name.replace(/\.[^.]+$/, ""))) {
        setImageUploadState({ status: "error", message: "Respons unggahan bukan gambar yang aman." });
        return;
      }
      setImageUploadState({ status: "success", message: "Gambar disisipkan pada posisi kursor." });
    } catch (error) {
      setImageUploadState({ status: "error", message: error?.message || "Gambar tidak dapat diunggah." });
    }
  };

  const rememberSelection = () => {
    if (!editor || editor.isDestroyed) return null;
    const { from, to } = editor.state.selection;
    selectionRef.current = { from, to };
    return selectionRef.current;
  };

  const editorChain = (selectionOverride = selectionRef.current) => {
    const chain = editor.chain().focus();
    const selection = selectionOverride;
    const maxPosition = editor.state.doc.content.size;
    if (selection && selection.from <= maxPosition && selection.to <= maxPosition) {
      chain.setTextSelection(selection);
    }
    return chain;
  };

  const restoreEditorSelection = (selection = selectionRef.current) => {
    if (!editor || editor.isDestroyed || !selection || typeof window === "undefined") return;
    const maxPosition = editor.state.doc.content.size;
    const nextSelection = {
      from: Math.min(selection.from, maxPosition),
      to: Math.min(selection.to, maxPosition),
    };

    // Radix Select returns focus to its trigger after an option is chosen. Let
    // that focus transition finish, then return the caret to the editor so the
    // author can keep typing and the style label stays tied to the same block.
    window.setTimeout(() => {
      if (!editor || editor.isDestroyed) return;
      editor.chain().focus().setTextSelection(nextSelection).run();
      selectionRef.current = nextSelection;
      refreshSelectionState((version) => version + 1);
    }, 0);
  };

  const activeHeadingLevel = editor && [1, 2, 3].find((level) => editor.isActive("heading", { level }));
  const blockStyle = activeHeadingLevel ? `heading-${activeHeadingLevel}` : "paragraph";

  const applyBlockStyle = (style) => {
    if (!editor) return;
    const selection = toolbarSelectionRef.current || selectionRef.current;
    const chain = editorChain(selection);
    if (style === "paragraph") {
      chain.setParagraph().run();
    } else {
      chain.setHeading({ level: Number(style.replace("heading-", "")) }).run();
    }
    restoreEditorSelection(selection);
  };

  if (!editor) {
    return <div className="aapm-token-panel border-input bg-surface-subtle px-3 py-4 text-xs text-muted-foreground">Menyiapkan editor materi…</div>;
  }

  return (
    <div id={id} className="aapm-rich-editor aapm-token-panel overflow-hidden border-input focus-within:border-brand-orange/45 focus-within:ring-1 focus-within:ring-brand-orange/10">
      <TooltipProvider delayDuration={250}>
        <div className="aapm-token-toolbar aapm-scrollbar sticky top-0 z-10 flex min-w-0 flex-nowrap items-center gap-0.5 overflow-x-auto p-1 backdrop-blur" role="toolbar" aria-label="Format materi">
        <Select
          value={blockStyle}
          onOpenChange={(open) => {
            if (open) {
              toolbarSelectionRef.current = rememberSelection();
              return;
            }
            restoreEditorSelection(toolbarSelectionRef.current || selectionRef.current);
            toolbarSelectionRef.current = null;
          }}
          onValueChange={applyBlockStyle}
        >
          <SelectTrigger
            type="button"
            aria-label="Gaya blok teks"
            title="Gaya blok teks"
            className="h-8 w-[8.5rem] shrink-0 px-2 text-xs"
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
        <ToolbarButton label="Daftar bullet" textLabel="Poin" active={editor.isActive("bulletList")} onBeforeAction={rememberSelection} onClick={() => editorChain().toggleBulletList().run()}>
          <ListGlyph />
        </ToolbarButton>
        <ToolbarButton label="Daftar bernomor" textLabel="Nomor" active={editor.isActive("orderedList")} onBeforeAction={rememberSelection} onClick={() => editorChain().toggleOrderedList().run()}>
          <ListGlyph ordered />
        </ToolbarButton>
        <ToolbarButton label="Kutipan" textLabel="Kutip" active={editor.isActive("blockquote")} onBeforeAction={rememberSelection} onClick={() => editorChain().toggleBlockquote().run()}>
          <span aria-hidden="true" className="text-sm font-bold">“</span>
        </ToolbarButton>
        <ToolbarButton label="Tautkan teks" textLabel="Tautan" active={editor.isActive("link")} onBeforeAction={rememberSelection} onClick={openLinkEditor}>
          <AapmIcon name="link" className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Lepas tautan" textLabel="Lepas" disabled={!editor.isActive("link")} onBeforeAction={rememberSelection} onClick={() => editorChain().unsetLink().run()}>
          <AapmIcon name="clear" className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Sisipkan gambar di posisi kursor" textLabel="Gambar" onBeforeAction={rememberSelection} onClick={openImageEditor}>
          <AapmIcon name="image" className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <ToolbarButton label="Urungkan perubahan (Ctrl/⌘+Z)" disabled={!editor.can().undo()} onBeforeAction={rememberSelection} onClick={() => editorChain(null).undo().run()}>
          <AapmIcon name="undo" className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Ulangi perubahan (Ctrl/⌘+Shift+Z atau Ctrl+Y)" disabled={!editor.can().redo()} onBeforeAction={rememberSelection} onClick={() => editorChain(null).redo().run()}>
          <AapmIcon name="redo" className="h-4 w-4" />
        </ToolbarButton>
        </div>
      </TooltipProvider>
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
          className="aapm-token-form flex flex-col gap-2 border-b border-border bg-tint-orange/45 p-2.5 sm:flex-row sm:items-start"
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
              className="h-9 text-xs"
            />
            {linkError && <p className="mt-1 text-[10px] text-danger" role="alert">{linkError}</p>}
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Button type="button" size="sm" onClick={applyLink} className="h-9 bg-brand-orange px-3 text-xs text-white hover:bg-brand-orange/90">Terapkan</Button>
            <Button type="button" size="sm" variant="outline" className="h-9 px-3 text-xs" onClick={() => setLinkOpen(false)}>Batal</Button>
          </div>
        </div>
      )}
      {imageOpen && (
        <div
          role="group"
          aria-label="Sisipkan gambar"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setImageOpen(false);
            }
          }}
          className="aapm-token-form flex flex-col gap-2 border-b border-border bg-tint-green/45 p-2.5"
        >
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.7fr)]">
            <div>
              <label htmlFor={`${id || "rich-text"}-image`} className="sr-only">URL gambar</label>
              <Input
                id={`${id || "rich-text"}-image`}
                value={imageValue}
                onChange={(event) => {
                  setImageValue(event.target.value);
                  setImageError("");
                }}
                placeholder="https://.../gambar.webp atau /uploads/gambar.webp"
                inputMode="url"
                autoCapitalize="off"
                spellCheck={false}
                autoFocus
                className="h-9 text-xs"
              />
            </div>
            <div>
              <label htmlFor={`${id || "rich-text"}-image-alt`} className="sr-only">Alt text gambar</label>
              <Input
                id={`${id || "rich-text"}-image-alt`}
                value={imageAlt}
                onChange={(event) => setImageAlt(event.target.value)}
                placeholder="Alt text (opsional)"
                maxLength={280}
                className="h-9 text-xs"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button type="button" size="sm" onClick={applyImage} className="h-9 bg-brand-green px-3 text-xs text-white hover:bg-brand-green/90">Sisipkan</Button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,image/avif,.jpg,.jpeg,.png,.gif,.webp,.avif"
              className="sr-only"
              disabled={imageUploadState.status === "loading"}
              onChange={(event) => {
                const [file] = event.target.files || [];
                event.target.value = "";
                if (file) void uploadImage(file);
              }}
            />
            <Button type="button" size="sm" variant="outline" className="h-9 px-3 text-xs" disabled={!onUploadImage || imageUploadState.status === "loading"} onClick={() => imageInputRef.current?.click()}>
              <AapmIcon name="fileCheck" className="h-3.5 w-3.5" />{imageUploadState.status === "loading" ? "Mengunggah…" : "Unggah gambar"}
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-9 px-3 text-xs" onClick={() => setImageOpen(false)}>Batal</Button>
            <span className="text-[10px] leading-4 text-muted-foreground">JPG, PNG, GIF, WebP, AVIF · maks. 20 MB</span>
          </div>
          {(imageError || imageUploadState.status !== "idle") && <p className={cn("text-[10px] leading-4", imageError || imageUploadState.status === "error" ? "text-danger" : imageUploadState.status === "success" ? "text-brand-green" : "text-muted-foreground")} role={imageError || imageUploadState.status === "error" ? "alert" : "status"}>{imageError || imageUploadState.message}</p>}
        </div>
      )}
      <EditorContent editor={editor} />
      <p className="border-t border-border/70 px-3 py-2 text-[10px] leading-4 text-muted-foreground">
        Konten tidak aman disaring sebelum diterbitkan.
      </p>
    </div>
  );
}
