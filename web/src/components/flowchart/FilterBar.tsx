/**
 * @module web/components/flowchart/FilterBar
 * @description 플로우차트 필터 바 - FE/BE 토글, 등급 필터, 검색, 확장/축소 제어
 */

import { useFlowStore } from '../../stores/flowStore';
import type { Grade, TaskType, WebRequirement } from '../../types';
import { GRADE_COLORS } from '../../utils/colors';

interface FilterBarProps {
  /** 확장 가능한 모든 노드 ID */
  expandableNodeIds: string[];
  /** 요구사항 목록 (기획서에서 파싱된 요구사항) */
  requirements?: WebRequirement[];
}

const TASK_TYPE_OPTIONS: Array<{ value: 'all' | TaskType; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'FE', label: 'FE' },
  { value: 'BE', label: 'BE' },
];

const GRADE_OPTIONS: Grade[] = ['Low', 'Medium', 'High', 'Critical'];

export default function FilterBar({ expandableNodeIds, requirements }: FilterBarProps) {
  const filter = useFlowStore((s) => s.filter);
  const setFilter = useFlowStore((s) => s.setFilter);
  const toggleGradeFilter = useFlowStore((s) => s.toggleGradeFilter);
  const setRequirementFilter = useFlowStore((s) => s.setRequirementFilter);
  const expandAll = useFlowStore((s) => s.expandAll);
  const collapseAll = useFlowStore((s) => s.collapseAll);

  return (
    <div
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
      {/* FE/BE 토글 칩 */}
      <div style={{ display: 'flex', gap: 4 }} role="group" aria-label="작업 유형 필터">
        {TASK_TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter({ taskTypeFilter: opt.value })}
            aria-label={opt.value === 'all' ? '전체 작업 보기' : `${opt.label} 작업만 보기`}
            aria-pressed={filter.taskTypeFilter === opt.value}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 12,
              border: '1px solid',
              cursor: 'pointer',
              transition: 'all 0.15s',
              ...(filter.taskTypeFilter === opt.value
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
            {opt.label}
          </button>
        ))}
      </div>

      {/* 구분선 */}
      <div style={{ width: 1, height: 24, background: '#E2E8F0' }} />

      {/* 등급 멀티셀렉트 칩 */}
      <div style={{ display: 'flex', gap: 4 }} role="group" aria-label="등급 필터">
        {GRADE_OPTIONS.map((grade) => {
          const colors = GRADE_COLORS[grade];
          const isActive = filter.gradeFilter.includes(grade);
          return (
            <button
              key={grade}
              onClick={() => toggleGradeFilter(grade)}
              aria-label={`${grade} 등급 필터`}
              aria-pressed={isActive}
              style={{
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 12,
                border: `1px solid ${colors.border}`,
                cursor: 'pointer',
                transition: 'all 0.15s',
                background: isActive ? colors.bg : 'white',
                color: isActive ? colors.text : '#94A3B8',
                opacity: isActive ? 1 : 0.5,
              }}
            >
              {grade}
            </button>
          );
        })}
      </div>

      {/* 구분선 */}
      <div style={{ width: 1, height: 24, background: '#E2E8F0' }} />

      {/* 검색 입력 */}
      <input
        type="text"
        role="search"
        aria-label="검색"
        placeholder="노드 이름/파일 경로 검색..."
        value={filter.searchQuery}
        onChange={(e) => setFilter({ searchQuery: e.target.value })}
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

      {/* 요구사항 필터 드롭다운 */}
      {requirements && requirements.length > 0 && (
        <>
          <div style={{ width: 1, height: 24, background: '#E2E8F0' }} />
          <select
            aria-label="요구사항 필터"
            value={filter.requirementFilter ?? ''}
            onChange={(e) =>
              setRequirementFilter(e.target.value === '' ? null : e.target.value)
            }
            style={{
              padding: '4px 8px',
              fontSize: 12,
              border: '1px solid #CBD5E1',
              borderRadius: 6,
              outline: 'none',
              color: filter.requirementFilter ? '#334155' : '#94A3B8',
              background: filter.requirementFilter ? '#EFF6FF' : 'white',
              cursor: 'pointer',
              maxWidth: 200,
            }}
          >
            <option value="">전체 요구사항</option>
            {requirements.map((req) => (
              <option key={req.id} value={req.id}>
                {req.id}: {req.name}
              </option>
            ))}
          </select>
        </>
      )}

      {/* 구분선 */}
      <div style={{ width: 1, height: 24, background: '#E2E8F0' }} />

      {/* 확장/축소 버튼 */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={() => expandAll(expandableNodeIds)}
          aria-label="모든 노드 펼치기"
          style={{
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 6,
            border: '1px solid #CBD5E1',
            background: '#F8FAFC',
            color: '#475569',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
        >
          모두 펼치기
        </button>
        <button
          onClick={collapseAll}
          aria-label="모든 노드 접기"
          style={{
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 6,
            border: '1px solid #CBD5E1',
            background: '#F8FAFC',
            color: '#475569',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
        >
          모두 접기
        </button>
      </div>
    </div>
  );
}
