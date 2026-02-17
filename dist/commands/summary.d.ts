/**
 * @module commands/summary
 * @description Summary 명령어 핸들러 - 프로젝트 요약 정보
 *
 * 기능:
 *   - 전체 프로젝트 통계 (기본 동작)
 *   - --system <name>: 특정 시스템(모듈) 상세 요약
 *   - --recent: Git log 기반 최근 변경 요약
 */
import { Command, CommandResult } from '../types/common';
/**
 * SummaryCommand - 프로젝트 요약 정보 명령어
 *
 * 사용법:
 *   /impact summary                     - 전체 프로젝트 통계
 *   /impact summary --system <name>     - 특정 시스템 상세 요약
 *   /impact summary --recent            - 최근 변경 요약
 */
export declare class SummaryCommand implements Command {
    readonly name = "summary";
    readonly description = "\uD504\uB85C\uC81D\uD2B8 \uC694\uC57D \uC815\uBCF4";
    private readonly args;
    constructor(args: string[]);
    execute(): Promise<CommandResult>;
    private handleProjectSummary;
    private handleSystemSummary;
    private handleRecentChanges;
    /**
     * 활성 프로젝트 정보를 가져온다.
     */
    private getActiveProject;
    /**
     * 인덱스에서 사용 가능한 시스템(모듈) 이름 목록을 추출한다.
     * 파일 경로의 최상위 디렉토리, 컴포넌트 타입, 정책 카테고리 등에서 추출
     */
    private extractAvailableSystems;
}
//# sourceMappingURL=summary.d.ts.map