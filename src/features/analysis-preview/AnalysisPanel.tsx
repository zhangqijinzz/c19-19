import { useMemo, useState } from 'react';
import type { Analysis, IssueKind, IssueSeverity, IssueStatus, IssueView, LayoutMode } from '../../types';

type SortMode = 'severity' | 'type';
type StatusFilter = 'all' | IssueStatus;

interface AnalysisPanelProps {
  analysis: Analysis;
  mode: LayoutMode;
  elementCount: number;
  activeIssueId: string | null;
  onFocusIssue: (id: string | null) => void;
  onSetIssueStatus: (id: string, status: IssueStatus) => void;
}

const KIND_LABEL: Record<IssueKind, string> = { overlap: '重叠', bounds: '越界', channel: '窄通道' };
const KIND_ORDER: Record<IssueKind, number> = { overlap: 0, bounds: 1, channel: 2 };
const SEVERITY_LABEL: Record<IssueSeverity, string> = { high: '严重', medium: '中等', low: '轻微' };
const SEVERITY_RANK: Record<IssueSeverity, number> = { high: 0, medium: 1, low: 2 };
const STATUS_LABEL: Record<IssueStatus, string> = { pending: '待处理', confirmed: '已确认', ignored: '暂不处理' };
const KIND_FILTERS: Array<{ key: IssueKind | 'all'; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'overlap', label: '重叠' },
  { key: 'bounds', label: '越界' },
  { key: 'channel', label: '窄通道' },
];
const STATUS_FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: '全部状态' },
  { key: 'pending', label: '待处理' },
  { key: 'confirmed', label: '已确认' },
  { key: 'ignored', label: '暂不处理' },
];

export function AnalysisPanel({ analysis, mode, elementCount, activeIssueId, onFocusIssue, onSetIssueStatus }: AnalysisPanelProps) {
  const [sortMode, setSortMode] = useState<SortMode>('severity');
  const [kindFilter, setKindFilter] = useState<IssueKind | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const counts = useMemo(() => ({
    overlap: analysis.overlaps.length,
    bounds: analysis.bounds.length,
    channel: analysis.channels.length,
    pending: analysis.issues.filter((issue) => issue.status === 'pending').length,
    confirmed: analysis.issues.filter((issue) => issue.status === 'confirmed').length,
    ignored: analysis.issues.filter((issue) => issue.status === 'ignored').length,
  }), [analysis]);

  const visibleIssues = useMemo(() => {
    const filtered = analysis.issues.filter((issue) =>
      (kindFilter === 'all' || issue.kind === kindFilter) &&
      (statusFilter === 'all' || issue.status === statusFilter));
    return filtered.sort((a, b) => {
      if (sortMode === 'type') {
        const byKind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
        return byKind !== 0 ? byKind : a.title.localeCompare(b.title);
      }
      const byStatus = Number(a.status !== 'pending') - Number(b.status !== 'pending');
      if (byStatus !== 0) return byStatus;
      const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (bySeverity !== 0) return bySeverity;
      return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    });
  }, [analysis.issues, kindFilter, statusFilter, sortMode]);

  const pathMessage = analysis.path
    ? `${analysis.path.fromName} → ${analysis.path.toName} · ${analysis.path.distance} m`
    : '需要入口和重点区域才能生成路径';

  return <section className={`analysis-panel analysis-${mode} is-checklist`}>
    <div className="checklist-head">
      <div className="analysis-title">
        <span className={`analysis-pulse ${counts.pending ? 'has-pending' : ''}`} />
        <div>
          <span className="section-kicker">LIVE ANALYSIS · CHECKLIST</span>
          <strong>空间检查清单</strong>
        </div>
      </div>
      <div className="analysis-metrics">
        <span><b>{elementCount}</b>元素</span>
        <span className={counts.overlap ? 'metric-warning' : ''}><b>{counts.overlap}</b>重叠</span>
        <span className={counts.bounds ? 'metric-warning' : ''}><b>{counts.bounds}</b>越界</span>
        <span className={counts.channel ? 'metric-warning' : ''}><b>{counts.channel}</b>窄通道</span>
      </div>
      <div className="checklist-summary">
        {analysis.issues.length
          ? <><strong>{counts.pending} 项待处理</strong><small>已确认 {counts.confirmed} · 暂不处理 {counts.ignored}</small></>
          : <><strong>当前布局通行顺畅</strong><small>未发现重叠、越界或窄通道</small></>}
      </div>
    </div>

    <div className="checklist-toolbar">
      <div className="filter-chips" role="group" aria-label="按类型筛选">
        {KIND_FILTERS.map((filter) => {
          const total = filter.key === 'all' ? analysis.issues.length : counts[filter.key as IssueKind];
          return <button key={filter.key} type="button" className={`chip ${kindFilter === filter.key ? 'active' : ''}`} onClick={() => setKindFilter(filter.key)}>{filter.label}<b>{total}</b></button>;
        })}
      </div>
      <div className="toolbar-right">
        <label className="filter-select">状态
          <select aria-label="按状态筛选" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
            {STATUS_FILTERS.map((filter) => <option key={filter.key} value={filter.key}>{filter.label}</option>)}
          </select>
        </label>
        <div className="sort-tabs" role="group" aria-label="排序方式">
          <button type="button" className={sortMode === 'severity' ? 'active' : ''} onClick={() => setSortMode('severity')}>按严重程度</button>
          <button type="button" className={sortMode === 'type' ? 'active' : ''} onClick={() => setSortMode('type')}>按类型</button>
        </div>
      </div>
    </div>

    {visibleIssues.length
      ? <ul className="issue-list">
        {visibleIssues.map((issue) => <IssueRow key={issue.id} issue={issue} active={issue.id === activeIssueId} onFocus={() => onFocusIssue(issue.id === activeIssueId ? null : issue.id)} onSetStatus={onSetIssueStatus} />)}
      </ul>
      : <div className="issue-empty">{analysis.issues.length ? '当前筛选条件下没有条目' : '布局检查通过，无需处理的条目'}</div>}

    <div className="checklist-foot">
      <span className="path-preview"><i />{mode === 'path' ? '路径模式' : '访问路径'}：{pathMessage}</span>
      <small>点击条目在平面图上定位 · 参与元素再次改动后已标记条目会自动回到待处理</small>
    </div>
  </section>;
}

interface IssueRowProps {
  issue: IssueView;
  active: boolean;
  onFocus: () => void;
  onSetStatus: (id: string, status: IssueStatus) => void;
}

function IssueRow({ issue, active, onFocus, onSetStatus }: IssueRowProps) {
  return <li className={`issue-row severity-${issue.severity} status-${issue.status} ${active ? 'is-active' : ''}`}>
    <button type="button" className="issue-main" onClick={onFocus} aria-pressed={active}>
      <span className={`issue-badge kind-${issue.kind}`}>{KIND_LABEL[issue.kind]}</span>
      <span className="issue-copy">
        <strong>{issue.title}<i className={`severity-tag ${issue.severity}`}>{SEVERITY_LABEL[issue.severity]}</i><i className={`status-tag ${issue.status}`}>{STATUS_LABEL[issue.status]}</i></strong>
        <small>{issue.detail}</small>
      </span>
      <span className="issue-metric">{issue.metricLabel}</span>
      <span className="issue-locate">{active ? '取消定位' : '定位 ⌖'}</span>
    </button>
    <span className="issue-actions">
      <button type="button" className={issue.status === 'confirmed' ? 'active' : ''} onClick={(event) => { event.stopPropagation(); onSetStatus(issue.id, issue.status === 'confirmed' ? 'pending' : 'confirmed'); }} title="标记为已确认">✓ 已确认</button>
      <button type="button" className={issue.status === 'ignored' ? 'active' : ''} onClick={(event) => { event.stopPropagation(); onSetStatus(issue.id, issue.status === 'ignored' ? 'pending' : 'ignored'); }} title="标记为暂不处理">– 暂不处理</button>
    </span>
  </li>;
}
