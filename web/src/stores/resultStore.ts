/**
 * @module web/stores/resultStore
 * @description Zustand 상태 관리 - 분석 결과 데이터 스토어
 * TASK-069: statusFilter + updateResultStatus + updatingIds 추가
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AnalysisResult, AnalysisStatus, ResultSummary } from '../types';

/** 정렬 옵션 */
export type SortOption = 'latest' | 'oldest' | 'grade-high' | 'grade-low';

/** 상태 필터 옵션 */
export type StatusFilterOption = 'active-only' | 'all' | 'active-and-on-hold';

/** 결과 스토어 상태 */
interface ResultState {
  /** 현재 표시 중인 분석 결과 */
  currentResult: AnalysisResult | null;
  /** 결과 목록 */
  resultList: ResultSummary[];
  /** 로딩 상태 */
  isLoading: boolean;
  /** 에러 메시지 */
  error: string | null;

  /** LNB 상태 */
  lnbCollapsed: boolean;
  /** 검색어 */
  searchQuery: string;
  /** 정렬 옵션 */
  sortBy: SortOption;

  /** 상태 필터 (TASK-069) */
  statusFilter: StatusFilterOption;
  /** 상태 변경 진행 중인 항목 ID 집합 (TASK-069) */
  updatingIds: Set<string>;

  /** 현재 결과 설정 */
  setCurrentResult: (result: AnalysisResult | null) => void;
  /** 결과 목록 설정 */
  setResultList: (list: ResultSummary[]) => void;
  /** 로딩 상태 설정 */
  setLoading: (loading: boolean) => void;
  /** 에러 설정 */
  setError: (error: string | null) => void;

  /** LNB 토글 */
  toggleLnb: () => void;
  /** LNB 상태 직접 설정 (라우트 기반 자동 제어용) */
  setLnbCollapsed: (collapsed: boolean) => void;
  /** 검색어 설정 */
  setSearchQuery: (query: string) => void;
  /** 정렬 옵션 설정 */
  setSortBy: (sort: SortOption) => void;

  /** 상태 필터 설정 (TASK-069) */
  setStatusFilter: (filter: StatusFilterOption) => void;

  /** 전체 결과 목록 가져오기 */
  fetchAllResults: () => Promise<void>;
  /** 특정 결과로 전환 */
  switchResult: (resultId: string) => Promise<void>;
  /** 분석 결과 상태 변경 (TASK-069) */
  updateResultStatus: (resultId: string, newStatus: AnalysisStatus) => Promise<void>;
  /** 데이터 초기화 (프로젝트 전환 시) */
  reset: () => void;
}

/** 결과 스토어 */
export const useResultStore = create<ResultState>()(
  persist(
    (set, get) => ({
      currentResult: null,
      resultList: [],
      isLoading: false,
      error: null,

      lnbCollapsed: false,
      searchQuery: '',
      sortBy: 'latest',

      statusFilter: 'all',
      updatingIds: new Set<string>(),

      setCurrentResult: (result) => set({ currentResult: result }),
      setResultList: (list) => set({ resultList: list }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      toggleLnb: () => set((s) => ({ lnbCollapsed: !s.lnbCollapsed })),
      setLnbCollapsed: (collapsed) => set({ lnbCollapsed: collapsed }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setSortBy: (sort) => set({ sortBy: sort }),

      setStatusFilter: (filter) => set({ statusFilter: filter }),

      fetchAllResults: async () => {
        set({ isLoading: true, error: null });
        try {
          const statusFilter = get().statusFilter;
          // R3-STATE-01: statusFilter를 쿼리 파라미터로 전달
          let query = '';
          if (statusFilter === 'active-only') {
            query = '?status=active';
          } else if (statusFilter === 'active-and-on-hold') {
            query = '?status=active,on-hold';
          }
          const response = await fetch(`/api/results${query}`);
          const data = await response.json();
          set({ resultList: data.results || [], isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch results',
            isLoading: false,
          });
        }
      },

      switchResult: async (resultId: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`/api/results/${resultId}`);
          const data = await response.json();
          if (data.result) {
            set({ currentResult: data.result, isLoading: false });
          } else {
            throw new Error(data.error || 'Result not found');
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to switch result',
            isLoading: false,
          });
        }
      },

      // R3-E2E-06: 항목별 로딩 상태 updatingIds 패턴
      updateResultStatus: async (resultId: string, newStatus: AnalysisStatus) => {
        set((state) => ({
          updatingIds: new Set([...state.updatingIds, resultId]),
        }));
        try {
          const response = await fetch(`/api/results/${resultId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || '상태 변경 실패');

          set((state) => ({
            resultList: state.resultList.map((r) =>
              r.id === resultId ? { ...r, status: newStatus, statusChangedAt: new Date().toISOString() } : r,
            ),
            updatingIds: new Set([...state.updatingIds].filter((id) => id !== resultId)),
          }));
        } catch (error) {
          set((state) => ({
            updatingIds: new Set([...state.updatingIds].filter((id) => id !== resultId)),
          }));
          throw error;
        }
      },

      reset: () => {
        set({
          currentResult: null,
          resultList: [],
          isLoading: false,
          error: null,
          statusFilter: 'all',
          updatingIds: new Set<string>(),
        });
      },
    }),
    {
      name: 'result-store',
      partialize: (state) => ({
        sortBy: state.sortBy,
        // R3-STATE-04: statusFilter는 persist하지 않음 (새로고침 시 'all'로 리셋)
      }),
    },
  ),
);
