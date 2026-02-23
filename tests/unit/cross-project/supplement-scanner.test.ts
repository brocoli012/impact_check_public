/**
 * @module tests/unit/cross-project/supplement-scanner
 * @description SupplementScanner + ResultManager 보완 분석 단위/통합 테스트 (TASK-167)
 *
 * 테스트 케이스:
 * 1. scan() - active 분석만 대상으로 스캔
 * 2. scan() - completed/on-hold/archived 제외 + excludedByStatus 집계
 * 3. scan() - 매칭도 50% 이상 -> auto 분류
 * 4. scan() - 매칭도 20~49% -> suggest 분류
 * 5. scan() - 매칭도 20% 미만 -> excluded
 * 6. scan() - 분석 결과 0건 -> 빈 결과
 * 7. scan() - 인덱스 없는 프로젝트 -> 빈 결과
 * 8. ResultManager.saveSupplementResult() - supplement 파일 저장
 * 9. ResultManager.getSupplementResults() - 보완 분석 결과 조회
 * 10. ResultManager.isSupplementResult() - supplement 여부 판별
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SupplementScanner } from '../../../src/core/cross-project/supplement-scanner';
import { ResultManager } from '../../../src/core/analysis/result-manager';
import { ConfidenceEnrichedResult } from '../../../src/types/analysis';

// ============================================================
// 테스트 유틸리티
// ============================================================

/** 임시 디렉토리 생성 헬퍼 */
function setupTestDir(): { homeDir: string; impactDir: string } {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kic-supp-'));
  const impactDir = path.join(homeDir, '.impact');
  fs.mkdirSync(impactDir, { recursive: true });
  return { homeDir, impactDir };
}

/** projects.json 생성 헬퍼 */
function writeProjectsJson(
  impactDir: string,
  projects: Array<{ id: string; name: string }>,
): void {
  const projectsPath = path.join(impactDir, 'projects.json');
  fs.writeFileSync(
    projectsPath,
    JSON.stringify({
      activeProject: projects[0]?.id || '',
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        path: `/test/${p.id}`,
        status: 'active',
        createdAt: '2025-01-01T00:00:00Z',
        lastUsedAt: '2025-01-01T00:00:00Z',
        techStack: [],
      })),
    }),
  );
}

/**
 * 프로젝트 인덱스 생성 헬퍼
 * Indexer.loadIndex()가 참조하는 구조에 맞춰 개별 파일 저장
 */
function writeProjectIndex(
  impactDir: string,
  projectId: string,
  opts: {
    screens?: Array<{ name: string }>;
    apis?: Array<{ path: string }>;
    components?: Array<{ name: string }>;
    models?: Array<{ name: string }>;
  },
): void {
  const indexDir = path.join(impactDir, 'projects', projectId, 'index');
  fs.mkdirSync(indexDir, { recursive: true });

  // meta.json (required by loadIndex)
  fs.writeFileSync(
    path.join(indexDir, 'meta.json'),
    JSON.stringify({
      version: 1,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      gitCommit: 'abc123',
      gitBranch: 'main',
      projectPath: `/test/${projectId}`,
      stats: {
        totalFiles: 10,
        screens: opts.screens?.length || 0,
        components: opts.components?.length || 0,
        apiEndpoints: opts.apis?.length || 0,
        modules: 0,
      },
      project: { name: projectId, techStack: [] },
    }),
  );

  // screens.json
  fs.writeFileSync(
    path.join(indexDir, 'screens.json'),
    JSON.stringify(
      (opts.screens || []).map((s, i) => ({
        id: `screen-${i}`,
        name: s.name,
        path: `/src/screens/${s.name}.tsx`,
        components: [],
        apis: [],
      })),
    ),
  );

  // apis.json
  fs.writeFileSync(
    path.join(indexDir, 'apis.json'),
    JSON.stringify(
      (opts.apis || []).map((a, i) => ({
        id: `api-${i}`,
        path: a.path,
        method: 'GET',
        file: `/src/api/${i}.ts`,
      })),
    ),
  );

  // components.json
  fs.writeFileSync(
    path.join(indexDir, 'components.json'),
    JSON.stringify(
      (opts.components || []).map((c, i) => ({
        id: `comp-${i}`,
        name: c.name,
        path: `/src/components/${c.name}.tsx`,
        props: [],
      })),
    ),
  );

  // models.json
  fs.writeFileSync(
    path.join(indexDir, 'models.json'),
    JSON.stringify(
      (opts.models || []).map((m, i) => ({
        id: `model-${i}`,
        name: m.name,
        path: `/src/models/${m.name}.ts`,
        fields: [],
      })),
    ),
  );

  // files.json (empty)
  fs.writeFileSync(path.join(indexDir, 'files.json'), JSON.stringify([]));
  // events.json (empty)
  fs.writeFileSync(path.join(indexDir, 'events.json'), JSON.stringify([]));
  // policies.json (empty)
  fs.writeFileSync(path.join(indexDir, 'policies.json'), JSON.stringify([]));
  // dependencies.json (empty graph)
  fs.writeFileSync(
    path.join(indexDir, 'dependencies.json'),
    JSON.stringify({ graph: { nodes: [], edges: [] } }),
  );
}

/**
 * 분석 결과 인덱스(index.json) + 분석 결과 파일 생성 헬퍼
 */
function writeAnalysisResults(
  impactDir: string,
  projectId: string,
  results: Array<{
    id: string;
    specTitle: string;
    status?: string;
    keywords?: string[];
    keyFindings?: string[];
    affectedScreenNames?: string[];
    relatedApis?: string[];
  }>,
): void {
  const resultsDir = path.join(impactDir, 'projects', projectId, 'results');
  fs.mkdirSync(resultsDir, { recursive: true });

  // index.json
  const summaries = results.map(r => ({
    id: r.id,
    specTitle: r.specTitle,
    analyzedAt: '2025-01-01T00:00:00Z',
    totalScore: 70,
    grade: 'High',
    affectedScreenCount: r.affectedScreenNames?.length || 0,
    taskCount: 1,
    status: r.status || 'active',
  }));
  fs.writeFileSync(path.join(resultsDir, 'index.json'), JSON.stringify(summaries));

  // 각 분석 결과 파일
  for (const r of results) {
    const resultData: ConfidenceEnrichedResult = {
      analysisId: r.id,
      analyzedAt: '2025-01-01T00:00:00Z',
      specTitle: r.specTitle,
      analysisMethod: 'rule-based',
      affectedScreens: (r.affectedScreenNames || []).map((name, idx) => ({
        screenId: `screen-${idx}`,
        screenName: name,
        impactLevel: 'medium' as const,
        tasks: (r.relatedApis || []).map((api, ti) => ({
          id: `task-${ti}`,
          title: `Task for ${api}`,
          type: 'FE' as const,
          actionType: 'modify' as const,
          description: `Modify for ${api}`,
          affectedFiles: [],
          relatedApis: [api],
          planningChecks: [],
          rationale: 'test',
        })),
      })),
      tasks: (r.relatedApis || []).map((api, ti) => ({
        id: `task-${ti}`,
        title: `Task for ${api}`,
        type: 'FE' as const,
        actionType: 'modify' as const,
        description: `Modify for ${api}`,
        affectedFiles: [],
        relatedApis: [api],
        planningChecks: [],
        rationale: 'test',
      })),
      planningChecks: [],
      policyChanges: [],
      screenScores: [],
      totalScore: 70,
      grade: 'High',
      recommendation: '',
      policyWarnings: [],
      ownerNotifications: [],
      confidenceScores: [],
      lowConfidenceWarnings: [],
      parsedSpec: {
        title: r.specTitle,
        requirements: [],
        features: [],
        businessRules: [],
        targetScreens: [],
        keywords: r.keywords || [],
        ambiguities: [],
      },
      analysisSummary: {
        overview: '',
        keyFindings: r.keyFindings || [],
        riskAreas: [],
      },
    };

    fs.writeFileSync(
      path.join(resultsDir, `${r.id}.json`),
      JSON.stringify(resultData),
    );
  }
}

// ============================================================
// SupplementScanner 테스트
// ============================================================

describe('SupplementScanner', () => {
  let homeDir: string;
  let impactDir: string;

  beforeEach(() => {
    const dirs = setupTestDir();
    homeDir = dirs.homeDir;
    impactDir = dirs.impactDir;
  });

  afterEach(() => {
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  // --------------------------------------------------------
  // 1. scan() - active 분석만 대상으로 스캔
  // --------------------------------------------------------
  it('active 상태 분석만 대상으로 스캔하고 후보에 포함', async () => {
    writeProjectsJson(impactDir, [
      { id: 'proj-new', name: 'New Project' },
      { id: 'proj-existing', name: 'Existing Project' },
    ]);

    // proj-new 인덱스: 매칭할 키워드
    writeProjectIndex(impactDir, 'proj-new', {
      screens: [{ name: 'OrderPage' }],
      apis: [{ path: '/api/orders' }],
      components: [{ name: 'CartComponent' }],
    });

    // proj-existing의 분석 결과: active 상태, keywords가 proj-new 인덱스와 매칭
    writeAnalysisResults(impactDir, 'proj-existing', [
      {
        id: 'analysis-001',
        specTitle: '주문 기능 개선',
        status: 'active',
        keywords: ['OrderPage', 'CartComponent', '/api/orders'],
      },
    ]);

    const scanner = new SupplementScanner(homeDir);
    const result = await scanner.scan('proj-new');

    // active 분석이 후보에 포함되어야 함
    expect(result.candidates.length).toBeGreaterThanOrEqual(1);
    const activeCandidate = result.candidates.find(c => c.analysisId === 'analysis-001');
    expect(activeCandidate).toBeDefined();
    expect(activeCandidate!.status).toBe('active');
  });

  // --------------------------------------------------------
  // 2. scan() - completed/on-hold/archived 제외 + excludedByStatus 집계
  // --------------------------------------------------------
  it('completed/on-hold/archived 분석은 제외하고 excludedByStatus에 집계', async () => {
    writeProjectsJson(impactDir, [
      { id: 'proj-new', name: 'New Project' },
      { id: 'proj-existing', name: 'Existing Project' },
    ]);

    writeProjectIndex(impactDir, 'proj-new', {
      screens: [{ name: 'OrderPage' }],
      apis: [{ path: '/api/orders' }],
    });

    writeAnalysisResults(impactDir, 'proj-existing', [
      { id: 'a1', specTitle: 'Active Analysis', status: 'active', keywords: ['OrderPage'] },
      { id: 'a2', specTitle: 'Completed Analysis', status: 'completed', keywords: ['OrderPage'] },
      { id: 'a3', specTitle: 'OnHold Analysis', status: 'on-hold', keywords: ['OrderPage'] },
      { id: 'a4', specTitle: 'Archived Analysis', status: 'archived', keywords: ['OrderPage'] },
    ]);

    const scanner = new SupplementScanner(homeDir);
    const result = await scanner.scan('proj-new');

    // active만 후보에 포함
    const activeCandidates = result.candidates.filter(c => c.status === 'active');
    expect(activeCandidates.length).toBe(1);
    expect(activeCandidates[0].analysisId).toBe('a1');

    // completed/on-hold/archived 는 후보에 없음
    expect(result.candidates.find(c => c.analysisId === 'a2')).toBeUndefined();
    expect(result.candidates.find(c => c.analysisId === 'a3')).toBeUndefined();
    expect(result.candidates.find(c => c.analysisId === 'a4')).toBeUndefined();

    // excludedByStatus 확인
    expect(result.excludedByStatus.completed).toBe(1);
    expect(result.excludedByStatus.onHold).toBe(1);
    expect(result.excludedByStatus.archived).toBe(1);
  });

  // --------------------------------------------------------
  // 3. scan() - 매칭도 50% 이상 -> auto 분류
  // --------------------------------------------------------
  it('매칭도 50% 이상인 분석은 auto로 분류', async () => {
    writeProjectsJson(impactDir, [
      { id: 'proj-new', name: 'New Project' },
      { id: 'proj-existing', name: 'Existing Project' },
    ]);

    // proj-new 인덱스: 많은 키워드
    writeProjectIndex(impactDir, 'proj-new', {
      screens: [{ name: 'OrderPage' }, { name: 'CartPage' }],
      apis: [{ path: '/api/orders' }, { path: '/api/cart' }],
      components: [{ name: 'OrderList' }, { name: 'CartItem' }],
      models: [{ name: 'Order' }, { name: 'CartModel' }],
    });

    // 분석의 키워드 대부분이 proj-new 인덱스와 매칭되도록 설정
    writeAnalysisResults(impactDir, 'proj-existing', [
      {
        id: 'analysis-high-match',
        specTitle: '주문/장바구니 전면 개편',
        status: 'active',
        keywords: ['OrderPage', 'CartPage', '/api/orders', '/api/cart'],
        // 4개 키워드 중 4개 매칭 = 100% -> auto
      },
    ]);

    const scanner = new SupplementScanner(homeDir);
    const result = await scanner.scan('proj-new');

    const autoCandidate = result.candidates.find(
      c => c.analysisId === 'analysis-high-match',
    );
    expect(autoCandidate).toBeDefined();
    expect(autoCandidate!.recommendation).toBe('auto');
    expect(autoCandidate!.matchRate).toBeGreaterThanOrEqual(50);
    expect(result.summary.auto).toBeGreaterThanOrEqual(1);
  });

  // --------------------------------------------------------
  // 4. scan() - 매칭도 20~49% -> suggest 분류
  // --------------------------------------------------------
  it('매칭도 20~49%인 분석은 suggest로 분류', async () => {
    writeProjectsJson(impactDir, [
      { id: 'proj-new', name: 'New Project' },
      { id: 'proj-existing', name: 'Existing Project' },
    ]);

    // proj-new 인덱스: OrderPage만 있음
    writeProjectIndex(impactDir, 'proj-new', {
      screens: [{ name: 'OrderPage' }],
    });

    // 분석에 5개 키워드가 있는데 1개만 매칭 = 20%
    writeAnalysisResults(impactDir, 'proj-existing', [
      {
        id: 'analysis-mid-match',
        specTitle: '회원 기능 개선 (일부 주문)',
        status: 'active',
        keywords: ['OrderPage', 'MemberPage', 'LoginPage', 'SignupPage', 'ProfilePage'],
        // 5개 중 1개 매칭 = 20% -> suggest
      },
    ]);

    const scanner = new SupplementScanner(homeDir);
    const result = await scanner.scan('proj-new');

    const suggestCandidate = result.candidates.find(
      c => c.analysisId === 'analysis-mid-match',
    );
    expect(suggestCandidate).toBeDefined();
    expect(suggestCandidate!.recommendation).toBe('suggest');
    expect(suggestCandidate!.matchRate).toBeGreaterThanOrEqual(20);
    expect(suggestCandidate!.matchRate).toBeLessThan(50);
    expect(result.summary.suggest).toBeGreaterThanOrEqual(1);
  });

  // --------------------------------------------------------
  // 5. scan() - 매칭도 20% 미만 -> excluded
  // --------------------------------------------------------
  it('매칭도 20% 미만인 분석은 excluded로 분류', async () => {
    writeProjectsJson(impactDir, [
      { id: 'proj-new', name: 'New Project' },
      { id: 'proj-existing', name: 'Existing Project' },
    ]);

    // proj-new 인덱스: 전혀 관련 없는 키워드
    writeProjectIndex(impactDir, 'proj-new', {
      screens: [{ name: 'DashboardPage' }],
      apis: [{ path: '/api/analytics' }],
    });

    // 분석의 키워드가 proj-new와 매칭되지 않음
    writeAnalysisResults(impactDir, 'proj-existing', [
      {
        id: 'analysis-low-match',
        specTitle: '결제 시스템 개편',
        status: 'active',
        keywords: ['PaymentPage', 'CheckoutPage', '/api/payments', '/api/billing', 'CreditCard'],
        // 5개 중 0개 매칭 = 0% -> excluded
      },
    ]);

    const scanner = new SupplementScanner(homeDir);
    const result = await scanner.scan('proj-new');

    const excludedCandidate = result.candidates.find(
      c => c.analysisId === 'analysis-low-match',
    );
    expect(excludedCandidate).toBeDefined();
    expect(excludedCandidate!.recommendation).toBe('excluded');
    expect(excludedCandidate!.matchRate).toBeLessThan(20);
    expect(result.summary.excluded).toBeGreaterThanOrEqual(1);
  });

  // --------------------------------------------------------
  // 6. scan() - 분석 결과 0건 -> 빈 결과
  // --------------------------------------------------------
  it('기존 프로젝트에 분석 결과가 없으면 빈 결과 반환', async () => {
    writeProjectsJson(impactDir, [
      { id: 'proj-new', name: 'New Project' },
      { id: 'proj-existing', name: 'Existing Project' },
    ]);

    writeProjectIndex(impactDir, 'proj-new', {
      screens: [{ name: 'OrderPage' }],
    });

    // proj-existing에 분석 결과 없음 (results 디렉토리 없음)

    const scanner = new SupplementScanner(homeDir);
    const result = await scanner.scan('proj-new');

    expect(result.candidates.length).toBe(0);
    expect(result.summary.total).toBe(0);
    expect(result.summary.auto).toBe(0);
    expect(result.summary.suggest).toBe(0);
    expect(result.summary.excluded).toBe(0);
  });

  // --------------------------------------------------------
  // 7. scan() - 인덱스 없는 프로젝트 -> 빈 결과
  // --------------------------------------------------------
  it('신규 프로젝트에 인덱스가 없으면 빈 결과 반환', async () => {
    writeProjectsJson(impactDir, [
      { id: 'proj-new', name: 'New Project' },
      { id: 'proj-existing', name: 'Existing Project' },
    ]);

    // proj-new에 인덱스 없음 (index 디렉토리 없음)
    writeAnalysisResults(impactDir, 'proj-existing', [
      {
        id: 'analysis-001',
        specTitle: '기존 분석',
        status: 'active',
        keywords: ['OrderPage'],
      },
    ]);

    const scanner = new SupplementScanner(homeDir);
    const result = await scanner.scan('proj-new');

    expect(result.candidates.length).toBe(0);
    expect(result.summary.total).toBe(0);
  });

  // --------------------------------------------------------
  // scan() - 자기 자신의 프로젝트 분석은 제외
  // --------------------------------------------------------
  it('자기 자신의 프로젝트 분석은 스캔 대상에서 제외', async () => {
    writeProjectsJson(impactDir, [
      { id: 'proj-a', name: 'Project A' },
    ]);

    writeProjectIndex(impactDir, 'proj-a', {
      screens: [{ name: 'OrderPage' }],
    });

    writeAnalysisResults(impactDir, 'proj-a', [
      {
        id: 'analysis-001',
        specTitle: 'Self Analysis',
        status: 'active',
        keywords: ['OrderPage'],
      },
    ]);

    const scanner = new SupplementScanner(homeDir);
    const result = await scanner.scan('proj-a');

    // 자기 자신의 분석은 포함되지 않음
    expect(result.candidates.length).toBe(0);
  });

  // --------------------------------------------------------
  // scan() - 후보 매칭도 내림차순 정렬 확인
  // --------------------------------------------------------
  it('후보는 매칭도 내림차순으로 정렬', async () => {
    writeProjectsJson(impactDir, [
      { id: 'proj-new', name: 'New Project' },
      { id: 'proj-a', name: 'Project A' },
      { id: 'proj-b', name: 'Project B' },
    ]);

    writeProjectIndex(impactDir, 'proj-new', {
      screens: [{ name: 'OrderPage' }, { name: 'CartPage' }],
      apis: [{ path: '/api/orders' }, { path: '/api/cart' }],
      components: [{ name: 'OrderList' }],
    });

    // proj-a: 높은 매칭도
    writeAnalysisResults(impactDir, 'proj-a', [
      {
        id: 'high-match',
        specTitle: 'High Match',
        status: 'active',
        keywords: ['OrderPage', 'CartPage', '/api/orders', '/api/cart'],
      },
    ]);

    // proj-b: 낮은 매칭도
    writeAnalysisResults(impactDir, 'proj-b', [
      {
        id: 'low-match',
        specTitle: 'Low Match',
        status: 'active',
        keywords: ['OrderPage', 'PaymentPage', 'MemberPage', 'LoginPage', 'ProfilePage', 'AdminPage', 'ReportPage', 'SettingsPage', 'HelpPage', 'AboutPage'],
      },
    ]);

    const scanner = new SupplementScanner(homeDir);
    const result = await scanner.scan('proj-new');

    expect(result.candidates.length).toBe(2);
    // 매칭도 내림차순
    expect(result.candidates[0].matchRate).toBeGreaterThanOrEqual(result.candidates[1].matchRate);
  });
});

// ============================================================
// ResultManager 보완 분석 관련 테스트
// ============================================================

describe('ResultManager supplement methods', () => {
  let homeDir: string;
  let impactDir: string;

  beforeEach(() => {
    const dirs = setupTestDir();
    homeDir = dirs.homeDir;
    impactDir = dirs.impactDir;
  });

  afterEach(() => {
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  /** 테스트용 ConfidenceEnrichedResult 생성 */
  function createTestResult(overrides?: Partial<ConfidenceEnrichedResult>): ConfidenceEnrichedResult {
    return {
      analysisId: 'analysis-001',
      analyzedAt: '2025-01-01T00:00:00Z',
      specTitle: '테스트 분석',
      analysisMethod: 'rule-based',
      affectedScreens: [
        {
          screenId: 'screen-1',
          screenName: 'TestScreen',
          impactLevel: 'medium',
          tasks: [],
        },
      ],
      tasks: [
        {
          id: 'task-1',
          title: 'Test Task',
          type: 'FE',
          actionType: 'modify',
          description: 'Test',
          affectedFiles: [],
          relatedApis: ['/api/test'],
          planningChecks: [],
          rationale: 'test',
        },
      ],
      planningChecks: [],
      policyChanges: [],
      screenScores: [],
      totalScore: 75,
      grade: 'High',
      recommendation: '',
      policyWarnings: [],
      ownerNotifications: [],
      confidenceScores: [],
      lowConfidenceWarnings: [],
      ...overrides,
    };
  }

  // --------------------------------------------------------
  // 8. ResultManager.saveSupplementResult() - supplement 파일 저장
  // --------------------------------------------------------
  it('saveSupplementResult()로 보완 분석 결과를 저장', async () => {
    // 결과 저장 디렉토리 사전 생성
    const resultsDir = path.join(impactDir, 'projects', 'proj-a', 'results');
    fs.mkdirSync(resultsDir, { recursive: true });
    fs.writeFileSync(path.join(resultsDir, 'index.json'), JSON.stringify([]));

    const resultManager = new ResultManager(homeDir);
    const testResult = createTestResult({
      triggerProject: 'proj-new',
    });

    const filePath = await resultManager.saveSupplementResult(
      'proj-a',
      'analysis-001',
      testResult,
    );

    // 파일 저장 확인
    expect(fs.existsSync(filePath)).toBe(true);

    // 파일 내용 확인
    const savedData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(savedData.supplementOf).toBe('analysis-001');
    expect(savedData.triggerProject).toBe('proj-new');

    // 인덱스 업데이트 확인
    const indexData = JSON.parse(
      fs.readFileSync(path.join(resultsDir, 'index.json'), 'utf8'),
    );
    const supplementEntry = indexData.find(
      (s: { id: string }) => s.id === 'supplement-analysis-001',
    );
    expect(supplementEntry).toBeDefined();
    expect(supplementEntry.isSupplement).toBe(true);
    expect(supplementEntry.supplementOf).toBe('analysis-001');
    expect(supplementEntry.triggerProject).toBe('proj-new');
  });

  // --------------------------------------------------------
  // 9. ResultManager.getSupplementResults() - 보완 분석 결과 조회
  // --------------------------------------------------------
  it('getSupplementResults()로 보완 분석 결과를 조회', async () => {
    const resultsDir = path.join(impactDir, 'projects', 'proj-a', 'results');
    fs.mkdirSync(resultsDir, { recursive: true });
    fs.writeFileSync(path.join(resultsDir, 'index.json'), JSON.stringify([]));

    const resultManager = new ResultManager(homeDir);
    const testResult = createTestResult({
      triggerProject: 'proj-new',
    });

    // 먼저 저장
    await resultManager.saveSupplementResult('proj-a', 'analysis-001', testResult);

    // 조회
    const supplements = await resultManager.getSupplementResults('proj-a', 'analysis-001');
    expect(supplements.length).toBe(1);
    expect(supplements[0].supplementOf).toBe('analysis-001');
  });

  it('getSupplementResults()는 보완 분석이 없으면 빈 배열 반환', async () => {
    const resultsDir = path.join(impactDir, 'projects', 'proj-a', 'results');
    fs.mkdirSync(resultsDir, { recursive: true });

    const resultManager = new ResultManager(homeDir);
    const supplements = await resultManager.getSupplementResults('proj-a', 'nonexistent');
    expect(supplements.length).toBe(0);
  });

  // --------------------------------------------------------
  // 10. ResultManager.isSupplementResult() - supplement 여부 판별
  // --------------------------------------------------------
  it('isSupplementResult()는 supplement- 접두사 ID를 true 반환', () => {
    const resultManager = new ResultManager(homeDir);
    expect(resultManager.isSupplementResult('supplement-analysis-001')).toBe(true);
    expect(resultManager.isSupplementResult('supplement-test')).toBe(true);
  });

  it('isSupplementResult()는 일반 분석 ID를 false 반환', () => {
    const resultManager = new ResultManager(homeDir);
    expect(resultManager.isSupplementResult('analysis-001')).toBe(false);
    expect(resultManager.isSupplementResult('test-supplement')).toBe(false);
    expect(resultManager.isSupplementResult('')).toBe(false);
  });
});
