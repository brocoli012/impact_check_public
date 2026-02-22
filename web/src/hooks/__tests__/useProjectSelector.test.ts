/**
 * @module web/hooks/__tests__/useProjectSelector.test
 * @description useProjectSelector 훅 단위 테스트 (REQ-014, TASK-119)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProjectSelector } from '../useProjectSelector';
import { useProjectStore } from '../../stores/projectStore';
import { useResultStore } from '../../stores/resultStore';
import { usePolicyStore } from '../../stores/policyStore';
import { useFlowStore } from '../../stores/flowStore';
import type { ProjectInfo } from '../../types';

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
    techStack: ['React', 'Node.js'],
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

describe('useProjectSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset stores
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
      selectedPolicy: null,
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

    // Mock successful API responses
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

  it('should return projects from projectStore', () => {
    const { result } = renderHook(() => useProjectSelector());

    expect(result.current.projects).toHaveLength(2);
    expect(result.current.projects[0].id).toBe('proj-1');
    expect(result.current.projects[1].id).toBe('proj-2');
  });

  it('should return activeProjectId from projectStore', () => {
    const { result } = renderHook(() => useProjectSelector());

    expect(result.current.activeProjectId).toBe('proj-1');
  });

  it('should return isLoading as false initially', () => {
    const { result } = renderHook(() => useProjectSelector());

    expect(result.current.isLoading).toBe(false);
  });

  it('should call reset functions when switchProject is called', async () => {
    const resetResultSpy = vi.fn();
    const resetPolicySpy = vi.fn();
    const resetFlowSpy = vi.fn();

    // Spy on reset methods
    useResultStore.setState({ reset: resetResultSpy });
    usePolicyStore.setState({ reset: resetPolicySpy });
    useFlowStore.setState({ reset: resetFlowSpy });

    const { result } = renderHook(() => useProjectSelector());

    await act(async () => {
      await result.current.switchProject('proj-2');
    });

    expect(resetResultSpy).toHaveBeenCalledTimes(1);
    expect(resetPolicySpy).toHaveBeenCalledTimes(1);
    expect(resetFlowSpy).toHaveBeenCalledTimes(1);
  });

  it('should call projectStore.switchProject with correct projectId', async () => {
    const { result } = renderHook(() => useProjectSelector());

    await act(async () => {
      await result.current.switchProject('proj-2');
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/projects/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: 'proj-2' }),
    });
  });

  it('should call fetchAllResults after switching project', async () => {
    const { result } = renderHook(() => useProjectSelector());

    await act(async () => {
      await result.current.switchProject('proj-2');
    });

    // fetchAllResults calls /api/results
    expect(global.fetch).toHaveBeenCalledWith('/api/results');
  });

  it('should set isLoading to false after switchProject completes', async () => {
    const { result } = renderHook(() => useProjectSelector());

    await act(async () => {
      await result.current.switchProject('proj-2');
    });

    // After completion, isLoading should be false
    expect(result.current.isLoading).toBe(false);
  });

  it('should handle empty projects list', () => {
    useProjectStore.setState({ projects: [], activeProjectId: null });

    const { result } = renderHook(() => useProjectSelector());

    expect(result.current.projects).toHaveLength(0);
    expect(result.current.activeProjectId).toBeNull();
  });
});
