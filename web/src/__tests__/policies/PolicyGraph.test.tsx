/**
 * @module web/__tests__/policies/PolicyGraph.test
 * @description PolicyGraph 컴포넌트 렌더링 테스트
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PolicyGraph from '../../components/policies/PolicyGraph';

describe('PolicyGraph', () => {
  it('should render graph container', () => {
    render(
      <PolicyGraph
        policyName="장바구니 수량 제한"
        affectedFiles={['src/constants/cart.ts']}
      />,
    );

    expect(screen.getByTestId('policy-graph')).toBeInTheDocument();
  });

  it('should render policy name as central node', () => {
    render(
      <PolicyGraph
        policyName="장바구니 수량 제한"
        affectedFiles={['src/constants/cart.ts']}
      />,
    );

    // ReactFlow renders node labels
    expect(screen.getByText('장바구니 수량 제한')).toBeInTheDocument();
  });

  it('should render file nodes with file names', () => {
    render(
      <PolicyGraph
        policyName="배송 정책"
        affectedFiles={[
          'src/constants/delivery.ts',
          'src/api/shipping.ts',
          'src/utils/address.ts',
        ]}
      />,
    );

    expect(screen.getByText('delivery.ts')).toBeInTheDocument();
    expect(screen.getByText('shipping.ts')).toBeInTheDocument();
    expect(screen.getByText('address.ts')).toBeInTheDocument();
  });

  it('should show empty message when no affected files', () => {
    render(
      <PolicyGraph
        policyName="빈 정책"
        affectedFiles={[]}
      />,
    );

    expect(screen.getByTestId('policy-graph-empty')).toBeInTheDocument();
    expect(screen.getByText('영향 범위 정보가 없습니다')).toBeInTheDocument();
  });

  it('should limit to 10 file nodes', () => {
    const manyFiles = Array.from({ length: 15 }, (_, i) => `src/file${i + 1}.ts`);

    render(
      <PolicyGraph
        policyName="많은 파일 정책"
        affectedFiles={manyFiles}
      />,
    );

    // First 10 files should be visible
    expect(screen.getByText('file1.ts')).toBeInTheDocument();
    expect(screen.getByText('file10.ts')).toBeInTheDocument();

    // 11th+ files should NOT be visible as nodes
    expect(screen.queryByText('file11.ts')).not.toBeInTheDocument();

    // "외 5개 파일" message
    expect(screen.getByText('외 5개 파일')).toBeInTheDocument();
  });

  it('should not show extra files message when 10 or fewer files', () => {
    const files = Array.from({ length: 10 }, (_, i) => `src/file${i + 1}.ts`);

    render(
      <PolicyGraph
        policyName="적당한 파일 정책"
        affectedFiles={files}
      />,
    );

    expect(screen.queryByText(/외 \d+개 파일/)).not.toBeInTheDocument();
  });

  it('should render with single file', () => {
    render(
      <PolicyGraph
        policyName="단일 파일"
        affectedFiles={['src/index.ts']}
      />,
    );

    expect(screen.getByText('단일 파일')).toBeInTheDocument();
    expect(screen.getByText('index.ts')).toBeInTheDocument();
  });
});
