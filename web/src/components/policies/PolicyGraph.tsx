/**
 * @module web/components/policies/PolicyGraph
 * @description 영향 범위 미니 그래프 컴포넌트 - @xyflow/react 기반
 * 중앙에 정책 노드, 주변에 관련 파일 노드 표시 (최대 10개)
 */

import { useMemo } from 'react';
import {
  ReactFlow,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface PolicyGraphProps {
  /** 정책 이름 (중앙 노드 라벨) */
  policyName: string;
  /** 영향 받는 파일 목록 */
  affectedFiles: string[];
}

/** 파일 경로에서 파일명만 추출 */
function getFileName(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] || filePath;
}

/** 원형 배치 좌표 계산 */
function getCircularPosition(
  index: number,
  total: number,
  centerX: number,
  centerY: number,
  radius: number,
): { x: number; y: number } {
  const angle = (2 * Math.PI * index) / total - Math.PI / 2;
  return {
    x: centerX + radius * Math.cos(angle) - 60,
    y: centerY + radius * Math.sin(angle) - 15,
  };
}

function PolicyGraph({ policyName, affectedFiles }: PolicyGraphProps) {
  if (!affectedFiles || affectedFiles.length === 0) {
    return (
      <div data-testid="policy-graph-empty" className="text-xs text-gray-400 py-2">
        영향 범위 정보가 없습니다
      </div>
    );
  }

  // 최대 10개만 표시
  const displayFiles = affectedFiles.slice(0, 10);
  const hasMore = affectedFiles.length > 10;

  const { nodes, edges } = useMemo(() => {
    const centerX = 200;
    const centerY = 120;
    const radius = 100;

    const policyNode: Node = {
      id: 'policy-center',
      type: 'default',
      position: { x: centerX - 50, y: centerY - 15 },
      data: { label: policyName },
      style: {
        background: '#FEF3C7',
        border: '2px solid #F59E0B',
        borderRadius: 8,
        fontSize: 10,
        fontWeight: 700,
        padding: '4px 8px',
        width: 100,
        textAlign: 'center' as const,
      },
    };

    const fileNodes: Node[] = displayFiles.map((file, idx) => {
      const pos = getCircularPosition(idx, displayFiles.length, centerX, centerY, radius);
      return {
        id: `file-${idx}`,
        type: 'default',
        position: pos,
        data: { label: getFileName(file) },
        style: {
          background: '#EFF6FF',
          border: '1px solid #93C5FD',
          borderRadius: 6,
          fontSize: 9,
          padding: '3px 6px',
          width: 120,
          textAlign: 'center' as const,
        },
      };
    });

    const fileEdges: Edge[] = displayFiles.map((_file, idx) => ({
      id: `edge-${idx}`,
      source: 'policy-center',
      target: `file-${idx}`,
      style: { stroke: '#CBD5E1', strokeWidth: 1 },
    }));

    return {
      nodes: [policyNode, ...fileNodes],
      edges: fileEdges,
    };
  }, [policyName, displayFiles]);

  return (
    <div data-testid="policy-graph">
      <div style={{ height: 300, width: '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          panOnDrag={false}
          panOnScroll={false}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        />
      </div>
      {hasMore && (
        <p className="text-[10px] text-gray-400 text-center mt-1">
          외 {affectedFiles.length - 10}개 파일
        </p>
      )}
    </div>
  );
}

export default PolicyGraph;
