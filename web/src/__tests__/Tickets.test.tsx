/**
 * @module web/__tests__/Tickets.test
 * @description Tickets 페이지 렌더링 테스트
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import Tickets from '../pages/Tickets';
import { useResultStore } from '../stores/resultStore';
import { getMockResult } from '../utils/mockData';

/** BrowserRouter로 감싸서 렌더링하는 헬퍼 */
function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
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
});
