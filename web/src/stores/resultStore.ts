/**
 * @module web/stores/resultStore
 * @description Zustand 상태 관리 - 분석 결과 데이터 스토어
 */

import { create } from 'zustand';
import type { AnalysisResult, ResultSummary } from '../types';

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
  /** 현재 결과 설정 */
  setCurrentResult: (result: AnalysisResult | null) => void;
  /** 결과 목록 설정 */
  setResultList: (list: ResultSummary[]) => void;
  /** 로딩 상태 설정 */
  setLoading: (loading: boolean) => void;
  /** 에러 설정 */
  setError: (error: string | null) => void;
}

/** 결과 스토어 */
export const useResultStore = create<ResultState>((set) => ({
  currentResult: null,
  resultList: [],
  isLoading: false,
  error: null,
  setCurrentResult: (result) => set({ currentResult: result }),
  setResultList: (list) => set({ resultList: list }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
