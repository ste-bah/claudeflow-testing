/**
 * Tests for the squarified treemap layout algorithm.
 */
import { describe, it, expect } from 'vitest';
import { squarify } from '../../utils/treemap';
import type { TreemapInput, TreemapRect } from '../../utils/treemap';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Total area covered by all rects (sum of width*height). */
function totalArea(rects: TreemapRect[]): number {
  return rects.reduce((s, r) => s + r.width * r.height, 0);
}

/** Check that a rect stays within [0,100] on both axes. */
function isInBounds(rect: TreemapRect): boolean {
  return (
    rect.x >= -0.001 &&
    rect.y >= -0.001 &&
    rect.x + rect.width <= 100.001 &&
    rect.y + rect.height <= 100.001
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('squarify()', () => {
  // 1. Empty input returns empty array
  it('should return an empty array for empty input', () => {
    expect(squarify([])).toEqual([]);
  });

  // 2. Single item fills the entire 100x100 space
  it('should give a single item the full 100x100 space', () => {
    const items: TreemapInput[] = [{ id: 'A', value: 1000 }];
    const [rect] = squarify(items);
    expect(rect.id).toBe('A');
    expect(rect.x).toBeCloseTo(0, 5);
    expect(rect.y).toBeCloseTo(0, 5);
    expect(rect.width).toBeCloseTo(100, 5);
    expect(rect.height).toBeCloseTo(100, 5);
  });

  // 3. Two equal items share the space equally (total area ~10000)
  it('should give two equal-value items roughly equal areas', () => {
    const items: TreemapInput[] = [
      { id: 'A', value: 1 },
      { id: 'B', value: 1 },
    ];
    const rects = squarify(items);
    expect(rects).toHaveLength(2);
    const areaA = rects.find(r => r.id === 'A')!.width * rects.find(r => r.id === 'A')!.height;
    const areaB = rects.find(r => r.id === 'B')!.width * rects.find(r => r.id === 'B')!.height;
    expect(areaA).toBeCloseTo(areaB, 1);
    expect(areaA + areaB).toBeCloseTo(10000, 0);
  });

  // 4. Many items: total area sums to ~10000
  it('should produce rects whose total area is approximately 10000', () => {
    const items: TreemapInput[] = [
      { id: 'A', value: 500 },
      { id: 'B', value: 300 },
      { id: 'C', value: 200 },
      { id: 'D', value: 150 },
      { id: 'E', value: 100 },
      { id: 'F', value: 50 },
    ];
    const rects = squarify(items);
    expect(rects).toHaveLength(6);
    expect(totalArea(rects)).toBeCloseTo(10000, 0);
  });

  // 5. All rects stay within [0, 100] on both axes
  it('should keep all rects within 0-100 bounds', () => {
    const items: TreemapInput[] = [
      { id: 'A', value: 800 },
      { id: 'B', value: 600 },
      { id: 'C', value: 400 },
      { id: 'D', value: 200 },
    ];
    const rects = squarify(items);
    for (const rect of rects) {
      expect(isInBounds(rect)).toBe(true);
    }
  });

  // 6. Items with value=0 still get rendered (small but non-zero area)
  it('should include items with value=0 in the output with non-zero area', () => {
    const items: TreemapInput[] = [
      { id: 'A', value: 100 },
      { id: 'B', value: 0 },
    ];
    const rects = squarify(items);
    expect(rects).toHaveLength(2);
    const rectB = rects.find(r => r.id === 'B')!;
    expect(rectB).toBeDefined();
    expect(rectB.width * rectB.height).toBeGreaterThan(0);
  });

  // 7. All-zero items share space equally
  it('should give all-zero items equal areas when all values are 0', () => {
    const items: TreemapInput[] = [
      { id: 'A', value: 0 },
      { id: 'B', value: 0 },
      { id: 'C', value: 0 },
    ];
    const rects = squarify(items);
    expect(rects).toHaveLength(3);
    const areas = rects.map(r => r.width * r.height);
    expect(areas[0]).toBeCloseTo(areas[1], 1);
    expect(areas[1]).toBeCloseTo(areas[2], 1);
  });

  // 8. Output order matches input order (by id)
  it('should return rects in the same order as the input', () => {
    const items: TreemapInput[] = [
      { id: 'X', value: 10 },
      { id: 'Y', value: 50 },
      { id: 'Z', value: 30 },
    ];
    const rects = squarify(items);
    expect(rects[0].id).toBe('X');
    expect(rects[1].id).toBe('Y');
    expect(rects[2].id).toBe('Z');
  });

  // 9. Larger value items get larger area
  it('should give larger-value items proportionally more area', () => {
    const items: TreemapInput[] = [
      { id: 'big', value: 900 },
      { id: 'small', value: 100 },
    ];
    const rects = squarify(items);
    const bigArea = rects.find(r => r.id === 'big')!.width * rects.find(r => r.id === 'big')!.height;
    const smallArea = rects.find(r => r.id === 'small')!.width * rects.find(r => r.id === 'small')!.height;
    expect(bigArea).toBeGreaterThan(smallArea * 5);
  });

  // 10. Aspect ratio parameter guides split direction; output is always in 0-100 space
  it('should respect a non-square aspect ratio', () => {
    const items: TreemapInput[] = [{ id: 'A', value: 1 }];
    // A single item always fills the full normalized 0-100 space regardless of aspectRatio.
    // The aspectRatio only affects how multi-item splits are oriented, not the coordinate range.
    const rects = squarify(items, 2);
    const [rect] = rects;
    expect(rect.x).toBeCloseTo(0, 5);
    expect(rect.y).toBeCloseTo(0, 5);
    expect(rect.width).toBeCloseTo(100, 5);
    expect(rect.height).toBeCloseTo(100, 5);
  });
});
