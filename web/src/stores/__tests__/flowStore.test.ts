/**
 * @module web/stores/__tests__/flowStore.test
 * @description flowStore Zustand 스토어 테스트 - 요구사항 필터 포함
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useFlowStore } from '../flowStore';
import type { FlowFilterState } from '../flowStore';

const defaultFilter: FlowFilterState = {
  taskTypeFilter: 'all',
  gradeFilter: ['Low', 'Medium', 'High', 'Critical'],
  searchQuery: '',
  workTypeFilter: 'all',
  requirementFilter: null,
};

describe('flowStore', () => {
  beforeEach(() => {
    // 스토어 초기화
    useFlowStore.setState({
      filter: { ...defaultFilter },
      expandedNodeIds: new Set(),
      selectedNodeId: null,
    });
  });

  it('should have correct initial state', () => {
    const state = useFlowStore.getState();
    expect(state.filter.taskTypeFilter).toBe('all');
    expect(state.filter.gradeFilter).toEqual(['Low', 'Medium', 'High', 'Critical']);
    expect(state.filter.searchQuery).toBe('');
    expect(state.filter.workTypeFilter).toBe('all');
    expect(state.filter.requirementFilter).toBeNull();
    expect(state.expandedNodeIds.size).toBe(0);
    expect(state.selectedNodeId).toBeNull();
  });

  describe('setFilter', () => {
    it('should update partial filter state', () => {
      useFlowStore.getState().setFilter({ taskTypeFilter: 'FE' });
      expect(useFlowStore.getState().filter.taskTypeFilter).toBe('FE');
      // 다른 필터는 유지
      expect(useFlowStore.getState().filter.searchQuery).toBe('');
    });

    it('should update search query', () => {
      useFlowStore.getState().setFilter({ searchQuery: '장바구니' });
      expect(useFlowStore.getState().filter.searchQuery).toBe('장바구니');
    });

    it('should update requirementFilter via setFilter', () => {
      useFlowStore.getState().setFilter({ requirementFilter: 'REQ-001' });
      expect(useFlowStore.getState().filter.requirementFilter).toBe('REQ-001');
    });
  });

  describe('setRequirementFilter', () => {
    it('should set requirement filter to a specific requirement ID', () => {
      useFlowStore.getState().setRequirementFilter('REQ-001');
      expect(useFlowStore.getState().filter.requirementFilter).toBe('REQ-001');
    });

    it('should clear requirement filter when set to null', () => {
      useFlowStore.getState().setRequirementFilter('REQ-001');
      expect(useFlowStore.getState().filter.requirementFilter).toBe('REQ-001');

      useFlowStore.getState().setRequirementFilter(null);
      expect(useFlowStore.getState().filter.requirementFilter).toBeNull();
    });

    it('should not affect other filter values', () => {
      useFlowStore.getState().setFilter({ taskTypeFilter: 'BE', searchQuery: 'test' });
      useFlowStore.getState().setRequirementFilter('REQ-002');

      const state = useFlowStore.getState();
      expect(state.filter.requirementFilter).toBe('REQ-002');
      expect(state.filter.taskTypeFilter).toBe('BE');
      expect(state.filter.searchQuery).toBe('test');
    });

    it('should allow switching between requirements', () => {
      useFlowStore.getState().setRequirementFilter('REQ-001');
      expect(useFlowStore.getState().filter.requirementFilter).toBe('REQ-001');

      useFlowStore.getState().setRequirementFilter('REQ-002');
      expect(useFlowStore.getState().filter.requirementFilter).toBe('REQ-002');
    });
  });

  describe('toggleGradeFilter', () => {
    it('should remove grade when already selected', () => {
      useFlowStore.getState().toggleGradeFilter('Low');
      expect(useFlowStore.getState().filter.gradeFilter).toEqual([
        'Medium',
        'High',
        'Critical',
      ]);
    });

    it('should add grade when not selected', () => {
      useFlowStore.getState().toggleGradeFilter('Low'); // remove
      useFlowStore.getState().toggleGradeFilter('Low'); // add back
      expect(useFlowStore.getState().filter.gradeFilter).toContain('Low');
    });
  });

  describe('toggleExpand', () => {
    it('should expand a node', () => {
      useFlowStore.getState().toggleExpand('screen-cart');
      expect(useFlowStore.getState().expandedNodeIds.has('screen-cart')).toBe(true);
    });

    it('should collapse an expanded node', () => {
      useFlowStore.getState().toggleExpand('screen-cart');
      useFlowStore.getState().toggleExpand('screen-cart');
      expect(useFlowStore.getState().expandedNodeIds.has('screen-cart')).toBe(false);
    });
  });

  describe('selectNode', () => {
    it('should select a node', () => {
      useFlowStore.getState().selectNode('feature-task-1');
      expect(useFlowStore.getState().selectedNodeId).toBe('feature-task-1');
    });

    it('should deselect when null', () => {
      useFlowStore.getState().selectNode('feature-task-1');
      useFlowStore.getState().selectNode(null);
      expect(useFlowStore.getState().selectedNodeId).toBeNull();
    });
  });

  describe('expandAll / collapseAll', () => {
    it('should expand all given node IDs', () => {
      useFlowStore.getState().expandAll(['a', 'b', 'c']);
      const ids = useFlowStore.getState().expandedNodeIds;
      expect(ids.has('a')).toBe(true);
      expect(ids.has('b')).toBe(true);
      expect(ids.has('c')).toBe(true);
    });

    it('should collapse all nodes', () => {
      useFlowStore.getState().expandAll(['a', 'b', 'c']);
      useFlowStore.getState().collapseAll();
      expect(useFlowStore.getState().expandedNodeIds.size).toBe(0);
    });
  });

  describe('filter reset (full setFilter override)', () => {
    it('should reset all filters including requirementFilter', () => {
      // Set various filters
      useFlowStore.getState().setFilter({
        taskTypeFilter: 'FE',
        searchQuery: 'test',
        requirementFilter: 'REQ-001',
      });

      // Reset to defaults
      useFlowStore.getState().setFilter({ ...defaultFilter });

      const state = useFlowStore.getState();
      expect(state.filter.taskTypeFilter).toBe('all');
      expect(state.filter.searchQuery).toBe('');
      expect(state.filter.requirementFilter).toBeNull();
    });
  });
});
