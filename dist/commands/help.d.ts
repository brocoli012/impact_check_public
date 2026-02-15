/**
 * @module commands/help
 * @description Help 명령어 핸들러 - 도움말 표시 및 명령어 상세 안내
 */
import { Command, CommandResult } from '../types/common';
/**
 * HelpCommand - 도움말 명령어
 *
 * 사용법: /impact help [command]
 * 기능:
 *   - 전체 명령어 목록 표시
 *   - 개별 명령어 상세 도움말 (사용법, 옵션, 예시)
 */
export declare class HelpCommand implements Command {
    readonly name = "help";
    readonly description = "\uB3C4\uC6C0\uB9D0\uC744 \uD45C\uC2DC\uD569\uB2C8\uB2E4.";
    private readonly args;
    constructor(args: string[]);
    execute(): Promise<CommandResult>;
    /**
     * 전체 명령어 목록 표시
     */
    private showAllCommands;
    /**
     * 개별 명령어 도움말 표시
     * @param command - 명령어 이름
     */
    private showCommandHelp;
}
//# sourceMappingURL=help.d.ts.map