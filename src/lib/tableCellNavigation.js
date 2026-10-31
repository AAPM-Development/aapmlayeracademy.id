const steps = Object.freeze({
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
});

/** The cell an arrow key lands on, counting the header as row 0. Null past the grid's edge. */
export function tableCellTarget({ key, row, column, rows, columns }) {
  const step = steps[key];
  if (!step) return null;
  const target = { row: row + step[0], column: column + step[1] };
  const inside = target.row >= 0 && target.row < rows && target.column >= 0 && target.column < columns;
  return inside ? target : null;
}

/**
 * Whether an arrow key leaves the field or edits inside it. "wait" hands the key to the
 * browser first: soft wraps are invisible in the value, so only the browser knows whether
 * another line lies that way. The caller leaves the cell if the caret did not move.
 */
export function tableCellExit({ key, start, end, length, multiline }) {
  if (start !== end) return "stay";
  if (key === "ArrowLeft") return start === 0 ? "leave" : "stay";
  if (key === "ArrowRight") return end === length ? "leave" : "stay";
  if (!multiline) return "leave";
  if (key === "ArrowUp") return start === 0 ? "leave" : "wait";
  return end === length ? "leave" : "wait";
}
