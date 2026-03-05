/**
 * @module web/pages/__tests__/FlowChartAllMode.test
 * @description TASK-147: FlowChart "전체" 모드 테스트
 *
 * 테스트 항목:
 * 1. ProjectSelector(변형 B) 렌더링 확인 ("전체" 옵션 존재)
 * 2. "전체" 선택 시 currentResult 없으면 알럿 배너 표시
 * 3. 알럿 배너 닫기 버튼 동작
 * 4. "전체" 선택 시 currentResult 있으면 CrossProjectDiagram 표시
 * 5. 개별 프로젝트 선택 시 기존 플로우차트 표시
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import FlowChart from '../FlowChart';
import { useResultStore } from '../../stores/resultStore';
import { useProjectStore } from '../../stores/projectStore';
import { useFlowStore } from '../../stores/flowStore';
import { getMockResult } from '../../utils/mockData';
import type { ProjectInfo } from '../../types';

// fetch 모킹
vi.stubGlobal('fetch', vi.fn());

// useEnsureResult를 no-op으로 모킹
vi.mock('../../hooks/useEnsureResult', () => ({
  useEnsureResult: vi.fn(),
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

/** BrowserRouter 헬퍼 */
function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

/* ================================================================ */
/*  공통 setup                                                       */
/* ================================================================ */

function setupWithResult() {
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
  useFlowStore.setState({
    filter: {
      taskTypeFilter: 'all',
      gradeFilter: ['Low', 'Medium', 'High', 'Critical'],
      searchQuery: '',
      workTypeFilter: 'all',
      requirementFilter: null,
    },
    expandedNodeIds: new Set(),
    selectedNodeId: null,
    projectMode: 'individual',
    crossProjectSpecApis: [],
    crossProjectFilterEnabled: true,
  });
}

function setupWithoutResult() {
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
  useFlowStore.setState({
    filter: {
      taskTypeFilter: 'all',
      gradeFilter: ['Low', 'Medium', 'High', 'Critical'],
      searchQuery: '',
      workTypeFilter: 'all',
      requirementFilter: null,
    },
    expandedNodeIds: new Set(),
    selectedNodeId: null,
    projectMode: 'individual',
    crossProjectSpecApis: [],
    crossProjectFilterEnabled: true,
  });
}

function setupAllModeWithResult() {
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
  useFlowStore.setState({
    filter: {
      taskTypeFilter: 'all',
      gradeFilter: ['Low', 'Medium', 'High', 'Critical'],
      searchQuery: '',
      workTypeFilter: 'all',
      requirementFilter: null,
    },
    expandedNodeIds: new Set(),
    selectedNodeId: null,
    projectMode: 'all',
    crossProjectSpecApis: [],
    crossProjectFilterEnabled: true,
  });
}

/* ================================================================ */
/*  Tests                                                             */
/* ================================================================ */

describe('FlowChart - ProjectSelector (Variant B)', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset();
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ links: [], groups: [] }),
    } as Response);
  });

  it('should render ProjectSelector with "전체" option', () => {
    setupWithResult();
    renderWithRouter(<FlowChart />);

    const selector = screen.getByTestId('project-selector-common');
    expect(selector).toBeInTheDocument();

    // "전체" 옵션이 존재해야 함
    const allOption = selector.querySelector('option[value="__all__"]');
    expect(allOption).toBeTruthy();
    expect(allOption?.textContent).toBe('전체');
  });
});

describe('FlowChart - Alert Banner (currentResult 없을 때)', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset();
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ links: [], groups: [] }),
    } as Response);
  });

  it('should show alert banner when "전체" selected without currentResult', () => {
    setupWithoutResult();
    renderWithRouter(<FlowChart />);

    const selector = screen.getByTestId('project-selector-common');

    // "전체" 선택
    fireEvent.change(selector, { target: { value: '__all__' } });

    // 알럿 배너 표시
    expect(screen.getByTestId('flowchart-alert-banner')).toBeInTheDocument();
    expect(
      screen.getByText('전체 프로젝트 영향도를 보려면 먼저 좌측 목록에서 기획서를 선택해주세요.'),
    ).toBeInTheDocument();
  });

  it('should close alert banner when close button is clicked', () => {
    setupWithoutResult();
    renderWithRouter(<FlowChart />);

    const selector = screen.getByTestId('project-selector-common');

    // "전체" 선택 -> 알럿 표시
    fireEvent.change(selector, { target: { value: '__all__' } });
    expect(screen.getByTestId('flowchart-alert-banner')).toBeInTheDocument();

    // 닫기 버튼 클릭
    const closeBtn = screen.getByTestId('flowchart-alert-close');
    fireEvent.click(closeBtn);

    // 알럿 사라짐
    expect(screen.queryByTestId('flowchart-alert-banner')).not.toBeInTheDocument();
  });
});

describe('FlowChart - "전체" 모드 (CrossProjectDiagram)', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset();
    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/api/shared-entities')) {
        return { json: async () => ({ tables: [], events: [], stats: null }) } as Response;
      }
      return { json: async () => ({ links: [], groups: [] }) } as Response;
    });
  });

  it('should render CrossProjectDiagram when projectMode is "all" and currentResult exists', async () => {
    setupAllModeWithResult();
    renderWithRouter(<FlowChart />);

    // "전체 모드" 컨테이너 렌더링 확인
    expect(screen.getByTestId('flowchart-all-mode')).toBeInTheDocument();

    // CrossProjectDiagram 렌더링 (빈 링크이므로 empty 상태)
    await waitFor(() => {
      expect(screen.getByTestId('cross-project-diagram-empty')).toBeInTheDocument();
    });

    // 제목에 specTitle 표시
    expect(screen.getByText(/전체 프로젝트 영향도/)).toBeInTheDocument();
  });

  it('should render CrossProjectSummary in "all" mode when summary tab is clicked', async () => {
    setupAllModeWithResult();
    renderWithRouter(<FlowChart />);

    // CrossProjectTabs가 렌더링되면 기본 탭은 "의존성"
    await waitFor(() => {
      expect(screen.getByTestId('cross-project-tabs')).toBeInTheDocument();
    });

    // "요약" 탭 클릭
    const summaryTab = screen.getByTestId('tab-summary');
    fireEvent.click(summaryTab);

    await waitFor(() => {
      expect(screen.getByTestId('cross-project-summary-empty')).toBeInTheDocument();
    });
  });
});

describe('FlowChart - 개별 프로젝트 모드 (individual)', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset();
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ links: [], groups: [] }),
    } as Response);
  });

  it('should render individual flowchart when projectMode is "individual"', () => {
    setupWithResult();
    renderWithRouter(<FlowChart />);

    // 개별 모드 컨테이너 확인
    expect(screen.getByTestId('flowchart-individual-mode')).toBeInTheDocument();

    // "전체 모드"는 아님
    expect(screen.queryByTestId('flowchart-all-mode')).not.toBeInTheDocument();
  });

  it('should show individual mode when currentResult exists and projectMode is individual', () => {
    setupWithResult();
    renderWithRouter(<FlowChart />);

    // FilterBar 요소가 존재 (개별 모드)
    expect(screen.getByLabelText('전체 작업 보기')).toBeInTheDocument();
    expect(screen.getByText('FE')).toBeInTheDocument();
    expect(screen.getByText('BE')).toBeInTheDocument();
  });
});
