/**
 * @module web/components/tickets/EpicCard
 * @description Epic 카드 컴포넌트 - 접힘/펼침 토글, 하위 Task 카드 표시
 */

import { useState } from 'react';
import type { Epic } from '../../utils/ticketGrouper';
import { GRADE_COLORS } from '../../utils/colors';
import TicketCard from './TicketCard';

interface EpicCardProps {
  /** Epic 데이터 */
  epic: Epic;
  /** 원본 Epic의 전체 Task 수 (필터 적용 전) */
  originalTaskCount?: number;
  /** 선택된 Task ID */
  selectedTaskId: string | null;
  /** Task 선택 핸들러 */
  onSelectTask: (taskId: string) => void;
  /** 초기 펼침 여부 */
  defaultExpanded?: boolean;
}

function EpicCard({
  epic,
  originalTaskCount,
  selectedTaskId,
  onSelectTask,
  defaultExpanded = true,
}: EpicCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const gradeColors = GRADE_COLORS[epic.avgGrade];
  const showFilteredCount = originalTaskCount != null && originalTaskCount !== epic.tasks.length;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Epic Header - clickable to toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors text-left"
        aria-expanded={expanded}
        aria-label={`Epic: ${epic.name}`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Expand/Collapse chevron */}
          <svg
            className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>

          {/* Epic name */}
          <h3 className="text-sm font-bold text-gray-900 truncate">{epic.name}</h3>

          {/* Task count */}
          <span className="text-xs text-gray-500 shrink-0">
            {showFilteredCount
              ? `${epic.tasks.length}/${originalTaskCount} tasks`
              : `${epic.tasks.length} tasks`}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* FE/BE counts */}
          {epic.feCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
              FE: {epic.feCount}
            </span>
          )}
          {epic.beCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">
              BE: {epic.beCount}
            </span>
          )}

          {/* Avg score + grade */}
          <span className="text-xs font-medium text-gray-500">
            Avg {epic.avgScore}
          </span>
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold"
            style={{
              backgroundColor: gradeColors.bg,
              color: gradeColors.text,
              border: `1px solid ${gradeColors.border}`,
            }}
          >
            {epic.avgGrade}
          </span>
        </div>
      </button>

      {/* Task list (expanded) */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-3 space-y-3 bg-gray-50/50">
          {epic.tasks.map((epicTask) => (
            <TicketCard
              key={epicTask.task.id}
              task={epicTask.task}
              taskScore={epicTask.taskScore}
              screenName={epic.name}
              selected={selectedTaskId === epicTask.task.id}
              onSelect={onSelectTask}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default EpicCard;
