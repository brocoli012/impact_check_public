/**
 * @module tests/unit/commands/policy-check
 * @description PolicyCheckCommand 단위 테스트
 *
 * 기본 실행, --policy, --change 옵션, 에러 처리, 보강 주석 연동을 검증합니다.
 */

import { PolicyCheckCommand } from '../../../src/commands/policy-check';
import { ResultCode } from '../../../src/types/common';
import { Indexer } from '../../../src/core/indexing/indexer';
import { ConfigManager } from '../../../src/config/config-manager';
import { AnnotationLoader } from '../../../src/core/annotations/annotation-loader';
import { CodeIndex, PolicyInfo } from '../../../src/types/index';
import { AnnotationFile } from '../../../src/types/annotations';

// Mock dependencies
jest.mock('../../../src/core/indexing/indexer');
jest.mock('../../../src/config/config-manager');
jest.mock('../../../src/core/annotations/annotation-loader');
jest.mock('../../../src/utils/file', () => ({
  readJsonFile: jest.fn(),
  getImpactDir: jest.fn().mockReturnValue('/tmp/.impact'),
  getProjectDir: jest.fn().mockReturnValue('/tmp/.impact/projects/test-project'),
}));

import { readJsonFile } from '../../../src/utils/file';

// ============================================================
// Helpers
// ============================================================

function createTestPolicy(overrides?: Partial<PolicyInfo>): PolicyInfo {
  return {
    id: 'policy-1',
    name: '배송비 무료 정책',
    description: '5만원 이상 주문 시 배송비 무료',
    source: 'comment',
    sourceText: '// 5만원 이상 주문 시 배송비 무료',
    filePath: 'src/services/shipping.ts',
    lineNumber: 10,
    category: '배송',
    relatedComponents: ['comp-1'],
    relatedApis: ['api-1'],
    relatedModules: ['shipping'],
    extractedAt: '2026-02-17T10:00:00Z',
    ...overrides,
  };
}

function createTestIndex(overrides?: Partial<CodeIndex>): CodeIndex {
  return {
    meta: {
      version: 1,
      createdAt: '2026-02-17T09:00:00Z',
      updatedAt: '2026-02-17T10:00:00Z',
      gitCommit: 'abc123',
      gitBranch: 'main',
      project: {
        name: 'test-project',
        path: '/test/path',
        techStack: ['typescript'],
        packageManager: 'npm',
      },
      stats: {
        totalFiles: 10,
        screens: 2,
        components: 5,
        apiEndpoints: 3,
        models: 2,
        modules: 4,
      },
    },
    files: [
      { path: 'src/services/shipping.ts', hash: 'hash1', size: 500, extension: '.ts', lastModified: '2026-02-17T10:00:00Z' },
      { path: 'src/services/payment.ts', hash: 'hash2', size: 300, extension: '.ts', lastModified: '2026-02-17T10:00:00Z' },
    ],
    screens: [
      {
        id: 'screen-1',
        name: 'CheckoutPage',
        route: '/checkout',
        filePath: 'src/pages/checkout.tsx',
        components: ['comp-1'],
        apiCalls: ['api-1'],
        childScreens: [],
        metadata: { linesOfCode: 200, complexity: 'medium' },
      },
    ],
    components: [
      {
        id: 'comp-1',
        name: 'ShippingCalculator',
        filePath: 'src/services/shipping.ts',
        type: 'function',
        imports: [],
        importedBy: [],
        props: [],
        emits: [],
        apiCalls: [],
        linesOfCode: 50,
      },
      {
        id: 'comp-2',
        name: 'PaymentProcessor',
        filePath: 'src/services/payment.ts',
        type: 'function',
        imports: [],
        importedBy: [],
        props: [],
        emits: [],
        apiCalls: [],
        linesOfCode: 80,
      },
    ],
    apis: [
      {
        id: 'api-1',
        method: 'POST',
        path: '/api/shipping/calculate',
        filePath: 'src/services/shipping.ts',
        handler: 'calculateShipping',
        calledBy: ['comp-1'],
        requestParams: ['order'],
        responseType: 'ShippingResult',
        relatedModels: [],
      },
    ],
    models: [],
    policies: [
      createTestPolicy(),
      createTestPolicy({
        id: 'policy-2',
        name: '결제 수수료 정책',
        description: '카드 결제 시 2.5% 수수료 적용',
        filePath: 'src/services/payment.ts',
        lineNumber: 20,
        category: '결제',
        relatedComponents: ['comp-2'],
        relatedApis: [],
        relatedModules: ['payment'],
      }),
      createTestPolicy({
        id: 'policy-3',
        name: '배송 지역 제한 정책',
        description: '제주도 및 도서산간 지역 추가 배송비',
        filePath: 'src/services/shipping.ts',
        lineNumber: 30,
        category: '배송',
        relatedComponents: [],
        relatedApis: [],
        relatedModules: ['shipping'],
      }),
    ],
    dependencies: {
      graph: {
        nodes: [
          { id: 'comp-1', type: 'component', name: 'ShippingCalculator' },
          { id: 'comp-2', type: 'component', name: 'PaymentProcessor' },
          { id: 'api-1', type: 'api', name: '/api/shipping/calculate' },
        ],
        edges: [
          { from: 'comp-1', to: 'api-1', type: 'api-call' },
        ],
      },
    },
    ...overrides,
  };
}

function createTestAnnotationFile(): AnnotationFile {
  return {
    file: 'src/services/shipping.ts',
    system: 'delivery',
    lastAnalyzed: '2026-02-17T10:00:00Z',
    sourceHash: 'abc123',
    analyzerVersion: '1.0.0',
    model: 'rule-based',
    fileSummary: {
      description: '배송 서비스',
      confidence: 0.8,
      businessDomain: '배송',
      keywords: ['배송', '배송비'],
    },
    annotations: [
      {
        line: 1,
        endLine: 20,
        function: 'calculateShipping',
        signature: 'function calculateShipping(order: Order): number',
        original_comment: null,
        enriched_comment: '배송비를 계산합니다.',
        confidence: 0.85,
        type: 'business_logic',
        userModified: false,
        lastModifiedBy: null,
        inferred_from: 'test',
        policies: [
          {
            name: '배송비 무료 정책',
            description: '5만원 이상 주문 시 배송비 무료',
            confidence: 0.9,
            category: '배송',
            inferred_from: 'test',
            conditions: [
              {
                order: 1,
                type: 'if',
                condition: '주문 금액 >= 50000',
                conditionCode: 'order.total >= 50000',
                result: '배송비 0원',
                resultValue: '0',
              },
              {
                order: 2,
                type: 'else',
                condition: '그 외',
                conditionCode: 'else',
                result: '배송비 3000원',
                resultValue: '3000',
              },
            ],
            constraints: [
              {
                severity: 'warning',
                type: 'hardcoded_value',
                description: '무료배송 기준 금액이 하드코딩됨',
                recommendation: '설정값으로 분리 권장',
                relatedCode: 'order.total >= 50000',
              },
            ],
            inputVariables: [
              {
                name: 'order',
                type: 'Order',
                description: '주문 정보 객체',
              },
            ],
          },
        ],
        relatedFunctions: [],
        relatedApis: ['/api/shipping/calculate'],
      },
    ],
  };
}

// ============================================================
// Tests
// ============================================================

describe('PolicyCheckCommand', () => {
  let consoleSpy: jest.SpyInstance;
  let mockLoad: jest.Mock;
  let mockGetActiveProject: jest.Mock;
  let mockLoadIndex: jest.Mock;
  let mockLoadForFiles: jest.Mock;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    // ConfigManager mocks
    mockLoad = jest.fn().mockResolvedValue(undefined);
    mockGetActiveProject = jest.fn().mockReturnValue('test-project');

    (ConfigManager as jest.MockedClass<typeof ConfigManager>).mockImplementation(() => ({
      load: mockLoad,
      getActiveProject: mockGetActiveProject,
      save: jest.fn(),
      getConfig: jest.fn(),
      setActiveProject: jest.fn(),
      reset: jest.fn(),
    }) as unknown as ConfigManager);

    // Indexer mocks
    mockLoadIndex = jest.fn().mockResolvedValue(createTestIndex());
    (Indexer as jest.MockedClass<typeof Indexer>).mockImplementation(() => ({
      loadIndex: mockLoadIndex,
      fullIndex: jest.fn(),
      incrementalUpdate: jest.fn(),
      saveIndex: jest.fn(),
      isIndexStale: jest.fn(),
    }) as unknown as Indexer);

    // AnnotationLoader mocks
    mockLoadForFiles = jest.fn().mockResolvedValue(new Map());
    (AnnotationLoader as jest.MockedClass<typeof AnnotationLoader>).mockImplementation(() => ({
      loadForProject: jest.fn().mockResolvedValue(new Map()),
      loadForFile: jest.fn().mockResolvedValue(null),
      loadForFiles: mockLoadForFiles,
      calculateConfidenceBonus: jest.fn().mockReturnValue(0),
      getProjectMeta: jest.fn().mockResolvedValue(null),
    }) as unknown as AnnotationLoader);

    // Default projects config
    (readJsonFile as jest.Mock).mockReturnValue({
      activeProject: 'test-project',
      projects: [{
        id: 'test-project',
        name: 'Test Project',
        path: '/test/path',
        status: 'active',
        createdAt: '2026-01-01T00:00:00Z',
        lastUsedAt: '2026-01-01T00:00:00Z',
        techStack: ['typescript'],
      }],
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    jest.restoreAllMocks();
  });

  // ============================================================
  // 기본 인터페이스 테스트
  // ============================================================

  it('should have correct name and description', () => {
    const cmd = new PolicyCheckCommand([]);
    expect(cmd.name).toBe('policy-check');
    expect(cmd.description).toBe('정책 영향도 분석');
    expect(typeof cmd.execute).toBe('function');
  });

  // ============================================================
  // 기본 실행: 전체 정책 현황 요약
  // ============================================================

  describe('default execution (summary)', () => {
    it('should display policy summary grouped by category', async () => {
      const cmd = new PolicyCheckCommand([]);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('3 policies');
      expect(result.message).toContain('2 categories');

      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
      expect(allOutput).toContain('배송');
      expect(allOutput).toContain('결제');
      expect(allOutput).toContain('정책 수');
      expect(allOutput).toContain('관련 파일 수');
    });

    it('should show empty message when no policies exist', async () => {
      mockLoadIndex.mockResolvedValue(createTestIndex({ policies: [] }));

      const cmd = new PolicyCheckCommand([]);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.data).toEqual({ totalPolicies: 0, categories: {} });

      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
      expect(allOutput).toContain('등록된 정책이 없습니다');
    });
  });

  // ============================================================
  // --policy: 정책 검색 및 상세 출력
  // ============================================================

  describe('--policy option', () => {
    it('should search and display policy details', async () => {
      const cmd = new PolicyCheckCommand(['--policy', '배송비']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('Found');
      expect(result.message).toContain('배송비');

      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
      expect(allOutput).toContain('배송비 무료 정책');
      expect(allOutput).toContain('카테고리: 배송');
      expect(allOutput).toContain('설명: 5만원 이상 주문 시 배송비 무료');
    });

    it('should support partial matching search', async () => {
      const cmd = new PolicyCheckCommand(['--policy', '배송']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      // Should match both "배송비 무료 정책" and "배송 지역 제한 정책"
      const data = result.data as { matched: PolicyInfo[] };
      expect(data.matched.length).toBe(2);
    });

    it('should show not-found message when policy does not exist', async () => {
      const cmd = new PolicyCheckCommand(['--policy', '존재하지않는정책']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('해당 정책을 찾을 수 없습니다');

      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
      expect(allOutput).toContain('해당하는 정책을 찾을 수 없습니다');
    });

    it('should display annotation details when annotations are available', async () => {
      const annotationMap = new Map<string, AnnotationFile>();
      annotationMap.set('src/services/shipping.ts', createTestAnnotationFile());
      mockLoadForFiles.mockResolvedValue(annotationMap);

      const cmd = new PolicyCheckCommand(['--policy', '배송비 무료']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      const data = result.data as { hasAnnotations: boolean };
      expect(data.hasAnnotations).toBe(true);

      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
      expect(allOutput).toContain('조건 분기');
      expect(allOutput).toContain('제약사항');
      expect(allOutput).toContain('입력 변수');
    });

    it('should display basic info without annotations (fallback)', async () => {
      mockLoadForFiles.mockResolvedValue(new Map());

      const cmd = new PolicyCheckCommand(['--policy', '배송비 무료']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      const data = result.data as { hasAnnotations: boolean };
      expect(data.hasAnnotations).toBe(false);

      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
      expect(allOutput).toContain('배송비 무료 정책');
      expect(allOutput).toContain('카테고리: 배송');
    });

    it('should identify conflict candidates in the same category', async () => {
      const cmd = new PolicyCheckCommand(['--policy', '배송비 무료']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      const data = result.data as { conflicts: PolicyInfo[] };
      // "배송 지역 제한 정책" is in the same "배송" category
      expect(data.conflicts.length).toBeGreaterThan(0);
      expect(data.conflicts.some(c => c.name === '배송 지역 제한 정책')).toBe(true);

      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
      expect(allOutput).toContain('충돌 가능 정책');
      expect(allOutput).toContain('배송 지역 제한 정책');
    });

    it('should gracefully handle annotation load failure (fallback)', async () => {
      mockLoadForFiles.mockRejectedValue(new Error('Annotation load failed'));

      const cmd = new PolicyCheckCommand(['--policy', '배송비']);
      const result = await cmd.execute();

      // Should still succeed with basic info
      expect(result.code).toBe(ResultCode.SUCCESS);
      const data = result.data as { hasAnnotations: boolean };
      expect(data.hasAnnotations).toBe(false);
    });
  });

  // ============================================================
  // --change: 변경 영향도 분석
  // ============================================================

  describe('--change option', () => {
    it('should analyze impact of change description', async () => {
      const cmd = new PolicyCheckCommand(['--change', '배송비 무료 기준 변경']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('policies affected');

      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
      expect(allOutput).toContain('변경 내용');
      expect(allOutput).toContain('추출 키워드');
    });

    it('should extract and match keywords', async () => {
      const cmd = new PolicyCheckCommand(['--change', '배송비 결제 변경']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      const data = result.data as { keywords: string[]; matchedPolicies: PolicyInfo[] };
      expect(data.keywords).toContain('배송비');
      expect(data.keywords).toContain('결제');
      expect(data.keywords).toContain('변경');
      expect(data.matchedPolicies.length).toBeGreaterThan(0);
    });

    it('should output checklist', async () => {
      const cmd = new PolicyCheckCommand(['--change', '배송비 변경']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);

      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
      expect(allOutput).toContain('기획자 체크리스트');
      expect(allOutput).toContain('[ ]');

      const data = result.data as { checklist: string[] };
      expect(data.checklist.length).toBeGreaterThan(0);
    });

    it('should show no-impact message when no policies match', async () => {
      const cmd = new PolicyCheckCommand(['--change', 'xyzxyz 아무관련없는내용']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('영향받는 정책을 찾을 수 없습니다');
    });

    it('should display attention notes', async () => {
      const cmd = new PolicyCheckCommand(['--change', '배송비 변경']);
      await cmd.execute();

      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
      expect(allOutput).toContain('주의사항');
    });

    it('should match policies via component name', async () => {
      const cmd = new PolicyCheckCommand(['--change', 'ShippingCalculator 수정']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      const data = result.data as { matchedPolicies: PolicyInfo[] };
      // Should match policies in shipping.ts via component name matching
      expect(data.matchedPolicies.some(p => p.filePath === 'src/services/shipping.ts')).toBe(true);
    });
  });

  // ============================================================
  // 에러 처리
  // ============================================================

  describe('error handling', () => {
    it('should return NEEDS_CONFIG when no active project', async () => {
      mockGetActiveProject.mockReturnValue(null);

      const cmd = new PolicyCheckCommand([]);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.NEEDS_CONFIG);
      expect(result.message).toContain('프로젝트를 먼저 설정해주세요');
    });

    it('should return NEEDS_INDEX when index is missing', async () => {
      mockLoadIndex.mockResolvedValue(null);

      const cmd = new PolicyCheckCommand([]);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.NEEDS_INDEX);
      expect(result.message).toContain('인덱스가 없습니다');
    });

    it('should return FAILURE when --policy has no argument', async () => {
      const cmd = new PolicyCheckCommand(['--policy']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('정책명을 지정해주세요');
    });

    it('should return FAILURE when --change has no argument', async () => {
      const cmd = new PolicyCheckCommand(['--change']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('변경 내용을 지정해주세요');
    });
  });

  // ============================================================
  // Router 등록 확인
  // ============================================================

  describe('router registration', () => {
    it('should be registered in router COMMANDS', () => {
      // Verify that the command can be instantiated as a Command
      const cmd = new PolicyCheckCommand([]);
      expect(cmd.name).toBe('policy-check');
      expect(cmd.description.length).toBeGreaterThan(0);
      expect(typeof cmd.execute).toBe('function');
    });

    it('should be importable and registered in getAvailableCommands', async () => {
      // Verify the router module has policy-check registered
      const { getAvailableCommands } = await import('../../../src/router');
      const commands = getAvailableCommands();
      expect(commands).toContain('policy-check');
    });
  });
});
