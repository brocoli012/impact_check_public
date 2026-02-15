/**
 * @module core/analysis/confidence-scorer
 * @description 신뢰도 산출기 - 4개 Layer 기반 신뢰도 점수 산출
 */

import {
  EnrichedResult,
  SystemConfidence,
} from '../../types/analysis';
import { CodeIndex } from '../../types/index';
import {
  LayerScore,
  ConfidenceGrade,
  CONFIDENCE_WEIGHTS,
} from '../../types/scoring';
import { logger } from '../../utils/logger';

/**
 * ConfidenceScorer - 4개 Layer 기반 신뢰도 점수 산출
 *
 * Layer 1 (구조): 25% - 코드 구조 분석 기반
 * Layer 2 (의존성): 25% - 의존성 그래프 기반
 * Layer 3 (정책): 20% - 정책/주석 기반
 * Layer 4 (분석 품질): 30% - 분석 결과 품질 기반
 *
 * 등급:
 * - high: 85+
 * - medium: 65~84
 * - low: 40~64
 * - very_low: 0~39
 */
export class ConfidenceScorer {
  /**
   * 4개 Layer 기반 신뢰도 점수 산출
   * @param result - 보강된 분석 결과
   * @param index - 코드 인덱스
   * @returns 시스템별 신뢰도 점수
   */
  calculate(
    result: EnrichedResult,
    index: CodeIndex,
  ): SystemConfidence[] {
    logger.info('Calculating confidence scores...');

    // 영향 받는 시스템 식별 (화면 기반)
    const systemMap = this.identifySystems(result, index);

    const confidences: SystemConfidence[] = [];

    for (const [systemId, systemName] of systemMap.entries()) {
      const layers = this.calculateLayerScores(systemId, systemName, result, index);
      const overallScore = this.calculateOverallScore(layers);
      const grade = this.determineGrade(overallScore);

      const warnings = this.generateWarnings(systemId, systemName, layers);
      const recommendations = this.generateRecommendations(grade, layers);

      confidences.push({
        systemId,
        systemName,
        overallScore,
        grade,
        layers,
        warnings,
        recommendations,
      });
    }

    logger.info(`Calculated confidence for ${confidences.length} systems.`);
    return confidences;
  }

  /**
   * 영향 받는 시스템 식별
   */
  private identifySystems(
    result: EnrichedResult,
    _index: CodeIndex,
  ): Map<string, string> {
    const systems = new Map<string, string>();

    // 영향 받는 화면을 시스템으로 취급
    for (const screen of result.affectedScreens) {
      systems.set(screen.screenId, screen.screenName);
    }

    // 담당자 알림에서 시스템 추가
    for (const notification of result.ownerNotifications) {
      if (!systems.has(notification.systemId)) {
        systems.set(notification.systemId, notification.systemName);
      }
    }

    // 최소 1개 시스템 (전체 프로젝트)
    if (systems.size === 0) {
      systems.set('project', 'Project');
    }

    return systems;
  }

  /**
   * Layer별 점수 계산
   */
  private calculateLayerScores(
    systemId: string,
    _systemName: string,
    result: EnrichedResult,
    index: CodeIndex,
  ): LayerScore {
    return {
      layer1Structure: {
        score: this.calculateStructureScore(systemId, result, index),
        weight: 0.25 as const,
        details: this.getStructureDetails(systemId, result, index),
      },
      layer2Dependency: {
        score: this.calculateDependencyScore(systemId, result, index),
        weight: 0.25 as const,
        details: this.getDependencyDetails(systemId, result, index),
      },
      layer3Policy: {
        score: this.calculatePolicyScore(systemId, result),
        weight: 0.20 as const,
        details: this.getPolicyDetails(systemId, result),
      },
      layer4Analysis: {
        score: this.calculateAnalysisQualityScore(result),
        weight: 0.30 as const,
        details: this.getAnalysisQualityDetails(result),
      },
    };
  }

  /**
   * Layer 1: 코드 구조 분석 점수
   * - 인덱스의 화면/컴포넌트/API 매핑 완성도 기반
   */
  private calculateStructureScore(
    systemId: string,
    result: EnrichedResult,
    index: CodeIndex,
  ): number {
    let score = 50; // 기본값

    // 인덱스에 화면이 있는지
    if (index.screens.length > 0) score += 15;

    // 인덱스에 컴포넌트가 있는지
    if (index.components.length > 0) score += 10;

    // 인덱스에 API가 있는지
    if (index.apis.length > 0) score += 10;

    // 관련 화면의 작업이 매칭되었는지
    const screen = result.affectedScreens.find(s => s.screenId === systemId);
    if (screen) {
      if (screen.tasks.length > 0) score += 10;
      // 작업에 영향 파일이 구체적인지
      const hasSpecificFiles = screen.tasks.some(t => t.affectedFiles.length > 0);
      if (hasSpecificFiles) score += 5;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Layer 2: 의존성 그래프 점수
   */
  private calculateDependencyScore(
    _systemId: string,
    _result: EnrichedResult,
    index: CodeIndex,
  ): number {
    let score = 40; // 기본값

    const graph = index.dependencies;

    // 그래프에 노드가 있는지
    if (graph.graph.nodes.length > 0) score += 20;

    // 그래프에 엣지가 있는지
    if (graph.graph.edges.length > 0) score += 15;

    // 엣지 대 노드 비율 (높으면 그래프가 잘 연결됨)
    if (graph.graph.nodes.length > 0) {
      const ratio = graph.graph.edges.length / graph.graph.nodes.length;
      if (ratio > 1.5) score += 15;
      else if (ratio > 0.5) score += 10;
      else score += 5;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Layer 3: 정책/주석 점수
   */
  private calculatePolicyScore(
    _systemId: string,
    result: EnrichedResult,
  ): number {
    let score = 50; // 기본값

    // 정책 경고가 있으면 정책 분석이 가동된 것
    if (result.policyWarnings.length > 0) score += 20;

    // 정책 변경이 구체적인지
    if (result.policyChanges.length > 0) {
      const hasReview = result.policyChanges.some(p => p.requiresReview);
      score += hasReview ? 15 : 10;
    }

    // 기획 확인 사항이 있으면 분석 품질 향상
    if (result.planningChecks.length > 0) score += 10;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Layer 4: 분석 품질 점수
   * - 규칙 기반 분석의 품질 지표 기반
   */
  private calculateAnalysisQualityScore(result: EnrichedResult): number {
    // 규칙 기반 분석 고정 - 기본 점수
    let score = 30;

    // 기획 확인 사항이 구체적인지
    const hasDetailedChecks = result.planningChecks.some(
      c => c.content && c.content.length > 30
    );
    if (hasDetailedChecks) score += 15;

    // 작업 분류가 다양한지 (FE/BE 모두)
    const hasFE = result.tasks.some(t => t.type === 'FE');
    const hasBE = result.tasks.some(t => t.type === 'BE');
    if (hasFE && hasBE) score += 15;

    // 점수 산출 rationale이 있는지
    if (result.screenScores.some(s =>
      s.taskScores.some(ts =>
        ts.scores.developmentComplexity.rationale.length > 10
      )
    )) {
      score += 15;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * 전체 신뢰도 점수 계산
   */
  private calculateOverallScore(layers: LayerScore): number {
    return (
      layers.layer1Structure.score * CONFIDENCE_WEIGHTS.layer1Structure +
      layers.layer2Dependency.score * CONFIDENCE_WEIGHTS.layer2Dependency +
      layers.layer3Policy.score * CONFIDENCE_WEIGHTS.layer3Policy +
      layers.layer4Analysis.score * CONFIDENCE_WEIGHTS.layer4Analysis
    );
  }

  /**
   * 등급 결정
   */
  private determineGrade(score: number): ConfidenceGrade {
    if (score >= 85) return 'high';
    if (score >= 65) return 'medium';
    if (score >= 40) return 'low';
    return 'very_low';
  }

  /**
   * 경고 생성
   */
  private generateWarnings(
    _systemId: string,
    _systemName: string,
    layers: LayerScore,
  ): string[] {
    const warnings: string[] = [];

    if (layers.layer1Structure.score < 50) {
      warnings.push('코드 구조 분석이 불완전합니다. 인덱스를 재구축하세요.');
    }
    if (layers.layer2Dependency.score < 50) {
      warnings.push('의존성 그래프가 불완전합니다.');
    }
    if (layers.layer3Policy.score < 50) {
      warnings.push('정책 정보가 부족합니다. 주석이나 정책 파일을 보완하세요.');
    }
    if (layers.layer4Analysis.score < 40) {
      warnings.push('분석 품질이 제한적입니다. 인덱스를 보완하면 정확도가 향상됩니다.');
    }

    return warnings;
  }

  /**
   * 권장 사항 생성
   */
  private generateRecommendations(
    grade: ConfidenceGrade,
    layers: LayerScore,
  ): string[] {
    const recommendations: string[] = [];

    if (grade === 'very_low' || grade === 'low') {
      recommendations.push('분석 결과의 신뢰도가 낮습니다. 수동 검증을 권장합니다.');
    }

    if (layers.layer1Structure.score < 60) {
      recommendations.push('reindex 명령을 실행하여 인덱스를 갱신하세요.');
    }

    if (layers.layer4Analysis.score < 50) {
      recommendations.push('인덱스를 보완하고 기획서를 더 구체적으로 작성하면 분석 정확도가 향상됩니다.');
    }

    return recommendations;
  }

  // Detail helpers
  private getStructureDetails(_systemId: string, _result: EnrichedResult, index: CodeIndex): string {
    return `Screens: ${index.screens.length}, Components: ${index.components.length}, APIs: ${index.apis.length}`;
  }

  private getDependencyDetails(_systemId: string, _result: EnrichedResult, index: CodeIndex): string {
    return `Nodes: ${index.dependencies.graph.nodes.length}, Edges: ${index.dependencies.graph.edges.length}`;
  }

  private getPolicyDetails(_systemId: string, result: EnrichedResult): string {
    return `Policy warnings: ${result.policyWarnings.length}, Policy changes: ${result.policyChanges.length}`;
  }

  private getAnalysisQualityDetails(result: EnrichedResult): string {
    return `Rule-based analysis. Tasks: ${result.tasks.length}, Checks: ${result.planningChecks.length}`;
  }
}
