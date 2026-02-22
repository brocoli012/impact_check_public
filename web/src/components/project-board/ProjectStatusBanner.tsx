/**
 * @module web/components/project-board/ProjectStatusBanner
 * @description TASK-132: 프로젝트 기본 정보를 배너 형태로 표시
 */

import type { ProjectInfo } from '../../types';

interface IndexMeta {
  totalFiles: number;
  screens: number;
  components: number;
  apis: number;
  modules: number;
}

interface ProjectStatusBannerProps {
  project: ProjectInfo;
  indexMeta?: IndexMeta | null;
  lastAnalysisDate?: string;
}

function ProjectStatusBanner({ project, indexMeta, lastAnalysisDate }: ProjectStatusBannerProps) {
  return (
    <div
      data-testid="project-status-banner"
      className="bg-white border-l-4 border-purple-500 rounded-lg p-6 shadow-sm"
    >
      <div className="flex items-start justify-between">
        {/* 좌측: 프로젝트명, 경로, 기술 스택 */}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-gray-800">{project.name}</h2>
          <p className="text-xs text-gray-400 font-mono truncate mt-1">{project.path}</p>

          {/* 기술 스택 태그 */}
          {project.techStack.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {project.techStack.map((tech) => (
                <span
                  key={tech}
                  className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full"
                >
                  {tech}
                </span>
              ))}
            </div>
          )}

          {/* 인덱스 통계 */}
          {indexMeta && (
            <div className="mt-4 grid grid-cols-5 gap-2">
              <StatItem label="파일" value={indexMeta.totalFiles} />
              <StatItem label="화면" value={indexMeta.screens} />
              <StatItem label="컴포넌트" value={indexMeta.components} />
              <StatItem label="API" value={indexMeta.apis} />
              <StatItem label="모듈" value={indexMeta.modules} />
            </div>
          )}

          {/* 인덱스 없음 경고 */}
          {!indexMeta && (
            <div className="mt-3 flex items-center gap-2 text-amber-600">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <span className="text-xs" data-testid="index-warning">
                인덱싱이 필요합니다. CLI에서 <code className="font-mono bg-gray-100 px-1 rounded">impact index</code>를 실행하세요.
              </span>
            </div>
          )}
        </div>

        {/* 우측: 상태, 등록일, 마지막 분석일 */}
        <div className="flex flex-col items-end gap-2 ml-4 shrink-0">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              project.status === 'active'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}
            data-testid="project-status-badge"
          >
            {project.status === 'active' ? '활성' : '보관됨'}
          </span>
          <div className="text-xs text-gray-400 text-right space-y-1">
            <p>등록일: {formatDate(project.createdAt)}</p>
            <p>마지막 분석: {lastAnalysisDate ? formatDate(lastAnalysisDate) : '-'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 통계 항목 컴포넌트 */
function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-50 rounded px-2 py-1.5 text-center">
      <div className="text-sm font-bold text-gray-800">{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}

/** 날짜 포맷 헬퍼 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export default ProjectStatusBanner;
