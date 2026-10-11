/**
 * Copying an APPI answer so it keeps its shape wherever it is pasted.
 *
 * Rich editors (Word, Google Docs, Gmail, Notion) read `text/html`: the answer is
 * rebuilt as plain semantic HTML with inline styles (no app classes or CSS
 * variables, which do not survive a paste), tables get borders and diagrams
 * travel as their Mermaid source. Plain destinations (WhatsApp, Telegram,
 * notes) read `text/plain`: Markdown becomes chat-friendly text (*bold*, bullets,
 * tables as rows).
 */

const FONT = "font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1f2320;";
const STYLE = {
  h1: "font-size:20px;font-weight:700;margin:16px 0 8px;",
  h2: "font-size:18px;font-weight:700;margin:16px 0 8px;",
  h3: "font-size:16px;font-weight:700;margin:14px 0 6px;",
  h4: "font-size:14px;font-weight:700;margin:12px 0 6px;",
  p: "margin:0 0 10px;",
  ul: "margin:0 0 10px;padding-left:22px;",
  ol: "margin:0 0 10px;padding-left:22px;",
  li: "margin:0 0 4px;",
  blockquote: "margin:0 0 10px;padding:4px 12px;border-left:3px solid #c4c9c2;color:#5f6661;",
  table: "border-collapse:collapse;margin:0 0 12px;",
  th: "border:1px solid #c4c9c2;padding:6px 10px;background:#eef3ee;font-weight:700;text-align:left;vertical-align:top;",
  td: "border:1px solid #c4c9c2;padding:6px 10px;text-align:left;vertical-align:top;",
  pre: "margin:0 0 10px;padding:10px 12px;background:#f3f4f2;border-radius:6px;white-space:pre-wrap;font-family:Consolas,Menlo,monospace;font-size:13px;",
  code: "font-family:Consolas,Menlo,monospace;font-size:13px;background:#f3f4f2;padding:1px 4px;border-radius:4px;",
  a: "color:#276a2e;text-decoration:underline;",
  hr: "border:0;border-top:1px solid #e3e6e1;margin:12px 0;",
};
const KEEP = new Set(["P", "BR", "STRONG", "B", "EM", "I", "DEL", "S", "U", "A", "UL", "OL", "LI", "BLOCKQUOTE", "H1", "H2", "H3", "H4", "H5", "H6",
  "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "PRE", "CODE", "HR"]);

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
}

/** Rebuild one rendered node as clean, inline-styled HTML. */
function cleanNode(node) {
  if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent || "");
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const element = /** @type {HTMLElement} */ (node);
  // Controls (copy, wrap) and the code frame's label bar are app chrome.
  if (element.matches("button, figcaption, svg, [aria-hidden='true'], .sr-only")) return "";
  const mermaid = element.matches("[data-mermaid-source]") ? element : null;
  if (mermaid) {
    return `<pre style="${STYLE.pre}"><code>${escapeHtml(`mermaid\n${mermaid.dataset.mermaidSource || ""}`)}</code></pre>`;
  }
  const children = Array.from(element.childNodes).map(cleanNode).join("");
  const tag = element.tagName;
  if (!KEEP.has(tag)) return children;
  const name = tag.toLowerCase();
  if (name === "br" || name === "hr") return `<${name}${STYLE[name] ? ` style="${STYLE[name]}"` : ""}>`;
  if (name === "code" && element.parentElement?.tagName === "PRE") return `<code>${children}</code>`;
  const level = /^h[5-6]$/.test(name) ? "h4" : name;
  const attrs = [];
  if (STYLE[level]) attrs.push(`style="${STYLE[level]}"`);
  if (name === "a") {
    const href = element.getAttribute("href") || "";
    const absolute = href.startsWith("/") && !href.startsWith("//") ? `${window.location.origin}${href}` : href;
    if (/^(https?:|mailto:)/i.test(absolute)) attrs.push(`href="${escapeHtml(absolute)}"`);
  }
  for (const span of ["colspan", "rowspan"]) {
    if (element.getAttribute(span)) attrs.push(`${span}="${escapeHtml(element.getAttribute(span))}"`);
  }
  return `<${level}${attrs.length ? ` ${attrs.join(" ")}` : ""}>${children}</${level}>`;
}

/** Clean HTML for a rendered answer (or a selection fragment of one). */
export function answerHtml(root) {
  if (!root) return "";
  const body = Array.from(root.childNodes).map(cleanNode).join("");
  return `<div style="${FONT}">${body}</div>`;
}

function tableToText(lines) {
  const rows = lines
    .filter((line) => !/^\s*\|?\s*:?-{2,}/.test(line))
    .map((line) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
  if (!rows.length) return [];
  const [header, ...body] = rows;
  if (!body.length) return [header.join(" · ")];
  return body.map((cells) => `• ${cells.map((cell, index) => (index && header[index] ? `${header[index]}: ${cell}` : `*${cell}*`)).join(" · ")}`);
}

/**
 * Markdown to chat-friendly plain text: WhatsApp/Telegram emphasis, bullets,
 * tables as one line per row, links with their address, code kept fenced.
 */
export function answerPlainText(markdown) {
  const out = [];
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  let fence = false;
  let table = [];
  const flushTable = () => {
    if (table.length) out.push(...tableToText(table));
    table = [];
  };
  const inline = (text) => text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => (label === href ? href : `${label} (${href})`))
    // Bold is parked on a marker so the italic rule below cannot re-read it.
    .replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_m, a, b) => `\u0001${a ?? b}\u0001`)
    .replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, "$1_$2_")
    .replace(/\u0001/g, "*")
    .replace(/~~(.+?)~~/g, "~$1~")
    .replace(/`([^`]+)`/g, "$1");
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      flushTable();
      fence = !fence;
      out.push(line.trim());
      continue;
    }
    if (fence) {
      out.push(line);
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      table.push(line);
      continue;
    }
    flushTable();
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      out.push(`*${inline(heading[1]).replace(/^\*(.*)\*$/, "$1")}*`);
      continue;
    }
    const bullet = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    if (bullet) {
      out.push(`${bullet[1]}• ${inline(bullet[2])}`);
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      out.push("──────────");
      continue;
    }
    out.push(inline(line.replace(/^\s*>\s?/, "")));
  }
  flushTable();
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** The rendered Markdown of the answer that owns `button` (not the thinking panel). */
export function answerRootFor(button) {
  return button?.closest("article")?.querySelector(".aapm-ai-response > .aapm-ai-markdown") || null;
}

/**
 * Ctrl+C / long-press copy inside an answer: put the same clean HTML on the
 * clipboard so a partial selection pastes with its shape too. Returns cleanup.
 */
export function installAnswerCopyHandler() {
  const onCopy = (event) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount || !event.clipboardData) return;
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const element = /** @type {Element | null} */ (container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement);
    const owner = element?.closest(".aapm-ai-response");
    if (!owner) return;
    const holder = document.createElement("div");
    holder.appendChild(range.cloneContents());
    event.clipboardData.setData("text/html", answerHtml(holder));
    event.clipboardData.setData("text/plain", selection.toString());
    event.preventDefault();
  };
  document.addEventListener("copy", onCopy);
  return () => document.removeEventListener("copy", onCopy);
}
