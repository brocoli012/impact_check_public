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

    // audience 기반 분류 (기획자 관점)
    const audienceCounts = { planner: 0, developer: 0, both: 0 };
    // 기획자 관점 카테고리 분류
    const plannerCategories = { permission: 0, process: 0, validation: 0, other: 0 };

    for (const policy of policies) {
      categoryMap.set(policy.category, (categoryMap.get(policy.category) || 0) + 1);
      if (policy.confidence < 0.5) {
        warningCount++;
      }

      // audience 분류
      const audience = policy.audience || 'developer';
      audienceCounts[audience] = (audienceCounts[audience] || 0) + 1;

      // 기획자 관점 카테고리 (category 키워드 기반)
      const cat = policy.category.toLowerCase();
      if (cat.includes('권한') || cat.includes('auth') || cat.includes('permission') || cat.includes('role')) {
        plannerCategories.permission++;
      } else if (cat.includes('프로세스') || cat.includes('process') || cat.includes('flow') || cat.includes('workflow')) {
        plannerCategories.process++;
      } else if (cat.includes('검증') || cat.includes('valid') || cat.includes('rule') || cat.includes('규칙')) {
        plannerCategories.validation++;
      } else {
        plannerCategories.other++;
      }
    }

    const plannerRelevant = audienceCounts.planner + audienceCounts.both;

    return {
      total: policies.length,
      warningCount,
      categories: Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1]),
      plannerRelevant,
      plannerCategories,
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
        <h3 className="text-sm font-bold text-gray-900">정책 현황 (기획자 관점)</h3>
        <Link
          to="/policies"
          className="text-xs text-purple-600 hover:text-purple-800"
        >
          상세 &rarr;
        </Link>
      </div>

      {/* KPI - 기획자 관점 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-900" data-testid="policy-total-count">
            {stats.total}
          </p>
          <p className="text-xs text-gray-500 mt-1">전체 정책</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-purple-600" data-testid="policy-planner-count">
            {stats.plannerRelevant}
          </p>
          <p className="text-xs text-gray-500 mt-1">기획 관련</p>
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

      {/* 기획자 관점 정책 분류 */}
      <div className="mb-3">
        <h4 className="text-xs font-semibold text-gray-700 mb-2">정책 유형별 현황</h4>
        <div className="grid grid-cols-2 gap-2">
          {stats.plannerCategories.permission > 0 && (
            <div className="flex items-center justify-between bg-blue-50 rounded px-2.5 py-1.5">
              <span className="text-xs text-blue-700">권한 정책</span>
              <span className="text-xs font-bold text-blue-700">{stats.plannerCategories.permission}건</span>
            </div>
          )}
          {stats.plannerCategories.process > 0 && (
            <div className="flex items-center justify-between bg-green-50 rounded px-2.5 py-1.5">
              <span className="text-xs text-green-700">프로세스 정책</span>
              <span className="text-xs font-bold text-green-700">{stats.plannerCategories.process}건</span>
            </div>
          )}
          {stats.plannerCategories.validation > 0 && (
            <div className="flex items-center justify-between bg-amber-50 rounded px-2.5 py-1.5">
              <span className="text-xs text-amber-700">밸리데이션 정책</span>
              <span className="text-xs font-bold text-amber-700">{stats.plannerCategories.validation}건</span>
            </div>
          )}
          {stats.plannerCategories.other > 0 && (
            <div className="flex items-center justify-between bg-gray-50 rounded px-2.5 py-1.5">
              <span className="text-xs text-gray-600">기타 정책</span>
              <span className="text-xs font-bold text-gray-600">{stats.plannerCategories.other}건</span>
            </div>
          )}
        </div>
      </div>

      {/* 카테고리별 분포 (기존 유지) */}
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
