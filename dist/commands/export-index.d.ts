/**
 * @module commands/export-index
 * @description Export Index 명령어 핸들러 - 코드 인덱스를 요약/전체 형태로 내보내기
 */
import { Command, CommandResult } from '../types/common';
/**
 * ExportIndexCommand - 인덱스 내보내기 명령어
 *
 * 사용법: /impact export-index [--project <id>] [--summary|--full] [--output <file>]
 * 기능:
 *   - --summary (기본): 요약 형태로 출력
 *   - --full: 전체 인덱스 출력
 *   - --output <file>: 파일로 저장
 *   - --project <id>: 특정 프로젝트 지정
 */
export declare class ExportIndexCommand implements Command {
    readonly name = "export-index";
    readonly description = "\uCF54\uB4DC \uC778\uB371\uC2A4\uB97C \uC694\uC57D \uB610\uB294 \uC804\uCCB4 \uD615\uD0DC\uB85C \uB0B4\uBCF4\uB0C5\uB2C8\uB2E4.";
    private readonly args;
    constructor(args: string[]);
    execute(): Promise<CommandResult>;
    /**
     * 프로젝트 ID를 확정 (명시적 지정 또는 활성 프로젝트)
     */
    private resolveProjectId;
    /**
     * 인자에서 옵션 값을 추출
     */
    private getOption;
}
//# sourceMappingURL=export-index.d.ts.map