/**
 * @module web/components/policies/PolicyFilter
 * @description 정책 필터 바 - 검색 + 소스 필터 + 카테고리 필터 + 결과 수 표시
 */

import { useState, useEffect } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { usePolicyStore } from '../../stores/policyStore';
import type { WebRequirement, Task } from '../../types';

interface PolicyFilterProps {
  /** 필터 결과 수 */
  resultCount: number;
  /** 전체 정책 수 */
  totalCount: number;
  /** 요구사항 목록 (요구사항 필터 드롭다운용) */
  requirements?: WebRequirement[];
  /** 작업 목록 (요구사항->작업 매핑용) */
  tasks?: Task[];
}

/** 소스 필터 탭 정의 */
const SOURCE_TABS = [
  { value: null, label: '전체' },
  { value: 'comment', label: '코드 주석' },
  { value: 'readme', label: '문서' },
  { value: 'manual', label: '수동 입력' },
  { value: 'annotation', label: 'AI 추론' },
] as const;

function PolicyFilter({ resultCount, totalCount, requirements, tasks }: PolicyFilterProps) {
  const {
    categories,
    searchQuery,
    selectedCategory,
    selectedSource,
    selectedRequirement,
    setSearchQuery,
    setSelectedCategory,
    setSelectedSource,
    setSelectedRequirement,
  } = usePolicyStore();

  const [searchInput, setSearchInput] = useState(searchQuery);
  const debouncedSearch = useDebounce(searchInput, 300);

  // 디바운싱된 검색어를 스토어에 반영
  useEffect(() => {
    setSearchQuery(debouncedSearch);
  }, [debouncedSearch, setSearchQuery]);

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Search input */}
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="정책명, 설명 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  handleClearSearch();
                }
              }}
              className="w-full pl-9 pr-8 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              aria-label="정책 검색"
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

        {/* Requirement filter */}
        {requirements && requirements.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 mr-1">요구사항:</span>
            <select
              value={selectedRequirement ?? ''}
              onChange={(e) => setSelectedRequirement(e.target.value || null)}
              className="px-2 py-1 rounded border border-gray-200 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              aria-label="요구사항 필터"
            >
              <option value="">전체 요구사항</option>
              {requirements.map((req) => (
                <option key={req.id} value={req.id}>
                  {req.id}: {req.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Result count */}
        <div className="text-xs text-gray-500">
          <span data-testid="result-count">
            {resultCount} / {totalCount}건
          </span>
        </div>
      </div>

      {/* Source filter tabs + Category filter */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Source filter */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 mr-1">출처:</span>
          {SOURCE_TABS.map((tab) => (
            <button
              key={tab.label}
              onClick={() => setSelectedSource(tab.value)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                selectedSource === tab.value
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              data-testid={`source-filter-${tab.value || 'all'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 mr-1">카테고리:</span>
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              selectedCategory === null
                ? 'bg-purple-100 text-purple-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            전체
          </button>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                selectedCategory === category
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PolicyFilter;
