/**
 * @module web/components/flowchart/ModuleNode
 * @description 모듈 노드 - 영향받는 파일/모듈 표시
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ModuleNodeData } from './types';

type Props = NodeProps & { data: ModuleNodeData };

function ModuleNodeComponent({ data, selected }: Props) {
  const isFE = data.taskType === 'FE';
  const bgColor = isFE ? '#EFF6FF' : '#ECFDF5';
  const borderColor = isFE ? '#3B82F6' : '#10B981';
  const tagColor = isFE ? '#3B82F6' : '#10B981';

  return (
    <div
      style={{
        width: 160,
        minHeight: 56,
        borderRadius: 6,
        background: bgColor,
        border: `1px solid ${borderColor}`,
        padding: '6px 8px',
        boxShadow: selected
          ? `0 0 0 2px ${borderColor}40`
          : '0 1px 2px rgba(0,0,0,0.05)',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
        position: 'relative',
      }}
    >
      {/* 상단 연결 핸들 */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: borderColor, width: 6, height: 6 }}
      />

      {/* [FE] / [BE] 태그 + 파일명 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontWeight: 700,
            color: tagColor,
            fontSize: 10,
          }}
        >
          [{data.taskType}]
        </span>
        <span
          style={{
            color: '#334155',
            fontSize: 11,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
          title={data.filePath}
        >
          {data.label}
        </span>
      </div>

      {/* 점수 */}
      <div style={{ fontSize: 10, color: '#64748B' }}>
        점수: {data.score}
      </div>
    </div>
  );
}

export default memo(ModuleNodeComponent);
