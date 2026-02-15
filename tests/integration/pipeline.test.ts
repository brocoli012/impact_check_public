/**
 * @module tests/integration/pipeline
 * @description E2E 파이프라인 통합 테스트 - init -> analyze -> tickets 전체 흐름
 */

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { InitCommand } from '@/commands/init';
import { AnalyzeCommand } from '@/commands/analyze';
import { TicketsCommand } from '@/commands/tickets';
import { ReindexCommand } from '@/commands/reindex';
import { DemoCommand } from '@/commands/demo';
import { ResultManager } from '@/core/analysis/result-manager';
import { CommandResult, ResultCode } from '@/types/common';
// utils/file imported for fixture helpers if needed

/** 테스트용 임시 디렉토리 경로 */
let tmpDir: string;

/** 샘플 프로젝트 경로 */
const SAMPLE_PROJECT = path.resolve(__dirname, '..', 'fixtures', 'sample-project');

/** 샘플 기획서 경로 */
const SAMPLE_SPEC = path.resolve(__dirname, '..', 'fixtures', 'sample-spec.txt');

/**
 * 환경 변수를 임시 디렉토리로 설정하여
 * .impact 데이터가 임시 폴더에 저장되도록 합니다.
 */
function setHomeToTmp(): void {
  process.env.HOME = tmpDir;
  process.env.USERPROFILE = tmpDir;
}

/** 원래 환경 변수 백업 */
let originalHome: string | undefined;
let originalUserProfile: string | undefined;

/** console.log를 캡처하기 위한 spy */
let consoleSpy: jest.SpyInstance;

beforeAll(() => {
  // 원래 환경 변수 백업
  originalHome = process.env.HOME;
  originalUserProfile = process.env.USERPROFILE;

  // 임시 디렉토리 생성
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'impact-e2e-'));
  setHomeToTmp();
});

beforeEach(() => {
  // console.log 출력 억제
  consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
});

afterAll(() => {
  // 원래 환경 변수 복원
  process.env.HOME = originalHome;
  process.env.USERPROFILE = originalUserProfile;

  // 임시 디렉토리 삭제
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe('E2E Pipeline', () => {
  describe('init -> analyze -> tickets flow', () => {
    /** 각 단계의 결과를 저장하여 테스트 간 독립성 확보 */
    let initResult: CommandResult;
    let analyzeResult: CommandResult;
    let ticketsResult: CommandResult;
    let ticketOutput: string;

    beforeAll(async () => {
      // suppress console.log during setup
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // Step 1: 프로젝트 초기화
      const initCmd = new InitCommand([SAMPLE_PROJECT]);
      initResult = await initCmd.execute();

      // Step 2: 기획서 분석 (규칙 기반)
      const analyzeCmd = new AnalyzeCommand(['--file', SAMPLE_SPEC, '--project', 'sample-project']);
      analyzeResult = await analyzeCmd.execute();

      // Step 3: 데모 결과 저장 + 티켓 생성
      const demoCmd = new DemoCommand(['--no-open']);
      await demoCmd.execute();

      ticketOutput = path.join(tmpDir, 'tickets-output');
      const ticketsCmd = new TicketsCommand(['--output', ticketOutput]);
      ticketsResult = await ticketsCmd.execute();

      spy.mockRestore();
    });

    it('should initialize a project successfully', () => {
      expect(initResult.code).toBe(ResultCode.SUCCESS);
      expect(initResult.message).toContain('Project initialized');

      // 인덱스 파일이 생성되었는지 확인
      const impactDir = path.join(tmpDir, '.impact');
      expect(fs.existsSync(impactDir)).toBe(true);

      const projectsFile = path.join(impactDir, 'projects.json');
      expect(fs.existsSync(projectsFile)).toBe(true);

      // 프로젝트가 등록되었는지 확인
      const projectsData = JSON.parse(fs.readFileSync(projectsFile, 'utf-8'));
      expect(projectsData.activeProject).toBe('sample-project');
      expect(projectsData.projects.length).toBeGreaterThanOrEqual(1);

      // data에 projectId, stats, techStack이 있는지 확인
      const data = initResult.data as { projectId: string; stats: Record<string, number>; techStack: string[] };
      expect(data.projectId).toBe('sample-project');
      expect(data.stats).toBeDefined();
      expect(data.stats.totalFiles).toBeGreaterThanOrEqual(1);
    });

    it('should analyze with rule-based mode', () => {
      expect(analyzeResult.code).toBe(ResultCode.SUCCESS);
      expect(analyzeResult.message).toContain('분석 완료');

      // data가 분석 결과인지 확인
      const data = analyzeResult.data as {
        specTitle: string;
        affectedScreens: unknown[];
        tasks: unknown[];
        totalScore: number;
        grade: string;
      };
      expect(data).toBeDefined();
      expect(data.specTitle).toBeDefined();
      expect(typeof data.specTitle).toBe('string');
      expect(data.affectedScreens).toBeDefined();
      expect(Array.isArray(data.tasks)).toBe(true);
      expect(typeof data.totalScore).toBe('number');
      expect(typeof data.grade).toBe('string');
    });

    it('should generate tickets from analysis result', async () => {
      // 데모 프로젝트의 결과로 티켓 생성 검증 (데모는 항상 3개 작업 포함)
      const resultManager = new ResultManager(tmpDir);
      const demoResults = await resultManager.list('demo-project');
      expect(demoResults.length).toBeGreaterThanOrEqual(1);

      const latestResult = await resultManager.getLatest('demo-project');
      expect(latestResult).not.toBeNull();
      expect(latestResult!.tasks.length).toBeGreaterThanOrEqual(1);

      // 티켓 명령어 결과 검증
      expect(ticketsResult.code).toBe(ResultCode.SUCCESS);
      expect(ticketsResult.message).toContain('Generated');

      const data = ticketsResult.data as { ticketPaths: string[]; outputDir: string };
      expect(data.outputDir).toBe(ticketOutput);

      // 생성된 티켓이 있는 경우 내용 검증
      if (data.ticketPaths.length > 0) {
        for (const ticketPath of data.ticketPaths) {
          expect(fs.existsSync(ticketPath)).toBe(true);
          const content = fs.readFileSync(ticketPath, 'utf-8');
          expect(content).toContain('기본 정보');
          expect(content).toContain('작업 설명');
        }
      }
    });

    it('should list results via ResultManager', async () => {
      const resultManager = new ResultManager(tmpDir);
      const results = await resultManager.list('sample-project');

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('specTitle');
      expect(results[0]).toHaveProperty('totalScore');
      expect(results[0]).toHaveProperty('grade');
    });

    it('should load result by ID via ResultManager', async () => {
      const resultManager = new ResultManager(tmpDir);
      const summaries = await resultManager.list('sample-project');
      expect(summaries.length).toBeGreaterThanOrEqual(1);

      const resultId = summaries[0].id;
      const result = await resultManager.getById('sample-project', resultId);

      expect(result).not.toBeNull();
      expect(result!.analysisId).toBe(resultId);
      expect(result!.specTitle).toBeDefined();
      expect(result!.affectedScreens).toBeDefined();
      expect(result!.tasks).toBeDefined();
      expect(typeof result!.totalScore).toBe('number');
    });
  });

  describe('reindex flow', () => {
    it('should reindex existing project', async () => {
      const cmd = new ReindexCommand([]);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('Reindex complete');

      const data = result.data as { projectId: string; mode: string; stats: Record<string, number> };
      expect(data.projectId).toBe('sample-project');
      expect(data.stats).toBeDefined();
      expect(data.stats.totalFiles).toBeGreaterThanOrEqual(1);
    });
  });

  describe('demo flow', () => {
    it('should run demo and produce result', async () => {
      const cmd = new DemoCommand(['--no-open']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.SUCCESS);
      expect(result.message).toContain('Demo completed');

      const data = result.data as { projectId: string; analysisId: string };
      expect(data.projectId).toBe('demo-project');
      expect(data.analysisId).toBeDefined();

      // 데모 결과가 저장되었는지 확인
      const resultManager = new ResultManager(tmpDir);
      const demoResults = await resultManager.list('demo-project');
      expect(demoResults.length).toBeGreaterThanOrEqual(1);

      // console.log가 호출되었는지 확인 (단계별 출력)
      expect(consoleSpy).toHaveBeenCalled();
      const calls = consoleSpy.mock.calls.map((c: unknown[]) => String(c[0]));
      const hasStepOutput = calls.some((c: string) => c.includes('[1/5]') || c.includes('[2/5]'));
      expect(hasStepOutput).toBe(true);
    });
  });
});
