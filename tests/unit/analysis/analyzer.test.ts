/**
 * @module tests/unit/analysis/analyzer
 * @description ImpactAnalyzer 단위 테스트
 */

import { ImpactAnalyzer } from '../../../src/core/analysis/analyzer';
import { ParsedSpec, MatchedEntities } from '../../../src/types/analysis';
import { CodeIndex } from '../../../src/types/index';

// fs mock
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: jest.fn().mockReturnValue(false),
    readFileSync: jest.fn().mockReturnValue(''),
  };
});

// logger mock
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

/** 테스트용 코드 인덱스 */
function createTestIndex(): CodeIndex {
  return {
    meta: {
      version: 1,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      gitCommit: 'abc123',
      gitBranch: 'main',
      project: {
        name: 'test-project',
        path: '/test',
        techStack: ['typescript', 'react'],
        packageManager: 'npm',
      },
      stats: {
        totalFiles: 10,
        screens: 2,
        components: 3,
        apiEndpoints: 2,
        models: 1,
        modules: 1,
      },
    },
    files: [],
    screens: [
      {
        id: 'screen-1',
        name: 'CartPage',
        route: '/cart',
        filePath: 'src/pages/CartPage.tsx',
        components: ['comp-1'],
        apiCalls: ['api-1'],
        childScreens: [],
        metadata: { linesOfCode: 200, complexity: 'medium' },
      },
      {
        id: 'screen-2',
        name: 'OrderPage',
        route: '/order',
        filePath: 'src/pages/OrderPage.tsx',
        components: ['comp-2'],
        apiCalls: ['api-2'],
        childScreens: [],
        metadata: { linesOfCode: 300, complexity: 'high' },
      },
    ],
    components: [
      {
        id: 'comp-1',
        name: 'CartItem',
        filePath: 'src/components/CartItem.tsx',
        type: 'function-component',
        imports: [],
        importedBy: ['screen-1'],
        props: ['item', 'onQuantityChange'],
        emits: [],
        apiCalls: [],
        linesOfCode: 80,
      },
      {
        id: 'comp-2',
        name: 'OrderForm',
        filePath: 'src/components/OrderForm.tsx',
        type: 'function-component',
        imports: [],
        importedBy: ['screen-2'],
        props: ['order'],
        emits: [],
        apiCalls: ['api-2'],
        linesOfCode: 120,
      },
    ],
    apis: [
      {
        id: 'api-1',
        method: 'GET',
        path: '/api/cart',
        filePath: 'src/api/cart.ts',
        handler: 'getCart',
        calledBy: ['screen-1'],
        requestParams: [],
        responseType: 'CartResponse',
        relatedModels: ['model-1'],
      },
      {
        id: 'api-2',
        method: 'POST',
        path: '/api/orders',
        filePath: 'src/api/orders.ts',
        handler: 'createOrder',
        calledBy: ['screen-2'],
        requestParams: ['orderData'],
        responseType: 'OrderResponse',
        relatedModels: [],
      },
    ],
    models: [
      {
        id: 'model-1',
        name: 'CartItem',
        filePath: 'src/models/CartItem.ts',
        type: 'interface',
        fields: [
          { name: 'productId', type: 'string', required: true },
          { name: 'quantity', type: 'number', required: true },
        ],
        relatedApis: ['api-1'],
      },
    ],
    policies: [
      {
        id: 'policy-1',
        name: '최소 주문 금액 정책',
        description: '최소 주문 금액은 10000원 이상이어야 합니다.',
        source: 'comment',
        sourceText: '// 최소 주문 금액 체크',
        filePath: 'src/utils/validation.ts',
        lineNumber: 42,
        category: 'business',
        relatedComponents: [],
        relatedApis: ['api-2'],
        relatedModules: [],
        extractedAt: '2024-01-01T00:00:00Z',
      },
    ],
    dependencies: {
      graph: {
        nodes: [
          { id: 'screen-1', type: 'screen', name: 'CartPage' },
          { id: 'screen-2', type: 'screen', name: 'OrderPage' },
          { id: 'comp-1', type: 'component', name: 'CartItem' },
          { id: 'api-1', type: 'api', name: 'getCart' },
        ],
        edges: [
          { from: 'screen-1', to: 'comp-1', type: 'import' },
          { from: 'screen-1', to: 'api-1', type: 'api-call' },
        ],
      },
    },
  };
}

/** 테스트용 ParsedSpec */
function createTestSpec(): ParsedSpec {
  return {
    title: '장바구니 기능 개선',
    requirements: [],
    features: [
      {
        id: 'F-001',
        name: '장바구니 수량 변경',
        description: '장바구니에서 상품 수량을 직접 입력',
        targetScreen: '장바구니',
        actionType: 'modify',
        keywords: ['cart', '장바구니', 'CartItem'],
      },
    ],
    businessRules: [
      {
        id: 'BR-001',
        description: '최소 주문 금액은 15000원 이상으로 변경',
        relatedFeatures: ['F-001'],
      },
    ],
    targetScreens: ['장바구니'],
    keywords: ['cart', '장바구니'],
    ambiguities: ['수량 제한이 있는지 확인 필요'],
  };
}

/** 테스트용 MatchedEntities */
function createTestMatched(): MatchedEntities {
  return {
    screens: [
      { id: 'screen-1', name: 'CartPage', matchScore: 0.9, matchReason: 'keyword match: cart' },
    ],
    components: [
      { id: 'comp-1', name: 'CartItem', matchScore: 0.85, matchReason: 'keyword match: CartItem' },
    ],
    apis: [
      { id: 'api-1', name: 'GET /api/cart', matchScore: 0.7, matchReason: 'path match: cart' },
      { id: 'api-2', name: 'POST /api/orders', matchScore: 0.3, matchReason: 'low relevance' },
    ],
    models: [],
  };
}

describe('ImpactAnalyzer', () => {
  let index: CodeIndex;
  let spec: ParsedSpec;
  let matched: MatchedEntities;
  let analyzer: ImpactAnalyzer;

  beforeEach(() => {
    jest.clearAllMocks();
    index = createTestIndex();
    spec = createTestSpec();
    matched = createTestMatched();
    analyzer = new ImpactAnalyzer();
  });

  describe('analyze (rule-based)', () => {
    it('should analyze with rule-based method', async () => {
      const result = await analyzer.analyze(spec, matched, index);

      expect(result.specTitle).toBe('장바구니 기능 개선');
      expect(result.analysisId).toMatch(/^analysis-/);
      expect(result.analyzedAt).toBeTruthy();
      expect(result.analysisMethod).toBe('rule-based');
    });

    it('should generate affectedScreens from matched screens', async () => {
      const result = await analyzer.analyze(spec, matched, index);

      expect(result.affectedScreens).toHaveLength(1);
      expect(result.affectedScreens[0].screenId).toBe('screen-1');
      expect(result.affectedScreens[0].screenName).toBe('CartPage');
    });

    it('should generate tasks for matching features and screens', async () => {
      const result = await analyzer.analyze(spec, matched, index);

      // CartPage should get a task from the feature
      const screenTasks = result.affectedScreens[0].tasks;
      expect(screenTasks.length).toBeGreaterThan(0);
      expect(screenTasks[0].title).toContain('[FE]');
      expect(screenTasks[0].title).toContain('장바구니 수량 변경');
      expect(screenTasks[0].type).toBe('FE');
      expect(screenTasks[0].actionType).toBe('modify');
      expect(screenTasks[0].affectedFiles).toContain('src/pages/CartPage.tsx');
    });

    it('should generate BE tasks for high-score matched APIs', async () => {
      const result = await analyzer.analyze(spec, matched, index);

      // api-1 has matchScore 0.7 (> 0.5), so it gets a BE task
      const beTasks = result.tasks.filter(t => t.type === 'BE');
      expect(beTasks.length).toBeGreaterThan(0);
      expect(beTasks[0].title).toContain('[BE]');
      expect(beTasks[0].actionType).toBe('modify');
    });

    it('should NOT generate BE tasks for low-score APIs', async () => {
      const result = await analyzer.analyze(spec, matched, index);

      // api-2 has matchScore 0.3 (< 0.5), should be excluded
      const orderApiTask = result.tasks.find(t =>
        t.title.includes('POST /api/orders'),
      );
      expect(orderApiTask).toBeUndefined();
    });

    it('should generate planning checks from ambiguities', async () => {
      const result = await analyzer.analyze(spec, matched, index);

      expect(result.planningChecks.length).toBeGreaterThan(0);
      const check = result.planningChecks.find(c =>
        c.content.includes('수량 제한이 있는지 확인 필요'),
      );
      expect(check).toBeDefined();
      expect(check!.priority).toBe('high');
      expect(check!.status).toBe('pending');
      expect(check!.id).toMatch(/^PC-/);
    });

    it('should detect policy changes from business rules', async () => {
      const result = await analyzer.analyze(spec, matched, index);

      // businessRule mentions "최소 주문 금액" which overlaps with policy "최소 주문 금액 정책"
      expect(result.policyChanges.length).toBeGreaterThan(0);
      const policyChange = result.policyChanges[0];
      expect(policyChange.id).toMatch(/^POL-/);
      expect(policyChange.policyName).toBe('최소 주문 금액 정책');
      expect(policyChange.changeType).toBe('modify');
      expect(policyChange.requiresReview).toBe(true);
    });

    it('should determine impact level based on matchScore and taskCount', async () => {
      const result = await analyzer.analyze(spec, matched, index);

      // matchScore=0.9, taskCount varies
      const level = result.affectedScreens[0].impactLevel;
      expect(['low', 'medium', 'high', 'critical']).toContain(level);
    });

    it('should handle empty spec features gracefully', async () => {
      const emptySpec: ParsedSpec = {
        title: '빈 기획서',
        requirements: [],
        features: [],
        businessRules: [],
        targetScreens: [],
        keywords: [],
        ambiguities: [],
      };

      const result = await analyzer.analyze(emptySpec, matched, index);

      // Still creates screen impacts from matched, but tasks may be minimal
      expect(result.specTitle).toBe('빈 기획서');
      expect(result.affectedScreens).toHaveLength(1);
    });

    it('should handle no matching screens', async () => {
      const emptyMatched: MatchedEntities = {
        screens: [],
        components: [],
        apis: [],
        models: [],
      };

      const result = await analyzer.analyze(spec, emptyMatched, index);

      expect(result.affectedScreens).toHaveLength(0);
      expect(result.planningChecks.length).toBeGreaterThan(0); // ambiguities still generate checks
    });

    it('should generate low-confidence checks for screens with low matchScore', async () => {
      const lowConfMatched: MatchedEntities = {
        screens: [
          { id: 'screen-1', name: 'CartPage', matchScore: 0.3, matchReason: 'weak' },
        ],
        components: [],
        apis: [],
        models: [],
      };

      const result = await analyzer.analyze(spec, lowConfMatched, index);

      // Should have planning check about low confidence for CartPage
      const lowConfCheck = result.planningChecks.find(c =>
        c.content.includes('CartPage') && c.content.includes('매칭 신뢰도'),
      );
      expect(lowConfCheck).toBeDefined();
      expect(lowConfCheck!.priority).toBe('medium');
    });
  });

  describe('isFeatureRelevantToScreen (via analyze)', () => {
    it('should match feature by targetScreen name', async () => {
      const specWithTarget: ParsedSpec = {
        title: 'Test',
        requirements: [],
        features: [
          {
            id: 'F-001',
            name: 'Cart Feature',
            description: 'Cart feature',
            targetScreen: 'CartPage',
            actionType: 'modify',
            keywords: [],
          },
        ],
        businessRules: [],
        targetScreens: [],
        keywords: [],
        ambiguities: [],
      };

      const matchedWithCart: MatchedEntities = {
        screens: [
          { id: 'screen-1', name: 'CartPage', matchScore: 0.8, matchReason: 'direct' },
        ],
        components: [],
        apis: [],
        models: [],
      };

      const result = await analyzer.analyze(specWithTarget, matchedWithCart, index);

      const screenTasks = result.affectedScreens[0].tasks;
      expect(screenTasks.length).toBe(1);
      expect(screenTasks[0].title).toContain('Cart Feature');
    });

    it('should match feature by keyword in screen name', async () => {
      const specWithKeyword: ParsedSpec = {
        title: 'Test',
        requirements: [],
        features: [
          {
            id: 'F-001',
            name: 'Order Feature',
            description: 'Order feature',
            targetScreen: '',
            actionType: 'new',
            keywords: ['order'],
          },
        ],
        businessRules: [],
        targetScreens: [],
        keywords: [],
        ambiguities: [],
      };

      const matchedWithOrder: MatchedEntities = {
        screens: [
          { id: 'screen-2', name: 'OrderPage', matchScore: 0.8, matchReason: 'direct' },
        ],
        components: [],
        apis: [],
        models: [],
      };

      const result = await analyzer.analyze(specWithKeyword, matchedWithOrder, index);

      const screenTasks = result.affectedScreens[0].tasks;
      expect(screenTasks.length).toBe(1);
      expect(screenTasks[0].title).toContain('Order Feature');
    });

    it('should include feature for all screens when only one feature exists and no match', async () => {
      const specSingle: ParsedSpec = {
        title: 'Test',
        requirements: [],
        features: [
          {
            id: 'F-001',
            name: 'Unrelated Feature',
            description: 'Unrelated',
            targetScreen: 'SomethingElse',
            actionType: 'modify',
            keywords: ['xyz'],
          },
        ],
        businessRules: [],
        targetScreens: [],
        keywords: [],
        ambiguities: [],
      };

      const matchedWithCart: MatchedEntities = {
        screens: [
          { id: 'screen-1', name: 'CartPage', matchScore: 0.8, matchReason: 'direct' },
        ],
        components: [],
        apis: [],
        models: [],
      };

      const result = await analyzer.analyze(specSingle, matchedWithCart, index);

      // With only 1 feature, it should be included for every screen (spec.features.length <= 1)
      const screenTasks = result.affectedScreens[0].tasks;
      expect(screenTasks.length).toBe(1);
    });

    it('should skip irrelevant features when multiple features exist', async () => {
      const specMultiple: ParsedSpec = {
        title: 'Test',
        requirements: [],
        features: [
          {
            id: 'F-001',
            name: 'Cart Feature',
            description: 'cart feature',
            targetScreen: 'CartPage',
            actionType: 'modify',
            keywords: ['cart'],
          },
          {
            id: 'F-002',
            name: 'Order Feature',
            description: 'order feature',
            targetScreen: 'OrderPage',
            actionType: 'new',
            keywords: ['order'],
          },
        ],
        businessRules: [],
        targetScreens: [],
        keywords: [],
        ambiguities: [],
      };

      const matchedWithCart: MatchedEntities = {
        screens: [
          { id: 'screen-1', name: 'CartPage', matchScore: 0.8, matchReason: 'direct' },
        ],
        components: [],
        apis: [],
        models: [],
      };

      const result = await analyzer.analyze(specMultiple, matchedWithCart, index);

      // Only the Cart Feature should match for CartPage (not Order Feature)
      const screenTasks = result.affectedScreens[0].tasks;
      expect(screenTasks.length).toBe(1);
      expect(screenTasks[0].title).toContain('Cart Feature');
    });
  });

  describe('sourceRequirementIds / sourceFeatureIds (REQ-009: traceability)', () => {
    it('should include sourceFeatureIds on FE tasks', async () => {
      const result = await analyzer.analyze(spec, matched, index);

      const feTasks = result.affectedScreens[0].tasks;
      expect(feTasks.length).toBeGreaterThan(0);

      // FE task from feature F-001 should have sourceFeatureIds = ['F-001']
      const feTask = feTasks[0];
      expect(feTask.sourceFeatureIds).toBeDefined();
      expect(feTask.sourceFeatureIds).toContain('F-001');
    });

    it('should include sourceRequirementIds on FE tasks when requirements match', async () => {
      const specWithReqs: ParsedSpec = {
        ...spec,
        requirements: [
          {
            id: 'REQ-001',
            name: '장바구니 수량 변경 요구사항',
            description: '장바구니에서 수량을 직접 입력하여 변경할 수 있어야 한다',
            priority: 'must',
            relatedFeatures: ['F-001'],
          },
        ],
      };

      const result = await analyzer.analyze(specWithReqs, matched, index);

      const feTasks = result.affectedScreens[0].tasks;
      expect(feTasks.length).toBeGreaterThan(0);

      // Task title/description contains "장바구니" which overlaps with REQ-001 name/description
      const feTask = feTasks[0];
      expect(feTask.sourceRequirementIds).toBeDefined();
      expect(feTask.sourceRequirementIds!.length).toBeGreaterThan(0);
      expect(feTask.sourceRequirementIds).toContain('REQ-001');
    });

    it('should include sourceFeatureIds on BE tasks', async () => {
      const result = await analyzer.analyze(spec, matched, index);

      const beTasks = result.tasks.filter(t => t.type === 'BE');
      expect(beTasks.length).toBeGreaterThan(0);

      // BE tasks should also have sourceFeatureIds (matched via keyword overlap)
      const beTask = beTasks[0];
      expect(beTask.sourceFeatureIds).toBeDefined();
      // sourceFeatureIds may or may not match depending on keyword overlap
      expect(Array.isArray(beTask.sourceFeatureIds)).toBe(true);
    });

    it('should include sourceRequirementIds on BE tasks', async () => {
      const result = await analyzer.analyze(spec, matched, index);

      const beTasks = result.tasks.filter(t => t.type === 'BE');
      expect(beTasks.length).toBeGreaterThan(0);

      const beTask = beTasks[0];
      expect(beTask.sourceRequirementIds).toBeDefined();
      expect(Array.isArray(beTask.sourceRequirementIds)).toBe(true);
    });

    it('should return empty sourceRequirementIds when no requirements in spec', async () => {
      const specNoReqs: ParsedSpec = {
        ...spec,
        requirements: [],
      };

      const result = await analyzer.analyze(specNoReqs, matched, index);

      const allTasks = result.tasks;
      for (const task of allTasks) {
        expect(task.sourceRequirementIds).toBeDefined();
        expect(task.sourceRequirementIds).toHaveLength(0);
      }
    });
  });

  describe('hasOverlap stop words (M8)', () => {
    it('should NOT match when only common Korean stop words overlap', async () => {
      // "변경 필요 작업" vs "변경 처리 확인" - only stop words overlap
      const specWithStopWords: ParsedSpec = {
        title: '테스트',
        requirements: [],
        features: [],
        businessRules: [
          {
            id: 'BR-001',
            description: '변경 필요 작업',
            relatedFeatures: [],
          },
        ],
        targetScreens: [],
        keywords: [],
        ambiguities: [],
      };

      const indexWithStopWordPolicy: CodeIndex = {
        ...index,
        policies: [
          {
            id: 'policy-stop',
            name: '변경 처리 확인',
            description: '일반 정책',
            source: 'comment',
            sourceText: '',
            filePath: 'src/utils/test.ts',
            lineNumber: 1,
            category: 'business',
            relatedComponents: [],
            relatedApis: [],
            relatedModules: [],
            extractedAt: '2024-01-01T00:00:00Z',
          },
        ],
      };

      const result = await analyzer.analyze(specWithStopWords, matched, indexWithStopWordPolicy);

      // Should NOT detect policy changes because only stop words overlap
      expect(result.policyChanges).toHaveLength(0);
    });

    it('should still match when meaningful words overlap beyond stop words', async () => {
      // "최소 주문 금액 변경 필요" vs "최소 주문 금액 정책" - "주문", "금액" are meaningful
      const result = await analyzer.analyze(spec, matched, index);

      // "최소 주문 금액은 15000원 이상으로 변경" overlaps with "최소 주문 금액 정책"
      // because "주문", "금액", "최소" are not stop words
      expect(result.policyChanges.length).toBeGreaterThan(0);
    });
  });

  describe('analysisMethod flag (M6)', () => {
    it('should always set analysisMethod to rule-based', async () => {
      const result = await analyzer.analyze(spec, matched, index);

      expect(result.analysisMethod).toBe('rule-based');
    });
  });

  describe('buildValidFilePathSet', () => {
    it('should collect all file paths from index', () => {
      const paths = analyzer.buildValidFilePathSet(index);

      expect(paths.has('src/pages/CartPage.tsx')).toBe(true);
      expect(paths.has('src/pages/OrderPage.tsx')).toBe(true);
      expect(paths.has('src/components/CartItem.tsx')).toBe(true);
      expect(paths.has('src/components/OrderForm.tsx')).toBe(true);
      expect(paths.has('src/api/cart.ts')).toBe(true);
      expect(paths.has('src/api/orders.ts')).toBe(true);
      expect(paths.has('src/models/CartItem.ts')).toBe(true);
      expect(paths.has('src/utils/validation.ts')).toBe(true);
    });

    it('should not contain paths not in index', () => {
      const paths = analyzer.buildValidFilePathSet(index);

      expect(paths.has('src/nonexistent.ts')).toBe(false);
    });
  });
});
