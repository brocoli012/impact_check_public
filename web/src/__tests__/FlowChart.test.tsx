/**
 * @module web/__tests__/FlowChart.test
 * @description FlowChart 페이지 및 flowTransformer 유닛 테스트
 */

import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import FlowChart from '../pages/FlowChart';
import { useResultStore } from '../stores/resultStore';
import { useFlowStore } from '../stores/flowStore';
import { useProjectStore } from '../stores/projectStore';
import { getMockResult } from '../utils/mockData';
import { transformToFlow } from '../utils/flowTransformer';

/** BrowserRouter로 감싸서 렌더링하는 헬퍼 */
function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe('FlowChart Page', () => {
  beforeEach(() => {
    // 프로젝트 스토어 초기화 (ProjectSelector용)
    useProjectStore.setState({
      projects: [
        {
          id: 'proj-1',
          name: 'Test Project',
          path: '/test',
          status: 'active',
          createdAt: '2026-01-01T00:00:00Z',
          lastUsedAt: '2026-02-20T00:00:00Z',
          techStack: ['React'],
          resultCount: 1,
          latestGrade: 'Medium',
          latestScore: 50,
          latestAnalyzedAt: '2026-02-20T00:00:00Z',
          taskCount: 5,
          policyWarningCount: 0,
        },
      ],
      activeProjectId: 'proj-1',
      isLoading: false,
      error: null,
    });
    // 스토어 초기화
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
    });
  });

  it('should render FlowChart without crashing', () => {
    renderWithRouter(<FlowChart />);
    // React Flow 캔버스가 렌더링되었는지 확인
    // FilterBar의 버튼이 존재하는지 확인 (aria-label로 특정)
    expect(screen.getByLabelText('전체 작업 보기')).toBeInTheDocument();
  });

  it('should render filter bar with FE/BE toggle', () => {
    renderWithRouter(<FlowChart />);

    expect(screen.getByLabelText('전체 작업 보기')).toBeInTheDocument();
    expect(screen.getByText('FE')).toBeInTheDocument();
    expect(screen.getByText('BE')).toBeInTheDocument();
  });

  it('should render filter bar with grade chips', () => {
    renderWithRouter(<FlowChart />);

    // 등급 텍스트는 필터 칩과 노드 배지 양쪽에 나타날 수 있으므로 getAllByText 사용
    expect(screen.getAllByText('Low').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Medium').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('High').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Critical').length).toBeGreaterThanOrEqual(1);
  });

  it('should render expand/collapse buttons', () => {
    renderWithRouter(<FlowChart />);

    expect(screen.getByText('모두 펼치기')).toBeInTheDocument();
    expect(screen.getByText('모두 접기')).toBeInTheDocument();
  });

  it('should render search input', () => {
    renderWithRouter(<FlowChart />);

    const searchInput = screen.getByPlaceholderText('노드 이름/파일 경로 검색...');
    expect(searchInput).toBeInTheDocument();
  });

  it('should render requirement filter dropdown when parsedSpec has requirements', () => {
    renderWithRouter(<FlowChart />);

    // Mock data now includes parsedSpec with requirements
    const dropdown = screen.getByLabelText('요구사항 필터');
    expect(dropdown).toBeInTheDocument();
  });
});

describe('flowTransformer', () => {
  const mockResult = getMockResult();
  const defaultFilter = {
    taskTypeFilter: 'all' as const,
    gradeFilter: ['Low' as const, 'Medium' as const, 'High' as const, 'Critical' as const],
    searchQuery: '',
    workTypeFilter: 'all' as const,
    requirementFilter: null,
  };

  it('should transform mock data into nodes and edges', () => {
    const { nodes, edges } = transformToFlow(mockResult, new Set(), defaultFilter);

    // 최소 1개의 노드가 있어야 함 (Requirement 노드)
    expect(nodes.length).toBeGreaterThanOrEqual(1);
    // Requirement 노드 확인
    const reqNode = nodes.find((n) => n.type === 'requirement');
    expect(reqNode).toBeDefined();
    expect(reqNode!.data.label).toBe(mockResult.specTitle);

    // 엣지가 존재해야 함
    expect(edges.length).toBeGreaterThanOrEqual(1);
  });

  it('should create system nodes', () => {
    const { nodes } = transformToFlow(mockResult, new Set(), defaultFilter);

    const systemNodes = nodes.filter((n) => n.type === 'system');
    expect(systemNodes.length).toBeGreaterThanOrEqual(1);
  });

  it('should create screen nodes', () => {
    const { nodes } = transformToFlow(mockResult, new Set(), defaultFilter);

    const screenNodes = nodes.filter((n) => n.type === 'screen');
    expect(screenNodes.length).toBeGreaterThanOrEqual(1);
  });

  it('should create feature nodes when screen is expanded', () => {
    // 화면 하나를 확장
    const expandedIds = new Set(['screen-cart']);
    const { nodes } = transformToFlow(mockResult, expandedIds, defaultFilter);

    const featureNodes = nodes.filter((n) => n.type === 'feature');
    expect(featureNodes.length).toBeGreaterThanOrEqual(1);
  });

  it('should create module nodes when screen is expanded', () => {
    const expandedIds = new Set(['screen-cart']);
    const { nodes } = transformToFlow(mockResult, expandedIds, defaultFilter);

    const moduleNodes = nodes.filter((n) => n.type === 'module');
    expect(moduleNodes.length).toBeGreaterThanOrEqual(1);
  });

  it('should create policy and policyWarning nodes', () => {
    const { nodes } = transformToFlow(mockResult, new Set(), defaultFilter);

    const policyNodes = nodes.filter((n) => n.type === 'policy');
    expect(policyNodes.length).toBe(mockResult.policyChanges.length);

    const pwNodes = nodes.filter((n) => n.type === 'policyWarning');
    expect(pwNodes.length).toBe(mockResult.policyWarnings.length);
  });

  it('should return expandable node IDs', () => {
    const { expandableNodeIds } = transformToFlow(mockResult, new Set(), defaultFilter);

    // 화면 노드 수만큼 확장 가능 ID가 있어야 함
    expect(expandableNodeIds.length).toBeGreaterThanOrEqual(1);
  });

  it('should filter by FE task type', () => {
    const feFilter = { ...defaultFilter, taskTypeFilter: 'FE' as const };
    const expandedIds = new Set(['screen-cart']);
    const { nodes } = transformToFlow(mockResult, expandedIds, feFilter);

    // FE 필터 시 BE 타입 feature 노드는 없어야 함
    const featureNodes = nodes.filter((n) => n.type === 'feature');
    for (const fn of featureNodes) {
      const data = fn.data as Record<string, unknown>;
      expect(data.taskType).toBe('FE');
    }
  });

  it('should filter by grade', () => {
    const gradeFilter = { ...defaultFilter, gradeFilter: ['High' as const, 'Critical' as const] };
    const { nodes } = transformToFlow(mockResult, new Set(), gradeFilter);

    // Low/Medium 등급 시스템/화면이 필터링되었는지 확인
    const screenNodes = nodes.filter((n) => n.type === 'screen');
    for (const sn of screenNodes) {
      const data = sn.data as Record<string, unknown>;
      expect(['High', 'Critical']).toContain(data.grade);
    }
  });

  it('should filter by search query', () => {
    const searchFilter = { ...defaultFilter, searchQuery: '장바구니' };
    const { nodes } = transformToFlow(mockResult, new Set(), searchFilter);

    // 장바구니 관련 화면 노드가 있어야 함
    const screenNodes = nodes.filter((n) => n.type === 'screen');
    expect(screenNodes.length).toBeGreaterThanOrEqual(1);
  });

  it('should create check nodes when screen is expanded and task has planningChecks', () => {
    const expandedIds = new Set(['screen-cart']);
    const { nodes } = transformToFlow(mockResult, expandedIds, defaultFilter);

    const checkNodes = nodes.filter((n) => n.type === 'check');
    // task-1 has 1 planningCheck, so at least 1 check node
    expect(checkNodes.length).toBeGreaterThanOrEqual(1);
  });
});
