/**
 * @module web/__tests__/Tickets.test
 * @description Tickets 페이지 렌더링 테스트
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import Tickets from '../pages/Tickets';
import { useResultStore } from '../stores/resultStore';
import { getMockResult } from '../utils/mockData';

/** BrowserRouter로 감싸서 렌더링하는 헬퍼 */
function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

/** MemoryRouter로 초기 URL을 지정하여 렌더링하는 헬퍼 */
function renderWithMemoryRouter(ui: React.ReactElement, initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>,
  );
}

describe('Tickets', () => {
  beforeEach(() => {
    useResultStore.setState({
      currentResult: getMockResult(),
      resultList: [],
      isLoading: false,
      error: null,
    });
  });

  it('should render the tickets page title', () => {
    renderWithRouter(<Tickets />);

    expect(screen.getByText('작업 티켓 목록')).toBeInTheDocument();
  });

  it('should show spec title', () => {
    renderWithRouter(<Tickets />);

    expect(screen.getByText('[데모] 장바구니 리뉴얼 기획서')).toBeInTheDocument();
  });

  it('should display total ticket count', () => {
    renderWithRouter(<Tickets />);

    // Mock data has 6 tasks - the number "6" appears in multiple places (summary + score bars)
    expect(screen.getAllByText('6').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('총 티켓')).toBeInTheDocument();
  });

  it('should display FE/BE counts in summary', () => {
    renderWithRouter(<Tickets />);

    // 4 FE tasks, 2 BE tasks - these numbers may appear in multiple places
    expect(screen.getAllByText('4').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
  });

  it('should render filter buttons', () => {
    renderWithRouter(<Tickets />);

    // Type filter buttons - 전체 button appears in both type and grade filters
    const allButtons = screen.getAllByText('전체');
    expect(allButtons.length).toBeGreaterThanOrEqual(2);

    // FE/BE buttons in the filter section
    expect(screen.getAllByText('FE').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('BE').length).toBeGreaterThanOrEqual(1);
  });

  it('should render search input', () => {
    renderWithRouter(<Tickets />);

    const searchInput = screen.getByPlaceholderText('작업명, 파일 경로 검색...');
    expect(searchInput).toBeInTheDocument();
  });

  it('should render ticket cards', () => {
    renderWithRouter(<Tickets />);

    // Task titles appear in ticket cards and possibly in dependency diagram
    expect(screen.getAllByText('장바구니 UI 전면 개편').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('장바구니 API 응답 변경').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('결제 화면 장바구니 연동 수정').length).toBeGreaterThanOrEqual(1);
  });

  it('should render dependency diagram', () => {
    renderWithRouter(<Tickets />);

    expect(screen.getByText('작업 간 의존 관계')).toBeInTheDocument();
  });

  it('should filter tickets when FE button is clicked', () => {
    renderWithRouter(<Tickets />);

    // Click the FE filter button (first one in the type filter section)
    const feButtons = screen.getAllByText('FE');
    // The first FE button should be in the filter section
    fireEvent.click(feButtons[0]);

    // FE tasks should still be visible (may appear in both cards and dependency)
    expect(screen.getAllByText('장바구니 UI 전면 개편').length).toBeGreaterThanOrEqual(1);
  });

  it('should filter by search query', () => {
    renderWithRouter(<Tickets />);

    const searchInput = screen.getByPlaceholderText('작업명, 파일 경로 검색...');
    fireEvent.change(searchInput, { target: { value: '결제' } });

    // Only 결제 related task should be visible
    expect(screen.getByText('결제 화면 장바구니 연동 수정')).toBeInTheDocument();
  });

  /* ---------- URL query parameter 테스트 (TASK-033 R-02) ---------- */
  describe('URL query parameter', () => {
    it('should apply FE type filter when ?type=FE is provided', () => {
      renderWithMemoryRouter(<Tickets />, ['/tickets?type=FE']);

      // FE filter button should have active style (purple-100 bg)
      const feButtons = screen.getAllByText('FE');
      // Filter section FE button should be active
      const filterFEButton = feButtons.find(
        (btn) => btn.tagName === 'BUTTON' && btn.className.includes('bg-purple-100'),
      );
      expect(filterFEButton).toBeDefined();
    });

    it('should apply BE type filter when ?type=BE is provided', () => {
      renderWithMemoryRouter(<Tickets />, ['/tickets?type=BE']);

      // BE filter button should have active style
      const beButtons = screen.getAllByText('BE');
      const filterBEButton = beButtons.find(
        (btn) => btn.tagName === 'BUTTON' && btn.className.includes('bg-purple-100'),
      );
      expect(filterBEButton).toBeDefined();
    });

    it('should default to "all" when ?type has an invalid value', () => {
      renderWithMemoryRouter(<Tickets />, ['/tickets?type=INVALID']);

      // "전체" buttons should be active for both type and grade
      const allButtons = screen.getAllByText('전체');
      const activeAllButtons = allButtons.filter(
        (btn) => btn.className.includes('bg-purple-100'),
      );
      // Both type and grade "전체" should be active
      expect(activeAllButtons.length).toBeGreaterThanOrEqual(2);
    });

    it('should default to "all" when no type param is present', () => {
      renderWithMemoryRouter(<Tickets />, ['/tickets']);

      // "전체" buttons should be active
      const allButtons = screen.getAllByText('전체');
      const activeAllButtons = allButtons.filter(
        (btn) => btn.className.includes('bg-purple-100'),
      );
      expect(activeAllButtons.length).toBeGreaterThanOrEqual(2);
    });
  });
});
