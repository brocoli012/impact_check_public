/**
 * @module commands/status
 * @description Status 명령어 핸들러 - 등록된 프로젝트 상태 요약 표시
 */
import { Command, CommandResult } from '../types/common';
/**
 * StatusCommand - 프로젝트 상태 요약 명령어
 *
 * 사용법: /impact status
 * 기능:
 *   - 등록된 프로젝트 목록 및 상태 요약
 *   - 프로젝트별 분석 건수, 최근 분석 등급/점수/날짜
 *   - 최근 분석 5건 (전체 프로젝트 합산)
 *   - 프로젝트 수에 따른 출력 형식 분기
 */
export declare class StatusCommand implements Command {
    readonly name = "status";
    readonly description = "\uB4F1\uB85D\uB41C \uD504\uB85C\uC81D\uD2B8 \uC0C1\uD0DC \uC694\uC57D\uC744 \uD45C\uC2DC\uD569\uB2C8\uB2E4.";
    constructor(_args: string[]);
    execute(): Promise<CommandResult>;
    /**
     * 리스트 형식 출력 (1~6개 프로젝트)
     */
    private renderList;
    /**
     * 테이블 형식 출력 (7개+ 프로젝트)
     */
    private renderTable;
}
//# sourceMappingURL=status.d.ts.map