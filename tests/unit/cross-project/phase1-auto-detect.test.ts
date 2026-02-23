/**
 * @module tests/unit/cross-project/phase1-auto-detect
 * @description Phase 1 크로스 프로젝트 자동 탐지 테스트
 *
 * TASK-053: save-result 후처리 hook
 * TASK-054: cross-analyze --auto 옵션
 * TASK-055: init 후 자동 탐지 제안
 * TASK-056: 자동 탐지 결과 저장 구조
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// ============================================================
// TASK-053: save-result 후처리 hook 테스트
// ============================================================

describe('TASK-053: save-result post-processing hook', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kic-task053-'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('save-result 성공 후 detectAndSave() 호출 확인', async () => {
    // SaveResultCommand를 직접 테스트하기 어려우므로
    // runCrossProjectHook의 동작 원리를 검증하는 통합적 접근

    // projects.json에 2개 이상의 프로젝트가 있을 때 hook이 실행되는지 확인
    const { SaveResultCommand } = await import('../../../src/commands/save-result');
    const { ResultManager } = await import('../../../src/core/analysis/result-manager');
    const { CrossProjectManager } = await import('../../../src/core/cross-project/cross-project-manager');
    const { ConfigManager } = await import('../../../src/config/config-manager');

    // Mock
    jest.spyOn(ResultManager.prototype, 'save').mockResolvedValue('test-id');
    jest.spyOn(ResultManager.prototype, 'updateCrossProjectDetection').mockResolvedValue();
    jest.spyOn(ConfigManager.prototype, 'load').mockResolvedValue(undefined);
    jest.spyOn(ConfigManager.prototype, 'getActiveProject').mockReturnValue('test-project');

    const detectAndSaveSpy = jest.spyOn(CrossProjectManager.prototype, 'detectAndSave')
      .mockResolvedValue({ detected: 3, saved: 2, total: 5, byType: { 'api-consumer': 2 } });

    // projects.json 생성 (2개 프로젝트)
    const impactDir = path.join(os.homedir(), '.impact');
    const projectsPath = path.join(impactDir, 'projects.json');
    const originalContent = fs.existsSync(projectsPath)
      ? fs.readFileSync(projectsPath, 'utf-8')
      : null;

    try {
      if (!fs.existsSync(impactDir)) fs.mkdirSync(impactDir, { recursive: true });
      fs.writeFileSync(projectsPath, JSON.stringify({
        activeProject: 'project-a',
        projects: [
          { id: 'project-a', name: 'A', path: '/a', status: 'active', createdAt: '', lastUsedAt: '', techStack: [] },
          { id: 'project-b', name: 'B', path: '/b', status: 'active', createdAt: '', lastUsedAt: '', techStack: [] },
        ],
      }));

      // 유효한 분석 결과 파일 생성
      const resultPath = path.join(tmpDir, 'result.json');
      fs.writeFileSync(resultPath, JSON.stringify({
        analysisId: 'test-analysis',
        analyzedAt: '2025-01-01T00:00:00Z',
        specTitle: 'Test',
        analysisMethod: 'rule-based',
        affectedScreens: [],
        tasks: [],
        planningChecks: [],
        policyChanges: [],
        screenScores: [],
        totalScore: 10,
        grade: 'Low',
        recommendation: 'test',
        policyWarnings: [],
        ownerNotifications: [],
        confidenceScores: [],
        lowConfidenceWarnings: [],
      }));

      const cmd = new SaveResultCommand(['--file', resultPath, '--project', 'project-a']);
      const result = await cmd.execute();

      expect(result.code).toBe('SUCCESS');
      expect(detectAndSaveSpy).toHaveBeenCalled();
    } finally {
      // 원래 파일 복원
      if (originalContent !== null) {
        fs.writeFileSync(projectsPath, originalContent);
      }
    }
  });

  it('--skip-cross-detect 시 hook 미실행', async () => {
    const { SaveResultCommand } = await import('../../../src/commands/save-result');
    const { ResultManager } = await import('../../../src/core/analysis/result-manager');
    const { CrossProjectManager } = await import('../../../src/core/cross-project/cross-project-manager');

    jest.spyOn(ResultManager.prototype, 'save').mockResolvedValue('test-id');
    const detectAndSaveSpy = jest.spyOn(CrossProjectManager.prototype, 'detectAndSave');

    const resultPath = path.join(tmpDir, 'result.json');
    fs.writeFileSync(resultPath, JSON.stringify({
      analysisId: 'test-analysis',
      analyzedAt: '2025-01-01T00:00:00Z',
      specTitle: 'Test',
      analysisMethod: 'rule-based',
      affectedScreens: [],
      tasks: [],
      planningChecks: [],
      policyChanges: [],
      screenScores: [],
      totalScore: 10,
      grade: 'Low',
      recommendation: 'test',
      policyWarnings: [],
      ownerNotifications: [],
      confidenceScores: [],
      lowConfidenceWarnings: [],
    }));

    const cmd = new SaveResultCommand(['--file', resultPath, '--project', 'test-project', '--skip-cross-detect']);
    const result = await cmd.execute();

    expect(result.code).toBe('SUCCESS');
    expect(detectAndSaveSpy).not.toHaveBeenCalled();
  });

  it('detectAndSave 실패 시 save-result 성공 유지', async () => {
    const { SaveResultCommand } = await import('../../../src/commands/save-result');
    const { ResultManager } = await import('../../../src/core/analysis/result-manager');
    const { CrossProjectManager } = await import('../../../src/core/cross-project/cross-project-manager');
    const { ConfigManager } = await import('../../../src/config/config-manager');

    jest.spyOn(ResultManager.prototype, 'save').mockResolvedValue('test-id');
    jest.spyOn(ConfigManager.prototype, 'load').mockResolvedValue(undefined);
    jest.spyOn(ConfigManager.prototype, 'getActiveProject').mockReturnValue('project-a');

    // detectAndSave가 에러를 던지도록 mock
    jest.spyOn(CrossProjectManager.prototype, 'detectAndSave')
      .mockRejectedValue(new Error('cross-project failed'));

    const impactDir = path.join(os.homedir(), '.impact');
    const projectsPath = path.join(impactDir, 'projects.json');
    const originalContent = fs.existsSync(projectsPath)
      ? fs.readFileSync(projectsPath, 'utf-8')
      : null;

    try {
      if (!fs.existsSync(impactDir)) fs.mkdirSync(impactDir, { recursive: true });
      fs.writeFileSync(projectsPath, JSON.stringify({
        activeProject: 'project-a',
        projects: [
          { id: 'project-a', name: 'A', path: '/a', status: 'active', createdAt: '', lastUsedAt: '', techStack: [] },
          { id: 'project-b', name: 'B', path: '/b', status: 'active', createdAt: '', lastUsedAt: '', techStack: [] },
        ],
      }));

      const resultPath = path.join(tmpDir, 'result.json');
      fs.writeFileSync(resultPath, JSON.stringify({
        analysisId: 'test-analysis',
        analyzedAt: '2025-01-01T00:00:00Z',
        specTitle: 'Test',
        analysisMethod: 'rule-based',
        affectedScreens: [],
        tasks: [],
        planningChecks: [],
        policyChanges: [],
        screenScores: [],
        totalScore: 10,
        grade: 'Low',
        recommendation: 'test',
        policyWarnings: [],
        ownerNotifications: [],
        confidenceScores: [],
        lowConfidenceWarnings: [],
      }));

      const cmd = new SaveResultCommand(['--file', resultPath, '--project', 'project-a']);
      const result = await cmd.execute();

      // hook 실패해도 save-result는 성공
      expect(result.code).toBe('SUCCESS');
      expect(result.message).toContain('Result saved');
    } finally {
      if (originalContent !== null) {
        fs.writeFileSync(projectsPath, originalContent);
      }
    }
  });
});

// ============================================================
// TASK-054: cross-analyze --auto 옵션 테스트
// ============================================================

describe('TASK-054: cross-analyze --auto option', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('--auto 옵션 파싱', async () => {
    const { CrossAnalyzeCommand } = await import('../../../src/commands/cross-analyze');
    const { CrossProjectManager } = await import('../../../src/core/cross-project/cross-project-manager');

    jest.spyOn(CrossProjectManager.prototype, 'detectAndSave')
      .mockResolvedValue({ detected: 2, saved: 1, total: 3, byType: { 'api-consumer': 1 } });

    // projects.json mock
    const impactDir = path.join(os.homedir(), '.impact');
    const projectsPath = path.join(impactDir, 'projects.json');
    const originalContent = fs.existsSync(projectsPath)
      ? fs.readFileSync(projectsPath, 'utf-8')
      : null;

    try {
      if (!fs.existsSync(impactDir)) fs.mkdirSync(impactDir, { recursive: true });
      fs.writeFileSync(projectsPath, JSON.stringify({
        activeProject: 'project-a',
        projects: [
          { id: 'project-a', name: 'A', path: '/a', status: 'active', createdAt: '', lastUsedAt: '', techStack: [] },
          { id: 'project-b', name: 'B', path: '/b', status: 'active', createdAt: '', lastUsedAt: '', techStack: [] },
        ],
      }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const cmd = new CrossAnalyzeCommand(['--auto']);
      const result = await cmd.execute();

      expect(result.code).toBe('SUCCESS');
      expect(result.data).toBeDefined();
      expect(result.data).toEqual(expect.objectContaining({
        detected: 2,
        saved: 1,
        total: 3,
      }));

      consoleSpy.mockRestore();
    } finally {
      if (originalContent !== null) {
        fs.writeFileSync(projectsPath, originalContent);
      }
    }
  });

  it('기존 cross-analyze 동작 유지 (--auto 없이)', async () => {
    const { CrossAnalyzeCommand } = await import('../../../src/commands/cross-analyze');
    const { CrossProjectManager } = await import('../../../src/core/cross-project/cross-project-manager');
    const { CrossAnalyzer } = await import('../../../src/core/cross-project/cross-analyzer');
    const { ConfigManager } = await import('../../../src/config/config-manager');

    jest.spyOn(ConfigManager.prototype, 'load').mockResolvedValue(undefined);
    jest.spyOn(ConfigManager.prototype, 'getActiveProject').mockReturnValue('test-project');

    jest.spyOn(CrossProjectManager.prototype, 'getLinks').mockResolvedValue([
      { id: 'a-b', source: 'test-project', target: 'other', type: 'api-consumer', autoDetected: false },
    ]);

    jest.spyOn(CrossAnalyzer.prototype, 'analyze').mockResolvedValue({
      affectedProjects: [],
      apiContractChanges: [],
    });

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const cmd = new CrossAnalyzeCommand([]);
    const result = await cmd.execute();

    expect(result.code).toBe('SUCCESS');
    consoleSpy.mockRestore();
  });

  it('--auto 프로젝트 2개 미만일 때 안내', async () => {
    const { CrossAnalyzeCommand } = await import('../../../src/commands/cross-analyze');

    const impactDir = path.join(os.homedir(), '.impact');
    const projectsPath = path.join(impactDir, 'projects.json');
    const originalContent = fs.existsSync(projectsPath)
      ? fs.readFileSync(projectsPath, 'utf-8')
      : null;

    try {
      if (!fs.existsSync(impactDir)) fs.mkdirSync(impactDir, { recursive: true });
      fs.writeFileSync(projectsPath, JSON.stringify({
        activeProject: 'only-one',
        projects: [
          { id: 'only-one', name: 'Only', path: '/only', status: 'active', createdAt: '', lastUsedAt: '', techStack: [] },
        ],
      }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const cmd = new CrossAnalyzeCommand(['--auto']);
      const result = await cmd.execute();

      expect(result.code).toBe('SUCCESS');
      expect(result.data).toEqual(expect.objectContaining({ detected: 0 }));

      consoleSpy.mockRestore();
    } finally {
      if (originalContent !== null) {
        fs.writeFileSync(projectsPath, originalContent);
      }
    }
  });
});

// ============================================================
// TASK-055: init 후 자동 탐지 제안 테스트
// ============================================================

describe('TASK-055: init post-registration suggestion', () => {
  it('init 명령어에 크로스 프로젝트 제안 코드가 존재한다', async () => {
    // init.ts 파일을 읽어서 cross-analyze --auto 안내가 포함되었는지 확인
    const initContent = fs.readFileSync(
      path.join(__dirname, '../../../src/commands/init.ts'),
      'utf-8',
    );
    expect(initContent).toContain('cross-analyze --auto');
    expect(initContent).toContain('projectCount >= 2');
  });
});

// ============================================================
// TASK-056: 자동 탐지 결과 저장 구조 테스트
// ============================================================

describe('TASK-056: crossProjectDetection field in ResultSummary', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kic-task056-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('crossProjectDetection 필드 저장/조회', async () => {
    const { ResultManager } = await import('../../../src/core/analysis/result-manager');

    const manager = new ResultManager(tmpDir);
    const projectId = 'test-project';

    // 분석 결과 저장
    const result = {
      analysisId: 'analysis-001',
      analyzedAt: '2025-01-01T00:00:00Z',
      specTitle: 'Test Spec',
      analysisMethod: 'rule-based' as const,
      affectedScreens: [],
      tasks: [],
      planningChecks: [],
      policyChanges: [],
      screenScores: [],
      totalScore: 15,
      grade: 'Low' as const,
      recommendation: 'test',
      policyWarnings: [],
      ownerNotifications: [],
      confidenceScores: [],
      lowConfidenceWarnings: [],
    };

    await manager.save(result as any, projectId);

    // crossProjectDetection 업데이트
    await manager.updateCrossProjectDetection(projectId, 'analysis-001', {
      detectedAt: '2025-01-01T00:01:00Z',
      linksDetected: 5,
      linksNew: 3,
      linksTotal: 8,
    });

    // 목록 조회 시 crossProjectDetection 필드 확인
    const summaries = await manager.list(projectId);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].crossProjectDetection).toBeDefined();
    expect(summaries[0].crossProjectDetection!.linksDetected).toBe(5);
    expect(summaries[0].crossProjectDetection!.linksNew).toBe(3);
    expect(summaries[0].crossProjectDetection!.linksTotal).toBe(8);
    expect(summaries[0].crossProjectDetection!.detectedAt).toBe('2025-01-01T00:01:00Z');
  });

  it('updateIndex 시 crossProjectDetection 필드 보존', async () => {
    const { ResultManager } = await import('../../../src/core/analysis/result-manager');

    const manager = new ResultManager(tmpDir);
    const projectId = 'test-project';

    // 첫 번째 저장
    const result1 = {
      analysisId: 'analysis-002',
      analyzedAt: '2025-01-01T00:00:00Z',
      specTitle: 'Test Spec',
      analysisMethod: 'rule-based' as const,
      affectedScreens: [],
      tasks: [],
      planningChecks: [],
      policyChanges: [],
      screenScores: [],
      totalScore: 15,
      grade: 'Low' as const,
      recommendation: 'test',
      policyWarnings: [],
      ownerNotifications: [],
      confidenceScores: [],
      lowConfidenceWarnings: [],
    };

    await manager.save(result1 as any, projectId);

    // crossProjectDetection 추가
    await manager.updateCrossProjectDetection(projectId, 'analysis-002', {
      detectedAt: '2025-01-01T00:01:00Z',
      linksDetected: 3,
      linksNew: 2,
      linksTotal: 5,
    });

    // 같은 ID로 다시 저장 (updateIndex 호출됨)
    const result2 = {
      ...result1,
      totalScore: 25,
      grade: 'Medium' as const,
    };

    await manager.save(result2 as any, projectId);

    // crossProjectDetection이 보존되어야 함
    const summaries = await manager.list(projectId);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].totalScore).toBe(25); // 업데이트됨
    expect(summaries[0].crossProjectDetection).toBeDefined(); // 보존됨
    expect(summaries[0].crossProjectDetection!.linksDetected).toBe(3);
  });

  it('crossProjectDetection 없는 결과도 정상 동작', async () => {
    const { ResultManager } = await import('../../../src/core/analysis/result-manager');

    const manager = new ResultManager(tmpDir);
    const projectId = 'test-project';

    const result = {
      analysisId: 'analysis-003',
      analyzedAt: '2025-01-01T00:00:00Z',
      specTitle: 'No Cross Detection',
      analysisMethod: 'rule-based' as const,
      affectedScreens: [],
      tasks: [],
      planningChecks: [],
      policyChanges: [],
      screenScores: [],
      totalScore: 10,
      grade: 'Low' as const,
      recommendation: 'test',
      policyWarnings: [],
      ownerNotifications: [],
      confidenceScores: [],
      lowConfidenceWarnings: [],
    };

    await manager.save(result as any, projectId);

    const summaries = await manager.list(projectId);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].crossProjectDetection).toBeUndefined();
  });
});
