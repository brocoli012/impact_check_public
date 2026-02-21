/**
 * @module web/pages/ProjectCompare
 * @description 프로젝트 비교 뷰 - 두 프로젝트의 등급/태스크/정책 비교
 * REQ-012 Phase 3: /projects/compare?a=projectA&b=projectB
 */

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import type { ProjectInfo, Grade } from '../types';
import { useProjectStore } from '../stores/projectStore';
import { GRADE_COLORS } from '../utils/colors';
import { formatDate } from '../utils/gradeUtils';

/** 프로젝트 비교 세부 결과 */
interface ProjectCompareData {
  project: ProjectInfo | null;
  latestResult: {
    grade: string;
    totalScore: number;
    taskCount: number;
    policyWarningCount: number;
    analyzedAt: string;
    affectedScreenCount?: number;
  } | null;
}

function ProjectCompare() {
  const [searchParams] = useSearchParams();
  const projectA = searchParams.get('a');
  const projectB = searchParams.get('b');
  const { projects, fetchProjects } = useProjectStore();

  const [dataA, setDataA] = useState<ProjectCompareData>({ project: null, latestResult: null });
  const [dataB, setDataB] = useState<ProjectCompareData>({ project: null, latestResult: null });

  // 프로젝트 목록 로드
  useEffect(() => {
    if (projects.length === 0) {
      fetchProjects();
    }
  }, [projects.length, fetchProjects]);

  // 프로젝트 데이터 매칭
  useEffect(() => {
    if (projects.length === 0) return;

    const pA = projects.find(p => p.id === projectA) || null;
    const pB = projects.find(p => p.id === projectB) || null;

    setDataA({
      project: pA,
      latestResult: pA ? {
        grade: pA.latestGrade || '-',
        totalScore: pA.latestScore ?? 0,
        taskCount: pA.taskCount,
        policyWarningCount: pA.policyWarningCount,
        analyzedAt: pA.latestAnalyzedAt || '',
      } : null,
    });

    setDataB({
      project: pB,
      latestResult: pB ? {
        grade: pB.latestGrade || '-',
        totalScore: pB.latestScore ?? 0,
        taskCount: pB.taskCount,
        policyWarningCount: pB.policyWarningCount,
        analyzedAt: pB.latestAnalyzedAt || '',
      } : null,
    });
  }, [projects, projectA, projectB]);

  // 선택 가능한 프로젝트 옵션 (비교 대상 선택용)
  const projectOptions = useMemo(() => {
    return projects.map(p => ({ id: p.id, name: p.name }));
  }, [projects]);

  if (!projectA || !projectB) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <h2 className="text-xl font-bold text-gray-900">프로젝트 비교</h2>
        <p className="text-sm text-gray-500">비교할 두 프로젝트를 선택하세요.</p>
        <CompareSelector projects={projectOptions} currentA={projectA} currentB={projectB} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">프로젝트 비교</h2>
          <p className="text-sm text-gray-500 mt-1">
            {dataA.project?.name || projectA} vs {dataB.project?.name || projectB}
          </p>
        </div>
        <Link
          to="/projects"
          className="text-sm text-purple-600 hover:text-purple-800"
        >
          목록으로
        </Link>
      </div>

      {/* 비교 선택기 */}
      <CompareSelector projects={projectOptions} currentA={projectA} currentB={projectB} />

      {/* 좌우 분할 비교 */}
      <div className="grid grid-cols-2 gap-6">
        <ComparePanel data={dataA} label="A" />
        <ComparePanel data={dataB} label="B" />
      </div>

      {/* 비교 테이블 */}
      <CompareTable dataA={dataA} dataB={dataB} />
    </div>
  );
}

/** 비교 선택기 */
function CompareSelector({ projects, currentA, currentB }: {
  projects: { id: string; name: string }[];
  currentA: string | null;
  currentB: string | null;
}) {
  const [a, setA] = useState(currentA || '');
  const [b, setB] = useState(currentB || '');

  return (
    <div className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 p-4">
      <select
        data-testid="compare-select-a"
        value={a}
        onChange={(e) => setA(e.target.value)}
        className="text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white flex-1"
      >
        <option value="">프로젝트 A 선택</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      <span className="text-gray-400 font-bold">vs</span>

      <select
        data-testid="compare-select-b"
        value={b}
        onChange={(e) => setB(e.target.value)}
        className="text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white flex-1"
      >
        <option value="">프로젝트 B 선택</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      <Link
        to={a && b ? `/projects/compare?a=${a}&b=${b}` : '#'}
        className={`text-sm font-medium px-4 py-1.5 rounded-md ${
          a && b && a !== b
            ? 'bg-purple-600 text-white hover:bg-purple-700'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
        onClick={(e) => { if (!a || !b || a === b) e.preventDefault(); }}
      >
        비교
      </Link>
    </div>
  );
}

/** 비교 패널 (좌/우) */
function ComparePanel({ data, label }: { data: ProjectCompareData; label: string }) {
  const { project, latestResult } = data;

  if (!project) {
    return (
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 text-center text-gray-400">
        프로젝트를 찾을 수 없습니다
      </div>
    );
  }

  const gradeColors = project.latestGrade
    ? GRADE_COLORS[project.latestGrade as Grade]
    : null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5" data-testid={`compare-panel-${label.toLowerCase()}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900">{project.name}</h3>
        {gradeColors && project.latestGrade && (
          <span
            className="text-sm font-bold px-3 py-1 rounded"
            style={{
              backgroundColor: gradeColors.bg,
              color: gradeColors.text,
              border: `1px solid ${gradeColors.border}`,
            }}
          >
            {project.latestGrade}
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">총점</span>
          <span className="font-semibold">{latestResult?.totalScore ?? '-'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">태스크</span>
          <span className="font-semibold">{project.taskCount}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">정책 경고</span>
          <span className="font-semibold">{project.policyWarningCount}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">분석 결과</span>
          <span className="font-semibold">{project.resultCount}건</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">기술 스택</span>
          <span className="text-xs text-gray-600">{project.techStack.join(', ') || '-'}</span>
        </div>
        {latestResult?.analyzedAt && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">마지막 분석</span>
            <span className="text-xs text-gray-600">{formatDate(latestResult.analyzedAt)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** 비교 테이블 */
function CompareTable({ dataA, dataB }: { dataA: ProjectCompareData; dataB: ProjectCompareData }) {
  if (!dataA.project || !dataB.project) return null;

  const rows = [
    { label: '등급', a: dataA.project.latestGrade || '-', b: dataB.project.latestGrade || '-' },
    { label: '총점', a: String(dataA.latestResult?.totalScore ?? '-'), b: String(dataB.latestResult?.totalScore ?? '-') },
    { label: '태스크 수', a: String(dataA.project.taskCount), b: String(dataB.project.taskCount) },
    { label: '정책 경고', a: String(dataA.project.policyWarningCount), b: String(dataB.project.policyWarningCount) },
    { label: '분석 결과', a: `${dataA.project.resultCount}건`, b: `${dataB.project.resultCount}건` },
    { label: '상태', a: dataA.project.status === 'active' ? '활성' : '보관됨', b: dataB.project.status === 'active' ? '활성' : '보관됨' },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden" data-testid="compare-table">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="text-left px-4 py-2 text-gray-600 font-medium">항목</th>
            <th className="text-center px-4 py-2 text-gray-600 font-medium">{dataA.project.name}</th>
            <th className="text-center px-4 py-2 text-gray-600 font-medium">{dataB.project.name}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b last:border-b-0">
              <td className="px-4 py-2 text-gray-500">{row.label}</td>
              <td className="text-center px-4 py-2 font-medium">{row.a}</td>
              <td className="text-center px-4 py-2 font-medium">{row.b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ProjectCompare;
