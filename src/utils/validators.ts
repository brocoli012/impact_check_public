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

/** 유효한 analysisMethod 값 목록 */
const VALID_ANALYSIS_METHODS = ['rule-based', 'claude-native'] as const;

/** 유효한 grade 값 목록 */
const VALID_GRADES = ['Low', 'Medium', 'High', 'Critical'] as const;

/**
 * ConfidenceEnrichedResult 데이터를 런타임 검증
 * @param data - 검증 대상 데이터 (unknown)
 * @returns 검증 결과
 */
export function validateImpactResult(data: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (data === null || data === undefined || typeof data !== 'object') {
    errors.push({ field: 'root', message: 'Data must be a non-null object' });
    return { valid: false, errors };
  }

  const obj = data as Record<string, unknown>;

  // 필수 문자열 필드
  validateStringField(obj, 'analysisId', errors);
  validateStringField(obj, 'analyzedAt', errors);
  validateStringField(obj, 'specTitle', errors);
  validateStringField(obj, 'recommendation', errors);

  // analysisMethod: 선택적, 있으면 'rule-based' | 'claude-native'
  if (obj['analysisMethod'] !== undefined) {
    if (
      typeof obj['analysisMethod'] !== 'string' ||
      !VALID_ANALYSIS_METHODS.includes(obj['analysisMethod'] as typeof VALID_ANALYSIS_METHODS[number])
    ) {
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
  if (typeof obj['grade'] !== 'string' || !VALID_GRADES.includes(obj['grade'] as typeof VALID_GRADES[number])) {
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
    } else {
      const ps = obj['parsedSpec'] as Record<string, unknown>;
      if (typeof ps['title'] !== 'string' || (ps['title'] as string).length === 0) {
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
    } else {
      const as_ = obj['analysisSummary'] as Record<string, unknown>;
      if (typeof as_['overview'] !== 'string' || (as_['overview'] as string).length === 0) {
        errors.push({
          field: 'analysisSummary.overview',
          message: 'analysisSummary.overview must be a non-empty string',
        });
      }

      // REQ-018-A2: riskAreas 유니온 타입 검증 (string | RiskArea)[]
      if (Array.isArray(as_['riskAreas'])) {
        for (const item of as_['riskAreas'] as unknown[]) {
          if (typeof item === 'string') continue; // 레거시 호환
          if (typeof item === 'object' && item !== null) {
            const riskObj = item as Record<string, unknown>;
            if (!riskObj['description'] || typeof riskObj['description'] !== 'string') {
              errors.push({
                field: 'analysisSummary.riskAreas[]',
                message: 'RiskArea 객체는 description(string) 필드가 필수입니다.',
              });
            }
            if (!riskObj['impact'] || typeof riskObj['impact'] !== 'string' ||
                !['low', 'medium', 'high', 'critical'].includes(riskObj['impact'] as string)) {
              errors.push({
                field: 'analysisSummary.riskAreas[]',
                message: 'RiskArea 객체는 impact 필드가 필수이며 low/medium/high/critical 중 하나여야 합니다.',
              });
            }
          } else {
            errors.push({
              field: 'analysisSummary.riskAreas[]',
              message: 'riskAreas 항목은 string 또는 RiskArea 객체여야 합니다.',
            });
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 문자열 필드 검증 헬퍼
 */
function validateStringField(
  obj: Record<string, unknown>,
  field: string,
  errors: ValidationError[],
): void {
  if (typeof obj[field] !== 'string' || (obj[field] as string).length === 0) {
    errors.push({ field, message: `${field} must be a non-empty string` });
  }
}

/**
 * 배열 필드 검증 헬퍼
 */
function validateArrayField(
  obj: Record<string, unknown>,
  field: string,
  errors: ValidationError[],
): void {
  if (!Array.isArray(obj[field])) {
    errors.push({ field, message: `${field} must be an array` });
  }
}

/**
 * ConfidenceEnrichedResult type guard
 * @param data - 검증 대상 데이터
 * @returns data가 ConfidenceEnrichedResult인지 여부
 */
export function isValidConfidenceEnrichedResult(
  data: unknown,
): data is ConfidenceEnrichedResult {
  return validateImpactResult(data).valid;
}
