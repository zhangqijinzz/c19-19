import type { Analysis, IssueDecision, IssueEntry, IssueSeverity, IssueSort, IssueStatus, IssueType, LayoutMode } from '../../types';

const TYPE_LABEL: Record<IssueType, string> = { overlap: '重叠', bounds: '越界', channel: '窄通道' };
const SEVERITY_LABEL: Record<IssueSeverity, string> = { high: '高', medium: '中', low: '低' };
const STATUS_LABEL: Record<IssueStatus, string> = { pending: '待处理', confirmed: '已确认', deferred: '已暂缓' };

interface AnalysisPanelProps {
  analysis: Analysis;
  issues: IssueEntry[];
  mode: LayoutMode;
  elementCount: number;
  issueSort: IssueSort;
  focusedIssueId: string | null;
  onFocusIssue: (id: string | null) => void;
  onSortChange: (sort: IssueSort) => void;
  onResolve: (id: string, decision: IssueDecision) => void;
  onReopen: (id: string) => void;
}

export function AnalysisPanel({ analysis, issues, mode, elementCount, issueSort, focusedIssueId, onFocusIssue, onSortChange, onResolve, onReopen }: AnalysisPanelProps) {
  const pendingCount = issues.filter((issue) => issue.status === 'pending').length;
  const confirmedCount = issues.filter((issue) => issue.status === 'confirmed').length;
  const deferredCount = issues.filter((issue) => issue.status === 'deferred').length;
  const pathMessage = analysis.path ? `${analysis.path.fromName} → ${analysis.path.toName} · ${analysis.path.distance} m` : '需要入口和重点区域才能生成路径';
  return <section className={`analysis-panel analysis-${mode}`}>
    <div className="analysis-summary-row">
      <div className="analysis-title"><span className="analysis-pulse" /><div><span className="section-kicker">LIVE ANALYSIS</span><strong>{mode === 'path' ? '访问路径预览' : mode === 'inspect' ? '空间检查结果' : '布局概览'}</strong></div></div>
      <div className="analysis-metrics"><span><b>{elementCount}</b>元素</span><span className={analysis.overlaps.length ? 'metric-warning' : ''}><b>{analysis.overlaps.length}</b>重叠</span><span className={analysis.bounds.length ? 'metric-warning' : ''}><b>{analysis.bounds.length}</b>越界</span><span className={analysis.channels.length ? 'metric-warning' : ''}><b>{analysis.channels.length}</b>窄通道</span></div>
      <div className="analysis-result"><strong>{issues.length ? `${pendingCount} 项待处理 · 共 ${issues.length} 项` : '当前布局通行顺畅'}</strong><small>{pathMessage}</small></div>
    </div>
    {issues.length ? <div className="issue-board">
      <div className="issue-board-head">
        <strong>问题清单</strong>
        <span className="issue-status-meta">待处理 {pendingCount} · 已确认 {confirmedCount} · 暂缓 {deferredCount}</span>
        <div className="issue-sort-tabs" role="group" aria-label="清单排序方式">
          <button type="button" className={issueSort === 'severity' ? 'active' : ''} onClick={() => onSortChange('severity')}>按严重程度</button>
          <button type="button" className={issueSort === 'type' ? 'active' : ''} onClick={() => onSortChange('type')}>按类型</button>
        </div>
      </div>
      <ul className="issue-list">
        {issues.map((issue) => {
          const focused = issue.id === focusedIssueId;
          return <li key={issue.id} className={`issue-row status-${issue.status}${focused ? ' is-focused' : ''}`}>
            <button type="button" className="issue-locate" aria-pressed={focused} title={focused ? '取消定位' : '在平面图中定位'} onClick={() => onFocusIssue(focused ? null : issue.id)}>
              <span className={`issue-type-badge type-${issue.type}`}>{TYPE_LABEL[issue.type]}</span>
              <span className="issue-summary">{issue.summary}</span>
              <span className="issue-metric">{issue.metricLabel}</span>
              <span className={`issue-severity severity-${issue.severity}`}>{SEVERITY_LABEL[issue.severity]}</span>
              <span className={`issue-status-tag status-${issue.status}`}>{STATUS_LABEL[issue.status]}</span>
            </button>
            <span className="issue-actions">
              {issue.status === 'pending' ? <>
                <button type="button" onClick={() => onResolve(issue.id, 'confirmed')}>确认</button>
                <button type="button" onClick={() => onResolve(issue.id, 'deferred')}>暂缓</button>
              </> : <button type="button" onClick={() => onReopen(issue.id)}>撤销标记</button>}
            </span>
          </li>;
        })}
      </ul>
    </div> : null}
  </section>;
}
