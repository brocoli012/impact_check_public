/**
 * @module tests/integration/supplement-flow
 * @description 보완 분석(Supplement) 전체 플로우 통합 테스트 (TASK-179)
 *
 * SupplementScanner.scan() + ResultManager의 보완 분석 메서드를 결합하여
 * "프로젝트 등록 -> 스캔 -> 보완 결과 저장 -> 조회" 전체 플로우를 검증한다.
 *
 * 테스트 시나리오:
 * 1. 프로젝트 1개만 있을 때 scan 결과 빈 candidates
 * 2. 2개 프로젝트 + 키워드 매칭 후 auto/suggest 분류
 * 3. match rate >= 50% -> action: 'auto'
 * 4. match rate 20-49% -> action: 'suggest'
 * 5. match rate < 20% -> candidates에 excluded로 분류
 * 6. completed 상태 분석은 보완 분석 대상에서 제외
 * 7. saveSupplementResult -> isSupplement:true, supplementOf, triggerProject 메타데이터
 * 8. getSupplementResults로 보완 분석 결과만 필터링 조회
 * 9. 전체 플로우: scan -> auto 후보 -> saveSupplementResult -> getSupplementResults
 * 10. 인덱스가 빈 프로젝트에 대해 빈 결과 반환
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SupplementScanner } from '../../src/core/cross-project/supplement-scanner';
import { ResultManager } from '../../src/core/analysis/result-manager';
import { ConfidenceEnrichedResult } from '../../src/types/analysis';

// ============================================================
// 테스트 유틸리티
// ============================================================

/** 임시 디렉토리 생성 헬퍼 */
function createTempHome(): { homeDir: string; impactDir: string } {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kic-integ-supp-'));
  const impactDir = path.join(homeDir, '.impact');
  fs.mkdirSync(impactDir, { recursive: true });
  return { homeDir, impactDir };
}

/** projects.json 작성 헬퍼 */
function writeProjectsConfig(
  impactDir: string,
  projects: Array<{ id: string; name: string }>,
): void {
  fs.writeFileSync(
    path.join(impactDir, 'projects.json'),
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
 * 프로젝트 인덱스(코드 인덱스) 생성 헬퍼
 * Indexer.loadIndex()가 참조하는 개별 파일 형식에 맞춰 저장
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

  fs.writeFileSync(
    path.join(indexDir, 'meta.json'),
    JSON.stringify({
      version: 1,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      gitCommit: 'abc123',
      gitBranch: 'main',
      project: { name: projectId, path: `/test/${projectId}`, techStack: [], packageManager: 'npm' },
      stats: {
        totalFiles: 10,
        screens: opts.screens?.length || 0,
        components: opts.components?.length || 0,
        apiEndpoints: opts.apis?.length || 0,
        models: opts.models?.length || 0,
        modules: 0,
      },
    }),
  );

  fs.writeFileSync(
    path.join(indexDir, 'screens.json'),
    JSON.stringify(
      (opts.screens || []).map((s, i) => ({
        id: `screen-${i}`,
        name: s.name,
        route: `/${s.name.toLowerCase()}`,
        filePath: `/src/pages/${s.name}.tsx`,
        components: [],
        apiCalls: [],
        childScreens: [],
        metadata: { linesOfCode: 50, complexity: 'low' },
      })),
    ),
  );

  fs.writeFileSync(
    path.join(indexDir, 'apis.json'),
    JSON.stringify(
      (opts.apis || []).map((a, i) => ({
        id: `api-${i}`,
        method: 'GET',
        path: a.path,
        filePath: `/src/api/route${i}.ts`,
        handler: `handler${i}`,
        calledBy: [],
        requestParams: [],
        responseType: 'unknown',
        relatedModels: [],
      })),
    ),
  );

  fs.writeFileSync(
    path.join(indexDir, 'components.json'),
    JSON.stringify(
      (opts.components || []).map((c, i) => ({
        id: `comp-${i}`,
        name: c.name,
        filePath: `/src/components/${c.name}.tsx`,
        type: 'functional',
        imports: [],
        importedBy: [],
        props: [],
        emits: [],
        apiCalls: [],
        linesOfCode: 30,
      })),
    ),
  );

  fs.writeFileSync(
    path.join(indexDir, 'models.json'),
    JSON.stringify(
      (opts.models || []).map((m, i) => ({
        id: `model-${i}`,
        name: m.name,
        filePath: `/src/models/${m.name}.ts`,
        type: 'interface',
        fields: [],
        relatedApis: [],
      })),
    ),
  );

  fs.writeFileSync(path.join(indexDir, 'files.json'), JSON.stringify([]));
  fs.writeFileSync(path.join(indexDir, 'events.json'), JSON.stringify([]));
  fs.writeFileSync(path.join(indexDir, 'policies.json'), JSON.stringify([]));
  fs.writeFileSync(
    path.join(indexDir, 'dependencies.json'),
    JSON.stringify({ graph: { nodes: [], edges: [] } }),
  );
}

/**
 * 분석 결과 (index.json + 개별 결과 JSON) 생성 헬퍼
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

  const summaries = results.map(r => ({
    id: r.id,
    specTitle: r.specTitle,
    analyzedAt: '2025-01-01T00:00:00Z',
    totalScore: 70,
    grade: 'High',
    affectedScreenCount: r.affectedScreenNames?.length || 0,
    taskCount: r.relatedApis?.length || 1,
    status: r.status || 'active',
  }));
  fs.writeFileSync(path.join(resultsDir, 'index.json'), JSON.stringify(summaries));

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

/** 테스트용 ConfidenceEnrichedResult 생성 */
function createTestResult(overrides?: Partial<ConfidenceEnrichedResult>): ConfidenceEnrichedResult {
  return {
    analysisId: 'analysis-original',
    analyzedAt: '2025-06-01T00:00:00Z',
    specTitle: '보완 분석 테스트',
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
        description: 'Test description',
        affectedFiles: [],
        relatedApis: ['/api/test'],
        planningChecks: [],
        rationale: 'test rationale',
      },
    ],
    planningChecks: [],
    policyChanges: [],
    screenScores: [],
    totalScore: 65,
    grade: 'High',
    recommendation: '',
    policyWarnings: [],
    ownerNotifications: [],
    confidenceScores: [],
    lowConfidenceWarnings: [],
    ...overrides,
  };
}

// ============================================================
// 통합 테스트
// ============================================================

describe('Supplement Flow Integration', () => {
  let homeDir: string;
  let impactDir: string;

  beforeEach(() => {
    const dirs = createTempHome();
    homeDir = dirs.homeDir;
    impactDir = dirs.impactDir;
  });

  afterEach(() => {
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  // ----------------------------------------------------------
  // 1. 프로젝트 1개만 있을 때 -> scan 결과 빈 candidates
  // ----------------------------------------------------------
  it('프로젝트가 1개뿐이면 scan 결과에 candidates가 비어 있다', async () => {
    writeProjectsConfig(impactDir, [
      { id: 'proj-only', name: 'Only Project' },
    ]);

    writeProjectIndex(impactDir, 'proj-only', {
      screens: [{ name: 'HomePage' }],
      apis: [{ path: '/api/home' }],
    });

    const scanner = new SupplementScanner(homeDir);
    const result = await scanner.scan('proj-only');

    expect(result.newProjectId).toBe('proj-only');
    expect(result.candidates).toHaveLength(0);
    expect(result.summary.total).toBe(0);
    expect(result.summary.auto).toBe(0);
    expect(result.summary.suggest).toBe(0);
    expect(result.summary.excluded).toBe(0);
  });

  // ----------------------------------------------------------
  // 2. 2개 프로젝트 + 키워드 매칭 후 auto/suggest 분류
  // ----------------------------------------------------------
  it('2개 프로젝트에서 키워드 매칭도에 따라 auto/suggest로 분류된다', async () => {
    writeProjectsConfig(impactDir, [
      { id: 'proj-new', name: 'New Project' },
      { id: 'proj-a', name: 'Project A' },
      { id: 'proj-b', name: 'Project B' },
    ]);

    // proj-new: 주문/장바구니 관련 인덱스
    writeProjectIndex(impactDir, 'proj-new', {
      screens: [{ name: 'OrderPage' }, { name: 'CartPage' }],
      apis: [{ path: '/api/orders' }, { path: '/api/cart' }],
      components: [{ name: 'OrderList' }, { name: 'CartWidget' }],
      models: [{ name: 'Order' }, { name: 'Cart' }],
    });

    // proj-a: 높은 매칭 (4/4 키워드 매칭 -> 100% -> auto)
    writeAnalysisResults(impactDir, 'proj-a', [
      {
        id: 'analysis-high',
        specTitle: '주문 시스템 개편',
        status: 'active',
        keywords: ['OrderPage', 'CartPage', '/api/orders', '/api/cart'],
      },
    ]);

    // proj-b: 중간 매칭 (1/4 키워드 매칭 -> 25% -> suggest)
    writeAnalysisResults(impactDir, 'proj-b', [
      {
        id: 'analysis-mid',
        specTitle: '회원 시스템 (일부 주문)',
        status: 'active',
        keywords: ['OrderPage', 'MemberPage', 'LoginPage', 'ProfilePage'],
      },
    ]);

    const scanner = new SupplementScanner(homeDir);
    const result = await scanner.scan('proj-new');

    // auto 후보
    const autoCandidate = result.candidates.find(c => c.analysisId === 'analysis-high');
    expect(autoCandidate).toBeDefined();
    expect(autoCandidate!.recommendation).toBe('auto');
    expect(autoCandidate!.matchRate).toBeGreaterThanOrEqual(50);

    // suggest 후보
    const suggestCandidate = result.candidates.find(c => c.analysisId === 'analysis-mid');
    expect(suggestCandidate).toBeDefined();
    expect(suggestCandidate!.recommendation).toBe('suggest');
    expect(suggestCandidate!.matchRate).toBeGreaterThanOrEqual(20);
    expect(suggestCandidate!.matchRate).toBeLessThan(50);

    // summary 검증
    expect(result.summary.auto).toBeGreaterThanOrEqual(1);
    expect(result.summary.suggest).toBeGreaterThanOrEqual(1);
  });

  // ----------------------------------------------------------
  // 3. match rate >= 50% -> recommendation: 'auto'
  // ----------------------------------------------------------
  it('매칭도가 50% 이상이면 recommendation이 auto이다', async () => {
    writeProjectsConfig(impactDir, [
      { id: 'proj-new', name: 'New Project' },
      { id: 'proj-old', name: 'Old Project' },
    ]);

    writeProjectIndex(impactDir, 'proj-new', {
      screens: [{ name: 'PaymentPage' }, { name: 'CheckoutPage' }],
      apis: [{ path: '/api/payments' }, { path: '/api/checkout' }],
      components: [{ name: 'PaymentForm' }],
    });

    // 분석 키워드 2개 중 2개 매칭 -> 100%
    writeAnalysisResults(impactDir, 'proj-old', [
      {
        id: 'a-full-match',
        specTitle: '결제 개선',
        status: 'active',
        keywords: ['PaymentPage', 'CheckoutPage'],
      },
    ]);

    const scanner = new SupplementScanner(homeDir);
    const result = await scanner.scan('proj-new');

    const candidate = result.candidates.find(c => c.analysisId === 'a-full-match');
    expect(candidate).toBeDefined();
    expect(candidate!.recommendation).toBe('auto');
    expect(candidate!.matchRate).toBeGreaterThanOrEqual(50);
  });

  // ----------------------------------------------------------
  // 4. match rate 20-49% -> recommendation: 'suggest'
  // ----------------------------------------------------------
  it('매칭도가 20-49% 범위이면 recommendation이 suggest이다', async () => {
    writeProjectsConfig(impactDir, [
      { id: 'proj-new', name: 'New Project' },
      { id: 'proj-old', name: 'Old Project' },
    ]);

    writeProjectIndex(impactDir, 'proj-new', {
      screens: [{ name: 'OrderPage' }],
    });

    // 5개 키워드 중 1개 매칭 -> 20%
    writeAnalysisResults(impactDir, 'proj-old', [
      {
        id: 'a-partial-match',
        specTitle: '복합 기능 개선',
        status: 'active',
        keywords: ['OrderPage', 'MemberPage', 'SettingsPage', 'AdminPage', 'ReportPage'],
      },
    ]);

    const scanner = new SupplementScanner(homeDir);
    const result = await scanner.scan('proj-new');

    const candidate = result.candidates.find(c => c.analysisId === 'a-partial-match');
    expect(candidate).toBeDefined();
    expect(candidate!.recommendation).toBe('suggest');
    expect(candidate!.matchRate).toBeGreaterThanOrEqual(20);
    expect(candidate!.matchRate).toBeLessThan(50);
  });

  // ----------------------------------------------------------
  // 5. match rate < 20% -> candidates에 excluded로 포함
  // ----------------------------------------------------------
  it('매칭도가 20% 미만이면 recommendation이 excluded이다', async () => {
    writeProjectsConfig(impactDir, [
      { id: 'proj-new', name: 'New Project' },
      { id: 'proj-old', name: 'Old Project' },
    ]);

    writeProjectIndex(impactDir, 'proj-new', {
      screens: [{ name: 'DashboardPage' }],
      apis: [{ path: '/api/dashboard' }],
    });

    // 키워드가 전혀 매칭되지 않음 -> 0%
    writeAnalysisResults(impactDir, 'proj-old', [
      {
        id: 'a-no-match',
        specTitle: '결제 시스템 전면 개편',
        status: 'active',
        keywords: ['PaymentGateway', 'CreditCard', 'BillingPage', 'InvoicePage', 'RefundPolicy'],
      },
    ]);

    const scanner = new SupplementScanner(homeDir);
    const result = await scanner.scan('proj-new');

    const candidate = result.candidates.find(c => c.analysisId === 'a-no-match');
    expect(candidate).toBeDefined();
    expect(candidate!.recommendation).toBe('excluded');
    expect(candidate!.matchRate).toBeLessThan(20);
    expect(result.summary.excluded).toBeGreaterThanOrEqual(1);
  });

  // ----------------------------------------------------------
  // 6. completed 상태 분석은 보완 분석 대상에서 제외
  // ----------------------------------------------------------
  it('completed 상태의 분석 결과는 스캔 대상에서 제외되고 excludedByStatus에 집계된다', async () => {
    writeProjectsConfig(impactDir, [
      { id: 'proj-new', name: 'New Project' },
      { id: 'proj-old', name: 'Old Project' },
    ]);

    writeProjectIndex(impactDir, 'proj-new', {
      screens: [{ name: 'OrderPage' }],
      apis: [{ path: '/api/orders' }],
    });

    writeAnalysisResults(impactDir, 'proj-old', [
      {
        id: 'a-active',
        specTitle: 'Active Analysis',
        status: 'active',
        keywords: ['OrderPage', '/api/orders'],
      },
      {
        id: 'a-completed',
        specTitle: 'Completed Analysis',
        status: 'completed',
        keywords: ['OrderPage', '/api/orders'],
      },
      {
        id: 'a-archived',
        specTitle: 'Archived Analysis',
        status: 'archived',
        keywords: ['OrderPage', '/api/orders'],
      },
      {
        id: 'a-on-hold',
        specTitle: 'On-Hold Analysis',
        status: 'on-hold',
        keywords: ['OrderPage', '/api/orders'],
      },
    ]);

    const scanner = new SupplementScanner(homeDir);
    const result = await scanner.scan('proj-new');

    // active만 candidates에 포함
    const activeIds = result.candidates.map(c => c.analysisId);
    expect(activeIds).toContain('a-active');
    expect(activeIds).not.toContain('a-completed');
    expect(activeIds).not.toContain('a-archived');
    expect(activeIds).not.toContain('a-on-hold');

    // excludedByStatus 집계 확인
    expect(result.excludedByStatus.completed).toBe(1);
    expect(result.excludedByStatus.archived).toBe(1);
    expect(result.excludedByStatus.onHold).toBe(1);
  });

  // ----------------------------------------------------------
  // 7. saveSupplementResult -> isSupplement, supplementOf, triggerProject
  // ----------------------------------------------------------
  it('saveSupplementResult가 보완 분석 메타데이터를 올바르게 저장한다', async () => {
    // 결과 디렉토리 사전 생성
    const resultsDir = path.join(impactDir, 'projects', 'proj-target', 'results');
    fs.mkdirSync(resultsDir, { recursive: true });
    fs.writeFileSync(path.join(resultsDir, 'index.json'), JSON.stringify([]));

    const rm = new ResultManager(homeDir);

    const supplementData = createTestResult({
      specTitle: '주문 기능 보완 분석',
      triggerProject: 'proj-trigger',
    });

    const savedPath = await rm.saveSupplementResult(
      'proj-target',
      'original-analysis-001',
      supplementData,
    );

    // 파일이 저장되었는지 확인
    expect(fs.existsSync(savedPath)).toBe(true);

    // 저장된 파일 내용 검증
    const savedContent = JSON.parse(fs.readFileSync(savedPath, 'utf-8'));
    expect(savedContent.supplementOf).toBe('original-analysis-001');
    expect(savedContent.triggerProject).toBe('proj-trigger');

    // index.json에 메타데이터 기록 확인
    const indexContent = JSON.parse(
      fs.readFileSync(path.join(resultsDir, 'index.json'), 'utf-8'),
    );
    const supplementEntry = indexContent.find(
      (s: { id: string }) => s.id === 'supplement-original-analysis-001',
    );
    expect(supplementEntry).toBeDefined();
    expect(supplementEntry.isSupplement).toBe(true);
    expect(supplementEntry.supplementOf).toBe('original-analysis-001');
    expect(supplementEntry.triggerProject).toBe('proj-trigger');
    expect(supplementEntry.status).toBe('active');
  });

  // ----------------------------------------------------------
  // 8. getSupplementResults로 보완 분석 결과만 필터링 조회
  // ----------------------------------------------------------
  it('getSupplementResults가 보완 분석 결과만 반환한다', async () => {
    const resultsDir = path.join(impactDir, 'projects', 'proj-target', 'results');
    fs.mkdirSync(resultsDir, { recursive: true });
    fs.writeFileSync(path.join(resultsDir, 'index.json'), JSON.stringify([]));

    const rm = new ResultManager(homeDir);

    // 원본 분석 저장
    const originalResult = createTestResult({
      analysisId: 'orig-001',
      specTitle: '원본 분석',
    });
    await rm.save(originalResult, 'proj-target', '원본 분석');

    // 보완 분석 저장
    const supplementResult = createTestResult({
      specTitle: '보완 분석',
      triggerProject: 'proj-trigger',
    });
    await rm.saveSupplementResult('proj-target', 'orig-001', supplementResult);

    // getSupplementResults로 보완 결과만 조회
    const supplements = await rm.getSupplementResults('proj-target', 'orig-001');
    expect(supplements).toHaveLength(1);
    expect(supplements[0].supplementOf).toBe('orig-001');

    // 존재하지 않는 원본 분석 ID로 조회 시 빈 배열
    const noResults = await rm.getSupplementResults('proj-target', 'nonexistent');
    expect(noResults).toHaveLength(0);

    // isSupplementResult 검증
    expect(rm.isSupplementResult('supplement-orig-001')).toBe(true);
    expect(rm.isSupplementResult('orig-001')).toBe(false);
  });

  // ----------------------------------------------------------
  // 9. 전체 플로우: scan -> auto 후보 식별 -> saveSupplementResult -> getSupplementResults
  // ----------------------------------------------------------
  it('전체 플로우: scan -> 후보 식별 -> 보완 결과 저장 -> 조회까지 일관성 있게 동작한다', async () => {
    // 1) 프로젝트 등록
    writeProjectsConfig(impactDir, [
      { id: 'proj-new', name: 'New Project' },
      { id: 'proj-existing', name: 'Existing Project' },
    ]);

    // 2) 신규 프로젝트 인덱스
    writeProjectIndex(impactDir, 'proj-new', {
      screens: [{ name: 'OrderPage' }, { name: 'CartPage' }],
      apis: [{ path: '/api/orders' }, { path: '/api/cart' }],
      components: [{ name: 'OrderList' }],
    });

    // 3) 기존 프로젝트의 active 분석 결과 (높은 매칭도)
    writeAnalysisResults(impactDir, 'proj-existing', [
      {
        id: 'existing-analysis-001',
        specTitle: '주문 프로세스 개선',
        status: 'active',
        keywords: ['OrderPage', 'CartPage', '/api/orders'],
      },
    ]);

    // 4) 스캔
    const scanner = new SupplementScanner(homeDir);
    const scanResult = await scanner.scan('proj-new');

    expect(scanResult.candidates.length).toBeGreaterThanOrEqual(1);
    const autoCandidate = scanResult.candidates.find(
      c => c.recommendation === 'auto',
    );
    expect(autoCandidate).toBeDefined();
    expect(autoCandidate!.projectId).toBe('proj-existing');
    expect(autoCandidate!.analysisId).toBe('existing-analysis-001');

    // 5) 보완 분석 결과 저장 (auto 후보에 대해)
    const rm = new ResultManager(homeDir);
    const supplementData = createTestResult({
      specTitle: '주문 프로세스 개선 - 보완 분석',
      triggerProject: 'proj-new',
    });

    const savedPath = await rm.saveSupplementResult(
      autoCandidate!.projectId,
      autoCandidate!.analysisId,
      supplementData,
    );
    expect(fs.existsSync(savedPath)).toBe(true);

    // 6) 보완 분석 결과 조회
    const supplements = await rm.getSupplementResults(
      autoCandidate!.projectId,
      autoCandidate!.analysisId,
    );
    expect(supplements).toHaveLength(1);
    expect(supplements[0].supplementOf).toBe('existing-analysis-001');
    expect(supplements[0].triggerProject).toBe('proj-new');

    // 7) 전체 결과 목록에서 보완 분석 인덱스 확인
    const allResults = await rm.list(autoCandidate!.projectId);
    const supplementInList = allResults.find(
      r => r.id === `supplement-${autoCandidate!.analysisId}`,
    );
    expect(supplementInList).toBeDefined();
    expect(supplementInList!.isSupplement).toBe(true);
    expect(supplementInList!.supplementOf).toBe('existing-analysis-001');
    expect(supplementInList!.triggerProject).toBe('proj-new');
  });

  // ----------------------------------------------------------
  // 10. 인덱스가 비어있는(키워드 없는) 신규 프로젝트 -> 빈 결과
  // ----------------------------------------------------------
  it('키워드가 없는 신규 프로젝트 인덱스는 빈 결과를 반환한다', async () => {
    writeProjectsConfig(impactDir, [
      { id: 'proj-empty', name: 'Empty Project' },
      { id: 'proj-existing', name: 'Existing Project' },
    ]);

    // 모든 인덱스 항목이 비어있는 프로젝트
    writeProjectIndex(impactDir, 'proj-empty', {
      screens: [],
      apis: [],
      components: [],
      models: [],
    });

    writeAnalysisResults(impactDir, 'proj-existing', [
      {
        id: 'analysis-001',
        specTitle: '기존 분석',
        status: 'active',
        keywords: ['OrderPage', '/api/orders'],
      },
    ]);

    const scanner = new SupplementScanner(homeDir);
    const result = await scanner.scan('proj-empty');

    expect(result.candidates).toHaveLength(0);
    expect(result.summary.total).toBe(0);
  });

  // ----------------------------------------------------------
  // 11. status 필드가 없는(undefined) 분석은 'active'로 간주 (Lazy Migration)
  // ----------------------------------------------------------
  it('status가 undefined인 분석 결과는 active로 간주되어 스캔 대상에 포함된다', async () => {
    writeProjectsConfig(impactDir, [
      { id: 'proj-new', name: 'New Project' },
      { id: 'proj-legacy', name: 'Legacy Project' },
    ]);

    writeProjectIndex(impactDir, 'proj-new', {
      screens: [{ name: 'OrderPage' }],
    });

    // status 필드가 없는 레거시 분석 결과
    const resultsDir = path.join(impactDir, 'projects', 'proj-legacy', 'results');
    fs.mkdirSync(resultsDir, { recursive: true });

    // index.json에 status 없이 저장
    fs.writeFileSync(
      path.join(resultsDir, 'index.json'),
      JSON.stringify([
        {
          id: 'legacy-analysis',
          specTitle: '레거시 분석',
          analyzedAt: '2024-06-01T00:00:00Z',
          totalScore: 60,
          grade: 'Medium',
          affectedScreenCount: 1,
          taskCount: 1,
          // status 필드 누락 (undefined)
        },
      ]),
    );

    // 분석 결과 파일
    const legacyResult: ConfidenceEnrichedResult = {
      analysisId: 'legacy-analysis',
      analyzedAt: '2024-06-01T00:00:00Z',
      specTitle: '레거시 분석',
      analysisMethod: 'rule-based',
      affectedScreens: [],
      tasks: [],
      planningChecks: [],
      policyChanges: [],
      screenScores: [],
      totalScore: 60,
      grade: 'Medium',
      recommendation: '',
      policyWarnings: [],
      ownerNotifications: [],
      confidenceScores: [],
      lowConfidenceWarnings: [],
      parsedSpec: {
        title: '레거시 분석',
        requirements: [],
        features: [],
        businessRules: [],
        targetScreens: [],
        keywords: ['OrderPage'],
        ambiguities: [],
      },
    };
    fs.writeFileSync(
      path.join(resultsDir, 'legacy-analysis.json'),
      JSON.stringify(legacyResult),
    );

    const scanner = new SupplementScanner(homeDir);
    const result = await scanner.scan('proj-new');

    // status undefined -> 'active'로 간주 -> candidates에 포함
    const legacyCandidate = result.candidates.find(c => c.analysisId === 'legacy-analysis');
    expect(legacyCandidate).toBeDefined();
    expect(legacyCandidate!.status).toBe('active');
  });
});
