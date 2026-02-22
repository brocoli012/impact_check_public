/**
 * @module web/pages/__tests__/PageProjectSelector.test
 * @description TASK-131: 각 페이지에 ProjectSelector + EmptyResultGuide 통합 테스트
 *
 * 테스트 대상:
 * - Checklist: ProjectSelector 렌더링 + EmptyResultGuide 표시 확인
 * - Owners: ProjectSelector 렌더링 + EmptyResultGuide 표시 확인
 * - Tickets: ProjectSelector 렌더링 + EmptyResultGuide 표시 확인
 * - Policies: ProjectSelector 렌더링 확인
 */

import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import Checklist from '../Checklist';
import Owners from '../Owners';
import Tickets from '../Tickets';
import Policies from '../Policies';

import { useResultStore } from '../../stores/resultStore';
import { useProjectStore } from '../../stores/projectStore';
import { usePolicyStore } from '../../stores/policyStore';
import { getMockResult } from '../../utils/mockData';
import type { ProjectInfo } from '../../types';

// fetch 모킹
vi.stubGlobal('fetch', vi.fn());

// useEnsureResult를 no-op으로 모킹 (빈 상태 테스트를 위해 mock 데이터 자동 로드 방지)
vi.mock('../../hooks/useEnsureResult', () => ({
  useEnsureResult: vi.fn(),
}));

// useLatestResult도 no-op으로 모킹 (Policies에서 사용)
vi.mock('../../hooks/useAnalysisResult', () => ({
  useLatestResult: vi.fn(),
}));

const mockProjects: ProjectInfo[] = [
  {
    id: 'proj-1',
    name: 'Project Alpha',
    path: '/path/alpha',
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    lastUsedAt: '2026-02-20T00:00:00Z',
    techStack: ['React'],
    resultCount: 5,
    latestGrade: 'High',
    latestScore: 85,
    latestAnalyzedAt: '2026-02-20T00:00:00Z',
    taskCount: 10,
    policyWarningCount: 2,
  },
  {
    id: 'proj-2',
    name: 'Project Beta',
    path: '/path/beta',
    status: 'active',
    createdAt: '2026-01-15T00:00:00Z',
    lastUsedAt: '2026-02-18T00:00:00Z',
    techStack: ['Vue'],
    resultCount: 3,
    latestGrade: 'Medium',
    latestScore: 60,
    latestAnalyzedAt: '2026-02-18T00:00:00Z',
    taskCount: 7,
    policyWarningCount: 1,
  },
];

/** BrowserRouter로 감싸서 렌더링하는 헬퍼 */
function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

/* ================================================================ */
/*  공통 setup                                                       */
/* ================================================================ */

function setupStoresWithResult() {
  useProjectStore.setState({
    projects: mockProjects,
    activeProjectId: 'proj-1',
    isLoading: false,
    error: null,
  });
  useResultStore.setState({
    currentResult: getMockResult(),
    resultList: [],
    isLoading: false,
    error: null,
  });
}

function setupStoresWithoutResult() {
  useProjectStore.setState({
    projects: mockProjects,
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
}

/* ================================================================ */
/*  Checklist                                                        */
/* ================================================================ */

describe('Checklist - ProjectSelector + EmptyResultGuide', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset();
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ checklist: { resultId: 'demo-analysis-001', items: [] } }),
    } as Response);
  });

  it('should render ProjectSelector when currentResult exists', async () => {
    setupStoresWithResult();
    renderWithRouter(<Checklist />);

    await waitFor(() => {
      expect(screen.getByTestId('project-selector-common')).toBeInTheDocument();
    });
  });

  it('should render ProjectSelector when currentResult is null', () => {
    setupStoresWithoutResult();
    renderWithRouter(<Checklist />);

    expect(screen.getByTestId('project-selector-common')).toBeInTheDocument();
  });

  it('should render EmptyResultGuide when currentResult is null', () => {
    setupStoresWithoutResult();
    renderWithRouter(<Checklist />);

    expect(screen.getByTestId('empty-result-guide')).toBeInTheDocument();
    expect(
      screen.getByText('기획서를 선택하면 체크리스트를 확인할 수 있습니다.'),
    ).toBeInTheDocument();
  });

  it('should render checklist icon in EmptyResultGuide', () => {
    setupStoresWithoutResult();
    renderWithRouter(<Checklist />);

    expect(screen.getByTestId('icon-checklist')).toBeInTheDocument();
  });

  it('should NOT render EmptyResultGuide when currentResult exists', async () => {
    setupStoresWithResult();
    renderWithRouter(<Checklist />);

    await waitFor(() => {
      expect(screen.getByText('기획 확인 체크리스트')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('empty-result-guide')).not.toBeInTheDocument();
  });
});

/* ================================================================ */
/*  Owners                                                           */
/* ================================================================ */

describe('Owners - ProjectSelector + EmptyResultGuide', () => {
  it('should render ProjectSelector when currentResult exists', () => {
    setupStoresWithResult();
    renderWithRouter(<Owners />);

    expect(screen.getByTestId('project-selector-common')).toBeInTheDocument();
  });

  it('should render ProjectSelector when currentResult is null', () => {
    setupStoresWithoutResult();
    renderWithRouter(<Owners />);

    expect(screen.getByTestId('project-selector-common')).toBeInTheDocument();
  });

  it('should render EmptyResultGuide when currentResult is null', () => {
    setupStoresWithoutResult();
    renderWithRouter(<Owners />);

    expect(screen.getByTestId('empty-result-guide')).toBeInTheDocument();
    expect(
      screen.getByText('기획서를 선택하면 확인 요청 대상 담당자를 확인할 수 있습니다.'),
    ).toBeInTheDocument();
  });

  it('should NOT render EmptyResultGuide when currentResult exists', () => {
    setupStoresWithResult();
    renderWithRouter(<Owners />);

    expect(screen.getByText('확인 요청 안내')).toBeInTheDocument();
    expect(screen.queryByTestId('empty-result-guide')).not.toBeInTheDocument();
  });
});

/* ================================================================ */
/*  Tickets                                                          */
/* ================================================================ */

describe('Tickets - ProjectSelector + EmptyResultGuide', () => {
  it('should render ProjectSelector when currentResult exists', () => {
    setupStoresWithResult();
    renderWithRouter(<Tickets />);

    expect(screen.getByTestId('project-selector-common')).toBeInTheDocument();
  });

  it('should render ProjectSelector when currentResult is null', () => {
    setupStoresWithoutResult();
    renderWithRouter(<Tickets />);

    expect(screen.getByTestId('project-selector-common')).toBeInTheDocument();
  });

  it('should render EmptyResultGuide when currentResult is null', () => {
    setupStoresWithoutResult();
    renderWithRouter(<Tickets />);

    expect(screen.getByTestId('empty-result-guide')).toBeInTheDocument();
    expect(
      screen.getByText('기획서를 선택하면 작업 티켓 목록을 확인할 수 있습니다.'),
    ).toBeInTheDocument();
  });

  it('should NOT render EmptyResultGuide when currentResult exists', () => {
    setupStoresWithResult();
    renderWithRouter(<Tickets />);

    expect(screen.getByText('작업 티켓 목록')).toBeInTheDocument();
    expect(screen.queryByTestId('empty-result-guide')).not.toBeInTheDocument();
  });
});

/* ================================================================ */
/*  Policies                                                         */
/* ================================================================ */

describe('Policies - ProjectSelector', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset();
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ policies: [], total: 0, hasMore: false }),
    } as Response);

    usePolicyStore.setState({
      policies: [],
      selectedPolicy: null,
      searchQuery: '',
      selectedCategory: null,
      selectedSource: null,
      selectedRequirement: null,
      loading: false,
      initialLoaded: false,
      loadingDetail: false,
      loadingMore: false,
      hasMore: false,
      error: null,
    });
  });

  it('should render ProjectSelector when currentResult exists', async () => {
    setupStoresWithResult();
    renderWithRouter(<Policies />);

    await waitFor(() => {
      expect(screen.getByTestId('project-selector-common')).toBeInTheDocument();
    });
  });

  it('should render ProjectSelector when currentResult is null', async () => {
    setupStoresWithoutResult();
    renderWithRouter(<Policies />);

    await waitFor(() => {
      expect(screen.getByTestId('project-selector-common')).toBeInTheDocument();
    });
  });

  it('should NOT render EmptyResultGuide (Policies works without spec)', async () => {
    setupStoresWithoutResult();
    renderWithRouter(<Policies />);

    await waitFor(() => {
      expect(screen.getByText('정책 목록')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('empty-result-guide')).not.toBeInTheDocument();
  });
});
