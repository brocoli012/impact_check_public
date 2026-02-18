/**
 * @module web/components/dashboard/__tests__/KpiCards.test
 * @description KpiCards 컴포넌트 단위 테스트 (TASK-031)
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import KpiCards from '../KpiCards';
import type { AnalysisResult } from '../../../types';

/* ------------------------------------------------------------------ */
/*  useNavigate 모킹                                                   */
/* ------------------------------------------------------------------ */

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

/* ------------------------------------------------------------------ */
/*  useResultStore 모킹                                                */
/* ------------------------------------------------------------------ */

let mockAnalysisId = 'test-analysis-001';

vi.mock('../../../stores/resultStore', () => ({
  useResultStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      currentResult: { analysisId: mockAnalysisId },
    }),
}));

/* ------------------------------------------------------------------ */
/*  localStorage 모킹                                                  */
/* ------------------------------------------------------------------ */

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((_index: number) => null),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

/* ------------------------------------------------------------------ */
/*  테스트 헬퍼                                                        */
/* ------------------------------------------------------------------ */

function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

/** 모든 필드가 있는 기본 AnalysisResult */
function getDefaultResult(overrides?: Partial<AnalysisResult>): AnalysisResult {
  return {
    analysisId: 'test-analysis-001',
    analyzedAt: '2025-01-01T00:00:00Z',
    specTitle: '테스트 기획서',
    analysisMethod: 'rule-based',
    affectedScreens: [
      {
        screenId: 's1',
        screenName: '화면 A',
        impactLevel: 'high',
        tasks: [],
      },
      {
        screenId: 's2',
        screenName: '화면 B',
        impactLevel: 'medium',
        tasks: [],
      },
    ],
    tasks: [
      {
        id: 't1',
        title: 'FE 작업',
        type: 'FE',
        actionType: 'modify',
        description: '',
        affectedFiles: [],
        relatedApis: [],
        planningChecks: [],
        rationale: '',
      },
      {
        id: 't2',
        title: 'BE 작업',
        type: 'BE',
        actionType: 'modify',
        description: '',
        affectedFiles: [],
        relatedApis: [],
        planningChecks: [],
        rationale: '',
      },
    ],
    planningChecks: [
      {
        id: 'c1',
        content: '확인 사항',
        relatedFeatureId: 'f1',
        priority: 'high',
        status: 'pending',
      },
      {
        id: 'c2',
        content: '확인 사항 2',
        relatedFeatureId: 'f2',
        priority: 'medium',
        status: 'pending',
      },
    ],
    policyChanges: [],
    screenScores: [],
    totalScore: 75,
    grade: 'High',
    recommendation: '확인 필요',
    policyWarnings: [
      {
        id: 'pw-1',
        policyId: 'p1',
        policyName: '테스트 정책',
        message: '경고 메시지',
        severity: 'warning',
        relatedTaskIds: ['t1'],
      },
    ],
    ownerNotifications: [
      {
        id: 'on1',
        systemId: 'sys1',
        systemName: '시스템 A',
        team: '팀 A',
        ownerName: '홍길동',
        ownerEmail: 'hong@test.com',
        relatedTaskIds: ['t1'],
        emailDraft: '',
      },
    ],
    confidenceScores: [],
    lowConfidenceWarnings: [],
    ...overrides,
  };
}

/** 모든 값이 0인 AnalysisResult */
function getEmptyResult(): AnalysisResult {
  return getDefaultResult({
    affectedScreens: [],
    tasks: [],
    planningChecks: [],
    policyWarnings: [],
    ownerNotifications: [],
  });
}

/* ------------------------------------------------------------------ */
/*  테스트                                                             */
/* ------------------------------------------------------------------ */

describe('KpiCards', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    localStorageMock.clear();
    mockAnalysisId = 'test-analysis-001';
  });

  /* ---------- 기본 렌더링 ---------- */
  describe('기본 렌더링', () => {
    it('5개의 KPI 카드를 렌더링한다', () => {
      renderWithRouter(<KpiCards result={getDefaultResult()} />);

      expect(screen.getByTestId('kpi-card-flow')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-card-tickets')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-card-checklist')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-card-policies')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-card-owners')).toBeInTheDocument();
    });

    it('각 카드에 올바른 값을 표시한다', () => {
      renderWithRouter(<KpiCards result={getDefaultResult()} />);

      expect(screen.getByTestId('kpi-card-flow')).toHaveTextContent('2');
      expect(screen.getByTestId('kpi-card-tickets')).toHaveTextContent('2');
      expect(screen.getByTestId('kpi-card-checklist')).toHaveTextContent('2');
      expect(screen.getByTestId('kpi-card-policies')).toHaveTextContent('1');
      expect(screen.getByTestId('kpi-card-owners')).toHaveTextContent('1');
    });

    it('총 작업 카드에 FE/BE 분류를 표시한다', () => {
      renderWithRouter(<KpiCards result={getDefaultResult()} />);

      expect(screen.getByTestId('kpi-card-tickets')).toHaveTextContent('FE 1 / BE 1');
    });

    it('각 카드에 "자세히 보기 >" 텍스트가 존재한다', () => {
      renderWithRouter(<KpiCards result={getDefaultResult()} />);

      const cards = [
        screen.getByTestId('kpi-card-flow'),
        screen.getByTestId('kpi-card-tickets'),
        screen.getByTestId('kpi-card-checklist'),
        screen.getByTestId('kpi-card-policies'),
        screen.getByTestId('kpi-card-owners'),
      ];

      cards.forEach((card) => {
        expect(card).toHaveTextContent('자세히 보기 >');
      });
    });
  });

  /* ---------- 클릭 시 네비게이션 ---------- */
  describe('클릭 시 네비게이션', () => {
    it('영향 화면 카드 클릭 시 /flow로 이동한다', () => {
      renderWithRouter(<KpiCards result={getDefaultResult()} />);
      fireEvent.click(screen.getByTestId('kpi-card-flow'));
      expect(mockNavigate).toHaveBeenCalledWith('/flow');
    });

    it('총 작업 카드 클릭 시 /tickets로 이동한다', () => {
      renderWithRouter(<KpiCards result={getDefaultResult()} />);
      fireEvent.click(screen.getByTestId('kpi-card-tickets'));
      expect(mockNavigate).toHaveBeenCalledWith('/tickets');
    });

    it('기획 확인 카드 클릭 시 /checklist로 이동한다', () => {
      renderWithRouter(<KpiCards result={getDefaultResult()} />);
      fireEvent.click(screen.getByTestId('kpi-card-checklist'));
      expect(mockNavigate).toHaveBeenCalledWith('/checklist');
    });

    it('정책 경고 카드 클릭 시 /policies로 이동한다', () => {
      renderWithRouter(<KpiCards result={getDefaultResult()} />);
      fireEvent.click(screen.getByTestId('kpi-card-policies'));
      expect(mockNavigate).toHaveBeenCalledWith('/policies');
    });

    it('확인 요청 카드 클릭 시 /owners로 이동한다', () => {
      renderWithRouter(<KpiCards result={getDefaultResult()} />);
      fireEvent.click(screen.getByTestId('kpi-card-owners'));
      expect(mockNavigate).toHaveBeenCalledWith('/owners');
    });

    it('Enter 키로 카드를 활성화할 수 있다', () => {
      renderWithRouter(<KpiCards result={getDefaultResult()} />);
      fireEvent.keyDown(screen.getByTestId('kpi-card-flow'), { key: 'Enter' });
      expect(mockNavigate).toHaveBeenCalledWith('/flow');
    });

    it('Space 키로 카드를 활성화할 수 있다', () => {
      renderWithRouter(<KpiCards result={getDefaultResult()} />);
      fireEvent.keyDown(screen.getByTestId('kpi-card-tickets'), { key: ' ' });
      expect(mockNavigate).toHaveBeenCalledWith('/tickets');
    });

    it('값이 0인 카드도 클릭 시 네비게이션된다', () => {
      renderWithRouter(<KpiCards result={getEmptyResult()} />);
      fireEvent.click(screen.getByTestId('kpi-card-policies'));
      expect(mockNavigate).toHaveBeenCalledWith('/policies');
    });
  });

  /* ---------- Dimmed 스타일 (값 === 0) ---------- */
  describe('Dimmed 스타일 (값 === 0)', () => {
    it('값이 0인 카드에 opacity-60 클래스가 적용된다', () => {
      renderWithRouter(<KpiCards result={getEmptyResult()} />);

      const card = screen.getByTestId('kpi-card-flow');
      expect(card.className).toContain('opacity-60');
    });

    it('값이 0인 카드에 bg-gray-50 클래스가 적용된다', () => {
      renderWithRouter(<KpiCards result={getEmptyResult()} />);

      const card = screen.getByTestId('kpi-card-flow');
      expect(card.className).toContain('bg-gray-50');
    });

    it('값이 0인 카드에 cursor-default 클래스가 적용된다', () => {
      renderWithRouter(<KpiCards result={getEmptyResult()} />);

      const card = screen.getByTestId('kpi-card-flow');
      expect(card.className).toContain('cursor-default');
    });

    it('값이 0이 아닌 카드에는 cursor-pointer 클래스가 적용된다', () => {
      renderWithRouter(<KpiCards result={getDefaultResult()} />);

      const card = screen.getByTestId('kpi-card-flow');
      expect(card.className).toContain('cursor-pointer');
    });

    it('값이 0이 아닌 카드에는 group 클래스가 적용된다', () => {
      renderWithRouter(<KpiCards result={getDefaultResult()} />);

      const card = screen.getByTestId('kpi-card-flow');
      expect(card.className).toContain('group');
    });

    it('값이 0이 아닌 카드에는 hover:shadow-md가 적용된다', () => {
      renderWithRouter(<KpiCards result={getDefaultResult()} />);

      const card = screen.getByTestId('kpi-card-flow');
      expect(card.className).toContain('hover:shadow-md');
    });
  });

  /* ---------- 긴급도 뱃지 ---------- */
  describe('긴급도 뱃지', () => {
    it('정책 경고에 critical severity가 있으면 빨간 점 뱃지를 표시한다', () => {
      const result = getDefaultResult({
        policyWarnings: [
          {
            id: 'pw-crit',
            policyId: 'p1',
            policyName: '심각 정책',
            message: '심각 경고',
            severity: 'critical',
            relatedTaskIds: ['t1'],
          },
        ],
      });

      renderWithRouter(<KpiCards result={result} />);

      expect(screen.getByTestId('urgency-badge-critical')).toBeInTheDocument();
    });

    it('정책 경고에 warning severity만 있으면 주황 점 뱃지를 표시한다', () => {
      const result = getDefaultResult({
        policyWarnings: [
          {
            id: 'pw-warn',
            policyId: 'p1',
            policyName: '경고 정책',
            message: '경고 메시지',
            severity: 'warning',
            relatedTaskIds: ['t1'],
          },
        ],
      });

      renderWithRouter(<KpiCards result={result} />);

      expect(screen.getByTestId('urgency-badge-warning')).toBeInTheDocument();
    });

    it('기획 확인에 high priority가 있으면 노란 점 뱃지를 표시한다', () => {
      const result = getDefaultResult({
        planningChecks: [
          {
            id: 'c-high',
            content: '중요 확인',
            relatedFeatureId: 'f1',
            priority: 'high',
            status: 'pending',
          },
        ],
      });

      renderWithRouter(<KpiCards result={result} />);

      expect(screen.getByTestId('urgency-badge-high-priority')).toBeInTheDocument();
    });

    it('정책 경고가 info severity만 있으면 뱃지를 표시하지 않는다', () => {
      const result = getDefaultResult({
        policyWarnings: [
          {
            id: 'pw-info',
            policyId: 'p1',
            policyName: '정보 정책',
            message: '정보 메시지',
            severity: 'info',
            relatedTaskIds: ['t1'],
          },
        ],
      });

      renderWithRouter(<KpiCards result={result} />);

      expect(screen.queryByTestId('urgency-badge-critical')).not.toBeInTheDocument();
      expect(screen.queryByTestId('urgency-badge-warning')).not.toBeInTheDocument();
    });

    it('기획 확인에 medium/low priority만 있으면 뱃지를 표시하지 않는다', () => {
      const result = getDefaultResult({
        planningChecks: [
          {
            id: 'c-med',
            content: '확인',
            relatedFeatureId: 'f1',
            priority: 'medium',
            status: 'pending',
          },
        ],
      });

      renderWithRouter(<KpiCards result={result} />);

      expect(screen.queryByTestId('urgency-badge-high-priority')).not.toBeInTheDocument();
    });

    it('critical severity 뱃지에 animate-ping 클래스가 포함된다 (pulse 효과)', () => {
      const result = getDefaultResult({
        policyWarnings: [
          {
            id: 'pw-crit',
            policyId: 'p1',
            policyName: '심각 정책',
            message: '심각 경고',
            severity: 'critical',
            relatedTaskIds: ['t1'],
          },
        ],
      });

      renderWithRouter(<KpiCards result={result} />);

      const badge = screen.getByTestId('urgency-badge-critical');
      const pingElement = badge.querySelector('.animate-ping');
      expect(pingElement).not.toBeNull();
    });
  });

  /* ---------- 접근성 ---------- */
  describe('접근성', () => {
    it('각 카드에 role="link"가 설정되어 있다', () => {
      renderWithRouter(<KpiCards result={getDefaultResult()} />);

      const card = screen.getByTestId('kpi-card-flow');
      expect(card).toHaveAttribute('role', 'link');
    });

    it('각 카드에 tabIndex=0이 설정되어 있다', () => {
      renderWithRouter(<KpiCards result={getDefaultResult()} />);

      const card = screen.getByTestId('kpi-card-flow');
      expect(card).toHaveAttribute('tabindex', '0');
    });

    it('각 카드에 적절한 aria-label이 설정되어 있다', () => {
      renderWithRouter(<KpiCards result={getDefaultResult()} />);

      const card = screen.getByTestId('kpi-card-flow');
      const ariaLabel = card.getAttribute('aria-label');
      expect(ariaLabel).toContain('영향 화면');
      expect(ariaLabel).toContain('페이지로 이동');
    });

    it('각 카드에 focus:ring-2 focus:ring-purple-400 클래스가 있다', () => {
      renderWithRouter(<KpiCards result={getDefaultResult()} />);

      const card = screen.getByTestId('kpi-card-flow');
      expect(card.className).toContain('focus:ring-2');
      expect(card.className).toContain('focus:ring-purple-400');
    });

    it('모든 5개 카드에 role="link"가 있다', () => {
      renderWithRouter(<KpiCards result={getDefaultResult()} />);

      const testIds = [
        'kpi-card-flow',
        'kpi-card-tickets',
        'kpi-card-checklist',
        'kpi-card-policies',
        'kpi-card-owners',
      ];

      testIds.forEach((testId) => {
        expect(screen.getByTestId(testId)).toHaveAttribute('role', 'link');
        expect(screen.getByTestId(testId)).toHaveAttribute('tabindex', '0');
      });
    });
  });

  /* ---------- markPageVisited 호출 검증 ---------- */
  describe('markPageVisited 호출', () => {
    it('카드 클릭 시 analysisId 포함된 키로 방문 기록을 저장한다', () => {
      renderWithRouter(<KpiCards result={getDefaultResult()} />);
      fireEvent.click(screen.getByTestId('kpi-card-policies'));

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'kic-action-guide-visited-test-analysis-001',
        expect.any(String),
      );

      // 저장된 값에 /policies가 포함되어야 함
      const setCalls = localStorageMock.setItem.mock.calls.filter(
        (c: string[]) => c[0] === 'kic-action-guide-visited-test-analysis-001',
      );
      const lastSetCall = setCalls[setCalls.length - 1];
      const savedRoutes = JSON.parse(lastSetCall[1]);
      expect(savedRoutes).toContain('/policies');
    });

    it('여러 카드를 클릭하면 각 route가 모두 기록된다', () => {
      renderWithRouter(<KpiCards result={getDefaultResult()} />);

      fireEvent.click(screen.getByTestId('kpi-card-flow'));
      fireEvent.click(screen.getByTestId('kpi-card-tickets'));

      const setCalls = localStorageMock.setItem.mock.calls.filter(
        (c: string[]) => c[0] === 'kic-action-guide-visited-test-analysis-001',
      );
      const lastSetCall = setCalls[setCalls.length - 1];
      const savedRoutes = JSON.parse(lastSetCall[1]);
      expect(savedRoutes).toContain('/flow');
      expect(savedRoutes).toContain('/tickets');
    });

    it('Enter 키 클릭 시에도 markPageVisited가 호출된다', () => {
      renderWithRouter(<KpiCards result={getDefaultResult()} />);
      fireEvent.keyDown(screen.getByTestId('kpi-card-checklist'), { key: 'Enter' });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'kic-action-guide-visited-test-analysis-001',
        expect.any(String),
      );

      const setCalls = localStorageMock.setItem.mock.calls.filter(
        (c: string[]) => c[0] === 'kic-action-guide-visited-test-analysis-001',
      );
      const lastSetCall = setCalls[setCalls.length - 1];
      const savedRoutes = JSON.parse(lastSetCall[1]);
      expect(savedRoutes).toContain('/checklist');
    });
  });
});
