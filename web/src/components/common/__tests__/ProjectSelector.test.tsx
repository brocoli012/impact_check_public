/**
 * @module web/components/common/__tests__/ProjectSelector.test
 * @description ProjectSelector 공통 컴포넌트 테스트 (REQ-014, TASK-119)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectSelector from '../ProjectSelector';
import { useProjectStore } from '../../../stores/projectStore';
import { useResultStore } from '../../../stores/resultStore';
import { usePolicyStore } from '../../../stores/policyStore';
import { useFlowStore } from '../../../stores/flowStore';
import type { ProjectInfo } from '../../../types';

// fetch mock
global.fetch = vi.fn();

const mockProjects: ProjectInfo[] = [
  {
    id: 'proj-1',
    name: 'Project Alpha',
    path: '/path/alpha',
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    lastUsedAt: '2026-02-20T00:00:00Z',
    techStack: ['React'],
    resultCount: 5,
    latestGrade: 'High',
    latestScore: 85,
    latestAnalyzedAt: '2026-02-20T00:00:00Z',
    taskCount: 10,
    policyWarningCount: 2,
  },
  {
    id: 'proj-2',
    name: 'Project Beta',
    path: '/path/beta',
    status: 'active',
    createdAt: '2026-01-15T00:00:00Z',
    lastUsedAt: '2026-02-18T00:00:00Z',
    techStack: ['Vue'],
    resultCount: 3,
    latestGrade: 'Medium',
    latestScore: 60,
    latestAnalyzedAt: '2026-02-18T00:00:00Z',
    taskCount: 7,
    policyWarningCount: 1,
  },
];

describe('ProjectSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useProjectStore.setState({
      projects: mockProjects,
      activeProjectId: 'proj-1',
      isLoading: false,
      error: null,
    });

    useResultStore.setState({
      currentResult: null,
      resultList: [],
      isLoading: false,
      error: null,
    });

    usePolicyStore.setState({
      policies: [],
      loading: false,
      error: null,
    });

    useFlowStore.setState({
      filter: {
        taskTypeFilter: 'all',
        gradeFilter: ['Low', 'Medium', 'High', 'Critical'],
        searchQuery: '',
        workTypeFilter: 'all',
        requirementFilter: null,
      },
      expandedNodeIds: new Set(),
      selectedNodeId: null,
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/api/projects/switch') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ activeProject: 'proj-2' }),
        });
      }
      if (url === '/api/results') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ results: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  describe('Variant A (default, no includeAll)', () => {
    it('should render project list in dropdown', () => {
      render(<ProjectSelector />);

      const select = screen.getByLabelText('프로젝트 선택');
      expect(select).toBeInTheDocument();

      // 프로젝트 선택 placeholder + 2 projects
      const options = select.querySelectorAll('option');
      expect(options).toHaveLength(3); // placeholder + 2 projects
      expect(options[1].textContent).toBe('Project Alpha');
      expect(options[2].textContent).toBe('Project Beta');
    });

    it('should NOT include "전체" option', () => {
      render(<ProjectSelector />);

      const select = screen.getByLabelText('프로젝트 선택');
      const options = Array.from(select.querySelectorAll('option'));
      const allOption = options.find((o) => o.textContent === '전체');
      expect(allOption).toBeUndefined();
    });

    it('should render label text', () => {
      render(<ProjectSelector />);

      expect(screen.getByText('프로젝트')).toBeInTheDocument();
    });

    it('should show active project as selected', () => {
      render(<ProjectSelector />);

      const select = screen.getByLabelText('프로젝트 선택') as HTMLSelectElement;
      expect(select.value).toBe('proj-1');
    });

    it('should call switchProject when project is changed', async () => {
      const user = userEvent.setup();
      render(<ProjectSelector />);

      const select = screen.getByLabelText('프로젝트 선택');
      await user.selectOptions(select, 'proj-2');

      expect(global.fetch).toHaveBeenCalledWith('/api/projects/switch', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ projectId: 'proj-2' }),
      }));
    });
  });

  describe('Variant B (includeAll)', () => {
    it('should include "전체" option when includeAll is true', () => {
      render(<ProjectSelector includeAll />);

      const select = screen.getByLabelText('프로젝트 선택');
      const options = Array.from(select.querySelectorAll('option'));
      const allOption = options.find((o) => o.textContent === '전체');
      expect(allOption).toBeDefined();
    });

    it('should call onAllSelected when "전체" is selected', async () => {
      const onAllSelected = vi.fn(() => true);
      const user = userEvent.setup();

      render(<ProjectSelector includeAll onAllSelected={onAllSelected} />);

      const select = screen.getByLabelText('프로젝트 선택');
      await user.selectOptions(select, '__all__');

      expect(onAllSelected).toHaveBeenCalledTimes(1);
    });

    it('should not proceed if onAllSelected returns false', async () => {
      const onAllSelected = vi.fn(() => false);
      const user = userEvent.setup();

      render(<ProjectSelector includeAll onAllSelected={onAllSelected} />);

      const select = screen.getByLabelText('프로젝트 선택');
      await user.selectOptions(select, '__all__');

      expect(onAllSelected).toHaveBeenCalledTimes(1);
      // Should NOT call switchProject (no fetch to /api/projects/switch)
      expect(global.fetch).not.toHaveBeenCalledWith('/api/projects/switch', expect.anything());
    });
  });

  describe('empty projects', () => {
    it('should render correctly with empty project list', () => {
      useProjectStore.setState({ projects: [], activeProjectId: null });

      render(<ProjectSelector />);

      const select = screen.getByLabelText('프로젝트 선택') as HTMLSelectElement;
      // Only placeholder option
      const options = select.querySelectorAll('option');
      expect(options).toHaveLength(1);
      expect(options[0].textContent).toBe('프로젝트 선택');
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      const { container } = render(<ProjectSelector className="mt-4" />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.classList.contains('mt-4')).toBe(true);
    });
  });

  describe('accessibility', () => {
    it('should have aria-label on select', () => {
      render(<ProjectSelector />);

      const select = screen.getByLabelText('프로젝트 선택');
      expect(select).toHaveAttribute('aria-label', '프로젝트 선택');
    });

    it('should have data-testid', () => {
      render(<ProjectSelector />);

      expect(screen.getByTestId('project-selector-common')).toBeInTheDocument();
    });
  });
});
