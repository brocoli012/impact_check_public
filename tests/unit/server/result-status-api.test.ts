/**
 * @module tests/unit/server/result-status-api
 * @description 분석 결과 상태 API 엔드포인트 테스트 (TASK-063)
 */

import request from 'supertest';
import * as path from 'path';
import * as fs from 'fs';
import { createApp } from '@/server/web-server';
import { ensureDir, writeJsonFile } from '@/utils/file';

/** 테스트용 임시 디렉토리 */
const TEST_BASE = path.join(__dirname, '..', '..', 'fixtures', 'test-status-api-data');
const TEST_PROJECT_ID = 'test-project';

/** 테스트 데이터 설정 */
function setupTestData(): void {
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

  writeJsonFile(path.join(impactDir, 'config.json'), {
    version: 1,
    general: { autoReindex: true, webPort: 3847, logLevel: 'info' },
  });

  const resultsDir = path.join(impactDir, 'projects', TEST_PROJECT_ID, 'results');
  ensureDir(resultsDir);

  const testResult = {
    analysisId: 'status-api-001',
    analyzedAt: new Date().toISOString(),
    specTitle: '상태 API 테스트',
    affectedScreens: [],
    tasks: [],
    planningChecks: [],
    policyChanges: [],
    screenScores: [],
    totalScore: 20,
    grade: 'Low',
    recommendation: 'test',
    policyWarnings: [],
    ownerNotifications: [],
    confidenceScores: [],
    lowConfidenceWarnings: [],
  };

  writeJsonFile(path.join(resultsDir, 'status-api-001.json'), testResult);
  writeJsonFile(path.join(resultsDir, 'index.json'), [
    {
      id: 'status-api-001',
      specTitle: '상태 API 테스트',
      analyzedAt: testResult.analyzedAt,
      totalScore: 20,
      grade: 'Low',
      affectedScreenCount: 0,
      taskCount: 0,
      status: 'active',
    },
    {
      id: 'status-api-002',
      specTitle: '완료된 분석',
      analyzedAt: '2024-01-01T00:00:00Z',
      totalScore: 30,
      grade: 'Medium',
      affectedScreenCount: 1,
      taskCount: 2,
      status: 'completed',
    },
    {
      id: 'status-api-003',
      specTitle: '보관된 분석',
      analyzedAt: '2023-06-01T00:00:00Z',
      totalScore: 10,
      grade: 'Low',
      affectedScreenCount: 0,
      taskCount: 0,
      status: 'archived',
    },
  ]);
}

function cleanupTestData(): void {
  if (fs.existsSync(TEST_BASE)) {
    fs.rmSync(TEST_BASE, { recursive: true, force: true });
  }
}

describe('Result Status API (TASK-063)', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    setupTestData();
    app = createApp(TEST_BASE);
  });

  afterAll(() => {
    cleanupTestData();
  });

  // ================================================================
  // GET /api/results?status= (status filter)
  // ================================================================
  describe('GET /api/results with status filter', () => {
    it('should return all results without status filter', async () => {
      const res = await request(app).get('/api/results');
      expect(res.status).toBe(200);
      expect(res.body.results.length).toBe(3);
    });

    it('should filter by status=active', async () => {
      const res = await request(app).get('/api/results?status=active');
      expect(res.status).toBe(200);
      expect(res.body.results.length).toBe(1);
      expect(res.body.results[0].id).toBe('status-api-001');
    });

    it('should filter by status=completed', async () => {
      const res = await request(app).get('/api/results?status=completed');
      expect(res.status).toBe(200);
      expect(res.body.results.length).toBe(1);
      expect(res.body.results[0].id).toBe('status-api-002');
    });

    it('should filter by status=archived', async () => {
      const res = await request(app).get('/api/results?status=archived');
      expect(res.status).toBe(200);
      expect(res.body.results.length).toBe(1);
      expect(res.body.results[0].id).toBe('status-api-003');
    });

    it('should return all results for status=all', async () => {
      const res = await request(app).get('/api/results?status=all');
      expect(res.status).toBe(200);
      expect(res.body.results.length).toBe(3);
    });
  });

  // ================================================================
  // PATCH /api/results/:id/status
  // ================================================================
  describe('PATCH /api/results/:id/status', () => {
    it('should update status from active to completed', async () => {
      const res = await request(app)
        .patch('/api/results/status-api-001/status')
        .send({ status: 'completed' });
      expect(res.status).toBe(200);
      expect(res.body.result).toBeDefined();
      expect(res.body.result.status).toBe('completed');
      expect(res.body.result.statusChangedAt).toBeDefined();
    });

    it('should return 400 for invalid result ID', async () => {
      const res = await request(app)
        .patch('/api/results/inv@lid!id/status')
        .send({ status: 'completed' });
      expect(res.status).toBe(400);
    });

    it('should return 400 when body is missing', async () => {
      const res = await request(app)
        .patch('/api/results/status-api-001/status')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('status');
    });

    it('should return 400 for invalid status value', async () => {
      const res = await request(app)
        .patch('/api/results/status-api-001/status')
        .send({ status: 'invalid' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid status');
    });

    it('should return 404 for non-existent analysis ID', async () => {
      const res = await request(app)
        .patch('/api/results/nonexistent-id/status')
        .send({ status: 'completed' });
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });

    it('should return 400 for invalid transition (archived -> active)', async () => {
      const res = await request(app)
        .patch('/api/results/status-api-003/status')
        .send({ status: 'active' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('폐기');
    });

    it('should return response in { result: ResultSummary } format (R3-API-03)', async () => {
      // First reset status-api-001 back so we can test again
      const resultsDir = path.join(TEST_BASE, '.impact', 'projects', TEST_PROJECT_ID, 'results');
      const index = JSON.parse(fs.readFileSync(path.join(resultsDir, 'index.json'), 'utf-8'));
      const entry = index.find((s: { id: string }) => s.id === 'status-api-002');
      if (entry) {
        // completed -> archived is valid
        const res = await request(app)
          .patch('/api/results/status-api-002/status')
          .send({ status: 'archived' });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('result');
        expect(res.body.result).toHaveProperty('id');
        expect(res.body.result).toHaveProperty('status');
        // should NOT have separate message field (R3-API-03)
        expect(res.body).not.toHaveProperty('message');
      }
    });
  });
});
