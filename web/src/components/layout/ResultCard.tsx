/**
 * @module web/components/layout/ResultCard
 * @description 분석 결과 카드 - LNB에 표시되는 개별 결과 카드
 * TASK-067: 상태 배지 + 상태별 스타일 통합
 */

import type { ResultSummary } from '../../types';
import StatusBadge from '../common/StatusBadge';
import { getEffectiveStatus, STATUS_CARD_STYLES } from '../../utils/status';

interface ResultCardProps {
  /** 결과 요약 */
  result: ResultSummary;
  /** 선택 여부 */
  isSelected: boolean;
  /** 클릭 핸들러 */
  onClick: () => void;
}

/** 등급별 색상 매핑 */
const GRADE_COLORS: Record<string, { text: string; bg: string }> = {
  A: { text: 'text-green-600 dark:text-green-400', bg: 'bg-green-500' },
  B: { text: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-500' },
  C: { text: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-500' },
  D: { text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500' },
  E: { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500' },
  F: { text: 'text-red-700 dark:text-red-500', bg: 'bg-red-700' },
  Low: { text: 'text-green-600 dark:text-green-400', bg: 'bg-green-500' },
  Medium: { text: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-500' },
  High: { text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500' },
  Critical: { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500' },
};

/**
 * 날짜 포맷팅 (YYYY-MM-DD)
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '-';
    }
    return date.toISOString().split('T')[0];
  } catch {
    return '-';
  }
}

function ResultCard({ result, isSelected, onClick }: ResultCardProps) {
  const gradeColor = GRADE_COLORS[result.grade] || GRADE_COLORS.Low;
  const effectiveStatus = getEffectiveStatus(result.status);
  const cardStyle = STATUS_CARD_STYLES[effectiveStatus];

  // archived/completed 상태의 등급 텍스트 톤다운
  const gradeTextClass =
    effectiveStatus === 'archived'
      ? 'text-gray-300'
      : effectiveStatus === 'completed'
        ? 'text-gray-400'
        : gradeColor.text;

  // border-l 색상: 선택 상태나 데모일 때는 기존 동작 유지, 아닌 경우 상태별 색상
  const getBorderClass = () => {
    if (isSelected) return 'border-blue-500 bg-blue-50 dark:bg-gray-700 shadow-md';
    if (result.isDemo) return 'border-purple-400 hover:bg-purple-50 dark:hover:bg-gray-700 hover:shadow-sm';
    return `${cardStyle.borderColor} hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-sm`;
  };

  return (
    <div
      data-result-id={result.id}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-selected={isSelected}
      className={`
        p-3 rounded-md cursor-pointer transition-all border-l-4
        bg-white dark:bg-gray-800
        ${getBorderClass()}
        ${cardStyle.opacity}
      `}
    >
      {/* Header: Grade + Date */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-base font-bold ${gradeTextClass}`}>{result.grade}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            📅 {formatDate(result.analyzedAt)}
          </span>
        </div>
      </div>

      {/* Title - 2 line truncation with status badge */}
      <h3 className={`text-sm font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2 ${cardStyle.titleClass}`}>
        {/* 상태 배지 (active는 표시 안 됨) */}
        <StatusBadge status={effectiveStatus} size="sm" />
        {/* 데모 배지 */}
        {result.isDemo && (
          <span className="inline-flex items-center px-1.5 py-0.5 mr-1 text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 rounded">
            예시
          </span>
        )}
        {/* 보완 분석 배지 */}
        {result.isSupplement && (
          <span className="inline-flex items-center px-1.5 py-0.5 mr-1 text-xs font-medium bg-violet-100 text-violet-700 rounded">
            보완
          </span>
        )}
        {result.specTitle}
      </h3>

      {/* Score */}
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        총점 {result.totalScore}/100
      </p>

      {/* Summary: Screens + Tasks */}
      <p className="text-xs text-gray-600 dark:text-gray-400">
        영향 화면 {result.affectedScreenCount}개 · 작업 {result.taskCount}건
      </p>
    </div>
  );
}

export default ResultCard;
