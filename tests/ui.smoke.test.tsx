import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../src/App';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('analysis checklist UI', () => {
  it('renders locateable issue rows, focuses them on the canvas and cycles marks', async () => {
    await act(async () => {
      root.render(<App />);
      await flush();
    });

    const rows = container.querySelectorAll('.issue-row');
    expect(rows.length).toBeGreaterThan(0);
    const firstRow = rows[0] as HTMLElement;
    expect(firstRow.querySelector('.issue-badge')?.textContent).toMatch(/重叠|越界|窄通道/);
    expect(firstRow.querySelector('.status-tag')?.textContent).toBe('待处理');

    await act(async () => {
      (firstRow.querySelector('.issue-locate') as HTMLElement).click();
      await flush();
    });
    expect(container.querySelector('.issue-row.is-active')).not.toBeNull();
    expect(container.querySelector('.issue-highlight-layer')).not.toBeNull();
    expect(container.querySelectorAll('.canvas-element.is-issue-involved').length).toBeGreaterThan(0);
    expect(container.querySelector('.active-issue-tag')).not.toBeNull();

    await act(async () => {
      (firstRow.querySelector('.issue-actions button') as HTMLElement).click();
      await flush();
    });
    expect(container.querySelector('.issue-row.status-confirmed .status-tag')?.textContent).toBe('已确认');

    await act(async () => {
      (container.querySelector('.sort-tabs button:nth-child(2)') as HTMLElement).click();
      (container.querySelector('.filter-chips .chip:nth-child(2)') as HTMLElement).click();
      await flush();
    });
    container.querySelectorAll('.issue-row').forEach((row) => {
      expect(row.querySelector('.issue-badge')?.textContent).toBe('重叠');
    });
  });
});
