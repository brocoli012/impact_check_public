/**
 * @module web/pages/FlowChart
 * @description 플로우차트 페이지 - React Flow 캔버스, 필터 바, 미니맵, 줌 컨트롤
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes, edgeTypes, FilterBar } from '../components/flowchart';
import SvgDefs from '../components/flowchart/SvgDefs';
import { useFlowLayout } from '../hooks/useFlowLayout';
import { transformToFlow } from '../utils/flowTransformer';
import { useFlowStore } from '../stores/flowStore';
import { useResultStore } from '../stores/resultStore';
import { useEnsureResult } from '../hooks/useEnsureResult';
import DetailPanel from '../components/layout/DetailPanel';
import ProjectSelector from '../components/common/ProjectSelector';
import { type ProjectLink } from '../components/cross-project/CrossProjectDiagram';
import { type ProjectGroup } from '../components/cross-project/CrossProjectSummary';
import CrossProjectTabs from '../components/cross-project/CrossProjectTabs';
import CrossProjectFlowDiagram from '../components/cross-project/CrossProjectFlowDiagram';
import FlowFilterBar from '../components/cross-project/FlowFilterBar';
import ProjectDetailSidePanel from '../components/cross-project/ProjectDetailSidePanel';
import type { Task, ProjectInfo } from '../types';

/**
 * 요구사항 필터에 해당하는 태스크 ID와 화면 ID를 계산
 */
function getRelatedIdsForRequirement(
  requirementFilter: string,
  allTasks: Task[],
  affectedScreens: { screenId: string; tasks: Task[] }[],
): { relatedTaskIds: Set<string>; relatedScreenIds: Set<string> } {
  const relatedTaskIds = new Set<string>();
  const relatedScreenIds = new Set<string>();

  // sourceRequirementIds에 해당 요구사항 ID가 포함된 태스크 찾기
  for (const task of allTasks) {
    if (task.sourceRequirementIds?.includes(requirementFilter)) {
      relatedTaskIds.add(task.id);
    }
  }

  // 관련 태스크가 속한 화면 찾기
  for (const screen of affectedScreens) {
    for (const task of screen.tasks) {
      if (relatedTaskIds.has(task.id)) {
        relatedScreenIds.add(screen.screenId);
        break;
      }
    }
  }

  return { relatedTaskIds, relatedScreenIds };
}

/**
 * 요구사항 필터에 따라 노드에 opacity 스타일을 적용
 */
function applyRequirementHighlight(
  nodesArr: Node[],
  relatedTaskIds: Set<string>,
  relatedScreenIds: Set<string>,
): Node[] {
  return nodesArr.map((node) => {
    let isRelated = false;

    if (node.type === 'requirement') {
      // 최상위 Requirement 노드는 항상 표시
      isRelated = true;
    } else if (node.type === 'system') {
      // 시스템 노드는 항상 표시 (하위에 관련 화면이 있을 수 있음)
      isRelated = true;
    } else if (node.type === 'screen') {
      // 화면 노드: 관련 태스크가 속한 화면인지 확인
      const screenId = node.id.replace('screen-', '');
      isRelated = relatedScreenIds.has(screenId);
    } else if (node.type === 'feature') {
      // Feature 노드: 태스크 ID로 매칭
      const taskId = node.id.replace('feature-', '');
      isRelated = relatedTaskIds.has(taskId);
    } else if (node.type === 'module') {
      // Module 노드: 부모 태스크 ID 추출 (module-{taskId}-{index})
      const parts = node.id.replace('module-', '').split('-');
      // taskId는 마지막 숫자(index)를 제외한 부분
      parts.pop(); // index 제거
      const taskId = parts.join('-');
      isRelated = relatedTaskIds.has(taskId);
    } else if (node.type === 'check') {
      // Check 노드: 부모 태스크 ID 추출 (check-{taskId}-{index})
      const parts = node.id.replace('check-', '').split('-');
      parts.pop(); // index 제거
      const taskId = parts.join('-');
      isRelated = relatedTaskIds.has(taskId);
    } else if (node.type === 'policy' || node.type === 'policyWarning') {
      // Policy/PolicyWarning 노드는 dim 처리
      isRelated = false;
    }

    if (isRelated) {
      return {
        ...node,
        style: {
          ...node.style,
          opacity: 1,
          transition: 'opacity 0.3s ease',
        },
      };
    } else {
      return {
        ...node,
        style: {
          ...node.style,
          opacity: 0.3,
          transition: 'opacity 0.3s ease',
        },
      };
    }
  });
}

function FlowChart() {
  useEnsureResult();
  const currentResult = useResultStore((s) => s.currentResult);

  const filter = useFlowStore((s) => s.filter);
  const expandedNodeIds = useFlowStore((s) => s.expandedNodeIds);
  const selectedNodeId = useFlowStore((s) => s.selectedNodeId);
  const selectNode = useFlowStore((s) => s.selectNode);
  const toggleExpand = useFlowStore((s) => s.toggleExpand);
  const projectMode = useFlowStore((s) => s.projectMode);
  const setProjectMode = useFlowStore((s) => s.setProjectMode);

  // 알럿 배너 상태
  const [showAlert, setShowAlert] = useState(false);

  // 크로스 프로젝트 데이터
  const [links, setLinks] = useState<ProjectLink[]>([]);
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectInfo[]>([]);

  // 크로스 프로젝트 뷰 전환 상태 (탭 뷰 / 플로우 뷰)
  const [crossProjectView, setCrossProjectView] = useState<'tabs' | 'flow'>('tabs');

  // 플로우 뷰 필터 상태
  const [flowSelectedGroup, setFlowSelectedGroup] = useState<string | null>(null);
  const [flowSearchQuery, setFlowSearchQuery] = useState('');
  const [flowSelectedProjectId, setFlowSelectedProjectId] = useState<string | null>(null);

  // 선택된 프로젝트 정보 (사이드 패널용)
  const flowSelectedProject = useMemo(
    () => allProjects.find((p) => p.id === flowSelectedProjectId) ?? null,
    [allProjects, flowSelectedProjectId],
  );

  // 크로스 프로젝트 데이터 로드 (전체 모드 진입 시)
  useEffect(() => {
    if (projectMode === 'all') {
      (async () => {
        try {
          const [linksRes, groupsRes, projectsRes] = await Promise.all([
            fetch('/api/cross-project/links'),
            fetch('/api/cross-project/groups'),
            fetch('/api/projects'),
          ]);
          const linksData = await linksRes.json();
          const groupsData = await groupsRes.json();
          const projectsData = await projectsRes.json();
          setLinks(linksData.links || []);
          setGroups(groupsData.groups || []);
          const sanitizedProjects = (projectsData.projects || []).map((p: any) => ({
            ...p,
            techStack: Array.isArray(p.techStack) ? p.techStack.map(String) : [],
            domains: Array.isArray(p.domains) ? p.domains.map(String) : [],
            featureSummary: Array.isArray(p.featureSummary) ? p.featureSummary.map(String) : [],
          }));
          setAllProjects(sanitizedProjects);
        } catch {
          // 크로스 프로젝트 데이터 로드 실패는 무시
        }
      })();
    }
  }, [projectMode]);

  /** "전체" 선택 시 유효성 검증 */
  const handleAllSelected = useCallback(() => {
    if (!currentResult) {
      setShowAlert(true);
      return false;
    }
    setProjectMode('all');
    return true;
  }, [currentResult, setProjectMode]);

  /** 개별 프로젝트 선택 시 -> individual 모드 복원 */
  const handleProjectChange = useCallback(() => {
    setProjectMode('individual');
    setShowAlert(false);
  }, [setProjectMode]);

  // 요구사항 목록
  const requirements = currentResult?.parsedSpec?.requirements;

  // 데이터 변환
  const { nodes: rawNodes, edges: rawEdges, expandableNodeIds } = useMemo(() => {
    if (!currentResult) return { nodes: [], edges: [], expandableNodeIds: [] };
    return transformToFlow(currentResult, expandedNodeIds, filter);
  }, [currentResult, expandedNodeIds, filter]);

  // 요구사항 필터에 따른 하이라이트 적용
  const highlightedNodes = useMemo(() => {
    if (!filter.requirementFilter || !currentResult) return rawNodes;

    const { relatedTaskIds, relatedScreenIds } = getRelatedIdsForRequirement(
      filter.requirementFilter,
      currentResult.tasks,
      currentResult.affectedScreens,
    );

    // 관련 태스크가 없으면 하이라이트 미적용 (전체 표시)
    if (relatedTaskIds.size === 0) return rawNodes;

    return applyRequirementHighlight(rawNodes, relatedTaskIds, relatedScreenIds);
  }, [rawNodes, filter.requirementFilter, currentResult]);

  // 자동 레이아웃 적용
  const layoutedNodes = useFlowLayout(highlightedNodes, rawEdges);

  // React Flow 상태
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rawEdges);

  // 레이아웃 변경 시 노드/엣지 업데이트
  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(rawEdges);
  }, [layoutedNodes, rawEdges, setNodes, setEdges]);

  // 노드 클릭 핸들러
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Screen 노드: 확장/축소 토글
      if (node.type === 'screen') {
        const screenId = node.id.replace('screen-', '');
        toggleExpand(screenId);
      }
      // 선택 상태 토글
      if (selectedNodeId === node.id) {
        selectNode(null);
      } else {
        selectNode(node.id);
      }
    },
    [selectedNodeId, selectNode, toggleExpand],
  );

  // 캔버스 클릭 -> 선택 해제
  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  // 선택된 노드 찾기
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [selectedNodeId, nodes]);

  // "전체" 모드 + currentResult 있으면 CrossProjectTabs 오버레이
  if (projectMode === 'all' && currentResult) {
    return (
      <div className="p-6" data-testid="flowchart-all-mode" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
        <ProjectSelector
          includeAll
          onAllSelected={handleAllSelected}
          selectedAll
          onProjectSelected={handleProjectChange}
        />

        <div className="mt-4 flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="px-4 pt-4 pb-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="text-lg font-semibold text-gray-800">
              전체 프로젝트 영향도 - {currentResult.specTitle}
            </h3>
            {/* 뷰 전환 버튼 */}
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                data-testid="view-toggle-tabs"
                onClick={() => setCrossProjectView('tabs')}
                style={{
                  padding: '4px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: '1px solid',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  ...(crossProjectView === 'tabs'
                    ? { background: '#3B82F6', color: 'white', borderColor: '#3B82F6' }
                    : { background: 'white', color: '#64748B', borderColor: '#CBD5E1' }),
                }}
              >
                탭 뷰
              </button>
              <button
                data-testid="view-toggle-flow"
                onClick={() => setCrossProjectView('flow')}
                style={{
                  padding: '4px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: '1px solid',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  ...(crossProjectView === 'flow'
                    ? { background: '#3B82F6', color: 'white', borderColor: '#3B82F6' }
                    : { background: 'white', color: '#64748B', borderColor: '#CBD5E1' }),
                }}
              >
                플로우 뷰
              </button>
            </div>
          </div>

          {crossProjectView === 'tabs' ? (
            <CrossProjectTabs links={links} groups={groups} />
          ) : (
            <div style={{ flex: 1, display: 'flex', gap: 16, padding: '0 16px 16px 16px', overflow: 'hidden' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
                <FlowFilterBar
                  groups={groups}
                  selectedGroup={flowSelectedGroup}
                  onGroupChange={setFlowSelectedGroup}
                  searchQuery={flowSearchQuery}
                  onSearchChange={setFlowSearchQuery}
                />
                <div style={{ flex: 1, borderRadius: 8, border: '1px solid #E2E8F0', overflow: 'hidden', background: '#FAFBFC' }}>
                  <CrossProjectFlowDiagram
                    links={links}
                    groups={groups}
                    projects={allProjects}
                    selectedGroup={flowSelectedGroup}
                    searchQuery={flowSearchQuery}
                    onNodeClick={(projectId) => setFlowSelectedProjectId(
                      flowSelectedProjectId === projectId ? null : projectId,
                    )}
                  />
                </div>
              </div>
              {flowSelectedProject && (
                <div style={{ width: 320, flexShrink: 0 }}>
                  <ProjectDetailSidePanel
                    project={flowSelectedProject}
                    links={links}
                    onClose={() => setFlowSelectedProjectId(null)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!currentResult) {
    return (
      <div data-testid="flowchart-individual-mode">
        <div className="px-4 pt-2">
          <ProjectSelector
            includeAll
            onAllSelected={handleAllSelected}
            onProjectSelected={handleProjectChange}
          />
        </div>

        {/* 알럿 배너 */}
        {showAlert && (
          <div
            data-testid="flowchart-alert-banner"
            className="mx-4 mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.999L13.732 4.001c-.77-1.333-2.694-1.333-3.464 0L3.34 16.001C2.57 17.335 3.532 19.001 5.072 19.001z" />
              </svg>
              <span className="text-sm text-amber-700">
                전체 프로젝트 영향도를 보려면 먼저 좌측 목록에서 기획서를 선택해주세요.
              </span>
            </div>
            <button
              data-testid="flowchart-alert-close"
              onClick={() => setShowAlert(false)}
              className="text-amber-500 hover:text-amber-700 ml-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="flex items-center justify-center h-96">
          <div className="text-gray-400">데이터 로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }} data-testid="flowchart-individual-mode">
      {/* ProjectSelector */}
      <div className="px-4 pt-2 pb-1">
        <ProjectSelector
          includeAll
          onAllSelected={handleAllSelected}
          onProjectSelected={handleProjectChange}
        />
      </div>

      {/* 알럿 배너 */}
      {showAlert && (
        <div
          data-testid="flowchart-alert-banner"
          className="mx-4 mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.999L13.732 4.001c-.77-1.333-2.694-1.333-3.464 0L3.34 16.001C2.57 17.335 3.532 19.001 5.072 19.001z" />
            </svg>
            <span className="text-sm text-amber-700">
              전체 프로젝트 영향도를 보려면 먼저 좌측 목록에서 기획서를 선택해주세요.
            </span>
          </div>
          <button
            data-testid="flowchart-alert-close"
            onClick={() => setShowAlert(false)}
            className="text-amber-500 hover:text-amber-700 ml-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* 필터 바 */}
      <div style={{ marginBottom: 8 }}>
        <FilterBar expandableNodeIds={expandableNodeIds} requirements={requirements} />
      </div>

      {/* SVG marker definitions (1회만 렌더링) */}
      <SvgDefs />

      {/* React Flow 캔버스 */}
      <div
        style={{
          flex: 1,
          borderRadius: 8,
          border: '1px solid #E2E8F0',
          background: '#FAFBFC',
          overflow: 'hidden',
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          defaultEdgeOptions={{ type: 'custom' }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#E2E8F0" />
          <MiniMap
            position="bottom-right"
            style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: 6,
            }}
            maskColor="rgba(0,0,0,0.08)"
            nodeStrokeWidth={2}
          />
          <Controls
            position="bottom-right"
            style={{
              marginBottom: 130,
              borderRadius: 6,
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          />
        </ReactFlow>
      </div>

      {/* 선택된 노드 상세 패널 */}
      {selectedNode && (
        <DetailPanel node={selectedNode} onClose={() => selectNode(null)} />
      )}
    </div>
  );
}

export default FlowChart;
