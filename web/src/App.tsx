import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/layout/Header';
import LNB from './components/layout/LNB';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import FlowChart from './pages/FlowChart';
import Checklist from './pages/Checklist';
import Owners from './pages/Owners';
import Tickets from './pages/Tickets';
import Policies from './pages/Policies';
import ProjectHub from './pages/ProjectHub';
import { useResultStore } from './stores/resultStore';
import { useSSE } from './hooks/useSSE';

/** 프로젝트 비교 뷰 (lazy load) */
const ProjectCompare = lazy(() => import('./pages/ProjectCompare'));

function App() {
  const lnbCollapsed = useResultStore((s) => s.lnbCollapsed);

  // SSE 실시간 이벤트 수신
  useSSE();

  return (
    <BrowserRouter>
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
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/flow" element={<FlowChart />} />
                  <Route path="/checklist" element={<Checklist />} />
                  <Route path="/owners" element={<Owners />} />
                  <Route path="/tickets" element={<Tickets />} />
                  <Route path="/policies" element={<Policies />} />
                  <Route path="/projects" element={<ProjectHub />} />
                  <Route path="/projects/compare" element={<ProjectCompare />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
