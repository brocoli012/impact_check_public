/**
 * @module tests/unit/commands/export-index
 * @description ExportIndexCommand 단위 테스트
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ExportIndexCommand } from '../../../src/commands/export-index';
import { ResultCode } from '../../../src/types/common';
import { Indexer } from '../../../src/core/indexing/indexer';
import { ConfigManager } from '../../../src/config/config-manager';
import { CodeIndex } from '../../../src/types/index';

// Mock dependencies
jest.mock('../../../src/core/indexing/indexer');
jest.mock('../../../src/config/config-manager');

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
        models: 0,
        modules: 3,
      },
    },
    files: [],
    screens: [{
      id: 'screen-1',
      name: 'Home',
      route: '/home',
      filePath: 'src/pages/Home.tsx',
      components: ['comp-1'],
      apiCalls: [],
      childScreens: [],
      metadata: { linesOfCode: 50, complexity: 'low' },
    }],
    components: [{
      id: 'comp-1',
      name: 'Header',
      filePath: 'src/components/Header.tsx',
      type: 'function',
      imports: [],
      importedBy: [],
      props: ['title'],
      emits: [],
      apiCalls: [],
      linesOfCode: 20,
    }],
    apis: [],
    models: [],
    events: [],
    policies: [],
    dependencies: { graph: { nodes: [], edges: [] } },
  };
}

describe('ExportIndexCommand', () => {
  let consoleSpy: jest.SpyInstance;
  let mockLoadIndex: jest.Mock;
  let mockLoad: jest.Mock;
  let mockGetActiveProject: jest.Mock;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    // Reset mocks
    mockLoadIndex = jest.fn();
    mockLoad = jest.fn();
    mockGetActiveProject = jest.fn();

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
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('should implement Command interface', () => {
    const cmd = new ExportIndexCommand([]);
    expect(cmd.name).toBe('export-index');
    expect(cmd.description.length).toBeGreaterThan(0);
    expect(typeof cmd.execute).toBe('function');
  });

  it('should return NEEDS_INDEX when no active project', async () => {
    mockLoad.mockResolvedValue(undefined);
    mockGetActiveProject.mockReturnValue(null);

    const cmd = new ExportIndexCommand([]);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.NEEDS_INDEX);
    expect(result.message).toContain('No active project');
  });

  it('should return NEEDS_INDEX when index not found', async () => {
    mockLoad.mockResolvedValue(undefined);
    mockGetActiveProject.mockReturnValue('test-project');
    mockLoadIndex.mockResolvedValue(null);

    const cmd = new ExportIndexCommand([]);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.NEEDS_INDEX);
    expect(result.message).toContain('reindex');
  });

  it('should output summary JSON to stdout by default', async () => {
    mockLoad.mockResolvedValue(undefined);
    mockGetActiveProject.mockReturnValue('test-project');
    mockLoadIndex.mockResolvedValue(createMockCodeIndex());

    const cmd = new ExportIndexCommand([]);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.SUCCESS);
    expect(result.data).toEqual(expect.objectContaining({ mode: 'summary' }));

    // Should have called console.log with JSON string
    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    // Summary should have dependencyOverview instead of raw dependencies
    expect(parsed).toHaveProperty('dependencyOverview');
    expect(parsed).toHaveProperty('meta');
    expect(parsed).toHaveProperty('screens');
  });

  it('should output full JSON when --full is provided', async () => {
    mockLoad.mockResolvedValue(undefined);
    mockGetActiveProject.mockReturnValue('test-project');
    mockLoadIndex.mockResolvedValue(createMockCodeIndex());

    const cmd = new ExportIndexCommand(['--full']);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.SUCCESS);
    expect(result.data).toEqual(expect.objectContaining({ mode: 'full' }));

    const output = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    // Full index has dependencies, not dependencyOverview
    expect(parsed).toHaveProperty('dependencies');
    expect(parsed).toHaveProperty('files');
  });

  it('should use --project option instead of active project', async () => {
    mockLoadIndex.mockResolvedValue(createMockCodeIndex());

    const cmd = new ExportIndexCommand(['--project', 'custom-project']);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.SUCCESS);
    expect(result.data).toEqual(expect.objectContaining({ projectId: 'custom-project' }));
    // Should not have called ConfigManager
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('should write to file when --output is provided', async () => {
    mockLoad.mockResolvedValue(undefined);
    mockGetActiveProject.mockReturnValue('test-project');
    mockLoadIndex.mockResolvedValue(createMockCodeIndex());

    const tmpFile = path.join(os.tmpdir(), `kic-test-${Date.now()}.json`);

    try {
      const cmd = new ExportIndexCommand(['--output', tmpFile]);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.data).toEqual(expect.objectContaining({ outputPath: tmpFile }));

      // Verify file was written
      const content = fs.readFileSync(tmpFile, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed).toHaveProperty('meta');
    } finally {
      // Cleanup
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    }
  });

  it('should combine --full and --output', async () => {
    mockLoad.mockResolvedValue(undefined);
    mockGetActiveProject.mockReturnValue('test-project');
    mockLoadIndex.mockResolvedValue(createMockCodeIndex());

    const tmpFile = path.join(os.tmpdir(), `kic-test-full-${Date.now()}.json`);

    try {
      const cmd = new ExportIndexCommand(['--full', '--output', tmpFile]);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.data).toEqual(expect.objectContaining({ mode: 'full', outputPath: tmpFile }));

      const content = fs.readFileSync(tmpFile, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed).toHaveProperty('dependencies');
    } finally {
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    }
  });
});
