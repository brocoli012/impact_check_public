/**
 * @module web/__tests__/policies/policyStore.test
 * @description policyStore Zustand 스토어 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePolicyStore } from '../../stores/policyStore';

// fetch 모킹
vi.stubGlobal('fetch', vi.fn());

const mockPolicies = [
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
    affectedFiles: ['src/constants/payment.ts', 'src/api/payment.ts'],
    relatedTaskIds: ['task-3'],
    source: 'payment-policy.md',
  },
  {
    id: 'policy-3',
    name: '배송 불가 지역',
    category: '배송',
    description: '배송 불가 지역 목록을 관리합니다.',
    confidence: 0.3,
    affectedFiles: ['src/constants/delivery.ts'],
    relatedTaskIds: [],
    source: 'delivery-policy.md',
  },
];

const mockPolicyDetail = {
  ...mockPolicies[0],
  rules: [
    { id: 'rule-1', condition: '수량 > 50', action: '차단', priority: 'high' as const },
  ],
  changeHistory: [
    { date: '2024-01-01', changeType: 'modify' as const, description: '수량 제한 변경' },
  ],
  relatedPolicies: ['policy-2'],
};

describe('policyStore', () => {
  beforeEach(() => {
    // 스토어 초기화
    usePolicyStore.setState({
      policies: [],
      selectedPolicy: null,
      categories: [],
      searchQuery: '',
      selectedCategory: null,
      selectedSource: null,
      selectedRequirement: null,
      loading: false,
      loadingDetail: false,
      loadingMore: false,
      error: null,
      totalCount: 0,
      hasMore: false,
      currentOffset: 0,
    });
    vi.mocked(fetch).mockReset();
  });

  it('should have correct initial state', () => {
    const state = usePolicyStore.getState();
    expect(state.policies).toEqual([]);
    expect(state.selectedPolicy).toBeNull();
    expect(state.categories).toEqual([]);
    expect(state.searchQuery).toBe('');
    expect(state.selectedCategory).toBeNull();
    expect(state.selectedRequirement).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.loadingDetail).toBe(false);
    expect(state.error).toBeNull();
  });

  it('should fetch policies and extract categories', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        policies: mockPolicies,
        categories: ['결제', '배송', '장바구니'],
        total: mockPolicies.length,
        hasMore: false,
      }),
    } as Response);

    await usePolicyStore.getState().fetchPolicies('project-1');

    const state = usePolicyStore.getState();
    expect(state.policies).toEqual(mockPolicies);
    expect(state.categories).toEqual(['결제', '배송', '장바구니']);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('should handle fetch policies error', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

    await usePolicyStore.getState().fetchPolicies('project-1');

    const state = usePolicyStore.getState();
    expect(state.policies).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBe('Network error');
  });

  it('should handle empty policies response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ policies: [] }),
    } as Response);

    await usePolicyStore.getState().fetchPolicies('project-1');

    const state = usePolicyStore.getState();
    expect(state.policies).toEqual([]);
    expect(state.categories).toEqual([]);
  });

  it('should fetch policy detail', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ policy: mockPolicyDetail }),
    } as Response);

    await usePolicyStore.getState().fetchPolicyDetail('project-1', 'policy-1');

    const state = usePolicyStore.getState();
    expect(state.selectedPolicy).toEqual({
      ...mockPolicyDetail,
      annotation: null,
    });
    expect(state.loadingDetail).toBe(false);
  });

  it('should handle fetch policy detail error', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ error: '정책을 찾을 수 없습니다.' }),
    } as Response);

    await usePolicyStore.getState().fetchPolicyDetail('project-1', 'nonexistent');

    const state = usePolicyStore.getState();
    expect(state.selectedPolicy).toBeNull();
    expect(state.error).toBe('정책을 찾을 수 없습니다.');
  });

  it('should set search query', () => {
    usePolicyStore.getState().setSearchQuery('장바구니');

    expect(usePolicyStore.getState().searchQuery).toBe('장바구니');
  });

  it('should set selected category', () => {
    usePolicyStore.getState().setSelectedCategory('결제');

    expect(usePolicyStore.getState().selectedCategory).toBe('결제');
  });

  it('should clear selected category', () => {
    usePolicyStore.getState().setSelectedCategory('결제');
    usePolicyStore.getState().setSelectedCategory(null);

    expect(usePolicyStore.getState().selectedCategory).toBeNull();
  });

  it('should set selected requirement', () => {
    usePolicyStore.getState().setSelectedRequirement('REQ-001');

    expect(usePolicyStore.getState().selectedRequirement).toBe('REQ-001');
  });

  it('should clear selected requirement', () => {
    usePolicyStore.getState().setSelectedRequirement('REQ-001');
    usePolicyStore.getState().setSelectedRequirement(null);

    expect(usePolicyStore.getState().selectedRequirement).toBeNull();
  });

  it('should clear selection', () => {
    usePolicyStore.setState({ selectedPolicy: mockPolicyDetail });

    usePolicyStore.getState().clearSelection();

    expect(usePolicyStore.getState().selectedPolicy).toBeNull();
  });
});
