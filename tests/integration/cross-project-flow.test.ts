/**
 * @module tests/integration/cross-project-flow
 * @description Cross-project full flow integration test (TASK-178)
 *
 * CrossProjectManager, GapDetector, ResultManager 를
 * 실제 파일 시스템 기반으로 연동하여 검증한다.
 *
 * 각 테스트는 독립적인 임시 디렉토리를 사용하며 afterEach에서 정리한다.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as child_process from 'child_process';
import { CrossProjectManager } from '@/core/cross-project/cross-project-manager';
import { GapDetector } from '@/core/cross-project/gap-detector';
import { ResultManager } from '@/core/analysis/result-manager';
import { ensureDir, writeJsonFile, readJsonFile } from '@/utils/file';
import type { ConfidenceEnrichedResult } from '@/types/analysis';
import type { CrossProjectConfig } from '@/core/cross-project/types';
import type { ProjectsConfig } from '@/types/index';

// execSync mock - git 관련 호출만 제어하기 위해
jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  execSync: jest.fn(),
}));

const mockedExecSync = child_process.execSync as jest.MockedFunction<
  typeof child_process.execSync
>;

// ============================================================
// Helper functions
// ============================================================

/** 독립적인 임시 HOME 디렉토리 + .impact 디렉토리 생성 */
function createTempHome(): { homeDir: string; impactDir: string } {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kic-integ-'));
  const impactDir = path.join(homeDir, '.impact');
  fs.mkdirSync(impactDir, { recursive: true });
  return { homeDir, impactDir };
}

/** projects.json 작성 */
function writeProjectsConfig(
  impactDir: string,
  projects: Array<{ id: string; name: string; path: string }>,
): void {
  const config: ProjectsConfig = {
    activeProject: projects[0]?.id || '',
    projects: projects.map(p => ({
      id: p.id,
      name: p.name,
      path: p.path,
      status: 'active' as const,
      createdAt: '2025-01-01T00:00:00Z',
      lastUsedAt: '2025-01-01T00:00:00Z',
      techStack: [],
    })),
  };
  writeJsonFile(path.join(impactDir, 'projects.json'), config);
}

/** cross-project.json 작성 */
function writeCrossProjectConfig(
  impactDir: string,
  links: Array<{
    id: string;
    source: string;
    target: string;
    type?: string;
    autoDetected?: boolean;
    confirmedAt?: string;
  }>,
): void {
  const config: CrossProjectConfig = {
    version: 1,
    links: links.map(l => ({
      id: l.id,
      source: l.source,
      target: l.target,
      type: (l.type || 'api-consumer') as CrossProjectConfig['links'][0]['type'],
      autoDetected: l.autoDetected ?? false,
      confirmedAt: l.confirmedAt,
    })),
    groups: [],
  };
  writeJsonFile(path.join(impactDir, 'cross-project.json'), config);
}

/** 인덱스 meta.json 작성 */
function writeIndexMeta(
  impactDir: string,
  projectId: string,
  updatedAt: string,
): void {
  const metaDir = path.join(impactDir, 'projects', projectId, 'index');
  ensureDir(metaDir);
  writeJsonFile(path.join(metaDir, 'meta.json'), {
    version: 1,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt,
    gitCommit: 'abc123',
    gitBranch: 'main',
    project: {
      name: projectId,
      path: `/test/${projectId}`,
      techStack: [],
      packageManager: 'npm',
    },
    stats: { totalFiles: 10, screens: 0, components: 0, apiEndpoints: 0, models: 0, modules: 0 },
  });
}

/** 분석 결과 index.json 작성 (ResultManager 가 읽는 형식) */
function writeResultSummaries(
  impactDir: string,
  projectId: string,
  summaries: Array<{
    id: string;
    specTitle: string;
    totalScore: number;
    status?: string;
  }>,
): void {
  const resultsDir = path.join(impactDir, 'projects', projectId, 'results');
  ensureDir(resultsDir);
  writeJsonFile(
    path.join(resultsDir, 'index.json'),
    summaries.map(s => ({
      id: s.id,
      specTitle: s.specTitle,
      analyzedAt: '2025-01-15T00:00:00Z',
      totalScore: s.totalScore,
      grade: s.totalScore >= 60 ? 'High' : 'Low',
      affectedScreenCount: 1,
      taskCount: 1,
      status: s.status,
    })),
  );
}


// ============================================================
// Tests
// ============================================================

describe('Cross-Project Integration Flow', () => {
  let homeDir: string;
  let impactDir: string;

  beforeEach(() => {
    const dirs = createTempHome();
    homeDir = dirs.homeDir;
    impactDir = dirs.impactDir;
    jest.clearAllMocks();
    // git 호출을 기본적으로 비활성화 (에러 없이 빈 문자열 반환)
    mockedExecSync.mockReturnValue('');
  });

  afterEach(() => {
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  // ----------------------------------------------------------------
  // 1. Empty state: no projects registered -> detect returns empty
  // ----------------------------------------------------------------
  it('1. 빈 프로젝트 상태에서 detect -> 빈 gaps 반환', async () => {
    // projects.json 없는 상태
    const detector = new GapDetector(homeDir);
    const result = await detector.detect();

    expect(result.gaps).toEqual([]);
    expect(result.summary.total).toBe(0);
    expect(result.summary.high).toBe(0);
    expect(result.summary.medium).toBe(0);
    expect(result.summary.low).toBe(0);
    expect(result.checkedAt).toBeDefined();
  });

  // ----------------------------------------------------------------
  // 2. Register 2 projects + create links -> cross-project.json verified
  // ----------------------------------------------------------------
  it('2. 2개 프로젝트 등록 + link -> cross-project.json 생성 확인', async () => {
    // 프로젝트 등록
    writeProjectsConfig(impactDir, [
      { id: 'frontend', name: 'Frontend App', path: '/test/frontend' },
      { id: 'backend', name: 'Backend API', path: '/test/backend' },
    ]);

    // CrossProjectManager 로 링크 생성
    const crossManager = new CrossProjectManager(impactDir);
    const link = await crossManager.link('frontend', 'backend', 'api-consumer', [
      '/api/users',
      '/api/products',
    ]);

    expect(link.id).toBe('frontend-backend');
    expect(link.source).toBe('frontend');
    expect(link.target).toBe('backend');
    expect(link.type).toBe('api-consumer');
    expect(link.apis).toEqual(['/api/users', '/api/products']);

    // cross-project.json 파일이 디스크에 생성되었는지 확인
    const configPath = path.join(impactDir, 'cross-project.json');
    expect(fs.existsSync(configPath)).toBe(true);

    const saved = readJsonFile<CrossProjectConfig>(configPath);
    expect(saved).not.toBeNull();
    expect(saved!.links).toHaveLength(1);
    expect(saved!.links[0].source).toBe('frontend');
    expect(saved!.links[0].target).toBe('backend');

    // GapDetector 로 갭 확인 - 두 프로젝트 모두 links 에 있으므로 unanalyzed 없어야 함
    // 인덱스를 confirmedAt 보다 오래되게 설정하여 stale-link 방지
    writeIndexMeta(impactDir, 'frontend', '2025-01-01T00:00:00Z');
    writeIndexMeta(impactDir, 'backend', '2025-01-01T00:00:00Z');

    const detector = new GapDetector(homeDir);
    const result = await detector.detect();

    const unanalyzed = result.gaps.filter(g => g.type === 'unanalyzed-project');
    expect(unanalyzed).toHaveLength(0);
  });

  // ----------------------------------------------------------------
  // 3. Stale-link detection: link references non-existent project
  // ----------------------------------------------------------------
  it('3. cross-project.json에 존재하지 않는 프로젝트 링크 -> stale-link 발견', async () => {
    writeProjectsConfig(impactDir, [
      { id: 'frontend', name: 'Frontend App', path: '/test/frontend' },
      // 'deleted-service' 는 등록되지 않음
    ]);

    // CrossProjectManager 를 사용하여 링크 직접 생성
    const crossManager = new CrossProjectManager(impactDir);
    await crossManager.link('frontend', 'deleted-service', 'api-consumer');

    // GapDetector 로 갭 탐지
    const detector = new GapDetector(homeDir);
    const result = await detector.detect();

    const staleLinks = result.gaps.filter(g => g.type === 'stale-link');
    expect(staleLinks.length).toBeGreaterThanOrEqual(1);

    const staleLinkForDeleted = staleLinks.find(
      g => g.projectId === 'deleted-service',
    );
    expect(staleLinkForDeleted).toBeDefined();
    expect(staleLinkForDeleted!.severity).toBe('high');
    expect(staleLinkForDeleted!.fixable).toBe(true);
    expect(staleLinkForDeleted!.detail.linkId).toBe('frontend-deleted-service');
  });

  // ----------------------------------------------------------------
  // 4. Unanalyzed project: registered project not in any links
  // ----------------------------------------------------------------
  it('4. 등록된 프로젝트에 분석 결과 없음 -> unanalyzed-project gap 발견', async () => {
    writeProjectsConfig(impactDir, [
      { id: 'frontend', name: 'Frontend', path: '/test/frontend' },
      { id: 'backend', name: 'Backend', path: '/test/backend' },
      { id: 'new-service', name: 'New Service', path: '/test/new-service' },
    ]);

    // frontend-backend 만 링크
    writeCrossProjectConfig(impactDir, [
      {
        id: 'frontend-backend',
        source: 'frontend',
        target: 'backend',
        confirmedAt: '2025-06-01T00:00:00Z',
      },
    ]);

    // 인덱스를 confirmedAt 보다 과거로 설정하여 stale-link 방지
    writeIndexMeta(impactDir, 'frontend', '2025-01-01T00:00:00Z');
    writeIndexMeta(impactDir, 'backend', '2025-01-01T00:00:00Z');

    const detector = new GapDetector(homeDir);
    const result = await detector.detect();

    const unanalyzed = result.gaps.filter(g => g.type === 'unanalyzed-project');
    expect(unanalyzed).toHaveLength(1);
    expect(unanalyzed[0].projectId).toBe('new-service');
    expect(unanalyzed[0].severity).toBe('medium');
    expect(unanalyzed[0].fixable).toBe(true);
    expect(unanalyzed[0].fixCommand).toContain('cross-analyze');
  });

  // ----------------------------------------------------------------
  // 5. Low-confidence gap: analysis result with totalScore < 60
  // ----------------------------------------------------------------
  it('5. low-confidence 결과 존재 시 -> low-confidence gap 발견', async () => {
    writeProjectsConfig(impactDir, [
      { id: 'frontend', name: 'Frontend', path: '/test/frontend' },
    ]);

    // 분석 결과 인덱스: active 상태, 점수 35
    writeResultSummaries(impactDir, 'frontend', [
      { id: 'analysis-low', specTitle: 'Low Score Spec', totalScore: 35, status: 'active' },
      { id: 'analysis-high', specTitle: 'High Score Spec', totalScore: 85, status: 'active' },
    ]);

    const detector = new GapDetector(homeDir);
    const result = await detector.detect();

    const lowConf = result.gaps.filter(g => g.type === 'low-confidence');
    expect(lowConf).toHaveLength(1);
    expect(lowConf[0].detail.analysisId).toBe('analysis-low');
    expect(lowConf[0].detail.totalScore).toBe(35);
    expect(lowConf[0].severity).toBe('medium');
    expect(lowConf[0].fixable).toBe(false);
  });

  // ----------------------------------------------------------------
  // 6. Fix stale-link: removes link from cross-project.json
  // ----------------------------------------------------------------
  it('6. fix 호출 시 stale-link 제거 확인', async () => {
    writeProjectsConfig(impactDir, [
      { id: 'frontend', name: 'Frontend', path: '/test/frontend' },
      // 'deleted-svc' 는 등록되지 않음
    ]);

    writeCrossProjectConfig(impactDir, [
      {
        id: 'frontend-deleted-svc',
        source: 'frontend',
        target: 'deleted-svc',
        confirmedAt: '2025-01-01T00:00:00Z',
      },
      {
        id: 'frontend-frontend',
        source: 'frontend',
        target: 'frontend',
        confirmedAt: '2025-06-01T00:00:00Z',
      },
    ]);

    // Step 1: detect gaps
    const detector = new GapDetector(homeDir);
    const detectResult = await detector.detect();

    const staleGaps = detectResult.gaps.filter(
      g => g.type === 'stale-link' && g.projectId === 'deleted-svc',
    );
    expect(staleGaps.length).toBeGreaterThanOrEqual(1);

    // Step 2: fix the stale-link gap
    const fixResult = await detector.fix(staleGaps);
    expect(fixResult.fixed).toBe(1);
    expect(fixResult.details[0].success).toBe(true);
    expect(fixResult.details[0].message).toContain('removed link');

    // Step 3: verify cross-project.json was updated
    const configPath = path.join(impactDir, 'cross-project.json');
    const config = readJsonFile<CrossProjectConfig>(configPath);
    expect(config).not.toBeNull();
    expect(config!.links).toHaveLength(1);
    expect(config!.links[0].id).toBe('frontend-frontend');

    // Step 4: re-detect should no longer find the stale-link for deleted-svc
    const reDetect = await detector.detect();
    const remainingStale = reDetect.gaps.filter(
      g => g.type === 'stale-link' && g.detail.linkId === 'frontend-deleted-svc',
    );
    expect(remainingStale).toHaveLength(0);
  });

  // ----------------------------------------------------------------
  // 7. Project filter: detect with specific projectId
  // ----------------------------------------------------------------
  it('7. --project 필터링: 특정 프로젝트만 갭 검사', async () => {
    writeProjectsConfig(impactDir, [
      { id: 'frontend', name: 'Frontend', path: '/test/frontend' },
      { id: 'backend', name: 'Backend', path: '/test/backend' },
      { id: 'mobile', name: 'Mobile', path: '/test/mobile' },
    ]);

    // frontend-backend 만 links 에 있음 => mobile 은 unanalyzed
    writeCrossProjectConfig(impactDir, [
      {
        id: 'frontend-backend',
        source: 'frontend',
        target: 'backend',
        confirmedAt: '2025-06-01T00:00:00Z',
      },
    ]);

    writeIndexMeta(impactDir, 'frontend', '2025-01-01T00:00:00Z');
    writeIndexMeta(impactDir, 'backend', '2025-01-01T00:00:00Z');

    // frontend 에 low-confidence 분석 추가
    writeResultSummaries(impactDir, 'frontend', [
      { id: 'analysis-fe-low', specTitle: 'FE Low', totalScore: 40, status: 'active' },
    ]);

    const detector = new GapDetector(homeDir);

    // mobile 로 필터 -> unanalyzed-project 만 나와야 함
    const mobileResult = await detector.detect({ projectId: 'mobile' });
    expect(mobileResult.gaps.length).toBeGreaterThanOrEqual(1);
    expect(mobileResult.gaps.every(g => g.projectId === 'mobile')).toBe(true);
    expect(mobileResult.gaps[0].type).toBe('unanalyzed-project');

    // frontend 로 필터 -> low-confidence 만 나와야 함
    const feResult = await detector.detect({ projectId: 'frontend' });
    expect(feResult.gaps.every(g => g.projectId === 'frontend')).toBe(true);
    const feLowConf = feResult.gaps.filter(g => g.type === 'low-confidence');
    expect(feLowConf).toHaveLength(1);
    expect(feLowConf[0].detail.analysisId).toBe('analysis-fe-low');

    // backend 로 필터 -> gap 없어야 함 (links 에 있고, 분석도 없음)
    const beResult = await detector.detect({ projectId: 'backend' });
    // backend 는 links 에 포함되므로 unanalyzed 아님, 분석 결과 없으므로 low-confidence 없음
    const beGaps = beResult.gaps.filter(g => g.projectId === 'backend');
    expect(beGaps).toHaveLength(0);
  });

  // ----------------------------------------------------------------
  // 8. Completed/archived status exclusion from gaps
  // ----------------------------------------------------------------
  it('8. completed/archived 상태 결과는 갭에서 제외 확인', async () => {
    writeProjectsConfig(impactDir, [
      { id: 'frontend', name: 'Frontend', path: '/test/frontend' },
    ]);

    // 여러 상태의 분석 결과 - 모두 점수 40 (< 60)
    writeResultSummaries(impactDir, 'frontend', [
      { id: 'a-active', specTitle: 'Active Low', totalScore: 40, status: 'active' },
      { id: 'a-completed', specTitle: 'Completed Low', totalScore: 30, status: 'completed' },
      { id: 'a-on-hold', specTitle: 'OnHold Low', totalScore: 25, status: 'on-hold' },
      { id: 'a-archived', specTitle: 'Archived Low', totalScore: 20, status: 'archived' },
    ]);

    const detector = new GapDetector(homeDir);
    const result = await detector.detect();

    // active 만 low-confidence 로 잡혀야 함
    const lowConf = result.gaps.filter(g => g.type === 'low-confidence');
    expect(lowConf).toHaveLength(1);
    expect(lowConf[0].detail.analysisId).toBe('a-active');

    // excludedCounts 확인
    expect(result.excludedCounts).toBeDefined();
    expect(result.excludedCounts!.completed).toBe(1);
    expect(result.excludedCounts!.onHold).toBe(1);
    expect(result.excludedCounts!.archived).toBe(1);
  });

  // ----------------------------------------------------------------
  // 9. End-to-end: CrossProjectManager link + GapDetector detect + fix
  // ----------------------------------------------------------------
  it('9. E2E: 링크 생성 -> 갭 탐지 -> 수정 -> 재검증 전체 플로우', async () => {
    writeProjectsConfig(impactDir, [
      { id: 'svc-a', name: 'Service A', path: '/test/svc-a' },
      { id: 'svc-b', name: 'Service B', path: '/test/svc-b' },
    ]);

    // Step 1: CrossProjectManager 로 링크 생성
    const crossManager = new CrossProjectManager(impactDir);
    await crossManager.link('svc-a', 'svc-b', 'shared-db', ['orders_table']);

    // 인덱스 설정 (confirmedAt 보다 오래되게 하여 stale-link 방지)
    writeIndexMeta(impactDir, 'svc-a', '2025-01-01T00:00:00Z');
    writeIndexMeta(impactDir, 'svc-b', '2025-01-01T00:00:00Z');

    // Step 2: 분석 결과 추가 (low-confidence)
    writeResultSummaries(impactDir, 'svc-a', [
      { id: 'analysis-a1', specTitle: 'Low Score', totalScore: 45, status: 'active' },
    ]);
    writeResultSummaries(impactDir, 'svc-b', [
      { id: 'analysis-b1', specTitle: 'High Score', totalScore: 80, status: 'active' },
    ]);

    // Step 3: GapDetector 로 갭 확인
    const detector = new GapDetector(homeDir);
    const initialResult = await detector.detect();

    // svc-a 에 low-confidence 갭이 있어야 함
    const lowConf = initialResult.gaps.filter(g => g.type === 'low-confidence');
    expect(lowConf).toHaveLength(1);
    expect(lowConf[0].projectId).toBe('svc-a');

    // unanalyzed-project 는 없어야 함 (두 프로젝트 모두 links 에 포함)
    const unanalyzed = initialResult.gaps.filter(g => g.type === 'unanalyzed-project');
    expect(unanalyzed).toHaveLength(0);

    // Step 4: 새 서비스 추가 (links 에 없는 프로젝트)
    writeProjectsConfig(impactDir, [
      { id: 'svc-a', name: 'Service A', path: '/test/svc-a' },
      { id: 'svc-b', name: 'Service B', path: '/test/svc-b' },
      { id: 'svc-c', name: 'Service C', path: '/test/svc-c' },
    ]);

    const afterAddResult = await detector.detect();
    const unanalyzedAfter = afterAddResult.gaps.filter(g => g.type === 'unanalyzed-project');
    expect(unanalyzedAfter).toHaveLength(1);
    expect(unanalyzedAfter[0].projectId).toBe('svc-c');

    // Step 5: svc-c 를 링크에 추가하면 unanalyzed 해소
    await crossManager.link('svc-a', 'svc-c', 'api-consumer');
    writeIndexMeta(impactDir, 'svc-c', '2025-01-01T00:00:00Z');

    const afterLinkResult = await detector.detect();
    const unanalyzedFinal = afterLinkResult.gaps.filter(g => g.type === 'unanalyzed-project');
    expect(unanalyzedFinal).toHaveLength(0);
  });

  // ----------------------------------------------------------------
  // 10. ResultManager + GapDetector integration: save + detect
  // ----------------------------------------------------------------
  it('10. ResultManager save -> GapDetector detect 연동', async () => {
    writeProjectsConfig(impactDir, [
      { id: 'proj-x', name: 'Project X', path: '/test/proj-x' },
    ]);

    // ResultManager 로 분석 결과 저장
    const resultManager = new ResultManager(homeDir);

    const lowScoreResult: ConfidenceEnrichedResult = {
      analysisId: 'analysis-x1',
      analyzedAt: '2025-06-01T00:00:00Z',
      specTitle: 'Low Score Feature',
      analysisMethod: 'rule-based',
      affectedScreens: [],
      tasks: [],
      planningChecks: [],
      policyChanges: [],
      screenScores: [],
      totalScore: 42,
      grade: 'Low',
      recommendation: 'Need more analysis',
      policyWarnings: [],
      ownerNotifications: [],
      confidenceScores: [],
      lowConfidenceWarnings: [],
    };

    await resultManager.save(lowScoreResult, 'proj-x', 'Low Score Feature', 'active');

    // GapDetector 로 갭 확인
    const detector = new GapDetector(homeDir);
    const result = await detector.detect();

    const lowConf = result.gaps.filter(g => g.type === 'low-confidence');
    expect(lowConf).toHaveLength(1);
    expect(lowConf[0].projectId).toBe('proj-x');
    expect(lowConf[0].detail.totalScore).toBe(42);

    // 상태를 completed 로 변경하면 갭에서 제외되어야 함
    await resultManager.updateStatus('proj-x', 'analysis-x1', 'completed');

    const afterStatusChange = await detector.detect();
    const lowConfAfter = afterStatusChange.gaps.filter(g => g.type === 'low-confidence');
    expect(lowConfAfter).toHaveLength(0);

    // excludedCounts 에 반영
    expect(afterStatusChange.excludedCounts!.completed).toBe(1);
  });

  // ----------------------------------------------------------------
  // 11. CrossProjectManager duplicate link handling
  // ----------------------------------------------------------------
  it('11. CrossProjectManager 중복 링크 생성 시 기존 링크 반환', async () => {
    const crossManager = new CrossProjectManager(impactDir);

    const link1 = await crossManager.link('a', 'b', 'api-consumer');
    const link2 = await crossManager.link('a', 'b', 'api-consumer');

    expect(link1.id).toBe(link2.id);

    const allLinks = await crossManager.getLinks();
    expect(allLinks).toHaveLength(1);
  });

  // ----------------------------------------------------------------
  // 12. GapDetector summary aggregation accuracy
  // ----------------------------------------------------------------
  it('12. GapDetector summary 집계 정확성', async () => {
    writeProjectsConfig(impactDir, [
      { id: 'svc-a', name: 'A', path: '/test/a' },
      { id: 'svc-b', name: 'B', path: '/test/b' },
      { id: 'svc-c', name: 'C', path: '/test/c' },
    ]);

    // stale-link: svc-a -> missing-svc (high, fixable)
    writeCrossProjectConfig(impactDir, [
      {
        id: 'svc-a-missing-svc',
        source: 'svc-a',
        target: 'missing-svc',
        confirmedAt: '2025-01-01T00:00:00Z',
      },
      {
        id: 'svc-a-svc-b',
        source: 'svc-a',
        target: 'svc-b',
        confirmedAt: '2025-06-01T00:00:00Z',
      },
    ]);

    writeIndexMeta(impactDir, 'svc-a', '2025-01-01T00:00:00Z');
    writeIndexMeta(impactDir, 'svc-b', '2025-01-01T00:00:00Z');

    // svc-a: low-confidence (medium, not fixable)
    writeResultSummaries(impactDir, 'svc-a', [
      { id: 'a-low', specTitle: 'Low', totalScore: 30, status: 'active' },
    ]);

    // svc-c: unanalyzed (medium, fixable)
    // stale-index: git commit newer than index
    mockedExecSync.mockReturnValue('2025-06-15 12:00:00 +0900\n');

    const detector = new GapDetector(homeDir);
    const result = await detector.detect();

    // Verify summary
    expect(result.summary.total).toBe(result.gaps.length);
    expect(result.summary.high).toBe(result.gaps.filter(g => g.severity === 'high').length);
    expect(result.summary.medium).toBe(result.gaps.filter(g => g.severity === 'medium').length);
    expect(result.summary.low).toBe(result.gaps.filter(g => g.severity === 'low').length);
    expect(result.summary.fixable).toBe(result.gaps.filter(g => g.fixable).length);

    // At least: 1 high (stale-link), 2 medium (unanalyzed + low-confidence), some low (stale-index)
    expect(result.summary.high).toBeGreaterThanOrEqual(1);
    expect(result.summary.medium).toBeGreaterThanOrEqual(2);
    expect(result.summary.low).toBeGreaterThanOrEqual(1);
  });
});
