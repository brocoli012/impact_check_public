"use strict";
/**
 * @module commands/gap-check
 * @description 크로스 프로젝트 갭 점검 CLI 명령어
 *
 * 사용법:
 *   gap-check                           # 전체 갭 점검
 *   gap-check --project <id>            # 특정 프로젝트만 점검
 *   gap-check --fix                     # 해결 가능한 항목 자동 수정
 *   gap-check --json                    # JSON 형식 출력
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GapCheckCommand = void 0;
const common_1 = require("../types/common");
const gap_detector_1 = require("../core/cross-project/gap-detector");
const logger_1 = require("../utils/logger");
/**
 * GapCheckCommand - 크로스 프로젝트 갭 점검 명령어
 *
 * 프로젝트 간 의존성/분석 상태를 점검하여 관리가 필요한 갭을 식별합니다.
 */
class GapCheckCommand {
    constructor(args) {
        this.name = 'gap-check';
        this.description = '크로스 프로젝트 갭(미비 사항)을 점검합니다.';
        this.args = args;
    }
    async execute() {
        try {
            const projectId = this.getOption('--project');
            const isFix = this.args.includes('--fix');
            const isJson = this.args.includes('--json');
            const detector = new gap_detector_1.GapDetector();
            // 1. 갭 탐지
            const result = await detector.detect(projectId ? { projectId } : undefined);
            // 2. --fix 모드: 수정 가능한 갭 자동 수정
            if (isFix) {
                const fixableGaps = result.gaps.filter(g => g.fixable);
                if (fixableGaps.length === 0) {
                    if (isJson) {
                        console.log(JSON.stringify({ result, fix: null }, null, 2));
                    }
                    else {
                        console.log('  No fixable gaps found.\n');
                    }
                    return {
                        code: common_1.ResultCode.SUCCESS,
                        message: 'No fixable gaps to fix.',
                        data: result,
                    };
                }
                const fixResult = await detector.fix(fixableGaps);
                if (isJson) {
                    console.log(JSON.stringify({ result, fix: fixResult }, null, 2));
                }
                else {
                    this.printResult(result);
                    console.log('');
                    this.printFixResult(fixResult);
                }
                return {
                    code: fixResult.failed > 0 ? common_1.ResultCode.PARTIAL : common_1.ResultCode.SUCCESS,
                    message: `Fixed ${fixResult.fixed} of ${fixableGaps.length} fixable gaps.`,
                    data: { result, fix: fixResult },
                };
            }
            // 3. 결과 출력
            if (isJson) {
                console.log(JSON.stringify(result, null, 2));
            }
            else {
                this.printResult(result);
            }
            return {
                code: common_1.ResultCode.SUCCESS,
                message: result.summary.total === 0
                    ? 'No gaps found.'
                    : `Found ${result.summary.total} gaps.`,
                data: result,
            };
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger_1.logger.error(`갭 점검 실패: ${errorMsg}`);
            return {
                code: common_1.ResultCode.FAILURE,
                message: `Gap check failed: ${errorMsg}`,
            };
        }
    }
    /**
     * 갭 탐지 결과를 테이블 형태로 출력
     */
    printResult(result) {
        const { gaps, summary, excludedCounts } = result;
        if (gaps.length === 0) {
            console.log('\n  \u2713 No gaps found. All projects are healthy.\n');
            if (excludedCounts) {
                const { completed, onHold, archived } = excludedCounts;
                if (completed > 0 || onHold > 0 || archived > 0) {
                    console.log(`  Excluded by status: ${completed} completed, ${onHold} on-hold, ${archived} archived\n`);
                }
            }
            return;
        }
        logger_1.logger.header('Gap Check Results');
        console.log('');
        // 테이블 헤더
        console.log(`  ${'SEVERITY'.padEnd(10)} ${'TYPE'.padEnd(22)} ${'PROJECT'.padEnd(20)} ${'FIXABLE'.padEnd(8)} DESCRIPTION`);
        console.log(`  ${'-'.repeat(90)}`);
        // 갭 목록 (severity 순: high -> medium -> low)
        const sorted = [...gaps].sort((a, b) => {
            const order = { high: 0, medium: 1, low: 2 };
            return order[a.severity] - order[b.severity];
        });
        for (const gap of sorted) {
            console.log(`  ${gap.severity.padEnd(10)} ${gap.type.padEnd(22)} ${gap.projectId.padEnd(20)} ${(gap.fixable ? 'yes' : 'no').padEnd(8)} ${gap.description}`);
        }
        // 요약
        console.log('');
        console.log(`  Total: ${summary.total} gaps (${summary.high} high, ${summary.medium} medium, ${summary.low} low), ${summary.fixable} fixable`);
        // excludedCounts 표시
        if (excludedCounts) {
            const { completed, onHold, archived } = excludedCounts;
            if (completed > 0 || onHold > 0 || archived > 0) {
                console.log(`  Excluded by status: ${completed} completed, ${onHold} on-hold, ${archived} archived`);
            }
        }
        console.log('');
    }
    /**
     * 수정 결과 출력
     */
    printFixResult(fixResult) {
        const total = fixResult.fixed + fixResult.failed;
        console.log(`  Fixed ${fixResult.fixed} of ${total} fixable gaps:`);
        for (const detail of fixResult.details) {
            const icon = detail.success ? '\u2713' : '\u2717';
            console.log(`    ${icon} ${detail.gap.type}: ${detail.message}`);
        }
        console.log('');
    }
    /**
     * 인자에서 옵션 값을 추출
     */
    getOption(flag) {
        const idx = this.args.indexOf(flag);
        if (idx >= 0 && idx + 1 < this.args.length) {
            return this.args[idx + 1];
        }
        return undefined;
    }
}
exports.GapCheckCommand = GapCheckCommand;
//# sourceMappingURL=gap-check.js.map