/**
 * Squarified treemap layout algorithm (Bruls et al.).
 * Produces (x, y, width, height) percentages for each item within a 100x100 space.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TreemapInput {
  id: string;
  value: number; // market cap weight (must be >= 0)
}

export interface TreemapRect {
  id: string;
  x: number;     // percentage 0-100
  y: number;     // percentage 0-100
  width: number; // percentage 0-100
  height: number;// percentage 0-100
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute a squarified treemap layout for items within a 100x100 space.
 * Items with value=0 get a tiny share (0.1% of total) so they still appear.
 * Returns rects in the same order as the input array (matched by id).
 *
 * @param items - Items to lay out; value must be >= 0
 * @param aspectRatio - Width/height ratio of the container (default 1 = square)
 * @returns Array of TreemapRect in input order
 */
export function squarify(items: TreemapInput[], aspectRatio: number = 1): TreemapRect[] {
  if (items.length === 0) return [];

  // Normalize: items with value=0 get equal share of 0.1% of total so they appear
  const total = items.reduce((s, i) => s + i.value, 0);
  const normalized = total === 0
    ? items.map(i => ({ ...i, value: 1 }))
    : items.map(i => ({ ...i, value: i.value === 0 ? total * 0.001 : i.value }));

  const sorted = [...normalized].sort((a, b) => b.value - a.value);
  const sortedTotal = sorted.reduce((s, i) => s + i.value, 0);

  const containerHeight = 100 / aspectRatio;

  const rects: TreemapRect[] = [];
  _squarifyRecurse(sorted, 0, 0, 100, containerHeight, sortedTotal, rects);

  // The algorithm ran in width=100, height=100/aspectRatio internal space.
  // Scale y and height back to 0-100 so consumers can uniformly use (value/100 * pixels).
  for (const r of rects) {
    r.y = r.y * aspectRatio;
    r.height = r.height * aspectRatio;
  }

  // Return rects in input order (by id match)
  const byId = new Map(rects.map(r => [r.id, r]));
  return items.map(i => byId.get(i.id)!).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Compute the worst aspect ratio of items in a candidate row.
 * Lower is better (closer to square).
 */
function _worstRatio(
  row: TreemapInput[],
  rowValue: number,
  shortSide: number,
  scale: number,
): number {
  if (row.length === 0 || rowValue === 0 || shortSide === 0) return Infinity;
  const rowLength = (rowValue * scale) / shortSide;
  let worst = 0;
  for (const item of row) {
    if (item.value === 0) continue;
    const itemLength = (item.value * scale) / rowValue * shortSide;
    const ratio = rowLength > itemLength
      ? rowLength / itemLength
      : itemLength / rowLength;
    if (ratio > worst) worst = ratio;
  }
  return worst;
}

/**
 * Recursively lay out items using the squarify algorithm.
 */
function _squarifyRecurse(
  items: TreemapInput[],
  x: number,
  y: number,
  w: number,
  h: number,
  remaining: number,
  rects: TreemapRect[],
): void {
  if (items.length === 0 || w <= 0 || h <= 0) return;
  if (items.length === 1) {
    rects.push({ id: items[0].id, x, y, width: w, height: h });
    return;
  }

  const scale = (w * h) / remaining; // area per unit value
  const short = Math.min(w, h);
  const horizontal = w >= h;

  const row: TreemapInput[] = [];
  let rowValue = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const testRow = [...row, item];
    const testValue = rowValue + item.value;
    const newRatio = _worstRatio(testRow, testValue, short, scale);
    const oldRatio = _worstRatio(row, rowValue, short, scale);

    if (row.length === 0 || newRatio <= oldRatio) {
      row.push(item);
      rowValue += item.value;
    } else {
      // Current row is optimal — lay it out and recurse for remaining items
      _layoutRow(row, rowValue, x, y, w, h, horizontal, scale, rects);

      const rowArea = rowValue * scale;
      const stripSize = rowArea / short;

      if (horizontal) {
        _squarifyRecurse(
          items.slice(i),
          x + stripSize, y,
          w - stripSize, h,
          remaining - rowValue,
          rects,
        );
      } else {
        _squarifyRecurse(
          items.slice(i),
          x, y + stripSize,
          w, h - stripSize,
          remaining - rowValue,
          rects,
        );
      }
      return;
    }
  }

  // Lay out the final row (all remaining items)
  _layoutRow(row, rowValue, x, y, w, h, horizontal, scale, rects);
}

/**
 * Place a row of items into the layout, assigning absolute percentage positions.
 */
function _layoutRow(
  row: TreemapInput[],
  rowValue: number,
  x: number,
  y: number,
  w: number,
  h: number,
  horizontal: boolean,
  scale: number,
  rects: TreemapRect[],
): void {
  if (rowValue === 0) return;
  const rowArea = rowValue * scale;
  const short = Math.min(w, h);
  const stripSize = rowArea / short;
  let pos = horizontal ? y : x;

  for (const item of row) {
    const fraction = item.value / rowValue;
    const itemSize = fraction * short;
    if (horizontal) {
      rects.push({ id: item.id, x, y: pos, width: stripSize, height: itemSize });
      pos += itemSize;
    } else {
      rects.push({ id: item.id, x: pos, y, width: itemSize, height: stripSize });
      pos += itemSize;
    }
  }
}
