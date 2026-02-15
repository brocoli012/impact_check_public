/**
 * @module tests/unit/analysis/result-manager
 * @description ResultManager 단위 테스트
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
    confidenceScores: [],
    lowConfidenceWarnings: [],
    ...overrides,
  };
}

describe('ResultManager', () => {
  let tmpDir: string;
  let manager: ResultManager;
  const projectId = 'test-project';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'result-manager-test-'));
    manager = new ResultManager(tmpDir);
  });

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('save', () => {
    it('should save a result and return the result ID', async () => {
      const result = createTestResult();

      const resultId = await manager.save(result, projectId);

      expect(resultId).toBe('analysis-001');
    });

    it('should create the results directory', async () => {
      const result = createTestResult();

      await manager.save(result, projectId);

      const resultsDir = path.join(tmpDir, '.impact', 'projects', projectId, 'results');
      expect(fs.existsSync(resultsDir)).toBe(true);
    });

    it('should write result JSON file', async () => {
      const result = createTestResult();

      const resultId = await manager.save(result, projectId);

      const filePath = path.join(
        tmpDir, '.impact', 'projects', projectId, 'results', `${resultId}.json`,
      );
      expect(fs.existsSync(filePath)).toBe(true);

      const saved = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(saved.analysisId).toBe('analysis-001');
      expect(saved.specTitle).toBe('테스트 기획서');
    });

    it('should update index file', async () => {
      const result = createTestResult();

      await manager.save(result, projectId);

      const indexPath = path.join(
        tmpDir, '.impact', 'projects', projectId, 'results', 'index.json',
      );
      expect(fs.existsSync(indexPath)).toBe(true);

      const summaries = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as ResultSummary[];
      expect(summaries).toHaveLength(1);
      expect(summaries[0].id).toBe('analysis-001');
      expect(summaries[0].specTitle).toBe('테스트 기획서');
      expect(summaries[0].totalScore).toBe(15);
      expect(summaries[0].grade).toBe('Low');
      expect(summaries[0].affectedScreenCount).toBe(1);
      expect(summaries[0].taskCount).toBe(1);
    });

    it('should use provided title over result specTitle in index', async () => {
      const result = createTestResult();

      await manager.save(result, projectId, '커스텀 제목');

      const indexPath = path.join(
        tmpDir, '.impact', 'projects', projectId, 'results', 'index.json',
      );
      const summaries = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as ResultSummary[];
      expect(summaries[0].specTitle).toBe('커스텀 제목');
    });

    it('should generate an ID if analysisId is missing', async () => {
      const result = createTestResult({ analysisId: '' });

      const resultId = await manager.save(result, projectId);

      expect(resultId).toMatch(/^analysis-\d+$/);
    });

    it('should update existing entry in index when saving with same ID', async () => {
      const result1 = createTestResult({
        analysisId: 'analysis-dup',
        totalScore: 10,
        grade: 'Low',
      });
      const result2 = createTestResult({
        analysisId: 'analysis-dup',
        totalScore: 50,
        grade: 'High',
      });

      await manager.save(result1, projectId);
      await manager.save(result2, projectId);

      const indexPath = path.join(
        tmpDir, '.impact', 'projects', projectId, 'results', 'index.json',
      );
      const summaries = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as ResultSummary[];
      expect(summaries).toHaveLength(1);
      expect(summaries[0].totalScore).toBe(50);
      expect(summaries[0].grade).toBe('High');
    });
  });

  describe('save and load roundtrip', () => {
    it('should save and reload the same result data', async () => {
      const result = createTestResult();

      const resultId = await manager.save(result, projectId);
      const loaded = await manager.getById(projectId, resultId);

      expect(loaded).not.toBeNull();
      expect(loaded!.analysisId).toBe(result.analysisId);
      expect(loaded!.specTitle).toBe(result.specTitle);
      expect(loaded!.totalScore).toBe(result.totalScore);
      expect(loaded!.grade).toBe(result.grade);
      expect(loaded!.affectedScreens).toHaveLength(1);
      expect(loaded!.tasks).toHaveLength(1);
    });
  });

  describe('getLatest', () => {
    it('should return the most recent result', async () => {
      const result1 = createTestResult({
        analysisId: 'analysis-old',
        analyzedAt: '2024-01-01T00:00:00Z',
        specTitle: 'Old Spec',
      });
      const result2 = createTestResult({
        analysisId: 'analysis-new',
        analyzedAt: '2024-06-01T00:00:00Z',
        specTitle: 'New Spec',
      });

      await manager.save(result1, projectId);
      await manager.save(result2, projectId);

      const latest = await manager.getLatest(projectId);

      expect(latest).not.toBeNull();
      expect(latest!.analysisId).toBe('analysis-new');
      expect(latest!.specTitle).toBe('New Spec');
    });

    it('should return null when no results exist', async () => {
      const latest = await manager.getLatest(projectId);

      expect(latest).toBeNull();
    });

    it('should return single result when only one exists', async () => {
      const result = createTestResult({ analysisId: 'analysis-only' });
      await manager.save(result, projectId);

      const latest = await manager.getLatest(projectId);

      expect(latest).not.toBeNull();
      expect(latest!.analysisId).toBe('analysis-only');
    });
  });

  describe('getById', () => {
    it('should return result for valid ID', async () => {
      const result = createTestResult({ analysisId: 'analysis-find' });
      await manager.save(result, projectId);

      const loaded = await manager.getById(projectId, 'analysis-find');

      expect(loaded).not.toBeNull();
      expect(loaded!.analysisId).toBe('analysis-find');
    });

    it('should return null for non-existent ID', async () => {
      const loaded = await manager.getById(projectId, 'nonexistent-id');

      expect(loaded).toBeNull();
    });

    it('should return null for corrupt JSON file', async () => {
      // Save a valid result first
      const result = createTestResult({ analysisId: 'analysis-corrupt' });
      await manager.save(result, projectId);

      // Corrupt the file
      const filePath = path.join(
        tmpDir, '.impact', 'projects', projectId, 'results', 'analysis-corrupt.json',
      );
      fs.writeFileSync(filePath, '{ invalid json !!!', 'utf-8');

      const loaded = await manager.getById(projectId, 'analysis-corrupt');

      expect(loaded).toBeNull();
    });
  });

  describe('list', () => {
    it('should return all saved result summaries', async () => {
      const result1 = createTestResult({ analysisId: 'analysis-a' });
      const result2 = createTestResult({ analysisId: 'analysis-b' });

      await manager.save(result1, projectId);
      await manager.save(result2, projectId);

      const summaries = await manager.list(projectId);

      expect(summaries).toHaveLength(2);
      const ids = summaries.map(s => s.id);
      expect(ids).toContain('analysis-a');
      expect(ids).toContain('analysis-b');
    });

    it('should return empty array when results directory does not exist', async () => {
      const summaries = await manager.list(projectId);

      expect(summaries).toHaveLength(0);
    });

    it('should return empty array for corrupt index file', async () => {
      // Create directory and write corrupt index
      const resultsDir = path.join(tmpDir, '.impact', 'projects', projectId, 'results');
      fs.mkdirSync(resultsDir, { recursive: true });
      fs.writeFileSync(
        path.join(resultsDir, 'index.json'),
        'not valid json!!!',
        'utf-8',
      );

      const summaries = await manager.list(projectId);

      expect(summaries).toHaveLength(0);
    });

    it('should include correct summary fields', async () => {
      const result = createTestResult({
        analysisId: 'analysis-summary',
        analyzedAt: '2024-03-15T12:00:00Z',
        specTitle: 'Summary Test',
        totalScore: 42,
        grade: 'High',
      });
      await manager.save(result, projectId);

      const summaries = await manager.list(projectId);

      expect(summaries).toHaveLength(1);
      expect(summaries[0].id).toBe('analysis-summary');
      expect(summaries[0].specTitle).toBe('Summary Test');
      expect(summaries[0].analyzedAt).toBe('2024-03-15T12:00:00Z');
      expect(summaries[0].totalScore).toBe(42);
      expect(summaries[0].grade).toBe('High');
      expect(summaries[0].affectedScreenCount).toBe(1);
      expect(summaries[0].taskCount).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle multiple saves to different projects', async () => {
      const result = createTestResult({ analysisId: 'analysis-multi' });

      await manager.save(result, 'project-a');
      await manager.save(result, 'project-b');

      const listA = await manager.list('project-a');
      const listB = await manager.list('project-b');

      expect(listA).toHaveLength(1);
      expect(listB).toHaveLength(1);
    });

    it('should handle result with empty affectedScreens and tasks', async () => {
      const result = createTestResult({
        analysisId: 'analysis-empty',
        affectedScreens: [],
        tasks: [],
      });

      const resultId = await manager.save(result, projectId);
      const loaded = await manager.getById(projectId, resultId);

      expect(loaded).not.toBeNull();
      expect(loaded!.affectedScreens).toHaveLength(0);
      expect(loaded!.tasks).toHaveLength(0);

      const summaries = await manager.list(projectId);
      expect(summaries[0].affectedScreenCount).toBe(0);
      expect(summaries[0].taskCount).toBe(0);
    });
  });
});
