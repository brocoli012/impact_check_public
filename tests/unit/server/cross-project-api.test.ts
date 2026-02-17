/**
 * @module tests/unit/server/cross-project-api.test
 * @description 크로스 프로젝트 API 엔드포인트 테스트
 */

import request from 'supertest';
import * as path from 'path';
import * as fs from 'fs';
import { createApp } from '@/server/web-server';
import { ensureDir, writeJsonFile } from '@/utils/file';

/** 테스트용 임시 디렉토리 */
const TEST_BASE = path.join(__dirname, '..', '..', 'fixtures', 'test-cross-project-api');
const TEST_PROJECT_ID = 'test-project';

/** 테스트 데이터 설정 */
function setupTestData(): void {
  const impactDir = path.join(TEST_BASE, '.impact');
  ensureDir(impactDir);

  // projects.json 생성
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

  // 빈 결과 디렉토리 생성
  const resultsDir = path.join(impactDir, 'projects', TEST_PROJECT_ID, 'results');
  ensureDir(resultsDir);
  writeJsonFile(path.join(resultsDir, 'index.json'), []);

  // cross-project.json 생성
  writeJsonFile(path.join(impactDir, 'cross-project.json'), {
    version: 1,
    links: [
      {
        id: 'frontend-backend',
        source: 'frontend',
        target: 'backend',
        type: 'api-consumer',
        apis: ['/api/users', '/api/orders'],
        autoDetected: false,
        confirmedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'backend-database',
        source: 'backend',
        target: 'database',
        type: 'shared-library',
        autoDetected: true,
      },
    ],
    groups: [
      { name: 'commerce', projects: ['frontend', 'backend'] },
      { name: 'infra', projects: ['database', 'cache'] },
    ],
  });
}

/** 테스트 데이터 정리 */
function cleanupTestData(): void {
  if (fs.existsSync(TEST_BASE)) {
    fs.rmSync(TEST_BASE, { recursive: true, force: true });
  }
}

describe('Cross Project API', () => {
  beforeAll(() => {
    setupTestData();
  });

  afterAll(() => {
    cleanupTestData();
  });

  const app = createApp(TEST_BASE);

  // ============================================================
  // GET /api/cross-project/links
  // ============================================================

  describe('GET /api/cross-project/links', () => {
    it('should return all project links', async () => {
      const res = await request(app).get('/api/cross-project/links');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('links');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.links)).toBe(true);
      expect(res.body.links).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it('should include link details', async () => {
      const res = await request(app).get('/api/cross-project/links');
      const link = res.body.links[0];
      expect(link).toHaveProperty('id');
      expect(link).toHaveProperty('source');
      expect(link).toHaveProperty('target');
      expect(link).toHaveProperty('type');
    });
  });

  // ============================================================
  // GET /api/cross-project/links/:projectId
  // ============================================================

  describe('GET /api/cross-project/links/:projectId', () => {
    it('should return links for a specific project', async () => {
      const res = await request(app).get('/api/cross-project/links/frontend');
      expect(res.status).toBe(200);
      expect(res.body.links).toHaveLength(1);
      expect(res.body.links[0].source).toBe('frontend');
      expect(res.body.total).toBe(1);
    });

    it('should return links where project is target', async () => {
      const res = await request(app).get('/api/cross-project/links/backend');
      expect(res.status).toBe(200);
      expect(res.body.links).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it('should return empty for project with no links', async () => {
      const res = await request(app).get('/api/cross-project/links/nonexistent');
      expect(res.status).toBe(200);
      expect(res.body.links).toHaveLength(0);
      expect(res.body.total).toBe(0);
    });
  });

  // ============================================================
  // GET /api/cross-project/groups
  // ============================================================

  describe('GET /api/cross-project/groups', () => {
    it('should return all project groups', async () => {
      const res = await request(app).get('/api/cross-project/groups');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('groups');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.groups)).toBe(true);
      expect(res.body.groups).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it('should include group details', async () => {
      const res = await request(app).get('/api/cross-project/groups');
      const group = res.body.groups[0];
      expect(group).toHaveProperty('name', 'commerce');
      expect(group).toHaveProperty('projects');
      expect(group.projects).toEqual(['frontend', 'backend']);
    });
  });
});
