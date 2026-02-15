/**
 * @module web/components/tickets/DependencyDiagram
 * @description 티켓 간 의존 관계 다이어그램 (HTML/CSS 기반)
 */

import type { Task, ScreenImpact } from '../../types';

interface DependencyDiagramProps {
  /** 작업 목록 */
  tasks: Task[];
  /** 화면 목록 */
  screens: ScreenImpact[];
}

/** 의존 관계 연결 */
interface DependencyLink {
  from: string;
  to: string;
  reason: string;
}

function DependencyDiagram({ tasks, screens }: DependencyDiagramProps) {
  // 의존 관계 계산: 같은 API를 사용하는 작업 간 연결
  const links: DependencyLink[] = [];
  const apiToTasks = new Map<string, string[]>();

  for (const task of tasks) {
    for (const api of task.relatedApis) {
      if (!apiToTasks.has(api)) {
        apiToTasks.set(api, []);
      }
      apiToTasks.get(api)!.push(task.id);
    }
  }

  // 같은 API를 사용하는 작업 쌍 연결
  for (const [api, taskIds] of apiToTasks) {
    for (let i = 0; i < taskIds.length; i++) {
      for (let j = i + 1; j < taskIds.length; j++) {
        links.push({
          from: taskIds[i],
          to: taskIds[j],
          reason: `공유 API: ${api}`,
        });
      }
    }
  }

  // 같은 화면의 작업 간 연결
  for (const screen of screens) {
    if (screen.tasks.length > 1) {
      for (let i = 0; i < screen.tasks.length; i++) {
        for (let j = i + 1; j < screen.tasks.length; j++) {
          const exists = links.some(
            (l) =>
              (l.from === screen.tasks[i].id && l.to === screen.tasks[j].id) ||
              (l.from === screen.tasks[j].id && l.to === screen.tasks[i].id),
          );
          if (!exists) {
            links.push({
              from: screen.tasks[i].id,
              to: screen.tasks[j].id,
              reason: `같은 화면: ${screen.screenName}`,
            });
          }
        }
      }
    }
  }

  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  if (links.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">
          작업 간 의존 관계
        </h3>
        <p className="text-xs text-gray-400">의존 관계가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">
        작업 간 의존 관계
      </h3>
      <div className="space-y-2">
        {links.map((link, idx) => {
          const fromTask = taskMap.get(link.from);
          const toTask = taskMap.get(link.to);
          if (!fromTask || !toTask) return null;

          return (
            <div
              key={idx}
              className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg p-2.5"
            >
              {/* From */}
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  fromTask.type === 'FE'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {fromTask.type}
              </span>
              <span className="text-gray-800 font-medium truncate max-w-[120px]">
                {fromTask.title}
              </span>

              {/* Arrow */}
              <span className="text-gray-300 flex items-center shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4"
                  />
                </svg>
                <svg className="w-4 h-4 -ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 17l-4 4m0 0l-4-4m4 4V3"
                  />
                </svg>
              </span>

              {/* To */}
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  toTask.type === 'FE'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {toTask.type}
              </span>
              <span className="text-gray-800 font-medium truncate max-w-[120px]">
                {toTask.title}
              </span>

              {/* Reason */}
              <span className="ml-auto text-gray-400 whitespace-nowrap">
                {link.reason}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DependencyDiagram;
