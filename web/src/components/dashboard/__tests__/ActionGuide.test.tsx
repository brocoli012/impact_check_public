/**
 * @module web/components/dashboard/__tests__/ActionGuide.test
 * @description ActionGuide 컴포넌트 단위 테스트
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ActionGuide, { type ActionGuideProps } from '../ActionGuide';
import type { Grade } from '../../../types';

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

/** 모든 필드가 있는 기본 props */
function getDefaultProps(overrides?: Partial<ActionGuideProps>): ActionGuideProps {
  return {
    grade: 'High' as Grade,
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
    affectedScreens: [
      {
        screenId: 's1',
        screenName: '화면 A',
        impactLevel: 'high',
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
    ...overrides,
  };
}

/** 모든 항목이 0건인 props */
function getEmptyProps(): ActionGuideProps {
  return {
    grade: 'Low' as Grade,
    policyWarnings: [],
    planningChecks: [],
    affectedScreens: [],
    tasks: [],
    ownerNotifications: [],
  };
}

/* ------------------------------------------------------------------ */
/*  테스트                                                             */
/* ------------------------------------------------------------------ */

describe('ActionGuide', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    localStorageMock.clear();
    mockAnalysisId = 'test-analysis-001';
  });

  /* ---------- 등급별 렌더링 ---------- */
  describe('등급별 렌더링', () => {
    it('Critical 등급 메시지를 올바르게 표시한다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps({ grade: 'Critical' })} />);
      expect(screen.getByTestId('guide-message')).toHaveTextContent(
        '이 기획은 핵심 시스템에 대규모 변경을 요구합니다. 아래 단계를 반드시 확인하세요.',
      );
    });

    it('High 등급 메시지를 올바르게 표시한다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps({ grade: 'High' })} />);
      expect(screen.getByTestId('guide-message')).toHaveTextContent(
        '상당한 영향이 예상됩니다. 아래 단계를 순서대로 진행하세요.',
      );
    });

    it('Medium 등급 메시지를 올바르게 표시한다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps({ grade: 'Medium' })} />);
      expect(screen.getByTestId('guide-message')).toHaveTextContent(
        '일부 영향이 있습니다. 아래 확인 사항을 검토해주세요.',
      );
    });

    it('Low 등급 메시지를 올바르게 표시한다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps({ grade: 'Low' })} />);
      expect(screen.getByTestId('guide-message')).toHaveTextContent(
        '경미한 영향입니다. 아래 항목을 참고하세요.',
      );
    });
  });

  /* ---------- 스텝 표시/숨김 ---------- */
  describe('스텝 표시/숨김', () => {
    it('값이 0인 스텝은 표시하지 않는다', () => {
      const props = getDefaultProps({
        policyWarnings: [],
        ownerNotifications: [],
      });
      renderWithRouter(<ActionGuide {...props} />);

      expect(screen.queryByTestId('step-policies')).not.toBeInTheDocument();
      expect(screen.queryByTestId('step-owners')).not.toBeInTheDocument();
      // 나머지 스텝은 존재해야 함
      expect(screen.getByTestId('step-checklist')).toBeInTheDocument();
      expect(screen.getByTestId('step-flow')).toBeInTheDocument();
      expect(screen.getByTestId('step-tickets')).toBeInTheDocument();
    });

    it('모든 항목이 있을 때 5개 스텝 모두 표시한다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps()} />);

      expect(screen.getByTestId('step-policies')).toBeInTheDocument();
      expect(screen.getByTestId('step-checklist')).toBeInTheDocument();
      expect(screen.getByTestId('step-flow')).toBeInTheDocument();
      expect(screen.getByTestId('step-tickets')).toBeInTheDocument();
      expect(screen.getByTestId('step-owners')).toBeInTheDocument();
    });

    it('정책 경고 스텝에 올바른 건수를 표시한다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps()} />);

      expect(screen.getByTestId('step-policies')).toHaveTextContent(
        '정책 위반/경고 1건을 먼저 확인하세요',
      );
    });

    it('기획 확인 스텝에 올바른 건수를 표시한다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps()} />);

      expect(screen.getByTestId('step-checklist')).toHaveTextContent(
        '기획서에서 확인이 필요한 2건을 검토하세요',
      );
    });

    it('작업 목록 스텝에 FE/BE 분류를 표시한다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps()} />);

      expect(screen.getByTestId('step-tickets')).toHaveTextContent(
        '예상 작업 2건(FE 1/BE 1)의 상세 내용을 확인하세요',
      );
    });
  });

  /* ---------- 클릭 시 네비게이션 ---------- */
  describe('클릭 시 네비게이션', () => {
    it('정책 스텝 클릭 시 /policies로 이동한다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps()} />);
      fireEvent.click(screen.getByTestId('step-policies'));
      expect(mockNavigate).toHaveBeenCalledWith('/policies');
    });

    it('체크리스트 스텝 클릭 시 /checklist로 이동한다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps()} />);
      fireEvent.click(screen.getByTestId('step-checklist'));
      expect(mockNavigate).toHaveBeenCalledWith('/checklist');
    });

    it('플로우 스텝 클릭 시 /flow로 이동한다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps()} />);
      fireEvent.click(screen.getByTestId('step-flow'));
      expect(mockNavigate).toHaveBeenCalledWith('/flow');
    });

    it('작업 목록 스텝 클릭 시 /tickets으로 이동한다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps()} />);
      fireEvent.click(screen.getByTestId('step-tickets'));
      expect(mockNavigate).toHaveBeenCalledWith('/tickets');
    });

    it('담당자 스텝 클릭 시 /owners로 이동한다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps()} />);
      fireEvent.click(screen.getByTestId('step-owners'));
      expect(mockNavigate).toHaveBeenCalledWith('/owners');
    });

    it('Enter 키로 스텝 활성화할 수 있다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps()} />);
      fireEvent.keyDown(screen.getByTestId('step-policies'), { key: 'Enter' });
      expect(mockNavigate).toHaveBeenCalledWith('/policies');
    });

    it('Space 키로 스텝 활성화할 수 있다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps()} />);
      fireEvent.keyDown(screen.getByTestId('step-checklist'), { key: ' ' });
      expect(mockNavigate).toHaveBeenCalledWith('/checklist');
    });
  });

  /* ---------- 전체 0건 - 축하 메시지 ---------- */
  describe('전체 0건 - 축하 메시지', () => {
    it('모든 항목이 0건이면 축하 메시지를 표시한다', () => {
      renderWithRouter(<ActionGuide {...getEmptyProps()} />);

      expect(screen.getByTestId('congrats-message')).toHaveTextContent(
        '이 기획서는 기존 시스템에 큰 영향이 없습니다. 안심하고 진행하세요.',
      );
    });

    it('모든 항목이 0건이면 스텝 목록을 표시하지 않는다', () => {
      renderWithRouter(<ActionGuide {...getEmptyProps()} />);

      expect(screen.queryByTestId('step-list')).not.toBeInTheDocument();
    });
  });

  /* ---------- 진행률 바 ---------- */
  describe('진행률 바', () => {
    it('진행률 바가 렌더링된다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps()} />);
      expect(screen.getByTestId('progress-section')).toBeInTheDocument();
    });

    it('초기 상태에서 0/5 완료로 표시된다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps()} />);
      expect(screen.getByTestId('progress-section')).toHaveTextContent('0/5 완료');
    });

    it('방문한 페이지가 있으면 진행률이 반영된다', () => {
      // analysisId 기반 키에 미리 방문 기록 설정
      localStorageMock.setItem(
        'kic-action-guide-visited-test-analysis-001',
        JSON.stringify(['/policies', '/checklist']),
      );

      renderWithRouter(<ActionGuide {...getDefaultProps()} />);
      expect(screen.getByTestId('progress-section')).toHaveTextContent('2/5 완료');
    });

    it('progressbar role이 존재한다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps()} />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  /* ---------- 접근성 ---------- */
  describe('접근성', () => {
    it('컨테이너에 region role과 aria-label이 있다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps()} />);
      const region = screen.getByTestId('action-guide');
      expect(region).toHaveAttribute('role', 'region');
      expect(region).toHaveAttribute('aria-label', '액션 가이드');
    });

    it('각 스텝에 role="link"와 tabIndex가 설정되어 있다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps()} />);

      const step = screen.getByTestId('step-policies');
      expect(step).toHaveAttribute('role', 'link');
      expect(step).toHaveAttribute('tabindex', '0');
    });

    it('각 스텝에 적절한 aria-label이 설정되어 있다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps()} />);

      const step = screen.getByTestId('step-policies');
      expect(step.getAttribute('aria-label')).toContain('단계 1');
      expect(step.getAttribute('aria-label')).toContain('정책 페이지로 이동');
    });

    it('축하 메시지 상태에서도 region role이 있다', () => {
      renderWithRouter(<ActionGuide {...getEmptyProps()} />);
      const region = screen.getByTestId('action-guide');
      expect(region).toHaveAttribute('role', 'region');
      expect(region).toHaveAttribute('aria-label', '액션 가이드');
    });
  });

  /* ---------- 스텝 클릭 시 localStorage 기록 (analysisId 포함) ---------- */
  describe('localStorage 기록', () => {
    it('스텝 클릭 시 analysisId 포함된 키로 방문 기록을 저장한다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps()} />);
      fireEvent.click(screen.getByTestId('step-policies'));

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
  });

  /* ---------- 접기/펼치기 ---------- */
  describe('접기/펼치기', () => {
    it('기본 상태는 펼침이다 (스텝 목록 표시)', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps()} />);
      expect(screen.getByTestId('step-list')).toBeInTheDocument();
      expect(screen.getByTestId('progress-section')).toBeInTheDocument();
    });

    it('접기 버튼 클릭 시 접힌 상태가 된다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps()} />);

      const toggleBtn = screen.getByTestId('collapse-toggle');
      fireEvent.click(toggleBtn);

      // 접힌 상태에서는 스텝 목록이 없어야 함
      expect(screen.queryByTestId('step-list')).not.toBeInTheDocument();
      expect(screen.queryByTestId('progress-section')).not.toBeInTheDocument();
    });

    it('접힌 상태에서 펼치기 버튼 클릭 시 다시 펼쳐진다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps()} />);

      // 접기
      fireEvent.click(screen.getByTestId('collapse-toggle'));
      expect(screen.queryByTestId('step-list')).not.toBeInTheDocument();

      // 펼치기
      fireEvent.click(screen.getByTestId('collapse-toggle'));
      expect(screen.getByTestId('step-list')).toBeInTheDocument();
      expect(screen.getByTestId('progress-section')).toBeInTheDocument();
    });

    it('접힌 상태에서 진행률 뱃지가 표시된다', () => {
      // 일부 방문 기록 설정
      localStorageMock.setItem(
        'kic-action-guide-visited-test-analysis-001',
        JSON.stringify(['/policies', '/checklist']),
      );

      renderWithRouter(<ActionGuide {...getDefaultProps()} />);

      // 접기
      fireEvent.click(screen.getByTestId('collapse-toggle'));

      const badge = screen.getByTestId('collapsed-badge');
      expect(badge).toHaveTextContent('2/5 완료');
    });

    it('접기 상태가 localStorage에 저장된다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps()} />);

      fireEvent.click(screen.getByTestId('collapse-toggle'));

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'kic-action-guide-collapsed-test-analysis-001',
        'true',
      );
    });

    it('localStorage에 접기 상태가 있으면 초기 접힘 상태로 렌더링된다', () => {
      localStorageMock.setItem(
        'kic-action-guide-collapsed-test-analysis-001',
        'true',
      );

      renderWithRouter(<ActionGuide {...getDefaultProps()} />);

      // 접힌 상태여야 함
      expect(screen.queryByTestId('step-list')).not.toBeInTheDocument();
      expect(screen.getByTestId('collapsed-badge')).toBeInTheDocument();
    });

    it('접힌 상태에서도 region role과 aria-label이 있다', () => {
      localStorageMock.setItem(
        'kic-action-guide-collapsed-test-analysis-001',
        'true',
      );

      renderWithRouter(<ActionGuide {...getDefaultProps()} />);

      const region = screen.getByTestId('action-guide');
      expect(region).toHaveAttribute('role', 'region');
      expect(region).toHaveAttribute('aria-label', '액션 가이드');
    });
  });

  /* ---------- analysisId 변경 시 독립 관리 ---------- */
  describe('analysisId별 독립 진행률 관리', () => {
    it('다른 analysisId의 방문 기록은 반영하지 않는다', () => {
      // 다른 analysisId의 방문 기록 설정
      localStorageMock.setItem(
        'kic-action-guide-visited-other-analysis-999',
        JSON.stringify(['/policies', '/checklist', '/flow']),
      );

      // 현재 analysisId에는 방문 기록 없음
      renderWithRouter(<ActionGuide {...getDefaultProps()} />);

      // 0/5 완료여야 함 (다른 analysisId의 기록이 반영되지 않아야 함)
      expect(screen.getByTestId('progress-section')).toHaveTextContent('0/5 완료');
    });

    it('현재 analysisId의 방문 기록만 정확히 반영한다', () => {
      // 현재 analysisId에 방문 기록 설정
      localStorageMock.setItem(
        'kic-action-guide-visited-test-analysis-001',
        JSON.stringify(['/policies']),
      );
      // 다른 analysisId에도 방문 기록 설정
      localStorageMock.setItem(
        'kic-action-guide-visited-other-analysis',
        JSON.stringify(['/policies', '/checklist', '/flow', '/tickets', '/owners']),
      );

      renderWithRouter(<ActionGuide {...getDefaultProps()} />);

      // 현재 analysisId의 기록만 반영: 1/5 완료
      expect(screen.getByTestId('progress-section')).toHaveTextContent('1/5 완료');
    });
  });

  /* ---------- visited 스텝 시각 스타일 ---------- */
  describe('visited 스텝 시각 스타일', () => {
    it('방문한 스텝에 체크 아이콘 뱃지가 표시된다', () => {
      localStorageMock.setItem(
        'kic-action-guide-visited-test-analysis-001',
        JSON.stringify(['/policies']),
      );

      renderWithRouter(<ActionGuide {...getDefaultProps()} />);

      // 방문한 스텝에는 visited 뱃지가 있어야 함
      expect(screen.getByTestId('step-badge-visited-policies')).toBeInTheDocument();
    });

    it('방문하지 않은 스텝에는 체크 아이콘 뱃지가 없다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps()} />);

      // 어떤 스텝에도 visited 뱃지가 없어야 함
      expect(screen.queryByTestId('step-badge-visited-policies')).not.toBeInTheDocument();
      expect(screen.queryByTestId('step-badge-visited-checklist')).not.toBeInTheDocument();
    });

    it('방문한 스텝의 뱃지에 bg-green-500 클래스가 있다', () => {
      localStorageMock.setItem(
        'kic-action-guide-visited-test-analysis-001',
        JSON.stringify(['/policies']),
      );

      renderWithRouter(<ActionGuide {...getDefaultProps()} />);

      const badge = screen.getByTestId('step-badge-visited-policies');
      expect(badge.className).toContain('bg-green-500');
    });

    it('방문한 스텝의 라벨 텍스트에 text-gray-400 클래스가 있다', () => {
      localStorageMock.setItem(
        'kic-action-guide-visited-test-analysis-001',
        JSON.stringify(['/policies']),
      );

      renderWithRouter(<ActionGuide {...getDefaultProps()} />);

      const stepEl = screen.getByTestId('step-policies');
      // 라벨 텍스트 span 찾기
      const labelSpan = stepEl.querySelector('.text-gray-400');
      expect(labelSpan).not.toBeNull();
    });

    it('방문한 스텝의 카드에 bg-gray-50/50 클래스가 있다', () => {
      localStorageMock.setItem(
        'kic-action-guide-visited-test-analysis-001',
        JSON.stringify(['/policies']),
      );

      renderWithRouter(<ActionGuide {...getDefaultProps()} />);

      const stepEl = screen.getByTestId('step-policies');
      expect(stepEl.className).toContain('bg-gray-50/50');
    });

    it('방문하지 않은 스텝의 라벨 텍스트에 text-gray-800 클래스가 있다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps()} />);

      const stepEl = screen.getByTestId('step-policies');
      const labelSpan = stepEl.querySelector('.text-gray-800');
      expect(labelSpan).not.toBeNull();
    });

    it('방문하지 않은 스텝의 링크 텍스트에 text-purple-600 클래스가 있다', () => {
      renderWithRouter(<ActionGuide {...getDefaultProps()} />);

      const stepEl = screen.getByTestId('step-policies');
      const linkSpan = stepEl.querySelector('.text-purple-600');
      expect(linkSpan).not.toBeNull();
    });
  });
});
