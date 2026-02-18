/**
 * @module web/components/tickets/TicketCard
 * @description 작업 티켓 카드 컴포넌트
 */

import { useState } from 'react';
import type { Task, TaskScore } from '../../types';
import { GRADE_COLORS } from '../../utils/colors';
import { getGradeFromScore } from '../../utils/gradeUtils';

interface TicketCardProps {
  /** 작업 데이터 */
  task: Task;
  /** 작업 점수 */
  taskScore?: TaskScore;
  /** 소속 화면 이름 */
  screenName: string;
  /** 선택 여부 */
  selected?: boolean;
  /** 카드 선택 핸들러 */
  onSelect?: (taskId: string) => void;
}

/** 작업 유형 한국어 라벨 */
const ACTION_TYPE_LABELS: Record<string, string> = {
  new: '신규 개발',
  modify: '기존 수정',
  config: '설정 변경',
};

function TicketCard({ task, taskScore, screenName, selected, onSelect }: TicketCardProps) {
  const [showFiles, setShowFiles] = useState(false);

  const score = taskScore?.totalScore ?? 0;
  const grade = taskScore?.grade ?? getGradeFromScore(score);
  const gradeColors = GRADE_COLORS[grade];

  return (
    <div
      className={`bg-white rounded-lg border p-4 transition-shadow cursor-pointer ${
        selected
          ? 'border-purple-400 ring-2 ring-purple-200 shadow-md'
          : 'border-gray-200 hover:shadow-md'
      }`}
      onClick={() => onSelect?.(task.id)}
      data-testid={`ticket-card-${task.id}`}
    >
      {/* Header: Type badge + Task name */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
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
          <h3 className="text-sm font-semibold text-gray-900 truncate">
            {task.title}
          </h3>
        </div>

        {/* Score + grade badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-sm font-bold" style={{ color: gradeColors.text }}>
            {score}
          </span>
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold"
            style={{
              backgroundColor: gradeColors.bg,
              color: gradeColors.text,
              border: `1px solid ${gradeColors.border}`,
            }}
          >
            {grade}
          </span>
        </div>
      </div>

      {/* Work type + Screen */}
      <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
          {ACTION_TYPE_LABELS[task.actionType] ?? task.actionType}
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          {screenName}
        </span>
      </div>

      {/* Description */}
      <p className="mt-2 text-xs text-gray-600 leading-relaxed">
        {task.description}
      </p>

      {/* Score breakdown bars (if available) */}
      {taskScore && (
        <div className="mt-3 space-y-1.5">
          <ScoreBar label="개발 복잡도" score={taskScore.scores.developmentComplexity.score} />
          <ScoreBar label="영향 범위" score={taskScore.scores.impactScope.score} />
          <ScoreBar label="정책 변경" score={taskScore.scores.policyChange.score} />
          <ScoreBar label="의존성 위험" score={taskScore.scores.dependencyRisk.score} />
        </div>
      )}

      {/* Affected files (collapsible) */}
      {task.affectedFiles.length > 0 && (
        <div className="mt-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowFiles(!showFiles);
            }}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <svg
              className={`w-3 h-3 transition-transform ${showFiles ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            영향 파일 ({task.affectedFiles.length})
          </button>
          {showFiles && (
            <div className="mt-1.5 space-y-0.5">
              {task.affectedFiles.map((file) => (
                <p key={file} className="text-[11px] text-gray-500 font-mono pl-4">
                  {file}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 점수 바 미니 컴포넌트 */
function ScoreBar({ label, score }: { label: string; score: number }) {
  const percent = Math.min(100, (score / 10) * 100);
  const color =
    score <= 3 ? '#22C55E' : score <= 6 ? '#EAB308' : score <= 8 ? '#F97316' : '#EF4444';

  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="text-gray-500 w-16 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-gray-500 w-6 text-right">{score}</span>
    </div>
  );
}

export default TicketCard;
