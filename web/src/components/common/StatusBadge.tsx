/**
 * @module web/components/common/StatusBadge
 * @description 분석 결과 상태 배지 (TASK-064)
 * 4개 상태별 색상, 한글 라벨, aria-label 접근성 포함
 */

import type { AnalysisStatus } from '../../types';
import { STATUS_LABELS, STATUS_BADGE_STYLES } from '../../utils/status';

interface StatusBadgeProps {
  /** 분석 상태 */
  status: AnalysisStatus;
  /** 크기: sm(LNB/테이블), md(대시보드) */
  size?: 'sm' | 'md';
}

/** 상태별 아이콘 SVG path */
const STATUS_ICONS: Record<AnalysisStatus, string | null> = {
  'active': null,  // active는 배지 미표시
  'completed': 'M5 13l4 4L19 7',  // checkmark
  'on-hold': 'M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z',  // pause circle
  'archived': 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8',  // archive box
};

function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  // active 상태는 배지를 표시하지 않음 (기본 상태 = 시각적 무게 최소화)
  if (status === 'active') {
    return null;
  }

  const styles = STATUS_BADGE_STYLES[status];
  const label = STATUS_LABELS[status];
  const iconPath = STATUS_ICONS[status];

  const sizeClasses = size === 'md'
    ? 'px-2 py-0.5 text-xs'
    : 'px-1.5 py-0.5 text-xs';

  const iconSize = size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3';

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${sizeClasses} font-medium ${styles.bg} ${styles.text} rounded`}
      aria-label={`상태: ${label}`}
      data-testid={`status-badge-${status}`}
    >
      {iconPath && (
        <svg
          className={iconSize}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
        </svg>
      )}
      {label}
    </span>
  );
}

export default StatusBadge;
