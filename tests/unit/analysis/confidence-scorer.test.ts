/**
 * @module tests/unit/analysis/confidence-scorer
 * @description ConfidenceScorer 단위 테스트
 */

import { ConfidenceScorer } from '../../../src/core/analysis/confidence-scorer';
import { EnrichedResult } from '../../../src/types/analysis';
import { CodeIndex } from '../../../src/types/index';
import { CONFIDENCE_WEIGHTS } from '../../../src/types/scoring';

/** 최소한의 CodeIndex 생성 */
function createMinimalIndex(): CodeIndex {
  return {
    meta: {
      version: 1,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      gitCommit: 'abc123',
      gitBranch: 'main',
      project: { name: 'test', path: '/test', techStack: [], packageManager: 'npm' },
      stats: { totalFiles: 0, screens: 0, components: 0, apiEndpoints: 0, models: 0, modules: 0 },
    },
    files: [],
    screens: [],
    components: [],
    apis: [],
    models: [],
    policies: [],
    dependencies: { graph: { nodes: [], edges: [] } },
  };
}

/** 풍부한 CodeIndex 생성 */
function createRichIndex(): CodeIndex {
  return {
    meta: {
      version: 1,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      gitCommit: 'abc123',
      gitBranch: 'main',
      project: { name: 'test', path: '/test', techStack: ['react', 'typescript'], packageManager: 'npm' },
      stats: { totalFiles: 50, screens: 5, components: 20, apiEndpoints: 10, models: 5, modules: 8 },
    },
    files: [],
    screens: [
      { id: 'screen-1', name: 'Page1', route: '/page1', filePath: 'p1.tsx', components: [], apiCalls: [], childScreens: [], metadata: { linesOfCode: 100, complexity: 'medium' } },
    ],
    components: [
      { id: 'comp-1', name: 'Comp1', filePath: 'c1.tsx', type: 'function-component', imports: [], importedBy: [], props: [], emits: [], apiCalls: [], linesOfCode: 50 },
    ],
    apis: [
      { id: 'api-1', method: 'GET', path: '/api/test', filePath: 'api.ts', handler: 'handler', calledBy: [], requestParams: [], responseType: 'any', relatedModels: [] },
    ],
    models: [],
    policies: [
      { id: 'pol-1', name: 'Policy1', description: 'Test', source: 'comment', sourceText: '', filePath: 'p1.tsx', lineNumber: 1, category: 'test', relatedComponents: [], relatedApis: [], relatedModules: [], extractedAt: '' },
    ],
    dependencies: {
      graph: {
        nodes: [
          { id: 'screen-1', type: 'screen', name: 'Page1' },
          { id: 'comp-1', type: 'component', name: 'Comp1' },
          { id: 'api-1', type: 'api', name: 'test' },
        ],
        edges: [
          { from: 'screen-1', to: 'comp-1', type: 'import' },
          { from: 'screen-1', to: 'api-1', type: 'api-call' },
          { from: 'comp-1', to: 'api-1', type: 'api-call' },
        ],
      },
    },
  };
}

/** 테스트용 EnrichedResult 생성 */
function createTestEnrichedResult(options?: {
  hasDetailedRationale?: boolean;
  hasFEandBE?: boolean;
  hasPolicyWarnings?: boolean;
}): EnrichedResult {
  const opts = {
    hasDetailedRationale: false,
    hasFEandBE: false,
    hasPolicyWarnings: false,
    ...options,
  };

  const tasks: Array<{
    id: string;
    title: string;
    type: 'FE' | 'BE';
    actionType: 'new' | 'modify' | 'config';
    description: string;
    affectedFiles: string[];
    relatedApis: string[];
    planningChecks: string[];
    rationale: string;
  }> = [
    {
      id: 'T-001',
      title: 'Task 1',
      type: 'FE',
      actionType: 'modify',
      description: 'Test task',
      affectedFiles: ['src/comp.tsx'],
      relatedApis: [],
      planningChecks: [],
      rationale: opts.hasDetailedRationale
        ? '이 작업은 CartPage.tsx 파일의 장바구니 수량 변경 로직을 수정하며, CartItem 컴포넌트와 연동됩니다.'
        : '테스트',
    },
  ];

  if (opts.hasFEandBE) {
    tasks.push({
      id: 'T-002',
      title: 'Task 2',
      type: 'BE' as 'FE' | 'BE',
      actionType: 'modify' as const,
      description: 'BE task',
      affectedFiles: ['src/api/test.ts'],
      relatedApis: ['api-1'],
      planningChecks: [],
      rationale: opts.hasDetailedRationale
        ? 'BE 작업으로 API 엔드포인트를 수정합니다. 기존 요청 파라미터와의 하위 호환성을 유지해야 합니다.'
        : '테스트',
    });
  }

  return {
    analysisId: 'test-analysis',
    analyzedAt: new Date().toISOString(),
    specTitle: '테스트',
    affectedScreens: [
      {
        screenId: 'screen-1',
        screenName: 'TestPage',
        impactLevel: 'medium',
        tasks,
      },
    ],
    tasks,
    planningChecks: opts.hasDetailedRationale
      ? [{ id: 'PC-001', content: '장바구니 수량 0 입력 시 처리 방식 확인이 필요합니다.', relatedFeatureId: 'F-001', priority: 'high' as const, status: 'pending' as const }]
      : [],
    policyChanges: [],
    screenScores: [
      {
        screenId: 'screen-1',
        screenName: 'TestPage',
        screenScore: 5,
        grade: 'Low' as const,
        taskScores: tasks.map(t => ({
          taskId: t.id,
          scores: {
            developmentComplexity: { score: 5, weight: 0.35, rationale: opts.hasDetailedRationale ? 'Detailed rationale here about complexity' : '' },
            impactScope: { score: 3, weight: 0.30, rationale: '' },
            policyChange: { score: 2, weight: 0.20, rationale: '' },
            dependencyRisk: { score: 2, weight: 0.15, rationale: '' },
          },
          totalScore: 3.35,
          grade: 'Medium' as const,
        })),
      },
    ],
    totalScore: 5,
    grade: 'Low' as const,
    recommendation: '일반 스프린트 내 처리 가능',
    policyWarnings: opts.hasPolicyWarnings
      ? [{ id: 'PW-001', policyId: 'pol-1', policyName: 'Policy1', message: 'Warning', severity: 'warning' as const, relatedTaskIds: ['T-001'] }]
      : [],
    ownerNotifications: [],
  };
}

describe('ConfidenceScorer', () => {
  let confidenceScorer: ConfidenceScorer;

  beforeEach(() => {
    confidenceScorer = new ConfidenceScorer();
  });

  describe('confidence weights', () => {
    it('should have correct layer weights', () => {
      expect(CONFIDENCE_WEIGHTS.layer1Structure).toBe(0.25);
      expect(CONFIDENCE_WEIGHTS.layer2Dependency).toBe(0.25);
      expect(CONFIDENCE_WEIGHTS.layer3Policy).toBe(0.20);
      expect(CONFIDENCE_WEIGHTS.layer4LLM).toBe(0.30);

      const sum =
        CONFIDENCE_WEIGHTS.layer1Structure +
        CONFIDENCE_WEIGHTS.layer2Dependency +
        CONFIDENCE_WEIGHTS.layer3Policy +
        CONFIDENCE_WEIGHTS.layer4LLM;
      expect(sum).toBeCloseTo(1.0, 10);
    });
  });

  describe('calculate', () => {
    it('should return confidence for each affected system', () => {
      const result = createTestEnrichedResult();
      const index = createRichIndex();

      const confidences = confidenceScorer.calculate(result, index);

      expect(confidences.length).toBeGreaterThan(0);
      const first = confidences[0];
      expect(first.systemId).toBeDefined();
      expect(first.systemName).toBeDefined();
      expect(first.overallScore).toBeGreaterThanOrEqual(0);
      expect(first.overallScore).toBeLessThanOrEqual(100);
      expect(['high', 'medium', 'low', 'very_low']).toContain(first.grade);
    });

    it('should have higher confidence with rich index', () => {
      const result = createTestEnrichedResult({
        hasDetailedRationale: true,
        hasFEandBE: true,
        hasPolicyWarnings: true,
      });
      const richIndex = createRichIndex();
      const minimalIndex = createMinimalIndex();

      const richConfidences = confidenceScorer.calculate(result, richIndex);
      const minimalConfidences = confidenceScorer.calculate(result, minimalIndex);

      // 풍부한 인덱스의 전체 점수가 더 높아야 함
      const richAvg = richConfidences.reduce((s, c) => s + c.overallScore, 0) / richConfidences.length;
      const minAvg = minimalConfidences.reduce((s, c) => s + c.overallScore, 0) / minimalConfidences.length;

      expect(richAvg).toBeGreaterThan(minAvg);
    });

    it('should assign correct grades', () => {
      const result = createTestEnrichedResult();
      const index = createRichIndex();

      const confidences = confidenceScorer.calculate(result, index);

      for (const conf of confidences) {
        if (conf.overallScore >= 85) expect(conf.grade).toBe('high');
        else if (conf.overallScore >= 65) expect(conf.grade).toBe('medium');
        else if (conf.overallScore >= 40) expect(conf.grade).toBe('low');
        else expect(conf.grade).toBe('very_low');
      }
    });

    it('should include layer scores', () => {
      const result = createTestEnrichedResult();
      const index = createRichIndex();

      const confidences = confidenceScorer.calculate(result, index);

      for (const conf of confidences) {
        expect(conf.layers.layer1Structure).toBeDefined();
        expect(conf.layers.layer2Dependency).toBeDefined();
        expect(conf.layers.layer3Policy).toBeDefined();
        expect(conf.layers.layer4LLM).toBeDefined();

        expect(conf.layers.layer1Structure.weight).toBe(0.25);
        expect(conf.layers.layer2Dependency.weight).toBe(0.25);
        expect(conf.layers.layer3Policy.weight).toBe(0.20);
        expect(conf.layers.layer4LLM.weight).toBe(0.30);
      }
    });

    it('should generate warnings for low scoring layers', () => {
      const result = createTestEnrichedResult();
      const minimalIndex = createMinimalIndex();

      const confidences = confidenceScorer.calculate(result, minimalIndex);

      // 빈 인덱스이므로 경고가 있어야 함
      const allWarnings = confidences.flatMap(c => c.warnings);
      expect(allWarnings.length).toBeGreaterThan(0);
    });

    it('should generate recommendations', () => {
      const result = createTestEnrichedResult();
      const minimalIndex = createMinimalIndex();

      const confidences = confidenceScorer.calculate(result, minimalIndex);

      const allRecommendations = confidences.flatMap(c => c.recommendations);
      expect(allRecommendations.length).toBeGreaterThan(0);
    });

    it('should handle result with no affected screens', () => {
      const result = createTestEnrichedResult();
      result.affectedScreens = [];
      result.ownerNotifications = [];

      const index = createRichIndex();

      const confidences = confidenceScorer.calculate(result, index);

      // 최소 1개 시스템 (전체 프로젝트) 반환
      expect(confidences.length).toBeGreaterThanOrEqual(1);
    });

    it('should give higher Layer 4 score when analysisMethod is llm', () => {
      const llmResult = createTestEnrichedResult();
      llmResult.analysisMethod = 'llm';

      const ruleResult = createTestEnrichedResult();
      ruleResult.analysisMethod = 'rule-based';

      const index = createRichIndex();

      const llmConfidences = confidenceScorer.calculate(llmResult, index);
      const ruleConfidences = confidenceScorer.calculate(ruleResult, index);

      const llmLayer4 = llmConfidences[0].layers.layer4LLM.score;
      const ruleLayer4 = ruleConfidences[0].layers.layer4LLM.score;

      expect(llmLayer4).toBeGreaterThan(ruleLayer4);
    });

    it('should use rationale-based fallback when analysisMethod is not set', () => {
      const resultNoMethod = createTestEnrichedResult({ hasDetailedRationale: true });
      // Ensure analysisMethod is undefined for fallback
      resultNoMethod.analysisMethod = undefined;

      const index = createRichIndex();

      const confidences = confidenceScorer.calculate(resultNoMethod, index);

      // Should still work using fallback heuristic
      expect(confidences.length).toBeGreaterThan(0);
      expect(confidences[0].layers.layer4LLM.score).toBeGreaterThan(0);
    });

    it('should report LLM-based analysis in details when analysisMethod is llm', () => {
      const result = createTestEnrichedResult();
      result.analysisMethod = 'llm';

      const index = createRichIndex();

      const confidences = confidenceScorer.calculate(result, index);

      expect(confidences[0].layers.layer4LLM.details).toBe('LLM-based analysis');
    });

    it('should report Rule-based analysis in details when analysisMethod is rule-based', () => {
      const result = createTestEnrichedResult();
      result.analysisMethod = 'rule-based';

      const index = createRichIndex();

      const confidences = confidenceScorer.calculate(result, index);

      expect(confidences[0].layers.layer4LLM.details).toBe('Rule-based analysis (no LLM)');
    });
  });
});
