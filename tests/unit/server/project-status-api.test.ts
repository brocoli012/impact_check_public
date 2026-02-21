/**
 * @module tests/unit/server/project-status-api.test
 * @description 프로젝트 현황 API 엔드포인트 테스트 (REQ-011)
 *
 * GET /api/project/status
 * GET /api/project/index-meta
 * GET /api/project/annotation-meta
 */

import request from 'supertest';
import * as path from 'path';
import * as fs from 'fs';
import { createApp } from '@/server/web-server';
import { ensureDir, writeJsonFile } from '@/utils/file';

/** 테스트용 임시 디렉토리 */
const TEST_BASE = path.join(__dirname, '..', '..', 'fixtures', 'test-project-status-data');
const TEST_PROJECT_ID = 'test-project-status';

describe('Project Status API', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    // 테스트 디렉토리 생성
    const impactDir = path.join(TEST_BASE, '.impact');
    ensureDir(impactDir);

    // projects.json에 활성 프로젝트 설정
    writeJsonFile(path.join(impactDir, 'projects.json'), {
      activeProject: TEST_PROJECT_ID,
      projects: [{
        id: TEST_PROJECT_ID,
        name: 'Test Project',
        path: '/tmp/test-project',
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        lastUsedAt: '2024-06-01T00:00:00Z',
        techStack: ['typescript'],
      }],
    });

    // 인덱스 메타 생성
    const projectDir = path.join(impactDir, 'projects', TEST_PROJECT_ID, 'index');
    ensureDir(projectDir);
    writeJsonFile(path.join(projectDir, 'meta.json'), {
      version: 1,
      createdAt: '2024-06-01T00:00:00Z',
      updatedAt: '2024-06-01T00:00:00Z',
      gitCommit: 'abc123',
      gitBranch: 'main',
      project: {
        name: 'Test Project',
        path: '/tmp/test-project',
        techStack: ['typescript'],
        packageManager: 'npm',
      },
      stats: {
        totalFiles: 42,
        screens: 5,
        components: 15,
        apiEndpoints: 8,
        models: 3,
        modules: 10,
      },
    });

    // 어노테이션 메타 생성
    const annotationDir = path.join(impactDir, 'annotations', TEST_PROJECT_ID);
    ensureDir(annotationDir);
    writeJsonFile(path.join(annotationDir, 'meta.json'), {
      version: '1.0.0',
      createdAt: '2024-06-01T00:00:00Z',
      lastUpdatedAt: '2024-06-01T12:00:00Z',
      totalFiles: 10,
      totalAnnotations: 25,
      totalPolicies: 12,
      systems: { delivery: { files: 5, annotations: 15, policies: 8 } },
      avgConfidence: 0.75,
      lowConfidenceCount: 3,
      userModifiedCount: 2,
    });

    app = createApp(TEST_BASE);
  });

  afterAll(() => {
    // 테스트 디렉토리 정리
    if (fs.existsSync(TEST_BASE)) {
      fs.rmSync(TEST_BASE, { recursive: true, force: true });
    }
  });

  // ============================================================
  // GET /api/project/status
  // ============================================================

  describe('GET /api/project/status', () => {
    it('should return project status with all flags', async () => {
      const res = await request(app).get('/api/project/status').expect(200);

      expect(res.body.projectId).toBe(TEST_PROJECT_ID);
      expect(res.body.hasIndex).toBe(true);
      expect(res.body.hasAnnotations).toBe(true);
      expect(typeof res.body.hasResults).toBe('boolean');
    });

    it('should include projectPath from projects.json', async () => {
      const res = await request(app).get('/api/project/status').expect(200);

      expect(res.body.projectPath).toBe('/tmp/test-project');
    });
  });

  // ============================================================
  // GET /api/project/index-meta
  // ============================================================

  describe('GET /api/project/index-meta', () => {
    it('should return index meta with stats', async () => {
      const res = await request(app).get('/api/project/index-meta').expect(200);

      expect(res.body.meta).not.toBeNull();
      expect(res.body.meta.stats.totalFiles).toBe(42);
      expect(res.body.meta.stats.screens).toBe(5);
      expect(res.body.meta.stats.components).toBe(15);
      expect(res.body.meta.stats.apiEndpoints).toBe(8);
    });

    it('should include project info in meta', async () => {
      const res = await request(app).get('/api/project/index-meta').expect(200);

      expect(res.body.meta.project.name).toBe('Test Project');
    });
  });

  // ============================================================
  // GET /api/project/annotation-meta
  // ============================================================

  describe('GET /api/project/annotation-meta', () => {
    it('should return annotation meta', async () => {
      const res = await request(app).get('/api/project/annotation-meta').expect(200);

      expect(res.body.meta).not.toBeNull();
      expect(res.body.meta.totalFiles).toBe(10);
      expect(res.body.meta.totalAnnotations).toBe(25);
      expect(res.body.meta.totalPolicies).toBe(12);
    });

    it('should include confidence stats', async () => {
      const res = await request(app).get('/api/project/annotation-meta').expect(200);

      expect(res.body.meta.avgConfidence).toBe(0.75);
      expect(res.body.meta.lowConfidenceCount).toBe(3);
    });
  });
});
