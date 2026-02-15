/**
 * @module tests/unit/server/web-server.test
 * @description Express.js 웹 서버 API 엔드포인트 테스트
 */

import request from 'supertest';
import * as path from 'path';
import * as fs from 'fs';
import { createApp } from '@/server/web-server';
import { ensureDir, writeJsonFile } from '@/utils/file';

/** 테스트용 임시 디렉토리 */
const TEST_BASE = path.join(__dirname, '..', '..', 'fixtures', 'test-server-data');
const TEST_PROJECT_ID = 'test-project';

/** 테스트 데이터 설정 */
function setupTestData(): void {
  // projects.json 생성
  const impactDir = path.join(TEST_BASE, '.impact');
  ensureDir(impactDir);
  writeJsonFile(path.join(impactDir, 'projects.json'), {
    activeProject: TEST_PROJECT_ID,
    projects: [
      {
        id: TEST_PROJECT_ID,
        name: 'Test Project',
        path: '/tmp/test',
        status: 'active',
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        techStack: ['react'],
      },
    ],
  });

  // config.json 생성
  writeJsonFile(path.join(impactDir, 'config.json'), {
    version: 1,
    general: { autoReindex: true, webPort: 3847, logLevel: 'info' },
  });

  // 결과 디렉토리 및 데이터 생성
  const resultsDir = path.join(impactDir, 'projects', TEST_PROJECT_ID, 'results');
  ensureDir(resultsDir);

  const testResult = {
    analysisId: 'test-analysis-001',
    analyzedAt: new Date().toISOString(),
    specTitle: '테스트 기획서',
    affectedScreens: [
      {
        screenId: 'screen-1',
        screenName: '테스트 화면',
        impactLevel: 'medium',
        tasks: [],
      },
    ],
    tasks: [
      {
        id: 'task-1',
        title: '테스트 작업',
        type: 'FE',
        actionType: 'modify',
        description: '테스트 작업 설명',
        affectedFiles: [],
        relatedApis: [],
        planningChecks: [],
        rationale: '테스트',
      },
    ],
    planningChecks: [],
    policyChanges: [],
    screenScores: [
      {
        screenId: 'screen-1',
        screenName: '테스트 화면',
        screenScore: 25,
        grade: 'Medium',
        taskScores: [],
      },
    ],
    totalScore: 25,
    grade: 'Medium',
    recommendation: '테스트 권장 사항',
    policyWarnings: [],
    ownerNotifications: [],
    confidenceScores: [],
    lowConfidenceWarnings: [],
  };

  writeJsonFile(path.join(resultsDir, 'test-analysis-001.json'), testResult);
  writeJsonFile(path.join(resultsDir, 'index.json'), [
    {
      id: 'test-analysis-001',
      specTitle: '테스트 기획서',
      analyzedAt: testResult.analyzedAt,
      totalScore: 25,
      grade: 'Medium',
      affectedScreenCount: 1,
      taskCount: 1,
    },
  ]);
}

/** 테스트 데이터 정리 */
function cleanupTestData(): void {
  if (fs.existsSync(TEST_BASE)) {
    fs.rmSync(TEST_BASE, { recursive: true, force: true });
  }
}

describe('Web Server API', () => {
  beforeAll(() => {
    setupTestData();
  });

  afterAll(() => {
    cleanupTestData();
  });

  const app = createApp(TEST_BASE);

  describe('GET /api/results', () => {
    it('should return a list of results', async () => {
      const res = await request(app).get('/api/results');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('results');
      expect(Array.isArray(res.body.results)).toBe(true);
      expect(res.body.results.length).toBeGreaterThanOrEqual(1);
    });

    it('should include result summaries with expected fields', async () => {
      const res = await request(app).get('/api/results');
      const result = res.body.results[0];
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('specTitle');
      expect(result).toHaveProperty('totalScore');
      expect(result).toHaveProperty('grade');
    });
  });

  describe('GET /api/results/latest', () => {
    it('should return the latest result', async () => {
      const res = await request(app).get('/api/results/latest');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('result');
      expect(res.body.result).not.toBeNull();
      expect(res.body.result.analysisId).toBe('test-analysis-001');
    });

    it('should include full result data', async () => {
      const res = await request(app).get('/api/results/latest');
      const result = res.body.result;
      expect(result).toHaveProperty('specTitle', '테스트 기획서');
      expect(result).toHaveProperty('totalScore', 25);
      expect(result).toHaveProperty('grade', 'Medium');
      expect(result).toHaveProperty('affectedScreens');
      expect(result).toHaveProperty('tasks');
    });
  });

  describe('GET /api/results/:id', () => {
    it('should return a specific result by ID', async () => {
      const res = await request(app).get('/api/results/test-analysis-001');
      expect(res.status).toBe(200);
      expect(res.body.result.analysisId).toBe('test-analysis-001');
    });

    it('should return 404 for non-existent result', async () => {
      const res = await request(app).get('/api/results/non-existent-id');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/checklist/:resultId', () => {
    it('should return an empty checklist when none exists', async () => {
      const res = await request(app).get('/api/checklist/test-analysis-001');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('checklist');
      expect(res.body.checklist.items).toEqual([]);
    });
  });

  describe('PATCH /api/checklist/:resultId/:itemId', () => {
    it('should update a checklist item', async () => {
      const res = await request(app)
        .patch('/api/checklist/test-analysis-001/item-1')
        .send({ checked: true });

      expect(res.status).toBe(200);
      expect(res.body.item).toHaveProperty('itemId', 'item-1');
      expect(res.body.item).toHaveProperty('checked', true);
      expect(res.body.item).toHaveProperty('updatedAt');
    });

    it('should persist the updated state', async () => {
      // First update
      await request(app)
        .patch('/api/checklist/test-analysis-001/item-2')
        .send({ checked: true });

      // Read back
      const res = await request(app).get('/api/checklist/test-analysis-001');
      const item = res.body.checklist.items.find(
        (i: { itemId: string }) => i.itemId === 'item-2'
      );
      expect(item).toBeDefined();
      expect(item.checked).toBe(true);
    });

    it('should reject invalid checked value', async () => {
      const res = await request(app)
        .patch('/api/checklist/test-analysis-001/item-3')
        .send({ checked: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });
});
