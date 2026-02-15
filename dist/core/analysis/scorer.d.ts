/**
 * @module core/analysis/scorer
 * @description 점수 산출기 - 4차원 가중합 점수 산출 및 등급 결정
 */
import { ImpactResult, ScoredResult, ScreenScore, TaskScore } from '../../types/analysis';
import { ScoreBreakdown, Grade } from '../../types/scoring';
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
export declare class Scorer {
    /**
     * 4차원 점수 산출 (규칙 기반)
     * @param impact - 영향도 분석 결과
     * @returns 점수가 포함된 결과
     */
    score(impact: ImpactResult): Promise<ScoredResult>;
    /**
     * 규칙 기반 점수 산출
     */
    private scoreWithRules;
    /**
     * 규칙 기반 개별 작업 점수 계산
     */
    private calculateRuleBasedScores;
    /**
     * 개발 복잡도 추론
     */
    private inferComplexity;
    /**
     * 영향 범위 추론
     */
    private inferScope;
    /**
     * 정책 변경 추론
     */
    private inferPolicyChange;
    /**
     * 의존성 위험도 추론
     */
    private inferDependencyRisk;
    /**
     * 작업별 가중합 점수 계산
     * @param breakdown - 4차원 점수 분해
     * @returns 가중합 점수
     */
    calculateTaskScore(breakdown: ScoreBreakdown): number;
    /**
     * 화면별 점수 합산
     * @param taskScores - 작업별 점수 목록
     * @returns 화면 종합 점수
     */
    calculateScreenScore(taskScores: TaskScore[]): number;
    /**
     * 총점 및 등급 결정
     * @param screens - 화면별 점수 목록
     * @returns 총점과 등급
     */
    calculateTotalScore(screens: ScreenScore[]): {
        totalScore: number;
        grade: Grade;
    };
    /**
     * 점수로 등급 결정
     */
    private determineGrade;
    /**
     * 등급별 권고사항
     */
    getRecommendation(grade: Grade): string;
    /**
     * 화면별 점수 구성
     */
    private buildScreenScores;
    /**
     * 작업 등급 결정 (작업 단위 점수는 1~10 범위)
     */
    private determineTaskGrade;
    /**
     * 기본 점수 분해
     */
    private defaultScoreBreakdown;
    private getComplexityRationale;
    private getScopeRationale;
    private getPolicyRationale;
    private getDependencyRationale;
}
//# sourceMappingURL=scorer.d.ts.map