/**
 * @module web/__tests__/policies/sourceFilter.test
 * @description 소스 필터 및 소스 배지 기능 테스트 (REQ-011 TASK-066)
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Policies from '../../pages/Policies';
import { useResultStore } from '../../stores/resultStore';
import { usePolicyStore } from '../../stores/policyStore';
import { getMockResult } from '../../utils/mockData';
import PolicyCard from '../../components/policies/PolicyCard';
import PolicyFilter from '../../components/policies/PolicyFilter';
import type { Policy } from '../../types';

// fetch 모킹
vi.stubGlobal('fetch', vi.fn());

const mockPoliciesWithSources: Policy[] = [
  {
    id: 'policy-1',
    name: '무료배송 정책',
    category: '배송',
    description: '50,000원 이상 주문 시 무료배송',
    confidence: 0.85,
    affectedFiles: ['src/services/shipping.ts'],
    relatedTaskIds: ['task-1'],
    source: 'comment',
  },
  {
    id: 'policy-2',
    name: '결제 수단 제한',
    category: '결제',
    description: '특정 상품의 결제 수단을 제한합니다.',
    confidence: 0.55,
    affectedFiles: ['src/constants/payment.ts'],
    relatedTaskIds: [],
    source: 'readme',
  },
  {
    id: 'policy-3',
    name: '수동 입력 정책',
    category: '주문',
    description: '수동으로 입력된 정책입니다.',
    confidence: 0,
    affectedFiles: [],
    relatedTaskIds: [],
    source: 'manual',
  },
  {
    id: 'ann-policy-1',
    name: 'AI 추론 배송비 정책',
    category: '배송',
    description: 'AI가 추론한 배송비 할인 정책',
    confidence: 0.72,
    affectedFiles: ['src/services/delivery.ts'],
    relatedTaskIds: [],
    source: 'annotation',
  },
];

describe('Source Badge and Filter', () => {
  // ============================================================
  // PolicyCard Source Badge
  // ============================================================

  describe('PolicyCard Source Badge', () => {
    it('should display "코드 주석" badge for comment source', () => {
      render(
        <PolicyCard
          policy={mockPoliciesWithSources[0]}
          isSelected={false}
          onClick={() => {}}
        />,
      );
      expect(screen.getByTestId('source-badge')).toHaveTextContent('코드 주석');
    });

    it('should display "문서" badge for readme source', () => {
      render(
        <PolicyCard
          policy={mockPoliciesWithSources[1]}
          isSelected={false}
          onClick={() => {}}
        />,
      );
      expect(screen.getByTestId('source-badge')).toHaveTextContent('문서');
    });

    it('should display "수동 입력" badge for manual source', () => {
      render(
        <PolicyCard
          policy={mockPoliciesWithSources[2]}
          isSelected={false}
          onClick={() => {}}
        />,
      );
      expect(screen.getByTestId('source-badge')).toHaveTextContent('수동 입력');
    });

    it('should display "AI 추론" badge for annotation source', () => {
      render(
        <PolicyCard
          policy={mockPoliciesWithSources[3]}
          isSelected={false}
          onClick={() => {}}
        />,
      );
      expect(screen.getByTestId('source-badge')).toHaveTextContent('AI 추론');
    });
  });

  // ============================================================
  // PolicyFilter Source Tabs
  // ============================================================

  describe('PolicyFilter Source Tabs', () => {
    beforeEach(() => {
      usePolicyStore.setState({
        policies: mockPoliciesWithSources,
        selectedPolicy: null,
        categories: ['배송', '결제', '주문'],
        searchQuery: '',
        selectedCategory: null,
        selectedSource: null,
        selectedRequirement: null,
        loading: false,
        loadingMore: false,
        error: null,
        totalCount: mockPoliciesWithSources.length,
        hasMore: false,
        currentOffset: mockPoliciesWithSources.length,
      });
    });

    it('should render source filter section with label', () => {
      render(<PolicyFilter resultCount={4} totalCount={4} />);
      expect(screen.getByText('출처:')).toBeInTheDocument();
    });

    it('should render all source filter buttons', () => {
      render(<PolicyFilter resultCount={4} totalCount={4} />);
      expect(screen.getByTestId('source-filter-all')).toBeInTheDocument();
      expect(screen.getByTestId('source-filter-comment')).toBeInTheDocument();
      expect(screen.getByTestId('source-filter-readme')).toBeInTheDocument();
      expect(screen.getByTestId('source-filter-manual')).toBeInTheDocument();
      expect(screen.getByTestId('source-filter-annotation')).toBeInTheDocument();
    });

    it('should update selectedSource in store when source filter clicked', () => {
      render(<PolicyFilter resultCount={4} totalCount={4} />);
      fireEvent.click(screen.getByTestId('source-filter-annotation'));
      expect(usePolicyStore.getState().selectedSource).toBe('annotation');
    });

    it('should clear source filter when "전체" clicked', () => {
      usePolicyStore.setState({ selectedSource: 'comment' });
      render(<PolicyFilter resultCount={4} totalCount={4} />);
      fireEvent.click(screen.getByTestId('source-filter-all'));
      expect(usePolicyStore.getState().selectedSource).toBeNull();
    });

    it('should highlight active source button', () => {
      usePolicyStore.setState({ selectedSource: 'annotation' });
      render(<PolicyFilter resultCount={4} totalCount={4} />);
      const activeBtn = screen.getByTestId('source-filter-annotation');
      expect(activeBtn.className).toContain('bg-purple-100');
    });
  });

  // ============================================================
  // Policies Page Source Filtering
  // ============================================================

  describe('Policies page source filtering', () => {
    beforeEach(() => {
      useResultStore.setState({
        currentResult: getMockResult(),
        resultList: [],
        isLoading: false,
        error: null,
      });

      usePolicyStore.setState({
        policies: mockPoliciesWithSources,
        selectedPolicy: null,
        categories: ['배송', '결제', '주문'],
        searchQuery: '',
        selectedCategory: null,
        selectedSource: null,
        selectedRequirement: null,
        loading: false,
        loadingMore: false,
        error: null,
        totalCount: mockPoliciesWithSources.length,
        hasMore: false,
        currentOffset: mockPoliciesWithSources.length,
      });

      vi.mocked(fetch).mockReset();
      vi.mocked(fetch).mockResolvedValue({
        json: async () => ({
          policies: mockPoliciesWithSources,
          categories: ['배송', '결제', '주문'],
          total: mockPoliciesWithSources.length,
          hasMore: false,
          result: getMockResult(),
        }),
      } as Response);
    });

    it('should filter to show only annotation source policies', async () => {
      await act(async () => {
        render(<BrowserRouter><Policies /></BrowserRouter>);
      });

      await waitFor(() => {
        expect(usePolicyStore.getState().loading).toBe(false);
      });

      act(() => {
        usePolicyStore.setState({ selectedSource: 'annotation' });
      });

      await waitFor(() => {
        expect(screen.getByText('AI 추론 배송비 정책')).toBeInTheDocument();
        expect(screen.queryByText('무료배송 정책')).not.toBeInTheDocument();
        expect(screen.queryByText('결제 수단 제한')).not.toBeInTheDocument();
      });
    });

    it('should show all policies when source filter is cleared', async () => {
      await act(async () => {
        render(<BrowserRouter><Policies /></BrowserRouter>);
      });

      await waitFor(() => {
        expect(usePolicyStore.getState().loading).toBe(false);
      });

      // Apply then clear
      act(() => {
        usePolicyStore.setState({ selectedSource: 'comment' });
      });
      act(() => {
        usePolicyStore.setState({ selectedSource: null });
      });

      await waitFor(() => {
        expect(screen.getByText('무료배송 정책')).toBeInTheDocument();
        expect(screen.getByText('AI 추론 배송비 정책')).toBeInTheDocument();
      });
    });
  });
});
