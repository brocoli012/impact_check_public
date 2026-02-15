/**
 * @module commands/demo
 * @description Demo 명령어 핸들러 - 샘플 데이터 기반으로 도구를 체험
 */
import { Command, CommandResult } from '../types/common';
/**
 * DemoCommand - 데모 체험 명령어
 *
 * 사용법: /impact demo [--no-open]
 * 기능:
 *   - 샘플 분석 결과 생성
 *   - 단계별 데모 워크스루 출력
 *   - 시각화 웹 열기 (--no-open으로 생략 가능)
 */
export declare class DemoCommand implements Command {
    readonly name = "demo";
    readonly description = "\uC0D8\uD50C \uB370\uC774\uD130 \uAE30\uBC18\uC73C\uB85C \uB3C4\uAD6C\uB97C \uCCB4\uD5D8\uD569\uB2C8\uB2E4.";
    private readonly args;
    constructor(args: string[]);
    execute(): Promise<CommandResult>;
    /**
     * 시뮬레이션 딜레이
     */
    private delay;
}
//# sourceMappingURL=demo.d.ts.map