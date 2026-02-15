/**
 * @module web/__tests__/Owners.test
 * @description Owners 페이지 렌더링 테스트
 */

import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import Owners from '../pages/Owners';
import { useResultStore } from '../stores/resultStore';
import { getMockResult } from '../utils/mockData';

/** BrowserRouter로 감싸서 렌더링하는 헬퍼 */
function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe('Owners', () => {
  beforeEach(() => {
    useResultStore.setState({
      currentResult: getMockResult(),
      resultList: [],
      isLoading: false,
      error: null,
    });
  });

  it('should render the owners page title', () => {
    renderWithRouter(<Owners />);

    expect(screen.getByText('확인 요청 안내')).toBeInTheDocument();
  });

  it('should show spec title', () => {
    renderWithRouter(<Owners />);

    expect(screen.getByText('[데모] 장바구니 리뉴얼 기획서')).toBeInTheDocument();
  });

  it('should display team and owner count', () => {
    renderWithRouter(<Owners />);

    // Both team count (3) and owner count (3) appear
    const threes = screen.getAllByText('3');
    expect(threes.length).toBe(2); // one for teams, one for owners
    expect(screen.getByText('개 팀')).toBeInTheDocument();
    expect(screen.getByText('명 담당자')).toBeInTheDocument();
  });

  it('should display description text', () => {
    renderWithRouter(<Owners />);

    expect(
      screen.getByText('이 기획의 영향을 받는 시스템 담당자에게 아래 내용을 확인 요청하세요.'),
    ).toBeInTheDocument();
  });

  it('should render owner cards', () => {
    renderWithRouter(<Owners />);

    expect(screen.getByText('장바구니 시스템')).toBeInTheDocument();
    expect(screen.getByText('결제 시스템')).toBeInTheDocument();
    expect(screen.getByText('주문 시스템')).toBeInTheDocument();
  });

  it('should display owner names', () => {
    renderWithRouter(<Owners />);

    expect(screen.getByText('김개발')).toBeInTheDocument();
    expect(screen.getByText('이결제')).toBeInTheDocument();
    expect(screen.getByText('박주문')).toBeInTheDocument();
  });

  it('should show email draft expand buttons', () => {
    renderWithRouter(<Owners />);

    const buttons = screen.getAllByText('확인 요청 메일 초안 보기');
    expect(buttons.length).toBe(3);
  });

  it('should show related tasks in owner cards', () => {
    renderWithRouter(<Owners />);

    // 장바구니 시스템에 연관된 작업
    expect(screen.getByText('장바구니 UI 전면 개편')).toBeInTheDocument();
    expect(screen.getByText('장바구니 API 응답 변경')).toBeInTheDocument();
  });
});
