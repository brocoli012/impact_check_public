/**
 * @module web/components/cross-project/ProjectFlowNode
 * @description TASK-107: 크로스 프로젝트 플로우 다이어그램용 커스텀 노드
 * 프로젝트 정보(도메인, 기술 스택, 통계, 등급)를 다크 블루 카드로 표시
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { safeString } from '../../utils/safeString';

export interface ProjectFlowNodeData {
  [key: string]: unknown;
  label: string;
  projectId: string;
  domains?: string[];
  techStack?: string[];
  screenCount?: number;
  apiCount?: number;
  latestGrade?: string | null;
  /** 노드 dim 처리 여부 (hover 하이라이트용) */
  dimmed?: boolean;
}

/** 도메인 태그 색상 (다크 배경용) */
const DOMAIN_COLORS_DARK = [
  { bg: 'rgba(59,130,246,0.25)', text: '#93C5FD' },
  { bg: 'rgba(99,102,241,0.25)', text: '#A5B4FC' },
  { bg: 'rgba(20,184,166,0.25)', text: '#5EEAD4' },
  { bg: 'rgba(217,119,6,0.25)', text: '#FCD34D' },
  { bg: 'rgba(236,72,153,0.25)', text: '#F9A8D4' },
  { bg: 'rgba(168,85,247,0.25)', text: '#D8B4FE' },
  { bg: 'rgba(5,150,105,0.25)', text: '#6EE7B7' },
  { bg: 'rgba(100,116,139,0.25)', text: '#CBD5E1' },
];

/** 등급별 색상 */
const GRADE_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  Low: { bg: 'rgba(34,197,94,0.25)', text: '#86EFAC' },
  Medium: { bg: 'rgba(234,179,8,0.25)', text: '#FDE047' },
  High: { bg: 'rgba(249,115,22,0.25)', text: '#FDBA74' },
  Critical: { bg: 'rgba(239,68,68,0.25)', text: '#FCA5A5' },
};

type Props = NodeProps & { data: ProjectFlowNodeData };

function ProjectFlowNodeComponent({ data, selected }: Props) {
  const domains = data.domains ?? [];
  const techStack = data.techStack ?? [];
  const grade = data.latestGrade;
  const gradeColor = grade ? GRADE_BADGE_COLORS[grade] : null;
  const dimmed = data.dimmed ?? false;

  return (
    <div
      style={{
        width: 240,
        minHeight: 140,
        borderRadius: 10,
        background: '#1E3A5F',
        color: 'white',
        padding: '12px 14px',
        border: selected ? '2px solid #60A5FA' : '2px solid #2D5A8E',
        boxShadow: selected
          ? '0 0 0 3px rgba(96,165,250,0.3)'
          : '0 2px 6px rgba(0,0,0,0.12)',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s, border-color 0.2s, opacity 0.2s',
        position: 'relative',
        opacity: dimmed ? 0.3 : 1,
      }}
    >
      {/* 상단 핸들 (target) */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#64748B', width: 8, height: 8 }}
      />

      {/* 도메인 태그 */}
      {domains.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {domains.slice(0, 3).map((domain, idx) => {
            const color = DOMAIN_COLORS_DARK[idx % DOMAIN_COLORS_DARK.length];
            const domainStr = safeString(domain);
            return (
              <span
                key={domainStr || idx}
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: color.bg,
                  color: color.text,
                  whiteSpace: 'nowrap',
                }}
              >
                {domainStr}
              </span>
            );
          })}
          {domains.length > 3 && (
            <span style={{ fontSize: 9, color: '#94A3B8' }}>
              +{domains.length - 3}
            </span>
          )}
        </div>
      )}

      {/* 프로젝트명 + 등급 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            marginRight: 6,
          }}
        >
          {data.label}
        </div>
        {gradeColor && grade && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 6,
              background: gradeColor.bg,
              color: gradeColor.text,
              whiteSpace: 'nowrap',
            }}
          >
            {grade}
          </span>
        )}
      </div>

      {/* 통계 미니 그리드 */}
      <div
        style={{
          display: 'flex',
          borderRadius: 6,
          background: 'rgba(255,255,255,0.1)',
          overflow: 'hidden',
          marginBottom: 8,
        }}
      >
        <div style={{ flex: 1, padding: '4px 8px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{data.screenCount ?? 0}</div>
          <div style={{ fontSize: 9, opacity: 0.7 }}>화면</div>
        </div>
        <div style={{ flex: 1, padding: '4px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{data.apiCount ?? 0}</div>
          <div style={{ fontSize: 9, opacity: 0.7 }}>API</div>
        </div>
      </div>

      {/* 기술 스택 태그 */}
      {techStack.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {techStack.slice(0, 4).map((tech, idx) => {
            const techStr = safeString(tech);
            return (
              <span
                key={techStr || idx}
                style={{
                  fontSize: 9,
                  fontWeight: 500,
                  padding: '1px 5px',
                  borderRadius: 3,
                  background: 'rgba(255,255,255,0.08)',
                  color: '#94A3B8',
                }}
              >
                {techStr}
              </span>
            );
          })}
          {techStack.length > 4 && (
            <span style={{ fontSize: 9, color: '#64748B' }}>
              +{techStack.length - 4}
            </span>
          )}
        </div>
      )}

      {/* 하단 핸들 (source) */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#64748B', width: 8, height: 8 }}
      />
    </div>
  );
}

export const ProjectFlowNode = memo(ProjectFlowNodeComponent);
export default ProjectFlowNode;
