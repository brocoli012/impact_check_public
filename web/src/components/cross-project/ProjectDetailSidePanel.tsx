/**
 * @module web/components/cross-project/ProjectDetailSidePanel
 * @description TASK-110: 프로젝트 상세 정보 사이드 패널
 * 선택된 프로젝트의 도메인, 기술 스택, 통계, 연결 링크 표시
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProjectInfo } from '../../types';
import type { ProjectLink } from './CrossProjectDiagram';
import { LINK_TYPE_COLORS, LINK_TYPE_LABELS } from '../../utils/linkTypeConstants';
import { GRADE_COLORS } from '../../utils/colors';
import type { Grade } from '../../types';

export interface ProjectDetailSidePanelProps {
  project: ProjectInfo | null;
  links: ProjectLink[];
  onClose: () => void;
}

function ProjectDetailSidePanel({ project, links, onClose }: ProjectDetailSidePanelProps) {
  const navigate = useNavigate();

  const { incoming, outgoing } = useMemo(() => {
    if (!project) return { incoming: [], outgoing: [] };
    return {
      incoming: links.filter((l) => l.target === project.id),
      outgoing: links.filter((l) => l.source === project.id),
    };
  }, [project, links]);

  if (!project) return null;

  const gradeColor = project.latestGrade ? GRADE_COLORS[project.latestGrade as Grade] : null;

  return (
    <div
      data-testid="project-detail-side-panel"
      style={{
        background: 'white',
        borderRadius: 10,
        border: '1px solid #E2E8F0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #F1F5F9' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              프로젝트
            </span>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1E293B', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {project.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              marginLeft: 8,
              padding: 4,
              borderRadius: 4,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#94A3B8',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 등급 + 점수 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          {gradeColor && project.latestGrade && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 6,
                background: gradeColor.bg,
                color: gradeColor.text,
                border: `1px solid ${gradeColor.border}`,
              }}
            >
              {project.latestGrade}
            </span>
          )}
          {project.latestScore !== null && (
            <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
              점수: {project.latestScore}
            </span>
          )}
        </div>
      </div>

      {/* Content (scrollable) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {/* 도메인 태그 */}
        {project.domains && project.domains.length > 0 && (
          <SectionBlock title="도메인">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {project.domains.map((domain) => (
                <span
                  key={domain}
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: '#EFF6FF',
                    color: '#3B82F6',
                  }}
                >
                  {domain}
                </span>
              ))}
            </div>
          </SectionBlock>
        )}

        {/* 기술 스택 */}
        {project.techStack.length > 0 && (
          <SectionBlock title="기술 스택">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {project.techStack.map((tech) => (
                <span
                  key={tech}
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: '#F1F5F9',
                    color: '#475569',
                  }}
                >
                  {tech}
                </span>
              ))}
            </div>
          </SectionBlock>
        )}

        {/* 통계 */}
        <SectionBlock title="통계">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <StatItem label="분석 결과" value={project.resultCount} />
            <StatItem label="작업 수" value={project.taskCount} />
            <StatItem label="정책 경고" value={project.policyWarningCount} />
          </div>
        </SectionBlock>

        {/* Incoming 링크 */}
        {incoming.length > 0 && (
          <SectionBlock title={`Incoming (${incoming.length})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {incoming.map((link) => (
                <LinkItem key={link.id} link={link} direction="incoming" />
              ))}
            </div>
          </SectionBlock>
        )}

        {/* Outgoing 링크 */}
        {outgoing.length > 0 && (
          <SectionBlock title={`Outgoing (${outgoing.length})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {outgoing.map((link) => (
                <LinkItem key={link.id} link={link} direction="outgoing" />
              ))}
            </div>
          </SectionBlock>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #F1F5F9' }}>
        <button
          onClick={() => navigate(`/?project=${encodeURIComponent(project.id)}`)}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 6,
            border: 'none',
            background: '#3B82F6',
            color: 'white',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
        >
          프로젝트 보드로 이동
        </button>
      </div>
    </div>
  );
}

/** 섹션 블록 */
function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>
        {title}
      </h4>
      {children}
    </div>
  );
}

/** 통계 아이템 */
function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: '#F8FAFC', borderRadius: 6, padding: '6px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#1E293B' }}>{value}</div>
      <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{label}</div>
    </div>
  );
}

/** 링크 아이템 */
function LinkItem({ link, direction }: { link: ProjectLink; direction: 'incoming' | 'outgoing' }) {
  const color = LINK_TYPE_COLORS[link.type] || '#94A3B8';
  const label = LINK_TYPE_LABELS[link.type] || link.type;
  const peer = direction === 'incoming' ? link.source : link.target;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 8px',
        borderRadius: 4,
        background: '#F8FAFC',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>{peer}</span>
        <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 6 }}>{label}</span>
      </div>
      {link.autoDetected && (
        <span style={{ fontSize: 9, color: '#93C5FD', background: 'rgba(59,130,246,0.1)', padding: '1px 4px', borderRadius: 3 }}>
          auto
        </span>
      )}
    </div>
  );
}

export default ProjectDetailSidePanel;
