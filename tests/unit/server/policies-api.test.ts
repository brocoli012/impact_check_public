/**
 * @module tests/unit/server/policies-api.test
 * @description 정책 API 엔드포인트 테스트
 */

import request from 'supertest';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { createApp } from '@/server/web-server';
import { ensureDir, writeJsonFile } from '@/utils/file';

/** 테스트용 임시 디렉토리 */
const TEST_BASE = path.join(__dirname, '..', '..', 'fixtures', 'test-policies-data');
const TEST_PROJECT_ID = 'test-policies-project';

/** 테스트 정책 데이터 */
const testPolicies = [
  {
    id: 'policy-1',
    name: '무료배송 기준',
    description: '30,000원 이상 주문 시 무료배송 적용',
    source: 'comment' as const,
    sourceText: '// 무료배송 기준: 30,000원',
    filePath: 'src/services/shipping.ts',
    lineNumber: 10,
    category: '배송',
    relatedComponents: ['comp-1'],
    relatedApis: ['api-1'],
    relatedModules: ['shipping'],
    extractedAt: new Date().toISOString(),
  },
  {
    id: 'policy-2',
    name: '최소 주문 금액',
    description: '최소 주문 금액은 5,000원',
    source: 'comment' as const,
    sourceText: '// 최소 주문 금액: 5,000원',
    filePath: 'src/services/order.ts',
    lineNumber: 20,
    category: '가격',
    relatedComponents: ['comp-2'],
    relatedApis: ['api-2'],
    relatedModules: ['order'],
    extractedAt: new Date().toISOString(),
  },
  {
    id: 'policy-3',
    name: '배송비 할인',
    description: '쿠폰 적용 시 배송비 50% 할인',
    source: 'manual' as const,
    sourceText: '배송비 할인 정책',
    filePath: 'src/services/shipping.ts',
    lineNumber: 30,
    category: '배송',
    relatedComponents: [],
    relatedApis: [],
    relatedModules: ['shipping'],
    extractedAt: new Date().toISOString(),
  },
];

/** 테스트 보강 주석 데이터 */
const testAnnotation = {
  file: 'src/services/shipping.ts',
  system: 'shipping',
  lastAnalyzed: new Date().toISOString(),
  sourceHash: 'abc123',
  analyzerVersion: '1.0.0',
  model: 'rule-based',
  fileSummary: {
    description: '배송 서비스 모듈',
    confidence: 0.85,
    businessDomain: '배송',
    keywords: ['배송', '무료배송', '배송비'],
  },
  annotations: [
    {
      line: 10,
      endLine: 25,
      function: 'calculateShipping',
      signature: 'calculateShipping(orderAmount: number): number',
      original_comment: null,
      enriched_comment: '주문 금액에 따른 배송비 계산',
      confidence: 0.9,
      type: 'business_logic',
      userModified: false,
      lastModifiedBy: null,
      inferred_from: 'code analysis',
      policies: [
        {
          name: '무료배송 기준',
          description: '30,000원 이상 주문 시 무료배송',
          confidence: 0.85,
          category: '배송',
          inferred_from: 'conditional check',
        },
      ],
      relatedFunctions: ['getOrderTotal'],
      relatedApis: ['/api/shipping/calculate'],
    },
  ],
};

/** 테스트 분석 결과 */
const testAnalysisResult = {
  analysisId: 'policy-test-analysis-001',
  analyzedAt: new Date().toISOString(),
  specTitle: '정책 테스트 기획서',
  analysisMethod: 'rule-based',
  affectedScreens: [],
  tasks: [],
  planningChecks: [],
  policyChanges: [
    {
      id: 'pc-1',
      policyName: '무료배송 기준',
      description: '무료배송 기준 금액 변경 (30,000원 → 50,000원)',
      changeType: 'modify',
      affectedFiles: ['src/services/shipping.ts'],
      requiresReview: true,
    },
    {
      id: 'pc-2',
      policyName: '신규 할인 정책',
      description: '첫 주문 할인 정책 추가',
      changeType: 'new',
      affectedFiles: ['src/services/promotion.ts'],
      requiresReview: true,
    },
  ],
  screenScores: [],
  totalScore: 25,
  grade: 'Medium',
  recommendation: '테스트 권장 사항',
  policyWarnings: [],
  ownerNotifications: [],
  confidenceScores: [],
  lowConfidenceWarnings: [],
};

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
        name: 'Test Policies Project',
        path: '/tmp/test-policies',
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

  // 인덱스 데이터 생성
  const indexDir = path.join(impactDir, 'projects', TEST_PROJECT_ID, 'index');
  ensureDir(indexDir);

  writeJsonFile(path.join(indexDir, 'meta.json'), {
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    gitCommit: 'abc123',
    gitBranch: 'main',
    project: {
      name: 'test-policies',
      path: '/tmp/test-policies',
      techStack: ['react'],
      packageManager: 'npm',
    },
    stats: {
      totalFiles: 10,
      screens: 2,
      components: 5,
      apiEndpoints: 3,
      models: 1,
      modules: 3,
    },
  });

  writeJsonFile(path.join(indexDir, 'files.json'), []);
  writeJsonFile(path.join(indexDir, 'screens.json'), []);
  writeJsonFile(path.join(indexDir, 'components.json'), []);
  writeJsonFile(path.join(indexDir, 'apis.json'), []);
  writeJsonFile(path.join(indexDir, 'models.json'), []);
  writeJsonFile(path.join(indexDir, 'policies.json'), testPolicies);
  writeJsonFile(path.join(indexDir, 'dependencies.json'), {
    graph: { nodes: [], edges: [] },
  });

  // 보강 주석 데이터 생성 (YAML 형식, AnnotationManager 경로 규칙 따름)
  // AnnotationManager 경로: {basePath}/.impact/annotations/{projectId}/{filePath}.annotations.yaml
  const annotationsDir = path.join(
    impactDir,
    'annotations',
    TEST_PROJECT_ID,
    'src',
    'services',
  );
  ensureDir(annotationsDir);

  const yamlContent = yaml.dump(testAnnotation, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
  });
  fs.writeFileSync(
    path.join(annotationsDir, 'shipping.ts.annotations.yaml'),
    yamlContent,
    'utf-8',
  );

  // 메타 정보
  const metaDir = path.join(impactDir, 'annotations', TEST_PROJECT_ID);
  writeJsonFile(path.join(metaDir, 'meta.json'), {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    totalFiles: 1,
    totalAnnotations: 1,
    totalPolicies: 1,
    systems: { shipping: { files: 1, annotations: 1, policies: 1 } },
    avgConfidence: 0.9,
    lowConfidenceCount: 0,
    userModifiedCount: 0,
  });

  // 분석 결과 생성
  const resultsDir = path.join(impactDir, 'projects', TEST_PROJECT_ID, 'results');
  ensureDir(resultsDir);

  writeJsonFile(path.join(resultsDir, 'policy-test-analysis-001.json'), testAnalysisResult);
  writeJsonFile(path.join(resultsDir, 'index.json'), [
    {
      id: 'policy-test-analysis-001',
      specTitle: '정책 테스트 기획서',
      analyzedAt: testAnalysisResult.analyzedAt,
      totalScore: 25,
      grade: 'Medium',
      affectedScreenCount: 0,
      taskCount: 0,
    },
  ]);
}

/** 테스트 데이터 정리 */
function cleanupTestData(): void {
  if (fs.existsSync(TEST_BASE)) {
    fs.rmSync(TEST_BASE, { recursive: true, force: true });
  }
}

describe('Policies API', () => {
  beforeAll(() => {
    setupTestData();
  });

  afterAll(() => {
    cleanupTestData();
  });

  const app = createApp(TEST_BASE);

  // ============================================================
  // GET /api/policies
  // ============================================================

  describe('GET /api/policies', () => {
    it('should return full policy list', async () => {
      const res = await request(app).get('/api/policies');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('policies');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('categories');
      expect(Array.isArray(res.body.policies)).toBe(true);
      expect(res.body.total).toBe(3);
      expect(res.body.categories).toEqual(expect.arrayContaining(['배송', '가격']));
    });

    it('should return policies with expected fields', async () => {
      const res = await request(app).get('/api/policies');
      const policy = res.body.policies[0];
      expect(policy).toHaveProperty('id');
      expect(policy).toHaveProperty('name');
      expect(policy).toHaveProperty('category');
      expect(policy).toHaveProperty('description');
      expect(policy).toHaveProperty('file');
    });

    it('should filter by category', async () => {
      const res = await request(app).get('/api/policies?category=%EB%B0%B0%EC%86%A1');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      res.body.policies.forEach((p: { category: string }) => {
        expect(p.category).toBe('배송');
      });
    });

    it('should filter by search keyword', async () => {
      const res = await request(app).get('/api/policies?search=%EB%AC%B4%EB%A3%8C');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.policies[0].name).toBe('무료배송 기준');
    });

    it('should return empty list when no match for category', async () => {
      const res = await request(app).get('/api/policies?category=nonexistent');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
      expect(res.body.policies).toEqual([]);
    });

    it('should return empty list when no match for search', async () => {
      const res = await request(app).get('/api/policies?search=nonexistent');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
      expect(res.body.policies).toEqual([]);
    });
  });

  // ============================================================
  // GET /api/policies/:id
  // ============================================================

  describe('GET /api/policies/:id', () => {
    it('should return policy detail by ID', async () => {
      const res = await request(app).get('/api/policies/policy-1');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('policy');
      expect(res.body.policy.name).toBe('무료배송 기준');
      expect(res.body.policy.category).toBe('배송');
      expect(res.body.policy.filePath).toBe('src/services/shipping.ts');
    });

    it('should return policy detail by index (policy_N)', async () => {
      const res = await request(app).get('/api/policies/policy_1');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('policy');
      expect(res.body.policy.name).toBe('최소 주문 금액');
    });

    it('should return 404 for non-existent policy', async () => {
      const res = await request(app).get('/api/policies/policy-999');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 404 for out-of-range index', async () => {
      const res = await request(app).get('/api/policies/policy_999');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    it('should include policy detail fields', async () => {
      const res = await request(app).get('/api/policies/policy-1');
      const policy = res.body.policy;
      expect(policy).toHaveProperty('id');
      expect(policy).toHaveProperty('name');
      expect(policy).toHaveProperty('category');
      expect(policy).toHaveProperty('description');
      expect(policy).toHaveProperty('source');
      expect(policy).toHaveProperty('sourceText');
      expect(policy).toHaveProperty('filePath');
      expect(policy).toHaveProperty('lineNumber');
      expect(policy).toHaveProperty('relatedComponents');
      expect(policy).toHaveProperty('relatedApis');
      expect(policy).toHaveProperty('relatedModules');
      expect(policy).toHaveProperty('extractedAt');
    });

    it('should include annotation data when available', async () => {
      // policy-1 is in src/services/shipping.ts which has annotation
      const res = await request(app).get('/api/policies/policy-1');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('annotation');
      expect(res.body.annotation).toHaveProperty('file', 'src/services/shipping.ts');
      expect(res.body.annotation).toHaveProperty('system', 'shipping');
      expect(res.body.annotation).toHaveProperty('fileSummary');
      expect(res.body.annotation).toHaveProperty('annotations');
      expect(Array.isArray(res.body.annotation.annotations)).toBe(true);
      expect(res.body.annotation.annotations.length).toBeGreaterThan(0);

      const ann = res.body.annotation.annotations[0];
      expect(ann).toHaveProperty('function', 'calculateShipping');
      expect(ann).toHaveProperty('policies');
      expect(Array.isArray(ann.policies)).toBe(true);
    });

    it('should return only policy data when no annotation exists', async () => {
      // policy-2 is in src/services/order.ts which has no annotation
      const res = await request(app).get('/api/policies/policy-2');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('policy');
      expect(res.body.policy.name).toBe('최소 주문 금액');
      expect(res.body).not.toHaveProperty('annotation');
    });
  });

  // ============================================================
  // GET /api/analysis/policy-changes
  // ============================================================

  describe('GET /api/analysis/policy-changes', () => {
    it('should return policy changes from latest analysis', async () => {
      const res = await request(app).get('/api/analysis/policy-changes');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('policyChanges');
      expect(res.body).toHaveProperty('analysisId');
      expect(res.body).toHaveProperty('analyzedAt');
      expect(Array.isArray(res.body.policyChanges)).toBe(true);
      expect(res.body.policyChanges.length).toBe(2);
    });

    it('should include expected fields in policy changes', async () => {
      const res = await request(app).get('/api/analysis/policy-changes');
      const change = res.body.policyChanges[0];
      expect(change).toHaveProperty('id');
      expect(change).toHaveProperty('policyName');
      expect(change).toHaveProperty('description');
      expect(change).toHaveProperty('changeType');
      expect(change).toHaveProperty('affectedFiles');
      expect(change).toHaveProperty('requiresReview');
    });
  });
});

// ============================================================
// 인덱스 없는 상황 테스트
// ============================================================

describe('Policies API (no index)', () => {
  const NO_INDEX_BASE = path.join(__dirname, '..', '..', 'fixtures', 'test-policies-noindex');
  const NO_INDEX_PROJECT_ID = 'test-noindex-project';

  beforeAll(() => {
    const impactDir = path.join(NO_INDEX_BASE, '.impact');
    ensureDir(impactDir);
    writeJsonFile(path.join(impactDir, 'projects.json'), {
      activeProject: NO_INDEX_PROJECT_ID,
      projects: [
        {
          id: NO_INDEX_PROJECT_ID,
          name: 'No Index Project',
          path: '/tmp/no-index',
          status: 'active',
          createdAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
          techStack: [],
        },
      ],
    });
    writeJsonFile(path.join(impactDir, 'config.json'), {
      version: 1,
      general: { autoReindex: true, webPort: 3847, logLevel: 'info' },
    });
  });

  afterAll(() => {
    if (fs.existsSync(NO_INDEX_BASE)) {
      fs.rmSync(NO_INDEX_BASE, { recursive: true, force: true });
    }
  });

  const app = createApp(NO_INDEX_BASE);

  it('GET /api/policies should return empty list when no index and no annotations', async () => {
    const res = await request(app).get('/api/policies');
    expect(res.status).toBe(200);
    expect(res.body.policies).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('GET /api/policies/:id should return 404 when no index', async () => {
    const res = await request(app).get('/api/policies/policy-1');
    expect(res.status).toBe(404);
  });

  it('GET /api/analysis/policy-changes should return empty array when no analysis results', async () => {
    const res = await request(app).get('/api/analysis/policy-changes');
    expect(res.status).toBe(200);
    expect(res.body.policyChanges).toEqual([]);
    expect(res.body).toHaveProperty('message');
  });
});
