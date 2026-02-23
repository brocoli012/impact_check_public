/**
 * @module web/components/projects/GapHealthWidget
 * @description TASK-170: Gap Health 위젯 - 누락 현황 KPI 카드 + 상세 보기
 */

import { useState } from 'react';
import type { GapCheckResult } from '../../types';
import GapDetailList from './GapDetailList';

interface GapHealthWidgetProps {
  /** 갭 탐지 결과 (null이면 숨김) */
  data: GapCheckResult | null;
  /** 로딩 상태 */
  loading?: boolean;
}

export default function GapHealthWidget({ data, loading }: GapHealthWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 로딩 상태: 스켈레톤
  if (loading) {
    return (
      <div
        className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse"
        data-testid="gap-widget-skeleton"
      >
        <div className="flex gap-4">
          <div className="h-16 w-24 bg-gray-200 rounded" />
          <div className="h-16 w-24 bg-gray-200 rounded" />
          <div className="h-16 w-24 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  // 데이터 없거나 summary가 없으면 위젯 숨김
  if (!data || !data.summary) {
    return null;
  }

  const { gaps, summary } = data;

  // 누락 0건: 축소 상태
  if (summary.total === 0) {
    return (
      <div
        className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-2"
        data-testid="gap-widget-healthy"
        role="status"
        aria-label="갭 상태: 건강한 상태 - 누락 항목 없음"
      >
        <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-sm text-green-700 font-medium">건강한 상태</span>
        <span className="text-xs text-green-500 ml-1">- 누락 항목이 없습니다</span>
      </div>
    );
  }

  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-4"
      data-testid="gap-widget"
      role="region"
      aria-label={`갭 탐지 결과: ${summary.total}개 누락 발견`}
    >
      {/* KPI 카드 행 */}
      <div className="flex items-center gap-3 mb-3">
        {/* HIGH 카드 */}
        <div
          className="flex-1 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center"
          data-testid="gap-kpi-high"
        >
          <div className="text-lg font-bold text-red-600">{summary.high}</div>
          <div className="text-[10px] text-red-500 font-medium">HIGH</div>
        </div>

        {/* MEDIUM 카드 */}
        <div
          className="flex-1 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-center"
          data-testid="gap-kpi-medium"
        >
          <div className="text-lg font-bold text-orange-600">{summary.medium}</div>
          <div className="text-[10px] text-orange-500 font-medium">MEDIUM</div>
        </div>

        {/* LOW 카드 */}
        <div
          className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-center"
          data-testid="gap-kpi-low"
        >
          <div className="text-lg font-bold text-gray-600">{summary.low}</div>
          <div className="text-[10px] text-gray-500 font-medium">LOW</div>
        </div>
      </div>

      {/* 요약 + 상세 보기 토글 */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-600" data-testid="gap-summary-text">
          {summary.total}개 누락 발견 ({summary.fixable}개 수정 가능)
        </p>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-purple-600 hover:text-purple-800 font-medium"
          data-testid="gap-toggle-detail"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? '갭 상세 목록 접기' : '갭 상세 목록 펼치기'}
        >
          {isExpanded ? '접기' : '상세 보기'}
        </button>
      </div>

      {/* 상세 목록 (펼침 상태) */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-gray-100" data-testid="gap-detail-section" aria-live="polite">
          <GapDetailList gaps={gaps} />
        </div>
      )}
    </div>
  );
}
