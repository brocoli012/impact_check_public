/**
 * @module core/analysis/confidence-scorer
 * @description 신뢰도 산출기 - 4개 Layer 기반 신뢰도 점수 산출
 */
import { EnrichedResult, SystemConfidence } from '../../types/analysis';
import { CodeIndex } from '../../types/index';
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
export declare class ConfidenceScorer {
    /**
     * 4개 Layer 기반 신뢰도 점수 산출
     * @param result - 보강된 분석 결과
     * @param index - 코드 인덱스
     * @returns 시스템별 신뢰도 점수
     */
    calculate(result: EnrichedResult, index: CodeIndex): SystemConfidence[];
    /**
     * 영향 받는 시스템 식별
     */
    private identifySystems;
    /**
     * Layer별 점수 계산
     */
    private calculateLayerScores;
    /**
     * Layer 1: 코드 구조 분석 점수
     * - 인덱스의 화면/컴포넌트/API 매핑 완성도 기반
     */
    private calculateStructureScore;
    /**
     * Layer 2: 의존성 그래프 점수
     */
    private calculateDependencyScore;
    /**
     * Layer 3: 정책/주석 점수
     */
    private calculatePolicyScore;
    /**
     * Layer 4: 분석 품질 점수
     * - 규칙 기반 분석의 품질 지표 기반
     */
    private calculateAnalysisQualityScore;
    /**
     * 전체 신뢰도 점수 계산
     */
    private calculateOverallScore;
    /**
     * 등급 결정
     */
    private determineGrade;
    /**
     * 경고 생성
     */
    private generateWarnings;
    /**
     * 권장 사항 생성
     */
    private generateRecommendations;
    private getStructureDetails;
    private getDependencyDetails;
    private getPolicyDetails;
    private getAnalysisQualityDetails;
}
//# sourceMappingURL=confidence-scorer.d.ts.map