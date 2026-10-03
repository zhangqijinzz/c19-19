import type {
  Analysis,
  BoundsIssue,
  ChannelIssue,
  ElementKind,
  ElementSpec,
  ExpoElement,
  FieldSize,
  IssueKind,
  IssueSeverity,
  IssueView,
  LayoutDocument,
  PathPreview,
  OverlapIssue,
} from './types';

export const MIN_CHANNEL = 1.2;

export const OVERLAP_HIGH_AREA = 6;
export const OVERLAP_MEDIUM_AREA = 2;
export const BOUNDS_HIGH_OVERFLOW = 1;
export const BOUNDS_MEDIUM_OVERFLOW = 0.5;
export const CHANNEL_HIGH_GAP = 0.6;
export const CHANNEL_MEDIUM_GAP = 0.9;
export const BOUNDS_EDGE_MARK = 0.45;

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

const round2 = (value: number) => Number(value.toFixed(2));

export const createIssueId = (kind: IssueKind, elementIds: string[]): string =>
  `${kind}:${[...elementIds].sort().join('~')}`;

const issueSeverity = (kind: IssueKind, metric: number): IssueSeverity => {
  if (kind === 'overlap') return metric >= OVERLAP_HIGH_AREA ? 'high' : metric >= OVERLAP_MEDIUM_AREA ? 'medium' : 'low';
  if (kind === 'bounds') return metric >= BOUNDS_HIGH_OVERFLOW ? 'high' : metric >= BOUNDS_MEDIUM_OVERFLOW ? 'medium' : 'low';
  return metric <= CHANNEL_HIGH_GAP ? 'high' : metric <= CHANNEL_MEDIUM_GAP ? 'medium' : 'low';
};

const boxSignature = (element: ExpoElement): string => {
  const box = getBoundingBox(element);
  return `${element.id}@${round2(element.x)},${round2(element.y)},${round2(box.width)}x${round2(box.height)}r${normalizeRotation(element.rotation)}`;
};

const fieldSignature = (field: FieldSize): string => `field=${round2(field.width)}x${round2(field.height)}`;

export const createIssueSignature = (kind: IssueKind, elementIds: string[], elements: ExpoElement[], field: FieldSize): string => {
  const byId = new Map(elements.map((element) => [element.id, element]));
  const body = [...elementIds].sort().map((id) => {
    const element = byId.get(id);
    return element ? boxSignature(element) : `missing:${id}`;
  }).join('|');
  return `${kind}#${fieldSignature(field)}|${body}`;
};

const pairName = (elementsById: Map<string, ExpoElement>, ids: string[], fallback: string): string => {
  const names = ids.map((id) => elementsById.get(id)?.name).filter(Boolean);
  return names.length >= 2 ? `${names[0]} × ${names[1]}` : fallback;
};

const overlapRect = (a: ReturnType<typeof getBoundingBox>, b: ReturnType<typeof getBoundingBox>) => {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  return { x: left, y: top, width: intersectionSize(a.left, a.right, b.left, b.right), height: intersectionSize(a.top, a.bottom, b.top, b.bottom) };
};

const channelRect = (a: ReturnType<typeof getBoundingBox>, b: ReturnType<typeof getBoundingBox>) => {
  const verticalOverlap = intersectionSize(a.top, a.bottom, b.top, b.bottom);
  const horizontalOverlap = intersectionSize(a.left, a.right, b.left, b.right);
  if (verticalOverlap > 0) {
    const gap = a.right <= b.left ? b.left - a.right : a.left - b.right;
    const x = a.right <= b.left ? a.right : b.right;
    const top = Math.max(a.top, b.top);
    return { x, y: top, width: gap, height: verticalOverlap };
  }
  const gap = a.bottom <= b.top ? b.top - a.bottom : a.top - b.bottom;
  const y = a.bottom <= b.top ? a.bottom : b.bottom;
  const left = Math.max(a.left, b.left);
  return { x: left, y, width: horizontalOverlap, height: gap };
};

const boundsRects = (field: FieldSize, element: ExpoElement) => {
  const box = getBoundingBox(element);
  const visible = {
    x: Math.max(0, box.left),
    y: Math.max(0, box.top),
    width: intersectionSize(box.left, box.right, 0, field.width),
    height: intersectionSize(box.top, box.bottom, 0, field.height),
  };
  const rects = visible.width > 0 && visible.height > 0 ? [visible] : [];
  const mark = BOUNDS_EDGE_MARK;
  const spans = [box.left, box.right, box.top, box.bottom];
  if (box.left < 0) rects.push({ x: 0, y: Math.max(0, box.top), width: mark, height: Math.min(box.height, field.height) });
  if (box.right > field.width) rects.push({ x: field.width - mark, y: Math.max(0, box.top), width: mark, height: Math.min(box.height, field.height) });
  if (box.top < 0) rects.push({ x: Math.max(0, box.left), y: 0, width: Math.min(box.width, field.width), height: mark });
  if (box.bottom > field.height) rects.push({ x: Math.max(0, box.left), y: field.height - mark, width: Math.min(box.width, field.width), height: mark });
  return { rects, spans };
};

export const buildIssueViews = (document: LayoutDocument): IssueView[] => {
  const { field, elements } = document;
  const byId = new Map(elements.map((element) => [element.id, element]));
  const boxes = new Map(elements.map((element) => [element.id, getBoundingBox(element)]));
  const issues: IssueView[] = [];

  findOverlaps(elements).forEach((issue) => {
    const ids = [issue.firstId, issue.secondId];
    const firstBox = boxes.get(issue.firstId);
    const secondBox = boxes.get(issue.secondId);
    const rects = firstBox && secondBox ? [overlapRect(firstBox, secondBox)] : [];
    issues.push({
      id: createIssueId('overlap', ids),
      kind: 'overlap',
      severity: issueSeverity('overlap', issue.amount),
      title: '元素重叠',
      detail: `${pairName(byId, ids, '两个元素')} 占用范围相交`,
      metric: issue.amount,
      metricLabel: `${issue.amount.toFixed(1)} m²`,
      elementIds: ids,
      highlightRects: rects,
      signature: createIssueSignature('overlap', ids, elements, field),
      status: 'pending',
    });
  });

  findBoundsIssues(field, elements).forEach((issue) => {
    const element = byId.get(issue.elementId);
    if (!element) return;
    const { rects, spans } = boundsRects(field, element);
    const sides = [`左边界外 ${(0 - spans[0]).toFixed(1)} m`, `右边界外 ${(spans[1] - field.width).toFixed(1)} m`, `上边界外 ${(0 - spans[2]).toFixed(1)} m`, `下边界外 ${(spans[3] - field.height).toFixed(1)} m`].filter((_, index) => [spans[0] < 0, spans[1] > field.width, spans[2] < 0, spans[3] > field.height][index]);
    issues.push({
      id: createIssueId('bounds', [issue.elementId]),
      kind: 'bounds',
      severity: issueSeverity('bounds', issue.overflow),
      title: '超出场地边界',
      detail: `${element.name}${sides.length ? ` · ${sides.join('，')}` : ' 超出场地'}`,
      metric: issue.overflow,
      metricLabel: `${issue.overflow.toFixed(1)} m`,
      elementIds: [issue.elementId],
      highlightRects: rects,
      signature: createIssueSignature('bounds', [issue.elementId], elements, field),
      status: 'pending',
    });
  });

  findNarrowChannels(elements).forEach((issue) => {
    const ids = [issue.firstId, issue.secondId];
    const firstBox = boxes.get(issue.firstId);
    const secondBox = boxes.get(issue.secondId);
    const rects = firstBox && secondBox ? [channelRect(firstBox, secondBox)] : [];
    issues.push({
      id: createIssueId('channel', ids),
      kind: 'channel',
      severity: issueSeverity('channel', issue.gap),
      title: '通道过窄',
      detail: `${pairName(byId, ids, '两个元素')} 间距小于 ${MIN_CHANNEL} m 通道要求`,
      metric: issue.gap,
      metricLabel: `${issue.gap.toFixed(1)} m`,
      elementIds: ids,
      highlightRects: rects,
      signature: createIssueSignature('channel', ids, elements, field),
      status: 'pending',
    });
  });

  return issues;
};

export const analyzeLayout = (document: LayoutDocument): Analysis => ({
  overlaps: findOverlaps(document.elements),
  bounds: findBoundsIssues(document.field, document.elements),
  channels: findNarrowChannels(document.elements),
  issues: buildIssueViews(document),
  path: createPathPreview(document.elements),
});

export const findElement = (document: LayoutDocument, id: string | null) => document.elements.find((element) => element.id === id) ?? null;

export const formatArea = (field: FieldSize) => `${field.width} × ${field.height} m`;
