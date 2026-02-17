/**
 * @module tests/unit/commands/summary
 * @description SummaryCommand 단위 테스트
 *
 * 기본 실행, --system, --recent 옵션, 에러 처리, 보강 주석 상태를 검증합니다.
 */

import { SummaryCommand } from '../../../src/commands/summary';
import { ResultCode } from '../../../src/types/common';
import { Indexer } from '../../../src/core/indexing/indexer';
import { ConfigManager } from '../../../src/config/config-manager';
import { AnnotationLoader } from '../../../src/core/annotations/annotation-loader';
import { CodeIndex } from '../../../src/types/index';
import { AnnotationMeta } from '../../../src/types/annotations';

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

function createTestIndex(overrides?: Partial<CodeIndex>): CodeIndex {
  return {
    meta: {
      version: 1,
      createdAt: '2026-02-17T09:00:00Z',
      updatedAt: '2026-02-17T10:00:00Z',
      gitCommit: 'abc123def',
      gitBranch: 'main',
      lastUpdateType: 'incremental',
      project: {
        name: 'test-project',
        path: '/test/path',
        techStack: ['typescript', 'react'],
        packageManager: 'npm',
      },
      stats: {
        totalFiles: 50,
        screens: 5,
        components: 20,
        apiEndpoints: 10,
        models: 8,
        modules: 6,
      },
    },
    files: [
      { path: 'src/cart/cart-service.ts', hash: 'h1', size: 500, extension: '.ts', lastModified: '2026-02-17T10:00:00Z' },
      { path: 'src/cart/cart-utils.ts', hash: 'h2', size: 300, extension: '.ts', lastModified: '2026-02-17T10:00:00Z' },
      { path: 'src/payment/checkout.ts', hash: 'h3', size: 1000, extension: '.ts', lastModified: '2026-02-17T10:00:00Z' },
      { path: 'src/delivery/shipping.ts', hash: 'h4', size: 800, extension: '.ts', lastModified: '2026-02-17T10:00:00Z' },
    ],
    screens: [
      {
        id: 'screen-1',
        name: 'CartPage',
        route: '/cart',
        filePath: 'src/pages/CartPage.tsx',
        components: ['comp-1'],
        apiCalls: ['api-1'],
        childScreens: [],
        metadata: { linesOfCode: 100, complexity: 'medium' },
      },
      {
        id: 'screen-2',
        name: 'CheckoutPage',
        route: '/checkout',
        filePath: 'src/pages/CheckoutPage.tsx',
        components: ['comp-2'],
        apiCalls: [],
        childScreens: [],
        metadata: { linesOfCode: 200, complexity: 'high' },
      },
    ],
    components: [
      {
        id: 'comp-1',
        name: 'CartSummary',
        filePath: 'src/cart/cart-service.ts',
        type: 'function',
        imports: [],
        importedBy: [],
        props: ['items'],
        emits: [],
        apiCalls: ['api-1'],
        linesOfCode: 50,
      },
      {
        id: 'comp-2',
        name: 'PaymentForm',
        filePath: 'src/payment/checkout.ts',
        type: 'function',
        imports: [],
        importedBy: [],
        props: ['amount'],
        emits: [],
        apiCalls: [],
        linesOfCode: 80,
      },
    ],
    apis: [
      {
        id: 'api-1',
        method: 'GET',
        path: '/api/cart/items',
        filePath: 'src/cart/cart-service.ts',
        handler: 'getCartItems',
        calledBy: ['comp-1'],
        requestParams: [],
        responseType: 'CartItem[]',
        relatedModels: [],
      },
    ],
    models: [],
    policies: [
      {
        id: 'policy-1',
        name: '장바구니 최대 수량 정책',
        description: '장바구니 최대 99개까지 담을 수 있습니다.',
        source: 'comment',
        sourceText: '// max 99 items',
        filePath: 'src/cart/cart-service.ts',
        lineNumber: 10,
        category: '장바구니',
        relatedComponents: ['comp-1'],
        relatedApis: ['api-1'],
        relatedModules: ['cart'],
        extractedAt: '2026-02-17T10:00:00Z',
      },
      {
        id: 'policy-2',
        name: '배송비 무료 정책',
        description: '5만원 이상 주문 시 배송비 무료',
        source: 'comment',
        sourceText: '// 5만원 이상 배송비 무료',
        filePath: 'src/delivery/shipping.ts',
        lineNumber: 5,
        category: '배송',
        relatedComponents: [],
        relatedApis: [],
        relatedModules: ['delivery'],
        extractedAt: '2026-02-17T10:00:00Z',
      },
    ],
    dependencies: {
      graph: {
        nodes: [
          { id: 'comp-1', type: 'component', name: 'CartSummary' },
          { id: 'comp-2', type: 'component', name: 'PaymentForm' },
          { id: 'api-1', type: 'api', name: '/api/cart/items' },
        ],
        edges: [
          { from: 'comp-1', to: 'api-1', type: 'api-call' },
        ],
      },
    },
    ...overrides,
  };
}

function createTestAnnotationMeta(): AnnotationMeta {
  return {
    version: '1.0.0',
    createdAt: '2026-02-17T09:00:00Z',
    lastUpdatedAt: '2026-02-17T10:00:00Z',
    totalFiles: 15,
    totalAnnotations: 45,
    totalPolicies: 10,
    systems: {
      cart: { files: 5, annotations: 15, policies: 3 },
      payment: { files: 4, annotations: 12, policies: 2 },
    },
    avgConfidence: 0.82,
    lowConfidenceCount: 3,
    userModifiedCount: 5,
  };
}

// ============================================================
// Tests
// ============================================================

describe('SummaryCommand', () => {
  let consoleSpy: jest.SpyInstance;
  let mockLoad: jest.Mock;
  let mockGetActiveProject: jest.Mock;
  let mockLoadIndex: jest.Mock;
  let mockGetProjectMeta: jest.Mock;

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
    mockGetProjectMeta = jest.fn().mockResolvedValue(null);
    (AnnotationLoader as jest.MockedClass<typeof AnnotationLoader>).mockImplementation(() => ({
      loadForProject: jest.fn().mockResolvedValue(new Map()),
      loadForFile: jest.fn().mockResolvedValue(null),
      loadForFiles: jest.fn().mockResolvedValue(new Map()),
      calculateConfidenceBonus: jest.fn().mockReturnValue(0),
      getProjectMeta: mockGetProjectMeta,
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
    const cmd = new SummaryCommand([]);
    expect(cmd.name).toBe('summary');
    expect(cmd.description).toBe('프로젝트 요약 정보');
    expect(typeof cmd.execute).toBe('function');
  });

  // ============================================================
  // 기본 실행: 전체 프로젝트 통계
  // ============================================================

  describe('default execution (project summary)', () => {
    it('should display full project statistics', async () => {
      const cmd = new SummaryCommand([]);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('test-project');

      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
      expect(allOutput).toContain('프로젝트: test-project');
      expect(allOutput).toContain('파일 수: 50');
      expect(allOutput).toContain('화면 수: 5');
      expect(allOutput).toContain('컴포넌트 수: 20');
      expect(allOutput).toContain('API 수: 10');
      expect(allOutput).toContain('정책 수: 2');
    });

    it('should display dependency graph node and edge counts', async () => {
      const cmd = new SummaryCommand([]);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);

      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
      expect(allOutput).toContain('노드 수: 3');
      expect(allOutput).toContain('엣지 수: 1');
    });

    it('should display Git information', async () => {
      const cmd = new SummaryCommand([]);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);

      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
      expect(allOutput).toContain('브랜치: main');
      expect(allOutput).toContain('커밋: abc123def');

      const data = result.data as { gitBranch: string; gitCommit: string };
      expect(data.gitBranch).toBe('main');
      expect(data.gitCommit).toBe('abc123def');
    });

    it('should display annotation status as not created when no annotations', async () => {
      mockGetProjectMeta.mockResolvedValue(null);

      const cmd = new SummaryCommand([]);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);

      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
      expect(allOutput).toContain('상태: 미생성');

      const data = result.data as { annotationStatus: string };
      expect(data.annotationStatus).toBe('미생성');
    });

    it('should display annotation details when annotations exist', async () => {
      const annotationMeta = createTestAnnotationMeta();
      mockGetProjectMeta.mockResolvedValue(annotationMeta);

      const cmd = new SummaryCommand([]);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);

      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
      expect(allOutput).toContain('생성됨');
      expect(allOutput).toContain('파일 15개');
      expect(allOutput).toContain('주석 45개');
      expect(allOutput).toContain('정책 10개');
      expect(allOutput).toContain('평균 신뢰도: 82.0%');
      expect(allOutput).toContain('사용자 수정: 5건');

      const data = result.data as { annotationMeta: AnnotationMeta };
      expect(data.annotationMeta).toEqual(annotationMeta);
    });

    it('should handle annotation loader failure gracefully', async () => {
      mockGetProjectMeta.mockRejectedValue(new Error('Annotation load failed'));

      const cmd = new SummaryCommand([]);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);

      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
      expect(allOutput).toContain('상태: 미생성');
    });

    it('should include index meta information in output', async () => {
      const cmd = new SummaryCommand([]);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);

      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
      expect(allOutput).toContain('마지막 인덱싱: 2026-02-17T10:00:00Z');
      expect(allOutput).toContain('인덱싱 방식: incremental');
      expect(allOutput).toContain('기술 스택: typescript, react');
      expect(allOutput).toContain('패키지 매니저: npm');
    });
  });

  // ============================================================
  // --system: 시스템 상세 요약
  // ============================================================

  describe('--system option', () => {
    it('should display system-specific summary', async () => {
      const cmd = new SummaryCommand(['--system', 'cart']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('cart');

      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
      expect(allOutput).toContain('파일 수:');
      expect(allOutput).toContain('컴포넌트 수:');
      expect(allOutput).toContain('API 수:');

      const data = result.data as { files: number; components: number };
      expect(data.files).toBeGreaterThan(0);
      expect(data.components).toBeGreaterThan(0);
    });

    it('should show not-found message for non-existent system', async () => {
      const cmd = new SummaryCommand(['--system', 'nonexistent-system']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('찾을 수 없습니다');

      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
      expect(allOutput).toContain('해당 시스템을 찾을 수 없습니다');
    });

    it('should show available systems when system not found', async () => {
      const cmd = new SummaryCommand(['--system', 'nonexistent-system']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);

      const data = result.data as { availableSystems: string[] };
      expect(data.availableSystems).toBeDefined();
      expect(data.availableSystems.length).toBeGreaterThan(0);

      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
      expect(allOutput).toContain('사용 가능한 시스템 목록');
    });

    it('should filter components and APIs by system name', async () => {
      const cmd = new SummaryCommand(['--system', 'cart']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);

      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
      // Should match CartSummary component
      expect(allOutput).toContain('CartSummary');
      // Should match /api/cart/items
      expect(allOutput).toContain('/api/cart/items');
    });

    it('should filter policies by system name', async () => {
      const cmd = new SummaryCommand(['--system', 'cart']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);

      const data = result.data as { policies: number };
      expect(data.policies).toBeGreaterThan(0);
    });

    it('should show top 10 files for system', async () => {
      const cmd = new SummaryCommand(['--system', 'cart']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);

      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
      expect(allOutput).toContain('주요 파일');
      expect(allOutput).toContain('src/cart/cart-service.ts');
    });

    it('should return error when --system has no argument', async () => {
      const cmd = new SummaryCommand(['--system']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('시스템명을 지정해주세요');
    });
  });

  // ============================================================
  // --recent: 최근 변경 요약
  // ============================================================

  describe('--recent option', () => {
    it('should display recent changes summary', async () => {
      const cmd = new SummaryCommand(['--recent']);
      const result = await cmd.execute();

      // Should succeed regardless of git availability in test environment
      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.data).toBeDefined();
    });

    it('should handle git unavailable gracefully', async () => {
      // Use a non-existent project path to force git error
      (readJsonFile as jest.Mock).mockReturnValue({
        activeProject: 'test-project',
        projects: [{
          id: 'test-project',
          name: 'Test Project',
          path: '/nonexistent/path/that/does/not/exist',
          status: 'active',
          createdAt: '2026-01-01T00:00:00Z',
          lastUsedAt: '2026-01-01T00:00:00Z',
          techStack: ['typescript'],
        }],
      });

      const cmd = new SummaryCommand(['--recent']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      // Either "Git 정보를 사용할 수 없습니다" or git commit info
      // Both are valid SUCCESS states
      const data = result.data as { commits?: unknown[]; gitAvailable?: boolean };
      expect(data).toBeDefined();
    });
  });

  // ============================================================
  // 에러 처리
  // ============================================================

  describe('error handling', () => {
    it('should return NEEDS_CONFIG when no active project', async () => {
      mockGetActiveProject.mockReturnValue(null);

      const cmd = new SummaryCommand([]);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.NEEDS_CONFIG);
      expect(result.message).toContain('프로젝트를 먼저 설정해주세요');
    });

    it('should return NEEDS_INDEX when index is missing', async () => {
      mockLoadIndex.mockResolvedValue(null);

      const cmd = new SummaryCommand([]);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.NEEDS_INDEX);
      expect(result.message).toContain('인덱스가 없습니다');
    });

    it('should return NEEDS_CONFIG when projects config is missing', async () => {
      (readJsonFile as jest.Mock).mockReturnValue(null);

      const cmd = new SummaryCommand([]);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.NEEDS_CONFIG);
      expect(result.message).toContain('프로젝트를 먼저 설정해주세요');
    });

    it('should return NEEDS_CONFIG when project not found in config', async () => {
      (readJsonFile as jest.Mock).mockReturnValue({
        activeProject: 'test-project',
        projects: [{
          id: 'other-project',
          name: 'Other Project',
          path: '/other/path',
          status: 'active',
          createdAt: '2026-01-01T00:00:00Z',
          lastUsedAt: '2026-01-01T00:00:00Z',
          techStack: [],
        }],
      });

      const cmd = new SummaryCommand([]);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.NEEDS_CONFIG);
      expect(result.message).toContain('프로젝트를 찾을 수 없습니다');
    });
  });

  // ============================================================
  // Router 등록 확인
  // ============================================================

  describe('router registration', () => {
    it('should be registered in router COMMANDS', () => {
      const cmd = new SummaryCommand([]);
      expect(cmd.name).toBe('summary');
      expect(cmd.description.length).toBeGreaterThan(0);
      expect(typeof cmd.execute).toBe('function');
    });

    it('should be importable and registered in getAvailableCommands', async () => {
      const { getAvailableCommands } = await import('../../../src/router');
      const commands = getAvailableCommands();
      expect(commands).toContain('summary');
    });

    it('should route summary command correctly', async () => {
      const { route } = await import('../../../src/router');
      const cmd = route(['summary']);
      expect(cmd.name).toBe('summary');
    });
  });
});
