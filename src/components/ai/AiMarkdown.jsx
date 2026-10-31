import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import { Table } from "@/components/primitives";
import AiCopyButton from "@/components/ai/AiCopyButton";
import { settledMarkdown } from "@/lib/streamingMarkdown";

const MermaidDiagram = React.lazy(() => import("@/components/ai/MermaidDiagram"));
// A diagram half-written is invalid Mermaid; draw it once the answer is complete.
const StreamingContext = React.createContext(false);

/** Plain text of a hast node (fenced code carries text children only). */
function nodeText(node) {
  if (!node) return "";
  if (node.type === "text") return node.value || "";
  return (node.children || []).map(nodeText).join("");
}

function fenceLanguage(node) {
  const className = node?.properties?.className;
  const classes = Array.isArray(className) ? className : [className];
  const match = classes.map((value) => /^language-([\w+-]+)$/.exec(String(value || ""))).find(Boolean);
  return match ? match[1] : "";
}

/** Fenced code: a labelled frame with a copy action; Mermaid draws a diagram. */
function CodeBlock({ node }) {
  const [wrap, setWrap] = React.useState(false);
  const code = node?.children?.find((child) => child.tagName === "code");
  const language = fenceLanguage(code);
  const source = nodeText(code).replace(/\n$/, "");
  const streaming = React.useContext(StreamingContext);
  if (language === "mermaid" && streaming) {
    return <div className="aapm-ai-mermaid-loading">Diagram muncul setelah jawaban selesai…</div>;
  }
  if (language === "mermaid") {
    return (
      <React.Suspense fallback={<div className="aapm-ai-mermaid-loading">Menyiapkan diagram…</div>}>
        <MermaidDiagram chart={source} />
      </React.Suspense>
    );
  }
  return (
    <figure className="aapm-ai-code">
      <figcaption className="aapm-ai-code__bar">
        <span>{language || "Teks"}</span>
        <div className="aapm-ai-code__actions">
          <button type="button" aria-pressed={wrap} onClick={() => setWrap((value) => !value)}>{wrap ? "Baris asli" : "Lipat baris"}</button>
          <AiCopyButton text={source} label="Salin kode" tone="inverse" />
        </div>
      </figcaption>
      <pre className="aapm-ai-code-block" data-wrap={wrap ? "true" : undefined} tabIndex={0} aria-label={`Kode ${language || "teks"}`}><code>{source}</code></pre>
    </figure>
  );
}

function AnswerLink({ href = "", children }) {
  // The URL filter empties protocols it does not trust; the words stay, the link goes.
  if (!href) return <>{children}</>;
  if (href.startsWith("/") && !href.startsWith("//")) return <Link to={href}>{children}</Link>;
  const external = /^(https?:)?\/\//i.test(href);
  return (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
      {children}
      {external ? <span className="sr-only"> (tab baru)</span> : null}
    </a>
  );
}

/** Models write <br> inside table cells. Raw HTML stays off, so only this one tag becomes a line break. */
function remarkLineBreakTags() {
  const walk = (node) => {
    (node.children || []).forEach((child, index) => {
      if (child.type === "html" && /^<br\s*\/?>$/i.test(child.value.trim())) node.children[index] = { type: "break" };
      else walk(child);
    });
  };
  return walk;
}

const REMARK_PLUGINS = [remarkGfm, remarkLineBreakTags];
const TABLE_WRAP_PROPS = { tabIndex: 0, role: "region", "aria-label": "Tabel jawaban APPI, geser untuk melihat semua kolom" };
const componentsFor = (compact) => ({
  h1: ({ children }) => (compact ? <h3>{children}</h3> : <h2>{children}</h2>),
  h2: ({ children }) => <h3>{children}</h3>,
  h3: ({ children }) => <h4>{children}</h4>,
  a: ({ href, children }) => <AnswerLink href={href}>{children}</AnswerLink>,
  table: ({ children }) => <Table className="aapm-ai-markdown-table" aria-label="Tabel dalam jawaban APPI" wrapProps={TABLE_WRAP_PROPS}>{children}</Table>,
  // A picture in an answer would load from a URL the model chose; a link waits for the learner.
  img: ({ src, alt }) => <AnswerLink href={/^https:\/\//i.test(src || "") ? src : ""}>{alt || "Gambar"}</AnswerLink>,
  pre: ({ node }) => <CodeBlock node={node} />,
  code: ({ children }) => <code className="aapm-ai-inline-code">{children}</code>,
});
// Stable component maps: a new object per render made every answer re-render.
const COMPONENTS = componentsFor(false);
const COMPACT_COMPONENTS = componentsFor(true);

/**
 * The one Markdown renderer for APPI answers, in the workspace and the
 * floating panel. Headings start one level under the surface's own heading,
 * tables scroll inside their frame, links say when they open a new tab and
 * fenced code gets a label and a copy action. `compact` tightens the rhythm.
 * Memoised on its props, so streaming one answer does not re-parse the others.
 */
function AiMarkdown({ content, compact = false, streaming = false }) {
  return (
    <div className="aapm-ai-markdown" data-density={compact ? "compact" : undefined}>
      <StreamingContext.Provider value={streaming}>
        <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={compact ? COMPACT_COMPONENTS : COMPONENTS}>
          {streaming ? settledMarkdown(content) : content}
        </ReactMarkdown>
      </StreamingContext.Provider>
    </div>
  );
}

export default React.memo(AiMarkdown);
