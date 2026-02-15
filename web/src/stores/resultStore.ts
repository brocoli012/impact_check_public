/**
 * @module web/stores/resultStore
 * @description Zustand 상태 관리 - 분석 결과 데이터 스토어
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AnalysisResult, ResultSummary } from '../types';

/** 정렬 옵션 */
export type SortOption = 'latest' | 'oldest' | 'grade-high' | 'grade-low';

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
  /** 검색어 설정 */
  setSearchQuery: (query: string) => void;
  /** 정렬 옵션 설정 */
  setSortBy: (sort: SortOption) => void;

  /** 전체 결과 목록 가져오기 */
  fetchAllResults: () => Promise<void>;
  /** 특정 결과로 전환 */
  switchResult: (resultId: string) => Promise<void>;
}

/** 결과 스토어 */
export const useResultStore = create<ResultState>()(
  persist(
    (set) => ({
      currentResult: null,
      resultList: [],
      isLoading: false,
      error: null,

      lnbCollapsed: false,
      searchQuery: '',
      sortBy: 'latest',

      setCurrentResult: (result) => set({ currentResult: result }),
      setResultList: (list) => set({ resultList: list }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      toggleLnb: () => set((s) => ({ lnbCollapsed: !s.lnbCollapsed })),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setSortBy: (sort) => set({ sortBy: sort }),

      fetchAllResults: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch('/api/results');
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
    }),
    {
      name: 'result-store',
      partialize: (state) => ({
        lnbCollapsed: state.lnbCollapsed,
        sortBy: state.sortBy,
      }),
    },
  ),
);
