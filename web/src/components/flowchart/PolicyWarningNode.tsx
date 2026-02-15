/**
 * @module web/components/flowchart/PolicyWarningNode
 * @description 정책 경고 노드 - dashed 외곽 테두리, 정책 위반 가능성 표시
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { PolicyWarningNodeData } from './types';

type Props = NodeProps & { data: PolicyWarningNodeData };

const SEVERITY_COLORS: Record<string, { outer: string; inner: string; text: string }> = {
  info: { outer: '#3B82F6', inner: '#3B82F6', text: '#1E40AF' },
  warning: { outer: '#EF4444', inner: '#F97316', text: '#C2410C' },
  critical: { outer: '#EF4444', inner: '#EF4444', text: '#B91C1C' },
};

const SEVERITY_LABELS: Record<string, string> = {
  info: '정보',
  warning: '경고',
  critical: '위험',
};

function PolicyWarningNodeComponent({ data, selected }: Props) {
  const colors = SEVERITY_COLORS[data.severity] || SEVERITY_COLORS.warning;

  return (
    <div
      style={{
        width: 200,
        minHeight: 100,
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      {/* 상단 연결 핸들 */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#F97316', width: 7, height: 7 }}
      />

      {/* 외곽 dashed 테두리 */}
      <div
        style={{
          position: 'absolute',
          inset: -3,
          borderRadius: 10,
          border: `1px dashed ${colors.outer}`,
        }}
      />

      {/* 내부 컨테이너 */}
      <div
        style={{
          borderRadius: 8,
          background: '#FFF7ED',
          border: `2px solid #F97316`,
          padding: '10px 12px',
          boxShadow: selected
            ? `0 0 0 3px rgba(249,115,22,0.3)`
            : '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        {/* 경고 아이콘 + 정책 이름 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginBottom: 6,
          }}
        >
          <span style={{ fontSize: 12 }}>&#9888;</span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: colors.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {data.policyName}
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              background: `${colors.inner}20`,
              color: colors.text,
              padding: '1px 5px',
              borderRadius: 4,
              border: `1px solid ${colors.inner}`,
            }}
          >
            {SEVERITY_LABELS[data.severity] || data.severity}
          </span>
        </div>

        {/* 내용 */}
        <div
          style={{
            fontSize: 11,
            color: '#78350F',
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            marginBottom: 4,
          }}
        >
          {data.label}
        </div>

        {/* 관련 시스템 */}
        {data.relatedSystem && (
          <div style={{ fontSize: 10, color: '#92400E' }}>
            관련: {data.relatedSystem}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(PolicyWarningNodeComponent);
