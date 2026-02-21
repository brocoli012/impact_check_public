import { useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { useProjectStore } from '../../stores/projectStore';
import { useResultStore } from '../../stores/resultStore';
import { usePolicyStore } from '../../stores/policyStore';
import { useFlowStore } from '../../stores/flowStore';

/** 네비게이션 탭 정의 */
const NAV_TABS = [
  { to: '/', label: '대시보드' },
  { to: '/flow', label: '플로우차트' },
  { to: '/checklist', label: '체크리스트' },
  { to: '/owners', label: '담당자' },
  { to: '/tickets', label: '티켓' },
  { to: '/policies', label: '정책' },
  { to: '/projects', label: '프로젝트' },
] as const;

function Header() {
  const { projects, activeProjectId, fetchProjects, switchProject } = useProjectStore();
  const resetResult = useResultStore((s) => s.reset);
  const fetchAllResults = useResultStore((s) => s.fetchAllResults);
  const resetPolicy = usePolicyStore((s) => s.reset);
  const resetFlow = useFlowStore((s) => s.reset);

  // 초기 로드
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  /** 프로젝트 전환 핸들러 */
  const handleProjectSwitch = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProjectId = e.target.value;
    if (!newProjectId || newProjectId === activeProjectId) return;

    // 기존 데이터 초기화
    resetResult();
    resetPolicy();
    resetFlow();

    // 프로젝트 전환
    await switchProject(newProjectId);

    // 새 프로젝트 데이터 로드
    await fetchAllResults();
  }, [activeProjectId, switchProject, resetResult, resetPolicy, resetFlow, fetchAllResults]);

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">
              Kurly Impact Checker
            </h1>
            {projects.length > 0 && (
              <select
                data-testid="project-selector"
                value={activeProjectId || ''}
                onChange={handleProjectSwitch}
                className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                aria-label="프로젝트 선택"
              >
                <option value="" disabled>프로젝트 선택</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <nav className="flex gap-1" aria-label="메인 네비게이션">
            {NAV_TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === '/'}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-purple-100 text-purple-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}

export default Header;
