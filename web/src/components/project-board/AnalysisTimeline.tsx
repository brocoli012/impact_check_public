/**
 * @module web/components/project-board/AnalysisTimeline
 * @description T3-05: 분석 이력 타임라인 뷰
 * AnalysisHistoryTable 데이터를 타임라인 형태로 표시
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { ResultSummary } from '../../types';
import type { Grade } from '../../types';
import { GRADE_COLORS } from '../../utils/colors';

interface AnalysisTimelineProps {
  results: ResultSummary[];
  maxItems?: number;
}

export default function AnalysisTimeline({ results, maxItems = 10 }: AnalysisTimelineProps) {
  const items = useMemo(() => results.slice(0, maxItems), [results, maxItems]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="analysis-timeline"
      className="bg-white rounded-lg border border-gray-200 p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900">분석 타임라인</h3>
        <Link
          to="/analysis"
          className="text-xs text-purple-600 hover:text-purple-800"
        >
          전체 보기 &rarr;
        </Link>
      </div>

      {/* 가로 스크롤 타임라인 */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max">
          {items.map((result, idx) => {
            const grade = result.grade as Grade;
            const colors = GRADE_COLORS[grade] || GRADE_COLORS.Low;
            const isLatest = idx === 0;

            return (
              <div
                key={result.id}
                className={`relative flex-shrink-0 w-40 rounded-lg border p-3 transition-shadow hover:shadow-md ${
                  isLatest ? 'border-purple-300 bg-purple-50/50' : 'border-gray-200 bg-white'
                }`}
                data-testid={`timeline-item-${idx}`}
              >
                {/* 연결선 (첫 번째 제외) */}
                {idx > 0 && (
                  <div className="absolute -left-3 top-1/2 w-3 h-px bg-gray-300" />
                )}

                {/* 날짜 */}
                <div className="text-[10px] text-gray-400 mb-1.5">
                  {formatDate(result.analyzedAt)}
                </div>

                {/* 등급 배지 */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold"
                    style={{
                      backgroundColor: colors.bg,
                      color: colors.text,
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    {result.grade}
                  </span>
                  <span className="text-xs font-mono text-gray-500">{result.totalScore}점</span>
                </div>

                {/* 제목 */}
                <div className="text-xs text-gray-700 font-medium truncate" title={result.specTitle}>
                  {result.specTitle}
                </div>

                {/* 영향 화면 수 */}
                <div className="text-[10px] text-gray-400 mt-1">
                  화면 {result.affectedScreenCount}개 · 작업 {result.taskCount}개
                </div>

                {/* 보완 분석 배지 */}
                {result.isSupplement && (
                  <span className="inline-flex items-center mt-1.5 px-1.5 py-0.5 text-[10px] font-medium bg-violet-100 text-violet-700 rounded">
                    보완
                  </span>
                )}

                {isLatest && (
                  <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-purple-500 rounded-full border-2 border-white" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return dateStr;
  }
}
