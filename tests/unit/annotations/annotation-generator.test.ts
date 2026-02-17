/**
 * @module tests/unit/annotations/annotation-generator
 * @description AnnotationGenerator 단위 테스트
 */

import {
  AnnotationGenerator,
  FileContext,
} from '../../../src/core/annotations/annotation-generator';
import type { ParsedFile, FunctionInfo } from '../../../src/core/indexing/types';

// ============================================================
// 테스트 헬퍼
// ============================================================

/** 빈 ParsedFile 생성 */
function createParsedFile(overrides?: Partial<ParsedFile>): ParsedFile {
  return {
    filePath: overrides?.filePath ?? 'src/services/order-service.ts',
    imports: overrides?.imports ?? [],
    exports: overrides?.exports ?? [],
    functions: overrides?.functions ?? [],
    components: overrides?.components ?? [],
    apiCalls: overrides?.apiCalls ?? [],
    routeDefinitions: overrides?.routeDefinitions ?? [],
    comments: overrides?.comments ?? [],
  };
}

/** FunctionInfo 생성 헬퍼 */
function createFunctionInfo(overrides?: Partial<FunctionInfo>): FunctionInfo {
  return {
    name: overrides?.name ?? 'testFunction',
    signature: overrides?.signature ?? 'function testFunction()',
    startLine: overrides?.startLine ?? 1,
    endLine: overrides?.endLine ?? 5,
    params: overrides?.params ?? [],
    returnType: overrides?.returnType,
    isAsync: overrides?.isAsync ?? false,
    isExported: overrides?.isExported ?? false,
  };
}

/** FileContext 생성 헬퍼 */
function createFileContext(overrides?: Partial<FileContext>): FileContext {
  return {
    filePath: overrides?.filePath ?? 'src/services/order-service.ts',
    fileName: overrides?.fileName ?? 'order-service',
    imports: overrides?.imports ?? [],
    existingComments: overrides?.existingComments ?? [],
    fileType: overrides?.fileType ?? 'service',
  };
}

// ============================================================
// Tests
// ============================================================

describe('AnnotationGenerator', () => {
  let generator: AnnotationGenerator;

  beforeEach(() => {
    generator = new AnnotationGenerator();
  });

  // --------------------------------------------------------
  // generateForFile
  // --------------------------------------------------------

  describe('generateForFile', () => {
    it('should generate AnnotationFile from ParsedFile with functions', async () => {
      const parsedFile = createParsedFile({
        filePath: 'src/services/order-service.ts',
        functions: [
          createFunctionInfo({
            name: 'calculateTotalPrice',
            signature: 'function calculateTotalPrice(items: Item[]): number',
            startLine: 10,
            endLine: 25,
            params: [{ name: 'items', type: 'Item[]' }],
            returnType: 'number',
          }),
        ],
      });

      const result = await generator.generateForFile(
        'src/services/order-service.ts',
        parsedFile,
        '/project',
      );

      expect(result.file).toBe('src/services/order-service.ts');
      expect(result.system).toBe('services');
      expect(result.analyzerVersion).toBe('1.0.0');
      expect(result.model).toBe('rule-based-v1');
      expect(result.annotations).toHaveLength(1);
      expect(result.annotations[0].function).toBe('calculateTotalPrice');
      expect(result.fileSummary.description).toContain('order-service');
      expect(result.lastAnalyzed).toBeDefined();
    });

    it('should include sourceHash in AnnotationFile', async () => {
      const parsedFile = createParsedFile({
        functions: [
          createFunctionInfo({
            name: 'doSomething',
            signature: 'function doSomething()',
          }),
        ],
      });

      const result = await generator.generateForFile(
        'src/services/test.ts',
        parsedFile,
        '/project',
      );

      expect(result.sourceHash).toBeDefined();
      expect(result.sourceHash).toHaveLength(64); // SHA-256 hex
    });

    it('should handle empty function list', async () => {
      const parsedFile = createParsedFile({
        functions: [],
      });

      const result = await generator.generateForFile(
        'src/services/empty.ts',
        parsedFile,
        '/project',
      );

      expect(result.annotations).toHaveLength(0);
      expect(result.fileSummary.description).toContain('0개 함수');
      expect(result.fileSummary.confidence).toBe(0);
    });
  });

  // --------------------------------------------------------
  // generateBatch
  // --------------------------------------------------------

  describe('generateBatch', () => {
    it('should process multiple files', async () => {
      const files = [
        {
          filePath: 'src/services/order-service.ts',
          parsedFile: createParsedFile({
            filePath: 'src/services/order-service.ts',
            functions: [createFunctionInfo({ name: 'createOrder' })],
          }),
        },
        {
          filePath: 'src/utils/formatter.ts',
          parsedFile: createParsedFile({
            filePath: 'src/utils/formatter.ts',
            functions: [createFunctionInfo({ name: 'formatDate' })],
          }),
        },
      ];

      const results = await generator.generateBatch(files, '/project');

      expect(results.size).toBe(2);
      expect(results.has('src/services/order-service.ts')).toBe(true);
      expect(results.has('src/utils/formatter.ts')).toBe(true);
    });

    it('should call progress callback', async () => {
      const files = [
        {
          filePath: 'src/a.ts',
          parsedFile: createParsedFile({ functions: [] }),
        },
        {
          filePath: 'src/b.ts',
          parsedFile: createParsedFile({ functions: [] }),
        },
        {
          filePath: 'src/c.ts',
          parsedFile: createParsedFile({ functions: [] }),
        },
      ];

      const progressCalls: Array<{ current: number; total: number; filePath: string }> = [];
      await generator.generateBatch(files, '/project', (current, total, filePath) => {
        progressCalls.push({ current, total, filePath });
      });

      expect(progressCalls).toHaveLength(3);
      expect(progressCalls[0]).toEqual({ current: 1, total: 3, filePath: 'src/a.ts' });
      expect(progressCalls[1]).toEqual({ current: 2, total: 3, filePath: 'src/b.ts' });
      expect(progressCalls[2]).toEqual({ current: 3, total: 3, filePath: 'src/c.ts' });
    });

    it('should filter by priorityTypes when specified', async () => {
      const genWithFilter = new AnnotationGenerator({
        priorityTypes: ['service'],
      });

      const files = [
        {
          filePath: 'src/services/order-service.ts',
          parsedFile: createParsedFile({ functions: [createFunctionInfo()] }),
        },
        {
          filePath: 'src/utils/helper.ts',
          parsedFile: createParsedFile({ functions: [createFunctionInfo()] }),
        },
      ];

      const results = await genWithFilter.generateBatch(files, '/project');

      expect(results.size).toBe(1);
      expect(results.has('src/services/order-service.ts')).toBe(true);
    });
  });

  // --------------------------------------------------------
  // analyzeFunction
  // --------------------------------------------------------

  describe('analyzeFunction', () => {
    it('should generate enriched_comment from function name', () => {
      const func = createFunctionInfo({
        name: 'calculateDiscount',
        signature: 'function calculateDiscount(amount: number): number',
        params: [{ name: 'amount', type: 'number' }],
        returnType: 'number',
        startLine: 1,
        endLine: 15,
      });
      const fileContext = createFileContext({ fileType: 'service' });

      const result = generator.analyzeFunction(func, 'src/services/pricing.ts', fileContext);

      expect(result.function).toBe('calculateDiscount');
      expect(result.enriched_comment).toBeDefined();
      expect(result.enriched_comment.length).toBeGreaterThan(0);
      expect(result.enriched_comment).toContain('계산');
    });

    it('should set correct start and end lines', () => {
      const func = createFunctionInfo({
        name: 'processOrder',
        startLine: 42,
        endLine: 100,
      });
      const fileContext = createFileContext();

      const result = generator.analyzeFunction(func, 'src/services/order.ts', fileContext);

      expect(result.line).toBe(42);
      expect(result.endLine).toBe(100);
    });

    it('should set userModified to false and lastModifiedBy to null', () => {
      const func = createFunctionInfo({ name: 'doStuff' });
      const fileContext = createFileContext();

      const result = generator.analyzeFunction(func, 'test.ts', fileContext);

      expect(result.userModified).toBe(false);
      expect(result.lastModifiedBy).toBeNull();
    });
  });

  // --------------------------------------------------------
  // inferPolicies
  // --------------------------------------------------------

  describe('inferPolicies', () => {
    it('should infer pricing policy from calculate function', () => {
      const func = createFunctionInfo({
        name: 'calculateDiscount',
        params: [{ name: 'price', type: 'number' }],
        returnType: 'number',
      });
      const fileContext = createFileContext();

      const policies = generator.inferPolicies(func, fileContext);

      // Should match both "계산" and "가격" patterns
      expect(policies.length).toBeGreaterThanOrEqual(1);

      const calcPolicy = policies.find((p) => p.category === '계산');
      expect(calcPolicy).toBeDefined();
      expect(calcPolicy!.name).toContain('계산 정책');
      expect(calcPolicy!.inferred_from).toContain('함수명 패턴 매칭');

      const pricePolicy = policies.find((p) => p.category === '가격');
      expect(pricePolicy).toBeDefined();
      expect(pricePolicy!.name).toContain('가격 정책');
    });

    it('should infer validation policy from check function', () => {
      const func = createFunctionInfo({
        name: 'checkInventory',
        params: [{ name: 'productId', type: 'string' }],
        returnType: 'boolean',
      });
      const fileContext = createFileContext();

      const policies = generator.inferPolicies(func, fileContext);

      const validationPolicy = policies.find((p) => p.category === '검증');
      expect(validationPolicy).toBeDefined();
      expect(validationPolicy!.name).toContain('검증 정책');
      expect(validationPolicy!.description).toContain('검증');
    });

    it('should infer shipping policy from deliver function', () => {
      const func = createFunctionInfo({
        name: 'calculateDeliveryFee',
        params: [
          { name: 'address', type: 'Address' },
          { name: 'weight', type: 'number' },
        ],
        returnType: 'number',
      });
      const fileContext = createFileContext();

      const policies = generator.inferPolicies(func, fileContext);

      const shippingPolicy = policies.find((p) => p.category === '배송');
      expect(shippingPolicy).toBeDefined();
      expect(shippingPolicy!.name).toContain('배송 정책');
    });

    it('should include inputVariables from function params', () => {
      const func = createFunctionInfo({
        name: 'validateOrder',
        params: [
          { name: 'orderId', type: 'string' },
          { name: 'userId', type: 'number' },
        ],
      });
      const fileContext = createFileContext();

      const policies = generator.inferPolicies(func, fileContext);

      expect(policies.length).toBeGreaterThan(0);
      const policy = policies[0];
      expect(policy.inputVariables).toBeDefined();
      expect(policy.inputVariables!.length).toBe(2);
      expect(policy.inputVariables![0].name).toBe('orderId');
      expect(policy.inputVariables![0].type).toBe('string');
      expect(policy.inputVariables![1].name).toBe('userId');
      expect(policy.inputVariables![1].type).toBe('number');
    });

    it('should include constants and conditions as empty arrays', () => {
      const func = createFunctionInfo({
        name: 'calculateTotal',
        params: [{ name: 'items', type: 'Item[]' }],
      });
      const fileContext = createFileContext();

      const policies = generator.inferPolicies(func, fileContext);

      expect(policies.length).toBeGreaterThan(0);
      expect(policies[0].conditions).toEqual([]);
      expect(policies[0].constants).toEqual([]);
    });

    it('should return empty policies for non-matching function names', () => {
      const func = createFunctionInfo({
        name: 'render',
        params: [],
      });
      const fileContext = createFileContext();

      const policies = generator.inferPolicies(func, fileContext);

      expect(policies).toEqual([]);
    });

    it('should skip policies in basic depth mode', () => {
      const basicGen = new AnnotationGenerator({ depth: 'basic' });
      const func = createFunctionInfo({
        name: 'calculatePrice',
        params: [{ name: 'amount', type: 'number' }],
      });
      const fileContext = createFileContext();

      const policies = basicGen.inferPolicies(func, fileContext);

      expect(policies).toEqual([]);
    });
  });

  // --------------------------------------------------------
  // classifyFunctionType
  // --------------------------------------------------------

  describe('classifyFunctionType', () => {
    it('should classify service file functions as business_logic', () => {
      const func = createFunctionInfo({ name: 'processOrder' });
      const fileContext = createFileContext({ fileType: 'service' });

      const result = generator.classifyFunctionType(func, fileContext);

      expect(result).toBe('business_logic');
    });

    it('should classify controller file functions as integration', () => {
      const func = createFunctionInfo({ name: 'handleRequest' });
      const fileContext = createFileContext({ fileType: 'controller' });

      const result = generator.classifyFunctionType(func, fileContext);

      expect(result).toBe('integration');
    });

    it('should classify component file functions as integration', () => {
      const func = createFunctionInfo({ name: 'ProductCard' });
      const fileContext = createFileContext({ fileType: 'component' });

      const result = generator.classifyFunctionType(func, fileContext);

      expect(result).toBe('integration');
    });

    it('should classify util file functions as utility', () => {
      const func = createFunctionInfo({ name: 'formatDate' });
      const fileContext = createFileContext({ fileType: 'util' });

      const result = generator.classifyFunctionType(func, fileContext);

      expect(result).toBe('utility');
    });

    it('should classify model file functions as data_access', () => {
      const func = createFunctionInfo({ name: 'findById' });
      const fileContext = createFileContext({ fileType: 'model' });

      const result = generator.classifyFunctionType(func, fileContext);

      expect(result).toBe('data_access');
    });

    it('should classify config file functions as config', () => {
      const func = createFunctionInfo({ name: 'getDbConfig' });
      const fileContext = createFileContext({ fileType: 'config' });

      const result = generator.classifyFunctionType(func, fileContext);

      expect(result).toBe('config');
    });

    it('should use function name pattern when file type is unknown', () => {
      const funcGet = createFunctionInfo({ name: 'getUserById' });
      const funcCalc = createFunctionInfo({ name: 'calculateTotal' });
      const funcFormat = createFunctionInfo({ name: 'formatCurrency' });
      const funcHandle = createFunctionInfo({ name: 'handleSubmit' });
      const funcInit = createFunctionInfo({ name: 'initApp' });
      const fileContext = createFileContext({ fileType: 'unknown' });

      expect(generator.classifyFunctionType(funcGet, fileContext)).toBe('data_access');
      expect(generator.classifyFunctionType(funcCalc, fileContext)).toBe('business_logic');
      expect(generator.classifyFunctionType(funcFormat, fileContext)).toBe('utility');
      expect(generator.classifyFunctionType(funcHandle, fileContext)).toBe('integration');
      expect(generator.classifyFunctionType(funcInit, fileContext)).toBe('config');
    });

    it('should default to business_logic for unknown patterns', () => {
      const func = createFunctionInfo({ name: 'doSomething' });
      const fileContext = createFileContext({ fileType: 'unknown' });

      const result = generator.classifyFunctionType(func, fileContext);

      expect(result).toBe('business_logic');
    });
  });

  // --------------------------------------------------------
  // calculateConfidence
  // --------------------------------------------------------

  describe('calculateConfidence', () => {
    it('should return base score of 0.5 for minimal function', () => {
      const func = createFunctionInfo({
        name: 'foo',
        params: [],
        startLine: 1,
        endLine: 3,
      });

      const result = generator.calculateConfidence(func, [], null);

      expect(result).toBe(0.5);
    });

    it('should increase score when JSDoc comment exists', () => {
      const func = createFunctionInfo({
        name: 'foo',
        params: [],
        startLine: 1,
        endLine: 3,
      });

      const withComment = generator.calculateConfidence(func, [], '/** Does something */');
      const withoutComment = generator.calculateConfidence(func, [], null);

      expect(withComment).toBeGreaterThan(withoutComment);
      expect(withComment).toBeCloseTo(0.6, 5);
    });

    it('should increase score when params have types', () => {
      const funcWithTypes = createFunctionInfo({
        name: 'foo',
        params: [{ name: 'x', type: 'number' }],
        startLine: 1,
        endLine: 3,
      });
      const funcWithoutTypes = createFunctionInfo({
        name: 'foo',
        params: [{ name: 'x' }],
        startLine: 1,
        endLine: 3,
      });

      const withTypes = generator.calculateConfidence(funcWithTypes, [], null);
      const withoutTypes = generator.calculateConfidence(funcWithoutTypes, [], null);

      expect(withTypes).toBeGreaterThan(withoutTypes);
    });

    it('should increase score when return type is specified', () => {
      const funcWithReturn = createFunctionInfo({
        name: 'foo',
        params: [],
        returnType: 'string',
        startLine: 1,
        endLine: 3,
      });
      const funcWithoutReturn = createFunctionInfo({
        name: 'foo',
        params: [],
        startLine: 1,
        endLine: 3,
      });

      const withReturn = generator.calculateConfidence(funcWithReturn, [], null);
      const withoutReturn = generator.calculateConfidence(funcWithoutReturn, [], null);

      expect(withReturn).toBeGreaterThan(withoutReturn);
      expect(withReturn).toBeCloseTo(0.6, 5);
    });

    it('should increase score when policies are inferred', () => {
      const func = createFunctionInfo({
        name: 'foo',
        params: [],
        startLine: 1,
        endLine: 3,
      });

      const mockPolicy = {
        name: 'test policy',
        description: 'test',
        confidence: 0.5,
        category: 'test',
        inferred_from: 'test',
      };

      const withPolicies = generator.calculateConfidence(func, [mockPolicy], null);
      const withoutPolicies = generator.calculateConfidence(func, [], null);

      expect(withPolicies).toBeGreaterThan(withoutPolicies);
    });

    it('should increase score when function body is 10+ lines', () => {
      const longFunc = createFunctionInfo({
        name: 'foo',
        params: [],
        startLine: 1,
        endLine: 15, // 15 lines
      });
      const shortFunc = createFunctionInfo({
        name: 'foo',
        params: [],
        startLine: 1,
        endLine: 3, // 3 lines
      });

      const longScore = generator.calculateConfidence(longFunc, [], null);
      const shortScore = generator.calculateConfidence(shortFunc, [], null);

      expect(longScore).toBeGreaterThan(shortScore);
    });

    it('should cap confidence at 1.0', () => {
      const func = createFunctionInfo({
        name: 'calculateDiscount',
        params: [{ name: 'price', type: 'number' }, { name: 'rate', type: 'number' }],
        returnType: 'number',
        startLine: 1,
        endLine: 30,
      });

      // All bonuses: comment + typed params + return type + policies + long body
      const mockPolicy = {
        name: 'test',
        description: 'test',
        confidence: 0.5,
        category: 'test',
        inferred_from: 'test',
      };

      const result = generator.calculateConfidence(func, [mockPolicy], '/** JSDoc */');

      expect(result).toBeLessThanOrEqual(1.0);
    });
  });

  // --------------------------------------------------------
  // calculateSourceHash
  // --------------------------------------------------------

  describe('calculateSourceHash', () => {
    it('should return SHA-256 hex string', () => {
      const hash = generator.calculateSourceHash('hello world');

      expect(hash).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
    });

    it('should return same hash for same content', () => {
      const hash1 = generator.calculateSourceHash('same content');
      const hash2 = generator.calculateSourceHash('same content');

      expect(hash1).toBe(hash2);
    });

    it('should return different hash for different content', () => {
      const hash1 = generator.calculateSourceHash('content A');
      const hash2 = generator.calculateSourceHash('content B');

      expect(hash1).not.toBe(hash2);
    });
  });

  // --------------------------------------------------------
  // generateEnrichedComment
  // --------------------------------------------------------

  describe('generateEnrichedComment', () => {
    it('should include function intent in comment', () => {
      const func = createFunctionInfo({
        name: 'calculatePrice',
        params: [{ name: 'amount', type: 'number' }],
        returnType: 'number',
      });
      const fileContext = createFileContext();

      const comment = generator.generateEnrichedComment(func, fileContext);

      expect(comment).toContain('계산');
    });

    it('should include parameter info in comment', () => {
      const func = createFunctionInfo({
        name: 'processItems',
        params: [
          { name: 'items', type: 'Item[]' },
          { name: 'count', type: 'number' },
        ],
      });
      const fileContext = createFileContext();

      const comment = generator.generateEnrichedComment(func, fileContext);

      expect(comment).toContain('items (Item[])');
      expect(comment).toContain('count (number)');
    });

    it('should include return type in comment', () => {
      const func = createFunctionInfo({
        name: 'getUser',
        params: [{ name: 'id', type: 'string' }],
        returnType: 'User',
      });
      const fileContext = createFileContext();

      const comment = generator.generateEnrichedComment(func, fileContext);

      expect(comment).toContain('반환: User');
    });

    it('should include async indicator', () => {
      const func = createFunctionInfo({
        name: 'fetchData',
        isAsync: true,
      });
      const fileContext = createFileContext();

      const comment = generator.generateEnrichedComment(func, fileContext);

      expect(comment).toContain('비동기 처리');
    });

    it('should include file type context', () => {
      const func = createFunctionInfo({ name: 'doWork' });
      const fileContext = createFileContext({ fileType: 'service' });

      const comment = generator.generateEnrichedComment(func, fileContext);

      expect(comment).toContain('위치: service');
    });

    it('should not include file type for unknown type', () => {
      const func = createFunctionInfo({ name: 'doWork' });
      const fileContext = createFileContext({ fileType: 'unknown' });

      const comment = generator.generateEnrichedComment(func, fileContext);

      expect(comment).not.toContain('위치:');
    });
  });

  // --------------------------------------------------------
  // InferredPolicy structure validation
  // --------------------------------------------------------

  describe('InferredPolicy structure', () => {
    it('should include conditions, inputVariables, and constants', () => {
      const func = createFunctionInfo({
        name: 'calculateShippingFee',
        params: [
          { name: 'weight', type: 'number' },
          { name: 'distance', type: 'number' },
        ],
        returnType: 'number',
        startLine: 1,
        endLine: 20,
      });
      const fileContext = createFileContext();

      const policies = generator.inferPolicies(func, fileContext);

      expect(policies.length).toBeGreaterThan(0);

      for (const policy of policies) {
        // Required fields
        expect(policy.name).toBeDefined();
        expect(typeof policy.name).toBe('string');
        expect(policy.description).toBeDefined();
        expect(typeof policy.description).toBe('string');
        expect(policy.confidence).toBeDefined();
        expect(typeof policy.confidence).toBe('number');
        expect(policy.confidence).toBeGreaterThanOrEqual(0);
        expect(policy.confidence).toBeLessThanOrEqual(1);
        expect(policy.category).toBeDefined();
        expect(policy.inferred_from).toBeDefined();

        // Optional structured fields
        expect(policy.conditions).toBeDefined();
        expect(Array.isArray(policy.conditions)).toBe(true);
        expect(policy.inputVariables).toBeDefined();
        expect(Array.isArray(policy.inputVariables)).toBe(true);
        expect(policy.constants).toBeDefined();
        expect(Array.isArray(policy.constants)).toBe(true);
      }
    });

    it('should include outputVariables when return type exists', () => {
      const func = createFunctionInfo({
        name: 'calculateTotal',
        params: [{ name: 'price', type: 'number' }],
        returnType: 'number',
      });
      const fileContext = createFileContext();

      const policies = generator.inferPolicies(func, fileContext);

      const calcPolicy = policies.find((p) => p.category === '계산');
      expect(calcPolicy).toBeDefined();
      expect(calcPolicy!.outputVariables).toBeDefined();
      expect(calcPolicy!.outputVariables!.length).toBe(1);
      expect(calcPolicy!.outputVariables![0].type).toBe('number');
    });

    it('should not include outputVariables when return type is absent', () => {
      const func = createFunctionInfo({
        name: 'validateInput',
        params: [{ name: 'data', type: 'unknown' }],
      });
      const fileContext = createFileContext();

      const policies = generator.inferPolicies(func, fileContext);

      const valPolicy = policies.find((p) => p.category === '검증');
      expect(valPolicy).toBeDefined();
      expect(valPolicy!.outputVariables).toEqual([]);
    });
  });

  // --------------------------------------------------------
  // Edge cases
  // --------------------------------------------------------

  describe('edge cases', () => {
    it('should handle class method names (ClassName.methodName)', () => {
      const func = createFunctionInfo({
        name: 'OrderService.calculateTotal',
        signature: 'function OrderService.calculateTotal(items: Item[]): number',
        params: [{ name: 'items', type: 'Item[]' }],
        returnType: 'number',
      });
      const fileContext = createFileContext();

      const result = generator.analyzeFunction(func, 'src/services/order.ts', fileContext);

      expect(result.function).toBe('OrderService.calculateTotal');
      expect(result.enriched_comment).toContain('계산');
    });

    it('should handle async functions correctly', () => {
      const func = createFunctionInfo({
        name: 'fetchUserData',
        isAsync: true,
        params: [{ name: 'userId', type: 'string' }],
        returnType: 'Promise<User>',
      });
      const fileContext = createFileContext();

      const result = generator.analyzeFunction(func, 'src/services/user.ts', fileContext);

      expect(result.enriched_comment).toContain('비동기 처리');
    });

    it('should handle function with no params and no return type', () => {
      const func = createFunctionInfo({
        name: 'doSomething',
        params: [],
        startLine: 1,
        endLine: 2,
      });
      const fileContext = createFileContext({ fileType: 'unknown' });

      const result = generator.analyzeFunction(func, 'test.ts', fileContext);

      expect(result.confidence).toBe(0.5);
      expect(result.enriched_comment).toBeDefined();
    });

    it('should properly infer system from file path', async () => {
      const parsedFile = createParsedFile({ functions: [] });

      const result = await generator.generateForFile(
        'src/modules/payment/handler.ts',
        parsedFile,
        '/project',
      );

      expect(result.system).toBe('modules');
    });

    it('should default system to "default" when no src directory', async () => {
      const parsedFile = createParsedFile({ functions: [] });

      const result = await generator.generateForFile(
        'lib/utils.ts',
        parsedFile,
        '/project',
      );

      expect(result.system).toBe('default');
    });
  });
});
