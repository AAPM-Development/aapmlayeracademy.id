/**
 * Paragraph-level diff for editorial Markdown: which paragraphs APPI kept,
 * removed or added. Paragraphs are split on blank lines; a longest common
 * subsequence keeps the result stable when APPI only appends or rewrites one
 * paragraph. Returns [{ type: "same" | "removed" | "added", text }].
 */
export function paragraphs(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function paragraphDiff(before, after) {
  const a = paragraphs(before);
  const b = paragraphs(after);
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const result = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      result.push({ type: "same", text: a[i] });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      result.push({ type: "removed", text: a[i] });
      i += 1;
    } else {
      result.push({ type: "added", text: b[j] });
      j += 1;
    }
  }
  while (i < a.length) result.push({ type: "removed", text: a[i++] });
  while (j < b.length) result.push({ type: "added", text: b[j++] });
  return result;
}
