/**
 * @module web/components/dashboard/PolicyChangeSection
 * @description 정책 변경 섹션 - ActionGuide에서 분리된 정책 관련 독립 섹션
 */

import { useNavigate } from 'react-router-dom';
import type { PolicyWarning } from '../../types';

export interface PolicyChangeSectionProps {
  policyWarnings: PolicyWarning[];
}

const SEVERITY_STYLES: Record<string, { dot: string; bg: string }> = {
  critical: { dot: 'bg-red-500', bg: 'bg-red-50' },
  warning: { dot: 'bg-orange-400', bg: 'bg-orange-50' },
  info: { dot: 'bg-blue-400', bg: 'bg-blue-50' },
};

function PolicyChangeSection({ policyWarnings }: PolicyChangeSectionProps) {
  const navigate = useNavigate();

  if (!policyWarnings || policyWarnings.length === 0) return null;

  const criticalCount = policyWarnings.filter((w) => w.severity === 'critical').length;
  const warningCount = policyWarnings.filter((w) => w.severity === 'warning').length;

  return (
    <div
      id="section-policy"
      className="bg-white rounded-lg border border-gray-200 p-5"
      data-testid="policy-change-section"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900">정책 변경</h3>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">
              심각 {criticalCount}
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700">
              경고 {warningCount}
            </span>
          )}
          <button
            type="button"
            onClick={() => navigate('/policies')}
            className="text-xs text-purple-600 hover:text-purple-800 hover:underline"
            data-testid="policy-detail-link"
          >
            상세 보기
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {policyWarnings.map((warning) => {
          const style = SEVERITY_STYLES[warning.severity] ?? SEVERITY_STYLES.info;
          return (
            <div
              key={warning.id}
              className={`rounded-md p-3 ${style.bg}`}
              data-testid={`policy-warning-${warning.id}`}
            >
              <div className="flex items-start gap-2">
                <span className={`mt-1.5 w-2 h-2 rounded-full ${style.dot} shrink-0`} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{warning.policyName}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{warning.message}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PolicyChangeSection;
