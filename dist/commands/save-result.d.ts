/**
 * @module commands/save-result
 * @description Save Result 명령어 핸들러 - 분석 결과 JSON 파일을 저장소에 등록
 */
import { Command, CommandResult } from '../types/common';
/**
 * SaveResultCommand - 분석 결과 저장 명령어
 *
 * 사용법: /impact save-result --file <path> [--project <id>]
 * 기능:
 *   - JSON 파일을 읽어 검증 후 ResultManager를 통해 저장
 *   - analysisMethod가 없으면 'claude-native' 기본 설정
 *   - --project <id>: 특정 프로젝트 지정
 */
export declare class SaveResultCommand implements Command {
    readonly name = "save-result";
    readonly description = "\uBD84\uC11D \uACB0\uACFC JSON \uD30C\uC77C\uC744 \uD504\uB85C\uC81D\uD2B8 \uC800\uC7A5\uC18C\uC5D0 \uB4F1\uB85D\uD569\uB2C8\uB2E4.";
    private readonly args;
    constructor(args: string[]);
    execute(): Promise<CommandResult>;
    /**
     * 프로젝트 ID를 확정
     */
    private resolveProjectId;
    /**
     * 인자에서 옵션 값을 추출
     */
    private getOption;
}
//# sourceMappingURL=save-result.d.ts.map