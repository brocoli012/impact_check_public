/**
 * @module web/components/tickets/TicketHierarchy
 * @description 티켓 계층 뷰 - Epic > Task 트리 렌더링
 */

import { useMemo } from 'react';
import type { ScreenImpact, Task, TaskScore, Grade } from '../../types';
import { groupTasksIntoEpics, filterEpics } from '../../utils/ticketGrouper';
import { GRADE_COLORS } from '../../utils/colors';
import EpicCard from './EpicCard';

interface TicketHierarchyProps {
  /** 화면 영향도 목록 */
  affectedScreens: ScreenImpact[];
  /** 필터링된 Task 목록 */
  filteredTasks: Task[];
  /** Task 점수 맵 */
  taskScoreMap: Map<string, TaskScore>;
  /** 선택된 Task ID */
  selectedTaskId: string | null;
  /** Task 선택 핸들러 */
  onSelectTask: (taskId: string) => void;
}

function TicketHierarchy({
  affectedScreens,
  filteredTasks,
  taskScoreMap,
  selectedTaskId,
  onSelectTask,
}: TicketHierarchyProps) {
  // Build all epics (unfiltered)
  const allEpics = useMemo(
    () => groupTasksIntoEpics(affectedScreens, taskScoreMap),
    [affectedScreens, taskScoreMap],
  );

  // Original task count per epic (for "N/M tasks shown")
  const originalTaskCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const epic of allEpics) {
      map.set(epic.id, epic.tasks.length);
    }
    return map;
  }, [allEpics]);

  // Filtered epics
  const filteredTaskIds = useMemo(
    () => new Set(filteredTasks.map((t) => t.id)),
    [filteredTasks],
  );

  const epics = useMemo(
    () => filterEpics(allEpics, filteredTaskIds),
    [allEpics, filteredTaskIds],
  );

  // Summary stats
  const stats = useMemo(() => {
    const feCount = filteredTasks.filter((t) => t.type === 'FE').length;
    const beCount = filteredTasks.filter((t) => t.type === 'BE').length;
    const grades: Record<Grade, number> = { Low: 0, Medium: 0, High: 0, Critical: 0 };
    for (const task of filteredTasks) {
      const ts = taskScoreMap.get(task.id);
      if (ts) {
        grades[ts.grade] = (grades[ts.grade] || 0) + 1;
      }
    }
    return { epicCount: epics.length, feCount, beCount, total: filteredTasks.length, grades };
  }, [epics, filteredTasks, taskScoreMap]);

  if (epics.length === 0) {
    return (
      <div className="text-center text-gray-400 py-12">
        조건에 맞는 티켓이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Project summary header */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-purple-600">{stats.epicCount}</span>
            <span className="text-sm text-gray-600">Epic</span>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-blue-600">{stats.feCount}</span>
            <span className="text-sm text-gray-600">FE</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-green-600">{stats.beCount}</span>
            <span className="text-sm text-gray-600">BE</span>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-gray-900">{stats.total}</span>
            <span className="text-sm text-gray-600">Total</span>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          {(Object.entries(stats.grades) as [Grade, number][]).map(([grade, count]) =>
            count > 0 ? (
              <span
                key={grade}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: GRADE_COLORS[grade].bg,
                  color: GRADE_COLORS[grade].text,
                  border: `1px solid ${GRADE_COLORS[grade].border}`,
                }}
              >
                {grade}: {count}
              </span>
            ) : null,
          )}
        </div>
      </div>

      {/* Epic cards */}
      {epics.map((epic) => (
        <EpicCard
          key={epic.id}
          epic={epic}
          originalTaskCount={originalTaskCounts.get(epic.id)}
          selectedTaskId={selectedTaskId}
          onSelectTask={onSelectTask}
          defaultExpanded
        />
      ))}
    </div>
  );
}

export default TicketHierarchy;
