/**
 * @module tests/unit/commands/gap-check
 * @description GapCheckCommand 단위 테스트 (TASK-162)
 *
 * GapDetector를 jest.mock으로 모킹하여 CLI 명령어 동작을 검증합니다.
 */

import { GapCheckCommand } from '../../../src/commands/gap-check';
import { GapDetector } from '../../../src/core/cross-project/gap-detector';
import { ResultCode } from '../../../src/types/common';
import type { GapCheckResult, GapItem, FixResult } from '../../../src/core/cross-project/types';

// logger mock
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    header: jest.fn(),
  },
}));

// GapDetector mock
jest.mock('../../../src/core/cross-project/gap-detector');

const mockDetect = jest.fn<Promise<GapCheckResult>, [{ projectId?: string }?]>();
const mockFix = jest.fn<Promise<FixResult>, [GapItem[]]>();

beforeEach(() => {
  jest.clearAllMocks();
  (GapDetector as jest.MockedClass<typeof GapDetector>).mockImplementation(() => ({
    detect: mockDetect,
    fix: mockFix,
  } as unknown as GapDetector));
});

// ============================================================
// 테스트용 데이터
// ============================================================

const sampleGap: GapItem = {
  type: 'stale-link',
  severity: 'high',
  projectId: 'proj-a',
  description: 'Link proj-a-proj-x has a deleted project.',
  detail: {
    linkId: 'proj-a-proj-x',
    sourceProject: 'proj-a',
    targetProject: 'proj-x',
  },
  fixable: true,
  fixCommand: 'cross-analyze unlink proj-a proj-x',
};

const sampleGapUnfixable: GapItem = {
  type: 'low-confidence',
  severity: 'medium',
  projectId: 'proj-b',
  description: 'Analysis score 30 is below threshold 60.',
  detail: { analysisId: 'analysis-001', totalScore: 30 },
  fixable: false,
};

function makeResult(gaps: GapItem[], excludedCounts?: GapCheckResult['excludedCounts']): GapCheckResult {
  return {
    gaps,
    summary: {
      total: gaps.length,
      high: gaps.filter(g => g.severity === 'high').length,
      medium: gaps.filter(g => g.severity === 'medium').length,
      low: gaps.filter(g => g.severity === 'low').length,
      fixable: gaps.filter(g => g.fixable).length,
    },
    excludedCounts: excludedCounts ?? { completed: 0, onHold: 0, archived: 0 },
    checkedAt: '2025-06-01T00:00:00Z',
  };
}

// ============================================================
// 테스트
// ============================================================

describe('GapCheckCommand (TASK-162)', () => {
  // --------------------------------------------------------
  // 1. 기본 실행 - detect() 호출 확인
  // --------------------------------------------------------
  it('gap-check 기본 실행 - detect() 호출 확인', async () => {
    const result = makeResult([sampleGap]);
    mockDetect.mockResolvedValue(result);

    const cmd = new GapCheckCommand([]);
    const cmdResult = await cmd.execute();

    expect(mockDetect).toHaveBeenCalledTimes(1);
    expect(mockDetect).toHaveBeenCalledWith(undefined);
    expect(cmdResult.code).toBe(ResultCode.SUCCESS);
    expect(cmdResult.message).toContain('1 gaps');
  });

  // --------------------------------------------------------
  // 2. gap-check --project proj-a - projectId 필터 전달 확인
  // --------------------------------------------------------
  it('gap-check --project proj-a - projectId 필터 전달 확인', async () => {
    const result = makeResult([sampleGap]);
    mockDetect.mockResolvedValue(result);

    const cmd = new GapCheckCommand(['--project', 'proj-a']);
    const cmdResult = await cmd.execute();

    expect(mockDetect).toHaveBeenCalledWith({ projectId: 'proj-a' });
    expect(cmdResult.code).toBe(ResultCode.SUCCESS);
  });

  // --------------------------------------------------------
  // 3. gap-check --fix - fix() 호출 확인
  // --------------------------------------------------------
  it('gap-check --fix - fix() 호출 확인', async () => {
    const result = makeResult([sampleGap, sampleGapUnfixable]);
    mockDetect.mockResolvedValue(result);

    const fixResult: FixResult = {
      fixed: 1,
      failed: 0,
      details: [
        { gap: sampleGap, success: true, message: 'removed link proj-a->proj-x' },
      ],
    };
    mockFix.mockResolvedValue(fixResult);

    const cmd = new GapCheckCommand(['--fix']);
    const cmdResult = await cmd.execute();

    // fix()는 fixable한 갭만 전달받아야 함
    expect(mockFix).toHaveBeenCalledTimes(1);
    const fixArg = mockFix.mock.calls[0][0];
    expect(fixArg.length).toBe(1);
    expect(fixArg[0].fixable).toBe(true);
    expect(cmdResult.code).toBe(ResultCode.SUCCESS);
    expect(cmdResult.message).toContain('Fixed 1');
  });

  // --------------------------------------------------------
  // 4. gap-check --fix with partial failure returns PARTIAL
  // --------------------------------------------------------
  it('gap-check --fix with partial failure returns PARTIAL', async () => {
    const result = makeResult([sampleGap]);
    mockDetect.mockResolvedValue(result);

    const fixResult: FixResult = {
      fixed: 0,
      failed: 1,
      details: [
        { gap: sampleGap, success: false, message: 'fix error: something went wrong' },
      ],
    };
    mockFix.mockResolvedValue(fixResult);

    const cmd = new GapCheckCommand(['--fix']);
    const cmdResult = await cmd.execute();

    expect(cmdResult.code).toBe(ResultCode.PARTIAL);
  });

  // --------------------------------------------------------
  // 5. gap-check --json - JSON 출력 확인
  // --------------------------------------------------------
  it('gap-check --json - JSON 출력 확인', async () => {
    const result = makeResult([sampleGap]);
    mockDetect.mockResolvedValue(result);

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const cmd = new GapCheckCommand(['--json']);
    const cmdResult = await cmd.execute();

    expect(cmdResult.code).toBe(ResultCode.SUCCESS);

    // console.log에 JSON이 출력되었는지 확인
    expect(consoleSpy).toHaveBeenCalled();
    const jsonOutput = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(jsonOutput);
    expect(parsed.gaps).toBeDefined();
    expect(parsed.summary).toBeDefined();

    consoleSpy.mockRestore();
  });

  // --------------------------------------------------------
  // 6. gap 0건 - "No gaps found" 메시지
  // --------------------------------------------------------
  it('gap 0건 - "No gaps found" 메시지', async () => {
    const result = makeResult([]);
    mockDetect.mockResolvedValue(result);

    const cmd = new GapCheckCommand([]);
    const cmdResult = await cmd.execute();

    expect(cmdResult.code).toBe(ResultCode.SUCCESS);
    expect(cmdResult.message).toBe('No gaps found.');
  });

  // --------------------------------------------------------
  // 7. 에러 발생 시 FAILURE 반환
  // --------------------------------------------------------
  it('에러 발생 시 FAILURE 반환', async () => {
    mockDetect.mockRejectedValue(new Error('test error'));

    const cmd = new GapCheckCommand([]);
    const cmdResult = await cmd.execute();

    expect(cmdResult.code).toBe(ResultCode.FAILURE);
    expect(cmdResult.message).toContain('test error');
  });

  // --------------------------------------------------------
  // 8. gap-check --fix with 0 fixable gaps
  // --------------------------------------------------------
  it('gap-check --fix with 0 fixable gaps returns SUCCESS', async () => {
    const result = makeResult([sampleGapUnfixable]);
    mockDetect.mockResolvedValue(result);

    const cmd = new GapCheckCommand(['--fix']);
    const cmdResult = await cmd.execute();

    // fix()가 호출되지 않아야 함
    expect(mockFix).not.toHaveBeenCalled();
    expect(cmdResult.code).toBe(ResultCode.SUCCESS);
    expect(cmdResult.message).toContain('No fixable gaps');
  });

  // --------------------------------------------------------
  // 9. gap-check --json --fix - JSON 모드에서 fix 결과 포함
  // --------------------------------------------------------
  it('gap-check --json --fix - JSON 모드에서 fix 결과 포함', async () => {
    const result = makeResult([sampleGap]);
    mockDetect.mockResolvedValue(result);

    const fixResult: FixResult = {
      fixed: 1,
      failed: 0,
      details: [
        { gap: sampleGap, success: true, message: 'removed link' },
      ],
    };
    mockFix.mockResolvedValue(fixResult);

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const cmd = new GapCheckCommand(['--json', '--fix']);
    await cmd.execute();

    const jsonOutput = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(jsonOutput);
    expect(parsed.result).toBeDefined();
    expect(parsed.fix).toBeDefined();
    expect(parsed.fix.fixed).toBe(1);

    consoleSpy.mockRestore();
  });

  // --------------------------------------------------------
  // 10. excludedCounts 출력 확인
  // --------------------------------------------------------
  it('excludedCounts 출력 확인 (TASK-190)', async () => {
    const result = makeResult(
      [sampleGap],
      { completed: 2, onHold: 1, archived: 3 },
    );
    mockDetect.mockResolvedValue(result);

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const cmd = new GapCheckCommand([]);
    const cmdResult = await cmd.execute();

    expect(cmdResult.code).toBe(ResultCode.SUCCESS);

    // "Excluded by status" 문구가 출력되었는지 확인
    const allOutput = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(allOutput).toContain('Excluded by status');
    expect(allOutput).toContain('2 completed');
    expect(allOutput).toContain('1 on-hold');
    expect(allOutput).toContain('3 archived');

    consoleSpy.mockRestore();
  });

  // --------------------------------------------------------
  // 11. Command 인터페이스 확인
  // --------------------------------------------------------
  it('Command 인터페이스 확인 (name, description)', () => {
    const cmd = new GapCheckCommand([]);
    expect(cmd.name).toBe('gap-check');
    expect(cmd.description).toBeDefined();
    expect(cmd.description.length).toBeGreaterThan(0);
  });
});
