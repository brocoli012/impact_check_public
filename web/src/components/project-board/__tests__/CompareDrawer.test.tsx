/**
 * @module web/components/project-board/__tests__/CompareDrawer.test
 * @description TASK-143: CompareDrawer 단위 테스트
 * - Drawer 열기/닫기
 * - ESC 키로 닫기
 * - 배경 클릭으로 닫기
 * - CompareSelector 렌더링 확인
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CompareDrawer from '../CompareDrawer';
import type { ProjectInfo } from '../../../types';

// 프로젝트 목 데이터
const mockProjects: ProjectInfo[] = [
  {
    id: 'proj-1',
    name: 'Project Alpha',
    path: '/test/alpha',
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    lastUsedAt: '2026-02-20T00:00:00Z',
    techStack: ['React'],
    resultCount: 3,
    latestGrade: 'Medium',
    latestScore: 35,
    latestAnalyzedAt: '2026-02-20T00:00:00Z',
    taskCount: 8,
    policyWarningCount: 1,
  },
  {
    id: 'proj-2',
    name: 'Project Beta',
    path: '/test/beta',
    status: 'active',
    createdAt: '2026-01-10T00:00:00Z',
    lastUsedAt: '2026-02-18T00:00:00Z',
    techStack: ['Vue'],
    resultCount: 5,
    latestGrade: 'High',
    latestScore: 55,
    latestAnalyzedAt: '2026-02-18T00:00:00Z',
    taskCount: 12,
    policyWarningCount: 3,
  },
];

// projectStore mock
vi.mock('../../../stores/projectStore', () => ({
  useProjectStore: () => ({
    projects: mockProjects,
    activeProjectId: 'proj-1',
    fetchProjects: vi.fn(),
  }),
}));

describe('CompareDrawer', () => {
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onClose = vi.fn();
    // body overflow 초기화
    document.body.style.overflow = '';
  });

  it('should render drawer when isOpen is true', () => {
    render(
      <CompareDrawer
        isOpen={true}
        onClose={onClose}
        currentProjectId="proj-1"
      />,
    );

    const drawer = screen.getByTestId('compare-drawer');
    expect(drawer).toBeInTheDocument();
    expect(drawer).toHaveAttribute('role', 'dialog');
    expect(drawer).toHaveAttribute('aria-modal', 'true');
  });

  it('should render drawer title', () => {
    render(
      <CompareDrawer
        isOpen={true}
        onClose={onClose}
        currentProjectId="proj-1"
      />,
    );

    expect(screen.getByText('프로젝트 비교')).toBeInTheDocument();
  });

  it('should render CompareSelector inside drawer', () => {
    render(
      <CompareDrawer
        isOpen={true}
        onClose={onClose}
        currentProjectId="proj-1"
      />,
    );

    expect(screen.getByTestId('compare-selector')).toBeInTheDocument();
    expect(screen.getByTestId('compare-select-a')).toBeInTheDocument();
    expect(screen.getByTestId('compare-select-b')).toBeInTheDocument();
  });

  it('should close on X button click', () => {
    render(
      <CompareDrawer
        isOpen={true}
        onClose={onClose}
        currentProjectId="proj-1"
      />,
    );

    const closeBtn = screen.getByTestId('compare-drawer-close');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should close on ESC key press', () => {
    render(
      <CompareDrawer
        isOpen={true}
        onClose={onClose}
        currentProjectId="proj-1"
      />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should close on backdrop click', () => {
    render(
      <CompareDrawer
        isOpen={true}
        onClose={onClose}
        currentProjectId="proj-1"
      />,
    );

    const overlay = screen.getByTestId('compare-drawer-overlay');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should NOT close when clicking inside the drawer panel', () => {
    render(
      <CompareDrawer
        isOpen={true}
        onClose={onClose}
        currentProjectId="proj-1"
      />,
    );

    const drawer = screen.getByTestId('compare-drawer');
    fireEvent.click(drawer);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should have translate-x-full class when closed', () => {
    render(
      <CompareDrawer
        isOpen={false}
        onClose={onClose}
        currentProjectId="proj-1"
      />,
    );

    const drawer = screen.getByTestId('compare-drawer');
    expect(drawer.className).toContain('translate-x-full');
  });

  it('should have translate-x-0 class when open', () => {
    render(
      <CompareDrawer
        isOpen={true}
        onClose={onClose}
        currentProjectId="proj-1"
      />,
    );

    const drawer = screen.getByTestId('compare-drawer');
    expect(drawer.className).toContain('translate-x-0');
  });

  it('should block body scroll when open', () => {
    render(
      <CompareDrawer
        isOpen={true}
        onClose={onClose}
        currentProjectId="proj-1"
      />,
    );

    expect(document.body.style.overflow).toBe('hidden');
  });

  it('should restore body scroll when closed', () => {
    const { rerender } = render(
      <CompareDrawer
        isOpen={true}
        onClose={onClose}
        currentProjectId="proj-1"
      />,
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <CompareDrawer
        isOpen={false}
        onClose={onClose}
        currentProjectId="proj-1"
      />,
    );

    expect(document.body.style.overflow).toBe('');
  });

  it('should render project options in selectors', () => {
    render(
      <CompareDrawer
        isOpen={true}
        onClose={onClose}
        currentProjectId="proj-1"
      />,
    );

    const selectA = screen.getByTestId('compare-select-a');
    const selectB = screen.getByTestId('compare-select-b');

    // 두 select 모두 프로젝트 옵션을 갖고 있는지 확인
    expect(selectA).toContainHTML('Project Alpha');
    expect(selectA).toContainHTML('Project Beta');
    expect(selectB).toContainHTML('Project Alpha');
    expect(selectB).toContainHTML('Project Beta');
  });

  it('should have aria-labelledby pointing to title', () => {
    render(
      <CompareDrawer
        isOpen={true}
        onClose={onClose}
        currentProjectId="proj-1"
      />,
    );

    const drawer = screen.getByTestId('compare-drawer');
    const titleId = drawer.getAttribute('aria-labelledby');
    expect(titleId).toBe('compare-drawer-title');

    const title = document.getElementById(titleId!);
    expect(title).toBeInTheDocument();
    expect(title?.textContent).toBe('프로젝트 비교');
  });

  it('should not trigger ESC close when drawer is not open', () => {
    render(
      <CompareDrawer
        isOpen={false}
        onClose={onClose}
        currentProjectId="proj-1"
      />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
