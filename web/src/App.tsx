import { Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/layout/Header';
import LNB from './components/layout/LNB';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import ProjectBoard from './pages/ProjectBoard';
import FlowChart from './pages/FlowChart';
import Checklist from './pages/Checklist';
import Owners from './pages/Owners';
import Tickets from './pages/Tickets';
import Policies from './pages/Policies';
import { useResultStore } from './stores/resultStore';
import { useProjectStore } from './stores/projectStore';
import { useSSE } from './hooks/useSSE';

/** LNB를 자동으로 숨길 라우트 */
const LNB_HIDDEN_ROUTES = ['/', '/policies'];

/**
 * BrowserRouter 내부에서 useLocation 사용 가능한 래퍼
 * - LNB 자동 제어
 * - fetchProjects 초기 로드
 */
function AppContent() {
  const location = useLocation();
  const setLnbCollapsed = useResultStore((s) => s.setLnbCollapsed);
  const lnbCollapsed = useResultStore((s) => s.lnbCollapsed);
  const fetchProjects = useProjectStore((s) => s.fetchProjects);

  // SSE 실시간 이벤트 수신
  useSSE();

  // TASK-123: fetchProjects 초기 로드 (Header에서 이동)
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // TASK-122: LNB 자동 제어 - 라우트에 따라 LNB 숨김/표시
  useEffect(() => {
    const shouldHide = LNB_HIDDEN_ROUTES.includes(location.pathname);
    setLnbCollapsed(shouldHide);
  }, [location.pathname, setLnbCollapsed]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        {/* Left Navigation Bar */}
        <LNB />

        {/* Main Content */}
        <main
          className="flex-1 px-4 py-6 transition-all duration-300 ease-in-out"
          style={{
            marginLeft: lnbCollapsed ? '0' : '280px',
            marginTop: '64px',
          }}
        >
          <ErrorBoundary>
            <Suspense fallback={<div className="text-center py-12 text-gray-400">로딩 중...</div>}>
              <Routes>
                <Route path="/" element={<ProjectBoard />} />
                <Route path="/analysis" element={<Dashboard />} />
                <Route path="/flow" element={<FlowChart />} />
                <Route path="/checklist" element={<Checklist />} />
                <Route path="/owners" element={<Owners />} />
                <Route path="/tickets" element={<Tickets />} />
                <Route path="/policies" element={<Policies />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
