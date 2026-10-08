import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import { Table } from "@/components/primitives";
import AiCopyButton from "@/components/ai/AiCopyButton";

const MermaidDiagram = React.lazy(() => import("@/components/ai/MermaidDiagram"));

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
  const code = node?.children?.find((child) => child.tagName === "code");
  const language = fenceLanguage(code);
  const source = nodeText(code).replace(/\n$/, "");
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
        <AiCopyButton text={source} label="Salin kode" tone="inverse" />
      </figcaption>
      <pre className="aapm-ai-code-block"><code>{source}</code></pre>
    </figure>
  );
}

function AnswerLink({ href = "", children }) {
  if (href.startsWith("/") && !href.startsWith("//")) return <Link to={href}>{children}</Link>;
  const external = /^https?:\/\//i.test(href);
  return (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
      {children}
      {external ? <span className="sr-only"> (tab baru)</span> : null}
    </a>
  );
}

/**
 * The one Markdown renderer for APPI answers, in the workspace and the
 * floating panel. Headings start one level under the surface's own heading,
 * tables scroll inside their frame, links say when they open a new tab and
 * fenced code gets a label and a copy action. `compact` tightens the rhythm.
 */
export default function AiMarkdown({ content, compact = false }) {
  return (
    <div className="aapm-ai-markdown" data-density={compact ? "compact" : undefined}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (compact ? <h3>{children}</h3> : <h2>{children}</h2>),
          h2: ({ children }) => <h3>{children}</h3>,
          h3: ({ children }) => <h4>{children}</h4>,
          a: ({ href, children }) => <AnswerLink href={href}>{children}</AnswerLink>,
          table: ({ children }) => <Table className="aapm-ai-markdown-table" aria-label="Tabel dalam jawaban APPI">{children}</Table>,
          pre: ({ node }) => <CodeBlock node={node} />,
          code: ({ children }) => <code className="aapm-ai-inline-code">{children}</code>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
