/**
 * @module web/components/dashboard/ProjectOverview
 * @description 프로젝트 현황 컴포넌트 - 3단계 상태 표시
 *
 * 3-stage:
 *   1. 미등록: 프로젝트가 등록되지 않은 상태
 *   2. 인덱싱 완료: 인덱스는 있지만 분석 미실행
 *   3. 분석 완료: 분석 결과가 존재
 *
 * 각 단계별 어노테이션 존재 여부에 따른 추가 정보 표시
 */

import { useEffect, useState } from 'react';

/** 프로젝트 현황 API 응답 */
interface ProjectStatus {
  projectId: string | null;
  projectPath: string | null;
  hasIndex: boolean;
  hasAnnotations: boolean;
  hasResults: boolean;
}

/** 인덱스 메타 */
interface IndexMeta {
  stats?: {
    totalFiles: number;
    screens: number;
    components: number;
    apiEndpoints: number;
    modules: number;
  };
  updatedAt?: string;
  project?: {
    name: string;
    techStack: string[];
  };
}

/** 어노테이션 메타 */
interface AnnotationMeta {
  totalFiles: number;
  totalAnnotations: number;
  totalPolicies: number;
  avgConfidence: number;
  lowConfidenceCount: number;
  lastUpdatedAt?: string;
}

function ProjectOverview() {
  const [status, setStatus] = useState<ProjectStatus | null>(null);
  const [indexMeta, setIndexMeta] = useState<IndexMeta | null>(null);
  const [annotationMeta, setAnnotationMeta] = useState<AnnotationMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProjectData() {
      setLoading(true);
      try {
        const statusRes = await fetch('/api/project/status');
        const statusData = await statusRes.json();
        setStatus(statusData);

        // 인덱스 메타 로드 (hasIndex일 때)
        if (statusData.hasIndex) {
          try {
            const indexRes = await fetch('/api/project/index-meta');
            const indexData = await indexRes.json();
            setIndexMeta(indexData.meta);
          } catch {
            // 무시
          }
        }

        // 어노테이션 메타 로드 (hasAnnotations일 때)
        if (statusData.hasAnnotations) {
          try {
            const annRes = await fetch('/api/project/annotation-meta');
            const annData = await annRes.json();
            setAnnotationMeta(annData.meta);
          } catch {
            // 무시
          }
        }
      } catch {
        // 서버 연결 실패
        setStatus(null);
      } finally {
        setLoading(false);
      }
    }

    fetchProjectData();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-3 bg-gray-100 rounded w-2/3" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
        </div>
      </div>
    );
  }

  // Stage 1: 미등록
  if (!status || !status.projectId) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">프로젝트 미등록</h3>
            <p className="text-xs text-gray-500 mt-1">
              프로젝트를 등록하고 인덱싱을 실행하여 코드 분석을 시작하세요.
            </p>
            <p className="text-xs text-gray-400 mt-2 font-mono">
              /impact init &lt;project-path&gt;
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Stage 2: 인덱싱 완료 (분석 미실행)
  if (status.hasIndex && !status.hasResults) {
    return (
      <div className="bg-white rounded-lg border border-blue-200 p-6">
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-gray-900">
              인덱싱 완료
              <span className="ml-2 text-xs font-normal text-gray-500">{status.projectId}</span>
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              코드 인덱싱이 완료되었습니다. 기획서를 분석하여 영향도를 확인하세요.
            </p>

            {/* 인덱스 통계 */}
            {indexMeta?.stats && (
              <div className="mt-3 grid grid-cols-5 gap-2">
                <StatItem label="파일" value={indexMeta.stats.totalFiles} />
                <StatItem label="화면" value={indexMeta.stats.screens} />
                <StatItem label="컴포넌트" value={indexMeta.stats.components} />
                <StatItem label="API" value={indexMeta.stats.apiEndpoints} />
                <StatItem label="모듈" value={indexMeta.stats.modules} />
              </div>
            )}

            {/* 어노테이션 정보 */}
            {status.hasAnnotations && annotationMeta && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-600">
                    AI 보강
                  </span>
                  <span className="text-xs text-gray-500">
                    함수 {annotationMeta.totalAnnotations}개 / 정책 {annotationMeta.totalPolicies}개 추론
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-gray-500">
                    평균 신뢰도: <span className="font-medium text-gray-700">{Math.round(annotationMeta.avgConfidence * 100)}%</span>
                  </span>
                  {annotationMeta.lowConfidenceCount > 0 && (
                    <span className="text-xs text-amber-600">
                      낮은 신뢰도 {annotationMeta.lowConfidenceCount}건
                    </span>
                  )}
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400 mt-3 font-mono">
              /impact analyze &lt;spec-file&gt;
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Stage 2.5: 인덱스도 없는 상태 (프로젝트는 등록됨)
  if (!status.hasIndex) {
    return (
      <div className="bg-white rounded-lg border border-amber-200 p-6">
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              인덱싱 필요
              <span className="ml-2 text-xs font-normal text-gray-500">{status.projectId}</span>
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              프로젝트가 등록되었지만 아직 인덱싱이 실행되지 않았습니다.
            </p>
            <p className="text-xs text-gray-400 mt-2 font-mono">
              /impact index
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Stage 3: 분석 완료 (이미 결과 있음) - 여기는 표시하지 않음 (Dashboard의 나머지가 보여줌)
  return null;
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

export default ProjectOverview;
