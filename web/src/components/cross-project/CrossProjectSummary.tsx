/**
 * @module web/components/cross-project/CrossProjectSummary
 * @description 크로스 프로젝트 현황 요약 카드
 * 등록된 프로젝트 수, 링크 수, 그룹 수, 링크 타입별 통계 표시
 */

import { useMemo } from 'react';
import type { ProjectLink } from './CrossProjectDiagram';
import { safeString } from '../../utils/safeString';

/** 프로젝트 그룹 */
export interface ProjectGroup {
  name: string;
  projects: string[];
}

interface CrossProjectSummaryProps {
  /** 프로젝트 의존성 링크 목록 */
  links: ProjectLink[];
  /** 프로젝트 그룹 목록 */
  groups: ProjectGroup[];
}

/** 링크 타입별 색상 */
const TYPE_COLORS: Record<string, string> = {
  'api-consumer': '#3B82F6',
  'api-provider': '#10B981',
  'shared-library': '#8B5CF6',
  'shared-types': '#F59E0B',
  'event-publisher': '#EF4444',
  'event-subscriber': '#EC4899',
};

function CrossProjectSummary({ links, groups }: CrossProjectSummaryProps) {
  const stats = useMemo(() => {
    const projectIds = new Set<string>();
    const typeCounts = new Map<string, number>();

    for (const link of links) {
      projectIds.add(link.source);
      projectIds.add(link.target);
      typeCounts.set(link.type, (typeCounts.get(link.type) || 0) + 1);
    }

    return {
      projectCount: projectIds.size,
      linkCount: links.length,
      groupCount: groups.length,
      typeCounts: Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [links, groups]);

  if (links.length === 0 && groups.length === 0) {
    return (
      <div data-testid="cross-project-summary-empty" className="text-sm text-gray-400 py-4 text-center">
        크로스 프로젝트 데이터가 없습니다
      </div>
    );
  }

  return (
    <div data-testid="cross-project-summary" className="space-y-4">
      {/* KPI 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-900" data-testid="project-count">
            {stats.projectCount}
          </p>
          <p className="text-xs text-gray-500 mt-1">프로젝트</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-900" data-testid="link-count">
            {stats.linkCount}
          </p>
          <p className="text-xs text-gray-500 mt-1">의존성 링크</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-900" data-testid="group-count">
            {stats.groupCount}
          </p>
          <p className="text-xs text-gray-500 mt-1">그룹</p>
        </div>
      </div>

      {/* 링크 타입별 통계 */}
      {stats.typeCounts.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-700 mb-2">링크 타입별 통계</h4>
          <div className="space-y-1.5">
            {stats.typeCounts.map(([type, count]) => {
              const typeStr = safeString(type);
              const color = TYPE_COLORS[typeStr] || '#94A3B8';
              return (
                <div key={typeStr} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs text-gray-600">{typeStr}</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-700">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default CrossProjectSummary;
