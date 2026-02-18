/**
 * @module web/components/dashboard/KpiCards
 * @description KPI 카드 컴포넌트 - 분석 결과 핵심 지표를 카드 형태로 표시
 * 각 카드 클릭 시 해당 상세 페이지로 네비게이션 + 방문 기록(markPageVisited) 저장
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AnalysisResult } from '../../types';
import { useResultStore } from '../../stores/resultStore';
import { markPageVisited } from '../../utils/visitedPages';

interface KpiCardsProps {
  result: AnalysisResult;
}

/** 긴급도 뱃지 유형 */
type UrgencyBadge = 'critical' | 'warning' | 'high-priority' | null;

interface KpiCardData {
  label: string;
  value: number;
  subtitle?: string;
  color: string;
  route: string;
  urgencyBadge: UrgencyBadge;
}

/**
 * 정책 경고의 긴급도 뱃지를 결정한다.
 * - severity에 'critical'이 하나라도 있으면 → 'critical' (빨간 점 + pulse)
 * - 'warning'만 있으면 → 'warning' (주황 점)
 * - 그 외 → null
 */
function getPolicyUrgencyBadge(result: AnalysisResult): UrgencyBadge {
  const hasCritical = result.policyWarnings.some((w) => w.severity === 'critical');
  if (hasCritical) return 'critical';
  const hasWarning = result.policyWarnings.some((w) => w.severity === 'warning');
  if (hasWarning) return 'warning';
  return null;
}

/**
 * 기획 확인의 긴급도 뱃지를 결정한다.
 * - priority에 'high'가 하나라도 있으면 → 'high-priority' (노란 점)
 * - 그 외 → null
 */
function getCheckUrgencyBadge(result: AnalysisResult): UrgencyBadge {
  const hasHigh = result.planningChecks.some((c) => c.priority === 'high');
  if (hasHigh) return 'high-priority';
  return null;
}

/**
 * 긴급도 뱃지 렌더링
 */
function UrgencyDot({ badge }: { badge: UrgencyBadge }) {
  if (!badge) return null;

  if (badge === 'critical') {
    return (
      <span
        data-testid="urgency-badge-critical"
        className="absolute -top-1 -right-1 flex h-3 w-3"
      >
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
      </span>
    );
  }

  if (badge === 'warning') {
    return (
      <span
        data-testid="urgency-badge-warning"
        className="absolute -top-1 -right-1 inline-flex h-3 w-3 rounded-full bg-orange-400"
      />
    );
  }

  if (badge === 'high-priority') {
    return (
      <span
        data-testid="urgency-badge-high-priority"
        className="absolute -top-1 -right-1 inline-flex h-3 w-3 rounded-full bg-yellow-400"
      />
    );
  }

  return null;
}

function KpiCards({ result }: KpiCardsProps) {
  const navigate = useNavigate();
  const currentResult = useResultStore((s) => s.currentResult);
  const analysisId = currentResult?.analysisId ?? '';

  const feTasks = result.tasks.filter((t) => t.type === 'FE').length;
  const beTasks = result.tasks.filter((t) => t.type === 'BE').length;

  const cards: KpiCardData[] = [
    {
      label: '영향 화면',
      value: result.affectedScreens.length,
      subtitle: '개 화면',
      color: '#6366F1',
      route: '/flow',
      urgencyBadge: null,
    },
    {
      label: '총 작업',
      value: result.tasks.length,
      subtitle: `FE ${feTasks} / BE ${beTasks}`,
      color: '#3B82F6',
      route: '/tickets',
      urgencyBadge: null,
    },
    {
      label: '기획 확인',
      value: result.planningChecks.length,
      subtitle: '건',
      color: '#F59E0B',
      route: '/checklist',
      urgencyBadge: getCheckUrgencyBadge(result),
    },
    {
      label: '정책 경고',
      value: result.policyWarnings.length,
      subtitle: '건',
      color: '#EF4444',
      route: '/policies',
      urgencyBadge: getPolicyUrgencyBadge(result),
    },
    {
      label: '확인 요청',
      value: result.ownerNotifications.length,
      subtitle: '명',
      color: '#8B5CF6',
      route: '/owners',
      urgencyBadge: null,
    },
  ];

  const handleCardClick = useCallback(
    (route: string) => {
      markPageVisited(analysisId, route);
      navigate(route);
    },
    [analysisId, navigate],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, route: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCardClick(route);
      }
    },
    [handleCardClick],
  );

  return (
    <div className="grid grid-cols-5 gap-4">
      {cards.map((card) => {
        const isZero = card.value === 0;
        const baseClasses =
          'relative bg-white rounded-lg border border-gray-200 p-4 shadow-sm outline-none focus:ring-2 focus:ring-purple-400';
        const hoverClasses = isZero
          ? 'bg-gray-50 opacity-60 cursor-default'
          : 'hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group';

        return (
          <div
            key={card.label}
            data-testid={`kpi-card-${card.route.replace('/', '')}`}
            className={`${baseClasses} ${hoverClasses}`}
            onClick={() => handleCardClick(card.route)}
            onKeyDown={(e) => handleKeyDown(e, card.route)}
            role="link"
            tabIndex={0}
            aria-label={`${card.label} ${card.value}${card.subtitle ?? ''} - ${card.label} 페이지로 이동`}
          >
            <UrgencyDot badge={card.urgencyBadge} />
            <p className="text-xs font-medium text-gray-500 mb-1">{card.label}</p>
            <div className="flex items-baseline gap-1">
              <p className="text-2xl font-bold" style={{ color: card.color }}>
                {card.value}
              </p>
              {card.subtitle && (
                <p className="text-xs text-gray-400">{card.subtitle}</p>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-400 group-hover:text-purple-600 transition-colors">
              자세히 보기 &gt;
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default KpiCards;
