/**
 * @module web/__tests__/Checklist.test
 * @description Checklist 페이지 렌더링 테스트
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Checklist from '../pages/Checklist';
import { useResultStore } from '../stores/resultStore';
import { getMockResult } from '../utils/mockData';

// fetch 모킹
vi.stubGlobal('fetch', vi.fn());

/** BrowserRouter로 감싸서 렌더링하는 헬퍼 */
function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe('Checklist', () => {
  beforeEach(() => {
    useResultStore.setState({
      currentResult: getMockResult(),
      resultList: [],
      isLoading: false,
      error: null,
    });

    // fetch mock - 체크리스트 조회 API
    vi.mocked(fetch).mockReset();
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ checklist: { resultId: 'demo-analysis-001', items: [] } }),
    } as Response);
  });

  it('should render the checklist page title', async () => {
    renderWithRouter(<Checklist />);

    await waitFor(() => {
      expect(screen.getByText('기획 확인 체크리스트')).toBeInTheDocument();
    });
  });

  it('should show spec title', async () => {
    renderWithRouter(<Checklist />);

    await waitFor(() => {
      expect(screen.getByText('[데모] 장바구니 리뉴얼 기획서')).toBeInTheDocument();
    });
  });

  it('should render progress bar', async () => {
    renderWithRouter(<Checklist />);

    await waitFor(() => {
      expect(screen.getByText('진행률')).toBeInTheDocument();
    });
  });

  it('should render category groups', async () => {
    renderWithRouter(<Checklist />);

    await waitFor(() => {
      expect(screen.getByText('반드시 확인 (개발 시작 전)')).toBeInTheDocument();
    });
  });

  it('should render checklist items', async () => {
    renderWithRouter(<Checklist />);

    await waitFor(() => {
      // 체크리스트 항목이 표시되어야 함
      expect(screen.getByText('묶음 배송 정책에 대한 기획 확인이 필요합니다.')).toBeInTheDocument();
    });
  });

  it('should toggle checkbox when clicked', async () => {
    renderWithRouter(<Checklist />);

    await waitFor(() => {
      expect(screen.getByText('묶음 배송 정책에 대한 기획 확인이 필요합니다.')).toBeInTheDocument();
    });

    // 첫 번째 체크박스 클릭
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);

    fireEvent.click(checkboxes[0]);

    // Optimistic update - 체크 상태가 변경되어야 함
    expect(checkboxes[0]).toBeChecked();
  });

  it('should render policy warnings category', async () => {
    renderWithRouter(<Checklist />);

    await waitFor(() => {
      expect(screen.getByText('정책 경고 (Policy Warnings)')).toBeInTheDocument();
    });
  });
});
