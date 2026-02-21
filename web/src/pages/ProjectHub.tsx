/**
 * @module web/pages/ProjectHub
 * @description 프로젝트 허브 페이지 - 전체 프로젝트 카드 그리드 + 그룹 필터 + 검색
 * REQ-012: 멀티 프로젝트 대시보드
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore';
import { useResultStore } from '../stores/resultStore';
import { usePolicyStore } from '../stores/policyStore';
import { useFlowStore } from '../stores/flowStore';
import ProjectCard from '../components/projects/ProjectCard';
import CrossProjectDiagram, { type ProjectLink } from '../components/cross-project/CrossProjectDiagram';
import CrossProjectSummary, { type ProjectGroup } from '../components/cross-project/CrossProjectSummary';
import SharedEntityMap from '../components/cross-project/SharedEntityMap';
import ReverseSearch from '../components/cross-project/ReverseSearch';
import { useSharedEntityStore } from '../stores/sharedEntityStore';

function ProjectHub() {
  const navigate = useNavigate();
  const { projects, activeProjectId, fetchProjects, switchProject, isLoading } = useProjectStore();
  const resetResult = useResultStore((s) => s.reset);
  const fetchAllResults = useResultStore((s) => s.fetchAllResults);
  const resetPolicy = usePolicyStore((s) => s.reset);
  const resetFlow = useFlowStore((s) => s.reset);

  // 로컬 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');

  // 크로스 프로젝트 데이터
  const [links, setLinks] = useState<ProjectLink[]>([]);
  const [groups, setGroups] = useState<ProjectGroup[]>([]);

  // 공유 엔티티 스토어
  const {
    tables: sharedTables,
    events: sharedEvents,
    fetchSharedEntities,
  } = useSharedEntityStore();

  // 초기 로드
  useEffect(() => {
    fetchProjects();
    fetchCrossProjectData();
    fetchSharedEntities();
  }, [fetchProjects, fetchSharedEntities]);

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

  /** 프로젝트 카드 클릭 -> 전환 + 대시보드 이동 */
  const handleProjectClick = useCallback(async (projectId: string) => {
    if (projectId === activeProjectId) {
      // 이미 활성 프로젝트면 대시보드로만 이동
      navigate('/');
      return;
    }

    // 기존 데이터 초기화
    resetResult();
    resetPolicy();
    resetFlow();

    // 프로젝트 전환
    await switchProject(projectId);

    // 새 프로젝트 데이터 로드
    await fetchAllResults();

    // 대시보드로 이동
    navigate('/');
  }, [activeProjectId, switchProject, resetResult, resetPolicy, resetFlow, fetchAllResults, navigate]);

  /** CrossProjectDiagram 노드 클릭 */
  const handleDiagramNodeClick = useCallback(async (projectId: string) => {
    await handleProjectClick(projectId);
  }, [handleProjectClick]);

  // 그룹 목록 (필터 드롭다운용)
  const groupNames = useMemo(() => {
    return groups.map(g => g.name);
  }, [groups]);

  // 필터링된 프로젝트 목록
  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // 상태 필터
    if (statusFilter !== 'all') {
      result = result.filter(p => p.status === statusFilter);
    }

    // 그룹 필터
    if (groupFilter) {
      const group = groups.find(g => g.name === groupFilter);
      if (group) {
        const groupProjectIds = new Set(group.projects);
        result = result.filter(p => groupProjectIds.has(p.id));
      }
    }

    // 검색 필터
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.techStack.some(t => t.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [projects, statusFilter, groupFilter, groups, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">프로젝트</h2>
          <p className="text-sm text-gray-500 mt-1">
            등록된 프로젝트 {projects.length}개
            {activeProjectId && ` | 활성: ${projects.find(p => p.id === activeProjectId)?.name || activeProjectId}`}
          </p>
        </div>
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* 검색 */}
        <input
          type="text"
          data-testid="project-search"
          placeholder="프로젝트 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 w-60 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />

        {/* 상태 필터 */}
        <select
          data-testid="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'archived')}
          className="text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">전체 상태</option>
          <option value="active">활성</option>
          <option value="archived">보관됨</option>
        </select>

        {/* 그룹 필터 */}
        {groupNames.length > 0 && (
          <select
            data-testid="group-filter"
            value={groupFilter || ''}
            onChange={(e) => setGroupFilter(e.target.value || null)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">전체 그룹</option>
            {groupNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        )}

        {/* 결과 카운트 */}
        <span className="text-xs text-gray-400 ml-auto">
          {filteredProjects.length}개 표시
        </span>
      </div>

      {/* 프로젝트 카드 그리드 */}
      {isLoading && projects.length === 0 ? (
        <div className="text-center py-12 text-gray-400">프로젝트 로딩 중...</div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {searchQuery || groupFilter || statusFilter !== 'all'
            ? '검색 조건에 맞는 프로젝트가 없습니다.'
            : '등록된 프로젝트가 없습니다.'
          }
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isActive={project.id === activeProjectId}
              onClick={handleProjectClick}
            />
          ))}
        </div>
      )}

      {/* 크로스 프로젝트 섹션 */}
      {(links.length > 0 || groups.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-8">
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">프로젝트 의존성 다이어그램</h3>
            <CrossProjectDiagram links={links} onNodeClick={handleDiagramNodeClick} />
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">크로스 프로젝트 현황</h3>
            <CrossProjectSummary links={links} groups={groups} />
          </div>
        </div>
      )}

      {/* 공유 엔티티/이벤트 섹션 */}
      {(sharedTables.length > 0 || sharedEvents.length > 0) && (
        <div className="space-y-4 mt-8">
          <h3 className="text-lg font-bold text-gray-900">공유 엔티티 & 이벤트</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">공유 엔티티 맵</h4>
              <SharedEntityMap tables={sharedTables} events={sharedEvents} />
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">역추적 검색</h4>
              <ReverseSearch />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectHub;
