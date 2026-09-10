// @ts-nocheck
import React, { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { Markdown } from "@tiptap/markdown";
import AapmIcon from "@/components/icons/AapmIcon";
import UploadProgress from "@/components/admin/UploadProgress";
import {
  Button,
  Input,
  Slider,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/primitives";
import { safeEditorialImage, safeEditorialLink } from "@/lib/editorialUrls";
import { sanitizePastedHtml, sanitizeRichTextDocument } from "@/lib/richTextSafety";
import {
  encodeRichTextImageTitle,
  enrichRichTextMarkdownImages,
  normaliseRichTextImageAlign,
  normaliseRichTextImageHeight,
  normaliseRichTextImageWidth,
  parseRichTextImageTitle,
} from "@/lib/richTextImageLayout";
import { cn } from "@/lib/utils";

const RichTextImage = Image.extend({
  addAttributes() {
    const parentAttributes = this.parent?.() || {};
    return {
      ...parentAttributes,
      title: {
        ...parentAttributes.title,
        parseHTML: (element) => parseRichTextImageTitle(element.getAttribute("title")).title,
      },
      width: {
        ...parentAttributes.width,
        parseHTML: (element) => normaliseRichTextImageWidth(element.getAttribute("width"))
          ?? parseRichTextImageTitle(element.getAttribute("title")).width,
      },
      height: {
        ...parentAttributes.height,
        parseHTML: (element) => normaliseRichTextImageHeight(element.getAttribute("height"))
          ?? parseRichTextImageTitle(element.getAttribute("title")).height,
      },
      align: {
        default: "left",
        parseHTML: (element) => normaliseRichTextImageAlign(element.getAttribute("data-image-align")),
        renderHTML: (attributes) => {
          const align = normaliseRichTextImageAlign(attributes.align);
          return {
            "data-image-align": align,
          };
        },
      },
    };
  },

  parseMarkdown: (token, helpers) => {
    const layout = parseRichTextImageTitle(token.title);
    return helpers.createNode("image", {
      src: token.href,
      alt: token.text,
      title: layout.title,
      width: layout.width,
      height: layout.height,
      align: layout.align,
    });
  },

  renderMarkdown: (node) => {
    const src = node.attrs?.src ?? "";
    const alt = node.attrs?.alt ?? "";
    const title = encodeRichTextImageTitle(node.attrs || {});
    return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
  },
});

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
  RichTextImage.configure({
    inline: false,
    allowBase64: false,
    resize: {
      enabled: true,
      directions: ["bottom-left", "bottom-right", "top-left", "top-right"],
      minWidth: 120,
      minHeight: 48,
      alwaysPreserveAspectRatio: true,
    },
    HTMLAttributes: {
      class: "aapm-rich-editor__image",
    },
  }),
  Markdown,
];

function ToolbarButton({ label, active = false, toggle = false, disabled = false, onClick, onBeforeAction, children }) {
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
      size="icon"
      variant={active ? "soft" : "ghost"}
      aria-label={label}
      aria-pressed={toggle ? active : undefined}
      title={label}
      disabled={disabled}
      onPointerDown={preserveEditorSelection}
      onMouseDown={preserveEditorSelection}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
      className={cn(
        "aapm-rich-editor__toolbar-button h-8 w-8 shrink-0 rounded-[var(--radius-sm)] text-xs focus-visible:ring-2 focus-visible:ring-brand-orange/25",
        active && "bg-tint-orange text-brand-orange",
      )}
    >
      <span className="inline-flex shrink-0 items-center justify-center">{children}</span>
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{control}</TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>{label}</TooltipContent>
    </Tooltip>
  );
}

function ToolbarGroup({ label, children, className }) {
  return <div className={cn("aapm-rich-editor__toolbar-group", className)} role="group" aria-label={label}>{children}</div>;
}

function ToolbarSeparator() {
  return <span className="aapm-rich-editor__toolbar-separator" aria-hidden="true" />;
}

function TextIcon({ children, className }) {
  return <span aria-hidden="true" className={cn("font-semibold leading-none", className)}>{children}</span>;
}

function ListGlyph({ ordered = false }) {
  return (
    <span aria-hidden="true" className="inline-flex h-4 w-[1.1rem] items-start gap-1">
      <span className="w-2.5 text-right text-[9px] font-semibold leading-4">{ordered ? "1." : "•"}</span>
      <span className="flex flex-1 flex-col gap-[3px] pt-[4px]">
        <span className="h-px w-full rounded-full bg-current" />
        <span className="h-px w-full rounded-full bg-current" />
        <span className="h-px w-full rounded-full bg-current" />
      </span>
    </span>
  );
}

const IMAGE_SIZE_OPTIONS = [
  { value: "natural", label: "Asli", ratio: null },
  { value: "small", label: "Kecil", ratio: 0.4 },
  { value: "medium", label: "Sedang", ratio: 0.62 },
  { value: "large", label: "Besar", ratio: 0.82 },
  { value: "full", label: "Lebar", ratio: 1 },
];

// Keep block styles visible like the compact style strip in familiar office
// editors. The active button follows the current block instead of hiding the
// choice behind a select menu, which makes the author's position obvious.
const BLOCK_STYLE_OPTIONS = [
  { value: "paragraph", label: "Paragraf", glyph: "P" },
  { value: "heading-1", label: "Judul 1", glyph: "H1" },
  { value: "heading-2", label: "Judul 2", glyph: "H2" },
  { value: "heading-3", label: "Judul 3", glyph: "H3" },
];

const IMAGE_ALIGNMENT_OPTIONS = [
  { value: "left", label: "Snap kiri", icon: "imageAlignLeft" },
  { value: "center", label: "Snap tengah", icon: "imageAlignCenter" },
  { value: "right", label: "Snap kanan", icon: "imageAlignRight" },
];

export default function RichTextEditor({ id, value = "", onChange = () => {}, onUploadImage }) {
  const onChangeRef = useRef(onChange);
  const selectionRef = useRef(null);
  const lastExternalValueRef = useRef(typeof value === "string" ? value : "");
  const [, refreshSelectionState] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState("");
  const [imageOpen, setImageOpen] = useState(false);
  const [imageValue, setImageValue] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [imageError, setImageError] = useState("");
  const [imageUploadState, setImageUploadState] = useState({ status: "idle", message: "", progress: null });
  const imageInputRef = useRef(null);
  const imageUploadControllerRef = useRef(null);
  const sourceValue = typeof value === "string" ? value : "";

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => () => imageUploadControllerRef.current?.abort(), []);

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
      // Re-render the toolbar so the active block-style button follows the
      // caret when the author moves between paragraphs or headings.
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
      const markdown = currentEditor.getMarkdown();
      onChangeRef.current(enrichRichTextMarkdownImages(markdown, currentEditor.getJSON()));
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
    imageUploadControllerRef.current?.abort();
    setImageUploadState({ status: "idle", message: "", progress: null });
    setImageOpen(true);
  };

  const insertImage = (source, fallbackAlt = "") => {
    if (!editor) return false;
    const safeSrc = safeEditorialImage(source);
    if (!safeSrc) {
      setImageError("Gunakan URL HTTPS gambar atau path gambar pada /assets/, /media/, atau /uploads/.");
      return false;
    }
    const selection = selectionRef.current;
    editorChain(selection).setImage({
      src: safeSrc,
      alt: imageAlt.trim() || fallbackAlt,
      title: null,
    }).run();
    setImageOpen(false);
    setImageError("");
    return true;
  };

  const applyImage = (event) => {
    event.preventDefault();
    insertImage(imageValue);
  };

  const selectedImageNode = editor?.state?.selection?.node?.type?.name === "image"
    ? editor.state.selection.node
    : null;
  const selectedImageAttrs = selectedImageNode?.attrs || {};

  const selectedImageDom = () => {
    if (!editor || !selectedImageNode) return null;
    const dom = editor.view.nodeDOM(editor.state.selection.from);
    if (!dom) return null;
    if (dom.nodeName?.toLowerCase() === "img") return dom;
    return dom.querySelector?.("img") || null;
  };

  const selectedImageAvailableWidth = () => {
    const image = selectedImageDom();
    const editorDom = editor?.view?.dom;
    let editorWidth = editorDom?.clientWidth || 0;
    // clientWidth includes the editor's horizontal padding. Fit controls
    // should target the actual writing canvas so the image can use the full
    // available line without being clipped by the content box.
    if (editorDom && typeof window !== "undefined") {
      const styles = window.getComputedStyle(editorDom);
      const padding = (Number.parseFloat(styles.paddingLeft) || 0)
        + (Number.parseFloat(styles.paddingRight) || 0);
      editorWidth = Math.max(0, editorWidth - padding);
    }
    const parentWidth = image?.parentElement?.parentElement?.clientWidth || image?.parentElement?.clientWidth || 0;
    return Math.max(120, editorWidth || parentWidth || 720);
  };

  const selectedImageSize = () => {
    const width = normaliseRichTextImageWidth(selectedImageAttrs.width);
    if (!width) return "natural";
    const ratio = width / selectedImageAvailableWidth();
    const sizedOptions = IMAGE_SIZE_OPTIONS.filter((option) => option.ratio !== null);
    return sizedOptions.reduce((closest, option) => (
      Math.abs(option.ratio - ratio) < Math.abs(closest.ratio - ratio) ? option : closest
    ), sizedOptions[sizedOptions.length - 1]).value;
  };

  const selectedImageWidthPercent = () => {
    const image = selectedImageDom();
    const width = normaliseRichTextImageWidth(selectedImageAttrs.width)
      ?? normaliseRichTextImageWidth(image?.offsetWidth)
      ?? selectedImageAvailableWidth();
    return Math.max(10, Math.min(100, Math.round((width / selectedImageAvailableWidth()) * 100)));
  };

  const updateSelectedImage = (attributes) => {
    if (!editor || !selectedImageNode) return;
    editor.chain().focus().updateAttributes("image", attributes).run();
  };

  const applySelectedImageAlignmentToDom = (align) => {
    const image = selectedImageDom();
    if (!image) return;
    const nextAlign = normaliseRichTextImageAlign(align);
    const container = image.closest?.("[data-resize-container]");
    const wrapper = image.closest?.("[data-resize-wrapper]");
    const justifyContent = nextAlign === "right" ? "flex-end" : nextAlign === "center" ? "center" : "flex-start";
    if (container) {
      container.dataset.imageAlign = nextAlign;
      container.style.justifyContent = justifyContent;
    }
    if (wrapper) wrapper.style.marginInline = "0";
    image.dataset.imageAlign = nextAlign;
    image.style.marginInline = "0";
  };

  const syncSelectedImageSizeToDom = (attributes = {}) => {
    if (!("width" in attributes || "height" in attributes)) return;
    const width = normaliseRichTextImageWidth(attributes.width);
    const height = normaliseRichTextImageHeight(attributes.height);
    const apply = () => {
      const image = selectedImageDom();
      if (!image) return;
      const wrapper = image.closest?.("[data-resize-wrapper]");
      image.style.width = width ? `${width}px` : "";
      image.style.height = height ? `${height}px` : "";
      // Tiptap's ResizableNodeView owns a wrapper around the image and applies
      // its width to the image element only. Keep both boxes in sync so fit,
      // presets, and the slider are visible immediately instead of being
      // constrained to the image's intrinsic width by max-width: 100%.
      if (wrapper) {
        wrapper.style.width = width ? `${width}px` : "";
        wrapper.style.height = height ? `${height}px` : "";
      }
    };
    apply();
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        apply();
        window.requestAnimationFrame(apply);
      });
    }
  };

  const setSelectedImageSize = (option) => {
    if (option.value === "natural") {
      const attributes = { width: null, height: null };
      updateSelectedImage(attributes);
      syncSelectedImageSizeToDom(attributes);
      return;
    }
    const width = Math.round(selectedImageAvailableWidth() * option.ratio);
    const attributes = {
      width: normaliseRichTextImageWidth(width),
      height: null,
    };
    updateSelectedImage(attributes);
    syncSelectedImageSizeToDom(attributes);
  };

  const setSelectedImageFit = () => {
    const attributes = {
      width: normaliseRichTextImageWidth(selectedImageAvailableWidth()),
      height: null,
    };
    updateSelectedImage(attributes);
    syncSelectedImageSizeToDom(attributes);
  };

  const setSelectedImageWidthPercent = (value) => {
    const percent = Math.max(10, Math.min(100, Number(value)));
    if (!Number.isFinite(percent)) return;
    const attributes = {
      width: normaliseRichTextImageWidth(Math.round(selectedImageAvailableWidth() * (percent / 100))),
      height: null,
    };
    updateSelectedImage(attributes);
    syncSelectedImageSizeToDom(attributes);
  };

  const setSelectedImageAlign = (align) => {
    const nextAlign = normaliseRichTextImageAlign(align);
    updateSelectedImage({ align: nextAlign });
    // The resizable NodeView can replace its image element during the same
    // transaction. Apply the visual placement after both the transaction and
    // the NodeView patch so the author gets immediate feedback.
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        applySelectedImageAlignmentToDom(nextAlign);
        window.requestAnimationFrame(() => applySelectedImageAlignmentToDom(nextAlign));
      });
    }
  };

  useEffect(() => {
    if (!editor || editor.isDestroyed || !selectedImageNode || typeof window === "undefined") return undefined;
    const image = selectedImageDom();
    const wrapper = image?.closest?.("[data-resize-wrapper]");
    if (!image || !wrapper) return undefined;

    const syncWrapperWithImage = () => {
      if (!image.isConnected || !wrapper.isConnected) return;
      // Tiptap changes the image element during a drag, while its wrapper
      // remains mounted. Mirror the live styles so the handles follow the
      // image instead of staying at the previous preset's edge.
      wrapper.style.width = image.style.width || "";
      wrapper.style.height = image.style.height || "";
    };

    const scheduleWrapperSync = () => {
      syncWrapperWithImage();
      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(syncWrapperWithImage);
      } else {
        window.setTimeout(syncWrapperWithImage, 0);
      }
    };

    syncWrapperWithImage();
    const resizeEvents = ["mousemove", "touchmove", "mouseup", "touchend"];
    resizeEvents.forEach((eventName) => document.addEventListener(eventName, scheduleWrapperSync));
    const observer = typeof window.ResizeObserver === "function"
      ? new window.ResizeObserver(scheduleWrapperSync)
      : null;
    observer?.observe(image);
    return () => {
      resizeEvents.forEach((eventName) => document.removeEventListener(eventName, scheduleWrapperSync));
      observer?.disconnect();
    };
  }, [editor, selectedImageNode, selectedImageAttrs.width, selectedImageAttrs.height]);

  const uploadImage = async (file) => {
    if (!file) return;
    if (!onUploadImage) {
      setImageUploadState({ status: "error", message: "Unggah gambar belum tersedia pada ruang ini. Gunakan URL aman." });
      return;
    }
    imageUploadControllerRef.current?.abort();
    const controller = new AbortController();
    imageUploadControllerRef.current = controller;
    setImageUploadState({ status: "loading", message: "Mengunggah dan memeriksa gambar…", progress: 0 });
    setImageError("");
    try {
      const result = await onUploadImage(file, {
        signal: controller.signal,
        onProgress: ({ percent }) => setImageUploadState((current) => current.status === "loading" ? { ...current, progress: percent } : current),
      });
      const uploadedUrl = result?.media?.url || result?.url || result;
      if (!insertImage(uploadedUrl, file.name.replace(/\.[^.]+$/, ""))) {
        setImageUploadState({ status: "error", message: "Respons unggahan bukan gambar yang aman.", progress: null });
        return;
      }
      setImageUploadState({ status: "success", message: "Gambar disisipkan pada posisi kursor.", progress: 100 });
    } catch (error) {
      setImageUploadState({
        status: error?.name === "AbortError" ? "cancelled" : "error",
        message: error?.name === "AbortError" ? "Unggahan dibatalkan." : error?.message || "Gambar tidak dapat diunggah.",
        progress: null,
      });
    } finally {
      if (imageUploadControllerRef.current === controller) imageUploadControllerRef.current = null;
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

    // Let the toolbar focus transition finish, then return the caret to the
    // editor so the author can keep typing in the same block.
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
    const selection = selectionRef.current;
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
        <div className="aapm-rich-editor__toolbar aapm-token-toolbar aapm-scrollbar sticky top-0 z-10 flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto px-2 py-1.5 backdrop-blur" role="toolbar" aria-label="Format materi" aria-orientation="horizontal">
          <ToolbarGroup label="Gaya blok" className="aapm-rich-editor__toolbar-group--style">
            {BLOCK_STYLE_OPTIONS.map(({ value, label, glyph }) => (
              <ToolbarButton
                key={value}
                label={label}
                toggle
                active={blockStyle === value}
                onBeforeAction={rememberSelection}
                onClick={() => applyBlockStyle(value)}
              >
                <TextIcon className={cn("text-[11px]", value === "paragraph" ? "font-semibold" : "font-bold tracking-[-0.04em]")}>{glyph}</TextIcon>
              </ToolbarButton>
            ))}
          </ToolbarGroup>

          <ToolbarSeparator />

          <ToolbarGroup label="Format karakter">
            <ToolbarButton label="Tebal (Ctrl/⌘+B)" toggle active={editor.isActive("bold")} onBeforeAction={rememberSelection} onClick={() => editorChain().toggleBold().run()}>
              <TextIcon className="font-bold">B</TextIcon>
            </ToolbarButton>
            <ToolbarButton label="Miring (Ctrl/⌘+I)" toggle active={editor.isActive("italic")} onBeforeAction={rememberSelection} onClick={() => editorChain().toggleItalic().run()}>
              <TextIcon className="italic"><em>I</em></TextIcon>
            </ToolbarButton>
            <ToolbarButton label="Garis bawah (Ctrl/⌘+U)" toggle active={editor.isActive("underline")} onBeforeAction={rememberSelection} onClick={() => editorChain().toggleUnderline().run()}>
              <TextIcon><u>U</u></TextIcon>
            </ToolbarButton>
            <ToolbarButton label="Coret" toggle active={editor.isActive("strike")} onBeforeAction={rememberSelection} onClick={() => editorChain().toggleStrike().run()}>
              <TextIcon><s>S</s></TextIcon>
            </ToolbarButton>
          </ToolbarGroup>

          <ToolbarSeparator />

          <ToolbarGroup label="Paragraf">
            <ToolbarButton label="Daftar bullet" toggle active={editor.isActive("bulletList")} onBeforeAction={rememberSelection} onClick={() => editorChain().toggleBulletList().run()}>
              <ListGlyph />
            </ToolbarButton>
            <ToolbarButton label="Daftar bernomor" toggle active={editor.isActive("orderedList")} onBeforeAction={rememberSelection} onClick={() => editorChain().toggleOrderedList().run()}>
              <ListGlyph ordered />
            </ToolbarButton>
            <ToolbarButton label="Kutipan" toggle active={editor.isActive("blockquote")} onBeforeAction={rememberSelection} onClick={() => editorChain().toggleBlockquote().run()}>
              <span aria-hidden="true" className="font-serif text-lg font-bold leading-none">“</span>
            </ToolbarButton>
          </ToolbarGroup>

          <ToolbarSeparator />

          <ToolbarGroup label="Sisipkan">
            <ToolbarButton label="Tautkan teks" toggle active={editor.isActive("link")} onBeforeAction={rememberSelection} onClick={openLinkEditor}>
              <AapmIcon name="editorLink" className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton label="Lepas tautan" disabled={!editor.isActive("link")} onBeforeAction={rememberSelection} onClick={() => editorChain().unsetLink().run()}>
              <AapmIcon name="editorUnlink" className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton label="Sisipkan gambar di posisi kursor" onBeforeAction={rememberSelection} onClick={openImageEditor}>
              <AapmIcon name="image" className="h-4 w-4" />
            </ToolbarButton>
          </ToolbarGroup>

          <ToolbarSeparator />

          <ToolbarGroup label="Riwayat perubahan">
            <ToolbarButton label="Urungkan perubahan (Ctrl/⌘+Z)" disabled={!editor.can().undo()} onBeforeAction={rememberSelection} onClick={() => editorChain(null).undo().run()}>
              <AapmIcon name="editorUndo" className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton label="Ulangi perubahan (Ctrl/⌘+Shift+Z atau Ctrl+Y)" disabled={!editor.can().redo()} onBeforeAction={rememberSelection} onClick={() => editorChain(null).redo().run()}>
              <AapmIcon name="editorRedo" className="h-4 w-4" />
            </ToolbarButton>
          </ToolbarGroup>
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
            <Button type="button" size="sm" variant="outline" className="h-9 px-3 text-xs" disabled={!onUploadImage || imageUploadState.status === "loading"} aria-busy={imageUploadState.status === "loading"} onClick={() => imageInputRef.current?.click()}>
              <AapmIcon name={imageUploadState.status === "loading" ? "loading" : "fileCheck"} className={cn("h-3.5 w-3.5", imageUploadState.status === "loading" && "animate-spin")} />{imageUploadState.status === "loading" ? "Mengunggah…" : "Unggah gambar"}
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-9 px-3 text-xs" onClick={() => { imageUploadControllerRef.current?.abort(); setImageOpen(false); }}>Batal</Button>
            <span className="text-[10px] leading-4 text-muted-foreground">JPG, PNG, GIF, WebP, AVIF · maks. 20 MB</span>
          </div>
          {imageUploadState.status === "loading" && <UploadProgress progress={imageUploadState.progress} label={imageUploadState.message} onCancel={() => imageUploadControllerRef.current?.abort()} />}
          {(imageError || (imageUploadState.status !== "idle" && imageUploadState.status !== "loading")) && <p className={cn("inline-flex items-center gap-1.5 text-[10px] leading-4", imageError || imageUploadState.status === "error" ? "text-danger" : imageUploadState.status === "success" ? "text-brand-green" : "text-muted-foreground")} role={imageError || imageUploadState.status === "error" ? "alert" : "status"} aria-live="polite"><AapmIcon name={imageError || imageUploadState.status === "error" ? "danger" : imageUploadState.status === "success" ? "approve" : "info"} className="h-3.5 w-3.5 shrink-0" />{imageError || imageUploadState.message}</p>}
        </div>
      )}
      {selectedImageNode && !imageOpen && (
        <div className="aapm-rich-editor__image-controls flex flex-col gap-2 border-b border-border bg-surface-subtle/70 px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between" role="group" aria-label="Atur gambar terpilih">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-tint-green text-brand-green" aria-hidden="true"><AapmIcon name="image" className="h-4 w-4" /></span>
            <div className="min-w-0 leading-4">
              <p className="text-[11px] font-semibold text-foreground">Gambar</p>
              <p className="truncate text-[10px] text-muted-foreground">Seret sudut gambar untuk ukuran bebas.</p>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <div className="flex min-w-[9rem] items-center gap-2 rounded-[var(--radius-sm)] bg-background/55 px-2 py-1" role="group" aria-label="Lebar gambar">
              <span className="sr-only">Lebar gambar</span>
              <Slider
                min={10}
                max={100}
                step={1}
                value={[selectedImageWidthPercent()]}
                onValueCommit={([value]) => setSelectedImageWidthPercent(value)}
                aria-label="Lebar gambar, dalam persen dari lebar editor"
                className="w-24 sm:w-32"
              />
              <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground" aria-live="polite">{selectedImageWidthPercent()}%</span>
            </div>
            <div className="flex items-center gap-0.5 rounded-[var(--radius-sm)] bg-background/55 p-0.5" role="group" aria-label="Preset ukuran gambar">
              <Button
                type="button"
                size="icon"
                variant={selectedImageSize() === "natural" ? "soft" : "ghost"}
                aria-label="Ukuran asli"
                aria-pressed={selectedImageSize() === "natural"}
                title="Ukuran asli"
                className="h-7 w-7"
                onPointerDown={(event) => event.preventDefault()}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setSelectedImageSize(IMAGE_SIZE_OPTIONS[0])}
              >
                <AapmIcon name="imageNatural" className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant={selectedImageSize() === "full" ? "soft" : "ghost"}
                aria-label="Sesuaikan gambar dengan lebar editor"
                aria-pressed={selectedImageSize() === "full"}
                title="Sesuaikan dengan lebar editor"
                className="h-7 w-7"
                onPointerDown={(event) => event.preventDefault()}
                onMouseDown={(event) => event.preventDefault()}
                onClick={setSelectedImageFit}
              >
                <AapmIcon name="imageFit" className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-0.5 rounded-[var(--radius-sm)] bg-background/55 p-0.5" role="group" aria-label="Snap posisi gambar">
              {IMAGE_ALIGNMENT_OPTIONS.map(({ value, label, icon }) => (
                <Button
                  key={value}
                  type="button"
                  size="icon"
                  variant={normaliseRichTextImageAlign(selectedImageAttrs.align) === value ? "soft" : "ghost"}
                  aria-label={label}
                  aria-pressed={normaliseRichTextImageAlign(selectedImageAttrs.align) === value}
                  title={label}
                  className="h-7 w-7"
                  onPointerDown={(event) => event.preventDefault()}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setSelectedImageAlign(value)}
                >
                  <AapmIcon name={icon} className="h-3.5 w-3.5" />
                </Button>
              ))}
            </div>
            <div className="hidden items-center gap-0.5 rounded-[var(--radius-sm)] bg-background/55 p-0.5 lg:flex" role="group" aria-label="Ukuran cepat gambar">
              {IMAGE_SIZE_OPTIONS.filter((option) => option.value !== "natural" && option.value !== "full").map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={selectedImageSize() === option.value ? "soft" : "ghost"}
                aria-pressed={selectedImageSize() === option.value}
                aria-label={`Ukuran ${option.label.toLowerCase()}`}
                title={`Ukuran ${option.label.toLowerCase()}`}
                className={cn("h-7 px-2 text-[10px]", selectedImageSize() === option.value && "bg-tint-green text-brand-green")}
                onPointerDown={(event) => event.preventDefault()}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setSelectedImageSize(option)}
              >
                {option.label}
              </Button>
              ))}
            </div>
          </div>
        </div>
      )}
      <EditorContent editor={editor} />
      <p className="border-t border-border/70 px-3 py-2 text-[10px] leading-4 text-muted-foreground">
        Konten tidak aman disaring sebelum diterbitkan.
      </p>
    </div>
  );
}
