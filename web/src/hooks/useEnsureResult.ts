/**
 * @module web/hooks/useEnsureResult
 * @description currentResult가 없을 때 mock 데이터를 로드하는 공통 훅
 * 여러 페이지에서 중복되던 mock 데이터 로딩 패턴을 중앙화합니다.
 */

import { useEffect } from 'react';
import { useResultStore } from '../stores/resultStore';
import { getMockResult } from '../utils/mockData';

/**
 * currentResult가 없으면 mock 데이터를 자동으로 로드합니다.
 * FlowChart, Checklist, Owners, Tickets 페이지에서 공통으로 사용됩니다.
 */
export function useEnsureResult(): void {
  const currentResult = useResultStore((s) => s.currentResult);
  const setCurrentResult = useResultStore((s) => s.setCurrentResult);

  useEffect(() => {
    if (!currentResult) {
      setCurrentResult(getMockResult());
    }
  }, [currentResult, setCurrentResult]);
}
