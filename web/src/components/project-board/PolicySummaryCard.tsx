/**
 * @module web/components/project-board/PolicySummaryCard
 * @description TASK-135: 정책 현황 요약 카드
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Policy } from '../../types';

interface PolicySummaryCardProps {
  policies: Policy[];
}

function PolicySummaryCard({ policies }: PolicySummaryCardProps) {
  const stats = useMemo(() => {
    const categoryMap = new Map<string, number>();
    let warningCount = 0;

    for (const policy of policies) {
      categoryMap.set(policy.category, (categoryMap.get(policy.category) || 0) + 1);
      // 낮은 신뢰도(0.5 미만)를 경고로 간주
      if (policy.confidence < 0.5) {
        warningCount++;
      }
    }

    return {
      total: policies.length,
      warningCount,
      categories: Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [policies]);

  if (policies.length === 0) {
    return (
      <div
        data-testid="policy-summary-empty"
        className="bg-white rounded-lg border border-gray-200 p-6 text-center"
      >
        <p className="text-sm text-gray-400">등록된 정책이 없습니다.</p>
      </div>
    );
  }

  return (
    <div data-testid="policy-summary-card" className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-900">정책 현황</h3>
        <Link
          to="/policies"
          className="text-xs text-purple-600 hover:text-purple-800"
        >
          상세 &rarr;
        </Link>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-900" data-testid="policy-total-count">
            {stats.total}
          </p>
          <p className="text-xs text-gray-500 mt-1">전체 정책</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p
            className={`text-2xl font-bold ${stats.warningCount > 0 ? 'text-amber-600' : 'text-gray-900'}`}
            data-testid="policy-warning-count"
          >
            {stats.warningCount}
          </p>
          <p className="text-xs text-gray-500 mt-1">경고</p>
        </div>
      </div>

      {/* 카테고리별 분포 */}
      {stats.categories.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-700 mb-2">카테고리별 분포</h4>
          <div className="flex flex-wrap gap-1.5">
            {stats.categories.map(([category, count]) => (
              <span
                key={category}
                className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full"
              >
                <span className="font-medium">{category}</span>
                <span className="text-gray-400">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PolicySummaryCard;
