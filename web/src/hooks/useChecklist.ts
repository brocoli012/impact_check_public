/**
 * @module web/hooks/useChecklist
 * @description 체크리스트 상태 관리 훅 - API 연동 및 로컬 optimistic update
 */

import { useState, useEffect, useCallback } from 'react';
import { useResultStore } from '../stores/resultStore';
import type { Check, ApiResponse, ChecklistData } from '../types';

/** 체크리스트 상태를 관리하는 커스텀 훅 반환 타입 */
export interface UseChecklistReturn {
  /** 전체 체크 항목 */
  checks: Check[];
  /** 체크된 항목 ID 집합 */
  checkedIds: Set<string>;
  /** 항목 체크/언체크 토글 */
  toggleCheck: (checkId: string) => void;
  /** 로딩 상태 */
  isLoading: boolean;
  /** 완료된 항목 수 */
  completedCount: number;
  /** 전체 항목 수 */
  totalCount: number;
}

/**
 * 체크리스트 상태를 관리하는 커스텀 훅
 */
export function useChecklist(): UseChecklistReturn {
  const currentResult = useResultStore((s) => s.currentResult);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const checks = currentResult?.planningChecks ?? [];
  const resultId = currentResult?.analysisId ?? '';

  // 서버에서 체크리스트 상태 로드
  useEffect(() => {
    if (!resultId) return;
    let cancelled = false;

    async function fetchChecklist(): Promise<void> {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/checklist/${resultId}`);
        const data = (await response.json()) as ApiResponse<ChecklistData>;
        if (cancelled) return;

        if (data.checklist?.items) {
          const ids = new Set<string>();
          for (const item of data.checklist.items) {
            if (item.checked) {
              ids.add(item.itemId);
            }
          }
          setCheckedIds(ids);
        }
      } catch {
        // API 실패 시 로컬 상태만 사용
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchChecklist();
    return () => {
      cancelled = true;
    };
  }, [resultId]);

  const toggleCheck = useCallback(
    (checkId: string) => {
      // Optimistic update using functional setState to avoid stale closure
      setCheckedIds((prev) => {
        const wasChecked = prev.has(checkId);
        const next = new Set(prev);
        if (wasChecked) {
          next.delete(checkId);
        } else {
          next.add(checkId);
        }

        // 서버 동기화 (fire-and-forget)
        if (resultId) {
          fetch(`/api/checklist/${resultId}/${checkId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checked: !wasChecked }),
          }).catch(() => {
            // 서버 실패 시 롤백
            setCheckedIds((rollback) => {
              const rolled = new Set(rollback);
              if (wasChecked) {
                rolled.add(checkId);
              } else {
                rolled.delete(checkId);
              }
              return rolled;
            });
          });
        }

        return next;
      });
    },
    [resultId],
  );

  // Check의 status가 confirmed면 체크 상태에 포함
  useEffect(() => {
    const confirmedIds = new Set<string>();
    for (const check of checks) {
      if (check.status === 'confirmed') {
        confirmedIds.add(check.id);
      }
    }
    if (confirmedIds.size > 0) {
      setCheckedIds((prev) => {
        const next = new Set(prev);
        for (const id of confirmedIds) {
          next.add(id);
        }
        return next;
      });
    }
  }, [checks]);

  const completedCount = checkedIds.size;
  const totalCount = checks.length;

  return {
    checks,
    checkedIds,
    toggleCheck,
    isLoading,
    completedCount,
    totalCount,
  };
}
