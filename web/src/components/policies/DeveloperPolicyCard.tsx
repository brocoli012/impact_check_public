import type { Policy } from '../../types';

interface DeveloperPolicyCardProps {
  policy: Policy;
  isSelected: boolean;
  onClick: () => void;
}

const DEV_CATEGORY_COLORS: Record<string, string> = {
  '변수': 'bg-cyan-100 text-cyan-700',
  '프로세스': 'bg-blue-100 text-blue-700',
  '연결관계': 'bg-violet-100 text-violet-700',
  '트랜잭션': 'bg-amber-100 text-amber-700',
  '에러': 'bg-red-100 text-red-700',
};

function getDevCategoryColor(category: string): string {
  for (const [key, color] of Object.entries(DEV_CATEGORY_COLORS)) {
    if (category.includes(key)) return color;
  }
  return 'bg-gray-100 text-gray-700';
}

function DeveloperPolicyCard({ policy, isSelected, onClick }: DeveloperPolicyCardProps) {
  const description = policy.developerDescription || policy.description;
  const sourceFile = policy.affectedFiles?.[0];

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
      data-testid={`developer-policy-card-${policy.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 flex-1 min-w-0 truncate">
          {policy.name}
        </h3>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium shrink-0 ${getDevCategoryColor(policy.category)}`}
        >
          {policy.category}
        </span>
      </div>

      <p className="mt-2 text-xs text-gray-600 leading-relaxed line-clamp-2">
        {description}
      </p>

      <div className="mt-3 space-y-1">
        {sourceFile && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <span className="truncate font-mono text-[11px]">{sourceFile}</span>
          </div>
        )}
        {policy.relatedFunction && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="font-mono text-[11px]">{policy.relatedFunction}</span>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-600">
          개발자 관점
        </span>
        <span className="text-xs text-gray-400">
          신뢰도 {Math.round(policy.confidence * 100)}%
        </span>
      </div>
    </div>
  );
}

export default DeveloperPolicyCard;
