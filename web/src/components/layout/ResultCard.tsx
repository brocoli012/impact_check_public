/**
 * @module web/components/layout/ResultCard
 * @description 분석 결과 카드 - LNB에 표시되는 개별 결과 카드
 */

import type { ResultSummary } from '../../types';

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
        ${
          isSelected
            ? 'border-blue-500 bg-blue-50 dark:bg-gray-700 shadow-md'
            : result.isDemo
              ? 'border-purple-400 hover:bg-purple-50 dark:hover:bg-gray-700 hover:shadow-sm'
              : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-sm'
        }
      `}
    >
      {/* Header: Grade + Date */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-base font-bold ${gradeColor.text}`}>{result.grade}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            📅 {formatDate(result.analyzedAt)}
          </span>
        </div>
      </div>

      {/* Title - 2 line truncation */}
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
        {result.isDemo && (
          <span className="inline-flex items-center px-1.5 py-0.5 mr-1 text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 rounded">
            예시
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
