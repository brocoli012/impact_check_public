/**
 * @module web/components/checklist/CategoryGroup
 * @description 체크리스트 카테고리 그룹 (접기/펼치기 가능한 섹션)
 */

import { useState } from 'react';
import type { Check } from '../../types';
import CheckItem from './CheckItem';

interface CategoryGroupProps {
  /** 카테고리 제목 */
  title: string;
  /** 카테고리에 속한 체크 항목 */
  checks: Check[];
  /** 체크된 항목 ID 집합 */
  checkedIds: Set<string>;
  /** 체크 토글 핸들러 */
  onToggle: (checkId: string) => void;
  /** 기본 열림 상태 */
  defaultOpen?: boolean;
}

function CategoryGroup({
  title,
  checks,
  checkedIds,
  onToggle,
  defaultOpen = true,
}: CategoryGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const completedCount = checks.filter((c) => checkedIds.has(c.id)).length;
  const totalCount = checks.length;
  const allCompleted = completedCount === totalCount && totalCount > 0;

  if (totalCount === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={isOpen ? `${title} 섹션 접기` : `${title} 섹션 펼치기`}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {/* Chevron */}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>

          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>

        {/* Count badge */}
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            allCompleted
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {completedCount} / {totalCount}
        </span>
      </button>

      {/* Items */}
      {isOpen && (
        <div className="px-4 pb-3 space-y-2">
          {checks.map((check) => (
            <CheckItem
              key={check.id}
              check={check}
              isChecked={checkedIds.has(check.id)}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CategoryGroup;
