import type { Policy } from '../../types';

interface PlannerPolicyCardProps {
  policy: Policy;
  isSelected: boolean;
  onClick: () => void;
}

const PLANNER_CATEGORY_COLORS: Record<string, string> = {
  '권한': 'bg-red-100 text-red-700',
  '프로세스': 'bg-blue-100 text-blue-700',
  '동작': 'bg-green-100 text-green-700',
  '벨리데이션': 'bg-yellow-100 text-yellow-700',
  '예외': 'bg-orange-100 text-orange-700',
};

function getPlannerCategoryColor(category: string): string {
  for (const [key, color] of Object.entries(PLANNER_CATEGORY_COLORS)) {
    if (category.includes(key)) return color;
  }
  return 'bg-gray-100 text-gray-700';
}

function PlannerPolicyCard({ policy, isSelected, onClick }: PlannerPolicyCardProps) {
  const description = policy.plannerDescription || policy.description;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`bg-white rounded-lg border p-4 cursor-pointer transition-all hover:shadow-md ${
        isSelected
          ? 'border-purple-500 ring-2 ring-purple-200'
          : 'border-gray-200'
      }`}
      data-testid={`planner-policy-card-${policy.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 flex-1 min-w-0 truncate">
          {policy.name}
        </h3>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium shrink-0 ${getPlannerCategoryColor(policy.category)}`}
        >
          {policy.category}
        </span>
      </div>

      <p className="mt-2 text-xs text-gray-600 leading-relaxed line-clamp-2">
        {description}
      </p>

      <div className="mt-3 flex items-center gap-3 flex-wrap">
        {policy.relatedScreen && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {policy.relatedScreen}
          </span>
        )}
        {policy.relatedFunction && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {policy.relatedFunction}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600">
          기획자 관점
        </span>
        <span className="text-xs text-gray-400">
          신뢰도 {Math.round(policy.confidence * 100)}%
        </span>
      </div>
    </div>
  );
}

export default PlannerPolicyCard;
