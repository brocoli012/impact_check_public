/**
 * @module web/components/projects/GapDetailList
 * @description TASK-170: 갭 상세 목록 - 각 갭 아이템을 카드 형태로 표시
 */

import { useCallback } from 'react';
import type { GapItem, GapSeverity, GapType } from '../../types';

interface GapDetailListProps {
  gaps: GapItem[];
}

/** 심각도 배지 스타일 매핑 */
const severityStyles: Record<GapSeverity, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-orange-100 text-orange-700',
  low: 'bg-gray-100 text-gray-600',
};

/** 심각도 라벨 */
const severityLabels: Record<GapSeverity, string> = {
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
};

/** 갭 유형 라벨 */
const typeLabels: Record<GapType, string> = {
  'stale-link': '오래된 링크',
  'unanalyzed-project': '미분석 프로젝트',
  'low-confidence': '저신뢰도',
  'stale-index': '인덱스 미갱신',
};

export default function GapDetailList({ gaps }: GapDetailListProps) {
  const handleCopyCommand = useCallback(async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      // 클립보드 접근 실패 시 무시
    }
  }, []);

  if (gaps.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-2" data-testid="gap-detail-empty">
        표시할 갭 항목이 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-2" data-testid="gap-detail-list" role="list" aria-label="갭 상세 목록">
      {gaps.map((gap, idx) => (
        <div
          key={`${gap.type}-${gap.projectId}-${idx}`}
          className="border border-gray-200 rounded-lg p-3 bg-white"
          data-testid="gap-detail-card"
          role="listitem"
          aria-label={`${severityLabels[gap.severity]} - ${typeLabels[gap.type]}: ${gap.projectId}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* 배지 행 */}
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${severityStyles[gap.severity]}`}
                  data-testid="gap-severity-badge"
                >
                  {severityLabels[gap.severity]}
                </span>
                <span className="text-[10px] text-gray-500 font-medium">
                  {typeLabels[gap.type]}
                </span>
                <span className="text-[10px] text-gray-400 font-mono">
                  {gap.projectId}
                </span>
              </div>

              {/* 설명 */}
              <p className="text-xs text-gray-700 leading-relaxed">
                {gap.description}
              </p>
            </div>

            {/* CTA 버튼: fixable + fixCommand가 있을 때만 표시 */}
            {gap.fixable && gap.fixCommand && (
              <button
                onClick={() => handleCopyCommand(gap.fixCommand!)}
                className="shrink-0 text-[10px] px-2 py-1 bg-purple-50 text-purple-600 rounded hover:bg-purple-100 transition-colors font-medium"
                data-testid="gap-copy-command-btn"
                title={gap.fixCommand}
              >
                명령어 복사
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
