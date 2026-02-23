/**
 * @module web/components/dashboard/SupplementBanner
 * @description TASK-176: 보완 분석 결과 배너
 * 보완 분석 결과인 경우 대시보드 상단에 표시되는 안내 배너
 */

interface SupplementBannerProps {
  /** 원본 분석 ID */
  supplementOf: string;
  /** 보완 분석을 트리거한 프로젝트명 */
  triggerProject: string;
  /** 원본 분석 클릭 핸들러 */
  onOriginalClick?: (analysisId: string) => void;
}

function SupplementBanner({ supplementOf, triggerProject, onOriginalClick }: SupplementBannerProps) {
  return (
    <div
      data-testid="supplement-banner"
      className="bg-violet-50 border border-violet-200 rounded-lg p-3 flex items-center gap-2"
      role="status"
      aria-live="polite"
      aria-label="보완 분석 안내"
    >
      <svg
        className="w-5 h-5 text-violet-500 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
      <span className="text-sm text-violet-700">
        이 분석은 <strong>{triggerProject}</strong> 프로젝트 추가로 인한 보완 분석입니다.
        {onOriginalClick ? (
          <>
            {' '}원본 분석:{' '}
            <button
              data-testid="supplement-original-link"
              onClick={() => onOriginalClick(supplementOf)}
              className="underline font-medium hover:text-violet-900 focus:outline-none focus:ring-2 focus:ring-violet-400 rounded"
            >
              {supplementOf}
            </button>
          </>
        ) : (
          <> 원본 분석: <span className="font-medium">{supplementOf}</span></>
        )}
      </span>
    </div>
  );
}

export default SupplementBanner;
