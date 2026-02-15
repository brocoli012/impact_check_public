/**
 * @module core/analysis/scorer
 * @description 점수 산출기 - 4차원 가중합 점수 산출 및 등급 결정
 */

import * as fs from 'fs';
import * as path from 'path';
import { LLMRouter, NoProviderConfiguredError } from '../../llm/router';
import {
  ImpactResult,
  ScoredResult,
  ScreenScore,
  TaskScore,
  ScreenImpact,
  Task,
} from '../../types/analysis';
import {
  ScoreBreakdown,
  Grade,
  GRADE_THRESHOLDS,
  SCORE_WEIGHTS,
} from '../../types/scoring';
import { Message } from '../../types/llm';
import { logger } from '../../utils/logger';

// ── Rule-based scoring constants ──────────────────────────────────────
// These tune the heuristic scoring when no LLM is available.

/** Base score assigned before any action-type or file-count adjustments. */
const COMPLEXITY_BASE = 3;
/** Bonus added for brand-new feature tasks (highest complexity). */
const COMPLEXITY_NEW_BONUS = 3;
/** Bonus added for modification tasks (moderate complexity). */
const COMPLEXITY_MODIFY_BONUS = 1;

/** File-count thresholds for complexity scoring. */
const FILES_HIGH_THRESHOLD = 3;   // > 3 files  → +2
const FILES_LOW_THRESHOLD = 1;    // > 1 file   → +1
/** API-count threshold for complexity scoring. */
const APIS_THRESHOLD = 2;         // > 2 APIs   → +1

/** Base score for impact-scope heuristic. */
const SCOPE_BASE = 2;
/** Screen-count thresholds for scope scoring. */
const SCREENS_HIGH = 5;           // > 5 screens → +4
const SCREENS_MEDIUM = 3;         // > 3 screens → +3
const SCREENS_LOW = 1;            // > 1 screen  → +2
/** File-count thresholds for scope scoring. */
const SCOPE_FILES_HIGH = 5;       // > 5 files   → +2
const SCOPE_FILES_LOW = 2;        // > 2 files   → +1

/** Maximum per-policy score contribution (caps policy count * 2). */
const POLICY_MAX_CONTRIBUTION = 6;

/** Score bounds – every dimension is clamped to [MIN, MAX]. */
const SCORE_MIN = 1;
const SCORE_MAX = 10;

/** Default total score for tasks not found in the score map. */
const DEFAULT_TASK_TOTAL = 3.0;

/** Task-level grade thresholds (1–10 scale). */
const TASK_GRADE_LOW_MAX = 3.0;
const TASK_GRADE_MEDIUM_MAX = 5.5;
const TASK_GRADE_HIGH_MAX = 7.5;

/**
 * Scorer - 4차원 점수 산출기
 *
 * 가중치:
 * - 개발복잡도: 0.35
 * - 영향범위: 0.30
 * - 정책변경: 0.20
 * - 의존성위험: 0.15
 *
 * 등급:
 * - Low: 0~15
 * - Medium: 16~40
 * - High: 41~70
 * - Critical: 71+
 */
export class Scorer {
  private readonly llmRouter: LLMRouter;

  constructor(llmRouter: LLMRouter) {
    this.llmRouter = llmRouter;
  }

  /**
   * 4차원 점수 산출
   * @param impact - 영향도 분석 결과
   * @returns 점수가 포함된 결과
   */
  async score(impact: ImpactResult): Promise<ScoredResult> {
    let taskScoreMap: Map<string, { scores: ScoreBreakdown; total: number }>;

    try {
      taskScoreMap = await this.scoreWithLLM(impact);
    } catch (err) {
      if (err instanceof NoProviderConfiguredError) {
        logger.warn('LLM not configured. Using rule-based scoring.');
        taskScoreMap = this.scoreWithRules(impact);
      } else {
        throw err;
      }
    }

    // 화면별 점수 계산
    const screenScores = this.buildScreenScores(impact.affectedScreens, taskScoreMap);

    // 총점 및 등급 계산
    const { totalScore, grade } = this.calculateTotalScore(screenScores);

    // 권고사항
    const recommendation = this.getRecommendation(grade);

    return {
      ...impact,
      screenScores,
      totalScore,
      grade,
      recommendation,
    };
  }

  /**
   * LLM 기반 점수 산출
   */
  private async scoreWithLLM(
    impact: ImpactResult,
  ): Promise<Map<string, { scores: ScoreBreakdown; total: number }>> {
    const provider = this.llmRouter.route('score-calculation');
    const promptTemplate = this.loadPromptTemplate();

    const prompt = promptTemplate.replace(
      '{영향도 분석 결과 JSON}',
      JSON.stringify(impact, null, 2),
    );

    const messages: Message[] = [
      { role: 'user', content: prompt },
    ];

    logger.info('Scoring with LLM...');
    const response = await provider.chat(messages, {
      responseFormat: 'json',
      temperature: 0.1,
      maxTokens: 4096,
    });

    return this.parseLLMScoreResponse(response.content);
  }

  /**
   * 규칙 기반 점수 산출
   */
  private scoreWithRules(
    impact: ImpactResult,
  ): Map<string, { scores: ScoreBreakdown; total: number }> {
    const map = new Map<string, { scores: ScoreBreakdown; total: number }>();

    for (const task of impact.tasks) {
      const scores = this.calculateRuleBasedScores(task, impact);
      const total = this.calculateTaskScore(scores);
      map.set(task.id, { scores, total });
    }

    return map;
  }

  /**
   * 규칙 기반 개별 작업 점수 계산
   */
  private calculateRuleBasedScores(task: Task, impact: ImpactResult): ScoreBreakdown {
    // 개발 복잡도 추론
    const complexityScore = this.inferComplexity(task);

    // 영향 범위 추론
    const scopeScore = this.inferScope(task, impact);

    // 정책 변경 추론
    const policyScore = this.inferPolicyChange(task, impact);

    // 의존성 위험도 추론
    const dependencyScore = this.inferDependencyRisk(task);

    return {
      developmentComplexity: {
        score: complexityScore,
        weight: SCORE_WEIGHTS.developmentComplexity,
        rationale: this.getComplexityRationale(task, complexityScore),
      },
      impactScope: {
        score: scopeScore,
        weight: SCORE_WEIGHTS.impactScope,
        rationale: this.getScopeRationale(task, scopeScore),
      },
      policyChange: {
        score: policyScore,
        weight: SCORE_WEIGHTS.policyChange,
        rationale: this.getPolicyRationale(task, policyScore),
      },
      dependencyRisk: {
        score: dependencyScore,
        weight: SCORE_WEIGHTS.dependencyRisk,
        rationale: this.getDependencyRationale(task, dependencyScore),
      },
    };
  }

  /**
   * 개발 복잡도 추론
   */
  private inferComplexity(task: Task): number {
    let score = COMPLEXITY_BASE;

    if (task.actionType === 'new') score += COMPLEXITY_NEW_BONUS;
    else if (task.actionType === 'modify') score += COMPLEXITY_MODIFY_BONUS;
    // config는 그대로 (no bonus)

    if (task.affectedFiles.length > FILES_HIGH_THRESHOLD) score += 2;
    else if (task.affectedFiles.length > FILES_LOW_THRESHOLD) score += 1;

    if (task.relatedApis.length > APIS_THRESHOLD) score += 1;

    return Math.min(SCORE_MAX, Math.max(SCORE_MIN, score));
  }

  /**
   * 영향 범위 추론
   */
  private inferScope(task: Task, impact: ImpactResult): number {
    let score = SCOPE_BASE;

    // 영향 받는 화면 수
    const affectedScreenCount = impact.affectedScreens.length;
    if (affectedScreenCount > SCREENS_HIGH) score += 4;
    else if (affectedScreenCount > SCREENS_MEDIUM) score += 3;
    else if (affectedScreenCount > SCREENS_LOW) score += 2;
    else score += 1;

    // 영향 받는 파일 수
    if (task.affectedFiles.length > SCOPE_FILES_HIGH) score += 2;
    else if (task.affectedFiles.length > SCOPE_FILES_LOW) score += 1;

    return Math.min(SCORE_MAX, Math.max(SCORE_MIN, score));
  }

  /**
   * 정책 변경 추론
   */
  private inferPolicyChange(_task: Task, impact: ImpactResult): number {
    if (impact.policyChanges.length === 0) return SCORE_MIN;

    let score = SCOPE_BASE;
    score += Math.min(impact.policyChanges.length * 2, POLICY_MAX_CONTRIBUTION);

    const hasReviewRequired = impact.policyChanges.some(p => p.requiresReview);
    if (hasReviewRequired) score += 1;

    return Math.min(SCORE_MAX, Math.max(SCORE_MIN, score));
  }

  /**
   * 의존성 위험도 추론
   */
  private inferDependencyRisk(task: Task): number {
    let score = SCORE_MIN;

    if (task.relatedApis.length > 0) score += 2;
    if (task.relatedApis.length > APIS_THRESHOLD) score += 2;
    if (task.type === 'BE') score += 1;

    return Math.min(SCORE_MAX, Math.max(SCORE_MIN, score));
  }

  /**
   * 작업별 가중합 점수 계산
   * @param breakdown - 4차원 점수 분해
   * @returns 가중합 점수
   */
  calculateTaskScore(breakdown: ScoreBreakdown): number {
    return (
      breakdown.developmentComplexity.score * breakdown.developmentComplexity.weight +
      breakdown.impactScope.score * breakdown.impactScope.weight +
      breakdown.policyChange.score * breakdown.policyChange.weight +
      breakdown.dependencyRisk.score * breakdown.dependencyRisk.weight
    );
  }

  /**
   * 화면별 점수 합산
   * @param taskScores - 작업별 점수 목록
   * @returns 화면 종합 점수
   */
  calculateScreenScore(taskScores: TaskScore[]): number {
    if (taskScores.length === 0) return 0;
    const sum = taskScores.reduce((acc, ts) => acc + ts.totalScore, 0);
    return sum;
  }

  /**
   * 총점 및 등급 결정
   * @param screens - 화면별 점수 목록
   * @returns 총점과 등급
   */
  calculateTotalScore(screens: ScreenScore[]): { totalScore: number; grade: Grade } {
    const totalScore = screens.reduce((acc, s) => acc + s.screenScore, 0);
    const grade = this.determineGrade(totalScore);
    return { totalScore, grade };
  }

  /**
   * 점수로 등급 결정
   */
  private determineGrade(score: number): Grade {
    if (score <= GRADE_THRESHOLDS.Low.range.max) return 'Low';
    if (score <= GRADE_THRESHOLDS.Medium.range.max) return 'Medium';
    if (score <= GRADE_THRESHOLDS.High.range.max) return 'High';
    return 'Critical';
  }

  /**
   * 등급별 권고사항
   */
  getRecommendation(grade: Grade): string {
    return GRADE_THRESHOLDS[grade].recommendation;
  }

  /**
   * 화면별 점수 구성
   */
  private buildScreenScores(
    affectedScreens: ScreenImpact[],
    taskScoreMap: Map<string, { scores: ScoreBreakdown; total: number }>,
  ): ScreenScore[] {
    return affectedScreens.map(screen => {
      const taskScores: TaskScore[] = screen.tasks.map(task => {
        const scoreInfo = taskScoreMap.get(task.id) || {
          scores: this.defaultScoreBreakdown(),
          total: DEFAULT_TASK_TOTAL,
        };

        return {
          taskId: task.id,
          scores: scoreInfo.scores,
          totalScore: scoreInfo.total,
          grade: this.determineTaskGrade(scoreInfo.total),
        };
      });

      const screenScore = this.calculateScreenScore(taskScores);

      return {
        screenId: screen.screenId,
        screenName: screen.screenName,
        screenScore,
        grade: this.determineGrade(screenScore),
        taskScores,
      };
    });
  }

  /**
   * 작업 등급 결정 (작업 단위 점수는 1~10 범위)
   */
  private determineTaskGrade(totalScore: number): Grade {
    if (totalScore <= TASK_GRADE_LOW_MAX) return 'Low';
    if (totalScore <= TASK_GRADE_MEDIUM_MAX) return 'Medium';
    if (totalScore <= TASK_GRADE_HIGH_MAX) return 'High';
    return 'Critical';
  }

  /**
   * 기본 점수 분해
   */
  private defaultScoreBreakdown(): ScoreBreakdown {
    return {
      developmentComplexity: { score: COMPLEXITY_BASE, weight: SCORE_WEIGHTS.developmentComplexity, rationale: '기본값' },
      impactScope: { score: COMPLEXITY_BASE, weight: SCORE_WEIGHTS.impactScope, rationale: '기본값' },
      policyChange: { score: SCORE_MIN, weight: SCORE_WEIGHTS.policyChange, rationale: '기본값' },
      dependencyRisk: { score: SCORE_MIN, weight: SCORE_WEIGHTS.dependencyRisk, rationale: '기본값' },
    };
  }

  /**
   * LLM 점수 응답 파싱
   */
  private parseLLMScoreResponse(
    content: string,
  ): Map<string, { scores: ScoreBreakdown; total: number }> {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();

    try {
      const parsed = JSON.parse(jsonStr);
      const map = new Map<string, { scores: ScoreBreakdown; total: number }>();

      const taskScores = parsed.taskScores || [];
      for (const ts of taskScores) {
        const clamp = (val: number, fallback: number): number =>
          Math.min(SCORE_MAX, Math.max(SCORE_MIN, val || fallback));

        const scores: ScoreBreakdown = {
          developmentComplexity: {
            score: clamp(ts.scores?.developmentComplexity?.score, COMPLEXITY_BASE),
            weight: SCORE_WEIGHTS.developmentComplexity,
            rationale: ts.scores?.developmentComplexity?.rationale || '',
          },
          impactScope: {
            score: clamp(ts.scores?.impactScope?.score, COMPLEXITY_BASE),
            weight: SCORE_WEIGHTS.impactScope,
            rationale: ts.scores?.impactScope?.rationale || '',
          },
          policyChange: {
            score: clamp(ts.scores?.policyChange?.score, SCORE_MIN),
            weight: SCORE_WEIGHTS.policyChange,
            rationale: ts.scores?.policyChange?.rationale || '',
          },
          dependencyRisk: {
            score: clamp(ts.scores?.dependencyRisk?.score, SCORE_MIN),
            weight: SCORE_WEIGHTS.dependencyRisk,
            rationale: ts.scores?.dependencyRisk?.rationale || '',
          },
        };

        const total = this.calculateTaskScore(scores);
        map.set(ts.taskId, { scores, total });
      }

      return map;
    } catch {
      throw new Error('Failed to parse LLM score response as JSON.');
    }
  }

  /**
   * 프롬프트 템플릿 로드
   */
  private loadPromptTemplate(): string {
    const templatePath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'prompts',
      'score-difficulty.prompt.md'
    );

    try {
      if (fs.existsSync(templatePath)) {
        return fs.readFileSync(templatePath, 'utf-8');
      }
    } catch {
      logger.debug('Failed to load score prompt template.');
    }

    return `각 작업에 대해 4차원 점수를 산출하세요.

<impact_result>
{영향도 분석 결과 JSON}
</impact_result>

JSON 형식으로 taskScores를 출력하세요.`;
  }

  // Rationale helpers
  private getComplexityRationale(task: Task, score: number): string {
    if (task.actionType === 'new') {
      return `신규 개발 작업. 영향 파일 ${task.affectedFiles.length}개. (score: ${score})`;
    }
    if (task.actionType === 'config') {
      return `설정 변경 작업. 상대적으로 낮은 복잡도. (score: ${score})`;
    }
    return `기존 코드 수정 작업. 영향 파일 ${task.affectedFiles.length}개. (score: ${score})`;
  }

  private getScopeRationale(task: Task, score: number): string {
    return `영향 파일 ${task.affectedFiles.length}개, 관련 API ${task.relatedApis.length}개. (score: ${score})`;
  }

  private getPolicyRationale(task: Task, score: number): string {
    return `기획 확인 사항 ${task.planningChecks.length}개. (score: ${score})`;
  }

  private getDependencyRationale(task: Task, score: number): string {
    return `관련 API ${task.relatedApis.length}개, 작업 유형: ${task.type}. (score: ${score})`;
  }
}
