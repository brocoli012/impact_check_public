/**
 * @module tests/unit/utils/validators
 * @description validators 유틸리티 단위 테스트
 */

import {
  validateImpactResult,
  isValidConfidenceEnrichedResult,
} from '../../../src/utils/validators';

/** 테스트용 최소 유효 ConfidenceEnrichedResult 데이터 */
function createValidResult(): Record<string, unknown> {
  return {
    analysisId: 'test-001',
    analyzedAt: '2025-01-01T00:00:00Z',
    specTitle: 'Test Spec',
    analysisMethod: 'rule-based',
    affectedScreens: [],
    tasks: [],
    planningChecks: [],
    policyChanges: [],
    screenScores: [],
    totalScore: 42,
    grade: 'High',
    recommendation: 'Review needed',
    policyWarnings: [],
    ownerNotifications: [],
    confidenceScores: [],
    lowConfidenceWarnings: [],
  };
}

describe('validators', () => {
  describe('validateImpactResult()', () => {
    it('should return valid=true for a correctly structured object', () => {
      const result = validateImpactResult(createValidResult());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject null', () => {
      const result = validateImpactResult(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('root');
    });

    it('should reject undefined', () => {
      const result = validateImpactResult(undefined);
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('root');
    });

    it('should reject non-object types', () => {
      expect(validateImpactResult('string').valid).toBe(false);
      expect(validateImpactResult(123).valid).toBe(false);
      expect(validateImpactResult(true).valid).toBe(false);
    });

    describe('string field validation', () => {
      const stringFields = ['analysisId', 'analyzedAt', 'specTitle', 'recommendation'];

      it.each(stringFields)('should reject missing %s', (field) => {
        const data = createValidResult();
        delete data[field];
        const result = validateImpactResult(data);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === field)).toBe(true);
      });

      it.each(stringFields)('should reject empty string %s', (field) => {
        const data = createValidResult();
        data[field] = '';
        const result = validateImpactResult(data);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === field)).toBe(true);
      });

      it.each(stringFields)('should reject non-string %s', (field) => {
        const data = createValidResult();
        data[field] = 123;
        const result = validateImpactResult(data);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === field)).toBe(true);
      });
    });

    describe('array field validation', () => {
      const arrayFields = [
        'affectedScreens', 'tasks', 'planningChecks', 'policyChanges',
        'screenScores', 'policyWarnings', 'ownerNotifications',
        'confidenceScores', 'lowConfidenceWarnings',
      ];

      it.each(arrayFields)('should reject missing %s', (field) => {
        const data = createValidResult();
        delete data[field];
        const result = validateImpactResult(data);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === field)).toBe(true);
      });

      it.each(arrayFields)('should reject non-array %s', (field) => {
        const data = createValidResult();
        data[field] = 'not-an-array';
        const result = validateImpactResult(data);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === field)).toBe(true);
      });
    });

    describe('analysisMethod validation', () => {
      it('should accept "rule-based"', () => {
        const data = createValidResult();
        data['analysisMethod'] = 'rule-based';
        const result = validateImpactResult(data);
        expect(result.valid).toBe(true);
      });

      it('should accept "claude-native"', () => {
        const data = createValidResult();
        data['analysisMethod'] = 'claude-native';
        const result = validateImpactResult(data);
        expect(result.valid).toBe(true);
      });

      it('should accept missing analysisMethod (optional field)', () => {
        const data = createValidResult();
        delete data['analysisMethod'];
        const result = validateImpactResult(data);
        expect(result.valid).toBe(true);
      });

      it('should reject invalid analysisMethod value', () => {
        const data = createValidResult();
        data['analysisMethod'] = 'invalid-method';
        const result = validateImpactResult(data);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'analysisMethod')).toBe(true);
      });

      it('should reject non-string analysisMethod', () => {
        const data = createValidResult();
        data['analysisMethod'] = 123;
        const result = validateImpactResult(data);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'analysisMethod')).toBe(true);
      });
    });

    describe('totalScore validation', () => {
      it('should reject missing totalScore', () => {
        const data = createValidResult();
        delete data['totalScore'];
        const result = validateImpactResult(data);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'totalScore')).toBe(true);
      });

      it('should reject non-number totalScore', () => {
        const data = createValidResult();
        data['totalScore'] = 'not-a-number';
        const result = validateImpactResult(data);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'totalScore')).toBe(true);
      });

      it('should accept zero totalScore', () => {
        const data = createValidResult();
        data['totalScore'] = 0;
        const result = validateImpactResult(data);
        expect(result.valid).toBe(true);
      });
    });

    describe('grade validation', () => {
      it.each(['Low', 'Medium', 'High', 'Critical'])('should accept grade "%s"', (grade) => {
        const data = createValidResult();
        data['grade'] = grade;
        const result = validateImpactResult(data);
        expect(result.valid).toBe(true);
      });

      it('should reject invalid grade', () => {
        const data = createValidResult();
        data['grade'] = 'InvalidGrade';
        const result = validateImpactResult(data);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'grade')).toBe(true);
      });

      it('should reject missing grade', () => {
        const data = createValidResult();
        delete data['grade'];
        const result = validateImpactResult(data);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'grade')).toBe(true);
      });

      it('should reject lowercase grade', () => {
        const data = createValidResult();
        data['grade'] = 'low';
        const result = validateImpactResult(data);
        expect(result.valid).toBe(false);
      });
    });

    describe('parsedSpec validation (REQ-009)', () => {
      it('should accept missing parsedSpec (optional field)', () => {
        const data = createValidResult();
        // parsedSpec not present by default in createValidResult()
        const result = validateImpactResult(data);
        expect(result.valid).toBe(true);
      });

      it('should accept valid parsedSpec', () => {
        const data = createValidResult();
        data['parsedSpec'] = {
          title: 'Test Spec',
          requirements: [],
          features: [],
          businessRules: [],
          targetScreens: [],
          keywords: [],
          ambiguities: [],
        };
        const result = validateImpactResult(data);
        expect(result.valid).toBe(true);
      });

      it('should reject non-object parsedSpec', () => {
        const data = createValidResult();
        data['parsedSpec'] = 'not-an-object';
        const result = validateImpactResult(data);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'parsedSpec')).toBe(true);
      });

      it('should reject null parsedSpec', () => {
        const data = createValidResult();
        data['parsedSpec'] = null;
        const result = validateImpactResult(data);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'parsedSpec')).toBe(true);
      });

      it('should reject parsedSpec with missing title', () => {
        const data = createValidResult();
        data['parsedSpec'] = { requirements: [], features: [] };
        const result = validateImpactResult(data);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'parsedSpec.title')).toBe(true);
      });

      it('should reject parsedSpec with empty title', () => {
        const data = createValidResult();
        data['parsedSpec'] = { title: '', requirements: [] };
        const result = validateImpactResult(data);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'parsedSpec.title')).toBe(true);
      });
    });

    describe('analysisSummary validation (REQ-009)', () => {
      it('should accept missing analysisSummary (optional field)', () => {
        const data = createValidResult();
        const result = validateImpactResult(data);
        expect(result.valid).toBe(true);
      });

      it('should accept valid analysisSummary', () => {
        const data = createValidResult();
        data['analysisSummary'] = {
          overview: 'Test overview',
          keyFindings: ['finding1'],
          riskAreas: ['risk1'],
        };
        const result = validateImpactResult(data);
        expect(result.valid).toBe(true);
      });

      it('should reject non-object analysisSummary', () => {
        const data = createValidResult();
        data['analysisSummary'] = 'not-an-object';
        const result = validateImpactResult(data);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'analysisSummary')).toBe(true);
      });

      it('should reject null analysisSummary', () => {
        const data = createValidResult();
        data['analysisSummary'] = null;
        const result = validateImpactResult(data);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'analysisSummary')).toBe(true);
      });

      it('should reject analysisSummary with missing overview', () => {
        const data = createValidResult();
        data['analysisSummary'] = { keyFindings: [], riskAreas: [] };
        const result = validateImpactResult(data);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'analysisSummary.overview')).toBe(true);
      });

      it('should reject analysisSummary with empty overview', () => {
        const data = createValidResult();
        data['analysisSummary'] = { overview: '', keyFindings: [], riskAreas: [] };
        const result = validateImpactResult(data);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'analysisSummary.overview')).toBe(true);
      });
    });

    describe('combined parsedSpec + analysisSummary (REQ-009)', () => {
      it('should accept result with both parsedSpec and analysisSummary', () => {
        const data = createValidResult();
        data['parsedSpec'] = {
          title: 'Combined Test',
          requirements: [],
          features: [],
          businessRules: [],
          targetScreens: [],
          keywords: [],
          ambiguities: [],
        };
        data['analysisSummary'] = {
          overview: 'Combined overview',
          keyFindings: [],
          riskAreas: [],
        };
        const result = validateImpactResult(data);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should collect multiple errors', () => {
      const data = createValidResult();
      delete data['analysisId'];
      delete data['totalScore'];
      delete data['grade'];
      const result = validateImpactResult(data);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('isValidConfidenceEnrichedResult()', () => {
    it('should return true for valid data', () => {
      const data = createValidResult();
      expect(isValidConfidenceEnrichedResult(data)).toBe(true);
    });

    it('should return false for invalid data', () => {
      expect(isValidConfidenceEnrichedResult(null)).toBe(false);
      expect(isValidConfidenceEnrichedResult({})).toBe(false);
      expect(isValidConfidenceEnrichedResult('string')).toBe(false);
    });

    it('should narrow the type correctly', () => {
      const data: unknown = createValidResult();
      if (isValidConfidenceEnrichedResult(data)) {
        // TypeScript should allow accessing ConfidenceEnrichedResult fields
        expect(data.analysisId).toBe('test-001');
        expect(data.totalScore).toBe(42);
      } else {
        fail('Expected data to be valid');
      }
    });
  });
});
