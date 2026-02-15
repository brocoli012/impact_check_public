/**
 * @module commands/view
 * @description View 명령어 핸들러 - 분석 결과 시각화 웹을 실행
 */
import { Command, CommandResult } from '../types/common';
/**
 * ViewCommand - 시각화 웹 서버 명령어
 *
 * 사용법: /impact view [--stop]
 * 기능:
 *   - Express.js 웹 서버 시작
 *   - React SPA 정적 파일 서빙
 *   - 브라우저 자동 열기
 */
export declare class ViewCommand implements Command {
    readonly name = "view";
    readonly description = "\uBD84\uC11D \uACB0\uACFC \uC2DC\uAC01\uD654 \uC6F9\uC744 \uC2E4\uD589\uD569\uB2C8\uB2E4.";
    private readonly args;
    constructor(args: string[]);
    execute(): Promise<CommandResult>;
    /**
     * 서버 시작 처리
     */
    private handleStart;
    /**
     * 서버 중지 처리
     */
    private handleStop;
}
//# sourceMappingURL=view.d.ts.map