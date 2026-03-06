/**
 * @module web/components/dashboard/AnalysisSummaryCard
 * @description 분석 요약(overview, keyFindings, riskAreas)을 카드 형태로 표시하는 컴포넌트
 */

import type { AnalysisSummary } from '../../types';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export type AnalysisSummarySectionMode = 'overview' | 'keyFindings' | 'all';

export interface AnalysisSummaryCardProps {
  summary: AnalysisSummary;
  section?: AnalysisSummarySectionMode;
}

/* ------------------------------------------------------------------ */
/*  메인 컴포넌트                                                       */
/* ------------------------------------------------------------------ */

function AnalysisSummaryCard({ summary, section = 'all' }: AnalysisSummaryCardProps) {
  if (!summary) {
    return null;
  }

  const showOverview = section === 'all' || section === 'overview';
  const showKeyFindings = section === 'all' || section === 'keyFindings';
  const hasKeyFindings = summary.keyFindings.length > 0;
  const hasRiskAreas = summary.riskAreas.length > 0;

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-5"
      data-testid="analysis-summary-card"
    >
      {/* Overview */}
      {showOverview && (
        <div
          className={`bg-purple-50 p-4 rounded-lg border-l-4 border-purple-500 ${showKeyFindings ? 'mb-4' : ''}`}
          data-testid="summary-overview"
        >
          <p className="text-sm text-gray-800 leading-relaxed">{summary.overview}</p>
        </div>
      )}

      {/* Key Findings */}
      {showKeyFindings && hasKeyFindings && (
        <div className={hasRiskAreas && showKeyFindings ? 'mb-4' : ''} data-testid="summary-key-findings">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">핵심 발견사항</h4>
          <ol className="space-y-1.5">
            {summary.keyFindings.map((finding, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-gray-700"
                data-testid={`key-finding-${index}`}
              >
                <span className="mt-1.5 w-2 h-2 rounded-full bg-purple-500 shrink-0" aria-hidden="true" />
                <span>{finding}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Risk Areas - only shown with keyFindings or all */}
      {showKeyFindings && hasRiskAreas && (
        <div data-testid="summary-risk-areas">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">위험 영역</h4>
          <div className="bg-red-50 rounded-lg p-3">
            <ul className="space-y-1.5">
              {summary.riskAreas.map((risk, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-gray-700"
                  data-testid={`risk-area-${index}`}
                >
                  <span className="mt-1.5 w-2 h-2 rounded-full bg-red-500 shrink-0" aria-hidden="true" />
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnalysisSummaryCard;
