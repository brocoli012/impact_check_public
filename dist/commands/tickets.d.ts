/**
 * @module commands/tickets
 * @description Tickets 명령어 핸들러 - 분석 결과에서 작업 티켓 마크다운 파일 생성
 */
import { Command, CommandResult } from '../types/common';
/**
 * TicketsCommand - 티켓 생성 명령어
 *
 * 사용법: /impact tickets [--result-id <id>] [--output <dir>]
 * 기능:
 *   - 분석 결과 기반 작업 티켓 Markdown 파일 생성
 *   - 각 티켓에 유형, 점수, 영향 파일, 의존성 포함
 */
export declare class TicketsCommand implements Command {
    readonly name = "tickets";
    readonly description = "\uBD84\uC11D \uACB0\uACFC\uC5D0\uC11C \uC791\uC5C5 \uD2F0\uCF13\uC744 \uC0DD\uC131\uD569\uB2C8\uB2E4.";
    private readonly args;
    constructor(args: string[]);
    execute(): Promise<CommandResult>;
    /**
     * 작업에서 티켓 마크다운 생성
     */
    private generateTicketMarkdown;
    /**
     * 작업 유형 라벨
     */
    private getActionLabel;
    /**
     * 작업 점수 조회
     */
    private findTaskScore;
    /**
     * 점수 기반 등급 결정
     */
    private getGradeFromScore;
    /**
     * 작업의 의존성 추출
     */
    private findDependencies;
    /**
     * 옵션 값 가져오기
     */
    private getOption;
}
//# sourceMappingURL=tickets.d.ts.map