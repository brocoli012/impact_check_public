/**
 * @module web/components/dashboard/__tests__/DonutChart.test
 * @description DonutChart 컴포넌트 단위 테스트 (TASK-033)
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DonutChart from '../DonutChart';
import type { Task } from '../../../types';

/* ------------------------------------------------------------------ */
/*  useNavigate 모킹                                                   */
/* ------------------------------------------------------------------ */

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

/* ------------------------------------------------------------------ */
/*  테스트 헬퍼                                                        */
/* ------------------------------------------------------------------ */

function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

/** FE 4건 + BE 2건 태스크 목록 */
function getTasks(): Task[] {
  return [
    {
      id: 't1',
      title: '장바구니 UI 개편',
      type: 'FE',
      actionType: 'modify',
      description: '',
      affectedFiles: [],
      relatedApis: [],
      planningChecks: [],
      rationale: '',
    },
    {
      id: 't2',
      title: '상품 목록 컴포넌트',
      type: 'FE',
      actionType: 'new',
      description: '',
      affectedFiles: [],
      relatedApis: [],
      planningChecks: [],
      rationale: '',
    },
    {
      id: 't3',
      title: '결제 화면 수정',
      type: 'FE',
      actionType: 'modify',
      description: '',
      affectedFiles: [],
      relatedApis: [],
      planningChecks: [],
      rationale: '',
    },
    {
      id: 't4',
      title: '마이페이지 연동',
      type: 'FE',
      actionType: 'modify',
      description: '',
      affectedFiles: [],
      relatedApis: [],
      planningChecks: [],
      rationale: '',
    },
    {
      id: 't5',
      title: 'API 응답 변경',
      type: 'BE',
      actionType: 'modify',
      description: '',
      affectedFiles: [],
      relatedApis: [],
      planningChecks: [],
      rationale: '',
    },
    {
      id: 't6',
      title: 'DB 스키마 변경',
      type: 'BE',
      actionType: 'modify',
      description: '',
      affectedFiles: [],
      relatedApis: [],
      planningChecks: [],
      rationale: '',
    },
  ];
}

/* ------------------------------------------------------------------ */
/*  테스트                                                             */
/* ------------------------------------------------------------------ */

describe('DonutChart', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  /* ---------- 기본 렌더링 ---------- */
  describe('기본 렌더링', () => {
    it('헤더에 "FE / BE 작업 비율" 텍스트가 표시된다', () => {
      renderWithRouter(<DonutChart tasks={getTasks()} />);
      expect(screen.getByText('FE / BE 작업 비율')).toBeInTheDocument();
    });

    it('빈 태스크 배열일 때 "작업 데이터가 없습니다" 메시지가 표시된다', () => {
      renderWithRouter(<DonutChart tasks={[]} />);
      expect(screen.getByText('작업 데이터가 없습니다.')).toBeInTheDocument();
    });

    it('빈 태스크 배열일 때도 헤더 링크가 표시된다', () => {
      renderWithRouter(<DonutChart tasks={[]} />);
      expect(screen.getByTestId('donut-header-link')).toBeInTheDocument();
    });

    it('데이터가 있을 때 하단 "전체 작업 목록 보기" 링크가 표시된다', () => {
      renderWithRouter(<DonutChart tasks={getTasks()} />);
      expect(screen.getByTestId('donut-footer-link')).toBeInTheDocument();
      expect(screen.getByTestId('donut-footer-link')).toHaveTextContent(
        '전체 작업 목록 보기 →',
      );
    });
  });

  /* ---------- 섹션 헤더 "작업 목록 보기" 링크 ---------- */
  describe('섹션 헤더 링크', () => {
    it('헤더에 "작업 목록 보기" 링크가 표시된다', () => {
      renderWithRouter(<DonutChart tasks={getTasks()} />);
      expect(screen.getByTestId('donut-header-link')).toHaveTextContent(
        '작업 목록 보기',
      );
    });

    it('헤더 링크 클릭 시 /tickets로 navigate 호출된다', () => {
      renderWithRouter(<DonutChart tasks={getTasks()} />);
      fireEvent.click(screen.getByTestId('donut-header-link'));
      expect(mockNavigate).toHaveBeenCalledWith('/tickets');
    });

    it('헤더 링크에 ChevronRight SVG 아이콘이 포함된다', () => {
      renderWithRouter(<DonutChart tasks={getTasks()} />);
      const link = screen.getByTestId('donut-header-link');
      const svg = link.querySelector('svg');
      expect(svg).not.toBeNull();
    });
  });

  /* ---------- 하단 "전체 작업 목록 보기" 링크 ---------- */
  describe('하단 링크', () => {
    it('하단 링크 클릭 시 /tickets로 navigate 호출된다', () => {
      renderWithRouter(<DonutChart tasks={getTasks()} />);
      fireEvent.click(screen.getByTestId('donut-footer-link'));
      expect(mockNavigate).toHaveBeenCalledWith('/tickets');
    });

    it('빈 태스크 배열일 때 하단 링크는 표시되지 않는다', () => {
      renderWithRouter(<DonutChart tasks={[]} />);
      expect(screen.queryByTestId('donut-footer-link')).not.toBeInTheDocument();
    });
  });

  /* ---------- 접근성 ---------- */
  describe('접근성', () => {
    it('헤더 링크에 적절한 aria-label이 설정되어 있다', () => {
      renderWithRouter(<DonutChart tasks={getTasks()} />);
      const link = screen.getByTestId('donut-header-link');
      expect(link).toHaveAttribute('aria-label', '작업 목록 페이지로 이동');
    });

    it('하단 링크에 적절한 aria-label이 설정되어 있다', () => {
      renderWithRouter(<DonutChart tasks={getTasks()} />);
      const link = screen.getByTestId('donut-footer-link');
      expect(link).toHaveAttribute(
        'aria-label',
        '전체 작업 목록 보기 페이지로 이동',
      );
    });

    it('헤더 링크에 focus:ring-2 focus:ring-purple-400 클래스가 있다', () => {
      renderWithRouter(<DonutChart tasks={getTasks()} />);
      const link = screen.getByTestId('donut-header-link');
      expect(link.className).toContain('focus:ring-2');
      expect(link.className).toContain('focus:ring-purple-400');
    });

    it('하단 링크에 focus:ring-2 focus:ring-purple-400 클래스가 있다', () => {
      renderWithRouter(<DonutChart tasks={getTasks()} />);
      const link = screen.getByTestId('donut-footer-link');
      expect(link.className).toContain('focus:ring-2');
      expect(link.className).toContain('focus:ring-purple-400');
    });

    it('헤더 링크가 button 요소이다 (키보드 접근 가능)', () => {
      renderWithRouter(<DonutChart tasks={getTasks()} />);
      const link = screen.getByTestId('donut-header-link');
      expect(link.tagName).toBe('BUTTON');
    });

    it('하단 링크가 button 요소이다 (키보드 접근 가능)', () => {
      renderWithRouter(<DonutChart tasks={getTasks()} />);
      const link = screen.getByTestId('donut-footer-link');
      expect(link.tagName).toBe('BUTTON');
    });
  });
});
