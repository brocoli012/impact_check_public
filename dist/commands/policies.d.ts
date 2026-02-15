/**
 * @module commands/policies
 * @description Policies 명령어 핸들러 - 정책 사전 조회 및 검색
 */
import { Command, CommandResult } from '../types/common';
/**
 * PoliciesCommand - 정책 관리 명령어
 *
 * 사용법:
 *   /impact policies                    - 전체 정책 목록 조회
 *   /impact policies --search <keyword> - 키워드 검색
 *   /impact policies --system <name>    - 시스템별 필터
 */
export declare class PoliciesCommand implements Command {
    readonly name = "policies";
    readonly description = "\uC815\uCC45 \uC0AC\uC804\uC744 \uC870\uD68C\uD558\uAC70\uB098 \uAC80\uC0C9\uD569\uB2C8\uB2E4.";
    private readonly args;
    constructor(args: string[]);
    execute(): Promise<CommandResult>;
    /**
     * 전체 정책 목록 조회
     */
    private handleList;
    /**
     * 키워드 검색
     */
    private handleSearch;
    /**
     * 시스템별 필터
     */
    private handleSystemFilter;
    /**
     * 정책 목록 표시
     */
    private displayPolicies;
}
//# sourceMappingURL=policies.d.ts.map