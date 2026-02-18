/**
 * @module web/components/policies/PolicyCard
 * @description 정책 카드 컴포넌트 - 정책명, 카테고리, 설명, 신뢰도 표시
 */

import type { Policy } from '../../types';

interface PolicyCardProps {
  /** 정책 데이터 */
  policy: Policy;
  /** 선택 여부 */
  isSelected: boolean;
  /** 클릭 핸들러 */
  onClick: () => void;
}

/** confidence 값에 따른 색상 */
function getConfidenceColor(confidence: number): {
  bg: string;
  text: string;
  label: string;
} {
  if (confidence >= 0.7) {
    return { bg: 'bg-green-100', text: 'text-green-700', label: '높음' };
  }
  if (confidence >= 0.4) {
    return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '보통' };
  }
  return { bg: 'bg-red-100', text: 'text-red-700', label: '낮음' };
}

/** 카테고리 배지 색상 */
const CATEGORY_COLORS: Record<string, string> = {
  '배송': 'bg-blue-100 text-blue-700',
  '결제': 'bg-green-100 text-green-700',
  '주문': 'bg-orange-100 text-orange-700',
  '장바구니': 'bg-purple-100 text-purple-700',
  '회원': 'bg-pink-100 text-pink-700',
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? 'bg-gray-100 text-gray-700';
}

function PolicyCard({ policy, isSelected, onClick }: PolicyCardProps) {
  const confidenceColor = getConfidenceColor(policy.confidence);
  const confidencePercent = Math.round(policy.confidence * 100);

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
      data-testid={`policy-card-${policy.id}`}
    >
      {/* Header: Policy name + Category badge */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 flex-1 min-w-0 truncate">
          {policy.name}
        </h3>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium shrink-0 ${getCategoryColor(policy.category)}`}
        >
          {policy.category}
        </span>
      </div>

      {/* Description */}
      <p className="mt-2 text-xs text-gray-600 leading-relaxed line-clamp-2">
        {policy.description}
      </p>

      {/* Footer: Confidence + File count */}
      <div className="mt-3 flex items-center justify-between">
        {/* Confidence badge */}
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${confidenceColor.bg} ${confidenceColor.text}`}
          data-testid="confidence-badge"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {confidencePercent}% ({confidenceColor.label})
        </span>

        {/* Affected files count */}
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          파일 {(policy.affectedFiles || []).length}개
        </span>
      </div>
    </div>
  );
}

export default PolicyCard;
