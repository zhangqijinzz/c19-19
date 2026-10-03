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

  it('lists locateable issues with severity and a default pending status', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.moveElement('stage-1', 4.5, 2.5);
    const issue = vm.state.analysis.issues.find((item) => item.kind === 'overlap');
    expect(issue).toBeTruthy();
    expect(issue?.status).toBe('pending');
    expect(issue?.elementIds).toContain('stage-1');
    expect(['high', 'medium', 'low']).toContain(issue?.severity);
  });

  it('focuses an issue in inspect mode and selects the first involved element', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.moveElement('stage-1', 4.5, 2.5);
    const issue = vm.state.analysis.issues.find((item) => item.kind === 'overlap');
    vm.focusIssue(issue!.id);
    expect(vm.state.activeIssueId).toBe(issue!.id);
    expect(vm.state.mode).toBe('inspect');
    expect(issue!.elementIds).toContain(vm.state.selectedId);
  });

  it('stores a confirmation and resets it to pending once an involved element moves again', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.moveElement('stage-1', 4.5, 2.5);
    const issue = vm.state.analysis.issues.find((item) => item.kind === 'overlap');
    vm.setIssueStatus(issue!.id, 'confirmed');
    expect(vm.state.analysis.issues.find((item) => item.id === issue!.id)?.status).toBe('confirmed');
    vm.moveElement('stage-1', 4.8, 2.6);
    expect(vm.state.analysis.issues.find((item) => item.id === issue!.id)?.status).toBe('pending');
  });

  it('resets bounds conclusions after the field size changes', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    const boundsId = vm.state.analysis.issues.find((item) => item.kind === 'bounds')?.id;
    expect(boundsId).toBeUndefined();
    vm.resizeField(13, 10);
    const newBounds = vm.state.analysis.issues.find((item) => item.kind === 'bounds');
    expect(newBounds).toBeTruthy();
    vm.setIssueStatus(newBounds!.id, 'ignored');
    expect(vm.state.analysis.issues.find((item) => item.id === newBounds!.id)?.status).toBe('ignored');
    vm.resizeField(30, 20);
    expect(vm.state.analysis.issues.some((item) => item.id === newBounds!.id)).toBe(false);
  });

  it('drops marks and the active selection when an involved element is deleted', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.moveElement('stage-1', 4.5, 2.5);
    const issue = vm.state.analysis.issues.find((item) => item.kind === 'overlap');
    vm.setIssueStatus(issue!.id, 'confirmed');
    vm.focusIssue(issue!.id);
    vm.selectElement('stage-1');
    vm.removeSelected();
    expect(vm.state.analysis.issues.some((item) => item.id === issue!.id)).toBe(false);
    expect(vm.state.activeIssueId).toBeNull();
  });
});
