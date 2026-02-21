/**
 * @module web/__tests__/policies/PolicyFilter.test
 * @description PolicyFilter 컴포넌트 렌더링 테스트
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import PolicyFilter from '../../components/policies/PolicyFilter';
import { usePolicyStore } from '../../stores/policyStore';
import type { WebRequirement, Task } from '../../types';

const mockRequirements: WebRequirement[] = [
  {
    id: 'REQ-001',
    name: '장바구니 UI 개편',
    description: '장바구니 화면의 레이아웃 및 UX를 전면 개편합니다.',
    priority: 'high',
    relatedFeatures: ['FEAT-001', 'FEAT-002'],
  },
  {
    id: 'REQ-002',
    name: '결제 연동 수정',
    description: '장바구니 데이터 구조 변경에 따른 결제 화면 수정',
    priority: 'medium',
    relatedFeatures: ['FEAT-003'],
  },
];

const mockTasks: Task[] = [
  {
    id: 'task-1',
    title: '장바구니 UI 전면 개편',
    type: 'FE',
    actionType: 'modify',
    description: '장바구니 화면의 레이아웃 및 UX를 전면 개편합니다.',
    affectedFiles: [],
    relatedApis: [],
    planningChecks: [],
    rationale: '',
    sourceRequirementIds: ['REQ-001'],
  },
  {
    id: 'task-3',
    title: '결제 화면 장바구니 연동 수정',
    type: 'FE',
    actionType: 'modify',
    description: '결제 화면 수정',
    affectedFiles: [],
    relatedApis: [],
    planningChecks: [],
    rationale: '',
    sourceRequirementIds: ['REQ-002'],
  },
];

describe('PolicyFilter', () => {
  beforeEach(() => {
    usePolicyStore.setState({
      policies: [],
      selectedPolicy: null,
      categories: ['장바구니', '결제', '배송'],
      searchQuery: '',
      selectedCategory: null,
      selectedSource: null,
      selectedRequirement: null,
      loading: false,
      loadingMore: false,
      error: null,
      totalCount: 0,
      hasMore: false,
      currentOffset: 0,
    });
  });

  it('should render search input', () => {
    render(<PolicyFilter resultCount={5} totalCount={10} />);

    const input = screen.getByPlaceholderText('정책명, 설명 검색...');
    expect(input).toBeInTheDocument();
  });

  it('should render category label', () => {
    render(<PolicyFilter resultCount={5} totalCount={10} />);

    expect(screen.getByText('카테고리:')).toBeInTheDocument();
  });

  it('should render all category buttons', () => {
    render(<PolicyFilter resultCount={5} totalCount={10} />);

    // '전체' appears multiple times (source filter + category filter)
    const allButtons = screen.getAllByText('전체');
    expect(allButtons.length).toBeGreaterThanOrEqual(2); // source "전체" + category "전체"
    expect(screen.getByText('장바구니')).toBeInTheDocument();
    expect(screen.getByText('결제')).toBeInTheDocument();
    expect(screen.getByText('배송')).toBeInTheDocument();
  });

  it('should render result count', () => {
    render(<PolicyFilter resultCount={3} totalCount={10} />);

    expect(screen.getByText('3 / 10건')).toBeInTheDocument();
  });

  it('should update search input on type', () => {
    render(<PolicyFilter resultCount={5} totalCount={10} />);

    const input = screen.getByPlaceholderText('정책명, 설명 검색...');
    fireEvent.change(input, { target: { value: '장바구니' } });

    expect(input).toHaveValue('장바구니');
  });

  it('should click category filter button', () => {
    render(<PolicyFilter resultCount={5} totalCount={10} />);

    const categoryButton = screen.getByText('결제');
    fireEvent.click(categoryButton);

    const state = usePolicyStore.getState();
    expect(state.selectedCategory).toBe('결제');
  });

  it('should click all button to clear category filter', () => {
    usePolicyStore.setState({ selectedCategory: '결제' });

    render(<PolicyFilter resultCount={5} totalCount={10} />);

    // There are multiple '전체' buttons (source + category). Click the category one.
    const allButtons = screen.getAllByText('전체');
    // Category '전체' is the second one (after source '전체')
    fireEvent.click(allButtons[1]);

    const state = usePolicyStore.getState();
    expect(state.selectedCategory).toBeNull();
  });

  it('should highlight active category button', () => {
    usePolicyStore.setState({ selectedCategory: '배송' });

    render(<PolicyFilter resultCount={5} totalCount={10} />);

    const deliveryButton = screen.getByText('배송');
    expect(deliveryButton.className).toContain('bg-purple-100');
    expect(deliveryButton.className).toContain('text-purple-700');
  });

  it('should clear search on Escape key', () => {
    render(<PolicyFilter resultCount={5} totalCount={10} />);

    const input = screen.getByPlaceholderText('정책명, 설명 검색...');
    fireEvent.change(input, { target: { value: '테스트' } });
    expect(input).toHaveValue('테스트');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('');
  });

  it('should show clear button when search has value', () => {
    render(<PolicyFilter resultCount={5} totalCount={10} />);

    const input = screen.getByPlaceholderText('정책명, 설명 검색...');
    fireEvent.change(input, { target: { value: '테스트' } });

    const clearButton = screen.getByLabelText('검색 초기화');
    expect(clearButton).toBeInTheDocument();
  });

  it('should clear search when clear button is clicked', () => {
    render(<PolicyFilter resultCount={5} totalCount={10} />);

    const input = screen.getByPlaceholderText('정책명, 설명 검색...');
    fireEvent.change(input, { target: { value: '테스트' } });

    const clearButton = screen.getByLabelText('검색 초기화');
    fireEvent.click(clearButton);

    expect(input).toHaveValue('');
  });

  // ── Requirement dropdown tests ──

  it('should render requirement dropdown when requirements are provided', () => {
    render(
      <PolicyFilter
        resultCount={5}
        totalCount={10}
        requirements={mockRequirements}
        tasks={mockTasks}
      />,
    );

    expect(screen.getByText('요구사항:')).toBeInTheDocument();
    expect(screen.getByLabelText('요구사항 필터')).toBeInTheDocument();
  });

  it('should not render requirement dropdown when no requirements', () => {
    render(<PolicyFilter resultCount={5} totalCount={10} />);

    expect(screen.queryByText('요구사항:')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('요구사항 필터')).not.toBeInTheDocument();
  });

  it('should not render requirement dropdown when requirements array is empty', () => {
    render(
      <PolicyFilter
        resultCount={5}
        totalCount={10}
        requirements={[]}
        tasks={mockTasks}
      />,
    );

    expect(screen.queryByText('요구사항:')).not.toBeInTheDocument();
  });

  it('should list all requirements as options', () => {
    render(
      <PolicyFilter
        resultCount={5}
        totalCount={10}
        requirements={mockRequirements}
        tasks={mockTasks}
      />,
    );

    const select = screen.getByLabelText('요구사항 필터');
    expect(select).toBeInTheDocument();

    // Default option
    expect(screen.getByText('전체 요구사항')).toBeInTheDocument();
    // Requirement options
    expect(screen.getByText('REQ-001: 장바구니 UI 개편')).toBeInTheDocument();
    expect(screen.getByText('REQ-002: 결제 연동 수정')).toBeInTheDocument();
  });

  it('should update store when requirement is selected', () => {
    render(
      <PolicyFilter
        resultCount={5}
        totalCount={10}
        requirements={mockRequirements}
        tasks={mockTasks}
      />,
    );

    const select = screen.getByLabelText('요구사항 필터');
    fireEvent.change(select, { target: { value: 'REQ-001' } });

    const state = usePolicyStore.getState();
    expect(state.selectedRequirement).toBe('REQ-001');
  });

  it('should reset store when requirement selection is cleared', () => {
    usePolicyStore.setState({ selectedRequirement: 'REQ-001' });

    render(
      <PolicyFilter
        resultCount={5}
        totalCount={10}
        requirements={mockRequirements}
        tasks={mockTasks}
      />,
    );

    const select = screen.getByLabelText('요구사항 필터');
    fireEvent.change(select, { target: { value: '' } });

    const state = usePolicyStore.getState();
    expect(state.selectedRequirement).toBeNull();
  });

  it('should reflect current selectedRequirement in dropdown value', () => {
    usePolicyStore.setState({ selectedRequirement: 'REQ-002' });

    render(
      <PolicyFilter
        resultCount={5}
        totalCount={10}
        requirements={mockRequirements}
        tasks={mockTasks}
      />,
    );

    const select = screen.getByLabelText('요구사항 필터') as HTMLSelectElement;
    expect(select.value).toBe('REQ-002');
  });
});
