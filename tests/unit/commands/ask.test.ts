/**
 * @module tests/unit/commands/ask
 * @description AskCommand 단위 테스트
 */

import { AskCommand, extractKeywords, searchIndex } from '../../../src/commands/ask';
import { ResultCode } from '../../../src/types/common';
import { Indexer } from '../../../src/core/indexing/indexer';
import { ConfigManager } from '../../../src/config/config-manager';
import { AnnotationLoader } from '../../../src/core/annotations/annotation-loader';
import { CodeIndex } from '../../../src/types/index';
import { route } from '../../../src/router';

// Mock dependencies
jest.mock('../../../src/core/indexing/indexer');
jest.mock('../../../src/config/config-manager');
jest.mock('../../../src/core/annotations/annotation-loader');

/** 테스트용 최소 CodeIndex */
function createMockCodeIndex(): CodeIndex {
  return {
    meta: {
      version: 1,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      gitCommit: 'abc123',
      gitBranch: 'main',
      project: {
        name: 'test-project',
        path: '/test/path',
        techStack: ['typescript'],
        packageManager: 'npm',
      },
      stats: {
        totalFiles: 5,
        screens: 1,
        components: 2,
        apiEndpoints: 1,
        models: 1,
        modules: 3,
      },
    },
    files: [
      { path: 'src/payment/checkout.ts', hash: 'h1', size: 1000, extension: '.ts', lastModified: '2025-01-01T00:00:00Z' },
      { path: 'src/cart/cart-service.ts', hash: 'h2', size: 500, extension: '.ts', lastModified: '2025-01-01T00:00:00Z' },
      { path: 'src/delivery/shipping.ts', hash: 'h3', size: 800, extension: '.ts', lastModified: '2025-01-01T00:00:00Z' },
    ],
    screens: [{
      id: 'screen-1',
      name: 'CheckoutPage',
      route: '/checkout',
      filePath: 'src/pages/CheckoutPage.tsx',
      components: ['comp-1'],
      apiCalls: [],
      childScreens: [],
      metadata: { linesOfCode: 50, complexity: 'low' },
    }],
    components: [
      {
        id: 'comp-1',
        name: 'PaymentForm',
        filePath: 'src/components/PaymentForm.tsx',
        type: 'function',
        imports: [],
        importedBy: [],
        props: ['amount', 'currency'],
        emits: [],
        apiCalls: [],
        linesOfCode: 30,
      },
      {
        id: 'comp-2',
        name: 'CartSummary',
        filePath: 'src/components/CartSummary.tsx',
        type: 'function',
        imports: [],
        importedBy: [],
        props: ['items'],
        emits: [],
        apiCalls: [],
        linesOfCode: 20,
      },
    ],
    apis: [{
      id: 'api-1',
      method: 'POST',
      path: '/api/payment/process',
      filePath: 'src/api/payment.ts',
      handler: 'processPayment',
      calledBy: [],
      requestParams: ['amount'],
      responseType: 'PaymentResult',
      relatedModels: [],
    }],
    models: [{
      id: 'model-1',
      name: 'PaymentOrder',
      filePath: 'src/models/payment-order.ts',
      type: 'interface',
      fields: [
        { name: 'orderId', type: 'string', required: true },
        { name: 'amount', type: 'number', required: true },
        { name: 'status', type: 'string', required: true },
      ],
      relatedApis: ['api-1'],
    }],
    policies: [
      {
        id: 'policy-1',
        name: '최소 결제 금액 정책',
        description: '최소 결제 금액은 1000원 이상이어야 합니다.',
        source: 'comment',
        sourceText: '// 최소 결제 금액: 1000원',
        filePath: 'src/payment/checkout.ts',
        lineNumber: 10,
        category: '결제',
        relatedComponents: ['comp-1'],
        relatedApis: ['api-1'],
        relatedModules: [],
        extractedAt: '2025-01-01T00:00:00Z',
      },
      {
        id: 'policy-2',
        name: '배송비 무료 정책',
        description: '40000원 이상 구매 시 배송비 무료',
        source: 'comment',
        sourceText: '// 4만원 이상 배송비 무료',
        filePath: 'src/delivery/shipping.ts',
        lineNumber: 5,
        category: '배송',
        relatedComponents: [],
        relatedApis: [],
        relatedModules: [],
        extractedAt: '2025-01-01T00:00:00Z',
      },
    ],
    dependencies: { graph: { nodes: [], edges: [] } },
  };
}

describe('AskCommand', () => {
  let consoleSpy: jest.SpyInstance;
  let mockLoadIndex: jest.Mock;
  let mockLoad: jest.Mock;
  let mockGetActiveProject: jest.Mock;
  let mockLoadForFiles: jest.Mock;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    // Reset mocks
    mockLoadIndex = jest.fn();
    mockLoad = jest.fn();
    mockGetActiveProject = jest.fn();
    mockLoadForFiles = jest.fn();

    (Indexer as jest.MockedClass<typeof Indexer>).mockImplementation(() => ({
      loadIndex: mockLoadIndex,
      fullIndex: jest.fn(),
      incrementalUpdate: jest.fn(),
      saveIndex: jest.fn(),
    }) as unknown as Indexer);

    (ConfigManager as jest.MockedClass<typeof ConfigManager>).mockImplementation(() => ({
      load: mockLoad,
      getActiveProject: mockGetActiveProject,
      save: jest.fn(),
      getConfig: jest.fn(),
      setActiveProject: jest.fn(),
      reset: jest.fn(),
    }) as unknown as ConfigManager);

    (AnnotationLoader as jest.MockedClass<typeof AnnotationLoader>).mockImplementation(() => ({
      loadForFiles: mockLoadForFiles,
      loadForProject: jest.fn(),
      loadForFile: jest.fn(),
      calculateConfidenceBonus: jest.fn(),
      getProjectMeta: jest.fn(),
    }) as unknown as AnnotationLoader);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    jest.restoreAllMocks();
  });

  // ============================================================
  // 기본 속성 테스트
  // ============================================================

  it('should have correct name and description', () => {
    const cmd = new AskCommand([]);
    expect(cmd.name).toBe('ask');
    expect(cmd.description).toBe('코드베이스에 대한 자유 질의');
    expect(typeof cmd.execute).toBe('function');
  });

  // ============================================================
  // 질문 없이 실행
  // ============================================================

  it('should show usage when no question is provided', async () => {
    const cmd = new AskCommand([]);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.SUCCESS);
    expect(result.message).toContain('질문을 입력해주세요');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('질문을 입력해주세요'));
  });

  // ============================================================
  // 프로젝트 미설정 시 에러
  // ============================================================

  it('should return NEEDS_CONFIG when no active project', async () => {
    mockLoad.mockResolvedValue(undefined);
    mockGetActiveProject.mockReturnValue(null);

    const cmd = new AskCommand(['결제', '로직']);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.NEEDS_CONFIG);
    expect(result.message).toContain('프로젝트를 초기화');
  });

  // ============================================================
  // 인덱스 없을 시 에러
  // ============================================================

  it('should return NEEDS_INDEX when index not found', async () => {
    mockLoad.mockResolvedValue(undefined);
    mockGetActiveProject.mockReturnValue('test-project');
    mockLoadIndex.mockResolvedValue(null);

    const cmd = new AskCommand(['결제', '로직']);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.NEEDS_INDEX);
    expect(result.message).toContain('인덱스가 없습니다');
  });

  // ============================================================
  // 기본 질문: 키워드 추출 및 인덱스 검색
  // ============================================================

  it('should extract keywords and search index for basic query', async () => {
    mockLoad.mockResolvedValue(undefined);
    mockGetActiveProject.mockReturnValue('test-project');
    mockLoadIndex.mockResolvedValue(createMockCodeIndex());
    mockLoadForFiles.mockResolvedValue(new Map());

    const cmd = new AskCommand(['결제', '로직은', '어디에', '있나요?']);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.SUCCESS);
    expect(result.data).toBeDefined();
    const data = result.data as { keywords: string[]; hits: unknown[] };
    expect(data.keywords).toContain('결제');
    expect(data.hits.length).toBeGreaterThan(0);
  });

  // ============================================================
  // 관련 파일 목록 출력
  // ============================================================

  it('should include related files in results', async () => {
    mockLoad.mockResolvedValue(undefined);
    mockGetActiveProject.mockReturnValue('test-project');
    mockLoadIndex.mockResolvedValue(createMockCodeIndex());
    mockLoadForFiles.mockResolvedValue(new Map());

    const cmd = new AskCommand(['payment', 'checkout']);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.SUCCESS);
    const data = result.data as { hits: Array<{ type: string; filePath: string }> };
    const fileHits = data.hits.filter((h: { type: string }) => h.type === 'file');
    expect(fileHits.length).toBeGreaterThan(0);
    expect(fileHits.some((h: { filePath: string }) => h.filePath.includes('checkout'))).toBe(true);
  });

  // ============================================================
  // 관련 정책 목록 출력
  // ============================================================

  it('should include related policies in results', async () => {
    mockLoad.mockResolvedValue(undefined);
    mockGetActiveProject.mockReturnValue('test-project');
    mockLoadIndex.mockResolvedValue(createMockCodeIndex());
    mockLoadForFiles.mockResolvedValue(new Map());

    const cmd = new AskCommand(['결제', '금액']);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.SUCCESS);
    const data = result.data as { hits: Array<{ type: string; name: string }> };
    const policyHits = data.hits.filter((h: { type: string }) => h.type === 'policy');
    expect(policyHits.length).toBeGreaterThan(0);
    expect(policyHits.some((h: { name: string }) => h.name.includes('결제'))).toBe(true);
  });

  // ============================================================
  // 보강 주석 있을 때 비즈니스 로직 정보 포함
  // ============================================================

  it('should include annotation info when annotations exist', async () => {
    mockLoad.mockResolvedValue(undefined);
    mockGetActiveProject.mockReturnValue('test-project');
    mockLoadIndex.mockResolvedValue(createMockCodeIndex());

    const mockAnnotationMap = new Map();
    mockAnnotationMap.set('src/payment/checkout.ts', {
      file: 'src/payment/checkout.ts',
      system: 'payment',
      lastAnalyzed: '2025-01-01T00:00:00Z',
      sourceHash: 'hash',
      analyzerVersion: '1.0.0',
      model: 'rule-based',
      fileSummary: {
        description: '결제 처리 핵심 로직을 포함하는 파일입니다.',
        confidence: 0.9,
        businessDomain: 'payment',
        keywords: ['결제', 'checkout'],
      },
      annotations: [
        {
          line: 1,
          endLine: 10,
          function: 'processPayment',
          signature: 'processPayment(amount: number)',
          original_comment: null,
          enriched_comment: '결제를 처리하는 비즈니스 로직입니다.',
          confidence: 0.85,
          type: 'business_logic',
          userModified: false,
          lastModifiedBy: null,
          inferred_from: 'code-analysis',
          policies: [],
          relatedFunctions: [],
          relatedApis: [],
        },
      ],
    });
    mockLoadForFiles.mockResolvedValue(mockAnnotationMap);

    const cmd = new AskCommand(['결제', 'checkout']);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.SUCCESS);
    const data = result.data as { annotationInfo: string[] };
    expect(data.annotationInfo.length).toBeGreaterThan(0);
    expect(data.annotationInfo.some(info => info.includes('결제 처리 핵심 로직'))).toBe(true);
  });

  // ============================================================
  // 보강 주석 없을 때 기본 정보만 출력
  // ============================================================

  it('should return basic info when no annotations exist', async () => {
    mockLoad.mockResolvedValue(undefined);
    mockGetActiveProject.mockReturnValue('test-project');
    mockLoadIndex.mockResolvedValue(createMockCodeIndex());
    mockLoadForFiles.mockResolvedValue(new Map());

    const cmd = new AskCommand(['결제', 'checkout']);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.SUCCESS);
    const data = result.data as { annotationInfo: string[]; hits: unknown[] };
    expect(data.annotationInfo.length).toBe(0);
    expect(data.hits.length).toBeGreaterThan(0);
  });

  // ============================================================
  // 매칭 결과 0건: "관련 없는 질문" 안내
  // ============================================================

  it('should indicate irrelevant question when no matches found', async () => {
    mockLoad.mockResolvedValue(undefined);
    mockGetActiveProject.mockReturnValue('test-project');
    mockLoadIndex.mockResolvedValue(createMockCodeIndex());

    const cmd = new AskCommand(['블록체인', '마이닝']);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.SUCCESS);
    expect(result.message).toContain('코드베이스와 관련이 없는');
    const data = result.data as { hits: unknown[] };
    expect(data.hits.length).toBe(0);
  });

  // ============================================================
  // 보강 주석 로드 실패 시 인덱스 기반으로만 답변
  // ============================================================

  it('should work when annotation loading fails', async () => {
    mockLoad.mockResolvedValue(undefined);
    mockGetActiveProject.mockReturnValue('test-project');
    mockLoadIndex.mockResolvedValue(createMockCodeIndex());
    mockLoadForFiles.mockRejectedValue(new Error('annotation load failed'));

    const cmd = new AskCommand(['결제', 'checkout']);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.SUCCESS);
    const data = result.data as { hits: unknown[]; annotationInfo: string[] };
    expect(data.hits.length).toBeGreaterThan(0);
    expect(data.annotationInfo.length).toBe(0);
  });
});

// ============================================================
// extractKeywords 단위 테스트
// ============================================================

describe('extractKeywords', () => {
  it('should extract Korean and English tokens', () => {
    const keywords = extractKeywords('결제 payment 로직');
    expect(keywords).toContain('결제');
    expect(keywords).toContain('payment');
    expect(keywords).toContain('로직');
  });

  it('should remove Korean stopwords and strip particles', () => {
    const keywords = extractKeywords('결제는 어디에 있나요');
    // '결제는' -> strip '는' -> '결제'
    // '어디에' -> strip '에' -> '어디' -> stopword -> removed
    // '있나요' -> no particle -> kept
    expect(keywords).toContain('결제');
    expect(keywords).not.toContain('결제는');
    expect(keywords).not.toContain('어디');
  });

  it('should remove English stopwords', () => {
    const keywords = extractKeywords('the payment is in the cart');
    expect(keywords).not.toContain('the');
    expect(keywords).not.toContain('is');
    expect(keywords).not.toContain('in');
    expect(keywords).toContain('payment');
    expect(keywords).toContain('cart');
  });

  it('should filter out tokens shorter than 2 characters', () => {
    const keywords = extractKeywords('a b cd efg 가 나다');
    expect(keywords).not.toContain('a');
    expect(keywords).not.toContain('b');
    expect(keywords).toContain('cd');
    expect(keywords).toContain('efg');
    expect(keywords).not.toContain('가');
    expect(keywords).toContain('나다');
  });

  it('should deduplicate keywords', () => {
    const keywords = extractKeywords('결제 결제 payment payment');
    const unique = [...new Set(keywords)];
    expect(keywords.length).toBe(unique.length);
  });

  it('should handle mixed Korean and English tokens', () => {
    const keywords = extractKeywords('배송비 delivery 계산 calculate');
    expect(keywords).toContain('배송비');
    expect(keywords).toContain('delivery');
    expect(keywords).toContain('계산');
    expect(keywords).toContain('calculate');
  });

  it('should return empty array for empty input', () => {
    const keywords = extractKeywords('');
    expect(keywords).toEqual([]);
  });

  it('should return empty array for only stopwords', () => {
    const keywords = extractKeywords('the is in of a');
    expect(keywords).toEqual([]);
  });
});

// ============================================================
// searchIndex 단위 테스트
// ============================================================

describe('searchIndex', () => {
  const mockIndex = createMockCodeIndex();

  it('should return empty array for empty keywords', () => {
    const hits = searchIndex(mockIndex, []);
    expect(hits).toEqual([]);
  });

  it('should find matching files by path', () => {
    const hits = searchIndex(mockIndex, ['payment']);
    const fileHits = hits.filter(h => h.type === 'file');
    expect(fileHits.length).toBeGreaterThan(0);
  });

  it('should find matching components by name', () => {
    const hits = searchIndex(mockIndex, ['paymentform']);
    const compHits = hits.filter(h => h.type === 'component');
    expect(compHits.length).toBeGreaterThan(0);
    expect(compHits[0].name).toBe('PaymentForm');
  });

  it('should find matching APIs by path', () => {
    const hits = searchIndex(mockIndex, ['payment']);
    const apiHits = hits.filter(h => h.type === 'api');
    expect(apiHits.length).toBeGreaterThan(0);
  });

  it('should find matching screens', () => {
    const hits = searchIndex(mockIndex, ['checkout']);
    const screenHits = hits.filter(h => h.type === 'screen');
    expect(screenHits.length).toBeGreaterThan(0);
    expect(screenHits[0].name).toBe('CheckoutPage');
  });

  it('should find matching policies by name', () => {
    const hits = searchIndex(mockIndex, ['결제']);
    const policyHits = hits.filter(h => h.type === 'policy');
    expect(policyHits.length).toBeGreaterThan(0);
  });

  it('should find matching policies by category', () => {
    const hits = searchIndex(mockIndex, ['배송']);
    const policyHits = hits.filter(h => h.type === 'policy');
    expect(policyHits.length).toBeGreaterThan(0);
    expect(policyHits[0].name).toContain('배송');
  });

  it('should find matching models', () => {
    const hits = searchIndex(mockIndex, ['paymentorder']);
    const modelHits = hits.filter(h => h.type === 'model');
    expect(modelHits.length).toBeGreaterThan(0);
    expect(modelHits[0].name).toBe('PaymentOrder');
  });

  it('should limit results to 20 items', () => {
    // Create an index with many items
    const largeIndex: CodeIndex = {
      ...mockIndex,
      files: Array.from({ length: 30 }, (_, i) => ({
        path: `src/payment/file-${i}.ts`,
        hash: `hash-${i}`,
        size: 100,
        extension: '.ts',
        lastModified: '2025-01-01T00:00:00Z',
      })),
    };

    const hits = searchIndex(largeIndex, ['payment']);
    expect(hits.length).toBeLessThanOrEqual(20);
  });

  it('should sort results by score descending', () => {
    const hits = searchIndex(mockIndex, ['payment']);
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i - 1].score).toBeGreaterThanOrEqual(hits[i].score);
    }
  });

  it('should support partial matching', () => {
    // 'cart' should match 'cart-service.ts' and 'CartSummary'
    const hits = searchIndex(mockIndex, ['cart']);
    expect(hits.length).toBeGreaterThan(0);
    const names = hits.map(h => h.name.toLowerCase() + ' ' + h.filePath.toLowerCase());
    expect(names.some(n => n.includes('cart'))).toBe(true);
  });
});

// ============================================================
// Router 등록 확인
// ============================================================

describe('Router registration', () => {
  it('should route ask command correctly', () => {
    const cmd = route(['ask', '결제', '로직']);
    expect(cmd.name).toBe('ask');
  });
});
