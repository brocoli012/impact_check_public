"use strict";
/**
 * @module utils/validators
 * @description ConfidenceEnrichedResult 런타임 검증 유틸리티
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateImpactResult = validateImpactResult;
exports.isValidConfidenceEnrichedResult = isValidConfidenceEnrichedResult;
/** 유효한 analysisMethod 값 목록 */
const VALID_ANALYSIS_METHODS = ['rule-based', 'claude-native'];
/** 유효한 grade 값 목록 */
const VALID_GRADES = ['Low', 'Medium', 'High', 'Critical'];
/**
 * ConfidenceEnrichedResult 데이터를 런타임 검증
 * @param data - 검증 대상 데이터 (unknown)
 * @returns 검증 결과
 */
function validateImpactResult(data) {
    const errors = [];
    if (data === null || data === undefined || typeof data !== 'object') {
        errors.push({ field: 'root', message: 'Data must be a non-null object' });
        return { valid: false, errors };
    }
    const obj = data;
    // 필수 문자열 필드
    validateStringField(obj, 'analysisId', errors);
    validateStringField(obj, 'analyzedAt', errors);
    validateStringField(obj, 'specTitle', errors);
    validateStringField(obj, 'recommendation', errors);
    // analysisMethod: 선택적, 있으면 'rule-based' | 'claude-native'
    if (obj['analysisMethod'] !== undefined) {
        if (typeof obj['analysisMethod'] !== 'string' ||
            !VALID_ANALYSIS_METHODS.includes(obj['analysisMethod'])) {
            errors.push({
                field: 'analysisMethod',
                message: `analysisMethod must be one of: ${VALID_ANALYSIS_METHODS.join(', ')}`,
            });
        }
    }
    // 필수 배열 필드
    validateArrayField(obj, 'affectedScreens', errors);
    validateArrayField(obj, 'tasks', errors);
    validateArrayField(obj, 'planningChecks', errors);
    validateArrayField(obj, 'policyChanges', errors);
    validateArrayField(obj, 'screenScores', errors);
    validateArrayField(obj, 'policyWarnings', errors);
    validateArrayField(obj, 'ownerNotifications', errors);
    validateArrayField(obj, 'confidenceScores', errors);
    validateArrayField(obj, 'lowConfidenceWarnings', errors);
    // totalScore: number
    if (typeof obj['totalScore'] !== 'number') {
        errors.push({ field: 'totalScore', message: 'totalScore must be a number' });
    }
    // grade: 'Low' | 'Medium' | 'High' | 'Critical'
    if (typeof obj['grade'] !== 'string' || !VALID_GRADES.includes(obj['grade'])) {
        errors.push({
            field: 'grade',
            message: `grade must be one of: ${VALID_GRADES.join(', ')}`,
        });
    }
    // parsedSpec: optional, 있으면 object with title(string)
    if (obj['parsedSpec'] !== undefined) {
        if (typeof obj['parsedSpec'] !== 'object' || obj['parsedSpec'] === null) {
            errors.push({
                field: 'parsedSpec',
                message: 'parsedSpec must be an object when present',
            });
        }
        else {
            const ps = obj['parsedSpec'];
            if (typeof ps['title'] !== 'string' || ps['title'].length === 0) {
                errors.push({
                    field: 'parsedSpec.title',
                    message: 'parsedSpec.title must be a non-empty string',
                });
            }
        }
    }
    // analysisSummary: optional, 있으면 object with overview(string)
    if (obj['analysisSummary'] !== undefined) {
        if (typeof obj['analysisSummary'] !== 'object' || obj['analysisSummary'] === null) {
            errors.push({
                field: 'analysisSummary',
                message: 'analysisSummary must be an object when present',
            });
        }
        else {
            const as_ = obj['analysisSummary'];
            if (typeof as_['overview'] !== 'string' || as_['overview'].length === 0) {
                errors.push({
                    field: 'analysisSummary.overview',
                    message: 'analysisSummary.overview must be a non-empty string',
                });
            }
        }
    }
    return { valid: errors.length === 0, errors };
}
/**
 * 문자열 필드 검증 헬퍼
 */
function validateStringField(obj, field, errors) {
    if (typeof obj[field] !== 'string' || obj[field].length === 0) {
        errors.push({ field, message: `${field} must be a non-empty string` });
    }
}
/**
 * 배열 필드 검증 헬퍼
 */
function validateArrayField(obj, field, errors) {
    if (!Array.isArray(obj[field])) {
        errors.push({ field, message: `${field} must be an array` });
    }
}
/**
 * ConfidenceEnrichedResult type guard
 * @param data - 검증 대상 데이터
 * @returns data가 ConfidenceEnrichedResult인지 여부
 */
function isValidConfidenceEnrichedResult(data) {
    return validateImpactResult(data).valid;
}
//# sourceMappingURL=validators.js.map