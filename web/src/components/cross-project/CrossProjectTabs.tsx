/**
 * @module web/components/cross-project/CrossProjectTabs
 * @description TASK-173: 크로스 프로젝트 4탭 컴포넌트
 * - 의존성 (Dependencies): CrossProjectDiagram
 * - 공유 엔티티 (Shared Entities): SharedEntityMap (tables only)
 * - Pub/Sub: SharedEntityMap (events only)
 * - 요약 (Summary): CrossProjectSummary + ReverseSearch
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CrossProjectDiagram, { type ProjectLink } from './CrossProjectDiagram';
import SharedEntityMap from './SharedEntityMap';
import CrossProjectSummary, { type ProjectGroup } from './CrossProjectSummary';
import ReverseSearch from './ReverseSearch';
import { useSharedEntityStore } from '../../stores/sharedEntityStore';

type TabId = 'dependencies' | 'shared-entities' | 'pub-sub' | 'summary';

interface Tab {
  id: TabId;
  label: string;
}

const TABS: Tab[] = [
  { id: 'dependencies', label: '\uC758\uC874\uC131' },
  { id: 'shared-entities', label: '\uACF5\uC720 \uC5D4\uD2F0\uD2F0' },
  { id: 'pub-sub', label: 'Pub/Sub' },
  { id: 'summary', label: '\uC694\uC57D' },
];

interface CrossProjectTabsProps {
  /** 프로젝트 의존성 링크 목록 */
  links: ProjectLink[];
  /** 프로젝트 그룹 목록 */
  groups: ProjectGroup[];
}

function CrossProjectTabs({ links, groups }: CrossProjectTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('dependencies');
  const navigate = useNavigate();
  const { tables, events, fetchSharedEntities } = useSharedEntityStore();

  // 공유 엔티티 데이터 로드 (탭 진입 시)
  useEffect(() => {
    fetchSharedEntities();
  }, [fetchSharedEntities]);

  /** 노드 클릭 시 프로젝트 보드로 이동 */
  const handleNodeClick = (projectId: string) => {
    navigate(`/?project=${encodeURIComponent(projectId)}`);
  };

  return (
    <div className="flex flex-col h-full" data-testid="cross-project-tabs">
      {/* 탭 헤더 */}
      <div className="flex border-b border-gray-200" role="tablist" aria-label="크로스 프로젝트 탭">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            data-testid={`tab-${tab.id}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors
              ${activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 내용 */}
      <div
        className="flex-1 overflow-auto p-4"
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        data-testid={`tabpanel-${activeTab}`}
      >
        {activeTab === 'dependencies' && (
          <CrossProjectDiagram links={links} onNodeClick={handleNodeClick} />
        )}
        {activeTab === 'shared-entities' && (
          <SharedEntityMap tables={tables} events={[]} />
        )}
        {activeTab === 'pub-sub' && (
          <SharedEntityMap tables={[]} events={events} />
        )}
        {activeTab === 'summary' && (
          <div className="space-y-6">
            <CrossProjectSummary links={links} groups={groups} />
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">역추적 검색</h4>
              <ReverseSearch />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CrossProjectTabs;
