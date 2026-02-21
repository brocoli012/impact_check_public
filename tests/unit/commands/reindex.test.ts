/**
 * @module tests/unit/commands/reindex
 * @description ReindexCommand 단위 테스트
 *
 * 증분/전체 인덱싱 분기, isIndexStale 확인, 폴백 로직,
 * --full / --incremental 옵션, 진행 상황 메시지 출력을 검증합니다.
 */

import { ReindexCommand } from '../../../src/commands/reindex';
import { ResultCode } from '../../../src/types/common';
import { Indexer } from '../../../src/core/indexing/indexer';
import { ConfigManager } from '../../../src/config/config-manager';
import { CodeIndex } from '../../../src/types/index';

// Mock dependencies
jest.mock('../../../src/core/indexing/indexer');
jest.mock('../../../src/config/config-manager');
jest.mock('../../../src/utils/file', () => ({
  readJsonFile: jest.fn(),
  getImpactDir: jest.fn().mockReturnValue('/tmp/.impact'),
}));

import { readJsonFile } from '../../../src/utils/file';

/** 테스트용 최소 CodeIndex */
function createMockCodeIndex(overrides?: Partial<CodeIndex['meta']>): CodeIndex {
  return {
    meta: {
      version: 1,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      gitCommit: 'abc123',
      gitBranch: 'main',
      lastUpdateType: 'full',
      project: {
        name: 'test-project',
        path: '/test/path',
        techStack: ['typescript'],
        packageManager: 'npm',
      },
      stats: {
        totalFiles: 10,
        screens: 1,
        components: 3,
        apiEndpoints: 2,
        models: 0,
        modules: 4,
      },
      ...overrides,
    },
    files: [],
    screens: [],
    components: [],
    apis: [],
    models: [],
    events: [],
    policies: [{ id: 'p1', name: 'test', description: 'test', source: 'manual' as const, sourceText: '', filePath: '', lineNumber: 0, category: 'business', relatedComponents: [], relatedApis: [], relatedModules: [], extractedAt: '2025-01-01T00:00:00Z' }],
    dependencies: { graph: { nodes: [], edges: [] } },
  };
}

describe('ReindexCommand', () => {
  let consoleSpy: jest.SpyInstance;
  let mockFullIndex: jest.Mock;
  let mockIncrementalUpdate: jest.Mock;
  let mockSaveIndex: jest.Mock;
  let mockIsIndexStale: jest.Mock;
  let mockLoad: jest.Mock;
  let mockGetActiveProject: jest.Mock;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    // Reset mocks
    mockFullIndex = jest.fn();
    mockIncrementalUpdate = jest.fn();
    mockSaveIndex = jest.fn().mockResolvedValue(undefined);
    mockIsIndexStale = jest.fn();
    mockLoad = jest.fn().mockResolvedValue(undefined);
    mockGetActiveProject = jest.fn();

    (Indexer as jest.MockedClass<typeof Indexer>).mockImplementation(() => ({
      fullIndex: mockFullIndex,
      incrementalUpdate: mockIncrementalUpdate,
      saveIndex: mockSaveIndex,
      isIndexStale: mockIsIndexStale,
      loadIndex: jest.fn(),
    }) as unknown as Indexer);

    (ConfigManager as jest.MockedClass<typeof ConfigManager>).mockImplementation(() => ({
      load: mockLoad,
      getActiveProject: mockGetActiveProject,
      save: jest.fn(),
      getConfig: jest.fn(),
      setActiveProject: jest.fn(),
      reset: jest.fn(),
    }) as unknown as ConfigManager);

    // Default: active project exists with valid config
    mockGetActiveProject.mockReturnValue('test-project');
    (readJsonFile as jest.Mock).mockReturnValue({
      activeProject: 'test-project',
      projects: [{
        id: 'test-project',
        name: 'Test Project',
        path: '/test/path',
        status: 'active',
        createdAt: '2025-01-01T00:00:00Z',
        lastUsedAt: '2025-01-01T00:00:00Z',
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

  it('should implement Command interface with correct name and description', () => {
    const cmd = new ReindexCommand([]);
    expect(cmd.name).toBe('reindex');
    expect(cmd.description.length).toBeGreaterThan(0);
    expect(typeof cmd.execute).toBe('function');
  });

  // ============================================================
  // 활성 프로젝트 없는 경우
  // ============================================================

  it('should return NEEDS_INDEX when no active project', async () => {
    mockGetActiveProject.mockReturnValue(null);

    const cmd = new ReindexCommand([]);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.NEEDS_INDEX);
    expect(result.message).toContain('No active project');
  });

  // ============================================================
  // 기본 동작: isIndexStale 호출 테스트
  // ============================================================

  it('should call isIndexStale in default mode (no flags)', async () => {
    mockIsIndexStale.mockResolvedValue(true);
    mockIncrementalUpdate.mockResolvedValue(createMockCodeIndex({ lastUpdateType: 'incremental' }));

    const cmd = new ReindexCommand([]);
    await cmd.execute();

    expect(mockIsIndexStale).toHaveBeenCalledWith('/test/path', 'test-project');
  });

  // ============================================================
  // stale이 아닐 때 "최신 상태" 메시지 테스트
  // ============================================================

  it('should return "up to date" message when index is not stale (default mode)', async () => {
    mockIsIndexStale.mockResolvedValue(false);

    const cmd = new ReindexCommand([]);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.SUCCESS);
    expect(result.message).toContain('up to date');
    expect((result.data as Record<string, unknown>).upToDate).toBe(true);
    expect((result.data as Record<string, unknown>).mode).toBe('none');

    // fullIndex와 incrementalUpdate 모두 호출되지 않아야 함
    expect(mockFullIndex).not.toHaveBeenCalled();
    expect(mockIncrementalUpdate).not.toHaveBeenCalled();
  });

  it('should output progress message about checking index state', async () => {
    mockIsIndexStale.mockResolvedValue(false);

    const cmd = new ReindexCommand([]);
    await cmd.execute();

    const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
    expect(allOutput).toContain('인덱스 상태 확인 중');
  });

  // ============================================================
  // stale일 때 incrementalUpdate 호출 테스트
  // ============================================================

  it('should call incrementalUpdate when index is stale', async () => {
    mockIsIndexStale.mockResolvedValue(true);
    mockIncrementalUpdate.mockResolvedValue(createMockCodeIndex({ lastUpdateType: 'incremental' }));

    const cmd = new ReindexCommand([]);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.SUCCESS);
    expect(mockIncrementalUpdate).toHaveBeenCalledWith('/test/path', 'test-project');
    expect(mockFullIndex).not.toHaveBeenCalled();
  });

  it('should output "변경된 파일 감지 중" message when stale', async () => {
    mockIsIndexStale.mockResolvedValue(true);
    mockIncrementalUpdate.mockResolvedValue(createMockCodeIndex({ lastUpdateType: 'incremental' }));

    const cmd = new ReindexCommand([]);
    await cmd.execute();

    const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
    expect(allOutput).toContain('변경된 파일 감지 중');
  });

  // ============================================================
  // --full 옵션에서 fullIndex 직접 호출 테스트
  // ============================================================

  it('should call fullIndex directly when --full is provided', async () => {
    mockFullIndex.mockResolvedValue(createMockCodeIndex({ lastUpdateType: 'full' }));

    const cmd = new ReindexCommand(['--full']);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.SUCCESS);
    expect(mockFullIndex).toHaveBeenCalledWith('/test/path');
    expect(mockIncrementalUpdate).not.toHaveBeenCalled();
    expect(mockIsIndexStale).not.toHaveBeenCalled();
  });

  it('should not call isIndexStale when --full is provided', async () => {
    mockFullIndex.mockResolvedValue(createMockCodeIndex());

    const cmd = new ReindexCommand(['--full']);
    await cmd.execute();

    expect(mockIsIndexStale).not.toHaveBeenCalled();
  });

  it('should output "전체 재인덱싱" mode when --full is provided', async () => {
    mockFullIndex.mockResolvedValue(createMockCodeIndex());

    const cmd = new ReindexCommand(['--full']);
    await cmd.execute();

    const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
    expect(allOutput).toContain('전체 재인덱싱');
  });

  // ============================================================
  // --incremental 옵션 테스트
  // ============================================================

  it('should force incrementalUpdate even when not stale with --incremental', async () => {
    mockIsIndexStale.mockResolvedValue(false);
    mockIncrementalUpdate.mockResolvedValue(createMockCodeIndex({ lastUpdateType: 'incremental' }));

    const cmd = new ReindexCommand(['--incremental']);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.SUCCESS);
    expect(mockIncrementalUpdate).toHaveBeenCalledWith('/test/path', 'test-project');
  });

  it('should output "증분 업데이트 (명시적)" mode when --incremental is provided', async () => {
    mockIsIndexStale.mockResolvedValue(false);
    mockIncrementalUpdate.mockResolvedValue(createMockCodeIndex({ lastUpdateType: 'incremental' }));

    const cmd = new ReindexCommand(['--incremental']);
    await cmd.execute();

    const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
    expect(allOutput).toContain('증분 업데이트 (명시적)');
  });

  // ============================================================
  // incrementalUpdate 실패 시 fullIndex 폴백 테스트
  // ============================================================

  it('should fallback to fullIndex when incrementalUpdate fails', async () => {
    mockIsIndexStale.mockResolvedValue(true);
    mockIncrementalUpdate.mockRejectedValue(new Error('Incremental update failed'));
    mockFullIndex.mockResolvedValue(createMockCodeIndex({ lastUpdateType: 'full' }));

    const cmd = new ReindexCommand([]);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.SUCCESS);
    expect(mockIncrementalUpdate).toHaveBeenCalled();
    expect(mockFullIndex).toHaveBeenCalledWith('/test/path');
  });

  it('should output fallback warning message when incrementalUpdate fails', async () => {
    mockIsIndexStale.mockResolvedValue(true);
    mockIncrementalUpdate.mockRejectedValue(new Error('Git diff failed'));
    mockFullIndex.mockResolvedValue(createMockCodeIndex());

    const cmd = new ReindexCommand([]);
    await cmd.execute();

    const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
    expect(allOutput).toContain('증분 인덱싱 실패, 전체 인덱싱으로 전환합니다');
  });

  // ============================================================
  // 진행 상황 메시지 출력 테스트
  // ============================================================

  it('should output completion summary with file count and elapsed time', async () => {
    mockIsIndexStale.mockResolvedValue(true);
    const mockIndex = createMockCodeIndex({ lastUpdateType: 'incremental' });
    mockIncrementalUpdate.mockResolvedValue(mockIndex);

    const cmd = new ReindexCommand([]);
    await cmd.execute();

    const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
    expect(allOutput).toContain('인덱싱 완료');
    expect(allOutput).toContain('10개 파일 처리');
    expect(allOutput).toContain('소요 시간');
  });

  it('should output index summary statistics', async () => {
    mockFullIndex.mockResolvedValue(createMockCodeIndex());

    const cmd = new ReindexCommand(['--full']);
    await cmd.execute();

    const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
    expect(allOutput).toContain('인덱싱 결과 요약');
    expect(allOutput).toContain('파일 수');
    expect(allOutput).toContain('화면 수');
    expect(allOutput).toContain('컴포넌트 수');
    expect(allOutput).toContain('API 엔드포인트');
    expect(allOutput).toContain('모듈 수');
    expect(allOutput).toContain('정책 수');
  });

  // ============================================================
  // 결과 데이터 검증
  // ============================================================

  it('should include mode in result data for full reindex', async () => {
    mockFullIndex.mockResolvedValue(createMockCodeIndex());

    const cmd = new ReindexCommand(['--full']);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.SUCCESS);
    const data = result.data as Record<string, unknown>;
    expect(data.mode).toBe('full');
    expect(data.projectId).toBe('test-project');
    expect(data.stats).toBeDefined();
    expect(data.elapsedSeconds).toEqual(expect.any(Number));
  });

  it('should include mode from meta.lastUpdateType for incremental reindex', async () => {
    mockIsIndexStale.mockResolvedValue(true);
    mockIncrementalUpdate.mockResolvedValue(createMockCodeIndex({ lastUpdateType: 'incremental' }));

    const cmd = new ReindexCommand([]);
    const result = await cmd.execute();

    const data = result.data as Record<string, unknown>;
    expect(data.mode).toBe('incremental');
  });

  // ============================================================
  // saveIndex 호출 검증
  // ============================================================

  it('should save index after successful indexing', async () => {
    const mockIndex = createMockCodeIndex();
    mockFullIndex.mockResolvedValue(mockIndex);

    const cmd = new ReindexCommand(['--full']);
    await cmd.execute();

    expect(mockSaveIndex).toHaveBeenCalledWith(mockIndex, 'test-project');
  });

  it('should not save index when already up to date', async () => {
    mockIsIndexStale.mockResolvedValue(false);

    const cmd = new ReindexCommand([]);
    await cmd.execute();

    expect(mockSaveIndex).not.toHaveBeenCalled();
  });

  // ============================================================
  // 에러 처리 테스트
  // ============================================================

  it('should return FAILURE when projects config is not found', async () => {
    (readJsonFile as jest.Mock).mockReturnValue(null);

    const cmd = new ReindexCommand([]);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.FAILURE);
    expect(result.message).toContain('Projects config not found');
  });

  it('should return FAILURE when project is not found in config', async () => {
    (readJsonFile as jest.Mock).mockReturnValue({
      activeProject: 'test-project',
      projects: [{ id: 'other-project', name: 'Other', path: '/other', status: 'active', createdAt: '', lastUsedAt: '', techStack: [] }],
    });

    const cmd = new ReindexCommand([]);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.FAILURE);
    expect(result.message).toContain('Project not found');
  });

  it('should return FAILURE when fullIndex throws in --full mode', async () => {
    mockFullIndex.mockRejectedValue(new Error('Disk full'));

    const cmd = new ReindexCommand(['--full']);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.FAILURE);
    expect(result.message).toContain('Disk full');
  });

  it('should return FAILURE when both incremental and full fallback fail', async () => {
    mockIsIndexStale.mockResolvedValue(true);
    mockIncrementalUpdate.mockRejectedValue(new Error('Incremental failed'));
    mockFullIndex.mockRejectedValue(new Error('Full also failed'));

    const cmd = new ReindexCommand([]);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.FAILURE);
    expect(result.message).toContain('Full also failed');
  });

  // ============================================================
  // "자동 감지" 모드 출력 테스트
  // ============================================================

  it('should output "자동 감지" mode in default (no flags) mode', async () => {
    mockIsIndexStale.mockResolvedValue(false);

    const cmd = new ReindexCommand([]);
    await cmd.execute();

    const allOutput = consoleSpy.mock.calls.map((call: unknown[]) => call.map(String).join(' ')).join('\n');
    expect(allOutput).toContain('자동 감지');
  });
});
