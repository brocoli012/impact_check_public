/**
 * @module web/components/cross-project/CrossProjectFlowDiagram
 * @description TASK-106: 크로스 프로젝트 플로우 다이어그램 - dagre 레이아웃
 * 프로젝트 간 의존성을 TB(top-to-bottom) dagre 레이아웃으로 시각화
 * hover 하이라이트, 링크 타입별 엣지 색상, MiniMap/Controls 포함
 */

import { useMemo, useCallback, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';

import { LINK_TYPE_COLORS, LINK_TYPE_LABELS } from '../../utils/linkTypeConstants';
import { safeString } from '../../utils/safeString';
import { ProjectFlowNode, type ProjectFlowNodeData } from './ProjectFlowNode';
import EdgeTooltip from './EdgeTooltip';
import type { ProjectLink } from './CrossProjectDiagram';
import type { ProjectGroup } from './CrossProjectSummary';
import type { ProjectInfo } from '../../types';

/** 커스텀 노드 타입 등록 */
const nodeTypes = {
  projectFlowNode: ProjectFlowNode,
};

/** 노드 기본 크기 (dagre 배치용) */
const NODE_WIDTH = 240;
const NODE_HEIGHT = 160;

export interface CrossProjectFlowDiagramProps {
  links: ProjectLink[];
  groups: ProjectGroup[];
  projects: ProjectInfo[];
  onNodeClick?: (projectId: string) => void;
  /** 그룹 필터 (null = 전체) */
  selectedGroup?: string | null;
  /** 검색 쿼리 */
  searchQuery?: string;
}

/** 엣지 호버 상태 */
interface EdgeHoverState {
  linkType: string;
  source: string;
  target: string;
  autoDetected: boolean;
  position: { x: number; y: number };
}

function CrossProjectFlowDiagram({
  links,
  groups,
  projects,
  onNodeClick,
  selectedGroup,
  searchQuery,
}: CrossProjectFlowDiagramProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [edgeHover, setEdgeHover] = useState<EdgeHoverState | null>(null);

  // 필터 적용: 그룹 + 검색
  const filteredProjectIds = useMemo(() => {
    let ids: Set<string> | null = null;

    // 그룹 필터
    if (selectedGroup) {
      const group = groups.find((g) => g.name === selectedGroup);
      if (group) {
        ids = new Set(group.projects);
      }
    }

    // 검색 필터
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const searchMatched = new Set<string>();
      for (const p of projects) {
        if (
          p.id.toLowerCase().includes(query) ||
          p.name.toLowerCase().includes(query)
        ) {
          searchMatched.add(p.id);
        }
      }
      if (ids) {
        // 교집합
        ids = new Set([...ids].filter((id) => searchMatched.has(id)));
      } else {
        ids = searchMatched;
      }
    }

    return ids;
  }, [selectedGroup, groups, searchQuery, projects]);

  // 필터된 링크
  const filteredLinks = useMemo(() => {
    if (!filteredProjectIds) return links;
    return links.filter(
      (l) => filteredProjectIds.has(l.source) || filteredProjectIds.has(l.target),
    );
  }, [links, filteredProjectIds]);

  // 호버된 노드에 연결된 엣지/노드 ID 계산
  const connectedIds = useMemo(() => {
    if (!hoveredNodeId) return null;
    const connectedNodeIds = new Set<string>([hoveredNodeId]);
    const connectedEdgeIds = new Set<string>();

    filteredLinks.forEach((link) => {
      if (link.source === hoveredNodeId || link.target === hoveredNodeId) {
        connectedNodeIds.add(link.source);
        connectedNodeIds.add(link.target);
        connectedEdgeIds.add(link.id);
      }
    });

    return { nodeIds: connectedNodeIds, edgeIds: connectedEdgeIds };
  }, [hoveredNodeId, filteredLinks]);

  // 프로젝트 맵 (빠른 조회)
  const projectMap = useMemo(() => {
    const map = new Map<string, ProjectInfo>();
    for (const p of projects) {
      map.set(p.id, p);
    }
    return map;
  }, [projects]);

  // dagre 레이아웃 + 노드/엣지 생성
  const { nodes, edges } = useMemo(() => {
    // 링크에서 고유 프로젝트 ID 추출
    const projectIdSet = new Set<string>();
    for (const link of filteredLinks) {
      projectIdSet.add(link.source);
      projectIdSet.add(link.target);
    }

    // 필터된 프로젝트 ID도 추가 (링크 없어도 노드 표시)
    if (filteredProjectIds) {
      for (const id of filteredProjectIds) {
        projectIdSet.add(id);
      }
    }

    const projectIds = Array.from(projectIdSet);

    if (projectIds.length === 0) {
      return { nodes: [], edges: [] };
    }

    // dagre 그래프 생성
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({
      rankdir: 'TB',
      ranksep: 80,
      nodesep: 60,
      marginx: 40,
      marginy: 40,
    });

    // 노드 추가
    for (const id of projectIds) {
      g.setNode(id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    }

    // 엣지 추가
    for (const link of filteredLinks) {
      g.setEdge(link.source, link.target);
    }

    // 레이아웃 계산
    dagre.layout(g);

    // 노드 생성
    const flowNodes: Node[] = projectIds.map((projectId) => {
      const dagreNode = g.node(projectId);
      const project = projectMap.get(projectId);

      const nodeData: ProjectFlowNodeData = {
        label: project?.name ?? projectId,
        projectId,
        domains: project?.domains,
        techStack: project?.techStack,
        screenCount: project?.resultCount ?? 0,
        apiCount: project?.taskCount ?? 0,
        latestGrade: project?.latestGrade ?? null,
        dimmed: false, // hover 하이라이트는 CSS로 처리 (BUG-009)
      };

      return {
        id: projectId,
        type: 'projectFlowNode',
        position: {
          x: dagreNode ? dagreNode.x - NODE_WIDTH / 2 : 0,
          y: dagreNode ? dagreNode.y - NODE_HEIGHT / 2 : 0,
        },
        data: nodeData,
      };
    });

    // 엣지 생성 - hover 하이라이트는 CSS로 처리 (BUG-009)
    const flowEdges: Edge[] = filteredLinks.map((link) => {
      const color = LINK_TYPE_COLORS[link.type] || '#94A3B8';
      const typeLabel = LINK_TYPE_LABELS[link.type] || safeString(link.type);

      return {
        id: link.id,
        source: link.source,
        target: link.target,
        label: typeLabel,
        labelStyle: {
          fontSize: 10,
          fill: color,
          fontWeight: 600,
        },
        style: {
          stroke: color,
          strokeWidth: 2,
          transition: 'opacity 0.2s ease',
        },
        animated: link.autoDetected,
      };
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [filteredLinks, filteredProjectIds, projectMap]);

  // 노드 클릭 핸들러
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (onNodeClick) {
        onNodeClick(node.id);
      }
    },
    [onNodeClick],
  );

  // 노드 hover 진입
  const handleNodeMouseEnter: NodeMouseHandler = useCallback((_event, node) => {
    setHoveredNodeId(node.id);
  }, []);

  // 노드 hover 이탈
  const handleNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  // 캔버스 클릭 시 hover 해제
  const handlePaneClick = useCallback(() => {
    setHoveredNodeId(null);
    setEdgeHover(null);
  }, []);

  // 엣지 마우스 진입
  const handleEdgeMouseEnter = useCallback(
    (event: ReactMouseEvent, edge: Edge) => {
      const link = filteredLinks.find((l) => l.id === edge.id);
      if (link) {
        setEdgeHover({
          linkType: link.type,
          source: link.source,
          target: link.target,
          autoDetected: link.autoDetected,
          position: { x: event.clientX, y: event.clientY },
        });
      }
    },
    [filteredLinks],
  );

  // 엣지 마우스 이탈
  const handleEdgeMouseLeave = useCallback(() => {
    setEdgeHover(null);
  }, []);

  if (nodes.length === 0) {
    return (
      <div
        data-testid="cross-project-flow-diagram-empty"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#94A3B8',
          fontSize: 14,
        }}
      >
        표시할 프로젝트가 없습니다
      </div>
    );
  }

  // Hover 하이라이트를 CSS로 처리 - 노드 객체 재생성 방지 (BUG-009)
  const hoverCss = useMemo(() => {
    if (!connectedIds) return null;
    const scope = '[data-testid="cross-project-flow-diagram"]';
    const nodeSel = Array.from(connectedIds.nodeIds)
      .map(id => `${scope} .react-flow__node[data-id="${id}"]`)
      .join(',');
    const edgeSel = connectedIds.edgeIds.size > 0
      ? Array.from(connectedIds.edgeIds)
          .map(id => `${scope} [data-testid="rf__edge-${id}"]`)
          .join(',')
      : null;
    return `
      ${scope} .react-flow__node { opacity: 0.3 !important; transition: opacity 0.2s ease !important; }
      ${nodeSel} { opacity: 1 !important; }
      ${scope} .react-flow__edge { opacity: 0.15 !important; transition: opacity 0.2s ease !important; }
      ${edgeSel ? `${edgeSel} { opacity: 1 !important; }` : ''}
    `;
  }, [connectedIds]);

  return (
    <div data-testid="cross-project-flow-diagram" style={{ height: '100%', width: '100%', position: 'relative' }}>
      {hoverCss && <style>{hoverCss}</style>}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        onEdgeMouseEnter={handleEdgeMouseEnter}
        onEdgeMouseLeave={handleEdgeMouseLeave}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2}
        nodesDraggable={true}
        nodesConnectable={false}
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

      {/* 엣지 툴팁 */}
      {edgeHover && (
        <EdgeTooltip
          linkType={edgeHover.linkType}
          sourceProject={edgeHover.source}
          targetProject={edgeHover.target}
          autoDetected={edgeHover.autoDetected}
          position={edgeHover.position}
          visible={true}
        />
      )}
    </div>
  );
}

export default CrossProjectFlowDiagram;
