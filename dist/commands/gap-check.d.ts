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
import { Command, CommandResult } from '../types/common';
/**
 * GapCheckCommand - 크로스 프로젝트 갭 점검 명령어
 *
 * 프로젝트 간 의존성/분석 상태를 점검하여 관리가 필요한 갭을 식별합니다.
 */
export declare class GapCheckCommand implements Command {
    readonly name = "gap-check";
    readonly description = "\uD06C\uB85C\uC2A4 \uD504\uB85C\uC81D\uD2B8 \uAC2D(\uBBF8\uBE44 \uC0AC\uD56D)\uC744 \uC810\uAC80\uD569\uB2C8\uB2E4.";
    private readonly args;
    constructor(args: string[]);
    execute(): Promise<CommandResult>;
    /**
     * 갭 탐지 결과를 테이블 형태로 출력
     */
    private printResult;
    /**
     * 수정 결과 출력
     */
    private printFixResult;
    /**
     * 인자에서 옵션 값을 추출
     */
    private getOption;
}
//# sourceMappingURL=gap-check.d.ts.map