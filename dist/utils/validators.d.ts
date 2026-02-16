/**
 * @module utils/validators
 * @description ConfidenceEnrichedResult 런타임 검증 유틸리티
 */
import { ConfidenceEnrichedResult } from '../types/analysis';
/** 검증 에러 항목 */
export interface ValidationError {
    /** 필드 경로 */
    field: string;
    /** 에러 메시지 */
    message: string;
}
/** 검증 결과 */
export interface ValidationResult {
    /** 유효 여부 */
    valid: boolean;
    /** 에러 목록 */
    errors: ValidationError[];
}
/**
 * ConfidenceEnrichedResult 데이터를 런타임 검증
 * @param data - 검증 대상 데이터 (unknown)
 * @returns 검증 결과
 */
export declare function validateImpactResult(data: unknown): ValidationResult;
/**
 * ConfidenceEnrichedResult type guard
 * @param data - 검증 대상 데이터
 * @returns data가 ConfidenceEnrichedResult인지 여부
 */
export declare function isValidConfidenceEnrichedResult(data: unknown): data is ConfidenceEnrichedResult;
//# sourceMappingURL=validators.d.ts.map