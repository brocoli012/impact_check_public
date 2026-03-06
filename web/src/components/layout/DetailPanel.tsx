/**
 * @module web/components/layout/DetailPanel
 * @description 우측 상세 패널 - FlowChart 노드 선택 시 상세 정보 표시
 * 400px 고정 너비, 우측 슬라이드-인 애니메이션, 내부 스크롤
 */

import { useMemo, useCallback } from 'react';
import type { Node } from '@xyflow/react';
import { useResultStore } from '../../stores/resultStore';
import { useFlowStore } from '../../stores/flowStore';
import { GRADE_COLORS, CONFIDENCE_COLORS } from '../../utils/colors';
import type {
  Grade,
  ConfidenceGrade,
  TaskScore,
  ScreenScore,
  SystemConfidence,
  ConfidenceWarning,
  Task,
  ScreenImpact,
  PolicyChange,
} from '../../types';

interface DetailPanelProps {
  /** 선택된 노드 */
  node: Node;
  /** 닫기 핸들러 */
  onClose: () => void;
}

/** 노드 데이터에서 안전하게 값 추출 */
function str(data: Record<string, unknown>, key: string): string {
  const v = data[key];
  return v != null ? String(v) : '';
}
function num(data: Record<string, unknown>, key: string): number | null {
  const v = data[key];
  return typeof v === 'number' ? v : null;
}

function DetailPanel({ node, onClose }: DetailPanelProps) {
  const currentResult = useResultStore((s) => s.currentResult);
  const selectNode = useFlowStore((s) => s.selectNode);
  const toggleExpand = useFlowStore((s) => s.toggleExpand);
  const expandedNodeIds = useFlowStore((s) => s.expandedNodeIds);
  const requirementFilter = useFlowStore((s) => s.filter.requirementFilter);
  const data = node.data as Record<string, unknown>;

  const label = str(data, 'label');
  const grade = str(data, 'grade') as Grade | '';
  const score = num(data, 'score');
  const totalScore = num(data, 'totalScore');
  const taskType = str(data, 'taskType');

  // 노드 ID에서 실제 ID 추출
  const nodeType = node.type ?? '';

  // 관련 데이터 조회
  const relatedData = useMemo(() => {
    if (!currentResult) return null;

    const result = currentResult;

    // Screen 노드인 경우
    if (nodeType === 'screen') {
      const screenId = node.id.replace('screen-', '');
      const screenImpact = result.affectedScreens.find((s) => s.screenId === screenId);
      const screenScore = result.screenScores.find((s) => s.screenId === screenId);
      const relatedChecks = result.planningChecks.filter((c) =>
        screenImpact?.tasks.some(
          (t) => t.planningChecks?.some((pc) => c.content.includes(pc?.substring(0, 10) ?? '')),
        ),
      );

      return {
        type: 'screen' as const,
        screenImpact,
        screenScore,
        relatedChecks,
        tasks: screenImpact?.tasks ?? [],
      };
    }

    // Feature (Task) 노드인 경우
    if (nodeType === 'feature') {
      const taskId = node.id.replace('feature-', '');
      const task = result.tasks.find((t) => t.id === taskId);
      const screenScore = result.screenScores.find((ss) =>
        ss.taskScores.some((ts) => ts.taskId === taskId),
      );
      const taskScore = screenScore?.taskScores.find((ts) => ts.taskId === taskId);
      const relatedChecks = result.planningChecks.filter(
        (c) => task?.planningChecks?.some((pc) => c.content.includes(pc?.substring(0, 10) ?? '')),
      );

      return {
        type: 'feature' as const,
        task,
        taskScore,
        relatedChecks,
        screenName: screenScore?.screenName ?? '',
      };
    }

    // System 노드인 경우
    if (nodeType === 'system') {
      const sysId = node.id.replace('sys-', '');
      const confidence = result.confidenceScores.find((c) => c.systemId === sysId);
      const lowWarning = result.lowConfidenceWarnings.find((w) => w.systemId === sysId);
      const ownerInfo = result.ownerNotifications.find((o) => o.systemId === sysId);

      // Drill-down: system -> child screens
      const childScreens = result.affectedScreens.map((screen) => ({
        screenId: screen.screenId,
        screenName: screen.screenName,
        taskCount: screen.tasks.length,
        impactLevel: screen.impactLevel,
      }));

      return {
        type: 'system' as const,
        confidence,
        lowWarning,
        ownerInfo,
        childScreens,
      };
    }

    return null;
  }, [currentResult, node.id, nodeType]);

  // Impact highlight mode: find which tasks/policies are affected by the selected requirement
  const impactDetails = useMemo(() => {
    if (!requirementFilter || !currentResult) return null;

    const result = currentResult;

    // Find tasks related to this requirement
    const impactedTasks: Task[] = result.tasks.filter(
      (t) => t.sourceRequirementIds?.includes(requirementFilter),
    );
    const impactedTaskIds = new Set(impactedTasks.map((t) => t.id));

    // Find affected screens that contain impacted tasks
    const impactedScreens: ScreenImpact[] = result.affectedScreens.filter((s) =>
      s.tasks.some((t) => impactedTaskIds.has(t.id)),
    );

    // Find policy changes related to impacted tasks
    const impactedPolicies: PolicyChange[] = result.policyChanges.filter((pc) =>
      pc.affectedFiles.some((f) =>
        impactedTasks.some((t) => t.affectedFiles.includes(f)),
      ),
    );

    // Check if current node is in the impact zone
    let isCurrentNodeImpacted = false;
    if (nodeType === 'screen') {
      const screenId = node.id.replace('screen-', '');
      isCurrentNodeImpacted = impactedScreens.some((s) => s.screenId === screenId);
    } else if (nodeType === 'feature') {
      const taskId = node.id.replace('feature-', '');
      isCurrentNodeImpacted = impactedTaskIds.has(taskId);
    }

    if (!isCurrentNodeImpacted) return null;

    // Get requirement name
    const reqName =
      result.parsedSpec?.requirements.find((r) => r.id === requirementFilter)?.name ??
      requirementFilter;

    return {
      requirementName: reqName,
      requirementId: requirementFilter,
      impactedTasks: nodeType === 'screen'
        ? impactedTasks.filter((t) => {
            const screenId = node.id.replace('screen-', '');
            const screen = impactedScreens.find((s) => s.screenId === screenId);
            return screen?.tasks.some((st) => st.id === t.id);
          })
        : impactedTasks,
      impactedPolicies,
    };
  }, [requirementFilter, currentResult, node.id, nodeType]);

  // Navigate to a child node: select it and expand its parent if needed
  const navigateToNode = useCallback(
    (nodeId: string, parentScreenId?: string) => {
      if (parentScreenId && !expandedNodeIds.has(parentScreenId)) {
        toggleExpand(parentScreenId);
      }
      // Small delay to allow layout to settle after expand
      setTimeout(() => selectNode(nodeId), 50);
    },
    [selectNode, toggleExpand, expandedNodeIds],
  );

  const gradeColors = grade ? GRADE_COLORS[grade as Grade] : null;

  return (
    <div
      className="fixed right-0 top-0 h-full bg-white border-l border-gray-200 shadow-xl z-50 overflow-y-auto"
      style={{
        width: 400,
        animation: 'slideInRight 0.2s ease-out',
      }}
    >
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 z-10">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              {nodeType}
            </span>
            <h2 className="text-base font-bold text-gray-900 mt-1 leading-tight">
              {label}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="ml-3 p-1 rounded hover:bg-gray-100 transition-colors shrink-0"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Grade + Score */}
        <div className="flex items-center gap-3 mt-2">
          {gradeColors && grade && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold"
              style={{
                backgroundColor: gradeColors.bg,
                color: gradeColors.text,
                border: `1px solid ${gradeColors.border}`,
              }}
            >
              {grade}
            </span>
          )}
          {(score !== null || totalScore !== null) && (
            <span className="text-sm font-semibold text-gray-700">
              {totalScore !== null ? `총점: ${totalScore}` : `점수: ${score}`}
            </span>
          )}
          {taskType && (
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                taskType === 'FE'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-green-100 text-green-700'
              }`}
            >
              {taskType}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4 space-y-5">
        {/* Impact highlight details (when requirement filter is active) */}
        {impactDetails && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-xs font-semibold text-amber-700">
                영향 요구사항: {impactDetails.requirementName}
              </span>
            </div>
            {impactDetails.impactedTasks.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-amber-600 uppercase mb-1">영향받는 기능</p>
                <div className="space-y-1">
                  {impactDetails.impactedTasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => navigateToNode(`feature-${task.id}`)}
                      className="w-full text-left flex items-center gap-1.5 text-xs px-2 py-1 rounded hover:bg-amber-100 transition-colors"
                    >
                      <span className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                        task.type === 'FE' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {task.type}
                      </span>
                      <span className="text-amber-800 truncate">{task.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {impactDetails.impactedPolicies.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-amber-600 uppercase mb-1">변경되는 정책</p>
                <div className="space-y-1">
                  {impactDetails.impactedPolicies.map((pc) => (
                    <div key={pc.id} className="text-xs text-amber-800 px-2 py-1 bg-amber-100/50 rounded">
                      <span className="font-medium">{pc.policyName}</span>
                      <span className="text-amber-600 ml-1">({pc.changeType})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <a
              href={`/tickets?requirement=${impactDetails.requirementId}`}
              className="inline-flex items-center gap-1 text-[11px] text-amber-700 hover:text-amber-900 font-medium mt-1"
            >
              관련 Task 보기
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        )}

        {/* Score Breakdown - for screen/feature nodes with score data */}
        {relatedData?.type === 'screen' && relatedData.screenScore && (
          <ScoreBreakdownSection screenScore={relatedData.screenScore} />
        )}

        {relatedData?.type === 'feature' && relatedData.taskScore && (
          <TaskScoreBreakdown taskScore={relatedData.taskScore} />
        )}

        {/* Tasks list - for screen nodes (clickable drill-down) */}
        {relatedData?.type === 'screen' && relatedData.tasks.length > 0 && (
          <Section title="작업 항목">
            <div className="space-y-1">
              {relatedData.tasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => {
                    const screenId = node.id.replace('screen-', '');
                    navigateToNode(`feature-${task.id}`, screenId);
                  }}
                  className="w-full text-left flex items-start gap-2 text-xs px-2 py-1.5 rounded hover:bg-gray-50 transition-colors group"
                >
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 mt-0.5 ${
                      task.type === 'FE'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {task.type}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-800 font-medium group-hover:text-blue-600 truncate">{task.title}</p>
                    <p className="text-gray-400 mt-0.5 line-clamp-2">{task.description}</p>
                  </div>
                  <svg className="w-3 h-3 text-gray-300 group-hover:text-blue-400 shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* Affected files - for feature nodes */}
        {relatedData?.type === 'feature' && relatedData.task && (
          <Section title="관련 코드 경로">
            <div className="space-y-1">
              {relatedData.task.affectedFiles.map((file) => (
                <p key={file} className="text-xs text-gray-600 font-mono bg-gray-50 rounded px-2 py-1">
                  {file}
                </p>
              ))}
            </div>
          </Section>
        )}

        {/* Module node - show file path */}
        {nodeType === 'module' && (
          <Section title="관련 코드 경로">
            <p className="text-xs text-gray-600 font-mono bg-gray-50 rounded px-2 py-1">
              {str(data, 'filePath')}
            </p>
          </Section>
        )}

        {/* Planning checks */}
        {relatedData && (relatedData.type === 'screen' || relatedData.type === 'feature') && relatedData.relatedChecks.length > 0 && (
          <Section title="기획 확인 사항">
            <div className="space-y-1.5">
              {relatedData.relatedChecks.map((check) => (
                <div key={check.id} className="flex items-start gap-2 text-xs">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 mt-0.5 ${
                      check.priority === 'high'
                        ? 'bg-red-100 text-red-700'
                        : check.priority === 'medium'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {check.priority}
                  </span>
                  <p className="text-gray-700">{check.content}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Check node */}
        {nodeType === 'check' && (
          <Section title="기획 확인 사항">
            <div className="flex items-start gap-2 text-xs">
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                  str(data, 'urgency') === 'high'
                    ? 'bg-red-100 text-red-700'
                    : str(data, 'urgency') === 'medium'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-green-100 text-green-700'
                }`}
              >
                {str(data, 'urgency')}
              </span>
              <p className="text-gray-700">{label}</p>
            </div>
          </Section>
        )}

        {/* Policy node */}
        {nodeType === 'policy' && (
          <Section title="정책 변경 정보">
            <p className="text-xs text-gray-700">{str(data, 'description')}</p>
            {str(data, 'requiresReview') === 'true' && (
              <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700">
                리뷰 필요
              </span>
            )}
          </Section>
        )}

        {/* Policy warning node */}
        {nodeType === 'policyWarning' && (
          <Section title="정책 경고">
            <div className="space-y-2 text-xs">
              <p className="text-gray-700">{label}</p>
              {str(data, 'policyName') && (
                <p className="text-gray-500">정책: {str(data, 'policyName')}</p>
              )}
              {str(data, 'severity') && (
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    str(data, 'severity') === 'critical'
                      ? 'bg-red-100 text-red-700'
                      : str(data, 'severity') === 'warning'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {str(data, 'severity')}
                </span>
              )}
            </div>
          </Section>
        )}

        {/* Drill-down: system -> child screens */}
        {relatedData?.type === 'system' && relatedData.childScreens.length > 0 && (
          <Section title="하위 화면 (메뉴)">
            <div className="space-y-1">
              {relatedData.childScreens.map((screen) => (
                <button
                  key={screen.screenId}
                  onClick={() => navigateToNode(`screen-${screen.screenId}`)}
                  className="w-full text-left flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs text-gray-800 font-medium truncate">{screen.screenName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-gray-400">기능 {screen.taskCount}개</span>
                    <svg className="w-3 h-3 text-gray-300 group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* Drill-down: feature -> related policies */}
        {relatedData?.type === 'feature' && relatedData.task && (() => {
          const relatedPolicies = currentResult?.policyChanges.filter((pc) =>
            pc.affectedFiles.some((f) => relatedData.task!.affectedFiles.includes(f)),
          ) ?? [];
          if (relatedPolicies.length === 0) return null;
          return (
            <Section title="관련 정책">
              <div className="space-y-1.5">
                {relatedPolicies.map((pc) => (
                  <div key={pc.id} className="flex items-start gap-2 text-xs px-2 py-1.5 bg-gray-50 rounded">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 mt-0.5 ${
                      pc.changeType === 'new' ? 'bg-green-100 text-green-700' :
                      pc.changeType === 'remove' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {pc.changeType}
                    </span>
                    <div>
                      <p className="text-gray-800 font-medium">{pc.policyName}</p>
                      <p className="text-gray-400 mt-0.5">{pc.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          );
        })()}

        {/* Confidence info - for system nodes */}
        {relatedData?.type === 'system' && relatedData.confidence && (
          <ConfidenceSection
            confidence={relatedData.confidence}
            lowWarning={relatedData.lowWarning ?? undefined}
          />
        )}

        {/* Owner info - for system nodes */}
        {relatedData?.type === 'system' && relatedData.ownerInfo && (
          <Section title="담당자 정보">
            <div className="text-xs space-y-1">
              <p className="text-gray-700">
                <span className="text-gray-500">팀:</span> {relatedData.ownerInfo.team}
              </p>
              <p className="text-gray-700">
                <span className="text-gray-500">담당자:</span> {relatedData.ownerInfo.ownerName}
              </p>
              <p className="text-gray-700">
                <span className="text-gray-500">이메일:</span> {relatedData.ownerInfo.ownerEmail}
              </p>
              {relatedData.ownerInfo.slackChannel && (
                <p className="text-gray-700">
                  <span className="text-gray-500">슬랙:</span> {relatedData.ownerInfo.slackChannel}
                </p>
              )}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

/** 섹션 래퍼 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

/** 화면 점수 분해 섹션 */
function ScoreBreakdownSection({ screenScore }: { screenScore: ScreenScore }) {
  // 모든 taskScore의 평균 점수를 dimensions별로 계산
  const avgScores = useMemo(() => {
    const tasks = screenScore.taskScores;
    if (tasks.length === 0) return null;

    const sum = { dev: 0, impact: 0, policy: 0, dep: 0 };
    for (const ts of tasks) {
      sum.dev += ts.scores.developmentComplexity.score;
      sum.impact += ts.scores.impactScope.score;
      sum.policy += ts.scores.policyChange.score;
      sum.dep += ts.scores.dependencyRisk.score;
    }

    const count = tasks.length;
    return {
      developmentComplexity: Math.round((sum.dev / count) * 10) / 10,
      impactScope: Math.round((sum.impact / count) * 10) / 10,
      policyChange: Math.round((sum.policy / count) * 10) / 10,
      dependencyRisk: Math.round((sum.dep / count) * 10) / 10,
    };
  }, [screenScore]);

  if (!avgScores) return null;

  return (
    <Section title="점수 분해 (평균)">
      <div className="space-y-2.5">
        <DimensionBar label="개발 복잡도" score={avgScores.developmentComplexity} max={10} />
        <DimensionBar label="영향 범위" score={avgScores.impactScope} max={10} />
        <DimensionBar label="정책 변경" score={avgScores.policyChange} max={10} />
        <DimensionBar label="의존성 위험도" score={avgScores.dependencyRisk} max={10} />
      </div>
    </Section>
  );
}

/** 작업 점수 분해 */
function TaskScoreBreakdown({ taskScore }: { taskScore: TaskScore }) {
  return (
    <Section title="점수 분해">
      <div className="space-y-2.5">
        <DimensionBar
          label="개발 복잡도"
          score={taskScore.scores.developmentComplexity.score}
          max={10}
          rationale={taskScore.scores.developmentComplexity.rationale}
        />
        <DimensionBar
          label="영향 범위"
          score={taskScore.scores.impactScope.score}
          max={10}
          rationale={taskScore.scores.impactScope.rationale}
        />
        <DimensionBar
          label="정책 변경"
          score={taskScore.scores.policyChange.score}
          max={10}
          rationale={taskScore.scores.policyChange.rationale}
        />
        <DimensionBar
          label="의존성 위험도"
          score={taskScore.scores.dependencyRisk.score}
          max={10}
          rationale={taskScore.scores.dependencyRisk.rationale}
        />
      </div>
    </Section>
  );
}

/** 차원별 점수 바 */
function DimensionBar({
  label,
  score,
  max,
  rationale,
}: {
  label: string;
  score: number;
  max: number;
  rationale?: string;
}) {
  const percent = Math.min(100, (score / max) * 100);
  const color =
    score <= 3 ? '#22C55E' : score <= 6 ? '#EAB308' : score <= 8 ? '#F97316' : '#EF4444';

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600">{label}</span>
        <span className="text-xs font-semibold text-gray-700">
          {score}/{max}
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
      {rationale && (
        <p className="text-[10px] text-gray-400 mt-0.5">{rationale}</p>
      )}
    </div>
  );
}

/** 신뢰도 섹션 */
function ConfidenceSection({
  confidence,
  lowWarning,
}: {
  confidence: SystemConfidence;
  lowWarning?: ConfidenceWarning;
}) {
  const overallPercent = Math.round(confidence.overallScore * 100);
  const gradeColor = CONFIDENCE_COLORS[confidence.grade as ConfidenceGrade] ?? '#94A3B8';

  return (
    <Section title="분석 신뢰도">
      <div className="space-y-3">
        {/* Overall score */}
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold" style={{ color: gradeColor }}>
            {overallPercent}%
          </span>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold"
            style={{
              backgroundColor: `${gradeColor}20`,
              color: gradeColor,
            }}
          >
            {confidence.grade}
          </span>
        </div>

        {/* Overall confidence bar */}
        <div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${overallPercent}%`,
                backgroundColor: gradeColor,
              }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">
            계층별 상세 신뢰도 정보 없음
          </p>
        </div>

        {/* Warnings */}
        {confidence.warnings.length > 0 && (
          <div className="space-y-1">
            {confidence.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[11px]">
                <svg className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-gray-600">{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Recommendations */}
        {confidence.recommendations.length > 0 && (
          <div className="space-y-1">
            {confidence.recommendations.map((r, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[11px]">
                <svg className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-gray-600">{r}</span>
              </div>
            ))}
          </div>
        )}

        {/* Low confidence warning */}
        {lowWarning && (
          <div className="bg-red-50 rounded-lg p-2.5 border border-red-200">
            <p className="text-[11px] text-red-700 font-medium">
              {lowWarning.reason}
            </p>
            <p className="text-[11px] text-red-600 mt-1">
              필요 조치: {lowWarning.action}
            </p>
          </div>
        )}
      </div>
    </Section>
  );
}

export default DetailPanel;
