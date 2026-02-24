"use strict";
/**
 * @module utils/analysis-status
 * @description 분석 결과 상태 관리 유틸리티 - Single Source of Truth
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALID_TRANSITIONS = void 0;
exports.getEffectiveStatus = getEffectiveStatus;
exports.isValidTransition = isValidTransition;
exports.isAnalysisStatus = isAnalysisStatus;
exports.getTransitionError = getTransitionError;
/** 유효한 상태 값 목록 */
const ALL_STATUSES = ['active', 'completed', 'on-hold', 'archived'];
/** 유효한 상태 전환 규칙 */
exports.VALID_TRANSITIONS = {
    'active': ['completed', 'on-hold', 'archived'],
    'completed': ['archived'],
    'on-hold': ['active', 'archived'],
    'archived': [],
};
/**
 * 유효 상태 조회 (Lazy Migration 지원)
 * status 필드가 없는 기존 데이터는 'active'로 간주
 */
function getEffectiveStatus(status) {
    return status ?? 'active';
}
/**
 * 상태 전환 가능 여부 판단
 */
function isValidTransition(from, to) {
    return exports.VALID_TRANSITIONS[from].includes(to);
}
/**
 * [R4-05] AnalysisStatus 런타임 가드 함수 (CLI/API 공통 사용)
 */
function isAnalysisStatus(value) {
    return typeof value === 'string' && ALL_STATUSES.includes(value);
}
/**
 * 전환 불가 사유 메시지
 */
function getTransitionError(from, to) {
    if (from === 'archived') {
        return '폐기된 분석은 상태를 변경할 수 없습니다.';
    }
    if (from === 'completed' && to === 'active') {
        return '완료된 분석은 재활성화할 수 없습니다. 보완 분석을 실행해주세요: cross-analyze --supplement --project <id>';
    }
    return `${from} -> ${to} 전환은 허용되지 않습니다.`;
}
//# sourceMappingURL=analysis-status.js.map