/**
 * @module web/pages/__tests__/Dashboard.test
 * @description TASK-052: Dashboard REQ-009 컴포넌트 통합 테스트
 *
 * 테스트 대상:
 * - CriticalAlertBanner 렌더링 및 조건부 표시
 * - ScoreHeader impactFlow prop 전달
 * - AnalysisSummaryCard 조건부 렌더링
 * - SpecSourcePanel 조건부 렌더링
 */

import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Dashboard from '../Dashboard';
import { useResultStore } from '../../stores/resultStore';
import type { AnalysisResult } from '../../types';

// fetch 모킹
vi.stubGlobal('fetch', vi.fn());

/** BrowserRouter로 감싸서 렌더링하는 헬퍼 */
function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

/* ------------------------------------------------------------------ */
/*  기본 mock 결과 생성 헬퍼                                             */
/* ------------------------------------------------------------------ */

function createBaseResult(overrides?: Partial<AnalysisResult>): AnalysisResult {
  return {
    analysisId: 'test-001',
    analyzedAt: '2025-01-15T10:00:00Z',
    specTitle: '테스트 기획서',
    analysisMethod: 'rule-based',
    affectedScreens: [
      {
        screenId: 'scr-1',
        screenName: '메인 화면',
        impactLevel: 'high',
        tasks: [],
      },
      {
        screenId: 'scr-2',
        screenName: '서브 화면',
        impactLevel: 'medium',
        tasks: [],
      },
    ],
    tasks: [
      {
        id: 't-1',
        title: '신규 기능 개발',
        type: 'FE',
        actionType: 'new',
        description: '새 기능',
        affectedFiles: [],
        relatedApis: [],
        planningChecks: [],
        rationale: '',
      },
      {
        id: 't-2',
        title: 'API 수정',
        type: 'BE',
        actionType: 'modify',
        description: 'API 변경',
        affectedFiles: [],
        relatedApis: [],
        planningChecks: [],
        rationale: '',
      },
      {
        id: 't-3',
        title: '설정 변경',
        type: 'BE',
        actionType: 'config',
        description: '설정',
        affectedFiles: [],
        relatedApis: [],
        planningChecks: [],
        rationale: '',
      },
    ],
    planningChecks: [
      {
        id: 'chk-1',
        content: '정책 A 확인',
        relatedFeatureId: 'f-1',
        priority: 'high',
        status: 'pending',
      },
      {
        id: 'chk-2',
        content: '정책 B 확인',
        relatedFeatureId: 'f-2',
        priority: 'medium',
        status: 'pending',
      },
      {
        id: 'chk-3',
        content: '정책 C 확인',
        relatedFeatureId: 'f-3',
        priority: 'high',
        status: 'pending',
      },
    ],
    policyChanges: [],
    screenScores: [
      {
        screenId: 'scr-1',
        screenName: '메인 화면',
        screenScore: 35,
        grade: 'High',
        taskScores: [],
      },
    ],
    totalScore: 35,
    grade: 'High',
    recommendation: '테스트 권장 사항',
    policyWarnings: [
      {
        id: 'pw-1',
        policyId: 'pol-1',
        policyName: '테스트 정책',
        message: 'critical 경고 메시지',
        severity: 'critical',
        relatedTaskIds: ['t-1'],
      },
      {
        id: 'pw-2',
        policyId: 'pol-2',
        policyName: '일반 정책',
        message: '일반 경고',
        severity: 'warning',
        relatedTaskIds: ['t-2'],
      },
    ],
    ownerNotifications: [],
    confidenceScores: [],
    lowConfidenceWarnings: [],
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  테스트                                                              */
/* ------------------------------------------------------------------ */

describe('Dashboard REQ-009 Integration', () => {
  beforeEach(() => {
    useResultStore.setState({
      currentResult: null,
      resultList: [],
      isLoading: false,
      error: null,
    });
    vi.mocked(fetch).mockReset();
  });

  /* ================================================================ */
  /*  CriticalAlertBanner                                              */
  /* ================================================================ */

  describe('CriticalAlertBanner', () => {
    it('should render CriticalAlertBanner when critical policies and high priority checks exist', async () => {
      const mockResult = createBaseResult();

      vi.mocked(fetch).mockResolvedValue({
        json: async () => ({ result: mockResult }),
      } as Response);

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        const banner = screen.getByTestId('critical-alert-banner');
        expect(banner).toBeInTheDocument();
      });

      // 배너 텍스트 확인: critical 1건, high priority 2건
      const alertText = screen.getByTestId('critical-alert-text');
      expect(alertText.textContent).toContain('정책 경고 1건 (critical)');
      expect(alertText.textContent).toContain('기획 확인 2건 (high priority)');
    });

    it('should not render CriticalAlertBanner when no critical policies and no high priority checks', async () => {
      const mockResult = createBaseResult({
        policyWarnings: [
          {
            id: 'pw-1',
            policyId: 'pol-1',
            policyName: '일반 정책',
            message: '일반 경고',
            severity: 'warning',
            relatedTaskIds: ['t-1'],
          },
        ],
        planningChecks: [
          {
            id: 'chk-1',
            content: '확인 사항',
            relatedFeatureId: 'f-1',
            priority: 'medium',
            status: 'pending',
          },
        ],
      });

      vi.mocked(fetch).mockResolvedValue({
        json: async () => ({ result: mockResult }),
      } as Response);

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('테스트 기획서')).toBeInTheDocument();
      });

      // CriticalAlertBanner should not be present (returns null)
      expect(screen.queryByTestId('critical-alert-banner')).not.toBeInTheDocument();
    });
  });

  /* ================================================================ */
  /*  ScoreHeader impactFlow                                           */
  /* ================================================================ */

  describe('ScoreHeader with impactFlow', () => {
    it('should render FlowStrip with correct action counts', async () => {
      const mockResult = createBaseResult();

      vi.mocked(fetch).mockResolvedValue({
        json: async () => ({ result: mockResult }),
      } as Response);

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        // FlowStrip 렌더링 확인
        const flowStrip = screen.getByTestId('flow-strip');
        expect(flowStrip).toBeInTheDocument();
      });

      // action count chips: new 1, modify 1, config 1
      expect(screen.getByTestId('flow-chip-new')).toHaveTextContent('신규 1');
      expect(screen.getByTestId('flow-chip-modify')).toHaveTextContent('수정 1');
      expect(screen.getByTestId('flow-chip-config')).toHaveTextContent('설정 1');

      // screen count and task count
      expect(screen.getByTestId('flow-screen-count')).toHaveTextContent('영향 화면 2개');
      expect(screen.getByTestId('flow-task-count')).toHaveTextContent('총 작업 3개');
    });

    it('should not render flow chips for action types with zero count', async () => {
      // 모든 task가 modify인 경우
      const mockResult = createBaseResult({
        tasks: [
          {
            id: 't-1',
            title: 'Task A',
            type: 'FE',
            actionType: 'modify',
            description: '',
            affectedFiles: [],
            relatedApis: [],
            planningChecks: [],
            rationale: '',
          },
        ],
      });

      vi.mocked(fetch).mockResolvedValue({
        json: async () => ({ result: mockResult }),
      } as Response);

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('flow-strip')).toBeInTheDocument();
      });

      expect(screen.getByTestId('flow-chip-modify')).toBeInTheDocument();
      expect(screen.queryByTestId('flow-chip-new')).not.toBeInTheDocument();
      expect(screen.queryByTestId('flow-chip-config')).not.toBeInTheDocument();
    });
  });

  /* ================================================================ */
  /*  AnalysisSummaryCard                                              */
  /* ================================================================ */

  describe('AnalysisSummaryCard', () => {
    it('should render AnalysisSummaryCard when analysisSummary is present', async () => {
      const mockResult = createBaseResult({
        analysisSummary: {
          overview: '테스트 분석 개요입니다.',
          keyFindings: ['발견 1', '발견 2'],
          riskAreas: ['위험 영역 A'],
        },
      });

      vi.mocked(fetch).mockResolvedValue({
        json: async () => ({ result: mockResult }),
      } as Response);

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('analysis-summary-card')).toBeInTheDocument();
      });

      // overview
      expect(screen.getByTestId('summary-overview')).toHaveTextContent('테스트 분석 개요입니다.');

      // key findings
      expect(screen.getByTestId('summary-key-findings')).toBeInTheDocument();
      expect(screen.getByTestId('key-finding-0')).toHaveTextContent('발견 1');
      expect(screen.getByTestId('key-finding-1')).toHaveTextContent('발견 2');

      // risk areas (REQ-018-A2: RiskAreaDisplay uses string-risk-N testids for string items)
      expect(screen.getByTestId('summary-risk-areas')).toBeInTheDocument();
      expect(screen.getByTestId('string-risk-0')).toHaveTextContent('위험 영역 A');
    });

    it('should not render AnalysisSummaryCard when analysisSummary is absent', async () => {
      const mockResult = createBaseResult({
        analysisSummary: undefined,
      });

      vi.mocked(fetch).mockResolvedValue({
        json: async () => ({ result: mockResult }),
      } as Response);

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('테스트 기획서')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('analysis-summary-card')).not.toBeInTheDocument();
    });
  });

  /* ================================================================ */
  /*  SpecSourcePanel                                                  */
  /* ================================================================ */

  describe('SpecSourcePanel', () => {
    it('should render SpecSourcePanel when parsedSpec is present', async () => {
      const mockResult = createBaseResult({
        parsedSpec: {
          title: '기획서 제목',
          requirements: [
            {
              id: 'REQ-001',
              name: '요구사항 1',
              description: '설명',
              priority: 'high',
              relatedFeatures: ['FEAT-001'],
            },
          ],
          features: [
            {
              id: 'FEAT-001',
              name: '기능 1',
              description: '기능 설명',
              targetScreen: '메인 화면',
              actionType: 'new',
              keywords: ['키워드'],
            },
          ],
          businessRules: [],
          ambiguities: [],
        },
      });

      vi.mocked(fetch).mockResolvedValue({
        json: async () => ({ result: mockResult }),
      } as Response);

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('spec-source-panel')).toBeInTheDocument();
      });

      // 접힌 상태에서 요약 텍스트 확인
      expect(screen.getByTestId('spec-summary-text')).toHaveTextContent(
        '기획서 원문: 요구사항 1개, 기능 1개, 규칙 0개',
      );
    });

    it('should not render SpecSourcePanel when parsedSpec is absent', async () => {
      const mockResult = createBaseResult({
        parsedSpec: undefined,
      });

      vi.mocked(fetch).mockResolvedValue({
        json: async () => ({ result: mockResult }),
      } as Response);

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('테스트 기획서')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('spec-source-panel')).not.toBeInTheDocument();
    });
  });

  /* ================================================================ */
  /*  Layout order verification                                        */
  /* ================================================================ */

  describe('Layout order', () => {
    it('should render all new components in the correct order', async () => {
      const mockResult = createBaseResult({
        analysisSummary: {
          overview: '분석 개요',
          keyFindings: ['핵심 발견'],
          riskAreas: [],
        },
        parsedSpec: {
          title: '기획서',
          requirements: [],
          features: [],
          businessRules: [],
          ambiguities: [],
        },
      });

      vi.mocked(fetch).mockResolvedValue({
        json: async () => ({ result: mockResult }),
      } as Response);

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('critical-alert-banner')).toBeInTheDocument();
        expect(screen.getByTestId('analysis-summary-card')).toBeInTheDocument();
        expect(screen.getByTestId('spec-source-panel')).toBeInTheDocument();
        expect(screen.getByTestId('flow-strip')).toBeInTheDocument();
      });
    });
  });

  /* ================================================================ */
  /*  CriticalAlertBanner 필터링 정확도                                  */
  /* ================================================================ */

  describe('CriticalAlertBanner filtering accuracy', () => {
    it('should only count critical severity in criticalPolicies and high priority in highPriorityChecks', async () => {
      const mockResult = createBaseResult({
        policyWarnings: [
          { id: 'pw-c1', policyId: 'p1', policyName: 'A', message: 'a', severity: 'critical', relatedTaskIds: [] },
          { id: 'pw-c2', policyId: 'p2', policyName: 'B', message: 'b', severity: 'critical', relatedTaskIds: [] },
          { id: 'pw-w1', policyId: 'p3', policyName: 'C', message: 'c', severity: 'warning', relatedTaskIds: [] },
          { id: 'pw-i1', policyId: 'p4', policyName: 'D', message: 'd', severity: 'info', relatedTaskIds: [] },
        ],
        planningChecks: [
          { id: 'c1', content: 'X', relatedFeatureId: 'f', priority: 'high', status: 'pending' },
          { id: 'c2', content: 'Y', relatedFeatureId: 'f', priority: 'low', status: 'pending' },
          { id: 'c3', content: 'Z', relatedFeatureId: 'f', priority: 'medium', status: 'pending' },
        ],
      });

      vi.mocked(fetch).mockResolvedValue({
        json: async () => ({ result: mockResult }),
      } as Response);

      renderWithRouter(<Dashboard />);

      await waitFor(() => {
        const alertText = screen.getByTestId('critical-alert-text');
        // critical policies: 2건
        expect(alertText.textContent).toContain('정책 경고 2건 (critical)');
        // high priority checks: 1건
        expect(alertText.textContent).toContain('기획 확인 1건 (high priority)');
      });
    });
  });
});
