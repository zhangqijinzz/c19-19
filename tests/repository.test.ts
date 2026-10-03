import { describe, expect, it } from 'vitest';
import { createStarterDocument } from '../src/domain';
import { LocalLayoutRepository } from '../src/repository';
import { BrowserStorageService } from '../src/storageService';

describe('LocalLayoutRepository', () => {
  it('falls back to the starter document when persisted JSON is damaged', async () => {
    window.localStorage.setItem('exposketch.document.v1', '{broken-json');
    const repository = new LocalLayoutRepository(new BrowserStorageService());
    expect(await repository.load()).toEqual(createStarterDocument());
    window.localStorage.clear();
  });

  it('round-trips issue marks together with the document', async () => {
    const document = { ...createStarterDocument(), issueMarks: [{ id: 'overlap:booth-1~booth-2', status: 'confirmed' as const, signature: 'sig-1' }] };
    const repository = new LocalLayoutRepository(new BrowserStorageService());
    await repository.save(document);
    const loaded = await repository.load();
    expect(loaded.issueMarks).toEqual([{ id: 'overlap:booth-1~booth-2', status: 'confirmed', signature: 'sig-1' }]);
    window.localStorage.clear();
  });

  it('drops marks pointing at elements that no longer exist', async () => {
    const document = {
      ...createStarterDocument(),
      issueMarks: [
        { id: 'bounds:stage-1', status: 'ignored' as const, signature: 'sig-1' },
        { id: 'overlap:deleted-x~deleted-y', status: 'confirmed' as const, signature: 'sig-2' },
      ],
    };
    const repository = new LocalLayoutRepository(new BrowserStorageService());
    await repository.save(document);
    const loaded = await repository.load();
    expect(loaded.issueMarks?.map((mark) => mark.id)).toEqual(['bounds:stage-1']);
    window.localStorage.clear();
  });
});
