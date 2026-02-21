/**
 * @module web/__tests__/projects/projectStore.test
 * @description projectStore (Zustand) 단위 테스트 - REQ-012
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProjectStore } from '../../stores/projectStore';

// fetch mock
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe('projectStore', () => {
  beforeEach(() => {
    // 스토어 리셋
    useProjectStore.getState().reset();
    fetchMock.mockReset();
  });

  describe('fetchProjects', () => {
    it('should fetch and set projects', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({
          projects: [
            { id: 'alpha', name: 'Alpha', status: 'active', techStack: ['react'] },
            { id: 'beta', name: 'Beta', status: 'active', techStack: ['vue'] },
          ],
          activeProject: 'alpha',
          total: 2,
        }),
      });

      await useProjectStore.getState().fetchProjects();

      const state = useProjectStore.getState();
      expect(state.projects).toHaveLength(2);
      expect(state.activeProjectId).toBe('alpha');
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle empty projects', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ projects: [], activeProject: null, total: 0 }),
      });

      await useProjectStore.getState().fetchProjects();

      const state = useProjectStore.getState();
      expect(state.projects).toHaveLength(0);
      expect(state.activeProjectId).toBeNull();
    });

    it('should handle fetch error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      await useProjectStore.getState().fetchProjects();

      const state = useProjectStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('switchProject', () => {
    it('should switch project successfully', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ activeProject: 'beta', message: 'Switched to Beta' }),
      });

      await useProjectStore.getState().switchProject('beta');

      const state = useProjectStore.getState();
      expect(state.activeProjectId).toBe('beta');
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle switch error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Project not found' }),
      });

      await useProjectStore.getState().switchProject('nonexistent');

      const state = useProjectStore.getState();
      expect(state.error).toBe('Project not found');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset all state to defaults', () => {
      // 먼저 상태를 변경
      useProjectStore.setState({
        projects: [{ id: 'x', name: 'X' } as any],
        activeProjectId: 'x',
        isLoading: true,
        error: 'some error',
      });

      useProjectStore.getState().reset();

      const state = useProjectStore.getState();
      expect(state.projects).toHaveLength(0);
      expect(state.activeProjectId).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('setActiveProjectId', () => {
    it('should update activeProjectId', () => {
      useProjectStore.getState().setActiveProjectId('gamma');
      expect(useProjectStore.getState().activeProjectId).toBe('gamma');
    });
  });
});
