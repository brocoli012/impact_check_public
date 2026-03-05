/**
 * @module web/components/cross-project/CrossProjectDiagram
 * @description 크로스 프로젝트 의존성 다이어그램 - @xyflow/react 기반
 * 프로젝트 간 의존성을 노드와 엣지로 시각화
 * TASK-175: hover 하이라이트 + 노드 클릭 네비게이션
 * TASK-211~214: Pin Click - 싱글 클릭 핀 토글, 더블 클릭 네비게이션
 */

import { useMemo, useCallback, useState } from 'react';
import {
  ReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { LINK_TYPE_COLORS, LINK_TYPE_LABELS } from '../../utils/linkTypeConstants';
import { safeString } from '../../utils/safeString';

/** 프로젝트 링크 타입 (서버 API와 동일) */
export interface ProjectLink {
  id: string;
  source: string;
  target: string;
  type: string;
  apis?: string[];
  autoDetected: boolean;
  confirmedAt?: string;
}

interface CrossProjectDiagramProps {
  /** 프로젝트 의존성 링크 목록 */
  links: ProjectLink[];
  /** 노드 클릭 핸들러 (프로젝트 ID 전달) */
  onNodeClick?: (projectId: string) => void;
}

function CrossProjectDiagram({ links, onNodeClick }: CrossProjectDiagramProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [pinnedNodeId, setPinnedNodeId] = useState<string | null>(null);

  // Pin > Hover 우선순위: pinnedNodeId가 있으면 그것을 사용
  const activeNodeId = pinnedNodeId ?? hoveredNodeId;

  // 빈 링크 여부 (early return은 모든 hooks 이후에 처리)
  const isEmpty = !links || links.length === 0;

  // Pin된 노드에 연결된 엣지/노드 ID 계산 (hover는 CSS로 처리 - BUG-009)
  const connectedIds = useMemo(() => {
    if (!activeNodeId || isEmpty) return null;
    const connectedNodeIds = new Set<string>([activeNodeId]);
    const connectedEdgeIds = new Set<string>();

    links.forEach((link, idx) => {
      if (link.source === pinnedNodeId || link.target === pinnedNodeId) {
        connectedNodeIds.add(link.source);
        connectedNodeIds.add(link.target);
        connectedEdgeIds.add(`edge-${idx}`);
      }
    });

    return { nodeIds: connectedNodeIds, edgeIds: connectedEdgeIds };
  }, [activeNodeId, links, isEmpty]);

  const { nodes, edges } = useMemo(() => {
    if (isEmpty) return { nodes: [], edges: [] };
    // 고유 프로젝트 ID 추출
    const projectIds = new Set<string>();
    for (const link of links) {
      projectIds.add(link.source);
      projectIds.add(link.target);
    }
    const projectArray = Array.from(projectIds);

    // 프로젝트별 링크 수 계산
    const linkCounts = new Map<string, number>();
    for (const link of links) {
      linkCounts.set(link.source, (linkCounts.get(link.source) || 0) + 1);
      linkCounts.set(link.target, (linkCounts.get(link.target) || 0) + 1);
    }

    // 원형 배치
    const centerX = 300;
    const centerY = 200;
    const radius = 150;

    const projectNodes: Node[] = projectArray.map((projectId, idx) => {
      const angle = (2 * Math.PI * idx) / projectArray.length - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle) - 70;
      const y = centerY + radius * Math.sin(angle) - 20;
      const count = linkCounts.get(projectId) || 0;

      // pin 하이라이트: 관련 노드 = 정상, 비관련 노드 = 반투명 (hover는 CSS로 처리 - BUG-009)
      const isHighlighted = !connectedIds || connectedIds.nodeIds.has(projectId);
      const isPinned = pinnedNodeId === projectId;

      // Pin 스타일 > 기본 스타일 (hover 스타일은 CSS로 처리)
      let background = '#F3F4F6';
      let border = '2px solid #6B7280';
      let boxShadow: string | undefined;

      if (isPinned) {
        background = '#BFDBFE';
        border = '2px solid #2563EB';
        boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.2)';
      }

      return {
        id: projectId,
        type: 'default',
        position: { x, y },
        data: { label: `${projectId} (${count})` },
        style: {
          background,
          border,
          borderRadius: 8,
          fontSize: 11,
          fontWeight: 600,
          padding: '6px 10px',
          width: 140,
          textAlign: 'center' as const,
          opacity: isHighlighted ? 1 : 0.3,
          transition: 'opacity 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
          cursor: onNodeClick ? 'pointer' : 'default',
          boxShadow,
        },
      };
    });

    const linkEdges: Edge[] = links.map((link, idx) => {
      const color = LINK_TYPE_COLORS[link.type] || '#94A3B8';
      const typeLabel = LINK_TYPE_LABELS[link.type] || link.type;

      // hover 하이라이트: 관련 엣지만 정상 표시
      const isHighlighted = !connectedIds || connectedIds.edgeIds.has(`edge-${idx}`);

      return {
        id: `edge-${idx}`,
        source: link.source,
        target: link.target,
        label: typeLabel,
        labelStyle: {
          fontSize: 9,
          fill: color,
          fontWeight: 600,
          opacity: isHighlighted ? 1 : 0.2,
        },
        style: {
          stroke: color,
          strokeWidth: isHighlighted ? 2.5 : 1.5,
          opacity: isHighlighted ? 1 : 0.15,
          transition: 'opacity 0.2s ease, stroke-width 0.2s ease',
        },
        animated: link.autoDetected && isHighlighted,
      };
    });

    return {
      nodes: projectNodes,
      edges: linkEdges,
    };
  }, [links, connectedIds, hoveredNodeId, pinnedNodeId, onNodeClick, isEmpty]);

  /** 노드 싱글 클릭 핸들러 - Pin 토글 */
  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setPinnedNodeId(prev => prev === node.id ? null : node.id);
  }, []);

  /** 노드 더블 클릭 핸들러 - 네비게이션 */
  const handleNodeDoubleClick: NodeMouseHandler = useCallback((_event, node) => {
    if (onNodeClick) {
      onNodeClick(node.id);
    }
  }, [onNodeClick]);

  /** 노드 hover 진입 */
  const handleNodeMouseEnter: NodeMouseHandler = useCallback((_event, node) => {
    setHoveredNodeId(node.id);
  }, []);

  /** 노드 hover 이탈 */
  const handleNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  /** 캔버스(pane) 클릭 시 hover + pin 해제 */
  const handlePaneClick = useCallback(() => {
    setHoveredNodeId(null);
    setPinnedNodeId(null);
  }, []);

  /** Pin 정보 바에 표시할 데이터 */
  const pinInfo = useMemo(() => {
    if (!pinnedNodeId || isEmpty) return null;

    const connectedProjects = new Set<string>();
    const linkTypes = new Set<string>();
    const apis: string[] = [];

    links.forEach(link => {
      if (link.source === pinnedNodeId || link.target === pinnedNodeId) {
        const otherProject = link.source === pinnedNodeId ? link.target : link.source;
        connectedProjects.add(otherProject);
        linkTypes.add(LINK_TYPE_LABELS[link.type] || link.type);
        if (link.apis) {
          apis.push(...link.apis);
        }
      }
    });

    return {
      projectId: pinnedNodeId,
      connectedCount: connectedProjects.size,
      linkCount: links.filter(l => l.source === pinnedNodeId || l.target === pinnedNodeId).length,
      linkTypes: Array.from(linkTypes),
      apis: [...new Set(apis)],
    };
  }, [pinnedNodeId, links, isEmpty]);

  if (isEmpty) {
    return (
      <div data-testid="cross-project-diagram-empty" className="text-sm text-gray-400 py-8 text-center">
        등록된 프로젝트 의존성이 없습니다
      </div>
    );
  }

  // Hover 하이라이트를 CSS로 처리 - 노드 객체 재생성 방지 (BUG-009)
  const hoverCss = useMemo(() => {
    if (pinnedNodeId || !hoveredNodeId) return null;
    const nodeIds = new Set<string>([hoveredNodeId]);
    const edgeIds = new Set<string>();
    links.forEach((link, idx) => {
      if (link.source === hoveredNodeId || link.target === hoveredNodeId) {
        nodeIds.add(link.source);
        nodeIds.add(link.target);
        edgeIds.add(`edge-${idx}`);
      }
    });
    const scope = '[data-testid="cross-project-diagram"]';
    const nodeSel = Array.from(nodeIds)
      .map(id => `${scope} .react-flow__node[data-id="${id}"]`)
      .join(',');
    const edgeSel = edgeIds.size > 0
      ? Array.from(edgeIds)
          .map(id => `${scope} [data-testid="rf__edge-${id}"]`)
          .join(',')
      : null;
    return `
      ${scope} .react-flow__node { opacity: 0.3 !important; transition: opacity 0.2s ease !important; }
      ${nodeSel} { opacity: 1 !important; }
      ${scope} .react-flow__edge { opacity: 0.15 !important; transition: opacity 0.2s ease !important; }
      ${edgeSel ? `${edgeSel} { opacity: 1 !important; }` : ''}
    `;
  }, [hoveredNodeId, pinnedNodeId, links]);

  return (
    <div data-testid="cross-project-diagram">
      {hoverCss && <style>{hoverCss}</style>}
      <div style={{ height: 400, width: '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodeMouseEnter={handleNodeMouseEnter}
          onNodeMouseLeave={handleNodeMouseLeave}
          onPaneClick={handlePaneClick}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          panOnDrag={false}
          panOnScroll={false}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={onNodeClick ? true : false}
          proOptions={{ hideAttribution: true }}
        />
      </div>
      {pinInfo && (
        <div
          data-testid="pin-info-bar"
          className="mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-xs"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-blue-800">
              📌 {pinInfo.projectId}
            </span>
            <span className="text-blue-600">
              연결 프로젝트: {pinInfo.connectedCount}개
            </span>
            <span className="text-blue-600">
              링크: {pinInfo.linkCount}개
            </span>
            {pinInfo.linkTypes.length > 0 && (
              <span className="text-blue-500">
                ({pinInfo.linkTypes.map(t => safeString(t)).join(', ')})
              </span>
            )}
            {pinInfo.apis.length > 0 && (
              <span className="text-blue-500">
                API: {pinInfo.apis.map(a => safeString(a)).join(', ')}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CrossProjectDiagram;
