/**
 * @module web/components/flowchart/FeatureNode
 * @description 기능 노드 - 개별 작업(Task/Feature) 표시
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FeatureNodeData } from './types';
import { GRADE_COLORS } from '../../utils/colors';

type Props = NodeProps & { data: FeatureNodeData };

const WORK_TYPE_LABELS: Record<string, string> = {
  new: '신규',
  modify: '수정',
  config: '설정',
};

function FeatureNodeComponent({ data, selected }: Props) {
  const gradeColor = GRADE_COLORS[data.grade];

  return (
    <div
      style={{
        width: 180,
        minHeight: 80,
        borderRadius: 8,
        background: `${gradeColor.bg}`,
        border: `1.5px solid ${gradeColor.border}80`,
        padding: '8px 10px',
        boxShadow: selected
          ? `0 0 0 2px ${gradeColor.border}40`
          : '0 1px 3px rgba(0,0,0,0.06)',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
        position: 'relative',
      }}
    >
      {/* 상단 연결 핸들 */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: gradeColor.border, width: 7, height: 7 }}
      />

      {/* 기능 이름 */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: gradeColor.text,
          marginBottom: 6,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {data.label}
      </div>

      {/* 작업 유형 + 점수 + FE/BE */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span
          style={{
            fontSize: 10,
            background: '#F1F5F9',
            border: '1px solid #CBD5E1',
            color: '#475569',
            padding: '1px 5px',
            borderRadius: 4,
          }}
        >
          {WORK_TYPE_LABELS[data.workType] || data.workType}
        </span>

        <span style={{ fontSize: 10, color: '#64748B' }}>
          {data.score}점
        </span>

        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: data.taskType === 'FE' ? '#3B82F6' : '#10B981',
            background: data.taskType === 'FE' ? '#EFF6FF' : '#ECFDF5',
            padding: '1px 5px',
            borderRadius: 4,
          }}
        >
          {data.taskType}
        </span>
      </div>

      {/* 하단 연결 핸들 */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: gradeColor.border, width: 7, height: 7 }}
      />
    </div>
  );
}

export default memo(FeatureNodeComponent);
