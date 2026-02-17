import { NavLink } from 'react-router-dom';

/** 네비게이션 탭 정의 */
const NAV_TABS = [
  { to: '/', label: '대시보드' },
  { to: '/flow', label: '플로우차트' },
  { to: '/checklist', label: '체크리스트' },
  { to: '/owners', label: '담당자' },
  { to: '/tickets', label: '티켓' },
  { to: '/policies', label: '정책' },
] as const;

function Header() {
  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <h1 className="text-lg font-bold text-gray-900">
            Kurly Impact Checker
          </h1>
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
