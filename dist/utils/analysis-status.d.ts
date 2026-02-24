/**
 * @module utils/analysis-status
 * @description 분석 결과 상태 관리 유틸리티 - Single Source of Truth
 */
/** 분석 결과 상태 타입 */
export type AnalysisStatus = 'active' | 'completed' | 'on-hold' | 'archived';
/** 유효한 상태 전환 규칙 */
export declare const VALID_TRANSITIONS: Record<AnalysisStatus, AnalysisStatus[]>;
/**
 * 유효 상태 조회 (Lazy Migration 지원)
 * status 필드가 없는 기존 데이터는 'active'로 간주
 */
export declare function getEffectiveStatus(status?: AnalysisStatus): AnalysisStatus;
/**
 * 상태 전환 가능 여부 판단
 */
export declare function isValidTransition(from: AnalysisStatus, to: AnalysisStatus): boolean;
/**
 * [R4-05] AnalysisStatus 런타임 가드 함수 (CLI/API 공통 사용)
 */
export declare function isAnalysisStatus(value: unknown): value is AnalysisStatus;
/**
 * 전환 불가 사유 메시지
 */
export declare function getTransitionError(from: AnalysisStatus, to: AnalysisStatus): string;
//# sourceMappingURL=analysis-status.d.ts.map