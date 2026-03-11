/**
 * @module web/components/dashboard/RiskAreaDisplay
 * @description RiskArea 구조화 렌더링 컴포넌트 (REQ-018-A2)
 *
 * string 항목: 기존 불릿 렌더링
 * RiskArea 객체: 테이블 형태 렌더링 (impact 배지, mitigation 표시)
 * 혼합 배열 지원: 구조화된 항목은 테이블, 문자열은 불릿으로 분리 표시
 */

import type { RiskArea } from '../../types';
import { isRiskAreaObject } from '../../types';

/* ------------------------------------------------------------------ */
/*  Impact level display config                                        */
/* ------------------------------------------------------------------ */

const IMPACT_CONFIG: Record<RiskArea['impact'], { label: string; color: string; bg: string }> = {
  critical: { label: '심각', color: 'text-red-800', bg: 'bg-red-100' },
  high: { label: '높음', color: 'text-orange-800', bg: 'bg-orange-100' },
  medium: { label: '보통', color: 'text-yellow-800', bg: 'bg-yellow-100' },
  low: { label: '낮음', color: 'text-green-800', bg: 'bg-green-100' },
};

const CATEGORY_LABELS: Record<NonNullable<RiskArea['category']>, string> = {
  'technical': '기술',
  'data-integrity': '데이터 무결성',
  'performance': '성능',
  'dependency': '의존성',
  'business': '비즈니스',
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                      */
/* ------------------------------------------------------------------ */

function ImpactBadge({ impact }: { impact: RiskArea['impact'] }) {
  const config = IMPACT_CONFIG[impact];
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${config.color} ${config.bg}`}
      data-testid="impact-badge"
    >
      {config.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface RiskAreaDisplayProps {
  riskAreas: (string | RiskArea)[];
}

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

function RiskAreaDisplay({ riskAreas }: RiskAreaDisplayProps) {
  if (!riskAreas || riskAreas.length === 0) return null;

  const stringRisks: string[] = [];
  const structuredRisks: RiskArea[] = [];

  for (const item of riskAreas) {
    if (isRiskAreaObject(item)) {
      structuredRisks.push(item);
    } else {
      stringRisks.push(item);
    }
  }

  return (
    <div data-testid="risk-area-display">
      {/* Structured risks: table rendering */}
      {structuredRisks.length > 0 && (
        <div className="mb-3" data-testid="structured-risks">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-red-50 text-left">
                  <th className="px-3 py-2 font-medium text-gray-700 border-b border-red-200">리스크</th>
                  <th className="px-3 py-2 font-medium text-gray-700 border-b border-red-200 w-20">영향도</th>
                  <th className="px-3 py-2 font-medium text-gray-700 border-b border-red-200">완화 방안</th>
                  {structuredRisks.some(r => r.category) && (
                    <th className="px-3 py-2 font-medium text-gray-700 border-b border-red-200 w-24">카테고리</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {structuredRisks.map((risk, index) => (
                  <tr
                    key={risk.id || index}
                    className="border-b border-gray-100 hover:bg-red-50/50"
                    data-testid={`structured-risk-${index}`}
                  >
                    <td className="px-3 py-2 text-gray-700">{risk.description}</td>
                    <td className="px-3 py-2">
                      <ImpactBadge impact={risk.impact} />
                    </td>
                    <td className="px-3 py-2 text-gray-600">{risk.mitigation}</td>
                    {structuredRisks.some(r => r.category) && (
                      <td className="px-3 py-2 text-gray-500 text-xs">
                        {risk.category ? CATEGORY_LABELS[risk.category] : '-'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* String risks: legacy bullet rendering */}
      {stringRisks.length > 0 && (
        <div data-testid="string-risks">
          {structuredRisks.length > 0 && (
            <h5 className="text-xs font-medium text-gray-500 mb-1.5 mt-2">추가 주의사항</h5>
          )}
          <div className="bg-red-50 rounded-lg p-3">
            <ul className="space-y-1.5">
              {stringRisks.map((risk, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-gray-700"
                  data-testid={`string-risk-${index}`}
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

export default RiskAreaDisplay;
