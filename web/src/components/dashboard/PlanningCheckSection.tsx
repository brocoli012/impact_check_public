/**
 * @module web/components/dashboard/PlanningCheckSection
 * @description 추가 확인 사항 독립 섹션 - 우선순위별 그룹핑 + 체크 토글
 */

import { useMemo } from 'react';
import { useChecklist } from '../../hooks/useChecklist';
import type { Check } from '../../types';

const PRIORITY_ORDER = ['high', 'medium', 'low'] as const;

const PRIORITY_LABELS: Record<string, string> = {
  high: '높음',
  medium: '보통',
  low: '낮음',
};

const PRIORITY_STYLES: Record<string, { badge: string; border: string }> = {
  high: { badge: 'bg-red-100 text-red-700', border: 'border-l-red-400' },
  medium: { badge: 'bg-yellow-100 text-yellow-700', border: 'border-l-yellow-400' },
  low: { badge: 'bg-green-100 text-green-700', border: 'border-l-green-400' },
};

function PlanningCheckSection() {
  const { checks, checkedIds, toggleCheck, completedCount, totalCount } = useChecklist();

  const grouped = useMemo(() => {
    const map: Record<string, Check[]> = { high: [], medium: [], low: [] };
    for (const check of checks) {
      const key = check.priority in map ? check.priority : 'low';
      map[key].push(check);
    }
    return map;
  }, [checks]);

  if (totalCount === 0) return null;

  return (
    <div
      id="section-checks"
      className="bg-white rounded-lg border border-gray-200 p-5"
      data-testid="planning-check-section"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-900">추가 확인 사항</h3>
        <span className="text-xs text-gray-500">
          {completedCount}/{totalCount} 완료
        </span>
      </div>

      <div className="space-y-4">
        {PRIORITY_ORDER.map((priority) => {
          const items = grouped[priority];
          if (items.length === 0) return null;
          const style = PRIORITY_STYLES[priority];

          return (
            <div key={priority} data-testid={`check-group-${priority}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${style.badge}`}>
                  {PRIORITY_LABELS[priority]}
                </span>
                <span className="text-xs text-gray-400">{items.length}건</span>
              </div>
              <div className="space-y-1.5">
                {items.map((check) => {
                  const isChecked = checkedIds.has(check.id);
                  return (
                    <label
                      key={check.id}
                      className={`flex items-start gap-3 p-3 rounded-md border-l-4 cursor-pointer transition-colors ${style.border} ${
                        isChecked ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'
                      }`}
                      data-testid={`check-item-${check.id}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCheck(check.id)}
                        className="mt-0.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        data-testid={`check-toggle-${check.id}`}
                      />
                      <span className={`text-sm ${isChecked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                        {check.content}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PlanningCheckSection;
