/**
 * @module tests/unit/commands/annotations
 * @description AnnotationsCommand 단위 테스트
 *
 * generate/view 서브커맨드, 에러 처리, 출력 메시지를 검증합니다.
 */

import { AnnotationsCommand } from '../../../src/commands/annotations';
import { ResultCode } from '../../../src/types/common';
import { Indexer } from '../../../src/core/indexing/indexer';
import { ConfigManager } from '../../../src/config/config-manager';
import { AnnotationManager } from '../../../src/core/annotations/annotation-manager';
import { AnnotationGenerator } from '../../../src/core/annotations/annotation-generator';
import { AnnotationFile, FunctionAnnotation, AnnotationMeta } from '../../../src/types/annotations';

// Mock dependencies
jest.mock('../../../src/core/indexing/indexer');
jest.mock('../../../src/config/config-manager');
jest.mock('../../../src/core/annotations/annotation-manager');
jest.mock('../../../src/core/annotations/annotation-generator');
jest.mock('../../../src/utils/file', () => ({
  readJsonFile: jest.fn(),
  getImpactDir: jest.fn().mockReturnValue('/tmp/.impact'),
}));

// Mock dynamic imports used inside handleGenerate
jest.mock('../../../src/core/indexing/parsers/typescript-parser', () => ({
  TypeScriptParser: jest.fn().mockImplementation(() => ({
    canParse: jest.fn().mockReturnValue(true),
    parse: jest.fn().mockResolvedValue({
      filePath: 'src/services/shipping.ts',
      imports: [],
      exports: [],
      functions: [{
        name: 'calculateShipping',
        signature: 'function calculateShipping(order: Order): number',
        startLine: 1,
        endLine: 20,
        params: [{ name: 'order', type: 'Order' }],
        returnType: 'number',
        isAsync: false,
        isExported: true,
      }],
      components: [],
      apiCalls: [],
      routeDefinitions: [],
      comments: [],
    }),
  })),
}));

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: jest.fn().mockReturnValue(true),
    readFileSync: jest.fn().mockReturnValue('// mock file content'),
  };
});

import { readJsonFile } from '../../../src/utils/file';

// ============================================================
// Helpers
// ============================================================

function createTestAnnotation(overrides?: Partial<FunctionAnnotation>): FunctionAnnotation {
  return {
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
        name: '배송비 정책',
        description: '배송비 계산',
        confidence: 0.9,
        category: '배송',
        inferred_from: 'test',
      },
    ],
    relatedFunctions: [],
    relatedApis: [],
    ...overrides,
  };
}

function createTestAnnotationFile(overrides?: Partial<AnnotationFile>): AnnotationFile {
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
      keywords: ['배송'],
    },
    annotations: [createTestAnnotation()],
    ...overrides,
  };
}

function createTestMeta(): AnnotationMeta {
  return {
    version: '1.0.0',
    createdAt: '2026-02-17T09:00:00Z',
    lastUpdatedAt: '2026-02-17T10:00:00Z',
    totalFiles: 3,
    totalAnnotations: 10,
    totalPolicies: 5,
    systems: {
      delivery: { files: 2, annotations: 7, policies: 3 },
      payment: { files: 1, annotations: 3, policies: 2 },
    },
    avgConfidence: 0.75,
    lowConfidenceCount: 1,
    userModifiedCount: 2,
  };
}

// ============================================================
// Tests
// ============================================================

describe('AnnotationsCommand', () => {
  let consoleSpy: jest.SpyInstance;
  let mockLoad: jest.Mock;
  let mockGetActiveProject: jest.Mock;
  let mockLoadIndex: jest.Mock;
  let mockAnnotationLoad: jest.Mock;
  let mockAnnotationLoadAll: jest.Mock;
  let mockAnnotationSave: jest.Mock;
  let mockAnnotationIsChanged: jest.Mock;
  let mockAnnotationMerge: jest.Mock;
  let mockAnnotationGetMeta: jest.Mock;
  let mockAnnotationUpdateMeta: jest.Mock;
  let mockGenerateBatch: jest.Mock;

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
    mockLoadIndex = jest.fn();
    (Indexer as jest.MockedClass<typeof Indexer>).mockImplementation(() => ({
      loadIndex: mockLoadIndex,
      fullIndex: jest.fn(),
      incrementalUpdate: jest.fn(),
      saveIndex: jest.fn(),
      isIndexStale: jest.fn(),
    }) as unknown as Indexer);

    // AnnotationManager mocks
    mockAnnotationLoad = jest.fn().mockResolvedValue(null);
    mockAnnotationLoadAll = jest.fn().mockResolvedValue(new Map());
    mockAnnotationSave = jest.fn().mockResolvedValue(undefined);
    mockAnnotationIsChanged = jest.fn().mockResolvedValue(true);
    mockAnnotationMerge = jest.fn().mockImplementation((_existing, updated) => Promise.resolve(updated));
    mockAnnotationGetMeta = jest.fn().mockResolvedValue(null);
    mockAnnotationUpdateMeta = jest.fn().mockResolvedValue({});

    (AnnotationManager as jest.MockedClass<typeof AnnotationManager>).mockImplementation(() => ({
      load: mockAnnotationLoad,
      loadAll: mockAnnotationLoadAll,
      save: mockAnnotationSave,
      isChanged: mockAnnotationIsChanged,
      merge: mockAnnotationMerge,
      getMeta: mockAnnotationGetMeta,
      updateMeta: mockAnnotationUpdateMeta,
      cleanup: jest.fn(),
      delete: jest.fn(),
    }) as unknown as AnnotationManager);

    // AnnotationGenerator mocks
    mockGenerateBatch = jest.fn().mockResolvedValue(new Map([
      ['src/services/shipping.ts', createTestAnnotationFile()],
    ]));

    (AnnotationGenerator as jest.MockedClass<typeof AnnotationGenerator>).mockImplementation(() => ({
      generateForFile: jest.fn(),
      generateBatch: mockGenerateBatch,
      analyzeFunction: jest.fn(),
      inferPolicies: jest.fn(),
      classifyFunctionType: jest.fn(),
      generateEnrichedComment: jest.fn(),
      calculateConfidence: jest.fn(),
      calculateSourceHash: jest.fn(),
    }) as unknown as AnnotationGenerator);

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

    // Default index
    mockLoadIndex.mockResolvedValue({
      meta: { stats: { totalFiles: 2 } },
      files: [
        { path: 'src/services/shipping.ts', hash: 'hash1', size: 100, language: 'typescript', lines: 50 },
        { path: 'src/services/payment.ts', hash: 'hash2', size: 200, language: 'typescript', lines: 80 },
      ],
      screens: [],
      components: [],
      apis: [],
      models: [],
      policies: [],
      dependencies: { graph: { nodes: [], edges: [] } },
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
    const cmd = new AnnotationsCommand([]);
    expect(cmd.name).toBe('annotations');
    expect(cmd.description.length).toBeGreaterThan(0);
    expect(typeof cmd.execute).toBe('function');
  });

  // ============================================================
  // generate 서브커맨드 테스트
  // ============================================================

  describe('generate', () => {
    it('should load index and generate annotations', async () => {
      const cmd = new AnnotationsCommand(['generate']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(mockLoadIndex).toHaveBeenCalledWith('test-project');
      expect(mockGenerateBatch).toHaveBeenCalled();
      expect(mockAnnotationSave).toHaveBeenCalled();
      expect(mockAnnotationUpdateMeta).toHaveBeenCalled();
    });

    it('should filter files by path when path argument is provided', async () => {
      const cmd = new AnnotationsCommand(['generate', 'src/services/shipping']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      // generateBatch should be called with filtered files
      expect(mockGenerateBatch).toHaveBeenCalled();
    });

    it('should skip unchanged files (sourceHash same)', async () => {
      mockAnnotationIsChanged.mockResolvedValue(false);

      const cmd = new AnnotationsCommand(['generate']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      // No files should be generated since all are unchanged
      expect(mockGenerateBatch).not.toHaveBeenCalled();
    });

    it('should preserve userModified via merge when existing annotations exist', async () => {
      const existingAnnotation = createTestAnnotationFile({
        annotations: [
          createTestAnnotation({ userModified: true, lastModifiedBy: 'user@test.com' }),
        ],
      });
      mockAnnotationLoad.mockResolvedValue(existingAnnotation);

      const cmd = new AnnotationsCommand(['generate']);
      await cmd.execute();

      expect(mockAnnotationMerge).toHaveBeenCalled();
    });

    it('should return NEEDS_CONFIG when no active project', async () => {
      mockGetActiveProject.mockReturnValue(null);

      const cmd = new AnnotationsCommand(['generate']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.NEEDS_CONFIG);
      expect(result.message).toContain('프로젝트를 먼저 설정해주세요');
    });

    it('should return NEEDS_INDEX when index is missing', async () => {
      mockLoadIndex.mockResolvedValue(null);

      const cmd = new AnnotationsCommand(['generate']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.NEEDS_INDEX);
      expect(result.message).toContain('인덱스가 없습니다');
    });

    it('should output completion summary', async () => {
      const cmd = new AnnotationsCommand(['generate']);
      await cmd.execute();

      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
      expect(allOutput).toContain('보강 주석 생성 완료');
      expect(allOutput).toContain('분석 파일 수');
      expect(allOutput).toContain('함수 수');
      expect(allOutput).toContain('추론 정책 수');
      expect(allOutput).toContain('소요 시간');
    });
  });

  // ============================================================
  // view 서브커맨드 테스트
  // ============================================================

  describe('view', () => {
    it('should display single file annotation when path is provided', async () => {
      mockAnnotationLoad.mockResolvedValue(createTestAnnotationFile());

      const cmd = new AnnotationsCommand(['view', 'src/services/shipping.ts']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(mockAnnotationLoad).toHaveBeenCalledWith('test-project', 'src/services/shipping.ts');

      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
      expect(allOutput).toContain('calculateShipping');
      expect(allOutput).toContain('배송비를 계산합니다.');
    });

    it('should display overall statistics when no path is provided', async () => {
      mockAnnotationGetMeta.mockResolvedValue(createTestMeta());

      const cmd = new AnnotationsCommand(['view']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);

      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
      expect(allOutput).toContain('보강 주석 통계');
      expect(allOutput).toContain('전체 파일 수');
      expect(allOutput).toContain('전체 보강 주석 수');
      expect(allOutput).toContain('전체 정책 수');
    });

    it('should show "no annotations" message when annotation not found for file', async () => {
      mockAnnotationLoad.mockResolvedValue(null);

      const cmd = new AnnotationsCommand(['view', 'src/services/nonexistent.ts']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('보강 주석이 없습니다');
    });

    it('should show "no annotations" message when no meta exists', async () => {
      mockAnnotationGetMeta.mockResolvedValue(null);

      const cmd = new AnnotationsCommand(['view']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('보강 주석이 없습니다');
    });

    it('should return NEEDS_CONFIG when no active project', async () => {
      mockGetActiveProject.mockReturnValue(null);

      const cmd = new AnnotationsCommand(['view']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.NEEDS_CONFIG);
    });
  });

  // ============================================================
  // 기본 커맨드 (서브커맨드 없음)
  // ============================================================

  describe('default (no subcommand)', () => {
    it('should display usage information', async () => {
      const cmd = new AnnotationsCommand([]);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);

      const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
      expect(allOutput).toContain('사용법');
      expect(allOutput).toContain('generate');
      expect(allOutput).toContain('view');
    });
  });
});
