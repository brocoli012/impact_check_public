/**
 * @module commands/cross-analyze
 * @description CrossAnalyze 명령어 핸들러 - 크로스 프로젝트 영향도 분석
 *
 * 기능:
 *   - 소스 프로젝트 기준으로 연결된 프로젝트 간 영향도 분석
 *   - --source <project-id>: 소스 프로젝트 지정 (기본: 활성 프로젝트)
 *   - --group <group-name>: 특정 그룹 대상으로 분석
 */
import { Command, CommandResult } from '../types/common';
/**
 * CrossAnalyzeCommand - 크로스 프로젝트 영향도 분석 명령어
 *
 * 사용법:
 *   /impact cross-analyze                          - 활성 프로젝트 기준 분석
 *   /impact cross-analyze --source <project-id>   - 특정 소스 프로젝트 기준 분석
 *   /impact cross-analyze --group <group-name>    - 특정 그룹 대상으로 분석
 */
export declare class CrossAnalyzeCommand implements Command {
    readonly name = "cross-analyze";
    readonly description = "\uD06C\uB85C\uC2A4 \uD504\uB85C\uC81D\uD2B8 \uC601\uD5A5\uB3C4 \uBD84\uC11D";
    private readonly args;
    constructor(args: string[]);
    execute(): Promise<CommandResult>;
    /**
     * 분석 결과 출력
     */
    private printResult;
    /**
     * 변경 유형 라벨
     */
    private getChangeLabel;
    /**
     * 활성 프로젝트 ID 가져오기
     */
    private getActiveProjectId;
}
//# sourceMappingURL=cross-analyze.d.ts.map