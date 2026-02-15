/**
 * @module commands/annotations
 * @description Annotations 명령어 핸들러 - 보강 주석 생성 및 조회
 */
import { Command, CommandResult } from '../types/common';
/**
 * AnnotationsCommand - 보강 주석 명령어
 *
 * 사용법: /impact annotations [generate [path]] [view [path]]
 * 기능:
 *   - LLM 기반 보강 주석 생성
 *   - 기존 보강 주석 조회
 *   - 보강 주석 상태 요약
 */
export declare class AnnotationsCommand implements Command {
    readonly name = "annotations";
    readonly description = "\uBCF4\uAC15 \uC8FC\uC11D\uC744 \uC0DD\uC131\uD558\uAC70\uB098 \uAE30\uC874 \uBCF4\uAC15 \uC8FC\uC11D\uC744 \uC870\uD68C\uD569\uB2C8\uB2E4.";
    private readonly args;
    constructor(args: string[]);
    execute(): Promise<CommandResult>;
}
//# sourceMappingURL=annotations.d.ts.map