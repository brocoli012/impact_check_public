/**
 * @module web/components/flowchart/CheckNode
 * @description 기획 확인 노드 - 다이아몬드 형태, 기획 확인 필요 항목 표시
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CheckNodeData } from './types';

type Props = NodeProps & { data: CheckNodeData };

const URGENCY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  high: { bg: '#FEF2F2', border: '#EF4444', text: '#B91C1C' },
  medium: { bg: '#FFF7ED', border: '#F97316', text: '#C2410C' },
  low: { bg: '#F0FDF4', border: '#22C55E', text: '#15803D' },
};

const URGENCY_LABELS: Record<string, string> = {
  high: '긴급',
  medium: '보통',
  low: '낮음',
};

function CheckNodeComponent({ data, selected }: Props) {
  const urgency = URGENCY_COLORS[data.urgency] || URGENCY_COLORS.medium;

  return (
    <div style={{ position: 'relative', width: 140, height: 140 }}>
      {/* 상단 연결 핸들 */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#8B5CF6', width: 7, height: 7, top: -4 }}
      />

      {/* 다이아몬드 형태 */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 100,
          height: 100,
          transform: 'translate(-50%, -50%) rotate(45deg)',
          background: '#F5F3FF',
          border: `2px solid #8B5CF6`,
          borderRadius: 4,
          boxShadow: selected
            ? '0 0 0 3px rgba(139,92,246,0.3)'
            : '0 1px 4px rgba(0,0,0,0.08)',
        }}
      />

      {/* 내용 (회전하지 않은 상태로 중앙에 표시) */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          width: 120,
          zIndex: 1,
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: '#6D28D9',
            fontWeight: 700,
            marginBottom: 4,
          }}
        >
          기획 확인
        </div>
        <div
          style={{
            fontSize: 10,
            color: '#4C1D95',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {data.label}
        </div>
        <span
          style={{
            display: 'inline-block',
            marginTop: 4,
            fontSize: 9,
            fontWeight: 600,
            background: urgency.bg,
            color: urgency.text,
            border: `1px solid ${urgency.border}`,
            padding: '0px 4px',
            borderRadius: 4,
          }}
        >
          {URGENCY_LABELS[data.urgency] || data.urgency}
        </span>
      </div>

      {/* 하단 연결 핸들은 없음 (리프 노드) */}
    </div>
  );
}

export default memo(CheckNodeComponent);
