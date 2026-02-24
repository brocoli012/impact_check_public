/**
 * @module web/components/cross-project/EdgeTooltip
 * @description TASK-108: 엣지 호버 시 표시되는 툴팁 컴포넌트
 * 링크 타입, 소스/타겟 프로젝트, autoDetected 여부 표시
 */

import { LINK_TYPE_COLORS, LINK_TYPE_LABELS } from '../../utils/linkTypeConstants';

export interface EdgeTooltipProps {
  linkType: string;
  sourceProject: string;
  targetProject: string;
  autoDetected?: boolean;
  position: { x: number; y: number };
  visible: boolean;
}

function EdgeTooltip({
  linkType,
  sourceProject,
  targetProject,
  autoDetected,
  position,
  visible,
}: EdgeTooltipProps) {
  if (!visible) return null;

  const color = LINK_TYPE_COLORS[linkType] || '#94A3B8';
  const label = LINK_TYPE_LABELS[linkType] || linkType;

  return (
    <div
      style={{
        position: 'absolute',
        left: position.x + 10,
        top: position.y - 10,
        zIndex: 100,
        pointerEvents: 'none',
        background: '#1E293B',
        borderRadius: 8,
        padding: '10px 14px',
        minWidth: 180,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        border: '1px solid #334155',
      }}
    >
      {/* 링크 타입 색상 바 + 라벨 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          style={{
            width: 4,
            height: 20,
            borderRadius: 2,
            background: color,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>
          {label}
        </span>
      </div>

      {/* 소스 -> 타겟 */}
      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: autoDetected ? 6 : 0 }}>
        <span style={{ color: '#CBD5E1', fontWeight: 600 }}>{sourceProject}</span>
        <span style={{ margin: '0 6px', color: '#475569' }}>&rarr;</span>
        <span style={{ color: '#CBD5E1', fontWeight: 600 }}>{targetProject}</span>
      </div>

      {/* autoDetected 배지 */}
      {autoDetected && (
        <span
          style={{
            display: 'inline-block',
            fontSize: 9,
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 4,
            background: 'rgba(59,130,246,0.2)',
            color: '#93C5FD',
          }}
        >
          Auto-detected
        </span>
      )}
    </div>
  );
}

export default EdgeTooltip;
