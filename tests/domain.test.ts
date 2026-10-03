import { describe, expect, it } from 'vitest';
import { analyzeLayout, buildIssueViews, createIssueId, createIssueSignature, findBoundsIssues, findNarrowChannels, findOverlaps } from '../src/domain';
import type { ExpoElement, FieldSize } from '../src/types';

const field: FieldSize = { width: 10, height: 10 };
const item = (id: string, x: number, y: number, width = 4, height = 3): ExpoElement => ({ id, kind: 'booth', name: id, x, y, width, height, rotation: 0 });

describe('layout domain rules', () => {
  it('detects overlap area between two elements', () => {
    expect(findOverlaps([item('a', 1, 1), item('b', 3, 2)])).toEqual([{ firstId: 'a', secondId: 'b', amount: 4 }]);
  });

  it('detects field overflow and rotated bounds', () => {
    const rotated = { ...item('rotated', 8, 2, 2, 5), rotation: 90 };
    expect(findBoundsIssues({ width: 10, height: 10 }, [rotated])).toEqual([{ elementId: 'rotated', overflow: 3 }]);
  });

  it('flags a pass narrower than the minimum channel', () => {
    expect(findNarrowChannels([item('a', 1, 1), item('b', 5.5, 1)])).toEqual([{ firstId: 'a', secondId: 'b', gap: 0.5 }]);
  });

  it('returns a path when entrance and focus area exist', () => {
    const analysis = analyzeLayout({ version: 1, title: 'x', field: { width: 20, height: 12 }, elements: [{ ...item('entry', 1, 5, 2, 1), kind: 'entrance' }, { ...item('stage', 10, 2, 5, 3), kind: 'stage' }] });
    expect(analysis.path?.points).toHaveLength(3);
    expect(analysis.path?.distance).toBeGreaterThan(0);
  });

  it('builds a locateable issue view naming both elements and covering the shared region', () => {
    const document = { version: 1 as const, title: 'x', field, elements: [item('a', 1, 1), item('b', 3, 2)] };
    const issues = buildIssueViews(document);
    expect(issues).toHaveLength(1);
    const overlap = issues[0];
    expect(overlap.kind).toBe('overlap');
    expect(overlap.elementIds).toEqual(['a', 'b']);
    expect(overlap.title).toBe('元素重叠');
    expect(overlap.detail).toContain('a × b');
    expect(overlap.highlightRects).toEqual([{ x: 3, y: 2, width: 2, height: 2 }]);
    expect(overlap.severity).toBe('medium');
  });

  it('rates channels by gap width and highlights the gap strip between elements', () => {
    const document = { version: 1 as const, title: 'x', field, elements: [item('a', 1, 1), item('b', 5.5, 1)] };
    const channel = buildIssueViews(document).find((issue) => issue.kind === 'channel');
    expect(channel?.severity).toBe('high');
    expect(channel?.highlightRects[0]).toMatchObject({ x: 5, y: 1, width: 0.5, height: 3 });
  });

  it('keeps a stable issue id regardless of pair ordering, but changes the signature when geometry changes', () => {
    const before = createIssueSignature('overlap', ['a', 'b'], [item('a', 1, 1), item('b', 3, 2)], field);
    const afterMove = createIssueSignature('overlap', ['a', 'b'], [item('a', 1.4, 1), item('b', 3, 2)], field);
    const afterField = createIssueSignature('overlap', ['a', 'b'], [item('a', 1, 1), item('b', 3, 2)], { width: 12, height: 10 });
    expect(createIssueId('overlap', ['b', 'a'])).toBe(createIssueId('overlap', ['a', 'b']));
    expect(afterMove).not.toBe(before);
    expect(afterField).not.toBe(before);
  });

  it('drops a bounds entry once the element is removed', () => {
    const overflowing = item('gone', 9, 9, 4, 4);
    expect(buildIssueViews({ version: 1, title: 'x', field, elements: [overflowing] })).toHaveLength(1);
    expect(buildIssueViews({ version: 1, title: 'x', field, elements: [] })).toHaveLength(0);
  });
});
