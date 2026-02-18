/**
 * @module web/pages/Policies
 * @description 정책 목록 페이지 - 필터 + 카드 목록 + 상세 패널 레이아웃
 */

import { useEffect, useMemo } from 'react';
import { usePolicyStore } from '../stores/policyStore';
import { useResultStore } from '../stores/resultStore';
import { useEnsureResult } from '../hooks/useEnsureResult';
import PolicyCard from '../components/policies/PolicyCard';
import PolicyFilter from '../components/policies/PolicyFilter';
import PolicyDetail from '../components/policies/PolicyDetail';

function Policies() {
  useEnsureResult();
  const currentResult = useResultStore((s) => s.currentResult);

  const {
    policies,
    selectedPolicy,
    searchQuery,
    selectedCategory,
    selectedRequirement,
    loading,
    error,
    fetchPolicies,
    fetchPolicyDetail,
    clearSelection,
  } = usePolicyStore();

  // 프로젝트 ID 기반 정책 목록 로드
  useEffect(() => {
    if (currentResult) {
      fetchPolicies(currentResult.analysisId);
    }
  }, [currentResult, fetchPolicies]);

  // 기획서에서 요구사항 및 작업 목록 추출
  const requirements = currentResult?.parsedSpec?.requirements;
  const tasks = currentResult?.tasks;

  // 필터링된 정책 목록
  const filteredPolicies = useMemo(() => {
    let filtered = policies;

    // 요구사항 필터: requirement → tasks → policies 체인
    if (selectedRequirement && tasks) {
      const relatedTaskIds = tasks
        .filter((t) => t.sourceRequirementIds?.includes(selectedRequirement))
        .map((t) => t.id);
      filtered = filtered.filter((p) => {
        // 1) API에서 받은 relatedTaskIds로 먼저 체크
        if (p.relatedTaskIds && p.relatedTaskIds.length > 0) {
          return p.relatedTaskIds.some((tid) => relatedTaskIds.includes(tid));
        }
        // 2) 폴백: 정책의 affectedFiles와 해당 tasks의 affectedFiles 교집합 체크
        const matchedTasks = tasks.filter((t) => relatedTaskIds.includes(t.id));
        for (const task of matchedTasks) {
          if (
            p.affectedFiles?.some((pf) =>
              task.affectedFiles?.some(
                (tf) => pf.includes(tf) || tf.includes(pf),
              ),
            )
          ) {
            return true;
          }
        }
        // 3) 정책 카테고리/이름에서 키워드 매칭
        const policyText =
          `${p.name} ${p.description} ${p.category}`.toLowerCase();
        const matchedTaskTexts = matchedTasks.map(
          (t) => `${t.title} ${t.description}`.toLowerCase(),
        );
        for (const taskText of matchedTaskTexts) {
          const keywords = taskText
            .split(/[\s,/]+/)
            .filter((w) => w.length > 1);
          const matches = keywords.filter((kw) => policyText.includes(kw));
          if (matches.length >= 2) return true;
        }
        return false;
      });
    }

    // 카테고리 필터
    if (selectedCategory) {
      filtered = filtered.filter((p) => p.category === selectedCategory);
    }

    // 검색어 필터
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q),
      );
    }

    return filtered;
  }, [policies, selectedRequirement, tasks, selectedCategory, searchQuery]);

  const handlePolicyClick = (policyId: string) => {
    if (currentResult) {
      fetchPolicyDetail(currentResult.analysisId, policyId);
    }
  };

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
          정책 목록
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {currentResult.specTitle}
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-700">{error}</p>
        </div>
      )}

      {/* Filter bar */}
      <PolicyFilter
        resultCount={filteredPolicies.length}
        totalCount={policies.length}
        requirements={requirements}
        tasks={tasks}
      />

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500">정책 목록을 불러오는 중...</p>
          </div>
        </div>
      )}

      {/* Main content area */}
      {!loading && (
        <div className="flex gap-6">
          {/* Left: Policy card list */}
          <div className="flex-1">
            {filteredPolicies.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-sm text-gray-500">
                  {policies.length === 0
                    ? '정책이 없습니다. 먼저 인덱싱을 실행해주세요.'
                    : '검색 조건에 맞는 정책이 없습니다.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredPolicies.map((policy) => (
                  <PolicyCard
                    key={policy.id}
                    policy={policy}
                    isSelected={selectedPolicy?.id === policy.id}
                    onClick={() => handlePolicyClick(policy.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: Selected policy detail panel */}
          {selectedPolicy && (
            <PolicyDetail
              policy={selectedPolicy}
              onClose={clearSelection}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default Policies;
