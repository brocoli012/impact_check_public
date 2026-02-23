/**
 * @module web/components/cross-project/CrossProjectDiagram
 * @description 크로스 프로젝트 의존성 다이어그램 - @xyflow/react 기반
 * 프로젝트 간 의존성을 노드와 엣지로 시각화
 * TASK-175: hover 하이라이트 + 노드 클릭 네비게이션
 */

import { useMemo, useCallback, useState } from 'react';
import {
  ReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

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

/** 링크 타입별 색상 매핑 */
const LINK_TYPE_COLORS: Record<string, string> = {
  'api-consumer': '#3B82F6',    // blue
  'api-provider': '#10B981',    // green
  'shared-library': '#8B5CF6',  // purple
  'shared-types': '#F59E0B',    // amber
  'event-publisher': '#EF4444', // red
  'event-subscriber': '#EC4899', // pink
};

/** 링크 타입 라벨 */
const LINK_TYPE_LABELS: Record<string, string> = {
  'api-consumer': 'API Consumer',
  'api-provider': 'API Provider',
  'shared-library': 'Shared Lib',
  'shared-types': 'Shared Types',
  'event-publisher': 'Event Pub',
  'event-subscriber': 'Event Sub',
};

function CrossProjectDiagram({ links, onNodeClick }: CrossProjectDiagramProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  if (!links || links.length === 0) {
    return (
      <div data-testid="cross-project-diagram-empty" className="text-sm text-gray-400 py-8 text-center">
        등록된 프로젝트 의존성이 없습니다
      </div>
    );
  }

  // 호버된 노드에 연결된 엣지/노드 ID 계산
  const connectedIds = useMemo(() => {
    if (!hoveredNodeId) return null;
    const connectedNodeIds = new Set<string>([hoveredNodeId]);
    const connectedEdgeIds = new Set<string>();

    links.forEach((link, idx) => {
      if (link.source === hoveredNodeId || link.target === hoveredNodeId) {
        connectedNodeIds.add(link.source);
        connectedNodeIds.add(link.target);
        connectedEdgeIds.add(`edge-${idx}`);
      }
    });

    return { nodeIds: connectedNodeIds, edgeIds: connectedEdgeIds };
  }, [hoveredNodeId, links]);

  const { nodes, edges } = useMemo(() => {
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

      // hover 하이라이트: 관련 노드 = 정상, 비관련 노드 = 반투명
      const isHighlighted = !connectedIds || connectedIds.nodeIds.has(projectId);
      const isHovered = hoveredNodeId === projectId;

      return {
        id: projectId,
        type: 'default',
        position: { x, y },
        data: { label: `${projectId} (${count})` },
        style: {
          background: isHovered ? '#DBEAFE' : '#F3F4F6',
          border: isHovered ? '2px solid #3B82F6' : '2px solid #6B7280',
          borderRadius: 8,
          fontSize: 11,
          fontWeight: 600,
          padding: '6px 10px',
          width: 140,
          textAlign: 'center' as const,
          opacity: isHighlighted ? 1 : 0.3,
          transition: 'opacity 0.2s ease, background 0.2s ease, border-color 0.2s ease',
          cursor: onNodeClick ? 'pointer' : 'default',
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
  }, [links, connectedIds, hoveredNodeId, onNodeClick]);

  /** 노드 클릭 핸들러 */
  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
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

  /** 캔버스(pane) 클릭 시 hover 해제 */
  const handlePaneClick = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  return (
    <div data-testid="cross-project-diagram">
      <div style={{ height: 400, width: '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={handleNodeClick}
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
    </div>
  );
}

export default CrossProjectDiagram;
