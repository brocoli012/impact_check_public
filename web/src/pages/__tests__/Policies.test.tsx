/**
 * @module web/pages/__tests__/Policies.test
 * @description BUG-005 & BUG-006 수정 검증 테스트
 *
 * BUG-005: 정책 카드 클릭 시 상세 패널 미표시 (loading으로 인한 언마운트)
 * BUG-006: 정책 총 수가 항상 50건으로만 표시 (totalCount 미사용)
 */

import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import Policies from '../Policies';
import { usePolicyStore } from '../../stores/policyStore';
import { useResultStore } from '../../stores/resultStore';
import { useProjectStore } from '../../stores/projectStore';
import type { Policy } from '../../types';

// fetch 모킹
vi.stubGlobal('fetch', vi.fn());

// useLatestResult를 no-op으로 모킹
vi.mock('../../hooks/useAnalysisResult', () => ({
  useLatestResult: vi.fn(),
}));

/** BrowserRouter로 감싸서 렌더링하는 헬퍼 */
function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

const mockPolicies: Policy[] = Array.from({ length: 5 }, (_, i) => ({
  id: `pol-${i + 1}`,
  name: `Policy ${i + 1}`,
  category: 'test-category',
  description: `Description for policy ${i + 1}`,
  confidence: 0.8,
  affectedFiles: [`file${i + 1}.ts`],
  relatedTaskIds: [`t-${i + 1}`],
  source: 'comment' as const,
}));

function setupStores(options?: {
  policies?: Policy[];
  totalCount?: number;
  loading?: boolean;
  initialLoaded?: boolean;
}) {
  const {
    policies = mockPolicies,
    totalCount = 200,
    loading = false,
    initialLoaded = true,
  } = options || {};

  useProjectStore.setState({
    projects: [
      {
        id: 'proj-1',
        name: 'Test Project',
        path: '/path/to/project',
        status: 'active',
        createdAt: '2026-01-01T00:00:00Z',
        lastUsedAt: '2026-02-20T00:00:00Z',
        techStack: ['React'],
        resultCount: 1,
        latestGrade: 'Medium',
        latestScore: 55,
        latestAnalyzedAt: '2026-02-20T00:00:00Z',
        taskCount: 5,
        policyWarningCount: 1,
      },
    ],
    activeProjectId: 'proj-1',
    isLoading: false,
    error: null,
  });

  useResultStore.setState({
    currentResult: null,
    resultList: [],
    isLoading: false,
    error: null,
  });

  usePolicyStore.setState({
    policies,
    selectedPolicy: null,
    categories: ['test-category'],
    searchQuery: '',
    selectedCategory: null,
    selectedSource: null,
    selectedRequirement: null,
    loading,
    initialLoaded,
    loadingDetail: false,
    loadingMore: false,
    hasMore: false,
    error: null,
    totalCount,
    currentOffset: policies.length,
  });

  // fetch mock - fetchPolicies가 마운트 시 호출됨
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        policies: policies.map((p) => ({ ...p })),
        categories: ['test-category'],
        total: totalCount,
        hasMore: false,
      }),
  } as Response);
}

describe('Policies - BUG-005: Detail panel unmount on refetch', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset();
  });

  it('should render main content area when policies exist even during loading', async () => {
    // Scenario: 데이터가 로드된 상태에서 재조회 시 loading: true가 되더라도
    // 메인 콘텐츠(카드 + 상세 패널)가 유지되어야 함
    setupStores({
      policies: mockPolicies,
      loading: true, // 재조회 중
      initialLoaded: true,
    });

    renderWithRouter(<Policies />);

    await waitFor(() => {
      // 정책 카드가 여전히 보여야 함
      expect(screen.getByText('Policy 1')).toBeInTheDocument();
    });

    // 로딩 스피너는 표시되면 안 됨 (이미 데이터가 있으므로)
    expect(screen.queryByText('정책 목록을 불러오는 중...')).not.toBeInTheDocument();
  });

  it('should show loading spinner only during initial load (no policies)', async () => {
    setupStores({
      policies: [],
      totalCount: 0,
      loading: true,
      initialLoaded: false,
    });

    renderWithRouter(<Policies />);

    await waitFor(() => {
      expect(screen.getByText('정책 목록을 불러오는 중...')).toBeInTheDocument();
    });
  });

  it('should NOT show loading spinner when refetching with existing data', async () => {
    setupStores({
      policies: mockPolicies,
      loading: true, // 재조회 중이지만 데이터 있음
      initialLoaded: true,
    });

    renderWithRouter(<Policies />);

    await waitFor(() => {
      expect(screen.getByText('Policy 1')).toBeInTheDocument();
    });

    // 초기 로딩 스피너는 표시되면 안 됨
    expect(screen.queryByText('정책 목록을 불러오는 중...')).not.toBeInTheDocument();
  });
});

describe('Policies - BUG-006: Total count showing only loaded count', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset();
  });

  it('should display server totalCount (200) instead of loaded policies count (5)', async () => {
    setupStores({
      policies: mockPolicies, // 5건
      totalCount: 200, // 서버 전체 200건
    });

    renderWithRouter(<Policies />);

    await waitFor(() => {
      const resultCountEl = screen.getByTestId('result-count');
      expect(resultCountEl).toBeInTheDocument();
      // "5 / 200건" 형태로 표시되어야 함
      expect(resultCountEl.textContent).toContain('200');
    });
  });

  it('should NOT show loaded count (policies.length) as totalCount', async () => {
    setupStores({
      policies: mockPolicies, // 5건
      totalCount: 300, // 서버 전체 300건
    });

    renderWithRouter(<Policies />);

    await waitFor(() => {
      const resultCountEl = screen.getByTestId('result-count');
      // "5 / 5건" 이 아니라 "5 / 300건"이어야 함
      expect(resultCountEl.textContent).not.toBe('5 / 5건');
      expect(resultCountEl.textContent).toContain('300');
    });
  });
});
