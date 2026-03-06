/**
 * @module web/utils/ticketGrouper
 * @description Epic 계층화 유틸리티 - affectedScreens 기반 Epic 자동 생성
 */

import type { ScreenImpact, Task, TaskScore, Grade } from '../types';
import { getGradeFromScore } from './gradeUtils';

/** Epic 내 Task (점수 정보 포함) */
export interface EpicTask {
  task: Task;
  taskScore?: TaskScore;
}

/** Epic (화면 기반 그룹) */
export interface Epic {
  /** Epic ID (screenId 기반) */
  id: string;
  /** Epic 이름 (screenName) */
  name: string;
  /** 영향도 수준 */
  impactLevel: ScreenImpact['impactLevel'];
  /** 하위 Task 목록 */
  tasks: EpicTask[];
  /** FE Task 수 */
  feCount: number;
  /** BE Task 수 */
  beCount: number;
  /** 평균 점수 */
  avgScore: number;
  /** 평균 등급 */
  avgGrade: Grade;
  /** 총 점수 (정렬용) */
  totalScore: number;
}

/**
 * affectedScreens와 tasks 데이터를 기반으로 Epic 배열 생성
 *
 * 로직:
 * 1. affectedScreens의 각 screen을 Epic으로 매핑
 * 2. screen.tasks를 Epic 하위 Task로 배치
 * 3. 각 Epic 내에서 FE 먼저, 그 다음 BE, 점수 내림차순 정렬
 * 4. Epic은 총 점수 내림차순 정렬
 */
export function groupTasksIntoEpics(
  affectedScreens: ScreenImpact[],
  taskScoreMap: Map<string, TaskScore>,
): Epic[] {
  const epics: Epic[] = affectedScreens.map((screen) => {
    const epicTasks: EpicTask[] = screen.tasks.map((task) => ({
      task,
      taskScore: taskScoreMap.get(task.id),
    }));

    // Sort: FE first, then BE, then by score descending
    epicTasks.sort((a, b) => {
      // FE before BE
      if (a.task.type !== b.task.type) {
        return a.task.type === 'FE' ? -1 : 1;
      }
      // Higher score first
      const scoreA = a.taskScore?.totalScore ?? 0;
      const scoreB = b.taskScore?.totalScore ?? 0;
      return scoreB - scoreA;
    });

    const feCount = epicTasks.filter((t) => t.task.type === 'FE').length;
    const beCount = epicTasks.filter((t) => t.task.type === 'BE').length;

    const scores = epicTasks.map((t) => t.taskScore?.totalScore ?? 0);
    const totalScore = scores.reduce((sum, s) => sum + s, 0);
    const avgScore = epicTasks.length > 0 ? Math.round((totalScore / epicTasks.length) * 10) / 10 : 0;
    const avgGrade = getGradeFromScore(avgScore);

    return {
      id: screen.screenId,
      name: screen.screenName,
      impactLevel: screen.impactLevel,
      tasks: epicTasks,
      feCount,
      beCount,
      avgScore,
      avgGrade,
      totalScore,
    };
  });

  // Sort epics by total score descending
  epics.sort((a, b) => b.totalScore - a.totalScore);

  return epics;
}

/**
 * 필터가 적용된 Epic 목록 생성
 * - 필터 적용 후 빈 Epic은 제외
 * - Epic 내 task count를 "filteredCount / totalCount" 형식으로 표시 가능
 */
export function filterEpics(
  epics: Epic[],
  filteredTaskIds: Set<string>,
): Epic[] {
  return epics
    .map((epic) => {
      const filteredTasks = epic.tasks.filter((et) =>
        filteredTaskIds.has(et.task.id),
      );

      if (filteredTasks.length === 0) return null;

      const feCount = filteredTasks.filter((t) => t.task.type === 'FE').length;
      const beCount = filteredTasks.filter((t) => t.task.type === 'BE').length;
      const scores = filteredTasks.map((t) => t.taskScore?.totalScore ?? 0);
      const totalScore = scores.reduce((sum, s) => sum + s, 0);
      const avgScore = filteredTasks.length > 0 ? Math.round((totalScore / filteredTasks.length) * 10) / 10 : 0;
      const avgGrade = getGradeFromScore(avgScore);

      return {
        ...epic,
        tasks: filteredTasks,
        feCount,
        beCount,
        avgScore,
        avgGrade,
        totalScore,
      };
    })
    .filter((epic): epic is Epic => epic !== null);
}
