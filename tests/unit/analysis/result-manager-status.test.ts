/**
 * @module tests/unit/analysis/result-manager-status
 * @description ResultManager 상태 관리 테스트 (TASK-059, 060, 061)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ResultManager, ResultSummary } from '../../../src/core/analysis/result-manager';
import { ConfidenceEnrichedResult } from '../../../src/types/analysis';

// logger mock
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

/** 테스트용 ConfidenceEnrichedResult 생성 */
function createTestResult(overrides: Partial<ConfidenceEnrichedResult> = {}): ConfidenceEnrichedResult {
  return {
    analysisId: 'analysis-001',
    analyzedAt: '2024-01-15T10:00:00Z',
    specTitle: '테스트 기획서',
    affectedScreens: [
      {
        screenId: 'screen-1',
        screenName: 'CartPage',
        impactLevel: 'medium',
        tasks: [
          {
            id: 'T-001',
            title: '[FE] 수량 변경',
            type: 'FE',
            actionType: 'modify',
            description: '수량 입력 필드',
            affectedFiles: ['src/pages/CartPage.tsx'],
            relatedApis: [],
            planningChecks: [],
            rationale: 'test',
          },
        ],
      },
    ],
    tasks: [
      {
        id: 'T-001',
        title: '[FE] 수량 변경',
        type: 'FE',
        actionType: 'modify',
        description: '수량 입력 필드',
        affectedFiles: ['src/pages/CartPage.tsx'],
        relatedApis: [],
        planningChecks: [],
        rationale: 'test',
      },
    ],
    planningChecks: [],
    policyChanges: [],
    screenScores: [],
    totalScore: 15,
    grade: 'Low',
    recommendation: 'test recommendation',
    policyWarnings: [],
    ownerNotifications: [],
    analysisMethod: 'rule-based' as const,
    confidenceScores: [],
    lowConfidenceWarnings: [],
    ...overrides,
  };
}

describe('ResultManager - Status Management', () => {
  let tmpDir: string;
  let manager: ResultManager;
  const projectId = 'test-project';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'result-manager-status-test-'));
    manager = new ResultManager(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ================================================================
  // TASK-059: ResultSummary 타입 확장
  // ================================================================
  describe('ResultSummary status field (TASK-059)', () => {
    it('should support optional status field in ResultSummary', async () => {
      const result = createTestResult();
      await manager.save(result, projectId);

      const summaries = await manager.list(projectId);
      expect(summaries).toHaveLength(1);
      // status는 save()에서 기본 'active'로 설정
      expect(summaries[0].status).toBe('active');
    });

    it('should be backward compatible with existing data without status', async () => {
      // 직접 인덱스 파일을 생성하여 기존 데이터 시뮬레이션
      const resultsDir = path.join(tmpDir, '.impact', 'projects', projectId, 'results');
      fs.mkdirSync(resultsDir, { recursive: true });

      const oldSummary: Partial<ResultSummary> = {
        id: 'old-analysis',
        specTitle: 'Old Analysis',
        analyzedAt: '2023-01-01T00:00:00Z',
        totalScore: 10,
        grade: 'Low',
        affectedScreenCount: 1,
        taskCount: 1,
        // no status field
      };

      fs.writeFileSync(
        path.join(resultsDir, 'index.json'),
        JSON.stringify([oldSummary]),
        'utf-8',
      );

      const summaries = await manager.list(projectId);
      expect(summaries).toHaveLength(1);
      expect(summaries[0].status).toBeUndefined();

      // getEffectiveStatus should treat undefined as 'active'
      expect(manager.getEffectiveStatus(summaries[0])).toBe('active');
    });
  });

  // ================================================================
  // TASK-061: save() 기본 status:'active' 설정
  // ================================================================
  describe('save() default status (TASK-061)', () => {
    it('should set status to "active" by default when saving', async () => {
      const result = createTestResult();
      await manager.save(result, projectId);

      const summaries = await manager.list(projectId);
      expect(summaries[0].status).toBe('active');
    });

    it('should use provided defaultStatus when specified', async () => {
      const result = createTestResult();
      await manager.save(result, projectId, undefined, 'completed');

      const summaries = await manager.list(projectId);
      expect(summaries[0].status).toBe('completed');
    });

    it('should use "active" when defaultStatus is undefined', async () => {
      const result = createTestResult();
      await manager.save(result, projectId, 'Custom Title', undefined);

      const summaries = await manager.list(projectId);
      expect(summaries[0].status).toBe('active');
    });
  });

  // ================================================================
  // TASK-060: updateIndex status 보존
  // ================================================================
  describe('updateIndex status preservation (TASK-060)', () => {
    it('should preserve existing status on re-analysis (same ID)', async () => {
      // First save
      const result1 = createTestResult({ analysisId: 'reanalysis-001', totalScore: 10 });
      await manager.save(result1, projectId);

      // Change status to completed
      await manager.updateStatus(projectId, 'reanalysis-001', 'completed');

      // Verify status changed
      let summaries = await manager.list(projectId);
      expect(summaries[0].status).toBe('completed');

      // Re-save with same ID (simulating re-analysis)
      const result2 = createTestResult({ analysisId: 'reanalysis-001', totalScore: 30 });
      await manager.save(result2, projectId);

      // Status should be preserved as 'completed'
      summaries = await manager.list(projectId);
      expect(summaries).toHaveLength(1);
      expect(summaries[0].totalScore).toBe(30); // updated
      expect(summaries[0].status).toBe('completed'); // preserved
    });

    it('should preserve crossProjectDetection on re-save', async () => {
      const result = createTestResult({ analysisId: 'cpd-001' });
      await manager.save(result, projectId);

      // Add crossProjectDetection
      await manager.updateCrossProjectDetection(projectId, 'cpd-001', {
        detectedAt: '2024-01-01',
        linksDetected: 3,
        linksNew: 2,
        linksTotal: 5,
      });

      // Re-save
      const result2 = createTestResult({ analysisId: 'cpd-001', totalScore: 50 });
      await manager.save(result2, projectId);

      const summaries = await manager.list(projectId);
      expect(summaries[0].crossProjectDetection).toBeDefined();
      expect(summaries[0].crossProjectDetection!.linksDetected).toBe(3);
    });
  });

  // ================================================================
  // TASK-060: updateStatus()
  // ================================================================
  describe('updateStatus (TASK-060)', () => {
    it('should update status from active to completed', async () => {
      const result = createTestResult({ analysisId: 'status-001' });
      await manager.save(result, projectId);

      const updated = await manager.updateStatus(projectId, 'status-001', 'completed');
      expect(updated.status).toBe('completed');
      expect(updated.statusChangedAt).toBeDefined();
    });

    it('should update status from active to on-hold', async () => {
      const result = createTestResult({ analysisId: 'status-002' });
      await manager.save(result, projectId);

      const updated = await manager.updateStatus(projectId, 'status-002', 'on-hold');
      expect(updated.status).toBe('on-hold');
    });

    it('should update status from active to archived', async () => {
      const result = createTestResult({ analysisId: 'status-003' });
      await manager.save(result, projectId);

      const updated = await manager.updateStatus(projectId, 'status-003', 'archived');
      expect(updated.status).toBe('archived');
    });

    it('should update status from on-hold to active', async () => {
      const result = createTestResult({ analysisId: 'status-004' });
      await manager.save(result, projectId);
      await manager.updateStatus(projectId, 'status-004', 'on-hold');

      const updated = await manager.updateStatus(projectId, 'status-004', 'active');
      expect(updated.status).toBe('active');
    });

    it('should throw for invalid transition: archived -> active', async () => {
      const result = createTestResult({ analysisId: 'status-005' });
      await manager.save(result, projectId);
      await manager.updateStatus(projectId, 'status-005', 'archived');

      await expect(
        manager.updateStatus(projectId, 'status-005', 'active'),
      ).rejects.toThrow('폐기된 분석');
    });

    it('should throw for invalid transition: completed -> active', async () => {
      const result = createTestResult({ analysisId: 'status-006' });
      await manager.save(result, projectId);
      await manager.updateStatus(projectId, 'status-006', 'completed');

      await expect(
        manager.updateStatus(projectId, 'status-006', 'active'),
      ).rejects.toThrow('완료된 분석');
    });

    it('should throw when analysisId not found', async () => {
      await expect(
        manager.updateStatus(projectId, 'nonexistent', 'completed'),
      ).rejects.toThrow('찾을 수 없습니다');
    });

    it('should persist status change to index file', async () => {
      const result = createTestResult({ analysisId: 'persist-001' });
      await manager.save(result, projectId);
      await manager.updateStatus(projectId, 'persist-001', 'completed');

      // Re-read from file
      const summaries = await manager.list(projectId);
      expect(summaries[0].status).toBe('completed');
    });
  });

  // ================================================================
  // TASK-060: getLatestActive()
  // ================================================================
  describe('getLatestActive (TASK-060)', () => {
    it('should return the most recent active result', async () => {
      const result1 = createTestResult({
        analysisId: 'la-001',
        analyzedAt: '2024-01-01T00:00:00Z',
      });
      const result2 = createTestResult({
        analysisId: 'la-002',
        analyzedAt: '2024-06-01T00:00:00Z',
      });
      await manager.save(result1, projectId);
      await manager.save(result2, projectId);

      const latest = await manager.getLatestActive(projectId);
      expect(latest).not.toBeNull();
      expect(latest!.id).toBe('la-002');
    });

    it('should exclude archived results', async () => {
      const result1 = createTestResult({
        analysisId: 'la-003',
        analyzedAt: '2024-01-01T00:00:00Z',
      });
      const result2 = createTestResult({
        analysisId: 'la-004',
        analyzedAt: '2024-06-01T00:00:00Z',
      });
      await manager.save(result1, projectId);
      await manager.save(result2, projectId);

      // Archive the newer one
      await manager.updateStatus(projectId, 'la-004', 'archived');

      const latest = await manager.getLatestActive(projectId);
      expect(latest).not.toBeNull();
      expect(latest!.id).toBe('la-003');
    });

    it('should return null when all results are archived', async () => {
      const result = createTestResult({ analysisId: 'la-005' });
      await manager.save(result, projectId);
      await manager.updateStatus(projectId, 'la-005', 'archived');

      const latest = await manager.getLatestActive(projectId);
      expect(latest).toBeNull();
    });

    it('should return null when no results exist', async () => {
      const latest = await manager.getLatestActive(projectId);
      expect(latest).toBeNull();
    });
  });

  // ================================================================
  // TASK-060: listByStatus()
  // ================================================================
  describe('listByStatus (TASK-060)', () => {
    beforeEach(async () => {
      const result1 = createTestResult({ analysisId: 'ls-001' });
      const result2 = createTestResult({ analysisId: 'ls-002' });
      const result3 = createTestResult({ analysisId: 'ls-003' });
      await manager.save(result1, projectId);
      await manager.save(result2, projectId);
      await manager.save(result3, projectId);
      await manager.updateStatus(projectId, 'ls-002', 'completed');
      await manager.updateStatus(projectId, 'ls-003', 'archived');
    });

    it('should return all results when no status filter', async () => {
      const results = await manager.listByStatus(projectId);
      expect(results).toHaveLength(3);
    });

    it('should filter by active status', async () => {
      const results = await manager.listByStatus(projectId, 'active');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('ls-001');
    });

    it('should filter by completed status', async () => {
      const results = await manager.listByStatus(projectId, 'completed');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('ls-002');
    });

    it('should filter by archived status', async () => {
      const results = await manager.listByStatus(projectId, 'archived');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('ls-003');
    });

    it('should return empty array for non-matching status', async () => {
      const results = await manager.listByStatus(projectId, 'on-hold');
      expect(results).toHaveLength(0);
    });
  });

  // ================================================================
  // TASK-060: getEffectiveStatus() on ResultManager
  // ================================================================
  describe('getEffectiveStatus on ResultManager (TASK-060)', () => {
    it('should return "active" for summary without status', () => {
      const summary: ResultSummary = {
        id: 'test',
        specTitle: 'Test',
        analyzedAt: '2024-01-01',
        totalScore: 10,
        grade: 'Low',
        affectedScreenCount: 0,
        taskCount: 0,
      };
      expect(manager.getEffectiveStatus(summary)).toBe('active');
    });

    it('should return the actual status when defined', () => {
      const summary: ResultSummary = {
        id: 'test',
        specTitle: 'Test',
        analyzedAt: '2024-01-01',
        totalScore: 10,
        grade: 'Low',
        affectedScreenCount: 0,
        taskCount: 0,
        status: 'completed',
      };
      expect(manager.getEffectiveStatus(summary)).toBe('completed');
    });
  });
});
