/**
 * @module tests/integration/web-api
 * @description Web API 통합 테스트 - Express 서버 API 엔드포인트 E2E 테스트
 */

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import { createApp } from '@/server/web-server';
import { ResultManager } from '@/core/analysis/result-manager';
import { ConfidenceEnrichedResult } from '@/types/analysis';
import { ensureDir, writeJsonFile } from '@/utils/file';

/** 테스트용 임시 디렉토리 */
let tmpDir: string;
const TEST_PROJECT_ID = 'e2e-web-project';

/** 테스트용 분석 결과 생성 */
function createTestResult(id: string, title: string): ConfidenceEnrichedResult {
  const now = new Date().toISOString();
  return {
    analysisId: id,
    analyzedAt: now,
    specTitle: title,
    analysisMethod: 'rule-based',
    affectedScreens: [
      {
        screenId: 'screen-1',
        screenName: '장바구니',
        impactLevel: 'high',
        tasks: [
          {
            id: 'T-001',
            title: '쿠폰 적용 UI',
            type: 'FE',
            actionType: 'new',
            description: '쿠폰 적용 UI 개발',
            affectedFiles: ['src/pages/CartPage.tsx'],
            relatedApis: [],
            planningChecks: ['쿠폰 중복 적용 확인'],
            rationale: '신규 UI 컴포넌트 개발 필요',
          },
        ],
      },
    ],
    tasks: [
      {
        id: 'T-001',
        title: '쿠폰 적용 UI',
        type: 'FE',
        actionType: 'new',
        description: '쿠폰 적용 UI 개발',
        affectedFiles: ['src/pages/CartPage.tsx'],
        relatedApis: [],
        planningChecks: ['쿠폰 중복 적용 확인'],
        rationale: '신규 UI 컴포넌트 개발 필요',
      },
    ],
    planningChecks: [
      {
        id: 'CHK-001',
        content: '쿠폰 중복 적용 확인',
        relatedFeatureId: 'F-001',
        priority: 'high',
        status: 'pending',
      },
    ],
    policyChanges: [],
    screenScores: [
      {
        screenId: 'screen-1',
        screenName: '장바구니',
        screenScore: 6.5,
        grade: 'High',
        taskScores: [
          {
            taskId: 'T-001',
            scores: {
              developmentComplexity: { score: 6, weight: 0.35, rationale: '신규 UI' },
              impactScope: { score: 7, weight: 0.30, rationale: '장바구니 핵심' },
              policyChange: { score: 5, weight: 0.20, rationale: '쿠폰 정책' },
              dependencyRisk: { score: 6, weight: 0.15, rationale: 'API 의존' },
            },
            totalScore: 6.2,
            grade: 'High',
          },
        ],
      },
    ],
    totalScore: 6.5,
    grade: 'High',
    recommendation: '별도 프로젝트 계획 필요',
    policyWarnings: [],
    ownerNotifications: [],
    confidenceScores: [],
    lowConfidenceWarnings: [],
  };
}

/** 테스트 데이터 설정 */
async function setupTestData(): Promise<void> {
  const impactDir = path.join(tmpDir, '.impact');
  ensureDir(impactDir);

  // projects.json 생성
  writeJsonFile(path.join(impactDir, 'projects.json'), {
    activeProject: TEST_PROJECT_ID,
    projects: [
      {
        id: TEST_PROJECT_ID,
        name: 'E2E Web Project',
        path: '/tmp/e2e-test',
        status: 'active',
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        techStack: ['react', 'typescript'],
      },
    ],
  });

  // config.json 생성
  writeJsonFile(path.join(impactDir, 'config.json'), {
    version: 1,
    llm: { defaultProvider: 'anthropic', providers: {}, routing: {} },
    general: { autoReindex: true, webPort: 3847, logLevel: 'info', llmDataConsent: false },
  });

  // 분석 결과 저장
  const resultManager = new ResultManager(tmpDir);
  const result1 = createTestResult('analysis-e2e-001', 'E2E 테스트 기획서 1');
  const result2 = createTestResult('analysis-e2e-002', 'E2E 테스트 기획서 2');
  // 두 번째 결과의 시간을 약간 뒤로 밀기
  result2.analyzedAt = new Date(Date.now() + 1000).toISOString();

  await resultManager.save(result1, TEST_PROJECT_ID, result1.specTitle);
  await resultManager.save(result2, TEST_PROJECT_ID, result2.specTitle);
}

describe('Web API Integration', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'impact-web-e2e-'));
    await setupTestData();
    app = createApp(tmpDir);
  });

  afterAll(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('GET /api/results', () => {
    it('should return result list', async () => {
      const res = await request(app).get('/api/results');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('results');
      expect(Array.isArray(res.body.results)).toBe(true);
      expect(res.body.results.length).toBe(2);

      // 각 결과에 필수 필드가 있는지 확인
      for (const r of res.body.results) {
        expect(r).toHaveProperty('id');
        expect(r).toHaveProperty('specTitle');
        expect(r).toHaveProperty('totalScore');
        expect(r).toHaveProperty('grade');
        expect(r).toHaveProperty('affectedScreenCount');
        expect(r).toHaveProperty('taskCount');
      }
    });
  });

  describe('GET /api/results/latest', () => {
    it('should return latest result', async () => {
      const res = await request(app).get('/api/results/latest');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('result');
      expect(res.body.result).not.toBeNull();

      // 가장 최근 분석 결과가 반환되어야 함
      const result = res.body.result;
      expect(result.analysisId).toBe('analysis-e2e-002');
      expect(result.specTitle).toBe('E2E 테스트 기획서 2');
    });
  });

  describe('GET /api/results/:id', () => {
    it('should return specific result', async () => {
      const res = await request(app).get('/api/results/analysis-e2e-001');
      expect(res.status).toBe(200);
      expect(res.body.result).toBeDefined();
      expect(res.body.result.analysisId).toBe('analysis-e2e-001');
      expect(res.body.result.specTitle).toBe('E2E 테스트 기획서 1');
    });

    it('should return 404 for non-existent result', async () => {
      const res = await request(app).get('/api/results/non-existent-id');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/checklist/:resultId', () => {
    it('should return checklist (empty initially)', async () => {
      const res = await request(app).get('/api/checklist/analysis-e2e-001');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('checklist');
      expect(res.body.checklist.resultId).toBe('analysis-e2e-001');
      expect(res.body.checklist.items).toEqual([]);
    });
  });

  describe('PATCH /api/checklist/:resultId/:itemId', () => {
    it('should update check status', async () => {
      const res = await request(app)
        .patch('/api/checklist/analysis-e2e-001/CHK-001')
        .send({ checked: true });

      expect(res.status).toBe(200);
      expect(res.body.item).toBeDefined();
      expect(res.body.item.itemId).toBe('CHK-001');
      expect(res.body.item.checked).toBe(true);
      expect(res.body.item.updatedAt).toBeDefined();
    });

    it('should persist and return updated checklist', async () => {
      // 상태 업데이트
      await request(app)
        .patch('/api/checklist/analysis-e2e-001/CHK-002')
        .send({ checked: true });

      // 조회로 확인
      const res = await request(app).get('/api/checklist/analysis-e2e-001');
      expect(res.status).toBe(200);
      const items = res.body.checklist.items;
      expect(items.length).toBeGreaterThanOrEqual(2);

      const chk002 = items.find((i: { itemId: string }) => i.itemId === 'CHK-002');
      expect(chk002).toBeDefined();
      expect(chk002.checked).toBe(true);
    });

    it('should reject invalid checked value', async () => {
      const res = await request(app)
        .patch('/api/checklist/analysis-e2e-001/CHK-003')
        .send({ checked: 'not-boolean' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('404 handling', () => {
    it('GET /api/nonexistent should return 404', async () => {
      const res = await request(app).get('/api/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    it('GET /api/deeply/nested/nonexistent should return 404', async () => {
      const res = await request(app).get('/api/deeply/nested/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('invalid ID handling', () => {
    it('should reject IDs with spaces', async () => {
      // Encode a space in the ID to test validation
      const res = await request(app).get('/api/results/id%20with%20spaces');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject IDs with dots', async () => {
      const res = await request(app).get('/api/results/id.with.dots');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject invalid checklist result IDs with special chars', async () => {
      const res = await request(app).get('/api/checklist/id%20invalid');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject invalid checklist item IDs on PATCH', async () => {
      const res = await request(app)
        .patch('/api/checklist/analysis-e2e-001/item%20bad')
        .send({ checked: true });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });
});
