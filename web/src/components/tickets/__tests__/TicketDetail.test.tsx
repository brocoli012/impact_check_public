/**
 * @module web/components/tickets/__tests__/TicketDetail.test
 * @description TicketDetail 컴포넌트 렌더링 및 상호작용 테스트
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TicketDetail from '../TicketDetail';
import type { Task, TaskScore } from '../../../types';

/** 테스트용 작업 데이터 */
const mockTask: Task = {
  id: 'task-1',
  title: '장바구니 UI 전면 개편',
  type: 'FE',
  actionType: 'modify',
  description: '장바구니 화면의 레이아웃 및 UX를 전면 개편합니다.',
  affectedFiles: ['src/pages/Cart.tsx', 'src/components/CartItem.tsx'],
  relatedApis: ['api-cart-list', 'api-cart-update'],
  planningChecks: ['묶음 배송 정책 확인 필요', 'UI 디자인 시안 리뷰 필요'],
  rationale: '기존 장바구니 UI 구조 변경이 필요합니다.',
  sourceRequirementIds: ['REQ-001', 'REQ-002'],
  sourceFeatureIds: ['FEAT-001'],
};

/** 테스트용 점수 데이터 */
const mockTaskScore: TaskScore = {
  taskId: 'task-1',
  scores: {
    developmentComplexity: { score: 7, weight: 0.35, rationale: 'UI 전면 개편' },
    impactScope: { score: 6, weight: 0.30, rationale: '여러 컴포넌트 영향' },
    policyChange: { score: 4, weight: 0.20, rationale: '정책 변경 포함' },
    dependencyRisk: { score: 5, weight: 0.15, rationale: 'API 의존성' },
  },
  totalScore: 28,
  grade: 'Medium',
};

describe('TicketDetail', () => {
  it('returns null when no task is provided', () => {
    const { container } = render(
      <TicketDetail task={null} onClose={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders task title', () => {
    render(
      <TicketDetail task={mockTask} onClose={vi.fn()} />,
    );
    expect(screen.getByText('장바구니 UI 전면 개편')).toBeInTheDocument();
  });

  it('renders type badge (FE/BE)', () => {
    render(
      <TicketDetail task={mockTask} onClose={vi.fn()} />,
    );
    expect(screen.getByText('FE')).toBeInTheDocument();
  });

  it('renders BE type badge for BE tasks', () => {
    const beTask: Task = { ...mockTask, id: 'task-be', type: 'BE' };
    render(
      <TicketDetail task={beTask} onClose={vi.fn()} />,
    );
    expect(screen.getByText('BE')).toBeInTheDocument();
  });

  it('renders grade badge', () => {
    render(
      <TicketDetail task={mockTask} taskScore={mockTaskScore} onClose={vi.fn()} />,
    );
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('renders actionType badge', () => {
    render(
      <TicketDetail task={mockTask} onClose={vi.fn()} />,
    );
    expect(screen.getByText('기존 수정')).toBeInTheDocument();
  });

  it('renders score breakdown with all 4 dimensions', () => {
    render(
      <TicketDetail task={mockTask} taskScore={mockTaskScore} onClose={vi.fn()} />,
    );

    const breakdown = screen.getByTestId('score-breakdown');
    expect(breakdown).toBeInTheDocument();

    expect(screen.getByText('개발 복잡도')).toBeInTheDocument();
    expect(screen.getByText('영향 범위')).toBeInTheDocument();
    expect(screen.getByText('정책 변경')).toBeInTheDocument();
    expect(screen.getByText('의존성 위험')).toBeInTheDocument();
  });

  it('renders score values and weights', () => {
    render(
      <TicketDetail task={mockTask} taskScore={mockTaskScore} onClose={vi.fn()} />,
    );

    expect(screen.getByText('7/10')).toBeInTheDocument();
    expect(screen.getByText('6/10')).toBeInTheDocument();
    expect(screen.getByText('4/10')).toBeInTheDocument();
    expect(screen.getByText('5/10')).toBeInTheDocument();

    expect(screen.getByText('(35%)')).toBeInTheDocument();
    expect(screen.getByText('(30%)')).toBeInTheDocument();
    expect(screen.getByText('(20%)')).toBeInTheDocument();
    expect(screen.getByText('(15%)')).toBeInTheDocument();
  });

  it('renders score rationale text', () => {
    render(
      <TicketDetail task={mockTask} taskScore={mockTaskScore} onClose={vi.fn()} />,
    );

    expect(screen.getByText('UI 전면 개편')).toBeInTheDocument();
    expect(screen.getByText('여러 컴포넌트 영향')).toBeInTheDocument();
    expect(screen.getByText('정책 변경 포함')).toBeInTheDocument();
    expect(screen.getByText('API 의존성')).toBeInTheDocument();
  });

  it('renders total score', () => {
    render(
      <TicketDetail task={mockTask} taskScore={mockTaskScore} onClose={vi.fn()} />,
    );

    expect(screen.getByText('28점')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(
      <TicketDetail task={mockTask} onClose={vi.fn()} />,
    );
    expect(
      screen.getByText('장바구니 화면의 레이아웃 및 UX를 전면 개편합니다.'),
    ).toBeInTheDocument();
  });

  it('renders rationale', () => {
    render(
      <TicketDetail task={mockTask} onClose={vi.fn()} />,
    );
    expect(
      screen.getByText('기존 장바구니 UI 구조 변경이 필요합니다.'),
    ).toBeInTheDocument();
    expect(screen.getByText('분석 근거')).toBeInTheDocument();
  });

  it('renders affected files', () => {
    render(
      <TicketDetail task={mockTask} onClose={vi.fn()} />,
    );

    const filesSection = screen.getByTestId('affected-files');
    expect(filesSection).toBeInTheDocument();
    expect(screen.getByText('src/pages/Cart.tsx')).toBeInTheDocument();
    expect(screen.getByText('src/components/CartItem.tsx')).toBeInTheDocument();
  });

  it('renders related APIs', () => {
    render(
      <TicketDetail task={mockTask} onClose={vi.fn()} />,
    );

    const apisSection = screen.getByTestId('related-apis');
    expect(apisSection).toBeInTheDocument();
    expect(screen.getByText('api-cart-list')).toBeInTheDocument();
    expect(screen.getByText('api-cart-update')).toBeInTheDocument();
  });

  it('renders planning checks', () => {
    render(
      <TicketDetail task={mockTask} onClose={vi.fn()} />,
    );

    const checksSection = screen.getByTestId('planning-checks');
    expect(checksSection).toBeInTheDocument();
    expect(screen.getByText('묶음 배송 정책 확인 필요')).toBeInTheDocument();
    expect(screen.getByText('UI 디자인 시안 리뷰 필요')).toBeInTheDocument();
  });

  it('renders traceability chips when sourceRequirementIds are present', () => {
    render(
      <TicketDetail task={mockTask} onClose={vi.fn()} />,
    );

    const traceability = screen.getByTestId('traceability');
    expect(traceability).toBeInTheDocument();
    expect(screen.getByText('REQ-001')).toBeInTheDocument();
    expect(screen.getByText('REQ-002')).toBeInTheDocument();
    expect(screen.getByText('FEAT-001')).toBeInTheDocument();
  });

  it('does not render traceability when no source IDs', () => {
    const taskNoTracing: Task = {
      ...mockTask,
      sourceRequirementIds: undefined,
      sourceFeatureIds: undefined,
    };
    render(
      <TicketDetail task={taskNoTracing} onClose={vi.fn()} />,
    );

    expect(screen.queryByTestId('traceability')).not.toBeInTheDocument();
  });

  it('renders screen name', () => {
    render(
      <TicketDetail task={mockTask} screenName="장바구니 화면" onClose={vi.fn()} />,
    );
    expect(screen.getByText('장바구니 화면')).toBeInTheDocument();
  });

  it('close button calls onClose', () => {
    const onClose = vi.fn();
    render(
      <TicketDetail task={mockTask} onClose={onClose} />,
    );

    const closeButton = screen.getByLabelText('패널 닫기');
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render score section when taskScore is not provided', () => {
    render(
      <TicketDetail task={mockTask} onClose={vi.fn()} />,
    );

    expect(screen.queryByTestId('score-breakdown')).not.toBeInTheDocument();
  });

  it('does not render affected files section when no files', () => {
    const taskNoFiles: Task = { ...mockTask, affectedFiles: [] };
    render(
      <TicketDetail task={taskNoFiles} onClose={vi.fn()} />,
    );

    expect(screen.queryByTestId('affected-files')).not.toBeInTheDocument();
  });

  it('does not render related APIs section when no APIs', () => {
    const taskNoApis: Task = { ...mockTask, relatedApis: [] };
    render(
      <TicketDetail task={taskNoApis} onClose={vi.fn()} />,
    );

    expect(screen.queryByTestId('related-apis')).not.toBeInTheDocument();
  });

  it('does not render planning checks section when no checks', () => {
    const taskNoChecks: Task = { ...mockTask, planningChecks: [] };
    render(
      <TicketDetail task={taskNoChecks} onClose={vi.fn()} />,
    );

    expect(screen.queryByTestId('planning-checks')).not.toBeInTheDocument();
  });

  it('has data-testid ticket-detail', () => {
    render(
      <TicketDetail task={mockTask} onClose={vi.fn()} />,
    );

    expect(screen.getByTestId('ticket-detail')).toBeInTheDocument();
  });
});
