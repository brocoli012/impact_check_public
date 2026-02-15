/**
 * @module tests/unit/error-handling
 * @description 에러 처리 단위 테스트 - 에러 메시지, 재시도, 세션 재개
 */

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { ResultCode } from '@/types/common';
import { retryWithBackoff, isRetryableError } from '@/utils/retry';
import { SessionManager } from '@/core/session/session-manager';

// ============================================================
// 1. Friendly Error Messages Tests
// ============================================================

describe('Friendly Error Messages', () => {
  let originalHome: string | undefined;
  let originalUserProfile: string | undefined;
  let tmpDir: string;
  let consoleSpy: jest.SpyInstance;

  beforeAll(() => {
    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'impact-error-test-'));
    process.env.HOME = tmpDir;
    process.env.USERPROFILE = tmpDir;
  });

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  afterAll(() => {
    process.env.HOME = originalHome;
    process.env.USERPROFILE = originalUserProfile;
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('AnalyzeCommand error messages', () => {
    it('should return friendly message when no spec file provided', async () => {
      const { AnalyzeCommand } = require('@/commands/analyze');
      const cmd = new AnalyzeCommand([]);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('기획서 파일을 지정해주세요');
      expect(result.message).toContain('/impact analyze --file');
    });

    it('should return friendly message when file not found', async () => {
      const { AnalyzeCommand } = require('@/commands/analyze');
      const cmd = new AnalyzeCommand(['--file', '/nonexistent/path/spec.txt']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('기획서 파일을 지정해주세요');
    });

    it('should return friendly message when no project initialized', async () => {
      // 기획서 파일 생성
      const specPath = path.join(tmpDir, 'test-spec.txt');
      fs.writeFileSync(specPath, '# 테스트 기획서\n## 기능\n- 테스트 기능 추가');

      const { AnalyzeCommand } = require('@/commands/analyze');
      const cmd = new AnalyzeCommand(['--file', specPath]);
      const result = await cmd.execute();

      // 프로젝트가 없으므로 NEEDS_CONFIG 반환
      expect(result.code).toBe(ResultCode.NEEDS_CONFIG);
      expect(result.message).toContain('프로젝트를 초기화하세요');
      expect(result.message).toContain('/impact init');
    });
  });

  describe('InitCommand error messages', () => {
    it('should return friendly message when path does not exist', async () => {
      const { InitCommand } = require('@/commands/init');
      const cmd = new InitCommand(['/nonexistent/path/project']);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('경로가 존재하지 않습니다');
    });

    it('should return friendly message when no path provided', async () => {
      const { InitCommand } = require('@/commands/init');
      const cmd = new InitCommand([]);
      const result = await cmd.execute();

      expect(result.code).toBe(ResultCode.FAILURE);
      expect(result.message).toContain('Project path is required');
    });
  });
});

// ============================================================
// 2. Retry Logic Tests
// ============================================================

describe('Retry Logic', () => {
  describe('isRetryableError', () => {
    it('should identify rate limit errors', () => {
      expect(isRetryableError(new Error('Rate limit exceeded'))).toBe(true);
      expect(isRetryableError(new Error('rate_limit_error'))).toBe(true);
      expect(isRetryableError(new Error('HTTP 429 Too Many Requests'))).toBe(true);
    });

    it('should identify timeout errors', () => {
      expect(isRetryableError(new Error('Request timeout'))).toBe(true);
      expect(isRetryableError(new Error('Connection timed out'))).toBe(true);
      expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
    });

    it('should identify network errors', () => {
      expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true);
      expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
      expect(isRetryableError(new Error('ENOTFOUND'))).toBe(true);
    });

    it('should identify server errors', () => {
      expect(isRetryableError(new Error('HTTP 500 Internal Server Error'))).toBe(true);
      expect(isRetryableError(new Error('HTTP 502 Bad Gateway'))).toBe(true);
      expect(isRetryableError(new Error('HTTP 503 Service Unavailable'))).toBe(true);
    });

    it('should not retry auth errors', () => {
      expect(isRetryableError(new Error('Unauthorized'))).toBe(false);
      expect(isRetryableError(new Error('Invalid API key'))).toBe(false);
      expect(isRetryableError(new Error('Permission denied'))).toBe(false);
    });

    it('should not retry validation errors', () => {
      expect(isRetryableError(new Error('Invalid request body'))).toBe(false);
      expect(isRetryableError(new Error('Missing required field'))).toBe(false);
    });

    it('should not trigger false positives from substring matches', () => {
      // "5000" 등 숫자가 포함된 일반 메시지는 재시도 대상이 아님
      expect(isRetryableError(new Error('Processing batch of 5000 items'))).toBe(false);
      expect(isRetryableError(new Error('Found 5003 records in database'))).toBe(false);
      expect(isRetryableError(new Error('Port 5029 is in use'))).toBe(false);
      expect(isRetryableError(new Error('ID: 42900'))).toBe(false);
      expect(isRetryableError(new Error('Received 15020 bytes'))).toBe(false);
      expect(isRetryableError(new Error('Total: 50400 items processed'))).toBe(false);
    });

    it('should detect retryable errors via structured statusCode property', () => {
      const err429 = new Error('Too many requests') as any;
      err429.statusCode = 429;
      expect(isRetryableError(err429)).toBe(true);

      const err500 = new Error('Internal server error') as any;
      err500.status = 500;
      expect(isRetryableError(err500)).toBe(true);

      const err503 = new Error('Service unavailable') as any;
      err503.statusCode = 503;
      expect(isRetryableError(err503)).toBe(true);

      // 400은 재시도 대상이 아님
      const err400 = new Error('Bad request') as any;
      err400.statusCode = 400;
      expect(isRetryableError(err400)).toBe(false);
    });
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first try', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelayMs: 10,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error and succeed', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValue('success after retry');

      const result = await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelayMs: 10,
      });

      expect(result).toBe('success after retry');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry multiple times before succeeding', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('success');

      const result = await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelayMs: 10,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries exceeded', async () => {
      const fn = jest.fn()
        .mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(
        retryWithBackoff(fn, {
          maxRetries: 2,
          initialDelayMs: 10,
        })
      ).rejects.toThrow('Rate limit exceeded');

      expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('should not retry non-retryable errors', async () => {
      const fn = jest.fn()
        .mockRejectedValue(new Error('Invalid API key'));

      await expect(
        retryWithBackoff(fn, {
          maxRetries: 3,
          initialDelayMs: 10,
        })
      ).rejects.toThrow('Invalid API key');

      expect(fn).toHaveBeenCalledTimes(1); // No retries
    });

    it('should use custom shouldRetry function', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('custom error'))
        .mockResolvedValue('ok');

      const result = await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelayMs: 10,
        shouldRetry: (err: Error) => err.message === 'custom error',
      });

      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should respect backoff multiplier', async () => {
      const start = Date.now();
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValue('ok');

      await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelayMs: 50,
        backoffMultiplier: 2,
      });

      const elapsed = Date.now() - start;
      // 50ms + 100ms = 150ms minimum (first retry 50ms, second retry 100ms)
      expect(elapsed).toBeGreaterThanOrEqual(100);
    });

    it('should cap delay at maxDelayMs', async () => {
      const start = Date.now();
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValue('ok');

      await retryWithBackoff(fn, {
        maxRetries: 4,
        initialDelayMs: 50,
        backoffMultiplier: 10,
        maxDelayMs: 100,
      });

      const elapsed = Date.now() - start;
      // Without cap: 50 + 500 + 5000 = 5550ms
      // With cap at 100ms: 50 + 100 + 100 = 250ms
      // The total should be well under 1000ms
      expect(elapsed).toBeLessThan(1000);
      // But should be at least 50 + 100 + 100 = 250ms (with some tolerance)
      expect(elapsed).toBeGreaterThanOrEqual(200);
    });
  });
});

// ============================================================
// 3. Session Resume Tests
// ============================================================

describe('Session Resume', () => {
  let tmpDir: string;
  let sessionManager: SessionManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'impact-session-test-'));
    sessionManager = new SessionManager(tmpDir);
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('startSession', () => {
    it('should create a new session with correct fields', () => {
      const session = sessionManager.startSession('test-project', '/path/to/spec.txt');

      expect(session.sessionId).toMatch(/^session-\d+$/);
      expect(session.projectId).toBe('test-project');
      expect(session.specFilePath).toBe('/path/to/spec.txt');
      expect(session.lastCompletedStep).toBe(0);
      expect(session.totalSteps).toBe(6);
      expect(session.startedAt).toBeDefined();
      expect(session.updatedAt).toBeDefined();
    });

    it('should save session to disk', () => {
      sessionManager.startSession('test-project');

      const sessionDir = path.join(tmpDir, '.impact', 'session');
      const resumePath = path.join(sessionDir, 'pending-resume.json');
      expect(fs.existsSync(resumePath)).toBe(true);
    });

    it('should support text content input', () => {
      const session = sessionManager.startSession(
        'test-project',
        undefined,
        '# 테스트 기획서\n기능 추가'
      );

      expect(session.specContent).toBe('# 테스트 기획서\n기능 추가');
    });
  });

  describe('updateProgress', () => {
    it('should update completed step', () => {
      const session = sessionManager.startSession('test-project');
      sessionManager.updateProgress(session, 3);

      expect(session.lastCompletedStep).toBe(3);
    });

    it('should save partial result', () => {
      const session = sessionManager.startSession('test-project');
      const partialResult = {
        analysisId: 'test-001',
        specTitle: '테스트',
      };

      sessionManager.updateProgress(session, 2, partialResult);

      const loaded = sessionManager.loadPartialResult();
      expect(loaded).not.toBeNull();
      expect(loaded!.analysisId).toBe('test-001');
    });
  });

  describe('checkPendingResume', () => {
    it('should return null when no session exists', () => {
      const resume = sessionManager.checkPendingResume();
      expect(resume).toBeNull();
    });

    it('should return resumable session', () => {
      const session = sessionManager.startSession('test-project');
      sessionManager.updateProgress(session, 3);

      const resume = sessionManager.checkPendingResume();
      expect(resume).not.toBeNull();
      expect(resume!.canResume).toBe(true);
      expect(resume!.session.lastCompletedStep).toBe(3);
    });

    it('should not resume if no steps completed', () => {
      sessionManager.startSession('test-project');

      const resume = sessionManager.checkPendingResume();
      expect(resume).not.toBeNull();
      expect(resume!.canResume).toBe(false);
      expect(resume!.reason).toContain('진행된 분석이 없습니다');
    });

    it('should not resume expired sessions', () => {
      const session = sessionManager.startSession('test-project');
      sessionManager.updateProgress(session, 2);

      // 세션 파일의 updatedAt을 25시간 전으로 수정
      const sessionDir = path.join(tmpDir, '.impact', 'session');
      const resumePath = path.join(sessionDir, 'pending-resume.json');
      const data = JSON.parse(fs.readFileSync(resumePath, 'utf-8'));
      data.updatedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      fs.writeFileSync(resumePath, JSON.stringify(data));

      const resume = sessionManager.checkPendingResume();
      expect(resume).not.toBeNull();
      expect(resume!.canResume).toBe(false);
      expect(resume!.reason).toContain('만료');
    });
  });

  describe('recordFailure', () => {
    it('should record error message', () => {
      const session = sessionManager.startSession('test-project');
      sessionManager.recordFailure(session, '외부 서비스 호출 실패');

      expect(session.errorMessage).toBe('외부 서비스 호출 실패');
    });
  });

  describe('completeSession', () => {
    it('should clean up session files', () => {
      const session = sessionManager.startSession('test-project');
      sessionManager.updateProgress(session, 6, { analysisId: 'done' });

      // 세션 파일 확인
      const sessionDir = path.join(tmpDir, '.impact', 'session');
      expect(fs.existsSync(path.join(sessionDir, 'pending-resume.json'))).toBe(true);
      expect(fs.existsSync(path.join(sessionDir, 'partial-result.json'))).toBe(true);

      // 세션 완료
      sessionManager.completeSession();

      expect(fs.existsSync(path.join(sessionDir, 'pending-resume.json'))).toBe(false);
      expect(fs.existsSync(path.join(sessionDir, 'partial-result.json'))).toBe(false);
    });

    it('should not throw if no session files exist', () => {
      expect(() => sessionManager.completeSession()).not.toThrow();
    });
  });

  describe('loadPartialResult', () => {
    it('should return null when no partial result exists', () => {
      const result = sessionManager.loadPartialResult();
      expect(result).toBeNull();
    });

    it('should return saved partial result', () => {
      const session = sessionManager.startSession('test-project');
      const partial = {
        analysisId: 'partial-001',
        specTitle: '부분 결과',
        affectedScreens: [],
        tasks: [],
      };

      sessionManager.updateProgress(session, 4, partial);

      const loaded = sessionManager.loadPartialResult();
      expect(loaded).not.toBeNull();
      expect(loaded!.analysisId).toBe('partial-001');
      expect(loaded!.specTitle).toBe('부분 결과');
    });
  });
});

