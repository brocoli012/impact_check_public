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
import { useResultStore } from './stores/resultStore';

function App() {
  const lnbCollapsed = useResultStore((s) => s.lnbCollapsed);

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
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/flow" element={<FlowChart />} />
                <Route path="/checklist" element={<Checklist />} />
                <Route path="/owners" element={<Owners />} />
                <Route path="/tickets" element={<Tickets />} />
                <Route path="/policies" element={<Policies />} />
              </Routes>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
