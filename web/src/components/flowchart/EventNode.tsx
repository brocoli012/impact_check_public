/**
 * @module web/components/flowchart/EventNode
 * @description 이벤트 노드 - 공유 이벤트/메시지 표시
 * Phase D: TASK-108
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

/** 이벤트 노드 데이터 */
export interface EventNodeData {
  /** 이벤트 이름 */
  label: string;
  /** 발행자 프로젝트 목록 */
  publishers: string[];
  /** 구독자 프로젝트 목록 */
  subscribers: string[];
  [key: string]: unknown;
}

type Props = NodeProps & { data: EventNodeData };

function EventNodeComponent({ data, selected }: Props) {
  const borderColor = '#EF4444';
  const bgColor = '#FEF2F2';

  return (
    <div
      data-testid="event-node"
      style={{
        width: 180,
        minHeight: 80,
        borderRadius: 8,
        background: bgColor,
        border: `2px solid ${borderColor}`,
        padding: '8px 12px',
        boxShadow: selected
          ? `0 0 0 3px ${borderColor}40`
          : '0 1px 4px rgba(0,0,0,0.08)',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
        position: 'relative',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: borderColor, width: 8, height: 8 }}
      />

      {/* 타입 배지 */}
      <span
        style={{
          position: 'absolute',
          top: -8,
          left: 10,
          background: borderColor,
          color: 'white',
          fontSize: 9,
          fontWeight: 700,
          padding: '1px 6px',
          borderRadius: 6,
        }}
      >
        EVENT
      </span>

      {/* 이벤트 이름 */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#7F1D1D',
          marginTop: 4,
          marginBottom: 4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {data.label}
      </div>

      {/* Pub/Sub 카운트 */}
      <div style={{ fontSize: 10, color: '#6B7280', display: 'flex', gap: 8 }}>
        <span>Pub: {data.publishers.length}</span>
        <span>Sub: {data.subscribers.length}</span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: borderColor, width: 8, height: 8 }}
      />
    </div>
  );
}

export default memo(EventNodeComponent);
