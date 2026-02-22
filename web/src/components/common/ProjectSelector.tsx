/**
 * @module web/components/common/ProjectSelector
 * @description 프로젝트 선택 공통 드롭다운 컴포넌트 (REQ-014, TASK-116)
 *
 * 변형 A (기본): 개별 프로젝트만 표시
 *   <ProjectSelector />
 *
 * 변형 B (includeAll): "전체" 옵션 포함 (플로우차트 등 크로스 프로젝트용)
 *   <ProjectSelector includeAll onAllSelected={handleAllValidation} />
 */

import { useCallback } from 'react';
import { useProjectSelector } from '../../hooks/useProjectSelector';

interface ProjectSelectorProps {
  /** "전체" 옵션 포함 여부 (기본 false) */
  includeAll?: boolean;
  /** "전체" 선택 시 유효성 검증 콜백, false 반환 시 선택 취소 */
  onAllSelected?: () => boolean;
  /** 현재 "전체"가 선택된 상태인지 (드롭다운 값 제어용) */
  selectedAll?: boolean;
  /** 개별 프로젝트가 선택되었을 때 콜백 */
  onProjectSelected?: () => void;
  /** 추가 CSS 클래스 */
  className?: string;
}

/** "전체" 옵션 값 */
const ALL_VALUE = '__all__';

export default function ProjectSelector({
  includeAll = false,
  onAllSelected,
  selectedAll = false,
  onProjectSelected,
  className = '',
}: ProjectSelectorProps) {
  const { projects, activeProjectId, switchProject, isLoading } = useProjectSelector();

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;

      if (value === ALL_VALUE) {
        // "전체" 선택 시 유효성 검증
        if (onAllSelected) {
          const isValid = onAllSelected();
          if (!isValid) {
            // 선택 취소: 이전 값으로 복원 (React가 re-render로 처리)
            return;
          }
        }
        return;
      }

      // 개별 프로젝트 선택 시 콜백
      if (onProjectSelected) {
        onProjectSelected();
      }

      if (!value || value === activeProjectId) return;
      await switchProject(value);
    },
    [activeProjectId, switchProject, onAllSelected, onProjectSelected],
  );

  // "전체" 선택 상태면 ALL_VALUE, 아니면 activeProjectId
  const selectValue = selectedAll ? ALL_VALUE : (activeProjectId || '');

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label
        htmlFor="project-selector-common"
        className="text-sm text-gray-500"
      >
        프로젝트
      </label>
      <select
        id="project-selector-common"
        data-testid="project-selector-common"
        value={selectValue}
        onChange={handleChange}
        disabled={isLoading}
        className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white text-gray-700 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="프로젝트 선택"
      >
        <option value="" disabled>
          프로젝트 선택
        </option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
        {includeAll && (
          <optgroup label="---">
            <option value={ALL_VALUE}>전체</option>
          </optgroup>
        )}
      </select>
    </div>
  );
}
