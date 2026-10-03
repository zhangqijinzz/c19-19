import { describe, expect, it } from 'vitest';
import { analyzeLayout, buildIssues, reconcileIssues, sortIssues } from '../src/domain';
import type { AnalysisIssue, ExpoElement, IssueSeverity, IssueType, LayoutDocument } from '../src/types';

const item = (id: string, x: number, y: number, width = 4, height = 3): ExpoElement => ({ id, kind: 'booth', name: id, x, y, width, height, rotation: 0 });

const doc = (elements: ExpoElement[], field = { width: 20, height: 12 }): LayoutDocument => ({ version: 1, title: 't', field, elements });

const issuesOf = (document: LayoutDocument) => buildIssues(document, analyzeLayout(document));

const fakeIssue = (id: string, type: IssueType, severity: IssueSeverity, metric: number): AnalysisIssue => ({ id, type, severity, elementIds: [], summary: id, metricLabel: '', metric, fingerprint: '', highlight: null });

describe('buildIssues', () => {
  it('flattens analysis results into locatable issues with stable ids and highlights', () => {
    const issues = issuesOf(doc([item('a', 1, 1), item('b', 3, 2)]));
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('overlap:a::b');
    expect(issues[0].elementIds).toEqual(['a', 'b']);
    expect(issues[0].severity).toBe('high');
    expect(issues[0].highlight).toEqual({ left: 3, top: 2, width: 2, height: 2 });
  });

  it('marks the channel gap area so the list entry can be located on the canvas', () => {
    const issues = issuesOf(doc([item('a', 1, 1), item('b', 5.5, 1)]));
    expect(issues[0].type).toBe('channel');
    expect(issues[0].highlight).toEqual({ left: 5, top: 1, width: 0.5, height: 3 });
  });

  it('keeps the fingerprint stable under unrelated edits but invalidates it when a related element changes', () => {
    const before = issuesOf(doc([item('a', 1, 1), item('b', 3, 2), item('c', 12, 8)]))[0];
    const afterUnrelated = issuesOf(doc([item('a', 1, 1), item('b', 3, 2), item('c', 14, 8)]))[0];
    expect(afterUnrelated.fingerprint).toBe(before.fingerprint);
    const afterRelated = issuesOf(doc([item('a', 2, 1), item('b', 3, 2), item('c', 12, 8)]))[0];
    expect(afterRelated.id).toBe(before.id);
    expect(afterRelated.fingerprint).not.toBe(before.fingerprint);
  });

  it('ties bounds fingerprints to the field size while overlap fingerprints ignore it', () => {
    const boundsBefore = issuesOf(doc([item('a', 18, 1)])).find((issue) => issue.type === 'bounds')!;
    const boundsAfter = issuesOf(doc([item('a', 18, 1)], { width: 19, height: 12 })).find((issue) => issue.id === boundsBefore.id)!;
    expect(boundsAfter.fingerprint).not.toBe(boundsBefore.fingerprint);

    const overlapBefore = issuesOf(doc([item('a', 1, 1), item('b', 3, 2)])).find((issue) => issue.type === 'overlap')!;
    const overlapAfter = issuesOf(doc([item('a', 1, 1), item('b', 3, 2)], { width: 30, height: 20 })).find((issue) => issue.id === overlapBefore.id)!;
    expect(overlapAfter.fingerprint).toBe(overlapBefore.fingerprint);
  });
});

describe('sortIssues', () => {
  const issues = [fakeIssue('low-overlap', 'overlap', 'low', 0.4), fakeIssue('high-channel', 'channel', 'high', 0.9), fakeIssue('mid-bounds', 'bounds', 'medium', 1)];

  it('orders by severity first when sorting by severity', () => {
    expect(sortIssues(issues, 'severity').map((issue) => issue.id)).toEqual(['high-channel', 'mid-bounds', 'low-overlap']);
  });

  it('groups by type first when sorting by type', () => {
    expect(sortIssues(issues, 'type').map((issue) => issue.id)).toEqual(['low-overlap', 'mid-bounds', 'high-channel']);
  });
});

describe('reconcileIssues', () => {
  const issues = issuesOf(doc([item('a', 1, 1), item('b', 3, 2)]));

  it('keeps a decision while the fingerprint matches', () => {
    const resolution = { status: 'confirmed' as const, fingerprint: issues[0].fingerprint, decidedAt: 1 };
    const { entries, resolutions } = reconcileIssues(issues, { [issues[0].id]: resolution });
    expect(entries[0].status).toBe('confirmed');
    expect(resolutions[issues[0].id]).toBeDefined();
  });

  it('resets a decision to pending when the fingerprint no longer matches', () => {
    const { entries, resolutions } = reconcileIssues(issues, { [issues[0].id]: { status: 'confirmed', fingerprint: 'stale', decidedAt: 1 } });
    expect(entries[0].status).toBe('pending');
    expect(resolutions[issues[0].id]).toBeUndefined();
  });

  it('drops resolutions that point at issues which no longer exist', () => {
    const { resolutions } = reconcileIssues(issues, { 'overlap:ghost::gone': { status: 'deferred', fingerprint: 'x', decidedAt: 1 } });
    expect(resolutions['overlap:ghost::gone']).toBeUndefined();
  });
});
