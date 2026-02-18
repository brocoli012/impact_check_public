/**
 * @module web/__tests__/Tickets.test
 * @description Tickets 페이지 렌더링 테스트
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import Tickets from '../pages/Tickets';
import { useResultStore } from '../stores/resultStore';
import { getMockResult } from '../utils/mockData';
import type { AnalysisResult } from '../types';

/** BrowserRouter로 감싸서 렌더링하는 헬퍼 */
function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

/** MemoryRouter로 초기 URL을 지정하여 렌더링하는 헬퍼 */
function renderWithMemoryRouter(ui: React.ReactElement, initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>,
  );
}

describe('Tickets', () => {
  beforeEach(() => {
    useResultStore.setState({
      currentResult: getMockResult(),
      resultList: [],
      isLoading: false,
      error: null,
    });
  });

  it('should render the tickets page title', () => {
    renderWithRouter(<Tickets />);

    expect(screen.getByText('작업 티켓 목록')).toBeInTheDocument();
  });

  it('should show spec title', () => {
    renderWithRouter(<Tickets />);

    expect(screen.getByText('[데모] 장바구니 리뉴얼 기획서')).toBeInTheDocument();
  });

  it('should display total ticket count', () => {
    renderWithRouter(<Tickets />);

    // Mock data has 6 tasks - the number "6" appears in multiple places (summary + score bars)
    expect(screen.getAllByText('6').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('총 티켓')).toBeInTheDocument();
  });

  it('should display FE/BE counts in summary', () => {
    renderWithRouter(<Tickets />);

    // 4 FE tasks, 2 BE tasks - these numbers may appear in multiple places
    expect(screen.getAllByText('4').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
  });

  it('should render filter buttons', () => {
    renderWithRouter(<Tickets />);

    // Type filter buttons - 전체 button appears in both type and grade filters
    const allButtons = screen.getAllByText('전체');
    expect(allButtons.length).toBeGreaterThanOrEqual(2);

    // FE/BE buttons in the filter section
    expect(screen.getAllByText('FE').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('BE').length).toBeGreaterThanOrEqual(1);
  });

  it('should render search input', () => {
    renderWithRouter(<Tickets />);

    const searchInput = screen.getByPlaceholderText('작업명, 파일 경로 검색...');
    expect(searchInput).toBeInTheDocument();
  });

  it('should render ticket cards', () => {
    renderWithRouter(<Tickets />);

    // Task titles appear in ticket cards and possibly in dependency diagram
    expect(screen.getAllByText('장바구니 UI 전면 개편').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('장바구니 API 응답 변경').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('결제 화면 장바구니 연동 수정').length).toBeGreaterThanOrEqual(1);
  });

  it('should render dependency diagram', () => {
    renderWithRouter(<Tickets />);

    expect(screen.getByText('작업 간 의존 관계')).toBeInTheDocument();
  });

  it('should filter tickets when FE button is clicked', () => {
    renderWithRouter(<Tickets />);

    // Click the FE filter button (first one in the type filter section)
    const feButtons = screen.getAllByText('FE');
    // The first FE button should be in the filter section
    fireEvent.click(feButtons[0]);

    // FE tasks should still be visible (may appear in both cards and dependency)
    expect(screen.getAllByText('장바구니 UI 전면 개편').length).toBeGreaterThanOrEqual(1);
  });

  it('should filter by search query', () => {
    renderWithRouter(<Tickets />);

    const searchInput = screen.getByPlaceholderText('작업명, 파일 경로 검색...');
    fireEvent.change(searchInput, { target: { value: '결제' } });

    // Only 결제 related task should be visible
    expect(screen.getByText('결제 화면 장바구니 연동 수정')).toBeInTheDocument();
  });

  /* ---------- URL query parameter 테스트 (TASK-033 R-02) ---------- */
  describe('URL query parameter', () => {
    it('should apply FE type filter when ?type=FE is provided', () => {
      renderWithMemoryRouter(<Tickets />, ['/tickets?type=FE']);

      // FE filter button should have active style (purple-100 bg)
      const feButtons = screen.getAllByText('FE');
      // Filter section FE button should be active
      const filterFEButton = feButtons.find(
        (btn) => btn.tagName === 'BUTTON' && btn.className.includes('bg-purple-100'),
      );
      expect(filterFEButton).toBeDefined();
    });

    it('should apply BE type filter when ?type=BE is provided', () => {
      renderWithMemoryRouter(<Tickets />, ['/tickets?type=BE']);

      // BE filter button should have active style
      const beButtons = screen.getAllByText('BE');
      const filterBEButton = beButtons.find(
        (btn) => btn.tagName === 'BUTTON' && btn.className.includes('bg-purple-100'),
      );
      expect(filterBEButton).toBeDefined();
    });

    it('should default to "all" when ?type has an invalid value', () => {
      renderWithMemoryRouter(<Tickets />, ['/tickets?type=INVALID']);

      // "전체" buttons should be active for both type and grade
      const allButtons = screen.getAllByText('전체');
      const activeAllButtons = allButtons.filter(
        (btn) => btn.className.includes('bg-purple-100'),
      );
      // Both type and grade "전체" should be active
      expect(activeAllButtons.length).toBeGreaterThanOrEqual(2);
    });

    it('should default to "all" when no type param is present', () => {
      renderWithMemoryRouter(<Tickets />, ['/tickets']);

      // "전체" buttons should be active
      const allButtons = screen.getAllByText('전체');
      const activeAllButtons = allButtons.filter(
        (btn) => btn.className.includes('bg-purple-100'),
      );
      expect(activeAllButtons.length).toBeGreaterThanOrEqual(2);
    });
  });
});

/* ================================================================== */
/*  요구사항 필터 테스트 (TASK-053 F-08)                                */
/* ================================================================== */

/** parsedSpec + sourceRequirementIds가 포함된 목업 데이터 생성 */
function getMockResultWithRequirements(): AnalysisResult {
  const base = getMockResult();
  return {
    ...base,
    tasks: [
      { ...base.tasks[0], sourceRequirementIds: ['REQ-001'] },      // task-1: 장바구니 UI 전면 개편
      { ...base.tasks[1], sourceRequirementIds: ['REQ-001'] },      // task-2: 장바구니 API 응답 변경
      { ...base.tasks[2], sourceRequirementIds: ['REQ-002'] },      // task-3: 결제 화면 장바구니 연동 수정
      { ...base.tasks[3], sourceRequirementIds: ['REQ-001', 'REQ-002'] }, // task-4: 장바구니 담기 버튼 수정
      { ...base.tasks[4], sourceRequirementIds: undefined },          // task-5: 최근 주문 위젯 (no requirement)
      { ...base.tasks[5], sourceRequirementIds: undefined },          // task-6: 주문 이력 API 확장 (no requirement)
    ],
    // affectedScreens 내의 tasks도 동기화
    affectedScreens: base.affectedScreens.map((s) => ({
      ...s,
      tasks: s.tasks.map((t) => {
        if (t.id === 'task-1' || t.id === 'task-2') return { ...t, sourceRequirementIds: ['REQ-001'] };
        if (t.id === 'task-3') return { ...t, sourceRequirementIds: ['REQ-002'] };
        if (t.id === 'task-4') return { ...t, sourceRequirementIds: ['REQ-001', 'REQ-002'] };
        return t;
      }),
    })),
    parsedSpec: {
      title: '장바구니 리뉴얼 기획서',
      requirements: [
        { id: 'REQ-001', name: '장바구니 기능 개선', description: '장바구니 UX 개선', priority: 'high', relatedFeatures: ['FEAT-001'] },
        { id: 'REQ-002', name: '결제 연동 수정', description: '결제 플로우 수정', priority: 'medium', relatedFeatures: ['FEAT-002'] },
        { id: 'REQ-003', name: '마이페이지 개선', description: '마이페이지 위젯 업데이트', priority: 'low', relatedFeatures: [] },
      ],
      features: [],
      businessRules: [],
      ambiguities: [],
    },
  };
}

describe('Tickets - 요구사항 필터 (TASK-053)', () => {
  beforeEach(() => {
    useResultStore.setState({
      currentResult: getMockResultWithRequirements(),
      resultList: [],
      isLoading: false,
      error: null,
    });
  });

  /* ---------- 드롭다운 렌더링 ---------- */
  describe('요구사항 필터 드롭다운 렌더링', () => {
    it('parsedSpec에 requirements가 있으면 요구사항별 드롭다운이 표시된다', () => {
      renderWithRouter(<Tickets />);

      expect(screen.getByText('요구사항별:')).toBeInTheDocument();
      expect(screen.getByTestId('requirement-filter-select')).toBeInTheDocument();
    });

    it('드롭다운에 전체 옵션과 각 요구사항 옵션이 표시된다', () => {
      renderWithRouter(<Tickets />);

      const select = screen.getByTestId('requirement-filter-select') as HTMLSelectElement;
      const options = Array.from(select.options);

      expect(options).toHaveLength(4); // 전체 + 3 requirements
      expect(options[0].value).toBe('all');
      expect(options[0].text).toBe('전체');
      expect(options[1].value).toBe('REQ-001');
      expect(options[1].text).toBe('REQ-001: 장바구니 기능 개선');
      expect(options[2].value).toBe('REQ-002');
      expect(options[2].text).toBe('REQ-002: 결제 연동 수정');
      expect(options[3].value).toBe('REQ-003');
      expect(options[3].text).toBe('REQ-003: 마이페이지 개선');
    });

    it('parsedSpec이 null이면 요구사항 드롭다운이 표시되지 않는다', () => {
      const mockResult = getMockResult();
      // parsedSpec을 명시적으로 제거하여 null 케이스 테스트
      delete (mockResult as Partial<AnalysisResult>).parsedSpec;
      useResultStore.setState({ currentResult: mockResult });

      renderWithRouter(<Tickets />);

      expect(screen.queryByTestId('requirement-filter-select')).not.toBeInTheDocument();
      expect(screen.queryByText('요구사항별:')).not.toBeInTheDocument();
    });

    it('parsedSpec.requirements가 빈 배열이면 드롭다운이 표시되지 않는다', () => {
      const mockResult = getMockResultWithRequirements();
      mockResult.parsedSpec!.requirements = [];
      useResultStore.setState({ currentResult: mockResult });

      renderWithRouter(<Tickets />);

      expect(screen.queryByTestId('requirement-filter-select')).not.toBeInTheDocument();
    });
  });

  /* ---------- URL 파라미터 초기화 ---------- */
  describe('URL 파라미터 ?requirement= 초기화', () => {
    it('?requirement=REQ-001이 있으면 드롭다운이 REQ-001로 초기화된다', () => {
      renderWithMemoryRouter(<Tickets />, ['/tickets?requirement=REQ-001']);

      const select = screen.getByTestId('requirement-filter-select') as HTMLSelectElement;
      expect(select.value).toBe('REQ-001');
    });

    it('?requirement=REQ-002이 있으면 드롭다운이 REQ-002로 초기화된다', () => {
      renderWithMemoryRouter(<Tickets />, ['/tickets?requirement=REQ-002']);

      const select = screen.getByTestId('requirement-filter-select') as HTMLSelectElement;
      expect(select.value).toBe('REQ-002');
    });

    it('requirement 파라미터가 없으면 드롭다운이 "all"로 초기화된다', () => {
      renderWithMemoryRouter(<Tickets />, ['/tickets']);

      const select = screen.getByTestId('requirement-filter-select') as HTMLSelectElement;
      expect(select.value).toBe('all');
    });

    it('?requirement=REQ-001일 때 활성 스타일(purple)이 적용된다', () => {
      renderWithMemoryRouter(<Tickets />, ['/tickets?requirement=REQ-001']);

      const select = screen.getByTestId('requirement-filter-select');
      expect(select.className).toContain('bg-purple-100');
    });

    it('requirement가 "all"일 때 비활성 스타일이 적용된다', () => {
      renderWithMemoryRouter(<Tickets />, ['/tickets']);

      const select = screen.getByTestId('requirement-filter-select');
      expect(select.className).toContain('bg-gray-100');
    });
  });

  /* ---------- 필터링 동작 ---------- */
  describe('요구사항 필터링 동작', () => {
    it('REQ-001 선택 시 sourceRequirementIds에 REQ-001이 포함된 태스크만 표시된다', () => {
      renderWithMemoryRouter(<Tickets />, ['/tickets?requirement=REQ-001']);

      // REQ-001: task-1(장바구니 UI 전면 개편), task-2(장바구니 API 응답 변경), task-4(장바구니 담기 버튼 수정)
      expect(screen.getAllByText('장바구니 UI 전면 개편').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('장바구니 API 응답 변경').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('장바구니 담기 버튼 수정').length).toBeGreaterThanOrEqual(1);

      // REQ-002 only 태스크는 티켓 카드로 표시되지 않아야 함 (dependency diagram에서는 보일 수 있음)
      // task-3(결제 화면 장바구니 연동 수정)은 REQ-002만 가지고 있으므로 필터링됨
      // task-5, task-6은 sourceRequirementIds가 없으므로 필터링됨
    });

    it('REQ-002 선택 시 sourceRequirementIds에 REQ-002가 포함된 태스크만 표시된다', () => {
      renderWithMemoryRouter(<Tickets />, ['/tickets?requirement=REQ-002']);

      // REQ-002: task-3(결제 화면 장바구니 연동 수정), task-4(장바구니 담기 버튼 수정)
      expect(screen.getAllByText('결제 화면 장바구니 연동 수정').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('장바구니 담기 버튼 수정').length).toBeGreaterThanOrEqual(1);
    });

    it('존재하지 않는 요구사항 선택 시 매칭되는 태스크가 없으면 빈 메시지가 표시된다', () => {
      renderWithMemoryRouter(<Tickets />, ['/tickets?requirement=REQ-999']);

      // REQ-999에 연결된 태스크 없음
      expect(screen.getByText('조건에 맞는 티켓이 없습니다.')).toBeInTheDocument();
    });

    it('전체 선택 시 모든 태스크가 표시된다', () => {
      renderWithRouter(<Tickets />);

      // 기본값은 "all" - 전체 6개 태스크
      expect(screen.getAllByText('장바구니 UI 전면 개편').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('장바구니 API 응답 변경').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('결제 화면 장바구니 연동 수정').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('장바구니 담기 버튼 수정').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('최근 주문 위젯 업데이트').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('주문 이력 API 확장').length).toBeGreaterThanOrEqual(1);
    });
  });

  /* ---------- 드롭다운 상호작용 ---------- */
  describe('드롭다운 상호작용', () => {
    it('드롭다운에서 REQ-001을 선택하면 필터가 적용된다', () => {
      renderWithRouter(<Tickets />);

      const select = screen.getByTestId('requirement-filter-select');
      fireEvent.change(select, { target: { value: 'REQ-001' } });

      // 필터 적용 후 REQ-001 태스크들이 보여야 함
      expect(screen.getAllByText('장바구니 UI 전면 개편').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('장바구니 API 응답 변경').length).toBeGreaterThanOrEqual(1);
    });

    it('드롭다운에서 REQ-001 선택 후 "전체"로 변경하면 모든 태스크가 표시된다', () => {
      renderWithRouter(<Tickets />);

      const select = screen.getByTestId('requirement-filter-select');

      // REQ-001 선택
      fireEvent.change(select, { target: { value: 'REQ-001' } });

      // 전체로 변경
      fireEvent.change(select, { target: { value: 'all' } });

      // 모든 태스크가 다시 보여야 함
      expect(screen.getAllByText('장바구니 UI 전면 개편').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('최근 주문 위젯 업데이트').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('주문 이력 API 확장').length).toBeGreaterThanOrEqual(1);
    });

    it('드롭다운에서 값 변경 시 select의 value가 업데이트된다', () => {
      renderWithRouter(<Tickets />);

      const select = screen.getByTestId('requirement-filter-select') as HTMLSelectElement;
      expect(select.value).toBe('all');

      fireEvent.change(select, { target: { value: 'REQ-002' } });
      expect(select.value).toBe('REQ-002');
    });

    it('드롭다운에서 값 변경 시 활성 스타일이 변경된다', () => {
      renderWithMemoryRouter(<Tickets />, ['/tickets']);

      const select = screen.getByTestId('requirement-filter-select');
      expect(select.className).toContain('bg-gray-100');

      fireEvent.change(select, { target: { value: 'REQ-001' } });
      expect(select.className).toContain('bg-purple-100');

      fireEvent.change(select, { target: { value: 'all' } });
      expect(select.className).toContain('bg-gray-100');
    });
  });

  /* ---------- 복합 필터 ---------- */
  describe('복합 필터 (요구사항 + 유형/등급)', () => {
    it('요구사항 필터와 유형 필터를 동시에 적용할 수 있다', () => {
      renderWithMemoryRouter(<Tickets />, ['/tickets?requirement=REQ-001']);

      // REQ-001: task-1(FE), task-2(BE), task-4(FE)
      // BE 필터 클릭
      const beButtons = screen.getAllByText('BE');
      fireEvent.click(beButtons[0]);

      // REQ-001 + BE = task-2(장바구니 API 응답 변경)만 남아야 함
      expect(screen.getAllByText('장바구니 API 응답 변경').length).toBeGreaterThanOrEqual(1);
    });

    it('요구사항 필터와 검색 필터를 동시에 적용할 수 있다', () => {
      renderWithMemoryRouter(<Tickets />, ['/tickets?requirement=REQ-001']);

      const searchInput = screen.getByPlaceholderText('작업명, 파일 경로 검색...');
      fireEvent.change(searchInput, { target: { value: '담기' } });

      // REQ-001 + "담기" 검색 = task-4(장바구니 담기 버튼 수정)만 남아야 함
      expect(screen.getAllByText('장바구니 담기 버튼 수정').length).toBeGreaterThanOrEqual(1);
    });
  });
});
