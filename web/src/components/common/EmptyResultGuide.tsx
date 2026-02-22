/**
 * @module web/components/common/EmptyResultGuide
 * @description 기획서 미선택 시 안내 표시 공통 컴포넌트 (REQ-014, TASK-117)
 *
 * 사용 예:
 *   <EmptyResultGuide />
 *   <EmptyResultGuide title="분석 결과를 선택해주세요" icon="chart" />
 */

interface EmptyResultGuideProps {
  /** 주 메시지 (기본: "좌측 목록에서 기획서를 선택해주세요.") */
  title?: string;
  /** 보조 메시지 (기본: "기획서를 선택하면 분석 결과를 확인할 수 있습니다.") */
  description?: string;
  /** 아이콘 종류 (기본: 'document') */
  icon?: 'document' | 'chart' | 'checklist';
}

/** 아이콘 SVG 매핑 */
function IconSvg({ type }: { type: 'document' | 'chart' | 'checklist' }) {
  const className = 'w-12 h-12 text-gray-300';

  switch (type) {
    case 'chart':
      return (
        <svg
          className={className}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
          data-testid="icon-chart"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 13h2v8H3v-8zm6-4h2v12H9V9zm6-6h2v18h-2V3z"
          />
        </svg>
      );
    case 'checklist':
      return (
        <svg
          className={className}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
          data-testid="icon-checklist"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      );
    case 'document':
    default:
      return (
        <svg
          className={className}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
          data-testid="icon-document"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      );
  }
}

export default function EmptyResultGuide({
  title = '좌측 목록에서 기획서를 선택해주세요.',
  description = '기획서를 선택하면 분석 결과를 확인할 수 있습니다.',
  icon = 'document',
}: EmptyResultGuideProps) {
  return (
    <div
      className="min-h-[400px] flex items-center justify-center"
      data-testid="empty-result-guide"
    >
      <div className="text-center">
        <IconSvg type={icon} />
        <p className="text-base text-gray-500 mt-4">{title}</p>
        {description && (
          <p className="text-sm text-gray-400 mt-2">{description}</p>
        )}
      </div>
    </div>
  );
}
