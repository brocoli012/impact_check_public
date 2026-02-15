/**
 * @module core/analysis/owner-mapper
 * @description 담당자 매퍼 - 영향 받는 시스템의 담당자 매핑
 */

import {
  ImpactResult,
  OwnerNotification,
} from '../../types/analysis';
import { OwnersConfig, SystemOwner } from '../../types/config';
import { logger } from '../../utils/logger';

/**
 * OwnerMapper - 영향 받는 시스템의 담당자 매핑
 *
 * 영향 분석 결과의 affectedFiles와 담당자 설정(owners.json)을 대조하여
 * 각 시스템 담당자에게 알림을 생성.
 */
export class OwnerMapper {
  /**
   * 영향 받는 시스템의 담당자 매핑
   * @param impact - 영향도 분석 결과
   * @param owners - 담당자 설정
   * @returns 담당자 알림 목록
   */
  map(impact: ImpactResult, owners: OwnersConfig): OwnerNotification[] {
    logger.info('Mapping owners...');
    const notifications: OwnerNotification[] = [];
    let counter = 0;

    // 영향 받는 파일 목록 수집
    const affectedFiles = new Set<string>();
    for (const task of impact.tasks) {
      task.affectedFiles.forEach(f => affectedFiles.add(f));
    }

    for (const system of owners.systems) {
      // 시스템의 관련 경로가 영향 받는 파일과 매칭되는지 확인
      const matchedPaths = this.findMatchingPaths(system, affectedFiles);

      if (matchedPaths.length > 0) {
        counter++;

        // 관련 작업 ID 수집
        const relatedTaskIds = impact.tasks
          .filter(t =>
            t.affectedFiles.some(f =>
              system.relatedPaths.some(p => f.includes(p))
            )
          )
          .map(t => t.id);

        // 이메일 초안 생성
        const emailDraft = this.generateEmailDraft(system, impact, relatedTaskIds);

        notifications.push({
          id: `ON-${String(counter).padStart(3, '0')}`,
          systemId: system.systemId,
          systemName: system.systemName,
          team: system.team,
          ownerName: system.owner.name,
          ownerEmail: system.owner.email,
          slackChannel: system.owner.slackChannel,
          relatedTaskIds,
          emailDraft,
        });
      }
    }

    logger.info(`Mapped ${notifications.length} owner notifications.`);
    return notifications;
  }

  /**
   * 시스템의 관련 경로 중 영향 받는 파일과 매칭되는 경로 탐색
   */
  private findMatchingPaths(
    system: SystemOwner,
    affectedFiles: Set<string>,
  ): string[] {
    const matched: string[] = [];

    for (const relatedPath of system.relatedPaths) {
      const normalizedPath = relatedPath.replace(/\\/g, '/');
      for (const file of affectedFiles) {
        const normalizedFile = file.replace(/\\/g, '/');
        if (normalizedFile.includes(normalizedPath)) {
          matched.push(normalizedPath);
          break;
        }
      }
    }

    return matched;
  }

  /**
   * 확인 요청 이메일 초안 생성
   */
  private generateEmailDraft(
    system: SystemOwner,
    impact: ImpactResult,
    relatedTaskIds: string[],
  ): string {
    const taskDescriptions = impact.tasks
      .filter(t => relatedTaskIds.includes(t.id))
      .map(t => `- ${t.title}: ${t.description}`)
      .join('\n');

    return [
      `[영향도 분석 알림] ${impact.specTitle}`,
      '',
      `안녕하세요, ${system.owner.name}님.`,
      '',
      `"${impact.specTitle}" 기획에 대한 영향도 분석 결과, ` +
        `${system.systemName} 시스템(${system.team} 담당)에 영향이 있을 수 있습니다.`,
      '',
      `관련 작업 목록:`,
      taskDescriptions || '- (상세 작업 없음)',
      '',
      `영향 받는 화면: ${impact.affectedScreens.map(s => s.screenName).join(', ')}`,
      '',
      `확인 부탁드립니다.`,
    ].join('\n');
  }
}
