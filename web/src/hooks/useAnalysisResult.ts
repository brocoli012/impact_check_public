/**
 * @module web/hooks/useAnalysisResult
 * @description 분석 결과를 API에서 가져오는 커스텀 훅
 */

import { useEffect } from 'react';
import { useResultStore } from '../stores/resultStore';
import { getMockResult } from '../utils/mockData';
import type { AnalysisResult, ResultSummary, ApiResponse } from '../types';
import { sanitizeAnalysisResult } from '../utils/dataValidator';

/**
 * 최신 분석 결과를 API에서 가져오기
 */
export function useLatestResult(): void {
  const { setCurrentResult, setLoading, setError } = useResultStore();

  useEffect(() => {
    let cancelled = false;

    async function fetchLatest(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/results/latest');
        const data = (await response.json()) as ApiResponse<AnalysisResult>;

        if (cancelled) return;

        if (data.result) {
          setCurrentResult(sanitizeAnalysisResult(data.result));
        } else {
          // API에서 결과가 없으면 mock 데이터 사용
          setCurrentResult(getMockResult());
        }
      } catch {
        if (cancelled) return;
        // fetch 실패 시 mock 데이터 사용
        setCurrentResult(getMockResult());
        setError('서버 연결 실패. 데모 데이터를 표시합니다.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchLatest();

    return () => {
      cancelled = true;
    };
  }, [setCurrentResult, setLoading, setError]);
}

/**
 * 결과 목록을 API에서 가져오기
 */
export function useResultList(): void {
  const { setResultList, setLoading, setError } = useResultStore();

  useEffect(() => {
    let cancelled = false;

    async function fetchList(): Promise<void> {
      setLoading(true);

      try {
        const response = await fetch('/api/results');
        const data = (await response.json()) as ApiResponse<ResultSummary>;

        if (cancelled) return;

        if (data.results) {
          setResultList(data.results);
        }
      } catch {
        if (cancelled) return;
        setError('결과 목록을 가져올 수 없습니다.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchList();

    return () => {
      cancelled = true;
    };
  }, [setResultList, setLoading, setError]);
}
