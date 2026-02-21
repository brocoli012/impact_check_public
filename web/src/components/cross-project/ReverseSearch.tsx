/**
 * @module web/components/cross-project/ReverseSearch
 * @description 역추적 검색 UI - 테이블/이벤트 키워드 검색 및 결과 표시
 * Phase D: TASK-110
 */

import { useState, useCallback } from 'react';
import { useSharedEntityStore, type TableReference, type EventReference } from '../../stores/sharedEntityStore';

function ReverseSearch() {
  const [query, setQuery] = useState('');
  const { searchResult, isLoading, error, searchReverse, clearSearch } = useSharedEntityStore();

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    await searchReverse(query);
  }, [query, searchReverse]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  const handleClear = useCallback(() => {
    setQuery('');
    clearSearch();
  }, [clearSearch]);

  return (
    <div data-testid="reverse-search" className="space-y-4">
      {/* 검색 입력 */}
      <div className="flex gap-2">
        <input
          type="text"
          data-testid="reverse-search-input"
          placeholder="테이블명 또는 이벤트명 검색..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          data-testid="reverse-search-btn"
          onClick={handleSearch}
          disabled={isLoading || !query.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '검색 중...' : '검색'}
        </button>
        {searchResult && (
          <button
            data-testid="reverse-search-clear"
            onClick={handleClear}
            className="px-3 py-2 text-sm text-gray-500 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            초기화
          </button>
        )}
      </div>

      {/* 에러 표시 */}
      {error && (
        <div data-testid="reverse-search-error" className="text-sm text-red-500 bg-red-50 rounded-md p-3">
          {error}
        </div>
      )}

      {/* 검색 결과 */}
      {searchResult && (
        <div data-testid="reverse-search-results" className="space-y-4">
          {/* 테이블 결과 */}
          {searchResult.totalTables > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 mb-2">
                테이블 ({searchResult.totalTables}건)
              </h4>
              <div className="space-y-2">
                {searchResult.tables.map((t) => (
                  <div
                    key={t.name}
                    data-testid={`table-result-${t.name}`}
                    className="bg-blue-50 rounded-md p-3 border border-blue-100"
                  >
                    <div className="text-sm font-semibold text-blue-800">{t.name}</div>
                    <div className="mt-1 space-y-1">
                      {t.refs.map((ref: TableReference, idx: number) => (
                        <div key={idx} className="text-xs text-gray-600 flex items-center gap-2">
                          <span className="font-medium text-blue-600">[{ref.projectId}]</span>
                          <span>{ref.entityName}</span>
                          <span className="text-gray-400">{ref.filePath}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 이벤트 결과 */}
          {searchResult.totalEvents > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 mb-2">
                이벤트 ({searchResult.totalEvents}건)
              </h4>
              <div className="space-y-2">
                {searchResult.events.map((e) => (
                  <div
                    key={e.name}
                    data-testid={`event-result-${e.name}`}
                    className="bg-red-50 rounded-md p-3 border border-red-100"
                  >
                    <div className="text-sm font-semibold text-red-800">{e.name}</div>
                    <div className="mt-1 space-y-1">
                      {e.refs.map((ref: EventReference, idx: number) => (
                        <div key={idx} className="text-xs text-gray-600 flex items-center gap-2">
                          <span className={`font-medium ${ref.role === 'publisher' ? 'text-red-600' : 'text-pink-600'}`}>
                            [{ref.projectId}]
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${ref.role === 'publisher' ? 'bg-red-100 text-red-700' : 'bg-pink-100 text-pink-700'}`}>
                            {ref.role === 'publisher' ? 'PUB' : 'SUB'}
                          </span>
                          <span>{ref.handler}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 결과 없음 */}
          {searchResult.totalTables === 0 && searchResult.totalEvents === 0 && (
            <div data-testid="reverse-search-no-results" className="text-sm text-gray-400 text-center py-4">
              &apos;{searchResult.query}&apos;에 해당하는 테이블/이벤트가 없습니다
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ReverseSearch;
