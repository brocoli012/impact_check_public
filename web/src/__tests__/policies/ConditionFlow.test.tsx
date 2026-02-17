/**
 * @module web/__tests__/policies/ConditionFlow.test
 * @description ConditionFlow 컴포넌트 렌더링 테스트
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ConditionFlow from '../../components/policies/ConditionFlow';
import type { PolicyCondition } from '../../types';

const mockConditions: PolicyCondition[] = [
  {
    order: 1,
    type: 'if',
    condition: '주문금액 >= 30000',
    conditionCode: 'orderAmount >= 30000',
    result: '무료 배송 적용',
    resultValue: 'freeShipping = true',
  },
  {
    order: 2,
    type: 'else_if',
    condition: '주문금액 >= 10000',
    conditionCode: 'orderAmount >= 10000',
    result: '기본 배송비 적용',
    resultValue: 'shippingFee = 3000',
  },
  {
    order: 3,
    type: 'else',
    condition: '',
    conditionCode: '',
    result: '소액 주문 배송비 적용',
    resultValue: 'shippingFee = 5000',
  },
];

describe('ConditionFlow', () => {
  it('should render condition items', () => {
    render(<ConditionFlow conditions={mockConditions} />);

    expect(screen.getByTestId('condition-flow')).toBeInTheDocument();
    expect(screen.getByTestId('condition-if-1')).toBeInTheDocument();
    expect(screen.getByTestId('condition-else_if-2')).toBeInTheDocument();
    expect(screen.getByTestId('condition-else-3')).toBeInTheDocument();
  });

  it('should render condition labels (IF, ELSE IF, ELSE)', () => {
    render(<ConditionFlow conditions={mockConditions} />);

    const labels = screen.getAllByTestId('condition-label');
    expect(labels[0]).toHaveTextContent('IF');
    expect(labels[1]).toHaveTextContent('ELSE IF');
    expect(labels[2]).toHaveTextContent('ELSE');
  });

  it('should render condition descriptions', () => {
    render(<ConditionFlow conditions={mockConditions} />);

    expect(screen.getByText('주문금액 >= 30000')).toBeInTheDocument();
    expect(screen.getByText('주문금액 >= 10000')).toBeInTheDocument();
  });

  it('should render result descriptions with THEN', () => {
    render(<ConditionFlow conditions={mockConditions} />);

    expect(screen.getByText('무료 배송 적용')).toBeInTheDocument();
    expect(screen.getByText('기본 배송비 적용')).toBeInTheDocument();
    expect(screen.getByText('소액 주문 배송비 적용')).toBeInTheDocument();

    // THEN labels
    const thenLabels = screen.getAllByText('THEN');
    expect(thenLabels.length).toBe(3);
  });

  it('should render result values', () => {
    render(<ConditionFlow conditions={mockConditions} />);

    expect(screen.getByText('= freeShipping = true')).toBeInTheDocument();
    expect(screen.getByText('= shippingFee = 3000')).toBeInTheDocument();
    expect(screen.getByText('= shippingFee = 5000')).toBeInTheDocument();
  });

  it('should apply indent to else_if and else blocks', () => {
    const { container } = render(<ConditionFlow conditions={mockConditions} />);

    // IF block has no indent (marginLeft: 0)
    const ifBlock = container.querySelector('[data-testid="condition-if-1"]') as HTMLElement;
    expect(ifBlock.style.marginLeft).toBe('0px');

    // ELSE IF block has indent (marginLeft: 12px)
    const elseIfBlock = container.querySelector('[data-testid="condition-else_if-2"]') as HTMLElement;
    expect(elseIfBlock.style.marginLeft).toBe('12px');

    // ELSE block has indent (marginLeft: 12px)
    const elseBlock = container.querySelector('[data-testid="condition-else-3"]') as HTMLElement;
    expect(elseBlock.style.marginLeft).toBe('12px');
  });

  it('should show empty message when conditions are empty', () => {
    render(<ConditionFlow conditions={[]} />);

    expect(screen.getByTestId('condition-flow-empty')).toBeInTheDocument();
    expect(screen.getByText('조건 분기 정보가 없습니다')).toBeInTheDocument();
  });

  it('should sort conditions by order', () => {
    // Pass in reverse order
    const reversed = [...mockConditions].reverse();
    render(<ConditionFlow conditions={reversed} />);

    const labels = screen.getAllByTestId('condition-label');
    expect(labels[0]).toHaveTextContent('IF');
    expect(labels[1]).toHaveTextContent('ELSE IF');
    expect(labels[2]).toHaveTextContent('ELSE');
  });

  it('should render single if condition', () => {
    const singleCondition: PolicyCondition[] = [
      {
        order: 1,
        type: 'if',
        condition: '재고 > 0',
        conditionCode: 'stock > 0',
        result: '구매 가능',
        resultValue: '',
      },
    ];

    render(<ConditionFlow conditions={singleCondition} />);

    expect(screen.getByText('재고 > 0')).toBeInTheDocument();
    expect(screen.getByText('구매 가능')).toBeInTheDocument();
  });
});
