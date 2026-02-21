/**
 * @module web/__tests__/projects/storeReset.test
 * @description 스토어 reset() 메서드 테스트 - REQ-012 (TASK-076)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useResultStore } from '../../stores/resultStore';
import { usePolicyStore } from '../../stores/policyStore';
import { useFlowStore } from '../../stores/flowStore';

// fetch mock (resultStore.fetchAllResults 등에서 사용)
global.fetch = vi.fn();

describe('Store reset() methods (TASK-076)', () => {
  describe('resultStore.reset()', () => {
    beforeEach(() => {
      // 상태를 변경
      useResultStore.setState({
        currentResult: { analysisId: 'test' } as any,
        resultList: [{ id: 'r1' } as any],
        isLoading: true,
        error: 'some error',
      });
    });

    it('should reset data fields to defaults', () => {
      useResultStore.getState().reset();

      const state = useResultStore.getState();
      expect(state.currentResult).toBeNull();
      expect(state.resultList).toHaveLength(0);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should NOT reset UI preferences (lnbCollapsed, sortBy)', () => {
      useResultStore.setState({ lnbCollapsed: true, sortBy: 'grade-high' });

      useResultStore.getState().reset();

      const state = useResultStore.getState();
      // reset()은 데이터만 초기화, UI 설정은 유지
      expect(state.lnbCollapsed).toBe(true);
      expect(state.sortBy).toBe('grade-high');
    });
  });

  describe('policyStore.reset()', () => {
    beforeEach(() => {
      usePolicyStore.setState({
        policies: [{ id: 'p1' } as any],
        selectedPolicy: { id: 'p1' } as any,
        categories: ['cat1'],
        searchQuery: 'test',
        selectedCategory: 'cat1',
        selectedSource: 'annotation',
        loading: true,
        loadingDetail: true,
        error: 'err',
        totalCount: 10,
        hasMore: true,
        currentOffset: 50,
      });
    });

    it('should reset all fields to defaults', () => {
      usePolicyStore.getState().reset();

      const state = usePolicyStore.getState();
      expect(state.policies).toHaveLength(0);
      expect(state.selectedPolicy).toBeNull();
      expect(state.categories).toHaveLength(0);
      expect(state.searchQuery).toBe('');
      expect(state.selectedCategory).toBeNull();
      expect(state.selectedSource).toBeNull();
      expect(state.selectedRequirement).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.loadingMore).toBe(false);
      expect(state.loadingDetail).toBe(false);
      expect(state.error).toBeNull();
      expect(state.totalCount).toBe(0);
      expect(state.hasMore).toBe(false);
      expect(state.currentOffset).toBe(0);
    });
  });

  describe('flowStore.reset()', () => {
    beforeEach(() => {
      useFlowStore.setState({
        filter: {
          taskTypeFilter: 'FE',
          gradeFilter: ['Critical'],
          searchQuery: 'test',
          workTypeFilter: 'new',
          requirementFilter: 'req-1',
        },
        expandedNodeIds: new Set(['node-1', 'node-2']),
        selectedNodeId: 'node-1',
      });
    });

    it('should reset filter, expandedNodeIds, and selectedNodeId', () => {
      useFlowStore.getState().reset();

      const state = useFlowStore.getState();
      expect(state.filter.taskTypeFilter).toBe('all');
      expect(state.filter.gradeFilter).toEqual(['Low', 'Medium', 'High', 'Critical']);
      expect(state.filter.searchQuery).toBe('');
      expect(state.filter.workTypeFilter).toBe('all');
      expect(state.filter.requirementFilter).toBeNull();
      expect(state.expandedNodeIds.size).toBe(0);
      expect(state.selectedNodeId).toBeNull();
    });
  });
});
