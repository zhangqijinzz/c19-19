import { describe, expect, it, vi } from 'vitest';
import { createStarterDocument } from '../src/domain';
import type { LayoutRepository } from '../src/repository';
import type { LayoutDocument } from '../src/types';
import { ExpoSketchViewModel } from '../src/viewModel';

const fakeRepository = (initial: LayoutDocument | null = null): LayoutRepository => ({
  load: vi.fn(async () => initial ?? createStarterDocument()),
  save: vi.fn(async (_document) => {}),
});

describe('ExpoSketchViewModel', () => {
  it('initializes and updates the selected layout', async () => {
    const repository = fakeRepository();
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    expect(vm.state.phase).toBe('ready');
    const count = vm.state.document.elements.length;
    vm.addElement('booth');
    expect(vm.state.document.elements).toHaveLength(count + 1);
    expect(vm.state.selectedId).toContain('booth-');
  });

  it('updates analysis immediately after moving an element into an overlap', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.moveElement('stage-1', 4.5, 2.5);
    expect(vm.state.analysis.overlaps.length).toBeGreaterThan(0);
  });

  it('recovers the example if repository loading fails', async () => {
    const repository: LayoutRepository = { load: vi.fn(async () => { throw new Error('bad storage'); }), save: vi.fn(async () => {}) };
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    expect(vm.state.phase).toBe('error');
    expect(vm.state.document.title).toContain('春日创意市集');
  });

  it('shows a save error without dropping the working document', async () => {
    const repository: LayoutRepository = { load: vi.fn(async () => createStarterDocument()), save: vi.fn(async () => { throw new Error('quota'); }) };
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    vm.addElement('stage');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(vm.state.document.elements.some((element) => element.kind === 'stage' && element.id.startsWith('stage-'))).toBe(true);
    expect(vm.state.notice.tone).toBe('error');
  });

  it('ignores invalid dimensions instead of corrupting the working selection', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    const before = vm.state.document.elements[0].width;
    vm.resizeSelected(0, 0);
    expect(vm.state.document.elements[0].width).toBe(before);
  });

  it('keeps a confirmed issue until a related element changes again', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.moveElement('stage-1', 4.5, 2.5);
    const issue = vm.state.issues.find((item) => item.type === 'overlap')!;
    expect(issue.status).toBe('pending');
    vm.resolveIssue(issue.id, 'confirmed');
    expect(vm.state.issues.find((item) => item.id === issue.id)!.status).toBe('confirmed');
    vm.moveElement('booth-2', 21, 12);
    expect(vm.state.issues.find((item) => item.id === issue.id)!.status).toBe('confirmed');
    vm.moveElement('stage-1', 5, 3);
    expect(vm.state.issues.find((item) => item.id === issue.id)!.status).toBe('pending');
  });

  it('reopens a decided issue back to pending', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.moveElement('stage-1', 4.5, 2.5);
    const issue = vm.state.issues.find((item) => item.type === 'overlap')!;
    vm.resolveIssue(issue.id, 'deferred');
    expect(vm.state.issues.find((item) => item.id === issue.id)!.status).toBe('deferred');
    vm.reopenIssue(issue.id);
    expect(vm.state.issues.find((item) => item.id === issue.id)!.status).toBe('pending');
  });

  it('drops resolutions and focus when a related element is removed', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.moveElement('stage-1', 4.5, 2.5);
    const issue = vm.state.issues.find((item) => item.type === 'overlap')!;
    vm.resolveIssue(issue.id, 'confirmed');
    vm.focusIssue(issue.id);
    expect(vm.state.focusedIssue?.id).toBe(issue.id);
    vm.selectElement('stage-1');
    vm.removeSelected();
    expect(vm.state.issues.some((item) => item.id === issue.id)).toBe(false);
    expect(vm.state.issueResolutions[issue.id]).toBeUndefined();
    expect(vm.state.focusedIssueId).toBeNull();
    expect(vm.state.focusedIssue).toBeNull();
  });

  it('invalidates bounds decisions when the field is resized but keeps overlap decisions', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.moveElement('stage-1', 4.5, 2.5);
    vm.moveElement('booth-2', 26, 2);
    const overlap = vm.state.issues.find((item) => item.type === 'overlap')!;
    const bounds = vm.state.issues.find((item) => item.type === 'bounds')!;
    vm.resolveIssue(overlap.id, 'confirmed');
    vm.resolveIssue(bounds.id, 'deferred');
    vm.resizeField(30, 18);
    expect(vm.state.issues.find((item) => item.id === bounds.id)!.status).toBe('pending');
    expect(vm.state.issues.find((item) => item.id === overlap.id)!.status).toBe('confirmed');
  });

  it('reorders the issue list when the sort mode changes', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.moveElement('stage-1', 4.5, 2.5);
    vm.moveElement('booth-2', 26, 2);
    vm.setIssueSort('type');
    const types = vm.state.issues.map((item) => item.type);
    expect(types.indexOf('overlap')).toBeLessThan(types.indexOf('bounds'));
  });

  it('focuses an issue and clears the focus again', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.moveElement('stage-1', 4.5, 2.5);
    const issue = vm.state.issues[0];
    vm.focusIssue(issue.id);
    expect(vm.state.focusedIssueId).toBe(issue.id);
    vm.focusIssue(null);
    expect(vm.state.focusedIssueId).toBeNull();
  });
});
