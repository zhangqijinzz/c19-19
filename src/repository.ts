import { createStarterDocument } from './domain';
import type { DocumentStorageService } from './storageService';
import type { ExpoElement, LayoutDocument } from './types';

export interface LayoutRepository {
  load(): Promise<LayoutDocument>;
  save(document: LayoutDocument): Promise<void>;
}

const isElement = (value: unknown): value is ExpoElement => {
  if (!value || typeof value !== 'object') return false;
  const element = value as Record<string, unknown>;
  return typeof element.id === 'string' && typeof element.kind === 'string' && typeof element.x === 'number' && typeof element.y === 'number' && typeof element.width === 'number' && typeof element.height === 'number' && typeof element.rotation === 'number';
};

const isIssueMark = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  const mark = value as Record<string, unknown>;
  return typeof mark.id === 'string' && (mark.status === 'confirmed' || mark.status === 'ignored') && typeof mark.signature === 'string';
};

const isDocument = (value: unknown): value is LayoutDocument => {
  if (!value || typeof value !== 'object') return false;
  const document = value as Record<string, unknown>;
  const field = document.field as Record<string, unknown> | undefined;
  const hasValidMarks = document.issueMarks === undefined || (Array.isArray(document.issueMarks) && document.issueMarks.every(isIssueMark));
  return document.version === 1 && typeof document.title === 'string' && !!field && typeof field.width === 'number' && typeof field.height === 'number' && Array.isArray(document.elements) && document.elements.every(isElement) && hasValidMarks;
};

export class LocalLayoutRepository implements LayoutRepository {
  constructor(private readonly storage: DocumentStorageService) {}

  async load(): Promise<LayoutDocument> {
    try {
      const saved = await this.storage.read();
      if (!isDocument(saved)) return createStarterDocument();
      // 清理指向已删除元素的悬空标记：条目 id 中携带参与元素 id
      const elementIds = new Set(saved.elements.map((element) => element.id));
      const issueMarks = (saved.issueMarks ?? []).filter((mark) => {
        const elementRefs = mark.id.split(':')[1]?.split('~') ?? [];
        return elementRefs.every((id) => elementIds.has(id));
      });
      return { ...saved, issueMarks };
    } catch {
      return createStarterDocument();
    }
  }

  async save(document: LayoutDocument): Promise<void> {
    await this.storage.write(document);
  }
}
