/**
 * @module types/scoring
 * @description 점수 체계 타입 정의 - 4차원 점수 산출 및 등급 결정
 */
/** 점수 차원 */
export interface ScoreDimension {
    /** 점수 (1~10) */
    score: number;
    /** 가중치 */
    weight: number;
    /** 산출 근거 */
    rationale: string;
}
/** 4차원 점수 분해 */
export interface ScoreBreakdown {
    /** 개발 복잡도 (가중치: 0.35) */
    developmentComplexity: ScoreDimension;
    /** 영향 범위 (가중치: 0.30) */
    impactScope: ScoreDimension;
    /** 정책 변경 (가중치: 0.20) */
    policyChange: ScoreDimension;
    /** 의존성 리스크 (가중치: 0.15) */
    dependencyRisk: ScoreDimension;
}
/** 등급 타입 */
export type Grade = 'Low' | 'Medium' | 'High' | 'Critical';
/** 등급 정보 */
export interface GradeInfo {
    /** 등급 */
    grade: Grade;
    /** 등급 범위 (최소~최대) */
    range: {
        min: number;
        max: number;
    };
    /** 등급 색상 코드 */
    color: string;
    /** 등급 배경 색상 코드 */
    backgroundColor: string;
    /** 등급 설명 */
    description: string;
    /** 권장 사항 */
    recommendation: string;
}
/**
 * 등급 기준 상수
 *
 * Low.range.min = 0은 의도적입니다.
 * 점수 0은 "영향 없음(no impact)"을 의미하며, 이는 복잡도가 전혀 없는 경우에 해당합니다.
 * 이 경우에도 유효한 Low 등급으로 분류되어야 하므로 범위에 0을 포함합니다.
 * (기획 문서에서는 범위를 1부터 표기하지만, 실제 점수 산출에서 0은 정상 값입니다.)
 */
export declare const GRADE_THRESHOLDS: Record<Grade, GradeInfo>;
/** 점수 가중치 */
export declare const SCORE_WEIGHTS: {
    readonly developmentComplexity: 0.35;
    readonly impactScope: 0.3;
    readonly policyChange: 0.2;
    readonly dependencyRisk: 0.15;
};
/** 신뢰도 등급 */
export type ConfidenceGrade = 'high' | 'medium' | 'low' | 'very_low';
/** 신뢰도 점수 */
export interface ConfidenceScore {
    /** 전체 점수 (0~100) */
    overall: number;
    /** 등급 */
    grade: ConfidenceGrade;
    /** Layer별 점수 */
    layers: LayerScore;
}
/** Layer별 점수 */
export interface LayerScore {
    /** Layer 1: 코드 구조 분석 (가중치: 0.25) */
    layer1Structure: {
        score: number;
        weight: 0.25;
        details: string;
    };
    /** Layer 2: 의존성 그래프 (가중치: 0.25) */
    layer2Dependency: {
        score: number;
        weight: 0.25;
        details: string;
    };
    /** Layer 3: 정책/주석 (가중치: 0.20) */
    layer3Policy: {
        score: number;
        weight: 0.20;
        details: string;
    };
    /** Layer 4: LLM 추론 (가중치: 0.30) */
    layer4LLM: {
        score: number;
        weight: 0.30;
        details: string;
    };
}
/** 신뢰도 가중치 */
export declare const CONFIDENCE_WEIGHTS: {
    readonly layer1Structure: 0.25;
    readonly layer2Dependency: 0.25;
    readonly layer3Policy: 0.2;
    readonly layer4LLM: 0.3;
};
//# sourceMappingURL=scoring.d.ts.map