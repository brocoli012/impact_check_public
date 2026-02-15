"use strict";
/**
 * @module types/scoring
 * @description 점수 체계 타입 정의 - 4차원 점수 산출 및 등급 결정
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIDENCE_WEIGHTS = exports.SCORE_WEIGHTS = exports.GRADE_THRESHOLDS = void 0;
/**
 * 등급 기준 상수
 *
 * Low.range.min = 0은 의도적입니다.
 * 점수 0은 "영향 없음(no impact)"을 의미하며, 이는 복잡도가 전혀 없는 경우에 해당합니다.
 * 이 경우에도 유효한 Low 등급으로 분류되어야 하므로 범위에 0을 포함합니다.
 * (기획 문서에서는 범위를 1부터 표기하지만, 실제 점수 산출에서 0은 정상 값입니다.)
 */
exports.GRADE_THRESHOLDS = {
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
exports.SCORE_WEIGHTS = {
    developmentComplexity: 0.35,
    impactScope: 0.30,
    policyChange: 0.20,
    dependencyRisk: 0.15,
};
/** 신뢰도 가중치 */
exports.CONFIDENCE_WEIGHTS = {
    layer1Structure: 0.25,
    layer2Dependency: 0.25,
    layer3Policy: 0.20,
    layer4Analysis: 0.30,
};
//# sourceMappingURL=scoring.js.map