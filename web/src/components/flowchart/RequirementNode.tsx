/**
 * @module web/components/flowchart/RequirementNode
 * @description 요구사항 노드 - 최상위 레벨, 분석 대상 요구사항 표시
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { RequirementNodeData } from './types';
import { GRADE_COLORS } from '../../utils/colors';

type Props = NodeProps & { data: RequirementNodeData };

function RequirementNodeComponent({ data, selected }: Props) {
  const gradeColor = GRADE_COLORS[data.grade];

  return (
    <div
      className="relative"
      style={{
        width: 260,
        minHeight: 130,
        borderRadius: 12,
        border: `3px double #6366F1`,
        background: '#4338CA',
        color: 'white',
        padding: '14px 16px',
        boxShadow: selected
          ? '0 0 0 3px rgba(99,102,241,0.5)'
          : '0 2px 8px rgba(0,0,0,0.15)',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
      }}
    >
      {/* 등급 배지 */}
      <span
        style={{
          position: 'absolute',
          top: -10,
          right: 12,
          background: gradeColor.bar,
          color: 'white',
          fontSize: 11,
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: 10,
        }}
      >
        {data.grade}
      </span>

      {/* 요구사항 이름 */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          marginBottom: 10,
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

      {/* 정보 행 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span style={{ opacity: 0.85 }}>
          영향 시스템: <strong>{data.affectedSystemCount}</strong>개
        </span>
        <span style={{ opacity: 0.85 }}>
          총점: <strong>{data.totalScore}</strong>
        </span>
      </div>

      {/* 하단 연결 핸들 */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#A5B4FC', width: 10, height: 10 }}
      />
    </div>
  );
}

export default memo(RequirementNodeComponent);
