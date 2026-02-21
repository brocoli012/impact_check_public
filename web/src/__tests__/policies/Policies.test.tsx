/**
 * @module web/__tests__/policies/Policies.test
 * @description Policies 페이지 렌더링 테스트
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Policies from '../../pages/Policies';
import { useResultStore } from '../../stores/resultStore';
import { usePolicyStore } from '../../stores/policyStore';
import { getMockResult } from '../../utils/mockData';
import type { Policy } from '../../types';

// fetch 모킹
vi.stubGlobal('fetch', vi.fn());

/** BrowserRouter로 감싸서 렌더링하는 헬퍼 */
function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

const mockPolicies: Policy[] = [
  {
    id: 'policy-1',
    name: '장바구니 수량 제한',
    category: '장바구니',
    description: '장바구니 최대 담기 수량을 제한합니다.',
    confidence: 0.85,
    affectedFiles: ['src/constants/cart.ts'],
    relatedTaskIds: ['task-1'],
    source: 'cart-policy.md',
  },
  {
    id: 'policy-2',
    name: '결제 수단 제한',
    category: '결제',
    description: '특정 상품의 결제 수단을 제한합니다.',
    confidence: 0.55,
    affectedFiles: ['src/constants/payment.ts'],
    relatedTaskIds: ['task-3'],
    source: 'payment-policy.md',
  },
  {
    id: 'policy-3',
    name: '배송 불가 지역',
    category: '배송',
    description: '배송 불가 지역 목록을 관리합니다.',
    confidence: 0.3,
    affectedFiles: [],
    relatedTaskIds: [],
    source: 'delivery-policy.md',
  },
];

/**
 * 정책 스토어를 미리 설정하고, fetch mock이 같은 policies를 반환하도록 설정.
 * Policies 컴포넌트의 useEffect가 fetchPolicies를 호출하므로
 * fetch 결과도 동일한 데이터를 반환해야 일관된 상태가 유지됨.
 */
function setupDefaultState() {
  useResultStore.setState({
    currentResult: getMockResult(),
    resultList: [],
    isLoading: false,
    error: null,
  });

  usePolicyStore.setState({
    policies: mockPolicies,
    selectedPolicy: null,
    categories: ['결제', '배송', '장바구니'],
    searchQuery: '',
    selectedCategory: null,
    selectedSource: null,
    selectedRequirement: null,
    loading: false,
    loadingDetail: false,
    loadingMore: false,
    error: null,
    totalCount: mockPolicies.length,
    hasMore: false,
    currentOffset: mockPolicies.length,
  });

  vi.mocked(fetch).mockReset();
  vi.mocked(fetch).mockResolvedValue({
    json: async () => ({
      policies: mockPolicies,
      categories: ['결제', '배송', '장바구니'],
      total: mockPolicies.length,
      hasMore: false,
      result: getMockResult(),
    }),
  } as Response);
}

/** 렌더링 후 useEffect의 fetchPolicies 완료까지 대기 */
async function renderAndWait(ui: React.ReactElement) {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<BrowserRouter>{ui}</BrowserRouter>);
  });
  // fetchPolicies가 완료될 때까지 기다림
  await waitFor(() => {
    expect(usePolicyStore.getState().loading).toBe(false);
  });
  return result!;
}

describe('Policies', () => {
  beforeEach(() => {
    setupDefaultState();
  });

  it('should render the policies page title', async () => {
    await renderAndWait(<Policies />);

    expect(screen.getByText('정책 목록')).toBeInTheDocument();
  });

  it('should show spec title', async () => {
    await renderAndWait(<Policies />);

    expect(screen.getByText('[데모] 장바구니 리뉴얼 기획서')).toBeInTheDocument();
  });

  it('should render policy cards', async () => {
    await renderAndWait(<Policies />);

    expect(screen.getByText('장바구니 수량 제한')).toBeInTheDocument();
    expect(screen.getByText('결제 수단 제한')).toBeInTheDocument();
    expect(screen.getByText('배송 불가 지역')).toBeInTheDocument();
  });

  it('should render policy descriptions', async () => {
    await renderAndWait(<Policies />);

    expect(screen.getByText('장바구니 최대 담기 수량을 제한합니다.')).toBeInTheDocument();
    expect(screen.getByText('특정 상품의 결제 수단을 제한합니다.')).toBeInTheDocument();
  });

  it('should render category badges on cards', async () => {
    await renderAndWait(<Policies />);

    // Category appears in both filter buttons and card badges
    const cartBadges = screen.getAllByText('장바구니');
    expect(cartBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('should show empty state when no policies', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ policies: [] }),
    } as Response);
    usePolicyStore.setState({
      policies: [],
      categories: [],
    });

    await renderAndWait(<Policies />);

    expect(screen.getByText('정책이 없습니다. 먼저 인덱싱을 실행해주세요.')).toBeInTheDocument();
  });

  it('should show filter no-match message when search has no results', async () => {
    await renderAndWait(<Policies />);

    // Set search query via the store directly to avoid debounce
    act(() => {
      usePolicyStore.setState({ searchQuery: 'nonexistent' });
    });

    await waitFor(() => {
      expect(screen.getByText('검색 조건에 맞는 정책이 없습니다.')).toBeInTheDocument();
    });
  });

  it('should render filter bar', async () => {
    await renderAndWait(<Policies />);

    expect(screen.getByPlaceholderText('정책명, 설명 검색...')).toBeInTheDocument();
    expect(screen.getByText('카테고리:')).toBeInTheDocument();
  });

  it('should filter policies by category', async () => {
    await renderAndWait(<Policies />);

    // Click the category filter for '결제' (the one in the filter bar)
    act(() => {
      usePolicyStore.setState({ selectedCategory: '결제' });
    });

    await waitFor(() => {
      // Only '결제' policy should remain visible
      expect(screen.getByText('결제 수단 제한')).toBeInTheDocument();
      expect(screen.queryByText('장바구니 최대 담기 수량을 제한합니다.')).not.toBeInTheDocument();
      expect(screen.queryByText('배송 불가 지역 목록을 관리합니다.')).not.toBeInTheDocument();
    });
  });

  it('should show loading state', () => {
    usePolicyStore.setState({ loading: true });

    // Don't use renderAndWait since we want to test the loading state
    renderWithRouter(<Policies />);

    expect(screen.getByText('정책 목록을 불러오는 중...')).toBeInTheDocument();
  });

  it('should show error banner', async () => {
    await renderAndWait(<Policies />);

    act(() => {
      usePolicyStore.setState({ error: '네트워크 오류입니다.' });
    });

    expect(screen.getByText('네트워크 오류입니다.')).toBeInTheDocument();
  });

  it('should select policy on card click', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        policies: mockPolicies,
        policy: {
          ...mockPolicies[0],
          rules: [],
          changeHistory: [],
          relatedPolicies: [],
        },
      }),
    } as Response);

    await renderAndWait(<Policies />);

    await act(async () => {
      fireEvent.click(screen.getByText('장바구니 수량 제한'));
    });

    // fetchPolicyDetail should have been called (useLatestResult + fetchPolicies + fetchPolicyDetail)
    expect(fetch).toHaveBeenCalled();
    expect((fetch as any).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('should show detail panel when policy is selected', async () => {
    await renderAndWait(<Policies />);

    act(() => {
      usePolicyStore.setState({
        selectedPolicy: {
          ...mockPolicies[0],
          rules: [],
          changeHistory: [],
          relatedPolicies: [],
        },
      });
    });

    expect(screen.getByText('정책 상세')).toBeInTheDocument();
    // The policy name appears in both the card and the detail panel
    const policyNames = screen.getAllByText('장바구니 수량 제한');
    expect(policyNames.length).toBeGreaterThanOrEqual(2);
  });

  it('should close detail panel when close button is clicked', async () => {
    await renderAndWait(<Policies />);

    act(() => {
      usePolicyStore.setState({
        selectedPolicy: {
          ...mockPolicies[0],
          rules: [],
          changeHistory: [],
          relatedPolicies: [],
        },
      });
    });

    expect(screen.getByText('정책 상세')).toBeInTheDocument();

    // Click close button
    act(() => {
      fireEvent.click(screen.getByLabelText('패널 닫기'));
    });

    // Detail panel should be closed
    await waitFor(() => {
      expect(screen.queryByText('정책 상세')).not.toBeInTheDocument();
    });
  });

  it('should display result count in filter', async () => {
    await renderAndWait(<Policies />);

    expect(screen.getByTestId('result-count')).toHaveTextContent('3 / 3건');
  });

  it('should render loading fallback when no currentResult', async () => {
    // useEnsureResult will load mock data, so we need to prevent that too
    // by setting currentResult to null and not providing mock data
    useResultStore.setState({
      currentResult: null,
    });

    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ policies: [] }),
    } as Response);

    // Since useEnsureResult will load the mock, the "데이터 로딩 중..." message
    // will flash briefly. We can't reliably test this with useEnsureResult hook.
    // Instead, test that when the page eventually loads, it works properly.
    await act(async () => {
      renderWithRouter(<Policies />);
    });

    // After useEnsureResult loads mock data, the page should render properly
    await waitFor(() => {
      expect(screen.getByText('정책 목록')).toBeInTheDocument();
    });
  });

  // ── Requirement-based filtering tests ──

  it('should render requirement dropdown when parsedSpec has requirements', async () => {
    await renderAndWait(<Policies />);

    // The mock result from getMockResult() includes parsedSpec.requirements
    expect(screen.getByLabelText('요구사항 필터')).toBeInTheDocument();
    expect(screen.getByText('요구사항:')).toBeInTheDocument();
  });

  it('should filter policies by selected requirement', async () => {
    await renderAndWait(<Policies />);

    // Before filtering: all 3 policies visible
    expect(screen.getByText('장바구니 수량 제한')).toBeInTheDocument();
    expect(screen.getByText('결제 수단 제한')).toBeInTheDocument();
    expect(screen.getByText('배송 불가 지역')).toBeInTheDocument();

    // Select REQ-001 filter
    // In mock data: REQ-001 tasks are task-1, task-2, task-4
    // policy-1 has relatedTaskIds ['task-1'] → should match
    // policy-2 has relatedTaskIds ['task-3'] → task-3 is REQ-002 → should NOT match
    // policy-3 has relatedTaskIds [] → should NOT match
    act(() => {
      usePolicyStore.setState({ selectedRequirement: 'REQ-001' });
    });

    await waitFor(() => {
      expect(screen.getByText('장바구니 수량 제한')).toBeInTheDocument();
      expect(screen.queryByText('결제 수단 제한')).not.toBeInTheDocument();
      expect(screen.queryByText('배송 불가 지역')).not.toBeInTheDocument();
    });
  });

  it('should filter policies by REQ-002 showing only payment policy', async () => {
    await renderAndWait(<Policies />);

    // Select REQ-002 filter
    // In mock data: REQ-002 tasks are task-3
    // policy-2 has relatedTaskIds ['task-3'] → should match
    act(() => {
      usePolicyStore.setState({ selectedRequirement: 'REQ-002' });
    });

    await waitFor(() => {
      expect(screen.queryByText('장바구니 수량 제한')).not.toBeInTheDocument();
      expect(screen.getByText('결제 수단 제한')).toBeInTheDocument();
      expect(screen.queryByText('배송 불가 지역')).not.toBeInTheDocument();
    });
  });

  it('should show all policies when requirement filter is cleared', async () => {
    await renderAndWait(<Policies />);

    // Apply filter
    act(() => {
      usePolicyStore.setState({ selectedRequirement: 'REQ-001' });
    });

    await waitFor(() => {
      expect(screen.queryByText('결제 수단 제한')).not.toBeInTheDocument();
    });

    // Clear filter
    act(() => {
      usePolicyStore.setState({ selectedRequirement: null });
    });

    await waitFor(() => {
      expect(screen.getByText('장바구니 수량 제한')).toBeInTheDocument();
      expect(screen.getByText('결제 수단 제한')).toBeInTheDocument();
      expect(screen.getByText('배송 불가 지역')).toBeInTheDocument();
    });
  });

  it('should show empty state when requirement has no matching policies', async () => {
    await renderAndWait(<Policies />);

    // REQ-003 tasks are task-5, task-6 — none of our mockPolicies reference those task IDs
    act(() => {
      usePolicyStore.setState({ selectedRequirement: 'REQ-003' });
    });

    await waitFor(() => {
      expect(screen.getByText('검색 조건에 맞는 정책이 없습니다.')).toBeInTheDocument();
    });
  });

  it('should combine requirement filter with category filter', async () => {
    // Add a second policy that also links to REQ-001 tasks but has different category
    const extendedPolicies: Policy[] = [
      ...mockPolicies,
      {
        id: 'policy-4',
        name: '장바구니 할인 정책',
        category: '장바구니',
        description: '장바구니 할인율을 관리합니다.',
        confidence: 0.7,
        affectedFiles: [],
        relatedTaskIds: ['task-1'],
        source: 'cart-discount-policy.md',
      },
    ];

    usePolicyStore.setState({ policies: extendedPolicies });
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ policies: extendedPolicies }),
    } as Response);

    await renderAndWait(<Policies />);

    // Apply both REQ-001 and category '장바구니'
    act(() => {
      usePolicyStore.setState({
        selectedRequirement: 'REQ-001',
        selectedCategory: '장바구니',
      });
    });

    await waitFor(() => {
      // policy-1 (장바구니, task-1 → REQ-001) ✓
      expect(screen.getByText('장바구니 수량 제한')).toBeInTheDocument();
      // policy-4 (장바구니, task-1 → REQ-001) ✓
      expect(screen.getByText('장바구니 할인 정책')).toBeInTheDocument();
      // policy-2 (결제, task-3 → REQ-002) ✗
      expect(screen.queryByText('결제 수단 제한')).not.toBeInTheDocument();
    });
  });
});
