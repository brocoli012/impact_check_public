/**
 * @module commands/update
 * @description Update 명령어 핸들러 - KIC 도구를 최신 버전으로 업데이트
 */
import { Command, CommandResult } from '../types/common';
/**
 * UpdateCommand - KIC 업데이트 명령어
 *
 * 사용법: /impact update [--check] [--force]
 * 기능:
 *   - 최신 버전 확인 (기본)
 *   - --check: 업데이트 확인만 수행
 *   - --force: 즉시 업데이트 수행
 */
export declare class UpdateCommand implements Command {
    readonly name = "update";
    readonly description = "KIC \uB3C4\uAD6C\uB97C \uCD5C\uC2E0 \uBC84\uC804\uC73C\uB85C \uC5C5\uB370\uC774\uD2B8\uD569\uB2C8\uB2E4.";
    private readonly args;
    /** 패키지 루트 디렉토리 */
    private readonly skillDir;
    constructor(args: string[]);
    execute(): Promise<CommandResult>;
    /**
     * 업데이트 가능 여부 확인
     * Git fetch 후 로컬과 원격 브랜치 비교
     */
    private checkForUpdate;
    /**
     * 업데이트 수행
     * git pull → npm install → npm run build
     */
    private performUpdate;
}
//# sourceMappingURL=update.d.ts.map