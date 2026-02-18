/**
 * @module tests/unit/commands/save-result
 * @description SaveResultCommand 단위 테스트
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SaveResultCommand } from '../../../src/commands/save-result';
import { ResultCode } from '../../../src/types/common';
import { ResultManager } from '../../../src/core/analysis/result-manager';
import { ConfigManager } from '../../../src/config/config-manager';

// Mock dependencies
jest.mock('../../../src/core/analysis/result-manager');
jest.mock('../../../src/config/config-manager');

/** 테스트용 최소 유효 ConfidenceEnrichedResult JSON */
function createValidResultJson(): Record<string, unknown> {
  return {
    analysisId: 'test-analysis-001',
    analyzedAt: '2025-01-01T00:00:00Z',
    specTitle: 'Test Spec Title',
    analysisMethod: 'rule-based',
    affectedScreens: [],
    tasks: [],
    planningChecks: [],
    policyChanges: [],
    screenScores: [],
    totalScore: 25,
    grade: 'Medium',
    recommendation: 'Review needed',
    policyWarnings: [],
    ownerNotifications: [],
    confidenceScores: [],
    lowConfidenceWarnings: [],
  };
}

describe('SaveResultCommand', () => {
  let consoleSpy: jest.SpyInstance;
  let mockSave: jest.Mock;
  let mockLoad: jest.Mock;
  let mockGetActiveProject: jest.Mock;
  let tmpDir: string;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    // Create temp dir for test files
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kic-test-'));

    // Reset mocks
    mockSave = jest.fn().mockResolvedValue('test-analysis-001');
    mockLoad = jest.fn();
    mockGetActiveProject = jest.fn();

    (ResultManager as jest.MockedClass<typeof ResultManager>).mockImplementation(() => ({
      save: mockSave,
      getLatest: jest.fn(),
      getById: jest.fn(),
      list: jest.fn(),
    }) as unknown as ResultManager);

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

    // Cleanup temp dir
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should implement Command interface', () => {
    const cmd = new SaveResultCommand([]);
    expect(cmd.name).toBe('save-result');
    expect(cmd.description.length).toBeGreaterThan(0);
    expect(typeof cmd.execute).toBe('function');
  });

  it('should return FAILURE when --file is missing', async () => {
    const cmd = new SaveResultCommand([]);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.FAILURE);
    expect(result.message).toContain('--file');
  });

  it('should return FAILURE when file does not exist', async () => {
    const cmd = new SaveResultCommand(['--file', '/nonexistent/file.json']);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.FAILURE);
    expect(result.message).toContain('not found');
  });

  it('should return FAILURE when file is not valid JSON', async () => {
    const filePath = path.join(tmpDir, 'invalid.json');
    fs.writeFileSync(filePath, 'not valid json {{{', 'utf-8');

    const cmd = new SaveResultCommand(['--file', filePath]);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.FAILURE);
    expect(result.message).toContain('parse');
  });

  it('should return FAILURE when JSON fails validation', async () => {
    const filePath = path.join(tmpDir, 'invalid-result.json');
    fs.writeFileSync(filePath, JSON.stringify({ foo: 'bar' }), 'utf-8');

    const cmd = new SaveResultCommand(['--file', filePath]);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.FAILURE);
    expect(result.message).toContain('Validation failed');
  });

  it('should return NEEDS_INDEX when no active project', async () => {
    const filePath = path.join(tmpDir, 'valid-result.json');
    fs.writeFileSync(filePath, JSON.stringify(createValidResultJson()), 'utf-8');

    mockLoad.mockResolvedValue(undefined);
    mockGetActiveProject.mockReturnValue(null);

    const cmd = new SaveResultCommand(['--file', filePath]);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.NEEDS_INDEX);
    expect(result.message).toContain('No active project');
  });

  it('should save result successfully with active project', async () => {
    const filePath = path.join(tmpDir, 'valid-result.json');
    fs.writeFileSync(filePath, JSON.stringify(createValidResultJson()), 'utf-8');

    mockLoad.mockResolvedValue(undefined);
    mockGetActiveProject.mockReturnValue('test-project');

    const cmd = new SaveResultCommand(['--file', filePath]);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.SUCCESS);
    expect(result.message).toContain('test-analysis-001');
    expect(result.data).toEqual(expect.objectContaining({
      resultId: 'test-analysis-001',
      projectId: 'test-project',
    }));

    // Verify ResultManager.save was called
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({ analysisId: 'test-analysis-001' }),
      'test-project',
    );
  });

  it('should use --project option instead of active project', async () => {
    const filePath = path.join(tmpDir, 'valid-result.json');
    fs.writeFileSync(filePath, JSON.stringify(createValidResultJson()), 'utf-8');

    const cmd = new SaveResultCommand(['--file', filePath, '--project', 'custom-project']);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.SUCCESS);
    expect(result.data).toEqual(expect.objectContaining({ projectId: 'custom-project' }));
    // Should not have called ConfigManager
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('should set analysisMethod to "claude-native" when missing', async () => {
    const data = createValidResultJson();
    delete data['analysisMethod'];
    const filePath = path.join(tmpDir, 'no-method.json');
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');

    mockLoad.mockResolvedValue(undefined);
    mockGetActiveProject.mockReturnValue('test-project');

    const cmd = new SaveResultCommand(['--file', filePath]);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.SUCCESS);

    // Verify the saved result has analysisMethod set
    const savedData = mockSave.mock.calls[0][0];
    expect(savedData.analysisMethod).toBe('claude-native');
  });

  it('should preserve existing analysisMethod', async () => {
    const data = createValidResultJson();
    data['analysisMethod'] = 'rule-based';
    const filePath = path.join(tmpDir, 'with-method.json');
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');

    mockLoad.mockResolvedValue(undefined);
    mockGetActiveProject.mockReturnValue('test-project');

    const cmd = new SaveResultCommand(['--file', filePath]);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.SUCCESS);

    const savedData = mockSave.mock.calls[0][0];
    expect(savedData.analysisMethod).toBe('rule-based');
  });

  it('should save result with parsedSpec and analysisSummary (REQ-009)', async () => {
    const data = createValidResultJson();
    data['parsedSpec'] = {
      title: 'Test Spec',
      requirements: [],
      features: [{ id: 'F-001', name: 'Feature', description: 'desc', targetScreen: '', actionType: 'new', keywords: [] }],
      businessRules: [],
      targetScreens: [],
      keywords: [],
      ambiguities: [],
    };
    data['analysisSummary'] = {
      overview: 'Test overview for analysis',
      keyFindings: ['finding1'],
      riskAreas: ['risk1'],
    };
    const filePath = path.join(tmpDir, 'result-with-req009.json');
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');

    mockLoad.mockResolvedValue(undefined);
    mockGetActiveProject.mockReturnValue('test-project');

    const cmd = new SaveResultCommand(['--file', filePath]);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.SUCCESS);

    // Verify parsedSpec and analysisSummary were preserved in saved data
    const savedData = mockSave.mock.calls[0][0];
    expect(savedData.parsedSpec).toBeDefined();
    expect(savedData.parsedSpec.title).toBe('Test Spec');
    expect(savedData.analysisSummary).toBeDefined();
    expect(savedData.analysisSummary.overview).toBe('Test overview for analysis');
  });

  it('should reject invalid parsedSpec structure', async () => {
    const data = createValidResultJson();
    data['parsedSpec'] = 'not-an-object';
    const filePath = path.join(tmpDir, 'invalid-parsedspec.json');
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');

    const cmd = new SaveResultCommand(['--file', filePath]);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.FAILURE);
    expect(result.message).toContain('parsedSpec');
  });

  it('should reject invalid analysisSummary structure', async () => {
    const data = createValidResultJson();
    data['analysisSummary'] = 'not-an-object';
    const filePath = path.join(tmpDir, 'invalid-summary.json');
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');

    const cmd = new SaveResultCommand(['--file', filePath]);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.FAILURE);
    expect(result.message).toContain('analysisSummary');
  });

  it('should return FAILURE for specific validation errors', async () => {
    const data = createValidResultJson();
    data['totalScore'] = 'not-a-number';
    data['grade'] = 'Invalid';
    delete data['analysisId'];

    const filePath = path.join(tmpDir, 'partial-invalid.json');
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');

    const cmd = new SaveResultCommand(['--file', filePath]);
    const result = await cmd.execute();

    expect(result.code).toBe(ResultCode.FAILURE);
    expect(result.message).toContain('analysisId');
    expect(result.message).toContain('totalScore');
    expect(result.message).toContain('grade');
  });
});
