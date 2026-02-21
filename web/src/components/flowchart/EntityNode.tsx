/**
 * @module web/components/flowchart/EntityNode
 * @description 엔티티 노드 - 공유 테이블/DB 엔티티 표시
 * Phase D: TASK-108
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

/** 엔티티 노드 데이터 */
export interface EntityNodeData {
  /** 테이블/엔티티 이름 */
  label: string;
  /** 참조하는 프로젝트 목록 */
  projects: string[];
  /** 컬럼/필드 수 */
  fieldCount?: number;
  /** 공유 여부 (2+ 프로젝트 참조) */
  isShared: boolean;
  [key: string]: unknown;
}

type Props = NodeProps & { data: EntityNodeData };

function EntityNodeComponent({ data, selected }: Props) {
  const borderColor = data.isShared ? '#3B82F6' : '#9CA3AF';
  const bgColor = data.isShared ? '#EFF6FF' : '#F9FAFB';

  return (
    <div
      data-testid="entity-node"
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
        TABLE
      </span>

      {/* 테이블 이름 */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#1E3A5F',
          marginTop: 4,
          marginBottom: 4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {data.label}
      </div>

      {/* 프로젝트 목록 */}
      <div style={{ fontSize: 10, color: '#6B7280' }}>
        {data.projects.length}개 프로젝트
      </div>

      {/* 필드 수 */}
      {data.fieldCount !== undefined && (
        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>
          {data.fieldCount}개 필드
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: borderColor, width: 8, height: 8 }}
      />
    </div>
  );
}

export default memo(EntityNodeComponent);
