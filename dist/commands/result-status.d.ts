/**
 * @module commands/result-status
 * @description 분석 결과 상태 변경/조회 CLI 명령어
 *
 * 사용법:
 *   result-status set <analysis-id> <status>               # 단일 상태 변경
 *   result-status --list --project <id> [--status <s>]     # 상태별 조회
 */
import { Command, CommandResult } from '../types/common';
/**
 * ResultStatusCommand - 분석 결과 상태 변경/조회 명령어
 */
export declare class ResultStatusCommand implements Command {
    readonly name = "result-status";
    readonly description = "\uBD84\uC11D \uACB0\uACFC\uC758 \uC0C1\uD0DC\uB97C \uBCC0\uACBD\uD558\uAC70\uB098 \uC870\uD68C\uD569\uB2C8\uB2E4.";
    private readonly args;
    constructor(args: string[]);
    execute(): Promise<CommandResult>;
    /**
     * 단일 상태 변경: result-status set <analysisId> <status>
     */
    private handleSet;
    /**
     * 상태별 분석 결과 목록 조회
     * result-status --list --project <id> [--status <s>]
     */
    private handleList;
    /**
     * 프로젝트 ID를 확정
     */
    private resolveProjectId;
    /**
     * 인자에서 옵션 값을 추출
     */
    private getOption;
}
//# sourceMappingURL=result-status.d.ts.map