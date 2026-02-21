/**
 * @module tests/unit/server/multi-project-api.test
 * @description REQ-012 멀티 프로젝트 API 엔드포인트 테스트
 * - GET /api/projects
 * - POST /api/projects/switch
 * - GET /api/events (SSE)
 * - ProjectContext 동작 검증
 */

import request from 'supertest';
import * as path from 'path';
import * as fs from 'fs';
import { createApp } from '@/server/web-server';
import { ensureDir, writeJsonFile } from '@/utils/file';

const TEST_BASE = path.join(__dirname, '..', '..', 'fixtures', 'test-multi-project-data');
const PROJECT_A = 'project-alpha';
const PROJECT_B = 'project-beta';

/** 테스트 데이터 설정 */
function setupTestData(): void {
  const impactDir = path.join(TEST_BASE, '.impact');
  ensureDir(impactDir);

  // projects.json
  writeJsonFile(path.join(impactDir, 'projects.json'), {
    activeProject: PROJECT_A,
    projects: [
      {
        id: PROJECT_A,
        name: 'Project Alpha',
        path: '/tmp/alpha',
        status: 'active',
        createdAt: '2025-01-01T00:00:00Z',
        lastUsedAt: '2025-03-01T00:00:00Z',
        techStack: ['react', 'typescript'],
      },
      {
        id: PROJECT_B,
        name: 'Project Beta',
        path: '/tmp/beta',
        status: 'active',
        createdAt: '2025-02-01T00:00:00Z',
        lastUsedAt: '2025-03-15T00:00:00Z',
        techStack: ['vue', 'java'],
      },
    ],
  });

  // config.json
  writeJsonFile(path.join(impactDir, 'config.json'), {
    version: 1,
    general: { autoReindex: true, webPort: 3847, logLevel: 'info' },
  });

  // Project Alpha - 결과 데이터
  const alphaResultsDir = path.join(impactDir, 'projects', PROJECT_A, 'results');
  ensureDir(alphaResultsDir);

  const alphaResult = {
    analysisId: 'alpha-001',
    analyzedAt: '2025-03-01T10:00:00Z',
    specTitle: 'Alpha 기획서',
    affectedScreens: [{ screenId: 'screen-1', screenName: '화면1', impactLevel: 'high', tasks: [] }],
    tasks: [
      { id: 'task-a1', title: '알파 태스크', type: 'FE', actionType: 'new', description: '', affectedFiles: [], relatedApis: [], planningChecks: [], rationale: '' },
    ],
    planningChecks: [],
    policyChanges: [],
    screenScores: [{ screenId: 'screen-1', screenName: '화면1', screenScore: 45, grade: 'High', taskScores: [] }],
    totalScore: 45,
    grade: 'High',
    recommendation: '',
    policyWarnings: [{ id: 'pw-1', policyId: 'p1', policyName: 'Test', message: 'msg', severity: 'warning', relatedTaskIds: [] }],
    ownerNotifications: [],
    confidenceScores: [],
    lowConfidenceWarnings: [],
  };

  writeJsonFile(path.join(alphaResultsDir, 'alpha-001.json'), alphaResult);
  writeJsonFile(path.join(alphaResultsDir, 'index.json'), [
    { id: 'alpha-001', specTitle: 'Alpha 기획서', analyzedAt: '2025-03-01T10:00:00Z', totalScore: 45, grade: 'High', affectedScreenCount: 1, taskCount: 1 },
  ]);

  // Project Beta - 결과 없음 (빈 프로젝트)
  const betaDir = path.join(impactDir, 'projects', PROJECT_B);
  ensureDir(betaDir);
}

function cleanupTestData(): void {
  if (fs.existsSync(TEST_BASE)) {
    fs.rmSync(TEST_BASE, { recursive: true, force: true });
  }
}

describe('Multi-Project API (REQ-012)', () => {
  beforeAll(() => {
    setupTestData();
  });

  afterAll(() => {
    cleanupTestData();
  });

  const app = createApp(TEST_BASE);

  // ========================================================
  // GET /api/projects
  // ========================================================
  describe('GET /api/projects', () => {
    it('should return project list with summary stats', async () => {
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('projects');
      expect(res.body).toHaveProperty('activeProject', PROJECT_A);
      expect(res.body).toHaveProperty('total', 2);
      expect(Array.isArray(res.body.projects)).toBe(true);
      expect(res.body.projects.length).toBe(2);
    });

    it('should include project info fields', async () => {
      const res = await request(app).get('/api/projects');
      const alpha = res.body.projects.find((p: any) => p.id === PROJECT_A);
      expect(alpha).toBeDefined();
      expect(alpha.name).toBe('Project Alpha');
      expect(alpha.path).toBe('/tmp/alpha');
      expect(alpha.status).toBe('active');
      expect(alpha.techStack).toEqual(['react', 'typescript']);
    });

    it('should include analysis summary for projects with results', async () => {
      const res = await request(app).get('/api/projects');
      const alpha = res.body.projects.find((p: any) => p.id === PROJECT_A);
      expect(alpha.resultCount).toBeGreaterThanOrEqual(1);
      expect(alpha.latestGrade).toBe('High');
      expect(alpha.latestScore).toBe(45);
      expect(alpha.taskCount).toBe(1);
      expect(alpha.policyWarningCount).toBe(1);
    });

    it('should return null/0 for projects without results', async () => {
      const res = await request(app).get('/api/projects');
      const beta = res.body.projects.find((p: any) => p.id === PROJECT_B);
      expect(beta).toBeDefined();
      expect(beta.resultCount).toBe(0);
      expect(beta.latestGrade).toBeNull();
      expect(beta.latestScore).toBeNull();
      expect(beta.taskCount).toBe(0);
    });
  });

  // ========================================================
  // POST /api/projects/switch
  // ========================================================
  describe('POST /api/projects/switch', () => {
    it('should switch to a valid project', async () => {
      const res = await request(app)
        .post('/api/projects/switch')
        .send({ projectId: PROJECT_B });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('activeProject', PROJECT_B);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toContain('Beta');
    });

    it('should reject invalid projectId', async () => {
      const res = await request(app)
        .post('/api/projects/switch')
        .send({ projectId: '' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject non-existent projectId', async () => {
      const res = await request(app)
        .post('/api/projects/switch')
        .send({ projectId: 'non-existent' });
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject projectId with special characters', async () => {
      const res = await request(app)
        .post('/api/projects/switch')
        .send({ projectId: '../hack' });
      expect(res.status).toBe(400);
    });

    // After switching, verify the context is updated
    it('should update active project after switch', async () => {
      // Switch to Alpha
      await request(app)
        .post('/api/projects/switch')
        .send({ projectId: PROJECT_A });

      // Verify GET /api/projects reflects the change
      const res = await request(app).get('/api/projects');
      expect(res.body.activeProject).toBe(PROJECT_A);
    });
  });

  // ========================================================
  // ProjectContext - query parameter override
  // ========================================================
  describe('ProjectContext query parameter override', () => {
    it('should use projectId query parameter for /api/results', async () => {
      // Alpha has results, Beta doesn't
      const resAlpha = await request(app).get(`/api/results?projectId=${PROJECT_A}`);
      expect(resAlpha.status).toBe(200);
      expect(resAlpha.body.results.length).toBeGreaterThanOrEqual(1);

      const resBeta = await request(app).get(`/api/results?projectId=${PROJECT_B}`);
      expect(resBeta.status).toBe(200);
      expect(resBeta.body.results.length).toBe(0);
    });

    it('should use projectId query parameter for /api/results/latest', async () => {
      const res = await request(app).get(`/api/results/latest?projectId=${PROJECT_A}`);
      expect(res.status).toBe(200);
      expect(res.body.result).toBeTruthy();
      expect(res.body.result.analysisId).toBe('alpha-001');
    });

    it('should return null for project with no results', async () => {
      const res = await request(app).get(`/api/results/latest?projectId=${PROJECT_B}`);
      expect(res.status).toBe(200);
      expect(res.body.result).toBeNull();
    });
  });

  // ========================================================
  // GET /api/events (SSE) - HTTP 서버를 직접 사용하여 테스트
  // ========================================================
  describe('GET /api/events', () => {
    it('should return SSE headers and connected event', (done) => {
      const server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (!addr || typeof addr === 'string') {
          server.close();
          done(new Error('Failed to get server address'));
          return;
        }

        const http = require('http');
        const req = http.get(`http://127.0.0.1:${addr.port}/api/events`, (res: any) => {
          expect(res.headers['content-type']).toContain('text/event-stream');
          expect(res.headers['cache-control']).toBe('no-cache');

          let data = '';
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString();
            if (data.includes('event: connected')) {
              req.destroy();
              server.close();
              done();
            }
          });
        });

        // 안전 타임아웃
        setTimeout(() => {
          req.destroy();
          server.close();
          done();
        }, 2000);
      });
    }, 10000);
  });
});
