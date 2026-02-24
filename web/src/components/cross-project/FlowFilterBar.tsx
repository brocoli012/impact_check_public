/**
 * @module web/components/cross-project/FlowFilterBar
 * @description TASK-109: 크로스 프로젝트 플로우 다이어그램 필터 바
 * 그룹 필터(칩 토글) + 프로젝트 검색
 */

import type { ProjectGroup } from './CrossProjectSummary';

export interface FlowFilterBarProps {
  groups: ProjectGroup[];
  selectedGroup: string | null;
  onGroupChange: (groupId: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

function FlowFilterBar({
  groups,
  selectedGroup,
  onGroupChange,
  searchQuery,
  onSearchChange,
}: FlowFilterBarProps) {
  return (
    <div
      data-testid="flow-filter-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        background: 'white',
        borderRadius: 8,
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        flexWrap: 'wrap',
      }}
    >
      {/* 그룹 칩 토글 */}
      <div style={{ display: 'flex', gap: 4 }} role="group" aria-label="그룹 필터">
        <button
          onClick={() => onGroupChange(null)}
          aria-pressed={selectedGroup === null}
          style={{
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 12,
            border: '1px solid',
            cursor: 'pointer',
            transition: 'all 0.15s',
            ...(selectedGroup === null
              ? {
                  background: '#3B82F6',
                  color: 'white',
                  borderColor: '#3B82F6',
                }
              : {
                  background: 'white',
                  color: '#64748B',
                  borderColor: '#CBD5E1',
                }),
          }}
        >
          전체
        </button>
        {groups.map((group) => (
          <button
            key={group.name}
            onClick={() => onGroupChange(group.name === selectedGroup ? null : group.name)}
            aria-pressed={selectedGroup === group.name}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 12,
              border: '1px solid',
              cursor: 'pointer',
              transition: 'all 0.15s',
              ...(selectedGroup === group.name
                ? {
                    background: '#3B82F6',
                    color: 'white',
                    borderColor: '#3B82F6',
                  }
                : {
                    background: 'white',
                    color: '#64748B',
                    borderColor: '#CBD5E1',
                  }),
            }}
          >
            {group.name}
          </button>
        ))}
      </div>

      {/* 구분선 */}
      <div style={{ width: 1, height: 24, background: '#E2E8F0' }} />

      {/* 검색 입력 */}
      <input
        type="text"
        role="search"
        aria-label="프로젝트 검색"
        placeholder="프로젝트명/ID 검색..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        style={{
          padding: '4px 10px',
          fontSize: 12,
          border: '1px solid #CBD5E1',
          borderRadius: 6,
          outline: 'none',
          width: 180,
          color: '#334155',
        }}
      />
    </div>
  );
}

export default FlowFilterBar;
