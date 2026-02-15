/**
 * @module web/hooks/useFlowLayout
 * @description dagre를 이용한 자동 레이아웃 훅 - Top-to-Bottom 트리 구조 배치
 */

import { useMemo } from 'react';
import dagre from 'dagre';
import { Position, type Node, type Edge } from '@xyflow/react';

/** 노드 타입별 기본 크기 */
const NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  requirement: { width: 260, height: 130 },
  system: { width: 240, height: 120 },
  screen: { width: 200, height: 100 },
  feature: { width: 180, height: 80 },
  module: { width: 160, height: 56 },
  check: { width: 140, height: 140 },
  policy: { width: 160, height: 100 },
  policyWarning: { width: 200, height: 100 },
};

interface UseFlowLayoutOptions {
  /** 랭크 간격 (기본: 100) */
  rankSep?: number;
  /** 노드 간격 (기본: 60) */
  nodeSep?: number;
  /** 방향 (기본: TB) */
  direction?: 'TB' | 'BT' | 'LR' | 'RL';
}

/**
 * dagre를 이용해 노드와 엣지에 자동 레이아웃 적용
 * @param nodes - React Flow 노드 배열
 * @param edges - React Flow 엣지 배열
 * @param options - 레이아웃 옵션
 * @returns 레이아웃이 적용된 노드 배열
 */
export function useFlowLayout(
  nodes: Node[],
  edges: Edge[],
  options: UseFlowLayoutOptions = {},
) {
  const { rankSep = 100, nodeSep = 60, direction = 'TB' } = options;

  const layoutedNodes = useMemo(() => {
    if (nodes.length === 0) return nodes;

    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({
      rankdir: direction,
      ranksep: rankSep,
      nodesep: nodeSep,
      marginx: 40,
      marginy: 40,
    });

    // 노드 추가
    for (const node of nodes) {
      const dims = NODE_DIMENSIONS[node.type || 'screen'] || {
        width: 200,
        height: 100,
      };
      g.setNode(node.id, { width: dims.width, height: dims.height });
    }

    // 엣지 추가
    for (const edge of edges) {
      g.setEdge(edge.source, edge.target);
    }

    // 레이아웃 계산
    dagre.layout(g);

    // 레이아웃 결과를 노드에 적용
    return nodes.map((node) => {
      const dagreNode = g.node(node.id);
      if (!dagreNode) return node;

      const dims = NODE_DIMENSIONS[node.type || 'screen'] || {
        width: 200,
        height: 100,
      };

      const isHorizontal = direction === 'LR' || direction === 'RL';

      return {
        ...node,
        position: {
          x: dagreNode.x - dims.width / 2,
          y: dagreNode.y - dims.height / 2,
        },
        sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
        targetPosition: isHorizontal ? Position.Left : Position.Top,
      };
    });
  }, [nodes, edges, direction, rankSep, nodeSep]);

  return layoutedNodes;
}
