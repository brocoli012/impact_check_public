/**
 * @module commands/config
 * @description Config 명령어 핸들러 - 설정 조회/관리
 */
import { Command, CommandResult } from '../types/common';
/**
 * ConfigCommand - 설정 관리 명령어
 *
 * 사용법: /impact config
 * 기능:
 *   - 현재 설정 조회
 */
export declare class ConfigCommand implements Command {
    readonly name = "config";
    readonly description = "\uC124\uC815\uC744 \uC870\uD68C\uD569\uB2C8\uB2E4.";
    constructor(_args: string[]);
    execute(): Promise<CommandResult>;
}
//# sourceMappingURL=config.d.ts.map