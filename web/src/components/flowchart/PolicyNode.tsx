/**
 * @module web/components/flowchart/PolicyNode
 * @description 정책 변경 노드 - 헥사곤(육각형) 형태, 정책 변경 항목 표시
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { PolicyNodeData } from './types';

type Props = NodeProps & { data: PolicyNodeData };

function PolicyNodeComponent({ data, selected }: Props) {
  const w = 160;
  const h = 100;
  // Hexagon points (25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)
  const points = `${w * 0.25},0 ${w * 0.75},0 ${w},${h * 0.5} ${w * 0.75},${h} ${w * 0.25},${h} 0,${h * 0.5}`;

  return (
    <div
      style={{
        width: w,
        height: h,
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      {/* 상단 연결 핸들 */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#EC4899', width: 7, height: 7, top: -4 }}
      />

      {/* SVG 헥사곤 배경 + 테두리 */}
      <svg
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
      >
        {/* 선택 시 glow 효과 */}
        {selected && (
          <polygon
            points={points}
            fill="none"
            stroke="rgba(236,72,153,0.3)"
            strokeWidth={6}
          />
        )}
        {/* 배경 + 테두리 */}
        <polygon
          points={points}
          fill="#FFF1F2"
          stroke="#EC4899"
          strokeWidth={2}
        />
      </svg>

      {/* 내용 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 20px',
          zIndex: 1,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#BE185D',
            marginBottom: 3,
          }}
        >
          정책 변경
        </div>
        <div
          style={{
            fontSize: 10,
            color: '#831843',
            textAlign: 'center',
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
        {data.requiresReview && (
          <span
            style={{
              marginTop: 3,
              fontSize: 9,
              color: '#EC4899',
              fontWeight: 600,
            }}
          >
            검토 필요
          </span>
        )}
      </div>
    </div>
  );
}

export default memo(PolicyNodeComponent);
