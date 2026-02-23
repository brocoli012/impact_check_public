/**
 * @module tests/unit/commands/result-status
 * @description ResultStatusCommand 단위 테스트 (TASK-062)
 */

import { ResultStatusCommand } from '../../../src/commands/result-status';
import { ResultManager, ResultSummary } from '../../../src/core/analysis/result-manager';
import { ResultCode } from '../../../src/types/common';

// logger mock
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    header: jest.fn(),
  },
}));

// ConfigManager mock
jest.mock('../../../src/config/config-manager', () => ({
  ConfigManager: jest.fn().mockImplementation(() => ({
    load: jest.fn(),
    getActiveProject: jest.fn().mockReturnValue('test-project'),
  })),
}));

// Mock ResultManager
jest.mock('../../../src/core/analysis/result-manager');

const mockSummary: ResultSummary = {
  id: 'analysis-001',
  specTitle: 'Test Spec',
  analyzedAt: '2024-01-15T10:00:00Z',
  totalScore: 15,
  grade: 'Low',
  affectedScreenCount: 0,
  taskCount: 0,
  status: 'active',
};

const mockList = jest.fn<Promise<ResultSummary[]>, [string]>();
const mockFindByAnalysisId = jest.fn();
const mockUpdateStatus = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (ResultManager as jest.MockedClass<typeof ResultManager>).mockImplementation(() => ({
    list: mockList,
    findByAnalysisId: mockFindByAnalysisId,
    updateStatus: mockUpdateStatus,
    save: jest.fn(),
    getById: jest.fn(),
    getLatest: jest.fn(),
    getLatestActive: jest.fn(),
    listByStatus: jest.fn(),
    getEffectiveStatus: jest.fn(),
    updateCrossProjectDetection: jest.fn(),
  } as unknown as ResultManager));
});

describe('ResultStatusCommand (TASK-062)', () => {
  it('should have name "result-status"', () => {
    const cmd = new ResultStatusCommand([]);
    expect(cmd.name).toBe('result-status');
  });

  it('should return FAILURE for no arguments', async () => {
    const cmd = new ResultStatusCommand([]);
    const result = await cmd.execute();
    expect(result.code).toBe(ResultCode.FAILURE);
  });

  describe('set subcommand', () => {
    it('should return FAILURE when missing analysisId or status', async () => {
      const cmd = new ResultStatusCommand(['set']);
      const result = await cmd.execute();
      expect(result.code).toBe(ResultCode.FAILURE);
    });

    it('should return FAILURE for invalid status value', async () => {
      const cmd = new ResultStatusCommand(['set', 'analysis-001', 'invalid']);
      const result = await cmd.execute();
      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('Invalid status');
    });

    it('should return SUCCESS for valid set command', async () => {
      mockFindByAnalysisId.mockResolvedValue({
        projectId: 'test-project',
        summary: mockSummary,
      });
      mockUpdateStatus.mockResolvedValue({ ...mockSummary, status: 'completed' });

      const cmd = new ResultStatusCommand(['set', 'analysis-001', 'completed']);
      const result = await cmd.execute();
      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('completed');
    });

    it('should return FAILURE when analysis not found', async () => {
      mockFindByAnalysisId.mockResolvedValue(null);

      const cmd = new ResultStatusCommand(['set', 'nonexistent', 'completed']);
      const result = await cmd.execute();
      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('not found');
    });

    it('should return FAILURE for invalid transition', async () => {
      mockFindByAnalysisId.mockResolvedValue({
        projectId: 'test-project',
        summary: { ...mockSummary, status: 'archived' },
      });
      mockUpdateStatus.mockRejectedValue(new Error('폐기된 분석은 상태를 변경할 수 없습니다.'));

      const cmd = new ResultStatusCommand(['set', 'analysis-001', 'active']);
      const result = await cmd.execute();
      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('폐기');
    });
  });

  describe('--list subcommand', () => {
    it('should return SUCCESS for --list with --project', async () => {
      mockList.mockResolvedValue([mockSummary]);

      const cmd = new ResultStatusCommand(['--list', '--project', 'test-project']);
      const result = await cmd.execute();
      expect(result.code).toBe(ResultCode.SUCCESS);
      expect((result.data as ResultSummary[]).length).toBe(1);
    });

    it('should filter by --status when provided', async () => {
      mockList.mockResolvedValue([
        mockSummary,
        { ...mockSummary, id: 'analysis-002', status: 'completed' },
      ]);

      const cmd = new ResultStatusCommand(['--list', '--project', 'test-project', '--status', 'active']);
      const result = await cmd.execute();
      expect(result.code).toBe(ResultCode.SUCCESS);
      expect((result.data as ResultSummary[]).length).toBe(1);
    });

    it('should return all results when --status is "all"', async () => {
      mockList.mockResolvedValue([
        mockSummary,
        { ...mockSummary, id: 'analysis-002', status: 'completed' },
      ]);

      const cmd = new ResultStatusCommand(['--list', '--project', 'test-project', '--status', 'all']);
      const result = await cmd.execute();
      expect(result.code).toBe(ResultCode.SUCCESS);
      expect((result.data as ResultSummary[]).length).toBe(2);
    });

    it('should return FAILURE for invalid status filter', async () => {
      mockList.mockResolvedValue([mockSummary]);

      const cmd = new ResultStatusCommand(['--list', '--project', 'test-project', '--status', 'invalid']);
      const result = await cmd.execute();
      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('Invalid status filter');
    });
  });
});
