import type {
  Analysis,
  AnalysisIssue,
  BoundsIssue,
  ChannelIssue,
  ElementKind,
  ElementSpec,
  ExpoElement,
  FieldSize,
  IssueEntry,
  IssueResolution,
  IssueSeverity,
  IssueSort,
  IssueType,
  LayoutDocument,
  PathPreview,
  OverlapIssue,
} from './types';

export const MIN_CHANNEL = 1.2;

export const ELEMENT_SPECS: Record<ElementKind, ElementSpec> = {
  booth: { kind: 'booth', label: '标准展位', eyebrow: 'BOOTH', icon: '▦', color: '#e7f0ff', width: 5, height: 3.5 },
  stage: { kind: 'stage', label: '主舞台', eyebrow: 'STAGE', icon: '✦', color: '#f2e9ff', width: 8, height: 4 },
  seating: { kind: 'seating', label: '观众座席', eyebrow: 'SEATING', icon: '▤', color: '#e6f7f2', width: 6, height: 3 },
  entrance: { kind: 'entrance', label: '入口', eyebrow: 'ENTRY', icon: '↗', color: '#fff2d8', width: 2.5, height: 1.5 },
};

export const createStarterDocument = (): LayoutDocument => ({
  version: 1,
  title: '春日创意市集 · A 区',
  field: { width: 28, height: 18 },
  elements: [
    { id: 'entry-1', kind: 'entrance', name: '主入口', x: 1, y: 8.25, width: 2.5, height: 1.5, rotation: 0 },
    { id: 'stage-1', kind: 'stage', name: '分享舞台', x: 10, y: 1.5, width: 8, height: 4, rotation: 0 },
    { id: 'booth-1', kind: 'booth', name: '香氛展位', x: 4, y: 2, width: 5, height: 3.5, rotation: 0 },
    { id: 'booth-2', kind: 'booth', name: '手作展位', x: 19, y: 2, width: 5, height: 3.5, rotation: 0 },
    { id: 'seating-1', kind: 'seating', name: '休息座席', x: 10, y: 11, width: 6, height: 3, rotation: 0 },
  ],
});

export const createElement = (kind: ElementKind, index: number, field: FieldSize): ExpoElement => {
  const spec = ELEMENT_SPECS[kind];
  const offset = Math.min(index * 0.65, 4);
  return {
    id: `${kind}-${Date.now()}-${index}`,
    kind,
    name: `${spec.label} ${index + 1}`,
    x: Math.max(0.5, Math.min(field.width - spec.width - 0.5, (field.width - spec.width) / 2 + offset)),
    y: Math.max(0.5, Math.min(field.height - spec.height - 0.5, (field.height - spec.height) / 2 + offset)),
    width: spec.width,
    height: spec.height,
    rotation: 0,
  };
};

export const normalizeRotation = (rotation: number): number => ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;

export const getBoundingBox = (element: ExpoElement) => {
  const isQuarterTurn = normalizeRotation(element.rotation) % 180 !== 0;
  const width = isQuarterTurn ? element.height : element.width;
  const height = isQuarterTurn ? element.width : element.height;
  return { left: element.x, top: element.y, right: element.x + width, bottom: element.y + height, width, height };
};

const intersectionSize = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));

export const findOverlaps = (elements: ExpoElement[]): OverlapIssue[] => {
  const issues: OverlapIssue[] = [];
  for (let i = 0; i < elements.length; i += 1) {
    const first = getBoundingBox(elements[i]);
    for (let j = i + 1; j < elements.length; j += 1) {
      const second = getBoundingBox(elements[j]);
      const overlapX = intersectionSize(first.left, first.right, second.left, second.right);
      const overlapY = intersectionSize(first.top, first.bottom, second.top, second.bottom);
      if (overlapX > 0 && overlapY > 0) {
        issues.push({ firstId: elements[i].id, secondId: elements[j].id, amount: Number((overlapX * overlapY).toFixed(1)) });
      }
    }
  }
  return issues;
};

export const findBoundsIssues = (field: FieldSize, elements: ExpoElement[]): BoundsIssue[] =>
  elements.flatMap((element) => {
    const box = getBoundingBox(element);
    const overflow = Math.max(0, -box.left, -box.top, box.right - field.width, box.bottom - field.height);
    return overflow > 0 ? [{ elementId: element.id, overflow: Number(overflow.toFixed(1)) }] : [];
  });

export const findNarrowChannels = (elements: ExpoElement[]): ChannelIssue[] => {
  const issues: ChannelIssue[] = [];
  for (let i = 0; i < elements.length; i += 1) {
    const first = getBoundingBox(elements[i]);
    for (let j = i + 1; j < elements.length; j += 1) {
      const second = getBoundingBox(elements[j]);
      const verticalOverlap = intersectionSize(first.top, first.bottom, second.top, second.bottom);
      const horizontalOverlap = intersectionSize(first.left, first.right, second.left, second.right);
      const horizontalGap = first.right <= second.left ? second.left - first.right : second.right <= first.left ? first.left - second.right : 0;
      const verticalGap = first.bottom <= second.top ? second.top - first.bottom : second.bottom <= first.top ? first.top - second.bottom : 0;
      const gap = verticalOverlap > 0 ? horizontalGap : horizontalOverlap > 0 ? verticalGap : 0;
      if (gap > 0 && gap < MIN_CHANNEL) issues.push({ firstId: elements[i].id, secondId: elements[j].id, gap: Number(gap.toFixed(1)) });
    }
  }
  return issues;
};

const distance = (first: { x: number; y: number }, second: { x: number; y: number }) => Math.hypot(second.x - first.x, second.y - first.y);

export const createPathPreview = (elements: ExpoElement[]): PathPreview | null => {
  const entrance = elements.find((element) => element.kind === 'entrance');
  const target = elements.find((element) => element.kind === 'stage') ?? elements.find((element) => element.kind !== 'entrance');
  if (!entrance || !target) return null;
  const startBox = getBoundingBox(entrance);
  const targetBox = getBoundingBox(target);
  const start = { x: startBox.left + startBox.width / 2, y: startBox.top + startBox.height / 2 };
  const end = { x: targetBox.left + targetBox.width / 2, y: targetBox.top + targetBox.height / 2 };
  const elbow = { x: end.x, y: start.y };
  return { points: [start, elbow, end], distance: Number((distance(start, elbow) + distance(elbow, end)).toFixed(1)), fromName: entrance.name, toName: target.name };
};

export const analyzeLayout = (document: LayoutDocument): Analysis => ({
  overlaps: findOverlaps(document.elements),
  bounds: findBoundsIssues(document.field, document.elements),
  channels: findNarrowChannels(document.elements),
  path: createPathPreview(document.elements),
});

export const findElement = (document: LayoutDocument, id: string | null) => document.elements.find((element) => element.id === id) ?? null;

export const formatArea = (field: FieldSize) => `${field.width} × ${field.height} m`;

const pairKey = (firstId: string, secondId: string) => [firstId, secondId].sort().join('::');

const overlapSeverity = (amount: number): IssueSeverity => (amount >= 4 ? 'high' : amount >= 1.5 ? 'medium' : 'low');
const boundsSeverity = (overflow: number): IssueSeverity => (overflow >= 2 ? 'high' : overflow >= 0.8 ? 'medium' : 'low');
const channelSeverity = (gap: number): IssueSeverity => (gap <= 0.4 ? 'high' : gap <= 0.8 ? 'medium' : 'low');

const elementFingerprint = (element: ExpoElement) => `${element.id}#${element.x},${element.y},${element.width},${element.height},${element.rotation}`;

const buildFingerprint = (type: IssueType, elementIds: string[], document: LayoutDocument): string => {
  const parts = elementIds.map((id) => {
    const element = findElement(document, id);
    return element ? elementFingerprint(element) : `${id}#missing`;
  }).sort();
  if (type === 'bounds') parts.push(`field#${document.field.width}x${document.field.height}`);
  return parts.join('|');
};

export const buildIssues = (document: LayoutDocument, analysis: Analysis): AnalysisIssue[] => {
  const issues: AnalysisIssue[] = [];
  for (const overlap of analysis.overlaps) {
    const first = findElement(document, overlap.firstId);
    const second = findElement(document, overlap.secondId);
    if (!first || !second) continue;
    const firstBox = getBoundingBox(first);
    const secondBox = getBoundingBox(second);
    const left = Math.max(firstBox.left, secondBox.left);
    const top = Math.max(firstBox.top, secondBox.top);
    issues.push({
      id: `overlap:${pairKey(overlap.firstId, overlap.secondId)}`,
      type: 'overlap',
      severity: overlapSeverity(overlap.amount),
      elementIds: [overlap.firstId, overlap.secondId],
      summary: `「${first.name}」与「${second.name}」重叠`,
      metricLabel: `重叠 ${overlap.amount.toFixed(1)} m²`,
      metric: overlap.amount,
      fingerprint: buildFingerprint('overlap', [overlap.firstId, overlap.secondId], document),
      highlight: { left, top, width: Math.min(firstBox.right, secondBox.right) - left, height: Math.min(firstBox.bottom, secondBox.bottom) - top },
    });
  }
  for (const bounds of analysis.bounds) {
    const element = findElement(document, bounds.elementId);
    if (!element) continue;
    const box = getBoundingBox(element);
    issues.push({
      id: `bounds:${bounds.elementId}`,
      type: 'bounds',
      severity: boundsSeverity(bounds.overflow),
      elementIds: [bounds.elementId],
      summary: `「${element.name}」超出场地边界`,
      metricLabel: `越界 ${bounds.overflow.toFixed(1)} m`,
      metric: bounds.overflow,
      fingerprint: buildFingerprint('bounds', [bounds.elementId], document),
      highlight: { left: box.left, top: box.top, width: box.width, height: box.height },
    });
  }
  for (const channel of analysis.channels) {
    const first = findElement(document, channel.firstId);
    const second = findElement(document, channel.secondId);
    if (!first || !second) continue;
    const firstBox = getBoundingBox(first);
    const secondBox = getBoundingBox(second);
    const verticalOverlap = intersectionSize(firstBox.top, firstBox.bottom, secondBox.top, secondBox.bottom);
    const horizontalOverlap = intersectionSize(firstBox.left, firstBox.right, secondBox.left, secondBox.right);
    const highlight = verticalOverlap > 0
      ? { left: Math.min(firstBox.right, secondBox.right), top: Math.max(firstBox.top, secondBox.top), width: channel.gap, height: verticalOverlap }
      : { left: Math.max(firstBox.left, secondBox.left), top: Math.min(firstBox.bottom, secondBox.bottom), width: horizontalOverlap, height: channel.gap };
    issues.push({
      id: `channel:${pairKey(channel.firstId, channel.secondId)}`,
      type: 'channel',
      severity: channelSeverity(channel.gap),
      elementIds: [channel.firstId, channel.secondId],
      summary: `「${first.name}」与「${second.name}」之间通道过窄`,
      metricLabel: `净宽 ${channel.gap.toFixed(1)} m`,
      metric: Number((MIN_CHANNEL - channel.gap).toFixed(2)),
      fingerprint: buildFingerprint('channel', [channel.firstId, channel.secondId], document),
      highlight,
    });
  }
  return issues;
};

export const reconcileIssues = (
  issues: AnalysisIssue[],
  resolutions: Record<string, IssueResolution>,
): { entries: IssueEntry[]; resolutions: Record<string, IssueResolution> } => {
  const nextResolutions: Record<string, IssueResolution> = {};
  const entries = issues.map((issue) => {
    const resolution = resolutions[issue.id];
    if (resolution && resolution.fingerprint === issue.fingerprint) {
      nextResolutions[issue.id] = resolution;
      return { ...issue, status: resolution.status };
    }
    return { ...issue, status: 'pending' as const };
  });
  return { entries, resolutions: nextResolutions };
};

const SEVERITY_RANK: Record<IssueSeverity, number> = { high: 0, medium: 1, low: 2 };
const TYPE_RANK: Record<IssueType, number> = { overlap: 0, bounds: 1, channel: 2 };

export const sortIssues = <T extends AnalysisIssue>(issues: T[], sort: IssueSort): T[] =>
  [...issues].sort((a, b) => {
    const primary = sort === 'severity' ? SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] : TYPE_RANK[a.type] - TYPE_RANK[b.type];
    const secondary = sort === 'severity' ? TYPE_RANK[a.type] - TYPE_RANK[b.type] : SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    return primary || secondary || b.metric - a.metric || a.id.localeCompare(b.id);
  });
