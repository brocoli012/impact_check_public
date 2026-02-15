/**
 * @module web/pages/Checklist
 * @description 기획 확인 체크리스트 페이지
 */

import { useMemo } from 'react';
import { useResultStore } from '../stores/resultStore';
import { useEnsureResult } from '../hooks/useEnsureResult';
import { useChecklist } from '../hooks/useChecklist';
import CategoryGroup from '../components/checklist/CategoryGroup';

function Checklist() {
  useEnsureResult();
  const currentResult = useResultStore((s) => s.currentResult);

  const {
    checks,
    checkedIds,
    toggleCheck,
    isLoading,
    completedCount,
    totalCount,
  } = useChecklist();

  // 카테고리별 분류
  const categories = useMemo(() => {
    // 1. 반드시 확인 (개발 시작 전) - priority: high
    const mustCheck = checks.filter((c) => c.priority === 'high');

    // 2. 정책 확인 필요 - 정책 관련 키워드 매칭
    const policyKeywords = ['정책', '제한', '분기', '수단'];
    const policyCheck = checks.filter(
      (c) =>
        c.priority !== 'high' &&
        policyKeywords.some((kw) => c.content.includes(kw)),
    );

    // 3. 정책 경고 - policyWarnings 기반 (별도 표시)
    // 이 카테고리는 policyWarnings에서 체크 항목으로 변환하지 않고 별도 표시

    // 4. 디자인 검토 필요 - UI/디자인 관련 키워드
    const designKeywords = ['디자인', 'UI', 'UX', '시안', '레이아웃'];
    const designCheck = checks.filter(
      (c) =>
        c.priority !== 'high' &&
        !policyKeywords.some((kw) => c.content.includes(kw)) &&
        designKeywords.some((kw) => c.content.includes(kw)),
    );

    // 5. 기타 (분류되지 않은 항목)
    const classifiedIds = new Set([
      ...mustCheck.map((c) => c.id),
      ...policyCheck.map((c) => c.id),
      ...designCheck.map((c) => c.id),
    ]);
    const otherCheck = checks.filter((c) => !classifiedIds.has(c.id));

    return { mustCheck, policyCheck, designCheck, otherCheck };
  }, [checks]);

  // 정책 경고를 체크 형태로 표시
  const policyWarningChecks = useMemo(() => {
    if (!currentResult) return [];
    return currentResult.policyWarnings.map((pw) => ({
      id: `pw-${pw.id}`,
      content: `[${pw.policyName}] ${pw.message}`,
      relatedFeatureId: pw.relatedTaskIds.join(', '),
      priority: pw.severity === 'critical' ? 'high' as const : 'medium' as const,
      status: 'pending' as const,
    }));
  }, [currentResult]);

  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (!currentResult) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-400">데이터 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          기획 확인 체크리스트
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {currentResult.specTitle}
        </p>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            진행률
          </span>
          <span className="text-sm text-gray-500">
            {completedCount} / {totalCount} 완료 ({progressPercent}%)
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {isLoading && (
        <div className="text-center text-sm text-gray-400 py-2">
          체크리스트 상태를 불러오는 중...
        </div>
      )}

      {/* Category groups */}
      <div className="space-y-4">
        <CategoryGroup
          title="반드시 확인 (개발 시작 전)"
          checks={categories.mustCheck}
          checkedIds={checkedIds}
          onToggle={toggleCheck}
          defaultOpen={true}
        />

        <CategoryGroup
          title="정책 확인 필요"
          checks={categories.policyCheck}
          checkedIds={checkedIds}
          onToggle={toggleCheck}
          defaultOpen={true}
        />

        {policyWarningChecks.length > 0 && (
          <CategoryGroup
            title="정책 경고 (Policy Warnings)"
            checks={policyWarningChecks}
            checkedIds={checkedIds}
            onToggle={toggleCheck}
            defaultOpen={true}
          />
        )}

        <CategoryGroup
          title="디자인 검토 필요"
          checks={categories.designCheck}
          checkedIds={checkedIds}
          onToggle={toggleCheck}
          defaultOpen={true}
        />

        {categories.otherCheck.length > 0 && (
          <CategoryGroup
            title="기타 확인 사항"
            checks={categories.otherCheck}
            checkedIds={checkedIds}
            onToggle={toggleCheck}
            defaultOpen={false}
          />
        )}
      </div>
    </div>
  );
}

export default Checklist;
