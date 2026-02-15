/**
 * @module web/hooks/useOwners
 * @description 담당자 알림 데이터 훅 - owner notifications에서 데이터 추출 및 이메일 초안 생성
 */

import { useMemo } from 'react';
import { useResultStore } from '../stores/resultStore';
import type { OwnerNotification, Task } from '../types';

/** 확장된 담당자 정보 */
export interface OwnerInfo extends OwnerNotification {
  /** 관련 작업 목록 */
  relatedTasks: Task[];
  /** 영향받는 화면 목록 */
  affectedScreens: string[];
  /** 생성된 이메일 초안 */
  generatedEmailDraft: string;
}

/** useOwners 훅 반환 타입 */
export interface UseOwnersReturn {
  /** 담당자 목록 */
  owners: OwnerInfo[];
  /** 전체 팀 수 */
  totalTeams: number;
  /** 기획서 제목 */
  specTitle: string;
}

/**
 * 담당자 알림 데이터를 가공하여 반환하는 커스텀 훅
 */
export function useOwners(): UseOwnersReturn {
  const currentResult = useResultStore((s) => s.currentResult);

  const owners = useMemo<OwnerInfo[]>(() => {
    if (!currentResult) return [];

    const allTasks = currentResult.tasks;
    const allScreens = currentResult.affectedScreens;
    const specTitle = currentResult.specTitle;

    return currentResult.ownerNotifications.map((notification) => {
      // 관련 작업 찾기
      const relatedTasks = allTasks.filter((t) =>
        notification.relatedTaskIds.includes(t.id),
      );

      // 영향받는 화면 찾기
      const affectedScreens: string[] = [];
      for (const screen of allScreens) {
        const hasRelatedTask = screen.tasks.some((t) =>
          notification.relatedTaskIds.includes(t.id),
        );
        if (hasRelatedTask) {
          affectedScreens.push(screen.screenName);
        }
      }

      // 이메일 초안 생성
      const generatedEmailDraft = generateEmailDraft(
        specTitle,
        notification,
        relatedTasks,
        affectedScreens,
      );

      return {
        ...notification,
        relatedTasks,
        affectedScreens,
        generatedEmailDraft,
      };
    });
  }, [currentResult]);

  const totalTeams = useMemo(() => {
    const teams = new Set(owners.map((o) => o.team));
    return teams.size;
  }, [owners]);

  return {
    owners,
    totalTeams,
    specTitle: currentResult?.specTitle ?? '',
  };
}

/**
 * 이메일 초안 텍스트 생성
 */
function generateEmailDraft(
  specTitle: string,
  owner: OwnerNotification,
  tasks: Task[],
  _screens: string[],
): string {
  const taskList = tasks
    .map((t, i) => `  ${i + 1}. [${t.type}] ${t.title} - ${t.description}`)
    .join('\n');

  const screenList = _screens.map((s) => `  - ${s}`).join('\n');

  return `안녕하세요, ${owner.ownerName}님.

"${specTitle}" 기획에 대한 영향도 분석 결과, ${owner.systemName} (${owner.team})에 영향이 확인되어 공유드립니다.

[확인 필요 작업]
${taskList}

[영향받는 화면]
${screenList}

해당 내용 검토 후 확인 부탁드립니다.
문의 사항이 있으시면 회신 또는 ${owner.slackChannel ?? '슬랙 채널'}로 연락 부탁드립니다.

감사합니다.`;
}
