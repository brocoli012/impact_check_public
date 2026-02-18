/**
 * @module web/components/dashboard/ActionGuide
 * @description 대시보드 액션 가이드 - "지금 해야 할 일" 섹션
 * 분석 결과에 따른 단계별 행동 안내를 표시합니다.
 */

import { useMemo, useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useResultStore } from '../../stores/resultStore';
import { getVisitedPages, markPageVisited } from '../../utils/visitedPages';
import type {
  Grade,
  PolicyWarning,
  Check,
  ScreenImpact,
  Task,
  OwnerNotification,
} from '../../types';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ActionGuideProps {
  grade: Grade;
  policyWarnings: PolicyWarning[];
  planningChecks: Check[];
  affectedScreens: ScreenImpact[];
  tasks: Task[];
  ownerNotifications: OwnerNotification[];
}

/* ------------------------------------------------------------------ */
/*  내부 타입                                                          */
/* ------------------------------------------------------------------ */

interface ActionStep {
  key: string;
  label: string;
  linkText: string;
  route: string;
  count: number;
}

/* ------------------------------------------------------------------ */
/*  등급별 스타일 매핑                                                  */
/* ------------------------------------------------------------------ */

interface GuideStyle {
  container: string;
  message: string;
  stepBadgeBg: string;
  accentBar: string;
}

const GUIDE_STYLES: Record<Grade, GuideStyle> = {
  Critical: {
    container: 'bg-red-50 border-2 border-red-300 shadow-lg',
    message:
      '이 기획은 핵심 시스템에 대규모 변경을 요구합니다. 아래 단계를 반드시 확인하세요.',
    stepBadgeBg: 'bg-red-500',
    accentBar: 'bg-red-500 animate-pulse',
  },
  High: {
    container: 'bg-orange-50 border-2 border-orange-300 shadow-md',
    message: '상당한 영향이 예상됩니다. 아래 단계를 순서대로 진행하세요.',
    stepBadgeBg: 'bg-orange-500',
    accentBar: 'bg-orange-500',
  },
  Medium: {
    container: 'bg-yellow-50 border border-yellow-200 shadow-sm',
    message: '일부 영향이 있습니다. 아래 확인 사항을 검토해주세요.',
    stepBadgeBg: 'bg-yellow-500',
    accentBar: 'bg-yellow-500',
  },
  Low: {
    container: 'bg-green-50 border border-green-200',
    message: '경미한 영향입니다. 아래 항목을 참고하세요.',
    stepBadgeBg: 'bg-green-500',
    accentBar: 'bg-green-500',
  },
};

/* ------------------------------------------------------------------ */
/*  등급별 아이콘 SVG                                                   */
/* ------------------------------------------------------------------ */

function GradeIcon({ grade }: { grade: Grade }) {
  switch (grade) {
    case 'Critical':
      return (
        <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      );
    case 'High':
      return (
        <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'Medium':
      return (
        <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'Low':
      return (
        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

/* ------------------------------------------------------------------ */
/*  스텝별 아이콘 SVG                                                   */
/* ------------------------------------------------------------------ */

const STEP_ICONS: Record<string, React.ReactNode> = {
  policies: (
    <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  checklist: (
    <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  flow: (
    <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  tickets: (
    <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  ),
  owners: (
    <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
};

/* ------------------------------------------------------------------ */
/*  접기 상태 localStorage 관리                                         */
/* ------------------------------------------------------------------ */

function getCollapsedKey(analysisId: string): string {
  return `kic-action-guide-collapsed-${analysisId}`;
}

function getCollapsedState(analysisId: string): boolean {
  try {
    return localStorage.getItem(getCollapsedKey(analysisId)) === 'true';
  } catch {
    return false;
  }
}

function saveCollapsedState(analysisId: string, collapsed: boolean): void {
  try {
    localStorage.setItem(getCollapsedKey(analysisId), String(collapsed));
  } catch {
    // localStorage 접근 실패 시 무시
  }
}

/* ------------------------------------------------------------------ */
/*  스텝 빌더                                                          */
/* ------------------------------------------------------------------ */

function buildSteps(props: ActionGuideProps): ActionStep[] {
  const { policyWarnings, planningChecks, affectedScreens, tasks, ownerNotifications } = props;
  const feTasks = tasks.filter((t) => t.type === 'FE').length;
  const beTasks = tasks.filter((t) => t.type === 'BE').length;

  const candidates: ActionStep[] = [
    {
      key: 'policies',
      label: `정책 위반/경고 ${policyWarnings.length}건을 먼저 확인하세요`,
      linkText: '정책 페이지로 이동',
      route: '/policies',
      count: policyWarnings.length,
    },
    {
      key: 'checklist',
      label: `기획서에서 확인이 필요한 ${planningChecks.length}건을 검토하세요`,
      linkText: '체크리스트 페이지로 이동',
      route: '/checklist',
      count: planningChecks.length,
    },
    {
      key: 'flow',
      label: `영향받는 ${affectedScreens.length}개 화면의 구조를 플로우차트에서 확인하세요`,
      linkText: '플로우차트에서 확인하기',
      route: '/flow',
      count: affectedScreens.length,
    },
    {
      key: 'tickets',
      label: `예상 작업 ${tasks.length}건(FE ${feTasks}/BE ${beTasks})의 상세 내용을 확인하세요`,
      linkText: '작업 목록 확인하기',
      route: '/tickets',
      count: tasks.length,
    },
    {
      key: 'owners',
      label: `${ownerNotifications.length}명의 담당자에게 영향도 분석 결과를 공유하세요`,
      linkText: '담당자 페이지로 이동',
      route: '/owners',
      count: ownerNotifications.length,
    },
  ];

  return candidates.filter((s) => s.count > 0);
}

/* ------------------------------------------------------------------ */
/*  ChevronRight 아이콘                                                 */
/* ------------------------------------------------------------------ */

function ChevronRight() {
  return (
    <svg
      className="w-3 h-3 ml-1 text-gray-400 group-hover/step:text-purple-600 group-hover/step:translate-x-0.5 transition-all"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Chevron 토글 아이콘                                                  */
/* ------------------------------------------------------------------ */

function CollapseChevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className="w-4 h-4 text-gray-500 transition-transform"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      {collapsed ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  체크 아이콘 (visited 스텝용)                                         */
/* ------------------------------------------------------------------ */

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  메인 컴포넌트                                                       */
/* ------------------------------------------------------------------ */

function ActionGuide(props: ActionGuideProps) {
  const { grade } = props;
  const navigate = useNavigate();
  const style = GUIDE_STYLES[grade];

  // resultStore에서 analysisId 가져오기
  const currentResult = useResultStore((s) => s.currentResult);
  const analysisId = currentResult?.analysisId ?? '';

  const steps = useMemo(() => buildSteps(props), [props]);
  const visited = useMemo(
    () => new Set(getVisitedPages(analysisId)),
    [analysisId],
  );

  const completedCount = useMemo(() => {
    return steps.filter((s) => visited.has(s.route)).length;
  }, [steps, visited]);

  const progressPercent = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;

  // 접기/펼치기 상태 관리
  const [collapsed, setCollapsed] = useState<boolean>(() => getCollapsedState(analysisId));

  const handleToggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      saveCollapsedState(analysisId, next);
      return next;
    });
  }, [analysisId]);

  useEffect(() => {
    setCollapsed(getCollapsedState(analysisId));
  }, [analysisId]);

  const handleStepClick = useCallback(
    (route: string) => {
      markPageVisited(analysisId, route);
      navigate(route);
    },
    [navigate, analysisId],
  );

  const handleStepKeyDown = useCallback(
    (e: React.KeyboardEvent, route: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleStepClick(route);
      }
    },
    [handleStepClick],
  );

  /* ---------- 모든 항목이 0건이면 축하 메시지 ---------- */
  if (steps.length === 0) {
    return (
      <div
        className="bg-green-50 border border-green-200 rounded-lg p-5"
        role="region"
        aria-label="액션 가이드"
        data-testid="action-guide"
      >
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-green-800" data-testid="congrats-message">
              이 기획서는 기존 시스템에 큰 영향이 없습니다. 안심하고 진행하세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- 접힌 상태 렌더링 ---------- */
  if (collapsed) {
    return (
      <div
        className={`relative rounded-lg p-4 overflow-hidden ${style.container}`}
        role="region"
        aria-label="액션 가이드"
        data-testid="action-guide"
      >
        {/* 좌측 악센트 바 */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${style.accentBar}`} />

        <div className="flex items-center justify-between pl-2">
          <div className="flex items-center gap-3">
            <GradeIcon grade={grade} />
            <h3 className="text-sm font-bold text-gray-900">지금 해야 할 일</h3>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700"
              data-testid="collapsed-badge"
            >
              {completedCount}/{steps.length} 완료
            </span>
          </div>
          <button
            type="button"
            onClick={handleToggleCollapse}
            className="p-1 rounded hover:bg-black/5 transition-colors"
            aria-label="액션 가이드 펼치기"
            data-testid="collapse-toggle"
          >
            <CollapseChevron collapsed={collapsed} />
          </button>
        </div>
      </div>
    );
  }

  /* ---------- 펼친 상태 렌더링 (일반) ---------- */
  return (
    <div
      className={`relative rounded-lg p-5 overflow-hidden ${style.container}`}
      role="region"
      aria-label="액션 가이드"
      data-testid="action-guide"
    >
      {/* 좌측 악센트 바 */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${style.accentBar}`} />

      {/* 헤더: 아이콘 + 타이틀 + 요약 메시지 + 접기 버튼 */}
      <div className="flex items-start justify-between mb-4 pl-2">
        <div className="flex items-start gap-3">
          <GradeIcon grade={grade} />
          <div>
            <h3 className="text-sm font-bold text-gray-900">지금 해야 할 일</h3>
            <p className="text-sm text-gray-700 mt-1" data-testid="guide-message">
              {style.message}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleToggleCollapse}
          className="p-1 rounded hover:bg-black/5 transition-colors shrink-0 ml-2"
          aria-label="액션 가이드 접기"
          data-testid="collapse-toggle"
        >
          <CollapseChevron collapsed={collapsed} />
        </button>
      </div>

      {/* 스텝 목록 */}
      <div className="space-y-2 pl-2" data-testid="step-list">
        {steps.map((step, index) => {
          const isVisited = visited.has(step.route);
          return (
            <div
              key={step.key}
              className={`flex items-start gap-3 rounded-lg p-3 transition-colors duration-150 cursor-pointer group/step
                ${isVisited ? 'bg-gray-50/50' : 'bg-white/60 hover:bg-white/80'}
                focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:outline-none`}
              role="link"
              tabIndex={0}
              aria-label={`단계 ${index + 1}: ${step.label}, ${step.linkText}`}
              onClick={() => handleStepClick(step.route)}
              onKeyDown={(e) => handleStepKeyDown(e, step.route)}
              data-testid={`step-${step.key}`}
            >
              {/* 스텝 번호 뱃지 - 방문 시 초록 체크, 미방문 시 등급 색상 번호 */}
              {isVisited ? (
                <span
                  className="w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center shrink-0"
                  data-testid={`step-badge-visited-${step.key}`}
                >
                  <CheckIcon />
                </span>
              ) : (
                <span
                  className={`w-6 h-6 rounded-full ${style.stepBadgeBg} text-white text-xs font-bold flex items-center justify-center shrink-0`}
                >
                  {index + 1}
                </span>
              )}

              {/* 아이콘 + 라벨 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {STEP_ICONS[step.key]}
                  <span className={`text-sm font-medium ${isVisited ? 'text-gray-400' : 'text-gray-800'}`}>
                    {step.label}
                  </span>
                </div>
                <div className="flex items-center mt-1">
                  <span className={`text-xs ${isVisited ? 'text-gray-400' : 'text-purple-600 group-hover/step:text-purple-700 group-hover/step:underline'}`}>
                    {step.linkText}
                  </span>
                  <ChevronRight />
                </div>
              </div>

              {/* 방문 완료 표시 */}
              {isVisited && (
                <svg className="w-4 h-4 text-green-500 shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          );
        })}
      </div>

      {/* 진행률 바 */}
      <div className="mt-4 pl-2" data-testid="progress-section">
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-200 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-purple-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={completedCount}
              aria-valuemin={0}
              aria-valuemax={steps.length}
              aria-label={`진행률 ${completedCount}/${steps.length} 완료`}
            />
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {completedCount}/{steps.length} 완료
          </span>
        </div>
      </div>
    </div>
  );
}

export default ActionGuide;
