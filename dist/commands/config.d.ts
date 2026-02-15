/**
 * @module commands/config
 * @description Config 명령어 핸들러 - LLM 프로바이더 및 API 키 설정
 */
import { Command, CommandResult } from '../types/common';
/**
 * ConfigCommand - 설정 관리 명령어
 *
 * 사용법: /impact config [--provider <name>] [--key <api_key>]
 * 기능:
 *   - LLM 프로바이더 설정
 *   - API 키 등록 (암호화 저장)
 *   - 현재 설정 조회
 */
export declare class ConfigCommand implements Command {
    readonly name = "config";
    readonly description = "LLM \uD504\uB85C\uBC14\uC774\uB354 \uBC0F API \uD0A4\uB97C \uC124\uC815\uD569\uB2C8\uB2E4.";
    private readonly args;
    constructor(args: string[]);
    execute(): Promise<CommandResult>;
}
//# sourceMappingURL=config.d.ts.map