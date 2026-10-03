import type { IssueView, LayoutMode, Notice } from '../../types';

interface StatusBarProps {
  mode: LayoutMode;
  issues: IssueView[];
  notice: Notice;
  elementCount: number;
  lastSavedAt: number | null;
  onModeChange: (mode: LayoutMode) => void;
}

export function StatusBar({ mode, issues, notice, elementCount, lastSavedAt, onModeChange }: StatusBarProps) {
  const pending = issues.filter((issue) => issue.status === 'pending').length;
  const resolved = issues.length - pending;
  return <div className="bottom-bar">
    <div className="status-message"><span className={`status-dot ${notice.tone}`} />{notice.message}<small>{lastSavedAt ? `· 已保存 ${new Date(lastSavedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : ''}</small></div>
    <div className="bottom-meta"><span>{elementCount} 个元素</span><span className={pending ? 'has-issues' : 'is-clear'}>{pending ? `${pending} 项待处理` : '布局状态良好'}{resolved ? ` · ${resolved} 项已标记` : ''}</span><span>自动保存</span></div>
    <div className="mode-tabs"><button type="button" className={mode === 'edit' ? 'active' : ''} onClick={() => onModeChange('edit')}>编辑</button><button type="button" className={mode === 'inspect' ? 'active' : ''} onClick={() => onModeChange('inspect')}>检查 {pending ? <b>{pending}</b> : null}</button><button type="button" className={mode === 'path' ? 'active' : ''} onClick={() => onModeChange('path')}>路径预览</button></div>
  </div>;
}
