/**
 * @module web/components/flowchart/SystemNode
 * @description 시스템 노드 - 영향받는 시스템 표시
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { SystemNodeData } from './types';
import { GRADE_COLORS, CONFIDENCE_COLORS } from '../../utils/colors';

type Props = NodeProps & { data: SystemNodeData };

function SystemNodeComponent({ data, selected }: Props) {
  const gradeColor = GRADE_COLORS[data.grade];
  const confidenceColor = CONFIDENCE_COLORS[data.confidence];

  const confidenceLabel: Record<string, string> = {
    high: '높음',
    medium: '보통',
    low: '낮음',
    very_low: '매우 낮음',
  };

  return (
    <div
      style={{
        width: 240,
        minHeight: 120,
        borderRadius: 10,
        background: '#1E3A5F',
        color: 'white',
        padding: '12px 14px',
        border: selected ? `2px solid ${gradeColor.bar}` : '2px solid #2D5A8E',
        boxShadow: selected
          ? `0 0 0 3px ${gradeColor.bar}40`
          : '0 2px 6px rgba(0,0,0,0.12)',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        position: 'relative',
      }}
    >
      {/* 상단 연결 핸들 */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#64748B', width: 8, height: 8 }}
      />

      {/* 시스템 이름 */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 8,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {data.label}
      </div>

      {/* 점수 + 등급 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 12, opacity: 0.85 }}>
          점수: <strong>{data.totalScore}</strong>
        </span>
        <span
          style={{
            background: gradeColor.bar,
            color: 'white',
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: 8,
          }}
        >
          {data.grade}
        </span>
      </div>

      {/* 신뢰도 배지 */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          background: `${confidenceColor}20`,
          border: `1px solid ${confidenceColor}`,
          color: confidenceColor,
          padding: '2px 6px',
          borderRadius: 6,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: confidenceColor }} />
        신뢰도: {confidenceLabel[data.confidence] || data.confidence}
      </div>

      {/* 하단 연결 핸들 */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#64748B', width: 8, height: 8 }}
      />
    </div>
  );
}

export default memo(SystemNodeComponent);
