/**
 * @module web/components/project-board/QuickNavGrid
 * @description T1-08: 프로젝트 보드 목차 네비게이션 (4칸 카드 그리드)
 * 기획분석, 플로우차트, 티켓, 정책 바로가기 + 요약 정보 표시
 */

import { Link } from 'react-router-dom';

interface QuickNavGridProps {
  /** 최근 분석 등급 */
  latestGrade?: string | null;
  /** 최근 분석 점수 */
  latestScore?: number | null;
  /** 분석 결과 수 */
  resultCount?: number;
  /** 총 작업(태스크) 수 */
  taskCount?: number;
  /** 정책 수 */
  policyCount?: number;
  /** 정책 경고 수 */
  policyWarningCount?: number;
}

/** 등급별 색상 */
function gradeColor(grade?: string | null): string {
  switch (grade) {
    case 'Low':
      return 'text-green-600 bg-green-50';
    case 'Medium':
      return 'text-yellow-600 bg-yellow-50';
    case 'High':
      return 'text-orange-600 bg-orange-50';
    case 'Critical':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-gray-500 bg-gray-50';
  }
}

export default function QuickNavGrid({
  latestGrade,
  latestScore,
  resultCount = 0,
  taskCount = 0,
  policyCount = 0,
  policyWarningCount = 0,
}: QuickNavGridProps) {
  const navItems = [
    {
      title: '기획 분석',
      description: '기획서 영향 분석 결과',
      to: '/analysis',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      summary: latestGrade ? (
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${gradeColor(latestGrade)}`}>
            {latestGrade}
          </span>
          {latestScore != null && (
            <span className="text-xs text-gray-500">{latestScore}점</span>
          )}
        </div>
      ) : (
        <span className="text-xs text-gray-400">분석 {resultCount}건</span>
      ),
    },
    {
      title: '플로우차트',
      description: '화면/API 의존성 흐름',
      to: '/flow',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      summary: <span className="text-xs text-gray-400">의존성 시각화</span>,
    },
    {
      title: '티켓',
      description: '개발 작업 항목',
      to: '/tickets',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      summary: taskCount > 0 ? (
        <span className="text-xs text-gray-500">작업 {taskCount}건</span>
      ) : (
        <span className="text-xs text-gray-400">작업 없음</span>
      ),
    },
    {
      title: '정책',
      description: '비즈니스 규칙/정책',
      to: '/policies',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      summary: policyCount > 0 ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{policyCount}건</span>
          {policyWarningCount > 0 && (
            <span className="text-xs text-amber-600 font-medium">경고 {policyWarningCount}</span>
          )}
        </div>
      ) : (
        <span className="text-xs text-gray-400">정책 없음</span>
      ),
    },
  ];

  return (
    <div data-testid="quick-nav-grid">
      <h3 className="text-sm font-bold text-gray-900 mb-3">바로가기</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {navItems.map(item => (
          <Link
            key={item.to}
            to={item.to}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:border-purple-300 hover:shadow-sm transition-all group"
            data-testid={`quick-nav-${item.to.replace('/', '')}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-purple-500 group-hover:text-purple-600 transition-colors">
                {item.icon}
              </span>
              <span className="text-sm font-semibold text-gray-800 group-hover:text-purple-700 transition-colors">
                {item.title}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mb-2">{item.description}</p>
            <div>{item.summary}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
