/**
 * @module web/__tests__/policies/PolicyDetail.test
 * @description PolicyDetail 컴포넌트 렌더링 테스트
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PolicyDetailComponent from '../../components/policies/PolicyDetail';
import type { PolicyDetail } from '../../types';

/** 기본 정책 상세 (보강 주석 없음) */
const mockPolicyWithoutAnnotation: PolicyDetail = {
  id: 'policy-1',
  name: '장바구니 수량 제한',
  category: '장바구니',
  description: '장바구니 최대 담기 수량을 제한합니다.',
  confidence: 0.85,
  affectedFiles: ['src/constants/cart.ts', 'src/api/cart.ts'],
  relatedTaskIds: ['task-1'],
  source: 'cart-policy.md',
  rules: [],
  changeHistory: [],
  relatedPolicies: [],
  annotation: null,
};

/** 보강 주석 포함 정책 상세 */
const mockPolicyWithAnnotation: PolicyDetail = {
  id: 'policy-2',
  name: '배송비 정책',
  category: '배송',
  description: '주문 금액에 따라 배송비를 결정합니다.',
  confidence: 0.72,
  affectedFiles: ['src/constants/delivery.ts', 'src/utils/shipping.ts'],
  relatedTaskIds: ['task-2'],
  source: 'delivery-policy.md',
  rules: [],
  changeHistory: [],
  relatedPolicies: [],
  annotation: {
    file: 'src/constants/delivery.ts',
    system: 'delivery',
    lastAnalyzed: '2024-01-01T00:00:00Z',
    fileSummary: {
      description: '배송비 계산 관련 상수 및 유틸리티',
      confidence: 0.8,
      businessDomain: '배송',
      keywords: ['배송비', '무료배송'],
    },
    annotations: [
      {
        function: 'calculateShippingFee',
        signature: 'calculateShippingFee(orderAmount: number): number',
        enriched_comment: '주문 금액에 따라 배송비를 계산',
        confidence: 0.85,
        type: 'business_logic',
        policies: [
          {
            name: '배송비 정책',
            description: '주문 금액에 따라 배송비를 결정합니다.',
            confidence: 0.72,
            category: '배송',
            inferred_from: 'code_analysis',
            conditions: [
              {
                order: 1,
                type: 'if',
                condition: '주문금액 >= 30000',
                conditionCode: 'orderAmount >= 30000',
                result: '무료 배송',
                resultValue: '0',
              },
              {
                order: 2,
                type: 'else',
                condition: '',
                conditionCode: '',
                result: '기본 배송비 적용',
                resultValue: '3000',
              },
            ],
            inputVariables: [
              {
                name: 'orderAmount',
                type: 'number',
                description: '주문 금액',
              },
            ],
            constants: [
              {
                name: 'FREE_SHIPPING_THRESHOLD',
                value: '30000',
                type: 'number',
                description: '무료 배송 기준 금액',
                source: 'hardcoded',
                codeLocation: 'src/constants/delivery.ts:15',
              },
            ],
            constraints: [
              {
                severity: 'warning',
                type: 'hardcoded_value',
                description: '무료 배송 기준 금액이 하드코딩되어 있음',
                recommendation: '환경변수 또는 설정 파일로 분리 권장',
                relatedCode: 'const threshold = 30000',
              },
            ],
            reviewItems: [
              {
                priority: 'high',
                category: 'value_check',
                question: '무료 배송 기준 금액 30,000원이 현재 정책과 일치하나요?',
                context: '코드에서 하드코딩된 값을 발견함',
                relatedConstraint: null,
              },
            ],
          },
        ],
        relatedFunctions: ['getDeliveryInfo'],
        relatedApis: ['/api/delivery/fee'],
      },
    ],
  },
};

/** 보강 주석은 있지만 정책 데이터가 비어있는 경우 */
const mockPolicyWithEmptyAnnotation: PolicyDetail = {
  id: 'policy-3',
  name: '빈 보강 주석 정책',
  category: '기타',
  description: '보강 주석은 있지만 내용이 비어있는 정책',
  confidence: 0.5,
  affectedFiles: [],
  relatedTaskIds: [],
  source: 'test.md',
  rules: [],
  changeHistory: [],
  relatedPolicies: [],
  annotation: {
    file: 'src/test.ts',
    system: 'test',
    lastAnalyzed: '2024-01-01T00:00:00Z',
    fileSummary: {
      description: '테스트 파일',
      confidence: 0.5,
      businessDomain: '기타',
      keywords: [],
    },
    annotations: [],
  },
};

describe('PolicyDetail', () => {
  it('should render policy basic info (name, category, description)', () => {
    render(
      <PolicyDetailComponent
        policy={mockPolicyWithoutAnnotation}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('정책 상세')).toBeInTheDocument();
    // Policy name appears in detail panel and PolicyGraph node
    const policyNames = screen.getAllByText('장바구니 수량 제한');
    expect(policyNames.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('장바구니')).toBeInTheDocument();
    expect(screen.getByText('장바구니 최대 담기 수량을 제한합니다.')).toBeInTheDocument();
  });

  it('should render confidence badge', () => {
    render(
      <PolicyDetailComponent
        policy={mockPolicyWithoutAnnotation}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('should render affected files list', () => {
    render(
      <PolicyDetailComponent
        policy={mockPolicyWithoutAnnotation}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('관련 파일')).toBeInTheDocument();
    expect(screen.getByText('src/constants/cart.ts')).toBeInTheDocument();
    expect(screen.getByText('src/api/cart.ts')).toBeInTheDocument();
  });

  it('should show no-annotation notice when annotation is null', () => {
    render(
      <PolicyDetailComponent
        policy={mockPolicyWithoutAnnotation}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('no-annotation-notice')).toBeInTheDocument();
    expect(
      screen.getByText('보강 주석을 생성하면 조건/변수/제약사항 등 상세 정보를 확인할 수 있습니다'),
    ).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const handleClose = vi.fn();

    render(
      <PolicyDetailComponent
        policy={mockPolicyWithoutAnnotation}
        onClose={handleClose}
      />,
    );

    fireEvent.click(screen.getByLabelText('패널 닫기'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('should render ConditionFlow when annotation has conditions', () => {
    render(
      <PolicyDetailComponent
        policy={mockPolicyWithAnnotation}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('조건 분기')).toBeInTheDocument();
    expect(screen.getByTestId('condition-flow')).toBeInTheDocument();
    expect(screen.getByText('주문금액 >= 30000')).toBeInTheDocument();
  });

  it('should render input variables from annotation', () => {
    render(
      <PolicyDetailComponent
        policy={mockPolicyWithAnnotation}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('입력 변수')).toBeInTheDocument();
    expect(screen.getByTestId('input-variables')).toBeInTheDocument();
    expect(screen.getByText('orderAmount')).toBeInTheDocument();
    expect(screen.getByText('주문 금액')).toBeInTheDocument();
  });

  it('should render constants from annotation', () => {
    render(
      <PolicyDetailComponent
        policy={mockPolicyWithAnnotation}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('상수')).toBeInTheDocument();
    expect(screen.getByTestId('constants-list')).toBeInTheDocument();
    expect(screen.getByText('FREE_SHIPPING_THRESHOLD')).toBeInTheDocument();
    expect(screen.getByText('30000')).toBeInTheDocument();
  });

  it('should render constraints from annotation', () => {
    render(
      <PolicyDetailComponent
        policy={mockPolicyWithAnnotation}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('제약사항')).toBeInTheDocument();
    expect(screen.getByTestId('constraints-list')).toBeInTheDocument();
    expect(screen.getByText('무료 배송 기준 금액이 하드코딩되어 있음')).toBeInTheDocument();
    expect(screen.getByText('권장: 환경변수 또는 설정 파일로 분리 권장')).toBeInTheDocument();
  });

  it('should render review items from annotation', () => {
    render(
      <PolicyDetailComponent
        policy={mockPolicyWithAnnotation}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('리뷰 항목')).toBeInTheDocument();
    expect(screen.getByTestId('review-items')).toBeInTheDocument();
    expect(
      screen.getByText('무료 배송 기준 금액 30,000원이 현재 정책과 일치하나요?'),
    ).toBeInTheDocument();
  });

  it('should render PolicyGraph component', () => {
    render(
      <PolicyDetailComponent
        policy={mockPolicyWithAnnotation}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('영향 범위')).toBeInTheDocument();
    expect(screen.getByTestId('policy-graph')).toBeInTheDocument();
  });

  it('should render empty graph message when no affected files', () => {
    render(
      <PolicyDetailComponent
        policy={mockPolicyWithEmptyAnnotation}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('policy-graph-empty')).toBeInTheDocument();
  });

  it('should render ConditionFlow empty message when annotation has no conditions', () => {
    render(
      <PolicyDetailComponent
        policy={mockPolicyWithEmptyAnnotation}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('condition-flow-empty')).toBeInTheDocument();
    expect(screen.getByText('조건 분기 정보가 없습니다')).toBeInTheDocument();
  });

  it('should have policy-detail data-testid', () => {
    render(
      <PolicyDetailComponent
        policy={mockPolicyWithoutAnnotation}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('policy-detail')).toBeInTheDocument();
  });
});
