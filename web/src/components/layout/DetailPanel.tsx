/**
 * @module web/components/layout/DetailPanel
 * @description 우측 상세 패널 - FlowChart 노드 선택 시 상세 정보 표시
 * 400px 고정 너비, 우측 슬라이드-인 애니메이션, 내부 스크롤
 */

import { useMemo } from 'react';
import type { Node } from '@xyflow/react';
import { useResultStore } from '../../stores/resultStore';
import { GRADE_COLORS, CONFIDENCE_COLORS } from '../../utils/colors';
import type {
  Grade,
  ConfidenceGrade,
  TaskScore,
  ScreenScore,
  SystemConfidence,
  ConfidenceWarning,
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
          (t) => t.planningChecks.some((pc) => c.content.includes(pc.substring(0, 10))),
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
        (c) => task?.planningChecks.some((pc) => c.content.includes(pc.substring(0, 10))),
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

      return {
        type: 'system' as const,
        confidence,
        lowWarning,
        ownerInfo,
      };
    }

    return null;
  }, [currentResult, node.id, nodeType]);

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
        {/* Score Breakdown - for screen/feature nodes with score data */}
        {relatedData?.type === 'screen' && relatedData.screenScore && (
          <ScoreBreakdownSection screenScore={relatedData.screenScore} />
        )}

        {relatedData?.type === 'feature' && relatedData.taskScore && (
          <TaskScoreBreakdown taskScore={relatedData.taskScore} />
        )}

        {/* Tasks list - for screen nodes */}
        {relatedData?.type === 'screen' && relatedData.tasks.length > 0 && (
          <Section title="작업 항목">
            <div className="space-y-2">
              {relatedData.tasks.map((task) => (
                <div key={task.id} className="flex items-start gap-2 text-xs">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 mt-0.5 ${
                      task.type === 'FE'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {task.type}
                  </span>
                  <div>
                    <p className="text-gray-800 font-medium">{task.title}</p>
                    <p className="text-gray-400 mt-0.5">{task.description}</p>
                  </div>
                </div>
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
