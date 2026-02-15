/**
 * @module web/components/checklist/CheckItem
 * @description 체크리스트 개별 항목 컴포넌트
 */

import type { Check } from '../../types';

/** 긴급도별 색상 */
const URGENCY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-red-100', text: 'text-red-700', label: '높음' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '보통' },
  low: { bg: 'bg-green-100', text: 'text-green-700', label: '낮음' },
};

interface CheckItemProps {
  /** 체크 항목 데이터 */
  check: Check;
  /** 체크 여부 */
  isChecked: boolean;
  /** 체크 토글 핸들러 */
  onToggle: (checkId: string) => void;
}

function CheckItem({ check, isChecked, onToggle }: CheckItemProps) {
  const urgencyStyle = URGENCY_STYLES[check.priority] ?? URGENCY_STYLES.medium;

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
        isChecked
          ? 'bg-gray-50 border-gray-200'
          : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Checkbox */}
      <label className="flex items-center cursor-pointer mt-0.5">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => onToggle(check.id)}
          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
        />
      </label>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm leading-relaxed ${
            isChecked ? 'text-gray-400 line-through' : 'text-gray-800'
          }`}
        >
          {check.content}
        </p>
        {check.relatedFeatureId && (
          <p className="text-xs text-gray-400 mt-1">
            관련: {check.relatedFeatureId}
          </p>
        )}
      </div>

      {/* Priority badge */}
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${urgencyStyle.bg} ${urgencyStyle.text}`}
      >
        {urgencyStyle.label}
      </span>
    </div>
  );
}

export default CheckItem;
