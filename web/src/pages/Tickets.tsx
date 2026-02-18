/**
 * @module web/pages/Tickets
 * @description 작업 티켓 목록 페이지 - FE/BE 필터, 등급 필터, 요구사항 필터, 검색
 */

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useResultStore } from '../stores/resultStore';
import { useEnsureResult } from '../hooks/useEnsureResult';
import { GRADE_COLORS } from '../utils/colors';
import type { Grade, TaskType, TaskScore } from '../types';
import TicketCard from '../components/tickets/TicketCard';
import TicketDetail from '../components/tickets/TicketDetail';
import DependencyDiagram from '../components/tickets/DependencyDiagram';

/** 필터 상태 */
interface TicketFilter {
  typeFilter: 'all' | TaskType;
  gradeFilter: Grade | 'all';
  requirementFilter: string;
  searchQuery: string;
}

function Tickets() {
  useEnsureResult();
  const currentResult = useResultStore((s) => s.currentResult);

  const [searchParams, setSearchParams] = useSearchParams();
  const initialType = searchParams.get('type');
  const initialRequirement = searchParams.get('requirement');

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const [filter, setFilter] = useState<TicketFilter>({
    typeFilter:
      initialType && ['FE', 'BE'].includes(initialType)
        ? (initialType as TaskType)
        : 'all',
    gradeFilter: 'all',
    requirementFilter: initialRequirement ?? 'all',
    searchQuery: '',
  });

  // 요구사항 목록 (드롭다운 옵션)
  const requirements = useMemo(() => {
    return currentResult?.parsedSpec?.requirements ?? [];
  }, [currentResult]);

  // 요구사항 필터 변경 핸들러 (URL 파라미터 동기화)
  const handleRequirementChange = useCallback(
    (value: string) => {
      setFilter((f) => ({ ...f, requirementFilter: value }));
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value === 'all') {
          next.delete('requirement');
        } else {
          next.set('requirement', value);
        }
        return next;
      });
    },
    [setSearchParams],
  );

  // 작업별 점수 맵 생성
  const taskScoreMap = useMemo(() => {
    const map = new Map<string, TaskScore>();
    if (!currentResult) return map;
    for (const ss of currentResult.screenScores) {
      for (const ts of ss.taskScores) {
        map.set(ts.taskId, ts);
      }
    }
    return map;
  }, [currentResult]);

  // 작업별 화면 이름 맵
  const taskScreenMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!currentResult) return map;
    for (const screen of currentResult.affectedScreens) {
      for (const task of screen.tasks) {
        map.set(task.id, screen.screenName);
      }
    }
    return map;
  }, [currentResult]);

  // 선택된 작업 데이터
  const selectedTask = useMemo(() => {
    if (!selectedTaskId || !currentResult) return null;
    return currentResult.tasks.find((t) => t.id === selectedTaskId) ?? null;
  }, [selectedTaskId, currentResult]);

  // 카드 선택 핸들러 (토글)
  const handleSelectTask = useCallback((taskId: string) => {
    setSelectedTaskId((prev) => (prev === taskId ? null : taskId));
  }, []);

  // 필터링된 작업 목록
  const filteredTasks = useMemo(() => {
    if (!currentResult) return [];

    return currentResult.tasks.filter((task) => {
      // Type filter
      if (filter.typeFilter !== 'all' && task.type !== filter.typeFilter) return false;

      // Grade filter
      if (filter.gradeFilter !== 'all') {
        const ts = taskScoreMap.get(task.id);
        if (ts && ts.grade !== filter.gradeFilter) return false;
      }

      // Requirement filter
      if (filter.requirementFilter !== 'all') {
        if (!task.sourceRequirementIds?.includes(filter.requirementFilter)) return false;
      }

      // Search filter
      if (filter.searchQuery) {
        const q = filter.searchQuery.toLowerCase();
        const matches =
          task.title.toLowerCase().includes(q) ||
          task.description.toLowerCase().includes(q) ||
          task.affectedFiles.some((f) => f.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [currentResult, filter, taskScoreMap]);

  // Summary stats
  const stats = useMemo(() => {
    if (!currentResult) return { total: 0, fe: 0, be: 0, grades: {} as Record<Grade, number> };

    const tasks = currentResult.tasks;
    const fe = tasks.filter((t) => t.type === 'FE').length;
    const be = tasks.filter((t) => t.type === 'BE').length;

    const grades: Record<Grade, number> = { Low: 0, Medium: 0, High: 0, Critical: 0 };
    for (const task of tasks) {
      const ts = taskScoreMap.get(task.id);
      if (ts) {
        grades[ts.grade] = (grades[ts.grade] || 0) + 1;
      }
    }

    return { total: tasks.length, fe, be, grades };
  }, [currentResult, taskScoreMap]);

  if (!currentResult) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-400">데이터 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            작업 티켓 목록
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {currentResult.specTitle}
          </p>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-900">{stats.total}</span>
              <span className="text-sm text-gray-600">총 티켓</span>
            </div>
            <div className="h-8 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-blue-600">{stats.fe}</span>
              <span className="text-sm text-gray-600">FE</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-green-600">{stats.be}</span>
              <span className="text-sm text-gray-600">BE</span>
            </div>
            <div className="h-8 w-px bg-gray-200" />
            {/* Grade distribution */}
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

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Type filter */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500 mr-1">유형:</span>
              {(['all', 'FE', 'BE'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilter((f) => ({ ...f, typeFilter: type }))}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    filter.typeFilter === type
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {type === 'all' ? '전체' : type}
                </button>
              ))}
            </div>

            {/* Grade filter */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500 mr-1">등급:</span>
              <button
                onClick={() => setFilter((f) => ({ ...f, gradeFilter: 'all' }))}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  filter.gradeFilter === 'all'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                전체
              </button>
              {(['Low', 'Medium', 'High', 'Critical'] as Grade[]).map((grade) => (
                <button
                  key={grade}
                  onClick={() => setFilter((f) => ({ ...f, gradeFilter: grade }))}
                  className="px-3 py-1 rounded text-xs font-medium transition-colors"
                  style={
                    filter.gradeFilter === grade
                      ? {
                          backgroundColor: GRADE_COLORS[grade].bg,
                          color: GRADE_COLORS[grade].text,
                          border: `1px solid ${GRADE_COLORS[grade].border}`,
                        }
                      : {
                          backgroundColor: '#F3F4F6',
                          color: '#4B5563',
                        }
                  }
                >
                  {grade}
                </button>
              ))}
            </div>

            {/* Requirement filter */}
            {requirements.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500 mr-1">요구사항별:</span>
                <select
                  data-testid="requirement-filter-select"
                  value={filter.requirementFilter}
                  onChange={(e) => handleRequirementChange(e.target.value)}
                  className={`px-2 py-1 rounded text-xs font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    filter.requirementFilter !== 'all'
                      ? 'bg-purple-100 text-purple-700 border-purple-300'
                      : 'bg-gray-100 text-gray-600 border-gray-200'
                  }`}
                >
                  <option value="all">전체</option>
                  {requirements.map((req) => (
                    <option key={req.id} value={req.id}>
                      {req.id}: {req.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="작업명, 파일 경로 검색..."
                value={filter.searchQuery}
                onChange={(e) => setFilter((f) => ({ ...f, searchQuery: e.target.value }))}
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Dependency diagram */}
        <DependencyDiagram
          tasks={currentResult.tasks}
          screens={currentResult.affectedScreens}
        />

        {/* Ticket grid */}
        {filteredTasks.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            조건에 맞는 티켓이 없습니다.
          </div>
        ) : (
          <div className={`grid gap-4 ${
            selectedTask
              ? 'grid-cols-1 md:grid-cols-2'
              : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
          }`}>
            {filteredTasks.map((task) => (
              <TicketCard
                key={task.id}
                task={task}
                taskScore={taskScoreMap.get(task.id)}
                screenName={taskScreenMap.get(task.id) ?? ''}
                selected={selectedTaskId === task.id}
                onSelect={handleSelectTask}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedTask && (
        <TicketDetail
          task={selectedTask}
          taskScore={taskScoreMap.get(selectedTask.id)}
          screenName={taskScreenMap.get(selectedTask.id) ?? ''}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}

export default Tickets;
