/**
 * @module commands/policy-check
 * @description PolicyCheck 명령어 핸들러 - 정책 영향도 분석
 *
 * 기능:
 *   - 전체 정책 현황 요약 (옵션 없이 실행)
 *   - --policy <이름>: 특정 정책 상세 조회 (부분 매칭)
 *   - --change <설명>: 변경 내용이 기존 정책에 미치는 영향 분석
 */
import { Command, CommandResult } from '../types/common';
/**
 * PolicyCheckCommand - 정책 영향도 분석 명령어
 *
 * 사용법:
 *   /impact policy-check                          - 전체 정책 현황 요약
 *   /impact policy-check --policy <name>          - 특정 정책 상세 조회
 *   /impact policy-check --change <description>   - 변경 영향도 분석
 */
export declare class PolicyCheckCommand implements Command {
    readonly name = "policy-check";
    readonly description = "\uC815\uCC45 \uC601\uD5A5\uB3C4 \uBD84\uC11D";
    private readonly args;
    constructor(args: string[]);
    execute(): Promise<CommandResult>;
    private handleSummary;
    private handlePolicyDetail;
    private handleChangeImpact;
    /**
     * 활성 프로젝트 정보를 가져온다.
     */
    private getActiveProject;
    /**
     * 의존 관계 그래프에서 관련 서브그래프 추출
     */
    private getRelatedEdges;
    /**
     * 보강 주석 상세 출력
     */
    private displayAnnotationDetails;
    /**
     * 충돌 가능 정책 식별 (동일 카테고리 내 다른 정책)
     */
    private findConflictCandidates;
    /**
     * 변경 내용에서 키워드 추출
     */
    private extractKeywords;
    /**
     * 키워드로 인덱스 검색 (파일명, 컴포넌트명, API 경로, 정책명 매칭)
     */
    private searchByKeywords;
    /**
     * 정책과 관련된 파일 목록 수집
     */
    private getFilesForPolicy;
    /**
     * 기획자 체크리스트 생성
     */
    private generateChecklist;
}
//# sourceMappingURL=policy-check.d.ts.map