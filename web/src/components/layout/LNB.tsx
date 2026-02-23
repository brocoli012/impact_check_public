/**
 * @module web/components/layout/LNB
 * @description Left Navigation Bar - 분석 결과 목록 네비게이션
 * TASK-068: 상태 필터 드롭다운 추가
 */

import { useEffect, useMemo, useState } from 'react';
import { useResultStore, type SortOption, type StatusFilterOption } from '../../stores/resultStore';
import { useDebounce } from '../../hooks/useDebounce';
import ResultCard from './ResultCard';
import type { ResultSummary } from '../../types';
import { getMockResultSummary, getMockResult } from '../../utils/mockData';

/** 등급 점수 매핑 (정렬용) */
const GRADE_SCORE: Record<string, number> = {
  A: 6,
  B: 5,
  C: 4,
  D: 3,
  E: 2,
  F: 1,
  Critical: 6,
  High: 5,
  Medium: 4,
  Low: 3,
};

/**
 * 결과 목록 정렬
 */
function sortResults(results: ResultSummary[], sortBy: SortOption): ResultSummary[] {
  const sorted = [...results];
  switch (sortBy) {
    case 'latest':
      return sorted.sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime());
    case 'oldest':
      return sorted.sort((a, b) => new Date(a.analyzedAt).getTime() - new Date(b.analyzedAt).getTime());
    case 'grade-high':
      return sorted.sort((a, b) => (GRADE_SCORE[b.grade] || 0) - (GRADE_SCORE[a.grade] || 0));
    case 'grade-low':
      return sorted.sort((a, b) => (GRADE_SCORE[a.grade] || 0) - (GRADE_SCORE[b.grade] || 0));
    default:
      return sorted;
  }
}

function LNB() {
  const {
    resultList,
    currentResult,
    lnbCollapsed,
    searchQuery,
    sortBy,
    statusFilter,
    isLoading,
    toggleLnb,
    setSearchQuery,
    setSortBy,
    setStatusFilter,
    fetchAllResults,
    switchResult,
  } = useResultStore();

  const [searchInput, setSearchInput] = useState(searchQuery);
  const debouncedSearch = useDebounce(searchInput, 300);

  // Fetch results on mount
  useEffect(() => {
    fetchAllResults();
  }, [fetchAllResults]);

  // Re-fetch when statusFilter changes
  useEffect(() => {
    fetchAllResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  // Update search query when debounced
  useEffect(() => {
    setSearchQuery(debouncedSearch);
  }, [debouncedSearch, setSearchQuery]);

  // Add mock data to result list
  const mockSummary = useMemo(() => getMockResultSummary(), []);
  const allResults = useMemo(() => [...resultList, mockSummary], [resultList, mockSummary]);

  // Filter results by search query (including mock data)
  const filteredResults = useMemo(() => {
    if (!debouncedSearch) return allResults;
    const query = debouncedSearch.toLowerCase();
    return allResults.filter(
      (r) =>
        r.specTitle.toLowerCase().includes(query) ||
        r.grade.toLowerCase().includes(query) ||
        r.analyzedAt.includes(query),
    );
  }, [allResults, debouncedSearch]);

  // Sort filtered results
  const sortedResults = useMemo(() => {
    return sortResults(filteredResults, sortBy);
  }, [filteredResults, sortBy]);

  const handleCardClick = (resultId: string, isDemo?: boolean) => {
    // If demo data, load mock result directly
    if (isDemo) {
      const { setCurrentResult } = useResultStore.getState();
      setCurrentResult(getMockResult());
    } else {
      switchResult(resultId);
    }

    // Auto-scroll to selected card
    setTimeout(() => {
      const cardElement = document.querySelector(`[data-result-id="${resultId}"]`);
      cardElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
  };

  if (lnbCollapsed) {
    return (
      <aside className="fixed left-0 top-16 bottom-0 z-40 flex items-start">
        <button
          onClick={toggleLnb}
          aria-label="목록 펼치기"
          aria-expanded="false"
          className="mt-4 p-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-r-lg transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="fixed left-0 top-16 bottom-0 w-[280px] bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 overflow-hidden z-40 transition-all duration-300 ease-in-out"
      role="navigation"
      aria-label="분석 결과 목록"
    >
      <div className="h-full flex flex-col">
        {/* Toggle button */}
        <div className="flex justify-end px-3 pt-3">
          <button
            onClick={toggleLnb}
            aria-label="목록 접기"
            aria-expanded="true"
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Search bar */}
        <div className="px-3 pb-3" role="search">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="검색 (제목, 등급, 날짜)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  handleClearSearch();
                }
              }}
              className="w-full pl-9 pr-8 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-label="결과 검색"
            />
            {searchInput && (
              <button
                onClick={handleClearSearch}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                aria-label="검색 초기화"
              >
                <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Sort + Status filter controls (TASK-068) */}
        <div className="px-3 pb-3 flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            aria-label="정렬 방식 선택"
            className="flex-1 text-xs px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500"
          >
            <option value="latest">최신순</option>
            <option value="oldest">오래된순</option>
            <option value="grade-high">등급 높은 순</option>
            <option value="grade-low">등급 낮은 순</option>
          </select>

          {/* 상태 필터 드롭다운 (TASK-068) */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilterOption)}
            aria-label="상태 필터"
            data-testid="status-filter-select"
            className="flex-1 text-xs px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">전체</option>
            <option value="active-only">진행중만</option>
            <option value="active-and-on-hold">진행중+보류</option>
          </select>
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : sortedResults.length === 0 ? (
            <div className="text-center py-8">
              {debouncedSearch ? (
                <>
                  <svg className="w-10 h-10 text-gray-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    &quot;{debouncedSearch}&quot; 검색 결과 없음
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    다른 키워드로 시도해보세요
                  </p>
                </>
              ) : (
                <>
                  <svg className="w-10 h-10 text-gray-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    분석 결과가 없습니다
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    먼저 분석을 실행해주세요
                  </p>
                </>
              )}
            </div>
          ) : (
            sortedResults.map((result) => (
              <ResultCard
                key={result.id}
                result={result}
                isSelected={currentResult?.analysisId === result.id}
                onClick={() => handleCardClick(result.id, result.isDemo)}
              />
            ))
          )}
        </div>
      </div>
    </aside>
  );
}

export default LNB;
