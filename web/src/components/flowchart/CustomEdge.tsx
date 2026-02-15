/**
 * @module web/components/flowchart/CustomEdge
 * @description 커스텀 엣지 - 연결 유형에 따라 다른 스타일 적용
 * - normal: 1.5px solid #94A3B8
 * - strong: 2.5px solid #475569 with arrow
 * - weak: 1px dashed #CBD5E1
 * - 선택된 노드의 연결 엣지는 등급 색상으로 하이라이트, 나머지는 20% 투명도
 */

import { memo } from 'react';
import {
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import type { CustomEdgeData } from './types';
import { GRADE_COLORS } from '../../utils/colors';
import { useFlowStore } from '../../stores/flowStore';

type Props = EdgeProps & { data?: CustomEdgeData };

function CustomEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  source,
  target,
  data,
  markerEnd,
}: Props) {
  const selectedNodeId = useFlowStore((s) => s.selectedNodeId);
  const edgeType = data?.edgeType || 'normal';
  const sourceGrade = data?.sourceGrade;

  // 경로 계산
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });

  // 선택된 노드가 있을 때 연결된 엣지만 하이라이트
  const isConnected =
    selectedNodeId != null && (source === selectedNodeId || target === selectedNodeId);
  const hasSelection = selectedNodeId != null;

  // 엣지 타입별 기본 스타일
  let strokeWidth = 1.5;
  let strokeColor = '#94A3B8';
  let strokeDasharray: string | undefined;
  let effectiveMarkerEnd = markerEnd;

  switch (edgeType) {
    case 'strong':
      strokeWidth = 2.5;
      strokeColor = '#475569';
      effectiveMarkerEnd = 'url(#arrowhead)';
      break;
    case 'weak':
      strokeWidth = 1;
      strokeColor = '#CBD5E1';
      strokeDasharray = '5 3';
      break;
    default:
      break;
  }

  // 선택 상태에 따른 스타일 조정
  let opacity = 1;
  if (hasSelection) {
    if (isConnected) {
      // 연결된 엣지: 등급 색상으로 하이라이트
      if (sourceGrade && GRADE_COLORS[sourceGrade]) {
        strokeColor = GRADE_COLORS[sourceGrade].bar;
      }
      strokeWidth = Math.max(strokeWidth, 2);
      opacity = 1;
    } else {
      // 연결되지 않은 엣지: 20% 투명도
      opacity = 0.2;
    }
  }

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: strokeColor,
        strokeWidth,
        strokeDasharray,
        opacity,
        transition: 'opacity 0.3s, stroke 0.3s, stroke-width 0.2s',
      }}
      markerEnd={effectiveMarkerEnd}
    />
  );
}

export default memo(CustomEdgeComponent);
