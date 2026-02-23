/**
 * @module tests/unit/cross-project/gap-detector
 * @description GapDetector 단위 테스트 (TASK-158 + TASK-159)
 *
 * 탐지 유형:
 * 1. Stale 링크 (High): confirmedAt이 오래된 링크, 프로젝트 삭제/미존재
 * 2. 미분석 프로젝트 (Medium): links에 없는 등록 프로젝트
 * 3. 저신뢰도 분석 (Medium): totalScore < 60 (active만)
 * 4. 인덱스 미갱신 (Low): git 커밋 > 인덱스 updatedAt
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as child_process from 'child_process';
import { GapDetector } from '../../../src/core/cross-project/gap-detector';

// execSync mock
jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  execSync: jest.fn(),
}));

const mockedExecSync = child_process.execSync as jest.MockedFunction<typeof child_process.execSync>;

/**
 * 테스트용 디렉토리 구조 헬퍼
 * tmpDir을 HOME으로 사용하고, tmpDir/.impact를 impact 디렉토리로 사용
 * GapDetector(basePath)는 basePath를 HOME으로 취급하므로
 * 파일들은 tmpDir/.impact/ 하위에 생성
 */
function setupTestDir(): { homeDir: string; impactDir: string } {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kic-gap-'));
  const impactDir = path.join(homeDir, '.impact');
  fs.mkdirSync(impactDir, { recursive: true });
  return { homeDir, impactDir };
}

/**
 * projects.json 생성 헬퍼
 * impactDir/.impact 하위에 생성
 */
function writeProjectsJson(
  impactDir: string,
  projects: Array<{ id: string; name: string; path: string }>,
): void {
  const projectsPath = path.join(impactDir, 'projects.json');
  fs.writeFileSync(
    projectsPath,
    JSON.stringify({
      activeProject: projects[0]?.id || '',
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        path: p.path,
        status: 'active',
        createdAt: '2025-01-01T00:00:00Z',
        lastUsedAt: '2025-01-01T00:00:00Z',
        techStack: [],
      })),
    }),
  );
}

/**
 * cross-project.json 생성 헬퍼
 */
function writeCrossProjectJson(
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
  const configPath = path.join(impactDir, 'cross-project.json');
  fs.writeFileSync(
    configPath,
    JSON.stringify({
      version: 1,
      links: links.map(l => ({
        id: l.id,
        source: l.source,
        target: l.target,
        type: l.type || 'api-consumer',
        autoDetected: l.autoDetected ?? false,
        confirmedAt: l.confirmedAt,
      })),
      groups: [],
    }),
  );
}

/**
 * 인덱스 meta.json 생성 헬퍼
 */
function writeIndexMeta(impactDir: string, projectId: string, updatedAt: string): void {
  const metaDir = path.join(impactDir, 'projects', projectId, 'index');
  fs.mkdirSync(metaDir, { recursive: true });
  fs.writeFileSync(
    path.join(metaDir, 'meta.json'),
    JSON.stringify({
      version: 1,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt,
      gitCommit: 'abc123',
      gitBranch: 'main',
      projectPath: `/test/${projectId}`,
      totalFiles: 10,
    }),
  );
}

/**
 * 분석 결과 인덱스(index.json) 생성 헬퍼
 * ResultManager가 getProjectDir(projectId, basePath) = basePath/.impact/projects/projectId 를 사용
 * impactDir = basePath/.impact 이므로, impactDir/projects/projectId/results/index.json에 생성
 */
function writeResultIndex(
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
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(
    path.join(resultsDir, 'index.json'),
    JSON.stringify(
      summaries.map(s => ({
        id: s.id,
        specTitle: s.specTitle,
        analyzedAt: '2025-01-01T00:00:00Z',
        totalScore: s.totalScore,
        grade: s.totalScore >= 60 ? 'High' : 'Low',
        affectedScreenCount: 0,
        taskCount: 0,
        status: s.status,
      })),
    ),
  );
}

// ============================================================
// 테스트
// ============================================================

describe('GapDetector', () => {
  let homeDir: string;
  let impactDir: string;

  beforeEach(() => {
    const dirs = setupTestDir();
    homeDir = dirs.homeDir;
    impactDir = dirs.impactDir;
    jest.clearAllMocks();
    mockedExecSync.mockReturnValue('');
  });

  afterEach(() => {
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  // --------------------------------------------------------
  // 1. Stale 링크 탐지 - confirmedAt이 오래된 링크
  // --------------------------------------------------------
  it('Stale 링크 탐지 - confirmedAt이 인덱스 updatedAt보다 오래된 경우', async () => {
    writeProjectsJson(impactDir, [
      { id: 'proj-a', name: 'Project A', path: '/test/proj-a' },
      { id: 'proj-b', name: 'Project B', path: '/test/proj-b' },
    ]);

    writeCrossProjectJson(impactDir, [
      {
        id: 'proj-a-proj-b',
        source: 'proj-a',
        target: 'proj-b',
        confirmedAt: '2025-01-01T00:00:00Z', // 오래된 시각
      },
    ]);

    // 인덱스는 더 최신
    writeIndexMeta(impactDir, 'proj-a', '2025-06-01T00:00:00Z');
    writeIndexMeta(impactDir, 'proj-b', '2025-06-01T00:00:00Z');

    const detector = new GapDetector(homeDir);
    const result = await detector.detect();

    const staleLinks = result.gaps.filter(g => g.type === 'stale-link');
    expect(staleLinks.length).toBeGreaterThanOrEqual(1);
    expect(staleLinks[0].severity).toBe('high');
    expect(staleLinks[0].detail.linkId).toBe('proj-a-proj-b');
  });

  // --------------------------------------------------------
  // 2. Stale 링크 탐지 - 프로젝트가 삭제된 링크
  // --------------------------------------------------------
  it('Stale 링크 탐지 - 프로젝트가 삭제/미존재하는 경우', async () => {
    writeProjectsJson(impactDir, [
      { id: 'proj-a', name: 'Project A', path: '/test/proj-a' },
      // proj-b는 등록되지 않음 (삭제됨)
    ]);

    writeCrossProjectJson(impactDir, [
      {
        id: 'proj-a-proj-b',
        source: 'proj-a',
        target: 'proj-b', // 미등록 프로젝트
        confirmedAt: '2025-01-01T00:00:00Z',
      },
    ]);

    const detector = new GapDetector(homeDir);
    const result = await detector.detect();

    const staleLinks = result.gaps.filter(g => g.type === 'stale-link');
    expect(staleLinks.length).toBe(1);
    expect(staleLinks[0].severity).toBe('high');
    expect(staleLinks[0].projectId).toBe('proj-b');
    expect(staleLinks[0].fixable).toBe(true);
    expect(staleLinks[0].fixCommand).toContain('unlink');
  });

  // --------------------------------------------------------
  // 3. 미분석 프로젝트 탐지 - links에 없는 등록 프로젝트
  // --------------------------------------------------------
  it('미분석 프로젝트 탐지 - links에 없는 등록 프로젝트', async () => {
    writeProjectsJson(impactDir, [
      { id: 'proj-a', name: 'Project A', path: '/test/proj-a' },
      { id: 'proj-b', name: 'Project B', path: '/test/proj-b' },
      { id: 'proj-c', name: 'Project C', path: '/test/proj-c' }, // links에 없음
    ]);

    writeCrossProjectJson(impactDir, [
      {
        id: 'proj-a-proj-b',
        source: 'proj-a',
        target: 'proj-b',
        confirmedAt: '2025-06-01T00:00:00Z',
      },
    ]);

    // 인덱스가 confirmedAt보다 오래되어야 stale-link가 안 나옴
    writeIndexMeta(impactDir, 'proj-a', '2025-01-01T00:00:00Z');
    writeIndexMeta(impactDir, 'proj-b', '2025-01-01T00:00:00Z');

    const detector = new GapDetector(homeDir);
    const result = await detector.detect();

    const unanalyzed = result.gaps.filter(g => g.type === 'unanalyzed-project');
    expect(unanalyzed.length).toBe(1);
    expect(unanalyzed[0].projectId).toBe('proj-c');
    expect(unanalyzed[0].severity).toBe('medium');
    expect(unanalyzed[0].fixable).toBe(true);
  });

  // --------------------------------------------------------
  // 4. 저신뢰도 분석 탐지 - totalScore < 60 (active만)
  // --------------------------------------------------------
  it('저신뢰도 분석 탐지 - totalScore < 60인 active 분석', async () => {
    writeProjectsJson(impactDir, [
      { id: 'proj-a', name: 'Project A', path: '/test/proj-a' },
    ]);

    // 분석 결과: 하나는 score 30 (active), 하나는 score 80 (active)
    writeResultIndex(impactDir, 'proj-a', [
      { id: 'analysis-001', specTitle: 'Low Score', totalScore: 30, status: 'active' },
      { id: 'analysis-002', specTitle: 'High Score', totalScore: 80, status: 'active' },
    ]);

    const detector = new GapDetector(homeDir);
    const result = await detector.detect();

    const lowConf = result.gaps.filter(g => g.type === 'low-confidence');
    expect(lowConf.length).toBe(1);
    expect(lowConf[0].detail.analysisId).toBe('analysis-001');
    expect(lowConf[0].detail.totalScore).toBe(30);
    expect(lowConf[0].severity).toBe('medium');
    expect(lowConf[0].fixable).toBe(false);
  });

  // --------------------------------------------------------
  // 5. 저신뢰도 분석 - completed 상태 제외 확인
  // --------------------------------------------------------
  it('저신뢰도 분석 - completed/on-hold/archived 상태 제외', async () => {
    writeProjectsJson(impactDir, [
      { id: 'proj-a', name: 'Project A', path: '/test/proj-a' },
    ]);

    writeResultIndex(impactDir, 'proj-a', [
      { id: 'analysis-001', specTitle: 'Completed Low', totalScore: 30, status: 'completed' },
      { id: 'analysis-002', specTitle: 'OnHold Low', totalScore: 40, status: 'on-hold' },
      { id: 'analysis-003', specTitle: 'Archived Low', totalScore: 50, status: 'archived' },
      { id: 'analysis-004', specTitle: 'Active Low', totalScore: 45, status: 'active' },
    ]);

    const detector = new GapDetector(homeDir);
    const result = await detector.detect();

    // active인 analysis-004만 low-confidence에 포함
    const lowConf = result.gaps.filter(g => g.type === 'low-confidence');
    expect(lowConf.length).toBe(1);
    expect(lowConf[0].detail.analysisId).toBe('analysis-004');

    // excludedCounts 확인
    expect(result.excludedCounts).toBeDefined();
    expect(result.excludedCounts!.completed).toBe(1);
    expect(result.excludedCounts!.onHold).toBe(1);
    expect(result.excludedCounts!.archived).toBe(1);
  });

  // --------------------------------------------------------
  // 6. 인덱스 미갱신 탐지 - git 커밋이 인덱스보다 새로운 경우
  // --------------------------------------------------------
  it('인덱스 미갱신 탐지 - git 커밋이 인덱스보다 새로운 경우', async () => {
    writeProjectsJson(impactDir, [
      { id: 'proj-a', name: 'Project A', path: '/test/proj-a' },
    ]);

    // 인덱스: 2025-01-01
    writeIndexMeta(impactDir, 'proj-a', '2025-01-01T00:00:00Z');

    // git 커밋: 2025-06-01 (더 최신)
    mockedExecSync.mockReturnValue('2025-06-01 12:00:00 +0900\n');

    const detector = new GapDetector(homeDir);
    const result = await detector.detect();

    const staleIdx = result.gaps.filter(g => g.type === 'stale-index');
    expect(staleIdx.length).toBe(1);
    expect(staleIdx[0].severity).toBe('low');
    expect(staleIdx[0].detail.indexUpdatedAt).toBe('2025-01-01T00:00:00Z');
    expect(staleIdx[0].detail.lastGitCommit).toBe('2025-06-01 12:00:00 +0900');
    expect(staleIdx[0].fixable).toBe(true);
    expect(staleIdx[0].fixCommand).toContain('reindex');
  });

  // --------------------------------------------------------
  // 7. 인덱스 미갱신 - git 미설치 시 graceful skip
  // --------------------------------------------------------
  it('인덱스 미갱신 - git 미설치/미초기화 시 graceful skip', async () => {
    writeProjectsJson(impactDir, [
      { id: 'proj-a', name: 'Project A', path: '/test/proj-a' },
    ]);

    writeIndexMeta(impactDir, 'proj-a', '2025-01-01T00:00:00Z');

    // git 명령어 실패 시뮬레이션
    mockedExecSync.mockImplementation(() => {
      throw new Error('git not found');
    });

    const detector = new GapDetector(homeDir);
    const result = await detector.detect();

    // git 실패 시 stale-index 갭이 생성되지 않아야 함
    const staleIdx = result.gaps.filter(g => g.type === 'stale-index');
    expect(staleIdx.length).toBe(0);
  });

  // --------------------------------------------------------
  // 8. projectId 필터 동작 확인
  // --------------------------------------------------------
  it('projectId 필터 동작 확인', async () => {
    writeProjectsJson(impactDir, [
      { id: 'proj-a', name: 'Project A', path: '/test/proj-a' },
      { id: 'proj-b', name: 'Project B', path: '/test/proj-b' },
      { id: 'proj-c', name: 'Project C', path: '/test/proj-c' },
    ]);

    // proj-a, proj-b는 links에 있고, proj-c는 없음 (unanalyzed)
    writeCrossProjectJson(impactDir, [
      {
        id: 'proj-a-proj-b',
        source: 'proj-a',
        target: 'proj-b',
        confirmedAt: '2025-06-01T00:00:00Z',
      },
    ]);

    writeIndexMeta(impactDir, 'proj-a', '2025-01-01T00:00:00Z');
    writeIndexMeta(impactDir, 'proj-b', '2025-01-01T00:00:00Z');

    // 저신뢰도 분석 추가
    writeResultIndex(impactDir, 'proj-a', [
      { id: 'analysis-001', specTitle: 'Low Score', totalScore: 30, status: 'active' },
    ]);

    const detector = new GapDetector(homeDir);

    // proj-c로 필터 -> unanalyzed만 나옴
    const resultC = await detector.detect({ projectId: 'proj-c' });
    expect(resultC.gaps.every(g => g.projectId === 'proj-c')).toBe(true);
    expect(resultC.gaps.length).toBeGreaterThanOrEqual(1);

    // proj-a로 필터 -> low-confidence만 나옴
    const resultA = await detector.detect({ projectId: 'proj-a' });
    expect(resultA.gaps.every(g => g.projectId === 'proj-a')).toBe(true);
    const lowConf = resultA.gaps.filter(g => g.type === 'low-confidence');
    expect(lowConf.length).toBe(1);
  });

  // --------------------------------------------------------
  // 9. 모든 유형이 정상일 때 빈 결과 반환
  // --------------------------------------------------------
  it('모든 유형이 정상일 때 빈 결과 반환', async () => {
    writeProjectsJson(impactDir, [
      { id: 'proj-a', name: 'Project A', path: '/test/proj-a' },
      { id: 'proj-b', name: 'Project B', path: '/test/proj-b' },
    ]);

    // 모든 프로젝트가 links에 포함
    writeCrossProjectJson(impactDir, [
      {
        id: 'proj-a-proj-b',
        source: 'proj-a',
        target: 'proj-b',
        confirmedAt: '2025-06-01T00:00:00Z', // 인덱스보다 최신
      },
    ]);

    // 인덱스: confirmedAt보다 오래됨 -> stale link 아님
    writeIndexMeta(impactDir, 'proj-a', '2025-01-01T00:00:00Z');
    writeIndexMeta(impactDir, 'proj-b', '2025-01-01T00:00:00Z');

    // 분석 점수가 60 이상
    writeResultIndex(impactDir, 'proj-a', [
      { id: 'analysis-001', specTitle: 'Good Score', totalScore: 80, status: 'active' },
    ]);
    writeResultIndex(impactDir, 'proj-b', [
      { id: 'analysis-002', specTitle: 'Good Score', totalScore: 75, status: 'active' },
    ]);

    // git 커밋이 인덱스보다 오래됨
    mockedExecSync.mockReturnValue('2024-06-01 12:00:00 +0900\n');

    const detector = new GapDetector(homeDir);
    const result = await detector.detect();

    expect(result.gaps.length).toBe(0);
    expect(result.summary.total).toBe(0);
  });

  // --------------------------------------------------------
  // 10. summary 집계 정확성 (high/medium/low/fixable)
  // --------------------------------------------------------
  it('summary 집계 정확성', async () => {
    writeProjectsJson(impactDir, [
      { id: 'proj-a', name: 'Project A', path: '/test/proj-a' },
      { id: 'proj-b', name: 'Project B', path: '/test/proj-b' },
      { id: 'proj-c', name: 'Project C', path: '/test/proj-c' },
    ]);

    // Stale link (high, fixable) - 프로젝트 삭제됨 (proj-x 미존재)
    writeCrossProjectJson(impactDir, [
      {
        id: 'proj-a-proj-x',
        source: 'proj-a',
        target: 'proj-x', // 미존재
        confirmedAt: '2025-01-01T00:00:00Z',
      },
      {
        id: 'proj-a-proj-b',
        source: 'proj-a',
        target: 'proj-b',
        confirmedAt: '2025-06-01T00:00:00Z',
      },
    ]);

    writeIndexMeta(impactDir, 'proj-a', '2025-01-01T00:00:00Z');
    writeIndexMeta(impactDir, 'proj-b', '2025-01-01T00:00:00Z');

    // proj-c: unanalyzed (medium, fixable)
    // proj-a: low-confidence (medium, not fixable)
    writeResultIndex(impactDir, 'proj-a', [
      { id: 'analysis-001', specTitle: 'Low', totalScore: 30, status: 'active' },
    ]);

    // stale-index (low, fixable)
    mockedExecSync.mockReturnValue('2025-06-01 12:00:00 +0900\n');

    const detector = new GapDetector(homeDir);
    const result = await detector.detect();

    // high: stale-link(proj-x 미존재) >= 1
    expect(result.summary.high).toBeGreaterThanOrEqual(1);
    // medium: unanalyzed(proj-c) + low-confidence(proj-a) >= 2
    expect(result.summary.medium).toBeGreaterThanOrEqual(2);
    // low: stale-index >= 1 (proj-a 또는 proj-b)
    expect(result.summary.low).toBeGreaterThanOrEqual(1);
    // total = sum
    expect(result.summary.total).toBe(
      result.summary.high + result.summary.medium + result.summary.low,
    );
    // fixable = stale-link + unanalyzed + stale-index (low-confidence는 fixable=false)
    expect(result.summary.fixable).toBe(
      result.gaps.filter(g => g.fixable).length,
    );
  });

  // --------------------------------------------------------
  // 11. excludedCounts 집계 정확성
  // --------------------------------------------------------
  it('excludedCounts 집계 정확성', async () => {
    writeProjectsJson(impactDir, [
      { id: 'proj-a', name: 'Project A', path: '/test/proj-a' },
      { id: 'proj-b', name: 'Project B', path: '/test/proj-b' },
    ]);

    writeCrossProjectJson(impactDir, [
      {
        id: 'proj-a-proj-b',
        source: 'proj-a',
        target: 'proj-b',
        confirmedAt: '2025-06-01T00:00:00Z',
      },
    ]);

    writeIndexMeta(impactDir, 'proj-a', '2025-01-01T00:00:00Z');
    writeIndexMeta(impactDir, 'proj-b', '2025-01-01T00:00:00Z');

    // proj-a: completed(score 30) + on-hold(score 40) + archived(score 20) + active(score 50)
    writeResultIndex(impactDir, 'proj-a', [
      { id: 'a1', specTitle: 'Completed', totalScore: 30, status: 'completed' },
      { id: 'a2', specTitle: 'OnHold', totalScore: 40, status: 'on-hold' },
      { id: 'a3', specTitle: 'Archived', totalScore: 20, status: 'archived' },
      { id: 'a4', specTitle: 'Active', totalScore: 50, status: 'active' },
    ]);

    // proj-b: completed(score 55) + active(score 70) (70 >= 60이므로 gap 아님)
    writeResultIndex(impactDir, 'proj-b', [
      { id: 'b1', specTitle: 'Completed', totalScore: 55, status: 'completed' },
      { id: 'b2', specTitle: 'Active Good', totalScore: 70, status: 'active' },
    ]);

    const detector = new GapDetector(homeDir);
    const result = await detector.detect();

    expect(result.excludedCounts).toBeDefined();
    // completed: proj-a(a1=30 < 60) + proj-b(b1=55 < 60) = 2
    expect(result.excludedCounts!.completed).toBe(2);
    // onHold: proj-a(a2=40 < 60) = 1
    expect(result.excludedCounts!.onHold).toBe(1);
    // archived: proj-a(a3=20 < 60) = 1
    expect(result.excludedCounts!.archived).toBe(1);

    // active low-confidence: proj-a(a4=50 < 60) = 1
    const lowConf = result.gaps.filter(g => g.type === 'low-confidence');
    expect(lowConf.length).toBe(1);
    expect(lowConf[0].detail.analysisId).toBe('a4');
  });

  // --------------------------------------------------------
  // 추가: 등록 프로젝트가 0개인 경우 빈 결과 반환
  // --------------------------------------------------------
  it('등록 프로젝트가 0개인 경우 빈 결과 반환', async () => {
    // projects.json이 없는 경우
    const detector = new GapDetector(homeDir);
    const result = await detector.detect();

    expect(result.gaps.length).toBe(0);
    expect(result.summary.total).toBe(0);
    expect(result.checkedAt).toBeDefined();
  });

  // --------------------------------------------------------
  // 추가: cross-project.json이 없는 경우 빈 links로 동작
  // --------------------------------------------------------
  it('cross-project.json이 없는 경우 빈 links로 동작', async () => {
    writeProjectsJson(impactDir, [
      { id: 'proj-a', name: 'Project A', path: '/test/proj-a' },
    ]);

    // cross-project.json 없음 -> links 빈 배열
    const detector = new GapDetector(homeDir);
    const result = await detector.detect();

    // links가 비어있으므로 모든 프로젝트가 unanalyzed
    const unanalyzed = result.gaps.filter(g => g.type === 'unanalyzed-project');
    expect(unanalyzed.length).toBe(1);
    expect(unanalyzed[0].projectId).toBe('proj-a');
  });

  // --------------------------------------------------------
  // 추가: fix() - 프로젝트 삭제로 인한 stale-link 수정
  // --------------------------------------------------------
  it('fix() - 프로젝트 삭제로 인한 stale-link를 cross-project.json에서 제거', async () => {
    writeProjectsJson(impactDir, [
      { id: 'proj-a', name: 'Project A', path: '/test/proj-a' },
      // proj-x는 등록되지 않음 (삭제됨)
    ]);

    writeCrossProjectJson(impactDir, [
      {
        id: 'proj-a-proj-x',
        source: 'proj-a',
        target: 'proj-x',
        confirmedAt: '2025-01-01T00:00:00Z',
      },
      {
        id: 'proj-a-proj-a',
        source: 'proj-a',
        target: 'proj-a',
        confirmedAt: '2025-06-01T00:00:00Z',
      },
    ]);

    const detector = new GapDetector(homeDir);
    const staleGap = {
      type: 'stale-link' as const,
      severity: 'high' as const,
      projectId: 'proj-x',
      description: 'test stale link',
      detail: {
        linkId: 'proj-a-proj-x',
        sourceProject: 'proj-a',
        targetProject: 'proj-x',
      },
      fixable: true,
      fixCommand: 'cross-analyze unlink proj-a proj-x',
    };

    const fixResult = await detector.fix([staleGap]);
    expect(fixResult.fixed).toBe(1);
    expect(fixResult.failed).toBe(0);
    expect(fixResult.details[0].success).toBe(true);
    expect(fixResult.details[0].message).toContain('removed link');

    // cross-project.json에서 링크가 제거되었는지 확인
    const configPath = path.join(impactDir, 'cross-project.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.links.length).toBe(1);
    expect(config.links[0].id).toBe('proj-a-proj-a');
  });

  // --------------------------------------------------------
  // 추가: fix() - 오래된 confirmedAt stale-link는 안내 메시지 반환
  // --------------------------------------------------------
  it('fix() - 오래된 confirmedAt stale-link는 안내 메시지 반환', async () => {
    writeProjectsJson(impactDir, [
      { id: 'proj-a', name: 'Project A', path: '/test/proj-a' },
      { id: 'proj-b', name: 'Project B', path: '/test/proj-b' },
    ]);

    writeCrossProjectJson(impactDir, [
      {
        id: 'proj-a-proj-b',
        source: 'proj-a',
        target: 'proj-b',
        confirmedAt: '2025-01-01T00:00:00Z',
      },
    ]);

    const detector = new GapDetector(homeDir);
    const staleGap = {
      type: 'stale-link' as const,
      severity: 'high' as const,
      projectId: 'proj-a',
      description: 'test stale confirmedAt',
      detail: {
        linkId: 'proj-a-proj-b',
        sourceProject: 'proj-a',
        targetProject: 'proj-b',
        confirmedAt: '2025-01-01T00:00:00Z',
      },
      fixable: true,
      fixCommand: 'cross-analyze --auto',
    };

    const fixResult = await detector.fix([staleGap]);
    // 프로젝트가 존재하므로 삭제가 아닌 안내 메시지
    expect(fixResult.fixed).toBe(0);
    expect(fixResult.failed).toBe(1);
    expect(fixResult.details[0].message).toContain('cross-analyze');
  });

  // --------------------------------------------------------
  // 추가: fix() - stale-index 갭은 안내 메시지 반환
  // --------------------------------------------------------
  it('fix() - stale-index 갭은 reindex 안내 메시지 반환', async () => {
    const detector = new GapDetector(homeDir);
    const staleIndexGap = {
      type: 'stale-index' as const,
      severity: 'low' as const,
      projectId: 'proj-a',
      description: 'test stale index',
      detail: { indexUpdatedAt: '2025-01-01', lastGitCommit: '2025-06-01' },
      fixable: true,
      fixCommand: 'reindex --project proj-a',
    };

    const fixResult = await detector.fix([staleIndexGap]);
    expect(fixResult.fixed).toBe(0);
    expect(fixResult.failed).toBe(1);
    expect(fixResult.details[0].message).toContain('reindex');
    expect(fixResult.details[0].message).toContain('proj-a');
  });

  // --------------------------------------------------------
  // 추가: fix() - unfixable 갭은 skip
  // --------------------------------------------------------
  it('fix() - fixable=false 갭은 skip', async () => {
    const detector = new GapDetector(homeDir);
    const unfixableGap = {
      type: 'low-confidence' as const,
      severity: 'medium' as const,
      projectId: 'proj-a',
      description: 'test low confidence',
      detail: { analysisId: 'a1', totalScore: 30 },
      fixable: false,
    };

    const fixResult = await detector.fix([unfixableGap]);
    expect(fixResult.fixed).toBe(0);
    expect(fixResult.failed).toBe(1);
    expect(fixResult.details[0].message).toContain('not fixable');
  });

  // --------------------------------------------------------
  // 추가: fix() - unanalyzed-project 갭은 안내 메시지 반환
  // --------------------------------------------------------
  it('fix() - unanalyzed-project 갭은 cross-analyze 안내 메시지 반환', async () => {
    const detector = new GapDetector(homeDir);
    const unanalyzedGap = {
      type: 'unanalyzed-project' as const,
      severity: 'medium' as const,
      projectId: 'proj-c',
      description: 'test unanalyzed',
      detail: {},
      fixable: true,
      fixCommand: 'cross-analyze --auto',
    };

    const fixResult = await detector.fix([unanalyzedGap]);
    expect(fixResult.fixed).toBe(0);
    expect(fixResult.failed).toBe(1);
    expect(fixResult.details[0].message).toContain('cross-analyze');
    expect(fixResult.details[0].message).toContain('proj-c');
  });
});
