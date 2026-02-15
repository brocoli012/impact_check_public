import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/layout/Header';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import FlowChart from './pages/FlowChart';
import Checklist from './pages/Checklist';
import Owners from './pages/Owners';
import Tickets from './pages/Tickets';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/flow" element={<FlowChart />} />
              <Route path="/checklist" element={<Checklist />} />
              <Route path="/owners" element={<Owners />} />
              <Route path="/tickets" element={<Tickets />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
