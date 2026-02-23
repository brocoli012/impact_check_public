/**
 * @module web/pages/ProjectBoard
 * @description Phase 5: 프로젝트 보드 페이지 (TASK-132~139)
 * 기획서 없이 프로젝트 종합 정보를 보여주는 핵심 페이지
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore';
import { useResultStore } from '../stores/resultStore';
import { usePolicyStore } from '../stores/policyStore';
import { useSharedEntityStore } from '../stores/sharedEntityStore';
import ProjectSelector from '../components/common/ProjectSelector';
import ProjectStatusBanner from '../components/project-board/ProjectStatusBanner';
import GapHealthWidget from '../components/projects/GapHealthWidget';
import AnalysisHistoryTable from '../components/project-board/AnalysisHistoryTable';
import ScoreTrendChart from '../components/project-board/ScoreTrendChart';
import PolicySummaryCard from '../components/project-board/PolicySummaryCard';
import CompareDrawer from '../components/project-board/CompareDrawer';
import CrossProjectDiagram, { type ProjectLink } from '../components/cross-project/CrossProjectDiagram';
import CrossProjectSummary, { type ProjectGroup } from '../components/cross-project/CrossProjectSummary';
import SharedEntityMap from '../components/cross-project/SharedEntityMap';
import ReverseSearch from '../components/cross-project/ReverseSearch';
import type { GapCheckResult } from '../types';

/** 인덱스 메타 (API 응답) */
interface IndexMeta {
  totalFiles: number;
  screens: number;
  components: number;
  apis: number;
  modules: number;
}

/** 프로젝트 상태 API 응답 */
interface ProjectStatus {
  projectId: string | null;
  projectPath: string | null;
  hasIndex: boolean;
  hasAnnotations: boolean;
  hasResults: boolean;
}

export default function ProjectBoard() {
  const { projects, activeProjectId, fetchProjects } = useProjectStore();
  const { resultList, fetchAllResults } = useResultStore();
  const { policies, fetchPolicies } = usePolicyStore();
  const {
    tables: sharedTables,
    events: sharedEvents,
    fetchSharedEntities,
  } = useSharedEntityStore();

  // 프로젝트 상태 & 인덱스 메타
  const [projectStatus, setProjectStatus] = useState<ProjectStatus | null>(null);
  const [indexMeta, setIndexMeta] = useState<IndexMeta | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // 비교 Drawer 상태 (TASK-142)
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  // 갭 탐지 데이터 (TASK-171)
  const [gapData, setGapData] = useState<GapCheckResult | null>(null);
  const [gapLoading, setGapLoading] = useState(false);
  /** 갭 캐시 타임스탬프 (5분 TTL) */
  const gapCacheRef = useRef<{ data: GapCheckResult; fetchedAt: number; projectId?: string } | null>(null);

  // 크로스 프로젝트 데이터
  const [links, setLinks] = useState<ProjectLink[]>([]);
  const [groups, setGroups] = useState<ProjectGroup[]>([]);

  /** 프로젝트 상태 & 인덱스 메타 로드 */
  const fetchProjectStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const statusRes = await fetch('/api/project/status');
      const statusData: ProjectStatus = await statusRes.json();
      setProjectStatus(statusData);

      if (statusData.hasIndex) {
        try {
          const indexRes = await fetch('/api/project/index-meta');
          const indexData = await indexRes.json();
          const meta = indexData.meta;
          if (meta?.stats) {
            setIndexMeta({
              totalFiles: meta.stats.totalFiles,
              screens: meta.stats.screens,
              components: meta.stats.components,
              apis: meta.stats.apiEndpoints,
              modules: meta.stats.modules,
            });
          }
        } catch {
          // 인덱스 메타 로드 실패는 무시
        }
      } else {
        setIndexMeta(null);
      }
    } catch {
      setProjectStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  /** 갭 탐지 데이터 로드 (5분 캐시 TTL) */
  const fetchGapData = useCallback(async (projectId?: string | null) => {
    const GAP_CACHE_TTL = 5 * 60 * 1000; // 5분
    const now = Date.now();

    // 캐시 히트 확인
    if (
      gapCacheRef.current &&
      gapCacheRef.current.projectId === (projectId || undefined) &&
      now - gapCacheRef.current.fetchedAt < GAP_CACHE_TTL
    ) {
      setGapData(gapCacheRef.current.data);
      return;
    }

    setGapLoading(true);
    try {
      const url = projectId
        ? `/api/gap-check?project=${projectId}`
        : '/api/gap-check';
      const res = await fetch(url);
      if (!res.ok) {
        // API 404 등이면 위젯 숨김
        setGapData(null);
        return;
      }
      const result: GapCheckResult = await res.json();
      setGapData(result);
      gapCacheRef.current = {
        data: result,
        fetchedAt: now,
        projectId: projectId || undefined,
      };
    } catch {
      // API 에러 시 위젯 숨김
      setGapData(null);
    } finally {
      setGapLoading(false);
    }
  }, []);

  /** 크로스 프로젝트 데이터 로드 */
  const fetchCrossProjectData = useCallback(async () => {
    try {
      const [linksRes, groupsRes] = await Promise.all([
        fetch('/api/cross-project/links'),
        fetch('/api/cross-project/groups'),
      ]);
      const linksData = await linksRes.json();
      const groupsData = await groupsRes.json();
      setLinks(linksData.links || []);
      setGroups(groupsData.groups || []);
    } catch {
      // 크로스 프로젝트 데이터 로드 실패는 무시
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    fetchProjects();
    fetchProjectStatus();
    fetchAllResults();
    fetchPolicies();
    fetchGapData();
    fetchCrossProjectData();
    fetchSharedEntities();
  }, [fetchProjects, fetchProjectStatus, fetchAllResults, fetchPolicies, fetchGapData, fetchCrossProjectData, fetchSharedEntities]);

  // 프로젝트 전환 시 데이터 재로드
  useEffect(() => {
    if (activeProjectId) {
      fetchProjectStatus();
      fetchAllResults();
      fetchPolicies();
      // 캐시 무효화 후 새 프로젝트 데이터 로드
      gapCacheRef.current = null;
      fetchGapData(activeProjectId);
      fetchCrossProjectData();
      fetchSharedEntities();
    }
  }, [activeProjectId, fetchProjectStatus, fetchAllResults, fetchPolicies, fetchGapData, fetchCrossProjectData, fetchSharedEntities]);

  // 현재 활성 프로젝트 객체
  const currentProject = projects.find((p) => p.id === activeProjectId);

  // 마지막 분석일
  const lastAnalysisDate = resultList.length > 0 ? resultList[0].analyzedAt : undefined;

  /* ================================================================ */
  /*  빈 상태 1: 프로젝트 미등록                                        */
  /* ================================================================ */
  if (!statusLoading && projects.length === 0) {
    return (
      <div className="p-6" data-testid="project-board">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">프로젝트 보드</h1>
        </div>
        <div
          data-testid="empty-no-project"
          className="bg-white rounded-lg border border-gray-200 p-12 text-center"
        >
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          <h2 className="text-lg font-semibold text-gray-700 mb-2">프로젝트를 등록하세요</h2>
          <p className="text-sm text-gray-500 mb-4">
            프로젝트를 등록하고 인덱싱을 실행하여 코드 분석을 시작하세요.
          </p>
          <p className="text-xs text-gray-400 font-mono">
            CLI: node dist/index.js init &lt;project-path&gt;
          </p>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /*  메인 레이아웃                                                     */
  /* ================================================================ */
  return (
    <div className="p-6 space-y-6" data-testid="project-board">
      {/* 상단 바: ProjectSelector + 버튼들 */}
      <div className="flex items-center justify-between">
        <ProjectSelector />
        <div className="flex gap-2 items-center">
          <button
            data-testid="compare-open-btn"
            onClick={() => setIsCompareOpen(true)}
            className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1 px-3 py-1.5 rounded-md border border-purple-200 hover:border-purple-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            비교
          </button>
          <Link
            to="/analysis"
            className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1"
            data-testid="quick-analysis-link"
          >
            기획 분석 <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </div>

      {/* 프로젝트 상태 배너 */}
      {currentProject && (
        <ProjectStatusBanner
          project={currentProject}
          indexMeta={indexMeta}
          lastAnalysisDate={lastAnalysisDate}
        />
      )}

      {/* 갭 탐지 위젯 (TASK-171) */}
      <GapHealthWidget data={gapData} loading={gapLoading} />

      {/* 빈 상태 2: 인덱스 없음 - 배너에서 경고 표시하고, 나머지는 미표시 */}
      {projectStatus && !projectStatus.hasIndex && currentProject && (
        <div
          data-testid="empty-no-index"
          className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700"
        >
          인덱싱이 필요합니다. CLI에서{' '}
          <code className="font-mono bg-amber-100 px-1 rounded">impact index</code>를 실행하세요.
        </div>
      )}

      {/* 분석 이력 + 점수 추이 (인덱스가 있을 때만) */}
      {projectStatus?.hasIndex && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <AnalysisHistoryTable results={resultList} />
          </div>
          <div>
            <ScoreTrendChart results={resultList} />
          </div>
        </div>
      )}

      {/* 정책 현황 */}
      {projectStatus?.hasIndex && (
        <PolicySummaryCard policies={policies} />
      )}

      {/* 크로스 프로젝트 영향 */}
      {(links.length > 0 || groups.length > 0) && (
        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-3">크로스 프로젝트 영향</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-4">
              <CrossProjectDiagram links={links} />
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <CrossProjectSummary links={links} groups={groups} />
            </div>
          </div>
        </div>
      )}

      {/* 공유 엔티티 & 이벤트 */}
      {(sharedTables.length > 0 || sharedEvents.length > 0) && (
        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-3">공유 엔티티 & 이벤트</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="text-xs font-semibold text-gray-700 mb-3">공유 엔티티 맵</h4>
              <SharedEntityMap tables={sharedTables} events={sharedEvents} />
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="text-xs font-semibold text-gray-700 mb-3">역추적 검색</h4>
              <ReverseSearch />
            </div>
          </div>
        </div>
      )}

      {/* 비교 Drawer (TASK-142) */}
      <CompareDrawer
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        currentProjectId={activeProjectId}
      />
    </div>
  );
}
