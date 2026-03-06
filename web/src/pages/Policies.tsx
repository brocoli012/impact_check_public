import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePolicyStore } from '../stores/policyStore';
import { useResultStore } from '../stores/resultStore';
import { useProjectStore } from '../stores/projectStore';
import { useLatestResult } from '../hooks/useAnalysisResult';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import PolicyCard from '../components/policies/PolicyCard';
import PolicyFilter from '../components/policies/PolicyFilter';
import PolicyDetail from '../components/policies/PolicyDetail';
import PolicyAudienceTabs from '../components/policies/PolicyAudienceTabs';
import PlannerPolicyCard from '../components/policies/PlannerPolicyCard';
import DeveloperPolicyCard from '../components/policies/DeveloperPolicyCard';
import ProjectSelector from '../components/common/ProjectSelector';
import type { PolicyAudience } from '../types';

function Policies() {
  useLatestResult();
  const currentResult = useResultStore((s) => s.currentResult);

  const {
    policies,
    selectedPolicy,
    searchQuery,
    selectedCategory,
    selectedSource,
    selectedRequirement,
    selectedAudience,
    loading,
    loadingDetail,
    loadingMore,
    hasMore,
    totalCount,
    error,
    fetchPolicies,
    fetchMorePolicies,
    fetchPolicyDetail,
    setSelectedAudience,
    clearSelection,
  } = usePolicyStore();

  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  // URL 쿼리 파라미터에서 초기 audience 값 읽기
  const [searchParams] = useSearchParams();
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const viewParam = searchParams.get('view');
    if (viewParam === 'planner' || viewParam === 'developer') {
      setSelectedAudience(viewParam);
    }
  }, [searchParams, setSelectedAudience]);

  // 마운트 시 항상 정책 목록 로드 (탭 전환 후 복귀 시에도 동작)
  const mountedRef = useRef(false);
  useEffect(() => {
    const projectId = activeProjectId;
    fetchPolicies(projectId || undefined);
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // activeProjectId 변경 시 재조회
  useEffect(() => {
    if (!mountedRef.current) return;
    const projectId = activeProjectId;
    fetchPolicies(projectId || undefined);
  }, [activeProjectId, fetchPolicies]);

  // InfiniteScroll 설정
  const handleLoadMore = useCallback(() => {
    fetchMorePolicies();
  }, [fetchMorePolicies]);

  const { sentinelRef } = useInfiniteScroll({
    hasMore,
    loading: loadingMore,
    onLoadMore: handleLoadMore,
  });

  // 기획서에서 요구사항 및 작업 목록 추출
  const requirements = currentResult?.parsedSpec?.requirements;
  const tasks = currentResult?.tasks;

  // audience별 정책 분류 (필터 전)
  const isMatchAudience = useCallback((policy: { audience?: PolicyAudience }, audience: PolicyAudience) => {
    const a = policy.audience || 'both';
    return a === audience || a === 'both';
  }, []);

  const plannerPolicies = useMemo(() => policies.filter((p) => isMatchAudience(p, 'planner')), [policies, isMatchAudience]);
  const developerPolicies = useMemo(() => policies.filter((p) => isMatchAudience(p, 'developer')), [policies, isMatchAudience]);

  // 필터링된 정책 목록 (audience + 기타 필터 적용)
  const filteredPolicies = useMemo(() => {
    // audience 필터 적용
    let filtered = policies.filter((p) => isMatchAudience(p, selectedAudience));

    // 소스 필터
    if (selectedSource) {
      filtered = filtered.filter((p) => p.source === selectedSource);
    }

    // 요구사항 필터: requirement -> tasks -> policies 체인
    if (selectedRequirement && tasks) {
      const relatedTaskIds = tasks
        .filter((t) => t.sourceRequirementIds?.includes(selectedRequirement))
        .map((t) => t.id);
      filtered = filtered.filter((p) => {
        if (p.relatedTaskIds && p.relatedTaskIds.length > 0) {
          return p.relatedTaskIds.some((tid) => relatedTaskIds.includes(tid));
        }
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
  }, [policies, selectedAudience, isMatchAudience, selectedRequirement, tasks, selectedCategory, selectedSource, searchQuery]);

  const handlePolicyClick = (policyId: string) => {
    const projectId = activeProjectId || useProjectStore.getState().activeProjectId;
    if (projectId) {
      fetchPolicyDetail(projectId, policyId);
    }
  };

  const renderPolicyCard = (policy: typeof policies[number]) => {
    const isSelected = selectedPolicy?.id === policy.id;
    const onClick = () => handlePolicyClick(policy.id);

    if (selectedAudience === 'planner') {
      return (
        <PlannerPolicyCard
          key={policy.id}
          policy={policy}
          isSelected={isSelected}
          onClick={onClick}
        />
      );
    }
    if (selectedAudience === 'developer') {
      return (
        <DeveloperPolicyCard
          key={policy.id}
          policy={policy}
          isSelected={isSelected}
          onClick={onClick}
        />
      );
    }
    return (
      <PolicyCard
        key={policy.id}
        policy={policy}
        isSelected={isSelected}
        onClick={onClick}
      />
    );
  };

  return (
    <div className="space-y-6">
      {/* ProjectSelector */}
      <ProjectSelector />

      {/* Header + Audience Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            정책 목록
          </h2>
          {currentResult && (
            <p className="text-sm text-gray-500 mt-1">
              {currentResult.specTitle}
            </p>
          )}
        </div>
        <PolicyAudienceTabs
          activeView={selectedAudience}
          onViewChange={setSelectedAudience}
          plannerCount={plannerPolicies.length}
          developerCount={developerPolicies.length}
        />
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
        totalCount={totalCount}
        requirements={requirements}
        tasks={tasks}
      />

      {/* Loading state */}
      {loading && policies.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500">정책 목록을 불러오는 중...</p>
          </div>
        </div>
      )}

      {/* Main content area */}
      {(!loading || policies.length > 0) && (
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
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredPolicies.map(renderPolicyCard)}
                </div>

                {/* InfiniteScroll sentinel */}
                <div ref={sentinelRef} className="h-4" />

                {/* Loading more indicator */}
                {loadingMore && (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" />
                    <span className="ml-2 text-sm text-gray-500">더 불러오는 중...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Selected policy detail panel */}
          {loadingDetail && !selectedPolicy && (
            <div className="w-96 shrink-0">
              <div className="bg-white rounded-lg border border-gray-200 p-5 sticky top-20">
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 ml-2">정책 상세를 불러오는 중...</p>
                </div>
              </div>
            </div>
          )}
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
