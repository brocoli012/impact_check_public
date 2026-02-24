/**
 * @module web/components/projects/ProjectCard
 * @description 프로젝트 카드 컴포넌트 - 등급/태스크/정책 요약 표시
 */

import type { ProjectInfo, Grade } from '../../types';
import { GRADE_COLORS } from '../../utils/colors';
import { formatDate } from '../../utils/gradeUtils';
import { DOMAIN_COLORS, getDomainColorIndex } from '../../utils/domainColors';

interface ProjectCardProps {
  project: ProjectInfo;
  isActive: boolean;
  onClick: (projectId: string) => void;
}

/** 등급별 배지 색상 */
function getGradeBadgeClass(grade: Grade | null): string {
  if (!grade) return 'bg-gray-100 text-gray-500';
  const colors = GRADE_COLORS[grade];
  if (!colors) return 'bg-gray-100 text-gray-500';
  return '';
}

function ProjectCard({ project, isActive, onClick }: ProjectCardProps) {
  const gradeColors = project.latestGrade
    ? GRADE_COLORS[project.latestGrade as Grade]
    : null;

  return (
    <div
      data-testid={`project-card-${project.id}`}
      onClick={() => onClick(project.id)}
      className={`
        relative rounded-lg border-2 p-4 cursor-pointer transition-all duration-200
        hover:shadow-md hover:-translate-y-0.5
        ${isActive
          ? 'border-purple-500 bg-purple-50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300'
        }
      `}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(project.id); }}
      aria-label={`프로젝트: ${project.name}`}
    >
      {/* 활성 표시 */}
      {isActive && (
        <span className="absolute top-2 right-2 w-2 h-2 bg-purple-500 rounded-full" />
      )}

      {/* 프로젝트명 + 등급 배지 */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900 truncate pr-2">
          {project.name}
        </h3>
        {project.latestGrade && gradeColors && (
          <span
            className="shrink-0 text-xs font-bold px-2 py-0.5 rounded"
            style={{
              backgroundColor: gradeColors.bg,
              color: gradeColors.text,
              border: `1px solid ${gradeColors.border}`,
            }}
          >
            {project.latestGrade}
          </span>
        )}
        {!project.latestGrade && (
          <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${getGradeBadgeClass(null)}`}>
            -
          </span>
        )}
      </div>

      {/* 도메인 태그 */}
      {project.domains && project.domains.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {project.domains.slice(0, 3).map((domain) => {
            const colorIdx = getDomainColorIndex(domain);
            const color = DOMAIN_COLORS[colorIdx];
            return (
              <span
                key={domain}
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: color.bg, color: color.text }}
              >
                {domain}
              </span>
            );
          })}
          {project.domains.length > 3 && (
            <span className="text-[10px] text-gray-400">+{project.domains.length - 3}</span>
          )}
        </div>
      )}

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center">
          <p className="text-lg font-bold text-gray-800">{project.resultCount}</p>
          <p className="text-[10px] text-gray-500">분석</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-800">{project.taskCount}</p>
          <p className="text-[10px] text-gray-500">태스크</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-800">{project.policyWarningCount}</p>
          <p className="text-[10px] text-gray-500">정책경고</p>
        </div>
      </div>

      {/* 기술 스택 태그 */}
      {project.techStack.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {project.techStack.slice(0, 4).map((tech) => (
            <span
              key={tech}
              className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
            >
              {tech}
            </span>
          ))}
          {project.techStack.length > 4 && (
            <span className="text-[10px] text-gray-400">
              +{project.techStack.length - 4}
            </span>
          )}
        </div>
      )}

      {/* 마지막 분석 일시 */}
      <p className="text-[10px] text-gray-400">
        {project.latestAnalyzedAt
          ? `마지막 분석: ${formatDate(project.latestAnalyzedAt)}`
          : '분석 결과 없음'
        }
      </p>

      {/* 상태 표시 */}
      {project.status === 'archived' && (
        <span className="absolute bottom-2 right-2 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
          보관됨
        </span>
      )}
    </div>
  );
}

export default ProjectCard;
