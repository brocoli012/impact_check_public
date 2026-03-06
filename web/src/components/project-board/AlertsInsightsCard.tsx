/**
 * @module web/components/project-board/AlertsInsightsCard
 * @description T3-04: 취약점/개선점 요약 카드
 * GapHealthWidget 데이터 + planningChecks + policyWarnings 요약
 */

import { useMemo, useState } from 'react';
import type { GapCheckResult, PolicyWarning, Check } from '../../types';

interface AlertsInsightsCardProps {
  gapData: GapCheckResult | null;
  policyWarnings?: PolicyWarning[];
  planningChecks?: Check[];
}

export default function AlertsInsightsCard({
  gapData,
  policyWarnings = [],
  planningChecks = [],
}: AlertsInsightsCardProps) {
  const [expanded, setExpanded] = useState(false);

  const stats = useMemo(() => {
    const gapTotal = gapData?.summary?.total ?? 0;
    const gapHigh = gapData?.summary?.high ?? 0;

    const warningsBySeverity = { critical: 0, warning: 0, info: 0 };
    for (const w of policyWarnings) {
      warningsBySeverity[w.severity] = (warningsBySeverity[w.severity] || 0) + 1;
    }

    const checksByPriority = { high: 0, medium: 0, low: 0 };
    const pendingChecks = planningChecks.filter((c) => c.status === 'pending');
    for (const c of pendingChecks) {
      checksByPriority[c.priority] = (checksByPriority[c.priority] || 0) + 1;
    }

    return {
      gapTotal,
      gapHigh,
      warningTotal: policyWarnings.length,
      warningCritical: warningsBySeverity.critical,
      checkPending: pendingChecks.length,
      checkHigh: checksByPriority.high,
    };
  }, [gapData, policyWarnings, planningChecks]);

  // 모든 데이터가 비어있으면 숨김
  if (stats.gapTotal === 0 && stats.warningTotal === 0 && stats.checkPending === 0) {
    return null;
  }

  const hasHighSeverity = stats.gapHigh > 0 || stats.warningCritical > 0 || stats.checkHigh > 0;

  return (
    <div
      data-testid="alerts-insights-card"
      className={`rounded-lg border p-4 ${
        hasHighSeverity
          ? 'bg-red-50 border-red-200'
          : 'bg-amber-50 border-amber-200'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          주의 사항 요약
        </h3>
        {(policyWarnings.length > 0 || planningChecks.length > 0) && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-purple-600 hover:text-purple-800 font-medium"
            data-testid="alerts-toggle"
          >
            {expanded ? '접기' : '상세'}
          </button>
        )}
      </div>

      {/* KPI 행 */}
      <div className="grid grid-cols-3 gap-3">
        {/* 갭 누락 */}
        <div className="bg-white/70 rounded-lg p-3 text-center">
          <div className={`text-xl font-bold ${stats.gapHigh > 0 ? 'text-red-600' : 'text-gray-700'}`}>
            {stats.gapTotal}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">누락 항목</div>
          {stats.gapHigh > 0 && (
            <div className="text-[10px] text-red-500 font-medium">HIGH {stats.gapHigh}</div>
          )}
        </div>

        {/* 정책 경고 */}
        <div className="bg-white/70 rounded-lg p-3 text-center">
          <div className={`text-xl font-bold ${stats.warningCritical > 0 ? 'text-red-600' : 'text-gray-700'}`}>
            {stats.warningTotal}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">정책 경고</div>
          {stats.warningCritical > 0 && (
            <div className="text-[10px] text-red-500 font-medium">CRITICAL {stats.warningCritical}</div>
          )}
        </div>

        {/* 확인 필요 */}
        <div className="bg-white/70 rounded-lg p-3 text-center">
          <div className={`text-xl font-bold ${stats.checkHigh > 0 ? 'text-amber-600' : 'text-gray-700'}`}>
            {stats.checkPending}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">확인 필요</div>
          {stats.checkHigh > 0 && (
            <div className="text-[10px] text-amber-600 font-medium">긴급 {stats.checkHigh}</div>
          )}
        </div>
      </div>

      {/* 상세 (펼침) */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-200/50 space-y-3">
          {/* 정책 경고 목록 */}
          {policyWarnings.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 mb-1.5">정책 경고</h4>
              <div className="space-y-1">
                {policyWarnings.slice(0, 5).map((w) => (
                  <div key={w.id} className="flex items-start gap-2 text-xs">
                    <span
                      className={`shrink-0 w-1.5 h-1.5 mt-1.5 rounded-full ${
                        w.severity === 'critical' ? 'bg-red-500' :
                        w.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-400'
                      }`}
                    />
                    <span className="text-gray-600">{w.message}</span>
                  </div>
                ))}
                {policyWarnings.length > 5 && (
                  <p className="text-[10px] text-gray-400">+{policyWarnings.length - 5}건 더</p>
                )}
              </div>
            </div>
          )}

          {/* 확인 사항 목록 */}
          {planningChecks.filter((c) => c.status === 'pending').length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 mb-1.5">기획 확인 사항</h4>
              <div className="space-y-1">
                {planningChecks
                  .filter((c) => c.status === 'pending')
                  .slice(0, 5)
                  .map((c) => (
                    <div key={c.id} className="flex items-start gap-2 text-xs">
                      <span
                        className={`shrink-0 w-1.5 h-1.5 mt-1.5 rounded-full ${
                          c.priority === 'high' ? 'bg-red-400' :
                          c.priority === 'medium' ? 'bg-amber-400' : 'bg-gray-400'
                        }`}
                      />
                      <span className="text-gray-600">{c.content}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
