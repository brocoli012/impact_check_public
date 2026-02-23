/**
 * @module tests/integration/status-flow
 * @description AnalysisStatus 전체 라이프사이클 통합테스트
 *
 * 검증 대상:
 * - isAnalysisStatus 런타임 타입 가드
 * - getEffectiveStatus lazy migration
 * - VALID_TRANSITIONS 상태 전환 규칙
 * - ResultManager.updateStatus 파일 시스템 연동
 */

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import {
  AnalysisStatus,
  isAnalysisStatus,
  getEffectiveStatus,
  isValidTransition,
  VALID_TRANSITIONS,
  getTransitionError,
} from '@/utils/analysis-status';
import { ResultManager, ResultSummary } from '@/core/analysis/result-manager';
import { ConfidenceEnrichedResult } from '@/types/analysis';
import { ensureDir, writeJsonFile, readJsonFile } from '@/utils/file';

/** 각 테스트마다 독립 임시 디렉토리 */
let tmpDir: string;

/** 테스트용 프로젝트 ID */
const PROJECT_ID = 'status-flow-test';

/** 최소한의 ConfidenceEnrichedResult 테스트 픽스처 */
function createTestResult(id: string, title: string): ConfidenceEnrichedResult {
  const now = new Date().toISOString();
  return {
    analysisId: id,
    analyzedAt: now,
    specTitle: title,
    analysisMethod: 'rule-based',
    affectedScreens: [
      {
        screenId: 'scr-1',
        screenName: '테스트 화면',
        impactLevel: 'medium',
        tasks: [],
      },
    ],
    tasks: [
      {
        id: 'T-001',
        title: '테스트 작업',
        type: 'FE',
        actionType: 'modify',
        description: '테스트용 작업',
        affectedFiles: ['src/test.ts'],
        relatedApis: [],
        planningChecks: [],
        rationale: '테스트',
      },
    ],
    planningChecks: [],
    policyChanges: [],
    screenScores: [],
    totalScore: 5.0,
    grade: 'Medium',
    recommendation: '테스트 권장사항',
    policyWarnings: [],
    ownerNotifications: [],
    confidenceScores: [],
    lowConfidenceWarnings: [],
  };
}

/** projects.json 생성 (findByAnalysisId에 필요) */
function createProjectsJson(basePath: string, projectId: string): void {
  const projectsPath = path.join(basePath, '.impact', 'projects.json');
  ensureDir(path.dirname(projectsPath));
  writeJsonFile(projectsPath, {
    activeProject: projectId,
    projects: [
      {
        id: projectId,
        name: 'Status Flow Test Project',
        path: '/tmp/test-project',
        status: 'active',
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        techStack: ['typescript'],
      },
    ],
  });
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kic-status-flow-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================
// 1. isAnalysisStatus - 유효 값 확인
// ============================================================
describe('isAnalysisStatus 타입 가드', () => {
  test('4개 유효 상태 값을 true로 판별', () => {
    const validStatuses: AnalysisStatus[] = ['active', 'completed', 'on-hold', 'archived'];
    for (const status of validStatuses) {
      expect(isAnalysisStatus(status)).toBe(true);
    }
  });

  // ============================================================
  // 2. isAnalysisStatus - 잘못된 값 거부
  // ============================================================
  test('잘못된 값을 false로 거부', () => {
    const invalidValues: unknown[] = [
      'deleted',
      'pending',
      'inactive',
      '',
      ' ',
      123,
      null,
      undefined,
      true,
      {},
      [],
      'Active',     // 대소문자
      'ARCHIVED',   // 대문자
    ];
    for (const value of invalidValues) {
      expect(isAnalysisStatus(value)).toBe(false);
    }
  });
});

// ============================================================
// 3-4. getEffectiveStatus lazy migration
// ============================================================
describe('getEffectiveStatus lazy migration', () => {
  test('status 필드 없는(undefined) 경우 active 반환', () => {
    expect(getEffectiveStatus(undefined)).toBe('active');
  });

  test('status 있는 경우 해당 status 그대로 반환', () => {
    const statuses: AnalysisStatus[] = ['active', 'completed', 'on-hold', 'archived'];
    for (const status of statuses) {
      expect(getEffectiveStatus(status)).toBe(status);
    }
  });
});

// ============================================================
// 5-10. 상태 전환 규칙 (VALID_TRANSITIONS)
// ============================================================
describe('상태 전환 규칙', () => {
  // 5. active → completed
  test('active → completed 전환 성공', () => {
    expect(isValidTransition('active', 'completed')).toBe(true);
  });

  // 6. active → on-hold
  test('active → on-hold 전환 성공', () => {
    expect(isValidTransition('active', 'on-hold')).toBe(true);
  });

  // 7. active → archived
  test('active → archived 전환 성공', () => {
    expect(isValidTransition('active', 'archived')).toBe(true);
  });

  // 8. completed → archived 전환 성공 (completed에서 가능한 유일한 전환)
  test('completed → archived 전환 성공', () => {
    expect(isValidTransition('completed', 'archived')).toBe(true);
  });

  // 9. archived → active 전환 불가 (archived는 전환 불가)
  test('archived → active 전환 실패', () => {
    expect(isValidTransition('archived', 'active')).toBe(false);
  });

  // 10. on-hold → completed 직접 전환 불가 (on-hold는 active, archived만 가능)
  test('on-hold → completed 직접 전환 실패', () => {
    expect(isValidTransition('on-hold', 'completed')).toBe(false);
    // on-hold에서 가능한 전환만 확인
    expect(VALID_TRANSITIONS['on-hold']).toEqual(['active', 'archived']);
  });

  // 추가: completed → active 전환 불가 (완료된 분석 재활성화 불가)
  test('completed → active 재활성화 불가', () => {
    expect(isValidTransition('completed', 'active')).toBe(false);
  });

  // 추가: archived에서 어떤 상태로든 전환 불가
  test('archived → 모든 상태 전환 불가', () => {
    expect(VALID_TRANSITIONS['archived']).toEqual([]);
    expect(isValidTransition('archived', 'active')).toBe(false);
    expect(isValidTransition('archived', 'completed')).toBe(false);
    expect(isValidTransition('archived', 'on-hold')).toBe(false);
  });
});

// ============================================================
// getTransitionError 에러 메시지
// ============================================================
describe('getTransitionError 에러 메시지', () => {
  test('archived 상태에서 전환 시 폐기 메시지', () => {
    const msg = getTransitionError('archived', 'active');
    expect(msg).toContain('폐기');
  });

  test('completed → active 전환 시 보완 분석 안내', () => {
    const msg = getTransitionError('completed', 'active');
    expect(msg).toContain('재활성화');
    expect(msg).toContain('보완 분석');
  });

  test('일반 전환 불가 시 전환 메시지', () => {
    const msg = getTransitionError('on-hold', 'completed');
    expect(msg).toContain('전환');
  });
});

// ============================================================
// 11-12. ResultManager 통합 (파일 시스템)
// ============================================================
describe('ResultManager.updateStatus 통합', () => {
  let rm: ResultManager;

  beforeEach(async () => {
    rm = new ResultManager(tmpDir);
    createProjectsJson(tmpDir, PROJECT_ID);

    // 테스트 결과 저장 (active 상태로 시작)
    const result = createTestResult('analysis-001', '상태 전환 테스트 기획서');
    await rm.save(result, PROJECT_ID, '상태 전환 테스트 기획서');
  });

  // 11. updateStatus 후 파일에 status, statusChangedAt 기록 확인
  test('updateStatus 후 인덱스에 status와 statusChangedAt 기록', async () => {
    const beforeUpdate = Date.now();

    const updated = await rm.updateStatus(PROJECT_ID, 'analysis-001', 'completed');

    expect(updated.status).toBe('completed');
    expect(updated.statusChangedAt).toBeDefined();

    // statusChangedAt이 현재 시각 근처인지 확인
    const changedAt = new Date(updated.statusChangedAt!).getTime();
    expect(changedAt).toBeGreaterThanOrEqual(beforeUpdate);
    expect(changedAt).toBeLessThanOrEqual(Date.now());

    // 파일에서 직접 읽어서 확인
    const indexPath = path.join(
      tmpDir,
      '.impact',
      'projects',
      PROJECT_ID,
      'results',
      'index.json',
    );
    const summaries = readJsonFile<ResultSummary[]>(indexPath);
    expect(summaries).not.toBeNull();
    expect(summaries!.length).toBe(1);
    expect(summaries![0].status).toBe('completed');
    expect(summaries![0].statusChangedAt).toBeDefined();
  });

  // 12. 존재하지 않는 analysisId → updateStatus → 에러
  test('존재하지 않는 analysisId로 updateStatus 시 에러', async () => {
    await expect(
      rm.updateStatus(PROJECT_ID, 'nonexistent-id', 'completed'),
    ).rejects.toThrow('찾을 수 없습니다');
  });

  // 추가: 유효하지 않은 전환 시 에러 throw
  test('유효하지 않은 상태 전환 시 에러', async () => {
    // active → completed 로 먼저 전환
    await rm.updateStatus(PROJECT_ID, 'analysis-001', 'completed');

    // completed → active 시도 (불가)
    await expect(
      rm.updateStatus(PROJECT_ID, 'analysis-001', 'active'),
    ).rejects.toThrow();
  });

  // 추가: 연속 전환 (active → completed → archived)
  test('연속 상태 전환: active → completed → archived', async () => {
    const step1 = await rm.updateStatus(PROJECT_ID, 'analysis-001', 'completed');
    expect(step1.status).toBe('completed');

    const step2 = await rm.updateStatus(PROJECT_ID, 'analysis-001', 'archived');
    expect(step2.status).toBe('archived');

    // archived에서 더 이상 전환 불가
    await expect(
      rm.updateStatus(PROJECT_ID, 'analysis-001', 'active'),
    ).rejects.toThrow('폐기');
  });

  // 추가: active → on-hold → active 왕복 전환
  test('on-hold 왕복 전환: active → on-hold → active', async () => {
    const step1 = await rm.updateStatus(PROJECT_ID, 'analysis-001', 'on-hold');
    expect(step1.status).toBe('on-hold');

    const step2 = await rm.updateStatus(PROJECT_ID, 'analysis-001', 'active');
    expect(step2.status).toBe('active');
  });

  // 추가: lazy migration - status 없이 저장된 결과에 대한 updateStatus
  test('status 없는 레거시 결과를 active로 간주하여 전환', async () => {
    // 인덱스 파일에서 status 필드를 직접 제거
    const indexPath = path.join(
      tmpDir,
      '.impact',
      'projects',
      PROJECT_ID,
      'results',
      'index.json',
    );
    const summaries = readJsonFile<ResultSummary[]>(indexPath);
    expect(summaries).not.toBeNull();
    // status 필드 제거 (레거시 데이터 시뮬레이션)
    delete (summaries![0] as any).status;
    writeJsonFile(indexPath, summaries);

    // status 없으면 active로 간주 → completed 전환 가능
    const updated = await rm.updateStatus(PROJECT_ID, 'analysis-001', 'completed');
    expect(updated.status).toBe('completed');
  });
});

// ============================================================
// findByAnalysisId 통합
// ============================================================
describe('ResultManager.findByAnalysisId 통합', () => {
  let rm: ResultManager;

  beforeEach(async () => {
    rm = new ResultManager(tmpDir);
    createProjectsJson(tmpDir, PROJECT_ID);

    const result = createTestResult('analysis-find-001', 'findByAnalysisId 테스트');
    await rm.save(result, PROJECT_ID, 'findByAnalysisId 테스트');
  });

  test('존재하는 analysisId로 조회 성공', async () => {
    const found = await rm.findByAnalysisId('analysis-find-001');
    expect(found).not.toBeNull();
    expect(found!.projectId).toBe(PROJECT_ID);
    expect(found!.summary.id).toBe('analysis-find-001');
  });

  test('존재하지 않는 analysisId로 조회 시 null', async () => {
    const found = await rm.findByAnalysisId('nonexistent');
    expect(found).toBeNull();
  });
});
