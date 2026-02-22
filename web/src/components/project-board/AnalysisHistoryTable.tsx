/**
 * @module web/components/project-board/AnalysisHistoryTable
 * @description TASK-133: 최근 분석 결과를 테이블로 표시
 */

import { Link } from 'react-router-dom';
import type { ResultSummary } from '../../types';
import type { Grade } from '../../types';
import { GRADE_COLORS } from '../../utils/colors';

interface AnalysisHistoryTableProps {
  results: ResultSummary[];
  maxItems?: number;
}

function AnalysisHistoryTable({ results, maxItems = 5 }: AnalysisHistoryTableProps) {
  if (results.length === 0) {
    return (
      <div
        data-testid="analysis-history-empty"
        className="bg-white rounded-lg border border-gray-200 p-6 text-center"
      >
        <div className="text-gray-400 mb-3">
          <svg className="w-10 h-10 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-sm font-medium text-gray-500">아직 분석 결과가 없습니다.</p>
          <p className="text-xs text-gray-400 mt-1">
            기획서를 분석하여 영향도를 확인하세요.
          </p>
        </div>
        <Link
          to="/analysis"
          className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800 font-medium"
          data-testid="analysis-history-cta"
        >
          기획 분석 시작 <span aria-hidden="true">&rarr;</span>
        </Link>
        <p className="text-xs text-gray-400 mt-2 font-mono">
          또는 CLI에서: node dist/index.js analyze &lt;spec-file&gt;
        </p>
      </div>
    );
  }

  const displayResults = results.slice(0, maxItems);

  return (
    <div data-testid="analysis-history-table" className="bg-white rounded-lg border border-gray-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-900">최근 분석 이력</h3>
        <Link
          to="/analysis"
          className="text-xs text-purple-600 hover:text-purple-800"
        >
          전체 보기 &rarr;
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500">
              <th className="px-4 py-2 text-left font-medium w-10">#</th>
              <th className="px-4 py-2 text-left font-medium">기획서명</th>
              <th className="px-4 py-2 text-center font-medium w-20">등급</th>
              <th className="px-4 py-2 text-right font-medium w-16">점수</th>
              <th className="px-4 py-2 text-right font-medium w-28">분석일</th>
            </tr>
          </thead>
          <tbody>
            {displayResults.map((result, idx) => {
              const grade = result.grade as Grade;
              const colors = GRADE_COLORS[grade] || GRADE_COLORS.Low;
              return (
                <tr
                  key={result.id}
                  className="border-t border-gray-50 hover:bg-gray-50 transition-colors"
                  data-testid={`analysis-row-${idx}`}
                >
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{idx + 1}</td>
                  <td className="px-4 py-2.5 text-gray-700 font-medium truncate max-w-[200px]">
                    {result.specTitle}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: colors.bg,
                        color: colors.text,
                        border: `1px solid ${colors.border}`,
                      }}
                    >
                      {result.grade}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-600 font-mono text-xs">
                    {result.totalScore}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-400 text-xs">
                    {formatDate(result.analyzedAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 날짜 포맷 헬퍼 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export default AnalysisHistoryTable;
