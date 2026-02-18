/**
 * @module web/components/tickets/TicketDetail
 * @description 작업 티켓 상세 패널 컴포넌트 - 우측 사이드바로 점수 분석, 설명, 영향 파일 등 표시
 */

import type { Task, TaskScore } from '../../types';
import { GRADE_COLORS } from '../../utils/colors';
import { getGradeFromScore } from '../../utils/gradeUtils';

interface TicketDetailProps {
  /** 작업 데이터 */
  task: Task | null;
  /** 작업 점수 */
  taskScore?: TaskScore;
  /** 소속 화면 이름 */
  screenName?: string;
  /** 닫기 핸들러 */
  onClose: () => void;
}

/** 작업 유형 한국어 라벨 */
const ACTION_TYPE_LABELS: Record<string, string> = {
  new: '신규 개발',
  modify: '기존 수정',
  config: '설정 변경',
};

/** 점수 차원 한국어 라벨 */
const SCORE_DIMENSION_LABELS: Record<string, string> = {
  developmentComplexity: '개발 복잡도',
  impactScope: '영향 범위',
  policyChange: '정책 변경',
  dependencyRisk: '의존성 위험',
};

/** 섹션 제목 */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
      {children}
    </h4>
  );
}

/** 점수 바 (상세용 - weight와 rationale 포함) */
function DetailScoreBar({
  label,
  score,
  weight,
  rationale,
}: {
  label: string;
  score: number;
  weight: number;
  rationale: string;
}) {
  const percent = Math.min(100, (score / 10) * 100);
  const color =
    score <= 3 ? '#22C55E' : score <= 6 ? '#EAB308' : score <= 8 ? '#F97316' : '#EF4444';

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-700 font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">({Math.round(weight * 100)}%)</span>
          <span className="font-bold" style={{ color }}>
            {score}/10
          </span>
        </div>
      </div>
      <div className="bg-gray-100 rounded-full h-1.5">
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-[10px] text-gray-400">{rationale}</p>
    </div>
  );
}

function TicketDetail({ task, taskScore, screenName, onClose }: TicketDetailProps) {
  if (!task) return null;

  const score = taskScore?.totalScore ?? 0;
  const grade = taskScore?.grade ?? getGradeFromScore(score);
  const gradeColors = GRADE_COLORS[grade];

  return (
    <div className="w-[400px] shrink-0" data-testid="ticket-detail">
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 sticky top-20 max-h-[calc(100vh-140px)] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {/* FE/BE badge */}
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold shrink-0 ${
                  task.type === 'FE'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {task.type}
              </span>
              {/* actionType badge */}
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 shrink-0">
                {ACTION_TYPE_LABELS[task.actionType] ?? task.actionType}
              </span>
              {/* grade badge */}
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0"
                style={{
                  backgroundColor: gradeColors.bg,
                  color: gradeColors.text,
                  border: `1px solid ${gradeColors.border}`,
                }}
              >
                {grade}
              </span>
            </div>
            <h3 className="text-sm font-bold text-gray-900">{task.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 transition-colors shrink-0"
            aria-label="패널 닫기"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Screen name */}
          {screenName && (
            <div>
              <p className="text-xs text-gray-500">화면</p>
              <p className="text-sm text-gray-700">{screenName}</p>
            </div>
          )}

          {/* Score section */}
          {taskScore && (
            <div>
              <SectionTitle>
                점수 분석
                <span className="ml-auto text-sm font-bold" style={{ color: gradeColors.text }}>
                  {taskScore.totalScore}점
                </span>
              </SectionTitle>
              <div className="space-y-2.5" data-testid="score-breakdown">
                {(
                  Object.entries(taskScore.scores) as [
                    keyof typeof taskScore.scores,
                    typeof taskScore.scores.developmentComplexity,
                  ][]
                ).map(([key, dim]) => (
                  <DetailScoreBar
                    key={key}
                    label={SCORE_DIMENSION_LABELS[key] ?? key}
                    score={dim.score}
                    weight={dim.weight}
                    rationale={dim.rationale}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <SectionTitle>설명</SectionTitle>
            <p className="text-xs text-gray-600 leading-relaxed">{task.description}</p>
          </div>

          {/* Rationale */}
          {task.rationale && (
            <div>
              <SectionTitle>분석 근거</SectionTitle>
              <p className="text-xs text-gray-600 leading-relaxed">{task.rationale}</p>
            </div>
          )}

          {/* Affected Files */}
          {task.affectedFiles.length > 0 && (
            <div>
              <SectionTitle>영향 파일 ({task.affectedFiles.length})</SectionTitle>
              <div className="space-y-0.5" data-testid="affected-files">
                {task.affectedFiles.map((file) => (
                  <p
                    key={file}
                    className="text-[11px] text-gray-500 font-mono truncate"
                    title={file}
                  >
                    {file}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Related APIs */}
          {task.relatedApis.length > 0 && (
            <div>
              <SectionTitle>관련 API ({task.relatedApis.length})</SectionTitle>
              <div className="space-y-0.5" data-testid="related-apis">
                {task.relatedApis.map((api) => (
                  <p
                    key={api}
                    className="text-[11px] text-purple-600 font-mono"
                  >
                    {api}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Planning Checks */}
          {task.planningChecks.length > 0 && (
            <div>
              <SectionTitle>기획 확인 사항 ({task.planningChecks.length})</SectionTitle>
              <div className="space-y-1" data-testid="planning-checks">
                {task.planningChecks.map((check, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-1.5 text-[11px] text-gray-600"
                  >
                    <svg
                      className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                    <span>{check}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Traceability */}
          {((task.sourceRequirementIds && task.sourceRequirementIds.length > 0) ||
            (task.sourceFeatureIds && task.sourceFeatureIds.length > 0)) && (
            <div>
              <SectionTitle>추적성</SectionTitle>
              <div className="space-y-1.5" data-testid="traceability">
                {task.sourceRequirementIds && task.sourceRequirementIds.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">요구사항</p>
                    <div className="flex flex-wrap gap-1">
                      {task.sourceRequirementIds.map((id) => (
                        <span
                          key={id}
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-200"
                        >
                          {id}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {task.sourceFeatureIds && task.sourceFeatureIds.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">기능</p>
                    <div className="flex flex-wrap gap-1">
                      {task.sourceFeatureIds.map((id) => (
                        <span
                          key={id}
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-50 text-teal-600 border border-teal-200"
                        >
                          {id}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TicketDetail;
