/**
 * @module web/stores/flowStore
 * @description Zustand 상태 관리 - 플로우차트 필터, 확장/축소, 선택 상태
 */

import { create } from 'zustand';
import type { Grade, TaskType } from '../types';

/** 필터 상태 */
export interface FlowFilterState {
  /** FE/BE 필터: 'all' | 'FE' | 'BE' */
  taskTypeFilter: 'all' | TaskType;
  /** 등급 필터 (선택된 등급 목록) */
  gradeFilter: Grade[];
  /** 검색어 */
  searchQuery: string;
  /** 작업 유형 필터: 'all' | 'new' | 'modify' */
  workTypeFilter: 'all' | 'new' | 'modify';
  /** 요구사항 필터: 선택된 요구사항 ID (null이면 전체 표시) */
  requirementFilter: string | null;
}

/** 프로젝트 모드: 'individual' (개별) | 'all' (전체) */
export type ProjectMode = 'individual' | 'all';

/** 플로우 스토어 상태 */
interface FlowState {
  /** 필터 상태 */
  filter: FlowFilterState;
  /** 확장된 노드 ID 집합 */
  expandedNodeIds: Set<string>;
  /** 선택된 노드 ID */
  selectedNodeId: string | null;
  /** 프로젝트 모드: 개별 vs 전체 */
  projectMode: ProjectMode;
  /** 현재 기획서에서 추출한 API 경로들 */
  crossProjectSpecApis: string[];
  /** 기획서 필터 ON/OFF */
  crossProjectFilterEnabled: boolean;

  /** 필터 설정 */
  setFilter: (update: Partial<FlowFilterState>) => void;
  /** 노드 확장/축소 토글 */
  toggleExpand: (nodeId: string) => void;
  /** 노드 선택 */
  selectNode: (nodeId: string | null) => void;
  /** 모두 확장 */
  expandAll: (nodeIds: string[]) => void;
  /** 모두 축소 */
  collapseAll: () => void;
  /** 등급 필터 토글 */
  toggleGradeFilter: (grade: Grade) => void;
  /** 요구사항 필터 설정 */
  setRequirementFilter: (reqId: string | null) => void;
  /** 프로젝트 모드 설정 */
  setProjectMode: (mode: ProjectMode) => void;
  /** 기획서 API 경로 설정 */
  setCrossProjectSpecApis: (apis: string[]) => void;
  /** 기획서 필터 토글 */
  toggleCrossProjectFilter: () => void;
  /** 데이터 초기화 (프로젝트 전환 시) */
  reset: () => void;
}

/** 기본 필터 상태 */
const defaultFilter: FlowFilterState = {
  taskTypeFilter: 'all',
  gradeFilter: ['Low', 'Medium', 'High', 'Critical'],
  searchQuery: '',
  workTypeFilter: 'all',
  requirementFilter: null,
};

/** 플로우 스토어 */
export const useFlowStore = create<FlowState>((set) => ({
  filter: defaultFilter,
  expandedNodeIds: new Set<string>(),
  selectedNodeId: null,
  projectMode: 'individual',
  crossProjectSpecApis: [],
  crossProjectFilterEnabled: true,

  setFilter: (update) =>
    set((state) => ({
      filter: { ...state.filter, ...update },
    })),

  toggleExpand: (nodeId) =>
    set((state) => {
      const next = new Set(state.expandedNodeIds);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return { expandedNodeIds: next };
    }),

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  expandAll: (nodeIds) =>
    set({ expandedNodeIds: new Set(nodeIds) }),

  collapseAll: () => set({ expandedNodeIds: new Set<string>() }),

  toggleGradeFilter: (grade) =>
    set((state) => {
      const current = state.filter.gradeFilter;
      const next = current.includes(grade)
        ? current.filter((g) => g !== grade)
        : [...current, grade];
      return { filter: { ...state.filter, gradeFilter: next } };
    }),

  setRequirementFilter: (reqId) =>
    set((state) => ({
      filter: { ...state.filter, requirementFilter: reqId },
    })),

  setProjectMode: (mode) => set({ projectMode: mode, selectedNodeId: null }),

  setCrossProjectSpecApis: (apis) => set({ crossProjectSpecApis: apis }),

  toggleCrossProjectFilter: () =>
    set((state) => ({ crossProjectFilterEnabled: !state.crossProjectFilterEnabled })),

  reset: () =>
    set({
      filter: defaultFilter,
      expandedNodeIds: new Set<string>(),
      selectedNodeId: null,
      projectMode: 'individual',
      crossProjectSpecApis: [],
      crossProjectFilterEnabled: true,
    }),
}));
