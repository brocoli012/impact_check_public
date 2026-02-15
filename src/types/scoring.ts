/**
 * @module types/scoring
 * @description 점수 체계 타입 정의 - 4차원 점수 산출 및 등급 결정
 */

// ============================================================
// 점수 차원 타입
// ============================================================

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

// ============================================================
// 등급 타입
// ============================================================

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
export const GRADE_THRESHOLDS: Record<Grade, GradeInfo> = {
  Low: {
    grade: 'Low',
    range: { min: 0, max: 15 },
    color: '#22C55E',
    backgroundColor: '#F0FDF4',
    description: '소규모 작업',
    recommendation: '일반 스프린트 내 처리 가능합니다.',
  },
  Medium: {
    grade: 'Medium',
    range: { min: 16, max: 40 },
    color: '#EAB308',
    backgroundColor: '#FEFCE8',
    description: '중간 규모',
    recommendation: '스프린트 계획 시 우선순위 조정이 필요합니다.',
  },
  High: {
    grade: 'High',
    range: { min: 41, max: 70 },
    color: '#F97316',
    backgroundColor: '#FFF7ED',
    description: '대규모',
    recommendation: '별도 프로젝트 계획이 필요합니다. 리소스 배분을 검토하세요.',
  },
  Critical: {
    grade: 'Critical',
    range: { min: 71, max: Infinity },
    color: '#EF4444',
    backgroundColor: '#FEF2F2',
    description: '초대규모',
    recommendation: '아키텍처 리뷰가 필수입니다. 단계별 릴리즈 계획을 수립하고 경영진 보고를 권고합니다.',
  },
};

// ============================================================
// 가중치 상수
// ============================================================

/** 점수 가중치 */
export const SCORE_WEIGHTS = {
  developmentComplexity: 0.35,
  impactScope: 0.30,
  policyChange: 0.20,
  dependencyRisk: 0.15,
} as const;

// ============================================================
// 신뢰도 점수 타입
// ============================================================

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
  layer1Structure: { score: number; weight: 0.25; details: string };
  /** Layer 2: 의존성 그래프 (가중치: 0.25) */
  layer2Dependency: { score: number; weight: 0.25; details: string };
  /** Layer 3: 정책/주석 (가중치: 0.20) */
  layer3Policy: { score: number; weight: 0.20; details: string };
  /** Layer 4: LLM 추론 (가중치: 0.30) */
  layer4LLM: { score: number; weight: 0.30; details: string };
}

/** 신뢰도 가중치 */
export const CONFIDENCE_WEIGHTS = {
  layer1Structure: 0.25,
  layer2Dependency: 0.25,
  layer3Policy: 0.20,
  layer4LLM: 0.30,
} as const;
