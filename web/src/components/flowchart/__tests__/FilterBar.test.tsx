/**
 * @module web/components/flowchart/__tests__/FilterBar.test
 * @description FilterBar 컴포넌트 테스트 - 요구사항 드롭다운 포함
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import FilterBar from '../FilterBar';
import { useFlowStore } from '../../../stores/flowStore';
import type { WebRequirement } from '../../../types';

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
  {
    id: 'REQ-003',
    name: '주문 이력 확장',
    description: '주문 이력 API에 장바구니 관련 메타데이터 추가',
    priority: 'low',
    relatedFeatures: ['FEAT-004'],
  },
];

describe('FilterBar', () => {
  beforeEach(() => {
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
    });
  });

  it('should render basic filter controls', () => {
    render(<FilterBar expandableNodeIds={['a', 'b']} />);

    // FE/BE 토글
    expect(screen.getByText('전체')).toBeInTheDocument();
    expect(screen.getByText('FE')).toBeInTheDocument();
    expect(screen.getByText('BE')).toBeInTheDocument();

    // 등급 칩
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();

    // 검색 입력
    expect(screen.getByPlaceholderText('노드 이름/파일 경로 검색...')).toBeInTheDocument();

    // 확장/축소 버튼
    expect(screen.getByText('모두 펼치기')).toBeInTheDocument();
    expect(screen.getByText('모두 접기')).toBeInTheDocument();
  });

  it('should not render requirement dropdown when no requirements provided', () => {
    render(<FilterBar expandableNodeIds={[]} />);

    expect(screen.queryByLabelText('요구사항 필터')).not.toBeInTheDocument();
  });

  it('should not render requirement dropdown when requirements is empty array', () => {
    render(<FilterBar expandableNodeIds={[]} requirements={[]} />);

    expect(screen.queryByLabelText('요구사항 필터')).not.toBeInTheDocument();
  });

  it('should render requirement dropdown when requirements are provided', () => {
    render(<FilterBar expandableNodeIds={[]} requirements={mockRequirements} />);

    const dropdown = screen.getByLabelText('요구사항 필터');
    expect(dropdown).toBeInTheDocument();
  });

  it('should show all requirement options in dropdown', () => {
    render(<FilterBar expandableNodeIds={[]} requirements={mockRequirements} />);

    const dropdown = screen.getByLabelText('요구사항 필터') as HTMLSelectElement;

    // "전체 요구사항" + 3 requirements = 4 options
    const options = dropdown.querySelectorAll('option');
    expect(options.length).toBe(4);

    expect(options[0].textContent).toBe('전체 요구사항');
    expect(options[1].textContent).toBe('REQ-001: 장바구니 UI 개편');
    expect(options[2].textContent).toBe('REQ-002: 결제 연동 수정');
    expect(options[3].textContent).toBe('REQ-003: 주문 이력 확장');
  });

  it('should update store when a requirement is selected', async () => {
    const user = userEvent.setup();
    render(<FilterBar expandableNodeIds={[]} requirements={mockRequirements} />);

    const dropdown = screen.getByLabelText('요구사항 필터');
    await user.selectOptions(dropdown, 'REQ-001');

    expect(useFlowStore.getState().filter.requirementFilter).toBe('REQ-001');
  });

  it('should clear requirement filter when "전체 요구사항" is selected', async () => {
    const user = userEvent.setup();

    // 먼저 필터 설정
    useFlowStore.getState().setRequirementFilter('REQ-001');

    render(<FilterBar expandableNodeIds={[]} requirements={mockRequirements} />);

    const dropdown = screen.getByLabelText('요구사항 필터');
    await user.selectOptions(dropdown, '');

    expect(useFlowStore.getState().filter.requirementFilter).toBeNull();
  });

  it('should reflect current store state in dropdown', () => {
    useFlowStore.getState().setRequirementFilter('REQ-002');

    render(<FilterBar expandableNodeIds={[]} requirements={mockRequirements} />);

    const dropdown = screen.getByLabelText('요구사항 필터') as HTMLSelectElement;
    expect(dropdown.value).toBe('REQ-002');
  });

  it('should allow switching between requirements', async () => {
    const user = userEvent.setup();
    render(<FilterBar expandableNodeIds={[]} requirements={mockRequirements} />);

    const dropdown = screen.getByLabelText('요구사항 필터');

    await user.selectOptions(dropdown, 'REQ-001');
    expect(useFlowStore.getState().filter.requirementFilter).toBe('REQ-001');

    await user.selectOptions(dropdown, 'REQ-003');
    expect(useFlowStore.getState().filter.requirementFilter).toBe('REQ-003');
  });
});
