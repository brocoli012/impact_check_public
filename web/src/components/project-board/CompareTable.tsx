/**
 * @module web/components/project-board/CompareTable
 * @description TASK-140: 프로젝트 비교 결과 테이블
 * 프로젝트 비교 결과 테이블 컴포넌트
 */

import type { ProjectInfo, Grade } from '../../types';
import { GRADE_COLORS } from '../../utils/colors';

export interface CompareTableProps {
  /** 프로젝트 A 정보 */
  projectA: ProjectInfo | null;
  /** 프로젝트 B 정보 */
  projectB: ProjectInfo | null;
}

/** 비교 행 데이터 */
interface CompareRow {
  label: string;
  a: string;
  b: string;
  /** 차이 강조 표시 여부 */
  highlight?: boolean;
}

/**
 * 두 프로젝트의 주요 지표를 비교하는 테이블
 */
export default function CompareTable({ projectA, projectB }: CompareTableProps) {
  if (!projectA || !projectB) {
    return (
      <div
        className="text-center text-sm text-gray-400 py-8"
        data-testid="compare-table-empty"
      >
        두 프로젝트를 모두 선택하면 비교 결과가 표시됩니다.
      </div>
    );
  }

  const rows: CompareRow[] = [
    {
      label: '등급',
      a: projectA.latestGrade || '-',
      b: projectB.latestGrade || '-',
      highlight: projectA.latestGrade !== projectB.latestGrade,
    },
    {
      label: '총점',
      a: String(projectA.latestScore ?? '-'),
      b: String(projectB.latestScore ?? '-'),
      highlight: projectA.latestScore !== projectB.latestScore,
    },
    {
      label: '태스크 수',
      a: String(projectA.taskCount),
      b: String(projectB.taskCount),
      highlight: projectA.taskCount !== projectB.taskCount,
    },
    {
      label: '정책 경고',
      a: String(projectA.policyWarningCount),
      b: String(projectB.policyWarningCount),
      highlight: projectA.policyWarningCount !== projectB.policyWarningCount,
    },
    {
      label: '분석 결과',
      a: `${projectA.resultCount}건`,
      b: `${projectB.resultCount}건`,
    },
    {
      label: '상태',
      a: projectA.status === 'active' ? '활성' : '보관됨',
      b: projectB.status === 'active' ? '활성' : '보관됨',
    },
  ];

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 overflow-hidden"
      data-testid="compare-table"
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="text-left px-4 py-2 text-gray-600 font-medium text-xs">
              항목
            </th>
            <th className="text-center px-4 py-2 text-gray-600 font-medium text-xs">
              {projectA.name}
            </th>
            <th className="text-center px-4 py-2 text-gray-600 font-medium text-xs">
              {projectB.name}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.label}
              className={`border-b last:border-b-0 ${
                row.highlight ? 'bg-purple-50/50' : ''
              }`}
            >
              <td className="px-4 py-2 text-gray-500 text-xs">{row.label}</td>
              <td className="text-center px-4 py-2 font-medium text-xs">
                <CellValue value={row.a} label={row.label} />
              </td>
              <td className="text-center px-4 py-2 font-medium text-xs">
                <CellValue value={row.b} label={row.label} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 등급 셀은 색상 배지로 렌더링 */
function CellValue({ value, label }: { value: string; label: string }) {
  if (label === '등급' && value !== '-') {
    const colors = GRADE_COLORS[value as Grade];
    if (colors) {
      return (
        <span
          className="text-xs font-bold px-2 py-0.5 rounded"
          style={{
            backgroundColor: colors.bg,
            color: colors.text,
            border: `1px solid ${colors.border}`,
          }}
        >
          {value}
        </span>
      );
    }
  }
  return <span>{value}</span>;
}
