/**
 * @module core/analysis/policy-matcher
 * @description 정책 매처 - 영향 받는 코드 근처 정책 매칭
 */

import {
  ImpactResult,
  PolicyWarning,
} from '../../types/analysis';
import { PolicyInfo } from '../../types/index';
import { logger } from '../../utils/logger';

/**
 * PolicyMatcher - 영향 받는 코드 근처 정책 매칭
 *
 * 영향 분석 결과의 affectedFiles와 정책 인덱스를 대조하여
 * 관련된 정책에 대한 경고를 생성.
 */
export class PolicyMatcher {
  /**
   * 영향 받는 코드 근처 정책 매칭
   * @param impact - 영향도 분석 결과
   * @param policies - 정책 목록
   * @returns 정책 경고 목록
   */
  match(impact: ImpactResult, policies: PolicyInfo[]): PolicyWarning[] {
    logger.info('Matching policies...');
    const warnings: PolicyWarning[] = [];
    let counter = 0;

    // 영향 받는 파일 목록 수집
    const affectedFiles = new Set<string>();
    for (const task of impact.tasks) {
      task.affectedFiles.forEach(f => affectedFiles.add(f));
    }

    // 영향 받는 API 목록 수집
    const affectedApis = new Set<string>();
    for (const task of impact.tasks) {
      task.relatedApis.forEach(a => affectedApis.add(a));
    }

    for (const policy of policies) {
      // 파일 경로 기반 매칭
      const fileMatch = affectedFiles.has(policy.filePath);

      // 관련 컴포넌트/API 기반 매칭
      const componentMatch = policy.relatedComponents.some(c =>
        this.isRelatedToTasks(c, impact)
      );
      const apiMatch = policy.relatedApis.some(a => affectedApis.has(a));

      // 모듈명 기반 매칭
      const moduleMatch = policy.relatedModules.some(m =>
        this.isModuleAffected(m, affectedFiles)
      );

      if (fileMatch || componentMatch || apiMatch || moduleMatch) {
        counter++;

        // 관련 작업 ID 수집
        const relatedTaskIds = impact.tasks
          .filter(t =>
            t.affectedFiles.some(f => f === policy.filePath) ||
            t.relatedApis.some(a => policy.relatedApis.includes(a))
          )
          .map(t => t.id);

        const severity = this.determineSeverity(policy, fileMatch, impact);

        warnings.push({
          id: `PW-${String(counter).padStart(3, '0')}`,
          policyId: policy.id,
          policyName: policy.name,
          message: this.buildWarningMessage(policy, fileMatch, componentMatch, apiMatch),
          severity,
          relatedTaskIds,
        });
      }
    }

    logger.info(`Matched ${warnings.length} policy warnings.`);
    return warnings;
  }

  /**
   * 컴포넌트가 작업과 관련이 있는지 확인
   */
  private isRelatedToTasks(componentId: string, impact: ImpactResult): boolean {
    return impact.tasks.some(t =>
      t.affectedFiles.some(f => f.includes(componentId))
    );
  }

  /**
   * 모듈이 영향 받는 파일에 포함되는지 확인
   */
  private isModuleAffected(moduleName: string, affectedFiles: Set<string>): boolean {
    const normalizedModule = moduleName.toLowerCase();
    return Array.from(affectedFiles).some(f =>
      f.toLowerCase().includes(normalizedModule)
    );
  }

  /**
   * 경고 심각도 결정
   */
  private determineSeverity(
    policy: PolicyInfo,
    isDirectFileMatch: boolean,
    impact: ImpactResult,
  ): 'info' | 'warning' | 'critical' {
    // 파일이 직접 영향을 받고 정책 카테고리가 중요한 경우
    if (isDirectFileMatch) {
      const criticalCategories = ['결제', '보안', '인증', '개인정보', 'payment', 'security', 'auth'];
      if (criticalCategories.some(c => policy.category.toLowerCase().includes(c))) {
        return 'critical';
      }
      return 'warning';
    }

    // 정책 변경이 이미 감지된 경우
    if (impact.policyChanges.some(pc => pc.policyName === policy.name)) {
      return 'warning';
    }

    return 'info';
  }

  /**
   * 경고 메시지 생성
   */
  private buildWarningMessage(
    policy: PolicyInfo,
    fileMatch: boolean,
    componentMatch: boolean,
    apiMatch: boolean,
  ): string {
    const reasons: string[] = [];

    if (fileMatch) {
      reasons.push(`정책 파일 "${policy.filePath}"이 직접 영향을 받습니다`);
    }
    if (componentMatch) {
      reasons.push(`관련 컴포넌트가 영향을 받습니다`);
    }
    if (apiMatch) {
      reasons.push(`관련 API가 영향을 받습니다`);
    }

    return `정책 "${policy.name}" 검토 필요: ${reasons.join(', ')}. ${policy.description}`;
  }
}
