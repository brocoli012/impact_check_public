/**
 * @module web/components/flowchart/ScreenNode
 * @description 화면 노드 - 영향받는 화면(Screen) 표시
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ScreenNodeData } from './types';
import { GRADE_COLORS } from '../../utils/colors';

type Props = NodeProps & { data: ScreenNodeData };

function ScreenNodeComponent({ data, selected }: Props) {
  const gradeColor = GRADE_COLORS[data.grade];

  return (
    <div
      style={{
        width: 200,
        minHeight: 100,
        borderRadius: 8,
        background: gradeColor.bg,
        border: `2px solid ${gradeColor.border}`,
        padding: '10px 12px',
        boxShadow: selected
          ? `0 0 0 3px ${gradeColor.border}40`
          : '0 1px 4px rgba(0,0,0,0.08)',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        position: 'relative',
      }}
    >
      {/* 상단 연결 핸들 */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: gradeColor.border, width: 8, height: 8 }}
      />

      {/* 등급 배지 (좌측 상단) */}
      <span
        style={{
          position: 'absolute',
          top: -8,
          left: 10,
          background: gradeColor.bar,
          color: 'white',
          fontSize: 10,
          fontWeight: 700,
          padding: '1px 6px',
          borderRadius: 6,
        }}
      >
        {data.grade}
      </span>

      {/* 화면 이름 */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: gradeColor.text,
          marginBottom: 6,
          marginTop: 2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {data.label}
      </div>

      {/* 점수 + FE/BE 카운트 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 11,
          color: '#475569',
        }}
      >
        <span>점수: <strong>{data.score}</strong></span>
        <span>
          FE:{data.feCount} / BE:{data.beCount}
        </span>
      </div>

      {/* 확장/축소 인디케이터 */}
      {data.hasChildren && (
        <div
          style={{
            textAlign: 'center',
            marginTop: 6,
            fontSize: 10,
            color: '#94A3B8',
          }}
        >
          {data.expanded ? '▲ 접기' : '▼ 펼치기'}
        </div>
      )}

      {/* 하단 연결 핸들 */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: gradeColor.border, width: 8, height: 8 }}
      />
    </div>
  );
}

export default memo(ScreenNodeComponent);
