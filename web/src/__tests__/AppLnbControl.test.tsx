/**
 * @module web/__tests__/AppLnbControl.test
 * @description TASK-122/124: LNB 자동 제어 로직 테스트
 *
 * 검증 항목:
 * - 프로젝트 보드(/) 진입 시 lnbCollapsed=true
 * - 정책(/policies) 진입 시 lnbCollapsed=true
 * - 기획 분석(/analysis) 진입 시 lnbCollapsed=false
 * - 플로우차트(/flow) 진입 시 lnbCollapsed=false
 */

import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEffect } from 'react';
import { useResultStore } from '../stores/resultStore';
import { useProjectStore } from '../stores/projectStore';

// fetch mock
vi.stubGlobal('fetch', vi.fn());

/** LNB를 자동으로 숨길 라우트 (App.tsx와 동일) */
const LNB_HIDDEN_ROUTES = ['/', '/policies'];

/**
 * App.tsx의 AppContent에서 LNB 제어 로직만 추출한 테스트용 컴포넌트.
 * 실제 App.tsx를 렌더링하면 SSE, LNB, Header 등 모든 의존성이 필요하므로,
 * 핵심 로직만 분리해서 테스트한다.
 */
function LnbControlTestHarness({ onLnbState }: { onLnbState: (collapsed: boolean) => void }) {
  const location = useLocation();
  const setLnbCollapsed = useResultStore((s) => s.setLnbCollapsed);
  const lnbCollapsed = useResultStore((s) => s.lnbCollapsed);

  useEffect(() => {
    const shouldHide = LNB_HIDDEN_ROUTES.includes(location.pathname);
    setLnbCollapsed(shouldHide);
  }, [location.pathname, setLnbCollapsed]);

  useEffect(() => {
    onLnbState(lnbCollapsed);
  }, [lnbCollapsed, onLnbState]);

  return (
    <Routes>
      <Route path="/" element={<div>ProjectBoard</div>} />
      <Route path="/analysis" element={<div>Dashboard</div>} />
      <Route path="/flow" element={<div>FlowChart</div>} />
      <Route path="/policies" element={<div>Policies</div>} />
    </Routes>
  );
}

function renderAtRoute(route: string, onLnbState: (collapsed: boolean) => void) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <LnbControlTestHarness onLnbState={onLnbState} />
    </MemoryRouter>,
  );
}

describe('LNB Auto-Control (TASK-122)', () => {
  beforeEach(() => {
    useResultStore.setState({ lnbCollapsed: false });
    useProjectStore.setState({ projects: [], activeProjectId: null });
    vi.mocked(fetch).mockReset();
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({}),
    } as Response);
  });

  it('should set lnbCollapsed=true when entering / (프로젝트 보드)', async () => {
    const spy = vi.fn();
    renderAtRoute('/', spy);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(true);
    });
  });

  it('should set lnbCollapsed=true when entering /policies', async () => {
    const spy = vi.fn();
    renderAtRoute('/policies', spy);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(true);
    });
  });

  it('should set lnbCollapsed=false when entering /analysis (기획 분석)', async () => {
    // Start collapsed
    useResultStore.setState({ lnbCollapsed: true });

    const spy = vi.fn();
    renderAtRoute('/analysis', spy);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(false);
    });
  });

  it('should set lnbCollapsed=false when entering /flow (플로우차트)', async () => {
    // Start collapsed
    useResultStore.setState({ lnbCollapsed: true });

    const spy = vi.fn();
    renderAtRoute('/flow', spy);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(false);
    });
  });

  it('should use setLnbCollapsed from resultStore', async () => {
    const setLnbCollapsedSpy = vi.fn();
    useResultStore.setState({ setLnbCollapsed: setLnbCollapsedSpy });

    const spy = vi.fn();
    renderAtRoute('/', spy);

    await waitFor(() => {
      expect(setLnbCollapsedSpy).toHaveBeenCalledWith(true);
    });
  });
});
