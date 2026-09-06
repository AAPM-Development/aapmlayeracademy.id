import { safeEditorialLink } from "./editorialUrls.js";

const allowedNodeTypes = new Set([
  "doc",
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "hardBreak",
  "text",
]);

const allowedMarkTypes = new Set(["bold", "italic", "underline", "strike", "link"]);

function safeText(value, maximum = 24000) {
  return typeof value === "string" ? value.slice(0, maximum) : "";
}

function safeNode(node, depth = 0) {
  if (!node || typeof node !== "object" || depth > 24) return null;
  const type = typeof node.type === "string" ? node.type : "";
  if (!allowedNodeTypes.has(type)) return null;

  if (type === "text") {
    const text = safeText(node.text);
    if (!text) return null;
    const marks = Array.isArray(node.marks)
      ? node.marks
          .map((mark) => {
            if (!mark || typeof mark !== "object" || !allowedMarkTypes.has(mark.type)) return null;
            if (mark.type === "link") {
              const href = safeEditorialLink(mark.attrs?.href);
              return href ? { type: "link", attrs: { href } } : null;
            }
            return { type: mark.type };
          })
          .filter(Boolean)
      : [];
    return marks.length ? { type, text, marks } : { type, text };
  }

  if (type === "hardBreak") return { type };

  const result = { type };
  if (type === "heading") {
    const level = Number(node.attrs?.level);
    result.attrs = { level: [1, 2, 3].includes(level) ? level : 2 };
  }
  if (type === "orderedList") {
    const start = Number(node.attrs?.start);
    result.attrs = Number.isInteger(start) && start > 0 && start < 1000 ? { start } : { start: 1 };
  }
  if (Array.isArray(node.content)) {
    result.content = node.content.map((child) => safeNode(child, depth + 1)).filter(Boolean);
  }
  return result;
}

export function sanitizeRichTextDocument(value) {
  const root = safeNode(value, 0);
  if (root?.type === "doc") return root;
  return { type: "doc", content: [{ type: "paragraph" }] };
}

export function richTextPlainText(value) {
  const root = sanitizeRichTextDocument(value);
  const visit = (node) => {
    if (!node) return "";
    if (node.type === "text") return node.text || "";
    if (node.type === "hardBreak") return "\n";
    return (node.content || []).map(visit).join("");
  };
  return visit(root);
}

const allowedPasteTags = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "h1",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
]);
const unwrapPasteTags = new Set(["div", "section", "article", "span", "font"]);
const removePasteTags = new Set(["script", "style", "iframe", "object", "embed", "svg", "math", "form", "input", "textarea", "select", "button"]);

function cleanPasteNode(node) {
  if (node.nodeType === 3) return;
  if (node.nodeType !== 1) {
    node.remove();
    return;
  }

  const element = /** @type {HTMLElement} */ (node);
  const tag = element.tagName.toLowerCase();
  if (removePasteTags.has(tag)) {
    element.remove();
    return;
  }

  const children = Array.from(element.childNodes);
  children.forEach(cleanPasteNode);
  if (tag === "a") {
    const href = safeEditorialLink(element.getAttribute("href"));
    Array.from(element.attributes).forEach((attribute) => element.removeAttribute(attribute.name));
    if (href) element.setAttribute("href", href);
    else element.replaceWith(...Array.from(element.childNodes));
    return;
  }

  if (allowedPasteTags.has(tag)) {
    Array.from(element.attributes).forEach((attribute) => element.removeAttribute(attribute.name));
    return;
  }
  if (unwrapPasteTags.has(tag) || tag === "body") {
    element.replaceWith(...Array.from(element.childNodes));
    return;
  }
  element.replaceWith(...Array.from(element.childNodes));
}

export function sanitizePastedHtml(value) {
  if (typeof value !== "string" || typeof DOMParser === "undefined") return value || "";
  const parsed = new DOMParser().parseFromString(`<div>${value}</div>`, "text/html");
  const root = parsed.body.firstElementChild;
  if (!root) return "";
  Array.from(root.childNodes).forEach(cleanPasteNode);
  return root.innerHTML;
}
