/**
 * @module tests/unit/annotations/policy-converter.test
 * @description policy-converter 단위 테스트 - InferredPolicy -> PolicyInfo 변환 및 중복 제거
 */

import { convertAnnotationsToPolicies, mergePolicies } from '../../../src/core/annotations/policy-converter';
import type { AnnotationFile } from '../../../src/types/annotations';
import type { PolicyInfo } from '../../../src/types';

describe('policy-converter', () => {
  // ============================================================
  // convertAnnotationsToPolicies
  // ============================================================

  describe('convertAnnotationsToPolicies', () => {
    it('should return empty array for empty annotations map', () => {
      const result = convertAnnotationsToPolicies(new Map());
      expect(result).toEqual([]);
    });

    it('should convert annotation policies to PolicyInfo format', () => {
      const annotations = new Map<string, AnnotationFile>();
      annotations.set('src/services/shipping.ts', {
        file: 'src/services/shipping.ts',
        system: 'delivery',
        lastAnalyzed: '2024-06-01T00:00:00Z',
        sourceHash: 'abc123',
        analyzerVersion: '1.0.0',
        model: 'test-model',
        fileSummary: {
          description: 'Shipping service',
          confidence: 0.9,
          businessDomain: 'delivery',
          keywords: ['shipping'],
        },
        annotations: [
          {
            line: 10,
            endLine: 30,
            function: 'calculateShippingFee',
            signature: 'calculateShippingFee(order: Order): number',
            original_comment: null,
            enriched_comment: 'Calculates shipping fee',
            confidence: 0.85,
            type: 'business_logic',
            userModified: false,
            lastModifiedBy: null,
            inferred_from: 'code analysis',
            policies: [
              {
                name: '무료배송 정책',
                description: '50,000원 이상 주문 시 무료배송',
                confidence: 0.8,
                category: '배송',
                inferred_from: 'threshold check in code',
              },
            ],
            relatedFunctions: [],
            relatedApis: ['/api/shipping'],
          },
        ],
      });

      const result = convertAnnotationsToPolicies(annotations);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: '무료배송 정책',
        description: '50,000원 이상 주문 시 무료배송',
        source: 'annotation',
        filePath: 'src/services/shipping.ts',
        lineNumber: 10,
        category: '배송',
        confidence: 0.8,
        relatedApis: ['/api/shipping'],
      });
      expect(result[0].id).toMatch(/^ann_policy_/);
    });

    it('should convert multiple policies from multiple files', () => {
      const annotations = new Map<string, AnnotationFile>();

      // File 1: 2 policies
      annotations.set('src/services/shipping.ts', {
        file: 'src/services/shipping.ts',
        system: 'delivery',
        lastAnalyzed: '2024-06-01T00:00:00Z',
        sourceHash: 'abc',
        analyzerVersion: '1.0.0',
        model: 'test',
        fileSummary: { description: '', confidence: 0.9, businessDomain: '', keywords: [] },
        annotations: [
          {
            line: 10, endLine: 30,
            function: 'fn1', signature: 'fn1()', original_comment: null,
            enriched_comment: '', confidence: 0.8, type: 'business_logic',
            userModified: false, lastModifiedBy: null, inferred_from: '',
            policies: [
              { name: 'Policy A', description: 'A desc', confidence: 0.7, category: '배송', inferred_from: '' },
              { name: 'Policy B', description: 'B desc', confidence: 0.6, category: '배송', inferred_from: '' },
            ],
            relatedFunctions: [], relatedApis: [],
          },
        ],
      });

      // File 2: 1 policy
      annotations.set('src/services/payment.ts', {
        file: 'src/services/payment.ts',
        system: 'payment',
        lastAnalyzed: '2024-06-01T00:00:00Z',
        sourceHash: 'def',
        analyzerVersion: '1.0.0',
        model: 'test',
        fileSummary: { description: '', confidence: 0.9, businessDomain: '', keywords: [] },
        annotations: [
          {
            line: 5, endLine: 20,
            function: 'fn2', signature: 'fn2()', original_comment: null,
            enriched_comment: '', confidence: 0.9, type: 'business_logic',
            userModified: false, lastModifiedBy: null, inferred_from: '',
            policies: [
              { name: 'Policy C', description: 'C desc', confidence: 0.85, category: '결제', inferred_from: '' },
            ],
            relatedFunctions: [], relatedApis: [],
          },
        ],
      });

      const result = convertAnnotationsToPolicies(annotations);

      expect(result).toHaveLength(3);
      expect(result.map(p => p.name)).toEqual(['Policy A', 'Policy B', 'Policy C']);
    });

    it('should set category to "기타" when not provided', () => {
      const annotations = new Map<string, AnnotationFile>();
      annotations.set('src/utils.ts', {
        file: 'src/utils.ts',
        system: 'common',
        lastAnalyzed: '2024-06-01T00:00:00Z',
        sourceHash: 'xyz',
        analyzerVersion: '1.0.0',
        model: 'test',
        fileSummary: { description: '', confidence: 0.5, businessDomain: '', keywords: [] },
        annotations: [
          {
            line: 1, endLine: 10,
            function: 'util', signature: 'util()', original_comment: null,
            enriched_comment: '', confidence: 0.5, type: 'utility',
            userModified: false, lastModifiedBy: null, inferred_from: '',
            policies: [
              { name: 'Util Policy', description: 'desc', confidence: 0.5, category: '', inferred_from: '' },
            ],
            relatedFunctions: [], relatedApis: [],
          },
        ],
      });

      const result = convertAnnotationsToPolicies(annotations);
      expect(result[0].category).toBe('기타');
    });
  });

  // ============================================================
  // mergePolicies
  // ============================================================

  describe('mergePolicies', () => {
    const indexPolicy: PolicyInfo = {
      id: 'idx_1',
      name: '무료배송 정책',
      description: '50000원 이상 무료배송',
      source: 'comment',
      sourceText: '// 50000원 이상 무료배송',
      filePath: 'src/services/shipping.ts',
      lineNumber: 15,
      category: '배송',
      relatedComponents: [],
      relatedApis: [],
      relatedModules: [],
      extractedAt: '2024-06-01T00:00:00Z',
    };

    const annotationPolicy: PolicyInfo = {
      id: 'ann_policy_0',
      name: '무료배송 정책',
      description: '50000원 이상 주문 시 배송비 무료',
      source: 'annotation',
      sourceText: 'code analysis',
      filePath: 'src/services/shipping.ts',
      lineNumber: 10,
      category: '배송',
      relatedComponents: [],
      relatedApis: [],
      relatedModules: [],
      extractedAt: '2024-06-01T00:00:00Z',
      confidence: 0.8,
    };

    it('should return index policies when no annotation policies', () => {
      const result = mergePolicies([indexPolicy], []);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('idx_1');
    });

    it('should return annotation policies when no index policies', () => {
      const result = mergePolicies([], [annotationPolicy]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ann_policy_0');
    });

    it('should remove duplicates (same filePath + same name)', () => {
      const result = mergePolicies([indexPolicy], [annotationPolicy]);
      // Index policy should be kept, annotation duplicate removed
      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('comment');
    });

    it('should remove duplicates (same filePath + similar name)', () => {
      const similarAnnotation: PolicyInfo = {
        ...annotationPolicy,
        name: '무료 배송 정책', // spaces differ
      };
      const result = mergePolicies([indexPolicy], [similarAnnotation]);
      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('comment');
    });

    it('should keep unique annotation policies', () => {
      const uniqueAnnotation: PolicyInfo = {
        ...annotationPolicy,
        id: 'ann_policy_1',
        name: '배송지 제한 정책',
        description: '제주도/도서산간 배송비 추가',
      };
      const result = mergePolicies([indexPolicy], [uniqueAnnotation]);
      expect(result).toHaveLength(2);
      expect(result.map(p => p.name)).toContain('무료배송 정책');
      expect(result.map(p => p.name)).toContain('배송지 제한 정책');
    });

    it('should keep annotation policies from different files even with same name', () => {
      const differentFileAnnotation: PolicyInfo = {
        ...annotationPolicy,
        filePath: 'src/services/delivery.ts',
      };
      const result = mergePolicies([indexPolicy], [differentFileAnnotation]);
      expect(result).toHaveLength(2);
    });
  });
});
