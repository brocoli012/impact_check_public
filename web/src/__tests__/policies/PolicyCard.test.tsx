/**
 * @module web/__tests__/policies/PolicyCard.test
 * @description PolicyCard 컴포넌트 렌더링 테스트
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PolicyCard from '../../components/policies/PolicyCard';
import type { Policy } from '../../types';

const mockHighConfidencePolicy: Policy = {
  id: 'policy-1',
  name: '장바구니 수량 제한',
  category: '장바구니',
  description: '장바구니 최대 담기 수량을 제한합니다.',
  confidence: 0.85,
  affectedFiles: ['src/constants/cart.ts', 'src/api/cart.ts'],
  relatedTaskIds: ['task-1'],
  source: 'cart-policy.md',
};

const mockMediumConfidencePolicy: Policy = {
  id: 'policy-2',
  name: '결제 수단 제한',
  category: '결제',
  description: '특정 상품의 결제 수단을 제한합니다.',
  confidence: 0.55,
  affectedFiles: ['src/constants/payment.ts'],
  relatedTaskIds: ['task-3'],
  source: 'payment-policy.md',
};

const mockLowConfidencePolicy: Policy = {
  id: 'policy-3',
  name: '배송 불가 지역',
  category: '배송',
  description: '배송 불가 지역 목록을 관리합니다.',
  confidence: 0.3,
  affectedFiles: [],
  relatedTaskIds: [],
  source: 'delivery-policy.md',
};

describe('PolicyCard', () => {
  it('should render policy name', () => {
    render(
      <PolicyCard
        policy={mockHighConfidencePolicy}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText('장바구니 수량 제한')).toBeInTheDocument();
  });

  it('should render category badge', () => {
    render(
      <PolicyCard
        policy={mockHighConfidencePolicy}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText('장바구니')).toBeInTheDocument();
  });

  it('should render description', () => {
    render(
      <PolicyCard
        policy={mockHighConfidencePolicy}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText('장바구니 최대 담기 수량을 제한합니다.')).toBeInTheDocument();
  });

  it('should render affected files count', () => {
    render(
      <PolicyCard
        policy={mockHighConfidencePolicy}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText('파일 2개')).toBeInTheDocument();
  });

  it('should show high confidence with green color label', () => {
    render(
      <PolicyCard
        policy={mockHighConfidencePolicy}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText('85% (높음)')).toBeInTheDocument();
  });

  it('should show medium confidence with yellow color label', () => {
    render(
      <PolicyCard
        policy={mockMediumConfidencePolicy}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText('55% (보통)')).toBeInTheDocument();
  });

  it('should show low confidence with red color label', () => {
    render(
      <PolicyCard
        policy={mockLowConfidencePolicy}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText('30% (낮음)')).toBeInTheDocument();
  });

  it('should highlight when selected', () => {
    const { container } = render(
      <PolicyCard
        policy={mockHighConfidencePolicy}
        isSelected={true}
        onClick={vi.fn()}
      />,
    );

    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('border-purple-500');
    expect(card.className).toContain('ring-2');
  });

  it('should not highlight when not selected', () => {
    const { container } = render(
      <PolicyCard
        policy={mockHighConfidencePolicy}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );

    const card = container.firstChild as HTMLElement;
    expect(card.className).not.toContain('border-purple-500');
    expect(card.className).toContain('border-gray-200');
  });

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();

    render(
      <PolicyCard
        policy={mockHighConfidencePolicy}
        isSelected={false}
        onClick={handleClick}
      />,
    );

    fireEvent.click(screen.getByText('장바구니 수량 제한'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should call onClick when Enter key is pressed', () => {
    const handleClick = vi.fn();

    render(
      <PolicyCard
        policy={mockHighConfidencePolicy}
        isSelected={false}
        onClick={handleClick}
      />,
    );

    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should render zero files count', () => {
    render(
      <PolicyCard
        policy={mockLowConfidencePolicy}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText('파일 0개')).toBeInTheDocument();
  });
});
