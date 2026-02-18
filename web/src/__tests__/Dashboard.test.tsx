/**
 * @module web/__tests__/Dashboard.test
 * @description Dashboard 컴포넌트 렌더링 테스트
 */

import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Dashboard from '../pages/Dashboard';
import { useResultStore } from '../stores/resultStore';
import { getMockResult } from '../utils/mockData';

// fetch 모킹
vi.stubGlobal('fetch', vi.fn());

/** BrowserRouter로 감싸서 렌더링하는 헬퍼 */
function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe('Dashboard', () => {
  beforeEach(() => {
    // 스토어 초기화
    useResultStore.setState({
      currentResult: null,
      resultList: [],
      isLoading: false,
      error: null,
    });

    // fetch mock 리셋
    vi.mocked(fetch).mockReset();
  });

  it('should show loading state initially and then render result', async () => {
    const mockResult = getMockResult();

    // fetch가 mock 결과를 반환
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ result: mockResult }),
    } as Response);

    renderWithRouter(<Dashboard />);

    // useEffect -> fetch -> setCurrentResult 완료 후 대시보드 표시
    await waitFor(() => {
      expect(screen.getByText(mockResult.specTitle)).toBeInTheDocument();
    });
  });

  it('should render score header with correct data', async () => {
    const mockResult = getMockResult();

    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ result: mockResult }),
    } as Response);

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(mockResult.specTitle)).toBeInTheDocument();
      expect(screen.getByText(String(mockResult.totalScore))).toBeInTheDocument();
      // grade appears in both ScoreHeader and BarChart legend; check that at least one exists
      expect(screen.getAllByText(mockResult.grade).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should render all KPI cards', async () => {
    const mockResult = getMockResult();

    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ result: mockResult }),
    } as Response);

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('영향 화면')).toBeInTheDocument();
      expect(screen.getByText('총 작업')).toBeInTheDocument();
      expect(screen.getByText('기획 확인')).toBeInTheDocument();
      expect(screen.getByText('정책 경고')).toBeInTheDocument();
      expect(screen.getByText('확인 요청')).toBeInTheDocument();
    });
  });

  it('should render chart sections', async () => {
    const mockResult = getMockResult();

    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ result: mockResult }),
    } as Response);

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('화면별 영향도 점수')).toBeInTheDocument();
      expect(screen.getByText('FE / BE 작업 비율')).toBeInTheDocument();
    });
  });

  it('should fall back to mock data when API returns null result', async () => {
    // API returns no result -> hook falls back to mock data
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ result: null }),
    } as Response);

    renderWithRouter(<Dashboard />);

    // Mock data should be loaded as fallback
    await waitFor(() => {
      expect(screen.getByText('[데모] 장바구니 리뉴얼 기획서')).toBeInTheDocument();
    });
  });

  it('should show error banner when fetch fails but still show data', async () => {
    // fetch 실패 -> mock 데이터로 폴백 + 에러 메시지 표시
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      // 에러 메시지 표시
      expect(screen.getByText('서버 연결 실패. 데모 데이터를 표시합니다.')).toBeInTheDocument();
      // Mock 데이터로 대시보드 표시
      expect(screen.getByText('[데모] 장바구니 리뉴얼 기획서')).toBeInTheDocument();
    });
  });

  it('should display correct KPI values from mock data', async () => {
    const mockResult = getMockResult();

    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ result: mockResult }),
    } as Response);

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      // 영향 화면 수 - KPI 카드에서 값 확인 (getAllByText로 복수 매칭 허용)
      const screenCountEls = screen.getAllByText(String(mockResult.affectedScreens.length));
      expect(screenCountEls.length).toBeGreaterThanOrEqual(1);
      // 총 작업 수
      const taskCountEls = screen.getAllByText(String(mockResult.tasks.length));
      expect(taskCountEls.length).toBeGreaterThanOrEqual(1);
    });
  });
});
