import { createElement, createStarterDocument, analyzeLayout, findElement, getBoundingBox, normalizeRotation } from './domain';
import type { LayoutRepository } from './repository';
import type { Analysis, ElementKind, IssueStatus, IssueView, LayoutDocument, LayoutMode, Notice, RenderElement, ViewPhase } from './types';

interface IssueMark {
  status: IssueStatus;
  signature: string;
}

interface ReconciledIssues {
  analysis: Analysis;
  issues: IssueView[];
  marks: Map<string, IssueMark>;
  activeIssueId: string | null;
}

export interface ExpoSketchState {
  phase: ViewPhase;
  document: LayoutDocument;
  renderElements: RenderElement[];
  selectedId: string | null;
  selectedElement: RenderElement | null;
  mode: LayoutMode;
  analysis: Analysis;
  activeIssueId: string | null;
  notice: Notice;
  lastSavedAt: number | null;
}

const toRenderElements = (document: LayoutDocument): RenderElement[] => document.elements.map((element) => {
  const box = getBoundingBox(element);
  return { ...element, displayWidth: box.width, displayHeight: box.height, occupiedArea: Number((box.width * box.height).toFixed(1)) };
});

const starter = createStarterDocument();
const starterRenderElements = toRenderElements(starter);

type Listener = () => void;

export class ExpoSketchViewModel {
  private listeners = new Set<Listener>();
  private issueMarks = new Map<string, IssueMark>();
  private stateValue: ExpoSketchState = {
    phase: 'loading',
    document: starter,
    renderElements: starterRenderElements,
    selectedId: 'stage-1',
    selectedElement: starterRenderElements.find((element) => element.id === 'stage-1') ?? null,
    mode: 'edit',
    analysis: analyzeLayout(createStarterDocument()),
    activeIssueId: null,
    notice: { tone: 'info', message: '正在恢复最近布局…' },
    lastSavedAt: null,
  };

  constructor(private readonly repository: LayoutRepository) {}

  get state() { return this.stateValue; }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async initialize() {
    try {
      const document = await this.repository.load();
      this.issueMarks = new Map((document.issueMarks ?? []).map((mark) => [mark.id, { status: mark.status, signature: mark.signature }]));
      this.commit({ document, selectedId: document.elements[0]?.id ?? null, phase: 'ready', notice: { tone: 'success', message: '布局已就绪，可开始编辑' } });
    } catch {
      this.issueMarks = new Map();
      this.commit({ phase: 'error', notice: { tone: 'error', message: '布局读取失败，已载入安全示例' } });
    }
  }

  selectElement(id: string) { this.commit({ selectedId: id }); }

  setMode(mode: LayoutMode) { this.commit({ mode, notice: { tone: 'info', message: mode === 'inspect' ? '检查模式已开启：拖动元素查看即时提示' : mode === 'path' ? '路径模式已开启：入口到重点区域的访问路线已生成' : '编辑模式已开启' } }); }

  focusIssue(issueId: string | null) {
    const issue = this.stateValue.analysis.issues.find((item) => item.id === issueId);
    if (!issue) {
      this.commit({ activeIssueId: null });
      return;
    }
    this.commit({
      activeIssueId: issue.id,
      selectedId: issue.elementIds[0] ?? null,
      mode: 'inspect',
      notice: { tone: 'info', message: `已定位：${issue.title}` },
    });
  }

  setIssueStatus(issueId: string, status: IssueStatus) {
    const issue = this.stateValue.analysis.issues.find((item) => item.id === issueId);
    if (!issue) return;
    if (status === 'pending') this.issueMarks.delete(issueId);
    else this.issueMarks.set(issueId, { status, signature: issue.signature });
    const notice = status === 'confirmed'
      ? { tone: 'success' as const, message: `已确认：${issue.title}` }
      : status === 'ignored'
        ? { tone: 'info' as const, message: `已暂不处理：${issue.title}` }
        : { tone: 'info' as const, message: `已重新标记为待处理：${issue.title}` };
    this.commitAndPersist({ notice }, { preserveActive: true });
  }

  addElement(kind: ElementKind) {
    const element = createElement(kind, this.stateValue.document.elements.length, this.stateValue.document.field);
    const document = { ...this.stateValue.document, elements: [...this.stateValue.document.elements, element] };
    this.commitAndPersist({ document, selectedId: element.id, notice: { tone: 'success', message: `${element.name} 已加入场地` } });
  }

  removeSelected() {
    if (!this.stateValue.selectedId) return;
    const removed = findElement(this.stateValue.document, this.stateValue.selectedId);
    const elements = this.stateValue.document.elements.filter((element) => element.id !== this.stateValue.selectedId);
    this.commitAndPersist({ document: { ...this.stateValue.document, elements }, selectedId: elements[0]?.id ?? null, notice: { tone: 'info', message: `${removed?.name ?? '元素'} 已移除` } });
  }

  moveElement(id: string, x: number, y: number) {
    const elements = this.stateValue.document.elements.map((element) => element.id === id ? { ...element, x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) } : element);
    this.commitAndPersist({ document: { ...this.stateValue.document, elements } });
  }

  resizeSelected(width: number, height: number) {
    const id = this.stateValue.selectedId;
    if (!id || width <= 0 || height <= 0) return;
    const elements = this.stateValue.document.elements.map((element) => element.id === id ? { ...element, width: Number(width.toFixed(1)), height: Number(height.toFixed(1)) } : element);
    this.commitAndPersist({ document: { ...this.stateValue.document, elements } });
  }

  rotateSelected() {
    const id = this.stateValue.selectedId;
    if (!id) return;
    const elements = this.stateValue.document.elements.map((element) => element.id === id ? { ...element, rotation: normalizeRotation(element.rotation + 90) } : element);
    this.commitAndPersist({ document: { ...this.stateValue.document, elements }, notice: { tone: 'info', message: '方向已旋转 90°' } });
  }

  renameSelected(name: string) {
    const id = this.stateValue.selectedId;
    if (!id || !name.trim()) return;
    const elements = this.stateValue.document.elements.map((element) => element.id === id ? { ...element, name: name.trim() } : element);
    this.commitAndPersist({ document: { ...this.stateValue.document, elements } });
  }

  resizeField(width: number, height: number) {
    if (width < 12 || height < 10) return;
    this.commitAndPersist({ document: { ...this.stateValue.document, field: { width: Number(width.toFixed(1)), height: Number(height.toFixed(1)) } }, notice: { tone: 'success', message: '场地尺寸已更新' } });
  }

  renameProject(title: string) {
    if (!title.trim()) return;
    this.commitAndPersist({ document: { ...this.stateValue.document, title: title.trim() } });
  }

  resetExample() {
    this.issueMarks = new Map();
    const document = createStarterDocument();
    this.commitAndPersist({ document, selectedId: 'stage-1', mode: 'edit', notice: { tone: 'success', message: '已恢复示例布局' } });
  }

  private commitAndPersist(patch: Partial<ExpoSketchState>, options: { preserveActive?: boolean } = {}) {
    this.commit(patch, options);
    void this.persist();
  }

  private async persist() {
    try {
      const documentWithMarks: LayoutDocument = {
        ...this.stateValue.document,
        issueMarks: [...this.issueMarks.entries()].map(([id, mark]) => ({
          id,
          status: mark.status as 'confirmed' | 'ignored',
          signature: mark.signature,
        })),
      };
      await this.repository.save(documentWithMarks);
      this.commit({ lastSavedAt: Date.now() });
    } catch {
      this.commit({ notice: { tone: 'error', message: '本地保存失败，当前编辑仍保留在页面中' } });
    }
  }

  private commit(patch: Partial<ExpoSketchState>, options: { preserveActive?: boolean } = {}) {
    const next = { ...this.stateValue, ...patch };
    const renderElements = toRenderElements(next.document);
    const reconciled = this.reconcileIssues(next.document, next.activeIssueId);
    this.issueMarks = reconciled.marks;
    const activeIssueId = options.preserveActive ? next.activeIssueId : reconciled.activeIssueId;
    this.stateValue = {
      ...next,
      renderElements,
      selectedElement: renderElements.find((element) => element.id === next.selectedId) ?? null,
      analysis: { ...reconciled.analysis, issues: reconciled.issues },
      activeIssueId,
    };
    this.listeners.forEach((listener) => listener());
  }

  private reconcileIssues(document: LayoutDocument, previousActiveIssueId: string | null): ReconciledIssues {
    const analysis = analyzeLayout(document);
    const marks = new Map<string, IssueMark>();
    const issues = analysis.issues.map((issue) => {
      const mark = this.issueMarks.get(issue.id);
      // 签名变化（参与元素再次改动、场地尺寸调整）时旧结论失效，条目回到待处理
      if (!mark || mark.signature !== issue.signature) return issue;
      marks.set(issue.id, mark);
      return { ...issue, status: mark.status };
    });
    // 条目已不存在（元素被删除或问题自行消失）时，旧标记不进入新表，不保留悬空结论
    return {
      analysis,
      issues,
      marks,
      activeIssueId: issues.some((issue) => issue.id === previousActiveIssueId) ? previousActiveIssueId : null,
    };
  }
}
