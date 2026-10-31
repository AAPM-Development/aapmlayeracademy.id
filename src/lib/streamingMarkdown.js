const FENCE = /^ {0,3}(```|~~~)/;
const TABLE_LINE = /^ {0,3}\|/;
const RULE_ROW = /^ {0,3}\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const RULE_SO_FAR = /^ {0,3}\|?[\s:|-]*$/;

function endsInsideFence(lines) {
  let open = null;
  for (const line of lines) {
    const fence = FENCE.exec(line)?.[1];
    if (fence && !open) open = fence;
    else if (fence === open) open = null;
  }
  return Boolean(open);
}

/**
 * What to draw of an answer still being written. A table is plain pipes until
 * its rule row is complete, and a half-written row changes the columns, so the
 * table waits for its rule row and then grows one whole row at a time. The full
 * text is drawn as soon as the answer ends.
 */
export function settledMarkdown(content) {
  const lines = content.split("\n");
  const lineFinished = lines.at(-1) === "";
  const end = lineFinished ? lines.length - 2 : lines.length - 1;
  if (end < 0 || !TABLE_LINE.test(lines[end]) || endsInsideFence(lines)) return content;
  let start = end;
  while (start > 0 && TABLE_LINE.test(lines[start - 1])) start -= 1;

  const rule = start < end ? lines[start + 1] : "";
  const ruleFinished = start + 1 < end || (start + 1 === end && lineFinished);
  if (ruleFinished && !RULE_ROW.test(rule)) return content;
  if (!ruleFinished && !RULE_SO_FAR.test(rule)) return content;
  if (!ruleFinished) return lines.slice(0, start).join("\n");
  return lineFinished ? content : lines.slice(0, end).join("\n");
}
