/**
 * @module web/components/dashboard/__tests__/SpecSourcePanel.test
 * @description SpecSourcePanel 컴포넌트 단위 테스트
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpecSourcePanel, { type SpecSourcePanelProps } from '../SpecSourcePanel';
import type { WebParsedSpec, Task } from '../../../types';

/* ------------------------------------------------------------------ */
/*  useNavigate 모킹                                                   */
/* ------------------------------------------------------------------ */

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

/* ------------------------------------------------------------------ */
/*  테스트 헬퍼                                                        */
/* ------------------------------------------------------------------ */

function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

function getDefaultParsedSpec(): WebParsedSpec {
  return {
    title: '테스트 기획서',
    requirements: [
      {
        id: 'REQ-001',
        name: '사용자 인증',
        description: '사용자 로그인 기능 구현',
        priority: 'high',
        relatedFeatures: ['FEAT-001', 'FEAT-002'],
      },
      {
        id: 'REQ-002',
        name: '상품 목록',
        description: '상품 목록 조회 기능',
        priority: 'medium',
        relatedFeatures: ['FEAT-003'],
      },
      {
        id: 'REQ-003',
        name: '알림 설정',
        description: '푸시 알림 설정 기능',
        priority: 'low',
        relatedFeatures: [],
      },
    ],
    features: [
      {
        id: 'FEAT-001',
        name: '로그인 화면',
        description: '이메일/비밀번호 로그인',
        targetScreen: '로그인 페이지',
        actionType: 'new',
        keywords: ['인증', '로그인'],
      },
      {
        id: 'FEAT-002',
        name: 'SSO 연동',
        description: 'Google SSO 연동',
        targetScreen: '로그인 페이지',
        actionType: 'modify',
        keywords: ['SSO'],
      },
    ],
    businessRules: [
      {
        id: 'BR-001',
        description: '로그인 실패 5회 시 계정 잠금',
        relatedFeatureIds: ['FEAT-001'],
      },
      {
        id: 'BR-002',
        description: '비밀번호 90일 주기 변경 필수',
        relatedFeatureIds: ['FEAT-001', 'FEAT-002'],
      },
    ],
    ambiguities: [
      '로그인 실패 시 대기 시간 미정',
      'SSO 실패 시 폴백 정책 미정',
    ],
    targetScreens: ['로그인 페이지'],
    keywords: ['인증', '로그인', 'SSO'],
  };
}

function getDefaultTasks(): Task[] {
  return [
    {
      id: 'TASK-001',
      title: '로그인 API 구현',
      type: 'BE',
      actionType: 'new',
      description: '로그인 엔드포인트 구현',
      affectedFiles: ['auth.ts'],
      relatedApis: ['/api/auth/login'],
      planningChecks: [],
      rationale: '',
      sourceRequirementIds: ['REQ-001'],
      sourceFeatureIds: ['FEAT-001'],
    },
    {
      id: 'TASK-002',
      title: '로그인 UI 구현',
      type: 'FE',
      actionType: 'new',
      description: '로그인 폼 UI',
      affectedFiles: ['LoginPage.tsx'],
      relatedApis: [],
      planningChecks: [],
      rationale: '',
      sourceRequirementIds: ['REQ-001'],
      sourceFeatureIds: ['FEAT-001'],
    },
    {
      id: 'TASK-003',
      title: '상품 목록 API',
      type: 'BE',
      actionType: 'modify',
      description: '상품 목록 엔드포인트',
      affectedFiles: ['product.ts'],
      relatedApis: ['/api/products'],
      planningChecks: [],
      rationale: '',
      sourceRequirementIds: ['REQ-002'],
      sourceFeatureIds: ['FEAT-003'],
    },
  ];
}

function getDefaultProps(overrides?: Partial<SpecSourcePanelProps>): SpecSourcePanelProps {
  return {
    parsedSpec: getDefaultParsedSpec(),
    tasks: getDefaultTasks(),
    ...overrides,
  };
}

function getEmptyParsedSpec(): WebParsedSpec {
  return {
    requirements: [],
    features: [],
    businessRules: [],
    ambiguities: [],
  };
}

/* ------------------------------------------------------------------ */
/*  테스트                                                             */
/* ------------------------------------------------------------------ */

describe('SpecSourcePanel', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  /* ---------- 접힘 상태 ---------- */
  describe('접힘 상태', () => {
    it('기본 접힘 상태에서 요약 텍스트를 표시한다', () => {
      renderWithRouter(<SpecSourcePanel {...getDefaultProps()} />);

      const summaryText = screen.getByTestId('spec-summary-text');
      expect(summaryText).toHaveTextContent('기획서 원문: 요구사항 3개, 기능 2개, 규칙 2개');
    });

    it('접힘 상태에서 탭 바가 표시되지 않는다', () => {
      renderWithRouter(<SpecSourcePanel {...getDefaultProps()} />);

      expect(screen.queryByTestId('spec-tablist')).not.toBeInTheDocument();
    });

    it('접힘 상태에서 toggle 버튼에 aria-expanded=false가 설정된다', () => {
      renderWithRouter(<SpecSourcePanel {...getDefaultProps()} />);

      const toggleBtn = screen.getByTestId('spec-toggle-btn');
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    });
  });

  /* ---------- 펼침/접힘 토글 ---------- */
  describe('펼침/접힘 토글', () => {
    it('클릭 시 펼침, 4탭이 표시된다', () => {
      renderWithRouter(<SpecSourcePanel {...getDefaultProps()} />);

      fireEvent.click(screen.getByTestId('spec-toggle-btn'));

      const tablist = screen.getByTestId('spec-tablist');
      expect(tablist).toBeInTheDocument();

      expect(screen.getByTestId('spec-tab-requirements')).toBeInTheDocument();
      expect(screen.getByTestId('spec-tab-features')).toBeInTheDocument();
      expect(screen.getByTestId('spec-tab-rules')).toBeInTheDocument();
      expect(screen.getByTestId('spec-tab-ambiguities')).toBeInTheDocument();
    });

    it('펼침 상태에서 toggle 버튼에 aria-expanded=true가 설정된다', () => {
      renderWithRouter(<SpecSourcePanel {...getDefaultProps()} />);

      fireEvent.click(screen.getByTestId('spec-toggle-btn'));

      const toggleBtn = screen.getByTestId('spec-toggle-btn');
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    });

    it('펼침 상태에서 다시 클릭하면 접힌다', () => {
      renderWithRouter(<SpecSourcePanel {...getDefaultProps()} />);

      // 펼치기
      fireEvent.click(screen.getByTestId('spec-toggle-btn'));
      expect(screen.getByTestId('spec-tablist')).toBeInTheDocument();

      // 접기
      fireEvent.click(screen.getByTestId('spec-toggle-btn'));
      expect(screen.queryByTestId('spec-tablist')).not.toBeInTheDocument();
    });
  });

  /* ---------- 탭 전환 ---------- */
  describe('탭 전환 동작', () => {
    it('기본 활성 탭은 요구사항이다', () => {
      renderWithRouter(<SpecSourcePanel {...getDefaultProps()} />);
      fireEvent.click(screen.getByTestId('spec-toggle-btn'));

      const reqTab = screen.getByTestId('spec-tab-requirements');
      expect(reqTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('spec-tabpanel-requirements')).toBeInTheDocument();
    });

    it('기능 탭 클릭 시 기능 내용이 표시된다', () => {
      renderWithRouter(<SpecSourcePanel {...getDefaultProps()} />);
      fireEvent.click(screen.getByTestId('spec-toggle-btn'));
      fireEvent.click(screen.getByTestId('spec-tab-features'));

      expect(screen.getByTestId('spec-tab-features')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('spec-tabpanel-features')).toBeInTheDocument();
      expect(screen.getByTestId('feature-card-FEAT-001')).toBeInTheDocument();
      expect(screen.getByTestId('feature-card-FEAT-002')).toBeInTheDocument();
    });

    it('비즈니스 규칙 탭 클릭 시 규칙 내용이 표시된다', () => {
      renderWithRouter(<SpecSourcePanel {...getDefaultProps()} />);
      fireEvent.click(screen.getByTestId('spec-toggle-btn'));
      fireEvent.click(screen.getByTestId('spec-tab-rules'));

      expect(screen.getByTestId('spec-tab-rules')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('spec-tabpanel-rules')).toBeInTheDocument();
      expect(screen.getByTestId('rule-card-BR-001')).toBeInTheDocument();
      expect(screen.getByTestId('rule-card-BR-002')).toBeInTheDocument();
    });

    it('모호점 탭 클릭 시 모호점 내용이 표시된다', () => {
      renderWithRouter(<SpecSourcePanel {...getDefaultProps()} />);
      fireEvent.click(screen.getByTestId('spec-toggle-btn'));
      fireEvent.click(screen.getByTestId('spec-tab-ambiguities'));

      expect(screen.getByTestId('spec-tab-ambiguities')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('spec-tabpanel-ambiguities')).toBeInTheDocument();
      expect(screen.getByTestId('ambiguity-item-0')).toBeInTheDocument();
      expect(screen.getByTestId('ambiguity-item-1')).toBeInTheDocument();
    });
  });

  /* ---------- 요구사항 탭 - 추적 칩 ---------- */
  describe('요구사항 탭 - 추적 칩', () => {
    it('관련 Task가 있는 요구사항에 추적 칩이 표시된다', () => {
      renderWithRouter(<SpecSourcePanel {...getDefaultProps()} />);
      fireEvent.click(screen.getByTestId('spec-toggle-btn'));

      // REQ-001은 Task 2개 연결
      const chip1 = screen.getByTestId('requirement-task-chip-REQ-001');
      expect(chip1).toHaveTextContent('관련 Task 2개');

      // REQ-002는 Task 1개 연결
      const chip2 = screen.getByTestId('requirement-task-chip-REQ-002');
      expect(chip2).toHaveTextContent('관련 Task 1개');
    });

    it('관련 Task가 없는 요구사항에는 추적 칩이 표시되지 않는다', () => {
      renderWithRouter(<SpecSourcePanel {...getDefaultProps()} />);
      fireEvent.click(screen.getByTestId('spec-toggle-btn'));

      // REQ-003은 연결된 Task 없음
      expect(screen.queryByTestId('requirement-task-chip-REQ-003')).not.toBeInTheDocument();
    });

    it('추적 칩 클릭 시 navigate가 올바른 경로로 호출된다', () => {
      renderWithRouter(<SpecSourcePanel {...getDefaultProps()} />);
      fireEvent.click(screen.getByTestId('spec-toggle-btn'));

      fireEvent.click(screen.getByTestId('requirement-task-chip-REQ-001'));
      expect(mockNavigate).toHaveBeenCalledWith('/tickets?requirement=REQ-001');
    });

    it('다른 요구사항의 추적 칩 클릭 시 해당 요구사항 ID로 navigate된다', () => {
      renderWithRouter(<SpecSourcePanel {...getDefaultProps()} />);
      fireEvent.click(screen.getByTestId('spec-toggle-btn'));

      fireEvent.click(screen.getByTestId('requirement-task-chip-REQ-002'));
      expect(mockNavigate).toHaveBeenCalledWith('/tickets?requirement=REQ-002');
    });
  });

  /* ---------- 요구사항 탭 - 우선순위 표시 ---------- */
  describe('요구사항 탭 - 우선순위 표시', () => {
    it('high 우선순위에 적절한 스타일이 적용된다', () => {
      renderWithRouter(<SpecSourcePanel {...getDefaultProps()} />);
      fireEvent.click(screen.getByTestId('spec-toggle-btn'));

      const badge = screen.getByTestId('requirement-priority-REQ-001');
      expect(badge).toHaveTextContent('high');
      expect(badge.className).toContain('bg-red-100');
    });

    it('medium 우선순위에 적절한 스타일이 적용된다', () => {
      renderWithRouter(<SpecSourcePanel {...getDefaultProps()} />);
      fireEvent.click(screen.getByTestId('spec-toggle-btn'));

      const badge = screen.getByTestId('requirement-priority-REQ-002');
      expect(badge).toHaveTextContent('medium');
      expect(badge.className).toContain('bg-yellow-100');
    });

    it('low 우선순위에 적절한 스타일이 적용된다', () => {
      renderWithRouter(<SpecSourcePanel {...getDefaultProps()} />);
      fireEvent.click(screen.getByTestId('spec-toggle-btn'));

      const badge = screen.getByTestId('requirement-priority-REQ-003');
      expect(badge).toHaveTextContent('low');
      expect(badge.className).toContain('bg-green-100');
    });
  });

  /* ---------- 모호점 탭 - 경고 아이콘 ---------- */
  describe('모호점 탭 - 경고 아이콘', () => {
    it('모호점 항목에 경고 아이콘(svg)이 표시된다', () => {
      renderWithRouter(<SpecSourcePanel {...getDefaultProps()} />);
      fireEvent.click(screen.getByTestId('spec-toggle-btn'));
      fireEvent.click(screen.getByTestId('spec-tab-ambiguities'));

      const ambiguityItem = screen.getByTestId('ambiguity-item-0');
      const svg = ambiguityItem.querySelector('svg');
      expect(svg).not.toBeNull();
    });

    it('각 모호점 텍스트가 올바르게 표시된다', () => {
      renderWithRouter(<SpecSourcePanel {...getDefaultProps()} />);
      fireEvent.click(screen.getByTestId('spec-toggle-btn'));
      fireEvent.click(screen.getByTestId('spec-tab-ambiguities'));

      expect(screen.getByTestId('ambiguity-item-0')).toHaveTextContent(
        '로그인 실패 시 대기 시간 미정',
      );
      expect(screen.getByTestId('ambiguity-item-1')).toHaveTextContent(
        'SSO 실패 시 폴백 정책 미정',
      );
    });
  });

  /* ---------- 빈 parsedSpec 처리 ---------- */
  describe('parsedSpec이 비어있을 때 graceful 처리', () => {
    it('비어있는 parsedSpec에서 요약 텍스트가 올바르게 표시된다', () => {
      renderWithRouter(
        <SpecSourcePanel parsedSpec={getEmptyParsedSpec()} tasks={[]} />,
      );

      expect(screen.getByTestId('spec-summary-text')).toHaveTextContent(
        '기획서 원문: 요구사항 0개, 기능 0개, 규칙 0개',
      );
    });

    it('비어있는 parsedSpec에서 펼침 시 빈 상태 메시지를 표시한다', () => {
      renderWithRouter(
        <SpecSourcePanel parsedSpec={getEmptyParsedSpec()} tasks={[]} />,
      );
      fireEvent.click(screen.getByTestId('spec-toggle-btn'));

      // 요구사항 탭이 기본이므로 빈 메시지 확인
      expect(screen.getByText('요구사항이 없습니다.')).toBeInTheDocument();
    });

    it('비어있는 parsedSpec에서 기능 탭 전환 시 빈 상태 메시지를 표시한다', () => {
      renderWithRouter(
        <SpecSourcePanel parsedSpec={getEmptyParsedSpec()} tasks={[]} />,
      );
      fireEvent.click(screen.getByTestId('spec-toggle-btn'));
      fireEvent.click(screen.getByTestId('spec-tab-features'));

      expect(screen.getByText('기능이 없습니다.')).toBeInTheDocument();
    });

    it('비어있는 parsedSpec에서 규칙 탭 전환 시 빈 상태 메시지를 표시한다', () => {
      renderWithRouter(
        <SpecSourcePanel parsedSpec={getEmptyParsedSpec()} tasks={[]} />,
      );
      fireEvent.click(screen.getByTestId('spec-toggle-btn'));
      fireEvent.click(screen.getByTestId('spec-tab-rules'));

      expect(screen.getByText('비즈니스 규칙이 없습니다.')).toBeInTheDocument();
    });

    it('비어있는 parsedSpec에서 모호점 탭 전환 시 빈 상태 메시지를 표시한다', () => {
      renderWithRouter(
        <SpecSourcePanel parsedSpec={getEmptyParsedSpec()} tasks={[]} />,
      );
      fireEvent.click(screen.getByTestId('spec-toggle-btn'));
      fireEvent.click(screen.getByTestId('spec-tab-ambiguities'));

      expect(screen.getByText('모호점이 없습니다.')).toBeInTheDocument();
    });
  });

  /* ---------- 접근성 ---------- */
  describe('접근성', () => {
    it('탭 바에 role="tablist"이 있다', () => {
      renderWithRouter(<SpecSourcePanel {...getDefaultProps()} />);
      fireEvent.click(screen.getByTestId('spec-toggle-btn'));

      const tablist = screen.getByRole('tablist');
      expect(tablist).toBeInTheDocument();
    });

    it('각 탭 버튼에 role="tab"이 있다', () => {
      renderWithRouter(<SpecSourcePanel {...getDefaultProps()} />);
      fireEvent.click(screen.getByTestId('spec-toggle-btn'));

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(4);
    });

    it('활성 탭에 aria-selected="true"가 설정된다', () => {
      renderWithRouter(<SpecSourcePanel {...getDefaultProps()} />);
      fireEvent.click(screen.getByTestId('spec-toggle-btn'));

      const reqTab = screen.getByTestId('spec-tab-requirements');
      expect(reqTab).toHaveAttribute('aria-selected', 'true');

      // 비활성 탭은 aria-selected="false"
      const featTab = screen.getByTestId('spec-tab-features');
      expect(featTab).toHaveAttribute('aria-selected', 'false');
    });

    it('탭 내용에 role="tabpanel"이 있다', () => {
      renderWithRouter(<SpecSourcePanel {...getDefaultProps()} />);
      fireEvent.click(screen.getByTestId('spec-toggle-btn'));

      const tabpanel = screen.getByRole('tabpanel');
      expect(tabpanel).toBeInTheDocument();
    });
  });

  /* ---------- 탭 라벨에 개수 표시 ---------- */
  describe('탭 라벨 개수', () => {
    it('요구사항 탭에 개수가 표시된다', () => {
      renderWithRouter(<SpecSourcePanel {...getDefaultProps()} />);
      fireEvent.click(screen.getByTestId('spec-toggle-btn'));

      expect(screen.getByTestId('spec-tab-requirements')).toHaveTextContent('요구사항(3)');
    });

    it('기능 탭에 개수가 표시된다', () => {
      renderWithRouter(<SpecSourcePanel {...getDefaultProps()} />);
      fireEvent.click(screen.getByTestId('spec-toggle-btn'));

      expect(screen.getByTestId('spec-tab-features')).toHaveTextContent('기능(2)');
    });

    it('비즈니스 규칙 탭에 개수가 표시된다', () => {
      renderWithRouter(<SpecSourcePanel {...getDefaultProps()} />);
      fireEvent.click(screen.getByTestId('spec-toggle-btn'));

      expect(screen.getByTestId('spec-tab-rules')).toHaveTextContent('비즈니스 규칙(2)');
    });

    it('모호점 탭에 개수가 표시된다', () => {
      renderWithRouter(<SpecSourcePanel {...getDefaultProps()} />);
      fireEvent.click(screen.getByTestId('spec-toggle-btn'));

      expect(screen.getByTestId('spec-tab-ambiguities')).toHaveTextContent('모호점(2)');
    });
  });
});
